/**
 * Everything the engine needs to know about a person's history, built from ONE parser.
 *
 * The previous route had its own hand rolled CSV tokenizer that guessed the Year column by header name. For the
 * canonical `Date,Name,Year,...` file it matched the DATE column first, so every film reached Gemini with the year it
 * was logged instead of the year it was released. It also treated unrated RSS entries as 4.0 stars. This module reuses
 * the same quote aware parser and de-duplication the sync route uses, so the engine and the vault always agree.
 */
import { deduplicateWatchlist, normalizeTitle } from './deduplication';
import type { ParsedRSSEntry } from './letterboxdRss';
import type { TasteSignal } from './tasteSignals';

/** Lowest rating that can ever become a taste signal (selectTasteSignals decides the final cut). */
export const CANDIDATE_RATING_FLOOR = 3.5;

export interface EngineInput {
  /** Normalized title keys of EVERY film the person has logged (used to drop already seen picks). */
  watchedKeys: Set<string>;
  /** Number of distinct films (one per film, unlike the key set which holds several keys per film). */
  watchedCount: number;
  csvRows: number;
  rssRows: number;
  /** Every rated film at or above the candidate floor. */
  signals: TasteSignal[];
  /** All distinct watched titles, oldest first. */
  watchedTitles: string[];
}

/** Keys a title is stored and looked up under: the normalized form, plus the form without a leading article. */
export function titleKeys(title: string): string[] {
  const full = normalizeTitle(title);
  if (!full) return [];
  const keys = [full];
  const stripped = normalizeTitle(title.replace(/^\s*(the|a|an|le|la|les|el|il|der|die|das)\s+/i, ''));
  if (stripped && stripped !== full) keys.push(stripped);
  return keys;
}

export function isSeenTitle(title: string, watchedKeys: ReadonlySet<string>): boolean {
  if (!title) return false;
  return titleKeys(title).some((k) => watchedKeys.has(k));
}

export function buildEngineInput(csvText: string, rssEntries: ReadonlyArray<ParsedRSSEntry>): EngineInput {
  const merged = deduplicateWatchlist(csvText, rssEntries);

  const watchedKeys = new Set<string>();
  const signals: TasteSignal[] = [];
  const watchedTitles: string[] = [];

  for (const movie of merged.uniqueMovies) {
    watchedTitles.push(movie.title);
    for (const key of titleKeys(movie.title)) watchedKeys.add(key);

    // rating 0 means "watched, not rated": it is excluded from recommendations but is never a taste signal
    if (movie.rating >= CANDIDATE_RATING_FLOOR && movie.rating <= 5) {
      signals.push({ name: movie.title, year: movie.year, rating: movie.rating });
    }
  }

  return {
    watchedKeys,
    watchedCount: merged.totalWatchedCount,
    csvRows: merged.stats.csvRowsRead,
    rssRows: merged.stats.rssEntriesRead,
    signals,
    watchedTitles,
  };
}
