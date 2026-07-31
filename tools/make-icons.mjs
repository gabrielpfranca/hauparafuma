#!/usr/bin/env node
/**
 * Render the SVG icons to PNG using the Chromium that Playwright provides.
 *
 * PNGs are committed so the app installs correctly without a build step; this
 * script exists to regenerate them when the SVG changes.
 *
 * Usage: node tools/make-icons.mjs
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, '..', 'app', 'icons');

const JOBS = [
  { svg: 'icon.svg', out: 'icon-192.png', size: 192 },
  { svg: 'icon.svg', out: 'icon-512.png', size: 512 },
  { svg: 'icon-maskable.svg', out: 'icon-maskable-512.png', size: 512 },
];

const browser = await chromium.launch();
try {
  for (const job of JOBS) {
    const svg = readFileSync(join(iconsDir, job.svg), 'utf8');
    const page = await browser.newPage({
      viewport: { width: job.size, height: job.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<!doctype html><style>
         html,body{margin:0;padding:0;background:transparent}
         svg{display:block;width:${job.size}px;height:${job.size}px}
       </style>${svg}`,
      { waitUntil: 'load' },
    );
    const buffer = await page.screenshot({ omitBackground: true, type: 'png' });
    writeFileSync(join(iconsDir, job.out), buffer);
    await page.close();
    console.log(`✓ ${job.out} (${job.size}×${job.size}, ${buffer.length} bytes)`);
  }
} finally {
  await browser.close();
}
