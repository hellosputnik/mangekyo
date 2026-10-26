import { it, expect } from "vitest";
import { defaults, initialData } from "../engine/model";
import { mergeBackup } from "./backup";
import {
  resetStatistics,
  undoStatisticsReset,
} from "../engine/statistics-reset";
import { recordResponse } from "../exercises/responses";
import { visualDifficultyLimit } from "../exercises/visual";
import { TouchExercise, emptyFollowMetrics } from "../exercises/touch";
import { ensureTouchChallenge } from "../exercises/touch-challenge";
import { createBalance, recordBalanceWindow } from "../adaptive/balance";
import { rememberTouchProfile } from "../engine/touch-profiles";
it("round trips settings, routines, and professional measurements", () => {
  const data = initialData();
  data.preferences.goal = 20;
  data.routines = [
    {
      id: "r",
      name: "Routine",
      steps: [{ kind: "pursuit", duration: 60 }],
      rest: 60,
      manual: false,
    },
  ];
  data.measurements = [
    {
      id: "m",
      date: "2026-10-24",
      eye: "Left",
      method: "Snellen",
      value: "20/40",
    },
  ];
  expect(mergeBackup(initialData(), JSON.parse(JSON.stringify(data)))).toEqual(
    data,
  );
});
it("retains ten-second follow progress in backups and accepts the earlier challenge rules", () => {
  const data = initialData();
  const session = {
    id: "follow-progress",
    kind: "follow" as const,
    eye: "Left" as const,
    configuration: { ...defaults },
    startedAt: "2026-10-26T12:00:00Z",
    status: "abandoned" as const,
    activeMilliseconds: 9000,
    slices: [
      { date: "2026-10-26", timezone: "UTC", offset: 0, milliseconds: 9000 },
    ],
    trials: [],
    difficulty: 0,
  };
  const challenge = ensureTouchChallenge(session);
  challenge.progressMilliseconds = 9000;
  data.sessions = [session];
  const imported = mergeBackup(initialData(), JSON.parse(JSON.stringify(data)));
  expect(imported.sessions[0].challenge).toMatchObject({
    version: 3,
    progressMilliseconds: 9000,
  });
  challenge.version = 1;
  challenge.progressMilliseconds = 5000;
  const legacy = mergeBackup(initialData(), JSON.parse(JSON.stringify(data)));
  expect(legacy.sessions[0].challenge).toMatchObject({
    version: 1,
    progressMilliseconds: 5000,
  });
  const invalid = JSON.parse(JSON.stringify(data));
  invalid.sessions[0].challenge.version = 4;
  expect(() => mergeBackup(initialData(), invalid)).toThrow();
});
it("rejects malformed data without modifying existing records", () => {
  const data = initialData();
  expect(() => mergeBackup(data, { sessions: [{ id: "bad" }] })).toThrow();
  expect(data.sessions).toHaveLength(0);
});
it("round trips personalized tuning and Undo, and rejects invalid adaptation metadata", () => {
  const data = initialData();
  const session = {
    id: "adaptive",
    kind: "tap" as const,
    eye: "Left" as const,
    configuration: { ...defaults },
    startedAt: "2026-10-26T12:00:00Z",
    status: "abandoned" as const,
    activeMilliseconds: 10000,
    slices: [
      { date: "2026-10-26", timezone: "UTC", offset: 0, milliseconds: 10000 },
    ],
    trials: [],
    difficulty: 50,
  };
  const challenge = ensureTouchChallenge(session);
  recordBalanceWindow(challenge.balance!, 1, 10000);
  data.sessions = [session];
  rememberTouchProfile(data, session);
  data.levels.tap = 50;
  const imported = mergeBackup(initialData(), JSON.parse(JSON.stringify(data)));
  expect(imported.touchProfiles).toEqual(data.touchProfiles);
  expect(imported.sessions[0].challenge?.balance).toEqual(challenge.balance);
  expect(imported.sessions[0].difficulty).toBe(50);
  expect(imported.levels.tap).toBe(50);
  const historyCleared = resetStatistics(data, {
    difficulty: false,
    measurements: false,
  });
  const restoredWithoutHistory = mergeBackup(
    initialData(),
    JSON.parse(JSON.stringify(historyCleared)),
  );
  expect(restoredWithoutHistory.levels.tap).toBe(50);
  expect(restoredWithoutHistory.touchProfiles).toEqual(data.touchProfiles);
  const cleared = resetStatistics(data, {
    difficulty: true,
    measurements: false,
  });
  expect(
    undoStatisticsReset(
      mergeBackup(initialData(), JSON.parse(JSON.stringify(cleared))),
    ).touchProfiles,
  ).toEqual(data.touchProfiles);
  const legacy = { ...data };
  delete legacy.touchProfiles;
  expect(mergeBackup(initialData(), legacy).touchProfiles).toEqual([]);
  for (const patch of [
    { load: Infinity },
    { step: 0 },
    { phase: "unknown" },
    { samples: 5 },
    { lastPerformance: 1.1 },
    {
      history: [
        { activeMilliseconds: 11000, performance: 1, fromLoad: 0, toLoad: 4 },
      ],
    },
  ]) {
    const invalid = structuredClone(data);
    Object.assign(invalid.sessions[0].challenge!.balance!, patch);
    expect(() => mergeBackup(initialData(), invalid)).toThrow();
  }
  const invalidProfile = structuredClone(data);
  invalidProfile.touchProfiles![0].balance = { ...createBalance(), load: -1 };
  expect(() => mergeBackup(initialData(), invalidProfile)).toThrow();
  const invalidLevels = structuredClone(data);
  invalidLevels.levels.tap = 1.5;
  expect(() => mergeBackup(initialData(), invalidLevels)).toThrow();
});
it("deduplicates routine records on repeated imports", () => {
  const data = initialData();
  data.routines = [
    {
      id: "r",
      name: "Routine",
      steps: [{ kind: "pursuit", duration: 60 }],
      rest: 60,
      manual: false,
    },
  ];
  expect(mergeBackup(data, data).routines).toHaveLength(1);
});
it("round trips the selected language and accepts older backups without a language field", () => {
  const current = initialData();
  current.preferences.language = "vi";
  expect(mergeBackup(initialData(), current).preferences.language).toBe("vi");
  const { language: ignored, ...legacyPreferences } = initialData().preferences;
  expect(
    mergeBackup(current, { ...initialData(), preferences: legacyPreferences })
      .preferences.language,
  ).toBe("vi");
  expect(() =>
    mergeBackup(current, {
      ...current,
      preferences: { ...current.preferences, language: "invalid" },
    }),
  ).toThrow();
});
it("round trips mixed presets and still accepts legacy single-path sessions", () => {
  const data = initialData();
  data.sessions = [
    {
      id: "mixed",
      kind: "pursuit",
      eye: "Left",
      configuration: { ...defaults },
      startedAt: "2026-10-25T12:00:00Z",
      endedAt: "2026-10-25T12:00:00Z",
      status: "completed",
      activeMilliseconds: 0,
      slices: [],
      trials: [],
      difficulty: 0,
    },
  ];
  expect(
    mergeBackup(initialData(), JSON.parse(JSON.stringify(data))).sessions[0]
      .configuration.pattern,
  ).toBe("Mixed");
  const legacy = structuredClone(data);
  legacy.sessions[0].configuration.pattern = "Figure eight";
  delete legacy.sessions[0].configuration.pursuitPreset;
  expect(
    mergeBackup(initialData(), legacy).sessions[0].configuration.pattern,
  ).toBe("Figure eight");
  const invalid = structuredClone(data);
  invalid.sessions[0].configuration.pursuitPreset = "Invalid" as never;
  expect(() => mergeBackup(initialData(), invalid)).toThrow();
});
it("exports and imports the reset undo copy without restoring it into active statistics", () => {
  const data = initialData();
  data.sessions = [
    {
      id: "archived",
      kind: "visual",
      eye: "Left",
      configuration: { ...defaults },
      startedAt: "2026-10-25T12:00:00Z",
      status: "abandoned",
      activeMilliseconds: 3000,
      slices: [
        {
          date: "2026-10-25",
          timezone: "Asia/Ho_Chi_Minh",
          offset: -420,
          milliseconds: 3000,
        },
      ],
      trials: [],
      difficulty: 1,
    },
  ];
  const reset = resetStatistics(data, { measurements: true, difficulty: true });
  const imported = mergeBackup(
    initialData(),
    JSON.parse(JSON.stringify(reset)),
  );
  expect(imported.sessions).toEqual([]);
  expect(imported.statisticsReset).toEqual(reset.statisticsReset);
  expect(undoStatisticsReset(imported).sessions).toEqual(data.sessions);
  expect(() =>
    mergeBackup(data, {
      ...reset,
      statisticsReset: {
        ...reset.statisticsReset,
        sessions: [{ id: "invalid" }],
      },
    }),
  ).toThrow();
  expect(() =>
    mergeBackup(data, {
      ...reset,
      statisticsReset: { ...reset.statisticsReset, levels: { visual: -1 } },
    }),
  ).toThrow();
});
it("round trips visual progression past level 12, presented sizes, feedback preference, and reset recovery", () => {
  const data = initialData();
  data.preferences.answerSound = true;
  data.current = {
    id: "continuous",
    kind: "visual",
    eye: "Left",
    configuration: { ...defaults },
    startedAt: "2026-10-26T10:00:00Z",
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
  for (let index = 0; index < 35; index++)
    recordResponse(data.current, true, 1000, {
      width: 358,
      height: 320,
      pixelRatio: 3,
    });
  const imported = mergeBackup(initialData(), JSON.parse(JSON.stringify(data)));
  expect(imported.sessions[0].difficulty).toBe(35);
  expect(imported.sessions[0].trials).toEqual(data.current.trials);
  expect(imported.preferences.answerSound).toBe(true);
  data.sessions = [{ ...data.current, status: "abandoned" }];
  data.current = null;
  data.levels.visual = 35;
  const reset = resetStatistics(data, {
    measurements: false,
    difficulty: true,
  });
  expect(
    mergeBackup(initialData(), reset).statisticsReset?.levels?.visual,
  ).toBe(35);
  expect(
    undoStatisticsReset(mergeBackup(initialData(), reset)).levels.visual,
  ).toBe(35);
  const invalid = structuredClone(imported);
  invalid.sessions[0].difficulty = visualDifficultyLimit + 1;
  expect(() => mergeBackup(initialData(), invalid)).toThrow();
  invalid.sessions[0].difficulty = 35;
  invalid.sessions[0].trials[0].stimulusDiameter = NaN;
  expect(() => mergeBackup(initialData(), invalid)).toThrow();
});
it("defaults answer sound off in legacy backups and rejects malformed feedback preferences", () => {
  const data = initialData();
  const { answerSound: ignored, ...legacyPreferences } = data.preferences;
  expect(
    mergeBackup(initialData(), { ...data, preferences: legacyPreferences })
      .preferences.answerSound,
  ).toBe(false);
  expect(() =>
    mergeBackup(initialData(), {
      ...data,
      preferences: { ...data.preferences, answerSound: "yes" },
    }),
  ).toThrow();
});
it("round trips touch metrics, trial geometry, routine steps and a six-exercise reset snapshot", () => {
  const data = initialData();
  const session = {
    id: "tap",
    kind: "tap" as const,
    eye: "Left" as const,
    configuration: { ...defaults },
    startedAt: "2026-10-26T12:00:00Z",
    status: "running" as const,
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
  const exercise = new TouchExercise(session, () => 0.5);
  exercise.initialize();
  exercise.setViewport(390, 500);
  exercise.pointerDown(exercise.targetPoint());
  exercise.pointerUp(exercise.targetPoint());
  data.sessions = [
    { ...session, status: "abandoned" },
    {
      ...session,
      id: "follow",
      kind: "follow",
      trials: [],
      follow: emptyFollowMetrics(),
    },
  ];
  data.routines = [
    {
      id: "touch",
      name: "Touch",
      steps: [
        { kind: "tap", duration: 60 },
        { kind: "follow", duration: 60 },
      ],
      rest: 30,
      manual: false,
    },
  ];
  const imported = mergeBackup(initialData(), JSON.parse(JSON.stringify(data)));
  expect(imported.sessions[0].trials).toEqual(data.sessions[0].trials);
  expect(imported.sessions[1].follow).toEqual(emptyFollowMetrics());
  expect(imported.routines).toEqual(data.routines);
  data.levels.tap = 3;
  data.levels.follow = 4;
  const reset = resetStatistics(data, {
    difficulty: true,
    measurements: false,
  });
  expect(
    undoStatisticsReset(mergeBackup(initialData(), reset)).levels,
  ).toMatchObject({ tap: 3, follow: 4 });
  const invalid = structuredClone(data);
  invalid.sessions[1].follow!.trackedMilliseconds = 100000;
  expect(() => mergeBackup(initialData(), invalid)).toThrow();
  invalid.sessions[1].follow = emptyFollowMetrics();
  invalid.sessions[0].trials[0].touchDistance = NaN;
  expect(() => mergeBackup(initialData(), invalid)).toThrow();
});
it("imports four-exercise legacy backups without losing records or reset recovery", () => {
  const data = initialData();
  data.sessions = [
    {
      id: "old",
      kind: "pursuit",
      eye: "Left",
      configuration: { ...defaults },
      startedAt: "2026-10-25T12:00:00Z",
      status: "abandoned",
      activeMilliseconds: 0,
      slices: [],
      trials: [],
      difficulty: 0,
    },
  ];
  const legacy = JSON.parse(
    JSON.stringify(
      resetStatistics(data, { difficulty: true, measurements: false }),
    ),
  );
  delete legacy.statisticsReset.levels.tap;
  delete legacy.statisticsReset.levels.follow;
  delete legacy.statisticsReset.sessions[0].configuration.touchTolerance;
  delete legacy.statisticsReset.sessions[0].configuration.hand;
  const imported = mergeBackup(initialData(), legacy);
  expect(imported.statisticsReset?.levels?.follow).toBe(0);
  expect(undoStatisticsReset(imported).sessions[0].id).toBe("old");
});
it("round trips earned touch levels beyond 12 and the exact challenge conditions and achievements", () => {
  const data = initialData();
  const session = {
    id: "levels",
    kind: "tap" as const,
    eye: "Left" as const,
    configuration: { ...defaults },
    startedAt: "2026-10-26T12:00:00Z",
    status: "running" as const,
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
  const exercise = new TouchExercise(session, () => 0.5);
  exercise.initialize();
  exercise.setViewport(390, 500);
  for (let hit = 0; hit < 75; hit++) {
    session.activeMilliseconds += 300;
    exercise.update(session.activeMilliseconds / 1000);
    const target = exercise.targetPoint();
    exercise.pointerDown(target);
    exercise.pointerUp(target);
  }
  data.sessions = [
    {
      ...session,
      status: "abandoned",
      slices: [
        {
          date: "2026-10-26",
          timezone: "UTC",
          offset: 0,
          milliseconds: session.activeMilliseconds,
        },
      ],
    },
  ];
  data.levels.tap = session.difficulty;
  const imported = mergeBackup(initialData(), JSON.parse(JSON.stringify(data)));
  expect(imported.sessions[0].difficulty).toBe(15);
  expect(imported.sessions[0].challenge).toEqual(data.sessions[0].challenge);
  expect(imported.sessions[0].trials[0]).toMatchObject({
    qualified: true,
    timeLimitMilliseconds: 2500,
    precisionRadius: 14,
  });
  const undo = undoStatisticsReset(
    mergeBackup(
      initialData(),
      resetStatistics(data, { difficulty: true, measurements: false }),
    ),
  );
  expect(undo.levels.tap).toBe(15);
  const invalid = JSON.parse(JSON.stringify(data));
  invalid.sessions[0].challenge.achievements[0].level = 1000001;
  expect(() => mergeBackup(initialData(), invalid)).toThrow();
  invalid.sessions[0].challenge = data.sessions[0].challenge;
  invalid.sessions[0].trials[0].timeLimitMilliseconds = -1;
  expect(() => mergeBackup(initialData(), invalid)).toThrow();
});
