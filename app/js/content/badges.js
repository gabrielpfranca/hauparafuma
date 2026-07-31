/**
 * KONKISTA — achievement badges.
 *
 * Two families:
 *  - time badges, unlocked by smoke-free duration
 *  - action badges, unlocked by using the tools (cravings beaten, diary
 *    entries, community posts), so that someone having a hard week can still
 *    earn something for the effort rather than only for the outcome
 *
 * Each badge carries `share`, the pre-filled Tetun text offered when the
 * person taps "Fahe ba komunidade" — lowering the effort of posting is what
 * actually makes a community feed active.
 *
 * PURE DATA. Tetun text pending native review.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const BADGES = [
  /* ---- time ---- */
  { id: 'b_1d',   kind: 'time', ms: 1 * DAY,     icon: '🌱', title: 'Loron ida',
    desc: 'Loron ida tomak la fuma.',            share: 'Ha\'u kompleta ona loron ida la fuma! 🌱' },
  { id: 'b_3d',   kind: 'time', ms: 3 * DAY,     icon: '🌿', title: 'Loron tolu',
    desc: 'Nikotina sai hotu husi isin.',        share: 'Loron tolu la fuma! Nikotina sai hotu ona husi ha\'u nia isin. 🌿' },
  { id: 'b_1w',   kind: 'time', ms: 7 * DAY,     icon: '⭐', title: 'Semana ida',
    desc: 'Semana ida tomak la fuma.',           share: 'Semana ida la fuma! ⭐ Ha\'u sente diferente ona.' },
  { id: 'b_2w',   kind: 'time', ms: 14 * DAY,    icon: '🌟', title: 'Semana rua',
    desc: 'Sirkulasaun hahú di\'ak liu.',        share: 'Semana rua la fuma! 🌟' },
  { id: 'b_1m',   kind: 'time', ms: 30 * DAY,    icon: '🏅', title: 'Fulan ida',
    desc: 'Fulan ida tomak la fuma.',            share: 'Fulan ida la fuma! 🏅 Ha\'u la fiar maibé ha\'u halo duni.' },
  { id: 'b_3m',   kind: 'time', ms: 90 * DAY,    icon: '🥉', title: 'Fulan tolu',
    desc: 'Pulmaun servisu di\'ak liu.',         share: 'Fulan tolu la fuma! 🥉' },
  { id: 'b_6m',   kind: 'time', ms: 180 * DAY,   icon: '🥈', title: 'Fulan neen',
    desc: 'Programa fulan 6 hotu ona.',          share: 'Fulan neen la fuma — programa hotu ona! 🥈' },
  { id: 'b_1y',   kind: 'time', ms: 365 * DAY,   icon: '🥇', title: 'Tinan ida',
    desc: 'Risku moras fuan tun ba metade.',     share: 'TINAN IDA la fuma! 🥇' },
  { id: 'b_2y',   kind: 'time', ms: 730 * DAY,   icon: '🏆', title: 'Tinan rua',
    desc: 'Tinan rua la fuma.',                  share: 'Tinan rua la fuma! 🏆' },

  /* ---- action ---- */
  { id: 'b_crave1',  kind: 'craving', n: 1,   icon: '💪', title: 'Vitória dahuluk',
    desc: 'Ita manán hakarak fuma dala ida.',   share: 'Ha\'u manán hakarak fuma ha\'u nian dahuluk! 💪' },
  { id: 'b_crave10', kind: 'craving', n: 10,  icon: '🛡️', title: 'Vitória sanulu',
    desc: 'Ita manán hakarak fuma dala 10.',    share: 'Ha\'u manán ona hakarak fuma dala 10! 🛡️' },
  { id: 'b_crave50', kind: 'craving', n: 50,  icon: '⚔️', title: 'Vitória 50',
    desc: 'Ita manán hakarak fuma dala 50.',    share: 'Dala 50 ha\'u hakarak fuma, no dala 50 ha\'u la fuma! ⚔️' },
  { id: 'b_diary5',  kind: 'diary',  n: 5,   icon: '📔', title: 'Ita hatene an',
    desc: 'Rejistu 5 iha diáriu.',              share: 'Ha\'u hahú hatene ha\'u nia gatilhu sira. 📔' },
  { id: 'b_game5',   kind: 'game',   n: 5,   icon: '🎮', title: 'Distrasaun mestre',
    desc: 'Halimar jogu dala 5.',               share: 'Jogu iha aplikasaun ne\'e tulun ha\'u duni! 🎮' },
  { id: 'b_post1',   kind: 'post',   n: 1,   icon: '🤝', title: 'Ita fahe',
    desc: 'Haruka mensajen dahuluk ba komunidade.', share: 'Ha\'u fahe ona ha\'u nia istória iha komunidade. 🤝' },
  { id: 'b_plan',    kind: 'plan',   n: 1,   icon: '🗺️', title: 'Preparadu',
    desc: 'Hakerek planu emerjénsia.',          share: 'Ha\'u iha ona planu ba momentu susar. 🗺️' },
];

/**
 * Which badges are earned given the current progress.
 * Pure: takes a plain snapshot so it can be unit-tested without a store.
 */
export function earned({ smokeFreeMs = 0, cravingsBeaten = 0, diaryCount = 0, gamesPlayed = 0, postCount = 0, hasPlan = false } = {}) {
  return BADGES.filter((b) => {
    switch (b.kind) {
      case 'time':    return smokeFreeMs >= b.ms;
      case 'craving': return cravingsBeaten >= b.n;
      case 'diary':   return diaryCount >= b.n;
      case 'game':    return gamesPlayed >= b.n;
      case 'post':    return postCount >= b.n;
      case 'plan':    return hasPlan;
      default:        return false;
    }
  });
}

export function byId(id) {
  return BADGES.find((b) => b.id === id) || null;
}
