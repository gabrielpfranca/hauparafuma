/**
 * APP — shell, router, and the glue that owns persistence.
 *
 * The pure layers (programme, tracking, format, content) never write to the
 * store or touch the DOM; this file is where their results get saved and shown.
 */

import * as store from './store.js';
import * as notif from './notifications.js';
import * as community from './community.js';
import * as programme from './programme.js';
import * as tracking from './tracking.js';
import { t } from './i18n.js';
import { el, clear, toast, openSheet, closeSheet, button, multiline } from './ui.js';
import { WELCOME } from './content/messages.js';

import renderOnboarding from './views/onboarding.js';
import renderHome from './views/home.js';
import renderMessages from './views/messages.js';
import renderCommunity from './views/community.js';
import renderTools from './views/tools.js';
import renderMe from './views/me.js';
import renderGame from './views/game.js';
import renderBreathe from './views/breathe.js';
import renderDiary from './views/diary.js';
import renderMoney from './views/money.js';
import renderHealth from './views/health.js';
import renderPlan from './views/plan.js';
import renderTest from './views/test.js';
import renderWithdrawal from './views/withdrawal.js';
import renderTriggers from './views/triggers.js';
import renderBadges from './views/badges.js';
import renderServices from './views/services.js';
import { renderSOS } from './views/sos.js';

/* ------------------------------------------------------------------ */
/* Rotas                                                              */
/* ------------------------------------------------------------------ */

const ROUTES = {
  '/uma': renderHome,
  '/mensajen': renderMessages,
  '/komunidade': renderCommunity,
  '/ferramenta': renderTools,
  '/hau': renderMe,
  '/jogu': renderGame,
  '/dada-iis': renderBreathe,
  '/diariu': renderDiary,
  '/osan': renderMoney,
  '/saude': renderHealth,
  '/planu': renderPlan,
  '/teste': renderTest,
  '/abstinensia': renderWithdrawal,
  '/gatilhu': renderTriggers,
  '/konkista': renderBadges,
  '/servisu': renderServices,
};

const TABS = [
  { route: '/uma',        icon: '🏠', key: 'tab.home' },
  { route: '/mensajen',   icon: '💬', key: 'tab.messages' },
  { route: '/komunidade', icon: '🤝', key: 'tab.community' },
  { route: '/ferramenta', icon: '🧰', key: 'tab.tools' },
  { route: '/hau',        icon: '👤', key: 'tab.me' },
];

/** Tool routes reachable from a message's `action` field. */
const ACTION_ROUTES = {
  game: '/jogu',
  breathe: '/dada-iis',
  diary: '/diariu',
  money: '/osan',
  health: '/saude',
  community: '/komunidade',
  plan: '/planu',
  why: '/planu',
  badges: '/konkista',
  triggers: '/gatilhu',
  test: '/teste',
  withdrawal: '/abstinensia',
  services: '/servisu',
  me: '/hau',
  sos: '/uma',
};

let currentRoute = '/uma';
let clockTimer = null;

/* ------------------------------------------------------------------ */
/* Konteksu ba view sira                                              */
/* ------------------------------------------------------------------ */

/**
 * Passed to every view. Views get their capabilities from here rather than
 * importing app.js back, which keeps the module graph acyclic.
 */
const ctx = {
  navigate,
  refresh,
  store,
  snapshot: () => tracking.snapshot(),
  tracking,
  community,
  notif,
  openSOS,
  sendUserMessage,
  deliverDue,
  applyAction,
  celebrate,
  shareBadge,
  resetOnboarding,
  finishOnboarding,
  markThreadRead,
  openRelapseSheet,
  applyTheme,
  armNotifications,
  toast,
};

/* ------------------------------------------------------------------ */
/* Router                                                             */
/* ------------------------------------------------------------------ */

