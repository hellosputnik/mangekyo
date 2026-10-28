import type { Data, Session } from "./model";
import {
  ensureTouchChallenge,
  tapProtocol,
} from "../exercises/touch-challenge";
import { resetBalanceWindow } from "../adaptive/balance";

/** Conditions affecting pointing/tracking; language, time goals and duration do not change ability. */
export function touchProfileKey(session: Session) {
  const settings = session.configuration;
  return JSON.stringify([
    session.kind,
    session.eye,
    settings.hand,
    settings.size,
    settings.touchTolerance,
    settings.speed,
    settings.pattern,
    settings.complexity,
    settings.contrast,
    settings.foreground,
    settings.background,
    settings.distance,
    settings.gentleMotion ?? false,
    settings.tapPaceSeconds,
    ...(session.kind === "tap"
      ? [tapProtocol, settings.tapTimed !== false]
      : []),
  ]);
}

export function restoreTouchProfile(
  session: Session,
  profiles: Data["touchProfiles"],
) {
  if (session.kind !== "tap" && session.kind !== "follow") return;
  const state = ensureTouchChallenge(session);
  const previous = profiles?.find(
    (profile) => profile.key === touchProfileKey(session),
  );
  if (!previous) return;
  state.balance = structuredClone(previous.balance);
  resetBalanceWindow(state.balance);
  state.balance.lastPerformance = null;
  state.balance.history = [];
}

export function rememberTouchProfile(
  data: Data,
  session: Session,
  now = new Date(),
) {
  if (
    !session.challenge?.balance ||
    (!session.activeMilliseconds && !session.trials.length)
  )
    return;
  const key = touchProfileKey(session);
  const balance = structuredClone(session.challenge.balance);
  resetBalanceWindow(balance);
  balance.history = [];
  data.touchProfiles = [
    ...(data.touchProfiles ?? []).filter((profile) => profile.key !== key),
    { key, updatedAt: now.toISOString(), balance },
  ].slice(-100);
}
