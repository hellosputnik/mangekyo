import { useEffect, useId, useRef, useState } from "react";
import type { Data } from "../engine/model";
import type { ResetStatisticsOptions } from "../engine/statistics-reset";
import { useI18n } from "../i18n/react";
import { ToggleSwitch } from "./controls/ToggleSwitch";

export function StatisticsResetControls({
  data,
  onReset,
  onUndo,
  onExport,
}: {
  data: Data;
  onReset: (options: ResetStatisticsOptions) => void;
  onUndo: () => void;
  onExport: () => void;
}) {
  const { t, date } = useI18n();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ResetStatisticsOptions>({
    measurements: false,
    difficulty: false,
  });
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<"reset" | "undo" | null>(null);
  const identifier = useId();
  const busy = Boolean(data.current || data.run);
  const hasLevels = Object.values(data.levels).some((level) => level > 0);
  const hasData =
    data.sessions.length > 0 || data.measurements.length > 0 || hasLevels;
  const canReset =
    data.sessions.length > 0 ||
    (options.measurements && data.measurements.length > 0) ||
    (options.difficulty && hasLevels);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      cancel.current?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  useEffect(() => {
    if (open || !restoreFocus.current) return;
    const target = restoreFocus.current === "undo" ? undoButton : resetButton;
    target.current?.focus();
    restoreFocus.current = null;
  }, [open, data.statisticsReset]);
  return (
    <section className="statistics-data">
      <h2>{t("statistics.manage")}</h2>
      <div className="statistics-data-actions">
        <button type="button" onClick={onExport}>
          {t("settings.export")}
        </button>
        <button
          ref={resetButton}
          type="button"
          className="danger-text"
          disabled={!hasData || busy}
          onClick={() => {
            setOptions({ measurements: false, difficulty: false });
            setOpen(true);
          }}
        >
          {t("statistics.reset")}
        </button>
      </div>
      {data.statisticsReset && (
        <div className="reset-undo">
          <p>
            {t("statistics.resetAt", {
              date: date(data.statisticsReset.resetAt, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
          <button
            ref={undoButton}
            type="button"
            disabled={busy}
            onClick={() => {
              restoreFocus.current = "reset";
              onUndo();
              setMessage(t("statistics.restored"));
            }}
          >
            {t("statistics.undo")}
          </button>
        </div>
      )}
      <p role="status" className="save-status">
        {message}
      </p>
      <dialog
        ref={dialog}
        className="custom-dialog reset-dialog"
        aria-labelledby={`${identifier}-title`}
        aria-describedby={`${identifier}-description`}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <div className="custom-dialog-header">
          <h2 id={`${identifier}-title`}>{t("statistics.resetTitle")}</h2>
        </div>
        <div className="custom-dialog-body">
          <p id={`${identifier}-description`}>
            {t("statistics.resetDescription")}
          </p>
          <p className="fine">{t("statistics.resetScope")}</p>
          <ToggleSwitch
            label={t("statistics.resetMeasurements")}
            checked={options.measurements}
            onChange={(measurements) =>
              setOptions((previous) => ({ ...previous, measurements }))
            }
          />
          <ToggleSwitch
            label={t("statistics.resetDifficulty")}
            checked={options.difficulty}
            onChange={(difficulty) =>
              setOptions((previous) => ({ ...previous, difficulty }))
            }
          />
          <p className="fine">
            {t(
              data.statisticsReset
                ? "statistics.replaceUndo"
                : "statistics.undoNote",
            )}
          </p>
        </div>
        <div className="reset-dialog-actions">
          <button ref={cancel} type="button" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={busy || !canReset}
            onClick={() => {
              restoreFocus.current = "undo";
              onReset(options);
              setOpen(false);
              setMessage(t("statistics.cleared"));
            }}
          >
            {t("statistics.reset")}
          </button>
        </div>
      </dialog>
    </section>
  );
}
