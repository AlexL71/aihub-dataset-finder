import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useScene } from "./context";
import { C, EASE } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Phone (vertical, 1080 x 1920) or landscape (1920 x 1080) video: decided by the canvas shape.
export const usePortrait = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

// 0 -> 1 spring that starts at frame `at` (soft, no bounce by default).
export const usePop = (at = 0, damping = 22, mass = 0.9) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, mass, stiffness: 140 } });
};

// Eased 0 -> 1 between two frames.
export const useEase = (from: number, to: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, Math.max(to, from + 1)], [0, 1], { ...clamp, easing: EASE });
};

// ---------- sound ----------

// Animation sounds: Kenney "Interface Sounds" (CC0, kenney.nl, via soundcn) and Remotion's whoosh / mouse-click
// (remotion.media), stored in public/sfx/ui. Every movement has a sound: the camera, cursor, spotlight, headline
// and counter components play theirs automatically. Volumes keep each sound clearly under the voice: measured
// in the mix, the loudest sounds sit about 8-10 dB below the voice and most 15+ dB below. Tune the whole mix here.
const SOUNDS = {
  whoosh: { file: "whoosh", volume: 0.15 }, // browser flies in, logo arrives
  swish: { file: "whoosh", volume: 0.1 }, // camera glides sideways, mouse travels
  zoomIn: { file: "maximize_006", volume: 0.12 }, // camera zooms in
  zoomOut: { file: "minimize_003", volume: 0.22 }, // camera pulls back
  key: { file: "tick_001", volume: 0.32 }, // one keystroke while typing
  click: { file: "mouse-click", volume: 0.45 }, // every mouse click
  tick: { file: "tick_004", volume: 0.2 }, // counter running
  word: { file: "select_001", volume: 0.12 }, // a headline word appears
  pop: { file: "drop_002", volume: 0.2 }, // a label, logo or new page appears
  pluck: { file: "pluck_001", volume: 0.25 }, // spotlight lands on something
  land: { file: "confirmation_001", volume: 0.12 }, // counter reaches its number
  notify: { file: "glass_001", volume: 0.2 }, // the plan window opens
  finish: { file: "confirmation_002", volume: 0.15 }, // final call-to-action
} as const;
export type SoundId = keyof typeof SOUNDS;

export const Sfx: React.FC<{ id: SoundId; at: number; gain?: number }> = ({ id, at, gain = 1 }) => (
  <Sequence from={Math.max(0, Math.round(at))} name={`sfx ${id}`} layout="none">
    <Audio src={staticFile(`sfx/ui/${SOUNDS[id].file}.wav`)} volume={SOUNDS[id].volume * gain} />
  </Sequence>
);

// Ticks while a number counts from `from` to `to` (frames): fast at first, slowing like the eased number.
export const Ticks: React.FC<{ from: number; to: number; every?: number }> = ({ from, to, every = 2 }) => {
  const frames: number[] = [];
  for (let f = from, gap = every; f < to; f += gap) {
    frames.push(f);
    if (f > from + (to - from) * 0.6) gap = every + 2;
  }
  return (
    <>
      {frames.map((at) => (
        <Sfx key={at} id="tick" at={at} />
      ))}
    </>
  );
};

// ---------- backgrounds ----------

// Slowly drifting soft color glows: light for product scenes, dark for the opening and the ending.
export const Backdrop: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  const blobs = [
    { c: C.blue, x: 18, y: 22, r: 46, s: 0.011 },
    { c: C.violet, x: 82, y: 30, r: 40, s: 0.008 },
    { c: C.sky, x: 60, y: 92, r: 44, s: 0.009 },
  ];
  return (
    <AbsoluteFill style={{ background: dark ? C.night : C.bg, overflow: "hidden" }}>
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${b.x + Math.sin(frame * b.s + i * 2) * 6}%`,
            top: `${b.y + Math.cos(frame * b.s + i) * 6}%`,
            width: `${b.r}vw`,
            height: `${b.r}vw`,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${b.c} 0%, transparent 65%)`,
            opacity: dark ? 0.45 : 0.22,
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.06)"} 1.2px, transparent 1.2px)`,
          backgroundSize: "28px 28px",
        }}
      />
    </AbsoluteFill>
  );
};

