import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';
import { generateContentWithFallback, GeminiFallbackError } from '@/lib/geminiModels';
import { downloadRatingsCsv } from '@/lib/vaultStorage';
import { createClient } from '@/utils/supabase/server';
import { fetchLetterboxdRSSFeed, ParsedRSSEntry, pickLetterboxdHandle } from '@/lib/letterboxdRss';

/**
 * Strict System Instruction for Gemini
 * Mandate: Analyze highly rated films (3.5-5.0 stars), recommend NEW movies, never recommend films from the watchlist.
 */
const Cinema_Engine_Prompt_2 = `You are CultCrate's Cinephile AI. Analyze the user's highly rated films (3.5-5.0 stars). Recommend NEW movies they have NOT seen. DO NOT recommend any film present in their watchlist.

[SYSTEM_ROLE]
You are an elite, highly sophisticated cinematic data scientist and expert underground film recommendation engine for CultCrate. Your task is to ingest, analyze, and profile the user's personal Letterboxd viewing history provided in the CSV dataset. Based strictly on historical taste, data patterns, calibrated rating scale, and curatorial parameters, generate a hyper-targeted, curated list of movie recommendations that the user has NOT yet watched.

[CALIBRATED_RATING_SCALE]
- 3.5 Stars: A genuinely good film that stands out and indicates reliable genre/director resonance.
- 4.0 Stars: An excellent, highly impressive film representing a clear positive taste signal.
- 4.5 to 5.0 Stars: An absolute masterpiece of cinema representing the user's core aesthetic DNA.
- Note: The input dataset has been strictly pre-filtered to ONLY contain films with ratings between 3.5 and 5.0 stars. Every film in the dataset represents a proven positive taste signal.

[ADVANCED_QUALITY_CONTROL_AND_ANTIBIAS]
- Do NOT solely filter by high IMDb scores (e.g., 7.5+). Actively look for "Polarizing Cult Classics" and "Underrated Masterpieces" that may have a lower or average IMDb score (between 6.5 and 7.3) due to general audience confusion, micro-budgets, or highly complex, mind-bending narrative choices, but are universally praised by deep cinephiles.
- Prioritize high-quality, high-concept cinema and cross-reference obscure gems rather than listing obvious global blockbusters.
- Analyze the underlying Crew DNA in 4.0–5.0 star entries, identifying recurring Screenwriters, Cinematographers, and Editors to map subconscious technical preferences.

[ANALYSIS_PROTOCOL]
1. Data Ingestion: Ingest the provided high-taste watchlist (3.5 to 5.0 stars). Extract movie titles, release years, and user ratings.
2. Positive Signal Extraction: Isolate all entries rated 4.0 to 5.0 stars. Analyze these for dominant themes, pacing styles, eras, and technical crew signatures.
3. Secondary Signal Extraction: Analyze the 3.5-star films to look for micro-trends or specific elements consistently appreciated.
4. Filter Application: Layer the conditional filters based on parameters passed in the request (such as family_friendly_strict, country_filter, mood_genre_bias, era_preference, blacklisted_entities, and runtime_constraint).
5. Strict Deduplication: Ensure absolutely zero movies already present in the user's CSV data are included in your recommendations. Recommend strictly NEW discoveries.

[STRICT_OUTPUT_JSON_SCHEMA]
You must respond ONLY with a valid JSON object matching the following structure without any extra conversational markdown outside the JSON block:

{
  "taste_profile_summary": "string (A brief 2-sentence breakdown of what the data says about the cinematic DNA)",
  "masterpiece_cohort": [
    {
      "title": "string",
      "year": number,
      "genre": "string[]",
      "country": "string",
      "runtime_mins": number,
      "imdb_rating": number,
      "content_advisory": "string",
      "where_to_watch_india": "string",
      "audio_availability": "string",
      "spoiler_free_premise": "string (2-3 sentences)",
      "thematic_alignment": "string",
      "scale_projection": "Masterpiece",
      "director": "string"
    }
  ],
  "excellent_cohort": [
    {
      "title": "string",
      "year": number,
      "genre": "string[]",
      "country": "string",
      "runtime_mins": number,
      "imdb_rating": number,
      "content_advisory": "string",
      "where_to_watch_india": "string",
      "audio_availability": "string",
      "spoiler_free_premise": "string (2-3 sentences)",
      "thematic_alignment": "string",
      "scale_projection": "Excellent",
      "director": "string"
    }
  ]
}`;


