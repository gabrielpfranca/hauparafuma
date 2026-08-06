/**
 * Formatasaun (durasaun, osan, loron) iha Tetun.
 *
 * PURE MODULE — no DOM, no `window`, no imports from views. Everything here is
 * unit-tested in tests/unit.mjs and is the layer a React Native port reuses.
 *
 * Tetun word order puts the unit before the numeral ("loron 3", not "3 loron"),
 * and Tetun does not mark plurals on the noun, so "loron 1" and "loron 20" both
 * use the bare noun. That is why we do not do English-style pluralisation here.
 *
 * The words themselves come from js/i18n.js — see `unit.*` and `ago.*` — so the
 * translation review reaches them. Only the arithmetic lives here.
 */

import { t } from './i18n.js';

export const MS = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Month and weekday names live in js/i18n.js like every other visible word, so
 * a reviewed correction reaches them too. Read through a function rather than
 * captured into an array at module load, or an overlay applied at boot would
 * never be seen here.
 */
export const monthName = (i) => t(`month.${i}`);
export const weekdayName = (i) => t(`weekday.${i}`);

/** Split a millisecond span into whole d/h/m/s parts. */
export function splitDuration(ms) {
  const total = Math.max(0, Math.floor(ms));
  return {
    days: Math.floor(total / MS.day),
    hours: Math.floor((total % MS.day) / MS.hour),
    minutes: Math.floor((total % MS.hour) / MS.minute),
    seconds: Math.floor((total % MS.minute) / MS.second),
  };
}

/**
 * Human duration in Tetun, coarsest two units that carry information.
 * e.g. 3d 4h -> "loron 3, oras 4"; 40min -> "minutu 40"
 */
export function duration(ms) {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  const parts = [];
  if (days) parts.push(t('unit.day', { n: days }));
  if (hours) parts.push(t('unit.hour', { n: hours }));
  if (!days && minutes) parts.push(t('unit.minute', { n: minutes }));
  if (!days && !hours && !minutes) parts.push(t('unit.second', { n: seconds }));
  return parts.slice(0, 2).join(', ');
}

/** Coarse duration for headlines: only the single largest unit. */
export function durationShort(ms) {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const restMonths = Math.floor((days % 365) / 30);
    const y = t('unit.year', { n: years });
    return restMonths ? `${y}, ${t('unit.month', { n: restMonths })}` : y;
  }
  if (days >= 60) return t('unit.month', { n: Math.floor(days / 30) });
  if (days >= 14) return t('unit.week', { n: Math.floor(days / 7) });
  if (days) return t('unit.day', { n: days });
  if (hours) return t('unit.hour', { n: hours });
  if (minutes) return t('unit.minute', { n: minutes });
  return t('unit.second', { n: seconds });
}

/** mm:ss for timers and the minigame clock. */
export function clock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Money in USD, the currency of Timor-Leste. */
export function money(amount) {
  const n = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(n);
  // Big totals lose the cents — easier to read on a small screen.
  const digits = abs >= 1000 ? 0 : 2;
  return `$${n.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** Whole numbers with thousand separators. */
export function num(n) {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "15 Marsu 2026" */
export function date(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${monthName(d.getMonth())} ${d.getFullYear()}`;
}

/** "Kuarta, 15 Marsu" */
export function dateWithWeekday(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${weekdayName(d.getDay())}, ${d.getDate()} ${monthName(d.getMonth())}`;
}

/** "14:05" — 24h, which is how times are written in Timor-Leste. */
export function time(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Relative time for feed items: "oras ne'e", "minutu 5 liu ba", "horiseik". */
export function ago(input, now = Date.now()) {
  const ts = input instanceof Date ? input.getTime() : Number(input);
  if (!Number.isFinite(ts)) return '—';
  const diff = now - ts;
  if (diff < MS.minute) return t('ago.now');
  if (diff < MS.hour) return t('ago.minutes', { n: Math.floor(diff / MS.minute) });
  if (diff < MS.day) return t('ago.hours', { n: Math.floor(diff / MS.hour) });
  if (diff < 2 * MS.day) return t('ago.yesterday');
  if (diff < MS.week) return t('ago.days', { n: Math.floor(diff / MS.day) });
  return date(ts);
}

/** Local midnight of the given instant — the anchor for programme days. */
export function startOfDay(input) {
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whole local days between two instants (b - a), ignoring clock time. */
export function daysBetween(a, b) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / MS.day);
}

/** "YYYY-MM-DD" in local time, for <input type="date"> round-trips. */
export function isoDate(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Parse "YYYY-MM-DD" as local midnight (not UTC, which would shift the day). */
export function parseIsoDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse "HH:MM" into minutes since local midnight. */
export function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes since midnight -> "HH:MM". */
export function toHHMM(minutes) {
  const v = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/** Greeting key for the current hour, matching the i18n table. */
export function greetingKey(input = Date.now()) {
  const h = (input instanceof Date ? input : new Date(input)).getHours();
  if (h < 12) return 'home.greet.morning';
  if (h < 18) return 'home.greet.afternoon';
  return 'home.greet.evening';
}

/** Clamp helper used across the tracking maths. */
export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
