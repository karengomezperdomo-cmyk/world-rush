'use client';

import { ALL_MAPS_OPEN_FOR_TESTING } from '../../../lib/schedule';
import type { MessageKey } from '../../../lib/i18n/messages';
import { useTranslation } from '../../../lib/i18n/provider';
import { Icon, type IconName } from '../../_components/IconSprite';
import { TabBar } from '../../_components/TabBar';

/**
 * How to play, from `design/screens/how-to-play.html`.
 *
 * Three lines of the mock's copy are deliberately NOT reproduced, because they would be untrue today:
 *
 * - "BRAKE · REVERSE". The brake does not reverse. It sets the rear wheel's motor speed to zero with a high
 *   torque (`bike-sim.ts`), which stops the bike; there is no reverse gear to describe.
 * - "The server checks every run" was held back while that was untrue. Phase 7 built it, so the card is
 *   here now. The instructions track what the game does, in both directions: a claim gets added the moment
 *   it becomes true and removed the moment it stops being.
 * - "One map a day" is the design, but `ALL_MAPS_OPEN_FOR_TESTING` currently overrides it, so the card says
 *   whichever is actually true right now.
 *
 * The mock's weekly-champion card is not reproduced either. A weekly title was considered and then parked
 * (decision A5), so promising one here would be describing a feature that does not exist and is not being
 * built. The card says what IS true instead: seven days, seven boards, and no penalty for missing one.
 */

function Card({
  icon,
  title,
  children,
  tone,
}: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
  tone?: 'gold';
}) {
  return (
    <div className={tone === 'gold' ? 'card gold notch' : 'card notch'}>
      <div className="ico notch">
        <Icon name={icon} />
      </div>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}

const CONTROLS: readonly { art: string; label: MessageKey }[] = [
  { art: 'gas', label: 'how.gas' },
  { art: 'brake', label: 'how.brake' },
  { art: 'lean-back', label: 'how.leanBack' },
  { art: 'lean-forward', label: 'how.leanForward' },
];

export function HowToPlay() {
  const { t } = useTranslation();
  return (
    <div className="screen">
      <div className="page">
        <div className="title-row">
          <h1>{t('how.title')}</h1>
          {/* The strapline has to agree with the card below it: saying "one map a day" while every map is
              open would contradict the first thing the player reads. */}
          <p>{t(ALL_MAPS_OPEN_FOR_TESTING ? 'how.strapline' : 'how.straplineDaily')}</p>
        </div>

        {ALL_MAPS_OPEN_FOR_TESTING ? (
          <Card icon="calendar" title={t('how.allOpen')}>
            {t('how.allOpenBody')}
          </Card>
        ) : (
          <Card icon="calendar" title={t('how.daily')}>
            {t('how.dailyBody')}
          </Card>
        )}

        <div className="card notch" style={{ flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div className="ico notch">
              <Icon name="gamepad" />
            </div>
            <div>
              <h3>{t('how.controls')}</h3>
              <p>{t('how.controlsBody')}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
            {CONTROLS.map((control) => (
              <div className="ctl notch" key={control.art}>
                {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
                <img className="ctl-art pix" src={`/art/controls/${control.art}.png`} alt="" />
                {t(control.label)}
              </div>
            ))}
          </div>
        </div>

        <Card icon="clock" title={t('how.bestTime')}>
          {t('how.bestTimeBody')}
        </Card>

        <Card icon="ring" title={t('how.oneHuman')}>
          {t('how.oneHumanBody')}
        </Card>

        <Card icon="check" title={t('how.serverTimes')}>
          {t('how.serverTimesBody')}
        </Card>

        <Card icon="trophy" title={t('how.sevenBoards')} tone="gold">
          {t('how.sevenBoardsBody')}
        </Card>
      </div>

      <TabBar active="how" />
    </div>
  );
}
