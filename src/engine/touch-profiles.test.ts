import { expect, it } from "vitest";
import { defaults, initialData, type Session } from "./model";
import { ensureTouchChallenge } from "../exercises/touch-challenge";
import { rememberTouchProfile, restoreTouchProfile } from "./touch-profiles";
import { resetStatistics, undoStatisticsReset } from "./statistics-reset";

const session = (): Session => ({
  id: "profile",
  kind: "follow",
  eye: "Left",
  configuration: { ...defaults },
  startedAt: "2026-10-26T12:00:00Z",
  status: "abandoned",
  activeMilliseconds: 10000,
  slices: [],
  trials: [],
  difficulty: 3,
});
it("remembers tuning without carrying points, unfinished windows, or old feedback into another session", () => {
  const data = initialData();
  const first = session();
  const state = ensureTouchChallenge(first);
  Object.assign(state.balance!, {
    load: 12,
    phase: "personalized",
    step: 0.25,
    samples: 2,
    successes: 1,
  });
  state.levelUps = 3;
  rememberTouchProfile(data, first);
  const next = session();
  next.configuration.duration = 60;
  restoreTouchProfile(next, data.touchProfiles);
  expect(next.challenge).toMatchObject({
    levelUps: 0,
    balance: { load: 12, phase: "personalized", samples: 0, history: [] },
  });
  next.challenge!.balance!.load = 20;
  expect(data.touchProfiles![0].balance.load).toBe(12);
});
it.each(["eye", "hand", "size", "kind", "speed", "pattern"])(
  "calibrates independently when %s changes",
  (field) => {
    const data = initialData();
    const first = session();
    ensureTouchChallenge(first).balance!.load = 12;
    rememberTouchProfile(data, first);
    const next = session();
    if (field === "eye") next.eye = "Right";
    if (field === "kind") next.kind = "tap";
    if (field === "hand") next.configuration.hand = "Left";
    if (field === "size") next.configuration.size += 10;
    if (field === "speed") next.configuration.speed += 0.02;
    if (field === "pattern") next.configuration.pattern = "Circle";
    restoreTouchProfile(next, data.touchProfiles);
    expect(next.challenge!.balance!.load).toBe(0);
  },
);
it("keeps tuning when clearing statistics, resets it with difficulty, and Undo favors subsequent practice", () => {
  const data = initialData();
  const first = session();
  ensureTouchChallenge(first).balance!.load = 12;
  rememberTouchProfile(data, first);
  data.sessions = [first];
  expect(
    resetStatistics(data, { difficulty: false, measurements: false })
      .touchProfiles,
  ).toEqual(data.touchProfiles);
  const reset = resetStatistics(data, {
    difficulty: true,
    measurements: false,
  });
  expect(reset.touchProfiles).toEqual([]);
  expect(undoStatisticsReset(reset).touchProfiles).toEqual(data.touchProfiles);
  const next = session();
  ensureTouchChallenge(next).balance!.load = 5;
  rememberTouchProfile(reset, next);
  expect(undoStatisticsReset(reset).touchProfiles![0].balance.load).toBe(5);
});
