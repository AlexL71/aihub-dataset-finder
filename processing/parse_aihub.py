"""Parsers for AI Hub: dataset list, dataset page HTML, file tree text."""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

_LIST_LINE = re.compile(r"^\s*(\d+)\s*,\s*(.+?)\s*$")
_DOC_HREF = re.compile(r"/file/down\.do\?fileSn=(\d+)&(\w+FileSn)=\d+&dataSetSn=(\d+)")


def parse_icon(html: str, base_url: str) -> str | None:
    """Address of the dataset's own icon (the picture in the page header), or None if the page has none."""
    img = BeautifulSoup(html, "lxml").select_one("div.dataHead span.icon img")
    src = (img.get("src") or "").strip() if img else ""
    if not src:
        return None
    return src if src.startswith("http") else base_url.rstrip("/") + "/" + src.lstrip("/")


def parse_dataset_list(text: str) -> list[dict]:
    """'50, AR/VR ...' lines -> [{'dataset_id': '50', 'title': '...'}]"""
    rows = []
    for line in text.splitlines():
        m = _LIST_LINE.match(line)
        if m:
            rows.append({"dataset_id": m.group(1), "title": m.group(2)})
    return rows


# Sections whose tables hold personal contact data (names, phones, emails).
# We keep only organization names from them, never the contact details.
_CONTACT_SECTIONS = {"구축 업체"}
_ORG_RE = re.compile(r"수행기관\(주관\)\s*:\s*(.+)")
_TAG_RE = re.compile(r"fnList\('\s*([^']+?)\s*'\)")
_HEAD_FIELDS = {"분야": "field", "유형": "data_type"}
_DATE_FIELDS = {"구축년도": "build_year", "갱신년월": "last_update", "조회수": "views", "다운로드": "downloads"}


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _table_rows(table) -> list[list[str]]:
    rows = []
    for tr in table.find_all("tr"):
        cells = [_clean(c.get_text(" ")) for c in tr.find_all(["th", "td"])]
        if any(cells):
            rows.append(cells)
    return rows


def _section_text(li) -> str:
    """Section text with tables flattened to 'a | b | c' lines (keeps table meaning for chunking)."""
    parts = []
    for el in li.find_all(["h3", "h4", "h5", "p", "pre", "table", "li", "dd", "dt"], recursive=True):
        if el.find_parent("table") is not None and el.name != "table":
            continue
        if el.name == "table":
            parts.extend(" | ".join(r) for r in _table_rows(el))
        elif el.name == "li" and el.find(["p", "table", "li"]):
            continue  # container li: its children are handled separately
        else:
            t = _clean(el.get_text(" "))
            if t:
                parts.append(t)
    # de-duplicate consecutive repeats from nested markup
    out = []
    for p in parts:
        if not out or out[-1] != p:
            out.append(p)
    return "\n".join(out)


def _key_value_table(table) -> dict[str, str]:
    """Rows of alternating th/td pairs (e.g. 메타데이터 구조표) -> {th: td}."""
    kv = {}
    for tr in table.find_all("tr"):
        cells = tr.find_all(["th", "td"])
        for th, td in zip(cells, cells[1:]):
            if th.name == "th" and td.name == "td":
                kv[_clean(th.get_text(" "))] = _clean(td.get_text(" "))
    return kv


def parse_page(html: str, dataset_id: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    rec: dict = {"dataset_id": dataset_id}

    # ---- header: title, tags, field/type, dates, counters ----
    head = soup.select_one("div.dataHead div.contentWrap")
    if head:
        h3 = head.find("h3")
        rec["title"] = _clean(h3.get_text(" ")) if h3 else ""
        tag_span = head.find("span", class_="tag")
        rec["tags"] = [m.group(1) for a in (tag_span.find_all("a") if tag_span else [])
                       if (m := _TAG_RE.search(a.get("href", "")))]
        for li in head.select("div.content li"):
            em = li.find("em")
            if em and (key := _HEAD_FIELDS.get(_clean(em.get_text()))):
                rec[key] = _clean(li.get_text(" ").replace(em.get_text(), "", 1))
        for em in head.select("span.date em"):
            t = _clean(em.get_text(" "))
            for ko, key in _DATE_FIELDS.items():
                if t.startswith(ko):
                    rec[key] = _clean(t.split(":", 1)[-1])

    # ---- main sections: ul.dataContent > li, each starts with an h3 ----
    sections: dict[str, str] = {}
    for li in soup.select("ul.dataContent > li"):
        h3 = li.find("h3")
        if not h3:
            continue
        name = _clean(h3.get_text(" "))
        if name in _CONTACT_SECTIONS:
            orgs = [m.group(1).strip() for h5 in li.find_all("h5")
                    if (m := _ORG_RE.search(_clean(h5.get_text(" "))))]
            rec["lead_organization"] = orgs[0] if orgs else ""
            continue
        sections[name] = _section_text(li)
    rec["sections"] = sections
    meta = soup.select_one("table.metadata")  # newer pages only
    rec["metadata_table"] = _key_value_table(meta) if meta else {}

    # ---- document links (data manual, build guide, AI model ...) ----
    doc_links, seen = [], set()
    for a in soup.find_all("a", href=True):
        m = _DOC_HREF.search(a["href"])
        if m and m.group(0) not in seen:
            seen.add(m.group(0))
            doc_links.append({"href": m.group(0), "file_sn": m.group(1), "type": m.group(2),
                              "label": _clean(a.get_text(" "))})
    rec["doc_links"] = doc_links

    # ---- related datasets (useful for "similar datasets") ----
    rel = re.findall(r"dataSetSn=(\d+)", " ".join(a["href"] for a in soup.find_all("a", href=True)))
    rec["related_ids"] = sorted({r for r in rel if r != dataset_id}, key=int)
    return rec


_TREE_FILE = re.compile(r"[├└]─(.+?)\s*\|\s*([\d.]+)\s*(B|KB|MB|GB|TB)\s*\|\s*(\d+)\s*$")
_UNIT = {"B": 1 / 1024**3, "KB": 1 / 1024**2, "MB": 1 / 1024, "GB": 1.0, "TB": 1024.0}


def parse_filetree(text: str) -> dict:
    """File tree text -> files with size (GB) and file key, plus totals."""
    files = []
    for line in text.splitlines():
        m = _TREE_FILE.search(line)
        if m:
            files.append({"name": m.group(1).strip(), "size_gb": float(m.group(2)) * _UNIT[m.group(3)],
                          "file_key": m.group(4), "depth": (len(line) - len(line.lstrip(" │├└─"))) // 3})
    total = sum(f["size_gb"] for f in files)
    return {"n_files": len(files), "total_gb": round(total, 2),
            "smallest_file_gb": round(min((f["size_gb"] for f in files), default=0), 3), "files": files}
