"""Recommendation scoring: student profile + search results -> datasets ranked by relevance (0-10).

Runs after processing.search. The score answers one question: is this dataset related to this student?
    score = 10 * weighted mean of interest (free text and/or interest chips) and major fit;
    major fit = domain links (core/related) mixed with how similar the major profile text is to the dataset;
    a part with no input is skipped and the other weight is re-normalised (config/ranking.yaml).
Size, difficulty and the project idea are shown with each result as facts; they do not change the score.
MMR (maximal marginal relevance) then picks the final list so near-identical datasets do not crowd it.

Candidates: the search results for the free text (when given), plus every dataset in the chosen interest
chips; with neither, every dataset in the major's linked domains; with no major either, all datasets.

Usage (project root):
    python -m processing.recommend --major smartcity --text "교통 혼잡"
    python -m processing.recommend --major pharm --interests pharma --purpose thesis --lang en --top 5
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import yaml

from processing.domains import load_domains, load_major_links

ROOT = Path(__file__).resolve().parents[1]
RANKING_FILE = ROOT / "config" / "ranking.yaml"
EXPORT = ROOT / "data" / "enriched" / "aihub_datasets.json"
MAJORS_FILE = ROOT / "data" / "profiles" / "majors_ku_sejong.json"
PURPOSES = ["class", "capstone", "thesis", "competition", "self_study"]


@dataclass
class Profile:
    major: str | None = None            # major id from data/profiles/majors (None = not given / other)
    purpose: str | None = None          # one of PURPOSES; only chooses which project idea is shown
    interests: list[str] = field(default_factory=list)   # domain ids the student picked (chips)
    text: str = ""                      # optional "describe what you want"
    lang: str = "ko"                    # "ko" or "en": language of titles and reasons


@dataclass
class Recommendation:
    dataset_id: str
    title: str
    score: float                        # relevance, 0-10
    parts: dict[str, float]             # interest / major, each 0-1 (only the ones used)
    reasons: list[str]
    notes: list[str]                    # facts worth knowing (size, difficulty, no manual); not scored
    idea: dict | None                   # project idea matching the purpose
    text_sim: float = 0.0               # best cosine with the free text (0 when no text)
    card_sim: float = 0.0               # cosine of the free text with the dataset card (for search.yaml's match_label)


# ---------- scoring parts (pure functions; tested in tests/test_recommend.py) ----------

def text_interest(card_cos: float, chunk_cos: float, rrf: float, best_rrf: float, cfg: dict) -> float:
    c = cfg["interest"]
    sim = (max(card_cos, chunk_cos) - c["sim_low"]) / (c["sim_high"] - c["sim_low"])
    sim = min(max(sim, 0.0), 1.0)
    rank = rrf / best_rrf if best_rrf > 0 else 0.0
    return c["sim_share"] * sim + (1 - c["sim_share"]) * rank


def chip_interest(domains: list[str], chips: list[str], cfg: dict) -> float:
    if domains and domains[0] in chips:
        return cfg["interest"]["chip_main"]
    return cfg["interest"]["chip_other"] if set(domains) & set(chips) else 0.0


def major_fit(domains: list[str], links: list[dict], cfg: dict) -> float:
    c = cfg["major"]
    core = {x["domain"] for x in links if x["level"] == "core"}
    related = {x["domain"] for x in links if x["level"] == "related"}
    main = domains[0] if domains else None
    if main in core:
        return c["core_main"]
    if set(domains) & core:
        return c["core_other"]
    if main in related:
        return c["related_main"]
    return c["related_other"] if set(domains) & related else 0.0


def major_score(domain_fit: float, profile_sim: float, cfg: dict) -> float:
    s = cfg["major"]["profile_share"]
    return (1 - s) * domain_fit + s * profile_sim


def scale_sims(sims: np.ndarray) -> np.ndarray:
    """Map one major's similarities to all datasets onto 0..1: its median dataset -> 0, its most similar -> 1.
    (Percentiles were tried first: every in-field dataset landed at 0.95-1.0, so scores crowded at 9.8-10.)"""
    med, top = float(np.median(sims)), float(sims.max())
    return np.clip((sims - med) / (top - med), 0.0, 1.0) if top > med else np.zeros(len(sims))


def major_text(m: dict) -> str:
    """One search text per major, from its profile."""
    parts = [f"{m['name_ko']} / {m['name_en']}", m["summary_ko"], m["summary_en"],
             "주요 분야: " + ", ".join(m["key_topics"]),
             "데이터 관심사 / data interests: " + "; ".join(
                 f"{d['topic_ko']} ({d['topic_en']}): {', '.join(d['keywords'])}" for d in m["data_interests"]),
             "프로젝트 주제: " + ", ".join(m["project_themes"]),
             "연구 분야: " + ", ".join(m["research_areas"])]
    return "\n".join(p for p in parts if p)


def combine(parts: dict[str, float], cfg: dict, with_text: bool) -> float:
    """Relevance on a 0-10 scale: 10 * weighted mean of the parts that are present."""
    w = cfg["weights"]["with_text" if with_text else "no_text"]
    total = sum(w[k] for k in parts)
    return float(10 * sum(w[k] * v for k, v in parts.items()) / total) if total else 0.0   # plain float, JSON-safe


def mmr(order: list[str], scores: dict[str, float], vecs: dict[str, np.ndarray], k: int, lam: float) -> list[str]:
    """Pick k ids: each step takes the best lam * score - (1 - lam) * max similarity to the ids already taken.
    Scores are 0-10, so they are divided by 10 to sit on the same scale as cosine similarity."""
    picked: list[str] = []
    pool = list(order)
    while pool and len(picked) < k:
        def value(i: str) -> float:
            s = scores[i] / 10
            if not picked or i not in vecs:
                return lam * s
            return lam * s - (1 - lam) * max(float(vecs[i] @ vecs[j]) for j in picked if j in vecs)
        best = max(pool, key=value)
        picked.append(best)
        pool.remove(best)
    return picked


def _downloads(r: dict) -> int:
    try:
        return int(str(r.get("downloads", "0")).replace(",", ""))
    except ValueError:
        return 0


def pick_idea(ideas: list[dict], purpose: str | None, cfg: dict) -> dict | None:
    want = cfg["idea_for_purpose"].get(purpose) if purpose else None
    return next((x for x in ideas if x["level"] == want), ideas[0] if ideas else None)


# ---------- the recommender ----------

class Recommender:
    def __init__(self, index=None):
        self.cfg = yaml.safe_load(RANKING_FILE.read_text(encoding="utf-8"))
        self.recs = {r["dataset_id"]: r for r in json.loads(EXPORT.read_text(encoding="utf-8"))["datasets"]}
        self.domains = load_domains()["domains"]
        self.links = load_major_links()
        majors = json.loads(MAJORS_FILE.read_text(encoding="utf-8"))["majors"]
        self.major_names = {m["id"]: (m["name_ko"], m["name_en"]) for m in majors}
        if index is None:
            from processing.search import SearchIndex
            index = SearchIndex()
        self.index = index
        vecs = index.card_vec.reconstruct_n(0, index.card_vec.ntotal)
        ids = [c["dataset_id"] for c in index.cards]
        self.card_vecs = dict(zip(ids, vecs))
        # major profile vs. every dataset card, scaled 0..1 per major (31 texts; embedded once, then cached)
        from processing import embed
        mvecs = embed.embed_texts([major_text(m) for m in majors], embed.TASK_QUERY, index.cfg)
        self.profile_sim = {m["id"]: dict(zip(ids, scale_sims(vecs @ mv))) for m, mv in zip(majors, mvecs)}

    def check(self, p: Profile) -> None:
        if p.purpose is not None and p.purpose not in PURPOSES:
            raise ValueError(f"purpose must be one of {PURPOSES}, got {p.purpose!r}")
        if p.major is not None and p.major not in self.links:
            raise ValueError(f"unknown major {p.major!r}")
        if bad := [d for d in p.interests if d not in self.domains]:
            raise ValueError(f"unknown interest domains {bad} (see config/domains.yaml)")

    def recommend(self, p: Profile, top_k: int = 10) -> tuple[list[Recommendation], bool]:
        """Return (recommendations, no_exact_match). no_exact_match is only set when free text was given."""
        self.check(p)
        cfg = self.cfg
        hits = {}
        if p.text.strip():
            hits = {h.dataset_id: h for h in self.index.search(p.text, cfg["candidates"]["from_search"])}
        cands = set(hits)
        if p.interests:
            cands |= {i for i, r in self.recs.items() if set(r["domains"]) & set(p.interests)}
        if not cands:
            if p.major:
                linked = {x["domain"] for x in self.links[p.major]}
                cands = {i for i, r in self.recs.items() if set(r["domains"]) & linked}
            else:
                cands = set(self.recs)

        best_rrf = max((h.score for h in hits.values()), default=0.0)
        scores: dict[str, float] = {}
        parts_of: dict[str, dict[str, float]] = {}
        for i in cands:
            r = self.recs[i]
            parts: dict[str, float] = {}
            ti = None
            if hits:
                h = hits.get(i)
                ti = text_interest(h.card_cos, h.chunk_cos, h.score, best_rrf, cfg) if h else 0.0
            ci = chip_interest(r["domains"], p.interests, cfg) if p.interests else None
            if ti is not None and ci is not None:
                parts["interest"] = cfg["interest"]["text_share"] * ti + (1 - cfg["interest"]["text_share"]) * ci
            elif ti is not None or ci is not None:
                parts["interest"] = ti if ti is not None else ci
            if p.major:
                parts["major"] = major_score(major_fit(r["domains"], self.links[p.major], cfg),
                                             float(self.profile_sim[p.major][i]), cfg)
            parts_of[i] = parts
            scores[i] = combine(parts, cfg, bool(hits))

        # equal scores (common without free text) are ordered by AI Hub downloads, so the order is stable
        order = sorted(cands, key=lambda i: (-scores[i], -_downloads(self.recs[i])))[: top_k * 5]
        picked = mmr(order, scores, self.card_vecs, top_k, cfg["diversity"]["mmr_lambda"])
        no_match = False
        if hits:   # "weak" in search.yaml's match_label = best match below the "partial" line
            ml = self.index.cfg["match_label"]
            limit = ml["korean" if any("가" <= ch <= "힣" for ch in p.text) else "english"]["partial"]
            no_match = max(h.card_cos for h in hits.values()) < limit
        return [self._explain(i, scores[i], parts_of[i], hits.get(i), p) for i in picked], no_match

    def _explain(self, i: str, score: float, parts: dict, hit, p: Profile) -> Recommendation:
        cfg, r, ko = self.cfg, self.recs[i], p.lang == "ko"
        name = lambda d: self.domains[d]["ko" if ko else "en"]
        reasons, notes = [], []
        if parts.get("interest", 0) >= cfg["reason_min"]:
            if hit and p.text.strip():
                reasons.append("검색한 내용과 잘 맞습니다" if ko else "Matches what you searched for")
            if chip := [d for d in r["domains"] if d in p.interests]:
                x = ", ".join(name(d) for d in chip)
                reasons.append(f"고른 관심 분야인 {x}에 속합니다" if ko else f"In {x}, an interest you picked")
        if parts.get("major", 0) >= cfg["reason_min"]:
            linked = {x["domain"] for x in self.links[p.major]}
            m = self.major_names[p.major][0 if ko else 1]
            x = ", ".join(name(d) for d in r["domains"] if d in linked)
            reasons.append(f"전공({m})과 가까운 {x} 분야입니다" if ko else f"In {x}, a field close to your major ({m})")
        size = f"{r['total_gb']:,.0f} GB" if r["total_gb"] >= 1 else f"{r['total_gb'] * 1024:,.0f} MB"
        diff = {"beginner": "입문", "intermediate": "중급", "advanced": "고급"}[r["difficulty"]] if ko else r["difficulty"]
        notes.append(f"{'용량' if ko else 'Size'} {size} · {'난이도' if ko else 'Level'} {diff}")
        if not r["doc_used"]:
            notes.append("데이터 설명서가 없어 AI Hub 페이지 정보만 있습니다" if ko else "No manual; based on the AI Hub page only")
        return Recommendation(i, r["title_ko"] if ko else r["title_en"], score, parts, reasons, notes,
                              pick_idea(r["project_ideas"], p.purpose, cfg),
                              max(hit.card_cos, hit.chunk_cos) if hit else 0.0, hit.card_cos if hit else 0.0)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--major")
    p.add_argument("--purpose", choices=PURPOSES)
    p.add_argument("--interests", nargs="*", default=[], help="domain ids, e.g. pets_vet medical")
    p.add_argument("--text", default="", help="optional free text (Korean or English)")
    p.add_argument("--lang", choices=["ko", "en"], default="ko")
    p.add_argument("--top", type=int, default=8)
    a = p.parse_args()
    rec = Recommender()
    try:
        items, no_match = rec.recommend(Profile(a.major, a.purpose, a.interests, a.text, a.lang), a.top)
    except ValueError as e:
        p.error(str(e))
    if no_match:
        print("!! AI Hub may have no exact match; these are the closest datasets\n")
    for n, x in enumerate(items, 1):
        parts = " ".join(f"{k} {v:.2f}" for k, v in x.parts.items())
        print(f"{n:2d}. {x.dataset_id:>6s} {x.score:4.1f}/10 [{parts}] {x.title[:55]}")
        for s in x.reasons:
            print(f"      + {s}")
        for s in x.notes:
            print(f"      · {s}")
        if x.idea:
            print(f"      idea ({x.idea['level']}): {x.idea['title_ko' if a.lang == 'ko' else 'title_en']}")


if __name__ == "__main__":
    main()
