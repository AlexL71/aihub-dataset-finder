// Intro video. Plays full screen the first time a student opens the home page in a browser tab
// (sessionStorage), and again whenever they press "소개 영상 보기" / "Watch the intro" (window.PromoIntro.open()).
// - Language: starts in the site's language; 한국어 / English buttons switch the video (from the start).
// - Phone version: an upright phone gets the vertical video (promo-<lang>-v.mp4); turning the phone switches
//   between vertical and landscape at the same moment (both versions have the same timing).
// - Ends by itself, or with "건너뛰기" (Skip) or Esc.
// - Sound is on every time the video opens (a link, a reload or the button). Browsers do not let a site start sound
//   before the visitor has interacted with it; when that blocks it, the video starts muted and the sound turns on
//   with the visitor's first tap, click or key press anywhere. The sound button is a see-through speaker icon;
//   turning the voice off lasts until the video closes (it is not remembered).
"use strict";
(() => {
  const SEEN_KEY = "intro_seen";
  const TEXT = {
    ko: { skip: "건너뛰기", mute: "소리 끄기", unmute: "소리 켜기",
          label: "AI Hub DataFinder 소개 영상", lang: "영상 언어" },
    en: { skip: "Skip", mute: "Turn sound off", unmute: "Turn sound on",
          label: "AI Hub DataFinder intro video", lang: "Video language" },
  };
  const LANGS = [["ko", "한국어"], ["en", "English"]];

  const store = {
    get(area, k) { try { return area.getItem(k); } catch (e) { return null; } },
    set(area, k, v) { try { area.setItem(k, v); } catch (e) { /* private window: ignore */ } },
  };
  const siteLang = () => { try { return JSON.parse(localStorage.getItem("lang")) === "en" ? "en" : "ko"; } catch (e) { return "ko"; } };
  const onHome = () => !location.hash.split("/")[1];   // "", "#", "#/"
  const portrait = () => window.matchMedia("(orientation: portrait)").matches;
  const source = (lang, vertical) => `/static/promo-${lang}${vertical ? "-v" : ""}.mp4`;
  const poster = (lang, vertical) => `/static/promo-poster-${lang}${vertical ? "-v" : ""}.jpg`;

  // Speaker icons (outline, currentColor): sound on = speaker with waves, sound off = speaker with a cross.
  const ICON = {
    on: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18.3 6.3a8 8 0 0 1 0 11.4"/></svg>',
    off: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>',
  };

  let current = null;   // the open intro, if any

  function open() {
    if (current) return;
    const ui = TEXT[siteLang()];
    let lang = siteLang();
    let vertical = portrait();

    const box = document.createElement("div");
    box.id = "intro";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", ui.label);
    box.innerHTML = `
      <div class="intro-frame">
        <video class="intro-video" playsinline preload="auto"></video>
        <div class="intro-bar"><div class="intro-progress"></div></div>
      </div>
      <div class="intro-actions">
        <div class="intro-langs" role="group" aria-label="${ui.lang}">
          ${LANGS.map(([id, name]) => `<button type="button" data-lang="${id}" aria-pressed="false">${name}</button>`).join("")}
        </div>
        <button type="button" class="intro-sound"></button>
        <button type="button" class="intro-skip">${ui.skip} ›</button>
      </div>`;
    document.body.appendChild(box);
    document.documentElement.classList.add("intro-open");

    const video = box.querySelector("video");
    const soundBtn = box.querySelector(".intro-sound");
    const skipBtn = box.querySelector(".intro-skip");
    const bar = box.querySelector(".intro-progress");
    const langBtns = [...box.querySelectorAll(".intro-langs button")];
    let closed = false;
    let wantSound = true;   // sound on at every open; the sound button changes it until the video closes

    // Load the right file; keep the playing position when only the shape changes (same timing in both).
    const load = (keepTime) => {
      const t = keepTime ? video.currentTime : 0;
      video.poster = poster(lang, vertical);
      video.src = source(lang, vertical);
      if (t) video.addEventListener("loadedmetadata", () => { video.currentTime = t; }, { once: true });
      langBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
      play();
    };
    // Sound button shows what is heard now; its label says what pressing it does.
    const showSound = () => {
      const on = !video.muted;
      soundBtn.innerHTML = on ? ICON.on : ICON.off;
      soundBtn.setAttribute("aria-label", on ? ui.mute : ui.unmute);
      soundBtn.setAttribute("aria-pressed", String(on));
    };
    // Play with sound if wanted; if the browser blocks sound, play muted until the visitor's first interaction.
    const play = () => {
      video.muted = !wantSound;
      showSound();
      video.play().catch(() => {
        if (closed) return;
        video.muted = true;
        showSound();
        video.play().catch(close);
      });
    };
    // First tap / click / key press anywhere: the browser now allows sound, so turn it on (if the visitor wants it).
    const unlock = (e) => {
      if (closed || !wantSound || !video.muted || (e && e.target === soundBtn)) return;
      video.muted = false;
      showSound();
      video.play().catch(() => {});
    };
    ["pointerdown", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, unlock, true));

    const close = () => {
      if (closed) return;
      closed = true;
      current = null;
      clearInterval(bandTimer);
      shape.removeEventListener("change", onShape);
      document.removeEventListener("keydown", onKey);
      ["pointerdown", "keydown", "touchstart"].forEach(ev => document.removeEventListener(ev, unlock, true));
      video.pause();
      box.classList.add("intro-out");
      document.documentElement.classList.remove("intro-open");
      setTimeout(() => {
        box.remove();
        const q = document.getElementById("q");   // home search box
        if (q) q.focus({ preventScroll: true });
      }, 450);
    };
    const onKey = e => { if (e.key === "Escape") close(); };
    const shape = window.matchMedia("(orientation: portrait)");
    const onShape = () => { if (shape.matches !== vertical) { vertical = shape.matches; load(true); } };

    skipBtn.onclick = close;
    soundBtn.onclick = () => {
      wantSound = video.muted;                       // muted now -> the visitor wants sound, and the other way round
      video.muted = !wantSound;
      showSound();
      video.play().catch(() => {});
    };
    langBtns.forEach(b => { b.onclick = () => { if (b.dataset.lang !== lang) { lang = b.dataset.lang; load(false); } }; });
    video.addEventListener("ended", close);
    video.addEventListener("error", close);             // file missing or cannot play: just show the page
    video.addEventListener("timeupdate", () => {
      if (video.duration) bar.style.transform = `scaleX(${video.currentTime / video.duration})`;
    });
    shape.addEventListener("change", onShape);
    document.addEventListener("keydown", onKey);

    // Where the screen shape differs from the video's, paint the bands with the video's own edge color
    // (sampled a few times a second), so the video looks edge to edge on light and dark scenes.
    const sample = document.createElement("canvas");
    sample.width = 8; sample.height = 8;
    const ctx = sample.getContext("2d", { willReadFrequently: true });
    const paintBands = () => {
      if (closed || !ctx || video.readyState < 2) return;
      try {
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight * 0.04, 0, 0, 8, 8);   // thin strip at the top edge
        const d = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4, color = `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
        box.style.background = color;
        video.style.background = color;
      } catch (e) { /* canvas blocked: keep the default dark color */ }
    };
    const bandTimer = setInterval(paintBands, 250);

    current = { close };
    load(false);
    skipBtn.focus({ preventScroll: true });
  }

  window.PromoIntro = { open };

  // First visit to the home page in this tab: play it automatically.
  if (store.get(sessionStorage, SEEN_KEY) !== "1" && onHome()) {
    store.set(sessionStorage, SEEN_KEY, "1");
    open();
  }
})();
