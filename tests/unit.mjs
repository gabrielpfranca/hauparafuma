/**
 * Testes unitáriu — the pure layers.
 *
 * Run: npm test   (node --test tests/unit.mjs)
 *
 * These cover the logic that would silently corrupt someone's programme if it
 * broke: which message is due on which day, the money and health maths, the
 * relapse accounting, and Tetun formatting.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as fmt from '../app/js/format.js';
import * as prog from '../app/js/programme.js';
import {
  SCHEDULE, ASSESS_DAYS, EXPLICIT, MAINTAIN_POOL, COPING_POOL, RELAPSE_POOL, libraryStats,
} from '../app/js/content/messages.js';
import { MILESTONES, reached, next as nextMilestone, progressToNext } from '../app/js/content/milestones.js';
import { QUOTES, quoteOfTheDay } from '../app/js/content/quotes.js';
import { QUESTIONS, MAX_SCORE, score as ftndScore, levelFor } from '../app/js/content/fagerstrom.js';
import { REWARDS, next as nextReward, daysUntil, all as allRewards } from '../app/js/content/rewards.js';
import { BADGES, earned } from '../app/js/content/badges.js';
import { MemoryGame, LEVELS, isBest } from '../app/js/game.js';
import { TRIGGERS, WITHDRAWAL, REASONS } from '../app/js/content/coping.js';

const DAY = 86400000;

/* ================================================================== */
/* format.js                                                          */
/* ================================================================== */

test('duration puts the Tetun unit before the numeral', () => {
  assert.equal(fmt.duration(3 * DAY + 4 * 3600000), 'loron 3, oras 4');
  assert.equal(fmt.duration(40 * 60000), 'minutu 40');
  assert.equal(fmt.duration(45 * 1000), 'segundu 45');
  assert.equal(fmt.duration(0), 'segundu 0');
});

