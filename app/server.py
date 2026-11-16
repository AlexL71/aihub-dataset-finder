"""Student app (development version): FastAPI backend + plain HTML/CSS/JS pages in app/static/.

Run (project root):
    .venv/Scripts/python -m app.server            # then open http://127.0.0.1:8000, stop with Ctrl+C

Pages (one HTML file, switched in the browser): home (profile + search), results (data cards),
dataset detail, compare (up to 3). The backend only wraps the existing code:
    processing.recommend (search + scoring), processing.major_keywords (suggested words),
    processing.cards (facts table), data/parsed/aihub/icons.json (AI Hub icon address per dataset).
Every new free text is embedded once through the Gemini API (needs internet + GEMINI_API_KEY), then cached.
Settings: config/app.yaml. HOST / PORT environment variables override `server:` (the Docker image sets HOST=0.0.0.0).
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote_plus

import yaml
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import about
from app.prompt import PromptBuilder
from processing import cards
from processing.domains import MIN_DATASETS, load_domains
from processing.major_keywords import suggest
from processing.recommend import PURPOSES, MAJORS_FILE, Profile, Recommender

ROOT = Path(__file__).resolve().parents[1]
STATIC = Path(__file__).resolve().parent / "static"
APP_CFG = yaml.safe_load((ROOT / "config" / "app.yaml").read_text(encoding="utf-8"))
ICONS_FILE = ROOT / "data" / "parsed" / "aihub" / "icons.json"
TASKS_FILE = ROOT / "config" / "tasks.yaml"
PURPOSE_NAMES = {"class": ("수업 과제", "Class assignment"), "capstone": ("캡스톤 디자인", "Capstone project"),
                 "thesis": ("논문·학위 연구", "Thesis or research"), "competition": ("공모전·대회", "Competition"),
                 "self_study": ("개인 공부", "Self-study")}
LIMITS = APP_CFG["limits"]
log = logging.getLogger("app")


class State:
    """Everything loaded once at start-up (about 10-20 s: search index, Korean tokenizer, major profiles)."""

    def __init__(self) -> None:
        t0 = time.time()
        self.rec = Recommender()
        self.recs = self.rec.recs
        doms = load_domains()
        self.groups, self.domains = doms["groups"], doms["domains"]
        self.tasks = yaml.safe_load(TASKS_FILE.read_text(encoding="utf-8"))["tasks"]
        self.majors = json.loads(MAJORS_FILE.read_text(encoding="utf-8"))["majors"]
        self.n_per_domain = {d: sum(d in r["domains"] for r in self.recs.values()) for d in self.domains}
        self.n_main = {d: sum(r["domains"][0] == d for r in self.recs.values()) for d in self.domains}   # datasets whose main topic is d
        self.universities = APP_CFG.get("universities", [])
        self._icons: dict[str, str | None] = {}
        self._icons_mtime = 0.0
        log.warning("app data loaded in %.0f s (%d datasets)", time.time() - t0, len(self.recs))

    def icon(self, i: str) -> str | None:
        """Icon address from icons.json; the file is re-read when it changes (the collector may still be running)."""
        try:
            m = ICONS_FILE.stat().st_mtime
            if m != self._icons_mtime:
                self._icons = json.loads(ICONS_FILE.read_text(encoding="utf-8"))["icons"]
                self._icons_mtime = m
        except (OSError, ValueError, KeyError):
            pass                                    # missing or half-written file: keep the last good copy
        return self._icons.get(i)

    def card(self, i: str) -> dict:
        """Short dataset info used on result cards, related lists and compare."""
        r = self.recs[i]
        return {"id": i, "title_ko": r["title_ko"], "title_en": r["title_en"], "icon": self.icon(i),
                "easy_ko": r.get("easy_ko") or r["summary_ko"], "easy_en": r.get("easy_en") or r["summary_en"],
                "domains": [{"id": d, "ko": self.domains[d]["ko"], "en": self.domains[d]["en"]} for d in r["domains"]],
                "modalities": [cards.MODALITY.get(m, (m, m)) for m in r["modalities"]],
                "difficulty": r["difficulty"], "size": cards.size_text(r["total_gb"]), "url": r["source_url"]}


S: State | None = None
PROMPTS: PromptBuilder | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global S, PROMPTS
    S = State()
    PROMPTS = PromptBuilder(APP_CFG["prompt"], S)          # dataset part of the prompt for every dataset, built once
    yield


app = FastAPI(title="AI Hub DataFinder", lifespan=lifespan, docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.middleware("http")
async def revalidate_static(request: Request, call_next):
    """Pages and scripts: the browser must check for a newer version each time (unchanged files still come from
    its cache via ETag), so students never run an old app.js after an update.
    Videos and images may be cached for a day: a CDN in front (Firebase Hosting) can then keep them and answer
    partial (Range) requests, which Safari needs to play video."""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/static/") and path.endswith(MEDIA_SUFFIXES):
        response.headers["Cache-Control"] = "public, max-age=86400"
    elif path == "/" or path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


MEDIA_SUFFIXES = (".mp4", ".jpg", ".jpeg", ".png", ".webp", ".svg")


class RateLimit:
    """At most `n` requests per address per minute (in memory; one server process). Protects the embedding quota."""

    def __init__(self, n: int) -> None:
        self.n, self.hits, self.lock = n, defaultdict(deque), threading.Lock()

    def allow(self, ip: str) -> bool:
        now = time.monotonic()
        with self.lock:
            q = self.hits[ip]
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= self.n:
                return False
            q.append(now)
            if len(self.hits) > 10000:                 # forget idle addresses
                for k in [k for k, v in self.hits.items() if not v or now - v[-1] > 60]:
                    del self.hits[k]
            return True


RECOMMEND_LIMIT = RateLimit(int(LIMITS.get("recommend_per_minute", 20)))


@app.get("/healthz")
def healthz() -> dict:
    """For the host's health check: 200 once the index is loaded."""
    return {"ok": S is not None, "datasets": len(S.recs) if S else 0}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/api/meta")
