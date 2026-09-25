import { parseServerEnv, type ServerConfig } from '@worldrush/config';

let cached: ServerConfig | undefined;

/** Validated, memoized server configuration. Server-side only: never import this from a client component. */
export function getServerConfig(): ServerConfig {
  cached ??= parseServerEnv(process.env);
  return cached;
}
