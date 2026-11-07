import assert from 'node:assert/strict';
import {
  aggregateCountries,
  aggregateGenres,
  buildActivitySeries,
  buildGrowthSeries,
  buildUserRows,
  deriveHandle,
  deriveStatus,
  isAdminUser,
  summarizeKpis,
  type RawAuthUser,
} from '../lib/adminAnalytics';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name); };

const NOW = Date.parse('2026-11-10T12:00:00Z');
const day = (offset: number): string => new Date(NOW - offset * 86_400_000).toISOString();

const users: RawAuthUser[] = [
  { id: 'a', email: 'ava@x.com', created_at: day(40), last_sign_in_at: day(1), email_confirmed_at: day(40), app_metadata: { role: 'admin' }, user_metadata: { letterboxd_username: '@ava' } },
  { id: 'b', email: 'ben@x.com', created_at: day(10), last_sign_in_at: day(2), email_confirmed_at: day(10), user_metadata: {} },
  { id: 'c', email: 'cy@x.com', created_at: day(3), last_sign_in_at: null, email_confirmed_at: null },
  { id: 'd', email: 'dee@x.com', created_at: day(60), last_sign_in_at: day(50), email_confirmed_at: day(60) },
  { id: 'e', email: 'eli@x.com', created_at: day(1), last_sign_in_at: day(0), email_confirmed_at: day(1), banned_until: new Date(NOW + 86_400_000).toISOString() },
];

t('isAdminUser only trusts role === "admin" in app metadata', () => {
  assert.equal(isAdminUser({ role: 'admin' }), true);
  assert.equal(isAdminUser({ role: 'user' }), false);
  assert.equal(isAdminUser({ role: 'ADMIN' }), false);
  assert.equal(isAdminUser({ is_admin: true }), false);
  assert.equal(isAdminUser(null), false);
  assert.equal(isAdminUser('admin'), false);
  assert.equal(isAdminUser(undefined), false);
});

t('deriveStatus: suspended > pending > active > inactive', () => {
  assert.equal(deriveStatus(users[4], NOW), 'suspended');
  assert.equal(deriveStatus(users[2], NOW), 'pending');
  assert.equal(deriveStatus(users[1], NOW), 'active');
  assert.equal(deriveStatus(users[3], NOW), 'inactive');
});

t('deriveHandle prefers Letterboxd handle, falls back to e-mail name, never an id', () => {
  assert.equal(deriveHandle(users[0]), 'ava');
  assert.equal(deriveHandle(users[1]), 'ben');
  assert.equal(deriveHandle(users[1], 'benny'), 'benny');
  assert.equal(deriveHandle({ id: 'zzz-uuid', created_at: day(1) }), 'Unnamed curator');
});

t('buildUserRows sorts admins first and maps roles/status in plain terms', () => {
  const rows = buildUserRows(users, { now: NOW, lastRecommendationAt: new Map([['b', NOW - 3600_000]]) });
  assert.equal(rows[0].handle, 'ava');
  assert.equal(rows[0].role, 'admin');
  assert.equal(rows.find((r) => r.handle === 'ben')?.lastRecommendationAt !== null, true);
  assert.equal(rows.find((r) => r.handle === 'cy')?.status, 'pending');
  assert.equal(rows.filter((r) => r.role === 'admin').length, 1);
});

t('buildGrowthSeries: cumulative totals and daily new / last-seen counts', () => {
  const g = buildGrowthSeries(users, NOW, 30);
  assert.equal(g.length, 30);
  assert.equal(g[g.length - 1].totalCurators, 5);
  assert.equal(g[0].totalCurators, 2);                       // a(40d) and d(60d) existed 29 days ago
  assert.equal(g.reduce((s, p) => s + p.newCurators, 0), 3); // b, c, e joined inside the window
  assert.equal(g[g.length - 1].seenThatDay, 1);              // e signed in today
  assert.match(g[g.length - 1].label, /^Nov 10$/);
});

t('buildActivitySeries buckets run timestamps by day', () => {
  const s = buildActivitySeries([NOW, NOW - 1000, NOW - 86_400_000 * 2, NOW - 86_400_000 * 90, Number.NaN], NOW, 7);
  assert.equal(s.length, 7);
  assert.equal(s[6].runs, 2);
  assert.equal(s[4].runs, 1);
  assert.equal(s.reduce((a, p) => a + p.runs, 0), 3);
});

t('aggregateGenres counts each genre once per film, merges case, ranks and shares', () => {
  const g = aggregateGenres([
    { genre: ['Thriller', 'Crime'] },
    { genre: ['thriller', 'Thriller', 'Drama'] },
    { genre: 'Crime, Mystery' },
    { genre: undefined },
  ]);
  // Thriller and Crime are tied at 2 films each; ties break alphabetically so the order is deterministic
  assert.deepEqual(g.slice(0, 2).map((x) => [x.label, x.count]), [['Crime', 2], ['Thriller', 2]]);
  assert.equal(g.find((x) => x.label === 'Drama')?.count, 1);
  assert.ok(Math.abs(g.reduce((s, x) => s + x.share, 0) - 100) < 0.2);
  assert.deepEqual(aggregateGenres([]), []);
});

t('aggregateCountries ignores placeholders', () => {
  const c = aggregateCountries([{ country: 'Japan' }, { country: 'Japan' }, { country: 'International' }, { country: 'Global' }]);
  assert.deepEqual(c.map((x) => x.label), ['Japan']);
});

t('summarizeKpis', () => {
  const k = summarizeKpis({
    users, now: NOW, librariesLinked: 2,
    runTimestamps: [NOW - 3600_000, NOW - 86_400_000 * 20],
    filmsLoggedPerCurator: [120, 0, 300, Number.NaN, -5],
  });
  assert.equal(k.totalCurators, 5);
  assert.equal(k.admins, 1);
  assert.equal(k.newThisWeek, 2);          // c (3d) and e (1d)
  assert.equal(k.activeThisMonth, 3);      // a, b, e
  assert.equal(k.filmsLogged, 420);
  assert.equal(k.recommendationRunsThisWeek, 1);
  assert.equal(k.librariesLinked, 2);
});

console.log(`\n${n} admin analytics test groups passed`);

import { compactNumber, formatDate, timeAgo } from '../lib/adminFormat';

t('adminFormat: friendly dates and numbers', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();
  assert.equal(timeAgo(ago(0), now), 'Today');
  assert.equal(timeAgo(ago(1), now), 'Yesterday');
  assert.equal(timeAgo(ago(5), now), '5 days ago');
  assert.equal(timeAgo(ago(45), now), '1 month ago');
  assert.equal(timeAgo(ago(400), now), '1 year ago');
  assert.equal(timeAgo(null, now), 'Not yet');
  assert.equal(timeAgo('garbage', now, 'Never'), 'Never');
  assert.equal(formatDate('2026-11-03T08:00:00Z'), 'Nov 3, 2026');
  assert.equal(formatDate(null), '—');
  assert.equal(compactNumber(950), '950');
  assert.equal(compactNumber(12_400), '12.4k');
  assert.equal(compactNumber(2_000_000), '2M');
});
console.log(`\n${n} admin test groups passed (incl. formatting)`);
