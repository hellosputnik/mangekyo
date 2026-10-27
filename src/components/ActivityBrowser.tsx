import { useEffect, useMemo, useRef, useState } from "react";
import { localDate, type Data } from "../engine/model";
import {
  activityPeriod,
  activityRanges,
  buildActivity,
  firstWeekday,
  selectedActivityEntries,
  shiftActivityDate,
  validCalendarDate,
  type ActivityEntry,
  type ActivityRange,
} from "../analytics/activity";
import { useI18n } from "../i18n/react";
import { Icon } from "./Icon";
import { ExerciseArtwork } from "./ExerciseArtwork";
import { ActivityChart } from "./ActivityChart";
import { SessionDetailSheet } from "./SessionDetails";

export function ActivityBrowser({ data }: { data: Data }) {
  const {
    t,
    locale,
    number,
    trainingTime,
    time,
    calendarDate,
    calendarRange,
    clockHour,
    sessionMomentText,
    exerciseName,
    eyeLabel,
    statusLabel,
  } = useI18n();
  const [range, setRange] = useState<ActivityRange>("Week");
  const [anchor, setAnchor] = useState(() => localDate(new Date()));
  const [selected, setSelected] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [openEntry, setOpenEntry] = useState<ActivityEntry | null>(null);
  const previousReset = useRef(data.statisticsReset?.resetAt);
  const today = localDate(new Date());
  const weekStartsOn = firstWeekday(locale);
  const view = useMemo(
    () => buildActivity(data, range, anchor, weekStartsOn, today),
    [data, range, anchor, weekStartsOn, today],
  );
  const bucket = selected === null ? null : view.buckets[selected];
  const selectedEntries = selectedActivityEntries(view, selected);
  const visibleEntries = selectedEntries.slice(0, visibleCount);
  const dates = [...new Set(visibleEntries.map((entry) => entry.date))];
  const previous = shiftActivityDate(anchor, range, -1);
  const next = shiftActivityDate(anchor, range, 1);
  const previousAvailable =
    activityPeriod(previous, range, weekStartsOn).end >= view.minimumDate;
  const nextAvailable =
    activityPeriod(next, range, weekStartsOn).start <= view.maximumDate;
  const title =
    range === "Month"
      ? calendarDate(anchor, { month: "long", year: "numeric" })
      : calendarRange(view.start, view.end);
  const selectedLabel = bucket
    ? bucket.date
      ? calendarDate(bucket.date, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : `${clockHour(bucket.hour ?? 0, 0)} – ${clockHour(bucket.hour ?? 0, 59)}`
    : t("activity.total");
  const defaultIndex =
    range === "Day"
      ? new Date().getHours()
      : Math.max(
          0,
          view.buckets.findIndex((item) => item.date === anchor),
        );
  const chooseDate = (date: string) => {
    setAnchor(
      date < view.minimumDate
        ? view.minimumDate
        : date > view.maximumDate
          ? view.maximumDate
          : date,
    );
    setSelected(null);
    setVisibleCount(10);
  };
  const chooseBucket = (index: number | null) => {
    setSelected(index);
    setVisibleCount(10);
  };
  const commitDate = (value: string) => {
    if (
      validCalendarDate(value) &&
      value >= view.minimumDate &&
      value <= view.maximumDate &&
      value !== anchor
    )
      chooseDate(value);
  };
  const chooseRange = (value: ActivityRange) => {
    if (
      bucket?.date &&
      bucket.date >= view.minimumDate &&
      bucket.date <= view.maximumDate
    )
      setAnchor(bucket.date);
    setRange(value);
    setSelected(null);
    setVisibleCount(10);
  };
  useEffect(() => {
    if (previousReset.current === data.statisticsReset?.resetAt) return;
    previousReset.current = data.statisticsReset?.resetAt;
    chooseDate(localDate(new Date()));
    setOpenEntry(null);
  }, [data.statisticsReset?.resetAt]);
  return (
    <section className="activity-browser" aria-labelledby="activity-title">
      <div className="report-heading">
        <h2 id="activity-title">{t("activity.title")}</h2>
        <button
          type="button"
          className="quiet activity-today"
          onClick={() => chooseDate(localDate(new Date()))}
        >
          {t("activity.today")}
        </button>
      </div>
      <div className="activity-layout">
        <div className="activity-overview">
          <fieldset className="activity-ranges">
            <legend className="visually-hidden">
              {t("activity.rangeLabel")}
            </legend>
            <div>
              {activityRanges.map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={range === value}
                  onClick={() => chooseRange(value)}
                >
                  {t(`activity.range.${value}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="activity-period-navigation">
            <button
              type="button"
              className="icon-button quiet"
              disabled={!previousAvailable}
              aria-label={t(`activity.previous.${range}`)}
              onClick={() => chooseDate(previous)}
            >
              <Icon name="Previous" />
            </button>
            <label className="activity-date-picker">
              <span aria-hidden="true">{title}</span>
              <Icon name="Calendar" />
              <input
                type="date"
                value={anchor}
                min={view.minimumDate}
                max={view.maximumDate}
                aria-label={t("activity.chooseDate")}
                onChange={(event) => commitDate(event.currentTarget.value)}
                onInput={(event) => commitDate(event.currentTarget.value)}
                onBlur={(event) => commitDate(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              className="icon-button quiet"
              disabled={!nextAvailable}
              aria-label={t(`activity.next.${range}`)}
              onClick={() => chooseDate(next)}
            >
              <Icon name="Chevron" />
            </button>
          </div>
          <div className="activity-period-summary">
            <div className="activity-readout" aria-live="polite" aria-atomic="true">
              <span>{selectedLabel}</span>
              <strong>
                {trainingTime(
                  bucket?.activeMilliseconds ?? view.activeMilliseconds,
                )}
              </strong>
              <small>
                {bucket
                  ? t("statistics.sessionCount", {
                      count: number(bucket.sessionCount),
                    })
                  : t("activity.periodSessions", {
                      count: number(view.sessionCount),
                      days: number(view.activeDays),
                    })}
              </small>
            </div>
            <button
              type="button"
              className="quiet"
              disabled={selected === null}
              onClick={() => chooseBucket(null)}
            >
              {t("activity.showAll")}
            </button>
          </div>
          <ActivityChart
            buckets={view.buckets}
            range={range}
            selected={selected}
            defaultIndex={defaultIndex}
            onSelect={chooseBucket}
          />
          <p className="activity-chart-hint">
            {t(
              range === "Day" ? "activity.chartHintDay" : "activity.chartHintDates",
            )}
          </p>
          {view.continuedMilliseconds > 0 && (
            <p className="activity-continuation">
              {t("activity.continuedTime", {
                time: trainingTime(view.continuedMilliseconds),
              })}
            </p>
          )}
        </div>
        <div className="activity-sessions">
          <h3>{t("statistics.sessions")}</h3>
          {!selectedEntries.length && (
            <p className="activity-no-sessions">{t("activity.noSessions")}</p>
          )}
          {dates.map((date) => (
            <section
              className="activity-date-group"
              key={date}
              aria-label={calendarDate(date)}
            >
              <h4>
                {calendarDate(date, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h4>
              <ol>
                {visibleEntries
                  .filter((entry) => entry.date === date)
                  .map((entry) => {
                    const started = sessionMomentText(entry.start, {
                      hour: "numeric",
                      minute: "2-digit",
                    });
                    return (
                      <li key={entry.key}>
                        <button
                          type="button"
                          className="activity-session"
                          aria-label={t("activity.openSession", {
                            exercise: exerciseName(entry.session.kind),
                            time: `${calendarDate(entry.date)}, ${entry.continued ? t("activity.continued") : started}`,
                            eye: eyeLabel(entry.session.eye),
                            duration: trainingTime(entry.activeMilliseconds),
                          })}
                          onClick={() => setOpenEntry(entry)}
                        >
                          <span className="activity-session-art">
                            <ExerciseArtwork kind={entry.session.kind} />
                          </span>
                          <span className="activity-session-copy">
                            <strong>{exerciseName(entry.session.kind)}</strong>
                            <span>
                              {entry.continued
                                ? t("activity.continued")
                                : started}{" "}
                              · {eyeLabel(entry.session.eye)}
                            </span>
                            <small>{statusLabel(entry.session.status)}</small>
                          </span>
                          <span className="activity-session-time">
                            <strong>{time(entry.activeMilliseconds)}</strong>
                            <small>{t("activity.activeShort")}</small>
                          </span>
                          <Icon name="Chevron" />
                        </button>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
          {selectedEntries.length > visibleCount && (
            <button
              type="button"
              className="activity-more"
              onClick={() => setVisibleCount((count) => count + 20)}
            >
              {t("statistics.moreHistory")}
            </button>
          )}
        </div>
      </div>
      <p className="activity-timezone-note">{t("activity.timezoneNote")}</p>
      <SessionDetailSheet
        entry={openEntry}
        onClose={() => setOpenEntry(null)}
      />
    </section>
  );
}
