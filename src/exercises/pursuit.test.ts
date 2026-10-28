import { describe, expect, it } from "vitest";
import { defaults, motionPaths, validate, type Session } from "../engine/model";
import { ActiveTimer } from "../engine/timer";
import {
  applyPursuitPreset,
  currentPursuitPath,
  pursuitPoint,
  pursuitMotion,
  pursuitSpeedRange,
  initializePursuitMotion,
} from "./pursuit";
import { createExercise } from "./factory";
import { initialData } from "../engine/model";
import { mergeBackup } from "../persistence/backup";
import {
  defaultPracticePreferences,
  parsePracticePreferences,
} from "../engine/practice";
import { comparisonKey, exerciseProtocol } from "../analytics/comparison";

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
      pursuitVariableSpeed: true,
      pursuitSpeedVariation: 0.6,
    };
    const preset = applyPursuitPreset(custom, "Circle");
    expect(preset).toMatchObject({
      pattern: "Circle",
      pursuitPreset: "Circle",
      size: defaults.size,
      speed: defaults.speed,
      pursuitVariableSpeed: false,
      pursuitSpeedVariation: 0.35,
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

describe("variable pursuit speed", () => {
  const configuration = { ...defaults, pursuitVariableSpeed: true };
  const session = (): Session => ({
    id: "variable-pursuit",
    kind: "pursuit",
    eye: "Left",
    configuration: { ...configuration },
    startedAt: "2026-10-28T12:00:00Z",
    status: "paused",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
    protocol: exerciseProtocol("pursuit", false, configuration),
  });
  it("keeps Default timing unchanged and uses different bounded random sequences for new sessions", () => {
    expect(defaults.pursuitVariableSpeed).toBe(false);
    for (const seconds of [0, 1, 20, 61, 181, 299]) {
      const steady = pursuitMotion(defaults, seconds, 1234);
      expect(steady).toEqual({ phaseSeconds: seconds, speed: defaults.speed });
      expect(pursuitPoint(defaults, seconds, steady.phaseSeconds)).toEqual(
        pursuitPoint(defaults, seconds),
      );
    }
    const first = session();
    const next = session();
    initializePursuitMotion(first, () => 0.2);
    initializePursuitMotion(next, () => 0.8);
    expect(first.pursuitSeed).not.toBe(next.pursuitSeed);
    const speeds = Array.from(
      { length: 120 },
      (_, index) =>
        pursuitMotion(configuration, index / 2, first.pursuitSeed).speed,
    );
    const range = pursuitSpeedRange(configuration);
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeGreaterThan(0.02);
    expect(
      speeds.every((speed) => speed >= range.minimum && speed <= range.maximum),
    ).toBe(true);
    expect(pursuitMotion(configuration, 30, first.pursuitSeed)).not.toEqual(
      pursuitMotion(configuration, 30, next.pursuitSeed),
    );
  });
  it("integrates speed rather than multiplying elapsed time by its current value", () => {
    for (const seconds of [0.1, 2.99, 4, 10, 30, 61, 180, 299, 3599]) {
      const epsilon = 0.0001;
      const before = pursuitMotion(configuration, seconds - epsilon, 12345);
      const current = pursuitMotion(configuration, seconds, 12345);
      const after = pursuitMotion(configuration, seconds + epsilon, 12345);
      const derivative =
        ((after.phaseSeconds - before.phaseSeconds) / (2 * epsilon)) *
        configuration.speed;
      expect(derivative).toBeCloseTo(current.speed, 5);
      expect(after.phaseSeconds).toBeGreaterThan(before.phaseSeconds);
      expect(Math.abs(after.speed - before.speed)).toBeLessThan(0.0001);
    }
    const end = pursuitMotion(configuration, 60, 12345);
    for (let frame = 0; frame < 3600; frame++)
      pursuitMotion(configuration, frame / 60, 12345);
    expect(pursuitMotion(configuration, 60, 12345)).toEqual(end);
  });
  it("retains smooth bounded paths at mixed-path joins and every supported path", () => {
    const point = (settings: typeof configuration, time: number) =>
      pursuitPoint(
        settings,
        time,
        pursuitMotion(settings, time, 12345).phaseSeconds,
      );
    const epsilon = 0.00001;
    for (const boundary of [60, 63, 120, 123, 180, 183, 240, 243]) {
      const before = point(configuration, boundary - epsilon);
      const at = point(configuration, boundary);
      const after = point(configuration, boundary + epsilon);
      for (const axis of [0, 1]) {
        expect(Math.abs(after[axis] - before[axis])).toBeLessThan(0.0001);
        expect(
          Math.abs(
            (at[axis] - before[axis]) / epsilon -
              (after[axis] - at[axis]) / epsilon,
          ),
        ).toBeLessThan(0.001);
      }
    }
    for (const pattern of motionPaths) {
      const settings = { ...configuration, pattern, complexity: 5 };
      for (let seconds = 0; seconds < 300; seconds += 0.7)
        expect(
          point(settings, seconds).every(
            (value) => Number.isFinite(value) && Math.abs(value) <= 1,
          ),
        ).toBe(true);
    }
  });
  it("restores the exact rendered position and speed through pause, reload and backup without credit for time away", () => {
    const practice = session();
    initializePursuitMotion(practice, () => 0.2);
    let now = 0;
    const timer = new ActiveTimer(
      practice,
      () => now,
      () => new Date("2026-10-28T12:01:00Z"),
    );
    timer.resume();
    now = 12345;
    timer.pause(true);
    const before = pursuitMotion(
      practice.configuration,
      practice.activeMilliseconds / 1000,
      practice.pursuitSeed,
    );
    const renderPoint = (record: Session) => {
      const renderer = createExercise(record, () => 0.9);
      const circles: number[][] = [];
      const context = {
        fillRect() {},
        beginPath() {},
        fill() {},
        arc: (...values: number[]) => circles.push(values),
      } as unknown as CanvasRenderingContext2D;
      renderer.initialize();
      renderer.update(record.activeMilliseconds / 1000, 0);
      renderer.render(context, 390, 500);
      renderer.terminate();
      return circles[0];
    };
    const position = renderPoint(practice);
    const data = initialData();
    data.current = practice;
    const recovered = mergeBackup(
      initialData(),
      JSON.parse(JSON.stringify(data)),
    ).sessions[0];
    now += 600000;
    const resumed = new ActiveTimer(recovered, () => now);
    resumed.checkpoint();
    expect(recovered.activeMilliseconds).toBe(12345);
    expect(recovered.pursuitSeed).toBe(practice.pursuitSeed);
    expect(
      pursuitMotion(
        recovered.configuration,
        recovered.activeMilliseconds / 1000,
        recovered.pursuitSeed,
      ),
    ).toEqual(before);
    expect(renderPoint(recovered)).toEqual(position);
    resumed.resume();
    now += 1000;
    resumed.pause();
    expect(recovered.activeMilliseconds).toBe(13345);
    expect(renderPoint(recovered)).not.toEqual(position);
  });
  it("respects gentler-motion limits, custom speed bounds and malformed configuration", () => {
    for (const speed of [0.02, 0.08, 0.16, 1]) {
      for (const gentleMotion of [false, true]) {
        const settings = {
          ...configuration,
          speed,
          gentleMotion,
          pursuitSpeedVariation: 0.6,
        };
        for (let seconds = 0; seconds <= 300; seconds += 0.7) {
          const motion = pursuitMotion(settings, seconds, 45678);
          expect(motion.speed).toBeGreaterThan(0);
          expect(motion.speed).toBeLessThanOrEqual(gentleMotion ? 0.08 : 1);
          expect(Number.isFinite(motion.phaseSeconds)).toBe(true);
        }
      }
    }
    const normalized = validate({
      ...configuration,
      pursuitSpeedVariation: Infinity,
    });
    expect(normalized.pursuitSpeedVariation).toBe(0.35);
    expect(
      Number.isFinite(pursuitMotion(normalized, Infinity).phaseSeconds),
    ).toBe(true);
    expect(
      validate({ ...configuration, pursuitSpeedVariation: 999 })
        .pursuitSpeedVariation,
    ).toBe(0.6);
  });
  it("stores reusable variation settings separately from a sequence and rejects corrupt imports", () => {
    const preferences = defaultPracticePreferences();
    preferences.setups.pursuit = {
      mode: "Custom",
      configuration: { ...configuration },
    };
    expect(
      parsePracticePreferences(preferences)!.setups.pursuit.configuration
        .pursuitVariableSpeed,
    ).toBe(true);
    const practice = session();
    initializePursuitMotion(practice, () => 0.2);
    const data = initialData();
    data.current = practice;
    data.practice = preferences;
    const imported = mergeBackup(
      initialData(),
      JSON.parse(JSON.stringify(data)),
    );
    expect(imported.sessions[0].pursuitSeed).toBe(practice.pursuitSeed);
    expect(
      imported.practice!.setups.pursuit.configuration.pursuitSpeedVariation,
    ).toBe(0.35);
    const changed = {
      ...practice,
      configuration: { ...configuration, pursuitSpeedVariation: 0.6 },
    };
    expect(comparisonKey(changed)).not.toBe(comparisonKey(practice));
    expect(exerciseProtocol("pursuit", false, defaults)).toBe(
      "visual-practice-1",
    );
    const invalid = JSON.parse(JSON.stringify(data));
    invalid.current.pursuitSeed = -1;
    expect(() => mergeBackup(initialData(), invalid)).toThrow();
    invalid.current.pursuitSeed = 123;
    invalid.current.configuration.pursuitVariableSpeed = "yes";
    expect(() => mergeBackup(initialData(), invalid)).toThrow();
    preferences.setups.pursuit.configuration.pursuitSpeedVariation = -1;
    expect(parsePracticePreferences(preferences)).toBeNull();
  });
});
