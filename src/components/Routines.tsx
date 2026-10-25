import {
  names,
  bounded,
  type Data,
  type Eye,
  type ExerciseKind,
  type Routine,
} from "../engine/model";
import { useI18n } from "../i18n/react";
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
  const { t, number, eyeLabel, exerciseName } = useI18n();
  return (
    <>
      <section className="panel">
        <h2>{t("routine.saved")}</h2>
        {!data.routines.length && <p>{t("routine.empty")}</p>}
        {data.routines.map((item) => (
          <div className="routine-row" key={item.id}>
            <div>
              <h3>{item.name}</h3>
              <p>
                {t("routine.summary", {
                  count: number(item.steps.length),
                  minutes: number(
                    Math.round(
                      item.steps.reduce((sum, step) => sum + step.duration, 0) /
                        60,
                    ),
                  ),
                })}
              </p>
            </div>
            <button onClick={() => setRoutine(structuredClone(item))}>
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
          </div>
        ))}
        <label>
          {t("routine.eye")}
          <select
            value={eye}
            onChange={(event) => setEye(event.target.value as Eye)}
          >
            {(["Left", "Right", "Both"] as const).map((value) => (
              <option key={value} value={value}>
                {eyeLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="panel">
        <h2>{t("routine.build")}</h2>
        <label>
          {t("routine.name")}
          <input
            value={routine.name}
            onChange={(event) =>
              setRoutine({ ...routine, name: event.target.value })
            }
          />
        </label>
        {routine.steps.map((step, index) => (
          <div className="routine-step" key={index}>
            <span>{number(index + 1)}</span>
            <label>
              {t("routine.exercise")}
              <select
                value={step.kind}
                onChange={(event) =>
                  setRoutine({
                    ...routine,
                    steps: routine.steps.map((item, position) =>
                      position === index
                        ? { ...item, kind: event.target.value as ExerciseKind }
                        : item,
                    ),
                  })
                }
              >
                {(Object.keys(names) as ExerciseKind[]).map((value) => (
                  <option value={value} key={value}>
                    {exerciseName(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("routine.seconds")}
              <input
                type="number"
                min="10"
                max="3600"
                value={step.duration}
                onChange={(event) =>
                  setRoutine({
                    ...routine,
                    steps: routine.steps.map((item, position) =>
                      position === index
                        ? { ...item, duration: Number(event.target.value) }
                        : item,
                    ),
                  })
                }
              />
            </label>
            <button
              aria-label={t("routine.moveUp", { number: number(index + 1) })}
              disabled={!index}
              onClick={() => {
                const steps = [...routine.steps];
                [steps[index - 1], steps[index]] = [
                  steps[index],
                  steps[index - 1],
                ];
                setRoutine({ ...routine, steps });
              }}
            >
              ↑
            </button>
            <button
              aria-label={t("routine.remove", { number: number(index + 1) })}
              onClick={() =>
                setRoutine({
                  ...routine,
                  steps: routine.steps.filter(
                    (_, position) => position !== index,
                  ),
                })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setRoutine({
              ...routine,
              steps: [...routine.steps, { kind: "pursuit", duration: 300 }],
            })
          }
        >
          {t("routine.add")}
        </button>
        <div className="settings-grid">
          <label>
            {t("routine.rest")}
            <input
              type="number"
              min="0"
              max="3600"
              value={routine.rest}
              onChange={(event) =>
                setRoutine({
                  ...routine,
                  rest: bounded(Number(event.target.value), 0, 3600, 60),
                })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={routine.manual}
              onChange={(event) =>
                setRoutine({ ...routine, manual: event.target.checked })
              }
            />
            {t("routine.manual")}
          </label>
        </div>
        <button
          className="primary"
          disabled={!routine.steps.length || !routine.name.trim()}
          onClick={() => {
            const saved = {
              ...routine,
              steps: routine.steps.map((step) => ({
                ...step,
                duration: bounded(step.duration, 10, 3600, 300),
              })),
            };
            persist({
              ...data,
              routines: [
                ...data.routines.filter((item) => item.id !== saved.id),
                saved,
              ],
            });
            setRoutine({
              ...saved,
              id: crypto.randomUUID(),
              name: t("routine.newName"),
            });
          }}
        >
          {t("routine.save")}
        </button>
      </section>
    </>
  );
}
