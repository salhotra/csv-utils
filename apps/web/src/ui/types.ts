export type UiRow = Record<string, string> & { _rid: string };
export type ColumnType = "text" | "number";

// Schema unifier types
export type ColumnMapping = {
  sourceColumn: string;
  targetColumn: string | null; // null means create new column
  targetType: ColumnType;
  confidence?: number;
  matchType?: "exact" | "case-insensitive" | "fuzzy" | "manual";
};

export type SchemaUnifierData = {
  existingHeaders: readonly string[];
  newFiles: Array<{
    name: string;
    headers: readonly string[];
    sampleRows: readonly Record<string, string>[];
    allRows: readonly Record<string, string>[]; // Full data for processing
    size: number;
    lastModified: number;
    warnings: readonly string[];
    skippedRows?: readonly Record<string, string>[];
  }>;
  mappings: Record<string, ColumnMapping>; // key is sourceColumn
  finalColumnOrder: string[];
  finalColumnTypes: Record<string, ColumnType>;
};
