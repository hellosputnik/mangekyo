import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { defaults, type Session } from "../engine/model";
import { ensureTouchChallenge } from "../exercises/touch-challenge";
import { createLocalization } from "../i18n/locale";
import { LocalizationContext } from "../i18n/react";
import { TouchChallenge, TouchChallengeNotice } from "./TouchChallenge";
function session(kind: "tap" | "follow" = "tap"): Session {
  const record: Session = {
    id: "goal",
    kind,
    eye: "Left",
    configuration: defaults,
    startedAt: "2026-10-26T12:00:00Z",
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
  ensureTouchChallenge(record);
  return record;
}
it("shows the required precision/pace, actual run progress, highest level, score, and explicit sound state", () => {
  const record = session();
  record.challenge!.streak = 3;
  const html = renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("en")}>
      <TouchChallenge
        session={record}
        bestLevel={4}
        points={13}
        sound={false}
        onSound={() => {}}
        onEasier={() => {}}
      />
    </LocalizationContext.Provider>,
  );
  expect(html).toContain("Level 1 / 30");
  expect(html).toContain("Best level 5");
  expect(html).toContain("5 centered hits in a row · within 2.5s each");
  expect(html).toContain('value="3"');
  expect(html).toContain('max="5"');
  expect(html).toContain('aria-pressed="false"');
  expect(html).toContain("Sound off");
  expect(html).toContain("Score");
  expect(html).toContain("13");
});
it("uses seconds for following goals and translates challenge controls into Vietnamese", () => {
  const record = session("follow");
  record.challenge!.progressMilliseconds = 3000;
  const html = renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("vi")}>
      <TouchChallenge
        session={record}
        bestLevel={2}
        points={3}
        sound
        onSound={() => {}}
        onEasier={() => {}}
      />
    </LocalizationContext.Provider>,
  );
  expect(html).toContain("Theo sát 6 giây để lên mức tiếp theo");
  expect(html).toContain('value="3000"');
  expect(html).toContain('max="6000"');
  expect(html).toContain("Âm bật");
  expect(html).toContain("Dễ hơn");
});
it("celebrates unlocking while making easier-level and precision cues explicit", () => {
  const record = session();
  const render = (kind: "level-up" | "level-down" | "closer") =>
    renderToStaticMarkup(
      <LocalizationContext.Provider value={createLocalization("en")}>
        <TouchChallengeNotice cue={{ kind, level: 1 }} session={record} />
      </LocalizationContext.Provider>,
    );
  expect(render("level-up")).toContain("Level 2 reached!");
  expect(render("level-down")).toContain("Your points stay");
  expect(render("closer")).toContain("Aim for the center");
});
