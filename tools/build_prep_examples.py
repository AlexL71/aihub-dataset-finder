"""Build the examples for the "데이터 준비 과정" (data preparation) page: one dataset followed through every step.

Reads the real files of one dataset and writes short excerpts to data/about/prep_example.json, which the app
serves at /api/about/prep. Run it again only when the data is rebuilt (it reads local files, no network):

    python -m tools.build_prep_examples            # dataset 74 (음식 이미지 및 영양정보 텍스트)
    python -m tools.build_prep_examples --id 140

The raw page HTML is not kept in git (data/raw/ is ignored). Save the dataset's public AI Hub page first as
data/raw/aihub/pages/<id>.html (one request, e.g. with a browser "Save page as", or curl).
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "about" / "prep_example.json"
PAGE_URL = "https://www.aihub.or.kr/aihubdata/data/view.do?currMenu=115&topMenu=100&aihubDataSe=data&dataSetSn={id}"

# How much of each step to show (lines). The full text can be long; the page says how much was left out.
MAX_LINES = {"html": 120, "filetree": 32, "page": 60, "manual": 60}
N_CHUNKS = 3


def _cut(text: str, n: int) -> dict:
    lines = text.strip("\n").splitlines()
    return {"text": "\n".join(lines[:n]), "lines": len(lines), "shown": min(n, len(lines)), "chars": len(text)}


def _html_excerpt(path: Path) -> str:
    """The dataset header (facts) and the first content section ("데이터 개요"), tidied: no scripts, no buttons,
    one tag or text per line. This is the part of the page the parser reads first."""
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "lxml")
    parts = [soup.select_one("div.dataHead"), soup.select_one("ul.dataContent > li")]
    out = []
    for el in filter(None, parts):
        for x in el.select("div.function, script, style, img"):
            x.decompose()
        out.append(str(el))
    # the page's own line breaks, without its deep tab indentation, blank lines and runs of spaces
    lines = (re.sub(r"\s{2,}", " ", ln.strip()) for ln in "\n".join(out).splitlines())
    return "\n".join(ln for ln in lines if ln)


def _page_text(page: dict) -> str:
    """The parsed page as the parser writes it: header facts, then each section's text."""
    head = [f"제목: {page['title']}", f"분야: {page['field']}", f"유형: {page['data_type']}",
            f"구축년도: {page['build_year']}", f"갱신년월: {page['last_update']}",
            f"조회수: {page['views']}", f"다운로드: {page['downloads']}",
            f"주요 키워드: {', '.join(page['tags'])}", f"수행기관: {page['lead_organization']}", ""]
    body = [f"[{name}]\n{text.strip()}\n" for name, text in page["sections"].items()]
    return "\n".join(head + body)


def _tree_text(path: Path) -> str:
    """The file list from the first tree line on (AI Hub puts an encoding notice and a notice box above it)."""
    lines = path.read_text(encoding="utf-8").splitlines()
    start = next((i for i, ln in enumerate(lines) if "└─" in ln or "├─" in ln), 0)
    return "\n".join(lines[start:])


def _jsonl(path: Path, dataset_id: str) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return [d for d in map(json.loads, f) if str(d.get("dataset_id")) == dataset_id]


def build(dataset_id: str) -> dict:
    page = json.loads((DATA / "parsed" / "aihub" / "pages" / f"{dataset_id}.json").read_text(encoding="utf-8"))
    record = json.loads((DATA / "enriched" / "aihub" / f"{dataset_id}.json").read_text(encoding="utf-8"))
    html_file = DATA / "raw" / "aihub" / "pages" / f"{dataset_id}.html"
    if not html_file.exists():
        raise SystemExit(f"Save the AI Hub page first: {html_file}\n  {PAGE_URL.format(id=dataset_id)}")
    tree_file = DATA / "raw" / "aihub" / "filetree" / f"{dataset_id}.txt"
    manual_file = DATA / "parsed" / "aihub" / "docs" / f"{dataset_id}.md"
    cards = _jsonl(DATA / "index" / "cards.jsonl", dataset_id)
    chunks = _jsonl(DATA / "index" / "chunks.jsonl", dataset_id)

    chunk_text = "\n\n".join(f"── {c['chunk_id']} · {'페이지' if c['source'] == 'page' else '설명서'} · {c.get('section') or '-'} ──\n{c['text']}"
                             for c in chunks[:N_CHUNKS])
    ex = {
        "html": _cut(_html_excerpt(html_file), MAX_LINES["html"]),
        "filetree": _cut(_tree_text(tree_file), MAX_LINES["filetree"]) if tree_file.exists() else None,
        "page": _cut(_page_text(page), MAX_LINES["page"]),
        "manual": _cut(manual_file.read_text(encoding="utf-8"), MAX_LINES["manual"]) if manual_file.exists() else None,
        "record": _cut(json.dumps(record, ensure_ascii=False, indent=1), 10_000),
        "card": _cut(cards[0]["text"], 10_000) if cards else None,
        "chunks": {**_cut(chunk_text, 10_000), "count": len(chunks)},
    }
    return {"dataset_id": dataset_id, "title_ko": page["title"], "title_en": record.get("title_en", ""),
            "url": PAGE_URL.format(id=dataset_id), "built": date.today().isoformat(),
            "examples": {k: v for k, v in ex.items() if v}}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--id", default="74", help="AI Hub dataset id (default 74)")
    args = ap.parse_args()
    out = build(args.id)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    sizes = ", ".join(f"{k} {v['shown']}/{v['lines']} lines" for k, v in out["examples"].items())
    print(f"wrote {OUT.relative_to(ROOT)}: {out['title_ko']} ({sizes})")


if __name__ == "__main__":
    main()
