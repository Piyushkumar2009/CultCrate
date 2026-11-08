/**
 * End-to-end test of POST /api/recommendations with a LARGE account (874 films).
 * Only the outside world is faked: Supabase (auth, profile row, Storage download) and the HTTP endpoints of Google
 * and Letterboxd. The route handler and every lib module it uses run for real.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import Module from 'node:module';

const root = path.resolve(__dirname, '..');

/* ----------------------------- fake Supabase ----------------------------- */

function buildLargeCsv(n: number): string {
  const rows = ['Date,Name,Year,Letterboxd URI,Rating'];
  const ratings = ['0.5', '2', '3', '3.5', '4', '4.5', '5', '4', '', '2.5'];
  for (let i = 0; i < n; i++) {
    const title =
      i === 3 ? '"Hail, Caesar!"' : i === 5 ? '"The ""Quoted"" One"' : i === 7 ? 'Amélie' : i === 9 ? 'The Thing' : `Film Number ${i}`;
    const releaseYear = 1940 + (i % 80);
    rows.push(`2023-0${1 + (i % 9)}-1${i % 9},${title},${releaseYear},https://boxd.it/${i},${ratings[i % ratings.length]}`);
  }
  return rows.join('\n');
}

const BIG_CSV = buildLargeCsv(874);

const fakeSupabase = {
  auth: {
    getUser: async () => ({ data: { user: { id: 'user-1', user_metadata: {} } }, error: null }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { gemini_api_key: 'FAKE-KEY', letterboxd_username: 'bigaccount' },
          error: null,
        }),
      }),
    }),
  }),
  storage: {
    from: () => ({
      download: async () => ({ data: new Blob([BIG_CSV], { type: 'text/csv' }), error: null }),
    }),
  },
};

// The route imports '@/utils/supabase/server'; put the fake in the module cache under that file's real path.
const serverModulePath = path.join(root, 'utils/supabase/server.ts');
const cache = (Module as unknown as { _cache: Record<string, unknown> })._cache;
cache[serverModulePath] = {
  id: serverModulePath,
  filename: serverModulePath,
  loaded: true,
  exports: { createClient: async () => fakeSupabase },
};

/* ------------------------- fake Google / Letterboxd ------------------------ */

const realFetch = globalThis.fetch;
type GenBody = {
  contents: unknown;
  systemInstruction?: unknown;
  generationConfig?: { temperature?: number; maxOutputTokens?: number; thinkingConfig?: Record<string, unknown> };
};
const generateCalls: Array<{ model: string; body: GenBody }> = [];
let generateHandler: (model: string, body: GenBody, call: number) => Response = () => new Response('{}', { status: 500 });

const modelCatalogue = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'].map((m) => ({
  name: `models/${m}`,
  supportedGenerationMethods: ['generateContent'],
}));

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes('letterboxd.com')) return new Response('nope', { status: 404 });
  if (/\/v1beta\/models\?/.test(url)) return new Response(JSON.stringify({ models: modelCatalogue }), { status: 200 });
  const m = url.match(/\/models\/([^/:]+):generateContent/);
  if (m) {
    const body = JSON.parse(String(init?.body ?? '{}')) as GenBody;
    generateCalls.push({ model: m[1], body });
    return generateHandler(m[1], body, generateCalls.length);
  }
  return realFetch(input, init);
}) as typeof fetch;

function film(title: string, year: number, tier: 'Masterpiece' | 'Excellent') {
  return {
    title,
    year,
    genre: ['Drama'],
    country: 'France',
    runtime_mins: 110,
    imdb_rating: 7.9,
    content_advisory: 'Mature themes',
    where_to_watch_india: 'MUBI India, Prime Video India',
    audio_availability: 'Original',
    spoiler_free_premise: 'A premise.',
    thematic_alignment: 'Aligned.',
    scale_projection: tier,
    director: 'Someone',
  };
}

const answer = (obj: unknown, finishReason = 'STOP') =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] }, finishReason }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const goodPayload = {
  taste_profile_summary: 'You like slow, bleak cinema.',
  masterpiece_cohort: [
    film('Cure', 1997, 'Masterpiece'),
    film('Film Number 12', 1952, 'Masterpiece'), // already watched -> must be removed
    film('Thing', 1982, 'Masterpiece'), // "The Thing" is watched -> must be removed (leading article)
    film('Amelie', 2001, 'Masterpiece'), // "Amélie" is watched -> must be removed (accent)
  ],
  excellent_cohort: [film('Stalker', 1979, 'Excellent'), film('Possession', 1981, 'Excellent')],
};

/* --------------------------------- tests ---------------------------------- */

