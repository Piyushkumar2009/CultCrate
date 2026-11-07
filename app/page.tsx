'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { HowItWorksBento } from '@/components/HowItWorksBento';
import { VaultHistoryArchive } from '@/components/VaultHistoryArchive';
import { BottomCTASection } from '@/components/BottomCTASection';
import { CohortDetailModal } from '@/components/CohortDetailModal';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { FilmCohort, SAMPLE_COHORTS } from '@/lib/vaultData';

export default function HomePage() {
  const [cohorts] = useState<FilmCohort[]>(SAMPLE_COHORTS);
  const [activeModalCohort, setActiveModalCohort] = useState<FilmCohort | null>(null);

  return (
    <div className="min-h-[100dvh] bg-[#090D16] text-[#F9FAFB] flex flex-col font-sans selection:bg-[#E50914] selection:text-white overflow-x-clip">
      {/* Sticky Header Navigation (sits below the announcement bar, then pins to the top on scroll) */}
      <Navbar />

      {/* Main Landing Sections */}
      <main className="flex-1">
        {/* Section 1: Hero & Simulated Live Interactive Obscurity Preview */}
        <HeroSection
          onInspectFilm={(title) => {
            const found = cohorts.find((c) =>
              c.films.some((f) => f.title.toLowerCase().includes(title.toLowerCase()))
            ) || cohorts[0];
            setActiveModalCohort(found);
          }}
        />

        {/* Section 2: How It Works & Vault Capabilities Bento Grid */}
        <HowItWorksBento />

        {/* Section 3: Vault History Archive & Curatorial Telemetry */}
        <VaultHistoryArchive
          cohorts={cohorts}
          onOpenCohort={(c) => setActiveModalCohort(c)}
        />

        {/* Section 4: High-Impact Bottom CTA Gateway */}
        <BottomCTASection />
      </main>

      {/* Deep Cohort Inspection Modal */}
      <CohortDetailModal
        cohort={activeModalCohort}
        onClose={() => setActiveModalCohort(null)}
      />

      {/* Public footer (Docs, Privacy, Terms, Contact modal) */}
      <PublicFooter />
    </div>
  );
}
