import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { Lang, RECTS, SceneDef, SceneProvider, SceneTiming, SCRIPTS } from "./context";
import { Subtitle } from "./parts";
import { Outro } from "./scenes/Outro";
import { Compare } from "./scenes/Compare";
import { Open } from "./scenes/Open";
import { Plan } from "./scenes/Plan";
import { Problem } from "./scenes/Problem";
import { Results } from "./scenes/Results";
import { Score } from "./scenes/Score";
import { Major } from "./scenes/Major";
import { Search } from "./scenes/Search";
import { C, FONT, LEAK_BEFORE, TRANSITION, VOICE_DELAY, VOICE_VOLUME } from "./theme";

export type PromoProps = { lang: Lang; timing: SceneTiming[] };

const SCENES: Record<string, React.FC<{ headline: string }>> = {
  "s1-problem": Problem,
  "s2-search": Search,
  "s2b-major": Major,
  "s3-results": Results,
  "s4-score": Score,
  "s4b-compare": Compare,
  "s5-plan": Plan,
  "s5b-open": Open,
  "s6-outro": Outro,
};
const DARK = new Set(["s1-problem", "s6-outro"]);

export const Promo: React.FC<PromoProps> = ({ lang, timing }) => {
  const script = SCRIPTS[lang];
  const { width, height } = useVideoConfig();
  const device = height > width ? "phone" : "desktop"; // vertical video = phone screenshots and layout
  if (timing.length !== script.scenes.length) return null; // metadata not ready yet

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: FONT, color: C.ink, wordBreak: "keep-all" }}>
      <TransitionSeries>
        {script.scenes.map((scene, i) => {
          const Scene = SCENES[scene.id];
          return (
            <React.Fragment key={scene.id}>
              {i > 0 && !LEAK_BEFORE.has(i) ? (
                <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />
              ) : null}
              <TransitionSeries.Sequence name={scene.id} durationInFrames={timing[i].frames}>
                <SceneProvider lang={lang} device={device} ui={script.ui} rects={RECTS[device][lang]} scene={scene as SceneDef} timing={timing[i]}>
                  <Scene headline={scene.headline} />
                  <Subtitle dark={DARK.has(scene.id)} />
                </SceneProvider>
                <Sequence from={VOICE_DELAY} layout="none" name="voice">
                  <Audio src={staticFile(`voiceover/${lang}/${scene.id}.mp3`)} volume={VOICE_VOLUME} />
                </Sequence>
              </TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>

    </AbsoluteFill>
  );
};

