// Capture real DataFinder screens for the promo video (product-demo style).
// Runs the real app (search, major, results, compare, plan window) in Korean and English with Remotion's headless
// Chrome, at two device sizes, and saves per language:
//   public/screens/<lang>/<screen>.png + rects.json         desktop: 1440 x 900 page at 2x
//   public/screens/<lang>/phone/<screen>.png + rects.json   phone:   390 x 844 page at 3x (mobile)
// Screens: home, major-empty, major, results, results-added, compare, plan, plan-preview, plan-copied.
// rects.json holds element boxes in page pixels relative to each screenshot's top-left corner (for camera moves),
// and `screens` gives each screenshot's size in page pixels.
//
// Needs the app running (python -m app.server, default http://127.0.0.1:8000) with a working GEMINI_API_KEY.
// Usage (from promo/):  node scripts/capture.mjs [ko|en|all] [desktop|phone|both]   (APP_URL to change the address)

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = process.env.APP_URL || "http://127.0.0.1:8000";
const CHROME = join(ROOT, "node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe");
const PORT = 9333;
const DEVICES = {
  desktop: { width: 1440, height: 900, scale: 2, mobile: false, dir: "", resultsH: 1440 },
  phone: { width: 390, height: 844, scale: 3, mobile: true, dir: "phone" },
};
// The example search: an interest plus the student's university and major (chosen for high, honest relevance:
// with this major the top three results score 9.6 / 9.3 / 9.2 in Korean and 8.7 / 8.6 / 8.4 in English).
const QUERY = { ko: "음식 이미지와 영양 정보", en: "food images and nutrition data" };
const UNIV = "ku_sejong";
const MAJOR = "sfa_science"; // 국제스포츠학부(스포츠과학전공) / Sport Science
const N_COMPARE = 3;
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
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "evaluate failed");
    return r.result.value;
  };
  const waitFor = async (expr, what, timeoutMs = 60000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { if (await evaluate(expr)) return; await sleep(300); }
    throw new Error(`timed out waiting for ${what}`);
  };
  return { send, evaluate, waitFor, close: () => ws.close() };
}

// Box of an element in document pixels (scroll included), as a JS expression; null when missing.
const box = (sel, nth = 0, within = "document") => `(() => { const e = (${within}).querySelectorAll(${JSON.stringify(sel)})[${nth}];
  if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; })()`;

