/**
 * MOTOR PROGRAMA — the WHO-aligned message scheduler.
 *
 * Responsibilities:
 *   1. work out which programme day/slot the person is on
 *   2. decide which scheduled messages are due but not yet delivered
 *   3. answer free-text replies (the handbook's two-way interaction)
 *
 * PURE MODULE — takes plain data, returns plain data. No DOM, no store import,
 * no timers. That keeps the scheduling rules unit-testable (tests/unit.mjs) and
 * reusable by a native port. The caller (js/app.js) owns persistence.
 */

import {
  SCHEDULE, ASSESS_DAYS, ASSESS, ASSESS_REPLY, MAINTAIN_POOL,
  COPING_POOL, RELAPSE_POOL, GRADUATE, explicitFor,
} from './content/messages.js';
import { daysBetween, MS } from './format.js';
import { t } from './i18n.js';

export const LAST_DAY = 180;

/* ------------------------------------------------------------------ */
/* Fase                                                                */
/* ------------------------------------------------------------------ */

/**
 * Programme day: 0 is quit day, negative is preparation.
 * Uses whole local days so a message due "on day 3" arrives on the calendar
 * day the person thinks of as day 3, not 24h after the exact quit timestamp.
 */
export function programmeDay(quitDate, now = Date.now()) {
  if (!quitDate) return null;
  return daysBetween(quitDate, now);
}

export function phaseFor(day) {
  if (day === null) return 'none';
  if (day < 0) return 'prequit';
  if (day === 0) return 'quitday';
  if (day <= 28) return 'early';
  if (day <= LAST_DAY) return 'maintain';
  return 'graduate';
}

/** i18n key for the phase label shown on the profile screen. */
export function phaseKey(day) {
  return `me.phase.${phaseFor(day)}`;
}

/** The SCHEDULE band covering `day`, or null outside the programme. */
export function bandFor(day) {
  if (day === null) return null;
  return SCHEDULE.find((b) => day >= b.fromDay && day <= b.toDay) || null;
}

/**
 * Is `day` a delivery day for its band? Bands with everyDays > 1 only fire on
 * every Nth day counted from the band start, so week 5–8 delivers on
 * 29, 31, 33… rather than every day.
 */
export function isDeliveryDay(day) {
  const band = bandFor(day);
  if (!band) return false;
  // Assessment days always deliver, even when the band's cadence would skip
  // them. Days 30, 90 and 180 all fall between delivery days in their bands
  // (every-2, then weekly from day 85), so without this the follow-up
  // questions the programme depends on would silently never be asked.
  if (ASSESS_DAYS.includes(day)) return true;
  if (band.everyDays <= 1) return true;
  return (day - band.fromDay) % band.everyDays === 0;
}

/** Slots defined for `day` (empty when it is not a delivery day). */
export function slotsFor(day) {
  const band = bandFor(day);
  if (!band || !isDeliveryDay(day)) return [];
  return band.slots;
}

/* ------------------------------------------------------------------ */
/* Seleksaun mensajen                                                  */
/* ------------------------------------------------------------------ */

/**
 * Deterministic index into a pool. Same (day, slot) always yields the same
 * message, so a re-render or a catch-up pass never silently swaps text, and
 * consecutive deliveries never land on the same pool entry.
 */
function poolIndex(day, slot, length) {
  if (length <= 0) return 0;
  // Multiply by a small prime so successive days stride through the pool
  // instead of walking it in order and re-showing themes in a block.
  const n = (day * 7 + slot * 3) % length;
  return (n + length) % length;
}

/**
 * The message for a given (day, slot), or null if nothing is scheduled there.
 * Order of precedence: assessment > authored message > maintenance pool.
 */
export function messageFor(day, slot) {
  if (day === null) return null;

  // Assessment days override the evening slot so the follow-up always lands.
  if (ASSESS_DAYS.includes(day) && ASSESS[day]) {
    const band = bandFor(day);
    const lastSlot = band ? band.slots[band.slots.length - 1] : 0;
    if (slot === lastSlot) {
      return {
        id: `assess:${day}`,
        day, slot,
        type: 'assess',
        text: ASSESS[day],
        quick: ['clean', 'smoked'],
        assessDay: day,
      };
    }
  }

  const explicit = explicitFor(day, slot);
  if (explicit) {
    return { id: `m:${day}:${slot}`, ...explicit };
  }

  if (day > 28 && day <= LAST_DAY) {
    const pick = MAINTAIN_POOL[poolIndex(day, slot, MAINTAIN_POOL.length)];
    return { id: `p:${day}:${slot}`, day, slot, ...pick };
  }

  return null;
}

