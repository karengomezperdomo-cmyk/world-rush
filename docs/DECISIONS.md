# Decision log

Living record of what is **in force**. The documents in `docs/phase-0` are a snapshot of the Phase 0 proposal;
when they differ from this file, **this file wins**.

Status legend: **DECIDED** (by the owner) · **DEFAULT** (proposed default, applied unless the owner objects) ·
**PENDING** (needs an owner decision; the phase that needs it is listed).

## 1. Decided by the owner (2026-09-20)

The owner answered by question ID: "A1, B1, C1, D1, E1, F (en Vercel), G Nosotros, H ya tenemos vercel".
A bare ID is read as **"accept the recommendation for that item"**. If that reading is wrong for any row, say so.

| ID     | Decision                                                                                                    | Consequences / notes                                                                                                                                                                                                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1** | Public name **RUSH 7** (provisional). "WORLD RUSH" stays only as the internal codename.                     | Lives in ONE constant (`BRAND` in `packages/shared`). **No trademark clearance done.** A preliminary web search found no exact "Rush 7" app but did find **"Seven Rush"** (a number-puzzle game on Google Play), which is close. Run a formal search and check existing Mini Apps in World App before art.   |
| **B1** | Control scheme **A**: four digital buttons (gas, brake/reverse, lean back, lean forward).                   | Inputs are a 4-bit mask (`packages/game-core/src/inputs.ts`). Binary inputs keep replays tiny and validation exact. Analog lean and auto-gas are out of the ranked game.                                                                                                                                    |
| **C1** | **Provisional art and audio** until final assets are supplied.                                              | Provisional assets will be clearly marked. If the owner meant "I will supply the final art", nothing changes now; verify ownership/licence of any AI-generated images and sounds before publishing.                                                                                                        |
| **D1** | The owner **creates the Developer Portal apps** following our checklist (option i).                         | Requires an existing Developer Portal team/account (not yet confirmed). No API key is ever pasted into chat. Needed from Phase 2. Options (ii) MCP with the owner's own key and (iii) guidance only remain available.                                                                                        |
| **E1** | **Stack approved** (see section 4 for the exact versions chosen).                                           | Unblocks Phase 1.                                                                                                                                                                                                                                                                                          |
| **F1** | **Hosted Postgres on Vercel** (Vercel Marketplace; the Postgres provider there is Neon).                    | Local development and tests keep using embedded PostgreSQL (PGlite), so no account is needed to work. Provisioning the hosted database needs the owner's permission and may bill through Vercel. See section 3.                                                                                             |
| **G1** | Prizes (future) are funded by **the owner's own team**: no sponsors, no entry fees.                         | Nothing is implemented. Simplifies the design: no user deposits, so no custody of user funds. A team-funded prize pool still needs a payout mechanism (server wallet vs claim contract) and a legal check for skill contests, decided when rewards are approved.                                             |
| **H1** | **Hosting: Vercel** (the owner already has an account).                                                     | Plan (Hobby or Pro) and custom domain not stated yet: see PENDING. Nothing has been linked or deployed.                                                                                                                                                                                                     |

## 1b. Decided by the owner (2026-09-24)

The owner replied **"haz lo recomendado"** to the open items flagged after the design phase (`design/index.html`, section
"Decisiones"). Read as: accept the recommended option for each of the following.

| ID     | Decision                                                                                                                      | Consequences / notes                                                                                                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B3** | On crash: respawn at the last checkpoint, timer keeps running.                                                                 | Matches `design/screens/crash.html` ("THE CLOCK KEEPS RUNNING"). The crash-*detection* rule itself (what counts as a crash) is still tuned during the Phase 5 physics spike; this only fixes its consequence. |
| **A2** | Leaderboard: verified humans only. Extended: an unverified player may still play in **practice mode**, unranked.               | Matches `design/screens/verify.html` (PRACTICE FIRST · NO RANKING). Practice runs are never submitted for ranking or stored as a personal best; the server must reject them from scoring endpoints.            |
| **B2** | Gameplay layout: ship **both** A (full screen) and B (4:3 window + tall pads). **A is the default**, B is a Settings toggle.   | Matches `design/screens/settings.html`. This fixes what ships, not the final pick — the default may be revisited after real play-testing in the Phase 5 prototype (motion feel, thumb reach on real devices).  |

