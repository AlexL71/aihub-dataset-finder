import React from "react";
import { unionBox, useCue, useScene } from "../context";
import { Backdrop, SceneTitle } from "../parts";
import { Browser, Callout, shotOn, Spotlight, WHOLE } from "../screen";

// The relevance score and the reasons, without any formula: zoom to the real score on the first card ("relevance
// score"), then to its "why" lines ("reasons"), then show the card's top part as a whole ("at a glance").
export const Score: React.FC<{ headline: string }> = ({ headline }) => {
  const cue = useCue();
  const { rects, ui } = useScene();
  const first = rects.cards[0];
  const zoomAt = cue("zoom", 30);
  const reasonsAt = Math.max(cue("reasons", zoomAt + 40), zoomAt + 24);
  const glanceAt = Math.max(cue("first", reasonsAt + 40), reasonsAt + 24);
  const why = first.why ?? first.meter;
  const top = unionBox(first.titleBox, first.meter, why); // title, score and reasons together

  return (
    <>
      <Backdrop />
      <SceneTitle text={headline} at={4} />
      <Browser
        screens={[{ src: "results", from: 0 }]}
        shots={[WHOLE(0), shotOn(zoomAt, first.meter, 2.4), shotOn(reasonsAt, why, 1.9), shotOn(glanceAt, top, 1.5)]}
      >
        <Spotlight box={first.meter} from={zoomAt + 6} to={reasonsAt - 2} pad={8} radius={12} />
        <Callout box={first.meter} at={zoomAt + 14} to={reasonsAt - 4} text={`${ui.scoreNote} · ${first.score}`} side="below" />
        <Spotlight box={why} from={reasonsAt + 6} to={glanceAt - 2} pad={8} radius={12} />
        <Callout box={why} at={reasonsAt + 14} to={glanceAt - 4} text={ui.reasonNote} side="below" />
        <Spotlight box={top} from={glanceAt + 6} pad={14} />
      </Browser>
    </>
  );
};
