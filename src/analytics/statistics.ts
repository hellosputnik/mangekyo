import {
  localDate,
  names,
  isResponseExercise,
  type Data,
  type ExerciseKind,
  type Eye,
  type Session,
} from "../engine/model";
import { allSessions, totalForDate } from "./totals";

export interface PracticeSummary {
  activeMilliseconds: number;
  sessionCount: number;
  completedCount: number;
  stoppedCount: number;
  interruptedCount: number;
  activeDays: number;
  responseCount: number;
  correctCount: number;
  accuracy: number | null;
  medianResponseMilliseconds: number | null;
  averageSessionMilliseconds: number;
  firstDate: string | null;
  lastDate: string | null;
}
export interface ExerciseReport extends PracticeSummary {
  kind: ExerciseKind;
  latestLevel: number | null;
  recentResults: {
    id: string;
    date: string;
    accuracy: number;
    responseCount: number;
    eye: Eye;
  }[];
}

function sessionDate(session: Session): string {
  return (
    session.slices.find((slice) => slice.milliseconds > 0)?.date ??
    localDate(new Date(session.startedAt))
  );
}

export function summarizePractice(sessions: Session[]): PracticeSummary {
  const activeMilliseconds = sessions.reduce(
    (sum, session) => sum + session.activeMilliseconds,
    0,
  );
  const days = new Set<string>();
  for (const session of sessions) {
    for (const slice of session.slices)
      if (slice.milliseconds > 0) days.add(slice.date);
    if (!session.slices.length && session.activeMilliseconds > 0)
      days.add(sessionDate(session));
  }
  const trials = sessions
    .filter((session) => isResponseExercise(session.kind))
    .flatMap((session) => session.trials);
  const correctCount = trials.filter((trial) => trial.correct).length;
  const responseTimes = trials
    .filter((trial) => !trial.timedOut)
    .map((trial) => trial.responseMilliseconds)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);
  const middle = Math.floor(responseTimes.length / 2);
  const dates = [...days].sort();
  return {
    activeMilliseconds,
    sessionCount: sessions.length,
    completedCount: sessions.filter((session) => session.status === "completed")
      .length,
    stoppedCount: sessions.filter((session) => session.status === "abandoned")
      .length,
    interruptedCount: sessions.filter(
      (session) => session.status === "interrupted",
    ).length,
    activeDays: days.size,
    responseCount: trials.length,
    correctCount,
    accuracy: trials.length ? correctCount / trials.length : null,
    medianResponseMilliseconds: responseTimes.length
      ? responseTimes.length % 2
        ? responseTimes[middle]
        : (responseTimes[middle - 1] + responseTimes[middle]) / 2
      : null,
    averageSessionMilliseconds: sessions.length
      ? activeMilliseconds / sessions.length
      : 0,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
  };
}

export function buildStatistics(data: Data, today = new Date()) {
  const sessions = allSessions(data).sort(
    (left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt),
  );
  const summary = summarizePractice(sessions);
  const exercises: ExerciseReport[] = (
    Object.keys(names) as ExerciseKind[]
  ).map((kind) => {
    const records = sessions.filter((session) => session.kind === kind);
    const responseRecords = isResponseExercise(kind)
      ? records.filter((session) => session.trials.length)
      : [];
    return {
      ...summarizePractice(records),
      kind,
      latestLevel:
        responseRecords.length ||
        (kind === "follow" &&
          records.some(
            (session) => (session.follow?.trackedMilliseconds ?? 0) > 0,
          ))
          ? (records.filter((record) => !record.checkIn).at(-1)?.difficulty ??
              0) + 1
          : null,
      recentResults: responseRecords.slice(-6).map((session) => ({
        id: session.id,
        date: sessionDate(session),
        accuracy:
          session.trials.filter((trial) => trial.correct).length /
          session.trials.length,
        responseCount: session.trials.length,
        eye: session.eye,
      })),
    };
  });
  const eyes = (["Left", "Right", "Both"] as const).map((eye) => ({
    ...summarizePractice(sessions.filter((session) => session.eye === eye)),
    eye,
  }));
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 6 + index,
      12,
    );
    const day = localDate(date);
    return { date: day, activeMilliseconds: totalForDate(data, day) };
  });
  return {
    summary,
    exercises,
    eyes,
    week,
    sessions: sessions.slice().reverse(),
  };
}
