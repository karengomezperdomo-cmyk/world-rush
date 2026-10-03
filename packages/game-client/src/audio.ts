/**
 * Game audio, synthesised in the browser rather than loaded from files.
 *
 * There was no sound at all before this. It exists because the settings screen offers to turn sound off, and
 * a switch that controls nothing is a lie — so the sound had to become real before the switch could.
 *
 * Everything is generated with oscillators and a noise buffer: no audio assets to download, nothing to add
 * to the 2-3 second load budget World's guidelines set for a Mini App, and the engine note can follow the
 * bike's actual speed instead of looping a fixed sample.
 *
 * Audio is a garnish. Every entry point is wrapped, because `AudioContext` is unavailable or restricted in
 * more environments than one can enumerate (locked-down WebViews, private windows, silent-mode policies),
 * and none of that may ever take the game down with it.
 */

export interface GameAudio {
  /** Follows the bike: `speed` in metres per second, `moving` false when crashed or idle. */
  engine(speed: number, moving: boolean): void;
  checkpoint(): void;
  crash(): void;
  finish(): void;
  /** Call from a real user gesture; browsers refuse to start audio any other way. */
  resume(): void;
  setSoundEffects(on: boolean): void;
  setMusic(on: boolean): void;
  dispose(): void;
}

/** Does nothing, successfully. Returned whenever audio cannot be created at all. */
function silentAudio(): GameAudio {
  return {
    engine: () => undefined,
    checkpoint: () => undefined,
    crash: () => undefined,
    finish: () => undefined,
    resume: () => undefined,
    setSoundEffects: () => undefined,
    setMusic: () => undefined,
    dispose: () => undefined,
  };
}

const MUSIC_BASS = [55, 55, 73.42, 65.41]; // A1 A1 D2 C2 — one bar per note
const MUSIC_ARP = [440, 523.25, 659.25, 523.25];
const MUSIC_BEAT_SECONDS = 0.42;

