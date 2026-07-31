/**
 * UI helpers — small DOM builders.
 *
 * SECURITY RULE for this whole app: user-supplied text (nicknames, community
 * posts, diary notes, plan items) is only ever attached with `textContent` via
 * `el()`. There is no `innerHTML` path that touches user data. That is the
 * single defence that matters for a public feed where anyone can post.
 */

import { t } from './i18n.js';

/**
 * Create an element.
 *   el('div', { class: 'card' }, 'text', el('b', {}, 'bold'))
 * Strings in `children` become text nodes, never markup.
 * `on*` props attach listeners; `dataset` and `style` take objects.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class' || k === 'className') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'html') {
      // Explicit opt-in, only ever called with strings written in this codebase.
      node.innerHTML = v;
    } else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }

  append(node, children);
  return node;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Render multi-line text as real line breaks without touching innerHTML. */
export function multiline(text, tag = 'p', props = {}) {
  const lines = String(text ?? '').split('\n');
  return lines.map((line) => el(tag, props, line || ' '));
}

/* ---------------- building blocks ---------------- */

export function card(props, ...children) {
  return el('div', { ...props, class: `card ${props.class || ''}`.trim() }, ...children);
}

export function stat({ icon, value, label }) {
  return el('div', { class: 'stat' },
    el('div', { class: 'stat__icon', 'aria-hidden': 'true' }, icon),
    el('div', { class: 'stat__n' }, value),
    el('div', { class: 'stat__t' }, label),
  );
}

export function button(label, { onClick, variant = '', icon, ...rest } = {}) {
  return el('button', {
    class: `btn ${variant}`.trim(),
    type: 'button',
    onclick: onClick,
    ...rest,
  }, icon ? el('span', { 'aria-hidden': 'true' }, icon) : null, label);
}

export function chip(label, { onClick, pressed, ...rest } = {}) {
  return el('button', {
    class: 'chip',
    type: 'button',
    'aria-pressed': pressed === undefined ? undefined : String(Boolean(pressed)),
    onclick: onClick,
    ...rest,
  }, label);
}

export function listRow({ icon, title, sub, onClick, arrow = '›' }) {
  return el('button', { class: 'list__row', type: 'button', onclick: onClick },
    icon ? el('span', { class: 'list__ico', 'aria-hidden': 'true' }, icon) : null,
    el('span', { class: 'list__txt' },
      el('span', { class: 'list__ttl' }, title),
      sub ? el('span', { class: 'list__sub' }, sub) : null,
    ),
    el('span', { class: 'list__arrow', 'aria-hidden': 'true' }, arrow),
  );
}

export function bar(fraction, { accent = false } = {}) {
  const pct = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
  return el('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': pct },
    el('div', { class: `bar__fill ${accent ? 'bar__fill--accent' : ''}`.trim(), style: { width: pct } }),
  );
}

export function empty(icon, text) {
  return el('div', { class: 'empty' },
    el('span', { class: 'empty__ico', 'aria-hidden': 'true' }, icon),
    el('p', {}, text),
  );
}

export function field(labelText, control, hint) {
  const id = control.id || `f_${Math.random().toString(36).slice(2, 8)}`;
  control.id = id;
  return el('div', { class: 'field' },
    el('label', { for: id }, labelText),
    control,
    hint ? el('div', { class: 'field__hint' }, hint) : null,
  );
}

export function callout(text, variant = '') {
  return el('div', { class: `callout ${variant}`.trim() }, ...multiline(text));
}

export function topbar(title, eyebrow) {
  return el('header', { class: 'topbar' },
    el('div', { class: 'topbar__title' },
      eyebrow ? el('div', { class: 'topbar__eyebrow' }, eyebrow) : null,
      el('h1', {}, title),
    ),
  );
}

