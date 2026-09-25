// Type-only: this erases at compile time, so nothing here pulls `box2d3-wasm` into a bundle. That matters —
// its Emscripten glue has `import("module")` / `import("worker_threads")` branches that a browser bundler
// cannot resolve, so the engine is loaded by each host instead (see `loadPhysicsEngine` in game-client, and
// `bike-sim.test.ts` for the Node side).
import type Box2DFactory from 'box2d3-wasm';

/**
 * The Box2D v3 WASM module (decision B6, Phase 5 spike: docs/DECISIONS.md). WASM's floating-point
 * arithmetic is required by its own spec to be exact IEEE-754 and identical across conformant runtimes —
 * unlike `Math.sin`/`Math.cos`/etc in plain JS, which each engine's libm is free to approximate differently
 * (the reason `packages/game-core`'s own lint rules ban those). This is the actual bet the whole
 * server-re-simulates-your-replay anti-cheat design rests on; it is NOT yet confirmed across genuinely
 * different engines on real devices (iOS Safari/JavaScriptCore vs Android Chrome/V8) — that needs decision
 * D2 (a real test device). `bike-sim.test.ts` only proves same-engine, same-process reproducibility, which
 * is necessary but not sufficient.
 *
 * Worse, the package ships TWO separately compiled binaries — "deluxe" (SIMD) and "compat" (no SIMD) — and
 * its entry point picks between them by feature detection, so Node and a browser can end up running
 * different builds of the same physics. Nothing guarantees those agree bit for bit. Every host must
 * therefore pin the same flavour before replays can be validated server-side; see docs/DECISIONS.md.
 */
export type PhysicsEngine = Awaited<ReturnType<typeof Box2DFactory>>;

/**
 * Options every host must pass, so the simulation is configured identically everywhere.
 *
 * `pthreadCount: 0` is what keeps this single-threaded. `sharedMemEnabled: true` is not a request for
 * threads — it must stay `true` (its own default) because the "deluxe" binary's WASM memory import is
 * compiled as shared unconditionally; passing `false` makes the glue build a non-shared `WebAssembly.Memory`
 * that fails to link against that import. The "compat" binary has no such import and ignores both.
 */
export const PHYSICS_ENGINE_OPTIONS = { sharedMemEnabled: true, pthreadCount: 0 } as const;
