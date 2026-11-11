"""Domains (our own subject areas): checks and report for dataset tags and major links.

config/domains.yaml                  controlled list of domains (+ groups and scope notes)
data/enriched/domain_tags.json       dataset_id -> 1-3 domain ids (first = main subject)
data/profiles/major_domains.json     major id -> linked domains (level core / related, short reason)

Both files are written by Claude (user's plan); `enrich_datasets export` and `major_profiles export`
merge them into the exported records as the field "domains".

Usage (project root):
    python -m processing.domains check     # validate both files against domains.yaml
    python -m processing.domains report    # datasets per domain, chips per major, unlinked domains
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DOMAINS_FILE = ROOT / "config" / "domains.yaml"
TAGS_FILE = DATA / "enriched" / "domain_tags.json"
MAJOR_LINKS_FILE = DATA / "profiles" / "major_domains.json"
RECORDS = DATA / "enriched" / "aihub"
PROFILES = DATA / "profiles" / "majors"

MAX_TAGS = 3          # domains per dataset
LINK_LEVELS = {"core", "related"}
MIN_CORE = 2          # core domains per major
MIN_DATASETS = 5      # a domain with fewer datasets is too small to show as an interest chip


def load_domains() -> dict:
    """Return the parsed domains.yaml ({"groups": {...}, "domains": {...}})."""
    return yaml.safe_load(DOMAINS_FILE.read_text(encoding="utf-8"))


def load_tags() -> dict[str, list[str]]:
    return json.loads(TAGS_FILE.read_text(encoding="utf-8"))["tags"]


def load_major_links() -> dict[str, list[dict]]:
    return json.loads(MAJOR_LINKS_FILE.read_text(encoding="utf-8"))["majors"]


def validate_domains(cfg: dict) -> list[str]:
    errs = []
    for d, v in cfg["domains"].items():
        if missing := {"group", "ko", "en", "scope_ko", "scope_en"} - set(v):
            errs.append(f"domain {d}: missing {sorted(missing)}")
        if v.get("group") not in cfg["groups"]:
            errs.append(f"domain {d}: unknown group {v.get('group')}")
    return errs


def validate_tags(tags: dict[str, list[str]], domains: set[str], dataset_ids: set[str]) -> list[str]:
    errs = []
    if missing := dataset_ids - set(tags):
        errs.append(f"datasets without domains: {sorted(missing, key=int)}")
    if extra := set(tags) - dataset_ids:
        errs.append(f"tags for unknown datasets: {sorted(extra, key=int)}")
    for i, ds in tags.items():
        if not 1 <= len(ds) <= MAX_TAGS:
            errs.append(f"{i}: needs 1-{MAX_TAGS} domains, has {len(ds)}")
        if len(set(ds)) != len(ds):
            errs.append(f"{i}: repeated domain")
        if bad := set(ds) - domains:
            errs.append(f"{i}: unknown domains {sorted(bad)} (add them to config/domains.yaml first)")
    return errs


def validate_major_links(links: dict[str, list[dict]], domains: set[str], major_ids: set[str]) -> list[str]:
    errs = []
    if missing := major_ids - set(links):
        errs.append(f"majors without domains: {sorted(missing)}")
    if extra := set(links) - major_ids:
        errs.append(f"links for unknown majors: {sorted(extra)}")
    for m, ls in links.items():
        if any(not {"domain", "level", "why"} <= set(x) for x in ls):
            errs.append(f"{m}: each link needs domain, level, why")
            continue
        names = [x["domain"] for x in ls]
        if len(set(names)) != len(names):
            errs.append(f"{m}: repeated domain")
        if bad := set(names) - domains:
            errs.append(f"{m}: unknown domains {sorted(bad)}")
        if bad := {x["level"] for x in ls} - LINK_LEVELS:
            errs.append(f"{m}: unknown levels {sorted(bad)}")
        if sum(x["level"] == "core" for x in ls) < MIN_CORE:
            errs.append(f"{m}: needs at least {MIN_CORE} core domains")
    return errs


def check_all() -> list[str]:
    """All problems in domains.yaml, the dataset tags and the major links (empty list = fine)."""
    cfg = load_domains()
    domains = set(cfg["domains"])
    errs = validate_domains(cfg)
    errs += validate_tags(load_tags(), domains, {p.stem for p in RECORDS.glob("*.json")})
    errs += validate_major_links(load_major_links(), domains, {p.stem for p in PROFILES.glob("*.json")})
    return errs


def cmd_check() -> None:
    errs = check_all()
    for e in errs:
        print(e)
    print(f"problems: {len(errs)}")
    sys.exit(1 if errs else 0)


def cmd_report() -> None:
    cfg, tags, links = load_domains(), load_tags(), load_major_links()
    n_all = Counter(d for ds in tags.values() for d in ds)
    n_main = Counter(ds[0] for ds in tags.values())
    linked = Counter(x["domain"] for ls in links.values() for x in ls)
    print(f"{len(tags)} datasets, {len(cfg['domains'])} domains, "
          f"domains per dataset: {dict(sorted(Counter(len(v) for v in tags.values()).items()))}\n")
    print(f"{'domain':24s} {'datasets':>8s} {'main':>5s} {'majors':>6s}  name")
    for g, gv in cfg["groups"].items():
        print(f"-- {gv['en']}")
        for d, v in cfg["domains"].items():
            if v["group"] == g:
                flag = "  <- small" if n_all[d] < MIN_DATASETS else ""
                print(f"{d:24s} {n_all[d]:8d} {n_main[d]:5d} {linked[d]:6d}  {v['en']}{flag}")
    print("\nchips per major (core first; dataset counts in brackets):")
    for m in sorted(links):
        ls = sorted(links[m], key=lambda x: x["level"] != "core")
        print(f"{m:15s} " + ", ".join(f"{x['domain']}[{n_all[x['domain']]}]{'*' if x['level'] == 'core' else ''}"
                                       for x in ls))
    if unlinked := [d for d in cfg["domains"] if not linked[d]]:
        print(f"\ndomains no major links to (still reachable by search or 'Other'): {unlinked}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cmd", choices=["check", "report"])
    {"check": cmd_check, "report": cmd_report}[p.parse_args().cmd]()


if __name__ == "__main__":
    main()
