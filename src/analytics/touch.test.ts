import { expect, it } from "vitest";
import { defaults, initialData, type Session } from "../engine/model";
import { summarizeTouch } from "./touch";
import { emptyFollowMetrics } from "../exercises/touch";
import { buildStatistics } from "./statistics";

function record(overrides: Partial<Session>): Session {
  return {
    id: "touch",
    kind: "follow",
    eye: "Left",
    configuration: defaults,
    startedAt: "2026-10-26T12:00:00Z",
    status: "abandoned",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
    ...overrides,
  };
}
it("weights following by tracked time, keeps the longest run, and excludes unrelated exercises", () => {
  const summary = summarizeTouch([
    record({
      follow: {
        ...emptyFollowMetrics(),
        trackedMilliseconds: 3000,
        onTargetMilliseconds: 3000,
        distanceWeightedMilliseconds: 6000,
        bestRunMilliseconds: 2000,
      },
    }),
    record({
      follow: {
        ...emptyFollowMetrics(),
        trackedMilliseconds: 1000,
        distanceWeightedMilliseconds: 10000,
      },
    }),
    record({
      kind: "pursuit",
      follow: { ...emptyFollowMetrics(), trackedMilliseconds: 100000 },
    }),
  ]);
  expect(summary.onTargetRatio).toBe(0.75);
  expect(summary.meanDistance).toBe(4);
  expect(summary.bestRunMilliseconds).toBe(2000);
  expect(summarizeTouch([]).onTargetRatio).toBeNull();
});
it("includes tap hits in response reports without inventing gaze scores or following answers", () => {
  const data = initialData();
  data.sessions = [
    record({
      kind: "tap",
      trials: [
        {
          correct: true,
          difficulty: 0,
          responseMilliseconds: 500,
          touchDistance: 4,
        },
        {
          correct: false,
          difficulty: 0,
          responseMilliseconds: 1000,
          touchDistance: 60,
        },
      ],
    }),
  ];
  const report = buildStatistics(data);
  const tap = report.exercises.find((exercise) => exercise.kind === "tap")!;
  expect(tap.accuracy).toBe(0.5);
  expect(tap.medianResponseMilliseconds).toBe(750);
  expect(report.summary.responseCount).toBe(2);
  expect(summarizeTouch(data.sessions).meanDistance).toBe(32);
  expect(
    report.exercises.find((exercise) => exercise.kind === "follow")?.accuracy,
  ).toBeNull();
});
