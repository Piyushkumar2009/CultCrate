'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Check,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useLetterboxdValidation } from '@/hooks/useLetterboxdValidation';
import { LetterboxdStatusHint, letterboxdInputTone } from '@/components/LetterboxdStatusHint';

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHandle?: string;
  userEmail?: string;
  userId?: string;
  onProfileUpdated?: (newHandle: string) => void;
}

export function EditProfileModal({
  isOpen,
  onClose,
  currentHandle = '',
  userEmail = '',
  userId,
  onProfileUpdated,
}: EditProfileModalProps) {
  const [handle, setHandle] = useState<string>(currentHandle);
  // The username already saved on the account. It is accepted as-is, so only changes get checked.
  const [savedHandle, setSavedHandle] = useState<string>(currentHandle);
  const [isFamilySafe, setIsFamilySafe] = useState<boolean>(false);
  const [customRssUrl, setCustomRssUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prevIsOpen, setPrevIsOpen] = useState<boolean>(isOpen);

  // Render-phase sync when modal opens or closes
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setHandle(currentHandle);
      setSavedHandle(currentHandle);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }

  // Pre-fetch stored values from Supabase profile when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      const supabase = createClient();
      void (async () => {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          const {
            data: { user: authUser },
          } = await supabase.auth.getUser();
          const meta = (authUser?.user_metadata ?? {}) as Record<string, unknown>;

          // Account metadata is written on every save, so it is at least as fresh as the profiles row
          const storedHandle =
            (typeof meta.letterboxd_username === 'string' && meta.letterboxd_username) ||
            (profile && typeof profile.letterboxd_username === 'string' ? profile.letterboxd_username : '');
          if (storedHandle) {
            setHandle(storedHandle);
            setSavedHandle(storedHandle);
          }

          if (profile && typeof profile.family_safe_mode === 'boolean') {
            setIsFamilySafe(profile.family_safe_mode);
          } else if (typeof meta.family_safe_mode === 'boolean') {
            setIsFamilySafe(meta.family_safe_mode);
          }

          const storedRss =
            (profile && typeof profile.letterboxd_rss_url === 'string' ? profile.letterboxd_rss_url : '') ||
            (typeof meta.letterboxd_rss_url === 'string' ? meta.letterboxd_rss_url : '');
          if (storedRss) setCustomRssUrl(storedRss);
        } catch (err) {
          console.warn('[EditProfileModal] Preload notice:', err);
        }
      })();
    }
  }, [isOpen, userId]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  const cleanHandle = handle.trim().replace(/^@/, '');

  // Live Letterboxd username check (debounced 500ms) while the modal is open
  const letterboxd = useLetterboxdValidation(handle, { enabled: isOpen, skipValue: savedHandle });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!cleanHandle) {
      setErrorMessage('Please enter your Letterboxd username.');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cleanHandle)) {
      setErrorMessage('Usernames can only use letters, numbers, hyphens and underscores.');
      return;
    }

    if (!letterboxd.canSubmit) {
      setErrorMessage(
        letterboxd.status === 'checking'
          ? 'Hang on, we\'re still checking that Letterboxd username.'
          : letterboxd.message || 'Please enter a valid Letterboxd username.'
      );
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    try {
      // 1. Resolve current user ID if not provided as prop
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        effectiveUserId = currentUser?.id;
      }

      if (!effectiveUserId) {
        throw new Error('Active authenticated session required to update profile.');
      }

      const updatedAt = new Date().toISOString();

      const rssUrl = customRssUrl.trim() || null;

      // 2. Persist to the Supabase 'profiles' table. The row is read back after the write so a
      //    silent RLS rejection (no error, zero rows) is detected instead of reported as success.
      //    The second payload is a minimal fallback for databases without the optional columns.
      let profileSaved = false;
      let profileNote = '';
      const profilePayloads: Array<Record<string, string | null>> = [
        { id: effectiveUserId, letterboxd_username: cleanHandle, letterboxd_rss_url: rssUrl, updated_at: updatedAt },
        { id: effectiveUserId, letterboxd_username: cleanHandle, updated_at: updatedAt },
      ];
      for (const payload of profilePayloads) {
        const { data: saved, error: profileError } = await supabase
          .from('profiles')
          .upsert(payload, { onConflict: 'id' })
          .select('letterboxd_username')
          .maybeSingle();

        if (!profileError && saved && saved.letterboxd_username === cleanHandle) {
          profileSaved = true;
          break;
        }
        profileNote = profileError?.message ?? 'The saved row was not returned (check the profiles RLS policies).';
        console.warn('[EditProfileModal] profiles write attempt failed:', profileNote);
      }

      // 3. Persist to Supabase Auth user metadata (also what the dashboard reads on load)
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          letterboxd_username: cleanHandle,
          family_safe_mode: isFamilySafe,
          letterboxd_rss_url: rssUrl,
        },
      });
      const metadataSaved = !authError;
      if (authError) console.warn('[EditProfileModal] auth.updateUser failed:', authError.message);

      if (!profileSaved && !metadataSaved) {
        console.error('[EditProfileModal] Profile save failed:', authError?.message ?? profileNote);
        throw new Error('We could not save your profile. Please try again.');
      }

      // 4. Update local cache and dispatch real-time sync event
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`cultcrate_profile_handle_${effectiveUserId}`, cleanHandle);
        } catch {
          /* ignore */
        }

        window.dispatchEvent(
          new CustomEvent('cultcrate_profile_updated', {
            detail: {
              userId: effectiveUserId,
              letterboxd_username: cleanHandle,
              family_safe_mode: isFamilySafe,
            },
          })
        );
      }

      setSuccessMessage(
        profileSaved
          ? `Saved! Your Letterboxd username is now @${cleanHandle}.`
          : `Saved as @${cleanHandle}.`
      );
      onProfileUpdated?.(cleanHandle);

      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (err: unknown) {
      console.error('[EditProfileModal] Save error:', err);
      const msg = err instanceof Error ? err.message : '';
      setErrorMessage(msg.startsWith('We could not') || msg.startsWith('Please') ? msg : 'We could not update your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Portal to <body>: the dashboard header uses backdrop-filter, which turns it into the containing
  // block for position:fixed descendants and was clipping this modal inside the 64px header.
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 box-border overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isSaving) onClose();
          }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window: Centered perfectly with max-height 85vh and scrollable body */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-lg cc-modal-scroll bg-[#0e121b] border border-white/[0.08] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_60px_rgba(229,9,20,0.18)] z-10 my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/[0.06] bg-[#0e121b]/95 backdrop-blur sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center">
                <User className="w-4 h-4 text-[#E50914]" />
              </div>
              <div>
                <span className="font-sans text-[10px] text-[#E50914] uppercase tracking-wider font-bold block">
                  Your profile
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Edit profile
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!isSaving) onClose();
              }}
              disabled={isSaving}
              className="p-1.5 rounded-lg bg-[#141926] border border-[#232936] text-[#9CA3AF] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body: Scrollable */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
            {/* Success Alert */}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-emerald-950/80 border border-[#4EDEAE]/40 text-emerald-200 text-xs font-sans flex items-center gap-2.5 shadow-[0_0_20px_rgba(78,222,174,0.2)]"
              >
                <CheckCircle2 className="w-4 h-4 text-[#4EDEAE] shrink-0" />
                <span>{successMessage}</span>
              </motion.div>
            )}

            {/* Error Alert */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-sans flex items-center gap-2.5 shadow-[0_0_20px_rgba(229,9,20,0.2)]"
              >
                <AlertTriangle className="w-4 h-4 text-[#E50914] shrink-0" />
                <span>{errorMessage}</span>
              </motion.div>
            )}

            {/* User Session Info Card */}
            <div className="p-3 rounded-xl bg-[#141926] border border-[#232936] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-sans text-[#9CA3AF] uppercase block">
                  Signed in with
                </span>
                <span className="text-xs font-sans font-medium text-white">
                  {userEmail || 'Your account'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-sans text-[#4EDEAE] bg-[#4EDEAE]/10 border border-[#4EDEAE]/30 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4EDEAE] animate-pulse" />
                <span>Connected</span>
              </div>
            </div>

            {/* Letterboxd Username Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="letterboxd-username-input"
                  className="font-sans text-xs text-white font-semibold flex items-center gap-1.5"
                >
                  <span>Letterboxd Username</span>
                  <span className="text-[#E50914]">*</span>
                </label>
                {cleanHandle && (
                  <a
                    href={`https://letterboxd.com/${cleanHandle}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-sans text-[#4EDEAE] hover:underline flex items-center gap-1"
                  >
                    <span>View Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-sans text-sm font-bold">
                  @
                </span>
                <input
                  id="letterboxd-username-input"
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="your_letterboxd_handle"
                  disabled={isSaving}
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={letterboxd.status === 'invalid'}
                  className={`w-full bg-[#121622] border ${letterboxdInputTone(
                    letterboxd.status
                  )} text-white text-sm rounded-xl pl-8 pr-4 py-2.5 focus:outline-none focus:ring-1 placeholder-zinc-600 font-sans transition-colors disabled:opacity-50`}
                  required
                />
              </div>
              {letterboxd.status === 'idle' ? (
                <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                  We use this to read your public Letterboxd diary and build your Cinematic DNA.
                </p>
              ) : (
                <LetterboxdStatusHint status={letterboxd.status} message={letterboxd.message} />
              )}
            </div>

            {/* Family-Friendly Filter Toggle */}
            <div className="pt-2 border-t border-[#232936] flex items-center justify-between">
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-xs font-semibold text-white block">
                  Family-friendly picks
                </span>
                <p className="text-[11px] text-[#9CA3AF]">
                  Skip extreme violence and explicit content in your recommendations.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsFamilySafe((prev) => !prev)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border ${
                  isFamilySafe
                    ? 'bg-[#4EDEAE] border-[#4EDEAE]'
                    : 'bg-[#181E2C] border-[#232936]'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-[#090D16] transition-transform ${
                    isFamilySafe ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-[#232936] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!isSaving) onClose();
                }}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-[#141926] hover:bg-[#1a2030] border border-[#232936] text-xs font-sans text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || letterboxd.status === 'checking' || letterboxd.status === 'invalid'}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#B80710] text-white text-xs font-sans font-bold shadow-[0_0_20px_rgba(229,9,20,0.4)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}

export default EditProfileModal;
