import {
  defaults,
  motionPaths,
  type Configuration,
  type MotionPath,
  type PursuitPreset,
} from "../engine/model";

export function applyPursuitPreset(
  configuration: Configuration,
  preset: PursuitPreset,
): Configuration {
  if (preset === "Custom") return { ...configuration, pursuitPreset: preset };
  return {
    ...configuration,
    pursuitPreset: preset,
    pattern: preset,
    size: defaults.size,
    speed: defaults.speed,
    contrast: defaults.contrast,
    complexity: defaults.complexity,
    foreground: defaults.foreground,
    background: defaults.background,
  };
}

/** Active seconds are supplied by the session timer, never a wall clock. */
export function currentPursuitPath(
  configuration: Configuration,
  activeSeconds: number,
): MotionPath {
  if (configuration.pattern !== "Mixed") return configuration.pattern;
  const segmentSeconds = configuration.duration / motionPaths.length;
  const index = Math.min(
    motionPaths.length - 1,
    Math.max(0, Math.floor(activeSeconds / segmentSeconds)),
  );
  return motionPaths[index];
}

function pathPoint(
  path: MotionPath,
  phase: number,
  complexity: number,
): readonly [number, number] {
  switch (path) {
    case "Horizontal":
      return [Math.sin(phase), 0];
    case "Vertical":
      return [0, Math.sin(phase)];
    case "Circle":
      return [Math.cos(phase), Math.sin(phase)];
    case "Figure eight":
      return [Math.sin(phase), Math.sin(phase * 2) * 0.75];
    case "Wandering":
      return [
        Math.sin(phase * 0.73) * 0.65 +
          Math.sin(phase * 1.13 * complexity) * 0.3,
        Math.cos(phase * 0.57) * 0.65 + Math.sin(phase * 0.91) * 0.3,
      ];
  }
}

export function pursuitPoint(
  configuration: Configuration,
  activeSeconds: number,
  phaseSeconds = activeSeconds,
): readonly [number, number] {
  const seconds = Math.max(0, activeSeconds);
  const phase = Math.max(0, phaseSeconds) * configuration.speed * Math.PI * 2;
  const path = currentPursuitPath(configuration, seconds);
  const point = pathPoint(path, phase, configuration.complexity);
  if (configuration.pattern !== "Mixed") return point;
  const index = motionPaths.indexOf(path);
  if (index === 0) return point;
  const segmentSeconds = configuration.duration / motionPaths.length;
  const transitionSeconds = Math.min(3, segmentSeconds * 0.2);
  const transitionProgress =
    (seconds - index * segmentSeconds) / transitionSeconds;
  if (transitionProgress >= 1) return point;
  const previous = pathPoint(
    motionPaths[index - 1],
    phase,
    configuration.complexity,
  );
  // Quintic blending keeps both position and velocity continuous at each join.
  const progress = Math.max(0, transitionProgress);
  const weight = progress ** 3 * (10 - 15 * progress + 6 * progress ** 2);
  return [
    previous[0] + (point[0] - previous[0]) * weight,
    previous[1] + (point[1] - previous[1]) * weight,
  ];
}
