"""Hybrid dataset search over the index built by processing.build_index.

Four ranked lists are merged with weighted reciprocal rank fusion (RRF: score = sum weight / (rrf_k + rank)):
  card vectors, card BM25 (one text per dataset)   -> how well the dataset as a whole fits
  chunk vectors, chunk BM25 (page/manual pieces)   -> a dataset ranks by its best chunk
Each hit also reports the best raw cosine similarity (card and chunk); these absolute values are what a
later "AI Hub has no match" threshold will use, because RRF scores are only relative.
The student profile (major, level, practicality) is NOT applied here; that is the recommender's job.

Usage (project root):
    python -m processing.search "강아지 행동 영상"
    python -m processing.search "plant disease photos of apples" --top 5
    python -m processing.search --eval eval/queries_test_v1.csv      # top-1 / top-5 / MRR on test questions
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field

import numpy as np
from rank_bm25 import BM25Okapi

from processing import embed
from processing.build_index import read_faiss, tokenize
from processing.search_config import load_search_cfg


@dataclass
class Hit:
    dataset_id: str
    title: str
    score: float                       # RRF score
    card_cos: float = 0.0              # cosine of the query with the dataset card
    chunk_cos: float = 0.0             # best cosine with any chunk of the dataset
    lists: list[str] = field(default_factory=list)     # which of the 4 lists found it
    best_chunk: dict | None = None     # best matching chunk (vector list first, else BM25)


class SearchIndex:
    def __init__(self, cfg: dict | None = None):
        self.cfg = cfg or load_search_cfg()
        d = self.cfg["paths"]["index_dir"]
        read = lambda n: [json.loads(l) for l in (d / n).read_text(encoding="utf-8").splitlines() if l.strip()]
        self.cards, self.chunks = read("cards.jsonl"), read("chunks.jsonl")
        self.card_vec = read_faiss(d / "cards.faiss")
        self.chunk_vec = read_faiss(d / "chunks.faiss")
        if self.card_vec.ntotal != len(self.cards) or self.chunk_vec.ntotal != len(self.chunks):
            raise SystemExit("index and jsonl files differ: re-run processing.build_index after processing.chunk")
        load = lambda n: json.loads((d / n).read_text(encoding="utf-8"))
        self.card_bm25 = BM25Okapi(load("cards.tokens.json"))
        self.chunk_bm25 = BM25Okapi(load("chunks.tokens.json"))
        self.titles = {c["dataset_id"]: c["text"].split("\n", 1)[0] for c in self.cards}

    def search(self, query: str, top_k: int | None = None) -> list[Hit]:
        s = self.cfg["search"]
        top_k, n, k = top_k or s["top_k"], s["candidates"], s["rrf_k"]
        q = embed.embed_texts([query], embed.TASK_QUERY, self.cfg)
        toks = tokenize(query)
        hits: dict[str, Hit] = {}

        def hit(i: str) -> Hit:
            return hits.setdefault(i, Hit(i, self.titles.get(i, i), 0.0))

        def fuse(name: str, ranked_ids: list[str]) -> None:
            w = s["weights"][name]
            for rank, i in enumerate(dict.fromkeys(ranked_ids)):     # first (best) place per dataset
                h = hit(i)
                h.score += w / (k + rank + 1)
                h.lists.append(name)

        # card vectors
        sims, idx = self.card_vec.search(q, min(n, len(self.cards)))
        for sim, j in zip(sims[0], idx[0]):
            if j >= 0:
                hit(self.cards[j]["dataset_id"]).card_cos = float(sim)
        fuse("card_vec", [self.cards[j]["dataset_id"] for j in idx[0] if j >= 0])
        # chunk vectors
        sims, idx = self.chunk_vec.search(q, min(n, len(self.chunks)))
        order = []
        for sim, j in zip(sims[0], idx[0]):
            if j < 0:
                continue
            ch = self.chunks[j]
            h = hit(ch["dataset_id"])
            if sim > h.chunk_cos:
                h.chunk_cos, h.best_chunk = float(sim), ch
            order.append(ch["dataset_id"])
        fuse("chunk_vec", order)
        # BM25 (only when the query has tokens)
        if toks:
            for name, bm, rows in (("card_bm25", self.card_bm25, self.cards), ("chunk_bm25", self.chunk_bm25, self.chunks)):
                sc = bm.get_scores(toks)
                top = [j for j in np.argsort(-sc)[:n] if sc[j] > 0]
                if name == "chunk_bm25":
                    for j in top:
                        h = hit(rows[j]["dataset_id"])
                        if h.best_chunk is None:
                            h.best_chunk = rows[j]
                fuse(name, [rows[j]["dataset_id"] for j in top])
        return sorted(hits.values(), key=lambda h: -h.score)[:top_k]


def evaluate(idx: SearchIndex, csv_path: str, k: int = 5) -> dict:
    """Score a test CSV (query, expected_id, note). expected_id lists acceptable ids separated by "|";
    an empty expected_id marks a question AI Hub has no answer for.

    Returns top-1, top-k and MRR (mean of 1/rank of the first correct dataset, 0 if not in the top k)
    over answerable questions, plus per-question rows for printing and no-match analysis.
    """
    import csv
    rows = list(csv.DictReader(open(csv_path, encoding="utf-8")))
    out = []
    for r in rows:
        hs = idx.search(r["query"], k)
        ids = [h.dataset_id for h in hs]
        want = {x.strip() for x in r["expected_id"].split("|") if x.strip()}
        rank = next((n for n, i in enumerate(ids, 1) if i in want), 0)
        out.append({"query": r["query"], "want": want, "ids": ids, "rank": rank,
                    "card_cos": hs[0].card_cos, "chunk_cos": max(h.chunk_cos for h in hs),
                    "gap": hs[0].card_cos - (hs[1].card_cos if len(hs) > 1 else 0.0)})
    ans = [o for o in out if o["want"]]
    return {"n": len(ans), "top1": sum(o["rank"] == 1 for o in ans), "topk": sum(o["rank"] > 0 for o in ans),
            "mrr": sum(1 / o["rank"] for o in ans if o["rank"]) / max(len(ans), 1), "k": k, "rows": out}


def run_eval(idx: SearchIndex, csv_path: str, k: int = 5) -> None:
    res = evaluate(idx, csv_path, k)
    for o in res["rows"]:
        mark = "--" if not o["want"] else ("OK" if o["rank"] == 1 else ("k " if o["rank"] else "XX"))
        want = "|".join(sorted(o["want"], key=int)) if o["want"] else "none"
        print(f"{mark} {o['query'][:45]:45s} -> {o['ids'][0]:>6s} card {o['card_cos']:.3f}  (want {want[:40]})")
    print(f"top-1 {res['top1']}/{res['n']}, top-{k} {res['topk']}/{res['n']}, MRR {res['mrr']:.3f}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("query", nargs="*")
    p.add_argument("--top", type=int, default=5)
    p.add_argument("--eval", metavar="CSV", help="evaluate queries from a CSV (query, expected_id, note)")
    a = p.parse_args()
    if not a.query and not a.eval:
        p.error("give a query or --eval CSV")
    idx = SearchIndex()
    if a.eval:
        run_eval(idx, a.eval, a.top)
        return
    q = " ".join(a.query)
    print(f"query: {q}")
    for r, h in enumerate(idx.search(q, a.top), 1):
        snip = (h.best_chunk["text"][:90].replace("\n", " / ") if h.best_chunk else "")
        print(f"{r:2d}. {h.dataset_id:>6s} rrf {h.score:.4f} card {h.card_cos:.3f} chunk {h.chunk_cos:.3f} "
              f"[{','.join(h.lists)}] {h.title[:60]}\n      {snip}")


if __name__ == "__main__":
    main()
