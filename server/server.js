#!/usr/bin/env node
/**
 * SERVIDÓR KOMUNIDADE — shared feed + optional Web Push.
 *
 * Zero required dependencies: `node server/server.js` runs it. That matters for
 * a deployment in a ministry or clinic where installing an npm tree may not be
 * practical. `web-push` is loaded lazily and is entirely optional; without it
 * the feed still works and push is skipped.
 *
 * Storage is a JSON file, written atomically. Adequate for a pilot of a few
 * thousand posts; swap `readDB`/`writeDB` for a real database before scaling.
 *
 * Usage:
 *   node server/server.js
 *   PORT=8081 DATA_DIR=./data node server/server.js
 *   VAPID_PUBLIC=… VAPID_PRIVATE=… VAPID_SUBJECT=mailto:you@example.org node server/server.js
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8081);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'community.json');

const MAX_POST = 500;
const MAX_REPLY = 300;
const MAX_NAME = 24;
const HIDE_AT_REPORTS = 3;
const FEED_LIMIT = 100;
const POST_COOLDOWN_MS = 30 * 1000;
/** Requests per minute per IP, across all endpoints. */
const RATE_LIMIT = 60;

/* ------------------------------------------------------------------ */
/* Rai dadus                                                           */
/* ------------------------------------------------------------------ */

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = { posts: [], subs: [], version: 1 };

function readDB() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    db.posts = Array.isArray(db.posts) ? db.posts : [];
    db.subs = Array.isArray(db.subs) ? db.subs : [];
  } catch {
    db = { posts: [], subs: [], version: 1 };
  }
}

