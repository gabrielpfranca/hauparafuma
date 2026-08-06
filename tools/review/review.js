/**
 * TETUN REVIEW — the reviewer's tool.
 *
 * One person, not a programmer, checking ~800 strings from a phone. The
 * interface is English because the reviewer reads English; the text being
 * reviewed is of course Tetun. Everything here follows from that:
 *
 *  - ONE STRING AT A TIME, in priority order, so stopping half way still means
 *    the clinical text got reviewed.
 *  - NEVER LOSE AN EDIT. Every decision goes to localStorage before it goes to
 *    the network, and the queue drains in the background. An afternoon's work
 *    must survive a dropped connection, which on mobile data in Timor-Leste is
 *    normal.
 *  - GUARD THE PLACEHOLDERS. `{n}` disappearing is the one way a well-meaning
 *    correction breaks the app, so it is blocked in the UI as well as on the
 *    server.
 *
 * Corrections go live immediately — there is no approval step. See
 * server/review.js for what happens on the other side.
 */

const KEY_STORE = 'hpf.review.key';
const QUEUE_STORE = 'hpf.review.queue';

const $ = (id) => document.getElementById(id);

let units = [];
let state = { text: {}, status: {}, notes: {} };
let view = [];          // the filtered, ordered list being worked through
let pos = 0;
let queue = [];
let flushing = false;

/* ------------------------------------------------------------------ */
/* Rede                                                                */
/* ------------------------------------------------------------------ */

const key = () => localStorage.getItem(KEY_STORE) || '';

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'x-review-key': key(), 'content-type': 'application/json', ...(options.headers || {}) },
  });
  if (res.status === 403) throw new Error('forbidden');
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Fila (offline)                                                      */
/* ------------------------------------------------------------------ */

function loadQueue() {
  try { queue = JSON.parse(localStorage.getItem(QUEUE_STORE)) || []; } catch { queue = []; }
}

function saveQueue() {
  try { localStorage.setItem(QUEUE_STORE, JSON.stringify(queue)); } catch { /* full */ }
}

/**
 * Queue one decision and try to send.
 *
 * The local state is updated first and unconditionally, so the reviewer always
 * sees their own work reflected even with no signal.
 */
function enqueue(change) {
  queue = queue.filter((c) => c.id !== change.id);
  queue.push(change);
  saveQueue();

  if (change.action === 'change') state.text[change.id] = change.text;
  state.status[change.id] = change.action === 'change' ? 'changed' : change.action;
  if (change.note !== undefined) state.notes[change.id] = change.note;

  flush();
  paintProgress();
}

async function flush() {
  if (flushing || !queue.length) return;
  flushing = true;
  setSync('wait', `Saving ${queue.length}…`);
  const batch = queue.slice(0, 50);
  try {
    const out = await api('/api/review/save', {
      method: 'POST',
      body: JSON.stringify({ changes: batch }),
    });
    const rejected = (out.results || []).filter((r) => r.error);
    queue = queue.slice(batch.length);
    saveQueue();
    if (rejected.length) {
      setSync('err', `${rejected.length} rejected`);
      // The server is the authority: drop our optimistic copy so the reviewer
      // sees the real text rather than an edit that never landed.
      for (const r of rejected) delete state.text[r.id];
      renderCard();
    } else {
      setSync('', queue.length ? `${queue.length} left to send` : 'Saved ✓');
    }
  } catch {
    setSync('err', `Offline — ${queue.length} waiting`);
  } finally {
    flushing = false;
    if (queue.length) setTimeout(flush, 8000);
  }
}

function setSync(kind, text) {
  const el = $('sync');
  el.className = `sync${kind ? ` sync--${kind}` : ''}`;
  el.textContent = text;
}

/* ------------------------------------------------------------------ */
/* Placeholders                                                        */
/* ------------------------------------------------------------------ */

const placeholders = (s) => (String(s).match(/\{[a-z]+\}/gi) || []).sort();

