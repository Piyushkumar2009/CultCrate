import type { AdminApiErrorCode } from '@/lib/adminAnalytics';

export type AdminRequestResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: AdminApiErrorCode | 'network'; message: string };

const KNOWN_CODES: ReadonlyArray<string> = ['signed_out', 'no_access', 'setup_required', 'load_failed', 'bad_request', 'not_found', 'not_allowed'];

/** Typed fetch for /api/admin/*: always resolves (never throws) with either the data or a friendly error. */
export async function adminRequest<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {}
): Promise<AdminRequestResult<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? 'GET',
      cache: 'no-store',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const payload: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const rec = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
      const code = typeof rec.code === 'string' && KNOWN_CODES.includes(rec.code) ? (rec.code as AdminApiErrorCode) : 'load_failed';
      const message = typeof rec.error === 'string' ? rec.error : "That didn't work. Please try again.";
      return { ok: false, status: res.status, code, message };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 0, code: 'network', message: "We couldn't reach the server. Check your connection and try again." };
  }
}
