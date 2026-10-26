import {
  isResponseExercise,
  isTouchExercise,
  type Data,
} from "../engine/model";
import { summarizeTouch } from "../analytics/touch";
import type { ResetStatisticsOptions } from "../engine/statistics-reset";
import { buildStatistics } from "../analytics/statistics";
import { useI18n } from "../i18n/react";
import { ExerciseArtwork } from "./ExerciseArtwork";
import { SessionHistory } from "./SessionHistory";
import { ProfessionalMeasurements } from "./ProfessionalMeasurements";
import { StatisticsResetControls } from "./StatisticsResetControls";
import { Icon } from "./Icon";
import { ActivityBrowser } from "./ActivityBrowser";

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
  const {
    t,
    number,
    percent,
    time,
    trainingTime,
    date,
    exerciseName,
    eyeLabel,
  } = useI18n();
  const report = buildStatistics(data);
  const { summary } = report;
  return (
    <div className="statistics-page">
      <ActivityBrowser data={data} />
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
            const responseExercise = isResponseExercise(exercise.kind);
            const touch = summarizeTouch(
              report.sessions.filter(
                (session) => session.kind === exercise.kind,
              ),
            );
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
                    <dd>{time(exercise.activeMilliseconds)}</dd>
                  </div>
                  <div>
                    <dt>{t("statistics.sessions")}</dt>
                    <dd>{number(exercise.sessionCount)}</dd>
                  </div>
                  {responseExercise ? (
                    <>
                      <div>
                        <dt>
                          {t(
                            exercise.kind === "tap"
                              ? "touch.hitRate"
                              : "statistics.answerAccuracy",
                          )}
                        </dt>
                        <dd>
                          {exercise.accuracy === null
                            ? "—"
                            : percent(exercise.accuracy)}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          {t(
                            exercise.kind === "tap"
                              ? "touch.tapResponse"
                              : "statistics.medianResponse",
                          )}
                        </dt>
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
                  ) : exercise.kind === "follow" ? (
                    <>
                      <div>
                        <dt>{t("touch.onTarget")}</dt>
                        <dd>
                          {touch.onTargetRatio === null
                            ? "—"
                            : percent(touch.onTargetRatio)}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("touch.meanDistance")}</dt>
                        <dd>
                          {touch.meanDistance === null
                            ? "—"
                            : t("touch.pixels", {
                                value: number(touch.meanDistance, 1),
                              })}
                        </dd>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <dt>{t("statistics.practiceDays")}</dt>
                        <dd>{number(exercise.activeDays)}</dd>
                      </div>
                      <div>
                        <dt>{t("statistics.averageSession")}</dt>
                        <dd>{time(exercise.averageSessionMilliseconds)}</dd>
                      </div>
                    </>
                  )}
                </dl>
                <p className="exercise-report-footer">
                  {exercise.lastDate
                    ? t("statistics.lastPractice", {
                        date: date(exercise.lastDate),
                      })
                    : t("statistics.notPracticed")}
                </p>
                <details className="exercise-report-details">
                  <summary>
                    <span>{t("statistics.details")}</span>
                    <Icon name="Chevron" />
                  </summary>
                  <div className="exercise-report-detail-content">
                    {isTouchExercise(exercise.kind) && (
                      <p className="exercise-report-note">
                        {t("touch.performanceNote")}
                      </p>
                    )}
                    {isTouchExercise(exercise.kind) &&
                      touch.highestLevel !== null && (
                        <p className="exercise-report-note">
                          {t("challenge.highest")}: {number(touch.highestLevel)}{" "}
                          · {t("challenge.unlockedCount")}:{" "}
                          {number(touch.levelsUnlocked)}
                        </p>
                      )}
                    <p className="exercise-report-note">
                      {t("statistics.outcomes", {
                        completed: number(exercise.completedCount),
                        stopped: number(exercise.stoppedCount),
                        interrupted: number(exercise.interruptedCount),
                      })}
                    </p>
                    {responseExercise ? (
                      <p className="exercise-report-note">
                        {exercise.responseCount
                          ? t(
                              exercise.kind === "tap"
                                ? "touch.hitSummary"
                                : "statistics.correctAnswers",
                              {
                                correct: number(exercise.correctCount),
                                total: number(exercise.responseCount),
                              },
                            )
                          : t("statistics.noResponses")}
                      </p>
                    ) : exercise.kind === "follow" ? (
                      <>
                        <p className="exercise-report-note">
                          {t("touch.bestRun")}:{" "}
                          {time(touch.bestRunMilliseconds)}
                        </p>
                        {touch.onTargetRatio === null && (
                          <p className="exercise-report-note">
                            {t("touch.noData")}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="exercise-report-note">
                        {t("statistics.noGazeScore")}
                      </p>
                    )}
                    {exercise.latestLevel !== null && (
                      <p className="exercise-report-note">
                        {t("progress.level", {
                          level: number(exercise.latestLevel),
                        })}
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
                              <span
                                aria-hidden="true"
                                className="result-column"
                              >
                                <i
                                  style={{
                                    height: `${result.accuracy * 100}%`,
                                  }}
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
                  </div>
                </details>
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
