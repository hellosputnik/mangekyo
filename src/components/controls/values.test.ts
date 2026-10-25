import { describe, expect, it } from "vitest";
import { parseDurationParts, parseWholeNumber } from "./values";

describe("exact duration entry", () => {
  it.each([1, 2, 3, 5, 10, 15, 60])("accepts %i minutes", (minutes) => {
    expect(parseDurationParts(String(minutes), "0")).toBe(minutes * 60);
  });
  it("preserves seconds and accepts the session boundaries", () => {
    expect(parseDurationParts("2", "35")).toBe(155);
    expect(parseDurationParts("0", "10")).toBe(10);
    expect(parseDurationParts("60", "0")).toBe(3600);
  });
  it.each([
    ["", "0"],
    ["5", ""],
    ["-1", "30"],
    ["1.5", "0"],
    ["1e2", "0"],
    ["0", "9"],
    ["0", "60"],
    ["60", "1"],
    ["61", "0"],
    ["Infinity", "0"],
    ["999999999999999999", "0"],
  ])("rejects invalid or out-of-range entry %s:%s", (minutes, seconds) => {
    expect(parseDurationParts(minutes, seconds)).toBeNull();
  });
  it("allows zero only when configuring a break", () => {
    expect(parseDurationParts("0", "0")).toBeNull();
    expect(parseDurationParts("0", "0", 0)).toBe(0);
  });
});
describe("schedule number entry", () => {
  it("supports blank drafts without turning them into zero or a default", () => {
    expect(parseWholeNumber("", 0, 60)).toBeNull();
    expect(parseWholeNumber("  ", 0, 60)).toBeNull();
    expect(parseWholeNumber(" 30 ", 1, 240)).toBe(30);
  });
  it("validates schedule limits instead of silently clamping", () => {
    expect(parseWholeNumber("0", 1, 240)).toBeNull();
    expect(parseWholeNumber("241", 1, 240)).toBeNull();
    expect(parseWholeNumber("240", 1, 240)).toBe(240);
    expect(parseWholeNumber("0", 0, 60)).toBe(0);
  });
});
