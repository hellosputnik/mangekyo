import {
  initialData,
  names,
  validate,
  pursuitPatterns,
  type Data,
  type Session,
  type Routine,
  type Measurement,
  type StatisticsReset,
} from "../engine/model";
import { visualDifficultyLimit } from "../exercises/visual";
import { alignmentDifficultyLimit } from "../exercises/alignment";
import { parsePracticePreferences } from "../engine/practice";
import { parseSavedSetups } from "../engine/saved-setups";
import { balanceRules, type AdaptiveBalance } from "../adaptive/balance";
import {
  maximumTouchLevel,
  followLevelGoalMilliseconds,
  highestTouchLevel,
} from "../exercises/touch-challenge";
const difficultyLimit = (kind: unknown) =>
  kind === "alignment"
    ? alignmentDifficultyLimit
    : kind === "crowding"
      ? 24
      : kind === "visual"
        ? visualDifficultyLimit
        : kind === "tap" || kind === "follow"
          ? maximumTouchLevel
          : 12;
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
const eye = (value: unknown) =>
  ["Left", "Right", "Both"].includes(String(value));
function validBalance(
  value: unknown,
  elapsed = 3600000,
): value is AdaptiveBalance {
  return (
    record(value) &&
    value.version === 1 &&
    finite(value.load, 0, balanceRules.maximumLoad) &&
    finite(value.step, balanceRules.minimumStep, balanceRules.initialStep) &&
    ["calibrating", "personalized"].includes(String(value.phase)) &&
    [-1, 0, 1].includes(Number(value.direction)) &&
    typeof value.direction === "number" &&
    ["reversals", "windows", "strongWindows", "samples", "successes"].every(
      (key) => finite(value[key], 0, 1000000) && Number.isInteger(value[key]),
    ) &&
    finite(value.strongWindows, 0, 1) &&
    finite(value.samples, 0, balanceRules.tapWindow - 1) &&
    finite(value.successes, 0, Number(value.samples)) &&
    (value.lastPerformance === null || finite(value.lastPerformance, 0, 1)) &&
    Array.isArray(value.history) &&
    value.history.length <= 1000 &&
    value.history.every(
      (item) =>
        record(item) &&
        finite(item.activeMilliseconds, 0, elapsed) &&
        (item.performance === null || finite(item.performance, 0, 1)) &&
        finite(item.fromLoad, 0, balanceRules.maximumLoad) &&
        finite(item.toLoad, 0, balanceRules.maximumLoad),
    )
  );
}
function validTouchProfiles(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every(
      (profile) =>
        record(profile) &&
        typeof profile.key === "string" &&
        profile.key.length <= 2000 &&
        typeof profile.updatedAt === "string" &&
        Number.isFinite(Date.parse(profile.updatedAt)) &&
        validBalance(profile.balance),
    )
  );
}
function validSession(value: unknown): value is Session {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !Object.hasOwn(names, String(value.kind)) ||
    !eye(value.eye) ||
    typeof value.startedAt !== "string" ||
    !Number.isFinite(Date.parse(value.startedAt)) ||
    !finite(value.activeMilliseconds, 0, 3600000) ||
    !finite(value.difficulty, 0, difficultyLimit(value.kind)) ||
    (["tap", "follow"].includes(String(value.kind)) &&
      !Number.isInteger(value.difficulty)) ||
    !Array.isArray(value.slices) ||
    !Array.isArray(value.trials) ||
    !record(value.configuration)
  )
    return false;
  if (
    !["completed", "abandoned", "interrupted", "paused", "running"].includes(
      String(value.status),
    )
  )
    return false;
  const settings = value.configuration;
  for (const [key, min, max] of [
    ["alignmentOffset", 1, 64],
    ["alignmentGap", 0, 80],
    ["alignmentWidth", 1, 12],
  ] as const) {
    if (settings[key] !== undefined && !finite(settings[key], min, max))
      return false;
  }
  if (
    value.checkIn !== undefined &&
    (!record(value.checkIn) ||
      value.checkIn.version !== 1 ||
      value.checkIn.targetTrials !== 12 ||
      !["visual", "contrast", "crowding", "alignment"].includes(
        String(value.kind),
      ) ||
      value.trials.length > 12 ||
      value.difficulty !== 0 ||
      (value.status === "completed" && value.trials.length !== 12))
  )
    return false;
  if (
    settings.crowdingSpacing !== undefined &&
    !finite(settings.crowdingSpacing, 0.15, 3)
  )
    return false;
  if (
    value.inputMethod !== undefined &&
    !["pointer", "keyboard", "mixed"].includes(String(value.inputMethod))
  )
    return false;
  if (
    value.setupMode !== undefined &&
    !["Default", "Custom"].includes(String(value.setupMode))
  )
    return false;
  if (
    (value.initialDifficulty !== undefined &&
      !finite(value.initialDifficulty, 0, difficultyLimit(value.kind))) ||
    (value.protocol !== undefined &&
      (typeof value.protocol !== "string" || value.protocol.length > 100)) ||
    (value.viewport !== undefined &&
      (!record(value.viewport) ||
        !finite(value.viewport.width, 1, 100000) ||
        !finite(value.viewport.height, 1, 100000) ||
        !finite(value.viewport.pixelRatio, 1, 3) ||
        typeof value.viewport.changed !== "boolean"))
  )
    return false;
  if (
    (settings.tapPaceSeconds !== undefined &&
      !finite(settings.tapPaceSeconds, 1, 10)) ||
    (settings.gentleMotion !== undefined &&
      typeof settings.gentleMotion !== "boolean")
  )
    return false;
  if (value.challenge !== undefined) {
    const challenge = value.challenge;
    if (
      !["tap", "follow"].includes(String(value.kind)) ||
      !record(challenge) ||
      ![1, 2, 3].includes(Number(challenge.version)) ||
      typeof challenge.version !== "number" ||
      (challenge.version === 3 &&
        !validBalance(challenge.balance, value.activeMilliseconds)) ||
      (challenge.balance !== undefined &&
        !validBalance(challenge.balance, value.activeMilliseconds)) ||
      typeof challenge.mastered !== "boolean" ||
      !["startingLevel", "highestLevel"].every(
        (key) =>
          finite(challenge[key], 0, maximumTouchLevel) &&
          Number.isInteger(challenge[key]),
      ) ||
      !["levelUps", "streak", "chain", "bestChain", "misses"].every(
        (key) =>
          finite(challenge[key], 0, 1000000) &&
          Number.isInteger(challenge[key]),
      ) ||
      !finite(challenge.streak, 0, 4) ||
      !finite(
        challenge.progressMilliseconds,
        0,
        followLevelGoalMilliseconds + 32,
      ) ||
      !finite(challenge.outsideMilliseconds, 0, 5000) ||
      !finite(challenge.motionSeconds, 0, 14400) ||
      !Array.isArray(challenge.achievements) ||
      !challenge.achievements.every(
        (item) =>
          record(item) &&
          ["level-up", "level-down", "mastered"].includes(String(item.kind)) &&
          finite(item.level, 0, maximumTouchLevel) &&
          Number.isInteger(item.level) &&
          finite(
            item.activeMilliseconds,
            0,
            value.activeMilliseconds as number,
          ),
      )
    )
      return false;
  }
  if (
    (settings.touchTolerance !== undefined &&
      !finite(settings.touchTolerance, 44, 160)) ||
    (settings.hand !== undefined &&
      settings.hand !== "Left" &&
      settings.hand !== "Right") ||
    (value.awaitingTouch !== undefined &&
      typeof value.awaitingTouch !== "boolean")
  )
    return false;
  if (
    value.tapState !== undefined &&
    (!record(value.tapState) ||
      !finite(value.tapState.x, 0, 1) ||
      !finite(value.tapState.y, 0, 1) ||
      !finite(
        value.tapState.presentedAtMilliseconds,
        0,
        value.activeMilliseconds,
      ))
  )
    return false;
  if (
    record(value.tapState) &&
    value.tapState.expired !== undefined &&
    typeof value.tapState.expired !== "boolean"
  )
    return false;
  if (value.follow !== undefined) {
    const metrics = value.follow;
    if (
      !record(metrics) ||
      !finite(metrics.trackedMilliseconds, 0, value.activeMilliseconds + 1) ||
      !finite(metrics.onTargetMilliseconds, 0, metrics.trackedMilliseconds) ||
      !finite(metrics.distanceWeightedMilliseconds, 0, 1e12) ||
      !finite(metrics.bestRunMilliseconds, 0, metrics.onTargetMilliseconds) ||
      !finite(metrics.currentRunMilliseconds, 0, metrics.bestRunMilliseconds) ||
      !finite(metrics.windowMilliseconds, 0, 10000) ||
      !finite(metrics.windowOnTargetMilliseconds, 0, metrics.windowMilliseconds)
    )
      return false;
  }
  if (
    ![
      "duration",
      "size",
      "speed",
      "contrast",
      "complexity",
      "exposure",
      "jumpPause",
      "jumpDistance",
      "distance",
    ].every(
      (key) =>
        typeof settings[key] === "number" && Number.isFinite(settings[key]),
    )
  )
    return false;
  if (
    !pursuitPatterns.some((pattern) => pattern === settings.pattern) ||
    (settings.pursuitPreset !== undefined &&
      settings.pursuitPreset !== "Custom" &&
      !pursuitPatterns.some((pattern) => pattern === settings.pursuitPreset)) ||
    !["Opening", "Orientation", "Shape"].includes(String(settings.stimulus)) ||
    !["Grating", "Shape"].includes(String(settings.contrastStimulus)) ||
    typeof settings.tapConfirm !== "boolean" ||
    ![settings.foreground, settings.background].every(
      (color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color),
    )
  )
    return false;
  if (
    !value.slices.every(
      (slice) =>
        record(slice) &&
        typeof slice.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(slice.date) &&
        typeof slice.timezone === "string" &&
        finite(slice.offset, -840, 840) &&
        finite(slice.milliseconds, 0, 3600000),
    )
  )
    return false;
  if (
    Math.abs(
      value.slices.reduce((sum, slice) => sum + slice.milliseconds, 0) -
        value.activeMilliseconds,
    ) > 1
  )
    return false;
  return value.trials.every(
    (trial) =>
      record(trial) &&
      typeof trial.correct === "boolean" &&
      finite(trial.responseMilliseconds, 0, 3600000) &&
      finite(trial.difficulty, 0, difficultyLimit(value.kind)) &&
      (trial.stimulusDiameter === undefined ||
        finite(trial.stimulusDiameter, 0.1, 1000)) &&
      (trial.touchDistance === undefined ||
        finite(trial.touchDistance, 0, 100000)) &&
      (trial.touchTolerance === undefined ||
        finite(trial.touchTolerance, 44, 160)) &&
      (trial.qualified === undefined || typeof trial.qualified === "boolean") &&
      (trial.timeLimitMilliseconds === undefined ||
        finite(trial.timeLimitMilliseconds, 1, 10000)) &&
      (trial.precisionRadius === undefined ||
        finite(trial.precisionRadius, 1, 80)) &&
      (trial.adaptiveLoad === undefined ||
        finite(trial.adaptiveLoad, 0, balanceRules.maximumLoad)) &&
      (trial.crowdingSpacing === undefined ||
        finite(trial.crowdingSpacing, 0, 1000)) &&
      (trial.alignmentOffset === undefined ||
        finite(trial.alignmentOffset, 1 / 3, 64)) &&
      (trial.alignmentGap === undefined || finite(trial.alignmentGap, 0, 80)) &&
      (trial.alignmentWidth === undefined ||
        finite(trial.alignmentWidth, 1 / 3, 12)) &&
      (trial.alignmentLength === undefined ||
        finite(trial.alignmentLength, 1 / 3, 120)) &&
      (value.kind !== "alignment" ||
        (finite(trial.alignmentOffset, 1 / 3, 64) &&
          finite(trial.alignmentGap, 0, 80) &&
          finite(trial.alignmentWidth, 1 / 3, 12) &&
          finite(trial.alignmentLength, 1 / 3, 120))) &&
      (value.kind !== "crowding" ||
        (finite(trial.crowdingSpacing, 0, 1000) &&
          finite(trial.stimulusDiameter, 1, 120))) &&
      (value.checkIn === undefined || trial.difficulty === 0),
  );
}
function validMeasurement(value: unknown): value is Measurement {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.date === "string" &&
    eye(value.eye) &&
    typeof value.method === "string" &&
    typeof value.value === "string"
  );
}
function validStatisticsReset(value: unknown): value is StatisticsReset {
  return (
    record(value) &&
    typeof value.resetAt === "string" &&
    Number.isFinite(Date.parse(value.resetAt)) &&
    Array.isArray(value.sessions) &&
    value.sessions.every(validSession) &&
    (value.touchProfiles === undefined ||
      validTouchProfiles(value.touchProfiles)) &&
    (value.measurements === undefined ||
      (Array.isArray(value.measurements) &&
        value.measurements.every(validMeasurement))) &&
    (value.levels === undefined ||
      (record(value.levels) &&
        Object.keys(names).every(
          (kind) =>
            (["tap", "follow", "crowding", "alignment"].includes(kind) &&
              (value.levels as Record<string, unknown>)[kind] === undefined) ||
            finite(
              (value.levels as Record<string, unknown>)[kind],
              0,
              difficultyLimit(kind),
            ),
        )))
  );
}
export function mergeBackup(
  current: Data,
  input: unknown,
  options: { restorePreferences?: boolean } = {},
): Data {
  if (
    !record(input) ||
    !Array.isArray(input.sessions) ||
    !input.sessions.every(validSession)
  )
    throw Error("Invalid sessions");
  const practice =
    record(input) && input.practice !== undefined
      ? parsePracticePreferences(input.practice)
      : null;
  if (input.practice !== undefined && !practice)
    throw Error("Invalid practice settings");
  const savedSetups =
    input.savedSetups === undefined ? [] : parseSavedSetups(input.savedSetups);
  if (!savedSetups) throw Error("Invalid saved setups");
  if (
    input.lastExportedAt !== undefined &&
    (typeof input.lastExportedAt !== "string" ||
      !Number.isFinite(Date.parse(input.lastExportedAt)))
  )
    throw Error("Invalid export date");
  const sessions: Session[] = [...input.sessions];
  const importedTouchLevels = { tap: 0, follow: 0 };
  let importedCrowdingLevel = 0;
  let importedAlignmentLevel = 0;
  if (input.levels !== undefined) {
    if (!record(input.levels)) throw Error("Invalid levels");
    importedAlignmentLevel = Number(input.levels.alignment ?? 0);
    if (
      !finite(input.levels.alignment ?? 0, 0, alignmentDifficultyLimit) ||
      !Number.isInteger(importedAlignmentLevel)
    )
      throw Error("Invalid alignment level");
    importedCrowdingLevel = Number(input.levels.crowding ?? 0);
    if (
      !finite(input.levels.crowding ?? 0, 0, 24) ||
      !Number.isInteger(importedCrowdingLevel)
    )
      throw Error("Invalid crowding level");
    for (const kind of ["tap", "follow"] as const) {
      const level = input.levels[kind] ?? 0;
      if (!finite(level, 0, maximumTouchLevel) || !Number.isInteger(level))
        throw Error("Invalid touch level");
      importedTouchLevels[kind] = level;
    }
  }
  if (
    input.touchProfiles !== undefined &&
    !validTouchProfiles(input.touchProfiles)
  )
    throw Error("Invalid adaptive profiles");
  if (
    input.statisticsReset !== undefined &&
    !validStatisticsReset(input.statisticsReset)
  )
    throw Error("Invalid statistics undo copy");
  const statisticsReset = input.statisticsReset
    ? {
        ...input.statisticsReset,
        ...(input.statisticsReset.levels
          ? {
              levels: {
                ...initialData().levels,
                ...input.statisticsReset.levels,
              },
            }
          : {}),
        sessions: input.statisticsReset.sessions.map((session) => ({
          ...session,
          configuration: validate(session.configuration),
          status:
            session.status === "running"
              ? ("interrupted" as const)
              : session.status,
        })),
      }
    : undefined;
  if (input.current) {
    if (!validSession(input.current)) throw Error("Invalid recovery");
    sessions.push({ ...input.current, status: "interrupted" });
  }
  const routines = input.routines ?? [];
  if (
    !Array.isArray(routines) ||
    !routines.every(
      (item) =>
        record(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        finite(item.rest, 0, 3600) &&
        typeof item.manual === "boolean" &&
        Array.isArray(item.steps) &&
        item.steps.length > 0 &&
        item.steps.every(
          (step) =>
            record(step) &&
            Object.hasOwn(names, String(step.kind)) &&
            finite(step.duration, 10, 3600),
        ),
    )
  )
    throw Error("Invalid routines");
  const measurements = input.measurements ?? [];
  if (!Array.isArray(measurements) || !measurements.every(validMeasurement))
    throw Error("Invalid measurements");
  const preferences = { ...initialData().preferences };
  if (input.preferences) {
    if (!record(input.preferences)) throw Error("Invalid preferences");
    const language = input.preferences.language;
    if (
      language !== undefined &&
      language !== "system" &&
      language !== "en" &&
      language !== "vi"
    ) {
      throw Error("Invalid language preference");
    }
    preferences.language = language ?? current.preferences.language ?? "system";
    for (const key of ["answerSound", "haptics"] as const) {
      const value = input.preferences[key];
      if (value !== undefined && typeof value !== "boolean")
        throw Error("Invalid practice feedback preference");
      preferences[key] = value ?? current.preferences[key] ?? true;
    }
    if (
      input.preferences.backupReminder !== undefined &&
      typeof input.preferences.backupReminder !== "boolean"
    )
      throw Error("Invalid backup reminder");
    preferences.backupReminder =
      (input.preferences.backupReminder as boolean | undefined) ??
      current.preferences.backupReminder ??
      false;
    for (const key of ["goal", "rest", "reminder"] as const) {
      const maximum = { goal: 240, rest: 3600, reminder: 60 }[key];
      if (!finite(input.preferences[key], key === "goal" ? 1 : 0, maximum))
        throw Error("Invalid preference");
      preferences[key] = input.preferences[key];
    }
    for (const key of [
      "manual",
      "sound",
      "reducedMotion",
      "highContrast",
    ] as const) {
      if (typeof input.preferences[key] !== "boolean")
        throw Error("Invalid preference");
      preferences[key] = input.preferences[key];
    }
  }
  const merge = <T extends { id: string }>(incoming: T[], existing: T[]) => [
    ...new Map(
      [...incoming, ...existing].map((item) => [item.id, item]),
    ).values(),
  ];
  return {
    ...current,
    savedSetups: merge(savedSetups, current.savedSetups ?? []).slice(-30),
    levels: {
      ...current.levels,
      alignment:
        !current.levels.alignment &&
        !current.sessions.some(
          (session) => session.kind === "alignment" && !session.checkIn,
        )
          ? importedAlignmentLevel
          : current.levels.alignment,
      crowding:
        !current.levels.crowding &&
        !current.sessions.some(
          (session) => session.kind === "crowding" && !session.checkIn,
        )
          ? importedCrowdingLevel
          : current.levels.crowding,
      tap: highestTouchLevel(
        sessions.filter((session) => session.kind === "tap"),
        Math.max(current.levels.tap, importedTouchLevels.tap),
      ),
      follow: highestTouchLevel(
        sessions.filter((session) => session.kind === "follow"),
        Math.max(current.levels.follow, importedTouchLevels.follow),
      ),
    },
    touchProfiles: [
      ...new Map(
        [
          ...((input.touchProfiles as NonNullable<Data["touchProfiles"]>) ??
            []),
          ...(current.touchProfiles ?? []),
        ].map((profile) => [profile.key, profile]),
      ).values(),
    ].slice(-100),
    ...(!current.statisticsReset && statisticsReset ? { statisticsReset } : {}),
    preferences:
      options.restorePreferences !== false && input.preferences
        ? preferences
        : current.preferences,
    practice:
      options.restorePreferences !== false && practice
        ? practice
        : current.practice,
    sessions: merge(
      sessions
        .filter((session) => session.id !== current.current?.id)
        .map((session) => ({
          ...session,
          configuration: validate(session.configuration),
          status: session.status === "running" ? "interrupted" : session.status,
        })),
      current.sessions,
    ),
    routines: merge(routines as Routine[], current.routines),
    measurements: merge(measurements as Measurement[], current.measurements),
  };
}

export function previewBackup(current: Data, input: unknown) {
  const merged = mergeBackup(current, input);
  const added = <Item extends { id: string }>(
    before: Item[],
    after: Item[],
  ) => {
    const existing = new Set(before.map((item) => item.id));
    return after.filter((item) => !existing.has(item.id)).length;
  };
  const preferenceChanges = (
    Object.keys(current.preferences) as (keyof Data["preferences"])[]
  ).filter((key) => current.preferences[key] !== merged.preferences[key]);
  return {
    sessions: added(current.sessions, merged.sessions),
    savedSetups: added(current.savedSetups ?? [], merged.savedSetups ?? []),
    routines: added(current.routines, merged.routines),
    measurements: added(current.measurements, merged.measurements),
    preferenceChanges,
    practiceChanged:
      JSON.stringify(current.practice) !== JSON.stringify(merged.practice),
    hasUndo: Boolean(!current.statisticsReset && merged.statisticsReset),
    adaptiveProfiles: (merged.touchProfiles ?? []).filter(
      (profile) =>
        !(current.touchProfiles ?? []).some(
          (existing) => existing.key === profile.key,
        ),
    ).length,
    levelChanges: (["tap", "follow", "crowding", "alignment"] as const).filter(
      (kind) => merged.levels[kind] !== current.levels[kind],
    ),
    merged,
  };
}
