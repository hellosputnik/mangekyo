import type { Data, Session } from "../engine/model";
import { activitiesFor, activityRules, practiceRules } from "./rules";
import {
  createPracticeChannel,
  practiceChannel,
  prepareAdaptivePresentation,
  syncTouchBalance,
} from "./practice";
import type { PracticeActivity, PracticeProfile } from "./types";

export function practiceConditions(
  session: Session,
  activity: PracticeActivity,
) {
  const {
    duration: _duration,
    pursuitPreset: _preset,
    ...configuration
  } = session.configuration;
  const screen = session.adaptation?.viewport ?? session.viewport;
  return JSON.stringify([
    "adaptive-1",
    session.kind,
    activity,
    session.eye,
    session.inputMethod ?? "pointer",
    Object.fromEntries(
      Object.entries(configuration).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    ),
    screen
      ? [
          Math.round(screen.width / 40),
          Math.round(screen.height / 40),
          screen.pixelRatio,
        ]
      : "unknown-screen",
  ]);
}
/** Compact stable identifiers keep full configuration JSON out of every trial. Equality is also checked against the canonical conditions. */
export function practiceProfileKey(
  session: Session,
  activity: PracticeActivity,
) {
  const conditions = practiceConditions(session, activity);
  let first = 2166136261,
    second = 2246822519;
  for (let index = 0; index < conditions.length; index++) {
    first = Math.imul(first ^ conditions.charCodeAt(index), 16777619);
    second = Math.imul(second ^ conditions.charCodeAt(index), 3266489917);
  }
  return `adaptive-1:${session.kind}:${activity}:${session.eye}:${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}
export function bindPracticeProfiles(
  session: Session,
  profiles: PracticeProfile[] = [],
  now = new Date(),
) {
  if (!session.adaptation) return;
  for (const activity of activitiesFor(session)) {
    const key = practiceProfileKey(session, activity);
    const conditions = practiceConditions(session, activity);
    const contexts = (session.adaptation.contexts ??= {});
    contexts[key] = conditions;
    if (Object.keys(contexts).length > 256)
      delete contexts[Object.keys(contexts)[0]];
    const current = practiceChannel(session, activity)!;
    if (current.key === key && current.conditions === conditions) continue;
    const previous = profiles.find(
      (profile) =>
        profile.key === key && profile.channel.conditions === conditions,
    );
    const channel = previous
      ? structuredClone(previous.channel)
      : createPracticeChannel(activity, key);
    channel.key = key;
    channel.conditions = conditions;
    channel.pending = [];
    channel.checking = false;
    channel.sessionSamples = 0;
    channel.lastAdjustmentMilliseconds = session.activeMilliseconds;
    if (previous) {
      const stale =
        now.getTime() - Date.parse(previous.updatedAt) >
        practiceRules.staleDays * 86400000;
      channel.phase = "rechecking";
      channel.challenge = Math.max(
        0,
        channel.challenge -
          activityRules(session, activity).fine * (stale ? 2 : 1),
      );
      if (stale) {
        channel.recent = [];
        channel.samples = 0;
        channel.reversals = 0;
        channel.coarseWindows = 0;
      }
    }
    session.adaptation.channels[activity] = channel;
  }
  const activity =
    session.attentionRound?.presentation.task ?? activitiesFor(session)[0];
  // Short Default sessions should not always favor the first activity.
  if (
    session.adaptation.activityOffset === undefined &&
    (session.kind === "search" || session.kind === "memory")
  ) {
    const variants = activitiesFor(session);
    session.adaptation.activityOffset = variants.reduce(
      (least, variant, index) =>
        (session.adaptation!.channels[variant]?.samples ?? 0) <
        (session.adaptation!.channels[variants[least]]?.samples ?? 0)
          ? index
          : least,
      0,
    );
  }
  if (activity && !session.attentionRound)
    prepareAdaptivePresentation(session, activity);
  if (activity) syncTouchBalance(session, practiceChannel(session, activity)!);
}

export function rememberPracticeProfiles(
  data: Data,
  session: Session,
  now = new Date(),
) {
  if (!session.adaptation || session.checkIn) return;
  let profiles = data.practiceProfiles ?? [];
  for (const source of Object.values(session.adaptation.channels)) {
    if (!source?.key || !source.sessionSamples) continue;
    const channel = structuredClone(source);
    channel.pending = [];
    channel.checking = false;
    channel.sessionSamples = 0;
    profiles = [
      ...profiles.filter((profile) => profile.key !== channel.key),
      {
        key: channel.key,
        updatedAt: channel.lastEvidenceAt ?? now.toISOString(),
        channel,
      },
    ];
  }
  data.practiceProfiles = profiles.slice(-practiceRules.maximumProfiles);
}
