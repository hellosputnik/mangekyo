import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  initialData,
  validate,
  localDate,
  isTouchExercise,
  isResponseExercise,
  type Configuration,
  type Data,
  type ExerciseKind,
  type Eye,
  type Routine,
  type Session,
} from "./engine/model";
import { ActiveTimer } from "./engine/timer";
import {
  playAnswerConfirmation,
  playPracticeFeedback,
  unlockPracticeAudio,
} from "./engine/feedback";
import {
  initialPracticeSetups,
  selectPracticeMode,
  updatePracticeSetting,
} from "./engine/practice";
import { load, save } from "./persistence/store";
import { totalForDate } from "./analytics/totals";
import type { Exercise } from "./exercises/exercise";
import { createExercise } from "./exercises/factory";
import { TouchExercise, type Point } from "./exercises/touch";
import { highestTouchLevel, type TouchCue } from "./exercises/touch-challenge";
import {
  TouchChallenge,
  TouchChallengeNotice,
} from "./components/TouchChallenge";
import { summarizeTouch } from "./analytics/touch";
import { currentPursuitPath } from "./exercises/pursuit";
import { maximumVisualDifficulty } from "./exercises/visual";
import { recordResponse, responseScore } from "./exercises/responses";
import { AnswerFeedback, type AnswerResult } from "./components/AnswerFeedback";
import { advanceRoutine, advanceBreak } from "./engine/routines";
import { mergeBackup } from "./persistence/backup";
import { Routines } from "./components/Routines";
import { Navigation, type Page } from "./components/Navigation";
import { Practice } from "./components/Practice";
import { SessionControls } from "./components/SessionControls";
import {
  LandscapeHint,
  shouldRecommendLandscape,
} from "./components/LandscapeHint";
import { DurationControl } from "./components/controls/DurationControl";
import { NumberStepper } from "./components/controls/NumberStepper";
import { ToggleSwitch } from "./components/controls/ToggleSwitch";
import { Statistics } from "./components/Statistics";
import {
  resetStatistics,
  undoStatisticsReset,
} from "./engine/statistics-reset";
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
    time: formatTime,
    exerciseName,
    eyeLabel,
    statusLabel,
    patternLabel,
    percent,
  } = localization;
  const state = useRef(data);
  state.current = data;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");
  const [tab, setTab] = useState<Page>("Practice");
  const [kind, setKind] = useState<ExerciseKind>("pursuit");
  const [eye, setEye] = useState<Eye>("Left");
  const [practiceSetups, setPracticeSetups] = useState(initialPracticeSetups);
  const configuration = practiceSetups[kind].configuration;
  const [, refresh] = useState(0);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [feedback, setFeedback] = useState<MessageKey | "">("");
  const [touchCue, setTouchCue] = useState<{
    value: TouchCue;
    sequence: number;
  } | null>(null);
  const touchCueSequence = useRef(0);
  useEffect(() => {
    if (!touchCue) return;
    const timeout = window.setTimeout(() => setTouchCue(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [touchCue?.sequence]);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  useEffect(() => {
    if (!answerResult?.highlight) return;
    const timeout = window.setTimeout(() => {
      setAnswerResult((previous) =>
        previous ? { ...previous, highlight: false } : null,
      );
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [answerResult?.sequence]);
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
  const exercise = useRef<Exercise | null>(null);
  const touchPointer = useRef<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const trialStart = useRef(0);
  const lastSave = useRef(0);
  const lastReminder = useRef(0);
  const persist = (next: Data) => {
    state.current = next;
    setData({ ...next });
    void save(next).catch(() => setError("error.save"));
  };
  const consumeTouchCues = () => {
    if (!(exercise.current instanceof TouchExercise)) return false;
    const cues = exercise.current.drainCues();
    if (!cues.length) return false;
    const cue =
      cues
        .slice()
        .reverse()
        .find(
          (value) =>
            value.kind === "level-up" ||
            value.kind === "mastered" ||
            value.kind === "level-down",
        ) ?? cues.at(-1)!;
    setTouchCue({ value: cue, sequence: ++touchCueSequence.current });
    const celebratory = cue.kind === "level-up" || cue.kind === "mastered";
    if (
      state.current.preferences.answerSound &&
      (celebratory || cue.kind === "milestone")
    )
      playPracticeFeedback(celebratory ? "level" : "milestone");
    if (celebratory || cue.kind === "level-down") persist(state.current);
    return celebratory || cue.kind === "milestone";
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
  const releaseTouch = () => {
    const pointer = touchPointer.current;
    touchPointer.current = null;
    if (exercise.current instanceof TouchExercise) {
      exercise.current.release(true);
      exercise.current.drainCues();
    }
    if (pointer !== null && canvas.current?.hasPointerCapture(pointer))
      canvas.current.releasePointerCapture(pointer);
  };
  const pause = (interrupted = false, awaitingTouch = false) => {
    timer.current?.pause(interrupted);
    releaseTouch();
    if (state.current.current?.kind === "follow")
      state.current.current.awaitingTouch = awaitingTouch && !interrupted;
    setAnswerResult(null);
    if (interrupted || !awaitingTouch) setTouchCue(null);
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
  const score = useMemo(
    () => responseScore(current?.trials ?? []),
    [current?.id, current?.trials.length],
  );
  useEffect(() => {
    if (!current) return;
    const renderer = createExercise(current);
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
  const finish = () => {
    const latest = state.current;
    const session = latest.current;
    if (!session) return;
    (timer.current ?? new ActiveTimer(session)).finish();
    releaseTouch();
    if (session.kind === "follow") session.awaitingTouch = false;
    latest.sessions = [
      ...latest.sessions.filter((item) => item.id !== session.id),
      structuredClone(session),
    ];
    latest.levels[session.kind] = session.difficulty;
    latest.current = null;
    setAnswerResult(null);
    setFeedback("");
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
          } else {
            timer.current?.checkpoint();
            if (exercise.current instanceof TouchExercise)
              exercise.current.sample();
            consumeTouchCues();
          }
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
          if (exercise.current instanceof TouchExercise) {
            const resized = exercise.current.setViewport(
              bounds.width,
              bounds.height,
            );
            if (
              resized &&
              session.kind === "follow" &&
              touchPointer.current !== null
            )
              pause(false, true);
          }
          if (
            session.kind === "visual" &&
            bounds.width > 40 &&
            bounds.height > 40
          )
            session.difficulty = Math.min(
              session.difficulty,
              maximumVisualDifficulty(session.configuration, {
                width: bounds.width,
                height: bounds.height,
                pixelRatio: ratio,
              }),
            );
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
            consumeTouchCues();
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
  }, [current?.id, current?.status, current?.difficulty]);
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
    duration = practiceSetups[selected].configuration.duration,
    selectedEye = eye,
  ) => {
    if (!ready || document.hidden || state.current.current) return;
    const selectedConfiguration = practiceSetups[selected].configuration;
    const settings = validate({
      ...selectedConfiguration,
      duration,
      speed: data.preferences.reducedMotion
        ? Math.min(selectedConfiguration.speed, 0.08)
        : selectedConfiguration.speed,
      ...(selected === "follow"
        ? { gentleMotion: data.preferences.reducedMotion }
        : {}),
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
      ...(selected === "follow" ? { awaitingTouch: true } : {}),
    };
    timer.current = new ActiveTimer(session);
    if (selected !== "follow") timer.current.resume();
    if (state.current.preferences.answerSound) unlockPracticeAudio();
    lastReminder.current = 0;
    setFeedback("");
    setAnswerResult(null);
    setTouchCue(null);
    persist({ ...state.current, current: session, breakState: null });
  };
  const resume = () => {
    if (!document.hidden) {
      if (state.current.current?.kind === "follow") {
        state.current.current.status = "paused";
        state.current.current.awaitingTouch = true;
      } else timer.current?.resume();
      persist(state.current);
    }
  };
  const answer = (choice: number) => {
    if (
      !current ||
      current.status !== "running" ||
      !exercise.current ||
      document.hidden
    )
      return;
    timer.current?.checkpoint();
    if (current.activeMilliseconds >= current.configuration.duration * 1000) {
      finish();
      return;
    }
    const bounds = canvas.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 40 || bounds.height <= 40) return;
    const correct = exercise.current.answer?.(choice);
    if (correct === undefined) return;
    const result = recordResponse(
      current,
      correct,
      current.activeMilliseconds - trialStart.current,
      {
        width: bounds.width,
        height: bounds.height,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 3),
      },
    );
    if (!result) return;
    trialStart.current = current.activeMilliseconds;
    setAnswerResult({
      choice,
      correct,
      sequence: current.trials.length,
      currentRun: result.currentRun,
      enlarged: result.enlarged,
      highlight: true,
    });
    setFeedback("");
    if (correct && state.current.preferences.answerSound)
      playAnswerConfirmation();
    persist(state.current);
  };
  const touchPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const touchDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const session = state.current.current;
    const renderer = exercise.current;
    if (
      !session ||
      !(renderer instanceof TouchExercise) ||
      document.hidden ||
      !event.isPrimary ||
      event.button !== 0 ||
      touchPointer.current !== null
    )
      return;
    if (
      session.status !== "running" &&
      !(
        session.kind === "follow" &&
        session.status === "paused" &&
        session.awaitingTouch
      )
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    renderer.setViewport(bounds.width, bounds.height);
    if (!renderer.pointerDown(touchPoint(event))) return;
    if (state.current.preferences.answerSound) unlockPracticeAudio();
    event.preventDefault();
    touchPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (session.kind === "follow") {
      session.awaitingTouch = false;
      timer.current?.resume();
      setFeedback("");
    }
    persist(state.current);
  };
  const touchMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      touchPointer.current !== event.pointerId ||
      document.hidden ||
      state.current.current?.status !== "running" ||
      !(exercise.current instanceof TouchExercise)
    )
      return;
    event.preventDefault();
    timer.current?.checkpoint();
    exercise.current.pointerMove(touchPoint(event));
  };
  const touchUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      touchPointer.current !== event.pointerId ||
      !(exercise.current instanceof TouchExercise)
    )
      return;
    event.preventDefault();
    const session = state.current.current;
    if (!session || document.hidden || session.status !== "running") {
      pause(true);
      return;
    }
    timer.current?.checkpoint();
    if (session.activeMilliseconds >= session.configuration.duration * 1000) {
      finish();
      return;
    }
    const result = exercise.current.pointerUp(touchPoint(event));
    if (session.kind === "tap") setTouchCue(null);
    const playedCue = consumeTouchCues();
    touchPointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (session.kind === "follow") pause(false, true);
    else {
      if (result) {
        setAnswerResult({
          choice: -1,
          correct: result.correct,
          sequence: session.trials.length,
          currentRun: result.currentRun,
          enlarged: false,
          highlight: true,
          retry: true,
        });
        setFeedback("");
        if (
          result.correct &&
          state.current.preferences.answerSound &&
          !playedCue
        )
          playAnswerConfirmation();
      }
      persist(state.current);
    }
  };
  const touchCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (touchPointer.current !== event.pointerId) return;
    if (state.current.current?.kind === "follow")
      pause(document.hidden, !document.hidden);
    else {
      releaseTouch();
      persist(state.current);
    }
  };
  const navigate = (page: Page) => {
    setTab(page);
    setFeedback("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const minutes = totalForDate(data) / 60000;
  const lastSession = data.sessions.at(-1);
  const lastScore =
    data.breakState && lastSession && isResponseExercise(lastSession.kind)
      ? responseScore(lastSession.trials)
      : null;
  const touchSummary =
    current?.kind === "follow" ? summarizeTouch([current]) : null;
  const bestTouchLevel = useMemo(
    () =>
      current && isTouchExercise(current.kind)
        ? highestTouchLevel(
            [
              ...data.sessions.filter(
                (session) => session.kind === current.kind,
              ),
              current,
            ],
            data.levels[current.kind],
          )
        : 0,
    [
      data.sessions,
      current?.id,
      current?.challenge?.highestLevel,
      current?.difficulty,
    ],
  );
  const lastTouchSummary =
    data.breakState && lastSession?.kind === "follow"
      ? summarizeTouch([lastSession])
      : null;
  const setting = (
    key: keyof Configuration,
    value: string | number | boolean,
  ) =>
    setPracticeSetups((previous) =>
      updatePracticeSetting(previous, kind, key, value),
    );
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
        className={`app ${data.preferences.highContrast ? "high-contrast" : ""} ${current ? "training-app" : ""}`}
      >
        {!current && (
          <header>
            <a className="brand" href="#" onClick={() => navigate("Practice")}>
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
            <span>{t(error)}</span>
            <button
              type="button"
              onClick={ready ? exportData : () => location.reload()}
            >
              {t(ready ? "settings.export" : "common.retry")}
            </button>
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
        {!ready && !error ? (
          <main className="loading-state" role="status">
            <span className="brand-mark" aria-hidden="true">
              ✳
            </span>
            <p>{t("app.loading")}</p>
          </main>
        ) : current ? (
          <main
            className={`training ${current.kind === "visual" || current.kind === "contrast" ? "has-answers" : ""} ${isTouchExercise(current.kind) ? "has-touch-challenge" : ""}`}
          >
            <div className="training-top">
              <div>
                <span className="eyebrow">
                  {eyeLabel(current.eye)} ·{" "}
                  {current.kind === "follow" &&
                  current.awaitingTouch &&
                  current.status === "paused"
                    ? t("touch.ready")
                    : statusLabel(current.status)}
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
            {isTouchExercise(current.kind) && (
              <TouchChallenge
                session={current}
                bestLevel={bestTouchLevel}
                points={
                  current.kind === "tap"
                    ? score.points
                    : Math.floor(
                        (touchSummary?.onTargetMilliseconds ?? 0) / 1000,
                      )
                }
                sound={data.preferences.answerSound}
                onSound={() => {
                  const enabled = !state.current.preferences.answerSound;
                  if (enabled) unlockPracticeAudio();
                  persist({
                    ...state.current,
                    preferences: {
                      ...state.current.preferences,
                      answerSound: enabled,
                    },
                  });
                }}
                onEasier={() => {
                  if (!(exercise.current instanceof TouchExercise)) return;
                  if (state.current.current?.status === "running")
                    pause(false, state.current.current.kind === "follow");
                  exercise.current.makeEasier();
                  consumeTouchCues();
                  persist(state.current);
                }}
              />
            )}
            <div className="canvas-wrap">
              <canvas
                ref={canvas}
                onContextMenu={(event) => {
                  if (isTouchExercise(current.kind)) event.preventDefault();
                }}
                onPointerDown={touchDown}
                onPointerMove={touchMove}
                onPointerUp={touchUp}
                onPointerCancel={touchCancel}
                onLostPointerCapture={touchCancel}
                aria-describedby={
                  isTouchExercise(current.kind)
                    ? "touch-instructions"
                    : undefined
                }
                aria-label={t("session.stimulus", {
                  exercise: exerciseName(current.kind),
                })}
              />
              {current.kind === "follow" &&
                current.status === "paused" &&
                current.awaitingTouch && (
                  <div className="touch-ready" aria-hidden="true">
                    {t("touch.holdHandle")}
                  </div>
                )}
              {current.status !== "running" &&
                !(
                  current.kind === "follow" &&
                  current.status === "paused" &&
                  current.awaitingTouch
                ) && (
                  <div className="pause-overlay">
                    <span className="orb" aria-hidden="true">
                      Ⅱ
                    </span>
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
                  ? `${patternLabel(currentPursuitPath(current.configuration, current.activeMilliseconds / 1000))} · ${t("session.pursuitHint")}`
                  : current.kind === "saccades"
                    ? t("session.saccadeHint")
                    : touchSummary
                      ? t("touch.liveResult", {
                          accuracy:
                            touchSummary.onTargetRatio === null
                              ? "—"
                              : percent(touchSummary.onTargetRatio),
                          best: formatTime(touchSummary.bestRunMilliseconds),
                        })
                      : t("session.score", {
                          points: number(score.points),
                          best: number(score.bestRun),
                        })}
              </span>
            </div>
            {isTouchExercise(current.kind) && (
              <p className="touch-instructions" id="touch-instructions">
                {t(
                  current.kind === "tap"
                    ? "touch.tapInstruction"
                    : "touch.followInstruction",
                )}
              </p>
            )}
            {(current.kind === "visual" || current.kind === "contrast") && (
              <section
                className="answer-section"
                aria-labelledby="response-question"
              >
                <h3 id="response-question">
                  {current.kind === "contrast"
                    ? t("session.contrastQuestion")
                    : current.configuration.stimulus === "Opening"
                      ? t("session.openingQuestion")
                      : t("session.directionQuestion")}
                </h3>
                <div
                  className={`answers ${current.kind === "visual" ? "direction-pad" : "quadrant-pad"}`}
                >
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
                      type="button"
                      className={`answer-${index}${answerResult?.choice === index && answerResult.correct && answerResult.highlight ? " answer-correct" : ""}`}
                      disabled={current.status !== "running"}
                      key={index}
                      onClick={() => answer(index)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {current.kind === "saccades" &&
              current.configuration.tapConfirm && (
                <button
                  disabled={current.status !== "running"}
                  onClick={() => setFeedback("feedback.target")}
                >
                  {t("session.found")}
                </button>
              )}
            <div className="feedback" role="status" aria-atomic="true">
              {touchCue ? (
                <TouchChallengeNotice cue={touchCue.value} session={current} />
              ) : current.kind === "follow" &&
                current.status === "running" &&
                exercise.current instanceof TouchExercise &&
                exercise.current.isOnTarget() ? (
                <span className="answer-affirmation">
                  <span aria-hidden="true">✓</span>
                  {t("touch.inHalo")}
                </span>
              ) : answerResult ? (
                <AnswerFeedback result={answerResult} />
              ) : feedback ? (
                t(feedback)
              ) : (
                ""
              )}
            </div>
            <SessionControls
              status={current.status}
              awaitingTouch={
                current.kind === "follow" &&
                current.awaitingTouch &&
                current.status === "paused"
              }
              routine={Boolean(data.run)}
              onPause={() => pause()}
              onResume={resume}
              onEnd={finish}
            />
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
            {lastScore && (
              <p className="rest-result">
                {t("session.score", {
                  points: number(lastScore.points),
                  best: number(lastScore.bestRun),
                })}
              </p>
            )}
            {lastTouchSummary && (
              <p className="rest-result">
                {t("touch.liveResult", {
                  accuracy:
                    lastTouchSummary.onTargetRatio === null
                      ? "—"
                      : percent(lastTouchSummary.onTargetRatio),
                  best: formatTime(lastTouchSummary.bestRunMilliseconds),
                })}
              </p>
            )}
            {lastSession?.challenge && (
              <p className="rest-result">
                {t("challenge.summary", {
                  start: number(lastSession.challenge.startingLevel + 1),
                  highest: number(lastSession.challenge.highestLevel + 1),
                })}
              </p>
            )}
            {data.run &&
              shouldRecommendLandscape(
                data.run.routine.steps[data.run.index].kind,
                practiceSetups.pursuit.configuration.pattern,
              ) && <LandscapeHint />}
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
                    ? t("nav.Practice")
                    : tab === "Statistics"
                      ? t("nav.Statistics")
                      : tab === "Routines"
                        ? t("page.Routines.title")
                        : t("page.Settings.title")}
                </h1>
                <p>
                  {tab === "Practice"
                    ? t("page.Practice.description")
                    : tab === "Statistics"
                      ? t("page.Statistics.description")
                      : tab === "Routines"
                        ? t("page.Routines.description")
                        : t("page.Settings.description")}
                </p>
              </div>
              {tab === "Practice" && (
                <Practice
                  minutes={minutes}
                  goal={data.preferences.goal}
                  kind={kind}
                  setKind={setKind}
                  eye={eye}
                  setEye={setEye}
                  configuration={configuration}
                  setting={setting}
                  mode={practiceSetups[kind].mode}
                  selectMode={(mode) =>
                    setPracticeSetups((previous) =>
                      selectPracticeMode(previous, kind, mode),
                    )
                  }
                  ready={ready}
                  start={() => start()}
                />
              )}
              {tab === "Statistics" && (
                <Statistics
                  data={data}
                  persist={persist}
                  onPractice={() => navigate("Practice")}
                  onExport={exportData}
                  onReset={(options) => {
                    if (state.current.current || state.current.run) return;
                    persist(resetStatistics(state.current, options));
                  }}
                  onUndo={() => {
                    if (state.current.current || state.current.run) return;
                    persist(undoStatisticsReset(state.current));
                  }}
                />
              )}
              {tab === "Routines" && (
                <Routines
                  data={data}
                  eye={eye}
                  setEye={setEye}
                  routine={routine}
                  setRoutine={setRoutine}
                  persist={persist}
                  start={start}
                  pursuitPattern={practiceSetups.pursuit.configuration.pattern}
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
                    <div className="settings-controls">
                      {(
                        [
                          ["goal", t("settings.goal"), 1, 240],
                          ["reminder", t("settings.reminder"), 0, 60],
                        ] as const
                      ).map(([key, label, min, max]) => (
                        <NumberStepper
                          key={key}
                          label={label}
                          value={data.preferences[key]}
                          minimum={min}
                          maximum={max}
                          onChange={(value) =>
                            persist({
                              ...data,
                              preferences: {
                                ...data.preferences,
                                [key]: value,
                              },
                            })
                          }
                        />
                      ))}
                      {!data.preferences.manual && (
                        <DurationControl
                          label={t("settings.rest")}
                          value={data.preferences.rest}
                          minimum={0}
                          sliderMaximum={300}
                          onChange={(value) =>
                            persist({
                              ...data,
                              preferences: { ...data.preferences, rest: value },
                            })
                          }
                        />
                      )}
                      {(
                        [
                          ["manual", t("routine.manual")],
                          ["sound", t("settings.sound")],
                          ["answerSound", t("settings.answerSound")],
                          ["reducedMotion", t("settings.reducedMotion")],
                          ["highContrast", t("settings.highContrast")],
                        ] as const
                      ).map(([key, label]) => (
                        <ToggleSwitch
                          key={key}
                          label={label}
                          checked={data.preferences[key]}
                          onChange={(value) =>
                            persist({
                              ...data,
                              preferences: {
                                ...data.preferences,
                                [key]: value,
                              },
                            })
                          }
                        />
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
                          const input = event.currentTarget;
                          const file = input.files?.[0];
                          if (!file) return;
                          void file
                            .text()
                            .then((text) => {
                              persist(
                                mergeBackup(state.current, JSON.parse(text)),
                              );
                              setFeedback("feedback.imported");
                            })
                            .catch(() => setError("error.backup"))
                            .finally(() => {
                              input.value = "";
                            });
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
            <Navigation current={tab} onChange={navigate} />
          </>
        )}
      </div>
    </LocalizationContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
