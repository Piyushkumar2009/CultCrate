'use client';

import React from 'react';
import { Star, Play, ExternalLink, Bookmark } from 'lucide-react';

export interface MovieData {
  title: string;
  year?: string | number;
  rating?: string | number;
  genre?: string;
  reason?: string;
  director?: string;
  runtime?: string;
  matchScore?: string;
  category?: string;
}

export interface RecommendedFilm {
  id: string;
  title: string;
  originalTitle?: string;
  year: number;
  runtime: string;
  country: string;
  countryFlag?: string;
  director: string;
  imdbRating: string;
  letterboxdRating: string;
  posterUrl?: string;
  matchScore: string;
  obscurityBadge: string;
  obscurityLevel?: number;
  streamingPlatforms: string[];
  whereToWatchInIndia?: string[];
  contentAdvisory?: string;
  advisory?: string;
  synopsis: string;
  curatorialReason: string;
  trailerUrl?: string;
  letterboxdUrl?: string;
  genre?: string[];
  runtime_mins?: number;
  imdb_rating?: number;
  scale_projection?: string;
  rating?: string | number;
  reason?: string;
}

export interface MovieCardProps {
  movie?: MovieData;
  film?: RecommendedFilm;
  isWatchlisted?: boolean;
  onToggleWatchlist?: (id: string, filmData?: RecommendedFilm) => void;
  onWatchTrailer?: (film: any) => void;
}

export function MovieCard({
  movie,
  film,
  isWatchlisted = false,
  onToggleWatchlist,
  onWatchTrailer,
}: MovieCardProps) {
  const title = movie?.title || film?.title || 'Untitled Film';
  const year = movie?.year ?? film?.year ?? 'N/A';
  const rating =
    movie?.rating ||
    film?.letterboxdRating ||
    film?.imdbRating ||
    film?.rating ||
    '4.2';

  const genre =
    movie?.genre ||
    (Array.isArray(film?.genre)
      ? film.genre.join(' · ')
      : film?.genre || 'Cult cinema');

  const reason =
    movie?.reason ||
    film?.curatorialReason ||
    film?.synopsis ||
    'Picked because of the films you rate highly.';

  const director = movie?.director || film?.director || 'Director not listed';
  const runtime = movie?.runtime || film?.runtime || '112m';

  const fitScore =
    movie?.matchScore ||
    (film?.matchScore
      ? film.matchScore.includes('%')
        ? film.matchScore
        : `${film.matchScore}%`
      : '99.1%');

  const isMasterpiece =
    film?.obscurityBadge?.toLowerCase().includes('masterpiece') ||
    film?.scale_projection?.toLowerCase().includes('masterpiece');

  const category =
    movie?.category ||
    (isMasterpiece ? 'All-time great' : 'Hidden gem');

  const filmId = film?.id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const letterboxdLink =
    film?.letterboxdUrl ||
    `https://letterboxd.com/film/${encodeURIComponent(
      title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    )}/`;

  const fitLabel = fitScore.endsWith('Fit') ? fitScore : `${fitScore} Fit`;

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#10141e] to-[#0b0f18] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_-24px_rgba(0,0,0,0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#E50914]/45 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_50px_-22px_rgba(229,9,20,0.45)] select-none">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-[#E50914]/[0.07] blur-3xl transition-opacity duration-300 group-hover:bg-[#E50914]/[0.12]" />

      {/* Top row: category + fit */}
      <div className="relative z-10 mb-4 flex items-center justify-between gap-2">
        <span className="rounded-md border border-amber-500/25 bg-amber-500/[0.08] px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400">
          {category}
        </span>
        <span className="rounded-md border border-[#4EDEAE]/30 bg-[#4EDEAE]/[0.08] px-2 py-0.5 font-sans text-[10px] font-bold text-[#4EDEAE] shadow-[0_0_14px_-4px_rgba(78,222,174,0.5)]">
          {fitLabel.replace(/\s*Fit$/i, ' match')}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 mb-5 space-y-2.5">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-sans text-[11px] text-zinc-500">
          <span>{year}</span>
          <span className="text-zinc-700">/</span>
          <span>{runtime}</span>
          {genre && (
            <>
              <span className="text-zinc-700">/</span>
              <span className="max-w-[220px] truncate text-zinc-400 sm:max-w-none">{genre}</span>
            </>
          )}
        </div>

        <h3 className="text-xl font-semibold leading-snug tracking-tight text-white transition-colors group-hover:text-red-50">
          {title}
        </h3>

        <p className="text-xs text-zinc-500">
          Directed by <span className="text-zinc-300 normal-case tracking-normal">{director}</span>
        </p>

        <p className="line-clamp-3 border-l-2 border-[#E50914]/40 pl-3 font-sans text-sm leading-relaxed text-zinc-300">
          {reason}
        </p>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <div className="flex items-center gap-1.5 rounded-md border border-[#E50914]/25 bg-[#E50914]/[0.08] px-2.5 py-1 font-sans text-xs font-bold text-red-400">
          <Star className="h-3 w-3 shrink-0 fill-red-400" />
          <span>{rating} / 5</span>
        </div>

        <div className="flex items-center gap-1.5">
          {onWatchTrailer && film && (
            <button
              type="button"
              onClick={() => onWatchTrailer(film)}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#E50914]/30 bg-[#E50914]/10 min-h-9 px-3 py-1.5 font-sans text-xs font-semibold text-red-400 transition-colors hover:bg-[#E50914]/20 active:scale-95"
              title="Watch trailer"
            >
              <Play className="h-3 w-3 fill-current" />
              <span className="hidden sm:inline">Trailer</span><span className="sr-only sm:hidden">Watch trailer</span>
            </button>
          )}

          <a
            href={letterboxdLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] min-h-9 px-3 py-1.5 font-sans text-xs text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-white"
            title="Open on Letterboxd"
          >
            <span className="hidden sm:inline">Letterboxd</span>
            <ExternalLink className="h-3 w-3" />
          </a>

          {onToggleWatchlist && (
            <button
              type="button"
              onClick={() => {
                const fullFilm: RecommendedFilm = film || {
                  id: filmId,
                  title,
                  year: typeof year === 'number' ? year : parseInt(String(year)) || 2024,
                  runtime,
                  country: 'Global',
                  director,
                  imdbRating: String(rating),
                  letterboxdRating: String(rating),
                  matchScore: fitScore,
                  obscurityBadge: category,
                  streamingPlatforms: [],
                  synopsis: reason,
                  curatorialReason: reason,
                  letterboxdUrl: letterboxdLink,
                  genre: Array.isArray(genre) ? genre : [genre],
                };
                onToggleWatchlist(filmId, fullFilm);
              }}
              className={`flex cursor-pointer items-center h-9 w-9 justify-center rounded-lg border transition-all active:scale-95 ${
                isWatchlisted
                  ? 'border-[#4EDEAE]/60 bg-[#4EDEAE]/10 text-[#4EDEAE] shadow-[0_0_14px_-2px_rgba(78,222,174,0.5)]'
                  : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-white'
              }`}
              title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
              aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
              aria-pressed={isWatchlisted}
            >
              <Bookmark className={`h-3.5 w-3.5 ${isWatchlisted ? 'fill-[#4EDEAE]' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default MovieCard;
