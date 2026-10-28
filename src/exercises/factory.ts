import type { Session } from "../engine/model";
import { isTouchExercise } from "../engine/model";
import { VisualExercise, type Exercise } from "./exercise";
import { TouchExercise } from "./touch";
import { initializePursuitMotion } from "./pursuit";
export function createExercise(
  session: Session,
  random: () => number = Math.random,
): Exercise {
  initializePursuitMotion(session, random);
  return isTouchExercise(session.kind)
    ? new TouchExercise(session, random)
    : new VisualExercise(
        session.kind,
        session.configuration,
        random,
        session.pursuitSeed,
      );
}
