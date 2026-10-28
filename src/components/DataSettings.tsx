import { useEffect, useRef, useState } from "react";
import type { Data } from "../engine/model";
import type { MessageKey } from "../i18n/locale";
import { useI18n } from "../i18n/react";
import { previewBackup } from "../persistence/backup";
import type { OfflineAvailability } from "../pwa/availability";
import { Modal } from "./Modal";
import { ToggleSwitch } from "./controls/ToggleSwitch";
import {
  checkDurability,
  requestDurability,
  type Durability,
} from "../persistence/durability";

const preferenceLabels: Record<keyof Data["preferences"], MessageKey> = {
  language: "language.title",
  goal: "settings.goal",
  rest: "settings.rest",
  manual: "routine.manual",
  sound: "settings.sound",
  answerSound: "settings.answerSound",
  haptics: "settings.haptics",
  reducedMotion: "settings.reducedMotion",
  highContrast: "settings.highContrast",
  reminder: "settings.reminder",
  backupReminder: "durability.reminder",
};
export function DataSettings({
  data,
  onExport,
  onImport,
  offlineAvailability,
  onDownloadOffline,
  onReminderChange,
}: {
  data: Data;
  onExport: () => void;
  onImport: (input: unknown, restorePreferences: boolean) => Promise<void>;
  offlineAvailability: OfflineAvailability;
  onDownloadOffline: () => Promise<void>;
  onReminderChange?: (enabled: boolean) => void;
}) {
  const { t, number, date, duration, exerciseName } = useI18n();
  const [pending, setPending] = useState<{
    input: unknown;
    name: string;
  } | null>(null);
  const [restorePreferences, setRestorePreferences] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [durability, setDurability] = useState<Durability>("checking");
  useEffect(() => {
    void checkDurability(navigator.storage).then(setDurability);
  }, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = pending ? previewBackup(data, pending.input) : null;
  const preferenceValue = (
    key: keyof Data["preferences"],
    value: Data["preferences"][typeof key],
  ) =>
    typeof value === "boolean"
      ? t(value ? "common.on" : "common.off")
      : key === "language"
        ? value === "system"
          ? t("language.system")
          : value === "vi"
            ? "Tiếng Việt"
            : "English"
        : key === "rest"
          ? duration(Number(value))
          : number(Number(value));
  return (
    <section className="panel data-settings">
      <h2>{t("settings.data")}</h2>
      <dl className="storage-status">
        <div>
          <dt>{t("storage.offline")}</dt>
          <dd role="status">{t(`storage.${offlineAvailability}`)}</dd>
        </div>
        <div>
          <dt>{t("storage.lastExport")}</dt>
          <dd>
            {data.lastExportedAt
              ? date(data.lastExportedAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : t("storage.neverExported")}
          </dd>
        </div>
      </dl>
      <p>{t("settings.install")}</p>
      {offlineAvailability === "not-ready" && (
        <button type="button" onClick={() => void onDownloadOffline()}>
          {t("storage.download")}
        </button>
      )}
      <p>{t("settings.storageNote")}</p>
      <p className="fine">{t("storage.exportNote")}</p>
      <div className="durability-settings">
        <p role="status">{t(`durability.${durability}`)}</p>
        {durability === "best-effort" && (
          <button
            type="button"
            onClick={() => {
              setDurability("checking");
              void requestDurability(navigator.storage).then(setDurability);
            }}
          >
            {t("durability.request")}
          </button>
        )}
        {onReminderChange && (
          <ToggleSwitch
            label={t("durability.reminder")}
            checked={data.preferences.backupReminder ?? false}
            onChange={onReminderChange}
          />
        )}
        <p className="fine">{t("durability.note")}</p>
      </div>
      <div className="backup-actions">
        <button type="button" onClick={onExport}>
          {t("settings.export")}
        </button>
        <button
          type="button"
          aria-haspopup="dialog"
          disabled={busy || reading}
          onClick={() => fileInput.current?.click()}
        >
          {t(reading ? "backup.reading" : "settings.import")}
        </button>
      </div>
      <input
        ref={fileInput}
        hidden
        type="file"
        accept="application/json,.json"
        disabled={busy || reading}
        onChange={(event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          if (!file) return;
          setMessage("");
          if (file.size > 20 * 1024 * 1024) {
            setMessage(t("backup.tooLarge"));
            input.value = "";
            return;
          }
          setReading(true);
          void file
            .text()
            .then((text) => {
              const parsed: unknown = JSON.parse(text);
              previewBackup(data, parsed);
              setRestorePreferences(true);
              setPending({ input: parsed, name: file.name });
            })
            .catch(() => setMessage(t("error.backup")))
            .finally(() => {
              input.value = "";
              setReading(false);
            });
        }}
      />
      <p role="status" aria-atomic="true">
        {message}
      </p>
      <Modal
        open={!!pending}
        closeDisabled={busy}
        closeLabel={t("common.cancel")}
        title={t("backup.review")}
        description={pending?.name}
        onClose={() => {
          if (!busy) setPending(null);
        }}
      >
        {preview && (
          <>
            <p>{t("backup.mergeNote")}</p>
            <dl className="backup-counts">
              <div>
                <dt>{t("statistics.sessions")}</dt>
                <dd>+{number(preview.sessions)}</dd>
              </div>
              <div>
                <dt>{t("nav.Routines")}</dt>
                <dd>+{number(preview.routines)}</dd>
              </div>
              <div>
                <dt>{t("progress.measurements")}</dt>
                <dd>+{number(preview.measurements)}</dd>
              </div>
              <div>
                <dt>{t("backup.adaptiveProfiles")}</dt>
                <dd>+{number(preview.adaptiveProfiles)}</dd>
              </div>
              <div>
                <dt>{t("setups.label")}</dt>
                <dd>+{number(preview.savedSetups)}</dd>
              </div>
            </dl>
            <ToggleSwitch
              label={t("backup.restorePreferences")}
              checked={restorePreferences}
              onChange={setRestorePreferences}
            />
            <p className="fine">{t("backup.progressNote")}</p>
            {preview.levelChanges.map((kind) => (
              <p className="fine" key={kind}>
                {exerciseName(kind)} ·{" "}
                {t("backup.levelChange", {
                  from: number(data.levels[kind] + 1),
                  to: number(preview.merged.levels[kind] + 1),
                })}
              </p>
            ))}
            {restorePreferences && (
              <>
                <h3>{t("backup.preferenceChanges")}</h3>
                {preview.preferenceChanges.length ? (
                  <dl className="recorded-conditions">
                    {preview.preferenceChanges.map((key) => (
                      <div key={key}>
                        <dt>{t(preferenceLabels[key])}</dt>
                        <dd>
                          {preferenceValue(key, data.preferences[key])} →{" "}
                          {preferenceValue(
                            key,
                            preview.merged.preferences[key],
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="fine">{t("backup.noPreferenceChanges")}</p>
                )}
                {preview.practiceChanged && (
                  <p>{t("backup.practiceChanges")}</p>
                )}
              </>
            )}
            {preview.hasUndo && <p className="fine">{t("backup.undoNote")}</p>}
            {message && <p role="alert">{message}</p>}
            <div className="actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => {
                  if (!pending || busy) return;
                  setMessage("");
                  setBusy(true);
                  void onImport(pending.input, restorePreferences)
                    .then(() => {
                      setPending(null);
                      setMessage(t("feedback.imported"));
                    })
                    .catch(() => setMessage(t("error.backup")))
                    .finally(() => setBusy(false));
                }}
              >
                {t(busy ? "backup.importing" : "backup.confirm")}
              </button>
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
