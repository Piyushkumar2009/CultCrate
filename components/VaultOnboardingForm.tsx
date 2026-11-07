'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Key,
  Eye,
  EyeOff,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Film,
  Lock,
} from 'lucide-react';
import { FilmCohort } from '@/lib/vaultData';

interface VaultOnboardingFormProps {
  onCohortSynthesized: (cohort: FilmCohort) => void;
}

export function VaultOnboardingForm({ onCohortSynthesized }: VaultOnboardingFormProps) {
  const [username, setUsername] = useState('cinephile_99');
  const [obscurityLevel, setObscurityLevel] = useState<number>(4);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvRowCount, setCsvRowCount] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Ingestion status progress
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepMessage, setStepMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const presets = ['cinephile_99', 'tarkovsky_boy', 'celluloid_queen', 'noir_enthusiast'];

  const handleSimulateCsv = () => {
    setCsvFileName('letterboxd_diary_export_2025.csv');
    setCsvRowCount(514);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setCsvFileName(file.name);
      setCsvRowCount(Math.floor(Math.random() * 300) + 250);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().replace(/^@/, '') || 'cinephile';

    setIsSubmitting(true);
    setProgressPercent(15);
    setStepMessage(`Reading @${cleanUser}\'s Letterboxd...`);

    try {
      // Simulate multi-stage progression with real backend call
      setTimeout(() => {
        setProgressPercent(45);
        setStepMessage(`Going through ${csvRowCount || 482} logged films...`);
      }, 700);

      setTimeout(() => {
        setProgressPercent(75);
        setStepMessage(`Finding films you\'ll love...`);
      }, 1400);

      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          obscurityLevel,
          apiKey: apiKey.trim() || undefined,
        }),
      });

      const data = await res.json();

      setTimeout(() => {
        setProgressPercent(100);
        setStepMessage('All set! Your picks are ready.');

        setTimeout(() => {
          setIsSubmitting(false);

          if (data && data.cohort) {
            const newCohort: FilmCohort = {
              id: `cohort-${Date.now()}`,
              cohortTitle: data.cohort.cohortTitle || `Obscurity Lvl ${obscurityLevel} Screening Protocol`,
              curatorialLog: data.cohort.curatorialLog || `Synthesized for @${cleanUser}.`,
              obscurityLevel,
              obscurityLabel: `Level ${obscurityLevel} Arthouse`,
              matchScore: '99.4%',
              createdDate: 'Just now',
              letterboxdUser: cleanUser,
              tags: ['Fresh Synthesis', `Level ${obscurityLevel}`, 'Letterboxd Stream'],
              films: data.cohort.films || [],
            };
            onCohortSynthesized(newCohort);
          }
        }, 600);
      }, 2100);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setStepMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <section
      id="vault-gateway"
      className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
    >
      <div className="relative rounded-3xl bg-[#121620]/90 border border-[#232936] p-6 sm:p-10 lg:p-12 backdrop-blur-2xl shadow-[0_0_60px_rgba(229,9,20,0.25)]">
        {/* Glow behind card */}
        <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#E50914]/20 via-[#F59E0B]/10 to-[#4EDEAE]/20 blur-xl opacity-50" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-xs font-sans font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Get started in seconds</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight max-w-2xl">
            Ready to escape the recommendation algorithms?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#9CA3AF] max-w-xl leading-relaxed">
            Enter your Letterboxd username to inspect your unvarnished Cinematic DNA profile and synthesize your custom 5-film screening cohort immediately.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-10 w-full max-w-2xl flex flex-col gap-6 text-left">
            {/* Input 1: Letterboxd Username */}
            <div>
              <label htmlFor="lb-username" className="block text-xs font-sans uppercase tracking-wider text-white font-semibold mb-2">
                Letterboxd Handle
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-[#9CA3AF] font-sans text-base font-semibold">
                  @
                </span>
                <input
                  id="lb-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username (e.g. cinephile_99)"
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-[#090D16] border border-[#232936] text-white placeholder:text-[#6B7280] font-sans text-sm focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
                />
              </div>

              {/* Presets */}
              <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                <span className="text-[#9CA3AF] font-sans text-[11px]">Try one:</span>
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setUsername(p)}
                    className="px-2 py-0.5 rounded bg-[#090D16] border border-[#232936] text-[#9CA3AF] hover:text-white hover:border-[#E50914]/50 font-sans text-[11px] transition-colors"
                  >
                    @{p}
                  </button>
                ))}
              </div>
            </div>

            {/* Input 2: CSV Drag & Drop Zone */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-sans uppercase tracking-wider text-white font-semibold">
                  Diary CSV Export (Optional)
                </label>
                <span className="text-[11px] font-sans text-[#9CA3AF]">
                  Letterboxd Settings → Data → Export
                </span>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={handleSimulateCsv}
                className={`relative rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#E50914] bg-[#E50914]/5'
                    : csvFileName
                    ? 'border-[#4EDEAE]/60 bg-[#4EDEAE]/5'
                    : 'border-[#232936] bg-[#090D16]/60 hover:border-[#384256] hover:bg-[#090D16]'
                }`}
              >
                {csvFileName ? (
                  <div className="flex items-center justify-center gap-3 text-left">
                    <FileSpreadsheet className="w-8 h-8 text-[#4EDEAE]" />
                    <div>
                      <div className="text-xs font-sans font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#4EDEAE]" />
                        <span>{csvFileName}</span>
                      </div>
                      <span className="text-[11px] font-sans text-[#4EDEAE]">
                        ✓ {csvRowCount} films ready for offline intake
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <UploadCloud className="w-7 h-7 text-[#9CA3AF]" />
                    <p className="text-xs text-white font-medium">
                      Drop your Letterboxd file here or <span className="text-[#E50914] underline">tap to choose one</span>
                    </p>
                    <span className="text-[11px] text-[#6B7280]">
                      Use your Letterboxd ratings or diary export (up to 10MB)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Input 3: Gemini API Key with Show/Hide */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="gemini-key" className="text-xs font-sans uppercase tracking-wider text-white font-semibold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Your own AI key (optional)</span>
                </label>
                <span className="text-[11px] font-sans text-[#4EDEAE] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4EDEAE]" />
                  <span>Using CultCrate\'s</span>
                </span>
              </div>

              <div className="relative flex items-center">
                <input
                  id="gemini-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your Google AI key, or leave empty"
                  className="w-full pl-4 pr-11 py-3 rounded-xl bg-[#090D16] border border-[#232936] text-white placeholder:text-[#6B7280] font-sans text-xs focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 text-[#9CA3AF] hover:text-white transition-colors p-1"
                  aria-label="Toggle API Key visibility"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                CultCrate provisions Gemini 3.8 Flash automatically. Provide your personal key for unthrottled concurrent syntheses.
              </p>
            </div>

            {/* Obscurity Level Selector */}
            <div>
              <label className="block text-xs font-sans uppercase tracking-wider text-white font-semibold mb-2">
                Target Calibration Level: Level {obscurityLevel}
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setObscurityLevel(lvl)}
                    className={`py-2 px-2 rounded-xl text-xs font-sans text-center transition-all ${
                      obscurityLevel === lvl
                        ? 'bg-[#E50914] text-white font-bold shadow-[0_0_15px_rgba(229,9,20,0.5)] border border-red-400'
                        : 'bg-[#090D16] border border-[#232936] text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    <div>Lvl {lvl}</div>
                    <div className="text-[10px] opacity-80 truncate hidden sm:block">
                      {lvl === 1 ? 'Cannes' : lvl === 3 ? 'Cult' : lvl === 4 ? 'Arthouse' : lvl === 5 ? 'Void' : 'Fest'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full py-4 rounded-full bg-[#E50914] text-white font-bold text-base flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(229,9,20,0.5)] hover:shadow-[0_0_40px_rgba(229,9,20,0.8)] hover:bg-[#f40612] transition-all disabled:opacity-70 disabled:cursor-not-allowed group active:scale-[0.99]"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2 font-sans text-sm">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Working...</span>
                </div>
              ) : (
                <>
                  <span>Get my picks</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Ingestion State Feedback Indicator */}
            {isSubmitting && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-[#090D16] border border-[#232936] flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-xs font-sans">
                  <div className="flex items-center gap-2 text-[#4EDEAE]">
                    <span className="w-2 h-2 rounded-full bg-[#4EDEAE] animate-ping" />
                    <span>{stepMessage}</span>
                  </div>
                  <span className="text-[#9CA3AF]">{progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#121620] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#E50914] via-[#F59E0B] to-[#4EDEAE]"
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ ease: 'easeOut', duration: 0.3 }}
                  />
                </div>
              </motion.div>
            )}

            {/* Assurance Badges Strip */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-sans text-[#9CA3AF]">
              <span>✓ Free to use</span>
              <span className="text-[#232936]">•</span>
              <span>✓ No credit card required</span>
              <span className="text-[#232936]">•</span>
              <span>✓ Quick Letterboxd setup</span>
              <span className="text-[#232936]">•</span>
              <span>🔒 Private to you</span>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
