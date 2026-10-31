import { lazy, Suspense, useState } from "react";
import type { Data } from "../engine/model";
import { useI18n } from "../i18n/react";
import { Modal } from "./Modal";
const Inspector = lazy(() => import("./BalanceInspector"));
export function DeveloperTools({ data }: { data: Data }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <details className="developer-tools">
      <summary>{t("balance.developerTools")}</summary>
      <p className="fine">{t("balance.developerNote")}</p>
      <button type="button" onClick={() => setOpen(true)}>
        {t("balance.inspector")}
      </button>
      <Modal
        open={open}
        title={t("balance.inspector")}
        onClose={() => setOpen(false)}
        className="balance-dialog"
      >
        <Suspense fallback={<p>{t("balance.loading")}</p>}>
          <Inspector data={data} />
        </Suspense>
      </Modal>
    </details>
  );
}
