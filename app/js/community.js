/**
 * KOMUNIDADE — the shared feed where everyone can post.
 *
 * Two adapters behind one interface:
 *   - REST   : a real shared feed against server/server.js (settings.apiBase)
 *   - LOCAL  : device-only storage, used when no server is configured
 *
 * The app is honest about which one is active: in local mode it says so on
 * screen rather than pretending posts reached other people.
 *
 * Writes are optimistic and queued. Somebody who finally works up the courage
 * to post "ha'u fila fali fuma" on a bus with no signal must not lose that post;
 * it goes to an outbox and syncs later.
 */

import * as store from './store.js';

export const MAX_POST = 500;
export const MAX_REPLY = 300;
/** Reports needed before a post is hidden for everyone. */
export const HIDE_AT_REPORTS = 3;
/** Minimum gap between posts from one device. */
export const POST_COOLDOWN_MS = 30 * 1000;

export const TAGS = ['win', 'help', 'tip'];

/* ------------------------------------------------------------------ */
/* Validasaun                                                          */
/* ------------------------------------------------------------------ */

/**
 * Reject text carrying personal contact details. The community rules ask people
 * not to share phone numbers or addresses; this catches the common slip so a
 * moderator does not have to.
 *
 * Timor-Leste mobile numbers are 8 digits, often written +670 7xxx xxxx.
 */
const PHONE_RE = /(\+?670[\s-]?)?\d{3}[\s-]?\d{4,}/;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;

export function validate(text, max = MAX_POST) {
  const value = String(text || '').trim();
  if (!value) return { ok: false, reason: 'empty' };
  if (value.length > max) return { ok: false, reason: 'long', max };
  if (PHONE_RE.test(value) || EMAIL_RE.test(value) || URL_RE.test(value)) {
    return { ok: false, reason: 'blocked' };
  }
  return { ok: true, value };
}

export function canPostNow(now = Date.now()) {
  const last = store.get().community.lastPostAt || 0;
  return now - last >= POST_COOLDOWN_MS;
}

/* ------------------------------------------------------------------ */
/* Adaptadór                                                           */
/* ------------------------------------------------------------------ */

function clean(raw) {
  return String(raw || '').trim().replace(/\/+$/, '');
}

/**
 * Where the feed lives. Normally this is whatever `detectServer()` found — the
 * origin the app was served from. `settings.apiBase` is an override with no UI
 * (see store.js); it wins when set.
 */
function apiBase() {
  const s = store.get().settings;
  return clean(s.apiBase) || clean(s.apiDetected);
}

/** The resolved server, for callers outside this module (push subscription). */
export function serverBase() {
  return apiBase();
}

/**
 * Ask our own origin whether it also serves the API. When the app is deployed
 * alongside `server/server.js` this makes the community work with no setup at
 * all — the person never sees a server field.
 *
 * The result is persisted rather than probed fresh each time, because offline
 * the probe fails, and forgetting the server would drop the app to local mode:
 * posts would be written as local-only instead of being queued in the outbox,
 * which is exactly the post the outbox exists to protect.
 *
 * Returns true when the stored value changed, so the caller can repaint.
 */
