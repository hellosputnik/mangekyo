import {
  bounded,
  isAttentionExercise,
  validate,
  type AttentionRound,
  type AttentionTask,
  type Session,
} from "../engine/model";
import type { Exercise } from "./exercise";
import { responseScore } from "./responses";
import { renderAttention } from "./attention-renderer";
import {
  trackingParameters,
  trackingPositions,
  trackingProgress,
  nextTrackingDifficulty,
  trackingProtocol,
  trackingTransitionProtocol,
  trackingCueMilliseconds,
} from "./tracking";

export const maximumAttentionDifficulty = 24;
export type AttentionPhase = "cue" | "present" | "delay" | "answer";
const integer = (random: () => number, maximum: number) =>
  Math.min(maximum - 1, Math.floor(Math.max(0, random()) * maximum));
function shuffled(values: number[], random: () => number) {
  for (let index = values.length - 1; index > 0; index--) {
    const other = integer(random, index + 1);
    [values[index], values[other]] = [values[other], values[index]];
  }
  return values;
}
const range = (count: number) =>
  Array.from({ length: count }, (_, index) => index);

function taskFor(session: Session, index: number): AttentionTask {
  if (session.kind === "tracking") return "Track";
  if (session.kind === "sequence") return "Numbers";
  if (session.kind === "search") {
    const task = session.configuration.searchTask ?? "Mixed";
    return task === "Mixed"
      ? (["Count", "Match", "Moving"] as const)[index % 3]
      : task;
  }
  const task = session.configuration.recallTask ?? "Mixed";
  return task === "Mixed"
    ? (["Locations", "Digits", "Directions", "Compare"] as const)[index % 4]
    : task;
}

export function createAttentionRound(
  session: Session,
  random: () => number = Math.random,
): AttentionRound {
  const settings = validate(session.configuration);
  const difficulty = Math.floor(
    bounded(session.difficulty, 0, maximumAttentionDifficulty, 0),
  );
  const index = session.attentionRound ? session.attentionRound.index + 1 : 0;
  const task = taskFor(session, index);
  const load = Math.min(
    4,
    (settings.recallItems ?? 1) + Math.floor(difficulty / 6),
  );
  const round: AttentionRound = {
    version: 1,
    index,
    seed: Math.floor(random() * 4294967296) >>> 0,
    startedAtMilliseconds: session.activeMilliseconds,
    difficulty,
    cue: integer(random, 4),
    items: [],
    choices: [],
    answers: [],
    selected: [],
    presentation: {
      task,
      itemCount: 0,
      load: 1,
      exposureMilliseconds: 0,
      delayMilliseconds: 0,
      trackingMilliseconds: 0,
      speed: settings.gentleMotion
        ? Math.min(settings.speed, 0.08)
        : settings.speed,
      replays: 0,
    },
  };
  const presentation = round.presentation;
  if (task === "Track") {
    const parameters = trackingParameters(settings, difficulty);
    round.items = range(parameters.objects);
    round.cue = integer(random, round.items.length);
    round.answers = [round.cue];
    presentation.trackingVersion = 2;
    presentation.trackingMilliseconds = parameters.milliseconds;
    presentation.speed = parameters.speed;
  } else if (["Count", "Match", "Moving"].includes(task)) {
    const count =
      task === "Match"
        ? Math.min(12, (settings.searchItems ?? 6) + Math.floor(difficulty / 4))
        : Math.min(
            12,
            (settings.searchItems ?? 6) + Math.floor(difficulty / 3),
          );
    const matches =
      task === "Match" ? 1 : 1 + integer(random, Math.min(4, count - 1));
    round.items = shuffled(
      range(count).map((index) =>
        index < matches ? round.cue : (round.cue + 1 + integer(random, 3)) % 4,
      ),
      random,
    );
    round.choices = task === "Match" ? range(count) : [1, 2, 3, 4];
    round.answers = [
      task === "Match" ? round.items.indexOf(round.cue) : matches - 1,
    ];
    if (task === "Moving") {
      presentation.speed =
        Math.max(0.06, presentation.speed) * (1 + difficulty * 0.02);
      if (settings.gentleMotion)
        presentation.speed = Math.min(0.08, presentation.speed);
      presentation.exposureMilliseconds =
        ((count * 0.9 + 1.5) * 1000) / Math.max(0.6, presentation.speed / 0.16);
      presentation.delayMilliseconds = 400;
    }
  } else if (task === "Numbers") {
    round.items = shuffled(
      range(
        Math.min(
          12,
          (settings.sequenceItems ?? 6) + Math.floor(difficulty / 4),
        ),
      ).map((index) => index + 1),
      random,
    );
    round.answers = range(round.items.length).map((index) =>
      round.items.indexOf(index + 1),
    );
    presentation.load = round.items.length;
  } else {
    presentation.load = load;
    presentation.exposureMilliseconds = Math.max(
      800,
      (settings.recallExposure ?? 1.8) * 1000 * Math.pow(0.99, difficulty),
    );
    presentation.delayMilliseconds = (settings.recallDelay ?? 0.6) * 1000;
    if (task === "Locations") {
      round.items = range(6);
      round.answers = shuffled(range(6), random).slice(0, load);
    } else if (task === "Digits") {
      const digits = Math.min(4, load + 1);
      const minimum = 10 ** (digits - 1);
      const answer = minimum + integer(random, minimum * 9);
      const choices = new Set([answer]);
      // A bounded construction also works with a deterministic random source.
      let offset = 1 + integer(random, minimum * 9 - 1);
      while (choices.size < 4) {
        choices.add(minimum + ((answer - minimum + offset) % (minimum * 9)));
        offset++;
      }
      round.choices = shuffled([...choices], random);
      round.items = [answer];
      round.answers = [round.choices.indexOf(answer)];
      presentation.load = digits;
    } else if (task === "Directions") {
      round.items = range(load).map(() => integer(random, 4));
      round.answers = [...round.items];
      round.choices = range(4);
      presentation.exposureMilliseconds *= load;
    } else {
      const first = integer(random, 4);
      const same = random() < 0.5;
      round.items = [
        first,
        same ? first : (first + 1 + integer(random, 3)) % 4,
      ];
      round.answers = [same ? 0 : 1];
      round.choices = [0, 1];
      presentation.load = 2;
    }
  }
  presentation.itemCount = round.items.length;
  if (!round.choices.length) round.choices = range(round.items.length);
  return round;
}

