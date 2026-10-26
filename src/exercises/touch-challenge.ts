import {
  bounded,
  type Configuration,
  type Session,
  type TouchChallengeState,
} from "../engine/model";

export const maximumTouchLevel = 29;
export const tapLevelGoal = 5;
export const followLevelGoalMilliseconds = 10000;
export const followHalfwayMilliseconds = followLevelGoalMilliseconds / 2;
export const followGraceMilliseconds = 1000;
export type TouchCueKind =
  | "level-up"
  | "level-down"
  | "mastered"
  | "milestone"
  | "closer"
  | "slower";
export interface TouchCue {
  kind: TouchCueKind;
  level: number;
}

export function ensureTouchChallenge(session: Session): TouchChallengeState {
  session.difficulty = Math.floor(
    bounded(session.difficulty, 0, maximumTouchLevel, 0),
  );
  return (session.challenge ??= {
    version: 2,
    startingLevel: session.difficulty,
    highestLevel: session.difficulty,
    levelUps: 0,
    streak: 0,
    chain: 0,
    bestChain: 0,
    misses: 0,
    progressMilliseconds: 0,
    outsideMilliseconds: 0,
    motionSeconds: session.activeMilliseconds / 1000,
    mastered: false,
    achievements: [],
  });
}
export function tapTimeLimit(configuration: Configuration, level: number) {
  return Math.max(
    600,
    Math.round(
      ((configuration.tapPaceSeconds ?? 2.5) * 1000 * 0.98 ** level) / 100,
    ) * 100,
  );
}
export function touchTargetDiameter(session: Session) {
  const progress =
    session.kind === "tap"
      ? (session.challenge?.streak ?? 0) / tapLevelGoal
      : 0;
  return Math.max(
    Math.min(16, session.configuration.size),
    session.configuration.size *
      (session.kind === "follow" ? 0.98 : 0.97) **
        (session.difficulty + progress),
  );
}
export function followMotionFactor(
  configuration: Configuration,
  level: number,
) {
  const base = configuration.speed;
  const maximum = Math.max(base, configuration.gentleMotion ? 0.08 : 0.22);
  return Math.min(base * 1.01 ** level, maximum) / base;
}
export function resetTouchRun(session: Session) {
  const state = session.challenge;
  if (!state) return;
  state.streak = 0;
  state.chain = 0;
  state.progressMilliseconds = 0;
  state.outsideMilliseconds = 0;
}
export function changeTouchLevel(
  session: Session,
  direction: -1 | 1,
  activeMilliseconds = session.activeMilliseconds,
): TouchCue | null {
  const state = ensureTouchChallenge(session);
  if (direction > 0 && session.difficulty >= maximumTouchLevel) {
    if (state.mastered) return null;
    state.mastered = true;
    state.achievements.push({
      kind: "mastered",
      level: session.difficulty,
      activeMilliseconds,
    });
    return { kind: "mastered", level: session.difficulty };
  }
  const next = bounded(session.difficulty + direction, 0, maximumTouchLevel, 0);
  if (next === session.difficulty) return null;
  session.difficulty = next;
  if (direction < 0) state.mastered = false;
  state.highestLevel = Math.max(state.highestLevel, next);
  if (direction > 0) state.levelUps++;
  state.achievements.push({
    kind: direction > 0 ? "level-up" : "level-down",
    level: next,
    activeMilliseconds,
  });
  state.streak = 0;
  state.misses = 0;
  state.progressMilliseconds = 0;
  state.outsideMilliseconds = 0;
  return { kind: direction > 0 ? "level-up" : "level-down", level: next };
}
export function failTouchChallenge(session: Session): TouchCue | null {
  const state = ensureTouchChallenge(session);
  resetTouchRun(session);
  state.misses++;
  return state.misses >= 3 ? changeTouchLevel(session, -1) : null;
}
export function recordTapChallenge(
  session: Session,
  qualified: boolean,
  alreadyExpired: boolean,
): TouchCue | null {
  const state = ensureTouchChallenge(session);
  if (!qualified) return alreadyExpired ? null : failTouchChallenge(session);
  state.misses = 0;
  state.chain++;
  state.streak++;
  state.bestChain = Math.max(state.bestChain, state.chain);
  if (state.streak < tapLevelGoal) return null;
  state.streak = 0;
  return changeTouchLevel(session, 1);
}
export function highestTouchLevel(sessions: Session[], fallback = 0) {
  return sessions.reduce(
    (highest, session) =>
      Math.max(highest, session.challenge?.highestLevel ?? session.difficulty),
    fallback,
  );
}
