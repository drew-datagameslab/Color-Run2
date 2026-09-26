const SOUND_VOLUME_MAX = 0.7;
const SOUND_VOLUME_KEY = 'cr_sound_volume';

let soundVolume = SOUND_VOLUME_MAX;
try {
  const saved = localStorage.getItem(SOUND_VOLUME_KEY);
  if (saved !== null) {
    soundVolume = Math.min(SOUND_VOLUME_MAX, Math.max(0, parseFloat(saved)));
  }
} catch {
  // Ignore
}

export function getSoundVolume(): number {
  return soundVolume;
}

export function setSoundVolume(pct: number): void {
  soundVolume = Math.min(SOUND_VOLUME_MAX, Math.max(0, (pct / 100) * SOUND_VOLUME_MAX));
  try {
    localStorage.setItem(SOUND_VOLUME_KEY, String(soundVolume));
  } catch {
    // Ignore
  }
}

const SFX: Record<string, HTMLAudioElement> = {};
const SFX_PATHS: Record<string, string> = {
  s3: '/assets/audio/s3.mp3',
  s4: '/assets/audio/s4.mp3',
  s5: '/assets/audio/s5.mp3',
  s6: '/assets/audio/s6.mp3',
  add: '/assets/audio/add.mp3',
  fanfare: '/assets/audio/fanfare.mp3',
  warning5s: '/assets/audio/warning5s.mp3',
};

export function initAudio(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  try {
    for (const [key, path] of Object.entries(SFX_PATHS)) {
      const a = new Audio(path);
      a.preload = 'auto';
      SFX[key] = a;
    }
  } catch {
    // Ignore
  }
}

let audioUnlocked = false;
export function unlockAudio(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  Object.values(SFX).forEach(a => {
    try {
      a.muted = true;
      const p = a.play();
      if (p && p.then) {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        }).catch(() => {
          a.muted = false;
        });
      } else {
        a.muted = false;
      }
    } catch {
      // Ignore
    }
  });
}

export function playSfx(key: 's3' | 's4' | 's5' | 's6' | 'add' | 'fanfare' | 'warning5s'): void {
  if (soundVolume <= 0) return;
  const base = SFX[key];
  if (!base) return;
  try {
    const a = base.cloneNode(true) as HTMLAudioElement;
    a.volume = soundVolume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch {
    // Ignore
  }
}

export function playRollDiceSound(): void {
  playSfx('add');
}

export function playWinCoinsSound(): void {
  playSfx('fanfare');
}

let activeWarningAudio: HTMLAudioElement | null = null;
let activeWarningCtx: AudioContext | null = null;

let activeBattleAudio: HTMLAudioElement | null = null;
let activeBattleInterval: any = null;
let activeBattleCtx: AudioContext | null = null;

/**
 * Plays the "Battle to Survive.mp3" dramatic war drum & tension music in a continuous loop
 * until stopBattleMusic() is called.
 */
export function startBattleMusic(): void {
  if (soundVolume <= 0) return;
  stopBattleMusic();

  const candidates = [
    '/assets/audio/Battle to Survive.mp3',
    '/assets/audio/battle-to-survive.mp3',
    '/Battle to Survive.mp3',
    '/battle-to-survive.mp3',
  ];

  let currentIdx = 0;
  const tryNext = () => {
    if (currentIdx >= candidates.length) {
      startSynthesizedBattleMusic();
      return;
    }
    const path = candidates[currentIdx++];
    try {
      const audio = new Audio(path);
      audio.loop = true;
      audio.volume = soundVolume;
      activeBattleAudio = audio;
      const p = audio.play();
      if (p && p.catch) {
        p.catch(() => tryNext());
      }
    } catch {
      tryNext();
    }
  };

  tryNext();
}

/**
 * Stops the "Battle to Survive" looped audio.
 */
export function stopBattleMusic(): void {
  if (activeBattleAudio) {
    try {
      activeBattleAudio.pause();
      activeBattleAudio.currentTime = 0;
    } catch {}
    activeBattleAudio = null;
  }
  if (activeBattleInterval) {
    clearInterval(activeBattleInterval);
    activeBattleInterval = null;
  }
  if (activeBattleCtx) {
    try {
      activeBattleCtx.close();
    } catch {}
    activeBattleCtx = null;
  }
}

/**
 * Web Audio API cinematic battle drums & tension music loop.
 */
function startSynthesizedBattleMusic(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    activeBattleCtx = ctx;

    const playBar = () => {
      if (!activeBattleCtx || activeBattleCtx.state === 'closed') return;
      const now = ctx.currentTime;
      const beatLen = 0.42; // ~142 BPM dramatic war tempo

      // 4 beats per bar
      for (let b = 0; b < 4; b++) {
        const beatTime = now + b * beatLen;

        // Heavy Taiko / War Drum Kick on beats 0 and 2
        if (b === 0 || b === 2) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(110, beatTime);
          osc.frequency.exponentialRampToValueAtTime(32, beatTime + 0.35);

          gain.gain.setValueAtTime(soundVolume * 0.7, beatTime);
          gain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.38);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(beatTime);
          osc.stop(beatTime + 0.4);

          // Sub-rumble
          const subOsc = ctx.createOscillator();
          const subGain = ctx.createGain();
          subOsc.type = 'triangle';
          subOsc.frequency.setValueAtTime(55, beatTime);
          subGain.gain.setValueAtTime(soundVolume * 0.5, beatTime);
          subGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.45);
          subOsc.connect(subGain);
          subGain.connect(ctx.destination);
          subOsc.start(beatTime);
          subOsc.stop(beatTime + 0.45);
        }

        // Tension Snare / Rim Clack on beats 1 and 3
        if (b === 1 || b === 3) {
          const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < noiseBuffer.length; i++) {
            output[i] = Math.random() * 2 - 1;
          }
          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(800, beatTime);
          filter.Q.setValueAtTime(2.5, beatTime);

          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(soundVolume * 0.4, beatTime);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.14);

          whiteNoise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(ctx.destination);
          whiteNoise.start(beatTime);
          whiteNoise.stop(beatTime + 0.15);
        }

        // Rhythmic tension 16th-note ticks
        for (let sub = 0; sub < 4; sub++) {
          const subTime = beatTime + sub * (beatLen / 4);
          const tickOsc = ctx.createOscillator();
          const tickGain = ctx.createGain();
          tickOsc.type = 'triangle';
          tickOsc.frequency.setValueAtTime(sub % 2 === 0 ? 980 : 1240, subTime);
          tickGain.gain.setValueAtTime(soundVolume * 0.12, subTime);
          tickGain.gain.exponentialRampToValueAtTime(0.001, subTime + 0.04);
          tickOsc.connect(tickGain);
          tickGain.connect(ctx.destination);
          tickOsc.start(subTime);
          tickOsc.stop(subTime + 0.05);
        }
      }
    };

    playBar();
    activeBattleInterval = setInterval(playBar, 0.42 * 4 * 1000);
  } catch {}
}

