/**
 * BIBLIOTEKA MENSAJEN — Tetun Dili.
 *
 * Structured after the WHO/ITU "Be He@lthy, Be Mobile — mTobaccoCessation"
 * handbook: a 6-month (180-day) two-way programme anchored on a chosen quit
 * date, with message frequency tapering from twice-daily around quit day to
 * weekly in the maintenance phase, drawing on the handbook's message
 * categories (motivation, information, coping skills, benefits, relapse
 * prevention, reminders, assessment, social support, reward, service referral).
 *
 * See docs/who-alignment.md for the requirement-by-requirement mapping and for
 * what could NOT be taken from the source document.
 *
 * SWAPPABLE: this file is data only. The engine (js/programme.js) never assumes
 * particular text, so the library can be replaced with the handbook's own
 * message set — or a Ministry of Health approved set — without touching logic.
 *
 * TRANSLATION REVIEW PENDING — see docs/translation-review.md.
 *
 * Message shape:
 *   { day, slot, type, text, action?, quick? }
 *     day    programme day; negative = before quit day, 0 = quit day
 *     slot   0 = dader (morning), 1 = lokraik (afternoon/evening), 2..3 = quit day extras
 *     type   handbook category, see TYPES
 *     action deep-link to a tool: game|breathe|diary|money|health|community|plan|why|badges|triggers|test
 *     quick  quick-reply chips offered under the message
 */

export const TYPES = [
  'motivation', 'info', 'coping', 'benefit', 'relapse',
  'reminder', 'assess', 'social', 'reward', 'service',
];

/**
 * Frequency plan. `everyDays: 1` with two slots = twice daily.
 * Matches the handbook's tapering-intensity recommendation.
 */
export const SCHEDULE = [
  { id: 'prequit',  fromDay: -7,  toDay: -1,  everyDays: 1, slots: [0, 1] },
  { id: 'quitday',  fromDay: 0,   toDay: 0,   everyDays: 1, slots: [0, 1, 2, 3] },
  { id: 'week1_2',  fromDay: 1,   toDay: 14,  everyDays: 1, slots: [0, 1] },
  { id: 'week3_4',  fromDay: 15,  toDay: 28,  everyDays: 1, slots: [0] },
  { id: 'week5_8',  fromDay: 29,  toDay: 56,  everyDays: 2, slots: [0] },
  { id: 'week9_12', fromDay: 57,  toDay: 84,  everyDays: 3, slots: [0] },
  { id: 'month4_6', fromDay: 85,  toDay: 180, everyDays: 7, slots: [0] },
];

/** Days on which the programme asks about quit status (handbook follow-ups). */
export const ASSESS_DAYS = [7, 14, 30, 90, 180];

/* ==================================================================
   FAZE PREPARA — loron -7 to'o -1 (dala rua iha loron ida)
   ================================================================== */

