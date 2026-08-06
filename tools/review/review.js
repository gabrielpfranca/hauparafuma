/**
 * TETUN REVIEW — the reviewer's tool.
 *
 * One person, not a programmer, checking ~800 strings at a desk. The interface
 * is English because the reviewer reads English; the text being reviewed is of
 * course Tetun. Everything here follows from that:
 *
 *  - THE WHOLE LIST IS ON SCREEN. Every line of the app is in the left pane, one
 *    row each, and the editor sits beside it — not below it. Picking the next
 *    string is a click, never a scroll, and the panes scroll independently so
 *    the typing box never leaves the window.
 *  - WHAT HE TYPED IS WHAT HE SEES. Once a string is corrected, the correction
 *    IS the text of that string — in the list, in the editor, and in the app.
 *    The original moves into a fold underneath, available but out of the way.
 *    Nothing he has written is ever silently replaced by the old text.
 *  - NEVER LOSE AN EDIT. Every decision goes to localStorage before it goes to
 *    the network, and the queue drains in the background. An afternoon's work
 *    must survive a dropped connection.
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
let view = [];              // the filtered list currently in the left pane
let rows = new Map();       // id -> <li>, so one edit repaints one row
let pos = -1;               // index into `view`, -1 = nothing selected
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
      for (const r of rejected) {
        delete state.text[r.id];
        updateRow(r.id);
      }
      renderEditor();
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
/* Estadu de kada linha                                                */
/* ------------------------------------------------------------------ */

/** The text as it stands now: his correction if he made one, else the app's. */
function current(unit) {
  return state.text[unit.id] !== undefined ? state.text[unit.id] : unit.source;
}

const edited = (unit) => state.text[unit.id] !== undefined && state.text[unit.id] !== unit.source;
const reviewed = (unit) => Boolean(state.status[unit.id]);

const MARK = { ok: '✓', changed: '✎', question: '?' };

/* ------------------------------------------------------------------ */
/* Lista                                                               */
/* ------------------------------------------------------------------ */

function rowClass(unit) {
  const status = state.status[unit.id];
  return `row row--p${unit.priority}${status ? ` row--${status}` : ''}`;
}

function renderList() {
  const list = $('list');
  list.textContent = '';
  rows = new Map();

  const frag = document.createDocumentFragment();
  for (const [i, unit] of view.entries()) {
    const li = document.createElement('li');
    li.className = rowClass(unit);
    li.dataset.i = String(i);

    const mark = document.createElement('span');
    mark.className = 'row__mark';
    mark.textContent = MARK[state.status[unit.id]] || '·';

    const text = document.createElement('span');
    text.className = 'row__text';
    text.textContent = current(unit);

    const sec = document.createElement('span');
    sec.className = 'row__sec';
    sec.textContent = unit.section;

    li.append(mark, text, sec);
    rows.set(unit.id, li);
    frag.appendChild(li);
  }
  list.appendChild(frag);

  $('list-empty').hidden = view.length > 0;
  $('count').textContent = `${view.length} line${view.length === 1 ? '' : 's'}`;
}

/** Repaint one row in place — used after an edit, so the list never reshuffles. */
function updateRow(id) {
  const li = rows.get(id);
  if (!li) return;
  const unit = view[Number(li.dataset.i)];
  if (!unit) return;
  li.className = `${rowClass(unit)}${Number(li.dataset.i) === pos ? ' is-sel' : ''}`;
  li.querySelector('.row__mark').textContent = MARK[state.status[unit.id]] || '·';
  li.querySelector('.row__text').textContent = current(unit);
}

function highlight() {
  for (const li of rows.values()) li.classList.remove('is-sel');
  const unit = view[pos];
  if (!unit) return;
  const li = rows.get(unit.id);
  if (li) {
    li.classList.add('is-sel');
    li.scrollIntoView({ block: 'nearest' });
  }
}

/* ------------------------------------------------------------------ */
/* Editór                                                              */
/* ------------------------------------------------------------------ */