let writeQueued = false;
function writeDB() {
  if (writeQueued) return;
  writeQueued = true;
  setTimeout(() => {
    writeQueued = false;
    try {
      ensureDir();
      // Write to a temp file then rename, so a crash mid-write cannot leave a
      // truncated database behind.
      const tmp = `${DB_FILE}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('[server] la bele rai dadus:', err.message);
    }
  }, 100);
}

/* ------------------------------------------------------------------ */
/* Validasaun                                                          */
/* ------------------------------------------------------------------ */

const PHONE_RE = /(\+?670[\s-]?)?\d{3}[\s-]?\d{4,}/;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;

/**
 * Server-side validation mirrors the client's, because the client is not a
 * trust boundary — anyone can POST to this endpoint directly.
 */
function cleanText(raw, max) {
  const value = String(raw ?? '').replace(/\r/g, '').trim();
  if (!value) return { ok: false, error: 'empty' };
  if (value.length > max) return { ok: false, error: 'too_long' };
  if (PHONE_RE.test(value) || EMAIL_RE.test(value) || URL_RE.test(value)) {
    return { ok: false, error: 'personal_info' };
  }
  return { ok: true, value };
}

function cleanName(raw) {
  const value = String(raw ?? '').trim().slice(0, MAX_NAME);
  return value || 'Belun';
}

function cleanId(raw) {
  const value = String(raw ?? '');
  return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}

const TAGS = new Set(['win', 'help', 'tip']);

/* ------------------------------------------------------------------ */
/* Rate limit                                                          */
/* ------------------------------------------------------------------ */

const hits = new Map(); // ip -> { count, resetAt }

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// Keep the map from growing without bound.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) if (now > entry.resetAt) hits.delete(ip);
}, 60_000).unref();

/* ------------------------------------------------------------------ */
/* Web Push (opsionál)                                                 */
/* ------------------------------------------------------------------ */

let webpush = null;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.org';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    // eslint-disable-next-line global-require
    webpush = require('web-push');
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    console.log('[server] Web Push aktivu.');
  } catch {
    console.log('[server] VAPID iha, maibé "web-push" laiha instala. Push la funsiona. Halo: npm install web-push');
  }
} else {
  console.log('[server] Push la konfigura (VAPID_PUBLIC/VAPID_PRIVATE laiha). Feed nafatin funsiona.');
}

async function pushToAll(payload, exceptDeviceId) {
  if (!webpush) return;
  const body = JSON.stringify(payload);
  const dead = [];
  await Promise.all(db.subs.map(async (row) => {
    if (exceptDeviceId && row.deviceId === exceptDeviceId) return;
    try {
      await webpush.sendNotification(row.subscription, body);
    } catch (err) {
      // 404/410 mean the subscription is gone for good.
      if (err && (err.statusCode === 404 || err.statusCode === 410)) dead.push(row.deviceId);
    }
  }));
  if (dead.length) {
    db.subs = db.subs.filter((row) => !dead.includes(row.deviceId));
    writeDB();
  }
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('bad_json'));
      }
    });
    req.on('error', reject);
  });
}

/** What the client is allowed to see: never other people's device ids. */
function publicPost(post) {
  return {
    id: post.id,
    name: post.name,
    seed: post.seed,
    text: post.text,
    tag: post.tag,
    badgeId: post.badgeId,
    days: post.days,
    at: post.at,
    cheers: post.cheerDevices ? post.cheerDevices.length : 0,
    reports: post.reportDevices ? post.reportDevices.length : 0,
    replies: (post.replies || []).map((r) => ({
      id: r.id, name: r.name, seed: r.seed, text: r.text, at: r.at,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket.remoteAddress || 'unknown';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    });
    res.end();
    return;
  }

  if (rateLimited(ip)) {
    send(res, 429, { error: 'rate_limited' });
    return;
  }

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    send(res, 400, { error: 'bad_url' });
    return;
  }
  const route = url.pathname.replace(/\/+$/, '') || '/';

  try {
    /* ---- health ---- */
    if (req.method === 'GET' && route === '/api/health') {
      send(res, 200, { ok: true, posts: db.posts.length, push: Boolean(webpush) });
      return;
    }

    /* ---- feed ---- */
    if (req.method === 'GET' && route === '/api/feed') {
      const posts = db.posts
        .filter((p) => (p.reportDevices || []).length < HIDE_AT_REPORTS)
        .slice(0, FEED_LIMIT)
        .map(publicPost);
      send(res, 200, { posts });
      return;
    }

    /* ---- create post ---- */
    if (req.method === 'POST' && route === '/api/posts') {
      const body = await readBody(req);
      const deviceId = cleanId(body.deviceId);
      if (!deviceId) {
        send(res, 400, { error: 'bad_device' });
        return;
      }

      const text = cleanText(body.text, MAX_POST);
      if (!text.ok) {
        send(res, 400, { error: text.error });
        return;
      }

      // Idempotent: the client retries queued posts after being offline, and
      // must not end up posting the same thing twice.
      const clientId = cleanId(body.id);
      if (clientId && db.posts.some((p) => p.id === clientId)) {
        send(res, 200, { post: publicPost(db.posts.find((p) => p.id === clientId)) });
        return;
      }

      const last = db.posts.find((p) => p.deviceId === deviceId);
      if (last && Date.now() - last.at < POST_COOLDOWN_MS) {
        send(res, 429, { error: 'cooldown' });
        return;
      }

      const post = {
        id: clientId || crypto.randomUUID(),
        deviceId,
        name: cleanName(body.name),
        seed: Number.isFinite(Number(body.seed)) ? Number(body.seed) % 360 : 0,
        text: text.value,
        tag: TAGS.has(body.tag) ? body.tag : 'win',
        badgeId: typeof body.badgeId === 'string' ? body.badgeId.slice(0, 32) : null,
        days: Number.isFinite(Number(body.days)) ? Math.max(0, Math.floor(Number(body.days))) : 0,
        at: Date.now(),
        replies: [],
        cheerDevices: [],
        reportDevices: [],
      };

      db.posts.unshift(post);
      if (db.posts.length > 2000) db.posts.length = 2000;
      writeDB();

      // Notify the community, but never the author about their own post.
      pushToAll({
        title: 'Hau Para Fuma',
        body: `${post.name}: ${post.text.slice(0, 90)}`,
        url: '#/komunidade',
        tag: 'hpf-community',
      }, deviceId).catch(() => {});

      send(res, 201, { post: publicPost(post) });
      return;
    }

    /* ---- reply ---- */
    const replyMatch = /^\/api\/posts\/([A-Za-z0-9_-]{1,64})\/replies$/.exec(route);
    if (req.method === 'POST' && replyMatch) {
      const body = await readBody(req);
      const deviceId = cleanId(body.deviceId);
      const post = db.posts.find((p) => p.id === replyMatch[1]);
      if (!post) {
        send(res, 404, { error: 'no_post' });
        return;
      }
      if (!deviceId) {
        send(res, 400, { error: 'bad_device' });
        return;
      }

      const text = cleanText(body.text, MAX_REPLY);
      if (!text.ok) {
        send(res, 400, { error: text.error });
        return;
      }

      const clientId = cleanId(body.id);
      post.replies = post.replies || [];
      if (clientId && post.replies.some((r) => r.id === clientId)) {
        send(res, 200, { ok: true });
        return;
      }

      post.replies.push({
        id: clientId || crypto.randomUUID(),
        deviceId,
        name: cleanName(body.name),
        seed: Number.isFinite(Number(body.seed)) ? Number(body.seed) % 360 : 0,
        text: text.value,
        at: Date.now(),
      });
      if (post.replies.length > 200) post.replies.splice(0, post.replies.length - 200);
      writeDB();
      send(res, 201, { ok: true });
      return;
    }

    /* ---- cheer ---- */
    const reactMatch = /^\/api\/posts\/([A-Za-z0-9_-]{1,64})\/react$/.exec(route);
    if (req.method === 'POST' && reactMatch) {
      const body = await readBody(req);
      const deviceId = cleanId(body.deviceId);
      const post = db.posts.find((p) => p.id === reactMatch[1]);
      if (!post) {
        send(res, 404, { error: 'no_post' });
        return;
      }
      if (!deviceId) {
        send(res, 400, { error: 'bad_device' });
        return;
      }

      post.cheerDevices = post.cheerDevices || [];
      const has = post.cheerDevices.includes(deviceId);
      const on = body.on === undefined ? !has : Boolean(body.on);
      if (on && !has) post.cheerDevices.push(deviceId);
      if (!on && has) post.cheerDevices = post.cheerDevices.filter((d) => d !== deviceId);
      writeDB();
      send(res, 200, { cheers: post.cheerDevices.length });
      return;
    }

    /* ---- report ---- */
    if (req.method === 'POST' && route === '/api/report') {
      const body = await readBody(req);
      const deviceId = cleanId(body.deviceId);
      const post = db.posts.find((p) => p.id === body.postId);
      if (!post) {
        send(res, 404, { error: 'no_post' });
        return;
      }
      if (!deviceId) {
        send(res, 400, { error: 'bad_device' });
        return;
      }

      post.reportDevices = post.reportDevices || [];
      if (!post.reportDevices.includes(deviceId)) post.reportDevices.push(deviceId);
      writeDB();

      if (post.reportDevices.length >= HIDE_AT_REPORTS) {
        console.log(`[server] post subar tiha (denúnsia ${post.reportDevices.length}): ${post.id}`);
      }
      send(res, 200, { reports: post.reportDevices.length });
      return;
    }

    /* ---- push ---- */
    if (req.method === 'GET' && route === '/api/push/key') {
      send(res, 200, { publicKey: webpush ? VAPID_PUBLIC : null });
      return;
    }

    if (req.method === 'POST' && route === '/api/push/subscribe') {
      const body = await readBody(req);
      const deviceId = cleanId(body.deviceId);
      if (!deviceId || !body.subscription || !body.subscription.endpoint) {
        send(res, 400, { error: 'bad_subscription' });
        return;
      }
      db.subs = db.subs.filter((row) => row.deviceId !== deviceId);
      db.subs.push({ deviceId, subscription: body.subscription, at: Date.now() });
      writeDB();
      send(res, 201, { ok: true });
      return;
    }

    /* ---- moderation: hide a post by id (operator use, localhost only) ---- */
    if (req.method === 'POST' && route === '/api/admin/hide') {
      const local = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
      if (!local) {
        send(res, 403, { error: 'forbidden' });
        return;
      }
      const body = await readBody(req);
      const post = db.posts.find((p) => p.id === body.postId);
      if (!post) {
        send(res, 404, { error: 'no_post' });
        return;
      }
      post.reportDevices = new Array(HIDE_AT_REPORTS).fill('moderator');
      writeDB();
      send(res, 200, { ok: true });
      return;
    }

    send(res, 404, { error: 'not_found' });
  } catch (err) {
    const message = String(err && err.message);
    if (message === 'bad_json' || message === 'too_large') {
      send(res, 400, { error: message });
      return;
    }
    console.error('[server] sala:', err);
    send(res, 500, { error: 'server_error' });
  }
});

readDB();
server.listen(PORT, HOST, () => {
  console.log(`[server] Hau Para Fuma — servidór komunidade iha http://${HOST}:${PORT}`);
  console.log(`[server] dadus: ${DB_FILE}`);
});

process.on('SIGINT', () => {
  console.log('\n[server] taka…');
  server.close(() => process.exit(0));
});