function routeFromHash() {
  const raw = (location.hash || '').replace(/^#/, '');
  if (!raw || raw === '/') return '/uma';
  return raw;
}

export function navigate(route, { replace = false } = {}) {
  const target = route.startsWith('/') ? route : `/${route}`;
  if (replace) history.replaceState(null, '', `#${target}`);
  else location.hash = target;
  if (routeFromHash() === target) render();
}

/** Follow a message's `action` field. */
function applyAction(action) {
  if (!action) return;
  if (action === 'sos') {
    openSOS();
    return;
  }
  const route = ACTION_ROUTES[action];
  if (route) navigate(route);
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;

  const state = store.get();

  if (!state.onboarded) {
    teardownChrome();
    clear(root);
    root.appendChild(renderOnboarding(ctx));
    root.removeAttribute('aria-busy');
    return;
  }

  const route = routeFromHash();
  const view = ROUTES[route] || renderHome;
  const nextRoute = ROUTES[route] ? route : '/uma';

  // Leaving a screen dismisses any open sheet — otherwise a badge celebration
  // or SOS panel stays floating over the screen you navigated to. Only on an
  // actual route change, so a same-route refresh can still open one (the
  // check-in flow refreshes and then celebrates).
  if (nextRoute !== currentRoute) closeSheet();
  currentRoute = nextRoute;

  clear(root);
  root.appendChild(view(ctx));
  root.removeAttribute('aria-busy');
  window.scrollTo(0, 0);

  renderTabbar();
  renderSosButton();
  startClock();
}

/** Re-render the current route in place. */
function refresh() {
  render();
}

/* ------------------------------------------------------------------ */
/* Chrome (tabbar, SOS)                                               */
/* ------------------------------------------------------------------ */

function renderTabbar() {
  const bar = document.getElementById('tabbar');
  if (!bar) return;
  bar.hidden = false;
  clear(bar);

  const unread = store.get().thread.filter((m) => m.dir === 'in' && !m.read).length;

  for (const tab of TABS) {
    const active = currentRoute === tab.route;
    bar.appendChild(el('button', {
      class: 'tabbar__btn',
      type: 'button',
      'aria-current': active ? 'page' : undefined,
      onclick: () => navigate(tab.route),
    },
      el('span', { class: 'tabbar__ico', 'aria-hidden': 'true' }, tab.icon),
      el('span', {}, t(tab.key)),
      tab.route === '/mensajen' && unread
        ? el('span', { class: 'tabbar__dot', 'aria-label': t('msg.unread', { n: unread }) }, unread > 9 ? '9+' : String(unread))
        : null,
    ));
  }
}

/** Routes that render a fixed composer the SOS button must not cover. */
const COMPOSER_ROUTES = ['/mensajen'];

function renderSosButton() {
  const sos = document.getElementById('sos');
  if (!sos) return;
  // Hidden on the tool screens that ARE the craving response — a button that
  // just reopens what you are already looking at is noise.
  const hideOn = ['/jogu', '/dada-iis'];
  sos.hidden = hideOn.includes(currentRoute);
  sos.onclick = openSOS;
  const label = sos.querySelector('.sos__label');
  if (label) label.textContent = t('sos.button');

  document.body.classList.toggle('has-composer', COMPOSER_ROUTES.includes(currentRoute));
}

function teardownChrome() {
  const bar = document.getElementById('tabbar');
  const sos = document.getElementById('sos');
  if (bar) {
    bar.hidden = true;
    clear(bar);
  }
  if (sos) sos.hidden = true;
  document.body.classList.remove('has-composer');
  stopClock();
}

/** Tick the smoke-free counter on the home screen without a full re-render. */
function startClock() {
  stopClock();
  if (currentRoute !== '/uma') return;
  clockTimer = setInterval(() => {
    const host = document.querySelector('[data-live-clock]');
    if (!host) {
      stopClock();
      return;
    }
    host.dispatchEvent(new CustomEvent('tick'));
  }, 1000);
}

function stopClock() {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

/* ------------------------------------------------------------------ */
/* Mensajen                                                            */
/* ------------------------------------------------------------------ */

/** Append an entry to the message thread. */
function pushThread(entry) {
  const row = {
    id: store.randomId('t'),
    at: Date.now(),
    read: entry.dir === 'out',
    ...entry,
  };
  store.update((s) => {
    s.thread.push(row);
  }, 'thread');
  return row;
}

/**
 * Deliver every scheduled message that is due.
 * Returns how many were delivered so the caller can decide whether to notify.
 */
function deliverDue({ notify = false } = {}) {
  const s = store.get();
  if (!s.quit.date) return 0;

  const list = programme.due({
    quitDate: s.quit.date,
    startedAt: s.quit.startedAt,
    deliveredIds: s.programme.delivered,
    slotTimes: { 0: s.settings.morningAt, 1: s.settings.eveningAt },
  });
  if (!list.length) return 0;

  for (const msg of list) {
    pushThread({
      dir: 'in',
      msgId: msg.id,
      type: msg.type,
      text: msg.text,
      action: msg.action || null,
      quick: msg.quick || null,
      assessDay: msg.assessDay || null,
    });
    store.update((st) => {
      st.programme.delivered.push(msg.id);
      st.programme.lastDeliveredKey = `${msg.day}:${msg.slot}`;
    }, 'delivered');
  }

  if (notify && s.settings.notifications && !notif.isQuiet(s.settings)) {
    const last = list[list.length - 1];
    notif.show(last.text, { url: '#/mensajen' });
  }

  armNotifications();
  return list.length;
}

/**
 * Handle a message typed (or quick-tapped) by the person.
 * This is the handbook's two-way interaction: the reply comes from the engine,
 * and any side effect it asks for is applied here.
 */
function sendUserMessage(text, { assessDay = null } = {}) {
  const value = String(text || '').trim();
  if (!value) return null;

  pushThread({ dir: 'out', text: value, type: 'user' });

  const snap = tracking.snapshot();
  const { money, durationShort } = window.__hpfFormat || {};

  let reply;
  if (assessDay) {
    const answer = /lae|la fuma|clean|sin, la/i.test(value) ? 'clean' : 'smoked';
    reply = programme.assessReply(answer);
    store.update((s) => {
      s.programme.assessments.push({ day: assessDay, at: Date.now(), smoked: answer === 'smoked' });
    }, 'assess');
  } else {
    reply = programme.replyTo(value, {
      saved: money ? money(snap.saved) : `$${snap.saved.toFixed(2)}`,
      notSmoked: String(snap.notSmoked),
      smokeFreeText: durationShort ? durationShort(snap.smokeFreeMs) : '',
      nextMilestone: snap.milestoneNext ? snap.milestoneNext.title : '',
      cravingsBeaten: snap.cravingsBeaten,
      seed: Date.now(),
    });
  }

  const intent = programme.detectIntent(value);
  if (intent === 'relapse') {
    // Do not silently reset the streak — offer the choice, per the plan.
    setTimeout(() => openRelapseSheet(), 400);
  }

  const row = pushThread({
    dir: 'in',
    type: reply.type,
    text: reply.text,
    action: reply.action || null,
    quick: reply.quick || null,
  });

  return row;
}

/** Mark every inbound message as read. */
export function markThreadRead() {
  const unread = store.get().thread.some((m) => m.dir === 'in' && !m.read);
  if (!unread) return;
  store.update((s) => {
    for (const m of s.thread) if (m.dir === 'in') m.read = true;
  }, 'read');
}

/* ------------------------------------------------------------------ */
/* SOS                                                                */
/* ------------------------------------------------------------------ */

function openSOS() {
  openSheet(t('sos.title'), (close) => renderSOS(ctx, close));
}

/** Relapse choice sheet: restart the count, or keep it after a single slip. */
export function openRelapseSheet() {
  openSheet(t('me.relapse.title'), (close) => el('div', { class: 'stack' },
    ...multiline(t('me.relapse.body')),
    el('div', { class: 'stack', style: { marginTop: '14px' } },
      button(t('me.relapse.keep'), {
        variant: 'btn--ghost btn--block',
        onClick: () => {
          tracking.recordRelapse({ restart: false });
          close();
          toast(t('diary.saved'), 'ok');
          refresh();
        },
      }),
      button(t('me.relapse.restart'), {
        variant: 'btn--block',
        onClick: () => {
          tracking.recordRelapse({ restart: true });
          deliverDue();
          close();
          toast(t('me.relapse.done'), 'ok');
          navigate('/uma');
          refresh();
        },
      }),
    ),
  ));
}

/* ------------------------------------------------------------------ */
/* Konkista                                                           */
/* ------------------------------------------------------------------ */

/** Check for new badges and celebrate the first one found. */
function celebrate() {
  const fresh = tracking.checkBadges();
  if (!fresh.length) return [];
  const badge = fresh[0];
  openSheet(t('badge.new'), (close) => el('div', { class: 'stack center' },
    el('div', { style: { fontSize: '3.4rem' }, 'aria-hidden': 'true' }, badge.icon),
    el('h3', {}, badge.title),
    el('p', { class: 'muted' }, badge.desc),
    button(t('badge.share'), {
      variant: 'btn--block',
      onClick: async () => {
        close();
        await shareBadge(badge);
      },
    }),
    button(t('close'), { variant: 'btn--quiet btn--block', onClick: close }),
  ));
  return fresh;
}

/** Post a badge to the community feed. */
async function shareBadge(badge) {
  const res = await community.post({ text: badge.share, tag: 'win', badgeId: badge.id });
  if (!res.ok) {
    toast(res.reason === 'rate' ? t('com.rate') : t('error'), 'warn');
    return;
  }
  store.update((s) => {
    const row = s.badges.find((b) => b.id === badge.id);
    if (row) row.shared = true;
  }, 'badges');
  toast(res.queued ? t('com.offline') : t('badge.shared'), 'ok');
  navigate('/komunidade');
}

/* ------------------------------------------------------------------ */
/* Notifikasaun                                                       */
/* ------------------------------------------------------------------ */

function armNotifications() {
  const s = store.get();
  if (!s.settings.notifications || notif.permission() !== 'granted') {
    notif.cancel();
    return;
  }

  // Web Push, when a server is known. This is the only place it is subscribed:
  // arming happens on boot, on delivery, and whenever notifications are turned
  // on, so there is no path that enables notifications and skips push.
  // subscribePush() ignores an empty base, so calling it unconditionally is safe.
  notif.subscribePush(community.serverBase(), s.community.deviceId);

  const at = programme.nextDueAt({
    quitDate: s.quit.date,
    slotTimes: { 0: s.settings.morningAt, 1: s.settings.eveningAt },
  });
  notif.scheduleNext({
    at,
    settings: s.settings,
    onFire: () => {
      deliverDue({ notify: true });
      if (currentRoute === '/mensajen' || currentRoute === '/uma') refresh();
      else renderTabbar();
    },
  });
}

/* ------------------------------------------------------------------ */
/* Onboarding hotu                                                    */
/* ------------------------------------------------------------------ */

/** Called by the onboarding view once the profile is complete. */
export function finishOnboarding() {
  store.update((s) => {
    s.onboarded = true;
    s.quit.startedAt = Date.now();
  }, 'onboarded');

  // Welcome message first, so the thread is never empty.
  pushThread({ dir: 'in', type: WELCOME.type, text: WELCOME.text, quick: WELCOME.quick, msgId: 'welcome' });
  store.update((s) => {
    s.programme.delivered.push('welcome');
  }, 'delivered');

  deliverDue();
  tracking.checkBadges();
  applyTheme();
  navigate('/uma', { replace: true });
  refresh();
}

function resetOnboarding() {
  store.reset();
  location.hash = '';
  render();
}

/* ------------------------------------------------------------------ */
/* Tema                                                               */
/* ------------------------------------------------------------------ */

export function applyTheme() {
  const theme = store.get().settings.theme;
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

async function boot() {
  store.load();
  applyTheme();

  // Expose formatters for the reply builder without creating an import cycle.
  const fmt = await import('./format.js');
  window.__hpfFormat = fmt;

  render();

  // Deliver anything missed while the app was closed, then arm the next one.
  if (store.get().onboarded) {
    deliverDue();
    tracking.checkBadges();
    armNotifications();
    community.sync();
    refresh();
  }

  notif.initServiceWorker();

  // If this origin also serves the API, adopt it: the community then works with
  // no setup. Repaint when it turns out we have a server after all.
  community.detectServer().then((found) => {
    if (!found) return;
    community.sync();
    // Now that a server is known, push can be subscribed.
    armNotifications();
    refresh();
  });

  window.addEventListener('hashchange', render);

  window.addEventListener('online', () => {
    community.sync().then((r) => {
      if (r.sent && currentRoute === '/komunidade') refresh();
    });
  });

  // Coming back to the app is the moment to catch up: the phone may have been
  // asleep for hours and any local timer with it.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!store.get().onboarded) return;
    const delivered = deliverDue();
    tracking.checkBadges();
    community.sync();
    if (delivered) refresh();
    else renderTabbar();
  });

  // Deep links from notification taps.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'navigate' && event.data.url) {
        location.hash = String(event.data.url).replace(/^#/, '');
      }
    });
  }

  window.addEventListener('pagehide', () => store.flush());

  document.getElementById('sheet')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-sheet-close]')) closeSheet();
  });
}

boot();

/* Exposed for the Playwright smoke test and for debugging on a real phone. */
window.__hpf = {
  store, programme, tracking, community, notif,
  navigate, refresh, deliverDue, sendUserMessage, finishOnboarding, openSOS,
};
