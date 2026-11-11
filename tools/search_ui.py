"""Simple local test page for the dataset search (a testing tool, not the student UI).

Run (project root):
    .venv/Scripts/python -m tools.search_ui            # then open http://127.0.0.1:8765
    .venv/Scripts/python -m tools.search_ui --port 9000

Uses only Python's built-in web server. It listens on 127.0.0.1, so only this computer can open it
(AI Hub's terms need approval before records are shown to other people). Each new query is embedded once
through the Gemini API (needs internet + GEMINI_API_KEY), then cached. Stop it with Ctrl+C.

Each result shows an easy explanation, a facts table and a "자세히" (details) part. Easy/detail texts come from
data/enriched/explanations/<id>.json when that file exists (sample of 20 so far); otherwise the record summary
is shown. Instead of a yes/no "no match" warning, each result gets a match label (strong / partial / weak)
and every result list ends with search links to other dataset sites (config/search.yaml).
"""
from __future__ import annotations

import argparse
import json
import logging
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote_plus, urlparse

import yaml

from processing import cards
from processing.cards import has_hangul
from processing.domains import load_domains
from processing.search import SearchIndex

ROOT = Path(__file__).resolve().parents[1]
EXPORT = ROOT / "data" / "enriched" / "aihub_datasets.json"
EXPLAIN = ROOT / "data" / "enriched" / "explanations"
TASKS_FILE = ROOT / "config" / "tasks.yaml"
MAX_K = 50


class App:
    def __init__(self) -> None:
        t0 = time.time()
        self.idx = SearchIndex()
        self.recs = {r["dataset_id"]: r for r in json.loads(EXPORT.read_text(encoding="utf-8"))["datasets"]}
        self.domains = load_domains()["domains"]
        self.tasks = yaml.safe_load(TASKS_FILE.read_text(encoding="utf-8"))["tasks"]
        print(f"index loaded in {time.time() - t0:.0f} s ({len(self.recs)} datasets)")

    def explanation(self, i: str) -> dict:
        """Read fresh each time, so edited explanation files show up without a restart."""
        p = EXPLAIN / f"{i}.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}

    def facts(self, r: dict, x: dict) -> list[dict]:
        """Rows for the facts table (shared with the student app: processing/cards.py)."""
        return cards.facts(r, x)

    def search(self, q: str, k: int) -> dict:
        t0 = time.time()
        hits = self.idx.search(q, k)
        cfg = self.idx.cfg
        th = cfg["match_label"]["korean" if has_hangul(q) else "english"]
        rows = []
        for h in hits:
            r, x = self.recs[h.dataset_id], self.explanation(h.dataset_id)
            label = "strong" if h.card_cos >= th["strong"] else "partial" if h.card_cos >= th["partial"] else "weak"
            ch = h.best_chunk or {}
            rows.append({
                "id": h.dataset_id, "title_ko": r["title_ko"], "title_en": r["title_en"],
                "easy_ko": x.get("easy_ko") or r["summary_ko"], "easy_en": x.get("easy_en") or r["summary_en"],
                "detail_ko": x.get("detail_ko") or r["contents_ko"], "detail_en": x.get("detail_en") or r["contents_en"],
                "has_explanation": bool(x), "facts": self.facts(r, x), "match": label,
                "domains_ko": [self.domains[d]["ko"] for d in r["domains"]],
                "domains_en": [self.domains[d]["en"] for d in r["domains"]],
                "tasks_ko": [self.tasks[t]["ko"] for t in r["tasks"]], "tasks_en": [self.tasks[t]["en"] for t in r["tasks"]],
                "score": round(h.score, 4), "card_cos": round(h.card_cos, 3), "chunk_cos": round(h.chunk_cos, 3),
                "lists": h.lists, "passage_section": ch.get("section", ""), "passage_source": ch.get("source", ""),
                "passage": ch.get("text", "")[:600], "url": r["source_url"],
            })
        sites = [{"name": s["name"], "url": s["url"].replace("{q}", quote_plus(q))} for s in cfg["other_sites"]]
        return {"query": q, "ms": int((time.time() - t0) * 1000), "rows": rows, "sites": sites,
                "hangul": has_hangul(q)}


