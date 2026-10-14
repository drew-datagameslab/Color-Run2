import React, { useRef, useEffect, useState } from 'react';

interface ColorRunCelebrationProps {
  onEnded?: () => void;
}

const VIDEO_SRC = '/media/color-run.mp4';

// One shared video element, created and preloaded ahead of time so the celebration starts
// instantly. iPhones need a few things before a video will play and draw to a canvas:
// - the muted/playsinline attributes (not just the properties)
// - the element attached to the page (iOS may not decode frames for a detached video)
// - a first play() during a user tap, or autoplay can be blocked (e.g. in Low Power Mode)
let sharedVideo: HTMLVideoElement | null = null;
let unlockListenerAdded = false;
// True while a celebration is using the video, so the first-tap unlock doesn't pause it
let celebrationPlaying = false;

function getVideo(): HTMLVideoElement | null {
  if (typeof document === 'undefined') return null;
  if (!sharedVideo) {
    const v = document.createElement('video');
    v.src = VIDEO_SRC;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    // Kept on the page but invisible; the canvas shows the keyed frames
    Object.assign(v.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '2px',
      height: '2px',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    document.body.appendChild(v);
    v.load();
    sharedVideo = v;
  }
  return sharedVideo;
}

/**
 * Preloads the celebration video and, on the player's first tap, plays and pauses it once so
 * iOS allows it to play later without a tap. Call when the game screen opens.
 */
export function preloadColorRunCelebration() {
  const v = getVideo();
  if (!v || unlockListenerAdded) return;
  unlockListenerAdded = true;
  const unlock = () => {
    document.removeEventListener('touchstart', unlock, true);
    document.removeEventListener('pointerdown', unlock, true);
    if (!v.paused || celebrationPlaying) return;
    v.play()
      .then(() => {
        if (celebrationPlaying) return;
        v.pause();
        v.currentTime = 0;
      })
      .catch(() => {});
  };
  document.addEventListener('touchstart', unlock, true);
  document.addEventListener('pointerdown', unlock, true);
}

/**
 * ColorRunCelebration plays /media/color-run.mp4 over an HTML5 canvas,
 * removing the black video background frame-by-frame via luminance chroma-keying.
 * If the video can't play (blocked autoplay, slow load), an animated banner shows instead.
 */
export const ColorRunCelebration: React.FC<ColorRunCelebrationProps> = ({ onEnded }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onEndedRef = useRef(onEnded);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    onEndedRef.current = onEnded;
  });

  useEffect(() => {
    let animId = 0;
    let isCancelled = false;
    let hasEnded = false;
    let endTimer: ReturnType<typeof setTimeout> | undefined;

    const notifyEnded = () => {
      if (hasEnded || isCancelled) return;
      hasEnded = true;
      onEndedRef.current?.();
    };

    const video = getVideo();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });

    // Shows the banner for its full length, then ends
    const fallBack = () => {
      if (isCancelled || hasEnded) return;
      clearTimeout(endTimer);
      cancelAnimationFrame(animId);
      video?.pause();
      setShowFallback(true);
      endTimer = setTimeout(notifyEnded, 2600);
    };

    if (!video || !canvas || !ctx) {
      fallBack();
      return () => {
        isCancelled = true;
        clearTimeout(endTimer);
      };
    }

    // Use optimal resolution for real-time luminance keying (30fps)
    const W = 640;
    const H = 360;
    canvas.width = W;
    canvas.height = H;

    const render = () => {
      if (isCancelled) return;

      if (video.readyState >= 2 && !video.paused && !video.ended) {
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(video, 0, 0, W, H);

        try {
          const frame = ctx.getImageData(0, 0, W, H);
          const data = frame.data;
          const totalPixels = data.length;

          for (let i = 0; i < totalPixels; i += 4) {
            // Calculate luminance / max color intensity
            const maxVal = Math.max(data[i], data[i + 1], data[i + 2]);

            if (maxVal < 36) {
              // Completely remove black background
              data[i + 3] = 0;
            } else if (maxVal < 80) {
              // Smooth anti-aliased edge ramp
              data[i + 3] = Math.round(((maxVal - 36) / 44) * 242);
            } else {
              // 95% opacity for crisp animation visuals
              data[i + 3] = 242;
            }
          }

          ctx.putImageData(frame, 0, 0);
        } catch {
          // If cross-origin or canvas read error occurs, fallback to drawn frame
        }
      }

      animId = requestAnimationFrame(render);
    };

    const onPlaying = () => {
      // Time the end from when playback actually starts, not from when the celebration opened
      clearTimeout(endTimer);
      const remainingMs = ((video.duration || 3.1) - video.currentTime) * 1000;
      endTimer = setTimeout(notifyEnded, remainingMs + 400);
    };

    video.addEventListener('ended', notifyEnded);
    video.addEventListener('error', fallBack);
    video.addEventListener('playing', onPlaying);

    // If the video hasn't started within 2.5s (slow load, blocked), show the banner instead
    endTimer = setTimeout(fallBack, 2500);

    celebrationPlaying = true;
    video.currentTime = 0;
    video.muted = true;
    video
      .play()
      .then(() => {
        if (!isCancelled) animId = requestAnimationFrame(render);
      })
      .catch(fallBack);

    return () => {
      isCancelled = true;
      clearTimeout(endTimer);
      cancelAnimationFrame(animId);
      video.removeEventListener('ended', notifyEnded);
      video.removeEventListener('error', fallBack);
      video.removeEventListener('playing', onPlaying);
      video.pause();
      celebrationPlaying = false;
    };
  }, []);

  if (showFallback) {
    return (
      <div className="w-full h-full flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-1 animate-scale-up">
          <div className="text-5xl sm:text-6xl animate-bounce-subtle drop-shadow-lg">🎉</div>
          <div
            className="text-4xl sm:text-5xl font-black italic tracking-tight bg-clip-text text-transparent drop-shadow-[0_3px_10px_rgba(0,0,0,0.6)]"
            style={{ backgroundImage: 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6)' }}
          >
            COLOR RUN!
          </div>
          <div className="text-xs sm:text-sm font-black text-[#f2c14e] uppercase tracking-widest drop-shadow-md">
            6 of a kind
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain pointer-events-none drop-shadow-lg"
      />
    </div>
  );
};
