# Phase 0 — Findings

*2026-10-27 · Feasibility checks for [PLAN.md](PLAN.md)*

Legend: ✅ verified by a real request today · ⚠️ partly verified · ❓ still open

---

## 1. Summary

| Question | Result |
|---|---|
| Can we get the full dataset list automatically? | ✅ Yes. Official API, no key: **867 datasets** |
| Can we get dataset pages? | ✅ Yes, 20/20 pages fetched and parsed |
| Can we get file trees with sizes? | ✅ Yes, official API, no key, 20/20 |
| Can we download 데이터 설명서 / 구축활용가이드 by script? | ❌ Not by a standalone script, even with your login cookie (server answers "정상적인 접근이 아닙니다"). ✅ **20/20 데이터 설명서 downloaded through your logged-in Chrome** (see §4, §9) |
| Is collection allowed by AI Hub terms? | ⚠️ No rule against crawling, but **copying/providing info to others and any profit use need AI Hub's prior approval** (§2) |
| KU Sejong department list | ✅ 31 departments/majors in [config/departments_ku_sejong.yaml](config/departments_ku_sejong.yaml) |
| Were we blocked or slowed? | ✅ No. ~48 requests to AI Hub, 3–5 s apart, all normal |

**Go / no-go:** **Go** for internal research collection of public page content. **Public launch or sale needs written approval from NIA/AI Hub first.** Send the email in §7 now.

---

## 2. AI Hub terms of use (이용약관) and usage policy

Source: https://aihub.or.kr/useStplat.do?currMenu=110&topMenu=110 , https://www.aihub.or.kr/intrcn/guid/usagepolicy.do?currMenu=151&topMenu=105

- **No clause about crawling or automated collection.** Closest rules: don't disturb other users (제13조) or the stable operation of the service (제15조 4항 8호). Our slow rate keeps us far from this.
- **제15조 3항:** information obtained through the service may not be copied, reproduced, changed, **translated**, published or **provided to others** without prior approval.
- **제15조 2항 / 제16조 2항:** **no profit-making or commercial use** without AI Hub's prior or explicit approval.
- Usage policy: dataset descriptions and authoring tools can be used **without application or login**. Downloads of the data itself need identity check + application. Users must credit NIA ("한국지능정보사회진흥원의 사업결과").
- **Foreign users** need a separate agreement with NIA to use the data. This matters for English-speaking students → show on every card.

**What this means for us**
1. Internal research use (collect, parse, test) is low-risk if we are slow and polite.
2. **Before showing the system to outside users** (even the pilot), we should have NIA's OK, because we show translated/summarized AI Hub information to others.
3. Design rule: cards show **short summaries + key facts + link to AI Hub**, not full copies of AI Hub text or documents. Documents are never redistributed.

---

## 3. AI Hub data sources (verified)

### 3.1 Dataset list ✅
- `https://api.aihub.or.kr/info/dataset.do` (used by the official `aihubshell` tool), no API key.
- Returns `ID, title` lines. **Quirk:** the server answers **HTTP 502 but sends the full content**. The collector accepts 502 for this endpoint only.
- **The list ID = `dataSetSn` in page URLs** (checked on dataset 71).
- 867 datasets; IDs range 50 … 71982.

### 3.2 Dataset pages ✅
- `/aihubdata/data/view.do?currMenu=115&topMenu=100&aihubDataSe=data&dataSetSn=<ID>` (not under robots.txt rules; `/list.do` is avoided anyway).
- ~300 KB HTML each. Parsed fields (see `data/parsed/aihub/pages/<ID>.json`):
  - header: title, tags, field (분야), data type (유형), build year, last update, views, downloads
  - sections: 데이터 개요 (version history, 소개, 구축목적), 데이터 통계 (class/count tables), 데이터 성능 지표 (**AI task + model + metric + score**), 어노테이션 포맷 및 데이터 구조, 활용 AI 모델 및 코드, etc.
  - 메타데이터 구조표 (data format, label type, label format, build amount): **only on newer pages (12/20)**; older pages have the same facts in free text → LLM extraction needed.
  - document links, related dataset IDs, lead organization.
- **Privacy:** pages list staff names, phones and emails (구축 업체 section). The parser **keeps only the organization name** and drops contact details.
- ✅ Access restrictions are shown **only to logged-in users**: all 20 sample pages show "※ 내국인만 데이터 신청이 가능합니다" (Korean nationals only). Anonymous page fetches don't contain it, so this field must come from a logged-in view, from NIA, or be assumed as the default with exceptions marked.

### 3.3 File trees ✅
- `https://api.aihub.or.kr/info/<ID>.do`, no key, same 502 quirk.
- Each file: path, size, **file key** (usable for partial download with aihubshell).
- Sample sizes: **0.1 GB to 9.1 TB** per dataset; median roughly 450 GB. This confirms the value of a "download only this part" helper.
- Note: "smallest file" is often a tiny label file. Real "smallest useful subset" needs logic (one label part + matching source part) → Phase 2.

### 3.4 Documents (데이터 설명서, 구축활용가이드) ❌ for scripts right now
- 20/20 sample pages have a 데이터 설명서 link; 19/20 have a 구축활용가이드 link; 11/20 also have AI model files (skipped).
- Direct request returns `alert('정상적인 접근이 아닙니다.')`. The server checks something a normal browser click provides (login session and/or the page it was clicked from).
- We did **not** try to get around this check. See §4 for options.

---

## 4. Getting the documents: options

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Your logged-in session** (recommended to test first) | You copy the `Cookie` value from your browser's developer tools (Network tab → any aihub.or.kr request → Request Headers → `Cookie`) into `.env` as `AIHUB_COOKIE`. Then: `python -m collectors.collect_aihub docs --sample --use-cookie` | Fully automatic, polite, resumable | May still be refused if the server also checks the clicked-from page; session expires (re-copy) |
| **B. You download the 20 sample docs by hand** | Click 데이터 설명서 on each sample page; save into `data/raw/aihub/docs/<ID>/` | Works for sure; lets us check formats (PDF? HWP?) and sizes today | Not scalable to 867 datasets |
| **C. Ask NIA** (in the email, §7) | Request document files or an export | Cleanest and legal; best for handover | Takes time |

Plan: **B for Phase 0** (so parsing work can start), **A as a test**, **C in parallel** for the full run.

---

## 5. Korea University Sejong Campus ✅

- Official college/department page: https://sejong.korea.ac.kr/koreaSejong/7842/subview.do → **31 departments/majors** in 6 colleges, saved in `config/departments_ku_sejong.yaml`.
- Each department site has menu links with stable labels: 학과소개/대학소개, 교육과정, 전공역량기반 교육과정, 졸업후진로 (checked on 약학과). A script can find them by label.
- `sejong.korea.ac.kr/robots.txt` answers **400 "Request Blocked"** → no published rules. We keep the same slow rate (~100 requests in total).
- Some department sites may have old content (e.g. 독일학 is no longer recruiting).

---

## 6. Estimates for the full run

| Step | Requests | Time at ~4 s/request | Disk |
|---|---|---|---|
| Dataset list | 1 | seconds | <1 MB |
| Pages | 867 | ~1 h | ~260 MB |
| File trees | 867 | ~1 h | ~20 MB |
| Documents (manual + guide) | ~1,700 | ~2 h + transfer | ❓ unknown until we see real files (estimate 3–15 GB) |
| University pages | ~100 | ~7 min | <50 MB |

Total: about **4–5 hours**, split over 2 nights with `run_window_kst: "01:00-07:00"` in `config/settings.yaml`. **Not started. Waiting for your go-ahead.**

---

## 7. Email draft to NIA / AI Hub (Korean)

> **제목:** [연구 협조 요청] AI 허브 데이터셋 추천 시스템 연구 관련 공개 정보 활용 문의
>
> 안녕하세요. 고려대학교 세종캠퍼스 ○○학과 대학원생 ○○○입니다 (지도교수: ○○○ 교수).
>
> 저희는 학생과 연구자가 AI 허브에서 자신의 전공과 관심에 맞는 데이터셋을 더 쉽게 찾을 수 있도록 돕는 **데이터셋 검색·추천 시스템**을 연구하고 있습니다. 특히 AI 비전공 학생(약학, 행정, 식품공학, 스포츠과학 등)이 자기 분야의 문제에 맞는 AI 허브 데이터를 찾는 것을 목표로 합니다.
>
> 이를 위해 다음 사항에 대해 문의드립니다.
> 1. AI 허브 데이터셋 소개 페이지의 공개 정보(개요, 통계, 메타데이터)와 데이터 설명서·구축활용가이드를 연구 목적으로 수집·분석하는 것이 가능한지
> 2. 가능하다면, 서버 부담을 줄이기 위해 **메타데이터 일괄 제공(export) 또는 권장 수집 방법**이 있는지
> 3. 시스템에서 데이터셋 요약 정보와 AI 허브 원문 링크를 학생들에게 보여주는 **교내 시범 운영(파일럿)**에 대한 승인 절차
>
> 수집은 공식 목록 API를 사용하고, 요청 간 수 초 간격·야간 시간대에만 진행하며, 데이터 자체는 다운로드하거나 재배포하지 않습니다. 모든 화면에 출처(한국지능정보사회진흥원 AI 허브)와 원문 링크를 표시할 예정입니다.
>
> 연구 결과와 시스템은 AI 허브 서비스 개선에 기여할 수 있도록 공유드릴 의향이 있습니다. 검토 부탁드립니다.
>
> 감사합니다.
> ○○○ 드림 · 연락처 / 이메일

