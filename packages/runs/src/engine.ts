import { PHYSICS_ENGINE_OPTIONS, type PhysicsEngine } from '@worldrush/game-core';
import Box2DFactory from 'box2d3-wasm';

/**
 * The server's physics engine, instantiated once per process.
 *
 * Compiling the WebAssembly module takes long enough that doing it per request would dominate the cost of
 * verifying a replay. Serverless instances are reused between invocations, so the promise is cached at
 * module scope and later requests await the same one.
 *
 * Caching the PROMISE rather than the resolved engine matters: two requests arriving while the module is
 * still compiling would otherwise each start their own compilation.
 *
 * It lives here rather than in the web app because the app has no business knowing which physics library
 * verification uses — it asks this package for a verdict.
 */
let enginePromise: Promise<PhysicsEngine> | null = null;

export function getPhysicsEngine(): Promise<PhysicsEngine> {
  enginePromise ??= Box2DFactory(PHYSICS_ENGINE_OPTIONS) as Promise<PhysicsEngine>;
  return enginePromise;
}
