import type { Session, Trial } from "../engine/model";
import { adapt } from "../engine/timer";
import {
  maximumVisualDifficulty,
  nextVisualDifficulty,
  visualTargetRadius,
  type StimulusViewport,
} from "./visual";

export function responseScore(trials: readonly Pick<Trial, "correct">[]) {
  let points = 0;
  let currentRun = 0;
  let bestRun = 0;
  for (const trial of trials) {
    if (trial.correct) {
      points++;
      currentRun++;
      bestRun = Math.max(bestRun, currentRun);
    } else currentRun = 0;
  }
  return { points, currentRun, bestRun };
}

/** Record the presented stimulus before advancing to the next difficulty. */
export function recordResponse(
  session: Session,
  correct: boolean,
  responseMilliseconds: number,
  viewport: StimulusViewport,
) {
  if (
    session.status !== "running" ||
    !["visual", "contrast"].includes(session.kind)
  )
    return null;
  const previousDifficulty = session.difficulty;
  session.trials.push({
    correct,
    responseMilliseconds: Math.max(0, responseMilliseconds),
    difficulty: previousDifficulty,
    ...(session.kind === "visual"
      ? {
          stimulusDiameter:
            visualTargetRadius(
              session.configuration,
              previousDifficulty,
              viewport,
            ) * 2,
        }
      : {}),
  });
  if (session.kind === "visual") {
    session.difficulty = nextVisualDifficulty(
      previousDifficulty,
      session.trials.slice(-3).map((trial) => trial.correct),
      maximumVisualDifficulty(session.configuration, viewport),
    );
  } else if (session.kind === "contrast" && session.trials.length % 5 === 0) {
    session.difficulty = adapt(
      previousDifficulty,
      session.trials.slice(-5).map((trial) => trial.correct),
    );
  }
  return {
    ...responseScore(session.trials),
    enlarged:
      session.kind === "visual" && session.difficulty < previousDifficulty,
  };
}
