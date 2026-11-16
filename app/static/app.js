// Student app pages (plain JavaScript, no build step). Pages are switched by the address after "#":
//   #/            home: search box, suggested keywords, fields to browse, profile (university, major, interest fields)
//   #/browse/G/T  datasets of one field (G) or topic (T), most downloaded first
//   #/results     recommended data cards
//   #/dataset/ID  one dataset (AI Hub-style header, easy text, project ideas, facts, details, related data)
//   #/compare     up to 3 datasets side by side
// Profile, language and the compare list stay in this browser (localStorage). The last recommendations and
// the scroll position stay for this browser tab (sessionStorage), so going to a dataset and back keeps them.
"use strict";

const T = {
  ko: {
    nav_find: "데이터 찾기", nav_results: "추천 결과", nav_compare: "비교함", nav_about: "소개", page_about: "소개", on_map: "데이터 지도에서 보기",
    browse_title: "분야별로 둘러보기", browse_hint: "분야를 고르면 주제별 데이터를 볼 수 있습니다.", page_browse: "분야별 데이터", all: "전체",
    n_items: "데이터 {n}건", more: "더 보기", browse_sort: "다운로드 많은 순", chat_open: "AI로 프로젝트 계획 세우기", chat_tip: "ChatGPT, Claude, Gemini 중 원하는 AI에게 이 데이터로 프로젝트 계획을 받아 보세요.", n_sets_short: "{n}개",
    page_find: "데이터 찾기", page_results: "추천 결과", page_dataset: "데이터 상세", page_compare: "데이터 비교",
    hero_title: "어떤 데이터가 필요하신가요?",
    hero_sub: "AI 용어를 몰라도 괜찮습니다. 하고 싶은 일을 적으면 AI Hub 데이터 {n}개 중에서 알맞은 데이터를 찾아 드립니다.",
    placeholder: "예: 강아지 사진, 출퇴근 교통 혼잡, 사과 잎 병 진단", go: "데이터 추천받기",
    kw_title: "전공 추천 검색어", last_results: "최근 추천 결과 보기",
    profile: "조금 더 알려 주세요", profile_hint: "모두 선택 사항입니다. 자세히 알려 주실수록 더 잘 맞는 데이터를 찾아 드립니다.",
    univ: "대학교", univ_none: "대학교를 선택하세요", soon: "준비 중", major_locked: "대학교를 먼저 선택하세요",
    univ_hint: "현재는 고려대학교 세종캠퍼스 전공만 선택할 수 있으며, 다른 대학교는 준비 중입니다. 대학교를 선택하지 않아도 검색할 수 있습니다.",
    major: "전공", major_none: "전공을 선택하세요", purpose: "사용 목적", purpose_none: "목적을 선택하세요",
    interests: "관심 분야", interests_hint: "분야를 펼쳐 관심 주제를 선택하세요. 최대 {n}개까지 선택할 수 있습니다.",
    my_major: "내 전공 관련 분야", n_sel: "{n}개 선택", max_sel: "관심 분야는 최대 {n}개까지 선택할 수 있습니다.",
    recommend: "데이터 추천받기", reset: "초기화", intro_replay: "소개 영상 보기", loading: "데이터를 찾고 있습니다…",
    n_results: "추천 데이터 {n}건", edit: "조건 변경",
    no_input: "검색어를 입력하거나 전공, 관심 분야를 선택하세요.",
    no_match: "검색어와 정확히 맞는 데이터가 AI Hub에 없습니다. 가장 비슷한 데이터를 보여 드립니다.",
    strong: "잘 맞습니다", partial: "어느 정도 맞습니다", weak: "관련이 적습니다", relevance: "관련도",
    details: "자세히 보기", add_cmp: "비교함에 담기", in_cmp: "✓ 담았습니다", cmp_full: "비교함에는 최대 {n}개까지 담을 수 있습니다.",
    others: "원하는 데이터가 없나요? 다른 데이터 사이트에서도 찾아보세요.",
    others_tip: "해외 사이트는 영어로 검색하면 결과가 더 많습니다.",
    tab_easy: "한눈에 보기", tab_ideas: "프로젝트 아이디어", tab_facts: "데이터 정보", tab_detail: "상세 설명", tab_related: "연관 데이터",
    open_aihub: "AI Hub에서 신청하기", build_year: "구축 연도", updated: "최근 갱신", views: "조회수", downloads: "다운로드",
    size: "용량", difficulty: "난이도",
    no_manual: "데이터 설명서가 없어 AI Hub 페이지 내용만으로 설명했습니다.",
    lv_beginner: "입문", lv_capstone: "캡스톤", lv_research: "연구", tasks: "AI로 할 수 있는 일",
    cmp_empty: "비교함이 비어 있습니다. 데이터 카드에서 '비교함에 담기'를 눌러 보세요.", remove: "삭제",
    easy_row: "한눈에 보기", fields_row: "분야", error: "오류가 발생했습니다. ", back: "← 추천 결과로",
    difficulty_v: { beginner: "입문", intermediate: "중급", advanced: "고급" },
  },
  en: {
    nav_find: "Find data", nav_results: "Results", nav_compare: "Compare", nav_about: "About", page_about: "About", on_map: "See on the data map",
    browse_title: "Browse by field", browse_hint: "Pick one of the 8 fields to see its datasets by topic.", page_browse: "Datasets by field", all: "All",
    n_items: "{n} datasets", more: "Show more", browse_sort: "Most downloaded first.", chat_open: "Plan a project with AI", chat_tip: "Ask ChatGPT, Claude or Gemini to plan a project with this dataset.", n_sets_short: "{n}",
    page_find: "Find data", page_results: "Your recommendations", page_dataset: "Dataset", page_compare: "Compare datasets",
    hero_title: "What data do you need?",
    hero_sub: "No AI jargon needed. Describe what you want to do and we'll pick from {n} AI Hub datasets.",
    placeholder: "e.g. dog photos, rush-hour traffic, apple leaf disease", go: "Get recommendations",
    kw_title: "Suggested for your major", last_results: "See your last recommendations",
    profile: "Tell us a little more", profile_hint: "None of this is required. The more you share, the better the match.",
    univ: "University", univ_none: "Choose your university", soon: "coming soon", major_locked: "Choose a university first",
    univ_hint: "Majors are available for Korea University Sejong Campus only; other universities are coming soon. Without a university you can still search by describing what you want.",
    major: "Major", major_none: "Choose your major", purpose: "What will you use it for?", purpose_none: "Choose a purpose",
    interests: "Fields you're interested in", interests_hint: "Open a field and pick topics, up to {n}.",
    my_major: "Close to your major", n_sel: "{n} selected", max_sel: "You can choose up to {n} fields.",
    recommend: "Get recommendations", reset: "Reset", intro_replay: "Watch the intro", loading: "Finding data that fits…",
    n_results: "{n} datasets for you", edit: "Change answers",
    no_input: "Type what you're looking for, or choose a major or a field.",
    no_match: "AI Hub doesn't seem to have an exact match. Here are the closest datasets instead.",
    strong: "Good match", partial: "Partly matches", weak: "Loosely related", relevance: "Relevance",
    details: "View details", add_cmp: "Add to compare", in_cmp: "✓ Added", cmp_full: "You can compare up to {n} datasets.",
    others: "Can't find what you need? Try other dataset sites.", others_tip: "",
    tab_easy: "At a glance", tab_ideas: "Project ideas", tab_facts: "Key facts", tab_detail: "Full description", tab_related: "Related data",
    open_aihub: "Request on AI Hub", build_year: "Built", updated: "Updated", views: "Views", downloads: "Downloads",
    size: "Size", difficulty: "Level",
    no_manual: "This dataset has no manual, so this text is based on its AI Hub page only.",
    lv_beginner: "Beginner", lv_capstone: "Capstone", lv_research: "Research", tasks: "What AI could do with it",
    cmp_empty: "Your compare list is empty. Press 'Add to compare' on any data card.", remove: "Remove",
    easy_row: "At a glance", fields_row: "Fields", error: "Something went wrong. ", back: "← Back to your recommendations",
    difficulty_v: { beginner: "beginner", intermediate: "intermediate", advanced: "advanced" },
  },
};

