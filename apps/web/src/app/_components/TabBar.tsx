'use client';

import Link from 'next/link';
import type { MessageKey } from '../../lib/i18n/messages';
import { useTranslation } from '../../lib/i18n/provider';
import { useOnline } from '../../lib/online';
import { Icon, type IconName } from './IconSprite';

/**
 * The four-tab bar every screen shares. World's Mini App guidelines are explicit about this: "Use tab
 * navigation to simplify movement within the app" and "Provide clear and direct navigation without hamburger
 * menus" (docs.world.org, Mini Apps → App Guidelines).
 *
 * A tab whose screen is not built yet is rendered as disabled rather than as a link to a dead route — and
 * REWARDS stays out entirely until it is real (decision A7).
 */

const TABS: readonly {
  readonly id: string;
  readonly label: MessageKey;
  readonly icon: IconName;
  readonly href?: string;
  readonly note?: string;
}[] = [
  { id: 'home', label: 'tabs.home', icon: 'home', href: '/' },
  { id: 'leaderboard', label: 'tabs.leaderboard', icon: 'trophy', href: '/leaderboard' },
  { id: 'how', label: 'tabs.howToPlay', icon: 'help', href: '/how-to-play' },
  { id: 'settings', label: 'tabs.settings', icon: 'gear', href: '/settings' },
];

export function TabBar({ active }: { active: string }) {
  const online = useOnline();
  const { t } = useTranslation();
  return (
    <>
      {/* Said once, where every screen already looks: without a connection the game still plays, but nothing
          reaches the board. The wording promises no retry, because there is none — a run finished offline is
          not queued for later. */}
      {!online && (
        <p className="offline-strip notch" role="status">
          {t('offline.strip')}
        </p>
      )}
      <nav className="tabbar">
        {TABS.map((tab) =>
          tab.href ? (
            <Link
              key={tab.id}
              className={tab.id === active ? 'tab on' : 'tab'}
              href={tab.href}
              aria-current={tab.id === active ? 'page' : undefined}
            >
              <Icon name={tab.icon} />
              {t(tab.label)}
            </Link>
          ) : (
            <span key={tab.id} className="tab" aria-disabled="true" title={tab.note}>
              <Icon name={tab.icon} />
              {t(tab.label)}
            </span>
          ),
        )}
      </nav>
    </>
  );
}
