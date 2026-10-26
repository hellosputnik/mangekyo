import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocalizationContext } from "../../i18n/react";
import { createLocalization } from "../../i18n/locale";
import { EyeSelector } from "./EyeSelector";
import { DurationControl } from "./DurationControl";
import { Navigation } from "../Navigation";
import { PracticePresets } from "../PracticePresets";

it("offers a named native eye radio group with stable stored values", () => {
  const html = renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("vi")}>
      <EyeSelector
        label="Mắt luyện tập"
        name="eye"
        value="Right"
        onChange={() => {}}
      />
    </LocalizationContext.Provider>,
  );
  expect(html.match(/type="radio"/g)).toHaveLength(3);
  expect(html.match(/name="eye"/g)).toHaveLength(3);
  expect(html).toMatch(
    /<input(?=[^>]*value="Right")(?=[^>]*checked="")[^>]*\/>/,
  );
  expect(html).toContain("Theo góc nhìn của bạn");
  expect(html.match(/aria-hidden="true"/g)).toHaveLength(6);
});
it("exposes an accessible range with precise localized duration and an edit action", () => {
  const html = renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("vi")}>
      <DurationControl label="Thời lượng" value={155} onChange={() => {}} />
    </LocalizationContext.Provider>,
  );
  expect(html).toContain('type="range"');
  expect(html).toContain('min="10" max="900" step="1"');
  expect(html).toContain('aria-valuetext="2 phút 35 giây"');
  expect(html).toContain('aria-label="Sửa Thời lượng"');
  expect(html).not.toContain("<select");
});
it("makes long custom durations reachable on the range", () => {
  const html = renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("en")}>
      <DurationControl label="Duration" value={1800} onChange={() => {}} />
    </LocalizationContext.Provider>,
  );
  expect(html).toContain('max="1800"');
  expect(html).toContain('value="1800"');
});
it("names navigation destinations and marks the active page", () => {
  const html = renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("en")}>
      <Navigation current="Routines" onChange={() => {}} />
    </LocalizationContext.Provider>,
  );
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  expect(html).toContain("Routines");
  expect(html).toContain("Progress");
});
it.each([
  ["en", "Default (mixed)", "Custom"],
  ["vi", "Mặc định (kết hợp)", "Tùy chỉnh"],
] as const)(
  "names the default preset clearly in %s",
  (language, defaultLabel, customLabel) => {
    const html = renderToStaticMarkup(
      <LocalizationContext.Provider value={createLocalization(language)}>
        <PracticePresets
          kind="pursuit"
          value="Default"
          onChange={() => {}}
          onCustomize={() => {}}
          dialogId="custom-dialog"
        />
      </LocalizationContext.Provider>,
    );
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain(defaultLabel);
    expect(html).toContain(customLabel);
    expect(html).not.toContain("Mixed paths");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-controls="custom-dialog"');
  },
);