// ---------- small helpers ----------
const $ = (s, root = document) => root.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// keep names like "교통·도로·대중교통" on one line: word joiners stop a line break before or after the middle dot
const glue = s => String(s ?? "").replace(/·/g, "⁠·⁠");
const mkStore = area => ({
  get(k, d) { try { const v = area().getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { area().setItem(k, JSON.stringify(v)); } catch (e) { /* private window or full: memory only */ } },
});
const store = mkStore(() => localStorage), tabStore = mkStore(() => sessionStorage);
let lang = store.get("lang", "ko");
let profile = store.get("profile", { univ: "", major: "", purpose: "", interests: [], text: "" });
if (profile.major && !profile.univ) profile.univ = "ku_sejong";              // profiles saved before the university step
let compare = store.get("compare", []);
let results = tabStore.get("current", { profile: null, data: {} });  // the current recommendation only (per language)
let freshRequest = false;                                           // set by the recommend button: replace the old results
let META = null, navSeq = 0, currentPage = "";
const majorCache = {};
const accOpen = new Set(["mine"]);                                 // interest sections the student opened
const t = (k, vars = {}) => String(T[lang][k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");
const L = (o, base) => o[`${base}_${lang}`] ?? o[`${base}_ko`];        // title_ko / title_en ...
const name = o => o[lang] ?? o.ko;

async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
  return d;
}
function saveProfile() { store.set("profile", profile); updateResultsNav(); }
function saveCompare() { store.set("compare", compare); $("#cmp-count").textContent = compare.length || ""; }
const hasInput = () => Boolean(profile.text || profile.major || profile.interests.length);

// recommendation answers, kept per (profile, language) for this tab
const profileKey = p => JSON.stringify([p.univ || "", p.major || "", [...(p.interests || [])].sort(), p.text || ""]);
const sameProfile = (a, b) => Boolean(a && b) && profileKey(a) === profileKey(b);
const cachedResults = (lg = lang) => results.data[lg];
function keepResults(p, lg, d) {
  if (!sameProfile(results.profile, p)) results = { profile: { ...p, interests: [...p.interests] }, data: {} };   // new request: old results go
  results.data[lg] = d;
  tabStore.set("current", results);
}
function updateResultsNav() { $("#nav-res").hidden = !results.profile; }

// icon tile: AI Hub's own icon; if it is missing or fails to load, a text tile with the data type
function tile(c, size) {
  const fb = esc((c.modalities || []).map(m => m[lang === "ko" ? 0 : 1]).join(" · ") || "DATA");
  return `<div class="tile ${size}" data-fb="${fb}">${c.icon
    ? `<img src="${esc(c.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="fb">${fb}</span>`}</div>`;
}
document.addEventListener("error", e => {
  const img = e.target;
  if (img.tagName === "IMG" && img.parentElement?.classList.contains("tile")) {
    img.parentElement.innerHTML = `<span class="fb">${img.parentElement.dataset.fb}</span>`;
  }
}, true);

function setFrame(titleKey, crumb = "") {
  $("#page-title").textContent = t(titleKey);
  $("#crumb").textContent = crumb;
  document.querySelectorAll("[data-k]").forEach(el => { el.firstChild.textContent = t(el.dataset.k) + " "; });
  document.querySelectorAll("[data-ak]").forEach(el => { el.textContent = at(el.dataset.ak); el.classList.toggle("on", location.hash.startsWith("#/about/" + el.dataset.ak.slice(4))); });
  document.querySelectorAll(".lang button").forEach(b => b.classList.toggle("on", b.dataset.lang === lang));
  const active = { results: "results", dataset: "results", compare: "compare", about: "about", browse: "find" }[currentPage] || "find";
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === active));
  if (META) {
    document.title = `AI Hub DataFinder · ${t(titleKey)}`;
    $("#notice").textContent = META.ui[`notice_${lang}`];
  }
  document.documentElement.lang = lang;
  updateResultsNav();
}
function view(html) {
  const v = $("#view");
  v.innerHTML = html;
  v.classList.remove("view-in"); void v.offsetWidth; v.classList.add("view-in");   // restart the fade-in
}
const showError = e => view(`<div class="msg err">${esc(t("error") + e.message)}</div>`);

