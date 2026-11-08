import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';
import {
  GeminiFallbackError,
  allowsCustomTemperature,
  generateContentWithFallback,
  thinkingConfigFor,
} from '@/lib/geminiModels';
import { downloadRatingsCsv } from '@/lib/vaultStorage';
import { createClient } from '@/utils/supabase/server';
import { fetchLetterboxdRssResult, pickLetterboxdHandle, type ParsedRSSEntry } from '@/lib/letterboxdRss';
import { selectTasteSignals } from '@/lib/tasteSignals';
import { buildEngineInput, isSeenTitle } from '@/lib/engineInput';
import { EngineOutputError, parseEngineJson, readCohorts } from '@/lib/engineJson';
import {
  ENGINE_ERROR_MESSAGES,
  ENGINE_ERROR_STATUS,
  classifyGeminiFailure,
  type EngineErrorCode,
} from '@/lib/engineErrors';
import {
  ENGINE_RESPONSE_SCHEMA,
  ENGINE_SYSTEM_PROMPT,
  MAX_FILMS_PER_COHORT,
  MAX_SEEN_TITLES_IN_PROMPT,
  buildCuratorialInstructions,
  buildUserPrompt,
} from '@/lib/enginePrompt';
import { formatFilm } from '@/lib/engineFormat';
import { getOfflineCalibratedCohorts } from '@/lib/offlineCohorts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Time budget. The platform kills a function that runs past maxDuration and the browser only sees a dropped
// connection, so the Gemini step gets whatever is left of the budget and gives up cleanly before then.
// 60s is the ceiling on Vercel's free (Hobby) plan without Fluid Compute; raise it only if your host allows more.
// ---------------------------------------------------------------------------
export const maxDuration = 60;
const FUNCTION_BUDGET_MS = maxDuration * 1000;
const RESPONSE_RESERVE_MS = 6_000; // kept free for de-duplication and sending the response
const GEMINI_ATTEMPT_TIMEOUT_MS = 40_000; // longest a single model call may take
const RSS_CAP_MS = 5_000; // the live feed is a bonus: it may never hold the engine up
const OUTPUT_TOKEN_LIMIT = 12_000; // ~24 films is about 6-7k tokens; this bounds a runaway answer
const MIN_MS_FOR_OUTPUT_RETRY = 22_000; // only retry an unreadable answer when a whole new call still fits

function fail(code: EngineErrorCode, detail?: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json(
    { error: ENGINE_ERROR_MESSAGES[code], code, ...(detail ? { detail } : {}), ...extra },
    { status: ENGINE_ERROR_STATUS[code], headers: { 'Cache-Control': 'no-store' } }
  );
}