const PREQUIT = [
  {
    day: -7, slot: 0, type: 'info',
    text: 'Bemvindu! Sei falta loron 7 ba ita nia loron para fuma. Iha loron sira ne\'e ami sei tulun ita prepara. Pasu dahuluk: hakerek loron ne\'e iha kalendáriu, no fó hatene ba ita nia familia.',
  },
  {
    day: -7, slot: 1, type: 'motivation',
    text: 'Ema ne\'ebé hili loron ida no prepara uluk, sira nia susesu boot liu duke ema ne\'ebé para deit. Ita halo ona pasu dahuluk. Hanoin: tanbasá ita hakarak para?',
    action: 'why',
  },
  {
    day: -6, slot: 0, type: 'info',
    text: 'Sigarru ida iha substánsia kímika liu 7.000. Husi sira, 70 mak bele halo kanser. Nikotina mak halo ita la bele husik — maibé nikotina sai hotu husi isin iha loron 3 deit.',
  },
  {
    day: -6, slot: 1, type: 'coping',
    text: 'Ohin halo lista ida: bainhira mak ita fuma? Hafoin han? Ho kafé? Ho belun sira? Bainhira laran manas? Hatene ita nia gatilhu, ita bele prepara resposta ba sira.',
    action: 'triggers',
  },
  {
    day: -5, slot: 0, type: 'motivation',
    text: 'Ita hatene ita gasta osan hira ba sigarru iha tinan ida? Loke kalkuladora osan no haree. Osan ne\'e bele sai ba ai-han, ba oan sira nia eskola, ka ba planu boot ida.',
    action: 'money',
  },
  {
    day: -5, slot: 1, type: 'social',
    text: 'Fó hatene ba ema nain 3 katak ita sei para fuma. Ema ne\'ebé iha apoiu husi familia no belun, sira manán barak liu. Sé mak ita bele husu ohin?',
    action: 'plan',
  },
  {
    day: -4, slot: 0, type: 'coping',
    text: 'Prepara ita nia uma: soe sigarru, isqueiru no sinzeiru hotu. Fase roupa ne\'ebé iha masin sigarru. Uma ne\'ebé la iha sigarru, hakarak fuma mós ki\'ik liu.',
  },
  {
    day: -4, slot: 1, type: 'info',
    text: 'Hakarak fuma la kleur. Baibain minutu 3 to\'o 5 deit, depois tun. Ne\'e mak sekretu boot: la presiza luta ba oras tomak — presiza hein minutu balun deit.',
    action: 'breathe',
  },
  {
    day: -3, slot: 0, type: 'coping',
    text: 'Prepara buat atu troka sigarru: bee, ai-fuan, xiklete, kacang, ka kafé la iha asukar. Ibun no liman presiza buat atu halo. Sosa sira ne\'e ohin, antes loron para.',
  },
  {
    day: -3, slot: 1, type: 'benefit',
    text: 'Ita nia isin hein hela. Minutu 20 hafoin sigarru ikus, ita nia fuan no tensaun sangue hahú tun. Iha loron 3, ita sei dada iis di\'ak liu.',
    action: 'health',
  },
  {
    day: -2, slot: 0, type: 'reminder',
    text: 'Sei falta loron 2. Ohin hakerek ita nia Planu Emerjénsia: ita nia motivu, buat atu halo bainhira hakarak fuma mai, no ema atu bolu. Planu ne\'e sei tulun ita iha loron susar.',
    action: 'plan',
  },
  {
    day: -2, slot: 1, type: 'coping',
    text: 'Hanoin uluk: iha loron dahuluk sira, ita bele sente laran manas, kolen, ka la bele toba. Ida ne\'e normál — isin buka nikotina. Sintoma sira ne\'e sei liu iha semana 2 to\'o 4.',
  },
  {
    day: -1, slot: 0, type: 'reminder',
    text: 'Aban mak ita nia loron! Ohin kalan: soe sigarru hotu ne\'ebé sei iha, taka sinzeiru, no toba di\'ak. Ita preparadu ona.',
  },
  {
    day: -1, slot: 1, type: 'motivation',
    text: 'Ohin kalan mak kalan ikus nu\'udar ema fuma. Aban ita hahú dalan foun. Ami sei akompaña ita loron-loron, la husik ita mesak.',
  },
];

/* ==================================================================
   LORON PARA FUMA — loron 0 (mensajen 4)
   ================================================================== */

const QUITDAY = [
  {
    day: 0, slot: 0, type: 'motivation',
    text: 'OHIN LORON MAK LORON ITA NIAN! Husi oras ne\'e, ita la fuma ona. Se hakarak fuma mai, hemu bee, dada iis klean, no kaer botaun mean "Hakarak fuma!" iha aplikasaun ne\'e.',
    quick: ['crave', 'good'],
  },
  {
    day: 0, slot: 1, type: 'coping',
    text: 'Hakarak fuma mai ona? Halo ida ne\'e: dada iis klean dala 5, hemu bee kopu ida, no la\'o minutu 3. Hakarak ne\'e sei liu, hanesan udan ne\'ebé mai no bá.',
    action: 'breathe',
  },
  {
    day: 0, slot: 2, type: 'info',
    text: 'Oras ne\'e ita nia isin hahú hamoos monóxidu karbonu. Iha oras 12, oksijenu iha sangue fila ba normál. Isin hahú servisu ba ita ona.',
    action: 'health',
  },
  {
    day: 0, slot: 3, type: 'reward',
    text: 'Ita halo ona loron ida la fuma! Haree osan ne\'ebé ita salva no benefísiu dahuluk ne\'ebé ita hetan. Loron ida deit, maibé ida ne\'e mak hahú buat hotu.',
    action: 'money',
  },
];

