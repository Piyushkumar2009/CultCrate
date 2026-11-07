/**
 * Gemini model selection: AUTO-DISCOVERY with graceful fallback.
 *
 * Why this exists: Google retires model ids every few months (gemini-1.5-* shut down in
 * Sept 2025, gemini-2.0-* in June 2026, gemini-2.5-* is being rerouted from Dec 2026), and any
 * hardcoded id eventually answers "404 models/... is not found for API version v1beta".
 *
 * Strategy (server-side only):
 *  1. Ask the Gemini API what THIS key can use right now (models.list, filtered to models that
 *     support generateContent), drop retired / non-text / specialised models, and rank the rest
 *     (stable before preview, newest generation first, flash before flash-lite before pro).
 *  2. Cache that answer per API key (hashed, never stored raw) for one hour.
 *  3. Call generateContent through the ranked chain: a model that is retired, renamed, quota
 *     exhausted or overloaded simply hands over to the next one.
 *  4. If discovery itself fails (network, bad key) fall back to a small static list.
 *
 * Optional override without a redeploy: set GEMINI_MODEL (tried first if it is still valid).
 */
import { createHash } from 'node:crypto';
import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from '@google/genai';

const MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DISCOVERY_TIMEOUT_MS = 8_000;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
const DISCOVERY_FAILURE_TTL_MS = 60 * 1000;
const MAX_DISCOVERY_PAGES = 5;
const MAX_CHAIN_LENGTH = 6;
/** Stop hopping after this many overloaded models: the whole service is busy, more tries only add latency. */
const MAX_OVERLOADED_MODELS = 3;

/** Last-resort list, used ONLY when models.list cannot be reached. Order = preference. */
export const FALLBACK_GEMINI_MODELS: readonly string[] = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

/** Retired generations. Never sent to the API, even if someone sets GEMINI_MODEL to one. */
export function isRetiredModel(id: string): boolean {
  return /^gemini-(1\.\d+|2\.0)(-|$)/.test(id) || id === 'gemini-pro' || id === 'gemini-pro-vision';
}

/** Specialised / non-chat families that can never answer a JSON text prompt. */
const NON_TEXT_FAMILY =
  /(embedding|tts|image|live|audio|transcribe|translate|robotics|omni|computer-use|native|veo|imagen|aqa|learnlm|deep-research|customtools|thinking-exp|-exp(\b|-))/i;

/* -------------------------------------------------------------------------- */
/*  Ranking                                                                   */
/* -------------------------------------------------------------------------- */

interface RankedModel {
  id: string;
  tier: number; // 0 = flash / flash-lite, 1 = pro, 2 = other
  subtier: number; // 0 = flash, 1 = flash-lite
  preview: boolean;
  major: number;
  minor: number;
}

function rankModel(id: string): RankedModel {
  const m = id.match(/^gemini-(\d+)(?:\.(\d+))?-(.+)$/);
  const rest = m ? m[3] : id.replace(/^gemini-/, '');
  const isLite = /flash-lite/.test(rest);
  const isFlash = /flash/.test(rest);
  const isPro = /(^|-)pro(-|$)/.test(rest);
  return {
    id,
    tier: isFlash ? 0 : isPro ? 1 : 2,
    subtier: isLite ? 1 : 0,
    preview: /preview|-exp/.test(id),
    // Aliases such as gemini-flash-latest have no version: rank them after every versioned id
    major: m ? Number(m[1]) : -1,
    minor: m && m[2] ? Number(m[2]) : 0,
  };
}

function compareRanked(a: RankedModel, b: RankedModel): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.preview !== b.preview) return a.preview ? 1 : -1; // stable before preview
  if (a.major !== b.major) return b.major - a.major; // newest generation first
  if (a.minor !== b.minor) return b.minor - a.minor;
  if (a.subtier !== b.subtier) return a.subtier - b.subtier;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Filters raw ListModels output to usable text models and ranks them. Pure and unit-testable. */
