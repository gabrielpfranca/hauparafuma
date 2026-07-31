/**
 * Teste smoke — drives the real app in a mobile-sized Chromium.
 *
 * Run: npm run test:smoke
 *
 * Covers the whole path a person actually takes: onboarding → dashboard →
 * two-way messaging → community post → minigame → tools → profile, plus the
 * offline guarantee. Writes screenshots to tests/screens/.
 *
 * Uses the preinstalled Chromium (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers);
 * never run `playwright install`.
 */

import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const SHOTS = join(here, 'screens');
const PORT = Number(process.env.SMOKE_PORT || 8123);
const API_PORT = Number(process.env.SMOKE_API_PORT || 8124);
const BASE = `http://127.0.0.1:${PORT}`;
const API = `http://127.0.0.1:${API_PORT}`;

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function step(title) {
  console.log(`\n▸ ${title}`);
}

/**
 * Several labels are uppercased by CSS (`text-transform`), and `innerText`
 * returns the rendered text, so all content assertions are case-insensitive.
 */
function has(haystack, needle) {
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

/** Tab buttons include their emoji and unread count in the accessible name. */
function tab(page, label) {
  return page.locator('.tabbar__btn', { hasText: label });
}

/** Start a child process and wait until its port answers. */
async function startServer(args, url, label, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd: repo,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  child.stderr.on('data', (d) => process.stderr.write(`[${label}] ${d}`));

  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return child;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`${label} la hahú iha ${url}`);
}

/* ------------------------------------------------------------------ */

rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });
rmSync(join(repo, 'server', 'data'), { recursive: true, force: true });

/** Everything that must be torn down, even if startup itself fails. */
const spawned = [];
function killAll() {
  for (const child of spawned.splice(0)) {
    try {
      child.kill();
    } catch { /* already gone */ }
  }
}
process.on('exit', killAll);
process.on('SIGINT', () => {
  killAll();
  process.exit(130);
});

let web;
let api;
try {
  web = await startServer(
    [join(repo, 'tools', 'serve.js'), String(PORT)],
    `${BASE}/index.html`,
    'web',
    { PORT: String(PORT) },
  );
  spawned.push(web);
  api = await startServer(
    [join(repo, 'server', 'server.js')],
    `${API}/api/health`,
    'api',
    { PORT: String(API_PORT), HOST: '127.0.0.1', DATA_DIR: join(repo, 'server', 'data') },
  );
  spawned.push(api);
} catch (err) {
  killAll();
  throw err;
}

const browser = await chromium.launch();
const shot = async (page, name) => {
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false });
};

