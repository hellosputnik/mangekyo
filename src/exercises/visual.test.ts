import { describe, expect, it } from "vitest";
import { defaults, type Session } from "../engine/model";
import { ActiveTimer } from "../engine/timer";
import { recordResponse, responseScore } from "./responses";
import {
  maximumVisualDifficulty,
  nextVisualDifficulty,
  visualTargetRadius,
} from "./visual";

const viewport = { width: 358, height: 320, pixelRatio: 3 };
function session(): Session {
  return {
    id: "visual",
    kind: "visual",
    eye: "Left",
    configuration: { ...defaults },
    startedAt: "2026-10-26T10:00:00Z",
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
}
describe("continuous visual difficulty", () => {
  it("keeps shrinking after the former 12-step cap and records each presented size", () => {
    const practice = session();
    for (let index = 0; index < 30; index++)
      recordResponse(practice, true, 1000, viewport);
    expect(practice.difficulty).toBe(30);
    const sizes = practice.trials.map((trial) => trial.stimulusDiameter!);
    for (let index = 1; index < sizes.length; index++)
      expect(sizes[index]).toBeLessThan(sizes[index - 1]);
    expect(sizes[29]).toBeLessThan(sizes[12] / 2);
    expect(responseScore(practice.trials)).toEqual({
      points: 30,
      currentRun: 30,
      bestRun: 30,
    });
  });
  it("shrinks oversized custom targets on the very next correct answer, even in landscape", () => {
    const settings = { ...defaults, size: 120 };
    const landscape = { width: 540, height: 100, pixelRatio: 2 };
    expect(visualTargetRadius(settings, 1, landscape)).toBeLessThan(
      visualTargetRadius(settings, 0, landscape),
    );
    expect(visualTargetRadius(settings, 0, landscape)).toBeLessThan(
      landscape.height / 2,
    );
  });
  it("holds after an isolated mistake, enlarges after two of three, and can recover to the starting size", () => {
    expect(nextVisualDifficulty(20, [true, true, false], 80)).toBe(20);
    expect(nextVisualDifficulty(20, [false, true, false], 80)).toBe(17);
    expect(nextVisualDifficulty(20, [true, false, false], 80)).toBe(17);
    expect(nextVisualDifficulty(1, [false, false], 80)).toBe(0);
    expect(nextVisualDifficulty(0, [false, false], 80)).toBe(0);
    expect(nextVisualDifficulty(17, [false, false, true], 80)).toBe(18);
    expect(visualTargetRadius(defaults, 17, viewport)).toBeGreaterThan(
      visualTargetRadius(defaults, 20, viewport),
    );
  });
  it.each([1, 2, 3])(
    "stops only at the renderable pixel floor at DPR %i and enlarges again after errors",
    (pixelRatio) => {
      const screen = { ...viewport, pixelRatio };
      const maximum = maximumVisualDifficulty(defaults, screen);
      expect(maximum).toBeGreaterThan(12);
      let level = 0;
      for (let answer = 0; answer < 500; answer++)
        level = nextVisualDifficulty(level, [true], maximum);
      expect(level).toBe(maximum);
      expect(
        visualTargetRadius(defaults, level, screen) * pixelRatio,
      ).toBeCloseTo(2);
      expect(
        visualTargetRadius(
          defaults,
          nextVisualDifficulty(level, [false, false], maximum),
          screen,
        ),
      ).toBeGreaterThan(visualTargetRadius(defaults, level, screen));
    },
  );
  it("bounds malformed levels and geometry without non-finite sizes", () => {
    const invalid = { width: NaN, height: Infinity, pixelRatio: NaN };
    expect(Number.isFinite(visualTargetRadius(defaults, NaN, invalid))).toBe(
      true,
    );
    expect(Number.isFinite(maximumVisualDifficulty(defaults, invalid))).toBe(
      true,
    );
    expect(nextVisualDifficulty(-4, [false, false], 80)).toBe(0);
    expect(nextVisualDifficulty(500, [true], 80)).toBe(80);
  });
  it("keeps scores and size through pause/recovery while time and scheduling never advance difficulty", () => {
    const practice = session();
    let clock = 0;
    const timer = new ActiveTimer(practice, () => clock);
    timer.resume();
    clock = 1000;
    timer.checkpoint();
    recordResponse(practice, true, 1000, viewport);
    timer.pause(true);
    expect(recordResponse(practice, true, 1000, viewport)).toBeNull();
    const recovered: Session = structuredClone(practice);
    clock = 600000;
    const resumedTimer = new ActiveTimer(recovered, () => clock);
    resumedTimer.resume();
    clock += 1000;
    resumedTimer.checkpoint();
    expect(recovered.activeMilliseconds).toBe(2000);
    expect(recovered.difficulty).toBe(1);
    expect(responseScore(recovered.trials).points).toBe(1);
    const result = recordResponse(recovered, true, 1000, viewport)!;
    expect(result.points).toBe(2);
    expect(recovered.trials[1].stimulusDiameter).toBeLessThan(
      recovered.trials[0].stimulusDiameter!,
    );
    resumedTimer.finish();
    expect(recordResponse(recovered, true, 1000, viewport)).toBeNull();
  });
  it("preserves contrast's independent five-answer rule and excludes tracking from response scores", () => {
    const practice = session();
    practice.kind = "contrast";
    for (let index = 0; index < 4; index++)
      recordResponse(practice, true, 1000, viewport);
    expect(practice.difficulty).toBe(0);
    recordResponse(practice, true, 1000, viewport);
    expect(practice.difficulty).toBe(1);
    expect(practice.trials[0].stimulusDiameter).toBeUndefined();
    practice.kind = "pursuit";
    expect(recordResponse(practice, true, 1000, viewport)).toBeNull();
    expect(practice.trials).toHaveLength(5);
  });
});
it("rewards correct answers, resets only the current run after a mistake, and preserves the best", () => {
  expect(responseScore([])).toEqual({ points: 0, currentRun: 0, bestRun: 0 });
  expect(
    responseScore(
      [true, true, true, false, true, true].map((correct) => ({ correct })),
    ),
  ).toEqual({ points: 5, currentRun: 2, bestRun: 3 });
});
