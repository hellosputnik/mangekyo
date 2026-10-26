import { localDate, type Data, type Session } from "../engine/model";
export function allSessions(data: Data): Session[] {
  const sessions = new Map(
    data.sessions.map((session) => [session.id, session]),
  );
  if (data.current) sessions.set(data.current.id, data.current);
  return [...sessions.values()];
}
export function totalForDate(data: Data, date = localDate(new Date())) {
  return allSessions(data).reduce(
    (total, session) =>
      total +
      session.slices
        .filter((slice) => slice.date === date)
        .reduce((sum, slice) => sum + slice.milliseconds, 0),
    0,
  );
}
export function accuracy(session: Session) {
  return session.trials.length
    ? Math.round(
        (session.trials.filter((trial) => trial.correct).length /
          session.trials.length) *
          100,
      )
    : null;
}
