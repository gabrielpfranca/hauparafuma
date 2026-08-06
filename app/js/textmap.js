/**
 * MAPA TEKSTU — every piece of user-visible text, addressable by a stable id.
 *
 * One definition, used by three things that must agree exactly:
 *   1. the app, to overlay reviewed text at boot (js/overrides.js)
 *   2. the review tool, to list what there is to review (tools/translation.mjs)
 *   3. the bake step, to write corrections back into the source files
 *
 * If the browser and the server disagreed about what `badges:b_1d.share` means,
 * a correction would land on the wrong string. They cannot disagree, because
 * this file is the only place the answer exists.
 *
 * PURE MODULE — no DOM, no `window`, no storage. Node imports it directly.
 *
 * Id format: `<file>:<path>`, e.g.
 *   i18n:sos.title            messages:d-7.s0.text     quotes:12
 *   badges:b_1d.share         coping:triggers.coffee.plan.0
 *   fagerstrom:q1.options.0.label
 */

import * as i18n from './i18n.js';
import * as messages from './content/messages.js';
import * as coping from './content/coping.js';
import * as milestones from './content/milestones.js';
import * as badges from './content/badges.js';
import * as quotes from './content/quotes.js';
import * as rewards from './content/rewards.js';
import * as fagerstrom from './content/fagerstrom.js';
import * as services from './content/services.js';

/* ------------------------------------------------------------------ */
/* Entry builders                                                      */
/* ------------------------------------------------------------------ */

/** One addressable string: how to read it and how to write it. */
const entry = (id, get, set) => ({ id, get, set });

/** `messages:` + `coping` -> `messages:coping`; `quotes:` + `3` -> `quotes:3`. */
const join = (prefix, ...parts) =>
  prefix + (prefix.endsWith(':') ? parts.join('.') : ['', ...parts].join('.'));

/** Array of plain strings: `prefix.0`, `prefix.1`, … */
function fromStrings(prefix, arr) {
  return arr.map((_, i) => entry(
    join(prefix, i),
    () => arr[i],
    (v) => { arr[i] = v; },
  ));
}

/** Object whose values are plain strings: `prefix.<key>`. */
function fromMap(prefix, obj) {
  return Object.keys(obj).map((k) => entry(
    join(prefix, k),
    () => obj[k],
    (v) => { obj[k] = v; },
  ));
}

/**
 * Array of records: `prefix.<key>.<field>`.
 *
 * `fields` accepts a plain field name, or `{ name, of }` for a nested array of
 * strings (`plan`), or `{ name, of, field }` for a nested array of records
 * (`options[].label`).
 */
