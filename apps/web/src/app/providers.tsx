'use client';

import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';
import type { ReactNode } from 'react';

/**
 * Installs MiniKit as early as possible (docs/phase-0/01-world-docs-review.md §2.8-9: commands fired from a
 * separate effect right after mount can race MiniKit's own install). `miniAppId` is undefined until decision
 * D1 happens (the owner creates the Developer Portal app); MiniKitProvider works without it, but
 * `MiniKit.isInstalled()` still only ever returns true inside World App itself, never in a normal browser.
 */
export function Providers({ children, miniAppId }: { children: ReactNode; miniAppId?: string }) {
  return (
    <MiniKitProvider props={miniAppId ? { appId: miniAppId } : undefined}>
      {children}
    </MiniKitProvider>
  );
}
