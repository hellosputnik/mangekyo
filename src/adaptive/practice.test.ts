import { describe, it, expect } from "vitest";
import {
  defaults,
  initialData,
  type Session,
  type Data,
} from "../engine/model";
import {
  initializeAdaptation,
  practiceChannel,
  prepareAdaptivePresentation,
  recordAdaptiveTrial,
  recordFollowingWindow,
} from "./practice";
import {
  bindPracticeProfiles,
  rememberPracticeProfiles,
  practiceProfileKey,
} from "./profiles";
import {
  completePresentation,
  flagPresentation,
  recordFrameGap,
} from "./quality";
import { recordResponse } from "../exercises/responses";
import { mergeBackup, previewBackup } from "../persistence/backup";
import {
  resetStatistics,
  undoStatisticsReset,
} from "../engine/statistics-reset";
import { configureCheckIn } from "../engine/check-in";
import {
  responseInterval,
  channelConfidence,
  practiceAchievement,
} from "../analytics/adaptation";
import { adaptiveAttentionSettings, activityRules } from "./rules";
import { AttentionExercise, cueMilliseconds } from "../exercises/attention";

const screen = { width: 390, height: 300, pixelRatio: 3 };
function practice(
  kind: Session["kind"] = "visual",
  eye: Session["eye"] = "Left",
  profiles: Data["practiceProfiles"] = [],
): Session {
  const session: Session = {
    id: "session",
    kind,
    eye,
    configuration: { ...defaults },
    startedAt: "2026-10-29T12:00:00Z",
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
  initializeAdaptation(session);
  if (session.adaptation) session.adaptation.viewport = screen;
  bindPracticeProfiles(session, profiles);
  return session;
}
function respond(session: Session, correct = true, milliseconds = 1600) {
  session.activeMilliseconds += milliseconds;
  if (session.presentationQuality) session.presentationQuality.presented = true;
  return recordResponse(session, correct, milliseconds, screen);
}
function snapshot(session: Session): Data {
  session.slices = [
    {
      date: "2026-10-29",
      timezone: "UTC",
      offset: 0,
      milliseconds: session.activeMilliseconds,
    },
  ];
  return { ...initialData(), sessions: [session] };
}

describe("individual evidence and weighted practice", () => {
  it("starts short Mixed sessions with a less-practiced activity instead of repeatedly favoring the first one", () => {
    const first = practice("memory");
    const exercise = new AttentionExercise(first, () => 0.1);
    exercise.initialize();
    for (let index = 0; index < 5; index++) {
      const round = first.attentionRound!;
      first.activeMilliseconds =
        round.startedAtMilliseconds +
        cueMilliseconds(round) +
        round.presentation.exposureMilliseconds +
        round.presentation.delayMilliseconds +
        1000;
      first.presentationQuality!.presented = true;
      for (const answer of round.answers) exercise.choose(answer);
    }
    const data = initialData();
    rememberPracticeProfiles(data, first);
    const next = practice("memory", "Left", data.practiceProfiles);
    const second = new AttentionExercise(next, () => 0.1);
    second.initialize();
    expect(next.attentionRound!.presentation.task).toBe("Digits");
    expect(practiceChannel(next, "Locations")!.samples).toBe(5);
  });
  it("requires five successful responses, consumes each once and paces visual changes in active time", () => {
    const session = practice();
    for (let index = 0; index < 4; index++) respond(session);
    expect(session.difficulty).toBe(0);
    respond(session);
    expect(session.difficulty).toBeCloseTo(1);
    const decisions = session.adaptation!.decisions;
    expect(decisions[0].trials).toEqual([1, 2, 3, 4, 5]);
    recordAdaptiveTrial(session);
    expect(decisions).toHaveLength(1);
    expect(
      session.trials.every(
        (trial) =>
          trial.stimulusDiameter === session.trials[0].stimulusDiameter,
      ),
    ).toBe(true);
    for (let index = 0; index < 20; index++) respond(session, true, 100);
    expect(session.difficulty).toBeLessThan(2);
  });
  it("gives small support for one mistake without erasing correct outcomes, and stronger support for repeated mistakes", () => {
    const session = practice("contrast");
    const channel = practiceChannel(session, "contrast")!;
    channel.challenge = 5;
    channel.phase = "working";
    prepareAdaptivePresentation(session, "contrast");
    for (const correct of [true, true, false, true, true])
      respond(session, correct);
    expect(channel.challenge).toBeGreaterThan(4.8);
    expect(channel.challenge).toBeLessThan(5);
    const previous = channel.challenge;
    for (let index = 0; index < 5; index++) respond(session, false);
    expect(previous - channel.challenge).toBeGreaterThan(0.4);
    expect(session.trials.filter((trial) => trial.correct)).toHaveLength(4);
  });
  it("separates eye, activity, input, physical settings and screen, while ignoring scheduling and language", () => {
    const session = practice("memory");
    const key = practiceProfileKey(session, "Digits");
    expect(key.length).toBeLessThan(100);
    const reordered = {
      ...session,
      configuration: Object.fromEntries(
        Object.entries(session.configuration).reverse(),
      ) as unknown as Session["configuration"],
    };
    expect(practiceProfileKey(reordered, "Digits")).toBe(key);
    session.configuration.duration = 900;
    expect(practiceProfileKey(session, "Digits")).toBe(key);
    expect(practiceProfileKey(session, "Locations")).not.toBe(key);
    session.eye = "Right";
    expect(practiceProfileKey(session, "Digits")).not.toBe(key);
    session.eye = "Left";
    session.inputMethod = "keyboard";
    expect(practiceProfileKey(session, "Digits")).not.toBe(key);
    session.inputMethod = "pointer";
    session.configuration.recallExposure = 3;
    expect(practiceProfileKey(session, "Digits")).not.toBe(key);
    session.configuration.recallExposure = defaults.recallExposure;
    session.adaptation!.viewport = { ...screen, width: 812 };
    expect(practiceProfileKey(session, "Digits")).not.toBe(key);
  });
  it("restores only matching profiles, warms up and rechecks stale evidence without resetting accomplishments", () => {
    const data = initialData();
    const original = practice("contrast");
    for (let index = 0; index < 15; index++) respond(original);
    rememberPracticeProfiles(data, original);
    const matching = practice("contrast", "Left", data.practiceProfiles);
    bindPracticeProfiles(matching, data.practiceProfiles);
    expect(practiceChannel(matching, "contrast")!.challenge).toBeGreaterThan(0);
    expect(practiceChannel(matching, "contrast")!.phase).toBe("rechecking");
    const otherEye = practice("contrast", "Right");
    bindPracticeProfiles(otherEye, data.practiceProfiles);
    expect(practiceChannel(otherEye, "contrast")!.challenge).toBe(0);
    const saved = data.practiceProfiles![0];
    const stale = practice("contrast");
    // Explicitly rebinding an otherwise identical freshly constructed channel.
    stale.adaptation!.channels.contrast!.key = "";
    bindPracticeProfiles(
      stale,
      data.practiceProfiles,
      new Date(Date.parse(saved.updatedAt) + 15 * 86400000),
    );
    expect(channelConfidence(practiceChannel(stale, "contrast")!)).toBe(
      "rechecking",
    );
    expect(practiceChannel(stale, "contrast")!.recent).toHaveLength(0);
    for (let index = 0; index < 5; index++) respond(stale);
    expect(practiceChannel(stale, "contrast")!.phase).toBe("working");
  });
  it("excludes comfortable checks from progression and briefly holds increases after a missed check", () => {
    const session = practice("contrast");
    const channel = practiceChannel(session, "contrast")!;
    channel.challenge = 4;
    channel.phase = "working";
    channel.sinceCheck = 25;
    prepareAdaptivePresentation(session, "contrast");
    expect(session.difficulty).toBe(2);
    respond(session, false);
    expect(session.trials[0].adaptation!.check).toBe(true);
    expect(channel.challenge).toBe(4);
    expect(channel.holdIncreases).toBe(2);
    for (let index = 0; index < 10; index++) respond(session);
    expect(channel.challenge).toBe(4);
    expect(session.adaptation!.decisions[0].reason).toBe("lapse");
  });
  it("records browser problems separately and does not use disrupted responses for adaptation", () => {
    const session = practice("contrast");
    for (let index = 0; index < 4; index++) respond(session);
    recordFrameGap(session, 600);
    respond(session, false);
    expect(session.trials.at(-1)!.quality!.reasons).toEqual(["frame-stall"]);
    expect(practiceChannel(session, "contrast")!.samples).toBe(4);
    expect(session.difficulty).toBe(0);
    expect(session.adaptation!.decisions.at(-1)!.reason).toBe("quality");
    expect(practiceChannel(session, "contrast")!.pending).toHaveLength(0);
  });
  it("does not treat unpresented responses as learning evidence", () => {
    const session = practice("contrast");
    session.trials.push({
      correct: true,
      responseMilliseconds: 0,
      difficulty: 0,
      ...completePresentation(session),
    });
    recordAdaptiveTrial(session);
    expect(practiceChannel(session, "contrast")!.samples).toBe(0);
    expect(session.trials[0].quality!.reasons).toContain("not-presented");
  });
  it("keeps fixed check-ins fixed and passive exercises unscored", () => {
    const session = practice("contrast");
    delete session.adaptation;
    configureCheckIn(session);
    initializeAdaptation(session);
    for (let index = 0; index < 12; index++) respond(session);
    expect(session.adaptation).toBeUndefined();
    expect(session.difficulty).toBe(0);
    expect(practice("pursuit").adaptation).toBeUndefined();
    expect(practice("saccades").adaptation).toBeUndefined();
  });
  it("uses time-weighted follow windows without inventing a binary confidence interval", () => {
    const session = practice("follow");
    session.activeMilliseconds = 10000;
    recordFollowingWindow(session, 1, { speed: 0.04 });
    const channel = practiceChannel(session, "follow")!;
    expect(channel.challenge).toBe(2);
    expect(responseInterval(channel)).toBeNull();
    expect(session.adaptation!.decisions[0].trials).toEqual([]);
    flagPresentation(session, "interruption");
    session.activeMilliseconds = 20000;
    recordFollowingWindow(session, 0, { speed: 0.04 });
    expect(channel.challenge).toBe(2);
    expect(channel.samples).toBe(1);
  });
  it("keeps sparse evidence uncertain and reports response uncertainty rather than visual ability", () => {
    const session = practice("contrast");
    for (let index = 0; index < 5; index++) respond(session);
    const channel = practiceChannel(session, "contrast")!;
    expect(channelConfidence(channel)).toBe("gathering");
    expect(responseInterval(channel)!.lower).toBeLessThan(0.6);
    for (let index = 0; index < 25; index++) respond(session, index % 5 !== 0);
    channel.reversals = 2;
    expect(channelConfidence(channel)).toBe("established");
    expect(responseInterval(channel)!.count).toBeLessThanOrEqual(30);
  });
  it("separates object-count and speed steps, and memory-load and exposure steps", () => {
    for (let step = 0; step < 3; step++) {
      const before = adaptiveAttentionSettings(defaults, "Track", step),
        after = adaptiveAttentionSettings(defaults, "Track", step + 1);
      expect(after.objects).toBe(before.objects + 1);
      expect(after.speed).toBe(before.speed);
    }
    expect(adaptiveAttentionSettings(defaults, "Track", 4).objects).toBe(6);
    expect(
      adaptiveAttentionSettings(defaults, "Track", 4).speed,
    ).toBeGreaterThan(defaults.speed);
    const a = adaptiveAttentionSettings(defaults, "Locations", 0),
      b = adaptiveAttentionSettings(defaults, "Locations", 1);
    expect(b.load).toBe(a.load + 1);
    expect(b.exposure).toBe(a.exposure);
    expect(
      adaptiveAttentionSettings(defaults, "Locations", 4).exposure,
    ).toBeLessThan(b.exposure);
    expect(
      adaptiveAttentionSettings(defaults, "Track", 100).speed,
    ).toBeLessThanOrEqual(0.27);
  });
  it("clamps physical limits and preserves valid JSON at every boundary", () => {
    const session = practice("contrast");
    const channel = practiceChannel(session, "contrast")!;
    channel.challenge = activityRules(session, "contrast").maximum;
    prepareAdaptivePresentation(session, "contrast");
    for (let index = 0; index < 5; index++) respond(session);
    expect(session.adaptation!.decisions.at(-1)!.reason).toBe("ceiling");
    expect(() => mergeBackup(initialData(), snapshot(session))).not.toThrow();
  });
  it("round-trips profiles and evidence, merges safely, and resets/restores them with Undo", () => {
    const session = practice("contrast");
    for (let index = 0; index < 10; index++) respond(session);
    const data = snapshot(session);
    rememberPracticeProfiles(data, session);
    const imported = mergeBackup(
      initialData(),
      JSON.parse(JSON.stringify(data)),
    );
    expect(imported.practiceProfiles).toEqual(data.practiceProfiles);
    expect(imported.sessions[0].adaptation).toEqual(session.adaptation);
    expect(previewBackup(initialData(), data).adaptiveProfiles).toBe(1);
    const cleared = resetStatistics(imported, {
      difficulty: true,
      measurements: false,
    });
    expect(cleared.practiceProfiles).toEqual([]);
    expect(undoStatisticsReset(cleared).practiceProfiles).toEqual(
      imported.practiceProfiles,
    );
    const latest = structuredClone(imported);
    latest.practiceProfiles![0].channel.challenge = 1;
    expect(
      mergeBackup(latest, data).practiceProfiles![0].channel.challenge,
    ).toBe(1);
  });
  it.each(["pending", "profile", "quality", "decision"])(
    "rejects malformed %s evidence in backups",
    (field) => {
      const session = practice("contrast");
      for (let index = 0; index < 5; index++) respond(session);
      const data = snapshot(session);
      rememberPracticeProfiles(data, session);
      if (field === "pending")
        practiceChannel(session, "contrast")!.pending = Array(7).fill({
          trial: 1,
          success: 1,
          responseMilliseconds: 1,
          activeMilliseconds: 1,
          challenge: 1,
        });
      if (field === "profile")
        data.practiceProfiles![0].channel.challenge = Infinity;
      if (field === "quality")
        session.presentationQuality!.pending.push("unknown" as "frame-stall");
      if (field === "decision") session.adaptation!.decisions[0].trials = [999];
      expect(() => mergeBackup(initialData(), data)).toThrow();
    },
  );
  it("only describes accomplishments supported by repeated comparable presented trials", () => {
    const session = practice();
    for (let index = 0; index < 15; index++) respond(session);
    expect(practiceAchievement(session)?.measure).toBe("diameter");
    for (const trial of session.trials.slice(-5))
      trial.quality = { reasons: ["frame-stall"] };
    expect(practiceAchievement(session)!.relativeChange).toBeCloseTo(0.06);
    for (const trial of session.trials.slice(-10))
      trial.quality = { reasons: ["frame-stall"] };
    expect(practiceAchievement(session)).toBeNull();
  });
});
