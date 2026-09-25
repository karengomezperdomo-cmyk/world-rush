/**
 * Runs once when the server starts (not during `next build`). An incoherent environment (for example a
 * preview deployment configured as production, or production without a hosted database) throws HERE.
 * Next.js then logs "Failed to prepare server" naming the offending variables and answers HTTP 500 to
 * EVERY request (verified on the production server), so the app fails closed instead of serving.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { getServerConfig } = await import('./lib/server-env');
  getServerConfig();
}
