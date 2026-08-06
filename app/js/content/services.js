/**
 * SERVISU SAÚDE — the real-world facilities the app refers people to.
 *
 * This is the handbook's service-referral category, and it is the highest-stakes
 * text in the app: someone reads it when they have decided to ask for help in
 * person. A wrong facility name or a wrong description sends a person somewhere
 * that cannot help them, at the moment they were willing to go.
 *
 * NO PHONE NUMBERS ARE ASSERTED HERE. A wrong quitline number is worse than
 * none — someone in crisis calls it, gets nothing, and loses trust. Numbers are
 * a list the person or a deploying health service fills in locally
 * (see js/views/services.js).
 *
 * PURE DATA — no DOM. Lives in content/ rather than inside the view so the
 * translation review reaches it; it used to be inline in js/views/services.js,
 * where the review would have missed it entirely.
 *
 * TRANSLATION REVIEW PENDING — and this file first. See
 * docs/translation-review.md.
 */

export const FACILITIES = [
  {
    id: 'csc',
    icon: '🏥',
    name: 'Sentru Saúde Komunidade (CSC)',
    note: 'Iha kada munisípiu no postu administrativu. Servisu gratis. Husu ba apoiu para fuma.',
  },
  {
    id: 'hnbv',
    icon: '🏨',
    name: 'Ospitál Nasionál Guido Valadares (Dili)',
    note: 'Ba kazu ne\'ebé presiza tratamentu espesializadu.',
  },
  {
    id: 'referral',
    icon: '🏩',
    name: 'Ospitál Referénsia munisípiu nian',
    note: 'Baucau, Maliana, Maubisse, Oecusse, Suai.',
  },
  {
    id: 'postu',
    icon: '🩺',
    name: 'Postu Saúde no ajente saúde iha suku',
    note: 'Bele fó konsellu no hatudu dalan ba servisu boot liu.',
  },
];
