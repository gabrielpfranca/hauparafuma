'use strict';

/**
 * KORREIU — a minimal SMTP client, with no dependencies.
 *
 * The server's promise is that `node server/server.js` runs it, with no npm
 * tree to install. A deployment in a ministry or a clinic may not be able to
 * pull packages at all, so the review digest cannot be the thing that
 * introduces nodemailer. This is the ~150 lines of SMTP that we actually need:
 * implicit TLS (465) or STARTTLS (587), AUTH PLAIN or LOGIN, one plain+HTML
 * message to one recipient.
 *
 * It is deliberately not a general mail library. No attachments, no pooling, no
 * queue. If this ever needs to do more than send one report to one address,
 * reach for a real library instead of growing this file.
 *
 * Config (all via environment):
 *   MAIL_TO      where the report goes            (required)
 *   SMTP_HOST    e.g. smtp.gmail.com              (required)
 *   SMTP_PORT    465 implicit TLS, 587 STARTTLS   (default 587)
 *   SMTP_USER    username                         (required)
 *   SMTP_PASS    password or app password         (required)
 *   MAIL_FROM    From: header                     (default SMTP_USER)
 */

const net = require('node:net');
const tls = require('node:tls');

const HOST = process.env.SMTP_HOST || '';
const PORT = Number(process.env.SMTP_PORT || 587);
const USER = process.env.SMTP_USER || '';
const PASS = process.env.SMTP_PASS || '';
const TO = process.env.MAIL_TO || '';
const FROM = process.env.MAIL_FROM || USER;

/** Can we send at all? Callers check this before building a message. */
function configured() {
  return Boolean(HOST && USER && PASS && TO);
}

/**
 * One SMTP conversation.
 *
 * SMTP is a line protocol where each command waits for a numeric reply, so this
 * is a small state machine over a socket rather than anything clever. Replies
 * can span several lines ("250-STARTTLS" then "250 SIZE"), which is why we wait
 * for a line whose 4th character is a space.
 */
function talk(socket, timeoutMs) {
  let buffer = '';
  let waiter = null;

  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    if (!waiter) return;
    // A complete reply ends with "NNN <text>\r\n" — a space, not a hyphen.
    const m = /^(?:\d{3}-[^\n]*\n)*(\d{3}) [^\n]*\r?\n/.exec(buffer);
    if (!m) return;
    const reply = buffer;
    buffer = '';
    const { resolve, timer } = waiter;
    waiter = null;
    clearTimeout(timer);
    resolve({ code: Number(m[1]), text: reply.trim() });
  });

  return {
    expect() {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiter = null;
          reject(new Error('smtp_timeout'));
        }, timeoutMs);
        waiter = { resolve, timer };
        // The reply may already be sitting in the buffer.
        socket.emit('data', '');
      });
    },
    async cmd(line, ok) {
      socket.write(`${line}\r\n`);
      const reply = await this.expect();
      if (ok && !ok.includes(reply.code)) {
        throw new Error(`smtp ${reply.code}: ${reply.text.slice(0, 120)}`);
      }
      return reply;
    },
  };
}

/** Dot-stuffing and CRLF line endings, per RFC 5321. */
function encodeBody(s) {
  return String(s)
    .replace(/\r?\n/g, '\r\n')
    .replace(/^\./gm, '..');
}

/** Anything non-ASCII in a header has to be encoded; subjects are Tetun. */
function encodeHeader(s) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function buildMessage({ subject, text, html }) {
  const boundary = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return [
    `From: ${FROM}`,
    `To: ${TO}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

/**
 * Send one message. Rejects on any failure — the caller keeps the batch and
 * retries later rather than marking it reported.
 */
async function send({ subject, text, html }, { timeout = 20000 } = {}) {
  if (!configured()) throw new Error('smtp_not_configured');

  const implicit = PORT === 465;
  let socket = implicit
    ? tls.connect({ host: HOST, port: PORT, servername: HOST })
    : net.connect({ host: HOST, port: PORT });

  const connected = new Promise((resolve, reject) => {
    socket.once(implicit ? 'secureConnect' : 'connect', resolve);
    socket.once('error', reject);
  });

  try {
    await connected;
    socket.setTimeout(timeout);

    let smtp = talk(socket, timeout);
    await smtp.expect();                       // 220 greeting
    const greeting = await smtp.cmd(`EHLO ${hostname()}`, [250]);

    if (!implicit) {
      // Never authenticate in the clear. If the server will not upgrade, stop
      // here and say so plainly rather than leaking the password to find out.
      if (!/STARTTLS/i.test(greeting.text)) {
        throw new Error(`smtp_no_starttls: ${HOST}:${PORT} la oferese STARTTLS — uza porta 465 ka servidór seluk`);
      }
      await smtp.cmd('STARTTLS', [220]);
      socket = tls.connect({ socket, servername: HOST });
      await new Promise((resolve, reject) => {
        socket.once('secureConnect', resolve);
        socket.once('error', reject);
      });
      socket.setTimeout(timeout);
      smtp = talk(socket, timeout);
      await smtp.cmd(`EHLO ${hostname()}`, [250]);
    }

    // AUTH PLAIN is one round trip; fall back to LOGIN for servers without it.
    const plain = Buffer.from(`\0${USER}\0${PASS}`, 'utf8').toString('base64');
    try {
      await smtp.cmd(`AUTH PLAIN ${plain}`, [235]);
    } catch {
      await smtp.cmd('AUTH LOGIN', [334]);
      await smtp.cmd(Buffer.from(USER, 'utf8').toString('base64'), [334]);
      await smtp.cmd(Buffer.from(PASS, 'utf8').toString('base64'), [235]);
    }

    await smtp.cmd(`MAIL FROM:<${addr(FROM)}>`, [250]);
    await smtp.cmd(`RCPT TO:<${addr(TO)}>`, [250, 251]);
    await smtp.cmd('DATA', [354]);
    socket.write(encodeBody(buildMessage({ subject, text, html })));
    await smtp.cmd('\r\n.', [250]);
    try { await smtp.cmd('QUIT', [221]); } catch { /* closing is not a failure */ }
    return true;
  } finally {
    socket.destroy();
  }
}

/** Bare address out of "Name <a@b>". */
function addr(s) {
  const m = /<([^>]+)>/.exec(String(s));
  return (m ? m[1] : String(s)).trim();
}

function hostname() {
  try {
    return require('node:os').hostname() || 'localhost';
  } catch {
    return 'localhost';
  }
}

module.exports = { configured, send, buildMessage };
