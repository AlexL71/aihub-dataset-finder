"""Dataset enrichment: reading packs (input for Claude), validation and export of enriched records.

Claude (user's plan, in Claude Code) reads data/enriched/packs/<id>.md and writes
data/enriched/aihub/<id>.json with the fields in SCHEMA. Facts that a script can read exactly
(title, years, sizes, related datasets) are NOT typed by Claude: `export` merges them from the
parsed page and file tree. AI Hub's own field (데이터 영역) is not used for grouping; our own
domains (config/domains.yaml, tags in data/enriched/domain_tags.json) are merged in as "domains", and the
easy card texts (data/enriched/explanations/<id>.json, see processing/explain.py) as easy_*/detail_*/amount_*/labels_*.

Usage (project root):
    python -m processing.enrich_datasets pack --ids 75 140      # write packs for these datasets
    python -m processing.enrich_datasets next --n 10            # ids not enriched yet (+ writes their packs)
    python -m processing.enrich_datasets hints --ids 52 54      # class-like lines from full page + manual
    python -m processing.enrich_datasets validate               # check data/enriched/aihub/*.json
    python -m processing.enrich_datasets export                 # -> data/enriched/aihub_datasets.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import yaml

from processing.domains import check_all, load_tags
from processing.explain import EXPLAIN
from processing.explain import FIELDS as EXPLAIN_FIELDS
from processing.explain import validate_file as validate_explanation
from processing.major_profiles import _squeeze
from processing.parse_aihub import parse_filetree

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PAGES = DATA / "parsed" / "aihub" / "pages"
DOCS = DATA / "parsed" / "aihub" / "docs"
TREES = DATA / "raw" / "aihub" / "filetree"
PACKS = DATA / "enriched" / "packs"
RECORDS = DATA / "enriched" / "aihub"
TASKS_FILE = ROOT / "config" / "tasks.yaml"
PAGE_URL = "https://www.aihub.or.kr/aihubdata/data/view.do?currMenu=115&topMenu=100&aihubDataSe=data&dataSetSn={id}"

PAGE_CAP = 7000        # characters kept from the dataset page
DOC_CAP = 7000         # characters kept from the 데이터 설명서 (after removing lines already on the page)
TREE_FOLDERS = 25      # folder lines kept from the file tree
SKIP_SECTIONS = {"교육활용 동영상", "데이터 활용 동영상", "저작도구"}
# Lines with an email address or a phone number are dropped (contact details of builders).
# PDF text often loses the dots in emails ("name@domainkr ."), so no dot is required after "@";
# a letter after "@" keeps metric names such as "AP@50" or "HR@10".
_CONTACT = re.compile(r"[A-Za-z][\w.-]*\s*@\s*[A-Za-z][\w-]{2,}|\b0\d{1,2}[\s.)-]*\d{3,4}[\s.-]*\d{4}\b")
_EMPTY_CELLS = re.compile(r"(\|\s*){2,}")   # runs of empty table cells from Excel/HWP tables


def _clean_lines(text: str, seen: set[str]) -> list[str]:
    """Squeeze, drop contact lines and lines already shown, collapse empty table cells."""
    out = []
    for l in _squeeze(text).splitlines():
        l = _EMPTY_CELLS.sub("| ", l).strip()
        if l in seen or _CONTACT.search(l):
            continue
        seen.add(l)
        out.append(l)
    return out

# Fields Claude writes -> type. Lists must be non-empty unless listed in OPTIONAL_EMPTY.
SCHEMA = {
    "dataset_id": str, "title_en": str,
    "summary_ko": str, "summary_en": str, "contents_ko": str, "contents_en": str,
    "modalities": list, "tasks": list, "topics": list,
    "keywords_ko": list, "keywords_en": list,
    "labels": list, "file_formats": list, "scale_ko": str, "classes_example": list, "baseline": list,
    "difficulty": str, "difficulty_note_ko": str, "skills_needed_ko": list,
    "caveats_ko": list, "project_ideas": list, "doc_used": bool, "uncertain": list,
}
OPTIONAL_EMPTY = {"classes_example", "baseline", "caveats_ko", "uncertain", "file_formats"}
DIFFICULTY = {"beginner", "intermediate", "advanced"}
IDEA_LEVELS = {"beginner", "capstone", "research"}


def _controlled() -> tuple[set[str], set[str]]:
    c = yaml.safe_load(TASKS_FILE.read_text(encoding="utf-8"))
    return set(c["modalities"]), set(c["tasks"])


def _all_ids() -> list[str]:
    return sorted((p.stem for p in PAGES.glob("*.json")), key=int)


def tree_facts(dataset_id: str) -> dict | None:
    p = TREES / f"{dataset_id}.txt"
    if not p.exists():
        return None
    text = p.read_text(encoding="utf-8", errors="replace")
    t = parse_filetree(text)
    folders = [l.rstrip() for l in text.splitlines() if "─" in l and "|" not in l]
    return {"n_files": t["n_files"], "total_gb": t["total_gb"], "smallest_file_gb": t["smallest_file_gb"],
            "folders": folders[:TREE_FOLDERS], "n_folders": len(folders)}


def build_pack(dataset_id: str) -> str:
    pg = json.loads((PAGES / f"{dataset_id}.json").read_text(encoding="utf-8"))
    out = [f"# {pg['title']} ({dataset_id})",
           f"tags: {', '.join(pg['tags'])} | type: {pg['data_type']} | built: {pg['build_year']} | "
           f"updated: {pg['last_update']} | org: {pg['lead_organization']}", ""]
    tf = tree_facts(dataset_id)
    if tf:
        out += [f"## file tree: {tf['n_files']} files, {tf['total_gb']} GB, smallest file {tf['smallest_file_gb']} GB, "
                f"{tf['n_folders']} folders (first {len(tf['folders'])}):", *tf["folders"], ""]
    seen: set[str] = set()
    page_parts = []
    for name, text in pg["sections"].items():
        if name in SKIP_SECTIONS:
            continue
        lines = _clean_lines(text, seen)
        if len(lines) > 1:
            page_parts.append(f"## page: {name}\n" + "\n".join(lines))
    page = "\n\n".join(page_parts)
    out += [page[:PAGE_CAP] + (" [...cut]" if len(page) > PAGE_CAP else ""), ""]
    dp = DOCS / f"{dataset_id}.json"
    if dp.exists():
        d = json.loads(dp.read_text(encoding="utf-8"))
        doc = "\n".join(_clean_lines(d["text"], seen))
        out += [f"## manual: {d['doc_type']} ({d['method']}, {d['n_pages']} pages, {d['n_chars']} chars)",
                doc[:DOC_CAP] + (" [...cut]" if len(doc) > DOC_CAP else ""), ""]
    else:
        out += ["## manual: none", ""]
    return "\n".join(out)


# Second pass for classes_example: class tables often sit past PAGE_CAP/DOC_CAP, so search the full texts.
_CLASS_HINT = re.compile(r"클래스|class|카테고리|category|categor|분류 체계|라벨 종류|객체 종류|대분류|중분류|소분류|품종|label", re.I)
HINT_WINDOW = 6     # lines kept after each matching line
HINT_CAP = 2500     # characters printed per dataset


def class_hints(dataset_id: str) -> str:
    pg = json.loads((PAGES / f"{dataset_id}.json").read_text(encoding="utf-8"))
    texts = [t for n, t in pg["sections"].items() if n not in SKIP_SECTIONS]
    dp = DOCS / f"{dataset_id}.json"
    if dp.exists():
        texts.append(json.loads(dp.read_text(encoding="utf-8"))["text"])
    lines = _clean_lines("\n".join(texts), set())
    keep: list[int] = []
    for k, l in enumerate(lines):
        if _CLASS_HINT.search(l):
            keep.extend(range(k, min(k + HINT_WINDOW + 1, len(lines))))
    out = "\n".join(lines[k] for k in sorted(set(keep)))
    return out[:HINT_CAP] + (" [...cut]" if len(out) > HINT_CAP else "")


def cmd_hints(ids: list[str]) -> None:
    for i in ids:
        print(f"===== {i}\n{class_hints(i) or '(no class-like lines)'}\n")


def cmd_pack(ids: list[str]) -> None:
    PACKS.mkdir(parents=True, exist_ok=True)
    for i in ids:
        text = build_pack(i)
        (PACKS / f"{i}.md").write_text(text, encoding="utf-8")
        print(f"{i:>6s} {len(text):6d} chars -> {PACKS / f'{i}.md'}")


def cmd_next(n: int) -> None:
    done = {p.stem for p in RECORDS.glob("*.json")}
    todo = [i for i in _all_ids() if i not in done]
    print(f"enriched {len(done)}/{len(_all_ids())}; next {min(n, len(todo))}: {' '.join(todo[:n])}")
    cmd_pack(todo[:n])


def validate_record(r: dict, modalities: set[str], tasks: set[str]) -> list[str]:
    errs = []
    for k, t in SCHEMA.items():
        if k not in r:
            errs.append(f"missing {k}")
        elif not isinstance(r[k], t):
            errs.append(f"{k} should be {t.__name__}")
        elif t in (list, str) and not r[k] and k not in OPTIONAL_EMPTY:
            errs.append(f"{k} is empty")
    if r.get("difficulty") not in DIFFICULTY:
        errs.append(f"difficulty must be one of {sorted(DIFFICULTY)}")
    if bad := set(r.get("modalities", [])) - modalities:
        errs.append(f"unknown modalities {sorted(bad)}")
    if bad := set(r.get("tasks", [])) - tasks:
        errs.append(f"unknown tasks {sorted(bad)} (add them to config/tasks.yaml first)")
    if any(not {"ko", "en"} <= set(x) for x in r.get("topics", [])):
        errs.append("topics items need ko and en")
    if any(not {"task", "model", "metric", "value"} <= set(x) for x in r.get("baseline", [])):
        errs.append("baseline items need task, model, metric, value")
    ideas = r.get("project_ideas", [])
    if len(ideas) != 3 or any(not {"level", "title_ko", "title_en", "desc_ko", "desc_en"} <= set(x) for x in ideas):
        errs.append("project_ideas needs 3 items with level, title_ko, title_en, desc_ko, desc_en")
    elif {x["level"] for x in ideas} != IDEA_LEVELS:
        errs.append(f"project_ideas levels must be {sorted(IDEA_LEVELS)} (one each)")
    return errs


def _load_records() -> list[tuple[str, dict | None, list[str]]]:
    modalities, tasks = _controlled()
    out = []
    for p in sorted(RECORDS.glob("*.json"), key=lambda x: int(x.stem)):
        try:
            r = json.loads(p.read_text(encoding="utf-8"))
            errs = validate_record(r, modalities, tasks)
            if str(r.get("dataset_id")) != p.stem:
                errs.append(f"dataset_id {r.get('dataset_id')} does not match file name")
        except json.JSONDecodeError as e:
            r, errs = None, [f"invalid JSON: {e}"]
        out.append((p.stem, r, errs))
    return out


def cmd_validate() -> None:
    recs = _load_records()
    bad = [(i, e) for i, _, e in recs if e]
    for i, e in bad:
        print(f"{i:>6s} " + "; ".join(e))
    print(f"records: {len(recs)}/{len(_all_ids())}, with problems: {len(bad)}")
    sys.exit(1 if bad else 0)


def cmd_export() -> None:
    """Merge Claude's records with exact facts from the page and file tree into one file."""
    recs = _load_records()
    if bad := [i for i, _, e in recs if e]:
        sys.exit(f"fix these records first (run validate): {bad}")
    if errs := check_all():
        sys.exit("fix domains first (python -m processing.domains check):\n" + "\n".join(errs))
    expl_bad = {i: e for i, _, _ in recs if (e := validate_explanation(EXPLAIN / f"{i}.json"))}
    if expl_bad:
        sys.exit(f"fix explanations first (python -m processing.explain validate): {sorted(expl_bad, key=int)[:20]}")
    tags = load_tags()
    merged = []
    for i, r, _ in recs:
        pg = json.loads((PAGES / f"{i}.json").read_text(encoding="utf-8"))
        tf = tree_facts(i) or {}
        ex = json.loads((EXPLAIN / f"{i}.json").read_text(encoding="utf-8"))
        merged.append({
            "dataset_id": i, "title_ko": pg["title"], **{k: v for k, v in r.items() if k != "dataset_id"},
            "domains": tags[i], **{k: ex[k] for k in EXPLAIN_FIELDS},
            "source_tags": pg["tags"], "build_year": pg["build_year"], "last_update": pg["last_update"],
            "lead_organization": pg["lead_organization"], "views": pg["views"], "downloads": pg["downloads"],
            "total_gb": tf.get("total_gb"), "n_files": tf.get("n_files"),
            "smallest_file_gb": tf.get("smallest_file_gb"), "related_ids": pg["related_ids"],
            "source_url": PAGE_URL.format(id=i),
        })
    out = DATA / "enriched" / "aihub_datasets.json"
    out.write_text(json.dumps({"n_datasets": len(merged), "datasets": merged}, ensure_ascii=False, indent=1),
                   encoding="utf-8")
    print(f"{len(merged)} records -> {out}")
    print("difficulty:", dict(Counter(r["difficulty"] for r in merged)))
    print("tasks:", dict(Counter(t for r in merged for t in r["tasks"]).most_common()))
    print("main domains:", dict(Counter(r["domains"][0] for r in merged).most_common()))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cmd", choices=["pack", "next", "hints", "validate", "export"])
    p.add_argument("--ids", nargs="+")
    p.add_argument("--n", type=int, default=10)
    a = p.parse_args()
    if a.cmd == "pack":
        cmd_pack(a.ids or _all_ids())
    elif a.cmd == "hints":
        if not a.ids:
            p.error("hints needs --ids")
        cmd_hints(a.ids)
    elif a.cmd == "next":
        cmd_next(a.n)
    else:
        {"validate": cmd_validate, "export": cmd_export}[a.cmd]()


if __name__ == "__main__":
    main()
