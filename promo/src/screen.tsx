import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Box, useScene } from "./context";
import { clamp, Sfx, SoundId, usePop } from "./parts";
import { C, EASE, EASE_IN_OUT } from "./theme";

// Product-demo pieces: a browser window showing a real app screenshot, a camera that glides and zooms
// to parts of the page, a spotlight and a cursor. All positions are page pixels (page = 1440 x 900).
export const PAGE = { w: 1440, h: 900 };
export const WIN = { w: 1296, bar: 46 }; // browser width on the 1920 x 1080 canvas, title bar height
export const VIEW = { w: WIN.w, h: (WIN.w * PAGE.h) / PAGE.w }; // 1296 x 810
const S0 = VIEW.w / PAGE.w; // page px -> canvas px at zoom 1 (0.9)

// Camera keyframe: at frame `at`, show the page centred on (cx, cy) at zoom z (1 = whole page).
export type Shot = { at: number; cx: number; cy: number; z: number };
export const WHOLE = (at: number): Shot => ({ at, cx: PAGE.w / 2, cy: PAGE.h / 2, z: 1 });
export const shotOn = (at: number, b: Box, z: number): Shot => ({ at, cx: b.x + b.w / 2, cy: b.y + b.h / 2, z });

// Camera state at the current frame: glides between keyframes over `glide` frames each.
const useCamera = (shots: Shot[], pageH: number, glide = 22) => {
  const frame = useCurrentFrame();
  let cur = shots[0];
  for (let i = 1; i < shots.length; i++) {
    const s = shots[i];
    if (frame < s.at) break;
    const t = interpolate(frame, [s.at, s.at + glide], [0, 1], { ...clamp, easing: EASE_IN_OUT });
    cur = { at: s.at, cx: cur.cx + (s.cx - cur.cx) * t, cy: cur.cy + (s.cy - cur.cy) * t, z: cur.z + (s.z - cur.z) * t };
  }
  const k = S0 * cur.z;
  // Keep the page inside the window (no empty edges when zoomed).
  const tx = Math.min(0, Math.max(VIEW.w - PAGE.w * k, VIEW.w / 2 - cur.cx * k));
  const ty = Math.min(0, Math.max(VIEW.h - pageH * k, VIEW.h / 2 - cur.cy * k));
  return { k, tx, ty };
};

