import { describe, expect, it } from 'vitest';
import { hasInput, INPUT, INPUT_MASK_ALL, isValidInputMask, withInput } from './inputs';

describe('input mask', () => {
  it('uses one distinct bit per button', () => {
    const bits = Object.values(INPUT);
    expect(new Set(bits).size).toBe(4);
    expect(bits.reduce((all, bit) => all | bit, 0)).toBe(INPUT_MASK_ALL);
  });

  it('sets and clears buttons independently', () => {
    let mask = 0;
    mask = withInput(mask, INPUT.GAS, true);
    mask = withInput(mask, INPUT.LEAN_BACK, true);
    expect(hasInput(mask, INPUT.GAS)).toBe(true);
    expect(hasInput(mask, INPUT.LEAN_BACK)).toBe(true);
    expect(hasInput(mask, INPUT.BRAKE)).toBe(false);
    mask = withInput(mask, INPUT.GAS, false);
    expect(hasInput(mask, INPUT.GAS)).toBe(false);
    expect(hasInput(mask, INPUT.LEAN_BACK)).toBe(true);
  });

  it('is idempotent', () => {
    const once = withInput(0, INPUT.BRAKE, true);
    expect(withInput(once, INPUT.BRAKE, true)).toBe(once);
    expect(withInput(0, INPUT.BRAKE, false)).toBe(0);
  });

  it('validates masks (a replay with unknown bits is rejected by the server)', () => {
    expect(isValidInputMask(0)).toBe(true);
    expect(isValidInputMask(INPUT_MASK_ALL)).toBe(true);
    expect(isValidInputMask(16)).toBe(false);
    expect(isValidInputMask(-1)).toBe(false);
    expect(isValidInputMask(1.5)).toBe(false);
    expect(isValidInputMask(Number.NaN)).toBe(false);
  });
});
