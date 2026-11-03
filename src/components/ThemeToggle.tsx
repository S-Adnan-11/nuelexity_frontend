import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { chooseTheme, currentTheme, subscribeTheme } from "../lib/theme";
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "dark");
  const next = theme === "dark" ? "light" : "dark";
  return <button type="button" className="theme-toggle" aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`} onClick={() => chooseTheme(next)}>
    {next === "light" ? <Sun size={20} aria-hidden="true" />: <Moon size={20} aria-hidden="true" />}
  </button>;
}
