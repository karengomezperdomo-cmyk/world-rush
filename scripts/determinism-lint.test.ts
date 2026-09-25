import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Proves that the determinism rules of eslint.config.mjs are ACTIVE for packages/game-core, so a future
 * change cannot silently reintroduce host-dependent math/time into the simulation.
 * (Lives in scripts/ because it needs Node types, which game-core itself must never see.)
 */
const root = fileURLToPath(new URL('../', import.meta.url));
const gameCoreFile = `${root}packages/game-core/src/example.ts`;
let eslint: ESLint;

async function ruleIdsFor(code: string, filePath = gameCoreFile): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((message) => message.ruleId ?? 'parse-error');
}

describe('game-core determinism lint', () => {
  beforeAll(() => {
    eslint = new ESLint({ cwd: root });
  });

  it.each([
    'export const a = Math.sin(1);',
    'export const a = Math.cos(1);',
    'export const a = Math.atan2(1, 2);',
    'export const a = Math.random();',
    'export const a = Math.pow(2, 3);',
    'export const a = Math.hypot(3, 4);',
  ])('rejects engine-dependent math: %s', async (code) => {
    expect(await ruleIdsFor(code)).toContain('no-restricted-properties');
  });

  it('rejects the ** operator (maps to Math.pow)', async () => {
    expect(await ruleIdsFor('export const a = 2 ** 3;')).toContain('no-restricted-syntax');
  });

  it.each([
    'export const t = Date.now();',
    'export const t = new Date();',
    'export const t = performance.now();',
    'export const w = window;',
  ])('rejects host time/environment access: %s', async (code) => {
    expect(await ruleIdsFor(code)).toContain('no-restricted-globals');
  });

  it('rejects framework, server and Node imports', async () => {
    expect(
      await ruleIdsFor("import { useState } from 'react';\nexport const a = useState;"),
    ).toContain('no-restricted-imports');
    expect(await ruleIdsFor("import { db } from '@worldrush/db';\nexport const a = db;")).toContain(
      'no-restricted-imports',
    );
    expect(await ruleIdsFor("import fs from 'node:fs';\nexport const a = fs;")).toContain(
      'no-restricted-imports',
    );
  });

  it('allows IEEE-754 exact operations', async () => {
    expect(
      await ruleIdsFor('export const a = (x: number) => Math.sqrt(x * x + 1) / 2 - Math.floor(x);'),
    ).toEqual([]);
  });

  it('does not apply the determinism rules outside game-core', async () => {
    expect(
      await ruleIdsFor('export const a = Math.random();', `${root}packages/shared/src/example.ts`),
    ).toEqual([]);
  });
});
