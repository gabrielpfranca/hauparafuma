/**
 * LIAFUAN FÓ FORSA — motivational lines shown on the home screen.
 *
 * Short enough to read at a glance on a small screen. Written to affirm
 * capability rather than warn about danger: fear-based lines raise anxiety,
 * and anxiety is itself a relapse trigger.
 *
 * One quote is chosen per calendar day (deterministic, so it does not flicker
 * when the screen re-renders) — see quoteOfTheDay().
 *
 * Tetun text pending native review — docs/translation-review.md.
 */

export const QUOTES = [
  'Loron ida-idak, ita sai forte liu.',
  'Ita la mesak. Ema barak la\'o dalan hanesan ho ita.',
  'Hakarak fuma mai no bá. Ita nafatin iha ne\'e.',
  'La presiza perfeitu. Presiza deit kontinua.',
  'Isin ita nian hariku husi minutu dahuluk.',
  'Ita la\'ós ema ne\'ebé koko para. Ita mak ema ne\'ebé la fuma ona.',
  'Forsa la\'ós la sente hakarak. Forsa mak hein no la halo.',
  'Osan ne\'e uluk sai ahi. Oras ne\'e sai ita nian.',
  'Iis moos mak prezente ne\'ebé ita fó ba ita-nia an.',
  'Buat ne\'ebé susar ohin, sei fasil aban.',
  'Ita halo ona buat ne\'ebé ema barak hanoin la bele.',
  'Sigarru la resolve problema. Nia aumenta ida tan deit.',
  'Ita nia oan sira haree ita. Ita hanorin sira ho ita nia hahalok.',
  'Minutu 5 deit. Depois hakarak ne\'e sei tun.',
  'Ohin ita hili moris. Loron-loron ita hili fali.',
  'La iha loron ne\'ebé lakon, se ita hahú fali.',
  'Isin ita nian hatene oinsá hariku. Fó tempu ba nia.',
  'Kbiit ita nian boot liu duke habitu ne\'e.',
  'Ita fó hatene ba ita-nia an: ha\'u bele.',
  'Fila fali la\'ós monu. Monu mak husik.',
  'Loron ida la fuma mak vitória ida. Konta sira hotu.',
  'Ema ne\'ebé para fuma la\'ós ema forte liu. Sira mak ema ne\'ebé la husik.',
  'Ita nia pulmaun hein hela ba iis moos.',
  'Ita sei sente masin ai-han fali. Hein deit uitoan.',
  'Hakarak fuma hanesan udan boot: mai makaas, maibé la kleur.',
  'Ita muda ona istória ita nian.',
  'La presiza luta ba tinan tomak. Luta ba oras ida deit.',
  'Ita nia familia hetan ita barak liu ohin.',
  'Buat di\'ak la mai lalais, maibé nia mai.',
  'Ita bele hakarak fuma no la fuma iha tempu hanesan.',
  'Loron susar sira mak halo ita forte.',
  'Ita nia fuan servisu di\'ak liu ohin duke horiseik.',
  'Halo tuir planu, la\'ós tuir sentimentu.',
  'Ita merese moris ne\'ebé la depende ba sigarru.',
  'Ohin ita salva osan, no salva mós tempu moris.',
  'Ema seluk konsege ona. Ita mós bele.',
  'Progresu ki\'ik nafatin mak progresu.',
  'Ita nia liman livre ona ba buat seluk.',
  'Hanoin ba tanbasá ita hahú. Motivu ne\'e nafatin loos.',
  'Ita la fuma ohin. Ida ne\'e mak importante liu.',
];

/**
 * Deterministic quote for a given day, so it stays stable across re-renders
 * and only changes at local midnight.
 */
export function quoteOfTheDay(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const dayNumber = Math.floor(
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000
  );
  return QUOTES[((dayNumber % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
