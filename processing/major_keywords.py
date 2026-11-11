"""Suggested search keywords per major, for a student who types nothing.

For each major and language (ko, en):
  1. candidates: the major profile's data-interest topics and keywords and its key topics (plain student words),
     plus keywords that appear in several of the major's top datasets; method words are dropped (stopwords);
  2. each candidate is run through the real recommender for that major (processing.recommend);
     it is kept only if AI Hub has a close match and its best result matches the keyword (interest >= min_interest)
     and fits the major (major >= min_major); English also tries the words of the datasets the Korean picks found;
  3. keywords are chosen best first, skipping any whose top-5 datasets overlap an already chosen one too much,
     so each keyword leads to a different part of AI Hub.
Settings: `keywords` in config/ranking.yaml. Output: data/profiles/major_keywords.json.
Candidate texts are embedded in batches (Gemini, cached), so a rebuild costs almost nothing.

Usage (project root):
    python -m processing.major_keywords build                       # all 31 majors
    python -m processing.major_keywords build --majors pharm culc   # some majors (others kept)
    python -m processing.major_keywords show --major pharm --lang en
"""
from __future__ import annotations

import argparse
import json
import logging
import re
from collections import Counter
from datetime import date
from pathlib import Path

from processing import embed
from processing.recommend import MAJORS_FILE, Profile, Recommender

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "profiles" / "major_keywords.json"
_PAREN = re.compile(r"\s*\(.*?\)")
# code-like words (model names, standards, codes): capital runs, CamelCase, digits other than 2D/3D/4D, & or /
_CODE = re.compile(r"[A-Z]{2,}|[a-z][A-Z]|[0-9](?![dD](?:[^A-Za-z]|$))|[&/]")


def _clean(text: str) -> str:
    return _PAREN.sub("", text).strip()


def candidates(m: dict, top_records: list[dict], lang: str, cfg: dict, extra: list[dict] | None = None) -> dict[str, str]:
    """keyword -> source ('profile' or 'datasets'), in a stable order."""
    k = cfg["keywords"]
    stop = {s.lower() for s in k["stopwords"]}
    out: dict[str, str] = {}

    def add(word: str, source: str) -> None:
        w = _clean(word)
        if source == "datasets" and _CODE.search(w):
            return
        if 2 <= len(w) <= 25 and w.lower() not in stop and w not in out:
            out[w] = source

    for d in m["data_interests"]:
        add(d["topic_ko" if lang == "ko" else "topic_en"], "profile")
        if lang == "ko":
            for w in d["keywords"]:
                add(w, "profile")
    if lang == "ko":
        for t in m["key_topics"]:
            for part in t.split("·") if len(t) > 12 else [t]:
                add(part, "profile")
    field = "keywords_ko" if lang == "ko" else "keywords_en"
    counts = Counter(w for r in top_records for w in r[field])
    for w, n in counts.most_common():
        if n >= k["dataset_keyword_min"]:
            add(w, "datasets")
    for r in extra or []:            # English: words of the datasets the chosen Korean keywords found
        for w in r[field]:
            add(w, "datasets")
    return out


def suggest(major: str, lang: str = "ko", n: int = 10) -> list[str]:
    """Suggested search keywords for a student of this major who typed nothing (from the built file)."""
    data = json.loads(OUT.read_text(encoding="utf-8"))["majors"]
    return [x["keyword"] for x in data.get(major, {}).get(lang, [])[:n]]


def overlap(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a | b else 0.0


def choose(scored: list[dict], cfg: dict) -> list[dict]:
    """Best first; skip keywords whose top datasets overlap a chosen keyword's too much."""
    k = cfg["keywords"]
    ranked = sorted(scored, key=lambda x: -(x["top_score"] + (k["profile_bonus"] if x["source"] == "profile" else 0)))
    picked: list[dict] = []
    for x in ranked:
        if len(picked) >= k["per_major"]:
            break
        if all(overlap(set(x["top_ids"]), set(p["top_ids"])) <= k["max_overlap"] for p in picked):
            picked.append(x)
    return picked


def build(rec: Recommender, major_ids: list[str]) -> dict:
    cfg = rec.cfg
    majors = {m["id"]: m for m in json.loads(MAJORS_FILE.read_text(encoding="utf-8"))["majors"]}
    result: dict = {}
    for mid in major_ids:
        m = majors[mid]
        top = [rec.recs[x.dataset_id] for x in rec.recommend(Profile(major=mid), cfg["keywords"]["top_datasets"])[0]]
        result[mid] = {}
        for lang in ("ko", "en"):
            extra = [rec.recs[i] for x in result[mid].get("ko", []) for i in x["top_ids"][:2]] if lang == "en" else None
            cands = candidates(m, top, lang, cfg, extra)
            embed.embed_texts(list(cands), embed.TASK_QUERY, rec.index.cfg)   # one batched call; search hits the cache
            scored = []
            for word, source in cands.items():
                items, no_match = rec.recommend(Profile(major=mid, text=word, lang=lang), 5)
                best = items[0].parts if items else {}
                if (items and not no_match and best.get("interest", 0) >= cfg["keywords"]["min_interest"]
                        and best.get("major", 0) >= cfg["keywords"]["min_major"]):
                    scored.append({"keyword": word, "source": source, "top_score": round(items[0].score, 1),
                                   "top_ids": [x.dataset_id for x in items]})
            result[mid][lang] = choose(scored, cfg)
            logging.info("%-15s %s: %d candidates, %d good, %d kept", mid, lang, len(cands), len(scored),
                         len(result[mid][lang]))
    return result


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cmd", choices=["build", "show"])
    p.add_argument("--majors", nargs="+", help="build: only these majors (default: all)")
    p.add_argument("--major", help="show: one major id")
    p.add_argument("--lang", choices=["ko", "en"], default="ko")
    a = p.parse_args()
    if a.cmd == "show":
        if not a.major:
            p.error("show needs --major")
        data = json.loads(OUT.read_text(encoding="utf-8"))["majors"]
        for n, x in enumerate(data[a.major][a.lang], 1):
            print(f"{n:2d}. {x['keyword']:28s} best {x['top_score']:4.1f}/10  ({x['source']})  e.g. {', '.join(x['top_ids'][:3])}")
        return
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    rec = Recommender()
    ids = a.majors or sorted(rec.links)
    old = json.loads(OUT.read_text(encoding="utf-8"))["majors"] if OUT.exists() else {}
    old.update(build(rec, ids))
    OUT.write_text(json.dumps({"about": "Suggested search keywords per major (ko/en), each tested with a real search "
                                        "for that major. Built by processing/major_keywords.py.",
                               "built": date.today().isoformat(), "majors": old}, ensure_ascii=False, indent=1),
                   encoding="utf-8")
    logging.info("%d majors -> %s (API requests this run: %d)", len(ids), OUT, embed.api_calls)


if __name__ == "__main__":
    main()
