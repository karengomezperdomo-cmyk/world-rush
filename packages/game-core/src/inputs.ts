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
} as const;

export const INPUT_MASK_ALL = 0b1111;

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
