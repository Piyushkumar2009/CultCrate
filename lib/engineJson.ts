/**
 * Tolerant parser for the AI engine's JSON answer.
 *
 * Why this exists: Gemini "thinking" models spend output tokens on reasoning, and a long run can hit the output
 * limit in the middle of the JSON (finishReason MAX_TOKENS). A strict JSON.parse then throws and the whole run is
 * lost even though most films were already written. Here we first try the strict parse; if that fails we cut the text
 * back to the last fully written film and close the open brackets, so the person still gets every complete pick.
 */

export interface EngineParseResult {
  data: Record<string, unknown>;
  /** true when the text was cut off and had to be repaired */
  repaired: boolean;
}

export class EngineOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineOutputError';
  }
}

export function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Cuts truncated JSON back to its last complete array element / property value and closes the open brackets.
 * Returns null when there is nothing safe to keep.
 */
export function repairTruncatedJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  let cutAt = -1;
  let cutStack: string[] = [];

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
    } else if (c === '{' || c === '[') {
      stack.push(c);
    } else if (c === '}' || c === ']') {
      stack.pop();
      // A value just finished: safe to cut here when it was an array element or an object property.
      if (stack.length > 0) {
        cutAt = i + 1;
        cutStack = [...stack];
      }
    }
  }

  if (cutAt === -1) return null;
  const closers = cutStack
    .reverse()
    .map((open) => (open === '{' ? '}' : ']'))
    .join('');
  return text.slice(start, cutAt) + closers;
}

export function parseEngineJson(rawText: string): EngineParseResult {
  const clean = stripCodeFences(rawText);
  if (!clean) throw new EngineOutputError('The AI returned an empty response.');

  try {
    const strict: unknown = JSON.parse(clean);
    if (typeof strict === 'object' && strict !== null && !Array.isArray(strict)) {
      return { data: strict as Record<string, unknown>, repaired: false };
    }
  } catch {
    /* fall through to repair */
  }

  const fixed = repairTruncatedJson(clean);
  if (fixed) {
    try {
      const parsed: unknown = JSON.parse(fixed);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return { data: parsed as Record<string, unknown>, repaired: true };
      }
    } catch {
      /* give up below */
    }
  }
  throw new EngineOutputError('The AI returned output that could not be read as JSON.');
}

/** Pulls the two cohorts out of whatever shape came back (snake_case or camelCase). Never throws. */
export function readCohorts(data: Record<string, unknown>): {
  summary: string;
  masterpiece: Record<string, unknown>[];
  excellent: Record<string, unknown>[];
} {
  const list = (...candidates: unknown[]): Record<string, unknown>[] => {
    for (const c of candidates) {
      if (Array.isArray(c)) {
        return c.filter(
          (f): f is Record<string, unknown> =>
            typeof f === 'object' && f !== null && typeof (f as Record<string, unknown>).title === 'string' && ((f as Record<string, unknown>).title as string).trim() !== ''
        );
      }
    }
    return [];
  };
  const summaryRaw = data.taste_profile_summary ?? data.tasteProfileSummary;
  return {
    summary: typeof summaryRaw === 'string' ? summaryRaw : '',
    masterpiece: list(data.masterpiece_cohort, data.masterpieceCohort),
    excellent: list(data.excellent_cohort, data.excellentCohort),
  };
}
