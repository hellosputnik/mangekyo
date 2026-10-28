import {
  attentionTasks,
  isAttentionExercise,
  type ExerciseKind,
} from "../engine/model";

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";
const finite = (
  value: unknown,
  minimum: number,
  maximum: number,
): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum;
const integer = (
  value: unknown,
  minimum: number,
  maximum: number,
): value is number =>
  finite(value, minimum, maximum) && Number.isInteger(value);
const list = (value: unknown, maximum: number): value is number[] =>
  Array.isArray(value) &&
  value.length <= maximum &&
  value.every((item) => integer(item, 0, 9999));

export function validAttentionConfiguration(value: Record<string, unknown>) {
  for (const [key, minimum, maximum, whole] of [
    ["trackingObjects", 3, 6, true],
    ["trackingSeconds", 2, 12, false],
    ["searchItems", 4, 12, true],
    ["recallItems", 1, 4, true],
    ["recallExposure", 0.8, 5, false],
    ["recallDelay", 0, 3, false],
    ["sequenceItems", 4, 12, true],
  ] as const) {
    if (
      value[key] !== undefined &&
      (!finite(value[key], minimum, maximum) ||
        (whole && !Number.isInteger(value[key])))
    )
      return false;
  }
  return (
    (value.searchTask === undefined ||
      ["Mixed", "Count", "Match", "Moving"].includes(
        String(value.searchTask),
      )) &&
    (value.recallTask === undefined ||
      ["Mixed", "Locations", "Digits", "Directions", "Compare"].includes(
        String(value.recallTask),
      ))
  );
}

export function validAttentionPresentation(value: unknown) {
  return (
    record(value) &&
    attentionTasks.includes(value.task as (typeof attentionTasks)[number]) &&
    integer(value.itemCount, 1, 12) &&
    integer(value.load, 1, 12) &&
    finite(value.exposureMilliseconds, 0, 60000) &&
    finite(value.delayMilliseconds, 0, 3000) &&
    finite(value.trackingMilliseconds, 0, 12000) &&
    finite(value.speed, 0.02, 2) &&
    integer(value.replays, 0, 100000)
  );
}
export function validAttentionPresentationForKind(
  value: unknown,
  kind: ExerciseKind,
) {
  if (!validAttentionPresentation(value) || !record(value)) return false;
  const tasks = {
    tracking: ["Track"],
    search: ["Count", "Match", "Moving"],
    memory: ["Locations", "Digits", "Directions", "Compare"],
    sequence: ["Numbers"],
  };
  return isAttentionExercise(kind) && tasks[kind].includes(String(value.task));
}

export function validAttentionRound(
  value: unknown,
  kind: ExerciseKind,
  elapsed: number,
) {
  if (
    !isAttentionExercise(kind) ||
    !record(value) ||
    value.version !== 1 ||
    !integer(value.index, 0, 1000000) ||
    !integer(value.seed, 0, 4294967295) ||
    !finite(value.startedAtMilliseconds, 0, elapsed) ||
    !integer(value.difficulty, 0, 24) ||
    !integer(value.cue, 0, 11) ||
    !list(value.items, 12) ||
    !value.items.length ||
    !list(value.choices, 12) ||
    !value.choices.length ||
    !list(value.answers, 12) ||
    !value.answers.length ||
    !list(value.selected, 12) ||
    value.selected.length >= value.answers.length ||
    !validAttentionPresentationForKind(value.presentation, kind)
  )
    return false;
  const presentation = value.presentation as Record<string, unknown>;
  const allowed = {
    tracking: ["Track"],
    search: ["Count", "Match", "Moving"],
    memory: ["Locations", "Digits", "Directions", "Compare"],
    sequence: ["Numbers"],
  };
  if (
    !allowed[kind].includes(String(presentation.task)) ||
    presentation.itemCount !== value.items.length ||
    value.answers.some((choice) => choice >= (value.choices as number[]).length)
  )
    return false;
  const answers = value.answers;
  if (presentation.task === "Locations") {
    if (
      new Set(answers).size !== answers.length ||
      new Set(value.selected).size !== value.selected.length ||
      !value.selected.every((choice) => answers.includes(choice))
    )
      return false;
  } else if (
    !value.selected.every((choice, index) => choice === answers[index])
  )
    return false;
  if (
    presentation.task === "Numbers" &&
    (new Set(value.items).size !== value.items.length ||
      value.items.some(
        (item) => item < 1 || item > (value.items as number[]).length,
      ))
  )
    return false;
  if (
    presentation.task === "Track" &&
    (value.items.length < 3 ||
      value.items.length > 6 ||
      value.cue >= value.items.length ||
      presentation.trackingMilliseconds === 0)
  )
    return false;
  if (
    ["Count", "Match", "Moving", "Directions", "Compare"].includes(
      String(presentation.task),
    ) &&
    value.items.some((item) => item > 3)
  )
    return false;
  return true;
}
