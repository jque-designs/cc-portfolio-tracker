"use client";
import { useEffect, useState } from "react";
import { IconAuto, IconMoon, IconSun } from "./icons";

type Theme = "system" | "light" | "dark";
const OPTIONS: { t: Theme; label: string; Icon: typeof IconSun }[] = [
  { t: "system", label: "Match system theme", Icon: IconAuto },
  { t: "light", label: "Light theme", Icon: IconSun },
  { t: "dark", label: "Dark theme", Icon: IconMoon },
];

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
    <div className="seg" role="group" aria-label="Color theme">
      {OPTIONS.map(({ t, label, Icon }) => (
        <button key={t} type="button" aria-pressed={theme === t} aria-label={label} title={label} onClick={() => choose(t)}>
          <Icon />
        </button>
      ))}
    </div>
  );
}
