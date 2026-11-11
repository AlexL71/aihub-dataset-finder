"""Parse AI Hub dataset documents (데이터 설명서 etc.) into clean text.

Supported: PDF (PyMuPDF, tables kept as rows), HWP (pyhwp hwp5html -> tables kept),
HWPX (zip + XML, tables kept), ZIP (CP949 file names, members parsed recursively), XLSX (openpyxl).
Emails and phone numbers are removed (privacy).

Usage (project root):
    python -m processing.parse_docs                 # all datasets in data/raw/aihub/docs
    python -m processing.parse_docs --ids 75 71704
    python -m processing.parse_docs --hwp-method txt   # compare: plain hwp5txt
Output: data/parsed/aihub/docs/<ID>.json and <ID>.md (for reading)
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENV_SCRIPTS = Path(sys.executable).parent
log = logging.getLogger("parse_docs")

_EMAIL = re.compile(r"[\w.+-]+\s?@\s?[\w-]+(?:\s?\.\s?[\w-]+)+")
_PHONE = re.compile(r"(?<!\d)(?:0\d{1,2}[-.\s)]?\d{3,4}[-.\s]?\d{4}|\+82[-\s]?\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4})(?!\d)")
_HANGUL = re.compile(r"[가-힣]")
# Lines of contact tables (person names, phones, emails). Organization names come from the page parser.
_CONTACT_LINE = re.compile(r"\[이메일\]|\[전화번호\]|담당자명|책임자명|문의담당|메일주소|연락처")


def redact(text: str) -> str:
    """Remove emails/phones, then drop whole lines that belong to contact tables (names)."""
    text = _PHONE.sub("[전화번호]", _EMAIL.sub("[이메일]", text))
    return "\n".join(l for l in text.splitlines() if not _CONTACT_LINE.search(l))


def _cell(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _rows_to_lines(rows: list[list[str]]) -> list[str]:
    lines = []
    for r in rows:
        cells = [_cell(c or "") for c in r]
        if any(cells):
            lines.append("| " + " | ".join(cells) + " |")
    return lines


# ---------------- PDF ----------------
def parse_pdf(path: Path) -> dict:
    import pymupdf

    doc = pymupdf.open(path)
    parts, n_tables = [], 0
    for page in doc:
        items = []  # (y, text)
        try:
            tables = list(page.find_tables().tables)
        except Exception as exc:  # table finder can fail on odd pages
            log.debug("find_tables failed on %s p%d: %s", path.name, page.number, exc)
            tables = []
        boxes = [pymupdf.Rect(t.bbox) for t in tables]
        for t in tables:
            items.append((t.bbox[1], "\n".join(_rows_to_lines(t.extract()))))
        n_tables += len(tables)
        for x0, y0, x1, y1, text, *_ in page.get_text("blocks"):
            r = pymupdf.Rect(x0, y0, x1, y1)
            if any(b.intersects(r) and (b & r).get_area() > 0.5 * r.get_area() for b in boxes):
                continue  # text already captured inside a table
            t = text.strip()
            if t:
                items.append((y0, t))
        items.sort(key=lambda it: it[0])
        parts.append("\n".join(t for _, t in items))
    return {"text": "\n\n".join(parts), "n_pages": len(doc), "n_tables": n_tables}


# ---------------- HWP ----------------
def _run_pyhwp(tool: str, args: list[str]) -> subprocess.CompletedProcess:
    exe = VENV_SCRIPTS / f"{tool}.exe"
    if not exe.exists():
        exe = VENV_SCRIPTS / tool
    return subprocess.run([str(exe), *args], capture_output=True, timeout=600,
                          env={**__import__("os").environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"})


def parse_hwp_txt(path: Path) -> dict:
    res = _run_pyhwp("hwp5txt", [str(path)])
    if res.returncode != 0:
        raise RuntimeError(res.stderr.decode("utf-8", "replace")[-500:])
    text = res.stdout.decode("utf-8", "replace")
    return {"text": text, "n_pages": None, "n_tables": text.count("<표>")}


_HWPTAG_PARA_TEXT = 67  # HWPTAG_BEGIN (16) + 51
# Control codes that take 8 UTF-16 units (inline/extended controls such as tables, fields, pictures).
_HWP_WIDE_CTRL = {1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23}
MIN_HWP_CHARS = 200  # below this the pyhwp output is treated as failed and the OLE reader is tried


def _hwp_para_text(data: bytes) -> str:
    units = [int.from_bytes(data[i:i + 2], "little") for i in range(0, len(data) - 1, 2)]
    out, i = [], 0
    while i < len(units):
        c = units[i]
        if c in _HWP_WIDE_CTRL:
            i += 8
            continue
        if c < 32:
            out.append("\t" if c == 9 else " " if c in (10, 24, 30, 31) else "")
        else:
            out.append(chr(c))
        i += 1
    return "".join(out).strip()


def parse_hwp_ole(path: Path) -> dict:
    """Read paragraph text straight from the HWP 5 BodyText streams (no pyhwp).

    Fallback for files where pyhwp crashes or times out. Table cells come out as one
    paragraph per line (no row structure). Distribution-protected files (ViewText) are not supported.
    """
    import olefile
    import zlib

    with olefile.OleFileIO(str(path)) as ole:
        header = ole.openstream("FileHeader").read()
        compressed = bool(header[36] & 1)
        if header[36] & 6:  # bit 1: password, bit 2: distribution document (ViewText)
            raise RuntimeError("password- or distribution-protected HWP is not supported")
        sections = sorted((s for s in ole.listdir() if len(s) == 2 and s[0] == "BodyText"),
                          key=lambda s: int(re.sub(r"\D", "", s[1]) or 0))
        lines: list[str] = []
        for s in sections:
            data = ole.openstream(s).read()
            if compressed:
                data = zlib.decompress(data, -15)
            pos = 0
            while pos + 4 <= len(data):
                h = int.from_bytes(data[pos:pos + 4], "little")
                tag, size = h & 0x3FF, h >> 20
                pos += 4
                if size == 0xFFF:
                    size = int.from_bytes(data[pos:pos + 4], "little")
                    pos += 4
                if tag == _HWPTAG_PARA_TEXT:
                    t = _hwp_para_text(data[pos:pos + size])
                    if t:
                        lines.append(t)
                pos += size
    return {"text": "\n".join(_drop_contact_cells(lines)), "n_pages": None, "n_tables": 0}


_CONTACT_HEAD = re.compile(r"문의처|담당자|책임자|전화번호|연락처|이메일|E-?mail|성명", re.I)
_NAME_CELL = re.compile(r"^[가-힣]{2,4}$")
CONTACT_WINDOW = 8  # lines after a contact header that may hold a person's name


def _drop_contact_cells(lines: list[str]) -> list[str]:
    """One-cell-per-line text loses the table rows that `redact` relies on, so drop
    contact headers and short name-like cells that follow them."""
    out, left = [], 0
    for l in lines:
        if len(l) <= 20 and _CONTACT_HEAD.search(l):  # header cells are short; long lines are content
            left = CONTACT_WINDOW
            continue
        if left:
            left -= 1
            if _NAME_CELL.match(l.strip()):
                continue
        out.append(l)
    return out


# Control characters that are invalid in XML 1.0 (some HWP files carry them into hwp5html output).
_XML_BAD = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def parse_hwp_html(path: Path) -> dict:
    from bs4 import BeautifulSoup

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "html"
        res = _run_pyhwp("hwp5html", ["--output", str(out), str(path)])
        if res.returncode != 0:
            raise RuntimeError(res.stderr.decode("utf-8", "replace")[-500:])
        xhtml = (out / "index.xhtml").read_text(encoding="utf-8", errors="replace")
        soup = BeautifulSoup(_XML_BAD.sub(" ", xhtml), "xml")

    lines: list[str] = []
    n_tables = 0
    body = soup.find("body") or soup
    # Walk top-level blocks in order; a table is flattened row by row (nested tables -> cell text).
    for el in body.find_all(["p", "table"]):
        if el.find_parent("table") is not None:
            continue
        if el.name == "table":
            n_tables += 1
            rows = [[td.get_text(" ") for td in tr.find_all(["td", "th"], recursive=False)]
                    for tr in el.find_all("tr") if tr.find_parent("table") is el]
            lines.extend(_rows_to_lines(rows))
        else:
            t = _cell(el.get_text(" "))
            if t:
                lines.append(t)
    return {"text": "\n".join(lines), "n_pages": None, "n_tables": n_tables}


# ---------------- HWPX (zip + XML) ----------------
_HP = "{http://www.hancom.co.kr/hwpml/2011/paragraph}"


def _hwpx_text(el) -> str:
    return "".join(t.text or "" for t in el.iter(f"{_HP}t"))


def _hwpx_outside_tables(p) -> str:
    """Text of a paragraph without the text of tables nested in it."""
    parts = []
    for t in p.iter(f"{_HP}t"):
        anc = t.getparent()
        while anc is not None and anc is not p and anc.tag != f"{_HP}tbl":
            anc = anc.getparent()
        if anc is p:
            parts.append(t.text or "")
    return "".join(parts)


def parse_hwpx(path: Path) -> dict:
    from lxml import etree

    lines: list[str] = []
    n_tables = 0
    with zipfile.ZipFile(path) as z:
        sections = sorted((n for n in z.namelist() if re.match(r"Contents/section\d+\.xml$", n)),
                          key=lambda n: int(re.search(r"(\d+)", n.rsplit("/", 1)[1]).group(1)))
        for name in sections:
            root = etree.fromstring(z.read(name))
            for p in root.iterchildren(f"{_HP}p"):  # top-level paragraphs in document order
                t = _cell(_hwpx_outside_tables(p))
                if t:
                    lines.append(t)
                # tables anchored in this paragraph, but not tables nested inside other tables
                for tbl in p.iter(f"{_HP}tbl"):
                    parent_tbl = next((a for a in tbl.iterancestors(f"{_HP}tbl")), None)
                    if parent_tbl is not None:
                        continue
                    n_tables += 1
                    rows = [[_hwpx_text(tc) for tc in tr.iterchildren(f"{_HP}tc")]
                            for tr in tbl.iterchildren(f"{_HP}tr")]
                    lines.extend(_rows_to_lines(rows))
    return {"text": "\n".join(lines), "n_pages": None, "n_tables": n_tables}


# ---------------- XLSX ----------------
XLSX_MAX_ROWS = 60  # per sheet; long sheets are file/label lists, the first rows show their structure


def parse_xlsx(path: Path) -> dict:
    import openpyxl

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    lines, n = [], 0
    for ws in wb.worksheets:
        lines.append(f"## 시트: {ws.title}")
        rows = [[("" if v is None else str(v)) for v in row] for row in ws.iter_rows(values_only=True)]
        rows = [r for r in rows if any(c.strip() for c in r)]
        lines.extend(_rows_to_lines(rows[:XLSX_MAX_ROWS]))
        if len(rows) > XLSX_MAX_ROWS:
            lines.append(f"(... {len(rows) - XLSX_MAX_ROWS}개 행 생략, 전체 {len(rows)}행)")
        n += 1
    wb.close()  # read-only workbooks keep the file open; Windows then cannot delete the temp copy
    return {"text": "\n".join(lines), "n_pages": None, "n_tables": n}


# ---------------- ZIP ----------------
def _zip_name(info: zipfile.ZipInfo) -> str:
    if info.flag_bits & 0x800:  # already UTF-8
        return info.filename
    try:
        return info.filename.encode("cp437").decode("cp949")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return info.filename


_VERSION = re.compile(r"[_\s-]v(\d+(?:\.\d+)*)", re.I)


def _pick_members(names: list[str]) -> list[str]:
    """If several versions of the same document exist (…_v2.1.pdf), keep only the newest."""
    def stem_key(n: str) -> str:
        return _VERSION.sub("", Path(n).stem).strip().lower() + Path(n).suffix.lower()

    def ver(n: str) -> tuple:
        m = _VERSION.search(Path(n).stem)
        return tuple(int(x) for x in m.group(1).split(".")) if m else (0,)

    best: dict[str, str] = {}
    for n in names:
        k = stem_key(n)
        if k not in best or ver(n) > ver(best[k]):
            best[k] = n
    return sorted(best.values())


def parse_zip(path: Path, hwp_method: str) -> dict:
    parts, n_pages, n_tables, members = [], 0, 0, []
    with zipfile.ZipFile(path) as z, tempfile.TemporaryDirectory() as tmp:
        infos = {_zip_name(i): i for i in z.infolist() if not i.is_dir()}
        for name in _pick_members(list(infos)):
            target = Path(tmp) / f"m{len(members)}{Path(name).suffix.lower()}"
            target.write_bytes(z.read(infos[name]))
            try:
                r = parse_file(target, hwp_method)
            except ValueError:
                log.info("skip unsupported zip member %s", name)
                continue
            members.append(name)
            parts.append(f"## 파일: {name}\n{r['text']}")
            n_pages += r["n_pages"] or 0
            n_tables += r["n_tables"]
    return {"text": "\n\n".join(parts), "n_pages": n_pages or None, "n_tables": n_tables, "members": members}


# ---------------- dispatch ----------------
def detect(path: Path) -> str:
    head = path.read_bytes()[:8]
    if head.startswith(b"%PDF"):
        return "pdf"
    if head.startswith(b"\xd0\xcf\x11\xe0"):
        return "hwp"  # OLE compound file (HWP 5.x)
    if head.startswith(b"PK"):
        return {".xlsx": "xlsx", ".hwpx": "hwpx"}.get(path.suffix.lower(), "zip")
    raise ValueError(f"unsupported file type: {path.name}")


def parse_file(path: Path, hwp_method: str = "html") -> dict:
    kind = detect(path)
    if kind == "pdf":
        r = parse_pdf(path)
    elif kind == "hwp":
        r = None
        if hwp_method == "html":
            try:
                r = parse_hwp_html(path)
            except Exception as e:  # pyhwp's own XML step or a timeout; plain text loses tables but keeps content
                log.warning("%s: hwp5html failed (%s), falling back to hwp5txt", path, type(e).__name__)
        if r is None and hwp_method in ("html", "txt"):
            try:
                r = parse_hwp_txt(path)
                if hwp_method == "html":
                    r["fallback"] = "hwp5txt"
            except Exception as e:
                log.warning("%s: hwp5txt failed (%s), falling back to the OLE reader", path, type(e).__name__)
        if r is None or len(r["text"].strip()) < MIN_HWP_CHARS:
            ole = parse_hwp_ole(path)
            if r is None or len(ole["text"].strip()) > len(r["text"].strip()):
                r = {**ole, "fallback": "hwp_ole"}
    elif kind == "hwpx":
        r = parse_hwpx(path)
    elif kind == "xlsx":
        r = parse_xlsx(path)
    elif kind == "zip":
        r = parse_zip(path, hwp_method)
    else:
        raise ValueError(f"unsupported file type: {kind}")
    r["format"] = kind
    return r


def quality(text: str) -> dict:
    """Simple checks: amount of text, share of Korean letters, broken-line share."""
    lines = [l for l in text.splitlines() if l.strip()]
    letters = sum(c.isalpha() for c in text)
    short = sum(1 for l in lines if len(l.strip()) <= 3)
    return {"n_chars": len(text), "n_lines": len(lines),
            "hangul_ratio": round(len(_HANGUL.findall(text)) / letters, 3) if letters else 0.0,
            "short_line_ratio": round(short / len(lines), 3) if lines else 0.0}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ids", nargs="+")
    p.add_argument("--hwp-method", choices=["html", "txt", "ole"], default="html")
    p.add_argument("--out", default="data/parsed/aihub/docs")
    args = p.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s", handlers=[logging.StreamHandler(sys.stdout)])

    raw = ROOT / "data" / "raw" / "aihub" / "docs"
    out = ROOT / args.out
    out.mkdir(parents=True, exist_ok=True)
    ids = args.ids or sorted((d.name for d in raw.iterdir() if d.is_dir()), key=int)
    for ds in ids:
        for f in sorted((raw / ds).glob("data_manual.*")):
            try:
                r = parse_file(f, args.hwp_method)
            except Exception as exc:
                log.error("%s %s failed: %s", ds, f.name, exc)
                continue
            r["text"] = redact(r["text"])
            rec = {"dataset_id": ds, "source": str(f.relative_to(ROOT)), "doc_type": "data_manual",
                   "method": r.get("fallback") or (f"hwp5{args.hwp_method}" if r["format"] == "hwp" else r["format"]),
                   **{k: v for k, v in r.items() if k != "text"}, **quality(r["text"]), "text": r["text"]}
            (out / f"{ds}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
            (out / f"{ds}.md").write_text(r["text"], encoding="utf-8")
            log.info("%-6s %-4s chars=%-6d tables=%-3d hangul=%.2f short=%.2f", ds, r["format"],
                     rec["n_chars"], rec["n_tables"], rec["hangul_ratio"], rec["short_line_ratio"])


if __name__ == "__main__":
    main()
