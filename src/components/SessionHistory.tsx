import { useState } from "react";
import type { Session } from "../engine/model";
import { accuracy } from "../analytics/totals";
import { useI18n } from "../i18n/react";
import { Icon } from "./Icon";

export function SessionHistory({ sessions }: { sessions: Session[] }) {
  const {
    t,
    number,
    percent,
    time,
    date,
    exerciseName,
    eyeLabel,
    statusLabel,
    patternLabel,
    optionLabel,
  } = useI18n();
  const [visibleCount, setVisibleCount] = useState(20);
  return (
    <details className="panel statistics-history history-panel">
      <summary className="statistics-disclosure">
        <span>
          {t("progress.history")}{" "}
          <small>
            {t("statistics.sessionCount", { count: number(sessions.length) })}
          </small>
        </span>
        <Icon name="Chevron" />
      </summary>
      {!sessions.length && (
        <p className="empty-state">{t("statistics.noHistory")}</p>
      )}
      {sessions.slice(0, visibleCount).map((session) => (
        <details key={session.id}>
          <summary>
            {exerciseName(session.kind)} · {time(session.activeMilliseconds)}
            <small>
              {eyeLabel(session.eye)} · {statusLabel(session.status)}
            </small>
          </summary>
          <p>
            {date(session.startedAt, {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            ·{" "}
            {session.kind === "pursuit" ||
            session.kind === "saccades" ||
            accuracy(session) === null
              ? t("progress.noAccuracy")
              : t("progress.accuracy", {
                  percent: percent((accuracy(session) ?? 0) / 100),
                  count: number(session.trials.length),
                })}
            {(session.kind === "visual" || session.kind === "contrast") &&
              ` · ${t("progress.level", { level: number(session.difficulty + 1) })}`}
          </p>
          <p className="fine">
            {t(`progress.configuration.${session.kind}`, {
              size: number(session.configuration.size),
              contrast: number(session.configuration.contrast),
              speed: number(session.configuration.speed),
              pattern: patternLabel(session.configuration.pattern),
              distance: number(session.configuration.distance),
              exposure: number(session.configuration.exposure),
              jumpPause: number(session.configuration.jumpPause),
              jumpDistance: number(session.configuration.jumpDistance),
              stimulus: optionLabel(session.configuration.stimulus),
              contrastStimulus: optionLabel(
                session.configuration.contrastStimulus,
              ),
            })}
          </p>
        </details>
      ))}
      {sessions.length > visibleCount && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + 20)}
        >
          {t("statistics.moreHistory")}
        </button>
      )}
    </details>
  );
}
