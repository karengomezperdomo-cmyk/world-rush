# @worldrush/game-core

Headless, deterministic simulation shared by the game client and the validation server. **Skeleton only**:
the physics engine is decided by the Phase 5 determinism spike (decision B6), so nothing here depends on it yet.

## Rules (enforced by `eslint.config.mjs`, and proven by `scripts/determinism-lint.test.ts`)

- No DOM, no Node, no framework, no other workspace package. `tsconfig.json` has `types: []` and no DOM lib
  (tests are type-checked separately through `tsconfig.test.json`, so the source is compiled without Node/DOM globals).
- **No host time**: never `Date`, `performance`, timers. Simulation time is a tick counter.
- **No engine-dependent math**: never `Math.sin/cos/tan/atan2/exp/log/pow/hypot/random...` nor the `**` operator
  (ECMAScript leaves their exact results to the engine; V8 and JavaScriptCore differ). `+ - * /` and `Math.sqrt`
  are IEEE-754 exact and allowed. Use a deterministic replacement or a WASM physics engine.
- Randomness, if a mechanic ever needs it, comes from a seeded PRNG that lives here.

Why: the server re-simulates every submitted run to derive the time itself
(docs/phase-0/02-architecture-proposal.md §5 and §8). A single host-dependent result breaks validation.

## Inputs

Control scheme A (decision B1): four digital buttons stored as a 4-bit mask (`src/inputs.ts`).
