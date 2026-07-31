/**
 * PLANU EMERJÉNSIA — the personal crisis plan.
 *
 * Four editable lists: reasons, what to do instead, who to call, what to avoid.
 * Support contacts become real `tel:` links, because "call someone" is only
 * useful advice if it is one tap away at the moment of craving.
 *
 * Everything is stored locally; phone numbers never leave the device.
 */

import { t } from '../i18n.js';
import { REASONS, DO_INSTEAD, AVOID_SUGGESTIONS } from '../content/coping.js';
import { el, clear, card, button, chip, empty, toast, openSheet, field, confirmSheet } from '../ui.js';

export default function renderPlan(ctx) {
  const root = el('div', { class: 'screen' });

  root.appendChild(el('header', { class: 'topbar' },
    button('‹', { variant: 'btn--ghost btn--sm', 'aria-label': t('back'), onClick: () => ctx.navigate('/ferramenta') }),
    el('div', { class: 'topbar__title' }, el('h1', {}, t('plan.title'))),
  ));

  const body = el('div', {});
  root.appendChild(body);

  const paint = () => {
    clear(body);
    const s = ctx.store.get();

    /* ---- reasons ---- */
    const chosen = REASONS.filter((r) => s.profile.reasons.includes(r.id));
    const reasonList = el('div', { class: 'stack' });
    for (const r of chosen) {
      reasonList.appendChild(el('div', { class: 'row' },
        el('span', { style: { fontSize: '1.2rem' }, 'aria-hidden': 'true' }, r.icon),
        el('span', { style: { flex: '1' } }, r.label),
      ));
    }
    if (s.profile.customReason) {
      reasonList.appendChild(el('div', { class: 'row' },
        el('span', { 'aria-hidden': 'true' }, '✍️'),
        el('span', { style: { flex: '1' } }, s.profile.customReason),
      ));
    }
    body.appendChild(card({},
      el('div', { class: 'card__label' }, t('plan.why')),
      chosen.length || s.profile.customReason ? reasonList : empty('❤️', t('plan.empty')),
      button(t('edit'), {
        variant: 'btn--quiet',
        style: 'padding-left:0',
        onClick: () => openReasonsSheet(ctx, paint),
      }),
    ));

    /* ---- do instead ---- */
    body.appendChild(listCard({
      label: t('plan.do'),
      icon: '✅',
      items: s.plan.doInstead,
      suggestions: DO_INSTEAD,
      onAdd: (value) => ctx.store.update((st) => { st.plan.doInstead.push(value); }, 'plan'),
      onRemove: (i) => ctx.store.update((st) => { st.plan.doInstead.splice(i, 1); }, 'plan'),
      paint,
      ctx,
    }));

    /* ---- supports ---- */
    const supports = el('div', { class: 'stack' });
    s.plan.supports.forEach((person, i) => {
      supports.appendChild(el('div', { class: 'row' },
        el('a', {
          class: 'btn btn--soft btn--sm',
          href: `tel:${String(person.phone).replace(/[^\d+]/g, '')}`,
        }, '📞', ` ${t('plan.call')}`),
        el('span', { style: { flex: '1', minWidth: '0' } },
          el('div', { style: { fontWeight: '700' } }, person.name),
          el('div', { class: 'tiny muted' }, person.phone),
        ),
        button('✕', {
          variant: 'btn--quiet btn--sm',
          'aria-label': t('delete'),
          onClick: async () => {
            const yes = await confirmSheet(t('delete'), person.name, { danger: true });
            if (!yes) return;
            ctx.store.update((st) => { st.plan.supports.splice(i, 1); }, 'plan');
            paint();
          },
        }),
      ));
    });
    body.appendChild(card({},
      el('div', { class: 'card__label' }, t('plan.support')),
      s.plan.supports.length ? supports : empty('📞', t('plan.empty')),
      button(t('plan.support.add'), {
        variant: 'btn--soft btn--block',
        icon: '➕',
        onClick: () => openSupportSheet(ctx, paint),
      }),
    ));

    /* ---- avoid ---- */
    body.appendChild(listCard({
      label: t('plan.avoid'),
      icon: '🚫',
      items: s.plan.avoid,
      suggestions: AVOID_SUGGESTIONS,
      onAdd: (value) => ctx.store.update((st) => { st.plan.avoid.push(value); }, 'plan'),
      onRemove: (i) => ctx.store.update((st) => { st.plan.avoid.splice(i, 1); }, 'plan'),
      paint,
      ctx,
    }));

    body.appendChild(el('p', { class: 'tiny muted' }, t('plan.print')));
  };

  paint();
  return root;
}

