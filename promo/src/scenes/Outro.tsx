import React from "react";
import { AbsoluteFill } from "remotion";
import { useCue, useScene } from "../context";
import { Backdrop, KineticText, Sfx, Wordmark, usePop, usePortrait } from "../parts";
import { C } from "../theme";

// Ending: logo with a soft glow, the one-line promise word by word, and a call-to-action pill.
export const Outro: React.FC = () => {
  const cue = useCue();
  const { ui } = useScene();
  const logoAt = cue("logo", 4);
  const lineAt = cue("line", 30);
  const pillAt = cue("pill", 70);
  const logo = usePop(logoAt, 18);
  const pill = usePop(pillAt, 16);
  const portrait = usePortrait();
  const y = portrait ? 420 : 0; // phone: everything moves down to the middle of the tall screen

  return (
    <AbsoluteFill>
      <Backdrop dark />
      <div style={{ position: "absolute", left: "50%", top: 330 + y, width: 700, height: 300, transform: "translate(-50%, -50%)", borderRadius: "50%", background: `radial-gradient(closest-side, rgba(55,138,255,0.35), transparent)`, opacity: logo }} />
      <div style={{ position: "absolute", top: 280 + y, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: logo, transform: `translateY(${(1 - logo) * 30}px) scale(${0.9 + 0.1 * logo})` }}>
        <Wordmark size={portrait ? 84 : 110} dark />
      </div>
      <div style={{ position: "absolute", top: 470 + y, left: portrait ? 60 : 0, right: portrait ? 60 : 0 }}>
        <KineticText text={ui.outroLine} at={lineAt} size={portrait ? 62 : 64} color="#fff" />
      </div>
      <div style={{ position: "absolute", top: (portrait ? 700 : 630) + y, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ padding: "20px 46px", borderRadius: 999, fontSize: 38, fontWeight: 700, color: "#fff", background: `linear-gradient(100deg, ${C.blue}, ${C.violet})`, boxShadow: "0 16px 40px rgba(55,138,255,0.35)", opacity: pill, transform: `translateY(${(1 - pill) * 20}px)` }}>
          {ui.outroPill}
        </div>
      </div>
      <Sfx id="whoosh" at={logoAt} />
      <Sfx id="pop" at={logoAt + 4} />
      <Sfx id="finish" at={pillAt} />
    </AbsoluteFill>
  );
};
