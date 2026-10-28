import { useState } from "react";
import type { Session } from "../engine/model";
import { useI18n } from "../i18n/react";
import { Icon } from "./Icon";
import { SessionDetails } from "./SessionDetails";

export function SessionHistory({ sessions }: { sessions: Session[] }) {
  const { t, number, time, exerciseName, eyeLabel, statusLabel } = useI18n();
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
              {eyeLabel(session.eye)} ·{" "}
              {session.checkIn && `${t("checkIn.title")} · `}
              {statusLabel(session.status)}
            </small>
          </summary>
          <SessionDetails session={session} />
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
