'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { AlertTriangle, ArrowRight, ChevronLeft, ChevronRight, Flame, Sparkles, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  announcementKey,
  parsePublicAnnouncements,
  visibleAnnouncements,
  type AnnouncementTone,
  type PublicAnnouncement,
} from '@/lib/adminAnnouncements';

/** Dismissed banner revisions, stored as a JSON array of `${id}:${updatedAt}` keys. */
const STORAGE_KEY = 'cultcrate:dismissed-announcements';
/** The single-banner version of this key. Still read so earlier dismissals are respected. */
const LEGACY_STORAGE_KEY = 'cultcrate:dismissed-announcement';

/** How long each announcement stays up before the bar cross-fades to the next (4–5s). */
const ROTATE_MS = 4500;
/** Long messages scroll instead of being cut off: speed in px/s, and the pause before/after the scroll. */
const TICKER_PX_PER_SEC = 45;
const TICKER_HOLD_MS = 1000;

interface ToneStyle {
  /** The high-contrast badge shown before the message. Derived from the banner's style, so no schema change is needed. */
  badge: string;
  badgeClass: string;
  BadgeIcon: LucideIcon;
  /** Soft accent line along the bottom edge */
  accent: string;
}

const TONES: Record<AnnouncementTone, ToneStyle> = {
  info: { badge: 'NEW', badgeClass: 'bg-white text-zinc-950', BadgeIcon: Sparkles, accent: 'via-zinc-400/40' },
  success: { badge: 'HOT', badgeClass: 'bg-[#4EDEAE] text-zinc-950', BadgeIcon: Flame, accent: 'via-[#4EDEAE]/50' },
  warning: { badge: 'NOTICE', badgeClass: 'bg-[#F59E0B] text-zinc-950', BadgeIcon: AlertTriangle, accent: 'via-[#F59E0B]/50' },
  critical: { badge: 'ALERT', badgeClass: 'bg-[#E50914] text-white', BadgeIcon: AlertTriangle, accent: 'via-[#E50914]/60' },
};

const NAV_BTN =
  'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30';

interface BarProps {
  items: PublicAnnouncement[];
  index: number;
  onNavigate: (index: number, direction: number) => void;
  onDismiss?: (item: PublicAnnouncement) => void;
  onPauseChange?: (paused: boolean) => void;
  paused?: boolean;
  /** A slide reports whether its message is wider than the bar (so it needs to scroll) */
  onOverflowChange?: (key: string, overflowing: boolean) => void;
  /** A scrolling slide finished its pass and is ready for the next announcement */
  onSlideDone?: (key: string) => void;
  /** Rendered as a rounded, self-contained strip (admin panel) instead of an edge-to-edge bar */
  preview?: boolean;
}

interface SlideProps {
  item: PublicAnnouncement;
  active: boolean;
  position: number;
  total: number;
  paused: boolean;
  /** Only one announcement: a long message ping-pongs forever. With several, it scrolls once and hands over. */
  loop: boolean;
  onOverflowChange?: (key: string, overflowing: boolean) => void;
  onSlideDone?: (key: string) => void;
}

