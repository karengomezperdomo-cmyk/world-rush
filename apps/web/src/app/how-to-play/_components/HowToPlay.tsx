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
            While the game is being tested, all seven maps can be played whenever you like. Normally
            one opens each day at 00:00 UTC and its leaderboard freezes when the day ends.
          </Card>
        ) : (
          <Card icon="calendar" title="ONE MAP EVERY DAY">
            A new map opens each day at 00:00 UTC. When the day ends, that leaderboard freezes for
            good.
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
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
          Crash and you respawn at the last checkpoint, with the clock still running. Retry as often
          as you like — only your fastest run counts.
        </Card>

        <Card icon="ring" title="ONE HUMAN, ONE SPOT">
          World ID proves you are a real person, so one human gets one place on the board.
        </Card>

        <Card icon="check" title="THE SERVER TIMES YOUR RUN">
          Your run sends the buttons you pressed, not the time you got. The server replays them and
          works the time out itself, so a time only counts once it has been checked.
        </Card>

        <Card icon="trophy" title="SEVEN BOARDS, SEVEN CHANCES" tone="gold">
          Every day has its own leaderboard, and each one closes for good when the day ends. Miss a
          day and nothing is lost — you simply are not on that day’s board.
        </Card>
      </div>

      <TabBar active="how" />
    </div>
  );
}
