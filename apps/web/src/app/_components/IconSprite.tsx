/**
 * The icon set from `design/icons.js`, as a real component.
 *
 * The mocks inject this sprite with `document.body.insertAdjacentHTML` so they work straight off the disk over
 * `file://`. In the app it renders once in the layout and every `<Icon>` references it by id, which is the
 * same `<use href="#name">` mechanism the mock markup uses — so a screen ported from `design/` keeps working
 * without touching its icon markup.
 *
 * The stroke defaults (width, square caps, mitre joins) live in `ui.css`, not here.
 *
 * The phone status bar's signal/wifi/battery glyphs are deliberately left out: World App draws the real status
 * bar, and those three exist only to make the mock look like a screenshot.
 */
export type IconName =
  | 'home'
  | 'trophy'
  | 'help'
  | 'gear'
  | 'user'
  | 'gamepad'
  | 'clock'
  | 'bars'
  | 'lock'
  | 'play'
  | 'pause'
  | 'volume'
  | 'volume-off'
  | 'chevron'
  | 'check'
  | 'flag'
  | 'calendar'
  | 'refresh'
  | 'share'
  | 'wifi-off'
  | 'alert'
  | 'lean-back'
  | 'lean-fwd'
  | 'brake'
  | 'gas'
  | 'ring'
  | 'crown';

export function IconSprite() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      aria-hidden="true"
    >
      <defs>
        <symbol id="home" viewBox="0 0 24 24">
          <path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" />
        </symbol>
        <symbol id="trophy" viewBox="0 0 24 24">
          <path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4M12 14v4M8 21h8M10 18h4" />
        </symbol>
        <symbol id="help" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9.5A3 3 0 0 1 15 10c0 2-3 2-3 4M12 17.5v.5" />
        </symbol>
        <symbol id="gear" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
        </symbol>
        <symbol id="user" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2" />
        </symbol>
        <symbol id="gamepad" viewBox="0 0 24 24">
          <path d="M6 8h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5 2l-2-2H9l-2 2a3 3 0 0 1-5-2v-3a4 4 0 0 1 4-4zM8 10.5v3M6.5 12h3M16 11.5v.5M18 13v.5" />
        </symbol>
        <symbol id="clock" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </symbol>
        <symbol id="bars" viewBox="0 0 24 24">
          <path d="M5 20V11M12 20V4M19 20v-6" />
        </symbol>
        <symbol id="lock" viewBox="0 0 24 24">
          <rect x="5" y="11" width="14" height="10" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </symbol>
        <symbol id="play" viewBox="0 0 24 24">
          <path d="M6 3v18l15-9z" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="pause" viewBox="0 0 24 24">
          <path d="M7 4v16M17 4v16" strokeWidth="4" />
        </symbol>
        <symbol id="volume" viewBox="0 0 24 24">
          <path d="M4 9v6h4l5 4V5L8 9zM17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />
        </symbol>
        <symbol id="volume-off" viewBox="0 0 24 24">
          <path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6" />
        </symbol>
        <symbol id="chevron" viewBox="0 0 24 24">
          <path d="m9 5 7 7-7 7" />
        </symbol>
        <symbol id="check" viewBox="0 0 24 24">
          <path d="m4 12 5 5L20 6" />
        </symbol>
        <symbol id="flag" viewBox="0 0 24 24">
          <path d="M5 22V3M5 4h13l-3 4 3 4H5" />
        </symbol>
        <symbol id="calendar" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="16" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </symbol>
        <symbol id="refresh" viewBox="0 0 24 24">
          <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" />
        </symbol>
        <symbol id="share" viewBox="0 0 24 24">
          <path d="M12 3v12M7 8l5-5 5 5M5 14v7h14v-7" />
        </symbol>
        <symbol id="wifi-off" viewBox="0 0 24 24">
          <path d="M2 8.8a15 15 0 0 1 4-2.4M22 8.8a15 15 0 0 0-9-3.7M5 12.5a10 10 0 0 1 3-1.9M19 12.5a10 10 0 0 0-5.2-2.3M8.5 16a5 5 0 0 1 4-1.7M12 20h.01M3 3l18 18" />
        </symbol>
        <symbol id="alert" viewBox="0 0 24 24">
          <path d="M12 3 2 21h20zM12 10v5M12 18v.5" />
        </symbol>
        <symbol id="lean-back" viewBox="0 0 24 24">
          <path d="M5 12a7 7 0 1 1 2 5M5 12l-2-3M5 12l3-1.5" />
        </symbol>
        <symbol id="lean-fwd" viewBox="0 0 24 24">
          <path d="M19 12a7 7 0 1 0-2 5M19 12l2-3M19 12l-3-1.5" />
        </symbol>
        <symbol id="brake" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="gas" viewBox="0 0 24 24">
          <path d="m6 5 7 7-7 7M13 5l7 7-7 7" />
        </symbol>
        <symbol id="ring" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </symbol>
        <symbol id="crown" viewBox="0 0 24 24">
          <path d="M3 8l5 4 4-7 4 7 5-4-2 11H5z" fill="currentColor" stroke="none" />
        </symbol>
      </defs>
    </svg>
  );
}

/** One icon from the sprite. `className="i"` is `ui.css`'s standard inline icon size. */
export function Icon({ name, className = 'i' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${name}`} />
    </svg>
  );
}
