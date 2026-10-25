import {
  pursuitPatterns,
  type Pattern,
  type PursuitPreset,
} from "../engine/model";
import { useI18n } from "../i18n/react";
import { Icon } from "./Icon";

const pathDrawings: Record<Pattern, string> = {
  Mixed: "M8 18H52 M30 5V31 M18 18a12 12 0 1 0 24 0a12 12 0 1 0-24 0",
  Horizontal: "M7 18H53",
  Vertical: "M30 4V32",
  Circle: "M16 18a14 14 0 1 0 28 0a14 14 0 1 0-28 0",
  "Figure eight": "M30 18C10-10-7 28 17 29C28 29 32 7 43 7C67 7 50 46 30 18Z",
  Wandering: "M6 25C12 4 28 4 25 22S48 38 54 9",
};
export function PursuitPresets({
  value,
  onChange,
}: {
  value: PursuitPreset;
  onChange: (preset: PursuitPreset) => void;
}) {
  const { t, patternLabel } = useI18n();
  return (
    <fieldset className="motion-presets">
      <legend>{t("pursuit.motion")}</legend>
      <div className="motion-grid">
        {([...pursuitPatterns, "Custom"] as const).map((preset) => (
          <button
            type="button"
            key={preset}
            className={`motion-preset ${preset === "Mixed" ? "mixed-preset" : ""}`}
            aria-pressed={value === preset}
            onClick={() => onChange(preset)}
          >
            {preset === "Custom" ? (
              <Icon name="Edit" />
            ) : (
              <svg
                viewBox="0 0 60 36"
                width="60"
                height="36"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d={pathDrawings[preset]}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <span>
              <strong>
                {preset === "Custom"
                  ? t("pursuit.custom")
                  : patternLabel(preset)}
              </strong>
              {preset === "Mixed" && <small>{t("pursuit.mixedSummary")}</small>}
            </span>
            {value === preset && (
              <span className="preset-check" aria-hidden="true">
                <Icon name="Check" />
              </span>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
