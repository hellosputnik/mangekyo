import { useEffect, useRef } from "react";
import {
  isAttentionExercise,
  type Configuration,
  type ExerciseKind,
  type Session,
} from "../engine/model";
import { createExercise } from "../exercises/factory";
import { TouchExercise } from "../exercises/touch";
import { useI18n } from "../i18n/react";
export function StimulusPreview({
  kind,
  configuration,
}: {
  kind: ExerciseKind;
  configuration: Configuration;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const session: Session = {
      id: "preview",
      kind,
      eye: "Both",
      configuration: structuredClone(configuration),
      startedAt: "",
      status: "paused",
      activeMilliseconds: 0,
      slices: [],
      trials: [],
      difficulty: 0,
    };
    const exercise = createExercise(session, () => 0.5);
    exercise.initialize();
    if (isAttentionExercise(kind) && kind !== "tracking")
      session.activeMilliseconds = 1600;
    const draw = () => {
      const { width, height } = element.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 3);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      const context = element.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (exercise instanceof TouchExercise)
        exercise.setViewport(width, height);
      exercise.update(0, 0);
      exercise.render(context, width, height);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => {
      observer.disconnect();
      exercise.terminate();
    };
  }, [kind, configuration]);
  return (
    <figure className="stimulus-preview">
      <canvas ref={canvas} role="img" aria-label={t("preview.title")} />
      <figcaption>{t("preview.note")}</figcaption>
    </figure>
  );
}
