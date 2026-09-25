# RUSH 7 (codename WORLD RUSH)

Daily motorcycle time-trial Mini App for World App: one map per day, one leaderboard per map, and every time is
validated by the server.

> **Status: Phase 2 (MiniKit wallet-auth + World ID) in progress.** The game and leaderboard are not built yet.
> The public name "RUSH 7" is provisional (see `docs/DECISIONS.md`).

## Requirements

- Node.js 24 (`.nvmrc`).
- pnpm 12, pinned in `package.json`. Enable it with `corepack enable` (on Windows this may need an
  administrator shell) or `npm install -g pnpm`.

## Getting started

```bash
pnpm install
cp .env.example apps/web/.env.local     # Windows PowerShell: Copy-Item .env.example apps/web/.env.local
pnpm dev                                # http://localhost:3000, health check at /api/health
pnpm check                              # format + typecheck + lint + guards + tests + build
```

`APP_ENV` has no default on purpose: a missing value stops the server at start instead of silently running as
development.

### Trying the auth flow without a phone

MiniKit only runs inside World App, and the Developer Portal apps do not exist yet (decision D1) — so
`curl -X POST localhost:3000/api/dev/fake-login` mints a session for a throwaway wallet address in development only
(it 500s outside `APP_ENV=development`; see `packages/config/src/guards.ts`). Follow with
`curl localhost:3000/api/auth/session` (send the `Set-Cookie` header back) to see it resolve. This is a test tool,
not a security control. See `docs/DECISIONS.md` §1c for what real wallet-auth/World ID testing still needs.

## Layout

| Path                 | What                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `apps/web`           | The Mini App (Next.js): UI and API routes                                                 |
| `packages/auth`      | Wallet-auth (SIWE) and World ID verification, sessions — framework-agnostic, DB-backed    |
| `packages/game-core` | Deterministic simulation shared by client and server (skeleton; see its README)           |
| `packages/db`        | Drizzle schema, SQL migrations, embedded PostgreSQL (PGlite) for development and tests    |
| `packages/config`    | Environment validation and the guards that keep environments apart                        |
| `packages/shared`    | Constants, injectable clock, competition time rules, formatting                           |
| `design/`            | Design board, screen mocks (HTML + PNG), tokens, provisional art (see `design/README.md`) |
| `tools/`             | `art/` (procedural pixel-art generator) and `design/` (mock renderer and static server)   |
| `scripts`            | Repository guards (forbidden APIs, secrets) and their tests                               |
| `docs`               | Phase 0 research, decision log, game design (GDD)                                         |

Packages created later, when they have content: `packages/server` (Phase 3), `packages/game-client` (Phase 5),
`apps/admin` (Phase 9).

## Rules enforced by tooling (not by good intentions)

- **No secrets in the browser or the repo:** `pnpm guards` fails on secret-like `NEXT_PUBLIC_*` names, committed
  `.env` files and obvious secret literals.
- **No wallet spend or permission requests without approval:** `pnpm guards` forbids `MiniKit.pay`,
  `sendTransaction`, `signMessage`, `requestPermission` (decision D3) and removed or deprecated World APIs.
- **The simulation stays deterministic:** ESLint bans engine-dependent math (`Math.sin`, `**`, ...), host time and
  framework imports inside `packages/game-core`, and a test proves the rules are active.
- **Environments cannot be mixed:** with an incoherent configuration (for example `APP_ENV=production` on a preview
  deployment, or without a hosted database) the app fails closed: every route answers HTTP 500 and the log names the
  offending variables. A database marked for another environment is refused by `assertDatabaseEnvironment`
  (`packages/db`), checked every time `apps/web/src/lib/db.ts` opens a connection. That file only knows how to open
  the embedded development database so far; a `DATABASE_URL` (staging/production) makes it throw on purpose — the
  hosted Postgres driver is Phase 4 work.

## Documentation

- `docs/phase-0/00-README.md`: research, architecture proposal, database schema, World checklist.
- `docs/DECISIONS.md`: decision log (what was decided, by whom, and what is still open).
