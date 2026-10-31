import { useState } from "react";
import type { Data, Session } from "../engine/model";
import type { AdaptationDecision, PracticeActivity } from "../adaptive/types";
import {
  principalMeasure,
  responseInterval,
  channelConfidence,
} from "../analytics/adaptation";
import { useI18n } from "../i18n/react";

function Plot({
  title,
  samples,
  format,
}: {
  title: string;
  samples: { time: number; value: number | null }[];
  format: (value: number) => string;
}) {
  const valid = samples.filter(
    (item): item is { time: number; value: number } => item.value !== null,
  );
  if (!valid.length) return null;
  const minimum = Math.min(...valid.map((item) => item.value)),
    maximum = Math.max(...valid.map((item) => item.value));
  const end = Math.max(1, ...valid.map((item) => item.time));
  const points = valid.map((item) => ({
    x: 12 + (item.time / end) * 296,
    y:
      78 - ((item.value - minimum) / Math.max(0.00001, maximum - minimum)) * 62,
  }));
  return (
    <figure className="balance-plot">
      <figcaption>
        <strong>{title}</strong>
        <span>
          {format(minimum)}–{format(maximum)}
        </span>
      </figcaption>
      <svg viewBox="0 0 320 94" role="img" aria-label={title}>
        <path d="M12 82H308" className="balance-axis" />
        {points.length > 1 && (
          <polyline
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
          />
        )}
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="2.5" />
        ))}
      </svg>
    </figure>
  );
}