// ---------- dropdown (keyboard: arrows, Enter, Escape; closes on outside click) ----------
function dropdown(id, groups, value, placeholder, locked = false) {
  const all = groups.flatMap(g => g.items);
  const cur = all.find(o => o.value === value);
  const opt = (v, label, dis) => `<div class="dd-opt ${v === (value || "") ? "sel" : ""} ${dis ? "dis" : ""}" role="option" aria-selected="${v === (value || "")}" ${dis ? 'aria-disabled="true"' : ""} data-v="${esc(v)}">${esc(label)}${dis ? ` <small>${esc(t("soon"))}</small>` : ""}</div>`;
  return `<div class="dd ${locked ? "locked" : ""}" id="${id}">
    <button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="false" ${locked ? "disabled" : ""}>
      <span class="dd-label ${cur ? "" : "ph"}">${esc(cur ? cur.label : placeholder)}</span><span class="chev"></span></button>
    <div class="dd-panel" role="listbox">${opt("", placeholder)}
      ${groups.map(g => (g.label ? `<div class="dd-group">${esc(g.label)}</div>` : "") + g.items.map(o => opt(o.value, o.label, o.disabled)).join("")).join("")}
    </div></div>`;
}
function bindDropdown(id, onPick) {
  const dd = $("#" + id), btn = $(".dd-btn", dd);
  const opts = () => [...dd.querySelectorAll(".dd-opt:not(.dis)")];
  let active = 0;
  const setActive = i => {
    const o = opts(); active = (i + o.length) % o.length;
    o.forEach((x, n) => x.classList.toggle("act", n === active));
    o[active].scrollIntoView({ block: "nearest" });
  };
  const open = () => {
    closeDropdowns(dd); dd.classList.add("open"); btn.setAttribute("aria-expanded", "true");
    setActive(Math.max(0, opts().findIndex(x => x.classList.contains("sel"))));
  };
  const close = () => { dd.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); };
  const pick = o => {
    opts().forEach(x => { x.classList.toggle("sel", x === o); x.setAttribute("aria-selected", String(x === o)); });
    const lab = $(".dd-label", dd); lab.textContent = o.firstChild.textContent.trim(); lab.classList.toggle("ph", !o.dataset.v);
    close(); btn.focus(); onPick(o.dataset.v);
  };
  btn.onclick = () => (dd.classList.contains("open") ? close() : open());
  $(".dd-panel", dd).onclick = e => { const o = e.target.closest(".dd-opt"); if (o && !o.classList.contains("dis")) pick(o); };
  dd.onkeydown = e => {
    const isOpen = dd.classList.contains("open");
    if (e.key === "Escape" && isOpen) { e.preventDefault(); close(); btn.focus(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); if (!isOpen) open(); else setActive(active + (e.key === "ArrowDown" ? 1 : -1));
    } else if ((e.key === "Enter" || e.key === " ") && isOpen) { e.preventDefault(); pick(opts()[active]); }
    else if (e.key === "Tab" && isOpen) close();
  };
  dd._close = close;
}
function closeDropdowns(except) { document.querySelectorAll(".dd.open").forEach(d => { if (d !== except) d._close?.(); }); }
document.addEventListener("click", e => { if (!e.target.closest(".dd")) closeDropdowns(); });

// ---------- home ----------
async function majorInfo(id) {
  if (!id) return null;
  if (!majorCache[id]) majorCache[id] = await api(`/api/major/${encodeURIComponent(id)}`);
  return majorCache[id];
}

function keywordsHTML(mi) {
  const kws = mi ? mi.keywords[lang] : [];
  return kws.length ? `<div class="chips kw" aria-label="${esc(t("kw_title"))}">${kws.map(k => `<button type="button" class="chip" data-kw="${esc(k)}"># ${esc(k)}</button>`).join("")}</div>` : "";
}

function interestsHTML(mi) {
  const chip = d => `<button type="button" class="chip ${profile.interests.includes(d.id) ? "on" : ""}" data-chip="${esc(d.id)}">${esc(name(d))}<span class="n">${d.n}</span></button>`;
  const linked = new Set((mi?.chips || []).map(c => c.id));
  const sections = [];
  if (mi?.chips.length) sections.push({ key: "mine", label: t("my_major"), items: mi.chips, mine: true });
  for (const g of META.groups) {
    const items = META.domains.filter(d => d.group === g.id && !linked.has(d.id));
    if (items.length) sections.push({ key: g.id, label: name(g), items });
  }
  return sections.map(s => {
    const nSel = s.items.filter(d => profile.interests.includes(d.id)).length;
    const open = accOpen.has(s.key);
    return `<div class="acc ${open ? "open" : ""} ${s.mine ? "mine" : ""}" data-acc="${esc(s.key)}">
      <button type="button" class="acc-head" aria-expanded="${open}"><span>${esc(s.label)}</span>
        <span class="acc-meta"><b class="sel-n">${nSel ? esc(t("n_sel", { n: nSel })) : ""}</b><span>${s.items.length}</span></span><span class="chev"></span></button>
      <div class="acc-body"><div class="acc-in"><div class="chips">${s.items.map(chip).join("")}</div></div></div></div>`;
  }).join("");
}