// Helper: Check if an error indicates 503 / Service Unavailable / High Demand / Overloaded
function isServiceUnavailableOrOverloaded(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || err);
  const status = err?.status || err?.statusCode || (err as any)?.response?.status;
  return (
    status === 503 ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('Service Unavailable') ||
    msg.includes('The model is overloaded') ||
    msg.includes('overloaded') ||
    msg.includes('high demand')
  );
}

// Helper: Asynchronous delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes title string for robust deduplication and comparison
 * Removes punctuation, quotes, articles, extra spaces and converts to lowercase.
 */
function normalizeTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle
    .toLowerCase()
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/[\u2018\u2019\u201C\u201D"']/g, '')
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[.,:;!?'"()\[\]{}_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses rating from string (handles decimals, integers, and Letterboxd star notations)
 */
function parseRatingValue(val: string): number | null {
  if (!val) return null;
  const clean = val.replace(/^"|"$/g, '').trim();
  if (!clean) return null;

  // Check Unicode star notation (e.g. ★★★★½ -> 4.5)
  if (clean.includes('★') || clean.includes('½')) {
    const full = (clean.match(/★/g) || []).length;
    const half = (clean.match(/½/g) || []).length;
    return full + half * 0.5;
  }

  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

export interface WatchlistAnalysisData {
  watchedTitlesSet: Set<string>;
  allWatchedTitles: string[];
  filteredPayload: string;
  filteredCount: number;
  totalParsedRows: number;
}

/**
 * 1. Extracts ALL movie titles from the CSV into a normalized `watchedTitlesSet` for deduplication.
 * 2. Filters rows so that ONLY movies with a rating between 3.5 and 5.0 (inclusive) are kept.
 * 3. Extracts essential columns: 'Name', 'Year', and 'Rating' to construct the taste profile payload for Gemini.
 */
function parseWatchlistAndBuildTasteProfile(rawCsv: string): WatchlistAnalysisData {
  const watchedTitlesSet = new Set<string>();
  const allWatchedTitles: string[] = [];

  if (!rawCsv || !rawCsv.trim()) {
    return {
      watchedTitlesSet,
      allWatchedTitles,
      filteredPayload: '',
      filteredCount: 0,
      totalParsedRows: 0,
    };
  }

  // Tokenize lines preserving quotes and multi-line breaks
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < rawCsv.length; i++) {
    const char = rawCsv[i];
    const nextChar = rawCsv[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        currentLine += char;
      }
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  if (lines.length < 2) {
    return {
      watchedTitlesSet,
      allWatchedTitles,
      filteredPayload: '',
      filteredCount: 0,
      totalParsedRows: 0,
    };
  }

  const tokenizeLine = (line: string): string[] => {
    const tokens: string[] = [];
    let token = '';
    let insideQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      const nc = line[j + 1];
      if (c === '"') {
        if (insideQuotes && nc === '"') {
          token += '"';
          j++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (c === ',' && !insideQuotes) {
        tokens.push(token.trim());
        token = '';
      } else {
        token += c;
      }
    }
    tokens.push(token.trim());
    return tokens;
  };

  const headerTokens = tokenizeLine(lines[0]);
  const normHeaders = headerTokens.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  let nameIdx = normHeaders.findIndex((h) => ['name', 'title', 'film', 'movietitle'].includes(h));
  let yearIdx = normHeaders.findIndex((h) => ['year', 'releaseyear', 'date'].includes(h));
  let ratingIdx = normHeaders.findIndex((h) => ['rating', 'yourrating', 'score'].includes(h));

  // Fallbacks based on standard Letterboxd column ordering: Date, Name, Year, Letterboxd URI, Rating
  if (nameIdx === -1 && headerTokens.length > 1) nameIdx = 1;
  if (yearIdx === -1 && headerTokens.length > 2) yearIdx = 2;
  if (ratingIdx === -1 && headerTokens.length > 4) ratingIdx = 4;

  const outputRows: string[] = ['Name,Year,Rating'];
  const dataLines = lines.slice(1);
  let filteredCount = 0;
  let totalParsedRows = 0;

  for (const line of dataLines) {
    const cols = tokenizeLine(line);
    const rawName = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx].replace(/^"|"$/g, '').trim() : '';
    if (!rawName) continue;

    totalParsedRows++;

    const lowerRaw = rawName.toLowerCase().trim();
    const normalized = normalizeTitle(rawName);

    watchedTitlesSet.add(lowerRaw);
    if (normalized) watchedTitlesSet.add(normalized);
    allWatchedTitles.push(rawName);

    const rawRating = ratingIdx !== -1 && cols[ratingIdx] ? cols[ratingIdx] : '';
    const numericRating = parseRatingValue(rawRating);

    if (numericRating === null || numericRating < 3.5 || numericRating > 5.0) {
      continue;
    }

    const rawYear = yearIdx !== -1 && cols[yearIdx] ? cols[yearIdx].replace(/^"|"$/g, '').trim() : '';
    const cleanYear = rawYear.replace(/[^0-9]/g, '').slice(0, 4);

    const cleanName = `"${rawName.replace(/"/g, '""')}"`;
    const cleanRating = numericRating.toFixed(1);

    outputRows.push(`${cleanName},${cleanYear},${cleanRating}`);
    filteredCount++;
  }

  return {
    watchedTitlesSet,
    allWatchedTitles,
    filteredPayload: filteredCount > 0 ? outputRows.join('\n') : '',
    filteredCount,
    totalParsedRows,
  };
}

export async function POST(req: NextRequest) {
  let obscurityLevel = 4;
  let username = 'cinephile';

  try {
    // -------------------------------------------------------------
    // 1. EXTRACT USER SESSION TOKEN & AUTHENTICATE VIA SUPABASE
    // -------------------------------------------------------------
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || null;

    const supabase = await createClient(bearerToken);

    const {
      data: { user },
      error: userAuthError,
    } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser();

    if (userAuthError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Active user session required. Please sign in to CultCrate.' },
        { status: 401 }
      );
    }

    // Fetch user's saved Gemini API Key from Supabase 'profiles' table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('Profiles table query notice:', profileError.message);
    }

    const userApiKey = profile?.gemini_api_key?.trim();

    if (!userApiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured. Please add your key in Settings.' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------
    // 2. FETCH RAW WATCHLIST CSV DIRECTLY FROM SUPABASE STORAGE
    // -------------------------------------------------------------
    const body = await req.json().catch(() => ({}));
    obscurityLevel = body.obscurityLevel ?? 4;
    const letterboxdHandle = pickLetterboxdHandle(
      body.username,
      profile?.letterboxd_username,
      user.user_metadata?.letterboxd_username
    );
    username = letterboxdHandle || 'cinephile';

    const {
      preferences = [],
      family_friendly_strict = false,
      country_filter = '',
      mood_genre_bias = '',
      era_preference = '',
      blacklisted_entities = [],
      runtime_constraint = '',
    } = body;

    let rawCsvContent = '';

    // no-store + cacheNonce: never serve a stale ratings.csv
    const csvResult = await downloadRatingsCsv(supabase, user.id);
    if (csvResult.status === 'found') {
      rawCsvContent = csvResult.text;
    } else if (csvResult.status === 'error') {
      console.warn(`[CultCrate AI] ratings.csv download failed: ${csvResult.message}`);
    }

    // -------------------------------------------------------------
    // 3. FETCH LIVE LETTERBOXD RSS FEED & MERGE WATCHED EXCLUSION LIST
    // -------------------------------------------------------------
    let rssEntries: ParsedRSSEntry[] = [];
    if (letterboxdHandle) {
      try {
        rssEntries = await fetchLetterboxdRSSFeed(letterboxdHandle);
        if (rssEntries.length > 0) {
          console.log(`[CultCrate AI] Ingested ${rssEntries.length} live entries from Letterboxd RSS feed for @${username}`);
        }
      } catch (rssErr) {
        console.warn(`[CultCrate AI] RSS feed fetch notice for @${username}:`, rssErr);
      }
    }

    // Fallback: If no CSV in storage, construct CSV payload from RSS entries or request body
    if (!rawCsvContent || !rawCsvContent.trim()) {
      if (rssEntries.length > 0) {
        const header = 'Date,Name,Year,Letterboxd URI,Rating';
        const rows = rssEntries.map((item) => {
          const titleEscaped = `"${(item.title || '').replace(/"/g, '""')}"`;
          const year = item.year || '';
          const url = item.letterboxdUrl || '';
          const rating = item.rating || '';
          return `${item.watchedDate},${titleEscaped},${year},${url},${rating}`;
        });
        rawCsvContent = [header, ...rows].join('\n');
      } else if (body.rawCsv && typeof body.rawCsv === 'string' && body.rawCsv.trim()) {
        rawCsvContent = body.rawCsv.trim();
      } else if (Array.isArray(body.watchlist) && body.watchlist.length > 0) {
        const header = 'Date,Name,Year,Letterboxd URI,Rating';
        const rows = body.watchlist.map((m: any) => {
          const title = `"${(m.title || m.name || '').replace(/"/g, '""')}"`;
          const year = m.year || '';
          const url = m.letterboxdUrl || '';
          const rating = m.rating || '';
          return `2024-01-01,${title},${year},${url},${rating}`;
        });
        rawCsvContent = [header, ...rows].join('\n');
      } else {
        return NextResponse.json(
          {
            error:
              `No ratings.csv or Letterboxd RSS feed found for @${username}. Please upload your Letterboxd CSV in Settings or set your Letterboxd username.`,
          },
          { status: 400 }
        );
      }
    }

    // -------------------------------------------------------------
    // 4. PARSE WATCHLIST & UNIFY WATCHED EXCLUSION LIST WITH RSS
    // -------------------------------------------------------------
    const {
      watchedTitlesSet,
      filteredPayload: initialFilteredPayload,
      filteredCount: initialFilteredCount,
      totalParsedRows,
    } = parseWatchlistAndBuildTasteProfile(rawCsvContent);

    // Merge RSS entries into watchedTitlesSet and taste profile payload
    let mergedFilteredPayload = initialFilteredPayload;
    let mergedFilteredCount = initialFilteredCount;

    if (rssEntries.length > 0) {
      const extraPayloadLines: string[] = [];
      for (const rssItem of rssEntries) {
        if (!rssItem.title) continue;

        const lowerTitle = rssItem.title.toLowerCase().trim();
        const normTitle = normalizeTitle(rssItem.title);

        // Ensure 100% exclusion of RSS-fetched watched items
        watchedTitlesSet.add(lowerTitle);
        if (normTitle) watchedTitlesSet.add(normTitle);

        // Merge high-taste rating signals (3.5★ - 5.0★) into Gemini prompt payload
        const parsedRating = parseRatingValue(rssItem.rating || '4.0');
        if (parsedRating !== null && parsedRating >= 3.5 && parsedRating <= 5.0) {
          const cleanName = `"${rssItem.title.replace(/"/g, '""')}"`;
          const line = `${cleanName},${rssItem.year || ''},${parsedRating.toFixed(1)}`;
          if (!mergedFilteredPayload.includes(cleanName)) {
            extraPayloadLines.push(line);
            mergedFilteredCount++;
          }
        }
      }

      if (extraPayloadLines.length > 0) {
        mergedFilteredPayload = mergedFilteredPayload
          ? `${mergedFilteredPayload}\n${extraPayloadLines.join('\n')}`
          : `Name,Year,Rating\n${extraPayloadLines.join('\n')}`;
      }
    }

    if (!mergedFilteredPayload || mergedFilteredCount === 0) {
      return NextResponse.json(
        {
          error:
            'No films with ratings between 3.5 and 5.0 stars found in your watchlist or RSS feed. CultCrate requires high-taste rating signals (3.5★ - 5.0★) to generate recommendations.',
        },
        { status: 400 }
      );
    }

    console.log(
      `[CultCrate AI] Unified Watchlist: Parsed ${totalParsedRows} CSV rows + ${rssEntries.length} RSS entries. Watched exclusion set size: ${watchedTitlesSet.size}. Filtered high-taste signals (3.5★ - 5.0★): ${mergedFilteredCount}.`
    );

    // -------------------------------------------------------------
    // 5. INITIALIZE @google/genai DYNAMICALLY USING USER'S API KEY
    // -------------------------------------------------------------
    const ai = new GoogleGenAI({ apiKey: userApiKey });

    // -------------------------------------------------------------
    // 6. CALL GEMINI WITH STRICT SYSTEM INSTRUCTION & ACTIVE MODELS
    // -------------------------------------------------------------
    const curatorialInstructions = [
      `Obscurity Calibration: Level ${obscurityLevel} of 5`,
      family_friendly_strict
        ? 'Family-Friendly Filter: STRICT (Suppress extreme visceral/body horror/nudity)'
        : 'Family-Friendly Filter: OFF (Unfiltered arthouse & cult canon permitted)',
      country_filter ? `Country / Regional Bias: ${country_filter}` : null,
      mood_genre_bias ? `Mood & Genre Bias: ${mood_genre_bias}` : null,
      era_preference ? `Era Preference: ${era_preference}` : null,
      runtime_constraint ? `Runtime Constraint: ${runtime_constraint}` : null,
      blacklisted_entities && blacklisted_entities.length > 0
        ? `Blacklisted Entities / Exclusions: ${blacklisted_entities.join(', ')}`
        : null,
      preferences && preferences.length > 0
        ? `User Aesthetic Preferences: ${preferences.join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('\n- ');

    const userPrompt = `[CORE INSTRUCTION]
You are CultCrate's Cinephile AI. Analyze the user's highly rated films (3.5-5.0 stars). Recommend NEW movies they have NOT seen. DO NOT recommend any film present in their watchlist.

USER HIGH-TASTE LETTERBOXD WATCHLIST & LIVE RSS FEED (STRICTLY CALIBRATED 3.5 - 5.0 STARS ONLY):
\`\`\`csv
${mergedFilteredPayload}
\`\`\`

ACTIVE CURATION PARAMETERS:
- ${curatorialInstructions}

LETTERBOXD USERNAME: @${username}
DATASET SIZE: ${mergedFilteredCount} calibrated positive signals (3.5★ to 5.0★) unified from CSV + RSS feed.

Analyze the user's positive signals (4.0 - 5.0 stars) and secondary signals (3.5 stars) from this filtered high-taste watchlist. Map underlying crew signatures (screenwriters, cinematographers, editors), enforce strict deduplication (zero recommended movies may be present in the user's watchlist), and return hyper-targeted Masterpiece and Excellent cohorts.`;

    const filmSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        year: { type: Type.INTEGER },
        genre: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        country: { type: Type.STRING },
        runtime_mins: { type: Type.INTEGER },
        imdb_rating: { type: Type.NUMBER },
        content_advisory: { type: Type.STRING },
        where_to_watch_india: { type: Type.STRING },
        audio_availability: { type: Type.STRING },
        spoiler_free_premise: { type: Type.STRING },
        thematic_alignment: { type: Type.STRING },
        scale_projection: { type: Type.STRING },
        director: { type: Type.STRING },
      },
      required: [
        'title',
        'year',
        'genre',
        'country',
        'runtime_mins',
        'imdb_rating',
        'content_advisory',
        'where_to_watch_india',
        'audio_availability',
        'spoiler_free_premise',
        'thematic_alignment',
        'scale_projection',
      ],
    };

    const config = {
      systemInstruction: Cinema_Engine_Prompt_2,
      responseMimeType: 'application/json',
      temperature: 0.35,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          taste_profile_summary: {
            type: Type.STRING,
            description:
              'A brief 2-sentence breakdown of what the data says about the cinematic DNA',
          },
          masterpiece_cohort: {
            type: Type.ARRAY,
            items: filmSchema,
          },
          excellent_cohort: {
            type: Type.ARRAY,
            items: filmSchema,
          },
        },
        required: ['taste_profile_summary', 'masterpiece_cohort', 'excellent_cohort'],
      },
    };

    // Models are auto-discovered per API key (lib/geminiModels.ts); nothing is hardcoded here.
    let response: GenerateContentResponse | null = null;
    let activeModelUsed = '';
    let highDemandFallback = false;

    try {
      const result = await generateContentWithFallback(ai, userApiKey, { contents: [userPrompt], config });
      response = result.response;
      activeModelUsed = result.model;
    } catch (genErr: unknown) {
      if (genErr instanceof GeminiFallbackError && genErr.allOverloaded) {
        highDemandFallback = true;
      } else {
        throw genErr;
      }
    }

    const formatFilm = (f: any, idx: number, isMasterpiece: boolean) => {
      const streamingList =
        typeof f.where_to_watch_india === 'string'
          ? f.where_to_watch_india.split(',').map((s: string) => s.trim())
          : Array.isArray(f.where_to_watch_india)
          ? f.where_to_watch_india
          : ['MUBI India', 'Prime Video India', 'Apple TV (Rent/Buy)'];

      const posterUrl = '';

      return {
        id: `film-${isMasterpiece ? 'masterpiece' : 'excellent'}-${idx}-${(f.title || 'film')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')}`,
        title: f.title,
        originalTitle: f.originalTitle || f.title,
        year: f.year,
        genre: f.genre || ['Drama', 'Thriller'],
        country: f.country || 'International',
        countryFlag: f.country?.toLowerCase().includes('korea')
          ? '🇰🇷'
          : f.country?.toLowerCase().includes('japan')
          ? '🇯🇵'
          : f.country?.toLowerCase().includes('france')
          ? '🇫🇷'
          : f.country?.toLowerCase().includes('germany')
          ? '🇩🇪'
          : f.country?.toLowerCase().includes('poland')
          ? '🇵🇱'
          : f.country?.toLowerCase().includes('india')
          ? '🇮🇳'
          : '🌐',
        runtime_mins: f.runtime_mins || 120,
        runtime: `${f.runtime_mins || 120} min`,
        imdb_rating: f.imdb_rating || 7.8,
        imdbRating: `${f.imdb_rating || 7.8}`,
        letterboxdRating: `${Math.min(5.0, Number(f.imdb_rating || 7.8) / 2 + 0.3).toFixed(1)}`,
        matchScore: `${isMasterpiece ? (99.4 - idx * 0.5).toFixed(1) : (97.2 - idx * 0.7).toFixed(1)}%`,
        obscurityBadge: isMasterpiece
          ? `Tier ${obscurityLevel} // Masterpiece Cohort`
          : `Tier ${obscurityLevel} // Excellent Gem`,
        content_advisory: f.content_advisory,
        contentAdvisory: f.content_advisory,
        advisory: f.content_advisory,
        where_to_watch_india: f.where_to_watch_india,
        whereToWatchInIndia: streamingList,
        streamingPlatforms: streamingList,
        audio_availability: f.audio_availability || 'Original Master • English Subtitles',
        spoiler_free_premise: f.spoiler_free_premise,
        synopsis: f.spoiler_free_premise,
        thematic_alignment: f.thematic_alignment,
        curatorialReason: f.thematic_alignment,
        scale_projection: isMasterpiece ? 'Masterpiece' : 'Excellent',
        posterUrl,
        director: f.director || (isMasterpiece ? 'Visionary Auteur' : 'Underground Auteur'),
        letterboxdUrl: `https://letterboxd.com/film/${encodeURIComponent(
          (f.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
        )}/`,
        trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
          (f.title || '') + ' official trailer'
        )}`,
      };
    };

    const isAlreadyInWatchedList = (movieTitle: string): boolean => {
      if (!movieTitle) return false;
      const lowerRaw = movieTitle.toLowerCase().trim();
      const normalized = normalizeTitle(movieTitle);

      if (watchedTitlesSet.has(lowerRaw)) return true;
      if (normalized && watchedTitlesSet.has(normalized)) return true;
      return false;
    };

    if (highDemandFallback) {
      console.warn('[CultCrate AI] Returning offline calibrated vault cohorts due to high demand.');
      const offlinePayload = getOfflineCalibratedCohorts(obscurityLevel);

      const filteredOfflineMasterpiece = offlinePayload.masterpiece_cohort.filter(
        (film: any) => !isAlreadyInWatchedList(film.title)
      );
      const filteredOfflineExcellent = offlinePayload.excellent_cohort.filter(
        (film: any) => !isAlreadyInWatchedList(film.title)
      );

      const enrichedMasterpiece = filteredOfflineMasterpiece.map((film: any, i: number) => {
        return formatFilm({ ...film, posterUrl: '' }, i, true);
      });
      const enrichedExcellent = filteredOfflineExcellent.map((film: any, i: number) => {
        return formatFilm({ ...film, posterUrl: '' }, i, false);
      });

      return NextResponse.json({
        status: 'success',
        source: 'offline_calibrated_vault',
        model: 'offline_vault_archive',
        taste_profile_summary: offlinePayload.taste_profile_summary,
        tasteProfileSummary: offlinePayload.taste_profile_summary,
        masterpiece_cohort: enrichedMasterpiece,
        masterpieceCohort: enrichedMasterpiece,
        excellent_cohort: enrichedExcellent,
        excellentCohort: enrichedExcellent,
      });
    }

    const rawJsonText = response?.text ?? '';
    if (!rawJsonText.trim()) {
      throw new Error('Gemini AI returned an empty response.');
    }
    let parsedResult: any = {};

    try {
      const cleanJson = rawJsonText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsedResult = JSON.parse(cleanJson);
    } catch (jsonErr) {
      console.error('[CultCrate AI] JSON Parse error on Gemini output:', jsonErr);
      throw new Error('Gemini AI returned invalid non-JSON output format.');
    }

    const rawMasterpieceCohort = Array.isArray(parsedResult.masterpiece_cohort)
      ? parsedResult.masterpiece_cohort
      : Array.isArray(parsedResult.masterpieceCohort)
      ? parsedResult.masterpieceCohort
      : [];

    const rawExcellentCohort = Array.isArray(parsedResult.excellent_cohort)
      ? parsedResult.excellent_cohort
      : Array.isArray(parsedResult.excellentCohort)
      ? parsedResult.excellentCohort
      : [];

    const deduplicatedMasterpiece = rawMasterpieceCohort.filter((film: any) => {
      const alreadyWatched = isAlreadyInWatchedList(film.title);
      if (alreadyWatched) {
        console.log(`[CultCrate AI] Deduplication: filtered out already watched film "${film.title}"`);
      }
      return !alreadyWatched;
    });

    const deduplicatedExcellent = rawExcellentCohort.filter((film: any) => {
      const alreadyWatched = isAlreadyInWatchedList(film.title);
      if (alreadyWatched) {
        console.log(`[CultCrate AI] Deduplication: filtered out already watched film "${film.title}"`);
      }
      return !alreadyWatched;
    });

    const [enrichedMasterpiece, enrichedExcellent] = [
      deduplicatedMasterpiece.map((film: any, i: number) => {
        return formatFilm({ ...film, posterUrl: '' }, i, true);
      }),
      deduplicatedExcellent.map((film: any, i: number) => {
        return formatFilm({ ...film, posterUrl: '' }, i, false);
      }),
    ];

    return NextResponse.json({
      status: 'success',
      model: activeModelUsed,
      taste_profile_summary: parsedResult.taste_profile_summary || parsedResult.tasteProfileSummary,
      tasteProfileSummary: parsedResult.taste_profile_summary || parsedResult.tasteProfileSummary,
      masterpiece_cohort: enrichedMasterpiece,
      masterpieceCohort: enrichedMasterpiece,
      excellent_cohort: enrichedExcellent,
      excellentCohort: enrichedExcellent,
      watchedDeduplicationCount: watchedTitlesSet.size,
      rssSyncedEntriesCount: rssEntries.length,
    });
  } catch (err: unknown) {
    console.error('Unhandled failure in /api/recommendations:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      {
        error: `CultCrate AI Engine Error: ${msg}`,
      },
      { status: 500 }
    );
  }
}

function getOfflineCalibratedCohorts(level: number) {
  return {
    taste_profile_summary:
      'High affinity for clinical psychological dread, rain-soaked neo-noir lighting, and uncompromising auteur cinematography. Calibrated directly from the offline Vault screening archives.',
    masterpiece_cohort: [
      {
        title: 'Memories of Murder',
        year: 2003,
        genre: ['Crime', 'Drama', 'Mystery'],
        country: 'South Korea',
        runtime_mins: 131,
        imdb_rating: 8.1,
        posterUrl: '',
        content_advisory: 'Disturbing Serial Homicide Themes & Rain-Soaked Atmosphere',
        where_to_watch_india: 'Prime Video India, MUBI India, Apple TV Store',
        audio_availability: 'Korean Original Master • English Subtitles',
        spoiler_free_premise:
          'In a rural province in 1986, two ill-equipped detectives struggle with brutality, missing forensic evidence, and psychological exhaustion while pursuing South Korea\'s first serial murderer.',
        thematic_alignment:
          'Unmatched chiaroscuro night cinematography, moral decay, and razor-sharp procedural tension matching your top-rated Korean neo-noirs.',
        scale_projection: 'Masterpiece',
        director: 'Bong Joon-ho',
      },
      {
        title: 'Cure',
        year: 1997,
        genre: ['Crime', 'Horror', 'Mystery'],
        country: 'Japan',
        runtime_mins: 111,
        imdb_rating: 7.5,
        posterUrl: '',
        content_advisory: 'Hypnotic Psychological Horror & Existential Nihilism',
        where_to_watch_india: 'MUBI India, Criterion Channel (VPN), Apple TV Store',
        audio_availability: 'Japanese Master • English Subtitles',
        spoiler_free_premise:
          'A burnt-out Tokyo detective investigates identical gruesome murders committed by ordinary people who have no memory of their actions after encountering an amnesiac wanderer.',
        thematic_alignment:
          'Clinical spatial staging, industrial sound design, and hypnotic psychological tension tailored to deep cinephile appreciation.',
        scale_projection: 'Masterpiece',
        director: 'Kiyoshi Kurosawa',
      },
      {
        title: 'Burning',
        year: 2018,
        genre: ['Drama', 'Mystery', 'Thriller'],
        country: 'South Korea',
        runtime_mins: 148,
        imdb_rating: 7.5,
        posterUrl: '',
        content_advisory: 'Slow-Burn Existential Enigma & Class Tension',
        where_to_watch_india: 'Netflix India, Prime Video India, MUBI India',
        audio_availability: 'Korean 5.1 Surround • English Subtitles',
        spoiler_free_premise:
          'An aspiring novelist encounters a childhood acquaintance and a wealthy, mysterious playboy whose strange secret hobby ignites an obsessive investigation.',
        thematic_alignment:
          'A quiet masterclass in atmospheric pacing, natural twilight lighting, and subtle class friction adapted from Haruki Murakami.',
        scale_projection: 'Masterpiece',
        director: 'Lee Chang-dong',
      },
      {
        title: 'Stalker',
        year: 1979,
        genre: ['Sci-Fi', 'Drama', 'Mystery'],
        country: 'Soviet Union',
        runtime_mins: 162,
        imdb_rating: 8.1,
        posterUrl: '',
        content_advisory: 'Metaphysical Philosophical Dread & Toxic Industrial Hazards',
        where_to_watch_india: 'Criterion Channel, YouTube Cinema Arthouse, MUBI India',
        audio_availability: 'Russian Mono Master • English Subtitles',
        spoiler_free_premise:
          'A guide leads a melancholic writer and a cynical professor through a hazardous, sentient post-apocalyptic wasteland known as The Zone to locate a room that grants deep desires.',
        thematic_alignment:
          'Legendary long takes, sepia tones transitioning into vibrant overgrown landscapes, and transcendental spiritual metaphysics.',
        scale_projection: 'Masterpiece',
        director: 'Andrei Tarkovsky',
      },
    ],
    excellent_cohort: [
      {
        title: 'Possession',
        year: 1981,
        genre: ['Horror', 'Drama'],
        country: 'France / West Germany',
        runtime_mins: 124,
        imdb_rating: 7.3,
        posterUrl: '',
        content_advisory: 'Severe Psychological Hysteria & Surrealist Body Horror',
        where_to_watch_india: 'MUBI India, Metrograph at Home, Apple TV (Rent)',
        audio_availability: 'Original English Master',
        spoiler_free_premise:
          'Against the backdrop of the Berlin Wall, a spy returns home to his unraveling marriage only to discover his wife has formed an unspeakable metaphysical liaison.',
        thematic_alignment:
          'Extreme unhinged acting performances, visceral bodily terror, and profound Cold War socio-political allegories.',
        scale_projection: 'Excellent',
        director: 'Andrzej Żuławski',
      },
      {
        title: 'On the Silver Globe',
        year: 1988,
        genre: ['Sci-Fi', 'Drama', 'Fantasy'],
        country: 'Poland',
        runtime_mins: 166,
        imdb_rating: 7.2,
        posterUrl: '',
        content_advisory: 'Hallucinatory Sci-Fi Metaphysics & Pagan Savagery',
        where_to_watch_india: 'Eastern Promises India, MUBI India, Archival 4K',
        audio_availability: 'Polish Master • English Subtitles',
        spoiler_free_premise:
          'Astronauts crash-land on an alien planet and establish a primal society that gradually devolves into religious mythology and pagan tribal warfare over generations.',
        thematic_alignment:
          'A monumental Polish science fiction odyssey that pushed European visionary cinema to its absolute ecstatic and philosophical boundaries.',
        scale_projection: 'Excellent',
        director: 'Andrzej Żuławski',
      },
      {
        title: 'The Conversation',
        year: 1974,
        genre: ['Drama', 'Mystery', 'Thriller'],
        country: 'USA',
        runtime_mins: 113,
        imdb_rating: 7.8,
        posterUrl: '',
        content_advisory: 'Psychological Paranoia & Surveillance Tension',
        where_to_watch_india: 'Prime Video India, Apple TV Store, Criterion Channel',
        audio_availability: 'English 5.1 Surround',
        spoiler_free_premise:
          'A secretive and obsessive surveillance expert suspects that a routine audio recording of a young couple conversing in a crowded park portends a corporate murder.',
        thematic_alignment:
          'Masterful sound design editing by Walter Murch, acoustic dread, and unmatched character characterization of solitary guilt.',
        scale_projection: 'Excellent',
        director: 'Francis Ford Coppola',
      },
      {
        title: 'Blow Out',
        year: 1981,
        genre: ['Crime', 'Mystery', 'Thriller'],
        country: 'USA',
        runtime_mins: 108,
        imdb_rating: 7.4,
        posterUrl: '',
        content_advisory: 'Political Conspiracy & Sound-Induced Paranoia',
        where_to_watch_india: 'Criterion Channel, Prime Video (VOD), MUBI India',
        audio_availability: 'English Dolby Surround',
        spoiler_free_premise:
          'A movie sound technician accidentally records audio proof of a political assassination when a car carrying a governor plunges off a bridge.',
        thematic_alignment:
          'Brian De Palma\'s split-diopter camera brilliance, vibrant color palettes, and devastating, cynical conclusions.',
        scale_projection: 'Excellent',
        director: 'Brian De Palma',
      },
    ],
  };
}
