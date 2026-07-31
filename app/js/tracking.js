/**
 * RASTREIA — derived numbers: money, cigarettes, life regained, streak, badges.
 *
 * The maths lives in pure functions that take a plain snapshot, so it is
 * unit-tested without a browser (tests/unit.mjs). `snapshot()` is the only
 * function that reads the store.
 */

import * as store from './store.js';
import { MINUTES_PER_CIG, reached as milestonesReached, next as nextMilestone, progressToNext } from './content/milestones.js';
import { BADGES, earned } from './content/badges.js';
import { next as nextReward, reached as rewardsReached, daysUntil } from './content/rewards.js';
import { programmeDay, phaseFor } from './programme.js';
import { MS, isoDate } from './format.js';

/* ------------------------------------------------------------------ */
/* Matemátika (pure)                                                   */
/* ------------------------------------------------------------------ */

/** Cigarettes avoided over `ms`, at the person's usual daily rate. */
export function cigsAvoided({ cigsPerDay, ms }) {
  if (!(cigsPerDay > 0) || !(ms > 0)) return 0;
  return (cigsPerDay * ms) / MS.day;
}

/** Money saved over `ms`, in USD. */
export function moneySaved({ cigsPerDay, pricePerPack, cigsPerPack, ms }) {
  const per = cigsPerPack > 0 ? cigsPerPack : 20;
  const perCig = (Number(pricePerPack) || 0) / per;
  return cigsAvoided({ cigsPerDay, ms }) * perCig;
}

/** Daily saving rate, in USD. */
export function savedPerDay({ cigsPerDay, pricePerPack, cigsPerPack }) {
  const per = cigsPerPack > 0 ? cigsPerPack : 20;
  return (Number(cigsPerDay) || 0) * ((Number(pricePerPack) || 0) / per);
}

/**
 * Minutes of life expectancy regained — a population average, presented in the
 * UI as an estimate rather than a promise.
 */
export function lifeMinutes({ cigsPerDay, ms }) {
  return cigsAvoided({ cigsPerDay, ms }) * MINUTES_PER_CIG;
}

/**
 * Consecutive clean check-in days ending today (or yesterday, if today has not
 * been recorded yet — the streak should not appear broken at 00:01).
 */
