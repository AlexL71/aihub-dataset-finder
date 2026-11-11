# Data sources and collection record

*Written 2026-10-31, when the working folder was cleaned. Details and decisions: [PHASE0_FINDINGS.md](PHASE0_FINDINGS.md), plan: [PLAN.md](PLAN.md).*

This file records **where every kept file came from and how it was made**, because the raw downloads were deleted to save space (~1.9 GB). Every step can be re-run with the scripts listed.

---

## 1. What is kept (the data we use)

| Path | What | Made by |
|---|---|---|
| `data/enriched/aihub_datasets.json` | **Main product**: 867 dataset records (KO/EN) with scripted facts merged | `python -m processing.enrich_datasets export` |
| `data/enriched/aihub/<id>.json` | 867 Claude-written records (source for the export) | Claude, via the user's Claude plan |
| `data/profiles/majors_ku_sejong.json`, `data/profiles/majors/<id>.json` | 31 KU Sejong major profiles | Claude, from university pages |
| `data/parsed/aihub/pages/<id>.json` | 867 parsed AI Hub dataset pages (header facts + sections, contacts removed) | `processing/parse_aihub.py` |
| `data/parsed/aihub/docs/<id>.json` + `.md` | 856 parsed 데이터 설명서 (manual) texts — source for later search/Q&A | `processing/parse_docs.py` |
| ~~`data/parsed/aihub/docs_quality.csv`~~ | deleted 2026-11-01 (one-time quality report); `processing/doc_quality.py` rebuilds it only if the raw manuals are downloaded again | — |
| `data/parsed/aihub/dataset_list.csv` | 867 dataset IDs + titles | `processing/parse_aihub.py` |
| `data/raw/aihub/filetree/<id>.txt` | 867 file trees (paths, sizes, file keys); `export` reads sizes from here | `collectors/collect_aihub.py` |
| `data/parsed/university/<dept>.json` | parsed pages of 31 majors (+ `media_index.json`) | `collectors/collect_university.py` |
| `data/index/` | search index: cards, chunks, FAISS vectors, BM25 tokens, embedding cache (rebuildable; the cache avoids paying twice) | `processing.chunk` + `processing.build_index` (Gemini embeddings, 2026-11-01) |
| `data/manifest.csv` | log of every download: time, URL, HTTP status, bytes, SHA-256, saved path | all collectors |
| `data/enriched/domain_tags.json` | 1–3 domains per dataset (first = main subject) | Claude, from the records; checked by `python -m processing.domains check` |
| `data/profiles/major_domains.json` | 31 majors → core / related domains, with reasons | Claude, from the major profiles |
| `config/` | `departments_ku_sejong.yaml` (31 majors), `settings.yaml` (polite-collection settings), `tasks.yaml` (27 tasks, 7 modalities), `domains.yaml` (53 domains in 8 groups, 2026-10-31) | hand-written / Claude |

---

## 2. AI Hub (https://www.aihub.or.kr)

Collected 2026-10-27 – 2026-10-28, no blocks, no errors.

| Data | Source | How |
|---|---|---|
| Dataset list (867 IDs, 50 … 71982) | `https://api.aihub.or.kr/info/dataset.do` (the endpoint the official `aihubshell` tool uses; no API key). Server answers HTTP 502 but sends the full list. | `python -m collectors.collect_aihub` |
| Dataset pages (867/867) | `https://www.aihub.or.kr/aihubdata/data/view.do?currMenu=115&topMenu=100&aihubDataSe=data&dataSetSn=<ID>` | same collector; ~850 requests, one at a time, 3–5 s apart; raw HTML parsed by `processing/parse_aihub.py` |
| File trees (867/867) | `https://api.aihub.or.kr/info/<ID>.do` (no key, same 502 quirk) | same collector |
| 데이터 설명서 / manuals (861/867) | `/file/down.do?fileSn=…&dataMnlFileSn=…&dataSetSn=<ID>` links on each page | A standalone script is refused (`정상적인 접근이 아닙니다`), and we did not try to get around it. Files were fetched **inside the user's logged-in Chrome tab** (one at a time, 3.5–5 s apart), saved by Chrome, then moved with `python -m collectors.doc_queue import`. Formats: HWP 528, PDF 312, ZIP 12, HWPX 9. |

**Polite collection rules** (in `config/settings.yaml`): one connection, 3–5 s delay with jitter, honest User-Agent, resume from manifest, backoff on 429/5xx, hard stop on 403/CAPTCHA. `/list.do` was never used. No proxies, no fake identities, no CAPTCHA bypass. The login cookie lives only in local `.env`.

**Datasets without a usable manual (records built from the page only, `doc_used: false`):**
- No manual link on the page: 99, 106, 113, 134, 150, 71264.
- Manual discarded 2026-10-31 (could not be read reliably): 71407, 71510 (HWP; pyhwp failed), 187, 188, 71617 (scanned PDF images).

