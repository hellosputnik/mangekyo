import type { Session } from "../engine/model";
import { isTouchExercise, isAttentionExercise } from "../engine/model";
import { AttentionExercise } from "./attention";
import { VisualExercise, type Exercise } from "./exercise";
import { TouchExercise } from "./touch";
import { initializePursuitMotion } from "./pursuit";
export function createExercise(
  session: Session,
  random: () => number = Math.random,
): Exercise {
  initializePursuitMotion(session, random);
  if (isAttentionExercise(session.kind))
    return new AttentionExercise(session, random);
  return isTouchExercise(session.kind)
    ? new TouchExercise(session, random)
    : new VisualExercise(
        session.kind,
        session.configuration,
        random,
        session.pursuitSeed,
      );
}