/**
 * Plays the MAGMisc-A_powerful_sword_sla-Elevenlabs.com audio when a user is eliminated.
 */
export function playSwordSlashSound(): void {
  if (soundVolume <= 0) return;

  const candidates = [
    '/assets/audio/MAGMisc-A_powerful_sword_sla-Elevenlabs.com.mp3',
    '/assets/audio/MAGMisc-A_powerful_sword_sla-Elevenlabs.com',
    '/assets/audio/sword-slash.mp3',
    '/MAGMisc-A_powerful_sword_sla-Elevenlabs.com.mp3',
    '/MAGMisc-A_powerful_sword_sla-Elevenlabs.com',
  ];

  let currentIdx = 0;
  const tryNext = () => {
    if (currentIdx >= candidates.length) {
      playSynthesizedSwordSlash();
      return;
    }
    const path = candidates[currentIdx++];
    try {
      const a = new Audio(path);
      a.volume = soundVolume;
      const p = a.play();
      if (p && p.catch) {
        p.catch(() => tryNext());
      }
    } catch {
      tryNext();
    }
  };

  tryNext();
}

/**
 * Web Audio API synthesizer for the powerful sword slash impact.
 */
function playSynthesizedSwordSlash(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // 1. Whoosh Noise Swoop (Sharp air slice)
    const bufferSize = ctx.sampleRate * 0.35;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(4, now);
    filter.frequency.setValueAtTime(4200, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.28);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(soundVolume * 0.9, now + 0.04);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.35);

    // 2. High Metallic Ring (Steel blade resonance)
    const bladeOsc = ctx.createOscillator();
    const bladeGain = ctx.createGain();
    bladeOsc.type = 'sine';
    bladeOsc.frequency.setValueAtTime(2600, now + 0.02);
    bladeOsc.frequency.exponentialRampToValueAtTime(1400, now + 0.25);

    bladeGain.gain.setValueAtTime(soundVolume * 0.65, now + 0.02);
    bladeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    bladeOsc.connect(bladeGain);
    bladeGain.connect(ctx.destination);
    bladeOsc.start(now + 0.02);
    bladeOsc.stop(now + 0.4);

    // 3. Heavy Impact Thud (Cleave / strike impact)
    const impactOsc = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impactOsc.type = 'triangle';
    impactOsc.frequency.setValueAtTime(140, now + 0.05);
    impactOsc.frequency.exponentialRampToValueAtTime(38, now + 0.25);

    impactGain.gain.setValueAtTime(soundVolume * 0.8, now + 0.05);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    impactOsc.connect(impactGain);
    impactGain.connect(ctx.destination);
    impactOsc.start(now + 0.05);
    impactOsc.stop(now + 0.32);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 600);
  } catch {}
}

export function stopWarningSound(): void {
  if (activeWarningAudio) {
    try {
      activeWarningAudio.pause();
      activeWarningAudio.currentTime = 0;
    } catch {
      // Ignore
    }
    activeWarningAudio = null;
  }
  if (activeWarningCtx) {
    try {
      activeWarningCtx.close();
    } catch {
      // Ignore
    }
    activeWarningCtx = null;
  }
}

export function playWarning5sSound(): void {
  if (soundVolume <= 0) return;
  stopWarningSound();

  const base = SFX['warning5s'];
  if (base) {
    try {
      const a = base.cloneNode(true) as HTMLAudioElement;
      a.volume = soundVolume;
      activeWarningAudio = a;
      const p = a.play();
      if (p && p.catch) {
        p.catch(() => {
          playSynthesizedWarningTone();
        });
      }
      return;
    } catch {
      // Fallback below
    }
  }
  playSynthesizedWarningTone();
}

/**
 * Web Audio API fallback for 5-second countdown warning tone
 */
function playSynthesizedWarningTone(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    activeWarningCtx = ctx;
    const now = ctx.currentTime;

    const beepFrequencies = [880, 880, 987.77, 1046.5, 1318.5];
    beepFrequencies.forEach((freq, idx) => {
      const startTime = now + idx * 1.0;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      const duration = idx === 4 ? 0.4 : 0.12;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(soundVolume * 0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch {
    // Ignore
  }
}

