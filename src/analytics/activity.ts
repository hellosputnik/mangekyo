import { localDate, type Data, type Session } from "../engine/model";
import { allSessions } from "./totals";
import { sessionMoment, type SessionMoment } from "./session-time";

export const activityRanges = ["Day", "Week", "Month"] as const;
export type ActivityRange = (typeof activityRanges)[number];
export interface ActivityEntry {
  key: string;
  date: string;
  session: Session;
  start: SessionMoment;
  activeMilliseconds: number;
  continued: boolean;
}
export interface ActivityBucket {
  key: string;
  date?: string;
  hour?: number;
  activeMilliseconds: number;
  sessionCount: number;
}

export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
function calendarInstant(value: string): Date {
  if (!validCalendarDate(value)) throw Error("Invalid calendar date");
  return new Date(`${value}T12:00:00Z`);
}
export function addCalendarDays(value: string, days: number): string {
  const date = calendarInstant(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function shiftActivityDate(
  value: string,
  range: ActivityRange,
  direction: -1 | 1,
): string {
  if (range !== "Month")
    return addCalendarDays(value, direction * (range === "Week" ? 7 : 1));
  const date = calendarInstant(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + direction);
  const last = new Date(date.getTime());
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  date.setUTCDate(Math.min(day, last.getUTCDate()));
  return date.toISOString().slice(0, 10);
}
export function firstWeekday(locale: string): number {
  try {
    const parsed = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = parsed.getWeekInfo?.() ?? parsed.weekInfo;
    if (info && info.firstDay >= 1 && info.firstDay <= 7)
      return info.firstDay % 7;
    return ["US", "CA", "PH"].includes(parsed.maximize().region ?? "") ? 0 : 1;
  } catch {
    return 1;
  }
}
export function activityPeriod(
  anchor: string,
  range: ActivityRange,
  weekStartsOn: number,
) {
  const date = calendarInstant(anchor);
  let start = anchor,
    end = anchor;
  if (range === "Week") {
    start = addCalendarDays(
      anchor,
      -((date.getUTCDay() - weekStartsOn + 7) % 7),
    );
    end = addCalendarDays(start, 6);
  } else if (range === "Month") {
    date.setUTCDate(1);
    start = date.toISOString().slice(0, 10);
    date.setUTCMonth(date.getUTCMonth() + 1);
    date.setUTCDate(0);
    end = date.toISOString().slice(0, 10);
  }
  const days: string[] = [];
  for (let day = start; ; day = addCalendarDays(day, 1)) {
    days.push(day);
    if (day === end) break;
  }
  return { start, end, days };
}

export function activityEntries(
  data: Pick<Data, "sessions" | "current">,
): ActivityEntry[] {
  return allSessions(data)
    .flatMap((session) => {
      const start = sessionMoment(session);
      if (!start || !validCalendarDate(start.date)) return [];
      const amounts = new Map<string, number>();
      for (const slice of session.slices) {
        if (slice.milliseconds > 0 && validCalendarDate(slice.date))
          amounts.set(
            slice.date,
            (amounts.get(slice.date) ?? 0) + slice.milliseconds,
          );
      }
      if (!amounts.size) amounts.set(start.date, session.activeMilliseconds);
      return [...amounts].map(([date, activeMilliseconds]) => ({
        key: `${session.id}:${date}`,
        date,
        session,
        start,
        activeMilliseconds,
        continued: date !== start.date,
      }));
    })
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        Date.parse(right.session.startedAt) -
          Date.parse(left.session.startedAt),
    );
}

export function buildActivity(
  data: Data,
  range: ActivityRange,
  anchor: string,
  weekStartsOn: number,
  today = localDate(new Date()),
) {
  const allEntries = activityEntries(data);
  const period = activityPeriod(anchor, range, weekStartsOn);
  const entries = allEntries.filter(
    (entry) => entry.date >= period.start && entry.date <= period.end,
  );
  const summarize = (selected: ActivityEntry[]) => ({
    activeMilliseconds: selected.reduce(
      (sum, entry) => sum + entry.activeMilliseconds,
      0,
    ),
    sessionCount: new Set(selected.map((entry) => entry.session.id)).size,
  });
  const buckets: ActivityBucket[] =
    range === "Day"
      ? Array.from({ length: 24 }, (_, hour) => ({
          key: String(hour),
          hour,
          ...summarize(
            entries.filter(
              (entry) => !entry.continued && entry.start.hour === hour,
            ),
          ),
        }))
      : period.days.map((date) => ({
          key: date,
          date,
          ...summarize(entries.filter((entry) => entry.date === date)),
        }));
  const dates = allEntries.map((entry) => entry.date);
  return {
    range,
    ...period,
    entries,
    buckets,
    ...summarize(entries),
    activeDays: new Set(
      entries
        .filter((entry) => entry.activeMilliseconds > 0)
        .map((entry) => entry.date),
    ).size,
    continuedMilliseconds:
      range === "Day"
        ? entries
            .filter((entry) => entry.continued)
            .reduce((sum, entry) => sum + entry.activeMilliseconds, 0)
        : 0,
    minimumDate: [today, ...dates].sort()[0],
    maximumDate: [today, ...dates].sort().at(-1)!,
  };
}
export type ActivityView = ReturnType<typeof buildActivity>;
export function selectedActivityEntries(
  view: ActivityView,
  index: number | null,
): ActivityEntry[] {
  if (index === null) return view.entries;
  const bucket = view.buckets[index];
  if (!bucket) return [];
  return view.entries.filter((entry) =>
    view.range === "Day"
      ? !entry.continued && entry.start.hour === bucket.hour
      : entry.date === bucket.date,
  );
}
