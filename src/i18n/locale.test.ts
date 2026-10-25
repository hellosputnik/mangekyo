import { describe, it, expect } from "vitest";
import {
  createLocalization,
  resolveLanguage,
  readLanguageFromUrl,
  normalizeLanguagePreference,
} from "./locale";
import { english, type MessageKey } from "./en";
import { vietnamese } from "./vi";
describe("language selection", () => {
  it.each(["vi", "vi-VN", "VI-vn"])(
    "recognizes Vietnamese device locale %s",
    (tag) => {
      expect(resolveLanguage("system", [tag, "en-US"])).toBe("vi");
    },
  );
  it("uses the first supported browser preference", () => {
    expect(resolveLanguage("system", ["fr-FR", "vi-VN", "en-US"])).toBe("vi");
    expect(resolveLanguage("system", ["en-GB", "vi-VN"])).toBe("en");
  });
  it("falls back to English for unsupported or absent locales", () => {
    expect(resolveLanguage("system", ["ja-JP"])).toBe("en");
    expect(resolveLanguage("system", [])).toBe("en");
  });
  it("respects a saved selection over the browser language", () => {
    expect(resolveLanguage("en", ["vi-VN"])).toBe("en");
    expect(resolveLanguage("vi", ["en-US"])).toBe("vi");
  });
  it("accepts a Vietnamese deep link without treating other parameters as language", () => {
    expect(readLanguageFromUrl("?lang=vi")).toBe("vi");
    expect(readLanguageFromUrl("?lang=vi-VN&other=1")).toBe("vi");
    expect(readLanguageFromUrl("?lang=en")).toBe("en");
    expect(readLanguageFromUrl("?lang=fr")).toBeNull();
    expect(readLanguageFromUrl("")).toBeNull();
  });
  it("normalizes missing or invalid persisted choices", () => {
    expect(normalizeLanguagePreference(undefined)).toBe("system");
    expect(normalizeLanguagePreference("fr")).toBe("system");
    expect(normalizeLanguagePreference("vi")).toBe("vi");
  });
});
describe("Vietnamese interface content and formatting", () => {
  const localization = createLocalization("vi");
  it("has a nonempty translation for every English message with matching placeholders", () => {
    expect(Object.keys(vietnamese).sort()).toEqual(Object.keys(english).sort());
    for (const key of Object.keys(english) as MessageKey[]) {
      expect(vietnamese[key].trim(), key).not.toBe("");
      expect((vietnamese[key].match(/\{\w+\}/g) ?? []).sort(), key).toEqual(
        (english[key].match(/\{\w+\}/g) ?? []).sort(),
      );
    }
  });
  it("uses Vietnamese numbers and local calendar dates", () => {
    expect(localization.number(15.5, 1)).toBe("15,5");
    expect(
      localization.date("2026-10-25", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    ).toBe("25/10/2026");
    expect(localization.time(125000)).toBe("2:05");
  });
  it("translates stored identifiers only for display", () => {
    expect(localization.eyeLabel("Left")).toBe("Mắt trái");
    expect(localization.patternLabel("Figure eight")).toBe("Hình số tám");
    expect(localization.statusLabel("interrupted")).toBe("Bị gián đoạn");
    expect(localization.optionLabel("Grating")).toBe("Các vạch song song");
  });
  it("renders dynamic messages without leaking placeholders", () => {
    expect(
      localization.t("rest.next", {
        exercise: localization.exerciseName("pursuit"),
      }),
    ).toBe("Bài tiếp theo: Dõi theo mục tiêu");
    expect(
      localization.t("daily.remaining", {
        minutes: localization.number(15.5, 1),
      }),
    ).toBe("Còn 15,5 phút tới mục tiêu cá nhân");
  });
});
it("preserves a supported regional locale for date formatting", () => {
  const localization = createLocalization("en", ["en-GB"]);
  expect(localization.locale).toBe("en-GB");
  expect(
    localization.date("2026-10-25", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  ).toBe("25/10/2026");
  expect(createLocalization("vi", ["invalid", "vi-VN"]).locale).toBe("vi-VN");
});
