import React from "react";
import { useCue, useScene } from "../context";
import { Backdrop, KineticText } from "../parts";
import { Browser, Callout, Cursor, shotOn, Spotlight, WHOLE } from "../screen";

// The real "tell us a little more" panel: the cursor opens the major box and the real screen changes from
// empty to the chosen major; a label says the department's curriculum is used, and the results follow in the
// next scene. Screens: major-empty.png -> major.png (captured by scripts/capture.mjs).
export const Major: React.FC<{ headline: string }> = ({ headline }) => {
  const cue = useCue();
  const { rects, ui } = useScene();
  const before = rects.majorEmpty;
  const after = rects.major;
  const pickAt = cue("pick", 20);
  const clickMajor = pickAt + 14;
  const curriculumAt = Math.max(cue("curriculum", clickMajor + 20), clickMajor + 10);
  // University and major boxes side by side, with their labels and the hint line under them.
  const row = { x: before.univ.x - 10, y: before.univ.y - 40, w: before.major.x + before.major.w - before.univ.x + 20, h: before.major.h + 110 };

  return (
    <>
      <Backdrop />
      <div style={{ position: "absolute", top: 34, left: 0, right: 0 }}>
        <KineticText text={headline} at={4} size={60} />
      </div>
      <Browser
        screens={[{ src: "major-empty", from: 0 }, { src: "major", from: clickMajor + 2 }]}
        shots={[WHOLE(0), shotOn(pickAt, row, 1.3), shotOn(curriculumAt, after.major, 1.6)]}
      >
        <Spotlight box={after.major} from={clickMajor + 4} pad={8} radius={14} />
        <Callout box={after.major} at={curriculumAt + 6} text={ui.curriculumNote} side="below" />
        <Cursor
          path={[
            { at: pickAt - 4, x: before.major.x + before.major.w - 60, y: before.major.y + 170 },
            { at: clickMajor - 2, x: before.major.x + before.major.w * 0.45, y: before.major.y + before.major.h / 2 + 4 },
          ]}
          clicks={[clickMajor]}
          hideAfter={curriculumAt}
        />
      </Browser>
    </>
  );
};
