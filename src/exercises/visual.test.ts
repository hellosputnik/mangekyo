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
const evidence = (answers: boolean[], latency = 1600) =>
  answers.map((correct) => ({ correct, responseMilliseconds: latency }));
describe("paced visual difficulty", () => {
  it("requires multiple correct answers and active practice at each size instead of advancing on a fluke", () => {
    const practice = session();
    recordResponse(practice, true, 1000, viewport);
    expect(practice.difficulty).toBe(0);
    for (let index = 0; index < 3; index++)
      recordResponse(practice, true, 1600, viewport);
    expect(practice.difficulty).toBe(0);
    recordResponse(practice, true, 2200, viewport);
    expect(practice.difficulty).toBe(1);
    expect(
      new Set(practice.trials.map((trial) => trial.stimulusDiameter)).size,
    ).toBe(1);
    recordResponse(practice, true, 1600, viewport);
    expect(practice.difficulty).toBe(1);
    expect(practice.trials.at(-1)!.stimulusDiameter).toBeLessThan(
      practice.trials[0].stimulusDiameter!,
    );
  });
  it("uses robust answer speed to pace advancement while allowing slower accurate answers to progress", () => {
    const correct = (count: number, latency: number) =>
      evidence(Array(count).fill(true), latency);
    expect(nextVisualDifficulty(12, correct(5, 1600), 80)).toBe(13);
    expect(nextVisualDifficulty(12, correct(5, 100), 80)).toBe(12);
    expect(nextVisualDifficulty(12, correct(5, 3000), 80)).toBe(12);
    expect(nextVisualDifficulty(12, correct(8, 3000), 80)).toBe(13);
    expect(nextVisualDifficulty(12, correct(8, 5000), 80)).toBe(12);
    expect(nextVisualDifficulty(12, correct(10, 5000), 80)).toBe(13);
    expect(
      nextVisualDifficulty(
        12,
        evidence(
          [true, true, true, true, true, false, true, false, true],
          1600,
        ),
        80,
      ),
    ).toBe(12);
    expect(
      nextVisualDifficulty(
        12,
        evidence(
          [true, true, true, true, true, false, true, true, true, true],
          1600,
        ),
        80,
      ),
    ).toBe(13);
  });
  it("keeps the same renderer size curve and gives support after repeated errors", () => {
    expect(nextVisualDifficulty(20, evidence([true, true, false]), 80)).toBe(
      20,
    );
    expect(nextVisualDifficulty(20, evidence([false, true, false]), 80)).toBe(
      17,
    );
    expect(nextVisualDifficulty(1, evidence([false, false]), 80)).toBe(0);
    expect(visualTargetRadius(defaults, 17, viewport)).toBeGreaterThan(
      visualTargetRadius(defaults, 20, viewport),
    );
    const landscape = { width: 540, height: 100, pixelRatio: 2 };
    expect(
      visualTargetRadius({ ...defaults, size: 120 }, 0, landscape),
    ).toBeLessThan(landscape.height / 2);
  });
  it.each([1, 2, 3])(
    "does not race to the display floor during five minutes of perfect fast answers at DPR %i",
    (pixelRatio) => {
      const practice = session();
      // Returning practice starts no harder than this comfortable warm-up.
      practice.difficulty = 12;
      const screen = { ...viewport, pixelRatio };
      const initialSize = visualTargetRadius(
        defaults,
        practice.difficulty,
        screen,
      );
      for (let active = 500; active <= 300000; active += 500) {
        practice.activeMilliseconds = active;
        recordResponse(practice, true, 500, screen);
      }
      expect(practice.difficulty).toBeGreaterThan(12);
      expect(practice.difficulty).toBeLessThan(
        maximumVisualDifficulty(defaults, screen),
      );
      expect(
        visualTargetRadius(defaults, practice.difficulty, screen),
      ).toBeLessThan(initialSize / 2);
      expect(
        visualTargetRadius(defaults, practice.difficulty, screen) * pixelRatio,
      ).toBeGreaterThan(2);
    },
  );
  it("bounds malformed geometry and levels, and retains the pixel floor during longer practice", () => {
    const invalid = { width: NaN, height: Infinity, pixelRatio: NaN };
    expect(Number.isFinite(visualTargetRadius(defaults, NaN, invalid))).toBe(
      true,
    );
    expect(Number.isFinite(maximumVisualDifficulty(defaults, invalid))).toBe(
      true,
    );
    expect(nextVisualDifficulty(-4, evidence([false, false]), 80)).toBe(0);
    expect(nextVisualDifficulty(500, evidence(Array(5).fill(true)), 80)).toBe(
      80,
    );
    const practice = session();
    for (let index = 0; index < 1000; index++)
      recordResponse(practice, true, 1600, viewport);
    expect(practice.difficulty).toBe(
      maximumVisualDifficulty(defaults, viewport),
    );
    expect(
      visualTargetRadius(defaults, practice.difficulty, viewport) * 3,
    ).toBeCloseTo(2);
  });
  it("preserves evidence through pause and reload without using time spent away to advance", () => {
    const practice = session();
    let clock = 0;
    const timer = new ActiveTimer(practice, () => clock);
    timer.resume();
    for (let answer = 0; answer < 4; answer++) {
      clock += 1600;
      timer.checkpoint();
      recordResponse(practice, true, 1600, viewport);
    }
    timer.pause(true);
    expect(recordResponse(practice, true, 1600, viewport)).toBeNull();
    const recovered: Session = structuredClone(practice);
    clock = 600000;
    const resumedTimer = new ActiveTimer(recovered, () => clock);
    resumedTimer.resume();
    clock += 1600;
    resumedTimer.checkpoint();
    expect(recovered.activeMilliseconds).toBe(8000);
    expect(recovered.difficulty).toBe(0);
    expect(recordResponse(recovered, true, 1600, viewport)!.points).toBe(5);
    expect(recovered.difficulty).toBe(1);
    resumedTimer.finish();
    expect(recordResponse(recovered, true, 1600, viewport)).toBeNull();
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
