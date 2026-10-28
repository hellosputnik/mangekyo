import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { load, save } from "./store";
import { initialData, defaults } from "../engine/model";
import { emptyFollowMetrics } from "../exercises/touch";
import { ensureTouchChallenge } from "../exercises/touch-challenge";
import {
  resetStatistics,
  undoStatisticsReset,
} from "../engine/statistics-reset";
it("persists structured state and recovers running sessions as interrupted", async () => {
  const data = initialData();
  data.current = {
    id: "recovery",
    kind: "visual",
    eye: "Left",
    configuration: defaults,
    startedAt: new Date().toISOString(),
    status: "running",
    activeMilliseconds: 4567,
    slices: [],
    trials: [],
    difficulty: 2,
  };
  await save(data);
  const recovered = await load();
  expect(recovered.current?.status).toBe("interrupted");
  expect(recovered.current?.activeMilliseconds).toBe(4567);
  expect(recovered.current?.difficulty).toBe(2);
});
it("stores a snapshot unaffected by subsequent mutation", async () => {
  const data = initialData();
  const saving = save(data);
  data.preferences.goal = 90;
  await saving;
  expect((await load()).preferences.goal).toBe(30);
});
it("restores the selected language and migrates old preferences to device language", async () => {
  const data = initialData();
  data.preferences.language = "vi";
  await save(data);
  expect((await load()).preferences.language).toBe("vi");
  const { language: ignored, ...preferences } = data.preferences;
  await save({ ...data, preferences } as ReturnType<typeof initialData>);
  const migrated = await load();
  expect(migrated.preferences.language).toBe("system");
  expect(migrated.preferences.goal).toBe(data.preferences.goal);
});
it("keeps a statistics reset and its undo copy through reload", async () => {
  const data = initialData();
  data.sessions = [
    {
      id: "history",
      kind: "pursuit",
      eye: "Left",
      configuration: { ...defaults },
      startedAt: "2026-10-25T12:00:00Z",
      status: "abandoned",
      activeMilliseconds: 3000,
      slices: [],
      trials: [],
      difficulty: 0,
    },
  ];
  const reset = resetStatistics(data, {
    measurements: false,
    difficulty: false,
  });
  await save(reset);
  const reloaded = await load();
  expect(reloaded.sessions).toEqual([]);
  expect(reloaded.statisticsReset?.sessions[0].activeMilliseconds).toBe(3000);
  const restored = undoStatisticsReset(reloaded);
  await save(restored);
  expect((await load()).sessions).toEqual(data.sessions);
  expect((await load()).statisticsReset).toBeUndefined();
});
it("recovers continuous difficulty, target sizes and optional answer sound without replaying answers", async () => {
  const data = initialData();
  data.preferences.answerSound = true;
  data.current = {
    id: "continuous",
    kind: "visual",
    eye: "Left",
    configuration: { ...defaults },
    startedAt: "2026-10-26T10:00:00Z",
    status: "running",
    activeMilliseconds: 1000,
    slices: [],
    difficulty: 34,
    trials: [
      {
        correct: true,
        difficulty: 33,
        responseMilliseconds: 1000,
        stimulusDiameter: 12.5,
      },
    ],
  };
  await save(data);
  const recovered = await load();
  expect(recovered.current?.status).toBe("interrupted");
  expect(recovered.current?.difficulty).toBe(34);
  expect(recovered.current?.trials).toEqual(data.current.trials);
  expect(recovered.preferences.answerSound).toBe(true);
  const { answerSound: ignored, ...legacyPreferences } = data.preferences;
  await save({ ...data, preferences: legacyPreferences } as ReturnType<
    typeof initialData
  >);
  expect((await load()).preferences.answerSound).toBe(true);
});
it("defaults new feedback to enabled while retaining saved sound and haptic choices", async () => {
  expect(initialData().preferences).toMatchObject({
    answerSound: true,
    haptics: true,
  });
  const data = initialData();
  data.preferences.answerSound = false;
  data.preferences.haptics = false;
  await save(data);
  expect((await load()).preferences).toMatchObject({
    answerSound: false,
    haptics: false,
  });
  const { haptics: ignored, ...legacyPreferences } = data.preferences;
  await save({ ...data, preferences: legacyPreferences } as ReturnType<
    typeof initialData
  >);
  expect((await load()).preferences).toMatchObject({
    answerSound: false,
    haptics: true,
  });
});
it("recovers following as interrupted without a held finger and migrates older exercise settings and levels", async () => {
  const data = initialData();
  data.current = {
    id: "follow",
    kind: "follow",
    eye: "Left",
    configuration: { ...defaults },
    startedAt: "2026-10-26T12:00:00Z",
    status: "running",
    activeMilliseconds: 2000,
    slices: [],
    trials: [],
    difficulty: 2,
    awaitingTouch: true,
    follow: {
      ...emptyFollowMetrics(),
      trackedMilliseconds: 2000,
      onTargetMilliseconds: 1500,
      bestRunMilliseconds: 1000,
      currentRunMilliseconds: 500,
    },
  };
  const legacy = JSON.parse(JSON.stringify(data));
  delete legacy.levels.tap;
  delete legacy.levels.follow;
  delete legacy.current.configuration.touchTolerance;
  delete legacy.current.configuration.hand;
  await save(legacy);
  const restored = await load();
  expect(restored.current?.status).toBe("interrupted");
  expect(restored.current?.awaitingTouch).toBe(false);
  expect(restored.current?.follow).toMatchObject({
    trackedMilliseconds: 2000,
    onTargetMilliseconds: 1500,
    bestRunMilliseconds: 1000,
    currentRunMilliseconds: 0,
  });
  expect(restored.levels.tap).toBe(0);
  expect(restored.levels.follow).toBe(0);
  expect(restored.current?.configuration.touchTolerance).toBe(72);
  expect(restored.current?.configuration.hand).toBe("Right");
});
it("recovers earned levels and motion phase without carrying an unfinished level run across reload", async () => {
  const data = initialData();
  data.current = {
    id: "earned",
    kind: "follow",
    eye: "Left",
    configuration: { ...defaults },
    startedAt: "2026-10-26T12:00:00Z",
    status: "running",
    activeMilliseconds: 8000,
    slices: [],
    trials: [],
    difficulty: 2,
  };
  const challenge = ensureTouchChallenge(data.current);
  Object.assign(challenge, {
    highestLevel: 4,
    progressMilliseconds: 2500,
    motionSeconds: 9.2,
    levelUps: 2,
  });
  Object.assign(challenge.balance!, {
    load: 12.25,
    phase: "personalized",
    step: 0.25,
    samples: 3,
    successes: 2,
    strongWindows: 1,
  });
  await save(data);
  const recovered = await load();
  expect(recovered.current?.status).toBe("interrupted");
  expect(recovered.current?.difficulty).toBe(2);
  expect(recovered.current?.challenge).toMatchObject({
    highestLevel: 4,
    levelUps: 2,
    progressMilliseconds: 0,
    motionSeconds: 9.2,
    balance: {
      load: 12.25,
      phase: "personalized",
      step: 0.25,
      samples: 0,
      successes: 0,
      strongWindows: 1,
    },
  });
});
it("preserves the last exercise, eye, custom setups and export time through reload", async () => {
  const { defaultPracticePreferences } = await import("../engine/practice");
  const data = initialData();
  data.practice = defaultPracticePreferences();
  data.practice.kind = "contrast";
  data.practice.eye = "Both";
  data.practice.setups.contrast.mode = "Custom";
  data.practice.setups.contrast.configuration.contrast = 0.42;
  data.lastExportedAt = "2026-10-27T10:00:00Z";
  await save(data);
  const restored = await load();
  expect(restored.practice).toEqual(data.practice);
  expect(restored.lastExportedAt).toBe(data.lastExportedAt);
});
it("serializes rapid preference saves so older writes cannot replace the newest choices", async () => {
  const first = initialData();
  const second = initialData();
  const third = initialData();
  first.preferences.goal = 10;
  second.preferences.goal = 20;
  third.preferences.goal = 45;
  await Promise.all([save(first), save(second), save(third)]);
  expect((await load()).preferences.goal).toBe(45);
});
