#!/usr/bin/env node
/**
 * BAKE — fold the live review overlay back into the source files.
 *
 * Corrections from the review tool go live as data (server/review.js) so the
 * reviewer never waits for a deploy. That overlay is not meant to be permanent:
 * this command writes the corrections into js/i18n.js and js/content/*.js, so
 * they land in git, survive a wiped volume, and ship with the app.
 *
 * This is NOT an approval step — the corrections have been live for a while by
 * the time it runs. It is consolidation, and it is deliberately paranoid,
 * because it is the one part of the system that edits source code:
 *
 *   1. a correction whose original text has changed in the source since it was
 *      written is REFUSED, never silently overwritten
 *   2. after rewriting, every string in the app is re-extracted and compared:
 *      the baked ones must equal the new text, and every other one must be
 *      byte-identical
 *   3. any discrepancy at all restores every file and aborts
 *
 * Usage:
 *   node tools/translation-bake.mjs [--data <dir>] [--dry] [--clear] [--yes]
 *
 *   --data <dir>  where review.json lives (default: $DATA_DIR or server/data)
 *   --dry         report what would change, write nothing
 *   --clear       empty the overlay afterwards, keeping the history
 *   --yes         skip the confirmation prompt
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { extract, hash, validate } from './translation.mjs';
import { FILES } from '../app/js/textmap.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const DATA_DIR = opt('--data', process.env.DATA_DIR || path.join(ROOT, 'server', 'data'));
const REVIEW_FILE = path.join(DATA_DIR, 'review.json');

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

/** A string as the source files write it: single-quoted, escaped. */
const literal = (s) => `'${String(s)
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\n/g, '\\n')}'`;

function countOccurrences(haystack, needle) {
  let n = 0;
  let i = 0;
  for (;;) {
    i = haystack.indexOf(needle, i);
    if (i === -1) return n;
    n++;
    i += needle.length;
  }
}

/**
 * Replace one string in one file's text.
 *
 * i18n.js keys are anchored to their own line, which is what makes the 69
 * repeated short labels ("Dada iis", "Konkista") safe to rewrite. Everywhere
 * else the literal is unique in its file, and anything that is not is refused
 * rather than guessed at.
 */
function rewrite(src, unit, next) {
  const from = literal(unit.source);
  const to = literal(next);

  if (unit.id.startsWith('i18n:')) {
    const key = unit.id.slice('i18n:'.length);
    const re = new RegExp(
      `^(\\s*'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*)${
        from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(,?\\s*)$`,
      'm',
    );
    if (!re.test(src)) return { error: 'could not find its line' };
    return { src: src.replace(re, (_m, a, b) => `${a}${to}${b}`) };
  }

  const hits = countOccurrences(src, from);
  if (hits === 0) return { error: 'not found in the file' };
  if (hits > 1) return { error: `found ${hits} times — ambiguous` };
  return { src: src.replace(from, to) };
}

/* ------------------------------------------------------------------ */

