import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { createSnapshotStore, SnapshotConflict } from "./store";
import { initialData } from "../engine/model";
it("atomically rejects an older tab snapshot and keeps the winning data, including without a notification channel", async () => {
  const first = createSnapshotStore(),
    second = createSnapshotStore();
  await Promise.all([first.load(), second.load()]);
  const winner = initialData();
  winner.preferences.goal = 45;
  await first.save(winner);
  const stale = initialData();
  stale.preferences.goal = 10;
  await expect(second.save(stale)).rejects.toBeInstanceOf(SnapshotConflict);
  expect((await first.load()).preferences.goal).toBe(45);
  const refreshed = await second.load();
  refreshed.preferences.goal = 60;
  await second.save(refreshed);
  expect((await first.load()).preferences.goal).toBe(60);
});
it("allows only one winner when two tabs race from the same loaded revision", async () => {
  const first = createSnapshotStore(),
    second = createSnapshotStore();
  const values = await Promise.all([first.load(), second.load()]);
  values[0].preferences.goal = 25;
  values[1].preferences.goal = 35;
  const results = await Promise.allSettled([
    first.save(values[0]),
    second.save(values[1]),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  const loser = results.find(
    (result) => result.status === "rejected",
  ) as PromiseRejectedResult;
  expect(loser.reason).toBeInstanceOf(SnapshotConflict);
  const winner = results[0].status === "fulfilled" ? 25 : 35;
  expect((await first.load()).preferences.goal).toBe(winner);
});
