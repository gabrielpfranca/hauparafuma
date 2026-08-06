/**
 * FERRAMENTA REVIZAUN — the Node side of the translation review.
 *
 * js/textmap.js says *what* text exists and how to address it. This module adds
 * everything the reviewer needs around each string but the app does not care
 * about: which screen it belongs to, which screenshot shows it, how urgent it is
 * to review, and a hash for detecting that the source changed underneath a
 * correction.
 *
 * Imported by the server (to serve the review list) and by the bake step.
 * No mutating side effects — importing this must not write or change anything
 * on disk. It does read two static files (the content modules, and the English
 * reference glosses below), the same as loading any other module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { entries, FILES, placeholders, validate } from '../app/js/textmap.js';

export { FILES, placeholders, validate };

/**
 * Short content hash. Detects that a string was edited in the source since a
 * correction was written against it — the bake step refuses those rather than
 * silently overwriting someone's newer work.
 */
export function hash(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex').slice(0, 12);
}

/* ------------------------------------------------------------------ */
/* Referénsia inglés — a reading aid, not a source of truth            */
/* ------------------------------------------------------------------ */

/**
 * A short English gloss of each Tetun string's *intended meaning*, shown next
 * to the Tetun in the review tool. The reviewer is fluent in Tetun — this is
 * not a translation for them to approve, it is a way to catch a string that
 * has drifted from what it was meant to say, and to disambiguate short labels
 * reused in more than one place ("Dada iis" as a tool title vs. as an SOS
 * button). Keyed by the same content hash used for staleness detection, so a
 * gloss silently stops showing (rather than showing something wrong) the
 * moment the Tetun it was written against changes.
 *
 * Optional by design: with no file present every `english` field is simply
 * null and the review tool hides that line.
 */
const ENGLISH_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'translation-en.json');

let englishCache = null;
function englishGlosses() {
  if (!englishCache) {
    try {
      englishCache = JSON.parse(fs.readFileSync(ENGLISH_FILE, 'utf8'));
    } catch {
      englishCache = {};
    }
  }
  return englishCache;
}

/* ------------------------------------------------------------------ */
/* Seksaun — where each string lives, for the reviewer                 */
/* ------------------------------------------------------------------ */

/**
 * Review priority, from docs/translation-review.md. Lower runs first, so that
 * someone who stops half way has already covered the text where a mistake has
 * a real-world cost.
 *
 *   1  clinical: referral, withdrawal, relapse, the SOS screen, health claims
 *   2  tone: the messages sent after someone admits smoking
 *   3  interface: buttons and labels, where a wrong word blocks the flow
 *   4  the 6-month programme
 *   5  the rest: quotes, badges, savings goals
 */
export const PRIORITY_LABEL = {
  1: 'Clinical & safety',
  2: 'Tone',
  3: 'Interface',
  4: '6-month programme',
  5: 'Other',
};

/**
 * Matched in order, first hit wins. `test` takes the id.
 * `screen` names a file in tests/screens/ when one shows this text.
 */
