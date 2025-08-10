import React from "react";

type Props = {
  appendMode: "append" | "replace";
  setAppendMode: (v: "append" | "replace") => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: () => void;
  canDownload: boolean;
  onDeleteSelected: () => void;
  canDelete: boolean;
};

export function Toolbar({
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