/* ==================================================================
   SEMANA 1–2 — loron 1 to'o 14 (dala rua iha loron ida)
   ================================================================== */

const WEEK_1_2 = [
  {
    day: 1, slot: 0, type: 'benefit',
    text: 'Bondia! Ita hetan ona loron ida la fuma. Iha oras 24, risku ataka fuan hahú tun ona. Ida ne\'e la\'ós buat ki\'ik.',
  },
  {
    day: 1, slot: 1, type: 'coping',
    text: 'Hakarak fuma barak ohin? Rejistu iha Diáriu. Iha loron balun ita sei haree katak hakarak mai iha oras hanesan — no ita bele prepara antes.',
    action: 'diary',
  },
  {
    day: 2, slot: 0, type: 'info',
    text: 'Loron 2. Nikotina sai hotu ona husi ita nia isin. Ne\'e la signifika hakarak fuma hotu kedas — maibé isin la presiza ona. Buat ne\'ebé sei iha mak habitu.',
  },
  {
    day: 2, slot: 1, type: 'coping',
    text: 'Se ita sente laran manas ka la bele toba, ne\'e sinál di\'ak: isin muda hela. Koko dada iis, la\'o uitoan, ka halimar jogu minutu 3 iha aplikasaun.',
    action: 'game',
  },
  {
    day: 3, slot: 0, type: 'benefit',
    text: 'LORON 3! Ita nia pulmaun hahú loke, dada iis sai fasil liu. Ema barak dehan loron 3 mak susar liu — no ita to\'o ona iha ne\'e.',
    action: 'health',
  },
  {
    day: 3, slot: 1, type: 'social',
    text: 'Fahe ita nia konkista ba komunidade. Ema seluk presiza rona katak bele duni. Liafuan ida husi ita bele sai forsa ba ema seluk.',
    action: 'community',
  },
  {
    day: 4, slot: 0, type: 'benefit',
    text: 'Loron 4. Sintoma abstinénsia hahú tun. Ita nia inus no lian-nanál hariku ona — ai-han sei iha gostu di\'ak liu, no ita sei sente masin buat sira.',
  },
  {
    day: 4, slot: 1, type: 'coping',
    text: 'Kafé, tuak, no belun ne\'ebé fuma — sira mak gatilhu boot liu. Ohin, se bele, evita fatin sira ne\'e. Semana oin mai ita bele fila ba, ho planu iha liman.',
    action: 'triggers',
  },
  {
    day: 5, slot: 0, type: 'reward',
    text: 'Loron 5. Haree ita nia osan. Osan ne\'ebé ita salva ona bele sosa buat ruma ba ita ka ba oan sira. Hili meta ida agora.',
    action: 'money',
  },
  {
    day: 5, slot: 1, type: 'motivation',
    text: 'Se ohin susar, lee fali motivu ne\'ebé ita hakerek iha loron dahuluk. Motivu sira ne\'e mak ita nia forsa loloos.',
    action: 'why',
  },
  {
    day: 6, slot: 0, type: 'motivation',
    text: 'Loron 6. Ita besik semana ida ona. Ida ne\'e la akontese ho sorte — ita halo ho ita nia desizaun no forsa rasik.',
  },
  {
    day: 6, slot: 1, type: 'relapse',
    text: 'Hakarak fuma baibain mai ho hanoin ida: "sigarru ida deit la iha problema". Maibé sigarru ida bele lori ita fila fali ba fuma loron-loron. Sigarru ida mak la iha.',
  },
  {
    day: 7, slot: 0, type: 'reward',
    text: 'SEMANA IDA! Ita la fuma durante loron 7 tomak. Ita hetan medalla foun — haree iha ita nia konkista.',
    action: 'badges',
  },
  {
    day: 7, slot: 1, type: 'assess',
    text: 'Pergunta ida kona-ba semana ne\'e: iha loron 7 ikus, ita fuma sigarru ida ka liu?',
    quick: ['clean', 'smoked'],
  },
  {
    day: 8, slot: 0, type: 'benefit',
    text: 'Semana rua nian hahú. Iha semana ne\'e, sirkulasaun sangue hahú di\'ak liu. La\'o, sa\'e escada, no servisu sei sai fasil liu.',
  },
  {
    day: 8, slot: 1, type: 'reward',
    text: 'Osan ne\'ebé ita salva sei sa\'e loron-loron. Hili meta ida: saida mak ita hakarak sosa ho osan ne\'e?',
    action: 'money',
  },
  {
    day: 9, slot: 0, type: 'coping',
    text: 'Se ita sente hamlaha barak, ida ne\'e normál. Han ai-fuan no modo, hemu bee barak. Evita ai-han gordu no doce hodi la sa\'e todan lalais.',
  },
  {
    day: 9, slot: 1, type: 'social',
    text: 'Hanoin ba oan sira no ema iha uma. Uluk sira dada mós masin sigarru. Oras ne\'e sira dada iis moos. Ita la para ba ita mesak deit.',
  },
  {
    day: 10, slot: 0, type: 'info',
    text: 'Loron 10. Tose bele sa\'e uitoan iha tempu ne\'e. Labele hakfodak: pulmaun hamoos an, hasai sasán aat. Ida ne\'e sinál di\'ak, no sei liu.',
    action: 'withdrawal',
  },
  {
    day: 10, slot: 1, type: 'coping',
    text: 'Bainhira hakarak fuma mai, halimar minutu 3 deit. Hanoin sei bá fatin seluk no hakarak sei tun. Koko oras ne\'e.',
    action: 'game',
  },
  {
    day: 11, slot: 0, type: 'motivation',
    text: 'Loron 11. Ema barak dehan katak iha tempu ne\'e sira hahú sente livre — la presiza ona hanoin bainhira mak sei fuma tuir mai.',
  },
  {
    day: 11, slot: 1, type: 'social',
    text: 'Iha komunidade, ema seluk mós luta hanesan ita. Lee sira nia liafuan, no fó forsa ba ema ida. Fó tulun mak halo ita rasik forte liu.',
    action: 'community',
  },
  {
    day: 12, slot: 0, type: 'motivation',
    text: 'Loron 12. Hanoin: semana rua liu ba, ita sei fuma. Oras ne\'e ita la fuma ona. Buat ne\'e ema seluk la halo ba ita — ita mak halo.',
  },
  {
    day: 12, slot: 1, type: 'coping',
    text: 'Stress mak gatilhu numeru ida. Koko dada iis 4-4-6: dada iis segundu 4, hein segundu 4, soe iis segundu 6. Halo dala 6.',
    action: 'breathe',
  },
  {
    day: 13, slot: 0, type: 'benefit',
    text: 'Loron 13. Entre semana 2 no 12, sirkulasaun sa\'e no pulmaun servisu di\'ak liu to\'o 30%. Isin hariku, loron ba loron.',
    action: 'health',
  },
  {
    day: 13, slot: 1, type: 'relapse',
    text: 'Se ita fila fali fuma, labele husik programa ne\'e. Hakerek deit "FUMA" mai ami, no ami sei tulun ita hahú fali. Fila fali la\'ós monu.',
  },
  {
    day: 14, slot: 0, type: 'reward',
    text: 'SEMANA RUA! Ida ne\'e konkista boot. Haree hira ita salva ona no saida mak ita hetan tiha iha saúde.',
    action: 'health',
  },
  {
    day: 14, slot: 1, type: 'assess',
    text: 'Iha loron 7 ikus, ita fuma sigarru ida ka liu?',
    quick: ['clean', 'smoked'],
  },
];

