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
