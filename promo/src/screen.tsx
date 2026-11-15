import React from "react";
import {
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Box, useScene } from "./context";
import { clamp, Sfx, SoundId, usePop } from "./parts";
import { C, EASE, EASE_IN_OUT } from "./theme";

// Product-demo pieces: a device window showing real app screenshots, a camera that glides and zooms to parts of
// the page, a spotlight, a cursor (desktop) or tap (phone), labels, and "reveals" of a later screenshot in one spot.
// All positions are page pixels of the current device's screenshots (see context.tsx RECTS).
//
// Landscape video: a 1296 px browser window under the headline; the 1440 px desktop page fills its width at zoom 1.
// Phone video (1080 x 1920): a large phone frame showing the 390 px phone screenshots at 2.3x (captured at 3x, so
// they stay sharp). The camera only scrolls up and down there: the full app width is always visible, like on a phone.
const BAR = 46; // browser title bar height (desktop only)
const BEZEL = 18; // phone frame border
const PHONE_MAX_ZOOM = 1; // never zoom past the page width on the phone (zooming in cut text at the sides)
const STATUS = 64; // phone status bar (holds the notch) above the app page
const useWindow = () => {
  const { width, height } = useVideoConfig();
  const { rects } = useScene();
  const phone = height > width;
  const w = phone ? 900 : 1296;
  const viewH = phone ? 1312 : (w * 900) / 1440;
  const pageW = rects.view.width;
  return {
    phone,
    w,
    viewH,
    left: (width - w) / 2,
    top: phone ? 300 : 132,
    s0: w / pageW,
    pageW,
  };
};

// Camera keyframe: at frame `at`, show the page centred on (cx, cy) at zoom z (1 = page width fills the window).
// `bw` = width of the thing being shown (page px): the zoom is capped so it always fits the window.
export type Shot = {
  at: number;
  cx: number;
  cy: number;
  z: number;
  bw?: number;
};
// The top of the page at zoom 1 (cx < 0 means "centre of the page width").
export const WHOLE = (at: number): Shot => ({ at, cx: -1, cy: 0, z: 1 });
export const shotOn = (at: number, b: Box, z: number): Shot => ({
  at,
  cx: b.x + b.w / 2,
  cy: b.y + b.h / 2,
  z,
  bw: b.w,
});

// Camera state at the current frame: glides between keyframes over `glide` frames each.
const useCamera = (
  shots: Shot[],
  pageW: number,
  pageH: number,
  status = 0,
  glide = 22,
) => {
  const frame = useCurrentFrame();
  const win = useWindow();
  const fit = (s: Shot): Shot => {
    const cx = s.cx < 0 ? pageW / 2 : s.cx;
    // Largest zoom at which the shown thing still fits the window width (with a small margin). The phone page is
    // already shown large, so its zoom stays at most PHONE_MAX_ZOOM (stronger zooms cut nearby text mid-word).
    const capped = win.phone ? Math.min(s.z, PHONE_MAX_ZOOM) : s.z;
    const z = s.bw
      ? Math.min(capped, (0.94 * win.w) / (s.bw * win.s0))
      : capped;
    return { ...s, cx, z };
  };
  const fitted = shots.map(fit);
  let cur = fitted[0];
  for (let i = 1; i < fitted.length; i++) {
    const s = fitted[i];
    if (frame < s.at) break;
    const t = interpolate(frame, [s.at, s.at + glide], [0, 1], {
      ...clamp,
      easing: EASE_IN_OUT,
    });
    cur = {
      at: s.at,
      cx: cur.cx + (s.cx - cur.cx) * t,
      cy: cur.cy + (s.cy - cur.cy) * t,
      z: cur.z + (s.z - cur.z) * t,
    };
  }
  const k = win.s0 * cur.z;
  // Keep the page inside the window where it is larger than the window (no empty edges when zoomed).
  const tx =
    pageW * k <= win.w
      ? (win.w - pageW * k) / 2
      : Math.min(0, Math.max(win.w - pageW * k, win.w / 2 - cur.cx * k));
  const viewH = win.viewH - status; // visible page height (below the phone status bar)
  const ty = Math.min(0, Math.max(viewH - pageH * k, viewH / 2 - cur.cy * k));
  return { k, tx, ty };
};

