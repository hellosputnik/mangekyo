import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createLocalization,
  resolveLanguage,
  type LanguagePreference,
  type Localization,
} from "./locale";

export const LocalizationContext = createContext<Localization | null>(null);
export function useI18n(): Localization {
  const value = useContext(LocalizationContext);
  if (!value) throw Error("Localization provider is missing");
  return value;
}
export function useLocalization(preference: LanguagePreference): Localization {
  const [languages, setLanguages] = useState<readonly string[]>(() =>
    navigator.languages?.length
      ? [...navigator.languages]
      : [navigator.language],
  );
  useEffect(() => {
    const changed = () =>
      setLanguages(
        navigator.languages?.length
          ? [...navigator.languages]
          : [navigator.language],
      );
    window.addEventListener("languagechange", changed);
    return () => window.removeEventListener("languagechange", changed);
  }, []);
  const language = resolveLanguage(preference, languages);
  const localization = useMemo(
    () => createLocalization(language, languages),
    [language, languages],
  );
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = localization.t("app.title");
    const manifest = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    );
    if (manifest)
      manifest.href = new URL(
        language === "vi" ? "manifest.vi.webmanifest" : "manifest.webmanifest",
        document.baseURI,
      ).href;
  }, [localization, language]);
  return localization;
}
