"use client";
import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const LABEL: Record<Theme, string> = { system: "Auto", light: "Light", dark: "Dark" };

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === "light" || t === "dark") setTheme(t);
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    const root = document.documentElement;
    if (t === "system") delete root.dataset.theme;
    else root.dataset.theme = t;
    try {
      if (t === "system") localStorage.removeItem("cc.theme");
      else localStorage.setItem("cc.theme", t);
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
  };

  return (
    <div className="chips theme" role="group" aria-label="Color theme">
      {(["system", "light", "dark"] as Theme[]).map((t) => (
        <button key={t} type="button" className="chip" aria-pressed={theme === t} onClick={() => choose(t)}>
          {LABEL[t]}
        </button>
      ))}
    </div>
  );
}
