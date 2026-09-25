#!/usr/bin/env node
/**
 * Screenshot any page under design/ at a chosen size (handy for zooming into details).
 *   node tools/design/shot.mjs <path-under-design> <out.png> [width=390] [height=844] [scale=2] [scrollY=0]
 * Example: node tools/design/shot.mjs screens/finish.html out.png 390 400 4
 * Use height "full" to capture the whole page.
 */
import { existsSync } from 'node:fs';
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

const [target, out, width = '390', height = '844', scale = '2', scrollY = '0'] = process.argv.slice(2);
const fullPage = height === 'full';
if (!target || !out) throw new Error('usage: shot.mjs <path-under-design> <out.png> [width] [height] [scale]');

const { server, port } = await startStaticServer(root);
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: Number(width), height: fullPage ? 900 : Number(height) },
    deviceScaleFactor: Number(scale),
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/${target}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  if (Number(scrollY) > 0) await page.evaluate((y) => window.scrollTo(0, y), Number(scrollY));
  await page.screenshot({ path: out, fullPage });
  console.log(`saved ${out}`);
} finally {
  await browser.close();
  server.close();
}
