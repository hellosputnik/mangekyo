import type { LanguagePreference } from "../i18n/locale";
import type { AdaptiveBalance } from "../adaptive/balance";

export const exerciseKinds = [
  "pursuit",
  "saccades",
  "visual",
  "contrast",
  "tap",
  "follow",
] as const;
export type ExerciseKind = (typeof exerciseKinds)[number];
export const isResponseExercise = (kind: ExerciseKind) =>
  kind === "visual" || kind === "contrast" || kind === "tap";
export const isTouchExercise = (kind: ExerciseKind) =>
  kind === "tap" || kind === "follow";
export type Eye = "Left" | "Right" | "Both";
export const motionPaths = [
  "Horizontal",
  "Vertical",
  "Circle",
  "Figure eight",
  "Wandering",
] as const;
export const pursuitPatterns = ["Mixed", ...motionPaths] as const;
export type MotionPath = (typeof motionPaths)[number];
export type Pattern = (typeof pursuitPatterns)[number];
export type PursuitPreset = Pattern | "Custom";
export interface Configuration {
  duration: number;
  size: number;
  speed: number;
  contrast: number;
  complexity: number;
  pattern: Pattern;
  pursuitPreset?: PursuitPreset;
  foreground: string;
  background: string;
  exposure: number;
  jumpPause: number;
  jumpDistance: number;
  tapConfirm: boolean;
  stimulus: "Opening" | "Orientation" | "Shape";
  contrastStimulus: "Grating" | "Shape";
  distance: number;
  touchTolerance: number;
  hand: "Left" | "Right";
  tapPaceSeconds: number;
  gentleMotion?: boolean;
}
export const defaults: Configuration = {
  duration: 300,
  size: 28,
  speed: 0.16,
  contrast: 0.85,
  complexity: 1,
  pattern: "Mixed",
  pursuitPreset: "Mixed",
  foreground: "#ff8383",
  background: "#170f0f",
  exposure: 1.5,
  jumpPause: 0.5,
  jumpDistance: 0.8,
  tapConfirm: false,
  stimulus: "Opening",
  contrastStimulus: "Grating",
  distance: 40,
  touchTolerance: 72,
  hand: "Right",
  tapPaceSeconds: 2.5,
};
export const names: Record<ExerciseKind, string> = {
  pursuit: "Smooth pursuit",
  saccades: "Saccadic targets",
  visual: "Visual discrimination",
  contrast: "Contrast discrimination",
  tap: "Tap targets",
  follow: "Follow the target",
};
export function bounded(
  value: number,
  min: number,
  max: number,
  fallback: number,
) {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
export function validate(configuration: Configuration): Configuration {
  return {
    ...configuration,
    duration: bounded(configuration.duration, 10, 3600, 300),
    size: bounded(configuration.size, 8, 120, 28),
    speed: bounded(configuration.speed, 0.02, 1, 0.16),
    contrast: bounded(configuration.contrast, 0.03, 1, 0.85),
    complexity: bounded(configuration.complexity, 1, 5, 1),
    pattern: pursuitPatterns.includes(configuration.pattern)
      ? configuration.pattern
      : defaults.pattern,
    pursuitPreset:
      configuration.pursuitPreset === undefined ||
      configuration.pursuitPreset === "Custom" ||
      pursuitPatterns.includes(configuration.pursuitPreset)
        ? configuration.pursuitPreset
        : "Custom",
    exposure: bounded(configuration.exposure, 0.5, 10, 1.5),
    jumpPause: bounded(configuration.jumpPause, 0, 10, 0.5),
    jumpDistance: bounded(configuration.jumpDistance, 0.1, 1, 0.8),
    distance: bounded(configuration.distance, 15, 200, 40),
    touchTolerance: bounded(configuration.touchTolerance, 44, 160, 72),
    hand: configuration.hand === "Left" ? "Left" : "Right",
    tapPaceSeconds: bounded(configuration.tapPaceSeconds, 1, 10, 2.5),
  };
}
export interface Slice {
  date: string;
  timezone: string;
  offset: number;
  milliseconds: number;
}
export interface Trial {
  correct: boolean;
  responseMilliseconds: number;
  difficulty: number;
  /** Presented visual target diameter in CSS pixels; absent in legacy records. */
  stimulusDiameter?: number;
  touchDistance?: number;
  touchTolerance?: number;
  qualified?: boolean;
  timeLimitMilliseconds?: number;
  precisionRadius?: number;
  adaptiveLoad?: number;
}
export interface FollowMetrics {
  trackedMilliseconds: number;
  onTargetMilliseconds: number;
  distanceWeightedMilliseconds: number;
  currentRunMilliseconds: number;
  bestRunMilliseconds: number;
  windowMilliseconds: number;
  windowOnTargetMilliseconds: number;
}
export interface TapState {
  x: number;
  y: number;
  presentedAtMilliseconds: number;
  expired?: boolean;
}
export interface ChallengeAchievement {
  kind: "level-up" | "level-down" | "mastered";
  level: number;
  activeMilliseconds: number;
}
export interface TouchChallengeState {
  version: 1 | 2 | 3;
  balance?: AdaptiveBalance;
  startingLevel: number;
  highestLevel: number;
  levelUps: number;
  streak: number;
  chain: number;
  bestChain: number;
  misses: number;
  progressMilliseconds: number;
  outsideMilliseconds: number;
  motionSeconds: number;
  mastered: boolean;
  achievements: ChallengeAchievement[];
}
export interface Session {
  id: string;
  kind: ExerciseKind;
  eye: Eye;
  configuration: Configuration;
  startedAt: string;
  endedAt?: string;
  status: "running" | "paused" | "interrupted" | "completed" | "abandoned";
  activeMilliseconds: number;
  slices: Slice[];
  trials: Trial[];
  difficulty: number;
  follow?: FollowMetrics;
  tapState?: TapState;
  awaitingTouch?: boolean;
  challenge?: TouchChallengeState;
}
export interface Step {
  kind: ExerciseKind;
  duration: number;
}
export interface Routine {
  id: string;
  name: string;
  steps: Step[];
  rest: number;
  manual: boolean;
}
export interface RoutineRun {
  routine: Routine;
  index: number;
  eye: Eye;
}
export interface Preferences {
  language: LanguagePreference;
  goal: number;
  rest: number;
  manual: boolean;
  sound: boolean;
  answerSound: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  reminder: number;
}
export interface Measurement {
  id: string;
  date: string;
  eye: Eye;
  method: string;
  value: string;
}
export interface StatisticsReset {
  resetAt: string;
  sessions: Session[];
  measurements?: Measurement[];
  levels?: Record<ExerciseKind, number>;
  touchProfiles?: TouchProfile[];
}
export interface TouchProfile {
  key: string;
  updatedAt: string;
  balance: AdaptiveBalance;
}
export interface Data {
  sessions: Session[];
  current: Session | null;
  routines: Routine[];
  run: RoutineRun | null;
  preferences: Preferences;
  measurements: Measurement[];
  levels: Record<ExerciseKind, number>;
  breakState: { remaining: number; manual: boolean } | null;
  statisticsReset?: StatisticsReset;
  touchProfiles?: TouchProfile[];
}
export const initialData = (): Data => ({
  sessions: [],
  current: null,
  routines: [],
  run: null,
  preferences: {
    language: "system",
    goal: 30,
    rest: 60,
    manual: false,
    sound: false,
    answerSound: false,
    reducedMotion: false,
    highContrast: false,
    reminder: 5,
  },
  measurements: [],
  touchProfiles: [],
  levels: {
    pursuit: 0,
    saccades: 0,
    visual: 0,
    contrast: 0,
    tap: 0,
    follow: 0,
  },
  breakState: null,
});
export const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
