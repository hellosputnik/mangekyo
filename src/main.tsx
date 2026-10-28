import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  initialData,
  validate,
  localDate,
  isTouchExercise,
  isResponseExercise,
  supportsCheckIn,
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
  parsePracticePreferences,
  practiceDefaults,
  type PracticeSetups,
  type PracticeMode,
} from "./engine/practice";
import { exerciseProtocol, recordViewport } from "./analytics/comparison";
import { RestScreen } from "./components/RestScreen";
import { DataSettings } from "./components/DataSettings";
import { useAppAvailability } from "./pwa/useAppAvailability";
import {
  load,
  save,
  SnapshotConflict,
  subscribeToWrites,
} from "./persistence/store";
import { configureCheckIn, checkInComplete } from "./engine/check-in";
import { Modal } from "./components/Modal";
import { totalForDate } from "./analytics/totals";
import type { Exercise } from "./exercises/exercise";
import { createExercise } from "./exercises/factory";
import { TouchExercise, type Point } from "./exercises/touch";
import { highestTouchLevel, type TouchCue } from "./exercises/touch-challenge";
import {
  rememberTouchProfile,
  restoreTouchProfile,
} from "./engine/touch-profiles";
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
  const [storageConflict, setStorageConflict] = useState(false);
  const [tab, setTab] = useState<Page>("Practice");
  const [kind, setKind] = useState<ExerciseKind>("pursuit");
  const [eye, setEye] = useState<Eye>("Left");
  const [practiceSetups, setPracticeSetups] = useState(initialPracticeSetups);
  const configuration = practiceSetups[kind].configuration;
  const [, refresh] = useState(0);
  const [offline, setOffline] = useState(!navigator.onLine);
  const { update, offlineAvailability, downloadOffline } = useAppAvailability(
    import.meta.env.PROD,
  );
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
  const keyboardPress = useRef<"tap" | "follow" | null>(null);
  const keyboardPosition = useRef<Point | null>(null);
  const [keyboardCursor, setKeyboardCursor] = useState<Point | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const trialStart = useRef(0);
  const lastSave = useRef(0);
  const lastReminder = useRef(0);
  const persist = (next: Data) => {
    if (storageConflict) return;
    state.current = next;
    setData({ ...next });
    void save(next).catch((error) => storageFailure(error, "error.save"));
  };
  const storageFailure = (failure: unknown, message: MessageKey) => {
    if (failure instanceof SnapshotConflict) {
      timer.current?.pause(true);
      releaseTouch();
      setStorageConflict(true);
      setData({ ...state.current });
    } else setError(message);
  };
  useEffect(
    () =>
      ready
        ? subscribeToWrites(() =>
            storageFailure(new SnapshotConflict(), "error.save"),
          )
        : undefined,
    [ready],
  );
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
    if (celebratory || cue.kind === "milestone")
      playPracticeFeedback(celebratory ? "level" : "milestone", {
        sound: state.current.preferences.answerSound,
        haptics: state.current.preferences.haptics,
      });
    if (celebratory || cue.kind === "level-down") persist(state.current);
    return celebratory || cue.kind === "milestone";
  };
  useEffect(() => {
    void load()
      .then((value) => {
        const languageChanged =
          requestedLanguage && value.preferences.language !== requestedLanguage;
        if (requestedLanguage) value.preferences.language = requestedLanguage;
        setData(value);
        state.current = value;
        const remembered = parsePracticePreferences(value.practice);
        if (remembered) {
          setKind(remembered.kind);
          setEye(remembered.eye);
          setPracticeSetups(remembered.setups);
        }
        if (languageChanged)
          void save(value).catch((error) =>
            storageFailure(error, "error.save"),
          );
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
    return () => {
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, []);
  const releaseTouch = () => {
    keyboardPress.current = null;
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
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      const heading =
        document.querySelector<HTMLElement>("main .session-recap h2") ??
        document.querySelector<HTMLElement>("main h1") ??
        document.querySelector<HTMLElement>("main h2");
      heading?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, current?.id, Boolean(data.breakState)]);
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
    if (!session.checkIn) latest.levels[session.kind] = session.difficulty;
    rememberTouchProfile(latest, session);
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
            void save(state.current).catch((error) =>
              storageFailure(error, "error.checkpoint"),
            );
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
          const firstPresentation = !session.viewport;
          recordViewport(session, bounds.width, bounds.height, ratio);
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
          if (firstPresentation) session.initialDifficulty = session.difficulty;
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
      storageConflict ||
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
          void save(state.current).catch((error) =>
            storageFailure(error, "error.checkpoint"),
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
    storageConflict,
    Boolean(data.breakState),
    data.breakState?.manual,
    Boolean(data.breakState && data.breakState.remaining > 0),
  ]);
  const start = (
    selected = kind,
    duration = practiceSetups[selected].configuration.duration,
    selectedEye = eye,
    recordedConfiguration?: Configuration,
    recordedMode?: PracticeMode,
    checkIn = false,
  ) => {
    if (!ready || document.hidden || state.current.current) return;
    const selectedConfiguration =
      recordedConfiguration ?? practiceSetups[selected].configuration;
    const settings = validate(
      recordedConfiguration
        ? { ...recordedConfiguration, duration }
        : {
            ...selectedConfiguration,
            duration,
            speed: data.preferences.reducedMotion
              ? Math.min(selectedConfiguration.speed, 0.08)
              : selectedConfiguration.speed,
            ...(selected === "follow"
              ? { gentleMotion: data.preferences.reducedMotion }
              : {}),
          },
    );
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
      initialDifficulty: state.current.levels[selected],
      protocol: exerciseProtocol(selected),
      setupMode: recordedConfiguration
        ? (recordedMode ?? "Custom")
        : practiceSetups[selected].mode,
      ...(selected === "follow" ? { awaitingTouch: true } : {}),
    };
    if (checkIn) {
      session.configuration.duration = 600;
      configureCheckIn(session);
    }
    keyboardPosition.current = null;
    setKeyboardCursor(null);
    restoreTouchProfile(session, state.current.touchProfiles);
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
      if (state.current.preferences.answerSound) unlockPracticeAudio();
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
    if (correct)
      playAnswerConfirmation({
        sound: state.current.preferences.answerSound,
        haptics: state.current.preferences.haptics,
      });
    persist(state.current);
    if (checkInComplete(current)) finish();
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
    session.inputMethod =
      session.inputMethod && session.inputMethod !== "pointer"
        ? "mixed"
        : "pointer";
    setKeyboardCursor(null);
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
        if (result.correct && !playedCue)
          playAnswerConfirmation({
            sound: state.current.preferences.answerSound,
            haptics: state.current.preferences.haptics,
          });
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
  const keyboardDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const session = state.current.current;
    const renderer = exercise.current;
    if (
      !session ||
      !(renderer instanceof TouchExercise) ||
      document.hidden ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      touchPointer.current !== null
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      pause();
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    renderer.setViewport(bounds.width, bounds.height);
    const point =
      keyboardPosition.current ??
      (session.kind === "follow"
        ? renderer.handlePoint()
        : { x: bounds.width / 2, y: bounds.height / 2 });
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = moves[event.key];
    if (direction) {
      event.preventDefault();
      const step = event.shiftKey ? 24 : 8;
      const next = {
        x: Math.max(0, Math.min(bounds.width, point.x + direction.x * step)),
        y: Math.max(0, Math.min(bounds.height, point.y + direction.y * step)),
      };
      timer.current?.checkpoint();
      if (keyboardPress.current === "follow") renderer.pointerMove(next);
      keyboardPosition.current = next;
      if (session.kind === "tap") setKeyboardCursor(next);
      return;
    }
    if (
      event.repeat ||
      keyboardPress.current ||
      !(
        (session.kind === "tap" && event.key === "Enter") ||
        (session.kind === "follow" && event.key === " ")
      )
    )
      return;
    event.preventDefault();
    if (
      session.status !== "running" &&
      !(session.kind === "follow" && session.awaitingTouch)
    )
      return;
    const press = session.kind === "follow" ? renderer.handlePoint() : point;
    if (!renderer.pointerDown(press)) return;
    keyboardPosition.current = press;
    keyboardPress.current = session.kind === "follow" ? "follow" : "tap";
    session.inputMethod =
      session.inputMethod && session.inputMethod !== "keyboard"
        ? "mixed"
        : "keyboard";
    if (session.kind === "follow") {
      session.awaitingTouch = false;
      timer.current?.resume();
    } else setKeyboardCursor(press);
    persist(state.current);
  };
  const keyboardUp = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const session = state.current.current;
    const renderer = exercise.current;
    if (
      !session ||
      !(renderer instanceof TouchExercise) ||
      document.hidden ||
      !keyboardPress.current ||
      !keyboardPosition.current
    )
      return;
    if (
      (keyboardPress.current === "tap" && event.key !== "Enter") ||
      (keyboardPress.current === "follow" && event.key !== " ")
    )
      return;
    event.preventDefault();
    timer.current?.checkpoint();
    if (session.activeMilliseconds >= session.configuration.duration * 1000) {
      finish();
      return;
    }
    const result = renderer.pointerUp(keyboardPosition.current);
    keyboardPress.current = null;
    const playedCue = consumeTouchCues();
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
        if (result.correct && !playedCue)
          playAnswerConfirmation({
            sound: state.current.preferences.answerSound,
            haptics: state.current.preferences.haptics,
          });
      }
      persist(state.current);
    }
  };
  const navigate = (page: Page) => {
    setTab(page);
    setFeedback("");
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>("main h1")
        ?.focus({ preventScroll: true }),
    );
  };
  const minutes = totalForDate(data) / 60000;
  const lastSession = data.sessions.at(-1);
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
  const setting = (
    key: keyof Configuration,
    value: string | number | boolean,
  ) =>
    rememberPractice(
      kind,
      eye,
      updatePracticeSetting(practiceSetups, kind, key, value),
    );
  const rememberPractice = (
    selected: ExerciseKind,
    selectedEye: Eye,
    setups: PracticeSetups,
  ) => {
    setKind(selected);
    setEye(selectedEye);
    setPracticeSetups(setups);
    persist({
      ...state.current,
      practice: { kind: selected, eye: selectedEye, setups },
    });
  };
  const exportData = (recordExport = true) => {
    const exported = {
      ...state.current,
      lastExportedAt: new Date().toISOString(),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(exported, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `mangekyo-${localDate(new Date())}.json`;
    link.click();
    if (recordExport && !storageConflict) persist(exported);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <LocalizationContext.Provider value={localization}>
      <div
        className={`app ${data.preferences.highContrast ? "high-contrast" : ""} ${current ? "training-app" : ""}`}
      >
        <a className="skip-link" href="#main-content">
          {t("accessibility.skip")}
        </a>
        {!current && (
          <header>
            <a
              className="brand"
              href="#"
              onClick={(event) => {
                event.preventDefault();
                navigate("Practice");
              }}
            >
              <span className="brand-mark" aria-hidden="true">
                ✳
              </span>{" "}
              mangekyo
              <span className="brand-caption">{t("brand.caption")}</span>
            </a>
            {ready && !data.breakState && (
              <Navigation current={tab} onChange={navigate} />
            )}
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
              onClick={ready ? () => exportData() : () => location.reload()}
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
          <main
            id="main-content"
            tabIndex={-1}
            className="loading-state"
            role="status"
          >
            <span className="brand-mark" aria-hidden="true">
              ✳
            </span>
            <p>{t("app.loading")}</p>
          </main>
        ) : current ? (
          <main
            id="main-content"
            tabIndex={-1}
            className={`training ${supportsCheckIn(current.kind) ? "has-answers" : ""} ${isTouchExercise(current.kind) ? "has-touch-challenge" : ""}`}
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
                <h2 tabIndex={-1}>{exerciseName(current.kind)}</h2>
              </div>
              <span className="countdown">
                {current.checkIn
                  ? `${number(current.trials.length)} / ${number(current.checkIn.targetTrials)}`
                  : formatTime(
                      Math.max(
                        0,
                        current.configuration.duration * 1000 -
                          current.activeMilliseconds,
                      ),
                    )}
                <small>
                  {t(current.checkIn ? "checkIn.answers" : "session.remaining")}
                </small>
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
              />
            )}
            <div className="canvas-wrap">
              <canvas
                ref={canvas}
                tabIndex={isTouchExercise(current.kind) ? 0 : undefined}
                role={isTouchExercise(current.kind) ? "group" : "img"}
                onKeyDown={keyboardDown}
                onKeyUp={keyboardUp}
                onBlur={() => {
                  if (keyboardPress.current)
                    pause(false, current.kind === "follow");
                }}
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
                    ? "touch-instructions keyboard-instructions"
                    : undefined
                }
                aria-label={t("session.stimulus", {
                  exercise: exerciseName(current.kind),
                })}
              />
              {current.kind === "tap" && keyboardCursor && (
                <span
                  className="keyboard-cursor"
                  aria-hidden="true"
                  style={{ left: keyboardCursor.x, top: keyboardCursor.y }}
                />
              )}
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
            {isTouchExercise(current.kind) && (
              <p className="keyboard-instructions" id="keyboard-instructions">
                {t(current.kind === "tap" ? "keyboard.tap" : "keyboard.follow")}
              </p>
            )}
            {supportsCheckIn(current.kind) && (
              <section
                className="answer-section"
                aria-labelledby="response-question"
              >
                <h3 id="response-question">
                  {current.kind === "contrast"
                    ? t("session.contrastQuestion")
                    : current.kind === "crowding"
                      ? t("crowding.question")
                      : current.configuration.stimulus === "Opening"
                        ? t("session.openingQuestion")
                        : t("session.directionQuestion")}
                </h3>
                <div
                  className={`answers ${current.kind !== "contrast" ? "direction-pad" : "quadrant-pad"}`}
                >
                  {(current.kind !== "contrast"
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
          <RestScreen
            data={data}
            session={lastSession}
            onExtend={() =>
              persist({
                ...data,
                breakState: {
                  ...data.breakState!,
                  remaining: data.breakState!.remaining + 60,
                },
              })
            }
            onManual={() =>
              persist({
                ...data,
                breakState: {
                  ...data.breakState!,
                  manual: !data.breakState!.manual,
                },
              })
            }
            onContinue={() => {
              if (data.run) {
                const next = data.run.routine.steps[data.run.index];
                start(next.kind, next.duration, data.run.eye);
              } else persist({ ...data, breakState: null });
            }}
            onRepeat={() => {
              if (!lastSession) return;
              const selected = lastSession.kind;
              const repeatConfiguration = {
                ...structuredClone(lastSession.configuration),
                duration: lastSession.checkIn
                  ? practiceSetups[selected].configuration.duration
                  : lastSession.configuration.duration,
              };
              rememberPractice(selected, lastSession.eye, {
                ...practiceSetups,
                [selected]: {
                  mode: lastSession.setupMode ?? "Custom",
                  configuration: repeatConfiguration,
                },
              });
              start(
                selected,
                repeatConfiguration.duration,
                lastSession.eye,
                repeatConfiguration,
                lastSession.setupMode,
                Boolean(lastSession.checkIn),
              );
            }}
            onEndRoutine={() =>
              persist({ ...data, run: null, breakState: null })
            }
            onExport={() => exportData()}
            onSnooze={() =>
              persist({
                ...data,
                backupReminderDismissedAt: new Date().toISOString(),
              })
            }
          />
        ) : (
          <>
            <main id="main-content" tabIndex={-1} className="content">
              <div className="page-heading">
                <span className="eyebrow">{t("page.eyebrow")}</span>
                <h1 tabIndex={-1}>
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
                  setKind={(selected) =>
                    rememberPractice(selected, eye, practiceSetups)
                  }
                  eye={eye}
                  setEye={(selectedEye) =>
                    rememberPractice(kind, selectedEye, practiceSetups)
                  }
                  configuration={configuration}
                  setting={setting}
                  mode={practiceSetups[kind].mode}
                  selectMode={(mode) =>
                    rememberPractice(
                      kind,
                      eye,
                      selectPracticeMode(practiceSetups, kind, mode),
                    )
                  }
                  reducedMotion={data.preferences.reducedMotion}
                  resetSetup={() =>
                    rememberPractice(kind, eye, {
                      ...practiceSetups,
                      [kind]: {
                        mode: "Default",
                        configuration: practiceDefaults(kind),
                      },
                    })
                  }
                  restoreSetup={(setup) =>
                    rememberPractice(kind, eye, {
                      ...practiceSetups,
                      [kind]: setup,
                    })
                  }
                  ready={ready}
                  savedSetups={data.savedSetups ?? []}
                  saveSetups={(savedSetups) =>
                    persist({ ...state.current, savedSetups })
                  }
                  startCheckIn={() =>
                    start(
                      kind,
                      configuration.duration,
                      eye,
                      undefined,
                      undefined,
                      true,
                    )
                  }
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
                  setEye={(selectedEye) =>
                    rememberPractice(kind, selectedEye, practiceSetups)
                  }
                  routine={routine}
                  setRoutine={setRoutine}
                  persist={persist}
                  start={start}
                  pursuitPattern={practiceSetups.pursuit.configuration.pattern}
                />
              )}
              {tab === "Settings" && (
                <div className="settings-layout">
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
                  <section className="panel schedule-settings">
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
                          ["haptics", t("settings.haptics")],
                          ["reducedMotion", t("settings.reducedMotion")],
                          ["highContrast", t("settings.highContrast")],
                        ] as const
                      ).map(([key, label]) => (
                        <ToggleSwitch
                          key={key}
                          label={label}
                          checked={data.preferences[key]}
                          onChange={(value) => {
                            if (key === "answerSound" && value)
                              unlockPracticeAudio();
                            persist({
                              ...data,
                              preferences: {
                                ...data.preferences,
                                [key]: value,
                              },
                            });
                          }}
                        />
                      ))}
                      <p className="fine">{t("settings.hapticsNote")}</p>
                    </div>
                  </section>
                  <DataSettings
                    data={data}
                    onExport={() => exportData()}
                    offlineAvailability={offlineAvailability}
                    onDownloadOffline={downloadOffline}
                    onReminderChange={(backupReminder) =>
                      persist({
                        ...state.current,
                        preferences: {
                          ...state.current.preferences,
                          backupReminder,
                        },
                      })
                    }
                    onImport={async (input, restorePreferences) => {
                      const next = mergeBackup(state.current, input, {
                        restorePreferences,
                      });
                      try {
                        await save(next);
                      } catch (error) {
                        storageFailure(error, "error.save");
                        throw error;
                      }
                      if (
                        restorePreferences &&
                        next.preferences.language !==
                          state.current.preferences.language
                      ) {
                        const url = new URL(location.href);
                        url.searchParams.delete("lang");
                        history.replaceState(null, "", url);
                      }
                      state.current = next;
                      setData({ ...next });
                      const remembered = parsePracticePreferences(
                        next.practice,
                      );
                      if (remembered) {
                        setKind(remembered.kind);
                        setEye(remembered.eye);
                        setPracticeSetups(remembered.setups);
                      }
                    }}
                  />
                  <section className="panel limitation-settings">
                    <h2>{t("settings.limits")}</h2>
                    <p>{t("settings.limitsPerformance")}</p>
                    <p>{t("settings.limitsTracking")}</p>
                    <p>{t("settings.limitsComfort")}</p>
                  </section>
                </div>
              )}
            </main>
            <footer>
              <span>万華鏡 · MANGEKYO</span>
              <span>{t("footer.note")}</span>
            </footer>
          </>
        )}
      </div>
      <Modal
        open={storageConflict}
        dismissible={false}
        title={t("durability.conflictTitle")}
        onClose={() => {}}
      >
        <p>{t("durability.conflictNote")}</p>
        <div className="actions">
          <button type="button" onClick={() => exportData(false)}>
            {t("durability.exportCopy")}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => location.reload()}
          >
            {t("durability.reload")}
          </button>
        </div>
      </Modal>
    </LocalizationContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
