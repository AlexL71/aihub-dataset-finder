// Capture real DataFinder screens for the promo video (product-demo style).
// Runs the real app search in Korean and English with Remotion's headless Chrome and saves, per language:
//   public/screens/<lang>/home.png, results.png, plan.png   (1440x900 page at 2x = 2880x1800)
//   public/screens/<lang>/rects.json                          (element boxes in page pixels, for camera moves)
//
// Needs the app running (python -m app.server, default http://127.0.0.1:8000) with a working GEMINI_API_KEY.
// Usage (from promo/):  node scripts/capture.mjs [ko|en|all]   (APP_URL to change the address)

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = process.env.APP_URL || "http://127.0.0.1:8000";
const CHROME = join(ROOT, "node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe");
const PORT = 9333;
const VIEW = { width: 1440, height: 900, scale: 2 };
const RESULTS_H = 1440; // results page height: two full rows of cards
// The example search: an interest plus the student's university and major (chosen for high, honest relevance:
// with this major the top three results score 9.6 / 9.3 / 9.2 in Korean and 8.7 / 8.6 / 8.4 in English).
const QUERY = { ko: "음식 이미지와 영양 정보", en: "food images and nutrition data" };
const UNIV = "ku_sejong";
const MAJOR = "sfa_science"; // 국제스포츠학부(스포츠과학전공) / Sport Science
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((ok, fail) => { const i = ++id; pending.set(i, { ok, fail }); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "evaluate failed");
    return r.result.value;
  };
  const waitFor = async (expr, what, timeoutMs = 60000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { if (await evaluate(expr)) return; await sleep(300); }
    throw new Error(`timed out waiting for ${what}`);
  };
  const shot = async (file) => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(file, Buffer.from(r.data, "base64"));
  };
  return { send, evaluate, waitFor, shot, close: () => ws.close() };
}

// Box of the first element matching a selector (page pixels, relative to the viewport).
const box = (sel, nth = 0) => `(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}];
  if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`;

async function captureLang(page, lang) {
  const out = join(ROOT, "public", "screens", lang);
  mkdirSync(out, { recursive: true });
  const rects = {};

  // Fresh state in the chosen language with the university chosen and no major yet; no intro video over the page.
  const load = async (major) => {
    await page.send("Page.navigate", { url: `${APP}/#/` });
    await page.waitFor("document.readyState === 'complete'", "first load");
    await page.evaluate(`localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('lang', JSON.stringify('${lang}')); sessionStorage.setItem('intro_seen', '1');
      localStorage.setItem('profile', JSON.stringify({ univ: '${UNIV}', major: '${major}', purpose: '', interests: [], text: '' })); true`);
    await page.send("Page.reload", { ignoreCache: true });
    await page.waitFor("!!document.querySelector('#sform #q') && !!document.querySelector('#major .dd-btn')", "home page");
    await sleep(1500); // fonts, icons, major keywords
    await page.evaluate("document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); true");
  };
  // The "tell us a little more" panel scrolled into view (university and major boxes, its search button).
  const panelView = async (file) => {
    await page.evaluate("(() => { const p = document.querySelector('#major').closest('section'); window.scrollTo(0, p.getBoundingClientRect().top + window.scrollY - 40); return true; })()");
    await sleep(500);
    await page.shot(join(out, file));
    return {
      panel: await page.evaluate("(() => { const r = document.querySelector('#major').closest('section').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()"),
      univ: await page.evaluate(box("#univ .dd-btn")),
      major: await page.evaluate(box("#major .dd-btn")),
      rec: await page.evaluate(box("#rec")),
    };
  };

  await load("");
  await page.shot(join(out, "home.png"));
  rects.home = { input: await page.evaluate(box("#q")), button: await page.evaluate(box("#sform button")) };
  rects.majorEmpty = await panelView("major-empty.png");

  await load(MAJOR);
  rects.major = await panelView("major.png");
  rects.major.name = await page.evaluate("document.querySelector('#major .dd-label').textContent.trim()");

  // Real search with the interest and the major (the panel's own search button).
  await page.evaluate(`(() => { const q = document.getElementById('q'); q.value = ${JSON.stringify(QUERY[lang])};
    q.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('rec').click(); return true; })()`);
  await page.waitFor("document.querySelectorAll('article.dcard').length >= 3", "results", 90000);
  await sleep(1500);
  // Results page in a taller window, so the second row of cards is fully in the picture
  // (the video camera scrolls down to it). Home and plan stay 1440 x 900.
  await page.send("Emulation.setDeviceMetricsOverride", { width: VIEW.width, height: RESULTS_H, deviceScaleFactor: VIEW.scale, mobile: false });
  await sleep(500);
  await page.evaluate("window.scrollTo(0, 0); true");
  await sleep(400);
  await page.shot(join(out, "results.png"));
  rects.results = {
    card1: await page.evaluate(box("article.dcard", 0)),
    card2: await page.evaluate(box("article.dcard", 1)),
    meter1: await page.evaluate(box("article.dcard .meter", 0)),
    meter2: await page.evaluate(box("article.dcard .meter", 1)),
    title1: await page.evaluate(box("article.dcard h4", 0)),
    title2: await page.evaluate(box("article.dcard h4", 1)),
    plan1: await page.evaluate(box("article.dcard .chat-btn", 0)),
  };
  // Every card at least partly on screen: title, score and boxes (card, title, score meter).
  rects.cards = await page.evaluate(`[...document.querySelectorAll('article.dcard')].slice(0, 9).map(c => {
    const b = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    return { title: (c.querySelector("h4") || {}).textContent?.trim(), score: (c.querySelector(".meter b") || {}).textContent?.trim(),
      card: b(c), titleBox: b(c.querySelector("h4")), meter: b(c.querySelector(".meter")), icon: b(c.querySelector(".dcard-top > *")) };
  }).filter(c => c.card.y + c.card.h <= ${RESULTS_H})`);
  await page.send("Emulation.setDeviceMetricsOverride", { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.scale, mobile: false });
  await sleep(500);
  await page.evaluate("window.scrollTo(0, 0); true");

  // Plan panel for the top dataset (opened, nothing copied or sent).
  await page.evaluate("document.querySelector('article.dcard .chat-btn').click(); true");
  await page.waitFor("!!document.querySelector('.chat-pick .pick-site:not([disabled])')", "plan panel");
  await sleep(600);
  await page.shot(join(out, "plan.png"));
  rects.plan = { panel: await page.evaluate(box(".chat-pick")), site1: await page.evaluate(box(".pick-site", 0)), sites: await page.evaluate(box(".pick-sites")) };

  rects.view = { ...VIEW, resultsHeight: RESULTS_H };
  writeFileSync(join(out, "rects.json"), JSON.stringify(rects, null, 2));
  console.log(`[${lang}] saved home, results, plan. Top results:`, rects.cards.map((c) => `${c.title} ${c.score}`).join(" | "));
}

async function main() {
  const langs = !process.argv[2] || process.argv[2] === "all" ? ["ko", "en"] : [process.argv[2]];
  const profile = mkdtempSync(join(tmpdir(), "promo-capture-"));
  const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });
  try {
    let targets;
    for (let i = 0; i < 50 && !targets; i++) {
      try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch { await sleep(200); }
    }
    const target = targets.find((t) => t.type === "page");
    const page = await cdp(target.webSocketDebuggerUrl);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.scale, mobile: false });
    for (const lang of langs) await captureLang(page, lang);
    page.close();
  } finally {
    chrome.kill();
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
