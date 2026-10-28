import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "../i18n/react";

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  className = "",
  closeDisabled = false,
  closeLabel,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeDisabled?: boolean;
  closeLabel?: string;
}) {
  const { t } = useI18n();
  const identifier = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={`custom-dialog managed-dialog ${className}`}
      aria-labelledby={`${identifier}-title`}
      aria-describedby={description ? `${identifier}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className="custom-dialog-header">
        <div>
          <h2 id={`${identifier}-title`}>{title}</h2>
          {description && <p id={`${identifier}-description`}>{description}</p>}
        </div>
        <button type="button" disabled={closeDisabled} onClick={onClose}>
          {closeLabel ?? t("common.done")}
        </button>
      </div>
      <div className="custom-dialog-body">{open && children}</div>
    </dialog>
  );
}
