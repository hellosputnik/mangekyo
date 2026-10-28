import type { Session } from "../engine/model";
import { sessionRecap } from "../analytics/recap";
import { useI18n } from "../i18n/react";
import { ExerciseArtwork } from "./ExerciseArtwork";

export function SessionRecap({ session }: { session: Session }) {
  const { t, time, percent, number, exerciseName, eyeLabel, patternLabel } =
    useI18n();
  const summary = sessionRecap(session);
  const metrics: { label: string; value: string }[] = [
    {
      label: t("statistics.activeTime"),
      value: time(summary.activeMilliseconds),
    },
    {
      label: t(session.checkIn ? "checkIn.answers" : "recap.planned"),
      value: session.checkIn
        ? `${number(session.trials.length)} / ${number(session.checkIn.targetTrials)}`
        : time(summary.plannedMilliseconds),
    },
  ];
  if (session.kind === "follow")
    metrics.push(
      {
        label: t("touch.onTarget"),
        value:
          summary.touch.onTargetRatio === null
            ? "—"
            : percent(summary.touch.onTargetRatio),
      },
      {
        label: t("touch.bestRun"),
        value: time(summary.touch.bestRunMilliseconds),
      },
    );
  else if (["visual", "contrast", "tap", "crowding"].includes(session.kind))
    metrics.push(
      {
        label: t(
          session.kind === "tap"
            ? "touch.hitRate"
            : "statistics.answerAccuracy",
        ),
        value: summary.accuracy === null ? "—" : percent(summary.accuracy),
      },
      { label: t("sessionDetails.bestRun"), value: number(summary.bestRun) },
    );
  else
    metrics.push(
      {
        label: t(
          session.kind === "pursuit" ? "config.pattern" : "config.exposure",
        ),
        value:
          session.kind === "pursuit"
            ? patternLabel(session.configuration.pattern)
            : t("statistics.seconds", {
                seconds: number(session.configuration.exposure, 1),
              }),
      },
      {
        label: t("recap.target"),
        value: t("touch.pixels", { value: number(session.configuration.size) }),
      },
    );
  return (
    <section className="session-recap" aria-labelledby="recap-title">
      <div className="recap-heading">
        <span className="report-art" aria-hidden="true">
          <ExerciseArtwork kind={session.kind} />
        </span>
        <div>
          <h2 id="recap-title" tabIndex={-1}>
            {t(summary.completed ? "recap.complete" : "recap.saved")}
          </h2>
          <p>
            {exerciseName(session.kind)} · {eyeLabel(session.eye)}
          </p>
        </div>
      </div>
      <dl className="recap-metrics">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
      <p className="recap-achievement">
        {session.checkIn
          ? t("checkIn.record", {
              count: number(session.trials.length),
              total: number(session.checkIn.targetTrials),
            })
          : session.challenge
            ? t("challenge.summary", {
                start: number(session.challenge.startingLevel + 1),
                highest: number(session.challenge.highestLevel + 1),
              })
            : ["visual", "contrast", "tap", "crowding"].includes(session.kind)
              ? t("recap.points", { points: number(summary.points) })
              : t("recap.trackingNote")}
      </p>
    </section>
  );
}
