import { MiniKit } from '@worldcoin/minikit-js';

/**
 * Haptic feedback, through MiniKit's `sendHapticFeedback` command.
 *
 * Verified against the installed `@worldcoin/minikit-js@2.0.3`, not from memory: the command takes
 * `{ hapticsType: 'notification', style: 'error' | 'success' | 'warning' }`, `{ hapticsType: 'impact',
 * style: 'light' | 'medium' | 'heavy' }` or `{ hapticsType: 'selection-changed' }`.
 *
 * It only does anything inside World App — there is no MiniKit outside it — so every call is guarded by
 * `MiniKit.isInstalled()` and then wrapped anyway. Vibration is a flourish; it must never be able to
 * interrupt a run.
 */

type Haptic =
  | { readonly hapticsType: 'notification'; readonly style: 'error' | 'success' | 'warning' }
  | { readonly hapticsType: 'impact'; readonly style: 'light' | 'medium' | 'heavy' }
  | { readonly hapticsType: 'selection-changed' };

function send(haptic: Haptic): void {
  try {
    if (!MiniKit.isInstalled()) return;
    // `MiniKit.sendHapticFeedback(...)` directly. The 1.x-era `MiniKit.commandsAsync.*` namespace is gone in
    // 2.x — it is still declared, but typed `never`, so reaching for it from memory compiles into nothing
    // good. Checked against the installed 2.0.3 build, not recalled.
    void MiniKit.sendHapticFeedback(haptic);
  } catch {
    // Outside World App, or the command was refused. Nothing to recover from.
  }
}

/** A hard knock when the bike goes down. */
export function hapticCrash(): void {
  send({ hapticsType: 'impact', style: 'heavy' });
}

/** A success buzz on crossing the line. */
export function hapticFinish(): void {
  send({ hapticsType: 'notification', style: 'success' });
}

/** A light tick as a checkpoint is passed. */
export function hapticCheckpoint(): void {
  send({ hapticsType: 'impact', style: 'light' });
}
