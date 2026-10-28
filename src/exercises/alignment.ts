import { bounded, type Configuration } from "../engine/model";
import type { StimulusViewport } from "./visual";
export const alignmentDifficultyLimit = 64;

/** Quantize the stimulus to Canvas backing pixels, without assuming physical calibration. */
export function alignmentGeometry(
  configuration: Configuration,
  level: number,
  viewport: StimulusViewport,
) {
  const ratio = bounded(viewport.pixelRatio, 1, 3, 1);
  const snap = (value: number) => Math.round(value * ratio) / ratio;
  const width = Math.max(
    1 / ratio,
    snap(
      Math.min(
        configuration.alignmentWidth ?? 4,
        Math.max(1, (viewport.width - 32) / 8),
      ),
    ),
  );
  const gap = Math.max(
    0,
    snap(
      Math.min(
        configuration.alignmentGap ?? 16,
        Math.max(0, (viewport.height - 32) / 3),
      ),
    ),
  );
  const length = Math.max(
    1 / ratio,
    Math.floor(
      Math.min(
        configuration.size,
        Math.max(1, (viewport.height - 32 - gap) / 2),
      ) * ratio,
    ) / ratio,
  );
  const basePixels = Math.max(
    1,
    Math.floor(
      Math.min(
        configuration.alignmentOffset ?? 12,
        Math.max(1 / ratio, (viewport.width - 32 - width) / 2),
      ) * ratio,
    ),
  );
  const offset =
    Math.max(
      1,
      Math.round(
        basePixels *
          Math.pow(0.9, bounded(level, 0, alignmentDifficultyLimit, 0)),
      ),
    ) / ratio;
  const maximum = Math.min(
    alignmentDifficultyLimit,
    Math.max(0, Math.ceil(Math.log(1 / basePixels) / Math.log(0.9))),
  );
  return {
    width,
    gap,
    length,
    offset,
    maximum,
    upperX: snap(viewport.width / 2 - width / 2),
    upperY: snap(viewport.height / 2 - gap / 2 - length),
    lowerY: snap(viewport.height / 2 + gap / 2),
  };
}

export function nextAlignmentDifficulty(
  configuration: Configuration,
  level: number,
  answers: boolean[],
  viewport: StimulusViewport,
) {
  if (!answers.length || answers.length % 5) return level;
  const geometry = alignmentGeometry(configuration, level, viewport);
  const accuracy = answers.slice(-5).filter(Boolean).length / 5;
  if (
    accuracy >= 0.8 &&
    geometry.offset > 1 / Math.max(1, Math.min(3, viewport.pixelRatio))
  ) {
    let next = Math.min(geometry.maximum, level + 1);
    while (
      next < geometry.maximum &&
      alignmentGeometry(configuration, next, viewport).offset >= geometry.offset
    )
      next++;
    return next;
  }
  if (accuracy < 0.6) {
    let next = Math.max(0, level - 1);
    while (
      next > 0 &&
      alignmentGeometry(configuration, next, viewport).offset <= geometry.offset
    )
      next--;
    return next;
  }
  return Math.min(level, geometry.maximum);
}
