import { BRAND } from '@worldrush/shared';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { localeFromAcceptLanguage } from '../lib/i18n/locale';
import { TranslationProvider } from '../lib/i18n/provider';
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

/**
 * The locale is resolved here, on the server, from the request's own `Accept-Language` header — which is
 * what World's guidelines say to use (docs.world.org, Mini Apps → App Guidelines). Doing it here means the
 * first paint is already in the player's language and `<html lang>` is right from the start, instead of a
 * flash of English while the browser works it out.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const miniAppConfig = getWorldMiniAppConfig();
  const locale = localeFromAcceptLanguage((await headers()).get('accept-language'));
  return (
    <html lang={locale}>
      <body>
        <IconSprite />
        <TranslationProvider serverLocale={locale}>
          <Providers miniAppId={miniAppConfig?.miniAppId}>{children}</Providers>
        </TranslationProvider>
      </body>
    </html>
  );
}
