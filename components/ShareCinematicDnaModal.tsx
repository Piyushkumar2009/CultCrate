'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Share2,
  Download,
  Copy,
  Check,
  Film,
  Sparkles,
  Radio,
  ExternalLink,
  Shield,
  Clock,
  Layers,
  Flame,
} from 'lucide-react';

export interface ShareCinematicDnaModalProps {
  isOpen: boolean;
  onClose: () => void;
  letterboxdHandle: string;
  userEmail?: string;
  dynamicDnaDescription: string;
  dynamicVectorChips: { label: string; isHighlighted?: boolean }[];
  displayWatchedCount?: number | null;
  lastRunTimestamp?: number | null;
}

export function ShareCinematicDnaModal({
  isOpen,
  onClose,
  letterboxdHandle,
  userEmail,
  dynamicDnaDescription,
  dynamicVectorChips,
  displayWatchedCount,
  lastRunTimestamp,
}: ShareCinematicDnaModalProps) {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handle = letterboxdHandle || 'cinephile';
  const formattedDate = lastRunTimestamp
    ? new Date(lastRunTimestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

  const catalogedCountText =
    displayWatchedCount !== null && displayWatchedCount !== undefined && displayWatchedCount > 0
      ? `${displayWatchedCount.toLocaleString()} Films`
      : 'Letterboxd connected';

  // 1. Copy Formatted Bio / Snippet to Clipboard
  const handleCopyText = async () => {
    const tagsText = dynamicVectorChips
      .map((c) => `#${c.label.replace(/\s+/g, '')}`)
      .slice(0, 6)
      .join(' ');

    const shareSnippet = [
      `🎞️ My Cinematic DNA on CultCrate (@${handle})`,
      `Films logged: ${catalogedCountText}`,
      ``,
      `"${dynamicDnaDescription}"`,
      ``,
      tagsText,
      `Made with CultCrate`,
    ].join('\n');

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareSnippet);
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2200);
      }
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  // 2. Native Share API (Mobile / Modern Browsers)
  const handleNativeShare = async () => {
    const shareData = {
      title: `@${handle}'s Cinematic DNA | CultCrate`,
      text: `Here\'s my Cinematic DNA on CultCrate: "${dynamicDnaDescription.slice(0, 140)}..."`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await handleCopyText();
        }
      }
    } else {
      await handleCopyText();
    }
  };

  // 3. One-Click High-Res PNG Card Generator (Pure HTML5 Canvas)
  const handleDownloadPng = useCallback(() => {
    setIsExportingPng(true);

    try {
      const width = 1080;
      const height = 1350; // Standard 4:5 Instagram/Social resolution
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setIsExportingPng(false);
        return;
      }

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0a0d16');
      bgGrad.addColorStop(0.5, '#0e121d');
      bgGrad.addColorStop(1, '#080a11');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Radial glowing ambient light
      const radialRed = ctx.createRadialGradient(width * 0.85, height * 0.15, 20, width * 0.85, height * 0.15, 600);
      radialRed.addColorStop(0, 'rgba(229, 9, 20, 0.28)');
      radialRed.addColorStop(1, 'rgba(229, 9, 20, 0)');
      ctx.fillStyle = radialRed;
      ctx.fillRect(0, 0, width, height);

      const radialCyan = ctx.createRadialGradient(width * 0.15, height * 0.85, 20, width * 0.15, height * 0.85, 600);
      radialCyan.addColorStop(0, 'rgba(78, 222, 174, 0.20)');
      radialCyan.addColorStop(1, 'rgba(78, 222, 174, 0)');
      ctx.fillStyle = radialCyan;
      ctx.fillRect(0, 0, width, height);

      // Outer Frame
      ctx.strokeStyle = 'rgba(229, 9, 20, 0.45)';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, width - 80, height - 80);

      // Inner card container
      ctx.fillStyle = 'rgba(18, 22, 32, 0.85)';
      ctx.fillRect(60, 60, width - 120, height - 120);

      // Film Sprocket Perforations along Top & Bottom
      const sprocketWidth = 22;
      const sprocketHeight = 32;
      const sprocketYTop = 75;
      const sprocketYBottom = height - 107;
      ctx.fillStyle = '#090D16';
      for (let x = 85; x < width - 100; x += 55) {
        ctx.beginPath();
        ctx.roundRect(x, sprocketYTop, sprocketWidth, sprocketHeight, 6);
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(x, sprocketYBottom, sprocketWidth, sprocketHeight, 6);
        ctx.fill();
      }

      // Brand Header
      ctx.fillStyle = '#E50914';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('CULTCRATE', 90, 185);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '20px monospace';
      ctx.fillText('CINEMATIC DNA', 340, 185);

      ctx.fillStyle = '#4EDEAE';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('● CULTCRATE MEMBER', width - 90, 185);
      ctx.textAlign = 'left';

      // Divider Line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(90, 220);
      ctx.lineTo(width - 90, 220);
      ctx.stroke();

      // User Handle & Curator Identity
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 54px sans-serif';
      ctx.fillText(`@${handle}`, 90, 300);

      ctx.fillStyle = '#E50914';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('MY CINEMATIC DNA', 90, 345);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '18px monospace';
      ctx.fillText(`FILMS LOGGED: ${catalogedCountText.toUpperCase()} • UPDATED: ${formattedDate.toUpperCase()}`, 90, 380);

      // DNA Description Box
      ctx.fillStyle = 'rgba(9, 13, 22, 0.9)';
      ctx.strokeStyle = 'rgba(229, 9, 20, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(90, 480, width - 180, 340, 16);
      ctx.fill();
      ctx.stroke();

      // Quote Icon decoration
      ctx.fillStyle = '#E50914';
      ctx.font = 'bold 44px Georgia, serif';
      ctx.fillText('“', 120, 540);

      // Wrapped Text for DNA Description
      ctx.fillStyle = '#E5E7EB';
      ctx.font = '25px sans-serif';
      const maxTextWidth = width - 260;
      const lineHeight = 38;
      let textY = 560;

      const words = dynamicDnaDescription.split(' ');
      let currentLine = '';

      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && i > 0) {
          ctx.fillText(currentLine, 120, textY);
          currentLine = words[i] + ' ';
          textY += lineHeight;
          if (textY > 780) {
            currentLine += '...';
            break;
          }
        } else {
          currentLine = testLine;
        }
      }
      if (textY <= 780) {
        ctx.fillText(currentLine, 120, textY);
      }

      // Vector Tags Section
      ctx.fillStyle = '#9CA3AF';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('MY TASTE IN TAGS', 90, 875);

      let tagX = 90;
      let tagY = 910;
      const chipsToDraw = dynamicVectorChips.slice(0, 8);

      for (const chip of chipsToDraw) {
        const tagText = `#${chip.label}`;
        ctx.font = 'bold 20px monospace';
        const tagMetrics = ctx.measureText(tagText);
        const tagBoxWidth = tagMetrics.width + 36;
        const tagBoxHeight = 44;

        if (tagX + tagBoxWidth > width - 90) {
          tagX = 90;
          tagY += 56;
          if (tagY > 1080) break;
        }

        ctx.fillStyle = chip.isHighlighted ? 'rgba(229, 9, 20, 0.25)' : 'rgba(255, 255, 255, 0.06)';
        ctx.strokeStyle = chip.isHighlighted ? 'rgba(229, 9, 20, 0.7)' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(tagX, tagY, tagBoxWidth, tagBoxHeight, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = chip.isHighlighted ? '#ff545d' : '#D1D5DB';
        ctx.fillText(tagText, tagX + 18, tagY + 29);

        tagX += tagBoxWidth + 14;
      }

      // Footer Watermark & Barcode look
      const footerY = 1180;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(90, footerY);
      ctx.lineTo(width - 90, footerY);
      ctx.stroke();

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '17px monospace';
      ctx.fillText(`@${handle.toUpperCase()}`, 90, footerY + 38);

      ctx.fillStyle = '#4EDEAE';
      ctx.font = 'bold 17px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('MADE WITH CULTCRATE', width - 90, footerY + 38);
      ctx.textAlign = 'left';

      // Convert to image download
      const dataUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `cultcrate-dna-${handle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
      downloadLink.href = dataUrl;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error('PNG Export failed:', err);
    } finally {
      setIsExportingPng(false);
    }
  }, [
    handle,
    catalogedCountText,
    formattedDate,
    dynamicDnaDescription,
    dynamicVectorChips,
  ]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal Dialog Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-[#0e121b] border-2 border-[#232936] rounded-3xl shadow-[0_0_80px_rgba(229,9,20,0.35)] overflow-hidden z-10 my-4 sm:my-8 text-white"
        >
          {/* Top Decorative Scanning Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#E50914] via-[#F59E0B] to-[#4EDEAE]" />

          {/* Modal Header Toolbar */}
          <div className="px-5 py-4 border-b border-[#232936] flex items-center justify-between bg-[#121622]/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#E50914]/20 border border-[#E50914]/50 flex items-center justify-center shadow-[0_0_15px_rgba(229,9,20,0.4)]">
                <Sparkles className="w-4 h-4 text-[#E50914]" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-white uppercase font-sans">
                  Your Cinematic DNA card
                </h3>
                <p className="text-[10px] text-[#9CA3AF] font-sans">
                  Save or share your taste, @{handle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#141924] hover:bg-[#1f2637] border border-[#232936] text-zinc-400 hover:text-white transition-all cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Visual Card Content */}
          <div className="p-5 sm:p-7 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* The Visual Dossier Snapshot (Target for visual sharing) */}
            <div
              ref={cardRef}
              className="relative rounded-2xl bg-gradient-to-br from-[#121622] via-[#0b0e16] to-[#150d12] border-2 border-[#E50914]/40 p-5 sm:p-6 shadow-[0_15px_50px_rgba(0,0,0,0.8)] overflow-hidden space-y-5"
            >
              {/* Radial neon glow accents */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#E50914]/15 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#4EDEAE]/10 rounded-full blur-[80px] pointer-events-none" />

              {/* Card Header Stamp */}
              <div className="flex items-start justify-between flex-wrap gap-2 border-b border-[#232936] pb-3.5 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#E50914] flex items-center justify-center font-black text-xs text-white shadow-[0_0_12px_#E50914]">
                    CC
                  </div>
                  <div>
                    <span className="text-xs font-sans font-bold tracking-wider text-white block">
                      CULT<span className="text-[#E50914]">CRATE</span>
                    </span>
                    <span className="text-[9px] font-sans text-[#9CA3AF] uppercase block">
                      My taste in film
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] font-sans text-[#4EDEAE] bg-[#4EDEAE]/10 border border-[#4EDEAE]/30 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4EDEAE] animate-pulse" />
                  <span>Cinematic DNA</span>
                </div>
              </div>

              {/* Curator Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E50914] to-[#400004] border border-[#E50914]/60 flex items-center justify-center text-white text-lg font-bold font-sans shadow-[0_0_20px_rgba(229,9,20,0.5)]">
                    {handle.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-1.5">
                      <span>@{handle}</span>
                      <Shield className="w-4 h-4 text-[#E50914]" />
                    </h4>
                    <p className="text-xs font-sans text-zinc-400">
                      Film fan · {catalogedCountText}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E50914]/15 border border-[#E50914]/50 text-[#ff4d56] text-xs font-sans font-bold shadow-[0_0_12px_rgba(229,9,20,0.3)]">
                    <Flame className="w-3.5 h-3.5 text-[#E50914]" />
                    <span>Cinematic DNA</span>
                  </div>
                  <span className="block text-[10px] font-sans text-[#9CA3AF] mt-1">
                    Updated {formattedDate}
                  </span>
                </div>
              </div>

              {/* Dynamic DNA Description Box */}
              <div className="p-4 rounded-xl bg-[#090D16]/90 border border-[#232936] text-xs sm:text-sm text-gray-200 leading-relaxed font-sans relative z-10">
                <p className="italic text-gray-100">
                  &ldquo;{dynamicDnaDescription}&rdquo;
                </p>
              </div>

              {/* Active Taste Vector Chips */}
              <div className="space-y-2 relative z-10">
                <div className="flex items-center gap-1.5 text-[10px] font-sans text-[#9CA3AF] uppercase">
                  <Layers className="w-3 h-3 text-[#E50914]" />
                  <span>My taste in tags</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dynamicVectorChips.map((chip, idx) => (
                    <span
                      key={`${chip.label}-${idx}`}
                      className={`px-2.5 py-1 rounded-lg font-sans text-[10px] flex items-center gap-1 ${
                        chip.isHighlighted
                          ? 'bg-[#E50914]/20 border border-[#E50914]/50 text-[#ff5a62] font-bold'
                          : 'bg-[#121620] border border-[#232936] text-zinc-300'
                      }`}
                    >
                      <span className="text-[#E50914]">#</span>
                      <span>{chip.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Verification Stamp Footer */}
              <div className="pt-3 border-t border-[#232936] flex items-center justify-between text-[9px] font-sans text-zinc-500 relative z-10">
                <span>@{handle}</span>
                <span>Made with CultCrate</span>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="space-y-3">
              <h5 className="text-[11px] font-sans uppercase tracking-wider text-zinc-400 font-bold">
                Save or share
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Download High-Res PNG Card */}
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={isExportingPng}
                  className="py-3 px-4 rounded-xl bg-[#E50914] hover:bg-[#b80710] text-white text-xs font-sans font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(229,9,20,0.4)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingPng ? 'Preparing...' : 'Save as image'}</span>
                </button>

                {/* 2. Copy Formatted Bio Text */}
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="py-3 px-4 rounded-xl bg-[#121622] hover:bg-[#1a202e] border border-[#232936] hover:border-[#4EDEAE]/50 text-white text-xs font-sans font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-4 h-4 text-[#4EDEAE]" />
                      <span className="text-[#4EDEAE]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-zinc-400" />
                      <span>Copy text</span>
                    </>
                  )}
                </button>

                {/* 3. Native Share / Social Share */}
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="py-3 px-4 rounded-xl bg-[#121622] hover:bg-[#1a202e] border border-[#232936] hover:border-[#E50914]/50 text-white text-xs font-sans font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  <Share2 className="w-4 h-4 text-[#E50914]" />
                  <span>Share</span>
                </button>
              </div>

              {/* Extra External Link to Share Directly on Twitter/X */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#090D16] border border-[#232936] text-[11px] font-sans text-zinc-400">
                <span className="truncate">
                  Paste it into your Letterboxd bio, or post it on X or Discord.
                </span>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `My CultCrate Cinematic DNA: "${dynamicDnaDescription.slice(
                      0,
                      120
                    )}..." 🎬 @${handle}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4EDEAE] hover:text-white flex items-center gap-1 font-semibold ml-2 shrink-0 transition-colors"
                >
                  <span>Post on X</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ShareCinematicDnaModal;