function fromRecords(prefix, arr, keyOf, fields) {
  const out = [];
  arr.forEach((rec, i) => {
    const key = keyOf(rec, i);
    for (const f of fields) {
      if (typeof f === 'string') {
        if (typeof rec[f] !== 'string') continue;
        out.push(entry(join(prefix, key, f), () => rec[f], (v) => { rec[f] = v; }));
        continue;
      }
      const nested = rec[f.name];
      if (!Array.isArray(nested)) continue;
      nested.forEach((item, j) => {
        if (f.field) {
          if (typeof item[f.field] !== 'string') return;
          out.push(entry(
            join(prefix, key, f.name, j, f.field),
            () => item[f.field],
            (v) => { item[f.field] = v; },
          ));
        } else {
          if (typeof item !== 'string') return;
          out.push(entry(
            join(prefix, key, f.name, j),
            () => nested[j],
            (v) => { nested[j] = v; },
          ));
        }
      });
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* The map                                                             */
/* ------------------------------------------------------------------ */

/**
 * Which file each group belongs to — the bake step needs this to know which
 * source file to rewrite.
 */
export const FILES = {
  i18n: 'app/js/i18n.js',
  messages: 'app/js/content/messages.js',
  coping: 'app/js/content/coping.js',
  milestones: 'app/js/content/milestones.js',
  badges: 'app/js/content/badges.js',
  quotes: 'app/js/content/quotes.js',
  rewards: 'app/js/content/rewards.js',
  fagerstrom: 'app/js/content/fagerstrom.js',
  services: 'app/js/content/services.js',
};

/**
 * Build the full list of addressable strings.
 *
 * Rebuilt on each call rather than cached, because the setters close over the
 * live module objects and callers may have mutated them in between.
 */
export function entries() {
  const out = [];

  /* ---- interface ---- */
  const strings = i18n.rawStrings();
  for (const key of Object.keys(strings)) {
    out.push(entry(
      `i18n:${key}`,
      () => i18n.rawStrings()[key],
      (v) => { i18n.setStrings({ [key]: v }); },
    ));
  }

  /* ---- programme messages ---- */
  out.push(...fromRecords('messages:', messages.EXPLICIT,
    (m) => `d${m.day}.s${m.slot}`, ['text']));
  out.push(...fromRecords('messages:maintain', messages.MAINTAIN_POOL, (_, i) => i, ['text']));
  out.push(...fromStrings('messages:coping', messages.COPING_POOL));
  out.push(...fromStrings('messages:relapse', messages.RELAPSE_POOL));
  out.push(...fromMap('messages:assess', messages.ASSESS));
  out.push(...fromMap('messages:assessReply', messages.ASSESS_REPLY));
  out.push(entry('messages:graduate.text',
    () => messages.GRADUATE.text, (v) => { messages.GRADUATE.text = v; }));
  out.push(entry('messages:welcome.text',
    () => messages.WELCOME.text, (v) => { messages.WELCOME.text = v; }));

  /* ---- coping ---- */
  out.push(...fromRecords('coping:reasons', coping.REASONS, (r) => r.id, ['label']));
  out.push(...fromStrings('coping:doInstead', coping.DO_INSTEAD));
  out.push(...fromRecords('coping:triggers', coping.TRIGGERS, (r) => r.id,
    ['label', 'why', { name: 'plan' }]));
  out.push(...fromRecords('coping:withdrawal', coping.WITHDRAWAL, (r) => r.id,
    ['what', 'when', 'do']));
  out.push(...fromStrings('coping:avoid', coping.AVOID_SUGGESTIONS));

  /* ---- the rest ---- */
  out.push(...fromRecords('milestones:', milestones.MILESTONES, (r) => r.id,
    ['when', 'title', 'body']));
  out.push(...fromRecords('badges:', badges.BADGES, (r) => r.id,
    ['title', 'desc', 'share']));
  out.push(...fromStrings('quotes:', quotes.QUOTES));
  out.push(...fromRecords('rewards:', rewards.REWARDS, (r) => r.id, ['label']));
  out.push(...fromRecords('fagerstrom:', fagerstrom.QUESTIONS, (r) => r.id,
    ['text', { name: 'options', field: 'label' }]));
  out.push(...fromRecords('services:', services.FACILITIES, (r) => r.id, ['name', 'note']));

  return out;
}

/** Current text of every addressable string, as a plain id -> text object. */
export function collect() {
  const out = {};
  for (const e of entries()) out[e.id] = e.get();
  return out;
}

/**
 * Write an overlay of reviewed text over the built-in defaults.
 *
 * Unknown ids are ignored rather than thrown on: an overlay written by a newer
 * version of the app must never stop an older one from starting. Returns how
 * many were actually applied, so the caller can tell a working overlay from a
 * stale one.
 */
export function apply(overlay) {
  if (!overlay) return 0;
  const byId = new Map(entries().map((e) => [e.id, e]));
  let n = 0;
  for (const [id, value] of Object.entries(overlay)) {
    const e = byId.get(id);
    if (!e) continue;
    if (typeof value !== 'string' || !value) continue;
    e.set(value);
    n++;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** The `{n}`-style slots a string carries, sorted so order does not matter. */
export function placeholders(s) {
  return (String(s).match(/\{[a-z]+\}/gi) || []).sort();
}

export const MAX_LEN = 1200;

/**
 * Is `proposed` a safe replacement for `original`?
 *
 * Mechanical checks only — never a judgement about the Tetun, which is the
 * reviewer's job, not ours. This is what stops a correction from breaking the
 * app: a lost `{n}` renders as a missing number on someone's screen.
 */
export function validate(original, proposed) {
  const text = typeof proposed === 'string' ? proposed : '';
  if (!text.trim()) return { ok: false, error: 'mamuk' };
  if (text.length > MAX_LEN) return { ok: false, error: 'naruk_liu' };
  if (/<[a-z/][^>]*>/i.test(text)) return { ok: false, error: 'html' };

  const want = placeholders(original);
  const got = placeholders(text);
  if (want.join(',') !== got.join(',')) {
    return { ok: false, error: 'placeholder', expected: want, found: got };
  }
  return { ok: true };
}
