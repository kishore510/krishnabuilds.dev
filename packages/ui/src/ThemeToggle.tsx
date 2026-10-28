// Three-way theme control: Light / Dark / System.

import "./ThemeToggle.css";

import { useId, useState } from "react";

import { getTheme, setTheme, type Theme } from "./theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const labelId = useId();

  function choose(next: Theme) {
    setTheme(next);
    setThemeState(next);
  }

  return (
    <div className="kb-theme-toggle" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="kb-theme-toggle__label">
        Theme
      </span>
      <div className="kb-theme-toggle__options">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="kb-theme-toggle__button"
            aria-pressed={theme === option.value}
            onClick={() => choose(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
