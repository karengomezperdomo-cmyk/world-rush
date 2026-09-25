import { PHYSICS_ENGINE_OPTIONS, type PhysicsEngine } from '@worldrush/game-core';

/**
 * Where `scripts/copy-box2d.mjs` puts the Box2D "compat" build inside `apps/web/public`.
 *
 * It is loaded from a served URL rather than imported as a package on purpose. `box2d3-wasm`'s entry point
 * pulls in both of its prebuilt binaries, whose Emscripten glue contains `import("module")` and
 * `import("worker_threads")` branches for Node. Those never execute in a browser, but a bundler still has to
 * resolve them, and fails the whole route with "Module not found: Can't resolve 'module'" (Turbopack) or a
 * "Critical dependency: the request of a dependency is an expression" warning plus a broken bundle
 * (webpack, used for production builds — see apps/web/package.json's `build` script). `webpackIgnore` keeps
 * the import out of the build graph entirely for both bundlers (Next's own docs list it as supported by
 * both, unlike `turbopackIgnore`, which webpack does not understand). That also means:
 *
 * - The browser always gets "compat", instead of the entry point feature-detecting its way to "deluxe". That
 *   is the flavour a World App WebView would land on anyway (no `crossOriginIsolated`, so no SharedArrayBuffer),
 *   and pinning it explicitly is what makes client behaviour predictable.
 * - The `.wasm` sits next to the `.mjs` under the same URL, so the glue's own
 *   `new URL("Box2D.compat.wasm", import.meta.url)` resolves without any bundler asset handling.
 */
const COMPAT_MODULE_URL = '/box2d/Box2D.compat.mjs';

type Box2DFactory = (options: typeof PHYSICS_ENGINE_OPTIONS) => Promise<PhysicsEngine>;

let cached: Promise<PhysicsEngine> | undefined;

/** Loads the WASM physics engine. The module is fetched once and reused across simulations. */
export function loadPhysicsEngine(): Promise<PhysicsEngine> {
  cached ??= (async () => {
    const module = (await import(/* webpackIgnore: true */ COMPAT_MODULE_URL)) as {
      default: Box2DFactory;
    };
    return module.default(PHYSICS_ENGINE_OPTIONS);
  })();
  return cached;
}
