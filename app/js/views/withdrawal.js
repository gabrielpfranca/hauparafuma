/**
 * ABSTINÉNSIA — withdrawal symptom guide.
 *
 * Every entry pairs the symptom with when it happens and what to do. The
 * framing matters: these are presented as evidence the body is recovering, not
 * as damage. People who expect symptoms and know they end are far less likely
 * to read them as a reason to start smoking again.
 */

import { t } from '../i18n.js';
import { WITHDRAWAL } from '../content/coping.js';
import { el, card, button, callout } from '../ui.js';

export default function renderWithdrawal(ctx) {
  const root = el('div', { class: 'screen' });

  root.appendChild(el('header', { class: 'topbar' },
    button('‹', { variant: 'btn--ghost btn--sm', 'aria-label': t('back'), onClick: () => ctx.navigate('/ferramenta') }),
    el('div', { class: 'topbar__title' }, el('h1', {}, t('wd.title'))),
  ));

  root.appendChild(callout(t('wd.sub'), 'callout--brand'));

  for (const item of WITHDRAWAL) {
    root.appendChild(card({},
      el('div', { class: 'row', style: { marginBottom: '8px' } },
        el('div', { style: { fontSize: '1.6rem' }, 'aria-hidden': 'true' }, item.icon),
        el('div', { style: { flex: '1', minWidth: '0' } },
          el('h3', {}, item.what),
          el('div', { class: 'tiny muted' }, `${t('wd.when')}: ${item.when}`),
        ),
      ),
      el('div', { class: 'callout callout--brand' },
        el('div', { class: 'tiny', style: { fontWeight: '800', marginBottom: '2px' } }, t('wd.do')),
        el('div', {}, item.do),
      ),
    ));
  }

  root.appendChild(el('div', { class: 'stack' },
    button(t('tools.services'), { variant: 'btn--soft btn--block', icon: '🏥', onClick: () => ctx.navigate('/servisu') }),
    button(t('tools.breathe'), { variant: 'btn--soft btn--block', icon: '🌬️', onClick: () => ctx.navigate('/dada-iis') }),
  ));

  return root;
}
