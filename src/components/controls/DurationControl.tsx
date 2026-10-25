import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "../../i18n/react";
import { Icon } from "../Icon";
import { parseDurationParts } from "./values";
interface Props {
  value: number;
  onChange: (seconds: number) => void;
  label: string;
  minimum?: number;
  maximum?: number;
  sliderMaximum?: number;
  compact?: boolean;
  onValidationChange?: (valid: boolean) => void;
}
export function DurationControl({
  value,
  onChange,
  label,
  minimum = 10,
  maximum = 3600,
  sliderMaximum = 900,
  compact = false,
  onValidationChange,
}: Props) {
  const { t, duration } = useI18n();
  const identifier = useId();
  const [rangeMaximum, setRangeMaximum] = useState(() =>
    Math.min(maximum, Math.max(sliderMaximum, value)),
  );
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(String(Math.floor(value / 60)));
  const [seconds, setSeconds] = useState(String(value % 60));
  const [invalid, setInvalid] = useState(false);
  const minuteInput = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setMinutes(String(Math.floor(value / 60)));
    setSeconds(String(value % 60));
    if (value > rangeMaximum) setRangeMaximum(value);
  }, [value, rangeMaximum]);
  useEffect(() => {
    if (editing) {
      minuteInput.current?.focus();
      minuteInput.current?.select();
    }
  }, [editing]);
  const commit = (restoreFocus = false) => {
    const parsed = parseDurationParts(minutes, seconds, minimum, maximum);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    onChange(parsed);
    setRangeMaximum(Math.min(maximum, Math.max(sliderMaximum, parsed)));
    setInvalid(false);
    setEditing(false);
    if (restoreFocus) editButton.current?.focus();
  };
  const validDraft =
    !editing || parseDurationParts(minutes, seconds, minimum, maximum) !== null;
  useEffect(() => {
    onValidationChange?.(validDraft);
  }, [validDraft, onValidationChange]);
  const cancel = () => {
    setMinutes(String(Math.floor(value / 60)));
    setSeconds(String(value % 60));
    setInvalid(false);
    setEditing(false);
    editButton.current?.focus();
  };
  return (
    <fieldset className={`duration-control ${compact ? "compact" : ""}`}>
      <legend className="visually-hidden">{label}</legend>
      <div className="control-heading">
        <span id={`${identifier}-label`}>{label}</span>
        <button
          ref={editButton}
          type="button"
          className="duration-value"
          onClick={() => (editing ? commit(true) : setEditing(true))}
          aria-label={t("duration.edit", { label })}
          aria-expanded={editing}
          aria-controls={`${identifier}-exact`}
        >
          <span>{duration(value)}</span>
          <Icon name="Edit" />
        </button>
      </div>
      <input
        className="duration-slider"
        type="range"
        aria-labelledby={`${identifier}-label`}
        aria-valuetext={duration(value)}
        min={minimum}
        max={rangeMaximum}
        step={1}
        value={value}
        style={
          {
            "--range-progress": `${((value - minimum) / (rangeMaximum - minimum)) * 100}%`,
          } as CSSProperties
        }
        onChange={(event) => {
          const next = Math.round(Number(event.target.value));
          onChange(Math.min(rangeMaximum, Math.max(minimum, next)));
          setInvalid(false);
        }}
      />
      <div className="range-captions" aria-hidden="true">
        <span>{duration(minimum)}</span>
        <span>{duration(rangeMaximum)}</span>
      </div>
      {editing && (
        <div
          className="exact-duration"
          id={`${identifier}-exact`}
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget) &&
              event.relatedTarget !== editButton.current
            )
              commit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(true);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
        >
          <label>
            {t("duration.minutes")}
            <input
              ref={minuteInput}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={minutes}
              onChange={(event) => {
                setMinutes(event.target.value);
                setInvalid(false);
              }}
              aria-invalid={invalid}
              aria-describedby={invalid ? `${identifier}-error` : undefined}
            />
          </label>
          <label>
            {t("duration.seconds")}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={seconds}
              onChange={(event) => {
                setSeconds(event.target.value);
                setInvalid(false);
              }}
              aria-invalid={invalid}
              aria-describedby={invalid ? `${identifier}-error` : undefined}
            />
          </label>
          <button type="button" className="primary" onClick={() => commit(true)}>
            {t("common.done")}
          </button>
          {invalid && (
            <p className="field-error" role="alert" id={`${identifier}-error`}>
              {t("duration.invalid", {
                minimum: duration(minimum),
                maximum: duration(maximum),
              })}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
