import { isResponseExercise, type Session } from "../engine/model";
import { responseScore } from "../exercises/responses";
import { summarizeTouch } from "./touch";

export function sessionRecap(session: Session) {
  const score = responseScore(session.trials);
  return {
    activeMilliseconds: session.activeMilliseconds,
    plannedMilliseconds: session.configuration.duration * 1000,
    completed: session.status === "completed",
    accuracy:
      isResponseExercise(session.kind) && session.trials.length
        ? score.points / session.trials.length
        : null,
    points: score.points,
    bestRun: score.bestRun,
    touch: summarizeTouch([session]),
  };
}
