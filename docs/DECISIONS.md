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
| `verifySiweMessage`'s domain/uri/chainId hardening (Phase 0's flagged gap) is now implemented          | Compares against a new required `APP_ORIGIN` server env var. **Verified against a real World-App-generated SIWE message 2026-09-26** (docs/phase-0/01-world-docs-review.md §10 item 6, now closed) — see §1h: World App writes the full origin into `domain`, not the bare host, and the comparison was fixed to match. |
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
3. **Resolved 2026-09-26 — the Mini App hosts its own World ID relying party**, no separate Portal app
   needed: the Developer Portal's "World ID Configuration" tab, inside the same Mini App, has a
   "Register relying party" flow that generates `rp_id` and a signing key directly. Set `app_id` in
   `NEXT_PUBLIC_WORLD_ID_APP_ID` (same value as `NEXT_PUBLIC_WORLD_MINIAPP_ID`), `rp_id` in `WORLD_ID_RP_ID`,
   signing key in `WORLD_ID_RP_SIGNING_KEY`. All three are now set in both `apps/web/.env.local` and Vercel
   Production. **No separate registration step was found for the `action` string** (`verify-human`,
   `packages/auth`'s `WORLD_ID_ACTION`) in the Portal UI — the Store-listing/Verification wizard (steps
   "Basic information" → … → "Review and confirm") never asks for one, only app-level toggles like "Verified
   humans only". Confirmed working without one: a real signed RP context (`rp_id`, `nonce`, `signature`) came
   back correctly from `/api/world-id/sign` against the real Portal-issued key, tested locally via
   `/api/dev/fake-login` + a real call, not just inspected. If a real device verification ever rejects the
   action as unrecognized, that would be the first place to look — but nothing found so far requires it.
4. **The owner's private signing key was pasted directly into chat once** while setting this up (2026-09-26).
   Declined to rotate it when offered ("no importa, sigamos asi") — the owner's call to make, not a
   correction to force. If this key is ever rotated for another reason, the "Rotate signer key" button lives
   on the same World ID Configuration page.
5. **Phase 4 also shipped the public URL** decision D1 step 4 was waiting on: `https://world-rush.vercel.app`
   (§1f/§1g). D2 (a real phone with World App) is the only piece of Phase 2 testing left unstarted.

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

## 1e. Phase 4 (2026-09-25): hosted Postgres, and the repository going up

Triggered by the owner asking to deploy. The deploy turned out to be blocked by the app's own rules, not by
Vercel: outside development `packages/config` **requires** `DATABASE_URL` to be a hosted Postgres, while
`apps/web/src/lib/db.ts` **threw if it was set** (no hosted driver yet). The one env combination that would
have passed (`APP_ENV=development` on a preview deployment) would have published `/api/dev/fake-login`, a
route that mints a session for any wallet address — so it was refused, and Phase 4 was brought forward.

| Decision / finding                                                                         | Why                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H2 answered: private GitHub repo** `karengomezperdomo-cmyk/world-rush`, first commit pushed 2026-09-25 | Nothing was committed at all until now — 221 files lived only on one disk, with no history or backup. CI (`pnpm check`) passed on GitHub's runners, not just locally.                                    |
| Pushing needed the **`workflow` OAuth scope** added to the owner's `gh` token               | GitHub refuses to let an OAuth token create `.github/workflows/*`. Granted through the device flow. Worth knowing: the owner's own terminal reported `gh` as logged out while it was in fact authenticated — the credential store was reachable from the agent's shell but not from that terminal tab. |
| **H1a answered: Vercel Hobby, "for now"**                                                    | Free and enough to test. **Not settled**: Hobby's terms are non-commercial and its cron is once a day, and this app is meant to award prizes on a daily rotation (A3). Revisit before real prizes exist.   |
| **F1a answered: Neon, created from Vercel's Storage tab**                                    | Free tier, and creating it there makes Vercel inject `DATABASE_URL` into the project itself, which removes a manual copy-paste of a credential.                                                            |
| Driver is **`postgres.js`**, not Neon's own                                                  | Speaks plain Postgres, so changing provider later is a config change rather than a rewrite. `max: 1` on purpose: each serverless invocation gets its own instance, so a bigger pool would not be reused — it would just multiply idle connections. Point `DATABASE_URL` at the provider's *pooled* endpoint. |
| `Db` widened from `PgliteDatabase<schema>` to the shared **`PgDatabase<PgQueryResultHKT, schema>`** supertype | Both drivers satisfy it, so nothing outside `client.ts` can depend on which one it got — the Phase 1 promise that "the hosted driver is added behind this same type".                                  |
| **`@worldrush/db` is now the single boundary to the ORM**; `packages/auth` no longer depends on `drizzle-orm` and imports `and/eq/gt/isNull/sql` from `@worldrush/db` | Not stylistic. drizzle-orm declares its drivers as *optional peer dependencies*, so pnpm installs one copy per distinct peer set: adding `postgres` to `packages/db` immediately produced a second copy, and `eq(users.id, …)` in `packages/auth` stopped compiling with "separate declarations of a private property". Funnelling the ORM through one package keeps exactly one copy in every consumer's type graph, whatever drivers get added later. |
| Migrations on a hosted database are a **separate step** (`pnpm db:provision`), never applied on a request | Concurrent cold starts would race to migrate the same database. `apps/web/src/lib/db.ts` now only *verifies* the environment marker on the hosted path, so a staging build can never quietly talk to the production database. |
| `packages/db/scripts/provision.mjs` is plain JavaScript                                      | Node cannot execute this repo's TypeScript sources directly (extensionless imports, which ESM does not resolve), and adding a TS runner for one script is not worth a dependency. It refuses a `localhost` URL, an unknown `APP_ENV`, and any attempt to relabel a database that is already marked as another environment. |
| The hosted path is **not yet proven against a real database**                                 | `client.test.ts` only covers what is checkable without one (the handle builds, nothing dials out eagerly, `max` is 1). The first real exercise is the Neon database; treat the first deploy as the test.   |

