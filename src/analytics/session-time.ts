import type { Session } from "../engine/model";

export interface SessionMoment {
  timestamp: string;
  date: string;
  hour: number;
  offset: number;
  timeZone: string | null;
  recorded: boolean;
}

const formatters = new Map<string, Intl.DateTimeFormat | null>();
function civilFormatter(timeZone: string): Intl.DateTimeFormat | null {
  if (!formatters.has(timeZone)) {
    try {
      formatters.set(
        timeZone,
        new Intl.DateTimeFormat("en-US", {
          timeZone,
          calendar: "gregory",
          numberingSystem: "latn",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }),
      );
    } catch {
      formatters.set(timeZone, null);
    }
  }
  return formatters.get(timeZone) ?? null;
}

export function sessionMoment(
  session: Session,
  edge: "start" | "end" = "start",
): SessionMoment | null {
  const timestamp = edge === "start" ? session.startedAt : session.endedAt;
  if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp)))
    return null;
  const instant = new Date(timestamp);
  const slices = session.slices.filter((slice) => slice.milliseconds > 0);
  const context = edge === "start" ? slices[0] : slices.at(-1);
  const timeZone =
    context?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatter = civilFormatter(timeZone);
  if (formatter) {
    const parts = Object.fromEntries(
      formatter.formatToParts(instant).map((part) => [part.type, part.value]),
    );
    const civil = new Date(0);
    civil.setUTCFullYear(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
    );
    civil.setUTCHours(
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
      0,
    );
    const civilMilliseconds = civil.getTime();
    return {
      timestamp,
      date: `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`,
      hour: Number(parts.hour),
      offset:
        (Math.floor(instant.getTime() / 1000) * 1000 - civilMilliseconds) /
        60000,
      timeZone,
      recorded: Boolean(context),
    };
  }
  const offset =
    context && Number.isFinite(context.offset)
      ? context.offset
      : instant.getTimezoneOffset();
  const civil = new Date(instant.getTime() - offset * 60000);
  return {
    timestamp,
    date: civil.toISOString().slice(0, 10),
    hour: civil.getUTCHours(),
    offset,
    timeZone: null,
    recorded: Boolean(context),
  };
}

export function utcOffsetLabel(offset: number): string {
  const minutes = Math.abs(offset);
  return `UTC${offset <= 0 ? "+" : "-"}${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatSessionMoment(
  moment: SessionMoment,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const instant = new Date(
    Date.parse(moment.timestamp) -
      (moment.timeZone ? 0 : moment.offset * 60000),
  );
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: moment.timeZone ?? "UTC",
  }).format(instant);
}
