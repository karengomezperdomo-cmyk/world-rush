/**
 * World-specific configuration (Mini App app_id, World ID app_id/rp_id, RP signing key). Kept separate from
 * `@worldrush/config`'s `parseServerEnv`: these are missing on purpose until decision D1 is carried out (the
 * owner creates the Developer Portal apps), and their absence should only break the World-specific routes,
 * never the whole server (unlike a coherence failure in APP_ENV/DATABASE_URL, which fails the server closed).
 */

export interface WorldMiniAppConfig {
  miniAppId: string;
}

/** Returns null (never throws) so the client can render a clear "not configured yet" state. */
export function getWorldMiniAppConfig(): WorldMiniAppConfig | null {
  const miniAppId = process.env.NEXT_PUBLIC_WORLD_MINIAPP_ID;
  return miniAppId ? { miniAppId } : null;
}

/**
 * The public World ID app_id the client needs for `<IDKitRequestWidget app_id={...}>`. That prop is typed
 * `` `app_${string}` `` by `@worldcoin/idkit-core` (confirmed against its installed `.d.ts`, 2026-09-24), so
 * this validates the env var's shape instead of asserting it — a malformed value becomes "not configured"
 * rather than a runtime crash deep inside the widget.
 */
export function getWorldIdPublicAppId(): `app_${string}` | undefined {
  const value = process.env.NEXT_PUBLIC_WORLD_ID_APP_ID;
  return value?.startsWith('app_') ? (value as `app_${string}`) : undefined;
}

export interface WorldIdConfig {
  appId: string;
  rpId: string;
  rpSigningKey: string;
}

export class WorldIdNotConfiguredError extends Error {
  constructor() {
    super(
      'World ID is not configured: set NEXT_PUBLIC_WORLD_ID_APP_ID, WORLD_ID_RP_ID and ' +
        'WORLD_ID_RP_SIGNING_KEY (decision D1 — the Developer Portal apps do not exist yet).',
    );
    this.name = 'WorldIdNotConfiguredError';
  }
}

/** Throws WorldIdNotConfiguredError instead of returning partial/undefined config: callers can 503 cleanly. */
export function getWorldIdConfig(): WorldIdConfig {
  const appId = process.env.NEXT_PUBLIC_WORLD_ID_APP_ID;
  const rpId = process.env.WORLD_ID_RP_ID;
  const rpSigningKey = process.env.WORLD_ID_RP_SIGNING_KEY;
  if (!appId || !rpId || !rpSigningKey) throw new WorldIdNotConfiguredError();
  return { appId, rpId, rpSigningKey };
}
