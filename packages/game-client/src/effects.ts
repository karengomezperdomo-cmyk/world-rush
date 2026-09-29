import { Container, Sprite, type Texture } from 'pixi.js';

/**
 * Short-lived animated sprites: the explosion on a crash, and the dust the rear wheel throws up.
 *
 * The art for both was generated from the very beginning (`design/art/fx/`) and never reached the browser —
 * `copy-art.mjs` did not copy it, and nothing in the renderer referenced it. So a crash simply swapped the
 * bike for a single frozen ragdoll frame and that was the whole of it.
 *
 * Effects are pooled rather than created per spawn. Dust fires several times a second for the length of a
 * run, and building a Sprite for each one only to throw it away is exactly the kind of steady allocation
 * that turns into a stutter on a phone.
 */

export interface EffectTextures {
  readonly explosion: readonly Texture[];
  readonly dust: readonly Texture[];
}

interface ActiveEffect {
  readonly sprite: Sprite;
  frames: readonly Texture[];
  elapsedMs: number;
  frameMs: number;
  /** Metres per second, applied while the effect lives, so dust drifts backwards off the wheel. */
  driftX: number;
  driftY: number;
  fade: boolean;
}

export interface Effects {
  readonly container: Container;
  /** World position in PIXELS (the world container's own coordinate space). */
  explosion(x: number, y: number, scale: number): void;
  dust(x: number, y: number, driftX: number, scale: number): void;
  update(deltaMs: number): void;
  /** Drops everything on screen — used on respawn, so the old wreck does not linger. */
  clear(): void;
}

export function createEffects(textures: EffectTextures): Effects {
  const container = new Container();
  const active: ActiveEffect[] = [];
  const pool: Sprite[] = [];

  function take(): Sprite {
    const reused = pool.pop();
    if (reused) {
      reused.visible = true;
      reused.alpha = 1;
      return reused;
    }
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    container.addChild(sprite);
    return sprite;
  }

  function release(effect: ActiveEffect): void {
    effect.sprite.visible = false;
    pool.push(effect.sprite);
  }

  function spawn(
    frames: readonly Texture[],
    x: number,
    y: number,
    frameMs: number,
    scale: number,
    driftX: number,
    driftY: number,
    fade: boolean,
  ): void {
    if (frames.length === 0) return;
    const sprite = take();
    sprite.texture = frames[0]!;
    sprite.position.set(x, y);
    sprite.scale.set(scale);
    active.push({ sprite, frames, elapsedMs: 0, frameMs, driftX, driftY, fade });
  }

  return {
    container,

    explosion(x, y, scale) {
      spawn(textures.explosion, x, y, 55, scale, 0, -0.2, false);
    },

    dust(x, y, driftX, scale) {
      spawn(textures.dust, x, y, 70, scale, driftX, -0.35, true);
    },

    update(deltaMs) {
      for (let i = active.length - 1; i >= 0; i--) {
        const effect = active[i]!;
        effect.elapsedMs += deltaMs;
        const frame = Math.floor(effect.elapsedMs / effect.frameMs);
        if (frame >= effect.frames.length) {
          release(effect);
          active.splice(i, 1);
          continue;
        }
        effect.sprite.texture = effect.frames[frame]!;
        effect.sprite.x += effect.driftX * deltaMs * 0.06;
        effect.sprite.y += effect.driftY * deltaMs * 0.06;
        if (effect.fade) {
          effect.sprite.alpha = 1 - frame / effect.frames.length;
        }
      }
    },

    clear() {
      for (const effect of active) release(effect);
      active.length = 0;
    },
  };
}
