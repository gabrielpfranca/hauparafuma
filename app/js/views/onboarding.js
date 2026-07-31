/**
 * ONBOARDING — registration, mirroring the handbook's registration step:
 * nickname, tobacco use, quit date, motivations, notification consent.
 *
 * Deliberately short and skippable where possible. A long form before any value
 * is delivered is where cessation programmes lose people; every screen here
 * either personalises the programme or is required for consent.
 */

import { t } from '../i18n.js';
import * as store from '../store.js';
import * as notif from '../notifications.js';
import { REASONS } from '../content/coping.js';
import { el, clear, button, chip, field, callout, multiline, bar, toast } from '../ui.js';
import { isoDate, parseIsoDate, MS } from '../format.js';

const TOTAL = 6;

export default function renderOnboarding(ctx) {
  const root = el('div', { class: 'screen screen--plain' });

  // Working copy — nothing is written to the store until the last step, so
  // abandoning onboarding halfway leaves no half-configured programme.
  const draft = {
    step: 0,
    nickname: '',
    cigsPerDay: 10,
    pricePerPack: 2.0,
    cigsPerPack: 20,
    dateChoice: 'week',
    quitDate: isoDate(Date.now() + 7 * MS.day),
    reasons: [],
    customReason: '',
  };

  const paint = () => {
    clear(root);
    root.appendChild(STEPS[draft.step](draft, go, ctx));
    window.scrollTo(0, 0);
  };

  const go = (delta) => {
    const next = draft.step + delta;
    if (next < 0) return;
    if (next >= TOTAL) {
      commit(draft, ctx);
      return;
    }
    draft.step = next;
    paint();
  };

  paint();
  return root;
}

/* ------------------------------------------------------------------ */

function header(step, title) {
  return el('div', { style: { marginBottom: '18px' } },
    step > 0 ? el('div', { class: 'topbar__eyebrow' }, t('ob.step', { n: step, total: TOTAL - 1 })) : null,
    step > 0 ? bar(step / (TOTAL - 1)) : null,
    el('h1', { style: { marginTop: '14px' } }, title),
  );
}

