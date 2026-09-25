import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { SECRET_LIKE_NAME as configPattern } from '../packages/config/src/guards';
import { RULES, scanRepo as scanApis, scanSource } from './check-forbidden-apis.mjs';
import {
  findPublicEnvViolations,
  findSecretLiterals,
  isForbiddenEnvFile,
  scanRepo as scanEnv,
  SECRET_LIKE_NAME as scriptPattern,
} from './check-public-env.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const tmpDirs: string[] = [];

/** Creates a throw-away (non-git) repository so the directory-walk fallback is exercised too. */
function tempRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'wr-guard-'));
  tmpDirs.push(dir);
  for (const [relative, content] of Object.entries(files)) {
    const full = join(dir, relative);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('check-forbidden-apis', () => {
  it.each([
    ['minikit-pay', 'await MiniKit.pay({ reference });'],
    ['minikit-send-transaction', 'await MiniKit.sendTransaction({ chainId: 480 });'],
    ['minikit-sign', 'await MiniKit.signMessage({ message });'],
    ['minikit-sign', 'await MiniKit.signTypedData(payload);'],
    ['minikit-request-permission', 'await MiniKit.requestPermission({ permission });'],
    ['minikit-1x-api', 'await MiniKit.commandsAsync.walletAuth(input);'],
    ['minikit-1x-api', 'MiniKit.commands.signMessage(input);'],
    ['minikit-verify-removed', 'await MiniKit.verify(input);'],
    ['idkit-standalone', "import { IDKit } from '@worldcoin/idkit-standalone';"],
    ['window-open', "window.open('https://example.com');"],
  ])('flags %s: %s', (rule, code) => {
    expect(scanSource(code, 'apps/web/src/x.ts').map((v: { rule: string }) => v.rule)).toContain(
      rule,
    );
  });

  it('allows the commands the project uses', () => {
    const code = [
      'await MiniKit.walletAuth({ nonce });',
      "await MiniKit.sendHapticFeedback({ hapticsType: 'impact', style: 'light' });",
      'await MiniKit.getPermissions();',
      'MiniKit.isInstalled();',
    ].join('\n');
    expect(scanSource(code, 'apps/web/src/x.ts')).toEqual([]);
  });

  it('ignores comment lines that merely mention a forbidden API', () => {
    const code = [
      '// MiniKit.pay is not allowed yet',
      ' * MiniKit.sendTransaction',
      '/* MiniKit.verify */',
    ];
    expect(scanSource(code.join('\n'), 'apps/web/src/x.ts')).toEqual([]);
  });

  it('honours an explicit per-rule guard:allow marker on the same line', () => {
    const allowed = 'await MiniKit.pay(x); // guard:allow minikit-pay (approved 2030-01-01)';
    expect(scanSource(allowed, 'apps/web/src/x.ts')).toEqual([]);
    const wrongRule = 'await MiniKit.pay(x); // guard:allow minikit-sign (approved)';
    expect(scanSource(wrongRule, 'apps/web/src/x.ts')).toHaveLength(1);
  });

  it('reports the file and line', () => {
    const [violation] = scanSource('const a = 1;\nawait MiniKit.pay(x);', 'apps/web/src/x.ts');
    expect(violation).toMatchObject({ file: 'apps/web/src/x.ts', line: 2, rule: 'minikit-pay' });
  });

  it('scans app/package sources but not tests or other folders', () => {
    const dir = tempRepo({
      'apps/web/src/bad.ts': 'await MiniKit.pay(x);',
      'packages/game-core/src/bad.tsx': 'window.open("x");',
      'packages/shared/src/bad.test.ts': 'await MiniKit.pay(x);',
      'docs/bad.ts': 'await MiniKit.pay(x);',
      'apps/web/src/ok.ts': 'export const ok = 1;',
    });
    const files = scanApis(dir)
      .map((v: { file: string }) => v.file)
      .sort();
    expect(files).toEqual(['apps/web/src/bad.ts', 'packages/game-core/src/bad.tsx']);
  });

  it('has a unique id and message for every rule', () => {
    expect(new Set(RULES.map((rule: { id: string }) => rule.id)).size).toBe(RULES.length);
    for (const rule of RULES) expect(rule.message.length).toBeGreaterThan(10);
  });

  it('the real repository is clean', () => {
    expect(scanApis(repoRoot)).toEqual([]);
  });
});

describe('check-public-env', () => {
  it('flags secret-like NEXT_PUBLIC_* names in code', () => {
    const violations = findPublicEnvViolations(
      'const k = process.env.NEXT_PUBLIC_RP_SIGNING_KEY;\nconst ok = process.env.NEXT_PUBLIC_APP_ENV;',
      'apps/web/src/x.ts',
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ line: 1, rule: 'secret-like-public-env' });
  });

  it('keeps its secret-name pattern identical to packages/config (single definition of "secret-like")', () => {
    expect(scriptPattern.source).toBe(configPattern.source);
    expect(scriptPattern.flags).toBe(configPattern.flags);
  });

  it('detects secret literals without echoing them', () => {
    const privateKey = ['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' ');
    const portalKey = `api_${'A'.repeat(30)}`;
    const dbUrl = ['postgres://user', 'hunter2@db.example.com/app'].join(':');
    const rules = (text: string) =>
      findSecretLiterals(text, 'x.md').map((v: { rule: string }) => v.rule);
    expect(rules(privateKey)).toEqual(['private-key-block']);
    expect(rules(`key = ${portalKey}`)).toEqual(['world-portal-api-key']);
    expect(rules(`url = ${dbUrl}`)).toEqual(['url-with-credentials']);
    for (const violation of findSecretLiterals(`${privateKey}\n${portalKey}\n${dbUrl}`, 'x.md')) {
      expect(JSON.stringify(violation)).not.toContain('hunter2');
      expect(JSON.stringify(violation)).not.toContain(portalKey);
    }
  });

  it('does not flag placeholders, short tokens or URLs without a password', () => {
    const text = [
      'Authorization: Bearer api_...',
      'postgres://app@db.example.com:5432/app',
      'https://example.com/path',
      'api_short',
    ].join('\n');
    expect(findSecretLiterals(text, 'x.md')).toEqual([]);
  });

  it('honours guard:allow markers for fake fixtures', () => {
    const line = `const url = '${['postgres://u', 'p@h/db'].join(':')}'; // guard:allow url-with-credentials (fake)`;
    expect(findSecretLiterals(line, 'x.test.ts')).toEqual([]);
  });

  it.each([
    ['.env', true],
    ['.env.local', true],
    ['.env.production', true],
    ['apps/web/.env.development', true],
    ['.env.example', false],
    ['apps/web/.env.example', false],
    ['environment.ts', false],
    ['docs/env.md', false],
  ])('isForbiddenEnvFile(%s) = %s', (file, expected) => {
    expect(isForbiddenEnvFile(file)).toBe(expected);
  });

  it('scans a repository end to end', () => {
    const dir = tempRepo({
      '.env': 'APP_ENV=production',
      '.env.example': 'NEXT_PUBLIC_SESSION_SECRET=nope',
      'apps/web/src/leak.ts': 'export const k = process.env.NEXT_PUBLIC_API_KEY;',
      'apps/web/src/leak.test.ts': 'export const k = "NEXT_PUBLIC_API_KEY"; // tests may name it',
      'docs/notes.md': 'Never use NEXT_PUBLIC_API_KEY or similar.',
      'README.md': `db = ${['postgres://user', 'pass@host/db'].join(':')}`,
      'apps/web/src/fine.ts': 'export const fine = process.env.NEXT_PUBLIC_APP_ENV;',
    });
    const found = scanEnv(dir)
      .map((v: { file: string; rule: string }) => `${v.file}|${v.rule}`)
      .sort();
    expect(found).toEqual([
      '.env.example|secret-like-public-env',
      '.env|committed-env-file',
      'README.md|url-with-credentials',
      'apps/web/src/leak.ts|secret-like-public-env',
    ]);
  });

  it('the real repository is clean', () => {
    expect(scanEnv(repoRoot)).toEqual([]);
  });
});
