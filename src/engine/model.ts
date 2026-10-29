import type { LanguagePreference } from "../i18n/locale";
import type { AdaptiveBalance } from "../adaptive/balance";

export const exerciseKinds = [
  "pursuit",
  "saccades",
  "visual",
  "contrast",
  "tap",
  "follow",
  "crowding",
  "alignment",
  "tracking",
  "search",
  "memory",
  "sequence",
] as const;
export type ExerciseKind = (typeof exerciseKinds)[number];
export const attentionKinds = [
  "tracking",
  "search",
  "memory",
  "sequence",
] as const;
export type AttentionKind = (typeof attentionKinds)[number];
export const isAttentionExercise = (
  kind: ExerciseKind,
): kind is AttentionKind => attentionKinds.includes(kind as AttentionKind);
export const isResponseExercise = (kind: ExerciseKind) =>
  isAttentionExercise(kind) ||
  kind === "visual" ||
  kind === "contrast" ||
  kind === "tap" ||
  kind === "crowding" ||
  kind === "alignment";
export const supportsCheckIn = (kind: ExerciseKind) =>
  kind === "visual" ||
  kind === "contrast" ||
  kind === "crowding" ||
  kind === "alignment";
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
  pursuitVariableSpeed?: boolean;
  pursuitSpeedVariation?: number;
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
  tapTimed?: boolean;
  gentleMotion?: boolean;
  crowdingSpacing?: number;
  alignmentOffset?: number;
  alignmentGap?: number;
  alignmentWidth?: number;
  trackingObjects?: number;
  trackingSeconds?: number;
  searchTask?: "Mixed" | "Count" | "Match" | "Moving";
  searchItems?: number;
  recallTask?: "Mixed" | "Locations" | "Digits" | "Directions" | "Compare";
  recallItems?: number;
  recallExposure?: number;
  recallDelay?: number;
  sequenceItems?: number;
}
export const defaults: Configuration = {
  duration: 300,
  size: 28,
  speed: 0.16,
  contrast: 0.85,
  complexity: 1,
  pattern: "Mixed",
  pursuitPreset: "Mixed",
  pursuitVariableSpeed: false,
  pursuitSpeedVariation: 0.35,
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
  tapTimed: true,
  crowdingSpacing: 1,
  alignmentOffset: 12,
  alignmentGap: 16,
  alignmentWidth: 4,
  trackingObjects: 3,
  trackingSeconds: 4,
  searchTask: "Mixed",
  searchItems: 6,
  recallTask: "Mixed",
  recallItems: 1,
  recallExposure: 1.8,
  recallDelay: 0.6,
  sequenceItems: 6,
};
export const names: Record<ExerciseKind, string> = {
  pursuit: "Smooth pursuit",
  saccades: "Saccadic targets",
  visual: "Visual discrimination",
  contrast: "Contrast discrimination",
  tap: "Tap targets",
  follow: "Follow the target",
  crowding: "Crowded symbols",
  alignment: "Fine alignment",
  tracking: "Track & find",
  search: "Find & count",
  memory: "Brief recall",
  sequence: "Number sequence",
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
    pursuitVariableSpeed: configuration.pursuitVariableSpeed === true,
    pursuitSpeedVariation: bounded(
      configuration.pursuitSpeedVariation ?? 0.35,
      0.1,
      0.6,
      0.35,
    ),
    exposure: bounded(configuration.exposure, 0.5, 10, 1.5),
    jumpPause: bounded(configuration.jumpPause, 0, 10, 0.5),
    jumpDistance: bounded(configuration.jumpDistance, 0.1, 1, 0.8),
    distance: bounded(configuration.distance, 15, 200, 40),
    touchTolerance: bounded(configuration.touchTolerance, 44, 160, 72),
    hand: configuration.hand === "Left" ? "Left" : "Right",
    tapPaceSeconds: bounded(configuration.tapPaceSeconds, 1, 10, 2.5),
    tapTimed: configuration.tapTimed !== false,
    crowdingSpacing: bounded(configuration.crowdingSpacing ?? 1, 0.15, 3, 1),
    alignmentOffset: bounded(configuration.alignmentOffset ?? 12, 1, 64, 12),
    alignmentGap: bounded(configuration.alignmentGap ?? 16, 0, 80, 16),
    alignmentWidth: bounded(configuration.alignmentWidth ?? 4, 1, 12, 4),
    trackingObjects: Math.round(
      bounded(configuration.trackingObjects ?? 3, 3, 6, 3),
    ),
    trackingSeconds: bounded(configuration.trackingSeconds ?? 4, 2, 12, 4),
    searchTask: ["Mixed", "Count", "Match", "Moving"].includes(
      configuration.searchTask ?? "",
    )
      ? configuration.searchTask
      : "Mixed",
    searchItems: Math.round(bounded(configuration.searchItems ?? 6, 4, 12, 6)),
    recallTask: [
      "Mixed",
      "Locations",
      "Digits",
      "Directions",
      "Compare",
    ].includes(configuration.recallTask ?? "")
      ? configuration.recallTask
      : "Mixed",
    recallItems: Math.round(bounded(configuration.recallItems ?? 1, 1, 4, 1)),
    recallExposure: bounded(configuration.recallExposure ?? 1.8, 0.8, 5, 1.8),
    recallDelay: bounded(configuration.recallDelay ?? 0.6, 0, 3, 0.6),
    sequenceItems: Math.round(
      bounded(configuration.sequenceItems ?? 6, 4, 12, 6),
    ),
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
  timedOut?: boolean;
  precisionRadius?: number;
  adaptiveLoad?: number;
  crowdingSpacing?: number;
  alignmentOffset?: number;
  alignmentGap?: number;
  alignmentWidth?: number;
  alignmentLength?: number;
  attention?: AttentionPresentation;
}
export const attentionTasks = [
  "Track",
  "Count",
  "Match",
  "Moving",
  "Locations",
  "Digits",
  "Directions",
  "Compare",
  "Numbers",
] as const;
export type AttentionTask = (typeof attentionTasks)[number];
export interface AttentionPresentation {
  task: AttentionTask;
  itemCount: number;
  load: number;
  exposureMilliseconds: number;
  delayMilliseconds: number;
  trackingMilliseconds: number;
  speed: number;
  replays: number;
  trackingVersion?: 2;
}
export interface AttentionRound {
  version: 1;
  index: number;
  seed: number;
  startedAtMilliseconds: number;
  difficulty: number;
  cue: number;
  items: number[];
  choices: number[];
  answers: number[];
  selected: number[];
  presentation: AttentionPresentation;
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
  timeLimitMilliseconds?: number;
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
  attentionRound?: AttentionRound;
  initialDifficulty?: number;
  viewport?: {
    width: number;
    height: number;
    pixelRatio: number;
    changed: boolean;
  };
  protocol?: string;
  pursuitSeed?: number;
  inputMethod?: "pointer" | "keyboard" | "mixed";
  setupMode?: PracticeMode;
  checkIn?: { version: 1; targetTrials: 12 };
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
  haptics: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  reminder: number;
  backupReminder?: boolean;
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
export type PracticeMode = "Default" | "Custom";
export interface PracticeSetup {
  mode: PracticeMode;
  configuration: Configuration;
}
export type PracticeSetups = Record<ExerciseKind, PracticeSetup>;
export interface PracticePreferences {
  kind: ExerciseKind;
  eye: Eye;
  setups: PracticeSetups;
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
  practice?: PracticePreferences;
  lastExportedAt?: string;
  backupReminderDismissedAt?: string;
  savedSetups?: SavedSetup[];
}
export interface SavedSetup {
  id: string;
  name: string;
  kind: ExerciseKind;
  configuration: Configuration;
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
    answerSound: true,
    haptics: true,
    reducedMotion: false,
    highContrast: false,
    reminder: 5,
    backupReminder: false,
  },
  measurements: [],
  touchProfiles: [],
  savedSetups: [],
  levels: {
    pursuit: 0,
    saccades: 0,
    visual: 0,
    contrast: 0,
    tap: 0,
    follow: 0,
    crowding: 0,
    alignment: 0,
    tracking: 0,
    search: 0,
    memory: 0,
    sequence: 0,
  },
  breakState: null,
});
export const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