## 1c. Phase 2 (2026-09-24): wallet-auth + World ID plumbing

Built after the owner said "sigamos con la fase 2". Re-verified against the CURRENT official docs and the
installed packages themselves (not memory/training data), since months have passed since the assistant's
training cutoff: fetched docs.world.org pages directly, and where a doc page paraphrased something
ambiguously, read the real `.d.ts` of the installed package instead (twice this caught a real mistake — see
below). Nothing here has been run on a real device or against a real Developer Portal app; both still need
decisions D1 and D2.

| Decision                                                                                          | Why                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pinned **`@worldcoin/minikit-js@2.0.3`**, **`@worldcoin/idkit@4.3.0`**, **`@worldcoin/idkit-core@4.3.0`** | Confirmed current via `registry.npmjs.org` on 2026-09-24 (not just the Phase 0 research from 5 days earlier). `idkit`'s peer range (`react/react-dom >=18`) is satisfied by React 19.3 already in the repo.               |
| New package **`packages/auth`**: nonce issuance, SIWE verification + our own domain/uri/chainId hardening, sessions, World ID verify + nullifier recording, RP signing | Framework-agnostic and independently testable (mirrors `packages/db`/`packages/config`), keeps `apps/web` route handlers thin. |
| **`WORLD_CHAIN_ID = 480`**                                                                          | Confirmed from MiniKit's own `sendTransaction` example in the official migration doc, not guessed.                                                                                                                       |
| `verifySiweMessage`'s domain/uri/chainId hardening (Phase 0's flagged gap) is now implemented          | Compares against a new required `APP_ORIGIN` server env var. **Not yet verified against a real World-App-generated SIWE message** (docs/phase-0/01-world-docs-review.md §10 item 6) — nothing to test against before D1/D2. If it rejects real logins once we can test it, fix the comparison; do not delete the check. |
| `packages/auth`'s SIWE test signs a **real** EIP-4361 message with a throwaway `viem` key and feeds it to the **real** `verifySiweMessage` (no mock) | The strongest check possible without a phone, and it earned its keep: reading the doc examples alone got `RpContext` wrong (missing `rp_id`, `sig` instead of `signature`) and `signRequest` wrong (it's synchronous, not async) — caught by `pnpm typecheck`. **Actually running the test against the real function** then caught two more, neither visible from types alone: (1) `chain_id` comes back as the numeric *string* `"480"` at runtime even though the package's own `.d.ts` declares `chain_id: number` — the hardening check now does `Number(siwe.chain_id) !== WORLD_CHAIN_ID`, not a strict `!==`; (2) `verifySiweMessage` does not always resolve `{isValid: false}` on a bad signature — on an EOA mismatch it falls back to an EIP-1271 (smart-wallet) check against a World Chain RPC, and that fallback can **throw** instead (confirmed: a plain `Error`, "Signature verification failed", uncaught, would have surfaced as a raw 500 instead of a clean 401). `verifyWalletAuthCompletion` now wraps that call and turns any exception into the same `WalletAuthError` as every other rejection reason. |
| World ID `signal` (binding a proof to our own user id) is **not independently re-verified server-side** | Genuinely unresolved after research (docs/phase-0/01-world-docs-review.md §10 item 2): the verify request/response fields found in the docs don't expose a signal/signal_hash to check. The client still does the correct thing (`proofOfHuman({ signal: userId })`); nullifier-uniqueness (which IS enforced) is what actually stops one human from claiming two accounts. Ask World or confirm empirically once D1/D2 happen, before this handles anything that matters (rewards are not implemented). |
| **DEV-ONLY** `/api/dev/fake-login`                                                                  | MiniKit only runs inside World App, so there is otherwise no way to exercise sessions/leaderboard-gating locally. Gated by `assertDevelopmentOnly` (throws outside development); a test tool, not a security control.    |
| `apps/web/src/lib/db.ts` opens the embedded (PGlite) database for development; throws for staging/production | `packages/db` still only has the embedded driver (Phase 4 adds the hosted one, per the Phase 1 decision already recorded above) — this fails loudly instead of silently misbehaving. |
| New required server env: **`APP_ORIGIN`** (outside development)                                    | Anchors the SIWE domain/uri check and the session cookie's `Secure` flag.                                                                                                                                                 |
| New World env vars, all unset until D1: `NEXT_PUBLIC_WORLD_MINIAPP_ID`, `NEXT_PUBLIC_WORLD_ID_APP_ID`, `WORLD_ID_RP_ID`, `WORLD_ID_RP_SIGNING_KEY` | Kept separate (Mini App id vs World ID app id/rp id) per Phase 0's own design note, since it's still unconfirmed whether they must be the same Developer Portal app. |
| `packages/db/src/client.ts` and `apps/web/src/lib/db.ts` compute their file-relative paths (`migrations/`, `.data/dev-db`) in two steps instead of `new URL('../x', import.meta.url)` | `pnpm build` only started reaching either file once `apps/web` began importing `@worldrush/db` in this phase (Phase 1 never did), and failed: Turbopack's production build statically pattern-matches that exact `new URL(literal, import.meta.url)` shape as a bundleable-asset reference, and neither target is one. **Still open, tracked for Phase 4:** a real serverless deployment needs `migrations/*.sql` present on disk at runtime next to the bundled server code (e.g. Next's `outputFileTracingIncludes`) — not needed yet, since `apps/web/src/lib/db.ts` refuses to run at all when `DATABASE_URL` is set. |
| `createLocalDb` now creates its `dataDir` (recursive `mkdir`) before handing it to PGlite | Caught by actually running `pnpm dev` and calling the fake-login route for real (not just `pnpm check`, which never exercises the on-disk path — every test uses the in-memory mode): PGlite's own `create()` only makes the final path component, not `apps/web/.data`, so the very first request failed with `ENOENT`. Confirmed fixed: full flow (fake-login → session → logout → session) now works end to end against a real `next dev` server. |

