import { attentionTasks, type Session } from "../engine/model";

export function summarizeAttention(session: Session) {
  return attentionTasks.flatMap((task) => {
    const trials = session.trials.filter(
      (trial) => trial.attention?.task === task,
    );
    if (!trials.length) return [];
    const presentations = trials.map((trial) => trial.attention!);
    const responseTimes = trials
      .map((trial) => trial.responseMilliseconds)
      .sort((left, right) => left - right);
    const middle = Math.floor(responseTimes.length / 2);
    const range = (
      key:
        | "itemCount"
        | "load"
        | "exposureMilliseconds"
        | "trackingMilliseconds"
        | "delayMilliseconds",
    ) => ({
      minimum: Math.min(...presentations.map((item) => item[key])),
      maximum: Math.max(...presentations.map((item) => item[key])),
    });
    return [
      {
        task,
        count: trials.length,
        correct: trials.filter((trial) => trial.correct).length,
        replays: trials.filter((trial) => trial.attention!.replays > 0).length,
        responseMilliseconds:
          responseTimes.length % 2
            ? responseTimes[middle]
            : (responseTimes[middle - 1] + responseTimes[middle]) / 2,
        items: range("itemCount"),
        load: range("load"),
        exposure: range("exposureMilliseconds"),
        tracking: range("trackingMilliseconds"),
        delay: range("delayMilliseconds"),
      },
    ];
  });
}
