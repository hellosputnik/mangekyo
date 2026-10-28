import { describe, expect, it } from "vitest";
import { defaults, initialData, type Session } from "../engine/model";
import {
  comparisonKey,
  conditionGroups,
  emptyStatisticsFilter,
  exerciseProtocol,
  filterStatistics,
  personalBest,
  recordViewport,
} from "./comparison";
import { createBalance } from "../adaptive/balance";
import { ensureTouchChallenge } from "../exercises/touch-challenge";
const session = (id = "a"): Session => ({
  id,
  kind: "visual",
  eye: "Left",
  configuration: { ...defaults },
  status: "completed",
  activeMilliseconds: 300000,
  startedAt: id === "new" ? "2026-10-27T10:00:00Z" : "2026-10-26T10:00:00Z",
  slices: [],
  trials: [],
  difficulty: 2,
  protocol: exerciseProtocol("visual"),
  viewport: { width: 350, height: 400, pixelRatio: 2, changed: false },
});
const answers = (correct = 4, difficulty = 2) =>
  Array.from({ length: 5 }, (_, index) => ({
    correct: index < correct,
    responseMilliseconds: 500,
    difficulty,
    stimulusDiameter: difficulty === 2 ? 20 : 40,
  }));
describe("recorded-condition comparisons", () => {
  it("groups relevant settings, eye, screen and input independently, without splitting on unused options", () => {
    const first = session();
    const other = structuredClone(first);
    other.configuration.speed = 0.8;
    expect(comparisonKey(other)).toBe(comparisonKey(first));
    for (const change of [
      () => {
        other.eye = "Right";
      },
      () => {
        other.configuration.size = 50;
      },
      () => {
        other.viewport!.width++;
      },
      () => {
        other.protocol = "different";
      },
      () => {
        other.inputMethod = "keyboard";
      },
    ]) {
      Object.assign(other, structuredClone(first));
      change();
      expect(comparisonKey(other)).not.toBe(comparisonKey(first));
    }
  });
  it("filters history and current time without modifying preferences, undo data or source records", () => {
    const data = initialData();
    data.sessions = [session(), { ...session("b"), eye: "Right" }];
    data.current = { ...session("c"), status: "paused" };
    const before = structuredClone(data);
    const filtered = filterStatistics(data, {
      ...emptyStatisticsFilter,
      eye: "Right",
    });
    expect(filtered.sessions.map((item) => item.id)).toEqual(["b"]);
    expect(filtered.current).toBeNull();
    expect(filtered.preferences).toBe(data.preferences);
    expect(data).toEqual(before);
    expect(
      conditionGroups(data.sessions, { exercise: "visual", eye: "All" }),
    ).toHaveLength(2);
  });
  it("compares best accuracy only at the latest actual presentation, never against an easier score", () => {
    const easier = session("easy");
    easier.trials = answers(5, 1);
    const older = session("older");
    older.trials = answers(4);
    const latest = session("new");
    latest.trials = answers(3);
    const best = personalBest([easier, older, latest]);
    expect(best?.session.id).toBe("older");
    expect(best?.value).toBe(0.8);
    expect(best?.difficulty).toBe(2);
    latest.trials.push({
      ...answers()[0],
      difficulty: 4,
      stimulusDiameter: 10,
    });
    expect(personalBest([older, latest])).toBeNull();
  });
  it("requires enough matching answers and verified geometry, excluding mixed input and interrupted practice", () => {
    const record = session();
    record.trials = answers(5);
    expect(personalBest([record])?.value).toBe(1);
    expect(personalBest([{ ...record, viewport: undefined }])).toBeNull();
    expect(
      personalBest([
        { ...record, viewport: { ...record.viewport!, changed: true } },
      ]),
    ).toBeNull();
    expect(personalBest([{ ...record, status: "interrupted" }])).toBeNull();
    expect(personalBest([{ ...record, inputMethod: "mixed" }])).toBeNull();
    expect(
      personalBest([{ ...record, trials: record.trials.slice(0, 4) }]),
    ).toBeNull();
  });
  it("compares full following windows at the latest actual load", () => {
    const first = session();
    first.kind = "follow";
    first.protocol = exerciseProtocol("follow");
    const challenge = ensureTouchChallenge(first);
    challenge.balance = createBalance();
    challenge.balance.history = [
      { activeMilliseconds: 10000, performance: 1, fromLoad: 0, toLoad: 4 },
      { activeMilliseconds: 20000, performance: 0.9, fromLoad: 4, toLoad: 4 },
    ];
    const next = structuredClone(first);
    next.id = "new";
    next.startedAt = "2026-10-27T10:00:00Z";
    next.challenge!.balance!.history = [
      { activeMilliseconds: 10000, performance: 0.8, fromLoad: 4, toLoad: 4 },
    ];
    expect(personalBest([first, next])).toMatchObject({
      value: 0.9,
      count: 10,
      difficulty: 4,
    });
  });
  it("retains first viewport and flags real changes without recording resize noise", () => {
    const record = session();
    delete record.viewport;
    const viewport = (): Session["viewport"] => record.viewport;
    recordViewport(record, 350, 400, 2);
    recordViewport(record, 350.5, 400.5, 2);
    expect(viewport()?.changed).toBe(false);
    recordViewport(record, 700, 300, 2);
    expect(record.viewport).toMatchObject({
      width: 350,
      height: 400,
      changed: true,
    });
    recordViewport(record, NaN, -1, 0);
    expect(viewport()?.width).toBe(350);
  });
});
