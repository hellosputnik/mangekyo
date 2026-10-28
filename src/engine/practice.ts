import {
  defaults,
  exerciseKinds,
  pursuitPatterns,
  validate,
  type Configuration,
  type ExerciseKind,
  type PracticePreferences,
  type PracticeSetups,
} from "./model";
import { applyPursuitPreset } from "../exercises/pursuit";
import type { PracticeMode } from "./model";
export type { PracticeMode, PracticeSetup, PracticeSetups } from "./model";
export function practiceDefaults(kind: ExerciseKind): Configuration {
  return {
    ...defaults,
    ...(kind === "tap" || kind === "follow"
      ? { size: 44, touchTolerance: 100 }
      : {}),
    ...(kind === "follow" ? { speed: 0.04 } : {}),
    ...(kind === "crowding" ? { size: 44 } : {}),
  };
}

export function initialPracticeSetups(): PracticeSetups {
  return {
    pursuit: { mode: "Default", configuration: { ...defaults } },
    saccades: { mode: "Default", configuration: { ...defaults } },
    visual: { mode: "Default", configuration: { ...defaults } },
    contrast: { mode: "Default", configuration: { ...defaults } },
    tap: { mode: "Default", configuration: practiceDefaults("tap") },
    follow: { mode: "Default", configuration: practiceDefaults("follow") },
    crowding: { mode: "Default", configuration: practiceDefaults("crowding") },
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
            ...practiceDefaults(kind),
            duration: previous.duration,
            distance: previous.distance,
            hand: previous.hand,
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

/** Saved choices are independent of recorded sessions and adaptive profiles. */
export function parsePracticePreferences(
  input: unknown,
): PracticePreferences | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (
    !exerciseKinds.includes(value.kind as ExerciseKind) ||
    !["Left", "Right", "Both"].includes(String(value.eye)) ||
    !value.setups ||
    typeof value.setups !== "object"
  )
    return null;
  const setups = initialPracticeSetups();
  for (const kind of exerciseKinds) {
    const setup = (value.setups as Record<string, unknown>)[kind];
    // Backups made before this exercise existed retain their six setups.
    if (kind === "crowding" && setup === undefined) continue;
    if (!setup || typeof setup !== "object") return null;
    const entry = setup as Record<string, unknown>;
    if (
      !["Default", "Custom"].includes(String(entry.mode)) ||
      !entry.configuration ||
      typeof entry.configuration !== "object"
    )
      return null;
    const settings = entry.configuration as Record<string, unknown>;
    if (
      settings.crowdingSpacing !== undefined &&
      (typeof settings.crowdingSpacing !== "number" ||
        !Number.isFinite(settings.crowdingSpacing) ||
        settings.crowdingSpacing < 0.15 ||
        settings.crowdingSpacing > 3)
    )
      return null;
    const numeric = [
      "duration",
      "size",
      "speed",
      "contrast",
      "complexity",
      "exposure",
      "jumpPause",
      "jumpDistance",
      "distance",
      "touchTolerance",
      "tapPaceSeconds",
    ] as const;
    if (
      numeric.some(
        (key) =>
          typeof settings[key] !== "number" || !Number.isFinite(settings[key]),
      ) ||
      !pursuitPatterns.includes(settings.pattern as Configuration["pattern"]) ||
      (settings.pursuitPreset !== undefined &&
        settings.pursuitPreset !== "Custom" &&
        !pursuitPatterns.includes(
          settings.pursuitPreset as Configuration["pattern"],
        )) ||
      !["Opening", "Orientation", "Shape"].includes(
        String(settings.stimulus),
      ) ||
      !["Grating", "Shape"].includes(String(settings.contrastStimulus)) ||
      !["Left", "Right"].includes(String(settings.hand)) ||
      typeof settings.tapConfirm !== "boolean" ||
      (settings.gentleMotion !== undefined &&
        typeof settings.gentleMotion !== "boolean") ||
      ![settings.foreground, settings.background].every(
        (color) => typeof color === "string" && /^#[\da-f]{6}$/i.test(color),
      )
    )
      return null;
    const configuration = validate({
      ...defaults,
      ...settings,
    } as Configuration);
    if (numeric.some((key) => configuration[key] !== settings[key]))
      return null;
    setups[kind] = { mode: entry.mode as PracticeMode, configuration };
  }
  return {
    kind: value.kind as ExerciseKind,
    eye: value.eye as PracticePreferences["eye"],
    setups,
  };
}

export function defaultPracticePreferences(): PracticePreferences {
  return { kind: "pursuit", eye: "Left", setups: initialPracticeSetups() };
}
