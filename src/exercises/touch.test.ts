import { describe, expect, it } from "vitest";
import { defaults, validate, type Session } from "../engine/model";
import { ActiveTimer } from "../engine/timer";
import { createExercise } from "./factory";
import { TouchExercise } from "./touch";

function session(kind: "tap" | "follow" = "tap"): Session {
  return {
    id: kind,
    kind,
    eye: "Left",
    configuration: { ...defaults, speed: 0.02, pattern: "Vertical" },
    startedAt: "2026-10-26T12:00:00Z",
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
}
function setup(kind: "tap" | "follow" = "tap", width = 390, height = 500) {
  const record = session(kind);
  const exercise = new TouchExercise(record, () => 0.5);
  exercise.initialize();
  exercise.setViewport(width, height);
  return { record, exercise };
}
describe("tap targets", () => {
  it("records released hits, active response time, distance, tolerance, and a distinct next target", () => {
    const { record, exercise } = setup();
    const target = exercise.targetPoint();
    record.activeMilliseconds = 750;
    expect(exercise.pointerDown(target)).toBe(true);
    expect(record.trials).toHaveLength(0);
    const result = exercise.pointerUp({ x: target.x + 4, y: target.y });
    expect(result).toMatchObject({ correct: true, points: 1, bestRun: 1 });
    expect(record.trials[0]).toMatchObject({
      responseMilliseconds: 750,
      touchDistance: 4,
      touchTolerance: 72,
    });
    expect(exercise.targetPoint()).not.toEqual(target);
  });
  it("retains the target after a miss, gives no points, and cancels a drag or release outside the stage", () => {
    const { record, exercise } = setup();
    const target = exercise.targetPoint();
    exercise.pointerDown({ x: 4, y: 4 });
    expect(exercise.pointerUp({ x: 4, y: 4 })?.correct).toBe(false);
    expect(exercise.targetPoint()).toEqual(target);
    exercise.pointerDown(target);
    exercise.pointerMove({ x: target.x + 20, y: target.y });
    expect(exercise.pointerUp(target)).toBeNull();
    exercise.pointerDown({ x: 1, y: 1 });
    expect(exercise.pointerUp({ x: -1, y: 1 })).toBeNull();
    expect(record.trials).toHaveLength(1);
  });
  it("preserves the next position and active latency across pause and reload, without accepting paused taps", () => {
    const { record, exercise } = setup();
    let clock = 0;
    const timer = new ActiveTimer(record, () => clock);
    timer.resume();
    clock = 500;
    timer.pause(true);
    exercise.release();
    const recovered = structuredClone(record);
    const renderer = new TouchExercise(recovered);
    renderer.initialize();
    renderer.setViewport(390, 500);
    expect(renderer.targetPoint()).toEqual(exercise.targetPoint());
    expect(renderer.pointerDown(renderer.targetPoint())).toBe(false);
    clock = 500000;
    const recovery = new ActiveTimer(recovered, () => clock);
    recovery.resume();
    clock += 300;
    recovery.checkpoint();
    renderer.pointerDown(renderer.targetPoint());
    renderer.pointerUp(renderer.targetPoint());
    expect(recovered.trials[0].responseMilliseconds).toBe(800);
  });
  it("adjusts from hit performance but never reduces the hit area below 44 CSS px", () => {
    const { record, exercise } = setup();
    record.configuration.touchTolerance = 44;
    for (let index = 0; index < 70; index++) {
      const target = exercise.targetPoint();
      exercise.pointerDown(target);
      exercise.pointerUp(target);
    }
    expect(record.difficulty).toBe(14);
    expect(exercise.toleranceRadius() * 2).toBe(44);
    expect(record.trials.every((trial) => trial.touchTolerance! >= 44)).toBe(
      true,
    );
  });
});
describe("finger following", () => {
  it("rejects interrupted and manually paused grabs until explicitly armed", () => {
    const { record, exercise } = setup("follow");
    record.status = "interrupted";
    expect(exercise.pointerDown(exercise.handlePoint())).toBe(false);
    record.status = "paused";
    expect(exercise.pointerDown(exercise.handlePoint())).toBe(false);
    record.awaitingTouch = true;
    expect(exercise.pointerDown(exercise.handlePoint())).toBe(true);
    exercise.release();
    record.status = "completed";
    expect(exercise.pointerDown(exercise.handlePoint())).toBe(false);
  });
  it("requires the visible handle, preserves the grab offset, and follows one-to-one", () => {
    const { exercise } = setup("follow");
    const handle = exercise.handlePoint();
    expect(exercise.pointerDown({ x: 0, y: 0 })).toBe(false);
    const grabbed = { x: handle.x + 3, y: handle.y + 4 };
    expect(exercise.pointerDown(grabbed)).toBe(true);
    exercise.pointerMove(grabbed);
    expect(exercise.handlePoint()).toEqual(handle);
    exercise.pointerMove({ x: grabbed.x + 10, y: grabbed.y + 12 });
    expect(exercise.handlePoint()).toEqual({
      x: handle.x + 10,
      y: handle.y + 12,
    });
  });
  it("integrates time instead of frame counts, ends runs on release and excludes paused/away time", () => {
    const { record, exercise } = setup("follow", 150, 300);
    let clock = 0;
    const timer = new ActiveTimer(record, () => clock);
    timer.resume();
    exercise.pointerDown(exercise.handlePoint());
    clock = 2000;
    timer.checkpoint();
    exercise.sample();
    expect(record.follow?.trackedMilliseconds).toBe(2000);
    expect(record.follow?.onTargetMilliseconds).toBe(2000);
    timer.pause();
    exercise.release();
    exercise.release();
    expect(record.follow?.bestRunMilliseconds).toBe(2000);
    expect(record.follow?.currentRunMilliseconds).toBe(0);
    clock = 200000;
    timer.checkpoint();
    exercise.sample();
    expect(record.activeMilliseconds).toBe(2000);
    expect(record.follow?.trackedMilliseconds).toBe(2000);
    timer.resume();
    exercise.pointerDown(exercise.handlePoint());
    clock += 1000;
    timer.checkpoint();
    exercise.sample();
    expect(record.follow?.trackedMilliseconds).toBe(3000);
    expect(record.follow?.bestRunMilliseconds).toBe(2000);
  });
  it("produces comparable time-weighted results at different frame rates", () => {
    const sampleAt = (interval: number) => {
      const { record, exercise } = setup("follow");
      exercise.pointerDown(exercise.handlePoint());
      for (
        let milliseconds = interval;
        milliseconds < 9000;
        milliseconds += interval
      ) {
        record.activeMilliseconds = milliseconds;
        exercise.sample();
      }
      record.activeMilliseconds = 9000;
      exercise.sample();
      return record.follow!;
    };
    const frequent = sampleAt(1000 / 60),
      sparse = sampleAt(200);
    expect(frequent.trackedMilliseconds).toBeCloseTo(
      sparse.trackedMilliseconds,
      5,
    );
    expect(
      Math.abs(frequent.onTargetMilliseconds - sparse.onTargetMilliseconds),
    ).toBeLessThan(64);
    expect(
      Math.abs(
        frequent.distanceWeightedMilliseconds -
          sparse.distanceWeightedMilliseconds,
      ) / 9000,
    ).toBeLessThan(0.1);
  });
  it("adapts halo tolerance from actual on-target performance independently of session duration", () => {
    const successful = setup("follow", 150, 300);
    successful.record.configuration.pattern = "Horizontal";
    successful.exercise.pointerDown(successful.exercise.handlePoint());
    successful.record.activeMilliseconds = 10000;
    successful.exercise.sample();
    expect(successful.record.difficulty).toBe(1);
    const struggling = setup("follow");
    struggling.record.difficulty = 2;
    struggling.record.challenge!.balance!.load = 8;
    struggling.exercise.pointerDown(struggling.exercise.handlePoint());
    struggling.exercise.pointerMove({ x: 10000, y: 10000 });
    struggling.record.activeMilliseconds = 10000;
    struggling.exercise.sample();
    expect(struggling.record.difficulty).toBe(2);
    expect(struggling.record.challenge!.balance!.load).toBeLessThan(8);
    const idle = setup("follow");
    idle.record.activeMilliseconds = 300000;
    idle.exercise.sample();
    expect(idle.record.difficulty).toBe(0);
    expect(idle.record.follow?.trackedMilliseconds).toBe(0);
  });
});
it.each([
  [320, 500],
  [844, 160],
  [290, 130],
])(
  "fits halos and finger handles in %i × %i and releases on termination",
  (width, height) => {
    for (const kind of ["tap", "follow"] as const) {
      const { record, exercise } = setup(kind, width, height);
      record.configuration.size = 120;
      record.configuration.touchTolerance = 160;
      exercise.setViewport(width, height);
      for (const seconds of [0, 1, 10, 60, 140, 299]) {
        const target = exercise.targetPoint(seconds);
        const radius = exercise.toleranceRadius();
        expect(target.x - radius).toBeGreaterThanOrEqual(0);
        expect(target.x + radius).toBeLessThanOrEqual(width);
        expect(target.y - radius).toBeGreaterThanOrEqual(0);
        expect(target.y + radius).toBeLessThanOrEqual(height);
      }
      if (kind === "follow")
        expect(exercise.handlePoint().y + 22).toBeLessThanOrEqual(height);
      exercise.terminate();
      expect(exercise.pointerDown(exercise.handlePoint())).toBe(false);
    }
  },
);
it("creates both touch exercises through the shared exercise lifecycle", () => {
  for (const kind of ["tap", "follow"] as const)
    expect(createExercise(session(kind))).toBeInstanceOf(TouchExercise);
});
it("validates touch settings and preserves a meaningful minimum hit area", () => {
  expect(
    validate({ ...defaults, touchTolerance: -100, hand: "invalid" as never }),
  ).toMatchObject({ touchTolerance: 44, hand: "Right" });
  expect(
    validate({ ...defaults, touchTolerance: Infinity }).touchTolerance,
  ).toBe(72);
  expect(validate({ ...defaults, touchTolerance: 10000 }).touchTolerance).toBe(
    160,
  );
});
