"""Build the search index from data/index/chunks.jsonl and cards.jsonl (written by processing.chunk).

Writes to data/index/:
  cards.faiss, chunks.faiss          vectors (Gemini embeddings, cosine via inner product on unit vectors)
  cards.tokens.json, chunks.tokens.json   Kiwi tokens for BM25 keyword search (BM25 itself is built at load)
  meta.json                          model, sizes, counts, build time

Embeddings are cached (data/index/embedding_cache.sqlite), so a rebuild only pays for new or changed text.

Usage (project root):
    python -m processing.chunk --ids 59 74 146     # first: chunks for the datasets you want
    python -m processing.build_index               # then: embed + write the index
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime

import faiss
import numpy as np

from processing import embed
from processing.search_config import load_search_cfg

# Kiwi part-of-speech tags kept for BM25: nouns, verb/adjective stems, roots, foreign words, Chinese, numbers.
KEEP_TAGS = ("NN", "NR", "NP", "VV", "VA", "XR", "SL", "SH", "SN")
_kiwi = None
_bm25_cfg: dict | None = None


def tokenize(text: str) -> list[str]:
    """Korean + English tokens for BM25: lower-cased, request words dropped, English plurals folded."""
    global _kiwi, _bm25_cfg
    if _kiwi is None:
        from kiwipiepy import Kiwi
        _kiwi = Kiwi()
        b = load_search_cfg()["bm25"]
        _bm25_cfg = {"stop": {str(w).lower() for w in b["stopwords_en"] + b["stopwords_ko"]},
                     "fold": b["fold_plural_en"]}
    out = []
    for t in _kiwi.tokenize(text):
        if not t.tag.startswith(KEEP_TAGS):
            continue
        w = t.form.lower()
        if _bm25_cfg["fold"] and t.tag == "SL" and len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        if w not in _bm25_cfg["stop"]:
            out.append(w)
    return out


def write_faiss(index, path) -> None:
    """FAISS's own file writer fails on non-ASCII Windows paths (e.g. 'Рабочий стол'), so write bytes in Python."""
    path.write_bytes(faiss.serialize_index(index).tobytes())


def read_faiss(path):
    return faiss.deserialize_index(np.frombuffer(path.read_bytes(), dtype=np.uint8))


def _read_jsonl(path) -> list[dict]:
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    cfg = load_search_cfg()
    d = cfg["paths"]["index_dir"]
    t0 = time.time()
    counts = {}
    for name, field in (("cards", "text"), ("chunks", "embed_text")):
        rows = _read_jsonl(d / f"{name}.jsonl")
        texts = [r[field] for r in rows]
        vecs = embed.embed_texts(texts, embed.TASK_DOCUMENT, cfg, show_progress=True)
        index = faiss.IndexFlatIP(vecs.shape[1])
        index.add(np.ascontiguousarray(vecs))
        write_faiss(index, d / f"{name}.faiss")
        (d / f"{name}.tokens.json").write_text(json.dumps([tokenize(t) for t in texts], ensure_ascii=False),
                                               encoding="utf-8")
        counts[name] = len(rows)
        logging.info("%s: %d vectors -> %s", name, len(rows), d / f"{name}.faiss")
    meta = {"model": cfg["embedding"]["model"], "output_dim": cfg["embedding"]["output_dim"], **counts,
            "n_datasets": len({r["dataset_id"] for r in _read_jsonl(d / "cards.jsonl")}),
            "built": datetime.now().isoformat(timespec="seconds")}
    (d / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    logging.info("done in %.0f s, API requests this run: %d", time.time() - t0, embed.api_calls)


if __name__ == "__main__":
    main()
