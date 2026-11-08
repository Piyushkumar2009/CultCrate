'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Check, CheckCircle2, Copy, Eye, EyeOff, UserPlus, Wand2, X } from 'lucide-react';
import { adminRequest } from '@/lib/adminClient';
import { validateCreateUserInput, type CreateUserResult } from '@/lib/adminCreateUser';
import { BTN_NEUTRAL, BTN_SOLID_RED, INPUT_CLASS, Spinner } from './adminUiKit';

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after the account exists so the page can refresh its lists and show a toast. */
  onCreated: (user: CreateUserResult['user']) => void;
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generatePassword(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

/** Modal form that lets an admin create an already-verified account. Portaled to <body> like the other dialogs. */
export default function CreateUserModal({ open, onClose, onCreated }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateUserResult['user'] | null>(null);
  const [copied, setCopied] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const reset = (): void => {
    setEmail('');
    setPassword('');
    setUsername('');
    setShowPassword(false);
    setBusy(false);
    setError(null);
    setCreated(null);
    setCopied(false);
  };

  const close = (): void => {
    if (busy) return;
    reset(); // the password must not linger in memory after the dialog closes
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    emailRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) {
        reset();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy, onClose]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const checked = validateCreateUserInput({ email, password, letterboxdUsername: username });
    if (!checked.ok) {
      setError(checked.error);
      return;
    }

    setBusy(true);
    const res = await adminRequest<CreateUserResult>('/api/admin/create-user', {
      method: 'POST',
      body: checked.value,
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }

    setCreated(res.data.user);
    onCreated(res.data.user);
  };

  const copyPassword = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically. Select the password and copy it by hand.");
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} className="fixed inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative z-10 my-auto w-full max-w-md space-y-5 rounded-2xl border border-white/[0.08] bg-[#0d111a] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_60px_rgba(229,9,20,0.18)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E50914]/40 bg-[#E50914]/10 text-[#ff4d56]">
                  <UserPlus className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 id="create-user-title" className="text-lg font-semibold tracking-tight text-white">
                  {created ? 'Account created' : 'Create user directly'}
                </h3>
              </div>
              <button type="button" onClick={close} disabled={busy} aria-label="Close" className="cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.04] p-1.5 text-zinc-400 hover:text-white disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            </div>

            {created ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5 rounded-xl border border-[#4EDEAE]/40 bg-[#0b1713] px-3.5 py-3 text-xs leading-relaxed text-emerald-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4EDEAE]" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-white">{created.email}</span> can sign in right now. Their email is already confirmed, so no verification email was sent.
                  </span>
                </div>

                <div className="space-y-1.5 rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-3 font-mono text-xs">
                  <p className="text-zinc-500">Letterboxd: <span className="text-zinc-200">@{created.letterboxdUsername}</span></p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-zinc-500">Password: <span className="text-zinc-200">{showPassword ? password : '••••••••••••'}</span></p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="cursor-pointer rounded-md border border-white/[0.08] bg-white/[0.04] p-1.5 text-zinc-400 hover:text-white">
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button type="button" onClick={copyPassword} aria-label="Copy password" className="cursor-pointer rounded-md border border-white/[0.08] bg-white/[0.04] p-1.5 text-zinc-400 hover:text-white">
                        {copied ? <Check className="h-3.5 w-3.5 text-[#4EDEAE]" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-zinc-500">
                  This is the only time the password is shown. Share it privately; they can change it any time with “Forgot password?” on the sign-in page.
                </p>

                {error && <p role="alert" className="rounded-xl border border-[#E50914]/40 bg-[#1a080a] px-3.5 py-2.5 text-xs text-red-200">{error}</p>}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={reset} className={`${BTN_NEUTRAL} px-4 py-2.5 text-xs`}>Create another</button>
                  <button type="button" onClick={close} className={BTN_SOLID_RED}>Done</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <p className="text-xs leading-relaxed text-zinc-500">
                  The account is created with its email already verified, so the person can sign in immediately.
                </p>

                <label className="block space-y-1.5">
                  <span className="font-mono text-[11px] text-zinc-400">Email</span>
                  <input ref={emailRef} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" autoComplete="off" spellCheck={false} disabled={busy} className={INPUT_CLASS} />
                </label>

                <label className="block space-y-1.5">
                  <span className="flex items-center justify-between font-mono text-[11px] text-zinc-400">
                    Password
                    <button
                      type="button"
                      onClick={() => {
                        setPassword(generatePassword());
                        setShowPassword(true);
                      }}
                      disabled={busy}
                      className="inline-flex cursor-pointer items-center gap-1 text-[#ff4d56] hover:text-white disabled:opacity-50"
                    >
                      <Wand2 className="h-3 w-3" aria-hidden="true" /> Generate
                    </button>
                  </span>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" spellCheck={false} disabled={busy} className={`${INPUT_CLASS} pr-10`} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 text-zinc-500 hover:text-white">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="font-mono text-[11px] text-zinc-400">Letterboxd username</span>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="cinephile_99" autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} disabled={busy} className={INPUT_CLASS} />
                </label>

                {error && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl border border-[#E50914]/40 bg-[#1a080a] px-3.5 py-2.5 text-xs leading-relaxed text-red-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff4d56]" aria-hidden="true" />
                    <span>{error}</span>
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={close} disabled={busy} className={`${BTN_NEUTRAL} px-4 py-2.5 text-xs`}>Cancel</button>
                  <button type="submit" disabled={busy} className={BTN_SOLID_RED}>
                    {busy ? <Spinner /> : <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
                    {busy ? 'Creating...' : 'Create User Directly'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
