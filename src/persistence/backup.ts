import {
  initialData,
  names,
  validate,
  type Data,
  type Session,
  type Routine,
  type Measurement,
} from "../engine/model";
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
const eye = (value: unknown) =>
  ["Left", "Right", "Both"].includes(String(value));
function validSession(value: unknown): value is Session {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !Object.hasOwn(names, String(value.kind)) ||
    !eye(value.eye) ||
    typeof value.startedAt !== "string" ||
    !Number.isFinite(Date.parse(value.startedAt)) ||
    !finite(value.activeMilliseconds, 0, 3600000) ||
    !finite(value.difficulty, 0, 12) ||
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
    !["Horizontal", "Vertical", "Circle", "Figure eight", "Wandering"].includes(
      String(settings.pattern),
    ) ||
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
      finite(trial.difficulty, 0, 12),
  );
}
export function mergeBackup(current: Data, input: unknown): Data {
  if (
    !record(input) ||
    !Array.isArray(input.sessions) ||
    !input.sessions.every(validSession)
  )
    throw Error("Invalid sessions");
  const sessions: Session[] = [...input.sessions];
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
  if (
    !Array.isArray(measurements) ||
    !measurements.every(
      (item) =>
        record(item) &&
        typeof item.id === "string" &&
        typeof item.date === "string" &&
        eye(item.eye) &&
        typeof item.method === "string" &&
        typeof item.value === "string",
    )
  )
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
    preferences: input.preferences ? preferences : current.preferences,
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
