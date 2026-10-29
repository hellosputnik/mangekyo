import type {
  AttentionRound,
  Configuration,
  Session,
  Trial,
} from "../engine/model";

export const trackingProtocol = "attention-tracking-2";
export const trackingTransitionProtocol = "attention-tracking-transition-2";
export const trackingCueMilliseconds = 1400;
export const trackingCalibrationLimit = 6;

export function trackingParameters(
  settings: Configuration,
  difficulty: number,
) {
  const speed = Math.min(1.2, settings.speed * (1 + difficulty * 0.045));
  return {
    objects: Math.min(
      6,
      (settings.trackingObjects ?? 3) + Math.floor(difficulty / 4),
    ),
    speed: settings.gentleMotion ? Math.min(0.08, speed) : speed,
    milliseconds: Math.min(
      12000,
      ((settings.trackingSeconds ?? 4) +
        Math.max(0, Math.floor((difficulty - 12) / 4)) * 0.5) *
        1000,
    ),
  };
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export interface TrackingPoint {
  x: number;
  y: number;
}

/** Disjoint pairs cannot intersect. Balanced pairings keep every object involved. */
export function trackingPositions(
  round: AttentionRound,
  milliseconds: number,
  width: number,
  height: number,
): TrackingPoint[] {
  const count = round.items.length;
  const slots = Array.from({ length: count }, (_, index) => ({
    x: ((index + 0.5) * width) / count,
    y: height / 2,
  }));
  const objects = slots.map((_, index) => index);
  const random = seededRandom(round.seed);
  const firstOffset = random() < 0.5 ? 0 : 1;
  const elapsed = Math.min(
    round.presentation.trackingMilliseconds,
    Math.max(
      0,
      milliseconds - round.startedAtMilliseconds - trackingCueMilliseconds,
    ),
  );
  const meanLegMilliseconds = Math.max(
    650,
    (1100 * 0.16) / round.presentation.speed,
  );
  let started = 0;
  let previousOffset = -1;
  let repeated = 0;
  for (let leg = 0; ; leg++) {
    const duration = Math.max(
      round.presentation.speed <= 0.08 ? 2200 : 550,
      meanLegMilliseconds * (0.85 + random() * 0.3),
    );
    // Cover both initial pairings, then vary them without long idle runs.
    let offset = leg < 2 ? (firstOffset + leg) % 2 : random() < 0.5 ? 0 : 1;
    if (offset === previousOffset && repeated >= 2) offset = 1 - offset;
    repeated = offset === previousOffset ? repeated + 1 : 1;
    previousOffset = offset;
    const pairs = [];
    for (let slot = offset; slot < count - 1; slot += 2)
      pairs.push({
        first: slot,
        second: slot + 1,
        direction: random() < 0.5 ? -1 : 1,
      });
    if (started + duration <= elapsed) {
      for (const { first, second } of pairs)
        [objects[first], objects[second]] = [objects[second], objects[first]];
      started += duration;
      continue;
    }
    const result = slots.map((point) => ({ ...point }));
    objects.forEach((object, slot) => {
      result[object] = { ...slots[slot] };
    });
    const progress = Math.max(0, Math.min(1, (elapsed - started) / duration));
    const angle = Math.PI * (0.5 - Math.cos(progress * Math.PI) / 2);
    for (const { first, second, direction } of pairs) {
      const left = slots[first];
      const right = slots[second];
      const middle = (left.x + right.x) / 2;
      const horizontal = (left.x - right.x) / 2;
      const offsetX = horizontal * Math.cos(angle);
      const offsetY =
        direction *
        Math.min(Math.abs(horizontal), Math.max(12, height / 2 - 34)) *
        Math.sin(angle);
      result[objects[first]] = { x: middle + offsetX, y: height / 2 + offsetY };
      result[objects[second]] = {
        x: middle - offsetX,
        y: height / 2 - offsetY,
      };
    }
    return result;
  }
}

/** Answer labels describe current spatial order, never an object's original identity. */
export function trackingChoices(points: readonly TrackingPoint[]) {
  return points
    .map((point, index) => ({ ...point, index }))
    .sort((left, right) => left.x - right.x || left.y - right.y)
    .map((point, rank) => ({ ...point, position: rank + 1 }));
}

function currentTrackingTrials(session: Session) {
  const trials: Trial[] = [];
  for (let index = session.trials.length - 1; index >= 0; index--) {
    const trial = session.trials[index];
    if (
      trial.difficulty !== session.difficulty ||
      trial.attention?.trackingVersion !== 2
    )
      break;
    if (trial.attention.replays === 0) trials.unshift(trial);
  }
  return trials;
}

export function trackingCalibrating(session: Session) {
  if (session.difficulty >= trackingCalibrationLimit) return false;
  const trials = session.trials.filter(
    (trial) =>
      trial.attention?.trackingVersion === 2 && trial.attention.replays === 0,
  );
  return (
    !trials.some((trial) => trial.difficulty >= trackingCalibrationLimit) &&
    trials.filter((trial) => !trial.correct).length < 2
  );
}

export function trackingProgress(session: Session) {
  const required = trackingCalibrating(session)
    ? 3
    : session.difficulty < 12
      ? 8
      : 10;
  const trials = currentTrackingTrials(session).slice(-required - 1);
  return { required, correct: trials.filter((trial) => trial.correct).length };
}

/** Calibrate decisively only after several correct rounds, then make single steps. */
export function nextTrackingDifficulty(session: Session) {
  if (session.trials.at(-1)?.attention?.replays) return session.difficulty;
  const trials = currentTrackingTrials(session);
  const recent = trials.slice(-3);
  if (recent.filter((trial) => !trial.correct).length >= 2)
    return Math.max(0, session.difficulty - 1);
  const progress = trackingProgress(session);
  if (
    progress.correct < progress.required ||
    recent.length < 3 ||
    recent.some((trial) => !trial.correct)
  )
    return session.difficulty;
  const latencies = recent
    .map((trial) => trial.responseMilliseconds)
    .sort((left, right) => left - right);
  const calibrating = trackingCalibrating(session);
  const step = calibrating && latencies[1] <= 2500 ? 2 : 1;
  return Math.min(
    calibrating ? trackingCalibrationLimit : 24,
    session.difficulty + step,
  );
}
