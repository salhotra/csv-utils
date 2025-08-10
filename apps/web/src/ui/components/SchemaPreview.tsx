import React, { useState, useMemo } from "react";
import type { ColumnType } from "../types";

type Props = {
  columns: string[];
  columnTypes: Record<string, ColumnType>;
  onReorder: (newOrder: string[]) => void;
  onTypeChange: (column: string, type: ColumnType) => void;
  originalOrder?: string[]; // Optional: to allow reset to original order
};

export function SchemaPreview({
  columns,
  columnTypes,
  onReorder,
  onTypeChange,
  originalOrder,
}: Props): JSX.Element {
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

    const newOrder = [...columns];
    const draggedItem = newOrder[draggedIndex];

    // Remove the dragged item
    newOrder.splice(draggedIndex, 1);

    // Insert at the new position
    const insertIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newOrder.splice(insertIndex, 0, draggedItem);

    onReorder(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Final Schema ({columns.length} columns)
        </h3>
        <div className="flex items-center gap-2">
          {originalOrder && (
            <button
              onClick={() => onReorder(originalOrder)}
              className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              title="Reset to original order"
            >
              Reset
            </button>
          )}
          <button
            onClick={() => {
              // Sort alphabetically
              const sorted = [...columns].sort((a, b) => a.localeCompare(b));
              onReorder(sorted);
            }}
            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            title="Sort columns alphabetically"
          >
            A→Z
          </button>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3 mb-4">
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
              Customize Your Schema
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              • <strong>Drag</strong> columns to reorder
              <br />• <strong>Click</strong> data type dropdown to change types
              <br />• <strong>Use A→Z</strong> button to sort alphabetically
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
        {columns.map((column, index) => (
          <div
            key={column}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`
              flex items-center gap-3 p-3 rounded-lg border cursor-move transition-all
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
            <div className="text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/60 transition-colors">
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
            <div className="w-8 text-xs font-medium text-slate-500 dark:text-white/60 text-center bg-slate-100 dark:bg-white/10 rounded px-1">
              {index + 1}
            </div>

            {/* Column name */}
            <div className="flex-1 min-w-0">
              <span className="font-mono text-sm font-medium text-slate-900 dark:text-white truncate block">
                {column}
              </span>
            </div>

            {/* Type selector with icon */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 dark:text-white/60">
                {columnTypes[column] === "number" ? "🔢" : "📝"}
              </span>
              <select
                value={columnTypes[column] || "text"}
                onChange={(e) =>
                  onTypeChange(column, e.target.value as ColumnType)
                }
                className="text-xs px-2 py-1.5 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-white/10 text-slate-900 dark:text-white hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                onClick={(e) => e.stopPropagation()}
                title="Change data type"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {columns.length === 0 && (
        <div className="text-center py-8 text-slate-500 dark:text-white/60">
          <p className="text-sm">No columns to display</p>
        </div>
      )}
    </div>
  );
}