export const cueMilliseconds = (round: AttentionRound) =>
  round.presentation.task === "Track" ? trackingCueMilliseconds : 1000;
export function attentionPhase(session: Session): AttentionPhase {
  const round = session.attentionRound;
  if (!round) return "cue";
  const elapsed =
    session.activeMilliseconds -
    round.startedAtMilliseconds -
    cueMilliseconds(round);
  if (elapsed < 0) return "cue";
  const presentation = round.presentation;
  if (
    elapsed <
    presentation.exposureMilliseconds + presentation.trackingMilliseconds
  )
    return "present";
  if (
    elapsed <
    presentation.exposureMilliseconds +
      presentation.trackingMilliseconds +
      presentation.delayMilliseconds
  )
    return "delay";
  return "answer";
}
export function spatialAttentionTask(task: AttentionTask) {
  return ["Track", "Match", "Locations", "Numbers"].includes(task);
}

export function attentionPositions(
  round: AttentionRound,
  milliseconds: number,
  width: number,
  height: number,
) {
  const count = round.items.length;
  if (round.presentation.task !== "Track") {
    // Prefer complete rows, then center a shorter final row. Remembered locations
    // retain the same arrangement across orientation changes.
    const candidates = range(count).map((index) => index + 1);
    const cost = (columns: number) => {
      const rows = Math.ceil(count / columns);
      const aspect = width / columns / Math.max(1, height / rows);
      return (
        Math.abs(Math.log(Math.max(0.001, aspect))) +
        ((columns * rows - count) / count) * 2
      );
    };
    const columns =
      round.presentation.task === "Locations"
        ? 3
        : candidates.sort((left, right) => cost(left) - cost(right))[0];
    const rows = Math.ceil(count / columns);
    return range(count).map((index) => {
      const row = Math.floor(index / columns);
      const rowCount = Math.min(columns, count - row * columns);
      return {
        x:
          (((index % columns) + 0.5 + (columns - rowCount) / 2) * width) /
          columns,
        y: ((row + 0.5) * height) / rows,
      };
    });
  }
  return trackingPositions(round, milliseconds, width, height);
}

