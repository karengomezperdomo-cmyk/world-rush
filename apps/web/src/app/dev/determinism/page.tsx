import { DeterminismProbe } from './_components/DeterminismProbe';

/**
 * TEMPORARY diagnostic page for decision D2a.
 *
 * `box2d3-wasm` ships two separately compiled binaries — a SIMD "deluxe" one that Node loads and a "compat"
 * one the browser is pinned to — and nothing guarantees they agree bit for bit. Phase 7's whole anti-cheat
 * design rests on the server re-simulating a submitted replay and arriving at the same time the phone did,
 * so a mismatch here means that design cannot work as drawn.
 *
 * This page runs a fixed input sequence against the browser's binary and prints the resulting state, to be
 * compared against the identical run in Node. Delete it once D2a is settled.
 */
export default function DeterminismPage() {
  return <DeterminismProbe />;
}
