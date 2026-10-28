import {
  isTouchExercise,
  type Configuration,
  type Data,
  type ExerciseKind,
  type Eye,
  type Session,
  type Trial,
} from "../engine/model";

export interface StatisticsFilter {
  exercise: ExerciseKind | "All";
  eye: Eye | "All";
  conditions: string | "All";
}
export const emptyStatisticsFilter: StatisticsFilter = {
  exercise: "All",
  eye: "All",
  conditions: "All",
};

export function exerciseProtocol(kind: ExerciseKind) {
  return kind === "tap" || kind === "follow"
    ? "touch-balance-3"
    : kind === "visual"
      ? "visual-shrink-1"
      : "visual-practice-1";
}

/** Only task-relevant base settings enter a group; labels and unused controls do not. */
export function conditionSettings(kind: ExerciseKind, settings: Configuration) {
  const common: (number | string | boolean)[] = [
    settings.duration,
    settings.size,
    settings.contrast,
    settings.background,
    settings.distance,
  ];
  if (kind !== "contrast") common.push(settings.foreground);
  if (kind === "pursuit" || kind === "follow")
    common.push(
      settings.pattern,
      settings.speed,
      settings.complexity,
      settings.gentleMotion ?? false,
    );
  if (kind === "saccades")
    common.push(
      settings.exposure,
      settings.jumpPause,
      settings.jumpDistance,
      settings.tapConfirm,
    );
  if (kind === "visual") common.push(settings.stimulus);
  if (kind === "contrast") common.push(settings.contrastStimulus);
  if (isTouchExercise(kind))
    common.push(settings.hand, settings.touchTolerance);
  if (kind === "tap") common.push(settings.tapPaceSeconds);
  return common;
}
export function comparisonKey(session: Session) {
  const viewport = session.viewport;
  return JSON.stringify([
    session.kind,
    session.eye,
    session.protocol ?? "legacy",
    session.inputMethod ?? "unrecorded",
    conditionSettings(session.kind, session.configuration),
    viewport
      ? [
          Math.round(viewport.width),
          Math.round(viewport.height),
          viewport.pixelRatio,
          viewport.changed,
        ]
      : "unknown-screen",
  ]);
}
export function conditionGroups(
  sessions: Session[],
  filter: Pick<StatisticsFilter, "eye" | "exercise">,
) {
  const groups = new Map<
    string,
    { key: string; sample: Session; count: number }
  >();
  for (const session of sessions) {
    if (
      (filter.eye !== "All" && session.eye !== filter.eye) ||
      (filter.exercise !== "All" && session.kind !== filter.exercise)
    )
      continue;
    const key = comparisonKey(session);
    const previous = groups.get(key);
    if (previous) previous.count++;
    else groups.set(key, { key, sample: session, count: 1 });
  }
  return [...groups.values()];
}
export function filterStatistics(data: Data, filter: StatisticsFilter): Data {
  const matches = (session: Session) =>
    (filter.exercise === "All" || session.kind === filter.exercise) &&
    (filter.eye === "All" || session.eye === filter.eye) &&
    (filter.conditions === "All" ||
      comparisonKey(session) === filter.conditions);
  return {
    ...data,
    sessions: data.sessions.filter(matches),
    current: data.current && matches(data.current) ? data.current : null,
  };
}
export interface PersonalBest {
  session: Session;
  value: number;
  count: number;
  difficulty: number;
  trial?: Trial;
}
/** Compare recorded presentations, not scores pooled across changing adaptive conditions. */
export function personalBest(sessions: Session[]): PersonalBest | null {
  const key = sessions[0] ? comparisonKey(sessions[0]) : "";
  const eligible = sessions
    .filter(
      (session) =>
        comparisonKey(session) === key &&
        session.viewport &&
        !session.viewport.changed &&
        session.protocol &&
        session.inputMethod !== "mixed" &&
        ["completed", "abandoned"].includes(session.status),
    )
    .sort(
      (left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt),
    );
  const candidates: PersonalBest[] = [];
  const presentationKey = (trial: Trial) =>
    JSON.stringify([
      trial.difficulty,
      trial.stimulusDiameter,
      trial.touchTolerance,
      trial.timeLimitMilliseconds,
      trial.precisionRadius,
      trial.adaptiveLoad,
    ]);
  const validPresentation = (session: Session, trial: Trial) =>
    session.kind === "contrast" ||
    (session.kind === "visual" && trial.stimulusDiameter !== undefined) ||
    (session.kind === "tap" &&
      trial.adaptiveLoad !== undefined &&
      trial.touchTolerance !== undefined &&
      trial.stimulusDiameter !== undefined);
  if (eligible[0]?.kind === "follow") {
    const windows = eligible.flatMap((session) =>
      session.challenge?.version === 3
        ? (session.challenge.balance?.history ?? [])
            .filter((window) => window.performance !== null)
            .map((window) => ({ session, window }))
        : [],
    );
    const latest = windows.at(-1);
    if (!latest) return null;
    for (const { session, window } of windows) {
      if (window.fromLoad === latest.window.fromLoad)
        candidates.push({
          session,
          value: window.performance!,
          count: 10,
          difficulty: window.fromLoad,
        });
    }
  } else {
    const latest = eligible
      .flatMap((session) =>
        session.trials.filter((trial) => validPresentation(session, trial)),
      )
      .at(-1);
    if (!latest) return null;
    const latestKey = presentationKey(latest);
    for (const session of eligible) {
      const trials = session.trials.filter(
        (trial) =>
          validPresentation(session, trial) &&
          presentationKey(trial) === latestKey,
      );
      if (trials.length < 5) continue;
      candidates.push({
        session,
        value: trials.filter((trial) => trial.correct).length / trials.length,
        count: trials.length,
        difficulty: trials[0].adaptiveLoad ?? trials[0].difficulty,
        trial: trials[0],
      });
    }
  }
  return (
    candidates.sort(
      (left, right) =>
        right.value - left.value ||
        right.count - left.count ||
        Date.parse(right.session.startedAt) -
          Date.parse(left.session.startedAt),
    )[0] ?? null
  );
}

export function recordViewport(
  session: Session,
  width: number,
  height: number,
  pixelRatio: number,
) {
  if (
    ![width, height, pixelRatio].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    pixelRatio < 1
  )
    return;
  const previous = session.viewport;
  if (!previous)
    session.viewport = { width, height, pixelRatio, changed: false };
  else if (
    Math.abs(previous.width - width) > 1 ||
    Math.abs(previous.height - height) > 1 ||
    previous.pixelRatio !== pixelRatio
  )
    previous.changed = true;
}
