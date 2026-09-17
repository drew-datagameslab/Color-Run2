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