export async function detectServer() {
  if (typeof location === 'undefined') return false;
  // A hand-configured server is a deliberate choice; don't second-guess it.
  if (clean(store.get().settings.apiBase)) return false;
  if (!/^https?:$/.test(location.protocol)) return false;

  const origin = clean(location.origin);
  const known = clean(store.get().settings.apiDetected);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${origin}/api/health`, { signal: controller.signal });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data || data.ok !== true) return false;
    if (known === origin) return false;
    store.update((s) => { s.settings.apiDetected = origin; }, 'settings');
    return true;
  } catch {
    // Offline, or this origin serves only static files. Keep what we knew.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function mode() {
  return apiBase() ? 'remote' : 'local';
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

async function api(path, { method = 'GET', body, timeout = 8000 } = {}) {
  const base = apiBase();
  if (!base) throw new Error('local');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Lee feed                                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch the feed. Always resolves — on failure it returns the local mirror so
 * the screen still has content offline.
 * `{ posts, mode, stale }`
 */
export async function feed() {
  const local = store.get().community.posts;

  if (mode() === 'local') return { posts: visible(local), mode: 'local', stale: false };

  try {
    const data = await api('/api/feed');
    const posts = Array.isArray(data.posts) ? data.posts : [];
    // Mirror for offline reads; cap so storage cannot grow unbounded.
    store.update((s) => {
      s.community.posts = posts.slice(0, 200);
    }, 'feed');
    return { posts: visible(posts), mode: 'remote', stale: false };
  } catch {
    return { posts: visible(local), mode: 'remote', stale: true };
  }
}

/** Hide posts that crossed the report threshold, and this device's own reports. */
function visible(posts) {
  const reported = new Set(store.get().community.reported);
  return posts.filter((p) => (p.reports || 0) < HIDE_AT_REPORTS && !reported.has(p.id));
}

/* ------------------------------------------------------------------ */
/* Publika                                                             */
/* ------------------------------------------------------------------ */

/**
 * Post to the feed. Returns { ok, queued, reason }.
 * Optimistically inserts locally so the person sees their words immediately.
 */
export async function post({ text, tag = 'win', badgeId = null }) {
  const check = validate(text, MAX_POST);
  if (!check.ok) return { ok: false, reason: check.reason, max: check.max };
  if (!canPostNow()) return { ok: false, reason: 'rate' };

  const s = store.get();
  const entry = {
    id: store.randomId('post'),
    deviceId: s.community.deviceId,
    name: s.profile.nickname || 'Belun',
    seed: s.profile.avatarSeed,
    text: check.value,
    tag: TAGS.includes(tag) ? tag : 'win',
    badgeId,
    days: daysSmokeFree(),
    at: Date.now(),
    replies: [],
    cheers: 0,
    reports: 0,
    mine: true,
  };

  store.update((st) => {
    st.community.posts.unshift(entry);
    st.community.lastPostAt = entry.at;
  }, 'post');

  if (mode() === 'local') return { ok: true, queued: false };

  try {
    const saved = await api('/api/posts', { method: 'POST', body: entry });
    if (saved && saved.post) replaceLocal(entry.id, { ...saved.post, mine: true });
    return { ok: true, queued: false };
  } catch {
    store.update((st) => {
      st.community.outbox.push({ kind: 'post', payload: entry });
      const mirror = st.community.posts.find((p) => p.id === entry.id);
      if (mirror) mirror.pending = true;
    }, 'outbox');
    return { ok: true, queued: true };
  }
}

export async function reply(postId, text) {
  const check = validate(text, MAX_REPLY);
  if (!check.ok) return { ok: false, reason: check.reason, max: check.max };

  const s = store.get();
  const entry = {
    id: store.randomId('rep'),
    postId,
    deviceId: s.community.deviceId,
    name: s.profile.nickname || 'Belun',
    seed: s.profile.avatarSeed,
    text: check.value,
    at: Date.now(),
    mine: true,
  };

  store.update((st) => {
    const p = st.community.posts.find((x) => x.id === postId);
    if (p) {
      p.replies = p.replies || [];
      p.replies.push(entry);
    }
  }, 'reply');

  if (mode() === 'local') return { ok: true, queued: false };

  try {
    await api(`/api/posts/${encodeURIComponent(postId)}/replies`, { method: 'POST', body: entry });
    return { ok: true, queued: false };
  } catch {
    store.update((st) => {
      st.community.outbox.push({ kind: 'reply', payload: entry });
      const p = st.community.posts.find((x) => x.id === postId);
      const r = p && (p.replies || []).find((x) => x.id === entry.id);
      if (r) r.pending = true;
    }, 'outbox');
    return { ok: true, queued: true };
  }
}

/** Cheer ("Fó forsa"). One per device per post, toggleable. */
export async function cheer(postId) {
  const s = store.get();
  const already = s.community.reacted.includes(postId);

  store.update((st) => {
    const p = st.community.posts.find((x) => x.id === postId);
    if (p) p.cheers = Math.max(0, (p.cheers || 0) + (already ? -1 : 1));
    st.community.reacted = already
      ? st.community.reacted.filter((id) => id !== postId)
      : [...st.community.reacted, postId];
  }, 'cheer');

  if (mode() === 'local') return { ok: true };

  try {
    await api(`/api/posts/${encodeURIComponent(postId)}/react`, {
      method: 'POST',
      body: { deviceId: s.community.deviceId, on: !already },
    });
    return { ok: true };
  } catch {
    store.update((st) => {
      st.community.outbox.push({ kind: 'cheer', payload: { postId, deviceId: s.community.deviceId, on: !already } });
    }, 'outbox');
    return { ok: true, queued: true };
  }
}

export async function report(postId) {
  const s = store.get();
  if (s.community.reported.includes(postId)) return { ok: true };

  store.update((st) => {
    st.community.reported.push(postId);
    const p = st.community.posts.find((x) => x.id === postId);
    if (p) p.reports = (p.reports || 0) + 1;
  }, 'report');

  if (mode() === 'local') return { ok: true };

  try {
    await api('/api/report', { method: 'POST', body: { postId, deviceId: s.community.deviceId } });
    return { ok: true };
  } catch {
    store.update((st) => {
      st.community.outbox.push({ kind: 'report', payload: { postId, deviceId: s.community.deviceId } });
    }, 'outbox');
    return { ok: true, queued: true };
  }
}

/* ------------------------------------------------------------------ */
/* Sync                                                                */
/* ------------------------------------------------------------------ */

/**
 * Flush the outbox. Called on load, on `online`, and when the community screen
 * opens. Items that fail stay queued; items rejected by the server (4xx) are
 * dropped, because retrying them forever would never succeed.
 */
export async function sync() {
  if (mode() === 'local' || !isOnline()) return { sent: 0, left: store.get().community.outbox.length };

  const queue = [...store.get().community.outbox];
  if (!queue.length) return { sent: 0, left: 0 };

  const remaining = [];
  let sent = 0;

  for (const item of queue) {
    try {
      if (item.kind === 'post') {
        await api('/api/posts', { method: 'POST', body: item.payload });
      } else if (item.kind === 'reply') {
        await api(`/api/posts/${encodeURIComponent(item.payload.postId)}/replies`, { method: 'POST', body: item.payload });
      } else if (item.kind === 'cheer') {
        await api(`/api/posts/${encodeURIComponent(item.payload.postId)}/react`, { method: 'POST', body: item.payload });
      } else if (item.kind === 'report') {
        await api('/api/report', { method: 'POST', body: item.payload });
      }
      sent++;
    } catch (err) {
      const msg = String(err && err.message);
      // Permanent rejection: drop it. Network/5xx: keep for the next attempt.
      if (/^http_4/.test(msg)) continue;
      remaining.push(item);
    }
  }

  store.update((st) => {
    st.community.outbox = remaining;
    for (const p of st.community.posts) {
      if (p.pending && !remaining.some((i) => i.kind === 'post' && i.payload.id === p.id)) delete p.pending;
      for (const r of p.replies || []) {
        if (r.pending && !remaining.some((i) => i.kind === 'reply' && i.payload.id === r.id)) delete r.pending;
      }
    }
  }, 'sync');

  return { sent, left: remaining.length };
}

/* ------------------------------------------------------------------ */

function replaceLocal(id, next) {
  store.update((st) => {
    const i = st.community.posts.findIndex((p) => p.id === id);
    if (i >= 0) st.community.posts[i] = { ...st.community.posts[i], ...next };
  }, 'post');
}

function daysSmokeFree() {
  const ms = store.smokeFreeMs();
  return Math.floor(ms / 86400000);
}

/** How many posts this device has authored — feeds the "Ita fahe" badge. */
export function myPostCount() {
  return store.get().community.posts.filter((p) => p.mine).length;
}
