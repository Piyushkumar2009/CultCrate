/** Shared (client + server) rules and types for the admin "create user directly" feature. */

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt, which Supabase uses for passwords, ignores everything after 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export interface CreateUserInput {
  email: string;
  password: string;
  letterboxdUsername: string;
}

export type CreateUserValidation = { ok: true; value: CreateUserInput } | { ok: false; error: string };

export interface CreateUserResult {
  ok: true;
  user: { id: string; email: string; letterboxdUsername: string };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Cleans and checks the three fields. Used by the form (instant feedback) and by the API route (the real gate). */
export function validateCreateUserInput(body: unknown): CreateUserValidation {
  const rec = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const rawEmail = typeof rec.email === 'string' ? rec.email : '';
  const password = typeof rec.password === 'string' ? rec.password : '';
  const rawUsername = typeof rec.letterboxdUsername === 'string' ? rec.letterboxdUsername : '';

  const email = rawEmail.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `The password needs at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (byteLength(password) > PASSWORD_MAX_BYTES) {
    return { ok: false, error: `The password is too long (the limit is ${PASSWORD_MAX_BYTES} bytes).` };
  }

  const letterboxdUsername = rawUsername.trim().replace(/^@/, '').trim();
  if (!letterboxdUsername) {
    return { ok: false, error: 'Enter the Letterboxd username.' };
  }
  if (!USERNAME_PATTERN.test(letterboxdUsername)) {
    return { ok: false, error: 'Letterboxd usernames can only use letters, numbers, hyphens and underscores (up to 40).' };
  }

  return { ok: true, value: { email, password, letterboxdUsername } };
}
