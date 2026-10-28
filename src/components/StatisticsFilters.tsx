import { exerciseKinds, type Session } from "../engine/model";
import {
  conditionGroups,
  emptyStatisticsFilter,
  personalBest,
  type StatisticsFilter,
} from "../analytics/comparison";
import { useI18n } from "../i18n/react";
import { RecordedConditions } from "./RecordedConditions";

export function StatisticsFilters({
  sessions,
  filter,
  onChange,
}: {
  sessions: Session[];
  filter: StatisticsFilter;
  onChange: (filter: StatisticsFilter) => void;
}) {
  const { t, number, percent, duration, exerciseName, eyeLabel, date } =
    useI18n();
  const groups = conditionGroups(sessions, filter);
  const selected = groups.find((group) => group.key === filter.conditions);
  const records = selected
    ? sessions.filter((session) =>
        conditionGroups([session], filter).some(
          (group) => group.key === selected.key,
        ),
      )
    : [];
  const best = personalBest(records);
  const active =
    filter.eye !== "All" ||
    filter.exercise !== "All" ||
    filter.conditions !== "All";
  return (
    <section
      className="statistics-filters"
      aria-labelledby="statistics-filters-title"
    >
      <div className="report-heading">
        <h2 id="statistics-filters-title">{t("filters.title")}</h2>
        <button
          type="button"
          className="quiet"
          disabled={!active}
          onClick={() => onChange(emptyStatisticsFilter)}
        >
          {t("filters.clear")}
        </button>
      </div>
      <div className="filter-controls">
        <label>
          {t("filters.exercise")}
          <select
            value={filter.exercise}
            onChange={(event) =>
              onChange({
                ...filter,
                exercise: event.target.value as StatisticsFilter["exercise"],
                conditions: "All",
              })
            }
          >
            <option value="All">{t("filters.allExercises")}</option>
            {exerciseKinds.map((kind) => (
              <option key={kind} value={kind}>
                {exerciseName(kind)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("practice.eye")}
          <select
            value={filter.eye}
            onChange={(event) =>
              onChange({
                ...filter,
                eye: event.target.value as StatisticsFilter["eye"],
                conditions: "All",
              })
            }
          >
            <option value="All">{t("filters.allEyes")}</option>
            {(["Left", "Right", "Both"] as const).map((eye) => (
              <option key={eye} value={eye}>
                {eyeLabel(eye)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("filters.conditions")}
          <select
            value={selected ? filter.conditions : "All"}
            onChange={(event) =>
              onChange({ ...filter, conditions: event.target.value })
            }
          >
            <option value="All">{t("filters.allSettings")}</option>
            {groups.map((group, index) => (
              <option key={group.key} value={group.key}>
                {t("filters.group", {
                  number: number(index + 1),
                  exercise: exerciseName(group.sample.kind),
                  eye: eyeLabel(group.sample.eye),
                  duration: duration(group.sample.configuration.duration),
                  size: number(group.sample.configuration.size),
                  count: number(group.count),
                })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="fine">{t("filters.note")}</p>
      {selected && (
        <details className="filter-condition-details">
          <summary>{t("filters.inspect")}</summary>
          <RecordedConditions session={selected.sample} />
          <p className="fine">{t("filters.recordingNote")}</p>
        </details>
      )}
      {selected && (
        <div className="personal-best" role="status" aria-atomic="true">
          <h3>{t("filters.best")}</h3>
          {best ? (
            <>
              <p>
                <strong>{percent(best.value)}</strong> ·{" "}
                {t(
                  best.session.kind === "follow"
                    ? "filters.bestFollowing"
                    : "filters.bestAnswers",
                  { count: number(best.count) },
                )}
              </p>
              <p className="fine">
                {t("filters.bestConditions", {
                  level: number(
                    best.difficulty + 1,
                    Number.isInteger(best.difficulty) ? 0 : 2,
                  ),
                  date: date(best.session.startedAt),
                })}
                {best.trial?.stimulusDiameter !== undefined &&
                  ` · ${t("touch.pixels", { value: number(best.trial.stimulusDiameter, Number.isInteger(best.trial.stimulusDiameter) ? 0 : 1) })}`}
              </p>
            </>
          ) : (
            <p className="fine">
              {t(
                selected.sample.kind === "pursuit" ||
                  selected.sample.kind === "saccades"
                  ? "filters.noGazeBest"
                  : "filters.bestPending",
              )}
            </p>
          )}
        </div>
      )}
      {active && <p className="fine">{t("filters.scope")}</p>}
    </section>
  );
}
