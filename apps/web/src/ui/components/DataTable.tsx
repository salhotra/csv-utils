import React from "react";
import type { UiRow, ColumnType } from "../types";

type Props = {
  headers: string[];
  rows: UiRow[];
  filteredRows: UiRow[];
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
    <section className="card p-0 flex-1 overflow-auto mx-6 mt-4">
      {headers.length === 0 ? (
        <div className="p-6 text-white/60">Upload CSV files to begin.</div>
      ) : (
        <table className="table w-full">
          <thead className="sticky top-0 bg-panel">
            <tr>
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
              <tr key={idx} className="hover:bg-white/5">
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
          </tbody>
          <tfoot>
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
