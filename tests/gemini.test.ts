import assert from 'node:assert/strict';
import type { GoogleGenAI } from '@google/genai';
import {
  FALLBACK_GEMINI_MODELS,
  GeminiFallbackError,
  generateContentWithFallback,
  getGeminiModelChain,
  isModelUnavailableError,
  isOverloadedError,
  isQuotaError,
  isRetiredModel,
  rankDiscoveredModels,
} from '../lib/geminiModels';

const g = 'generateContent';
const realFetch = globalThis.fetch;
let n = 0;
const t = async (name: string, fn: () => Promise<void> | void) => { await fn(); n++; console.log('ok -', name); };

function mockModelList(pages: Array<Array<{ name: string; supportedGenerationMethods: string[] }>> | number, calls: { urls: string[]; headers: Array<string | null> }) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.urls.push(String(input));
    calls.headers.push(new Headers(init?.headers).get('x-goog-api-key'));
    if (typeof pages === 'number') return new Response('{"error":"bad"}', { status: pages });
    const url = new URL(String(input));
    const idx = Number(url.searchParams.get('pageToken') ?? 0);
    return new Response(JSON.stringify({ models: pages[idx], nextPageToken: idx + 1 < pages.length ? String(idx + 1) : undefined }), { status: 200 });
  }) as typeof fetch;
}