/** One slide: badge + message + optional call to action. A message wider than the bar scrolls (ticker) instead of being cut off. */
function Slide({ item, active, position, total, paused, loop, onOverflowChange, onSlideDone }: SlideProps) {
  const key = announcementKey(item);
  const tone = TONES[item.tone];
  const external = item.linkUrl !== null && /^https:\/\//i.test(item.linkUrl);
  const label = item.linkLabel ?? 'Learn more';
  const ctaClass =
    'group inline-flex shrink-0 items-center gap-1 rounded-sm text-xs font-semibold text-white underline decoration-zinc-600 underline-offset-4 transition-colors hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30';
  const arrow = <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />;

  const viewport = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0); // px the text must travel to show its end; 0 = it fits
  const [playing, setPlaying] = useState(active);
  if (active && !playing) setPlaying(true); // becoming active starts the scroll (state adjusted during render, no effect needed)
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReported = useRef<boolean | null>(null);

  // Measure: does the message fit in the space the bar gives it? Re-checked on any resize (rotation, fonts, window).
  useLayoutEffect(() => {
    const vp = viewport.current;
    const tx = text.current;
    if (!vp || !tx) return;
    const measure = (): void => {
      const overflow = Math.ceil(tx.offsetWidth - vp.clientWidth);
      const next = overflow > 1 ? overflow : 0;
      setShift(next);
      const overflowing = next > 0;
      if (lastReported.current !== overflowing) {
        lastReported.current = overflowing;
        onOverflowChange?.(key, overflowing);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(tx);
    return () => ro.disconnect();
  }, [key, item.message, onOverflowChange]);

  // Start the scroll when the slide becomes active; keep it applied while the slide fades out so the text doesn't jump back.
  useEffect(() => {
    if (active) return;
    const t = setTimeout(() => setPlaying(false), 600);
    return () => clearTimeout(t);
  }, [active]);

  useEffect(
    () => () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    },
    []
  );
  useEffect(() => {
    if (!active && doneTimer.current) clearTimeout(doneTimer.current);
  }, [active]);

  const scrolling = shift > 0 && playing;
  const seconds = Math.max(1.5, shift / TICKER_PX_PER_SEC);
  const duration = loop ? Math.max(6, seconds / 0.76) : seconds;

  const onAnimationEnd = (): void => {
    if (loop || !active) return;
    if (doneTimer.current) clearTimeout(doneTimer.current);
    doneTimer.current = setTimeout(() => onSlideDone?.(key), TICKER_HOLD_MS);
  };

  return (
    <div
      role={total > 1 ? 'group' : undefined}
      aria-roledescription={total > 1 ? 'slide' : undefined}
      aria-label={total > 1 ? `${position} of ${total}` : undefined}
      aria-hidden={!active}
      // All slides share one grid cell; inactive ones fade out and become unfocusable (visibility), which gives a true cross-fade.
      className={`col-start-1 row-start-1 flex min-w-0 items-center justify-center gap-2.5 transition-[opacity,visibility] duration-500 ease-out motion-reduce:duration-0 ${
        active ? 'visible opacity-100' : 'invisible opacity-0'
      }`}
    >
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wider ${tone.badgeClass}`}
      >
        <tone.BadgeIcon className="h-2.5 w-2.5" aria-hidden="true" />
        {tone.badge}
      </span>

      {/* viewport: clips the moving text. Short text is centred (auto margins); long text starts at the left edge and scrolls. */}
      <div
        ref={viewport}
        className={`flex min-w-0 flex-1 overflow-hidden ${shift > 0 ? '[mask-image:linear-gradient(90deg,transparent,#000_10px,#000_calc(100%-10px),transparent)] motion-reduce:[mask-image:none]' : ''}`}
      >
        <span
          ref={text}
          onAnimationEnd={onAnimationEnd}
          style={scrolling ? ({ '--ticker-shift': `-${shift}px`, '--ticker-dur': `${duration}s` } as React.CSSProperties) : undefined}
          className={`mx-auto inline-block shrink-0 whitespace-nowrap px-3 text-[13px] font-medium leading-snug text-zinc-200 will-change-transform sm:text-sm motion-reduce:shrink motion-reduce:whitespace-normal motion-reduce:text-center ${
            scrolling ? (loop ? 'cc-ticker-loop' : 'cc-ticker-once') : ''
          } ${paused ? 'cc-ticker-paused' : ''}`}
        >
          {item.message}
        </span>
      </div>

      {item.linkUrl &&
        (external ? (
          <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" tabIndex={active ? 0 : -1} className={ctaClass}>
            {label}
            {arrow}
          </a>
        ) : (
          <Link href={item.linkUrl} tabIndex={active ? 0 : -1} className={ctaClass}>
            {label}
            {arrow}
          </Link>
        ))}
    </div>
  );
}

/** The bar itself. Pure: all state lives in the parent so the admin preview can reuse it. */
function AnnouncementBar({ items, index, onNavigate, onDismiss, onPauseChange, paused = false, onOverflowChange, onSlideDone, preview = false }: BarProps) {
  const count = items.length;
  const current = items[index] ?? items[0];
  if (!current) return null;

  const rotating = count > 1;
  const go = (step: number): void => onNavigate((index + step + count) % count, step);

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!rotating) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  };

  const onPanEnd = (_: unknown, info: PanInfo): void => {
    if (!rotating || Math.abs(info.offset.x) < 40 || Math.abs(info.offset.x) < Math.abs(info.offset.y)) return;
    go(info.offset.x < 0 ? 1 : -1);
  };

  return (
    <div
      role="region"
      aria-roledescription={rotating ? 'carousel' : undefined}
      aria-label="Announcements"
      onKeyDown={onKeyDown}
      // Pause rules, chosen so a phone can never get stuck paused:
      //  - mouse: pause while hovering (touch screens fake "mouseenter" on tap and never send "mouseleave", so mouse events are not used)
      //  - touch: pause only while a finger is held down, so a long message can be read
      //  - keyboard: pause only for keyboard focus (:focus-visible), not for the focus a tap leaves on a button
      onPointerEnter={(e) => e.pointerType === 'mouse' && onPauseChange?.(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onPauseChange?.(false)}
      onPointerDown={(e) => e.pointerType !== 'mouse' && onPauseChange?.(true)}
      onPointerUp={(e) => e.pointerType !== 'mouse' && onPauseChange?.(false)}
      onPointerCancel={(e) => e.pointerType !== 'mouse' && onPauseChange?.(false)}
      onFocus={(e) => e.target.matches(':focus-visible') && onPauseChange?.(true)}
      onBlur={() => onPauseChange?.(false)}
      className={`relative w-full bg-zinc-900/90 backdrop-blur-md ${preview ? 'rounded-lg border border-zinc-800' : 'border-b border-zinc-800'}`}
    >
      {/* centred message with the chevrons flanking it; padding reserves room for the dismiss button */}
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-1 px-10 py-2 sm:gap-2 sm:px-14 sm:py-2.5">
        {rotating && (
          <button type="button" onClick={() => go(-1)} aria-label="Previous announcement" className={NAV_BTN}>
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        <motion.div
          className="grid min-w-0 max-w-3xl flex-1 touch-pan-y grid-cols-[minmax(0,1fr)] items-center"
          onPanEnd={onPanEnd}
          aria-live={rotating ? 'off' : 'polite'}
          aria-atomic="true"
        >
          {items.map((item, i) => (
            <Slide
              key={announcementKey(item)}
              item={item}
              active={i === index}
              position={i + 1}
              total={count}
              paused={paused}
              loop={!rotating}
              onOverflowChange={onOverflowChange}
              onSlideDone={onSlideDone}
            />
          ))}
        </motion.div>

        {rotating && (
          <button type="button" onClick={() => go(1)} aria-label="Next announcement" className={NAV_BTN}>
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {current.dismissible && (
        <button
          type="button"
          onClick={() => onDismiss?.(current)}
          aria-label="Dismiss announcement"
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 sm:right-4"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* hairline accent in the current announcement's colour */}
      {!preview && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent to-transparent transition-colors duration-500 ${TONES[current.tone].accent}`}
        />
      )}
    </div>
  );
}

