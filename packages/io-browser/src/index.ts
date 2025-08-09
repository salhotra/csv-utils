import Papa from "papaparse";
import type { CsvRow, CsvRowString } from "@csv-utils/core";
import * as core from "@csv-utils/core";

export type BrowserSearchResult = {
  headers: string[];
  rows: CsvRowString[];
  warnings: string[];
};

export async function parseCsvFile(file: File): Promise<{
  headers: string[];
  rows: CsvRowString[];
  warnings: string[];
  skippedRows: CsvRowString[];
}> {
  return new Promise((resolve) => {
    let headers: string[] | null = null;
    const buffered: CsvRow[] = [];
    const localWarnings: string[] = [];
    const skipped: CsvRowString[] = [];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (h: string) => h,
      complete: () => {
        if (!headers) {
          localWarnings.push(
            `Warning: could not read header from: ${file.name}`
          );
          resolve({
            headers: [],
            rows: [],
            warnings: localWarnings,
            skippedRows: [],
          });
          return;
        }
        const rows: CsvRowString[] = [];
        for (const row of buffered) {
          const out: CsvRowString = {};
          let hasOnlyHeaderKeys = true;
          for (const [k, v] of Object.entries(row)) {
            if (!headers!.includes(k)) {
              hasOnlyHeaderKeys = false;
            }
            out[k] = String(v ?? "");
          }

          if (hasOnlyHeaderKeys) {
            rows.push(out);
          } else {
            skipped.push(out);
          }
        }
        resolve({
          headers,
          rows,
          warnings: localWarnings,
          skippedRows: skipped,
        });
      },
      step: (results: Papa.ParseStepResult<CsvRow>) => {
        if (!headers) {
          headers = results.meta.fields ?? null;
        }
        buffered.push(results.data as CsvRow);
      },
      error: (err: Error) => {
        localWarnings.push(`Error parsing ${file.name}: ${err.message}`);
        resolve({
          headers: [],
          rows: [],
          warnings: localWarnings,
          skippedRows: [],
        });
      },
    });
  });
}

export async function searchCsvFilesInBrowser(
  files: File[],
  columnName: string,
  keyword: string,
  caseInsensitive: boolean
): Promise<BrowserSearchResult> {
  const headerOrder: string[] = [];
  const headerSet = new Set<string>();
  const rows: CsvRowString[] = [];
  const warnings: string[] = [];

  const parseFile = (file: File) =>
    new Promise<{
      headers: string[];
      matched: CsvRowString[];
      warnings: string[];
    }>((resolve) => {
      let headers: string[] | null = null;
      const buffered: CsvRow[] = [];
      const localWarnings: string[] = [];

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (h: string) => h,
        complete: () => {
          if (!headers) {
            localWarnings.push(
              `Warning: could not read header from: ${file.name}`
            );
            resolve({ headers: [], matched: [], warnings: localWarnings });
            return;
          }
          if (!headers.includes(columnName)) {
            localWarnings.push(
              `Warning: column "${columnName}" not found in file: ${file.name}`
            );
            resolve({ headers, matched: [], warnings: localWarnings });
            return;
          }
          const matched = core.filterRowsByColumn(
            buffered,
            columnName,
            keyword,
            caseInsensitive
          );
          resolve({ headers, matched, warnings: localWarnings });
        },
        step: (results: Papa.ParseStepResult<CsvRow>, parser: Papa.Parser) => {
          if (!headers) {
            headers = results.meta.fields ?? null;
          }
          const row = results.data as CsvRow;
          buffered.push(row);
        },
        error: (err: Error) => {
          localWarnings.push(`Error parsing ${file.name}: ${err.message}`);
          resolve({ headers: [], matched: [], warnings: localWarnings });
        },
      });
    });

  for (const file of files) {
    const result = await parseFile(file);
    for (const h of result.headers) {
      if (!headerSet.has(h)) {
        headerSet.add(h);
        headerOrder.push(h);
      }
    }
    rows.push(...result.matched);
    warnings.push(...result.warnings);
  }

  return { headers: headerOrder, rows, warnings };
}
