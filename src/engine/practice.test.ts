import { describe, expect, it } from "vitest";
import { defaults, exerciseKinds } from "./model";
import {
  initialPracticeSetups,
  selectPracticeMode,
  updatePracticeSetting,
  practiceDefaults,
} from "./practice";

describe("exercise configuration", () => {
  it("keeps customization and duration independent when switching exercises", () => {
    const initial = initialPracticeSetups();
    const custom = selectPracticeMode(initial, "saccades", "Custom");
    const resized = updatePracticeSetting(custom, "saccades", "size", 72);
    const scheduled = updatePracticeSetting(
      resized,
      "saccades",
      "duration",
      155,
    );
    expect(scheduled.saccades).toMatchObject({
      mode: "Custom",
      configuration: { size: 72, duration: 155 },
    });
    for (const kind of ["pursuit", "visual", "contrast"] as const) {
      expect(scheduled[kind]).toEqual(initial[kind]);
    }
    expect(initial.saccades.configuration.size).toBe(defaults.size);
  });
  it.each(exerciseKinds)(
    "restores %s defaults while retaining duration and viewing distance",
    (kind) => {
      let setups = initialPracticeSetups();
      setups = selectPracticeMode(setups, kind, "Custom");
      setups = updatePracticeSetting(setups, kind, "size", 90);
      setups = updatePracticeSetting(setups, kind, "duration", 155);
      setups = updatePracticeSetting(setups, kind, "distance", 55);
      setups = updatePracticeSetting(setups, kind, "hand", "Left");
      setups = updatePracticeSetting(setups, kind, "contrast", 0.2);
      const restored = selectPracticeMode(setups, kind, "Default");
      expect(restored[kind]).toEqual({
        mode: "Default",
        configuration: {
          ...practiceDefaults(kind),
          duration: 155,
          distance: 55,
          hand: "Left",
        },
      });
      expect(setups[kind].configuration.size).toBe(90);
    },
  );
  it("opens custom with the current settings and keeps recorded snapshots unchanged", () => {
    const initial = initialPracticeSetups();
    const configuration = {
      ...initial.visual.configuration,
      stimulus: "Shape" as const,
    };
    const setups = { ...initial, visual: { ...initial.visual, configuration } };
    const opened = selectPracticeMode(setups, "visual", "Custom");
    expect(opened.visual.configuration).toEqual(configuration);
    const changed = updatePracticeSetting(opened, "visual", "contrast", 0.4);
    expect(changed.visual.configuration.contrast).toBe(0.4);
    expect(configuration.contrast).toBe(defaults.contrast);
    expect(changed.contrast.configuration.contrast).toBe(defaults.contrast);
  });
});