export function attentionProgress(session: Session) {
  if (session.kind === "tracking") return trackingProgress(session);
  const required = session.difficulty < 2 ? 5 : 8;
  const recent = [];
  for (let index = session.trials.length - 1; index >= 0; index--) {
    if (session.trials[index].difficulty !== session.difficulty) break;
    recent.unshift(session.trials[index]);
  }
  return {
    required,
    correct: recent
      .filter((trial) => trial.attention?.replays === 0)
      .slice(-required - 1)
      .filter((trial) => trial.correct).length,
  };
}
function advanceDifficulty(session: Session) {
  if (session.kind === "tracking") {
    session.difficulty = nextTrackingDifficulty(session);
    return;
  }
  if (session.trials.at(-1)?.attention?.replays) return;
  const recent = session.trials
    .filter((trial) => trial.attention?.replays === 0)
    .slice(-5);
  if (
    recent.length >= 3 &&
    recent.slice(-3).filter((trial) => !trial.correct).length >= 2
  ) {
    session.difficulty = Math.max(0, session.difficulty - 1);
    return;
  }
  const progress = attentionProgress(session);
  if (
    progress.correct >= progress.required &&
    recent.slice(-3).every((trial) => trial.correct)
  )
    session.difficulty = Math.min(
      maximumAttentionDifficulty,
      session.difficulty + 1,
    );
}

/** Foreground active time and serializable round state; no DOM, wall clock or React. */
export class AttentionExercise implements Exercise {
  private running = false;
  constructor(
    private session: Session,
    private random: () => number = Math.random,
  ) {}
  initialize() {
    this.running = true;
    if (this.session.kind === "tracking") {
      const previous = this.session.attentionRound;
      this.session.protocol = this.session.trials.some(
        (trial) => trial.attention?.trackingVersion !== 2,
      )
        ? trackingTransitionProtocol
        : trackingProtocol;
      if (previous && previous.presentation.trackingVersion !== 2) {
        const replacement = createAttentionRound(this.session, this.random);
        replacement.index = previous.index;
        replacement.presentation.replays = previous.presentation.replays + 1;
        this.session.attentionRound = replacement;
      }
    }
    if (!this.session.attentionRound)
      this.session.attentionRound = createAttentionRound(
        this.session,
        this.random,
      );
  }
  update(_seconds: number, _level: number) {}
  terminate() {
    this.running = false;
  }
  replay() {
    if (
      !this.running ||
      this.session.status !== "running" ||
      !this.session.attentionRound
    )
      return false;
    this.session.attentionRound.selected = [];
    this.session.attentionRound.startedAtMilliseconds =
      this.session.activeMilliseconds;
    this.session.attentionRound.presentation.replays++;
    return true;
  }
  choose(choice: number) {
    const session = this.session;
    const round = session.attentionRound;
    if (
      !this.running ||
      session.status !== "running" ||
      !round ||
      attentionPhase(session) !== "answer" ||
      !Number.isInteger(choice) ||
      choice < 0 ||
      choice >= round.choices.length
    )
      return null;
    const task = round.presentation.task;
    if (
      ["Numbers", "Locations"].includes(task) &&
      round.selected.includes(choice)
    )
      return null;
    const correct =
      task === "Locations"
        ? round.answers.includes(choice)
        : round.answers[round.selected.length] === choice;
    round.selected.push(choice);
    const complete = !correct || round.selected.length === round.answers.length;
    const previousDifficulty = session.difficulty;
    if (complete) {
      session.trials.push({
        correct,
        difficulty: round.difficulty,
        responseMilliseconds: Math.max(
          0,
          session.activeMilliseconds -
            round.startedAtMilliseconds -
            cueMilliseconds(round) -
            round.presentation.exposureMilliseconds -
            round.presentation.trackingMilliseconds -
            round.presentation.delayMilliseconds,
        ),
        attention: { ...round.presentation },
      });
      advanceDifficulty(session);
      session.attentionRound = createAttentionRound(session, this.random);
    }
    return {
      correct,
      complete,
      levelUp: session.difficulty > previousDifficulty,
      ...responseScore(session.trials),
    };
  }
  render(context: CanvasRenderingContext2D, width: number, height: number) {
    if (this.running && isAttentionExercise(this.session.kind))
      renderAttention(context, width, height, this.session);
  }
}
