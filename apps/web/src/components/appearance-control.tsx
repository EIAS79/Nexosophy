"use client";

import { Menu } from "@nexosophy/ui";
import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";
type DensityPreference = "comfortable" | "compact";

const THEME_KEY = "nexosophy.theme";
const DENSITY_KEY = "nexosophy.density";

function apply(theme: ThemePreference, density: DensityPreference) {
  const root = document.documentElement;

  if (theme === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = theme;

  if (density === "comfortable") root.removeAttribute("data-density");
  else root.dataset.density = density;
}

export function AppearanceControl() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [density, setDensity] = useState<DensityPreference>("comfortable");

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY);
    const storedDensity = localStorage.getItem(DENSITY_KEY);

    const nextTheme: ThemePreference =
      storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
    const nextDensity: DensityPreference = storedDensity === "compact" ? "compact" : "comfortable";

    setTheme(nextTheme);
    setDensity(nextDensity);
    apply(nextTheme, nextDensity);
  }, []);

  function chooseTheme(next: ThemePreference) {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    apply(next, density);
  }

  function chooseDensity(next: DensityPreference) {
    setDensity(next);
    localStorage.setItem(DENSITY_KEY, next);
    apply(theme, next);
  }

  return (
    <Menu
      label="Appearance"
      items={[
        { id: "system", label: `System theme${theme === "system" ? " ✓" : ""}`, onSelect: () => chooseTheme("system") },
        { id: "light", label: `Light theme${theme === "light" ? " ✓" : ""}`, onSelect: () => chooseTheme("light") },
        { id: "dark", label: `Dark theme${theme === "dark" ? " ✓" : ""}`, onSelect: () => chooseTheme("dark") },
        { id: "comfortable", label: `Comfortable density${density === "comfortable" ? " ✓" : ""}`, onSelect: () => chooseDensity("comfortable") },
        { id: "compact", label: `Compact density${density === "compact" ? " ✓" : ""}`, onSelect: () => chooseDensity("compact") },
      ]}
    />
  );
}
