"""Download the images and PDF attachments that carry major content (curriculum maps, course PDFs).

Uses the HTML already saved by collectors.collect_university (no page is fetched again).
Selected:
  - PDF attachments on every collected page (HWP copies of the same file are skipped)
  - images on pages that are mostly image (text < MAX_TEXT chars) or whose label is a curriculum map
Decorative photos on text-rich pages are skipped.

Usage (project root):
    python -m collectors.collect_university_media --dry-run     # list what would be downloaded
    python -m collectors.collect_university_media
Output:
    data/raw/university/<site>/media/<file>
    data/parsed/university/media_index.json   (dept_id, page label, kind, url, path)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

import yaml
from bs4 import BeautifulSoup

from collectors.collect_university import site_key
from collectors.polite_http import CollectionStopped, PoliteSession
from processing.env import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
log = logging.getLogger("collect_university_media")

MAX_TEXT = 300  # a page with less text than this is treated as "content is in the image"
_MAP_LABEL = re.compile(r"체계도|교과과정|교육과정|Curriculum|진로가이드")
_IMG_EXT = re.compile(r"\.(png|jpe?g|gif|webp)$", re.I)
# site-wide icons/logos, template samples and history timelines carry no major content
_IMG_SKIP = re.compile(r"/templateGuide/|/Web-home/|/koreaSejong/images/guide/|/atchmnfl/hist/")


def _main_block(html: str):
    soup = BeautifulSoup(html, "lxml")
    return soup.select_one("article#_contentBuilder") or soup.select_one("div.contents") or soup.body


def _dest_name(url: str, kind: str) -> str:
    path = urlparse(url).path
    name = Path(path).name
    if kind == "pdf" or not _IMG_EXT.search(name):
        # fileDownload.do style links: build a stable name from the path
        name = hashlib.sha1(path.encode()).hexdigest()[:12] + (".pdf" if kind == "pdf" else ".img")
    return name


def plan_items(base_url: str, data_dir: Path) -> list[dict]:
    items, seen = [], set()
    for f in sorted((data_dir / "parsed" / "university").glob("*.json")):
        if f.name == "media_index.json":
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        key = site_key(d["site"])
        for pg in d["pages"]:
            for a in pg.get("attachments", []):
                if "hwpFileDownload" in a["href"] or a["href"].lower().endswith((".hwp", ".hwpx")):
                    continue
                url = urljoin(base_url, a["href"])
                items.append({"dept_id": d["id"], "site": key, "page": pg["label"], "kind": "pdf", "url": url})
            if not pg.get("n_images") or (len(pg["text"]) >= MAX_TEXT and not _MAP_LABEL.search(pg["label"])):
                continue
            pid = pg["path"].strip("/").replace("/", "_").replace(".do", "")
            html_path = data_dir / "raw" / "university" / key / f"{pid}.html"
            main = _main_block(html_path.read_text(encoding="utf-8", errors="replace")) if html_path.exists() else None
            for img in (main.find_all("img") if main else []):
                src = img.get("src") or ""
                if not src or src.startswith("data:") or _IMG_SKIP.search(src):
                    continue
                items.append({"dept_id": d["id"], "site": key, "page": pg["label"], "kind": "image",
                              "url": urljoin(base_url + pg["path"], src), "alt": img.get("alt", "")})
    # shared sites (e.g. 국제스포츠학부) list the same file twice: keep one download, all dept links
    for it in items:
        it["path"] = str(Path("raw") / "university" / it["site"] / "media" / _dest_name(it["url"], it["kind"]))
    out = []
    for it in items:
        k = (it["dept_id"], it["url"])
        if k not in seen:
            seen.add(k)
            out.append(it)
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.StreamHandler(sys.stdout)])
    with open(ROOT / "config" / "settings.yaml", encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh)
    data_dir = ROOT / cfg["paths"]["data_dir"]
    base_url = cfg["university"]["base_url"]
    items = plan_items(base_url, data_dir)
    n_urls = len({i["url"] for i in items})
    log.info("%d items (%d unique files): %d pdf, %d image", len(items), n_urls,
             sum(i["kind"] == "pdf" for i in items), sum(i["kind"] == "image" for i in items))
    if args.dry_run:
        for it in items:
            print(it["dept_id"], it["page"], it["kind"], it["url"])
        return

    env = load_dotenv(ROOT / ".env")
    sess = PoliteSession(cfg["http"], data_dir, env.get("CONTACT_EMAIL", ""))
    try:
        for it in items:
            res = sess.fetch(it["url"], data_dir / it["path"], source="university", item_id=it["site"], kind=it["kind"])
            it["ok"] = bool(res.path)
            it["content_type"] = res.content_type
            it["bytes"] = res.n_bytes
    except CollectionStopped as exc:
        log.error("STOPPED: %s. Progress is saved; re-run to resume.", exc)
        sys.exit(2)
    finally:
        idx = data_dir / "parsed" / "university" / "media_index.json"
        idx.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    log.info("done. requests this run: %d, failed: %d", sess.n_requests, sum(not i.get("ok") for i in items))


if __name__ == "__main__":
    main()
