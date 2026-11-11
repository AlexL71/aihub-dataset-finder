# Search evaluation sets

| File | Role | Questions |
|---|---|---|
| `queries_dev_v0.csv` | **dev set**: used to choose search settings (`config/search.yaml`) | 28 + 4 no-match |
| `queries_test_v1.csv` | **test set**: held out; run once per settings change to report results | 59 + 17 no-match |

Columns: `query`, `expected_id`, `note`.
- `expected_id`: every dataset that is a correct answer, separated by `|`. Empty means AI Hub has no dataset for this request.
- Correct answers were found from the records, titles, class lists and domain tags (`data/enriched/`), **not** with the search engine, so the test does not grade itself.
- A no-match question was checked against the full text of all 867 pages and manuals before it was added.

Run:

```bash
.venv/Scripts/python -m processing.search --eval eval/queries_test_v1.csv
```

Metrics: top-1, top-5, and MRR (mean of 1/rank of the first correct dataset; 0 when none is in the top 5).

Rules:
- Choose settings on the dev set only. If the test set is used to choose, it stops being a fair test.
- An answer key may be fixed after a run only when the key was wrong (a dataset that clearly fits was missed). Write the reason in `note`. The four fixes so far (2026-11-01) are marked "added/moved after the test run".
- Both sets were written by Claude, who also tagged the data. Before the pilot, add questions written by other people (students, the user).