### D1, concretely: what to do in the Developer Portal

None of this blocks the code above; it can happen whenever the owner has a few minutes.

1. Sign in at the Developer Portal with an existing (or new) World account.
2. **Done (2026-09-24):** Mini App created; `app_id` is in `apps/web/.env.local` as
   `NEXT_PUBLIC_WORLD_MINIAPP_ID` (confirmed reaching `MiniKitProvider` in the rendered page). Not committed
   (git-ignored) — app_id is public by design (World ships it to the browser itself), so receiving it in
   chat is fine; it is not a secret like the RP signing key below.
3. **Still open — which Portal app is the World ID relying party?** Create (or reuse the Mini App above for)
   **World ID**: this needs an `app_id`, an `rp_id`, and generates a
   **secret** RP signing key. Put `app_id` in `NEXT_PUBLIC_WORLD_ID_APP_ID`, `rp_id` in `WORLD_ID_RP_ID`, and
   the signing key in `WORLD_ID_RP_SIGNING_KEY` — that last one is a secret; it only belongs in
   `apps/web/.env.local` (git-ignored) or, later, the hosting platform's encrypted env store, never in chat,
   never committed.
4. That's it for Phase 2 testing (still needs a public URL to open from a phone — decision D2 — before it
   can run inside World App itself; see the still-PENDING table below).

## 1d. Phase 5 (2026-09-24): physics + render spike — a playable prototype

Built after the owner chose "Sí, con lo recomendado" for the Phase 5 spike: **B6 = Box2D v3 WASM**
(`box2d3-wasm@5.2.0`) and **B5 = PixiJS 8** (`pixi.js@8.21.0`). Both are now answered in practice, not on
paper: `/play` is a real, drivable prototype, verified by actually driving it in a browser — accelerating,
climbing the ramp, clearing the jump, passing both checkpoints and crossing the finish line.

Every Box2D call was checked against the installed `.d.ts` and, for the wheel joint, against Erin Catto's own
sample (`erincatto/box2d`, `samples/sample_joints.cpp`) rather than written from memory. That still was not
enough on its own: four of the bugs below were only ever visible by running the thing.

