import type { Data } from "../engine/model";
import { buildStatistics, summarizePractice } from "../analytics/statistics";
import { useI18n } from "../i18n/react";
export function StatisticsOverview({ data }: { data: Data }) {
  const { t, trainingTime, number, exerciseName, eyeLabel, calendarDate } =
    useI18n();
  const report = buildStatistics(data);
  const weekDates = new Set(report.week.map((day) => day.date));
  const records = report.sessions.filter((session) =>
    session.slices.some(
      (slice) => weekDates.has(slice.date) && slice.milliseconds > 0,
    ),
  );
  const latest = report.sessions.find(
    (session) => session.activeMilliseconds > 0,
  );
  const latestReport = latest ? summarizePractice([latest]) : null;
  return (
    <section
      className="statistics-overview"
      aria-labelledby="statistics-overview-title"
    >
      <h2 id="statistics-overview-title">{t("overview.week")}</h2>
      <dl>
        <div>
          <dt>{t("statistics.activeTime")}</dt>
          <dd>
            {trainingTime(
              report.week.reduce(
                (total, day) => total + day.activeMilliseconds,
                0,
              ),
            )}
          </dd>
        </div>
        <div>
          <dt>{t("statistics.sessions")}</dt>
          <dd>{number(records.length)}</dd>
        </div>
        <div>
          <dt>{t("statistics.practiceDays")}</dt>
          <dd>
            {number(
              report.week.filter((day) => day.activeMilliseconds > 0).length,
            )}
          </dd>
        </div>
      </dl>
      <ol
        tabIndex={0}
        className="overview-week-chart"
        aria-label={t("overview.week")}
      >
        {report.week.map((day) => (
          <li
            key={day.date}
            aria-label={`${calendarDate(day.date)}: ${trainingTime(day.activeMilliseconds)}`}
          >
            <span className="overview-day-bar" aria-hidden="true">
              <i
                style={{
                  height: `${day.activeMilliseconds ? (day.activeMilliseconds / Math.max(1, ...report.week.map((item) => item.activeMilliseconds))) * 100 : 0}%`,
                }}
              />
            </span>
            <span aria-hidden="true">
              {calendarDate(day.date, { weekday: "narrow" })}
            </span>
          </li>
        ))}
      </ol>
      {latest && latestReport && (
        <p className="overview-highlight">
          {t("overview.latest", {
            exercise: exerciseName(latest.kind),
            eye: eyeLabel(latest.eye),
            time: trainingTime(latest.activeMilliseconds),
          })}
          {latestReport.responseCount > 0 &&
            ` · ${t("statistics.correctAnswers", { correct: number(latestReport.correctCount), total: number(latestReport.responseCount) })}`}
        </p>
      )}
    </section>
  );
}
