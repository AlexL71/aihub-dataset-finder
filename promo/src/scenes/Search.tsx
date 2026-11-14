import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useCue, useScene } from "../context";
import { Backdrop, clamp, SceneTitle, Sfx, usePop, usePortrait, Wordmark } from "../parts";
import { Browser, Cursor, shotOn, WHOLE } from "../screen";
import { C } from "../theme";

// The real home page flies in; the camera moves to the search box and the student's interest is typed letter by
// letter while the narrator says it (the search itself is started in the next scene, after picking the major).
export const Search: React.FC<{ headline: string }> = ({ headline }) => {
  const frame = useCurrentFrame();
  const cue = useCue();
  const { ui, rects } = useScene();
  const portrait = usePortrait();
  const { input, button } = rects.home;
  const focusAt = cue("focus", 90);
  const typeAt = cue("type", focusAt + 40);
  const typeEnd = Math.max(cue("typeEnd", typeAt + 40), typeAt + 12) + 8;

  const area = { x: input.x, y: input.y, w: button.x + button.w - input.x, h: input.h };
  const logo = usePop(4, 20);
  const logoOut = interpolate(frame, [focusAt - 8, focusAt + 2], [1, 0], clamp);
  const typed = Math.floor(interpolate(frame, [typeAt, typeEnd], [0, ui.query.length], clamp));
  const focused = frame >= focusAt + 6;
  const caret = Math.floor(frame / 9) % 2 === 0;

  return (
    <>
      <Backdrop />
      <div style={{ position: "absolute", top: portrait ? 280 : 40, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: logo * logoOut, transform: `scale(${0.9 + 0.1 * logo})` }}>
        <Wordmark size={portrait ? 72 : 64} />
      </div>
      <SceneTitle text={headline} at={focusAt} />

      <Browser screens={[{ src: "home", from: 0 }]} shots={[WHOLE(0), shotOn(focusAt, area, 1.75)]} enterAt={2}>
        {focused ? (
          <div
            style={{
              position: "absolute",
              left: input.x + 2,
              top: input.y + 2,
              width: input.w - 2,
              height: input.h - 4,
              display: "flex",
              alignItems: "center",
              paddingLeft: 22,
              background: "#fff",
              borderRadius: "28px 0 0 28px",
              fontSize: 17,
              fontWeight: 500,
              color: "#222",
            }}
          >
            {ui.query.slice(0, typed)}
            <span style={{ width: 2, height: 22, marginLeft: 1, background: C.blue, opacity: caret ? 1 : 0 }} />
          </div>
        ) : null}
        <div
          style={{
            position: "absolute",
            left: button.x,
            top: button.y,
            width: button.w,
            height: button.h,
            borderRadius: "0 28px 28px 0",
            boxShadow: focused ? "0 0 0 3px rgba(55,138,255,0.25)" : "none",
          }}
        />
        <Cursor
          path={[
            { at: focusAt - 6, x: 1000, y: 470 },
            { at: focusAt + 14, x: input.x + 160, y: input.y + 34 },
          ]}
          clicks={[focusAt + 16]}
        />
      </Browser>

      <Sfx id="pop" at={4} />
      {[...ui.query].map((ch, k) =>
        ch === " " ? null : <Sfx key={k} id="key" at={typeAt + ((typeEnd - typeAt) * (k + 1)) / ui.query.length} />,
      )}
    </>
  );
};
