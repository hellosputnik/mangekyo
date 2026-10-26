import { describe, expect, it } from "vitest";
import { defaults, initialData, type Data } from "./model";
import { resetStatistics, undoStatisticsReset } from "./statistics-reset";
import { buildStatistics } from "../analytics/statistics";

function fixture(): Data {
  const data = initialData();
  data.sessions = [
    {
      id: "old",
      kind: "visual",
      eye: "Left",
      configuration: { ...defaults },
      startedAt: "2026-10-24T12:00:00Z",
      status: "completed",
      activeMilliseconds: 1000,
      slices: [],
      trials: [],
      difficulty: 4,
    },
  ];
  data.levels.visual = 4;
  data.measurements = [
    {
      id: "measurement",
      date: "2026-10-24",
      eye: "Left",
      method: "Snellen",
      value: "20/40",
    },
  ];
  data.preferences.language = "vi";
  return data;
}

describe("statistics reset", () => {
  it("clears training records while preserving difficulty, clinical records and preferences by default", () => {
    const data = fixture();
    const before = structuredClone(data);
    const cleared = resetStatistics(data, {
      measurements: false,
      difficulty: false,
    });
    expect(buildStatistics(cleared).summary.activeMilliseconds).toBe(0);
    expect(cleared.sessions).toEqual([]);
    expect(cleared.measurements).toEqual(data.measurements);
    expect(cleared.levels).toEqual(data.levels);
    expect(cleared.preferences).toEqual(data.preferences);
    expect(data).toEqual(before);
    expect(undoStatisticsReset(cleared)).toEqual(data);
  });
  it("supports an explicit full reset and restores its complete snapshot", () => {
    const data = fixture();
    const cleared = resetStatistics(data, {
      measurements: true,
      difficulty: true,
    });
    expect(cleared.measurements).toEqual([]);
    expect(cleared.levels.visual).toBe(0);
    expect(undoStatisticsReset(cleared)).toEqual(data);
  });
  it("preserves sessions and measurements added after reset without double counting restored IDs", () => {
    const data = fixture();
    const cleared = resetStatistics(data, {
      measurements: true,
      difficulty: true,
    });
    const recent = {
      ...data.sessions[0],
      id: "recent",
      startedAt: "2026-10-25T12:00:00Z",
      difficulty: 1,
    };
    cleared.sessions = [
      { ...recent, id: "old", activeMilliseconds: 2000 },
      recent,
    ];
    cleared.levels.visual = 1;
    cleared.measurements.push({
      ...data.measurements[0],
      id: "new-measurement",
    });
    const restored = undoStatisticsReset(cleared);
    expect(restored.sessions.map((session) => session.id)).toEqual([
      "old",
      "recent",
    ]);
    expect(restored.sessions[0].activeMilliseconds).toBe(2000);
    expect(restored.measurements).toHaveLength(2);
    expect(restored.levels.visual).toBe(1);
    expect(undoStatisticsReset(restored)).toEqual(restored);
  });
  it("never resets or restores an in-flight or interrupted exercise or routine", () => {
    const data = fixture();
    data.current = { ...data.sessions[0], status: "interrupted" };
    expect(() =>
      resetStatistics(data, { measurements: false, difficulty: false }),
    ).toThrow();
    expect(() => undoStatisticsReset(data)).toThrow();
    data.current = null;
    data.run = {
      routine: {
        id: "routine",
        name: "Routine",
        steps: [{ kind: "pursuit", duration: 60 }],
        rest: 60,
        manual: false,
      },
      eye: "Left",
      index: 0,
    };
    expect(() =>
      resetStatistics(data, { measurements: true, difficulty: true }),
    ).toThrow();
  });
  it("keeps only the most recent reset available for undo", () => {
    const first = resetStatistics(fixture(), {
      measurements: false,
      difficulty: false,
    });
    first.sessions = [{ ...fixture().sessions[0], id: "second" }];
    const second = resetStatistics(first, {
      measurements: false,
      difficulty: false,
    });
    expect(
      undoStatisticsReset(second).sessions.map((session) => session.id),
    ).toEqual(["second"]);
  });
  it("does not replace an undo copy when there is no selected data to reset", () => {
    const data = resetStatistics(fixture(), {
      measurements: false,
      difficulty: false,
    });
    expect(
      resetStatistics(data, { measurements: false, difficulty: false }),
    ).toBe(data);
    expect(undoStatisticsReset(data).sessions).toHaveLength(1);
  });
});
