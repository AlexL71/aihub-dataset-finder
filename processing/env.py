"""Read the .env file. Kept on its own so embeddings can get their API key without the web collector code."""
from __future__ import annotations

from pathlib import Path


def load_dotenv(path: Path) -> dict[str, str]:
    """Minimal .env reader (KEY=VALUE lines). Values are not printed or logged."""
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env
