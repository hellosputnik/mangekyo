import { it, expect, vi } from "vitest";
import { VisualExercise } from "./exercise";
import { defaults } from "../engine/model";
import { recordResponse } from "./responses";
import type { Session } from "../engine/model";
it("initializes deterministic answers and accepts response trials", () => {
  const exercise = new VisualExercise("visual", defaults, () => 0.5);
  exercise.initialize();
  expect(exercise.answer(2)).toBe(true);
  expect(exercise.answer(0)).toBe(false);
});
it("stops rendering stimuli after termination", () => {
  const context = {
    fillStyle: "",
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalAlpha: 1,
    strokeStyle: "",
  } as unknown as CanvasRenderingContext2D;
  const exercise = new VisualExercise("pursuit", defaults);
  exercise.initialize();
  exercise.update(1, 0);
  exercise.render(context, 390, 400);
  expect(context.arc).toHaveBeenCalledOnce();
  exercise.terminate();
  exercise.render(context, 390, 400);
  expect(context.arc).toHaveBeenCalledOnce();
});
it("renders the same shrinking size recorded for an answer, including past the former cap", () => {
  const context = {
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    getTransform: () => ({ a: 3 }),
  } as unknown as CanvasRenderingContext2D;
  const exercise = new VisualExercise("visual", defaults, () => 0);
  exercise.initialize();
  exercise.update(0, 12);
  exercise.render(context, 358, 320);
  const formerRadius = vi.mocked(context.arc).mock.calls[0][2];
  exercise.update(0, 30);
  exercise.render(context, 358, 320);
  const radius = vi.mocked(context.arc).mock.calls[1][2];
  expect(radius).toBeLessThan(formerRadius / 2);
  const session: Session = {
    id: "rendered",
    kind: "visual",
    eye: "Left",
    configuration: defaults,
    startedAt: "2026-10-26T10:00:00Z",
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 30,
  };
  recordResponse(session, true, 1000, {
    width: 358,
    height: 320,
    pixelRatio: 3,
  });
  expect(session.trials[0].stimulusDiameter).toBeCloseTo(radius * 2);
  exercise.update(0, 256);
  exercise.render(context, 358, 320);
  expect(vi.mocked(context.arc).mock.calls[2][2]).toBeCloseTo(2 / 3);
  expect(context.lineWidth).toBeCloseTo(1 / 3);
});

function contrastContext() {
  return {
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

it.each(["Grating", "Shape"] as const)(
  "changes %s contrast pattern size with its setting",
  (contrastStimulus) => {
    const render = (size: number) => {
      const context = contrastContext();
      const exercise = new VisualExercise(
        "contrast",
        { ...defaults, size, contrastStimulus },
        () => 0,
      );
      exercise.initialize();
      exercise.render(context, 390, 600);
      return context;
    };
    const small = render(12);
    const large = render(48);
    if (contrastStimulus === "Shape") {
      expect(vi.mocked(small.arc).mock.calls[0][2]).toBe(12);
      expect(vi.mocked(large.arc).mock.calls[0][2]).toBe(48);
    } else {
      const smallStripe = vi.mocked(small.fillRect).mock.calls[1];
      const largeStripe = vi.mocked(large.fillRect).mock.calls[1];
      expect(largeStripe[2]).toBeGreaterThan(smallStripe[2]);
      expect(largeStripe[3]).toBeGreaterThan(smallStripe[3]);
    }
  },
);

it.each([
  [320, 500],
  [844, 210],
])(
  "bounds maximum-size contrast panels within a %i by %i stage",
  (width, height) => {
    const context = contrastContext();
    const exercise = new VisualExercise(
      "contrast",
      { ...defaults, size: 120 },
      () => 0,
    );
    exercise.initialize();
    exercise.render(context, width, height);
    const panels = vi.mocked(context.strokeRect).mock.calls;
    expect(panels).toHaveLength(4);
    for (const [left, top, panelWidth, panelHeight] of panels) {
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(left + panelWidth).toBeLessThanOrEqual(width);
      expect(top + panelHeight).toBeLessThanOrEqual(height);
    }
    expect(panels[0][0] + panels[0][2]).toBeLessThan(panels[1][0]);
    expect(panels[0][1] + panels[0][3]).toBeLessThan(panels[2][1]);
  },
);
