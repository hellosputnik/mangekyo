import type { Configuration, Session } from "../engine/model";
import type { PracticeActivity } from "./types";
import { maximumVisualDifficulty } from "../exercises/visual";
import { alignmentGeometry } from "../exercises/alignment";
import { crowdingGeometry } from "../exercises/crowding";

export const practiceRules = {
  version: 1,
  target: 0.85,
  window: 5,
  evidenceLimit: 30,
  establishedSamples: 20,
  staleDays: 14,
  checkEvery: 25,
  maximumDecisions: 1000,
  maximumProfiles: 200,
} as const;
export function activitiesFor(
  session: Pick<Session, "kind">,
): PracticeActivity[] {
  if (session.kind === "tracking") return ["Track"];
  if (session.kind === "search") return ["Count", "Match", "Moving"];
  if (session.kind === "memory")
    return ["Locations", "Digits", "Directions", "Compare"];
  if (session.kind === "sequence") return ["Numbers"];
  return ["pursuit", "saccades"].includes(session.kind)
    ? []
    : [session.kind as PracticeActivity];
}
export function activityRules(session: Session, activity: PracticeActivity) {
  const settings = session.configuration;
  const screen = session.adaptation?.viewport ??
    session.viewport ?? { width: 390, height: 300, pixelRatio: 1 };
  let maximum = 24,
    coarse = 1,
    fine = 0.3;
  const coarseWindows = [
    "Track",
    "Count",
    "Match",
    "Moving",
    "Locations",
    "Digits",
    "Directions",
    "Compare",
    "Numbers",
  ].includes(activity)
    ? 8
    : 3;
  if (activity === "visual") {
    maximum = maximumVisualDifficulty(settings, screen);
    fine = 0.3;
  }
  if (activity === "contrast") {
    maximum = Math.max(0, Math.log(0.03 / settings.contrast) / Math.log(0.84));
    coarse = 0.6;
    fine = 0.15;
  }
  if (activity === "crowding") {
    fine = 0.25;
    const geometry = crowdingGeometry(settings, 0, screen);
    const requested = geometry.diameter * (settings.crowdingSpacing ?? 1);
    const offset =
      geometry.gap > 0
        ? Math.max(0, Math.log(geometry.gap / requested) / Math.log(0.9))
        : 24;
    const minimum = Math.min(
      geometry.gap,
      Math.max(1 / screen.pixelRatio, geometry.diameter * 0.08),
    );
    maximum =
      geometry.gap > 0
        ? Math.max(
            0,
            Math.min(
              24 - offset,
              Math.log(minimum / geometry.gap) / Math.log(0.9),
            ),
          )
        : 0;
  }
  if (activity === "alignment") {
    const pixels =
      alignmentGeometry(settings, 0, screen).offset * screen.pixelRatio;
    maximum = Math.max(0, Math.round(pixels) - 1);
    coarse = Math.max(1, Math.floor(pixels * 0.1));
    fine = 0.35;
  }
  if (activity === "tap") {
    maximum = Math.min(
      40,
      Math.max(0, Math.log(8 / settings.size) / Math.log(0.92)),
    );
    coarse = 2;
    fine = 0.35;
  }
  if (activity === "follow") {
    maximum = Math.min(
      40,
      Math.max(
        0,
        Math.log(
          Math.max(settings.speed, settings.gentleMotion ? 0.08 : 0.22) /
            settings.speed,
        ) / Math.log(1.05),
      ),
    );
    coarse = 2;
    fine = 0.5;
  }
  if (["Count", "Match"].includes(activity))
    maximum = 12 - (settings.searchItems ?? 6);
  if (activity === "Numbers") maximum = 12 - (settings.sequenceItems ?? 6);
  if (activity === "Moving")
    maximum = Math.max(
      0,
      Math.min(
        24,
        Math.log(
          (settings.gentleMotion
            ? Math.max(0.08, Math.min(settings.speed, 0.08))
            : 1.2) /
            Math.max(
              0.06,
              Math.min(settings.speed, settings.gentleMotion ? 0.08 : 1),
            ),
        ) / Math.log(1.06),
      ),
    );
  if (activity === "Track")
    maximum =
      6 -
      (settings.trackingObjects ?? 3) +
      Math.max(
        0,
        Math.min(
          18,
          Math.log(
            (settings.gentleMotion ? 0.08 : 0.27) /
              Math.min(settings.speed, settings.gentleMotion ? 0.08 : 0.27),
          ) / Math.log(1.08),
        ),
      );
  if (["Locations", "Digits", "Directions", "Compare"].includes(activity))
    maximum =
      (activity === "Compare"
        ? 0
        : Math.max(
            0,
            (activity === "Digits" ? 3 : 4) - (settings.recallItems ?? 1),
          )) +
      Math.max(
        0,
        Math.log(0.8 / (settings.recallExposure ?? 1.8)) / Math.log(0.95),
      );
  return { maximum: Math.max(0, maximum), coarse, fine, coarseWindows };
}