function renderEditor() {
  const unit = view[pos];
  $('editor').hidden = !unit;
  $('no-sel').hidden = Boolean(unit);
  if (!unit) return;

  $('pri').textContent = unit.priorityLabel;
  $('pri').className = `pill pill--${unit.priority}`;
  $('section').textContent = unit.section;

  $('context').hidden = !unit.context;
  $('context').textContent = unit.context || '';

  $('section-note').hidden = !unit.sectionNote;
  $('section-note').textContent = unit.sectionNote || '';

  // The headline text is the LIVE text — his correction once he has made one.
  // Going back to a string he has already fixed must show what he wrote, not
  // the original he replaced.
  const isEdited = edited(unit);
  $('current').textContent = current(unit);
  $('current').className = `source${isEdited ? ' source--live' : ''}`;
  $('current-label').textContent = isEdited ? 'Your text — live in the app' : 'Text in the app';

  const eref = $('english-ref');
  if (unit.english) {
    eref.hidden = false;
    eref.textContent = `English: ${unit.english}`;
  } else {
    eref.hidden = true;
  }

  // The original only earns space on screen once it is no longer what is live.
  const fold = $('orig-wrap');
  fold.hidden = !isEdited;
  fold.open = false;
  $('orig').textContent = unit.source;

  const shot = $('shot-wrap');
  if (unit.screen) {
    shot.hidden = false;
    shot.open = false;
    $('shot').src = `/revizaun/screens/${unit.screen}?key=${encodeURIComponent(key())}`;
  } else {
    shot.hidden = true;
    $('shot').removeAttribute('src');
  }

  $('input').value = current(unit);
  $('note').value = state.notes[unit.id] || '';
  $('counter').textContent = `${pos + 1} / ${view.length}`;
  $('saved-hint').hidden = true;
  $('prev').disabled = pos <= 0;
  $('next').disabled = pos >= view.length - 1;
  checkPlaceholders();
  $('editor').parentElement.scrollTop = 0;
}

function select(i) {
  if (i < 0 || i >= view.length) return;
  pos = i;
  highlight();
  renderEditor();
}

function paintProgress() {
  const done = units.filter(reviewed).length;
  $('progress').textContent = `${done} / ${units.length} reviewed`;
  $('bar-fill').style.width = `${units.length ? (done / units.length) * 100 : 0}%`;
}

function applyFilter() {
  const want = $('filter').value;
  const todoOnly = $('only-todo').checked;
  const q = $('search').value.trim().toLowerCase();

  const keep = units.filter((u) => {
    if (want !== '*' && u.section !== want) return false;
    if (todoOnly && reviewed(u)) return false;
    if (!q) return true;
    return current(u).toLowerCase().includes(q)
      || u.source.toLowerCase().includes(q)
      || (u.english || '').toLowerCase().includes(q);
  });

  // Keep the reviewer on the string they were looking at if it survived the
  // new filter; losing your place in a 798-line list is infuriating.
  const wasOn = view[pos] ? view[pos].id : null;
  view = keep;
  renderList();
  const again = wasOn ? view.findIndex((u) => u.id === wasOn) : -1;
  pos = again >= 0 ? again : (view.length ? 0 : -1);
  highlight();
  renderEditor();
}

/* ------------------------------------------------------------------ */
/* Asaun                                                               */
/* ------------------------------------------------------------------ */

function submit() {
  const unit = view[pos];
  if (!unit || !checkPlaceholders()) return;
  const text = $('input').value.trim();
  if (!text) return;

  const note = $('note').value.trim();
  if (text === current(unit)) {
    // Nothing changed about the text — but a note still deserves recording.
    if (note && note !== (state.notes[unit.id] || '')) {
      enqueue({ id: unit.id, action: 'ok', note });
      updateRow(unit.id);
    }
    flash('No change to the text — it is already what you see.');
    return;
  }

  enqueue({ id: unit.id, action: 'change', text, note });
  updateRow(unit.id);
  renderEditor();
  flash('Saved — this is live in the app now.');
}

function flash(msg) {
  const el = $('saved-hint');
  el.textContent = msg;
  el.hidden = false;
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

  for (const [title, list] of GLOSSARY) {
    const h = document.createElement('h4');
    h.textContent = title;
    host.appendChild(h);
    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Tetun</th><th>English</th><th>Note</th></tr>'
      + list.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td class="muted">${c}</td></tr>`).join('');
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

  // One listener for 798 rows.
  $('list').addEventListener('click', (e) => {
    const li = e.target.closest('.row');
    if (li) select(Number(li.dataset.i));
  });

  $('input').addEventListener('input', checkPlaceholders);
  // At a keyboard, submitting without reaching for the mouse is the difference
  // between 798 strings being tedious and being unbearable.
  $('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
  });

  $('save').addEventListener('click', submit);

  $('restore').addEventListener('click', (e) => {
    e.preventDefault();
    const unit = view[pos];
    if (!unit) return;
    $('input').value = unit.source;
    $('input').focus();
    checkPlaceholders();
  });

  $('ok').addEventListener('click', () => {
    const unit = view[pos];
    if (!unit) return;
    enqueue({ id: unit.id, action: 'ok', note: $('note').value.trim() });
    updateRow(unit.id);
    flash('Marked as correct.');
  });

  $('ask').addEventListener('click', () => {
    const unit = view[pos];
    if (!unit) return;
    const note = $('note').value.trim();
    if (!note) { $('note').focus(); return; }
    enqueue({ id: unit.id, action: 'question', note });
    updateRow(unit.id);
    flash('Flagged with your question.');
  });

  $('prev').addEventListener('click', () => select(pos - 1));
  $('next').addEventListener('click', () => select(pos + 1));

  $('filter').addEventListener('change', applyFilter);
  $('only-todo').addEventListener('change', applyFilter);
  let searchTimer = 0;
  $('search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilter, 150);
  });

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
