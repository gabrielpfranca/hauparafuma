/**
 * MOTIVU, GATILHU, SINTOMA — the behavioural content behind the tools.
 *
 * Grounded in the coping-skills and relapse-prevention message categories of
 * the WHO/ITU mTobaccoCessation handbook, and in standard withdrawal timelines.
 * Written for Timor-Leste: the triggers named here (kafé, tuak, festa, belun)
 * are the ones people actually report, not generic examples.
 *
 * PURE DATA. Tetun text pending native review.
 */

/** Reasons offered during onboarding; drives the "Ha'u nia motivu" card. */
export const REASONS = [
  { id: 'health',   icon: '🫁', label: 'Ha\'u nia saúde' },
  { id: 'family',   icon: '👨‍👩‍👧', label: 'Ha\'u nia familia no oan sira' },
  { id: 'money',    icon: '💵', label: 'Atu salva osan' },
  { id: 'smell',    icon: '👕', label: 'Masin sigarru iha roupa no isin' },
  { id: 'breath',   icon: '🏃', label: 'Atu dada iis di\'ak no la kolen' },
  { id: 'children', icon: '🧒', label: 'Atu la fó ezemplu aat ba oan sira' },
  { id: 'pregnant', icon: '🤰', label: 'Isin-rua ka hakarak oan' },
  { id: 'doctor',   icon: '🩺', label: 'Doutór dehan ha\'u tenke para' },
  { id: 'sport',    icon: '⚽', label: 'Atu bele halimar no ezersísiu' },
  { id: 'free',     icon: '🕊️', label: 'Atu la depende ba sigarru' },
  { id: 'taste',    icon: '🍚', label: 'Atu sente masin ai-han fali' },
  { id: 'faith',    icon: '🙏', label: 'Ha\'u nia fiar no kompromisu' },
];

/** Default "do this instead" list, editable in the emergency plan. */
export const DO_INSTEAD = [
  'Hemu bee kopu ida neineik',
  'Dada iis klean dala 5',
  'La\'o minutu 5 iha liur',
  'Halimar jogu iha aplikasaun',
  'Bolu ema ida ne\'ebé apoiu ha\'u',
  'Han ai-fuan ka kacang',
  'Fase liman no oin ho bee malirin',
  'Hakerek iha diáriu',
];

/** Trigger cards — situation, why it happens, and what to do instead. */
export const TRIGGERS = [
  {
    id: 'coffee',
    icon: '☕',
    label: 'Kafé',
    why: 'Kakutak liga kafé ho sigarru tanba ita halo sira hamutuk durante tinan barak.',
    plan: [
      'Hemu kafé iha fatin seluk, la\'ós iha fatin ita baibain fuma.',
      'Kaer kopu ho liman rua, hodi liman la buka sigarru.',
      'Hafoin hemu, hamriik kedas no la\'o uitoan.',
      'Koko tii ka bee manas ba loron balun.',
    ],
  },
  {
    id: 'alcohol',
    icon: '🍺',
    label: 'Tuak no serveja',
    why: 'Álkohol hamenus ita nia kontrolu no halo ita haluha planu. Ne\'e mak gatilhu ne\'ebé perigu liu.',
    plan: [
      'Iha semana dahuluk sira, di\'ak liu la hemu álkohol.',
      'Se ita hemu, deside uluk hira deit, no hein ho ema ne\'ebé la fuma.',
      'Kaer bee ka refreskante iha liman.',
      'Se belun fuma, sai husi grupu ne\'e ba minutu balun.',
    ],
  },
  {
    id: 'friends',
    icon: '👬',
    label: 'Belun ne\'ebé fuma',
    why: 'Sigarru ne\'ebé ema oferese susar liu atu hasoru duke hakarak husi isin rasik.',
    plan: [
      'Fó hatene uluk ba sira: "Ha\'u para ona, favór ida labele oferese."',
      'Prepara liafuan kurtu: "Obrigadu, ha\'u para ona."',
      'Hamriik iha fatin ne\'ebé laiha ahi sigarru.',
      'Se susar liu, husik fatin ne\'e ba minutu 10.',
    ],
  },
  {
    id: 'stress',
    icon: '😣',
    label: 'Stress no laran manas',
    why: 'Ita uza sigarru nu\'udar dalan atu hakmatek. Maibé nikotina rasik mak halo isin nervozu bainhira nia menus.',
    plan: [
      'Dada iis 4-4-6 dala 6.',
      'Koalia ho ema ida kona-ba buat ne\'ebé halo ita laran manas.',
      'La\'o ka halo isin muda minutu 10.',
      'Hakerek problema ne\'e iha diáriu, hodi haree nia klaru liu.',
    ],
  },
  {
    id: 'aftermeal',
    icon: '🍚',
    label: 'Hafoin han',
    why: 'Hafoin han, isin hakmatek no kakutak buka premiu. Uluk premiu ne\'e sigarru.',
    plan: [
      'Hamriik kedas hafoin han, fase bikan ka la\'o uitoan.',
      'Fase nehan ka hemu bee malirin.',
      'Han ai-fuan ida hanesan sobremeza.',
      'Labele tuur kleur iha meza hafoin han.',
    ],
  },
  {
    id: 'morning',
    icon: '🌅',
    label: 'Dader bainhira hader',
    why: 'Sigarru dahuluk iha dader mak baibain susar liu atu husik, tanba isin lakon nikotina durante kalan.',
    plan: [
      'Troka orden dader: hemu bee, fase isin, dada iis, antes buat seluk.',
      'Labele hemu kafé iha oras dahuluk.',
      'Sai ba liur, hetan naroman loro-matan minutu 5.',
      'Se hakarak makaas, loke aplikasaun no halimar jogu.',
    ],
  },
  {
    id: 'driving',
    icon: '🛺',
    label: 'Iha kareta ka motor',
    why: 'Kareta sai fatin metin ba fuma, no laiha ema ne\'ebé haree.',
    plan: [
      'Hamoos kareta, hasai sinzeiru no masin sigarru.',
      'Rai bee no xiklete iha kareta.',
      'Rona múzika ka rádiu ne\'ebé ita gosta.',
      'Se dalan naruk, para uitoan no la\'o.',
    ],
  },
  {
    id: 'boredom',
    icon: '😐',
    label: 'Laiha buat atu halo',
    why: 'Bainhira ita hein ka la iha buat halo, liman no ibun buka habitu tuan.',
    plan: [
      'Prepara lista buat ki\'ik atu halo: telefone ba belun, lee, hamoos.',
      'Halimar jogu iha aplikasaun.',
      'La\'o dook uitoan.',
      'Kuda ai-horis ka hamoos uma.',
    ],
  },
];

