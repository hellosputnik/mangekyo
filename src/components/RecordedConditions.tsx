import { isTouchExercise, type Session } from "../engine/model";
import { useI18n } from "../i18n/react";

export function RecordedConditions({ session }: { session: Session }) {
  const { t, number, duration, percent, optionLabel, eyeLabel } = useI18n();
  const settings = session.configuration;
  const rows = [
    [t("practice.eye"), eyeLabel(session.eye)],
    [
      t(session.checkIn ? "checkIn.timeLimit" : "practice.duration"),
      duration(settings.duration),
    ],
    [
      t(session.kind === "alignment" ? "alignment.length" : "recap.target"),
      t("touch.pixels", { value: number(settings.size) }),
    ],
    [t("config.contrast"), percent(settings.contrast)],
    [t("config.distance"), number(settings.distance)],
  ];
  if (session.kind === "pursuit" || session.kind === "follow")
    rows.push(
      [t("config.pattern"), optionLabel(settings.pattern)],
      [t("config.speed"), number(settings.speed, 2)],
    );
  if (isTouchExercise(session.kind))
    rows.push(
      [
        t("touch.hand"),
        t(settings.hand === "Left" ? "touch.leftHand" : "touch.rightHand"),
      ],
      [
        t("touch.haloSize"),
        t("touch.pixels", { value: number(settings.touchTolerance) }),
      ],
      [
        t("keyboard.method"),
        session.inputMethod
          ? t(`keyboard.${session.inputMethod}`)
          : t("filters.unknownScreen"),
      ],
    );
  if (session.kind === "saccades")
    rows.push(
      [t("config.exposure"), number(settings.exposure, 1)],
      [t("config.jumpPause"), number(settings.jumpPause, 1)],
      [t("config.jumpDistance"), percent(settings.jumpDistance)],
    );
  if (session.checkIn)
    rows.push([t("checkIn.title"), number(session.checkIn.targetTrials)]);
  if (session.kind === "crowding")
    rows.push([
      t("crowding.spacing"),
      number(settings.crowdingSpacing ?? 1, 2),
    ]);
  if (session.kind === "visual")
    rows.push([t("config.visualTask"), optionLabel(settings.stimulus)]);
  if (session.kind === "alignment")
    rows.push(
      [t("alignment.offset"), number(settings.alignmentOffset ?? 12)],
      [t("alignment.gap"), number(settings.alignmentGap ?? 16)],
      [t("alignment.width"), number(settings.alignmentWidth ?? 4)],
    );
  if (session.kind === "contrast")
    rows.push([
      t("config.contrastTask"),
      optionLabel(settings.contrastStimulus),
    ]);
  if (session.kind === "tap")
    rows.push([
      t(
        session.protocol === "tap-paced-4"
          ? "tap.targetTiming"
          : "challenge.basePace",
      ),
      settings.tapTimed === false
        ? t("tap.untilHit")
        : `${number(settings.tapPaceSeconds, 2)} ${t("tap.seconds")}`,
    ]);
  rows.push([
    t("filters.screen"),
    session.viewport
      ? `${number(session.viewport.width, 0)} × ${number(session.viewport.height, 0)} · ${number(session.viewport.pixelRatio, Number.isInteger(session.viewport.pixelRatio) ? 0 : 1)}×`
      : t("filters.unknownScreen"),
  ]);
  return (
    <dl className="recorded-conditions">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
