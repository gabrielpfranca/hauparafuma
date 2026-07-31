/**
 * NOTIFIKASAUN.
 *
 * The handbook treats push/SMS delivery as core to the programme, not a
 * nice-to-have: the person should not have to remember to open the app. On the
 * web we get three layers, in descending reliability:
 *
 *   1. Web Push (works with the app closed) — only when the community server is
 *      configured with VAPID keys. Optional by design.
 *   2. Local notifications fired by an in-page timer — works while the app or
 *      its tab is alive.
 *   3. Catch-up on open — messages are always waiting in the inbox regardless,
 *      so nothing is ever lost if 1 and 2 both fail. This is the guarantee.
 *
 * Quiet hours are respected in all cases: someone quitting smoking needs sleep,
 * and waking them up at 03:00 would do more harm than the reminder is worth.
 */

import { t } from './i18n.js';

const SW_URL = 'sw.js';

let swReg = null;
let timer = null;

/* ------------------------------------------------------------------ */

export function supported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permission() {
  if (!supported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/** Register the service worker. Safe to call more than once. */
export async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    swReg = await navigator.serviceWorker.register(SW_URL, { scope: './' });
    return swReg;
  } catch (err) {
    // A failed SW registration must never block the app — it only costs offline
    // caching and background notifications.
    console.warn('[notif] service worker la rejistu:', err);
    return null;
  }
}

/**
 * Ask for permission. Call this from a user gesture (the onboarding button),
 * never on load: an unprompted permission dialog gets denied, and a denial is
 * sticky, which would cost the person the whole notification channel.
 */
export async function request() {
  if (!supported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/* ------------------------------------------------------------------ */
/* Oras hakmatek                                                       */
/* ------------------------------------------------------------------ */

/**
 * Is `now` inside the quiet window? Handles windows that wrap past midnight
 * (the common case: 22:00 → 06:00).
 */
export function isQuiet(settings, now = Date.now()) {
  const { quietFrom, quietTo } = settings;
  if (quietFrom === quietTo) return false; // zero-length window = disabled
  const d = new Date(now);
  const mins = d.getHours() * 60 + d.getMinutes();
  return quietFrom < quietTo
    ? mins >= quietFrom && mins < quietTo
    : mins >= quietFrom || mins < quietTo;
}

/** Next instant outside quiet hours (returns `now` when already outside). */
export function afterQuiet(settings, now = Date.now()) {
  if (!isQuiet(settings, now)) return now;
  const d = new Date(now);
  d.setHours(0, settings.quietTo, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/* ------------------------------------------------------------------ */
/* Haruka                                                              */
/* ------------------------------------------------------------------ */

/**
 * Show a notification now. Prefers the service worker registration, which is
 * the only path Android Chrome allows and which supports actions.
 */
export async function show(body, { title = t('notif.title.msg'), tag = 'hpf', url = '#/mensajen', silent = false } = {}) {
  if (permission() !== 'granted') return false;
  const options = {
    body,
    tag,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    lang: 'tet',
    silent,
    data: { url },
    requireInteraction: false,
  };
  try {
    const reg = swReg || (('serviceWorker' in navigator) ? await navigator.serviceWorker.getRegistration() : null);
    if (reg && reg.showNotification) {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch (err) {
    console.warn('[notif] la bele hatudu:', err);
    return false;
  }
}

export async function test() {
  return show(t('notif.test'), { tag: 'hpf-test' });
}

/* ------------------------------------------------------------------ */
/* Ajenda lokál                                                        */
/* ------------------------------------------------------------------ */

/**
 * Arm a single in-page timer for the next due message.
 *
 * One timer, re-armed each time it fires, rather than a timer per message:
 * setTimeout delays beyond ~24 days overflow, and holding hundreds of pending
 * timers wastes memory on a cheap phone.
 *
 * `onFire` is called when the moment arrives so the caller can deliver the
 * message into the thread and then re-arm.
 */
export function scheduleNext({ at, settings, onFire }) {
  cancel();
  if (!at || permission() !== 'granted' || !settings.notifications) return;

  const target = Math.max(at, afterQuiet(settings, at));
  const delay = target - Date.now();
  if (delay <= 0) {
    onFire();
    return;
  }
  // Cap a single wait at 6 hours, then re-check. Long timers get throttled or
  // dropped by mobile browsers, and re-checking is cheap.
  const wait = Math.min(delay, 6 * 60 * 60 * 1000);
  timer = setTimeout(() => {
    if (Date.now() >= target - 1000) onFire();
    else scheduleNext({ at: target, settings, onFire });
  }, wait);
}

export function cancel() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/* ------------------------------------------------------------------ */
/* Web Push (opsionál)                                                 */
/* ------------------------------------------------------------------ */

/**
 * Subscribe to Web Push against the community server.
 *
 * Entirely optional: without a server, or without VAPID keys on it, this is a
 * no-op and the app falls back to local notifications. It must never throw into
 * the caller — a push failure is not a reason to break onboarding.
 */
export async function subscribePush(apiBase, deviceId) {
  if (!apiBase || !swReg || !('PushManager' in window)) return null;
  if (permission() !== 'granted') return null;

  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/push/key`, { method: 'GET' });
    if (!res.ok) return null;
    const { publicKey } = await res.json();
    if (!publicKey) return null;

    const existing = await swReg.pushManager.getSubscription();
    const sub = existing || await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await fetch(`${apiBase.replace(/\/$/, '')}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId, subscription: sub.toJSON() }),
    });
    return sub;
  } catch (err) {
    console.warn('[notif] push la bele rejistu:', err);
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
