'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu,
  X,
  Sparkles,
  Bookmark,
  Settings,
  LogOut,
  ExternalLink,
  UserCog,
  Edit3,
  ShieldCheck,
} from 'lucide-react';
import { getLocalWatchlist } from '@/lib/watchlistStorage';
import { EditProfileModal } from '@/components/EditProfileModal';
import { createClient } from '@/utils/supabase/client';
import { isAdminUser } from '@/lib/adminAnalytics';

export interface UserNavMenuProps {
  letterboxdHandle: string;
  userEmail?: string;
  userId?: string;
  isAuthenticated?: boolean;
  watchlistCount?: number;
  onSignOut?: () => void;
  isSigningOut?: boolean;
  onProfileUpdated?: (newHandle: string) => void;
}

export function UserNavMenu({
  letterboxdHandle,
  userEmail,
  userId,
  isAuthenticated,
  watchlistCount = 0,
  onSignOut,
  isSigningOut = false,
  onProfileUpdated,
}: UserNavMenuProps) {
  // The Screening Watchlist entry is shown only for signed-in users (never for guests)
  const isAuthed =
    isAuthenticated !== undefined ? isAuthenticated : Boolean(userId && userId.trim().length > 0);

  const [isOpen, setIsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Cosmetic only: shows the Admin Panel link to admins. Real access is enforced on the server.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(isAdminUser(data.session?.user.app_metadata));
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);
  const [currentHandle, setCurrentHandle] = useState<string>(letterboxdHandle);
  const [prevPropHandle, setPrevPropHandle] = useState<string>(letterboxdHandle);

  // Render-phase sync when prop changes
  if (letterboxdHandle !== prevPropHandle) {
    setPrevPropHandle(letterboxdHandle);
    setCurrentHandle(letterboxdHandle);
  }

  // Real-time listener for profile / Letterboxd handle updates across components
  useEffect(() => {
    const handleProfileSync = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && typeof detail.letterboxd_username === 'string' && detail.letterboxd_username.trim()) {
        setCurrentHandle(detail.letterboxd_username.trim());
      }
    };

    window.addEventListener('cultcrate_profile_updated', handleProfileSync);
    return () => {
      window.removeEventListener('cultcrate_profile_updated', handleProfileSync);
    };
  }, []);
  const [prevPropCount, setPrevPropCount] = useState<number>(watchlistCount);
  const [overrideCount, setOverrideCount] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync state during rendering when prop changes
  if (watchlistCount !== prevPropCount) {
    setPrevPropCount(watchlistCount);
    setOverrideCount(null);
  }

  const liveCount = overrideCount !== null ? overrideCount : watchlistCount;

  // Real-time synchronization with localStorage and custom window events
  useEffect(() => {
    const updateCount = (e?: Event) => {
      if (e && 'detail' in e && typeof (e as CustomEvent).detail?.count === 'number') {
        setOverrideCount((e as CustomEvent).detail.count);
      } else {
        const list = getLocalWatchlist(userId);
        setOverrideCount(list.length);
      }
    };

    window.addEventListener('cultcrate_watchlist_updated', updateCount);
    window.addEventListener('storage', updateCount);
    return () => {
      window.removeEventListener('cultcrate_watchlist_updated', updateCount);
      window.removeEventListener('storage', updateCount);
    };
  }, [userId]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      {/* Clean Header Menu Icon Button (Hamburger) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative h-10 w-10 rounded-xl border transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
          isOpen
            ? 'bg-[#1a202c] border-[#E50914] text-white shadow-[0_0_15px_rgba(229,9,20,0.35)]'
            : 'bg-[#121620] hover:bg-[#1a202c] border-[#232936] hover:border-[#E50914]/50 text-zinc-300 hover:text-white'
        }`}
        title="Menu"
        aria-label="Open menu"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="w-4 h-4 text-[#E50914]" />
        ) : (
          <Menu className="w-4 h-4 text-zinc-300" />
        )}

        {/* Real-time Badge Indicator on Hamburger Trigger (only if authenticated) */}
        {isAuthed && liveCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-[#4EDEAE] text-[#090D16] text-[9px] font-sans font-black flex items-center justify-center shadow-[0_0_10px_rgba(78,222,174,0.7)]">
            {liveCount > 99 ? '99+' : liveCount}
          </span>
        )}
      </button>

      {/* Interactive Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click-outside backdrop, portaled to <body> so it covers the whole viewport
                (the sticky header's backdrop-filter would otherwise clip a fixed child to the header).
                z-[39] keeps it under the header (z-40) that contains the dropdown. */}
            {typeof document !== 'undefined' &&
              createPortal(
                <div
                  className="fixed inset-0 z-[39] bg-black/40"
                  onClick={() => setIsOpen(false)}
                  aria-hidden="true"
                />,
                document.body
              )}

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-[#0e121b] border border-[#232936] shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(229,9,20,0.15)] overflow-hidden z-50 p-2.5 space-y-1.5"
            >
              {/* Prominent User Profile Header at Top */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#141926] to-[#121520] border border-[#232936] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-sans uppercase text-[#E50914] font-bold tracking-wider">
                    Signed in as
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-sans text-[#4EDEAE] bg-[#4EDEAE]/10 border border-[#4EDEAE]/30 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4EDEAE] animate-pulse" />
                    <span>Connected</span>
                  </div>
                </div>

                <div className="pt-0.5 flex items-center justify-between gap-2">
                  <div className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1 truncate">
                    <span>@{currentHandle || 'cinephile'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsEditProfileOpen(true);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-[#1a202c] hover:bg-[#252e40] border border-[#2d364a] text-[10px] font-sans text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                    title="Edit your profile"
                  >
                    <Edit3 className="w-2.5 h-2.5 text-[#E50914]" />
                    <span>Edit</span>
                  </button>
                </div>
                {userEmail && (
                  <p className="text-[11px] font-sans text-[#9CA3AF] truncate mt-0.5">
                    {userEmail}
                  </p>
                )}
              </div>

              {/* Navigation Links to Key Pages */}
              <nav className="space-y-1 pt-1">
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#141924] text-xs font-sans text-zinc-300 hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
                    </div>
                    <span className="font-semibold text-white">Home</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">Recommendations</span>
                </Link>

                {/* Screening Watchlist: Only displayed when successfully logged in and not on landing page */}
                {isAuthed && (
                  <Link
                    href="/watchlist"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#141924] text-xs font-sans text-zinc-300 hover:text-white transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#4EDEAE]/15 border border-[#4EDEAE]/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Bookmark className="w-3.5 h-3.5 text-[#4EDEAE] fill-[#4EDEAE]" />
                      </div>
                      <span className="font-semibold text-white">Watchlist</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-sans transition-all ${
                        liveCount > 0
                          ? 'bg-[#4EDEAE]/20 border border-[#4EDEAE]/40 text-[#4EDEAE] shadow-[0_0_10px_rgba(78,222,174,0.3)]'
                          : 'bg-[#121620] border border-[#232936] text-zinc-500'
                      }`}
                    >
                      {liveCount}
                    </span>
                  </Link>
                )}

                {/* Admin Panel: only rendered for admins (the /admin route itself is protected on the server) */}
                {isAuthed && isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#141924] text-xs font-sans text-zinc-300 hover:text-white transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center group-hover:scale-105 transition-transform shadow-[0_0_12px_-3px_rgba(229,9,20,0.6)]">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
                      </div>
                      <span className="font-semibold text-white">Admin Panel</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Manage</span>
                  </Link>
                )}

                {/* Edit Profile Menu Option */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsEditProfileOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#141924] text-xs font-sans text-zinc-300 hover:text-white transition-colors group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <UserCog className="w-3.5 h-3.5 text-[#E50914]" />
                    </div>
                    <span className="font-semibold text-white">Edit Profile</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">Username</span>
                </button>

                <Link
                  href="/settings"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#141924] text-xs font-sans text-zinc-300 hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Settings className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white" />
                    </div>
                    <span className="font-semibold text-white">Settings</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">Ratings &amp; API key</span>
                </Link>

                {currentHandle && (
                  <a
                    href={`https://letterboxd.com/${currentHandle}/`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#141924] text-xs font-sans text-zinc-400 hover:text-white transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white" />
                      </div>
                      <span>Letterboxd Profile</span>
                    </div>
                    <span className="text-[10px] text-zinc-600">Opens Letterboxd</span>
                  </a>
                )}
              </nav>

              {/* Sign Out Action at Bottom */}
              {onSignOut && (
                <div className="pt-2 border-t border-[#232936]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onSignOut();
                    }}
                    disabled={isSigningOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-950/30 text-xs font-sans text-red-400 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="w-3.5 h-3.5 text-[#E50914]" />
                    <span className="font-semibold">Sign Out</span>
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal Dialog */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        currentHandle={currentHandle}
        userEmail={userEmail}
        userId={userId}
        onProfileUpdated={(newHandle) => {
          setCurrentHandle(newHandle);
          onProfileUpdated?.(newHandle);
        }}
      />
    </div>
  );
}

export default UserNavMenu;
