'use client';

import { ALL_MAPS_OPEN_FOR_TESTING } from '../../../lib/schedule';
import { Icon, type IconName } from '../../_components/IconSprite';
import { TabBar } from '../../_components/TabBar';

/**
 * How to play, from `design/screens/how-to-play.html`.
 *
 * Three lines of the mock's copy are deliberately NOT reproduced, because they would be untrue today:
 *
 * - "BRAKE · REVERSE". The brake does not reverse. It sets the rear wheel's motor speed to zero with a high
 *   torque (`bike-sim.ts`), which stops the bike; there is no reverse gear to describe.
 * - "The server checks every run, so a time is only official once it is verified." Nothing is submitted or
 *   verified yet — that is Phase 7. Printing it on the instructions would be telling players their times are
 *   policed when they are not, which is exactly the kind of false assurance this project does not give.
 * - "One map a day" is the design, but `ALL_MAPS_OPEN_FOR_TESTING` currently overrides it, so the card says
 *   whichever is actually true right now.
 *
 * The weekly-champion card, blank in the mock, can now be filled in: decision A5 is lowest total time.
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

const CONTROLS: readonly { art: string; label: string }[] = [
  { art: 'gas', label: 'GAS · GO' },
  { art: 'brake', label: 'BRAKE · STOP' },
  { art: 'lean-back', label: 'LEAN BACK' },
  { art: 'lean-forward', label: 'LEAN FWD' },
];

export function HowToPlay() {
  return (
    <div className="screen">
      <div className="page">
        <div className="title-row">
          <h1>HOW TO PLAY</h1>
          {/* The strapline has to agree with the card below it: saying "one map a day" while every map is
              open would contradict the first thing the player reads. */}
          <p>{ALL_MAPS_OPEN_FOR_TESTING ? 'BEAT THE CLOCK' : 'BEAT THE CLOCK · ONE MAP A DAY'}</p>
        </div>

        {ALL_MAPS_OPEN_FOR_TESTING ? (
          <Card icon="calendar" title="EVERY MAP IS OPEN RIGHT NOW">
            While the game is being tested, all seven maps can be played whenever you like. Normally one opens
            each day at 00:00 UTC and its leaderboard freezes when the day ends.
          </Card>
        ) : (
          <Card icon="calendar" title="ONE MAP EVERY DAY">
            A new map opens each day at 00:00 UTC. When the day ends, that leaderboard freezes for good.
          </Card>
        )}

        <div className="card notch" style={{ flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div className="ico notch">
              <Icon name="gamepad" />
            </div>
            <div>
              <h3>CONTROLS</h3>
              <p>Four buttons. Hold to keep them pressed.</p>
            </div>
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}
          >
            {CONTROLS.map((control) => (
              <div className="ctl notch" key={control.art}>
                {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
                <img className="ctl-art pix" src={`/art/controls/${control.art}.png`} alt="" />
                {control.label}
              </div>
            ))}
          </div>
        </div>

        <Card icon="clock" title="YOUR BEST TIME COUNTS">
          Crash and you respawn at the last checkpoint, with the clock still running. Retry as often as you
          like — only your fastest run counts.
        </Card>

        <Card icon="ring" title="ONE HUMAN, ONE SPOT">
          World ID proves you are a real person, so one human gets one place on the board. Submitting times to
          a server that re-checks every run is still being built; for now your best time is kept on your own
          device.
        </Card>

        <Card icon="trophy" title="WEEKLY CHAMPION" tone="gold">
          Seven maps, one champion. Your seven times are added together and the lowest total wins the week.
        </Card>
      </div>

      <TabBar active="how" />
    </div>
  );
}
