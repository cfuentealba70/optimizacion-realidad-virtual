// Ejemplo 4. Caja sin tapa hecha con un cartón cuadrado de 24 pulgadas: se cortan cuadrados de lado x
// en las esquinas y se doblan los bordes. V(x) = (24 − 2x)² x, 0 < x < 12.
// La escena es un taller de obra con techo traslúcido: el mesón con la tabla de corte, un trabajador que corta
// las esquinas con cuchillo cartonero y regla metálica, y una compañera que encinta las cajas terminadas.
import { CAJA as M } from '../../src/math/guia4.js';

const PULG = 0.0254; // metros por pulgada
const MESA = 0.9; // cubierta del mesón
const TOPE = MESA + 0.003; // cara de la tabla de corte, donde descansa el cartón
const ESP = 0.004; // espesor del cartón corrugado
const LADO = M.L * PULG; // arista del cartón: 0,6096 m
const MITAD = LADO / 2;
const CZ = -0.07; // centro del cartón sobre el mesón (z local)
const MZ = -0.025; // centro del mesón (borde delantero en z = 0,45)
const L3 = 0.016387064; // litros por pulgada cúbica
const PISO = 0.012; // altura del piso del taller
const XT = 2.45, ZB = -2.15, ZF = 2.05, YB = 2.6, YF = 2.82; // planta del taller y altura del techo atrás y adelante
const techoY = (z) => YB + ((YF - YB) * (z - ZB)) / (ZF - ZB);
const RL = 0.66, RA = 0.032, R0 = 0.014; // reglas de 24 pulgadas: largo, ancho y margen antes del cero
const OBRERO = [0.28, -0.68]; // donde trabaja el cortador, detrás del mesón
const AYUDA = [1.0, -1.78]; // donde trabaja la compañera, detrás de la mesa de embalaje
const CAJITA = { x: 0.96, z: -1.27, b: 0.32, h: 0.15, y: 0.8255 }; // caja que encinta la compañera
const T_CORTE = 2.4, T_CINTA = 4.4; // duración del gesto de corte y del ciclo de encintado

const lerp = (a, b, t) => a + (b - a) * t;
const suave = (p) => { const t = Math.min(1, Math.max(0, p)); return t * t * (3 - 2 * t); };
const mezcla = (A, B, t) => [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];

// Revisión de capturas: rev=corte:0.8,cinta:1.2,x:4,plano:1,lleno:1 fija los gestos, el corte x y el estado de la caja
function leerRev() {
  const r = {};
  try {
    const q = new URLSearchParams(location.search).get('rev');
    if (q) for (const par of q.split(',')) { const [k, v] = par.split(':'); if (k) r[k] = v === undefined ? 1 : Number(v); }
  } catch { /* sin parámetro de revisión */ }
  return r;
}

// ------------------------------------------------------------------ geometría
// Caja con coordenadas UV a escala real: caras horizontales con s metros por repetición,
// caras verticales con su metros a lo largo y sv metros en el alto.
function cajaUV(THREE, w, h, d, { s = 0.25, su = s, sv = s, girar = false } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + h / 2, z = p.getZ(i);
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, (girar ? z : x) / s, (girar ? x : z) / s);
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, z / su, y / sv);
    else uv.setXY(i, x / su, y / sv);
  }
  uv.needsUpdate = true;
  return geo;
}

const _m4 = { m: null, q: null, e: null, p: null, s: null };
function ubicar(THREE, geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, orden = 'XYZ' } = {}) {
  if (!_m4.m) Object.assign(_m4, { m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() });
  _m4.e.set(rx, ry, rz, orden); _m4.q.setFromEuler(_m4.e); _m4.p.set(x, y, z); _m4.s.set(sx, sy, sz);
  geo.applyMatrix4(_m4.m.compose(_m4.p, _m4.q, _m4.s));
  return geo;
}
function pintar(THREE, geo, color, k = 1) {
  const n = geo.attributes.position.count, c = new THREE.Color(color), a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
// Une geometrías que comparten material (posición, normal, uv y color)
function unir(kit, geos) {
  const { THREE } = kit;
  const lista = geos.map((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (g !== g0) g0.dispose();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.color) pintar(THREE, g, 0xffffff);
    g.clearGroups();
    return g;
  });
  const out = kit.mergeGeometries(lista, false);
  for (const g of lista) g.dispose();
  return out;
}
// Invierte las caras (para el interior de baldes, tazas y pantallas)
function invertir(geo0) {
  const geo = geo0.index ? geo0.toNonIndexed() : geo0;
  for (const nombre of Object.keys(geo.attributes)) {
    const at = geo.attributes[nombre], k = at.itemSize;
    for (let i = 0; i < at.count; i += 3) for (let c = 0; c < k; c++) {
      const a = at.array[(i + 1) * k + c]; at.array[(i + 1) * k + c] = at.array[(i + 2) * k + c]; at.array[(i + 2) * k + c] = a;
    }
  }
  const n = geo.attributes.normal;
  if (n) for (let i = 0; i < n.array.length; i++) n.array[i] = -n.array[i];
  return geo;
}
// Anillo con espesor (rollos de cinta) alrededor del eje y
function anillo(THREE, rIn, rOut, ancho, seg = 28) {
  const pts = [[rIn, -ancho / 2], [rOut, -ancho / 2], [rOut, ancho / 2], [rIn, ancho / 2], [rIn, -ancho / 2]].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, seg);
}

// Atlas del cartón (512 × 512): cara kraft arriba, canto de una lámina, costado de una pila y el croquis en papel
const AT = { canto: [1 - 397 / 512, 1 - 387 / 512], pila: [0.004, 1 - 510 / 512, 0.738, 1 - 402 / 512], croquis: [388 / 512, 1 - 510 / 512, 508 / 512, 1 - 402 / 512] };
// Pieza de cartón: caras grandes con la textura de la lámina (desplazada en ou, ov), cantos finos y costados de pila
function geoCarton(THREE, w, h, d, { pila = false, ou = null, ov = null } = {}) {
  const nb = pila ? Math.max(1, Math.round(h / 0.064)) : 1;
  const geo = new THREE.BoxGeometry(w, h, d, 1, nb, 1).toNonIndexed();
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  const offU = ou ?? MITAD, offV = ov ?? MITAD;
  for (let t = 0; t < p.count; t += 3) {
    const nx = Math.abs(n.getX(t)), ny = Math.abs(n.getY(t));
    const cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3;
    for (let j = t; j < t + 3; j++) {
      const x = p.getX(j), y = p.getY(j), z = p.getZ(j);
      let a, c, ea, ec;
      if (ny > 0.5) { a = x; c = z; ea = w; ec = d; } else if (nx > 0.5) { a = z; c = y; ea = d; ec = h; } else { a = x; c = y; ea = w; ec = h; }
      if (Math.min(ea, ec) <= 0.0081) {
        const largo = ea >= ec ? a : c, ancho = ea >= ec ? c : a, eL = Math.max(ea, ec), eA = Math.max(1e-5, Math.min(ea, ec));
        uv.setXY(j, 0.02 + 0.96 * (largo / eL + 0.5) * Math.min(1, eL / LADO), lerp(AT.canto[0], AT.canto[1], ancho / eA + 0.5));
      } else if (pila && ny < 0.5) {
        const hb = h / nb, banda = Math.min(nb - 1, Math.floor((cy + h / 2) / hb));
        uv.setXY(j, lerp(AT.pila[0], AT.pila[2], (a / ea + 0.5) * Math.min(1, ea / LADO)), lerp(AT.pila[1], AT.pila[3], (y + h / 2 - banda * hb) / hb));
      } else {
        uv.setXY(j, Math.min(1, Math.max(0, (a + offU) / LADO)), 0.25 + 0.75 * Math.min(1, Math.max(0, (c + offV) / LADO)));
      }
    }
  }
  return geo;
}
// Caja abierta terminada: base y cuatro paredes de cartón
function cajaAbierta(THREE, b, h, rnd) {
  const ou = MITAD + (rnd() - 0.5) * (LADO - b) * 0.8;
  const piezas = [ubicar(THREE, geoCarton(THREE, b, ESP, b, { ou, ov: ou }), { y: ESP / 2 })];
  for (let k = 0; k < 4; k++) {
    const pared = geoCarton(THREE, b + (k % 2 ? 0 : 2 * ESP), h, ESP, { ou, ov: MITAD + b / 2 + h / 2 });
    ubicar(THREE, pared, { z: b / 2 + ESP / 2, y: h / 2 + ESP * 0.5, rx: (rnd() - 0.5) * 0.03 });
    ubicar(THREE, pared, { ry: (k * Math.PI) / 2 });
    piezas.push(pared);
  }
  return piezas;
}
// Regla metálica: la cara superior lleva la graduación (u0..u1 del ancho de la textura) y el resto, acero liso
function geoRegla(THREE, largo, ancho, alto, u0 = 0, u1 = 1) {
  const geo = new THREE.BoxGeometry(largo, alto, ancho);
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    if (n.getY(i) > 0.5) uv.setXY(i, lerp(u0, u1, p.getX(i) / largo + 0.5), 0.5 - p.getZ(i) / ancho);
    else uv.setXY(i, 0.993, 0.5);
  }
  return geo;
}

// ------------------------------------------------------------------ texturas (lienzos de 256 o 512)
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texturaDe(THREE, c, repetir = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function mancha(g, x, y, rx, ry, color) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, color); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
}

// Croquis a lápiz del cartón con las esquinas recortadas y los dobleces
function croquis(g, x0, y0, w, h) {
  const cx = x0 + w / 2, cy = y0 + h / 2 + 5, L = 38, q = 12.5;
  g.save();
  g.strokeStyle = 'rgba(52,52,60,0.92)'; g.lineWidth = 1.1;
  const P = [[-L + q, -L], [L - q, -L], [L - q, -L + q], [L, -L + q], [L, L - q], [L - q, L - q], [L - q, L], [-L + q, L], [-L + q, L - q], [-L, L - q], [-L, -L + q], [-L + q, -L + q]];
  g.beginPath(); P.forEach(([px, py], i) => (i ? g.lineTo(cx + px, cy + py) : g.moveTo(cx + px, cy + py))); g.closePath(); g.stroke();
  g.lineWidth = 0.7; g.strokeStyle = 'rgba(52,52,60,0.5)';
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const ax = Math.min(cx + sx * L, cx + sx * (L - q)), ay = Math.min(cy + sy * L, cy + sy * (L - q));
    g.strokeRect(ax, ay, q, q);
    g.save(); g.beginPath(); g.rect(ax, ay, q, q); g.clip();
    for (let k = -q; k < q; k += 3) { g.beginPath(); g.moveTo(ax + k, ay + q); g.lineTo(ax + k + q, ay); g.stroke(); }
    g.restore();
  }
  g.setLineDash([2.5, 2]); g.strokeStyle = 'rgba(52,52,60,0.8)'; g.lineWidth = 0.9;
  g.strokeRect(cx - L + q, cy - L + q, 2 * (L - q), 2 * (L - q));
  g.setLineDash([]);
  g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx - L, cy - L - 4); g.lineTo(cx + L, cy - L - 4); g.stroke();
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * L, cy - L - 7); g.lineTo(cx + sx * L, cy - L - 1); g.stroke(); }
  g.fillStyle = 'rgba(40,40,48,0.95)'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '700 9px Georgia, serif'; g.fillText('24', cx, cy - L - 6);
  g.font = 'italic 700 9px Georgia, serif'; g.fillText('x', cx + L - q / 2, cy - L + q + 9); g.fillText('x', cx + L + 5, cy - L + q / 2 + 3);
  g.restore();
}

// Papel kraft, cantos, costados de pila y croquis en un solo atlas (ver AT)
function texturaLamina(kit) {
  const { THREE } = kit, S = 512, [c, g] = lienzo(S, S);
  const a = kit.fbm(S, 5, 4, 71), f = kit.fbm(S, 64, 2, 73), rnd = kit.mulberry32(74);
  const img = g.createImageData(S, S), d = img.data;
  const tonoCapa = Array.from({ length: 18 }, () => 0.8 + rnd() * 0.32);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, k = i * 4;
    let r, gr, b;
    if (y < 384) {
      const onda = 0.5 + 0.5 * Math.sin((y / 384) * Math.PI * 2 * 70);
      const v = 0.93 + (a[i] - 0.5) * 0.22 + (f[i] - 0.5) * 0.1 - onda * 0.035;
      r = 198 * v; gr = 154 * v; b = 102 * v;
    } else if (y < 400) {
      const fy = y - 384, onda = 7.5 + 3.6 * Math.sin((x / 4) * Math.PI * 2), dd = Math.abs(fy - onda);
      if (fy < 3 || fy > 12) { r = 176; gr = 134; b = 86; } else if (dd < 1.3) { r = 158; gr = 118; b = 72; } else { r = 66; gr = 46; b = 26; }
    } else if (x < 384) {
      const fy = (y - 400) % 7, t = tonoCapa[Math.floor((y - 400) / 7)];
      const onda = 3 + 1.6 * Math.sin((x / 3.2) * Math.PI * 2 + t * 9);
      let v = fy === 0 || fy === 6 ? 0.95 : Math.abs(fy - onda) < 0.9 ? 0.72 : 0.36;
      v *= t * (0.92 + f[i] * 0.16);
      r = 190 * v; gr = 146 * v; b = 96 * v;
    } else {
      const v = 0.97 + (f[i] - 0.5) * 0.05;
      r = 238 * v; gr = 234 * v; b = 224 * v;
    }
    d[k] = r; d[k + 1] = gr; d[k + 2] = b; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // fibras sueltas, roces y huellas de manipulación en la cara
  g.save(); g.beginPath(); g.rect(0, 0, S, 384); g.clip();
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * S, y = rnd() * 384, l = 2 + rnd() * 6, an = rnd() * Math.PI;
    g.strokeStyle = rnd() < 0.5 ? 'rgba(90,60,30,0.22)' : 'rgba(235,205,160,0.25)'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke();
  }
  for (let i = 0; i < 9; i++) mancha(g, rnd() * S, rnd() * 384, 8 + rnd() * 26, 6 + rnd() * 18, `rgba(95,62,30,${0.06 + rnd() * 0.08})`);
  g.restore();
  croquis(g, 384, 400, 128, 112);
  return texturaDe(THREE, c, false);
}

