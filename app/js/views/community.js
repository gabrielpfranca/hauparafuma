/**
 * KOMUNIDADE — the shared feed. Everyone can post; everyone can reply.
 *
 * Peer support is one of the handbook's message categories, and it is the one
 * thing an app can offer that a one-way SMS programme cannot. The screen is
 * built so the two hardest posts to write — "ha'u fila fali fuma" and "ha'u
 * presiza tulun" — are as easy to send as a celebration: the tag picker offers
 * "Buka tulun" with equal weight to "Konkista".
 *
 * All user text is rendered with textContent via el() — never innerHTML.
 */

import { t } from '../i18n.js';
import * as community from '../community.js';
import { el, clear, card, button, chip, empty, toast, openSheet, avatarColor, initial, callout, multiline, confirmSheet } from '../ui.js';
import { ago } from '../format.js';

const TAG_LABEL = { win: 'com.tag.win', help: 'com.tag.help', tip: 'com.tag.tip' };
const TAG_ICON = { win: '🏆', help: '🙋', tip: '💡' };

export default function renderCommunity(ctx) {
  const root = el('div', { class: 'screen' });
  let filter = 'all';

  root.appendChild(el('header', { class: 'topbar' },
    el('div', { class: 'topbar__title' },
      el('div', { class: 'topbar__eyebrow' }, t('com.sub')),
      el('h1', {}, t('com.title')),
    ),
    button('ℹ️', {
      variant: 'btn--ghost btn--sm',
      'aria-label': t('com.rules.title'),
      onClick: () => openSheet(t('com.rules.title'), () => el('div', {}, ...multiline(t('com.rules')))),
    }),
  ));

  /* ---- composer ---- */
  root.appendChild(composerCard(ctx, () => load()));

  /* ---- mode notice ---- */
  if (community.mode() === 'local') {
    root.appendChild(callout(t('com.local'), 'callout--brand'));
  }

  /* ---- filters ---- */
  const filters = el('div', { class: 'quickbar' });
  const filterDefs = [
    { id: 'all', key: 'com.filter.all' },
    { id: 'win', key: 'com.filter.wins' },
    { id: 'help', key: 'com.filter.help' },
  ];
  const paintFilters = () => {
    clear(filters);
    for (const f of filterDefs) {
      filters.appendChild(chip(t(f.key), {
        pressed: filter === f.id,
        onClick: () => {
          filter = f.id;
          paintFilters();
          paintFeed();
        },
      }));
    }
  };
  paintFilters();
  root.appendChild(filters);

  /* ---- feed ---- */
  const feedHost = el('div', { style: { marginTop: '12px' } });
  root.appendChild(feedHost);

  let posts = [];

  const paintFeed = () => {
    clear(feedHost);
    const shown = filter === 'all' ? posts : posts.filter((p) => p.tag === filter);
    if (!shown.length) {
      feedHost.appendChild(empty('🤝', t('com.empty')));
      return;
    }
    feedHost.appendChild(el('div', { class: 'tiny muted', style: { marginBottom: '8px' } },
      t('com.count', { n: shown.length })));
    for (const post of shown) feedHost.appendChild(postCard(ctx, post, () => load()));
  };

  const load = async () => {
    clear(feedHost);
    feedHost.appendChild(el('p', { class: 'muted center' }, t('loading')));
    await community.sync();
    const res = await community.feed();
    posts = res.posts;
    paintFeed();
    if (res.stale) toast(t('offline'), 'warn');
  };

  load();
  return root;
}

/* ------------------------------------------------------------------ */

function composerCard(ctx, reload) {
  let tag = 'win';

  const input = el('textarea', {
    placeholder: t('com.ph'),
    maxlength: String(community.MAX_POST),
    'aria-label': t('com.ph'),
  });

  const tagRow = el('div', { class: 'pillrow', style: { marginBottom: '10px' } });
  const paintTags = () => {
    clear(tagRow);
    for (const id of community.TAGS) {
      tagRow.appendChild(chip(`${TAG_ICON[id]} ${t(TAG_LABEL[id])}`, {
        pressed: tag === id,
        onClick: () => {
          tag = id;
          paintTags();
        },
      }));
    }
  };
  paintTags();

  const sendBtn = button(t('com.post'), {
    variant: 'btn--block',
    onClick: async () => {
      const text = input.value;
      sendBtn.disabled = true;
      const res = await community.post({ text, tag });
      sendBtn.disabled = false;

      if (!res.ok) {
        toast(reasonText(res), 'warn');
        return;
      }
      input.value = '';
      ctx.celebrate();
      toast(res.queued ? t('com.offline') : t('com.posted'), 'ok');
      reload();
    },
  });

  return card({},
    el('div', { class: 'card__label' }, t('com.tag.pick')),
    tagRow,
    el('div', { class: 'field', style: { marginBottom: '10px' } }, input),
    sendBtn,
  );
}

