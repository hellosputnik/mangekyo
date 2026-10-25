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
import { totalForDate } from "./analytics/totals";
import { VisualExercise } from "./exercises/exercise";
import { advanceRoutine, advanceBreak } from "./engine/routines";
import { mergeBackup } from "./persistence/backup";
import { Routines } from "./components/Routines";
import { Progress } from "./components/Progress";
import { Icon } from "./components/Icon";
import { LocalizationContext, useLocalization } from "./i18n/react";
import {
  createLocalization,
  readLanguageFromUrl,
  type MessageKey,
  type LanguagePreference,
} from "./i18n/locale";
import "./style.css";
function App() {
  const requestedLanguage = useRef(
    readLanguageFromUrl(location.search),
  ).current;
  const [data, setData] = useState<Data>(() => {
    const data = initialData();
    if (requestedLanguage) data.preferences.language = requestedLanguage;
    return data;
  });
  const localization = useLocalization(data.preferences.language);
  const {
    t,
    language,
    number,
    percent,
    time: formatTime,
    exerciseName,
    exerciseDescription,
    eyeLabel,
    optionLabel,
    statusLabel,
  } = localization;
  const state = useRef(data);
  state.current = data;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");
  const [tab, setTab] = useState("Practice");
  const [kind, setKind] = useState<ExerciseKind>("pursuit");
  const [eye, setEye] = useState<Eye>("Left");
  const [configuration, setConfiguration] = useState(defaults);
  const [editing, setEditing] = useState(false);
  const [customDuration, setCustomDuration] = useState(false);
  const [, refresh] = useState(0);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [feedback, setFeedback] = useState<MessageKey | "">("");
  const [routine, setRoutine] = useState<Routine>(() => ({
    id: crypto.randomUUID(),
    name: t("routine.defaultName"),
    steps: [
      { kind: "pursuit", duration: 300 },
      { kind: "visual", duration: 300 },
      { kind: "contrast", duration: 300 },
    ],
    rest: 60,
    manual: false,
  }));
  const previousLanguage = useRef(language);
  useEffect(() => {
    if (previousLanguage.current !== language) {
      const previous = createLocalization(previousLanguage.current);
      setRoutine((draft) => {
        for (const key of ["routine.defaultName", "routine.newName"] as const) {
          if (draft.name === previous.t(key)) return { ...draft, name: t(key) };
        }
        return draft;
      });
      previousLanguage.current = language;
    }
  }, [language, t]);
  const timer = useRef<ActiveTimer | null>(null);
  const exercise = useRef<VisualExercise | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const trialStart = useRef(0);
  const lastSave = useRef(0);
  const lastReminder = useRef(0);
  const persist = (next: Data) => {
    state.current = next;
    setData({ ...next });
    void save(next).catch(() => setError("error.save"));
  };
  useEffect(() => {
    void load()
      .then((value) => {
        if (requestedLanguage) value.preferences.language = requestedLanguage;
        setData(value);
        state.current = value;
        if (requestedLanguage)
          void save(value).catch(() => setError("error.save"));
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
        setError("error.storage");
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
            void save(state.current).catch(() => setError("error.checkpoint"));
          }
          const reminder = state.current.preferences.reminder * 60000;
          if (
            reminder > 0 &&
            session.activeMilliseconds - lastReminder.current >= reminder
          ) {
            lastReminder.current = session.activeMilliseconds;
            pause();
            setFeedback("feedback.rest");
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
          void save(state.current).catch(() => setError("error.checkpoint"));
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
    setFeedback(correct ? "feedback.correct" : "feedback.next");
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
    <LocalizationContext.Provider value={localization}>
      <div
        className={data.preferences.highContrast ? "app high-contrast" : "app"}
      >
        {!current && (
          <header>
            <a className="brand" href="#" onClick={() => setTab("Practice")}>
              <span className="brand-mark">✳</span> mangekyo
              <span className="brand-caption">{t("brand.caption")}</span>
            </a>
            {offline && (
              <span className="connection" role="status">
                {t("connection.offline")}
              </span>
            )}
          </header>
        )}
        {error && (
          <div role="alert" className="notice">
            {t(error)}
          </div>
        )}
        {update && !current && (
          <div className="notice">
            {t("update.ready")}{" "}
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
              {t("update.action")}
            </button>
          </div>
        )}
        {current ? (
          <main className="training">
            <div className="training-top">
              <div>
                <span className="eyebrow">
                  {eyeLabel(current.eye)} · {statusLabel(current.status)}
                </span>
                <h2>{exerciseName(current.kind)}</h2>
              </div>
              <span className="countdown">
                {formatTime(
                  Math.max(
                    0,
                    current.configuration.duration * 1000 -
                      current.activeMilliseconds,
                  ),
                )}
                <small>{t("session.remaining")}</small>
              </span>
            </div>
            <div className="canvas-wrap">
              <canvas
                ref={canvas}
                aria-label={t("session.stimulus", {
                  exercise: exerciseName(current.kind),
                })}
              />
              {current.status !== "running" && (
                <div className="pause-overlay">
                  <span className="orb">Ⅱ</span>
                  <h2>
                    {current.status === "interrupted"
                      ? t("session.welcome")
                      : t("session.takeTime")}
                  </h2>
                  <p>
                    {current.status === "interrupted"
                      ? t("session.interrupted")
                      : t("session.paused")}
                  </p>
                  <button className="primary" onClick={resume}>
                    {current.status === "interrupted"
                      ? t("session.confirmResume")
                      : t("session.resume")}
                  </button>
                </div>
              )}
            </div>
            <div className="exercise-info">
              <span>
                {t("session.activeTime", {
                  time: formatTime(current.activeMilliseconds),
                })}
              </span>
              <span>
                {current.kind === "pursuit"
                  ? t("session.pursuitHint")
                  : current.kind === "saccades"
                    ? t("session.saccadeHint")
                    : t("session.levelResponses", {
                        level: number(current.difficulty + 1),
                        count: number(current.trials.length),
                      })}
              </span>
            </div>
            {(current.kind === "visual" || current.kind === "contrast") && (
              <div className="answers">
                {(current.kind === "visual"
                  ? [
                      t("answer.right"),
                      t("answer.down"),
                      t("answer.left"),
                      t("answer.up"),
                    ]
                  : [
                      t("answer.topLeft"),
                      t("answer.topRight"),
                      t("answer.bottomLeft"),
                      t("answer.bottomRight"),
                    ]
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
            {current.kind === "saccades" &&
              current.configuration.tapConfirm && (
                <button onClick={() => setFeedback("feedback.target")}>
                  {t("session.found")}
                </button>
              )}
            <div className="feedback" role="status">
              {feedback ? t(feedback) : ""}
            </div>
            <div className="training-controls">
              <button
                onClick={() => pause()}
                disabled={current.status !== "running"}
              >
                Ⅱ {t("session.pause")}
              </button>
              <button className="primary" onClick={() => finish()}>
                {t("session.finish")}
              </button>
              <button onClick={() => finish(true)}>{t("session.stop")}</button>
            </div>
            <p className="fine">{t("session.safety")}</p>
          </main>
        ) : data.breakState ? (
          <main className="rest">
            <span className="eyebrow">{t("rest.eyebrow")}</span>
            <div className="rest-art">◌</div>
            <h1>{t("rest.title")}</h1>
            <p>{t("rest.description")}</p>
            <div className="rest-clock">
              {data.breakState.manual
                ? t("rest.manualTime")
                : formatTime(data.breakState.remaining * 1000)}
            </div>
            <p>
              {data.run
                ? t("rest.next", {
                    exercise: exerciseName(
                      data.run.routine.steps[data.run.index].kind,
                    ),
                  })
                : t("rest.saved")}
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
                {t("rest.extend")}
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
                {data.breakState.manual
                  ? t("rest.countdown")
                  : t("rest.manual")}
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
              {data.run ? t("rest.startNext") : t("rest.back")}
            </button>
            {data.run && (
              <button
                onClick={() =>
                  persist({ ...data, run: null, breakState: null })
                }
              >
                {t("rest.endRoutine")}
              </button>
            )}
            <p className="fine">{t("rest.note")}</p>
          </main>
        ) : (
          <>
            <main className="content">
              <div className="page-heading">
                <span className="eyebrow">{t("page.eyebrow")}</span>
                <h1>
                  {tab === "Practice"
                    ? t("page.Practice.title")
                    : tab === "Progress"
                      ? t("page.Progress.title")
                      : tab === "Routines"
                        ? t("page.Routines.title")
                        : t("page.Settings.title")}
                </h1>
                <p>
                  {tab === "Practice"
                    ? t("page.Practice.description")
                    : tab === "Progress"
                      ? t("page.Progress.description")
                      : tab === "Routines"
                        ? t("page.Routines.description")
                        : t("page.Settings.description")}
                </p>
              </div>
              {tab === "Practice" && (
                <>
                  <section className="daily">
                    <div>
                      <span className="eyebrow">{t("daily.title")}</span>
                      <div className="daily-number">
                        {number(minutes, 1)}{" "}
                        <span>
                          / {number(data.preferences.goal)} {t("unit.minutes")}
                        </span>
                      </div>
                      <p>
                        {t("daily.remaining", {
                          minutes: number(
                            Math.max(0, data.preferences.goal - minutes),
                            1,
                          ),
                        })}
                      </p>
                    </div>
                    <div
                      className="progress-ring"
                      style={{
                        background: `conic-gradient(var(--accent) ${Math.min(100, (minutes / data.preferences.goal) * 100)}%, var(--surface-raised) 0)`,
                      }}
                    >
                      <span>
                        {number(
                          Math.round((minutes / data.preferences.goal) * 100),
                        )}
                        <small>%</small>
                      </span>
                    </div>
                    <div className="daily-footer">{t("daily.note")}</div>
                  </section>
                  <div className="section-label">
                    <h2>{t("practice.choose")}</h2>
                    <span>
                      {t("practice.exerciseCount", { count: number(4) })}
                    </span>
                  </div>
                  <div className="exercise-grid">
                    {(Object.keys(names) as ExerciseKind[]).map(
                      (item, index) => (
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
                              {exerciseName(item)} <span>↗</span>
                            </h3>
                            <p>{exerciseDescription(item)}</p>
                            <small>
                              {item === "pursuit" || item === "saccades"
                                ? t("practice.follow")
                                : t("practice.respond")}
                            </small>
                          </div>
                        </button>
                      ),
                    )}
                  </div>
                  <section className="setup">
                    <div>
                      <span className="eyebrow">{t("practice.ready")}</span>
                      <h2>{exerciseName(kind)}</h2>
                      <p>
                        {kind === "pursuit"
                          ? t("practice.pursuitDescription")
                          : exerciseDescription(kind)}
                      </p>
                    </div>
                    <div className="setup-fields">
                      <label>
                        {t("practice.eye")}
                        <select
                          value={eye}
                          onChange={(event) =>
                            setEye(event.target.value as Eye)
                          }
                        >
                          {["Left", "Right", "Both"].map((value) => (
                            <option key={value} value={value}>
                              {optionLabel(value)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("practice.duration")}
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
                              {value === 1
                                ? t("practice.minute")
                                : t("practice.minutes", {
                                    count: number(value),
                                  })}
                            </option>
                          ))}
                          <option value="custom">{t("practice.custom")}</option>
                        </select>
                      </label>
                      {customDuration && (
                        <label>
                          {t("practice.customSeconds")}
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
                        {editing ? t("practice.hide") : t("practice.adjust")}
                      </button>
                      <button
                        className="primary"
                        disabled={!ready}
                        onClick={() => start()}
                      >
                        {t("practice.begin")} <span>→</span>
                      </button>
                    </div>
                    {editing && (
                      <div id="exercise-settings" className="settings-grid">
                        {kind === "pursuit" && (
                          <label>
                            {t("config.pattern")}
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
                            [
                              "jumpDistance",
                              t("config.jumpDistance"),
                              0.1,
                              1,
                              0.1,
                            ],
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
                                onChange={(event) =>
                                  setting(key, Number(event.target.value))
                                }
                              />
                            </label>
                          ))}
                        {kind !== "contrast" && (
                          <label>
                            {t("config.foreground")}
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
                          {t("config.background")}
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
                            {t("config.visualTask")}
                            <select
                              value={configuration.stimulus}
                              onChange={(event) =>
                                setting("stimulus", event.target.value)
                              }
                            >
                              {["Opening", "Orientation", "Shape"].map(
                                (value) => (
                                  <option key={value} value={value}>
                                    {optionLabel(value)}
                                  </option>
                                ),
                              )}
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
                              <option value="Grating">
                                {t("stimulus.Grating")}
                              </option>
                              <option value="Shape">
                                {t("stimulus.Shape")}
                              </option>
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
                            {t("config.tapConfirm")}
                          </label>
                        )}
                      </div>
                    )}
                    <p className="fine">{t("practice.eyeNote")}</p>
                  </section>
                  <aside className="safety">
                    <span>◎</span>
                    <div>
                      <h3>{t("safety.title")}</h3>
                      <p>{t("safety.summary")}</p>
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
                  <section className="panel language-settings">
                    <label>
                      {t("language.title")}
                      <select
                        value={data.preferences.language}
                        onChange={(event) => {
                          const preference = event.target
                            .value as LanguagePreference;
                          persist({
                            ...state.current,
                            preferences: {
                              ...state.current.preferences,
                              language: preference,
                            },
                          });
                          const url = new URL(location.href);
                          url.searchParams.delete("lang");
                          history.replaceState(null, "", url);
                        }}
                      >
                        <option value="system">{t("language.system")}</option>
                        <option value="en" lang="en">
                          English
                        </option>
                        <option value="vi" lang="vi">
                          Tiếng Việt
                        </option>
                      </select>
                    </label>
                    <p>{t("language.note")}</p>
                  </section>
                  <section className="panel">
                    <h2>{t("settings.schedule")}</h2>
                    <p>{t("settings.scheduleNote")}</p>
                    <div className="settings-grid">
                      {(
                        [
                          ["goal", t("settings.goal"), 1, 240],
                          ["rest", t("settings.rest"), 0, 3600],
                          ["reminder", t("settings.reminder"), 0, 60],
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
                          ["manual", t("routine.manual")],
                          ["sound", t("settings.sound")],
                          ["reducedMotion", t("settings.reducedMotion")],
                          ["highContrast", t("settings.highContrast")],
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
                    <h2>{t("settings.data")}</h2>
                    <p>{t("settings.install")}</p>
                    <p>{t("settings.storageNote")}</p>
                    <button onClick={exportData}>{t("settings.export")}</button>
                    <label>
                      {t("settings.import")}
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
                              setFeedback("feedback.imported");
                            })
                            .catch(() => setError("error.backup"));
                        }}
                      />
                    </label>
                    <p role="status">{feedback ? t(feedback) : ""}</p>
                  </section>
                  <section className="panel">
                    <h2>{t("settings.limits")}</h2>
                    <p>{t("settings.limitsPerformance")}</p>
                    <p>{t("settings.limitsTracking")}</p>
                    <p>{t("settings.limitsComfort")}</p>
                  </section>
                </>
              )}
            </main>
            <footer>
              <span>万華鏡 · MANGEKYO</span>
              <span>{t("footer.note")}</span>
            </footer>
            <nav aria-label={t("nav.label")}>
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
                    {t(`nav.${label}`)}
                  </button>
                ),
              )}
            </nav>
          </>
        )}
      </div>
    </LocalizationContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
