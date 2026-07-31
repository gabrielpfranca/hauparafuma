/**
 * META OSAN — savings goals, priced for Timor-Leste in USD (the national
 * currency). Deliberately concrete and local: an abstract "$120 saved" means
 * much less than "sapatu foun no karun eskola ba oan".
 *
 * Prices are realistic-but-approximate market prices and are editable by the
 * person (custom goals live in store.moneyGoals), so a stale price here never
 * blocks anyone.
 *
 * PURE DATA. Tetun text pending native review.
 */

export const REWARDS = [
  { id: 'r1',    cost: 1,    icon: '💧', label: 'Bee mineral botir boot ida' },
  { id: 'r3',    cost: 3,    icon: '🍚', label: 'Ai-han loron ida ba ita' },
  { id: 'r5',    cost: 5,    icon: '🍌', label: 'Ai-fuan no modo ba familia' },
  { id: 'r10',   cost: 10,   icon: '📱', label: 'Pulsa telefone fulan ida' },
  { id: 'r20',   cost: 20,   icon: '👕', label: 'Kamiza ka lipa foun' },
  { id: 'r35',   cost: 35,   icon: '👟', label: 'Sapatu la\'o foun' },
  { id: 'r60',   cost: 60,   icon: '📚', label: 'Karun eskola ba oan ida' },
  { id: 'r100',  cost: 100,  icon: '🛏️', label: 'Sasán uma nian: kolxaun ka kadeira' },
  { id: 'r150',  cost: 150,  icon: '🚲', label: 'Bisikleta ida' },
  { id: 'r250',  cost: 250,  icon: '📲', label: 'Telefone celular foun' },
  { id: 'r400',  cost: 400,  icon: '🐐', label: 'Bibi ka fahi ba hakiak' },
  { id: 'r600',  cost: 600,  icon: '🏍️', label: 'Entrada ba motor ida' },
  { id: 'r1000', cost: 1000, icon: '🏠', label: 'Halo di\'ak uma ka poupansa boot' },
  { id: 'r2000', cost: 2000, icon: '✈️', label: 'Viajen familia ka investimentu boot' },
];

/** Goals already affordable with `saved`, largest first. */
export function reached(saved, custom = []) {
  return all(custom).filter((r) => saved >= r.cost).sort((a, b) => b.cost - a.cost);
}

/** The cheapest goal not yet affordable. */
export function next(saved, custom = []) {
  return all(custom).find((r) => saved < r.cost) || null;
}

/** Built-in goals merged with the person's own, sorted by price. */
export function all(custom = []) {
  return [...REWARDS, ...custom.map((c) => ({ ...c, custom: true }))]
    .sort((a, b) => a.cost - b.cost);
}

/**
 * Days until `goal` is affordable at the current daily saving rate.
 * Returns null when the rate is zero (nothing to divide by) — the UI then
 * shows the amount remaining instead of a date, rather than "Infinity days".
 */
export function daysUntil(goal, saved, perDay) {
  if (!goal) return null;
  if (!(perDay > 0)) return null;
  const remaining = goal.cost - saved;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / perDay);
}
