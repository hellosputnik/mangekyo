import { useI18n } from "../i18n/react";

export interface AnswerResult {
  choice: number;
  correct: boolean;
  sequence: number;
  currentRun: number;
  enlarged: boolean;
  highlight: boolean;
}

export function AnswerFeedback({ result }: { result: AnswerResult }) {
  const { t, number } = useI18n();
  return (
    <span
      key={result.sequence}
      className={result.correct ? "answer-affirmation" : undefined}
    >
      {result.correct && (
        <span className="answer-check" aria-hidden="true">
          ✓
        </span>
      )}
      {result.correct
        ? result.currentRun > 0 && result.currentRun % 5 === 0
          ? t("feedback.run", { count: number(result.currentRun) })
          : t("feedback.point")
        : t(result.enlarged ? "feedback.larger" : "feedback.next")}
    </span>
  );
}
