import React from "react";

type Props = {
  theme: "light" | "dark";
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: Props): JSX.Element {
  const isDark = theme === "dark";

  return (
    <button
      onClick={onToggle}
      className="group relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 dark:bg-slate-700 transition-all duration-300 hover:bg-slate-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-surface hover:scale-105 active:scale-95"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {/* Track background with gradient when active */}
      <span
        className={`absolute inset-0 rounded-full transition-all duration-500 ease-out ${
          isDark
            ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-600 shadow-lg shadow-purple-500/30"
            : "bg-slate-200"
        }`}
      />

      {/* Sliding toggle circle with enhanced shadow */}
      <span
        className={`relative inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-500 ease-out ${
          isDark ? "translate-x-6 scale-110" : "translate-x-1"
        } ${
          isDark
            ? "shadow-purple-300/60 ring-2 ring-purple-200/30"
            : "shadow-slate-400/50"
        } group-hover:shadow-xl`}
      >
        {/* Icon inside the toggle circle with rotation animation */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className={`transition-all duration-500 ${
              isDark ? "rotate-180" : "rotate-0"
            }`}
          >
            {isDark ? (
              <svg
                className="h-2.5 w-2.5 text-purple-600 transition-all duration-300"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="h-2.5 w-2.5 text-slate-600 transition-all duration-300"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </span>
        </span>
      </span>

      {/* Ambient glow effect when active */}
      {isDark && (
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-400/30 to-purple-500/30 blur-md transition-all duration-500 animate-pulse" />
      )}

      {/* Ripple effect on click */}
      <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-active:opacity-100 group-active:animate-ping transition-opacity duration-200" />
    </button>
  );
}
