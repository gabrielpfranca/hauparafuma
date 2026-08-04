/**
 * HA'U — profile, stats, settings, privacy.
 *
 * Includes the two things a health app handling personal data owes the user
 * outright: export everything, and delete everything. Both work offline and
 * neither asks why.
 */

import { t } from '../i18n.js';
import { phaseKey, LAST_DAY } from '../programme.js';
import { el, clear, card, stat, button, listRow, callout, toast, openSheet, field, multiline, confirmSheet, avatarColor, initial, bar } from '../ui.js';
import { durationShort, money, num, date, isoDate, parseIsoDate, toHHMM, parseHHMM } from '../format.js';

export default function renderMe(ctx) {
  const root = el('div', { class: 'screen' });
  const body = el('div', {});

  const paint = () => {
    clear(body);
    const s = ctx.store.get();
    const snap = ctx.snapshot();

    /* ---- identity ---- */
    body.appendChild(card({},
      el('div', { class: 'row' },
        el('div', {
          class: 'post__av',
          style: { width: '56px', height: '56px', fontSize: '1.3rem', background: avatarColor(s.profile.avatarSeed) },
          'aria-hidden': 'true',
        }, initial(s.profile.nickname)),
        el('div', { style: { flex: '1', minWidth: '0' } },
          el('h2', {}, s.profile.nickname || 'Belun'),
          el('div', { class: 'small muted' }, t('me.since', { d: date(s.quit.startedAt || s.createdAt) })),
        ),
      ),
    ));

    /* ---- programme progress ---- */
    const day = snap.day;
    body.appendChild(card({},
      el('div', { class: 'card__label' }, t('me.programme')),
      el('div', { style: { fontWeight: '700' } }, t(phaseKey(day))),
      day !== null && day >= 0
        ? el('div', { class: 'small muted' }, t('me.programme.day', { n: Math.min(day, LAST_DAY) }))
        : null,
      day !== null && day >= 0
        ? el('div', { style: { marginTop: '10px' } }, bar(Math.min(1, day / LAST_DAY)))
        : null,
      el('div', { class: 'small muted', style: { marginTop: '8px' } },
        `${t('me.quitdate')}: ${s.quit.date ? date(s.quit.date) : '—'}`),
    ));

    /* ---- stats ---- */
    body.appendChild(el('div', { class: 'card__label' }, t('me.stats')));
    body.appendChild(el('div', { class: 'grid grid--2', style: { marginBottom: '14px' } },
      stat({ icon: '⏱️', value: durationShort(snap.smokeFreeMs), label: t('home.free.label') }),
      stat({ icon: '💵', value: money(snap.saved), label: t('home.saved') }),
      stat({ icon: '💪', value: num(snap.cravingsBeaten), label: t('home.cravings') }),
      stat({ icon: '📔', value: num(snap.diaryCount), label: t('diary.count', { n: '' }).trim() }),
      stat({ icon: '🎮', value: num(s.counters.gamesPlayed), label: t('tools.game') }),
      stat({ icon: '🏅', value: num(s.badges.length), label: t('badge.title') }),
    ));

    /* ---- attempts history ---- */
    if (s.quit.history.length || s.quit.bestDays) {
      const rows = el('div', { class: 'stack' });
      for (const h of s.quit.history) {
        rows.appendChild(el('div', { class: 'row' },
          el('span', { style: { flex: '1' } }, t('me.relapse.attempt', { n: h.attempt })),
          el('span', { class: 'small muted' }, `${t('day')} ${h.days}`),
        ));
      }
      body.appendChild(card({},
        el('div', { class: 'card__label' }, t('me.relapse.history')),
        rows,
        el('div', { style: { fontWeight: '700', marginTop: '6px' } },
          t('me.relapse.best', { n: Math.max(s.quit.bestDays, Math.floor(snap.smokeFreeMs / 86400000)) })),
      ));
    }

    /* ---- settings ---- */
    body.appendChild(el('div', { class: 'card__label' }, t('me.settings')));

    const settingsList = el('div', { class: 'card card--flush' });
    settingsList.appendChild(listRow({
      icon: '🔔',
      title: t('me.notif'),
      sub: s.settings.notifications ? t('yes') : t('no'),
      onClick: () => openNotifSheet(ctx, paint),
    }));
    settingsList.appendChild(listRow({
      icon: '🎨',
      title: t('me.theme'),
      sub: t(`me.theme.${s.settings.theme}`),
      onClick: () => openThemeSheet(ctx, paint),
    }));
    settingsList.appendChild(listRow({
      icon: '📅',
      title: t('me.quitdate'),
      sub: s.quit.date ? date(s.quit.date) : '—',
      onClick: () => openQuitDateSheet(ctx, paint),
    }));
    settingsList.appendChild(listRow({
      icon: '🚬',
      title: t('money.settings'),
      sub: `${s.profile.cigsPerDay} / ${t('day')} · ${money(s.profile.pricePerPack)}`,
      onClick: () => ctx.navigate('/osan'),
    }));
    body.appendChild(settingsList);

    /* ---- relapse ---- */
    body.appendChild(card({},
      el('div', { class: 'card__label' }, t('me.relapse.title')),
      el('p', { class: 'small muted' }, t('me.relapse.body')),
      button(t('me.relapse'), { variant: 'btn--ghost btn--block', onClick: () => ctx.openRelapseSheet() }),
    ));

    /* ---- data & privacy ---- */
    body.appendChild(el('div', { class: 'card__label' }, t('me.profile')));
    body.appendChild(callout(t('me.privacy.body'), 'callout--brand'));

    const dataList = el('div', { class: 'card card--flush' });
    dataList.appendChild(listRow({
      icon: '⬇️',
      title: t('me.export'),
      onClick: () => exportData(ctx),
    }));
    dataList.appendChild(listRow({
      icon: '🗑️',
      title: t('me.erase'),
      onClick: async () => {
        const yes = await confirmSheet(t('me.erase'), t('me.erase.confirm'), {
          danger: true,
          confirmLabel: t('delete'),
        });
        if (!yes) return;
        ctx.resetOnboarding();
      },
    }));
    dataList.appendChild(listRow({
      icon: 'ℹ️',
      title: t('me.about'),
      onClick: () => openSheet(t('me.about'), () => el('div', { class: 'stack' },
        ...multiline(t('me.about.body')),
        el('p', { class: 'tiny muted' }, t('health.source')),
      )),
    }));
    body.appendChild(dataList);
  };

  root.appendChild(el('header', { class: 'topbar' },
    el('div', { class: 'topbar__title' }, el('h1', {}, t('me.title'))),
  ));
  root.appendChild(body);

  paint();
  return root;
}

