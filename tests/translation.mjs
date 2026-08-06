/**
 * Teste revizaun tradusaun.
 *
 * Run: npm run test:i18n
 *
 * The review tool edits the app's own text, so the risk it carries is not a
 * crash — it is a correction landing on the wrong string, or a placeholder
 * quietly disappearing and rendering "loron" with no number on someone's
 * screen. These tests are about that class of failure.
 *
 * The bake test works on a COPY of the source tree. It must never write to the
 * repository.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { extract, hash, validate, placeholders } from '../tools/translation.mjs';
import { entries, collect, apply, FILES } from '../app/js/textmap.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ */
/* Enderesu                                                            */
/* ------------------------------------------------------------------ */

test('every reviewable string has a unique, stable id', () => {
  const ids = entries().map((e) => e.id);
  assert.ok(ids.length > 700, `expected the whole app's text, got ${ids.length}`);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids would let one correction overwrite another');
  // A second call must produce the same ids in the same order, or a reviewer's
  // saved position would drift between sessions.
  assert.deepEqual(entries().map((e) => e.id), ids);
});

test('ids cover every content file and carry no empty text', () => {
  const files = new Set(extract().map((u) => u.file));
  for (const name of Object.keys(FILES)) {
    assert.ok(files.has(name), `${name} contributes no reviewable text`);
  }
  for (const u of extract()) {
    assert.equal(typeof u.source, 'string');
    assert.ok(u.source.length > 0, `${u.id} is empty`);
  }
});

test('the referral text and health claims are reviewed first', () => {
  const list = extract();
  // Priority 1 must come first in the list the reviewer is handed.
  const firstNonClinical = list.findIndex((u) => u.priority > 1);
  assert.ok(list.slice(0, firstNonClinical).every((u) => u.priority === 1));
  // The facility list is the highest-stakes text in the app.
  const csc = list.find((u) => u.id === 'services:csc.name');
  assert.ok(csc, 'the health facility list must be reviewable');
  assert.equal(csc.priority, 1);
});

/* ------------------------------------------------------------------ */
/* Aplika overlay                                                      */
/* ------------------------------------------------------------------ */

test('an overlay reaches every kind of string, and touches nothing else', () => {
  const before = collect();
  const samples = [
    'i18n:sos.title',                 // flat map
    'quotes:3',                       // array of plain strings
    'messages:d-7.s0.text',           // record addressed by day and slot
    'messages:coping.0',              // pool entry by index
    'messages:assess.7',              // object keyed by number
    'badges:b_1d.share',              // record by id
    'coping:triggers.coffee.plan.0',  // nested array of strings
    'fagerstrom:q1.options.0.label',  // nested array of records
    'services:csc.note',              // the file that used to live in a view
  ];
  const overlay = Object.fromEntries(samples.map((id, i) => [id, `KORRISAUN ${i}`]));

  const applied = apply(overlay);
  assert.equal(applied, samples.length);

  const after = collect();
  const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
  assert.deepEqual(changed.sort(), [...samples].sort());

  apply(before);  // put the modules back for the other tests
  assert.deepEqual(collect(), before);
});

test('an overlay with unknown or empty values is ignored, not fatal', () => {
  const before = collect();
  assert.equal(apply({ 'i18n:naun.existe': 'x', 'quotes:99999': 'y' }), 0);
  assert.equal(apply({ 'quotes:0': '' }), 0);
  assert.equal(apply({ 'quotes:0': null }), 0);
  assert.equal(apply(null), 0);
  assert.deepEqual(collect(), before);
});

/* ------------------------------------------------------------------ */
/* Validasaun                                                          */
/* ------------------------------------------------------------------ */

test('placeholders must survive a correction', () => {
  assert.equal(validate('Medalla {n} husi {t}', 'Medalla husi {t}').ok, false);
  assert.equal(validate('Medalla {n} husi {t}', 'Medalla {n} husi {t} tan').ok, true);
  // Order may change — Tetun word order is exactly what the reviewer is fixing.
  assert.equal(validate('Medalla {n} husi {t}', '{t} nia laran, medalla {n}').ok, true);
  assert.equal(validate('loron {n}', 'loron').ok, false);
  assert.equal(validate('loron {n}', 'loron {n} liu ba').ok, true);
});

