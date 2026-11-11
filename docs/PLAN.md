# AI Hub Dataset Finder — Project Plan

*Version 1 · 2026-10-27 · Status: draft for review*

> Items marked **[ASSUMPTION]** were chosen by default because they were not decided yet. Items marked **[VERIFY]** are facts that must be checked in Phase 0 before building on them.

---

## 1. Purpose

**Help students find the best AI Hub dataset for what they want to do — even when they don't know AI terms or where to start.**

AI Hub (aihub.or.kr, run by NIA) holds hundreds of large Korean AI training datasets. They are sorted into categories, but:

- The web interface is hard to browse when you don't already know what you are looking for.
- Datasets are huge (often hundreds of GB to TB), so students can't download several and compare them.
- The important details (classes, label format, statistics) are hidden inside long Korean PDF guides.
- Students from non-AI majors (pharmacy, public policy, food science, sports, etc.) have real domain questions but can't translate them into "dataset + AI task".

**Our system:**

1. Asks the student a few short questions (level, major, purpose, interests).
2. Recommends a short list of datasets that fit — with a plain-language reason, size/difficulty, and 2–3 project ideas.
3. Lets them search freely, ask detail questions, and compare datasets side by side, with every answer linked to the real AI Hub page.
4. When AI Hub has nothing that fits, says so honestly, shows the closest AI Hub datasets, and gives search words + links for other dataset sites (section 7.5).

**What it is — and is not (changed 2026-11-10):** a **context-aware dataset finder for AI Hub** with a **limited dataset assistant** (section 7.6), not a general chatbot. It uses the student's profile and request to find and recommend datasets. The 2026-11-01 decision allowed no multi-turn chat; on 2026-11-10 the user allowed short chat about a selected dataset. Still no small talk and no general AI tutoring.

**Pilot users:** Korea University Sejong Campus students, all majors, **with focus on non-AI majors** (AI/CS students are a comparison group). Korean first, English supported.

**Long-term:** hand over or sell to AI Hub, with an admin update pipeline so new datasets enter the system without our help.

### Success criteria

