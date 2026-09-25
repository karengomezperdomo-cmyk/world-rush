#!/usr/bin/env node
/**
 * Renders every mockup in design/screens/*.html to design/screens/png/*.png (390x844 CSS px, @2x) using the
 * Microsoft Edge that ships with Windows (no browser download). Usage:
 *   node tools/design/render.mjs            -> all screens
 *   node tools/design/render.mjs home       -> only design/screens/home.html
 */
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startStaticServer } from './static-server.mjs';

const root = fileURLToPath(new URL('../../design/', import.meta.url));
const candidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean);
const executablePath = candidates.find((path) => existsSync(path));
if (!executablePath) throw new Error('No Chromium-based browser found. Set BROWSER_PATH.');

// screens that also get an annotated copy (<name>-zones.png) rendered with ?zones: reserved corner, safe areas, thumb reach
const ANNOTATED = new Set(['gameplay-a', 'gameplay-b']);
const wanted = process.argv.slice(2);
const screens = readdirSync(`${root}screens`)
  .filter((file) => file.endsWith('.html'))
  .map((file) => file.replace(/\.html$/, ''))
  .filter((name) => wanted.length === 0 || wanted.includes(name));

const { server, port } = await startStaticServer(root);
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  for (const name of screens) {
    const variants = ANNOTATED.has(name) ? [['', name], ['?zones', `${name}-zones`]] : [['', name]];
    for (const [query, out] of variants) {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${port}/screens/${name}.html${query}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() =>
        Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((ok) => (img.onload = img.onerror = ok))))),
      );
      await page.screenshot({ path: `${root}screens/png/${out}.png`, clip: { x: 0, y: 0, width: 390, height: 844 } });
      await page.close();
      console.log(`rendered ${out}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
