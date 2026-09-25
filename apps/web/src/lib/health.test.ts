import { parseServerEnv } from '@worldrush/config';
import { describe, expect, it } from 'vitest';
import { buildHealthPayload } from './health';

describe('buildHealthPayload', () => {
  it('reports the environment and nothing else', () => {
    const config = parseServerEnv({
      APP_ENV: 'development',
      NEXT_PUBLIC_APP_ENV: 'development',
      DATABASE_URL: 'pglite://memory',
      RANKED_ENABLED: 'true',
    });
    const payload = buildHealthPayload(config);
    expect(payload).toEqual({ status: 'ok', app: 'world-rush', env: 'development' });
    expect(JSON.stringify(payload)).not.toContain('pglite');
    expect(Object.keys(payload).sort()).toEqual(['app', 'env', 'status']);
  });
});