/* ==================================================================
   SEMANA 3–4 — loron 15 to'o 28 (dala ida iha loron ida)
   ================================================================== */

const WEEK_3_4 = [
  { day: 15, slot: 0, type: 'info',
    text: 'Semana rua liu ona. Oras ne\'e hakarak fuma mai ki\'ik liu no la kleur. Kontinua uza ferramenta sira — sira mak halo diferensa.' },
  { day: 16, slot: 0, type: 'coping',
    text: 'Ita nia pontu forte oras ne\'e: ita hatene ona ita nia gatilhu. Loke Diáriu no haree padraun — bainhira no iha ne\'ebé mak hakarak mai.',
    action: 'diary' },
  { day: 17, slot: 0, type: 'reward',
    text: 'Haree total osan ne\'ebé ita salva ona. Bele fó ba familia, ka rai ba planu boot ida. Osan ne\'e uluk sai ahi deit.',
    action: 'money' },
  { day: 18, slot: 0, type: 'benefit',
    text: 'Ai-han iha gostu di\'ak liu ona? Ita nia lian-nanál no inus hariku ona. Koko han ai-fuan foun ida — ita sei sente diferente.' },
  { day: 19, slot: 0, type: 'coping',
    text: 'Ema balun sa\'e todan uitoan depois para fuma. La\'o minutu 30 loron-loron no han modo barak liu — ida ne\'e tulun isin no tulun mós hasoru hakarak fuma.' },
  { day: 20, slot: 0, type: 'motivation',
    text: 'Loron 20. Hanoin fila fali: tanbasá mak ita hahú? Motivu ne\'e sei di\'ak nafatin ohin.',
    action: 'why' },
  { day: 21, slot: 0, type: 'reward',
    text: 'SEMANA TOLU! Habitu foun hahú metin. Fó parabéns ba ita-nia an — ita merese.',
    action: 'badges' },
  { day: 22, slot: 0, type: 'social',
    text: 'Se belun oferese sigarru, dehan deit: "Obrigadu, ha\'u para ona." Simples. La presiza esplika barak ka husu lisensa ba sé-sé.' },
  { day: 23, slot: 0, type: 'coping',
    text: 'Tuak no serveja halo ita fraku hasoru hakarak fuma. Se ita hemu, prepara planu uluk: sé mak ho ita, no saida mak ita halo se hakarak mai.',
    action: 'triggers' },
  { day: 24, slot: 0, type: 'info',
    text: 'Toba di\'ak mak importante. Se la bele toba, evita kafé iha lokraik, halo isin kolen uitoan iha loron, no toba iha oras hanesan.' },
  { day: 25, slot: 0, type: 'social',
    text: 'Loron 25. Ita bele fó konsellu ona ba ema seluk. Fahe buat ida ne\'ebé tulun ita — iha komunidade.',
    action: 'community' },
  { day: 26, slot: 0, type: 'reward',
    text: 'Ita hatene ita la fuma ona sigarru hira? Haree númeru ne\'e iha ekrán Uma. Sigarru ida-idak ne\'e ita nia vitória.' },
  { day: 27, slot: 0, type: 'relapse',
    text: 'Hakarak fuma bele mai mesmu depois loron barak. Ida ne\'e normál, la\'ós sinál katak ita fraku. Prepara, la\'ós hakfodak.' },
  { day: 28, slot: 0, type: 'reward',
    text: 'SEMANA HAAT — besik fulan ida! Ita halo di\'ak tebes. Haree ita nia medalla sira.',
    action: 'badges' },
];

