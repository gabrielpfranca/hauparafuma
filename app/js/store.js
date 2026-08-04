/**
 * Store — estadu aplikasaun no rai iha telefone.
 *
 * Everything lives in one localStorage key. No server, no account, no analytics:
 * the only data that ever leaves the phone is what the person posts to the
 * community feed themselves.
 *
 * Shape is versioned so future releases can migrate instead of wiping the
 * user's streak — losing a streak would be a real harm for someone quitting.
 */

const KEY = 'hauparafuma.v1';
const SCHEMA = 1;

const DEFAULTS = Object.freeze({
  schema: SCHEMA,
  createdAt: 0,
  onboarded: false,

  profile: {
    nickname: '',
    avatarSeed: 0,
    cigsPerDay: 10,
    pricePerPack: 2.0,
    cigsPerPack: 20,
    reasons: [],          // ids from content/coping.js REASONS + free text
    customReason: '',
  },

  /** Programme anchor: the moment counting starts. */
  quit: {
    date: 0,              // ms timestamp of quit-day local midnight
    startedAt: 0,         // when the person joined the programme
    attempt: 1,
    bestDays: 0,
    history: [],          // [{ attempt, from, to, days }]
  },

  settings: {
    theme: 'auto',        // auto | light | dark
    notifications: false,
    morningAt: 8 * 60,    // minutes since midnight
    eveningAt: 19 * 60,
    quietFrom: 22 * 60,
    quietTo: 6 * 60,
    // The community server ships with the app: it is the origin the app was
    // served from, found by community.detectServer(). There is deliberately no
    // UI for this — it is not a choice a person should have to understand.
    apiBase: '',          // override without UI (tests, future per-municipality rooms)
    apiDetected: '',      // origin found to serve /api; empty => local-only mode
  },

  /** Delivered programme messages + the person's own replies. One thread. */
  thread: [],             // [{ id, msgId, dir:'in'|'out', type, text, at, read, action, quick }]

  /** Programme bookkeeping. */
  programme: {
    lastDeliveredKey: '',  // "day:slot" of the last scheduled message handed over
    delivered: [],         // msgIds already delivered (dedupe across catch-up)
    assessments: [],       // [{ day, at, smoked }]
  },

  /** Daily check-ins: { 'YYYY-MM-DD': 'clean' | 'smoked' } */
  checkins: {},

  /** Craving diary. */
  diary: [],              // [{ id, at, strength, trigger, action, smoked, note }]

  /** Counters. */
  counters: {
    cravingsBeaten: 0,
    gamesPlayed: 0,
    breathsDone: 0,
  },

  game: {
    best: {},             // level -> { ms, moves }
    level: 0,
  },

  fagerstrom: null,       // { score, level, at }

  badges: [],             // [{ id, at, shared }]

  plan: {
    doInstead: [],
    supports: [],         // [{ name, phone }]
    avoid: [],
  },

  moneyGoals: [],         // custom goals [{ id, name, cost }]

  community: {
    deviceId: '',
    posts: [],            // local mirror / local-only mode store
    outbox: [],           // queued while offline
    reacted: [],          // post ids this device cheered
    reported: [],         // post ids this device reported
    lastPostAt: 0,
    seenRules: false,
  },
});

/* ------------------------------------------------------------------ */

function deepClone(v) {
  return typeof structuredClone === 'function'
    ? structuredClone(v)
    : JSON.parse(JSON.stringify(v));
}

/** Recursively fill missing keys from defaults without clobbering user data. */
function hydrate(defaults, saved) {
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : deepClone(defaults);
  if (defaults && typeof defaults === 'object') {
    const out = {};
    const src = saved && typeof saved === 'object' ? saved : {};
    for (const k of Object.keys(defaults)) out[k] = hydrate(defaults[k], src[k]);
    // Keep unknown keys so a downgrade doesn't destroy data written by a newer build.
    for (const k of Object.keys(src)) if (!(k in out)) out[k] = src[k];
    return out;
  }
  return saved === undefined || saved === null ? defaults : saved;
}

function migrate(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  // Only one schema so far; future versions branch on data.schema here.
  data.schema = SCHEMA;
  return data;
}

function randomId(prefix = 'id') {
  const rnd = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')
    : Math.random().toString(16).slice(2, 18);
  return `${prefix}_${rnd}`;
}

/* ------------------------------------------------------------------ */

let state = deepClone(DEFAULTS);
const listeners = new Set();
let saveTimer = null;

function readStorage() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[store] la bele lee dadus:', err);
    return null;
  }
}

function writeStorage() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    // Quota exceeded is the realistic failure: trim the least valuable history
    // (old diary entries and the local feed mirror) rather than lose the streak.
    console.warn('[store] la bele rai dadus:', err);
    try {
      state.diary = state.diary.slice(-120);
      state.community.posts = state.community.posts.slice(0, 60);
      state.thread = state.thread.slice(-400);
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }
}

export function load() {
  state = hydrate(DEFAULTS, migrate(readStorage()));
  if (!state.createdAt) state.createdAt = Date.now();
  if (!state.community.deviceId) state.community.deviceId = randomId('dev');
  if (!state.profile.avatarSeed) {
    state.profile.avatarSeed = Math.floor(Math.random() * 360);
  }
  writeStorage();
  return state;
}

export function get() {
  return state;
}

/** Persist (debounced) and notify subscribers. */
export function commit(reason = 'update') {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeStorage, 120);
  for (const fn of listeners) {
    try {
      fn(state, reason);
    } catch (err) {
      console.error('[store] listener sala:', err);
    }
  }
}

/** Force an immediate synchronous write (used before unload / erase). */
export function flush() {
  clearTimeout(saveTimer);
  return writeStorage();
}

/**
 * Mutate state through a function, then commit.
 * `update(s => { s.counters.gamesPlayed++ })`
 */
export function update(fn, reason = 'update') {
  fn(state);
  commit(reason);
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reset() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  state = deepClone(DEFAULTS);
  state.createdAt = Date.now();
  state.community.deviceId = randomId('dev');
  state.profile.avatarSeed = Math.floor(Math.random() * 360);
  writeStorage();
  commit('reset');
  return state;
}

export function exportJSON() {
  return JSON.stringify({ app: 'hauparafuma', exportedAt: new Date().toISOString(), data: state }, null, 2);
}

export { randomId, DEFAULTS, KEY };

/* ---------------- derived helpers used across views ---------------- */

/** Has the quit date arrived? */
export function hasQuit(now = Date.now()) {
  return Boolean(state.quit.date) && now >= state.quit.date;
}

/** Milliseconds smoke-free (0 before quit day). */
export function smokeFreeMs(now = Date.now()) {
  if (!state.quit.date) return 0;
  return Math.max(0, now - state.quit.date);
}

/** Milliseconds until quit day (0 once it has arrived). */
export function untilQuitMs(now = Date.now()) {
  if (!state.quit.date) return 0;
  return Math.max(0, state.quit.date - now);
}

/** Cost of one cigarette in USD. */
export function costPerCig() {
  const { pricePerPack, cigsPerPack } = state.profile;
  const per = Number(cigsPerPack) > 0 ? Number(cigsPerPack) : 20;
  return Number(pricePerPack) / per;
}

/** Record a daily check-in, keyed by local date. */
export function setCheckin(dateKey, value) {
  return update((s) => {
    s.checkins[dateKey] = value;
  }, 'checkin');
}
