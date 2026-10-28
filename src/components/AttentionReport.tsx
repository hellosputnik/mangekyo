import type { Session } from "../engine/model";
import { summarizeAttention } from "../analytics/attention";
import { useI18n } from "../i18n/react";

export function AttentionReport({ session }: { session: Session }) {
  const { t, number, percent } = useI18n();
  const results = summarizeAttention(session);
  const range = (value: { minimum: number; maximum: number }, divisor = 1) =>
    value.minimum === value.maximum
      ? number(value.minimum / divisor, divisor === 1 ? 0 : 1)
      : `${number(value.minimum / divisor, divisor === 1 ? 0 : 1)}–${number(value.maximum / divisor, divisor === 1 ? 0 : 1)}`;
  return (
    <section className="attention-report">
      <h3>{t("attention.summary")}</h3>
      {results.map((result) => (
        <details key={result.task}>
          <summary>
            <span>{t(`attention.task.${result.task}`)}</span>
            <strong>{percent(result.correct / result.count)}</strong>
          </summary>
          <p>
            {t("attention.rounds", {
              correct: number(result.correct),
              total: number(result.count),
            })}
          </p>
          <dl className="recorded-conditions">
            <div>
              <dt>{t("statistics.medianResponse")}</dt>
              <dd>
                {number(result.responseMilliseconds / 1000, 1)}{" "}
                {t("tap.seconds")}
              </dd>
            </div>
            <div>
              <dt>{t("attention.replays")}</dt>
              <dd>{number(result.replays)}</dd>
            </div>
          </dl>
          <p className="fine">
            {t("attention.presentation", {
              items: range(result.items),
              load: range(result.load),
              exposure: range(result.exposure, 1000),
              tracking: range(result.tracking, 1000),
              delay: range(result.delay, 1000),
            })}
          </p>
        </details>
      ))}
      <p className="fine">{t("attention.performanceNote")}</p>
    </section>
  );
}
