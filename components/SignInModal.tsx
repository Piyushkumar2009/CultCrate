'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Film, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignedIn: (username: string) => void;
}

export function SignInModal({ isOpen, onClose, onSignedIn }: SignInModalProps) {
  const [handle, setHandle] = useState('');
  const [cratePin, setCratePin] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = handle.trim().replace(/^@/, '') || 'cinephile';
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onSignedIn(clean);
      onClose();
    }, 1000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-[#121620] border border-[#232936] rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(229,9,20,0.25)] z-10"
        >
          <div className="flex items-center justify-between pb-4 border-b border-[#232936]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#090D16] border border-[#232936] flex items-center justify-center text-[#E50914]">
                <Film className="w-4 h-4" />
              </div>
              <span className="text-base font-bold text-white">
                Sign in to <span className="text-[#E50914]">CultCrate</span>
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#090D16] border border-[#232936] text-[#9CA3AF] hover:text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isSuccess ? (
            <div className="py-12 flex flex-col items-center text-center">
              <CheckCircle2 className="w-12 h-12 text-[#4EDEAE] animate-bounce mb-3" />
              <h3 className="text-lg font-bold text-white">You\'re signed in</h3>
              <p className="text-xs font-sans text-[#9CA3AF] mt-1">
                Loading encrypted vault session...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-sans uppercase tracking-wider text-white font-semibold mb-2">
                  Letterboxd Username
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-[#9CA3AF] font-sans text-sm">@</span>
                  <input
                    type="text"
                    required
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="username (e.g. cinephile_99)"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#090D16] border border-[#232936] text-white text-sm font-sans focus:outline-none focus:border-[#E50914]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-sans uppercase tracking-wider text-white font-semibold">
                    Vault Passkey / Crate PIN
                  </label>
                  <span className="text-[10px] font-sans text-[#9CA3AF]">Optional</span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-[#9CA3AF]">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={cratePin}
                    onChange={(e) => setCratePin(e.target.value)}
                    placeholder="Password (optional)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#090D16] border border-[#232936] text-white text-xs font-sans focus:outline-none focus:border-[#E50914]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 rounded-xl bg-[#E50914] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#f40612] transition-colors shadow-[0_0_20px_rgba(229,9,20,0.4)]"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setHandle('cinephile_99');
                  }}
                  className="text-xs text-[#9CA3AF] hover:text-[#E50914] font-sans transition-colors"
                >
                  Quick Sign In as Demo User (@cinephile_99)
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
