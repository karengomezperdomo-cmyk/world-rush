#!/usr/bin/env node
/**
 * Enforces project rules that have no TypeScript/ESLint equivalent (docs/DECISIONS.md, D3):
 * no wallet-spend / permission requests without explicit approval, and no deprecated or removed World APIs.
 *
 * To record an approved exception, put a marker on the SAME line:
 *   // guard:allow minikit-pay (approved by the owner on YYYY-MM-DD, see docs/DECISIONS.md)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTestFile, listRepoFiles } from './lib/repo-files.mjs';

export const RULES = [
  {
    id: 'minikit-pay',
    pattern: /\bMiniKit\s*\.\s*pay\s*\(/,
    message: 'MiniKit.pay is not allowed until payments are explicitly approved (decision D3).',
  },
  {
    id: 'minikit-send-transaction',
    pattern: /\bMiniKit\s*\.\s*sendTransaction\s*\(/,
    message:
      'MiniKit.sendTransaction is not allowed until transactions are explicitly approved (decision D3).',
  },
  {
    id: 'minikit-sign',
    pattern: /\bMiniKit\s*\.\s*(signMessage|signTypedData)\s*\(/,
    message:
      'Wallet signing beyond walletAuth is not allowed without explicit approval (decision D3).',
  },
  {
    id: 'minikit-request-permission',
    pattern: /\bMiniKit\s*\.\s*requestPermission\s*\(/,
    message:
      'Requesting permissions (notifications, contacts, microphone) is not allowed without explicit approval (decision D3).',
  },
  {
    id: 'minikit-1x-api',
    pattern: /\bcommandsAsync\b|\bMiniKit\s*\.\s*commands\b/,
    message:
      'MiniKit 1.x API. Use the MiniKit 2.x async methods (docs/phase-0/01-world-docs-review.md).',
  },
  {
    id: 'minikit-verify-removed',
    pattern: /\bMiniKit\s*\.\s*verify\s*\(/,
    message: 'MiniKit.verify was removed in MiniKit 2.x. Use IDKit.',
  },
  {
    id: 'idkit-standalone',
    pattern: /@worldcoin\/idkit-standalone/,
    message:
      '@worldcoin/idkit-standalone is deprecated. Use @worldcoin/idkit or @worldcoin/idkit-core.',
  },
  {
    id: 'window-open',
    pattern: /\bwindow\s*\.\s*open\s*\(/,
    message: 'Opening new windows is not allowed in the World App WebView.',
  },
];

const SOURCE_FILE = /^(apps|packages)\/[^/]+\/src\/.*\.(ts|tsx|js|jsx|mjs)$/;

export function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

export function scanSource(text, file) {
  const violations = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (isCommentLine(line)) return;
    const allowed = new Set([...line.matchAll(/guard:allow\s+([a-z0-9-]+)/g)].map((m) => m[1]));
    for (const rule of RULES) {
      if (allowed.has(rule.id)) continue;
      if (rule.pattern.test(line)) {
        violations.push({ file, line: index + 1, rule: rule.id, message: rule.message });
      }
    }
  });
  return violations;
}

export function scanRepo(cwd = process.cwd()) {
  const violations = [];
  for (const file of listRepoFiles(cwd)) {
    if (!SOURCE_FILE.test(file) || isTestFile(file)) continue;
    violations.push(...scanSource(readFileSync(resolve(cwd, file), 'utf8'), file));
  }
  return violations;
}

function main() {
  const violations = scanRepo();
  if (violations.length === 0) {
    console.log('check-forbidden-apis: OK');
    return;
  }
  for (const v of violations) console.error(`${v.file}:${v.line} [${v.rule}] ${v.message}`);
  console.error(`check-forbidden-apis: ${violations.length} violation(s)`);
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
