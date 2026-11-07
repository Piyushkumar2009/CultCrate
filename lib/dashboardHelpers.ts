import { normalizeTitle } from './deduplication';

/**
 * Fixed obscurity calibration sent to the recommendation engine.
 * The T1-T5 selector was removed from the UI; the engine route still expects the field,
 * so the dashboard sends this constant instead of a user-selected value.
 */
export const ENGINE_OBSCURITY_LEVEL = 4;

/** Upper bound for the exclusion list sent to the engine prompt (keeps the prompt small). */
export const MAX_EXCLUSION_TITLES = 150;

export interface TitledFilm {
  title: string;
}

/** Unique, trimmed, non-empty film titles (original casing preserved), capped for prompt size. */
export function collectExclusionTitles(
  ...sources: ReadonlyArray<ReadonlyArray<TitledFilm> | null | undefined>
): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const source of sources) {
    if (!source) continue;
    for (const film of source) {
      const title = typeof film?.title === 'string' ? film.title.trim() : '';
      if (!title) continue;
      const key = normalizeTitle(title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      titles.push(title);
      if (titles.length >= MAX_EXCLUSION_TITLES) return titles;
    }
  }
  return titles;
}

/** Normalized lookup set so "Cure", "cure" and "Cure!" all match the same exclusion. */
export function buildExclusionSet(titles: ReadonlyArray<string>): Set<string> {
  const set = new Set<string>();
  for (const t of titles) {
    const key = normalizeTitle(t);
    if (key) set.add(key);
  }
  return set;
}

/** Hard client-side guarantee: removes any film whose title is in the exclusion set. */
export function filterOutExcluded<T extends TitledFilm>(films: ReadonlyArray<T>, exclusion: ReadonlySet<string>): T[] {
  if (exclusion.size === 0) return [...films];
  return films.filter((film) => {
    const key = normalizeTitle(film.title);
    return !key || !exclusion.has(key);
  });
}

export interface DnaSourceFilm {
  genre?: string[] | string;
  country?: string;
  year?: number | string;
}

function topN(counts: Map<string, number>, n: number): string[] {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([label]) => label);
}

/**
 * Derives the user's Cinematic DNA tags from the batch the engine actually returned:
 * dominant genres, dominant countries and dominant decade. Pure and deterministic.
 */
export function deriveDnaTags(films: ReadonlyArray<DnaSourceFilm>): string[] {
  if (films.length === 0) return [];

  const genres = new Map<string, number>();
  const countries = new Map<string, number>();
  const decades = new Map<string, number>();

  for (const f of films) {
    const list = Array.isArray(f.genre) ? f.genre : typeof f.genre === 'string' ? f.genre.split(/[,•·/]/) : [];
    for (const raw of list) {
      const g = typeof raw === 'string' ? raw.trim() : '';
      if (g) genres.set(g, (genres.get(g) ?? 0) + 1);
    }

    const country = typeof f.country === 'string' ? f.country.trim() : '';
    if (country && country.toLowerCase() !== 'international' && country.toLowerCase() !== 'global') {
      countries.set(country, (countries.get(country) ?? 0) + 1);
    }

    const year = Number(f.year);
    if (Number.isFinite(year) && year >= 1890 && year <= 2100) {
      const decade = `${Math.floor(year / 10) * 10}s`;
      decades.set(decade, (decades.get(decade) ?? 0) + 1);
    }
  }

  const tags = [...topN(genres, 3), ...topN(countries, 2), ...topN(decades, 1)];
  return Array.from(new Set(tags));
}
