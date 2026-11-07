'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Archive,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { FilmCohort } from '@/lib/vaultData';

interface VaultHistoryArchiveProps {
  cohorts: FilmCohort[];
  onOpenCohort: (cohort: FilmCohort) => void;
}

export function VaultHistoryArchive({ cohorts, onOpenCohort }: VaultHistoryArchiveProps) {
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // Filter cohorts
  const filteredCohorts = cohorts.filter((c) => {
    if (selectedTag === 'All') return true;
    return (
      c.tags.some((t) => t.toLowerCase().includes(selectedTag.toLowerCase()))
    );
  });

  const filterTags = ['All', 'Masterpiece', 'Neo-Noir'];

  return (
    <section id="vault-archive" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#232936]">
        <div>
          <div className="flex items-center gap-2 text-xs font-sans font-semibold text-[#E50914] uppercase tracking-widest">
            <Archive className="w-4 h-4" />
            <span>Examples</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
            Sample picks
          </h2>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Browse a few example sets to see what your recommendations could look like.
          </p>
        </div>

        {/* Filter Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-all ${
                selectedTag === tag
                  ? 'bg-[#E50914] text-white font-bold shadow-[0_0_12px_rgba(229,9,20,0.4)]'
                  : 'bg-[#121620] border border-[#232936] text-[#9CA3AF] hover:text-white hover:bg-[#191F2C]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Cohorts */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {filteredCohorts.map((cohort, index) => (
          <motion.div
            key={cohort.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="group relative rounded-2xl bg-[#121620]/80 border border-[#232936] p-5 sm:p-6 flex flex-col justify-between hover:border-[#E50914]/40 hover:bg-[#121620] transition-all shadow-xl"
          >
            <div>
              {/* Cohort Header Meta */}
              <div className="flex items-center justify-between gap-2 text-xs font-sans pb-3 border-b border-[#232936]/60">
                <span className="text-[#F59E0B] font-semibold">{cohort.tags[0] ?? 'Curated'}</span>
                <span className="text-[#4EDEAE] bg-[#4EDEAE]/10 px-2 py-0.5 rounded border border-[#4EDEAE]/30">
                  {cohort.matchScore} match
                </span>
              </div>

              {/* Title & Log */}
              <h3 className="text-lg font-bold text-white mt-3 group-hover:text-[#E50914] transition-colors leading-snug">
                {cohort.cohortTitle}
              </h3>

              <p className="text-xs text-[#9CA3AF] mt-2 line-clamp-2 leading-relaxed">
                {cohort.curatorialLog}
              </p>

              {/* Mini-Poster Stack Visualization */}
              <div className="mt-5 pt-3">
                <div className="flex items-center justify-between text-[11px] font-sans text-[#9CA3AF] mb-2">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-[#E50914]" />
                    <span>5 films</span>
                  </span>
                  <span>@{cohort.letterboxdUser}</span>
                </div>

                {/* Overlapping poster stack */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
                  {cohort.films.map((film, fIdx) => (
                    <div
                      key={film.id || fIdx}
                      className="relative w-14 h-20 rounded-md overflow-hidden shrink-0 border border-red-950/40 bg-gradient-to-br from-neutral-900 via-zinc-950 to-black group/poster shadow-md flex flex-col justify-between text-[7px] font-sans leading-tight select-none p-1.5"
                      title={`${film.title} (${film.year}) - Dir: ${film.director}`}
                    >
                      <span className="text-[6px] text-red-500 font-bold uppercase">35mm</span>
                      <span className="font-bold text-zinc-100 truncate block my-auto">{film.title}</span>
                      <span className="text-zinc-500 font-bold">({film.year})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {cohort.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-[#090D16] border border-[#232936] text-[10px] font-sans text-[#9CA3AF]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Action CTA */}
            <div className="mt-6 pt-4 border-t border-[#232936] flex items-center justify-between">
              <span className="text-[11px] font-sans text-[#6B7280]">
                {cohort.createdDate}
              </span>

              <button
                onClick={() => onOpenCohort(cohort)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#090D16] border border-[#232936] hover:border-[#E50914] text-xs font-sans font-semibold text-white hover:text-[#E50914] transition-all group-hover:bg-[#191F2C]"
              >
                <span>See all 5 films</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
