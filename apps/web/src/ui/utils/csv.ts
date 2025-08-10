import type { ColumnType, UiRow } from "../types";

export const stampRow = (row: Record<string, string>): UiRow => {
  const existing = (row as Partial<UiRow>)._rid;
  if (existing) return row as UiRow;
  const id = (globalThis as any).crypto?.randomUUID
    ? (globalThis as any).crypto.randomUUID()
    : `r_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return { ...(row as Record<string, string>), _rid: id };
};

export const isNumericLike = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  const raw = String(value).trim();
  if (!raw) return false;
  const normalized = raw.replace(/,/g, "");
  if (normalized === "") return false;
  const num = Number(normalized);
  return Number.isFinite(num);
};

export const inferColumnTypes = (
  colHeaders: string[],
  sampleRows: UiRow[],
  preferredTypes?: Record<string, ColumnType>
): Record<string, ColumnType> => {
  const numericNameHeuristic =
    /\b(id|count|qty|quantity|amount|total|price|num|number|rate|score|age|year|sum|balance|cost)\b/i;
  const result: Record<string, ColumnType> = {};
  const sample = sampleRows.slice(0, 100);
  for (const h of colHeaders) {
    if (preferredTypes && preferredTypes[h]) {
      result[h] = preferredTypes[h];
      continue;
    }
    const values = sample.map((r) => r[h]);
    const nonEmpty = values.filter((v) => (v ?? "").toString().trim() !== "");
    const numericCount = nonEmpty.filter((v) => isNumericLike(v)).length;
    const ratio = nonEmpty.length === 0 ? 0 : numericCount / nonEmpty.length;
    let type: ColumnType = "text";
    if (ratio >= 0.8) type = "number";
    else if (numericNameHeuristic.test(h) && ratio >= 0.5) type = "number";
    result[h] = type;
  }
  return result;
};

export const signatureOf = (colHeaders: readonly string[]): string =>
  JSON.stringify(colHeaders);

export const formatNumber = (n: number): string =>
  new Intl.NumberFormat("en-US").format(n);