test('duration never goes negative', () => {
  assert.equal(fmt.duration(-5000), 'segundu 0');
  assert.deepEqual(fmt.splitDuration(-1), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test('durationShort steps up through Tetun units', () => {
  assert.equal(fmt.durationShort(30 * 1000), 'segundu 30');
  assert.equal(fmt.durationShort(90 * 60000), 'oras 1');
  assert.equal(fmt.durationShort(5 * DAY), 'loron 5');
  assert.equal(fmt.durationShort(21 * DAY), 'semana 3');
  assert.equal(fmt.durationShort(90 * DAY), 'fulan 3');
  assert.equal(fmt.durationShort(400 * DAY), 'tinan 1, fulan 1');
  assert.equal(fmt.durationShort(365 * DAY), 'tinan 1');
});

test('money formats USD and drops cents on large totals', () => {
  assert.equal(fmt.money(0), '$0.00');
  assert.equal(fmt.money(12.5), '$12.50');
  assert.equal(fmt.money(1234.56), '$1,235');
  assert.equal(fmt.money(undefined), '$0.00');
});

test('clock is mm:ss', () => {
  assert.equal(fmt.clock(0), '0:00');
  assert.equal(fmt.clock(65000), '1:05');
  assert.equal(fmt.clock(600000), '10:00');
});

test('date uses Tetun month names', () => {
  assert.equal(fmt.date(new Date(2026, 2, 15)), '15 Marsu 2026');
  assert.equal(fmt.dateWithWeekday(new Date(2026, 2, 15)), 'Domingu, 15 Marsu');
  assert.equal(fmt.date('not a date'), '—');
});

test('parseIsoDate reads as local midnight, not UTC', () => {
  const d = fmt.parseIsoDate('2026-03-15');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 15);
  assert.equal(d.getHours(), 0);
  assert.equal(fmt.parseIsoDate('nope'), null);
  assert.equal(fmt.isoDate(d), '2026-03-15');
});

test('daysBetween counts calendar days, ignoring clock time', () => {
  const a = new Date(2026, 2, 15, 23, 59);
  const b = new Date(2026, 2, 16, 0, 1);
  assert.equal(fmt.daysBetween(a, b), 1);
  assert.equal(fmt.daysBetween(b, a), -1);
  assert.equal(fmt.daysBetween(a, a), 0);
});

test('HH:MM round-trips', () => {
  assert.equal(fmt.parseHHMM('08:30'), 510);
  assert.equal(fmt.toHHMM(510), '08:30');
  assert.equal(fmt.parseHHMM('25:00'), null);
  assert.equal(fmt.parseHHMM(''), null);
  assert.equal(fmt.toHHMM(1440), '00:00');
});

test('ago produces Tetun relative time', () => {
  const now = Date.now();
  assert.equal(fmt.ago(now - 5000, now), 'oras ne\'e');
  assert.equal(fmt.ago(now - 5 * 60000, now), 'minutu 5 liu ba');
  assert.equal(fmt.ago(now - 3 * 3600000, now), 'oras 3 liu ba');
  assert.equal(fmt.ago(now - 30 * 3600000, now), 'horiseik');
});

/* ================================================================== */
/* programme.js — schedule                                            */
/* ================================================================== */

/** Quit date fixed at local midnight so day arithmetic is unambiguous. */
function quitAt(y = 2026, m = 5, d = 1) {
  return new Date(y, m, d, 0, 0, 0, 0).getTime();
}
function dayOffset(quit, offset, hour = 12) {
  const d = new Date(quit);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

test('programmeDay is 0 on quit day and negative before it', () => {
  const quit = quitAt();
  assert.equal(prog.programmeDay(quit, dayOffset(quit, 0)), 0);
  assert.equal(prog.programmeDay(quit, dayOffset(quit, -7)), -7);
  assert.equal(prog.programmeDay(quit, dayOffset(quit, 42)), 42);
  assert.equal(prog.programmeDay(0, Date.now()), null);
});

test('phases match the WHO tapering bands', () => {
  assert.equal(prog.phaseFor(-7), 'prequit');
  assert.equal(prog.phaseFor(-1), 'prequit');
  assert.equal(prog.phaseFor(0), 'quitday');
  assert.equal(prog.phaseFor(1), 'early');
  assert.equal(prog.phaseFor(28), 'early');
  assert.equal(prog.phaseFor(29), 'maintain');
  assert.equal(prog.phaseFor(180), 'maintain');
  assert.equal(prog.phaseFor(181), 'graduate');
  assert.equal(prog.phaseFor(null), 'none');
});

test('delivery frequency tapers: 2/day early, weekly by month 4', () => {
  assert.deepEqual(prog.slotsFor(-7), [0, 1]);       // pre-quit: twice daily
  assert.deepEqual(prog.slotsFor(0), [0, 1, 2, 3]);  // quit day: four
  assert.deepEqual(prog.slotsFor(14), [0, 1]);       // week 2: twice daily
  assert.deepEqual(prog.slotsFor(20), [0]);          // week 3-4: once daily
  assert.deepEqual(prog.slotsFor(29), [0]);          // week 5-8: every 2 days
  assert.deepEqual(prog.slotsFor(32), []);           // ...so day 32 is silent
  assert.deepEqual(prog.slotsFor(31), [0]);
  assert.deepEqual(prog.slotsFor(57), [0]);          // week 9-12: every 3 days
  assert.deepEqual(prog.slotsFor(58), []);
  assert.deepEqual(prog.slotsFor(60), [0]);
  assert.deepEqual(prog.slotsFor(85), [0]);          // month 4-6: weekly
  assert.deepEqual(prog.slotsFor(86), []);
  assert.deepEqual(prog.slotsFor(92), [0]);
  assert.deepEqual(prog.slotsFor(181), []);          // past the programme
});

test('assessment days override the band cadence that would skip them', () => {
  // 30, 90 and 180 all land between delivery days (every-2 from 29, weekly
  // from 85). They must still deliver, or the follow-up is never asked.
  for (const day of [30, 90, 180]) {
    assert.ok(prog.isDeliveryDay(day), `loron ${day} tenke haruka`);
    assert.deepEqual(prog.slotsFor(day), [0]);
  }
  // Neighbouring non-assessment days stay silent, so the taper still holds.
  assert.deepEqual(prog.slotsFor(91), []);
  assert.deepEqual(prog.slotsFor(179), []);
});

test('every scheduled slot from day -7 to 180 yields a message', () => {
  for (let day = -7; day <= 180; day++) {
    for (const slot of prog.slotsFor(day)) {
      const msg = prog.messageFor(day, slot);
      assert.ok(msg, `laiha mensajen ba loron ${day} slot ${slot}`);
      assert.ok(msg.text && msg.text.length > 20, `mensajen kurtu liu: ${day}:${slot}`);
      assert.ok(msg.type, `laiha tipu: ${day}:${slot}`);
    }
  }
});

test('assessment prompts land on the assessment days', () => {
  for (const day of ASSESS_DAYS) {
    const slots = prog.slotsFor(day);
    assert.ok(slots.length, `loron ${day} tenke iha slot`);
    const last = slots[slots.length - 1];
    const msg = prog.messageFor(day, last);
    assert.equal(msg.type, 'assess', `loron ${day} tenke iha pergunta`);
    assert.equal(msg.assessDay, day);
    assert.deepEqual(msg.quick, ['clean', 'smoked']);
  }
});

test('maintenance pool never repeats on consecutive delivery days', () => {
  const texts = [];
  for (let day = 29; day <= 180; day++) {
    for (const slot of prog.slotsFor(day)) {
      const msg = prog.messageFor(day, slot);
      if (msg.type === 'assess') continue;
      texts.push(msg.text);
    }
  }
  for (let i = 1; i < texts.length; i++) {
    assert.notEqual(texts[i], texts[i - 1], `mensajen repete iha índise ${i}`);
  }
});

test('messageFor is deterministic', () => {
  for (const [day, slot] of [[45, 0], [100, 0], [3, 1]]) {
    assert.equal(prog.messageFor(day, slot).text, prog.messageFor(day, slot).text);
  }
});

/* ================================================================== */
/* programme.js — due / catch-up                                      */
/* ================================================================== */

test('due returns nothing without a quit date', () => {
  assert.deepEqual(prog.due({ quitDate: 0 }), []);
});

test('due respects slot clock times on the current day', () => {
  const quit = quitAt();
  // Register on day 1 so quit-day catch-up does not enter the count and the
  // assertion isolates the clock-time rule.
  const startedAt = dayOffset(quit, 1, 0);

  const morningOnly = prog.due({
    quitDate: quit,
    startedAt,
    now: dayOffset(quit, 1, 9),      // 09:00 — morning passed, evening not yet
    slotTimes: { 0: 8 * 60, 1: 19 * 60 },
  });
  assert.equal(morningOnly.length, 1);
  assert.equal(morningOnly[0].slot, 0);

  const both = prog.due({
    quitDate: quit,
    startedAt,
    now: dayOffset(quit, 1, 20),     // 20:00 — both passed
    slotTimes: { 0: 8 * 60, 1: 19 * 60 },
  });
  assert.equal(both.length, 2);

  const neither = prog.due({
    quitDate: quit,
    startedAt,
    now: dayOffset(quit, 1, 7),      // 07:00 — nothing due yet today
    slotTimes: { 0: 8 * 60, 1: 19 * 60 },
  });
  assert.deepEqual(neither, []);
});

test('due does not redeliver messages already delivered', () => {
  const quit = quitAt();
  const now = dayOffset(quit, 2, 20);
  const first = prog.due({ quitDate: quit, startedAt: quit, now });
  assert.ok(first.length > 0);
  const again = prog.due({
    quitDate: quit,
    startedAt: quit,
    now,
    deliveredIds: first.map((m) => m.id),
  });
  assert.deepEqual(again, []);
});

test('catch-up delivers missed messages in order and is capped', () => {
  const quit = quitAt();
  const now = dayOffset(quit, 40, 22);   // 40 days of silence
  const list = prog.due({ quitDate: quit, startedAt: quit, now, maxCatchUp: 12 });
  assert.equal(list.length, 12, 'tenke limita catch-up');
  // Kept slice must be the most recent, and ordered.
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const cur = list[i];
    assert.ok(cur.day > prev.day || (cur.day === prev.day && cur.slot > prev.slot),
      'mensajen tenke iha orden');
  }
});

test('due never looks back before registration', () => {
  const quit = quitAt();
  // Registered on quit day itself: the pre-quit messages must not arrive.
  const list = prog.due({
    quitDate: quit,
    startedAt: quit,
    now: dayOffset(quit, 0, 23),
    maxCatchUp: 100,
  });
  assert.ok(list.every((m) => m.day >= 0), 'la bele haruka mensajen prepara');
});

test('graduation message is delivered once, after day 180', () => {
  const quit = quitAt();
  const now = dayOffset(quit, 190, 12);
  const list = prog.due({ quitDate: quit, startedAt: dayOffset(quit, 180), now, maxCatchUp: 100 });
  assert.ok(list.some((m) => m.id === 'graduate'));

  const again = prog.due({
    quitDate: quit,
    startedAt: dayOffset(quit, 180),
    now,
    deliveredIds: ['graduate'],
    maxCatchUp: 100,
  });
  assert.ok(!again.some((m) => m.id === 'graduate'));
});

test('nextDueAt finds a future slot and stops after the programme', () => {
  const quit = quitAt();
  const at = prog.nextDueAt({ quitDate: quit, now: dayOffset(quit, 1, 9) });
  assert.ok(at > dayOffset(quit, 1, 9));
  assert.equal(prog.nextDueAt({ quitDate: quit, now: dayOffset(quit, 200) }), null);
  assert.equal(prog.nextDueAt({ quitDate: 0 }), null);
});

/* ================================================================== */
/* programme.js — two-way interaction                                 */
/* ================================================================== */

test('Tetun keywords are detected, accent- and case-insensitively', () => {
  assert.equal(prog.detectIntent('HAKARAK'), 'craving');
  assert.equal(prog.detectIntent('hakarak fuma tebes'), 'craving');
  assert.equal(prog.detectIntent('Tulun ha\'u'), 'help');
  assert.equal(prog.detectIntent('osan'), 'money');
  assert.equal(prog.detectIntent('saúde'), 'health');   // accented
  assert.equal(prog.detectIntent('saude'), 'health');   // unaccented
  assert.equal(prog.detectIntent('jogu'), 'game');
  assert.equal(prog.detectIntent(''), null);
  assert.equal(prog.detectIntent('xyzzy'), null);
});

test('relapse is matched before the generic craving keyword', () => {
  // "ha'u fuma tiha" contains neither "hakarak" nor anything ambiguous, but the
  // ordering guarantee is what stops a slip being treated as a mere craving.
  assert.equal(prog.detectIntent('ha\'u fuma tiha'), 'relapse');
  assert.equal(prog.detectIntent('hau fuma fali ohin'), 'relapse');
});

test('replyTo always answers, with a type and non-empty Tetun text', () => {
  for (const input of ['hakarak', 'ha\'u fuma tiha', 'tulun', 'osan', 'saude', 'jogu', 'dada iis', 'di\'ak', 'blah']) {
    const reply = prog.replyTo(input, { saved: '$10.00', notSmoked: '100', smokeFreeText: 'loron 5', seed: 1 });
    assert.ok(reply.text.length > 10, `resposta mamuk ba "${input}"`);
    assert.ok(reply.type, `laiha tipu ba "${input}"`);
  }
});

test('replyTo interpolates the person\'s real numbers', () => {
  const reply = prog.replyTo('osan', { saved: '$42.50', notSmoked: '212', seed: 1 });
  assert.match(reply.text, /\$42\.50/);
  assert.match(reply.text, /212/);
  assert.equal(reply.action, 'money');
});

test('craving reply offers the SOS tools', () => {
  const reply = prog.replyTo('hakarak', { seed: 1 });
  assert.equal(reply.type, 'coping');
  assert.equal(reply.action, 'sos');
  assert.ok(reply.quick.includes('game'));
});

test('relapse reply is never shaming and routes to the plan', () => {
  const reply = prog.replyTo('ha\'u fuma tiha', { seed: 1 });
  assert.equal(reply.type, 'relapse');
  assert.equal(reply.action, 'plan');
});

test('assessReply branches on the answer', () => {
  assert.equal(prog.assessReply('clean').type, 'motivation');
  assert.equal(prog.assessReply('smoked').type, 'relapse');
});

test('copingTip returns a line from the pool', () => {
  assert.ok(COPING_POOL.includes(prog.copingTip(0)));
  assert.ok(COPING_POOL.includes(prog.copingTip(12345678)));
});

/* ================================================================== */
/* Content integrity                                                  */
/* ================================================================== */

test('message library is large enough for a 6-month programme', () => {
  const stats = libraryStats();
  assert.ok(stats.explicit >= 60, `mensajen eskritu: ${stats.explicit}`);
  assert.ok(stats.maintain >= 25);
  assert.ok(stats.coping >= 12);
  assert.ok(stats.relapse >= 6);
  assert.equal(stats.assess, ASSESS_DAYS.length);
});

test('no scheduled message collides on the same day and slot', () => {
  const seen = new Set();
  for (const m of EXPLICIT) {
    const key = `${m.day}:${m.slot}`;
    assert.ok(!seen.has(key), `duplikadu: ${key}`);
    seen.add(key);
  }
});

test('every authored message sits inside a defined schedule band', () => {
  for (const m of EXPLICIT) {
    const band = SCHEDULE.find((b) => m.day >= b.fromDay && m.day <= b.toDay);
    assert.ok(band, `loron ${m.day} laiha banda`);
    assert.ok(band.slots.includes(m.slot), `slot ${m.slot} la validu iha loron ${m.day}`);
  }
});

test('no message mentions a cigarette brand or contains a phone number', () => {
  const all = [
    ...EXPLICIT.map((m) => m.text),
    ...MAINTAIN_POOL.map((m) => m.text),
    ...COPING_POOL,
    ...RELAPSE_POOL,
    ...QUOTES,
  ];
  for (const text of all) {
    assert.ok(!/\d{3}[\s-]?\d{4}/.test(text), `iha númeru telefone: ${text}`);
    assert.ok(!/marlboro|dunhill|gudang|sampoerna|djarum/i.test(text), `iha marka: ${text}`);
  }
});

test('milestone timeline is ordered and covers 20 min to 15 years', () => {
  for (let i = 1; i < MILESTONES.length; i++) {
    assert.ok(MILESTONES[i].ms > MILESTONES[i - 1].ms, 'kronolojia la iha orden');
  }
  assert.equal(MILESTONES[0].ms, 20 * 60000);
  assert.equal(MILESTONES.at(-1).ms, 15 * 365 * DAY);
  for (const m of MILESTONES) {
    assert.ok(m.id && m.when && m.title && m.body && m.icon);
  }
});

test('milestones reached/next agree at the boundary', () => {
  const twoDays = 2 * DAY;
  const done = reached(twoDays);
  assert.ok(done.length > 0);
  assert.ok(done.every((m) => m.ms <= twoDays));
  const upcoming = nextMilestone(twoDays);
  assert.ok(upcoming.ms > twoDays);
  assert.equal(done.length + 1, MILESTONES.indexOf(upcoming) + 1);

  assert.equal(nextMilestone(20 * 365 * DAY), null);
  assert.equal(progressToNext(20 * 365 * DAY), 1);
  const p = progressToNext(DAY);
  assert.ok(p >= 0 && p <= 1);
});

test('quoteOfTheDay is stable within a day and changes across days', () => {
  const a = quoteOfTheDay(new Date(2026, 2, 15, 1));
  const b = quoteOfTheDay(new Date(2026, 2, 15, 23));
  assert.equal(a, b);
  assert.ok(QUOTES.includes(a));
  const c = quoteOfTheDay(new Date(2026, 2, 16, 1));
  assert.notEqual(a, c);
});

test('trigger and withdrawal cards are complete', () => {
  assert.ok(TRIGGERS.length >= 6);
  for (const trig of TRIGGERS) {
    assert.ok(trig.id && trig.icon && trig.label && trig.why);
    assert.ok(Array.isArray(trig.plan) && trig.plan.length >= 3, `planu kurtu: ${trig.id}`);
  }
  assert.ok(WITHDRAWAL.length >= 6);
  for (const w of WITHDRAWAL) assert.ok(w.what && w.when && w.do);
  assert.ok(REASONS.length >= 8);
});

/* ================================================================== */
/* Fagerström                                                         */
/* ================================================================== */

test('Fagerström scoring spans 0 to 10', () => {
  assert.equal(QUESTIONS.length, 6);
  const min = QUESTIONS.map((q) => q.options.reduce((lo, o) => Math.min(lo, o.points), Infinity));
  const max = QUESTIONS.map((q) => q.options.reduce((hi, o) => Math.max(hi, o.points), -Infinity));
  assert.equal(min.reduce((a, b) => a + b, 0), 0);
  assert.equal(max.reduce((a, b) => a + b, 0), MAX_SCORE);
});

test('Fagerström score sums chosen options and ignores blanks', () => {
  assert.equal(ftndScore([null, null, null, null, null, null]), 0);
  assert.equal(ftndScore([0, 0, 0, 0, 0, 0]), 3 + 1 + 1 + 0 + 1 + 1);
  assert.equal(ftndScore([]), 0);
});

test('Fagerström bands route high dependence to a health service', () => {
  assert.equal(levelFor(0).id, 'verylow');
  assert.equal(levelFor(2).id, 'verylow');
  assert.equal(levelFor(4).id, 'low');
  assert.equal(levelFor(5).id, 'medium');
  assert.equal(levelFor(7).id, 'high');
  assert.equal(levelFor(10).id, 'veryhigh');
  assert.equal(levelFor(8).advice, 'test.advice.high');
  assert.equal(levelFor(1).advice, 'test.advice.low');
});

/* ================================================================== */
/* Rewards                                                            */
/* ================================================================== */

test('reward goals are ordered and priced in USD', () => {
  for (let i = 1; i < REWARDS.length; i++) {
    assert.ok(REWARDS[i].cost > REWARDS[i - 1].cost, 'meta la iha orden');
  }
  assert.ok(REWARDS.every((r) => r.icon && r.label && r.cost > 0));
});

test('next reward is the cheapest not yet affordable', () => {
  assert.equal(nextReward(0).cost, REWARDS[0].cost);
  const goal = nextReward(11);
  assert.ok(goal.cost > 11);
  assert.equal(nextReward(999999), null);
});

test('custom goals merge into the sorted list', () => {
  const merged = allRewards([{ id: 'c1', name: 'Bisikleta oan nian', label: 'Bisikleta oan nian', cost: 4 }]);
  const costs = merged.map((r) => r.cost);
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b));
  assert.ok(merged.some((r) => r.custom));
});

