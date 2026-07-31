/**
 * GATILHU — trigger cards.
 *
 * Pick a situation, get why it happens plus a concrete plan. Personal triggers
 * from the diary are surfaced first, so the card someone actually needs is at
 * the top rather than buried in a generic list.
 */

import { t } from '../i18n.js';
import { TRIGGERS } from '../content/coping.js';
import { el, clear, card, button, chip, callout } from '../ui.js';

export default function renderTriggers(ctx) {
  const root = el('div', { class: 'screen' });

  root.appendChild(el('header', { class: 'topbar' },
    button('‹', { variant: 'btn--ghost btn--sm', 'aria-label': t('back'), onClick: () => ctx.navigate('/ferramenta') }),
    el('div', { class: 'topbar__title' },
      el('div', { class: 'topbar__eyebrow' }, t('trig.sub')),
      el('h1', {}, t('trig.title')),
    ),
  ));

  // Order by the person's own diary history, most frequent first.
  const mine = ctx.tracking.topTriggers(ctx.store.get().diary, TRIGGERS.length).map((x) => x.id);
  const ordered = [
    ...mine.map((id) => TRIGGERS.find((x) => x.id === id)).filter(Boolean),
    ...TRIGGERS.filter((x) => !mine.includes(x.id)),
  ];

  let selected = ordered[0]?.id || null;

  const picker = el('div', { class: 'quickbar' });
  const detail = el('div', {});

  const paintPicker = () => {
    clear(picker);
    for (const trig of ordered) {
      picker.appendChild(chip(`${trig.icon} ${trig.label}`, {
        pressed: selected === trig.id,
        onClick: () => {
          selected = trig.id;
          paintPicker();
          paintDetail();
        },
      }));
    }
  };

  const paintDetail = () => {
    clear(detail);
    const trig = ordered.find((x) => x.id === selected);
    if (!trig) return;

    detail.appendChild(card({},
      el('div', { class: 'row', style: { marginBottom: '10px' } },
        el('div', { style: { fontSize: '2rem' }, 'aria-hidden': 'true' }, trig.icon),
        el('h2', { style: { flex: '1' } }, trig.label),
      ),
      el('p', { class: 'muted' }, trig.why),
      el('div', { class: 'card__label', style: { marginTop: '8px' } }, t('trig.instead')),
      el('ul', { class: 'stack', style: { paddingLeft: '18px', margin: '0' } },
        ...trig.plan.map((step) => el('li', { style: { marginBottom: '6px' } }, step)),
      ),
    ));

    detail.appendChild(el('div', { class: 'row row--wrap' },
      button(t('tools.game'), { variant: 'btn--soft btn--sm', onClick: () => ctx.navigate('/jogu') }),
      button(t('tools.breathe'), { variant: 'btn--soft btn--sm', onClick: () => ctx.navigate('/dada-iis') }),
      button(t('tools.plan'), { variant: 'btn--soft btn--sm', onClick: () => ctx.navigate('/planu') }),
    ));
  };

  paintPicker();
  paintDetail();

  root.appendChild(picker);
  root.appendChild(detail);

  if (!ctx.store.get().diary.length) {
    root.appendChild(callout(t('diary.empty'), 'callout--brand'));
    root.appendChild(button(t('diary.add'), {
      variant: 'btn--soft btn--block',
      onClick: () => ctx.navigate('/diariu'),
    }));
  }

  return root;
}
