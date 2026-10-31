import type { Session, Trial } from "../engine/model";
import { isTouchExercise } from "../engine/model";
import {
  activityRules,
  activitiesFor,
  practiceRules,
  presentedDifficulty,
} from "./rules";
import { initializeQuality } from "./quality";
import type {
  AdaptiveTrial,
  AdaptationDecision,
  DecisionReason,
  OutcomeEvidence,
  PracticeActivity,
  PracticeChannel,
  StimulusValues,
} from "./types";

export function initializeAdaptation(session: Session) {
  initializeQuality(session);
  if (session.checkIn || !activitiesFor(session).length) return;
  session.adaptation ??= {
    version: 1,
    channels: {},
    decisions: [],
    consumedTrials: session.trials.length,
    sequence: 0,
  };
  session.protocol = `adaptive-1-${session.kind}`;
}

export function createPracticeChannel(
  activity: PracticeActivity,
  key = "",
): PracticeChannel {
  return {
    activity,
    key,
    conditions: "",
    challenge: 0,
    phase: "finding",
    samples: 0,
    sessionSamples: 0,
    windows: 0,
    reversals: 0,
    direction: 0,
    coarseWindows: 0,
    holdIncreases: 0,
    checkFailures: 0,
    sinceCheck: 0,
    checking: false,
    pending: [],
    recent: [],
    lastAdjustmentMilliseconds: 0,
  };
}
export function practiceChannel(session: Session, activity: PracticeActivity) {
  if (!session.adaptation) return null;
  return (session.adaptation.channels[activity] ??=
    createPracticeChannel(activity));
}
export function prepareAdaptivePresentation(
  session: Session,
  activity: PracticeActivity,
) {
  const channel = practiceChannel(session, activity);
  if (!channel) return session.difficulty;
  const { maximum } = activityRules(session, activity);
  channel.challenge = Math.min(maximum, Math.max(0, channel.challenge));
  const check =
    !isTouchExercise(session.kind) &&
    channel.sinceCheck >= practiceRules.checkEvery &&
    channel.challenge >= 2;
  channel.checking = check;
  const challenge = check
    ? Math.max(0, channel.challenge - 2)
    : channel.challenge;
  if (!isTouchExercise(session.kind))
    session.difficulty = presentedDifficulty(session, activity, challenge);
  return challenge;
}

export function trialValues(trial: Trial): StimulusValues {
  const values: StimulusValues = {};
  const pairs = [
    ["diameter", trial.stimulusDiameter],
    ["contrast", trial.stimulusContrast],
    ["spacing", trial.crowdingSpacing],
    ["offset", trial.alignmentOffset],
    ["tolerance", trial.touchTolerance],
    ["deadline", trial.timeLimitMilliseconds],
    ["items", trial.attention?.itemCount],
    ["load", trial.attention?.load],
    ["speed", trial.attention?.speed],
    ["exposure", trial.attention?.exposureMilliseconds],
  ] as const;
  for (const [key, value] of pairs)
    if (value !== undefined && Number.isFinite(value)) values[key] = value;
  return values;
}
function appendDecision(
  session: Session,
  channel: PracticeChannel,
  reason: DecisionReason,
  before: number,
  performance: number | null,
  evidence: OutcomeEvidence[],
  values: StimulusValues,
) {
  const state = session.adaptation!;
  const responseTimes = evidence
    .map((item) => item.responseMilliseconds)
    .sort((a, b) => a - b);
  const decision: AdaptationDecision = {
    id: ++state.sequence,
    activity: channel.activity,
    profileKey: channel.key,
    activeMilliseconds: session.activeMilliseconds,
    trials: evidence.map((item) => item.trial).filter((trial) => trial > 0),
    performance,
    responseMilliseconds: responseTimes.length
      ? responseTimes[Math.floor(responseTimes.length / 2)]
      : null,
    before,
    after: channel.challenge,
    phase: channel.phase,
    reason,
    sampleCount: channel.samples,
    values,
  };
  state.decisions.push(decision);
  if (state.decisions.length > practiceRules.maximumDecisions)
    state.decisions.shift();
  return decision;
}

