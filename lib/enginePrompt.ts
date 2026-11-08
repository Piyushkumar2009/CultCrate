import { Type } from '@google/genai';

/** Strict system instruction for the engine. Analyses 4.0-5.0 star films (3.5-5.0 when 4+ ratings are scarce). */
export const ENGINE_SYSTEM_PROMPT = `You are CultCrate's Cinephile AI. Analyze the user's highly rated films (4.0-5.0 stars, or 3.5-5.0 when 4+ ratings are scarce). Recommend NEW movies they have NOT seen. DO NOT recommend any film present in their watchlist.

[SYSTEM_ROLE]
You are an elite, highly sophisticated cinematic data scientist and expert underground film recommendation engine for CultCrate. Your task is to ingest, analyze, and profile the user's personal Letterboxd viewing history provided in the CSV dataset. Based strictly on historical taste, data patterns, calibrated rating scale, and curatorial parameters, generate a hyper-targeted, curated list of movie recommendations that the user has NOT yet watched.

[CALIBRATED_RATING_SCALE]
- 3.5 Stars: A genuinely good film that stands out and indicates reliable genre/director resonance.
- 4.0 Stars: An excellent, highly impressive film representing a clear positive taste signal.
- 4.5 to 5.0 Stars: An absolute masterpiece of cinema representing the user's core aesthetic DNA.
- Note: The input dataset has been pre-filtered to the user's highest-rated films: normally ONLY 4.0 to 5.0 stars (3.5-star films appear only when the user has very few 4+ ratings). Every film in the dataset represents a proven positive taste signal.

[ADVANCED_QUALITY_CONTROL_AND_ANTIBIAS]
- Do NOT solely filter by high IMDb scores (e.g., 7.5+). Actively look for "Polarizing Cult Classics" and "Underrated Masterpieces" that may have a lower or average IMDb score (between 6.5 and 7.3) due to general audience confusion, micro-budgets, or highly complex, mind-bending narrative choices, but are universally praised by deep cinephiles.
- Prioritize high-quality, high-concept cinema and cross-reference obscure gems rather than listing obvious global blockbusters.
- Analyze the underlying Crew DNA in 4.0–5.0 star entries, identifying recurring Screenwriters, Cinematographers, and Editors to map subconscious technical preferences.

[ANALYSIS_PROTOCOL]
1. Data Ingestion: Ingest the provided high-taste watchlist (normally 4.0 to 5.0 stars). Extract movie titles, release years, and user ratings.
2. Positive Signal Extraction: Isolate all entries rated 4.0 to 5.0 stars. Analyze these for dominant themes, pacing styles, eras, and technical crew signatures.
3. Secondary Signal Extraction: Analyze any 3.5-star films present (included only when 4+ ratings are scarce) to look for micro-trends or specific elements consistently appreciated.
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

export const MAX_FILMS_PER_COHORT = 12;
/** Names of already-seen films listed in the prompt so the model avoids them instead of us only deleting them after. */
export const MAX_SEEN_TITLES_IN_PROMPT = 600;
export const MAX_BLACKLIST_TITLES_IN_PROMPT = 120;

export interface CurationParams {
  obscurityLevel: number;
  familyFriendlyStrict: boolean;
  countryFilter: string;
  moodGenreBias: string;
  eraPreference: string;
  runtimeConstraint: string;
  blacklistedEntities: string[];
  preferences: string[];
}

export function buildCuratorialInstructions(p: CurationParams): string {
  return [
    `Obscurity Calibration: Level ${p.obscurityLevel} of 5`,
    p.familyFriendlyStrict
      ? 'Family-Friendly Filter: STRICT (Suppress extreme visceral/body horror/nudity)'
      : 'Family-Friendly Filter: OFF (Unfiltered arthouse & cult canon permitted)',
    p.countryFilter ? `Country / Regional Bias: ${p.countryFilter}` : null,
    p.moodGenreBias ? `Mood & Genre Bias: ${p.moodGenreBias}` : null,
    p.eraPreference ? `Era Preference: ${p.eraPreference}` : null,
    p.runtimeConstraint ? `Runtime Constraint: ${p.runtimeConstraint}` : null,
    p.blacklistedEntities.length > 0
      ? `Blacklisted Entities / Exclusions: ${p.blacklistedEntities.slice(0, MAX_BLACKLIST_TITLES_IN_PROMPT).join(', ')}`
      : null,
    p.preferences.length > 0 ? `User Aesthetic Preferences: ${p.preferences.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n- ');
}

export interface UserPromptInput {
  signalsCsv: string;
  signalCount: number;
  thresholdLabel: string;
  username: string;
  curation: string;
  /** Other films the person has already seen (not in the CSV above). */
  seenTitles: string[];
  seenTotal: number;
}

export function buildUserPrompt(i: UserPromptInput): string {
  const seenBlock =
    i.seenTitles.length > 0
      ? `\n\nALREADY SEEN (${i.seenTotal} films in total, ${i.seenTitles.length} shown). NEVER recommend any of these:\n${i.seenTitles.join(' | ')}`
      : '';

  return `[CORE INSTRUCTION]
You are CultCrate's Cinephile AI. Analyze the user's highly rated films (4.0-5.0 stars, or 3.5-5.0 when 4+ ratings are scarce). Recommend NEW movies they have NOT seen. DO NOT recommend any film present in their watchlist.

USER HIGH-TASTE LETTERBOXD WATCHLIST & LIVE RSS FEED (HIGHEST-RATED FILMS ONLY, ${i.thresholdLabel} - 5.0 STARS):
\`\`\`csv
${i.signalsCsv}
\`\`\`${seenBlock}

ACTIVE CURATION PARAMETERS:
- ${i.curation}

LETTERBOXD USERNAME: @${i.username}
DATASET SIZE: ${i.signalCount} calibrated positive signals (${i.thresholdLabel}★ to 5.0★) unified from CSV + RSS feed.

Analyze the user's positive signals (${i.thresholdLabel} - 5.0 stars). Look for dominant directors, screenwriters, cinematographers, eras and themes across the whole list, enforce strict deduplication (zero recommended movies may be present in the user's watched films), and return hyper-targeted Masterpiece and Excellent cohorts.

OUTPUT LIMITS: return at most ${MAX_FILMS_PER_COHORT} films in masterpiece_cohort and at most ${MAX_FILMS_PER_COHORT} in excellent_cohort. Keep every text field to one short sentence (premise: at most two). Reply with the JSON object only.`;
}

const filmSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    year: { type: Type.INTEGER },
    genre: { type: Type.ARRAY, items: { type: Type.STRING } },
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

export const ENGINE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    taste_profile_summary: {
      type: Type.STRING,
      description: 'A brief 2-sentence breakdown of what the data says about the cinematic DNA',
    },
    masterpiece_cohort: { type: Type.ARRAY, items: filmSchema },
    excellent_cohort: { type: Type.ARRAY, items: filmSchema },
  },
  required: ['taste_profile_summary', 'masterpiece_cohort', 'excellent_cohort'],
};
