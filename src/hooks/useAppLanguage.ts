import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getLanguageCompactLabel,
  getLanguageLabel,
  normalizeAppLanguage,
} from "../i18n/config";

export function useAppLanguage() {
  const { i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.resolvedLanguage) ?? DEFAULT_LANGUAGE;

  const options = useMemo(
    () =>
      SUPPORTED_LANGUAGES.map((value) => ({
        value,
        label: getLanguageLabel(value),
        compactLabel: getLanguageCompactLabel(value),
      })),
    [],
  );

  return {
    language,
    options,
    changeLanguage: (nextLanguage: string) => i18n.changeLanguage(nextLanguage),
  };
}
