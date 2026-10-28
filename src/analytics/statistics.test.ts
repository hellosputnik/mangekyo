import { describe, expect, it } from "vitest";
import { defaults, initialData, type Session } from "../engine/model";
import { buildStatistics } from "./statistics";

function record(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    kind: "visual",
    eye: "Left",
    configuration: { ...defaults },
    startedAt: "2026-10-24T12:00:00Z",
    status: "completed",
    activeMilliseconds: 1000,
    slices: [
      {
        date: "2026-10-24",
        timezone: "Asia/Ho_Chi_Minh",
        offset: -420,
        milliseconds: 1000,
      },
    ],
    trials: [{ correct: true, responseMilliseconds: 100, difficulty: 0 }],
    difficulty: 0,
    ...overrides,
  };
}

describe("lifetime statistics", () => {
  it("counts timeout attempts in hit rate without presenting a deadline as a human tap latency", () => {
    const data = initialData();
    data.sessions = [
      record("tap", {
        kind: "tap",
        trials: [
          { correct: true, responseMilliseconds: 400, difficulty: 0 },
          {
            correct: false,
            timedOut: true,
            qualified: false,
            responseMilliseconds: 2500,
            timeLimitMilliseconds: 2500,
            difficulty: 0,
          },
        ],
      }),
    ];
    expect(buildStatistics(data).summary).toMatchObject({
      accuracy: 0.5,
      responseCount: 2,
      medianResponseMilliseconds: 400,
    });
  });
  it("weights accuracy by individual answers and uses median response time", () => {
    const data = initialData();
    data.sessions = [
      record("one"),
      record("nine", {
        startedAt: "2026-10-25T12:00:00Z",
        eye: "Right",
        difficulty: 3,
        trials: Array.from({ length: 9 }, (_, index) => ({
          correct: index < 3,
          responseMilliseconds: 200,
          difficulty: 3,
        })),
      }),
    ];
    const { summary, exercises, eyes } = buildStatistics(data);
    expect(summary).toMatchObject({
      responseCount: 10,
      correctCount: 4,
      accuracy: 0.4,
      medianResponseMilliseconds: 200,
      activeMilliseconds: 2000,
      sessionCount: 2,
    });
    expect(
      exercises.find((exercise) => exercise.kind === "visual"),
    ).toMatchObject({ accuracy: 0.4, latestLevel: 4 });
    expect(eyes.find((eye) => eye.eye === "Right")?.sessionCount).toBe(1);
  });
  it("deduplicates historical IDs and uses the latest current session once", () => {
    const data = initialData();
    const older = record("one");
    data.sessions = [older, older];
    data.current = {
      ...older,
      status: "interrupted",
      activeMilliseconds: 2500,
      slices: [{ ...older.slices[0], milliseconds: 2500 }],
    };
    const { summary, week } = buildStatistics(data, new Date(2026, 9, 25, 12));
    expect(summary).toMatchObject({
      sessionCount: 1,
      activeMilliseconds: 2500,
      interruptedCount: 1,
      completedCount: 0,
      responseCount: 1,
    });
    expect(
      week.find((day) => day.date === "2026-10-24")?.activeMilliseconds,
    ).toBe(2500);
  });
  it("includes partial sessions and counts local days from stored time slices", () => {
    const data = initialData();
    data.sessions = [
      record("partial", {
        status: "abandoned",
        activeMilliseconds: 3000,
        slices: [
          {
            date: "2026-10-24",
            timezone: "Asia/Ho_Chi_Minh",
            offset: -420,
            milliseconds: 1000,
          },
          {
            date: "2026-10-25",
            timezone: "Asia/Ho_Chi_Minh",
            offset: -420,
            milliseconds: 2000,
          },
          {
            date: "2026-10-26",
            timezone: "America/Los_Angeles",
            offset: 420,
            milliseconds: 0,
          },
        ],
      }),
    ];
    const report = buildStatistics(data, new Date(2026, 9, 25, 12));
    expect(report.summary).toMatchObject({
      activeDays: 2,
      stoppedCount: 1,
      firstDate: "2026-10-24",
      lastDate: "2026-10-25",
      averageSessionMilliseconds: 3000,
    });
    expect(report.week.slice(-2).map((day) => day.activeMilliseconds)).toEqual([
      1000, 2000,
    ]);
  });
  it("keeps pursuit and saccades free of gaze accuracy or response scores", () => {
    const data = initialData();
    data.sessions = [
      record("tracking", { kind: "pursuit" }),
      record("jumps", { kind: "saccades" }),
    ];
    const report = buildStatistics(data);
    expect(report.summary.responseCount).toBe(0);
    expect(report.summary.accuracy).toBeNull();
    for (const exercise of report.exercises)
      expect(exercise.recentResults).toEqual([]);
  });
  it("returns honest empty values and a seven-day calendar across daylight saving", () => {
    const report = buildStatistics(initialData(), new Date(2026, 10, 2, 12));
    expect(report.summary).toMatchObject({
      activeMilliseconds: 0,
      activeDays: 0,
      accuracy: null,
      medianResponseMilliseconds: null,
      firstDate: null,
      lastDate: null,
    });
    expect(report.week.map((day) => day.date)).toEqual([
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });
  it("orders recent results by time and calculates the even-sample median", () => {
    const data = initialData();
    data.sessions = [
      record("late", {
        startedAt: "2026-10-25T12:00:00Z",
        trials: [{ correct: false, responseMilliseconds: 500, difficulty: 1 }],
      }),
      record("early"),
    ];
    const exercise = buildStatistics(data).exercises.find(
      (item) => item.kind === "visual",
    )!;
    expect(exercise.medianResponseMilliseconds).toBe(300);
    expect(exercise.recentResults.map((item) => item.id)).toEqual([
      "early",
      "late",
    ]);
  });
});
