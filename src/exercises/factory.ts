import type { Session } from "../engine/model";
import { isTouchExercise } from "../engine/model";
import { VisualExercise, type Exercise } from "./exercise";
import { TouchExercise } from "./touch";
export function createExercise(session: Session): Exercise {
  return isTouchExercise(session.kind)
    ? new TouchExercise(session)
    : new VisualExercise(session.kind, session.configuration);
}
