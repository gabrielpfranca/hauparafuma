/**
 * KONKISTA — the badge wall.
 *
 * Earned badges can be shared to the community with one tap and pre-filled
 * text. Locked ones stay visible but greyed, so there is always a visible next
 * step rather than a blank screen.
 */

import { t } from '../i18n.js';
import { BADGES } from '../content/badges.js';
import { el, clear, card, button, bar, openSheet } from '../ui.js';
import { date } from '../format.js';

export default function renderBadges(ctx) {
  const root = el('div', { class: 'screen' });

  root.appendChild(el('header', { class: 'topbar' },
    button('‹', { variant: 'btn--ghost btn--sm', 'aria-label': t('back'), onClick: () => ctx.navigate('/ferramenta') }),
    el('div', { class: 'topbar__title' }, el('h1', {}, t('badge.title'))),
  ));

  const body = el('div', {});
  root.appendChild(body);

  const paint = () => {
    clear(body);
    // Award anything newly due before painting, so the wall is never stale.
    ctx.tracking.checkBadges();
    const list = ctx.tracking.badgeList();
    const have = list.filter((b) => b.earnedAt);

    body.appendChild(card({ class: 'card--brand' },
      el('div', { class: 'card__label' }, t('badge.count', { n: have.length, t: BADGES.length })),
      el('div', { style: { marginTop: '8px' } }, bar(have.length / BADGES.length, { accent: true })),
    ));

    const grid = el('div', { class: 'grid grid--3' });
    for (const badge of list) {
      const node = el('button', {
        class: `trophy ${badge.earnedAt ? '' : 'trophy--locked'}`.trim(),
        type: 'button',
        style: 'cursor:pointer',
        onclick: () => showBadge(ctx, badge, paint),
      },
        el('span', { class: 'trophy__ico', 'aria-hidden': 'true' }, badge.icon),
        el('span', { class: 'trophy__ttl' }, badge.title),
      );
      grid.appendChild(node);
    }
    body.appendChild(grid);
  };

  paint();
  return root;
}

function showBadge(ctx, badge, done) {
  openSheet(badge.title, (close) => el('div', { class: 'stack center' },
    el('div', {
      style: { fontSize: '3.4rem', opacity: badge.earnedAt ? '1' : '.35' },
      'aria-hidden': 'true',
    }, badge.icon),
    el('p', {}, badge.desc),
    el('p', { class: 'tiny muted' }, badge.earnedAt ? date(badge.earnedAt) : t('badge.locked')),
    badge.earnedAt && !badge.shared
      ? button(t('badge.share'), {
          variant: 'btn--block',
          onClick: async () => {
            close();
            await ctx.shareBadge(badge);
            done();
          },
        })
      : null,
    badge.shared ? el('p', { class: 'badge' }, t('badge.shared')) : null,
    button(t('close'), { variant: 'btn--quiet btn--block', onClick: close }),
  ));
}
