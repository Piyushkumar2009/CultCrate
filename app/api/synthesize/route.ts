import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { generateContentWithFallback } from '@/lib/geminiModels';
import { SAMPLE_COHORTS, FilmCohort, FilmItem } from '@/lib/vaultData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username = 'cinephile', obscurityLevel = 4, apiKey: customApiKey, preferences = [] } = body;

    const apiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY;

    // If a Gemini key is available, call the best model this key can currently use (auto-discovered, see lib/geminiModels.ts)
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `You are the chief curation architect for CultCrate, an elite cinephile screening platform.
User handle: "${username}"
Target Obscurity Calibration: Level ${obscurityLevel} (where 1=Cannes/Palme d'Or, 3=Cult Canon/Giallo, 4=Deep Arthouse/Midnight, 5=The Cinematic Void/Rare Archives)
User Preferences: ${preferences.join(', ') || 'Atmospheric psychological thrillers, neo-noir, auteur cinema, surrealism'}

Generate a tight, cohesive 5-film screening cohort.
Output ONLY valid JSON matching this schema with NO markdown code fences or other text:
{
  "cohortTitle": "String - Poetic evocative title (e.g. 'Tokyo Rain Neo-Noir & Psychological Dissolution')",
  "curatorialLog": "String - 2 sentences on the curatorial rationale and stylistic throughline",
  "averageObscurity": "Level ${obscurityLevel}",
  "films": [
    {
      "id": "slug-string",
      "title": "Film Title",
      "originalTitle": "Original foreign title or same",
      "year": 1997,
      "director": "Director Name",
      "runtime": "111m",
      "country": "Country",
      "letterboxdRating": "4.2",
      "posterUrl": "",
      "genomeMatch": "98.5%",
      "genomeTag": "Director or Aesthetic Vector",
      "synopsis": "1-2 sentence non-spoiler synopsis emphasizing sensory atmosphere.",
      "streaming": ["Criterion Channel", "MUBI"],
      "tags": ["Arthouse", "Neo-Noir"]
    }
  ]
}`;

        const { response, model: modelUsed } = await generateContentWithFallback(ai, apiKey, {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = response.text?.trim() || '';
        if (!text) throw new Error('Gemini returned an empty response');
        const cleanedText = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(cleanedText);

        return NextResponse.json({
          source: modelUsed,
          cohort: parsed,
        });
      } catch (geminiError) {
        console.warn('Gemini synthesis failed, falling back to curated archive:', geminiError);
      }
    }

    // Curated high-fidelity fallback based on obscurity level and user handle
    const fallback = getCuratedCohort(obscurityLevel, username);
    return NextResponse.json({
      source: 'curated_vault_archive',
      cohort: fallback,
    });
  } catch (error) {
    console.error('Request processing error in /api/synthesize:', error);
    return NextResponse.json({
      source: 'default_vault',
      cohort: getCuratedCohort(4, 'cinephile'),
    });
  }
}

function getCuratedCohort(level: number, username: string) {
  const matched = SAMPLE_COHORTS.find((c) => c.obscurityLevel === level) || SAMPLE_COHORTS[0];

  return {
    cohortTitle: matched.cohortTitle,
    curatorialLog: `Curated for @${username}. ${matched.curatorialLog}`,
    averageObscurity: matched.obscurityLabel,
    films: matched.films,
  };
}
