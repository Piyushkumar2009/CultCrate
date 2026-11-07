'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Star,
  Film,
  Calendar,
  Clock,
  Globe,
  Tv,
  Check,
  Bookmark,
  Share2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { FilmCohort, FilmItem } from '@/lib/vaultData';

interface CohortDetailModalProps {
  cohort: FilmCohort | null;
  onClose: () => void;
}

export function CohortDetailModal({ cohort, onClose }: CohortDetailModalProps) {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!cohort) return null;

  const toggleWatchlist = (filmId: string) => {
    setWatchlist((prev) =>
      prev.includes(filmId) ? prev.filter((id) => id !== filmId) : [...prev, filmId]
    );
  };

  const handleCopyShare = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(
        `CultCrate picks: ${cohort.cohortTitle} (made for @${cohort.letterboxdUser})`
      );
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-[#121620] border border-[#232936] rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_50px_rgba(229,9,20,0.25)] flex flex-col overflow-hidden z-10 my-auto"
        >
          {/* Header */}
          <div className="p-5 sm:p-7 border-b border-[#232936] bg-[#090D16]/80 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-xs font-sans font-bold text-[#E50914] uppercase tracking-wider">
                  Example · {cohort.tags[0] ?? 'Curated'}
                </span>
                <span className="text-xs font-sans text-[#4EDEAE] bg-[#4EDEAE]/10 px-2 py-0.5 rounded border border-[#4EDEAE]/30">
                  {cohort.matchScore} match
                </span>
                <span className="text-xs font-sans text-[#9CA3AF]">
                  Made for @{cohort.letterboxdUser}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {cohort.cohortTitle}
              </h2>

              <p className="text-xs sm:text-sm text-[#9CA3AF] mt-2 leading-relaxed max-w-2xl">
                {cohort.curatorialLog}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyShare}
                className="p-2 rounded-xl bg-[#121620] border border-[#232936] hover:border-[#E50914] text-[#9CA3AF] hover:text-white transition-colors"
                title="Copy to share"
              >
                {copiedLink ? (
                  <Check className="w-5 h-5 text-[#4EDEAE]" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-[#121620] border border-[#232936] hover:border-[#E50914] text-[#9CA3AF] hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Film List */}
          <div className="p-5 sm:p-7 overflow-y-auto space-y-5 divide-y divide-[#232936]">
            {cohort.films.map((film: FilmItem, idx: number) => {
              const inWatchlist = watchlist.includes(film.id);
              return (
                <div
                  key={film.id || idx}
                  className={`pt-5 first:pt-0 flex flex-col sm:flex-row gap-5 items-start`}
                >
                  {/* 100% Keyless & Imageless Film Card */}
                  <div className="relative w-28 sm:w-32 h-40 sm:h-48 rounded-xl overflow-hidden shrink-0 border border-red-950/40 bg-gradient-to-br from-neutral-900 via-zinc-950 to-black shadow-lg select-none p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-sans font-bold text-red-500 uppercase tracking-wider">Film</span>
                      <span className="text-[9px] font-sans text-zinc-400">({film.year})</span>
                    </div>
                    <div className="my-auto py-1">
                      <h4 className="font-extrabold text-xs text-white uppercase leading-tight line-clamp-3">
                        {film.title}
                      </h4>
                      <div className="text-[9px] font-sans text-zinc-400 truncate mt-1">
                        Directed by {film.director}
                      </div>
                    </div>
                    <div className="px-2 py-0.5 rounded-full bg-red-950/40 text-red-400 border border-red-900/40 font-sans text-[10px] font-bold flex items-center gap-1 shadow-sm w-fit">
                      <Star className="w-2.5 h-2.5 fill-red-400" />
                      <span>★ {film.letterboxdRating}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      {/* Meta */}
                      <div className="flex items-center gap-3 text-xs font-sans text-[#9CA3AF] flex-wrap">
                        <span className="text-[#E50914] font-semibold">
                          0{idx + 1} / 05
                        </span>
                        <span>{film.year}</span>
                        <span>·</span>
                        <span>{film.runtime}</span>
                        <span>·</span>
                        <span>{film.country}</span>
                      </div>

                      <h3 className="text-xl font-bold text-white mt-1">
                        {film.title}{' '}
                        {film.originalTitle && film.originalTitle !== film.title && (
                          <span className="text-sm font-normal text-[#9CA3AF] italic">
                            ({film.originalTitle})
                          </span>
                        )}
                      </h3>

                      <div className="text-xs font-sans text-[#F59E0B] mt-1 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5" />
                        <span>Directed by {film.director}</span>
                        <span className="text-[#9CA3AF]">·</span>
                        <span className="text-[#4EDEAE]">{film.genomeTag}</span>
                      </div>

                      <p className="text-xs sm:text-sm text-[#9CA3AF] mt-2.5 leading-relaxed">
                        {film.synopsis}
                      </p>
                    </div>

                    {/* Bottom strip */}
                    <div className="mt-4 pt-3 border-t border-[#232936]/60 flex flex-wrap items-center justify-between gap-3">
                      {/* Streaming availability */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-sans text-[#9CA3AF] flex items-center gap-1">
                          <Tv className="w-3.5 h-3.5 text-[#E50914]" />
                          <span>Watch on:</span>
                        </span>
                        {film.streaming.map((svc) => (
                          <span
                            key={svc}
                            className="px-2 py-0.5 rounded bg-[#090D16] border border-[#232936] text-[10px] font-sans text-white font-medium"
                          >
                            {svc}
                          </span>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleWatchlist(film.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-sans flex items-center gap-1.5 transition-all ${
                            inWatchlist
                              ? 'bg-[#4EDEAE]/20 border border-[#4EDEAE] text-[#4EDEAE]'
                              : 'bg-[#090D16] border border-[#232936] text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${inWatchlist ? 'fill-[#4EDEAE]' : ''}`} />
                          <span>{inWatchlist ? 'Saved' : 'Save'}</span>
                        </button>

                        <a
                          href={`https://letterboxd.com/search/${encodeURIComponent(film.title)}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#090D16] border border-[#232936] hover:border-[#E50914] text-xs font-sans text-[#9CA3AF] hover:text-white flex items-center gap-1 transition-colors"
                        >
                          <span>Letterboxd</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 bg-[#090D16] border-t border-[#232936] flex items-center justify-between text-xs font-sans text-[#9CA3AF]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#4EDEAE]" />
              <span>All five descriptions are spoiler-free</span>
            </div>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-[#E50914] text-white font-bold hover:bg-[#f40612] transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
