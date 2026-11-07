import { cell, findColumn, parseCsv, parseCsvTable, serializeCsv } from './csv';
import {
  ParsedRSSEntry,
  cleanMovieTitle,
  isInvalidToken,
  isValidYear,
  normalizeYear,
  parseStarRatingToNumber,
} from './letterboxdRss';

/** Canonical column order of the CSV we write to Supabase Storage. */
export const RATINGS_CSV_COLUMNS = ['Date', 'Name', 'Year', 'Letterboxd URI', 'Rating'] as const;

export interface UnifiedMovieObject {
  title: string;
  year: string;
  /** 0.5..5.0 in 0.5 steps; 0 means "watched but unrated" */
  rating: number;
  watchedDate?: string;
  letterboxdUrl?: string;
  source: 'csv' | 'rss' | 'unified';
}

export interface WatchedMovieItem {
  title: string;
  year?: string;
  rating?: string;
  watchedDate?: string;
  letterboxdUrl?: string;
  source: 'csv' | 'rss' | 'unified';
}

export interface DedupeStats {
  csvRowsRead: number;
  rssEntriesRead: number;
  skippedRows: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RATING_CELL_RE = /^[0-5]\.[05]$/;
const MAX_CSV_BYTES = 10 * 1024 * 1024;

/* -------------------------------------------------------------------------- */
/*  Rating helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Star glyphs ("★★★½") or numeric strings/numbers to a number. Unrated or invalid input
 * returns 0. This function can never return NaN.
 */
export function convertStarsToNumeric(starString: string | number | undefined | null): number {
  return parseStarRatingToNumber(starString) ?? 0;
}

/** Splits a raw RSS-style composite title into clean title, year and numeric rating. */
export function extractRssTitleAndRating(rawTitle: string): {
  title: string;
  year?: string;
  rating: number;
} {
  if (typeof rawTitle !== 'string' || !rawTitle.trim()) return { title: '', rating: 0 };
  const cleaned = cleanMovieTitle(rawTitle);
  return {
    title: cleaned.title,
    year: cleaned.year,
    rating: convertStarsToNumeric(cleaned.rating),
  };
}

/* -------------------------------------------------------------------------- */
/*  Keys                                                                      */
/* -------------------------------------------------------------------------- */

function sanitizeTitle(title: unknown): string {
  if (typeof title !== 'string') return '';
  return title.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * THE deduplication key: `${cleanTitle.toLowerCase().trim()}_${cleanYear}`.
 * Returns '' when the title is unusable so callers can skip the row.
 */
export function buildMovieKey(title: unknown, year?: string | number | null): string {
  const cleanTitle = sanitizeTitle(title);
  if (isInvalidToken(cleanTitle)) return '';
  const cleanYear = normalizeYear(year);
  return `${cleanTitle.toLowerCase().trim()}_${cleanYear}`;
}

/** Alias kept for backward compatibility; identical to buildMovieKey. */
export function createMovieKey(title: string, year?: string | number): string {
  return buildMovieKey(title, year);
}

/** Aggressive normalization (accents and punctuation stripped), used only for fuzzy lookup sets. */
export function normalizeTitle(title: string): string {
  const cleaned = sanitizeTitle(title);
  if (!cleaned) return '';
  return cleaned
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/* -------------------------------------------------------------------------- */
/*  CSV -> items                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Parses a Letterboxd export (ratings.csv, diary.csv, watchlist.csv) or our own canonical
 * CSV. Columns are located by header NAME (never by guessed index) and the parser is
 * quote-aware, so "Hail, Caesar!" no longer shifts every following column.
 * Rows with an unusable title are dropped; unusable year/rating cells are blanked.
 */
export function parseCsvRows(csvText: string): WatchedMovieItem[] {
  const movies: WatchedMovieItem[] = [];
  if (typeof csvText !== 'string' || !csvText.trim()) return movies;

  const table = parseCsvTable(csvText);
  if (!table) return movies;

  const nameIdx = findColumn(table.headers, 'name', 'title', 'film', 'film title');
  if (nameIdx === -1) return movies;

  const yearIdx = findColumn(table.headers, 'year', 'release year');
  const ratingIdx = findColumn(table.headers, 'rating', 'your rating');
  const dateIdx = findColumn(table.headers, 'watched date', 'date');
  const urlIdx = findColumn(table.headers, 'letterboxd uri', 'uri', 'url');

  for (const row of table.rows) {
    const cleaned = cleanMovieTitle(cell(row, nameIdx));
    const title = sanitizeTitle(cleaned.title);
    if (isInvalidToken(title)) continue;

    const year = normalizeYear(cell(row, yearIdx)) || normalizeYear(cleaned.year);
    const numericRating =
      parseStarRatingToNumber(cell(row, ratingIdx)) ?? parseStarRatingToNumber(cleaned.rating);

    const rawDate = cell(row, dateIdx);
    const rawUrl = cell(row, urlIdx);

    movies.push({
      title,
      year: year || undefined,
      rating: numericRating !== null ? numericRating.toFixed(1) : undefined,
      watchedDate: ISO_DATE_RE.test(rawDate) ? rawDate : undefined,
      letterboxdUrl: /^https:\/\//i.test(rawUrl) ? rawUrl : undefined,
      source: 'csv',
    });
  }

  return movies;
}

/* -------------------------------------------------------------------------- */
/*  Merge / dedupe                                                            */
/* -------------------------------------------------------------------------- */

function mergeMovie(map: Map<string, UnifiedMovieObject>, incoming: UnifiedMovieObject): void {
  const key = buildMovieKey(incoming.title, incoming.year);
  if (!key) return;

  const existing = map.get(key);
  if (!existing) {
    map.set(key, incoming);
    return;
  }

  // The most recent log wins; ties go to the incoming entry. If the winner is unrated,
  // keep the other side's rating so a rewatch-without-rating never erases a real rating.
  const incomingWins = (incoming.watchedDate ?? '') >= (existing.watchedDate ?? '');
  const winner = incomingWins ? incoming : existing;
  const loser = incomingWins ? existing : incoming;

  map.set(key, {
    title: existing.title,
    year: existing.year,
    rating: winner.rating > 0 ? winner.rating : loser.rating,
    watchedDate: winner.watchedDate || loser.watchedDate,
    letterboxdUrl: winner.letterboxdUrl || loser.letterboxdUrl,
    source: existing.source === incoming.source ? existing.source : 'unified',
  });
}

function compareMovies(a: UnifiedMovieObject, b: UnifiedMovieObject): number {
  const da = a.watchedDate ?? '';
  const db = b.watchedDate ?? '';
  if (da !== db) return da < db ? -1 : 1;
  const ka = buildMovieKey(a.title, a.year);
  const kb = buildMovieKey(b.title, b.year);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/**
 * Merges stored CSV rows and live RSS entries into ONE set keyed by
 * `${cleanTitle.toLowerCase().trim()}_${cleanYear}`.
 * The output order is deterministic (date, then key), so re-running the pipeline on
 * unchanged input yields a byte-identical CSV (which lets callers skip redundant writes).
 */
export function deduplicateWatchlist(
  csvContent?: string | null,
  rssEntries?: ReadonlyArray<ParsedRSSEntry> | null
): {
  uniqueMovies: UnifiedMovieObject[];
  totalWatchedCount: number;
  deduplicatedMap: Map<string, UnifiedMovieObject>;
  stats: DedupeStats;
} {
  const deduplicatedMap = new Map<string, UnifiedMovieObject>();
  const stats: DedupeStats = { csvRowsRead: 0, rssEntriesRead: 0, skippedRows: 0 };

  if (csvContent) {
    for (const item of parseCsvRows(csvContent)) {
      stats.csvRowsRead++;
      const year = normalizeYear(item.year);
      if (!buildMovieKey(item.title, year)) {
        stats.skippedRows++;
        continue;
      }
      mergeMovie(deduplicatedMap, {
        title: sanitizeTitle(item.title),
        year,
        rating: convertStarsToNumeric(item.rating),
        watchedDate: item.watchedDate,
        letterboxdUrl: item.letterboxdUrl,
        source: 'csv',
      });
    }
  }

  if (Array.isArray(rssEntries)) {
    for (const rss of rssEntries) {
      stats.rssEntriesRead++;
      const cleaned = cleanMovieTitle(rss.title);
      const title = sanitizeTitle(cleaned.title);
      const year = normalizeYear(rss.year) || normalizeYear(cleaned.year);
      if (!buildMovieKey(title, year)) {
        stats.skippedRows++;
        continue;
      }
      mergeMovie(deduplicatedMap, {
        title,
        year,
        rating: convertStarsToNumeric(rss.rating) || convertStarsToNumeric(cleaned.rating),
        watchedDate: ISO_DATE_RE.test(rss.watchedDate) ? rss.watchedDate : undefined,
        letterboxdUrl: /^https:\/\//i.test(rss.letterboxdUrl) ? rss.letterboxdUrl : undefined,
        source: 'rss',
      });
    }
  }

  const uniqueMovies = Array.from(deduplicatedMap.values()).sort(compareMovies);

  return {
    uniqueMovies,
    totalWatchedCount: deduplicatedMap.size,
    deduplicatedMap,
    stats,
  };
}

/* -------------------------------------------------------------------------- */
/*  Items -> canonical CSV                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Serializes movies to the canonical 5-column CSV. Unrated films get an EMPTY rating cell
 * (previously they were silently written as 4.0, which fabricated taste signal).
 * Rows that fail basic sanity checks are omitted rather than written as 'undefined'/'NaN'.
 */
export function serializeRatingsCsv(movies: ReadonlyArray<UnifiedMovieObject>): string {
  const rows: string[][] = [[...RATINGS_CSV_COLUMNS]];
  const seen = new Set<string>();

  for (const m of movies) {
    const key = buildMovieKey(m.title, m.year);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const rating = Number.isFinite(m.rating) && m.rating >= 0.5 && m.rating <= 5 ? m.rating.toFixed(1) : '';
    rows.push([
      m.watchedDate && ISO_DATE_RE.test(m.watchedDate) ? m.watchedDate : '',
      sanitizeTitle(m.title),
      normalizeYear(m.year),
      m.letterboxdUrl && /^https:\/\//i.test(m.letterboxdUrl) ? m.letterboxdUrl : '',
      rating,
    ]);
  }

  return serializeCsv(rows);
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

export interface CsvValidationResult {
  valid: boolean;
  error?: string;
  rowCount: number;
}

/**
 * STRICT PRE-WRITE VALIDATOR for the canonical CSV.
 * Checks each FIELD (not substrings, so a film like "Nullarbor" is fine) and rejects:
 * wrong header, wrong column count, blank / 'undefined' / 'NaN' / 'null' titles,
 * non-numeric or out-of-range ratings, malformed years/dates/URIs, duplicate keys,
 * control characters and zero data rows. Callers MUST abort the write when valid === false.
 */
export function validateGeneratedCsv(csvContent: string): CsvValidationResult {
  const fail = (error: string): CsvValidationResult => ({ valid: false, error, rowCount: 0 });

  if (typeof csvContent !== 'string' || csvContent.trim().length === 0) return fail('Empty CSV payload');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(csvContent)) return fail('CSV contains control characters');

  const rows = parseCsv(csvContent);
  if (rows.length < 2) return fail('CSV contains no data rows');

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const expected = RATINGS_CSV_COLUMNS.map((c) => c.toLowerCase());
  if (header.length !== expected.length || header.some((h, i) => h !== expected[i])) {
    return fail(`CSV header must be exactly: ${RATINGS_CSV_COLUMNS.join(',')}`);
  }

  const seen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const line = i + 1;
    const row = rows[i];
    if (row.length !== expected.length) {
      return fail(`Line ${line}: expected ${expected.length} columns but found ${row.length}`);
    }

    const [date, name, year, uri, rating] = row.map((c) => c.trim());

    for (const [label, value] of [['Date', date], ['Year', year], ['Letterboxd URI', uri], ['Rating', rating]] as const) {
      if (value !== '' && isInvalidToken(value)) return fail(`Line ${line}: ${label} contains an invalid value "${value}"`);
    }

    if (isInvalidToken(name)) return fail(`Line ${line}: empty or invalid movie title`);
    if (date !== '' && !ISO_DATE_RE.test(date)) return fail(`Line ${line}: invalid date "${date}"`);
    if (year !== '' && !isValidYear(year)) return fail(`Line ${line}: invalid year "${year}"`);
    if (uri !== '' && !/^https:\/\/\S+$/i.test(uri)) return fail(`Line ${line}: invalid Letterboxd URI`);
    if (rating !== '') {
      const n = Number(rating);
      if (!RATING_CELL_RE.test(rating) || !Number.isFinite(n) || n < 0.5 || n > 5) {
        return fail(`Line ${line}: invalid rating "${rating}"`);
      }
    }

    const key = buildMovieKey(name, year);
    if (!key) return fail(`Line ${line}: cannot build dedup key`);
    if (seen.has(key)) return fail(`Line ${line}: duplicate entry "${key}"`);
    seen.add(key);
  }

  if (seen.size === 0) return fail('Zero valid rows found in CSV output');
  return { valid: true, rowCount: seen.size };
}

/* -------------------------------------------------------------------------- */
/*  One-call pipelines                                                        */
/* -------------------------------------------------------------------------- */

export type CanonicalCsvResult =
  | { ok: true; csv: string; rowCount: number; stats: DedupeStats }
  | { ok: false; error: string; rowCount: 0 };

/**
 * Dedupe + serialize + validate in one step. `ok: false` means "do NOT write to storage".
 */
export function buildCanonicalCsv(
  csvContent?: string | null,
  rssEntries?: ReadonlyArray<ParsedRSSEntry> | null
): CanonicalCsvResult {
  const { uniqueMovies, stats } = deduplicateWatchlist(csvContent, rssEntries);
  if (uniqueMovies.length === 0) {
    return { ok: false, error: 'No valid films after parsing and deduplication', rowCount: 0 };
  }
  const csv = serializeRatingsCsv(uniqueMovies);
  const validation = validateGeneratedCsv(csv);
  if (!validation.valid) {
    return { ok: false, error: validation.error ?? 'CSV failed validation', rowCount: 0 };
  }
  return { ok: true, csv, rowCount: validation.rowCount, stats };
}

/**
 * Validates and normalizes a user-uploaded Letterboxd export (ratings/diary/watchlist CSV)
 * into the canonical format before it is allowed anywhere near Supabase Storage.
 */
export function canonicalizeUploadedCsv(rawText: string): CanonicalCsvResult {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    return { ok: false, error: 'The file is empty.', rowCount: 0 };
  }
  if (rawText.length > MAX_CSV_BYTES) {
    return { ok: false, error: 'The file is larger than 10 MB.', rowCount: 0 };
  }
  const table = parseCsvTable(rawText);
  if (!table || findColumn(table.headers, 'name', 'title', 'film', 'film title') === -1) {
    return { ok: false, error: 'No "Name" column found. Upload the ratings.csv exported from Letterboxd.', rowCount: 0 };
  }
  return buildCanonicalCsv(rawText, null);
}

/* -------------------------------------------------------------------------- */
/*  Legacy wrapper                                                            */
/* -------------------------------------------------------------------------- */

/** Backward-compatibility wrapper for existing deduplicateWatchedMovies callers. */
export function deduplicateWatchedMovies(
  csvContent?: string | null,
  rssEntries?: ReadonlyArray<ParsedRSSEntry> | null
): {
  uniqueMovies: WatchedMovieItem[];
  uniqueCount: number;
  uniqueTitlesSet: Set<string>;
  uniqueTitleYearSet: Set<string>;
  deduplicatedMap: Map<string, WatchedMovieItem>;
} {
  const { uniqueMovies: unified, totalWatchedCount } = deduplicateWatchlist(csvContent, rssEntries);

  const uniqueTitlesSet = new Set<string>();
  const uniqueTitleYearSet = new Set<string>();
  const legacyMap = new Map<string, WatchedMovieItem>();

  for (const m of unified) {
    const norm = normalizeTitle(m.title);
    if (norm) uniqueTitlesSet.add(norm);
    if (m.year && norm) uniqueTitleYearSet.add(`${norm}_${m.year}`);

    legacyMap.set(buildMovieKey(m.title, m.year), {
      title: m.title,
      year: m.year || undefined,
      rating: m.rating > 0 ? m.rating.toFixed(1) : undefined,
      watchedDate: m.watchedDate,
      letterboxdUrl: m.letterboxdUrl,
      source: m.source,
    });
  }

  return {
    uniqueMovies: Array.from(legacyMap.values()),
    uniqueCount: totalWatchedCount,
    uniqueTitlesSet,
    uniqueTitleYearSet,
    deduplicatedMap: legacyMap,
  };
}