test('empty, oversized and marked-up corrections are refused', () => {
  assert.equal(validate('ok', '').ok, false);
  assert.equal(validate('ok', '   ').ok, false);
  assert.equal(validate('ok', 'x'.repeat(5000)).ok, false);
  assert.equal(validate('ok', '<b>x</b>').ok, false);
  assert.equal(validate('ok', '<script>alert(1)</script>').ok, false);
  // A bare comparison is not markup and must still be allowed through.
  assert.equal(validate('ok', 'ita < 5 sigarru').ok, true);
});

test('placeholders() finds the slots the app interpolates', () => {
  assert.deepEqual(placeholders('Medalla {n} husi {t}'), ['{n}', '{t}']);
  assert.deepEqual(placeholders('laiha'), []);
});

test('the hash changes when the source text changes', () => {
  assert.equal(hash('Di\'ak'), hash('Di\'ak'));
  assert.notEqual(hash('Di\'ak'), hash('Diak'));
});

/* ------------------------------------------------------------------ */
/* Referénsia inglés — reading aid for the reviewer, never authoritative */
/* ------------------------------------------------------------------ */

test('every unit carries an english field: a string when glossed, null otherwise', () => {
  for (const u of extract()) {
    assert.ok(u.english === null || (typeof u.english === 'string' && u.english.length > 0),
      `${u.id} has an unexpected english value: ${JSON.stringify(u.english)}`);
  }
});

