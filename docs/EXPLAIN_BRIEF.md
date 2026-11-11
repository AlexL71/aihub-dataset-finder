# Brief: easy explanations for dataset cards

Approved by the user 2026-11-02 (style of the 20 samples in `data/enriched/explanations/`; see `docs/PHASE0_FINDINGS.md` §22). Use this brief for the full run and for any new dataset later.

## Loop

Work from the project root on Windows; set `PYTHONIOENCODING=utf-8`.

```bash
.venv/Scripts/python -m processing.explain next --n 25     # next 25 ids without an explanation + their packs
# write data/enriched/explanations/<id>.json for each (see format), e.g. with one small Python script per batch
.venv/Scripts/python -m processing.explain validate        # must end with "with problems: 0"
```

- Write files with a Python script file (not a shell heredoc: apostrophes in the text break the shell).
- Never edit `data/enriched/aihub/*.json` or other data; only create files in `data/enriched/explanations/`.
- Read the 2–3 sample files first (for example 71408, 576, 71969) and copy their tone.
- If the pack is unclear, read more of `data/parsed/aihub/pages/<id>.json` (and `data/parsed/aihub/docs/<id>.json` if needed). Do not invent facts.

## Format (one JSON file per dataset)

```json
{
 "dataset_id": "71408",
 "easy_ko": "...", "easy_en": "...",
 "detail_ko": "...", "detail_en": "...",
 "amount_ko": "...", "amount_en": "...",
 "labels_ko": "...", "labels_en": "...",
 "status": "full-run-2026-11-02"
}
```

**easy_ko / easy_en: the most important part.** The reader is a first-year student from a non-AI major.
- Two sentences. Sentence 1: what was recorded or photographed, about what or whom, and what is marked on it, in everyday words ("사진마다 ~를 표시한 데이터입니다"). Sentence 2: what you could build with it ("~하는 앱/AI를 만들 수 있습니다").
- At most 2 numbers, and only if they help understanding. No sizes, counts, file formats, model names or metrics: those go in the table and the detail part.
- No jargon: write "물체 위치에 상자를 표시" instead of "바운딩박스", "몸의 주요 점" instead of "키포인트", "글로 바꾸기" instead of "전사". Avoid English loanwords where Korean words exist.
- Make confusing names clear (for example 71969 "K-stock" = stock photos, not the stock market).
- easy_en says the same thing in plain English (no Hangul).

**detail_ko / detail_en ("자세히"):** professional paragraph, 3–5 sentences. Collection method, counts and units, file formats, label types (technical terms are fine here), classes, baseline model and metric, important caveats (very large size, class imbalance, page-only record, augmentation leakage, personal data). Take numbers only from the pack.

**amount_ko / amount_en:** one short line for the table, for example "이미지 40만 장, 센서·측정 기록 약 44.6만 건". Round big numbers (만/억; k/M).

**labels_ko / labels_en:** what is marked, in plain words, for example "상자 표시, 몸의 주요 점(키포인트), 센서 값".

## Checks the validator runs

All 8 fields are present; easy_ko 60–330 characters, easy_en 100–560; at most 2 numbers per easy text; detail long enough; no email or phone number; no Hangul in English fields; `dataset_id` matches the file name.
