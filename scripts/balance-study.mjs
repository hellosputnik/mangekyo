/**
 * Design workbench, not the controller shipped in the app.
 * Run: node scripts/balance-study.mjs
 * Save the reproducible result: node scripts/balance-study.mjs > docs/balance-study.json
 * See docs/balancing-policy.md for assumptions, sources and rollout requirements.
 */
import assert from "node:assert/strict";

const study = {
  version: 1,
  auditedApplicationRevision: "06b33aef78f3878d5feabd9c72081f2d168a0bae",
  seedCount: 32,
  windowsPerSeed: 2000,
  trialsPerWindow: 5,
  targetSuccess: 0.85,
  minimumLoad: 0,
  maximumLoad: 40,
  // Abstract simulation units; these are not proposed stimulus settings.
  calibrationGain: 6,
  calibrationWindows: 3,
  practiceGain: 1.5,
};

function binomialProbability(trials, successes, probability) {
  let combinations = 1;
  for (let index = 1; index <= successes; index++)
    combinations = (combinations * (trials - index + 1)) / index;
  return (
    combinations *
    probability ** successes *
    (1 - probability) ** (trials - successes)
  );
}

// This describes the audited contrast/crowding/alignment block rule, not every mode.
function historicalFiveAnswerChange(successes) {
  return successes >= 4 ? 1 : successes <= 2 ? -1 : 0;
}

function weightedChange(successes, gain = 1) {
  return gain * (successes / study.trialsPerWindow - study.targetSuccess);
}

function expectedChange(probability, change) {
  let total = 0;
  for (let successes = 0; successes <= study.trialsPerWindow; successes++)
    total +=
      binomialProbability(study.trialsPerWindow, successes, probability) *
      change(successes);
  return total;
}

function zeroDriftProbability(change) {
  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 80; iteration++) {
    const middle = (lower + upper) / 2;
    if (expectedChange(middle, change) > 0) upper = middle;
    else lower = middle;
  }
  return (lower + upper) / 2;
}

