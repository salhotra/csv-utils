import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./styles.css";

// Initialize theme early to avoid flash
(() => {
  try {
    const saved =
      (localStorage.getItem("theme") as "light" | "dark" | null) ?? null;
    const theme = saved === "light" || saved === "dark" ? saved : "light";
    const rootEl = document.documentElement;
    if (theme === "dark") rootEl.classList.add("dark");
    else rootEl.classList.remove("dark");
  } catch {}
})();

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
