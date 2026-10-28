import {
  defaults,
  bounded,
  motionPaths,
  type Configuration,
  type MotionPath,
  type PursuitPreset,
  type Session,
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
    pursuitVariableSpeed: false,
    pursuitSpeedVariation: defaults.pursuitSpeedVariation,
    contrast: defaults.contrast,
    complexity: defaults.complexity,
    foreground: defaults.foreground,
    background: defaults.background,
  };
}

/** One sequence per real session; stored apart from reusable setup preferences. */
export function initializePursuitMotion(
  session: Session,
  random: () => number = Math.random,
) {
  if (
    session.kind === "pursuit" &&
    session.configuration.pursuitVariableSpeed &&
    session.pursuitSeed === undefined
  )
    session.pursuitSeed = Math.floor(
      bounded(random(), 0, 1 - Number.EPSILON, 0.5) * 4294967296,
    );
}

function randomValue(seed: number, index: number) {
  let value = (seed + Math.imul(index + 1, 0x9e3779b9)) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}

export function pursuitSpeedRange(configuration: Configuration) {
  const maximum = configuration.gentleMotion ? 0.08 : 1;
  const base = Math.min(
    maximum,
    bounded(configuration.speed, 0.02, 1, defaults.speed),
  );
  const variation = bounded(
    configuration.pursuitSpeedVariation ?? 0.35,
    0.1,
    0.6,
    0.35,
  );
  return {
    base,
    minimum: base * (1 - variation),
    maximum: Math.min(maximum, base * (1 + variation)),
  };
}

/** Integrate smooth speed changes from active time, independently of frame rate. */
export function pursuitMotion(
  configuration: Configuration,
  activeSeconds: number,
  seed = 0,
) {
  const seconds = bounded(activeSeconds, 0, 3600, 0);
  if (!configuration.pursuitVariableSpeed)
    return { phaseSeconds: seconds, speed: configuration.speed };
  const range = pursuitSpeedRange(configuration);
  let remaining = seconds;
  let cycles = 0;
  let speed = range.base;
  for (let index = 0; remaining > 0; index++) {
    const duration = 3 + randomValue(seed, index * 2) * 4;
    const nextSpeed =
      range.minimum +
      randomValue(seed, index * 2 + 1) * (range.maximum - range.minimum);
    const elapsed = Math.min(remaining, duration);
    const progress = elapsed / duration;
    const weight = progress ** 3 * (10 - 15 * progress + 6 * progress ** 2);
    const integral = 2.5 * progress ** 4 - 3 * progress ** 5 + progress ** 6;
    cycles += speed * elapsed + (nextSpeed - speed) * duration * integral;
    remaining -= elapsed;
    if (remaining <= 0)
      return {
        phaseSeconds:
          cycles / bounded(configuration.speed, 0.02, 1, defaults.speed),
        speed: speed + (nextSpeed - speed) * weight,
      };
    speed = nextSpeed;
  }
  return { phaseSeconds: 0, speed };
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