interface BannerViewProps {
  message: string;
  tone: AnnouncementTone;
  linkUrl: string | null;
  linkLabel: string | null;
  dismissible: boolean;
  onDismiss?: () => void;
  /** Admin panel: render as a rounded strip instead of an edge-to-edge bar */
  preview?: boolean;
}

/** One static banner, no rotation. Used by the admin panel's live preview and banner list. */
export function BannerView({ message, tone, linkUrl, linkLabel, dismissible, onDismiss, preview = false }: BannerViewProps) {
  const items = useMemo<PublicAnnouncement[]>(
    () => [{ id: 'preview', message, tone, linkUrl, linkLabel, dismissible, updatedAt: 'preview' }],
    [message, tone, linkUrl, linkLabel, dismissible]
  );
  return <AnnouncementBar items={items} index={0} onNavigate={() => undefined} onDismiss={onDismiss} preview={preview} />;
}

function readDismissed(): Set<string> {
  const out = new Set<string>();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) for (const k of parsed) if (typeof k === 'string') out.add(k);
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) out.add(legacy);
  } catch {
    /* storage unavailable or corrupt: treat as nothing dismissed */
  }
  return out;
}

function writeDismissed(keys: Set<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    /* private mode: it will simply show again next visit */
  }
}

/**
 * Sitewide announcement bar. Mounted once in app/layout.tsx, ABOVE the page, in normal document flow:
 * an edge-to-edge strip that pushes the page down, scrolls away with it, and never overlaps anything
 * (sticky page headers pin themselves to the top once it has scrolled past). Renders nothing unless an
 * admin has a banner switched on. With several live banners it cross-fades between them every few seconds
 * (paused on hover/focus) with chevrons for manual control. A message too long for the bar scrolls (ticker) instead of being cut off. A dismissed banner stays hidden until an admin edits it.
 */
