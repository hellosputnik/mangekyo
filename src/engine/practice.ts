import { defaults, type Configuration, type ExerciseKind } from "./model";
import { applyPursuitPreset } from "../exercises/pursuit";

export type PracticeMode = "Default" | "Custom";
export interface PracticeSetup {
  mode: PracticeMode;
  configuration: Configuration;
}
export type PracticeSetups = Record<ExerciseKind, PracticeSetup>;

export function initialPracticeSetups(): PracticeSetups {
  return {
    pursuit: { mode: "Default", configuration: { ...defaults } },
    saccades: { mode: "Default", configuration: { ...defaults } },
    visual: { mode: "Default", configuration: { ...defaults } },
    contrast: { mode: "Default", configuration: { ...defaults } },
  };
}

export function selectPracticeMode(
  setups: PracticeSetups,
  kind: ExerciseKind,
  mode: PracticeMode,
): PracticeSetups {
  const previous = setups[kind].configuration;
  const configuration =
    kind === "pursuit"
      ? applyPursuitPreset(previous, mode === "Default" ? "Mixed" : "Custom")
      : mode === "Default"
        ? {
            ...defaults,
            duration: previous.duration,
            distance: previous.distance,
          }
        : { ...previous };
  return { ...setups, [kind]: { mode, configuration } };
}

export function updatePracticeSetting<Key extends keyof Configuration>(
  setups: PracticeSetups,
  kind: ExerciseKind,
  key: Key,
  value: Configuration[Key],
): PracticeSetups {
  return {
    ...setups,
    [kind]: {
      ...setups[kind],
      configuration: { ...setups[kind].configuration, [key]: value },
    },
  };
}
