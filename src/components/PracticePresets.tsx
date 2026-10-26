import type { ExerciseKind } from "../engine/model";
import type { PracticeMode } from "../engine/practice";
import { useI18n } from "../i18n/react";

export function PracticePresets({
  kind,
  value,
  onChange,
  onCustomize,
  dialogId,
}: {
  kind: ExerciseKind;
  value: PracticeMode;
  onChange: (mode: PracticeMode) => void;
  onCustomize: () => void;
  dialogId: string;
}) {
  const { t, patternLabel } = useI18n();
  return (
    <fieldset className="practice-presets">
      <legend>
        {t(kind === "pursuit" ? "pursuit.motion" : "practice.settings")}
      </legend>
      <div className="motion-grid">
        <button
          type="button"
          className="motion-preset"
          aria-pressed={value === "Default"}
          onClick={() => onChange("Default")}
        >
          {kind === "pursuit" ? patternLabel("Mixed") : t("practice.default")}
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