/* ------------------------------------------------------------------ */

function openNotifSheet(ctx, done) {
  openSheet(t('me.notif'), (close) => {
    const s = ctx.store.get();

    const toggle = el('input', { type: 'checkbox', checked: s.settings.notifications || undefined });
    const morning = el('input', { type: 'time', value: toHHMM(s.settings.morningAt) });
    const evening = el('input', { type: 'time', value: toHHMM(s.settings.eveningAt) });
    const quietFrom = el('input', { type: 'time', value: toHHMM(s.settings.quietFrom) });
    const quietTo = el('input', { type: 'time', value: toHHMM(s.settings.quietTo) });

    return el('div', { class: 'stack' },
      el('div', { class: 'switch' },
        el('label', { for: 'notif-on' }, t('me.notif.on')),
        Object.assign(toggle, { id: 'notif-on' }),
      ),
      ctx.notif.permission() === 'denied' ? callout(t('notif.denied')) : null,
      ctx.notif.permission() === 'unsupported' ? callout(t('notif.unsupported')) : null,
      field(t('me.notif.morning'), morning),
      field(t('me.notif.evening'), evening),
      el('div', { class: 'card__label' }, t('me.notif.quiet')),
      el('div', { class: 'row' },
        el('div', { style: { flex: '1' } }, field(t('me.notif.from'), quietFrom)),
        el('div', { style: { flex: '1' } }, field(t('me.notif.to'), quietTo)),
      ),
      button(t('me.notif.test'), {
        variant: 'btn--ghost btn--block',
        onClick: async () => {
          if (ctx.notif.permission() !== 'granted') {
            const res = await ctx.notif.request();
            if (res !== 'granted') {
              toast(t('notif.denied'), 'warn');
              return;
            }
          }
          const ok = await ctx.notif.test();
          if (!ok) toast(t('notif.denied'), 'warn');
        },
      }),
      button(t('save'), {
        variant: 'btn--block',
        onClick: async () => {
          let enabled = toggle.checked;
          if (enabled && ctx.notif.permission() !== 'granted') {
            const res = await ctx.notif.request();
            enabled = res === 'granted';
            if (!enabled) toast(t('notif.denied'), 'warn');
          }
          ctx.store.update((st) => {
            st.settings.notifications = enabled;
            st.settings.morningAt = parseHHMM(morning.value) ?? st.settings.morningAt;
            st.settings.eveningAt = parseHHMM(evening.value) ?? st.settings.eveningAt;
            st.settings.quietFrom = parseHHMM(quietFrom.value) ?? st.settings.quietFrom;
            st.settings.quietTo = parseHHMM(quietTo.value) ?? st.settings.quietTo;
          }, 'settings');
          ctx.armNotifications();
          close();
          toast(enabled ? t('notif.enabled') : t('ok'), 'ok');
          done();
        },
      }),
    );
  });
}

