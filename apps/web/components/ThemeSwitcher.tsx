"use client";

import React, { useEffect, useMemo, useState } from "react";

const THEME_OPTIONS = [
  { value: "pastel", label: "Pastel", subtitle: "Soft & light", icon: "🎨" },
  { value: "dark", label: "Dark", subtitle: "High contrast", icon: "🌙" },
] as const;

type ThemeName = (typeof THEME_OPTIONS)[number]["value"];
const FALLBACK_THEME: ThemeName = "pastel";

const STORAGE_KEY = "rag-playground-theme";

function normalizeTheme(value: string | null): ThemeName | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "pastel") return "pastel";
  if (lower === "dark") return "dark";
  if (lower === "light" || lower === "daylight") return "pastel";
  if (lower === "forest") return "dark";
  return null;
}

function getStoredTheme(): ThemeName | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return normalizeTheme(stored);
}

function resolveInitialTheme(): ThemeName {
  const stored = getStoredTheme();
  if (stored) return stored;
  return FALLBACK_THEME;
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeName>(FALLBACK_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(resolveInitialTheme());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
    document.body?.setAttribute("data-theme-ready", "true");
  }, [theme]);

  const selectedLabel = useMemo(() => {
    const current = THEME_OPTIONS.find((option) => option.value === theme);
    return current ? `${current.icon} ${current.label}` : "Theme";
  }, [theme]);

  const selectedIcon = useMemo(() => {
    const current = THEME_OPTIONS.find((option) => option.value === theme);
    return current?.icon ?? "🎨";
  }, [theme]);

  return (
    <div className="dropdown dropdown-end" data-testid="theme-switcher">
      <label
        tabIndex={0}
        className="btn btn-ghost btn-sm gap-2 hover:bg-base-300/40 active:scale-95 transition-all"
        data-tour-id="theme-switcher"
        aria-label="Toggle color theme"
      >
        <span role="img" aria-hidden="true">
          {selectedIcon}
        </span>
        <span className="hidden sm:inline">{mounted ? selectedLabel : "Theme"}</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu menu-sm rounded-box bg-base-100 p-2 shadow"
        aria-label="Choose color theme"
      >
        {THEME_OPTIONS.map((option) => (
          <li key={option.value}>
            <button
              type="button"
              className={`justify-between ${theme === option.value ? "active" : ""}`}
              onClick={() => setTheme(option.value)}
            >
              <span className="flex flex-col items-start text-left text-sm leading-tight">
                <span className="font-semibold">
                  {option.icon} {option.label}
                </span>
                <span className="text-[11px] text-base-content/70">{option.subtitle}</span>
              </span>
              {theme === option.value ? (
                <span className="badge badge-primary badge-xs">Active</span>
              ) : (
                <span className="badge badge-ghost badge-xs">Pick</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
