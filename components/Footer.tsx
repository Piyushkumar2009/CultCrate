'use client';

import React from 'react';
import Link from 'next/link';
import { Film } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full bg-[#06090F] border-t border-[#232936] py-12 mt-20 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left branding & copyright */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <Link href="/" className="flex items-center gap-2 group">
            <Film className="w-4 h-4 text-[#E50914] group-hover:scale-110 transition-transform" />
            <span className="font-bold text-white text-sm">
              Cult<span className="text-[#E50914]">Crate</span>
            </span>
          </Link>
          <span className="text-[#232936] hidden sm:inline">•</span>
          <span className="text-xs font-sans text-[#9CA3AF]">
            © {new Date().getFullYear()} CultCrate
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#9CA3AF]">
          <Link href="/auth" className="hover:text-white transition-colors">
            Sign in
          </Link>
          <a
            href="https://letterboxd.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors"
          >
            Letterboxd
          </a>
          <a
            href="https://ai.google.dev"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors"
          >
            About the AI
          </a>
          <Link href="/docs" className="hover:text-white transition-colors">
            Setup guide
          </Link>
          <a href="#how-it-works" className="hover:text-white transition-colors">
            How It Works
          </a>
          <a href="#dna-engine" className="hover:text-white transition-colors">
            Cinematic DNA
          </a>
          <a href="#vault-archive" className="hover:text-white transition-colors">
            Sample picks
          </a>
        </nav>
      </div>
    </footer>
  );
}
