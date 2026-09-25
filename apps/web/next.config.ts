import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

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
          // Content-Security-Policy and framing rules are added in Phase 10, once the exact origins used by
          // MiniKit/IDKit inside World App are known (a wrong CSP would break the Mini App in the WebView).
        ],
      },
    ];
  },
};

export default config;
