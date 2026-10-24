import { describe, it, expect } from "vitest";
import { ActiveTimer, adapt } from "./timer";
import {
  defaults,
  initialData,
  validate,
  localDate,
  type Session,
} from "./model";
import { advanceRoutine, advanceBreak, validDuration } from "./routines";
import { totalForDate } from "../analytics/totals";
function fixture() {
  let now = 0;
  const session: Session = {
    id: "test",
    kind: "pursuit",
    eye: "Left",
    configuration: { ...defaults, duration: 60 },
    startedAt: new Date().toISOString(),
    status: "paused",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
  const timer = new ActiveTimer(
    session,
    () => now,
    () => new Date(2026, 9, 24, 12, 0, 0),
  );
  return {
    timer,
    session,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
}
describe("active timer", () => {
  it("credits monotonic intervals rather than frame count", () => {
    const { timer, session, advance } = fixture();
    timer.resume();
    advance(1234);
    timer.checkpoint();
    advance(56);
    timer.checkpoint();
    expect(session.activeMilliseconds).toBe(1290);
  });
  it("never counts paused or background intervals", () => {
    const { timer, session, advance } = fixture();
    timer.resume();
    advance(1000);
    timer.pause(true);
    advance(600000);
    timer.checkpoint();
    expect(session.activeMilliseconds).toBe(1000);
    timer.resume();
    advance(2000);
    timer.pause();
    expect(session.activeMilliseconds).toBe(3000);
  });
  it("preserves partial sessions and prevents duplicate resume credit", () => {
    const { timer, session, advance } = fixture();
    timer.resume();
    timer.resume();
    advance(1500);
    timer.finish();
    advance(9000);
    timer.resume();
    timer.checkpoint();
    expect(session.activeMilliseconds).toBe(1500);
    expect(session.status).toBe("completed");
  });
  it("caps time at configured duration", () => {
    const { timer, session, advance } = fixture();
    timer.resume();
    advance(80000);
    timer.finish();
    expect(session.activeMilliseconds).toBe(60000);
  });
  it("retains valid time when abandoned", () => {
    const { timer, session, advance } = fixture();
    timer.resume();
    advance(700);
    timer.finish(true);
    expect(session.status).toBe("abandoned");
    expect(session.activeMilliseconds).toBe(700);
  });
  it("requires explicit resume after recovery", () => {
    const { session } = fixture();
    session.activeMilliseconds = 4000;
    session.status = "interrupted";
    const recovered = new ActiveTimer(session, () => 1000000);
    recovered.checkpoint();
    expect(session.activeMilliseconds).toBe(4000);
  });
  it("splits active intervals across local midnight", () => {
    let now = 0;
    const { session } = fixture();
    const timer = new ActiveTimer(
      session,
      () => now,
      () => new Date(2026, 9, 25, 0, 0, 1),
    );
    timer.resume();
    now = 2000;
    timer.checkpoint();
    expect(
      session.slices.map((slice) => [slice.date, slice.milliseconds]),
    ).toEqual([
      ["2026-10-24", 1000],
      ["2026-10-25", 1000],
    ]);
  });
});
describe("progress and routines", () => {
  it("does not double count a current session already in history", () => {
    const data = initialData();
    const { session } = fixture();
    session.slices = [
      {
        date: localDate(new Date()),
        timezone: "America/Los_Angeles",
        offset: 420,
        milliseconds: 1000,
      },
    ];
    data.sessions = [session];
    data.current = session;
    expect(totalForDate(data)).toBe(1000);
  });
  it("advances steps and ends at final step", () => {
    const data = initialData();
    data.run = {
      routine: {
        id: "routine",
        name: "Test",
        steps: [
          { kind: "pursuit", duration: 60 },
          { kind: "contrast", duration: 60 },
        ],
        rest: 60,
        manual: false,
      },
      index: 0,
      eye: "Left",
    };
    advanceRoutine(data);
    expect(data.run?.index).toBe(1);
    advanceRoutine(data);
    expect(data.run).toBeNull();
  });
  it("breaks stop at zero and do not tick while hidden", () => {
    expect(advanceBreak(60, 2000, false)).toBe(58);
    expect(advanceBreak(60, 60000, true)).toBe(60);
    expect(advanceBreak(2, 5000, false)).toBe(0);
  });
  it("validates invalid and extreme durations", () => {
    expect(validDuration(NaN)).toBe(300);
    expect(validDuration(-20)).toBe(10);
    expect(validDuration(999999)).toBe(3600);
    expect(validate({ ...defaults, size: Infinity, contrast: -1 }).size).toBe(
      28,
    );
  });
  it("keeps progression bounded and performance-based", () => {
    expect(adapt(12, [true, true, true, true, true])).toBe(12);
    expect(adapt(0, [false, false, false, false, false])).toBe(0);
    expect(adapt(3, [true, true, true, true, false])).toBe(4);
    expect(adapt(3, [])).toBe(3);
  });
});
