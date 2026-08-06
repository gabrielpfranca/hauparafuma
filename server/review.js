'use strict';

/**
 * REVIZAUN TRADUSAUN — the reviewer's side of the translation review.
 *
 * The app ships in Tetun that no native speaker has validated. This module lets
 * one reviewer correct it from a phone, with the corrections going live
 * immediately — no redeploy, no pull request, no programmer in the loop.
 *
 * Design decisions worth knowing before changing anything here:
 *
 *  - OFF BY DEFAULT. With no REVIEW_KEY set, every route below 404s. On a normal
 *    deployment this tool does not exist.
 *  - CORRECTIONS ARE DATA, not code. They live in DATA_DIR/review.json and are
 *    served to the app as an overlay (GET /api/text). The .js files stay the
 *    source of the defaults; tools/translation-bake.mjs folds the overlay back
 *    into them when it is time to make the corrections permanent.
 *  - EVERY CHANGE IS REVERSIBLE. There is no approval step before a correction
 *    goes live, so the safety net is behind it instead: full history, and a
 *    signed one-click revert link on every line of the digest email.
 *  - VALIDATION IS MECHANICAL, NEVER EDITORIAL. We check that `{n}` survived and
 *    that no HTML crept in. We never judge the Tetun — that is the whole point
 *    of having a native reviewer.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REVIEW_KEY = process.env.REVIEW_KEY || '';
const REVIEW_DIR = path.join(__dirname, '..', 'tools', 'review');
const SCREENS_DIR = path.join(__dirname, '..', 'tests', 'screens');

/** Minutes of quiet that end a review session and trigger the digest. */
const IDLE_MIN = Number(process.env.REVIEW_DIGEST_IDLE_MIN || 30);
/** Never sit on unreported changes longer than this, however busy the session. */
const MAX_HOLD_H = 24;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/* ------------------------------------------------------------------ */
/* Estadu                                                              */
/* ------------------------------------------------------------------ */

let DATA_DIR = '';
let FILE = '';
let state = null;

function blank() {
  return {
    version: 0,
    text: {},      // id -> reviewed text (the live overlay)
    status: {},    // id -> 'ok' | 'changed' | 'question'
    notes: {},     // id -> reviewer's note
    history: [],   // every change, oldest first
    sentUpTo: 0,   // history entries below this index are already in a digest
    lastEditAt: 0,
  };
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    state = { ...blank(), ...raw };
    state.text = state.text && typeof state.text === 'object' ? state.text : {};
    state.status = state.status && typeof state.status === 'object' ? state.status : {};
    state.notes = state.notes && typeof state.notes === 'object' ? state.notes : {};
    state.history = Array.isArray(state.history) ? state.history : [];
  } catch {
    state = blank();
  }
}

