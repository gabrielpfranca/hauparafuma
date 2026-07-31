/**
 * UMA — the dashboard.
 *
 * The hero counter is the emotional core of the app: it is the one number
 * people open the app to look at. Before quit day it counts down instead, so
 * the preparation phase still has something live on screen.
 */

import { t } from '../i18n.js';
import { quoteOfTheDay } from '../content/quotes.js';
import { el, card, stat, button, callout, empty, bar, toast } from '../ui.js';
import { splitDuration, durationShort, money, num, greetingKey, isoDate } from '../format.js';

export default function renderHome(ctx) {
  const s = ctx.store.get();
  const snap = ctx.snapshot();
  const root = el('div', { class: 'screen' });

  /* ---- greeting ---- */
  root.appendChild(el('header', { class: 'topbar' },
    el('div', { class: 'topbar__title' },
      el('div', { class: 'topbar__eyebrow' }, t(greetingKey())),
      el('h1', {}, s.profile.nickname || 'Belun'),
    ),
  ));

  /* ---- hero counter ---- */
  root.appendChild(heroCard(ctx, snap));

  /* ---- pre-quit guidance ---- */
  if (!snap.hasQuit) {
    root.appendChild(callout(t('home.prequit.hint'), 'callout--brand'));
  }

  /* ---- headline stats ---- */
  root.appendChild(el('div', { class: 'grid grid--2', style: { marginBottom: '14px' } },
    stat({ icon: '💵', value: money(snap.saved), label: t('home.saved') }),
    stat({ icon: '🚭', value: num(snap.notSmoked), label: t('home.notsmoked') }),
    stat({ icon: '⏳', value: durationShort(snap.lifeMin * 60 * 1000), label: t('home.life') }),
    stat({ icon: '💪', value: num(snap.cravingsBeaten), label: t('home.cravings') }),
  ));

  /* ---- today's check-in ---- */
  if (snap.hasQuit) root.appendChild(checkinCard(ctx));

  /* ---- next health milestone ---- */
  if (snap.milestoneNext) {
    root.appendChild(card({},
      el('div', { class: 'card__label' }, t('home.next.health')),
      el('div', { class: 'row' },
        el('div', { style: { fontSize: '1.7rem' }, 'aria-hidden': 'true' }, snap.milestoneNext.icon),
        el('div', { style: { flex: '1', minWidth: '0' } },
          el('div', { style: { fontWeight: '700' } }, snap.milestoneNext.title),
          el('div', { class: 'small muted' }, snap.milestoneNext.when),
        ),
      ),
      el('div', { style: { marginTop: '10px' } }, bar(snap.milestoneProgress)),
      button(t('tools.health'), {
        variant: 'btn--quiet',
        onClick: () => ctx.navigate('/saude'),
        style: 'margin-top:6px;padding-left:0',
      }),
    ));
  }

  /* ---- next savings goal ---- */
  if (snap.rewardNext) {
    const remaining = Math.max(0, snap.rewardNext.cost - snap.saved);
    const days = snap.rewardDays;
    root.appendChild(card({},
      el('div', { class: 'card__label' }, t('home.next.reward')),
      el('div', { class: 'row' },
        el('div', { style: { fontSize: '1.7rem' }, 'aria-hidden': 'true' }, snap.rewardNext.icon || '🎯'),
        el('div', { style: { flex: '1', minWidth: '0' } },
          el('div', { style: { fontWeight: '700' } }, snap.rewardNext.label || snap.rewardNext.name),
          el('div', { class: 'small muted' },
            t('money.togo', { v: money(remaining) }),
            days !== null ? ` · ${t('money.in', { n: days })}` : '',
          ),
        ),
      ),
      el('div', { style: { marginTop: '10px' } },
        bar(snap.rewardNext.cost > 0 ? snap.saved / snap.rewardNext.cost : 0, { accent: true }),
      ),
      button(t('tools.money'), {
        variant: 'btn--quiet',
        onClick: () => ctx.navigate('/osan'),
        style: 'margin-top:6px;padding-left:0',
      }),
    ));
  }

  /* ---- latest programme message ---- */
  const lastIn = [...s.thread].reverse().find((m) => m.dir === 'in');
  if (lastIn) {
    root.appendChild(card({},
      el('div', { class: 'card__label' }, t('home.msg.today')),
      el('p', {}, lastIn.text),
      el('div', { class: 'row row--wrap', style: { marginTop: '8px' } },
        button(t('home.readall'), { variant: 'btn--soft btn--sm', onClick: () => ctx.navigate('/mensajen') }),
        lastIn.action
          ? button(actionLabel(lastIn.action), { variant: 'btn--sm', onClick: () => ctx.applyAction(lastIn.action) })
          : null,
      ),
    ));
  } else {
    root.appendChild(card({}, empty('💬', t('msg.empty'))));
  }

  /* ---- quote of the day ---- */
  root.appendChild(card({ class: 'card--brand' },
    el('div', { class: 'card__label' }, t('home.quote')),
    el('p', { style: { fontSize: '1.08rem', fontWeight: '600', margin: '0' } }, quoteOfTheDay()),
  ));

  return root;
}

