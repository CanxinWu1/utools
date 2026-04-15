import { useEffect, useState } from "react";

const FAVORITES_KEY = "quickdesk:favorites";
const RECENTS_KEY = "quickdesk:recents";
const THEME_KEY = "quickdesk:theme";
const MAX_RECENTS = 6;

export type ThemePreference = "light" | "dark";

function readStringArray(key: string) {
  try {
    const value = localStorage.getItem(key);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function readTheme(): ThemePreference {
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

export function usePreferences() {
  const [favorites, setFavorites] = useState<string[]>(() => readStringArray(FAVORITES_KEY));
  const [recents, setRecents] = useState<string[]>(() => readStringArray(RECENTS_KEY));
  const [theme, setTheme] = useState<ThemePreference>(() => readTheme());

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
  }, [recents]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleFavorite(toolId: string) {
    setFavorites((current) =>
      current.includes(toolId) ? current.filter((id) => id !== toolId) : [toolId, ...current],
    );
  }

  function touchRecent(toolId: string) {
    setRecents((current) => [toolId, ...current.filter((id) => id !== toolId)].slice(0, MAX_RECENTS));
  }

  function toggleTheme() {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }

  return { favorites, recents, theme, toggleFavorite, touchRecent, toggleTheme };
}
