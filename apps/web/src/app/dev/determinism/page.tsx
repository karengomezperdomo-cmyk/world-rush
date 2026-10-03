import { notFound } from 'next/navigation';
import { getServerConfig } from '../../../lib/server-env';
import { DeterminismProbe } from './_components/DeterminismProbe';

// Decided at request time, because whether this page exists depends on which environment is serving it.
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY diagnostic page for decision D2a.
 *
 * `box2d3-wasm` ships two separately compiled binaries — a SIMD "deluxe" one that Node loads and a "compat"
 * one the browser is pinned to — and nothing guarantees they agree bit for bit. Phase 7's whole anti-cheat
 * design rests on the server re-simulating a submitted replay and arriving at the same time the phone did,
 * so a mismatch here means that design cannot work as drawn.
 *
 * This page runs a fixed input sequence against the browser's binary and prints the resulting state, to be
 * compared against the identical run in Node.
 *
 * ## Why it still exists, and why production cannot see it
 *
 * Its own instruction used to be "delete once D2a is settled", and D2a is settled (§1m). It is kept anyway
 * because **D2b2 is not**: the desktop comparison was x86 against x86, a phone is ARM, and re-running the
 * browser half there needs this page on a URL a phone can open — which rules out localhost.
 *
 * So it is served everywhere except production. Staging keeps the instrument needed to close D2b2;
 * production, the build players actually use, 404s. World's review guidelines ask for a finished app rather
 * than one with diagnostics wired into it, and a page that re-simulates physics on demand is exactly that.
 */
export default function DeterminismPage() {
  if (getServerConfig().appEnv === 'production') notFound();
  return <DeterminismProbe />;
}
