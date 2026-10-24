import {
  names,
  localDate,
  type Data,
  type Eye,
  type ExerciseKind,
} from "../engine/model";
import { allSessions, totalForDate, accuracy } from "../analytics/totals";
const formatTime = (milliseconds: number) =>
  `${Math.floor(milliseconds / 60000)}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")}`;
export function Progress({
  data,
  persist,
}: {
  data: Data;
  persist: (data: Data) => void;
}) {
  const minutes = totalForDate(data) / 60000;
  const completed = data.sessions.filter(
    (session) => session.status === "completed",
  ).length;
  return (
    <>
      <section className="stats">
        <div>
          <strong>{minutes.toFixed(1)}</strong>
          <span>active minutes today</span>
        </div>
        <div>
          <strong>{completed}</strong>
          <span>completed sessions</span>
        </div>
        <div>
          <strong>
            {(
              allSessions(data).reduce(
                (sum, session) => sum + session.activeMilliseconds,
                0,
              ) / 60000
            ).toFixed(1)}
          </strong>
          <span>total active minutes</span>
        </div>
      </section>
      <section className="panel">
        <h2>A week of practice</h2>
        <div className="week">
          {Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - 6 + index);
            const value = totalForDate(data, localDate(date)) / 60000;
            return (
              <div key={index}>
                <span>{value.toFixed(1)}m</span>
                <div className="bar">
                  <i
                    style={{
                      height: `${Math.min(100, (value / data.preferences.goal) * 100)}%`,
                    }}
                  />
                </div>
                <small>
                  {date.toLocaleDateString(undefined, { weekday: "short" })}
                </small>
              </div>
            );
          })}
        </div>
        <p className="fine">
          Rest days are welcome. Time and scores do not measure eyesight.
        </p>
      </section>
      <section className="panel">
        <h2>Today, by eye & exercise</h2>
        {(["Left", "Right", "Both", ...Object.keys(names)] as string[]).map(
          (key) => (
            <div className="history-row" key={key}>
              <span>{names[key as ExerciseKind] ?? `${key} eye`}</span>
              <strong>
                {(
                  allSessions(data)
                    .filter(
                      (session) => session.eye === key || session.kind === key,
                    )
                    .reduce(
                      (sum, session) =>
                        sum +
                        session.slices
                          .filter(
                            (slice) => slice.date === localDate(new Date()),
                          )
                          .reduce(
                            (total, slice) => total + slice.milliseconds,
                            0,
                          ),
                      0,
                    ) / 60000
                ).toFixed(1)}{" "}
                min
              </strong>
            </div>
          ),
        )}
      </section>
      <section className="panel">
        <h2>Performance over time</h2>
        <p>
          Recent response accuracy and ending difficulty, independently for each
          exercise. Changing settings changes task demands.
        </p>
        {(["visual", "contrast"] as ExerciseKind[]).map((kind) => (
          <div key={kind}>
            <h3>{names[kind]}</h3>
            <div className="trend">
              {data.sessions
                .filter(
                  (session) => session.kind === kind && session.trials.length,
                )
                .slice(-8)
                .map((session) => (
                  <div key={session.id}>
                    <span>{accuracy(session)}%</span>
                    <div className="bar">
                      <i style={{ height: accuracy(session) + "%" }} />
                    </div>
                    <small>L{session.difficulty + 1}</small>
                    <small>
                      {new Date(session.startedAt).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}
                    </small>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Session history</h2>
        {!data.sessions.length && (
          <p>Your first practice starts a story. No scores yet.</p>
        )}
        {data.sessions
          .slice()
          .reverse()
          .map((session) => (
            <details key={session.id}>
              <summary>
                {names[session.kind]} · {formatTime(session.activeMilliseconds)}{" "}
                <small>
                  {session.eye} · {session.status}
                </small>
              </summary>
              <p>
                {new Date(session.startedAt).toLocaleString()} ·{" "}
                {accuracy(session) === null
                  ? "No accuracy measurement"
                  : `${accuracy(session)}% correct · ${session.trials.length} responses`}{" "}
                · Level {session.difficulty + 1}
              </p>
              <p className="fine">
                Target {session.configuration.size}px · contrast{" "}
                {session.configuration.contrast} · speed{" "}
                {session.configuration.speed} · {session.configuration.pattern}{" "}
                · viewing distance {session.configuration.distance}cm
              </p>
            </details>
          ))}
      </section>
      <section className="panel">
        <h2>Professional measurements</h2>
        <p>
          Optional records from an eye-care professional. Separate from app
          performance.
        </p>
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
            Date
            <input name="date" type="date" required />
          </label>
          <label>
            Eye
            <select name="eye">
              <option>Left</option>
              <option>Right</option>
              <option>Both</option>
            </select>
          </label>
          <label>
            Measurement method
            <input
              name="method"
              required
              placeholder="e.g. Snellen, corrected"
            />
          </label>
          <label>
            Result
            <input
              name="value"
              required
              placeholder="As recorded by your clinician"
            />
          </label>
          <button>Save measurement</button>
        </form>
        {data.measurements.map((measurement) => (
          <p key={measurement.id}>
            {measurement.date} · {measurement.eye} · {measurement.method}:{" "}
            {measurement.value}
          </p>
        ))}
      </section>
    </>
  );
}
