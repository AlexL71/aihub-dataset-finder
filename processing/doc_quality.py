"""Quality report for parsed 데이터 설명서 (output of processing.parse_docs).

Flags (thresholds below):
  missing      raw manual exists but no parsed JSON (parse failed)
  too_short    fewer than MIN_CHARS characters of text
  low_korean   Hangul share of letters below MIN_HANGUL (text may be garbled or mostly code/English)
  broken_lines share of very short lines above MAX_SHORT (layout broke into fragments)
  no_tables    no table found (these manuals are normally table-based)

Usage (project root):
    python -m processing.doc_quality
Output: data/parsed/aihub/docs_quality.csv + summary printed
"""
from __future__ import annotations

import csv
import json
import statistics
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "aihub" / "docs"
PARSED = ROOT / "data" / "parsed" / "aihub" / "docs"
OUT = ROOT / "data" / "parsed" / "aihub" / "docs_quality.csv"

MIN_CHARS = 1500
MIN_HANGUL = 0.30
MAX_SHORT = 0.30


def main() -> None:
    rows, by_fmt, flags_count = [], defaultdict(list), Counter()
    for d in sorted((p for p in RAW.iterdir() if p.is_dir()), key=lambda p: int(p.name)):
        if not any(d.glob("data_manual.*")):
            continue
        pj = PARSED / f"{d.name}.json"
        if not pj.exists():
            rows.append({"dataset_id": d.name, "format": next(d.glob("data_manual.*")).suffix,
                         "flags": "missing"})
            flags_count["missing"] += 1
            continue
        r = json.loads(pj.read_text(encoding="utf-8"))
        flags = []
        if r["n_chars"] < MIN_CHARS:
            flags.append("too_short")
        if r["hangul_ratio"] < MIN_HANGUL:
            flags.append("low_korean")
        if r["short_line_ratio"] > MAX_SHORT:
            flags.append("broken_lines")
        if r["n_tables"] == 0:
            flags.append("no_tables")
        for f in flags:
            flags_count[f] += 1
        by_fmt[r["format"]].append(r["n_chars"])
        rows.append({"dataset_id": d.name, "format": r["format"], "n_chars": r["n_chars"],
                     "n_tables": r["n_tables"], "hangul_ratio": r["hangul_ratio"],
                     "short_line_ratio": r["short_line_ratio"], "flags": ";".join(flags)})

    with open(OUT, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=["dataset_id", "format", "n_chars", "n_tables",
                                           "hangul_ratio", "short_line_ratio", "flags"])
        w.writeheader()
        w.writerows(rows)

    print(f"manuals: {len(rows)}  parsed: {len(rows) - flags_count['missing']}")
    for fmt, chars in sorted(by_fmt.items()):
        print(f"  {fmt:5s} n={len(chars):4d}  median chars={int(statistics.median(chars)):6d}  "
              f"min={min(chars)}  max={max(chars)}")
    print("flags:", dict(flags_count))
    clean = sum(1 for r in rows if not r["flags"])
    print(f"no flags: {clean}/{len(rows)}  -> {OUT}")


if __name__ == "__main__":
    main()
