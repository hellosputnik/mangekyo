import { useEffect, useId, useRef, useState } from "react";
import {
  names,
  pursuitPatterns,
  type Configuration,
  type ExerciseKind,
  type Eye,
  type PursuitPreset,
} from "../engine/model";
import { useI18n } from "../i18n/react";
import { EyeSelector } from "./controls/EyeSelector";
import { DurationControl } from "./controls/DurationControl";
import { ToggleSwitch } from "./controls/ToggleSwitch";
import { Icon } from "./Icon";
import { PursuitPresets } from "./PursuitPresets";
interface Props {
  minutes: number;
  goal: number;
  kind: ExerciseKind;
  setKind: (kind: ExerciseKind) => void;
  eye: Eye;
  setEye: (eye: Eye) => void;
  configuration: Configuration;
  setting: (key: keyof Configuration, value: string | number | boolean) => void;
  selectPursuitPreset: (preset: PursuitPreset) => void;
  ready: boolean;
  start: () => void;
}
function AdvancedFields({
  kind,
  configuration,
  setting,
}: Pick<Props, "kind" | "configuration" | "setting">) {
  const { t, number, optionLabel } = useI18n();
  return (
    <>
      <div className="settings-grid">
        {kind === "pursuit" && (
          <label>
            {t("config.pattern")}
            <select
              value={configuration.pattern}
              onChange={(event) => setting("pattern", event.target.value)}
            >
              {pursuitPatterns.map((value) => (
                <option key={value} value={value}>
                  {optionLabel(value)}
                </option>
              ))}
            </select>
          </label>
        )}
        {(
          [
            ["size", t("config.size"), 8, 120, 1],
            ["speed", t("config.speed"), 0.02, 1, 0.02],
            ["contrast", t("config.contrast"), 0.03, 1, 0.01],
            ["complexity", t("config.complexity"), 1, 5, 1],
            ["exposure", t("config.exposure"), 0.5, 10, 0.5],
            ["jumpPause", t("config.jumpPause"), 0, 10, 0.5],
            ["jumpDistance", t("config.jumpDistance"), 0.1, 1, 0.1],
            ["distance", t("config.distance"), 15, 200, 1],
          ] as const
        )
          .filter(([key]) => {
            if (key === "speed" || key === "complexity")
              return kind === "pursuit";
            if (
              key === "exposure" ||
              key === "jumpPause" ||
              key === "jumpDistance"
            )
              return kind === "saccades";
            return true;
          })
          .map(([key, label, min, max, step]) => (
            <label key={key}>
              {label} · {number(configuration[key])}
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={configuration[key]}
                onChange={(event) => setting(key, Number(event.target.value))}
              />
            </label>
          ))}
        {kind !== "contrast" && (
          <label>
            {t("config.foreground")}
            <input
              type="color"
              value={configuration.foreground}
              onChange={(event) => setting("foreground", event.target.value)}
            />
          </label>
        )}
        <label>
          {t("config.background")}
          <input
            type="color"
            value={configuration.background}
            onChange={(event) => setting("background", event.target.value)}
          />
        </label>
        {kind === "visual" && (
          <label>
            {t("config.visualTask")}
            <select
              value={configuration.stimulus}
              onChange={(event) => setting("stimulus", event.target.value)}
            >
              {["Opening", "Orientation", "Shape"].map((value) => (
                <option key={value} value={value}>
                  {optionLabel(value)}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === "contrast" && (
          <label>
            {t("config.contrastTask")}
            <select
              value={configuration.contrastStimulus}
              onChange={(event) =>
                setting("contrastStimulus", event.target.value)
              }
            >
              <option value="Grating">{t("stimulus.Grating")}</option>
              <option value="Shape">{t("stimulus.Shape")}</option>
            </select>
          </label>
        )}
        {kind === "saccades" && (
          <ToggleSwitch
            label={t("config.tapConfirm")}
            checked={configuration.tapConfirm}
            onChange={(checked) => setting("tapConfirm", checked)}
          />
        )}
      </div>
      <p className="fine">{t("practice.eyeNote")}</p>
    </>
  );
}
export function Practice({
  minutes,
  goal,
  kind,
  setKind,
  eye,
  setEye,
  configuration,
  setting,
  selectPursuitPreset,
  ready,
  start,
}: Props) {
  const { t, number, exerciseName, exerciseDescription } = useI18n();
  const [durationValid, setDurationValid] = useState(true);
  const selectedPreset = configuration.pursuitPreset ?? "Custom";
  const [customOpen, setCustomOpen] = useState(false);
  const customDialog = useRef<HTMLDialogElement>(null);
  const customDialogId = useId();
  useEffect(() => {
    const dialog = customDialog.current;
    if (!dialog) return;
    if (customOpen && !dialog.open) dialog.showModal();
    if (!customOpen && dialog.open) dialog.close();
  }, [customOpen]);
  useEffect(() => {
    if (!customOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [customOpen]);
  return (
    <>
      <div className="practice-layout">
        <div className="practice-overview">
          <section className="daily compact-daily">
            <div>
              <span className="eyebrow">{t("daily.title")}</span>
              <div className="daily-number">
                {number(minutes, 1)}{" "}
                <span>
                  / {number(goal)} {t("unit.minutes")}
                </span>
              </div>
              <p>
                {t("daily.remaining", {
                  minutes: number(Math.max(0, goal - minutes), 1),
                })}
              </p>
            </div>
            <div
              className="progress-ring"
              style={{
                background: `conic-gradient(var(--accent) ${Math.min(100, (minutes / goal) * 100)}%, var(--surface-raised) 0)`,
              }}
            >
              <span>
                {number(Math.round((minutes / goal) * 100))}
                <small>%</small>
              </span>
            </div>
          </section>
          <section
            className="exercise-library"
            aria-labelledby="exercise-library-title"
          >
            <div className="section-label">
              <h2 id="exercise-library-title">{t("practice.choose")}</h2>
              <span>{t("practice.exerciseCount", { count: number(4) })}</span>
            </div>
            <div className="exercise-grid">
              {(Object.keys(names) as ExerciseKind[]).map((item, index) => (
                <button
                  type="button"
                  className={`exercise-card ${kind === item ? "selected" : ""}`}
                  key={item}
                  aria-pressed={kind === item}
                  onClick={() => setKind(item)}
                >
                  <span className="exercise-card-content">
                    <span
                      className={`exercise-art art-${item}`}
                      aria-hidden="true"
                    >
                      {["∞", "· ·", "C", "▥"][index]}
                    </span>
                    <span className="card-copy">
                      <strong>{exerciseName(item)}</strong>
                      <span className="card-check" aria-hidden="true">
                        {kind === item && <Icon name="Check" />}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="library-description">{exerciseDescription(kind)}</p>
          </section>
          {kind === "pursuit" && (
            <section className="pursuit-options">
              <PursuitPresets
                value={selectedPreset}
                onChange={selectPursuitPreset}
                onCustomize={() => setCustomOpen(true)}
                dialogId={customDialogId}
              />
              {selectedPreset === "Mixed" && (
                <p className="preset-description">{t("pursuit.mixedNote")}</p>
              )}
            </section>
          )}
        </div>
        <section className="setup" aria-labelledby="setup-title">
          <div className="setup-heading">
            <span className="eyebrow">{t("practice.configure")}</span>
            <h2 id="setup-title">{exerciseName(kind)}</h2>
          </div>
          <EyeSelector
            label={t("practice.eye")}
            value={eye}
            onChange={setEye}
          />
          <p className="control-caption">{t("eye.selfReported")}</p>
          <DurationControl
            label={t("practice.duration")}
            value={configuration.duration}
            onChange={(value) => setting("duration", value)}
            onValidationChange={setDurationValid}
          />
          <button
            className="primary begin-button"
            disabled={!ready || !durationValid}
            onClick={start}
          >
            {t("practice.begin")}
            <span aria-hidden="true">→</span>
          </button>
          {kind !== "pursuit" && (
            <details className="exercise-adjustments" key={kind}>
              <summary>
                {t("practice.customize")}
                <Icon name="Chevron" />
              </summary>
              <AdvancedFields
                kind={kind}
                configuration={configuration}
                setting={setting}
              />
            </details>
          )}
        </section>
      </div>
      <dialog
        ref={customDialog}
        id={customDialogId}
        className="custom-dialog"
        aria-labelledby={`${customDialogId}-title`}
        onCancel={() => setCustomOpen(false)}
        onClose={() => setCustomOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          ) {
            setCustomOpen(false);
          }
        }}
      >
        <div className="custom-dialog-header">
          <h2 id={`${customDialogId}-title`}>{t("pursuit.customSettings")}</h2>
          <button
            type="button"
            className="primary"
            onClick={() => setCustomOpen(false)}
          >
            {t("common.done")}
          </button>
        </div>
        <div className="custom-dialog-body">
          <AdvancedFields
            kind="pursuit"
            configuration={configuration}
            setting={setting}
          />
        </div>
      </dialog>
      <details className="safety-disclosure">
        <summary>
          <span>
            <strong>{t("practice.safetyDetails")}</strong>
            <span>{t("practice.safetyShort")}</span>
          </span>
          <Icon name="Chevron" />
        </summary>
        <p>{t("safety.summary")}</p>
      </details>
    </>
  );
}
