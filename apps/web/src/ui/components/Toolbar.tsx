import React from "react";

type Props = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  appendMode: "append" | "replace";
  setAppendMode: (v: "append" | "replace") => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: () => void;
  canDownload: boolean;
  onDeleteSelected: () => void;
  canDelete: boolean;
};

export function Toolbar({
  theme,
  onToggleTheme,
  appendMode,
  setAppendMode,
  onUpload,
  onDownload,
  canDownload,
  onDeleteSelected,
  canDelete,
}: Props): JSX.Element {
  return (
    <div className="px-6 py-4 flex items-center justify-between">
      <h1 className="text-2xl font-semibold tracking-tight">csv-utils</h1>
      <div className="flex items-center gap-3">
        <button
          className="chip"
          aria-label="Toggle theme"
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          onClick={onToggleTheme}
        >
          {/* Half-moon icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
          </svg>
          <span className="text-sm">{theme === "dark" ? "Dark" : "Light"}</span>
        </button>
        <select
          className="input"
          value={appendMode}
          onChange={(e) =>
            setAppendMode(e.target.value as "append" | "replace")
          }
        >
          <option value="replace">Replace on upload</option>
          <option value="append">Append on upload</option>
        </select>
        <label className="btn cursor-pointer">
          Upload CSV
          <input
            className="hidden"
            type="file"
            accept=".csv"
            multiple
            onChange={onUpload}
          />
        </label>
        <button className="btn" onClick={onDownload} disabled={!canDownload}>
          Download CSV
        </button>
        <button
          className="btn"
          onClick={onDeleteSelected}
          disabled={!canDelete}
        >
          Delete selected
        </button>
      </div>
    </div>
  );
}
