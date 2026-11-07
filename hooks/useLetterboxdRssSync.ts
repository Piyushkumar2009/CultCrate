import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { pickLetterboxdHandle } from '@/lib/letterboxdRss';
import { isSyncRssResponse, type SyncRssResponse } from '@/lib/vaultStorage';

export interface RssSyncState {
  isSyncing: boolean;
  /** Unique films after merging stored CSV + live RSS */
  syncedCount: number | null;
  username: string | null;
  lastSyncedAt: Date | null;
  /** true when the last sync actually rewrote ratings.csv in Storage */
  wroteStorage: boolean;
  error: string | null;
}

export type RssSyncOutcome =
  | { ok: true; response: SyncRssResponse }
  | { ok: false; error: string };

export interface UseLetterboxdRssSyncOptions {
  /** Authenticated user id. The hook is inert until this is a non-empty string. */
  userId: string | null;
  /** Registered Letterboxd handle (profile / metadata). Never an email prefix. */
  handle: string;
  /** Set false to disable the one-time automatic sync (manual triggers still work). */
  autoSync?: boolean;
}

const INITIAL_STATE: RssSyncState = {
  isSyncing: false,
  syncedCount: null,
  username: null,
  lastSyncedAt: null,
  wroteStorage: false,
  error: null,
};

const REQUEST_TIMEOUT_MS = 30_000;

/** One request per user at a time, shared by every caller (auto-sync, Sync button, Run AI). */
const inFlight = new Map<string, Promise<RssSyncOutcome>>();

export function useLetterboxdRssSync({ userId, handle, autoSync = true }: UseLetterboxdRssSyncOptions) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<RssSyncState>(INITIAL_STATE);

  // Which user the current state belongs to; late responses for another user are dropped.
  const activeUserRef = useRef<string | null>(null);
  const autoSyncedForRef = useRef<string | null>(null);
  const handleRef = useRef<string>(handle);

  // Any change of user (login, logout, account switch) wipes hook state. Derived during render,
  // which is the supported alternative to calling setState inside an effect.
  const [trackedUserId, setTrackedUserId] = useState<string | null>(userId);
  if (trackedUserId !== userId) {
    setTrackedUserId(userId);
    setState(INITIAL_STATE);
  }

  useEffect(() => {
    handleRef.current = handle;
  }, [handle]);

  const reset = useCallback(() => {
    autoSyncedForRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  // Re-arm auto-sync and pin the active user whenever it changes
  useEffect(() => {
    activeUserRef.current = userId;
    autoSyncedForRef.current = null;
  }, [userId]);

  const triggerSync = useCallback(
    async (manualHandle?: string): Promise<RssSyncOutcome> => {
      const targetUserId = activeUserRef.current;
      if (!targetUserId) return { ok: false, error: 'Not signed in' };

      const targetHandle = pickLetterboxdHandle(manualHandle, handleRef.current);
      if (!targetHandle) {
        const error = 'No Letterboxd handle configured. Add it in Settings.';
        setState((prev) => ({ ...prev, isSyncing: false, error }));
        return { ok: false, error };
      }

      const isCurrent = (): boolean => activeUserRef.current === targetUserId;

      // Coalesce concurrent triggers into a single request
      const pending = inFlight.get(targetUserId);
      if (pending) return pending;

      setState((prev) => ({ ...prev, isSyncing: true, error: null }));

      const run = (async (): Promise<RssSyncOutcome> => {
        try {
          // The session token is read AFTER the caller proved the user exists
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token || session?.user.id !== targetUserId) {
            throw new Error('Session is not ready yet');
          }

          const res = await fetch('/api/sync-rss', {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ username: targetHandle }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });

          const payload: unknown = await res.json().catch(() => null);
          if (!isSyncRssResponse(payload)) {
            throw new Error(`Sync route returned an unreadable response (HTTP ${res.status})`);
          }
          if (!res.ok || payload.status === 'error') {
            throw new Error(payload.error ?? `Sync route returned HTTP ${res.status}`);
          }

          if (isCurrent()) {
            setState({
              isSyncing: false,
              syncedCount: typeof payload.uniqueCount === 'number' ? payload.uniqueCount : null,
              username: targetHandle,
              lastSyncedAt: new Date(),
              wroteStorage: payload.wroteStorage === true,
              // A 'warning' is a safe skip (e.g. validation refused the write), not a failure
              error: payload.status === 'warning' ? payload.message ?? null : null,
            });
          }
          return { ok: true, response: payload };
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : 'RSS sync failed';
          console.warn('[RSS Sync] background sync failed:', error);
          if (isCurrent()) setState((prev) => ({ ...prev, isSyncing: false, error }));
          return { ok: false, error };
        } finally {
          inFlight.delete(targetUserId);
        }
      })();

      inFlight.set(targetUserId, run);
      return run;
    },
    [supabase]
  );

  // One automatic silent sync per authenticated user, only once user + handle are known.
  useEffect(() => {
    if (!autoSync || !userId || !handle) return;
    if (autoSyncedForRef.current === userId) return;
    autoSyncedForRef.current = userId;
    void triggerSync();
  }, [autoSync, userId, handle, triggerSync]);

  return { ...state, triggerSync, reset };
}
