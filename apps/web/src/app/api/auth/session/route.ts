import { getCurrentSession } from '../../../../lib/session-cookie';

// Reflects live session state: never cached.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await getCurrentSession();
  const headers = { 'Cache-Control': 'no-store' };
  if (!session) return Response.json({ authenticated: false }, { headers });
  // The wallet address is deliberately NOT returned. It is the player's own, but nothing on any screen uses
  // it — World's guidelines say to show usernames, not addresses — so sending it to the browser only creates
  // a copy of an identifier in a place (memory, logs, a screenshot, a shared device) that gains nothing.
  return Response.json(
    {
      authenticated: true,
      userId: session.userId,
      username: session.username,
      humanVerified: session.humanVerifiedAt !== null,
    },
    { headers },
  );
}
