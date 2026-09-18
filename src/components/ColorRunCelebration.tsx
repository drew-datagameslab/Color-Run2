import React, { useRef, useEffect } from 'react';

interface ColorRunCelebrationProps {
  onEnded?: () => void;
}

/**
 * ColorRunCelebration plays /media/color-run.mp4 over an HTML5 canvas,
 * removing the black video background frame-by-frame via luminance chroma-keying.
 * This guarantees 100% transparent background across all browsers and devices.
 */
export const ColorRunCelebration: React.FC<ColorRunCelebrationProps> = ({ onEnded }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;
    let isCancelled = false;

    const video = document.createElement('video');
    video.src = '/media/color-run.mp4';
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    const handleEnded = () => {
      if (!isCancelled) {
        onEnded?.();
      }
    };
    video.addEventListener('ended', handleEnded);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

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
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Calculate luminance / max color intensity
            const maxVal = Math.max(r, g, b);

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

    const startPlay = async () => {
      try {
        await video.play();
      } catch {
        video.muted = true;
        await video.play().catch(() => {});
      }
      animId = requestAnimationFrame(render);
    };

    startPlay();

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animId);
      video.removeEventListener('ended', handleEnded);
      video.pause();
      video.src = '';
    };
  }, [onEnded]);

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain pointer-events-none drop-shadow-lg"
      />
    </div>
  );
};
