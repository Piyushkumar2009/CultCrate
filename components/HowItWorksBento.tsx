'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Rss,
  Sliders,
  Sparkles,
  Dna,
  RefreshCw,
  Filter,
  CheckCircle2,
} from 'lucide-react';

export function HowItWorksBento() {
  // Interactive DNA Profiler Data
  const [activeDnaCategory, setActiveDnaCategory] = useState<'directors' | 'aesthetics' | 'pacing'>('directors');

  const dnaCategories = {
    directors: [
      { label: 'Denis Villeneuve (epic scale and atmosphere)', score: 98, color: '#E50914' },
      { label: 'Bong Joon-ho (sharp, funny social stories)', score: 96, color: '#F59E0B' },
      { label: 'David Fincher (tight, precise thrillers)', score: 94, color: '#4EDEAE' },
      { label: 'Kiyoshi Kurosawa (quiet, creeping dread)', score: 92, color: '#ff545d' },
    ],
    aesthetics: [
      { label: 'Hidden gems over big hits', score: 97, color: '#E50914' },
      { label: 'Slow-burn tension', score: 95, color: '#F59E0B' },
      { label: 'Dark, shadowy neo-noir looks', score: 93, color: '#4EDEAE' },
      { label: 'Film grain and analog texture', score: 90, color: '#ff545d' },
    ],
    pacing: [
      { label: 'Open-ended stories', score: 96, color: '#E50914' },
      { label: 'Sound that sets the mood', score: 94, color: '#F59E0B' },
      { label: 'Films between 105 and 145 minutes', score: 91, color: '#4EDEAE' },
      { label: 'Unusual, unhurried pacing', score: 89, color: '#ff545d' },
    ],
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* 3-Step Explainer Section Header */}
      <div id="how-it-works" className="flex flex-col items-center text-center max-w-3xl mx-auto mb-14">
        <span className="text-xs font-sans font-semibold text-[#F59E0B] uppercase tracking-widest">
          How it works
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
          Three steps to your next favorite film.
        </h2>
        <p className="text-sm sm:text-base text-[#9CA3AF] mt-3 leading-relaxed">
          We read your Letterboxd history and use AI to find films that match your taste.
        </p>
      </div>

      {/* 3-Step Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
        {/* Step 1 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="group relative rounded-2xl bg-[#121620]/80 border border-[#232936] p-6 sm:p-7 flex flex-col justify-between hover:border-[#E50914]/40 hover:bg-[#121620] transition-all shadow-lg"
        >
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-sans font-bold text-[#E50914] tracking-widest">
                STEP 1
              </span>
              <div className="w-10 h-10 rounded-xl bg-[#090D16] border border-[#232936] flex items-center justify-center text-[#4EDEAE]">
                <Rss className="w-5 h-5 text-[#4EDEAE]" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white">Connect Letterboxd</h3>
            <p className="text-sm text-[#9CA3AF] mt-2 leading-relaxed">
              Add your Letterboxd username or upload your ratings file. There\'s nothing to type in by hand. We learn what you love from what you\'ve already rated.
            </p>
          </div>

          {/* Micro-UI */}
          <div className="mt-6 p-3 rounded-xl bg-[#090D16]/90 border border-[#232936] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-sans text-white">
              <span className="text-[#9CA3AF]">@</span>
              <span className="font-semibold">cinephile_curator</span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-sans text-[#4EDEAE] bg-[#4EDEAE]/10 px-2 py-0.5 rounded border border-[#4EDEAE]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4EDEAE]" />
              <span>Synced</span>
            </div>
          </div>
        </motion.div>

        {/* Step 2 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="group relative rounded-2xl bg-[#121620]/80 border border-[#232936] p-6 sm:p-7 flex flex-col justify-between hover:border-[#F59E0B]/40 hover:bg-[#121620] transition-all shadow-lg"
        >
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-sans font-bold text-[#F59E0B] tracking-widest">
                STEP 2
              </span>
              <div className="w-10 h-10 rounded-xl bg-[#090D16] border border-[#232936] flex items-center justify-center text-[#F59E0B]">
                <Sliders className="w-5 h-5 text-[#F59E0B]" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white">Only new films</h3>
            <p className="text-sm text-[#9CA3AF] mt-2 leading-relaxed">
              Anything you\'ve logged on Letterboxd or saved to your watchlist is left out automatically, so every pick is something new.
            </p>
          </div>

          {/* Micro-UI */}
          <div className="mt-6 p-3 rounded-xl bg-[#090D16]/90 border border-[#232936] flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-sans">
              <span className="text-[#9CA3AF]">Diary + watchlist</span>
              <span className="text-[#4EDEAE] font-bold">Skipped</span>
            </div>
            <div className="relative h-2 w-full bg-[#232936] rounded-full overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-[#F59E0B] to-[#4EDEAE] rounded-full" />
            </div>
          </div>
        </motion.div>

        {/* Step 3 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="group relative rounded-2xl bg-[#121620]/80 border border-[#232936] p-6 sm:p-7 flex flex-col justify-between hover:border-[#E50914]/40 hover:bg-[#121620] transition-all shadow-lg"
        >
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-sans font-bold text-[#E50914] tracking-widest">
                STEP 3
              </span>
              <div className="w-10 h-10 rounded-xl bg-[#090D16] border border-[#232936] flex items-center justify-center text-[#E50914]">
                <Sparkles className="w-5 h-5 text-[#E50914]" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white">Get your picks</h3>
            <p className="text-sm text-[#9CA3AF] mt-2 leading-relaxed">
              AI looks at the films you rate highest and hands you a fresh set of picks, with the director, runtime and where to watch. Your last set is saved for next time.
            </p>
          </div>

          {/* Micro-UI */}
          <div className="mt-6 p-3 rounded-xl bg-[#090D16]/90 border border-[#232936] flex flex-col gap-1">
            <div className="text-xs font-sans text-white truncate font-medium">
              Sample batch: Tokyo Rain Neo-Noir
            </div>
            <div className="flex items-center justify-between text-[#9CA3AF] text-[11px] font-sans">
              <span>Saved for next time</span>
              <span className="text-[#E50914] font-bold">Sample</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bento Grid Header */}
      <div id="dna-engine" className="flex flex-col items-center text-center max-w-3xl mx-auto mb-12">
        <span className="text-xs font-sans font-semibold text-[#E50914] uppercase tracking-widest">
          What you get
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
          Made for people who really love movies.
        </h2>
        <p className="text-sm sm:text-base text-[#9CA3AF] mt-3 leading-relaxed">
          A taste profile that\'s truly yours, an always up-to-date diary, and picks that never repeat what you\'ve seen or saved.
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bento 1: Your Cinematic DNA (Expanded 12-Col Flagship Feature) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="lg:col-span-12 rounded-2xl bg-[#121620]/90 border border-[#232936] p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden"
        >
          {/* Subtle Ambient Radial Lighting */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#E50914]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#4EDEAE]/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#232936]">
              <div className="flex items-center gap-2 text-[#F59E0B] text-xs font-sans uppercase tracking-wider">
                <Dna className="w-4 h-4 text-[#E50914]" />
                <span className="font-bold text-white">Your Cinematic DNA</span>
                <span className="text-[#9CA3AF]">• Sample</span>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-[#090D16] p-1 rounded-xl border border-[#232936]">
                <button
                  type="button"
                  onClick={() => setActiveDnaCategory('directors')}
                  className={`text-xs font-sans px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeDnaCategory === 'directors'
                      ? 'bg-[#E50914] text-white font-bold shadow-[0_0_12px_rgba(229,9,20,0.5)]'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  Directors
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDnaCategory('aesthetics')}
                  className={`text-xs font-sans px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeDnaCategory === 'aesthetics'
                      ? 'bg-[#E50914] text-white font-bold shadow-[0_0_12px_rgba(229,9,20,0.5)]'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  Look & feel
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDnaCategory('pacing')}
                  className={`text-xs font-sans px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeDnaCategory === 'pacing'
                      ? 'bg-[#E50914] text-white font-bold shadow-[0_0_12px_rgba(229,9,20,0.5)]'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  Storytelling
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-6">
              {/* Left narrative & vector tags */}
              <div className="lg:col-span-5 space-y-4">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  A profile of what you love
                </h3>
                <p className="text-sm text-[#9CA3AF] leading-relaxed">
                  CultCrate studies your Letterboxd diary and sums up your taste: favorite directors, moods and pacing. You get a profile you can share with friends.
                </p>

                <div className="p-3.5 rounded-xl bg-[#090D16] border border-[#232936] space-y-2">
                  <div className="flex items-center justify-between text-xs font-sans">
                    <span className="text-[#9CA3AF]">Match strength:</span>
                    <span className="text-[#4EDEAE] font-bold">Strong match</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['#HiddenGems', '#SlowBurn', '#NeoNoir', '#FilmGrain', '#Auteurs'].map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded text-[10px] font-sans bg-[#121620] border border-[#232936] text-zinc-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right DNA Genome Bars */}
              <div className="lg:col-span-7 p-5 rounded-xl bg-[#090D16]/95 border border-[#232936] space-y-4">
                {dnaCategories[activeDnaCategory].map((item, idx) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-sans">
                      <span className="text-white font-medium">{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>
                        {item.score}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[#1c2230] rounded-full overflow-hidden">
                      <motion.div
                        key={`${activeDnaCategory}-${idx}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.score}%` }}
                        transition={{ duration: 0.6, delay: idx * 0.08 }}
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: item.color,
                          boxShadow: `0 0 10px ${item.color}80`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bento 2: Continuous RSS Auto-Sync (6 Cols) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-6 rounded-2xl bg-[#121620]/85 border border-[#232936] p-6 sm:p-8 flex flex-col justify-between shadow-xl"
        >
          <div>
            <div className="flex items-center gap-2 text-[#4EDEAE] text-xs font-sans uppercase tracking-wider">
              <RefreshCw className="w-4 h-4" />
              <span>Letterboxd sync</span>
            </div>
            <h3 className="text-2xl font-bold text-white mt-3">Always up to date</h3>
            <p className="text-sm text-[#9CA3AF] mt-2 leading-relaxed">
              Each time you open your dashboard, CultCrate checks your public Letterboxd diary and adds anything new, with no duplicates. Prefer a file? You can upload your ratings in Settings.
            </p>
          </div>

          <ul className="mt-6 space-y-2 text-xs font-sans text-[#9CA3AF]">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#4EDEAE] shrink-0" /><span>Updates when you open the app</span></li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#4EDEAE] shrink-0" /><span>Never adds the same film twice</span></li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#4EDEAE] shrink-0" /><span>Tap Sync whenever you like</span></li>
          </ul>
        </motion.div>

        {/* Bento 3: Zero Spoilers & Exclusion Filter (6 Cols) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-6 rounded-2xl bg-[#121620]/85 border border-[#232936] p-6 sm:p-8 flex flex-col justify-between shadow-xl"
        >
          <div>
            <div className="flex items-center gap-2 text-[#E50914] text-xs font-sans uppercase tracking-wider">
              <Filter className="w-4 h-4" />
              <span>Smart filtering</span>
            </div>
            <h3 className="text-2xl font-bold text-white mt-3">Never repeats what you\'ve seen</h3>
            <p className="text-sm text-[#9CA3AF] mt-2 leading-relaxed">
              Your diary and your watchlist are checked before picks are made, and again before you see them, so repeats don\'t slip through.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {['Letterboxd diary', 'Your watchlist', 'No repeats'].map((label) => (
              <span
                key={label}
                className="px-3 py-1.5 rounded-lg text-xs font-sans flex items-center gap-1.5 bg-[#E50914]/10 border border-[#E50914]/40 text-white"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E50914]" />
                <span>{label}</span>
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default HowItWorksBento;
