import { describe, expect, it } from "vitest";
import { defaults, motionPaths, validate, type Session } from "../engine/model";
import { ActiveTimer } from "../engine/timer";
import {
  applyPursuitPreset,
  currentPursuitPath,
  pursuitPoint,
} from "./pursuit";

describe("pursuit presets", () => {
  it("defaults to a five-minute mix and allocates all five paths equally", () => {
    expect(defaults.duration).toBe(300);
    expect(defaults.pattern).toBe("Mixed");
    expect(defaults.pursuitPreset).toBe("Mixed");
    expect(
      [0, 60, 120, 180, 240].map((seconds) =>
        currentPursuitPath(defaults, seconds),
      ),
    ).toEqual(motionPaths);
    expect(currentPursuitPath(defaults, 300)).toBe("Wandering");
  });
  it.each([10, 75, 155, 900, 3600])(
    "covers every path within a %i-second session",
    (duration) => {
      const configuration = { ...defaults, duration };
      expect(
        motionPaths.map((_, index) =>
          currentPursuitPath(configuration, (duration * (index + 0.5)) / 5),
        ),
      ).toEqual(motionPaths);
    },
  );
  it("lets custom inherit a preset and restores preset parameters without changing the schedule or viewing distance", () => {
    const custom = {
      ...defaults,
      duration: 155,
      distance: 50,
      size: 90,
      speed: 0.05,
    };
    const preset = applyPursuitPreset(custom, "Circle");
    expect(preset).toMatchObject({
      pattern: "Circle",
      pursuitPreset: "Circle",
      size: defaults.size,
      speed: defaults.speed,
      duration: 155,
      distance: 50,
    });
    expect(applyPursuitPreset(preset, "Custom")).toEqual({
      ...preset,
      pursuitPreset: "Custom",
    });
    expect(custom.size).toBe(90);
  });
  it("preserves legacy paths and normalizes unrecognized configuration", () => {
    const legacy = {
      ...defaults,
      pattern: "Figure eight" as const,
      pursuitPreset: undefined,
    };
    expect(validate(legacy).pattern).toBe("Figure eight");
    expect(validate(legacy).pursuitPreset).toBeUndefined();
    expect(validate({ ...defaults, pattern: "invalid" as never }).pattern).toBe(
      "Mixed",
    );
  });
});

describe("mixed pursuit motion", () => {
  it("joins paths without a position or velocity discontinuity", () => {
    const epsilon = 0.00001;
    for (const boundary of [60, 63, 120, 123, 180, 183, 240, 243]) {
      const before = pursuitPoint(defaults, boundary - epsilon);
      const at = pursuitPoint(defaults, boundary);
      const after = pursuitPoint(defaults, boundary + epsilon);
      for (const axis of [0, 1]) {
        expect(Math.abs(after[axis] - before[axis])).toBeLessThan(0.0001);
        const incomingVelocity = (at[axis] - before[axis]) / epsilon;
        const outgoingVelocity = (after[axis] - at[axis]) / epsilon;
        expect(Math.abs(incomingVelocity - outgoingVelocity)).toBeLessThan(
          0.001,
        );
      }
    }
  });
  it("keeps the target inside normalized bounds, including short-session transitions", () => {
    for (const duration of [10, 300]) {
      const configuration = { ...defaults, duration, speed: 1, complexity: 5 };
      for (let seconds = 0; seconds <= duration; seconds += 0.07) {
        for (const coordinate of pursuitPoint(configuration, seconds)) {
          expect(Number.isFinite(coordinate)).toBe(true);
          expect(Math.abs(coordinate)).toBeLessThanOrEqual(1);
        }
      }
    }
  });
  it("uses the chosen individual path between transitions", () => {
    motionPaths.forEach((pattern, index) => {
      const seconds = index * 60 + 30;
      expect(pursuitPoint(defaults, seconds)).toEqual(
        pursuitPoint({ ...defaults, pattern }, seconds),
      );
    });
  });
  it("does not advance the mix while paused or interrupted and recovers its exact position", () => {
    let now = 0;
    const session: Session = {
      id: "mixed",
      kind: "pursuit",
      eye: "Left",
      configuration: { ...defaults },
      startedAt: "2026-10-25T12:00:00Z",
      status: "paused",
      activeMilliseconds: 0,
      slices: [],
      trials: [],
      difficulty: 0,
    };
    const timer = new ActiveTimer(session, () => now);
    timer.resume();
    now = 59500;
    timer.pause(true);
    const pausedPoint = pursuitPoint(
      session.configuration,
      session.activeMilliseconds / 1000,
    );
    now += 600000;
    timer.checkpoint();
    expect(
      currentPursuitPath(
        session.configuration,
        session.activeMilliseconds / 1000,
      ),
    ).toBe("Horizontal");
    expect(
      pursuitPoint(session.configuration, session.activeMilliseconds / 1000),
    ).toEqual(pausedPoint);
    const recovered = structuredClone(session);
    const recoveredTimer = new ActiveTimer(recovered, () => now);
    recoveredTimer.checkpoint();
    expect(
      pursuitPoint(
        recovered.configuration,
        recovered.activeMilliseconds / 1000,
      ),
    ).toEqual(pausedPoint);
    recoveredTimer.resume();
    now += 1000;
    recoveredTimer.pause();
    expect(
      currentPursuitPath(
        recovered.configuration,
        recovered.activeMilliseconds / 1000,
      ),
    ).toBe("Vertical");
  });
});
