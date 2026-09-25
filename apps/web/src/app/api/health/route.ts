import { buildHealthPayload } from '../../../lib/health';
import { getServerConfig } from '../../../lib/server-env';

// Never cached: this endpoint reflects the live server configuration.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    return Response.json(buildHealthPayload(getServerConfig()), { headers });
  } catch (error) {
    // The message only names variables, never their values.
    console.error(
      '[health] invalid server environment:',
      error instanceof Error ? error.message : error,
    );
    return Response.json({ status: 'error' }, { status: 500, headers });
  }
}
