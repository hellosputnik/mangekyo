import { useEffect, useId, useRef } from "react";
import type { Session } from "../engine/model";
import { activityEntries, type ActivityEntry } from "../analytics/activity";
import {
  sessionMoment,
  utcOffsetLabel,
  type SessionMoment,
} from "../analytics/session-time";
import { summarizePractice } from "../analytics/statistics";
import { responseScore } from "../exercises/responses";
import { useI18n } from "../i18n/react";

export function SessionDetails({
  session,
  entry,
}: {
  session: Session;
  entry?: ActivityEntry;
}) {
  const {
    t,
    number,
    percent,
    time,
    duration,
    calendarDate,
    sessionMomentText,
    eyeLabel,
    statusLabel,
    patternLabel,
    optionLabel,
  } = useI18n();
  const start = sessionMoment(session);
  const end = sessionMoment(session, "end");
  const responseExercise =
    session.kind === "visual" || session.kind === "contrast";
  const summary = summarizePractice([session]);
  const score = responseScore(session.trials);
  const sizes = session.trials.flatMap((trial) =>
    trial.stimulusDiameter === undefined ? [] : [trial.stimulusDiameter],
  );
  const configuration = session.configuration;
  const settings: { label: string; value: string }[] = [
    {
      label: t(
        session.kind === "pursuit" || session.kind === "saccades"
          ? "config.size"
          : "config.patternSize",
      ),
      value: number(configuration.size),
    },
    { label: t("config.contrast"), value: number(configuration.contrast) },
    { label: t("config.distance"), value: number(configuration.distance) },
  ];
  if (session.kind === "pursuit")
    settings.push(
      {
        label: t("config.pattern"),
        value: patternLabel(configuration.pattern),
      },
      { label: t("config.speed"), value: number(configuration.speed) },
      {
        label: t("config.complexity"),
        value: number(configuration.complexity),
      },
    );
  if (session.kind === "saccades")
    settings.push(
      { label: t("config.exposure"), value: number(configuration.exposure) },
      { label: t("config.jumpPause"), value: number(configuration.jumpPause) },
      {
        label: t("config.jumpDistance"),
        value: number(configuration.jumpDistance),
      },
      {
        label: t("config.tapConfirm"),
        value: t(configuration.tapConfirm ? "common.on" : "common.off"),
      },
    );
  if (session.kind === "visual")
    settings.push({
      label: t("config.visualTask"),
      value: optionLabel(configuration.stimulus),
    });
  if (session.kind === "contrast")
    settings.push({
      label: t("config.contrastTask"),
      value: optionLabel(configuration.contrastStimulus),
    });
  if (session.kind !== "contrast")
    settings.push({
      label: t("config.foreground"),
      value: configuration.foreground,
    });
  settings.push({
    label: t("config.background"),
    value: configuration.background,
  });
  const momentValue = (moment: SessionMoment | null) =>
    moment ? (
      <time dateTime={moment.timestamp}>
        <span>{sessionMomentText(moment, { dateStyle: "medium" })}</span>
        <strong>
          {sessionMomentText(moment, { hour: "numeric", minute: "2-digit" })}
        </strong>
        <small>{utcOffsetLabel(moment.offset)}</small>
      </time>
    ) : (
      t("sessionDetails.notRecorded")
    );
  const dayEntries = activityEntries({ sessions: [session], current: null });
  return (
    <div className="session-details">
      <dl className="session-facts">
        <div>
          <dt>{t("sessionDetails.started")}</dt>
          <dd>{momentValue(start)}</dd>
        </div>
        <div>
          <dt>{t("sessionDetails.ended")}</dt>
          <dd>{momentValue(end)}</dd>
        </div>
        <div>
          <dt>{t("statistics.activeTime")}</dt>
          <dd>{time(session.activeMilliseconds)}</dd>
        </div>
        <div>
          <dt>{t("sessionDetails.planned")}</dt>
          <dd>{duration(configuration.duration)}</dd>
        </div>
        <div>
          <dt>{t("practice.eye")}</dt>
          <dd>{eyeLabel(session.eye)}</dd>
        </div>
        <div>
          <dt>{t("sessionDetails.status")}</dt>
          <dd>{statusLabel(session.status)}</dd>
        </div>
      </dl>
      <p className="session-time-note">
        {start?.recorded
          ? t("sessionDetails.recordedZone", {
              zone: start.timeZone ?? utcOffsetLabel(start.offset),
            })
          : t("sessionDetails.deviceZone")}
      </p>
      <p className="session-time-note">{t("sessionDetails.activeNote")}</p>
      {entry && (entry.continued || dayEntries.length > 1) && (
        <p className="session-day-credit">
          {t("sessionDetails.dayCredit", {
            date: calendarDate(entry.date),
            time: time(entry.activeMilliseconds),
          })}
        </p>
      )}
      {responseExercise ? (
        <section className="session-results">
          <h3>{t("sessionDetails.results")}</h3>
          <dl className="session-facts">
            <div>
              <dt>{t("statistics.answerAccuracy")}</dt>
              <dd>
                {summary.accuracy === null ? "—" : percent(summary.accuracy)}
              </dd>
            </div>
            <div>
              <dt>{t("statistics.medianResponse")}</dt>
              <dd>
                {summary.medianResponseMilliseconds === null
                  ? "—"
                  : t("statistics.seconds", {
                      seconds: number(
                        summary.medianResponseMilliseconds / 1000,
                        1,
                      ),
                    })}
              </dd>
            </div>
            <div>
              <dt>{t("statistics.responses")}</dt>
              <dd>{number(summary.responseCount)}</dd>
            </div>
            <div>
              <dt>{t("sessionDetails.level")}</dt>
              <dd>{number(session.difficulty + 1)}</dd>
            </div>
            <div>
              <dt>{t("sessionDetails.bestRun")}</dt>
              <dd>{number(score.bestRun)}</dd>
            </div>
            {session.kind === "visual" && sizes.length > 0 && (
              <div>
                <dt>{t("sessionDetails.targetRange")}</dt>
                <dd>
                  {t("sessionDetails.targetPixels", {
                    small: number(Math.min(...sizes), 1),
                    large: number(Math.max(...sizes), 1),
                  })}
                </dd>
              </div>
            )}
          </dl>
          <p className="fine">
            {t("statistics.correctAnswers", {
              correct: number(summary.correctCount),
              total: number(summary.responseCount),
            })}
          </p>
          {sizes.length > 0 && (
            <p className="fine">{t("sessionDetails.targetNote")}</p>
          )}
        </section>
      ) : (
        <p className="fine">{t("statistics.noGazeScore")}</p>
      )}
      {dayEntries.length > 1 && (
        <section className="session-days">
          <h3>{t("sessionDetails.byDay")}</h3>
          <dl>
            {dayEntries
              .slice()
              .reverse()
              .map((day) => (
                <div key={day.key}>
                  <dt>{calendarDate(day.date)}</dt>
                  <dd>{time(day.activeMilliseconds)}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}
      <section className="session-configuration">
        <h3>{t("sessionDetails.configuration")}</h3>
        <dl>
          {settings.map((setting) => (
            <div key={setting.label}>
              <dt>{setting.label}</dt>
              <dd>{setting.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export function SessionDetailSheet({
  entry,
  onClose,
}: {
  entry: ActivityEntry | null;
  onClose: () => void;
}) {
  const { t, exerciseName, eyeLabel } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const identifier = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (entry && !element.open) element.showModal();
    if (!entry && element.open) element.close();
  }, [entry]);
  useEffect(() => {
    if (!entry) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [entry]);
  return (
    <dialog
      ref={dialog}
      className="custom-dialog session-dialog"
      aria-labelledby={`${identifier}-title`}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="custom-dialog-header">
        <div>
          <h2 id={`${identifier}-title`}>{t("sessionDetails.title")}</h2>
          {entry && (
            <p>
              {exerciseName(entry.session.kind)} · {eyeLabel(entry.session.eye)}
            </p>
          )}
        </div>
        <button type="button" className="primary" onClick={onClose}>
          {t("common.done")}
        </button>
      </div>
      <div className="custom-dialog-body">
        {entry && <SessionDetails session={entry.session} entry={entry} />}
      </div>
    </dialog>
  );
}
