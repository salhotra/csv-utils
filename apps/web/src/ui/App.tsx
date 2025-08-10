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
            setAppendMode={setAppendModeInStore}
            onUpload={onUpload}
            onDownload={downloadCsv}
            canDownload={headers.length > 0}
            onDeleteSelected={() => {
              if (selectedRowIds.size === 0) return;
              removeRowsByIds(selectedRowIds);
              setSelectedRowIds(new Set());
            }}
            canDelete={selectedRowIds.size > 0}
            onEditColumns={handleEditColumns}
            canEdit={headers.length > 0}
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
              }
            />
          </div>
        </div>

        <div className="flex gap-4 px-6 flex-1 min-h-0">
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

        {warnings.length > 0 && (
          <section className="card p-4 text-amber-700 dark:text-amber-300">
            <ul className="list-disc pl-5 space-y-1">
              {warnings.map((w: string, i: number) => (
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
