import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import { CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { Lang, SceneTiming, SCRIPTS } from "./context";
import { Promo, PromoProps } from "./Promo";
import { END_HOLD, FPS, LEAK_BEFORE, SCENE_PAD, TRANSITION, VOICE_DELAY } from "./theme";

type VoiceMeta = { end: number; cues: Record<string, number>; lines: { text: string; start: number }[] };

const audioSeconds = async (file: string) => {
  const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(staticFile(file)) });
  const seconds = await input.computeDuration();
  input.dispose();
  return seconds;
};

// Scene length follows its narration; cue words and subtitle lines become frame numbers.
const calculateMetadata: CalculateMetadataFunction<PromoProps> = async ({ props }) => {
  const script = SCRIPTS[props.lang];
  const timing: SceneTiming[] = await Promise.all(
    script.scenes.map(async (scene, i): Promise<SceneTiming> => {
      const base = `voiceover/${props.lang}/${scene.id}`;
      const [meta, seconds] = await Promise.all([
        fetch(staticFile(`${base}.json`)).then((r) => r.json() as Promise<VoiceMeta>),
        audioSeconds(`${base}.mp3`),
      ]);
      const toFrame = (s: number) => Math.round(s * FPS) + VOICE_DELAY; // scene frame (the voice starts at VOICE_DELAY)
      const last = i === script.scenes.length - 1;
      return {
        frames: VOICE_DELAY + Math.ceil(Math.max(seconds, meta.end) * FPS) + SCENE_PAD + (last ? END_HOLD : 0),
        voiceEnd: toFrame(meta.end),
        cues: Object.fromEntries(Object.entries(meta.cues).map(([k, v]) => [k, toFrame(v)])),
        lines: meta.lines.map((l) => ({ text: l.text, from: toFrame(l.start) })),
      };
    }),
  );
  const fades = timing.length - 1 - [...LEAK_BEFORE].filter((i) => i < timing.length).length;
  const total = timing.reduce((a, t) => a + t.frames, 0) - TRANSITION * fades;
  return { durationInFrames: total, props: { ...props, timing } };
};

const LANGS: Lang[] = ["ko", "en"];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {LANGS.map((lang) => (
        <Composition
          key={lang}
          id={`Promo-${lang}`}
          component={Promo}
          durationInFrames={1200}
          fps={FPS}
          width={1920}
          height={1080}
          defaultProps={{ lang, timing: [] }}
          calculateMetadata={calculateMetadata}
        />
      ))}
      {/* Phone version: same scenes and narration, laid out for a vertical 1080 x 1920 screen. */}
      {LANGS.map((lang) => (
        <Composition
          key={`${lang}-v`}
          id={`Promo-${lang}-v`}
          component={Promo}
          durationInFrames={1200}
          fps={FPS}
          width={1080}
          height={1920}
          defaultProps={{ lang, timing: [] }}
          calculateMetadata={calculateMetadata}
        />
      ))}
    </>
  );
};
