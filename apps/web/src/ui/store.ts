import { proxy } from "valtio";
import type { UiRow } from "./types";

export type UploadedFile = {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  appendedAt: number;
  headers: readonly string[];
  rowCount: number;
  skippedCount: number;
  warnings: readonly string[];
  schemaSignature: string;
  sampleRows: readonly UiRow[];
};

export type AppStore = {
  headers: string[];
  rows: UiRow[];
  warnings: string[];
  appendMode: "append" | "replace";
  uploadedFiles: UploadedFile[];
};

export const store = proxy<AppStore>({
  headers: [],
  rows: [],
  warnings: [],
  appendMode: "replace",
  uploadedFiles: [],
});

export function setAppendMode(nextMode: "append" | "replace"): void {
  store.appendMode = nextMode;
}

export function addWarnings(newWarnings: string[]): void {
  if (newWarnings.length === 0) return;
  store.warnings = [...store.warnings, ...newWarnings];
}

export function replaceData(params: {
  headers: readonly string[];
  rows: readonly UiRow[];
  uploadedFiles: readonly UploadedFile[];
}): void {
  store.headers = [...params.headers];
  store.rows = [...params.rows];
  store.uploadedFiles = [...params.uploadedFiles];
}

export function appendData(params: {
  rows: readonly UiRow[];
  uploadedFiles: readonly UploadedFile[];
}): void {
  store.rows = [...store.rows, ...params.rows];
  store.uploadedFiles = [...store.uploadedFiles, ...params.uploadedFiles];
}

export function removeFile(fileId: string): void {
  const remainingFiles = store.uploadedFiles.filter((f) => f.id !== fileId);
  const remainingRows = store.rows.filter(
    (r) => (r as unknown as Record<string, string>).__fileId !== fileId
  );
  store.uploadedFiles = remainingFiles;
  store.rows = remainingRows;
  if (remainingFiles.length === 0) {
    store.headers = [];
  }
}

export function removeRowsByIds(rowIds: Set<string>): void {
  if (rowIds.size === 0) return;
  store.rows = store.rows.filter((r) => !rowIds.has(r._rid));
}
