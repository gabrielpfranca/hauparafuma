/**
 * MENSAJEN — the in-app message thread.
 *
 * This is the handbook's two-way channel. Programme messages arrive on the
 * left; the person can reply in free text or with quick-reply chips, and the
 * engine answers. Quick chips matter: typing is slow on a cheap keypad and
 * literacy varies, so every interaction the engine understands is also
 * reachable with one tap.
 */

import { t } from '../i18n.js';
import { el, clear, button, chip, empty, toast } from '../ui.js';
import { time, dateWithWeekday, isoDate } from '../format.js';
import { actionLabel } from './home.js';

/** Quick-reply chips: id -> the text sent on tap. */
const QUICK = {
  crave:   { label: 'msg.quick.crave',  text: 'Hakarak fuma' },
  smoked:  { label: 'msg.quick.smoked', text: 'Ha\'u fuma tiha' },
  good:    { label: 'msg.quick.good',   text: 'Ha\'u sente di\'ak' },
  help:    { label: 'msg.quick.help',   text: 'Tulun ha\'u' },
  money:   { label: 'msg.quick.money',  text: 'Osan' },
  health:  { label: 'msg.quick.health', text: 'Saúde' },
  game:    { label: 'tools.game',       text: 'Jogu' },
  breathe: { label: 'tools.breathe',    text: 'Dada iis' },
  won:     { label: 'sos.won',          text: 'Ha\'u manán ona' },
  clean:   { label: 'home.checkin.yes', text: 'Lae, ha\'u la fuma' },
  restart: { label: 'me.relapse.restart', text: 'Hahú konta foun' },
  keep:    { label: 'me.relapse.keep',  text: 'Kontinua konta' },
};

const KIND_LABEL = {
  motivation: 'msg.kind.motivation',
  info: 'msg.kind.info',
  coping: 'msg.kind.coping',
  benefit: 'msg.kind.benefit',
  relapse: 'msg.kind.relapse',
  reminder: 'msg.kind.reminder',
  assess: 'msg.kind.assess',
  social: 'msg.kind.social',
  reward: 'msg.kind.reward',
  service: 'msg.kind.service',
};

export default function renderMessages(ctx) {
  const root = el('div', { class: 'screen' });

  root.appendChild(el('header', { class: 'topbar' },
    el('div', { class: 'topbar__title' },
      el('div', { class: 'topbar__eyebrow' }, t('msg.sub')),
      el('h1', {}, t('msg.title')),
    ),
  ));

  const chatHost = el('div', { class: 'chat' });
  root.appendChild(chatHost);

  const quickHost = el('div', { class: 'quickbar' });
  root.appendChild(quickHost);

  const paint = () => {
    const thread = ctx.store.get().thread;
    clear(chatHost);

    if (!thread.length) {
      chatHost.appendChild(empty('💬', t('msg.empty')));
    } else {
      let lastDay = '';
      for (const msg of thread) {
        const dayKey = isoDate(msg.at);
        if (dayKey !== lastDay) {
          lastDay = dayKey;
          chatHost.appendChild(el('div', { class: 'daysep' }, dateWithWeekday(msg.at)));
        }
        chatHost.appendChild(bubble(ctx, msg));
      }
    }

    // Chips from the most recent inbound message, falling back to the basics.
    const lastIn = [...thread].reverse().find((m) => m.dir === 'in');
    const ids = (lastIn && lastIn.quick) || ['crave', 'help', 'money', 'health'];
    clear(quickHost);
    for (const id of ids) {
      const def = QUICK[id];
      if (!def) continue;
      quickHost.appendChild(chip(t(def.label), {
        onClick: () => submit(def.text, lastIn && lastIn.assessDay ? lastIn.assessDay : null),
      }));
    }

    ctx.markThreadRead();
  };

  /* ---- composer ---- */
  const input = el('textarea', {
    class: 'composer__input',
    rows: '1',
    placeholder: t('msg.ph'),
    maxlength: '400',
    'aria-label': t('msg.ph'),
    oninput: (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(120, e.target.scrollHeight)}px`;
    },
    onkeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
  });

  const submit = (text, assessDay = null) => {
    ctx.sendUserMessage(text, { assessDay });
    paint();
    requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
  };

  const send = () => {
    const value = input.value.trim();
    if (!value) return;
    input.value = '';
    input.style.height = 'auto';
    const lastIn = [...ctx.store.get().thread].reverse().find((m) => m.dir === 'in');
    submit(value, lastIn && lastIn.assessDay ? lastIn.assessDay : null);
  };

  const composer = el('div', { class: 'composer' },
    el('div', { class: 'composer__inner' },
      input,
      button('➤', { onClick: send, 'aria-label': t('send') }),
    ),
  );
  root.appendChild(composer);

  root.appendChild(el('p', { class: 'tiny muted', style: { marginTop: '10px' } }, t('msg.help')));

  paint();
  requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
  return root;
}

/* ------------------------------------------------------------------ */

function bubble(ctx, msg) {
  const out = msg.dir === 'out';
  const kindKey = KIND_LABEL[msg.type];

  const body = el('div', { class: 'msg__bubble' },
    !out && kindKey ? el('div', { class: 'msg__kind' }, t(kindKey)) : null,
    ...String(msg.text).split('\n').map((line) => el('p', {}, line || ' ')),
    msg.action && !out
      ? el('div', { style: { marginTop: '10px' } },
          button(actionLabel(msg.action), {
            variant: 'btn--soft btn--sm',
            onClick: () => ctx.applyAction(msg.action),
          }),
        )
      : null,
    el('div', { class: 'msg__meta' }, time(msg.at)),
  );

  return el('div', { class: `msg ${out ? 'msg--out' : 'msg--in'}` },
    el('div', { class: 'msg__av', 'aria-hidden': 'true' }, out ? '🙂' : '🌱'),
    body,
  );
}