// Path of a screenshot for the current language and device.
export const useScreenSrc = () => {
  const { lang, device } = useScene();
  return (name: string) =>
    staticFile(
      `screens/${lang}/${device === "phone" ? "phone/" : ""}${name}.png`,
    );
};

// Device window with screenshots that cross-fade at given frames, and page-space overlays as children.
export const Browser: React.FC<{
  screens: { src: string; from: number }[];
  shots: Shot[];
  enterAt?: number; // frame the window flies in (omit to show it at once)
  children?: React.ReactNode;
}> = ({ screens, shots, enterAt, children }) => {
  const frame = useCurrentFrame();
  const { ui, rects } = useScene();
  const src = useScreenSrc();
  const win = useWindow();
  const sizes = rects.screens as Record<string, { w: number; h: number }>;
  const pageW = Math.max(...screens.map((s) => sizes[s.src].w));
  const pageH = Math.max(...screens.map((s) => sizes[s.src].h));
  const { k, tx, ty } = useCamera(shots, pageW, pageH, win.phone ? STATUS : 0);
  const enter =
    enterAt === undefined
      ? 1
      : interpolate(frame, [enterAt, enterAt + 26], [0, 1], {
          ...clamp,
          easing: EASE,
        });
  const bar = win.phone ? 0 : BAR;

  const page = (
    <div
      style={{
        position: "relative",
        width: win.w,
        height: win.viewH,
        overflow: "hidden",
        background: "#f4f8fa",
        borderRadius: win.phone ? 44 : 0,
      }}
    >
      {win.phone ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            height: STATUS,
            background: "#fff",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 46px",
            fontSize: 24,
            fontWeight: 700,
            color: C.ink,
          }}
        >
          <span>9:41</span>
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span
              style={{
                width: 34,
                height: 16,
                borderRadius: 5,
                border: `2px solid ${C.ink}`,
                padding: 2,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: "80%",
                  height: "100%",
                  borderRadius: 2,
                  background: C.ink,
                }}
              />
            </span>
          </span>
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: win.phone ? STATUS : 0,
          width: win.w,
          height: win.viewH - (win.phone ? STATUS : 0),
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: pageW,
            height: pageH,
            transformOrigin: "0 0",
            transform: `translate(${tx}px, ${ty}px) scale(${k})`,
          }}
        >
          {screens.map((s, i) => {
            const next = screens[i + 1];
            const inP =
              i === 0
                ? 1
                : interpolate(frame, [s.from, s.from + 10], [0, 1], clamp);
            const visible =
              frame >= s.from && (!next || frame < next.from + 10);
            return visible ? (
              <Img
                key={s.src}
                src={src(s.src)}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: sizes[s.src].w,
                  height: sizes[s.src].h,
                  opacity: inP,
                }}
              />
            ) : null;
          })}
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: win.left - (win.phone ? BEZEL : 0),
        top: win.top - (win.phone ? BEZEL : 0),
        width: win.w + (win.phone ? BEZEL * 2 : 0),
        height: win.viewH + bar + (win.phone ? BEZEL * 2 : 0),
        borderRadius: win.phone ? 62 : 18,
        overflow: "hidden",
        background: win.phone ? "#0b1220" : "#fff",
        padding: win.phone ? BEZEL : 0,
        border: win.phone
          ? "2px solid #273449"
          : "1px solid rgba(15,23,42,0.10)",
        boxShadow:
          "0 40px 90px rgba(30,41,79,0.22), 0 8px 24px rgba(30,41,79,0.10)",
        opacity: enter,
        transform: `perspective(1800px) translateY(${(1 - enter) * 120}px) rotateX(${(1 - enter) * 14}deg) scale(${0.94 + 0.06 * enter})`,
      }}
    >
      {win.phone ? null : (
        <div
          style={{
            height: BAR,
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "0 18px",
            background: "#f8fafc",
            borderBottom: `1px solid ${C.line}`,
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span
              key={c}
              style={{ width: 13, height: 13, borderRadius: 7, background: c }}
            />
          ))}
          <div
            style={{
              margin: "0 auto",
              padding: "6px 60px",
              borderRadius: 8,
              background: "#eef2f7",
              color: C.sub,
              fontSize: 17,
              fontWeight: 500,
            }}
          >
            🔒 {ui.urlBar}
          </div>
        </div>
      )}
      {page}
      {win.phone ? (
        <div
          style={{
            position: "absolute",
            top: BEZEL + 12,
            left: "50%",
            width: 150,
            height: 40,
            marginLeft: -75,
            borderRadius: 20,
            background: "#0b1220",
          }}
        />
      ) : null}
      {enterAt !== undefined ? <Sfx id="whoosh" at={enterAt} /> : null}
      {shots.slice(1).map((s, i) => (
        <Sfx key={s.at} id={cameraSound(shots[i], s)} at={s.at} />
      ))}
    </div>
  );
};