function openThemeSheet(ctx, done) {
  openSheet(t('me.theme'), (close) => {
    const options = ['auto', 'light', 'dark'];
    return el('div', { class: 'stack' },
      ...options.map((option) => button(t(`me.theme.${option}`), {
        variant: ctx.store.get().settings.theme === option ? 'btn--block' : 'btn--ghost btn--block',
        onClick: () => {
          ctx.store.update((s) => {
            s.settings.theme = option;
          }, 'settings');
          ctx.applyTheme();
          close();
          done();
        },
      })),
    );
  });
}

function openQuitDateSheet(ctx, done) {
  openSheet(t('me.quitdate'), (close) => {
    const s = ctx.store.get();
    const input = el('input', { type: 'date', value: s.quit.date ? isoDate(s.quit.date) : isoDate(Date.now()) });

    return el('div', { class: 'stack' },
      field(t('me.quitdate'), input),
      callout(t('ob.date.body'), 'callout--brand'),
      button(t('save'), {
        variant: 'btn--block',
        onClick: () => {
          const parsed = parseIsoDate(input.value);
          if (!parsed) {
            toast(t('ob.date.invalid'), 'warn');
            return;
          }
          parsed.setHours(0, 0, 0, 0);
          ctx.store.update((st) => {
            st.quit.date = parsed.getTime();
            // Moving the anchor changes which messages are due; clear the
            // ledger so the sequence is recomputed from the new date.
            st.programme.delivered = st.programme.delivered.filter((id) => id === 'welcome');
          }, 'quitdate');
          ctx.deliverDue();
          ctx.armNotifications();
          close();
          toast(t('ok'), 'ok');
          done();
          ctx.refresh();
        },
      }),
    );
  });
}

/** Download the whole store as JSON. */
function exportData(ctx) {
  try {
    const blob = new Blob([ctx.store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `hauparafuma-${isoDate(Date.now())}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t('ok'), 'ok');
  } catch (err) {
    console.warn('[me] export sala:', err);
    toast(t('error'), 'err');
  }
}
