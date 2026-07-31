/**
 * JOGU "HETAN PÁR" — memory match, the craving-distraction minigame.
 *
 * Why this game, specifically:
 *  - A craving peaks and fades in roughly 3–5 minutes. A board sized to take
 *    about that long turns "resist for five minutes" into "finish this board",
 *    which is a far easier instruction to follow.
 *  - Matching pairs occupies visual working memory, which is what intrusive
 *    craving imagery uses. Idle games (tapping, scrolling) do not compete for it.
 *  - The symbols are food, plants and animals. There are deliberately NO
 *    cigarette, lighter or ashtray symbols: showing smoking cues to someone
 *    mid-craving is the opposite of help.
 *
 * PURE LOGIC — no DOM. The view (views/game.js) renders and animates.
 */

export const LEVELS = [
  { id: 0, key: 'game.level.easy', cols: 3, rows: 4 },  //  6 pairs
  { id: 1, key: 'game.level.mid',  cols: 4, rows: 4 },  //  8 pairs
  { id: 2, key: 'game.level.hard', cols: 4, rows: 5 },  // 10 pairs
];

/** Calm, culturally legible symbols. No smoking cues. */
const SYMBOLS = [
  '🥥', '🍌', '🌽', '🍠', '🥬', '🍚', '🐓', '🐐',
  '🐟', '🌴', '🌺', '☀️', '🌊', '⛰️', '🦋', '🐝',
  '🥚', '🍋', '🫘', '🌾',
];

function shuffle(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A single game. Callers drive it with `flip(index)` and read `state`.
 * `onChange` fires after every state transition so the view can re-render.
 */
export class MemoryGame {
  constructor({ level = 0, onChange = () => {}, rand = Math.random } = {}) {
    const def = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level))];
    this.level = def.id;
    this.cols = def.cols;
    this.rows = def.rows;
    this.onChange = onChange;
    this.rand = rand;

    const pairCount = (def.cols * def.rows) / 2;
    const chosen = shuffle(SYMBOLS, rand).slice(0, pairCount);
    this.cards = shuffle([...chosen, ...chosen], rand).map((symbol, i) => ({
      i, symbol, up: false, done: false,
    }));

    this.pairsFound = 0;
    this.pairsTotal = pairCount;
    this.moves = 0;
    this.startedAt = 0;
    this.finishedAt = 0;
    this.busy = false;
    this.wrong = [];          // indices to flash as a mismatch
    this._open = [];
  }

  get elapsedMs() {
    if (!this.startedAt) return 0;
    return (this.finishedAt || Date.now()) - this.startedAt;
  }

  get done() {
    return this.pairsFound === this.pairsTotal;
  }

  /**
   * Flip the card at `index`. Returns 'match' | 'miss' | 'ignored'.
   * A mismatched pair stays face-up until the caller calls `resolve()`, so the
   * view controls how long the player gets to see it.
   */
  flip(index) {
    if (this.busy || this.done) return 'ignored';
    const card = this.cards[index];
    if (!card || card.done || card.up) return 'ignored';

    if (!this.startedAt) this.startedAt = Date.now();

    card.up = true;
    this._open.push(index);

    if (this._open.length < 2) {
      this.onChange();
      return 'ignored';
    }

    this.moves++;
    const [a, b] = this._open;

    if (this.cards[a].symbol === this.cards[b].symbol) {
      this.cards[a].done = true;
      this.cards[b].done = true;
      this._open = [];
      this.pairsFound++;
      if (this.done) this.finishedAt = Date.now();
      this.onChange();
      return 'match';
    }

    this.busy = true;
    this.wrong = [a, b];
    this.onChange();
    return 'miss';
  }

  /** Turn the mismatched pair back down. */
  resolve() {
    for (const i of this.wrong) {
      const card = this.cards[i];
      if (card && !card.done) card.up = false;
    }
    this.wrong = [];
    this._open = [];
    this.busy = false;
    this.onChange();
  }
}

/**
 * Is this result a new personal best for the level?
 * Fewer moves wins; time breaks ties. Ranking by moves rather than by time
 * keeps the game from pushing people into frantic tapping — the point is calm
 * distraction, not a speed contest.
 */
export function isBest(previous, result) {
  if (!previous) return true;
  if (result.moves !== previous.moves) return result.moves < previous.moves;
  return result.ms < previous.ms;
}
