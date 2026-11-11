"""API checks against the real data (FastAPI TestClient; no browser).

Needs the search index in data/index and GEMINI_API_KEY (or the local embedding cache) because start-up embeds the
major profiles; skipped otherwise. Only chip/major searches are sent, so no new search text reaches the API.
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
HAVE_INDEX = (ROOT / "data" / "index" / "cards.faiss").exists()
HAVE_KEY = bool(os.environ.get("GEMINI_API_KEY")) or (ROOT / ".env").exists() or (ROOT / "data" / "index" / "embedding_cache.sqlite").exists()
pytestmark = pytest.mark.skipif(not (HAVE_INDEX and HAVE_KEY), reason="needs data/index and a Gemini key or cache")


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient
    from app.server import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def meta(client):
    return client.get("/api/meta").json()


def test_health_and_pages(client):
    assert client.get("/healthz").json()["ok"] is True
    r = client.get("/")
    assert r.status_code == 200 and "AI Hub DataFinder" in r.text and r.headers["cache-control"] == "no-cache"
    for f in ("app.js", "about.js", "chat.js", "style.css"):
        assert client.get(f"/static/{f}").status_code == 200, f


def test_meta_lists(meta):
    assert meta["n_datasets"] > 800
    assert len(meta["groups"]) == 8 and all(g["n"] > 0 for g in meta["groups"])
    assert {s["id"] for s in meta["ai_sites"]} == {"chatgpt", "claude", "gemini"}
    assert any(u["ready"] for u in meta["universities"]) and meta["colleges"]


def test_recommend_with_major_and_chips(client, meta):
    major = meta["colleges"][0]["majors"][0]["id"]
    chips = [meta["domains"][0]["id"]]
    for lang in ("ko", "en"):
        d = client.post("/api/recommend", json={"major": major, "interests": chips, "lang": lang}).json()
        assert 1 <= len(d["items"]) <= 30
        x = d["items"][0]
        assert 0 <= x["score"] <= 10 and x["url"].startswith("https://www.aihub.or.kr/")
        assert all(isinstance(r, str) and r for r in x["reasons"])
        if lang == "ko":
            assert not any("찾으시는" in r or "고르신" in r for it in d["items"] for r in it["reasons"])


def test_bad_requests_are_refused(client, meta):
    assert client.post("/api/recommend", json={"text": "가" * 301}).status_code == 400
    assert client.post("/api/recommend", json={"interests": [d["id"] for d in meta["domains"][:9]]}).status_code == 400
    assert client.post("/api/recommend", json={"major": "no-such-major"}).status_code == 400
    assert client.get("/api/dataset/no-such-id").status_code == 404
    assert client.post("/api/prompt", json={"dataset_id": "no-such-id"}).status_code == 404
    assert client.get("/api/browse", params={"group": "no-such-group"}).status_code == 404
    assert client.post("/api/chat/start", json={}).status_code in (404, 405)       # the old in-app chat is gone


def test_dataset_browse_compare_about(client, meta):
    b = client.get("/api/browse", params={"group": meta["groups"][0]["id"], "limit": 5}).json()
    assert b["total"] > 0 and len(b["items"]) == 5
    ids = [x["id"] for x in b["items"]]
    assert client.get(f"/api/dataset/{ids[0]}").status_code == 200
    assert len(client.get("/api/cards", params={"ids": ",".join(ids)}).json()["items"]) == meta["limits"]["max_compare"]
    for part in ("stats", "graph", "method"):
        assert client.get(f"/api/about/{part}").status_code == 200, part


def test_prompt_for_browse_and_recommend(client, meta):
    i = client.get("/api/browse", params={"group": meta["groups"][1]["id"], "limit": 1}).json()["items"][0]["id"]
    p = client.post("/api/prompt", json={"dataset_id": i, "via": {"kind": "browse", "field": meta["groups"][1]["id"]}, "lang": "ko"}).json()
    assert "분야별 둘러보기" in p["prompt"] and p["url"] in p["prompt"]
    p = client.post("/api/prompt", json={"dataset_id": i, "lang": "en",
                                         "via": {"kind": "recommend", "rank": 1, "total": 5, "reasons": ["Matches what you searched for"]}}).json()
    assert "It matches what I searched for." in p["prompt"] and "1 of 5" in p["prompt"]


def test_search_limit_per_address(client, meta):
    from app import server
    old = server.RECOMMEND_LIMIT
    server.RECOMMEND_LIMIT = server.RateLimit(2)
    try:
        body = {"interests": [meta["domains"][0]["id"]]}
        codes = [client.post("/api/recommend", json=body).status_code for _ in range(3)]
        assert codes == [200, 200, 429]
    finally:
        server.RECOMMEND_LIMIT = old
