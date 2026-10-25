import { useEffect, useId, useState } from "react";
import { useI18n } from "../../i18n/react";
import { Icon } from "../Icon";
import { parseWholeNumber } from "./values";
export function NumberStepper({
  label,
  value,
  minimum,
  maximum,
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}) {
  const { t, number } = useI18n();
  const identifier = useId();
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(String(value));
    setInvalid(false);
  }, [value]);
  const commit = () => {
    const parsed = parseWholeNumber(draft, minimum, maximum);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    onChange(parsed);
    setInvalid(false);
  };
  return (
    <div className="stepper-setting">
      <label htmlFor={identifier}>{label}</label>
      <div className="number-stepper">
        <button
          type="button"
          disabled={value <= minimum}
          aria-label={t("number.decrease", { label })}
          onClick={() => onChange(Math.max(minimum, value - 1))}
        >
          <Icon name="Minus" />
        </button>
        <input
          id={identifier}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              setDraft(String(value));
              setInvalid(false);
            }
          }}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${identifier}-error` : undefined}
        />
        <button
          type="button"
          disabled={value >= maximum}
          aria-label={t("number.increase", { label })}
          onClick={() => onChange(Math.min(maximum, value + 1))}
        >
          <Icon name="Plus" />
        </button>
      </div>
      {invalid && (
        <p role="alert" className="field-error" id={`${identifier}-error`}>
          {t("number.invalid", {
            minimum: number(minimum),
            maximum: number(maximum),
          })}
        </p>
      )}
    </div>
  );
}
