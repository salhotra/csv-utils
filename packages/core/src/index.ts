export type CsvRow = Record<string, unknown>;
export type CsvRowString = Record<string, string>;

export function normalizeToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function valueMatchesKeyword(
  cellValue: unknown,
  keyword: string,
  caseInsensitive: boolean
): boolean {
  const haystack = normalizeToString(cellValue);
  if (caseInsensitive) {
    return haystack.toLowerCase().includes(keyword.toLowerCase());
  }
  return haystack.includes(keyword);
}

export function filterRowsByColumn(
  rows: CsvRow[],
  columnName: string,
  keyword: string,
  caseInsensitive: boolean
): CsvRowString[] {
  const matches: CsvRowString[] = [];
  for (const row of rows) {
    const cell = row[columnName];
    if (cell === undefined) continue;
    if (valueMatchesKeyword(cell, keyword, caseInsensitive)) {
      const stringRecord: CsvRowString = {};
      for (const [key, val] of Object.entries(row)) {
        stringRecord[key] = normalizeToString(val);
      }
      matches.push(stringRecord);
    }
  }
  return matches;
}
