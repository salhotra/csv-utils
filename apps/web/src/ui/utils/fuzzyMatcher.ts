/**
 * Fuzzy matching utilities for column name suggestions
 */

export type ColumnMatch = {
  column: string;
  confidence: number;
  matchType: "exact" | "case-insensitive" | "fuzzy";
};

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity percentage between two strings
 */
function similarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Normalize column name for better matching
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_\s-]+/g, "") // Remove underscores, spaces, hyphens
    .replace(/[^a-z0-9]/g, ""); // Remove special characters
}

/**
 * Find the best matching existing column for a new column
 */
export function findBestMatch(
  newColumn: string,
  existingColumns: readonly string[],
  minConfidence: number = 0.6
): ColumnMatch | null {
  let bestMatch: ColumnMatch | null = null;

  for (const existingColumn of existingColumns) {
    // Exact match
    if (newColumn === existingColumn) {
      return {
        column: existingColumn,
        confidence: 1.0,
        matchType: "exact",
      };
    }

    // Case-insensitive match
    if (newColumn.toLowerCase() === existingColumn.toLowerCase()) {
      bestMatch = {
        column: existingColumn,
        confidence: 0.95,
        matchType: "case-insensitive",
      };
      continue;
    }

    // Fuzzy matching
    const normalizedNew = normalizeColumnName(newColumn);
    const normalizedExisting = normalizeColumnName(existingColumn);

    if (normalizedNew && normalizedExisting) {
      const confidence = similarity(normalizedNew, normalizedExisting);

      if (
        confidence >= minConfidence &&
        (!bestMatch || confidence > bestMatch.confidence)
      ) {
        bestMatch = {
          column: existingColumn,
          confidence,
          matchType: "fuzzy",
        };
      }
    }

    // Also try direct similarity without normalization
    const directConfidence = similarity(
      newColumn.toLowerCase(),
      existingColumn.toLowerCase()
    );
    if (
      directConfidence >= minConfidence &&
      (!bestMatch || directConfidence > bestMatch.confidence)
    ) {
      bestMatch = {
        column: existingColumn,
        confidence: directConfidence,
        matchType: "fuzzy",
      };
    }
  }

  return bestMatch;
}

/**
 * Generate mapping suggestions for all new columns
 */
export function generateMappingSuggestions(
  newColumns: readonly string[],
  existingColumns: readonly string[],
  minConfidence: number = 0.6
): Record<string, ColumnMatch | null> {
  const suggestions: Record<string, ColumnMatch | null> = {};

  for (const newColumn of newColumns) {
    suggestions[newColumn] = findBestMatch(
      newColumn,
      existingColumns,
      minConfidence
    );
  }

  return suggestions;
}

/**
 * Format confidence as percentage
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
