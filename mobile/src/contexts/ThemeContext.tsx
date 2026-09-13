import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppTheme } from "../types";

export const THEME_STORAGE_KEY = "@privadin:appearance_theme";

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  danger: string;
  success: string;
}

export const DARK_THEME_COLORS: ThemeColors = {
  background: "#020617",
  surface: "#0f172a",
  card: "#1e293b",
  border: "#334155",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  accent: "#eab308",
  accentLight: "rgba(234, 179, 8, 0.15)",
  danger: "#ef4444",
  success: "#10b981",
};

export const LIGHT_THEME_COLORS: ThemeColors = {
  background: "#f8fafc",
  surface: "#ffffff",
  card: "#f1f5f9",
  border: "#cbd5e1",
  text: "#0f172a",
  textMuted: "#64748b",
  accent: "#d97706",
  accentLight: "rgba(217, 119, 6, 0.15)",
  danger: "#dc2626",
  success: "#059669",
};

export interface ThemeContextValue {
  theme: AppTheme;
  resolvedTheme: "dark" | "light";
  colors: ThemeColors;
  setTheme: (nextTheme: AppTheme) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function normalizeTheme(val?: string | null): AppTheme {
  if (val === "light" || val === "dark" || val === "system") return val;
  return "dark"; // Default theme for PrivadIn
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<AppTheme>("dark");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (isMounted) {
        if (stored) {
          setThemeState(normalizeTheme(stored));
        }
        setIsLoaded(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedTheme: "dark" | "light" = useMemo(() => {
    if (theme === "system") {
      return systemColorScheme === "light" ? "light" : "dark";
    }
    return theme === "light" ? "light" : "dark";
  }, [theme, systemColorScheme]);

  const colors = useMemo(() => {
    return resolvedTheme === "light" ? LIGHT_THEME_COLORS : DARK_THEME_COLORS;
  }, [resolvedTheme]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: AppTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      colors,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, colors, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
