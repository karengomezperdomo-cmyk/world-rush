import { createBikeSimulation, TICK_SECONDS } from './bike-sim';
import { INPUT, type InputMask } from './inputs';
import type { Level } from './level';
import type { PhysicsEngine } from './physics-engine';

/**
 * Replays: the inputs a player pressed, recorded tick by tick, so the SERVER can re-run the race and decide
 * the time itself.
 *
 * This is the whole anti-cheat. The client never gets to assert how fast it went — it submits what it
 * pressed, the server simulates those presses with this same deterministic engine, and the time the server
 * computes is the only one that counts. A tampered replay does not produce a faster time; it produces a
 * different race, usually one that crashes.
 *
 * It only works because the simulation is reproducible to the bit, which was measured rather than assumed
 * (see `determinism.test.ts` and docs/DECISIONS.md §1m).
 *
 * ## Format
 *
 * Run-length encoded, because a player holds a button for many ticks at a time and storing 3600 separate
 * bytes for a one-minute run would be mostly repetition. All integers little-endian.
 *
 * ```
 *  0..3   magic 'R7RP'
 *  4      format version
 *  5      level id length in bytes
 *  6..    level id, ASCII
 *  +0..3  tick count, uint32
 *  then   entries of [mask uint8][run length uint16], repeated to the end
 * ```
 *
 * The level id travels INSIDE the blob rather than only in the database row, so a replay cannot be verified
 * against a different map than the one it was recorded on — and because the hash of the blob then covers it.
 */

export const REPLAY_MAGIC = [0x52, 0x37, 0x52, 0x50] as const; // 'R7RP'
export const REPLAY_FORMAT_VERSION = 1;

/** Every bit the input mask is allowed to use. Anything else means a corrupted or hand-made replay. */
const VALID_INPUT_BITS = INPUT.GAS | INPUT.BRAKE | INPUT.LEAN_BACK | INPUT.LEAN_FORWARD;

/**
 * Longest replay the decoder will accept, about ten minutes.
 *
 * This is a denial-of-service guard, not a gameplay rule: without it a submission could claim four billion
 * ticks and the server would dutifully try to simulate them. Every map is finishable in well under a minute
 * and the client gives up long before this.
 */
export const MAX_REPLAY_TICKS = 60 * 60 * 10;

/** One run of identical input: `mask` held for `length` ticks. */
interface ReplayEntry {
  readonly mask: InputMask;
  readonly length: number;
}

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayError';
  }
}

/** ASCII only: level ids are lowercase slugs, and avoiding TextEncoder keeps this free of host globals. */
function encodeAscii(value: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0x7f) throw new ReplayError(`level id must be ASCII: ${value}`);
    bytes.push(code);
  }
  return bytes;
}

function decodeAscii(bytes: Uint8Array, start: number, length: number): string {
  let value = '';
  for (let i = 0; i < length; i++) value += String.fromCharCode(bytes[start + i]!);
  return value;
}

/**
 * Collects the inputs of a run as it is played.
 *
 * Fed one mask per simulation tick, in order. It must be driven from the SIMULATION loop and not from the
 * render loop: the two run at different rates, and a replay that does not have exactly one entry per tick
 * will not reproduce the run.
 */
export class ReplayRecorder {
  private readonly entries: { mask: InputMask; length: number }[] = [];
  private tickCount = 0;

  constructor(private readonly levelId: string) {}

  record(mask: InputMask): void {
    const masked = (mask & VALID_INPUT_BITS) as InputMask;
    this.tickCount += 1;
    const last = this.entries[this.entries.length - 1];
    // Extend the current run, unless it would overflow the 16-bit length field.
    if (last && last.mask === masked && last.length < 0xffff) {
      last.length += 1;
      return;
    }
    this.entries.push({ mask: masked, length: 1 });
  }

  get ticks(): number {
    return this.tickCount;
  }

  encode(): Uint8Array {
    return encodeReplay(this.levelId, this.entries);
  }
}

export function encodeReplay(levelId: string, entries: readonly ReplayEntry[]): Uint8Array {
  const id = encodeAscii(levelId);
  if (id.length > 0xff) throw new ReplayError('level id is too long to encode');
  const ticks = entries.reduce((total, entry) => total + entry.length, 0);
  if (ticks > MAX_REPLAY_TICKS) throw new ReplayError(`replay is too long: ${ticks} ticks`);

  const bytes = new Uint8Array(4 + 1 + 1 + id.length + 4 + entries.length * 3);
  const view = new DataView(bytes.buffer);
  bytes.set(REPLAY_MAGIC, 0);
  bytes[4] = REPLAY_FORMAT_VERSION;
  bytes[5] = id.length;
  bytes.set(id, 6);

  let offset = 6 + id.length;
  view.setUint32(offset, ticks, true);
  offset += 4;
  for (const entry of entries) {
    bytes[offset] = entry.mask & VALID_INPUT_BITS;
    view.setUint16(offset + 1, entry.length, true);
    offset += 3;
  }
  return bytes;
}

