import { describe, it, expect } from "vitest";
import { type Session } from "../engine/model";
import { practiceDefaults } from "../engine/practice";
import { TouchExercise, fingerOffset } from "../exercises/touch";
import { touchTargetDiameter } from "../exercises/touch-challenge";
import { initializeAdaptation, practiceChannel } from "./practice";
import { bindPracticeProfiles } from "./profiles";
import { flagPresentation } from "./quality";
import { personalBest } from "../analytics/comparison";

function setup(kind: "tap" | "follow") {
  const session: Session = {
    id: kind,
    kind,
    eye: "Left",
    configuration: practiceDefaults(kind),
    startedAt: new Date().toISOString(),
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
  initializeAdaptation(session);
  session.adaptation!.viewport = { width: 390, height: 300, pixelRatio: 3 };
  const renderer = new TouchExercise(session, () => 0.3);
  renderer.initialize();
  renderer.setViewport(390, 300);
  bindPracticeProfiles(session, []);
  const tick = (milliseconds: number, follow = false) => {
    const end = session.activeMilliseconds + milliseconds;
    while (session.activeMilliseconds < end) {
      session.activeMilliseconds = Math.min(
        end,
        session.activeMilliseconds + 16,
      );
      session.presentationQuality!.presented = true;
      renderer.update(session.activeMilliseconds / 1000);
      if (follow) {
        const target = renderer.targetPoint();
        renderer.pointerMove({ x: target.x, y: target.y + fingerOffset });
      }
    }
  };
  const hit = () => {
    tick(700);
    const target = renderer.targetPoint();
    renderer.pointerDown(target);
    tick(20);
    return renderer.pointerUp(target);
  };
  return { session, renderer, tick, hit };
}
describe("touch adaptation with recorded presentation evidence", () => {
  it("compares actual tap conditions independently of earned level numbers", () => {
    const { session, hit } = setup("tap");
    for (let index = 0; index < 5; index++) hit();
    session.status = "abandoned";
    session.viewport = {
      width: 390,
      height: 300,
      pixelRatio: 3,
      changed: false,
    };
    session.inputMethod = "pointer";
    const next = structuredClone(session);
    next.id = "later";
    next.startedAt = new Date(
      Date.parse(session.startedAt) + 10000,
    ).toISOString();
    next.trials.forEach((trial) => {
      trial.difficulty = 50;
    });
    Object.assign(next.trials[4], {correct: false, qualified: false, touchDistance: 100});
    expect(personalBest([session, next])?.session.id).toBe(session.id);
  });
  it("shrinks tap stimuli after repeated accurate hits while preserving hit area, deadline and earned levels", () => {
    const { session, renderer, hit } = setup("tap");
    const size = touchTargetDiameter(session),
      tolerance = renderer.toleranceRadius(),
      deadline = session.tapState!.timeLimitMilliseconds;
    for (let index = 0; index < 5; index++) expect(hit()?.qualified).toBe(true);
    expect(touchTargetDiameter(session)).toBeLessThan(size);
    expect(renderer.toleranceRadius()).toBe(tolerance);
    expect(session.tapState!.timeLimitMilliseconds).toBe(deadline);
    expect(session.challenge!.levelUps).toBe(1);
    expect(session.adaptation!.decisions[0].trials).toEqual([1, 2, 3, 4, 5]);
    expect(
      session.trials.every(
        (trial) => trial.adaptation?.values.diameter === size,
      ),
    ).toBe(true);
  });
  it("keeps disrupted tap attempts out of adaptation and does not erase an earned run", () => {
    const { session, hit } = setup("tap");
    for (let index = 0; index < 4; index++) hit();
    flagPresentation(session, "frame-stall", 600);
    hit();
    expect(session.challenge!.streak).toBe(4);
    expect(practiceChannel(session, "tap")!.samples).toBe(4);
    hit();
    expect(session.challenge!.levelUps).toBe(1);
    expect(session.trials).toHaveLength(6);
  });
  it("records timed-out targets once and freezes expiration when paused", () => {
    const { session, renderer, tick } = setup("tap");
    tick(2600);
    expect(session.trials).toHaveLength(1);
    expect(session.trials[0]).toMatchObject({
      timedOut: true,
      qualified: false,
      adaptation: { activity: "tap" },
    });
    session.status = "paused";
    renderer.update(100000);
    expect(session.trials).toHaveLength(1);
    expect(practiceChannel(session, "tap")!.samples).toBe(1);
  });
  it("retains the ten-on-target-second reward and changes only speed during following", () => {
    const { session, renderer, tick } = setup("follow");
    const diameter = touchTargetDiameter(session),
      tolerance = renderer.toleranceRadius();
    renderer.pointerDown(renderer.handlePoint());
    tick(22000, true);
    expect(session.challenge!.levelUps).toBeGreaterThanOrEqual(2);
    expect(practiceChannel(session, "follow")!.samples).toBe(2);
    expect(practiceChannel(session, "follow")!.challenge).toBeGreaterThan(0);
    expect(touchTargetDiameter(session)).toBe(diameter);
    expect(renderer.toleranceRadius()).toBe(tolerance);
    renderer.release();
    const time = session.follow!.trackedMilliseconds;
    tick(5000);
    expect(session.follow!.trackedMilliseconds).toBe(time);
  });
  it("does not infer on-target time across an unobserved animation stall", () => {
    const { session, renderer, tick } = setup("follow");
    renderer.pointerDown(renderer.handlePoint());
    tick(500, true);
    const measured = session.follow!.trackedMilliseconds;
    session.activeMilliseconds += 1000;
    renderer.sample();
    expect(session.follow!.trackedMilliseconds).toBe(measured);
    expect(session.follow!.windowMilliseconds).toBe(0);
    expect(session.presentationQuality!.events.at(-1)!.reason).toBe(
      "frame-stall",
    );
    expect(session.adaptation!.decisions.at(-1)!.reason).toBe("quality");
    expect(session.challenge!.progressMilliseconds).toBe(0);
  });
});
