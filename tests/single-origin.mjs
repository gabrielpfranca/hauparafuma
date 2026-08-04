/**
 * TESTE ORIJEN IDA — the topology we actually deploy.
 *
 * `tests/smoke.mjs` runs the app and the API on two different origins, which
 * exercises CORS and the manual `apiBase` override. Production is the opposite:
 * `server/server.js` serves both, and the community has to work with the person
 * never opening a settings screen. This test covers that path.
 *
 * It also guards the bug that made it necessary: when the API and the static
 * app share an origin, a per-IP rate limit that counts asset requests will
 * exhaust itself during page load and take the community down with it.
 *
 * Usage: node tests/single-origin.mjs
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT || 8097);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = join(repo, 'server', 'data-single-origin-test');

rmSync(DATA, { recursive: true, force: true });

const srv = spawn(process.execPath, [join(repo, 'server', 'server.js')], {
  cwd: repo,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: DATA },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

function cleanup() {
  try { srv.kill(); } catch { /* already gone */ }
  rmSync(DATA, { recursive: true, force: true });
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

let up = false;
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(`${BASE}/api/health`)).ok) { up = true; break; }
  } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 100));
}
if (!up) {
  cleanup();
  throw new Error(`servidór la hahú iha ${BASE}`);
}

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass += 1; console.log(`  ✓ ${msg}`); } else { fail += 1; console.log(`  ✗ ${msg}`); }
};

const browser = await chromium.launch();

/** A device that has finished onboarding and has never seen a settings screen. */
async function device(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => window.__hpf);
  await page.evaluate(() => {
    window.__hpf.store.update((st) => {
      st.onboarded = true;
      st.createdAt = Date.now();
      st.profile.nickname = `Belun${Math.floor(Math.random() * 99)}`;
      st.quit.date = Date.now() - 3 * 86400000;
      st.quit.startedAt = st.quit.date;
      st.community.deviceId = `dev${Math.floor(Math.random() * 1e9)}`;
    }, 'test');
  });
  await page.reload();
  await page.waitForFunction(() => window.__hpf);
  // Wait for the origin probe to land.
  await page.waitForFunction(
    () => window.__hpf.store.get().settings.apiDetected !== '',
    null,
    { timeout: 15000 },
  ).catch(() => { /* asserted below */ });
  return page;
}

console.log('\n▸ Orijen ida, sem konfigurasaun');

const p1 = await device(await browser.newContext());

ok(
  await p1.evaluate(() => window.__hpf.store.get().settings.apiDetected) === BASE,
  'the app finds its own community server',
);
ok(
  await p1.evaluate(() => window.__hpf.community.mode()) === 'remote',
  'the community is live without anybody configuring it',
);
ok(
  await p1.evaluate(() => window.__hpf.store.get().settings.apiBase) === '',
  'no manual server override was needed',
);

await p1.goto(`${BASE}/index.html#/komunidade`);
await p1.waitForTimeout(1200);
ok(
  !(await p1.textContent('body')).includes('Modu lokál'),
  'the local-mode warning is not shown',
);

await p1.goto(`${BASE}/index.html#/hau`);
await p1.waitForTimeout(800);
ok(
  !/Servid[óo]r/i.test(await p1.textContent('body')),
  'Ha\'u offers no community-server field',
);

console.log('\n▸ Publika no haree husi seluk');

const posted = await p1.evaluate(() => window.__hpf.community.post({
  text: 'Ohin loron ha\'u la fuma', tag: 'win',
}));
ok(posted.ok && !posted.queued, 'a post reaches the server instead of queueing');

const p2 = await device(await browser.newContext());
const feed = await p2.evaluate(() => window.__hpf.community.feed());
ok(feed.mode === 'remote', 'a second device is live with no configuration either');
ok(feed.posts.some((x) => x.text.includes('la fuma')), 'the second device sees the first one\'s post');

console.log('\n▸ Limite la tara asesu ba aplikasaun');

// Loading the app is dozens of module requests. If those were rate-limited,
// the API would start refusing before anyone got to post.
let served = 0;
for (let i = 0; i < 80; i++) {
  const res = await fetch(`${BASE}/js/app.js`);
  if (res.ok) served += 1;
}
ok(served === 80, 'static assets are never rate-limited');
ok((await fetch(`${BASE}/api/health`)).ok, 'the API still answers after heavy asset traffic');

console.log(`\n────────────────────────────────────────────────────`);
console.log(`Rezultadu: ${pass} pass, ${fail} fail`);

await browser.close();
cleanup();
process.exit(fail ? 1 : 0);
