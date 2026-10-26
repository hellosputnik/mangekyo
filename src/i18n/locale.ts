import type {
  ExerciseKind,
  Eye,
  Pattern,
  Session,
  Configuration,
} from "../engine/model";
import { english, type MessageKey } from "./en";
import { vietnamese } from "./vi";
import {
  formatSessionMoment,
  type SessionMoment,
} from "../analytics/session-time";

export type Language = "en" | "vi";
export type LanguagePreference = Language | "system";
export type { MessageKey } from "./en";
export const languageOptions = ["system", "en", "vi"] as const;

export function normalizeLanguagePreference(
  value: unknown,
): LanguagePreference {
  return value === "en" || value === "vi" ? value : "system";
}
function supportedLanguage(tag: string): Language | null {
  const primary = tag.toLowerCase().split(/[-_]/)[0];
  return primary === "vi" || primary === "en" ? primary : null;
}
export function resolveLanguage(
  preference: LanguagePreference,
  languages: readonly string[],
): Language {
  if (preference === "en" || preference === "vi") return preference;
  for (const tag of languages) {
    const language = supportedLanguage(tag);
    if (language) return language;
  }
  return "en";
}
export function readLanguageFromUrl(search: string): Language | null {
  const tag = new URLSearchParams(search).get("lang");
  return tag ? supportedLanguage(tag) : null;
}

const exerciseKeys: Record<ExerciseKind, MessageKey> = {
  pursuit: "exercise.pursuit",
  saccades: "exercise.saccades",
  visual: "exercise.visual",
  contrast: "exercise.contrast",
  tap: "exercise.tap",
  follow: "exercise.follow",
};
const descriptionKeys: Record<ExerciseKind, MessageKey> = {
  pursuit: "description.pursuit",
  saccades: "description.saccades",
  visual: "description.visual",
  contrast: "description.contrast",
  tap: "description.tap",
  follow: "description.follow",
};
const eyeKeys: Record<Eye, MessageKey> = {
  Left: "eye.Left",
  Right: "eye.Right",
  Both: "eye.Both",
};
const patternKeys: Record<Pattern, MessageKey> = {
  Mixed: "pattern.Mixed",
  Horizontal: "pattern.Horizontal",
  Vertical: "pattern.Vertical",
  Circle: "pattern.Circle",
  "Figure eight": "pattern.Figure eight",
  Wandering: "pattern.Wandering",
};
const statusKeys: Record<Session["status"], MessageKey> = {
  running: "status.running",
  paused: "status.paused",
  interrupted: "status.interrupted",
  completed: "status.completed",
  abandoned: "status.abandoned",
};
const stimulusKeys: Record<
  Configuration["stimulus"] | Configuration["contrastStimulus"],
  MessageKey
> = {
  Opening: "stimulus.Opening",
  Orientation: "stimulus.Orientation",
  Shape: "stimulus.Shape",
  Grating: "stimulus.Grating",
};
const optionKeys: Record<string, MessageKey> = {
  ...eyeKeys,
  ...patternKeys,
  ...stimulusKeys,
};

export function createLocalization(
  language: Language,
  browserLanguages: readonly string[] = [],
) {
  let locale = language === "vi" ? "vi-VN" : "en-US";
  for (const tag of browserLanguages) {
    if (supportedLanguage(tag) !== language) continue;
    try {
      const canonical = Intl.getCanonicalLocales(tag.replaceAll("_", "-"))[0];
      if (Intl.DateTimeFormat.supportedLocalesOf([canonical]).length) {
        locale = canonical;
        break;
      }
    } catch {
      /* Ignore malformed device locale tags. */
    }
  }
  const catalog: Record<MessageKey, string> =
    language === "vi" ? vietnamese : english;
  const t = (
    key: MessageKey,
    values: Record<string, string | number> = {},
  ): string =>
    catalog[key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      values[name] === undefined ? placeholder : String(values[name]),
    );
  const number = (value: number, digits?: number): string =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits ?? 3,
    }).format(value);
  const percent = (value: number): string =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value);
  const time = (milliseconds: number): string => {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${number(Math.floor(seconds / 60))}:${new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(seconds % 60)}`;
  };
  const date = (
    value: Date | string,
    options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  ): string => {
    const parsed =
      typeof value === "string"
        ? new Date(
            /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value,
          )
        : value;
    return Number.isNaN(parsed.getTime())
      ? String(value)
      : new Intl.DateTimeFormat(locale, options).format(parsed);
  };
  const duration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60),
      remainder = seconds % 60;
    if (!remainder && minutes) return `${number(minutes)} ${t("unit.minutes")}`;
    if (!minutes)
      return t("duration.onlySeconds", { seconds: number(remainder) });
    return t("duration.both", {
      minutes: number(minutes),
      seconds: number(remainder),
    });
  };
  const trainingTime = (milliseconds: number): string => {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    if (seconds < 3600) return duration(seconds);
    return t("statistics.hoursMinutes", {
      hours: number(Math.floor(seconds / 3600)),
      minutes: number(Math.floor((seconds % 3600) / 60)),
    });
  };
  const calendarDate = (
    value: string,
    options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  ): string =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
      new Date(`${value}T12:00:00Z`),
    );
  const calendarRange = (start: string, end: string): string => {
    if (start === end)
      return calendarDate(start, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    const formatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    return typeof formatter.formatRange === "function"
      ? formatter.formatRange(
          new Date(`${start}T12:00:00Z`),
          new Date(`${end}T12:00:00Z`),
        )
      : `${calendarDate(start)} – ${calendarDate(end)}`;
  };
  const clockHour = (hour: number, minute?: number): string =>
    new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      ...(minute === undefined ? {} : { minute: "2-digit" }),
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2000, 0, 1, hour, minute ?? 0)));
  return {
    duration,
    trainingTime,
    calendarDate,
    calendarRange,
    clockHour,
    sessionMomentText: (
      moment: SessionMoment,
      options: Intl.DateTimeFormatOptions,
    ) => formatSessionMoment(moment, locale, options),
    language,
    locale,
    t,
    number,
    percent,
    time,
    date,
    exerciseName: (kind: ExerciseKind) => t(exerciseKeys[kind]),
    exerciseDescription: (kind: ExerciseKind) => t(descriptionKeys[kind]),
    eyeLabel: (eye: Eye) => t(eyeKeys[eye]),
    patternLabel: (pattern: Pattern) => t(patternKeys[pattern]),
    statusLabel: (status: Session["status"]) => t(statusKeys[status]),
    stimulusLabel: (
      stimulus: Configuration["stimulus"] | Configuration["contrastStimulus"],
    ) => t(stimulusKeys[stimulus]),
    optionLabel: (value: string) =>
      Object.hasOwn(optionKeys, value) ? t(optionKeys[value]) : value,
  };
}
export type Localization = ReturnType<typeof createLocalization>;
