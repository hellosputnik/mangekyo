import type { Session } from "../engine/model";
import { useI18n } from "../i18n/react";
import { Icon } from "./Icon";

export function SessionControls({
  status,
  awaitingTouch = false,
  routine,
  onPause,
  onResume,
  onEnd,
}: {
  status: Session["status"];
  awaitingTouch?: boolean;
  routine: boolean;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}) {
  const { t } = useI18n();
  const running = status === "running" || awaitingTouch;
  return (
    <div className="training-controls">
      <button
        type="button"
        className={running ? undefined : "primary"}
        onClick={() => (running ? onPause() : onResume())}
      >
        <Icon name={running ? "Pause" : "Play"} />
        <span className="button-label">
          {t(
            running
              ? "session.pause"
              : status === "interrupted"
                ? "session.confirmResume"
                : "session.resume",
          )}
        </span>
      </button>
      <button type="button" className="session-end" onClick={() => onEnd()}>
        <Icon name="Stop" />
        <span className="button-label">
          {t(routine ? "session.skip" : "session.endSession")}
        </span>
      </button>
    </div>
  );
}
