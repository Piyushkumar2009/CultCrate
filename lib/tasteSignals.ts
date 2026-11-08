/**
 * Picks the small set of films that is actually sent to the AI engine.
 *
 * A full Letterboxd export can hold 800+ films. Only the ones the person loved say anything useful about their
 * taste, so the engine gets the 4 and 5 star films (capped), not the whole diary. Everything the person has ever
 * watched is still used on the server to stop already-seen films from being recommended; this only decides what the
 * model reads.
 */

export interface TasteSignal {
  name: string;
  year: string;
  rating: number;
}

export interface SelectedTasteSignals {
  /** Compact CSV (`Name,Year,Rating`) ready to drop into the prompt. Empty when nothing qualified. */
  payload: string;
  count: number;
  /** The minimum rating that was applied: normally 4, or 3.5 when the person has very few 4+ films. */
  threshold: number;
  /** How many distinct films were considered before the cap was applied. */
  totalCandidates: number;
  /** True when the cap cut some qualifying films. */
  trimmed: boolean;
}

export interface SelectTasteSignalsOptions {
  /** Preferred minimum rating (default 4). */
  minRating?: number;
  /** Used instead when fewer than `minPrimary` films reach `minRating` (default 3.5). */
  fallbackRating?: number;
  /** How many films at `minRating` are needed before the fallback is not used (default 15). */
  minPrimary?: number;
  /** Hard cap on rows sent to the model (default 300). */
  maxRows?: number;
}

export const DEFAULT_MIN_SIGNAL_RATING = 4;
export const DEFAULT_FALLBACK_SIGNAL_RATING = 3.5;
export const DEFAULT_MIN_PRIMARY_SIGNALS = 15;
export const DEFAULT_MAX_SIGNAL_ROWS = 300;

function signalKey(signal: TasteSignal): string {
  return `${signal.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}|${signal.year}`;
}

function csvName(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function selectTasteSignals(
  signals: readonly TasteSignal[],
  options: SelectTasteSignalsOptions = {}
): SelectedTasteSignals {
  const minRating = options.minRating ?? DEFAULT_MIN_SIGNAL_RATING;
  const fallbackRating = options.fallbackRating ?? DEFAULT_FALLBACK_SIGNAL_RATING;
  const minPrimary = options.minPrimary ?? DEFAULT_MIN_PRIMARY_SIGNALS;
  const maxRows = Math.max(1, options.maxRows ?? DEFAULT_MAX_SIGNAL_ROWS);

  // One row per film. The same film can arrive from the CSV and from the RSS feed; the later entry wins
  // because it is the more recent rating.
  const byKey = new Map<string, { signal: TasteSignal; order: number }>();
  signals.forEach((signal, order) => {
    if (!signal.name.trim() || !Number.isFinite(signal.rating) || signal.rating > 5) return;
    byKey.set(signalKey(signal), { signal, order });
  });
  const unique = [...byKey.values()];

  const primaryCount = unique.filter((s) => s.signal.rating >= minRating).length;
  const threshold = primaryCount >= minPrimary ? minRating : Math.min(minRating, fallbackRating);

  const qualifying = unique
    .filter((s) => s.signal.rating >= threshold)
    // Highest rated first; among equals the most recently rated film first.
    .sort((a, b) => b.signal.rating - a.signal.rating || b.order - a.order);

  const kept = qualifying.slice(0, maxRows);
  const payload =
    kept.length > 0
      ? ['Name,Year,Rating', ...kept.map(({ signal }) => `${csvName(signal.name)},${signal.year},${signal.rating.toFixed(1)}`)].join('\n')
      : '';

  return {
    payload,
    count: kept.length,
    threshold,
    totalCandidates: qualifying.length,
    trimmed: qualifying.length > kept.length,
  };
}