test('daysUntil handles a zero saving rate instead of returning Infinity', () => {
  assert.equal(daysUntil(REWARDS[3], 0, 0), null);
  assert.equal(daysUntil(null, 0, 1), null);
  assert.equal(daysUntil({ cost: 10 }, 10, 1), 0);
  assert.equal(daysUntil({ cost: 10 }, 0, 2), 5);
  assert.equal(daysUntil({ cost: 10 }, 0, 3), 4); // rounds up
});

/* ================================================================== */
/* Badges                                                            */
/* ================================================================== */

test('badges unlock on time and on effort', () => {
  assert.deepEqual(earned({}), []);

  const oneWeek = earned({ smokeFreeMs: 7 * DAY }).map((b) => b.id);
  assert.ok(oneWeek.includes('b_1d'));
  assert.ok(oneWeek.includes('b_3d'));
  assert.ok(oneWeek.includes('b_1w'));
  assert.ok(!oneWeek.includes('b_2w'));

  // Effort badges are reachable even on day 0, which is the point: a hard week
  // with no clean days should still earn something.
  const effort = earned({ smokeFreeMs: 0, cravingsBeaten: 10, diaryCount: 5, gamesPlayed: 5, postCount: 1, hasPlan: true })
    .map((b) => b.id);
  assert.ok(effort.includes('b_crave1'));
  assert.ok(effort.includes('b_crave10'));
  assert.ok(effort.includes('b_diary5'));
  assert.ok(effort.includes('b_game5'));
  assert.ok(effort.includes('b_post1'));
  assert.ok(effort.includes('b_plan'));
});

