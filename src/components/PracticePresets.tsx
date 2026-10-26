import type { PracticeMode } from "../engine/practice";
import { useI18n } from "../i18n/react";

export function PracticePresets({
  value,
  onChange,
  onCustomize,
  dialogId,
}: {
  value: PracticeMode;
  onChange: (mode: PracticeMode) => void;
  onCustomize: () => void;
  dialogId: string;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="practice-presets">
      <legend>{t("practice.settings")}</legend>
      <div className="motion-grid">
        <button
          type="button"
          className="motion-preset"
          aria-pressed={value === "Default"}
          onClick={() => onChange("Default")}
        >
          {t("practice.default")}
        </button>
        <button
          type="button"
          className="motion-preset"
          aria-pressed={value === "Custom"}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          onClick={() => {
            onChange("Custom");
            onCustomize();
          }}
        >
          {t("practice.custom")}
        </button>
      </div>
    </fieldset>
  );
}
