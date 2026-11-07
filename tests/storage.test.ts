import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { downloadRatingsCsv, uploadRatingsCsv, withTimeout, isSyncRssResponse } from '../lib/vaultStorage';
import { buildCanonicalCsv } from '../lib/deduplication';

type DL = { data: Blob | null; error: { message: string; status?: number } | null };
function fake(download: () => Promise<DL>, calls: { uploads: number; dlArgs: unknown[] }) {
  return {
    storage: { from: (bucket: string) => ({
      download: (_p: string, opts: unknown, params: unknown) => { calls.dlArgs.push({ bucket, opts, params }); return download(); },
      upload: async () => { calls.uploads++; return { data: {}, error: null }; },
    }) },
  } as unknown as SupabaseClient;
}
(async () => {
  const calls = { uploads: 0, dlArgs: [] as unknown[] };

  // found + cache busting args
  let r = await downloadRatingsCsv(fake(async () => ({ data: new Blob(['a,b\n']), error: null }), calls), 'u1');
  assert.equal(r.status, 'found');
  const a = calls.dlArgs[0] as { bucket: string; opts: { cacheNonce: string }; params: { cache: string } };
  assert.equal(a.bucket, 'watchlists'); assert.equal(a.params.cache, 'no-store'); assert.match(a.opts.cacheNonce, /^\d+$/);
  console.log('ok - download is no-store + cacheNonce');

  // missing vs error are different
  r = await downloadRatingsCsv(fake(async () => ({ data: null, error: { message: 'Object not found', status: 404 } }), calls), 'u1');
  assert.equal(r.status, 'missing');
  r = await downloadRatingsCsv(fake(async () => ({ data: null, error: { message: 'fetch failed' } }), calls), 'u1');
  assert.equal(r.status, 'error');
  r = await downloadRatingsCsv(fake(async () => { throw new Error('network down'); }, calls), 'u1');
  assert.equal(r.status, 'error');
  console.log('ok - missing / error / thrown are distinguished (sync must abort on error)');

  // upload aborts on invalid CSV, never touches the network
  const client = fake(async () => ({ data: null, error: null }), calls);
  for (const bad of ['', 'Date,Name,Year,Letterboxd URI,Rating\n', 'Date,Name,Year,Letterboxd URI,Rating\n2020-01-01,undefined,2000,,3.5\n', 'Date,Name,Year,Letterboxd URI,Rating\n2020-01-01,X,2000,,NaN\n']) {
    const res = await uploadRatingsCsv(client, 'u1', bad);
    assert.equal(res.ok, false);
  }
  assert.equal(calls.uploads, 0);
  const good = buildCanonicalCsv('Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,"Hail, Caesar!",2016,https://boxd.it/a,3.5\n', null);
  assert.ok(good.ok);
  const ok = await uploadRatingsCsv(client, 'u1', good.csv);
  assert.equal(ok.ok, true); assert.equal(calls.uploads, 1);
  console.log('ok - invalid / zero-row CSV aborts before any write; valid CSV writes once');

  // timeout helper
  await assert.rejects(withTimeout(new Promise(() => undefined), 30, 'X'), /timed out/);
  assert.equal(await withTimeout(Promise.resolve(7), 50, 'X'), 7);
  assert.equal(isSyncRssResponse({ status: 'success' }), true); assert.equal(isSyncRssResponse({ ok: 1 }), false);
  console.log('ok - withTimeout / response guard');
})();
