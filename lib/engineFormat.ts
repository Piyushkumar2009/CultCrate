/** Turns one raw film object from the AI (or the offline vault) into the card shape the dashboard expects. */

type Raw = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(str(v));
  return Number.isFinite(n) ? n : 0;
};

const DEFAULT_STREAMING = ['MUBI India', 'Prime Video India', 'Apple TV (Rent/Buy)'];

function flagFor(country: string): string {
  const c = country.toLowerCase();
  if (c.includes('korea')) return '🇰🇷';
  if (c.includes('japan')) return '🇯🇵';
  if (c.includes('france')) return '🇫🇷';
  if (c.includes('germany')) return '🇩🇪';
  if (c.includes('poland')) return '🇵🇱';
  if (c.includes('india')) return '🇮🇳';
  return '🌐';
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function formatFilm(f: Raw, idx: number, isMasterpiece: boolean, obscurityLevel: number) {
  const title = str(f.title);
  const wherePlain = str(f.where_to_watch_india);
  const streaming = Array.isArray(f.where_to_watch_india)
    ? (f.where_to_watch_india as unknown[]).map(str).filter(Boolean)
    : wherePlain
      ? wherePlain.split(',').map((s) => s.trim()).filter(Boolean)
      : DEFAULT_STREAMING;

  const country = str(f.country) || 'International';
  const runtime = num(f.runtime_mins) || 120;
  const imdb = num(f.imdb_rating) || 7.8;
  const genre = Array.isArray(f.genre) ? (f.genre as unknown[]).map(str).filter(Boolean) : [];
  const advisory = str(f.content_advisory);
  const premise = str(f.spoiler_free_premise);
  const alignment = str(f.thematic_alignment);

  return {
    id: `film-${isMasterpiece ? 'masterpiece' : 'excellent'}-${idx}-${slug(title || 'film')}`,
    title,
    originalTitle: str(f.originalTitle) || title,
    year: num(f.year) || f.year,
    genre: genre.length > 0 ? genre : ['Drama', 'Thriller'],
    country,
    countryFlag: flagFor(country),
    runtime_mins: runtime,
    runtime: `${runtime} min`,
    imdb_rating: imdb,
    imdbRating: `${imdb}`,
    letterboxdRating: `${Math.min(5.0, imdb / 2 + 0.3).toFixed(1)}`,
    matchScore: `${isMasterpiece ? (99.4 - idx * 0.5).toFixed(1) : (97.2 - idx * 0.7).toFixed(1)}%`,
    obscurityBadge: isMasterpiece ? `Tier ${obscurityLevel} // Masterpiece Cohort` : `Tier ${obscurityLevel} // Excellent Gem`,
    content_advisory: advisory,
    contentAdvisory: advisory,
    advisory,
    where_to_watch_india: wherePlain || streaming.join(', '),
    whereToWatchInIndia: streaming,
    streamingPlatforms: streaming,
    audio_availability: str(f.audio_availability) || 'Original Master • English Subtitles',
    spoiler_free_premise: premise,
    synopsis: premise,
    thematic_alignment: alignment,
    curatorialReason: alignment,
    scale_projection: isMasterpiece ? 'Masterpiece' : 'Excellent',
    posterUrl: '',
    director: str(f.director) || (isMasterpiece ? 'Visionary Auteur' : 'Underground Auteur'),
    letterboxdUrl: `https://letterboxd.com/film/${encodeURIComponent(slug(title))}/`,
    trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} official trailer`)}`,
  };
}