/**
 * Every message due at `now` that is not already in `deliveredIds`.
 *
 * Walks back over the days since the programme started so that a phone that
 * was off for a week still receives what it missed, in order — the handbook's
 * programme only works if the sequence stays intact. Capped so a very stale
 * app does not dump hundreds of messages at once.
 */
export function due({ quitDate, startedAt = 0, deliveredIds = [], now = Date.now(), maxCatchUp = 12, slotTimes = {} }) {
  const today = programmeDay(quitDate, now);
  if (today === null) return [];

  const delivered = new Set(deliveredIds);
  const out = [];

  // Never look further back than the day the person actually registered.
  const firstDay = startedAt
    ? Math.max(SCHEDULE[0].fromDay, daysBetween(quitDate, startedAt))
    : SCHEDULE[0].fromDay;

  for (let day = firstDay; day <= Math.min(today, LAST_DAY); day++) {
    for (const slot of slotsFor(day)) {
      // Today's later slots are not due until their clock time passes.
      if (day === today && !slotReached(slot, now, slotTimes)) continue;
      const msg = messageFor(day, slot);
      if (!msg || delivered.has(msg.id)) continue;
      out.push(msg);
    }
  }

  // Graduation, once, after the programme ends.
  if (today > LAST_DAY && !delivered.has('graduate')) {
    out.push({ id: 'graduate', day: LAST_DAY + 1, slot: 0, ...GRADUATE });
  }

  // Keep the most recent when there is a big backlog: old motivation is less
  // useful than current, and a wall of unread messages is discouraging.
  return out.length > maxCatchUp ? out.slice(-maxCatchUp) : out;
}

/** Default clock time (minutes since midnight) for each slot. */
export const DEFAULT_SLOT_TIMES = { 0: 8 * 60, 1: 19 * 60, 2: 12 * 60, 3: 21 * 60 };

/** Has `slot`'s scheduled time passed today? */
export function slotReached(slot, now = Date.now(), slotTimes = {}) {
  const times = { ...DEFAULT_SLOT_TIMES, ...slotTimes };
  const at = times[slot] ?? 0;
  const d = new Date(now);
  return d.getHours() * 60 + d.getMinutes() >= at;
}

/**
 * When the next scheduled message is due, as a timestamp, or null if the
 * programme has finished. Used to arm notifications.
 */
export function nextDueAt({ quitDate, now = Date.now(), slotTimes = {} }) {
  if (!quitDate) return null;
  const times = { ...DEFAULT_SLOT_TIMES, ...slotTimes };
  const today = programmeDay(quitDate, now);
  if (today === null || today > LAST_DAY) return null;

  for (let day = Math.max(today, SCHEDULE[0].fromDay); day <= LAST_DAY; day++) {
    for (const slot of slotsFor(day)) {
      const at = midnightOfProgrammeDay(quitDate, day) + (times[slot] ?? 0) * MS.minute;
      if (at > now) return at;
    }
  }
  return null;
}

/** Local midnight of a programme day. */
export function midnightOfProgrammeDay(quitDate, day) {
  const d = new Date(quitDate);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + day);
  return d.getTime();
}

/* ------------------------------------------------------------------ */
/* Interasaun dalan rua — resposta ba liafuan                          */
/* ------------------------------------------------------------------ */

/**
 * Keyword table for two-way interaction. Tetun keywords, matched
 * case-insensitively and accent-insensitively anywhere in the reply, so
 * "hakarak fuma!!" and "HAKARAK" both work.
 *
 * Order matters: the first match wins, so relapse ("fuma tiha") is checked
 * before the generic craving keyword.
 */
