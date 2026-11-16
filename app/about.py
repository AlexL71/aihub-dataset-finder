"""Data for the three "About" pages of the student app (app/server.py registers the endpoints).

stats()   numbers and chart data about AI Hub, counted from our 867 dataset records
graph()   the data map: 8 groups -> 53 domains -> datasets (by main domain), plus each dataset's 5 most similar
          datasets (cosine of the dataset-card vectors, the same vectors search uses)
prep()    one dataset followed through every data-preparation step (excerpts, built by tools/build_prep_examples.py)
method()  the live scoring settings (config/ranking.yaml and config/search.yaml), so the explanation page
          always shows the numbers the app really uses
Everything is computed once, the first time a page asks, and kept in memory.
"""
from __future__ import annotations

import json
from collections import Counter
from functools import lru_cache
from pathlib import Path

import numpy as np

from processing import cards

ROOT = Path(__file__).resolve().parents[1]
PAGES_DIR = ROOT / "data" / "parsed" / "aihub" / "pages"
FIELDS_FILE = ROOT / "data" / "parsed" / "aihub" / "fields.json"   # the same, one small file (shipped for deployment)
PREP_FILE = ROOT / "data" / "about" / "prep_example.json"           # tools/build_prep_examples.py
N_SIMILAR = 5            # similar datasets listed per dataset on the map


def _int(v) -> int:
    try:
        return int(str(v).replace(",", ""))
    except ValueError:
        return 0


@lru_cache(maxsize=1)
def _aihub_fields() -> dict[str, str]:
    """AI Hub's own field (분야) per dataset: fields.json, or the parsed pages when they are here (they win: newer)."""
    out = json.loads(FIELDS_FILE.read_text(encoding="utf-8"))["fields"] if FIELDS_FILE.exists() else {}
    for p in PAGES_DIR.glob("*.json"):
        d = json.loads(p.read_text(encoding="utf-8"))
        out[str(d["dataset_id"])] = d.get("field") or "?"
    return out


def stats(S) -> dict:
    recs = list(S.recs.values())
    fields = Counter(_aihub_fields().get(r["dataset_id"], "?") for r in recs)
    years = Counter(r["build_year"] for r in recs if str(r["build_year"]).isdigit())
    mods = Counter(m for r in recs for m in r["modalities"])
    top = sorted(recs, key=lambda r: -_int(r["downloads"]))[:9]   # 9 for the page-top icon grid, 6 listed
    return {
        "n_datasets": len(recs),
        "total_tb": round(sum(r["total_gb"] or 0 for r in recs) / 1024),
        "n_manual": sum(bool(r["doc_used"]) for r in recs),
        "n_fields": len([f for f in fields if f != "?"]),
        "fields": [{"name": f, "n": n} for f, n in fields.most_common() if f != "?"],
        "years": [{"year": y, "n": years[y]} for y in sorted(years)],
        "modalities": [{"ko": cards.MODALITY.get(m, (m, m))[0], "en": cards.MODALITY.get(m, (m, m))[1], "n": n}
                       for m, n in mods.most_common()],
        "top_downloads": [{**S.card(r["dataset_id"]), "downloads": r["downloads"]} for r in top],
    }


_cache: dict[str, dict] = {}


def _similar(S, ids: list[str]) -> dict[str, list[tuple[str, float]]]:
    """Top N_SIMILAR neighbours of every dataset by card-vector cosine (vectors are unit length)."""
    vecs = np.stack([S.rec.card_vecs[i] for i in ids]).astype(np.float32)
    sims = vecs @ vecs.T
    np.fill_diagonal(sims, -1.0)
    out = {}
    for row, i in enumerate(ids):
        best = np.argpartition(-sims[row], N_SIMILAR)[:N_SIMILAR]
        best = best[np.argsort(-sims[row][best])]
        out[i] = [(ids[j], round(float(sims[row][j]), 3)) for j in best]
    return out


def graph(S) -> dict:
    if "graph" in _cache:
        return _cache["graph"]
    ids = sorted(S.recs, key=int)
    sim = _similar(S, ids)
    main_n = Counter(S.recs[i]["domains"][0] for i in ids)
    _cache["graph"] = {
        "groups": [{"id": g, "ko": v["ko"], "en": v["en"]} for g, v in S.groups.items()],
        "domains": [{"id": d, "ko": v["ko"], "en": v["en"], "group": v["group"], "n_main": main_n[d], "n": S.n_per_domain[d],
                     "scope_ko": v.get("scope_ko", ""), "scope_en": v.get("scope_en", "")}
                    for d, v in S.domains.items()],
        "datasets": [{"id": i, "title_ko": S.recs[i]["title_ko"], "title_en": S.recs[i]["title_en"],
                      "domains": S.recs[i]["domains"], "similar": sim[i], "icon": S.icon(i),          # list rows on the map page
                      "size": cards.size_text(S.recs[i]["total_gb"]), "difficulty": S.recs[i]["difficulty"],
                      "downloads": _int(S.recs[i]["downloads"]),
                      "modalities": [cards.MODALITY.get(m, (m, m)) for m in S.recs[i]["modalities"]]} for i in ids],
    }
    return _cache["graph"]


def method(S) -> dict:
    """Settings used by search and scoring, read from the same config the app runs with."""
    rc, sc = S.rec.cfg, S.rec.index.cfg
    return {
        "ranking": {k: rc[k] for k in ("weights", "interest", "major", "diversity", "candidates")},
        "search": {"weights": sc["search"]["weights"], "rrf_k": sc["search"]["rrf_k"],
                   "candidates": sc["search"]["candidates"], "match_label": sc["match_label"],
                   "embedding": {k: sc["embedding"][k] for k in ("model", "output_dim")},
                   "chunk_chars": sc["chunk"]["target_chars"]},
        "counts": {"datasets": len(S.recs), "cards": len(S.rec.index.cards), "chunks": len(S.rec.index.chunks),
                   "domains": len(S.domains), "groups": len(S.groups)},
    }


def prep(S) -> dict:
    """Examples for the data-preparation page, plus the counts the page quotes."""
    if "prep" not in _cache:
        ex = json.loads(PREP_FILE.read_text(encoding="utf-8")) if PREP_FILE.exists() else {"examples": {}}
        _cache["prep"] = {**ex, "counts": {"datasets": len(S.recs), "manuals": sum(bool(r["doc_used"]) for r in S.recs.values()),
                                           "cards": len(S.rec.index.cards), "chunks": len(S.rec.index.chunks),
                                           "chunk_chars": S.rec.index.cfg["chunk"]["target_chars"]}}
    return _cache["prep"]