async function main() {
  let review;
  try {
    review = JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf8'));
  } catch {
    console.error(red(`Could not read ${REVIEW_FILE}`));
    console.error(dim('Pass --data <dir>, or copy review.json down from the server.'));
    process.exit(1);
  }

  const overlay = review.text || {};
  const ids = Object.keys(overlay);
  if (!ids.length) {
    console.log('No corrections waiting to be baked in.');
    return;
  }

  const units = new Map(extract().map((u) => [u.id, u]));

  const todo = [];
  const skipped = [];
  for (const id of ids) {
    const unit = units.get(id);
    if (!unit) { skipped.push([id, 'no longer exists in the app']); continue; }
    if (unit.source === overlay[id]) continue;           // already baked
    // The overlay was written against a specific original. If that original has
    // since changed in the source, the correction may no longer make sense.
    if (review.history) {
      const last = [...review.history].reverse().find((h) => h.id === id);
      if (last && last.from !== unit.source && hash(last.from) !== unit.hash) {
        skipped.push([id, 'the original text has changed since — needs re-reviewing']);
        continue;
      }
    }
    const verdict = validate(unit.source, overlay[id]);
    if (!verdict.ok) { skipped.push([id, `invalid: ${verdict.error}`]); continue; }
    todo.push({ unit, next: overlay[id] });
  }

  console.log(bold(`\n${todo.length} correction(s) to write into the source`)
    + (skipped.length ? dim(`  (${skipped.length} skipped)`) : ''));

  const byFile = new Map();
  for (const t of todo) {
    if (!byFile.has(t.unit.file)) byFile.set(t.unit.file, []);
    byFile.get(t.unit.file).push(t);
  }
  for (const [file, list] of byFile) {
    console.log(`\n${bold(FILES[file])}  ${dim(`${list.length} change(s)`)}`);
    for (const { unit, next } of list.slice(0, 40)) {
      console.log(`  ${dim(unit.id)}`);
      console.log(`    ${red(`- ${unit.source}`)}`);
      console.log(`    ${green(`+ ${next}`)}`);
    }
    if (list.length > 40) console.log(dim(`  … and ${list.length - 40} more`));
  }
  if (skipped.length) {
    console.log(bold('\nSkipped:'));
    for (const [id, why] of skipped) console.log(`  ${dim(id)}  ${why}`);
  }

  if (!todo.length) return;
  if (flag('--dry')) { console.log(dim('\n--dry: nothing written.')); return; }

  if (!flag('--yes') && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((r) => rl.question(`\nWrite to ${byFile.size} file(s)? [y/N] `, r));
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) { console.log('Cancelled.'); return; }
  }

  /* ---- write, with the originals kept for a full restore ---- */
  const backups = new Map();
  const failures = [];
  try {
    for (const [file, list] of byFile) {
      const abs = path.join(ROOT, FILES[file]);
      let src = fs.readFileSync(abs, 'utf8');
      backups.set(abs, src);
      for (const { unit, next } of list) {
        const r = rewrite(src, unit, next);
        if (r.error) { failures.push([unit.id, r.error]); continue; }
        src = r.src;
      }
      fs.writeFileSync(abs, src);
    }
    if (failures.length) throw new Error(`could not rewrite ${failures.length} string(s)`);

    /* ---- verify: re-read every string from the rewritten modules ---- */
    const expected = new Map();
    for (const [id, unit] of units) expected.set(id, unit.source);
    for (const { unit, next } of todo) expected.set(unit.id, next);

    // Re-read in a FRESH PROCESS. Re-importing in this one would not work: a
    // `?v=` query busts only the module named, never the graph underneath it,
    // so i18n.js and content/*.js would still be the copies loaded before the
    // rewrite — and the check would happily confirm its own stale data.
    // A child process is the only way to be sure we are reading the files that
    // are now on disk, which is exactly what we are trying to verify.
    const after = new Map(Object.entries(JSON.parse(execFileSync('node', [
      '--input-type=module', '-e',
      `import { extract } from ${JSON.stringify(path.join(ROOT, 'tools', 'translation.mjs'))};
       process.stdout.write(JSON.stringify(Object.fromEntries(extract().map((u) => [u.id, u.source]))));`,
    ], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }))));

    const drift = [];
    for (const [id, want] of expected) {
      const got = after.get(id);
      if (got !== want) drift.push([id, want, got]);
    }
    for (const id of after.keys()) if (!expected.has(id)) drift.push([id, '(la iha)', after.get(id)]);

    if (drift.length) {
      console.error(red(`\nVerification failed: ${drift.length} string(s) are not what they should be.`));
      for (const [id, want, got] of drift.slice(0, 10)) {
        console.error(`  ${id}\n    expected: ${JSON.stringify(want)}\n    got:      ${JSON.stringify(got)}`);
      }
      throw new Error('drift');
    }

    console.log(green(`\n✓ ${todo.length} correction(s) written, and verified: nothing else changed.`));

    /* ---- the project's own tests are the last word ---- */
    console.log(dim('npm test…'));
    execFileSync('npm', ['test'], { cwd: ROOT, stdio: 'pipe' });
    console.log(green('✓ npm test'));
  } catch (err) {
    for (const [abs, original] of backups) fs.writeFileSync(abs, original);
    console.error(red(`\n✗ Aborted: ${err.message}. All files restored.`));
    for (const [id, why] of failures) console.error(`  ${id}: ${why}`);
    process.exit(1);
  }

  if (flag('--clear')) {
    review.text = {};
    review.version = (review.version || 0) + 1;
    fs.writeFileSync(REVIEW_FILE, JSON.stringify(review));
    console.log(dim('Overlay cleared (the history is kept).'));
  } else {
    console.log(dim('\nThe server overlay still holds these — now identical to the source, so applying it is a no-op.'));
    console.log(dim('Use --clear to empty it.'));
  }
}

main().catch((err) => { console.error(red(String(err))); process.exit(1); });
