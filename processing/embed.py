"""Text embeddings (Gemini API).

All embedding calls go through `embed_texts`. To switch to a local model later (e.g. BGE-M3 for the AI Hub
handover), change only this module and rebuild the index: queries and documents must use the same model.
Vectors are cached in SQLite by (model, size, task type, text hash), so a text is never sent twice and an
interrupted run resumes where it stopped. The API key comes from the environment or .env and is never
printed or logged.
"""
from __future__ import annotations

import hashlib
import logging
import os
import random
import sqlite3
import time
from pathlib import Path
from typing import Any, Callable, Iterator, TypeVar

import numpy as np

from processing.env import load_dotenv

log = logging.getLogger(__name__)
T = TypeVar("T")
ROOT = Path(__file__).resolve().parents[1]

TASK_DOCUMENT = "RETRIEVAL_DOCUMENT"   # chunks and dataset cards
TASK_QUERY = "RETRIEVAL_QUERY"         # student questions
RETRY_STATUS = {429, 500, 502, 503, 504}

_client = None
_last_call = 0.0
api_calls = 0                          # real API requests in this process (cache hits don't count)


def _api_key(cfg: dict) -> str:
    name = cfg["embedding"]["api_key_env"]
    key = os.environ.get(name) or load_dotenv(ROOT / ".env").get(name, "")
    if not key:
        raise SystemExit(f"{name} is not set (environment or .env); see .env.example")
    return key


def _get_client(cfg: dict):
    global _client
    if _client is None:
        from google import genai
        from google.genai import types
        _client = genai.Client(api_key=_api_key(cfg),
                               http_options=types.HttpOptions(timeout=int(cfg["api"]["timeout_s"] * 1000)))
    return _client


def _is_retryable(exc: Exception) -> bool:
    import httpx
    from google.genai import errors
    if isinstance(exc, errors.APIError):
        return exc.code in RETRY_STATUS
    return isinstance(exc, (httpx.TimeoutException, httpx.TransportError))


def _call_with_retry(fn: Callable[[], T], cfg: dict, what: str) -> T:
    """Run `fn` with a minimum gap between calls and exponential backoff on temporary errors."""
    global _last_call, api_calls
    api = cfg["api"]
    for attempt in range(api["max_retries"] + 1):
        wait = api["min_interval_s"] - (time.monotonic() - _last_call)
        if wait > 0:
            time.sleep(wait)
        _last_call = time.monotonic()
        api_calls += 1
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - re-raised unless retryable
            if not _is_retryable(exc) or attempt == api["max_retries"]:
                raise
            delay = min(api["backoff_base_s"] * 2 ** attempt, api["backoff_max_s"]) * random.uniform(0.8, 1.2)
            log.warning("%s failed (%s); retry %d/%d in %.1fs", what, getattr(exc, "code", type(exc).__name__),
                        attempt + 1, api["max_retries"], delay)
            time.sleep(delay)
    raise AssertionError("unreachable")


def _cache_key(model: str, dim: int, task: str, text: str) -> str:
    return f"{model}|{dim}|{task}|{hashlib.sha256(text.encode('utf-8')).hexdigest()}"


def _open_cache(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(path))
    con.execute("CREATE TABLE IF NOT EXISTS emb (key TEXT PRIMARY KEY, vec BLOB NOT NULL)")
    return con


def _batches(items: list[int], size: int) -> Iterator[list[int]]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


def l2_normalize(v: np.ndarray) -> np.ndarray:
    return v / np.clip(np.linalg.norm(v, axis=1, keepdims=True), 1e-12, None)


def embed_texts(texts: list[str], task: str, cfg: dict[str, Any], show_progress: bool = False) -> np.ndarray:
    """Return an (n, output_dim) float32 array of L2-normalized vectors, in the order of `texts`."""
    emb = cfg["embedding"]
    if emb["provider"] != "gemini":
        raise SystemExit(f"unknown embedding provider {emb['provider']}")
    model, dim = emb["model"], int(emb["output_dim"])
    keys = [_cache_key(model, dim, task, t) for t in texts]
    con = _open_cache(cfg["paths"]["embedding_cache"])
    try:
        cached: dict[str, bytes] = {}
        uniq = list(dict.fromkeys(keys))
        for i in range(0, len(uniq), 500):                     # stay under SQLite's parameter limit
            part = uniq[i:i + 500]
            cached.update(con.execute(f"SELECT key, vec FROM emb WHERE key IN ({','.join('?' * len(part))})", part))
        missing, seen = [], set()
        for i, k in enumerate(keys):
            if k not in cached and k not in seen:
                missing.append(i)
                seen.add(k)
        log.info("embeddings: %d texts, %d cached, %d to request", len(texts), len(texts) - len(missing), len(missing))
        if missing:
            from google.genai import types
            client = _get_client(cfg)
            conf = types.EmbedContentConfig(task_type=task, output_dimensionality=dim)
            batches = list(_batches(missing, int(emb["batch_size"])))
            if show_progress:
                from tqdm import tqdm
                batches = tqdm(batches, desc="embedding", unit="batch")
            for batch in batches:
                contents = [texts[i] for i in batch]
                resp = _call_with_retry(lambda: client.models.embed_content(model=model, contents=contents, config=conf),
                                        cfg, f"embed_content(n={len(contents)})")
                if len(resp.embeddings) != len(batch):
                    raise RuntimeError(f"expected {len(batch)} embeddings, got {len(resp.embeddings)}")
                vecs = l2_normalize(np.asarray([e.values for e in resp.embeddings], dtype=np.float32))
                if vecs.shape[1] != dim:
                    raise RuntimeError(f"expected vectors of size {dim}, got {vecs.shape[1]}")
                rows = [(keys[i], v.tobytes()) for i, v in zip(batch, vecs)]
                con.executemany("INSERT OR REPLACE INTO emb (key, vec) VALUES (?, ?)", rows)
                con.commit()                                   # an interruption loses at most one batch
                cached.update(rows)
    finally:
        con.close()
    return np.stack([np.frombuffer(cached[k], dtype=np.float32) for k in keys]) if texts else np.zeros((0, dim), np.float32)
