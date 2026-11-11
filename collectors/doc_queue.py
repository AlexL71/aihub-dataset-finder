"""Helper for downloading 데이터 설명서 through the user's logged-in Chrome.

AI Hub refuses document downloads from scripts, so the files are fetched inside a logged-in
AI Hub tab (Claude in Chrome) and saved by Chrome as aihub_<ID>_data_manual.<ext>.
This module prepares the work list and imports the finished downloads.

Usage (project root):
    python -m collectors.doc_queue build                 # -> data/doc_queue.json (datasets still missing a manual)
    python -m collectors.doc_queue import [--downloads DIR]   # move finished files into data/raw/aihub/docs/<ID>/
    python -m collectors.doc_queue status
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DOCS = DATA / "raw" / "aihub" / "docs"
PAGES = DATA / "parsed" / "aihub" / "pages"
QUEUE = DATA / "doc_queue.json"
_NAME = re.compile(r"^aihub_(\d+)_data_manual(\.[A-Za-z0-9]+)$")
DOC_TYPE = "dataMnlFileSn"  # 데이터 설명서


def have_manual(ds: str) -> bool:
    return any((DOCS / ds).glob("data_manual.*"))


def build() -> None:
    queue, no_link = [], []
    for pj in sorted(PAGES.glob("*.json"), key=lambda p: int(p.stem)):
        ds = pj.stem
        if have_manual(ds):
            continue
        links = [l for l in json.loads(pj.read_text(encoding="utf-8")).get("doc_links", []) if l["type"] == DOC_TYPE]
        if links:
            queue.append({"id": ds, "href": links[0]["href"]})
        else:
            no_link.append(ds)
    QUEUE.write_text(json.dumps(queue, ensure_ascii=False), encoding="utf-8")
    (DATA / "doc_no_link.txt").write_text("\n".join(no_link), encoding="utf-8")
    print(f"queue: {len(queue)} datasets -> {QUEUE}")
    print(f"no 데이터 설명서 link on page: {len(no_link)} -> data/doc_no_link.txt")


def import_downloads(downloads: Path) -> None:
    log = DATA / "doc_import_log.csv"
    new = not log.exists()
    moved = 0
    with open(log, "a", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        if new:
            w.writerow(["time", "dataset_id", "file", "bytes"])
        for f in sorted(downloads.glob("aihub_*_data_manual.*")):
            m = _NAME.match(f.name)
            if not m:
                continue  # e.g. "aihub_75_data_manual (1).pdf" duplicates are left for manual review
            ds, ext = m.groups()
            target = DOCS / ds / f"data_manual{ext.lower()}"
            target.parent.mkdir(parents=True, exist_ok=True)
            size = f.stat().st_size
            shutil.move(str(f), target)
            w.writerow([datetime.now().isoformat(timespec="seconds"), ds, target.name, size])
            moved += 1
    print(f"moved {moved} files into {DOCS}")


def status() -> None:
    total = len(list(PAGES.glob("*.json")))
    done = sum(1 for p in PAGES.glob("*.json") if have_manual(p.stem))
    print(f"pages parsed: {total}; datasets with 데이터 설명서: {done}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cmd", choices=["build", "import", "status"])
    p.add_argument("--downloads", type=Path, default=Path.home() / "Downloads")
    a = p.parse_args()
    if a.cmd == "build":
        build()
    elif a.cmd == "import":
        if not a.downloads.is_dir():
            sys.exit(f"downloads folder not found: {a.downloads}")
        import_downloads(a.downloads)
    else:
        status()


if __name__ == "__main__":
    main()