function bindInterests() {
  document.querySelectorAll(".acc-head").forEach(h => h.onclick = () => {
    const acc = h.closest(".acc"), key = acc.dataset.acc, open = !acc.classList.contains("open");
    acc.classList.toggle("open", open); h.setAttribute("aria-expanded", String(open));
    open ? accOpen.add(key) : accOpen.delete(key);
  });
  document.querySelectorAll("[data-chip]").forEach(b => b.onclick = () => {
    const id = b.dataset.chip, on = profile.interests.includes(id);
    if (!on && profile.interests.length >= META.limits.max_interests) { formMsg(t("max_sel", { n: META.limits.max_interests })); return; }
    profile.interests = on ? profile.interests.filter(x => x !== id) : [...profile.interests, id];
    b.classList.toggle("on", !on); saveProfile(); formMsg("");
    const acc = b.closest(".acc"), n = acc.querySelectorAll(".chip.on").length;
    $(".sel-n", acc).textContent = n ? t("n_sel", { n }) : "";
  });
}
// show only the keywords that fit on one line (best ones come first); runs again when the window is resized
function fitKeywords() {
  const row = $("#kw .kw");
  if (!row) return;
  const chips = [...row.children];
  chips.forEach(c => { c.hidden = false; });
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  let used = 0;
  for (const c of chips) {
    used += c.offsetWidth + (used ? gap : 0);
    if (used > row.clientWidth) c.hidden = true;
  }
  if (!chips[0]?.offsetWidth) return;                     // not laid out yet
  chips.forEach((c, i) => { if (i > 0 && chips[i - 1].hidden) c.hidden = true; });   // never skip one and show a later one
}
// re-fit whenever the keyword area changes width (window resize, phone rotation, zoom)
const kwObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => fitKeywords()) : null;
if (!kwObserver) window.addEventListener("resize", fitKeywords);
document.fonts?.ready.then(fitKeywords);                   // the web font changes word widths once it arrives

function bindKeywords() {
  fitKeywords();
  if (kwObserver && $("#kw")) { kwObserver.disconnect(); kwObserver.observe($("#kw")); }
  document.querySelectorAll("[data-kw]").forEach(b => b.onclick = () => { $("#q").value = b.dataset.kw; goRecommend(); });
}
function formMsg(text) { const m = $("#formmsg"); if (m) m.innerHTML = text ? `<div class="msg" style="margin-top:16px">${esc(text)}</div>` : ""; }
function goRecommend() {
  profile.text = $("#q").value.trim(); saveProfile();
  if (!hasInput()) { formMsg(t("no_input")); return; }
  freshRequest = true;
  if (location.hash === "#/results") route(); else location.hash = "#/results";
}

async function pageHome(seq) {
  setFrame("page_find");
  const mi = await majorInfo(profile.major).catch(() => null);
  if (seq !== navSeq) return;
  const univs = [{ label: "", items: META.universities.map(u => ({ value: u.id, label: name(u), disabled: !u.ready })) }];
  view(`
  <section class="hero">
    <h1>${esc(t("hero_title"))}</h1>
    <p>${esc(t("hero_sub", { n: META.n_datasets }))}</p>
    <form class="search" id="sform"><input id="q" maxlength="${META.limits.max_text_chars}" value="${esc(profile.text)}" placeholder="${esc(t("placeholder"))}" autocomplete="off" aria-label="${esc(t("hero_title"))}"><button>${esc(t("go"))}</button></form>
    <div id="kw">${keywordsHTML(mi)}</div>
    <div class="hero-links">
      <button type="button" class="reset-link intro-link" id="replay-intro"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>${esc(t("intro_replay"))}</button>
      <button type="button" class="reset-link" id="reset"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4.5h4.5"/></svg>${esc(t("reset"))}</button></div>
  </section>
  ${browseHomeHTML()}
  <section class="panel">
    <h3>${esc(t("profile"))}</h3><p class="hint">${esc(t("profile_hint"))}</p>
    <div class="form-row">
      <div><label class="f">${esc(t("univ"))}</label>${dropdown("univ", univs, profile.univ, t("univ_none"))}</div>
      <div><label class="f">${esc(t("major"))}</label><div id="major-wrap">${majorDropdown()}</div></div>
    </div>
    <p class="hint univ-hint">${esc(t("univ_hint"))}</p>
    <label class="f">${esc(t("interests"))}</label><p class="hint">${esc(t("interests_hint", { n: META.limits.max_interests }))}</p>
    <div id="interests">${interestsHTML(mi)}</div>
    <div class="actions" style="margin-top:24px"><button class="btn btn-blue" id="rec">${esc(t("recommend"))}</button></div>
    <div id="formmsg"></div>
  </section>`);

  $("#sform").onsubmit = e => { e.preventDefault(); goRecommend(); };
  $("#rec").onclick = goRecommend;
  $("#replay-intro").onclick = () => window.PromoIntro && window.PromoIntro.open();
  $("#reset").onclick = () => { results = { profile: null, data: {} }; tabStore.set("current", results); profile = { univ: "", major: "", purpose: "", interests: [], text: "" }; saveProfile(); accOpen.clear(); accOpen.add("mine"); route(); };
  bindDropdown("univ", v => {
    profile.text = $("#q").value.trim(); profile.univ = v;
    if (!univReady()) profile.major = "";
    saveProfile(); drawMajor(); redrawForMajor(null);
  });
  drawMajor();
  bindKeywords(); bindInterests();
}