async function captureLang(page, lang, devName) {
  const dev = DEVICES[devName];
  const out = join(ROOT, "public", "screens", lang, dev.dir);
  mkdirSync(out, { recursive: true });
  const rects = { screens: {} };

  await page.send("Emulation.setDeviceMetricsOverride", { width: dev.width, height: dev.height, deviceScaleFactor: dev.scale, mobile: dev.mobile });
  await page.send("Emulation.setTouchEmulationEnabled", { enabled: dev.mobile });

  // One screenshot of the document region starting at y0 (document px) with the given size; boxes measured
  // afterwards are made relative to the same origin with `rel`.
  let origin = { x: 0, y: 0 };
  const shot = async (name, { y0 = 0, w = dev.width, h = dev.height } = {}) => {
    origin = { x: 0, y: y0 };
    const r = await page.send("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: true, clip: { x: 0, y: y0, width: w, height: h, scale: 1 },
    });
    writeFileSync(join(out, `${name}.png`), Buffer.from(r.data, "base64"));
    rects.screens[name] = { w, h };
  };
  const rel = (b) => (b ? { x: b.x - origin.x, y: b.y - origin.y, w: b.w, h: b.h } : null);
  const get = async (sel, nth = 0, within) => rel(await page.evaluate(box(sel, nth, within)));
  const docH = () => page.evaluate("document.documentElement.scrollHeight");

  // Fresh state in the chosen language, university chosen, given major; no intro video over the page.
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
  // The "tell us a little more" panel: a screen starting just above it.
  const panelShot = async (name) => {
    const top = await page.evaluate("document.querySelector('#major').closest('section').getBoundingClientRect().top + scrollY");
    await shot(name, { y0: Math.max(0, top - (dev.mobile ? 16 : 40)) });
    return {
      panel: await page.evaluate(`(() => { const r = document.querySelector('#major').closest('section').getBoundingClientRect();
        return { x: r.x, y: r.y + scrollY - ${origin.y}, w: r.width, h: r.height }; })()`),
      univ: await get("#univ .dd-btn"),
      major: await get("#major .dd-btn"),
      rec: await get("#rec"),
    };
  };
  // Cards of the results page (document boxes relative to the current screen).
  const cards = async (n) => {
    const list = [];
    for (let i = 0; i < n; i++) {
      const within = `document.querySelectorAll('article.dcard')[${i}]`;
      list.push({
        title: await page.evaluate(`(${within}).querySelector('h4').textContent.trim()`),
        score: await page.evaluate(`(${within}).querySelector('.meter b').textContent.trim()`),
        card: await get("article.dcard", i),
        titleBox: await get("h4", 0, within),
        meter: await get(".meter", 0, within),
        why: await get("ul.why", 0, within),
        cmp: await get("[data-cmp]", 0, within),
        plan: await get(".chat-btn", 0, within),
      });
    }
    return list;
  };

  // 1. Home with the search box, then the major panel empty and chosen.
  await load("");
  await shot("home");
  rects.home = { input: await get("#q"), button: await get("#sform button") };
  rects.majorEmpty = await panelShot("major-empty");
  await load(MAJOR);
  rects.major = await panelShot("major");
  rects.major.name = await page.evaluate("document.querySelector('#major .dd-label').textContent.trim()");

  // 2. Real search with the interest and the major (the panel's own search button).
  await page.evaluate(`(() => { const q = document.getElementById('q'); q.value = ${JSON.stringify(QUERY[lang])};
    q.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('rec').click(); return true; })()`);
  await page.waitFor(`document.querySelectorAll('article.dcard').length >= ${N_COMPARE}`, "results", 90000);
  await sleep(1500);
  await page.evaluate("window.scrollTo(0, 0); true");
  // Desktop: two full rows of cards. Phone (one column): down to the end of the third card.
  const resultsH = dev.resultsH ?? Math.ceil(await page.evaluate(`(() => { const c = document.querySelectorAll('article.dcard')[${N_COMPARE - 1}].getBoundingClientRect(); return c.bottom + scrollY + 24; })()`));
  await shot("results", { h: resultsH });
  rects.cards = await cards(dev.mobile ? N_COMPARE : 6);
  rects.cards = rects.cards.filter((c) => c.card && c.card.y + c.card.h <= resultsH);

  // 3. Add the top three to the compare list (the buttons change to "담김"), then the compare page.
  for (let i = 0; i < N_COMPARE; i++) await page.evaluate(`document.querySelectorAll('article.dcard [data-cmp]')[${i}].click(); true`);
  await sleep(500);
  await shot("results-added", { h: resultsH });
  rects.added = { count: await get("#cmp-count"), nav: await get('[data-nav="compare"]') };
  await page.evaluate("location.hash = '#/compare'; true");
  await page.waitFor("!!document.querySelector('table.cmp')", "compare page");
  await sleep(1200);
  await page.evaluate("window.scrollTo(0, 0); true");
  // Phone: the table scrolls sideways inside its box; show it whole by letting the box grow to the table's width.
  let compareW = dev.width;
  if (dev.mobile) {
    compareW = await page.evaluate(`(() => { const w = document.querySelector('.cmp-wrap'); const t = w.querySelector('table.cmp');
      w.style.overflow = 'visible'; const r = w.getBoundingClientRect(); return Math.ceil(r.left * 2 + t.scrollWidth + 2); })()`);
  }
  const compareH = Math.min(await docH(), dev.mobile ? 2600 : 1440);
  await shot("compare", { w: compareW, h: compareH });
  rects.compare = {
    table: await get("table.cmp"),
    cols: [],
    head: await get("table.cmp thead"),
  };
  for (let i = 0; i < N_COMPARE; i++) rects.compare.cols.push(await get("table.cmp thead td", i));
  if (dev.mobile) await page.evaluate("document.querySelector('.cmp-wrap').style.overflow = ''; true");

  // 4. Plan window for the top result (nothing is sent; the prompt is only copied inside this headless browser).
  await page.evaluate("history.back(); true");
  await page.waitFor("document.querySelectorAll('article.dcard').length >= 1", "results again");
  await sleep(1000);
  await page.evaluate("window.scrollTo(0, 0); document.querySelector('article.dcard .chat-btn').click(); true");
  await page.waitFor("!!document.querySelector('.chat-pick .pick-site:not([disabled])')", "plan panel");
  await sleep(600);
  await shot("plan");
  rects.plan = {
    panel: await get(".chat-pick"),
    site1: await get(".pick-site", 0),
    sites: await get(".pick-sites"),
    copy: await get(".pick-copy"),
    preview: await get(".pick-pre summary"),
  };
  // The prompt preview opened: dataset details, the student's major and interests.
  await page.evaluate(`(() => { const d = document.querySelector('.pick-pre'); d.open = true;
    const t = d.querySelector('textarea'); t.scrollTop = 0; t.scrollIntoView({ block: 'center' }); return true; })()`);
  await sleep(500);
  await shot("plan-preview");
  rects.preview = { panel: await get(".chat-pick"), textarea: await get(".pick-pre textarea"), details: await get(".pick-pre") };
  rects.prompt = await page.evaluate("document.querySelector('.pick-pre textarea').value");
  // "Copy the prompt only" (its message names no AI model).
  await page.evaluate(`(() => { const d = document.querySelector('.pick-pre'); d.open = false;
    document.querySelector('.chat-pick').scrollTop = 0; document.querySelector('.pick-copy').click(); return true; })()`);
  await sleep(800);
  await shot("plan-copied");
  rects.copied = { msg: await get(".pick-msg"), sites: await get(".pick-sites"), panel: await get(".chat-pick") };
  rects.copied.text = await page.evaluate("document.querySelector('.pick-msg').textContent.trim()");

  rects.view = { width: dev.width, height: dev.height, scale: dev.scale, resultsHeight: resultsH };
  writeFileSync(join(out, "rects.json"), JSON.stringify(rects, null, 2));
  console.log(`[${lang}/${devName}] ${Object.keys(rects.screens).length} screens. Top: ${rects.cards.slice(0, 3).map((c) => `${c.title} ${c.score}`).join(" | ")}. Copy message: ${rects.copied.text}`);
}

async function main() {
  const langs = !process.argv[2] || process.argv[2] === "all" ? ["ko", "en"] : [process.argv[2]];
  const devs = !process.argv[3] || process.argv[3] === "both" ? ["desktop", "phone"] : [process.argv[3]];
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
    // Let the app's copy button work inside this browser (the prompt never leaves it).
    await page.send("Browser.grantPermissions", { origin: APP, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] }).catch(() => {});
    for (const lang of langs) for (const dev of devs) await captureLang(page, lang, dev);
    page.close();
  } finally {
    chrome.kill();
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
