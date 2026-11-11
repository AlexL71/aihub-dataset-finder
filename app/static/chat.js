// "AI로 프로젝트 계획 세우기" window (opened by any element with data-chat="<dataset id>").
// The server writes one prompt (student profile + how the dataset was found + dataset facts with the AI Hub link
// + the answer outline); a click copies it and opens ChatGPT, Claude or Gemini in a new tab, where the student pastes it.
// No AI is called by this app. Loaded before app.js; uses its helpers ($, esc, lang, api, META, AI_ICON, planContext).
"use strict";

const PT = {
  ko: { head: "AI로 프로젝트 계획 세우기", close: "닫기", pick: "사용할 AI를 고르세요",
    how: "누르면 내 정보, 이 데이터를 찾은 경로, 데이터 정보(AI Hub 주소 포함), 계획을 부탁하는 문장이 함께 복사되고 고른 AI가 새 탭에서 열립니다. 입력창에 붙여 넣고(Ctrl+V) 보내세요.",
    copy: "프롬프트만 복사", copied: "복사했습니다. 원하는 AI의 입력창에 붙여 넣으세요(Ctrl+V).",
    opened: "복사했습니다. 새 탭에서 열린 {name} 입력창에 붙여 넣고(Ctrl+V) 보내세요.",
    copy_fail: "자동 복사가 되지 않았습니다. 아래 미리 보기에서 글을 모두 선택해 복사하세요.",
    file: "파일로 내려받기 (.md)", preview: "프롬프트 미리 보기",
    note: "각 AI는 그 회사의 계정이 필요할 수 있습니다. 이름, 학번, 연락처 같은 개인정보는 넣지 마세요.",
    loading: "프롬프트를 만들고 있습니다…", err: "프롬프트를 만들지 못했습니다. 잠시 뒤 다시 시도하세요." },
  en: { head: "Plan a project with AI", close: "Close", pick: "Choose an AI",
    how: "Your profile, how you found this dataset, the dataset information (with its AI Hub link) and a request for a plan are copied, and the AI you choose opens in a new tab. Paste it into the message box (Ctrl+V) and send.",
    copy: "Copy the prompt only", copied: "Copied. Paste it into the AI of your choice (Ctrl+V).",
    opened: "Copied. Paste it into {name} in the new tab (Ctrl+V) and send.",
    copy_fail: "Automatic copy did not work. Select all the text in the preview below and copy it.",
    file: "Download as a file (.md)", preview: "Preview the prompt",
    note: "Each AI may need an account with that company. Do not enter personal information such as your name, student ID or contact details.",
    loading: "Writing the prompt…", err: "The prompt could not be made. Please try again in a moment." },
};
const pt = k => PT[lang][k] ?? PT.ko[k];
const SITE_ICON = {
  chatgpt: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 19.4 7.75v8.5L12 20.5l-7.4-4.25v-8.5z"/><path d="M12 8.5v7M8.9 10.25l6.2 3.5M15.1 10.25l-6.2 3.5"/></svg>',
  claude: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18"/></svg>',
  gemini: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.6 5 4.5 8.9 9.5 9.5-5 .6-8.9 4.5-9.5 9.5-.6-5-4.5-8.9-9.5-9.5 5-.6 8.9-4.5 9.5-9.5z"/></svg>',
};

// synchronous copy: works inside the click, before a new tab takes the focus away
function copyNow(text) {
  const back = document.activeElement;
  const ta = Object.assign(document.createElement("textarea"), { value: text });
  ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove(); back?.focus?.({ preventScroll: true });
  return ok;
}
async function copyText(text) {
  if (copyNow(text)) return true;
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function saveFile(text, name) {
  const file = name.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 50) + ".md";
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: file });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function overlay(html) {
  document.querySelector(".chat-overlay")?.remove();
  const back = document.activeElement;
  const ov = document.createElement("div");
  ov.className = "chat-overlay";
  ov.innerHTML = `<div class="chat chat-pick" role="dialog" aria-modal="true" aria-labelledby="chat-title">${html}</div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = "hidden";
  const onKey = e => { if (e.key === "Escape") close(); };
  const close = () => { ov.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); back?.focus?.(); };
  document.addEventListener("keydown", onKey);
  ov.querySelector(".chat-x").onclick = close;
  ov.addEventListener("click", e => { if (e.target === ov) close(); });
  return ov;
}

const prompts = {};                                  // request -> { prompt, title, url } (same request, no second call)

async function openPicker(datasetId) {
  const sites = META.ai_sites || [];
  const ov = overlay(`<header class="chat-head"><div><small>${esc(pt("head"))}</small><h3 id="chat-title">…</h3></div>
      <button type="button" class="chat-x" aria-label="${esc(pt("close"))}">×</button></header>
    <div class="pick-body">
      <h4>${esc(pt("pick"))}</h4><p class="pick-how">${esc(pt("how"))}</p>
      <div class="pick-sites">${sites.map(x => `<button type="button" class="pick-site" data-site="${esc(x.id)}" disabled>
        <span class="pick-ic pick-${esc(x.id)}">${SITE_ICON[x.id] || AI_ICON}</span><b>${esc(x.name)}</b><small>${esc(x.by)}</small></button>`).join("")}</div>
      <p class="pick-msg" role="status" aria-live="polite">${esc(pt("loading"))}</p>
      <div class="pick-tools"><button type="button" class="btn btn-line btn-sm pick-copy" disabled>${esc(pt("copy"))}</button>
        <button type="button" class="btn btn-line btn-sm pick-file" disabled>${esc(pt("file"))}</button></div>
      <details class="pick-pre"><summary>${esc(pt("preview"))}</summary><textarea readonly rows="12"></textarea></details>
      <p class="pick-note">${esc(pt("note"))}</p>
    </div>`);
  const msg = ov.querySelector(".pick-msg"), pre = ov.querySelector(".pick-pre textarea");
  const say = (text, cls = "") => { msg.textContent = text; msg.className = "pick-msg " + cls; };

  const body = { dataset_id: datasetId, ...planContext(datasetId), lang };
  const key = JSON.stringify(body);
  let r = prompts[key];
  if (!r) {
    try { r = prompts[key] = await api("/api/prompt", body); } catch { say(pt("err"), "bad"); return; }
  }
  if (!ov.isConnected) return;
  ov.querySelector("#chat-title").textContent = r.title;
  pre.value = r.prompt;
  say("");
  ov.querySelectorAll(".pick-site, .pick-copy, .pick-file").forEach(b => { b.disabled = false; });
  const failed = () => { ov.querySelector(".pick-pre").open = true; pre.select(); say(pt("copy_fail"), "bad"); };
  ov.querySelector(".pick-copy").onclick = async () => { (await copyText(r.prompt)) ? say(pt("copied"), "ok") : failed(); };
  ov.querySelector(".pick-file").onclick = () => saveFile(r.prompt, `prompt_${r.title}`);
  for (const b of ov.querySelectorAll(".pick-site")) {
    b.onclick = () => {
      const site = sites.find(x => x.id === b.dataset.site);
      const ok = copyNow(r.prompt);                               // copy first, while this page still has the focus
      window.open(site.url, "_blank", "noopener");                // still inside the click, so pop-up blockers allow it
      ok ? say(pt("opened").replace("{name}", site.name), "ok") : failed();
    };
  }
}

window.ProjectChat = { open: openPicker };
