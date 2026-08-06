/* Service worker — offline-first cache + notification handling.
 *
 * Offline is not an edge case here: mobile data in Timor-Leste is expensive and
 * patchy, and someone fighting a craving on a bus with no signal still needs the
 * game, the breathing pacer and their reasons list. So the whole app shell is
 * precached and served cache-first; only the community API goes to the network.
 */

const VERSION = 'hpf-v2';
const SHELL = `${VERSION}-shell`;

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/i18n.js',
  'js/store.js',
  'js/format.js',
  'js/programme.js',
  'js/notifications.js',
  'js/community.js',
  'js/game.js',
  'js/ui.js',
  'js/tracking.js',
  'js/textmap.js',
  'js/overrides.js',
  'js/content/messages.js',
  'js/content/services.js',
  'js/content/milestones.js',
  'js/content/quotes.js',
  'js/content/coping.js',
  'js/content/fagerstrom.js',
  'js/content/rewards.js',
  'js/content/badges.js',
  'js/views/onboarding.js',
  'js/views/home.js',
  'js/views/messages.js',
  'js/views/community.js',
  'js/views/tools.js',
  'js/views/me.js',
  'js/views/sos.js',
  'js/views/game.js',
  'js/views/breathe.js',
  'js/views/diary.js',
  'js/views/money.js',
  'js/views/health.js',
  'js/views/plan.js',
  'js/views/test.js',
  'js/views/withdrawal.js',
  'js/views/triggers.js',
  'js/views/badges.js',
  'js/views/services.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // Add individually: one 404 must not fail the whole install and leave the
    // app with no offline support at all.
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (err) {
        console.warn('[sw] la bele karega:', url, err);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Community API: network-first, never served stale — a cached feed would show
  // people replies that have already changed.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req).catch(() => new Response(
      JSON.stringify({ error: 'offline' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )));
    return;
  }

  // Cross-origin (e.g. a remote community server): straight to network.
  if (url.origin !== self.location.origin) return;

  // App shell: cache-first, refresh in the background.
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) {
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) await cache.put(req, fresh.clone());
        } catch { /* offline — keep the cached copy */ }
      })());
      return cached;
    }
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      // Navigation with nothing cached: fall back to the app shell so the app
      // still opens rather than showing the browser's offline error page.
      if (req.mode === 'navigate') {
        const shell = await cache.match('index.html');
        if (shell) return shell;
      }
      return new Response('Laiha internet.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  })());
});

/* ---------------- notifications ---------------- */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '#/mensajen';

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (client.url.includes(self.registration.scope)) {
        await client.focus();
        client.postMessage({ type: 'navigate', url: target });
        return;
      }
    }
    await self.clients.openWindow(`index.html${target}`);
  })());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Hau Para Fuma';
  const body = payload.body || 'Ita iha mensajen foun.';

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: payload.tag || 'hpf-push',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    lang: 'tet',
    data: { url: payload.url || '#/mensajen' },
  }));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skipWaiting') self.skipWaiting();
});
