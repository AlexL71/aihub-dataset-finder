import React from "react";
import { useCue, useScene } from "../context";
import { Backdrop, SceneTitle, Sfx } from "../parts";
import { Browser, Callout, Cursor, shotOn, Spotlight } from "../screen";

// Plan, part 1: the cursor clicks the real "AI로 프로젝트 계획 세우기" button of the top result on "plan your project";
// the real plan window opens, and on "dataset details…" the prompt preview opens to show what is in the prompt
// (dataset facts with the AI Hub link, the student's major and interests). Screens: results-added -> plan -> plan-preview.
export const Plan: React.FC<{ headline: string }> = ({ headline }) => {
  const cue = useCue();
  const { rects, ui } = useScene();
  const btn = rects.cards[0].plan!;
  const clickAt = cue("click", 40);
  const openAt = clickAt + 6;
  const previewAt = Math.max(cue("preview", openAt + 40), openAt + 24);
  const { textarea } = rects.preview;

  return (
    <>
      <Backdrop />
      <SceneTitle text={headline} at={4} />
      <Browser
        screens={[{ src: "results-added", from: 0 }, { src: "plan", from: openAt }, { src: "plan-preview", from: previewAt }]}
        shots={[shotOn(0, rects.cards[0].card, 1.3), shotOn(clickAt - 20, btn, 1.6), shotOn(openAt, rects.plan.panel, 1.4), shotOn(previewAt + 4, textarea, 1.4)]}
      >
        <Spotlight box={btn} from={clickAt - 14} to={openAt - 2} pad={6} radius={24} />
        <Cursor
          path={[
            { at: clickAt - 26, x: btn.x + btn.w + 80, y: btn.y + 90 },
            { at: clickAt - 2, x: btn.x + btn.w / 2, y: btn.y + btn.h / 2 + 4 },
          ]}
          clicks={[clickAt]}
          hideAfter={openAt + 4}
        />
        <Spotlight box={textarea} from={previewAt + 10} pad={6} radius={12} />
        <Callout box={textarea} at={previewAt + 18} text={ui.promptNote} side="below" />
      </Browser>
      <Sfx id="notify" at={openAt + 2} />
    </>
  );
};