/* ==================================================================
   FAZE MANTEIN — loron 29 to'o 180
   Pool rotates deterministically by (day, slot) so nothing repeats
   back-to-back and no scheduled slot is ever empty.
   ================================================================== */

export const MAINTAIN_POOL = [
  { type: 'benefit',
    text: 'Iha fulan 1 to\'o 9 depois para fuma, tose no susar dada iis tun. Sélula iha pulmaun ne\'ebé hamoos dalan iis hariku fila fali.',
    action: 'health' },
  { type: 'reward',
    text: 'Haree ita nia osan. Loron-loron ne\'e ita salva osan ne\'ebé uluk lakon. Meta tuir mai besik ona?',
    action: 'money' },
  { type: 'relapse',
    text: 'Hanoin ba oin: iha semana oin, iha situasaun ida ne\'ebé bele susar? Festa, viajen, ka stress iha servisu? Prepara planu ohin.',
    action: 'plan' },
  { type: 'motivation',
    text: 'Ita la\'ós ema ne\'ebé "koko para fuma". Ita mak ema ne\'ebé la fuma ona. Liafuan ne\'e importante — koalia nune\'e ba ita-nia an.' },
  { type: 'social',
    text: 'Iha ema ida iha ita nia moris ne\'ebé sei fuma? Konvida nia mai uza aplikasaun ne\'e. Ita bele sai ezemplu ba nia.',
    action: 'community' },
  { type: 'coping',
    text: 'Bainhira hakarak fuma mai, halo tuir 4 D: Dada iis. Dook husi fatin. Dele buat ne\'e ho bee. Deside hein minutu 5.',
    action: 'breathe' },
  { type: 'info',
    text: 'Risku kanser pulmaun tun ba metade iha tinan 10 depois para fuma. Loron-loron ne\'ebé ita la fuma, ita hakarak moris naruk liu.',
    action: 'health' },
  { type: 'benefit',
    text: 'Ita nia isin oras ne\'e la iha masin sigarru ona. Roupa, uma no karreta moos. Ema besik ita mós hetan benefísiu.' },
  { type: 'coping',
    text: 'Se laran triste ka stress mai, ida ne\'e la\'ós motivu atu fuma. Koalia ho ema ida, la\'o, ka hakerek iha diáriu.',
    action: 'diary' },
  { type: 'reward',
    text: 'Fó prémiu ba ita-nia an ho osan ne\'ebé ita salva. La presiza boot — kafé ida, ai-han ida, ka buat ki\'ik ne\'ebé halo ita kontente.',
    action: 'money' },
  { type: 'motivation',
    text: 'Ema ne\'ebé to\'o fulan 3 la fuma, sira nia oportunidade atu kontinua boot liu duni. Ita iha dalan loos.' },
  { type: 'info',
    text: 'Tinan ida depois para fuma, risku moras fuan tun ba metade, kompara ho ema ne\'ebé fuma nafatin. Konkista ne\'e sei mai ba ita.',
    action: 'health' },
  { type: 'coping',
    text: 'Habitu foun presiza fatin. Buka buat ida atu troka tempu fuma: la\'o, halimar ho oan sira, kuda ai-horis, ka toka múzika.' },
  { type: 'social',
    text: 'Fahe ita nia progresu iha komunidade. Ema foun ne\'ebé hahú ohin presiza haree katak iha ema ne\'ebé konsege duni.',
    action: 'community' },
  { type: 'relapse',
    text: 'Se ita fuma sigarru ida, ida ne\'e la hamoos buat hotu ne\'ebé ita halo ona. Fila kedas ba planu, no kontinua. Labele husik.' },
  { type: 'benefit',
    text: 'Ita nia matan, isin-lolon no kakutak hetan oksijenu barak liu ona. Ema barak dehan sira sente forsa foun no toba di\'ak liu.' },
  { type: 'coping',
    text: 'Ai-han iha gostu di\'ak liu ona, no ida ne\'e bele halo ita han barak. Prepara ai-fuan no modo iha uma, hodi la buka ai-han doce.' },
  { type: 'motivation',
    text: 'Loron-loron ne\'ebé ita la fuma mak osan iha algibeira, iis moos iha pulmaun, no tempu tan ho ita nia familia.' },
  { type: 'info',
    text: 'Iha tinan 5 to\'o 15 depois para fuma, risku atake serebrál (AVC) bele tun to\'o hanesan ema ne\'ebé nunka fuma.',
    action: 'health' },
  { type: 'coping',
    text: 'Se ita sente hakarak fuma bainhira ita hemu kafé, koko troka: hemu tii, ka hemu kafé iha fatin seluk. Muda fatin, muda habitu.',
    action: 'triggers' },
  { type: 'reward',
    text: 'Haree ita nia medalla sira. Ida-idak reprezenta loron susar ne\'ebé ita hasoru no manán.',
    action: 'badges' },
  { type: 'social',
    text: 'Obrigadu ba ita nia esforsu. Se iha ema ne\'ebé tulun ita to\'o iha ne\'e, ohin mak loron di\'ak atu dehan obrigadu ba nia.' },
  { type: 'relapse',
    text: 'Momentu risku boot: tuak, festa, laran manas, no kolen. Bainhira ita hatene sira, ita bele prepara. Loke ita nia planu.',
    action: 'plan' },
  { type: 'info',
    text: 'Fuma la\'ós hamenus stress — nikotina rasik mak halo isin nervozu bainhira nia menus. Oras ne\'e ita livre husi siklu ne\'e.' },
  { type: 'motivation',
    text: 'Ita muda ona buat ne\'ebé ema barak hanoin katak la bele muda. Kbiit ne\'e sei tulun ita iha buat seluk mós.' },
  { type: 'coping',
    text: 'Halo isin muda: la\'o, nani, ka joga bola. Ezersísiu hamenus hakarak fuma no tulun toba di\'ak.' },
  { type: 'benefit',
    text: 'Ita nia kahur (imunidade) sai forte liu, no ita moras menus. Sinál ne\'e mosu neineik, maibé sai duni.' },
  { type: 'service',
    text: 'Se hakarak fuma sei makaas nafatin, ba koalia ho pesoál saúde iha Sentru Saúde Komunidade. Sira bele fó apoiu ka ai-moruk se presiza.',
    action: 'test' },
  { type: 'motivation',
    text: 'Ohin, hanoin buat ida ne\'ebé ita bele halo oras ne\'e maibé uluk la bele: sa\'e foho, halimar ho oan, ka la\'o dook la kolen.' },
  { type: 'relapse',
    text: 'Se ita para tiha ona no fila fali fuma, ita la lakon aprendizajen. Ema barak koko dala 5 ka liu antes sira para duni.' },
];

