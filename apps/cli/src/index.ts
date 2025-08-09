#!/usr/bin/env node
import { stringify } from "csv-stringify";
import { searchCsvFiles } from "@csv-utils/io-node";

type CliOptions = {
  columnName: string;
  keyword: string;
  caseInsensitive: boolean;
  files: string[];
};

function printUsage(): void {
  const usage = `\nUsage: csv-search -c <column> -k <keyword> <file1.csv> [file2.csv ...]\n\nOptions:\n  -c, --column <name>     Column header to search in (required)\n  -k, --keyword <value>   Keyword to search for (required)\n      --case-sensitive    Make search case-sensitive (default: case-insensitive)\n  -h, --help              Show this help\n\nExamples:\n  csv-search -c name -k alice data1.csv data2.csv\n`;
  process.stderr.write(usage);
}

function parseArgs(argv: string[]): CliOptions | null {
  const options: CliOptions = {
    columnName: "",
    keyword: "",
    caseInsensitive: true,
    files: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-c":
      case "--column": {
        const value = argv[++i];
        if (!value) return null;
        options.columnName = value;
        break;
      }
      case "-k":
      case "--keyword": {
        const value = argv[++i];
        if (!value) return null;
        options.keyword = value;
        break;
      }
      case "--case-sensitive": {
        options.caseInsensitive = false;
        break;
      }
      case "-h":
      case "--help":
        return null;
      default:
        if (arg.startsWith("-")) {
          process.stderr.write(`Unknown option: ${arg}\n`);
          return null;
        }
        options.files.push(arg);
    }
  }

  if (!options.columnName || !options.keyword || options.files.length === 0) {
    return null;
  }
  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = await searchCsvFiles(
    options.files,
    options.columnName,
    options.keyword,
    options.caseInsensitive
  );

  for (const w of result.warnings) {
    process.stderr.write(`${w}\n`);
  }

  if (result.headers.length === 0) {
    process.stderr.write("No headers found. Are the input files valid CSV?\n");
    process.exitCode = 1;
    return;
  }

  const stringifier = stringify({ header: true, columns: result.headers });
  stringifier.on("error", (err) => {
    process.stderr.write(`CSV stringify error: ${err.message}\n`);
  });

  stringifier.pipe(process.stdout);
  for (const row of result.rows) {
    stringifier.write(row);
  }
  stringifier.end();
}

main().catch((err) => {
  process.stderr.write(
    `Unexpected error: ${(err as Error).stack || String(err)}\n`
  );
  process.exitCode = 1;
});