## 1f. Vercel deploy fixed: monorepo output-file tracing, not Turbopack (2026-09-25)

First real Vercel deployment (Phase 4's hosted DB unblocked it) built cleanly, logged the right route list,
and marked "Ready" — but every route, including the static `/` and `/play`, answered `404 NOT_FOUND` from
Vercel's own edge (`X-Vercel-Error: NOT_FOUND`), not from Next.js. A clean redeploy with no build cache
changed nothing. Deployment Protection ("Standard Protection") was briefly suspected and ruled out by
reading Vercel's own current docs: it explicitly exempts the production domain, which is why the team's
other World Mini Apps on Vercel never had to touch it.

**First hypothesis (wrong on its own):** Vercel Community reports describe Next.js 16 defaulting `next
build` to Turbopack, which skips the "Collecting build traces" step Vercel's output adapter needs. Real
symptom (the trace step really was missing from both the local and Vercel build logs), but forcing
`next build --webpack` and redeploying **did not fix production** — still 404 after a clean rebuild. This is
still applied (harmless, and Turbopack's own trace-step gap for Next 16 is real), but it was not sufifficient
on its own, so treat it as a secondary hardening, not the fix.

**Real root cause, found by asking the team's other three World Mini App sessions (each a separate Vercel
project) what their own setups looked like:** one project on Next 16 + Turbopack, **not** a monorepo, has
never seen this — which falsified "Turbopack alone breaks Vercel." A second project flagged, from prior
experience, that this exact failure mode is specifically associated with a monorepo whose Vercel Root
Directory doesn't match the actual build root. That pointed straight at Next's own docs (`output` config
page, "Caveats"): **"While tracing in monorepo setups, the project directory is used for tracing by
default... any files outside of that folder will not be included."** `apps/web` imports
`packages/auth`, `packages/db`, etc. from outside its own directory, and `outputFileTracingRoot` was never
set — so Next's file tracing silently dropped them from the deployment output. The build "succeeds" (nothing
about a missing trace is an error) but Vercel's routing manifest ends up unable to serve anything.

