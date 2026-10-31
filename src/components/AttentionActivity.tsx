import { useEffect, useRef, useState } from "react";
import type { Session } from "../engine/model";
import {
  attentionPhase,
  attentionPositions,
  attentionProgress,
  spatialAttentionTask,
  maximumAttentionDifficulty,
} from "../exercises/attention";
import { useI18n } from "../i18n/react";
import { Icon } from "./Icon";
import { trackingChoices, trackingCalibrating } from "../exercises/tracking";
import { activityRules } from "../adaptive/rules";

const directionKeys = [
  "answer.right",
  "answer.down",
  "answer.left",
  "answer.up",
] as const;
const arrows = ["→", "↓", "←", "↑"];
function useRoundCopy(session: Session) {
  const { t, number } = useI18n();
  const round = session.attentionRound;
  if (!round) return null;
  const task = round.presentation.task;
  const phase = attentionPhase(session);
  const values = {
    direction: t(directionKeys[round.cue % 4]).toLocaleLowerCase(),
    letter: String.fromCharCode(65 + round.cue),
    count: number(round.selected.length),
    total: number(round.answers.length),
    number: number(round.selected.length + 1),
  };
  return {
    round,
    task,
    phase,
    prompt: t(
      `attention.${phase === "answer" ? "question" : "cue"}.${task}`,
      values,
    ),
  };
}

export function AttentionStatus({
  session,
  sound,
  onSound,
}: {
  session: Session;
  sound?: boolean;
  onSound?: () => void;
}) {
  const { t, number } = useI18n();
  const copy = useRoundCopy(session);
  const progress = attentionProgress(session);
  const channel = copy ? session.adaptation?.channels[copy.task] : null;
  const progressValue = channel ? channel.pending.length : progress.correct;
  const progressText = channel
    ? channel.checking
      ? t("balance.checking")
      : t("balance.review", { count: number(progressValue), total: number(5) })
    : t("attention.progress", {
        correct: number(Math.min(progress.correct, progress.required)),
        total: number(progress.required),
      });
  return (
    <div className="attention-status">
      <div className="attention-status-row">
        <strong>
          {channel
            ? t("balance.round", {
                number: number((session.attentionRound?.index ?? 0) + 1),
              })
            : t("attention.level", { level: number(session.difficulty + 1) })}
        </strong>
        <span>
          {(
            channel
              ? channel.phase === "finding"
              : session.kind === "tracking" && trackingCalibrating(session)
          )
            ? t("challenge.calibrating")
            : copy
              ? t(`attention.task.${copy.task}`)
              : ""}
        </span>
        {onSound && (
          <button
            type="button"
            className="quiet sound-toggle"
            onClick={onSound}
            aria-label={t("challenge.sound")}
            aria-pressed={sound}
            title={t(sound ? "challenge.muteSound" : "challenge.enableSound")}
          >
            <Icon name={sound ? "SoundOn" : "SoundOff"} />
          </button>
        )}
      </div>
      <progress
        value={Math.min(progressValue, progress.required)}
        max={progress.required}
        aria-label={progressText}
      />
      <small>
        {(
          channel
            ? channel.challenge >=
              activityRules(session, channel.activity).maximum - 1e-6
            : session.difficulty === maximumAttentionDifficulty
        )
          ? t("attention.maximum")
          : progressText}
      </small>
    </div>
  );
}

/** Real buttons preserve touch cancellation, keyboard navigation and VoiceOver. */
export function AttentionTargets({
  session,
  onChoose,
}: {
  session: Session;
  onChoose: (choice: number, method?: "pointer" | "keyboard") => void;
}) {
  const { t, number } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const round = session.attentionRound;
  const available =
    round &&
    spatialAttentionTask(round.presentation.task) &&
    attentionPhase(session) === "answer";
  const positions = available
    ? attentionPositions(
        round,
        session.activeMilliseconds,
        size.width,
        size.height,
      )
    : [];
  const targets =
    round?.presentation.task === "Track"
      ? trackingChoices(positions)
      : positions.map((point, index) => ({
          ...point,
          index,
          position: index + 1,
        }));
  return (
    <div className="attention-targets" ref={container}>
      {available &&
        targets.map(({ x, y, index, position }) => {
          const selected = round.selected.includes(index);
          const value =
            round.presentation.task === "Numbers"
              ? round.items[index]
              : position;
          return (
            <button
              type="button"
              key={`${round.index}-${index}`}
              className={`attention-target ${selected ? "is-selected" : ""} ${round.presentation.task === "Match" ? "symbol-target" : ""}`}
              style={{ left: x, top: y }}
              aria-label={t(
                selected ? "attention.selected" : "attention.select",
                { number: number(value) },
              )}
              aria-pressed={selected}
              disabled={session.status !== "running" || selected}
              onClick={(event) =>
                onChoose(index, event.detail === 0 ? "keyboard" : "pointer")
              }
            >
              <span
                aria-hidden="true"
                style={
                  round.presentation.task === "Numbers" && !selected
                    ? {
                        fontSize: Math.max(
                          16,
                          Math.min(28, session.configuration.size / 2),
                        ),
                        color: session.configuration.foreground,
                        opacity: session.configuration.contrast,
                      }
                    : undefined
                }
              >
                {round.presentation.task === "Track"
                  ? ""
                  : selected
                    ? "✓"
                    : number(value)}
              </span>
            </button>
          );
        })}
    </div>
  );
}

export function AttentionAnswers({
  session,
  onChoose,
  onReplay,
}: {
  session: Session;
  onChoose: (choice: number, method?: "pointer" | "keyboard") => void;
  onReplay: () => void;
}) {
  const { t, number } = useI18n();
  const copy = useRoundCopy(session);
  if (!copy) return null;
  const { round, phase, task, prompt } = copy;
  const ready = phase === "answer" && session.status === "running";
  const spatial = spatialAttentionTask(task);
  return (
    <section
      className="answer-section attention-answers"
      aria-labelledby="attention-question"
    >
      <div className="attention-phase" role="status" aria-atomic="true">
        {t(
          phase === "cue"
            ? "attention.prepare"
            : phase === "present"
              ? "attention.watch"
              : phase === "delay"
                ? "attention.wait"
                : "attention.respond",
        )}
      </div>
      <h3 id="attention-question" tabIndex={-1}>
        {prompt}
      </h3>
      {!spatial && (
        <div
          className={`answers attention-choice-grid ${task === "Directions" ? "direction-pad" : ""}`}
        >
          {round.choices.map((value, index) => {
            const label =
              task === "Directions"
                ? t(directionKeys[index])
                : task === "Compare"
                  ? t(index === 0 ? "attention.same" : "attention.different")
                  : String(value);
            return (
              <button
                type="button"
                key={index}
                className={`answer-${index}`}
                disabled={!ready}
                onClick={(event) =>
                  onChoose(index, event.detail === 0 ? "keyboard" : "pointer")
                }
                aria-label={ready ? label : t("attention.watch")}
              >
                {ready ? (task === "Directions" ? arrows[index] : label) : "·"}
              </button>
            );
          })}
        </div>
      )}
      <div className="attention-round-actions">
        <span>{t("attention.round", { number: number(round.index + 1) })}</span>
        <button
          type="button"
          className="quiet"
          disabled={session.status !== "running"}
          onClick={onReplay}
        >
          {t("attention.replay")}
        </button>
      </div>
      {round.presentation.replays > 0 && (
        <p className="fine">{t("attention.replayNote")}</p>
      )}
    </section>
  );
}