/** Map adaptive load to the legacy renderer's coordinate, retaining real pixel/gap limits. */
export function presentedDifficulty(
  session: Session,
  activity: PracticeActivity,
  challenge: number,
) {
  const screen = session.adaptation?.viewport ??
    session.viewport ?? { width: 390, height: 300, pixelRatio: 1 };
  if (activity === "alignment") {
    const basePixels =
      alignmentGeometry(session.configuration, 0, screen).offset *
      screen.pixelRatio;
    const pixels = Math.max(1, Math.round(basePixels - challenge));
    return Math.max(0, Math.log(pixels / basePixels) / Math.log(0.9));
  }
  if (activity === "crowding") {
    const base = crowdingGeometry(session.configuration, 0, screen);
    const requested =
      base.diameter * (session.configuration.crowdingSpacing ?? 1);
    return Math.max(
      0,
      Math.min(
        24,
        challenge +
          (base.gap > 0 ? Math.log(base.gap / requested) / Math.log(0.9) : 0),
      ),
    );
  }
  return ["visual", "contrast"].includes(activity)
    ? challenge
    : Math.min(24, Math.floor(challenge));
}

export function adaptiveAttentionSettings(
  settings: Configuration,
  activity: PracticeActivity,
  challenge: number,
) {
  const step = Math.max(0, challenge);
  const baseSpeed = settings.gentleMotion
    ? Math.min(settings.speed, 0.08)
    : settings.speed;
  const countSteps = 6 - (settings.trackingObjects ?? 3);
  const recallBase = settings.recallItems ?? 1;
  const memoryMaximum = activity === "Digits" ? 3 : 4;
  const loadSteps = Math.max(0, memoryMaximum - recallBase);
  return {
    objects: Math.min(6, (settings.trackingObjects ?? 3) + Math.floor(step)),
    speed:
      activity === "Track"
        ? Math.min(
            settings.gentleMotion ? 0.08 : 0.27,
            Math.min(baseSpeed, 0.27) * 1.08 ** Math.max(0, step - countSteps),
          )
        : Math.min(
            settings.gentleMotion ? 0.08 : 1.2,
            Math.max(0.06, baseSpeed) * 1.06 ** step,
          ),
    items: Math.min(
      12,
      (activity === "Numbers"
        ? (settings.sequenceItems ?? 6)
        : (settings.searchItems ?? 6)) +
        (activity === "Moving" ? 0 : Math.floor(step)),
    ),
    load:
      activity === "Compare"
        ? 2
        : Math.min(memoryMaximum, recallBase + Math.floor(step)),
    exposure: Math.max(
      800,
      (settings.recallExposure ?? 1.8) *
        1000 *
        0.95 ** (activity === "Compare" ? step : Math.max(0, step - loadSteps)),
    ),
  };
}
