import { INPUT, withInput, type InputMask } from '@worldrush/game-core';

/**
 * Keyboard bindings exist for desktop testing only — the real target is World App's mobile WebView, where
 * input comes from the on-screen buttons wired up through `bindButton`.
 */
const KEY_BINDINGS: Readonly<Record<string, number>> = {
  ArrowUp: INPUT.GAS,
  KeyW: INPUT.GAS,
  ArrowDown: INPUT.BRAKE,
  KeyS: INPUT.BRAKE,
  ArrowLeft: INPUT.LEAN_BACK,
  KeyA: INPUT.LEAN_BACK,
  ArrowRight: INPUT.LEAN_FORWARD,
  KeyD: INPUT.LEAN_FORWARD,
};

export interface InputTracker {
  /** The mask of everything currently held. Read once per simulation tick. */
  getMask(): InputMask;
  /** Wires an on-screen button: held while pressed/touched, released on leave or cancel. */
  bindButton(element: HTMLElement, flag: number): void;
  dispose(): void;
}

export function createInputTracker(): InputTracker {
  let mask: InputMask = 0;
  const cleanups: (() => void)[] = [];

  const set = (flag: number, pressed: boolean): void => {
    mask = withInput(mask, flag, pressed);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const flag = KEY_BINDINGS[event.code];
    if (flag === undefined) return;
    event.preventDefault();
    set(flag, true);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    const flag = KEY_BINDINGS[event.code];
    if (flag === undefined) return;
    event.preventDefault();
    set(flag, false);
  };
  // Releasing everything on blur avoids a key "sticking" down when focus leaves mid-press.
  const onBlur = (): void => {
    mask = 0;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  cleanups.push(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  });

  return {
    getMask: () => mask,
    bindButton(element, flag) {
      const press = (event: PointerEvent): void => {
        event.preventDefault();
        set(flag, true);
        try {
          // Keeps receiving pointerup even if the finger slides off the button. Capture is a convenience,
          // so a failure here must not cost the player the input itself — hence after `set`, and guarded.
          element.setPointerCapture(event.pointerId);
        } catch {
          /* pointer already released, or not a capturable pointer */
        }
      };
      const release = (): void => set(flag, false);

      element.addEventListener('pointerdown', press);
      element.addEventListener('pointerup', release);
      element.addEventListener('pointercancel', release);
      cleanups.push(() => {
        element.removeEventListener('pointerdown', press);
        element.removeEventListener('pointerup', release);
        element.removeEventListener('pointercancel', release);
      });
    },
    dispose() {
      for (const cleanup of cleanups) cleanup();
      mask = 0;
    },
  };
}