export interface DecodedReplay {
  readonly levelId: string;
  readonly ticks: number;
  readonly entries: readonly ReplayEntry[];
}

/**
 * Turns bytes back into inputs, rejecting anything malformed.
 *
 * Every check here exists because this parses data a player sent us. It must never throw something other
 * than `ReplayError`, never allocate based on an unchecked length, and never hand the simulation a mask with
 * bits it does not understand.
 */
export function decodeReplay(bytes: Uint8Array): DecodedReplay {
  if (bytes.length < 11) throw new ReplayError('replay is too short to be valid');
  for (let i = 0; i < REPLAY_MAGIC.length; i++) {
    if (bytes[i] !== REPLAY_MAGIC[i]) throw new ReplayError('not a replay: bad magic');
  }
  const version = bytes[4]!;
  if (version !== REPLAY_FORMAT_VERSION) {
    throw new ReplayError(`unsupported replay version ${version}`);
  }

  const idLength = bytes[5]!;
  if (bytes.length < 6 + idLength + 4) throw new ReplayError('replay header is truncated');
  const levelId = decodeAscii(bytes, 6, idLength);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 6 + idLength;
  const ticks = view.getUint32(offset, true);
  offset += 4;
  if (ticks > MAX_REPLAY_TICKS) throw new ReplayError(`replay claims too many ticks: ${ticks}`);

  const body = bytes.length - offset;
  if (body % 3 !== 0) throw new ReplayError('replay body is not a whole number of entries');

  const entries: ReplayEntry[] = [];
  let counted = 0;
  for (let i = 0; i < body / 3; i++) {
    const mask = bytes[offset]!;
    if ((mask & ~VALID_INPUT_BITS) !== 0)
      throw new ReplayError(`replay uses unknown input bits: ${mask}`);
    const length = view.getUint16(offset + 1, true);
    if (length === 0) throw new ReplayError('replay contains a zero-length entry');
    entries.push({ mask: mask as InputMask, length });
    counted += length;
    offset += 3;
  }

  // The declared tick count and the entries must agree, or the file is lying about one of them.
  if (counted !== ticks) {
    throw new ReplayError(`replay declares ${ticks} ticks but its entries total ${counted}`);
  }
  return { levelId, ticks, entries };
}

export interface ReplayOutcome {
  readonly finished: boolean;
  /** Ticks at the finish line, or null if the run never finished. This is the authoritative time. */
  readonly finishTick: number | null;
  readonly durationMs: number | null;
  readonly ticksSimulated: number;
  readonly crashes: number;
  readonly furthestX: number;
}

/**
 * Re-runs a replay and reports what ACTUALLY happened — the server's answer, not the client's claim.
 *
 * Returns an outcome rather than throwing when a run does not finish: "this replay does not reach the line"
 * is a verdict about a submission, not an error in the program.
 */
export function simulateReplay(
  engine: PhysicsEngine,
  level: Level,
  replay: DecodedReplay,
): ReplayOutcome {
  if (replay.levelId !== level.id) {
    throw new ReplayError(`replay is for level "${replay.levelId}", not "${level.id}"`);
  }

  const simulation = createBikeSimulation(engine, level);
  let crashes = 0;
  let wasCrashed = false;
  let furthestX = 0;
  let ticksSimulated = 0;

  try {
    for (const entry of replay.entries) {
      for (let i = 0; i < entry.length; i++) {
        simulation.step(entry.mask);
        ticksSimulated += 1;
        const state = simulation.getState();
        if (state.crashed && !wasCrashed) crashes += 1;
        wasCrashed = state.crashed;
        if (state.x > furthestX) furthestX = state.x;
        if (state.finished) {
          const finishTick = state.finishTick ?? state.tick;
          return {
            finished: true,
            finishTick,
            durationMs: Math.round(finishTick * TICK_SECONDS * 1000),
            ticksSimulated,
            crashes,
            furthestX,
          };
        }
      }
    }
  } finally {
    simulation.dispose();
  }

  return {
    finished: false,
    finishTick: null,
    durationMs: null,
    ticksSimulated,
    crashes,
    furthestX,
  };
}

/** Decode and simulate in one step, which is what a submission endpoint wants. */
export function verifyReplay(
  engine: PhysicsEngine,
  level: Level,
  bytes: Uint8Array,
): ReplayOutcome {
  return simulateReplay(engine, level, decodeReplay(bytes));
}
