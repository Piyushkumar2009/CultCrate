/** Friendly messages for the "Run AI Engine" button. Kept free of React so it can be unit tested. */

/**
 * How long the browser waits for the engine before giving up. A little longer than the server's own time budget
 * (see maxDuration in app/api/recommendations/route.ts), so the server's friendly timeout message arrives first.
 */
export const ENGINE_REQUEST_TIMEOUT_MS = 75_000;

const TIMEOUT_MESSAGE = 'The AI is taking longer than usual right now. Please try again in a minute.';
const CONNECTION_MESSAGE = "We couldn't reach CultCrate. Check your connection and try again.";

/** Turns a non-2xx answer into something a person can act on. */
export function failedResponseMessage(status: number, serverMessage: string, raw: string): string {
  // Our own route always sends a readable message, so trust it first.
  if (serverMessage.trim()) return serverMessage.trim();

  // Gateway timeouts come back from the platform as plain text or an HTML page, never as our JSON.
  if (status === 504 || status === 502 || status === 408 || /TIMEOUT|timed out/i.test(raw)) return TIMEOUT_MESSAGE;

  return `Something went wrong on our side (error ${status || 'unknown'}). Please try again.`;
}

/** Turns anything thrown while running the engine into a friendly sentence. */
export function friendlyEngineError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError' || /\baborted\b/i.test(err.message)) {
      return TIMEOUT_MESSAGE;
    }
    if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) {
      return CONNECTION_MESSAGE;
    }
    return err.message || 'Something went wrong. Please try again.';
  }
  return typeof err === 'string' && err ? err : 'Something went wrong. Please try again.';
}
