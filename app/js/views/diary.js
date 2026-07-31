/**
 * DIÁRIU — craving diary.
 *
 * The point is not record-keeping for its own sake: logging strength + trigger
 * turns "cravings hit me randomly" into "cravings hit me after lunch and with
 * coffee", which is something a person can actually plan around. So the summary
 * (top triggers, win rate) is shown above the raw log.
 */

import { t } from '../i18n.js';
import { TRIGGERS } from '../content/coping.js';
import { el, clear, card, button, chip, empty, toast, openSheet, bar } from '../ui.js';
import { ago } from '../format.js';

const STRENGTHS = [
  { v: 1, key: 'diary.strength.1', icon: '🙂' },
  { v: 2, key: 'diary.strength.2', icon: '😕' },
  { v: 3, key: 'diary.strength.3', icon: '😣' },
  { v: 4, key: 'diary.strength.4', icon: '😫' },
];

export default function renderDiary(ctx) {
  const root = el('div', { class: 'screen' });

  root.appendChild(el('header', { class: 'topbar' },
    button('‹', { variant: 'btn--ghost btn--sm', 'aria-label': t('back'), onClick: () => ctx.navigate('/ferramenta') }),
    el('div', { class: 'topbar__title' }, el('h1', {}, t('diary.title'))),
  ));

  const body = el('div', {});
  root.appendChild(body);

  const paint = () => {
    clear(body);
    const s = ctx.store.get();
    const snap = ctx.snapshot();

    body.appendChild(button(t('diary.add'), {
      variant: 'btn--lg btn--block',
      icon: '➕',
      onClick: () => openEntrySheet(ctx, paint),
    }));

    if (!s.diary.length) {
      body.appendChild(card({}, empty('📔', t('diary.empty'))));
      return;
    }

    /* ---- summary ---- */
    body.appendChild(card({},
      el('div', { class: 'card__label' }, t('diary.count', { n: s.diary.length })),
      el('h3', {}, t('diary.winrate', { n: snap.winRate })),
      el('div', { style: { marginTop: '10px' } }, bar(snap.winRate / 100)),
    ));

    const top = ctx.tracking.topTriggers
      ? ctx.tracking.topTriggers(s.diary)
      : [];
    if (top.length) {
      const list = el('div', { class: 'stack' });
      const max = top[0].n || 1;
      for (const row of top) {
        const def = TRIGGERS.find((x) => x.id === row.id);
        list.appendChild(el('div', {},
          el('div', { class: 'row' },
            el('span', { 'aria-hidden': 'true' }, def ? def.icon : '❓'),
            el('span', { style: { flex: '1' } }, def ? def.label : row.id),
            el('span', { class: 'small muted' }, String(row.n)),
          ),
          bar(row.n / max, { accent: true }),
        ));
      }
      body.appendChild(card({},
        el('div', { class: 'card__label' }, t('diary.pattern')),
        list,
        button(t('tools.triggers'), {
          variant: 'btn--quiet',
          style: 'padding-left:0',
          onClick: () => ctx.navigate('/gatilhu'),
        }),
      ));
    }

    /* ---- log ---- */
    const log = el('div', { class: 'card card--flush' });
    for (const entry of s.diary.slice(0, 40)) {
      const def = TRIGGERS.find((x) => x.id === entry.trigger);
      const strength = STRENGTHS.find((x) => x.v === entry.strength);
      log.appendChild(el('div', { class: 'list__row', style: 'cursor:default' },
        el('span', { class: 'list__ico', 'aria-hidden': 'true' }, strength ? strength.icon : '•'),
        el('span', { class: 'list__txt' },
          el('span', { class: 'list__ttl' }, def ? def.label : t('diary.add')),
          el('span', { class: 'list__sub' },
            `${ago(entry.at)}${entry.note ? ` · ${entry.note}` : ''}`),
        ),
        el('span', { class: entry.smoked ? 'badge badge--danger' : 'badge' },
          entry.smoked ? t('diary.smoked') : t('diary.resisted')),
      ));
    }
    body.appendChild(el('div', {},
      el('div', { class: 'card__label', style: { marginTop: '4px' } }, t('diary.recent')),
      log,
    ));
  };

  paint();
  return root;
}

/* ------------------------------------------------------------------ */

function openEntrySheet(ctx, done) {
  openSheet(t('diary.add'), (close) => {
    const draft = { strength: 3, trigger: null, smoked: false, note: '' };

    const strengthRow = el('div', { class: 'pillrow' });
    const paintStrength = () => {
      clear(strengthRow);
      for (const s of STRENGTHS) {
        strengthRow.appendChild(chip(`${s.icon} ${t(s.key)}`, {
          pressed: draft.strength === s.v,
          onClick: () => {
            draft.strength = s.v;
            paintStrength();
          },
        }));
      }
    };
    paintStrength();

    const triggerRow = el('div', { class: 'pillrow' });
    const paintTriggers = () => {
      clear(triggerRow);
      for (const trig of TRIGGERS) {
        triggerRow.appendChild(chip(`${trig.icon} ${trig.label}`, {
          pressed: draft.trigger === trig.id,
          onClick: () => {
            draft.trigger = draft.trigger === trig.id ? null : trig.id;
            paintTriggers();
          },
        }));
      }
    };
    paintTriggers();

    const resultRow = el('div', { class: 'pillrow' });
    const paintResult = () => {
      clear(resultRow);
      resultRow.appendChild(chip(`✅ ${t('diary.resisted')}`, {
        pressed: !draft.smoked,
        onClick: () => {
          draft.smoked = false;
          paintResult();
        },
      }));
      resultRow.appendChild(chip(`🚬 ${t('diary.smoked')}`, {
        pressed: draft.smoked,
        onClick: () => {
          draft.smoked = true;
          paintResult();
        },
      }));
    };
    paintResult();

    const note = el('textarea', { rows: '2', placeholder: t('diary.note'), maxlength: '200' });

    return el('div', { class: 'stack' },
      el('div', {}, el('div', { class: 'card__label' }, t('diary.strength')), strengthRow),
      el('div', {}, el('div', { class: 'card__label' }, t('diary.trigger')), triggerRow),
      el('div', {}, el('div', { class: 'card__label' }, t('diary.result')), resultRow),
      el('div', {}, el('div', { class: 'card__label' }, t('diary.note')), note),
      button(t('save'), {
        variant: 'btn--lg btn--block',
        onClick: () => {
          ctx.tracking.addDiary({
            strength: draft.strength,
            trigger: draft.trigger,
            action: 'manual',
            smoked: draft.smoked,
            note: note.value.trim().slice(0, 200),
          });
          // Resisting a logged craving counts towards the same total the SOS
          // flow feeds, so the numbers agree wherever the person logged it.
          if (!draft.smoked) ctx.tracking.recordCravingWin();
          close();
          toast(t('diary.saved'), 'ok');
          ctx.celebrate();
          done();
        },
      }),
    );
  });
}