export function streak(checkins, now = Date.now()) {
  let count = 0;
  const cursor = new Date(now);
  if (checkins[isoDate(cursor)] === undefined) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = isoDate(cursor);
    if (checkins[key] !== 'clean') break;
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/** Share of logged cravings that were resisted, 0..100. */
export function craveWinRate(diary) {
  if (!diary.length) return 0;
  const won = diary.filter((d) => !d.smoked).length;
  return Math.round((won / diary.length) * 100);
}

/** Triggers ranked by how often they appear in the diary. */
export function topTriggers(diary, limit = 4) {
  const counts = new Map();
  for (const entry of diary) {
    if (!entry.trigger) continue;
    counts.set(entry.trigger, (counts.get(entry.trigger) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, n]) => ({ id, n }));
}

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */

/** Everything the dashboard and message replies need, in one read. */
export function snapshot(now = Date.now()) {
  const s = store.get();
  const smokeFreeMs = store.smokeFreeMs(now);
  const untilQuit = store.untilQuitMs(now);
  const { cigsPerDay, pricePerPack, cigsPerPack } = s.profile;

  const saved = moneySaved({ cigsPerDay, pricePerPack, cigsPerPack, ms: smokeFreeMs });
  const perDay = savedPerDay({ cigsPerDay, pricePerPack, cigsPerPack });
  const notSmoked = Math.floor(cigsAvoided({ cigsPerDay, ms: smokeFreeMs }));
  const day = programmeDay(s.quit.date, now);

  return {
    now,
    day,
    phase: phaseFor(day),
    hasQuit: store.hasQuit(now),
    smokeFreeMs,
    untilQuitMs: untilQuit,
    saved,
    perDay,
    notSmoked,
    lifeMin: Math.floor(lifeMinutes({ cigsPerDay, ms: smokeFreeMs })),
    cravingsBeaten: s.counters.cravingsBeaten,
    streakDays: streak(s.checkins, now),
    milestonesDone: milestonesReached(smokeFreeMs),
    milestoneNext: nextMilestone(smokeFreeMs),
    milestoneProgress: progressToNext(smokeFreeMs),
    rewardsDone: rewardsReached(saved, s.moneyGoals),
    rewardNext: nextReward(saved, s.moneyGoals),
    get rewardDays() {
      return daysUntil(this.rewardNext, this.saved, this.perDay);
    },
    diaryCount: s.diary.length,
    winRate: craveWinRate(s.diary),
  };
}

/* ------------------------------------------------------------------ */
/* Konkista                                                            */
/* ------------------------------------------------------------------ */

/**
 * Award any newly earned badges and return them, so the caller can celebrate.
 * Idempotent: badges already recorded are never returned twice.
 */
export function checkBadges(now = Date.now()) {
  const s = store.get();
  const list = earned({
    smokeFreeMs: store.smokeFreeMs(now),
    cravingsBeaten: s.counters.cravingsBeaten,
    diaryCount: s.diary.length,
    gamesPlayed: s.counters.gamesPlayed,
    postCount: s.community.posts.filter((p) => p.mine).length,
    hasPlan: s.plan.doInstead.length > 0 || s.plan.supports.length > 0,
  });

  const have = new Set(s.badges.map((b) => b.id));
  const fresh = list.filter((b) => !have.has(b.id));
  if (!fresh.length) return [];

  store.update((st) => {
    for (const b of fresh) st.badges.push({ id: b.id, at: now, shared: false });
  }, 'badges');

  return fresh;
}

/** Badge definitions annotated with whether they are earned. */
export function badgeList() {
  const have = new Map(store.get().badges.map((b) => [b.id, b]));
  return BADGES.map((b) => ({ ...b, earnedAt: have.get(b.id)?.at || null, shared: have.get(b.id)?.shared || false }));
}

/* ------------------------------------------------------------------ */
/* Asaun                                                              */
/* ------------------------------------------------------------------ */

/** Record a beaten craving. */
export function recordCravingWin() {
  store.update((s) => {
    s.counters.cravingsBeaten++;
  }, 'craving');
  return store.get().counters.cravingsBeaten;
}

export function recordGamePlayed() {
  store.update((s) => {
    s.counters.gamesPlayed++;
  }, 'game');
}

export function recordBreath() {
  store.update((s) => {
    s.counters.breathsDone++;
  }, 'breathe');
}

/** Add a diary entry. */
export function addDiary(entry) {
  const row = { id: store.randomId('d'), at: Date.now(), ...entry };
  store.update((s) => {
    s.diary.unshift(row);
  }, 'diary');
  return row;
}

/**
 * Handle a relapse.
 *
 * `restart: true` archives the attempt and starts counting from today.
 * `restart: false` keeps the streak — for a single slip, resetting a 60-day
 * count to zero is more likely to make someone abandon the attempt than to
 * motivate them, so the choice belongs to the person, not the app.
 */
export function recordRelapse({ restart, now = Date.now() } = {}) {
  const s = store.get();
  const days = Math.floor(store.smokeFreeMs(now) / MS.day);

  store.update((st) => {
    st.checkins[isoDate(now)] = 'smoked';
    if (!restart) return;

    st.quit.history.push({ attempt: st.quit.attempt, from: st.quit.date, to: now, days });
    st.quit.bestDays = Math.max(st.quit.bestDays, days);
    st.quit.attempt += 1;

    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    st.quit.date = midnight.getTime();

    // The new attempt starts a fresh programme: clear delivery bookkeeping so
    // the person gets the early-phase messages again, when they need them most.
    st.programme.delivered = [];
    st.programme.lastDeliveredKey = '';
  }, 'relapse');

  return { days, attempt: store.get().quit.attempt, bestDays: store.get().quit.bestDays };
}
