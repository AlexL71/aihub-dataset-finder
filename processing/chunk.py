"""Chunks and dataset cards for the search index.

Two kinds of search text are written to data/index/:
  cards.jsonl   one text per dataset, built from the enriched record (title, summary, keywords, classes,
                domains, tasks). Used to rank datasets for recommendations.
  chunks.jsonl  pieces of the parsed AI Hub page sections and the 데이터 설명서 text. Used for detailed matches
                and, later, the one-question box on a dataset card.

Chunking works on lines: lines are collected until `target_chars`; a table (consecutive lines with " | ")
is kept whole when it fits `max_chars`, otherwise it is split by rows with its header row repeated.
Lines already shown (page -> manual) and contact lines are dropped, as in the enrichment packs; so are
change-history rows and "... 다운로드" button labels (_NOISE).

Usage (project root):
    python -m processing.chunk --ids 59 74 146        # these datasets only
    python -m processing.chunk                        # all datasets
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
from pathlib import Path

import yaml

from processing.domains import load_domains, load_tags
from processing.enrich_datasets import DOCS, PAGES, RECORDS, SKIP_SECTIONS, _all_ids, _clean_lines
from processing.search_config import load_search_cfg

ROOT = Path(__file__).resolve().parents[1]
TASKS_FILE = ROOT / "config" / "tasks.yaml"


# Lines with no search value: the page's change-history tables and "download" button labels.
_NOISE = re.compile(
    r"^(데이터 변경이력|데이터 히스토리|버전 \| 일자 \| 변경내용.*|일자 \| 변경내용.*"
    r"|v?\d+\.\d+(\.\d+)? \| \d{4}-\d{2}-\d{2}.*|\d{4}-\d{2}-\d{2} \| .*(개방|변경|삭제|추가|수정).*"
    r"|.{0,30}다운로드)$")


def _is_table_row(line: str) -> bool:
    return line.startswith("|") or " | " in line


def _drop_noise(lines: list[str]) -> list[str]:
    return [l for l in lines if not _NOISE.match(l)]


def _blocks(lines: list[str]) -> list[tuple[bool, list[str]]]:
    """Group lines into (is_table, lines) blocks."""
    out: list[tuple[bool, list[str]]] = []
    for l in lines:
        t = _is_table_row(l)
        if out and out[-1][0] == t:
            out[-1][1].append(l)
        else:
            out.append((t, [l]))
    return out


def split_lines(lines: list[str], c: dict) -> list[str]:
    """Cut a list of lines into chunk texts (see module docstring)."""
    target, cap, overlap = c["target_chars"], c["max_chars"], c["overlap_lines"]
    chunks: list[list[str]] = []
    cur: list[str] = []
    n_new = 0                                       # lines in `cur` that are not overlap from the last chunk

    def size(ls: list[str]) -> int:
        return sum(len(x) + 1 for x in ls)

    def close(keep_tail: bool = False) -> None:
        nonlocal cur, n_new
        if n_new:
            chunks.append(cur)
        tail = [x for x in cur[-overlap:] if not _is_table_row(x)] if keep_tail and overlap else []
        cur, n_new = list(tail), 0

    piece = cap // 2                                # very long lines are cut into pieces of this size
    lines = [l[i:i + piece] for l in lines for i in range(0, len(l), piece)]
    for is_table, block in _blocks(lines):
        if is_table:
            if size(block) <= cap:
                if size(cur) + size(block) > cap:
                    close()
                cur.extend(block)
                n_new += len(block)
            else:                                   # long table: rows in parts, short header repeated
                close()
                head = [block[0]] if len(block[0]) <= cap // 4 else []
                part = list(head)
                for row in block[len(head):]:
                    if size(part) + len(row) + 1 > target and len(part) > len(head):
                        chunks.append(part)
                        part = list(head)
                    part.append(row)
                if len(part) > len(head):
                    chunks.append(part)
            if size(cur) >= target:
                close()
            continue
        for l in block:
            if size(cur) + len(l) + 1 > cap:
                close()
            cur.append(l)
            n_new += 1
            if size(cur) >= target:
                close(keep_tail=True)
    close()
    texts = ["\n".join(x) for x in chunks]
    merged: list[str] = []                         # fold tiny leftovers into the previous chunk
    for t in texts:
        if merged and len(t) < c["min_chars"] and len(merged[-1]) + len(t) + 1 <= cap:
            merged[-1] += "\n" + t
        else:
            merged.append(t)
    return merged


def dataset_chunks(dataset_id: str, c: dict) -> list[dict]:
    pg = json.loads((PAGES / f"{dataset_id}.json").read_text(encoding="utf-8"))
    title = pg["title"]
    seen: set[str] = set()
    out: list[dict] = []

    def add(source: str, section: str, lines: list[str]) -> None:
        for t in split_lines(lines, c):
            n = len(out)
            out.append({"chunk_id": f"{dataset_id}:{n}", "dataset_id": dataset_id, "source": source,
                        "section": section, "text": t,
                        "embed_text": f"{title} | {section}\n{t}"})

    for name, text in pg["sections"].items():
        if name in SKIP_SECTIONS:
            continue
        lines = _drop_noise(_clean_lines(text, seen))
        if sum(len(l) for l in lines[1:]) >= c["min_chars"]:     # lines[0] is the section heading
            add("page", name, lines)
    dp = DOCS / f"{dataset_id}.json"
    if dp.exists():
        d = json.loads(dp.read_text(encoding="utf-8"))
        add("manual", "데이터 설명서", _drop_noise(_clean_lines(d["text"], seen)))
    return out


def dataset_card(dataset_id: str, domains_cfg: dict, tasks_cfg: dict, tags: dict[str, list[str]]) -> dict:
    r = json.loads((RECORDS / f"{dataset_id}.json").read_text(encoding="utf-8"))
    pg = json.loads((PAGES / f"{dataset_id}.json").read_text(encoding="utf-8"))
    doms = [domains_cfg["domains"][d] for d in tags[dataset_id]]
    tasks = [tasks_cfg["tasks"][t] for t in r["tasks"]]
    parts = [
        f"{pg['title']} / {r['title_en']}",
        r["summary_ko"], r["summary_en"], r["contents_ko"],
        "분야 / domains: " + ", ".join(f"{d['ko']} ({d['en']})" for d in doms),
        "할 수 있는 일 / tasks: " + ", ".join(f"{t['ko']} ({t['en']})" for t in tasks),
        "데이터 종류 / modalities: " + ", ".join(r["modalities"]),
        "키워드: " + ", ".join(r["keywords_ko"]), "keywords: " + ", ".join(r["keywords_en"]),
        "주제 / topics: " + ", ".join(f"{t['ko']} ({t['en']})" for t in r["topics"]),
    ]
    if r["classes_example"]:
        parts.append("클래스 예시 / classes: " + ", ".join(r["classes_example"]))
    if r["labels"]:
        parts.append("라벨 / labels: " + ", ".join(r["labels"]))
    return {"dataset_id": dataset_id, "text": "\n".join(p for p in parts if p)}


def build(ids: list[str]) -> tuple[list[dict], list[dict]]:
    cfg = load_search_cfg()
    domains_cfg = load_domains()
    tasks_cfg = yaml.safe_load(TASKS_FILE.read_text(encoding="utf-8"))
    tags = load_tags()
    chunks = [ch for i in ids for ch in dataset_chunks(i, cfg["chunk"])]
    cards = [dataset_card(i, domains_cfg, tasks_cfg, tags) for i in ids]
    out = cfg["paths"]["index_dir"]
    out.mkdir(parents=True, exist_ok=True)
    for name, rows in (("chunks.jsonl", chunks), ("cards.jsonl", cards)):
        (out / name).write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in rows), encoding="utf-8")
    return chunks, cards


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ids", nargs="+", help="dataset ids (default: all)")
    a = p.parse_args()
    ids = a.ids or _all_ids()
    chunks, cards = build(ids)
    lens = [len(c["embed_text"]) for c in chunks]
    per = [sum(c["dataset_id"] == i for c in chunks) for i in ids]
    print(f"{len(ids)} datasets -> {len(cards)} cards, {len(chunks)} chunks "
          f"(page {sum(c['source'] == 'page' for c in chunks)}, manual {sum(c['source'] == 'manual' for c in chunks)})")
    print(f"chunk chars: median {int(statistics.median(lens))}, max {max(lens)}; "
          f"chunks per dataset: median {int(statistics.median(per))}, max {max(per)}")
    total = sum(lens) + sum(len(c["text"]) for c in cards)
    print(f"characters to embed: {total:,}")


if __name__ == "__main__":
    main()