PAGE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Search test</title>
<style>
 :root { --bg:#f7f7f8; --card:#fff; --text:#1d1d1f; --muted:#6b6b70; --line:#e2e2e6; --accent:#2f5bd3; --soft:#f1f2f5;
         --strong:#1e7a45; --strongbg:#e3f4ea; --partial:#8a5a00; --partialbg:#fff1d6; --weak:#6b6b70; --weakbg:#eeeef1; }
 @media (prefers-color-scheme: dark) { :root { --bg:#17171a; --card:#222226; --text:#ececef; --muted:#a0a0a8; --line:#36363c; --accent:#7f9cff; --soft:#2a2a2f;
         --strong:#7fd6a0; --strongbg:#1d3a2a; --partial:#f0c060; --partialbg:#3a3018; --weak:#a0a0a8; --weakbg:#2e2e33; } }
 * { box-sizing:border-box } body { margin:0; background:var(--bg); color:var(--text); font:15px/1.6 system-ui, "Malgun Gothic", sans-serif }
 main { max-width:900px; margin:0 auto; padding:20px 16px 60px }
 h1 { font-size:20px; margin:0 0 4px } .sub { color:var(--muted); font-size:13px; margin-bottom:14px }
 form { display:flex; gap:8px; flex-wrap:wrap } input[type=text] { flex:1 1 320px; padding:10px 12px; font-size:16px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--text) }
 select, button { padding:10px 12px; font-size:15px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--text) }
 button { background:var(--accent); color:#fff; border-color:var(--accent); cursor:pointer }
 .chips { display:flex; gap:6px; flex-wrap:wrap; margin:10px 0 4px } .chip { font-size:13px; padding:3px 9px; border:1px solid var(--line); border-radius:99px; cursor:pointer; background:var(--card) }
 .status { color:var(--muted); font-size:13px; margin:12px 0 }
 .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px 18px; margin:12px 0 }
 .top { display:flex; justify-content:space-between; gap:10px; align-items:flex-start } .t1 { font-weight:650; font-size:16px } .t2 { color:var(--muted); font-size:13px }
 .badge { font-size:12px; font-weight:600; padding:2px 9px; border-radius:99px; white-space:nowrap }
 .strong { color:var(--strong); background:var(--strongbg) } .partial { color:var(--partial); background:var(--partialbg) } .weak { color:var(--weak); background:var(--weakbg) }
 .easy { margin:10px 0 12px; font-size:15.5px } .tags { font-size:13px; color:var(--muted); margin-bottom:10px }
 table { width:100%; border-collapse:collapse; font-size:13.5px } td { padding:5px 8px; border-top:1px solid var(--line); vertical-align:top } td:first-child { width:120px; color:var(--muted); white-space:nowrap }
 details { margin-top:10px; font-size:14px } summary { cursor:pointer; color:var(--accent); font-weight:600 }
 .detail { margin-top:6px; background:var(--soft); border-radius:8px; padding:10px 12px }
 .passage { white-space:pre-wrap; color:var(--muted); font-size:13px; max-height:220px; overflow:auto; margin-top:6px }
 .dev { font:12px/1.4 ui-monospace, Consolas, monospace; color:var(--muted); margin-top:6px }
 .note { font-size:12px; color:var(--muted); font-style:italic }
 .footer { background:var(--card); border:1px dashed var(--line); border-radius:12px; padding:14px 18px; margin-top:16px; font-size:14px }
 .footer a { display:inline-block; margin:6px 10px 0 0 } a { color:var(--accent) }
</style></head><body><main>
<h1>AI Hub dataset search — test page</h1>
<div class="sub">Local testing tool. Search only: no student profile or recommendation scoring yet.</div>
<form id="f"><input id="q" type="text" placeholder="예: 강아지 사진, plant disease photos, 법률 챗봇 만들고 싶어요" autofocus>
<select id="k"><option>5</option><option selected>10</option><option>20</option><option>50</option></select>
<select id="lang"><option value="ko">한국어</option><option value="en">English</option></select>
<label style="font-size:13px;display:flex;align-items:center;gap:4px"><input type="checkbox" id="dev"> scores</label>
<button>Search</button></form>
<div class="chips" id="hist"></div>
<div class="status" id="status"></div><div id="out"></div>
<script>
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const T = {ko:{strong:"잘 맞음", partial:"부분적으로 맞음", weak:"관련 약함", detail:"자세히", passage:"검색어와 가장 잘 맞는 원문",
  manual:"(설명서)", open:"AI Hub에서 보기", noexp:"쉬운 설명은 아직 샘플 20개만 있습니다. 지금은 기존 요약을 보여 줍니다.",
  footer:"찾는 데이터가 없나요? 다른 데이터 사이트에서도 찾아보세요:", tip:"해외 사이트는 영어 검색어가 더 잘 맞습니다.", res:"개 결과"},
 en:{strong:"Strong match", partial:"Partial match", weak:"Weak match", detail:"Details", passage:"Best matching original text",
  manual:"(manual)", open:"Open on AI Hub", noexp:"Easy explanations exist for 20 sample datasets only; showing the old summary.",
  footer:"Not what you need? Try other dataset sites:", tip:"English words work better on international sites.", res:"results"}};
let hist = []; try { hist = JSON.parse(localStorage.getItem("hist") || "[]"); } catch (e) {}
let last = null;
function drawHist() { $("#hist").innerHTML = hist.map(h => `<span class="chip">${esc(h)}</span>`).join("");
  document.querySelectorAll(".chip").forEach(c => c.onclick = () => { $("#q").value = c.textContent; run(); }); }
function render() {
  if (!last) return; const d = last, L = $("#lang").value, t = T[L], dev = $("#dev").checked;
  $("#status").textContent = `${d.rows.length} ${t.res} · ${d.ms} ms`;
  let html = d.rows.map((r, i) => `<div class="card">
   <div class="top"><div><div class="t1">${i + 1}. ${esc(L === "ko" ? r.title_ko : r.title_en)}</div>
     <div class="t2">${esc(L === "ko" ? r.title_en : r.title_ko)} · ${esc(r.id)}</div></div>
     <span class="badge ${r.match}">${t[r.match]}</span></div>
   <div class="easy">${esc(L === "ko" ? r.easy_ko : r.easy_en)}</div>
   ${r.has_explanation ? "" : `<div class="note">${t.noexp}</div>`}
   <div class="tags">${esc((L === "ko" ? r.domains_ko : r.domains_en).join(" · "))} &nbsp;|&nbsp; ${esc((L === "ko" ? r.tasks_ko : r.tasks_en).join(" · "))}</div>
   <table>${r.facts.map(f => `<tr><td>${esc(f[L])}</td><td>${esc(L === "ko" ? f.v_ko : f.v_en)}</td></tr>`).join("")}</table>
   <details><summary>${t.detail}</summary><div class="detail">${esc(L === "ko" ? r.detail_ko : r.detail_en)}</div>
     <div class="passage"><b>${t.passage}</b> — ${esc(r.passage_section)} ${r.passage_source === "manual" ? t.manual : ""}\n${esc(r.passage)}</div></details>
   ${dev ? `<div class="dev">score ${r.score} · card ${r.card_cos} · chunk ${r.chunk_cos} · ${esc(r.lists.join(", "))}</div>` : ""}
   <div style="margin-top:8px;font-size:13px"><a href="${esc(r.url)}" target="_blank" rel="noopener">${t.open}</a></div></div>`).join("");
  html += `<div class="footer">${t.footer}<br>${d.sites.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join("")}
   ${d.hangul ? `<div class="note" style="margin-top:6px">${t.tip}</div>` : ""}</div>`;
  $("#out").innerHTML = html;
}
async function run() {
  const q = $("#q").value.trim(); if (!q) return;
  hist = [q, ...hist.filter(h => h !== q)].slice(0, 12); try { localStorage.setItem("hist", JSON.stringify(hist)); } catch (e) {} drawHist();
  $("#status").textContent = "Searching…"; $("#out").innerHTML = "";
  try { const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&k=${$("#k").value}`); const d = await r.json(); if (!r.ok) throw new Error(d.error); last = d; render(); }
  catch (e) { $("#status").textContent = "Error: " + e.message; }
}
$("#f").onsubmit = e => { e.preventDefault(); run(); }; $("#lang").onchange = render; $("#dev").onchange = render; drawHist();
</script></main></body></html>"""


def make_handler(app: App):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, code: int, body: bytes, ctype: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:  # noqa: N802 - name required by BaseHTTPRequestHandler
            u = urlparse(self.path)
            if u.path == "/":
                return self._send(200, PAGE.encode("utf-8"), "text/html; charset=utf-8")
            if u.path != "/api/search":
                return self._send(404, b"not found", "text/plain")
            p = parse_qs(u.query)
            q = (p.get("q") or [""])[0].strip()
            try:
                k = max(1, min(MAX_K, int((p.get("k") or ["10"])[0])))
            except ValueError:
                k = 10
            try:
                body = app.search(q, k) if q else {"error": "empty query"}
                code = 200 if q else 400
            except Exception as e:  # noqa: BLE001 - shown on the page instead of crashing the server
                logging.exception("search failed")
                body, code = {"error": f"{type(e).__name__}: {e}"}, 500
            self._send(code, json.dumps(body, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

        def log_message(self, fmt: str, *args) -> None:
            pass                                    # keep the console quiet; errors are logged above
    return Handler


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--port", type=int, default=8765)
    a = p.parse_args()
    logging.basicConfig(level=logging.WARNING)
    app = App()
    server = HTTPServer(("127.0.0.1", a.port), make_handler(app))
    print(f"open http://127.0.0.1:{a.port}  (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
