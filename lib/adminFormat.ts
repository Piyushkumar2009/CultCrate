/** Plain-language date helpers for the Admin Panel. Pure and unit-tested. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** "Today", "Yesterday", "5 days ago", "3 months ago". `fallback` is shown when there is no date. */
export function timeAgo(iso: string | null | undefined, now: number, fallback = 'Not yet'): string {
  if (!iso) return fallback;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return fallback;

  const days = Math.floor((now - t) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return value.toLocaleString('en-US');
}
