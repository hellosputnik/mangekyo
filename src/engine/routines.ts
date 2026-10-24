import { bounded, type Data } from "./model";
export function advanceRoutine(data: Data): void {
  if (!data.run) return;
  data.run.index++;
  if (data.run.index >= data.run.routine.steps.length) data.run = null;
}
export function advanceBreak(
  remaining: number,
  delta: number,
  hidden: boolean,
): number {
  return hidden
    ? remaining
    : Math.max(0, remaining - Math.max(0, delta) / 1000);
}
export function validDuration(seconds: number): number {
  return bounded(seconds, 10, 3600, 300);
}
