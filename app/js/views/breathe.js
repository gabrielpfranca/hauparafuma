/**
 * DADA IIS — a 4-4-6 breathing pacer.
 *
 * Longer exhale than inhale is the part that matters: it is what shifts the
 * nervous system out of the stress response, and stress is the most commonly
 * reported relapse trigger. Six rounds takes about 90 seconds.
 *
 * The animation is driven by CSS transitions on one element, so it stays smooth
 * on a low-end phone, and it honours prefers-reduced-motion via the stylesheet.
 */

import { t } from '../i18n.js';
import { el, clear, card, button, callout, toast } from '../ui.js';

const PHASES = [
  { key: 'breathe.in',   seconds: 4, scale: 1.0 },
  { key: 'breathe.hold', seconds: 4, scale: 1.0 },
  { key: 'breathe.out',  seconds: 6, scale: 0.62 },
];

const ROUNDS = 6;

export default function renderBreathe(ctx) {
  const root = el('div', { class: 'screen' });

  root.appendChild(el('header', { class: 'topbar' },
    button('‹', { variant: 'btn--ghost btn--sm', 'aria-label': t('back'), onClick: () => ctx.navigate('/ferramenta') }),
    el('div', { class: 'topbar__title' }, el('h1', {}, t('breathe.title'))),
  ));

  root.appendChild(callout(t('breathe.hint'), 'callout--brand'));

  const orb = el('div', { class: 'breathe__orb' }, t('breathe.start'));
  const count = el('div', { class: 'breathe__count' }, '');
  const roundLabel = el('div', { class: 'muted' }, '');
  const controls = el('div', { class: 'stack', style: { marginTop: '8px', width: '100%' } });

  root.appendChild(card({},
    el('div', { class: 'breathe' }, orb, count, roundLabel, controls),
  ));

  let timer = null;
  let running = false;
  let round = 0;
  let phaseIndex = 0;
  let secondsLeft = 0;

  const stop = () => {
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    orb.style.transform = '';
    orb.textContent = t('breathe.start');
    count.textContent = '';
    roundLabel.textContent = '';
    paintControls();
  };

  const finish = () => {
    stop();
    ctx.tracking.recordBreath();
    toast(t('breathe.done'), 'ok');
    orb.textContent = '✓';
  };

  const enterPhase = () => {
    const phase = PHASES[phaseIndex];
    secondsLeft = phase.seconds;
    orb.style.transitionDuration = `${phase.seconds}s`;
    orb.style.transform = `scale(${phase.scale})`;
    orb.textContent = t(phase.key);
    count.textContent = String(secondsLeft);
    roundLabel.textContent = t('breathe.rounds', { n: round + 1, t: ROUNDS });
  };

  const tick = () => {
    secondsLeft -= 1;
    if (secondsLeft > 0) {
      count.textContent = String(secondsLeft);
      return;
    }
    phaseIndex += 1;
    if (phaseIndex >= PHASES.length) {
      phaseIndex = 0;
      round += 1;
      if (round >= ROUNDS) {
        finish();
        return;
      }
    }
    enterPhase();
  };

  const start = () => {
    running = true;
    round = 0;
    phaseIndex = 0;
    // Start from the expanded state so the first inhale has somewhere to go.
    orb.style.transitionDuration = '0s';
    orb.style.transform = 'scale(0.62)';
    requestAnimationFrame(() => enterPhase());
    timer = setInterval(tick, 1000);
    paintControls();
  };

  function paintControls() {
    clear(controls);
    controls.appendChild(button(running ? t('breathe.stop') : t('breathe.start'), {
      variant: running ? 'btn--ghost btn--block' : 'btn--lg btn--block',
      onClick: () => (running ? stop() : start()),
    }));
    if (!running) {
      controls.appendChild(button(t('tools.game'), {
        variant: 'btn--quiet btn--block',
        onClick: () => ctx.navigate('/jogu'),
      }));
    }
  }

  paintControls();

  // Leaving the screen must not leave an interval running.
  const observer = new MutationObserver(() => {
    if (!document.body.contains(root)) {
      stop();
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('app'), { childList: true, subtree: false });

  return root;
}
