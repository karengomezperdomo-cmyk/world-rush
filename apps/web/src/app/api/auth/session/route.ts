import { getCurrentSession } from '../../../../lib/session-cookie';

// Reflects live session state: never cached.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await getCurrentSession();
  const headers = { 'Cache-Control': 'no-store' };
  if (!session) return Response.json({ authenticated: false }, { headers });
  return Response.json(
    {
      authenticated: true,
      userId: session.userId,
      walletAddress: session.walletAddress,
      username: session.username,
      humanVerified: session.humanVerifiedAt !== null,
    },
    { headers },
  );
}
