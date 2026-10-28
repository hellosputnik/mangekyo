import type { Configuration, ExerciseKind } from "../engine/model";
import { useI18n } from "../i18n/react";
import type { MessageKey } from "../i18n/locale";

export function AttentionSettings({
  kind,
  configuration,
  setting,
}: {
  kind: ExerciseKind;
  configuration: Configuration;
  setting: (key: keyof Configuration, value: string | number | boolean) => void;
}) {
  const { t, number } = useI18n();
  const fields: [
    keyof Configuration,
    MessageKey,
    number,
    number,
    number,
    number,
  ][] =
    kind === "tracking"
      ? [
          ["trackingObjects", "attention.trackingObjects", 3, 6, 1, 3],
          ["trackingSeconds", "attention.trackingSeconds", 2, 12, 0.5, 4],
        ]
      : kind === "search"
        ? [["searchItems", "attention.searchItems", 4, 12, 1, 6]]
        : kind === "memory"
          ? [
              ["recallItems", "attention.recallItems", 1, 4, 1, 1],
              ["recallExposure", "attention.recallExposure", 0.8, 5, 0.1, 1.8],
              ["recallDelay", "attention.recallDelay", 0, 3, 0.1, 0.6],
            ]
          : [["sequenceItems", "attention.sequenceItems", 4, 12, 1, 6]];
  return (
    <>
      {(kind === "search" || kind === "memory") && (
        <label>
          {t("attention.variant")}
          <select
            value={
              kind === "search"
                ? (configuration.searchTask ?? "Mixed")
                : (configuration.recallTask ?? "Mixed")
            }
            onChange={(event) =>
              setting(
                kind === "search" ? "searchTask" : "recallTask",
                event.target.value,
              )
            }
          >
            <option value="Mixed">{t("attention.variety")}</option>
            {(kind === "search"
              ? (["Count", "Match", "Moving"] as const)
              : (["Locations", "Digits", "Directions", "Compare"] as const)
            ).map((task) => (
              <option key={task} value={task}>
                {t(`attention.task.${task}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      {fields
        .filter(
          ([key]) =>
            key !== "recallItems" || configuration.recallTask !== "Compare",
        )
        .map(([key, label, minimum, maximum, step, fallback]) => (
          <label key={key}>
            {t(label)} · {number(Number(configuration[key] ?? fallback))}
            <input
              type="range"
              min={minimum}
              max={maximum}
              step={step}
              value={Number(configuration[key] ?? fallback)}
              onChange={(event) => setting(key, Number(event.target.value))}
            />
          </label>
        ))}
    </>
  );
}
