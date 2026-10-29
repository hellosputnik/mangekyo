import { describe, expect, it } from "vitest";
import { defaults, type Session } from "../engine/model";
import {
  AttentionExercise,
  attentionPositions,
  createAttentionRound,
  cueMilliseconds,
} from "./attention";
import {
  trackingChoices,
  trackingProgress,
  trackingProtocol,
  trackingTransitionProtocol,
  trackingCalibrating,
} from "./tracking";
import { validAttentionPresentation } from "./attention-validation";
import { comparisonKey, exerciseProtocol } from "../analytics/comparison";

function setup(): Session {
  return {
    id: "tracking-balance",
    kind: "tracking",
    eye: "Left",
    configuration: { ...defaults },
    startedAt: "2026-10-28T12:00:00Z",
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
}
function respond(
  session: Session,
  exercise: AttentionExercise,
  correct = true,
  milliseconds = 400,
) {
  const round = session.attentionRound!;
  session.activeMilliseconds =
    round.startedAtMilliseconds +
    cueMilliseconds(round) +
    round.presentation.trackingMilliseconds +
    milliseconds;
  return exercise.choose(
    correct ? round.answers[0] : (round.answers[0] + 1) % round.items.length,
  );
}

describe("Track & find balance", () => {
  it("removes the stable identity shortcut: accessible choices follow final spatial order", () => {
    const choices = trackingChoices([
      { x: 300, y: 100 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
    expect(choices.map((choice) => choice.index)).toEqual([1, 2, 0]);
    expect(choices.map((choice) => choice.position)).toEqual([1, 2, 3]);
    // Choosing the first current position selects object 1, not original object 0.
    const session = setup();
    const exercise = new AttentionExercise(session, () => 0);
    exercise.initialize();
    session.attentionRound!.answers = [1];
    session.activeMilliseconds = 6000;
    expect(exercise.choose(choices[0].index)?.correct).toBe(true);
  });

  it("requires three correct rounds and reaches a meaningful task within a minute of quick accurate play", () => {
    const session = setup();
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    expect(trackingProgress(session)).toEqual({ required: 3, correct: 0 });
    respond(session, exercise);
    respond(session, exercise);
    expect(session.difficulty).toBe(0);
    expect(trackingProgress(session).correct).toBe(2);
    expect(respond(session, exercise)?.levelUp).toBe(true);
    expect(session.difficulty).toBe(2);
    for (let index = 0; index < 6; index++) respond(session, exercise);
    expect(session.activeMilliseconds).toBeLessThan(60000);
    expect(session.difficulty).toBe(6);
    expect(session.attentionRound!.items).toHaveLength(4);
    expect(trackingProgress(session).required).toBe(8);
    for (let index = 0; index < 7; index++) respond(session, exercise);
    expect(session.difficulty).toBe(6);
    respond(session, exercise);
    expect(session.difficulty).toBe(7);
    expect(session.trials.filter((trial) => trial.correct)).toHaveLength(17);
  });

  it("takes smaller early steps when correct answers need more time", () => {
    const session = setup();
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    for (let index = 0; index < 3; index++)
      respond(session, exercise, true, 4000);
    expect(session.difficulty).toBe(1);
    expect(session.attentionRound!.items).toHaveLength(3);
  });

  it("eases after repeated errors without cascading across levels or removing points", () => {
    const session = setup();
    session.difficulty = 8;
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    respond(session, exercise);
    respond(session, exercise, false);
    expect(session.difficulty).toBe(8);
    respond(session, exercise, false);
    expect(session.difficulty).toBe(7);
    respond(session, exercise);
    expect(session.difficulty).toBe(7);
    expect(session.trials.filter((trial) => trial.correct)).toHaveLength(2);
    expect(trackingProgress(session).correct).toBe(1);
  });

  it("ends coarse calibration when errors locate the working range", () => {
    const session = setup();
    session.difficulty = 2;
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    respond(session, exercise, false);
    respond(session, exercise, false);
    expect(trackingCalibrating(session)).toBe(false);
    expect(trackingProgress(session).required).toBe(8);
    const supported = session.difficulty;
    for (let index = 0; index < 3; index++) respond(session, exercise);
    expect(session.difficulty).toBe(supported);
    expect(trackingCalibrating(session)).toBe(false);
  });

  it("ignores replay assistance for calibration and caps later progress", () => {
    const session = setup();
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    for (let index = 0; index < 4; index++) {
      exercise.replay();
      respond(session, exercise);
    }
    expect(session.difficulty).toBe(0);
    expect(trackingProgress(session).correct).toBe(0);
    for (let index = 0; index < 3; index++) respond(session, exercise);
    expect(session.difficulty).toBe(2);
    expect(session.trials.filter((trial) => trial.correct)).toHaveLength(7);
    session.difficulty = 24;
    session.attentionRound = createAttentionRound(session);
    for (let index = 0; index < 12; index++) respond(session, exercise);
    expect(session.difficulty).toBe(24);
    expect(session.attentionRound!.items).toHaveLength(6);
  });

  it.each([false, true])(
    "involves every object across seeds, including gentler motion %s",
    (gentleMotion) => {
      for (let count = 3; count <= 6; count++)
        for (let seed = 1; seed <= 25; seed++) {
          const session = setup();
          session.configuration = {
            ...defaults,
            trackingObjects: count,
            gentleMotion,
          };
          const round = createAttentionRound(session, () => seed / 26);
          const start = attentionPositions(round, 0, 390, 220);
          const movement = Array.from({ length: count }, () => 0);
          for (
            let milliseconds = 100;
            milliseconds <= 4000;
            milliseconds += 100
          ) {
            const points = attentionPositions(
              round,
              cueMilliseconds(round) + milliseconds,
              390,
              220,
            );
            points.forEach((point, index) => {
              movement[index] = Math.max(
                movement[index],
                Math.abs(point.x - start[index].x),
              );
            });
          }
          expect(Math.min(...movement)).toBeGreaterThan((390 / count) * 0.6);
        }
    },
  );

  it("moves multiple disjoint pairs together and produces different trajectories for different seeds", () => {
    const fingerprints = new Set();
    for (let seed = 1; seed <= 12; seed++) {
      const session = setup();
      session.configuration.trackingObjects = 6;
      const round = createAttentionRound(session, () => seed / 13);
      let maximumMoving = 0;
      let previous = attentionPositions(
        round,
        cueMilliseconds(round),
        390,
        220,
      );
      const samples = [];
      for (let milliseconds = 100; milliseconds <= 4000; milliseconds += 100) {
        const points = attentionPositions(
          round,
          cueMilliseconds(round) + milliseconds,
          390,
          220,
        );
        maximumMoving = Math.max(
          maximumMoving,
          points.filter(
            (point, index) =>
              Math.hypot(
                point.x - previous[index].x,
                point.y - previous[index].y,
              ) > 1,
          ).length,
        );
        samples.push(
          points.map((point) => [Math.round(point.x), Math.round(point.y)]),
        );
        previous = points;
      }
      expect(maximumMoving).toBe(6);
      fingerprints.add(JSON.stringify(samples));
    }
    expect(fingerprints.size).toBe(12);
  });

  it("varies final order instead of repeating a learnable fixed permutation", () => {
    const orders = new Set();
    for (let seed = 1; seed <= 100; seed++) {
      const round = createAttentionRound(setup(), () => seed / 101);
      orders.add(
        trackingChoices(attentionPositions(round, 5400, 390, 220))
          .map((choice) => choice.index)
          .join(","),
      );
    }
    expect(orders.size).toBeGreaterThanOrEqual(5);
  });

  it("remains deterministic through pauses, reloads and viewport changes", () => {
    const session = setup();
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    session.activeMilliseconds = 2900;
    const before = attentionPositions(
      session.attentionRound!,
      session.activeMilliseconds,
      390,
      220,
    );
    session.status = "interrupted";
    const recovered = structuredClone(session);
    const restored = new AttentionExercise(recovered);
    restored.initialize();
    expect(
      attentionPositions(
        recovered.attentionRound!,
        recovered.activeMilliseconds,
        390,
        220,
      ),
    ).toEqual(before);
    expect(restored.choose(0)).toBeNull();
    expect(recovered.attentionRound).toEqual(session.attentionRound);
    const landscape = attentionPositions(
      recovered.attentionRound!,
      recovered.activeMilliseconds,
      812,
      160,
    );
    landscape.forEach((point, index) =>
      expect(point.x / 812).toBeCloseTo(before[index].x / 390),
    );
    expect(recovered.activeMilliseconds).toBe(2900);
  });

  it("restarts an interrupted old round safely while retaining time and historical answers", () => {
    const session = setup();
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    respond(session, exercise);
    delete session.trials[0].attention!.trackingVersion;
    delete session.attentionRound!.presentation.trackingVersion;
    session.protocol = "attention-tracking-1";
    session.status = "interrupted";
    const history = structuredClone(session.trials);
    const elapsed = session.activeMilliseconds;
    const number = session.attentionRound!.index;
    const restored = new AttentionExercise(session);
    restored.initialize();
    expect(session.status).toBe("interrupted");
    expect(session.activeMilliseconds).toBe(elapsed);
    expect(session.trials).toEqual(history);
    expect(session.protocol).toBe(trackingTransitionProtocol);
    expect(session.attentionRound).toMatchObject({
      index: number,
      startedAtMilliseconds: elapsed,
      presentation: { trackingVersion: 2, replays: 1 },
    });
    expect(restored.choose(0)).toBeNull();
    session.status = "running";
    respond(session, restored);
    expect(session.difficulty).toBe(0);
    expect(session.trials[1].attention).toMatchObject({
      trackingVersion: 2,
      replays: 1,
    });
    expect(session.trials[0]).toEqual(history[0]);
  });

  it("separates historical scores and rejects unsupported tracking metadata", () => {
    const session = setup();
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    expect(exerciseProtocol("tracking")).toBe(trackingProtocol);
    const legacy = { ...session, protocol: "attention-tracking-1" };
    expect(comparisonKey(legacy)).not.toBe(comparisonKey(session));
    expect(
      validAttentionPresentation(session.attentionRound!.presentation),
    ).toBe(true);
    expect(
      validAttentionPresentation({
        ...session.attentionRound!.presentation,
        trackingVersion: 3,
      }),
    ).toBe(false);
    expect(
      validAttentionPresentation({
        ...session.attentionRound!.presentation,
        task: "Numbers",
      }),
    ).toBe(false);
  });

  it.each([6, 12, 20])(
    "settles near a simulated capability of %s instead of escalating indefinitely",
    (capability) => {
      const outcomes = [];
      for (let seed = 1; seed <= 8; seed++) {
        let value = seed * 7919;
        const random = () => {
          value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
          return value / 4294967296;
        };
        const session = setup();
        const exercise = new AttentionExercise(session, random);
        exercise.initialize();
        const levels = [];
        for (let index = 0; index < 250; index++) {
          const probability =
            0.2 + 0.8 / (1 + Math.exp((session.difficulty - capability) / 2));
          respond(session, exercise, random() < probability);
          if (index >= 150) levels.push(session.difficulty);
        }
        const recent = session.trials.slice(-100);
        outcomes.push({
          level: levels.reduce((sum, level) => sum + level, 0) / levels.length,
          accuracy:
            recent.filter((trial) => trial.correct).length / recent.length,
        });
      }
      const averageLevel =
        outcomes.reduce((sum, outcome) => sum + outcome.level, 0) /
        outcomes.length;
      const averageAccuracy =
        outcomes.reduce((sum, outcome) => sum + outcome.accuracy, 0) /
        outcomes.length;
      expect(averageLevel).toBeGreaterThan(capability - 7);
      expect(averageLevel).toBeLessThan(capability);
      expect(averageAccuracy).toBeGreaterThan(0.75);
      expect(averageAccuracy).toBeLessThan(0.95);
    },
  );
});
