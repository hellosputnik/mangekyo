import { bounded, type Configuration } from "../engine/model";
import type { StimulusViewport } from "./visual";

/** Constant symbol diameter; only the gap changes with task difficulty. */
export function crowdingGeometry(
  configuration: Configuration,
  level: number,
  viewport: StimulusViewport,
) {
  const diameter = Math.max(
    1,
    Math.min(
      configuration.size,
      (viewport.width - 32) / 5.5,
      (viewport.height - 32) / 3,
    ),
  );
  const requested =
    bounded(configuration.crowdingSpacing ?? 1, 0.15, 3, 1) *
    Math.pow(0.9, bounded(level, 0, 24, 0));
  const minimumGap = Math.max(
    1 / Math.max(1, viewport.pixelRatio),
    diameter * 0.08,
  );
  const availableGap = Math.max(0, (viewport.width - 32 - diameter * 3) / 2);
  const gap = Math.min(
    availableGap,
    Math.max(minimumGap, diameter * requested),
  );
  return { diameter, gap, centerDistance: diameter + gap };
}
export function nextCrowdingDifficulty(level: number, answers: boolean[]) {
  if (!answers.length || answers.length % 5) return level;
  const accuracy = answers.slice(-5).filter(Boolean).length / 5;
  return bounded(
    level + (accuracy >= 0.8 ? 1 : accuracy < 0.6 ? -1 : 0),
    0,
    24,
    0,
  );
}
