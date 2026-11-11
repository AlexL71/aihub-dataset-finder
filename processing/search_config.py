"""Load config/search.yaml. Kept on its own so search can start without the chunking and enrichment code."""
from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
SEARCH_CFG = ROOT / "config" / "search.yaml"


def load_search_cfg() -> dict:
    cfg = yaml.safe_load(SEARCH_CFG.read_text(encoding="utf-8"))
    for k, v in cfg["paths"].items():
        cfg["paths"][k] = ROOT / v
    return cfg
