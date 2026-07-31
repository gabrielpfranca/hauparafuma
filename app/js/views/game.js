/**
 * JOGU — the minigame screen.
 *
 * Renders the MemoryGame engine from js/game.js. On finishing a board it asks
 * whether the craving has passed; a "yes" is recorded as a craving beaten,
 * which is what earns the badges. That closes the loop: the distraction tool
 * feeds the progress tracking rather than being a dead end.
 */

import { t } from '../i18n.js';
import { MemoryGame, LEVELS, isBest } from '../game.js';
import { el, clear, card, button, toast, buzz } from '../ui.js';
import { clock } from '../format.js';

export default function renderGame(ctx) {
  const root = el('div', { class: 'screen' });
  const s = ctx.store.get();

  let level = Math.min(LEVELS.length - 1, Math.max(0, s.game.level || 0));
  let game = null;
  let timer = null;

  root.appendChild(el('header', { class: 'topbar' },
    button('‹', { variant: 'btn--ghost btn--sm', 'aria-label': t('back'), onClick: () => ctx.navigate('/ferramenta') }),
    el('div', { class: 'topbar__title' },
      el('div', { class: 'topbar__eyebrow' }, t('game.sub')),
      el('h1', {}, t('game.title')),
    ),
  ));

  const hud = el('div', { class: 'game__hud' });
  const board = el('div', { class: 'board' });
  const footer = el('div', { style: { marginTop: '16px' } });

  root.appendChild(el('div', {}, hud, board, footer));

  /* ---------------- HUD ---------------- */

  const paintHud = () => {
    const best = ctx.store.get().game.best[level];
    clear(hud);
    hud.appendChild(el('div', { class: 'game__pill' }, `${t('game.level')} ${level + 1}`));
    hud.appendChild(el('div', { class: 'game__pill' },
      `${t('game.pairs')} ${game.pairsFound}/${game.pairsTotal}`));
    hud.appendChild(el('div', { class: 'game__pill' }, `${t('game.moves')} ${game.moves}`));
    const clockPill = el('div', { class: 'game__pill' }, `${t('game.time')} ${clock(game.elapsedMs)}`);
    clockPill.dataset.clock = '1';
    hud.appendChild(clockPill);
    if (best) {
      hud.appendChild(el('div', { class: 'game__pill' },
        `${t('game.best')} ${best.moves} · ${clock(best.ms)}`));
    }
  };

  /* ---------------- board ---------------- */

  const paintBoard = () => {
    board.style.gridTemplateColumns = `repeat(${game.cols}, minmax(0, 1fr))`;
    clear(board);
    for (const card_ of game.cards) {
      const faceUp = card_.up || card_.done;
      const tile = el('button', {
        class: `tile ${card_.done ? 'tile--done' : card_.up ? 'tile--up' : ''} ${game.wrong.includes(card_.i) ? 'tile--shake' : ''}`.trim(),
        type: 'button',
        'aria-label': faceUp ? card_.symbol : '?',
        disabled: card_.done,
        onclick: () => onFlip(card_.i),
      }, faceUp ? card_.symbol : '');
      board.appendChild(tile);
    }
  };

  const onFlip = (index) => {
    const result = game.flip(index);
    if (result === 'miss') {
      buzz(18);
      // Leave the mismatch visible long enough to memorise, then flip back.
      setTimeout(() => {
        game.resolve();
      }, 750);
    } else if (result === 'match') {
      buzz(10);
    }
  };

  /* ---------------- lifecycle ---------------- */

  const onChange = () => {
    paintHud();
    paintBoard();
    if (game.done) finish();
  };

  const start = (lvl = level) => {
    stopTimer();
    level = lvl;
    game = new MemoryGame({ level, onChange });
    clear(footer);
    paintHud();
    paintBoard();
    startTimer();
  };

  const startTimer = () => {
    stopTimer();
    timer = setInterval(() => {
      const pill = hud.querySelector('[data-clock]');
      if (!pill) {
        stopTimer();
        return;
      }
      if (!document.body.contains(root)) {
        stopTimer();
        return;
      }
      pill.textContent = `${t('game.time')} ${clock(game.elapsedMs)}`;
    }, 500);
  };

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const finish = () => {
    stopTimer();
    buzz([20, 60, 20]);
    ctx.tracking.recordGamePlayed();

    const result = { moves: game.moves, ms: game.elapsedMs };
    const previous = ctx.store.get().game.best[level];
    const newBest = isBest(previous, result);
    if (newBest) {
      ctx.store.update((st) => {
        st.game.best[level] = result;
      }, 'game');
    }
    ctx.store.update((st) => {
      st.game.level = level;
    }, 'game');

    clear(footer);
    footer.appendChild(card({ class: 'card--brand' },
      el('h3', {}, `🎉 ${t('game.win')}`),
      el('p', {}, t('game.win.body', { m: clock(result.ms), v: result.moves })),
      newBest ? el('p', { style: { fontWeight: '700' } }, `⭐ ${t('game.newbest')}`) : null,
      el('div', { class: 'row row--wrap', style: { marginTop: '10px' } },
        button(t('game.craveGone'), {
          variant: 'btn--accent',
          onClick: () => {
            const n = ctx.tracking.recordCravingWin();
            ctx.tracking.addDiary({ strength: 3, trigger: null, action: 'game', smoked: false });
            toast(t('sos.won.msg', { n }), 'ok');
            ctx.celebrate();
            start(level);
          },
        }),
        button(t('game.craveStay'), {
          variant: 'btn--ghost',
          onClick: () => {
            // Still craving: keep them occupied and step the difficulty up.
            start(Math.min(LEVELS.length - 1, level + 1));
          },
        }),
      ),
    ));

    footer.appendChild(el('div', { class: 'row row--wrap' },
      button(t('game.again'), { variant: 'btn--soft', onClick: () => start(level) }),
      level < LEVELS.length - 1
        ? button(t('game.next'), { variant: 'btn--soft', onClick: () => start(level + 1) })
        : null,
      button(t('game.quit'), { variant: 'btn--quiet', onClick: () => ctx.navigate('/ferramenta') }),
    ));
  };

  /* ---------------- level picker ---------------- */

  const picker = el('div', { class: 'quickbar', style: { marginBottom: '4px' } });
  for (const def of LEVELS) {
    picker.appendChild(el('button', {
      class: 'chip',
      type: 'button',
      onclick: () => start(def.id),
    }, `${t(def.key)} · ${def.cols * def.rows / 2} ${t('game.pairs')}`));
  }
  root.insertBefore(picker, root.children[1]);

  start(level);
  return root;
}
