import { useContext } from "react";
import { ThemeContext, ThemeContextValue } from "../contexts/ThemeContext";

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
