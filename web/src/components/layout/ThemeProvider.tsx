"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
type Theme = "dark" | "light";
let fallback: Theme = "dark";
const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify);
  window.addEventListener("pyro-theme", notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener("pyro-theme", notify); };
};
const snapshot = (): Theme => {
  try { return localStorage.getItem("pyro-theme") === "light" ? "light" : "dark"; }
  catch { return fallback; }
};
const ThemeContext = createContext({ theme: "dark" as Theme, toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "dark" as Theme);
  const toggleTheme = () => {
    fallback = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("pyro-theme", fallback); } catch { /* Session theme works without storage. */ }
    window.dispatchEvent(new Event("pyro-theme"));
  };
  return <ThemeContext value={{ theme, toggleTheme }}>{children}</ThemeContext>;
}
