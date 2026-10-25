import {
  names,
  localDate,
  type Data,
  type Eye,
  type ExerciseKind,
} from "../engine/model";
import { allSessions, totalForDate, accuracy } from "../analytics/totals";
import { useI18n } from "../i18n/react";
export function Progress({
  data,
  persist,
}: {
  data: Data;
  persist: (data: Data) => void;
}) {
  const {
    t,
    number,
    percent,
    time,
    date: formatDate,
    exerciseName,
    eyeLabel,
    statusLabel,
    patternLabel,
  } = useI18n();
  const minutes = totalForDate(data) / 60000;
  const completed = data.sessions.filter(
    (session) => session.status === "completed",
  ).length;
  return (
    <>
      <section className="stats">
        <div>
          <strong>{number(minutes, 1)}</strong>
          <span>{t("progress.todayMinutes")}</span>
        </div>
        <div>
          <strong>{number(completed)}</strong>
          <span>{t("progress.completed")}</span>
        </div>
        <div>
          <strong>
            {number(
              allSessions(data).reduce(
                (sum, session) => sum + session.activeMilliseconds,
                0,
              ) / 60000,
              1,
            )}
          </strong>
          <span>{t("progress.totalMinutes")}</span>
        </div>
      </section>
      <section className="panel">
        <h2>{t("progress.week")}</h2>
        <div className="week">
          {Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - 6 + index);
            const value = totalForDate(data, localDate(date)) / 60000;
            return (
              <div key={index}>
                <span>
                  {number(value, 1)} {t("unit.minutes")}
                </span>
                <div className="bar">
                  <i
                    style={{
                      height: `${Math.min(100, (value / data.preferences.goal) * 100)}%`,
                    }}
                  />
                </div>
                <small>{formatDate(date, { weekday: "short" })}</small>
              </div>
            );
          })}
        </div>
        <p className="fine">{t("progress.weekNote")}</p>
      </section>
      <section className="panel">
        <h2>{t("progress.byEye")}</h2>
        {(
          ["Left", "Right", "Both", ...Object.keys(names)] as (
            Eye | ExerciseKind
          )[]
        ).map((key) => (
          <div className="history-row" key={key}>
            <span>
              {Object.hasOwn(names, key)
                ? exerciseName(key as ExerciseKind)
                : eyeLabel(key as Eye)}
            </span>
            <strong>
              {number(
                allSessions(data)
                  .filter(
                    (session) => session.eye === key || session.kind === key,
                  )
                  .reduce(
                    (sum, session) =>
                      sum +
                      session.slices
                        .filter((slice) => slice.date === localDate(new Date()))
                        .reduce(
                          (total, slice) => total + slice.milliseconds,
                          0,
                        ),
                    0,
                  ) / 60000,
                1,
              )}{" "}
              {t("unit.minutes")}
            </strong>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>{t("progress.trend")}</h2>
        <p>{t("progress.trendNote")}</p>
        {(["visual", "contrast"] as ExerciseKind[]).map((kind) => (
          <div key={kind}>
            <h3>{exerciseName(kind)}</h3>
            <div className="trend">
              {data.sessions
                .filter(
                  (session) => session.kind === kind && session.trials.length,
                )
                .slice(-8)
                .map((session) => (
                  <div key={session.id}>
                    <span>{percent((accuracy(session) ?? 0) / 100)}</span>
                    <div className="bar">
                      <i style={{ height: accuracy(session) + "%" }} />
                    </div>
                    <small>
                      {t("progress.level", {
                        level: number(session.difficulty + 1),
                      })}
                    </small>
                    <small>
                      {formatDate(session.startedAt, {
                        month: "short",
                        day: "numeric",
                      })}
                    </small>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>{t("progress.history")}</h2>
        {!data.sessions.length && <p>{t("progress.empty")}</p>}
        {data.sessions
          .slice()
          .reverse()
          .map((session) => (
            <details key={session.id}>
              <summary>
                {exerciseName(session.kind)} ·{" "}
                {time(session.activeMilliseconds)}
                <small>
                  {eyeLabel(session.eye)} · {statusLabel(session.status)}
                </small>
              </summary>
              <p>
                {formatDate(session.startedAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                ·{" "}
                {accuracy(session) === null
                  ? t("progress.noAccuracy")
                  : t("progress.accuracy", {
                      percent: percent((accuracy(session) ?? 0) / 100),
                      count: number(session.trials.length),
                    })}{" "}
                ·{" "}
                {t("progress.level", { level: number(session.difficulty + 1) })}
              </p>
              <p className="fine">
                {t("progress.configuration", {
                  size: number(session.configuration.size),
                  contrast: number(session.configuration.contrast),
                  speed: number(session.configuration.speed),
                  pattern: patternLabel(session.configuration.pattern),
                  distance: number(session.configuration.distance),
                })}
              </p>
            </details>
          ))}
      </section>
      <section className="panel">
        <h2>{t("progress.measurements")}</h2>
        <p>{t("progress.measurementNote")}</p>
        <form
          className="settings-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            persist({
              ...data,
              measurements: [
                ...data.measurements,
                {
                  id: crypto.randomUUID(),
                  date: String(form.get("date")),
                  eye: String(form.get("eye")) as Eye,
                  method: String(form.get("method")),
                  value: String(form.get("value")),
                },
              ],
            });
            event.currentTarget.reset();
          }}
        >
          <label>
            {t("progress.date")}
            <input name="date" type="date" required />
          </label>
          <label>
            {t("progress.eye")}
            <select name="eye">
              {(["Left", "Right", "Both"] as const).map((value) => (
                <option key={value} value={value}>
                  {eyeLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("progress.method")}
            <input
              name="method"
              required
              placeholder={t("progress.methodPlaceholder")}
            />
          </label>
          <label>
            {t("progress.result")}
            <input
              name="value"
              required
              placeholder={t("progress.resultPlaceholder")}
            />
          </label>
          <button>{t("progress.saveMeasurement")}</button>
        </form>
        {data.measurements.map((measurement) => (
          <p key={measurement.id}>
            {formatDate(measurement.date)} · {eyeLabel(measurement.eye)} ·{" "}
            {measurement.method}: {measurement.value}
          </p>
        ))}
      </section>
    </>
  );
}
