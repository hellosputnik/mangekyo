import { Icon } from "./Icon";
import { useI18n } from "../i18n/react";
export const pages = ["Practice", "Progress", "Routines", "Settings"] as const;
export type Page = (typeof pages)[number];
export function Navigation({
  current,
  onChange,
}: {
  current: Page;
  onChange: (page: Page) => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="app-nav" aria-label={t("nav.label")}>
      <span
        className="nav-selection"
        style={{ transform: `translateX(${pages.indexOf(current) * 100}%)` }}
        aria-hidden="true"
      />
      {pages.map((page) => (
        <button
          type="button"
          key={page}
          aria-current={current === page ? "page" : undefined}
          onClick={() => onChange(page)}
        >
          <Icon name={page} />
          <span>{t(`nav.${page}`)}</span>
        </button>
      ))}
    </nav>
  );
}
