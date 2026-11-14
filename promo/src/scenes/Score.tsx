import React from "react";
import { useCue, useScene } from "../context";
import { Backdrop, SceneTitle } from "../parts";
import { Browser, Callout, shotOn, Spotlight, WHOLE } from "../screen";

// The relevance score, without the formula: zoom into the real score on the first card,
// then pull back to the top row (closest matches first).
// TOP_H: height of a card's top part (title, score, tags, summary and the "why" lines) in page pixels.
const TOP_H = 450;
export const Score: React.FC<{ headline: string }> = ({ headline }) => {
  const cue = useCue();
  const { rects, ui } = useScene();
  const zoomAt = cue("zoom", 40);
  const firstAt = Math.max(cue("first", zoomAt + 60), zoomAt + 30);
  const first = rects.cards[0];
  const row = { x: rects.cards[0].card.x, y: rects.cards[0].card.y, w: rects.cards[2].card.x + rects.cards[2].card.w - rects.cards[0].card.x, h: TOP_H };

  return (
    <>
      <Backdrop />
      <SceneTitle text={headline} at={4} />
      <Browser screens={[{ src: "results", from: 0, h: rects.view.resultsHeight }]} pageH={rects.view.resultsHeight} shots={[WHOLE(0), shotOn(zoomAt, first.meter, 2.4), shotOn(firstAt, row, 1.25)]}>
        <Spotlight box={first.meter} from={zoomAt + 6} to={firstAt - 2} pad={8} radius={12} />
        <Callout box={first.meter} at={zoomAt + 14} to={firstAt - 4} text={`${ui.scoreNote} · ${first.score}`} side="below" />
        <Spotlight box={{ ...first.card, h: TOP_H }} from={firstAt + 8} />
      </Browser>
    </>
  );
};