// Sound for a camera move: rising sweep when zooming in, falling when pulling back, soft swish when gliding.
const cameraSound = (a: Shot, b: Shot): SoundId =>
  b.z > a.z + 0.05 ? "zoomIn" : b.z < a.z - 0.05 ? "zoomOut" : "swish";

// From frame `at`, one box of another screenshot (same page position) shows on top: e.g. a button that changed.
export const Reveal: React.FC<{
  src: string;
  box: Box;
  at: number;
  until?: number;
  pad?: number;
}> = ({ src, box, at, until = 1e9, pad = 2 }) => {
  const frame = useCurrentFrame();
  const { rects } = useScene();
  const img = useScreenSrc()(src);
  const size = (rects.screens as Record<string, { w: number; h: number }>)[src];
  const p = Math.min(
    interpolate(frame, [at, at + 6], [0, 1], clamp),
    interpolate(frame, [until - 10, until], [1, 0], clamp),
  );
  if (p <= 0) return null;
  const b = {
    x: box.x - pad,
    y: box.y - pad,
    w: box.w + pad * 2,
    h: box.h + pad * 2,
  };
  return (
    <div
      style={{
        position: "absolute",
        left: b.x,
        top: b.y,
        width: b.w,
        height: b.h,
        overflow: "hidden",
        opacity: p,
      }}
    >
      <Img
        src={img}
        style={{
          position: "absolute",
          left: -b.x,
          top: -b.y,
          width: size.w,
          height: size.h,
          maxWidth: "none",
        }}
      />
    </div>
  );
};