test('an english gloss is looked up by content hash, not id — and a missing file is not fatal', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hpf-en-'));
  try {
    for (const rel of ['app', 'tools']) {
      fs.cpSync(path.join(ROOT, rel), path.join(dir, rel), { recursive: true });
    }
    // Delete whatever real glosses ship in the repo, so this test is not at the
    // mercy of their content — it plants its own and checks the wiring only.
    fs.rmSync(path.join(dir, 'tools', 'translation-en.json'), { force: true });

    const probe = (extraFile) => execFileSync('node', ['--input-type=module', '-e', `
      import { extract } from ${JSON.stringify(path.join(dir, 'tools', 'translation.mjs'))};
      const u = extract().find((x) => x.id === 'i18n:ok');
      process.stdout.write(JSON.stringify(u.english));
    `], { cwd: dir, encoding: 'utf8' });

    assert.equal(probe(), 'null', 'no translation-en.json at all must not crash extract()');

    const target = extract().find((u) => u.id === 'i18n:ok');
    fs.writeFileSync(path.join(dir, 'tools', 'translation-en.json'),
      JSON.stringify({ [target.hash]: 'OK' }));
    assert.equal(probe(), '"OK"', 'a gloss keyed by the right content hash must surface');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ */
/* Bake — on a copy of the tree, never the repository                  */
/* ------------------------------------------------------------------ */

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hpf-bake-'));
  for (const rel of ['app', 'tools', 'package.json']) {
    fs.cpSync(path.join(ROOT, rel), path.join(dir, rel), { recursive: true });
  }
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  // The bake step runs `npm test`; give it something that passes trivially so
  // the test is about baking, not about the rest of the suite.
  fs.writeFileSync(path.join(dir, 'tests', 'unit.mjs'), 'import{test}from"node:test";test("ok",()=>{});\n');
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  return dir;
}

function runBake(dir, review, args = []) {
  fs.writeFileSync(path.join(dir, 'data', 'review.json'), JSON.stringify(review));
  return execFileSync('node', [
    path.join(dir, 'tools', 'translation-bake.mjs'),
    '--data', path.join(dir, 'data'), '--yes', ...args,
  ], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
}

test('bake writes corrections into the source and changes nothing else', () => {
  const dir = sandbox();
  try {
    const changes = {
      // A short label that appears five times in i18n.js — only the addressed
      // key may change.
      'i18n:sos.breathe': 'Dada iis neineik',
      'quotes:0': 'Loron ida-idak, ita sai forte liu duni.',
      'services:csc.note': 'Iha kada munisípiu. Servisu gratis.',
      'coping:triggers.coffee.plan.0': 'Hemu kafé iha fatin seluk.',
    };
    const out = runBake(dir, { text: changes, history: [] });
    assert.match(out, /verified: nothing else changed/);

    const i18nSrc = fs.readFileSync(path.join(dir, 'app/js/i18n.js'), 'utf8');
    assert.match(i18nSrc, /'sos\.breathe':\s*'Dada iis neineik'/);
    // The other four "Dada iis" entries must be untouched.
    assert.match(i18nSrc, /'breathe\.title':\s*'Dada iis'/);
    assert.match(i18nSrc, /'tools\.breathe':\s*'Dada iis'/);

    const services = fs.readFileSync(path.join(dir, 'app/js/content/services.js'), 'utf8');
    assert.match(services, /Iha kada munisípiu\. Servisu gratis\./);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bake round-trips apostrophes, newlines and placeholders exactly', () => {
  const dir = sandbox();
  try {
    const tricky = {
      'i18n:ok': 'Di\'ak ha\'u nia belun',                  // escaped quotes
      'i18n:badge.count': 'Husi {t}, ita iha {n}',          // both placeholders
      'i18n:ob.welcome.body': 'Liña ida\nLiña rua\n\nLiña tolu',  // newlines
    };
    runBake(dir, { text: tricky, history: [] });

    // Read the values back through the module, not the raw file: this asserts
    // the escaping is right, not merely that some bytes were written.
    const mod = execFileSync('node', ['--input-type=module', '-e', `
      import { rawStrings } from '${path.join(dir, 'app/js/i18n.js')}';
      const s = rawStrings();
      console.log(JSON.stringify({
        ok: s['ok'], count: s['badge.count'], body: s['ob.welcome.body'],
      }));`], { encoding: 'utf8' });
    const got = JSON.parse(mod);
    assert.equal(got.ok, tricky['i18n:ok']);
    assert.equal(got.count, tricky['i18n:badge.count']);
    assert.equal(got.body, tricky['i18n:ob.welcome.body']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bake refuses a correction whose original has since changed', () => {
  const dir = sandbox();
  try {
    const out = runBake(dir, {
      text: { 'quotes:0': 'Testu foun' },
      // The reviewer corrected a different original from the one in the file.
      history: [{ id: 'quotes:0', from: 'TESTU NE\'EBÉ LA IHA ONA', to: 'Testu foun', at: 1 }],
    });
    assert.match(out, /original text has changed/);
    const quotes = fs.readFileSync(path.join(dir, 'app/js/content/quotes.js'), 'utf8');
    assert.ok(!quotes.includes('Testu foun'), 'a stale correction must not be written');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bake refuses an invalid correction even if it reached the overlay', () => {
  const dir = sandbox();
  try {
    const out = runBake(dir, { text: { 'i18n:badge.count': 'Medalla barak' }, history: [] });
    assert.match(out, /invalid: placeholder/);
    const src = fs.readFileSync(path.join(dir, 'app/js/i18n.js'), 'utf8');
    assert.match(src, /'badge\.count':\s*'Medalla \{n\} husi \{t\}'/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--dry reports the changes without writing them', () => {
  const dir = sandbox();
  try {
    const before = fs.readFileSync(path.join(dir, 'app/js/content/quotes.js'), 'utf8');
    const out = runBake(dir, { text: { 'quotes:0': 'Testu foun' }, history: [] }, ['--dry']);
    assert.match(out, /Testu foun/);
    assert.equal(fs.readFileSync(path.join(dir, 'app/js/content/quotes.js'), 'utf8'), before);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ */
/* Nothing may hide outside the reviewable surface                     */
/* ------------------------------------------------------------------ */

test('no user-visible Tetun is left outside i18n.js and content/', () => {
  const skip = (f) => f.endsWith('i18n.js') || f.includes(`content${path.sep}`);
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) files.push(p);
    }
  })(path.join(ROOT, 'app', 'js'));

  // Tetun-specific markers. A hit means visible text was written inline in a
  // view instead of going through i18n — the review would never see it, which
  // is exactly how the health-facility list was nearly missed.
  const TETUN = /(ha'u|di'ak|ne'e|sigarru|loron|hakarak|obrigadu|labele|tulun|[áéíóú])/i;

  /** Matching keywords and file names are not display text. */
  const ALLOW = [/programme\.js$/, /views[/\\]me\.js$/];

  const offenders = [];
  for (const f of files) {
    if (skip(f) || ALLOW.some((r) => r.test(f))) continue;
    for (const [i, line] of fs.readFileSync(f, 'utf8').split('\n').entries()) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      for (const m of line.matchAll(/'((?:[^'\\]|\\.){6,}?)'|`((?:[^`\\]|\\.){6,}?)`/g)) {
        const s = m[1] ?? m[2];
        if (!s || /^[a-z0-9._/#>[\]=-]+$/i.test(s)) continue;
        if (TETUN.test(s)) offenders.push(`${path.relative(ROOT, f)}:${i + 1}  ${JSON.stringify(s)}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    `visible text outside the reviewable files:\n${offenders.join('\n')}`);
});