function nav(go, { nextLabel, canNext = true, onNext, showBack = true }) {
  return el('div', { class: 'row', style: { marginTop: '22px', gap: '10px' } },
    showBack ? button(t('back'), { variant: 'btn--ghost', onClick: () => go(-1) }) : null,
    el('div', { class: 'spacer' }),
    button(nextLabel || t('next'), {
      variant: 'btn--lg',
      disabled: !canNext,
      onClick: onNext || (() => go(1)),
      style: 'flex:1',
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Pasu sira                                                          */
/* ------------------------------------------------------------------ */

const STEPS = [
  /* 0 — bemvindu */
  (draft, go) => el('div', { class: 'stack' },
    el('div', { class: 'center', style: { padding: '28px 0 6px' } },
      el('div', { style: { fontSize: '4rem' }, 'aria-hidden': 'true' }, '🌱'),
      el('h1', { style: { marginTop: '10px' } }, t('ob.welcome.title')),
    ),
    ...multiline(t('ob.welcome.body'), 'p', { class: 'muted' }),
    callout(t('ob.welcome.privacy'), 'callout--brand'),
    button(t('start'), { variant: 'btn--lg btn--block', onClick: () => go(1) }),
  ),

  /* 1 — naran */
  (draft, go) => {
    const input = el('input', {
      type: 'text',
      value: draft.nickname,
      placeholder: t('ob.name.ph'),
      maxlength: '24',
      autocomplete: 'nickname',
      oninput: (e) => {
        draft.nickname = e.target.value;
        next.disabled = !e.target.value.trim();
      },
    });
    const next = button(t('next'), {
      variant: 'btn--lg',
      disabled: !draft.nickname.trim(),
      onClick: () => {
        if (!draft.nickname.trim()) {
          toast(t('ob.name.required'), 'warn');
          return;
        }
        go(1);
      },
      style: 'flex:1',
    });
    return el('div', {},
      header(1, t('ob.name.title')),
      field(t('ob.name.label'), input, t('ob.name.hint')),
      el('div', { class: 'row', style: { marginTop: '22px' } },
        button(t('back'), { variant: 'btn--ghost', onClick: () => go(-1) }),
        el('div', { class: 'spacer' }),
        next,
      ),
    );
  },

  /* 2 — fuma hira, folin hira */
  (draft, go) => {
    const cigs = el('input', {
      type: 'number', min: '1', max: '100', inputmode: 'numeric',
      value: String(draft.cigsPerDay),
      oninput: (e) => { draft.cigsPerDay = clampNum(e.target.value, 1, 100, 10); },
    });
    const price = el('input', {
      type: 'number', min: '0.1', max: '50', step: '0.05', inputmode: 'decimal',
      value: String(draft.pricePerPack),
      oninput: (e) => { draft.pricePerPack = clampNum(e.target.value, 0.1, 50, 2); },
    });
    const perPack = el('input', {
      type: 'number', min: '1', max: '50', inputmode: 'numeric',
      value: String(draft.cigsPerPack),
      oninput: (e) => { draft.cigsPerPack = clampNum(e.target.value, 1, 50, 20); },
    });
    return el('div', {},
      header(2, t('ob.smoke.title')),
      field(t('ob.smoke.label'), cigs, t('ob.smoke.hint')),
      el('h2', { style: { margin: '20px 0 10px' } }, t('ob.price.title')),
      field(t('ob.price.label'), price, t('ob.price.hint')),
      field(t('ob.perpack.label'), perPack),
      nav(go, {}),
    );
  },

  /* 3 — loron para fuma */
  (draft, go) => {
    const dateInput = el('input', {
      type: 'date',
      value: draft.quitDate,
      onchange: (e) => { draft.quitDate = e.target.value; },
    });
    const dateField = field(
      draft.dateChoice === 'already' ? t('ob.date.past') : t('ob.date.label'),
      dateInput,
    );
    dateField.hidden = draft.dateChoice !== 'custom' && draft.dateChoice !== 'already';

    const options = [
      { id: 'today', label: t('ob.date.opt.today'), date: () => isoDate(Date.now()) },
      { id: 'week', label: t('ob.date.opt.week'), date: () => isoDate(Date.now() + 7 * MS.day) },
      { id: 'custom', label: t('ob.date.opt.custom'), date: () => draft.quitDate },
      { id: 'already', label: t('ob.date.opt.already'), date: () => draft.quitDate },
    ];

    const list = el('div', { class: 'stack' });
    for (const opt of options) {
      const btn = el('button', {
        class: `chip ${draft.dateChoice === opt.id ? 'chip--on' : ''}`.trim(),
        type: 'button',
        style: 'width:100%;justify-content:flex-start;min-height:52px',
        onclick: () => {
          draft.dateChoice = opt.id;
          if (opt.id === 'today' || opt.id === 'week') draft.quitDate = opt.date();
          if (opt.id === 'already' && parseIsoDate(draft.quitDate) > new Date()) {
            draft.quitDate = isoDate(Date.now());
          }
          dateInput.value = draft.quitDate;
          for (const other of list.children) other.classList.remove('chip--on');
          btn.classList.add('chip--on');
          dateField.hidden = opt.id !== 'custom' && opt.id !== 'already';
          dateField.querySelector('label').textContent =
            opt.id === 'already' ? t('ob.date.past') : t('ob.date.label');
        },
      }, opt.label);
      list.appendChild(btn);
    }

    return el('div', {},
      header(3, t('ob.date.title')),
      el('p', { class: 'muted' }, t('ob.date.body')),
      list,
      dateField,
      nav(go, {
        onNext: () => {
          const parsed = parseIsoDate(draft.quitDate);
          if (!parsed) {
            toast(t('ob.date.invalid'), 'warn');
            return;
          }
          go(1);
        },
      }),
    );
  },

  /* 4 — tanbasá */
  (draft, go) => {
    const grid = el('div', { class: 'stack' });
    for (const reason of REASONS) {
      const on = draft.reasons.includes(reason.id);
      const btn = el('button', {
        class: `chip ${on ? 'chip--on' : ''}`.trim(),
        type: 'button',
        style: 'width:100%;justify-content:flex-start;min-height:52px;text-align:left',
        'aria-pressed': String(on),
        onclick: () => {
          const has = draft.reasons.includes(reason.id);
          draft.reasons = has
            ? draft.reasons.filter((r) => r !== reason.id)
            : [...draft.reasons, reason.id];
          btn.classList.toggle('chip--on', !has);
          btn.setAttribute('aria-pressed', String(!has));
        },
      }, el('span', { 'aria-hidden': 'true' }, reason.icon), reason.label);
      grid.appendChild(btn);
    }

    const custom = el('textarea', {
      placeholder: t('ob.why.custom'),
      maxlength: '160',
      oninput: (e) => { draft.customReason = e.target.value; },
    }, draft.customReason);

    return el('div', {},
      header(4, t('ob.why.title')),
      el('p', { class: 'muted' }, t('ob.why.body')),
      grid,
      el('div', { class: 'field', style: { marginTop: '14px' } }, custom),
      nav(go, {
        onNext: () => {
          if (!draft.reasons.length && !draft.customReason.trim()) {
            toast(t('ob.why.min'), 'warn');
            return;
          }
          go(1);
        },
      }),
    );
  },

  /* 5 — notifikasaun */
  (draft, go) => el('div', {},
    header(5, t('ob.notif.title')),
    el('div', { class: 'center', style: { padding: '8px 0 16px' } },
      el('div', { style: { fontSize: '3.2rem' }, 'aria-hidden': 'true' }, '🔔'),
    ),
    ...multiline(t('ob.notif.body'), 'p', { class: 'muted' }),
    el('div', { class: 'stack', style: { marginTop: '18px' } },
      button(t('ob.notif.allow'), {
        variant: 'btn--lg btn--block',
        onClick: async () => {
          const result = await notif.request();
          if (result === 'granted') draft.notifications = true;
          else if (result === 'denied') toast(t('ob.notif.blocked'), 'warn');
          else if (result === 'unsupported') toast(t('notif.unsupported'), 'warn');
          go(1);
        },
      }),
      button(t('ob.notif.later'), { variant: 'btn--quiet btn--block', onClick: () => go(1) }),
    ),
    el('div', { class: 'row', style: { marginTop: '10px' } },
      button(t('back'), { variant: 'btn--ghost', onClick: () => go(-1) }),
    ),
  ),
];

/* ------------------------------------------------------------------ */

function clampNum(raw, min, max, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Write the draft into the store and hand over to the app. */
function commit(draft, ctx) {
  const parsed = parseIsoDate(draft.quitDate) || new Date();
  parsed.setHours(0, 0, 0, 0);

  store.update((s) => {
    s.profile.nickname = draft.nickname.trim().slice(0, 24) || 'Belun';
    s.profile.cigsPerDay = draft.cigsPerDay;
    s.profile.pricePerPack = draft.pricePerPack;
    s.profile.cigsPerPack = draft.cigsPerPack;
    s.profile.reasons = draft.reasons;
    s.profile.customReason = draft.customReason.trim().slice(0, 160);
    s.quit.date = parsed.getTime();
    s.settings.notifications = notif.permission() === 'granted';
  }, 'onboarding');

  ctx.finishOnboarding();
}
