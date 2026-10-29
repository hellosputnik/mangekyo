import { describe, expect, it, vi } from "vitest";
import {
  defaults,
  validate,
  type AttentionKind,
  type Configuration,
  type Session,
} from "../engine/model";
import { ActiveTimer } from "../engine/timer";
import {
  AttentionExercise,
  attentionPhase,
  attentionPositions,
  createAttentionRound,
  cueMilliseconds,
  maximumAttentionDifficulty,
} from "./attention";
import {
  validAttentionConfiguration,
  validAttentionRound,
} from "./attention-validation";
import { createExercise } from "./factory";

export function attentionSession(
  kind: AttentionKind,
  configuration: Partial<Configuration> = {},
): Session {
  return {
    id: `test-${kind}`,
    kind,
    eye: "Left",
    configuration: { ...defaults, size: 44, ...configuration },
    startedAt: "2026-10-28T12:00:00Z",
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
}
function ready(session: Session) {
  const round = session.attentionRound!;
  session.activeMilliseconds =
    round.startedAtMilliseconds +
    cueMilliseconds(round) +
    round.presentation.exposureMilliseconds +
    round.presentation.trackingMilliseconds +
    round.presentation.delayMilliseconds +
    1234;
}
function complete(
  session: Session,
  exercise: AttentionExercise,
  correct = true,
) {
  ready(session);
  const answers = [...session.attentionRound!.answers];
  if (!correct)
    return exercise.choose(
      (answers[0] + 1) % session.attentionRound!.choices.length,
    );
  let outcome;
  for (const answer of answers) outcome = exercise.choose(answer);
  return outcome;
}

const tasks = [
  ["tracking", {}],
  ["search", { searchTask: "Count" }],
  ["search", { searchTask: "Match" }],
  ["search", { searchTask: "Moving" }],
  ["memory", { recallTask: "Locations" }],
  ["memory", { recallTask: "Digits" }],
  ["memory", { recallTask: "Directions" }],
  ["memory", { recallTask: "Compare" }],
  ["sequence", {}],
] as const;

describe("attention rounds", () => {
  it.each(["tracking", "search"] as const)(
    "keeps gentler %s motion capped at high difficulty",
    (kind) => {
      const session = attentionSession(kind, {
        gentleMotion: true,
        speed: 1,
        searchTask: "Moving",
      });
      session.difficulty = 24;
      expect(
        createAttentionRound(session).presentation.speed,
      ).toBeLessThanOrEqual(0.08);
    },
  );
  it("balances spatial layouts and keeps remembered locations stable when rotating", () => {
    const numbers = attentionSession("sequence");
    const round = createAttentionRound(numbers);
    const points = attentionPositions(round, 2000, 550, 220);
    expect(new Set(points.map((point) => point.y)).size).toBe(2);
    expect(points.filter((point) => point.y === points[0].y)).toHaveLength(3);
    const locations = attentionSession("memory", { recallTask: "Locations" });
    const memory = createAttentionRound(locations);
    const portrait = attentionPositions(memory, 0, 360, 440);
    const landscape = attentionPositions(memory, 0, 550, 220);
    portrait.forEach((point, index) => {
      expect(point.x / 360).toBeCloseTo(landscape[index].x / 550);
      expect(point.y / 440).toBeCloseTo(landscape[index].y / 220);
    });
  });
  it.each(tasks)(
    "initializes, records conditions and terminates %s %j",
    (kind, settings) => {
      const session = attentionSession(kind, settings);
      const exercise = createExercise(session, () => 0.5);
      expect(exercise).toBeInstanceOf(AttentionExercise);
      exercise.initialize();
      expect(validAttentionRound(session.attentionRound, kind, 0)).toBe(true);
      expect(attentionPhase(session)).toBe("cue");
      expect((exercise as AttentionExercise).choose(0)).toBeNull();
      expect(complete(session, exercise as AttentionExercise)?.correct).toBe(
        true,
      );
      expect(session.trials).toHaveLength(1);
      expect(session.trials[0]).toMatchObject({
        correct: true,
        responseMilliseconds: 1234,
        attention: { replays: 0 },
      });
      expect(session.attentionRound?.index).toBe(1);
      const context = {
        fillRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      exercise.terminate();
      exercise.render(context, 390, 360);
      expect(context.fillRect).not.toHaveBeenCalled();
      expect((exercise as AttentionExercise).choose(0)).toBeNull();
    },
  );

  it("rotates the complete default search and memory activity sets", () => {
    for (const [kind, expected] of [
      ["search", ["Count", "Match", "Moving"]],
      ["memory", ["Locations", "Digits", "Directions", "Compare"]],
    ] as const) {
      const session = attentionSession(kind);
      const exercise = new AttentionExercise(session, () => 0.5);
      exercise.initialize();
      const seen = [];
      for (let index = 0; index < expected.length * 2; index++) {
        seen.push(session.attentionRound!.presentation.task);
        complete(session, exercise);
      }
      expect(seen).toEqual([...expected, ...expected]);
    }
  });

  it("does not advance displays or award active time during pauses or suspension", () => {
    const session = attentionSession("memory", { recallTask: "Digits" });
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    let monotonic = 0;
    const clock = new ActiveTimer(session, () => monotonic);
    clock.resume();
    monotonic = 1300;
    clock.checkpoint();
    expect(attentionPhase(session)).toBe("present");
    clock.pause(true);
    const before = structuredClone(session);
    monotonic += 3600000;
    clock.checkpoint();
    exercise.update(3600, 0);
    expect(session).toEqual(before);
    expect(exercise.choose(0)).toBeNull();
    const recovered = structuredClone(session);
    const recoveredClock = new ActiveTimer(recovered, () => monotonic);
    recoveredClock.checkpoint();
    expect(recovered.activeMilliseconds).toBe(1300);
    recoveredClock.resume();
    monotonic += 100;
    recoveredClock.checkpoint();
    expect(recovered.activeMilliseconds).toBe(1400);
    expect(attentionPhase(recovered)).toBe("present");
  });

  it("restores partially answered sequences without replaying or double counting them", () => {
    const session = attentionSession("memory", {
      recallTask: "Directions",
      recallItems: 3,
    });
    const exercise = new AttentionExercise(session, () => 0.5);
    exercise.initialize();
    ready(session);
    const answers = [...session.attentionRound!.answers];
    expect(exercise.choose(answers[0])).toMatchObject({
      correct: true,
      complete: false,
    });
    expect(session.trials).toHaveLength(0);
    const recovered = structuredClone(session);
    recovered.status = "interrupted";
    const restored = new AttentionExercise(recovered);
    restored.initialize();
    expect(restored.choose(answers[1])).toBeNull();
    expect(recovered.attentionRound?.selected).toEqual([answers[0]]);
    recovered.status = "running";
    restored.choose(answers[1]);
    expect(restored.choose(answers[2])).toMatchObject({
      correct: true,
      complete: true,
    });
    expect(recovered.trials).toHaveLength(1);
    expect(restored.choose(answers[2])).toBeNull();
  });

  it("counts a number round only after every number is selected, ignores duplicate selections", () => {
    const session = attentionSession("sequence", { sequenceItems: 4 });
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    ready(session);
    const answers = [...session.attentionRound!.answers];
    expect(exercise.choose(answers[0])).toMatchObject({ complete: false });
    expect(exercise.choose(answers[0])).toBeNull();
    expect(session.attentionRound?.selected).toHaveLength(1);
    answers.slice(1).forEach((choice) => exercise.choose(choice));
    expect(session.trials).toHaveLength(1);
    expect(session.trials[0].correct).toBe(true);
  });

  it("accepts remembered locations in any order and rejects duplicate taps", () => {
    const session = attentionSession("memory", {
      recallTask: "Locations",
      recallItems: 3,
    });
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    ready(session);
    const answers = [...session.attentionRound!.answers].reverse();
    exercise.choose(answers[0]);
    expect(exercise.choose(answers[0])).toBeNull();
    answers.slice(1).forEach((choice) => exercise.choose(choice));
    expect(session.trials[0].correct).toBe(true);
  });

  it("provides unique number choices even with a constant random source", () => {
    for (const random of [() => 0, () => 0.5, () => 0.999999]) {
      const session = attentionSession("memory", {
        recallTask: "Digits",
        recallItems: 4,
      });
      const round = createAttentionRound(session, random);
      expect(new Set(round.choices).size).toBe(4);
      expect(round.choices[round.answers[0]]).toBe(round.items[0]);
      expect(round.items[0]).toBeGreaterThanOrEqual(1000);
    }
  });

  it.each(["Count", "Match", "Moving"] as const)(
    "generates unambiguous %s answers",
    (searchTask) => {
      for (let seed = 1; seed <= 50; seed++) {
        const session = attentionSession("search", { searchTask });
        const round = createAttentionRound(session, () => seed / 51);
        const matches = round.items.filter(
          (value) => value === round.cue,
        ).length;
        if (searchTask === "Match") {
          expect(matches).toBe(1);
          expect(round.items[round.answers[0]]).toBe(round.cue);
        } else expect(round.choices[round.answers[0]]).toBe(matches);
      }
    },
  );

  it("retains sustained progression and error support for the other attention activities", () => {
    const session = attentionSession("search", { searchTask: "Count" });
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    for (let index = 0; index < 4; index++) complete(session, exercise);
    expect(session.difficulty).toBe(0);
    expect(complete(session, exercise)?.levelUp).toBe(true);
    expect(session.difficulty).toBe(1);
    for (let index = 0; index < 5; index++) complete(session, exercise);
    expect(session.difficulty).toBe(2);
    for (let index = 0; index < 7; index++) complete(session, exercise);
    expect(session.difficulty).toBe(2);
    complete(session, exercise);
    expect(session.difficulty).toBe(3);
    complete(session, exercise, false);
    complete(session, exercise, false);
    expect(session.difficulty).toBe(2);
    expect(session.trials.filter((trial) => trial.correct)).toHaveLength(18);
  });

  it("records replays, resets partial answers, and does not progress from replayed rounds", () => {
    const session = attentionSession("sequence", { sequenceItems: 4 });
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    ready(session);
    exercise.choose(session.attentionRound!.answers[0]);
    const seed = session.attentionRound!.seed;
    expect(exercise.replay()).toBe(true);
    expect(session.attentionRound?.seed).toBe(seed);
    expect(session.attentionRound?.selected).toEqual([]);
    expect(attentionPhase(session)).toBe("cue");
    complete(session, exercise);
    for (let index = 0; index < 7; index++) {
      exercise.replay();
      complete(session, exercise);
    }
    expect(session.trials).toHaveLength(8);
    expect(
      session.trials.every((trial) => trial.attention?.replays === 1),
    ).toBe(true);
    expect(session.difficulty).toBe(0);
  });

  it.each([NaN, Infinity, -1, 0.5, 10000])(
    "ignores invalid answer %s",
    (choice) => {
      const session = attentionSession("tracking");
      const exercise = new AttentionExercise(session);
      exercise.initialize();
      ready(session);
      expect(exercise.choose(choice)).toBeNull();
      expect(session.trials).toHaveLength(0);
    },
  );

  it.each([
    [320, 150],
    [390, 360],
    [812, 160],
  ])(
    "keeps shuffled objects separated and inside a %s × %s stage",
    (width, height) => {
      for (let objects = 3; objects <= 6; objects++) {
        const session = attentionSession("tracking", {
          trackingObjects: objects,
          trackingSeconds: 12,
        });
        const round = createAttentionRound(session, () => 0.321);
        for (let milliseconds = 0; milliseconds < 15000; milliseconds += 50) {
          const points = attentionPositions(round, milliseconds, width, height);
          for (const point of points) {
            expect(point.x).toBeGreaterThanOrEqual(24);
            expect(point.x).toBeLessThanOrEqual(width - 24);
            expect(point.y).toBeGreaterThanOrEqual(24);
            expect(point.y).toBeLessThanOrEqual(height - 24);
          }
          for (let first = 0; first < points.length; first++)
            for (let second = first + 1; second < points.length; second++)
              expect(
                Math.hypot(
                  points[first].x - points[second].x,
                  points[first].y - points[second].y,
                ),
              ).toBeGreaterThanOrEqual(48);
        }
      }
    },
  );

  it("validates and clamps extreme configuration without unbounded memory or motion loads", () => {
    const configuration = validate({
      ...defaults,
      trackingObjects: Infinity,
      trackingSeconds: -1,
      searchItems: 999999,
      recallItems: 999,
      recallExposure: 0,
      recallDelay: NaN,
      sequenceItems: -1,
      searchTask: "Unknown" as "Count",
    });
    expect(configuration).toMatchObject({
      trackingObjects: 3,
      trackingSeconds: 2,
      searchItems: 12,
      recallItems: 4,
      recallExposure: 0.8,
      recallDelay: 0.6,
      sequenceItems: 4,
      searchTask: "Mixed",
    });
    expect(validAttentionConfiguration({ ...defaults, recallItems: 1.5 })).toBe(
      false,
    );
    expect(
      validAttentionConfiguration({ ...defaults, recallTask: "Unknown" }),
    ).toBe(false);
    const session = attentionSession("tracking", configuration);
    session.difficulty = maximumAttentionDifficulty;
    const exercise = new AttentionExercise(session);
    exercise.initialize();
    for (let index = 0; index < 12; index++) complete(session, exercise);
    expect(session.difficulty).toBe(maximumAttentionDifficulty);
    expect(session.attentionRound!.items.length).toBeLessThanOrEqual(6);
    expect(
      session.attentionRound!.presentation.trackingMilliseconds,
    ).toBeLessThanOrEqual(12000);
  });
});