// Browser window with the screenshot `src` (public/screens/<lang>/<src>.png) and page-space overlays as children.
export const Browser: React.FC<{
  screens: { src: string; from: number; h?: number }[]; // screenshot changes (cross-fade) at given frames; h = page height
  shots: Shot[];
  pageH?: number; // height of the tallest page shown (camera can scroll down to it)
  enterAt?: number; // frame the window flies in (omit to show it at once)
  children?: React.ReactNode;
}> = ({ screens, shots, pageH = PAGE.h, enterAt, children }) => {
  const frame = useCurrentFrame();
  const { lang, ui } = useScene();
  const { k, tx, ty } = useCamera(shots, pageH);
  const enter = enterAt === undefined ? 1 : interpolate(frame, [enterAt, enterAt + 26], [0, 1], { ...clamp, easing: EASE });
  return (
    <div
      style={{
        position: "absolute",
        left: (1920 - WIN.w) / 2,
        top: 132,
        width: WIN.w,
        height: VIEW.h + WIN.bar,
        borderRadius: 18,
        overflow: "hidden",
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.10)",
        boxShadow: "0 40px 90px rgba(30,41,79,0.22), 0 8px 24px rgba(30,41,79,0.10)",
        opacity: enter,
        transform: `perspective(1800px) translateY(${(1 - enter) * 120}px) rotateX(${(1 - enter) * 14}deg) scale(${0.94 + 0.06 * enter})`,
      }}
    >
      <div style={{ height: WIN.bar, display: "flex", alignItems: "center", gap: 9, padding: "0 18px", background: "#f8fafc", borderBottom: `1px solid ${C.line}` }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <div style={{ margin: "0 auto", padding: "6px 60px", borderRadius: 8, background: "#eef2f7", color: C.sub, fontSize: 17, fontWeight: 500 }}>
          🔒 {ui.urlBar}
        </div>
      </div>
      <div style={{ position: "relative", width: VIEW.w, height: VIEW.h, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: PAGE.w, height: pageH, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${k})` }}>
          {screens.map((s, i) => {
            const next = screens[i + 1];
            const inP = i === 0 ? 1 : interpolate(frame, [s.from, s.from + 10], [0, 1], clamp);
            const visible = frame >= s.from && (!next || frame < next.from + 10);
            return visible ? (
              <Img key={s.src} src={staticFile(`screens/${lang}/${s.src}.png`)} style={{ position: "absolute", left: 0, top: 0, width: PAGE.w, height: s.h ?? PAGE.h, opacity: inP }} />
            ) : null;
          })}
          {children}
        </div>
      </div>
      {enterAt !== undefined ? <Sfx id="whoosh" at={enterAt} /> : null}
      {shots.slice(1).map((s, i) => (
        <Sfx key={s.at} id={cameraSound(shots[i], s)} at={s.at} />
      ))}
    </div>
  );
};

// Sound for a camera move: rising sweep when zooming in, falling when pulling back, soft swish when gliding.
const cameraSound = (a: Shot, b: Shot): SoundId => (b.z > a.z + 0.05 ? "zoomIn" : b.z < a.z - 0.05 ? "zoomOut" : "swish");

// Dims the page except one box, with a glowing ring around it (page space). Shown between `from` and `to`.
export const Spotlight: React.FC<{ box: Box; from: number; to?: number; pad?: number; radius?: number }> = ({ box, from, to = 1e9, pad = 10, radius = 18 }) => {
  const frame = useCurrentFrame();
  const p = Math.min(
    interpolate(frame, [from, from + 12], [0, 1], { ...clamp, easing: EASE }),
    interpolate(frame, [to, to + 10], [1, 0], clamp),
  );
  const h = box.h;
  return (
    <>
    <Sfx id="pluck" at={from + 2} />
    {p <= 0 ? null : <div
      style={{
        position: "absolute",
        left: box.x - pad,
        top: box.y - pad,
        width: box.w + pad * 2,
        height: h + pad * 2,
        borderRadius: radius,
        boxShadow: `0 0 0 3px rgba(55,138,255,${0.9 * p}), 0 0 30px 6px rgba(124,92,255,${0.35 * p}), 0 0 0 4000px rgba(15,23,42,${0.38 * p})`,
        pointerEvents: "none",
      }}
    />}
    </>
  );
};

// Mouse pointer moving along points (page space); `clicks` are frames where it presses.
export const Cursor: React.FC<{ path: { at: number; x: number; y: number }[]; clicks?: number[]; hideAfter?: number }> = ({ path, clicks = [], hideAfter = 1e9 }) => {
  const frame = useCurrentFrame();
  const show = usePop(path[0].at - 4, 20);
  let x = path[0].x;
  let y = path[0].y;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const t = interpolate(frame, [a.at, b.at], [0, 1], { ...clamp, easing: EASE_IN_OUT });
    if (frame >= a.at) {
      x = a.x + (b.x - a.x) * t;
      y = a.y + (b.y - a.y) * t;
    }
  }
  const press = clicks.reduce((m, c) => Math.max(m, interpolate(frame, [c - 2, c + 1, c + 8], [0, 1, 0], clamp)), 0);
  const sounds = (
    <>
      {path.slice(1).map((b, i) => (Math.hypot(b.x - path[i].x, b.y - path[i].y) > 120 ? <Sfx key={`m${i}`} id="swish" at={path[i].at + 2} /> : null))}
      {clicks.map((c) => <Sfx key={`c${c}`} id="click" at={c} />)}
    </>
  );
  if (frame > hideAfter + 8) return sounds;
  const fade = interpolate(frame, [hideAfter, hideAfter + 8], [1, 0], clamp);
  return (
    <>
      {sounds}
      {clicks.map((c) => {
        const r = interpolate(frame, [c, c + 18], [0, 1], { ...clamp, easing: EASE });
        return r > 0 && r < 1 ? (
          <div key={c} style={{ position: "absolute", left: x - 30 * r, top: y - 30 * r, width: 60 * r, height: 60 * r, borderRadius: "50%", border: `3px solid ${C.blue}`, opacity: 1 - r }} />
        ) : null;
      })}
      <svg
        width={26}
        height={34}
        viewBox="0 0 26 34"
        style={{ position: "absolute", left: x - 3, top: y - 2, opacity: show * fade, transform: `scale(${1 - press * 0.15})`, transformOrigin: "3px 2px", filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.25))" }}
      >
        <path d="M3 2 L3 27 L9.5 21 L14 31 L18.5 29 L14 19.5 L23 19.5 Z" fill="#111" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </>
  );
};

// A small floating label pinned next to a box (page space), e.g. "relevance score".
export const Callout: React.FC<{ box: Box; at: number; to?: number; text: string; side?: "right" | "below" }> = ({ box, at, to = 1e9, text, side = "right" }) => {
  const frame = useCurrentFrame();
  const p = usePop(at, 18) * interpolate(frame, [to, to + 8], [1, 0], clamp);
  const left = side === "right" ? box.x + box.w + 16 : box.x;
  const top = side === "right" ? box.y + box.h / 2 - 20 : box.y + box.h + 12;
  return (
    <>
    <Sfx id="pop" at={at} />
    <div
      style={{
        position: "absolute",
        left,
        top,
        padding: "8px 16px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        fontSize: 17,
        fontWeight: 700,
        color: "#fff",
        background: `linear-gradient(100deg, ${C.blue}, ${C.violet})`,
        boxShadow: "0 8px 22px rgba(55,138,255,0.35)",
        opacity: p,
        transform: `translateX(${(1 - p) * -12}px) scale(${0.9 + 0.1 * p})`,
        transformOrigin: "left center",
      }}
    >
      {text}
    </div>
    </>
  );
};

export { EASE };
