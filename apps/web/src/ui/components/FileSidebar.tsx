import React, { useState } from "react";
import { useSnapshot } from "valtio";
import { DateTime } from "luxon";
import { store, removeFile, type UploadedFile } from "../store";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const n = bytes / Math.pow(k, i);
  return `${n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)} ${sizes[i]}`;
}

function timeAgo(timestamp: number): string {
  const now = DateTime.now();
  const then = DateTime.fromMillis(timestamp);
  const diff = now.diff(then, ["days", "hours", "minutes"]);

  if (diff.days >= 1) {
    return `${Math.floor(diff.days)}d ago`;
  } else if (diff.hours >= 1) {
    return `${Math.floor(diff.hours)}h ago`;
  } else if (diff.minutes >= 1) {
    return `${Math.floor(diff.minutes)}m ago`;
  } else {
    return "just now";
  }
}

export function FileSidebar(): JSX.Element | null {
  const snap = useSnapshot(store);
  const files = snap.uploadedFiles;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (files.length === 0) return null;

  return (
    <aside className="w-80 shrink-0 pr-6 pb-4 overflow-auto no-scrollbar">
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-white/70">
            Files ({files.length})
          </h2>
        </div>
        <ul className="space-y-3">
          {files.map((f) => (
            <li key={f.id}>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate font-semibold text-slate-900 dark:text-white text-sm">
                        {f.name}
                      </h3>
                      {"appendedAt" in f && (
                        <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
                          Uploaded {timeAgo((f as any).appendedAt)}
                        </p>
                      )}
                    </div>
                    <button
                      className="text-xs px-2 py-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-white/60 dark:hover:text-rose-400 dark:hover:bg-rose-400/10 transition-colors"
                      title="Remove file"
                      onClick={() => removeFile(f.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-white/60">
                        Size
                      </span>
                      <span className="font-medium text-slate-700 dark:text-white/90">
                        {formatBytes(f.size)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-white/60">
                        Rows
                      </span>
                      <span className="font-medium text-slate-700 dark:text-white/90">
                        {f.rowCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-white/60">
                        Columns
                      </span>
                      <span className="font-medium text-slate-700 dark:text-white/90">
                        {f.headers.length}
                      </span>
                    </div>
                    {f.skippedCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-amber-600 dark:text-amber-400">
                          Skipped
                        </span>
                        <span className="font-medium text-amber-700 dark:text-amber-300">
                          {f.skippedCount}
                        </span>
                      </div>
                    )}
                  </div>

                  {f.warnings.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/10">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span className="text-amber-700 dark:text-amber-300">
                          {f.warnings.length} warning
                          {f.warnings.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-white/10">
                  <div className="flex items-center justify-between pt-3">
                    <div className="text-xs text-slate-500 dark:text-white/60">
                      Modified: {new Date(f.lastModified).toLocaleDateString()}
                    </div>
                    <button
                      className="text-xs text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white underline decoration-dotted underline-offset-2"
                      onClick={() =>
                        setExpandedId((id) => (id === f.id ? null : f.id))
                      }
                      aria-expanded={expandedId === f.id}
                    >
                      {expandedId === f.id ? "Hide details" : "Show details"}
                    </button>
                  </div>
                </div>
                {expandedId === f.id && <FileDetails file={f} />}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function FileDetails({ file }: { file: Readonly<UploadedFile> }): JSX.Element {
  return (
    <div className="px-4 pb-4 border-t border-slate-100 dark:border-white/10">
      <div className="pt-4">
        <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
          Column Headers ({file.headers.length})
        </h4>
        <div className="max-h-32 overflow-y-auto">
          <div className="text-xs space-y-1">
            {file.headers.map((header, index) => (
              <div key={header} className="flex items-center gap-3 py-1">
                <span className="text-slate-400 dark:text-white/40 w-6 text-right">
                  {index + 1}.
                </span>
                <span className="text-slate-700 dark:text-white/90 font-mono">
                  {header}
                </span>
              </div>
            ))}
          </div>
        </div>

        {file.warnings.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10">
            <h5 className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">
              Import Warnings
            </h5>
            <div className="space-y-1">
              {file.warnings.map((warning, index) => (
                <div
                  key={index}
                  className="text-xs text-amber-600 dark:text-amber-400"
                >
                  • {warning}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// hashShort removed as schema hash is not currently displayed
