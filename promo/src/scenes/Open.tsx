import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useCue, useScene } from "../context";
import { Backdrop, clamp, SceneTitle, Sfx, usePop, usePortrait } from "../parts";
import { Browser, Cursor, shotOn, Spotlight } from "../screen";
import { C, EASE } from "../theme";

// Plan, part 2: one click on the AI buttons of the real plan window (which copies the prompt; the screen is the real
// "copied" state, whose message names no AI), then a generic AI chat window (no brand, marked as an example) slides in:
// the real prompt is pasted on "paste" and an example plan answer appears on "plan".
export const Open: React.FC<{ headline: string }> = ({ headline }) => {
  const frame = useCurrentFrame();
  const cue = useCue();
  const { rects, ui } = useScene();
  const portrait = usePortrait();
  const openAt = cue("open", 10);
  const chatAt = openAt + 22;
  const pasteAt = Math.max(cue("paste", chatAt + 14), chatAt + 10);
  const planAt = Math.max(cue("plan", pasteAt + 20), pasteAt + 14);
  const sites = rects.copied.sites;
  // First AI button on the copied screen: its box on the plan screen, moved with the button group.
  const site1 = { ...rects.plan.site1, x: rects.plan.site1.x + (sites.x - rects.plan.sites.x), y: rects.plan.site1.y + (sites.y - rects.plan.sites.y) };

  // The first lines of the real prompt the app made (dataset, the student's major and interests are in it).
  const promptLines = (rects.prompt as string).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4)
    .map((l) => (l.length > (portrait ? 26 : 46) ? `${l.slice(0, portrait ? 25 : 45)}…` : l));
  const chatIn = usePop(chatAt, 20);
  const pasted = interpolate(frame, [pasteAt, pasteAt + 10], [0, 1], { ...clamp, easing: EASE });
  const reply = ui.chatReply as string[];
  const font = portrait ? 38 : 30;
  const chat = portrait ? { left: 70, top: 470, w: 940, h: 980 } : { left: 410, top: 190, w: 1100, h: 700 };

  return (
    <>
      <Backdrop />
      <SceneTitle text={headline} at={4} />
      <Browser screens={[{ src: "plan-copied", from: 0 }]} shots={[shotOn(0, sites, 1.3)]}>
        <Spotlight box={sites} from={openAt - 10} to={chatAt} pad={8} radius={20} />
        <Cursor
          path={[
            { at: openAt - 22, x: site1.x + site1.w * 0.5 + 120, y: site1.y + site1.h + 80 },
            { at: openAt - 2, x: site1.x + site1.w * 0.5, y: site1.y + site1.h * 0.55 },
          ]}
          clicks={[openAt]}
          hideAfter={chatAt}
        />
      </Browser>

      {/* generic AI chat (example) */}
      <div
        style={{
          position: "absolute", left: chat.left, top: chat.top, width: chat.w, height: chat.h, borderRadius: 28, overflow: "hidden",
          background: "#fff", border: "1px solid rgba(15,23,42,0.08)", boxShadow: "0 40px 100px rgba(30,41,79,0.30)",
          opacity: chatIn, transform: `translateY(${(1 - chatIn) * 80}px) scale(${0.96 + 0.04 * chatIn})`, display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: portrait ? "26px 32px" : "18px 26px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ width: font * 1.5, height: font * 1.5, borderRadius: "50%", background: `linear-gradient(135deg, ${C.blue}, ${C.violet})` }} />
          <div style={{ fontSize: font * 1.05, fontWeight: 800, color: C.ink }}>{ui.chatTitle}</div>
          <div style={{ marginLeft: "auto", fontSize: font * 0.75, fontWeight: 600, color: C.sub, padding: "4px 12px", borderRadius: 999, background: "#f1f5f9" }}>{ui.chatExample}</div>
        </div>
        <div style={{ flex: 1, padding: portrait ? "30px 32px" : "22px 28px", display: "flex", flexDirection: "column", gap: portrait ? 26 : 18, background: "#f8fafc" }}>
          {/* the pasted prompt (user) */}
          <div style={{ alignSelf: "flex-end", maxWidth: "86%", padding: portrait ? "20px 24px" : "14px 18px", borderRadius: 20, background: C.blue, color: "#fff",
            fontSize: font * 0.82, lineHeight: 1.45, opacity: pasted, transform: `translateY(${(1 - pasted) * 20}px)` }}>
            <div style={{ fontSize: font * 0.7, fontWeight: 700, opacity: 0.85, marginBottom: 6 }}>📋 {ui.chatPaste}</div>
            {promptLines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          {/* the answer (example), one line after another */}
          <div style={{ alignSelf: "flex-start", maxWidth: "86%", padding: portrait ? "20px 24px" : "14px 18px", borderRadius: 20, background: "#fff",
            border: `1px solid ${C.line}`, color: C.ink, fontSize: font * 0.9, lineHeight: 1.5, opacity: interpolate(frame, [planAt, planAt + 6], [0, 1], clamp) }}>
            {reply.map((l, i) => {
              const p = interpolate(frame, [planAt + i * 7, planAt + i * 7 + 8], [0, 1], { ...clamp, easing: EASE });
              return <div key={i} style={{ fontWeight: i === 0 ? 700 : 500, opacity: p, transform: `translateX(${(1 - p) * 14}px)` }}>{l}</div>;
            })}
          </div>
        </div>
      </div>

      <Sfx id="whoosh" at={chatAt} />
      <Sfx id="pop" at={pasteAt} />
      {reply.map((_, i) => <Sfx key={i} id="key" at={planAt + i * 7} gain={0.7} />)}
      <Sfx id="finish" at={planAt + reply.length * 7} />
    </>
  );
};
