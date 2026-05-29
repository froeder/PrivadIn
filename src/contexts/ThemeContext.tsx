import { createContext, useEffect, useMemo, useState } from "react";
import type { AppTheme } from "../types";

export const THEME_STORAGE_KEY = "privadin-theme";

interface ThemeContextValue {
  theme: AppTheme | null;
  resolvedTheme: AppTheme;
  setTheme: (nextTheme: AppTheme) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_COLORS: Record<AppTheme, string> = {
  dark: "#020617",
  light: "#f8fafc",
};

function normalizeTheme(theme?: string | null): AppTheme | null {
  if (theme === "light" || theme === "dark") return theme;
  return null;
}

function getSystemTheme() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme() {
  if (typeof window === "undefined") return null;
  return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme | null>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<AppTheme>(() => getStoredTheme() ?? getSystemTheme());

  useEffect(() => {
    if (theme) {
      setResolvedTheme(theme);
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = () => setResolvedTheme(media.matches ? "dark" : "light");

    applySystemTheme();
    media.addEventListener("change", applySystemTheme);
    return () => media.removeEventListener("change", applySystemTheme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", THEME_COLORS[resolvedTheme]);
    }
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (nextTheme) => {
        setThemeState(nextTheme);
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      },
      toggleTheme: () => {
        const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
        setThemeState(nextTheme);
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      },
    }),
    [resolvedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
