import { BRAND } from '@worldrush/shared';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { getWorldMiniAppConfig } from '../lib/world-config';
import { IconSprite } from './_components/IconSprite';
import { Providers } from './providers';
// Order matters: the copied design system first, then the app's own overrides on top of it.
import '../design/tokens.css';
import '../design/ui.css';
import '../design/game.css';
import '../design/screens.css';
import './globals.css';

export const metadata: Metadata = {
  title: BRAND.name,
  description: 'Daily motorcycle time trial. One map per day, one leaderboard per map.',
  // A Mini App is opened from World App, not discovered through search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Required for env(safe-area-inset-*) to work on notched devices.
  viewportFit: 'cover',
  themeColor: '#0b1020',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const miniAppConfig = getWorldMiniAppConfig();
  return (
    <html lang="en">
      <body>
        <IconSprite />
        <Providers miniAppId={miniAppConfig?.miniAppId}>{children}</Providers>
      </body>
    </html>
  );
}
