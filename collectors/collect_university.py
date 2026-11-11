"""Collect Korea University Sejong department pages (intro, goals, curriculum, careers, research).

For each department homepage in config/departments_ku_sejong.yaml:
  1. fetch the homepage, read its menu links
  2. keep links whose label matches config `university.menu_keywords` (minus excluded words)
  3. fetch those pages (max `max_pages_per_site`), extract the main content text + tables
Several majors can share one site (e.g. 국제스포츠학부); each site is fetched once.

Usage (project root):
    python -m collectors.collect_university              # all departments
    python -m collectors.collect_university --ids pharm env
Output:
    data/raw/university/<site>/<page>.html
    data/parsed/university/<dept_id>.json
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

import yaml
from bs4 import BeautifulSoup

from collectors.polite_http import CollectionStopped, PoliteSession
from processing.env import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
log = logging.getLogger("collect_university")

_SUBVIEW = re.compile(r"^/[\w-]+/\d+/subview\.do$")
_ATTACH = re.compile(r"(download\.do|fileDown|\.pdf|\.hwp|\.hwpx|\.xlsx?|\.docx?)", re.I)


def _clean(t: str) -> str:
    return re.sub(r"\s+", " ", t).strip()


def site_key(site_path: str) -> str:
    parts = [p for p in site_path.split("/") if p and p not in ("sites", "index.do")]
    return parts[0] if parts else "root"


def menu_links(html: str, base: str, cfg: dict) -> list[dict]:
    """Menu links of a department site, with a category from the keyword lists."""
    soup = BeautifulSoup(html, "lxml")
    kw = cfg["menu_keywords"]
    exclude = cfg["menu_exclude"]
    out, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = urlparse(urljoin(base, a["href"])).path
        label = _clean(a.get_text(" "))
        if not _SUBVIEW.match(href) or href in seen or not label or len(label) > 30:
            continue
        if any(x in label for x in exclude):
            seen.add(href)  # the same page may appear again under a neutral label (e.g. "About")
            continue
        cat = next((c for c, words in kw.items() if any(w in label for w in words)), None)
        if cat:
            seen.add(href)
            out.append({"path": href, "label": label, "category": cat})
    return out


def extract_content(html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    main = soup.select_one("article#_contentBuilder") or soup.select_one("div.contents") or soup.body
    for bad in main.select("script, style, nav, .breadcrumb"):
        bad.decompose()
    lines = []
    for el in main.find_all(["h2", "h3", "h4", "h5", "p", "li", "table", "dt", "dd"]):
        if el.find_parent("table") is not None and el.name != "table":
            continue
        if el.name == "table":
            for tr in el.find_all("tr"):
                cells = [_clean(c.get_text(" ")) for c in tr.find_all(["th", "td"])]
                if any(cells):
                    lines.append("| " + " | ".join(cells) + " |")
        elif el.name == "li" and el.find(["p", "table", "li"]):
            continue
        else:
            t = _clean(el.get_text(" "))
            if t and (not lines or lines[-1] != t):
                lines.append(t)
    if not lines:  # pages built from plain divs
        lines = [l for l in (_clean(x) for x in main.get_text("\n").splitlines()) if l]
    attachments = [{"label": _clean(a.get_text(" ")), "href": a["href"]}
                   for a in main.find_all("a", href=True) if _ATTACH.search(a["href"])]
    return {"text": "\n".join(lines), "n_tables": len(main.find_all("table")),
            "n_images": len(main.find_all("img")), "attachments": attachments}


def collect_site(sess: PoliteSession, base_url: str, site_path: str, cfg: dict, data_dir: Path) -> list[dict]:
    key = site_key(site_path)
    raw = data_dir / "raw" / "university" / key
    home = sess.fetch(base_url + site_path, raw / "index.html", source="university", item_id=key, kind="home")
    if not home.path:
        log.warning("homepage failed for %s", site_path)
        return []
    links = menu_links(home.path.read_text(encoding="utf-8", errors="replace"), base_url + site_path, cfg)
    links = links[: cfg["max_pages_per_site"]]
    pages = []
    for ln in links:
        pid = ln["path"].strip("/").replace("/", "_").replace(".do", "")
        res = sess.fetch(base_url + ln["path"], raw / f"{pid}.html", source="university", item_id=key, kind=ln["category"])
        if res.path:
            pages.append({**ln, "url": base_url + ln["path"],
                          **extract_content(res.path.read_text(encoding="utf-8", errors="replace"))})
    return pages


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ids", nargs="+", help="department ids from departments_ku_sejong.yaml")
    args = p.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.StreamHandler(sys.stdout)])

    with open(ROOT / "config" / "settings.yaml", encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh)
    ucfg = cfg["university"]
    with open(ROOT / ucfg["departments_file"], encoding="utf-8") as fh:
        depts = yaml.safe_load(fh)["departments"]
    if args.ids:
        depts = [d for d in depts if d["id"] in args.ids]

    data_dir = ROOT / cfg["paths"]["data_dir"]
    env = load_dotenv(ROOT / ".env")
    sess = PoliteSession(cfg["http"], data_dir, env.get("CONTACT_EMAIL", ""))
    out_dir = data_dir / "parsed" / "university"
    out_dir.mkdir(parents=True, exist_ok=True)
    site_cache: dict[str, list[dict]] = {}
    try:
        for i, d in enumerate(depts, 1):
            if d["site"] not in site_cache:
                site_cache[d["site"]] = collect_site(sess, ucfg["base_url"], d["site"], ucfg, data_dir)
            pages = site_cache[d["site"]]
            rec = {**d, "site_url": ucfg["base_url"] + d["site"], "pages": pages,
                   "n_chars": sum(len(pg["text"]) for pg in pages)}
            (out_dir / f"{d['id']}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
            cats = sorted({pg["category"] for pg in pages})
            log.info("[%d/%d] %s %s: %d pages, %d chars, %s", i, len(depts), d["id"], d["name_ko"],
                     len(pages), rec["n_chars"], cats)
    except CollectionStopped as exc:
        log.error("STOPPED: %s. Progress is saved; re-run to resume.", exc)
        sys.exit(2)
    log.info("done. requests this run: %d", sess.n_requests)


if __name__ == "__main__":
    main()