**Parsing notes:** HWP via pyhwp (`hwp5html`, fallback `hwp5txt`), PDF via PyMuPDF, HWPX via zip+XML, Excel inside ZIPs capped at 60 rows per sheet. Emails, phone numbers and contact-table lines are removed from all parsed text. Organization names are kept, people's names are not.

**Terms of use (important for any public use):** AI Hub 이용약관 제15조 3항 asks for prior approval before information from the service is copied, translated or provided to others; 제15조 2항 / 제16조 2항 forbid profit use without approval. Current use is internal research. Showing records to outside users needs NIA/AI Hub's OK. Credit: "한국지능정보사회진흥원의 사업결과".

---

## 3. Korea University Sejong Campus

Collected 2026-10-28 – 2026-10-29.

| Data | Source | How |
|---|---|---|
| Department list (31 majors, 6 colleges) | https://sejong.korea.ac.kr/koreaSejong/7842/subview.do | read by hand → `config/departments_ku_sejong.yaml` |
| Department pages (intro, goals, curriculum, careers, research; up to 10 per major) | each department's own site under `sejong.korea.ac.kr`, menu links found by label | `python -m collectors.collect_university` — 252 requests, ~4 s apart |
| Curriculum attachments (22 PDFs, 25 images) | links found on those pages | `python -m collectors.collect_university_media` — 47 requests. Images were read by Claude only where the page had no text. |

`robots.txt` of the site returns 400, so no published rules; the same slow rate was used.
Profiles: Claude wrote one profile per major from these pages. Fields Claude inferred (data interests, project themes, some careers) are listed in each profile's `inferred_fields`; weak spots in `gaps`. No student review (user decision 2026-10-29).

---

## 4. Enrichment (Claude-written fields)

- Input per dataset: a "pack" = parsed page sections + file-tree summary + manual text (page ≤ 7,000 chars, manual ≤ 7,000 chars), built by `enrich_datasets pack`.
- Claude (Claude Code on the user's plan, **not** the API) wrote each record; `validate` checks the schema and the controlled lists in `config/tasks.yaml`.
- Runs: 2026-10-29 – 2026-10-31 (first 246 in one session, then parallel worker sessions in chunks of 40, paused at ~90% of the 5-hour usage limit and resumed after reset).
- Second pass 2026-10-31: class lists re-checked from full page + manual (`enrich_datasets hints`), label/modality audit fixes, 5 bad manuals replaced by page-only records.
- Domains 2026-10-31: Claude tagged every record with 1–3 of our own domains and linked each major to domains (see PHASE0_FINDINGS §17); `export` merges them as `domains`.
- Scripted facts (title, years, organization, views, downloads, sizes, file counts, related IDs, URL) are **not** typed by Claude; `export` merges them from the parsed pages and file trees.

---

## 5. What was deleted on 2026-10-31 and how to get it back

| Deleted | Size | To rebuild |
|---|---|---|
| `data/raw/aihub/pages/*.html` | 214 MB | `python -m collectors.collect_aihub` (pages) |
| `data/raw/aihub/docs/<ID>/data_manual.*` | 1.6 GB | needs a logged-in browser again (see §2); then `python -m collectors.doc_queue import` |
| `data/raw/aihub/dataset_list.txt` | small | `collect_aihub` (list); IDs also in `dataset_list.csv` |
| `data/raw/university/` (HTML, PDFs, images) | 56 MB | `collect_university`, `collect_university_media` |
| `data/enriched/packs/`, `data/profiles/packs/` | 17 MB | `enrich_datasets pack`, `major_profiles pack` (need the raw/parsed inputs) |
| `data/enriched/chunks/` (parallel-run id lists and worker briefs) | small | not needed |
| `data/parsed/aihub/docs_hwp5txt/`, `docs_discarded/` | 1 MB | test output / discarded manuals |
| logs and queues: `collect_*.log`, `parse_docs.log`, `doc_queue*.json`, `doc_chunks.txt`, `doc_rest.json`, `doc_no_link.txt`, `doc_import_log.csv`, `sample_ids.txt` | <1 MB | facts kept in this file and `manifest.csv` |
| `cookie.txt` | — | duplicate of the cookie in `.env` |

**Scripts that no longer run without re-downloading:** `processing/parse_docs.py` and `processing/doc_quality.py` (read raw manuals), page parsing in `processing/parse_aihub.py` (called by the collector on raw HTML), and `major_profiles pack` still runs but without the curriculum PDFs (they were in `data/raw/university/`). Everything the next steps need (`enrich_datasets validate/export/hints`, the records, profiles and parsed text) still works.
