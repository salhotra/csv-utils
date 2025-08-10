import React from "react";
import type { ColumnType } from "../types";

type Props = {
  headers: string[];
  types: Record<string, ColumnType>;
  onChangeType: (header: string, type: ColumnType) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function TypeReviewModal({
  headers,
  types,
  onChangeType,
  onCancel,
  onConfirm,
}: Props): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/60"
        onClick={onCancel}
      />
      <div className="relative card p-6 w-[min(90vw,720px)] max-h-[85vh] overflow-auto">
        <h3 className="text-xl font-semibold mb-4">Review column types</h3>
        <div className="space-y-2">
          {headers.map((h) => (
            <div key={h} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="truncate font-mono text-sm">{h}</div>
              </div>
              <select
                className="input"
                value={types[h]}
                onChange={(e) => onChangeType(h, e.target.value as ColumnType)}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
              </select>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="chip" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn" onClick={onConfirm}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
