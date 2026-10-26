import { describe, expect, it } from "vitest";
import { defaults, initialData, type Session } from "../engine/model";
import {
  activityPeriod,
  addCalendarDays,
  buildActivity,
  firstWeekday,
  selectedActivityEntries,
  shiftActivityDate,
  validCalendarDate,
} from "./activity";
import {
  formatSessionMoment,
  sessionMoment,
  utcOffsetLabel,
} from "./session-time";

function record(overrides: Partial<Session> = {}): Session {
  return {
    id: "session",
    kind: "pursuit",
    eye: "Left",
    configuration: { ...defaults },
    startedAt: "2026-10-25T08:00:00Z",
    endedAt: "2026-10-25T11:00:00Z",
    status: "abandoned",
    activeMilliseconds: 300000,
    slices: [
      {
        date: "2026-10-25",
        timezone: "Asia/Ho_Chi_Minh",
        offset: -420,
        milliseconds: 300000,
      },
    ],
    trials: [],
    difficulty: 0,
    ...overrides,
  };
}
describe("calendar periods", () => {
  it("uses the locale's first weekday and calendar weeks", () => {
    expect(firstWeekday("en-US")).toBe(0);
    expect(firstWeekday("en-GB")).toBe(1);
    expect(firstWeekday("vi-VN")).toBe(1);
    expect(activityPeriod("2026-10-25", "Week", 0)).toMatchObject({
      start: "2026-10-25",
      end: "2026-10-31",
    });
    expect(activityPeriod("2026-10-25", "Week", 1)).toMatchObject({
      start: "2026-10-19",
      end: "2026-10-25",
    });
  });
  it("handles month lengths, leap days and year boundaries without fixed-day arithmetic", () => {
    expect(activityPeriod("2024-02-20", "Month", 1).days).toHaveLength(29);
    expect(activityPeriod("2025-02-20", "Month", 1).days).toHaveLength(28);
    expect(shiftActivityDate("2026-01-31", "Month", 1)).toBe("2026-02-28");
    expect(shiftActivityDate("2024-03-31", "Month", -1)).toBe("2024-02-29");
    expect(shiftActivityDate("2026-12-31", "Day", 1)).toBe("2027-01-01");
    expect(shiftActivityDate("2026-01-01", "Week", -1)).toBe("2025-12-25");
    expect(addCalendarDays("2026-11-01", 1)).toBe("2026-11-02");
  });
  it("rejects malformed and nonexistent dates", () => {
    for (const value of ["invalid", "2026-2-01", "2026-02-30", "2026-13-01"]) {
      expect(validCalendarDate(value)).toBe(false);
      expect(() => activityPeriod(value, "Month", 1)).toThrow();
    }
  });
});
describe("session wall-clock times", () => {
  it("uses the recorded time zone rather than the current device's time zone", () => {
    const moment = sessionMoment(record())!;
    expect(moment).toMatchObject({
      date: "2026-10-25",
      hour: 15,
      offset: -420,
      recorded: true,
    });
    expect(
      formatSessionMoment(moment, "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    ).toBe("15:00");
  });
  it("distinguishes repeated daylight-saving hours using the recorded zone", () => {
    const session = record({
      startedAt: "2026-11-01T05:30:00Z",
      endedAt: "2026-11-01T06:30:00Z",
      slices: [
        {
          date: "2026-11-01",
          timezone: "America/New_York",
          offset: 240,
          milliseconds: 150000,
        },
        {
          date: "2026-11-01",
          timezone: "America/New_York",
          offset: 300,
          milliseconds: 150000,
        },
      ],
    });
    expect(sessionMoment(session, "start")).toMatchObject({
      hour: 1,
      offset: 240,
    });
    expect(sessionMoment(session, "end")).toMatchObject({
      hour: 1,
      offset: 300,
    });
  });
  it("falls back to a saved offset when the IANA zone is unavailable", () => {
    const session = record({
      startedAt: "2026-10-25T20:30:00Z",
      slices: [
        {
          date: "2026-10-26",
          timezone: "Unavailable/Zone",
          offset: -345,
          milliseconds: 300000,
        },
      ],
    });
    const moment = sessionMoment(session)!;
    expect(moment).toMatchObject({
      date: "2026-10-26",
      hour: 2,
      timeZone: null,
      recorded: true,
    });
    expect(
      formatSessionMoment(moment, "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    ).toBe("02:15");
    expect(utcOffsetLabel(moment.offset)).toBe("UTC+05:45");
  });
  it("marks missing legacy zones as device time and tolerates missing or invalid end timestamps", () => {
    expect(sessionMoment(record({ slices: [] }))?.recorded).toBe(false);
    expect(sessionMoment(record({ endedAt: undefined }), "end")).toBeNull();
    expect(sessionMoment(record({ endedAt: "invalid" }), "end")).toBeNull();
  });
});
describe("activity browsing", () => {
  it("groups daily sessions by start hour without counting a three-hour wall span as training", () => {
    const data = initialData();
    data.sessions = [record()];
    const view = buildActivity(data, "Day", "2026-10-25", 1, "2026-10-26");
    expect(view.activeMilliseconds).toBe(300000);
    expect(view.buckets[15]).toMatchObject({
      activeMilliseconds: 300000,
      sessionCount: 1,
    });
    expect(
      view.buckets.reduce((sum, bucket) => sum + bucket.activeMilliseconds, 0),
    ).toBe(300000);
    expect(selectedActivityEntries(view, 15)).toHaveLength(1);
    expect(selectedActivityEntries(view, 16)).toEqual([]);
  });
  it("credits cross-midnight activity to each actual date and counts the session once per period", () => {
    const data = initialData();
    data.sessions = [
      record({
        startedAt: "2026-05-31T16:59:00Z",
        endedAt: "2026-05-31T17:02:00Z",
        activeMilliseconds: 180000,
        slices: [
          {
            date: "2026-05-31",
            timezone: "Asia/Ho_Chi_Minh",
            offset: -420,
            milliseconds: 60000,
          },
          {
            date: "2026-06-01",
            timezone: "Asia/Ho_Chi_Minh",
            offset: -420,
            milliseconds: 120000,
          },
        ],
      }),
    ];
    const week = buildActivity(data, "Week", "2026-05-31", 0, "2026-06-02");
    expect(week).toMatchObject({
      sessionCount: 1,
      activeDays: 2,
      activeMilliseconds: 180000,
    });
    expect(
      week.buckets.slice(0, 2).map((bucket) => bucket.activeMilliseconds),
    ).toEqual([60000, 120000]);
    expect(
      buildActivity(data, "Month", "2026-05-01", 0).activeMilliseconds,
    ).toBe(60000);
    expect(
      buildActivity(data, "Month", "2026-06-01", 0).activeMilliseconds,
    ).toBe(120000);
    const continuation = buildActivity(data, "Day", "2026-06-01", 0);
    expect(continuation.continuedMilliseconds).toBe(120000);
    expect(continuation.entries[0].continued).toBe(true);
    expect(
      continuation.buckets.every((bucket) => bucket.activeMilliseconds === 0),
    ).toBe(true);
  });
  it("deduplicates current/history copies and preserves partial and zero-time records", () => {
    const data = initialData();
    const session = record();
    data.sessions = [
      session,
      session,
      record({ id: "zero", activeMilliseconds: 0, slices: [] }),
    ];
    data.current = {
      ...session,
      activeMilliseconds: 200000,
      slices: [{ ...session.slices[0], milliseconds: 200000 }],
      status: "interrupted",
    };
    const view = buildActivity(data, "Month", "2026-10-25", 1);
    expect(view.sessionCount).toBe(2);
    expect(view.activeMilliseconds).toBe(200000);
    expect(
      view.entries.find((entry) => entry.session.id === "session")?.session
        .status,
    ).toBe("interrupted");
  });
  it("returns complete empty periods and limits navigation to recorded dates and today", () => {
    const empty = buildActivity(
      initialData(),
      "Month",
      "2026-10-25",
      1,
      "2026-10-26",
    );
    expect(empty.buckets).toHaveLength(31);
    expect(empty.entries).toEqual([]);
    expect(empty).toMatchObject({
      activeMilliseconds: 0,
      sessionCount: 0,
      minimumDate: "2026-10-26",
      maximumDate: "2026-10-26",
    });
    const data = initialData();
    data.sessions = [record()];
    const populated = buildActivity(
      data,
      "Week",
      "2026-10-25",
      1,
      "2026-10-26",
    );
    expect(populated).toMatchObject({
      minimumDate: "2026-10-25",
      maximumDate: "2026-10-26",
    });
    expect(selectedActivityEntries(populated, -1)).toEqual([]);
  });
  it("keeps the reset undo copy out of browsable history", () => {
    const data = initialData();
    data.statisticsReset = {
      resetAt: "2026-10-26T12:00:00Z",
      sessions: [record()],
    };
    expect(buildActivity(data, "Month", "2026-10-25", 1).sessionCount).toBe(0);
  });
});