function adjustChallenge(
  session: Session,
  channel: PracticeChannel,
  evidence: OutcomeEvidence[],
  performance: number,
  values: StimulusValues,
) {
  const rules = activityRules(session, channel.activity);
  const before = channel.challenge;
  const wasRechecking = channel.phase === "rechecking";
  const coarse =
    channel.phase === "finding" &&
    channel.coarseWindows < rules.coarseWindows &&
    performance >= (channel.activity === "follow" ? 0.95 : 1);
  let step = coarse
    ? rules.coarse
    : rules.fine / (1 + Math.min(4, channel.reversals) * 0.25);
  if (channel.activity === "visual") {
    const elapsed = Math.max(
      0,
      session.activeMilliseconds - channel.lastAdjustmentMilliseconds,
    );
    step *= Math.min(1, elapsed / 8000);
  }
  // Robust personal timing only changes probe size; it never turns an accurate untimed answer into an error.
  const currentTimes = evidence
    .filter((item) => item.success === 1)
    .map((item) => item.responseMilliseconds)
    .sort((a, b) => a - b);
  const previousTimes = channel.recent
    .slice(0, -evidence.length)
    .filter((item) => item.success === 1)
    .map((item) => item.responseMilliseconds)
    .sort((a, b) => a - b);
  if (
    previousTimes.length >= 5 &&
    currentTimes.length >= 3 &&
    currentTimes[Math.floor(currentTimes.length / 2)] >
      previousTimes[Math.floor(previousTimes.length / 2)] * 1.5
  )
    step = Math.min(step, rules.fine);
  let change =
    (step * (performance - practiceRules.target)) / (1 - practiceRules.target);
  if (channel.holdIncreases > 0) {
    channel.holdIncreases--;
    if (change > 0) change = 0;
  }
  channel.challenge = Math.max(0, Math.min(rules.maximum, before + change));
  const direction = Math.sign(channel.challenge - before) as -1 | 0 | 1;
  if (direction && channel.direction && direction !== channel.direction)
    channel.reversals++;
  if (direction) channel.direction = direction;
  channel.coarseWindows += Number(coarse);
  channel.windows++;
  const mistakes = channel.recent
    .slice(-15)
    .filter(
      (item) => item.success < (channel.activity === "follow" ? 0.8 : 1),
    ).length;
  if (
    channel.coarseWindows >= rules.coarseWindows ||
    mistakes >= 2 ||
    channel.reversals >= 2 ||
    wasRechecking
  )
    channel.phase = "working";
  channel.lastAdjustmentMilliseconds = session.activeMilliseconds;
  channel.pending = [];
  const reason: DecisionReason =
    before === channel.challenge && before >= rules.maximum
      ? "ceiling"
      : wasRechecking
        ? "recheck"
        : direction < 0
          ? "support"
          : coarse
            ? "finding"
            : "working";
  appendDecision(
    session,
    channel,
    reason,
    before,
    performance,
    evidence,
    values,
  );
  syncTouchBalance(session, channel, performance);
}

/** Consume each recorded outcome once; pending evidence belongs to one eye/activity/settings profile. */
export function recordAdaptiveTrial(session: Session) {
  const state = session.adaptation;
  if (!state || state.consumedTrials >= session.trials.length) return;
  const trialNumber = session.trials.length;
  state.consumedTrials = trialNumber;
  const trial = session.trials[trialNumber - 1];
  const activity = trial.attention?.task ?? (session.kind as PracticeActivity);
  const channel = practiceChannel(session, activity);
  if (!channel) return;
  const annotation: AdaptiveTrial = {
    activity,
    profileKey: channel.key,
    challenge: channel.challenge,
    check: channel.checking,
    values: trialValues(trial),
  };
  trial.adaptation = annotation;
  const evidence: OutcomeEvidence = {
    trial: trialNumber,
    success: Number(
      session.kind === "tap" ? trial.qualified === true : trial.correct,
    ),
    responseMilliseconds: trial.responseMilliseconds,
    activeMilliseconds: session.activeMilliseconds,
    challenge: channel.challenge,
  };
  if (trial.quality?.reasons.length || (trial.attention?.replays ?? 0) > 0) {
    channel.pending = [];
    channel.checking = false;
    appendDecision(
      session,
      channel,
      trial.quality?.reasons.length ? "quality" : "replay",
      channel.challenge,
      null,
      [evidence],
      annotation.values,
    );
    return;
  }
  if (channel.checking) {
    channel.checking = false;
    channel.sinceCheck = 0;
    if (!trial.correct) {
      channel.checkFailures++;
      channel.holdIncreases = 2;
    }
    appendDecision(
      session,
      channel,
      trial.correct ? "check" : "lapse",
      channel.challenge,
      evidence.success,
      [evidence],
      annotation.values,
    );
    return;
  }
  channel.samples++;
  channel.lastEvidenceAt = new Date().toISOString();
  channel.sessionSamples++;
  channel.sinceCheck++;
  channel.pending.push(evidence);
  channel.recent.push(evidence);
  if (channel.recent.length > practiceRules.evidenceLimit)
    channel.recent.shift();
  if (channel.pending.length >= practiceRules.window)
    adjustChallenge(
      session,
      channel,
      [...channel.pending],
      channel.pending.reduce((sum, item) => sum + item.success, 0) /
        channel.pending.length,
      annotation.values,
    );
}

export function recordFollowingWindow(
  session: Session,
  performance: number,
  values: StimulusValues,
) {
  const channel = practiceChannel(session, "follow");
  if (
    !channel ||
    !Number.isFinite(performance) ||
    performance < 0 ||
    performance > 1
  )
    return;
  if (session.presentationQuality?.pending.length) {
    appendDecision(
      session,
      channel,
      "quality",
      channel.challenge,
      null,
      [],
      values,
    );
    session.presentationQuality.pending = [];
    return;
  }
  channel.samples++;
  channel.lastEvidenceAt = new Date().toISOString();
  channel.sessionSamples++;
  const evidence = {
    trial: 0,
    success: performance,
    responseMilliseconds: 10000,
    activeMilliseconds: session.activeMilliseconds,
    challenge: channel.challenge,
  };
  channel.recent.push(evidence);
  if (channel.recent.length > practiceRules.evidenceLimit)
    channel.recent.shift();
  adjustChallenge(session, channel, [evidence], performance, values);
}

export function syncTouchBalance(
  session: Session,
  channel: PracticeChannel,
  performance?: number,
) {
  const balance = session.challenge?.balance;
  if (!balance) return;
  balance.load = channel.challenge;
  balance.phase = channel.phase === "finding" ? "calibrating" : "personalized";
  balance.lastPerformance = performance ?? null;
  balance.reversals = channel.reversals;
  balance.windows = channel.windows;
}

export function clearPendingEvidence(session: Session) {
  for (const channel of Object.values(session.adaptation?.channels ?? {}))
    if (channel) channel.pending = [];
}