// Dims the page except one box, with a glowing ring around it (page space). Shown between `from` and `to`.
export const Spotlight: React.FC<{
  box: Box;
  from: number;
  to?: number;
  pad?: number;
  radius?: number;
  sound?: boolean;
}> = ({ box, from, to = 1e9, pad = 10, radius = 18, sound = true }) => {
  const frame = useCurrentFrame();
  const p = Math.min(
    interpolate(frame, [from, from + 12], [0, 1], { ...clamp, easing: EASE }),
    interpolate(frame, [to, to + 10], [1, 0], clamp),
  );
  return (
    <>
      {sound ? <Sfx id="pluck" at={from + 2} /> : null}
      {p <= 0 ? null : (
        <div
          style={{
            position: "absolute",
            left: box.x - pad,
            top: box.y - pad,
            width: box.w + pad * 2,
            height: box.h + pad * 2,
            borderRadius: radius,
            boxShadow: `0 0 0 3px rgba(55,138,255,${0.9 * p}), 0 0 30px 6px rgba(124,92,255,${0.35 * p}), 0 0 0 4000px rgba(15,23,42,${0.38 * p})`,
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
};

// Mouse pointer (desktop) or finger tap (phone) moving along points (page space); `clicks` are frames where it presses.
export const Cursor: React.FC<{
  path: { at: number; x: number; y: number }[];
  clicks?: number[];
  hideAfter?: number;
}> = ({ path, clicks = [], hideAfter = 1e9 }) => {
  const frame = useCurrentFrame();
  const { device } = useScene();
  const phone = device === "phone";
  const show = usePop(path[0].at - 4, 20);
  let x = path[0].x;
  let y = path[0].y;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const t = interpolate(frame, [a.at, b.at], [0, 1], {
      ...clamp,
      easing: EASE_IN_OUT,
    });
    if (frame >= a.at) {
      x = a.x + (b.x - a.x) * t;
      y = a.y + (b.y - a.y) * t;
    }
  }
  const press = clicks.reduce(
    (m, c) =>
      Math.max(m, interpolate(frame, [c - 2, c + 1, c + 8], [0, 1, 0], clamp)),
    0,
  );
  const sounds = (
    <>
      {phone
        ? null
        : path
            .slice(1)
            .map((b, i) =>
              Math.hypot(b.x - path[i].x, b.y - path[i].y) > 120 ? (
                <Sfx key={`m${i}`} id="swish" at={path[i].at + 2} />
              ) : null,
            )}
      {clicks.map((c) => (
        <Sfx key={`c${c}`} id="click" at={c} />
      ))}
    </>
  );
  if (frame > hideAfter + 8) return sounds;
  const fade = interpolate(frame, [hideAfter, hideAfter + 8], [1, 0], clamp);
  const ring = phone ? 22 : 30;
  return (
    <>
      {sounds}
      {clicks.map((c) => {
        const r = interpolate(frame, [c, c + 18], [0, 1], {
          ...clamp,
          easing: EASE,
        });
        return r > 0 && r < 1 ? (
          <div
            key={c}
            style={{
              position: "absolute",
              left: x - ring * r,
              top: y - ring * r,
              width: 2 * ring * r,
              height: 2 * ring * r,
              borderRadius: "50%",
              border: `${phone ? 2 : 3}px solid ${C.blue}`,
              opacity: 1 - r,
            }}
          />
        ) : null;
      })}
      {phone ? (
        // Finger tap: a soft dot that shows near each tap.
        <div
          style={{
            position: "absolute",
            left: x - 13,
            top: y - 13,
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "rgba(15,23,42,0.28)",
            border: "2px solid rgba(255,255,255,0.9)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            opacity: show * fade * (0.55 + 0.45 * press),
            transform: `scale(${1 - press * 0.2})`,
          }}
        />
      ) : (
        <svg
          width={26}
          height={34}
          viewBox="0 0 26 34"
          style={{
            position: "absolute",
            left: x - 3,
            top: y - 2,
            opacity: show * fade,
            transform: `scale(${1 - press * 0.15})`,
            transformOrigin: "3px 2px",
            filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.25))",
          }}
        >
          <path
            d="M3 2 L3 27 L9.5 21 L14 31 L18.5 29 L14 19.5 L23 19.5 Z"
            fill="#111"
            stroke="#fff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </>
  );
};

// A small floating label pinned next to a box (page space), e.g. "relevance score". On the phone page it is placed
// below the box and kept inside the page width.
export const Callout: React.FC<{
  box: Box;
  at: number;
  to?: number;
  text: string;
  side?: "right" | "below";
}> = ({ box, at, to = 1e9, text, side = "right" }) => {
  const frame = useCurrentFrame();
  const { device, rects } = useScene();
  const phone = device === "phone";
  const p = usePop(at, 18) * interpolate(frame, [to, to + 8], [1, 0], clamp);
  const below = phone || side === "below";
  const left = below
    ? Math.min(box.x, rects.view.width - 230)
    : box.x + box.w + 16;
  const top = below ? box.y + box.h + (phone ? 8 : 12) : box.y + box.h / 2 - 20;
  return (
    <>
      <Sfx id="pop" at={at} />
      <div
        style={{
          position: "absolute",
          left,
          top,
          padding: phone ? "5px 11px" : "8px 16px",
          borderRadius: 999,
          whiteSpace: "nowrap",
          fontSize: phone ? 13 : 17,
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
