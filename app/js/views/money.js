/**
 * OSAN — savings tracker.
 *
 * Money is the most immediately legible benefit of quitting, and in Timor-Leste
 * where a pack is a real share of daily income it is often the strongest
 * motivator. Goals are concrete local purchases rather than abstract totals.
 */

import { t } from '../i18n.js';
import { all as allRewards, daysUntil } from '../content/rewards.js';
import { el, clear, card, stat, button, bar, toast, openSheet, field, empty } from '../ui.js';
import { money, num } from '../format.js';

export default function renderMoney(ctx) {
  const root = el('div', { class: 'screen' });

  root.appendChild(el('header', { class: 'topbar' },
    button('‹', { variant: 'btn--ghost btn--sm', 'aria-label': t('back'), onClick: () => ctx.navigate('/ferramenta') }),
    el('div', { class: 'topbar__title' }, el('h1', {}, t('money.title'))),
  ));

  const body = el('div', {});
  root.appendChild(body);

  const paint = () => {
    clear(body);
    const s = ctx.store.get();
    const snap = ctx.snapshot();
    const perDay = snap.perDay;

    body.appendChild(card({ class: 'card--brand' },
      el('div', { class: 'card__label' }, t('money.total')),
      el('div', { style: { fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-.02em' } }, money(snap.saved)),
      el('div', { class: 'small', style: { opacity: '.85' } },
        `${num(snap.notSmoked)} ${t('home.notsmoked').toLowerCase()}`),
    ));

    body.appendChild(el('div', { class: 'grid grid--2', style: { marginBottom: '14px' } },
      stat({ icon: '📅', value: money(perDay), label: t('money.perday') }),
      stat({ icon: '🗓️', value: money(perDay * 7), label: t('money.perweek') }),
      stat({ icon: '📆', value: money(perDay * 30), label: t('money.permonth') }),
      stat({ icon: '🎊', value: money(perDay * 365), label: t('money.peryear') }),
    ));

    /* ---- goals ---- */
    const goals = allRewards(s.moneyGoals);
    const list = el('div', { class: 'stack' });
    for (const goal of goals) {
      const done = snap.saved >= goal.cost;
      const days = daysUntil(goal, snap.saved, perDay);
      list.appendChild(el('div', { style: { padding: '10px 0', borderBottom: '1px solid var(--line)' } },
        el('div', { class: 'row' },
          el('span', { style: { fontSize: '1.4rem' }, 'aria-hidden': 'true' }, goal.icon || '🎯'),
          el('span', { style: { flex: '1', minWidth: '0', fontWeight: done ? '700' : '600' } },
            goal.label || goal.name),
          el('span', { class: done ? 'badge' : 'small muted' },
            done ? t('money.reached') : money(goal.cost)),
        ),
        !done
          ? el('div', { style: { marginTop: '8px' } },
              bar(goal.cost > 0 ? snap.saved / goal.cost : 0, { accent: true }),
              el('div', { class: 'tiny muted', style: { marginTop: '4px' } },
                t('money.togo', { v: money(goal.cost - snap.saved) }),
                days !== null ? ` · ${t('money.in', { n: days })}` : '',
              ),
            )
          : null,
      ));
    }

    body.appendChild(card({},
      el('div', { class: 'card__label' }, t('money.goals')),
      goals.length ? list : empty('🎯', t('plan.empty')),
      button(t('money.custom.add'), {
        variant: 'btn--soft btn--block',
        icon: '➕',
        onClick: () => openGoalSheet(ctx, paint),
      }),
    ));

    /* ---- settings ---- */
    body.appendChild(card({},
      el('div', { class: 'card__label' }, t('money.settings')),
      el('p', { class: 'small muted' },
        `${s.profile.cigsPerDay} × ${t('day')} · ${money(s.profile.pricePerPack)} / ${s.profile.cigsPerPack}`),
      button(t('edit'), { variant: 'btn--ghost btn--block', onClick: () => openRateSheet(ctx, paint) }),
    ));
  };

  paint();
  return root;
}

/* ------------------------------------------------------------------ */

function openGoalSheet(ctx, done) {
  openSheet(t('money.custom.add'), (close) => {
    const name = el('input', { type: 'text', maxlength: '48', placeholder: t('money.custom.name') });
    const cost = el('input', { type: 'number', min: '0.5', step: '0.5', inputmode: 'decimal' });

    return el('div', { class: 'stack' },
      field(t('money.custom.name'), name),
      field(t('money.custom.cost'), cost),
      button(t('save'), {
        variant: 'btn--block',
        onClick: () => {
          const label = name.value.trim();
          const value = Number(cost.value);
          if (!label || !(value > 0)) {
            toast(t('com.empty.text'), 'warn');
            return;
          }
          ctx.store.update((s) => {
            s.moneyGoals.push({ id: ctx.store.randomId('goal'), name: label.slice(0, 48), label: label.slice(0, 48), cost: value, icon: '🎯' });
          }, 'goal');
          close();
          toast(t('money.saved.ok'), 'ok');
          done();
        },
      }),
    );
  });
}

function openRateSheet(ctx, done) {
  openSheet(t('money.settings'), (close) => {
    const s = ctx.store.get();
    const cigs = el('input', { type: 'number', min: '1', max: '100', inputmode: 'numeric', value: String(s.profile.cigsPerDay) });
    const price = el('input', { type: 'number', min: '0.1', max: '50', step: '0.05', inputmode: 'decimal', value: String(s.profile.pricePerPack) });
    const perPack = el('input', { type: 'number', min: '1', max: '50', inputmode: 'numeric', value: String(s.profile.cigsPerPack) });

    return el('div', { class: 'stack' },
      field(t('ob.smoke.label'), cigs),
      field(t('ob.price.label'), price),
      field(t('ob.perpack.label'), perPack),
      button(t('save'), {
        variant: 'btn--block',
        onClick: () => {
          ctx.store.update((st) => {
            st.profile.cigsPerDay = clamp(Number(cigs.value), 1, 100, st.profile.cigsPerDay);
            st.profile.pricePerPack = clamp(Number(price.value), 0.1, 50, st.profile.pricePerPack);
            st.profile.cigsPerPack = clamp(Number(perPack.value), 1, 50, st.profile.cigsPerPack);
          }, 'profile');
          close();
          toast(t('money.saved.ok'), 'ok');
          done();
        },
      }),
    );
  });
}

function clamp(n, min, max, fallback) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