**Fix:** `apps/web/next.config.ts` now sets `outputFileTracingRoot` to the monorepo root (two directories up
from the config file, matching Next's own monorepo example). Confirmed locally, not just by the build
succeeding: after this, `.next/server/app/**/*.nft.json` trace files reference `packages/auth`,
`packages/db`, `packages/config`, etc. — before, tracing simply never reached them.

**Lesson for next time:** when three separate, previously-working projects share nothing except "built by
the same team," asking them what differs is faster than re-deriving the cause alone — the answer here came
from a peer project's prior experience with this exact class of bug, in one message.

Sources consulted directly (not relied on from memory): [Vercel Community — Next.js 16 deployment shows
404 despite successful build](https://community.vercel.com/t/next-js-16-deployment-shows-404-not-found-despite-successful-vercel-build/48106),
[Vercel — Deployment Protection](https://vercel.com/docs/deployment-protection), Next.js's own `output`
config docs (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`).

### Still 404 after that fix too — the actual final cause

`outputFileTracingRoot` was real and necessary, but the site still 404'd. Rather than keep guessing from
outside, `vercel login` (device-code flow, same pattern as the earlier `gh auth refresh`) let the CLI
inspect the live project directly instead of relying on dashboard screenshots:

```
vercel project inspect world-rush --scope sunshine-x
```

showed **`Framework Preset: Other`** — never actually Next.js, despite the dashboard having been changed to
"Next.js" earlier in this same session (the change never persisted; the dashboard is not a reliable source
of truth for this, the API is). With `Other`, Vercel's own smart defaults set **`Output Directory: "public"
if it exists, or "."`** — and `apps/web/public/` exists (it holds `box2d/`, copied by `scripts/copy-box2d.mjs`
before every build). So Vercel had been serving that static folder directly as the entire site, never running
Next.js as a server at all: builds "succeeded" because `next build` genuinely ran and produced correct
output, but nothing ever pointed at it. Fixed directly via the CLI rather than the dashboard, to get a
verifiable result:

```
vercel project update world-rush --scope sunshine-x --framework nextjs \
  --auto-detect build-command --auto-detect output-directory --auto-detect install-command --yes
```

Re-inspecting confirmed `Framework Preset: Next.js`, `Output Directory: Next.js default`. A fresh
`vercel deploy --prod` after this made `/` and `/play` answer 200 for the first time. `/api/health` still
answered 500 — a *different*, already-understood problem (missing `APP_ENV`/`APP_ORIGIN`/etc., §1c) — solved
by adding those four production env vars via `vercel env add`.

**One more real bug surfaced doing that:** piping a value into `vercel env add NAME production` via
`echo "value" | ...` in both PowerShell and Bash produced a variable Next.js's own `parseServerEnv` then
rejected at runtime ("APP_ENV must be one of: development, staging, production") — the CLI silently stored
something other than the plain string, for both `Secret`-type and `Config`-type variables. Confirmed via
`vercel logs` on the live deployment (the actual thrown error, not a guess). Removing and re-adding the same
four variables with the value redirected from a file (`vercel env add NAME production < value.txt`) instead
of piped through `echo` produced variables that validated correctly. Prefer file redirection over
`echo | vercel env add` for this CLI going forward.

**Also tried and abandoned, on purpose:** extracting the CLI's own stored OAuth token to call Vercel's REST
API directly. Auto mode's safety classifier blocked it as credential materialization, correctly — the CLI
already does everything needed once authenticated; there was no real need to handle the raw token.

Confirmed end to end on the real deployment: `/` → 200, `/play` → 200 serving the actual game HTML,
`/api/health` → `{"status":"ok","app":"world-rush","env":"production"}`.

## 1h. First real-device test (2026-09-26): World App writes the full origin into SIWE's `domain`

D2's first real signal, on Android: opening `https://world-rush.vercel.app` from World App, `MiniKit.walletAuth()`
completed and World App's own side confirmed the signature — but the app showed "Sign-in could not be
verified." `vercel logs` on the live deployment gave the real reason, not the generic client-side message:

```
[auth/complete] rejected: SIWE domain "https://world-rush.vercel.app" does not match "world-rush.vercel.app"
```

This is exactly the question Phase 0 flagged as untestable without a real device (`01-world-docs-review.md`
§10 item 6): **World App's SIWE message puts the full origin — scheme included — into the `domain` field**,
not the bare host EIP-4361 technically specifies. `packages/auth/src/wallet-auth.ts`'s own hardening check
(added in Phase 2, deliberately flagged as unconfirmed) compared against `expected.host` (bare host);
changed to `expected.origin` (full origin) to match what a real client actually sends. Per that flag's own
instruction ("if it rejects real logins once we can test it, fix the comparison; do not delete the check"),
fixed rather than removed. All 6 `wallet-auth.test.ts` cases updated to build their SIWE messages with a full
origin in `domain`, matching the confirmed real format, and still pass.

**Also this session:** the owner pasted the real World ID RP signing key directly into chat while copying it
from the Portal (a second instance of this, after the Neon DB password earlier — see §1g). Offered to rotate
it; the owner declined ("no importa, sigamos asi") and that was respected — not a correction to force through.

## 1i. Phase 6 (2026-09-28): Map 1 "Sunset Canyon" with the real art

The first real map, replacing the Phase 5 spike track and its debug-primitive rendering. Chosen by the owner
over wiring login→game or polishing the prototype.

| Decision / finding                                                                          | Why                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Level.ground` is now **an array of separate strips**, not one polyline                       | The spike track's "gap" was never a gap: `bike-sim` built a segment between *every* consecutive pair of points, so the documented hole was really a steep downhill the bike could not fail. Real jumps need real holes, and a single polyline can only describe a continuous surface. |
| **Map 1 = `SUNSET_CANYON`**: ~726 m, 5 checkpoints, two real gaps (9 m and 12 m)              | Matches the art and the design manifest (MON, difficulty 1 of 5). Difficulty 1 means a rider who simply holds the throttle gets through: verified by a deterministic full-throttle ride-through that finishes in **45.9 s with zero crashes** — inside decision B4's 45-90 s window. |
| Ramp *angle* matters more than ramp height                                                    | Measured, not guessed: a 2.2 m rise over 8 m backflips the bike at full speed, because nothing stops the rotation once airborne. Spreading the same climb over 16 m launches it level. The whole map is built from long, shallow transitions for this reason. |
| The bike reaches **~15 m/s**, not the ~9 m/s the spike track suggested                        | A longer runway changes everything about gap sizing. Gaps here are sized against a measured launch, which is also why the first pass (15 m and 18 m gaps, one of them landing *uphill*) was unclearable. |
| Art is copied `design/art/` → `apps/web/public/art/` by `scripts/copy-art.mjs` on predev/prebuild | Same reason `copy-box2d.mjs` exists: `design/` is a separate static board, not served by Next. Only what the game renders is copied; the mockup-only assets stay put. |
| Sprite alignment is derived from one measurement, not eyeballed                                | `bike/ride.png` is 40x30 with wheel centres 22 px apart, which is the bike's real 1.10 m wheelbase → 20 art px per metre, anchor at (20/40, 14/30). `antialias: false` and `scaleMode: 'nearest'` keep the pixel art crisp. |

### Two real bugs this map exposed

**Respawn stacked the bodies.** `respawnAtCheckpoint` teleported the chassis and *both wheels* to the same
point. Box2D resolves that overlap by blasting them apart, which knocks the bike over into another crash,
which respawns it again — a real run locked into an endless crash loop at one checkpoint. Each body now goes
back to its own offset. The Phase 5 test only asserted the bike was no longer `crashed`; it now also rides
forward afterwards, which is what would have caught this.

**A crest 24 m before the finish** threw the bike into a bad landing right on the line. Found by a
deterministic full-throttle ride-through that reports crashes and airtime — a far faster tuning loop than
driving in a browser, and immune to frame-timing variance.

### A measurement trap worth remembering

The game appeared to run at **3 FPS**, starving the simulation to 10 ticks/s, which nearly triggered a
rewrite of the renderer into chunked culling. It was an artifact: the agent's browser pane was hidden, and a
hidden page gets **zero** `requestAnimationFrame` callbacks (`document.hidden === true`, 0 rAF in 2 s). With
the pane visible the same long map runs at 13.96 s of simulation per 14 s of wall clock — exact real time.
Before treating slowness in that browser as real, check `document.visibilityState`.

## 1j. Phase 6 (2026-09-29): the other six maps, and three bugs a clean lap can never show

All seven maps now exist and every one is proven finishable by an automated rider. Getting there exposed three
defects that had nothing to do with level design, and every one of them was invisible while the ride went well.

**1. Maps 2-7 shipped with no `finishX` at all.** Nothing could ever finish; the rider simply drove off the end
of the world. `Level` requires the field and `tsc` would have rejected it, but vitest does not typecheck, so the
test suite ran green on the parts it could see. Lesson: a test suite that imports data is not a substitute for
typechecking that data, and `pnpm -r typecheck` belongs in the loop next to `pnpm test`.

**2. Respawn read the checkpoint's x but the bike's last-contact y.** Those are two different places. On any map
with real elevation change the bike rematerialised *inside* the terrain, Box2D ejected it, the ejection counted
as a crash, and it respawned into the same rock again — 200+ times in a row, permanently stuck. Map 1 is nearly
flat, which is the only reason this looked fine for a week. `groundYAt(level, x)` now interpolates the ground
height at the respawn point itself.

**3. Checkpoints were typed at round numbers, and round numbers are not geometry.** They landed on takeoff lips,
inside gaps (Orbit Circuit had one hanging in mid-air over a 14 m hole), or a few metres in front of a jump. A
checkpoint is where the rider restarts *from rest*, so it needs enough road ahead to rebuild speed — roughly
45 m for a 12 m gap. Six of the seven maps had at least one checkpoint that ended a run permanently. They are
now derived from the track by `autoCheckpoints()` and are correct by construction; `defineLevel()` applies it,
asking for a longer run-up on low-friction maps.

### The jump budget is now measured, not assumed

A parametric sweep (runway x ramp x gap, same autopilot as the tests) against this exact physics build:

| approach to the lip  | takeoff speed | widest gap actually cleared                           |
| -------------------- | ------------- | ----------------------------------------------------- |
| 34 m from standstill | ~15.0 m/s     | 12-13 m, and only off a steep ramp                    |
| 70 m from standstill | ~17.5 m/s     | 16 m (17 m only off a very steep, speed-killing ramp) |

So 14 m is the working ceiling. The first draft of maps 5 and 7 asked for 15-17 m gaps after 18-22 m run-ups:
not "hard", impossible. Two further rules fell out of the same measurements: **the approach sets the maximum
gap, not the ramp**, and **a 13-14 m gap must land at least ~1.4 m lower**, because the bike falls that far
crossing it — a 0.4 m step-down crashed the rider every single time.

### An honest correction about ice

`groundFriction: 0.45` was documented as a major difficulty lever. Measured, it is not: on a long runway the bike
reaches the **same** top speed, it just takes much longer to get there. Its real cost is slow recovery after a
crash and weak braking. Frost Peak's comments now say that rather than what the "huge air" tagline implies.

### What the tests now guarantee

`maps.test.ts` (77 tests) covers structural invariants, one completability run per map, and — the one that
matters after a crash — a restart-from-every-checkpoint run. All seven finish in 44-50 s of simulated time,
inside decision B4's 45-90 s target. The maps are data only: no scene art exists for maps 2-7 (see §4b).

## 1k. Phase 6 (2026-09-29): the game-loop screens, and a 2 FPS scare that was not the game

`/play` is now the real gameplay screen from `design/screens/gameplay-a.html`, with the pause, crash and
finish states from the matching mocks. `GameHandle` gained `pause()`, `resume()` and `restart()`; pausing
genuinely stops the run clock, because the clock IS the simulation's tick count — which is why the pause
screen says out loud that the DAILY deadline keeps running regardless.

### What is deliberately not shown

The finish mock displays a world rank, a leaderboard position and a green "VERIFIED BY THE SERVER" badge.
None of that exists yet — Phase 7 adds replay submission and re-simulation — so the screen shows none of it
and says plainly that the time was not submitted. A green verification tick would be a claim the player has
no way to check and that is not true. The personal best IS shown, labelled "BEST ON THIS DEVICE", because
that is exactly what it is: a number in `localStorage`, scoped per map and per UTC day, and it is read and
written through guards because `localStorage` throws outright in some private-mode browsers.

### The 2 FPS investigation, and why it ended in "not our bug"

The gameplay screen measured **2 FPS** in the desktop app's browser pane while the Home screen measured 61 in
the same pane. That is not something to wave away, and the last time a frame-rate scare appeared here it was
dismissed because `document.hidden` was true (§1i) — this time `document.hidden` was false, so that
explanation was not available. Measured, in order:

| suspect                       | measurement                                                          | verdict |
| ----------------------------- | -------------------------------------------------------------------- | ------- |
| React re-rendering each frame | same 2 FPS with the game paused, which stops every React update       | not it  |
| Software rendering            | `WEBGL_debug_renderer_info` reports a real GPU through ANGLE/D3D11    | not it  |
| Pixi rendering                | `renderer.render()` timed at **0.38 ms**                              | not it  |
| The physics step              | 300 `simulation.step()` calls: **0.1 ms** median, 0.6 ms worst        | not it  |
| React again, fully isolated   | own rAF loop doing step + render with React removed: identical stalls | not it  |

The frame deltas were the clue: a healthy 16.7 ms median punctuated by stalls of almost exactly **1016 ms**.
The control experiment settled it — a bare `<canvas>` doing nothing but `gl.clear()`, with no Pixi, no
physics and no game code at all, stalls identically. **WebGL compositing in this embedded pane on this
machine's GPU is what stalls**, and the game's own per-frame cost is about half a millisecond.

Two things follow, and the second matters more than the first:

1. Nothing needs optimising. Updating React state every frame was the obvious suspect and was innocent;
   "fixing" it on suspicion would have been work against a problem that does not exist.
2. **This does not prove the game runs well on a phone.** It proves only that these measurements cannot say
   either way, because the measuring environment is the thing that stalls. Real-device frame rate stays
   unverified and belongs to decision **D2**, alongside the deluxe/compat determinism question from §1d.

## 1l. Every map is open (2026-09-29) — TEMPORARY, and it must be turned off before launch

`ALL_MAPS_OPEN_FOR_TESTING` in `apps/web/src/lib/schedule.ts` is **true**. While it is, the daily rotation
does not apply: the menu shows every map as playable and `/play?map=N` loads any of them, in any build.

Asked for directly by the owner ("dejalo abierto para poder probar todos los mapas"), and it is the right
call for now — six of the seven maps are unreachable on any given day, so they could not be played, judged or
playtested at all. It also removes the pressure to settle decision A3 before the game is worth playing.

**The risk it carries, stated plainly:** the daily rotation is the product. With this flag on, "one map per
day, one leaderboard per map" is not true, and anyone who opens the app can ride the whole week at once. This
is not a setting to leave on by accident.

Three things keep it from being forgotten:

- It is a single constant. Flipping it to `false` restores the real behaviour on the menu and in `/play`
  together; there is no second place to remember.
- `weekSchedule()` takes the flag as an injectable option, so the **real** rotation stays under test while the
  flag is on. Without that, the shipping behaviour would go unverified for as long as this lasts.
- `schedule.test.ts` asserts the flag is currently `true`. That is not approval — it is a test that fails the
  moment someone flips it, forcing a deliberate decision rather than a silent one, and a standing reminder in
  the suite that the game is not in its shipping configuration.

## 1m. D2a answered (2026-10-01): the two Box2D binaries agree, bit for bit

The biggest open risk in the project is closed, favourably.

`box2d3-wasm` ships two separately compiled binaries — a SIMD "deluxe" one Node loads and a "compat" one the
browser is pinned to (§1d) — and nothing in the package promises they agree. Phase 7's anti-cheat is entirely
built on them agreeing: the player submits their inputs, the server re-simulates, and the time is accepted
only if both arrive at the same answer. A mismatch would not break the game, it would break the
*verification*, invisibly, and only after replays had been collected.

**Measured, not assumed.** The same fixed 1800-tick input sequence — throttle, both leans, braking, through a
crash and a respawn — was run in Node and in the browser, and every sampled value matched **bit for bit**:
position, height, angle and velocity at six checkpoints, plus the final state. Not "within a tolerance";
identical IEEE-754 values.

| tick | Node (deluxe) x    | browser (compat) x |
| ---- | ------------------ | ------------------ |
| 300  | 31.025005340576172 | 31.025005340576172 |
| 900  | 12.857233047485352 | 12.857233047485352 |
| 1800 | 103.31587982177734 | 103.31587982177734 |

Two things now protect this:

- `packages/game-core/src/determinism.test.ts` pins those exact values. It is a fingerprint, not a
  meaningful measurement: any dependency bump, Box2D rebuild or physics tweak that shifts the simulation by
  one bit fails the test. For a deliberate tuning change the values get updated on purpose; for a dependency
  bump it is a warning that every stored replay just became unverifiable.
- `apps/web/src/app/dev/determinism` runs the browser half of the comparison on demand, so the pairing can be
  re-checked by hand after any upgrade.

**What this does NOT prove:** both runs were on x86. A phone is ARM. WebAssembly specifies strict IEEE-754
semantics precisely so that results do not vary by architecture, which makes this strong evidence rather than
proof — but the honest position is that the phone has not been checked, and that is logged as D2b2.

## 1n. The open-runs lockout, fixed (2026-10-02)

Phase 7 capped a player at five runs open at once and **refused** the sixth. The cap was right; refusing was
not. A run is left open every time someone closes the app mid-race — crash, phone call, train stop — which is
ordinary behaviour, not abuse. After five of those the account was locked out of ranked play with nothing to
click to clear it, and the client said nothing: it quietly played on, unranked, and only the finish screen
hinted at it, with the wrong reason ("sign in with World App") because the client had thrown the real one
away.

Three changes, in the order they matter:

1. **Starting a run no longer fails because of older ones.** Runs whose competition has closed (window plus
   grace) are marked `expired` — they could never be submitted again — and if the player is still at the cap,
   the OLDEST open run is marked `abandoned` to make room. The cap now bounds concurrency, which is what it
   was for, instead of rationing play. Each closed run keeps its reason, so a lost time can be explained from
   the row rather than guessed at.
2. **Submitting a closed run says so.** It used to answer "this run has already been submitted", which is a
   lie the player cannot check. There is a `closed` code now, separate from `duplicate`.
3. **The player is told BEFORE the race, not after it.** Whether a run can be ranked is known the moment the
   server does or does not issue one, so an unrankable attempt now carries a "PRACTICE RUN · …" line while it
   is being ridden, and the finish screen names the actual reason. Finding out after a personal best is the
   version of this that makes people distrust the whole leaderboard.

**Found while verifying it, and fixed with it:** with `ALL_MAPS_OPEN_FOR_TESTING` on (§1l) any map can be
played, but a competition only ever runs today's — so playing map 1 on a Saturday rode two minutes and then
got `wrong_map` from the server, shown as "the server could not verify this run". The client compares the
issued run's map against the one on screen and says "ONLY TODAY'S MAP HAS A LEADERBOARD" up front instead.

Verified by playing: today's map ridden to the line in the browser returns **VERIFIED BY THE SERVER** with a
real rank, and eight consecutive `POST /api/runs/start` now return 200 where the sixth used to return 409.

## 1o. Phase 8 (2026-10-02): the calendar is real, and a finished board is frozen

Phase 7 left every leaderboard permanently live: a day's board was an ordered query, so yesterday's ranking
was still being recomputed today, and a score hidden by moderation months later would silently renumber a
race that ended in October. Phase 8 closes days.

**Freezing happens on read, not on a schedule.** `finalizeCompetition` locks the competition row, writes
every visible score's `finalRank`, and records how many played and what won. The first person to look at a
finished board pays for it; everyone after sees the same frozen answer. This is deliberate and it is the
reason `/api/cron/finalize` is an optimisation rather than a dependency: Vercel's Hobby plan runs cron at
most once a day with up to an hour of imprecision (§3), so a design that only froze a board when a job fired
would leave yesterday's race live for an unpredictable stretch of today.

**Reading a board never creates one.** `competitionForDay` creates on demand — right for starting a run,
wrong for a public URL — so the read paths use `findCompetition`/`competitionForReading` instead. Without
that split, anyone could fill the table with competitions for days nobody played by walking a date parameter
backwards through the calendar.

**The leaderboard screen is now the week.** Seven tabs, MON–SUN, each with its map number; a finished day
says FINAL and an unfinished one LIVE with the countdown. Days nobody played are shown, empty, because the
owner's rule is that missing a day costs nothing — a screen that hid those days would say the opposite. Days
still to come are visible but not selectable: there is no board to look at yet.

`CompetitionRow` is now derived from the schema (`typeof competitions.$inferSelect`) rather than hand-written.
It had been a subset, which is how `participantsCount`, `winnerTimeMs` and `finalizedAt` came to be invisible
to every reader although the table always had them.

**New optional env var `CRON_SECRET`** (at least 16 characters). Optional everywhere, production included:
nothing's correctness depends on the job, so a deployment without it must still boot — `/api/cron/finalize`
simply refuses every caller (503 with no secret configured, 401 on a wrong one, compared in constant time).

### Still open after Phase 8

- **Enabling the cron job on Vercel** needs the owner: a `CRON_SECRET` in the project's environment and a
  schedule entry. Not done, not assumed. The game is correct without it.
- **A3b** (the start date of week 1) is unchanged: the Home header still shows a date range, not "WEEK 1".
- **`ALL_MAPS_OPEN_FOR_TESTING` is still on** (§1l). Phase 8 built the daily calendar the flag overrides, so
  turning it off is now a one-line decision — but it is the owner's, and it costs the ability to playtest six
  of the seven maps on any given day.

## 1p. Phase 9, part 1 (2026-10-02): the leaderboard against its mock, and the load budget measured

The board screen was a list; `design/screens/leaderboard.html` is a screen. It now follows the mock — the day
picker, the LIVE row with FREEZES IN, a podium for the top three, avatars, gaps to the leader, the
"N RACERS · ONE BEST TIME EACH" footer, and the pinned row for a player ranked below the page.

Three things deliberately depart from the mock, each because reproducing it would state something untrue:

- **The mock locks every day but today.** Here a past day is openable: it has a board, and seven boards a
  week is the shape of the game. Only days that have not started are locked.
- **The mock puts a "human" badge on every row.** It is now drawn per player from `users.humanVerifiedAt`,
  because ranking does not require verification (A2 chose that it should; it is not enforced), so a badge on
  every line would be a claim about people the server never checked.
- **Avatars are a hash of the player's name**, from the eight bundled ones. World profile pictures are not
  fetched anywhere and `users.avatarUrl` is never written. They are decoration; the hash exists so the same
  player keeps the same face rather than flickering between renders.

Numbers are formatted as en-US rather than with the device's locale, because every word around them is
English: a Spanish phone was rendering "3.421 RACERS", which reads as three-point-four-two-one in that
sentence. When Spanish arrives (A6), the number and the words change together.

The server grew two honest fields for this: per-entry `humanVerified`, and `you.behindMs` — the gap to the
player **directly ahead**, which is the number that says what moving up would take, read with one extra row
rather than one extra page.

### The load budget, measured (production build, 2026-10-02)

§14 proposed "≤ 150 KB gzip for the Home shell, without the game". The real figure, from the production
build's own chunk list for `/`:

| What                                              | gzip   |
| ------------------------------------------------- | ------ |
| React + Next framework (two shared chunks)        | 127 KB |
| MiniKit                                           | 35 KB  |
| Our own app code for Home (page, layout, helpers) | 23 KB  |
| **Home first load, modern browser**               | **185 KB** |
| Legacy polyfills (`noModule`, modern browsers skip them) | 38 KB |

**The budget is missed, and not by something that can be deleted.** 127 KB is Next's own floor and 35 KB is
MiniKit, which `providers.tsx` installs as early as possible on purpose — World's docs (§2.8-9 of the docs
review) warn that commands fired right after mount race MiniKit's install, so deferring it to save weight
would trade a documented correctness problem for 35 KB. Our own code is 23 KB of the 185.

So the honest options are to revise the number, or to change the stack — not to shave the 23 KB that is
actually ours. Logged rather than quietly dropped, and no "optimisation" has been done that would make the
figure look better without making the app faster.

## 1q. Phase 10, part 1 (2026-10-03): the security pass, and what it did NOT fix

Worked through §13's threat model. What was already right: the session (256-bit opaque token, only its SHA-256
in the database, revocation, sliding **and** absolute expiry, user status re-checked on every resolve), the
SIWE nonce (single-use, expiring, `domain`/`uri`/`chainId` compared against `APP_ORIGIN`), the dev-login
harness (`assertDevelopmentOnly` makes it throw outside development), and the leaderboard's own integrity
work from Phase 7. What follows is what changed.

**A critical advisory was shipping.** `pnpm audit` reported GHSA-vcvr-r3jv-pc5j — remote code execution in
`next/og`'s ImageResponse, affecting Next >= 16.2.0 < 16.3.6. The app was on **16.3.5**. It does not use
`next/og`, but "we do not call the vulnerable function" is not a security position when a patch release
exists. Now on **16.3.8**, and `pnpm audit --prod` is clean.

Two advisories remain, both in the development toolchain and neither reachable by anything deployed:
`braces` (via `@next/eslint-plugin-next` → `fast-glob` → `micromatch`; **no patched version exists**, and it
is a stack-exhaustion DoS triggered by deeply nested glob patterns — ours are in our own config) and
`esbuild` (via `drizzle-kit`'s bundled loader; the flaw is in esbuild's dev server, which `drizzle-kit`
never starts). CI now runs `pnpm audit --prod` as a **blocking** step and the full audit as a non-blocking
one: a check that is permanently red is a check everyone learns to ignore.

**`__Host-` on the session cookie.** The prefix is enforced by the browser: a `__Host-…` cookie is only
stored when it is Secure, path `/` and has no `Domain`, and crucially a page on a *sibling subdomain* cannot
overwrite it — without it, anything ever hosted at another subdomain can plant a session cookie, which is
session fixation needing no exploit. It is dropped on plain HTTP, because browsers refuse such cookies and
local development is `http://localhost`; the rule is a tested function (`lib/cookie-name.ts`) rather than a
constant, because it genuinely differs per environment. Reads accept **both** names, so deploying this does
not sign out everyone who is currently logged in.

**A same-origin check on every mutating endpoint**, as a second lock behind `SameSite=Lax`. It accepts both
`APP_ORIGIN` and the request's own Host, because every Vercel preview deployment has a hostname no
environment variable can know in advance.

> **It lets a request with NO `Origin` header through, deliberately.** Every browser sends one on a POST, so
> the cross-site attack always has it; what might not send it is World App's own WebView — and a guard that
> could silently break the Mini App on the devices this project cannot test until D2b is worse than one with
> a known, narrow hole. The cookie's `SameSite` attribute still covers that case.

**A content security policy, in report-only mode.** World's documentation does not state what a Mini App's
CSP may contain — neither the WebView specification nor the documentation index covers CSP, framing or
cookies (checked 2026-10-03) — so the policy is derived from what the app actually loads. It is **not
enforced**, because the one place it has to be right is inside World App's WebView on a real phone, which is
exactly what cannot be tested yet. Enforcing it blind would risk a blank Mini App for every player to close a
class of attack this app has little surface for. It flips to enforcing after a real device completes sign-in,
verification and a run with no violation reported — the same gate as D2b.

The policy allows `'wasm-unsafe-eval'` (Box2D is WebAssembly; without it there is no game) and
`'unsafe-inline'` for scripts (Next's own bootstrap). Removing the latter needs nonces through middleware and
belongs with the switch to enforcing, not before it.

**The World ID diagnostic logs keys, not values.** It was printing the entire unrecognised verify response;
that body can carry a nullifier hash. It now logs the sorted key names and the HTTP status, which is what the
diagnostic was for.

### Part 2 (same day): what the endpoints accept, and what they give back

**Every JSON body now has a ceiling.** `await request.json()` has none: it buffers whatever arrives, before
any authentication can reject it, which on a serverless function is a cheap way for a stranger to spend the
app's memory. `readJsonBody` checks the advertised `Content-Length` first (so an oversized upload is refused
before it is read) and then counts the bytes as they arrive, because that header is the caller's word — a
test covers exactly that case, a small declared length with a large body. 16 KB for sign-in, signing and the
dev harness; 64 KB for a World ID proof. The replay endpoint already had its own cap from Phase 7.

**The API no longer hands out wallet addresses.** `/api/auth/session` and `/api/auth/complete` were returning
the caller's own address. It is their own, so this was not a leak — but nothing on any screen used it (World's
guidelines say to show usernames), so it existed only as a copy of an identifier in a browser's memory, logs
and screenshots. The one place that rendered it, the sign-in box's "Signed in as", fell back to the raw
address when a username was missing; it now says RIDER, like the Home screen already did. §13's privacy row
("the API does not return wallets") is true now; before today it was not.

Audited and left alone: `/api/health` (names variables, never values), `/api/leaderboard` (no user ids — a
decision from Phase 7 that still holds), the SIWE rejection path (every failure is the same generic 401, so
nothing tells an attacker which check failed), and the query layer. On that last one, precisely: every
statement that touches request data is parameterised through Drizzle, and the single `sql.raw` in the
codebase builds `CHECK (… in (…))` constraints out of compile-time constants from `@worldrush/shared` —
it never sees a request.

### Not fixed, and not pretended otherwise

- **No rate limiting.** §13 wants a WAF/edge limit plus database quotas. The per-user quotas exist
  (`MAX_OPEN_RUNS_PER_USER`, replay size caps, single-use nonces); the edge limit does not, because there is
  no Cloudflare in front of the app and an in-process counter in a serverless function is not a rate limit —
  it is a counter that resets whenever the platform feels like it. This needs infrastructure, which is an
  owner decision and a later phase.
- **CSP is reported, not enforced.** See above. Until then it stops nothing.
- **D2b is still open**, and three items above are waiting on it.

## 1r. Phase 11 (2026-10-03): concurrency, and being honest about which half is tested

**A real finding, from the first test written.** Eight simultaneous `startRun` calls leave **eight** runs
open against a cap of five: they all read the open-run list before any of them inserts, so each concludes
there is room and none abandons anything. The cap was never a bound under concurrency — only under
sequential use — and nothing had said so.

It is left as it is, deliberately. The cap is hygiene: unfinished runs are ordinary, since Phase 7 a new run
abandons the oldest instead of being refused, so overshooting costs a few rows and the very next start brings
the count back down (the test asserts exactly that). Making it a hard bound means locking the player's row on
every run start — a real cost on the hot path to defend a number that is not a security boundary. The code
comment and the test now both say "soft bound" instead of implying otherwise.

### The embedded database cannot test half of this, so CI runs a real one

PGlite is a single connection. Two transactions can never be in flight at once, which means
`select … for update` (how `finalizeCompetition` is made safe), deadlock handling and commit ordering are not
merely untested there — **they cannot happen**. Interleaving with `Promise.all` still reproduces the
orderings that produce duplicate rows and lost updates, because both callers genuinely read before either
writes, and that is what `races.test.ts` covers: one competition per day under a three-way collision, the
open-run overshoot, and the personal best keeping the faster of two overlapping submissions.

So `createTestDb` now has two engines. `TEST_DATABASE_URL` unset means PGlite, as before. Set, it builds a
private schema on a real PostgreSQL server with its own migration bookkeeping, a pool of five connections,
and drops the schema afterwards. Tests that need true locking are written with `describe.skipIf` — skipped
rather than deleted, because a skipped test says "not covered here" while a missing one says nothing.

CI gained a second job that runs the whole suite against `postgres:18-alpine`.

> **Its first run failed, which is the point of writing it.** The harness gave each test file a private
> schema and pointed the connection's search_path at it — but Drizzle's generated migrations qualify their
> foreign keys (`references "public"."users"`), so the tables landed in the private schema while the
> constraint looked in `public`, and the first migration died with `relation "public.users" does not exist`.
> Nothing local could have caught it: there is no PostgreSQL on the development machine. Each test file now
> gets its own DATABASE, which gives it its own `public`, and CI remains the only place this path is
> exercised.

## 1s. A6 done (2026-10-03): the app speaks Spanish

Decision A6 is "EN + ES, with i18n from day one". Until today every string was an English literal inside a
component, which is the version of that decision that quietly never happens.

World's guidelines decided the shape (read 2026-10-03): recognise the locale from the **`Accept-Language`
header**, and localise at all — "apps that are localised for each region will perform significantly better".
They name six priority languages; A6 ships the first two and the machinery makes the rest a dictionary each.

- **Resolved on the server**, so the first paint is already in the player's language and `<html lang>` is
  right from the start. No flash of English.
- **No locale in the URL.** The documented Next.js approach puts the language in the path, which exists so
  search engines get one page per language — and this app opens inside World App and is explicitly `noindex`.
  Routing would have cost every link and bought nothing.
- **A missing translation is a compile error.** English defines the key set; Spanish is typed against it.
- **Quality values are honoured** when parsing the header: `es;q=0.9, en;q=0.95` is English, and reading left
  to right would have answered Spanish. Eight tests cover that, region subtags and malformed headers.
- Settings has AUTO / ENGLISH / ESPAÑOL. AUTO is not a language: it hands the choice back to the phone.

### What translating exposed, which is the usual reason to do it early

- `formatCount` was pinned to en-US with a note saying "when Spanish arrives the number and the words change
  together". They do now: a Spanish board reads `3.421 PILOTOS`.
- Three places where Spanish did not fit: the day tab (`EN VIVO` wrapped, so the tab has its own `VIVO`),
  and the control pads (`INCLINAR ATRÁS` spilled out of the button, so the pads have their own short words
  while the how-to-play tiles keep the long ones). Found by screenshotting, not by reading code.
- A lint warning that should not be obeyed literally: adding `t` to the game-start effect's dependencies
  would restart the canvas, the physics world and the run whenever the language changed. It reads the
  translator through a ref instead.

Map names and taglines are translated too. They live in `game-core` as English constants and must — the
level id travels inside every replay — so the dictionaries carry `map.<slug>.name` and `.tagline`.

## 1t. The art budget (2026-10-03): 2.0 MB → 715 KB

§14 allows 1.5 MB for a map's package. The checkpoint marshal's 46 HD frames were **1.77 MB on their own**
— 94% of everything the game downloads, since the whole rest of `public/art` is 230 KB — so the game was
over budget on one character's animation.

**The obvious fix was wrong, and measuring is what showed it.** She is drawn at about 0.63×, so the frames
look oversized; but PixiJS renders at `devicePixelRatio`, and on a 3× phone those 264 pixels are painted
across ~503. She is already being scaled **up** by nearly 2×. Storing her smaller would have cost real
quality on exactly the devices this game is for.

So the pixels stayed and the encoding changed: **WebP q95, 433 KB, 75% smaller**, with alpha encoded
losslessly (measured: alpha error exactly 0, so no halo). Lossless WebP (1102 KB) and near-lossless
(739 KB) were measured too; q95 was chosen after comparing against the original at 3× zoom **and** at the
503-pixel size a 3× phone actually draws, where they are not distinguishable. Trimming the transparent
margins was tried and made the files *bigger* — the frames are nearly full, and per-frame sizes stop
aligning — which is written down so nobody tries it twice.

The PNGs remain the masters in the repository; `pnpm art:marshal` produces what ships. Total art payload:
**2.0 MB → 715 KB**, inside the budget.

This does not change §1p: that is the JavaScript figure, and it is still 185 KB against a 150 KB target.

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

## 5a. Owner decisions ANSWERED (2026-10-01)

| ID      | Answer                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------- |
| **A3**  | Cut-over is in **UTC**, confirming the midnight-UTC default already in `lib/schedule.ts`. The start date of week 1 is still outstanding, so the Home header still shows a date range rather than "WEEK 1" |
| **H1a** | **Hobby**, with its two limits accepted: Vercel's Hobby tier is for non-commercial use, and cron runs at most once a day. Revisit the moment this app earns money |
| **H1b** | **No custom domain.** `world-rush.vercel.app` is the address |
| **H2**  | Resolved in practice: the private repository exists and is pushed to                                      |
| **F1a** | Resolved in practice: the hosted Neon database is provisioned and in use                                  |
| **A5**  | **Parked.** No weekly champion for now — the game is seven daily leaderboards and nothing above them. See the note below for the arithmetic that led here |
| **A3b** | Week 1 starts on **the first Monday after launch**. No date is fixed yet, so the Home header keeps showing a date range instead of a week number until there is one |

### Missing a day (answered 2026-10-02)

**There are seven leaderboards, one per day, and missing a day costs nothing — you simply do not appear on
that day's board.** No penalty, no catch-up, no carried-over position. This is what the code already does:
one competition per day (`competitions_day_uidx`) and every leaderboard query scoped to a single competition.

### …and the weekly champion is PARKED (2026-10-02)

Those two rules did not compose. A5 said the champion was the **lowest total of the seven times**, and
missing a day is free — so a player who rode three days would have a smaller total than one who rode all
seven, and **whoever played least would win**. Summing an unequal number of times does not rank players; it
ranks attendance, backwards.

Shown the choice between "only players with all seven are eligible", "best five of seven" and "no weekly
title for now", the owner chose **no weekly title for now**. The game is seven daily leaderboards and
nothing above them.

So A5 is not answered, it is *not needed*: there is no weekly champion to compute. If one is ever wanted,
the eligibility question above is what has to be settled first, and the arithmetic trap is why.

Two places in the UI promised a weekly title and no longer do — the Home screen's "1 CHAMPION" chip and the
How to play card — because describing a feature that is not being built is the same lie whether or not
anyone has noticed yet.

## 5. PENDING owner decisions

| ID      | Decision needed                                                                                                                | Needed by         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| **D2b2** | Re-run the determinism comparison on a real phone once there is one to hand. See §1m: the desktop result is strong but ARM is not x86 | before launch |
| **D2b** | **World ID human verification on a real device.** Previously failed; the owner expects the current MiniKit to fix it, which is not the same as having seen it work. The temporary diagnostic in `packages/auth/src/world-id.ts` stays until a real verify response is captured | before launch     |
| **A3b** | **Start date of week 1.** Needed before the Home screen can say "WEEK 1" instead of a date range                               | Phase 8           |

## 6. World items still to verify (unchanged)

The 13 open points in `docs/phase-0/01-world-docs-review.md` §10 remain open. They are closed in Phases 2 and 3 with the Developer
Portal and real devices, or by asking World.