const catalogue = [
  { name: 'models/gemini-1.5-flash', supportedGenerationMethods: [g] },       // retired
  { name: 'models/gemini-2.0-flash', supportedGenerationMethods: [g] },       // retired
  { name: 'models/gemini-2.5-flash', supportedGenerationMethods: [g] },
  { name: 'models/gemini-3.6-flash', supportedGenerationMethods: [g] },
  { name: 'models/gemini-3.8-flash', supportedGenerationMethods: [g] },
  { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: [g] },
  { name: 'models/gemini-3.9-flash-preview', supportedGenerationMethods: [g] },
  { name: 'models/gemini-3.8-pro', supportedGenerationMethods: [g] },
  { name: 'models/gemini-flash-latest', supportedGenerationMethods: [g] },
  { name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: [g] },   // non-text
  { name: 'models/gemini-3.1-flash-image', supportedGenerationMethods: [g] }, // non-text
  { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
  { name: 'models/gemma-3-27b-it', supportedGenerationMethods: [g] },         // not gemini-*
];

(async () => {
  delete process.env.GEMINI_MODEL;

  await t('retired generations are recognised by pattern, not by a list that rots', () => {
    for (const id of ['gemini-1.5-flash', 'gemini-1.5-pro-latest', 'gemini-1.0-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite-001', 'gemini-pro'])
      assert.equal(isRetiredModel(id), true, id);
    for (const id of ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest']) assert.equal(isRetiredModel(id), false, id);
  });

  await t('ranking: stable before preview, newest first, flash > flash-lite > pro; junk removed', () => {
    const ranked = rankDiscoveredModels(catalogue.map((m) => ({ name: m.name, methods: m.supportedGenerationMethods })));
    assert.deepEqual(ranked, [
      'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest',
      'gemini-3.9-flash-preview', 'gemini-3.8-pro',
    ]);
  });

  await t('discovery: paginates, sends key as header (never in URL), caches per key', async () => {
    const calls = { urls: [] as string[], headers: [] as Array<string | null> };
    mockModelList([catalogue.slice(0, 6), catalogue.slice(6)], calls);
    const a = await getGeminiModelChain('KEY-A');
    assert.equal(a[0], 'gemini-3.8-flash');
    assert.ok(!a.includes('gemini-1.5-flash') && !a.includes('gemini-2.0-flash'));
    assert.ok(a.length <= 6);
    assert.equal(calls.urls.length, 2);                       // 2 pages
    assert.ok(calls.headers.every((h) => h === 'KEY-A'));
    assert.ok(calls.urls.every((u) => !u.includes('KEY-A')));
    await getGeminiModelChain('KEY-A');
    assert.equal(calls.urls.length, 2);                       // cached, no new request
    await getGeminiModelChain('KEY-B');
    assert.equal(calls.urls.length, 4);                       // different key -> own discovery
  });

  await t('discovery failure falls back to the static list (and never to retired ids)', async () => {
    const calls = { urls: [] as string[], headers: [] as Array<string | null> };
    mockModelList(403, calls);
    const chain = await getGeminiModelChain('KEY-BAD');
    assert.deepEqual(chain, FALLBACK_GEMINI_MODELS.slice(0, 6));
    assert.ok(chain.every((id) => !isRetiredModel(id)));
  });

  await t('GEMINI_MODEL override: used when valid, ignored when retired or not offered', async () => {
    const calls = { urls: [] as string[], headers: [] as Array<string | null> };
    mockModelList([catalogue], calls);
    process.env.GEMINI_MODEL = 'gemini-1.5-flash';
    assert.ok(!(await getGeminiModelChain('KEY-C')).includes('gemini-1.5-flash'));
    process.env.GEMINI_MODEL = 'gemini-3.6-flash';
    const c = await getGeminiModelChain('KEY-C');
    assert.equal(c[0], 'gemini-3.6-flash');
    assert.equal(c.filter((m) => m === 'gemini-3.6-flash').length, 1);
    process.env.GEMINI_MODEL = 'gemini-9.9-flash';
    assert.ok(!(await getGeminiModelChain('KEY-C')).includes('gemini-9.9-flash'));
    delete process.env.GEMINI_MODEL;
  });

  await t('error classification (incl. the exact production error)', () => {
    const prod = new Error('{"error":{"code":404,"message":"models/gemini-1.5-flash is not found for API version v1beta, or is not supported for generateContent.","status":"NOT_FOUND"}}');
    assert.equal(isModelUnavailableError(prod), true);
    assert.equal(isOverloadedError(new Error('503 UNAVAILABLE: high demand')), true);
    assert.equal(isModelUnavailableError(new Error('503 UNAVAILABLE: high demand')), false);
    assert.equal(isQuotaError(new Error('429 RESOURCE_EXHAUSTED')), true);
    assert.equal(isModelUnavailableError(new Error('API key not valid. Please pass a valid API key.')), false);
    assert.equal(isModelUnavailableError(new Error('403 PERMISSION_DENIED: Your API key was reported as leaked')), false);
  });

  function fakeAi(handler: (model: string) => unknown, log: string[]): GoogleGenAI {
    return { models: { generateContent: async ({ model }: { model: string }) => { log.push(model); return handler(model); } } } as unknown as GoogleGenAI;
  }
  const req = { contents: 'hi' };
  const ok = (m: string) => ({ text: `from ${m}` });

  await t('fallback: 404 on retired/unknown ids moves on and succeeds on a live model', async () => {
    const calls = { urls: [] as string[], headers: [] as Array<string | null> };
    mockModelList([catalogue], calls);
    const log: string[] = [];
    const ai = fakeAi((m) => { if (m !== 'gemini-3.5-flash-lite') throw new Error(`404 NOT_FOUND models/${m}`); return ok(m); }, log);
    const r = await generateContentWithFallback(ai, 'KEY-D', req, { retryDelayMs: 0 });
    assert.equal(r.model, 'gemini-3.5-flash-lite');
    assert.deepEqual(log.slice(0, 3), ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
  });

  await t('fallback: per-model quota (429) moves to the next model', async () => {
    const calls = { urls: [] as string[], headers: [] as Array<string | null> };
    mockModelList([catalogue], calls);
    const ai = fakeAi((m) => { if (m === 'gemini-3.8-flash') throw new Error('429 RESOURCE_EXHAUSTED'); return ok(m); }, []);
    assert.equal((await generateContentWithFallback(ai, 'KEY-D', req, { retryDelayMs: 0 })).model, 'gemini-3.6-flash');
  });

  await t('fallback: a bad API key is thrown immediately (no pointless model hopping)', async () => {
    const log: string[] = [];
    const ai = fakeAi(() => { throw new Error('400 INVALID_ARGUMENT: API key not valid'); }, log);
    await assert.rejects(generateContentWithFallback(ai, 'KEY-D', req, { retryDelayMs: 0 }), /API key not valid/);
    assert.equal(log.length, 1);
  });

  await t('fallback: 503 is retried, then flagged allOverloaded so the route can serve the offline cohort', async () => {
    const log: string[] = [];
    const ai = fakeAi(() => { throw new Error('503 UNAVAILABLE: The model is overloaded'); }, log);
    await assert.rejects(
      generateContentWithFallback(ai, 'KEY-D', req, { overloadRetries: 2, retryDelayMs: 0 }),
      (e: unknown) => e instanceof GeminiFallbackError && e.allOverloaded === true && e.triedModels.length > 1
    );
    assert.ok(log.length >= 4);
  });

  globalThis.fetch = realFetch;
  console.log(`\n${n} gemini test groups passed`);
})().catch((e) => { globalThis.fetch = realFetch; console.error(e); process.exit(1); });
