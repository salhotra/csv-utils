import React, { useState } from "react";
import type { ColumnType } from "../types";

type Props = {
  columns: string[];
  columnTypes: Record<string, ColumnType>;
  onReorder: (newOrder: string[]) => void;
  onTypeChange: (column: string, type: ColumnType) => void;
};

export function SchemaPreview({
  columns,
  columnTypes,
  onReorder,
  onTypeChange,
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
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
        Final Schema ({columns.length} columns)
      </h3>
      <p className="text-xs text-slate-600 dark:text-white/70 mb-4">
        Drag to reorder columns. Set data types for each column.
      </p>

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
            <div className="text-slate-400 dark:text-white/40">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M6 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM6 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM6 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM12 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM12 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM12 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
              </svg>
            </div>

            {/* Column order */}
            <div className="w-8 text-xs text-slate-500 dark:text-white/60 text-center">
              {index + 1}
            </div>

            {/* Column name */}
            <div className="flex-1 min-w-0">
              <span className="font-mono text-sm text-slate-900 dark:text-white truncate">
                {column}
              </span>
            </div>

            {/* Type selector */}
            <select
              value={columnTypes[column] || "text"}
              onChange={(e) =>
                onTypeChange(column, e.target.value as ColumnType)
              }
              className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-white/10 text-slate-900 dark:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
            </select>
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