/* ==================================================================
   POOL ON-DEMAND — resposta ba pergunta no botaun SOS
   ================================================================== */

/** Handed out when the person says they have a craving (keyword or SOS). */
export const COPING_POOL = [
  'Hakarak ne\'e sei liu iha minutu 3 to\'o 5. Hemu bee kopu ida neineik, no konta to\'o 100. Ha\'u hein ho ita.',
  'Dada iis klean dala 5: dada iis segundu 4, hein 4, soe 6. Ita nia isin sei hakmatek.',
  'Sai husi fatin ne\'e. La\'o minutu 5 iha liur, hare ai-horis no lalehan. Fatin muda, hanoin mós muda.',
  'Halimar jogu minutu 3. Bainhira ita hotu, hakarak ne\'e sei ki\'ik liu ona.',
  'Foti bee, ai-fuan, ka xiklete. Ibun presiza buat atu halo — fó buat seluk ba nia.',
  'Lee fali ita nia motivu sira. Tanbasá ita hahú? Motivu ne\'e sei di\'ak nafatin oras ne\'e.',
  'Bolu ema ida ne\'ebé apoiu ita. Koalia minutu 2 deit, ida ne\'e bele muda buat hotu.',
  'Fase liman no oin ho bee malirin. Ka fase isin. Isin malirin, hanoin klaru.',
  'Hakerek iha diáriu: hakarak ne\'e makaas hira, no saida mak halo nia mai. Ida ne\'e tulun ita prepara ba dala oin.',
  'Hanoin: se ita fuma oras ne\'e, iha minutu 10 ita sei sente saida? Baibain ema sente lamenta. Hein uluk.',
  'Halo buat ida ho liman: fase bikan, taru roupa, kuda ai-horis. Liman okupadu, hakarak tun.',
  'Ita manán ona hakarak fuma barak antes ne\'e. Ida ne\'e mós ita bele manán. Ita hatene oinsá.',
  'Konta ba ita-nia an: "Ha\'u hakarak fuma, maibé ha\'u la presiza fuma." Hakarak la\'ós orden.',
  'Husu tulun iha komunidade. Ema seluk iha ne\'ebá hatene loloos oinsá ita sente oras ne\'e.',
  'Hemu bee manas ka tii. Kaer kopu manas ho liman rua, no hemu neineik. Ida ne\'e hakmatek isin.',
];