export default function SiteAnnouncementBanner() {
  const reduce = useReducedMotion() ?? false;
  const [items, setItems] = useState<PublicAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // keys of slides whose message is too wide for the bar and therefore scrolls
  const [overflowKeys, setOverflowKeys] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/announcement');
        if (!res.ok) return;
        const found = parsePublicAnnouncements(await res.json());
        if (cancelled || found.length === 0) return;
        setDismissed(readDismissed());
        setItems(found);
      } catch {
        /* a banner is never worth an error */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => visibleAnnouncements(items, dismissed), [items, dismissed]);
  const count = visible.length;
  const safeIndex = count > 0 ? index % count : 0;

  const currentKey = visible[safeIndex] ? announcementKey(visible[safeIndex]) : null;
  const currentScrolls = currentKey !== null && overflowKeys.has(currentKey);

  // Auto-rotate after ROTATE_MS. A slide that scrolls is the exception: it holds until it has been read to the end (see onSlideDone).
  // Restarts after any manual navigation (index changes) and holds while hovered/focused.
  useEffect(() => {
    if (count < 2 || paused || currentScrolls) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [count, paused, index, currentScrolls]);

  // latest values for the stable onSlideDone callback (refs are updated in an effect, never during render)
  const pausedRef = useRef(paused);
  const currentKeyRef = useRef(currentKey);
  useEffect(() => {
    pausedRef.current = paused;
    currentKeyRef.current = currentKey;
  }, [paused, currentKey]);
  const onSlideDone = useCallback(
    (key: string): void => {
      if (pausedRef.current || currentKeyRef.current !== key) return;
      setIndex((i) => (count > 0 ? (i + 1) % count : 0));
    },
    [count]
  );
  const onOverflowChange = useCallback((key: string, overflowing: boolean): void => {
    setOverflowKeys((prev) => {
      if (prev.has(key) === overflowing) return prev;
      const next = new Set(prev);
      if (overflowing) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  // Don't burn through slides in a background tab.
  useEffect(() => {
    const onVisibility = (): void => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const navigate = useCallback((next: number): void => setIndex(next), []);

  const dismiss = (item: PublicAnnouncement): void => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(announcementKey(item));
      // keep storage tidy: only remember keys that still belong to a live banner
      const live = new Set(items.map(announcementKey));
      writeDismissed(new Set([...next].filter((k) => live.has(k))));
      return next;
    });
    setPaused(false);
  };

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="announcement-bar"
          // a plain in-flow block: height animates open/closed so the page eases down instead of jumping
          className="relative overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduce ? 0.01 : 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <AnnouncementBar
            items={visible}
            index={safeIndex}
            onNavigate={navigate}
            onDismiss={dismiss}
            onPauseChange={setPaused}
            paused={paused}
            onOverflowChange={onOverflowChange}
            onSlideDone={onSlideDone}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
