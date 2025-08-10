import React, { useState, useCallback } from "react";
import type { ColumnType } from "../types";

type ColumnInfo = {
  name: string;
  type: ColumnType;
  originalName: string; // To track renames
};

type Props = {
  headers: readonly string[];
  columnTypes: Record<string, ColumnType>;
  onConfirm: (updates: {
    newHeaders: string[];
    newColumnTypes: Record<string, ColumnType>;
    columnRenames: Record<string, string>; // oldName -> newName
  }) => void;
  onCancel: () => void;
};

export function ColumnEditorModal({
  headers,
  columnTypes,
  onConfirm,
  onCancel,
}: Props): JSX.Element {
  const [columns, setColumns] = useState<ColumnInfo[]>(() =>
    headers.map((header) => ({
      name: header,
      type: columnTypes[header] || "text",
      originalName: header,
    }))
  );

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newColumns = [...columns];
    const draggedItem = newColumns[draggedIndex];

    // Remove the dragged item
    newColumns.splice(draggedIndex, 1);

    // Insert at the new position
    const insertIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newColumns.splice(insertIndex, 0, draggedItem);

    setColumns(newColumns);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleNameChange = useCallback((index: number, newName: string) => {
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, name: newName } : col))
    );
  }, []);

  const handleTypeChange = useCallback((index: number, newType: ColumnType) => {
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, type: newType } : col))
    );
  }, []);

  const handleResetOrder = useCallback(() => {
    setColumns(
      headers.map((header) => ({
        name: header,
        type: columnTypes[header] || "text",
        originalName: header,
      }))
    );
  }, [headers, columnTypes]);

  const handleSortAlphabetically = useCallback(() => {
    setColumns((prev) =>
      [...prev].sort((a, b) => a.name.localeCompare(b.name))
    );
  }, []);

  const handleConfirm = useCallback(() => {
    const newHeaders = columns.map((col) => col.name);
    const newColumnTypes: Record<string, ColumnType> = {};
    const columnRenames: Record<string, string> = {};

    columns.forEach((col) => {
      newColumnTypes[col.name] = col.type;
      if (col.originalName !== col.name) {
        columnRenames[col.originalName] = col.name;
      }
    });

    onConfirm({ newHeaders, newColumnTypes, columnRenames });
  }, [columns, onConfirm]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-4xl h-full max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Edit Columns
            </h2>
            <p className="text-sm text-slate-600 dark:text-white/70 mt-1">
              Rename, reorder, and change data types for your columns
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white/80 p-2"
            title="Cancel editing"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          {/* Controls */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Columns ({columns.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetOrder}
                className="text-xs px-3 py-1.5 rounded border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                Reset Order
              </button>
              <button
                onClick={handleSortAlphabetically}
                className="text-xs px-3 py-1.5 rounded border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                A→Z
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" />
              </svg>
              <div>
                <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Edit Your Columns
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  • <strong>Drag</strong> columns to reorder
                  <br />• <strong>Click</strong> in name field to rename
                  <br />• <strong>Select</strong> data type from dropdown
                  <br />• <strong>Use buttons</strong> to reset or sort
                </p>
              </div>
            </div>
          </div>

          {/* Column list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-3">
              {columns.map((column, index) => (
                <div
                  key={`${column.originalName}-${index}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`
                    flex items-center gap-4 p-4 rounded-lg border cursor-move transition-all
                    ${
                      draggedIndex === index
                        ? "opacity-50 bg-slate-100 dark:bg-white/10"
                        : "bg-white dark:bg-white/5"
                    }
                    ${
                      dragOverIndex === index
                        ? "border-blue-400 bg-blue-50 dark:bg-blue-500/10"
                        : "border-slate-200 dark:border-white/10"
                    }
                    hover:border-slate-300 dark:hover:border-white/20
                  `}
                >
                  {/* Drag handle */}
                  <div className="text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/60 transition-colors flex-shrink-0">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-label="Drag to reorder"
                    >
                      <path d="M6 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM6 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM6 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM12 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM12 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM12 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                    </svg>
                  </div>

                  {/* Column order */}
                  <div className="w-8 text-xs font-medium text-slate-500 dark:text-white/60 text-center bg-slate-100 dark:bg-white/10 rounded px-1 flex-shrink-0">
                    {index + 1}
                  </div>

                  {/* Column name editor */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={column.name}
                      onChange={(e) => handleNameChange(index, e.target.value)}
                      className="w-full font-mono text-sm font-medium bg-transparent border-0 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                      placeholder="Column name"
                    />
                    {column.originalName !== column.name && (
                      <p className="text-xs text-slate-500 dark:text-white/60 mt-1 px-2">
                        Originally: {column.originalName}
                      </p>
                    )}
                  </div>

                  {/* Type selector with icon */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm">
                      {column.type === "number" ? "🔢" : "📝"}
                    </span>
                    <select
                      value={column.type}
                      onChange={(e) =>
                        handleTypeChange(index, e.target.value as ColumnType)
                      }
                      className="text-sm px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-white/10 text-slate-900 dark:text-white hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-200 dark:border-white/10">
          <div className="text-sm text-slate-600 dark:text-white/70">
            {columns.length} columns configured
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
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
