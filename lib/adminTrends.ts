/** Week-over-week trend maths for the KPI cards. Pure and unit-tested. */

export type TrendDirection = 'up' | 'down' | 'flat';

export interface Trend {
  current: number;
  previous: number;
  /** Percentage change, rounded. null when there is no previous period to compare against. */
  deltaPct: number | null;
  direction: TrendDirection;
}

function sum(values: ReadonlyArray<number>): number {
  return values.reduce((total, n) => total + (Number.isFinite(n) ? n : 0), 0);
}

/**
 * Compares the last `window` values with the `window` values before them.
 * `values` is ordered oldest to newest (like the growth series the summary API returns).
 */
export function computeTrend(values: ReadonlyArray<number>, window = 7): Trend {
  const size = Math.max(1, Math.floor(window));
  const current = sum(values.slice(-size));
  const previous = sum(values.slice(-size * 2, -size));
  const deltaPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  const direction: TrendDirection = current > previous ? 'up' : current < previous ? 'down' : 'flat';
  return { current, previous, deltaPct, direction };
}
