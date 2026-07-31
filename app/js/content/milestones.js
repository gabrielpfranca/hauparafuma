/**
 * BENEFÍSIU SAÚDE tuir tempu la fuma.
 *
 * Timeline follows the WHO "Tobacco: health benefits of smoking cessation"
 * fact sheet and the US CDC / Surgeon General recovery timeline, which the
 * mTobaccoCessation handbook draws on for its benefit-category messages.
 *
 * `ms` is the elapsed smoke-free time at which the benefit is reached.
 * Ranges in the source (e.g. "2 to 12 weeks") are anchored at the start of the
 * range so the app never claims a benefit earlier than the evidence supports.
 *
 * PURE DATA — no DOM. Tetun text pending native review.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const YEAR = 365 * DAY;

export const MILESTONES = [
  {
    id: 'm20min',
    ms: 20 * MIN,
    when: 'Minutu 20',
    icon: '💓',
    title: 'Fuan no tensaun sangue tun',
    body: 'Minutu 20 hafoin sigarru ikus, ita nia fuan nia lalais no tensaun sangue hahú fila ba normál.',
  },
  {
    id: 'm12h',
    ms: 12 * HOUR,
    when: 'Oras 12',
    icon: '🫁',
    title: 'Monóxidu karbonu sai husi sangue',
    body: 'Gás venenu monóxidu karbonu iha ita nia sangue tun ba nivel normál. Oksijenu bele lori ba isin tomak fali.',
  },
  {
    id: 'm24h',
    ms: 24 * HOUR,
    when: 'Oras 24',
    icon: '❤️',
    title: 'Risku ataka fuan hahú tun',
    body: 'Iha loron ida deit, ita nia risku ataka fuan hahú tun ona.',
  },
  {
    id: 'm48h',
    ms: 48 * HOUR,
    when: 'Oras 48',
    icon: '👅',
    title: 'Ita sente masin no iis fali',
    body: 'Nervu iha lian-nanál no inus hahú hariku. Ai-han sei iha gostu di\'ak liu, no ita sei sente iis buat sira.',
  },
  {
    id: 'm72h',
    ms: 72 * HOUR,
    when: 'Oras 72',
    icon: '🌬️',
    title: 'Dada iis sai fasil liu',
    body: 'Dalan iis iha pulmaun hakmatek no loke. Nikotina hotu ona sai husi isin. Dada iis sai fasil liu.',
  },
  {
    id: 'm2w',
    ms: 2 * WEEK,
    when: 'Semana 2',
    icon: '🚶',
    title: 'Sirkulasaun sangue di\'ak liu',
    body: 'Sangue la\'o di\'ak liu. La\'o, sa\'e escada no servisu isin sai fasil liu.',
  },
  {
    id: 'm1m',
    ms: 30 * DAY,
    when: 'Fulan 1',
    icon: '💪',
    title: 'Pulmaun servisu di\'ak liu',
    body: 'Funsaun pulmaun sa\'e. Tose no susar dada iis hahú tun. Ita sei sente forsa foun.',
  },
  {
    id: 'm3m',
    ms: 90 * DAY,
    when: 'Fulan 3',
    icon: '🏃',
    title: 'Isin sai forte liu',
    body: 'Sirkulasaun no funsaun pulmaun di\'ak liu duni. Ezersísiu sai fasil liu no ita kolen menus.',
  },
  {
    id: 'm9m',
    ms: 270 * DAY,
    when: 'Fulan 9',
    icon: '✨',
    title: 'Tose no infesaun tun',
    body: 'Sélula ki\'ik ne\'ebé hamoos dalan iis hariku fila fali. Tose, iis-manas no infesaun pulmaun tun.',
  },
  {
    id: 'm1y',
    ms: YEAR,
    when: 'Tinan 1',
    icon: '🫀',
    title: 'Risku moras fuan tun ba metade',
    body: 'Tinan ida depois para fuma, risku moras fuan (koronária) tun ba metade, kompara ho ema ne\'ebé fuma nafatin.',
  },
  {
    id: 'm5y',
    ms: 5 * YEAR,
    when: 'Tinan 5',
    icon: '🧠',
    title: 'Risku atake serebrál tun',
    body: 'Entre tinan 5 no 15 depois para fuma, risku atake serebrál (AVC) bele tun to\'o hanesan ema ne\'ebé nunka fuma.',
  },
  {
    id: 'm10y',
    ms: 10 * YEAR,
    when: 'Tinan 10',
    icon: '🎗️',
    title: 'Risku kanser pulmaun tun ba metade',
    body: 'Tinan 10 depois para fuma, risku mate tanba kanser pulmaun tun ba metade, kompara ho ema ne\'ebé fuma nafatin.',
  },
  {
    id: 'm15y',
    ms: 15 * YEAR,
    when: 'Tinan 15',
    icon: '🏆',
    title: 'Risku moras fuan hanesan ema la fuma',
    body: 'Tinan 15 depois para fuma, risku moras fuan koronária sai hanesan ema ne\'ebé nunka fuma.',
  },
];

/** Milestones already reached, in order. */
export function reached(smokeFreeMs) {
  return MILESTONES.filter((m) => smokeFreeMs >= m.ms);
}

/** The next milestone not yet reached, or null once all are done. */
export function next(smokeFreeMs) {
  return MILESTONES.find((m) => smokeFreeMs < m.ms) || null;
}

/** 0..1 progress towards the next milestone, measured from the previous one. */
export function progressToNext(smokeFreeMs) {
  const target = next(smokeFreeMs);
  if (!target) return 1;
  const idx = MILESTONES.indexOf(target);
  const from = idx > 0 ? MILESTONES[idx - 1].ms : 0;
  const span = target.ms - from;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (smokeFreeMs - from) / span));
}

/**
 * Minutes of life expectancy regained, at ~11 minutes per cigarette not smoked.
 * Commonly cited from Shaw, Mitchell & Dorling (BMJ 2000). It is an average
 * across a population, not a promise to one person — the UI presents it as an
 * estimate, never as a guarantee.
 */
export const MINUTES_PER_CIG = 11;
