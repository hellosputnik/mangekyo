import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { defaults, initialData, type Session } from "../engine/model";
import { initializeAdaptation, practiceChannel } from "../adaptive/practice";
import {
  bindPracticeProfiles,
  rememberPracticeProfiles,
} from "../adaptive/profiles";
import { recordResponse } from "../exercises/responses";
import { load, save } from "./store";
import { mergeBackup } from "./backup";

it("recovers new evidence as interrupted without crediting absence or consuming the last decision twice", async () => {
  const session: Session = {
    id: "new-recovery",
    kind: "contrast",
    eye: "Left",
    configuration: { ...defaults },
    startedAt: new Date().toISOString(),
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
  initializeAdaptation(session);
  session.adaptation!.viewport = { width: 390, height: 300, pixelRatio: 3 };
  bindPracticeProfiles(session, []);
  for (let index = 0; index < 9; index++) {
    session.activeMilliseconds += 1000;
    session.presentationQuality!.presented = true;
    recordResponse(session, true, 1000, {
      width: 390,
      height: 300,
      pixelRatio: 3,
    });
  }
  session.slices = [
    { date: "2026-10-29", timezone: "UTC", offset: 0, milliseconds: 9000 },
  ];
  const data = { ...initialData(), current: session };
  rememberPracticeProfiles(data, session);
  await save(data);
  const recovered = await load();
  expect(recovered.current!.status).toBe("interrupted");
  expect(recovered.current!.activeMilliseconds).toBe(9000);
  expect(recovered.current!.adaptation!.consumedTrials).toBe(9);
  expect(practiceChannel(recovered.current!, "contrast")!.pending).toHaveLength(
    0,
  );
  expect(recovered.current!.presentationQuality!.pending).toContain(
    "interruption",
  );
  expect(
    recordResponse(recovered.current!, true, 300000, {
      width: 390,
      height: 300,
      pixelRatio: 3,
    }),
  ).toBeNull();
  expect(recovered.practiceProfiles).toEqual(data.practiceProfiles);
  expect(() =>
    mergeBackup(initialData(), JSON.parse(JSON.stringify(recovered))),
  ).not.toThrow();
});
