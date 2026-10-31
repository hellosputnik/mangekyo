export const practiceActivities = [
  "visual",
  "contrast",
  "crowding",
  "alignment",
  "tap",
  "follow",
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
export type PracticeActivity = (typeof practiceActivities)[number];
export type AdaptationPhase = "finding" | "working" | "rechecking";
export const qualityReasons = [
  "frame-stall",
  "interruption",
  "conditions",
  "not-presented",
] as const;
export type QualityReason = (typeof qualityReasons)[number];
export interface TrialQuality {
  reasons: QualityReason[];
}
export interface PresentationQuality {
  version: 1;
  pending: QualityReason[];
  presented: boolean;
  events: {
    activeMilliseconds: number;
    reason: QualityReason;
    gapMilliseconds: number;
  }[];
}
export const stimulusMeasures = [
  "diameter",
  "contrast",
  "spacing",
  "offset",
  "items",
  "load",
  "speed",
  "exposure",
  "tolerance",
  "deadline",
] as const;
export type StimulusMeasure = (typeof stimulusMeasures)[number];
export type StimulusValues = Partial<Record<StimulusMeasure, number>>;
export interface AdaptiveTrial {
  activity: PracticeActivity;
  profileKey: string;
  challenge: number;
  check: boolean;
  values: StimulusValues;
}
export interface OutcomeEvidence {
  trial: number;
  success: number;
  responseMilliseconds: number;
  activeMilliseconds: number;
  challenge: number;
}
export interface PracticeChannel {
  activity: PracticeActivity;
  key: string;
  conditions: string;
  challenge: number;
  phase: AdaptationPhase;
  samples: number;
  sessionSamples: number;
  windows: number;
  reversals: number;
  direction: -1 | 0 | 1;
  coarseWindows: number;
  holdIncreases: number;
  checkFailures: number;
  sinceCheck: number;
  checking: boolean;
  pending: OutcomeEvidence[];
  recent: OutcomeEvidence[];
  lastAdjustmentMilliseconds: number;
  lastEvidenceAt?: string;
}
export const decisionReasons = [
  "evidence",
  "finding",
  "working",
  "support",
  "ceiling",
  "check",
  "lapse",
  "quality",
  "replay",
  "recheck",
] as const;
export type DecisionReason = (typeof decisionReasons)[number];
export interface AdaptationDecision {
  id: number;
  activity: PracticeActivity;
  profileKey: string;
  activeMilliseconds: number;
  trials: number[];
  performance: number | null;
  responseMilliseconds: number | null;
  before: number;
  after: number;
  phase: AdaptationPhase;
  reason: DecisionReason;
  sampleCount: number;
  values: StimulusValues;
}
export interface PracticeAdaptation {
  version: 1;
  channels: Partial<Record<PracticeActivity, PracticeChannel>>;
  decisions: AdaptationDecision[];
  consumedTrials: number;
  sequence: number;
  activityOffset?: number;
  contexts?: Record<string, string>;
  viewport?: { width: number; height: number; pixelRatio: number };
}
export interface PracticeProfile {
  key: string;
  updatedAt: string;
  channel: PracticeChannel;
}