let writeQueued = false;
function save() {
  if (writeQueued) return;
  writeQueued = true;
  setTimeout(() => {
    writeQueued = false;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      // Temp file then rename: a crash mid-write must not leave a truncated
      // review behind. Losing an afternoon of a reviewer's work would be
      // unrecoverable — they are not going to remember what they typed.
      const tmp = `${FILE}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, FILE);
    } catch (err) {
      console.error('[revizaun] could not save:', err.message);
    }
  }, 100);
}

/* ------------------------------------------------------------------ */
/* Unidade sira (lazy — tools/translation.mjs is ESM)                  */
/* ------------------------------------------------------------------ */

let unitsPromise = null;

/**
 * The reviewable strings, loaded once.
 *
 * Note these are the *defaults* compiled into the app — deliberately not the
 * overlay. A correction is always shown against what the app originally said,
 * so a reviewer correcting their own earlier correction still sees where it
 * started from.
 */
function units() {
  if (!unitsPromise) {
    unitsPromise = import('../tools/translation.mjs').then((m) => ({
      list: m.extract(),
      byId: m.byId(),
      validate: m.validate,
      hash: m.hash,
    }));
  }
  return unitsPromise;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

function keyOk(given) {
  if (!REVIEW_KEY) return false;
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(REVIEW_KEY);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function authed(req, url) {
  return keyOk(req.headers['x-review-key'] || url.searchParams.get('key'));
}

/** Signs a revert link so an email can carry one safely. */
function signRevert(index) {
  return crypto.createHmac('sha256', REVIEW_KEY)
    .update(`revert:${index}`).digest('hex').slice(0, 24);
}

/* ------------------------------------------------------------------ */
/* Aplika mudansa                                                      */
/* ------------------------------------------------------------------ */

/**
 * Record one reviewer decision.
 *
 * `action` is 'change' (new text), 'ok' (the default text is fine as it is) or
 * 'question' (flagged with a note, text untouched). Returns an error string
 * rather than throwing: one bad entry in a batch must not discard the rest of
 * what the reviewer just typed.
 */
async function applyOne({ id, action, text, note }, u) {
  const unit = u.byId.get(id);
  if (!unit) return { id, error: 'la_iha' };

  if (action === 'ok' || action === 'question') {
    state.status[id] = action;
    if (note !== undefined) state.notes[id] = String(note).slice(0, 1000);
    // An 'ok' on a string that was previously corrected keeps the correction:
    // "this is fine" refers to what is on screen now.
    return { id, ok: true };
  }

  if (action !== 'change') return { id, error: 'asaun_sala' };

  const proposed = String(text == null ? '' : text);
  const verdict = u.validate(unit.source, proposed);
  if (!verdict.ok) return { id, error: verdict.error, expected: verdict.expected, found: verdict.found };

  const previous = state.text[id] !== undefined ? state.text[id] : unit.source;
  if (previous === proposed) {
    if (note !== undefined) state.notes[id] = String(note).slice(0, 1000);
    return { id, ok: true, unchanged: true };
  }

  state.text[id] = proposed;
  state.status[id] = 'changed';
  if (note !== undefined) state.notes[id] = String(note).slice(0, 1000);
  state.history.push({
    id,
    from: previous,
    to: proposed,
    at: Date.now(),
    note: note ? String(note).slice(0, 1000) : '',
    section: unit.section,
    priority: unit.priority,
  });
  return { id, ok: true };
}

/**
 * Undo one change, by its index in the history.
 *
 * Recorded as a new history entry rather than by deleting the old one: the
 * point of the log is that it tells the truth about what happened, including
 * the mistakes.
 */
async function revert(index) {
  const entry = state.history[index];
  if (!entry) return { error: 'la_iha' };
  const u = await units();
  const unit = u.byId.get(entry.id);
  const current = state.text[entry.id] !== undefined
    ? state.text[entry.id]
    : (unit ? unit.source : '');
  if (current === entry.from) return { ok: true, already: true, id: entry.id };

  if (unit && entry.from === unit.source) delete state.text[entry.id];
  else state.text[entry.id] = entry.from;

  state.status[entry.id] = 'changed';
  state.version++;
  state.history.push({
    id: entry.id,
    from: current,
    to: entry.from,
    at: Date.now(),
    note: 'Undone',
    section: entry.section,
    priority: entry.priority,
    revertOf: index,
  });
  save();
  return { ok: true, id: entry.id, to: entry.from };
}

/* ------------------------------------------------------------------ */
/* Digest                                                              */
/* ------------------------------------------------------------------ */

let mailer = null;
function getMailer() {
  if (!mailer) mailer = require('./mailer.js');
  return mailer;
}

/** Changes not yet reported. */
function pending() {
  return state.history.slice(state.sentUpTo);
}

/**
 * Is a digest due?
 *
 * Either the reviewer has stopped for a while (the session ended), or they have
 * been going long enough that waiting for silence would delay the report past
 * usefulness.
 */
function digestDue(now = Date.now()) {
  const list = pending();
  if (!list.length) return false;
  const quiet = now - state.lastEditAt >= IDLE_MIN * 60 * 1000;
  const held = now - list[0].at >= MAX_HOLD_H * 60 * 60 * 1000;
  return quiet || held;
}

let sending = false;

/**
 * Send the digest if one is due.
 *
 * Called from a timer and from the request handler — a container that sleeps
 * between requests may never fire the timer, and a container that gets no
 * requests has nothing to report anyway.
 *
 * The digest is only marked sent after the mail actually goes out, so a broken
 * SMTP config delays the report rather than losing it.
 */
async function tick(now = Date.now()) {
  if (sending || !digestDue(now)) return;
  sending = true;
  try {
    const list = pending();
    const upTo = state.history.length;
    const mail = getMailer();
    if (!mail.configured()) {
      console.log(`[revizaun] ${list.length} change(s) waiting to report — SMTP not configured`);
      return;
    }
    const { subject, html, text } = buildDigest(list);
    await mail.send({ subject, html, text });
    state.sentUpTo = upTo;
    save();
    console.log(`[revizaun] report sent: ${list.length} change(s)`);
  } catch (err) {
    // Keep sentUpTo where it is: the next tick tries again with the same batch.
    console.error('[revizaun] could not send report:', err.message);
  } finally {
    sending = false;
  }
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/**
 * Group a slice of history into sections, keeping each entry's real index in
 * `state.history` — that index is what the revert link and its signature are
 * built from, so it must survive the grouping.
 */
function groupBySection(list, offset) {
  const bySection = new Map();
  list.forEach((e, i) => {
    const k = e.section || 'Other';
    if (!bySection.has(k)) bySection.set(k, []);
    bySection.get(k).push({ e, index: offset + i });
  });
  return [...bySection.entries()].sort();
}

/** One change, as a card. `link` is pre-built by the caller (absolute for email, relative in-app). */
function changeCard(e, link) {
  return `
<div style="border:1px solid #e5e5e5;border-radius:8px;padding:12px;margin:8px 0">
  <div style="font:500 11px ui-monospace,monospace;color:#888;margin-bottom:6px">${esc(e.id)}</div>
  <div style="font:14px system-ui;color:#b00;text-decoration:line-through;margin-bottom:4px">${esc(e.from)}</div>
  <div style="font:14px system-ui;color:#060">${esc(e.to)}</div>
  ${e.note ? `<div style="font:italic 13px system-ui;color:#555;margin-top:8px;padding-left:10px;border-left:3px solid #ddd">${esc(e.note)}</div>` : ''}
  ${link ? `<div style="margin-top:10px"><a href="${link}" style="font:13px system-ui;color:#06c">↩ Undo this change</a></div>` : ''}
</div>`;
}

/** Render a group of history entries as cards, grouped by section. `linkFor` builds each revert link from its index. */
function cardsHtml(list, offset, linkFor) {
  return groupBySection(list, offset).map(([section, items]) => `
<h3 style="margin:26px 0 8px;font:600 15px system-ui;color:#111">${esc(section)}</h3>
${items.map(({ e, index }) => changeCard(e, linkFor(index))).join('')}`).join('');
}

function buildDigest(list) {
  const base = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  const n = list.length;
  const offset = state.sentUpTo;

  const plain = [];
  for (const [section, items] of groupBySection(list, offset)) {
    plain.push(`\n## ${section}\n`);
    for (const { e, index } of items) {
      const link = base ? `${base}/revizaun/fila/${index}-${signRevert(index)}` : '';
      plain.push(`- ${e.id}\n  WAS: ${e.from}\n  NOW: ${e.to}${e.note ? `\n  NOTE: ${e.note}` : ''}${link ? `\n  Undo: ${link}` : ''}`);
    }
  }
  const rows = cardsHtml(list, offset, (i) => (base ? `${base}/revizaun/fila/${i}-${signRevert(i)}` : ''));

  const when = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return {
    subject: `Tetun review — ${n} change${n === 1 ? '' : 's'}`,
    text: `Hau Para Fuma — translation review\n${n} change${n === 1 ? '' : 's'}, ${when} UTC\n${plain.join('\n')}\n`,
    html: `<div style="max-width:640px;margin:0 auto;padding:16px">
<h2 style="font:600 19px system-ui;margin:0 0 4px">Tetun review</h2>
<p style="font:14px system-ui;color:#555;margin:0 0 4px">
  <strong>${n}</strong> change${n === 1 ? '' : 's'} in the last session. All of them are already live in the app.
</p>
<p style="font:13px system-ui;color:#888;margin:0 0 18px">${when} UTC</p>
${rows}
<p style="font:12px system-ui;color:#999;margin-top:28px;border-top:1px solid #eee;padding-top:12px">
  To make these permanent in the source: <code>npm run review:bake</code>
</p></div>`,
  };
}

/**
 * The in-app report — a page you bookmark instead of an inbox to check.
 * No SMTP required: it reads the same history the email digest would have
 * used, so switching to (or back from) email later changes nothing else.
 */
function reportPage(key) {
  const qs = `?key=${encodeURIComponent(key)}`;
  const CAP = 300;

  const unseen = pending();
  const unseenOffset = state.sentUpTo;
  const seenAll = state.history.slice(0, state.sentUpTo);
  const truncated = seenAll.length > CAP;

  // Newest-first display means these items no longer sit at consecutive
  // indices counting up from an offset — index each one by its real position
  // in state.history instead of relying on the offset math cardsHtml uses for
  // the (still-chronological) unseen list. Entries are unique object
  // references (pushed once, never duplicated), so indexOf finds the right one.
  const seenIndexed = seenAll.slice(-CAP).reverse()
    .map((e) => ({ e, index: state.history.indexOf(e) }));
  const linkFor = (i) => `/revizaun/fila/${i}-${signRevert(i)}`;

  const unseenHtml = unseen.length
    ? cardsHtml(unseen, unseenOffset, linkFor)
    : '<p class="muted">No new changes since you last checked.</p>';

  const seenHtml = seenIndexed.length
    ? groupSectionsFromIndexed(seenIndexed, linkFor)
    : '<p class="muted">Nothing reviewed yet.</p>';

  return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Tetun review — report</title>
<style>
 body{font:16px/1.5 system-ui;max-width:40rem;margin:0 auto;padding:24px 16px 60px;color:#111;background:#fff}
 h1{font-size:19px;margin:0 0 4px} h2{font-size:16px;margin:30px 0 10px}
 .muted{color:#888;font-size:14px}
 form{margin:0 0 12px}
 button{font:inherit;padding:9px 18px;border:0;border-radius:8px;background:#111;color:#fff;cursor:pointer}
 @media(prefers-color-scheme:dark){body{background:#111;color:#eee}button{background:#eee;color:#111}}
</style>
<h1>Tetun review — report</h1>
<p class="muted">Every correction below is already live in the app. Undo any line to put the original text back.</p>

<h2>New since you last checked (${unseen.length})</h2>
${unseen.length ? `<form method="POST" action="/revizaun/relatoriu/dismiss${qs}"><button type="submit">Mark these as read</button></form>` : ''}
${unseenHtml}

<h2>Everything reviewed so far${truncated ? ` (most recent ${CAP})` : ''}</h2>
${seenHtml}

<p class="muted" style="margin-top:28px;border-top:1px solid #eee;padding-top:12px">
  To make these permanent in the source: <code>npm run review:bake</code>
</p>`;
}

/** Same rendering as `cardsHtml`, for a list whose items already carry their real index. */
function groupSectionsFromIndexed(items, linkFor) {
  const bySection = new Map();
  for (const it of items) {
    const k = it.e.section || 'Other';
    if (!bySection.has(k)) bySection.set(k, []);
    bySection.get(k).push(it);
  }
  return [...bySection.entries()].sort().map(([section, its]) => `
<h3 style="margin:26px 0 8px;font:600 15px system-ui;color:#111">${esc(section)}</h3>
${its.map(({ e, index }) => changeCard(e, linkFor(index))).join('')}`).join('');
}

/* ------------------------------------------------------------------ */
/* Rota sira                                                           */
/* ------------------------------------------------------------------ */

function html(res, status, body) {
  const buf = Buffer.from(body, 'utf8');
  res.writeHead(status, {
    'content-type': MIME['.html'],
    'content-length': buf.length,
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow',
  }).end(buf);
}

function serveFile(res, dir, name) {
  const target = path.join(dir, path.normalize(name).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(dir)) return false;
  let data;
  try {
    data = fs.readFileSync(target);
  } catch {
    return false;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow',
  }).end(data);
  return true;
}

/**
 * Handle a review request. Returns true if it took the request.
 *
 * `/api/text` is the exception to the REVIEW_KEY gate: it is what the app reads,
 * so it must answer for everyone. It is read-only and contains only text that is
 * already shipping inside the app.
 */
async function handle(req, url, res, send) {
  const route = url.pathname.replace(/\/+$/, '') || '/';

  if (route === '/api/text') {
    send(res, 200, { version: state.version, text: state.text });
    return true;
  }

  const isReview = route === '/revizaun' || route.startsWith('/revizaun/') || route.startsWith('/api/review/');
  if (!isReview) return false;

  // Without a key configured the whole tool is invisible, not merely locked.
  if (!REVIEW_KEY) {
    send(res, 404, { error: 'not_found' });
    return true;
  }

  /* ---- revert confirmation, opened from the digest email ---- */
  const revertMatch = /^\/revizaun\/fila\/(\d+)-([a-f0-9]{24})$/.exec(route);
  if (revertMatch) {
    const index = Number(revertMatch[1]);
    if (signRevert(index) !== revertMatch[2]) {
      html(res, 403, page('<p>That link is not valid.</p>'));
      return true;
    }
    const entry = state.history[index];
    if (!entry) {
      html(res, 404, page('<p>That change no longer exists.</p>'));
      return true;
    }
    if (req.method === 'POST') {
      const r = await revert(index);
      html(res, 200, page(r.error
        ? '<p>Could not undo that change.</p>'
        : `<p><strong>Undone.</strong> The app is back to:</p><p class="t good">${esc(entry.from)}</p>`));
      return true;
    }
    html(res, 200, page(`
      <h1>Undo this change?</h1>
      <p class="id">${esc(entry.id)}</p>
      <p class="lbl">Currently live (will be removed):</p><p class="t bad">${esc(entry.to)}</p>
      <p class="lbl">Will go back to:</p><p class="t good">${esc(entry.from)}</p>
      <form method="POST"><button type="submit">Yes, undo it</button></form>`));
    return true;
  }

  /* ---- the in-app report: bookmark this instead of waiting on an inbox ---- */
  if (route === '/revizaun/relatoriu') {
    if (!authed(req, url)) { html(res, 403, page('<p>Wrong key.</p>')); return true; }
    const givenKey = req.headers['x-review-key'] || url.searchParams.get('key') || '';
    html(res, 200, reportPage(givenKey));
    return true;
  }
  if (route === '/revizaun/relatoriu/dismiss') {
    if (!authed(req, url)) { send(res, 403, { error: 'xave_sala' }); return true; }
    if (req.method === 'POST') {
      state.sentUpTo = state.history.length;
      save();
    }
    const givenKey = url.searchParams.get('key') || '';
    res.writeHead(303, { location: `/revizaun/relatoriu?key=${encodeURIComponent(givenKey)}` }).end();
    return true;
  }

  /* ---- screenshots for context ---- */
  if (route.startsWith('/revizaun/screens/')) {
    if (!authed(req, url)) { send(res, 403, { error: 'forbidden' }); return true; }
    const name = route.slice('/revizaun/screens/'.length);
    if (!/^[\w.-]+\.png$/.test(name) || !serveFile(res, SCREENS_DIR, name)) {
      send(res, 404, { error: 'not_found' });
    }
    return true;
  }

  /* ---- the page itself ---- */
  if (route === '/revizaun') {
    if (!serveFile(res, REVIEW_DIR, 'index.html')) send(res, 404, { error: 'not_found' });
    return true;
  }
  if (/^\/revizaun\/[\w.-]+\.(css|js)$/.test(route)) {
    if (!serveFile(res, REVIEW_DIR, route.slice('/revizaun/'.length))) {
      send(res, 404, { error: 'not_found' });
    }
    return true;
  }

  /* ---- API ---- */
  if (!authed(req, url)) {
    send(res, 403, { error: 'xave_sala' });
    return true;
  }

  if (req.method === 'GET' && route === '/api/review/units') {
    const u = await units();
    send(res, 200, {
      units: u.list,
      text: state.text,
      status: state.status,
      notes: state.notes,
      version: state.version,
      changes: state.history.length,
    });
    return true;
  }

  if (req.method === 'POST' && route === '/api/review/save') {
    const body = await readJson(req);
    const list = Array.isArray(body.changes) ? body.changes.slice(0, 200) : [];
    const u = await units();
    const results = [];
    let changed = 0;
    for (const item of list) {
      const r = await applyOne(item || {}, u);
      if (r.ok && !r.unchanged) changed++;
      results.push(r);
    }
    if (changed) {
      state.version++;
      state.lastEditAt = Date.now();
    }
    save();
    send(res, 200, { ok: true, results, version: state.version });
    return true;
  }

  if (req.method === 'GET' && route === '/api/review/history') {
    send(res, 200, { history: state.history, sentUpTo: state.sentUpTo });
    return true;
  }

  send(res, 404, { error: 'not_found' });
  return true;
}

function page(inner) {
  return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Tetun review</title>
<style>
 body{font:16px/1.5 system-ui;max-width:32rem;margin:0 auto;padding:24px;color:#111;background:#fff}
 h1{font-size:19px} .id{font:12px ui-monospace,monospace;color:#888}
 .lbl{font-size:13px;color:#666;margin-bottom:2px}
 .t{padding:10px;border-radius:8px;background:#f4f4f4;margin:0 0 14px}
 .bad{background:#fdecec} .good{background:#eaf6ea}
 button{font:inherit;padding:10px 18px;border:0;border-radius:8px;background:#111;color:#fff}
 @media(prefers-color-scheme:dark){body{background:#111;color:#eee}.t{background:#222}
  .bad{background:#3a1c1c}.good{background:#17301a}button{background:#eee;color:#111}}
</style>${inner}`;
}

function readJson(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('bad_json')); }
    });
    req.on('error', reject);
  });
}

/* ------------------------------------------------------------------ */

function init(dataDir) {
  DATA_DIR = dataDir;
  FILE = path.join(dataDir, 'review.json');
  load();
  if (REVIEW_KEY) {
    console.log('[revizaun] review tool available at /revizaun');
    if (getMailer().configured()) {
      setInterval(() => { tick().catch(() => {}); }, 5 * 60 * 1000).unref();
    } else {
      console.log('[revizaun] no SMTP set — check /revizaun/relatoriu for the report instead of email');
    }
  }
}

module.exports = { init, handle, tick, enabled: () => Boolean(REVIEW_KEY) };
