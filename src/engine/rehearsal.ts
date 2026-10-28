import {
  validate,
  type Configuration,
  type ExerciseKind,
  type Session,
} from "./model";

/** Deliberately independent of Data, saved profiles, and the session recording timer. */
export function createRehearsal(
  kind: ExerciseKind,
  configuration: Configuration,
  gentleMotion: boolean,
): Session {
  return {
    id: "rehearsal",
    kind,
    eye: "Both",
    startedAt: new Date().toISOString(),
    configuration: validate({
      ...configuration,
      duration: 3600,
      gentleMotion,
      speed: Math.min(
        configuration.speed,
        kind === "follow" ? 0.04 : gentleMotion ? 0.08 : 0.16,
      ),
      size: Math.max(
        configuration.size,
        kind === "visual" || kind === "contrast" ? 56 : 44,
      ),
      contrast: Math.max(0.7, configuration.contrast),
      touchTolerance: Math.max(100, configuration.touchTolerance),
      ...(kind === "tap" ? { tapTimed: false } : {}),
      ...(kind === "alignment"
        ? {
            size: Math.max(64, configuration.size),
            alignmentOffset: Math.max(12, configuration.alignmentOffset ?? 12),
            alignmentWidth: Math.max(4, configuration.alignmentWidth ?? 4),
          }
        : {}),
    }),
    status: "paused",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
    ...(kind === "follow" ? { awaitingTouch: true } : {}),
  };
}
