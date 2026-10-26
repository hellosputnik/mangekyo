import type { ExerciseKind, Pattern } from "../engine/model";
import { useI18n } from "../i18n/react";
import { Icon } from "./Icon";

export function shouldRecommendLandscape(
  kind: ExerciseKind,
  pattern: Pattern,
): boolean {
  return kind === "saccades" || (kind === "pursuit" && pattern !== "Vertical");
}

export function LandscapeHint() {
  const { t } = useI18n();
  return (
    <aside className="landscape-hint">
      <Icon name="RotatePhone" />
      <p>{t("orientation.landscapeHint")}</p>
    </aside>
  );
}
