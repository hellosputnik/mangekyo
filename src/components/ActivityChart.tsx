import type { ActivityBucket, ActivityRange } from "../analytics/activity";
import { useI18n } from "../i18n/react";

export function ActivityChart({
  buckets,
  range,
  selected,
  defaultIndex,
  onSelect,
}: {
  buckets: ActivityBucket[];
  range: ActivityRange;
  selected: number | null;
  defaultIndex: number;
  onSelect: (index: number | null) => void;
}) {
  const { t, number, trainingTime, calendarDate, clockHour } = useI18n();
  const maximum = Math.max(
    60000,
    ...buckets.map((bucket) => bucket.activeMilliseconds),
  );
  const bucketWidth = 360 / buckets.length;
  const label = (bucket: ActivityBucket) =>
    bucket.date
      ? calendarDate(bucket.date, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : `${clockHour(bucket.hour ?? 0, 0)} – ${clockHour(bucket.hour ?? 0, 59)}`;
  const axes =
    range === "Day"
      ? [0, 6, 12, 18, 23]
      : range === "Week"
        ? buckets.map((_, index) => index)
        : [...new Set([0, 7, 14, 21, buckets.length - 1])];
  const currentIndex =
    selected ?? Math.max(0, Math.min(buckets.length - 1, defaultIndex));
  const current = buckets[currentIndex];
  return (
    <div className="activity-chart">
      <div className="activity-chart-scale" aria-hidden="true">
        <span>{trainingTime(maximum)}</span>
        <span>0</span>
      </div>
      <div className="activity-chart-plot">
        <svg
          viewBox="0 0 360 160"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[0, 80, 159].map((y) => (
            <line
              className="activity-grid-line"
              key={y}
              x1="0"
              x2="360"
              y1={y}
              y2={y}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {buckets.map((bucket, index) => {
            const height = (bucket.activeMilliseconds / maximum) * 156;
            return (
              <rect
                key={bucket.key}
                className={`activity-chart-bar ${selected === index ? "selected" : ""}`}
                x={index * bucketWidth + bucketWidth * 0.16}
                y={160 - height}
                width={bucketWidth * 0.68}
                height={height}
                rx={Math.min(3, bucketWidth * 0.16)}
              />
            );
          })}
          {selected !== null && (
            <line
              className="activity-selection-line"
              x1={(selected + 0.5) * bucketWidth}
              x2={(selected + 0.5) * bucketWidth}
              y1="0"
              y2="160"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {!buckets.some((bucket) => bucket.activeMilliseconds > 0) && (
          <p className="activity-chart-empty" aria-hidden="true">
            {t("activity.noActivity")}
          </p>
        )}
        <input
          className="activity-chart-input"
          type="range"
          min="0"
          max={buckets.length - 1}
          step="1"
          value={currentIndex}
          aria-label={t(
            range === "Day" ? "activity.selectHour" : "activity.selectDay",
          )}
          aria-valuetext={
            selected === null
              ? t("activity.chartAll", { label: label(current) })
              : t("activity.chartValue", {
                  label: label(current),
                  time: trainingTime(current.activeMilliseconds),
                  count: number(current.sessionCount),
                })
          }
          onChange={(event) => onSelect(Number(event.target.value))}
          onPointerUp={(event) => onSelect(Number(event.currentTarget.value))}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onSelect(null);
            }
          }}
        />
      </div>
      <div className="activity-chart-axis" aria-hidden="true">
        {axes.map((index) => (
          <span
            key={index}
            style={{ left: `${((index + 0.5) / buckets.length) * 100}%` }}
          >
            {range === "Day"
              ? clockHour(index)
              : range === "Week"
                ? calendarDate(buckets[index].date!, { weekday: "short" })
                : number(Number(buckets[index].date!.slice(-2)))}
          </span>
        ))}
      </div>
    </div>
  );
}
