import { loadFont } from "@remotion/fonts";
import { Easing, staticFile } from "remotion";

// Same font as the web app (Pretendard). Loaded once from public/fonts.
export const FONT = "Pretendard";
loadFont({ family: FONT, url: staticFile("fonts/PretendardVariable.woff2"), weight: "100 900" });

// Brand colors from app/static (logo #378aff) plus a violet accent for gradients.
export const C = {
  blue: "#378aff",
  blueDark: "#1f5fd1",
  violet: "#7c5cff",
  sky: "#5cc8ff",
  ink: "#0f172a",
  sub: "#64748b",
  bg: "#f5f7fb",
  card: "#ffffff",
  line: "#e2e8f0",
  night: "#060a18",
  green: "#16c47f",
};

// One easing for every camera move and slide: fast start, soft landing (like most product videos).
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

// Timing shared by Root (duration) and Promo (layout).
export const FPS = 30;
export const SCENE_PAD = 12; // frames of quiet after each narration clip (must stay > TRANSITION)
export const TRANSITION = 12; // frames of cross-fade between scenes
export const END_HOLD = 24; // extra frames on the last scene
// Cuts covered by an overlay instead of a cross-fade (none in this version).
export const LEAK_BEFORE = new Set<number>();

// Mix: voice and a few soft animation sounds only (no background music). The voice peaks near 0 dBFS by itself;
// 0.85 leaves headroom so voice + sounds do not clip. Animation sound volumes are in parts.tsx (SOUNDS).
export const VOICE_VOLUME = 0.85;
