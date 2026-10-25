import { useState } from "react";
import {
  names,
  type Data,
  type Eye,
  type ExerciseKind,
  type Routine,
} from "../engine/model";
import { useI18n } from "../i18n/react";
import { EyeSelector } from "./controls/EyeSelector";
import { DurationControl } from "./controls/DurationControl";
import { ToggleSwitch } from "./controls/ToggleSwitch";
import { Icon } from "./Icon";
interface Props {
  data: Data;
  eye: Eye;
  setEye: (eye: Eye) => void;
  routine: Routine;
  setRoutine: (routine: Routine) => void;
  persist: (data: Data) => void;
  start: (kind: ExerciseKind, duration: number, eye: Eye) => void;
}
export function Routines({
  data,
  eye,
  setEye,
  routine,
  setRoutine,
  persist,
  start,
}: Props) {
  const { t, number, exerciseName, duration } = useI18n();
  const [removed, setRemoved] = useState<Routine | null>(null);
  const [saved, setSaved] = useState(false);
  const [invalidSteps, setInvalidSteps] = useState<Record<number, boolean>>({});
  const [restValid, setRestValid] = useState(true);
  const [editorVersion, setEditorVersion] = useState(0);
  const resetStepEditors = () => {
    setInvalidSteps({});
    setEditorVersion((previous) => previous + 1);
    setSaved(false);
  };
  const reorder = (index: number, direction: -1 | 1) => {
    const other = index + direction;
    if (other < 0 || other >= routine.steps.length) return;
    const steps = [...routine.steps];
    [steps[index], steps[other]] = [steps[other], steps[index]];
    setRoutine({ ...routine, steps });
    resetStepEditors();
  };
  return (
    <div className="routines-layout">
      <section className="panel saved-routines">
        <h2>{t("routine.saved")}</h2>
        <EyeSelector value={eye} onChange={setEye} label={t("routine.eye")} />
        {!data.routines.length && <p>{t("routine.empty")}</p>}
        {data.routines.map((item) => (
          <article className="routine-row" key={item.id}>
            <div>
              <h3>{item.name}</h3>
              <p>
                {t("routine.summary", {
                  count: number(item.steps.length),
                  duration: duration(
                    item.steps.reduce((sum, step) => sum + step.duration, 0),
                  ),
                })}
              </p>
            </div>
            <div className="routine-row-actions">
              <button
                onClick={() => {
                  setRoutine(structuredClone(item));
                  resetStepEditors();
                  setRestValid(true);
                }}
              >
                {t("routine.edit")}
              </button>
              <button
                className="primary"
                onClick={() => {
                  data.run = { routine: structuredClone(item), index: 0, eye };
                  start(item.steps[0].kind, item.steps[0].duration, eye);
                }}
              >
                {t("routine.start")}
              </button>
              <button
                className="icon-button quiet"
                aria-label={t("routine.delete", { name: item.name })}
                onClick={() => {
                  setRemoved(item);
                  persist({
                    ...data,
                    routines: data.routines.filter(
                      (existing) => existing.id !== item.id,
                    ),
                  });
                }}
              >
                <Icon name="Trash" />
              </button>
            </div>
          </article>
        ))}
        {removed && (
          <div className="inline-notice" role="status">
            <span>{t("routine.deleted", { name: removed.name })}</span>
            <button
              onClick={() => {
                persist({
                  ...data,
                  routines: [
                    ...data.routines.filter((item) => item.id !== removed.id),
                    removed,
                  ],
                });
                setRemoved(null);
              }}
            >
              {t("common.undo")}
            </button>
          </div>
        )}
      </section>
      <section className="panel routine-editor">
        <h2>{t("routine.build")}</h2>
        <label>
          {t("routine.name")}
          <input
            value={routine.name}
            onChange={(event) => {
              setRoutine({ ...routine, name: event.target.value });
              setSaved(false);
            }}
          />
        </label>
        <div className="routine-steps">
          {routine.steps.map((step, index) => (
            <details
              className="routine-step"
              key={`${routine.id}-${editorVersion}-${index}`}
              open={index === 0 || undefined}
            >
              <summary>
                <span className="step-number">{number(index + 1)}</span>
                <span>
                  <strong>{exerciseName(step.kind)}</strong>
                  <small className={invalidSteps[index] ? "field-error" : ""}>
                    {invalidSteps[index]
                      ? t("routine.checkDuration")
                      : duration(step.duration)}
                  </small>
                </span>
                <Icon name="Chevron" />
              </summary>
              <div className="routine-step-body">
                <label>
                  {t("routine.exercise")}
                  <select
                    value={step.kind}
                    onChange={(event) => {
                      setRoutine({
                        ...routine,
                        steps: routine.steps.map((item, position) =>
                          position === index
                            ? {
                                ...item,
                                kind: event.target.value as ExerciseKind,
                              }
                            : item,
                        ),
                      });
                      setSaved(false);
                    }}
                  >
                    {(Object.keys(names) as ExerciseKind[]).map((kind) => (
                      <option value={kind} key={kind}>
                        {exerciseName(kind)}
                      </option>
                    ))}
                  </select>
                </label>
                <DurationControl
                  compact
                  label={t("practice.duration")}
                  value={step.duration}
                  onChange={(duration) => {
                    setRoutine({
                      ...routine,
                      steps: routine.steps.map((item, position) =>
                        position === index ? { ...item, duration } : item,
                      ),
                    });
                    setSaved(false);
                  }}
                  onValidationChange={(valid) =>
                    setInvalidSteps((previous) =>
                      previous[index] === !valid
                        ? previous
                        : { ...previous, [index]: !valid },
                    )
                  }
                />
                <div className="routine-step-actions">
                  <button
                    type="button"
                    className="icon-button"
                    disabled={index === 0}
                    aria-label={t("routine.moveUp", {
                      number: number(index + 1),
                    })}
                    onClick={() => reorder(index, -1)}
                  >
                    <Icon name="Up" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={index === routine.steps.length - 1}
                    aria-label={t("routine.moveDown", {
                      number: number(index + 1),
                    })}
                    onClick={() => reorder(index, 1)}
                  >
                    <Icon name="Down" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t("routine.duplicate", {
                      number: number(index + 1),
                    })}
                    onClick={() => {
                      const steps = [...routine.steps];
                      steps.splice(index + 1, 0, { ...step });
                      setRoutine({ ...routine, steps });
                      resetStepEditors();
                    }}
                  >
                    <Icon name="Copy" />
                  </button>
                  <button
                    type="button"
                    className="icon-button quiet"
                    aria-label={t("routine.remove", {
                      number: number(index + 1),
                    })}
                    onClick={() => {
                      setRoutine({
                        ...routine,
                        steps: routine.steps.filter(
                          (_, position) => position !== index,
                        ),
                      });
                      resetStepEditors();
                    }}
                  >
                    <Icon name="Trash" />
                  </button>
                </div>
              </div>
            </details>
          ))}
        </div>
        <button
          onClick={() => {
            setRoutine({
              ...routine,
              steps: [...routine.steps, { kind: "pursuit", duration: 300 }],
            });
            setSaved(false);
          }}
        >
          <Icon name="Plus" />
          {t("routine.add")}
        </button>
        <ToggleSwitch
          label={t("routine.manual")}
          checked={routine.manual}
          onChange={(manual) => {
            setRoutine({ ...routine, manual });
            setSaved(false);
          }}
        />
        {!routine.manual && (
          <DurationControl
            key={routine.id}
            label={t("routine.rest")}
            value={routine.rest}
            minimum={0}
            sliderMaximum={300}
            onChange={(rest) => {
              setRoutine({ ...routine, rest });
              setSaved(false);
            }}
            onValidationChange={setRestValid}
          />
        )}
        <button
          className="primary save-routine"
          disabled={
            !routine.steps.length ||
            !routine.name.trim() ||
            Object.values(invalidSteps).some(Boolean) ||
            (!routine.manual && !restValid)
          }
          onClick={() => {
            persist({
              ...data,
              routines: [
                ...data.routines.filter((item) => item.id !== routine.id),
                structuredClone(routine),
              ],
            });
            setSaved(true);
            setRoutine({
              ...routine,
              id: crypto.randomUUID(),
              name: t("routine.newName"),
            });
          }}
        >
          {t("routine.save")}
        </button>
        <p className="save-status" role="status">
          {saved ? t("routine.savedNotice") : ""}
        </p>
      </section>
    </div>
  );
}
