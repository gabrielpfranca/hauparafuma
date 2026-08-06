/**
 * TESTU REVIZADU — reviewed Tetun, applied over the built-in text at boot.
 *
 * The app ships with the text written into js/i18n.js and js/content/*.js. When
 * a native speaker corrects a string in the review tool, the correction lands
 * here as data and takes effect on the next load — no redeploy, because the
 * server's filesystem is ephemeral and rebuilding the app for a comma is not a
 * workable review loop.
 *
 * Two rules shape this module:
 *
 *  1. NEVER BLOCK THE FIRST PAINT. The cached overlay is applied synchronously
 *     from localStorage; the network copy is fetched afterwards and only
 *     triggers a repaint if it actually differs. Someone on a slow connection
 *     in Timor-Leste must not wait on this to see their screen.
 *  2. NEVER MAKE THINGS WORSE. Any failure — no server, bad JSON, unknown ids —
 *     leaves the built-in text exactly as it was. A translation overlay that
 *     breaks the app is worse than an unreviewed one.
 *
 * See tools/review/ for the reviewer's side and docs/translation-review.md.
 */

import { apply } from './textmap.js';

const KEY = 'hpf.text.v1';

/** Read the cached overlay. Never throws: bad cache is the same as no cache. */
function cached() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.text !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

function remember(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked (private mode). The overlay still applied for
    // this session; it will simply be re-fetched next time.
  }
}

/**
 * Apply whatever was cached from a previous run.
 * Synchronous by design — called before the first render.
 */
export function applyCached() {
  const data = cached();
  if (!data) return 0;
  return apply(data.text);
}

/**
 * Fetch the current overlay and apply it.
 *
 * Returns true only when something visibly changed, so the caller can repaint
 * without doing so on every boot.
 */
export async function refresh(origin) {
  if (typeof fetch !== 'function') return false;
  const base = origin || (typeof location !== 'undefined' ? location.origin : '');
  if (!base) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${base}/api/text`, { signal: controller.signal });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data || typeof data.text !== 'object') return false;

    const before = cached();
    // Nothing new: the reviewer has not touched anything since last time.
    if (before && before.version === data.version) return false;

    remember({ version: data.version, text: data.text });
    return apply(data.text) > 0 || Boolean(before);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
