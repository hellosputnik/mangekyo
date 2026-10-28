import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const stylesheet = readFileSync("src/style.css", "utf8");
const color = (name) =>
  stylesheet.match(new RegExp(`--${name}: (#[\\da-f]{6})`))[1];
function luminance(hex) {
  const linear = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
const contrast = (first, second) =>
  (Math.max(luminance(first), luminance(second)) + 0.05) /
  (Math.min(luminance(first), luminance(second)) + 0.05);
it("keeps essential input boundaries above 3:1 on each default control surface", () => {
  for (const background of ["background", "surface", "surface-raised"])
    expect(
      contrast(color("control-border"), color(background)),
    ).toBeGreaterThanOrEqual(3);
});
it("keeps normal interface and primary action text above 4.5:1", () => {
  for (const background of ["background", "surface", "surface-raised"])
    for (const text of ["text", "text-muted", "text-secondary"])
      expect(contrast(color(text), color(background))).toBeGreaterThanOrEqual(
        4.5,
      );
  expect(contrast(color("accent-ink"), color("accent"))).toBeGreaterThanOrEqual(
    4.5,
  );
});
