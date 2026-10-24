import { it, expect, vi } from "vitest";
import { VisualExercise } from "./exercise";
import { defaults } from "../engine/model";
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
