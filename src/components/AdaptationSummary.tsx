import type { Session } from "../engine/model";
import { adaptationSummary, channelConfidence } from "../analytics/adaptation";
import { useI18n } from "../i18n/react";

export function AdaptationSummary({
  session,
  compact = false,
}: {
  session: Session;
  compact?: boolean;
}) {
  const { t, number, percent } = useI18n();
  if (!session.adaptation && !session.presentationQuality) return null;
  const summary = adaptationSummary(session);
  const achievement = summary.achievement;
  return (
    <section className="adaptation-summary" aria-label={t("balance.summary")}>
      {achievement && (
        <p className="recap-achievement">
          {t(
            session.kind === "follow"
              ? "balance.achievement.follow"
              : `balance.achievement.${achievement.measure}`,
            {
              change: percent(achievement.relativeChange),
              value: number(
                achievement.to,
                achievement.measure === "items" ||
                  achievement.measure === "load"
                  ? 0
                  : 1,
              ),
              accuracy: percent(achievement.accuracy),
              count: number(achievement.sampleCount),
              seconds: number(achievement.sampleCount * 10),
            },
          )}
        </p>
      )}
      {summary.excluded > 0 && (
        <p className="fine">
          {t(compact ? "balance.excludedShort" : "balance.excludedNote", {
            count: number(summary.excluded),
          })}
        </p>
      )}
      {!compact &&
        summary.channels.map((channel) => (
          <div className="balance-evidence" key={channel.key}>
            <strong>
              {t(`balance.confidence.${channelConfidence(channel)}`)}
            </strong>
            <span>
              {t(
                channel.activity === "follow"
                  ? "balance.windowEvidence"
                  : "balance.responseEvidence",
                { count: number(channel.samples) },
              )}
            </span>
          </div>
        ))}
      {!compact && summary.checks > 0 && (
        <p className="fine">
          {t("balance.checkNote", { count: number(summary.checks) })}
        </p>
      )}
    </section>
  );
}