function reasonText(res) {
  if (res.reason === 'empty') return t('com.empty.text');
  if (res.reason === 'long') return t('com.tooLong', { n: res.max });
  if (res.reason === 'blocked') return t('com.blocked');
  if (res.reason === 'rate') return t('com.rate');
  return t('error');
}

/* ------------------------------------------------------------------ */

function postCard(ctx, post, reload) {
  const s = ctx.store.get();
  const cheered = s.community.reacted.includes(post.id);
  const replies = post.replies || [];

  const repliesHost = el('div', { class: 'replies' });
  let repliesOpen = false;

  const paintReplies = () => {
    clear(repliesHost);
    repliesHost.hidden = !repliesOpen;
    if (!repliesOpen) return;

    for (const r of replies) {
      repliesHost.appendChild(el('div', { class: `reply ${r.pending ? 'pending' : ''}`.trim() },
        el('div', { class: 'reply__name' },
          r.name || 'Belun',
          r.mine ? el('span', { class: 'badge', style: { marginLeft: '6px' } }, t('com.mine')) : null,
        ),
        el('div', {}, r.text),
        el('div', { class: 'tiny muted' }, r.pending ? t('com.pending') : ago(r.at)),
      ));
    }

    const replyInput = el('textarea', {
      rows: '2',
      placeholder: t('com.reply.ph'),
      maxlength: String(community.MAX_REPLY),
      'aria-label': t('com.reply.ph'),
    });
    repliesHost.appendChild(el('div', { style: { marginTop: '8px' } },
      replyInput,
      el('div', { style: { marginTop: '8px' } },
        button(t('send'), {
          variant: 'btn--sm',
          onClick: async () => {
            const res = await community.reply(post.id, replyInput.value);
            if (!res.ok) {
              toast(reasonText(res), 'warn');
              return;
            }
            replyInput.value = '';
            toast(res.queued ? t('com.offline') : t('ok'), 'ok');
            reload();
          },
        }),
      ),
    ));
  };

  paintReplies(); // sets the initial collapsed state

  const cheerBtn = el('button', {
    class: `react ${cheered ? 'react--on' : ''}`.trim(),
    type: 'button',
    onclick: async () => {
      await community.cheer(post.id);
      reload();
    },
  }, '💪', ` ${t('com.cheer')}`, post.cheers ? ` · ${post.cheers}` : '');

  return el('article', { class: `post ${post.pending ? 'pending' : ''}`.trim() },
    el('div', { class: 'post__head' },
      el('div', {
        class: 'post__av',
        'aria-hidden': 'true',
        style: { background: avatarColor(post.seed) },
      }, initial(post.name)),
      el('div', { class: 'post__who' },
        el('div', { class: 'post__name' },
          post.name || 'Belun',
          post.mine ? el('span', { class: 'badge', style: { marginLeft: '6px' } }, t('com.mine')) : null,
        ),
        el('div', { class: 'post__time' },
          post.pending ? t('com.pending') : ago(post.at),
          Number.isFinite(post.days) && post.days > 0 ? ` · ${t('day')} ${post.days}` : '',
        ),
      ),
    ),

    post.tag && post.tag !== 'win'
      ? el('div', { class: 'post__trophy' }, TAG_ICON[post.tag] || '💬', t(TAG_LABEL[post.tag] || 'com.tag.tip'))
      : post.badgeId
        ? el('div', { class: 'post__trophy' }, '🏆', t('com.tag.win'))
        : null,

    el('div', { class: 'post__body' }, post.text),

    el('div', { class: 'post__acts' },
      cheerBtn,
      el('button', {
        class: 'react',
        type: 'button',
        onclick: () => {
          repliesOpen = !repliesOpen;
          paintReplies();
        },
      }, '💬', ` ${t('com.reply')}`, replies.length ? ` · ${replies.length}` : ''),
      el('div', { class: 'spacer' }),
      post.mine ? null : el('button', {
        class: 'react',
        type: 'button',
        'aria-label': t('com.report'),
        onclick: async () => {
          const yes = await confirmSheet(t('com.report'), t('com.report.confirm'), { danger: true });
          if (!yes) return;
          await community.report(post.id);
          toast(t('com.reported'), 'ok');
          reload();
        },
      }, '⚑'),
    ),

    repliesHost,
  );
}
