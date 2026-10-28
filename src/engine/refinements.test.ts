import { expect, it } from "vitest";
import { defaults, exerciseKinds, initialData, type Session } from "./model";
import {
  defaultPracticePreferences,
  parsePracticePreferences,
  updatePracticeSetting,
} from "./practice";
import { createRehearsal } from "./rehearsal";
import { TouchExercise } from "../exercises/touch";
import { sessionRecap } from "../analytics/recap";
import { totalForDate } from "../analytics/totals";
import { mergeBackup, previewBackup } from "../persistence/backup";
it("round trips all custom setups and eye choices without sharing mutable configurations", () => {
  const choices = defaultPracticePreferences();
  choices.kind = "saccades";
  choices.eye = "Right";
  choices.setups = updatePracticeSetting(
    choices.setups,
    "saccades",
    "duration",
    155,
  );
  choices.setups.saccades.mode = "Custom";
  const parsed = parsePracticePreferences(JSON.parse(JSON.stringify(choices)))!;
  expect(parsed).toEqual(choices);
  parsed.setups.saccades.configuration.size = 90;
  expect(choices.setups.saccades.configuration.size).toBe(28);
  expect(parsePracticePreferences({ ...choices, eye: "unknown" })).toBeNull();
  choices.setups.saccades.configuration.duration = Infinity;
  expect(parsePracticePreferences(choices)).toBeNull();
});
it.each(exerciseKinds)(
  "keeps %s rehearsal isolated from saved time, setup, levels and profiles",
  (kind) => {
    const data = initialData();
    const before = structuredClone(data);
    const configuration = { ...defaults, contrast: 0.03, size: 8, speed: 1 };
    const rehearsal = createRehearsal(kind, configuration, true);
    rehearsal.activeMilliseconds = 10000;
    if (kind === "tap" || kind === "follow") {
      const exercise = new TouchExercise(rehearsal);
      exercise.initialize();
      exercise.setViewport(350, 400);
      exercise.terminate();
    }
    expect(rehearsal.configuration).toMatchObject({
      contrast: 0.7,
      gentleMotion: true,
    });
    expect(configuration).toMatchObject({ contrast: 0.03, size: 8, speed: 1 });
    expect(data).toEqual(before);
    expect(totalForDate(data)).toBe(0);
  },
);
it.each(exerciseKinds)(
  "retains partial time and meaningful %s recap without a clinical score",
  (kind) => {
    const record: Session = {
      id: "partial",
      kind,
      eye: "Left",
      configuration: { ...defaults },
      status: "abandoned",
      startedAt: "2026-10-27T10:00:00Z",
      activeMilliseconds: 23456,
      slices: [],
      trials: [{ correct: true, difficulty: 1, responseMilliseconds: 500 }],
      difficulty: 1,
    };
    const result = sessionRecap(record);
    expect(result.activeMilliseconds).toBe(23456);
    expect(result.plannedMilliseconds).toBe(300000);
    expect(result.completed).toBe(false);
    if (
      kind === "visual" ||
      kind === "contrast" ||
      kind === "tap" ||
      kind === "crowding"
    )
      expect(result.accuracy).toBe(1);
    else expect(result.accuracy).toBeNull();
  },
);
it("previews a deduplicated import without mutating data, with an explicit preference opt out", () => {
  const current = initialData();
  current.practice = defaultPracticePreferences();
  current.lastExportedAt = "2026-10-27T10:00:00Z";
  const backup = structuredClone(current);
  backup.preferences.goal = 60;
  backup.practice!.eye = "Right";
  backup.measurements = [
    {
      id: "m",
      date: "2026-10-26",
      eye: "Left",
      method: "Snellen",
      value: "20/40",
    },
  ];
  const before = structuredClone(current);
  const preview = previewBackup(current, backup);
  expect(preview.measurements).toBe(1);
  expect(preview.preferenceChanges).toEqual(["goal"]);
  expect(preview.practiceChanged).toBe(true);
  expect(current).toEqual(before);
  const recordsOnly = mergeBackup(current, backup, {
    restorePreferences: false,
  });
  expect(recordsOnly.preferences.goal).toBe(30);
  expect(recordsOnly.practice?.eye).toBe("Left");
  expect(recordsOnly.measurements).toHaveLength(1);
  const restored = mergeBackup(current, backup);
  expect(restored.preferences.goal).toBe(60);
  expect(restored.practice?.eye).toBe("Right");
  expect(restored.lastExportedAt).toBe(current.lastExportedAt);
  expect(previewBackup(restored, backup).measurements).toBe(0);
  expect(() =>
    previewBackup(current, { ...backup, practice: { eye: "invalid" } }),
  ).toThrow();
});
it("preserves comparison metadata in backups and rejects malformed geometry or input methods", () => {
  const data = initialData();
  data.sessions = [
    {
      id: "metadata",
      kind: "tap",
      eye: "Right",
      configuration: { ...defaults },
      startedAt: "2026-10-27T10:00:00Z",
      status: "abandoned",
      activeMilliseconds: 5000,
      slices: [
        { date: "2026-10-27", timezone: "UTC", offset: 0, milliseconds: 5000 },
      ],
      trials: [],
      difficulty: 0,
      initialDifficulty: 0,
      protocol: "touch-balance-3",
      inputMethod: "keyboard",
      setupMode: "Custom",
      viewport: { width: 350, height: 400, pixelRatio: 2, changed: false },
    },
  ];
  expect(mergeBackup(initialData(), data).sessions[0]).toEqual(
    data.sessions[0],
  );
  const invalid = structuredClone(data);
  invalid.sessions[0].viewport!.pixelRatio = Infinity;
  expect(() => mergeBackup(initialData(), invalid)).toThrow();
  expect(() =>
    mergeBackup(initialData(), {
      ...data,
      sessions: [{ ...data.sessions[0], inputMethod: "other" }],
    }),
  ).toThrow();
});
