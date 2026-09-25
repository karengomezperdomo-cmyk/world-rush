import type { ServerConfig } from '@worldrush/config';
import { BRAND, type AppEnv } from '@worldrush/shared';

export interface HealthPayload {
  status: 'ok';
  app: string;
  env: AppEnv;
}

/** Public health payload. Deliberately exposes no secrets, no database details and no versions. */
export function buildHealthPayload(config: ServerConfig): HealthPayload {
  return { status: 'ok', app: BRAND.codename, env: config.appEnv };
}
