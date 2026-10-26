import type { Data } from "../engine/model";
import type { ResetStatisticsOptions } from "../engine/statistics-reset";
import { buildStatistics } from "../analytics/statistics";
import { useI18n } from "../i18n/react";
import { ExerciseArtwork } from "./ExerciseArtwork";
import { SessionHistory } from "./SessionHistory";
import { ProfessionalMeasurements } from "./ProfessionalMeasurements";
import { StatisticsResetControls } from "./StatisticsResetControls";

export function Statistics({
  data,
  persist,
  onPractice,
  onExport,
  onReset,
  onUndo,
}: {
  data: Data;
  persist: (data: Data) => void;
  onPractice?: () => void;
  onExport: () => void;
  onReset: (options: ResetStatisticsOptions) => void;
  onUndo: () => void;
}) {
  const { t, number, percent, trainingTime, date, exerciseName, eyeLabel } =
    useI18n();
  const report = buildStatistics(data);
  const { summary, week } = report;
  const weekTime = week.reduce((sum, day) => sum + day.activeMilliseconds, 0);
  const weekDays = week.filter((day) => day.activeMilliseconds > 0).length;
  const weekMaximum = Math.max(1, ...week.map((day) => day.activeMilliseconds));
  return (
    <div className="statistics-page">
      <section className="lifetime-report" aria-labelledby="lifetime-title">
        <div className="report-heading">
          <h2 id="lifetime-title">{t("statistics.lifetime")}</h2>
          <span>
            {summary.firstDate
              ? t("statistics.since", { date: date(summary.firstDate) })
              : t("statistics.newReport")}
          </span>
        </div>
        <p className="lifetime-duration">
          {trainingTime(summary.activeMilliseconds)}
        </p>
        <p className="lifetime-caption">{t("statistics.activeTime")}</p>
        <dl className="lifetime-metrics">
          <div>
            <dt>{t("statistics.sessions")}</dt>
            <dd>{number(summary.sessionCount)}</dd>
          </div>
          <div>
            <dt>{t("statistics.practiceDays")}</dt>
            <dd>{number(summary.activeDays)}</dd>
          </div>
          <div>
            <dt>{t("statistics.responses")}</dt>
            <dd>{number(summary.responseCount)}</dd>
          </div>
          <div>
            <dt>{t("statistics.averageSession")}</dt>
            <dd>{trainingTime(summary.averageSessionMilliseconds)}</dd>
          </div>
        </dl>
        <p className="report-outcomes">
          {t("statistics.outcomes", {
            completed: number(summary.completedCount),
            stopped: number(summary.stoppedCount),
            interrupted: number(summary.interruptedCount),
          })}
        </p>
        {!summary.sessionCount && (
          <div className="statistics-empty">
            <p>{t("statistics.empty")}</p>
            {onPractice && (
              <button type="button" onClick={onPractice}>
                {t("practice.begin")}
              </button>
            )}
          </div>
        )}
      </section>
      <section className="statistics-week" aria-labelledby="week-title">
        <div className="report-heading">
          <h2 id="week-title">{t("statistics.week")}</h2>
          <strong>{trainingTime(weekTime)}</strong>
        </div>
        <p>{t("statistics.weekDays", { count: number(weekDays) })}</p>
        <ol className="activity-week" aria-label={t("statistics.dailyDetails")}>
          {week.map((day) => (
            <li
              key={day.date}
              aria-label={`${date(day.date)}: ${trainingTime(day.activeMilliseconds)}`}
            >
              <span className="activity-column" aria-hidden="true">
                <i
                  style={{
                    height: `${(day.activeMilliseconds / weekMaximum) * 100}%`,
                  }}
                />
              </span>
              <span aria-hidden="true">
                {date(day.date, { weekday: "short" })}
              </span>
            </li>
          ))}
        </ol>
        <details className="daily-details">
          <summary>{t("statistics.dailyDetails")}</summary>
          <dl>
            {week.map((day) => (
              <div key={day.date}>
                <dt>
                  {date(day.date, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </dt>
                <dd>{trainingTime(day.activeMilliseconds)}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
      <section
        className="exercise-reports"
        aria-labelledby="exercise-report-title"
      >
        <div className="report-section-heading">
          <h2 id="exercise-report-title">{t("statistics.exerciseReports")}</h2>
          <p>{t("statistics.performanceNote")}</p>
        </div>
        <div className="exercise-report-grid">
          {report.exercises.map((exercise) => {
            const responseExercise =
              exercise.kind === "visual" || exercise.kind === "contrast";
            return (
              <article className="exercise-report" key={exercise.kind}>
                <div className="exercise-report-heading">
                  <span className="report-art">
                    <ExerciseArtwork kind={exercise.kind} />
                  </span>
                  <h3>{exerciseName(exercise.kind)}</h3>
                </div>
                <dl className="exercise-report-metrics">
                  <div>
                    <dt>{t("statistics.activeTime")}</dt>
                    <dd>{trainingTime(exercise.activeMilliseconds)}</dd>
                  </div>
                  <div>
                    <dt>{t("statistics.sessions")}</dt>
                    <dd>{number(exercise.sessionCount)}</dd>
                  </div>
                  {responseExercise && (
                    <>
                      <div>
                        <dt>{t("statistics.answerAccuracy")}</dt>
                        <dd>
                          {exercise.accuracy === null
                            ? "—"
                            : percent(exercise.accuracy)}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("statistics.medianResponse")}</dt>
                        <dd>
                          {exercise.medianResponseMilliseconds === null
                            ? "—"
                            : t("statistics.seconds", {
                                seconds: number(
                                  exercise.medianResponseMilliseconds / 1000,
                                  1,
                                ),
                              })}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                {responseExercise ? (
                  <p className="exercise-report-note">
                    {exercise.responseCount
                      ? t("statistics.correctAnswers", {
                          correct: number(exercise.correctCount),
                          total: number(exercise.responseCount),
                        })
                      : t("statistics.noResponses")}
                  </p>
                ) : (
                  <p className="exercise-report-note">
                    {t("statistics.noGazeScore")}
                  </p>
                )}
                {exercise.recentResults.length > 0 && (
                  <div className="recent-results">
                    <h4>{t("statistics.recentAccuracy")}</h4>
                    <ol>
                      {exercise.recentResults.map((result) => (
                        <li
                          key={result.id}
                          aria-label={t("statistics.resultDescription", {
                            date: date(result.date),
                            eye: eyeLabel(result.eye),
                            accuracy: percent(result.accuracy),
                            count: number(result.responseCount),
                          })}
                        >
                          <span aria-hidden="true" className="result-column">
                            <i
                              style={{ height: `${result.accuracy * 100}%` }}
                            />
                          </span>
                          <span aria-hidden="true">
                            {percent(result.accuracy)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <p className="exercise-report-footer">
                  {exercise.lastDate
                    ? t("statistics.lastPractice", {
                        date: date(exercise.lastDate),
                      })
                    : t("statistics.notPracticed")}
                  {exercise.latestLevel !== null &&
                    ` · ${t("progress.level", { level: number(exercise.latestLevel) })}`}
                </p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="statistics-eyes" aria-labelledby="eyes-title">
        <h2 id="eyes-title">{t("statistics.byEye")}</h2>
        <dl>
          {report.eyes.map((eye) => (
            <div key={eye.eye}>
              <dt>{eyeLabel(eye.eye)}</dt>
              <dd>
                <strong>{trainingTime(eye.activeMilliseconds)}</strong>
                <span>
                  {t("statistics.sessionCount", {
                    count: number(eye.sessionCount),
                  })}
                </span>
              </dd>
              <span className="eye-time-bar" aria-hidden="true">
                <i
                  style={{
                    width: `${summary.activeMilliseconds ? (eye.activeMilliseconds / summary.activeMilliseconds) * 100 : 0}%`,
                  }}
                />
              </span>
            </div>
          ))}
        </dl>
      </section>
      <SessionHistory sessions={report.sessions} />
      <ProfessionalMeasurements data={data} persist={persist} />
      <StatisticsResetControls
        data={data}
        onExport={onExport}
        onReset={onReset}
        onUndo={onUndo}
      />
    </div>
  );
}
