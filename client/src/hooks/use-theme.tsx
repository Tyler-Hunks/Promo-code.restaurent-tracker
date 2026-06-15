import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "default" | "restaurant" | "restaurant-dark";

const STORAGE_KEY = "promo-theme";

const THEME_CLASSES: Record<Theme, string | null> = {
  default: null,
  restaurant: "theme-restaurant",
  "restaurant-dark": "theme-restaurant-dark",
};

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isTheme(value: unknown): value is Theme {
  return value === "default" || value === "restaurant" || value === "restaurant-dark";
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("theme-restaurant", "theme-restaurant-dark");
  const cls = THEME_CLASSES[theme];
  if (cls) {
    root.classList.add(cls);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "default";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return isTheme(stored) ? stored : "default";
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