const univReady = () => Boolean(META.universities.find(u => u.id === profile.univ && u.ready));
function majorDropdown() {
  const majors = META.colleges.map(c => ({ label: c.name, items: c.majors.map(m => ({ value: m.id, label: name(m) })) }));
  return univReady() ? dropdown("major", majors, profile.major, t("major_none")) : dropdown("major", [], "", t("major_locked"), true);
}
function redrawForMajor(info) {
  $("#kw").innerHTML = keywordsHTML(info); bindKeywords();
  $("#interests").innerHTML = interestsHTML(info); bindInterests();
}
// a new university or major only redraws the parts that depend on it, so nothing else on the page moves or closes
function drawMajor() {
  $("#major-wrap").innerHTML = majorDropdown();
  if (!univReady()) return;
  bindDropdown("major", async v => {
    profile.text = $("#q").value.trim(); profile.major = v; saveProfile();
    const info = v ? await majorInfo(v).catch(() => null) : null;
    if (profile.major !== v) return;                        // another major was picked meanwhile
    accOpen.add("mine");
    redrawForMajor(info);
  });
}

// AI sparkle icon: marks every button that sends the student to the LLM chat
const AI_ICON = `<svg class="ai-ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M10 2.5c.4 3.9 2.6 6.1 6.5 6.5-3.9.4-6.1 2.6-6.5 6.5-.4-3.9-2.6-6.1-6.5-6.5 3.9-.4 6.1-2.6 6.5-6.5z"/><path fill="currentColor" d="M18 13.5c.25 2.2 1.3 3.25 3.5 3.5-2.2.25-3.25 1.3-3.5 3.5-.25-2.2-1.3-3.25-3.5-3.5 2.2-.25 3.25-1.3 3.5-3.5z"/></svg>`;