function randomGenerator(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function observerProbability(load, midpoint, chance = 0.25, ceiling = 0.98) {
  return chance + (ceiling - chance) / (1 + Math.exp((load - midpoint) / 2));
}

const scenarios = [
  { name: "lower working range", midpoint: () => 8 },
  { name: "middle working range", midpoint: () => 20 },
  { name: "higher working range", midpoint: () => 32 },
  { name: "two-choice task", midpoint: () => 20, chance: 0.5 },
  { name: "six-choice task", midpoint: () => 20, chance: 1 / 6 },
  { name: "occasional lapses", midpoint: () => 20, ceiling: 0.93 },
  {
    name: "capability falls halfway",
    midpoint: (window) => (window < 1000 ? 20 : 14),
  },
  {
    name: "capability rises halfway",
    midpoint: (window) => (window < 1000 ? 14 : 20),
  },
  { name: "random four-choice guesses", constantProbability: 0.25 },
  { name: "always correct: upper boundary", constantProbability: 1 },
  { name: "always incorrect: lower boundary", constantProbability: 0 },
];

function simulate(scenario) {
  let initialCorrect = 0;
  let finalCorrect = 0;
  let finalLoad = 0;
  let observedMinimum = study.maximumLoad;
  let observedMaximum = study.minimumLoad;
  for (let seed = 1; seed <= study.seedCount; seed++) {
    const random = randomGenerator(seed * 7919);
    let load = 0;
    let calibration = true;
    for (let window = 0; window < study.windowsPerSeed; window++) {
      const probability =
        scenario.constantProbability ??
        observerProbability(
          load,
          scenario.midpoint(window),
          scenario.chance,
          scenario.ceiling,
        );
      let successes = 0;
      for (let trial = 0; trial < study.trialsPerWindow; trial++)
        successes += Number(random() < probability);
      if (window < 6) initialCorrect += successes;
      if (window >= study.windowsPerSeed - 200) {
        finalCorrect += successes;
        finalLoad += load;
      }
      // One imperfect window or three complete probes ends the example's coarse phase.
      if (
        successes < study.trialsPerWindow ||
        window >= study.calibrationWindows
      )
        calibration = false;
      const gain = calibration ? study.calibrationGain : study.practiceGain;
      load = Math.min(
        study.maximumLoad,
        Math.max(study.minimumLoad, load + weightedChange(successes, gain)),
      );
      assert(Number.isFinite(load));
      observedMinimum = Math.min(observedMinimum, load);
      observedMaximum = Math.max(observedMaximum, load);
    }
  }
  const result = {
    name: scenario.name,
    first30TrialsSuccess: initialCorrect / (study.seedCount * 30),
    last1000TrialsSuccess: finalCorrect / (study.seedCount * 1000),
    last200WindowsMeanLoad: finalLoad / (study.seedCount * 200),
    minimumLoad: observedMinimum,
    maximumLoad: observedMaximum,
  };
  assert(result.minimumLoad >= study.minimumLoad);
  assert(result.maximumLoad <= study.maximumLoad);
  if (scenario.midpoint)
    assert(
      result.last1000TrialsSuccess > 0.83 &&
        result.last1000TrialsSuccess < 0.87,
      `Example controller failed to settle for ${scenario.name}`,
    );
  if (scenario.constantProbability === 0.25)
    assert(result.last200WindowsMeanLoad < 0.1, "Guessing accumulated load");
  if (scenario.constantProbability === 1)
    assert.equal(result.last200WindowsMeanLoad, study.maximumLoad);
  if (scenario.constantProbability === 0)
    assert.equal(result.last200WindowsMeanLoad, study.minimumLoad);
  return result;
}

const historicalBalancePoint = zeroDriftProbability(historicalFiveAnswerChange);
const weightedBalancePoint = zeroDriftProbability(weightedChange);
assert(Math.abs(historicalBalancePoint - 0.5943448344987126) < 1e-12);
assert(Math.abs(weightedBalancePoint - study.targetSuccess) < 1e-12);
for (const probability of [0.1, 0.25, 0.5, 0.8, 0.85, 0.9, 1])
  assert(
    Math.abs(
      expectedChange(probability, weightedChange) -
        (probability - study.targetSuccess),
    ) < 1e-12,
    "Expected drift did not match the weighted rule",
  );
for (let successes = 0; successes < study.trialsPerWindow; successes++)
  assert(weightedChange(successes) < 0);
assert(weightedChange(study.trialsPerWindow) > 0);

const report = {
  scope: "Mathematical design study; no change to shipped gameplay",
  configuration: study,
  assumptions: [
    "Binary first-attempt outcomes, independent given current difficulty",
    "Five trials at one setting in each window",
    "Monotonic synthetic observer curves, except the explicit constant observers",
    "No display quantization, response-time effects, input latency or variant pooling",
    "The early 30 trials are not a timed five-minute session",
    "Long-run checks use 10000 trials per seed, not evidence of human learning",
    "Neither the synthetic observer nor the 85% target is clinically validated",
  ],
  historicalFiveAnswerRule: {
    harderAtCorrect: [4, 5],
    holdAtCorrect: [3],
    easierAtCorrect: [0, 1, 2],
    zeroDriftSuccess: historicalBalancePoint,
    at80PercentSuccess: {
      probabilityOfHarder:
        binomialProbability(5, 4, 0.8) + binomialProbability(5, 5, 0.8),
      probabilityOfEasier: [0, 1, 2].reduce(
        (total, successes) => total + binomialProbability(5, successes, 0.8),
        0,
      ),
    },
  },
  symmetricStaircaseTargets: [3, 4, 5].map((consecutiveCorrect) => ({
    consecutiveCorrect,
    oneIncorrectMakesEasier: true,
    idealizedTargetSuccess: 2 ** (-1 / consecutiveCorrect),
  })),
  weightedBlockRule: {
    equation: "change = gain * (correct / 5 - 0.85)",
    zeroDriftSuccess: weightedBalancePoint,
    changesAtUnitGain: Array.from({ length: 6 }, (_, correct) => ({
      correct,
      change: weightedChange(correct),
    })),
  },
  scenarios: scenarios.map(simulate),
};

console.log(JSON.stringify(report, null, 2));
