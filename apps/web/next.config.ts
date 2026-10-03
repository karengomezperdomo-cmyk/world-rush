import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

/**
 * The content security policy — **reported, not enforced, and that is the whole point for now.**
 *
 * World's own documentation does not state what a Mini App's CSP may contain: neither the WebView
 * specification nor the documentation index covers CSP, framing or cookie requirements (checked
 * 2026-10-03). So this policy is derived from what the app actually loads, not from a spec, and the one
 * place it has to be right — inside World App's WebView on a real phone — is the one place it cannot be
 * tested until decision D2b happens. Shipping it as enforcing would risk a blank Mini App for every player,
 * to fix a class of attack this app has little surface for; shipping it as report-only shows the violations
 * in the console with nothing at stake. It is flipped to `Content-Security-Policy` once a real device has
 * been through sign-in, verification and a run without a violation.
 *
 * Why each line is the way it is:
 *
 * - `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`. The inline allowance is Next's own bootstrap
 *   scripts; removing it needs nonces through middleware, which is its own change and belongs with the
 *   switch to enforcing. `wasm-unsafe-eval` is the physics: Box2D is WebAssembly, and without it the game
 *   does not run at all. It is NOT `unsafe-eval` — nothing here calls `eval`.
 * - `connect-src 'self'`. Every request the app makes goes to its own API. MiniKit talks to World App
 *   through the WebView bridge, not over the network, so no World origin belongs here; if the report-only
 *   run shows otherwise, the report is what adds it, not a guess made today.
 * - `img-src 'self' data: blob:` — the art is local; `blob:`/`data:` are for canvas work.
 * - `frame-ancestors 'none'`. A Mini App is loaded as a WebView document, not framed by a web page. If
 *   World App turns out to frame it, the report-only run says so before anything breaks.
 * - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`: no plugins, no base-tag hijacking, no
 *   form posting the session somewhere else. Nothing in the app needs any of the three.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages are consumed as TypeScript source (no separate build step).
  transpilePackages: [
    '@worldrush/auth',
    '@worldrush/config',
    '@worldrush/db',
    '@worldrush/game-client',
    '@worldrush/game-core',
    '@worldrush/shared',
  ],
  // In a monorepo, Next's own output-file tracing only looks inside this app's directory by default —
  // everything imported from `../../packages/*` above falls outside that by design (confirmed via Next's
  // own docs, "output" config page, "Caveats"). Without this, tracing silently drops those files from the
  // deployment output, which on Vercel doesn't fail the build (it "succeeds") — it produces a routing
  // manifest Vercel can't actually serve anything from, so every route 404s in production while working
  // fine locally. Root two levels up from this file is the monorepo root (pnpm-workspace.yaml).
  outputFileTracingRoot: join(dirname(fileURLToPath(import.meta.url)), '../..'),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // REPORT-ONLY on purpose. See the note above the policy.
          { key: 'Content-Security-Policy-Report-Only', value: CONTENT_SECURITY_POLICY },
        ],
      },
    ];
  },
};

export default config;
