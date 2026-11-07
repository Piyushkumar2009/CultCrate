'use client';

import React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Rocket,
  Play,
  ShieldCheck,
  Lock,
  Film,
  Star,
  ChevronRight,
  Info,
} from 'lucide-react';
import { OBSCURITY_LEVELS } from '@/lib/vaultData';

interface HeroSectionProps {
  onInitializeClick?: () => void;
  onInspectFilm?: (filmTitle: string) => void;
}

function HeroFilmPoster({
  title,
  year,
  rating,
}: {
  title: string;
  year: number;
  initialPoster?: string;
  rating: string;
}) {
  return (
    <div className="w-24 sm:w-28 h-36 sm:h-40 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-neutral-900 via-zinc-950 to-black relative border border-red-950/40 shadow-inner flex flex-col justify-between p-2.5 select-none group-hover:border-red-600/50 transition-all">
      <span className="text-[9px] font-sans font-bold text-red-500 uppercase tracking-wider">
        Film
      </span>
      <div className="my-auto py-1">
        <span className="text-zinc-200 font-bold text-xs uppercase leading-tight line-clamp-3">
          {title}
        </span>
        <span className="text-[10px] font-sans text-zinc-400 block mt-1 font-medium">
          ({year})
        </span>
      </div>
      <div className="px-1.5 py-0.5 rounded-full bg-red-950/40 border border-red-900/40 text-[10px] font-sans text-red-400 font-bold flex items-center gap-1 w-fit shadow-sm">
        <Star className="w-2.5 h-2.5 fill-red-400" />
        <span>★ {rating}</span>
      </div>
    </div>
  );
}

