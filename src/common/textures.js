// Texturas procedurales sin archivos externos: color, relieve (normal) y rugosidad.
// Todo es periódico, de modo que se puede repetir sin costuras.
import * as THREE from 'three';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(period, seed) {
  const rnd = mulberry32(seed);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % period) + period) % period, x1 = (x0 + 1) % period;
    const y0 = ((yi % period) + period) % period, y1 = (y0 + 1) % period;
    const a = g[y0 * period + x0], b = g[y0 * period + x1];
    const c = g[y1 * period + x0], d = g[y1 * period + x1];
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

// Ruido fractal periódico en [0,1]
export function fbm(size, base, octaves, seed, gain = 0.5) {
  const f = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const freq = base * (1 << o);
    const n = makeNoise(freq, seed + o * 131);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) f[y * size + x] += amp * n((x / size) * freq, (y / size) * freq);
    }
    total += amp; amp *= gain;
  }
  for (let i = 0; i < f.length; i++) f[i] /= total;
  return f;
}

// Ruido celular periódico (guijarros): devuelve distancia al punto más cercano y a un segundo
function worley(size, cells, seed) {
  const rnd = mulberry32(seed);
  const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([i + rnd(), j + rnd()]);
  const f1 = new Float32Array(size * size);
  const f2 = new Float32Array(size * size);
  const id = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x / size) * cells, py = (y / size) * cells;
      const cx = Math.floor(px), cy = Math.floor(py);
      let d1 = 9, d2 = 9, k1 = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const gx = cx + ox, gy = cy + oy;
          const wx = ((gx % cells) + cells) % cells, wy = ((gy % cells) + cells) % cells;
          const p = pts[wy * cells + wx];
          const qx = p[0] - wx + gx, qy = p[1] - wy + gy;
          const d = Math.hypot(qx - px, qy - py);
          if (d < d1) { d2 = d1; d1 = d; k1 = wy * cells + wx; } else if (d < d2) d2 = d;
        }
      }
      f1[y * size + x] = d1; f2[y * size + x] = d2; id[y * size + x] = k1;
    }
  }
  return { f1, f2, id };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function toCanvas(size, painter) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  painter(img.data);
  ctx.putImageData(img, 0, 0);
  return c;
}

function normalFromHeight(h, size, strength) {
  return toCanvas(size, (d) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size, xp = (x + 1) % size, ym = (y - 1 + size) % size, yp = (y + 1) % size;
        const dx = h[y * size + xp] - h[y * size + xm];
        const dy = h[yp * size + x] - h[ym * size + x];
        let nx = -dx * strength, ny = dy * strength, nz = 1;
        const l = Math.hypot(nx, ny, nz);
        nx /= l; ny /= l; nz /= l;
        const i = (y * size + x) * 4;
        d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
    }
  });
}

function texFrom(canvas, srgb, repeat) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

