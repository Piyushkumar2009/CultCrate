/**
 * Minimal, dependency-free RFC-4180 CSV helpers.
 *
 * Why this exists: the previous pipeline used `line.split(',')`, which shifts every
 * column to the right whenever a title contains a comma ("Hail, Caesar!",
 * "Eternal Sunshine of the Spotless Mind, 2004"). Shifted columns are what produced
 * `undefined` / `NaN` ratings, junk years and endlessly "new" duplicate rows.
 */

const UTF8_BOM = '\uFEFF';

/**
 * Parses CSV text into rows of fields.
 * Handles: BOM, CRLF / LF / CR, quoted fields, escaped quotes (""), embedded commas
 * and embedded newlines inside quotes. Fully blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  if (typeof text !== 'string' || text.length === 0) return [];

  const src = text.startsWith(UTF8_BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = (): void => {
    row.push(field);
    field = '';
  };
  const pushRow = (): void => {
    pushField();
    // Drop rows that are entirely empty (e.g. trailing newline)
    if (row.length > 1 || (row[0] ?? '').trim().length > 0) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\r') {
      if (src[i + 1] === '\n') i++;
      pushRow();
    } else if (ch === '\n') {
      pushRow();
    } else {
      field += ch;
    }
  }

  // Flush last record (file without trailing newline)
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

export interface CsvTable {
  /** Lower-cased, trimmed header names in original order */
  headers: string[];
  /** Data rows (header excluded), raw string fields, untrimmed */
  rows: string[][];
}

/** Parses CSV text and splits off the header row. Returns null when there is no header. */
export function parseCsvTable(text: string): CsvTable | null {
  const all = parseCsv(text);
  if (all.length === 0) return null;
  const headers = all[0].map((h) => h.trim().toLowerCase());
  return { headers, rows: all.slice(1) };
}

/** Index of the first header equal to any candidate (exact, case-insensitive). -1 when absent. */
export function findColumn(headers: readonly string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Safe cell accessor: never returns undefined. */
export function cell(row: readonly string[], index: number): string {
  if (index < 0 || index >= row.length) return '';
  const value = row[index];
  return typeof value === 'string' ? value.trim() : '';
}

/** Quotes a field when required by RFC-4180. Never emits 'undefined' / 'null'. */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : String(value);
  if (/[",\r\n]/.test(str) || /^\s|\s$/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Serializes rows to CSV text with `\n` line endings and a trailing newline. */
export function serializeCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  return rows.map((r) => r.map(escapeCsvField).join(',')).join('\n') + '\n';
}
