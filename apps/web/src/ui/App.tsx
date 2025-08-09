import React, { useMemo, useState } from "react";
import { parseCsvFile } from "@csv-utils/io-browser";

type UiRow = Record<string, string> & { _rid: string };

export function App(): JSX.Element {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<UiRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [appendMode, setAppendMode] = useState<"append" | "replace">("replace");
  const [searchText, setSearchText] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnQuery, setColumnQuery] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const filteredRows = useMemo(() => {
    if (!searchText.trim() || selectedColumns.length === 0) return rows;
    const needle = searchText.toLowerCase();
    return rows.filter((r) =>
      selectedColumns.some((c) => (r[c] ?? "").toLowerCase().includes(needle))
    );
  }, [rows, searchText, selectedColumns]);

  const stampRow = (row: Record<string, string>): UiRow => {
    const existing = (row as Partial<UiRow>)._rid;
    if (existing) return row as UiRow;
    const id = (globalThis as any).crypto?.randomUUID
      ? (globalThis as any).crypto.randomUUID()
      : `r_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return { ...(row as Record<string, string>), _rid: id };
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    type Parsed = Awaited<ReturnType<typeof parseCsvFile>>;
    const parsedAll: Parsed[] = await Promise.all(
      files.map((f) => parseCsvFile(f))
    );

    const newWarnings = parsedAll.flatMap((p: Parsed) => p.warnings);
    const valid: Parsed[] = parsedAll.filter(
      (p: Parsed) => p.headers.length > 0
    );
    // log skipped rows (schema-mismatched) per file
    files.forEach((file, i) => {
      const skipped = parsedAll[i]?.skippedRows?.length ?? 0;
      if (skipped > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[csv-utils] Skipped ${skipped} row(s) from ${file.name} due to schema mismatch`
        );
      }
    });
    if (valid.length === 0) {
      setErrorModal({
        title: "No valid CSV headers",
        message: newWarnings.join("\n"),
      });
      return;
    }

    if (appendMode === "replace" || headers.length === 0) {
      const h = valid[0].headers;
      const allSameSchema = valid.every(
        (p: Parsed) =>
          p.headers.length === h.length &&
          p.headers.every((x: string, i: number) => x === h[i])
      );
      if (!allSameSchema) {
        const offending = valid.find(
          (p) =>
            !(
              p.headers.length === h.length &&
              p.headers.every((x, i) => x === h[i])
            )
        );
        setErrorModal({
          title: "Schema mismatch",
          message: `Expected: ${h.join(", ")}\nGot: ${
            offending?.headers.join(", ") ?? "(unknown)"
          }`,
        });
        return;
      }
      setHeaders(h);
      setRows(valid.flatMap((p) => p.rows.map(stampRow)));
      setSelectedColumns(h);
      setWarnings((w) => [...w, ...newWarnings]);
      return;
    }

    // append mode
    const h = headers;
    const allMatchExisting = valid.every(
      (p: Parsed) =>
        p.headers.length === h.length &&
        p.headers.every((x: string, i: number) => x === h[i])
    );
    if (!allMatchExisting) {
      const offending = valid.find(
        (p) =>
          !(
            p.headers.length === h.length &&
            p.headers.every((x, i) => x === h[i])
          )
      );
      setErrorModal({
        title: "Schema mismatch",
        message: `Existing: ${h.join(", ")}\nGot: ${
          offending?.headers.join(", ") ?? "(unknown)"
        }`,
      });
      return;
    }
    setRows((r) => [
      ...r,
      ...valid.flatMap((p: Parsed) => p.rows.map(stampRow)),
    ]);
    setWarnings((w) => [...w, ...newWarnings]);
  };

  // highlight matches in-cell
  const escReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const highlight = (text: string, col: string): React.ReactNode => {
    if (!searchText) return text;
    if (selectedColumns.length > 0 && !selectedColumns.includes(col))
      return text;
    const re = new RegExp(escReg(searchText), "gi");
    const parts = text.split(re);
    const matches = text.match(re);
    if (!matches) return text;
    const out: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      out.push(parts[i]);
      if (i < parts.length - 1) {
        out.push(
          <span
            key={`hl-${col}-${i}`}
            className="bg-yellow-400 text-black px-0.5 rounded-sm"
          >
            {matches[i]}
          </span>
        );
      }
    }
    return out;
  };

  const filteredHeaders = useMemo(() => {
    const q = columnQuery.toLowerCase();
    return headers.filter((h) => h.toLowerCase().includes(q));
  }, [headers, columnQuery]);

  const totalRows = rows.length;
  const filteredCount = filteredRows.length;

  const downloadCsv = (): void => {
    if (headers.length === 0) return;
    const escapeCell = (val: string) => {
      const needsQuotes = /[",\n]/.test(val);
      const escaped = val.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };
    const lines: string[] = [];
    lines.push(headers.map((h) => escapeCell(h)).join(","));
    for (const row of filteredRows) {
      lines.push(
        headers.map((h) => escapeCell(String(row[h] ?? ""))).join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `csv-utils-export-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-0 flex flex-col">
      <div className="w-full space-y-4 flex-1 flex flex-col min-h-0">
        <div className="sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-white/5">
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
              <button
                className="btn"
                onClick={downloadCsv}
                disabled={headers.length === 0}
              >
                Download CSV
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (selectedRowIds.size === 0) return;
                  setRows((prev) =>
                    prev.filter((r) => !selectedRowIds.has(r._rid))
                  );
                  setSelectedRowIds(new Set());
                }}
                disabled={selectedRowIds.size === 0}
              >
                Delete selected
              </button>
            </div>
          </div>
          <div className="px-6 pb-4">
            <div className="card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  className="input flex-1 min-w-[240px]"
                  placeholder="Search text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                {searchText && (
                  <button
                    className="chip hover:bg-white/20"
                    onClick={() => setSearchText("")}
                  >
                    Clear
                  </button>
                )}
                <div className="relative">
                  <button
                    className="btn"
                    onClick={() => setColumnsOpen((o) => !o)}
                  >
                    Columns ({selectedColumns.length})
                  </button>
                  {columnsOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-panel rounded-xl border border-white/10 shadow-soft p-3 z-30">
                      <input
                        className="input w-full mb-2"
                        placeholder="Filter columns"
                        value={columnQuery}
                        onChange={(e) => setColumnQuery(e.target.value)}
                      />
                      <div className="max-h-60 overflow-auto space-y-1">
                        {filteredHeaders.map((h) => {
                          const checked = selectedColumns.includes(h);
                          return (
                            <label key={h} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setSelectedColumns((cols) =>
                                    e.target.checked
                                      ? [...cols, h]
                                      : cols.filter((c) => c !== h)
                                  )
                                }
                              />
                              <span>{h}</span>
                            </label>
                          );
                        })}
                        {filteredHeaders.length === 0 && (
                          <div className="text-white/50 text-sm">
                            No columns
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex justify-between items-center">
                        <div className="text-xs text-white/50">
                          {searchText
                            ? `${filteredCount} of ${totalRows} rows`
                            : `${totalRows} rows`}
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="chip hover:bg-white/20"
                            onClick={() => setSelectedColumns(headers)}
                          >
                            Select all
                          </button>
                          <button
                            className="chip hover:bg-white/20"
                            onClick={() => setSelectedColumns([])}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-sm text-white/60 ml-auto">
                  {searchText ? (
                    <span>
                      Showing {filteredCount} of {totalRows} rows
                    </span>
                  ) : (
                    <span>{totalRows} rows</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

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
                          for (const r of filteredRows)
                            allVisible.delete(r._rid);
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
                          setSelectedRowIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(r._rid);
                            else next.delete(r._rid);
                            return next;
                          });
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
            </table>
          )}
        </section>

        {warnings.length > 0 && (
          <section className="card p-4 text-amber-300">
            <ul className="list-disc pl-5 space-y-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        {errorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setErrorModal(null)}
            />
            <div className="relative card p-6 w-[min(90vw,640px)]">
              <h3 className="text-xl font-semibold mb-2">{errorModal.title}</h3>
              <pre className="bg-black/30 p-3 rounded-md text-white/80 text-sm whitespace-pre-wrap">
                {errorModal.message}
              </pre>
              <div className="mt-4 flex justify-end">
                <button className="btn" onClick={() => setErrorModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
