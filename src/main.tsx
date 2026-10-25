import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  defaults,
  initialData,
  names,
  bounded,
  validate,
  localDate,
  type Configuration,
  type Data,
  type ExerciseKind,
  type Eye,
  type Routine,
  type Session,
} from "./engine/model";
import { ActiveTimer, adapt } from "./engine/timer";
import { load, save } from "./persistence/store";
import { allSessions, totalForDate, accuracy } from "./analytics/totals";
import { VisualExercise } from "./exercises/exercise";
import { advanceRoutine, advanceBreak } from "./engine/routines";
import { mergeBackup } from "./persistence/backup";
import { Routines } from "./components/Routines";
import { Progress } from "./components/Progress";
import { Icon } from "./components/Icon";
import "./style.css";
const formatTime = (milliseconds: number) =>
  `${Math.floor(milliseconds / 60000)}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")}`;
const descriptions: Record<ExerciseKind, string> = {
  pursuit: "Follow a flowing target with your eyes.",
  saccades: "Move your gaze between distinct targets.",
  visual: "Find the direction. Refine your attention.",
  contrast: "Find a subtle pattern among four panels.",
};
function App() {
  const [data, setData] = useState<Data>(initialData);
  const state = useRef(data);
  state.current = data;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Practice");
  const [kind, setKind] = useState<ExerciseKind>("pursuit");
  const [eye, setEye] = useState<Eye>("Left");
  const [configuration, setConfiguration] = useState(defaults);
  const [editing, setEditing] = useState(false);
  const [customDuration, setCustomDuration] = useState(false);
  const [, refresh] = useState(0);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [feedback, setFeedback] = useState("");
  const [routine, setRoutine] = useState<Routine>({
    id: crypto.randomUUID(),
    name: "My daily practice",
    steps: [
      { kind: "pursuit", duration: 300 },
      { kind: "visual", duration: 300 },
      { kind: "contrast", duration: 300 },
    ],
    rest: 60,
    manual: false,
  });
  const timer = useRef<ActiveTimer | null>(null);
  const exercise = useRef<VisualExercise | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const trialStart = useRef(0);
  const lastSave = useRef(0);
  const lastReminder = useRef(0);
  const persist = (next: Data) => {
    state.current = next;
    setData({ ...next });
    void save(next).catch(() =>
      setError(
        "Your progress could not be saved. Export your data before closing this app.",
      ),
    );
  };
  useEffect(() => {
    void load()
      .then((value) => {
        setData(value);
        state.current = value;
        if (
          !value.sessions.length &&
          !value.current &&
          matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          value.preferences.reducedMotion = true;
        if (value.current) timer.current = new ActiveTimer(value.current);
        setReady(true);
      })
      .catch(() => {
        setError(
          "Local storage is unavailable. Training is disabled to protect your progress.",
        );
      });
    const network = () => setOffline(!navigator.onLine);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    if ("serviceWorker" in navigator && import.meta.env.PROD)
      void navigator.serviceWorker.register("./sw.js").then((registration) => {
        if (registration.waiting) setUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setUpdate(worker);
          });
        });
      });
    return () => {
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, []);
  const pause = (interrupted = false) => {
    timer.current?.pause(interrupted);
    persist(state.current);
  };
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && state.current.current?.status === "running")
        pause(true);
    };
    const leaving = () => {
      if (state.current.current?.status === "running") pause(true);
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", leaving);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", leaving);
    };
  }, []);
  const current = data.current;
  useEffect(() => {
    if (!current) return;
    const renderer = new VisualExercise(current.kind, current.configuration);
    renderer.initialize();
    exercise.current = renderer;
    trialStart.current = current.activeMilliseconds;
    return () => {
      renderer.terminate();
      exercise.current = null;
    };
  }, [current?.id]);
  useEffect(() => {
    if (current?.status !== "running") return;
    let released = false;
    let lock: WakeLockSentinel | undefined;
    if ("wakeLock" in navigator)
      void navigator.wakeLock
        .request("screen")
        .then((value) => {
          if (released) void value.release();
          else lock = value;
        })
        .catch(() => {});
    return () => {
      released = true;
      void lock?.release();
    };
  }, [current?.status]);
  const finish = (abandoned = false) => {
    const latest = state.current;
    const session = latest.current;
    if (!session) return;
    timer.current?.finish(abandoned);
    latest.sessions = [
      ...latest.sessions.filter((item) => item.id !== session.id),
      structuredClone(session),
    ];
    latest.levels[session.kind] = session.difficulty;
    latest.current = null;
    timer.current = null;
    const rest = latest.run?.routine.rest ?? latest.preferences.rest;
    latest.breakState = {
      remaining: rest,
      manual: latest.run?.routine.manual ?? latest.preferences.manual,
    };
    advanceRoutine(latest);
    persist(latest);
  };
  useEffect(() => {
    if (!current) return;
    let frame = 0;
    let lastInterfaceUpdate = 0;
    const draw = (now: number) => {
      const session = state.current.current;
      if (session) {
        if (session.status === "running") {
          if (document.hidden) {
            pause(true);
          } else timer.current?.checkpoint();
          if (
            session.activeMilliseconds >=
            session.configuration.duration * 1000
          ) {
            finish();
            frame = requestAnimationFrame(draw);
            return;
          }
          if (now - lastSave.current > 1000) {
            lastSave.current = now;
            void save(state.current).catch(() =>
              setError("Saving failed. Please export your data."),
            );
          }
          const reminder = state.current.preferences.reminder * 60000;
          if (
            reminder > 0 &&
            session.activeMilliseconds - lastReminder.current >= reminder
          ) {
            lastReminder.current = session.activeMilliseconds;
            pause();
            setFeedback("Rest reminder · Continue only when comfortable.");
          }
        }
        const element = canvas.current;
        if (element && exercise.current) {
          const bounds = element.getBoundingClientRect();
          const ratio = Math.min(window.devicePixelRatio || 1, 3);
          if (
            element.width !== Math.round(bounds.width * ratio) ||
            element.height !== Math.round(bounds.height * ratio)
          ) {
            element.width = Math.round(bounds.width * ratio);
            element.height = Math.round(bounds.height * ratio);
          }
          const context = element.getContext("2d");
          if (context) {
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            exercise.current.update(
              session.activeMilliseconds / 1000,
              session.difficulty,
            );
            exercise.current.render(context, bounds.width, bounds.height);
          }
        }
        if (session.status === "running" && now - lastInterfaceUpdate >= 100) {
          lastInterfaceUpdate = now;
          refresh((value) => value + 1);
        }
      }
      if (state.current.current?.status === "running") {
        frame = requestAnimationFrame(draw);
      }
    };
    frame = requestAnimationFrame(draw);
    const resize = new ResizeObserver(() => {
      if (state.current.current?.status !== "running") draw(performance.now());
    });
    if (canvas.current) resize.observe(canvas.current);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [current?.id, current?.status]);
  useEffect(() => {
    if (
      !data.breakState ||
      data.breakState.manual ||
      data.breakState.remaining <= 0
    )
      return;
    let previous = performance.now();
    let frame = 0;
    let saved = 0;
    let lastInterfaceUpdate = 0;
    const tick = (now: number) => {
      const rest = state.current.breakState;
      if (!rest) return;
      const delta = now - previous;
      previous = now;
      if (!document.hidden) {
        rest.remaining = advanceBreak(rest.remaining, delta, false);
        if (now - lastInterfaceUpdate >= 200 || rest.remaining === 0) {
          lastInterfaceUpdate = now;
          setData({ ...state.current });
        }
        if (now - saved > 1000) {
          saved = now;
          void save(state.current).catch(() =>
            setError("Saving failed. Please export your data."),
          );
        }
        if (rest.remaining === 0) {
          if (state.current.preferences.sound) {
            navigator.vibrate?.(80);
            try {
              const audio = new AudioContext();
              const oscillator = audio.createOscillator();
              const gain = audio.createGain();
              gain.gain.value = 0.025;
              oscillator.connect(gain);
              gain.connect(audio.destination);
              oscillator.start();
              oscillator.stop(audio.currentTime + 0.12);
              oscillator.onended = () => void audio.close();
            } catch {
              /* Optional browser feature. */
            }
          }
          persist(state.current);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      previous = performance.now();
    };
    document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [
    Boolean(data.breakState),
    data.breakState?.manual,
    Boolean(data.breakState && data.breakState.remaining > 0),
  ]);
  const start = (
    selected = kind,
    duration = configuration.duration,
    selectedEye = eye,
  ) => {
    if (!ready || document.hidden || state.current.current) return;
    const settings = validate({
      ...configuration,
      duration,
      speed: data.preferences.reducedMotion
        ? Math.min(configuration.speed, 0.08)
        : configuration.speed,
    });
    const session: Session = {
      id: crypto.randomUUID(),
      kind: selected,
      eye: selectedEye,
      configuration: settings,
      startedAt: new Date().toISOString(),
      status: "paused",
      activeMilliseconds: 0,
      slices: [],
      trials: [],
      difficulty: state.current.levels[selected],
    };
    timer.current = new ActiveTimer(session);
    timer.current.resume();
    lastReminder.current = 0;
    setFeedback("");
    persist({ ...state.current, current: session, breakState: null });
  };
  const resume = () => {
    if (!document.hidden) {
      timer.current?.resume();
      persist(state.current);
    }
  };
  const answer = (choice: number) => {
    if (!current || current.status !== "running" || !exercise.current) return;
    const correct = exercise.current.answer(choice);
    current.trials.push({
      correct,
      responseMilliseconds: current.activeMilliseconds - trialStart.current,
      difficulty: current.difficulty,
    });
    trialStart.current = current.activeMilliseconds;
    if (current.trials.length % 5 === 0)
      current.difficulty = adapt(
        current.difficulty,
        current.trials.slice(-5).map((trial) => trial.correct),
      );
    setFeedback(correct ? "Correct" : "Try the next one");
    persist(state.current);
  };
  const minutes = totalForDate(data) / 60000;
  const setting = (
    key: keyof Configuration,
    value: string | number | boolean,
  ) => setConfiguration((previous) => ({ ...previous, [key]: value }));
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state.current, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `mangekyo-${localDate(new Date())}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div
      className={data.preferences.highContrast ? "app high-contrast" : "app"}
    >
      {!current && (
        <header>
          <a className="brand" href="#" onClick={() => setTab("Practice")}>
            <span className="brand-mark">✳</span> mangekyo
            <span className="brand-caption">VISUAL PRACTICE</span>
          </a>
          <span className="connection">
            <i />
            {offline ? "Offline · saved on device" : "On-device & private"}
          </span>
        </header>
      )}
      {error && (
        <div role="alert" className="notice">
          {error}
        </div>
      )}
      {update && !current && (
        <div className="notice">
          An update is ready.{" "}
          <button
            onClick={() => {
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                () => location.reload(),
                { once: true },
              );
              update.postMessage("SKIP_WAITING");
            }}
          >
            Update app
          </button>
        </div>
      )}
      {current ? (
        <main className="training">
          <div className="training-top">
            <div>
              <span className="eyebrow">
                {current.eye} eye · {current.status}
              </span>
              <h2>{names[current.kind]}</h2>
            </div>
            <span className="countdown">
              {formatTime(
                Math.max(
                  0,
                  current.configuration.duration * 1000 -
                    current.activeMilliseconds,
                ),
              )}
              <small>remaining</small>
            </span>
          </div>
          <div className="canvas-wrap">
            <canvas
              ref={canvas}
              aria-label={`${names[current.kind]} visual stimulus`}
            />
            {current.status !== "running" && (
              <div className="pause-overlay">
                <span className="orb">Ⅱ</span>
                <h2>
                  {current.status === "interrupted"
                    ? "Welcome back"
                    : "Take your time"}
                </h2>
                <p>
                  {current.status === "interrupted"
                    ? "Your session was interrupted. No time away was counted."
                    : "Your active timer is paused."}
                </p>
                <button className="primary" onClick={resume}>
                  {current.status === "interrupted"
                    ? "Confirm & resume"
                    : "Resume practice"}
                </button>
              </div>
            )}
          </div>
          <div className="exercise-info">
            <span>{formatTime(current.activeMilliseconds)} active</span>
            <span>
              {current.kind === "pursuit"
                ? "Follow with your eyes · keep your head comfortable"
                : current.kind === "saccades"
                  ? "Shift your gaze to each target"
                  : `Level ${current.difficulty + 1} · ${current.trials.length} responses`}
            </span>
          </div>
          {(current.kind === "visual" || current.kind === "contrast") && (
            <div className="answers">
              {(current.kind === "visual"
                ? ["Right →", "Down ↓", "Left ←", "Up ↑"]
                : ["Top left", "Top right", "Bottom left", "Bottom right"]
              ).map((label, index) => (
                <button
                  disabled={current.status !== "running"}
                  key={label}
                  onClick={() => answer(index)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {current.kind === "saccades" && current.configuration.tapConfirm && (
            <button
              onClick={() =>
                setFeedback(
                  "Target acknowledged · gaze accuracy is not measured",
                )
              }
            >
              I found the target
            </button>
          )}
          <div className="feedback" role="status">
            {feedback}
          </div>
          <div className="training-controls">
            <button
              onClick={() => pause()}
              disabled={current.status !== "running"}
            >
              Ⅱ Pause
            </button>
            <button className="primary" onClick={() => finish()}>
              Finish & save
            </button>
            <button onClick={() => finish(true)}>Skip / stop</button>
          </div>
          <p className="fine">
            Stop immediately if uncomfortable. Partial active time is always
            retained.
          </p>
        </main>
      ) : data.breakState ? (
        <main className="rest">
          <span className="eyebrow">SPACE TO REST</span>
          <div className="rest-art">◌</div>
          <h1>A moment away.</h1>
          <p>Relax your eyes. Look away from the screen.</p>
          <div className="rest-clock">
            {data.breakState.manual
              ? "No rush"
              : formatTime(data.breakState.remaining * 1000)}
          </div>
          <p>
            {data.run
              ? `Up next: ${names[data.run.routine.steps[data.run.index].kind]}`
              : "Your practice is saved."}
          </p>
          <div className="actions">
            <button
              onClick={() =>
                persist({
                  ...data,
                  breakState: {
                    ...data.breakState!,
                    remaining: data.breakState!.remaining + 60,
                  },
                })
              }
            >
              +1 minute
            </button>
            <button
              onClick={() =>
                persist({
                  ...data,
                  breakState: {
                    ...data.breakState!,
                    manual: !data.breakState!.manual,
                  },
                })
              }
            >
              {data.breakState.manual ? "Use countdown" : "Manual rest"}
            </button>
          </div>
          <button
            className="primary"
            onClick={() => {
              if (data.run) {
                const next = data.run.routine.steps[data.run.index];
                start(next.kind, next.duration, data.run.eye);
              } else persist({ ...data, breakState: null });
            }}
          >
            {data.run ? "Skip rest / start next" : "Back to practice"}
          </button>
          {data.run && (
            <button
              onClick={() => persist({ ...data, run: null, breakState: null })}
            >
              End routine
            </button>
          )}
          <p className="fine">
            Exercises only start when you choose. Rest pauses while the app is
            hidden.
          </p>
        </main>
      ) : (
        <>
          <main className="content">
            <div className="page-heading">
              <span className="eyebrow">A LITTLE FOCUS. AT YOUR PACE.</span>
              <h1>
                {tab === "Practice"
                  ? "Make space for clarity."
                  : tab === "Progress"
                    ? "Your practice, in perspective."
                    : tab === "Routines"
                      ? "Find your rhythm."
                      : "Made for your pace."}
              </h1>
              <p>
                {tab === "Practice"
                  ? "Simple visual exercises. A calmer place to practice."
                  : tab === "Progress"
                    ? "Training performance, thoughtfully recorded."
                    : tab === "Routines"
                      ? "Build a sequence, with room to rest."
                      : "Your preferences stay on this device."}
              </p>
            </div>
            {tab === "Practice" && (
              <>
                <section className="daily">
                  <div>
                    <span className="eyebrow">TODAY’S PRACTICE</span>
                    <div className="daily-number">
                      {minutes.toFixed(1)}{" "}
                      <span>/ {data.preferences.goal} min</span>
                    </div>
                    <p>
                      {Math.max(0, data.preferences.goal - minutes).toFixed(1)}{" "}
                      min to your personal goal
                    </p>
                  </div>
                  <div
                    className="progress-ring"
                    style={{
                      background: `conic-gradient(#ccdda7 ${Math.min(100, (minutes / data.preferences.goal) * 100)}%, #303d32 0)`,
                    }}
                  >
                    <span>
                      {Math.round((minutes / data.preferences.goal) * 100)}
                      <small>%</small>
                    </span>
                  </div>
                  <div className="daily-footer">
                    Every comfortable minute counts. There’s no need to catch
                    up.
                  </div>
                </section>
                <div className="section-label">
                  <h2>Choose your practice</h2>
                  <span>04 exercises</span>
                </div>
                <div className="exercise-grid">
                  {(Object.keys(names) as ExerciseKind[]).map((item, index) => (
                    <button
                      className={`exercise-card ${kind === item ? "selected" : ""}`}
                      key={item}
                      aria-pressed={kind === item}
                      onClick={() => {
                        setKind(item);
                        setEditing(false);
                      }}
                    >
                      <div
                        className={`exercise-art art-${item}`}
                        aria-hidden="true"
                      >
                        <span>{["∞", "· ·", "C", "▥"][index]}</span>
                        <b>0{index + 1}</b>
                      </div>
                      <div className="card-copy">
                        <h3>
                          {names[item]} <span>↗</span>
                        </h3>
                        <p>{descriptions[item]}</p>
                        <small>
                          {item === "pursuit" || item === "saccades"
                            ? "FOLLOW & OBSERVE"
                            : "RESPOND & ADAPT"}
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
                <section className="setup">
                  <div>
                    <span className="eyebrow">READY WHEN YOU ARE</span>
                    <h2>{names[kind]}</h2>
                    <p>
                      {kind === "pursuit"
                        ? "Follow the dot without tapping. Gaze accuracy is not measured."
                        : descriptions[kind]}
                    </p>
                  </div>
                  <div className="setup-fields">
                    <label>
                      Eye
                      <select
                        value={eye}
                        onChange={(event) => setEye(event.target.value as Eye)}
                      >
                        {["Left", "Right", "Both"].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Duration
                      <select
                        value={
                          customDuration ? "custom" : configuration.duration
                        }
                        onChange={(event) => {
                          const custom = event.target.value === "custom";
                          setCustomDuration(custom);
                          if (!custom)
                            setting("duration", Number(event.target.value));
                        }}
                      >
                        {[1, 2, 3, 5, 10, 15].map((value) => (
                          <option key={value} value={value * 60}>
                            {value} {value === 1 ? "minute" : "minutes"}
                          </option>
                        ))}
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    {customDuration && (
                      <label>
                        Custom duration (seconds)
                        <input
                          type="number"
                          min="10"
                          max="3600"
                          value={configuration.duration}
                          onChange={(event) =>
                            setting("duration", Number(event.target.value))
                          }
                        />
                      </label>
                    )}
                  </div>
                  <div className="actions">
                    <button
                      aria-expanded={editing}
                      aria-controls="exercise-settings"
                      onClick={() => setEditing(!editing)}
                    >
                      {editing ? "Hide" : "Adjust"} exercise settings
                    </button>
                    <button
                      className="primary"
                      disabled={!ready}
                      onClick={() => start()}
                    >
                      Begin practice <span>→</span>
                    </button>
                  </div>
                  {editing && (
                    <div id="exercise-settings" className="settings-grid">
                      {kind === "pursuit" && (
                        <label>
                          Motion path
                          <select
                            value={configuration.pattern}
                            onChange={(event) =>
                              setting("pattern", event.target.value)
                            }
                          >
                            {[
                              "Horizontal",
                              "Vertical",
                              "Circle",
                              "Figure eight",
                              "Wandering",
                            ].map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {(
                        [
                          ["size", "Target diameter (CSS px)", 8, 120, 1],
                          ["speed", "Motion speed (cycles/sec)", 0.02, 1, 0.02],
                          ["contrast", "Stimulus contrast", 0.03, 1, 0.01],
                          ["complexity", "Path complexity", 1, 5, 1],
                          [
                            "exposure",
                            "Target exposure (seconds)",
                            0.5,
                            10,
                            0.5,
                          ],
                          [
                            "jumpPause",
                            "Pause between jumps (seconds)",
                            0,
                            10,
                            0.5,
                          ],
                          ["jumpDistance", "Jump distance", 0.1, 1, 0.1],
                          [
                            "distance",
                            "Viewing distance (cm, self-reported)",
                            15,
                            200,
                            1,
                          ],
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
                            {label} · {configuration[key]}
                            <input
                              type="range"
                              min={min}
                              max={max}
                              step={step}
                              value={configuration[key]}
                              onChange={(event) =>
                                setting(key, Number(event.target.value))
                              }
                            />
                          </label>
                        ))}
                      {kind !== "contrast" && (
                        <label>
                          Target color
                          <input
                            type="color"
                            value={configuration.foreground}
                            onChange={(event) =>
                              setting("foreground", event.target.value)
                            }
                          />
                        </label>
                      )}
                      <label>
                        Background
                        <input
                          type="color"
                          value={configuration.background}
                          onChange={(event) =>
                            setting("background", event.target.value)
                          }
                        />
                      </label>
                      {kind === "visual" && (
                        <label>
                          Visual task
                          <select
                            value={configuration.stimulus}
                            onChange={(event) =>
                              setting("stimulus", event.target.value)
                            }
                          >
                            {["Opening", "Orientation", "Shape"].map(
                              (value) => (
                                <option key={value}>{value}</option>
                              ),
                            )}
                          </select>
                        </label>
                      )}
                      {kind === "contrast" && (
                        <label>
                          Contrast task
                          <select
                            value={configuration.contrastStimulus}
                            onChange={(event) =>
                              setting("contrastStimulus", event.target.value)
                            }
                          >
                            <option>Grating</option>
                            <option>Shape</option>
                          </select>
                        </label>
                      )}
                      {kind === "saccades" && (
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={configuration.tapConfirm}
                            onChange={(event) =>
                              setting("tapConfirm", event.target.checked)
                            }
                          />
                          Show saccade acknowledgement button
                        </label>
                      )}
                    </div>
                  )}
                  <p className="fine">
                    Eye selection is self-reported; the app cannot verify
                    occlusion. Target size uses CSS pixels, not calibrated
                    visual angle.
                  </p>
                </section>
                <aside className="safety">
                  <span>◎</span>
                  <div>
                    <h3>Practice, with perspective.</h3>
                    <p>
                      An experimental tool, not a validated treatment. Follow
                      your eye-care professional’s advice on patching and
                      schedules. Practice seated, never while walking, driving,
                      or doing hazardous activities. Stop if uncomfortable.
                    </p>
                  </div>
                </aside>
              </>
            )}
            {tab === "Progress" && <Progress data={data} persist={persist} />}
            {tab === "Routines" && (
              <Routines
                data={data}
                eye={eye}
                setEye={setEye}
                routine={routine}
                setRoutine={setRoutine}
                persist={persist}
                start={start}
              />
            )}
            {tab === "Settings" && (
              <>
                <section className="panel">
                  <h2>Schedule & comfort</h2>
                  <p>
                    These are scheduling preferences, not clinically validated
                    treatment doses.
                  </p>
                  <div className="settings-grid">
                    {(
                      [
                        ["goal", "Daily goal (minutes)", 1, 240],
                        ["rest", "Default break (seconds)", 0, 3600],
                        [
                          "reminder",
                          "Rest reminder (active minutes; 0 disables)",
                          0,
                          60,
                        ],
                      ] as const
                    ).map(([key, label, min, max]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="number"
                          min={min}
                          max={max}
                          value={data.preferences[key]}
                          onChange={(event) =>
                            persist({
                              ...data,
                              preferences: {
                                ...data.preferences,
                                [key]: bounded(
                                  Number(event.target.value),
                                  min,
                                  max,
                                  key === "goal" ? 30 : 0,
                                ),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                    {(
                      [
                        ["manual", "Manual breaks"],
                        ["sound", "Optional sound / vibration at rest end"],
                        ["reducedMotion", "Gentler pursuit motion"],
                        ["highContrast", "High-contrast controls"],
                      ] as const
                    ).map(([key, label]) => (
                      <label className="check" key={key}>
                        <input
                          type="checkbox"
                          checked={data.preferences[key]}
                          onChange={(event) =>
                            persist({
                              ...data,
                              preferences: {
                                ...data.preferences,
                                [key]: event.target.checked,
                              },
                            })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <h2>Keep your practice close</h2>
                  <p>
                    On iPhone Safari, tap Share, then Add to Home Screen. Open
                    once online to cache the app. Offline use starts after
                    installation finishes.
                  </p>
                  <p>
                    Data stays in this browser. Private browsing, clearing
                    website data, or storage eviction can remove it. Export
                    regular backups.
                  </p>
                  <button onClick={exportData}>Export all data</button>
                  <label>
                    Import backup (merges records and restores preferences)
                    <input
                      type="file"
                      accept="application/json"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        void file
                          .text()
                          .then((text) => {
                            persist(
                              mergeBackup(state.current, JSON.parse(text)),
                            );
                            setFeedback(
                              "Backup imported. Existing records were preserved.",
                            );
                          })
                          .catch(() =>
                            setError(
                              "This backup is invalid. No data was imported.",
                            ),
                          );
                      }}
                    />
                  </label>
                  <p role="status">{feedback}</p>
                </section>
                <section className="panel">
                  <h2>What this app can tell you</h2>
                  <p>
                    It records practice time and task responses. Better scores
                    do not establish improved amblyopia, visual acuity, or eye
                    health. Consumer displays are not medically calibrated.
                    Brightness, distance, ambient light, and screen size affect
                    results.
                  </p>
                  <p>
                    There is no eye tracking or occlusion detection. Pursuit and
                    saccade practice have no gaze-accuracy score. Contrast is a
                    rendering setting, not a clinical contrast sensitivity
                    measurement.
                  </p>
                  <p>
                    Use comfortable brightness. Follow your clinician’s guidance
                    for monocular patching. Sound, vibration, and wake lock may
                    be unavailable on your browser.
                  </p>
                </section>
              </>
            )}
          </main>
          <footer>
            <span>万華鏡 · MANGEKYO</span>
            <span>Small moments of focused practice.</span>
          </footer>
          <nav aria-label="Main navigation">
            {(["Practice", "Progress", "Routines", "Settings"] as const).map(
              (label) => (
                <button
                  aria-current={tab === label ? "page" : undefined}
                  className={tab === label ? "active" : ""}
                  key={label}
                  onClick={() => {
                    setTab(label);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                >
                  <Icon name={label} />
                  {label}
                </button>
              ),
            )}
          </nav>
        </>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
