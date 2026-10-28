import type { Session } from "../engine/model";
import { comparisonKey } from "./comparison";
import { summarizePractice } from "./statistics";
export function checkInGroups(sessions: Session[]) {
  const groups = new Map<string, Session[]>();
  for (const session of sessions
    .slice()
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))) {
    if (
      !session.checkIn ||
      session.status !== "completed" ||
      session.trials.length !== session.checkIn.targetTrials ||
      !session.viewport ||
      session.viewport.changed ||
      !session.protocol
    )
      continue;
    const key = comparisonKey(session);
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }
  return [...groups]
    .map(([key, records]) => ({
      key,
      sample: records.at(-1)!,
      records,
      results: records.map((session) => ({
        session,
        ...summarizePractice([session]),
      })),
    }))
    .reverse();
}
