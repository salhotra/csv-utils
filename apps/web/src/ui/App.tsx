import React, { useEffect, useMemo, useState } from "react";
import { parseCsvFile } from "@csv-utils/io-browser";
import type { UiRow, ColumnType } from "./types";
import { DataTable } from "./components/DataTable";
import { Toolbar } from "./components/Toolbar";
import { SearchBar } from "./components/SearchBar";
import { ColumnsFilter } from "./components/ColumnsFilter";
import { ErrorModal } from "./components/ErrorModal";
import { TypeReviewModal } from "./components/TypeReviewModal";
import { useTypeProfiles } from "./hooks/useTypeProfiles";
import { stampRow, inferColumnTypes, signatureOf } from "./utils/csv";

export function App(): JSX.Element {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("theme");
      return saved === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);
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
  const [columnTypes, setColumnTypes] = useState<Record<string, ColumnType>>(
    {}
  );
  const { profiles: typeProfiles, setProfiles: setTypeProfiles } =
    useTypeProfiles();
  const [stagedImport, setStagedImport] = useState<{
    headers: string[];
    rows: UiRow[];
    warnings: string[];
    types: Record<string, ColumnType>;
  } | null>(null);

  // no-op here; persistence handled by hook

  const filteredRows = useMemo(() => {
    if (!searchText.trim() || selectedColumns.length === 0) return rows;
    const needle = searchText.toLowerCase();
    return rows.filter((r) =>
      selectedColumns.some((c) => (r[c] ?? "").toLowerCase().includes(needle))
    );
  }, [rows, searchText, selectedColumns]);

  // utilities are imported from ./utils/csv

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
      const nextRows: UiRow[] = valid.flatMap((p) => p.rows.map(stampRow));
      const sig = signatureOf(h);
      const known = typeProfiles[sig];
      if (known) {
        // Known schema: skip type review
        setHeaders(h);
        setRows(nextRows);
        setSelectedColumns(h);
        setWarnings((w) => [...w, ...newWarnings]);
        setColumnTypes(known);
      } else {
        const inferred = inferColumnTypes(h, nextRows);
        setStagedImport({
          headers: h,
          rows: nextRows,
          warnings: newWarnings,
          types: inferred,
        });
      }
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
    const nextRows: UiRow[] = valid.flatMap((p: Parsed) =>
      p.rows.map(stampRow)
    );
    // Columns match existing -> skip review and append directly
    setRows((r) => [...r, ...nextRows]);
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

  const totalRows = rows.length;
  const filteredCount = filteredRows.length;

  const numberFormatter = useMemo(() => new Intl.NumberFormat("en-US"), []);
  const totalsByColumn = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const h of headers) {
      if (columnTypes[h] !== "number") continue;
      let sum = 0;
      for (const r of filteredRows) {
        const v = r[h];
        if (v === undefined || v === null) continue;
        const normalized = String(v).trim().replace(/,/g, "");
        const num = Number(normalized);
        if (Number.isFinite(num)) sum += num;
      }
      totals[h] = sum;
    }
    return totals;
  }, [headers, filteredRows, columnTypes]);

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
    <div className="h-screen p-0 flex flex-col overflow-hidden">
      <div className="w-full space-y-4 flex-1 flex flex-col min-h-0 pb-4">
        <div className="sticky top-0 z-20 bg-slate-50/80 dark:bg-surface/80 backdrop-blur border-b border-slate-200 dark:border-white/5">
          <Toolbar
            theme={theme}
            onToggleTheme={() =>
              setTheme((t) => (t === "dark" ? "light" : "dark"))
            }
            appendMode={appendMode}
            setAppendMode={setAppendMode}
            onUpload={onUpload}
            onDownload={downloadCsv}
            canDownload={headers.length > 0}
            onDeleteSelected={() => {
              if (selectedRowIds.size === 0) return;
              setRows((prev) =>
                prev.filter((r) => !selectedRowIds.has(r._rid))
              );
              setSelectedRowIds(new Set());
            }}
            canDelete={selectedRowIds.size > 0}
          />
          <div className="pb-2">
            <SearchBar
              searchText={searchText}
              setSearchText={setSearchText}
              rowSummary={
                searchText
                  ? `Showing ${filteredCount} of ${totalRows} rows`
                  : `${totalRows} rows`
              }
              rightSide={
                <ColumnsFilter
                  headers={headers}
                  selectedColumns={selectedColumns}
                  columnsOpen={columnsOpen}
                  setColumnsOpen={setColumnsOpen}
                  columnQuery={columnQuery}
                  setColumnQuery={setColumnQuery}
                  onToggleColumn={(h, checked) =>
                    setSelectedColumns((cols) =>
                      checked
                        ? Array.from(new Set([...cols, h]))
                        : cols.filter((c) => c !== h)
                    )
                  }
                  totalRows={totalRows}
                  filteredCount={filteredCount}
                />
              }
            />
          </div>
        </div>

        <DataTable
          headers={headers}
          rows={rows}
          filteredRows={filteredRows}
          selectedRowIds={selectedRowIds}
          setSelectedRowIds={setSelectedRowIds}
          highlight={(text, col) => highlight(text, col)}
          columnTypes={columnTypes}
          totalsByColumn={totalsByColumn}
          numberFormatter={numberFormatter}
        />

        {warnings.length > 0 && (
          <section className="card p-4 text-amber-700 dark:text-amber-300">
            <ul className="list-disc pl-5 space-y-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        {errorModal && (
          <ErrorModal
            title={errorModal.title}
            message={errorModal.message}
            onClose={() => setErrorModal(null)}
          />
        )}

        {stagedImport && (
          <TypeReviewModal
            headers={stagedImport.headers}
            types={stagedImport.types}
            onChangeType={(h, t) =>
              setStagedImport((prev) =>
                prev ? { ...prev, types: { ...prev.types, [h]: t } } : prev
              )
            }
            onCancel={() => setStagedImport(null)}
            onConfirm={() => {
              if (!stagedImport) return;
              const sig = signatureOf(stagedImport.headers);
              if (appendMode === "replace" || headers.length === 0) {
                setHeaders(stagedImport.headers);
                setRows(stagedImport.rows);
                setSelectedColumns(stagedImport.headers);
                setWarnings((w) => [...w, ...stagedImport.warnings]);
                setColumnTypes(stagedImport.types);
                setTypeProfiles((prev) => ({
                  ...prev,
                  [sig]: stagedImport.types,
                }));
              } else {
                setRows((r) => [...r, ...stagedImport.rows]);
                setWarnings((w) => [...w, ...stagedImport.warnings]);
                setColumnTypes((prev) => ({ ...prev, ...stagedImport.types }));
                setTypeProfiles((prev) => ({
                  ...prev,
                  [sig]: { ...(prev[sig] ?? {}), ...stagedImport.types },
                }));
              }
              setStagedImport(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
