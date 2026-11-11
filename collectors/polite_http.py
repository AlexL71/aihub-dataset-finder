"""Polite HTTP client shared by all collectors.

Rules (see docs/PLAN.md section 4.4):
- one request at a time, random delay between requests to the same host
- robots.txt respected (if a site's robots.txt can't be read, we allow but log it)
- retries with exponential backoff on timeouts, 429 and 5xx
- hard stop on 401/403 or a "blocked"/CAPTCHA page -> CollectionStopped
- every finished file is saved to disk; existing files are never fetched again (resume)
- every request is logged to data/manifest.csv
"""
from __future__ import annotations

import csv
import hashlib
import logging
import os
import random
import time
import urllib.robotparser
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests

log = logging.getLogger(__name__)
KST = timezone(timedelta(hours=9))
MANIFEST_FIELDS = ["time_kst", "source", "item_id", "kind", "url", "status", "bytes",
                   "sha256", "content_type", "path", "note"]


class CollectionStopped(RuntimeError):
    """Raised when the site signals we should stop (403, CAPTCHA, request cap reached)."""


@dataclass
class FetchResult:
    url: str
    status: int | None
    path: Path | None
    content_type: str = ""
    n_bytes: int = 0
    sha256: str = ""
    from_cache: bool = False
    note: str = ""


def _in_run_window(window: str | None) -> bool:
    if not window:
        return True
    start_s, end_s = window.split("-")
    now = datetime.now(KST).time()
    start = datetime.strptime(start_s, "%H:%M").time()
    end = datetime.strptime(end_s, "%H:%M").time()
    return start <= now <= end if start <= end else (now >= start or now <= end)


