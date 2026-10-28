import { bounded, type Configuration, type Trial } from "../engine/model";

export interface StimulusViewport {
  width: number;
  height: number;
  pixelRatio: number;
}

const shrinkFactor = 0.94;
// Backup validation guard; the visible pixel floor is reached much sooner.
export const visualDifficultyLimit = 256;
// A fresh practice begins comfortably; recovered sessions keep their exact size.
export const visualStartingDifficultyLimit = 12;

function geometry(configuration: Configuration, viewport: StimulusViewport) {
  const pixelRatio = bounded(viewport.pixelRatio, 1, 3, 1);
  const minimumRadius = 2 / pixelRatio;
  const initialRadius = Math.max(
    minimumRadius,
    Math.min(
      bounded(configuration.size, 8, 120, 28) * 1.6,
      bounded(viewport.width, 1, 100000, 1) / 3,
      bounded(viewport.height, 1, 100000, 1) / 3,
    ),
  );
  return { initialRadius, minimumRadius };
}

export function maximumVisualDifficulty(
  configuration: Configuration,
  viewport: StimulusViewport,
) {
  const { initialRadius, minimumRadius } = geometry(configuration, viewport);
  return Math.min(
    visualDifficultyLimit,
    Math.max(
      0,
      Math.ceil(
        Math.log(minimumRadius / initialRadius) / Math.log(shrinkFactor),
      ),
    ),
  );
}

export function visualTargetRadius(
  configuration: Configuration,
  level: number,
  viewport: StimulusViewport,
) {
  const { initialRadius, minimumRadius } = geometry(configuration, viewport);
  return Math.max(
    minimumRadius,
    initialRadius *
      Math.pow(shrinkFactor, bounded(level, 0, visualDifficultyLimit, 0)),
  );
}

export function nextVisualDifficulty(
  level: number,
  trials: readonly Pick<Trial, "correct" | "responseMilliseconds">[],
  maximum: number,
) {
  const current = Math.floor(bounded(level, 0, maximum, 0));
  if (!trials.length) return current;
  if (!trials.at(-1)?.correct) {
    const mistakes = trials.slice(-3).filter((trial) => !trial.correct).length;
    return Math.max(0, current - (mistakes >= 2 ? 3 : 0));
  }
  const correct = trials.filter((trial) => trial.correct);
  if (correct.length < 5) return current;
  const recent = trials.slice(-5);
  if (recent.filter((trial) => trial.correct).length < 4) return current;
  const latencies = correct
    .slice(-5)
    .map((trial) => trial.responseMilliseconds)
    .sort((left, right) => left - right);
  const median = latencies[Math.floor(latencies.length / 2)];
  // Faster accurate answers need less evidence. Slower answers can still progress.
  const required =
    median <= 1800
      ? { correct: 5, milliseconds: 8000 }
      : median <= 3500
        ? { correct: 8, milliseconds: 14000 }
        : { correct: 10, milliseconds: 20000 };
  const elapsed = trials.reduce(
    (total, trial) => total + Math.max(0, trial.responseMilliseconds),
    0,
  );
  return correct.length >= required.correct && elapsed >= required.milliseconds
    ? Math.min(maximum, current + 1)
    : current;
}
