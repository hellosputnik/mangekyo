import { isResponseExercise, type Session } from "../engine/model";
import { responseScore } from "../exercises/responses";
import { summarizeTouch } from "./touch";
import { reliableTrial } from "./adaptation";

export function sessionRecap(session: Session) {
  const score = responseScore(session.trials);
  const measured = session.trials.filter(reliableTrial);
  return {
    activeMilliseconds: session.activeMilliseconds,
    plannedMilliseconds: session.configuration.duration * 1000,
    completed: session.status === "completed",
    accuracy:
      isResponseExercise(session.kind) && measured.length
        ? measured.filter((trial) => trial.correct).length / measured.length
        : null,
    points: score.points,
    bestRun: score.bestRun,
    touch: summarizeTouch([session]),
  };
}
