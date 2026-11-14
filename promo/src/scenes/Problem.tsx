import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { useCue, useScene } from "../context";
import { Backdrop, clamp, KineticText, Sfx, Ticks, useEase, usePortrait } from "../parts";
import { C, EASE } from "../theme";
import titles from "../titles.json";

// Opening: rows of real AI Hub dataset titles drift past in the dark, the student's question appears,
// and a big counter runs to 867 while the narrator says it.
const Row: React.FC<{ items: string[]; y: number; speed: number; dir: 1 | -1 }> = ({ items, y, speed, dir }) => {
  const frame = useCurrentFrame();
  const shift = (frame * speed * dir) % 1400;
  return (
    <div style={{ position: "absolute", top: y, left: dir > 0 ? -1400 + shift : shift, display: "flex", gap: 18, whiteSpace: "nowrap" }}>
      {[...items, ...items].map((t, i) => (
        <span key={i} style={{ padding: "12px 22px", borderRadius: 999, fontSize: 24, fontWeight: 600, color: "rgba(226,232,255,0.75)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
          {t}
        </span>
      ))}
    </div>
  );
};

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCue();
  const { lang, ui } = useScene();
  const list = titles[lang];
  const count = cue("count", 150);
  const countEnd = Math.max(cue("countEnd", count + 30), count + 14);
  const rows = useEase(0, 30);
  const n = Math.round(interpolate(frame, [count, countEnd], [0, 867], { ...clamp, easing: EASE }));
  const numIn = useEase(count - 8, count + 10);
  const askOut = interpolate(frame, [count - 10, count + 4], [1, 0.35], clamp);
  const portrait = usePortrait();
  const nRows = portrait ? 13 : 6;

  return (
    <AbsoluteFill>
      <Backdrop dark />
      <AbsoluteFill
        style={{
          opacity: rows * 0.9,
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)",
          maskImage: "linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)",
          filter: `blur(${interpolate(frame, [count - 6, count + 10], [0, 3], clamp)}px)`,
        }}
      >
        {Array.from({ length: nRows }, (_, r) => (
          <Row key={r} items={list.slice((r * 7) % list.length).concat(list.slice(0, (r * 7) % list.length)).slice(0, 10)} y={(portrait ? 90 : 110) + r * 140} speed={1.1 + (r % 3) * 0.35} dir={r % 2 ? 1 : -1} />
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(6,10,24,0.92) 0%, rgba(6,10,24,0.55) 45%, transparent 75%)" }} />

      <div style={{ position: "absolute", top: portrait ? 560 : 250, left: portrait ? 60 : 0, right: portrait ? 60 : 0, opacity: askOut }}>
        <KineticText text={ui.problemAsk} at={8} size={portrait ? 80 : 84} color="#fff" />
      </div>
      <div style={{ position: "absolute", top: portrait ? 800 : 400, left: 0, right: 0, textAlign: "center", opacity: numIn, transform: `translateY(${(1 - numIn) * 40}px) scale(${0.92 + 0.08 * numIn})` }}>
        <div style={{ fontSize: 250, fontWeight: 900, letterSpacing: -10, lineHeight: 1, backgroundImage: `linear-gradient(100deg, #9cc7ff, ${C.violet})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          {n}
        </div>
        <div style={{ marginTop: 14, fontSize: 40, fontWeight: 600, color: "rgba(226,232,255,0.85)" }}>{ui.counterLabel}</div>
      </div>

      <Sfx id="pop" at={count - 6} />
      <Ticks from={count} to={countEnd} />
      <Sfx id="land" at={countEnd} />
    </AbsoluteFill>
  );
};
