import { it, expect, vi } from "vitest";
import { defaults, initialData, type Session } from "./model";
import { configureCheckIn } from "./check-in";
import { ActiveTimer } from "./timer";
import { recordResponse } from "../exercises/responses";
import { crowdingGeometry } from "../exercises/crowding";
import { parseSavedSetups } from "./saved-setups";
import {
  defaultPracticePreferences,
  parsePracticePreferences,
} from "./practice";
import { comparisonKey } from "../analytics/comparison";
import { checkInGroups } from "../analytics/check-ins";
import {
  backupReminderDue,
  checkDurability,
  requestDurability,
} from "../persistence/durability";
import { mergeBackup, previewBackup } from "../persistence/backup";
const viewport = { width: 350, height: 400, pixelRatio: 2 };
const session = (): Session => ({
  id: "practice",
  kind: "crowding",
  eye: "Left",
  configuration: { ...defaults, duration: 600 },
  startedAt: "2026-10-27T10:00:00Z",
  activeMilliseconds: 0,
  slices: [],
  trials: [],
  status: "paused",
  difficulty: 0,
  protocol: "crowding-spacing-1",
  viewport: { ...viewport, changed: false },
});
it("tightens only spacing in crowded practice and gives support after low accuracy", () => {
  const current = session();
  current.status = "running";
  for (let index = 0; index < 5; index++)
    recordResponse(current, true, 500, viewport);
  expect(current.difficulty).toBe(1);
  const start = crowdingGeometry(current.configuration, 0, viewport),
    next = crowdingGeometry(current.configuration, 1, viewport);
  expect(next.diameter).toBe(start.diameter);
  expect(next.gap).toBeLessThan(start.gap);
  expect(current.trials[0]).toMatchObject({
    stimulusDiameter: start.diameter,
    crowdingSpacing: start.gap,
  });
  for (let index = 0; index < 5; index++)
    recordResponse(current, false, 500, viewport);
  expect(current.difficulty).toBe(0);
  for (const width of [80, 280, 350]) {
    const geometry = crowdingGeometry(
      { ...defaults, size: 120, crowdingSpacing: 3 },
      0,
      { ...viewport, width },
    );
    expect(geometry.diameter * 3 + geometry.gap * 2).toBeLessThanOrEqual(
      width - 32 + 0.001,
    );
  }
});
it("finishes a 12-answer fixed check-in without changing difficulty, while retaining only active time", () => {
  const current = configureCheckIn(session());
  let now = 0;
  const timer = new ActiveTimer(
    current,
    () => now,
    () => new Date("2026-10-27T10:00:12Z"),
  );
  timer.resume();
  now = 1000;
  timer.pause();
  now = 100000;
  timer.resume();
  for (let index = 0; index < 12; index++) {
    now += 1000;
    timer.checkpoint();
    recordResponse(current, index % 2 === 0, 1000, viewport);
    expect(current.difficulty).toBe(0);
  }
  expect(recordResponse(current, true, 1000, viewport)).toBeNull();
  timer.finish();
  expect(current.status).toBe("completed");
  expect(current.activeMilliseconds).toBe(13000);
  expect(current.trials).toHaveLength(12);
  expect(
    new Set(current.trials.map((trial) => trial.crowdingSpacing)).size,
  ).toBe(1);
  const partial = configureCheckIn(session());
  new ActiveTimer(partial, () => 0).finish();
  expect(partial.status).toBe("abandoned");
});
it("compares only complete check-ins under matching recorded conditions", () => {
  const first = configureCheckIn(session());
  first.status = "completed";
  first.trials = Array.from({ length: 12 }, () => ({
    correct: true,
    responseMilliseconds: 800,
    difficulty: 0,
    stimulusDiameter: 28,
    crowdingSpacing: 28,
  }));
  const second = structuredClone(first);
  second.id = "second";
  second.startedAt = "2026-10-28T10:00:00Z";
  second.trials[0].correct = false;
  const resized = structuredClone(first);
  resized.id = "resized";
  resized.viewport!.changed = true;
  const partial = structuredClone(first);
  partial.status = "abandoned";
  partial.trials.pop();
  const adaptive = structuredClone(first);
  delete adaptive.checkIn;
  expect(comparisonKey(first)).not.toBe(comparisonKey(adaptive));
  const groups = checkInGroups([resized, partial, adaptive, second, first]);
  expect(groups).toHaveLength(1);
  expect(groups[0].records.map((record) => record.id)).toEqual([
    "practice",
    "second",
  ]);
  expect(groups[0].results[1].accuracy).toBe(11 / 12);
});
it("validates named setups and migrates the earlier six-exercise preferences", () => {
  const setup = {
    id: "saved",
    name: "Slow horizontal",
    kind: "pursuit",
    configuration: { ...defaults, speed: 0.04 },
  };
  expect(parseSavedSetups([setup])).toEqual([setup]);
  expect(parseSavedSetups([setup, setup])).toBeNull();
  expect(
    parseSavedSetups([
      { ...setup, configuration: { ...defaults, size: Infinity } },
    ]),
  ).toBeNull();
  const legacy = JSON.parse(JSON.stringify(defaultPracticePreferences()));
  delete legacy.setups.crowding;
  expect(
    parsePracticePreferences(legacy)?.setups.crowding.configuration.size,
  ).toBe(44);
});
it("round trips crowded check-ins and named setups while rejecting incomplete completed check-ins", () => {
  const current = configureCheckIn(session());
  current.status = "completed";
  current.trials = Array.from({ length: 12 }, () => ({
    correct: true,
    responseMilliseconds: 500,
    difficulty: 0,
    stimulusDiameter: 28,
    crowdingSpacing: 28,
  }));
  const data = initialData();
  data.sessions = [current];
  data.levels.crowding = 4;
  data.savedSetups = [
    {
      id: "named",
      name: "My symbols",
      kind: "crowding",
      configuration: { ...defaults },
    },
  ];
  const imported = mergeBackup(initialData(), JSON.parse(JSON.stringify(data)));
  expect(imported.sessions[0]).toEqual(current);
  expect(imported.levels.crowding).toBe(4);
  expect(imported.savedSetups).toEqual(data.savedSetups);
  expect(previewBackup(initialData(), data).savedSetups).toBe(1);
  const invalid = structuredClone(data);
  invalid.sessions[0].trials.pop();
  expect(() => mergeBackup(initialData(), invalid)).toThrow();
});
it("reports granted, denied and unavailable durable storage without inventing protection", async () => {
  expect(await checkDurability()).toBe("unsupported");
  expect(
    await requestDurability({
      persisted: async () => false,
      persist: async () => false,
    }),
  ).toBe("best-effort");
  expect(
    await requestDurability({
      persisted: async () => true,
      persist: async () => true,
    }),
  ).toBe("persistent");
  expect(
    await checkDurability({ persisted: vi.fn().mockRejectedValue(Error()) }),
  ).toBe("unsupported");
});
it("offers opt-in backup reminders only after new practice and honors export/snooze timing", () => {
  const data = initialData();
  data.preferences.backupReminder = true;
  data.sessions = [
    { ...session(), activeMilliseconds: 1000, endedAt: "2026-10-27T10:00:00Z" },
  ];
  const now = Date.parse("2026-10-28T10:00:00Z");
  expect(backupReminderDue(data, now)).toBe(true);
  data.lastExportedAt = "2026-10-27T11:00:00Z";
  expect(backupReminderDue(data, now + 10 * 86400000)).toBe(false);
  data.sessions[0].endedAt = "2026-11-05T10:00:00Z";
  expect(backupReminderDue(data, now + 10 * 86400000)).toBe(true);
  data.backupReminderDismissedAt = new Date(now + 9 * 86400000).toISOString();
  expect(backupReminderDue(data, now + 10 * 86400000)).toBe(false);
  data.preferences.backupReminder = false;
  expect(backupReminderDue(data, now + 20 * 86400000)).toBe(false);
});
