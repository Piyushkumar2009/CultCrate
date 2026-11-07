'use client';

import { useEffect, useState } from 'react';

export type LetterboxdStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'unavailable';

export interface LetterboxdValidation {
  /** The username without a leading "@" and surrounding spaces. */
  cleanHandle: string;
  status: LetterboxdStatus;
  /** Human-readable explanation for `invalid` and `unavailable`. Empty otherwise. */
  message: string;
  /**
   * True when the form may be submitted: the username exists, or Letterboxd could not be reached
   * (so an outage on their side never blocks someone from signing up or saving).
   */
  canSubmit: boolean;
}

interface Options {
  /** Turn checking on or off (e.g. only on the sign-up tab, or only while a modal is open). */
  enabled?: boolean;
  /** A username that is already saved and verified, so it is accepted without a network call. */
  skipValue?: string;
}

interface Verdict {
  handle: string;
  status: 'valid' | 'invalid' | 'unavailable';
  message: string;
}

const USERNAME_RE = /^[A-Za-z0-9_-]{1,40}$/;
const DEBOUNCE_MS = 500;
const FORMAT_MESSAGE = 'Usernames can only use letters, numbers, hyphens and underscores.';
const NOT_FOUND_MESSAGE = 'Letterboxd user not found';
const UNAVAILABLE_MESSAGE =
  "We couldn't reach Letterboxd to check this username. You can continue, and we'll check again when you sync.";

export function cleanLetterboxdHandle(raw: string): string {
  return raw.trim().replace(/^@/, '').trim();
}

export function useLetterboxdValidation(
  rawValue: string,
  { enabled = true, skipValue = '' }: Options = {}
): LetterboxdValidation {
  const cleanHandle = cleanLetterboxdHandle(rawValue);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const skipHandle = cleanLetterboxdHandle(skipValue);
  const isSkipped = skipHandle !== '' && cleanHandle.toLowerCase() === skipHandle.toLowerCase();
  const formatOk = USERNAME_RE.test(cleanHandle);
  const needsCheck = enabled && cleanHandle !== '' && formatOk && !isSkipped;

  // Debounced server check: waits for 500ms of no typing, and cancels any check that is out of date.
  useEffect(() => {
    if (!needsCheck) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/validate-letterboxd?username=${encodeURIComponent(cleanHandle)}`, {
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as { valid?: boolean; error?: string };
        if (controller.signal.aborted) return;

        if (res.ok && data.valid === true) {
          setVerdict({ handle: cleanHandle, status: 'valid', message: '' });
        } else if (res.status === 404 || res.status === 400) {
          setVerdict({ handle: cleanHandle, status: 'invalid', message: data.error || NOT_FOUND_MESSAGE });
        } else {
          setVerdict({ handle: cleanHandle, status: 'unavailable', message: UNAVAILABLE_MESSAGE });
        }
      } catch (err: unknown) {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
        setVerdict({ handle: cleanHandle, status: 'unavailable', message: UNAVAILABLE_MESSAGE });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [needsCheck, cleanHandle]);

  let status: LetterboxdStatus;
  let message = '';

  if (!enabled || cleanHandle === '') {
    status = 'idle';
  } else if (!formatOk) {
    status = 'invalid';
    message = FORMAT_MESSAGE;
  } else if (isSkipped) {
    status = 'valid';
  } else if (verdict && verdict.handle === cleanHandle) {
    status = verdict.status;
    message = verdict.message;
  } else {
    status = 'checking';
  }

  return {
    cleanHandle,
    status,
    message,
    canSubmit: status === 'valid' || status === 'unavailable',
  };
}
