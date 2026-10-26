import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AnswerFeedback, type AnswerResult } from "./AnswerFeedback";
import { createLocalization, type Language } from "../i18n/locale";
import { LocalizationContext } from "../i18n/react";

const result: AnswerResult = {
  choice: 0,
  correct: true,
  sequence: 1,
  currentRun: 1,
  enlarged: false,
  highlight: true,
};
function render(answer: AnswerResult, language: Language = "en") {
  return renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization(language)}>
      <AnswerFeedback result={answer} />
    </LocalizationContext.Provider>,
  );
}
it("affirms a correct answer with a point and celebrates correct-run milestones in both languages", () => {
  expect(render(result)).toContain("Correct · +1");
  expect(render({ ...result, currentRun: 5 })).toContain("5 in a row · +1");
  expect(render(result, "vi")).toContain("Đúng rồi · +1");
  expect(render({ ...result, currentRun: 5 }, "vi")).toContain(
    "Đúng 5 câu liên tiếp · +1",
  );
});
it("explains an enlarged target without awarding points for an incorrect response", () => {
  const html = render({
    ...result,
    correct: false,
    enlarged: true,
    currentRun: 0,
  });
  expect(html).toContain("Larger target. Try again");
  expect(html).not.toContain("+1");
  expect(render({ ...result, correct: false, enlarged: false })).toContain(
    "Try the next one",
  );
});
it("invites retrying a missed tap on the retained target", () => {
  expect(render({ ...result, correct: false, retry: true })).toContain(
    "the target stays here",
  );
  expect(render({ ...result, correct: false, retry: true }, "vi")).toContain(
    "mục tiêu vẫn ở đây",
  );
});
