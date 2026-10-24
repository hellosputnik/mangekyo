import {names,bounded,type Data,type Eye,type ExerciseKind,type Routine} from '../engine/model';
interface Props {data:Data;eye:Eye;setEye:(eye:Eye)=>void;routine:Routine;setRoutine:(routine:Routine)=>void;persist:(data:Data)=>void;start:(kind:ExerciseKind,duration:number,eye:Eye)=>void;}
export function Routines({data,eye,setEye,routine,setRoutine,persist,start}:Props){return (<>
                <section className="panel">
                  <h2>Your saved routines</h2>
                  {!data.routines.length && (
                    <p>Save your first sequence below.</p>
                  )}
                  {data.routines.map((item) => (
                    <div className="routine-row" key={item.id}>
                      <div>
                        <h3>{item.name}</h3>
                        <p>
                          {item.steps.length} exercises ·{" "}
                          {Math.round(
                            item.steps.reduce(
                              (sum, step) => sum + step.duration,
                              0,
                            ) / 60,
                          )}{" "}
                          active min
                        </p>
                      </div>
                      <button onClick={() => setRoutine(structuredClone(item))}>
                        Edit
                      </button>
                      <button
                        className="primary"
                        onClick={() => {
                          data.run = {
                            routine: structuredClone(item),
                            index: 0,
                            eye,
                          };
                          start(
                            item.steps[0].kind,
                            item.steps[0].duration,
                            eye,
                          );
                        }}
                      >
                        Start
                      </button>
                    </div>
                  ))}
                  <label>
                    Routine eye
                    <select
                      value={eye}
                      onChange={(event) => setEye(event.target.value as Eye)}
                    >
                      <option>Left</option>
                      <option>Right</option>
                      <option>Both</option>
                    </select>
                  </label>
                </section>
                <section className="panel">
                  <h2>Build a routine</h2>
                  <label>
                    Name
                    <input
                      value={routine.name}
                      onChange={(event) =>
                        setRoutine({ ...routine, name: event.target.value })
                      }
                    />
                  </label>
                  {routine.steps.map((step, index) => (
                    <div className="routine-step" key={index}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <label>
                        Exercise
                        <select
                          value={step.kind}
                          onChange={(event) =>
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
                            })
                          }
                        >
                          {Object.entries(names).map(([value, name]) => (
                            <option value={value} key={value}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Seconds
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
                                  ? {
                                      ...item,
                                      duration: Number(event.target.value),
                                    }
                                  : item,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        aria-label={`Move exercise ${index + 1} up`}
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
                        aria-label={`Remove exercise ${index + 1}`}
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
                        steps: [
                          ...routine.steps,
                          { kind: "pursuit", duration: 300 },
                        ],
                      })
                    }
                  >
                    + Add exercise
                  </button>
                  <div className="settings-grid">
                    <label>
                      Rest between exercises (seconds)
                      <input
                        type="number"
                        min="0"
                        max="3600"
                        value={routine.rest}
                        onChange={(event) =>
                          setRoutine({
                            ...routine,
                            rest: bounded(
                              Number(event.target.value),
                              0,
                              3600,
                              60,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={routine.manual}
                        onChange={(event) =>
                          setRoutine({
                            ...routine,
                            manual: event.target.checked,
                          })
                        }
                      />
                      Manual breaks
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
                          ...data.routines.filter(
                            (item) => item.id !== saved.id,
                          ),
                          saved,
                        ],
                      });
                      setRoutine({
                        ...saved,
                        id: crypto.randomUUID(),
                        name: "New routine",
                      });
                    }}
                  >
                    Save preset
                  </button>
                </section>
              </>);}
