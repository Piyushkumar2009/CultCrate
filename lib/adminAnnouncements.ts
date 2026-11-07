/** Announcement-banner contracts + input validation. Pure, shared by the API routes and the UI. */

export type AnnouncementTone = 'info' | 'success' | 'warning' | 'critical';

export const ANNOUNCEMENT_TONES: ReadonlyArray<AnnouncementTone> = ['info', 'success', 'warning', 'critical'];
export const MAX_ANNOUNCEMENT_LENGTH = 280;
export const MAX_LINK_LABEL_LENGTH = 40;

export interface PublicAnnouncement {
  id: string;
  message: string;
  tone: AnnouncementTone;
  linkUrl: string | null;
  linkLabel: string | null;
  dismissible: boolean;
  /** Changes whenever the admin edits the banner, so a dismissed banner re-appears if its text changes */
  updatedAt: string;
}

export interface Announcement extends PublicAnnouncement {
  isActive: boolean;
  createdAt: string;
}

export interface AnnouncementInput {
  message: string;
  tone: AnnouncementTone;
  linkUrl: string | null;
  linkLabel: string | null;
  dismissible: boolean;
}

export type AnnouncementValidation<T> = { ok: true; value: T } | { ok: false; error: string };

export function isAnnouncementTone(value: unknown): value is AnnouncementTone {
  return typeof value === 'string' && (ANNOUNCEMENT_TONES as ReadonlyArray<string>).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Strips control characters and collapses whitespace, so a banner can never contain hidden or multi-line junk. */
export function cleanText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Only same-site paths ("/pricing") and https links are allowed.
 * `javascript:`, `data:`, protocol-relative ("//evil.com") and plain http are all rejected.
 * Returns null for "no link" and undefined for "invalid link".
 */
export function sanitizeLinkUrl(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) return undefined;
  if (trimmed.startsWith('/')) return trimmed.startsWith('//') || trimmed.startsWith('/\\') ? undefined : trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Validates a create body (every field checked) or an edit body (only the fields that are present). */
export function parseAnnouncementInput(body: unknown, mode: 'create'): AnnouncementValidation<AnnouncementInput>;
export function parseAnnouncementInput(body: unknown, mode: 'update'): AnnouncementValidation<Partial<AnnouncementInput>>;
export function parseAnnouncementInput(
  body: unknown,
  mode: 'create' | 'update'
): AnnouncementValidation<AnnouncementInput> | AnnouncementValidation<Partial<AnnouncementInput>> {
  if (!isRecord(body)) return { ok: false, error: "We couldn't understand that request." };
  const out: Partial<AnnouncementInput> = {};

  if (mode === 'create' || 'message' in body) {
    if (typeof body.message !== 'string') return { ok: false, error: 'Write a message for the banner.' };
    const message = cleanText(body.message);
    if (!message) return { ok: false, error: 'Write a message for the banner.' };
    if (message.length > MAX_ANNOUNCEMENT_LENGTH) {
      return { ok: false, error: `Keep the message under ${MAX_ANNOUNCEMENT_LENGTH} characters.` };
    }
    out.message = message;
  }

  if (mode === 'create' || 'tone' in body) {
    const tone = body.tone ?? 'info';
    if (!isAnnouncementTone(tone)) return { ok: false, error: 'Choose a valid banner style.' };
    out.tone = tone;
  }

  if (mode === 'create' || 'linkUrl' in body) {
    const link = sanitizeLinkUrl(body.linkUrl);
    if (link === undefined) return { ok: false, error: 'Links must start with https:// or be a page on your site like /dashboard.' };
    out.linkUrl = link;
  }

  if (mode === 'create' || 'linkLabel' in body) {
    const raw = body.linkLabel;
    if (raw !== undefined && raw !== null && typeof raw !== 'string') return { ok: false, error: 'The link label must be text.' };
    const label = typeof raw === 'string' ? cleanText(raw) : '';
    if (label.length > MAX_LINK_LABEL_LENGTH) return { ok: false, error: `Keep the link label under ${MAX_LINK_LABEL_LENGTH} characters.` };
    out.linkLabel = label || null;
  }

  if (mode === 'create' || 'dismissible' in body) {
    const dismissible = body.dismissible ?? true;
    if (typeof dismissible !== 'boolean') return { ok: false, error: "We couldn't understand that request." };
    out.dismissible = dismissible;
  }

  // A label with no link (or a link with no label) is tidied rather than rejected
  if ('linkUrl' in out && out.linkUrl === null) out.linkLabel = null;
  if (mode === 'create') {
    const full: AnnouncementInput = {
      message: out.message ?? '',
      tone: out.tone ?? 'info',
      linkUrl: out.linkUrl ?? null,
      linkLabel: out.linkUrl ? out.linkLabel ?? 'Learn more' : null,
      dismissible: out.dismissible ?? true,
    };
    return { ok: true, value: full };
  }
  return { ok: true, value: out };
}

/** Maps a database row to the camelCase contract; returns null for malformed rows. */
export function toAnnouncement(row: unknown): Announcement | null {
  if (!isRecord(row)) return null;
  if (typeof row.id !== 'string' || typeof row.message !== 'string' || !isAnnouncementTone(row.tone)) return null;
  const created = typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString();
  return {
    id: row.id,
    message: row.message,
    tone: row.tone,
    linkUrl: typeof row.link_url === 'string' && row.link_url ? row.link_url : null,
    linkLabel: typeof row.link_label === 'string' && row.link_label ? row.link_label : null,
    dismissible: row.dismissible !== false,
    isActive: row.is_active === true,
    createdAt: created,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : created,
  };
}

export function toPublicAnnouncement(a: Announcement): PublicAnnouncement {
  return {
    id: a.id,
    message: a.message,
    tone: a.tone,
    linkUrl: a.linkUrl,
    linkLabel: a.linkLabel,
    dismissible: a.dismissible,
    updatedAt: a.updatedAt,
  };
}

export interface AnnouncementListResponse {
  announcements: Announcement[];
}

/* ---- Rotating banner (several banners can be live at once) ---------------------------------------- */

/** The public API returns at most this many live banners, so the rotation stays short and glanceable. */
export const MAX_LIVE_ANNOUNCEMENTS = 5;

export interface PublicAnnouncementsResponse {
  /** Every live banner, newest first (at most MAX_LIVE_ANNOUNCEMENTS) */
  announcements: PublicAnnouncement[];
  /** The newest live banner, kept so older clients that read a single banner keep working */
  announcement: PublicAnnouncement | null;
}

/** Identity of one banner *revision*: editing a banner changes its key, so it re-appears after a dismiss. */
export function announcementKey(a: Pick<PublicAnnouncement, 'id' | 'updatedAt'>): string {
  return `${a.id}:${a.updatedAt}`;
}

function isPublicAnnouncement(value: unknown): value is PublicAnnouncement {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.message === 'string' &&
    isAnnouncementTone(value.tone) &&
    typeof value.updatedAt === 'string'
  );
}

/** Reads the public API payload defensively. Accepts the new `announcements` array or the legacy single `announcement`. */
export function parsePublicAnnouncements(payload: unknown): PublicAnnouncement[] {
  if (!isRecord(payload)) return [];
  const raw: unknown[] = Array.isArray(payload.announcements) ? payload.announcements : payload.announcement ? [payload.announcement] : [];
  return raw
    .filter(isPublicAnnouncement)
    .map((a) => ({
      id: a.id,
      message: a.message,
      tone: a.tone,
      linkUrl: typeof a.linkUrl === 'string' && a.linkUrl ? a.linkUrl : null,
      linkLabel: typeof a.linkLabel === 'string' && a.linkLabel ? a.linkLabel : null,
      dismissible: a.dismissible !== false,
      updatedAt: a.updatedAt,
    }))
    .slice(0, MAX_LIVE_ANNOUNCEMENTS);
}

/** Drops the banners this visitor has dismissed. Banners that are not dismissible are always kept. */
export function visibleAnnouncements(items: PublicAnnouncement[], dismissedKeys: ReadonlySet<string>): PublicAnnouncement[] {
  return items.filter((a) => !a.dismissible || !dismissedKeys.has(announcementKey(a)));
}