/* ------------------------------------------------------------------ */

function heroCard(ctx, snap) {
  const counting = snap.hasQuit;
  const holder = el('div', { class: 'hero', 'data-live-clock': '' });

  const label = el('div', { class: 'hero__label' },
    counting ? t('home.free.label') : t('home.countdown.label'));
  const clockRow = el('div', { class: 'hero__clock' });
  const sub = el('div', { class: 'hero__sub' });

  const paint = () => {
    const live = ctx.snapshot();
    const ms = counting ? live.smokeFreeMs : live.untilQuitMs;
    const { days, hours, minutes, seconds } = splitDuration(ms);
    const units = [
      [days, t('day')],
      [hours, t('hour')],
      [minutes, t('minute')],
      [seconds, t('second')],
    ];
    clockRow.replaceChildren(...units.map(([n, unit]) => el('div', { class: 'unit' },
      el('div', { class: 'unit__n' }, String(n)),
      el('div', { class: 'unit__t' }, unit),
    )));

    if (counting) {
      const streakText = live.streakDays
        ? `${t('home.streak')}: ${live.streakDays}`
        : t('app.tagline');
      sub.textContent = streakText;
    } else {
      sub.textContent = t('app.tagline');
    }

    // If quit day arrives while the screen is open, switch modes.
    if (!counting && live.hasQuit) ctx.refresh();
  };

  holder.replaceChildren(label, clockRow, sub);
  paint();
  holder.addEventListener('tick', paint);

  return card({ class: 'card--brand' }, holder);
}

function checkinCard(ctx) {
  const s = ctx.store.get();
  const key = isoDate(Date.now());
  const answered = s.checkins[key];

  if (answered) {
    return card({},
      el('div', { class: 'row' },
        el('div', { style: { fontSize: '1.4rem' }, 'aria-hidden': 'true' },
          answered === 'clean' ? '✅' : '💛'),
        el('div', { style: { flex: '1' } },
          el('div', { style: { fontWeight: '700' } }, t('home.checkin.done')),
          el('div', { class: 'small muted' },
            answered === 'clean' ? t('home.checkin.yes') : t('home.checkin.no')),
        ),
      ),
    );
  }

  return card({},
    el('div', { class: 'card__label' }, t('today')),
    el('h3', { style: { marginBottom: '12px' } }, t('home.checkin')),
    el('div', { class: 'row', style: { gap: '10px' } },
      button(t('home.checkin.yes'), {
        variant: 'btn--block',
        style: 'flex:1',
        onClick: () => {
          ctx.store.setCheckin(key, 'clean');
          ctx.tracking.recordCravingWin();
          ctx.celebrate();
          toast(t('home.checkin.done'), 'ok');
          ctx.refresh();
        },
      }),
      button(t('home.checkin.no'), {
        variant: 'btn--ghost',
        style: 'flex:1',
        onClick: () => ctx.openRelapseSheet(),
      }),
    ),
  );
}

function actionLabel(action) {
  const map = {
    game: t('tools.game'),
    breathe: t('tools.breathe'),
    diary: t('tools.diary'),
    money: t('tools.money'),
    health: t('tools.health'),
    community: t('tab.community'),
    plan: t('tools.plan'),
    why: t('sos.why'),
    badges: t('tools.badges'),
    triggers: t('tools.triggers'),
    test: t('tools.test'),
    withdrawal: t('tools.withdrawal'),
    services: t('tools.services'),
    sos: t('sos.button'),
    me: t('me.title'),
  };
  return map[action] || t('continue');
}

export { actionLabel };
