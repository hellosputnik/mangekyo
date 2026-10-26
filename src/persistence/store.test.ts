import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { load, save } from "./store";
import { initialData, defaults } from "../engine/model";
import {
  resetStatistics,
  undoStatisticsReset,
} from "../engine/statistics-reset";
it("persists structured state and recovers running sessions as interrupted", async () => {
  const data = initialData();
  data.current = {
    id: "recovery",
    kind: "visual",
    eye: "Left",
    configuration: defaults,
    startedAt: new Date().toISOString(),
    status: "running",
    activeMilliseconds: 4567,
    slices: [],
    trials: [],
    difficulty: 2,
  };
  await save(data);
  const recovered = await load();
  expect(recovered.current?.status).toBe("interrupted");
  expect(recovered.current?.activeMilliseconds).toBe(4567);
  expect(recovered.current?.difficulty).toBe(2);
});
it("stores a snapshot unaffected by subsequent mutation", async () => {
  const data = initialData();
  const saving = save(data);
  data.preferences.goal = 90;
  await saving;
  expect((await load()).preferences.goal).toBe(30);
});
it("restores the selected language and migrates old preferences to device language", async () => {
  const data = initialData();
  data.preferences.language = "vi";
  await save(data);
  expect((await load()).preferences.language).toBe("vi");
  const { language: ignored, ...preferences } = data.preferences;
  await save({ ...data, preferences } as ReturnType<typeof initialData>);
  const migrated = await load();
  expect(migrated.preferences.language).toBe("system");
  expect(migrated.preferences.goal).toBe(data.preferences.goal);
});
it("keeps a statistics reset and its undo copy through reload", async () => {
  const data = initialData();
  data.sessions = [
    {
      id: "history",
      kind: "pursuit",
      eye: "Left",
      configuration: { ...defaults },
      startedAt: "2026-10-25T12:00:00Z",
      status: "abandoned",
      activeMilliseconds: 3000,
      slices: [],
      trials: [],
      difficulty: 0,
    },
  ];
  const reset = resetStatistics(data, {
    measurements: false,
    difficulty: false,
  });
  await save(reset);
  const reloaded = await load();
  expect(reloaded.sessions).toEqual([]);
  expect(reloaded.statisticsReset?.sessions[0].activeMilliseconds).toBe(3000);
  const restored = undoStatisticsReset(reloaded);
  await save(restored);
  expect((await load()).sessions).toEqual(data.sessions);
  expect((await load()).statisticsReset).toBeUndefined();
});
