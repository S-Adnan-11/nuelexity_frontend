export type Theme = "light" | "dark";
export const themeKey = "nuelexity:theme";
let memoryChoice: Theme | null = null;
export function themeChoice(): Theme | null {
  try {
    const choice = localStorage.getItem(themeKey);
    return choice === "light" || choice === "dark" ? choice : memoryChoice;
  } catch { return memoryChoice; }
}
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#F4F5EF" : "#111916");
}
export function chooseTheme(theme: Theme) {
  memoryChoice = theme;
  try { localStorage.setItem(themeKey, theme); memoryChoice = null; } catch { /* Appearance still works when storage is blocked. */ }
  applyTheme(theme);
}
export function subscribeTheme(changed: () => void) {
  const media = matchMedia("(prefers-color-scheme: light)");
  const refresh = () => applyTheme(themeChoice() || (media.matches ? "light" : "dark"));
  const systemChanged = () => { if (!themeChoice()) refresh(); };
  const storageChanged = (event: StorageEvent) => { if (event.key === themeKey || event.key === null) refresh(); };
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  media.addEventListener("change", systemChanged);
  window.addEventListener("storage", storageChanged);
  // The system may change while the entry bundle is loading after early paint.
  refresh();
  return () => { observer.disconnect(); media.removeEventListener("change", systemChanged); window.removeEventListener("storage", storageChanged); };
}
