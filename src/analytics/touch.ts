import type { Session } from "../engine/model";
export function summarizeTouch(sessions: Session[]) {
  const follows = sessions
    .filter((session) => session.kind === "follow" && session.follow)
    .map((session) => session.follow!);
  const trackedMilliseconds = follows.reduce(
    (sum, metrics) => sum + metrics.trackedMilliseconds,
    0,
  );
  const onTargetMilliseconds = follows.reduce(
    (sum, metrics) => sum + metrics.onTargetMilliseconds,
    0,
  );
  const distances = sessions
    .filter((session) => session.kind === "tap")
    .flatMap((session) =>
      session.trials.flatMap((trial) =>
        trial.touchDistance === undefined ? [] : [trial.touchDistance],
      ),
    );
  return {
    trackedMilliseconds,
    onTargetMilliseconds,
    onTargetRatio:
      trackedMilliseconds > 0
        ? onTargetMilliseconds / trackedMilliseconds
        : null,
    meanDistance:
      trackedMilliseconds > 0
        ? follows.reduce(
            (sum, metrics) => sum + metrics.distanceWeightedMilliseconds,
            0,
          ) / trackedMilliseconds
        : distances.length
          ? distances.reduce((sum, value) => sum + value, 0) / distances.length
          : null,
    bestRunMilliseconds: follows.reduce(
      (best, metrics) => Math.max(best, metrics.bestRunMilliseconds),
      0,
    ),
  };
}
