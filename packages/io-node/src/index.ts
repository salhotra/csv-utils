import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse";
import { CsvRow, CsvRowString, filterRowsByColumn } from "@csv-utils/core";

export type SearchResult = {
  headers: string[];
  rows: CsvRowString[];
  warnings: string[];
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function processCsvFile(
  filePath: string,
  columnName: string,
  keyword: string,
  caseInsensitive: boolean
): Promise<{
  headers: string[];
  matched: CsvRowString[];
  warnings: string[];
} | null> {
  if (!(await fileExists(filePath))) {
    return {
      headers: [],
      matched: [],
      warnings: [`Warning: file not found: ${filePath}`],
    };
  }

  const absolutePath = path.resolve(filePath);
  let headerRow: string[] | null = null;
  const warnings: string[] = [];
  const bufferRows: CsvRow[] = [];

  return new Promise((resolve, reject) => {
    const parser = parse({
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      columns: (header) => {
        headerRow = header;
        return header;
      },
    });

    parser.on("error", (err) => reject(err));

    parser.on("readable", () => {
      let record: CsvRow | null;
      // eslint-disable-next-line no-cond-assign
      while ((record = parser.read()) !== null) {
        bufferRows.push(record);
      }
    });

    parser.on("end", () => {
      if (!headerRow) {
        warnings.push(`Warning: could not read header from: ${absolutePath}`);
        resolve({ headers: [], matched: [], warnings });
        return;
      }
      if (!headerRow.includes(columnName)) {
        warnings.push(
          `Warning: column "${columnName}" not found in file: ${absolutePath}`
        );
        resolve({ headers: headerRow, matched: [], warnings });
        return;
      }

      const matched = filterRowsByColumn(
        bufferRows,
        columnName,
        keyword,
        caseInsensitive
      );
      resolve({ headers: headerRow, matched, warnings });
    });

    const input = createReadStream(absolutePath);
    input.on("error", reject);
    input.pipe(parser);
  });
}

export async function searchCsvFiles(
  files: string[],
  columnName: string,
  keyword: string,
  caseInsensitive: boolean
): Promise<SearchResult> {
  const headerOrder: string[] = [];
  const headerSet = new Set<string>();
  const rows: CsvRowString[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    try {
      const result = await processCsvFile(
        file,
        columnName,
        keyword,
        caseInsensitive
      );
      if (!result) continue;
      for (const h of result.headers) {
        if (!headerSet.has(h)) {
          headerSet.add(h);
          headerOrder.push(h);
        }
      }
      rows.push(...result.matched);
      warnings.push(...result.warnings);
    } catch (err) {
      warnings.push(`Error processing ${file}: ${(err as Error).message}`);
    }
  }

  return { headers: headerOrder, rows, warnings };
}
