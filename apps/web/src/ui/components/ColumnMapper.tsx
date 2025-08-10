import React from "react";
import type { ColumnMapping, ColumnType } from "../types";
import { formatConfidence } from "../utils/fuzzyMatcher";

type Props = {
  sourceColumn: string;
  mapping: ColumnMapping;
  existingColumns: readonly string[];
  onMappingChange: (sourceColumn: string, mapping: ColumnMapping) => void;
};

export function ColumnMapper({
  sourceColumn,
  mapping,
  existingColumns,
  onMappingChange,
}: Props): JSX.Element {
  const handleTargetChange = (newTarget: string) => {
    const isNewColumn = newTarget === "__NEW_COLUMN__";
    const updatedMapping: ColumnMapping = {
      ...mapping,
      targetColumn: isNewColumn ? null : newTarget,
      matchType: mapping.matchType === "manual" ? "manual" : "manual", // Mark as manual when user changes
    };
    onMappingChange(sourceColumn, updatedMapping);
  };

  const handleTypeChange = (newType: ColumnType) => {
    const updatedMapping: ColumnMapping = {
      ...mapping,
      targetType: newType,
    };
    onMappingChange(sourceColumn, updatedMapping);
  };

  const getConfidenceColor = (confidence: number | undefined): string => {
    if (!confidence) return "";
    if (confidence >= 0.9) return "text-green-600 dark:text-green-400";
    if (confidence >= 0.7) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const getMatchTypeLabel = (matchType: string | undefined): string => {
    switch (matchType) {
      case "exact":
        return "Exact match";
      case "case-insensitive":
        return "Case match";
      case "fuzzy":
        return "Fuzzy match";
      case "manual":
        return "Manual";
      default:
        return "";
    }
  };

  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Compact horizontal layout */}
      <div className="flex items-center gap-3 mb-3">
        <div className="font-mono text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-white/10 px-3 py-1.5 rounded border flex-shrink-0 min-w-0">
          <span className="truncate block" title={sourceColumn}>
            {sourceColumn}
          </span>
        </div>

        <div className="text-slate-400 dark:text-white/40 flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <select
            value={mapping.targetColumn || "__NEW_COLUMN__"}
            onChange={(e) => handleTargetChange(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="__NEW_COLUMN__">✨ Create New Column</option>
            {existingColumns.map((column) => (
              <option key={column} value={column}>
                🔗 {column}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-shrink-0 w-20">
          <select
            value={mapping.targetType}
            onChange={(e) => handleTypeChange(e.target.value as ColumnType)}
            className="w-full text-xs px-2 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
          </select>
        </div>
      </div>

      {/* Confidence and match type row (if available) */}
      {mapping.confidence !== undefined && mapping.matchType && (
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-white/60 pl-3">
          <div className="flex items-center gap-1">
            <span>Confidence:</span>
            <span
              className={`font-semibold ${getConfidenceColor(
                mapping.confidence
              )}`}
            >
              {formatConfidence(mapping.confidence)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span>Match:</span>
            <span className="font-medium text-slate-600 dark:text-white/70">
              {getMatchTypeLabel(mapping.matchType)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