/** Live warning while typing: the app breaks if `{n}` goes missing. */
function checkPlaceholders() {
  const unit = view[pos];
  if (!unit) return true;
  const want = placeholders(unit.source);
  const got = placeholders($('input').value);
  const missing = want.filter((p) => !got.includes(p));
  const warn = $('ph-warn');

  if (!missing.length) {
    warn.hidden = true;
    $('save').disabled = false;
    return true;
  }
  warn.hidden = false;
  warn.textContent = `Missing ${missing.join(' ')} — this is where the number appears, so it has to stay in the text.`;
  $('save').disabled = true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

function current(unit) {
  return state.text[unit.id] !== undefined ? state.text[unit.id] : unit.source;
}

const reviewed = (unit) => Boolean(state.status[unit.id]);

function renderCard() {
  const unit = view[pos];
  if (!unit) {
    $('card').innerHTML = '<p><strong>Nothing left in this section.</strong></p>'
      + '<p class="muted">Pick another section below, or untick "Only unreviewed".</p>';
    return;
  }

  $('pri').textContent = unit.priorityLabel;
  $('pri').className = `pill pill--${unit.priority}`;
  $('section').textContent = unit.section;

  $('context').hidden = !unit.context;
  $('context').textContent = unit.context || '';

  $('section-note').hidden = !unit.sectionNote;
  $('section-note').textContent = unit.sectionNote || '';

  $('source').textContent = unit.source;

  const eref = $('english-ref');
  if (unit.english) {
    eref.hidden = false;
    eref.textContent = `English: ${unit.english}`;
  } else {
    eref.hidden = true;
  }

  const shot = $('shot-wrap');
  if (unit.screen) {
    shot.hidden = false;
    $('shot').src = `/revizaun/screens/${unit.screen}?key=${encodeURIComponent(key())}`;
  } else {
    shot.hidden = true;
    $('shot').removeAttribute('src');
  }

  $('input').value = current(unit);
  $('note').value = state.notes[unit.id] || '';
  $('counter').textContent = `${pos + 1} / ${view.length}`;
  checkPlaceholders();
  window.scrollTo(0, 0);
}

function paintProgress() {
  const done = units.filter(reviewed).length;
  $('progress').textContent = `${done} / ${units.length} reviewed`;
  $('bar-fill').style.width = `${units.length ? (done / units.length) * 100 : 0}%`;
}

function applyFilter() {
  const want = $('filter').value;
  const todoOnly = $('only-todo').checked;
  view = units.filter((u) => (want === '*' || u.section === want) && (!todoOnly || !reviewed(u)));
  pos = 0;
  renderCard();
}

function advance() {
  if (pos < view.length - 1) {
    pos++;
  } else if ($('only-todo').checked) {
    // In to-do mode the string just handled drops out of the list, so rebuild
    // rather than walking off the end.
    applyFilter();
    return;
  }
  renderCard();
}

/* ------------------------------------------------------------------ */
/* Glosáriu                                                            */
/* ------------------------------------------------------------------ */

const GLOSSARY = [
  ['Core terms', [
    ['fuma', 'to smoke', ''],
    ['para fuma', 'to quit smoking', ''],
    ['sigarru', 'cigarette', ''],
    ['tabaku', 'tobacco', ''],
    ['nikotina', 'nicotine', ''],
    ['hakarak fuma', 'craving', 'the app\'s central term — worth confirming'],
    ['fila fali (fuma)', 'to relapse', 'lit. "to go back"'],
    ['abstinénsia', 'withdrawal', ''],
    ['loron para fuma', 'quit day', ''],
    ['dependénsia', 'dependence', ''],
  ]],
  ['Body and health', [
    ['saúde', 'health', ''], ['isin', 'body', ''], ['fuan', 'heart', ''],
    ['pulmaun', 'lung', ''], ['iis', 'breath', ''], ['dada iis', 'to breathe in', ''],
    ['soe iis', 'to breathe out', ''], ['tensaun sangue', 'blood pressure', ''],
    ['kanser', 'cancer', ''], ['tose', 'cough', ''], ['kolen', 'tired', ''],
  ]],
  ['Time', [
    ['loron', 'day', 'unit before the numeral: "loron 3", not "3 loron"'],
    ['oras', 'hour', ''], ['minutu', 'minute', ''], ['segundu', 'second', ''],
    ['semana', 'week', ''], ['fulan', 'month', ''], ['tinan', 'year', ''],
    ['ohin loron', 'today', ''], ['horiseik', 'yesterday', ''], ['oras ne\'e', 'now', ''],
    ['… liu ba', '… ago', 'e.g. "minutu 5 liu ba"'],
  ]],
  ['App and interaction', [
    ['mensajen', 'message', ''], ['notifikasaun', 'notification', ''],
    ['komunidade', 'community', ''], ['ferramenta', 'tool', ''],
    ['jogu', 'game', ''], ['konkista', 'achievement', ''],
    ['konfigurasaun', 'settings', ''],
  ]],
];

function buildGlossary() {
  const host = $('glossary-body');
  host.innerHTML = '';
  const rules = document.createElement('p');
  rules.className = 'muted small';
  rules.innerHTML = 'The app addresses the user as <strong>ita</strong> (polite), never '
    + '<strong>ó</strong>. INL orthography: apostrophe for the glottal stop '
    + '(<code>ha\'u</code>, <code>di\'ak</code>, <code>ne\'e</code>), '
    + '<code>k</code> rather than <code>c</code>.';
  host.appendChild(rules);

  for (const [title, rows] of GLOSSARY) {
    const h = document.createElement('h4');
    h.textContent = title;
    host.appendChild(h);
    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Tetun</th><th>English</th><th>Note</th></tr>'
      + rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td class="muted">${c}</td></tr>`).join('');
    host.appendChild(table);
  }
}

/* ------------------------------------------------------------------ */
/* Hahú                                                                */
/* ------------------------------------------------------------------ */

async function start() {
  const data = await api('/api/review/units');

  const LABELS = {
    1: 'Clinical', 2: 'Tone', 3: 'Interface', 4: 'Programme', 5: 'Other',
  };
  units = data.units.map((u) => ({ ...u, priorityLabel: LABELS[u.priority] || '' }));
  state = { text: data.text || {}, status: data.status || {}, notes: data.notes || {} };

  const sections = [...new Set(units.map((u) => u.section))];
  $('filter').innerHTML = '<option value="*">Everything</option>'
    + sections.map((s) => {
      const n = units.filter((u) => u.section === s).length;
      return `<option value="${s.replace(/"/g, '&quot;')}">${s} (${n})</option>`;
    }).join('');

  buildGlossary();
  applyFilter();
  paintProgress();
  loadQueue();
  if (queue.length) flush();

  $('gate').hidden = true;
  $('app').hidden = false;
}

