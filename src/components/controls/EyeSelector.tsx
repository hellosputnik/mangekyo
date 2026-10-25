import { useId } from "react";
import type { Eye } from "../../engine/model";
import { useI18n } from "../../i18n/react";
export function EyeDiagram({ eye }: { eye: Eye }) {
  return (
    <svg
      viewBox="0 0 76 32"
      width="76"
      height="32"
      aria-hidden="true"
      focusable="false"
    >
      {[17, 59].map((center, index) => {
        const active =
          eye === "Both" || eye === (index === 0 ? "Left" : "Right");
        return (
          <g key={center} opacity={active ? 1 : 0.25}>
            <path
              d={`M${center - 13} 16q13-17 26 0-13 17-26 0Z`}
              fill={active ? "currentColor" : "none"}
              fillOpacity=".12"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <circle
              cx={center}
              cy="16"
              r="4.5"
              fill={active ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </g>
        );
      })}
      <path
        d="M38 15v8"
        stroke="currentColor"
        opacity=".2"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function EyeSelector({
  value,
  onChange,
  label,
  name,
}: {
  value: Eye;
  onChange: (eye: Eye) => void;
  label: string;
  name?: string;
}) {
  const identifier = useId();
  const { t, eyeLabel } = useI18n();
  return (
    <fieldset className="eye-selector">
      <legend>{label}</legend>
      <p className="control-caption">{t("eye.perspective")}</p>
      <div className="eye-options">
        {(["Left", "Right", "Both"] as const).map((eye) => (
          <label className="eye-option" key={eye}>
            <input
              type="radio"
              name={name ?? identifier}
              value={eye}
              checked={value === eye}
              onChange={() => onChange(eye)}
            />
            <span className="eye-option-content">
              <EyeDiagram eye={eye} />
              <span>{eyeLabel(eye)}</span>
              <span className="selection-mark" aria-hidden="true">
                ✓
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
