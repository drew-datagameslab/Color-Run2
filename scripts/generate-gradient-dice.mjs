// Generates the gradient dice sets in public/assets/dice/<id>/1-6.png from the red set:
// keeps each white shape (and its smooth edge) and replaces the square's color with a
// gradient. Keep the ids, names and colors in step with GRADIENT_DICE in
// src/lib/diceCatalog.ts.
//
// Run:  npm install --no-save pngjs && node scripts/generate-gradient-dice.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const DICE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'dice');

// dir: 'v' top to bottom, 'd' diagonal top-left to bottom-right; stops: [position 0-1, color]
const SETS = {
  sunset: { dir: 'd', stops: [[0, '#fbbf24'], [0.5, '#f97316'], [1, '#db2777']] },
  ocean: { dir: 'd', stops: [[0, '#22d3ee'], [1, '#1e3a8a']] },
  fireice: { dir: 'd', stops: [[0, '#fb923c'], [0.35, '#dc2626'], [0.65, '#2563eb'], [1, '#7dd3fc']] },
  twilight: { dir: 'd', stops: [[0, '#f472b6'], [0.5, '#9333ea'], [1, '#1e1b4b']] },
  galaxy: { dir: 'd', stops: [[0, '#7c3aed'], [0.55, '#312e81'], [1, '#0b1026']], stars: true },
  rainbow: { dir: 'd', stops: [[0, '#ef4444'], [0.2, '#f97316'], [0.4, '#eab308'], [0.6, '#22c55e'], [0.8, '#3b82f6'], [1, '#8b5cf6']] },
  gold: { dir: 'd', stops: [[0, '#fde68a'], [0.45, '#d4a017'], [1, '#8a6508']] },
  silver: { dir: 'd', stops: [[0, '#f1f5f9'], [0.45, '#a3adb8'], [1, '#5b6470']] },
  ruby: { dir: 'd', stops: [[0, '#fb7185'], [0.45, '#be123c'], [1, '#4c0519']] },
  forest: { dir: 'd', stops: [[0, '#a3e635'], [0.5, '#16a34a'], [1, '#14532d']] },
  cottoncandy: { dir: 'd', stops: [[0, '#f472b6'], [0.5, '#a78bfa'], [1, '#3b82f6']] },
  desert: { dir: 'd', stops: [[0, '#f5d08a'], [0.5, '#d97742'], [1, '#7c2d12']] },
};

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function colorAt(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      return mix(hex(c0), hex(c1), (t - p0) / (p1 - p0 || 1));
    }
  }
  return hex(stops[stops.length - 1][1]);
}

for (const [id, set] of Object.entries(SETS)) {
  const outDir = path.join(DICE_DIR, id);
  fs.mkdirSync(outDir, { recursive: true });
  for (let v = 1; v <= 6; v++) {
    const png = PNG.sync.read(fs.readFileSync(path.join(DICE_DIR, 'red', `${v}.png`)));
    const { width: w, height: h, data } = png;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] === 0) continue;
        // Red source: green channel is 16 on the square and 255 on the white shape
        const raw = (data[i + 1] - 16) / (255 - 16);
        const whiteness = Math.min(1, Math.max(0, (raw - 0.08) / 0.84));
        const t = set.dir === 'v' ? y / (h - 1) : (x + y) / (w + h - 2);
        let bg = colorAt(set.stops, t);
        if (set.stars && whiteness < 0.05 && ((x * 7 + y * 13) % 97 === 0 || (x * 11 + y * 5) % 131 === 0)) {
          bg = mix(bg, [255, 255, 255], 0.75);
        }
        const out = mix(bg, [255, 255, 255], whiteness);
        data[i] = out[0];
        data[i + 1] = out[1];
        data[i + 2] = out[2];
      }
    }
    fs.writeFileSync(path.join(outDir, `${v}.png`), PNG.sync.write(png));
  }
}
console.log('Generated', Object.keys(SETS).join(', '));
