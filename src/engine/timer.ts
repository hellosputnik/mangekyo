import { localDate, type Session } from "./model";
/** Only monotonic foreground intervals are credited. A recovered timer never runs. */
export class ActiveTimer {
  private anchor: number | null = null;
  constructor(
    public session: Session,
    private clock: () => number = () => performance.now(),
    private wall: () => Date = () => new Date(),
  ) {}
  resume() {
    if (
      this.anchor !== null ||
      ["completed", "abandoned"].includes(this.session.status)
    )
      return;
    this.anchor = this.clock();
    this.session.status = "running";
  }
  checkpoint() {
    if (this.anchor === null) return;
    const now = this.clock();
    const delta = Math.max(
      0,
      Math.min(
        now - this.anchor,
        this.session.configuration.duration * 1000 -
          this.session.activeMilliseconds,
      ),
    );
    this.anchor = now;
    this.session.activeMilliseconds += delta;
    // Split foreground time crossing local midnight using the interval's end wall time.
    let remaining = delta;
    const end = this.wall();
    let cursor = end.getTime() - delta;
    while (remaining > 0) {
      const date = new Date(cursor);
      const midnight = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1,
      ).getTime();
      const amount = Math.min(remaining, midnight - cursor);
      const key = localDate(date);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = date.getTimezoneOffset();
      const last = this.session.slices.at(-1);
      if (
        last?.date === key &&
        last.timezone === timezone &&
        last.offset === offset
      )
        last.milliseconds += amount;
      else
        this.session.slices.push({
          date: key,
          timezone,
          offset,
          milliseconds: amount,
        });
      remaining -= amount;
      cursor += amount;
    }
  }
  pause(interrupted = false) {
    if (["completed", "abandoned"].includes(this.session.status)) return;
    this.checkpoint();
    this.anchor = null;
    this.session.status = interrupted ? "interrupted" : "paused";
  }
  finish() {
    if (["completed", "abandoned"].includes(this.session.status)) return;
    this.checkpoint();
    this.anchor = null;
    this.session.status = (
      this.session.checkIn
        ? this.session.trials.length >= this.session.checkIn.targetTrials
        : this.session.activeMilliseconds >=
          this.session.configuration.duration * 1000
    )
      ? "completed"
      : "abandoned";
    this.session.endedAt = this.wall().toISOString();
  }
}
export function adapt(
  level: number,
  answers: boolean[],
  threshold = 0.8,
): number {
  if (answers.length < 5) return level;
  const accuracy = answers.filter(Boolean).length / answers.length;
  return Math.min(
    12,
    Math.max(0, level + (accuracy >= threshold ? 1 : accuracy < 0.6 ? -1 : 0)),
  );
}
