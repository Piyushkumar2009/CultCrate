'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { adminRequest } from '@/lib/adminClient';

export interface AdminResourceError {
  code: string;
  message: string;
}

export interface AdminResource<T> {
  data: T | null;
  error: AdminResourceError | null;
  /** true until the first response (success or failure) arrives */
  loading: boolean;
  /** true while a manual reload() is running (silent background polls never flip this) */
  refreshing: boolean;
  reload: () => Promise<void>;
  /** Patch the cached data locally (e.g. after a role change) without a round trip */
  setData: Dispatch<SetStateAction<T | null>>;
}

interface Options<T> {
  /** Runtime check of the response shape; a failing response is treated as an error */
  validate?: (value: unknown) => value is T;
  /** Quiet background refresh while the tab is visible */
  intervalMs?: number;
}

/**
 * Loads one /api/admin endpoint. Signed-out and non-admin responses redirect immediately (the server has
 * already refused them; this just moves the person away). Background polls that fail keep the last good data.
 */
export function useAdminResource<T>(path: string, options: Options<T> = {}): AdminResource<T> {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AdminResourceError | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const hasData = useRef<boolean>(false);
  const validateRef = useRef(options.validate);
  useEffect(() => {
    validateRef.current = options.validate;
  }, [options.validate]);
  const alive = useRef<boolean>(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (mode: 'initial' | 'manual' | 'silent'): Promise<void> => {
      if (mode === 'manual') setRefreshing(true);
      const res = await adminRequest<T>(path);
      if (!alive.current) return;

      if (!res.ok) {
        if (res.status === 401) router.replace('/auth?redirect=/admin');
        else if (res.status === 403 && res.code === 'no_access') router.replace('/dashboard');
        else if (mode !== 'silent' || !hasData.current) setError({ code: res.code, message: res.message });
      } else if (validateRef.current && !validateRef.current(res.data)) {
        if (mode !== 'silent' || !hasData.current) setError({ code: 'load_failed', message: "We couldn't read that data. Please try again." });
      } else {
        hasData.current = true;
        setData(res.data);
        setError(null);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [path, router]
  );

  useEffect(() => {
    void run('initial');
  }, [run]);

  const interval = options.intervalMs;
  useEffect(() => {
    if (!interval) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void run('silent');
    }, interval);
    return () => clearInterval(timer);
  }, [interval, run]);

  const reload = useCallback(() => run('manual'), [run]);
  return { data, error, loading, refreshing, reload, setData };
}
