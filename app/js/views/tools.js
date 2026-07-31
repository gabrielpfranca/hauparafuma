/**
 * FERRAMENTA — the tools hub.
 *
 * Ordered by how urgently someone needs each one: the craving responses (game,
 * breathing) sit at the top, where a thumb reaches first, and the reflective
 * tools (test, services) sit below.
 */

import { t } from '../i18n.js';
import { el, card, listRow, button } from '../ui.js';

const TOOLS = [
  { route: '/jogu',         icon: '🎮', title: 'tools.game',       sub: 'tools.game.sub' },
  { route: '/dada-iis',     icon: '🌬️', title: 'tools.breathe',    sub: 'tools.breathe.sub' },
  { route: '/gatilhu',      icon: '🎯', title: 'tools.triggers',   sub: 'tools.triggers.sub' },
  { route: '/planu',        icon: '🗺️', title: 'tools.plan',       sub: 'tools.plan.sub' },
  { route: '/diariu',       icon: '📔', title: 'tools.diary',      sub: 'tools.diary.sub' },
  { route: '/osan',         icon: '💵', title: 'tools.money',      sub: 'tools.money.sub' },
  { route: '/saude',        icon: '🫁', title: 'tools.health',     sub: 'tools.health.sub' },
  { route: '/konkista',     icon: '🏅', title: 'tools.badges',     sub: 'tools.badges.sub' },
  { route: '/abstinensia',  icon: '🩹', title: 'tools.withdrawal', sub: 'tools.withdrawal.sub' },
  { route: '/teste',        icon: '📋', title: 'tools.test',       sub: 'tools.test.sub' },
  { route: '/servisu',      icon: '🏥', title: 'tools.services',   sub: 'tools.services.sub' },
];

export default function renderTools(ctx) {
  const root = el('div', { class: 'screen' });

  root.appendChild(el('header', { class: 'topbar' },
    el('div', { class: 'topbar__title' },
      el('div', { class: 'topbar__eyebrow' }, t('tools.sub')),
      el('h1', {}, t('tools.title')),
    ),
  ));

  root.appendChild(card({ class: 'card--brand' },
    el('h3', {}, t('sos.title')),
    el('p', { class: 'small', style: { opacity: '.85' } }, t('sos.body')),
    button(t('sos.button'), {
      variant: 'btn--accent btn--block',
      icon: '🆘',
      onClick: () => ctx.openSOS(),
    }),
  ));

  const list = el('div', { class: 'card card--flush' });
  for (const tool of TOOLS) {
    list.appendChild(listRow({
      icon: tool.icon,
      title: t(tool.title),
      sub: t(tool.sub),
      onClick: () => ctx.navigate(tool.route),
    }));
  }
  root.appendChild(list);

  return root;
}
