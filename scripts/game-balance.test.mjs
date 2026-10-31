/** Actual-engine pacing study. Set MANGEKYO_BALANCE_REPORT=1 to regenerate the documented results. */
import { describe, expect, it, afterAll } from "vitest";
import { writeFileSync } from "node:fs";
import { initialData, isAttentionExercise } from "../src/engine/model";
import { practiceDefaults } from "../src/engine/practice";
import {
  initializeAdaptation,
  practiceChannel,
} from "../src/adaptive/practice";
import { bindPracticeProfiles } from "../src/adaptive/profiles";
import { activityRules } from "../src/adaptive/rules";
import { ActiveTimer } from "../src/engine/timer";
import { AttentionExercise, cueMilliseconds } from "../src/exercises/attention";
import { recordResponse } from "../src/exercises/responses";
import { visualTargetRadius } from "../src/exercises/visual";
import { alignmentGeometry } from "../src/exercises/alignment";
import { crowdingGeometry } from "../src/exercises/crowding";
import { mergeBackup } from "../src/persistence/backup";
const screen = { width: 390, height: 300, pixelRatio: 3 };
const report = [];
function randomGenerator(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function simulate(
  kind,
  seconds,
  seed,
  screenRatio = 3,
  capabilityDrop = false,
) {
  const viewport = { ...screen, pixelRatio: screenRatio };
  const random = randomGenerator(seed);
  const session = {
    id: `${kind}-${seed}`,
    kind,
    eye: "Left",
    configuration: { ...practiceDefaults(kind), duration: seconds },
    startedAt: "2026-10-29T12:00:00Z",
    status: "paused",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
  initializeAdaptation(session);
  session.adaptation.viewport = viewport;
  bindPracticeProfiles(session, []);
  let clock = 0;
  let halfwayChallenge = null;
  const meanChallenge = () =>
    Object.values(session.adaptation.channels).reduce(
      (sum, channel) => sum + channel.challenge,
      0,
    ) / Math.max(1, Object.keys(session.adaptation.channels).length);
  const capability = (value) =>
    capabilityDrop && session.activeMilliseconds >= seconds * 500
      ? value - 1.5
      : value;
  const timer = new ActiveTimer(
    session,
    () => clock,
    () => new Date(Date.parse(session.startedAt) + clock),
  );
  timer.resume();
  const advance = (milliseconds) => {
    clock += milliseconds;
    timer.checkpoint();
    if (
      halfwayChallenge === null &&
      session.activeMilliseconds >= seconds * 500
    )
      halfwayChallenge = meanChallenge();
    if (session.presentationQuality)
      session.presentationQuality.presented = true;
    return session.activeMilliseconds < seconds * 1000;
  };
  const engine = isAttentionExercise(kind)
    ? new AttentionExercise(session, random)
    : null;
  engine?.initialize();
  while (session.activeMilliseconds < seconds * 1000) {
    let load = 0,
      chance = 0.25,
      ability = 5,
      slope = 1.5;
    if (engine) {
      const round = session.attentionRound;
      const presentation = round.presentation;
      const wait =
        round.startedAtMilliseconds +
        cueMilliseconds(round) +
        presentation.exposureMilliseconds +
        presentation.trackingMilliseconds +
        presentation.delayMilliseconds -
        session.activeMilliseconds;
      if (!advance(Math.max(0, wait) + 800 + random() * 800)) break;
      const task = presentation.task;
      if (task === "Track") {
        load =
          presentation.itemCount -
          3 +
          Math.log(presentation.speed / session.configuration.speed) /
            Math.log(1.08);
        chance = 1 / presentation.itemCount;
        ability = 4.5;
      } else if (task === "Count" || task === "Match" || task === "Numbers") {
        load = presentation.itemCount - 6;
        chance =
          task === "Numbers"
            ? 0.01
            : task === "Match"
              ? 1 / presentation.itemCount
              : 0.25;
        ability = 4.5;
      } else if (task === "Moving") {
        load =
          Math.log(presentation.speed / session.configuration.speed) /
          Math.log(1.06);
        ability = 6;
      } else {
        load =
          task === "Compare"
            ? Math.log(presentation.exposureMilliseconds / 1800) /
              Math.log(0.95)
            : presentation.load -
              (task === "Digits" ? 2 : 1) +
              Math.log(
                presentation.exposureMilliseconds /
                  (task === "Directions" ? presentation.load : 1) /
                  1800,
              ) /
                Math.log(0.95);
        chance =
          task === "Compare"
            ? 0.5
            : task === "Directions"
              ? 0.25 ** presentation.load
              : 0.25;
        ability = 4.5;
      }
      const probability =
        chance +
        (0.98 - chance) / (1 + Math.exp((load - capability(ability)) / slope));
      const correct = random() < probability;
      if (!correct) {
        const wrong = round.choices.findIndex(
          (_value, index) => !round.answers.includes(index),
        );
        // Sequence rounds include all choices; any answer other than the next item is wrong.
        const choice =
          wrong >= 0 ? wrong : (round.answers[0] + 1) % round.choices.length;
        engine.choose(choice);
      } else {
        while (session.attentionRound === round) {
          const answer = round.answers[round.selected.length];
          if (!advance(180)) break;
          engine.choose(answer);
        }
      }
    } else {
      const responseMilliseconds = 900 + random() * 1000;
      if (!advance(responseMilliseconds)) break;
      if (kind === "visual") {
        load =
          Math.log(
            visualTargetRadius(
              session.configuration,
              session.difficulty,
              viewport,
            ) / visualTargetRadius(session.configuration, 0, viewport),
          ) / Math.log(0.94);
        ability = 8;
        slope = 2;
      }
      if (kind === "contrast") {
        load = session.difficulty;
        ability = 3;
        slope = 0.9;
      }
      if (kind === "crowding") {
        load =
          Math.log(
            crowdingGeometry(
              session.configuration,
              session.difficulty,
              viewport,
            ).gap / crowdingGeometry(session.configuration, 0, viewport).gap,
          ) / Math.log(0.9);
        ability = 5;
      }
      if (kind === "alignment") {
        load =
          (alignmentGeometry(session.configuration, 0, viewport).offset -
            alignmentGeometry(
              session.configuration,
              session.difficulty,
              viewport,
            ).offset) *
          viewport.pixelRatio;
        ability = 8;
        chance = 0.5;
      }
      const probability =
        chance +
        (0.98 - chance) / (1 + Math.exp((load - capability(ability)) / slope));
      recordResponse(
        session,
        random() < probability,
        responseMilliseconds,
        viewport,
      );
    }
  }
  timer.finish();
  engine?.terminate();
  const measured = session.trials.filter((trial) => !trial.adaptation?.check);
  const accuracy = (trials) =>
    trials.length
      ? trials.filter((trial) => trial.correct).length / trials.length
      : 0;
  return {
    session,
    trials: measured.length,
    first20: accuracy(measured.slice(0, 20)),
    last20: accuracy(measured.slice(-20)),
    adjustments: session.adaptation.decisions.length,
    halfwayChallenge,
    finalChallenge:
      Object.values(session.adaptation.channels).reduce(
        (sum, channel) => sum + (channel?.challenge ?? 0),
        0,
      ) / Object.keys(session.adaptation.channels).length,
  };
}
describe("actual exercise pacing over scheduled foreground time", () => {
  for (const kind of [
    "visual",
    "contrast",
    "crowding",
    "alignment",
    "tracking",
    "search",
    "memory",
    "sequence",
  ])
    for (const seconds of [60, 300, 900])
      it(`${kind}: ${seconds / 60}-minute sessions retain bounded, recoverable, independent evidence`, () => {
        const runs = Array.from({ length: 32 }, (_, index) =>
          simulate(kind, seconds, index + 1),
        );
        for (const { session } of runs) {
          expect(session.activeMilliseconds).toBe(seconds * 1000);
          expect(session.status).toBe("completed");
          for (const channel of Object.values(session.adaptation.channels))
            if (channel) {
              expect(channel.challenge).toBeGreaterThanOrEqual(0);
              expect(channel.challenge).toBeLessThanOrEqual(
                activityRules(session, channel.activity).maximum + 1e-9,
              );
            }
          const ids = session.adaptation.decisions.flatMap(
            (decision) => decision.trials,
          );
          expect(new Set(ids).size).toBe(ids.length);
          expect(() =>
            mergeBackup(initialData(), {
              ...initialData(),
              sessions: [session],
            }),
          ).not.toThrow();
        }
        const mean = (key) =>
          runs.reduce((sum, run) => sum + run[key], 0) / runs.length;
        report.push({
          kind,
          seconds,
          seeds: runs.length,
          meanTrials: mean("trials"),
          meanFirst20Accuracy: mean("first20"),
          meanLast20Accuracy: mean("last20"),
          meanAdjustments: mean("adjustments"),
          meanFinalChallenge: mean("finalChallenge"),
          perSeed: runs.map(({ session: _session, ...run }, index) => ({
            seed: index + 1,
            ...run,
          })),
        });
        if (seconds === 900) {
          expect(mean("last20")).toBeGreaterThan(0.75);
          expect(mean("last20")).toBeLessThan(0.95);
        }
      });
  it.each(["visual", "contrast", "tracking", "memory"])(
    "provides support when the modeled capability falls during %s",
    (kind) => {
      const runs = Array.from({ length: 8 }, (_, index) =>
        simulate(kind, 900, index + 1, 3, true),
      );
      const before =
        runs.reduce((sum, run) => sum + run.halfwayChallenge, 0) / runs.length;
      const after =
        runs.reduce((sum, run) => sum + run.finalChallenge, 0) / runs.length;
      expect(after).toBeLessThan(before);
      expect(
        runs.every((run) =>
          run.session.adaptation.decisions.some(
            (decision) => decision.reason === "support",
          ),
        ),
      ).toBe(true);
    },
  );
  it.each([1, 2, 3])(
    "does not reach the visual display floor in five minutes of perfect fast answers at DPR %i",
    (pixelRatio) => {
      const session = {
        id: "perfect",
        kind: "visual",
        eye: "Left",
        configuration: practiceDefaults("visual"),
        startedAt: new Date().toISOString(),
        status: "running",
        activeMilliseconds: 0,
        slices: [],
        trials: [],
        difficulty: 0,
      };
      initializeAdaptation(session);
      session.adaptation.viewport = { ...screen, pixelRatio };
      bindPracticeProfiles(session, []);
      for (let active = 500; active <= 300000; active += 500) {
        session.activeMilliseconds = active;
        session.presentationQuality.presented = true;
        recordResponse(session, true, 500, { ...screen, pixelRatio });
      }
      expect(
        visualTargetRadius(session.configuration, session.difficulty, {
          ...screen,
          pixelRatio,
        }),
      ).toBeGreaterThan(2 / pixelRatio);
      expect(practiceChannel(session, "visual").challenge).toBeGreaterThan(5);
    },
  );
});
afterAll(() => {
  if (process.env.MANGEKYO_BALANCE_REPORT === "1")
    writeFileSync(
      "docs/game-balance-results.json",
      JSON.stringify(
        {
          version: 1,
          assumptions: [
            "Synthetic stationary observers responding to actual presented settings",
            "32 deterministic seeds; one, five and fifteen minutes per exercise",
            "Actual cue, exposure, delay and multi-answer durations; response-time model is synthetic",
            "No simulation establishes learning or therapeutic benefit; physical iPhone playtesting remains necessary",
          ],
          scenarios: report.sort(
            (a, b) => a.kind.localeCompare(b.kind) || a.seconds - b.seconds,
          ),
        },
        null,
        2,
      ) + "\n",
    );
});
