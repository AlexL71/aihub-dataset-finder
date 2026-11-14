// Intro video shown first when a student arrives at the home page from a link.
// The page behind it shows when the video ends, or right away with "건너뛰기" (Skip) or the Esc key.
// Shown once per browser tab (sessionStorage), so a reload or going back home does not replay it.
// Browsers often block autoplay with sound: then the video plays muted (it has subtitles) with a "소리 켜기" button.
// The Korean or English version is chosen from the language saved by the site's language buttons.
"use strict";
(() => {
  const SEEN_KEY = "intro_seen";
  const TEXT = {
    ko: { skip: "건너뛰기", sound: "🔊 소리 켜기", label: "AI Hub DataFinder 소개 영상" },
    en: { skip: "Skip", sound: "🔊 Sound on", label: "AI Hub DataFinder intro video" },
  };

  const seen = () => { try { return sessionStorage.getItem(SEEN_KEY) === "1"; } catch (e) { return false; } };
  const markSeen = () => { try { sessionStorage.setItem(SEEN_KEY, "1"); } catch (e) { /* private window: ignore */ } };
  const lang = (() => { try { return JSON.parse(localStorage.getItem("lang")) === "en" ? "en" : "ko"; } catch (e) { return "ko"; } })();
  const onHome = () => { const p = location.hash.split("/")[1]; return !p; };   // "", "#", "#/"

  if (seen() || !onHome()) return;
  markSeen();

  // One video per site language (Korean and English narration).
  const SRC = `/static/promo-${lang}.mp4`;
  const POSTER = `/static/promo-poster-${lang}.jpg`;

  const tx = TEXT[lang];
  const box = document.createElement("div");
  box.id = "intro";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", tx.label);
  box.innerHTML = `
    <div class="intro-frame">
      <video class="intro-video" playsinline preload="auto" poster="${POSTER}"><source src="${SRC}" type="video/mp4"></video>
      <div class="intro-bar"><div class="intro-progress"></div></div>
    </div>
    <div class="intro-actions">
      <button type="button" class="intro-sound" hidden>${tx.sound}</button>
      <button type="button" class="intro-skip">${tx.skip} ›</button>
    </div>`;
  document.body.appendChild(box);
  document.documentElement.classList.add("intro-open");

  const video = box.querySelector("video");
  const soundBtn = box.querySelector(".intro-sound");
  const skipBtn = box.querySelector(".intro-skip");
  const bar = box.querySelector(".intro-progress");
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    video.pause();
    box.classList.add("intro-out");
    document.documentElement.classList.remove("intro-open");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => {
      box.remove();
      const q = document.getElementById("q");   // home search box
      if (q) q.focus({ preventScroll: true });
    }, 450);
  };
  const onKey = e => { if (e.key === "Escape") close(); };

  skipBtn.onclick = close;
  soundBtn.onclick = () => { video.muted = false; soundBtn.hidden = true; video.play().catch(() => {}); };
  video.addEventListener("ended", close);
  video.addEventListener("error", close, true);           // file missing or cannot play: just show the page
  video.addEventListener("timeupdate", () => {
    if (video.duration) bar.style.transform = `scaleX(${video.currentTime / video.duration})`;
  });

  // On screens that are not 16:9 the video leaves bands above/below or beside it. Paint them with the video's
  // own edge color (sampled a few times a second), so the video looks edge to edge on light and dark scenes.
  const sample = document.createElement("canvas");
  sample.width = 8; sample.height = 8;
  const ctx = sample.getContext("2d", { willReadFrequently: true });
  const paintBands = () => {
    if (closed || !ctx || video.readyState < 2) return;
    try {
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight * 0.04, 0, 0, 8, 8);   // a thin strip at the top edge
      const d = ctx.getImageData(0, 0, 8, 8).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4, color = `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
      box.style.background = color;
      video.style.background = color;
    } catch (e) { /* canvas blocked: keep the default dark color */ }
  };
  const bandTimer = setInterval(paintBands, 250);
  video.addEventListener("ended", () => clearInterval(bandTimer));
  skipBtn.addEventListener("click", () => clearInterval(bandTimer));
  document.addEventListener("keydown", onKey);
  skipBtn.focus({ preventScroll: true });

  // Try with sound first; if the browser blocks it, play muted and offer the sound button.
  video.muted = false;
  video.play().catch(() => {
    video.muted = true;
    soundBtn.hidden = false;
    video.play().catch(close);
  });
})();