// ---------- browse by field (like AI Hub's field filter) ----------
// one line icon per field (24 x 24, stroke = the field colour)
const GROUP_ICON = {
  people_health: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M7.5 11.5h2.5l1.5-2.5 2 4 1.5-1.5h1.5"/>',
  language_knowledge: '<path d="M3 5.5c3-1.3 6-1 9 1 3-2 6-2.3 9-1V19c-3-1.3-6-1-9 1-3-2-6-2.3-9-1z"/><path d="M12 6.5V20"/>',
  society_safety: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5.5 10.5v7M9.8 10.5v7M14.2 10.5v7M18.5 10.5v7"/><path d="M3 20h18"/>',
  culture_life: '<rect x="3" y="4.5" width="18" height="13" rx="2.5"/><path d="m10 8.5 5 2.5-5 2.5z"/><path d="M8 21h8"/>',
  economy: '<path d="M4 20V12M9.5 20V7M15 20v-6M20.5 20V4M3 20h18"/>',
  industry_tech: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  mobility_city: '<path d="M5 16v-4.5L7 7h10l2 4.5V16z"/><path d="M5 16v2.5M19 16v2.5M3.5 11.5h17"/><circle cx="8.2" cy="13.8" r="1"/><circle cx="15.8" cy="13.8" r="1"/>',
  nature_env: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19c3-4 6-7 10-9"/>',
};
const groupIcon = (gid, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GROUP_ICON[gid] || '<circle cx="12" cy="12" r="7"/>'}</svg>`;
const groupColor = gid => GROUP_COLORS[META.groups.findIndex(g => g.id === gid) % GROUP_COLORS.length];
function browseHomeHTML() {
  return `<section class="browse-home"><div class="bh-head"><h3>${esc(t("browse_title"))}</h3><p class="hint">${esc(t("browse_hint"))}</p></div>
    <div class="bh-grid">${META.groups.map(g => {
      const tops = META.domains.filter(d => d.group === g.id).sort((a, b) => b.n_main - a.n_main).slice(0, 3).map(name);
      return `<a class="bh-card" href="#/browse/${esc(g.id)}" style="--gc:${groupColor(g.id)}"><span class="bh-ic">${groupIcon(g.id)}</span>
        <b>${esc(name(g))}</b><span class="bh-n">${esc(t("n_sets_short", { n: g.n }))}</span><small>${esc(tops.join(" · "))}</small></a>`;
    }).join("")}</div></section>`;
}
const browseState = { key: "", items: [], total: 0 };
async function pageBrowse(seq, group, topic) {
  setFrame("page_browse");
  if (!group || !META.groups.some(g => g.id === group)) group = META.groups[0].id;
  const g = META.groups.find(x => x.id === group);
  const topics = META.domains.filter(d => d.group === group && d.n_main > 0).sort((a, b) => b.n_main - a.n_main);
  if (topic && !topics.some(d => d.id === topic)) topic = "";
  const key = `${group}/${topic || ""}`;
  const load = async offset => api(`/api/browse?${topic ? "topic=" + encodeURIComponent(topic) : "group=" + encodeURIComponent(group)}&offset=${offset}&limit=24`);
  if (browseState.key !== key) {
    view(`<div class="loading">${esc(t("loading"))}</div>`);
    let d; try { d = await load(0); } catch (e) { if (seq === navSeq) showError(e); return; }
    if (seq !== navSeq) return;
    Object.assign(browseState, { key, items: d.items, total: d.total });
  }
  const card = c => `<article class="dcard bcard">
    <div class="dcard-top">${tile(c, "tile-s")}<div><h4><a href="#/dataset/${esc(c.id)}">${esc(L(c, "title"))}</a></h4>
      <div class="notes"><span>${esc(t("size"))} ${esc(c.size)}</span><span>${esc(t("difficulty"))} ${esc(T[lang].difficulty_v[c.difficulty] ?? c.difficulty)}</span><span>${esc(t("downloads"))} ${esc(c.downloads)}</span></div></div></div>
    <div>${c.domains.map(x => `<span class="tag">#${esc(name(x))}</span>`).join("")}</div>
    <p class="easy">${esc(L(c, "easy"))}</p>
    <div class="dcard-btns"><a class="btn btn-blue btn-sm" href="#/dataset/${esc(c.id)}">${esc(t("details"))}</a>${cmpButton(c.id)}</div></article>`;
  const draw = () => {
    view(`<nav class="bgroups">${META.groups.map(x => `<a href="#/browse/${esc(x.id)}" class="${x.id === group ? "on" : ""}" style="--gc:${groupColor(x.id)}"><i>${groupIcon(x.id, 16)}</i>${esc(name(x))}<span>${x.n}</span></a>`).join("")}</nav>
      <section class="panel btopics"><h3><i class="dot" style="background:${groupColor(group)}"></i>${esc(name(g))}</h3>
        <div class="chips"><a class="chip ${topic ? "" : "on"}" href="#/browse/${esc(group)}">${esc(t("all"))}<span class="n">${g.n}</span></a>${topics.map(d =>
          `<a class="chip ${d.id === topic ? "on" : ""}" href="#/browse/${esc(group)}/${esc(d.id)}">${esc(name(d))}<span class="n">${d.n_main}</span></a>`).join("")}</div></section>
      <div class="res-head"><div><h3>${esc(t("n_items", { n: browseState.total }))}</h3><p class="hint" style="margin:0">${esc(t("browse_sort"))}</p></div></div>
      <div class="grid">${browseState.items.map(card).join("")}</div>
      ${browseState.items.length < browseState.total ? `<div class="actions" style="margin-top:24px"><button class="btn btn-line" id="bmore">${esc(t("more"))}</button></div>` : ""}`);
    bindCompare();
    const more = $("#bmore");
    if (more) more.onclick = async () => {
      more.disabled = true;
      try { const d = await load(browseState.items.length); browseState.items.push(...d.items); } catch (e) { more.disabled = false; return; }
      const y = window.scrollY; draw(); window.scrollTo(0, y);
    };
  };
  draw();
}

// ---------- results ----------
function cmpButton(id) {
  const on = compare.includes(id);
  return `<button class="btn btn-line btn-sm ${on ? "on" : ""}" data-cmp="${esc(id)}">${esc(on ? t("in_cmp") : t("add_cmp"))}</button>`;
}
function bindCompare(root = document) {
  root.querySelectorAll("[data-cmp]").forEach(b => b.onclick = () => {
    const id = b.dataset.cmp;
    if (compare.includes(id)) compare = compare.filter(x => x !== id);
    else if (compare.length >= META.limits.max_compare) { alert(t("cmp_full", { n: META.limits.max_compare })); return; }
    else compare = [...compare, id];
    saveCompare();
    root.querySelectorAll(`[data-cmp="${CSS.escape(id)}"]`).forEach(x => {
      const on = compare.includes(id); x.classList.toggle("on", on); x.textContent = on ? t("in_cmp") : t("add_cmp");
    });
  });
}

function profileSummary(profile) {
  const parts = [];
  if (profile.text) parts.push(`“${profile.text}”`);
  const m = META.colleges.flatMap(c => c.majors).find(m => m.id === profile.major);
  if (m) parts.push(name(m));
  const ds = META.domains.filter(d => profile.interests.includes(d.id)).map(name);
  if (ds.length) parts.push(ds.join(", "));
  return parts.map(x => `<span>${esc(x)}</span>`).join("");
}

function resultsHTML(d, stale, p) {
  const card = c => `
  <article class="dcard">
    <div class="dcard-top">${tile(c, "tile-s")}
      <div><h4><a href="#/dataset/${esc(c.id)}">${esc(L(c, "title"))}</a></h4>
        <div class="meter" title="${esc(t("relevance"))} ${c.score.toFixed(1)}/10">${esc(t("relevance"))} <span class="meter-bar"><i style="width:${Math.max(4, Math.min(100, c.score * 10))}%"></i></span><b>${c.score.toFixed(1)}</b>${c.match ? `<span class="badge ${c.match}">${esc(t(c.match))}</span>` : ""}</div></div>
    </div>
    <div>${c.domains.map(x => `<span class="tag">#${esc(name(x))}</span>`).join("")}</div>
    <p class="easy">${esc(L(c, "easy"))}</p>
    ${c.reasons.length ? `<ul class="why">${c.reasons.map(r => `<li>${esc(glue(r))}</li>`).join("")}</ul>` : ""}
    <div class="notes">${c.notes.flatMap(n => n.split(" · ")).map(n => `<span>${esc(n)}</span>`).join("")}</div>
    ${c.idea ? `<div class="idea"><b>${esc(L(c.idea, "title"))}</b>${esc(L(c.idea, "desc"))}
      <button type="button" class="chat-btn" data-chat="${esc(c.id)}" title="${esc(t("chat_tip"))}">${AI_ICON}${esc(t("chat_open"))}</button></div>` : ""}
    <div class="dcard-btns"><a class="btn btn-blue btn-sm" href="#/dataset/${esc(c.id)}">${esc(t("details"))}</a>${cmpButton(c.id)}</div>
  </article>`;
  return `<div class="${stale ? "stale" : ""}">
    <div class="res-head"><div><h3>${esc(t("n_results", { n: d.items.length }))}</h3><div class="sum">${profileSummary(p)}</div></div>
      <a class="btn btn-line btn-sm" href="#/">${esc(t("edit"))}</a></div>
    ${d.no_match ? `<div class="msg">${esc(t("no_match"))}</div>` : ""}
    ${d.items.length ? `<div class="grid">${d.items.map(card).join("")}</div>` : `<div class="empty">—</div>`}
    ${d.sites.length ? `<div class="panel others"><b>${esc(t("others"))}</b><br>${d.sites.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>`).join("")}
      ${lang === "ko" && /[가-힣]/.test(profile.text) ? `<p class="hint" style="margin:10px 0 0">${esc(t("others_tip"))}</p>` : ""}</div>` : ""}</div>`;
}

