import { useState } from "react";
import type { Session } from "../engine/model";
import { checkInGroups } from "../analytics/check-ins";
import { useI18n } from "../i18n/react";
import { RecordedConditions } from "./RecordedConditions";
export function CheckInTrends({ sessions }: { sessions: Session[] }) {
  const { t, date, number, percent, exerciseName, eyeLabel } = useI18n();
  const groups = checkInGroups(sessions);
  const [key, setKey] = useState("");
  const selected = groups.find((group) => group.key === key) ?? groups[0];
  return (
    <section
      className="panel check-in-trends"
      aria-labelledby="check-in-trends-title"
    >
      <h2 id="check-in-trends-title">{t("checkIn.trends")}</h2>
      <p className="fine">{t("checkIn.trendNote")}</p>
      {!selected ? (
        <p>{t("checkIn.empty")}</p>
      ) : (
        <>
          <label>
            {t("checkIn.conditions")}
            <select
              value={selected.key}
              onChange={(event) => setKey(event.target.value)}
            >
              {groups.map((group, index) => (
                <option value={group.key} key={group.key}>
                  {number(index + 1)}. {exerciseName(group.sample.kind)} ·{" "}
                  {eyeLabel(group.sample.eye)} ·{" "}
                  {t("checkIn.records", {
                    count: number(group.records.length),
                  })}
                </option>
              ))}
            </select>
          </label>
          <details>
            <summary>{t("filters.inspect")}</summary>
            <RecordedConditions session={selected.sample} />
          </details>
          <div className="check-in-chart" aria-hidden="true">
            <span>100%</span>
            <svg viewBox="0 0 300 110" preserveAspectRatio="none">
              <path
                d="M10 10H290M10 100H290"
                stroke="var(--border)"
                fill="none"
              />
              <polyline
                points={selected.results
                  .slice(-8)
                  .map(
                    (result, index, items) =>
                      `${items.length === 1 ? 150 : 10 + (index * 280) / (items.length - 1)},${100 - (result.accuracy ?? 0) * 90}`,
                  )
                  .join(" ")}
                fill="none"
                stroke="var(--accent-soft)"
                strokeWidth="2"
              />
              {selected.results.slice(-8).map((result, index, items) => (
                <circle
                  key={result.session.id}
                  cx={
                    items.length === 1
                      ? 150
                      : 10 + (index * 280) / (items.length - 1)
                  }
                  cy={100 - (result.accuracy ?? 0) * 90}
                  r="3"
                  fill="var(--accent-soft)"
                />
              ))}
            </svg>
            <span>0%</span>
          </div>
          <ol className="check-in-results">
            {selected.results.slice(-8).map((result) => (
              <li key={result.session.id}>
                <time dateTime={result.session.startedAt}>
                  {date(result.session.startedAt, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </time>
                <strong>{percent(result.accuracy ?? 0)}</strong>
                <span>
                  {t("statistics.seconds", {
                    seconds: number(
                      (result.medianResponseMilliseconds ?? 0) / 1000,
                      1,
                    ),
                  })}
                </span>
              </li>
            ))}
          </ol>
          <p className="fine">
            {t("checkIn.chartNote", {
              count: number(selected.sample.checkIn!.targetTrials),
            })}
          </p>
        </>
      )}
    </section>
  );
}
