import type { Session, Trial } from "../engine/model";
import { practiceRules } from "../adaptive/rules";
import type {
  PracticeChannel,
  StimulusMeasure,
  PracticeActivity,
} from "../adaptive/types";

export const reliableTrial = (trial: Trial) =>
  !trial.quality?.reasons.length &&
  !(trial.attention?.replays ?? 0) &&
  !trial.adaptation?.check;
export function channelConfidence(channel: PracticeChannel) {
  if (channel.phase === "rechecking") return "rechecking" as const;
  return channel.samples >= practiceRules.establishedSamples &&
    channel.recent.length >= 15 &&
    channel.reversals > 0
    ? ("established" as const)
    : ("gathering" as const);
}
/** Uncertainty of recent binary response accuracy, not a confidence interval for visual ability. */
export function responseInterval(channel: PracticeChannel) {
  if (channel.activity === "follow" || !channel.recent.length) return null;
  const count = channel.recent.length;
  const rate =
    channel.recent.reduce((sum, item) => sum + item.success, 0) / count;
  const squared = 1.96 ** 2;
  const center = (rate + squared / (2 * count)) / (1 + squared / count);
  const radius =
    (1.96 *
      Math.sqrt((rate * (1 - rate)) / count + squared / (4 * count ** 2))) /
    (1 + squared / count);
  return {
    lower: Math.max(0, center - radius),
    upper: Math.min(1, center + radius),
    count,
  };
}
export function principalMeasure(activity: PracticeActivity): StimulusMeasure {
  if (["visual", "tap"].includes(activity)) return "diameter";
  if (activity === "contrast") return "contrast";
  if (activity === "crowding") return "spacing";
  if (activity === "alignment") return "offset";
  if (["follow", "Moving"].includes(activity)) return "speed";
  if (["Track", "Count", "Match", "Numbers"].includes(activity)) return "items";
  return activity === "Compare" ? "exposure" : "load";
}
export interface PracticeAchievement {
  activity: PracticeActivity;
  measure: StimulusMeasure;
  relativeChange: number;
  from: number;
  to: number;
  accuracy: number;
  sampleCount: number;
}
export function practiceAchievement(
  session: Session,
): PracticeAchievement | null {
  if (!session.adaptation || session.checkIn) return null;
  if (session.kind === "follow") {
    const windows = session.adaptation.decisions.filter(
      (item) =>
        item.activity === "follow" &&
        item.performance !== null &&
        ["finding", "working", "support", "ceiling", "recheck"].includes(
          item.reason,
        ),
    );
    if (windows.length < 6) return null;
    const first = windows.slice(0, 3),
      last = windows.slice(-3);
    if (
      !first.every((item) => item.profileKey === last[0].profileKey) ||
      !last.every((item) => item.profileKey === last[0].profileKey)
    )
      return null;
    const from = Math.max(...first.map((item) => item.values.speed ?? 0)),
      to = Math.min(...last.map((item) => item.values.speed ?? 0));
    const average = (values: typeof windows) =>
      values.reduce((sum, item) => sum + item.performance!, 0) / values.length;
    if (
      from &&
      to &&
      to / from >= 1.05 &&
      average(last) >= 0.8 &&
      average(last) >= average(first) - 0.05 &&
      first[0].values.diameter === last[0].values.diameter &&
      first[0].values.tolerance === last[0].values.tolerance
    )
      return {
        activity: "follow",
        measure: "speed",
        from,
        to,
        relativeChange: to / from - 1,
        accuracy: average(last),
        sampleCount: 3,
      };
    return null;
  }
  const trials = session.trials.filter(
    (trial) => reliableTrial(trial) && trial.adaptation,
  );
  const groups = new Map<string, Trial[]>();
  for (const trial of trials) {
    const key = trial.adaptation!.profileKey;
    const group = groups.get(key);
    if (group) group.push(trial);
    else groups.set(key, [trial]);
  }
  for (const group of [...groups.values()].reverse()) {
    if (group.length < 10) continue;
    const activity = group[0].adaptation!.activity;
    const measures: StimulusMeasure[] =
      activity === "Track"
        ? ["items", "speed"]
        : ["Locations", "Directions", "Digits"].includes(activity)
          ? ["load", "exposure"]
          : [principalMeasure(activity)];
    const first = group.slice(0, 5),
      last = group.slice(-5);
    const accuracy = (values: Trial[]) =>
      values.filter((trial) =>
        session.kind === "tap" ? trial.qualified : trial.correct,
      ).length / values.length;
    if (accuracy(last) < 0.8 || accuracy(last) < accuracy(first) - 0.05)
      continue;
    for (const measure of measures) {
      const from = first[0].adaptation!.values[measure];
      const to = last[0].adaptation!.values[measure];
      if (from === undefined || to === undefined || from <= 0 || to <= 0)
        continue;
      // Each end of the comparison needs five responses to the same physical setting.
      if (
        !first.every((trial) => trial.adaptation!.values[measure] === from) ||
        !last.every((trial) => trial.adaptation!.values[measure] === to)
      )
        continue;
      const higherIsHarder = ["items", "load", "speed"].includes(measure);
      const relativeChange = higherIsHarder ? to / from - 1 : 1 - to / from;
      if (relativeChange < 0.05) continue;
      // Do not describe improvement in one dimension when other independent settings changed.
      const ignored =
        measure === "load" ? [measure, "items", "exposure"] : [measure];
      if (
        Object.entries(first[0].adaptation!.values).some(
          ([key, value]) =>
            !ignored.includes(key) &&
            last[0].adaptation!.values[key as StimulusMeasure] !== value,
        )
      )
        continue;
      const firstLatency = first
        .map((trial) => trial.responseMilliseconds)
        .sort((a, b) => a - b)[2];
      const lastLatency = last
        .map((trial) => trial.responseMilliseconds)
        .sort((a, b) => a - b)[2];
      if (lastLatency > Math.max(1000, firstLatency * 1.25)) continue;
      return {
        activity,
        measure,
        relativeChange,
        from,
        to,
        accuracy: accuracy(last),
        sampleCount: 5,
      };
    }
  }
  return null;
}

export function adaptationSummary(session: Session) {
  const reliable = session.trials.filter(reliableTrial);
  return {
    reliable: reliable.length,
    excluded: session.trials.filter((trial) => trial.quality?.reasons.length)
      .length,
    checks: session.trials.filter((trial) => trial.adaptation?.check).length,
    replays: session.trials.filter(
      (trial) => (trial.attention?.replays ?? 0) > 0,
    ).length,
    channels: Object.values(session.adaptation?.channels ?? {}).filter(
      (channel): channel is PracticeChannel => Boolean(channel),
    ),
    achievement: practiceAchievement(session),
  };
}
