/**
 * SOS — the craving response sheet, reachable from every screen.
 *
 * Design constraint: someone opening this is not in a state to read. So the
 * sheet leads with one sentence of reassurance and a grid of large single-tap
 * options, and the 5-minute timer states the one fact that actually helps —
 * that the craving peaks and fades within minutes.
 *
 * Nothing here judges. "Ha'u fuma tiha" is offered as calmly as "Ha'u manán".
 */

import { t } from '../i18n.js';
import { copingTip } from '../programme.js';
import { REASONS } from '../content/coping.js';
import { el, clear, button, callout, toast, multiline } from '../ui.js';
import { clock } from '../format.js';

export function renderSOS(ctx, close) {
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('p', {}, t('sos.body')));
  wrap.appendChild(callout(copingTip(Date.now()), 'callout--brand'));

  const grid = el('div', { class: 'grid grid--2', style: { marginTop: '4px' } });

  const option = (icon, label, onClick) => el('button', {
    class: 'trophy',
    type: 'button',
    style: 'cursor:pointer;min-height:96px',
    onclick: onClick,
  },
    el('span', { class: 'trophy__ico', 'aria-hidden': 'true' }, icon),
    el('span', { class: 'trophy__ttl' }, label),
  );

  grid.appendChild(option('⏱️', t('sos.timer'), () => showTimer(ctx, wrap, close)));
  grid.appendChild(option('🎮', t('sos.game'), () => {
    close();
    ctx.navigate('/jogu');
  }));
  grid.appendChild(option('🌬️', t('sos.breathe'), () => {
    close();
    ctx.navigate('/dada-iis');
  }));
  grid.appendChild(option('❤️', t('sos.why'), () => showReasons(ctx, wrap)));
  grid.appendChild(option('💧', t('sos.water'), () => showTip(wrap, t('sos.water.tip'))));
  grid.appendChild(option('🚶', t('sos.walk'), () => showTip(wrap, t('sos.walk.tip'))));
  grid.appendChild(option('📞', t('sos.call'), () => showSupports(ctx, wrap, close)));
  grid.appendChild(option('🤝', t('sos.community'), () => {
    close();
    ctx.navigate('/komunidade');
  }));

  wrap.appendChild(grid);

  /* ---- outcome ---- */
  wrap.appendChild(el('hr', { class: 'divider' }));
  wrap.appendChild(el('div', { class: 'stack' },
    button(t('sos.won'), {
      variant: 'btn--block',
      icon: '🎉',
      onClick: () => {
        const n = ctx.tracking.recordCravingWin();
        ctx.tracking.addDiary({ strength: 3, trigger: null, action: 'sos', smoked: false });
        close();
        toast(t('sos.won.msg', { n }), 'ok');
        ctx.celebrate();
        ctx.refresh();
      },
    }),
    button(t('sos.smoked'), {
      variant: 'btn--ghost btn--block',
      onClick: () => {
        close();
        ctx.openRelapseSheet();
      },
    }),
  ));

  return wrap;
}

/* ------------------------------------------------------------------ */

/** Replace the sheet body with a 5-minute countdown. */
function showTimer(ctx, wrap, close) {
  clear(wrap);

  let remaining = 5 * 60 * 1000;
  const display = el('div', { class: 'breathe__count' }, clock(remaining));
  const note = el('p', { class: 'muted center' }, t('sos.body'));

  const tick = setInterval(() => {
    remaining -= 1000;
    display.textContent = clock(Math.max(0, remaining));
    if (remaining <= 0) {
      clearInterval(tick);
      note.textContent = t('sos.timer.done');
      display.textContent = '✅';
    }
  }, 1000);

  wrap.appendChild(el('div', { class: 'center stack', style: { padding: '12px 0' } },
    display,
    note,
  ));

  wrap.appendChild(el('div', { class: 'stack' },
    button(t('sos.won'), {
      variant: 'btn--block',
      onClick: () => {
        clearInterval(tick);
        const n = ctx.tracking.recordCravingWin();
        ctx.tracking.addDiary({ strength: 3, trigger: null, action: 'timer', smoked: false });
        close();
        toast(t('sos.won.msg', { n }), 'ok');
        ctx.celebrate();
        ctx.refresh();
      },
    }),
    button(t('sos.game'), {
      variant: 'btn--soft btn--block',
      onClick: () => {
        clearInterval(tick);
        close();
        ctx.navigate('/jogu');
      },
    }),
  ));
}

function showReasons(ctx, wrap) {
  const s = ctx.store.get();
  const chosen = REASONS.filter((r) => s.profile.reasons.includes(r.id));
  clear(wrap);

  wrap.appendChild(el('h3', {}, t('plan.why')));

  if (!chosen.length && !s.profile.customReason) {
    wrap.appendChild(el('p', { class: 'muted' }, t('plan.empty')));
  } else {
    const list = el('ul', { class: 'list' });
    for (const r of chosen) {
      list.appendChild(el('li', { class: 'list__row', style: 'cursor:default' },
        el('span', { class: 'list__ico', 'aria-hidden': 'true' }, r.icon),
        el('span', { class: 'list__txt' }, el('span', { class: 'list__ttl' }, r.label)),
      ));
    }
    if (s.profile.customReason) {
      list.appendChild(el('li', { class: 'list__row', style: 'cursor:default' },
        el('span', { class: 'list__ico', 'aria-hidden': 'true' }, '✍️'),
        el('span', { class: 'list__txt' }, el('span', { class: 'list__ttl' }, s.profile.customReason)),
      ));
    }
    wrap.appendChild(el('div', { class: 'card card--flush' }, list));
  }

  wrap.appendChild(button(t('tools.plan'), {
    variant: 'btn--soft btn--block',
    onClick: () => ctx.navigate('/planu'),
  }));
}

function showTip(wrap, text) {
  clear(wrap);
  wrap.appendChild(el('h3', {}, t('sos.tip.title')));
  wrap.appendChild(callout(text, 'callout--brand'));
  wrap.appendChild(el('p', { class: 'muted small' }, ...multiline(t('sos.body'))));
}

function showSupports(ctx, wrap, close) {
  const s = ctx.store.get();
  clear(wrap);
  wrap.appendChild(el('h3', {}, t('plan.support')));

  if (!s.plan.supports.length) {
    wrap.appendChild(el('p', { class: 'muted' }, t('plan.empty')));
    wrap.appendChild(button(t('tools.plan'), {
      variant: 'btn--block',
      onClick: () => {
        close();
        ctx.navigate('/planu');
      },
    }));
    return;
  }

  const list = el('div', { class: 'card card--flush' });
  for (const person of s.plan.supports) {
    list.appendChild(el('a', {
      class: 'list__row',
      href: `tel:${String(person.phone).replace(/[^\d+]/g, '')}`,
    },
      el('span', { class: 'list__ico', 'aria-hidden': 'true' }, '📞'),
      el('span', { class: 'list__txt' },
        el('span', { class: 'list__ttl' }, person.name),
        el('span', { class: 'list__sub' }, person.phone),
      ),
      el('span', { class: 'list__arrow' }, t('plan.call')),
    ));
  }
  wrap.appendChild(list);
}