// Cada tipo devuelve { color: (i)=>[r,g,b] en 0..255, height: Float32Array, rough: Float32Array, normalStrength }
const KINDS = {
  concrete(size, seed) {
    const a = fbm(size, 4, 5, seed), b = fbm(size, 16, 3, seed + 7), st = fbm(size, 2, 3, seed + 19);
    const height = new Float32Array(size * size), rough = new Float32Array(size * size);
    for (let i = 0; i < height.length; i++) { height[i] = a[i] * 0.6 + b[i] * 0.4; rough[i] = 0.8 + b[i] * 0.2; }
    return {
      height, rough, normalStrength: 2.2,
      color: (i) => { const v = 150 + (a[i] - 0.5) * 70 + (b[i] - 0.5) * 38 - smooth(0.62, 0.9, st[i]) * 34; return [v, v * 0.99, v * 0.96]; },
    };
  },
  grass(size, seed) {
    const a = fbm(size, 8, 5, seed), b = fbm(size, 32, 3, seed + 3), p = fbm(size, 3, 3, seed + 11);
    const height = new Float32Array(size * size), rough = new Float32Array(size * size).fill(0.95);
    for (let i = 0; i < height.length; i++) height[i] = a[i] * 0.5 + b[i] * 0.5;
    return {
      height, rough, normalStrength: 1.6,
      color: (i) => {
        const t = clamp01(a[i] * 0.8 + b[i] * 0.5 - 0.15), dry = smooth(0.55, 0.8, p[i]);
        const r = mix(38, 98, t) + dry * 46, g = mix(62, 132, t) + dry * 22, bl = mix(20, 46, t) + dry * 4;
        return [r, g, bl];
      },
    };
  },
  gravel(size, seed) {
    const w = worley(size, 22, seed), n = fbm(size, 16, 3, seed + 5);
    const height = new Float32Array(size * size), rough = new Float32Array(size * size).fill(0.9);
    for (let i = 0; i < height.length; i++) height[i] = smooth(0, 0.62, w.f1[i]) * -1 + 1 + n[i] * 0.15;
    const rnd = mulberry32(seed + 99);
    const tone = new Float32Array(22 * 22).map(() => rnd());
    return {
      height, rough, normalStrength: 3.4,
      color: (i) => {
        const t = tone[w.id[i]] * 0.8 + n[i] * 0.2, edge = smooth(0.0, 0.5, w.f1[i]) * 0.5 + 0.5, v = (95 + t * 90) * (1 - (1 - edge) * 0.5);
        return [v * 1.02, v * 0.98, v * 0.9];
      },
    };
  },
  sand(size, seed) {
    const a = fbm(size, 24, 4, seed), r = fbm(size, 6, 3, seed + 2);
    const height = new Float32Array(size * size), rough = new Float32Array(size * size).fill(0.95);
    for (let i = 0; i < height.length; i++) height[i] = a[i] * 0.7 + r[i] * 0.3;
    return { height, rough, normalStrength: 1.2, color: (i) => { const v = 176 + (a[i] - 0.5) * 36 + (r[i] - 0.5) * 20; return [v, v * 0.89, v * 0.7]; } };
  },
  soil(size, seed) {
    const a = fbm(size, 12, 5, seed), b = fbm(size, 40, 2, seed + 4);
    const height = new Float32Array(size * size), rough = new Float32Array(size * size).fill(0.95);
    for (let i = 0; i < height.length; i++) height[i] = a[i] * 0.6 + b[i] * 0.4;
    return { height, rough, normalStrength: 2, color: (i) => { const v = 70 + a[i] * 60 + b[i] * 18; return [v * 1.05, v * 0.8, v * 0.58]; } };
  },
  metal(size, seed) {
    const a = fbm(size, 3, 3, seed), streak = new Float32Array(size * size);
    const rnd = mulberry32(seed + 8);
    const rows = new Float32Array(size).map(() => rnd());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) streak[y * size + x] = rows[y] * 0.6 + a[y * size + x] * 0.4;
    const height = new Float32Array(size * size), rough = new Float32Array(size * size);
    for (let i = 0; i < height.length; i++) { height[i] = streak[i] * 0.4; rough[i] = 0.32 + streak[i] * 0.25; }
    return { height, rough, normalStrength: 0.8, color: (i) => { const v = 120 + streak[i] * 70; return [v * 0.95, v, v * 1.07]; } };
  },
  ribbed(size, seed) { // chapa acanalada: nervaduras verticales
    const a = fbm(size, 4, 3, seed), n = fbm(size, 32, 2, seed + 1);
    const height = new Float32Array(size * size), rough = new Float32Array(size * size);
    const ribs = 8;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x, s = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 2 * ribs);
      height[i] = s * 0.7 + n[i] * 0.1; rough[i] = 0.42 + a[i] * 0.25;
    }
    return { height, rough, normalStrength: 3, color: (i) => { const v = 110 + a[i] * 60 + n[i] * 14; return [v * 0.92, v * 0.98, v * 1.04]; } };
  },
  tiles(size, seed) {
    const n = fbm(size, 32, 3, seed), g = fbm(size, 6, 3, seed + 6);
    const height = new Float32Array(size * size), rough = new Float32Array(size * size);
    const cell = size / 4, line = Math.max(2, size / 96);
    const colorIdx = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const fx = x % cell, fy = y % cell, groove = fx < line || fy < line;
      height[i] = groove ? 0 : 0.7 + n[i] * 0.05;
      rough[i] = groove ? 0.9 : 0.28 + n[i] * 0.2;
      colorIdx[i] = groove ? -1 : 0;
    }
    return {
      height, rough, normalStrength: 2.4,
      color: (i) => {
        if (colorIdx[i] < 0) return [92, 94, 98];
        const v = 214 + (g[i] - 0.5) * 30 + (n[i] - 0.5) * 12; return [v, v * 1.0, v * 1.01];
      },
    };
  },
  brick(size, seed) {
    const n = fbm(size, 24, 3, seed), g = fbm(size, 5, 3, seed + 6);
    const rows = 8, bh = size / rows, bw = size / 4, mortar = Math.max(2, size / 128);
    const height = new Float32Array(size * size), rough = new Float32Array(size * size).fill(0.92);
    const rnd = mulberry32(seed + 55);
    const tone = new Float32Array(rows * 8).map(() => rnd());
    const col = new Float32Array(size * size * 3);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x, r = Math.floor(y / bh), off = (r % 2) * bw * 0.5;
      const xx = (x + off) % size, c = Math.floor(xx / bw);
      const inY = y % bh, inX = xx % bw, isM = inY < mortar || inX < mortar;
      const t = tone[(r * 8 + c) % tone.length];
      height[i] = isM ? 0 : 0.7 + n[i] * 0.2;
      const v = isM ? 0 : 1;
      col[i * 3] = isM ? 168 : (128 + t * 56 + g[i] * 20); col[i * 3 + 1] = isM ? 162 : (62 + t * 22 + g[i] * 10); col[i * 3 + 2] = isM ? 152 : (48 + t * 14 + g[i] * 8);
      void v;
    }
    return { height, rough, normalStrength: 2.6, color: (i) => [col[i * 3], col[i * 3 + 1], col[i * 3 + 2]] };
  },
  wood(size, seed) {
    const a = fbm(size, 3, 4, seed), b = fbm(size, 64, 2, seed + 4);
    const height = new Float32Array(size * size), rough = new Float32Array(size * size).fill(0.7);
    const planks = 6, pw = size / planks, rnd = mulberry32(seed + 31);
    const ptone = new Float32Array(planks).map(() => rnd());
    const col = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x, p = Math.floor(x / pw), gap = x % pw < 2;
      const grain = 0.5 + 0.5 * Math.sin((x / size) * 90 + a[i] * 14 + b[i] * 3);
      height[i] = gap ? 0 : grain * 0.5 + 0.3;
      col[i] = gap ? 0 : (0.6 + grain * 0.4) * (0.75 + ptone[p] * 0.4);
    }
    return { height, rough, normalStrength: 1.5, color: (i) => [col[i] * 150 + 40 * (col[i] > 0), col[i] * 100 + 24 * (col[i] > 0), col[i] * 62 + 12 * (col[i] > 0)] };
  },
  noiseNormal(size, seed) { // relieve de agua: ondas superpuestas
    const a = fbm(size, 6, 5, seed, 0.55), b = fbm(size, 12, 3, seed + 3, 0.5);
    const height = new Float32Array(size * size);
    for (let i = 0; i < height.length; i++) height[i] = a[i] * 0.7 + b[i] * 0.3;
    return { height, rough: new Float32Array(size * size).fill(0.05), normalStrength: 3.2, color: () => [128, 128, 128] };
  },
};

