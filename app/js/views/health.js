/**
 * SAÚDE — the recovery timeline.
 *
 * Reached milestones are marked done and stay visible rather than disappearing:
 * the list of what the body has already recovered is itself the motivator, and
 * on a hard day it is the screen worth opening.
 */

import { t } from '../i18n.js';
import { MILESTONES } from '../content/milestones.js';
import { el, card, button, ring, bar } from '../ui.js';
import { durationShort, duration } from '../format.js';

export default function renderHealth(ctx) {
  const root = el('div', { class: 'screen' });
  const snap = ctx.snapshot();

  root.appendChild(el('header', { class: 'topbar' },
    button('‹', { variant: 'btn--ghost btn--sm', 'aria-label': t('back'), onClick: () => ctx.navigate('/ferramenta') }),
    el('div', { class: 'topbar__title' },
      el('div', { class: 'topbar__eyebrow' }, t('health.sub')),
      el('h1', {}, t('health.title')),
    ),
  ));

  const done = snap.milestonesDone.length;
  const total = MILESTONES.length;

  root.appendChild(card({ class: 'card--brand' },
    el('div', { class: 'center' },
      ring(done / total, `${done}/${total}`),
      el('div', { style: { marginTop: '10px', fontWeight: '700' } },
        t('health.progress', { n: done, t: total })),
      el('div', { class: 'small', style: { opacity: '.85' } },
        snap.hasQuit ? `${t('home.free.label')}: ${durationShort(snap.smokeFreeMs)}` : t('home.countdown.label')),
    ),
  ));

  /* ---- next milestone progress ---- */
  if (snap.milestoneNext) {
    const remaining = Math.max(0, snap.milestoneNext.ms - snap.smokeFreeMs);
    root.appendChild(card({},
      el('div', { class: 'card__label' }, t('health.next')),
      el('div', { class: 'row' },
        el('div', { style: { fontSize: '1.8rem' }, 'aria-hidden': 'true' }, snap.milestoneNext.icon),
        el('div', { style: { flex: '1', minWidth: '0' } },
          el('div', { style: { fontWeight: '700' } }, snap.milestoneNext.title),
          el('div', { class: 'small muted' }, `${t('money.togo', { v: duration(remaining) })}`),
        ),
      ),
      el('div', { style: { marginTop: '10px' } }, bar(snap.milestoneProgress)),
    ));
  }

  /* ---- timeline ---- */
  const list = el('ul', { class: 'tl' });
  for (const m of MILESTONES) {
    const isDone = snap.smokeFreeMs >= m.ms;
    const isNext = snap.milestoneNext && snap.milestoneNext.id === m.id;
    list.appendChild(el('li', {
      class: `tl__item ${isDone ? 'tl__item--done' : ''} ${isNext ? 'tl__item--next' : ''}`.trim(),
    },
      el('div', { class: 'tl__dot', 'aria-hidden': 'true' }, isDone ? '✓' : m.icon),
      el('div', { class: 'tl__body' },
        el('div', { class: 'tl__when' },
          m.when,
          isDone ? ` · ${t('health.done')}` : isNext ? ` · ${t('health.next')}` : '',
        ),
        el('div', { class: 'tl__title' }, m.title),
        el('div', { class: 'small muted' }, m.body),
      ),
    ));
  }
  root.appendChild(card({}, list));

  root.appendChild(el('p', { class: 'tiny muted' }, t('health.source')));

  return root;
}
