import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SupportedLanguage,
  getPersistedLanguage,
  persistLanguage,
  translations,
} from "../utils/i18n";

export interface LanguageOption {
  value: SupportedLanguage;
  label: string;
  compactLabel: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    value: "pt-BR",
    label: "Português (Brasil)",
    compactLabel: "PT",
    flag: "🇧🇷",
  },
  {
    value: "en-US",
    label: "English (US)",
    compactLabel: "EN",
    flag: "🇺🇸",
  },
];

type LanguageListener = (lang: SupportedLanguage) => void;
const listeners = new Set<LanguageListener>();
let currentLanguage: SupportedLanguage = "pt-BR";
let isInitialized = false;

function notifyListeners(lang: SupportedLanguage) {
  currentLanguage = lang;
  listeners.forEach((listener) => listener(lang));
}

export function useAppLanguage() {
  const [language, setLanguageState] = useState<SupportedLanguage>(currentLanguage);

  useEffect(() => {
    if (!isInitialized) {
      isInitialized = true;
      getPersistedLanguage().then((saved) => {
        if (saved !== currentLanguage) {
          notifyListeners(saved);
        }
      });
    }

    const listener: LanguageListener = (newLang) => {
      setLanguageState(newLang);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const changeLanguage = useCallback(async (nextLanguage: SupportedLanguage) => {
    if (nextLanguage === currentLanguage) return;
    notifyListeners(nextLanguage);
    await persistLanguage(nextLanguage);
  }, []);

  const t = useCallback(
    (key: keyof typeof translations["pt-BR"]): string => {
      const dict = translations[language] || translations["pt-BR"];
      return (dict as Record<string, string>)[key] ?? (translations["pt-BR"] as Record<string, string>)[key] ?? String(key);
    },
    [language]
  );

  return {
    language,
    options: LANGUAGE_OPTIONS,
    changeLanguage,
    t,
  };
}