test('every badge has share text and a unique id', () => {
  const ids = new Set();
  for (const b of BADGES) {
    assert.ok(!ids.has(b.id), `id duplikadu: ${b.id}`);
    ids.add(b.id);
    assert.ok(b.icon && b.title && b.desc && b.share, `konkista inkompletu: ${b.id}`);
  }
});

/* ================================================================== */
/* Minigame                                                          */
/* ================================================================== */

test('board is fully paired and sized to the level', () => {
  for (const def of LEVELS) {
    const game = new MemoryGame({ level: def.id });
    assert.equal(game.cards.length, def.cols * def.rows);
    assert.equal(game.pairsTotal, (def.cols * def.rows) / 2);
    const counts = new Map();
    for (const c of game.cards) counts.set(c.symbol, (counts.get(c.symbol) || 0) + 1);
    for (const [symbol, n] of counts) assert.equal(n, 2, `${symbol} la iha pár`);
  }
});

test('board carries no smoking cues', () => {
  const game = new MemoryGame({ level: 2 });
  for (const c of game.cards) {
    assert.ok(!['🚬', '🔥', '🧨', '💨'].includes(c.symbol), `símbolu fuma: ${c.symbol}`);
  }
});

test('matching a pair marks both done and counts one move', () => {
  const game = new MemoryGame({ level: 0, rand: () => 0 });
  const first = game.cards[0];
  const twin = game.cards.findIndex((c, i) => i !== 0 && c.symbol === first.symbol);
  assert.equal(game.flip(0), 'ignored');       // one card up, no move yet
  assert.equal(game.moves, 0);
  assert.equal(game.flip(twin), 'match');
  assert.equal(game.moves, 1);
  assert.ok(game.cards[0].done && game.cards[twin].done);
  assert.equal(game.pairsFound, 1);
});

