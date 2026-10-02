'use client';

import Link from 'next/link';
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
  readonly label: string;
  readonly icon: IconName;
  readonly href?: string;
  readonly note?: string;
}[] = [
  { id: 'home', label: 'HOME', icon: 'home', href: '/' },
  { id: 'leaderboard', label: 'LEADERBOARD', icon: 'trophy', note: 'Coming in Phase 7' },
  { id: 'how', label: 'HOW TO PLAY', icon: 'help', href: '/how-to-play' },
  { id: 'settings', label: 'SETTINGS', icon: 'gear', href: '/settings' },
];

export function TabBar({ active }: { active: string }) {
  return (
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
            {tab.label}
          </Link>
        ) : (
          <span key={tab.id} className="tab" aria-disabled="true" title={tab.note}>
            <Icon name={tab.icon} />
            {tab.label}
          </span>
        ),
      )}
    </nav>
  );
}
