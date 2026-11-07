import assert from 'node:assert/strict';
import { computeTrend } from '../lib/adminTrends';
import { badgeForRank, computeStreak, rankCandidates, type LeaderboardCandidate } from '../lib/adminLeaderboard';
import { buildSyncEntry, deriveSyncState, nextSyncRecord, sortByAttention, summarizeSync } from '../lib/adminSync';
import { MAX_LIVE_ANNOUNCEMENTS, announcementKey, parseAnnouncementInput, parsePublicAnnouncements, sanitizeLinkUrl, toAnnouncement, visibleAnnouncements } from '../lib/adminAnnouncements';
import { decideUserDelete } from '../lib/adminUserDelete';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name); };

const NOW = Date.parse('2026-11-06T12:00:00Z');
const cand = (o: Partial<LeaderboardCandidate> & { userId: string }): LeaderboardCandidate => ({
  handle: o.userId, role: 'curator', filmsLogged: 0, currentStreak: null, recommendations: 0, lastSeenAt: null, letterboxdHandle: null, ...o,
});

/* ---- trends ---- */
t('trend: compares the last 7 values with the 7 before', () => {
  const tr = computeTrend([1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2]);
  assert.deepEqual(tr, { current: 14, previous: 7, deltaPct: 100, direction: 'up' });
});
t('trend: down, flat, and no-previous cases', () => {
  assert.equal(computeTrend([4, 4, 4, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 2]).direction, 'down');
  assert.equal(computeTrend([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]).direction, 'flat');
  const fresh = computeTrend([0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0]);
  assert.equal(fresh.deltaPct, null);
  assert.equal(fresh.direction, 'up');
  assert.deepEqual(computeTrend([]), { current: 0, previous: 0, deltaPct: null, direction: 'flat' });
});