function wire() {
  $('enter').addEventListener('click', async () => {
    localStorage.setItem(KEY_STORE, $('key').value.trim());
    try {
      await start();
    } catch {
      $('gate-err').hidden = false;
      localStorage.removeItem(KEY_STORE);
    }
  });
  $('key').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('enter').click(); });

  $('input').addEventListener('input', checkPlaceholders);

  $('ok').addEventListener('click', () => {
    const unit = view[pos];
    if (!unit) return;
    enqueue({ id: unit.id, action: 'ok', note: $('note').value.trim() });
    advance();
  });

  $('save').addEventListener('click', () => {
    const unit = view[pos];
    if (!unit || !checkPlaceholders()) return;
    const text = $('input').value.trim();
    if (!text) return;
    if (text === current(unit)) { advance(); return; }
    enqueue({ id: unit.id, action: 'change', text, note: $('note').value.trim() });
    advance();
  });

  $('ask').addEventListener('click', () => {
    const unit = view[pos];
    if (!unit) return;
    const note = $('note').value.trim();
    if (!note) { $('note').focus(); return; }
    enqueue({ id: unit.id, action: 'question', note });
    advance();
  });

  $('prev').addEventListener('click', () => { if (pos > 0) { pos--; renderCard(); } });
  $('next').addEventListener('click', advance);
  $('filter').addEventListener('change', applyFilter);
  $('only-todo').addEventListener('change', applyFilter);

  $('glossary-btn').addEventListener('click', () => { $('glossary').hidden = false; });
  $('glossary-close').addEventListener('click', () => { $('glossary').hidden = true; });
  $('glossary').addEventListener('click', (e) => {
    if (e.target === $('glossary')) $('glossary').hidden = true;
  });

  window.addEventListener('online', flush);
  window.addEventListener('pagehide', saveQueue);
}

wire();
if (key()) start().catch(() => { localStorage.removeItem(KEY_STORE); });
