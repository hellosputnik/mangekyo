/** Game balancing preferences, not clinical thresholds or an estimate of visual ability. */
export const balanceRules = {
  lower: 0.8,
  upper: 0.9,
  obviousSuccess: 0.95,
  minimumStep: 0.25,
  initialStep: 4,
  maximumLoad: 40,
  tapWindow: 5,
  followWindowMilliseconds: 10000,
} as const;

export interface BalanceDecision {
  activeMilliseconds: number;
  performance: number | null;
  fromLoad: number;
  toLoad: number;
}
export interface AdaptiveBalance {
  version: 1;
  load: number;
  step: number;
  phase: "calibrating" | "personalized";
  direction: -1 | 0 | 1;
  reversals: number;
  windows: number;
  strongWindows: number;
  lastPerformance: number | null;
  samples: number;
  successes: number;
  history: BalanceDecision[];
}

export function createBalance(): AdaptiveBalance {
  return {
    version: 1,
    load: 0,
    step: balanceRules.initialStep,
    phase: "calibrating",
    direction: 0,
    reversals: 0,
    windows: 0,
    strongWindows: 0,
    lastPerformance: null,
    samples: 0,
    successes: 0,
    history: [],
  };
}

export function resetBalanceWindow(balance: AdaptiveBalance) {
  balance.samples = 0;
  balance.successes = 0;
}

function changeLoad(
  balance: AdaptiveBalance,
  amount: number,
  activeMilliseconds: number,
) {
  const fromLoad = balance.load;
  balance.load = Math.max(
    0,
    Math.min(balanceRules.maximumLoad, fromLoad + amount),
  );
  const decision = {
    activeMilliseconds,
    performance: balance.lastPerformance,
    fromLoad,
    toLoad: balance.load,
  };
  balance.history.push(decision);
  if (balance.history.length > 1000) balance.history.shift();
  return Math.sign(balance.load - fromLoad) as -1 | 0 | 1;
}

/** Coarse search, then a dead band and small steps. Never advance because time passed away. */
export function recordBalanceWindow(
  balance: AdaptiveBalance,
  performance: number,
  activeMilliseconds: number,
): -1 | 0 | 1 {
  if (!Number.isFinite(performance) || performance < 0 || performance > 1)
    return 0;
  balance.lastPerformance = performance;
  balance.windows++;
  let direction: -1 | 0 | 1 =
    performance < balanceRules.lower
      ? -1
      : performance > balanceRules.upper
        ? 1
        : 0;
  if (direction === 0) {
    balance.phase = "personalized";
    balance.step = balanceRules.minimumStep;
    balance.strongWindows = 0;
    return changeLoad(balance, 0, activeMilliseconds);
  }
  if (balance.phase === "calibrating") {
    // A merely good result is not enough evidence for a large jump.
    if (
      direction < 0 ||
      performance < balanceRules.obviousSuccess ||
      balance.windows > 3
    ) {
      balance.phase = "personalized";
      balance.step = Math.min(1, balance.step);
    }
  }
  if (balance.phase === "personalized")
    balance.step = Math.min(1, balance.step);
  if (balance.phase === "personalized" && direction > 0) {
    balance.strongWindows++;
    if (balance.strongWindows < 2) direction = 0;
  } else balance.strongWindows = 0;
  if (direction === 0) return changeLoad(balance, 0, activeMilliseconds);
  if (balance.direction && balance.direction !== direction) {
    balance.reversals++;
    balance.step = Math.max(balanceRules.minimumStep, balance.step / 2);
    balance.phase = "personalized";
  }
  balance.strongWindows = 0;
  balance.direction = direction;
  const amount =
    direction < 0
      ? -Math.max(balance.step, performance < 0.6 ? 1 : 0.5)
      : balance.step;
  return changeLoad(balance, amount, activeMilliseconds);
}

export function recordBalanceTap(
  balance: AdaptiveBalance,
  success: boolean,
  activeMilliseconds: number,
) {
  balance.samples++;
  balance.successes += Number(success);
  if (balance.samples < balanceRules.tapWindow) return 0;
  const performance = balance.successes / balance.samples;
  balance.samples = 0;
  balance.successes = 0;
  return recordBalanceWindow(balance, performance, activeMilliseconds);
}

export function easeBalance(
  balance: AdaptiveBalance,
  activeMilliseconds: number,
) {
  balance.phase = "personalized";
  balance.step = balanceRules.minimumStep;
  balance.direction = -1;
  balance.strongWindows = 0;
  resetBalanceWindow(balance);
  return changeLoad(balance, -1, activeMilliseconds);
}
