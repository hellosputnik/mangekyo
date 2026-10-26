import type { Session } from "../engine/model";
import { useI18n } from "../i18n/react";
import { Icon } from "./Icon";

export function SessionControls({
  status,
  routine,
  onPause,
  onResume,
  onEnd,
}: {
  status: Session["status"];
  routine: boolean;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}) {
  const { t } = useI18n();
  const running = status === "running";
  return (
    <div className="training-controls">
      <button
        type="button"
        className={running ? undefined : "primary"}
        onClick={() => (running ? onPause() : onResume())}
      >
        <Icon name={running ? "Pause" : "Play"} />
        {t(
          running
            ? "session.pause"
            : status === "interrupted"
              ? "session.confirmResume"
              : "session.resume",
        )}
      </button>
      <button type="button" className="session-end" onClick={() => onEnd()}>
        <Icon name="Stop" />
        {t(routine ? "session.skip" : "session.endSession")}
      </button>
    </div>
  );
}
