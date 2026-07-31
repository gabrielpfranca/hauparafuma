#!/usr/bin/env node
/**
 * Static file server for local development — zero dependencies.
 *
 * A dev server is needed rather than opening index.html directly because ES
 * modules and service workers both require an http(s) origin.
 *
 * Usage: node tools/serve.js [port] [root]
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const ROOT = path.resolve(process.argv[3] || path.join(__dirname, '..', 'app'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (pathname.endsWith('/')) pathname += 'index.html';

  // Resolve inside ROOT only — never serve files outside the app directory.
  const target = path.join(ROOT, path.normalize(pathname));
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      // No caching in dev, so an edit is visible on reload even with a service
      // worker registered.
      'cache-control': 'no-cache, no-store, must-revalidate',
      'service-worker-allowed': '/',
    }).end(data);
  });
}).listen(PORT, () => {
  console.log(`Hau Para Fuma → http://localhost:${PORT}`);
  console.log(`raiz: ${ROOT}`);
});
