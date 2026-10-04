/**
 * Digital input mask for control scheme A (decision B1): four independent buttons.
 *
 * Binary inputs keep replays tiny (one byte per change) and make server-side validation exact:
 * the server re-simulates from this mask, so every device produces the same result.
 */
export const INPUT = {
  GAS: 0b0001,
  /** Brake / reverse. */
  BRAKE: 0b0010,
  LEAN_BACK: 0b0100,
  LEAN_FORWARD: 0b1000,
  /**
   * "Continue from the last checkpoint", after running the tank dry.
   *
   * It is an INPUT, not an event on the side, because that is what makes it verifiable: a continue moves the
   * bike and refills the tank, so a replay that did not carry it would re-simulate into a different race.
   * Riding it inside the existing per-tick mask means the server reproduces continues exactly, and can count
   * them — nobody can claim fewer than they took.
   */
  CONTINUE: 0b10000,
} as const;

export const INPUT_MASK_ALL = 0b11111;

/** A bit set of INPUT flags. */
export type InputMask = number;

export function isValidInputMask(mask: number): boolean {
  return Number.isInteger(mask) && mask >= 0 && mask <= INPUT_MASK_ALL;
}

export function hasInput(mask: InputMask, flag: number): boolean {
  return (mask & flag) !== 0;
}

export function withInput(mask: InputMask, flag: number, pressed: boolean): InputMask {
  return pressed ? (mask | flag) & INPUT_MASK_ALL : mask & ~flag & INPUT_MASK_ALL;
}