export function HeroSection({ onInspectFilm }: HeroSectionProps) {
  // Fixed level data preview (Level 4: Deep Arthouse)
  const currentLevelData = OBSCURITY_LEVELS[3];

  return (
    <section className="relative w-full pt-12 pb-20 px-4 sm:px-6 lg:px-8 flex flex-col items-center overflow-hidden">
      {/* Volumetric Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[480px] bg-[#E50914]/15 blur-[140px] rounded-full mix-blend-screen" />
      <div className="pointer-events-none absolute top-[520px] -right-20 w-[520px] h-[360px] bg-[#F59E0B]/10 blur-[130px] rounded-full mix-blend-screen" />
      <div className="pointer-events-none absolute top-[900px] -left-20 w-[480px] h-[400px] bg-[#4EDEAE]/10 blur-[140px] rounded-full mix-blend-screen" />

      {/* Top Engine Badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#121620]/90 border border-[#232936] shadow-[0_0_20px_-2px_rgba(229,9,20,0.35)] backdrop-blur-xl hover:border-[#E50914]/50 transition-all cursor-default"
      >
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E50914] opacity-80" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E50914]" />
        </span>
        <span className="text-xs font-sans font-semibold text-[#E50914] tracking-wider uppercase">
          ✦ Smart picks from your Letterboxd
        </span>
      </motion.div>

      {/* Main Headline */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="mt-6 text-center max-w-5xl"
      >
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
          Find your next{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-[#E50914] to-[#F59E0B] drop-shadow-[0_0_35px_rgba(229,9,20,0.5)]">
            hidden gems
          </span>
          .
        </h1>
        <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-[#9CA3AF] leading-relaxed text-balance">
          Connect your Letterboxd and get film recommendations made just for you. Skip the same old popular lists and discover movies you\'ll end up obsessing over.
        </p>
      </motion.div>

      {/* Dual CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md"
      >
        <Link
          href="/auth"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#E50914] text-white font-semibold text-base shadow-[0_0_24px_rgba(229,9,20,0.45)] hover:shadow-[0_0_36px_rgba(229,9,20,0.7)] hover:bg-[#f40612] hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Rocket className="w-5 h-5 text-white" />
          <span>Get started free</span>
        </Link>

        <a
          href="#how-it-works"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[#121620]/90 border border-[#232936] hover:bg-[#191F2C] hover:border-[#384256] text-white font-semibold text-base hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Play className="w-4 h-4 text-[#E50914] fill-[#E50914]" />
          <span>See how it works</span>
        </a>
      </motion.div>

      {/* Telemetry Strip */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-sans text-[#9CA3AF]">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-[#F59E0B]" />
          <span>Works with your Letterboxd</span>
        </div>
        <span className="text-[#232936]">•</span>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#4EDEAE]" />
          <span>No spoilers</span>
        </div>
        <span className="text-[#232936]">•</span>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#E50914]" />
          <span>Your data stays private</span>
        </div>
      </div>

      {/* Live Interactive Preview Micro-Widget */}
      <motion.div
        id="vault-preview"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="mt-12 w-full max-w-5xl"
      >
        <div className="relative rounded-2xl bg-[#121620]/90 border border-[#232936] p-4 sm:p-6 lg:p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_40px_rgba(229,9,20,0.15)]">
          {/* Card Terminal Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#232936]">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#E50914] shadow-[0_0_8px_rgba(229,9,20,0.6)]" />
                <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                <span className="w-3 h-3 rounded-full bg-[#4EDEAE]" />
              </div>
              <span className="text-xs font-sans tracking-wider text-[#9CA3AF] uppercase">
                Example only
              </span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4EDEAE]/10 border border-[#4EDEAE]/30 text-[#4EDEAE] text-xs font-sans">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4EDEAE] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4EDEAE]" />
              </span>
              <span>Sample</span>
            </div>
          </div>

          {/* Active Level Sub-Header */}
          <div className="mt-6 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-sans text-[#F59E0B] uppercase tracking-wider">
                Example picks:
              </span>
              <span className="text-xs font-bold text-white">
                {currentLevelData.title} — {currentLevelData.subtitle}
              </span>
            </div>
            <span className="text-[11px] font-sans text-[#4EDEAE] hidden sm:inline-block">
              Sample
            </span>
          </div>

          {/* Animated Film Cards Display */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="wait">
              {currentLevelData.films.map((film, idx) => (
                <motion.div
                  key={film.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, delay: idx * 0.1 }}
                  className="group relative rounded-xl bg-[#090D16]/90 border border-[#232936] p-4 flex gap-4 hover:border-[#E50914]/40 hover:bg-[#121620] transition-all shadow-md cursor-pointer"
                  onClick={() => onInspectFilm?.(film.title)}
                >
                  {/* Dynamic Film Poster Frame with Film Fallback */}
                  <HeroFilmPoster
                    title={film.title}
                    year={film.year}
                    initialPoster={film.poster}
                    rating={film.rating}
                  />

                  {/* Film Details */}
                  <div className="flex flex-col justify-between min-w-0 flex-1">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B]">
                          Why you might like it
                        </span>
                        <span className="text-xs font-sans text-[#9CA3AF]">
                          {film.year} · {film.runtime}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-white truncate mt-1.5 group-hover:text-[#E50914] transition-colors">
                        {film.title}
                      </h3>

                      <p className="text-xs text-[#9CA3AF] line-clamp-2 sm:line-clamp-3 mt-1 leading-relaxed">
                        {film.synopsis}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#232936]/60 mt-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-sans text-[#9CA3AF] truncate">
                        <Film className="w-3 h-3 text-[#E50914] shrink-0" />
                        <span className="truncate">{film.genome}</span>
                      </div>
                      <span className="text-[11px] font-sans font-semibold text-[#4EDEAE] bg-[#4EDEAE]/10 px-2 py-0.5 rounded border border-[#4EDEAE]/30 shrink-0">
                        {film.match} match
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Bottom interactive hint */}
          <div className="mt-4 pt-3 border-t border-[#232936] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#9CA3AF]">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Tap an example to see how recommendations look.</span>
            </div>
            <Link
              href="/auth"
              className="inline-flex items-center gap-1 text-[#E50914] font-medium hover:underline text-xs"
            >
              <span>Sign in for your own picks</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