/** Withdrawal symptoms: what happens, when, and what helps. */
export const WITHDRAWAL = [
  {
    id: 'craving',
    icon: '🚬',
    what: 'Hakarak fuma makaas',
    when: 'Hahú iha oras balun, boot liu iha loron 3, tun iha semana 2–4',
    do: 'Hein minutu 5. Hemu bee, dada iis, la\'o, ka halimar jogu. Hakarak ida-idak la kleur.',
  },
  {
    id: 'irritable',
    icon: '😤',
    what: 'Laran manas, la iha pasiénsia',
    when: 'Loron 1–14',
    do: 'Fó hatene ba ema besik katak ida ne\'e temporáriu. Dada iis, la\'o, no toba to\'o.',
  },
  {
    id: 'sleep',
    icon: '😴',
    what: 'La bele toba, ka mehi barak',
    when: 'Semana 1–3',
    do: 'Evita kafé hafoin loraik. Toba no hader iha oras hanesan. Halo isin kolen uitoan iha loron.',
  },
  {
    id: 'cough',
    icon: '😷',
    what: 'Tose sa\'e, kakorok moras',
    when: 'Loron 3 to\'o semana 3',
    do: 'Ida ne\'e pulmaun hamoos an — sinál di\'ak. Hemu bee barak no bee manas ho lima-dun.',
  },
  {
    id: 'concentrate',
    icon: '🤔',
    what: 'Susar atu konsentra',
    when: 'Semana 1–2',
    do: 'Halo servisu ki\'ik-ki\'ik. Deskansa minutu balun. Ida ne\'e sei liu.',
  },
  {
    id: 'hungry',
    icon: '🍽️',
    what: 'Hamlaha barak, todan sa\'e',
    when: 'Semana 1 to\'o fulan balun',
    do: 'Han ai-fuan no modo, hemu bee. Prepara ai-han foun iha uma. La\'o loron-loron.',
  },
  {
    id: 'sad',
    icon: '😔',
    what: 'Laran triste, laiha gostu',
    when: 'Semana 1–4',
    do: 'Koalia ho ema. Sai ba liur. Se triste kleur liu semana 2 ka boot tebes, ba haree pesoál saúde.',
  },
  {
    id: 'dizzy',
    icon: '💫',
    what: 'Ulun sakit ka ulun todan',
    when: 'Loron 1–7',
    do: 'Ita nia kakutak simu oksijenu barak liu ona. Hemu bee, han di\'ak, no deskansa.',
  },
];

/** Things to avoid, offered as starting suggestions in the plan tool. */
export const AVOID_SUGGESTIONS = [
  'Fatin ne\'ebé ha\'u baibain fuma',
  'Grupu belun ne\'ebé fuma iha semana dahuluk',
  'Tuak no serveja iha semana dahuluk',
  'Rai sigarru ka isqueiru iha uma',
];
