import { it, expect } from "vitest";
import { initialData } from "../engine/model";
import { mergeBackup } from "./backup";
it("round trips settings, routines, and professional measurements", () => {
  const data = initialData();
  data.preferences.goal = 20;
  data.routines = [
    {
      id: "r",
      name: "Routine",
      steps: [{ kind: "pursuit", duration: 60 }],
      rest: 60,
      manual: false,
    },
  ];
  data.measurements = [
    {
      id: "m",
      date: "2026-10-24",
      eye: "Left",
      method: "Snellen",
      value: "20/40",
    },
  ];
  expect(mergeBackup(initialData(), JSON.parse(JSON.stringify(data)))).toEqual(
    data,
  );
});
it("rejects malformed data without modifying existing records", () => {
  const data = initialData();
  expect(() => mergeBackup(data, { sessions: [{ id: "bad" }] })).toThrow();
  expect(data.sessions).toHaveLength(0);
});
it("deduplicates routine records on repeated imports", () => {
  const data = initialData();
  data.routines = [
    {
      id: "r",
      name: "Routine",
      steps: [{ kind: "pursuit", duration: 60 }],
      rest: 60,
      manual: false,
    },
  ];
  expect(mergeBackup(data, data).routines).toHaveLength(1);
});
it("round trips the selected language and accepts older backups without a language field", () => {
  const current = initialData();
  current.preferences.language = "vi";
  expect(mergeBackup(initialData(), current).preferences.language).toBe("vi");
  const { language: ignored, ...legacyPreferences } = initialData().preferences;
  expect(
    mergeBackup(current, { ...initialData(), preferences: legacyPreferences })
      .preferences.language,
  ).toBe("vi");
  expect(() =>
    mergeBackup(current, {
      ...current,
      preferences: { ...current.preferences, language: "invalid" },
    }),
  ).toThrow();
});
