import React from "react";

type Props = {
  headers: string[];
  selectedColumns: string[];
  columnsOpen: boolean;
  setColumnsOpen: (v: boolean) => void;
  columnQuery: string;
  setColumnQuery: (v: string) => void;
  onToggleColumn: (header: string, checked: boolean) => void;
  totalRows: number;
  filteredCount: number;
};

export function ColumnsFilter({
  headers,
  selectedColumns,
  columnsOpen,
  setColumnsOpen,
  columnQuery,
  setColumnQuery,
  onToggleColumn,
  totalRows,
  filteredCount,
}: Props): JSX.Element {
  const q = columnQuery.toLowerCase();
  const filtered = headers.filter((h) => h.toLowerCase().includes(q));

  return (
    <div className="relative">
      <button className="btn" onClick={() => setColumnsOpen(!columnsOpen)}>
        Columns ({selectedColumns.length})
      </button>
      {columnsOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-panel rounded-xl border border-slate-200 dark:border-white/10 p-3 z-30">
          <input
            className="input w-full mb-2"
            placeholder="Filter columns"
            value={columnQuery}
            onChange={(e) => setColumnQuery(e.target.value)}
          />
          <div className="max-h-60 overflow-auto space-y-1">
            {filtered.map((h) => {
              const checked = selectedColumns.includes(h);
              return (
                <label key={h} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onToggleColumn(h, e.target.checked)}
                  />
                  <span>{h}</span>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-slate-500 dark:text-white/50 text-sm">
                No columns
              </div>
            )}
          </div>
          <div className="mt-2 flex justify-between items-center">
            <div className="text-xs text-white/50">
              {filteredCount !== totalRows
                ? `${filteredCount} of ${totalRows} rows`
                : `${totalRows} rows`}
            </div>
            <div className="flex gap-2">
              <button
                className="chip hover:bg-white/20"
                onClick={() => onSelectAll()}
              >
                Select all
              </button>
              <button
                className="chip hover:bg-white/20"
                onClick={() => onClear()}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function onSelectAll() {
    for (const h of headers) onToggleColumn(h, true);
  }
  function onClear() {
    for (const h of headers) onToggleColumn(h, false);
  }
}