// ---------- text ----------

// Headline that appears word by word: each word slides up out of a mask and un-blurs.
export const KineticText: React.FC<{
  text: string;
  at: number;
  size: number;
  color?: string;
  weight?: number;
  gradient?: boolean;
  style?: React.CSSProperties;
  sound?: boolean; // a light tick per word (default on)
}> = ({ text, at, size, color = C.ink, weight = 800, gradient, style, sound = true }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: size * 0.26, ...style }}>
      {sound ? words.map((_, i) => <Sfx key={`s${i}`} id="word" at={at + i * 3 + 2} />) : null}
      {words.map((w, i) => {
        const p = interpolate(frame, [at + i * 3, at + i * 3 + 16], [0, 1], { ...clamp, easing: EASE });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.12 }}>
            <span
              style={{
                display: "inline-block",
                fontSize: size,
                fontWeight: weight,
                letterSpacing: -size * 0.03,
                lineHeight: 1.15,
                color,
                transform: `translateY(${(1 - p) * 100}%)`,
                filter: `blur(${(1 - p) * 8}px)`,
                opacity: p,
                ...(gradient
                  ? { backgroundImage: `linear-gradient(100deg, ${C.blue}, ${C.violet})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }
                  : {}),
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

// Scene headline: across the top on landscape, in the upper third (wrapping) on the phone version.
export const SceneTitle: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const portrait = usePortrait();
  return (
    <div style={{ position: "absolute", top: portrait ? 250 : 34, left: portrait ? 60 : 0, right: portrait ? 60 : 0 }}>
      <KineticText text={text} at={at} size={portrait ? 68 : 60} />
    </div>
  );
};

// Narration subtitle at the bottom: each line appears when it is spoken (times from the speech).
export const Subtitle: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const portrait = usePortrait();
  const frame = useCurrentFrame();
  const { timing } = useScene();
  const idx = timing.lines.reduce((cur, l, i) => (frame >= l.from ? i : cur), -1);
  if (idx < 0) return null;
  const line = timing.lines[idx];
  const p = interpolate(frame, [line.from, line.from + 10], [0, 1], { ...clamp, easing: EASE });
  return (
    <div style={{ position: "absolute", bottom: portrait ? 190 : 38, left: portrait ? 50 : 0, right: portrait ? 50 : 0, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          maxWidth: 1560,
          padding: portrait ? "18px 30px" : "14px 30px",
          borderRadius: 16,
          fontSize: portrait ? 40 : 36,
          fontWeight: 600,
          lineHeight: 1.35,
          textAlign: "center",
          color: dark ? "#fff" : C.ink,
          background: dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.88)",
          border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.08)"}`,
          boxShadow: dark ? "none" : "0 10px 30px rgba(15,23,42,0.10)",
          opacity: p,
          transform: `translateY(${(1 - p) * 12}px)`,
        }}
      >
        {line.text}
      </div>
    </div>
  );
};

// ---------- logo ----------

export const LogoMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <defs>
      <linearGradient id="lm" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={C.blue} />
        <stop offset="1" stopColor={C.violet} />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="11" fill="url(#lm)" />
    <path d="M7.5 15.2 19 10l11.5 5.2L19 20.4z" fill="#fff" />
    <path d="M7.5 20.6 19 25.8l3-1.35" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.5 26 19 31.2l1.2-.55" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="28" cy="26.5" r="5.3" fill={C.blue} stroke="#dbeafe" strokeWidth="2.6" />
    <path d="m31.9 30.4 3.1 3.1" stroke="#dbeafe" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const Wordmark: React.FC<{ size: number; dark?: boolean }> = ({ size, dark }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.32 }}>
    <LogoMark size={size} />
    <div style={{ fontSize: size * 0.6, fontWeight: 800, letterSpacing: -1, color: dark ? "#fff" : C.ink, whiteSpace: "nowrap" }}>
      <span style={{ color: dark ? "#9cc7ff" : C.blue }}>AI Hub </span>DataFinder
    </div>
  </div>
);
