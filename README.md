# AI Hub DataFinder

> **AI를 잘 몰라도, 하고 싶은 일만 적으면 맞는 AI Hub 데이터를 찾아 주는 학생용 서비스입니다.**
> 전공과 관심 분야, 하고 싶은 일을 바탕으로 [AI Hub](https://www.aihub.or.kr)의 공개 데이터 867종 중에서 알맞은 데이터를 추천하고,
> 데이터를 쉬운 말로 설명하며, ChatGPT·Claude·Gemini에 그대로 붙여 넣을 수 있는 프로젝트 계획 프롬프트를 만들어 줍니다.
> 첫 이용 대상은 고려대학교 세종캠퍼스 학생이며, 한국어와 영어를 지원합니다.

AI Hub DataFinder helps university students, especially those outside AI majors, find the right dataset on
**AI Hub** (aihub.or.kr, run by NIA) for what they want to do, without knowing AI terms first.
It is a non-commercial student research project and is **not affiliated with AI Hub or NIA**.

## What it does

| Page | What the student gets |
|---|---|
| **데이터 찾기 (home)** | One search box ("도로 사진으로 신호등 찾기"), optional university → major and interest fields, suggested keywords for the major, 8 field shortcuts with icons |
| **추천 결과** | Up to 12 datasets with AI Hub's own icon, relevance 0–10, a match label, plain reasons ("검색한 내용과 잘 맞습니다"), size and difficulty |
| **Dataset page** | Plain-language explanation, facts table, details, project ideas, similar datasets, link to the AI Hub page |
| **AI로 프로젝트 계획 세우기** | A ready prompt (student profile, how the dataset was found, dataset facts with the AI Hub link, an answer outline). One click copies it and opens ChatGPT, Claude or Gemini; the student pastes it (Ctrl+V). The app itself calls no chat model. |
| **분야별 둘러보기 (browse)** | 8 fields → 53 topics, most-downloaded first |
| **비교함 (compare)** | Up to 3 datasets side by side |
| **소개 (about)** | What AI Hub is (charts from our records), a data map (field → topic tree with a dataset list), and how relatedness is calculated (plain words first, then formulas and a calculator) |

The current recommendation is kept while the student moves between pages; a new search replaces it. Nothing about the
student is stored on the server: profile, language and the compare list stay in the browser.

## Quick start (local)

Needs Python 3.12+ and a Google Gemini API key (used only to turn new search text into vectors; about one small call per new search).

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-app.txt     # Windows; on macOS/Linux: .venv/bin/python
cp .env.example .env                                            # then put your key after GEMINI_API_KEY=
.venv/Scripts/python -m app.server                              # open http://127.0.0.1:8000
```

Start-up takes about 5–20 seconds (search index, Korean tokenizer, major profiles). The repository already contains
the ready-made data, so nothing is downloaded from AI Hub.

## Deploy

The app is one Python process (FastAPI + Uvicorn) that serves both the API and the static pages. It needs
**about 1 GB of memory** (measured ~920 MB after start-up); give it 2 GB to be comfortable.

### Docker (recommended)

```bash
docker build -t aihub-datafinder .
docker run -d --name datafinder -p 8000:8000 -e GEMINI_API_KEY=your-key --restart unless-stopped aihub-datafinder
```

The image listens on `0.0.0.0:8000`, runs as a normal user, and has a health check at `/healthz`
(returns `{"ok": true, "datasets": 867}` once the index is loaded).

### Platforms (Render, Railway, Fly.io, Cloud Run, a VM)

- Build from the `Dockerfile` in the repository root.
- Set the secret `GEMINI_API_KEY`. The platform's `PORT` variable is used automatically.
- Health check path: `/healthz`. Allow about 90 seconds for the first start.
- Behind the platform's proxy, set `FORWARDED_ALLOW_IPS` to the proxy's address (or `*` if the container is only
  reachable through that proxy) so the search limit sees each student's real address.

### Google Cloud Run (how the live site is deployed)

One-time setup: a Google Cloud project with billing, the `gcloud` CLI signed in (`gcloud auth login`), the services
`run`, `cloudbuild`, `artifactregistry` and `secretmanager` enabled, and the Gemini key stored as the secret
`gemini-api-key` (readable by the Cloud Run service account, role `roles/secretmanager.secretAccessor`).
Deploy or redeploy from the repository root (`.gcloudignore` keeps the upload small):

```bash
gcloud run deploy datafinder --source . --region asia-northeast3 --memory 2Gi --cpu 1 --cpu-boost --min-instances 0 --max-instances 2 --concurrency 20 --timeout 120 --port 8000 --allow-unauthenticated --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" --set-env-vars "FORWARDED_ALLOW_IPS=*"
```

With `--min-instances 0` nothing runs while nobody visits; the first visit after a quiet period waits for start-up
(about 10-20 s). Note: Cloud Run reserves URL paths that end in `z`, so `/healthz` answers with Google's own 404 there;
Cloud Run checks the app with its own start-up probe instead.

### Your own server with Nginx and HTTPS

Run the container (or `python -m app.server` with `HOST=127.0.0.1`) and put Nginx in front:

```nginx
server {
    server_name datafinder.example.ac.kr;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then add HTTPS (for example `certbot --nginx`). HTTPS matters: browsers only allow reliable copying to the clipboard on
secure pages, and the "AI로 프로젝트 계획 세우기" button copies the prompt.

### Environment variables

| Variable | Needed | Meaning |
|---|---|---|
| `GEMINI_API_KEY` | yes | Google Gemini key for search embeddings (`gemini-embedding-001`). Keep it secret; it never reaches the browser. |
| `HOST` | no | Address to listen on. Default `127.0.0.1`; the Docker image uses `0.0.0.0`. |
| `PORT` | no | Port. Default `8000`. |
| `FORWARDED_ALLOW_IPS` | no | Proxies trusted for `X-Forwarded-For`. Default `127.0.0.1`. |

Locally the key can also come from `.env` (see `.env.example`). Never commit `.env`.

### Limits and costs

- **Search limit:** 20 searches per address per minute (`config/app.yaml` → `limits.recommend_per_minute`); more get HTTP 429.
- **Embedding calls:** a new search text costs one Gemini embedding call; repeated texts come from a local cache
  (`data/index/embedding_cache.sqlite`, created on first use). Start-up makes one batched call for the major profiles.
- **Input limits:** search text up to 300 characters, up to 8 interest fields, 3 datasets in compare.
- **No chat model:** project planning happens in the student's own ChatGPT / Claude / Gemini account, so there is no LLM cost.

## Settings

| File | What it controls |
|---|---|
| `config/app.yaml` | server address, input limits, app name, footer notice, universities, the AI sites offered for project planning |
| `config/search.yaml` | embedding model, chunking, search weights, match-label thresholds |
| `config/ranking.yaml` | recommendation scoring: interest/major weights, 0–10 scale, diversity, suggested keywords |
| `config/domains.yaml` | 53 topics in 8 fields, with scope rules |
| `config/tasks.yaml` | AI tasks and data types in plain words |

## How it works

1. **Data (done once, offline):** 867 AI Hub dataset pages, file lists and manuals were collected politely, parsed and
   rewritten into one structured record per dataset (summary, labels, difficulty, project ideas, plain explanation).
   31 KU Sejong majors were turned into profiles linked to the 53 topics.
2. **Search:** each dataset has a *card* and *chunks* (≈1,200-character pieces of its page and manual). A query is matched
   by meaning (Gemini embeddings + FAISS) and by keywords (BM25 with the Kiwi Korean tokenizer); the four ranked lists are
   merged with reciprocal-rank fusion. On a held-out test set the right dataset comes first for 56 of 59 questions.
3. **Recommendation:** a 0–10 relevance score from the request/interest fields and the major (with typed text:
   interest 0.9, major 0.1; with fields only: 0.6 / 0.4), then a diversity step so near-duplicate datasets don't fill the list.
4. **Project prompt:** `app/prompt.py` builds the dataset part of the prompt for every dataset at start-up and adds the
   student part and the path (recommendation rank, relevance, match and reasons, or the browsed field and topic) on request.

Details, numbers and every decision: [docs/PLAN.md](docs/PLAN.md) and [docs/PHASE0_FINDINGS.md](docs/PHASE0_FINDINGS.md).
Where each file came from: [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Project layout

```
app/                 web service: server.py (API), prompt.py (project prompt), about.py (about pages), static/ (HTML, CSS, JS)
processing/          parsing, enrichment checks, topics, chunking, embedding, search, recommendation
collectors/          download scripts (only to update or rebuild the data)
config/              settings and controlled lists
data/                ready-made data the service needs (records, search index, major profiles, icon and field lists)
tests/               pytest: scoring rules, prompts for all datasets, API checks
eval/                question sets for testing search
tools/search_ui.py   local test page for search queries (not the student app)
docs/                plan, work log, data sources
Dockerfile           production image; requirements-app.txt = runtime packages, requirements.txt = everything
```

Only the data the running app needs is in git. Collected raw pages and manuals and the query cache stay out (`.gitignore`).

## Tests

```bash
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m pytest -q
```

`tests/test_api.py` starts the real app (needs the data in `data/index` and a Gemini key or the local cache) and checks
every endpoint, bad input, the search limit, and that the old chat endpoints are gone. The other tests run offline.

## Rebuilding the data (maintainers only)

Needs the full `requirements.txt`, the collected raw files (not in git) and an API key.

```bash
.venv/Scripts/python -m processing.enrich_datasets validate   # 867 records follow the schema
.venv/Scripts/python -m processing.enrich_datasets export     # after editing records or topic tags
.venv/Scripts/python -m processing.major_profiles export      # after editing major profiles or links
.venv/Scripts/python -m processing.chunk                      # after changing records or chunk settings
.venv/Scripts/python -m processing.build_index                # embeds only new or changed text (cached)
.venv/Scripts/python -m processing.major_keywords build       # suggested keywords per major
.venv/Scripts/python -m collectors.collect_aihub icons --all  # AI Hub icon address per dataset (resumes)
```

Command-line search and recommendation for checking results:

```bash
.venv/Scripts/python -m processing.search "사과 나무 병 사진" --top 10
.venv/Scripts/python -m processing.recommend --major smartcity --text "교통 혼잡"
```

## Data source and notice

- Dataset information and icons come from **AI Hub** (aihub.or.kr), results of projects by the National Information
  Society Agency (NIA, 한국지능정보사회진흥원). Every dataset links back to its AI Hub page, and data requests and
  downloads happen only on AI Hub, under AI Hub's own terms.
- This service does not host or redistribute the datasets themselves; it only describes them and points to AI Hub.
- It is a non-commercial student research project and is not affiliated with, endorsed by, or operated by AI Hub or NIA.
  AI Hub's terms of use cover showing AI Hub information to outside users; operators should keep in contact with AI Hub
  and follow any request from AI Hub or NIA.
- Students should not type personal information (name, student ID, contact details) into the search box or the prompts.