// Regla metálica: pulgadas en el borde lejano y centímetros en el cercano
function texturaRegla(THREE) {
  const W = 1024, H = Math.round((W * RA) / RL);
  const [c, g] = lienzo(W, H);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#dfe3e7'); gr.addColorStop(0.5, '#c2c7cc'); gr.addColorStop(1, '#d6dade');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '60,64,70'},0.12)`; g.fillRect(Math.random() * W, Math.random() * H, 6 + Math.random() * 40, 0.6); }
  const pxm = W / RL;
  g.fillStyle = '#16181b'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k <= 24 * 8; k++) {
    const x = (R0 + (k * PULG) / 8) * pxm;
    const f = k % 8 === 0 ? 0.38 : k % 4 === 0 ? 0.27 : k % 2 === 0 ? 0.19 : 0.12;
    g.fillRect(x - 0.8, 0, 1.6, H * f);
    if (k % 8 === 0 && k > 0) { g.font = `700 ${Math.round(H * 0.24)}px system-ui, sans-serif`; g.fillText(String(k / 8), x, H * 0.5); }
  }
  for (let mm = 0; mm <= 630; mm += 5) {
    const x = (R0 + mm / 1000) * pxm, f = mm % 10 === 0 ? 0.24 : 0.14;
    g.fillRect(x - 0.7, H * (1 - f), 1.4, H * f);
    if (mm % 50 === 0 && mm > 0) { g.font = `600 ${Math.round(H * 0.17)}px system-ui, sans-serif`; g.fillText(String(mm / 10), x, H * 0.7); }
  }
  g.font = `700 ${Math.round(H * 0.15)}px system-ui, sans-serif`; g.textAlign = 'left';
  g.fillText('pulg', 4, H * 0.16 + 4); g.fillText('cm', 4, H * 0.84);
  return texturaDe(THREE, c, false);
}

// Color de pino claro que calza con el relieve del material 'wood' de la misma semilla
function texturaPino(kit, seed) {
  const { THREE } = kit, size = 256;
  const a = kit.fbm(size, 3, 4, seed), b = kit.fbm(size, 64, 2, seed + 4), r = kit.mulberry32(seed + 31);
  const tono = new Float32Array(6).map(() => r());
  const [c, g] = lienzo(size, size);
  const img = g.createImageData(size, size), pw = size / 6;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, k = i * 4;
    if (x % pw < 2) { img.data[k] = 96; img.data[k + 1] = 74; img.data[k + 2] = 52; img.data[k + 3] = 255; continue; }
    const veta = 0.5 + 0.5 * Math.sin((x / size) * 90 + a[i] * 14 + b[i] * 3);
    const v = (0.87 + veta * 0.13) * (0.9 + tono[Math.floor(x / pw)] * 0.14);
    img.data[k] = 184 * v; img.data[k + 1] = 134 * v; img.data[k + 2] = 82 * v; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // nudos, golpes y manchas de uso
  for (let i = 0; i < 5; i++) { const x = r() * size, y = r() * size; mancha(g, x, y, 5 + r() * 4, 3 + r() * 2, 'rgba(92,58,28,0.55)'); }
  for (let i = 0; i < 14; i++) mancha(g, r() * size, r() * size, 6 + r() * 22, 4 + r() * 12, `rgba(60,40,20,${0.05 + r() * 0.08})`);
  for (let i = 0; i < 40; i++) {
    const x = r() * size, y = r() * size, l = 4 + r() * 18, an = r() * Math.PI;
    g.strokeStyle = 'rgba(70,45,22,0.28)'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke();
  }
  return texturaDe(THREE, c);
}

// Tablero OSB: astillas orientadas, juntas entre planchas y clavos sobre los pies derechos (tesela de 1,22 m)
function texturaOSB(kit) {
  const { THREE } = kit, S = 256, [c, g] = lienzo(S, S), r = kit.mulberry32(51);
  g.fillStyle = '#ad8c5c'; g.fillRect(0, 0, S, S);
  const tonos = ['#c9a66d', '#a8844f', '#d6b47a', '#8f6c3d', '#bf9a60', '#b48e57', '#9c7846'];
  for (let i = 0; i < 1300; i++) {
    const x = r() * S, y = r() * S, l = 6 + r() * 20, an = (r() - 0.5) * 1.3 + (r() < 0.3 ? Math.PI / 2 : 0), w = 2.5 + r() * 5;
    g.fillStyle = tonos[Math.floor(r() * tonos.length)]; g.globalAlpha = 0.65 + r() * 0.3;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      if (x + ox < -30 || x + ox > S + 30 || y + oy < -30 || y + oy > S + 30) continue;
      g.save(); g.translate(x + ox, y + oy); g.rotate(an); g.fillRect(-l / 2, -w / 2, l, w); g.restore();
    }
  }
  g.globalAlpha = 1;
  // juntas de las planchas y oscurecimiento de los bordes
  g.fillStyle = 'rgba(38,26,14,0.85)'; g.fillRect(0, 0, 2, S); g.fillRect(0, 0, S, 2);
  for (const [x, y, w, h] of [[2, 0, 6, S], [0, 2, S, 6], [S - 6, 0, 6, S], [0, S - 6, S, 6]]) { g.fillStyle = 'rgba(60,40,20,0.12)'; g.fillRect(x, y, w, h); }
  // clavos sobre los pies derechos cada 0,4 m
  g.fillStyle = 'rgba(55,50,45,0.9)';
  for (const x of [5, 89, 173, 251]) for (let y = 8; y < S; y += 22) { g.beginPath(); g.arc(x, y, 1.1, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 10; i++) mancha(g, r() * S, r() * S, 10 + r() * 30, 8 + r() * 20, `rgba(70,50,30,${0.05 + r() * 0.07})`);
  return texturaDe(THREE, c);
}

// Panel perforado de herramientas: agujeros de 6 mm cada 25 mm (tesela de 0,2 m)
function texturaPerforado(kit) {
  const { THREE } = kit, S = 256, [c, g] = lienzo(S, S), a = kit.fbm(S, 8, 3, 61), r = kit.mulberry32(62);
  const img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const v = 0.9 + (a[i] - 0.5) * 0.18; img.data[i * 4] = 150 * v; img.data[i * 4 + 1] = 114 * v; img.data[i * 4 + 2] = 76 * v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    const x = 16 + i * 32, y = 16 + j * 32;
    g.fillStyle = 'rgba(205,170,130,0.5)'; g.beginPath(); g.arc(x + 0.8, y + 0.8, 5.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a120b'; g.beginPath(); g.arc(x, y, 4.2, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 6; i++) mancha(g, r() * S, r() * S, 12 + r() * 24, 8 + r() * 14, `rgba(60,40,22,${0.06 + r() * 0.06})`);
  return texturaDe(THREE, c);
}

// Tabla de corte verde con cuadrícula de 1 cm, numeración, diagonales y marcas de cuchillo (1,04 × 0,8 m)
function texturaTapete(kit) {
  const { THREE } = kit, S = 512, [c, g] = lienzo(S, S), a = kit.fbm(S, 8, 3, 41), r = kit.mulberry32(42);
  const img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const v = 0.94 + (a[i] - 0.5) * 0.1; img.data[i * 4] = 44 * v; img.data[i * 4 + 1] = 104 * v; img.data[i * 4 + 2] = 82 * v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const W = 104, H = 80, px = (cm) => (cm / W) * S, py = (cm) => (cm / H) * S;
  for (let k = 2; k <= W - 2; k++) { const f = k % 10 === 2 ? 0.75 : k % 5 === 2 ? 0.5 : 0.26; g.fillStyle = `rgba(222,240,230,${f})`; g.fillRect(px(k) - (f > 0.7 ? 0.9 : 0.5), py(2), f > 0.7 ? 1.8 : 1, py(H - 4)); }
  for (let k = 2; k <= H - 2; k++) { const f = k % 10 === 2 ? 0.75 : k % 5 === 2 ? 0.5 : 0.26; g.fillStyle = `rgba(222,240,230,${f})`; g.fillRect(px(2), py(k) - (f > 0.7 ? 0.9 : 0.5), px(W - 4), f > 0.7 ? 1.8 : 1); }
  g.strokeStyle = 'rgba(222,240,230,0.35)'; g.lineWidth = 0.8; g.setLineDash([4, 3]);
  for (const [x1, y1] of [[2 + 76, 2 + 76], [2 + 44, 2 + 76]]) { g.beginPath(); g.moveTo(px(2), py(2)); g.lineTo(px(x1), py(y1)); g.stroke(); }
  g.setLineDash([]);
  g.fillStyle = 'rgba(232,245,238,0.85)'; g.font = '600 9px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 10; k <= W - 4; k += 10) { g.fillText(String(k), px(k + 2), py(1)); g.fillText(String(k), px(k + 2), py(H - 1)); }
  for (let k = 10; k <= H - 4; k += 10) { g.fillText(String(k), px(1), py(k + 2)); g.fillText(String(k), px(W - 1), py(k + 2)); }
  // cortes de cuchillo acumulados y algo de suciedad
  for (let i = 0; i < 260; i++) {
    const x = px(20 + r() * 64), y = py(10 + r() * 60), l = 6 + r() * 40, hor = r() < 0.5;
    g.strokeStyle = `rgba(190,225,210,${0.1 + r() * 0.2})`; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hor ? l : (r() - 0.5) * 3), y + (hor ? (r() - 0.5) * 3 : l)); g.stroke();
  }
  for (let i = 0; i < 12; i++) mancha(g, r() * S, r() * S, 10 + r() * 30, 8 + r() * 20, `rgba(20,30,25,${0.06 + r() * 0.08})`);
  return texturaDe(THREE, c, false);
}

// Alfombra antifatiga de goma con perforaciones (tesela de 0,2 m)
function texturaGoma(kit) {
  const { THREE } = kit, S = 256, [c, g] = lienzo(S, S), r = kit.mulberry32(31);
  g.fillStyle = '#2a2a29'; g.fillRect(0, 0, S, S);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    const x = (i + (j % 2) * 0.5) * 32 + 16, y = j * 32 + 16;
    for (const ox of [-S, 0, S]) {
      g.fillStyle = '#3a3a38'; g.beginPath(); g.arc(x + ox, y, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#121212'; g.beginPath(); g.arc(x + ox, y, 8, 0, Math.PI * 2); g.fill();
    }
  }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(150,140,120,${0.1 + r() * 0.2})`; g.fillRect(r() * S, r() * S, 1.2, 1.2); }
  return texturaDe(THREE, c);
}

// Suciedad suave para piezas pintadas (multiplica el color de cada vértice)
function texturaMugre(kit) {
  const { THREE } = kit, S = 256, [c, g] = lienzo(S, S), a = kit.fbm(S, 8, 4, 91), r = kit.mulberry32(92);
  const img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const v = 222 + (a[i] - 0.5) * 60; img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.98; img.data[i * 4 + 2] = v * 0.95; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(60,50,40,${0.1 + r() * 0.25})`; g.beginPath(); g.arc(r() * S, r() * S, 0.6 + r() * 1.6, 0, Math.PI * 2); g.fill(); }
  return texturaDe(THREE, c);
}

