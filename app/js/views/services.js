/**
 * SERVISU SAÚDE — referral to real-world help.
 *
 * The handbook's service-referral category. Two deliberate choices:
 *
 *  1. NO INVENTED PHONE NUMBERS. A wrong quitline number is worse than none —
 *     someone in crisis calls it, gets nothing, and loses trust. Numbers are a
 *     list the person or a deploying health service fills in, with a visible
 *     note to confirm them locally.
 *  2. The mental-health warning is stated plainly. Low mood in the first weeks
 *     is common; thoughts of self-harm need a clinician, not an app.
 */

import { t } from '../i18n.js';
import { el, clear, card, button, callout, empty, toast, openSheet, field, confirmSheet } from '../ui.js';

/** Facilities that exist nationally; no phone numbers asserted. */
const FACILITIES = [
  {
    icon: '🏥',
    name: 'Sentru Saúde Komunidade (CSC)',
    note: 'Iha kada munisípiu no postu administrativu. Servisu gratis. Husu ba apoiu para fuma.',
  },
  {
    icon: '🏨',
    name: 'Ospitál Nasionál Guido Valadares (Dili)',
    note: 'Ba kazu ne\'ebé presiza tratamentu espesializadu.',
  },
  {
    icon: '🏩',
    name: 'Ospitál Referénsia munisípiu nian',
    note: 'Baucau, Maliana, Maubisse, Oecusse, Suai.',
  },
  {
    icon: '🩺',
    name: 'Postu Saúde no ajente saúde iha suku',
    note: 'Bele fó konsellu no hatudu dalan ba servisu boot liu.',
  },
];

export default function renderServices(ctx) {
  const root = el('div', { class: 'screen' });

  root.appendChild(el('header', { class: 'topbar' },
    button('‹', { variant: 'btn--ghost btn--sm', 'aria-label': t('back'), onClick: () => ctx.navigate('/ferramenta') }),
    el('div', { class: 'topbar__title' }, el('h1', {}, t('svc.title'))),
  ));

  root.appendChild(callout(t('svc.body'), 'callout--brand'));

  /* ---- emergency ---- */
  root.appendChild(card({},
    el('div', { class: 'row', style: { marginBottom: '6px' } },
      el('div', { style: { fontSize: '1.5rem' }, 'aria-hidden': 'true' }, '🚨'),
      el('h3', { style: { flex: '1' } }, t('svc.emergency')),
    ),
    el('p', { class: 'small' }, t('svc.emergency.body')),
  ));

  /* ---- facilities ---- */
  const list = el('div', { class: 'card card--flush' });
  for (const f of FACILITIES) {
    list.appendChild(el('div', { class: 'list__row', style: 'cursor:default' },
      el('span', { class: 'list__ico', 'aria-hidden': 'true' }, f.icon),
      el('span', { class: 'list__txt' },
        el('span', { class: 'list__ttl' }, f.name),
        el('span', { class: 'list__sub' }, f.note),
      ),
    ));
  }
  root.appendChild(list);

  /* ---- user-held numbers ---- */
  const numbersHost = el('div', {});
  root.appendChild(numbersHost);

  const paintNumbers = () => {
    clear(numbersHost);
    const saved = ctx.store.get().plan.supports.filter((p) => p.service);

    const inner = el('div', { class: 'stack' });
    if (!saved.length) {
      inner.appendChild(empty('📞', t('svc.note')));
    } else {
      for (const [i, entry] of saved.entries()) {
        inner.appendChild(el('div', { class: 'row' },
          el('a', {
            class: 'btn btn--soft btn--sm',
            href: `tel:${String(entry.phone).replace(/[^\d+]/g, '')}`,
          }, '📞', ` ${t('plan.call')}`),
          el('span', { style: { flex: '1', minWidth: '0' } },
            el('div', { style: { fontWeight: '700' } }, entry.name),
            el('div', { class: 'tiny muted' }, entry.phone),
          ),
          button('✕', {
            variant: 'btn--quiet btn--sm',
            'aria-label': t('delete'),
            onClick: async () => {
              const yes = await confirmSheet(t('delete'), entry.name, { danger: true });
              if (!yes) return;
              ctx.store.update((s) => {
                const idx = s.plan.supports.findIndex((p) => p.service && p.name === entry.name && p.phone === entry.phone);
                if (idx >= 0) s.plan.supports.splice(idx, 1);
              }, 'plan');
              paintNumbers();
            },
          }),
        ));
      }
    }

    numbersHost.appendChild(card({},
      el('div', { class: 'card__label' }, t('svc.numbers')),
      inner,
      button(t('svc.add'), {
        variant: 'btn--soft btn--block',
        icon: '➕',
        onClick: () => openSheet(t('svc.add'), (close) => {
          const name = el('input', { type: 'text', maxlength: '48' });
          const phone = el('input', { type: 'tel', maxlength: '24', inputmode: 'tel' });
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
                ctx.store.update((s) => {
                  s.plan.supports.push({ name: n.slice(0, 48), phone: p.slice(0, 24), service: true });
                }, 'plan');
                close();
                paintNumbers();
              },
            }),
          );
        }),
      }),
      el('p', { class: 'tiny muted', style: { marginTop: '8px' } }, t('svc.note')),
    ));
  };

  paintNumbers();

  root.appendChild(button(t('tools.test'), {
    variant: 'btn--soft btn--block',
    icon: '📋',
    onClick: () => ctx.navigate('/teste'),
  }));

  return root;
}