/* ------------------------------------------------------------------ */

function listCard({ label, icon, items, suggestions, onAdd, onRemove, paint, ctx }) {
  const list = el('div', { class: 'stack' });
  items.forEach((item, i) => {
    list.appendChild(el('div', { class: 'row' },
      el('span', { 'aria-hidden': 'true' }, icon),
      el('span', { style: { flex: '1', minWidth: '0' } }, item),
      button('✕', {
        variant: 'btn--quiet btn--sm',
        'aria-label': t('delete'),
        onClick: () => {
          onRemove(i);
          paint();
        },
      }),
    ));
  });

  const unused = suggestions.filter((sug) => !items.includes(sug));
  const sugRow = el('div', { class: 'quickbar' });
  for (const sug of unused.slice(0, 6)) {
    sugRow.appendChild(chip(`＋ ${sug}`, {
      onClick: () => {
        onAdd(sug);
        ctx.tracking.checkBadges();
        paint();
      },
    }));
  }

  return card({},
    el('div', { class: 'card__label' }, label),
    items.length ? list : empty(icon, t('plan.empty')),
    unused.length ? sugRow : null,
    button(t('plan.addItem'), {
      variant: 'btn--soft btn--block',
      icon: '➕',
      onClick: () => openSheet(label, (close) => {
        const input = el('input', { type: 'text', maxlength: '80', placeholder: t('plan.item.ph') });
        return el('div', { class: 'stack' },
          field(label, input),
          button(t('save'), {
            variant: 'btn--block',
            onClick: () => {
              const value = input.value.trim();
              if (!value) {
                toast(t('com.empty.text'), 'warn');
                return;
              }
              onAdd(value.slice(0, 80));
              ctx.tracking.checkBadges();
              close();
              paint();
            },
          }),
        );
      }),
    }),
  );
}

function openReasonsSheet(ctx, done) {
  openSheet(t('plan.why'), (close) => {
    const s = ctx.store.get();
    let selected = [...s.profile.reasons];

    const grid = el('div', { class: 'stack' });
    for (const reason of REASONS) {
      const btn = el('button', {
        class: `chip ${selected.includes(reason.id) ? 'chip--on' : ''}`.trim(),
        type: 'button',
        style: 'width:100%;justify-content:flex-start;min-height:52px;text-align:left',
        onclick: () => {
          const has = selected.includes(reason.id);
          selected = has ? selected.filter((x) => x !== reason.id) : [...selected, reason.id];
          btn.classList.toggle('chip--on', !has);
        },
      }, el('span', { 'aria-hidden': 'true' }, reason.icon), reason.label);
      grid.appendChild(btn);
    }

    const custom = el('textarea', { rows: '2', maxlength: '160', placeholder: t('ob.why.custom') }, s.profile.customReason);

    return el('div', { class: 'stack' },
      grid,
      custom,
      button(t('save'), {
        variant: 'btn--block',
        onClick: () => {
          ctx.store.update((st) => {
            st.profile.reasons = selected;
            st.profile.customReason = custom.value.trim().slice(0, 160);
          }, 'profile');
          close();
          done();
        },
      }),
    );
  });
}

function openSupportSheet(ctx, done) {
  openSheet(t('plan.support.add'), (close) => {
    const name = el('input', { type: 'text', maxlength: '40', autocomplete: 'name' });
    const phone = el('input', { type: 'tel', maxlength: '24', inputmode: 'tel', autocomplete: 'tel' });

    return el('div', { class: 'stack' },
      field(t('plan.support.name'), name),
      field(t('plan.support.phone'), phone),
      button(t('save'), {
        variant: 'btn--block',
        onClick: () => {
          const n = name.value.trim();
          const p = phone.value.trim();
          if (!n || !p) {
            toast(t('com.empty.text'), 'warn');
            return;
          }
          ctx.store.update((st) => {
            st.plan.supports.push({ name: n.slice(0, 40), phone: p.slice(0, 24) });
          }, 'plan');
          ctx.tracking.checkBadges();
          close();
          toast(t('diary.saved'), 'ok');
          done();
        },
      }),
    );
  });
}
