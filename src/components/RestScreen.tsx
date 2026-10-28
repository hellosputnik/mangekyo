import type { Data, Session } from "../engine/model";
import { backupReminderDue } from "../persistence/durability";
import { useI18n } from "../i18n/react";
import { SessionRecap } from "./SessionRecap";
import { LandscapeHint, shouldRecommendLandscape } from "./LandscapeHint";
export function RestScreen({
  data,
  session,
  onExtend,
  onManual,
  onContinue,
  onRepeat,
  onEndRoutine,
  onExport,
  onSnooze,
}: {
  data: Data;
  session?: Session;
  onExtend: () => void;
  onManual: () => void;
  onContinue: () => void;
  onRepeat: () => void;
  onEndRoutine: () => void;
  onExport: () => void;
  onSnooze: () => void;
}) {
  const { t, time, exerciseName } = useI18n();
  const rest = data.breakState!;
  return (
    <main id="main-content" tabIndex={-1} className="rest rest-compact">
      <div className="rest-introduction">
        <h1 tabIndex={-1}>{t("rest.title")}</h1>
        <p>{t("rest.description")}</p>
      </div>
      {session && <SessionRecap session={session} />}
      <section className="rest-timing" aria-label={t("rest.eyebrow")}>
        <div>
          <span className="eyebrow">{t("rest.eyebrow")}</span>
          <strong className={rest.manual ? "manual-rest-value" : ""}>
            {rest.manual ? t("rest.manualTime") : time(rest.remaining * 1000)}
          </strong>
        </div>
        <p>
          {data.run
            ? t("rest.next", {
                exercise: exerciseName(
                  data.run.routine.steps[data.run.index].kind,
                ),
              })
            : t("rest.saved")}
        </p>
      </section>
      {data.run &&
        shouldRecommendLandscape(
          data.run.routine.steps[data.run.index].kind,
          data.practice?.setups[data.run.routine.steps[data.run.index].kind]
            .configuration.pattern ?? "Mixed",
        ) && <LandscapeHint />}
      <details className="rest-options">
        <summary>{t("rest.options")}</summary>
        <div className="actions">
          <button type="button" onClick={onExtend}>
            {t("rest.extend")}
          </button>
          <button type="button" onClick={onManual}>
            {t(rest.manual ? "rest.countdown" : "rest.manual")}
          </button>
        </div>
      </details>
      {backupReminderDue(data) && (
        <aside className="backup-reminder">
          <p>{t("durability.reminderNote")}</p>
          <div className="actions">
            <button type="button" onClick={onExport}>
              {t("settings.export")}
            </button>
            <button type="button" onClick={onSnooze}>
              {t("durability.later")}
            </button>
          </div>
        </aside>
      )}
      <div className="rest-next-actions">
        <button
          type="button"
          className="primary"
          onClick={data.run ? onContinue : session ? onRepeat : onContinue}
        >
          {t(
            data.run
              ? "rest.startNext"
              : session
                ? "recap.repeat"
                : "rest.back",
          )}
        </button>
        {(data.run || session) && (
          <button type="button" onClick={data.run ? onEndRoutine : onContinue}>
            {t(data.run ? "rest.endRoutine" : "rest.back")}
          </button>
        )}
      </div>
      <p className="fine">{t("rest.note")}</p>
    </main>
  );
}
