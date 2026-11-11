"""Major profiles: reading packs (input for Claude) and validation of the finished profiles.

A profile is written by Claude (user's plan) from everything collected about one major:
department pages (data/parsed/university/<id>.json), PDF attachments and images
(data/parsed/university/media_index.json). Profiles do NOT use AI Hub's own field list.
Links to our own domains live in data/profiles/major_domains.json (see processing/domains.py)
and are merged into the export as "domains".

Usage (project root):
    python -m processing.major_profiles pack --ids pharm env     # write data/profiles/packs/<id>.md
    python -m processing.major_profiles pack                     # all majors
    python -m processing.major_profiles validate                 # check data/profiles/majors/*.json
    python -m processing.major_profiles export                   # -> data/profiles/majors_ku_sejong.json
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import pymupdf

from processing.domains import check_all, load_major_links

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
UNI = DATA / "parsed" / "university"
PACKS = DATA / "profiles" / "packs"
PROFILES = DATA / "profiles" / "majors"

PAGE_CAP = 2500   # characters kept per web page
PDF_CAP = 5000    # characters kept per PDF attachment
BOILER_MIN = 3    # a line repeated on this many pages of one site is menu/footer text

# Required profile fields -> type. Lists must be non-empty unless listed in OPTIONAL_EMPTY.
SCHEMA = {
    "id": str, "name_ko": str, "name_en": str, "college": str,
    "summary_ko": str, "summary_en": str,
    "key_topics": list, "course_keywords": list, "careers": list, "research_areas": list,
    "data_interests": list, "interest_questions": list, "project_themes": list,
    "data_skill_level": str, "data_skill_note": str,
    "sources": list, "inferred_fields": list, "gaps": list,
}
OPTIONAL_EMPTY = {"research_areas", "inferred_fields", "gaps"}
SKILL_LEVELS = {"low", "medium", "high"}


def _load_media() -> list[dict]:
    p = UNI / "media_index.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def _squeeze(text: str) -> str:
    """Drop repeated lines and 1-2 character fragments (table marks, words split by PDF layout)."""
    seen, out = set(), []
    for l in (x.strip() for x in text.splitlines()):
        if len(l) <= 2 or l in seen:
            continue
        seen.add(l)
        out.append(l)
    return "\n".join(out)


def _pdf_text(path: Path) -> tuple[str, int]:
    doc = pymupdf.open(path)
    return _squeeze("\n".join(pg.get_text() for pg in doc)), doc.page_count


def build_pack(dept_id: str, media: list[dict]) -> str:
    d = json.loads((UNI / f"{dept_id}.json").read_text(encoding="utf-8"))
    counts = Counter(l for pg in d["pages"] for l in set(pg["text"].splitlines()))
    out = [f"# {d['name_ko']} ({d['id']})", f"college: {d['college']} | ai_related: {d.get('ai_related')}",
           f"site: {d['site_url']}", ""]
    for pg in d["pages"]:
        lines = [l for l in pg["text"].splitlines() if counts[l] < BOILER_MIN or l.startswith("|")]
        text = _squeeze("\n".join(lines))
        cut = " [...cut]" if len(text) > PAGE_CAP else ""
        out += [f"## page: {pg['label']} [{pg['category']}] {pg['url']}", text[:PAGE_CAP] + cut, ""]
    for it in (m for m in media if m["dept_id"] == dept_id):
        path = DATA / it["path"]
        if it["kind"] == "pdf" and path.exists():
            text, n_pages = _pdf_text(path)
            cut = " [...cut]" if len(text) > PDF_CAP else ""
            note = "" if text.strip() else " (no text layer: read as images)"
            out += [f"## pdf: {it['page']} ({n_pages} pages){note} {it['url']}", f"file: {path}",
                    text[:PDF_CAP] + cut, ""]
        elif it["kind"] == "image":
            out += [f"## image: {it['page']} alt='{it.get('alt', '')}' {it['url']}", f"file: {path}", ""]
    return "\n".join(out)


def cmd_pack(ids: list[str] | None) -> None:
    media = _load_media()
    ids = ids or sorted(p.stem for p in UNI.glob("*.json") if p.stem != "media_index")
    PACKS.mkdir(parents=True, exist_ok=True)
    for i in ids:
        text = build_pack(i, media)
        (PACKS / f"{i}.md").write_text(text, encoding="utf-8")
        print(f"{i:16s} {len(text):6d} chars -> {PACKS / f'{i}.md'}")


def validate_profile(p: dict) -> list[str]:
    errs = []
    for k, t in SCHEMA.items():
        if k not in p:
            errs.append(f"missing {k}")
        elif not isinstance(p[k], t):
            errs.append(f"{k} should be {t.__name__}")
        elif t is list and not p[k] and k not in OPTIONAL_EMPTY:
            errs.append(f"{k} is empty")
        elif t is str and not p[k].strip():
            errs.append(f"{k} is empty")
    if p.get("data_skill_level") not in SKILL_LEVELS:
        errs.append(f"data_skill_level must be one of {sorted(SKILL_LEVELS)}")
    for x in p.get("data_interests", []):
        if not {"topic_ko", "topic_en", "keywords"} <= set(x):
            errs.append("data_interests items need topic_ko, topic_en, keywords")
            break
    for q in p.get("interest_questions", []):
        if not {"q_ko", "q_en", "options"} <= set(q) or len(q["options"]) < 3:
            errs.append("interest_questions need q_ko, q_en and >= 3 options")
            break
    for f in p.get("inferred_fields", []):
        if f not in SCHEMA:
            errs.append(f"inferred_fields names unknown field {f}")
    return errs


def cmd_validate() -> None:
    expected = sorted(p.stem for p in UNI.glob("*.json") if p.stem != "media_index")
    done = {p.stem for p in PROFILES.glob("*.json")}
    bad = 0
    for i in expected:
        if i not in done:
            print(f"{i:16s} MISSING")
            bad += 1
            continue
        try:
            errs = validate_profile(json.loads((PROFILES / f"{i}.json").read_text(encoding="utf-8")))
        except json.JSONDecodeError as e:
            errs = [f"invalid JSON: {e}"]
        if errs:
            bad += 1
            print(f"{i:16s} " + "; ".join(errs))
    print(f"profiles: {len(done & set(expected))}/{len(expected)}, with problems: {bad}")
    sys.exit(1 if bad else 0)


def cmd_export() -> None:
    """Combine all valid profiles (+ their domain links) into one file for the recommender."""
    profiles =[json.loads(p.read_text(encoding="utf-8")) for p in sorted(PROFILES.glob("*.json"))]
    bad = [p["id"] for p in profiles if validate_profile(p)]
    if bad:
        sys.exit(f"fix these profiles first (run validate): {bad}")
    if errs := check_all():
        sys.exit("fix domains first (python -m processing.domains check):\n" + "\n".join(errs))
    links = load_major_links()
    profiles = [{**p, "domains": links[p["id"]]} for p in profiles]
    out = DATA / "profiles" / "majors_ku_sejong.json"
    out.write_text(json.dumps({"university": "Korea University Sejong", "n_majors": len(profiles),
                               "majors": profiles}, ensure_ascii=False, indent=1), encoding="utf-8")
    inferred = Counter(f for p in profiles for f in p["inferred_fields"])
    print(f"{len(profiles)} profiles -> {out}")
    print("skill levels:", dict(Counter(p["data_skill_level"] for p in profiles)))
    print("fields inferred (not from the site):", dict(inferred))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cmd", choices=["pack", "validate", "export"])
    p.add_argument("--ids", nargs="+")
    a = p.parse_args()
    {"pack": lambda: cmd_pack(a.ids), "validate": cmd_validate, "export": cmd_export}[a.cmd]()


if __name__ == "__main__":
    main()
