import { useState } from "react";
import type { Configuration, ExerciseKind, SavedSetup } from "../engine/model";
import { useI18n } from "../i18n/react";
export function SavedSetups({
  kind,
  configuration,
  setups,
  onChange,
  onApply,
}: {
  kind: ExerciseKind;
  configuration: Configuration;
  setups: SavedSetup[];
  onChange: (setups: SavedSetup[]) => void;
  onApply: (configuration: Configuration) => void;
}) {
  const { t, number } = useI18n();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [undo, setUndo] = useState<SavedSetup[] | null>(null);
  const matching = setups.filter((setup) => setup.kind === kind);
  return (
    <details className="saved-setups">
      <summary>{t("setups.title", { count: number(matching.length) })}</summary>
      <div className="saved-setup-editor">
        <label>
          {t("setups.name")}
          <input
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={
            !name.trim() ||
            (setups.length >= 30 &&
              !matching.some(
                (setup) =>
                  setup.name.toLocaleLowerCase() ===
                  name.trim().toLocaleLowerCase(),
              ))
          }
          onClick={() => {
            const previous = matching.find(
              (setup) =>
                setup.name.toLocaleLowerCase() ===
                name.trim().toLocaleLowerCase(),
            );
            const saved: SavedSetup = {
              id: previous?.id ?? crypto.randomUUID(),
              name: name.trim(),
              kind,
              configuration: structuredClone(configuration),
            };
            setUndo(structuredClone(setups));
            onChange([
              ...setups.filter((setup) => setup.id !== saved.id),
              saved,
            ]);
            setMessage(t("setups.saved"));
            setName("");
          }}
        >
          {t("setups.save")}
        </button>
      </div>
      <p className="fine">{t("setups.note")}</p>
      {matching.map((setup) => (
        <div className="saved-setup-row" key={setup.id}>
          <button
            type="button"
            onClick={() => {
              onApply(structuredClone(setup.configuration));
              setMessage(t("setups.loaded", { name: setup.name }));
            }}
          >
            {setup.name}
          </button>
          <button
            type="button"
            aria-label={t("setups.remove", { name: setup.name })}
            onClick={() => {
              setUndo(structuredClone(setups));
              onChange(setups.filter((item) => item.id !== setup.id));
              setMessage(t("setups.removed"));
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div role="status" className="inline-notice">
        {message}
        {undo && (
          <button
            type="button"
            onClick={() => {
              onChange(undo);
              setUndo(null);
              setMessage(t("common.undo"));
            }}
          >
            {t("common.undo")}
          </button>
        )}
      </div>
    </details>
  );
}