/* ---- streaks ---- */
t('streak: counts back from today', () => {
  assert.deepEqual(computeStreak(['2026-11-06', '2026-11-05', '2026-11-04'], NOW), { current: 3, longest: 3 });
});
t('streak: still alive if the last log was yesterday, broken if older', () => {
  assert.equal(computeStreak(['2026-11-05', '2026-11-04'], NOW).current, 2);
  assert.equal(computeStreak(['2026-11-04', '2026-11-03'], NOW).current, 0);
});
t('streak: duplicates, junk and timestamps are handled; longest is the best run', () => {
  const r = computeStreak(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', 'nonsense', '', '2026-11-06T09:30:00Z', '2026-11-06'], NOW);
  assert.deepEqual(r, { current: 1, longest: 4 });
  assert.deepEqual(computeStreak([], NOW), { current: 0, longest: 0 });
});

/* ---- ranking ---- */
t('ranking: orders by metric, shares ranks on ties, and badges the top 3', () => {
  const rows = [
    cand({ userId: 'a', handle: 'a', filmsLogged: 300 }),
    cand({ userId: 'b', handle: 'b', filmsLogged: 500 }),
    cand({ userId: 'c', handle: 'c', filmsLogged: 300 }),
    cand({ userId: 'd', handle: 'd', filmsLogged: 100 }),
    cand({ userId: 'e', handle: 'e', filmsLogged: 0 }),
  ];
  const out = rankCandidates(rows, 'films');
  assert.deepEqual(out.map((e) => [e.userId, e.rank, e.badge]), [['b', 1, 'gold'], ['a', 2, 'silver'], ['c', 2, 'silver'], ['d', 4, null]]);
});
t('ranking: unmeasured streaks are left out and the limit applies', () => {
  const rows = [cand({ userId: 'a', currentStreak: 5 }), cand({ userId: 'b', currentStreak: null }), cand({ userId: 'c', currentStreak: 9 })];
  assert.deepEqual(rankCandidates(rows, 'streak').map((e) => e.userId), ['c', 'a']);
  assert.equal(rankCandidates(rows, 'streak', 1).length, 1);
  assert.equal(badgeForRank(3), 'bronze');
  assert.equal(badgeForRank(4), null);
});

/* ---- sync health ---- */
t('sync state: none = pending, failed = failed, success may be stale', () => {
  assert.deepEqual(deriveSyncState(null, NOW), { state: 'pending', stale: false });
  assert.equal(deriveSyncState({ status: 'failed', last_success_at: null }, NOW).state, 'failed');
  assert.deepEqual(deriveSyncState({ status: 'success', last_success_at: '2026-11-05T00:00:00Z' }, NOW), { state: 'success', stale: false });
  assert.deepEqual(deriveSyncState({ status: 'success', last_success_at: '2026-09-01T00:00:00Z' }, NOW), { state: 'success', stale: true });
  assert.equal(deriveSyncState({ status: 'weird', last_success_at: null }, NOW).state, 'pending');
});
t('sync record: failures count up, success resets and stamps last_success_at', () => {
  const fail1 = nextSyncRecord('u', null, { ok: false, message: 'Feed not found' }, '2026-11-06T10:00:00Z');
  assert.equal(fail1.consecutive_failures, 1);
  assert.equal(fail1.last_success_at, null);
  const fail2 = nextSyncRecord('u', { last_success_at: '2026-11-01T00:00:00Z', consecutive_failures: 1, films_synced: 40 }, { ok: false, message: 'x'.repeat(999) }, '2026-11-06T10:00:00Z');
  assert.equal(fail2.consecutive_failures, 2);
  assert.equal(fail2.last_success_at, '2026-11-01T00:00:00Z');
  assert.equal(fail2.films_synced, 40);
  assert.equal(fail2.message?.length, 300);
  const ok = nextSyncRecord('u', { last_success_at: null, consecutive_failures: 5, films_synced: null }, { ok: true, filmsSynced: 120.7 }, '2026-11-06T10:00:00Z');
  assert.deepEqual([ok.status, ok.consecutive_failures, ok.last_success_at, ok.films_synced], ['success', 0, '2026-11-06T10:00:00Z', 120]);
});
t('sync monitor: attention ordering and counts', () => {
  const mk = (handle: string, state: 'success' | 'pending' | 'failed', fails = 0, at: string | null = null) =>
    ({ ...buildSyncEntry({ userId: handle, handle, row: null, now: NOW }), state, consecutiveFailures: fails, lastAttemptAt: at });
  const list = [mk('ok', 'success', 0, '2026-11-06T00:00:00Z'), mk('new', 'pending'), mk('bad1', 'failed', 1), mk('bad3', 'failed', 3)];
  assert.deepEqual(sortByAttention(list).map((e) => e.handle), ['bad3', 'bad1', 'new', 'ok']);
  assert.deepEqual(summarizeSync(list), { success: 1, pending: 1, failed: 2, total: 4 });
  assert.equal(buildSyncEntry({ userId: 'x', handle: '', row: null, now: NOW }).letterboxdUrl, null);
});

/* ---- announcements ---- */
t('link sanitising: only https and same-site paths survive', () => {
  assert.equal(sanitizeLinkUrl('/dashboard'), '/dashboard');
  assert.equal(sanitizeLinkUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(sanitizeLinkUrl(''), null);
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.com', '/\\evil.com', 'http://example.com', 'ftp://x.com', 42]) {
    assert.equal(sanitizeLinkUrl(bad), undefined, String(bad));
  }
});
t('announcement create: validates, cleans and defaults', () => {
  const ok = parseAnnouncementInput({ message: '  Maintenance\n tonight\u0007  ', tone: 'warning', linkUrl: '/status' }, 'create');
  assert.deepEqual(ok, { ok: true, value: { message: 'Maintenance tonight', tone: 'warning', linkUrl: '/status', linkLabel: 'Learn more', dismissible: true } });
  assert.equal(parseAnnouncementInput({ message: '   ' }, 'create').ok, false);
  assert.equal(parseAnnouncementInput({ message: 'x'.repeat(281) }, 'create').ok, false);
  assert.equal(parseAnnouncementInput({ message: 'hi', tone: 'neon' }, 'create').ok, false);
  assert.equal(parseAnnouncementInput({ message: 'hi', linkUrl: 'javascript:1' }, 'create').ok, false);
  assert.equal(parseAnnouncementInput(null, 'create').ok, false);
});
t('announcement update: only touches the fields that are present', () => {
  assert.deepEqual(parseAnnouncementInput({ tone: 'critical' }, 'update'), { ok: true, value: { tone: 'critical' } });
  assert.deepEqual(parseAnnouncementInput({ linkUrl: null }, 'update'), { ok: true, value: { linkUrl: null, linkLabel: null } });
  assert.equal(parseAnnouncementInput({ message: '' }, 'update').ok, false);
});
t('announcement rows map to the public contract', () => {
  const a = toAnnouncement({ id: 'i', message: 'm', tone: 'info', link_url: null, link_label: null, dismissible: false, is_active: true, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' });
  assert.equal(a?.dismissible, false);
  assert.equal(a?.isActive, true);
  assert.equal(toAnnouncement({ id: 1 }), null);
});

t('public announcements: reads the array, falls back to the legacy single banner, ignores junk, caps the list', () => {
  const mk = (id: string, extra: Record<string, unknown> = {}) => ({ id, message: 'm' + id, tone: 'info', linkUrl: null, linkLabel: null, dismissible: true, updatedAt: 'u' + id, ...extra });
  assert.deepEqual(parsePublicAnnouncements({ announcements: [mk('a'), { id: 1 }, mk('b', { tone: 'neon' })] }).map((a) => a.id), ['a']);
  assert.deepEqual(parsePublicAnnouncements({ announcement: mk('legacy') }).map((a) => a.id), ['legacy']);
  assert.deepEqual(parsePublicAnnouncements(null), []);
  assert.deepEqual(parsePublicAnnouncements({ announcements: [] }), []);
  const many = Array.from({ length: 9 }, (_, i) => mk(String(i)));
  assert.equal(parsePublicAnnouncements({ announcements: many }).length, MAX_LIVE_ANNOUNCEMENTS);
});
t('visible announcements: dismissed ones drop out unless they are not dismissible', () => {
  const a = { id: 'a', message: 'a', tone: 'info' as const, linkUrl: null, linkLabel: null, dismissible: true, updatedAt: '1' };
  const b = { ...a, id: 'b' };
  const locked = { ...a, id: 'c', dismissible: false };
  const dismissed = new Set([announcementKey(a), announcementKey(locked)]);
  assert.deepEqual(visibleAnnouncements([a, b, locked], dismissed).map((x) => x.id), ['b', 'c']);
  // editing a banner changes its key, so it comes back
  assert.deepEqual(visibleAnnouncements([{ ...a, updatedAt: '2' }], dismissed).map((x) => x.id), ['a']);
});

/* ---- delete guard ---- */
t('delete: cannot delete yourself, a missing account, or an admin; can delete a curator', () => {
  const base = { callerId: 'me', targetId: 'u1', targetExists: true, targetIsAdmin: false };
  assert.deepEqual(decideUserDelete(base), { allowed: true });
  assert.equal(decideUserDelete({ ...base, targetId: 'me' }).allowed, false);
  const missing = decideUserDelete({ ...base, targetExists: false });
  assert.equal(missing.allowed === false && missing.code, 'not_found');
  const admin = decideUserDelete({ ...base, targetIsAdmin: true });
  assert.equal(admin.allowed === false && admin.code, 'not_allowed');
});

console.log(`\n${n} tests passed`);
