import { bounded, type FollowMetrics, type Session } from "../engine/model";
import type { Exercise } from "./exercise";
import { pursuitPoint } from "./pursuit";
import { responseScore } from "./responses";
import { easeBalance, recordBalanceWindow } from "../adaptive/balance";
import {
  changeTouchLevel,
  ensureTouchChallenge,
  failTouchChallenge,
  followLevelGoalMilliseconds,
  followHalfwayMilliseconds,
  followGraceMilliseconds,
  followMotionFactor,
  recordTapChallenge,
  resetTouchRun,
  tapTimeLimit,
  touchTargetDiameter,
  touchDifficultyLoad,
  type TouchCue,
} from "./touch-challenge";

export interface Point {
  x: number;
  y: number;
}
export const fingerOffset = 56;
export const emptyFollowMetrics = (): FollowMetrics => ({
  trackedMilliseconds: 0,
  onTargetMilliseconds: 0,
  distanceWeightedMilliseconds: 0,
  currentRunMilliseconds: 0,
  bestRunMilliseconds: 0,
  windowMilliseconds: 0,
  windowOnTargetMilliseconds: 0,
});
const distance = (left: Point, right: Point) =>
  Math.hypot(left.x - right.x, left.y - right.y);

/** Pointer positions and timing are supplied by the shell; no DOM or React dependency. */
export class TouchExercise implements Exercise {
  private running = false;
  private width = 0;
  private height = 0;
  private seconds = 0;
  private cursor: Point = { x: 0, y: 0 };
  private grabOffset: Point | null = null;
  private press: Point | null = null;
  private lastSample: number | null = null;
  private cues: TouchCue[] = [];
  constructor(
    private session: Session,
    private random: () => number = Math.random,
  ) {}
  initialize() {
    this.running = true;
    const challenge = ensureTouchChallenge(this.session);
    if (challenge.version !== 3) challenge.mastered = false;
    challenge.version = 3;
    resetTouchRun(this.session);
    if (
      this.session.kind === "tap" &&
      (!this.session.tapState || this.session.tapState.expired)
    )
      this.placeTarget();
    if (
      this.session.kind === "tap" &&
      this.session.configuration.tapTimed !== false &&
      this.session.tapState
    )
      this.session.tapState.timeLimitMilliseconds ??= tapTimeLimit(
        this.session.configuration,
        touchDifficultyLoad(this.session),
      );
    if (this.session.kind === "follow") {
      this.session.follow ??= emptyFollowMetrics();
      this.session.follow.currentRunMilliseconds = 0;
    }
  }
  update(seconds: number) {
    this.seconds = seconds;
    const target = this.session.tapState;
    if (
      this.session.kind === "tap" &&
      this.running &&
      this.session.status === "running" &&
      this.session.configuration.tapTimed !== false &&
      target &&
      this.session.activeMilliseconds - target.presentedAtMilliseconds >
        this.targetTimeLimit()
    ) {
      this.session.trials.push({
        correct: false,
        qualified: false,
        timedOut: true,
        responseMilliseconds: this.targetTimeLimit(),
        difficulty: this.session.difficulty,
        ...this.tapPresentation(),
        timeLimitMilliseconds: this.targetTimeLimit(),
      });
      this.press = null;
      const cue = failTouchChallenge(this.session);
      if (cue) this.cues.push(cue);
      this.cues.push({ kind: "expired", level: this.session.difficulty });
      this.placeTarget();
    }
  }
  private targetTimeLimit() {
    return (
      this.session.tapState?.timeLimitMilliseconds ??
      tapTimeLimit(
        this.session.configuration,
        touchDifficultyLoad(this.session),
      )
    );
  }
  private tapPresentation() {
    const stimulusDiameter = Math.min(
      touchTargetDiameter(this.session),
      this.toleranceRadius() * 1.5,
    );
    return {
      stimulusDiameter,
      touchTolerance: this.toleranceRadius() * 2,
      precisionRadius: Math.min(
        this.toleranceRadius(),
        Math.max(4, stimulusDiameter / 2),
      ),
      adaptiveLoad: touchDifficultyLoad(this.session),
    };
  }
  drainCues(): TouchCue[] {
    return this.cues.splice(0);
  }
  setViewport(width: number, height: number) {
    if (width <= 0 || height <= 0 || !Number.isFinite(width + height))
      return false;
    const changed =
      this.width > 0 &&
      (Math.abs(width - this.width) > 1 || Math.abs(height - this.height) > 1);
    if (this.width === 0) {
      this.width = width;
      this.height = height;
      const area = this.area();
      this.cursor = {
        x: (area.left + area.right) / 2,
        y: (area.top + area.bottom) / 2,
      };
    } else {
      this.cursor = {
        x: (this.cursor.x * width) / this.width,
        y: (this.cursor.y * height) / this.height,
      };
      this.width = width;
      this.height = height;
      this.cursor = this.clamp(this.cursor);
    }
    return changed;
  }
  private baseToleranceRadius() {
    return Math.max(
      22,
      Math.min(
        this.session.configuration.touchTolerance / 2,
        (this.width - 24) / 2,
        (this.height -
          (this.session.kind === "follow" ? fingerOffset + 32 : 24)) /
          2,
      ),
    );
  }
  toleranceRadius() {
    const configured = Math.max(
      22,
      (this.session.configuration.touchTolerance / 2) *
        0.97 ** touchDifficultyLoad(this.session),
    );
    return Math.max(22, Math.min(configured, this.baseToleranceRadius()));
  }
  private area() {
    const margin = this.baseToleranceRadius() + 12;
    const bottomMargin =
      this.session.kind === "follow"
        ? Math.max(margin, fingerOffset + 28)
        : margin;
    const left = Math.min(this.width / 2, margin);
    const top = Math.min(
      (this.height - (this.session.kind === "follow" ? fingerOffset : 0)) / 2,
      margin,
    );
    return {
      left,
      right: Math.max(left, this.width - margin),
      top,
      bottom: Math.max(top, this.height - bottomMargin),
    };
  }
  private clamp(point: Point): Point {
    const area = this.area();
    return {
      x: bounded(point.x, area.left, area.right, area.left),
      y: bounded(point.y, area.top, area.bottom, area.top),
    };
  }
  targetPoint(
    seconds = this.seconds,
    phaseSeconds = this.session.challenge?.motionSeconds ?? seconds,
  ): Point {
    const area = this.area();
    const normalized =
      this.session.kind === "tap"
        ? [this.session.tapState?.x ?? 0.5, this.session.tapState?.y ?? 0.5]
        : pursuitPoint(this.session.configuration, seconds, phaseSeconds).map(
            (value) => (value + 1) / 2,
          );
    return {
      x: area.left + normalized[0] * (area.right - area.left),
      y: area.top + normalized[1] * (area.bottom - area.top),
    };
  }
  handlePoint(): Point {
    return { x: this.cursor.x, y: this.cursor.y + fingerOffset };
  }
  isHolding() {
    return this.grabOffset !== null;
  }
  isOnTarget() {
    return (
      this.isHolding() &&
      distance(this.cursor, this.targetPoint()) <= this.toleranceRadius()
    );
  }
  pointerDown(point: Point) {
    if (
      this.session.status !== "running" &&
      !(
        this.session.kind === "follow" &&
        this.session.status === "paused" &&
        this.session.awaitingTouch
      )
    )
      return false;
    if (
      !this.running ||
      this.press ||
      this.grabOffset ||
      !Number.isFinite(point.x + point.y)
    )
      return false;
    if (this.session.kind === "tap") {
      if (this.session.status !== "running") return false;
      this.press = point;
    } else {
      if (distance(point, this.handlePoint()) > 30) return false;
      this.grabOffset = {
        x: this.cursor.x - point.x,
        y: this.cursor.y - point.y,
      };
      this.lastSample = this.session.activeMilliseconds;
    }
    return true;
  }
  pointerMove(point: Point) {
    this.sample();
    if (this.press && distance(this.press, point) > 12) this.press = null;
    if (this.grabOffset)
      this.cursor = this.clamp({
        x: point.x + this.grabOffset.x,
        y: point.y + this.grabOffset.y,
      });
  }
  pointerUp(point: Point) {
    this.sample();
    if (this.session.kind === "tap")
      this.update(this.session.activeMilliseconds / 1000);
    const press = this.press;
    this.release();
    if (
      this.session.kind !== "tap" ||
      !press ||
      distance(press, point) > 12 ||
      point.x < 0 ||
      point.y < 0 ||
      point.x > this.width ||
      point.y > this.height ||
      this.session.status !== "running"
    )
      return null;
    const target = this.targetPoint(this.session.activeMilliseconds / 1000);
    const error = distance(point, target);
    const correct = error <= this.toleranceRadius();
    const responseMilliseconds = Math.max(
      0,
      this.session.activeMilliseconds -
        (this.session.tapState?.presentedAtMilliseconds ?? 0),
    );
    const timeLimitMilliseconds = this.targetTimeLimit();
    const presentation = this.tapPresentation();
    const qualified =
      correct &&
      error <= presentation.precisionRadius &&
      (this.session.configuration.tapTimed === false ||
        responseMilliseconds <= timeLimitMilliseconds);
    this.session.trials.push({
      correct,
      responseMilliseconds,
      difficulty: this.session.difficulty,
      touchDistance: error,
      ...presentation,
      qualified,
      ...(this.session.configuration.tapTimed !== false
        ? { timeLimitMilliseconds }
        : {}),
    });
    const cue = recordTapChallenge(this.session, qualified);
    if (cue) this.cues.push(cue);
    else if (correct && !qualified)
      this.cues.push({
        kind: error > presentation.precisionRadius ? "closer" : "slower",
        level: this.session.difficulty,
      });
    if (correct) this.placeTarget();
    return { correct, qualified, ...responseScore(this.session.trials) };
  }
  private placeTarget() {
    const previous = this.session.tapState;
    const area = this.area();
    const spanX = area.right - area.left,
      spanY = area.bottom - area.top;
    const separation = Math.min(
      this.toleranceRadius() * (3 + touchDifficultyLoad(this.session) * 0.04),
      Math.hypot(spanX, spanY) *
        (0.45 + touchDifficultyLoad(this.session) * 0.005),
    );
    let x = 0.5,
      y = 0.5;
    for (let attempt = 0; attempt < 16; attempt++) {
      x = bounded(this.random(), 0, 1, 0.5);
      y = bounded(this.random(), 0, 1, 0.5);
      if (
        !previous ||
        Math.hypot((x - previous.x) * spanX, (y - previous.y) * spanY) >=
          separation
      )
        break;
      if (attempt === 15) {
        x = previous.x < 0.5 ? 1 : 0;
        y = previous.y < 0.5 ? 1 : 0;
      }
    }
    this.session.tapState = {
      x,
      y,
      presentedAtMilliseconds: this.session.activeMilliseconds,
      ...(this.session.configuration.tapTimed !== false
        ? {
            timeLimitMilliseconds: tapTimeLimit(
              this.session.configuration,
              touchDifficultyLoad(this.session),
            ),
          }
        : {}),
    };
  }
  /** Integrate active milliseconds, not pointer-event counts or animation frames. */
  sample() {
    const metrics = this.session.follow;
    if (!this.grabOffset || this.lastSample === null || !metrics) return;
    const end = this.session.activeMilliseconds;
    const challenge = ensureTouchChallenge(this.session);
    let cursor = this.lastSample;
    while (cursor < end) {
      if (metrics.windowMilliseconds >= 10000) {
        metrics.windowMilliseconds = 0;
        metrics.windowOnTargetMilliseconds = 0;
      }
      const amount = Math.min(
        32,
        end - cursor,
        10000 - metrics.windowMilliseconds,
        challenge.mastered
          ? Infinity
          : (challenge.progressMilliseconds < followHalfwayMilliseconds
              ? followHalfwayMilliseconds
              : followLevelGoalMilliseconds) - challenge.progressMilliseconds,
      );
      const error = distance(
        this.cursor,
        this.targetPoint(
          (cursor + amount / 2) / 1000,
          challenge.motionSeconds +
            (amount / 2000) *
              followMotionFactor(
                this.session.configuration,
                touchDifficultyLoad(this.session),
              ),
        ),
      );
      challenge.motionSeconds +=
        (amount / 1000) *
        followMotionFactor(
          this.session.configuration,
          touchDifficultyLoad(this.session),
        );
      const inside = error <= this.toleranceRadius();
      metrics.trackedMilliseconds += amount;
      metrics.distanceWeightedMilliseconds += error * amount;
      metrics.windowMilliseconds += amount;
      if (inside) {
        metrics.onTargetMilliseconds += amount;
        metrics.windowOnTargetMilliseconds += amount;
        metrics.currentRunMilliseconds += amount;
        metrics.bestRunMilliseconds = Math.max(
          metrics.bestRunMilliseconds,
          metrics.currentRunMilliseconds,
        );
        challenge.outsideMilliseconds = 0;
        const previousProgress = challenge.progressMilliseconds;
        if (!challenge.mastered) challenge.progressMilliseconds += amount;
        if (
          previousProgress < followHalfwayMilliseconds &&
          challenge.progressMilliseconds >= followHalfwayMilliseconds
        )
          this.cues.push({ kind: "milestone", level: this.session.difficulty });
        if (
          !challenge.mastered &&
          challenge.progressMilliseconds >= followLevelGoalMilliseconds
        ) {
          const cue = changeTouchLevel(this.session, 1, cursor + amount);
          if (cue) this.cues.push(cue);
        }
      } else {
        metrics.currentRunMilliseconds = 0;
        challenge.outsideMilliseconds += amount;
        if (challenge.outsideMilliseconds > followGraceMilliseconds)
          challenge.progressMilliseconds = 0;
        if (challenge.outsideMilliseconds >= 5000) {
          const adjustment = easeBalance(challenge.balance!, cursor + amount);
          metrics.windowMilliseconds = 0;
          metrics.windowOnTargetMilliseconds = 0;
          challenge.outsideMilliseconds = 0;
          if (adjustment < 0)
            this.cues.push({
              kind: "level-down",
              level: this.session.difficulty,
            });
        }
      }
      if (metrics.windowMilliseconds >= 10000) {
        const adjustment = recordBalanceWindow(
          challenge.balance!,
          metrics.windowOnTargetMilliseconds / metrics.windowMilliseconds,
          cursor + amount,
        );
        if (adjustment < 0)
          this.cues.push({
            kind: "level-down",
            level: this.session.difficulty,
          });
        metrics.windowMilliseconds = 0;
        metrics.windowOnTargetMilliseconds = 0;
      }
      cursor += amount;
    }
    this.lastSample = end;
  }
  release(resetChallenge = false) {
    this.sample();
    this.grabOffset = null;
    this.press = null;
    this.lastSample = null;
    if (this.session.follow) this.session.follow.currentRunMilliseconds = 0;
    if (resetChallenge || this.session.kind === "follow")
      resetTouchRun(this.session);
  }
  terminate() {
    this.release(true);
    this.running = false;
  }
  render(context: CanvasRenderingContext2D, width: number, height: number) {
    this.setViewport(width, height);
    const settings = this.session.configuration;
    context.fillStyle = settings.background;
    context.fillRect(0, 0, width, height);
    if (!this.running) return;
    const target = this.targetPoint();
    const radius = this.toleranceRadius();
    context.save();
    context.globalAlpha = settings.contrast;
    context.strokeStyle = settings.foreground;
    context.fillStyle = settings.foreground;
    context.lineWidth = this.isOnTarget() || this.press ? 3 : 1.5;
    context.beginPath();
    context.arc(target.x, target.y, radius, 0, Math.PI * 2);
    if (this.session.kind === "tap")
      context.globalAlpha = settings.contrast * 0.3;
    context.stroke();
    if (this.session.kind === "tap" && settings.tapTimed !== false) {
      const remaining = Math.max(
        0,
        1 -
          (this.session.activeMilliseconds -
            (this.session.tapState?.presentedAtMilliseconds ?? 0)) /
            this.targetTimeLimit(),
      );
      context.globalAlpha = settings.contrast;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(
        target.x,
        target.y,
        radius,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * remaining,
      );
      context.stroke();
    }
    context.globalAlpha = settings.contrast;
    context.beginPath();
    context.arc(
      target.x,
      target.y,
      Math.min(touchTargetDiameter(this.session) / 2, radius * 0.75),
      0,
      Math.PI * 2,
    );
    context.fill();
    context.globalAlpha = 1;
    if (this.session.kind === "follow") {
      const handle = this.handlePoint();
      context.strokeStyle = "#e8d9d6";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(this.cursor.x, this.cursor.y, 10, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = "#9f8586";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(this.cursor.x, this.cursor.y + 13);
      context.lineTo(handle.x, handle.y - 23);
      context.stroke();
      context.fillStyle = this.isHolding() ? "#503336" : "#2d2022";
      context.strokeStyle = "#e8d9d6";
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(handle.x, handle.y, 22, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(handle.x - 6, handle.y - 3);
      context.lineTo(handle.x + 6, handle.y - 3);
      context.moveTo(handle.x - 6, handle.y + 3);
      context.lineTo(handle.x + 6, handle.y + 3);
      context.stroke();
    }
    context.restore();
  }
}
