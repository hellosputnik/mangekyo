import { supportsCheckIn, type Session } from "./model";
export const checkInTrials = 12;
export function configureCheckIn(session: Session) {
  if (!supportsCheckIn(session.kind))
    throw Error("This exercise has no response check-in");
  session.checkIn = { version: 1, targetTrials: checkInTrials };
  session.difficulty = 0;
  session.initialDifficulty = 0;
  return session;
}
export function checkInComplete(session: Session) {
  return Boolean(
    session.checkIn && session.trials.length >= session.checkIn.targetTrials,
  );
}
