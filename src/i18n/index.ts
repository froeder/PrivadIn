import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { APP_LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE, getLanguageDirection, resolveInitialLanguage } from "./config";
import { resources } from "./resources";

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: resolveInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: "common",
    ns: ["common", "shell", "login", "dashboard", "history", "stats", "profile", "cuiter", "admin", "auth", "services"],
    interpolation: {
      escapeValue: false,
    },
  });

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.resolvedLanguage ?? DEFAULT_LANGUAGE;
  document.documentElement.dir = getLanguageDirection(i18n.resolvedLanguage);
}

i18n.on("languageChanged", (language) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = getLanguageDirection(language);
  }
});

export default i18n;
