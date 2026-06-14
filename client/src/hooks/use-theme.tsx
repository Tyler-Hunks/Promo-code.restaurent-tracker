import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "default" | "restaurant";

const STORAGE_KEY = "promo-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  if (theme === "restaurant") {
    root.classList.add("theme-restaurant");
  } else {
    root.classList.remove("theme-restaurant");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "default";
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "restaurant"
        ? "restaurant"
        : "default";
    } catch {
      return "default";
    }
  });

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const setTheme = (next: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors (e.g. private mode)
    }
    setThemeState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
