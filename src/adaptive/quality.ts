import type { Session, Trial } from "../engine/model";
import type { QualityReason } from "./types";

// A presentation-quality guard, not a measurement of display or input latency.
export const maximumFrameGapMilliseconds = 250;
export function initializeQuality(session: Session) {
  session.presentationQuality ??= {
    version: 1,
    pending: [],
    presented: false,
    events: [],
  };
}
export function flagPresentation(
  session: Session,
  reason: QualityReason,
  gapMilliseconds = 0,
) {
  const quality = session.presentationQuality;
  if (!quality) return;
  if (!quality.pending.includes(reason)) quality.pending.push(reason);
  quality.events.push({
    activeMilliseconds: session.activeMilliseconds,
    reason,
    gapMilliseconds,
  });
  if (quality.events.length > 300) quality.events.shift();
}
export function recordFrameGap(session: Session, gapMilliseconds: number) {
  if (
    Number.isFinite(gapMilliseconds) &&
    gapMilliseconds > maximumFrameGapMilliseconds
  )
    flagPresentation(
      session,
      "frame-stall",
      Math.min(3600000, gapMilliseconds),
    );
}
export function completePresentation(session: Session): Pick<Trial, "quality"> {
  const quality = session.presentationQuality;
  if (!quality) return {};
  if (!quality.presented && !quality.pending.includes("not-presented"))
    quality.pending.push("not-presented");
  const reasons = [...quality.pending];
  quality.pending = [];
  quality.presented = false;
  return { quality: { reasons } };
}