// mode: "lang" = language switched on this page (keep the scroll position),
//       "back" = returning from another page (scroll back to where the student was), "new" = top of the page
async function pageResults(seq, mode) {
  setFrame("page_results");
  // a new request uses the form; going back (menu, back button, other pages) shows the current results
  const fresh = freshRequest; freshRequest = false;
  const p = fresh || !results.profile ? profile : results.profile;
  if (!(p.text || p.major || (p.interests || []).length)) { location.hash = "#/"; return; }
  const y0 = window.scrollY;
  const mine = sameProfile(results.profile, p);
  let d = mine ? cachedResults() : null;
  if (!d) {
    // language switch: keep the other language's cards on screen (faded) while the new ones load
    const other = mine ? cachedResults(lang === "ko" ? "en" : "ko") : null;
    view(other ? resultsHTML(other, true, p) : `<div class="loading">${esc(t("loading"))}</div>`);
    if (other) window.scrollTo(0, mode === "lang" ? y0 : tabStore.get("resScroll", 0));
    try { d = await api("/api/recommend", { ...p, lang }); } catch (e) { if (seq === navSeq) showError(e); return; }
    keepResults(p, lang, d);
    if (seq !== navSeq) return;
    if (!other) mode = "new";
  }
  const y = window.scrollY;
  view(resultsHTML(d, false, p));
  bindCompare();
  updateResultsNav();
  window.scrollTo(0, mode === "lang" ? y : mode === "back" ? tabStore.get("resScroll", 0) : 0);
}