class PoliteSession:
    def __init__(self, http_cfg: dict, data_dir: Path, contact_email: str = "",
                 extra_headers: dict[str, str] | None = None):
        self.cfg = http_cfg
        self.data_dir = data_dir
        self.manifest_path = data_dir / "manifest.csv"
        self.session = requests.Session()
        ua = http_cfg["user_agent"]
        if contact_email:
            ua = ua.rstrip(")") + f"; contact: {contact_email})"
        self.session.headers.update({"User-Agent": ua, "Accept-Language": "ko,en;q=0.8"})
        if extra_headers:
            self.session.headers.update(extra_headers)
        self._last_request: dict[str, float] = {}
        self._robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}
        self.n_requests = 0

    # ---------- politeness ----------
    def _robots_allowed(self, url: str) -> bool:
        parts = urlparse(url)
        host = f"{parts.scheme}://{parts.netloc}"
        if host not in self._robots:
            rp = urllib.robotparser.RobotFileParser()
            try:
                self._wait(parts.netloc)
                r = self.session.get(host + "/robots.txt", timeout=self.cfg["timeout_sec"])
                self.n_requests += 1
                if r.status_code == 200 and "text" in r.headers.get("Content-Type", "text"):
                    rp.parse(r.text.splitlines())
                    self._robots[host] = rp
                else:
                    log.warning("robots.txt for %s returned %s; treating as no rules", host, r.status_code)
                    self._robots[host] = None
            except requests.RequestException as exc:
                log.warning("robots.txt for %s failed (%s); treating as no rules", host, exc)
                self._robots[host] = None
        rp = self._robots[host]
        return True if rp is None else rp.can_fetch(self.session.headers["User-Agent"], url)

    def _wait(self, netloc: str) -> None:
        delay = random.uniform(self.cfg["delay_sec_min"], self.cfg["delay_sec_max"])
        elapsed = time.monotonic() - self._last_request.get(netloc, 0.0)
        if elapsed < delay:
            time.sleep(delay - elapsed)
        self._last_request[netloc] = time.monotonic()

    def _check_limits(self) -> None:
        if self.n_requests >= self.cfg["max_requests_per_run"]:
            raise CollectionStopped(f"request cap reached ({self.n_requests})")
        if not _in_run_window(self.cfg.get("run_window_kst")):
            raise CollectionStopped(f"outside run window {self.cfg['run_window_kst']} KST")

    def _looks_blocked(self, resp: requests.Response) -> bool:
        ctype = resp.headers.get("Content-Type", "")
        if "html" not in ctype and "text" not in ctype:
            return False
        head = resp.content[:20000].decode("utf-8", errors="ignore").lower()
        return any(m.lower() in head for m in self.cfg["block_markers"])

    # ---------- main API ----------
    def fetch(self, url: str, dest: Path, *, source: str, item_id: str, kind: str,
              accept_status: tuple[int, ...] = (200,), force: bool = False) -> FetchResult:
        """Download url to dest (atomic write). Skips if dest already exists (resume)."""
        if dest.exists() and not force:
            return FetchResult(url, None, dest, from_cache=True, n_bytes=dest.stat().st_size)
        if not self._robots_allowed(url):
            res = FetchResult(url, None, None, note="disallowed by robots.txt")
            self._log(source, item_id, kind, res)
            return res

        netloc = urlparse(url).netloc
        last_exc: Exception | None = None
        for attempt in range(self.cfg["max_retries"] + 1):
            self._check_limits()
            self._wait(netloc)
            try:
                resp = self.session.get(url, timeout=self.cfg["timeout_sec"], stream=True)
                self.n_requests += 1
            except requests.RequestException as exc:
                last_exc = exc
                self._backoff(attempt, f"{type(exc).__name__}")
                continue

            if resp.status_code in self.cfg["stop_on_status"]:
                res = FetchResult(url, resp.status_code, None, note="hard stop status")
                self._log(source, item_id, kind, res)
                raise CollectionStopped(f"HTTP {resp.status_code} for {url}")
            if resp.status_code in accept_status:
                return self._save(resp, dest, source, item_id, kind)
            if resp.status_code == 429 or resp.status_code >= 500:
                self._backoff(attempt, f"HTTP {resp.status_code}")
                continue
            res = FetchResult(url, resp.status_code, None, note="unexpected status")
            self._log(source, item_id, kind, res)
            return res

        res = FetchResult(url, None, None, note=f"gave up after retries: {last_exc}")
        self._log(source, item_id, kind, res)
        return res

    def _backoff(self, attempt: int, reason: str) -> None:
        wait = self.cfg["backoff_base_sec"] * (2 ** attempt) + random.uniform(0, 3)
        log.warning("%s -> retry in %.0f s (attempt %d)", reason, wait, attempt + 1)
        time.sleep(wait)

    def _save(self, resp: requests.Response, dest: Path, source: str, item_id: str, kind: str) -> FetchResult:
        if self._looks_blocked(resp):
            res = FetchResult(resp.url, resp.status_code, None, note="block/captcha page detected")
            self._log(source, item_id, kind, res)
            raise CollectionStopped(f"block page detected at {resp.url}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".part")
        sha = hashlib.sha256()
        n = 0
        with open(tmp, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=1 << 16):
                fh.write(chunk)
                sha.update(chunk)
                n += len(chunk)
        os.replace(tmp, dest)
        res = FetchResult(resp.url, resp.status_code, dest, resp.headers.get("Content-Type", ""),
                          n, sha.hexdigest(), note=resp.headers.get("Content-Disposition", ""))
        self._log(source, item_id, kind, res)
        return res

    def _log(self, source: str, item_id: str, kind: str, res: FetchResult) -> None:
        new = not self.manifest_path.exists()
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.manifest_path, "a", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=MANIFEST_FIELDS)
            if new:
                w.writeheader()
            w.writerow({
                "time_kst": datetime.now(KST).isoformat(timespec="seconds"),
                "source": source, "item_id": item_id, "kind": kind, "url": res.url,
                "status": res.status, "bytes": res.n_bytes, "sha256": res.sha256,
                "content_type": res.content_type,
                "path": str(res.path.relative_to(self.data_dir)) if res.path else "",
                "note": res.note,
            })
