import React, { createContext, useContext } from "react";
import enRects from "../public/screens/en/rects.json";
import koRects from "../public/screens/ko/rects.json";
import en from "./scripts/en.json";
import ko from "./scripts/ko.json";

export type Lang = "ko" | "en";
export type Script = typeof ko;
export type SceneDef = Script["scenes"][number] & { focus?: Record<string, number> };
export const SCRIPTS: Record<Lang, Script> = { ko, en: en as Script };

// Real app screens captured by scripts/capture.mjs: element boxes in page pixels (page is 1440 x 900).
export type Box = { x: number; y: number; w: number; h: number };
export type Rects = typeof koRects;
export const RECTS: Record<Lang, Rects> = { ko: koRects, en: enRects as Rects };

// Timing of one scene, measured from its narration (see Root.tsx calculateMetadata).
export type SceneTiming = {
  frames: number; // scene length
  voiceEnd: number; // frame where the narration ends
  cues: Record<string, number>; // cue name -> frame where the cue word is spoken
  lines: { text: string; from: number }[]; // subtitle lines and their start frames
};

type Ctx = { lang: Lang; ui: Script["ui"]; rects: Rects; scene: SceneDef; timing: SceneTiming };
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