const cache = new Map();

// Devuelve { map, normalMap, roughnessMap }. repeat = [u, v]. Se guarda en caché por tipo y tamaño.
export function makeSurface(kind, { size = 256, seed = 1, repeat = [1, 1], roughness = true } = {}) {
  const key = `${kind}|${size}|${seed}`;
  let base = cache.get(key);
  if (!base) {
    const def = KINDS[kind](size, seed);
    const colorCanvas = toCanvas(size, (d) => {
      for (let i = 0; i < size * size; i++) {
        const c = def.color(i);
        d[i * 4] = clamp01(c[0] / 255) * 255; d[i * 4 + 1] = clamp01(c[1] / 255) * 255; d[i * 4 + 2] = clamp01(c[2] / 255) * 255; d[i * 4 + 3] = 255;
      }
    });
    const normalCanvas = normalFromHeight(def.height, size, def.normalStrength);
    const roughCanvas = toCanvas(size, (d) => {
      for (let i = 0; i < size * size; i++) { const v = clamp01(def.rough[i]) * 255; d[i * 4] = 0; d[i * 4 + 1] = v; d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; }
    });
    base = { colorCanvas, normalCanvas, roughCanvas };
    cache.set(key, base);
  }
  const out = {
    map: texFrom(base.colorCanvas, true, repeat),
    normalMap: texFrom(base.normalCanvas, false, repeat),
  };
  if (roughness) out.roughnessMap = texFrom(base.roughCanvas, false, repeat);
  return out;
}

// Material PBR a partir de un tipo de superficie
export function surfaceMaterial(kind, opts = {}) {
  const { size, seed, repeat, color = 0xffffff, normalScale = 1, roughness = 1, metalness = 0, extra = {} } = opts;
  const s = makeSurface(kind, { size, seed, repeat });
  return new THREE.MeshStandardMaterial({
    color, map: s.map, normalMap: s.normalMap, normalScale: new THREE.Vector2(normalScale, normalScale),
    roughnessMap: s.roughnessMap, roughness, metalness, ...extra,
  });
}

// Textura de ventanas iluminadas para edificios (emisiva): rejilla con algunas ventanas encendidas
export function windowsTexture({ cols = 8, rows = 4, lit = 0.35, seed = 3, size = 256 } = {}) {
  const rnd = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  const cw = size / cols, ch = size / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (rnd() < lit) { g.fillStyle = rnd() < 0.5 ? '#ffd9a0' : '#fff2cf'; g.fillRect(i * cw + cw * 0.2, j * ch + ch * 0.22, cw * 0.6, ch * 0.5); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Textura de ventanas oscuras con reflejo (color), a juego con la emisiva
export function windowsColorTexture({ cols = 8, rows = 4, seed = 3, size = 256, base = '#a5adb6' } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const cw = size / cols, ch = size / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const grad = g.createLinearGradient(0, j * ch, 0, (j + 1) * ch);
    grad.addColorStop(0, '#3e5566'); grad.addColorStop(1, '#16222c');
    g.fillStyle = grad; g.fillRect(i * cw + cw * 0.2, j * ch + ch * 0.22, cw * 0.6, ch * 0.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export { mulberry32 };
