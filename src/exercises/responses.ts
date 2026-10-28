import type { Session, Trial } from "../engine/model";
import { adapt } from "../engine/timer";
import { crowdingGeometry, nextCrowdingDifficulty } from "./crowding";
import { checkInComplete } from "../engine/check-in";
import { alignmentGeometry, nextAlignmentDifficulty } from "./alignment";
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
    !["visual", "contrast", "crowding", "alignment"].includes(session.kind) ||
    checkInComplete(session)
  )
    return null;
  const previousDifficulty = session.difficulty;
  session.trials.push({
    correct,
    responseMilliseconds: Math.max(0, responseMilliseconds),
    difficulty: previousDifficulty,
    ...(session.kind === "alignment"
      ? {
          alignmentOffset: alignmentGeometry(
            session.configuration,
            previousDifficulty,
            viewport,
          ).offset,
          alignmentGap: alignmentGeometry(
            session.configuration,
            previousDifficulty,
            viewport,
          ).gap,
          alignmentWidth: alignmentGeometry(
            session.configuration,
            previousDifficulty,
            viewport,
          ).width,
          alignmentLength: alignmentGeometry(
            session.configuration,
            previousDifficulty,
            viewport,
          ).length,
        }
      : {}),
    ...(session.kind === "crowding"
      ? {
          stimulusDiameter: crowdingGeometry(
            session.configuration,
            previousDifficulty,
            viewport,
          ).diameter,
          crowdingSpacing: crowdingGeometry(
            session.configuration,
            previousDifficulty,
            viewport,
          ).gap,
        }
      : {}),
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
  if (session.checkIn)
    return { ...responseScore(session.trials), enlarged: false };
  if (session.kind === "alignment") {
    session.difficulty = nextAlignmentDifficulty(
      session.configuration,
      previousDifficulty,
      session.trials.map((trial) => trial.correct),
      viewport,
    );
  } else if (session.kind === "crowding") {
    session.difficulty = nextCrowdingDifficulty(
      previousDifficulty,
      session.trials.map((trial) => trial.correct),
    );
  } else if (session.kind === "visual") {
    let firstAtSize = session.trials.length - 1;
    while (
      firstAtSize > 0 &&
      session.trials[firstAtSize - 1].difficulty === previousDifficulty
    )
      firstAtSize--;
    session.difficulty = nextVisualDifficulty(
      previousDifficulty,
      session.trials.slice(firstAtSize),
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
