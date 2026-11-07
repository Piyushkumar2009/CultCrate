'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, ShieldCheck, Film, Lock } from 'lucide-react';

export function BottomCTASection() {
  return (
    <section
      id="vault-gateway"
      className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 my-10"
    >
      <div className="relative rounded-3xl bg-[#121620]/90 border border-[#232936] p-8 sm:p-12 lg:p-16 backdrop-blur-2xl shadow-[0_0_60px_rgba(229,9,20,0.25)] text-center overflow-hidden">
        {/* Ambient Backlit Halo Effect */}
        <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#E50914]/25 via-[#F59E0B]/15 to-[#4EDEAE]/20 blur-2xl opacity-60" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Top Pill / Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-xs font-sans font-semibold uppercase tracking-wider mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ready when you are</span>
          </div>

          {/* High-Impact Heading */}
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-3xl leading-[1.15]">
            Ready for something new to watch?
          </h2>

          {/* Short Supporting Description */}
          <p className="mt-4 text-base sm:text-lg text-[#9CA3AF] max-w-2xl leading-relaxed text-balance">
            Connect your Letterboxd and discover great films from around the world, picked for your taste and never repeating what you\'ve seen or saved.
          </p>

          {/* Single Prominent Cinema Red Button */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-xs">
            <Link
              href="/auth"
              className="w-full inline-flex items-center justify-center gap-2.5 py-4 px-8 rounded-full bg-[#E50914] hover:bg-[#B80710] text-white font-bold text-base shadow-[0_0_30px_rgba(229,9,20,0.5)] hover:shadow-[0_0_45px_rgba(229,9,20,0.8)] hover:scale-[1.02] active:scale-[0.98] transition-all group"
            >
              <span>Get Started</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
            </Link>
          </div>

          {/* Assurance Badges Strip */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-sans text-[#9CA3AF]">
            <div className="flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Quick Letterboxd setup</span>
            </div>
            <span className="text-[#232936]">•</span>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#4EDEAE]" />
              <span>No spoilers</span>
            </div>
            <span className="text-[#232936]">•</span>
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#E50914]" />
              <span>Your data stays private</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