| Decision / finding                                                                                     | Why                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Box2D v3 WASM works** for a two-wheeled vehicle: chassis capsule + two circle wheels on wheel joints (spring suspension + rear motor) | The joint setup follows the official sample exactly. B6's escalation path (Rapier, then custom physics) is **not** needed.                                                                                              |
| **`b2MakeRotFromUnitVector` does not exist in these JS bindings**, though it is in the C API and the samples | Replaced with `b2MakeRot(Math.PI / 2)`: a rotation's local x-axis is `(cos θ, sin θ)`, so θ = π/2 points the suspension axis straight up — the same frame the sample builds. `Math.PI` is a fixed IEEE-754 literal, not an engine-approximated function, so it does not violate this package's determinism lint. |
| **`sharedMemEnabled: false` is not how you disable threading** — it breaks the module outright        | The "deluxe" binary's WASM memory import is compiled as shared unconditionally, so a non-shared `WebAssembly.Memory` fails to link (`LinkError: mismatch in shared state of memory`) and every game-core test failed. `pthreadCount: 0` is what actually keeps it single-threaded; `sharedMemEnabled` stays `true`. Found by reading `Box2D.deluxe.mjs` directly after the tests broke. |
| **Positive motor speed drives the bike backwards**                                                     | A wheel rolling forward (+x) without slipping spins clockwise, i.e. *negative* angular velocity in Box2D's CCW-positive convention. `DRIVE_WHEEL_SPEED` is `-45`. Caught by instrumenting the simulation tick by tick — `vx` was steadily negative under GAS. |
| **Drive torque of 9 N·m flipped the bike onto its back within ~0.8 s**; it is now 3.0 N·m              | The rear wheel's drive force acts at ground level, below the chassis's centre of mass, so it also pitches the nose up — a real wheelie, just far too strong for a ~2 kg vehicle. Tuned empirically against actual runs.   |
| **Bodies fell asleep and joint motors could not wake them** — `worldDef.enableSleep = false`           | The single worst bug of the phase, and invisible to every test: idle on the start line for a few seconds and the bike **could never pull away at all**. Only found by sitting still in a real browser and then pressing GAS. Sleep is also accumulated-time state that could diverge between a player's run and the server's re-simulation, so it is off for good, not merely worked around. |
| Ground is built as one static **segment per consecutive point pair**, straight from the level's raw polyline | Box2D derives each segment's own geometry internally, so authoring a level never needs `Math.atan2` or any other engine-approximated trig — exactly what game-core's lint bans.                                          |
| `packages/game-core` **no longer loads the engine at all**; it only carries the `PhysicsEngine` *type* (an erased `import type`) and the shared `PHYSICS_ENGINE_OPTIONS` | `box2d3-wasm`'s Emscripten glue contains `import("module")` / `import("worker_threads")` branches for Node. They never execute in a browser, but Turbopack still has to resolve them and failed the whole route with `Module not found: Can't resolve 'module'`. `turbopack.resolveAlias` does **not** apply to bare Node built-in specifiers — tried, and it changed nothing. Each host now supplies its own engine. |
| The browser loads Box2D from **`/box2d/Box2D.compat.mjs`** (copied into `public/` by `scripts/copy-box2d.mjs` on `predev`/`prebuild`) via a `turbopackIgnore` dynamic import | Keeps the glue out of the build graph entirely, puts the `.wasm` next to the `.mjs` so the module's own `new URL("Box2D.compat.wasm", import.meta.url)` resolves with no bundler asset handling, and — most importantly — **pins which binary the browser runs** instead of letting feature detection choose. |
| **`packages/game-client`** (new): PixiJS 8 renderer, input tracker, fixed-timestep loop; **`/play`** route in `apps/web` | The loop accumulates real elapsed time and steps the simulation at a fixed 1/60 s, dropping any backlog beyond 8 ticks so a backgrounded tab cannot freeze the frame on return. Controls follow scheme A (lean pads left, brake/gas right); the top-right corner stays clear for World App's own controls. |
| The bike is drawn as **placeholder primitives matching the collision shapes**, not the art in `design/` | This is a physics/controls spike, and drawing the actual bodies is what makes tuning problems visible. Real art is Phase 6 work. Note the wheels are rendered at fixed offsets from the chassis, so suspension travel is not yet shown. |
| The crash test now **forces a nose-dive with LEAN_FORWARD while airborne** instead of trying to under-power the jump | The original test assumed the bike would fall short into the gap. It does not — this ramp is easy to clear, and under-powering it instead makes the bike stall on the slope and roll back down without ever crashing. Chasing an exact "just barely fails" throttle figure would have been a fragile test of nothing in particular; tipping the bike over is unambiguous and exercises the same crash-and-respawn path. |

### The determinism problem this phase uncovered

`box2d3-wasm` ships **two separately compiled binaries** — "deluxe" (SIMD) and "compat" (no SIMD) — and its
entry point picks between them by feature detection: SIMD support *and* either no `window` at all (Node) or
`window.crossOriginIsolated === true`. In practice that means **Node runs "deluxe" and a browser runs
"compat"**, and nothing in the package documents or guarantees that the two agree bit for bit.

That matters because the whole anti-cheat design is "the server re-simulates your replay and must reach the
same answer". A client and server running different builds of the same physics is precisely the thing that
breaks it. The browser side is now pinned to "compat" explicitly, which is half the fix; **the server side
must be pinned to the same binary before replay validation is built in Phase 7.** Until then, "Box2D is
deterministic" remains an unproven assumption, now with a concrete known reason to doubt it.

The existing test still only proves *same-engine, same-process* reproducibility. Cross-device determinism
(iOS/JavaScriptCore vs Android/V8) is still **D2**, and this finding makes it more urgent, not less.

### What is deliberately not built yet

No replay recording, no server-side re-simulation, no timer/results/pause flow, no real art, and a single
hand-authored test track that is not "Map 1". The bike also keeps falling past the end of the level after
finishing, because nothing ends the run yet.

## 2. Defaults in force (no objection recorded)

A4 grace of 120 s for runs already in progress at closing time · A6 languages EN + ES (i18n from day one) ·
A7 REWARDS tab hidden behind a feature flag until it is real · A8 outside World App: landing page + read-only leaderboard ·
B4 45–90 s per map · C2 brand adjustments to the mock (no "Built for World", no
globe logo, official "human" badge, no "official" wording) · C3 provisional names for maps 2–7 · D3 notifications, payments and
wallet permissions stay OFF · E2 admin uploads compiled level packages (no visual editor in v1) · E3 code and technical docs in
English · F2 retention (replays 30 days except top 100 and flagged runs; analytics 180 days) · F3 tie-break: whoever set the
time first wins · H3 three isolated environments.

## 3. What "Postgres on Vercel" and "we already have Vercel" imply (verified 2026-09-20)

- **Neon through the Vercel Marketplace** creates a database **branch per preview deployment** and injects `DATABASE_URL` /
  `DATABASE_URL_UNPOOLED` for Production and Development; there is a Vercel-managed option billed through Vercel. Marketplace
  resources can be attached to a **custom environment**.
- **Hobby plan is restricted to non-commercial personal use** and cron jobs run **at most once per day with up to ±59 minutes of
  imprecision**. **Pro** allows per-minute cron and **1 custom environment per project** (a persistent `staging`).
  Without Pro, staging can still be a persistent preview branch.
- **Impact on the design:** correctness never depends on cron (competition state derives from the clock; finalization also
  runs lazily on first read), so Hobby would still be *correct*, just slower to finalize. But a game with prizes is commercial
  use, so **Pro is expected**.
- **Env-mixing risk to control in Phase 2/13:** preview deployments must never receive the production `DATABASE_URL`.
  Defence in depth already in Phase 1: the server refuses to start if `APP_ENV` and `VERCEL_ENV` disagree, and refuses a
  database whose `system_meta` marker belongs to another environment.
- Vercel function execution limits for replay validation (sub-second expected) have **not** been checked yet.

## 4. Technical decisions taken in Phase 1 (safe and reversible)

| Decision                                                             | Why                                                                                                                                                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript 6.0.3**, not 7.0.2 (the current `latest`)               | `typescript-eslint` 8.70 declares `typescript >=4.8.4 <6.1.0`; TS 7 would break linting. Revisit when typescript-eslint supports 7.                                     |
| **pnpm 12.5.1** through Corepack (pinned in `packageManager`)        | World's docs recommend pnpm. No global install was made on this machine.                                                                                               |
| **Next.js 16.3.5 / React 19.3.0**                                    | Latest stable. The official World template still uses Next 15, and World's SDK peer ranges accept React 19; real compatibility is verified in Phase 2 (fallback: Next 15). |
| **Node 24** (`engines`, `.nvmrc`)                                    | Matches the installed runtime and Vitest 5's supported range.                                                                                                          |
| `allowBuilds: esbuild: true` in `pnpm-workspace.yaml`                | pnpm 12 blocks dependency install scripts by default. Only esbuild is allowed; its script just verifies the platform binary. Any other package that asks for a script stays blocked until reviewed. |
| Local `.env` lives in **`apps/web/.env.local`**                      | Next.js loads env files from the app folder, not from the monorepo root. Only `.env.example` is tracked (enforced by `pnpm guards`).                                     |
| **ESLint 10, Vitest 5, Zod 4, Drizzle ORM 0.45 + drizzle-kit 0.31**  | Current stable versions with compatible peer ranges (checked on npm).                                                                                                  |
| **PGlite (embedded PostgreSQL 18) for local development and tests**  | No account, no Docker (not installed). Real multi-connection concurrency tests still need a real Postgres in CI (Phase 11).                                            |
| `game-core` compiled **without DOM/Node types** and linted for determinism | The server must re-simulate runs and get identical results; host-dependent math or time would silently break validation.                                            |
| No CSP / framing headers yet                                         | A wrong CSP would break the Mini App inside World App. Added in Phase 10 once the exact origins used by MiniKit/IDKit are known.                                        |
| `APP_ENV` has **no default**                                         | A missing value must stop the server, never silently become "development".                                                                                            |

## 4b. Design phase (2026-09-20): what exists and what it assumes

Deliverables are in `design/` (open `design/index.html`; every screen is also rendered to `design/screens/png`). The game design is written up in `docs/design/GDD.md`.

| Decision                                                                                     | Why                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display font is **Jersey 15** (OFL), not Pixelify Sans                                       | Pixelify Sans made the digit 2 look like an 8 and the 5 like an S at 14–34 px; a time-trial game cannot afford that. Silkscreen and Chakra Petch stay.               |
| Art is **generated by code** (`tools/art`), deterministic, provisional (C1)                | Lets the look be reviewed now; a final asset can replace any file of the same size without touching a screen.                                                        |
| Two gameplay layouts are drawn: **A** (full screen) and **B** (4:3 window + tall pads) (B2)  | Decided 2026-09-24 (§1b): ship both; A default, B in Settings. The final default is re-checked after Phase 5 playtesting.                                           |
| Home keeps 4 tabs; REWARDS stays hidden behind a flag (A7)                                   | Rewards are not implemented. Profile shows a dim "REWARDS · COMING SOON" card instead.                                                                               |
| The "human" pill is a **placeholder** (leaderboard, profile, Home)                           | World's review guidelines want their official badge next to usernames; the official asset replaces the pill, unmodified.                                              |
| The weekly-results screen fixes layout only                                                  | The champion rule (A5) is not decided and is not invented; the mock carries a visible design note.                                                                   |

## 5. PENDING owner decisions

| ID      | Decision needed                                                                                                                | Needed by         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| **D2**  | Test devices with World App: iPhone, Android or both (MiniKit only works inside World App). Phase 5 raised the stakes: `box2d3-wasm` ships two different binaries and Node/browser pick different ones (§1d) | Phase 2           |
| **A3**  | Official daily cut-over hour (UTC 00:00 recommended) and the start date of Week 1                                              | Phase 8           |
| **A5**  | Weekly champion formula (options in `docs/phase-0/04-decisions-and-questions.md`; not chosen on the owner's behalf)            | before showing it |
| **H1a** | Vercel plan (Hobby vs Pro): Hobby is non-commercial and has daily-only cron                                                    | Phase 2           |
| **H1b** | Custom domain (a `*.vercel.app` URL works for testing)                                                                         | Phase 12–13       |
| **H2**  | GitHub repository: create a private one (the `gh` CLI is installed), yes/no. Nothing is created without permission            | Phase 2           |
| **F1a** | Permission to provision the hosted Neon database through Vercel (may bill); not needed until a deployment needs persistence   | Phase 2–3         |

## 6. World items still to verify (unchanged)

The 13 open points in `docs/phase-0/01-world-docs-review.md` §10 remain open. They are closed in Phases 2 and 3 with the Developer
Portal and real devices, or by asking World.
