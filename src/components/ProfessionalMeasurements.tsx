import { useState } from "react";
import type { Data, Eye } from "../engine/model";
import { useI18n } from "../i18n/react";
import { EyeSelector } from "./controls/EyeSelector";
import { Icon } from "./Icon";

export function ProfessionalMeasurements({
  data,
  persist,
}: {
  data: Data;
  persist: (data: Data) => void;
}) {
  const { t, date, eyeLabel, number } = useI18n();
  const [eye, setEye] = useState<Eye>("Left");
  const [saved, setSaved] = useState(false);
  return (
    <details className="panel measurements-panel">
      <summary>
        <span>
          {t("progress.measurements")}{" "}
          {data.measurements.length > 0 &&
            `(${number(data.measurements.length)})`}
        </span>
        <Icon name="Chevron" />
      </summary>
      <p>{t("progress.measurementNote")}</p>
      <form
        className="settings-grid measurement-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          persist({
            ...data,
            measurements: [
              ...data.measurements,
              {
                id: crypto.randomUUID(),
                date: String(form.get("date")),
                eye: String(form.get("eye")) as Eye,
                method: String(form.get("method")),
                value: String(form.get("value")),
              },
            ],
          });
          event.currentTarget.reset();
          setEye("Left");
          setSaved(true);
        }}
      >
        <label>
          {t("progress.date")}
          <input name="date" type="date" required />
        </label>
        <EyeSelector
          label={t("progress.eye")}
          name="eye"
          value={eye}
          onChange={setEye}
        />
        <label>
          {t("progress.method")}
          <input
            name="method"
            required
            placeholder={t("progress.methodPlaceholder")}
          />
        </label>
        <label>
          {t("progress.result")}
          <input
            name="value"
            required
            placeholder={t("progress.resultPlaceholder")}
          />
        </label>
        <button>{t("progress.saveMeasurement")}</button>
      </form>
      <p className="save-status" role="status">
        {saved ? t("progress.savedMeasurement") : ""}
      </p>
      {data.measurements.map((measurement) => (
        <p key={measurement.id}>
          {date(measurement.date)} · {eyeLabel(measurement.eye)} ·{" "}
          {measurement.method}: {measurement.value}
        </p>
      ))}
    </details>
  );
}
