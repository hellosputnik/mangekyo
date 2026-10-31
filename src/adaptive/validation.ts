import {
  decisionReasons,
  practiceActivities,
  qualityReasons,
  stimulusMeasures,
} from "./types";
import { practiceRules } from "./rules";

const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown, maximum = 1000000): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= maximum;
const integer = (value: unknown, maximum = 1000000) =>
  finite(value, maximum) && Number.isInteger(value);
const key = (value: unknown) =>
  typeof value === "string" && value.length <= 4000;
const date = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const activity = (value: unknown) =>
  practiceActivities.includes(value as (typeof practiceActivities)[number]);
const reasonList = (value: unknown) =>
  Array.isArray(value) &&
  value.length <= qualityReasons.length &&
  new Set(value).size === value.length &&
  value.every((item) => qualityReasons.includes(item));
const values = (value: unknown) =>
  object(value) &&
  Object.entries(value).every(
    ([name, amount]) =>
      stimulusMeasures.includes(name as (typeof stimulusMeasures)[number]) &&
      finite(amount, 100000),
  );
const evidence = (value: unknown) =>
  object(value) &&
  integer(value.trial) &&
  finite(value.success, 1) &&
  finite(value.responseMilliseconds, 3600000) &&
  finite(value.activeMilliseconds, 3600000) &&
  finite(value.challenge, 256);

export function validPracticeChannel(value: unknown): boolean {
  return (
    object(value) &&
    activity(value.activity) &&
    key(value.key) &&
    key(value.conditions) &&
    finite(value.challenge, 256) &&
    ["finding", "working", "rechecking"].includes(String(value.phase)) &&
    [
      "samples",
      "sessionSamples",
      "windows",
      "reversals",
      "coarseWindows",
      "holdIncreases",
      "checkFailures",
      "sinceCheck",
    ].every((name) => integer(value[name])) &&
    typeof value.direction === "number" &&
    [-1, 0, 1].includes(value.direction) &&
    typeof value.checking === "boolean" &&
    finite(value.lastAdjustmentMilliseconds, 3600000) &&
    (value.lastEvidenceAt === undefined || date(value.lastEvidenceAt)) &&
    Array.isArray(value.pending) &&
    value.pending.length < practiceRules.window &&
    value.pending.every(evidence) &&
    Array.isArray(value.recent) &&
    value.recent.length <= practiceRules.evidenceLimit &&
    value.recent.every(evidence)
  );
}
export function validPracticeProfiles(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= practiceRules.maximumProfiles &&
    new Set(value.filter(object).map((item) => item.key)).size ===
      value.length &&
    value.every(
      (item) =>
        object(item) &&
        key(item.key) &&
        date(item.updatedAt) &&
        validPracticeChannel(item.channel) &&
        object(item.channel) &&
        item.channel.key === item.key &&
        Array.isArray(item.channel.pending) &&
        !item.channel.pending.length,
    )
  );
}
export function validTrialQuality(value: unknown) {
  return object(value) && reasonList(value.reasons);
}
export function validTrialAdaptation(value: unknown) {
  return (
    object(value) &&
    activity(value.activity) &&
    key(value.profileKey) &&
    finite(value.challenge, 256) &&
    typeof value.check === "boolean" &&
    values(value.values)
  );
}
export function validPresentationQuality(value: unknown, elapsed: number) {
  return (
    object(value) &&
    value.version === 1 &&
    reasonList(value.pending) &&
    typeof value.presented === "boolean" &&
    Array.isArray(value.events) &&
    value.events.length <= 300 &&
    value.events.every(
      (item) =>
        object(item) &&
        finite(item.activeMilliseconds, elapsed) &&
        qualityReasons.includes(
          item.reason as (typeof qualityReasons)[number],
        ) &&
        finite(item.gapMilliseconds, 3600000),
    )
  );
}
export function validPracticeAdaptation(
  value: unknown,
  elapsed: number,
  trialCount: number,
) {
  return (
    object(value) &&
    value.version === 1 &&
    integer(value.consumedTrials, trialCount) &&
    (value.activityOffset === undefined || integer(value.activityOffset, 8)) &&
    (value.contexts === undefined ||
      (object(value.contexts) &&
        Object.keys(value.contexts).length <= 256 &&
        Object.entries(value.contexts).every(
          ([name, description]) => key(name) && key(description),
        ))) &&
    integer(value.sequence) &&
    object(value.channels) &&
    Object.keys(value.channels).length <= practiceActivities.length &&
    Object.entries(value.channels).every(
      ([name, channel]) =>
        activity(name) &&
        validPracticeChannel(channel) &&
        object(channel) &&
        channel.activity === name,
    ) &&
    (value.viewport === undefined ||
      (object(value.viewport) &&
        finite(value.viewport.width, 100000) &&
        Number(value.viewport.width) > 0 &&
        finite(value.viewport.height, 100000) &&
        Number(value.viewport.height) > 0 &&
        finite(value.viewport.pixelRatio, 3) &&
        Number(value.viewport.pixelRatio) >= 1)) &&
    Array.isArray(value.decisions) &&
    value.decisions.length <= practiceRules.maximumDecisions &&
    value.decisions.every(
      (item, index, decisions) =>
        object(item) &&
        integer(item.id, Number(value.sequence)) &&
        Number(item.id) >
          (index
            ? Number((decisions[index - 1] as Record<string, unknown>).id)
            : 0) &&
        activity(item.activity) &&
        key(item.profileKey) &&
        finite(item.activeMilliseconds, elapsed) &&
        Array.isArray(item.trials) &&
        item.trials.length <= practiceRules.window &&
        item.trials.every(
          (trial) => integer(trial, trialCount) && Number(trial) > 0,
        ) &&
        (item.performance === null || finite(item.performance, 1)) &&
        (item.responseMilliseconds === null ||
          finite(item.responseMilliseconds, 3600000)) &&
        finite(item.before, 256) &&
        finite(item.after, 256) &&
        ["finding", "working", "rechecking"].includes(String(item.phase)) &&
        decisionReasons.includes(
          item.reason as (typeof decisionReasons)[number],
        ) &&
        integer(item.sampleCount) &&
        values(item.values),
    )
  );
}
