#!/usr/bin/env node
/**
 * Keeps secrets out of the browser bundle and out of the repository:
 *  - no secret-like NEXT_PUBLIC_* variable names (they are inlined into client code),
 *  - no committed .env files (only .env.example is tracked),
 *  - no obvious secret literals (private key blocks, World Developer Portal API keys, URLs with credentials).
 *
 * Fake fixtures in tests can be allowed on the SAME line with:  // guard:allow <rule-id> (reason)
 */
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTestFile, listRepoFiles } from './lib/repo-files.mjs';

/** Keep identical to SECRET_LIKE_NAME in packages/config/src/guards.ts (a test enforces it). */
export const SECRET_LIKE_NAME =
  /(SECRET|PRIVATE|SIGNING|API_?KEY|PASSWORD|PASSWD|TOKEN|DATABASE|CREDENTIAL|HMAC)/i;

export const SECRET_LITERALS = [
  {
    id: 'private-key-block',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    message: 'A private key block must never be committed.',
  },
  {
    id: 'world-portal-api-key',
    pattern: /\bapi_[A-Za-z0-9+/=]{24,}/,
    message: 'This looks like a World Developer Portal API key.',
  },
  {
    id: 'url-with-credentials',
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@[^\s/]+/i,
    message: 'A URL with embedded credentials must never be committed.',
  },
];

const BINARY_OR_GENERATED = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.ico',
  '.wasm',
  '.ogg',
  '.mp3',
  '.m4a',
  '.woff',
  '.woff2',
]);
const CODE_OR_CONFIG = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
]);

function allowedRules(line) {
  return new Set([...line.matchAll(/guard:allow\s+([a-z0-9-]+)/g)].map((m) => m[1]));
}

export function findPublicEnvViolations(text, file) {
  const violations = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const allowed = allowedRules(line);
    if (allowed.has('secret-like-public-env')) return;
    for (const match of line.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
      if (SECRET_LIKE_NAME.test(match[0])) {
        violations.push({
          file,
          line: index + 1,
          rule: 'secret-like-public-env',
          message: `${match[0]}: NEXT_PUBLIC_* values are shipped to the browser; secret-like names are not allowed.`,
        });
      }
    }
  });
  return violations;
}

export function findSecretLiterals(text, file) {
  const violations = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const allowed = allowedRules(line);
    for (const rule of SECRET_LITERALS) {
      if (!allowed.has(rule.id) && rule.pattern.test(line)) {
        violations.push({ file, line: index + 1, rule: rule.id, message: rule.message });
      }
    }
  });
  return violations;
}

export function isForbiddenEnvFile(file) {
  const base = file.split('/').pop() ?? '';
  return /^\.env(\..+)?$/.test(base) && base !== '.env.example';
}

export function scanRepo(cwd = process.cwd()) {
  const violations = [];
  for (const file of listRepoFiles(cwd)) {
    if (isForbiddenEnvFile(file)) {
      violations.push({
        file,
        line: 0,
        rule: 'committed-env-file',
        message: 'Environment files must not be committed. Only .env.example is allowed.',
      });
      continue;
    }
    const ext = extname(file).toLowerCase();
    if (BINARY_OR_GENERATED.has(ext) || file.endsWith('pnpm-lock.yaml')) continue;
    let text;
    try {
      text = readFileSync(resolve(cwd, file), 'utf8');
    } catch {
      continue; // unreadable or deleted between listing and reading
    }
    violations.push(...findSecretLiterals(text, file));
    // NEXT_PUBLIC_* names are only meaningful in code/config files (docs may mention them in prose).
    const isEnvExample = file.endsWith('.env.example');
    if ((CODE_OR_CONFIG.has(ext) && !isTestFile(file)) || isEnvExample) {
      violations.push(...findPublicEnvViolations(text, file));
    }
  }
  return violations;
}

function main() {
  const violations = scanRepo();
  if (violations.length === 0) {
    console.log('check-public-env: OK');
    return;
  }
  for (const v of violations) console.error(`${v.file}:${v.line} [${v.rule}] ${v.message}`);
  console.error(`check-public-env: ${violations.length} violation(s)`);
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