/** Handed out after a slip or relapse — never shaming, always re-engaging. */
export const RELAPSE_POOL = [
  'Obrigadu ba ita nia sinseridade. Fuma sigarru ida la hamoos loron hotu ne\'ebé ita halo ona. Saida mak akontese antes ita fuma?',
  'Fila fali fuma la signifika ita monu. Ema barak koko dala 5 ka liu antes sira para duni. Ita nia esperiénsia ne\'e sei tulun ita.',
  'Ida ne\'e la\'ós rohan. Ohin ita bele hahú fali. Buat ne\'ebé importante mak ita fila mai, la\'ós ita monu.',
  'Hanoin: gatilhu saida mak halo ida ne\'e mosu? Bainhira ita hatene, ita bele prepara resposta ba dala oin.',
  'Labele fó sasin kontra ita-nia an. Laran manas ba an rasik la tulun — planu foun mak tulun. Loke ita nia planu emerjénsia.',
  'Ita aprende buat foun ohin. Hakerek iha diáriu, hodi la haluha. Ida ne\'e sai ita nia forsa.',
  'Se ita fuma dala barak liu, karik di\'ak liu ba koalia ho pesoál saúde iha Sentru Saúde Komunidade. Sira bele fó apoiu tan.',
  'Ita mai fali iha ne\'e — ida ne\'e mak buat importante liu. Ami sei akompaña ita nafatin.',
];

