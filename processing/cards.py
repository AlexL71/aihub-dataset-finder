"""Shared helpers for showing a dataset: the facts table and small text formatters.

Used by the search test page (tools/search_ui.py) and the student app (app/server.py), so both show the same facts.
"""
from __future__ import annotations

MODALITY = {"image": ("이미지", "image"), "video": ("영상", "video"), "text": ("텍스트", "text"),
            "audio": ("소리·음성", "audio"), "3d": ("3D", "3D"), "sensor": ("센서", "sensor"),
            "tabular": ("표", "table")}
LEVEL = {"beginner": ("입문", "beginner"), "intermediate": ("중급", "intermediate"), "advanced": ("고급", "advanced")}


def has_hangul(text: str) -> bool:
    return any("가" <= c <= "힣" for c in text)


def size_text(gb: float | None) -> str:
    if gb is None:
        return "?"
    if gb * 1024 < 1:
        return "< 1 MB"
    return f"{gb * 1024:.0f} MB" if gb < 1 else f"{gb:,.0f} GB"


def facts(r: dict, x: dict) -> list[dict]:
    """Rows for the facts table, each with a Korean and an English label and value.

    r = dataset record from data/enriched/aihub_datasets.json;
    x = its easy-explanation fields (amount_*, labels_*): a file in data/enriched/explanations/ or the record itself.
    """
    mods = [MODALITY.get(m, (m, m)) for m in r["modalities"]]
    rows = [
        ("데이터 종류", "Data type", " · ".join(m[0] for m in mods), " · ".join(m[1] for m in mods)),
        ("파일 형식", "File formats", ", ".join(r["file_formats"]) or "?", ", ".join(r["file_formats"]) or "?"),
        ("데이터 양", "Amount", x.get("amount_ko") or r["scale_ko"], x.get("amount_en") or r["scale_ko"]),
        ("라벨(표시)", "Labels", x.get("labels_ko") or ", ".join(r["labels"]), x.get("labels_en") or ", ".join(r["labels"])),
    ]
    if r["classes_example"]:
        ex = ", ".join(r["classes_example"][:8])
        rows.append(("항목 예시", "Example classes", ex, ex))
    files = f"{r['n_files']:,}" if r.get("n_files") else "?"
    rows += [
        ("용량", "Size", f"{size_text(r['total_gb'])} (가장 작은 파일 {size_text(r['smallest_file_gb'])}, 파일 {files}개)",
         f"{size_text(r['total_gb'])} (smallest file {size_text(r['smallest_file_gb'])}, {files} files)"),
        ("난이도", "Level", LEVEL[r["difficulty"]][0], LEVEL[r["difficulty"]][1]),
        ("만든 해·기관", "Built", f"{r['build_year']} · {r['lead_organization']}", f"{r['build_year']} · {r['lead_organization']}"),
    ]
    if r["baseline"]:
        b = "; ".join(f"{bl['model']} {bl['metric']} {bl['value']}" for bl in r["baseline"][:2])
        rows.append(("기준 성능", "Baseline", b, b))
    return [{"ko": a, "en": b, "v_ko": c, "v_en": d} for a, b, c, d in rows]
