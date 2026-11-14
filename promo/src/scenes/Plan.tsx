import React from "react";
import { useCue, useScene } from "../context";
import { Backdrop, SceneTitle, Sfx } from "../parts";
import { Browser, Cursor, shotOn, Spotlight } from "../screen";

// The cursor clicks the real "plan a project with AI" button; the real plan window opens and
// AI buttons light up together when "the latest AI models" are mentioned.
export const Plan: React.FC<{ headline: string }> = ({ headline }) => {
  const cue = useCue();
  const { rects } = useScene();
  const btn = rects.results.plan1!;
  const clickAt = cue("click", 60);
  const openAt = clickAt + 6;
  const modelsAt = Math.max(cue("models", openAt + 20), openAt + 10);

  return (
    <>
      <Backdrop />
      <SceneTitle text={headline} at={4} />
      <Browser
        screens={[{ src: "results", from: 0, h: rects.view.resultsHeight }, { src: "plan", from: openAt }]}
        pageH={rects.view.resultsHeight}
        shots={[shotOn(0, rects.cards[0].card, 1.35), shotOn(openAt, rects.plan.panel, 1.5)]}
      >
        <Spotlight box={btn} from={clickAt - 14} to={openAt - 2} pad={6} radius={24} />
        <Cursor
          path={[
            { at: clickAt - 26, x: btn.x + 300, y: btn.y + 150 },
            { at: clickAt - 2, x: btn.x + btn.w / 2, y: btn.y + btn.h / 2 + 4 },
          ]}
          clicks={[clickAt]}
          hideAfter={openAt + 4}
        />
        <Spotlight box={rects.plan.sites} from={modelsAt} pad={10} radius={22} />
      </Browser>

      <Sfx id="notify" at={openAt + 2} />
    </>
  );
};
