import { arSA, enUS, es, ptBR, zhCN } from "date-fns/locale";
import type { AppLanguage } from "../types";

export const APP_LANGUAGE_STORAGE_KEY = "privadin-language";
export const DEFAULT_LANGUAGE: AppLanguage = "pt-BR";
export const SUPPORTED_LANGUAGES: AppLanguage[] = ["pt-BR", "en-US", "es-ES", "zh-Hans", "ar", "jam-JM", "pap-CW"];

const DATE_FNS_LOCALES = {
  ar: arSA,
  "pt-BR": ptBR,
  "en-US": enUS,
  "es-ES": es,
  "zh-Hans": zhCN,
  "jam-JM": enUS,
  "pap-CW": enUS,
} as const;

export function normalizeAppLanguage(language?: string | null): AppLanguage | null {
  if (!language) return null;

  const normalized = language.toLowerCase();
  if (normalized === "ar" || normalized.startsWith("ar-")) return "ar";
  if (normalized.startsWith("pt")) return "pt-BR";
  if (normalized.startsWith("en")) return "en-US";
  if (normalized.startsWith("es")) return "es-ES";
  if (normalized === "zh-hans" || normalized.startsWith("zh-cn") || normalized.startsWith("zh")) return "zh-Hans";
  if (normalized === "jam" || normalized.startsWith("jam-")) return "jam-JM";
  if (normalized === "pap" || normalized.startsWith("pap-")) return "pap-CW";
  return null;
}

export function resolveInitialLanguage() {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  const storedLanguage = normalizeAppLanguage(localStorage.getItem(APP_LANGUAGE_STORAGE_KEY));
  if (storedLanguage) return storedLanguage;

  return normalizeAppLanguage(window.navigator.language) ?? DEFAULT_LANGUAGE;
}

export function getDateFnsLocale(language?: string | null) {
  return DATE_FNS_LOCALES[normalizeAppLanguage(language) ?? DEFAULT_LANGUAGE];
}

export function getLanguageLabel(language: AppLanguage) {
  if (language === "ar") return "🇸🇦 العربية";
  if (language === "es-ES") return "🇪🇸 Español";
  if (language === "zh-Hans") return "🇨🇳 简体中文";
  if (language === "en-US") return "🇺🇸 English";
  if (language === "jam-JM") return "🇯🇲 Jamaican Patois";
  if (language === "pap-CW") return "🏝️ Papiamento";
  return "🇧🇷 Português";
}

export function getLanguageCompactLabel(language: AppLanguage) {
  if (language === "ar") return "🇸🇦";
  if (language === "es-ES") return "ES";
  if (language === "zh-Hans") return "中文";
  if (language === "en-US") return "EN";
  if (language === "jam-JM") return "🇯🇲";
  if (language === "pap-CW") return "🏝️";
  return "PT";
}

export function getLanguageDirection(language?: string | null) {
  return normalizeAppLanguage(language) === "ar" ? "rtl" : "ltr";
}