export default function BalanceInspector({ data }: { data: Data }) {
  const { t, number, percent, time, exerciseName, eyeLabel, date } = useI18n();
  const sessions = [...data.sessions, ...(data.current ? [data.current] : [])]
    .filter((session) => session.adaptation)
    .reverse();
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const session = sessions.find((item) => item.id === sessionId) ?? sessions[0];
  const activities = Object.values(session?.adaptation?.channels ?? {}).flatMap(
    (channel) => (channel ? [channel.activity] : []),
  );
  const [selectedActivity, setSelectedActivity] =
    useState<PracticeActivity | null>(null);
  const activity =
    selectedActivity && activities.includes(selectedActivity)
      ? selectedActivity
      : activities[0];
  const activityDecisions =
    session?.adaptation?.decisions.filter(
      (item) => item.activity === activity,
    ) ?? [];
  const profiles = [
    ...new Set(activityDecisions.map((item) => item.profileKey)),
  ];
  const [selectedProfile, setSelectedProfile] = useState("");
  const profile = profiles.includes(selectedProfile)
    ? selectedProfile
    : profiles.at(-1);
  const decisions = activityDecisions.filter(
    (item) => item.profileKey === profile,
  );
  const [decisionId, setDecisionId] = useState<number | null>(null);
  const selected =
    decisions.find((item) => item.id === decisionId) ?? decisions.at(-1);
  const activeChannel = activity
    ? session?.adaptation?.channels[activity]
    : null;
  const channel =
    activeChannel?.key === profile || !decisions.length ? activeChannel : null;
  const interval = channel ? responseInterval(channel) : null;
  const activityName = (value: PracticeActivity) =>
    value[0] === value[0].toUpperCase()
      ? t(`attention.task.${value as "Track"}`)
      : exerciseName(value as "visual");
  const measure = activity ? principalMeasure(activity) : "diameter";
  const measured = decisions.some((item) => item.values[measure] !== undefined);
  if (!session) return <p>{t("balance.noRecords")}</p>;
  return (
    <div className="balance-inspector">
      <p className="fine">{t("balance.inspectorNote")}</p>
      <label>
        {t("balance.session")}
        <select
          value={session.id}
          onChange={(event) => {
            setSessionId(event.target.value);
            setDecisionId(null);
          }}
        >
          {sessions.map((item) => (
            <option key={item.id} value={item.id}>
              {date(item.startedAt, { dateStyle: "short", timeStyle: "short" })}{" "}
              · {exerciseName(item.kind)} · {eyeLabel(item.eye)}
            </option>
          ))}
        </select>
      </label>
      {profiles.length > 1 && (
        <label>
          {t("balance.conditions")}
          <select
            value={profile}
            onChange={(event) => {
              setSelectedProfile(event.target.value);
              setDecisionId(null);
            }}
          >
            {profiles.map((key, index) => (
              <option key={key} value={key}>
                {t("balance.profile", {
                  number: number(index + 1),
                  count: number(
                    activityDecisions.filter((item) => item.profileKey === key)
                      .length,
                  ),
                })}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {t("balance.activity")}
        <select
          value={activity ?? ""}
          onChange={(event) => {
            setSelectedActivity(event.target.value as PracticeActivity);
            setDecisionId(null);
          }}
        >
          {activities.map((value) => (
            <option key={value} value={value}>
              {activityName(value)}
            </option>
          ))}
        </select>
      </label>
      {channel && (
        <div className="balance-evidence">
          <strong>
            {t(`balance.confidence.${channelConfidence(channel)}`)}
          </strong>
          <span>
            {t(
              channel.activity === "follow"
                ? "balance.windowEvidence"
                : "balance.responseEvidence",
              { count: number(channel.samples) },
            )}
          </span>
          {interval && (
            <small>
              {t("balance.interval", {
                lower: percent(interval.lower),
                upper: percent(interval.upper),
                count: number(interval.count),
              })}
            </small>
          )}
        </div>
      )}
      <p className="fine">
        {t("balance.protocol", { protocol: session.protocol ?? "legacy" })}
      </p>
      {profile && session.adaptation?.contexts?.[profile] && (
        <details className="balance-profile-data">
          <summary>{t("balance.rawConditions")}</summary>
          <pre>{session.adaptation.contexts[profile]}</pre>
        </details>
      )}
      {decisions.length ? (
        <>
          <div className="balance-plots">
            <Plot
              title={t(
                measured ? `balance.measure.${measure}` : "balance.challenge",
              )}
              samples={decisions.map((item) => ({
                time: item.activeMilliseconds,
                value: measured ? (item.values[measure] ?? null) : item.after,
              }))}
              format={(value) => number(value, 2)}
            />
            <Plot
              title={t("balance.success")}
              samples={decisions
                .filter((item) => !["check", "lapse"].includes(item.reason))
                .map((item) => ({
                  time: item.activeMilliseconds,
                  value: item.performance,
                }))}
              format={percent}
            />
            <Plot
              title={t("statistics.medianResponse")}
              samples={decisions
                .filter((item) => item.activity !== "follow")
                .map((item) => ({
                  time: item.activeMilliseconds,
                  value: item.responseMilliseconds,
                }))}
              format={(value) => `${number(value / 1000, 2)} s`}
            />
          </div>
          <p className="fine">{t("balance.selectDecision")}</p>
          <div
            className="balance-decisions"
            role="group"
            aria-label={t("balance.decisions")}
          >
            {decisions.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected?.id === item.id}
                onClick={() => setDecisionId(item.id)}
              >
                <span>{time(item.activeMilliseconds)}</span>
                <strong>{t(`balance.reason.${item.reason}`)}</strong>
                <span>
                  {item.performance === null ? "—" : percent(item.performance)}
                </span>
              </button>
            ))}
          </div>
          {selected && (
            <DecisionDetails decision={selected} session={session} />
          )}
        </>
      ) : (
        <p>{t("balance.pending")}</p>
      )}
    </div>
  );
}

function DecisionDetails({
  decision,
  session,
}: {
  decision: AdaptationDecision;
  session: Session;
}) {
  const { t, number, percent, time } = useI18n();
  return (
    <section
      className="balance-decision-detail"
      aria-label={t("balance.evidence")}
    >
      <h3>{t("balance.evidence")}</h3>
      <dl className="recorded-conditions">
        <div>
          <dt>{t("balance.activeTime")}</dt>
          <dd>{time(decision.activeMilliseconds)}</dd>
        </div>
        <div>
          <dt>{t("balance.challenge")}</dt>
          <dd>
            {number(decision.before, 2)} → {number(decision.after, 2)}
          </dd>
        </div>
        <div>
          <dt>{t("balance.success")}</dt>
          <dd>
            {decision.performance === null
              ? "—"
              : percent(decision.performance)}
          </dd>
        </div>
        <div>
          <dt>{t("balance.trials")}</dt>
          <dd>
            {decision.trials.length
              ? decision.trials.map((value) => number(value)).join(", ")
              : t(
                  decision.reason === "quality"
                    ? "balance.disruptedWindow"
                    : "balance.heldWindow",
                )}
          </dd>
        </div>
        <div>
          <dt>{t("balance.phase")}</dt>
          <dd>{t(`balance.phase.${decision.phase}`)}</dd>
        </div>
        <div>
          <dt>{t("balance.reason")}</dt>
          <dd>{t(`balance.reason.${decision.reason}`)}</dd>
        </div>
        {Object.entries(decision.values).map(([key, value]) => (
          <div key={key}>
            <dt>{t(`balance.measure.${key as "diameter"}`)}</dt>
            <dd>{number(value!, 2)}</dd>
          </div>
        ))}
      </dl>
      <ol className="balance-trial-evidence">
        {decision.trials.map((index) => {
          const trial = session.trials[index - 1];
          if (!trial) return null;
          return (
            <li key={index} value={index}>
              <strong>
                {t(
                  trial.timedOut
                    ? "balance.response.timeout"
                    : trial.correct
                      ? "balance.response.correct"
                      : "balance.response.incorrect",
                )}
              </strong>{" "}
              · {number(trial.responseMilliseconds / 1000, 2)}{" "}
              {t("tap.seconds")}
              {trial.quality?.reasons.map((reason) => (
                <small key={reason}>{t(`balance.quality.${reason}`)}</small>
              ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
