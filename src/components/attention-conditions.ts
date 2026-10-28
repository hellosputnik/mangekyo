import type { Session } from "../engine/model";
import type { createLocalization } from "../i18n/locale";
type Localization = ReturnType<typeof createLocalization>;

export function attentionConditionRows(
  session: Session,
  t: Localization["t"],
  number: Localization["number"],
): string[][] {
  const settings = session.configuration;
  if (session.kind === "tracking")
    return [
      [t("attention.trackingObjects"), number(settings.trackingObjects ?? 3)],
      [
        t("attention.trackingSeconds"),
        number(settings.trackingSeconds ?? 4, 1),
      ],
      [t("config.speed"), number(settings.speed, 2)],
    ];
  if (session.kind === "search")
    return [
      [
        t("attention.variant"),
        settings.searchTask && settings.searchTask !== "Mixed"
          ? t(`attention.task.${settings.searchTask}`)
          : t("attention.variety"),
      ],
      [t("attention.searchItems"), number(settings.searchItems ?? 6)],
      [t("config.speed"), number(settings.speed, 2)],
    ];
  if (session.kind === "memory")
    return [
      [
        t("attention.variant"),
        settings.recallTask && settings.recallTask !== "Mixed"
          ? t(`attention.task.${settings.recallTask}`)
          : t("attention.variety"),
      ],
      [t("attention.recallItems"), number(settings.recallItems ?? 1)],
      [
        t("attention.recallExposure"),
        number(settings.recallExposure ?? 1.8, 1),
      ],
      [t("attention.recallDelay"), number(settings.recallDelay ?? 0.6, 1)],
    ];
  return session.kind === "sequence"
    ? [[t("attention.sequenceItems"), number(settings.sequenceItems ?? 6)]]
    : [];
}
