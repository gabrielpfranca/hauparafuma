/**
 * TESTE — Fagerström nicotine dependence test.
 *
 * One question per screen so it is readable on a small display and does not
 * feel like a form. A high score routes to the health service rather than just
 * showing a number: the point of measuring dependence is to act on it.
 */

import { t } from '../i18n.js';
import { QUESTIONS, MAX_SCORE, levelFor, score as scoreOf } from '../content/fagerstrom.js';
import { el, clear, card, button, bar, callout } from '../ui.js';
import { date } from '../format.js';

export default function renderTest(ctx) {
  const root = el('div', { class: 'screen' });

  root.appendChild(el('header', { class: 'topbar' },
    button('‹', { variant: 'btn--ghost btn--sm', 'aria-label': t('back'), onClick: () => ctx.navigate('/ferramenta') }),
    el('div', { class: 'topbar__title' },
      el('div', { class: 'topbar__eyebrow' }, t('test.sub')),
      el('h1', {}, t('test.title')),
    ),
  ));

  const body = el('div', {});
  root.appendChild(body);

  const answers = new Array(QUESTIONS.length).fill(null);
  let index = 0;

  const paintQuestion = () => {
    clear(body);
    const q = QUESTIONS[index];

    body.appendChild(el('div', { style: { marginBottom: '14px' } },
      el('div', { class: 'topbar__eyebrow' }, t('test.q', { n: index + 1, t: QUESTIONS.length })),
      bar((index) / QUESTIONS.length),
    ));

    body.appendChild(card({},
      el('h2', { style: { marginBottom: '14px' } }, q.text),
      el('div', { class: 'stack' },
        ...q.options.map((opt, optIndex) => el('button', {
          class: `chip ${answers[index] === optIndex ? 'chip--on' : ''}`.trim(),
          type: 'button',
          style: 'width:100%;justify-content:flex-start;min-height:54px;text-align:left',
          onclick: () => {
            answers[index] = optIndex;
            if (index < QUESTIONS.length - 1) {
              index += 1;
              paintQuestion();
            } else {
              paintResult();
            }
          },
        }, opt.label)),
      ),
    ));

    if (index > 0) {
      body.appendChild(button(t('back'), {
        variant: 'btn--quiet',
        onClick: () => {
          index -= 1;
          paintQuestion();
        },
      }));
    }
  };

  const paintResult = () => {
    const total = scoreOf(answers);
    const level = levelFor(total);

    ctx.store.update((s) => {
      s.fagerstrom = { score: total, level: level.id, at: Date.now() };
    }, 'fagerstrom');

    clear(body);
    body.appendChild(card({ class: 'card--brand' },
      el('div', { class: 'card__label' }, t('test.result')),
      el('div', { style: { fontSize: '2.4rem', fontWeight: '800' } }, `${total}/${MAX_SCORE}`),
      el('div', { style: { fontWeight: '700', marginTop: '4px' } }, t(level.key)),
      el('div', { style: { marginTop: '12px' } }, bar(total / MAX_SCORE, { accent: true })),
    ));

    body.appendChild(callout(t(level.advice), level.id === 'high' || level.id === 'veryhigh' ? '' : 'callout--brand'));

    if (level.id === 'high' || level.id === 'veryhigh') {
      body.appendChild(button(t('tools.services'), {
        variant: 'btn--block',
        icon: '🏥',
        onClick: () => ctx.navigate('/servisu'),
      }));
    }

    body.appendChild(el('div', { class: 'stack', style: { marginTop: '12px' } },
      button(t('test.again'), {
        variant: 'btn--ghost btn--block',
        onClick: () => {
          answers.fill(null);
          index = 0;
          paintQuestion();
        },
      }),
      button(t('tools.triggers'), {
        variant: 'btn--soft btn--block',
        onClick: () => ctx.navigate('/gatilhu'),
      }),
    ));

    body.appendChild(el('p', { class: 'tiny muted' }, t('test.disclaimer')));
  };

  /* Show the previous result first, if there is one — repeating the test on
     every visit would be tedious and the score changes slowly. */
  const previous = ctx.store.get().fagerstrom;
  if (previous) {
    body.appendChild(card({},
      el('div', { class: 'card__label' }, `${t('test.result')} · ${date(previous.at)}`),
      el('div', { class: 'row' },
        el('div', { style: { fontSize: '1.8rem', fontWeight: '800' } }, `${previous.score}/${MAX_SCORE}`),
        el('div', { style: { flex: '1' } }, t(levelFor(previous.score).key)),
      ),
      button(t('test.again'), { variant: 'btn--soft btn--block', onClick: paintQuestion }),
    ));
    body.appendChild(el('p', { class: 'tiny muted' }, t('test.disclaimer')));
  } else {
    paintQuestion();
  }

  return root;
}
