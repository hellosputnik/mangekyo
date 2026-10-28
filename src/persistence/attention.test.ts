import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import {
  attentionKinds,
  defaults,
  initialData,
  type Session,
} from "../engine/model";
import {
  AttentionExercise,
  attentionPhase,
  cueMilliseconds,
} from "../exercises/attention";
import { load, save } from "./store";
import { mergeBackup } from "./backup";
import {
  defaultPracticePreferences,
  parsePracticePreferences,
} from "../engine/practice";
import { comparisonKey, personalBest } from "../analytics/comparison";
import { summarizeAttention } from "../analytics/attention";
import {
  resetStatistics,
  undoStatisticsReset,
} from "../engine/statistics-reset";
import { advanceRoutine } from "../engine/routines";

function session(): Session {
  return {
    id: "attention-recovery",
    kind: "sequence",
    eye: "Left",
    configuration: { ...defaults },
    status: "running",
    startedAt: "2026-10-28T12:00:00Z",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
    protocol: "attention-sequence-1",
    viewport: { width: 390, height: 360, pixelRatio: 3, changed: false },
  };
}
function syncTime(value: Session) {
  value.slices = [
    {
      date: "2026-10-28",
      timezone: "UTC",
      offset: 0,
      milliseconds: value.activeMilliseconds,
    },
  ];
}
function answerRound(value: Session, exercise: AttentionExercise) {
  const round = value.attentionRound!;
  value.activeMilliseconds =
    round.startedAtMilliseconds +
    cueMilliseconds(round) +
    round.presentation.exposureMilliseconds +
    round.presentation.trackingMilliseconds +
    round.presentation.delayMilliseconds +
    2000;
  [...round.answers].forEach((answer) => exercise.choose(answer));
  syncTime(value);
}

it("persists partial selections and requires explicit resume after IndexedDB reload", async () => {
  const data = initialData();
  data.current = session();
  const exercise = new AttentionExercise(data.current);
  exercise.initialize();
  data.current.activeMilliseconds = 2000;
  const choices = [...data.current.attentionRound!.answers];
  exercise.choose(choices[0]);
  syncTime(data.current);
  const snapshot = structuredClone(data.current);
  await save(data);
  const restored = await load();
  expect(restored.current).toEqual({ ...snapshot, status: "interrupted" });
  const next = new AttentionExercise(restored.current!);
  next.initialize();
  expect(next.choose(choices[1])).toBeNull();
  expect(attentionPhase(restored.current!)).toBe("answer");
  restored.current!.status = "running";
  choices.slice(1).forEach((choice) => next.choose(choice));
  expect(restored.current!.trials).toHaveLength(1);
  expect(restored.current!.activeMilliseconds).toBe(2000);
});

it("adds new modes to legacy practice settings without discarding previous choices", () => {
  const legacy = defaultPracticePreferences();
  legacy.kind = "saccades";
  legacy.eye = "Right";
  legacy.setups.saccades.configuration.size = 72;
  const input = JSON.parse(JSON.stringify(legacy));
  for (const kind of attentionKinds) delete input.setups[kind];
  const parsed = parsePracticePreferences(input)!;
  expect(parsed.kind).toBe("saccades");
  expect(parsed.eye).toBe("Right");
  expect(parsed.setups.saccades.configuration.size).toBe(72);
  for (const kind of attentionKinds)
    expect(parsed.setups[kind].mode).toBe("Default");
});

it("exports and imports all attention variants with task conditions and saved levels", () => {
  const data = initialData();
  const value = session();
  value.kind = "memory";
  const exercise = new AttentionExercise(value);
  exercise.initialize();
  for (let index = 0; index < 8; index++) answerRound(value, exercise);
  value.status = "abandoned";
  data.sessions.push(value);
  data.levels.memory = 7;
  data.practice = defaultPracticePreferences();
  data.practice.kind = "memory";
  const exported = JSON.parse(JSON.stringify(data));
  const imported = mergeBackup(initialData(), exported);
  expect(imported.sessions).toEqual(data.sessions);
  expect(imported.levels.memory).toBe(7);
  expect(imported.practice?.kind).toBe("memory");
  expect(
    summarizeAttention(imported.sessions[0]).map((result) => result.task),
  ).toEqual(["Locations", "Digits", "Directions", "Compare"]);
  expect(mergeBackup(imported, exported).sessions).toHaveLength(1);
  const reset = resetStatistics(imported, {
    difficulty: true,
    measurements: false,
  });
  expect(reset.levels.memory).toBe(0);
  expect(undoStatisticsReset(reset).levels.memory).toBe(7);
});

it("rejects corrupt task state, invalid settings, mismatched tasks and impossible levels on import", () => {
  const value = session();
  const exercise = new AttentionExercise(value);
  exercise.initialize();
  answerRound(value, exercise);
  value.status = "abandoned";
  const data = initialData();
  data.sessions.push(value);
  for (const corrupt of [
    (copy: typeof data) => {
      copy.sessions[0].attentionRound!.seed = NaN;
    },
    (copy: typeof data) => {
      copy.sessions[0].configuration.recallExposure = 0.1;
    },
    (copy: typeof data) => {
      copy.sessions[0].trials[0].attention!.task = "Digits";
    },
    (copy: typeof data) => {
      copy.sessions[0].trials[0].attention!.itemCount = 100000;
    },
    (copy: typeof data) => {
      copy.levels.memory = 100000;
    },
  ]) {
    const copy = structuredClone(data);
    corrupt(copy);
    expect(() => mergeBackup(initialData(), copy)).toThrow();
  }
});

it("separates comparison conditions and excludes replayed rounds from personal bests", () => {
  const value = session();
  value.kind = "search";
  value.configuration.searchTask = "Count";
  const exercise = new AttentionExercise(value);
  exercise.initialize();
  for (let index = 0; index < 5; index++) answerRound(value, exercise);
  value.status = "abandoned";
  expect(personalBest([value])?.count).toBe(5);
  const changed = structuredClone(value);
  changed.configuration.searchTask = "Match";
  expect(comparisonKey(value)).not.toBe(comparisonKey(changed));
  value.trials.forEach((trial) => {
    trial.attention!.replays = 1;
  });
  expect(personalBest([value])).toBeNull();
});

it("runs all four activities through existing routine advancement and retains partial results", () => {
  const data = initialData();
  data.run = {
    index: 0,
    eye: "Left",
    routine: {
      id: "attention-routine",
      name: "Attention",
      steps: attentionKinds.map((kind) => ({ kind, duration: 60 })),
      rest: 60,
      manual: false,
    },
  };
  for (const kind of attentionKinds) {
    expect(data.run?.routine.steps[data.run.index].kind).toBe(kind);
    const value = session();
    value.id = kind;
    value.kind = kind;
    const exercise = new AttentionExercise(value);
    exercise.initialize();
    answerRound(value, exercise);
    value.status = "abandoned";
    data.sessions.push(value);
    advanceRoutine(data);
  }
  expect(data.run).toBeNull();
  expect(data.sessions).toHaveLength(4);
  expect(
    data.sessions.every(
      (value) => value.activeMilliseconds > 0 && value.trials.length === 1,
    ),
  ).toBe(true);
});