/** Resolves with the RSS entries, or [] if the feed fails or is slower than `ms`. Never throws. */
async function fetchRssCapped(handle: string, ms: number): Promise<ParsedRSSEntry[]> {
  if (!handle) return [];
  try {
    const result = await Promise.race([
      fetchLetterboxdRssResult(handle),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
    if (!result) {
      console.warn(`[CultCrate AI] RSS for @${handle} took longer than ${ms}ms, continuing without it.`);
      return [];
    }
    if (!result.ok) {
      console.warn(`[CultCrate AI] RSS for @${handle}: ${result.error}`);
      return [];
    }
    return result.entries;
  } catch (err: unknown) {
    console.warn('[CultCrate AI] RSS fetch notice:', err);
    return [];
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const timings: Record<string, number> = {};
  const lap = (name: string, since: number): number => {
    const now = Date.now();
    timings[name] = now - since;
    return now;
  };

  try {
    // -------------------------------------------------------------
    // 1. AUTHENTICATE
    // -------------------------------------------------------------
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || null;
    const supabase = await createClient(bearerToken);

    const {
      data: { user },
      error: userAuthError,
    } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser();

    if (userAuthError || !user) return fail('unauthorized');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) console.warn('[CultCrate AI] profiles query notice:', profileError.message);

    const userApiKey = typeof profile?.gemini_api_key === 'string' ? profile.gemini_api_key.trim() : '';
    if (!userApiKey) return fail('no_api_key');

    // -------------------------------------------------------------
    // 2. READ REQUEST
    // -------------------------------------------------------------
    const body: Record<string, unknown> = await req.json().catch(() => ({}));
    const obscurityLevel = Number.isFinite(Number(body.obscurityLevel)) ? Number(body.obscurityLevel) : 4;
    const letterboxdHandle = pickLetterboxdHandle(
      body.username,
      profile?.letterboxd_username,
      user.user_metadata?.letterboxd_username
    );
    const username = letterboxdHandle || 'cinephile';

    // -------------------------------------------------------------
    // 3. LOAD HISTORY: stored ratings.csv and the live RSS feed IN PARALLEL
    // -------------------------------------------------------------
    let t = Date.now();
    const [csvResult, rssEntries] = await Promise.all([
      downloadRatingsCsv(supabase, user.id),
      fetchRssCapped(letterboxdHandle, RSS_CAP_MS),
    ]);
    t = lap('load', t);

    let csvText = '';
    if (csvResult.status === 'found') csvText = csvResult.text;
    else if (csvResult.status === 'error') console.warn(`[CultCrate AI] ratings.csv download failed: ${csvResult.message}`);

    if (!csvText.trim()) {
      // Fallbacks for accounts that have no stored file yet (RSS only covers recent films)
      if (typeof body.rawCsv === 'string' && body.rawCsv.trim()) csvText = body.rawCsv;
    }

    // -------------------------------------------------------------
    // 4. BUILD THE ENGINE INPUT (one parser, shared with the sync route)
    // -------------------------------------------------------------
    const input = buildEngineInput(csvText, rssEntries);
    if (input.watchedCount === 0) return fail('no_ratings');

    const selected = selectTasteSignals(input.signals);
    if (selected.count === 0) return fail('few_ratings');

    // Films the model cannot see in the CSV above are listed by name so it avoids them up front.
    // (The server-side filter further down is still the hard guarantee.)
    const signalTitles = new Set(selected.kept.map((s) => s.name.toLowerCase()));
    const otherSeen = input.watchedTitles.filter((title) => !signalTitles.has(title.toLowerCase()));
    const seenForPrompt = otherSeen.slice(-MAX_SEEN_TITLES_IN_PROMPT); // most recently watched are the likeliest repeats

    const blacklisted = asStringArray(body.blacklisted_entities);
    const thresholdLabel = selected.threshold.toFixed(1);

    console.log(
      `[CultCrate AI] @${username}: ${input.csvRows} CSV rows + ${input.rssRows} RSS entries = ${input.watchedCount} unique films. ` +
        `Sending ${selected.count} of ${selected.totalCandidates} signals rated ${thresholdLabel}+ and ${seenForPrompt.length} seen titles.`
    );

    const userPrompt = buildUserPrompt({
      signalsCsv: selected.payload,
      signalCount: selected.count,
      thresholdLabel,
      username,
      curation: buildCuratorialInstructions({
        obscurityLevel,
        familyFriendlyStrict: body.family_friendly_strict === true,
        countryFilter: asText(body.country_filter),
        moodGenreBias: asText(body.mood_genre_bias),
        eraPreference: asText(body.era_preference),
        runtimeConstraint: asText(body.runtime_constraint),
        blacklistedEntities: blacklisted,
        preferences: asStringArray(body.preferences),
      }),
      seenTitles: seenForPrompt,
      seenTotal: input.watchedCount,
    });
    t = lap('prepare', t);

    // -------------------------------------------------------------
    // 5. CALL GEMINI (auto-discovered model chain, minimal thinking, hard output cap)
    // -------------------------------------------------------------
    const ai = new GoogleGenAI({ apiKey: userApiKey });

    const requestFor = (model: string, { compat }: { compat: boolean }) => ({
      contents: [userPrompt],
      config: {
        systemInstruction: ENGINE_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: ENGINE_RESPONSE_SCHEMA,
        maxOutputTokens: OUTPUT_TOKEN_LIMIT,
        ...(allowsCustomTemperature(model) ? { temperature: 0.35 } : {}),
        ...(compat ? {} : { thinkingConfig: thinkingConfigFor(model) }),
      },
    });

    const callGemini = async (): Promise<{ response: GenerateContentResponse; model: string }> => {
      const deadlineMs = Math.max(0, FUNCTION_BUDGET_MS - RESPONSE_RESERVE_MS - (Date.now() - startedAt));
      return generateContentWithFallback(ai, userApiKey, requestFor, {
        deadlineMs,
        attemptTimeoutMs: GEMINI_ATTEMPT_TIMEOUT_MS,
      });
    };

    let activeModel = '';
    let highDemandFallback = false;
    let parsed: ReturnType<typeof readCohorts> | null = null;
    let repairedOutput = false;
    let finishReason = '';

    for (let attempt = 1; attempt <= 2 && !parsed && !highDemandFallback; attempt++) {
      let result: { response: GenerateContentResponse; model: string };
      try {
        result = await callGemini();
      } catch (genErr: unknown) {
        if (genErr instanceof GeminiFallbackError) {
          if (genErr.timedOut) {
            console.warn(`[CultCrate AI] Gemini timed out after ${Math.round((Date.now() - startedAt) / 1000)}s (tried: ${genErr.triedModels.join(', ')}).`);
            return fail('timeout', undefined, { timings });
          }
          if (genErr.allOverloaded) {
            highDemandFallback = true;
            break;
          }
          console.error('[CultCrate AI] every Gemini model failed:', genErr.message);
          return fail(classifyGeminiFailure(genErr.lastError ?? genErr), genErr.message.slice(0, 300));
        }
        console.error('[CultCrate AI] Gemini request failed:', genErr);
        return fail(classifyGeminiFailure(genErr), genErr instanceof Error ? genErr.message.slice(0, 300) : undefined);
      }

      activeModel = result.model;
      finishReason = String(result.response.candidates?.[0]?.finishReason ?? '');
      try {
        const out = parseEngineJson(result.response.text ?? '');
        const cohorts = readCohorts(out.data);
        if (cohorts.masterpiece.length + cohorts.excellent.length === 0) {
          throw new EngineOutputError('The AI answered without any films.');
        }
        parsed = cohorts;
        repairedOutput = out.repaired;
        if (out.repaired) console.warn(`[CultCrate AI] Answer was cut off (${finishReason}); kept the complete films.`);
      } catch (parseErr: unknown) {
        const left = FUNCTION_BUDGET_MS - RESPONSE_RESERVE_MS - (Date.now() - startedAt);
        console.warn(
          `[CultCrate AI] Unreadable answer from '${activeModel}' (finishReason=${finishReason || 'n/a'}, attempt ${attempt}): ${
            parseErr instanceof Error ? parseErr.message : parseErr
          }`
        );
        if (attempt === 2 || left < MIN_MS_FOR_OUTPUT_RETRY) {
          return fail('bad_ai_output', `finishReason=${finishReason || 'n/a'}`, { model: activeModel });
        }
      }
    }
    t = lap('gemini', t);

    // -------------------------------------------------------------
    // 6. DROP ALREADY SEEN FILMS (hard guarantee) AND FORMAT
    // -------------------------------------------------------------
    const unseen = <T extends Record<string, unknown>>(films: T[]): T[] =>
      films.filter((film) => !isSeenTitle(String(film.title ?? ''), input.watchedKeys));

    if (highDemandFallback) {
      console.warn('[CultCrate AI] Returning offline calibrated vault cohorts due to high demand.');
      const offline = getOfflineCalibratedCohorts();
      const masterpiece = unseen(offline.masterpiece_cohort).map((f, i) => formatFilm(f, i, true, obscurityLevel));
      const excellent = unseen(offline.excellent_cohort).map((f, i) => formatFilm(f, i, false, obscurityLevel));
      return NextResponse.json({
        status: 'success',
        source: 'offline_calibrated_vault',
        model: 'offline_vault_archive',
        taste_profile_summary: offline.taste_profile_summary,
        tasteProfileSummary: offline.taste_profile_summary,
        masterpiece_cohort: masterpiece,
        masterpieceCohort: masterpiece,
        excellent_cohort: excellent,
        excellentCohort: excellent,
        watchedDeduplicationCount: input.watchedCount,
        rssSyncedEntriesCount: rssEntries.length,
      });
    }

    if (!parsed) return fail('bad_ai_output');

    const rawCount = parsed.masterpiece.length + parsed.excellent.length;
    const masterpiece = unseen(parsed.masterpiece)
      .slice(0, MAX_FILMS_PER_COHORT)
      .map((f, i) => formatFilm(f, i, true, obscurityLevel));
    const excellent = unseen(parsed.excellent)
      .slice(0, MAX_FILMS_PER_COHORT)
      .map((f, i) => formatFilm(f, i, false, obscurityLevel));
    const removed = rawCount - masterpiece.length - excellent.length;
    if (removed > 0) console.log(`[CultCrate AI] Deduplication removed ${removed} already watched film(s).`);
    lap('finish', t);
    timings.total = Date.now() - startedAt;
    console.log(`[CultCrate AI] done in ${timings.total}ms ${JSON.stringify(timings)} model=${activeModel}`);

    return NextResponse.json({
      status: 'success',
      model: activeModel,
      taste_profile_summary: parsed.summary,
      tasteProfileSummary: parsed.summary,
      masterpiece_cohort: masterpiece,
      masterpieceCohort: masterpiece,
      excellent_cohort: excellent,
      excellentCohort: excellent,
      // One number per FILM. (This used to be the size of a key set holding 2+ keys per film, so it read ~1.7x too high.)
      watchedDeduplicationCount: input.watchedCount,
      rssSyncedEntriesCount: rssEntries.length,
      engineMeta: {
        signalsSent: selected.count,
        signalThreshold: selected.threshold,
        signalsTrimmed: selected.trimmed,
        seenTitlesSent: seenForPrompt.length,
        outputRepaired: repairedOutput,
        removedAsSeen: removed,
        timings,
        elapsedMs: timings.total,
      },
    });
  } catch (err: unknown) {
    console.error('Unhandled failure in /api/recommendations:', err);
    return fail('internal', err instanceof Error ? err.message.slice(0, 300) : undefined);
  }
}
