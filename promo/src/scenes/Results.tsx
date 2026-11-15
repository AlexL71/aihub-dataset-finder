import React from "react";
import { unionBox, useCue, useScene } from "../context";
import { Backdrop, SceneTitle, Sfx } from "../parts";
import { Browser, Shot, shotOn, Spotlight, WHOLE } from "../screen";

// The real results for the search. The camera glides (and scrolls down when needed) to each dataset the narrator
// names, so every named card is fully in view (which card goes with which cue: scene.focus).
export const Results: React.FC<{ headline: string }> = ({ headline }) => {
  const cue = useCue();
  const { rects, scene, device } = useScene();
  const focus: Record<string, number> = scene.focus ?? {};
  const names = ["f1", "f2", "f3"].filter((n) => focus[n] !== undefined && rects.cards[focus[n]]);
  // Phone cards are taller than the screen: aim at the top part (title, score, reasons) so the title is never cut.
  const target = (i: number) => {
    const c = rects.cards[i];
    return device === "phone" ? unionBox(c.titleBox, c.meter, c.why) : c.card;
  };
  const shots: Shot[] = [WHOLE(0), ...names.map((n) => shotOn(cue(n), target(focus[n]), 1.42))];

  return (
    <>
      <Backdrop />
      <SceneTitle text={headline} at={4} />
      <Browser screens={[{ src: "results", from: 0 }]} shots={shots}>
        {names.map((n, i) => (
          <Spotlight key={n} box={rects.cards[focus[n]].card} from={cue(n)} to={i < names.length - 1 ? cue(names[i + 1]) - 4 : undefined} />
        ))}
      </Browser>
      <Sfx id="pop" at={2} />
    </>
  );
};
