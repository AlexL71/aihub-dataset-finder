import React from "react";
import { unionBox, useCue, useScene } from "../context";
import { Backdrop, SceneTitle } from "../parts";
import { Browser, Callout, Cursor, Reveal, Shot, shotOn, Spotlight } from "../screen";

// Compare: the cursor adds the top three datasets to the compare list (each button turns into "담김" the moment it
// is clicked, taken from the real "results-added" screen) while the narrator says "compare list"; on "up to three"
// the real compare page opens with the three side by side, and the camera moves across them.
export const Compare: React.FC<{ headline: string }> = ({ headline }) => {
  const cue = useCue();
  const { rects, ui, device } = useScene();
  const phone = device === "phone";
  const addAt = cue("add", 20);
  const pageAt = Math.max(cue("page", addAt + 50), addAt + 40);
  const sideAt = Math.max(cue("side", pageAt + 20), pageAt + 14);
  const cards = rects.cards.slice(0, 3);
  // Click times: one button after another, finishing before the compare page opens.
  const gap = Math.max(8, Math.min(16, Math.floor((pageAt - addAt - 16) / 3)));
  const clicks = cards.map((_, i) => addAt + 6 + i * gap);
  const btns = cards.map((c) => c.cmp!);
  const { cols, head } = rects.compare;

  // Desktop: the three buttons are in one row, one camera shot. Phone: one column, the camera follows each button.
  // Phone: this Browser also holds the wider compare page, so the results shots are centred on the results page
  // width (otherwise the camera centres on the wider page and cuts the results text at the left).
  const onResults = (s: Shot): Shot => ({ ...s, cx: rects.view.width / 2 });
  const resultShots: Shot[] = phone
    ? btns.map((b, i) => onResults(shotOn(clicks[i] - 12, unionBox(cards[i].titleBox, b), 1.2)))
    : [shotOn(addAt - 6, unionBox(...btns), 1.2)];
  const first: Shot = phone ? onResults(shotOn(0, unionBox(cards[0].titleBox, btns[0]), 1.2)) : shotOn(0, unionBox(...btns), 1);
  const compareShots: Shot[] = phone
    ? [shotOn(pageAt, cols[0], 1.4), shotOn(sideAt, cols[1], 1.4), shotOn(sideAt + 24, cols[2], 1.4)]
    : [shotOn(pageAt, head, 1.15)];

  return (
    <>
      <Backdrop />
      <SceneTitle text={headline} at={4} />
      <Browser
        screens={[{ src: "results", from: 0 }, { src: "compare", from: pageAt }]}
        shots={[first, ...resultShots, ...compareShots]}
      >
        {/* results page: each button changes as it is clicked (hidden once the compare page is shown) */}
        {btns.map((b, i) => (
          <Reveal key={i} src="results-added" box={b} at={clicks[i] + 2} until={pageAt + 10} />
        ))}
        <Cursor
          path={[
            { at: clicks[0] - 14, x: btns[0].x + btns[0].w + 60, y: btns[0].y + 70 },
            ...btns.map((b, i) => ({ at: clicks[i] - 2, x: b.x + b.w / 2, y: b.y + b.h / 2 + 3 })),
          ]}
          clicks={clicks}
          hideAfter={pageAt - 4}
        />
        {/* compare page: the three columns together */}
        <Spotlight box={phone ? cols[0] : head} from={pageAt + 12} to={phone ? sideAt - 2 : undefined} pad={6} radius={14} />
        {phone ? cols.slice(1).map((c, i) => <Spotlight key={i} box={c} from={sideAt + i * 24 + 6} to={i === 0 ? sideAt + 22 : undefined} pad={6} radius={14} sound={false} />) : null}
        <Callout box={phone ? cols[0] : head} at={pageAt + 18} to={phone ? sideAt - 4 : undefined} text={ui.compareNote} side="below" />
      </Browser>
    </>
  );
};
