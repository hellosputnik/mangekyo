import { describe, expect, it } from "vitest";
import {
  balanceRules,
  createBalance,
  easeBalance,
  recordBalanceTap,
  recordBalanceWindow,
  resetBalanceWindow,
} from "./balance";

describe("adaptive game balancing", () => {
  it("starts comfortably, calibrates quickly on clear success, then slows the search", () => {
    const state = createBalance();
    for (const load of [4, 8, 12]) {
      recordBalanceWindow(state, 1, state.windows * 10000 + 10000);
      expect(state.load).toBe(load);
    }
    recordBalanceWindow(state, 1, 40000);
    expect(state).toMatchObject({ phase: "personalized", load: 12, step: 1 });
    recordBalanceWindow(state, 1, 50000);
    expect(state.load).toBe(13);
  });
  it("holds the challenge throughout the target band and does not require perfect performance", () => {
    const state = createBalance();
    state.load = 12;
    for (const performance of [0.8, 0.85, 0.9, 0.82, 0.88])
      recordBalanceWindow(state, performance, 10000);
    expect(state).toMatchObject({
      load: 12,
      phase: "personalized",
      step: 0.25,
    });
    expect(
      state.history.every((decision) => decision.fromLoad === decision.toLoad),
    ).toBe(true);
  });
  it("requires repeated evidence to raise a matched pace and does not oscillate after one lucky window", () => {
    const state = createBalance();
    state.load = 12;
    recordBalanceWindow(state, 0.85, 10000);
    recordBalanceWindow(state, 1, 20000);
    expect(state.load).toBe(12);
    recordBalanceWindow(state, 0.85, 30000);
    recordBalanceWindow(state, 1, 40000);
    expect(state.load).toBe(12);
    recordBalanceWindow(state, 1, 50000);
    expect(state.load).toBe(12.25);
  });
  it("eases sooner than it raises, halves steps on actual reversals, and avoids counting a held decision twice", () => {
    const state = createBalance();
    recordBalanceWindow(state, 1, 10000);
    recordBalanceWindow(state, 0.4, 20000);
    expect(state).toMatchObject({
      load: 3,
      direction: -1,
      reversals: 1,
      phase: "personalized",
    });
    const reversals = state.reversals;
    recordBalanceWindow(state, 1, 30000);
    expect(state.reversals).toBe(reversals);
    recordBalanceWindow(state, 1, 40000);
    expect(state.reversals).toBe(reversals + 1);
    expect(state.load).toBe(3.25);
  });
  it.each([8, 18, 30])(
    "settles near a simulated fixed capability of %i instead of climbing forever",
    (capacity) => {
      const state = createBalance();
      const recent: number[] = [];
      for (let window = 0; window < 160; window++) {
        const performance = 1 / (1 + Math.exp((state.load - capacity) / 2));
        recordBalanceWindow(state, performance, (window + 1) * 10000);
        if (window > 140) recent.push(state.load);
      }
      expect(state.lastPerformance).toBeGreaterThanOrEqual(0.78);
      expect(state.lastPerformance).toBeLessThanOrEqual(0.92);
      expect(Math.max(...recent) - Math.min(...recent)).toBeLessThan(1);
      expect(state.load).toBeLessThan(capacity);
    },
  );
  it("uses five measured tap outcomes, tolerates one error, and ignores incomplete windows", () => {
    const state = createBalance();
    state.load = 8;
    for (const correct of [true, true, false, true])
      recordBalanceTap(state, correct, 1000);
    expect(state.windows).toBe(0);
    recordBalanceTap(state, true, 2000);
    expect(state).toMatchObject({
      load: 8,
      lastPerformance: 0.8,
      windows: 1,
      samples: 0,
      successes: 0,
    });
    recordBalanceTap(state, false, 2500);
    resetBalanceWindow(state);
    expect(state.samples).toBe(0);
    expect(state.load).toBe(8);
  });
  it("retains completed evidence through interruptions, and supports deliberate easing", () => {
    const state = createBalance();
    state.load = 8;
    state.phase = "personalized";
    recordBalanceWindow(state, 1, 10000);
    resetBalanceWindow(state);
    recordBalanceWindow(state, 1, 20000);
    expect(state.load).toBe(9);
    easeBalance(state, 22000);
    expect(state).toMatchObject({
      load: 8,
      phase: "personalized",
      step: 0.25,
      strongWindows: 0,
    });
  });
  it("bounds load and history and rejects non-performance input", () => {
    const state = createBalance();
    const unchanged = structuredClone(state);
    for (const invalid of [NaN, Infinity, -1, 1.1])
      recordBalanceWindow(state, invalid, 0);
    expect(state).toEqual(unchanged);
    for (let window = 0; window < 1200; window++)
      recordBalanceWindow(state, 1, window);
    expect(state.load).toBe(balanceRules.maximumLoad);
    expect(state.history).toHaveLength(1000);
    for (let window = 0; window < 100; window++)
      recordBalanceWindow(state, 0, 2000 + window);
    expect(state.load).toBe(0);
  });
  it.each([8, 18, 30])(
    "stays usefully challenging with noisy five-tap windows at simulated capability %i",
    (capacity) => {
      const state = createBalance();
      let seed = 12345;
      let attempts = 0;
      let correct = 0;
      for (let attempt = 0; attempt < 12000; attempt++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const probability = 1 / (1 + Math.exp((state.load - capacity) / 2));
        const success = seed / 4294967296 < probability;
        recordBalanceTap(state, success, attempt * 200);
        if (attempt >= 10000) {
          attempts++;
          correct += Number(success);
        }
      }
      expect(correct / attempts).toBeGreaterThan(0.78);
      expect(correct / attempts).toBeLessThan(0.93);
      expect(state.load).toBeGreaterThan(0);
    },
  );
});
