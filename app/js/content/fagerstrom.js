/**
 * TESTE FAGERSTRÖM (FTND) — Fagerström Test for Nicotine Dependence.
 *
 * Six items, 0–10 total. Used by the mTobaccoCessation handbook's approach of
 * tailoring support intensity to the person's dependence level: a high score
 * routes the person towards a health facility, because behavioural support
 * alone is less likely to be enough.
 *
 * This is a screening instrument, NOT a diagnosis — the UI says so.
 *
 * PURE DATA. Tetun text pending native review.
 */

export const QUESTIONS = [
  {
    id: 'q1',
    text: 'Hafoin ita hader iha dader, kleur hira mak ita fuma sigarru dahuluk?',
    options: [
      { label: 'Iha minutu 5 nia laran', points: 3 },
      { label: 'Minutu 6 to\'o 30', points: 2 },
      { label: 'Minutu 31 to\'o oras 1', points: 1 },
      { label: 'Liu oras 1', points: 0 },
    ],
  },
  {
    id: 'q2',
    text: 'Susar ba ita atu la fuma iha fatin ne\'ebé bandu fuma (hanesan iha misa, ospitál, ka transporte)?',
    options: [
      { label: 'Sin, susar', points: 1 },
      { label: 'Lae, la susar', points: 0 },
    ],
  },
  {
    id: 'q3',
    text: 'Sigarru ne\'ebé susar liu ba ita atu husik mak ida ne\'ebé?',
    options: [
      { label: 'Ida dahuluk iha dader', points: 1 },
      { label: 'Ida seluk iha loron nia laran', points: 0 },
    ],
  },
  {
    id: 'q4',
    text: 'Iha loron ida, ita fuma sigarru hira?',
    options: [
      { label: '10 ka menus', points: 0 },
      { label: '11 to\'o 20', points: 1 },
      { label: '21 to\'o 30', points: 2 },
      { label: '31 ka liu', points: 3 },
    ],
  },
  {
    id: 'q5',
    text: 'Ita fuma barak liu iha oras dahuluk hafoin hader, kompara ho tempu seluk iha loron?',
    options: [
      { label: 'Sin', points: 1 },
      { label: 'Lae', points: 0 },
    ],
  },
  {
    id: 'q6',
    text: 'Ita fuma mesmu bainhira ita moras no toba iha kama?',
    options: [
      { label: 'Sin', points: 1 },
      { label: 'Lae', points: 0 },
    ],
  },
];

export const MAX_SCORE = 10;

/**
 * Standard FTND bands. `advice` names the i18n key so the wording stays in
 * one place (js/i18n.js) rather than being duplicated here.
 */
export function levelFor(score) {
  if (score <= 2) return { id: 'verylow', key: 'test.level.verylow', advice: 'test.advice.low' };
  if (score <= 4) return { id: 'low',      key: 'test.level.low',     advice: 'test.advice.low' };
  if (score === 5) return { id: 'medium',  key: 'test.level.medium',  advice: 'test.advice.medium' };
  if (score <= 7) return { id: 'high',     key: 'test.level.high',    advice: 'test.advice.high' };
  return { id: 'veryhigh', key: 'test.level.veryhigh', advice: 'test.advice.high' };
}

/** Sum an answers array of chosen option indices (null = unanswered). */
export function score(answers) {
  return QUESTIONS.reduce((sum, q, i) => {
    const choice = answers?.[i];
    const opt = Number.isInteger(choice) ? q.options[choice] : null;
    return sum + (opt ? opt.points : 0);
  }, 0);
}