/** Progress ring used for the health timeline. */
export function ring(fraction, label) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, fraction)));
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'ring');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);

  const mk = (cls, extra = {}) => {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('class', cls);
    circle.setAttribute('cx', '60');
    circle.setAttribute('cy', '60');
    circle.setAttribute('r', String(r));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke-width', '10');
    circle.setAttribute('stroke-linecap', 'round');
    for (const [k, v] of Object.entries(extra)) circle.setAttribute(k, v);
    return circle;
  };

  svg.appendChild(mk('ring__track'));
  svg.appendChild(mk('ring__val', {
    'stroke-dasharray': String(c),
    'stroke-dashoffset': String(offset),
    transform: 'rotate(-90 60 60)',
  }));

  const text = document.createElementNS(svgNS, 'text');
  text.setAttribute('class', 'ring__text');
  text.setAttribute('x', '60');
  text.setAttribute('y', '66');
  text.setAttribute('text-anchor', 'middle');
  text.textContent = label;
  svg.appendChild(text);
  return svg;
}

/* ---------------- toasts ---------------- */

export function toast(message, variant = '', ms = 3200) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = el('div', { class: `toast ${variant ? `toast--${variant}` : ''}`.trim(), role: 'status' }, message);
  host.appendChild(node);
  setTimeout(() => node.remove(), ms);
}

/* ---------------- bottom sheet ---------------- */

let sheetCleanup = null;

/**
 * Open the bottom sheet with `title` and a rendered body.
 * `render(close)` returns a Node; it receives the close function so buttons
 * inside the sheet can dismiss it.
 */
export function openSheet(title, render) {
  const root = document.getElementById('sheet');
  const body = document.getElementById('sheet-body');
  const heading = document.getElementById('sheet-title');
  if (!root || !body || !heading) return () => {};

  closeSheet();

  heading.textContent = title;
  root.setAttribute('aria-label', title);
  clear(body);
  body.appendChild(render(closeSheet));
  root.hidden = false;
  document.body.style.overflow = 'hidden';

  const onKey = (e) => {
    if (e.key === 'Escape') closeSheet();
  };
  document.addEventListener('keydown', onKey);

  const onClick = (e) => {
    if (e.target.closest('[data-sheet-close]')) closeSheet();
  };
  root.addEventListener('click', onClick);

  sheetCleanup = () => {
    document.removeEventListener('keydown', onKey);
    root.removeEventListener('click', onClick);
  };

  // Move focus into the sheet for keyboard and screen-reader users.
  const focusable = body.querySelector('button, [href], input, select, textarea');
  (focusable || document.getElementById('sheet-title'))?.focus?.();

  return closeSheet;
}

export function closeSheet() {
  const root = document.getElementById('sheet');
  const body = document.getElementById('sheet-body');
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.style.overflow = '';
  if (body) clear(body);
  if (sheetCleanup) {
    sheetCleanup();
    sheetCleanup = null;
  }
}

/** Confirmation sheet — used before anything destructive. */
export function confirmSheet(title, message, { danger = false, confirmLabel = t('ok') } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      closeSheet();
      resolve(v);
    };
    openSheet(title, () => el('div', { class: 'stack' },
      ...multiline(message),
      el('div', { class: 'row', style: { marginTop: '16px' } },
        button(t('cancel'), { variant: 'btn--ghost', onClick: () => done(false), style: 'flex:1' }),
        button(confirmLabel, { variant: danger ? 'btn--danger' : '', onClick: () => done(true), style: 'flex:1' }),
      ),
    ));
    // Dismissing by backdrop/escape counts as cancel.
    const root = document.getElementById('sheet');
    const observer = new MutationObserver(() => {
      if (root.hidden) {
        observer.disconnect();
        done(false);
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['hidden'] });
  });
}

/** Deterministic pleasant colour from a seed, for avatars. */
export function avatarColor(seed) {
  const hue = ((Number(seed) || 0) % 360 + 360) % 360;
  return `hsl(${hue} 52% 38%)`;
}

/** First letter of a nickname, for the avatar circle. */
export function initial(name) {
  const s = String(name || '?').trim();
  return s ? s[0].toUpperCase() : '?';
}

/** Short vibration for tactile feedback where the platform allows it. */
export function buzz(pattern = 12) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* not supported — silent */ }
}