let n = 0;
const t = async (name: string, fn: () => Promise<void>) => {
  generateCalls.length = 0;
  await fn();
  n++;
  console.log('ok -', name);
};

async function run(extraBody: Record<string, unknown> = {}) {
  const { NextRequest } = await import('next/server');
  const { POST } = await import('../app/api/recommendations/route');
  const req = new NextRequest('http://localhost/api/recommendations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
    body: JSON.stringify({ username: 'bigaccount', obscurityLevel: 4, preferences: ['Mind-Bending'], blacklisted_entities: [], ...extraBody }),
  });
  const res = await POST(req);
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

(async () => {
  await t('874 film account succeeds, sends a small prompt and minimal thinking', async () => {
    generateHandler = () => answer(goodPayload);
    const started = Date.now();
    const { status, json } = await run();
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(Date.now() - started < 5_000, 'route logic itself must be fast at this scale');

    const call = generateCalls[0];
    assert.equal(call.model, 'gemini-3.8-flash');
    const cfg = call.body.generationConfig ?? {};
    const thinking = cfg.thinkingConfig ?? {};
    assert.equal(String(thinking.thinkingLevel).toLowerCase(), 'low', 'thinking must be kept low');
    assert.equal(cfg.temperature, undefined, 'gemini-3 keeps its default temperature');
    assert.equal(cfg.maxOutputTokens, 12_000);

    const prompt = JSON.stringify(call.body.contents);
    assert.ok(prompt.length < 40_000, `prompt is ${prompt.length} chars`);
    // Release year (1940 + i % 80), not the logged year (2023)
    assert.ok(!/,2023,\d\.\d/.test(prompt), 'signals must carry the release year, never the log date');
    assert.ok(prompt.includes('ALREADY SEEN'), 'seen titles are listed for the model');

    // Hard dedupe: 3 of the 4 masterpiece picks were already watched
    const m = json.masterpiece_cohort as Array<{ title: string }>;
    assert.deepEqual(m.map((f) => f.title), ['Cure']);
    assert.equal((json.excellent_cohort as unknown[]).length, 2);
    // One number per film, not the size of the key set
    assert.equal(json.watchedDeduplicationCount, 874);
  });

  await t('a thinking-capable model that rejects the thinking setting is retried without it', async () => {
    generateHandler = (_m, body, call) =>
      call === 1
        ? new Response(JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Thinking level is not supported for this model.' } }), { status: 400 })
        : answer(goodPayload);
    const { status } = await run();
    assert.equal(status, 200);
    assert.equal(generateCalls.length, 2);
    assert.equal(generateCalls[0].model, generateCalls[1].model, 'same model, not a model hop');
    assert.equal(generateCalls[1].body.generationConfig?.thinkingConfig, undefined);
  });

  await t('an answer cut off mid-JSON (MAX_TOKENS) still yields the complete films', async () => {
    const full = JSON.stringify(goodPayload);
    const cut = full.slice(0, full.indexOf('"Possession"') - 20); // ends inside the excellent cohort
    generateHandler = () => answer(cut, 'MAX_TOKENS');
    const { status, json } = await run();
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal((json.engineMeta as { outputRepaired: boolean }).outputRepaired, true);
    assert.deepEqual((json.masterpiece_cohort as Array<{ title: string }>).map((f) => f.title), ['Cure']);
  });

  await t('unreadable output is retried once, then reported with its own message', async () => {
    generateHandler = () => answer('I am sorry, I cannot do that.');
    const { status, json } = await run();
    assert.equal(status, 502);
    assert.equal(json.code, 'bad_ai_output');
    assert.match(String(json.error), /unreadable answer/i);
    assert.equal(generateCalls.length, 2);
  });

  await t('free-tier quota exhaustion on every model gets the quota message (not a generic one)', async () => {
    generateHandler = () =>
      new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'You exceeded your current quota' } }), { status: 429 });
    const { status, json } = await run();
    assert.equal(status, 429);
    assert.equal(json.code, 'quota');
    assert.match(String(json.error), /free Gemini quota/i);
  });

  await t('an invalid API key is reported as such immediately', async () => {
    generateHandler = () =>
      new Response(JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } }), { status: 400 });
    const { status, json } = await run();
    assert.equal(status, 400);
    assert.equal(json.code, 'invalid_api_key');
    assert.equal(generateCalls.length, 1);
  });

  globalThis.fetch = realFetch;
  console.log(`\n${n} engine route tests passed`);
  process.exit(0);
})().catch((e) => {
  globalThis.fetch = realFetch;
  console.error(e);
  process.exit(1);
});
