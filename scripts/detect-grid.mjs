// Shared per-map grid calibration: finds the grid-line pitch (cell size) and phase (origin)
// by minimizing profile brightness at candidate line positions. Atlas maps vary in grid density.
import sharp from "sharp";

function bestSeries(profile, size) {
  const lo = size * 0.04, hi = size * 0.96;
  const score = (pitch, phase) => {
    let sum = 0, cnt = 0;
    for (let x = phase; x < size; x += pitch) {
      const xi = Math.round(x);
      if (xi < lo || xi > hi) continue;
      sum += profile[xi];
      cnt++;
    }
    return cnt >= 10 ? sum / cnt : Infinity;
  };
  let best = { s: Infinity, pitch: 0, phase: 0 };
  for (let pitch = size * 0.045; pitch <= size * 0.075; pitch += 0.1) {
    for (let phase = 0; phase < pitch; phase += 0.5) {
      const s = score(pitch, phase);
      if (s < best.s) best = { s, pitch, phase };
    }
  }
  // refine
  for (let pitch = best.pitch - 0.3; pitch <= best.pitch + 0.3; pitch += 0.02) {
    for (let phase = best.phase - 1; phase <= best.phase + 1; phase += 0.1) {
      const s = score(pitch, phase);
      if (s < best.s) best = { s, pitch, phase };
    }
  }
  return best;
}

export async function detectGrid(file) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const colD = new Array(w).fill(0), rowD = new Array(h).fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) { const v = data[y * w + x]; colD[x] += v; rowD[y] += v; }

  const axis = (profile, size) => {
    const best = bestSeries(profile, size);
    if (!best.pitch) return null;
    // First grid line past the outer frame / label strip region
    let x0 = best.phase;
    while (x0 < size * 0.035) x0 += best.pitch;
    return { cell: best.pitch / size, origin: x0 / size, pitchPx: best.pitch, originPx: x0 };
  };
  return { x: axis(colD, w), y: axis(rowD, h), w, h };
}

// CLI test mode: node scripts/detect-grid.mjs <files...>
if (process.argv[2]) {
  for (const f of process.argv.slice(2)) {
    const g = await detectGrid(f);
    console.log(
      f.split(/[\\/]/).pop(),
      g.x ? `x: pitch=${g.x.pitchPx.toFixed(2)} origin=${g.x.originPx.toFixed(2)}` : "x: FAIL",
      g.y ? `| y: pitch=${g.y.pitchPx.toFixed(2)} origin=${g.y.originPx.toFixed(2)}` : "| y: FAIL"
    );
  }
}