export function rankDiscoveredModels(
  entries: ReadonlyArray<{ name: string; methods: ReadonlyArray<string> }>
): string[] {
  const ids = new Set<string>();
  for (const { name, methods } of entries) {
    const id = name.replace(/^models\//, '');
    if (!id.startsWith('gemini-')) continue;
    if (!methods.includes('generateContent')) continue;
    if (isRetiredModel(id) || NON_TEXT_FAMILY.test(id)) continue;
    ids.add(id);
  }
  return Array.from(ids).map(rankModel).sort(compareRanked).map((r) => r.id);
}

/* -------------------------------------------------------------------------- */
/*  Discovery (cached per key, never throws)                                  */
/* -------------------------------------------------------------------------- */

interface CacheEntry {
  models: string[];
  expires: number;
}

const discoveryCache = new Map<string, CacheEntry>();
const discoveryInFlight = new Map<string, Promise<string[]>>();

function cacheKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function fetchModelList(apiKey: string): Promise<string[]> {
  const entries: Array<{ name: string; methods: string[] }> = [];
  let pageToken = '';

  for (let page = 0; page < MAX_DISCOVERY_PAGES; page++) {
    const url = `${MODELS_ENDPOINT}?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, {
      headers: { 'x-goog-api-key': apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`models.list returned HTTP ${res.status}`);

    const payload: unknown = await res.json();
    if (!isRecord(payload)) throw new Error('models.list returned an unreadable payload');

    const models = Array.isArray(payload.models) ? payload.models : [];
    for (const item of models) {
      if (!isRecord(item) || typeof item.name !== 'string') continue;
      const methods = Array.isArray(item.supportedGenerationMethods)
        ? item.supportedGenerationMethods.filter((x): x is string => typeof x === 'string')
        : [];
      entries.push({ name: item.name, methods });
    }

    pageToken = typeof payload.nextPageToken === 'string' ? payload.nextPageToken : '';
    if (!pageToken) break;
  }

  return rankDiscoveredModels(entries);
}

/**
 * Returns the ranked list of models this API key can currently call, or [] when discovery fails
 * (the failure is cached briefly so a broken network does not add latency to every request).
 */
export async function discoverGeminiModels(apiKey: string, options?: { force?: boolean }): Promise<string[]> {
  const key = cacheKey(apiKey);
  const now = Date.now();

  const cached = discoveryCache.get(key);
  if (!options?.force && cached && cached.expires > now) return cached.models;

  const pending = discoveryInFlight.get(key);
  if (pending) return pending;

  const run = (async (): Promise<string[]> => {
    try {
      const models = await fetchModelList(apiKey);
      discoveryCache.set(key, { models, expires: Date.now() + (models.length > 0 ? DISCOVERY_TTL_MS : DISCOVERY_FAILURE_TTL_MS) });
      return models;
    } catch (err: unknown) {
      // Never log the key; the message only carries an HTTP status or a network reason
      console.warn('[Gemini] model discovery failed, using static fallback list:', err instanceof Error ? err.message : err);
      discoveryCache.set(key, { models: [], expires: Date.now() + DISCOVERY_FAILURE_TTL_MS });
      return [];
    } finally {
      discoveryInFlight.delete(key);
    }
  })();

  discoveryInFlight.set(key, run);
  return run;
}

/** Drops the cached discovery result so the next call re-lists models (e.g. after a 404). */
export function invalidateGeminiModelCache(apiKey: string): void {
  discoveryCache.delete(cacheKey(apiKey));
}

/**
 * Ordered, de-duplicated models to try: valid GEMINI_MODEL override first, then the discovered
 * list (or the static fallback when discovery produced nothing), capped at MAX_CHAIN_LENGTH.
 */
export async function getGeminiModelChain(apiKey?: string): Promise<string[]> {
  const discovered = apiKey ? await discoverGeminiModels(apiKey) : [];
  const base = discovered.length > 0 ? discovered : [...FALLBACK_GEMINI_MODELS];

  const chain: string[] = [];
  const override = (process.env.GEMINI_MODEL ?? '').trim().replace(/^models\//, '');
  if (override) {
    if (isRetiredModel(override)) {
      console.warn(`[Gemini] GEMINI_MODEL='${override}' is retired and was ignored.`);
    } else if (discovered.length > 0 && !discovered.includes(override)) {
      console.warn(`[Gemini] GEMINI_MODEL='${override}' is not offered to this key and was ignored.`);
    } else {
      chain.push(override);
    }
  }

  for (const id of base) {
    if (!isRetiredModel(id) && !chain.includes(id)) chain.push(id);
  }
  return chain.slice(0, MAX_CHAIN_LENGTH);
}

/* -------------------------------------------------------------------------- */
/*  Error classification                                                      */
/* -------------------------------------------------------------------------- */

function errorMessageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  return String(err);
}

function errorStatusOf(err: unknown): number | null {
  if (!isRecord(err)) return null;
  const raw = err.status ?? err.statusCode ?? err.code;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** "This model id cannot be used with this key": retired, renamed, unsupported or no access. */
export function isModelUnavailableError(err: unknown): boolean {
  const message = errorMessageOf(err);
  const status = errorStatusOf(err);
  return (
    status === 404 ||
    /\b404\b/.test(message) ||
    /NOT_FOUND/.test(message) ||
    /models\/[\w.-]+ is not (found|supported)/i.test(message) ||
    /is not supported for generateContent|no longer available|has been (shut ?down|retired|deprecated)|is not available/i.test(message) ||
    ((status === 403 || /PERMISSION_DENIED|\b403\b/.test(message)) && /model/i.test(message))
  );
}

/** Per-model quota (free-tier limits are per model), so another model may still have headroom. */
export function isQuotaError(err: unknown): boolean {
  const message = errorMessageOf(err);
  return errorStatusOf(err) === 429 || /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(message);
}

/** Temporary capacity problem (503 / "high demand"): worth a short retry. */
export function isOverloadedError(err: unknown): boolean {
  const message = errorMessageOf(err);
  return (
    errorStatusOf(err) === 503 ||
    /\b503\b|UNAVAILABLE|Service Unavailable|overloaded|high demand/i.test(message)
  );
}

/* -------------------------------------------------------------------------- */
/*  generateContent with automatic model fallback                             */
/* -------------------------------------------------------------------------- */

export class GeminiFallbackError extends Error {
  readonly lastError: unknown;
  readonly triedModels: string[];
  /** true when at least one model failed because of overload (503), so callers can serve an offline cohort */
  readonly allOverloaded: boolean;

  constructor(message: string, lastError: unknown, triedModels: string[], allOverloaded: boolean) {
    super(message);
    this.name = 'GeminiFallbackError';
    this.lastError = lastError;
    this.triedModels = triedModels;
    this.allOverloaded = allOverloaded;
  }
}

export interface GeminiFallbackOptions {
  /** Attempts per model for 503 overloads (default 3) */
  overloadRetries?: number;
  retryDelayMs?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls ai.models.generateContent through the discovered chain.
 *  - model retired / unsupported / quota exhausted  -> next model
 *  - overloaded (503)                               -> short retry, then next model
 *  - anything else (bad key, bad request)           -> thrown immediately, other models cannot fix it
 * When every model fails a GeminiFallbackError is thrown.
 */
export async function generateContentWithFallback(
  ai: GoogleGenAI,
  apiKey: string,
  request: Omit<GenerateContentParameters, 'model'>,
  options: GeminiFallbackOptions = {}
): Promise<{ response: GenerateContentResponse; model: string; triedModels: string[] }> {
  const retries = Math.max(1, options.overloadRetries ?? 3);
  const retryDelayMs = options.retryDelayMs ?? 1500;

  let chain = await getGeminiModelChain(apiKey);
  const triedModels: string[] = [];
  let lastError: unknown = null;
  let sawOverload = false;
  let overloadedModels = 0;
  let rediscovered = false;

  for (let i = 0; i < chain.length && overloadedModels < MAX_OVERLOADED_MODELS; i++) {
    const model = chain[i];
    triedModels.push(model);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await ai.models.generateContent({ ...request, model });
        return { response, model, triedModels };
      } catch (err: unknown) {
        lastError = err;

        if (isOverloadedError(err)) {
          sawOverload = true;
          console.warn(`[Gemini] '${model}' overloaded (attempt ${attempt}/${retries}).`);
          if (attempt < retries) {
            await sleep(retryDelayMs);
            continue;
          }
          overloadedModels++;
          break; // give up on this model, try the next one
        }

        if (isModelUnavailableError(err) || isQuotaError(err)) {
          console.warn(`[Gemini] '${model}' unavailable for this key, trying next: ${errorMessageOf(err).slice(0, 160)}`);
          // The cached list may be stale (model retired mid-cache): refresh once and re-plan
          if (!rediscovered && isModelUnavailableError(err)) {
            rediscovered = true;
            invalidateGeminiModelCache(apiKey);
            const fresh = (await getGeminiModelChain(apiKey)).filter((id) => !triedModels.includes(id));
            chain = [...chain.slice(0, i + 1), ...fresh].slice(0, MAX_CHAIN_LENGTH + 2);
          }
          break;
        }

        throw err; // genuine request/key problem
      }
    }
  }

  throw new GeminiFallbackError(
    `No Gemini model produced a response (tried: ${triedModels.join(', ') || 'none'}). Last error: ${errorMessageOf(lastError).slice(0, 300)}`,
    lastError,
    triedModels,
    sawOverload
  );
}