test('a mismatch stays visible until resolve(), then flips back', () => {
  const game = new MemoryGame({ level: 1, rand: () => 0 });
  const a = 0;
  const b = game.cards.findIndex((c, i) => i !== a && c.symbol !== game.cards[a].symbol);
  game.flip(a);
  assert.equal(game.flip(b), 'miss');
  assert.ok(game.busy, 'tenke bloke');
  assert.equal(game.flip(2), 'ignored', 'la bele foti kartaun bainhira bloke');
  assert.ok(game.cards[a].up && game.cards[b].up);
  game.resolve();
  assert.ok(!game.cards[a].up && !game.cards[b].up);
  assert.ok(!game.busy);
});

test('re-flipping a face-up or finished card is ignored', () => {
  const game = new MemoryGame({ level: 0, rand: () => 0 });
  game.flip(0);
  assert.equal(game.flip(0), 'ignored');
  assert.equal(game.moves, 0);
});

test('the game completes and records an elapsed time', () => {
  const game = new MemoryGame({ level: 0, rand: () => 0 });
  // Play perfectly: pair up every symbol.
  const bySymbol = new Map();
  game.cards.forEach((c) => {
    const list = bySymbol.get(c.symbol) || [];
    list.push(c.i);
    bySymbol.set(c.symbol, list);
  });
  for (const [, [a, b]] of bySymbol) {
    game.flip(a);
    game.flip(b);
  }
  assert.ok(game.done);
  assert.equal(game.pairsFound, game.pairsTotal);
  assert.equal(game.moves, game.pairsTotal);
  assert.ok(game.finishedAt >= game.startedAt);
  assert.equal(game.flip(0), 'ignored', 'la bele halimar depois hotu');
});

test('isBest ranks by moves, then by time', () => {
  assert.ok(isBest(null, { moves: 20, ms: 9000 }));
  assert.ok(isBest({ moves: 20, ms: 5000 }, { moves: 18, ms: 9000 }));
  assert.ok(!isBest({ moves: 18, ms: 9000 }, { moves: 20, ms: 5000 }));
  assert.ok(isBest({ moves: 18, ms: 9000 }, { moves: 18, ms: 8000 }));
  assert.ok(!isBest({ moves: 18, ms: 8000 }, { moves: 18, ms: 9000 }));
});
