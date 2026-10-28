import { exerciseKinds, type SavedSetup } from "./model";
import {
  defaultPracticePreferences,
  parsePracticePreferences,
} from "./practice";
export function parseSavedSetups(input: unknown): SavedSetup[] | null {
  if (!Array.isArray(input) || input.length > 30) return null;
  const parsed: SavedSetup[] = [];
  for (const value of input) {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.id !== "string" ||
      !value.id ||
      value.id.length > 100 ||
      typeof value.name !== "string" ||
      !value.name.trim() ||
      value.name.length > 60 ||
      !exerciseKinds.includes(value.kind) ||
      parsed.some((item) => item.id === value.id)
    )
      return null;
    const preferences = defaultPracticePreferences();
    preferences.setups[value.kind as SavedSetup["kind"]] = {
      mode: "Custom",
      configuration: value.configuration,
    };
    const validated = parsePracticePreferences(preferences);
    if (!validated) return null;
    parsed.push({
      id: value.id,
      name: value.name.trim(),
      kind: value.kind,
      configuration:
        validated.setups[value.kind as SavedSetup["kind"]].configuration,
    });
  }
  return parsed;
}