/** Assessment prompts, keyed by programme day. */
export const ASSESS = {
  7:   'Semana ida liu ona. Iha loron 7 ikus, ita fuma sigarru ida ka liu?',
  14:  'Semana rua liu ona. Iha loron 7 ikus, ita fuma sigarru ida ka liu?',
  30:  'Fulan ida liu ona! Iha loron 30 ikus, ita fuma sigarru ida ka liu?',
  90:  'Fulan tolu liu ona. Iha loron 30 ikus, ita fuma sigarru ida ka liu?',
  180: 'Fulan neen liu ona — programa ne\'e hotu ona! Iha loron 30 ikus, ita fuma sigarru ida ka liu?',
};

/** Reply after an assessment answer. */
export const ASSESS_REPLY = {
  clean: 'Parabéns tebes! Ita hatudu ona katak bele duni. Kontinua nune\'e — ami sei akompaña ita.',
  smoked: 'Obrigadu ba ita nia sinseridade. Ida ne\'e la\'ós rohan. Ami sei tulun ita hahú fali husi ohin.',
};

/** Graduation message, delivered once after day 180. */
export const GRADUATE = {
  type: 'reward',
  text: 'Programa fulan 6 hotu ona. Ita halo buat boot ida. Aplikasaun ne\'e sei nafatin iha ne\'e ba ita — ferramenta, komunidade no konta loron sira kontinua. Parabéns!',
  action: 'badges',
};

/** Welcome message written into the thread at registration. */
export const WELCOME = {
  type: 'info',
  text: 'Bemvindu ba Hau Para Fuma! Ha\'u sei haruka mensajen mai ita durante fulan 6. Ita bele hatán mai ha\'u iha ne\'e sempre — hakerek "HAKARAK" bainhira hakarak fuma mai, ka "TULUN" se presiza tulun.',
  quick: ['crave', 'help'],
};

/* ==================================================================
   Konsulta
   ================================================================== */

/** All explicitly authored scheduled messages, indexed by "day:slot". */
export const EXPLICIT = [...PREQUIT, ...QUITDAY, ...WEEK_1_2, ...WEEK_3_4];

const BY_KEY = new Map(EXPLICIT.map((m) => [`${m.day}:${m.slot}`, m]));

export function explicitFor(day, slot) {
  return BY_KEY.get(`${day}:${slot}`) || null;
}

/** Total authored + pooled messages, for the docs/about screen. */
export function libraryStats() {
  return {
    explicit: EXPLICIT.length,
    maintain: MAINTAIN_POOL.length,
    coping: COPING_POOL.length,
    relapse: RELAPSE_POOL.length,
    assess: Object.keys(ASSESS).length,
  };
}
