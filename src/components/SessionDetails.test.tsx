import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { defaults, type Session } from "../engine/model";
import { createLocalization } from "../i18n/locale";
import { LocalizationContext } from "../i18n/react";
import { SessionDetails } from "./SessionDetails";

function record(overrides: Partial<Session> = {}): Session {
  return {
    id: "detail",
    kind: "saccades",
    eye: "Left",
    configuration: { ...defaults, exposure: 2.5, tapConfirm: true },
    startedAt: "2026-10-25T08:00:00Z",
    endedAt: "2026-10-25T11:00:00Z",
    status: "abandoned",
    activeMilliseconds: 30000,
    slices: [
      {
        date: "2026-10-25",
        timezone: "Asia/Ho_Chi_Minh",
        offset: -420,
        milliseconds: 30000,
      },
    ],
    trials: [],
    difficulty: 0,
    ...overrides,
  };
}
function render(session: Session) {
  return renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("en", ["en-GB"])}>
      <SessionDetails session={session} />
    </LocalizationContext.Provider>,
  );
}
it("shows recorded start/end clocks independently from active and planned time", () => {
  const html = render(record());
  expect(html).toContain("15:00");
  expect(html).toContain("18:00");
  expect(html).toContain("UTC+07:00");
  expect(html).toContain("Asia/Ho_Chi_Minh");
  expect(html).toContain("0:30");
  expect(html).toContain("5 min");
  expect(html).toContain("Target exposure (seconds)");
  expect(html).toContain(">2.5</dd>");
  expect(html).toContain(">On</dd>");
  expect(html).not.toContain("Median response");
});
it("renders unknown ends without inventing a timestamp", () => {
  expect(render(record({ endedAt: undefined }))).toContain("Not recorded");
  expect(render(record({ endedAt: "invalid" }))).toContain("Not recorded");
});
it("uses recorded answers for response details and keeps the source session unchanged", () => {
  const session = record({
    kind: "visual",
    trials: [
      { correct: true, responseMilliseconds: 1000, difficulty: 2 },
      { correct: false, responseMilliseconds: 2000, difficulty: 2 },
    ],
    difficulty: 2,
  });
  const before = JSON.stringify(session);
  const html = render(session);
  expect(html).toContain("50%");
  expect(html).toContain("1.5 s");
  expect(html).toContain("1 correct out of 2 answers");
  expect(JSON.stringify(session)).toBe(before);
});
it("shows the recorded target-size range and best run without inventing sizes for old trials", () => {
  const session = record({
    kind: "visual",
    trials: [
      {
        correct: true,
        responseMilliseconds: 1000,
        difficulty: 20,
        stimulusDiameter: 24.4,
      },
      {
        correct: true,
        responseMilliseconds: 1000,
        difficulty: 21,
        stimulusDiameter: 22.9,
      },
      { correct: false, responseMilliseconds: 1000, difficulty: 22 },
    ],
  });
  const html = render(session);
  expect(html).toContain("Best correct run");
  expect(html).toContain("22.9–24.4 CSS px");
  expect(html).toContain("not a calibrated eyesight measurement");
  expect(render(record({ kind: "visual" }))).not.toContain(
    "Target diameter range",
  );
});
