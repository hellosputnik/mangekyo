import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocalizationContext } from "../i18n/react";
import { createLocalization, type Language } from "../i18n/locale";
import type { Session } from "../engine/model";
import { SessionControls } from "./SessionControls";

function controls(
  status: Session["status"],
  routine = false,
  language: Language = "en",
) {
  return renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization(language)}>
      <SessionControls
        status={status}
        routine={routine}
        onPause={() => {}}
        onResume={() => {}}
        onEnd={() => {}}
      />
    </LocalizationContext.Provider>,
  );
}

it.each([
  ["en", "Pause", "End session"],
  ["vi", "Tạm dừng", "Kết thúc"],
] as const)(
  "provides two neutral running controls in %s",
  (language, pauseLabel, endLabel) => {
    const html = controls("running", false, language);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain(pauseLabel);
    expect(html).toContain(endLabel);
    expect(html).not.toContain('class="primary"');
    expect(html).not.toContain("Finish &amp; save");
    expect(html).not.toContain("End early");
  },
);
it("emphasizes resuming only while paused", () => {
  const html = controls("paused");
  expect(html).toContain('class="primary"');
  expect(html).toContain("Resume practice");
  expect(html).toContain("End session");
});
it("requires explicit confirmation after an interruption", () => {
  const html = controls("interrupted");
  expect(html).toContain("Confirm &amp; resume");
  expect(html.match(/<button/g)).toHaveLength(2);
});
it("names the routine action Skip exercise without an additional finish action", () => {
  const html = controls("running", true);
  expect(html).toContain("Skip exercise");
  expect(html).not.toContain("End session");
  expect(html.match(/<button/g)).toHaveLength(2);
});