// ---------- dataset page ----------
async function pageDataset(seq, id) {
  setFrame("page_dataset");
  let d;
  try { d = await api(`/api/dataset/${encodeURIComponent(id)}`); } catch (e) { if (seq === navSeq) showError(e); return; }
  if (seq !== navSeq) return;
  setFrame("page_dataset", L(d, "title"));
  const lv = { beginner: "lv_beginner", capstone: "lv_capstone", research: "lv_research" };
  view(`
  ${results.profile ? `<p class="back"><a href="#/results">${esc(t("back"))}</a></p>` : ""}
  <section class="dhead">${tile(d, "tile-l")}
    <div>
      <div class="hashes">${d.tags.slice(0, 6).map(x => `<span>#${esc(x)}</span>`).join("")}</div>
      <h1>${esc(L(d, "title"))}</h1>
      <div class="meta">
        <span><em>${esc(t("build_year"))}</em>${esc(d.build_year)}</span><span><em>${esc(t("updated"))}</em>${esc(d.last_update)}</span>
        <span><em>${esc(t("views"))}</em>${esc(d.views)}</span><span><em>${esc(t("downloads"))}</em>${esc(d.downloads)}</span>
        <span><em>${esc(t("size"))}</em>${esc(d.size)}</span><span><em>${esc(t("difficulty"))}</em>${esc(T[lang].difficulty_v[d.difficulty] ?? d.difficulty)}</span>
      </div>
      <div class="btn-row"><a class="btn btn-coral" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(t("open_aihub"))} ↗</a>${cmpButton(d.id)}<a class="btn btn-line btn-sm" href="#/about/map/${esc(d.id)}">${esc(t("on_map"))}</a></div>
    </div>
  </section>
  <nav class="tabs"><a href="#s-easy">${esc(t("tab_easy"))}</a><a href="#s-ideas">${esc(t("tab_ideas"))}</a><a href="#s-facts">${esc(t("tab_facts"))}</a><a href="#s-detail">${esc(t("tab_detail"))}</a>${d.related.length ? `<a href="#s-related">${esc(t("tab_related"))}</a>` : ""}</nav>
  <section class="panel sec" id="s-easy"><h3>${esc(t("tab_easy"))}</h3>
    <div style="margin:4px 0 12px">${d.domains.map(x => `<span class="tag">#${esc(name(x))}</span>`).join("")}</div>
    <p class="big-easy">${esc(L(d, "easy"))}</p>
    ${d.tasks.length ? `<p class="hint" style="margin:14px 0 0"><b>${esc(t("tasks"))}:</b> ${d.tasks.map(name).map(esc).join(" · ")}</p>` : ""}
    ${d.has_manual ? "" : `<p class="hint" style="margin:10px 0 0">${esc(t("no_manual"))}</p>`}</section>
  <section class="panel sec" id="s-ideas"><h3>${esc(t("tab_ideas"))}</h3>
    <div class="ideas">${d.ideas.map(x => `<div class="idea-card"><span class="lvl">${esc(t(lv[x.level] || x.level))}</span><b>${esc(L(x, "title"))}</b><span>${esc(L(x, "desc"))}</span></div>`).join("")}</div>
    <div class="chat-cta"><button type="button" class="btn btn-ai" data-chat="${esc(d.id)}">${AI_ICON}${esc(t("chat_open"))}</button><span class="hint">${esc(t("chat_tip"))}</span></div></section>
  <section class="panel sec" id="s-facts"><h3>${esc(t("tab_facts"))}</h3>
    <table class="facts">${d.facts.map(f => `<tr><th>${esc(f[lang])}</th><td>${esc(f["v_" + lang])}</td></tr>`).join("")}</table></section>
  <section class="panel sec" id="s-detail"><h3>${esc(t("tab_detail"))}</h3><p class="detail">${esc(L(d, "detail"))}</p></section>
  ${d.related.length ? `<section class="panel sec" id="s-related"><h3>${esc(t("tab_related"))}</h3>
    <div class="related">${d.related.map(r => `<a class="rel" href="#/dataset/${esc(r.id)}">${tile(r, "tile-m")}<span>${esc(L(r, "title"))}</span></a>`).join("")}</div></section>` : ""}`);
  document.querySelectorAll(".tabs a").forEach(a => a.onclick = e => { e.preventDefault(); $(a.getAttribute("href")).scrollIntoView({ behavior: "smooth" }); });
  bindCompare();
}

// ---------- compare ----------
async function pageCompare(seq) {
  setFrame("page_compare");
  if (!compare.length) { view(`<div class="empty">${esc(t("cmp_empty"))}</div>`); return; }
  let d;
  try { d = await api(`/api/cards?ids=${encodeURIComponent(compare.join(","))}`); } catch (e) { if (seq === navSeq) showError(e); return; }
  if (seq !== navSeq) return;
  const items = d.items;
  if (!items.length) { view(`<div class="empty">${esc(t("cmp_empty"))}</div>`); return; }
  // rows by fact name, not position: datasets can miss a fact (e.g. no baseline), which used to shift the rows below it
  const factNames = [], seen = new Set();
  items.forEach(c => c.facts.forEach(f => { if (!seen.has(f.ko)) { seen.add(f.ko); factNames.push(f); } }));
  const rows = factNames.map(f => `<tr><th scope="row">${esc(f[lang])}</th>${items.map(c => `<td>${esc(c.facts.find(x => x.ko === f.ko)?.["v_" + lang] ?? "—")}</td>`).join("")}</tr>`).join("");
  view(`<div class="cmp-wrap"><table class="cmp">
    <thead><tr><th></th>${items.map(c => `<td>${tile(c, "tile-s")}<a href="#/dataset/${esc(c.id)}"><b>${esc(L(c, "title"))}</b></a>
      <button class="btn btn-line btn-sm" style="margin-top:8px" data-rm="${esc(c.id)}">${esc(t("remove"))}</button></td>`).join("")}</tr></thead>
    <tbody><tr><th scope="row">${esc(t("easy_row"))}</th>${items.map(c => `<td>${esc(L(c, "easy"))}</td>`).join("")}</tr>
      <tr><th scope="row">${esc(t("fields_row"))}</th>${items.map(c => `<td>${c.domains.map(x => `<span class="tag">#${esc(name(x))}</span>`).join("")}</td>`).join("")}</tr>
      ${rows}
      <tr><th></th>${items.map(c => `<td><a class="btn btn-coral btn-sm" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(t("open_aihub"))} ↗</a></td>`).join("")}</tr></tbody>
  </table></div>`);
  document.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { compare = compare.filter(x => x !== b.dataset.rm); saveCompare(); route(); });
}

// ---------- router ----------
// what the "AI로 프로젝트 계획 세우기" prompt says about the student and how this dataset was found
let lastHash = "", fromHash = "";                   // the page before the current one (a dataset page knows where it was opened from)
function planContext(id) {
  const d = results.profile ? cachedResults() : null;
  const items = d?.items || [];
  const i = items.findIndex(x => x.id === id);
  if (i >= 0) {
    const x = items[i];
    return { profile: results.profile, via: { kind: "recommend", rank: i + 1, total: items.length, score: x.score, match: x.match, reasons: x.reasons } };
  }
  const [, page, a, b] = ((currentPage === "dataset" ? fromHash : location.hash) || "").split("/");
  let via = { kind: "direct" };
  if (page === "about" && a === "map" && typeof mapState === "object") via = { kind: "map", field: mapState.field, topic: mapState.topic };
  else if (page === "browse") via = { kind: "browse", field: a ? decodeURIComponent(a) : null, topic: b ? decodeURIComponent(b) : null };
  else if (page === "compare") via = { kind: "compare" };
  else if (page === "results" && results.profile) return { profile: results.profile, via: { kind: "recommend" } };
  return { profile: { univ: profile.univ, major: profile.major, interests: [...profile.interests], text: profile.text }, via };
}

async function route(reason) {
  const seq = ++navSeq;
  if (location.hash !== lastHash) { fromHash = lastHash; lastHash = location.hash; }
  const [, page, id, extra] = location.hash.split("/");
  const next = ["results", "compare", "about", "browse"].includes(page) || (page === "dataset" && id) ? page : "home";
  if (currentPage === "results" && next !== "results") tabStore.set("resScroll", window.scrollY);   // remember where we were
  const prev = currentPage;
  currentPage = next;
  closeDropdowns();
  try {
    if (next === "results") await pageResults(seq, reason === "lang" ? "lang" : prev && prev !== "home" && prev !== "results" ? "back" : "new");
    else if (next === "dataset") { await pageDataset(seq, decodeURIComponent(id)); if (reason !== "lang") window.scrollTo(0, 0); }
    else if (next === "compare") await pageCompare(seq);
    else if (next === "browse") { await pageBrowse(seq, id && decodeURIComponent(id), extra && decodeURIComponent(extra)); if (reason !== "lang") window.scrollTo(0, 0); }
    else if (next === "about") { await window.About.render(seq, id, extra && decodeURIComponent(extra)); if (reason !== "lang") window.scrollTo(0, 0); }
    else await pageHome(seq);
  } catch (e) { if (seq === navSeq) showError(e); }
}

async function start() {
  document.querySelectorAll(".lang button").forEach(b => b.onclick = () => {
    if (b.dataset.lang === lang) return;
    lang = b.dataset.lang; store.set("lang", lang);
    const y = window.scrollY;
    route("lang").then(() => { if (currentPage !== "results") window.scrollTo(0, y); });
  });
  saveCompare();
  try { META = await api("/api/meta"); } catch (e) { setFrame("page_find"); showError(e); return; }
  window.addEventListener("hashchange", () => route());
  document.addEventListener("click", e => { const b = e.target.closest("[data-chat]"); if (b) { e.preventDefault(); window.ProjectChat.open(b.dataset.chat); } });
  route();
}
start();
