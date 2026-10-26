import type { PursuitPreset } from "../engine/model";
import { useI18n } from "../i18n/react";

export function PursuitPresets({
  value,
  onChange,
  onCustomize,
  dialogId,
}: {
  value: PursuitPreset;
  onChange: (preset: "Mixed" | "Custom") => void;
  onCustomize: () => void;
  dialogId: string;
}) {
  const { t, patternLabel } = useI18n();
  return (
    <fieldset className="motion-presets">
      <legend>{t("pursuit.motion")}</legend>
      <div className="motion-grid">
        <button
          type="button"
          className="motion-preset"
          aria-pressed={value === "Mixed"}
          onClick={() => onChange("Mixed")}
        >
          {patternLabel("Mixed")}
        </button>
        <button
          type="button"
          className="motion-preset"
          aria-pressed={value !== "Mixed"}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          onClick={() => {
            onChange("Custom");
            onCustomize();
          }}
        >
          {t("pursuit.custom")}
        </button>
      </div>
    </fieldset>
  );
}
