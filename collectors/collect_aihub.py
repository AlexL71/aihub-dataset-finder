"""Collect AI Hub dataset list, pages, file trees and documents.

Usage (from project root, with .venv active):
    python -m collectors.collect_aihub list
    python -m collectors.collect_aihub pages --sample          # Phase 0: 20 fixed random datasets
    python -m collectors.collect_aihub trees --sample
    python -m collectors.collect_aihub docs  --sample [--use-cookie]
    python -m collectors.collect_aihub pages --ids 71 72 73
    python -m collectors.collect_aihub pages --all             # full run (only when approved)
    python -m collectors.collect_aihub icons --sample          # icon address per dataset, for the app's cards
    python -m collectors.collect_aihub icons --all

Re-running is safe: finished files are skipped (resume). `icons` only reads each page's icon address into
data/parsed/aihub/icons.json; it never rewrites the parsed pages and does not keep the downloaded HTML.
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import random
import re
import sys
from pathlib import Path

import yaml

from collectors.polite_http import CollectionStopped, PoliteSession
from processing.env import load_dotenv
from processing.parse_aihub import parse_dataset_list, parse_icon, parse_page

ROOT = Path(__file__).resolve().parents[1]
log = logging.getLogger("collect_aihub")


def load_cfg() -> dict:
    with open(ROOT / "config" / "settings.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def make_session(cfg: dict, data_dir: Path, use_cookie: bool = False) -> PoliteSession:
    env = load_dotenv(ROOT / ".env")
    headers = {}
    if use_cookie:
        cookie = env.get("AIHUB_COOKIE", "")
        if not cookie:
            sys.exit("--use-cookie given but AIHUB_COOKIE is empty in .env (see .env.example)")
        headers["Cookie"] = cookie
    return PoliteSession(cfg["http"], data_dir, env.get("CONTACT_EMAIL", ""), headers)


def raw_dir(data_dir: Path) -> Path:
    return data_dir / "raw" / "aihub"


def cmd_list(cfg: dict, sess: PoliteSession, data_dir: Path) -> None:
    a = cfg["aihub"]
    dest = raw_dir(data_dir) / "dataset_list.txt"
    # The API answers HTTP 502 but still sends the full list, so 502 is accepted here.
    sess.fetch(a["api_base_url"] + a["dataset_list_path"], dest, source="aihub", item_id="all",
               kind="dataset_list", accept_status=(200, 502), force=True)
    rows = parse_dataset_list(dest.read_text(encoding="utf-8", errors="replace"))
    out = data_dir / "parsed" / "aihub" / "dataset_list.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=["dataset_id", "title"])
        w.writeheader()
        w.writerows(rows)
    log.info("dataset list: %d datasets -> %s", len(rows), out)


def select_ids(cfg: dict, data_dir: Path, args: argparse.Namespace) -> list[str]:
    if args.ids:
        return [str(i) for i in args.ids]
    list_csv = data_dir / "parsed" / "aihub" / "dataset_list.csv"
    if not list_csv.exists():
        sys.exit("Run 'list' first.")
    with open(list_csv, encoding="utf-8-sig") as fh:
        all_ids = [r["dataset_id"] for r in csv.DictReader(fh)]
    if args.all:
        return all_ids
    # Fixed sample, saved so every step uses the same datasets.
    sample_file = data_dir / "sample_ids.txt"
    if sample_file.exists():
        return sample_file.read_text(encoding="utf-8").split()
    rng = random.Random(cfg["aihub"]["sample_seed"])
    ids = sorted(rng.sample(all_ids, cfg["aihub"]["sample_size"]), key=int)
    sample_file.write_text("\n".join(ids), encoding="utf-8")
    return ids


def cmd_pages(cfg, sess, data_dir, ids):
    a = cfg["aihub"]
    for i, ds in enumerate(ids, 1):
        dest = raw_dir(data_dir) / "pages" / f"{ds}.html"
        res = sess.fetch(a["base_url"] + a["page_path"].format(id=ds), dest,
                         source="aihub", item_id=ds, kind="page")
        log.info("[%d/%d] page %s %s", i, len(ids), ds, "cached" if res.from_cache else res.status)
        if res.path:
            parsed = parse_page(res.path.read_text(encoding="utf-8", errors="replace"), ds)
            out = data_dir / "parsed" / "aihub" / "pages" / f"{ds}.json"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")


def cmd_trees(cfg, sess, data_dir, ids):
    a = cfg["aihub"]
    for i, ds in enumerate(ids, 1):
        dest = raw_dir(data_dir) / "filetree" / f"{ds}.txt"
        res = sess.fetch(a["api_base_url"] + a["filetree_path"].format(id=ds), dest,
                         source="aihub", item_id=ds, kind="filetree", accept_status=(200, 502))
        log.info("[%d/%d] tree %s %s", i, len(ids), ds, "cached" if res.from_cache else res.status)


def cmd_icons(cfg, sess, data_dir, ids):
    """Read each dataset page once and keep only its icon address (data/parsed/aihub/icons.json).

    Saved after every page, so an interrupted run resumes; datasets already in the file are skipped.
    A page without an icon is stored as null and is not fetched again.
    """
    a = cfg["aihub"]
    out = data_dir / "parsed" / "aihub" / "icons.json"
    icons: dict[str, str | None] = json.loads(out.read_text(encoding="utf-8"))["icons"] if out.exists() else {}
    todo = [ds for ds in ids if ds not in icons]
    log.info("icons: %d already known, %d to fetch", len(ids) - len(todo), len(todo))
    for i, ds in enumerate(todo, 1):
        tmp = raw_dir(data_dir) / "icon_pages" / f"{ds}.html"
        res = sess.fetch(a["base_url"] + a["page_path"].format(id=ds), tmp, source="aihub", item_id=ds, kind="icon_page")
        if not res.path:
            log.warning("[%d/%d] %s: page not fetched (%s); will retry next run", i, len(todo), ds, res.note or res.status)
            continue
        icons[ds] = parse_icon(res.path.read_text(encoding="utf-8", errors="replace"), a["base_url"])
        out.parent.mkdir(parents=True, exist_ok=True)
        body = {"about": "Icon address of each AI Hub dataset, read from its page header (collect_aihub icons). "
                         "null = the page has no icon.", "icons": dict(sorted(icons.items(), key=lambda kv: int(kv[0])))}
        out.write_text(json.dumps(body, ensure_ascii=False, indent=1), encoding="utf-8")
        res.path.unlink(missing_ok=True)
        log.info("[%d/%d] %s %s", i, len(todo), ds, "icon found" if icons[ds] else "NO ICON")
    missing = [ds for ds in ids if icons.get(ds) is None]
    log.info("icons known for %d of %d; without icon: %s", len(ids) - len(missing), len(ids), missing[:20])


_FILENAME_RE = re.compile(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", re.I)


def cmd_docs(cfg, sess, data_dir, ids):
    """Download data manual + build guide for datasets whose page was already parsed."""
    a = cfg["aihub"]
    for i, ds in enumerate(ids, 1):
        pj = data_dir / "parsed" / "aihub" / "pages" / f"{ds}.json"
        if not pj.exists():
            log.warning("no parsed page for %s; run 'pages' first", ds)
            continue
        links = json.loads(pj.read_text(encoding="utf-8")).get("doc_links", [])
        for link in links:
            kind = a["doc_types"].get(link["type"])
            if not kind:
                continue  # e.g. AI model files: skipped on purpose
            dest = raw_dir(data_dir) / "docs" / ds / f"{kind}_{link['file_sn']}.bin"
            res = sess.fetch(a["base_url"] + link["href"], dest, source="aihub", item_id=ds, kind=kind)
            if res.path and not res.from_cache:
                _rename_by_type(res)
            log.info("[%d/%d] %s %s -> %s %s", i, len(ids), ds, kind,
                     "cached" if res.from_cache else res.status,
                     res.content_type if res.path else "REFUSED")


def _rename_by_type(res) -> None:
    """Give the saved file its real extension (pdf/hwp/zip...).

    An HTML answer means the server refused the download (e.g. "정상적인 접근이 아닙니다").
    The file is removed so the next run tries again (e.g. after AIHUB_COOKIE is set).
    """
    m = _FILENAME_RE.search(res.note or "")
    ext = Path(m.group(1)).suffix.lower() if m else ""
    if not ext and "html" in res.content_type:
        log.warning("download refused by server (HTML answer): %s", res.url)
        res.path.unlink(missing_ok=True)
        res.path = None
        return
    if not ext:
        ext = ".pdf" if "pdf" in res.content_type else ".bin"
    if ext != ".bin":
        target = res.path.with_suffix(ext)
        res.path.replace(target)
        res.path = target


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("step", choices=["list", "pages", "trees", "docs", "icons"])
    g = p.add_mutually_exclusive_group()
    g.add_argument("--sample", action="store_true", help="use the fixed Phase 0 sample (default)")
    g.add_argument("--ids", nargs="+", type=int, help="specific dataset IDs")
    g.add_argument("--all", action="store_true", help="all datasets (full run)")
    p.add_argument("--use-cookie", action="store_true", help="send AIHUB_COOKIE from .env (docs only)")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.StreamHandler(sys.stdout)])
    cfg = load_cfg()
    data_dir = ROOT / cfg["paths"]["data_dir"]
    sess = make_session(cfg, data_dir, use_cookie=args.use_cookie and args.step == "docs")
    try:
        if args.step == "list":
            cmd_list(cfg, sess, data_dir)
        else:
            ids = select_ids(cfg, data_dir, args)
            {"pages": cmd_pages, "trees": cmd_trees, "docs": cmd_docs, "icons": cmd_icons}[args.step](cfg, sess, data_dir, ids)
    except CollectionStopped as exc:
        log.error("STOPPED: %s. Progress is saved; re-run later to resume.", exc)
        sys.exit(2)
    except KeyboardInterrupt:
        log.warning("Interrupted. Progress is saved; re-run to resume.")
        sys.exit(130)
    log.info("done. requests this run: %d", sess.n_requests)


if __name__ == "__main__":
    main()
