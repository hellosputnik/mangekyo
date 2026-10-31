import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { initialData, defaults, type Session } from "../engine/model";
import { initializeAdaptation } from "../adaptive/practice";
import { bindPracticeProfiles } from "../adaptive/profiles";
import { recordResponse } from "../exercises/responses";
import { AttentionExercise, cueMilliseconds } from "../exercises/attention";
import { LocalizationContext } from "../i18n/react";
import { createLocalization } from "../i18n/locale";
import BalanceInspector from "./BalanceInspector";
import { SessionRecap } from "./SessionRecap";

function session(): Session {
  const value: Session = {
    id: "inspector",
    kind: "visual",
    eye: "Left",
    configuration: { ...defaults },
    startedAt: "2026-10-29T12:00:00Z",
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
  initializeAdaptation(value);
  value.adaptation!.viewport = { width: 390, height: 300, pixelRatio: 3 };
  bindPracticeProfiles(value, []);
  for (let index = 0; index < 15; index++) {
    value.activeMilliseconds += 1600;
    value.presentationQuality!.presented = true;
    recordResponse(value, true, 1600, {
      width: 390,
      height: 300,
      pixelRatio: 3,
    });
  }
  return value;
}
it.each(["en", "vi"] as const)(
  "renders localized readable decision evidence and matched accomplishments in %s",
  (language) => {
    const value = session(),
      data = { ...initialData(), sessions: [value] };
    const before = JSON.stringify(data);
    const html = renderToStaticMarkup(
      <LocalizationContext.Provider value={createLocalization(language)}>
        <BalanceInspector data={data} />
        <SessionRecap session={value} />
      </LocalizationContext.Provider>,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toMatch(/balance\.(?:measure|phase|reason|achievement)\./);
    expect(html).toContain(
      language === "vi" ? "Dữ liệu ra quyết định" : "Decision evidence",
    );
    expect(html).toContain(language === "vi" ? "mục tiêu nhỏ hơn" : "targets");
    expect(JSON.stringify(data)).toBe(before);
  },
);
it("shows response results for attention games in the same recap layout", () => {
  const value = session();
  value.kind = "memory";
  value.trials = [];
  value.activeMilliseconds = 0;
  delete value.adaptation;
  initializeAdaptation(value);
  const exercise = new AttentionExercise(value, () => 0.1);
  exercise.initialize();
  for (let index = 0; index < 5; index++) {
    const round = value.attentionRound!;
    value.activeMilliseconds =
      round.startedAtMilliseconds +
      cueMilliseconds(round) +
      round.presentation.exposureMilliseconds +
      round.presentation.delayMilliseconds +
      1000;
    value.presentationQuality!.presented = true;
    for (const answer of round.answers) exercise.choose(answer);
  }
  const html = renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("en")}>
      <SessionRecap session={value} />
    </LocalizationContext.Provider>,
  );
  expect(html).toContain("Accuracy");
  expect(html).toContain("100%");
  expect(html).not.toContain("Target exposure");
});
