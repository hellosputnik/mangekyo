import { initialData, type Data } from "./model";

export interface ResetStatisticsOptions {
  measurements: boolean;
  difficulty: boolean;
}

export function resetStatistics(
  data: Data,
  options: ResetStatisticsOptions,
  now = new Date(),
): Data {
  if (data.current || data.run)
    throw Error("Finish the current practice before resetting statistics");
  if (
    !data.sessions.length &&
    !(options.measurements && data.measurements.length) &&
    !(
      options.difficulty &&
      Object.values(data.levels).some((level) => level > 0)
    )
  )
    return data;
  return {
    ...data,
    sessions: [],
    measurements: options.measurements ? [] : data.measurements,
    levels: options.difficulty ? initialData().levels : data.levels,
    statisticsReset: {
      resetAt: now.toISOString(),
      sessions: structuredClone(data.sessions),
      ...(options.measurements
        ? { measurements: structuredClone(data.measurements) }
        : {}),
      ...(options.difficulty ? { levels: { ...data.levels } } : {}),
    },
  };
}

export function undoStatisticsReset(data: Data): Data {
  if (data.current || data.run)
    throw Error("Finish the current practice before restoring statistics");
  const { statisticsReset, ...current } = data;
  if (!statisticsReset) return data;
  const merge = <Item extends { id: string }>(
    previous: Item[],
    recent: Item[],
  ) => [
    ...new Map(
      [...previous, ...recent].map((item) => [item.id, item]),
    ).values(),
  ];
  const levels = { ...data.levels };
  if (statisticsReset.levels) {
    for (const kind of ["pursuit", "saccades", "visual", "contrast"] as const) {
      if (!data.sessions.some((session) => session.kind === kind))
        levels[kind] = statisticsReset.levels[kind];
    }
  }
  return {
    ...current,
    sessions: merge(statisticsReset.sessions, data.sessions).sort(
      (left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt),
    ),
    measurements: statisticsReset.measurements
      ? merge(statisticsReset.measurements, data.measurements)
      : data.measurements,
    levels,
  };
}
