import React from "react";
import type { UiRow, ColumnType } from "../types";

type Props = {
  headers: readonly string[];
  rows: readonly UiRow[];
  filteredRows: readonly UiRow[];
  selectedRowIds: Set<string>;
  setSelectedRowIds: (next: Set<string>) => void;
  highlight: (text: string, col: string) => React.ReactNode;
  columnTypes: Record<string, ColumnType>;
  totalsByColumn: Record<string, number>;
  numberFormatter: Intl.NumberFormat;
};

export function DataTable({
  headers,
  rows,
  filteredRows,
  selectedRowIds,
  setSelectedRowIds,
  highlight,
  columnTypes,
  totalsByColumn,
  numberFormatter,
}: Props): JSX.Element {
  return (
    <section className="card p-0 flex-1 min-h-0 overflow-auto no-scrollbar">
      {headers.length === 0 ? (
        <div className="flex items-center justify-center h-full p-12">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                No data loaded
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                Your data will appear here once you upload CSV files
              </p>
            </div>
          </div>
        </div>
      ) : (
        <table className="table w-full">
          <thead className="sticky top-0 bg-slate-50 dark:bg-panel z-10">
            <tr className="bg-white/5">
              <th className="th w-10">
                <input
                  type="checkbox"
                  aria-label="Select visible"
                  checked={
                    filteredRows.length > 0 &&
                    filteredRows.every((r) => selectedRowIds.has(r._rid))
                  }
                  onChange={(e) => {
                    const allVisible = new Set(selectedRowIds);
                    if (e.target.checked) {
                      for (const r of filteredRows) allVisible.add(r._rid);
                    } else {
                      for (const r of filteredRows) allVisible.delete(r._rid);
                    }
                    setSelectedRowIds(allVisible);
                  }}
                />
              </th>
              {headers.map((h) => (
                <th key={h} className="th">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r, idx) => (
              <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5">
                <td className="td">
                  <input
                    type="checkbox"
                    checked={selectedRowIds.has(r._rid)}
                    onChange={(e) => {
                      const next = new Set(selectedRowIds);
                      if (e.target.checked) next.add(r._rid);
                      else next.delete(r._rid);
                      setSelectedRowIds(next);
                    }}
                  />
                </td>
                {headers.map((h) => (
                  <td key={h} className="td">
                    {highlight(String(r[h] ?? ""), h)}
                  </td>
                ))}
              </tr>
            ))}
            {/* spacer so last row doesn't sit under the sticky footer */}
            <tr aria-hidden="true">
              <td className="p-0" colSpan={headers.length + 1}>
                <div className="h-10" />
              </td>
            </tr>
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-panel z-10">
            <tr className="bg-white/5">
              <td className="td font-semibold">Totals</td>
              {headers.map((h) => (
                <td key={`total-${h}`} className="td font-semibold">
                  {columnTypes[h] === "number"
                    ? numberFormatter.format(totalsByColumn[h] ?? 0)
                    : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
