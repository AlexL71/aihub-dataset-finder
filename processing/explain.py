"""Easy explanations for dataset cards: input packs for Claude and validation of the written files.

Each dataset gets data/enriched/explanations/<id>.json, written by Claude (user's plan) from the compact pack
this script prints. Format decided with the user 2026-11-02 (docs/PHASE0_FINDINGS.md §22):
  easy_ko / easy_en      2 sentences in everyday words, almost no numbers: what was recorded, how it is marked,
                         what you could build with it
  detail_ko / detail_en  professional paragraph ("자세히"): counts, formats, labels, baseline, caveats
  amount_ko / amount_en  short amount line for the facts table
  labels_ko / labels_en  labels in plain words for the facts table

Usage (project root):
    python -m processing.explain pack --ids 59 74       # print the packs (input for writing)
    python -m processing.explain next --n 25            # ids without an explanation yet, and their packs
    python -m processing.explain validate               # check all written files
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECORDS = ROOT / "data" / "enriched" / "aihub"
PAGES = ROOT / "data" / "parsed" / "aihub" / "pages"
EXPLAIN = ROOT / "data" / "enriched" / "explanations"

FIELDS = ["easy_ko", "easy_en", "detail_ko", "detail_en", "amount_ko", "amount_en", "labels_ko", "labels_en"]
EASY_CHARS = {"easy_ko": (60, 330), "easy_en": (100, 560)}      # 2 sentences, roughly
DETAIL_MIN = {"detail_ko": 120, "detail_en": 200}
EASY_MAX_NUMBERS = 2          # numbers like "400", "3.7TB" allowed in an easy text (CO2, 3D, 5단계 style kept low)
PURPOSE_CHARS = 300           # characters of the page's 구축목적 shown in the pack
_NUMBER = re.compile(r"\d[\d,.]*")
# Email needs letters after "@" and a letter TLD, so metric names like "mAP@0.5" are not flagged.
_CONTACT = re.compile(r"[A-Za-z][\w.-]*@[A-Za-z][\w-]*\.[A-Za-z]{2,}|\b0\d{1,2}-\d{3,4}-\d{4}\b")


def _all_ids() -> list[str]:
    return sorted((p.stem for p in RECORDS.glob("*.json")), key=int)


def build_pack(dataset_id: str) -> str:
    r = json.loads((RECORDS / f"{dataset_id}.json").read_text(encoding="utf-8"))
    pg = json.loads((PAGES / f"{dataset_id}.json").read_text(encoding="utf-8"))
    ov = pg["sections"].get("데이터 개요", "")
    k = ov.find("구축목적")
    purpose = " ".join(ov[k:k + PURPOSE_CHARS].split()) if k >= 0 else ""
    base = "; ".join(f"{b['task']}: {b['model']} {b['metric']} {b['value']}" for b in r["baseline"]) or "-"
    lines = [
        f"===== {dataset_id} | {pg['title']} | {r['title_en']}",
        f"summary_ko: {r['summary_ko']}",
        f"contents_ko: {r['contents_ko']}",
        f"scale_ko: {r['scale_ko']}",
        f"modalities: {', '.join(r['modalities'])} | formats: {', '.join(r['file_formats'])} | labels: {', '.join(r['labels'])}",
        f"classes: {', '.join(r['classes_example'][:12]) or '-'}",
        f"baseline: {base}",
        f"caveats: {' / '.join(r['caveats_ko']) or '-'}",
        f"doc_used: {r['doc_used']}",
    ]
    if purpose:
        lines.append(f"purpose: {purpose}")
    return "\n".join(lines)


def validate_file(path: Path) -> list[str]:
    try:
        x = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [f"invalid JSON: {e}"]
    errs = []
    if str(x.get("dataset_id")) != path.stem:
        errs.append("dataset_id does not match file name")
    for f in FIELDS:
        if not isinstance(x.get(f), str) or not x[f].strip():
            errs.append(f"missing {f}")
    if errs:
        return errs
    for f, (lo, hi) in EASY_CHARS.items():
        if not lo <= len(x[f]) <= hi:
            errs.append(f"{f} length {len(x[f])} not in {lo}-{hi}")
        if len(_NUMBER.findall(x[f])) > EASY_MAX_NUMBERS:
            errs.append(f"{f} has {len(_NUMBER.findall(x[f]))} numbers (max {EASY_MAX_NUMBERS}); move them to the table")
    for f, lo in DETAIL_MIN.items():
        if len(x[f]) < lo:
            errs.append(f"{f} shorter than {lo}")
    if any(_CONTACT.search(x[f]) for f in FIELDS):
        errs.append("contains an email or phone number")
    if re.search(r"[가-힣]", x["easy_en"] + x["detail_en"] + x["amount_en"] + x["labels_en"]):
        errs.append("English field contains Hangul")
    return errs


def cmd_validate() -> None:
    files = sorted(EXPLAIN.glob("*.json"), key=lambda p: int(p.stem))
    bad = 0
    for p in files:
        if errs := validate_file(p):
            bad += 1
            print(f"{p.stem:>6s} " + "; ".join(errs))
    print(f"explanations: {len(files)}/{len(_all_ids())}, with problems: {bad}")
    sys.exit(1 if bad else 0)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cmd", choices=["pack", "next", "validate"])
    p.add_argument("--ids", nargs="+")
    p.add_argument("--n", type=int, default=25)
    a = p.parse_args()
    if a.cmd == "validate":
        cmd_validate()
    elif a.cmd == "pack":
        if not a.ids:
            p.error("pack needs --ids")
        print("\n\n".join(build_pack(i) for i in a.ids))
    else:
        done = {x.stem for x in EXPLAIN.glob("*.json")}
        todo = [i for i in _all_ids() if i not in done]
        print(f"# explained {len(done)}/{len(_all_ids())}; next {min(a.n, len(todo))}: {' '.join(todo[:a.n])}\n")
        print("\n\n".join(build_pack(i) for i in todo[:a.n]))


if __name__ == "__main__":
    main()