const SECTIONS = [
  /* ---- 1. clinical ---- */
  { test: /^services:/, priority: 1, name: 'Health services — where to get help', screen: '25-servisu.png',
    note: 'Someone reads this once they have decided to ask for help in person. A wrong name sends them to the wrong place.' },
  { test: /^i18n:svc\./, priority: 1, name: 'Health services — screen text', screen: '25-servisu.png' },
  { test: /^coping:withdrawal\./, priority: 1, name: 'Withdrawal symptoms', screen: '23-abstinensia.png' },
  { test: /^milestones:/, priority: 1, name: 'Health recovery timeline', screen: '16-saude.png',
    note: 'These are medical claims taken from WHO and CDC timelines. They have to stay accurate.' },
  { test: /^i18n:sos\./, priority: 1, name: 'SOS — the craving moment', screen: '14-sos.png' },
  { test: /^messages:relapse\./, priority: 1, name: 'Messages after a relapse', screen: '28-fila-fali.png',
    note: 'Nothing here may shame. This person has just smoked and told us so.' },
  { test: /^i18n:test\.(advice|level)/, priority: 1, name: 'Dependence test — result and advice', screen: '26-teste-rezultadu.png' },
  { test: /^i18n:health\./, priority: 1, name: 'Health screen', screen: '16-saude.png' },

  /* ---- 2. tone ---- */
  { test: /^messages:assessReply\./, priority: 2, name: 'Replies to the follow-up question', screen: '09-mensajen.png' },
  { test: /^i18n:me\.relapse\./, priority: 2, name: 'Relapse — profile screen', screen: '28-fila-fali.png' },
  { test: /^messages:coping\./, priority: 2, name: 'Messages sent during a craving', screen: '09-mensajen.png' },

  /* ---- 3. interface ---- */
  { test: /^i18n:ob\./, priority: 3, name: 'Sign-up (first run)', screen: '02-naran.png' },
  { test: /^i18n:home\./, priority: 3, name: 'Home screen', screen: '07-uma.png' },
  { test: /^i18n:msg\.send\./, priority: 3, name: 'What gets sent when a chip is tapped', screen: '09-mensajen.png',
    note: 'This is the person speaking, not a button label.' },
  { test: /^i18n:msg\./, priority: 3, name: 'Messages screen', screen: '09-mensajen.png' },
  { test: /^i18n:com\./, priority: 3, name: 'Community', screen: '10-komunidade.png' },
  { test: /^i18n:me\./, priority: 3, name: 'Profile screen', screen: '27-hau.png' },
  { test: /^i18n:tools\./, priority: 3, name: 'Tools', screen: '15-ferramenta.png' },
  { test: /^i18n:diary\./, priority: 3, name: 'Diary', screen: '20-diariu.png' },
  { test: /^i18n:game\./, priority: 3, name: 'Distraction game', screen: '12-jogu.png' },
  { test: /^i18n:money\./, priority: 3, name: 'Money saved', screen: '17-osan.png' },
  { test: /^i18n:breathe\./, priority: 3, name: 'Breathing pacer', screen: '18-dada-iis.png' },
  { test: /^i18n:plan\./, priority: 3, name: 'Emergency plan', screen: '21-planu.png' },
  { test: /^i18n:test\./, priority: 3, name: 'Dependence test', screen: '22-teste.png' },
  { test: /^i18n:(trig|wd)\./, priority: 3, name: 'Triggers and withdrawal — labels', screen: '19-gatilhu.png' },
  { test: /^i18n:badge\./, priority: 3, name: 'Achievements — labels', screen: '08-konkista.png' },
  { test: /^i18n:notif\./, priority: 3, name: 'Notifications', screen: '06-notifikasaun.png' },
  { test: /^i18n:tab\./, priority: 3, name: 'Navigation bar', screen: '07-uma.png' },
  { test: /^i18n:(month|weekday)\./, priority: 3, name: 'Months and weekdays' },
  { test: /^i18n:(unit|ago)\./, priority: 3, name: 'Time (durations and "ago")',
    note: '{n} is the number. It has to stay in the text.' },
  { test: /^i18n:reply\./, priority: 3, name: 'Automatic replies to a message', screen: '09-mensajen.png' },
  { test: /^i18n:/, priority: 3, name: 'General interface' },

  /* ---- 4. programme ---- */
  { test: /^messages:d-/, priority: 4, name: 'Programme — before quit day', screen: '09-mensajen.png' },
  { test: /^messages:d0\./, priority: 4, name: 'Programme — quit day', screen: '09-mensajen.png' },
  { test: /^messages:assess\./, priority: 4, name: 'Follow-up questions', screen: '09-mensajen.png' },
  { test: /^messages:/, priority: 4, name: '6-month programme', screen: '09-mensajen.png' },

  /* ---- 5. the rest ---- */
  { test: /^coping:reasons\./, priority: 5, name: 'Reasons for quitting', screen: '05-motivu.png' },
  { test: /^coping:triggers\./, priority: 5, name: 'Triggers and coping plans', screen: '19-gatilhu.png' },
  { test: /^coping:(doInstead|avoid)\./, priority: 5, name: 'Things to do instead, things to avoid', screen: '21-planu.png' },
  { test: /^badges:/, priority: 5, name: 'Achievements', screen: '08-konkista.png' },
  { test: /^quotes:/, priority: 5, name: 'Motivational lines', screen: '07-uma.png' },
  { test: /^rewards:/, priority: 5, name: 'Savings goals', screen: '17-osan.png' },
  { test: /^fagerstrom:/, priority: 5, name: 'Fagerström test — questions', screen: '22-teste.png' },
  { test: /^coping:/, priority: 5, name: 'Support content' },
];

const FALLBACK = { priority: 5, name: 'Other' };

function sectionFor(id) {
  return SECTIONS.find((s) => s.test.test(id)) || FALLBACK;
}

/**
 * Extra context for programme messages: which day and which time of day, so the
 * reviewer can picture when this arrives rather than reading it cold.
 */
function contextFor(id) {
  const m = /^messages:d(-?\d+)\.s(\d+)\.text$/.exec(id);
  if (!m) return null;
  const day = Number(m[1]);
  const slot = Number(m[2]);
  const when = ['morning', 'evening', 'midday', 'night'][slot] || `slot ${slot}`;
  if (day < 0) return `${Math.abs(day)} day${Math.abs(day) === 1 ? '' : 's'} before quit day, ${when}`;
  if (day === 0) return `Quit day, ${when}`;
  return `Day ${day}, ${when}`;
}

/* ------------------------------------------------------------------ */
/* Extract                                                             */
/* ------------------------------------------------------------------ */

/**
 * Every reviewable string, with everything the review UI needs.
 *
 * Sorted by review priority, then by id so the order is stable between calls —
 * a reviewer who comes back tomorrow finds the list where they left it.
 */
export function extract() {
  const out = entries().map((e) => {
    const source = e.get();
    const section = sectionFor(e.id);
    const h = hash(source);
    return {
      id: e.id,
      file: e.id.split(':')[0],
      source,
      hash: h,
      priority: section.priority,
      section: section.name,
      screen: section.screen || null,
      sectionNote: section.note || null,
      context: contextFor(e.id),
      placeholders: placeholders(source),
      english: englishGlosses()[h] || null,
    };
  });

  out.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  return out;
}

/** id -> unit, for validating a proposed change against the current source. */
export function byId() {
  return new Map(extract().map((u) => [u.id, u]));
}