export const KEYWORDS = [
  { intent: 'relapse',  words: ['fuma tiha', 'hau fuma', 'ha\'u fuma', 'fuma fali', 'fuma ona', 'smoked'] },
  { intent: 'craving',  words: ['hakarak', 'crave', 'vontade', 'hakarak fuma'] },
  { intent: 'help',     words: ['tulun', 'ajuda', 'help', 'sos', 'socorro'] },
  { intent: 'money',    words: ['osan', 'dolar', 'dinheiro', 'money'] },
  { intent: 'health',   words: ['saude', 'isin', 'pulmaun', 'health'] },
  { intent: 'game',     words: ['jogu', 'halimar', 'jogo', 'game'] },
  { intent: 'breathe',  words: ['dada iis', 'iis', 'respira', 'breathe'] },
  { intent: 'good',     words: ['diak', 'di\'ak', 'la fuma', 'bem', 'good', 'kontente'] },
  { intent: 'stop',     words: ['para programa', 'hapara', 'stop', 'sai'] },
];

/** Lowercase and strip diacritics so "saúde" matches "saude". */
function normalise(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectIntent(text) {
  const n = normalise(text);
  if (!n) return null;
  for (const { intent, words } of KEYWORDS) {
    for (const w of words) {
      if (n.includes(normalise(w))) return intent;
    }
  }
  return null;
}

/**
 * Reply to a free-text message.
 *
 * `ctx` carries the numbers needed to answer data questions
 * ({ saved, notSmoked, smokeFreeText, nextMilestone, cravingsBeaten, seed }).
 * Returns { text, action?, quick?, type, effect? } where `effect` tells the
 * caller to record something (a craving win, a relapse) — the engine stays
 * pure and never writes to the store itself.
 */
export function replyTo(text, ctx = {}) {
  const intent = detectIntent(text);
  const seed = Number.isFinite(ctx.seed) ? ctx.seed : Date.now();

  switch (intent) {
    case 'craving':
      return {
        type: 'coping',
        text: pickFrom(COPING_POOL, seed),
        action: 'sos',
        quick: ['won', 'game', 'breathe'],
      };

    case 'relapse':
      return {
        type: 'relapse',
        text: pickFrom(RELAPSE_POOL, seed),
        action: 'plan',
        quick: ['restart', 'keep'],
      };

    case 'help':
      return {
        type: 'coping',
        text: t('reply.help'),
        action: 'sos',
        quick: ['crave', 'breathe', 'game'],
      };

    case 'money':
      return {
        type: 'reward',
        text: ctx.saved !== undefined
          ? t('reply.money', { saved: ctx.saved, count: ctx.notSmoked })
          : t('reply.money.none'),
        action: 'money',
      };

    case 'health':
      return {
        type: 'benefit',
        text: ctx.smokeFreeText
          ? (ctx.nextMilestone
            ? t('reply.health.next', { time: ctx.smokeFreeText, next: ctx.nextMilestone })
            : t('reply.health', { time: ctx.smokeFreeText }))
          : t('reply.health.none'),
        action: 'health',
      };

    case 'game':
      return { type: 'coping', text: t('reply.game'), action: 'game' };

    case 'breathe':
      return { type: 'coping', text: t('reply.breathe'), action: 'breathe' };

    case 'good':
      return {
        type: 'motivation',
        text: t('reply.good'),
        action: 'community',
      };

    case 'stop':
      return {
        type: 'service',
        text: t('reply.stop'),
        action: 'me',
      };

    default:
      return {
        type: 'coping',
        text: t('reply.default'),
        quick: ['crave', 'help', 'money', 'health'],
      };
  }
}

/** Answer to an assessment tap. */
export function assessReply(answer) {
  return {
    type: answer === 'smoked' ? 'relapse' : 'motivation',
    text: answer === 'smoked' ? ASSESS_REPLY.smoked : ASSESS_REPLY.clean,
    action: answer === 'smoked' ? 'plan' : 'badges',
  };
}

function pickFrom(pool, seed) {
  if (!pool.length) return '';
  const i = Math.abs(Math.floor(seed / 1000)) % pool.length;
  return pool[i];
}

/** A coping line for the SOS sheet, varied per invocation. */
export function copingTip(seed = Date.now()) {
  return pickFrom(COPING_POOL, seed);
}
