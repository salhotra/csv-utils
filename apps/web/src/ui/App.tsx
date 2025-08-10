import React, { useEffect, useMemo, useState } from "react";
import { useSnapshot } from "valtio";
import { parseCsvFile } from "@csv-utils/io-browser";
import type { UiRow, ColumnType, SchemaUnifierData } from "./types";
import { DataTable } from "./components/DataTable";
import { Toolbar } from "./components/Toolbar";
import { SearchBar } from "./components/SearchBar";
import { ColumnsFilter } from "./components/ColumnsFilter";
import { ErrorModal } from "./components/ErrorModal";
import { TypeReviewModal } from "./components/TypeReviewModal";
import { SchemaUnifierModal } from "./components/SchemaUnifierModal";
import { ColumnEditorModal } from "./components/ColumnEditorModal";
import { useTypeProfiles } from "./hooks/useTypeProfiles";
import { stampRow, inferColumnTypes, signatureOf } from "./utils/csv";
import {
  store,
  setAppendMode as setAppendModeInStore,
  addWarnings as addWarningsToStore,
  replaceData as replaceDataInStore,
  appendData as appendDataInStore,
  removeRowsByIds,
  type UploadedFile,
} from "./store";
import { FileSidebar } from "./components/FileSidebar";
import { ThemeToggle } from "./components/ThemeToggle";

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
  const snap = useSnapshot(store);
  const headers = snap.headers;
  const rows = snap.rows;
  const warnings = snap.warnings;
  const appendMode = snap.appendMode;
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
    uploadedFiles?: UploadedFile[];
  } | null>(null);
  const [schemaUnifierData, setSchemaUnifierData] =
    useState<SchemaUnifierData | null>(null);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);

  // no-op here; persistence handled by hook

  const filteredRows = useMemo(() => {
    if (!searchText.trim() || selectedColumns.length === 0) return rows;
    const needle = searchText.toLowerCase();
    return rows.filter((r: UiRow) =>
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
      // Stamp rows and annotate with file provenance
      const uploadedFiles: UploadedFile[] = [];
      const allStampedRows: UiRow[] = [];
      const sig = signatureOf(h as readonly string[]);
      files.forEach((file, i) => {
        const p = parsedAll[i];
        if (!p || p.headers.length === 0) return;
        const fileId =
          (globalThis as any).crypto?.randomUUID?.() ??
          `f_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const stamped = p.rows.map((row) => {
          const baseRow: Record<string, string> = {
            ...row,
            __fileId: fileId,
            __fileName: file.name,
          };
          const stampedRow = stampRow(baseRow);
          return stampedRow;
        });
        allStampedRows.push(...stamped);
        uploadedFiles.push({
          id: fileId,
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          appendedAt: Date.now(),
          headers: p.headers,
          rowCount: p.rows.length,
          skippedCount: p.skippedRows?.length ?? 0,
          warnings: p.warnings ?? [],
          schemaSignature: sig,
          sampleRows: stamped.slice(0, 5),
        });
      });
      const known = typeProfiles[sig];
      if (known) {
        // Known schema: skip type review
        replaceDataInStore({ headers: h, rows: allStampedRows, uploadedFiles });
        setSelectedColumns(h);
        addWarningsToStore(newWarnings);
        setColumnTypes(known);
      } else {
        const inferred = inferColumnTypes(h, allStampedRows);
        setStagedImport({
          headers: h,
          rows: allStampedRows,
          warnings: newWarnings,
          types: inferred,
          uploadedFiles,
        });
      }
      return;
    }

    // append mode
    const h = headers as string[];
    const allMatchExisting = valid.every(
      (p: Parsed) =>
        p.headers.length === h.length &&
        p.headers.every((x: string, i: number) => x === h[i])
    );
    if (!allMatchExisting) {
      // Schema mismatch detected - open schema unifier
      const newFiles = files
        .map((file, i) => {
          const p = parsedAll[i];
          if (!p || p.headers.length === 0) return null;

          return {
            name: file.name,
            headers: p.headers,
            sampleRows: p.rows.slice(0, 5),
            allRows: p.rows,
            size: file.size,
            lastModified: file.lastModified,
            warnings: p.warnings ?? [],
            skippedRows: p.skippedRows,
          };
        })
        .filter(Boolean) as SchemaUnifierData["newFiles"];

      setSchemaUnifierData({
        existingHeaders: h,
        newFiles,
        mappings: {},
        finalColumnOrder: [],
        finalColumnTypes: {},
      });
      return;
    }
    // Append mode: annotate with file provenance
    const uploadedFiles: UploadedFile[] = [];
    const nextRows: UiRow[] = [];
    files.forEach((file, i) => {
      const p = parsedAll[i];
      if (!p || p.headers.length === 0) return;
      const fileId =
        (globalThis as any).crypto?.randomUUID?.() ??
        `f_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const stamped = p.rows.map((row) => {
        const baseRow: Record<string, string> = {
          ...row,
          __fileId: fileId,
          __fileName: file.name,
        };
        const stampedRow = stampRow(baseRow);
        return stampedRow;
      });
      nextRows.push(...stamped);
      uploadedFiles.push({
        id: fileId,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        appendedAt: Date.now(),
        headers: p.headers,
        rowCount: p.rows.length,
        skippedCount: p.skippedRows?.length ?? 0,
        warnings: p.warnings ?? [],
        schemaSignature: signatureOf(headers as readonly string[]),
        sampleRows: stamped.slice(0, 5),
      });
    });
    // Columns match existing -> skip review and append directly
    appendDataInStore({ rows: nextRows, uploadedFiles });
    addWarningsToStore(newWarnings);
  };

  // Schema unifier handlers
  const handleSchemaUnifierConfirm = async (unifiedData: SchemaUnifierData) => {
    setSchemaUnifierData(null);

    // Get the cached file data from the unifier data
    const newFiles = unifiedData.newFiles;
    if (!newFiles.length) return;

    // Create unified rows based on the mapping
    const uploadedFiles: UploadedFile[] = [];
    const nextRows: UiRow[] = [];
    const finalHeaders = unifiedData.finalColumnOrder;

    newFiles.forEach((fileData) => {
      const fileId =
        (globalThis as any).crypto?.randomUUID?.() ??
        `f_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Map each row according to the schema unifier mappings
      const mappedRows = fileData.allRows.map((row) => {
        const unifiedRow: Record<string, string> = {};

        // Initialize all final columns with empty strings
        finalHeaders.forEach((header) => {
          unifiedRow[header] = "";
        });

        // Map data based on the column mappings
        Object.entries(unifiedData.mappings).forEach(
          ([sourceColumn, mapping]) => {
            if (row[sourceColumn] !== undefined) {
              const targetColumn = mapping.targetColumn || sourceColumn;
              unifiedRow[targetColumn] = row[sourceColumn];
            }
          }
        );

        // Add file metadata
        unifiedRow.__fileId = fileId;
        unifiedRow.__fileName = fileData.name;

        return stampRow(unifiedRow);
      });

      nextRows.push(...mappedRows);
      uploadedFiles.push({
        id: fileId,
        name: fileData.name,
        size: fileData.size,
        lastModified: fileData.lastModified,
        appendedAt: Date.now(),
        headers: finalHeaders,
        rowCount: mappedRows.length,
        skippedCount: fileData.skippedRows?.length ?? 0,
        warnings: fileData.warnings,
        schemaSignature: signatureOf(finalHeaders),
        sampleRows: mappedRows.slice(0, 5),
      });
    });

    // Update the existing data with empty strings for new columns
    const existingRowsWithNewColumns = rows.map((row) => {
      const updatedRow = { ...row };
      finalHeaders.forEach((header) => {
        if (!(header in updatedRow)) {
          updatedRow[header] = "";
        }
      });
      return updatedRow;
    });

    // Update store with unified schema
    replaceDataInStore({
      headers: finalHeaders,
      rows: [...existingRowsWithNewColumns, ...nextRows],
      uploadedFiles: [...store.uploadedFiles, ...uploadedFiles],
    });
    setSelectedColumns(finalHeaders);
    setColumnTypes(unifiedData.finalColumnTypes);
  };

  const handleSchemaUnifierCancel = () => {
    setSchemaUnifierData(null);
  };

  // Column editor handlers
  const handleEditColumns = () => {
    setColumnEditorOpen(true);
  };

  const handleColumnEditorConfirm = ({
    newHeaders,
    newColumnTypes,
    columnRenames,
  }: {
    newHeaders: string[];
    newColumnTypes: Record<string, ColumnType>;
    columnRenames: Record<string, string>;
  }) => {
    setColumnEditorOpen(false);

    // Update rows with renamed columns
    const updatedRows = rows.map((row) => {
      const newRow: Record<string, string> = { _rid: row._rid };

      // Copy data with new column names
      newHeaders.forEach((newHeader) => {
        // Find the original header name
        const originalHeader =
          Object.entries(columnRenames).find(
            ([_, newName]) => newName === newHeader
          )?.[0] || newHeader;

        newRow[newHeader] = row[originalHeader] || "";
      });

      return newRow as UiRow;
    });

    // Update uploaded files metadata
    const updatedUploadedFiles = store.uploadedFiles.map((file) => ({
      ...file,
      headers: newHeaders,
      schemaSignature: signatureOf(newHeaders),
    }));

    // Update store
    replaceDataInStore({
      headers: newHeaders,
      rows: updatedRows,
      uploadedFiles: updatedUploadedFiles,
    });

    // Update other state
    setSelectedColumns(newHeaders);
    setColumnTypes(newColumnTypes);

    // Update type profiles with new signature
    const newSignature = signatureOf(newHeaders);
    setTypeProfiles((prev) => ({ ...prev, [newSignature]: newColumnTypes }));
  };

  const handleColumnEditorCancel = () => {
    setColumnEditorOpen(false);
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
    lines.push(headers.map((h: string) => escapeCell(h)).join(","));
    for (const row of filteredRows) {
      lines.push(
        headers.map((h: string) => escapeCell(String(row[h] ?? ""))).join(",")
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

  // Show empty state when no data is loaded
  if (headers.length === 0) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-white dark:from-surface dark:to-panel">
        {/* Header */}
        <header className="border-b border-slate-200/60 dark:border-white/5 bg-white/80 dark:bg-surface/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-semibold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                csv-utils
              </h1>
            </div>
            <ThemeToggle
              theme={theme}
              onToggle={() =>
                setTheme((t) => (t === "dark" ? "light" : "dark"))
              }
            />
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-2xl text-center space-y-8">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-600/20 dark:from-accent/30 dark:to-purple-600/30 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-accent"
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
            </div>

            {/* Heading */}
            <div className="space-y-4">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent">
                Transform Your CSV Data
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                Upload, analyze, and manipulate CSV files with powerful tools.
                Search, filter, edit columns, and export your data effortlessly.
              </p>
            </div>

            {/* Upload Action */}
            <div className="space-y-6">
              <label className="group relative cursor-pointer">
                <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-2xl hover:border-accent dark:hover:border-accent transition-all duration-300 hover:bg-accent/5 dark:hover:bg-accent/10">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <svg
                      className="w-6 h-6 text-accent"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <div className="text-lg font-semibold text-slate-900 dark:text-white">
                      Drop CSV files here or click to browse
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Supports multiple files • Automatic schema detection
                    </div>
                  </div>
                </div>
                <input
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  type="file"
                  accept=".csv"
                  multiple
                  onChange={onUpload}
                />
              </label>

              {/* Mode Selection */}
              <div className="flex items-center justify-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="radio"
                    name="uploadMode"
                    checked={appendMode === "replace"}
                    onChange={() => setAppendModeInStore("replace")}
                    className="text-accent focus:ring-accent"
                  />
                  Replace existing data
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="radio"
                    name="uploadMode"
                    checked={appendMode === "append"}
                    onChange={() => setAppendModeInStore("append")}
                    className="text-accent focus:ring-accent"
                  />
                  Append to existing
                </label>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                  <svg
                    className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">
                  Search & Filter
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Find data instantly
                </div>
              </div>
              <div className="text-center space-y-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
                  <svg
                    className="w-4 h-4 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">
                  Edit Columns
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Rename and reorder
                </div>
              </div>
              <div className="text-center space-y-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto">
                  <svg
                    className="w-4 h-4 text-purple-600 dark:text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">
                  Export Data
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Download filtered results
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Error Modal */}
        {errorModal && (
          <ErrorModal
            title={errorModal.title}
            message={errorModal.message}
            onClose={() => setErrorModal(null)}
          />
        )}

        {/* Type Review Modal */}
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
                replaceDataInStore({
                  headers: stagedImport.headers,
                  rows: stagedImport.rows,
                  uploadedFiles: stagedImport.uploadedFiles ?? [],
                });
                setSelectedColumns([...stagedImport.headers]);
                addWarningsToStore(stagedImport.warnings);
                setColumnTypes(stagedImport.types);
                setTypeProfiles((prev) => ({
                  ...prev,
                  [sig]: stagedImport.types,
                }));
              } else {
                appendDataInStore({
                  rows: stagedImport.rows,
                  uploadedFiles: stagedImport.uploadedFiles ?? [],
                });
                addWarningsToStore(stagedImport.warnings);
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

        {/* Schema Unifier Modal */}
        {schemaUnifierData && (
          <SchemaUnifierModal
            data={schemaUnifierData}
            onConfirm={handleSchemaUnifierConfirm}
            onCancel={handleSchemaUnifierCancel}
          />
        )}

        {/* Column Editor Modal */}
        {columnEditorOpen && (
          <ColumnEditorModal
            headers={headers}
            columnTypes={columnTypes}
            onConfirm={handleColumnEditorConfirm}
            onCancel={handleColumnEditorCancel}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 dark:bg-surface flex flex-col">
      <div className="w-full space-y-4 flex-1 flex flex-col min-h-0 pb-4">
        {/* Modern Header */}
        <header className="border-b border-slate-200/60 dark:border-white/5 bg-white/80 dark:bg-surface/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  csv-utils
                </h1>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <ThemeToggle
                  theme={theme}
                  onToggle={() =>
                    setTheme((t) => (t === "dark" ? "light" : "dark"))
                  }
                />

                <div className="h-6 w-px bg-slate-300 dark:bg-white/20"></div>

                <label className="btn cursor-pointer">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  Upload
                  <input
                    className="hidden"
                    type="file"
                    accept=".csv"
                    multiple
                    onChange={onUpload}
                  />
                </label>

                <button
                  className="btn secondary"
                  onClick={downloadCsv}
                  disabled={headers.length === 0}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Export
                </button>

                <div className="h-6 w-px bg-slate-300 dark:bg-white/20"></div>

                <button
                  className="btn secondary"
                  onClick={handleEditColumns}
                  disabled={headers.length === 0}
                  title="Edit column names, types, and order"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  Edit
                </button>

                <button
                  className="btn destructive"
                  onClick={() => {
                    if (selectedRowIds.size === 0) return;
                    removeRowsByIds(selectedRowIds);
                    setSelectedRowIds(new Set());
                  }}
                  disabled={selectedRowIds.size === 0}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete ({selectedRowIds.size})
                </button>
              </div>
            </div>

            {/* Search and Controls */}
            <div className="flex items-center gap-4">
              <div className="flex-1 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-panel border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none"
                    placeholder="Search across columns..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                  {searchText && (
                    <button
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      onClick={() => setSearchText("")}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                <ColumnsFilter
                  headers={headers}
                  selectedColumns={selectedColumns}
                  columnsOpen={columnsOpen}
                  setColumnsOpen={setColumnsOpen}
                  columnQuery={columnQuery}
                  setColumnQuery={setColumnQuery}
                  onToggleColumn={(h: string, checked: boolean) =>
                    setSelectedColumns((cols) =>
                      checked
                        ? Array.from(new Set([...cols, h]))
                        : cols.filter((c) => c !== h)
                    )
                  }
                  totalRows={totalRows}
                  filteredCount={filteredCount}
                />
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                <select
                  className="px-3 py-1.5 text-xs bg-white dark:bg-panel border border-slate-200 dark:border-white/10 rounded-md"
                  value={appendMode}
                  onChange={(e) =>
                    setAppendModeInStore(e.target.value as "append" | "replace")
                  }
                >
                  <option value="replace">Replace mode</option>
                  <option value="append">Append mode</option>
                </select>
                <div className="text-sm font-medium">
                  {searchText
                    ? `${filteredCount.toLocaleString()} of ${totalRows.toLocaleString()} rows`
                    : `${totalRows.toLocaleString()} rows`}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex gap-6 p-6 min-h-0">
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
          <FileSidebar />
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="px-6 pb-6">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-amber-500 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div className="flex-1">
                  <h3 className="font-medium text-amber-900 dark:text-amber-200 mb-2">
                    Import Warnings
                  </h3>
                  <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-300">
                    {warnings.map((w: string, i: number) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
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
                replaceDataInStore({
                  headers: stagedImport.headers,
                  rows: stagedImport.rows,
                  uploadedFiles: stagedImport.uploadedFiles ?? [],
                });
                setSelectedColumns([...stagedImport.headers]);
                addWarningsToStore(stagedImport.warnings);
                setColumnTypes(stagedImport.types);
                setTypeProfiles((prev) => ({
                  ...prev,
                  [sig]: stagedImport.types,
                }));
              } else {
                appendDataInStore({
                  rows: stagedImport.rows,
                  uploadedFiles: stagedImport.uploadedFiles ?? [],
                });
                addWarningsToStore(stagedImport.warnings);
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

        {schemaUnifierData && (
          <SchemaUnifierModal
            data={schemaUnifierData}
            onConfirm={handleSchemaUnifierConfirm}
            onCancel={handleSchemaUnifierCancel}
          />
        )}

        {columnEditorOpen && (
          <ColumnEditorModal
            headers={headers}
            columnTypes={columnTypes}
            onConfirm={handleColumnEditorConfirm}
            onCancel={handleColumnEditorCancel}
          />
        )}
      </div>
    </div>
  );
}
