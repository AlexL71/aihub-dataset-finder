import React, { createContext, useContext } from "react";
import enRects from "../public/screens/en/rects.json";
import enPhoneRects from "../public/screens/en/phone/rects.json";
import koRects from "../public/screens/ko/rects.json";
import koPhoneRects from "../public/screens/ko/phone/rects.json";
import en from "./scripts/en.json";
import ko from "./scripts/ko.json";

export type Lang = "ko" | "en";
export type Script = typeof ko;
export type SceneDef = Script["scenes"][number] & { focus?: Record<string, number> };
export const SCRIPTS: Record<Lang, Script> = { ko, en: en as Script };

// Real app screens captured by scripts/capture.mjs, for two devices: element boxes in page pixels, relative to
// each screenshot's top-left corner. Desktop page is 1440 px wide, phone page 390 px (same keys in both files).
export type Box = { x: number; y: number; w: number; h: number };
export type Rects = typeof koRects;
export type Device = "desktop" | "phone";
export const RECTS: Record<Device, Record<Lang, Rects>> = {
  desktop: { ko: koRects, en: enRects as Rects },
  phone: { ko: koPhoneRects as Rects, en: enPhoneRects as Rects },
};

// Timing of one scene, measured from its narration (see Root.tsx calculateMetadata).
export type SceneTiming = {
  frames: number; // scene length
  voiceEnd: number; // frame where the narration ends
  cues: Record<string, number>; // cue name -> frame where the cue word is spoken
  lines: { text: string; from: number }[]; // subtitle lines and their start frames
};

type Ctx = { lang: Lang; device: Device; ui: Script["ui"]; rects: Rects; scene: SceneDef; timing: SceneTiming };
const SceneCtx = createContext<Ctx | null>(null);

export const SceneProvider: React.FC<Ctx & { children: React.ReactNode }> = ({ children, ...value }) => (
  <SceneCtx.Provider value={value}>{children}</SceneCtx.Provider>
);

export const useScene = () => {
  const ctx = useContext(SceneCtx);
  if (!ctx) throw new Error("useScene outside SceneProvider");
  return ctx;
};

// Frame of a cue word in the current scene. Missing cues fall back to `fallback` so a script typo
// does not break the render (scripts/audio.mjs already reports missing cues).
export const useCue = () => {
  const { timing } = useScene();
  return (name: string, fallback = 0) => timing.cues[name] ?? fallback;
};

// Union of boxes (skips missing ones).
export const unionBox = (...boxes: (Box | null | undefined)[]): Box => {
  const bs = boxes.filter(Boolean) as Box[];
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
};
