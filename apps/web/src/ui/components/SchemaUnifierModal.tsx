import React, { useState, useMemo, useCallback, useEffect } from "react";
import type { ColumnMapping, ColumnType, SchemaUnifierData } from "../types";
import { generateMappingSuggestions } from "../utils/fuzzyMatcher";
import { inferColumnTypes } from "../utils/csv";
import { ColumnMapper } from "./ColumnMapper";
import { SchemaPreview } from "./SchemaPreview";

type Props = {
  data: SchemaUnifierData;
  onConfirm: (finalData: SchemaUnifierData) => void;
  onCancel: () => void;
};

export function SchemaUnifierModal({
  data,
  onConfirm,
  onCancel,
}: Props): JSX.Element {
  const [mappings, setMappings] = useState<Record<string, ColumnMapping>>(
    () => {
      // Initialize with auto-generated mappings
      if (Object.keys(data.mappings).length > 0) {
        return data.mappings;
      }

      const allNewColumns = data.newFiles.flatMap((file) =>
        Array.from(file.headers)
      );
      const uniqueNewColumns = Array.from(new Set(allNewColumns));
      const suggestions = generateMappingSuggestions(
        uniqueNewColumns,
        data.existingHeaders
      );

      const initialMappings: Record<string, ColumnMapping> = {};
      uniqueNewColumns.forEach((column) => {
        const suggestion = suggestions[column];
        initialMappings[column] = {
          sourceColumn: column,
          targetColumn: suggestion?.column || null,
          targetType: "text", // Will be updated below
          confidence: suggestion?.confidence,
          matchType: suggestion?.matchType,
        };
      });

      return initialMappings;
    }
  );

  const [finalColumnOrder, setFinalColumnOrder] = useState<string[]>(() => {
    if (data.finalColumnOrder.length > 0) {
      return data.finalColumnOrder;
    }

    // Generate default order: existing columns (with unified mappings), then new columns
    const existingColumnsUsed = new Set<string>();
    const newColumns: string[] = [];

    Object.values(mappings).forEach((mapping) => {
      if (mapping.targetColumn) {
        existingColumnsUsed.add(mapping.targetColumn);
      } else {
        newColumns.push(mapping.sourceColumn);
      }
    });

    // Start with existing columns that are being used
    const orderedExisting = data.existingHeaders.filter((col) =>
      existingColumnsUsed.has(col)
    );

    // Add existing columns that aren't being unified with new ones
    const unusedExisting = data.existingHeaders.filter(
      (col) => !existingColumnsUsed.has(col)
    );

    return [...orderedExisting, ...unusedExisting, ...newColumns];
  });

  const [finalColumnTypes, setFinalColumnTypes] = useState<
    Record<string, ColumnType>
  >(() => {
    if (Object.keys(data.finalColumnTypes).length > 0) {
      return data.finalColumnTypes;
    }

    // Infer types for all columns
    const allSampleRows = data.newFiles.flatMap((file) => file.sampleRows);
    const allHeaders = Array.from(
      new Set([...data.existingHeaders, ...finalColumnOrder])
    );

    return inferColumnTypes(
      allHeaders,
      allSampleRows.map((row) => ({ ...row, _rid: "temp" }))
    );
  });

  const [activeTab, setActiveTab] = useState(0);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);

  // Get all unique source columns from new files
  const allSourceColumns = useMemo(() => {
    const columns = data.newFiles.flatMap((file) => Array.from(file.headers));
    return Array.from(new Set(columns));
  }, [data.newFiles]);

  // Calculate real-time final column order based on current mappings
  const calculatedFinalColumnOrder = useMemo(() => {
    const existingColumnsUsed = new Set<string>();
    const newColumns: string[] = [];

    Object.values(mappings).forEach((mapping) => {
      if (mapping.targetColumn) {
        existingColumnsUsed.add(mapping.targetColumn);
      } else {
        newColumns.push(mapping.sourceColumn);
      }
    });

    // Start with existing columns that are being mapped to
    const orderedExisting = data.existingHeaders.filter((col) =>
      existingColumnsUsed.has(col)
    );

    // Add existing columns that aren't being unified with new ones
    const unusedExisting = data.existingHeaders.filter(
      (col) => !existingColumnsUsed.has(col)
    );

    return [...orderedExisting, ...unusedExisting, ...newColumns];
  }, [mappings, data.existingHeaders]);

  // Update finalColumnOrder when mappings change
  useEffect(() => {
    setFinalColumnOrder(calculatedFinalColumnOrder);
  }, [calculatedFinalColumnOrder]);

  const handleMappingChange = useCallback(
    (sourceColumn: string, mapping: ColumnMapping) => {
      setMappings((prev) => ({
        ...prev,
        [sourceColumn]: mapping,
      }));

      // Update type for the target column
      const targetCol = mapping.targetColumn || sourceColumn;
      setFinalColumnTypes((prev) => ({
        ...prev,
        [targetCol]: mapping.targetType,
      }));
    },
    []
  );

  const handleColumnReorder = useCallback((newOrder: string[]) => {
    setFinalColumnOrder(newOrder);
  }, []);

  const handleTypeChange = useCallback((column: string, type: ColumnType) => {
    setFinalColumnTypes((prev) => ({
      ...prev,
      [column]: type,
    }));
  }, []);

  const handleResetToDefaults = useCallback(() => {
    // Regenerate default mappings
    const suggestions = generateMappingSuggestions(
      allSourceColumns,
      data.existingHeaders
    );
    const defaultMappings: Record<string, ColumnMapping> = {};

    allSourceColumns.forEach((column) => {
      const suggestion = suggestions[column];
      defaultMappings[column] = {
        sourceColumn: column,
        targetColumn: suggestion?.column || null,
        targetType: "text",
        confidence: suggestion?.confidence,
        matchType: suggestion?.matchType,
      };
    });

    setMappings(defaultMappings);

    // Reset order and types
    const existingColumnsUsed = new Set<string>();
    const newColumns: string[] = [];

    Object.values(defaultMappings).forEach((mapping) => {
      if (mapping.targetColumn) {
        existingColumnsUsed.add(mapping.targetColumn);
      } else {
        newColumns.push(mapping.sourceColumn);
      }
    });

    const orderedExisting = data.existingHeaders.filter((col) =>
      existingColumnsUsed.has(col)
    );
    const unusedExisting = data.existingHeaders.filter(
      (col) => !existingColumnsUsed.has(col)
    );
    const defaultOrder = [...orderedExisting, ...unusedExisting, ...newColumns];

    setFinalColumnOrder(defaultOrder);

    // Infer types
    const allSampleRows = data.newFiles.flatMap((file) => file.sampleRows);
    const defaultTypes = inferColumnTypes(
      defaultOrder,
      allSampleRows.map((row) => ({ ...row, _rid: "temp" }))
    );
    setFinalColumnTypes(defaultTypes);
  }, [allSourceColumns, data.existingHeaders, data.newFiles]);

  const handleConfirm = useCallback(() => {
    const finalData: SchemaUnifierData = {
      ...data,
      mappings,
      finalColumnOrder,
      finalColumnTypes,
    };
    onConfirm(finalData);
  }, [data, mappings, finalColumnOrder, finalColumnTypes, onConfirm]);

  // Calculate statistics in real-time
  const stats = useMemo(() => {
    const totalNewColumns = allSourceColumns.length;
    const mappedToExisting = Object.values(mappings).filter(
      (m) => m.targetColumn
    ).length;
    const newColumnsCreated = totalNewColumns - mappedToExisting;

    return {
      totalNewColumns,
      mappedToExisting,
      newColumnsCreated,
      finalColumnCount: calculatedFinalColumnOrder.length,
    };
  }, [allSourceColumns, mappings, calculatedFinalColumnOrder]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-7xl h-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Unify CSV Schemas
            </h2>
            <p className="text-sm text-slate-600 dark:text-white/70 mt-1">
              Merging {data.newFiles.length} file
              {data.newFiles.length > 1 ? "s" : ""} with existing data
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-600 dark:text-white/70 space-y-1">
              <div>New columns: {stats.totalNewColumns}</div>
              <div>
                Mapped: {stats.mappedToExisting} | New:{" "}
                {stats.newColumnsCreated}
              </div>
              <div>Final: {stats.finalColumnCount} columns</div>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white/80 p-2"
              title="Cancel import"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel - Existing schema (collapsible) */}
          <div
            className={`${
              leftPanelCollapsed ? "w-12" : "w-64"
            } border-r border-slate-200 dark:border-white/10 overflow-hidden transition-all duration-300 ease-in-out`}
          >
            <div className="h-full flex flex-col">
              {/* Collapse button */}
              <div className="p-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                {!leftPanelCollapsed && (
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Existing Schema ({data.existingHeaders.length})
                  </h3>
                )}
                <button
                  onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-white/60"
                  title={
                    leftPanelCollapsed
                      ? "Expand existing schema"
                      : "Collapse existing schema"
                  }
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`transition-transform duration-200 ${
                      leftPanelCollapsed ? "rotate-180" : ""
                    }`}
                  >
                    <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              {!leftPanelCollapsed && (
                <div className="flex-1 p-3 overflow-y-auto">
                  <div className="space-y-2">
                    {data.existingHeaders.map((header, index) => (
                      <div
                        key={header}
                        className="flex items-center gap-3 p-2 rounded bg-slate-50 dark:bg-white/5"
                      >
                        <span className="text-xs text-slate-400 dark:text-white/40 w-6">
                          {index + 1}
                        </span>
                        <span className="font-mono text-xs text-slate-900 dark:text-white flex-1 truncate">
                          {header}
                        </span>
                      </div>
                    ))}
                    {data.existingHeaders.length === 0 && (
                      <p className="text-xs text-slate-500 dark:text-white/60 italic">
                        No existing data
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center panel - Mapping configuration */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Column Mapping
              </h3>
              <button
                onClick={handleResetToDefaults}
                className="text-xs px-3 py-1 rounded border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Reset to Defaults
              </button>
            </div>

            <div className="space-y-4">
              {allSourceColumns.map((column) => (
                <ColumnMapper
                  key={column}
                  sourceColumn={column}
                  mapping={mappings[column]}
                  existingColumns={data.existingHeaders}
                  onMappingChange={handleMappingChange}
                />
              ))}
              {allSourceColumns.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-white/60 italic text-center py-8">
                  No new columns to map
                </p>
              )}
            </div>
          </div>

          {/* Right panel - Final schema preview only */}
          <div className="w-96 border-l border-slate-200 dark:border-white/10 overflow-hidden flex flex-col">
            {/* Header with new files indicator */}
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Final Schema
                </h3>
                <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                  {stats.finalColumnCount} columns
                </span>
              </div>

              {/* New files summary */}
              <details className="group">
                <summary className="text-xs text-slate-600 dark:text-white/70 cursor-pointer hover:text-slate-900 dark:hover:text-white flex items-center gap-1">
                  <svg
                    className="w-3 h-3 transition-transform group-open:rotate-90"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                  </svg>
                  {data.newFiles.length} new file
                  {data.newFiles.length > 1 ? "s" : ""} with{" "}
                  {stats.totalNewColumns} columns
                </summary>
                <div className="mt-2 space-y-1 pl-4">
                  {data.newFiles.map((file) => (
                    <div
                      key={file.name}
                      className="text-xs text-slate-500 dark:text-white/60"
                    >
                      📄 {file.name} ({file.headers.length} cols)
                    </div>
                  ))}
                </div>
              </details>
            </div>

            {/* Schema preview content */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col">
              <SchemaPreview
                columns={finalColumnOrder}
                columnTypes={finalColumnTypes}
                onReorder={handleColumnReorder}
                onTypeChange={handleTypeChange}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-200 dark:border-white/10">
          <div className="text-sm text-slate-600 dark:text-white/70">
            {stats.finalColumnCount} total columns after merge
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-slate-300 dark:border-white/20 rounded-lg text-slate-700 dark:text-white/90 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Confirm & Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
