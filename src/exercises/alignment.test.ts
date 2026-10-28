import { it, expect } from "vitest";
import { defaults, initialData, validate, type Session } from "../engine/model";
import {
  practiceDefaults,
  defaultPracticePreferences,
  parsePracticePreferences,
} from "../engine/practice";
import { configureCheckIn } from "../engine/check-in";
import { alignmentGeometry, alignmentDifficultyLimit } from "./alignment";
import { VisualExercise } from "./exercise";
import { recordResponse } from "./responses";
import { ActiveTimer } from "../engine/timer";
import { comparisonKey } from "../analytics/comparison";
import { checkInGroups } from "../analytics/check-ins";
import { mergeBackup } from "../persistence/backup";
const viewport = { width: 350, height: 400, pixelRatio: 3 };
const createSession = (): Session => ({
  id: "alignment",
  kind: "alignment",
  eye: "Left",
  configuration: practiceDefaults("alignment"),
  startedAt: "2026-10-28T10:00:00Z",
  status: "running",
  activeMilliseconds: 0,
  slices: [],
  trials: [],
  difficulty: 0,
  protocol: "alignment-offset-1",
  viewport: { ...viewport, changed: false },
});
it("fits both directions on narrow and landscape screens with pixel-aligned geometry and a one-pixel floor", () => {
  for (const dimensions of [
    { width: 280, height: 400 },
    { width: 740, height: 220 },
    { width: 80, height: 80 },
  ])
    for (const ratio of [1, 2, 3]) {
      let previous = Infinity;
      for (let level = 0; level <= alignmentDifficultyLimit; level++) {
        const geometry = alignmentGeometry(
          { ...practiceDefaults("alignment"), alignmentOffset: 64, size: 120 },
          level,
          { ...dimensions, pixelRatio: ratio },
        );
        expect(geometry.offset).toBeLessThanOrEqual(previous);
        expect(geometry.offset * ratio).toBeGreaterThanOrEqual(1);
        expect(geometry.offset * ratio).toBeCloseTo(
          Math.round(geometry.offset * ratio),
        );
        previous = geometry.offset;
        expect(geometry.upperX - geometry.offset).toBeGreaterThanOrEqual(0);
        expect(
          geometry.upperX + geometry.offset + geometry.width,
        ).toBeLessThanOrEqual(dimensions.width);
        expect(geometry.upperY).toBeGreaterThanOrEqual(0);
        expect(geometry.lowerY + geometry.length).toBeLessThanOrEqual(
          dimensions.height,
        );
        expect(
          geometry.lowerY - (geometry.upperY + geometry.length),
        ).toBeCloseTo(geometry.gap);
      }
    }
});
it.each([0, 1])(
  "renders and scores the lower-line direction %s consistently, and stops rendering on termination",
  (choice) => {
    const configuration = practiceDefaults("alignment");
    const exercise = new VisualExercise("alignment", configuration, () =>
      choice === 0 ? 0.1 : 0.9,
    );
    exercise.initialize();
    exercise.update(0, 0);
    const rectangles: number[][] = [];
    const context = {
      fillRect: (...values: number[]) => rectangles.push(values),
      getTransform: () => ({ a: 3 }),
    } as unknown as CanvasRenderingContext2D;
    exercise.render(context, viewport.width, viewport.height);
    const geometry = alignmentGeometry(configuration, 0, viewport);
    expect(rectangles[2][0] - rectangles[1][0]).toBeCloseTo(
      (choice === 0 ? -1 : 1) * geometry.offset,
    );
    expect(exercise.answer(choice)).toBe(true);
    expect(exercise.answer(1 - choice)).toBe(false);
    rectangles.length = 0;
    exercise.terminate();
    exercise.render(context, 350, 400);
    expect(rectangles).toHaveLength(1);
  },
);
it("reduces the offset after successful blocks, preserves line size, and gives visible support after errors", () => {
  const session = createSession();
  for (let index = 0; index < 5; index++)
    recordResponse(session, true, 500, viewport);
  const first = session.trials[0];
  const geometry = alignmentGeometry(
    session.configuration,
    session.difficulty,
    viewport,
  );
  expect(geometry.offset).toBeLessThan(first.alignmentOffset!);
  expect(geometry.length).toBe(first.alignmentLength);
  expect(geometry.gap).toBe(first.alignmentGap);
  expect(geometry.width).toBe(first.alignmentWidth);
  const hardOffset = geometry.offset;
  for (let index = 0; index < 5; index++)
    recordResponse(session, false, 500, viewport);
  expect(
    alignmentGeometry(session.configuration, session.difficulty, viewport)
      .offset,
  ).toBeGreaterThan(hardOffset);
  for (let index = 0; index < 500; index++)
    recordResponse(session, true, 500, viewport);
  expect(
    alignmentGeometry(session.configuration, session.difficulty, viewport)
      .offset * 3,
  ).toBe(1);
  for (let index = 0; index < 5; index++)
    recordResponse(session, false, 500, viewport);
  expect(
    alignmentGeometry(session.configuration, session.difficulty, viewport)
      .offset * 3,
  ).toBeGreaterThan(1);
});
it("keeps check-ins fixed, complete and separate from ordinary practice without altering saved levels", () => {
  const data = initialData();
  data.levels.alignment = 8;
  const session = configureCheckIn(createSession());
  session.status = "paused";
  let now = 0;
  const timer = new ActiveTimer(
    session,
    () => now,
    () => new Date("2026-10-28T10:00:12Z"),
  );
  timer.resume();
  for (let index = 0; index < 12; index++) {
    now += 1000;
    timer.checkpoint();
    recordResponse(session, true, 1000, viewport);
  }
  timer.finish();
  expect(session.status).toBe("completed");
  expect(session.activeMilliseconds).toBe(12000);
  expect(
    new Set(session.trials.map((trial) => trial.alignmentOffset)).size,
  ).toBe(1);
  expect(data.levels.alignment).toBe(8);
  const adaptive = { ...session, checkIn: undefined };
  expect(comparisonKey(adaptive)).not.toBe(comparisonKey(session));
  expect(checkInGroups([session])).toHaveLength(1);
  const altered = structuredClone(session);
  altered.configuration.alignmentGap = 24;
  expect(comparisonKey(altered)).not.toBe(comparisonKey(session));
  data.sessions = [session];
  const restored = mergeBackup(initialData(), JSON.parse(JSON.stringify(data)));
  expect(restored.sessions[0].trials).toEqual(session.trials);
  expect(restored.levels.alignment).toBe(8);
  const invalid = structuredClone(data);
  invalid.sessions[0].trials[0].alignmentOffset = 0;
  expect(() => mergeBackup(initialData(), invalid)).toThrow();
});
it("validates extreme settings and adds the eighth setup to older backups without losing earlier choices", () => {
  expect(
    validate({
      ...defaults,
      alignmentOffset: Infinity,
      alignmentWidth: -1,
      alignmentGap: 999,
    }),
  ).toMatchObject({ alignmentOffset: 12, alignmentWidth: 1, alignmentGap: 80 });
  const legacy = JSON.parse(JSON.stringify(defaultPracticePreferences()));
  delete legacy.setups.alignment;
  legacy.setups.pursuit.configuration.duration = 155;
  const parsed = parsePracticePreferences(legacy)!;
  expect(parsed.setups.alignment.configuration.size).toBe(64);
  expect(parsed.setups.pursuit.configuration.duration).toBe(155);
  legacy.setups.visual.configuration.alignmentOffset = Infinity;
  expect(parsePracticePreferences(legacy)).toBeNull();
});