| Metric | Target |
|---|---|
| Retrieval quality on test queries: correct dataset in top 5 (Recall@5) | ≥ 0.85 |
| Pilot: students who found a dataset they would actually use | ≥ 70% |
| Pilot: time to find a suitable dataset vs. AI Hub's own site | at least 2× faster |
| Pilot: non-AI majors vs. AI majors success rate | gap ≤ 10 percentage points |
| Answer faithfulness (facts match the source) | ≥ 95% on a checked sample |
| Hallucinated datasets (recommending a dataset that doesn't exist) | 0 |

---

## 2. Scope

**In scope (v1)**
- All public AI Hub datasets: web page content + data explanation documents (데이터 설명서, 구축활용가이드).
- File tree / file sizes per dataset (for "download only this part" suggestions).
- Korea University Sejong Campus department descriptions and curricula.
- Student profile → interest questions → recommendations → search, detail Q&A, compare.
- Admin update pipeline.

**Out of scope (v1)**
- AI model PDFs (skipped, as decided).
- Downloading the actual datasets.
- Professor/course mode (later phase).
- University login, user accounts with personal data.
- Indexing other data portals (data.go.kr, Hugging Face, Kaggle …). We only **point** to them with search words and links when AI Hub has no match (section 7.5); their content is not collected.
- General chatbot features (small talk, general AI tutoring, questions unrelated to datasets). Limited chat about a selected dataset is in scope (section 7.6, changed 2026-11-10).

---

## 3. Key decisions (defaults chosen)

| Topic | Decision | Why |
|---|---|---|
| Project type | **[ASSUMPTION]** Research prototype → pilot study → handover package. Built so it can become a paper/thesis chapter. | Pilot with real students gives the evidence needed for both a paper and AI Hub. |
| Team / timeline | **[ASSUMPTION]** 1–2 people, ~16 weeks. | Adjust phases if different. |
| Data collection | **Python scripts**, not remote-controlling the laptop. | Scripts are repeatable, resumable, and the *same code becomes the update pipeline* for AI Hub. Controlling a browser by screenshots is slow, fragile and can't run on a schedule. Browser inspection is used only in Phase 0 to understand page structure. |
| Language model (LLM), offline enrichment | **Decided 2026-10-28:** done with Claude through the user's Claude plan (in Claude Code), **not the paid API**. Claude reads each dataset's page + 데이터 설명서 text and writes the structured record (summary, tags, difficulty, project ideas) to JSON files, in batches with resume. | No API cost; uses plan usage limits instead, so the work is split into batches across sessions. |
| Language model, online (live system) | **Decided 2026-11-10:** free-tier APIs, used only by the limited dataset assistant (section 7.6). Gemini first, Groq as backup. Search, recommendations and stored cards do not use an LLM. | Free tiers keep the cost at zero, and the rest of the system keeps working if the LLM is unavailable. |
| Where LLM work happens | **Mostly offline.** Summaries, tags, plain-language cards and project ideas are generated once per dataset and stored. Online, the LLM only parses the question and writes a short explanation. | Keeps the running system light and cheap; most answers are just database lookups. |
| Embedding model | **BGE-M3** (multilingual, handles Korean + English, long inputs; MIT license). **[VERIFY license at download time]** | One model for Korean documents and English queries. |
| Reranker | **bge-reranker-v2-m3** (Apache-2.0). **[VERIFY]** | Improves top-5 order; small enough for CPU on top ~50 candidates. |
| Keyword search | **BM25** (classic word-match scoring) with **Kiwi** Korean tokenizer. | Catches exact terms (e.g. "LiDAR", "COCO", dataset names) that vector search misses. |
| Database | **PostgreSQL + pgvector** (one database for records, chunks, vectors, logs). | ~1,000 datasets is small; one database is easiest to back up and hand over. FAISS stays an option for experiments. |
| Embeddings and index for now (2026-11-01) | **Gemini `gemini-embedding-001` (user's API key) + FAISS files** in `data/index/`, because the work moved to a laptop without a GPU. Swappable: only `processing/embed.py` calls the API; PostgreSQL comes with the app. | ~$1–2 for all text; minutes instead of hours on CPU. |
| Backend | **FastAPI** (Python). | Matches your Python stack. |
| Frontend | **Changed 2026-11-11:** plain HTML, CSS and JavaScript served by FastAPI (`app/`), no build step, Korean/English. React later only if the app grows or is handed over. | Node.js is not installed on the laptop, and a few pages do not need a framework. |
| Hosting | **Future work (2026-11-10):** development only for now. Later the server will be hosted online and offered inside Korea. The lab server is no longer available. | No vendor lock-in. Query-time runs on CPU; GPU only needed for offline embedding runs. |
| User data | **Anonymous profiles** (browser storage + optional anonymous ID). No names, student IDs, or emails. | Avoids most personal-information (PIPA) burden; enough for recommendations and statistics. |

---

## 4. Data collection plan

Three sources. All collected by scripts with the same "polite collection" rules (section 4.4).

### 4.1 AI Hub dataset pages and documents

**What we found (checked 2026-10-27):**
- `robots.txt` only has rules for Googlebot: it disallows `/list.do` and `/partcptnmlrd/inqry`. No rules for other bots. We will **still avoid `/list.do`** as a courtesy and get the dataset list another way.
- Dataset page URL: `/aihubdata/data/view.do?currMenu=115&topMenu=100&aihubDataSe=data&dataSetSn=<ID>`
- A page contains: title, tags, field/type, build year, last update, version history, overview, build purpose, use cases, statistics tables, performance metric (model + metric + value), annotation format and data structure, building organizations, related datasets, and access notices.
- Document links are plain URLs (no JavaScript):
  - Data manual (데이터 설명서): `/file/down.do?fileSn=<n>&dataMnlFileSn=<n>&dataSetSn=<ID>`
  - Build & usage guide (구축활용가이드): `/file/down.do?fileSn=<n>&cnstcPrcuseFileSn=<n>&dataSetSn=<ID>`
  - AI model (skipped): `...&aiModelFileSn=<n>...`
- Some datasets are **Korean nationals only**, some are **safe-zone viewing only** (안심존) or offline only. We must store this — English/international students need to know before choosing.
- Official CLI tool **aihubshell** can list datasets and show file trees (dataset key → file keys). Download needs an API key + per-dataset approval. Guide: https://www.aihub.or.kr/static/pdf/aihubshell_가이드.pdf

**[VERIFY in Phase 0]**
- Whether document downloads (`/file/down.do`) work without login.
- Whether aihubshell's list / file-tree mode works without an API key, and its output format (sizes per file?).
- Whether some documents are `.hwp`/`.hwpx` instead of PDF.
- AI Hub terms of use regarding automated collection (not found in a quick search — read the 이용약관 page directly).

**Collection steps (script `collect_aihub.py`):**

1. **Dataset list** — from aihubshell list mode (official) → `dataset_list.csv` (dataset key, title). Fallback: walk `dataSetSn` IDs found in "related datasets" links (graph crawl), never `/list.do`.
2. **Dataset pages** — fetch each `view.do` page once, save raw HTML to `data/raw/aihub/pages/<ID>.html` with fetch time and content hash.
3. **Parse page** → `data/parsed/aihub/<ID>.json` (fields in section 5.1). Parser is tested against 20 hand-checked pages.
4. **Documents** — from parsed links, download only data manual + build guide → `data/raw/aihub/docs/<ID>/`. Skip AI model files.
5. **File tree** — aihubshell file list per dataset → `data/raw/aihub/filetree/<ID>.txt` (for subset suggestions).
6. **Manifest** — `data/manifest.csv` records every item: URL, status, hash, size, time, error. The script **resumes** from the manifest and never re-downloads a finished item.

**If login is needed for documents:** you log in yourself in your browser; the script reads a session cookie you place in a local `.env` file (never committed, never shared). No passwords in scripts. If AI Hub's terms forbid this, we stop and use the NIA route (section 4.5).

**Size estimate [VERIFY with 20-dataset sample]:** ~1,000 pages + ~2,000 documents ≈ 3,000 requests. At one request every ~4 s → ~3.5 hours, split over 2 nights. Documents roughly 2–15 MB each → ~5–20 GB disk.

### 4.2 Korea University Sejong Campus majors

**Goal:** for each department — name (KO/EN), college, short description, curriculum course names, research areas. Used to build the major → domain table.

**Preliminary department list** (from a registrar PDF found by search; may be outdated — **[VERIFY]** on the official site):
- Science & Technology: Applied Mathematical Sciences (Data Computational Science), Semiconductor Physics, Advanced Materials Chemistry, Computer Software, Electronics & Information Engineering, Biotechnology & Bioinformatics, Food & Biotechnology, Electro-Mechanical Systems, Environmental Systems Engineering, Future Mobility, Intelligent Semiconductor Engineering
- Public policy / humanities / business majors: Public Sociology, Unification & Diplomacy, Economic Policy, National Statistics & Big Data, Korean / Chinese / English-American / German Studies, Global Business, Digital Business, Cultural Heritage, Media & Creative Writing, Cultural Contents
- Also: College of Pharmacy, sports-related majors **[VERIFY current structure]**

**Steps (script `collect_university.py`):**
1. Find the official department index page on `sejong.korea.ac.kr` (manually in Phase 0; the site's robots.txt returned an error, so check it in a browser).
2. Script fetches each department's intro + curriculum page (~30 departments × 2–3 pages ≈ 100 requests), saves raw HTML + parsed JSON to `data/parsed/university/<dept_id>.json`.
3. Many university sites differ per department. If a page doesn't parse, mark it in the manifest and fill it manually — 100 pages is small enough for manual fixes.

### 4.3 Major → domain table

1. LLM reads each department JSON and drafts a **major profile** with free interest topics and data keywords in everyday words (no fixed domain list), plus example project themes. *(Changed 2026-10-29: AI Hub's own 14 fields are **not** used; profiles stay independent of any grouping.)*
   - The major → domain links are made later, after our own dataset grouping (`domains.yaml`) exists.
2. **A student or staff member from each department reviews it** (pilot recruits can do this — 5 minutes each).
3. Saved as `config/majors_ku_sejong.yaml`. Another university = another YAML file.

### 4.4 Polite collection rules ("not getting blocked" the right way)

We avoid blocks by **being a light, honest visitor**, not by hiding. We will **not** rotate IPs/proxies, fake browser identities, bypass CAPTCHAs, or bypass login/approval systems — those break site rules and can get the account or the university network banned.

| Rule | Setting (configurable) |
|---|---|
| Respect `robots.txt`; skip disallowed paths for all bots | always |
| One connection at a time (no parallel requests) | `MAX_CONCURRENCY = 1` |
| Delay between requests, with random jitter | `DELAY_SEC = 3–5` |
| Run at night / off-peak (Korea time) | `RUN_WINDOW = 01:00–07:00 KST` |
| Honest User-Agent with project name + contact email | e.g. `AIHubDatasetFinder/0.1 (research; contact: <email>)` |
| Cache everything; never fetch the same URL twice | manifest + content hash |
| Use `If-Modified-Since` / ETag on update runs | when server supports it |
| Retries with exponential backoff on temporary errors (429, 5xx, timeout) | `MAX_RETRIES = 4`, base 10 s |
| **Hard stop** on 403, CAPTCHA page, or repeated 429 → save state and alert | always |
| Daily request cap | `MAX_REQUESTS_PER_RUN = 1500` |
| Small sample first (20 datasets), check results, then full run | Phase 0 |

### 4.5 Official route (dropped 2026-10-28)

**Decision:** no NIA email for now; selling is only a possibility, not a plan. Note: AI Hub terms (제15조 3항) still ask for approval before AI Hub information is shown to other people, which matters for the student pilot. The text below is kept for reference only.

Email NIA / AI Hub at the start: explain the project (student research, free pilot at KU Sejong), ask for (a) permission to collect public page content and documents, and (b) if possible a **metadata export** (dataset list + fields). An export would replace most of the scraping and is the natural path to "donate/sell to AI Hub" later.

---

## 5. Data model

### 5.1 Dataset record (one per dataset)

| Field | Example | Source |
|---|---|---|
| `dataset_id` (`dataSetSn`) | 71 | page URL |
| `title_ko`, `title_en` | 방송 영상 콘텐츠 / Broadcast video content | page / LLM translation |
| `field`, `tags` | 영상이미지, 방송 | page |
| `domains` | media, video understanding | LLM tagging (controlled list) |
| `modality` | video | page + LLM |
| `tasks` | video classification, object detection | page + LLM (controlled list) |
| `build_year`, `last_update`, `versions` | 2020, 2021-09, [1.0, 1.1] | page |
| `size_total_gb`, `n_samples`, `class_stats` | 750 h video, 1.5M objects | page stats + file tree + PDF |
| `annotation_format` | JSON, bbox | page + PDF |
| `baseline` | SlowFast-R50, accuracy 70.02% | page performance section |
| `access` | download / Korean nationals only / safe-zone only / offline | page notices |
| `smallest_subset_gb` | 3.2 | file tree |
| `difficulty` | easy / medium / hard | rule: size, task complexity, baseline exists, docs quality |
| `summary_plain_ko`, `summary_plain_en` | 2–3 sentences, no jargon | LLM (offline) |
| `project_ideas` | 3 ideas × level (beginner / capstone / research) | LLM (offline), spot-checked |
| `source_urls`, `doc_files`, `content_hash`, `fetched_at` | — | collector |

### 5.2 Controlled lists (config files)

- `domains.yaml` — ~40 everyday domains (animals, plants/forest, agriculture, food, medical/health, pharmacy, traffic/road, city/buildings, environment/waste, weather/air, law, public administration, finance, education, sports/motion, culture/heritage, media/broadcast, language/translation, speech, …). **Our own grouping**, built from the enriched dataset records + review — AI Hub's native fields are not used (decision 2026-10-29).
- `tasks.yaml` — technical task names mapped to plain-language phrases (e.g. "find and mark where things are in a picture" → object detection/segmentation).

### 5.3 Text chunks (for search and detail Q&A)

- Page sections and document sections, split by headings, ~500–800 tokens, with `dataset_id`, `section`, `page_no`, `source`.
- Tables (class statistics, label schema) kept as whole tables in text form, not split mid-table.
- PDF parsing: PyMuPDF for text, pdfplumber for tables, OCR only as fallback for scanned pages; `.hwp` converted first if found.

---

## 6. System architecture

```
OFFLINE (collect → process → enrich → index), incremental per dataset
  collectors ─► raw HTML/PDF ─► parsers ─► dataset records + chunks
                                          └─► LLM enrichment (summaries, tags, difficulty, project ideas)
                                          └─► embeddings (BGE-M3) + BM25 index
                                          └─► PostgreSQL + pgvector

ONLINE
  React app (KO/EN) ─► FastAPI
     ├─ /onboarding     profile + adaptive interest questions (from majors YAML + domain counts)
     ├─ /recommend      profile → scored dataset list + reasons
     ├─ /search         free text → query parsing (LLM, small) → hybrid search → rerank → dataset cards
     ├─ /dataset/{id}   card + limited assistant over that dataset's record and chunks (with citations, section 7.6)
     ├─ /compare        2–3 datasets side by side (from records, no LLM needed)
     ├─ /feedback       👍/👎, saved, clicked
     └─ /admin          update runs, review queue, logs (password-protected, AI Hub staff)
```

**Hybrid search** = vector search (meaning) + BM25 (exact words), merged, then the reranker orders the top ~50, then results are grouped by dataset.

**Light by design:** ~1,000 datasets × ~100 chunks ≈ 100k vectors × 1024 dims ≈ 400 MB → fits in RAM, CPU-only at query time. Embedding all chunks is done once on the RTX 4080 (estimated well under an hour **[VERIFY]**). Updates only re-embed changed datasets.

**No-LLM fallback:** if the LLM API is down or over budget, search + cards + compare still work (only explanations disappear).

---

## 7. Student flow and recommendation

### 7.1 Onboarding (under 1 minute, every question skippable)

1. Language: 한국어 / English
2. Level: 1st / 2nd / 3rd / 4th year / Master's / PhD
3. Major: picked from the KU Sejong list (or "Other")
4. Purpose: class assignment / capstone / thesis / competition / self-study
5. Experience: none / basic Python / some ML / deep learning
6. Computer: laptop / Google Colab / lab GPU
7. **Interests (adaptive):** 6–8 chips from the domains linked to their major *that have datasets on AI Hub* (core domains first, then related; `data/profiles/major_domains.json`), + "Other: type it". Then one follow-up: "What do you want the computer to do?" in plain words (section 5.2).
8. **"Describe what you want" (optional free text, decided 2026-11-01):** one text box, Korean or English, e.g. "I want to work with text", "something with images", "I like dogs", "detect diseases in plants". Used two ways:
   - as a **search query** (hybrid search over records and chunks), combined with the profile;
   - to **fill in the profile**: words that match the controlled lists set the domain (dogs → `pets_vet`), modality (images → `image`) or task (detect → `object_detection`). This works without an LLM by matching against the Korean/English names and keywords in `domains.yaml` and `tasks.yaml`.
   If the box is empty, recommendations use only the answers above.

### 7.2 Scoring

> **Changed 2026-11-02 (user decision):** the score measures only relevance to the student — interest (text and/or chips) and major — on a 0–10 scale for later comparison with survey ratings. Level and size are no longer scored (most AI Hub data is large, and difficulty depends on the method the student chooses, not on the data); they are shown as facts. Implemented in `processing/recommend.py` + `config/ranking.yaml`. The original plan below is kept for reference.

```
score = w1·interest_match + w2·major_relevance + w3·level_fit + w4·practicality
practicality = size vs. compute, access allowed (e.g. non-Korean nationals), docs quality
```
- Start with hand-set weights in `config/ranking.yaml`; tune with pilot feedback.
- **Diversity:** MMR (maximal marginal relevance — lowers the score of results too similar to ones already picked) so the list isn't 5 near-identical datasets.
- **Level rules (defaults):** years 1–2 → small, classification, has baseline; years 3–4 → project-size, detection/segmentation OK; Master's → baseline metrics to beat; PhD → large / multimodal / less-used.
- **Access filter (removed 2026-11-10, user decision):** no access warning is shown. Students see the download rules on the AI Hub page each card links to.

### 7.3 Dataset card

Dataset icon · plain summary · what you could build (3 project ideas) · size + smallest subset · difficulty badge · baseline model + score · **"why recommended"** line · link to AI Hub · compare button. Technical terms have hover explanations.

**Look (decided 2026-11-10):** similar to AI Hub, so students feel at home.
- Style read from AI Hub's pages: Noto Sans KR, blue `#378AFF`, coral action button `#F86550`, pale page background `#F4F8FA`, text `#333333`, white cards with large rounded corners and a soft shadow, `#태그` chips.
- Each card uses AI Hub's own icon for that dataset, on a white rounded tile. Icons are at `https://www.aihub.or.kr/web-nas/aihub21/files/public/DATA_SET<number>`, one per dataset, found on its page. Not collected yet. The app stores the address and loads the icon from AI Hub; if it fails, a plain icon for the data type is shown.
- Logo (user request 2026-11-11): our own search mark with "AI Hub" in small text above "DataFinder" (the app name).  AI Hub's real logo image and NIA or ministry logos are not used, and every page says the app is an independent student project, so nobody mistakes it for the official site.

**One-question box (decided 2026-11-01; replaced 2026-11-10 by the limited dataset assistant in section 7.6; original text kept for reference):** each card has a single question box, e.g. "Does it have night images?" or "What label format is used?". The answer comes only from that dataset's own page and 데이터 설명서 chunks, with the source shown. It is one question → one answer: no chat history, no follow-up turns. If nothing relevant is found, it answers "Not stated in the documents" + AI Hub link (section 7.4).

### 7.4 Guardrails against wrong answers

- Recommendations come only from the database (the LLM can't invent a dataset ID).
- Detail answers must cite chunk sources; if nothing relevant is found → "Not stated in the documents" + link.
- Facts on cards (size, access, year) come from parsed fields, not LLM text.

### 7.5 When AI Hub has no matching data (decided 2026-11-01)

If no AI Hub dataset fits the request well enough (best match score below a threshold in `config/ranking.yaml`, or the requested subject/data type does not exist in our records), the system:

1. Says it plainly: "AI Hub에는 정확히 맞는 데이터가 없습니다 / AI Hub has no dataset that matches exactly."
2. Shows the **closest AI Hub datasets** as "related" (same domain, or same data type/task), each with a one-line note on how it differs from the request.
3. Gives **search words** (English + Korean) built from the request, e.g. "dog breed classification dataset", "dog pose keypoints", "강아지 이미지 데이터셋".
4. Gives **ready search links** for other dataset sites, for example Kaggle Datasets, Hugging Face Datasets, Roboflow Universe (images with boxes/masks), GitHub, Google Dataset Search and 공공데이터포털 (data.go.kr). The site list lives in a config file so it can be changed without code.

Guardrails: the system never claims a dataset exists on another site. It only gives search words and search links, because we do not collect or check those sites. The no-match threshold is tuned on test queries where we know AI Hub has no answer (add ~20 such queries to the evaluation set, section 9).

### 7.6 Limited dataset assistant (decided 2026-11-10, first version built 2026-11-11)

> **Replaced 2026-11-11 (user request):** the in-app chat below was removed. The plan button now builds a prompt on the server (`app/prompt.py`, `POST /api/prompt`; dataset part prebuilt for all datasets at start-up) with the student profile, how the dataset was found (recommendation rank, relevance, match and reasons, or the browse/map field), the dataset facts with the AI Hub link and an answer outline; a click copies it and opens ChatGPT, Claude or Gemini in a new tab. No model call, no API cost, no limits needed. Earlier note kept for reference:
>
> **Built 2026-11-11 (user request), development version:** a project chat, not a general chat. "프로젝트 자세히 알아보기" on result cards and dataset pages opens it; Gemini (the user's key, `gemini-3.8-flash`, backup `gemini-3.5-flash-lite`) gets the student's profile and that dataset's record and writes a project plan, then answers at most 3 follow-up questions. Off-topic questions and attempts to change the rules get a warning and no answer (and still use a turn). Limits on the server (`config/app.yaml`, `chat:`): 300-character questions, 15 chats per address and 200 in total per day, chats kept in memory for 2 hours. The plan and Q&A can be downloaded as a short .md file (data link, facts, plan, Q&A, how to continue with another AI). The page tells students not to type personal information because the text goes to Google. Differences from the design below: no similarity pre-check (Gemini judges the topic, plus a phrase filter for rule-change attempts); per-browser and per-session counts are replaced by per-address and per-chat counts. Still to check before any public use: Gemini's terms for an app used by other people, and whether a paid key is needed.

A short chat attached to one selected dataset. It is built last, after the rest of the system, and is optional: search, recommendations and cards work without it. The user may buy paid Gemini usage for it instead of relying on free tiers (2026-11-10), so the provider choice below is decided again at that point.

**Allowed:** explaining the selected dataset more clearly, answering questions about it, and suggesting project ideas that use it or other datasets from the student's current results. Everything else is refused with a short message and the AI Hub link.

**Answers come from our data:**
- The model receives only that dataset's record and its best matching page and manual chunks.
- Answers cite their source. If nothing relevant is found, the answer is "Not stated in the documents" + AI Hub link.
- Code checks every dataset named in an answer against our database. The model cannot add a dataset.
- Facts on cards (size, access, year) still come from parsed fields.

**Checks in code, before any LLM call** (the system prompt is a second layer only, because a prompt alone can be bypassed):
1. A dataset must be selected.
2. The question must fit the length limit.
3. The question must be similar enough to the dataset's text (same embeddings as search). If not, it is refused without an LLM call. General questions such as "what can I build with this?" score low on similarity, so the common actions are buttons that skip this check: "Explain simply", "Suggest project ideas".
4. The usage limits below must not be exceeded.

**Starting limits (to be tuned; kept in `config/chat.yaml`):**

| Limit | Start value |
|---|---|
| Question length | 500 characters |
| Answer length | about 400 tokens |
| Questions per dataset per session | 5 |
| Questions per browser per day | 20 |
| Questions per IP address per day | 50 (a browser ID can be reset, so this is a second limit) |
| Questions for the whole system per day | below the provider's free quota |

The chat history resets when the student changes dataset. Repeated identical questions come from a cache.

**Providers:** one small module (`processing/chat.py`), with the provider list in config. Gemini first (key and package already in the project), Groq as backup (`GROQ_API_KEY`). When all providers fail or the daily cap is reached, the assistant is switched off with a clear message. Keys stay on the server and never reach the browser. Free-tier limits change often, so they are checked again before launch. K-EXAONE is not a provider for students: its terms (2026-11-09, 제2.1 and 제2.5) bar letting third parties use the model through our service, so it stays for the developer's local testing unless LG gives written permission. Each provider's terms for public use are read before it is added.

**Privacy:** Google may use free-tier prompts to improve its products. The page tells students not to enter personal information, and chat logs store no names or student IDs. AI Hub text is also sent to the provider, so this is included in the AI Hub approval (section 4.5 note).

**How to validate before students use it:** a question set in Korean and English with on-topic questions, off-topic questions and attempts to override the rules. Measure the share of on-topic questions answered, off-topic questions answered (target 0), and answer faithfulness (section 9 C).

---

## 8. Update pipeline (for AI Hub handover)

1. **Scheduled check** (weekly): aihubshell list → compare with known datasets → new IDs + changed pages (content hash / last-update date).
2. **Manual trigger** in admin page: "add / refresh dataset ID X".
3. Changed datasets go through collect → parse → enrich → embed **into a staging area**.
4. **Review queue:** admin sees new card + diff, approves → published. (Auto-publish can be turned on later.)
5. Every run logs: what changed, errors, cost (LLM tokens), duration.

---

## 9. Evaluation

**A. Retrieval test set** — 150–200 real queries (collected from pilot students + written from AI Hub categories), each labelled with the correct dataset IDs. Measure Recall@5, MRR (how high the first correct answer ranks). Compare: BM25 only / vector only / hybrid / hybrid + rerank.

**B. Recommendation quality** — for 30 sample profiles, 2 reviewers rate top-5 relevance (1–5).

**C. Faithfulness** — 100 random detail answers checked against sources.

**D. Pilot user study** (20–40 students, mostly non-AI majors + some AI/CS):
- Task: "Find a dataset you would use for a project in your field."
- Condition 1: AI Hub website. Condition 2: our system (order swapped for half the users).
- Measure: success, time, confidence, SUS usability score, short interview.
- Also compare **with profile vs. without profile** to prove personalization helps.
- Consent form; anonymous data only.

---

## 10. Phases and timeline (~16 weeks, [ASSUMPTION])

| Phase | Weeks | Work | Done when |
|---|---|---|---|
| **0. Feasibility** | 1–2 | Read AI Hub terms; email NIA; manually inspect 20 datasets (pages, docs, hwp?, login needs); test aihubshell list mode; find KU Sejong department pages; cost estimate for LLM enrichment on 20 datasets | Go/no-go decision; field list confirmed; collection allowed |
| **1. Collection** | 3–4 | `collect_aihub.py`, `collect_university.py` with polite rules; run on 20 → check → full run at night | All pages/docs/file trees in `data/raw`, manifest clean |
| **2. Processing + index** | 5–7 | Parsers, records, chunks, enrichment (summaries, tags, ideas), embeddings, BM25, Postgres; Streamlit demo of search | Recall@5 measured on first 50 test queries |
| **3. Recommendation + app** | 8–11 | Onboarding, major table (reviewed), scoring, cards, compare, detail Q&A, React app, Docker deploy on lab server | Internal testers complete the full flow |
| **4. Pilot study** | 12–14 | Recruit students, run study, collect feedback, tune weights | Evaluation results (section 9) |
| **5. Handover** | 15–16 | Admin pipeline, docs (install, admin guide, architecture), report/paper draft, NIA presentation | Package ready for AI Hub |

---

## 11. Repository layout (planned)

```
aihub-dataset-finder/
  PLAN.md
  config/        settings.yaml, domains.yaml, tasks.yaml, majors_ku_sejong.yaml, ranking.yaml
  collectors/    collect_aihub.py, collect_university.py, polite_http.py (shared rate limit/cache/retry)
  processing/    parse_page.py, parse_docs.py, enrich_llm.py, chunk.py, embed.py, build_index.py
  app/           backend (FastAPI), frontend (React), admin
  eval/          test_queries.csv, run_retrieval_eval.py, study_materials/
  data/          raw/, parsed/, manifest.csv   (not in git; large)
  notebooks/     exploration and evaluation notebooks
  .env.example   API keys / optional session cookie placeholders (real .env never committed)
```

---

## 12. Costs (rough, verify in Phase 0)

| Item | Estimate |
|---|---|
| LLM offline enrichment (~1,000 datasets) | One-time; measure tokens on 20 datasets and multiply before the full run |
| LLM online (query parsing + short explanations) | Small per query; set a monthly budget cap in config |
| Embeddings / reranker | Free (open models), local GPU once, CPU at runtime |
| Server | Existing lab server; ~4–8 CPU cores, 16 GB RAM, 50 GB disk is enough |

---

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| AI Hub terms forbid automated collection / reuse | Blocks project or the "sell" path | Read terms in Phase 0; NIA contact in parallel; only public metadata; no dataset redistribution |
| Documents need login or approval | Fewer details per dataset | Page content alone is still useful (MVP); cookie from your own login if allowed; NIA export |
| Site layout changes | Parser breaks | Raw HTML saved; parser tests on 20 fixed pages; update run reports parse failures |
| Korean PDF tables parse badly | Wrong statistics | Table-aware parsing; key numbers taken from page fields first; manual check on sample |
| LLM writes wrong facts | Lost trust | Facts from fields, citations required, "not stated" fallback, faithfulness checks |
| Non-AI students still confused | Low pilot success | Plain-language layer, project ideas, user testing early (week 8) |
| Korean-nationals-only datasets for international students | Frustration | Students see the rules on the linked AI Hub page (warning on cards dropped 2026-11-10) |
| Personal data concerns | Ethics / legal | Anonymous profiles, consent text, aggregated stats only |
| LLM model license / data policy for government handover | Blocks AI Hub deployment | Provider interface; local open model (Apache/MIT-licensed) as drop-in option |

---

## 13b. Agreed order of work (2026-10-28)

1. Collect KU Sejong major details (intro, goals, curriculum, careers, research) → major profiles
2. Full AI Hub collection: 867 pages + file trees (script), 데이터 설명서 (through the user's logged-in Chrome; scripts are refused)
3. Parse all documents (`processing/parse_docs.py`) and enrich every dataset with Claude (user's plan) into structured records
4. Recommendation system (onboarding, scoring, cards)

## 14. Still open (please confirm or correct)

1. Team size, deadline, and whether this is a thesis/paper project.
2. Whether sending student questions and AI Hub text to an API outside Korea is acceptable for the pilot. (Free-tier APIs chosen 2026-11-10, so no monthly budget is needed for now.)
3. Which lab server will host the pilot (CPU/RAM/GPU, public access from campus?).
4. Who contacts NIA (you, your professor, or both) — a professor's name on the email will help.
5. Contact email to put in the collector's User-Agent.

---

## Sources checked for this plan (2026-10-27)

- AI Hub robots.txt — https://www.aihub.or.kr/robots.txt
- Sample dataset page (dataSetSn=71) — https://www.aihub.or.kr/aihubdata/data/view.do?currMenu=115&topMenu=100&aihubDataSe=data&dataSetSn=71
- aihubshell guide — https://www.aihub.or.kr/static/pdf/aihubshell_가이드.pdf
- KU Sejong majors (preliminary, possibly outdated) — https://registrar.korea.edu/_res/eduinfo/etc/info_caution_sejong_field.pdf