def meta() -> dict:
    """Lists for the profile form and the page frame."""
    by_college: dict[str, list] = {}
    for m in sorted(S.majors, key=lambda m: m["name_ko"]):
        by_college.setdefault(m["college"], []).append({"id": m["id"], "ko": m["name_ko"], "en": m["name_en"]})
    return {"ui": APP_CFG["ui"], "limits": LIMITS, "ai_sites": APP_CFG["prompt"]["sites"], "n_datasets": len(S.recs), "universities": APP_CFG.get("universities", []),
            "colleges": [{"name": c, "majors": ms} for c, ms in by_college.items()],
            "purposes": [{"id": p, "ko": PURPOSE_NAMES[p][0], "en": PURPOSE_NAMES[p][1]} for p in PURPOSES],
            "groups": [{"id": g, "ko": v["ko"], "en": v["en"], "n": sum(S.n_main[d] for d, dv in S.domains.items() if dv["group"] == g)}
                       for g, v in S.groups.items()],
            "domains": [{"id": d, "ko": v["ko"], "en": v["en"], "group": v["group"], "n": S.n_per_domain[d], "n_main": S.n_main[d]}
                        for d, v in S.domains.items() if S.n_per_domain[d] >= MIN_DATASETS]}


@app.get("/api/major/{major_id}")
def major(major_id: str) -> dict:
    """Interest chips (the major's linked domains, core first) and suggested keywords in both languages."""
    links = S.rec.links.get(major_id)
    if links is None:
        raise HTTPException(404, "unknown major")
    chips = [{"id": x["domain"], "ko": S.domains[x["domain"]]["ko"], "en": S.domains[x["domain"]]["en"],
              "core": x["level"] == "core", "n": S.n_per_domain[x["domain"]]}
             for x in sorted(links, key=lambda x: x["level"] != "core") if S.n_per_domain[x["domain"]] >= MIN_DATASETS]
    n = LIMITS["keywords_shown"]
    return {"chips": chips, "keywords": {"ko": suggest(major_id, "ko", n), "en": suggest(major_id, "en", n)}}


class RecommendIn(BaseModel):
    major: str | None = None
    purpose: str | None = None
    interests: list[str] = Field(default_factory=list)
    text: str = ""
    lang: str = "ko"
    top: int | None = None


@app.post("/api/recommend")
def recommend(body: RecommendIn, request: Request) -> dict:
    if not RECOMMEND_LIMIT.allow(request.client.host if request.client else "?"):
        raise HTTPException(429, "too many searches; wait a minute")
    text = body.text.strip()
    if len(text) > LIMITS["max_text_chars"]:
        raise HTTPException(400, f"text longer than {LIMITS['max_text_chars']} characters")
    if len(body.interests) > LIMITS["max_interests"]:
        raise HTTPException(400, f"at most {LIMITS['max_interests']} interests")
    top = max(1, min(LIMITS["max_results"], body.top or LIMITS["default_results"]))
    p = Profile(body.major or None, body.purpose or None, list(dict.fromkeys(body.interests)), text,
                "en" if body.lang == "en" else "ko")
    t0 = time.time()
    try:
        items, no_match = S.rec.recommend(p, top)
    except ValueError as e:                     # unknown major / purpose / interest
        raise HTTPException(400, str(e)) from e
    except (Exception, SystemExit) as e:        # embedding API down, no key, no internet
        log.exception("recommend failed")
        raise HTTPException(503, "search is unavailable right now (embedding service); try again later") from e
    th = S.rec.index.cfg["match_label"]["korean" if cards.has_hangul(text) else "english"]
    out = []
    for x in items:
        c = S.card(x.dataset_id)
        match = None
        if text:
            match = "strong" if x.card_sim >= th["strong"] else "partial" if x.card_sim >= th["partial"] else "weak"
        c.update({"score": round(x.score, 1), "reasons": x.reasons, "notes": x.notes, "idea": x.idea, "match": match})
        out.append(c)
    sites = ([{"name": s["name"], "url": s["url"].replace("{q}", quote_plus(text))}
              for s in S.rec.index.cfg["other_sites"]] if text else [])
    return {"items": out, "no_match": no_match, "sites": sites, "ms": int((time.time() - t0) * 1000)}


