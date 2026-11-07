'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, LogIn, Menu, X, Bookmark } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface NavbarProps {
  onOpenSignIn?: () => void;
  onOpenGetStarted?: () => void;
  activeSection?: string;
}

export function Navbar({ onOpenSignIn, onOpenGetStarted }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) {
        setIsAuthenticated(Boolean(user));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setIsAuthenticated(Boolean(session?.user));
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Screening Watchlist is only offered to signed-in users; guests never see it
  const showWatchlist = isAuthenticated;

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 inset-x-0 z-50 bg-[#090D16]/85 backdrop-blur-xl border-b border-[#232936]/80 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-7xl mx-auto h-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center group transition-opacity hover:opacity-90 active:scale-95"
          title="CultCrate home"
        >
          <span className="text-xl sm:text-2xl font-black tracking-tight text-white select-none">
            Cult<span className="text-[#E50914]">Crate</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-[#121620]/80 border border-[#232936]">
          <button
            onClick={() => scrollTo('how-it-works')}
            className="px-4 py-1.5 rounded-full text-sm font-medium text-[#9CA3AF] hover:text-white hover:bg-[#191F2C] transition-colors"
          >
            How It Works
          </button>
          <button
            onClick={() => scrollTo('vault-preview')}
            className="px-4 py-1.5 rounded-full text-sm font-medium text-[#9CA3AF] hover:text-white hover:bg-[#191F2C] transition-colors"
          >
            Preview
          </button>
          <button
            onClick={() => scrollTo('dna-engine')}
            className="px-4 py-1.5 rounded-full text-sm font-medium text-[#9CA3AF] hover:text-white hover:bg-[#191F2C] transition-colors"
          >
            Cinematic DNA
          </button>
          <button
            onClick={() => scrollTo('vault-archive')}
            className="px-4 py-1.5 rounded-full text-sm font-medium text-[#9CA3AF] hover:text-white hover:bg-[#191F2C] transition-colors"
          >
            Sample Picks
          </button>
        </nav>

        {/* Action CTAs */}
        <div className="flex items-center gap-3">
          {showWatchlist && (
            <Link
              href="/watchlist"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-[#9CA3AF] hover:text-white transition-colors px-3 py-2"
            >
              <Bookmark className="w-4 h-4 text-[#4EDEAE]" />
              <span>Watchlist</span>
            </Link>
          )}

          <Link
            href="/auth"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-[#9CA3AF] hover:text-white transition-colors px-3 py-2"
          >
            <LogIn className="w-4 h-4 text-[#9CA3AF]" />
            <span>Sign In</span>
          </Link>

          {/* Sleek, Compact "Get Started" CTA */}
          <Link
            href="/auth"
            className="group relative inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-[#E50914] text-white font-semibold text-xs sm:text-sm shadow-[0_0_20px_rgba(229,9,20,0.4)] hover:shadow-[0_0_30px_rgba(229,9,20,0.7)] hover:bg-[#f40612] hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Get Started</span>
          </Link>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-[#121620] border border-[#232936] text-[#9CA3AF] hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#090D16]/95 border-b border-[#232936] px-4 py-4 space-y-2 backdrop-blur-xl">
          <button
            onClick={() => scrollTo('how-it-works')}
            className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-[#9CA3AF] hover:text-white hover:bg-[#121620]"
          >
            How It Works
          </button>
          <button
            onClick={() => scrollTo('vault-preview')}
            className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-[#9CA3AF] hover:text-white hover:bg-[#121620]"
          >
            Preview
          </button>
          <button
            onClick={() => scrollTo('dna-engine')}
            className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-[#9CA3AF] hover:text-white hover:bg-[#121620]"
          >
            Cinematic DNA
          </button>
          <button
            onClick={() => scrollTo('vault-archive')}
            className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-[#9CA3AF] hover:text-white hover:bg-[#121620]"
          >
            Sample Picks
          </button>
          {showWatchlist && (
            <Link
              href="/watchlist"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-[#4EDEAE] hover:text-white hover:bg-[#121620] flex items-center gap-2"
            >
              <Bookmark className="w-4 h-4 text-[#4EDEAE]" />
              <span>Watchlist</span>
            </Link>
          )}
          <div className="pt-2 border-t border-[#232936] flex items-center justify-between">
            <Link
              href="/auth"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-[#9CA3AF] hover:text-white py-2"
            >
              Sign in
            </Link>
            <span className="text-xs font-sans text-[#6B7280]">CultCrate</span>
          </div>
        </div>
      )}
    </header>
  );
}
