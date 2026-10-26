import { bounded, type Configuration } from "../engine/model";

export interface StimulusViewport {
  width: number;
  height: number;
  pixelRatio: number;
}

const shrinkFactor = 0.94;
// Backup validation guard; the visible pixel floor is reached much sooner.
export const visualDifficultyLimit = 256;

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
  answers: readonly boolean[],
  maximum: number,
) {
  const current = Math.floor(bounded(level, 0, maximum, 0));
  if (!answers.length) return current;
  if (answers.at(-1)) return Math.min(maximum, current + 1);
  const mistakes = answers.slice(-3).filter((correct) => !correct).length;
  return Math.max(0, current - (mistakes >= 2 ? 3 : 0));
}
