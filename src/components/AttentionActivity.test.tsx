import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { defaults, type Session } from "../engine/model";
import { AttentionExercise } from "../exercises/attention";
import {
  AttentionAnswers,
  AttentionStatus,
  AttentionTargets,
} from "./AttentionActivity";
import { AttentionReport } from "./AttentionReport";
import { AttentionSettings } from "./AttentionSettings";
import { createLocalization } from "../i18n/locale";
import { LocalizationContext } from "../i18n/react";

function setup(): Session {
  return {
    id: "ui-attention",
    kind: "memory",
    eye: "Left",
    configuration: { ...defaults, recallTask: "Digits" },
    startedAt: "2026-10-28T12:00:00Z",
    status: "running",
    activeMilliseconds: 0,
    slices: [],
    trials: [],
    difficulty: 0,
  };
}
it("does not expose original tracking identities as visible answer numbers", () => {
  const session = setup();
  session.kind = "tracking";
  const exercise = new AttentionExercise(session);
  exercise.initialize();
  session.activeMilliseconds = 6000;
  const html = renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("en")}>
      <AttentionTargets session={session} onChoose={() => {}} />
    </LocalizationContext.Provider>,
  );
  expect(html.match(/<button/g)).toHaveLength(3);
  expect(html).toContain('aria-label="Select target 1"');
  expect(html).not.toMatch(/>[123]<\/span>/);
  expect(html.match(/<span aria-hidden="true"><\/span>/g)).toHaveLength(3);
});
it.each(["en", "vi"] as const)(
  "keeps %s answer choices hidden until recall, then exposes accessible choices",
  (language) => {
    const session = setup();
    const exercise = new AttentionExercise(session, () => 0.123);
    exercise.initialize();
    const render = () =>
      renderToStaticMarkup(
        <LocalizationContext.Provider value={createLocalization(language)}>
          <AttentionAnswers
            session={session}
            onChoose={() => {}}
            onReplay={() => {}}
          />
        </LocalizationContext.Provider>,
      );
    const before = render();
    expect(before).toContain("disabled");
    expect(before).not.toContain(`>${session.attentionRound!.items[0]}<`);
    session.activeMilliseconds = 5000;
    const after = render();
    expect(after).toContain(`>${session.attentionRound!.items[0]}<`);
    expect(after).not.toContain("disabled");
    expect(after).not.toContain("attention.question.");
    if (language === "vi") {
      expect(after).toContain("Bạn vừa thấy số nào?");
      expect(after).toContain("Xem lại lượt");
    }
  },
);
it("provides real, labelled buttons for spatial selection and disables them while paused", () => {
  const session = setup();
  session.kind = "sequence";
  const exercise = new AttentionExercise(session);
  exercise.initialize();
  session.activeMilliseconds = 2000;
  const render = () =>
    renderToStaticMarkup(
      <LocalizationContext.Provider value={createLocalization("vi")}>
        <AttentionTargets session={session} onChoose={() => {}} />
      </LocalizationContext.Provider>,
    );
  const active = render();
  expect(active.match(/<button/g)).toHaveLength(6);
  expect(active).toContain('aria-label="Chọn mục tiêu 1"');
  expect(active).not.toContain("disabled");
  session.status = "paused";
  expect(render().match(/disabled/g)).toHaveLength(6);
});
it("localizes activity settings, level progress, sound and recorded variant reports", () => {
  const session = setup();
  const exercise = new AttentionExercise(session);
  exercise.initialize();
  session.activeMilliseconds = 6000;
  exercise.choose(session.attentionRound!.answers[0]);
  const html = renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("vi")}>
      <AttentionSettings
        kind="memory"
        configuration={session.configuration}
        setting={() => {}}
      />
      <AttentionStatus session={session} sound onSound={() => {}} />
      <AttentionReport session={session} />
    </LocalizationContext.Provider>,
  );
  expect(html).toContain("Nhớ con số");
  expect(html).toContain('value="Digits"');
  expect(html).toContain("Cấp 1");
  expect(html).toContain("lượt đúng để lên cấp");
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain("Kết quả theo dạng bài");
  expect(html).toContain("100%");
  expect(html).not.toContain("Remember numbers");
  expect(session.trials[0].attention?.task).toBe("Digits");
});