// Losa del taller (4,9 × 4,2 m, sin repetir): juntas, aceite, pintura, huellas, polvo de cartón y demarcación
function texturaPiso(kit) {
  const { THREE } = kit, S = 512, [c, g] = lienzo(S, S);
  const a = kit.fbm(S, 6, 5, 81), b = kit.fbm(S, 24, 3, 82), r = kit.mulberry32(83);
  const img = g.createImageData(S, S), d = img.data;
  for (let i = 0; i < S * S; i++) {
    const v = 176 + (a[i] - 0.5) * 48 + (b[i] - 0.5) * 22;
    d[i * 4] = v; d[i * 4 + 1] = v * 0.975; d[i * 4 + 2] = v * 0.93; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const sx = S / (2 * XT), sz = S / (ZF - ZB);
  const P = (x, z) => [(x + XT) * sx, (z - ZB) * sz];
  // polvo junto a los muros y paso gastado frente al mesón
  let gr = g.createLinearGradient(0, 0, 0, 0.25 * S); gr.addColorStop(0, 'rgba(95,82,62,0.38)'); gr.addColorStop(1, 'rgba(95,82,62,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, 0.25 * S);
  gr = g.createLinearGradient(0, 0, 0.18 * S, 0); gr.addColorStop(0, 'rgba(95,82,62,0.32)'); gr.addColorStop(1, 'rgba(95,82,62,0)'); g.fillStyle = gr; g.fillRect(0, 0, 0.18 * S, S);
  { const [x, y] = P(0, 1.2); mancha(g, x, y, 150, 60, 'rgba(225,222,214,0.22)'); }
  // juntas de dilatación cortadas con disco
  g.strokeStyle = 'rgba(48,44,40,0.75)'; g.lineWidth = 1.4;
  for (const t of [1 / 3, 2 / 3]) {
    g.beginPath(); g.moveTo(t * S, 0); g.lineTo(t * S, S); g.stroke();
    g.beginPath(); g.moveTo(0, t * S); g.lineTo(S, t * S); g.stroke();
  }
  g.strokeStyle = 'rgba(235,232,225,0.35)'; g.lineWidth = 0.8;
  for (const t of [1 / 3, 2 / 3]) { g.beginPath(); g.moveTo(t * S + 1.5, 0); g.lineTo(t * S + 1.5, S); g.stroke(); g.beginPath(); g.moveTo(0, t * S + 1.5); g.lineTo(S, t * S + 1.5); g.stroke(); }
  // manchas de aceite (varias capas irregulares)
  for (const [x, z, rr] of [[-1.55, -0.95, 0.26], [1.85, -0.75, 0.2], [-0.75, 1.15, 0.16], [2.05, 1.35, 0.3], [-1.95, 1.6, 0.18], [0.95, 0.85, 0.1]]) {
    const [px, py] = P(x, z);
    for (let k = 0; k < 9; k++) mancha(g, px + (r() - 0.5) * rr * sx, py + (r() - 0.5) * rr * sz, rr * sx * (0.35 + r() * 0.5), rr * sz * (0.25 + r() * 0.45), `rgba(38,32,26,${0.08 + r() * 0.1})`);
  }
  // aro de agua bajo el balde y salpicaduras de pintura
  { const [px, py] = P(1.32, 0.15); g.strokeStyle = 'rgba(80,72,60,0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(px + 3, py + 2, 0.15 * sx, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 26; i++) {
    const col = ['rgba(240,150,40,0.8)', 'rgba(60,110,190,0.75)', 'rgba(240,240,232,0.8)', 'rgba(200,60,40,0.7)'][Math.floor(r() * 4)];
    const [px, py] = P(-2.2 + r() * 4.4, -1.9 + r() * 3.8);
    g.fillStyle = col; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(px + (r() - 0.5) * 8, py + (r() - 0.5) * 8, 0.6 + r() * 2.2, 0, Math.PI * 2); g.fill(); }
  }
  // huellas de botas y marcas negras de goma
  for (let i = 0; i < 40; i++) {
    const [px, py] = P(-1.6 + r() * 3.6, -1.5 + r() * 3.2), an = r() * Math.PI * 2;
    g.save(); g.translate(px, py); g.rotate(an); g.fillStyle = `rgba(70,62,52,${0.08 + r() * 0.08})`; g.fillRect(-5, -2, 10, 4); g.restore();
  }
  for (let i = 0; i < 9; i++) {
    const [px, py] = P(-1.8 + r() * 3.6, -1.6 + r() * 3.4);
    g.strokeStyle = 'rgba(25,22,20,0.3)'; g.lineWidth = 1.2; g.beginPath(); g.arc(px, py, 6 + r() * 14, r() * 6, r() * 6 + 0.8 + r()); g.stroke();
  }
  // polvo y astillas de cartón alrededor del mesón
  for (let i = 0; i < 520; i++) {
    const [px, py] = P(-1.25 + r() * 2.5, -1.0 + r() * 1.7);
    g.fillStyle = `rgba(${150 + r() * 50},${110 + r() * 40},${60 + r() * 30},${0.25 + r() * 0.35})`; g.fillRect(px, py, 0.8 + r() * 2.4, 0.8 + r() * 1.4);
  }
  // demarcación amarilla gastada del sector de acopio (pallet)
  {
    const [x0, y0] = P(1.42, -0.5), [x1, y1] = P(2.4, 0.62);
    for (let i = 0; i < 140; i++) {
      const t = i / 140, lado = Math.floor(t * 4), u = (t * 4) % 1;
      const pts = [[lerp(x0, x1, u), y0], [x1, lerp(y0, y1, u)], [lerp(x1, x0, u), y1], [x0, lerp(y1, y0, u)]][lado];
      g.fillStyle = `rgba(226,186,40,${r() < 0.2 ? 0.15 : 0.55 + r() * 0.3})`; g.fillRect(pts[0] - 2.2, pts[1] - 2.2, 4.4, 4.4);
    }
  }
  return texturaDe(THREE, c, false);
}

// ------------------------------------------------------------------ estación
export default {
  id: 'caja',
  tipo: 'optimizacion',
  etiqueta: 'Ejemplo 4 · Optimización',
  titulo: 'Caja de volumen máximo',
  resumen: 'Se desea construir una caja sin tapa a partir de un cartón cuadrado de 24 pulgadas de lado, cortando cuadrados iguales en las esquinas y doblando los bordes. Si se quiere que la caja tenga el máximo volumen posible, ¿cuáles deben ser sus dimensiones?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const rev = leerRev();
    const s = { x: 2.5, plegado: true, lleno: false, revelar: false, prog: 1, nivel: 0, cambio: true, pose: true, corte: -1, repetir: false, tCinta: 0.3, lean: 0.25 };
    if (Number.isFinite(rev.x)) s.x = Math.min(11.75, Math.max(0.25, rev.x));
    if (rev.plano) { s.plegado = false; s.prog = 0; }
    if (rev.lleno) { s.lleno = true; s.plegado = true; s.prog = 1; s.nivel = 1; }
    const rnd = kit.mulberry32(41);
    const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

    // ---------------------------------------------------------------- materiales
    const madera = kit.mat('wood', { repeat: [1, 1], color: 0xffffff, normalScale: 0.3, seed: 12 });
    madera.map.dispose(); madera.map = texturaPino(kit, 12);
    madera.roughnessMap = null; madera.roughness = 0.86; madera.vertexColors = true;
    const metal = kit.mat('metal', { repeat: [2, 2], color: 0xffffff, metalness: 0.72, roughness: 0.48, normalScale: 0.4 });
    metal.vertexColors = true;
    const mugre = texturaMugre(kit);
    const pintado = new THREE.MeshStandardMaterial({ vertexColors: true, map: mugre, roughness: 0.58, metalness: 0.08 });
    const osb = kit.mat('concrete', { repeat: [4, 4], color: 0xffffff, normalScale: 0.35, seed: 19 });
    osb.map.dispose(); osb.map = texturaOSB(kit); osb.roughnessMap = null; osb.roughness = 0.88;
    const perforado = new THREE.MeshStandardMaterial({ map: texturaPerforado(kit), roughness: 0.82 });
    const lamina = new THREE.MeshStandardMaterial({ map: texturaLamina(kit), roughness: 0.93 });
    const reglaMat = new THREE.MeshStandardMaterial({ map: texturaRegla(THREE), metalness: 0.45, roughness: 0.36 });
    const techo = new THREE.MeshStandardMaterial({ color: 0xdfe9ee, transparent: true, opacity: 0.32, roughness: 0.22, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    const goma = new THREE.MeshStandardMaterial({ map: texturaGoma(kit), roughness: 0.92 });
    const tapeteMat = new THREE.MeshStandardMaterial({ map: texturaTapete(kit), roughness: 0.78, polygonOffset: true, polygonOffsetFactor: -1 });
    const cintaMat = new THREE.MeshStandardMaterial({ color: 0xc58f3e, roughness: 0.28, metalness: 0, transparent: true, opacity: 0.86, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    const arenaMat = kit.mat('sand', { repeat: [1, 1], color: 0xffd9a2, normalScale: 0.9 });

    // lotes de geometría estática que comparten material (una llamada de dibujo por lote)
    const L = { madera: [], metal: [], pintado: [], osb: [], perforado: [], techo: [], carton: [], regla: [] };
    const add = (lote, geo, o = {}, color = 0xffffff) => { ubicar(THREE, geo, o); if (lote !== 'carton' && lote !== 'regla' && lote !== 'perforado' && lote !== 'osb' && lote !== 'techo') pintar(THREE, geo, color); L[lote].push(geo); return geo; };
    const tinte = (hex, v = 0.08) => new THREE.Color(hex).multiplyScalar(1 + (rnd() - 0.5) * v * 2);
    const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const CIL = (r0, r1, h, seg = 12, abierto = false) => new THREE.CylinderGeometry(r1, r0, h, seg, 1, abierto);
    // cinta de embalaje doblada en L sobre las cuatro esquinas de una caja abierta (base en el origen)
    const cintaCaja = (b, h) => {
      const c = b / 2 + ESP, lista = [];
      for (let k = 0; k < 4; k++) {
        const a = ubicar(THREE, BOX(0.026, h, 0.0008), { x: c - 0.013, y: h / 2 + ESP, z: c + 0.0004 });
        const d = ubicar(THREE, BOX(0.0008, h, 0.026), { x: c + 0.0004, y: h / 2 + ESP, z: c - 0.013 });
        for (const geo of [a, d]) lista.push(ubicar(THREE, geo, { ry: (k * Math.PI) / 2 }));
      }
      return lista;
    };
    const tubo = (lote, a, b, r, color, seg = 8) => {
      const A = V3(...a), B = V3(...b), dir = B.clone().sub(A), len = dir.length();
      const geo = new THREE.CylinderGeometry(r, r, len, seg);
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir.normalize());
      geo.applyQuaternion(q); geo.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
      return add(lote, geo, {}, color);
    };

    // ---------------------------------------------------------------- piso del taller y alfombra de goma
    const piso = kit.mat('concrete', { repeat: [7, 6], color: 0xffffff, normalScale: 0.55 });
    piso.map.dispose(); piso.map = texturaPiso(kit); piso.polygonOffset = true; piso.polygonOffsetFactor = -3;
    kit.malla(new THREE.PlaneGeometry(2 * XT, ZF - ZB), piso, { rx: -Math.PI / 2, y: PISO, z: (ZB + ZF) / 2, sombra: false, padre: g });
    {
      const geo = cajaUV(THREE, 1.32, 0.013, 0.46, { s: 0.2 });
      kit.malla(geo, goma, { x: OBRERO[0] - 0.02, y: 0.0065, z: OBRERO[1] - 0.06, sombra: false, padre: g });
    }

    // ---------------------------------------------------------------- estructura: pilares, vigas, costaneras y techo traslúcido
    const galv = 0xc3c7cb;
    const pend = Math.atan2(YF - YB, ZF - ZB);
    const pilares = [[-XT + 0.04, ZB + 0.058], [-1.72, ZB + 0.058], [0.62, ZB + 0.058], [XT - 0.04, ZB + 0.058], [-XT + 0.058, -1.18], [-XT + 0.058, -0.2], [XT - 0.04, -0.1], [-XT + 0.04, ZF - 0.04], [XT - 0.04, ZF - 0.04]];
    for (const [x, z] of pilares) {
      const h = techoY(z) - 0.06;
      add('metal', cajaUV(THREE, 0.08, h, 0.08, { s: 0.6 }), { x, y: h / 2, z }, tinte(galv, 0.05));
      add('metal', BOX(0.16, 0.008, 0.16), { x, y: PISO + 0.004, z }, 0x8c9095);
      for (const [dx, dz] of [[0.055, 0.055], [-0.055, 0.055], [0.055, -0.055], [-0.055, -0.055]]) add('metal', CIL(0.008, 0.008, 0.02, 6), { x: x + dx, y: PISO + 0.012, z: z + dz }, 0x6d7176);
    }
    // vigas perimetrales y costaneras siguiendo la pendiente
    add('metal', cajaUV(THREE, 2 * XT, 0.1, 0.06, { s: 0.6 }), { y: techoY(ZB + 0.058) - 0.05, z: ZB + 0.058 }, galv);
    add('metal', cajaUV(THREE, 2 * XT, 0.1, 0.06, { s: 0.6 }), { y: techoY(ZF - 0.04) - 0.05, z: ZF - 0.04 }, galv);
    const largoL = Math.hypot(ZF - ZB, YF - YB);
    for (const x of [-XT + 0.04, XT - 0.04]) add('metal', cajaUV(THREE, 0.06, 0.1, largoL, { s: 0.6 }), { x, y: (YB + YF) / 2 - 0.05, z: (ZB + ZF) / 2, rx: -pend }, galv);
    for (const z of [-1.85, -1.0, -0.15, 0.7, 1.55]) {
      add('metal', cajaUV(THREE, 2 * XT, 0.06, 0.04, { s: 0.6 }), { y: techoY(z) - 0.035, z, rx: -pend }, tinte(galv, 0.04));
      add('metal', cajaUV(THREE, 2 * XT, 0.012, 0.045, { s: 0.6 }), { y: techoY(z) - 0.066, z: z - 0.002, rx: -pend }, 0xb4b8bc);
    }
    // pie de amigo en las esquinas delanteras
    for (const sx of [-1, 1]) {
      tubo('metal', [sx * (XT - 0.04), techoY(ZF) - 0.45, ZF - 0.04], [sx * (XT - 0.42), techoY(ZF) - 0.08, ZF - 0.04], 0.018, galv, 6);
      tubo('metal', [sx * (XT - 0.04), techoY(ZB) - 0.45, ZB + 0.058], [sx * (XT - 0.42), techoY(ZB) - 0.08, ZB + 0.058], 0.018, galv, 6);
    }
    // planchas de policarbonato ondulado
    {
      const ancho = 2 * XT + 0.24, largo = largoL + 0.22;
      const geo = new THREE.PlaneGeometry(ancho, largo, 160, 1);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, 0.009 * Math.sin((p.getX(i) / 0.076) * Math.PI * 2));
      geo.computeVertexNormals();
      add('techo', geo, { y: (YB + YF) / 2 + 0.012, z: (ZB + ZF) / 2, rx: -pend });
      // franjas traslúcidas sobre los muros
      const banda = new THREE.PlaneGeometry(2 * XT, YB - 2.0);
      add('techo', banda, { y: (YB + 2.0) / 2 - 0.02, z: ZB + 0.012 });
      const lat = new THREE.PlaneGeometry(-0.2 - ZB, 1, 1, 1);
      const pl = lat.attributes.position;
      for (let i = 0; i < pl.count; i++) { const z = pl.getX(i) + (ZB - 0.2) / 2; pl.setY(i, pl.getY(i) > 0 ? techoY(z) - 0.05 : 2.0); }
      lat.computeVertexNormals();
      add('techo', lat, { x: -XT + 0.012, ry: -Math.PI / 2, z: (ZB - 0.2) / 2 });
    }

    // ---------------------------------------------------------------- muros de OSB con zócalo
    add('osb', cajaUV(THREE, 2 * XT, 2.0, 0.018, { s: 1.22 }), { y: 1.0, z: ZB + 0.009 });
    add('osb', cajaUV(THREE, 0.018, 2.0, -0.2 - ZB, { s: 1.22 }), { x: -XT + 0.009, y: 1.0, z: (ZB - 0.2) / 2 });
    add('madera', cajaUV(THREE, 2 * XT - 0.04, 0.09, 0.016, { s: 0.9 }), { y: 0.045 + PISO, z: ZB + 0.026 }, 0x8f7558);
    add('madera', cajaUV(THREE, 0.016, 0.09, -0.2 - ZB - 0.04, { s: 0.9 }), { x: -XT + 0.026, y: 0.045 + PISO, z: (ZB - 0.2) / 2 + 0.02 }, 0x8f7558);

    // ---------------------------------------------------------------- panel perforado con herramientas
    const ZP = ZB + 0.018 + 0.031; // cara del panel perforado
    const PX0 = -1.55, PX1 = 0.35, PY0 = 0.97, PY1 = 1.97;
    add('perforado', cajaUV(THREE, PX1 - PX0, PY1 - PY0, 0.006, { s: 0.2 }), { x: (PX0 + PX1) / 2, y: (PY0 + PY1) / 2, z: ZP - 0.003 });
    for (const [w, h, x, y] of [[PX1 - PX0 + 0.06, 0.03, (PX0 + PX1) / 2, PY0 - 0.015], [PX1 - PX0 + 0.06, 0.03, (PX0 + PX1) / 2, PY1 + 0.015], [0.03, PY1 - PY0, PX0 - 0.015, (PY0 + PY1) / 2], [0.03, PY1 - PY0, PX1 + 0.015, (PY0 + PY1) / 2]]) {
      add('madera', cajaUV(THREE, w, h, 0.035, { s: 0.9 }), { x, y, z: ZB + 0.018 + 0.0175 }, 0xd8c09a);
    }
    const gancho = (x, y, largo = 0.05) => {
      tubo('metal', [x, y, ZP - 0.004], [x, y + 0.004, ZP + largo], 0.0022, 0x9aa0a6, 5);
      tubo('metal', [x, y + 0.004, ZP + largo], [x, y + 0.018, ZP + largo + 0.006], 0.0022, 0x9aa0a6, 5);
    };
    // martillo de carpintero colgado de dos ganchos
    {
      const x = -1.36, y = 1.79, z = ZP + 0.03;
      gancho(x - 0.035, y - 0.03); gancho(x + 0.035, y - 0.03);
      add('metal', BOX(0.05, 0.03, 0.026), { x, y, z }, 0x6c7176);
      add('metal', CIL(0.0135, 0.0135, 0.05, 12), { x: x + 0.045, y, z, rz: Math.PI / 2 }, 0x8a8f94);
      add('metal', BOX(0.075, 0.012, 0.022), { x: x - 0.06, y: y + 0.006, z, rz: -0.35 }, 0x5d6166);
      add('pintado', cajaUV(THREE, 0.028, 0.29, 0.02, { s: 0.3 }), { x, y: y - 0.16, z }, 0xe1b420);
      add('pintado', cajaUV(THREE, 0.031, 0.11, 0.023, { s: 0.3 }), { x, y: y - 0.25, z }, 0x1d1e20);
    }
    // serrucho
    {
      const x = -1.02, y = 1.84, z = ZP + 0.02;
      gancho(x, y + 0.01, 0.04);
      const forma = new THREE.Shape([V3(-0.06, 0), V3(0.06, 0), V3(0.035, -0.46), V3(-0.005, -0.46)].map((v) => new THREE.Vector2(v.x, v.y)));
      const hoja = new THREE.ExtrudeGeometry(forma, { depth: 0.0012, bevelEnabled: false });
      add('metal', hoja, { x, y: y - 0.1, z }, 0xb9bec3);
      add('metal', BOX(0.002, 0.46, 0.0016), { x: x + 0.047 - 0.02, y: y - 0.33, z: z + 0.0006, rz: -0.087 }, 0x3b3e42);
      const mango = new THREE.Shape([[-0.075, 0], [0.075, 0], [0.07, 0.11], [-0.03, 0.12], [-0.075, 0.06]].map(([a, b]) => new THREE.Vector2(a, b)));
      mango.holes.push(new THREE.Path([[-0.035, 0.03], [0.04, 0.03], [0.04, 0.08], [-0.02, 0.085]].map(([a, b]) => new THREE.Vector2(a, b))));
      add('madera', new THREE.ExtrudeGeometry(mango, { depth: 0.024, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 }), { x, y: y - 0.115, z: z - 0.012 }, 0xa0582e);
      for (const dx of [-0.04, 0.0, 0.04]) add('metal', CIL(0.0045, 0.0045, 0.03, 8), { x: x + dx, y: y - 0.1 + 0.008, z: z + 0.001, rx: Math.PI / 2 }, 0xc9a54a);
    }
    // nivel de aluminio arriba
    {
      const x = -0.46, y = 1.925, z = ZP + 0.03;
      gancho(x - 0.22, y - 0.03); gancho(x + 0.22, y - 0.03);
      add('metal', cajaUV(THREE, 0.6, 0.05, 0.025, { s: 0.6 }), { x, y, z }, 0xd4d7da);
      for (const dx of [-0.3, 0.3]) add('pintado', BOX(0.012, 0.054, 0.029), { x: x + dx * 0.99, y, z }, 0xc3352a);
      for (const dx of [-0.12, 0.0]) add('pintado', BOX(0.03, 0.016, 0.027), { x: x + dx, y, z: z + 0.0005 }, 0x9fd34a);
    }
    // destornilladores en su soporte
    {
      const y = 1.78, z = ZP + 0.04;
      add('madera', cajaUV(THREE, 0.27, 0.025, 0.07, { s: 0.9 }), { x: -0.58, y, z }, 0xd2b48c);
      [[0xd7322a, 0.13], [0xe2b02a, 0.16], [0x2b62c4, 0.12], [0x1f1f22, 0.1]].forEach(([col, lv], i) => {
        const x = -0.68 + i * 0.065;
        add('pintado', CIL(0.012, 0.014, 0.085, 10), { x, y: y + 0.055, z: z + 0.012 }, col);
        add('metal', CIL(0.0032, 0.0032, lv, 6), { x, y: y - lv / 2 + 0.01, z: z + 0.012 }, 0xb7bcc1);
      });
    }
    // alicate y tijeras
    {
      const x = -0.3, y = 1.75, z = ZP + 0.025;
      gancho(x, y + 0.02);
      add('metal', BOX(0.024, 0.06, 0.012), { x, y, z }, 0x50555a);
      for (const sx of [-1, 1]) add('pintado', CIL(0.008, 0.011, 0.15, 8), { x: x + sx * 0.022, y: y - 0.1, z, rz: sx * 0.16 }, 0xc22d26);
      const x2 = -0.13;
      gancho(x2, y + 0.02);
      for (const sx of [-1, 1]) add('metal', BOX(0.012, 0.11, 0.0025), { x: x2 + sx * 0.004, y: y + 0.03, z: z + sx * 0.002, rz: sx * 0.05 }, 0xc4c9ce);
      for (const sx of [-1, 1]) add('pintado', new THREE.TorusGeometry(0.019, 0.005, 6, 14), { x: x2 + sx * 0.024, y: y - 0.045, z }, 0x1e2e3e);
    }
    // huincha de medir y portapapeles con el croquis del cartón
    {
      const x = 0.22, y = 1.72, z = ZP + 0.03;
      gancho(x, y + 0.045);
      add('pintado', CIL(0.036, 0.036, 0.036, 16), { x, y, z, rx: Math.PI / 2 }, 0xf0c419);
      add('metal', CIL(0.016, 0.016, 0.038, 12), { x, y, z, rx: Math.PI / 2 }, 0xc8ccd0);
      add('pintado', BOX(0.03, 0.012, 0.03), { x: x + 0.03, y: y - 0.03, z }, 0x1b1b1d);
      const cx = -0.015, cy = 1.37, cz = ZP + 0.012;
      gancho(cx, cy + 0.17, 0.02);
      add('pintado', BOX(0.23, 0.32, 0.004), { x: cx, y: cy, z: cz, rz: 0.03 }, 0x7a5532);
      add('metal', BOX(0.09, 0.03, 0.012), { x: cx + 0.004, y: cy + 0.15, z: cz + 0.006, rz: 0.03 }, 0xb8bcc0);
      const papel = new THREE.PlaneGeometry(0.2, 0.26);
      const uv = papel.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(AT.croquis[0], AT.croquis[2], uv.getX(i)), lerp(AT.croquis[1], AT.croquis[3], uv.getY(i)));
      add('carton', papel, { x: cx + 0.002, y: cy - 0.012, z: cz + 0.0026, rz: 0.03 });
    }
    // rollos de cinta en un tarugo, cuchillo de repuesto y repisa con frascos
    {
      const x = -1.35, y = 1.15;
      tubo('madera', [x, y + 0.04, ZP - 0.004], [x, y + 0.045, ZP + 0.2], 0.012, 0xc8a97e, 10);
      [[0xb8823a, 0.05], [0x9a9da0, 0.048], [0x3d6fbf, 0.024]].reduce((zz, [col, w]) => {
        add('pintado', anillo(THREE, 0.037, rnd() * 0.012 + 0.052, w), { x, y: y + 0.045 - 0.037 + 0.002, z: zz + w / 2, rx: Math.PI / 2 }, col);
        add('pintado', anillo(THREE, 0.034, 0.0372, w + 0.001), { x, y: y + 0.045 - 0.037 + 0.002, z: zz + w / 2, rx: Math.PI / 2 }, 0xb79a6c);
        return zz + w + 0.004;
      }, ZP + 0.01);
      const xc = -0.86;
      gancho(xc, 1.2);
      add('pintado', BOX(0.018, 0.13, 0.011), { x: xc, y: 1.12, z: ZP + 0.02 }, 0xe9b81e);
      add('pintado', BOX(0.019, 0.07, 0.012), { x: xc, y: 1.14, z: ZP + 0.0201 }, 0x1d1f22);
      add('madera', cajaUV(THREE, 0.42, 0.016, 0.12, { s: 0.9 }), { x: -0.36, y: 1.05, z: ZP + 0.06 }, 0xd8c09a);
      for (const sx of [-1, 1]) add('metal', BOX(0.01, 0.06, 0.1), { x: -0.36 + sx * 0.18, y: 1.02, z: ZP + 0.05 }, 0x8d9297);
      add('pintado', CIL(0.028, 0.028, 0.12, 12), { x: -0.5, y: 1.118, z: ZP + 0.06 }, 0xf1efe6);
      add('pintado', CIL(0.008, 0.014, 0.03, 10), { x: -0.5, y: 1.193, z: ZP + 0.06 }, 0xd94a2b);
      add('pintado', BOX(0.09, 0.06, 0.06), { x: -0.38, y: 1.088, z: ZP + 0.06 }, 0x2f5d8a);
      add('pintado', CIL(0.035, 0.035, 0.08, 14), { x: -0.24, y: 1.098, z: ZP + 0.065 }, 0xdbd3c2);
    }
    // cordel
    gancho(-0.62, 1.22, 0.06);
    add('pintado', CIL(0.035, 0.035, 0.07, 14), { x: -0.62, y: 1.18, z: ZP + 0.045, rx: Math.PI / 2 }, 0xd9c7a0);

    // ---------------------------------------------------------------- mesón de trabajo
    {
      const PXM = 1.0, PZ = 0.39;
      add('madera', cajaUV(THREE, 2.2, 0.05, 0.95, { s: 0.9, girar: true }), { y: MESA - 0.025, z: MZ }, 0xf2ece4);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add('madera', cajaUV(THREE, 0.085, MESA - 0.05 - PISO, 0.085, { s: 0.9 }), { x: sx * PXM, y: (MESA - 0.05 + PISO) / 2, z: MZ + sz * PZ }, tinte(0xd9c4a2));
      for (const sz of [-1, 1]) {
        add('madera', cajaUV(THREE, 2.09, 0.11, 0.025, { s: 0.9 }), { y: MESA - 0.105, z: MZ + sz * (PZ + 0.03) }, tinte(0xd9c4a2));
        add('madera', cajaUV(THREE, 2.0, 0.06, 0.04, { s: 0.9 }), { y: 0.11, z: MZ + sz * (PZ - 0.06) }, tinte(0xd9c4a2));
      }
      for (const sx of [-1, 1]) {
        add('madera', cajaUV(THREE, 0.025, 0.11, 0.87, { s: 0.9 }), { x: sx * (PXM + 0.03), y: MESA - 0.105, z: MZ }, tinte(0xd9c4a2));
        add('madera', cajaUV(THREE, 0.04, 0.06, 0.7, { s: 0.9 }), { x: sx * (PXM - 0.06), y: 0.11, z: MZ }, tinte(0xd9c4a2));
      }
      add('madera', cajaUV(THREE, 1.9, 0.022, 0.72, { s: 0.9, girar: true }), { y: 0.151, z: MZ }, 0xe6dccd);
      // pernos de las uniones
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const yy of [MESA - 0.08, MESA - 0.13]) {
        add('metal', CIL(0.009, 0.009, 0.006, 10), { x: sx * PXM, y: yy, z: MZ + sz * (PZ + 0.043), rx: Math.PI / 2 }, 0x5a5e62);
        add('metal', CIL(0.009, 0.009, 0.006, 10), { x: sx * (PXM + 0.043), y: yy, z: MZ + sz * PZ, rz: Math.PI / 2 }, 0x5a5e62);
      }
      // prensa de banco en el extremo izquierdo
      add('madera', cajaUV(THREE, 0.2, 0.11, 0.03, { s: 0.9 }), { x: -0.72, y: MESA - 0.07, z: 0.5 }, 0xd9c4a2);
      tubo('metal', [-0.77, MESA - 0.075, 0.45], [-0.77, MESA - 0.075, 0.58], 0.008, 0x8d949b);
      tubo('metal', [-0.67, MESA - 0.075, 0.45], [-0.67, MESA - 0.075, 0.58], 0.008, 0x8d949b);
      tubo('metal', [-0.72, MESA - 0.07, 0.45], [-0.72, MESA - 0.07, 0.6], 0.011, 0x8d949b);
      tubo('metal', [-0.8, MESA - 0.07, 0.6], [-0.64, MESA - 0.07, 0.6], 0.007, 0x8d949b);
      // tabla de corte (cuadriculada) bajo el cartón y su canto
      add('pintado', BOX(1.04, 0.0028, 0.8), { y: MESA + 0.0014, z: -0.06 }, 0x24503f);
      kit.malla(new THREE.PlaneGeometry(1.04, 0.8), tapeteMat, { rx: -Math.PI / 2, y: TOPE, z: -0.06, sombra: false, padre: g });
    }
    // regla de 24 pulgadas junto al borde delantero del cartón, escuadra de acero, lápiz, cinta, plumón y taza
    add('regla', geoRegla(THREE, RL, RA, 0.0012), { x: -MITAD - R0 + RL / 2, y: TOPE + 0.0006, z: CZ + MITAD + 0.072, ry: 0.004 });
    {
      const x = -1.0, z = 0.3, ry = 0.08;
      const brazo1 = geoRegla(THREE, 0.61, 0.05, 0.002, R0 / RL, (R0 + 0.61) / RL);
      ubicar(THREE, brazo1, { x: 0.305, z: -0.025 });
      const brazo2 = geoRegla(THREE, 0.41 - 0.05, 0.04, 0.002, (R0 + 0.05) / RL, (R0 + 0.41) / RL);
      ubicar(THREE, brazo2, { x: 0.05 + 0.18, z: 0.02, ry: -Math.PI / 2 });
      ubicar(THREE, brazo2, { x: -0.05 - 0.205 + 0.025, z: 0.205 + 0.025 });
      add('regla', brazo1, { x, y: MESA + 0.001, z, ry: Math.PI / 2 + ry });
      add('regla', brazo2, { x, y: MESA + 0.001, z, ry: Math.PI / 2 + ry });
    }
    {
      const x = -0.42, z = 0.16, an = -0.35, y = TOPE + 0.0037;
      const lapiz = (geo, o, col) => { ubicar(THREE, geo, o); add('pintado', geo, { x, y, z, ry: an }, col); };
      lapiz(CIL(0.0037, 0.0037, 0.15, 6), { rz: Math.PI / 2 }, 0xd94a2b);
      lapiz(new THREE.ConeGeometry(0.0037, 0.02, 6), { x: 0.085, rz: -Math.PI / 2 }, 0xdab68c);
      lapiz(new THREE.ConeGeometry(0.0013, 0.006, 6), { x: 0.0955, rz: -Math.PI / 2 }, 0x1d1f22);
      add('pintado', anillo(THREE, 0.038, 0.058, 0.048), { x: 0.8, y: MESA + 0.024, z: 0.2 }, 0xb8823a);
      add('pintado', anillo(THREE, 0.0345, 0.0382, 0.049), { x: 0.8, y: MESA + 0.0245, z: 0.2 }, 0xb79a6c);
      add('pintado', CIL(0.008, 0.008, 0.13, 10), { x: 0.68, y: MESA + 0.008, z: 0.31, rx: Math.PI / 2, ry: 0.6, orden: 'YXZ' }, 0x1b1c1e);
      add('pintado', CIL(0.0085, 0.0085, 0.035, 10), { x: 0.68 - 0.038, y: MESA + 0.0085, z: 0.31 - 0.028, rx: Math.PI / 2, ry: 0.6, orden: 'YXZ' }, 0xeeeeea);
      // taza enlozada con café
      const tx = -0.86, tz = -0.36;
      add('pintado', CIL(0.042, 0.042, 0.09, 18, true), { x: tx, y: MESA + 0.045, z: tz }, 0xf0efe9);
      add('pintado', invertir(CIL(0.04, 0.04, 0.088, 18, true)), { x: tx, y: MESA + 0.046, z: tz }, 0xe8e6de);
      add('pintado', new THREE.TorusGeometry(0.041, 0.003, 5, 22), { x: tx, y: MESA + 0.09, z: tz, rx: Math.PI / 2 }, 0x2a4d8f);
      add('pintado', new THREE.CircleGeometry(0.04, 18), { x: tx, y: MESA + 0.06, z: tz, rx: -Math.PI / 2 }, 0x3a2414);
      add('pintado', new THREE.TorusGeometry(0.024, 0.0055, 6, 12, Math.PI), { x: tx + 0.042, y: MESA + 0.047, z: tz, rz: -Math.PI / 2 }, 0xf0efe9);
      // caja de hojas de repuesto
      add('pintado', BOX(0.06, 0.014, 0.025), { x: -0.7, y: MESA + 0.007, z: -0.3, ry: 0.3 }, 0xe8b81c);
      add('pintado', BOX(0.061, 0.004, 0.0255), { x: -0.7, y: MESA + 0.012, z: -0.3, ry: 0.3 }, 0x1d1f22);
    }
    // recortes y tiras sobrantes a la derecha del mesón
    for (let i = 0; i < 4; i++) {
      const l = 0.12 + rnd() * 0.25, w = 0.012 + rnd() * 0.025;
      add('carton', geoCarton(THREE, l, ESP, w, { ou: w + rnd() * 0.3 }), { x: 0.84 + (rnd() - 0.5) * 0.12, y: MESA + ESP * (0.5 + i), z: 0.02 + rnd() * 0.06, ry: (rnd() - 0.5) * 0.8 });
    }
    // repisa inferior: pila de cartones nuevos, caja de herramientas y caja de recortes
    add('carton', geoCarton(THREE, LADO, 0.11, LADO, { pila: true }), { x: 0.34, y: 0.162 + 0.055, z: MZ - 0.02, ry: 0.02 });
    add('carton', geoCarton(THREE, LADO, ESP, LADO), { x: 0.36, y: 0.162 + 0.11 + ESP / 2, z: MZ - 0.01, ry: 0.07 });
    {
      const x = -0.56, y = 0.162, z = -0.08;
      add('pintado', cajaUV(THREE, 0.46, 0.17, 0.22, { s: 0.5 }), { x, y: y + 0.085, z }, 0xb8261f);
      add('pintado', cajaUV(THREE, 0.47, 0.045, 0.23, { s: 0.5 }), { x, y: y + 0.19, z }, 0xa8221c);
      add('pintado', BOX(0.2, 0.018, 0.03), { x, y: y + 0.222, z }, 0x1d1e20);
      for (const dx of [-0.17, 0.17]) add('metal', BOX(0.03, 0.04, 0.008), { x: x + dx, y: y + 0.17, z: z + 0.113 }, 0xb0b5ba);
      for (const p of cajaAbierta(THREE, 0.24, 0.16, rnd)) add('carton', p, { x: -0.13, y: 0.162, z: 0.02, ry: 0.15 });
      for (let i = 0; i < 4; i++) add('carton', geoCarton(THREE, 0.05 + rnd() * 0.08, 0.2, ESP), { x: -0.13 + (rnd() - 0.5) * 0.12, y: 0.162 + 0.13, z: 0.02 + (rnd() - 0.5) * 0.12, ry: rnd() * 3, rz: (rnd() - 0.5) * 0.5 });
    }

    // ---------------------------------------------------------------- lámpara colgante sobre el mesón
    const LX = 0.06, LZ = -0.15, LY = 2.02;
    {
      const perfil = [[0.165, 0], [0.12, 0.045], [0.06, 0.11], [0.035, 0.155], [0.016, 0.17]].map(([r, y]) => new THREE.Vector2(r, y));
      add('pintado', new THREE.LatheGeometry(perfil, 28), { x: LX, y: LY, z: LZ }, 0x2f5a45);
      add('pintado', new THREE.LatheGeometry(perfil.map((p) => new THREE.Vector2(p.x * 0.985, p.y - 0.002)).reverse(), 28), { x: LX, y: LY, z: LZ }, 0xf3f0e6);
      add('pintado', new THREE.TorusGeometry(0.165, 0.004, 5, 32), { x: LX, y: LY, z: LZ, rx: Math.PI / 2 }, 0x24473a);
      add('pintado', CIL(0.022, 0.022, 0.05, 12), { x: LX, y: LY + 0.165, z: LZ }, 0x1c1c1e);
      tubo('pintado', [LX, LY + 0.19, LZ], [LX, techoY(LZ) - 0.07, LZ], 0.0035, 0x1a1a1a, 5);
      const xc = -1.675, zc = ZB + 0.12;
      tubo('pintado', [LX, techoY(LZ) - 0.07, LZ], [xc, techoY(LZ) - 0.07, LZ], 0.0035, 0x1a1a1a, 5);
      tubo('pintado', [xc, techoY(LZ) - 0.07, LZ], [xc, techoY(zc) - 0.07, zc], 0.0035, 0x1a1a1a, 5);
      tubo('pintado', [xc, techoY(zc) - 0.07, zc], [xc, 1.25, zc], 0.0035, 0x1a1a1a, 5);
      add('pintado', BOX(0.06, 0.1, 0.045), { x: xc, y: 1.2, z: zc + 0.005 }, 0xe9e7e0);
    }
    const foco = kit.malla(new THREE.SphereGeometry(0.034, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1cf }), { x: LX, y: LY + 0.1, z: LZ, sombra: false, padre: g });
    foco.scale.set(1, 1.2, 1);

    // ---------------------------------------------------------------- estantería contra el muro izquierdo
    {
      const x0 = -XT + 0.04, x1 = -XT + 0.47, z0 = -1.95, z1 = -0.72, xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
      for (const x of [x0 + 0.02, x1 - 0.02]) for (const z of [z0, z1]) add('pintado', cajaUV(THREE, 0.035, 1.85, 0.035, { s: 0.5 }), { x, y: 0.925 + PISO, z }, 0xd0622a);
      for (const y of [0.12, 0.58, 1.04, 1.5]) {
        add('metal', BOX(x1 - x0, 0.018, z1 - z0 + 0.03), { x: xc, y: y + PISO, z: zc }, 0xb9bdc1);
        add('pintado', BOX(0.012, 0.04, z1 - z0 + 0.03), { x: x1 - 0.006, y: y + PISO - 0.01, z: zc }, 0xc85a24);
      }
      add('carton', geoCarton(THREE, 0.4, 0.13, 0.56, { pila: true }), { x: xc, y: 0.129 + PISO + 0.065, z: z0 + 0.32, ry: 0.03 });
      add('carton', geoCarton(THREE, 0.38, 0.07, 0.48, { pila: true }), { x: xc + 0.005, y: 0.129 + PISO + 0.035, z: z1 - 0.28, ry: -0.04 });
      for (const p of cajaAbierta(THREE, 0.32, 0.15, rnd)) add('carton', p, { x: xc, y: 0.589 + PISO, z: z0 + 0.22, ry: 0.1 });
      for (const p of cajaAbierta(THREE, 0.36, 0.1, rnd)) add('carton', p, { x: xc, y: 0.589 + PISO, z: z1 - 0.24, ry: -0.05 });
      for (let i = 0; i < 3; i++) {
        add('pintado', anillo(THREE, 0.038, 0.06, 0.048), { x: xc - 0.05 + i * 0.03, y: 1.049 + PISO + 0.024 + i * 0.05, z: z0 + 0.2 + i * 0.02 }, [0xb8823a, 0x9a9da0, 0xb8823a][i]);
      }
      add('carton', geoCarton(THREE, 0.34, 0.22, 0.4), { x: xc, y: 1.049 + PISO + 0.11, z: z1 - 0.3, ry: 0.06 });
      add('pintado', BOX(0.345, 0.0012, 0.05), { x: xc, y: 1.049 + PISO + 0.2206, z: z1 - 0.3, ry: 0.06 }, 0xc58f3e);
      add('carton', geoCarton(THREE, 0.3, 0.16, 0.3), { x: xc, y: 1.509 + PISO + 0.08, z: zc, ry: -0.08 });
      add('carton', geoCarton(THREE, 0.38, 0.04, 0.5, { pila: true }), { x: xc, y: 1.509 + PISO + 0.02, z: z0 + 0.3, ry: 0.05 });
    }
    // extintor en el muro izquierdo
    {
      const x = -XT + 0.1, z = -0.42;
      add('metal', BOX(0.02, 0.1, 0.06), { x: -XT + 0.025, y: 0.92, z }, 0x3a3c3f);
      add('pintado', CIL(0.075, 0.075, 0.42, 18), { x, y: 0.67, z }, 0xc71f1a);
      add('pintado', new THREE.SphereGeometry(0.075, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), { x, y: 0.88, z }, 0xc71f1a);
      add('pintado', CIL(0.02, 0.02, 0.05, 10), { x, y: 0.97, z }, 0x1d1d1f);
      add('pintado', BOX(0.09, 0.01, 0.022), { x: x + 0.03, y: 1.0, z }, 0x1d1d1f);
      tubo('pintado', [x + 0.02, 0.98, z + 0.02], [x + 0.06, 0.62, z + 0.07], 0.007, 0x1d1d1f, 6);
      add('pintado', BOX(0.0015, 0.1, 0.07), { x: x + 0.076, y: 0.7, z }, 0xf2efe6);
    }
    // escoba apoyada en el muro del fondo
    {
      tubo('madera', [-2.22, 0.1, ZB + 0.16], [-2.12, 1.38, ZB + 0.04], 0.012, 0xc89b62, 8);
      add('pintado', BOX(0.3, 0.035, 0.05), { x: -2.22, y: 0.09, z: ZB + 0.17, rx: 0.1 }, 0x2a5c9a);
      add('pintado', BOX(0.29, 0.07, 0.04), { x: -2.22, y: 0.045, z: ZB + 0.175, rx: 0.1 }, 0x2b2622);
    }
    // basurero con recortes a la izquierda del mesón
    {
      const x = -1.38, z = 0.18;
      add('pintado', CIL(0.17, 0.2, 0.56, 22, true), { x, y: 0.28 + PISO, z }, 0x2f6fa8);
      add('pintado', invertir(CIL(0.165, 0.195, 0.55, 22, true)), { x, y: 0.285 + PISO, z }, 0x245a8a);
      add('pintado', new THREE.TorusGeometry(0.2, 0.01, 6, 26), { x, y: 0.56 + PISO, z, rx: Math.PI / 2 }, 0x2a66a0);
      add('pintado', new THREE.CircleGeometry(0.17, 20), { x, y: 0.02, z, rx: -Math.PI / 2 }, 0x1f4b74);
      for (let i = 0; i < 7; i++) {
        const w = 0.05 + rnd() * 0.15, h = 0.12 + rnd() * 0.2;
        add('carton', geoCarton(THREE, w, h, ESP, { ou: w / 2 + rnd() * 0.4 }), { x: x + (rnd() - 0.5) * 0.18, y: 0.5 + h * 0.2, z: z + (rnd() - 0.5) * 0.18, ry: rnd() * 3, rx: (rnd() - 0.5) * 0.6, rz: (rnd() - 0.5) * 0.6 });
      }
    }
    // balde con arena y llana (de aquí sale la arena para llenar la caja)
    {
      const x = 1.32, z = 0.15;
      add('pintado', CIL(0.125, 0.15, 0.3, 24, true), { x, y: 0.15 + PISO, z }, 0x2a2c2e);
      add('pintado', invertir(CIL(0.12, 0.145, 0.295, 24, true)), { x, y: 0.152 + PISO, z }, 0x222426);
      add('pintado', new THREE.TorusGeometry(0.15, 0.008, 6, 28), { x, y: 0.3 + PISO, z, rx: Math.PI / 2 }, 0x2e3032);
      for (const sx of [-1, 1]) add('metal', CIL(0.008, 0.008, 0.012, 8), { x: x + sx * 0.148, y: 0.27 + PISO, z, rz: Math.PI / 2 }, 0x6d7176);
      tubo('metal', [x - 0.148, 0.27 + PISO, z], [x - 0.11, 0.33 + PISO, z - 0.12], 0.0035, 0x8d9297, 5);
      tubo('metal', [x - 0.11, 0.33 + PISO, z - 0.12], [x + 0.11, 0.33 + PISO, z - 0.12], 0.0035, 0x8d9297, 5);
      tubo('metal', [x + 0.11, 0.33 + PISO, z - 0.12], [x + 0.148, 0.27 + PISO, z], 0.0035, 0x8d9297, 5);
      const pala = new THREE.CylinderGeometry(0.08, 0.08, 0.13, 10, 1, true, -0.9, 1.8);
      ubicar(THREE, pala, { rx: Math.PI / 2, y: -0.02 });
      const palaDentro = invertir(pala.clone());
      add('metal', pala, { x: x + 0.02, y: 0.29 + PISO, z: z + 0.03, rx: 0.5, ry: 0.4 }, 0x9aa1a7);
      add('metal', palaDentro, { x: x + 0.02, y: 0.29 + PISO, z: z + 0.03, rx: 0.5, ry: 0.4 }, 0x9aa1a7);
      const mango = CIL(0.014, 0.014, 0.12, 10);
      ubicar(THREE, mango, { y: 0.03, z: -0.12, rx: Math.PI / 2 });
      add('madera', mango, { x: x + 0.02, y: 0.29 + PISO, z: z + 0.03, rx: 0.5, ry: 0.4 }, 0x9a6a3e);
    }
    const colmo = kit.malla(new THREE.SphereGeometry(0.145, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2), kit.mat('sand', { repeat: [0.6, 0.6], color: 0xffd9a2 }), { x: 1.32, y: 0.25 + PISO, z: 0.15, padre: g });
    colmo.scale.y = 0.3;

    // ---------------------------------------------------------------- pallet con cartones nuevos y sector de acopio
    {
      const x = 1.93, z = 0.06, ry = 0.04, gris = 0xb5a993;
      const pal = [];
      for (let i = 0; i < 5; i++) pal.push([cajaUV(THREE, 0.8, 0.022, 0.1, { s: 0.9 }), { x: 0, y: 0.133, z: -0.45 + i * 0.225 }]);
      for (const zz of [-0.45, 0, 0.45]) {
        pal.push([cajaUV(THREE, 0.8, 0.022, 0.1, { s: 0.9 }), { x: 0, y: 0.011, z: zz }]);
        for (const xx of [-0.35, 0, 0.35]) pal.push([cajaUV(THREE, 0.1, 0.078, 0.1, { s: 0.9 }), { x: xx, y: 0.061, z: zz }]);
      }
      for (const xx of [-0.35, 0, 0.35]) pal.push([cajaUV(THREE, 0.1, 0.022, 1.0, { s: 0.9 }), { x: xx, y: 0.111, z: 0 }]);
      for (const [geo, o] of pal) { ubicar(THREE, geo, o); add('madera', geo, { x, y: PISO, z, ry }, tinte(gris, 0.1)); }
      const yP = PISO + 0.144;
      add('carton', geoCarton(THREE, LADO, 0.3, LADO, { pila: true }), { x, y: yP + 0.15, z, ry: ry + 0.01 });
      for (let i = 0; i < 3; i++) add('carton', geoCarton(THREE, LADO, ESP, LADO, { ou: MITAD }), { x: x + (rnd() - 0.5) * 0.04, y: yP + 0.3 + ESP * (i + 0.5), z: z + (rnd() - 0.5) * 0.04, ry: ry + (rnd() - 0.5) * 0.12 });
      // zunchos que amarran la pila al pallet
      for (const dz of [-0.17, 0.17]) {
        const hz = yP + 0.3 + 3 * ESP + 0.0008;
        const piezas = [[BOX(LADO + 0.004, 0.0012, 0.013), { y: hz }], [BOX(0.0012, hz - PISO - 0.1, 0.013), { x: MITAD + 0.0016, y: (hz + PISO + 0.1) / 2 }], [BOX(0.0012, hz - PISO - 0.1, 0.013), { x: -MITAD - 0.0016, y: (hz + PISO + 0.1) / 2 }]];
        for (const [geo, o] of piezas) { ubicar(THREE, geo, { ...o, z: dz }); add('pintado', geo, { x, z, ry: ry + 0.01 }, 0x2c5fa0); }
      }
    }

    // ---------------------------------------------------------------- cajas terminadas apiladas al fondo a la derecha
    {
      const pilaCajas = (x, z, b, h, n, ry0) => {
        for (let i = 0; i < n; i++) {
          const ry = ry0 + (rnd() - 0.5) * 0.12;
          for (const p of cajaAbierta(THREE, b, h, rnd)) add('carton', p, { x: x + (rnd() - 0.5) * 0.02, y: PISO + i * (h + ESP * 1.5), z: z + (rnd() - 0.5) * 0.02, ry });
          for (const geo of cintaCaja(b, h)) add('pintado', geo, { x, y: PISO + i * (h + ESP * 1.5), z, ry }, 0xc58f3e);
        }
      };
      pilaCajas(1.72, -1.72, 16 * PULG, 4 * PULG, 3, 0.05);
      pilaCajas(2.14, -1.32, 12 * PULG, 6 * PULG, 2, -0.2);
      pilaCajas(2.1, -1.9, 20 * PULG, 2 * PULG, 4, 0.12);
    }

    // ---------------------------------------------------------------- mesa de embalaje de la compañera
    {
      const x = AYUDA[0] - 0.04, z = CAJITA.z + 0.06, w = 0.8, d = 0.45, h = 0.8;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add('metal', cajaUV(THREE, 0.035, h - PISO, 0.035, { s: 0.6 }), { x: x + sx * (w / 2 - 0.03), y: (h + PISO) / 2, z: z + sz * (d / 2 - 0.03) }, 0x3f4a55);
      for (const sz of [-1, 1]) add('metal', BOX(w - 0.04, 0.04, 0.02), { x, y: h - 0.04, z: z + sz * (d / 2 - 0.03) }, 0x3f4a55);
      for (const sx of [-1, 1]) add('metal', BOX(0.02, 0.04, d - 0.04), { x: x + sx * (w / 2 - 0.03), y: h - 0.04, z }, 0x3f4a55);
      add('madera', cajaUV(THREE, w, 0.025, d, { s: 0.9, girar: true }), { x, y: h + 0.0125, z }, 0xe8dccb);
      add('madera', cajaUV(THREE, w - 0.06, 0.018, d - 0.06, { s: 0.9 }), { x, y: 0.16, z }, 0xd6c4a6);
      for (const p of cajaAbierta(THREE, CAJITA.b, CAJITA.h, rnd)) add('carton', p, { x: CAJITA.x, y: CAJITA.y, z: CAJITA.z });
      // cinta ya puesta en las esquinas de la caja
      for (const geo of cintaCaja(CAJITA.b, CAJITA.h)) add('pintado', geo, { x: CAJITA.x, y: CAJITA.y, z: CAJITA.z }, 0xc58f3e);
      add('pintado', anillo(THREE, 0.038, 0.06, 0.048), { x: x - 0.3, y: h + 0.025 + 0.024, z: z + 0.12 }, 0xb8823a);
      add('pintado', anillo(THREE, 0.0345, 0.0382, 0.049), { x: x - 0.3, y: h + 0.025 + 0.0245, z: z + 0.12 }, 0xb79a6c);
      add('carton', geoCarton(THREE, 0.42, 0.03, 0.34, { pila: true }), { x: x + 0.05, y: 0.169 + 0.015, z, ry: 0.05 });
      add('pintado', CIL(0.008, 0.008, 0.13, 10), { x: x + 0.3, y: h + 0.033, z: z + 0.15, rx: Math.PI / 2, ry: -0.5, orden: 'YXZ' }, 0x1b1c1e);
      // repisa con cinta de repuesto sobre la cabeza de la compañera
      add('madera', cajaUV(THREE, 0.62, 0.02, 0.2, { s: 0.9 }), { x: AYUDA[0], y: 1.86, z: ZB + 0.12 }, 0xd8c09a);
      for (const dx of [-0.25, 0.25]) add('metal', BOX(0.012, 0.12, 0.16), { x: AYUDA[0] + dx, y: 1.8, z: ZB + 0.1 }, 0x8d9297);
      for (let i = 0; i < 4; i++) add('pintado', anillo(THREE, 0.038, 0.06, 0.048), { x: AYUDA[0] - 0.2 + i * 0.13, y: 1.87 + 0.024, z: ZB + 0.12 }, i === 2 ? 0x9a9da0 : 0xb8823a);
    }

    // ---------------------------------------------------------------- recortes en el suelo
    for (let i = 0; i < 12; i++) {
      const w = 0.02 + rnd() * 0.12, d = rnd() < 0.5 ? w : 0.01 + rnd() * 0.03;
      const x = (rnd() - 0.5) * 2.4, z = -0.9 + rnd() * 1.6;
      if (Math.abs(x - OBRERO[0]) < 0.4 && z < -0.5) continue;
      add('carton', geoCarton(THREE, w, ESP, d, { ou: w / 2 + rnd() * 0.4 }), { x, y: PISO + ESP / 2 + 0.0005, z, ry: rnd() * 3 });
    }

    // ---------------------------------------------------------------- mallas unidas por material
    const lote = (nombre, mat, { sombra = true, recibe = true } = {}) => {
      if (!L[nombre].length) return null;
      const m = kit.malla(unir(kit, L[nombre]), mat, { sombra, recibe, padre: g });
      L[nombre] = [];
      return m;
    };
    lote('madera', madera);
    lote('metal', metal);
    lote('pintado', pintado);
    lote('osb', osb, { sombra: false });
    lote('perforado', perforado, { sombra: false });
    lote('techo', techo, { sombra: false, recibe: false });
    lote('carton', lamina);
    lote('regla', reglaMat, { sombra: false });

    // maleza en los bordes exteriores de la losa: matas de hojas delgadas
    {
      const hojas = [];
      for (let i = 0; i < 7; i++) {
        const h = 0.14 + rnd() * 0.16, c = new THREE.ConeGeometry(0.009, h, 3, 1, true);
        c.translate(0, h / 2, 0); c.rotateZ(0.25 + rnd() * 0.35); c.rotateY((i / 7) * Math.PI * 2 + rnd() * 0.5);
        hojas.push(c);
      }
      const n = 40, mata = new THREE.InstancedMesh(kit.mergeGeometries(hojas), new THREE.MeshStandardMaterial({ color: 0x75873f, roughness: 0.95, side: THREE.DoubleSide }), n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < n; i++) {
        const lado = Math.floor(rnd() * 3), t = rnd();
        const x = lado === 0 ? XT + 0.08 + rnd() * 0.18 : lado === 1 ? -XT + t * 2 * XT : -XT - 0.08 - rnd() * 0.15;
        const z = lado === 0 ? ZB + t * (ZF - ZB) : lado === 1 ? ZF + 0.08 + rnd() * 0.15 : -0.2 + t * (ZF + 0.2);
        const sc = 0.5 + rnd() * 0.8;
        e.set((rnd() - 0.5) * 0.25, rnd() * 6, (rnd() - 0.5) * 0.25); q.setFromEuler(e);
        m4.compose(V3(x, 0, z), q, V3(sc, sc, sc)); mata.setMatrixAt(i, m4);
      }
      mata.castShadow = true; g.add(mata);
    }

    // ---------------------------------------------------------------- el cartón que se pliega
    const hoja = new THREE.Group(); hoja.position.z = CZ; g.add(hoja);
    const base = kit.malla(new THREE.BufferGeometry(), lamina, { y: TOPE + ESP / 2, padre: hoja });
    const lineaMat = new THREE.MeshBasicMaterial({ color: 0x3b3631, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    {
      const [c, gg] = lienzo(64, 8); gg.clearRect(0, 0, 64, 8); gg.fillStyle = '#ffffff'; gg.fillRect(0, 1, 38, 6);
      lineaMat.map = texturaDe(THREE, c);
    }
    const solapas = [0, 1, 2, 3].map((k) => {
      const giro = new THREE.Group(); giro.rotation.y = (k * Math.PI) / 2; hoja.add(giro);
      const bisagra = new THREE.Group(); giro.add(bisagra);
      const m = kit.malla(new THREE.BufferGeometry(), lamina, { padre: bisagra });
      return { giro, bisagra, m };
    });
    // líneas de doblez a lápiz y cinta de las esquinas (una instancia por lado)
    const lineas = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.0022), lineaMat, 4);
    lineas.castShadow = false; hoja.add(lineas);
    const cintaGeo = (() => {
      const a = new THREE.PlaneGeometry(0.026 + ESP, 1); a.translate(-0.013 + ESP / 2, 0.5, ESP + 0.0007);
      const b = new THREE.PlaneGeometry(0.026 + ESP, 1); b.rotateY(Math.PI / 2); b.translate(ESP + 0.0007, 0.5, -0.013 + ESP / 2);
      return kit.mergeGeometries([a, b]);
    })();
    const cintas = new THREE.InstancedMesh(cintaGeo, cintaMat, 4);
    cintas.castShadow = false; hoja.add(cintas);
    const arena = kit.malla(new THREE.BufferGeometry(), arenaMat, { padre: hoja });
    arena.visible = false;

    // los cuatro cuadrados recortados, apartados sobre el mesón
    const recortes = new THREE.InstancedMesh(new THREE.BufferGeometry(), lamina, 4);
    recortes.castShadow = true; recortes.receiveShadow = true; g.add(recortes);

    // ---------------------------------------------------------------- cotas y rótulos
    const cotaMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    const cotaGeo = new THREE.CylinderGeometry(0.0016, 0.0016, 1, 6); cotaGeo.translate(0, 0.5, 0);
    const cotas = new THREE.InstancedMesh(cotaGeo, cotaMat, 6);
    cotas.castShadow = false; cotas.frustumCulled = false; g.add(cotas);
    const _a = V3(), _b = V3(), _d = V3(), _q = new THREE.Quaternion(), _s = V3(), _m = new THREE.Matrix4(), ARRIBA = V3(0, 1, 0);
    function barra(i, A, B) {
      _a.set(...A); _b.set(...B); _d.subVectors(_b, _a);
      const len = Math.max(1e-4, _d.length());
      _q.setFromUnitVectors(ARRIBA, _d.normalize()); _s.set(1, len, 1);
      cotas.setMatrixAt(i, _m.compose(_a, _q, _s));
    }
    function ponerCota(i0, A, B, d, o1, o2) {
      barra(i0, A, B);
      barra(i0 + 1, A.map((v, i) => v + d[i] * o1), A.map((v, i) => v + d[i] * o2));
      barra(i0 + 2, B.map((v, i) => v + d[i] * o1), B.map((v, i) => v + d[i] * o2));
      cotas.instanceMatrix.needsUpdate = true;
    }
    const rotulo = (t, bg = '#ffb347', color = '#1a1206') => { const l = kit.etiqueta(t, 0.034, { bg, color }); g.add(l); return l; };
    const lB = rotulo('base', '#5cc8ff', '#08202c'), lX = rotulo('x'), lV = rotulo('V', '#6fe3a2', '#0b1f14');
    lV.visible = false;

    // asa para arrastrar la esquina y cambiar x
    const asa = kit.malla(new THREE.SphereGeometry(0.014, 18, 12), new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff6a00, emissiveIntensity: 0.8 }), { padre: g });
    kit.arrastre(asa, g, {
      normal: [0, 0, 1], punto: [0, TOPE, CZ + MITAD], cursor: 'ew-resize', habilitado: est.habilitado,
      alMover: (p) => fijarX(M.L / 2 - p.x / PULG),
    });

    function fijarX(x) {
      const v = Math.min(11.75, Math.max(0.25, Math.round(x * 4) / 4));
      if (v !== s.x) { s.x = v; s.cambio = true; }
    }
    const plegar = (v) => { s.plegado = v; if (!v) s.lleno = false; panel?.invalidate(); };
    const llenar = (v) => { s.lleno = v; if (v) s.plegado = true; panel?.invalidate(); };

    let geos = [];
    const nueva = (geo) => { geos.push(geo); return geo; };
    function construir() {
      const viejas = geos; geos = [];
      const xm = s.x * PULG, b = M.base(s.x) * PULG;
      base.geometry = nueva(geoCarton(THREE, b, ESP, b));
      const gSolapa = nueva(geoCarton(THREE, b, ESP, xm, { ov: MITAD + b / 2 + xm / 2 }));
      for (const f of solapas) {
        f.bisagra.position.set(0, TOPE + ESP, b / 2);
        f.m.geometry = gSolapa; f.m.position.set(0, -ESP / 2, xm / 2);
      }
      const e = new THREE.Euler(), m4 = new THREE.Matrix4(), lv = Math.max(0.001, b - 0.006);
      for (let k = 0; k < 4; k++) {
        const an = (k * Math.PI) / 2;
        e.set(-Math.PI / 2, an, 0, 'YXZ'); _q.setFromEuler(e);
        _a.set(Math.sin(an) * (b / 2 - 0.0028), TOPE + ESP + 0.0003, Math.cos(an) * (b / 2 - 0.0028));
        lineas.setMatrixAt(k, m4.compose(_a, _q, _s.set(lv, 1, 1)));
        _q.setFromAxisAngle(ARRIBA, an);
        _a.set(b / 2, TOPE + ESP, b / 2).applyAxisAngle(ARRIBA, an);
        cintas.setMatrixAt(k, m4.compose(_a, _q, _s.set(1, xm, 1)));
      }
      lineas.instanceMatrix.needsUpdate = true; cintas.instanceMatrix.needsUpdate = true;
      lineas.computeBoundingSphere(); cintas.computeBoundingSphere();
      lineaMat.map.repeat.set(Math.max(1, lv / 0.012), 1);
      arena.geometry = nueva(cajaUV(THREE, Math.max(0.0005, b - 0.0012), 1, Math.max(0.0005, b - 0.0012), { s: 0.16 }));
      recortes.geometry = nueva(geoCarton(THREE, xm, ESP, xm, { ou: MITAD + b / 2 + xm / 2, ov: MITAD + b / 2 + xm / 2 }));
      const cx = 0.6 + xm / 2, cz = -0.22;
      for (let i = 0; i < 4; i++) {
        e.set(0, -0.22 + i * 0.15, 0); _q.setFromEuler(e);
        _a.set(cx + i * 0.014, MESA + ESP * (i + 0.5), cz + i * 0.022 - 0.02);
        recortes.setMatrixAt(i, m4.compose(_a, _q, _s.set(1, 1, 1)));
      }
      recortes.instanceMatrix.needsUpdate = true; recortes.computeBoundingSphere();
      kit.cambiarEtiqueta(lB, `24 − 2x = ${kit.num(M.base(s.x), 1)} pulg`);
      kit.cambiarEtiqueta(lV, `V = ${fmtV(M.volumen(s.x))} pulg³`);
      for (const v of viejas) v.dispose();
    }

    function posar() {
      const th = (Math.PI / 2) * suave(s.prog), xm = s.x * PULG, b = M.base(s.x) * PULG;
      const c = Math.cos(th), sn = Math.sin(th);
      for (const f of solapas) f.bisagra.rotation.x = -th;
      cintas.visible = s.prog > 0.995;
      const lv = xm * s.nivel;
      arena.visible = s.nivel > 0.002;
      arena.scale.y = Math.max(1e-4, lv); arena.position.y = TOPE + ESP + lv / 2;
      // cota de la base, delante del cartón
      const zF = CZ + b / 2 + xm * c + ESP * sn + 0.022;
      ponerCota(0, [-b / 2, TOPE + 0.0025, zF], [b / 2, TOPE + 0.0025, zF], [0, 1, 0], 0, 0.016);
      lB.position.set(0, TOPE + 0.03, zF + 0.05);
      // cota de x: borde de la solapa delantera (en el plano es el lado del cuadrado cortado; plegada es la altura)
      const xc = b / 2 + 0.014, A = [xc, TOPE + ESP + 0.0018, CZ + b / 2], B = [xc, TOPE + ESP + 0.0018 + xm * sn, CZ + b / 2 + xm * c];
      ponerCota(3, A, B, [1, 0, 0], -0.008, 0.008);
      kit.cambiarEtiqueta(lX, sn > 0.7 ? `h = x = ${kit.num(s.x, 2)} pulg` : `x = ${kit.num(s.x, 2)} pulg`);
      lX.position.set(xc + 0.125, TOPE + 0.026 + (xm * sn) / 2, CZ + b / 2 + (xm * c) / 2 + 0.03);
      lV.visible = s.nivel > 0.98;
      lV.position.set(0, TOPE + ESP + xm + 0.045, CZ);
      asa.position.set(b / 2 + 0.004, TOPE + ESP + xm * sn + 0.012, CZ + b / 2 + xm * c + 0.004);
    }
    const fmtV = (v) => kit.num(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 2);

    // ---------------------------------------------------------------- herramientas de mano (se mueven con las personas)
    // cuchillo cartonero: el eje x apunta a la hoja; agarre en el centro del puño
    const cuter = (() => {
      const piezas = [
        [BOX(0.13, 0.018, 0.011), { x: -0.02 }, 0xf0bd12],
        [BOX(0.075, 0.0186, 0.0116), { x: -0.045 }, 0x1d1f22],
        [BOX(0.016, 0.005, 0.006), { x: 0.005, y: 0.0105 }, 0x1d1f22],
        [BOX(0.012, 0.0146, 0.0118), { x: 0.049, y: -0.001 }, 0x1d1f22],
      ];
      const hojaC = new THREE.Shape([[0.05, 0.004], [0.062, 0.004], [0.072, -0.0075], [0.05, -0.0075]].map(([a, b]) => new THREE.Vector2(a, b)));
      const gh = new THREE.ExtrudeGeometry(hojaC, { depth: 0.0006, bevelEnabled: false }); gh.translate(0, 0, -0.0003);
      const lista = piezas.map(([geo, o, col]) => pintar(THREE, ubicar(THREE, geo, o), col));
      lista.push(pintar(THREE, gh, 0xe2e6ea));
      const m = kit.malla(unir(kit, lista), pintado, { padre: g });
      return { m, agarre: V3(-0.04, 0, 0), punta: V3(0.072, -0.0075, 0) };
    })();
    // regla del cortador
    const reglaObrero = kit.malla(geoRegla(THREE, RL, RA, 0.0015), reglaMat, { padre: g });
    // pistola de cinta: rollo con eje z, rodillo en la nariz y mango hacia abajo
    const pistola = (() => {
      const lista = [];
      const p = (geo, o, col) => lista.push(pintar(THREE, ubicar(THREE, geo, o), col));
      p(anillo(THREE, 0.04, 0.066, 0.05, 24), { rx: Math.PI / 2, y: 0.02 }, 0xc08a3c);
      p(CIL(0.038, 0.038, 0.056, 14), { rx: Math.PI / 2, y: 0.02 }, 0xc4302a);
      for (const sz of [-1, 1]) {
        p(BOX(0.15, 0.022, 0.005), { x: 0.045, y: -0.03, z: sz * 0.031, rz: -0.45 }, 0xc4302a);
        p(BOX(0.06, 0.03, 0.005), { x: -0.005, y: -0.045, z: sz * 0.031, rz: 0.2 }, 0xc4302a);
      }
      p(CIL(0.009, 0.009, 0.06, 12), { x: 0.1, y: -0.066, rx: Math.PI / 2 }, 0x1d1d1f);
      p(BOX(0.004, 0.022, 0.058), { x: 0.115, y: -0.052 }, 0x9aa0a6);
      p(BOX(0.032, 0.11, 0.03), { x: -0.03, y: -0.1, rz: 0.35 }, 0x1d1d1f);
      const m = kit.malla(unir(kit, lista), pintado, { padre: g });
      return { m, agarre: V3(-0.035, -0.1, 0), punta: V3(0.1, -0.075, 0) };
    })();

    // ---------------------------------------------------------------- personas
    const obrero = kit.persona({
      preset: 'obrero', semilla: 11, padre: g, x: OBRERO[0], y: 0.013, z: OBRERO[1], ry: 0, altura: 1.76,
      casco: null, chaleco: null, superior: 'polera', manga: 'corta', colorSuperior: '#4a6250', inferior: 'trabajo', colorInferior: '#5d5646',
      calzado: 'botas', cinturon: true, lentes: true, barba: 'bigote', pelo: 'corto', colorPelo: kit.PELOS.castanoOscuro, piel: kit.PIELES[3],
    });
    const ayudante = kit.persona({
      preset: 'obrera', semilla: 26, padre: g, x: AYUDA[0], y: PISO, z: AYUDA[1], ry: -0.3, altura: 1.65,
      casco: null, chaleco: 'naranjo', superior: 'polera', manga: 'larga', colorSuperior: '#5f4a6c', inferior: 'jeans', colorInferior: '#2f4058',
      calzado: 'botas', pelo: 'cola', colorPelo: kit.PELOS.negro, piel: kit.PIELES[2],
    });
    // lápiz de carpintero detrás de la oreja derecha y huincha al cinturón
    {
      const lp = kit.malla(unir(kit, [pintar(THREE, ubicar(THREE, CIL(0.0042, 0.0042, 0.13, 6), { rx: Math.PI / 2 }), 0xd94a2b), pintar(THREE, ubicar(THREE, new THREE.ConeGeometry(0.0042, 0.018, 6), { z: 0.074, rx: Math.PI / 2 }), 0xdab68c)]), pintado, { sombra: false, padre: obrero.huesos.cabeza });
      lp.position.set(-0.079, 0.075, 0.0); lp.rotation.set(0.35, 0.12, 0);
      const hu = kit.malla(unir(kit, [pintar(THREE, ubicar(THREE, cajaUV(THREE, 0.066, 0.066, 0.034, { s: 0.2 }), {}), 0xf0c419), pintar(THREE, ubicar(THREE, CIL(0.017, 0.017, 0.036, 12), { rx: Math.PI / 2 }), 0xc8ccd0), pintar(THREE, ubicar(THREE, BOX(0.01, 0.05, 0.03), { x: -0.036 }), 0x1b1b1d)]), pintado, { sombra: false, padre: obrero.huesos.cadera });
      hu.position.set(0.19, 0.04, 0.02); hu.rotation.set(0, Math.PI / 2, 0);
    }
    const poseObrero = { ...kit.POSES.reposo(), _pos: [0, -0.02, -0.03], cadera: [0.1, 0, 0], columna: [0.08, -0.06, 0], pecho: [0.05, -0.04, 0], cuello: [0.04, 0, 0], cabeza: [0.06, 0, 0],
      musloD: [-0.06, 0, -0.08], musloI: [0.04, 0, 0.08], piernaD: [0.06, 0, 0], piernaI: [0.04, 0, 0], pieD: [0, 0, 0.08], pieI: [0, 0, -0.08], dedosD: 0.82, dedosI: 0.12 };
    obrero.posar(poseObrero).transicion(0.01);
    const poseAyuda = { ...kit.POSES.reposo(), _pos: [0, -0.012, -0.02], cadera: [0.08, 0, 0], columna: [0.06, 0.05, 0], pecho: [0.04, 0.04, 0], cuello: [0.05, 0, 0], cabeza: [0.08, 0, 0],
      musloD: [0.02, 0, -0.07], musloI: [-0.05, 0, 0.07], piernaD: [0.05, 0, 0], piernaI: [0.03, 0, 0], pieD: [0, 0, 0.06], pieI: [0, 0, -0.06], dedosD: 0.86, dedosI: 0.3 };
    ayudante.posar(poseAyuda).transicion(0.01);

    // estado de las manos: objetivo de la muñeca (mundo), polo del codo y punto que se mira
    g.updateMatrixWorld(true);
    const mano = (h, L, polo) => {
      const st = { h, L, tgt: V3(), polo: V3(...polo).normalize().transformDirection(h.grupo.matrixWorld), listo: false };
      h.alcanzar(L, st.tgt, st.polo, 1);
      return st;
    };
    const oD = mano(obrero, 'D', [-1, -0.55, -0.7]), oI = mano(obrero, 'I', [1, -0.4, -0.7]);
    const aD = mano(ayudante, 'D', [-1, -0.6, -0.5]), aI = mano(ayudante, 'I', [1, -0.5, -0.6]);
    const miraO = V3(), miraA = V3();
    obrero.mirar(miraO); ayudante.mirar(miraA);
    const qG = new THREE.Quaternion(), _w = V3(), _w2 = V3(), _t = V3();
    // Lleva la mano para que un punto de la herramienta (o la palma) quede en 'deseado' (coordenadas de la estación)
    function corregir(st, deseado, herr = null, qLocal = null) {
      g.getWorldQuaternion(qG);
      const D = _w2.set(...deseado).applyMatrix4(g.matrixWorld);
      const ancla = (st.L === 'D' ? st.h.manoD : st.h.manoI).getWorldPosition(_w);
      let real;
      if (herr) {
        const qW = qG.clone().multiply(qLocal);
        const pos = ancla.clone().sub(herr.agarre.clone().applyQuaternion(qW));
        herr.m.position.copy(g.worldToLocal(pos.clone())); herr.m.quaternion.copy(qLocal);
        real = pos.add(herr.punta.clone().applyQuaternion(qW));
      } else real = ancla.clone();
      if (!st.listo) { st.tgt.copy(D).add(_t.set(0, 0.06, -0.06)); st.listo = true; return; }
      st.tgt.add(_t.subVectors(D, real));
      if (st.tgt.distanceTo(D) > 0.3) st.tgt.sub(D).setLength(0.3).add(D);
    }
    const base3 = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const orientacion = (X, Zref) => { const x = X.clone().normalize(), z = Zref.clone().sub(x.clone().multiplyScalar(Zref.dot(x))).normalize(), y = z.clone().cross(x); return base3(x, y, z); };
    // cuchillo: en el plano corta hacia −x con la hoja a 45°; plegado baja por la esquina
    const qCorteP = orientacion(V3(-1, -1, 0), V3(0, 0, -1)), qCorteV = orientacion(V3(-0.3, -1, 0.85), V3(-0.85, 0, -0.3));
    const qReglaP = new THREE.Quaternion(), qReglaV = base3(V3(0, 1, 0), V3(0, 0, -1), V3(-1, 0, 0));
    const qPistola = orientacion(V3(0.5, -0.5, 1), V3(-1, 0, 0.5)), qGiro = new THREE.Quaternion();

    function manosObrero(dt) {
      const xm = s.x * PULG, b = M.base(s.x) * PULG, k = suave(s.prog);
      const A = mezcla([MITAD + 0.004, TOPE + ESP + 0.0006, CZ - b / 2 - 0.0015], [b / 2 + ESP + 0.0015, TOPE + ESP + xm + 0.004, CZ - b / 2 - ESP - 0.0015], k);
      const B = mezcla([b / 2 - 0.006, TOPE + ESP + 0.0006, CZ - b / 2 - 0.0015], [b / 2 + ESP + 0.0015, TOPE + 0.006, CZ - b / 2 - ESP - 0.0015], k);
      const alza = mezcla([0, 1, 0], [0.45, 0.35, -0.82], k);
      const reposo = A.map((v, i) => v + alza[i] * 0.045);
      const t = s.corte;
      let p;
      if (t < 0) p = reposo;
      else if (t < 0.3) p = mezcla(reposo, A, suave(t / 0.3));
      else if (t < 1.0) p = mezcla(A, B, suave((t - 0.3) / 0.7));
      else if (t < 1.3) { const u = (t - 1.0) / 0.3; p = mezcla(B, A, suave(u)).map((v, i) => v + alza[i] * 0.035 * Math.sin(Math.PI * u)); }
      else if (t < 2.0) p = mezcla(A, B, suave((t - 1.3) / 0.7));
      else p = mezcla(B, reposo, suave((t - 2.0) / 0.4));
      const qC = qCorteP.clone().slerp(qCorteV, k);
      // regla y mano izquierda: tendida sobre la solapa derecha o parada contra la esquina, con un arco al plegar
      const arco = Math.sin(Math.PI * k);
      const rc = mezcla([b / 2 + xm / 2 + 0.12, TOPE + ESP + 0.0014, CZ - b / 2 + 0.002 + RA / 2], [b / 2 + ESP - RA / 2, TOPE + RL / 2 + 0.0005, CZ - b / 2 - ESP - 0.0009], k);
      rc[1] += 0.14 * arco; rc[2] -= 0.06 * arco;
      reglaObrero.position.set(...rc); reglaObrero.quaternion.copy(qReglaP).slerp(qReglaV, k);
      const pI = mezcla([MITAD + 0.2, TOPE + ESP + 0.0015 + 0.022, rc[2]], [rc[0], TOPE + Math.min(xm + 0.16, RL - 0.12), rc[2] - 0.024], k);
      pI[1] += 0.14 * arco * (1 - k);
      // inclinación del tronco según cuánto debe alcanzar
      const hombro = V3(OBRERO[0] - 0.17, 1.45, OBRERO[1]);
      const lejos = Math.max(hombro.distanceTo(V3(...p)), V3(OBRERO[0] + 0.17, 1.45, OBRERO[1]).distanceTo(V3(...pI)));
      const objetivo = Math.min(0.62, Math.max(0.12, (lejos - 0.42) * 1.6));
      s.lean += (objetivo - s.lean) * (dt > 0 ? 1 - Math.exp(-dt * 4) : 1);
      const l = s.lean;
      poseObrero.cadera[0] = 0.04 + l * 0.5; poseObrero.columna[0] = l * 0.32; poseObrero.pecho[0] = l * 0.18;
      poseObrero._pos[2] = -0.02 - 0.14 * l; poseObrero._pos[1] = -0.015 - 0.035 * l;
      poseObrero.cuello[0] = 0.04 - l * 0.25;
      miraO.set(...(t >= 0 ? p : A)).applyMatrix4(g.matrixWorld);
      return { p, qC, pI };
    }
    function manosAyudante() {
      const c = [CAJITA.x - CAJITA.b / 2 - ESP - 0.003, 0, CAJITA.z - CAJITA.b / 2 - ESP - 0.003];
      const arriba = [c[0], CAJITA.y + CAJITA.h + ESP + 0.012, c[2]], abajo = [c[0], CAJITA.y + 0.016, c[2]];
      const reposo = [c[0] - 0.05, CAJITA.y + CAJITA.h + 0.09, c[2] - 0.13];
      const t = s.tCinta;
      let p, giro = 0;
      if (t < 0.5) p = mezcla(reposo, arriba, suave(t / 0.5));
      else if (t < 1.4) p = mezcla(arriba, abajo, suave((t - 0.5) / 0.9));
      else if (t < 1.75) { p = abajo; giro = 0.55 * Math.sin((Math.PI * (t - 1.4)) / 0.35); }
      else if (t < 2.3) p = mezcla(abajo, reposo, suave((t - 1.75) / 0.55));
      else p = reposo;
      qGiro.setFromAxisAngle(V3(0, 0, 1), giro);
      const qP = qPistola.clone().multiply(qGiro);
      const pI = [CAJITA.x + CAJITA.b / 2 - 0.07, CAJITA.y + CAJITA.h + ESP + 0.03, CAJITA.z - CAJITA.b / 2 - 0.012];
      const mirarObrero = t > 2.6 && t < 3.7;
      miraA.set(...(mirarObrero ? [OBRERO[0] - 0.05, MESA + 0.12, -0.25] : t < 2.3 ? p : [CAJITA.x, CAJITA.y + 0.08, CAJITA.z])).applyMatrix4(g.matrixWorld);
      return { p, qP, pI };
    }
    function personas(dt) {
      const o = manosObrero(dt);
      obrero.actualizar(dt);
      corregir(oD, o.p, cuter, o.qC);
      corregir(oI, o.pI);
      const a = manosAyudante();
      ayudante.actualizar(dt);
      corregir(aD, a.p, pistola, a.qP);
      corregir(aI, a.pI);
    }

    // ---------------------------------------------------------------- gráfico del volumen
    const graf = kit.grafico({
      f: (x) => M.volumen(x), x0: 0, x1: 12, y0: 0, y1: 1150, width: 0.95, height: 0.58, labelSize: 0.034,
      xTicks: [0, 2, 4, 6, 8, 10, 12], yTicks: [0, 300, 600, 900], yTickFmt: (v) => kit.num(v, 0),
      xLabel: 'corte x (pulg)', yLabel: 'volumen V (pulg³)', curveColor: 0x5cc8ff,
    });
    graf.group.position.set(0.6, 1.28, 0.72); graf.group.rotation.y = -0.8;
    g.add(graf.group);
    // extremos excluidos del dominio (0 < x < 12)
    graf.addPoint('x0', 0, 0, { color: 0xffd34d, hollow: true, guides: false });
    graf.addPoint('x12', 12, 0, { color: 0xffd34d, hollow: true, guides: false });
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => fijarX(graf.xFromLocal(p.x)) });

    function revelar() {
      graf.removePoint('max');
      if (s.revelar) { const o = M.optimo(); graf.addPoint('max', o.x, o.volumen, { color: 0x6fe3a2, labelX: 'x = 4', labelY: '1.024' }); }
      s.cambio = true;
    }

    // ---------------------------------------------------------------- panel
    const x = () => s.x;
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo, ancho: 1.0, botonesPorFila: 2,
      enunciado: 'Cartón cuadrado de 24 pulgadas (60,96 cm). Se cortan cuadrados de lado x en las cuatro esquinas y se doblan los bordes para formar una caja sin tapa.',
      ecuaciones: ['V(x, h) = (24 − 2x)²·h', 'h = x   ⇒   V(x) = (24 − 2x)²·x,   0 < x < 12'],
      lecturas: [
        { etiqueta: 'corte x', valor: () => `${kit.num(x(), 2)} pulg`, color: '#ffb347', escala: 0.74 },
        { etiqueta: 'x en centímetros', valor: () => `${kit.num(x() * 2.54, 2)} cm`, color: '#ffb347', escala: 0.74 },
        { etiqueta: 'base 24 − 2x', valor: () => `${kit.num(M.base(x()), 1)} pulg`, color: '#5cc8ff', escala: 0.74 },
        { etiqueta: 'altura h = x', valor: () => `${kit.num(x(), 2)} pulg`, color: '#5cc8ff', escala: 0.74 },
        { etiqueta: 'volumen V', valor: () => `${fmtV(M.volumen(x()))} pulg³`, color: '#6fe3a2', escala: 0.7 },
        { etiqueta: 'volumen en litros', valor: () => `${kit.num(M.volumen(x()) * L3, 2)} L`, color: '#6fe3a2', escala: 0.74 },
      ],
      deslizadores: [{ etiqueta: 'Lado x de los cuadrados cortados', min: 0.25, max: 11.75, paso: 0.25, get: x, set: (v) => fijarX(v), formato: (v) => `${kit.num(v, 2)} pulg · ${kit.num(v * 2.54, 1)} cm` }],
      botones: [
        { etiqueta: 'Ir al óptimo', accion: () => fijarX(M.optimo().x) },
        { etiqueta: 'Revelar solución', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
        { etiqueta: () => (s.plegado ? 'Desplegar' : 'Plegar'), accion: () => plegar(!s.plegado) },
        { etiqueta: 'Llenar con arena', tipo: 'interruptor', get: () => s.lleno, set: (v) => llenar(v) },
      ],
      pie: () => (s.revelar
        ? 'V′(x) = 12(x − 4)(x − 12) = 0 en x = 4 (x = 12 no está en el dominio). V″(4) = −96 < 0: máximo absoluto en (0, 12). Base 16 × 16 pulgadas, altura 4 pulgadas y V = 1.024 pulgadas³ (16,78 litros).'
        : 'Si cortas más, la caja gana altura pero pierde base. Arrastra la esfera naranja de la esquina, el gráfico o el deslizador, y llena la caja para comparar volúmenes.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-0.88, 1.45, 0.92); panel.mesh.rotation.y = 0.8;
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    // primera pose: el cartón armado y las manos ya en su lugar
    construir(); s.cambio = false; graf.setMarker(s.x); posar();
    for (let i = 0; i < 6; i++) personas(i ? 0.016 : 0);

    return {
      paneles: [panel],
      radioSombra: 4.5,
      alturaCartel: 3.4,
      vista: { escritorio: { camara: [0, 1.86, 2.95], objetivo: [0, 1.02, -0.1] }, vr: { pos: [0, 0, 1.55], yaw: 0 } },
      dom: [
        { tipo: 'rango', etiqueta: 'x', min: 0.25, max: 11.75, paso: 0.25, get: x, set: (v) => fijarX(v), formato: (v) => `${kit.num(v, 2)} pulg (${kit.num(v * 2.54, 1)} cm)` },
        { tipo: 'boton', etiqueta: 'Ir al óptimo', accion: () => fijarX(M.optimo().x) },
        { tipo: 'interruptor', etiqueta: 'Revelar solución', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
        { tipo: 'boton', etiqueta: () => (s.plegado ? 'Desplegar' : 'Plegar'), accion: () => plegar(!s.plegado) },
        { tipo: 'interruptor', etiqueta: 'Llenar con arena', get: () => s.lleno, set: (v) => llenar(v) },
      ],
      actualizar(dt) {
        if (s.cambio) {
          s.cambio = false; construir(); graf.setMarker(s.x); panel.invalidate(); s.pose = true;
          if (s.corte < 0) s.corte = 0; else s.repetir = true; // cada cambio de x repite el gesto de corte
        }
        if (!s.plegado && s.nivel > 0) { s.nivel = Math.max(0, s.nivel - dt * 1.6); s.pose = true; }
        else {
          const obj = s.plegado ? 1 : 0;
          if (s.prog !== obj) { s.prog = obj > s.prog ? Math.min(1, s.prog + dt * 0.8) : Math.max(0, s.prog - dt * 0.8); s.pose = true; }
          if (s.prog >= 1) {
            const n = s.lleno ? 1 : 0;
            if (s.nivel !== n) { s.nivel = n > s.nivel ? Math.min(1, s.nivel + dt * 0.9) : Math.max(0, s.nivel - dt * 1.6); s.pose = true; }
          }
        }
        if (s.pose) { s.pose = false; posar(); }
        // gestos de las personas
        if (Number.isFinite(rev.corte)) s.corte = rev.corte;
        else if (s.corte >= 0) { s.corte += dt; if (s.corte > T_CORTE) { s.corte = s.repetir ? 0 : -1; s.repetir = false; } }
        s.tCinta = Number.isFinite(rev.cinta) ? rev.cinta : (s.tCinta + dt) % T_CINTA;
        personas(dt);
      },
    };
  },
};
