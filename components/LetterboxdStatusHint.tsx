import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { LetterboxdStatus } from '@/hooks/useLetterboxdValidation';

interface LetterboxdStatusHintProps {
  status: LetterboxdStatus;
  message: string;
}

/** Live feedback line shown under a Letterboxd username input. Renders nothing while idle. */
export function LetterboxdStatusHint({ status, message }: LetterboxdStatusHintProps) {
  if (status === 'idle') return null;

  let icon: React.ReactNode;
  let text: string;
  let tone: string;

  switch (status) {
    case 'checking':
      icon = <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />;
      text = 'Checking Letterboxd...';
      tone = 'text-[#9CA3AF]';
      break;
    case 'valid':
      icon = <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      text = 'Found on Letterboxd';
      tone = 'text-[#4EDEAE]';
      break;
    case 'unavailable':
      icon = <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      text = message;
      tone = 'text-[#F59E0B]';
      break;
    default:
      icon = <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
      text = message;
      tone = 'text-red-400';
  }

  return (
    <p role="status" aria-live="polite" className={`flex items-start gap-1.5 font-sans text-[11px] leading-snug ${tone}`}>
      <span className="mt-px">{icon}</span>
      <span>{text}</span>
    </p>
  );
}

/** Border/focus classes for the username input, matching the current status. */
export function letterboxdInputTone(status: LetterboxdStatus): string {
  if (status === 'valid') return 'border-emerald-500/60 focus:border-emerald-400 focus:ring-emerald-400';
  if (status === 'invalid') return 'border-red-500/60 focus:border-red-400 focus:ring-red-400';
  return 'border-[#232936] focus:border-[#E50914] focus:ring-[#E50914]';
}
