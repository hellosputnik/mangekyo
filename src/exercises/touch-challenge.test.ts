import { describe, expect, it } from "vitest";
import { defaults, type Session } from "../engine/model";
import { TouchExercise } from "./touch";
import { balanceRules } from "../adaptive/balance";
import {
  changeTouchLevel,
  followMotionFactor,
  maximumTouchLevel,
  tapTimeLimit,
  touchTargetDiameter,
} from "./touch-challenge";

function setup(kind: "tap" | "follow" = "tap", width = 390, height = 500) {
  const session: Session = {
    id: "challenge",
    kind,
    eye: "Left",
    configuration: {
      ...defaults,
      size: 44,
      speed: 0.02,
      pattern: "Horizontal",
    },
    startedAt: "2026-10-26T12:00:00Z",
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
  const exercise = new TouchExercise(session, () => 0.5);
  exercise.initialize();
  exercise.setViewport(width, height);
  return { session, exercise };
}
function hit(
  session: Session,
  exercise: TouchExercise,
  elapsed = 500,
  offset = 0,
) {
  session.activeMilliseconds += elapsed;
  exercise.update(session.activeMilliseconds / 1000);
  const target = exercise.targetPoint();
  const point = { x: target.x + offset, y: target.y };
  exercise.pointerDown(point);
  return exercise.pointerUp(point)!;
}
describe("tap challenge", () => {
  it("records one failed outcome for an expired target even when its eventual tap earns a point", () => {
    const { session, exercise } = setup();
    session.activeMilliseconds = 3000;
    exercise.update(3);
    expect(session.challenge!.balance!.samples).toBe(1);
    const target = exercise.targetPoint();
    exercise.pointerDown(target);
    const result = exercise.pointerUp(target);
    expect(result).toMatchObject({
      correct: true,
      qualified: false,
      points: 1,
    });
    expect(session.challenge!.balance!.samples).toBe(1);
    expect(session.difficulty).toBe(0);
  });
  it("uses the exact displayed one-decimal deadline, including its boundary, throughout the adaptive range", () => {
    for (
      let load = 0;
      load <= balanceRules.maximumLoad;
      load += balanceRules.minimumStep
    ) {
      const { session, exercise } = setup();
      session.challenge!.balance!.load = load;
      const deadline = tapTimeLimit(session.configuration, load);
      expect(deadline % 100).toBe(0);
      expect(hit(session, exercise, deadline).qualified).toBe(true);
    }
  });
  it("requires five consecutive fast centered hits and calibrates difficulty after the full window", () => {
    const { session, exercise } = setup();
    const initialSize = touchTargetDiameter(session);
    const deadline = tapTimeLimit(session.configuration, 0);
    for (let count = 0; count < 4; count++) {
      const size = touchTargetDiameter(session);
      expect(hit(session, exercise).qualified).toBe(true);
      expect(touchTargetDiameter(session)).toBe(size);
      expect(session.difficulty).toBe(0);
    }
    expect(session.challenge?.streak).toBe(4);
    hit(session, exercise);
    expect(session.difficulty).toBe(1);
    expect(session.challenge).toMatchObject({
      highestLevel: 1,
      levelUps: 1,
      streak: 0,
      chain: 5,
      bestChain: 5,
    });
    expect(touchTargetDiameter(session)).toBeLessThan(initialSize);
    expect(session.challenge?.balance?.load).toBe(4);
    expect(tapTimeLimit(session.configuration, 4)).toBeLessThan(deadline);
    expect(exercise.drainCues()).toEqual([{ kind: "level-up", level: 1 }]);
    expect(exercise.drainCues()).toEqual([]);
    expect(session.trials[0]).toMatchObject({
      qualified: true,
      timeLimitMilliseconds: 2500,
      precisionRadius: 22,
    });
  });
  it("awards forgiving hits without letting imprecise or slow tapping advance a level", () => {
    const { session, exercise } = setup();
    hit(session, exercise);
    hit(session, exercise);
    const edge = hit(session, exercise, 500, 30);
    expect(edge).toMatchObject({ correct: true, qualified: false, points: 3 });
    expect(session.challenge?.streak).toBe(0);
    expect(exercise.drainCues().at(-1)?.kind).toBe("closer");
    const slow = hit(session, exercise, 2600);
    expect(slow).toMatchObject({ correct: true, qualified: false, points: 4 });
    expect(session.difficulty).toBe(0);
    expect(exercise.drainCues().at(-1)?.kind).toBe("slower");
  });
  it("expires an unfinished run once per target and eases after repeated failures while retaining the best", () => {
    const { session, exercise } = setup();
    for (let index = 0; index < 5; index++) hit(session, exercise);
    hit(session, exercise);
    const points = session.trials.filter((trial) => trial.correct).length;
    session.activeMilliseconds += 3000;
    exercise.update(session.activeMilliseconds / 1000);
    expect(session.challenge?.streak).toBe(0);
    const misses = session.challenge!.misses;
    exercise.update(session.activeMilliseconds / 1000 + 100);
    expect(session.challenge?.misses).toBe(misses);
    expect(session.trials.filter((trial) => trial.correct).length).toBe(points);
    hit(session, exercise, 3000);
    hit(session, exercise, 3000);
    hit(session, exercise, 3000);
    expect(session.difficulty).toBe(1);
    expect(session.challenge!.balance!.load).toBeLessThan(4);
    expect(session.challenge?.highestLevel).toBe(1);
    expect(
      session.trials.filter((trial) => trial.correct).length,
    ).toBeGreaterThan(points);
  });
  it("resets incomplete runs on interruption without replaying earned level cues", () => {
    const { session, exercise } = setup();
    for (let count = 0; count < 7; count++) hit(session, exercise);
    exercise.release(true);
    const recovered = structuredClone(session);
    recovered.status = "interrupted";
    recovered.challenge!.version = 1;
    const renderer = new TouchExercise(recovered);
    renderer.initialize();
    renderer.setViewport(390, 500);
    expect(recovered.challenge).toMatchObject({
      version: 3,
      streak: 0,
      chain: 0,
      highestLevel: 1,
      bestChain: 7,
      levelUps: 1,
    });
    expect(renderer.drainCues()).toEqual([]);
    expect(renderer.pointerDown(renderer.targetPoint())).toBe(false);
  });
  it("keeps earned progress beyond level thirty and never takes it away when difficulty eases", () => {
    const { session, exercise } = setup();
    for (let count = 0; count < 155; count++) hit(session, exercise, 300);
    const cues = exercise.drainCues();
    expect(session.difficulty).toBe(31);
    expect(cues.filter((cue) => cue.kind === "level-up")).toHaveLength(31);
    expect(session.challenge?.mastered).toBe(false);
    expect(session.trials).toHaveLength(155);
    expect(exercise.toleranceRadius() * 2).toBeGreaterThanOrEqual(44);
    expect(touchTargetDiameter(session)).toBeGreaterThanOrEqual(16);
    const load = session.challenge!.balance!.load;
    exercise.makeEasier();
    expect(session.difficulty).toBe(31);
    expect(session.challenge!.balance!.load).toBeLessThan(load);
    expect(session.challenge?.highestLevel).toBe(31);
    expect(session.challenge?.mastered).toBe(false);
  });
});
describe("following challenge", () => {
  it("keeps the loop responsive at the earned-level storage guard while adapting independently", () => {
    const { session, exercise } = setup("follow", 80, 300);
    session.difficulty = maximumTouchLevel;
    exercise.pointerDown(exercise.handlePoint());
    session.activeMilliseconds = 20000;
    exercise.sample();
    expect(session.difficulty).toBe(maximumTouchLevel);
    expect(session.challenge?.progressMilliseconds).toBe(0);
    expect(session.challenge?.balance?.windows).toBe(2);
    expect(session.follow?.onTargetMilliseconds).toBe(20000);
  });
  it("holds difficulty around eighty-five percent on-target control without revoking earned levels", () => {
    const { session, exercise } = setup("follow", 80, 300);
    session.difficulty = 7;
    Object.assign(session.challenge!.balance!, {
      load: 8,
      phase: "personalized",
      step: 0.25,
    });
    exercise.pointerDown(exercise.handlePoint());
    session.activeMilliseconds = 8500;
    exercise.sample();
    exercise.pointerMove({ x: 10000, y: 10000 });
    session.activeMilliseconds = 10000;
    exercise.sample();
    expect(session.challenge!.balance).toMatchObject({
      load: 8,
      windows: 1,
      lastPerformance: 0.85,
    });
    expect(session.difficulty).toBe(7);
    expect(session.follow?.onTargetMilliseconds).toBe(8500);
  });
  it("keeps adapting and awarding earned levels beyond the former thirty-level ceiling", () => {
    const { session, exercise } = setup("follow", 80, 300);
    session.configuration.duration = 600;
    exercise.pointerDown(exercise.handlePoint());
    session.activeMilliseconds = 310000;
    exercise.sample();
    expect(session.difficulty).toBe(31);
    expect(session.challenge?.mastered).toBe(false);
    expect(session.challenge?.balance?.windows).toBe(31);
    expect(session.challenge!.balance!.load).toBeGreaterThan(12);
    const load = session.challenge!.balance!.load;
    exercise.makeEasier();
    expect(session.difficulty).toBe(31);
    expect(session.challenge!.balance!.load).toBeLessThan(load);
  });
  it("gives halfway encouragement at five seconds and waits for ten on-target seconds to advance", () => {
    const { session, exercise } = setup("follow", 150, 300);
    exercise.pointerDown(exercise.handlePoint());
    session.activeMilliseconds = 5000;
    exercise.sample();
    expect(exercise.drainCues()).toEqual([{ kind: "milestone", level: 0 }]);
    session.activeMilliseconds = 6000;
    exercise.sample();
    expect(session.difficulty).toBe(0);
    expect(exercise.drainCues()).toEqual([]);
    session.activeMilliseconds = 9999;
    exercise.sample();
    expect(session.difficulty).toBe(0);
    session.activeMilliseconds = 10000;
    exercise.sample();
    expect(session.difficulty).toBe(1);
    expect(exercise.drainCues()).toEqual([{ kind: "level-up", level: 1 }]);
  });
  it("makes small personalized steps independently from earned levels and bounds the actual stimulus", () => {
    const { session, exercise } = setup("follow");
    const radius = exercise.toleranceRadius();
    const diameter = touchTargetDiameter(session);
    session.difficulty = 100;
    expect(exercise.toleranceRadius()).toBe(radius);
    session.challenge!.balance!.load = 0.25;
    expect(exercise.toleranceRadius()).toBeCloseTo(radius * 0.97 ** 0.25);
    expect(touchTargetDiameter(session)).toBeCloseTo(diameter * 0.96 ** 0.25);
    expect(followMotionFactor(defaults, 0.25)).toBeLessThan(1.013);
    expect(
      followMotionFactor(defaults, balanceRules.maximumLoad) * defaults.speed,
    ).toBeLessThanOrEqual(0.22);
    expect(
      tapTimeLimit(defaults, balanceRules.maximumLoad),
    ).toBeGreaterThanOrEqual(600);
    session.kind = "tap";
    session.challenge!.balance!.load = balanceRules.maximumLoad;
    expect(touchTargetDiameter(session)).toBe(16);
  });
  it("awards halfway and level cues from sustained on-target time with exact active timestamps", () => {
    const { session, exercise } = setup("follow", 150, 300);
    exercise.pointerDown(exercise.handlePoint());
    session.activeMilliseconds = 20000;
    exercise.sample();
    expect(session.difficulty).toBe(2);
    expect(
      session.challenge?.achievements.map((item) => item.activeMilliseconds),
    ).toEqual([10000, 20000]);
    expect(exercise.drainCues().map((cue) => cue.kind)).toEqual([
      "milestone",
      "level-up",
      "milestone",
      "level-up",
    ]);
    expect(session.follow?.trackedMilliseconds).toBe(20000);
  });
  it("does not award levels for off-target holds and resets an interrupted goal while preserving points", () => {
    const { session, exercise } = setup("follow");
    exercise.pointerDown(exercise.handlePoint());
    session.activeMilliseconds = 1000;
    exercise.sample();
    const earned = session.follow!.onTargetMilliseconds;
    exercise.pointerMove({ x: 10000, y: 10000 });
    session.activeMilliseconds = 1400;
    exercise.sample();
    expect(session.challenge?.progressMilliseconds).toBe(1000);
    expect(session.follow?.onTargetMilliseconds).toBe(earned);
    session.activeMilliseconds = 2100;
    exercise.sample();
    expect(session.challenge?.progressMilliseconds).toBe(0);
    exercise.release(true);
    session.activeMilliseconds = 100000;
    exercise.sample();
    expect(session.follow?.onTargetMilliseconds).toBe(earned);
    expect(session.difficulty).toBe(0);
    expect(session.challenge?.motionSeconds).toBeLessThan(3);
  });
  it("increases motion speed without a position jump and respects gentler motion limits", () => {
    const { session, exercise } = setup("follow");
    exercise.pointerDown(exercise.handlePoint());
    session.activeMilliseconds = 500;
    exercise.sample();
    exercise.update(0.5);
    const before = exercise.targetPoint();
    const phase = session.challenge!.motionSeconds;
    changeTouchLevel(session, 1);
    session.challenge!.balance!.load = 4;
    expect(exercise.targetPoint()).toEqual(before);
    session.activeMilliseconds = 501;
    exercise.sample();
    expect(session.challenge!.motionSeconds - phase).toBeGreaterThan(0.001);
    expect(
      Math.hypot(
        exercise.targetPoint().x - before.x,
        exercise.targetPoint().y - before.y,
      ),
    ).toBeLessThan(1);
    const settings = { ...defaults, speed: 0.06, gentleMotion: true };
    expect(
      followMotionFactor(settings, maximumTouchLevel) * settings.speed,
    ).toBeCloseTo(0.08);
    expect(
      followMotionFactor(
        { ...settings, gentleMotion: false },
        maximumTouchLevel,
      ),
    ).toBeGreaterThan(followMotionFactor(settings, maximumTouchLevel));
  });
});