(Find the contact address on AI Hub → 고객지원. A professor's name on the email will help.)

---

## 8. Files created in Phase 0

| File | Purpose |
|---|---|
| `collectors/polite_http.py` | Shared polite client: robots.txt, 3–5 s delay, retry/backoff, hard stop on 403/CAPTCHA, resume, manifest log |
| `collectors/collect_aihub.py` | Steps: `list`, `pages`, `trees`, `docs` (sample / ids / all) |
| `processing/parse_aihub.py` | Parsers: dataset list, page → JSON, file tree → sizes and file keys |
| `config/settings.yaml` | All rates, limits, URLs, paths |
| `config/departments_ku_sejong.yaml` | 31 KU Sejong departments |
| `.env.example`, `.gitignore`, `requirements.txt` | Setup |
| `data/` | Raw + parsed sample (not for git) |

**How to re-run (PowerShell, project folder):**
```
.venv\Scripts\python -m collectors.collect_aihub list
.venv\Scripts\python -m collectors.collect_aihub pages --sample
.venv\Scripts\python -m collectors.collect_aihub trees --sample
```

**Not done / not tested yet:** university page collector script; document parsing; LLM cost estimate (needs parsed documents).

---

## 9. 데이터 설명서 sample (downloaded 2026-10-27)

**How:** in your logged-in Chrome (Claude in Chrome), the dataset page itself requested the 데이터 설명서 link and saved it as `aihub_<ID>_data_manual.<ext>`. Files were moved to `data/raw/aihub/docs/<ID>/data_manual.<ext>`. 20 requests, ~4 s apart. Notes:
- Plain script requests, even with your cookie, are refused, so the server checks more than login.
- Clicking the button by simulated mouse only worked once; Chrome also had to be allowed to download multiple files from aihub.or.kr.
- This method is fine for samples. **For all 867 datasets, wait for NIA's answer** (bulk export, or approval of a scripted method).

**What we got (file signatures checked):**

| Format | Count | Datasets | Notes |
|---|---|---|---|
| PDF | 10 | 75, 80, 82, 140, 155, 165, 193, 539, 544, 612 | 0.3–12 MB |
| HWP (한글, old binary format) | 8 | 71435, 71582, 71632, 71704, 71749, 71818, 71822, 71824 | 29 KB–16 MB; **all newer datasets (2022+)** |
| ZIP | 2 | 146 (2 PDF versions), 569 (PDF + XLSX appendix) | file names inside are CP949-encoded |

**Consequences for Phase 2 parsing:**
1. **HWP support is required** (40% of the sample, and likely most new datasets). Options: `pyhwp`/`hwp5txt` (text only, free), or convert HWP → PDF/DOCX with LibreOffice + H2Orestart extension (keeps tables). Test both on the 8 files.
2. ZIPs: unzip, fix CP949 names, keep the newest version, also read XLSX appendices.
3. PDFs: PyMuPDF for text, pdfplumber for tables (already planned).

---

## 10. Document parsing test (2026-10-27)

Script: `processing/parse_docs.py` → `data/parsed/aihub/docs/<ID>.json` + `<ID>.md`.
Run: `.venv\Scripts\python -m processing.parse_docs`

**Result: 20/20 parsed, no errors.**

| Format | Method | Result |
|---|---|---|
| PDF (10) | PyMuPDF: text blocks + `find_tables()` rows, in page order | Good. 3.5k–15k characters each. Dataset 612 has a form-style cover page that comes out as fragments; the rest is clean |
| ZIP (2) | Unzip (CP949 names fixed), keep newest version (`_v2.1`), parse members | Good. 146 → newest PDF only; 569 → PDF + XLSX appendix (25k chars) |
| HWP (8) | **pyhwp `hwp5html`** → tables flattened to `| a | b |` rows | **Good.** 2.9k–50k characters; metadata table, purpose, statistics, label format all present |
| HWP (8) | pyhwp `hwp5txt` (comparison) | **Unusable.** 10–18 characters per file (3.6k for one): every table becomes `<표>`, and these manuals are almost all tables |
| HWP | LibreOffice + H2Orestart | **Not tested.** LibreOffice is not installed (see note below) |

**Privacy:** emails and phone numbers are removed, and whole contact-table rows (person names) are dropped. Checked: no emails, phone numbers or the sampled names remain.

**Size of input per dataset** (document + parsed page text): mean **15.5k characters**, median 12k, 90th percentile 33k, max ~56k (dataset 71818). About 35% of characters are Hangul; the rest are spaces, numbers, Latin letters and table pipes.

**Decision:** use `hwp5html` for HWP. LibreOffice is only worth installing if a later HWP fails with pyhwp, or if we need page images.

---

## 11. LLM enrichment cost estimate (2026-10-27)

**Task per dataset** (one request, offline): read page + 데이터 설명서 text → return JSON with plain-language summary (KO + EN), domain/task tags, difficulty, key facts check, 3 project ideas × 3 levels.

**Assumptions (not measured: no Anthropic API key on this PC, so tokens could not be counted exactly):**
- Input: 15.5k characters ≈ **8k–16k tokens** (Korean-heavy text uses more tokens per character than English; range used to cover uncertainty) + ~1.5k tokens of instructions (cacheable)
- Output: **2k–5k tokens** (JSON ~2k, plus thinking)
- 867 datasets; prices from Anthropic's current price list (per 1M tokens): Haiku 5.5 $0.10 in / $0.50 out; Sonnet 5.5 $2 / $10; Opus 5.5 $4 / $20. **Batch API = 50% off** (results within 24 h, fine for offline work).

| Model | Per dataset | All 867, normal | All 867, **Batch API** |
|---|---|---|---|
| Claude Haiku 5.5 | $0.002–0.004 | **$1.5–3.5** | **$0.8–1.8** |
| Claude Sonnet 5.5 | $0.04–0.08 | **$31–70** | **$15–35** |
| Claude Opus 5.5 | $0.07–0.16 | **$62–140** | **$31–70** |

Re-running after AI Hub updates only touches changed datasets (a few per month), so ongoing enrichment cost is small for every model.

**Recommendation:** the full enrichment costs at most ~$70 even with the strongest model in batch mode, so **choose by quality, not price**. Next step: run all three models on the 20 samples (estimated total **under $5**), compare summaries/tags/project ideas side by side, and measure real token counts. Needs an Anthropic API key (`ANTHROPIC_API_KEY`) in `.env`.

Not included: online costs (query parsing + short explanations per user search), which depend on pilot traffic.

> **Update 2026-10-28:** enrichment will be done with Claude through the user's Claude plan, not the API, so the dollar figures above are only for reference. The token sizes still matter: they decide how many batches/sessions the work needs.

---

## 12. KU Sejong major details collected (2026-10-28)

Script: `collectors/collect_university.py` → `data/parsed/university/<dept_id>.json` (one per major). Run: `.venv\Scripts\python -m collectors.collect_university`

- **31/31 majors**, 252 requests, ~4 s apart, no blocks. Total ~315k characters.
- Per major: up to 10 menu pages, labelled **intro / goals / curriculum / careers / research**. Pages about people, boards, admissions and scholarships are excluded on purpose.
- Course tables are captured as rows (course code, course name, credits), e.g. 스마트도시학부: 스마트도시개론, 도시설계, 교통계획, 디자인인포매틱스.
- The 스마트도시학부 site has English menu labels. English keywords were added to `config/settings.yaml`.

**Gaps (acceptable for now):**
- Some curricula are only images (전공체계도) or attachments (PDF/HWP). Text is missing for: 식품생명공학과 (no curriculum page found), 자유공학부, 글로벌경영 (attachments only), 디지털경영 and 약학과 (few rows). About 25 attachment links are recorded in the JSON files but not downloaded yet.
- Two majors share one site (국제스포츠학부: 스포츠과학 / 스포츠비즈니스), so they have identical pages. Their profiles must be told apart by name and the curriculum rows.

---

## 13. Full AI Hub collection (2026-10-28)

| Item | Result | How |
|---|---|---|
| Dataset pages | **867/867** parsed → `data/parsed/aihub/pages/<ID>.json` | script, 848 requests, ~1 h |
| File trees | **867/867** → `data/raw/aihub/filetree/<ID>.txt` | script (API server), 848 requests, ~1 h |
| 데이터 설명서 | **861/867** → `data/raw/aihub/docs/<ID>/data_manual.<ext>`, 1.6 GB | user's logged-in Chrome: a loop inside one AI Hub tab fetched each file (3.5–5 s apart) and Chrome saved it; `collectors/doc_queue.py import` moved them. **0 failures** in 841 new downloads |
| No 데이터 설명서 link on page | 6 datasets: 99, 106, 113, 134, 150, 71264 | — |

Formats (file signatures checked): **HWP 528**, **PDF 312**, ZIP 12, **HWPX 9**. HWPX (newer zip-based HWP) is **not supported by `parse_docs.py` yet**; add it before parsing everything.

**Next for majors:** Claude reads each major's pages and writes a **major profile**: plain summary (KO/EN), key topics, course keywords, typical career paths, plus links to AI Hub domains. The domain links need the full AI Hub domain list first, so this step runs right after the full AI Hub collection.

---

## 14. Parsing all 데이터 설명서 (2026-10-28)

Script: `processing/parse_docs.py` (now also reads **HWPX**) → `data/parsed/aihub/docs/<ID>.json` + `.md`. Quality report: `python -m processing.doc_quality` → `data/parsed/aihub/docs_quality.csv`.

| Format | Files | Median characters |
|---|---|---|
| HWP | 527 | 4,951 |
| PDF | 312 | 6,720 |
| ZIP | 12 | 14,028 |
| HWPX | 9 | 4,171 |

- **860/861 parsed; 829 have no quality flag.** Full run ~1 h 50 min.
- Fixed during the run: Excel files inside ZIPs were left open (Windows could not delete the temp copy) → 4 ZIPs failed, now parsed. HWP files that crash `hwp5html` now fall back to `hwp5txt` (no tables).

**Still bad (need another converter, e.g. LibreOffice or Hangul, or OCR):**

| ID | Problem |
|---|---|
| 71407 (HWP) | pyhwp crashes on its own XML step (both html and txt) — no text |
| 71510 (HWP) | `hwp5html` times out (>10 min); fallback text is only table placeholders (13 chars) |
| 71617 (PDF) | scanned images only, 0 text — needs OCR |
| 187, 188 (PDF) | mostly images, ~185 chars of text — needs OCR |

**Flags that are fine on inspection:**
- `low_korean` (14): text is real; these manuals contain long JSON/annotation schemas with English field names.
- `too_short` (8 more, 1.1k–1.5k chars): short but complete one-table manuals.
- `broken_lines` (9 PDFs, incl. 612): cover pages/diagrams split into fragments; body tables are fine.
- `no_tables` 198: text fine, layout is not table-based.

**Watch for enrichment:** 576 (ZIP) holds two 5,000-row Excel lists → 1.46 M characters. Cap or summarise Excel sheets before sending text to Claude.

---

## 15. Major profiles (2026-10-29)

**Status: ready to use.** 31/31 profiles, all pass `python -m processing.major_profiles validate`. Combined file: `data/profiles/majors_ku_sejong.json` (one per major also in `data/profiles/majors/<id>.json`).

**Inputs read for each major** (`data/profiles/packs/<id>.md`, built by `python -m processing.major_profiles pack`):
- all collected department pages (menus/footers and repeated lines removed);
- 22 PDF attachments (curriculum and competency PDFs, one 143-page career guide) and 25 images, downloaded with `collectors/collect_university_media.py` (47 requests, 0 failures, no page re-crawled);
- images were read by Claude only where the page itself had no text: 약학과, 미래모빌리티, 디지털경영 (2), 표준·지식학과 (2). Others were skipped because the same course list exists as text, or the image is decorative.

**Profile fields:** names KO/EN, summary KO/EN, key topics, course keywords, `curriculum_by_year` (year → courses), careers, research areas, `data_interests` (free topics + keywords, **no AI Hub field list** — decision 2026-10-29), 2 interest questions with options (KO/EN), project themes, `data_skill_level` (low/medium/high) + note, sources, `inferred_fields`, `gaps`.

**What comes from the site vs. inferred:**
- From the site: summaries, topics, course keywords, curriculum by year, research areas; careers for 22 majors.
- Inferred by Claude (general knowledge, marked in `inferred_fields`): `data_interests`, `interest_questions`, `project_themes` for all 31 (they did not exist on any site); careers for 9 majors with no careers page; 식품생명공학과 course keywords (no curriculum page).
- Skill level: high 6, medium 11, low 14.

**Known weak spots (in each profile's `gaps`):**
- 식품생명공학과: no curriculum page; course keywords are subject areas, not real course names.
- 문화콘텐츠전공: only required courses are published.
- 자유공학부: first-year only; the recommender should ask which major the student plans to enter.
- 스포츠과학 / 스포츠비즈니스: same website; only the curriculum map separates them.
- Many `curriculum_by_year` entries are estimated from course numbers (2xx = year 2).

**Recommended check before the pilot:** one student or staff member per major reviews their profile (5 minutes each), as planned in PLAN.md 4.3.

**Update 2026-10-29:** the user decided no student review is needed; the profiles are used as they are.

---

## 16. Dataset enrichment: schema and first 10 records (2026-10-29)

**Script:** `processing/enrich_datasets.py` (`pack`, `next`, `validate`, `export`). Controlled task list: `config/tasks.yaml` (27 tasks with plain Korean/English phrases, 7 modalities).

**How it works:** the script writes a reading pack per dataset (`data/enriched/packs/<id>.md`: page sections, file-tree summary, 데이터 설명서 text; repeated lines, empty table cells and lines with emails or phone numbers removed; page and manual capped at 7,000 characters each). Claude reads the pack and writes `data/enriched/aihub/<id>.json`. `export` merges exact facts from the page and file tree (title, years, size in GB, smallest file, related datasets, URL) into `data/enriched/aihub_datasets.json`, so numbers that a script can read are never typed by hand.

**Fields written by Claude:** plain summary and "what one sample is" (KO + EN), modalities, tasks (controlled list), free everyday topics (raw material for our own `domains.yaml`), keywords KO/EN, label types, file formats, scale, example classes, baseline (task, model, metric, value), difficulty (beginner / intermediate / advanced) with a note, skills needed, caveats, 3 project ideas (beginner / capstone / research), `uncertain` notes. AI Hub's own field is not used.

**Sample (10 datasets):** 75, 140, 146, 165, 539, 569, 612, 71582, 71632, 71818: all pass `validate`. Difficulty: 3 beginner, 5 intermediate, 2 advanced.

**Seen in the sample:**
- Page and manual numbers often disagree (for example 146 counts, 71582 baseline values); written to `uncertain`.
- AI Hub's performance table often names the wrong task type (segmentation listed as "Object Detection", gesture generation as "Image Generation"); the record uses the real task.
- Many datasets are hundreds of GB to several TB; caveats say to download a subset.

**Size of the full job:** packs total 9.55 M characters (median 11.3k, max 14.9k per dataset). Reading plus writing one record is roughly 10–15k tokens, so the remaining 857 datasets are about 9–13 M tokens of Claude plan usage, done in batches across sessions (`next --n 25` gives the next batch and writes its packs).

**Progress 2026-10-29 (batch run 1):** 246 of 867 datasets enriched (all pass `validate`; combined file rebuilt with `export`). Stopped at about 90% of the 5-hour plan limit as agreed. Next run continues with `next` (ids 558 onward). Note: once this conversation passed ~85% of its context, each batch cost ~9% of the 5-hour limit instead of ~2%; continue in a fresh session. Helper templates used for near-identical page families: `dialect.py` (한국어 방언 발화 118–122) and `mt.py` (번역 말뭉치 127–129). In the scratchpad, not in the repo. Usage: about 5 datasets per 1% of the 5-hour limit once batching was used.

**Progress 2026-10-30 (batch run 2):** 396 of 867 datasets enriched (ids 558–71375 added, 150 records; all pass `validate`; `export` rebuilt `data/enriched/aihub_datasets.json`). Next run continues with `next` (id 71376 onward). The 5-hour limit went from 23% to 51% (about 1.5–2% per batch of 6). Stopped early at ~55% of this session's context so the next session starts cheap; continue in a fresh session. Reading tip: the pack's first ~1,500 characters are mostly the change-history table, so filter out lines starting with version/date rows and tree lines before reading, and grep the `번호 | 측정항목` table for baselines.

**Progress 2026-10-30 (parallel run 3): enrichment complete.** 867 of 867 datasets enriched, all pass `validate`, `export` rebuilt `data/enriched/aihub_datasets.json` (difficulty: beginner 166, intermediate 444, advanced 257). The remaining 471 ids were split into 12 chunks of 40 (`data/enriched/chunks/`, with `WORKER_BRIEF.md`) and run by 3 parallel worker sessions; a coordinator session checked usage and paused all workers at 88% of the 5-hour limit (720 done), then resumed after the reset. Cost: about 3–4 datasets per 1% of the 5-hour limit; workers that kept a long conversation across chunks cost more than freshly cleared ones. Checks after the run: no duplicate summaries; no emails or phone numbers (the one regex hit is the metric `HR@500`). Open for the second pass: 175 records with empty `classes_example`, 412 with notes in `uncertain`, 1 with `doc_used: false`.

**Data clean-up 2026-10-31 (second pass): data ready.**
- Manuals fixed: 71407 and 71510 now parse with a new direct HWP reader (`parse_hwp_ole` in `processing/parse_docs.py`, `--hwp-method ole`; it also drops name cells after contact headers). 187, 188 and 71617 (scanned PDFs) were read visually from page images and written to `data/parsed/aihub/docs/<id>.md` (method `visual_read`, contacts left out; 188 page 3 not read). 576: Excel sheets now capped at 60 rows each (`XLSX_MAX_ROWS`), 2.19 M → 37 K characters. Old files backed up in the session scratchpad.
- Records updated from the new manual text: 187, 188 (page says 803,060 images, manual 1,106,678 — kept in `uncertain`), 71407, 71510 (retail products: 300+ categories, 10,000+ products), 71617 (radar/LiDAR are pcd, not txt).
- `doc_used` set to false for the 6 datasets with no manual (99, 106, 113, 134, 150, 71264).
- Label fixes from a consistency audit: 138 gets the `audio` modality; 71954 (RF spectrograms) `audio_classification` → `image_classification`.
- Class lists: new `hints` command in `enrich_datasets.py` shows class-like lines from the full page + manual. Of 174 empty `classes_example`, 47 are task types without classes (translation, QA, speech recognition…); the other 127 were re-checked by 3 worker sessions: 97 filled, 30 still not found (marked in `uncertain`). 77 records have an empty list now.
- **Decision 2026-10-31: bad manuals thrown away.** The 5 manuals that could not be parsed normally (71407, 71510, 187, 188, 71617) are no longer used: moved to `data/parsed/aihub/docs_discarded/` (with a README), and their records were rebuilt from the AI Hub page only (`doc_used: false`, caveat "페이지 정보만 사용"). The pages were rich enough: they hold the class/scenario tables and the performance tables (now in `baseline`; the old records wrongly said "no metrics"). Manual-only details were removed (e.g. 188's manual image count, 71617's polygon label, 71510's clothing/cosmetics classes). The `parse_hwp_ole` reader stays in `parse_docs.py` but is not used for any record.
- **Exclusion rule:** a page-only dataset is kept only if its page states what the data is, its type, its labels and its size. All 11 page-only datasets (the 5 above + 99, 106, 113, 134, 150, 71264 with no manual) pass, so none were excluded. Weakest: 134 (관광 지식베이스), whose page names the labels only as "multilingual POI metadata".
- Note: one worker saw 12 record files revert on disk mid-run (likely OneDrive sync, since the project is in a OneDrive folder); it re-applied them, and all edits were verified on disk afterwards. Consider pausing OneDrive sync during long write runs.

## 17. Domains: our own subject areas (2026-10-31)

**What a domain is:** the part of the world the data is about (farms, hospitals, roads, laws…), so a non-AI student can pick by interest. It never names an AI method: methods stay in `tasks`, data kinds in `modalities`. AI Hub's own 데이터 영역 field is still not used.

**How the list was built:** Claude read all 867 records in compact form (title, free `topics`, keywords). The free topics had 991 different labels, mixing subjects ("Agriculture") with methods ("Multimodal AI", "Synthetic data"), so they could not be used directly. A draft of ~45 subject areas came from them; every dataset was then tagged by hand (judged one by one, not keyword-matched), and the fuzzy domains were reviewed as lists. Domains below 5 datasets were merged: geology → `nature_ecology`, life science → `science_research`, electronics (3 datasets) → `manufacturing`.

**Result:**
- `config/domains.yaml`: 53 domains in 8 groups (people & health; language, knowledge & education; society & safety; culture, media & everyday life; economy; industry & technology; mobility & cities; nature, farming & environment). Each has Korean/English names, a scope line in both languages and, where cases are close, a "not: → other domain" rule. The tagging rules are at the top of the file.
- `data/enriched/domain_tags.json`: 1–3 domains per dataset, first = main subject (273 with one, 505 with two, 89 with three). Smallest: `math` 6, `social_media` 7, `pharma` 8; largest: `autonomous_driving` 79, `speech_voice` 72, `people_body` 70.
- `data/profiles/major_domains.json`: every major has 2–4 `core` and 2–6 `related` domains, each with a short reason taken from the profile (`data_interests` etc.). All 53 domains are linked to at least one major.
- `python -m processing.domains check` validates all three; `report` prints counts per domain and the chip list per major. `enrich_datasets export` and `major_profiles export` refuse to run when the check fails, and add the field `domains` to the exported records (nothing else in the exports changed — compared record by record).

**Known limits:**
- One person (Claude) tagged everything, so there is no second opinion yet. The major links are not reviewed by departments (PLAN §4.3 step 2). Spot-check a few domains with `report` before the pilot.
- `social_media` is small (7 datasets) but linked from 10 majors (core only for `pubs`). Students who pick it will see few results.
- `general_ai` (46) collects benchmarks and general objects; it is a main chip only for `ids`, `software`, `kueie` and `bigdatascience`.
- No dataset covers North Korea, migration or esports directly; the `kuds` and `sfa_business` links point to the nearest fields.

## 18. Search index: 20-dataset test (2026-11-01)

**Setup decided:** embeddings with Google `gemini-embedding-001` (768 dimensions) through the user's own key (in `.env` as `GEMINI_API_KEY`, copied from `plant-safety-rag/secrets`, never printed). The user is now on a laptop without a GPU (i5, 4 cores, 8 GB RAM), so a local model would be slow. Vectors are stored in FAISS files for now (`data/index/`), not in PostgreSQL (a temporary change from PLAN §3, to keep this step simple; the database comes with the app). All embedding calls go through `processing/embed.py`, so a local model (e.g. BGE-M3) can replace Gemini later by changing one module and rebuilding. Note: the live app must embed queries with the same model, so while Gemini is used the app needs the key too.

**Pipeline (new modules, settings in `config/search.yaml`):**
- `processing/chunk.py` → `data/index/cards.jsonl` (one search text per dataset: titles, summaries, domains, tasks, keywords, classes, labels) and `chunks.jsonl` (page sections + 데이터 설명서 split at line boundaries, ~1,200 characters, tables kept whole or split by rows with a short header repeated). Change-history rows, "다운로드" button labels, repeated lines and contact lines are dropped.
- `processing/embed.py` → Gemini calls with batching (50), retries with backoff, a minimum gap between calls and a SQLite cache (a text is never sent twice; interrupted runs resume).
- `processing/build_index.py` → FAISS files + Kiwi tokens for BM25 keyword search.
- `processing/search.py` → 4 ranked lists (card vectors, chunk vectors, card BM25, chunk BM25) merged by weighted reciprocal rank fusion; also reports the raw cosine similarity for a future no-match threshold. `--eval CSV` runs a test file.

**Sample test (20 varied datasets, 272 chunks, `eval/queries_sample20.csv`, 23 queries with an answer + 3 without):**
- First version: 11/12 top-1. Failure: "I like dogs". The meaning search was right, but keyword search matched "i"/"like" and missed "dogs" vs "dog". Fixed by dropping request words (English and Korean, list in `search.yaml`) and folding English plurals in BM25 tokens.
- Keyword lists then weighted 0.5 against 1.0 for meaning lists: top-1 went from 22/23 to 23/23; exact terms ("YOLOX", "KOMPSAT") still found. **Provisional** — 23 queries on 20 datasets is too small; re-tune on the full test set.
- No-match signal: the 3 requests AI Hub cannot answer in the sample scored best card cosine 0.54–0.55; correct matches scored 0.62–0.78. A threshold near 0.6 looks possible but must be set on the full test set (PLAN §7.5).
- Bugs found and fixed: FAISS cannot write files under a non-ASCII Windows path (`Рабочий стол`), so the index is written as bytes from Python; very long single lines (up to 2,800 characters) made oversized chunks and, as repeated table headers, inflated the total. Now 0 chunks over 2,000 characters.

**Full run (not done yet):** 867 cards + 12,576 chunks, 13.1 M characters. About 270 API requests; at ~1.6 s per request about 8 minutes if the key's rate limit allows. Cost estimate: roughly 7–10 M tokens → about $1–2 at the published $0.15 per million tokens (to be checked on the billing page).

**Full index built 2026-11-01:** 867 cards + 12,576 chunks embedded (`data/index/meta.json`). The first run stopped at ~9,800 vectors when the laptop lost its internet connection (DNS error after 5 retries); the rerun took only the missing ~3,700 from the API (78 requests, 229 s) thanks to the cache. Google answered some requests with 429 (rate limit); retries with backoff handled them.

**Full-index test (`eval/queries_full_v0.csv`, 28 questions with answers + 4 without; several datasets can be correct):**
- Top-1 25/28, top-5 28/28. One label fixed after the run: 71321 (salmon/pollock smart fish farm) is a correct answer to "fish farm images".
- Misses at top-1 (right answer still in top 5): "products in a store" → 71549 (shop customer behaviour; related), "football player tracking" → 620 (multi-camera person tracking; wrong field), "반려견 피부병" → 71879 (dog disease text corpus; the skin-disease image set 561 is 2nd or lower).
- No-match questions: best card cosine 0.565–0.596; correct answers 0.624–0.776. The gap is small (0.60 vs 0.62), so cosine alone will not be a safe "no match" rule. Ideas for later (PLAN §7.5): also require that the query's domain/data type exists, and look at the gap between first and later results.
- This is a first check, not the real evaluation: the ~50-question test set (+ ~20 no-match questions) from PLAN §9 is still to be written, ideally by someone other than the person who tagged the data.

## 19. Search evaluation: dev and test sets (2026-11-01)

**Sets** (`eval/README.md`): the 32 earlier questions became the **dev set** (`queries_dev_v0.csv`, for choosing settings). A new **test set** (`queries_test_v1.csv`) has 59 answerable + 17 no-match questions: plain wishes ("고양이 사진으로 뭔가 만들고 싶어요"), major-style requests ("I study food science"), technical requests, exact terms, and details hidden inside manuals. Correct answers were found from records, class lists and domain tags, not with the search engine. No-match questions were checked against the full text of all pages and manuals.

**Tuning on dev only:** keyword (BM25) weight 0.0–1.0 × `rrf_k` 20/60 × chunk-vector weight. Best: `rrf_k` 20 with BM25 weight 0.0–0.3 (all tie at top-1 27/28, MRR 0.982; the old 0.5/60 gave 25/28). Chosen: BM25 0.3, `rrf_k` 20 — the small keyword share is kept for exact terms (model names, place names). Saved in `config/search.yaml`.

**Test result (saved settings): top-1 56/59, top-5 57/59, MRR 0.955.** The old setting scored 49/57 top-1 on the same questions before the key fixes.
- Not found in the top 5 (2): "ECG heart signal data" (ECG is only one sensor column inside two driver-monitoring datasets, 650/651) and "North Korea news sentences translated to English" (one section inside translation corpus 71266). Details buried deep in one dataset are the weak spot; the one-question box and a later "search inside a dataset" step should cover them.
- Rank 3: "bird song recordings" → 644 (bird calls are a few of its 125 sound classes).
- Answer-key fixes after the first run (all cases where the key was wrong, written in the `note` column): 585 urban sounds has a "개" (dog) class; 570 animated-face emotion fits "emotion recognition from facial expressions"; the two bird questions were wrongly marked no-match — 644 has crow, magpie and duck calls. My no-match text check had searched for "새소리/bird song" and missed "까마귀울음소리". The search found what the keyword check missed.

**No-match signal (best card cosine), test set:**
- One threshold for both languages does not work: Korean questions score higher overall. Korean: answerable ≥ 0.682, no-match ≤ 0.656 (separable here, but only 5 Korean no-match questions). English: answerable as low as 0.576, no-match up to 0.674 (overlap).
- With 0.62 for all: 1/59 answerable wrongly flagged, 11/17 no-match caught. The no-match questions that score high are near misses (sleep-apnea sound → general sound data, sea turtles → marine organisms, clickstream → travel logs), which PLAN §7.5 shows as "related" anyway.
- Proposal for the no-match feature (not built): a language-aware threshold (about 0.67 Korean, 0.62 English to start) that switches the answer to "AI Hub has no exact match, here are related datasets + search words for other sites", tuned on a separate no-match set. The thresholds above were read from the test set, so they are provisional.

## 20. Streamlit search demo (2026-11-01): built, then removed

A quick internal Streamlit page (`app/demo_search.py`) was built and checked in the browser (search, both languages, filters, the experimental no-match warning). The user asked to delete it the same day: the UI will follow the user's own design, to be given later. Removed: `app/`, `.claude/launch.json`, `streamlit` from `requirements.txt` and from `.venv`. Kept: the search itself (`processing/search.py`), the index and the provisional `no_match` thresholds in `config/search.yaml`.

## 21. Repository clean-up (2026-11-01)

User asked to clean and organize the project before learning it and testing it. Deleted: Python cache folders, `eval/queries_sample20.csv` (its 20-dataset index no longer exists), `data/parsed/aihub/docs_quality.csv` (one-time report). Moved `PLAN.md`, `DATA_SOURCES.md` and this file into `docs/`. Added `README.md` (status, folder map, commands, how search works). Kept on purpose: the manual `.md` copies (easy to read), the old parsing scripts (needed if the data is ever re-downloaded), `.venv` as it is. Checks after the clean-up: records 867/867 and profiles 31/31 valid, domains check 0 problems, test set unchanged (56/59 top-1, 57/59 top-5).

## 22. Recommendation scoring (2026-11-02)

`processing/recommend.py` + `config/ranking.yaml` + `tests/test_recommend.py` (10 tests, offline). Command line only; no UI.

**Design (PLAN §7.2):** candidates = search results for the free text + all datasets in the picked interest chips (or, with neither, the major's linked domains). Four parts, each 0–1: interest (text similarity mapped from 0.55–0.80 plus fused rank; chips: main domain 1.0, other 0.6), major (core main 1.0, core other 0.8, related main 0.6, related other 0.5), level (student level from experience, or year when experience is missing, +1 for graduate students; 3×3 fit table; +0.1 when a baseline exists for beginners and graduates), practicality (total size per computer; −0.1 without a manual). Weighted mean of the parts the profile gives. MMR (λ 0.75, card-vector similarity) for diversity. Each result gets reasons, warnings and a project idea for the purpose (class/self-study → beginner, capstone/competition → capstone, thesis → research).

**One problem found and fixed:** with one weight set (interest 0.45) the profile buried what the student asked for: "교통 혼잡" ranked the congestion dataset 4th because it is 2 TB and the student has a laptop. Tested on the dev set with a strict profile (3rd year, Python only, laptop): interest 0.45 → 19/28 top-1, 0.55 → 26/28, 0.65 → 28/28. Now two weight sets: with text interest 0.65 (size and level become warnings), with chips only interest 0.45. Held-out test set with the same strict profile: 56/59 top-1, 57/59 top-5 — the same as search alone, so the profile no longer hurts relevance.

**Scenario checks (by eye):** Smart City 1st year, laptop, no text → small beginner city/infrastructure datasets with reasons. Pharmacy master's student, ML, lab GPU, chip "pharma" → drug and medicinal datasets (633, 71369, 71962, 151, 576). "I am interested in animal health" → livestock behaviour, dog disease corpus, dog/cat health data. "running form analysis" → no-match flag on; closest are knee-arthritis gait data and CrossFit/fitness motion (close call 0.549 vs 0.546).

**Data gaps:** "who may download" (Korean nationals only, 안심존 on-site) is not reliably in the parsed pages, so the planned access warning is missing; it needs the page's access label collected. "Smallest file" is usually a tiny label file (median 1 MB), so practicality uses total size only; a real "smallest usable subset" would need the file trees analysed per folder.

**Bug caught by the tests:** YAML reads `1.0e9` as text, not a number; the size table now uses 1000000000.

## 23. Scoring simplified to relevance, 0–10 (2026-11-02)

**User decision:** level and practicality are removed from the score. Reasons: almost all AI Hub data is large, so size does not separate datasets; difficulty depends on the method the student picks, not on the data. The score now answers only "is this dataset related to this student?" and runs 0–10, to be compared later with students' own 0–10 ratings in the pilot survey. §22's level/size parts are replaced.

**Now:** score = 10 × weighted mean of interest (text and/or chips) and major fit; a part with no input is skipped. Size, difficulty, missing manual and the project idea are shown as facts. The profile only needs major, interests, text and purpose (purpose only picks the project idea). Ties (equal scores) are ordered by AI Hub downloads.

**Weights chosen on the dev set**, every question run with all 31 majors (868 runs), share of runs with the right dataset first: interest/major 0.6/0.4 → 35%, 0.7/0.3 → 67%, 0.8/0.2 → 91%, 0.9/0.1 → 99.3%, 1.0/0 → 100%. Chosen: **0.9/0.1 with text** (the request leads; the major breaks ties), **0.6/0.4 with chips only**.

**Held-out test set** with no major and each of the 31 majors (1,888 runs): top-1 95.4%, top-5 96.6% (search alone 94.9% / 96.6%). Scenarios: a pharmacy student asking "교통 혼잡" gets the traffic datasets (score 6.2 vs 7.2 for a Smart City student); "I am interested in animal health" now puts dog/cat health data first (before, the size penalty pushed it down). Tests: 8 pass.

**Known limit:** without text, every dataset in a core domain of the major scores 10.0, so the score says related / not related but does not rank inside the major's field. A possible fix: add the similarity between the major profile text and each dataset card (31 extra embeddings, a few cents) as part of the major score.

## 22. Easier dataset explanations and match labels (2026-11-02)

**User feedback:** the summaries are dry and full of numbers that confuse non-AI students. Wanted: an easy explanation first ("this dataset records pigs' ... so AI can ..."), numbers moved to a table below, and a "자세히" part in professional style.

**New explanation format** (sample of 20 datasets in `data/enriched/explanations/<id>.json`, status `sample-2026-11-02`):
- `easy_ko` / `easy_en`: 2 sentences, everyday words, almost no numbers: what was recorded, how it is marked, what you could build.
- `detail_ko` / `detail_en`: professional paragraph with the numbers, label formats, baselines and caveats.
- `amount_ko/en`, `labels_ko/en`: plain-word lines for the facts table.
- The facts table itself is built by code from existing fields (data type, file formats, amount, labels, example classes, size + smallest file + file count, level, year + organization, baseline).
- Sample ids: 71408 59 74 146 576 99 118 180 545 71582 71805 71716 86 162 71510 71969 71642 498 71349 71866. Written from the existing records (no re-reading of manuals).
- **Waiting for the user's approval of the style** before the full run of the other 847 (estimate: much cheaper than the first enrichment, because only the compact record is read).

**"Possibly no exact match" warning removed (user decision).** Why it misfired: "stock market" got the warning, "stock" alone did not — but AI Hub has no stock-market data; "stock" matched 71969 *K-stock content* (stock photos), so the warning was right and the single word was the false match. A yes/no verdict from one similarity number is too fragile. Replaced by (config `search.yaml`):
- `match_label`: each result shows 잘 맞음 / 부분적으로 맞음 / 관련 약함 (strong / partial / weak) from its card similarity, with separate Korean and English thresholds (provisional, from the test set). The recommender will use the same similarity in its score.
- `other_sites`: every result list ends with "찾는 데이터가 없나요?" and search links (Kaggle, Hugging Face, Roboflow Universe, GitHub, Google Dataset Search, 공공데이터포털), built from the query. This keeps the PLAN §7.5 idea without a wrong verdict. Links checked: all open (Roboflow blocks scripts but works in a browser).
- The 71969 easy text now says plainly that it is stock photos, not stock-market data.

**Test page** (`tools/search_ui.py`) shows: title, match label, easy text, domains and tasks, facts table, 자세히 (detail + best matching original text), optional scores (checkbox), AI Hub link, and the footer.

## 24. Major profile similarity in the major score (2026-11-02)

**Problem (§23):** without typed text every dataset in a core domain of the major scored 10.0, so the score did not rank inside the major's field.

**Change:** one text per major (names, summaries, key topics, data interests with keywords, project themes, research areas) is embedded with Gemini (31 texts, query type, cached) and compared with every dataset card. Major score = 0.5 × domain-link fit + 0.5 × profile similarity.

**Scaling tried:** percentile among all 867 datasets → every in-field dataset landed at 0.95–1.0, top-20 scores spread over only 0.5 points (9.5–10). Linear per major (its median dataset → 0, its most similar → 1) → top-20 spread ~2.7 points; datasets in the major's field score 4–10, the best one outside the field ~3.5 (Pharmacy, Smart City, Sport Science checked). Chosen: linear, share 0.5.

**Checks:** ties inside the top 20 went from most results to a few. By eye: Pharmacy → pill images, medicinal herbs, medicine packaging OCR, then biomedical papers and toxicity; Food & Biotech + chip "food" → fermentation data first, food 3D models last; Economics → finance/accounting documents. Text requests are not hurt: dev set (896 runs, every major) top-1 99.8%; held-out test set (1,888 runs) top-1 96.1%, top-5 96.6% (before: 95.4% / 96.6%). Tests: 10 pass.

**Limits:** the profile texts are Claude-written and not yet reviewed by departments, so their wording now affects ranking. The 0–10 values are not yet calibrated against student ratings; that is what the pilot survey is for.

## 25. Suggested search keywords per major (2026-11-02)

**Why:** a student may not know what to look for, or may not want to type. The UI can show ~10 clickable keywords for the student's major; clicking one runs it as the search text.

**How (`processing/major_keywords.py`, settings `keywords` in `config/ranking.yaml`, output `data/profiles/major_keywords.json`):**
- Candidates: the major profile's data-interest topics and keywords and key topics (plain words), plus keywords that appear in at least 2 of the major's top 30 datasets; English also gets the words of the datasets found by the chosen Korean keywords.
- Filters: a stop list of method/benchmark/region words (LLM, 멀티모달, 의도 분류, 서부권, …) and, for dataset-derived words only, a code rule (capital runs, CamelCase, digits other than 2D/3D/4D, & or /: drops YOLOv8, OpenNMT, SLAM, K-IFRS, Sentinel-2, …).
- Each candidate is run through the real recommender for that major. Kept only if AI Hub has a close match (match label not weak) and the best result both matches the keyword (interest ≥ 0.6) and fits the major (major ≥ 0.6). The first version used the total score ≥ 6 and let weak words through ("Korean food" for Pharmacy).
- Chosen best first (profile words get +0.5), skipping a keyword whose top-5 datasets overlap a chosen one by more than 0.4 (Jaccard), so each keyword opens a different area.

**Result:** 31 majors; Korean 6–10 keywords each (most 10), English 5–10. Examples: Smart City → 토지피복, 도시 3D·디지털트윈, 균열 탐지, 건물 탐지, 드론 영상, 재난·홍수·열섬 리스크, 건설 현장 안전 …; Pharmacy → 알약 이미지, 의료 음성, 식물 이미지, 독성학과 안전성, 의학 질의응답 …; Food & Biotech → 농산물 품질, 음식 이미지, 축산물, 스마트팜, 발효식품과 미생물 …. Cost: a few cents (embeddings cached). Tests: 13 pass (3 new).

**Limits:** English lists are thinner and more technical, because the profiles hold few English words. Some odd picks remain ("air fitting", "sauropod"): a person should skim the lists once. Fixes go into the stop list in `config/ranking.yaml`, then `build` again.

**Bug met on the way:** the shell tool turns `\b` into a backspace character inside regex text written through a heredoc; the code rule now uses a pattern with no backslashes.

**Full run done (2026-11-02).** User approved the sample style. One fresh worker session wrote the other 847 files from `docs/EXPLAIN_BRIEF.md` with `processing/explain.py` (`next` packs of 25, `validate` after each batch). First 5-hour window: 425 datasets, 33% → 89% (paused at the limit, resumed after the 07:20 UTC reset). Second window: 422 datasets, 11% → 57%. Weekly limit 27% → 43%. About 7–9 datasets per 1% of the Pro 5-hour limit.
- Checks: `explain validate` 867/867, 0 problems. No duplicate easy texts; no technical terms in easy texts (two keyword hits were "안전사고", a false match); easy_ko median 131 characters (89–174). Three random worker files read by the coordinator: clear and consistent with the samples.
- `enrich_datasets export` now refuses to run unless every explanation is valid, and merges `easy_*`, `detail_*`, `amount_*`, `labels_*` into `data/enriched/aihub_datasets.json` (all other fields unchanged, compared record by record).
- Not done: a human read of all 867 texts. Spot-check while testing; a wrong text is fixed by editing `data/enriched/explanations/<id>.json` and re-running validate + export.

## 26. Limited dataset assistant allowed (2026-11-10)

**User decision:** the deployed system may have an LLM chat for project recommendations and clearer dataset explanations, using free APIs and limited so it cannot be used for other things. This changes the 2026-11-01 "no multi-turn chat" decision and replaces the one-question box. Design: `docs/PLAN.md` section 7.6. Documents only so far; no chat code, config or provider test exists yet.

**Hosting and approval (user, 2026-11-10):** the server will be hosted online and offered inside Korea. The user does not expect an approval problem, because data cannot be downloaded from outside Korea. Note: 제15조 3항 as recorded in section 2 has no exception by country, and it covers providing information to others, not only downloads, so this remains the user's risk decision.

**K-EXAONE key (`K-EXAONE_API_KEY`, issued through docs.exaone.ai):** one test call to `POST https://api.exaone.ai/v1/chat/completions`, model `k-exaone_v2.5`, succeeded on 2026-11-10 (HTTP 200, 2.3 s, Korean reply). Limits in the response headers: 1 request per second, 60 per minute, 86,400 per day. **It must not power the student assistant under the current terms** (in force 2026-11-09): 제2.1 grants non-commercial use only and bars letting third parties call the model through your own product or service; 제2.5 bars re-providing the model to third parties; 제3.4 makes each key expire 30 days after issue. Use is limited to the user's own local testing unless LG gives written permission. Do not opt in to "usage record analysis" to raise the daily limit: it allows inputs, which here would include AI Hub text, to be stored and used for training.

**Postponed (user, 2026-11-10):** the assistant is built last. The user may buy paid Gemini usage for it.

**App decisions (user, 2026-11-10):** no access warnings (students see the rules on AI Hub, so the access-label collection is dropped); development only, hosting is future work; the app looks similar to AI Hub and uses its dataset icons. Checked on dataset page 71: one icon per dataset at `/web-nas/aihub21/files/public/DATA_SET<number>` (also on the related-data cards), not saved by our collector. One icon requested with another site as referrer returned HTTP 200, 2,560 bytes, so loading from AI Hub looks possible; not yet tested in a real page. Node.js and FastAPI are not installed on this laptop.

**Still open:** AI Hub approval before outside users see its information (제15조 3항); sending AI Hub text and student questions to a provider outside Korea; the on-topic similarity threshold has no tested value yet; provider limits come from the free-llm-apis skill data of 2026-10-25 and must be checked again before launch.

## 27. Student app, first development version (2026-11-11)

**Built:** `app/server.py` (FastAPI) + `app/static/` (one HTML page, `style.css`, `app.js`, no build step); settings in `config/app.yaml`. It wraps the existing code only: `processing.recommend` (search + scoring), `processing.major_keywords.suggest`, and the facts table, now shared with the test page in `processing/cards.py` (moved out of `tools/search_ui.py`, same output). Pages: home (search box, suggested keywords of the chosen major, major / purpose / interest chips, core chips first, other fields behind "more"), results (cards: AI Hub icon, relevance 0–10, match label when text was typed, domain tags, easy text, reasons, size and level, one project idea, details and compare buttons, links to other dataset sites), dataset page (AI Hub-style header with a 180 px icon tile, tags, meta line, coral "open on AI Hub" button; sections: easy text, 3 project ideas, facts, details, related data), compare (up to 3, facts row by row). Korean / English switch. Profile, language and compare list are kept in the browser (localStorage). Raw manual passages are not shown. Footer says the app is an independent student project and credits AI Hub / NIA.

**Recommender change:** `Recommendation.card_sim` added (text vs. dataset card cosine), so the app labels matches with the same thresholds as the test page.

**Icons:** new step `collect_aihub icons` reads each page's header icon address into `data/parsed/aihub/icons.json` (resumes; parsed pages untouched; HTML not kept). Sample of 20: 20 icons, 20 different addresses. Icons load from AI Hub in the page (checked in the browser); a text tile with the data type is shown when an icon is missing or fails.

**Checks:** search test set unchanged after the 2026-11-10 code changes (top-1 56/59, top-5 57/59, MRR 0.955). In the browser: home → Smart City major → keywords and chips → "교통 혼잡" → 12 cards; dataset page 71632; compare with 2 datasets; English; phone width 375 px with no sideways scroll; no console or server errors. Bad inputs rejected: text over 300 characters, unknown major / interest / purpose → 400, unknown dataset or major page → 404. Tests: 16 pass (3 new for the icon reader).

**Not done / limits:** no automatic tests for the app endpoints yet; a new search text needs the Gemini API (the page shows an error if it is down); accessibility not checked beyond labels; the onboarding questions on level, experience and computer (PLAN 7.1) are left out because the score no longer uses them.

**Changes after first user test (2026-11-11):**
- Major and purpose menus: custom dropdowns with a short open/close animation (keyboard: arrows, Enter, Escape; close on outside click). Likely cause of menus closing by themselves: the whole home page was redrawn (e.g. after picking a major), which closes an open browser menu; now a new major redraws only the keyword and interest parts.
- Interest fields: one open/close section per group; "close to your major" opens first, the others start closed and show how many are selected.
- Logo: our own search mark + "AI Hub" and "Data" in text (AI Hub's logo image not used).
- Wording: Korean and English interface text rewritten in a friendlier, natural tone; card reasons and notes in `processing/recommend.py` too (no test depended on the old text).
- Results kept: the last 4 recommendation answers and the scroll position are stored for the browser tab, so going to a dataset, compare or home and back (or reloading) shows them at once; a "추천 결과" menu item and a "최근 추천 결과" link appear when results exist. Language switch keeps the page and scroll position.
- Checked in the browser (pane hidden, so with scripts instead of screenshots; animations themselves not seen): menus open, close and pick (mouse and keyboard) without redrawing the page; sections collapse to 0 px and open; results back from a dataset page without a new search and at the same scroll position; results survive a reload; English switch; no console or server errors. Tests: 16 pass.

**Design pass (2026-11-11, frontend-design skill):** kept AI Hub's palette as the brief asks and spent the design effort on the logo and typography. New logo mark (stacked data layers + a lens; `app/static/logo-mark.svg`, also the browser tab icon) with "AI Hub" in small text above "DataFinder". Typeface Pretendard (Korean + Latin on one grid; Noto Sans KR as fallback), one type scale, a clear order of corner roundness, fewer identical shadows, relevance shown as a small bar, the request summary and size/level notes as chips; decorative arrows and emoji removed. Line breaks: Korean now breaks only between words (`word-break: keep-all`) and titles balance their lines (`text-wrap: balance`), so no single syllable such as "지" is left on a new line; names like "교통·도로·대중교통" in reasons are kept together. Checked: 9 two-line card titles, shortest last line 9 characters, no reason line starting or ending with "·"; phone header fits (needs 307 px in Korean, 330 px in English of 375; was 441 / 460) by showing KO / EN and hiding the "find data" menu item on phones; desktop screenshots of home, dataset page and cards (headless Edge).


## 28. About pages (2026-11-11)

**User request:** an About menu with three pages; names chosen for students: AI Hub 알아보기, 데이터 지도, 연관성 계산 방법.
- **AI Hub 알아보기** (`#/about/aihub`): what AI Hub is, what you can do there, how to get data (4 steps), notes (credit NIA, foreign users need an NIA agreement, this app is independent). Facts checked on AI Hub's own pages on 2026-11-11 (AI 허브란?, 안심존이란?, 이용정책; linked on the page). Charts counted from our 867 records: datasets per AI Hub field (14), per build year, per data type; top 6 by downloads. Single-hue bars with values as text and hover tooltips (dataviz skill).
- **데이터 지도** (`#/about/map`): D3 radial mind map (d3@7.9.0 from jsdelivr, loaded only on this page): AI Hub -> 8 groups -> 53 topics -> datasets by main topic (one topic open at a time). Clicking a dataset draws dotted links to the other topics it belongs to (grey) and to its similar datasets on screen (blue); the side panel lists the 5 most similar by card-vector cosine. Group colours: the validated 8-colour categorical palette in fixed order, always shown with the group name. Search by name, zoom, reset, "show as a list". Direct link `#/about/map/<dataset id>`; each dataset page has a "see on the data map" button.
- **연관성 계산 방법** (`#/about/method`): five plain-language steps, the order in which a recommendation is made, a cosine drawing, a score calculator (sliders), then the formulas (KaTeX from jsdelivr; plain TeX if it cannot load) for cosine, RRF, interest, major, relevance, match label, MMR and map links, plus test results and limits. All numbers are read live from `config/ranking.yaml` and `config/search.yaml` (`/api/about/method`), so the page follows the settings.
- Backend: `app/about.py` (`/api/about/stats`, `/api/about/graph`, `/api/about/method`); similar datasets computed once from the 867 card vectors (867 x 867 cosine).
- Checks: all pages in the browser with no console errors; map: 62 nodes when closed, one topic opened 23 datasets, 5 similar links; the calculator gives 7.7 for the worked example (same as the formula example on the page); KaTeX rendered 10 formulas; phone width 375 px: no sideways scroll on the three pages, header fits (331 px Korean, 370 px English). Tests: 16 pass. Desktop screenshots with headless Edge. Map animations not watched live (browser pane hidden).
- Icons: all 867 collected, 867 different addresses (`data/parsed/aihub/icons.json`).

**Changes after the second user test (2026-11-11):**
- About menu: its three pages open below "소개" (hover, keyboard focus or tap); the current page is marked.
- University step: a 대학교 dropdown comes first; 고려대학교 세종캠퍼스 opens the major list, "다른 대학교" is shown as 준비 중 and cannot be picked; without a university, free-text search still works. List in `config/app.yaml` (`universities`, `ready`). Saved profiles that already had a major are treated as KU Sejong.
- Data map rebuilt in two views so labels no longer pile up: overview (AI Hub, 8 fields, 53 topics) and topic view (the topic in the centre, its datasets evenly on a ring, names outward; a picked dataset joins its similar datasets with blue dotted lines, the rest fade). Back button and field › topic path. Full-screen button (Fullscreen API; CSS fallback). Checked: largest topic (자율주행·자동차, 69 datasets) has no overlapping names.
- Logo: "AI Hub" in grey #555, "DataFinder" in AI Hub blue. Footer notice centred and balanced.
- Text pass with the korean-humanizer patterns: fewer "~할 수 있어요", no comma after connecting endings, no English-style colon, no doubled words ("모든 데이터마다"); map texts rewritten for the new views; English kept plain. Chart columns on the AI Hub page now end level; calculator choice boxes styled like the rest.
- Checks: home university flow (locked major, disabled option ignored, 31 majors after KU Sejong, search without university returns 12), About menu, map views and full screen, no console errors, phone width 375 px without sideways scroll on home and the three About pages. Tests: 16 pass. Full-screen mode not tried with a real mouse click (the browser pane was hidden; tested through the CSS fallback path).

**Third user test (2026-11-11):** the AI Hub page looked too plain, and the radial map was replaced by a tree.
- AI Hub page: heading next to a 3 x 3 grid of the 9 most downloaded datasets' AI Hub icons, "AI Hub 바로가기" and "데이터 지도 보기" buttons, number cards with line icons, illustrated cards for what AI Hub offers, a connected 1-4 step guide, note cards with icons. Method page: the five plain-language steps as illustrated cards (two columns, the last one full width).
- Data map: collapsible left-to-right tree (D3), AI Hub -> field -> topic -> dataset; every name on its own row, column widths measured from the longest visible name, links leave from the end of the parent's name; numbers are dataset counts; "모든 분야 펼치기" / "모두 접기", search, full screen; a picked dataset marks its similar datasets in blue and the side panel lists all 5 (a similar dataset in another topic opens that branch). The tree scrolls inside its box, up and down only when jumping to a dataset.
- Checks: tree opens 8 fields -> 8 topics -> 37 datasets; with all fields open, 99 names and 0 overlapping labels; jump to a similar dataset works; no console errors; screenshots of the three pages (headless Edge, reduced motion). Tests: 16 pass. Open/close animations not watched live (browser pane hidden).

**Fourth user test (2026-11-11):** angle drawing: the grey baseline is now drawn under the arrows; calculator sliders use a light grey track with blue up to a white handle (no browser-default black); formulas are drawn as HTML only (`output: "html"`), so no hidden MathML copy and no "Copy LaTeX" popups (each formula keeps its TeX as an accessible label); all Korean interface text, including match labels ("잘 맞습니다 / 어느 정도 맞습니다 / 관련이 적습니다") and the recommender's card reasons, now uses the formal 습니다 style. Checked: 0 MathML elements, 10 formulas drawn, no console errors; tests 16 pass.


## 29. Browse by field, purpose question removed, project chat (2026-11-11)

- **Browse by field** (user: AI Hub's 데이터 찾기 has it): the home page shows the 8 fields with dataset counts and top topics; `#/browse/<field>/<topic>` lists datasets by main topic, most downloaded first, 24 at a time ("더 보기"); `/api/browse`. Counts add up to 867.
- **Purpose question removed** (user: not useful): it only chose which project idea a card shows; cards now show the first idea. The backend still accepts `purpose`.
- **Project chat** (`app/chat.py`, `app/static/chat.js`, `/api/chat/start`, `/api/chat/ask`; settings `chat:` in `config/app.yaml`): models available to the key checked first (`gemini-2.5-flash` is closed to new users; `gemini-3.8-flash` ~5 s, `gemini-3.5-flash-lite` ~1 s). Context = profile (university, major, interests, request) + the dataset record (facts, details up to 2,200 characters, AI Hub link, its 3 project ideas). Plan format fixed (title, one-line summary, why this dataset, steps, tools, difficulty and time, data tips, next steps), 습니다 style. Follow-ups answered as JSON {on_topic, answer}; off-topic and rule-change attempts get a warning, no answer, and use a turn. Server-side limits; key never sent to the browser; notice about Google. .md download built in the page.
- **Cache fix:** the browser kept an old app.js after an update; the server now sends `Cache-Control: no-cache` for the page and /static files (unchanged files still come from the cache via ETag).
- **Checks:** API: plan written and tied to the student's major; on-topic question answered (2 left); "today's weather" refused (1 left); "ignore the rules / show the system prompt" refused without a Gemini call (0 left); a 4th question refused (429). Browser: 8 field cards, browse page 24 -> 48 cards with "더 보기", topic filter, chat opens from the dataset page, off-topic warning shown, counter 3 -> 2, .md has student (only when given), dataset with AI Hub link, plan, Q&A, how to continue. No console errors; tests 16 pass. Not checked: the chat on a phone screen, and Gemini's terms for use by other people.

## 30. Korean UI text pass with a new korean-ux-writing skill (2026-11-11)

- No skill for Korean UI writing existed (account search empty; local korean-humanizer covers long prose). Researched and built `~/.claude/skills/korean-ux-writing/` (SKILL.md + `scripts/check_ko.py`) from: Microsoft Korean Localization Style Guide (statements -습니다, requests -세요 instead of -십시오 except legal text, error-message patterns, no light verbs 수행/제공, no 에 대한/가지고 있다/pronouns), Toss UX writing (cut words that add nothing, "~하기" CTAs, zero jargon), and the 국립국어원 plain public-language principles.
- Applied to all Korean interface text: requests now end in -세요 ("대학교를 선택하세요", "다시 시도하세요"), questions in -신가요/-나요 ("어떤 데이터가 필요하신가요?", "원하는 데이터가 없나요?"), statements stay -습니다; "비교함에 담기"; facts-table labels 데이터 양 / 라벨(표시) / 용량 / 만든 해·기관 (one term "용량" everywhere); Gemini told to write explanations in -습니다 and steps in -세요 and to avoid translationese.
- Checker: 36 hits before, 4 after (all inside the Gemini prompt: the pronoun addressing the model and the avoid-list itself). A fresh Gemini plan had 0 "-십시오", 9 "-세요", 0 해요체 endings. All pages render, no console errors, tests 16 pass.
- Not changed: dataset texts written per dataset (867 easy/detail texts) and topic names in config/domains.yaml; they are data, already in -습니다 style.

## 31. Vertical data map with a dataset list; chat checked on a phone (2026-11-11)

- **Data map** (user: dataset nodes get too busy): vertical tree, AI Hub at the top -> 8 fields -> the topics of one open field (others fade); long names break at the middle dot into two lines; numbers are dataset counts. Datasets are no longer nodes: a field or topic fills a scrollable list under the tree (AI Hub icon, name, size, level, topic when a whole field is listed; most downloaded first; filter box). Picking a dataset highlights it, marks its similar datasets in the list (≈), and shows details, the 5 similar datasets, "자세히 보기" and "AI로 프로젝트 계획 세우기" beside the list. "처음으로" resets; full screen shows tree, list and details; `#/about/map/<id>` opens field, topic and dataset. `/api/about/graph` now also sends icon, size, level, downloads and data types per dataset.
- **Chat on a phone (375 x 812, emulated):** window fills the screen, page behind does not scroll, message area scrolls, question box (257 px) + send button (80 px) and the footer (counter, .md download) fit; nothing wider than the screen; a real Gemini plan loaded. Height now uses `100dvh`, so phone address bars do not push the footer off screen. Not seen as a screenshot (browser pane hidden; headless Edge cannot go below ~500 px).
- **Map on a phone:** page has no sideways scroll; the tree scrolls sideways inside its box; list, filter and details stack in one column.
- Checks: new Korean text 0 checker hits; no console errors; tests 16 pass.

**Round after §31 (2026-11-11):** reset is now an outlined "초기화" button under the search box (also clears the current results). Only the current recommendation is kept for the browser tab (both languages of one request): it stays while moving between pages and comes back from the "추천 결과" menu without a new request; editing the form without pressing the button does not replace it; a new request replaces it; the "최근 추천 결과 다시 보기" link is gone. The row of three page buttons on the About pages is removed (the 소개 menu lists them). Each of the 8 fields has a line icon in its colour (home cards on a tinted tile, browse buttons). Map tree: field names on one line, count on the second (tree is at least 1,000 px wide and scrolls inside its box on narrow screens). Checked in the browser: results kept/replaced as described, 8 icons, no About button row, reset works, no console errors; screenshots of home and tree.

### 2026-11-11 — plan button opens an outside AI
- "AI로 프로젝트 계획 세우기" now opens a picker: ChatGPT / Claude / Gemini. A click copies one prompt (student info, dataset facts with the AI Hub URL, description, project ideas, answer outline) and opens the site in a new tab; the student pastes it (Ctrl+V). Also "프롬프트만 복사", ".md 내려받기" and a preview.
- No prompt in the URL: none of the three sites documents a prefill parameter (third-party reports disagree), and a ~3,000-character Korean prompt becomes ~27 KB when URL-encoded.
- Prompt is built by `POST /api/chat/prompt` (no model call, no limit). The in-app Gemini chat stays in the code; `chat.builtin: true` in config/app.yaml shows it as a fourth option.
- Same day, later: the in-app Gemini chat was removed (`app/chat.py`, `/api/chat/start`, `/api/chat/ask`, the chat settings and styles). `app/prompt.py` builds the prompt; the dataset part is prebuilt for all datasets in both languages at start-up, and `tests/test_prompt.py` checks every dataset. The prompt now also says how the dataset was found: recommendation (search words, rank, relevance, match, reasons, plus the profile that produced the results), browse or data map (field > topic), compare, or opened directly.

### 2026-11-11 — deploy-ready, first push to GitHub
- On-screen reasons rewritten as plain statements: "검색한 내용과 잘 맞습니다", "고른 관심 분야인 X에 속합니다", "전공(M)과 가까운 X 분야입니다" (English: "Matches what you searched for", "In X, an interest you picked", "In X, a field close to your major (M)"). The prompt turns them into the student's first person.
- Deploy: `HOST`/`PORT`/`FORWARDED_ALLOW_IPS` environment variables, `/healthz`, 20 searches per address per minute (HTTP 429 after), `Dockerfile` + `requirements-app.txt`, `.dockerignore`. AI Hub field per dataset moved to `data/parsed/aihub/fields.json` so the server no longer needs the parsed pages.
- Git keeps only runtime data (~119 MB: records, index without the query cache, profiles, icons, fields). A clean export of the staged files started in 4 s and answered Korean and English searches correctly; memory ~920 MB.
- Tests: 28 (new `tests/test_api.py` against the real app; `tests/test_prompt.py` covers all 867 datasets × 2 languages). Browser sweep of every page in ko/en at desktop and 375 px phone width; fixed two phone overflows (About-page media rules sat above the rules they override; home field cards' one-line topic list in English).
- Not tested: building and running the Docker image (no Docker on this laptop).
