import type { Session } from "../engine/model";
import {
  followLevelGoalMilliseconds,
  maximumTouchLevel,
  tapLevelGoal,
  tapTimeLimit,
  type TouchCue,
} from "../exercises/touch-challenge";
import { useI18n } from "../i18n/react";

export function TouchChallenge({
  session,
  bestLevel,
  points,
  sound,
  onSound,
  onEasier,
}: {
  session: Session;
  bestLevel: number;
  points: number;
  sound: boolean;
  onSound: () => void;
  onEasier: () => void;
}) {
  const { t, number } = useI18n();
  const state = session.challenge;
  const maximum =
    session.kind === "tap" ? tapLevelGoal : followLevelGoalMilliseconds;
  const progress = state?.mastered
    ? maximum
    : session.kind === "tap"
      ? (state?.streak ?? 0)
      : (state?.progressMilliseconds ?? 0);
  const rule = state?.mastered
    ? t("challenge.masteredRule")
    : session.kind === "tap"
      ? t("challenge.tapGoal", {
          count: number(tapLevelGoal),
          seconds: number(
            tapTimeLimit(session.configuration, session.difficulty) / 1000,
            1,
          ),
        })
      : t("challenge.followGoal", {
          seconds: number(followLevelGoalMilliseconds / 1000),
        });
  return (
    <section className="touch-challenge" aria-label={t("challenge.title")}>
      <div className="touch-challenge-heading">
        <div>
          <strong>
            {t("challenge.level", {
              level: number(session.difficulty + 1),
              maximum: number(maximumTouchLevel + 1),
            })}
          </strong>
          <span className="challenge-best">
            <span>{t("challenge.best", { level: number(bestLevel + 1) })}</span>
            <span>
              {t("session.scoreLabel")} {number(points)}
            </span>
          </span>
        </div>
        <button
          type="button"
          className="quiet"
          disabled={session.difficulty <= 0}
          onClick={onEasier}
        >
          {t("challenge.easier")}
        </button>
        <button
          type="button"
          className="quiet sound-toggle"
          aria-pressed={sound}
          onClick={onSound}
        >
          {t(sound ? "challenge.soundOn" : "challenge.soundOff")}
        </button>
      </div>
      <p id="challenge-rule">{rule}</p>
      <progress
        max={maximum}
        value={progress}
        aria-label={t("challenge.progress")}
        aria-describedby="challenge-rule"
        aria-valuetext={
          session.kind === "tap"
            ? t("challenge.tapProgress", {
                count: number(progress),
                goal: number(maximum),
              })
            : t("challenge.followProgress", {
                seconds: number(progress / 1000, 1),
                goal: number(maximum / 1000),
              })
        }
      />
    </section>
  );
}
export function TouchChallengeNotice({
  cue,
  session,
}: {
  cue: TouchCue;
  session: Session;
}) {
  const { t, number } = useI18n();
  return (
    <span
      className={cue.kind === "level-down" ? undefined : "answer-affirmation"}
    >
      {["level-up", "mastered", "milestone"].includes(cue.kind) && (
        <span aria-hidden="true">✓</span>
      )}
      {t(
        cue.kind === "level-up"
          ? "challenge.unlocked"
          : cue.kind === "level-down"
            ? "challenge.eased"
            : cue.kind === "mastered"
              ? "challenge.mastered"
              : cue.kind === "milestone"
                ? "challenge.keepGoing"
                : cue.kind === "closer"
                  ? "challenge.closer"
                  : "challenge.paceCue",
        {
          level: number(cue.level + 1),
          seconds: number(
            tapTimeLimit(session.configuration, session.difficulty) / 1000,
            1,
          ),
        },
      )}
    </span>
  );
}