export function createGameAudio({
  soundEffects = true,
  music = true,
}: { soundEffects?: boolean; music?: boolean } = {}): GameAudio {
  const AudioContextClass =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!AudioContextClass) return silentAudio();

  let context: AudioContext;
  try {
    context = new AudioContextClass();
  } catch {
    return silentAudio();
  }

  let effectsOn = soundEffects;
  let musicOn = music;
  let disposed = false;

  const master = context.createGain();
  master.gain.value = 0.9;
  master.connect(context.destination);

  const effectsBus = context.createGain();
  effectsBus.gain.value = effectsOn ? 1 : 0;
  effectsBus.connect(master);

  const musicBus = context.createGain();
  musicBus.gain.value = musicOn ? 0.5 : 0;
  musicBus.connect(master);

  // --- engine: two detuned saws through a low-pass, both tracking speed ---
  const engineGain = context.createGain();
  engineGain.gain.value = 0;
  const engineFilter = context.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 700;
  engineGain.connect(engineFilter).connect(effectsBus);

  const engineOscillators = [0, 4].map((detune) => {
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 60;
    oscillator.detune.value = detune;
    oscillator.connect(engineGain);
    oscillator.start();
    return oscillator;
  });

  /** One shared noise buffer; crashes and tyre grit both draw on it. */
  const noiseBuffer = (() => {
    const frames = Math.floor(context.sampleRate * 0.9);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const channel = buffer.getChannelData(0);
    // A fixed-seed LCG, so a crash sounds the same every time rather than drifting run to run.
    let seed = 1337;
    for (let i = 0; i < frames; i++) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      channel[i] = (seed / 2147483648 - 1) * (1 - i / frames);
    }
    return buffer;
  })();

  function safely(action: () => void): void {
    if (disposed) return;
    try {
      action();
    } catch {
      // A refused or closed context must never reach the game loop.
    }
  }

  function blip(frequency: number, duration: number, type: OscillatorType, volume: number): void {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(effectsBus);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  // --- music: a slow bass note plus an arpeggio, scheduled a bar at a time ---
  let musicTimer: ReturnType<typeof setInterval> | undefined;
  let beat = 0;

  function scheduleBeat(): void {
    safely(() => {
      if (!musicOn) return;
      const now = context.currentTime;
      const bassNote = MUSIC_BASS[beat % MUSIC_BASS.length] ?? 55;
      const bass = context.createOscillator();
      const bassGain = context.createGain();
      bass.type = 'triangle';
      bass.frequency.value = bassNote;
      bassGain.gain.setValueAtTime(0, now);
      bassGain.gain.linearRampToValueAtTime(0.35, now + 0.04);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + MUSIC_BEAT_SECONDS * 0.95);
      bass.connect(bassGain).connect(musicBus);
      bass.start(now);
      bass.stop(now + MUSIC_BEAT_SECONDS);

      const arpNote = MUSIC_ARP[beat % MUSIC_ARP.length] ?? 440;
      const arp = context.createOscillator();
      const arpGain = context.createGain();
      arp.type = 'square';
      arp.frequency.value = arpNote;
      arpGain.gain.setValueAtTime(0, now);
      arpGain.gain.linearRampToValueAtTime(0.06, now + 0.02);
      arpGain.gain.exponentialRampToValueAtTime(0.0001, now + MUSIC_BEAT_SECONDS * 0.5);
      arp.connect(arpGain).connect(musicBus);
      arp.start(now + MUSIC_BEAT_SECONDS * 0.5);
      arp.stop(now + MUSIC_BEAT_SECONDS);

      beat += 1;
    });
  }

  function startMusic(): void {
    if (musicTimer !== undefined) return;
    scheduleBeat();
    musicTimer = setInterval(scheduleBeat, MUSIC_BEAT_SECONDS * 1000);
  }

  function stopMusic(): void {
    if (musicTimer === undefined) return;
    clearInterval(musicTimer);
    musicTimer = undefined;
  }

  return {
    engine(speed, moving) {
      safely(() => {
        const now = context.currentTime;
        // Speed maps onto pitch and brightness; both ramp rather than jump, or it clicks every tick.
        const target = moving ? Math.min(0.11, 0.03 + Math.abs(speed) * 0.006) : 0;
        engineGain.gain.setTargetAtTime(target, now, 0.08);
        const pitch = 52 + Math.min(120, Math.abs(speed) * 7);
        for (const oscillator of engineOscillators) {
          oscillator.frequency.setTargetAtTime(pitch, now, 0.06);
        }
        engineFilter.frequency.setTargetAtTime(
          500 + Math.min(1800, Math.abs(speed) * 110),
          now,
          0.1,
        );
      });
    },

    checkpoint() {
      safely(() => {
        blip(880, 0.1, 'square', 0.12);
        blip(1318.5, 0.16, 'square', 0.09);
      });
    },

    crash() {
      safely(() => {
        const now = context.currentTime;
        const source = context.createBufferSource();
        const gain = context.createGain();
        const filter = context.createBiquadFilter();
        source.buffer = noiseBuffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.frequency.exponentialRampToValueAtTime(180, now + 0.5);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        source.connect(filter).connect(gain).connect(effectsBus);
        source.start(now);
        source.stop(now + 0.7);
        blip(70, 0.35, 'sawtooth', 0.22);
      });
    },

    finish() {
      safely(() => {
        const now = context.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const at = now + index * 0.09;
          oscillator.type = 'square';
          oscillator.frequency.value = note;
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(0.14, at + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
          oscillator.connect(gain).connect(effectsBus);
          oscillator.start(at);
          oscillator.stop(at + 0.45);
        });
      });
    },

    resume() {
      safely(() => {
        if (context.state === 'suspended') void context.resume();
        if (musicOn) startMusic();
      });
    },

    setSoundEffects(on) {
      effectsOn = on;
      safely(() => {
        effectsBus.gain.setTargetAtTime(on ? 1 : 0, context.currentTime, 0.02);
      });
    },

    setMusic(on) {
      musicOn = on;
      safely(() => {
        musicBus.gain.setTargetAtTime(on ? 0.5 : 0, context.currentTime, 0.05);
      });
      if (on) startMusic();
      else stopMusic();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      stopMusic();
      try {
        for (const oscillator of engineOscillators) oscillator.stop();
        void context.close();
      } catch {
        // Already closed, or never really opened.
      }
    },
  };
}
