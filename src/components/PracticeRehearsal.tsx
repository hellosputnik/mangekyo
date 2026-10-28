import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import {
  isTouchExercise,
  supportsCheckIn,
  type Configuration,
  type ExerciseKind,
} from "../engine/model";
import { ActiveTimer } from "../engine/timer";
import { createRehearsal } from "../engine/rehearsal";
import { createExercise } from "../exercises/factory";
import type { Exercise } from "../exercises/exercise";
import { TouchExercise, type Point } from "../exercises/touch";
import { useI18n } from "../i18n/react";
import { Modal } from "./Modal";

function RehearsalStage({
  kind,
  configuration,
  gentleMotion,
}: {
  kind: ExerciseKind;
  configuration: Configuration;
  gentleMotion: boolean;
}) {
  const { t } = useI18n();
  const [session] = useState(() =>
    createRehearsal(kind, configuration, gentleMotion),
  );
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Exercise | null>(null);
  const timer = useRef<ActiveTimer | null>(null);
  const pointer = useRef<number | null>(null);
  const keyboardHeld = useRef(false);
  const keyboardPosition = useRef<Point | null>(null);
  const [keyboardCursor, setKeyboardCursor] = useState<Point | null>(null);
  const [paused, setPaused] = useState(false);
  const [feedback, setFeedback] = useState("");
  const drawOnce = useRef(() => {});
  const release = () => {
    keyboardHeld.current = false;
    if (renderer.current instanceof TouchExercise)
      renderer.current.release(true);
    const identifier = pointer.current;
    pointer.current = null;
    if (identifier !== null && canvas.current?.hasPointerCapture(identifier))
      canvas.current.releasePointerCapture(identifier);
  };
  const pause = () => {
    timer.current?.pause();
    release();
    session.awaitingTouch = false;
    setPaused(true);
    drawOnce.current();
  };
  useEffect(() => {
    const exercise = createExercise(session);
    const clock = new ActiveTimer(session);
    renderer.current = exercise;
    timer.current = clock;
    exercise.initialize();
    if (kind !== "follow") clock.resume();
    let frame = 0;
    let disposed = false;
    const draw = () => {
      frame = 0;
      const element = canvas.current;
      if (!element || disposed) return;
      if (document.hidden) {
        pause();
        return;
      }
      if (session.status === "running") {
        clock.checkpoint();
        if (exercise instanceof TouchExercise) exercise.sample();
      }
      const bounds = element.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 3);
      if (exercise instanceof TouchExercise) {
        if (
          exercise.setViewport(bounds.width, bounds.height) &&
          (pointer.current !== null || keyboardHeld.current)
        )
          pause();
        exercise.drainCues();
      }
      if (
        element.width !== Math.round(bounds.width * ratio) ||
        element.height !== Math.round(bounds.height * ratio)
      ) {
        element.width = Math.round(bounds.width * ratio);
        element.height = Math.round(bounds.height * ratio);
      }
      const context = element.getContext("2d");
      if (context) {
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        exercise.update(session.activeMilliseconds / 1000, 0);
        exercise.render(context, bounds.width, bounds.height);
      }
      if (session.status === "running") frame = requestAnimationFrame(draw);
    };
    drawOnce.current = () => {
      if (!frame && !disposed) frame = requestAnimationFrame(draw);
    };
    drawOnce.current();
    const resize = new ResizeObserver(() => drawOnce.current());
    if (canvas.current) resize.observe(canvas.current);
    const hidden = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      disposed = true;
      clock.pause();
      release();
      exercise.terminate();
      cancelAnimationFrame(frame);
      resize.disconnect();
      document.removeEventListener("visibilitychange", hidden);
      renderer.current = null;
      timer.current = null;
      drawOnce.current = () => {};
    };
  }, []);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const complete = (position: Point) => {
    if (!(renderer.current instanceof TouchExercise)) return;
    timer.current?.checkpoint();
    const result = renderer.current.pointerUp(position);
    release();
    if (kind === "follow") {
      timer.current?.pause();
      session.awaitingTouch = true;
    }
    if (result)
      setFeedback(t(result.correct ? "rehearsal.correct" : "rehearsal.retry"));
    drawOnce.current();
  };
  const keyboardDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const exercise = renderer.current;
    if (
      paused ||
      document.hidden ||
      pointer.current !== null ||
      !(exercise instanceof TouchExercise) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    exercise.setViewport(bounds.width, bounds.height);
    const position =
      keyboardPosition.current ??
      (kind === "follow"
        ? exercise.handlePoint()
        : { x: bounds.width / 2, y: bounds.height / 2 });
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      const step = event.shiftKey ? 24 : 8;
      const next = {
        x: Math.max(0, Math.min(bounds.width, position.x + direction.x * step)),
        y: Math.max(
          0,
          Math.min(bounds.height, position.y + direction.y * step),
        ),
      };
      timer.current?.checkpoint();
      if (keyboardHeld.current && kind === "follow") exercise.pointerMove(next);
      keyboardPosition.current = next;
      if (kind === "tap") setKeyboardCursor(next);
      return;
    }
    if (
      event.repeat ||
      keyboardHeld.current ||
      event.key !== (kind === "follow" ? " " : "Enter")
    )
      return;
    event.preventDefault();
    const press = kind === "follow" ? exercise.handlePoint() : position;
    if (!exercise.pointerDown(press)) return;
    keyboardPosition.current = press;
    keyboardHeld.current = true;
    session.awaitingTouch = false;
    timer.current?.resume();
    if (kind === "tap") setKeyboardCursor(press);
    drawOnce.current();
  };
  const choices =
    kind === "alignment"
      ? (["answer.left", "answer.right"] as const)
      : kind === "contrast"
        ? ([
            "answer.topLeft",
            "answer.topRight",
            "answer.bottomLeft",
            "answer.bottomRight",
          ] as const)
        : ([
            "answer.right",
            "answer.down",
            "answer.left",
            "answer.up",
          ] as const);
  return (
    <>
      <p className="rehearsal-instruction">{t(`rehearsal.${kind}`)}</p>
      <div className="rehearsal-canvas">
        <canvas
          ref={canvas}
          tabIndex={isTouchExercise(kind) ? 0 : undefined}
          role={isTouchExercise(kind) ? "group" : "img"}
          aria-label={t("rehearsal.stimulus")}
          aria-describedby={
            isTouchExercise(kind) ? "rehearsal-keyboard" : undefined
          }
          onKeyDown={keyboardDown}
          onKeyUp={(event) => {
            if (
              keyboardHeld.current &&
              keyboardPosition.current &&
              event.key === (kind === "follow" ? " " : "Enter")
            ) {
              event.preventDefault();
              complete(keyboardPosition.current);
            }
          }}
          onBlur={() => {
            if (keyboardHeld.current) pause();
          }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (
              paused ||
              !event.isPrimary ||
              event.button !== 0 ||
              pointer.current !== null ||
              keyboardHeld.current ||
              !(renderer.current instanceof TouchExercise)
            )
              return;
            timer.current?.checkpoint();
            if (!renderer.current.pointerDown(point(event))) return;
            event.preventDefault();
            pointer.current = event.pointerId;
            setKeyboardCursor(null);
            event.currentTarget.setPointerCapture(event.pointerId);
            session.awaitingTouch = false;
            timer.current?.resume();
            drawOnce.current();
          }}
          onPointerMove={(event) => {
            if (
              pointer.current !== event.pointerId ||
              !(renderer.current instanceof TouchExercise)
            )
              return;
            event.preventDefault();
            timer.current?.checkpoint();
            renderer.current.pointerMove(point(event));
          }}
          onPointerUp={(event) => {
            if (
              pointer.current !== event.pointerId ||
              !(renderer.current instanceof TouchExercise)
            )
              return;
            event.preventDefault();
            complete(point(event));
          }}
          onPointerCancel={() => {
            release();
            timer.current?.pause();
            session.awaitingTouch = true;
            drawOnce.current();
          }}
          onLostPointerCapture={(event) => {
            if (pointer.current === event.pointerId) {
              release();
              timer.current?.pause();
              session.awaitingTouch = true;
              drawOnce.current();
            }
          }}
        />
        {kind === "tap" && keyboardCursor && (
          <span
            className="keyboard-cursor"
            aria-hidden="true"
            style={{ left: keyboardCursor.x, top: keyboardCursor.y }}
          />
        )}
      </div>
      {isTouchExercise(kind) && (
        <p className="keyboard-instructions" id="rehearsal-keyboard">
          {t(kind === "tap" ? "keyboard.tap" : "keyboard.follow")}
        </p>
      )}
      {supportsCheckIn(kind) && (
        <div className="rehearsal-answers">
          {choices.map((key, index) => (
            <button
              key={key}
              type="button"
              disabled={paused}
              onClick={() => {
                const correct = renderer.current?.answer?.(index);
                setFeedback(
                  t(correct ? "rehearsal.correct" : "rehearsal.retry"),
                );
                drawOnce.current();
              }}
            >
              {t(key)}
            </button>
          ))}
        </div>
      )}
      <p className="rehearsal-feedback" role="status" aria-atomic="true">
        {feedback || t("rehearsal.noScore")}
      </p>
      <button
        className="rehearsal-pause"
        type="button"
        onClick={() => {
          if (!paused) pause();
          else {
            if (kind === "follow") {
              session.status = "paused";
              session.awaitingTouch = true;
            } else timer.current?.resume();
            setPaused(false);
            drawOnce.current();
          }
        }}
      >
        {t(paused ? "session.resume" : "session.pause")}
      </button>
    </>
  );
}
export function PracticeRehearsal({
  open,
  onClose,
  kind,
  configuration,
  gentleMotion,
}: {
  open: boolean;
  onClose: () => void;
  kind: ExerciseKind;
  configuration: Configuration;
  gentleMotion: boolean;
}) {
  const { t, exerciseName } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("rehearsal.title")}
      description={exerciseName(kind)}
      className="rehearsal-dialog"
    >
      <RehearsalStage
        key={kind}
        kind={kind}
        configuration={configuration}
        gentleMotion={gentleMotion}
      />
    </Modal>
  );
}