try {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    locale: 'pt-TL',
    permissions: [],
  });
  const page = await context.newPage();

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  /* ---------------- onboarding ---------------- */
  step('Onboarding');
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });

  check('splash gives way to the welcome screen',
    await page.getByRole('heading', { name: /Bemvindu ba Hau Para Fuma/i }).isVisible());
  check('welcome copy is Tetum, not English',
    has(await page.locator('#app').innerText(), 'Ita bele uza mesmu laiha internet'));
  await shot(page, '01-bemvindu');

  await page.getByRole('button', { name: 'Hahú' }).click();

  check('nickname step asks for a name',
    await page.getByRole('heading', { name: /Ami bolu ita oinsá/i }).isVisible());
  const nextOnName = page.getByRole('button', { name: 'Tuir mai' });
  check('next is disabled until a name is typed', await nextOnName.isDisabled());
  await page.locator('input[type="text"]').fill('Bere');
  check('next enables once a name exists', await nextOnName.isEnabled());
  await shot(page, '02-naran');
  await nextOnName.click();

  check('smoking step is shown',
    await page.getByRole('heading', { name: /Ita fuma hira iha loron ida/i }).isVisible());
  const numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('12');   // cigarettes/day
  await numbers.nth(1).fill('2.50'); // price per pack
  await numbers.nth(2).fill('20');   // per pack
  await shot(page, '03-fuma');
  await page.getByRole('button', { name: 'Tuir mai' }).click();

  check('quit date step is shown',
    await page.getByRole('heading', { name: /Bainhira ita hakarak para/i }).isVisible());
  // Quit "today" so the dashboard has live numbers to show.
  await page.getByRole('button', { name: 'Ha\'u para ohin loron' }).click();
  await shot(page, '04-loron');
  await page.getByRole('button', { name: 'Tuir mai' }).click();

  check('reasons step is shown',
    await page.getByRole('heading', { name: /Tanbasá ita hakarak para/i }).isVisible());
  await page.getByRole('button', { name: /Ha'u nia saúde/ }).click();
  await page.getByRole('button', { name: /Ha'u nia familia no oan sira/ }).click();
  await shot(page, '05-motivu');
  await page.getByRole('button', { name: 'Tuir mai' }).click();

  check('notification consent is asked with a rationale, before the browser prompt',
    has(await page.locator('#app').innerText(), 'Notifikasaun mak parte importante'));
  await shot(page, '06-notifikasaun');
  await page.getByRole('button', { name: 'Depois' }).click();

  /* ---------------- home ---------------- */
  step('Uma (dashboard)');
  await page.waitForSelector('#tabbar:not([hidden])');

  // The programme releases each slot at its scheduled hour (08:00 / 19:00 by
  // default). Pin those to 00:00 and re-run delivery so this test does not
  // depend on what time of day it runs — a 02:00 run would otherwise see only
  // the welcome message. The hour gating itself is covered in unit.mjs.
  await page.evaluate(() => {
    window.__hpf.store.update((s) => {
      s.settings.morningAt = 0;
      s.settings.eveningAt = 0;
    }, 'test');
    window.__hpf.deliverDue();
    window.__hpf.refresh();
  });
  await page.waitForTimeout(300);

  check('nickname is greeted', has(await page.locator('#app').innerText(), 'Bere'));
  check('smoke-free counter is running',
    await page.locator('[data-live-clock]').isVisible());
  check('all five tabs are present',
    (await page.locator('.tabbar__btn').count()) === 5);

  const homeText = await page.locator('#app').innerText();
  check('money saved is tracked', has(homeText, 'Osan salva'));
  check('cigarettes avoided is tracked', has(homeText, 'Sigarru la fuma'));
  check('next health benefit is shown', has(homeText, 'Benefísiu saúde tuir mai'));
  check('next savings goal is shown', has(homeText, 'Meta osan tuir mai'));
  check('a motivational line is shown', has(homeText, 'Liafuan fó forsa'));
  check('quit-day programme message was delivered', has(homeText, 'Mensajen ohin loron'));
  check('SOS button is reachable from the dashboard',
    await page.locator('#sos').isVisible());

  // The counter must actually tick.
  const firstTick = await page.locator('[data-live-clock] .unit__n').last().innerText();
  await page.waitForTimeout(1600);
  const secondTick = await page.locator('[data-live-clock] .unit__n').last().innerText();
  check('the seconds counter advances', firstTick !== secondTick, `${firstTick} → ${secondTick}`);

  await shot(page, '07-uma');

  /* ---------------- daily check-in ---------------- */
  step('Check-in');
  await page.getByRole('button', { name: 'Sin, ha\'u la fuma' }).click();
  await page.waitForTimeout(300);
  // A badge celebration may open over it; close if so.
  if (await page.locator('#sheet:not([hidden])').isVisible()) {
    check('a badge is celebrated on the first craving win',
      has(await page.locator('#sheet-title').innerText(), 'Konkista foun'));
    await shot(page, '08-konkista');
    await page.locator('#sheet .sheet__close').click();
  }
  check('check-in is recorded',
    has(await page.locator('#app').innerText(), 'Ita rejistu ona ohin loron'));

  /* ---------------- messages / two-way ---------------- */
  step('Mensajen (two-way)');
  await tab(page, 'Mensajen').click();
  await page.waitForSelector('.chat');

  const threadText = await page.locator('.chat').innerText();
  check('welcome message is in the thread', has(threadText, 'Bemvindu ba Hau Para Fuma'));
  check('quit-day message is in the thread', has(threadText, 'LORON ITA NIAN'));
  check('messages are labelled with their WHO category',
    (await page.locator('.msg__kind').count()) > 0);

  // Regression: the floating SOS pill used to sit exactly on top of the send
  // button, making it impossible to send a message on a real phone.
  const sendBox = await page.locator('.composer .btn').boundingBox();
  const sosBox = await page.locator('#sos').boundingBox();
  const overlaps = Boolean(sendBox && sosBox)
    && sendBox.x < sosBox.x + sosBox.width
    && sosBox.x < sendBox.x + sendBox.width
    && sendBox.y < sosBox.y + sosBox.height
    && sosBox.y < sendBox.y + sendBox.height;
  check('the SOS button does not cover the send button', !overlaps,
    `haruka=${JSON.stringify(sendBox)} sos=${JSON.stringify(sosBox)}`);
  check('the SOS button is still reachable on the messages screen',
    await page.locator('#sos').isVisible());

  // Free-text reply with the craving keyword.
  await page.locator('.composer textarea').fill('HAKARAK fuma');
  await page.getByRole('button', { name: 'Haruka' }).click();
  await page.waitForTimeout(400);

  const afterCrave = await page.locator('.chat').innerText();
  check('the typed message appears as mine', has(afterCrave, 'HAKARAK fuma'));
  check('the engine replies with a coping message',
    (await page.locator('.msg--in').count()) >= 3);
  check('the coping reply is labelled "Oinsá hasoru"',
    has(afterCrave, 'Oinsá hasoru'));
  await shot(page, '09-mensajen');

  // Quick-reply chip for a data question.
  await page.locator('.quickbar .chip').first().click();
  await page.waitForTimeout(400);
  check('quick-reply chips send a message',
    (await page.locator('.msg--out').count()) >= 2);

  // Ask about money and confirm the reply contains the real figure.
  await page.locator('.composer textarea').fill('osan');
  await page.getByRole('button', { name: 'Haruka' }).click();
  await page.waitForTimeout(400);
  const moneyReply = await page.locator('.msg--in').last().innerText();
  check('money question is answered with a dollar figure', /\$\d/.test(moneyReply), moneyReply.slice(0, 80));

  /* ---------------- community, against the real server ---------------- */
  step('Komunidade (servidór real)');
  await page.evaluate((apiBase) => {
    window.__hpf.store.update((s) => { s.settings.apiBase = apiBase; }, 'test');
  }, API);

  await tab(page, 'Komunidade').click();
  await page.waitForSelector('.card');
  await page.waitForTimeout(600);

  check('community screen says everyone can post',
    has(await page.locator('#app').innerText(), 'Ema hotu bele haruka mensajen'));
  check('tag picker offers asking for help, not only celebrating',
    has(await page.locator('#app').innerText(), 'Buka tulun'));

  const postText = 'Ohin ha\'u kompleta loron ida la fuma. Susar maibé ha\'u halo!';
  await page.locator('textarea').first().fill(postText);
  await page.getByRole('button', { name: 'Publika' }).click();
  await page.waitForTimeout(900);

  check('the post appears in the feed',
    has(await page.locator('.post__body').first().innerText(), 'loron ida la fuma'));
  check('the post is attributed to the nickname',
    has(await page.locator('.post__name').first().innerText(), 'Bere'));
  await shot(page, '10-komunidade');

  // Confirm it really reached the server, not just the local mirror.
  const serverFeed = await (await fetch(`${API}/api/feed`)).json();
  check('the post reached the server',
    serverFeed.posts.some((p) => p.text.includes('loron ida la fuma')),
    `servidór iha ${serverFeed.posts.length} post`);

  // A second, independent device must see it — this is what "shared" means.
  const other = await browser.newContext({ ...devices['Pixel 7'], locale: 'pt-TL' });
  const otherPage = await other.newPage();
  await otherPage.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await otherPage.evaluate((apiBase) => {
    const s = window.__hpf.store.get();
    s.onboarded = true;
    s.profile.nickname = 'Lita';
    s.quit.date = Date.now() - 3 * 86400000;
    s.quit.startedAt = s.quit.date;
    s.settings.apiBase = apiBase;
    window.__hpf.store.commit('test');
  }, API);
  await otherPage.goto(`${BASE}/index.html#/komunidade`, { waitUntil: 'networkidle' });
  await otherPage.waitForTimeout(1200);
  const otherFeed = await otherPage.locator('#app').innerText();
  check('a different device sees the post', has(otherFeed, 'loron ida la fuma'));

  // Reply and cheer from the second device.
  await otherPage.locator('.post .react').nth(1).click();  // "Hatán"
  await otherPage.waitForTimeout(200);
  await otherPage.locator('.replies textarea').fill('Parabéns Bere! Ita bele halo.');
  await otherPage.locator('.replies').getByRole('button', { name: 'Haruka' }).click();
  await otherPage.waitForTimeout(800);
  await otherPage.locator('.post .react').first().click();  // "Fó forsa"
  await otherPage.waitForTimeout(600);
  await shot(otherPage, '11-komunidade-belun');

  const feedAfterReply = await (await fetch(`${API}/api/feed`)).json();
  const target = feedAfterReply.posts.find((p) => p.text.includes('loron ida la fuma'));
  check('the reply reached the server', target && target.replies.length === 1);
  check('the cheer was counted', target && target.cheers === 1);

  // Server-side validation must reject a phone number even if a client bypasses.
  const blocked = await fetch(`${API}/api/posts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: 'devtest123', name: 'X', text: 'Bolu ha\'u iha 7723 4567' }),
  });
  check('the server rejects personal contact details', blocked.status === 400,
    `status ${blocked.status}`);
  await other.close();

  /* ---------------- minigame ---------------- */
  step('Jogu (distrasaun)');
  await page.goto(`${BASE}/index.html#/jogu`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.tile');

  check('the board is rendered', (await page.locator('.tile').count()) === 12);
  check('no tile shows a smoking cue',
    !(await page.locator('.board').innerText()).match(/🚬|🔥/));
  await shot(page, '12-jogu');

  // Solve the board by reading the symbols out of the engine's own state.
  const solved = await page.evaluate(async () => {
    const tiles = [...document.querySelectorAll('.tile')];
    // Reveal every card once to learn the symbols, resolving mismatches.
    const symbols = new Map();
    for (let i = 0; i < tiles.length; i++) {
      const t = [...document.querySelectorAll('.tile')][i];
      t.click();
      await new Promise((r) => setTimeout(r, 30));
      const text = [...document.querySelectorAll('.tile')][i].textContent;
      if (text) {
        const list = symbols.get(text) || [];
        list.push(i);
        symbols.set(text, list);
      }
      await new Promise((r) => setTimeout(r, 830));
    }
    // Now click each known pair.
    for (const [, idx] of symbols) {
      if (idx.length < 2) continue;
      const all = [...document.querySelectorAll('.tile')];
      all[idx[0]].click();
      await new Promise((r) => setTimeout(r, 60));
      [...document.querySelectorAll('.tile')][idx[1]].click();
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 400));
    return document.querySelector('#app').innerText.includes('Ita manán');
  });
  check('the board can be completed and shows a win', solved);

  if (solved) {
    await shot(page, '13-jogu-manan');
    await page.getByRole('button', { name: 'Sin, tun ona' }).click();
    await page.waitForTimeout(400);
    if (await page.locator('#sheet:not([hidden])').isVisible()) {
      await page.locator('#sheet .sheet__close').click();
    }
    const beaten = await page.evaluate(() => window.__hpf.store.get().counters.cravingsBeaten);
    check('beating a craving through the game is counted', beaten >= 2, `total ${beaten}`);
  }

  /* ---------------- SOS ---------------- */
  step('SOS');
  await page.goto(`${BASE}/index.html#/uma`, { waitUntil: 'networkidle' });
  await page.locator('#sos').click();
  await page.waitForSelector('#sheet:not([hidden])');
  const sosText = await page.locator('#sheet').innerText();
  check('SOS opens with reassurance', has(sosText, 'Hakarak ne\'e sei liu'));
  check('SOS offers the 5-minute wait', has(sosText, 'Hein minutu 5'));
  check('SOS offers a non-judging "I smoked" option', has(sosText, 'Ha\'u fuma tiha'));
  await shot(page, '14-sos');
  await page.locator('#sheet .sheet__close').click();

  /* ---------------- tools ---------------- */
  step('Ferramenta');
  await tab(page, 'Ferramenta').click();
  await page.waitForSelector('.list__row');
  check('all eleven tools are listed',
    (await page.locator('.list__row').count()) === 11,
    `hetan ${await page.locator('.list__row').count()}`);
  await shot(page, '15-ferramenta');

  const screens = [
    ['/saude', 'Ita nia isin sei di\'ak', '16-saude'],
    ['/osan', 'Osan salva', '17-osan'],
    ['/dada-iis', 'Dada iis', '18-dada-iis'],
    ['/gatilhu', 'Kartaun hasoru gatilhu', '19-gatilhu'],
    ['/diariu', 'Diáriu hakarak fuma', '20-diariu'],
    ['/planu', 'Planu emerjénsia', '21-planu'],
    ['/teste', 'Teste dependénsia nikotina', '22-teste'],
    ['/abstinensia', 'Sintoma abstinénsia', '23-abstinensia'],
    ['/konkista', 'Konkista', '24-konkista'],
    ['/servisu', 'Servisu saúde', '25-servisu'],
  ];
  for (const [route, expect, name] of screens) {
    await page.goto(`${BASE}/index.html#${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const text = await page.locator('#app').innerText();
    check(`${route} renders`, has(text, expect), text.slice(0, 60).replace(/\n/g, ' '));
    await shot(page, name);
  }

  /* ---------------- health milestones ---------------- */
  step('Marku saúde');
  await page.goto(`${BASE}/index.html#/saude`, { waitUntil: 'networkidle' });
  check('the recovery timeline lists all 13 milestones',
    (await page.locator('.tl__item').count()) === 13);
  check('early milestones are already marked reached',
    (await page.locator('.tl__item--done').count()) >= 1);
  check('the source is cited',
    has(await page.locator('#app').innerText(), 'OMS / CDC'));

  /* ---------------- Fagerström ---------------- */
  step('Teste Fagerström');
  await page.goto(`${BASE}/index.html#/teste`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 6; i++) {
    await page.locator('.chip').first().click();
    await page.waitForTimeout(150);
  }
  const testText = await page.locator('#app').innerText();
  check('the test scores out of 10', /\/10/.test(testText));
  check('a high score routes to a health service', has(testText, 'Sentru Saúde Komunidade'));
  check('the test disclaims being a diagnosis', has(testText, 'la\'ós diagnóstiku médiku'));
  await shot(page, '26-teste-rezultadu');

  /* ---------------- profile ---------------- */
  step('Ha\'u (profile)');
  await tab(page, "Ha'u").click();
  await page.waitForTimeout(300);
  const meText = await page.locator('#app').innerText();
  check('programme progress is shown', /Loron \d+ husi 180/.test(meText));
  check('privacy is explained', has(meText, 'rai iha ita nia telefone deit'));
  check('data can be exported', has(meText, 'Hasai ha\'u nia dadus'));
  check('data can be erased', has(meText, 'Hamoos dadus hotu'));
  check('there is no language switcher (Tetum only)',
    !/Português|Idioma|Language/i.test(meText));
  await shot(page, '27-hau');

  /* ---------------- relapse handling ---------------- */
  step('Fila fali');
  await page.getByRole('button', { name: 'Ha\'u fuma fali — hahú foun' }).click();
  await page.waitForSelector('#sheet:not([hidden])');
  const relapseText = await page.locator('#sheet').innerText();
  check('relapse is framed as not failing', has(relapseText, 'la signifika ita monu'));
  check('the person chooses whether to reset the count',
    has(relapseText, 'kontinua konta'));
  await shot(page, '28-fila-fali');
  await page.getByRole('button', { name: 'Ha\'u fuma ida deit — kontinua konta' }).click();
  await page.waitForTimeout(400);
  const keptStreak = await page.evaluate(() => window.__hpf.store.get().quit.attempt);
  check('choosing to keep the streak does not start a new attempt', keptStreak === 1);

  /* ---------------- Tetum-only sweep ---------------- */
  step('Tetun deit');
  const scanned = [];
  for (const route of ['/uma', '/mensajen', '/komunidade', '/ferramenta', '/hau', '/saude', '/osan', '/teste']) {
    await page.goto(`${BASE}/index.html#${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    scanned.push(await page.locator('#app, #tabbar').allInnerTexts());
  }
  const allText = scanned.flat().join('\n');
  // Words that would only appear if an English or Portuguese string leaked in.
  const leaks = ['Settings', 'Welcome', 'Messages', 'Community', 'Tools', 'Save ', 'Cancel',
    'Configurações', 'Mensagens', 'Comunidade', 'Ferramentas', 'Guardar', 'Bem-vindo'];
  const found = leaks.filter((w) => has(allText, w));
  check('no English or Portuguese UI strings leaked', found.length === 0, found.join(', '));
  const keyLike = /\b(?:tab|home|msg|com|tools|sos|me|badge|test|diary|money|health|plan|wd|trig|svc|game|breathe|notif|ob)\.[a-z]+/gi;
  const strayKeys = allText.match(keyLike) || [];
  check('missing-translation keys are not rendered', strayKeys.length === 0, strayKeys.join(', '));

  /* ---------------- offline ---------------- */
  step('Laiha internet');
  await page.goto(`${BASE}/index.html#/uma`, { waitUntil: 'networkidle' });
  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg && (reg.active || reg.installing || reg.waiting));
  });
  check('the service worker is registered', swReady);

  if (swReady) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(1200);
    await context.setOffline(true);
    await page.goto(`${BASE}/index.html#/uma`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const offlineText = await page.locator('#app').innerText();
    check('the app opens with no network', has(offlineText, 'Bere'), offlineText.slice(0, 80));

    // The craving tools are the ones that must work offline.
    await page.goto(`${BASE}/index.html#/jogu`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    check('the minigame works offline', (await page.locator('.tile').count()) > 0);
    await shot(page, '29-laiha-internet');
    await context.setOffline(false);
  }

  /* ---------------- console hygiene ---------------- */
  step('Konsola');
  const realErrors = errors.filter((e) =>
    !/Failed to load resource|net::ERR|the server responded with a status/i.test(e));
  check('no uncaught JavaScript errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  await context.close();
} finally {
  await browser.close();
  killAll();
}

console.log(`\n${'─'.repeat(52)}`);
console.log(`Rezultadu: ${passed} pass, ${failed} fail`);
if (failures.length) {
  console.log('\nSala:');
  for (const f of failures) console.log(`  • ${f}`);
}
console.log(`Screenshots: ${SHOTS}`);
process.exit(failed ? 1 : 0);