@app.get("/api/dataset/{dataset_id}")
def dataset(dataset_id: str) -> dict:
    r = S.recs.get(dataset_id)
    if r is None:
        raise HTTPException(404, "unknown dataset")
    d = S.card(dataset_id)
    d.update({
        "detail_ko": r.get("detail_ko") or r["contents_ko"], "detail_en": r.get("detail_en") or r["contents_en"],
        "facts": cards.facts(r, r), "ideas": r["project_ideas"],
        "tasks": [{"ko": S.tasks[t]["ko"], "en": S.tasks[t]["en"]} for t in r["tasks"] if t in S.tasks],
        "tags": r.get("source_tags", []), "build_year": r["build_year"], "last_update": r["last_update"],
        "views": r["views"], "downloads": r["downloads"], "has_manual": bool(r["doc_used"]),
        "related": [S.card(j) for j in r.get("related_ids", []) if j in S.recs],
    })
    return d


@app.get("/api/about/stats")
def about_stats() -> dict:
    return about.stats(S)


@app.get("/api/about/graph")
def about_graph() -> dict:
    return about.graph(S)


@app.get("/api/about/method")
def about_method() -> dict:
    return about.method(S)


@app.get("/api/about/prep")
def about_prep() -> dict:
    return about.prep(S)


@app.get("/api/browse")
def browse(group: str | None = None, topic: str | None = None, offset: int = 0, limit: int = 24) -> dict:
    """Datasets of one field (group) or one topic, by main topic, most downloaded first (like AI Hub's field filter)."""
    if topic and topic not in S.domains:
        raise HTTPException(404, "unknown topic")
    if group and group not in S.groups:
        raise HTTPException(404, "unknown group")
    keep = (lambda r: r["domains"][0] == topic) if topic else (lambda r: S.domains[r["domains"][0]]["group"] == group) if group else (lambda r: True)
    rows = sorted((r for r in S.recs.values() if keep(r)), key=lambda r: -about._int(r["downloads"]))
    limit = max(1, min(48, limit))
    return {"total": len(rows), "offset": offset,
            "items": [{**S.card(r["dataset_id"]), "downloads": r["downloads"]} for r in rows[offset: offset + limit]]}


class PromptIn(BaseModel):
    dataset_id: str
    profile: dict = Field(default_factory=dict)     # univ, major, interests, text (the profile behind the results)
    via: dict = Field(default_factory=dict)         # how the dataset was found: kind, rank, total, score, match, reasons, field, topic
    lang: str = "ko"


@app.post("/api/prompt")
def make_prompt(body: PromptIn) -> dict:
    """Prompt text for an outside AI (ChatGPT, Claude, Gemini). Built here; no model call, no limit."""
    out = PROMPTS.build(body.dataset_id, body.profile, body.via, body.lang)
    if out is None:
        raise HTTPException(404, "unknown dataset")
    return out


@app.get("/api/cards")
def many(ids: str = Query(..., description="comma-separated dataset ids")) -> dict:
    """Several datasets at once, with facts (compare page)."""
    want = [i for i in dict.fromkeys(x.strip() for x in ids.split(",")) if i in S.recs][: LIMITS["max_compare"]]
    return {"items": [{**S.card(i), "facts": cards.facts(S.recs[i], S.recs[i])} for i in want]}


def main() -> None:
    import uvicorn
    logging.basicConfig(level=logging.WARNING)
    s = APP_CFG["server"]
    host, port = os.environ.get("HOST", s["host"]), int(os.environ.get("PORT", s["port"]))
    shown = "127.0.0.1" if host == "0.0.0.0" else host
    print(f"open http://{shown}:{port}  (first start loads the index; Ctrl+C to stop)", flush=True)
    # proxy_headers: behind a reverse proxy (Nginx, Render, Cloud Run) the student's address comes from X-Forwarded-For
    uvicorn.run(app, host=host, port=port, log_level="warning", proxy_headers=True,
                forwarded_allow_ips=os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1"))


if __name__ == "__main__":
    main()
