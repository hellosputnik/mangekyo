import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { load, save } from "./store";
import { initialData, defaults } from "../engine/model";
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
