// Personas articuladas para las estaciones de la Guía 4.
// Cada persona tiene un esqueleto con columna, cuello, cabeza, ojos, párpados, brazos, manos con dedos de dos falanges
// y piernas. Las mallas se agrupan por material (piel, ojos, pelo, ropa, calzado, chaleco, casco, accesorios) y se
// deforman con el esqueleto. El rostro tiene ojos con iris, párpados que parpadean, pestañas, cejas, nariz, labios y
// orejas. Incluye poses, animaciones (lanzar, caminar, palear), mirada, respiración y alcance de las manos con
// cinemática inversa de dos huesos.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const g2 = (dx, sx, dy, sy) => Math.exp(-0.5 * ((dx / sx) ** 2 + (dy / sy) ** 2));
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const EJE_X = V3(1, 0, 0), EJE_Y = V3(0, 1, 0), EJE_Z = V3(0, 0, 1);

function azar(semilla) {
  let a = (semilla * 2654435761) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ paletas
export const PIELES = ['#efcfb6', '#e4bc9c', '#d6a785', '#c4906b', '#ad7853', '#8f5d3f', '#6e452f'];
export const PELOS = { negro: '#1b1714', castanoOscuro: '#2e2119', castano: '#4b3324', castanoClaro: '#77583b', rubio: '#b8935c', canoso: '#8f8c88', gris: '#b4b2ad' };
export const OJOS = { cafe: '#4a2e1b', cafeOscuro: '#2f1d12', avellana: '#6b5a2e', verde: '#4f6b3b', azul: '#4b6b8c' };
export const CHALECOS = { amarillo: '#cfe12e', naranjo: '#ff6b1c' };

// ------------------------------------------------------------------ proporciones (figura de 1,75 m; después se escala)
function proporciones(mujer) {
  const comun = {
    yCadera: 0.95, yColumna: 1.07, yPecho: 1.23, yCuello: 1.452, yCabeza: 1.548,
    yHombro: 1.405, zHombro: -0.015, yCodo: 1.118, zCodo: -0.03, yMuneca: 0.868, zMuneca: -0.006,
    yMuslo: 0.928, yRodilla: 0.503, yTobillo: 0.086,
  };
  if (mujer) {
    return {
      ...comun, mujer: true,
      xHombro: 0.17, xCodo: 0.196, xMuneca: 0.205, xCadera: 0.096, yCodo: 1.122, yMuneca: 0.874,
      cabeza: { a: 0.0728, b: 0.1115, c: 0.0965, mandibula: 0.22, menton: 0.0045, pomulo: 0.0042, angulo: 0.0012, labios: 1.25 },
      gBrazo: 0.85, gPierna: 0.97, gMano: 0.9, gCuello: 0.86,
      torso: [
        [0.815, -0.014, 0.066, 0.05], [0.84, -0.018, 0.142, 0.1], [0.89, -0.022, 0.18, 0.118], [0.95, -0.02, 0.182, 0.118],
        [1.01, -0.012, 0.157, 0.104], [1.07, -0.004, 0.131, 0.092], [1.14, 0.0, 0.136, 0.096], [1.2, 0.008, 0.148, 0.112, 0.1],
        [1.26, 0.013, 0.155, 0.12, 0.15], [1.32, 0.007, 0.157, 0.106, 0.05], [1.375, -0.002, 0.156, 0.093], [1.41, -0.008, 0.138, 0.082],
        [1.437, -0.011, 0.097, 0.067], [1.458, -0.012, 0.058, 0.055],
      ],
    };
  }
  return {
    ...comun, mujer: false,
    xHombro: 0.186, xCodo: 0.214, xMuneca: 0.224, xCadera: 0.092,
    cabeza: { a: 0.0772, b: 0.1155, c: 0.1, mandibula: 0.19, menton: 0.0075, pomulo: 0.0042, angulo: 0.0045, labios: 1 },
    gBrazo: 1, gPierna: 1, gMano: 1, gCuello: 1,
    torso: [
      [0.815, -0.012, 0.062, 0.05], [0.84, -0.014, 0.132, 0.095], [0.89, -0.016, 0.166, 0.112], [0.95, -0.016, 0.171, 0.115],
      [1.01, -0.01, 0.159, 0.106], [1.07, -0.004, 0.148, 0.1], [1.14, 0.002, 0.153, 0.104], [1.21, 0.008, 0.164, 0.112, 0.03],
      [1.28, 0.012, 0.173, 0.118, 0.04], [1.34, 0.008, 0.178, 0.112], [1.385, 0.0, 0.176, 0.1], [1.415, -0.006, 0.152, 0.09],
      [1.44, -0.01, 0.108, 0.074], [1.462, -0.012, 0.066, 0.06],
    ],
  };
}

// Interpolación de Catmull-Rom sobre una tabla de filas [y, ...valores]
function tablaEn(tabla, y) {
  if (y <= tabla[0][0]) return tabla[0].slice(1);
  const n = tabla.length;
  if (y >= tabla[n - 1][0]) return tabla[n - 1].slice(1);
  let i = 0;
  while (i < n - 2 && tabla[i + 1][0] < y) i++;
  const p0 = tabla[Math.max(0, i - 1)], p1 = tabla[i], p2 = tabla[i + 1], p3 = tabla[Math.min(n - 1, i + 2)];
  const t = (y - p1[0]) / (p2[0] - p1[0]);
  const out = [];
  for (let k = 1; k < p1.length; k++) {
    const a = p0[k] ?? 0, b = p1[k] ?? 0, c = p2[k] ?? 0, d = p3[k] ?? 0;
    out.push(0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t));
  }
  return out;
}

// ------------------------------------------------------------------ forma de la cabeza
// Coordenadas de la cabeza: origen en su centro, la cara mira a +z. th = ángulo horizontal (0 = frente, +π/2 = izquierda
// de la persona, ±π = nuca); ph = latitud (+π/2 = coronilla). La textura del rostro usa u = 0,5 + th/2π y v = 0,5 + ph/π.
function formaCabeza(P) {
  const base = (th, ph) => {
    const cp = Math.cos(ph), sp = Math.sin(ph), st = Math.sin(th), ct = Math.cos(th);
    const sx = Math.sign(st) * Math.abs(st) ** 0.86;
    const sz = ct >= 0 ? ct ** 0.7 : ct;
    let x = P.a * cp * sx, y = P.b * sp, z = P.c * cp * sz;
    if (ct < 0) z *= 1 + 0.06 * sstep(-0.45, 0.35, sp); // occipucio
    const bajo = sstep(-0.05, -0.92, sp);
    x *= 1 - P.mandibula * bajo * (0.55 + 0.45 * Math.max(0, ct));
    const nuca = sstep(-0.1, -0.78, sp) * sstep(0.3, -0.55, ct); // bajo la mandíbula se mete hacia el cuello
    z *= 1 - 0.5 * nuca; x *= 1 - 0.22 * nuca;
    if (ct > 0 && sp > 0.15) z *= 1 - 0.035 * sstep(0.15, 0.75, sp) * ct; // frente inclinada hacia atrás
    return [x, y, z];
  };
  const nrm = (th, ph) => {
    if (Math.abs(ph) > Math.PI / 2 - 1e-3) return [0, Math.sign(ph), 0];
    const e = 1e-3, p = base(th, ph), a = base(th + e, ph), b = base(th, ph + e);
    const u = [a[0] - p[0], a[1] - p[1], a[2] - p[2]], w = [b[0] - p[0], b[1] - p[1], b[2] - p[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (n[0] * p[0] + n[1] * p[1] + n[2] * p[2] < 0) n = n.map((v) => -v);
    const l = Math.hypot(...n) || 1;
    return n.map((v) => v / l);
  };
  const desp = (th, ph, cuencas) => {
    const at = Math.abs(th);
    let d = 0;
    d += 0.0045 * g2(at - 0.3, 0.32, ph - 0.27, 0.055);        // arco de las cejas
    if (cuencas) d -= 0.0115 * g2(at - 0.43, 0.13, ph - 0.07, 0.075); // cuencas de los ojos
    d += 0.0038 * g2(th, 0.075, ph - 0.12, 0.09);               // raíz de la nariz
    d += P.pomulo * g2(at - 0.66, 0.17, ph + 0.05, 0.1);        // pómulos
    d += 0.0028 * g2(at - 0.55, 0.22, ph + 0.3, 0.13);          // mejillas
    d -= 0.0038 * g2(at - 0.98, 0.16, ph - 0.28, 0.12);         // sienes
    d += 0.0012 * g2(th, 0.06, ph + 0.37, 0.05);                // surco del labio superior (filtrum)
    d += 0.0056 * P.labios * g2(th, 0.25, ph + 0.448, 0.034);   // labio superior
    d += 0.0052 * P.labios * g2(th, 0.22, ph + 0.53, 0.036);    // labio inferior
    d -= 0.0034 * g2(th, 0.3, ph + 0.49, 0.011);                // comisura
    d -= 0.0028 * g2(th, 0.24, ph + 0.62, 0.045);               // surco bajo el labio
    d += P.menton * g2(th, 0.27, ph + 0.82, 0.12);              // mentón
    d += P.angulo * g2(at - 1.18, 0.2, ph + 0.62, 0.12);        // ángulo de la mandíbula
    return d;
  };
  return {
    base, nrm, desp,
    punto(th, ph, cuencas = true) {
      const p = base(th, ph), n = nrm(th, ph), d = desp(th, ph, cuencas);
      return V3(p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d);
    },
    normal(th, ph) { const n = nrm(th, ph); return V3(n[0], n[1], n[2]); },
  };
}

// Línea de nacimiento del pelo (latitud) según el ángulo horizontal
function lineaPelo(th, estilo) {
  const a = Math.abs(th);
  const frente = estilo === 'entradas' ? 0.72 : 0.6;
  const pts = [[0, frente], [0.45, frente - 0.04], [0.8, 0.5], [1.05, 0.38], [1.2, 0.3], [1.24, 0.06], [1.36, 0.04], [1.42, 0.33],
    [1.72, 0.32], [1.9, 0.1], [2.2, -0.14], [2.6, -0.34], [Math.PI, -0.42]];
  if (estilo === 'entradas') { pts[1][1] = 0.6; pts[2][1] = 0.58; }
  for (let i = 0; i < pts.length - 1; i++) {
    if (a <= pts[i + 1][0]) { const t = (a - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return lerp(pts[i][1], pts[i + 1][1], t); }
  }
  return -0.42;
}

// ------------------------------------------------------------------ texturas pintadas
const cacheTex = new Map();
function enCache(clave, fn) {
  if (!cacheTex.has(clave)) cacheTex.set(clave, fn());
  return cacheTex.get(clave);
}
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texDe(c, repetir = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const css = (c, k = 1, a = 1) => { const q = new THREE.Color(c); return `rgba(${Math.round(clamp(q.r * k, 0, 1) * 255)},${Math.round(clamp(q.g * k, 0, 1) * 255)},${Math.round(clamp(q.b * k, 0, 1) * 255)},${a})`; };
const mezcla = (c1, c2, t) => new THREE.Color(c1).lerp(new THREE.Color(c2), t);
function manchaRadial(g, x, y, rx, ry, color, color2 = null) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, color); gr.addColorStop(1, color2 ?? color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
}
function fibras(g, w, h, rnd, n, fuerza = 0.05) {
  for (let i = 0; i < n; i++) {
    const claro = rnd() < 0.5;
    g.fillStyle = claro ? `rgba(255,255,255,${fuerza * rnd()})` : `rgba(0,0,0,${fuerza * rnd()})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1);
  }
}
function costura(g, pts, color = 'rgba(0,0,0,0.28)', ancho = 1.3, guion = [4, 3]) {
  g.save(); g.strokeStyle = color; g.lineWidth = ancho; g.setLineDash(guion);
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.restore();
}

// Zonas del atlas del rostro (bajo el pelo, en la parte alta de la nuca): piel lisa, oreja y párpado
const ATLAS = { piel: [20 / 1024, 1 - 63 / 512], oreja: [60 / 1024, 1 - 63 / 512], parpado: [82 / 1024, 118 / 1024, 1 - 30 / 512, 1 - 96 / 512] };

function texturaRostro(o) {
  return enCache('rostro|' + JSON.stringify(o), () => {
    const W = 1024, H = 512, R = W / TAU;
    const [cv, g] = lienzo(W, H);
    const X = (th) => (0.5 + th / TAU) * W, Y = (ph) => (0.5 - ph / Math.PI) * H;
    const rnd = azar(o.semilla * 13 + 7);
    const piel = new THREE.Color(o.piel), pelo = new THREE.Color(o.pelo);
    g.fillStyle = css(piel); g.fillRect(0, 0, W, H);
    // moteado de la piel
    for (let i = 0; i < 1100; i++) {
      const x = rnd() * W, y = rnd() * H, r = 3 + rnd() * 16;
      manchaRadial(g, x, y, r, r * (0.7 + rnd() * 0.6), rnd() < 0.55 ? `rgba(130,62,44,${0.02 + rnd() * 0.035})` : `rgba(255,236,222,${0.02 + rnd() * 0.03})`);
    }
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(90,40,30,${rnd() * 0.06})`; g.fillRect(rnd() * W, rnd() * H, 1, 1); }
    const rojo = o.mujer ? 0.17 : 0.13;
    for (const s of [-1, 1]) {
      manchaRadial(g, X(s * 0.64), Y(-0.13), 0.22 * R, 0.15 * R, `rgba(205,88,78,${rojo})`);      // mejillas
      manchaRadial(g, X(s * 0.43), Y(0.085), 0.17 * R, 0.11 * R, 'rgba(85,42,32,0.2)');           // cuenca
      manchaRadial(g, X(s * 0.4), Y(-0.03), 0.14 * R, 0.05 * R, 'rgba(105,55,68,0.14)');          // ojera
      manchaRadial(g, X(s * 1.52), Y(0.0), 0.12 * R, 0.25 * R, 'rgba(200,90,80,0.12)');           // zona de la oreja
      // surco nasogeniano
      g.save(); g.strokeStyle = 'rgba(95,45,35,0.07)'; g.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        g.lineWidth = 7 - k * 1.5; g.beginPath(); g.moveTo(X(s * 0.15), Y(-0.27));
        g.quadraticCurveTo(X(s * 0.32), Y(-0.36), X(s * 0.36), Y(-0.53)); g.stroke();
      }
      g.restore();
      // pliegue del párpado superior
      g.save(); g.strokeStyle = 'rgba(70,35,28,0.28)'; g.lineWidth = 2.2; g.beginPath();
      g.moveTo(X(s * 0.28), Y(0.13)); g.quadraticCurveTo(X(s * 0.45), Y(0.19), X(s * 0.6), Y(0.11)); g.stroke(); g.restore();
    }
    manchaRadial(g, X(0), Y(-0.17), 0.08 * R, 0.06 * R, 'rgba(205,92,82,0.14)');                // punta de la nariz
    manchaRadial(g, X(0), Y(0.42), 0.5 * R, 0.14 * R, 'rgba(255,240,228,0.08)');                // frente
    // labios
    const lab = mezcla(piel, o.mujer ? '#a3414b' : '#9c514c', o.mujer ? 0.55 : 0.42);
    const sup = [[-0.36, -0.492], [-0.24, -0.468], [-0.12, -0.448], [-0.045, -0.431], [0, -0.443], [0.045, -0.431], [0.12, -0.448], [0.24, -0.468], [0.36, -0.492]];
    const lin = [[0.36, -0.492], [0.2, -0.486], [0, -0.49], [-0.2, -0.486], [-0.36, -0.492]];
    const inf = [[0.36, -0.492], [0.22, -0.528], [0.08, -0.552], [0, -0.555], [-0.08, -0.552], [-0.22, -0.528], [-0.36, -0.492]];
    const camino = (pts) => pts.forEach(([t, p], i) => (i ? g.lineTo(X(t), Y(p)) : g.moveTo(X(t), Y(p))));
    g.beginPath(); camino(sup); camino(lin.slice(1)); g.closePath(); g.fillStyle = css(lab, 0.86); g.fill();
    g.beginPath(); camino(lin); camino(inf.slice(1)); g.closePath(); g.fillStyle = css(lab, 0.97); g.fill();
    manchaRadial(g, X(0), Y(-0.52), 0.12 * R, 0.018 * R, 'rgba(255,230,225,0.22)');            // brillo del labio inferior
    g.save(); g.strokeStyle = 'rgba(55,20,18,0.75)'; g.lineWidth = 2.2; g.beginPath(); camino(lin); g.stroke(); g.restore();
    g.save(); g.strokeStyle = css(lab, 0.75, 0.5); g.lineWidth = 1.2; g.beginPath(); camino(sup); g.stroke(); g.restore();
    // fosas nasales (quedan bajo la punta de la nariz)
    for (const s of [-1, 1]) manchaRadial(g, X(s * 0.052), Y(-0.263), 0.026 * R, 0.013 * R, 'rgba(45,16,12,0.92)', 'rgba(80,35,28,0)');
    // barba de algunos días o barba poblada
    if (o.barba === 'barba' || o.barba === 'bigote') {
      // barba poblada: base difuminada y pelos cortos hacia abajo
      const bigote = o.barba === 'bigote';
      const zonaB = (th, ph) => {
        const a = Math.abs(th);
        const mostacho = ph < -0.3 && ph > -0.45 && a < 0.44;
        if (bigote) return mostacho;
        const boca = a < 0.4 && ph > -0.6 && ph < -0.43;
        return mostacho || (!boca && ph < -0.28 && ph > -1.25 && a < 1.32 - 0.3 * sstep(-0.32, -0.05, ph)) || (a > 1.06 && a < 1.34 && ph < 0.1 && ph > -0.5);
      };
      g.save(); g.filter = 'blur(5px)';
      for (let i = 0; i < 9000; i++) {
        const th = (rnd() - 0.5) * 2.9, ph = 0.12 - rnd() * 1.4;
        if (!zonaB(th, ph)) continue;
        g.fillStyle = css(pelo, 0.9, 0.16); g.beginPath(); g.arc(X(th), Y(ph), 4, 0, TAU); g.fill();
      }
      g.restore();
      for (let i = 0; i < 60000; i++) {
        const th = (rnd() - 0.5) * 2.9, ph = 0.12 - rnd() * 1.4;
        if (!zonaB(th, ph)) continue;
        const x = X(th), y = Y(ph), l = 3 + rnd() * 5, ang = Math.PI / 2 + (rnd() - 0.5) * 0.9 + (th > 0 ? -0.25 : 0.25) * (ph < -0.5 ? 1 : 0);
        g.strokeStyle = css(mezcla(pelo, '#7d6450', rnd() * 0.25), 0.7 + rnd() * 0.6, 0.45 + rnd() * 0.45); g.lineWidth = 0.8 + rnd() * 0.7;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); g.stroke();
      }
    }
    if (o.barba && o.barba !== 'no') {
      const fuerte = o.barba === 'barba' ? 0.35 : o.barba === 'bigote' ? 0.12 : 0.3;
      const zona = (th, ph) => {
        const a = Math.abs(th);
        const quijada = ph < -0.27 && ph > -1.2 && a < 1.32 - 0.25 * sstep(-0.3, -0.05, ph) && !(a < 0.4 && ph > -0.57 && ph < -0.42);
        const bigote = ph < -0.31 && ph > -0.44 && a < 0.42;
        const patilla = a > 1.1 && a < 1.38 && ph < 0.1 && ph > -0.5;
        return quijada || bigote || patilla;
      };
      for (let i = 0; i < 26000; i++) {
        const th = (rnd() - 0.5) * 2.9, ph = -0.1 - rnd() * 1.15;
        if (!zona(th, ph)) continue;
        const k = o.barba === 'bigote' && !(ph < -0.31 && ph > -0.44 && Math.abs(th) < 0.42) ? 0.25 : 1;
        g.fillStyle = css(pelo, 0.8, fuerte * k * (0.4 + rnd() * 0.6));
        g.fillRect(X(th), Y(ph), 1 + rnd() * 1.5, 1 + rnd() * 1.5);
      }
    }
    // cejas, pelo por pelo
    const ceja = mezcla(pelo, '#120c08', 0.25);
    for (const s of [-1, 1]) {
      for (let i = 0; i < (o.mujer ? 260 : 360); i++) {
        const t = rnd(), th = s * (0.14 + 0.5 * t), ph = 0.243 + (o.mujer ? 0.06 : 0.045) * Math.sin(Math.PI * Math.min(1, t * 1.12)) - 0.02 * t;
        const grosor = lerp(o.mujer ? 0.022 : 0.034, 0.011, t) * (rnd() - 0.5) * 2;
        const x = X(th), y = Y(ph + grosor), ang = t < 0.18 ? -1.25 + rnd() * 0.4 : -0.2 - rnd() * 0.25;
        const l = 4 + rnd() * 7;
        g.strokeStyle = css(ceja, 0.8 + rnd() * 0.4, 0.45 + rnd() * 0.45); g.lineWidth = 1 + rnd() * 0.9;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * l * s, y + Math.sin(ang) * l); g.stroke();
      }
    }
    // cuero cabelludo bajo el pelo, con borde suave
    for (let px = 0; px < W; px += 2) {
      const th = (px / W - 0.5) * TAU, ph = lineaPelo(th, o.estiloPelo);
      const y = Y(ph);
      const gr = g.createLinearGradient(0, y - 0.05 * R, 0, y + 0.03 * R);
      gr.addColorStop(0, css(pelo, 1, 0.95)); gr.addColorStop(1, css(pelo, 1, 0));
      g.fillStyle = gr; g.fillRect(px, 0, 2, y + 0.03 * R);
    }
    // atlas: piel lisa, oreja y párpado (con línea de pestañas)
    g.fillStyle = css(piel); g.fillRect(0, 26, 40, 74);
    g.fillStyle = css(mezcla(piel, '#c86a5c', 0.12)); g.fillRect(40, 26, 40, 74);
    const gp = g.createLinearGradient(0, 28, 0, 98);
    gp.addColorStop(0, css(piel)); gp.addColorStop(0.55, css(piel, 0.93)); gp.addColorStop(0.8, css(mezcla(piel, '#6b3a30', 0.3)));
    gp.addColorStop(0.9, '#2a1a12'); gp.addColorStop(1, '#1a0f0b');
    g.fillStyle = gp; g.fillRect(80, 26, 40, 74);
    return texDe(cv);
  });
}

function texturaOjo(color) {
  return enCache('ojo|' + color, () => {
    const W = 256, H = 128;
    const [cv, g] = lienzo(W, H);
    const rnd = azar(color.length * 31 + 5);
    g.fillStyle = '#efe8e1'; g.fillRect(0, 0, W, H);
    // venillas hacia los lados
    g.strokeStyle = 'rgba(190,70,70,0.22)'; g.lineWidth = 0.8;
    for (let i = 0; i < 26; i++) {
      let x = 0.25 * W + (rnd() < 0.5 ? -1 : 1) * (40 + rnd() * 20), y = H / 2 + (rnd() - 0.5) * 50;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (x < 0.25 * W ? -1 : 1) * (5 + rnd() * 6); y += (rnd() - 0.5) * 6; g.lineTo(x, y); }
      g.stroke();
    }
    const cx = 0.25 * W, cy = H / 2, r = 21.5;
    const c = new THREE.Color(color);
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, r);
    gr.addColorStop(0, css(c, 0.5)); gr.addColorStop(0.35, css(c, 1.25)); gr.addColorStop(0.75, css(c, 0.95)); gr.addColorStop(0.93, css(c, 0.45)); gr.addColorStop(1, 'rgba(30,20,15,0.9)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    for (let i = 0; i < 90; i++) {
      const a = rnd() * TAU, r0 = 6 + rnd() * 3, r1 = r * (0.7 + rnd() * 0.25);
      g.strokeStyle = rnd() < 0.5 ? css(c, 1.6, 0.35) : css(c, 0.45, 0.35); g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
    }
    g.fillStyle = '#060404'; g.beginPath(); g.arc(cx, cy, 7.5, 0, TAU); g.fill();
    // costura del borde izquierdo y derecho: la parte de atrás del ojo nunca se ve
    return texDe(cv);
  });
}

function texturaPelo(color, estilo) {
  return enCache('pelo|' + color + estilo, () => {
    const W = 256, H = 256;
    const [cv, g] = lienzo(W, H);
    const rnd = azar(color.length * 17 + estilo.length);
    const c = new THREE.Color(color);
    g.fillStyle = css(c, 0.85); g.fillRect(0, 0, W, H);
    const corto = estilo === 'rapado';
    for (let i = 0; i < (corto ? 9000 : 2600); i++) {
      const x = rnd() * W, y = rnd() * H, l = corto ? 2 + rnd() * 3 : 18 + rnd() * 70, k = 0.6 + rnd() * 0.75;
      g.strokeStyle = css(mezcla(c, '#9a8068', 0.08 + rnd() * 0.22), k, 0.25 + rnd() * 0.35); g.lineWidth = corto ? 1 : 0.8 + rnd() * 0.9;
      for (const dx of [-W, 0, W]) {
        g.beginPath(); g.moveTo(x + dx, y);
        g.bezierCurveTo(x + dx + (rnd() - 0.5) * 6, y + l * 0.33, x + dx + (rnd() - 0.5) * 6, y + l * 0.66, x + dx + (rnd() - 0.5) * 8, y + l);
        g.stroke();
      }
    }
    return texDe(cv, true);
  });
}

// Prendas: la textura del tronco ocupa v ∈ [0,2; 1] (altura 0,78 a 1,5 m) y las mangas v ∈ [0; 0,18].
// En las piernas, v ∈ [0; 0,74] según la altura y la pelvis v ∈ [0,76; 1].
const VS = (y) => 0.2 + ((y - 0.78) / 0.72) * 0.8;
const VP = (y) => (y <= 1.0 ? (y / 1.0) * 0.74 : 0.74);
const VPel = (y) => 0.76 + clamp((y - 0.8) / 0.25, 0, 1) * 0.24;

function texturaSuperior(tipo, color, mujer, semilla) {
  return enCache(`sup|${tipo}|${color}|${mujer}|${semilla % 4}`, () => {
    const W = 512, H = 512;
    const [cv, g] = lienzo(W, H);
    const rnd = azar(semilla * 3 + 11);
    const X = (ang) => (0.5 + ang / TAU) * W, Y = (y) => (1 - VS(y)) * H, Ym = (v) => (1 - v) * H;
    const c = new THREE.Color(color);
    g.fillStyle = css(c); g.fillRect(0, 0, W, H);
    fibras(g, W, H, rnd, 26000, tipo === 'parka' ? 0.05 : 0.07);
    if (tipo === 'camisa') { // tela de sarga con leve cuadrillé
      g.globalAlpha = 0.06;
      for (let x = 0; x < W; x += 9) { g.fillStyle = '#000'; g.fillRect(x, 0, 2, H); }
      for (let y = 0; y < H; y += 9) { g.fillStyle = '#fff'; g.fillRect(0, y, W, 1); }
      g.globalAlpha = 1;
    }
    // costuras laterales y de hombros
    for (const a of [-Math.PI / 2, Math.PI / 2]) costura(g, [[X(a), Y(0.9)], [X(a), Y(1.39)]]);
    costura(g, [[0, Ym(0.19)], [W, Ym(0.19)]], 'rgba(0,0,0,0.25)');
    // basta
    const ybasta = tipo === 'camisa' ? 0.97 : 0.93;
    costura(g, [[0, Y(ybasta + 0.015)], [W, Y(ybasta + 0.015)]]);
    if (tipo === 'polera') {
      // emblema en el pecho izquierdo
      const ex = X(0.5), ey = Y(1.29);
      g.fillStyle = css(c, 1.9, 0.9); g.beginPath(); g.arc(ex, ey, 11, 0, TAU); g.fill();
      g.fillStyle = css(c, 0.6, 0.95); g.beginPath(); g.moveTo(ex - 7, ey + 5); g.lineTo(ex, ey - 7); g.lineTo(ex + 7, ey + 5); g.closePath(); g.fill();
      g.fillStyle = css(c, 1.9, 0.9); g.fillRect(ex - 2, ey, 4, 5);
    }
    if (tipo === 'camisa') {
      // tapeta con botones
      g.fillStyle = css(c, 0.9); g.fillRect(X(-0.03), Y(1.46), X(0.03) - X(-0.03), Y(0.96) - Y(1.46));
      costura(g, [[X(-0.03), Y(0.97)], [X(-0.03), Y(1.46)]]); costura(g, [[X(0.03), Y(0.97)], [X(0.03), Y(1.46)]]);
      for (let y = 1.03; y < 1.45; y += 0.083) {
        g.fillStyle = 'rgba(240,236,228,0.95)'; g.beginPath(); g.arc(X(0), Y(y), 3.6, 0, TAU); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X(0) - 1.5, Y(y) - 0.5, 3, 1);
      }
      // bolsillos con tapa
      for (const s of mujer ? [] : [-1, 1]) {
        const x0 = X(s * 0.3), x1 = X(s * 0.62), y0 = Y(1.33), y1 = Y(1.215);
        const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
        g.fillStyle = css(c, 0.96); g.fillRect(xa, y0, xb - xa, y1 - y0);
        costura(g, [[xa + 2, y0], [xa + 2, y1 - 2], [xb - 2, y1 - 2], [xb - 2, y0]]);
        g.fillStyle = css(c, 0.88); g.fillRect(xa - 1, y0 - 3, xb - xa + 2, 13);
        costura(g, [[xa, y0 + 9], [xb, y0 + 9]]);
        g.fillStyle = 'rgba(240,236,228,0.95)'; g.beginPath(); g.arc((xa + xb) / 2, y0 + 6, 3, 0, TAU); g.fill();
      }
    }
    if (tipo === 'parka') {
      // cierre central, bolsillos con cierre y cinta reflectante
      g.fillStyle = '#2a2a2c'; g.fillRect(X(-0.012), 0, X(0.012) - X(-0.012), Y(0.94));
      for (let y = 0; y < Y(0.94); y += 3) { g.fillStyle = 'rgba(190,190,195,0.8)'; g.fillRect(X(-0.01), y, X(0.01) - X(-0.01), 1.2); }
      for (const s of [-1, 1]) {
        g.strokeStyle = '#26262a'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(s * 0.25), Y(1.33)); g.lineTo(X(s * 0.55), Y(1.29)); g.stroke();
        g.strokeStyle = '#26262a'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(s * 0.4), Y(1.12)); g.lineTo(X(s * 0.55), Y(0.98)); g.stroke();
      }
      g.fillStyle = css(c, 0.82); g.fillRect(0, Y(1.47), W, Y(1.36) - Y(1.47)); // canesú
      for (const y of [1.06, 1.17]) { g.fillStyle = '#c9cdcf'; g.fillRect(0, Y(y + 0.025), W, Y(y) - Y(y + 0.025)); }
      for (const v of [0.07, 0.12]) { g.fillStyle = '#c9cdcf'; g.fillRect(0, Ym(v + 0.012), W, 6); }
    }
    // pliegues suaves
    for (let i = 0; i < 40; i++) {
      const x = rnd() * W, y = Y(0.95 + rnd() * 0.45);
      manchaRadial(g, x, y, 8 + rnd() * 18, 3 + rnd() * 5, `rgba(0,0,0,${0.03 + rnd() * 0.05})`);
    }
    return texDe(cv);
  });
}

function texturaInferior(tipo, color, semilla) {
  return enCache(`inf|${tipo}|${color}|${semilla % 3}`, () => {
    const W = 512, H = 512;
    const [cv, g] = lienzo(W, H);
    const rnd = azar(semilla * 5 + 2);
    const X = (u) => u * W, Yp = (y) => (1 - VP(y)) * H, Yl = (y) => (1 - VPel(y)) * H, Xa = (ang) => (0.5 + ang / TAU) * W;
    const c = new THREE.Color(color);
    g.fillStyle = css(c); g.fillRect(0, 0, W, H);
    if (tipo === 'jeans') {
      for (let y = 0; y < H; y += 2) for (let x = (y / 2) % 4; x < W; x += 4) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, y, 2, 1); }
      // desgaste en muslos y rodillas
      manchaRadial(g, X(0.5), Yp(0.72), 70, 90, 'rgba(210,225,240,0.17)');
      manchaRadial(g, X(0.5), Yp(0.5), 50, 30, 'rgba(210,225,240,0.14)');
      for (let i = 0; i < 8; i++) { g.strokeStyle = 'rgba(220,230,240,0.18)'; g.lineWidth = 2; g.beginPath(); const y = Yp(0.86 - i * 0.012); g.moveTo(X(0.44), y); g.lineTo(X(0.56), y - 6); g.stroke(); }
    }
    fibras(g, W, H, rnd, 24000, 0.06);
    // costuras exteriores e interiores de las piernas (la pierna izquierda se refleja: el lado exterior es siempre u = 0,25)
    costura(g, [[X(0.25), Yp(0.95)], [X(0.25), H]], tipo === 'jeans' ? 'rgba(200,140,60,0.7)' : 'rgba(0,0,0,0.3)');
    costura(g, [[X(0.75), Yp(0.82)], [X(0.75), H]], tipo === 'jeans' ? 'rgba(200,140,60,0.6)' : 'rgba(0,0,0,0.3)');
    costura(g, [[0, Yp(0.11)], [W, Yp(0.11)]], tipo === 'jeans' ? 'rgba(200,140,60,0.6)' : 'rgba(0,0,0,0.3)');
    if (tipo === 'trabajo') {
      // rodilleras y bolsillo cargo
      g.fillStyle = css(c, 0.78); g.fillRect(X(0.38), Yp(0.58), X(0.62) - X(0.38), Yp(0.43) - Yp(0.58));
      costura(g, [[X(0.385), Yp(0.575)], [X(0.615), Yp(0.575)], [X(0.615), Yp(0.435)], [X(0.385), Yp(0.435)], [X(0.385), Yp(0.575)]]);
      g.fillStyle = css(c, 0.92); g.fillRect(X(0.17), Yp(0.74), X(0.33) - X(0.17), Yp(0.6) - Yp(0.74));
      costura(g, [[X(0.175), Yp(0.735)], [X(0.325), Yp(0.735)], [X(0.325), Yp(0.605)], [X(0.175), Yp(0.605)], [X(0.175), Yp(0.735)]]);
      g.fillStyle = css(c, 0.84); g.fillRect(X(0.165), Yp(0.75), X(0.335) - X(0.165), 14);
    }
    if (tipo === 'tela') costura(g, [[X(0.5), Yp(0.95)], [X(0.5), H]], 'rgba(0,0,0,0.18)', 1.5, []);
    // pelvis: pretina, presillas, bragueta, bolsillos delanteros y traseros
    g.fillStyle = css(c, 0.92); g.fillRect(0, Yl(1.05), W, Yl(1.0) - Yl(1.05));
    costura(g, [[0, Yl(1.0)], [W, Yl(1.0)]]);
    for (const a of [-2.6, -1.6, -0.75, 0.75, 1.6, 2.6, Math.PI - 0.02]) { g.fillStyle = css(c, 0.8); g.fillRect(Xa(a) - 3, Yl(1.05), 6, Yl(0.995) - Yl(1.05)); }
    costura(g, [[Xa(0.0), Yl(1.0)], [Xa(0.0), Yl(0.88)]], tipo === 'jeans' ? 'rgba(200,140,60,0.7)' : 'rgba(0,0,0,0.3)');
    costura(g, [[Xa(0.07), Yl(1.0)], [Xa(0.07), Yl(0.9)], [Xa(0.0), Yl(0.87)]], tipo === 'jeans' ? 'rgba(200,140,60,0.7)' : 'rgba(0,0,0,0.3)');
    for (const s of [-1, 1]) {
      costura(g, [[Xa(s * 0.45), Yl(1.0)], [Xa(s * 0.62), Yl(0.95)], [Xa(s * 0.9), Yl(0.93)]], tipo === 'jeans' ? 'rgba(200,140,60,0.7)' : 'rgba(0,0,0,0.35)');
      const xa = Xa(s * (Math.PI - 0.62)), xb = Xa(s * (Math.PI - 0.22));
      const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
      g.fillStyle = css(c, 0.95); g.fillRect(x0, Yl(0.985), x1 - x0, Yl(0.88) - Yl(0.985));
      costura(g, [[x0 + 2, Yl(0.985)], [x0 + 2, Yl(0.895)], [(x0 + x1) / 2, Yl(0.88)], [x1 - 2, Yl(0.895)], [x1 - 2, Yl(0.985)]], tipo === 'jeans' ? 'rgba(200,140,60,0.75)' : 'rgba(0,0,0,0.35)');
    }
    for (let i = 0; i < 30; i++) manchaRadial(g, rnd() * W, Yp(0.1 + rnd() * 0.85), 6 + rnd() * 16, 2 + rnd() * 4, `rgba(0,0,0,${0.03 + rnd() * 0.05})`);
    return texDe(cv);
  });
}

function texturaChaleco(color) {
  return enCache('chaleco|' + color, () => {
    const W = 512, H = 512;
    const [cv, g] = lienzo(W, H);
    const rnd = azar(color.length * 7);
    const X = (ang) => (0.5 + ang / TAU) * W, Y = (y) => (1 - (y - 0.95) / 0.55) * H;
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    // malla del chaleco
    for (let y = 0; y < H; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < W; x += 4) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(x, y, 2, 2); }
    fibras(g, W, H, rnd, 6000, 0.08);
    const cinta = (x0, y0, x1, y1) => {
      g.fillStyle = '#d7dbdc'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.fillStyle = 'rgba(255,255,255,0.35)'; for (let x = x0; x < x1; x += 3) g.fillRect(x, y0, 1, y1 - y0);
      costura(g, [[x0, y0 + 2], [x1, y0 + 2]], 'rgba(0,0,0,0.3)'); costura(g, [[x0, y1 - 2], [x1, y1 - 2]], 'rgba(0,0,0,0.3)');
    };
    cinta(0, Y(1.105), W, Y(1.07));
    cinta(0, Y(1.215), W, Y(1.18));
    for (const a of [-0.55, 0.55, -2.55, 2.55]) cinta(X(a) - 9, Y(1.46), X(a) + 9, Y(1.0));
    // borde ribeteado y escote en V (transparente)
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    g.beginPath(); g.moveTo(X(-0.36), 0); g.lineTo(X(0), Y(1.2)); g.lineTo(X(0.36), 0); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = css(color, 0.72); g.lineWidth = 4;
    g.beginPath(); g.moveTo(X(-0.36), 0); g.lineTo(X(0), Y(1.2)); g.lineTo(X(0.36), 0); g.stroke();
    g.fillStyle = 'rgba(40,40,40,0.6)'; g.fillRect(0, Y(0.99), W, 6);
    return texDe(cv);
  });
}

// ------------------------------------------------------------------ geometría con piel
// Cada pieza lleva posición, normal, uv, color, skinIndex y skinWeight. Los pesos se dan por nombre de hueso.
function conAtributos(geo, pesos, idx, { uv = null, color = null } = {}) {
  if (geo.index === null) geo = geo; // todas las piezas son indexadas
  const n = geo.attributes.position.count;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (uv) { const a = new Float32Array(n * 2); for (let i = 0; i < n; i++) { a[i * 2] = uv[0]; a[i * 2 + 1] = uv[1]; } geo.setAttribute('uv', new THREE.BufferAttribute(a, 2)); }
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!geo.attributes.color) {
    const a = new Float32Array(n * 3), c = color ? new THREE.Color(color) : new THREE.Color(1, 1, 1);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  }
  if (!geo.attributes.skinIndex) {
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const p = geo.attributes.position;
    for (let i = 0; i < n; i++) {
      const w = typeof pesos === 'function' ? pesos(p.getX(i), p.getY(i), p.getZ(i)) : [[pesos, 1]];
      ponerPesos(si, sw, i, w, idx);
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  }
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].includes(k)) geo.deleteAttribute(k);
  return geo;
}
function ponerPesos(si, sw, i, w, idx) {
  let tot = 0;
  const lista = w.filter((e) => e[1] > 1e-4).slice(0, 4);
  for (const e of lista) tot += e[1];
  lista.forEach((e, k) => {
    const j = idx.get(e[0]);
    if (j === undefined) throw new Error('Hueso desconocido: ' + e[0]);
    si[i * 4 + k] = j; sw[i * 4 + k] = e[1] / tot;
  });
}
const mezclaPesos = (a, b, t) => (t <= 0 ? [[a, 1]] : t >= 1 ? [[b, 1]] : [[a, 1 - t], [b, t]]);

// Superficie por anillos. Cada anillo: { c: Vector3, a, b, w: pesos, m?: (ang) => factor, v?: coordenada v }.
// El anillo vive en el plano de ejeA (ang = π/2) y ejeB (ang = 0); la costura queda en ang = ±π.
function loft(anillos, idx, { seg = 24, ejeA = EJE_X, ejeB = EJE_Z, expo = 2, tapaIni = false, tapaFin = false, uFlip = false, uEsc = 1, color = null } = {}) {
  const pos = [], uv = [], ind = [], pesos = [];
  const k = 2 / expo, fila = seg + 1;
  anillos.forEach((r, i) => {
    for (let j = 0; j <= seg; j++) {
      const ang = -Math.PI + (TAU * j) / seg, s = Math.sin(ang), c = Math.cos(ang);
      const m = r.m ? r.m(ang) : 1;
      const sa = Math.sign(s) * Math.abs(s) ** k * r.a * m, sb = Math.sign(c) * Math.abs(c) ** k * r.b * m;
      pos.push(r.c.x + ejeA.x * sa + ejeB.x * sb, r.c.y + ejeA.y * sa + ejeB.y * sb + (r.dy ? r.dy(ang) : 0), r.c.z + ejeA.z * sa + ejeB.z * sb);
      uv.push((uFlip ? 1 - j / seg : j / seg) * uEsc, r.v ?? i / Math.max(1, anillos.length - 1));
      pesos.push(r.w);
    }
  });
  for (let i = 0; i < anillos.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * fila + j, b = (i + 1) * fila + j;
    ind.push(a, b, a + 1, b, b + 1, a + 1);
  }
  // orientación: las normales deben apuntar hacia afuera
  const mid = Math.floor((anillos.length - 1) / 2);
  {
    const a = mid * fila + Math.floor(seg / 4), b = a + fila, c = a + 1;
    const pa = V3(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]), pb = V3(pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]), pc = V3(pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]);
    const n = new THREE.Vector3().crossVectors(pb.clone().sub(pa), pc.clone().sub(pa));
    if (n.dot(pa.clone().sub(anillos[mid].c)) < 0) for (let t = 0; t < ind.length; t += 3) { const q = ind[t + 1]; ind[t + 1] = ind[t + 2]; ind[t + 2] = q; }
  }
  const tapa = (iAn, otro) => {
    const r = anillos[iAn], centro = pos.length / 3;
    pos.push(r.c.x, r.c.y, r.c.z); uv.push(0.5 * uEsc, r.v ?? 0); pesos.push(r.w);
    const dirAfuera = r.c.clone().sub(anillos[otro].c);
    const t0 = ind.length;
    for (let j = 0; j < seg; j++) ind.push(centro, iAn * fila + j, iAn * fila + j + 1);
    const pa = V3(pos[centro * 3], pos[centro * 3 + 1], pos[centro * 3 + 2]);
    const pb = V3(...pos.slice(ind[t0 + 1] * 3, ind[t0 + 1] * 3 + 3)), pc = V3(...pos.slice(ind[t0 + 2] * 3, ind[t0 + 2] * 3 + 3));
    const n = new THREE.Vector3().crossVectors(pb.sub(pa), pc.sub(pa));
    if (n.dot(dirAfuera) < 0) for (let t = t0; t < ind.length; t += 3) { const q = ind[t + 1]; ind[t + 1] = ind[t + 2]; ind[t + 2] = q; }
  };
  if (tapaIni) tapa(0, 1);
  if (tapaFin) tapa(anillos.length - 1, anillos.length - 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(ind);
  geo.computeVertexNormals();
  coserNormales(geo, anillos.length, fila, seg);
  const n = pos.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  pesos.forEach((w, i) => ponerPesos(si, sw, i, w, idx));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return conAtributos(geo, null, idx, { color });
}
function coserNormales(geo, filas, fila, seg) {
  const nr = geo.attributes.normal;
  for (let i = 0; i < filas; i++) {
    const a = i * fila, b = i * fila + seg;
    const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1;
    nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l);
  }
}

// Malla de parámetros (u, v) ∈ [0,1]²; f devuelve { p: Vector3, uv: [u, v], w } o null para omitir la celda
function rejilla(nu, nv, f, idx, { cerrarU = false, afuera = null, color = null, omitir = null } = {}) {
  const pos = [], uv = [], pesos = [], ind = [], fila = nu + 1;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const r = f(i / nu, j / nv);
    pos.push(r.p.x, r.p.y, r.p.z); uv.push(r.uv[0], r.uv[1]); pesos.push(r.w);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    if (omitir && omitir((i + 0.5) / nu, (j + 0.5) / nv)) continue;
    const a = j * fila + i, b = a + fila;
    ind.push(a, a + 1, b, a + 1, b + 1, b);
  }
  if (afuera && ind.length) {
    const t = Math.floor(ind.length / 6) * 3;
    const pa = V3(...pos.slice(ind[t] * 3, ind[t] * 3 + 3)), pb = V3(...pos.slice(ind[t + 1] * 3, ind[t + 1] * 3 + 3)), pc = V3(...pos.slice(ind[t + 2] * 3, ind[t + 2] * 3 + 3));
    const n = new THREE.Vector3().crossVectors(pb.clone().sub(pa), pc.clone().sub(pa));
    if (n.dot(afuera(pa)) < 0) for (let k = 0; k < ind.length; k += 3) { const q = ind[k + 1]; ind[k + 1] = ind[k + 2]; ind[k + 2] = q; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(ind);
  geo.computeVertexNormals();
  if (cerrarU) {
    const nr = geo.attributes.normal;
    for (let j = 0; j <= nv; j++) {
      const a = j * fila, b = j * fila + nu;
      const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1;
      nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l);
    }
  }
  const n = pos.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  pesos.forEach((w, i) => ponerPesos(si, sw, i, w, idx));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return conAtributos(geo, null, idx, { color });
}

// Tubo de radio variable a lo largo de una curva (cola de pelo, cables)
function tuboVariable(curva, radio, idx, pesos, { seg = 10, pasos = 16, uv = null } = {}) {
  const fr = curva.computeFrenetFrames(pasos, false);
  const pos = [], ind = [], fila = seg + 1;
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos, p = curva.getPointAt(t), r = radio(t), N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU, c = Math.cos(a), s = Math.sin(a);
      pos.push(p.x + r * (c * N.x + s * B.x), p.y + r * (c * N.y + s * B.y), p.z + r * (c * N.z + s * B.z));
    }
  }
  for (let i = 0; i < pasos; i++) for (let j = 0; j < seg; j++) { const a = i * fila + j, b = a + fila; ind.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(ind);
  geo.computeVertexNormals();
  // orientación hacia afuera
  const nr = geo.attributes.normal, p0 = curva.getPointAt(0.5), q = V3(pos[(pasos / 2) * fila * 3], pos[(pasos / 2) * fila * 3 + 1], pos[(pasos / 2) * fila * 3 + 2]);
  const n0 = V3(nr.getX((pasos / 2) * fila), nr.getY((pasos / 2) * fila), nr.getZ((pasos / 2) * fila));
  if (n0.dot(q.sub(p0)) < 0) { for (let k = 0; k < ind.length; k += 3) { const x = ind[k + 1]; ind[k + 1] = ind[k + 2]; ind[k + 2] = x; } geo.setIndex(ind); geo.computeVertexNormals(); }
  if (!uv) {
    const a = new Float32Array((pos.length / 3) * 2);
    for (let i = 0; i <= pasos; i++) for (let j = 0; j <= seg; j++) { a[(i * fila + j) * 2] = j / seg; a[(i * fila + j) * 2 + 1] = i / pasos; }
    geo.setAttribute('uv', new THREE.BufferAttribute(a, 2));
  }
  return conAtributos(geo, pesos, idx, { uv });
}

// ------------------------------------------------------------------ poses
// Cada pose asigna a un hueso [x, y, z] en radianes. Brazos y piernas usan el orden 'XZY' (primero el giro sobre el
// eje del miembro, después la separación y al final la flexión). Lado derecho de la persona = D (x < 0).
// Brazo D: x < 0 lo lleva hacia adelante, z < 0 lo separa del cuerpo. Codo: x < 0 flexiona. Muslo: x < 0 adelante.
// Rodilla: x > 0 flexiona. Columna, cuello y cabeza: x > 0 inclina adelante, y > 0 gira hacia la izquierda.
// Claves especiales: _pos [x, y, z] desplaza la cadera; dedosD / dedosI de 0 (estirados) a 1 (puño), o { c, indice };
// ikD / ikI { p: [x, y, z] en coordenadas de la persona, polo: [x, y, z] dirección del codo, w: peso }.
function simetrica(der, extra = {}) {
  const p = { ...der };
  for (const [k, v] of Object.entries(der)) {
    if (!Array.isArray(v) || k.startsWith('_')) continue;
    if (/D$/.test(k)) p[k.slice(0, -1) + 'I'] = [v[0], -v[1], -v[2]];
  }
  if (der.dedosD !== undefined && p.dedosI === undefined) p.dedosI = der.dedosD;
  return { ...p, ...extra };
}

export const POSES = {
  reposo: () => simetrica({
    columna: [0.02, 0, 0], pecho: [-0.03, 0, 0], cuello: [0.06, 0, 0], cabeza: [-0.05, 0, 0],
    brazoD: [0.06, 0, -0.07], antebrazoD: [-0.28, 0, 0], manoD: [0, 0, 0.1], dedosD: 0.22,
    musloD: [0, 0, -0.03], piernaD: [0.025, 0, 0], pieD: [-0.02, 0, 0.03],
  }),
  firme: () => simetrica({ brazoD: [0.03, 0, -0.04], antebrazoD: [-0.12, 0, 0], dedosD: 0.15, musloD: [0, 0, -0.02], pieD: [0, 0, 0.02] }),
  jarras: () => simetrica({
    columna: [0.0, 0, 0], pecho: [-0.04, 0, 0], brazoD: [0.25, 0.4, -0.55], antebrazoD: [-1.55, 0, 0], manoD: [0.3, 0, -0.2], dedosD: 0.35,
    musloD: [0, 0, -0.07], pieD: [0, 0, 0.07],
  }),
  brazosCruzados: () => ({
    ...simetrica({ pecho: [-0.03, 0, 0], musloD: [0, 0, -0.05], pieD: [0, 0, 0.05], dedosD: 0.5 }),
    brazoD: [-0.35, 0.1, -0.05], antebrazoD: [-1.95, 0.9, 0], manoD: [0, 0, 0.2],
    brazoI: [-0.42, -0.1, 0.12], antebrazoI: [-1.85, -0.9, 0], manoI: [0, 0, -0.2],
  }),
  tableta: () => simetrica({
    cuello: [0.25, 0, 0], cabeza: [0.2, 0, 0],
    brazoD: [-0.32, 0.3, -0.12], antebrazoD: [-1.25, 0, 0], manoD: [0, 0, 0.25], dedosD: 0.45,
    musloD: [0, 0, -0.04], pieD: [0, 0, 0.04],
  }),
  alarma: () => simetrica({
    columna: [-0.06, 0, 0], pecho: [-0.08, 0, 0], cuello: [-0.12, 0, 0],
    brazoD: [-0.55, -0.9, -1.15], antebrazoD: [-2.2, 0, 0], manoD: [0, 0, 0.2], dedosD: 0.2,
    musloD: [0.08, 0, -0.08], piernaD: [0.12, 0, 0], pieD: [-0.06, 0, 0.08],
  }),
  sentado: (asiento = 0.46) => simetrica({
    _pos: [0, asiento + 0.068 - 0.928, -0.07],
    columna: [0.04, 0, 0], pecho: [0.02, 0, 0], cuello: [0.05, 0, 0],
    musloD: [-1.52, 0, -0.06], piernaD: [1.5, 0, 0], pieD: [0.02, 0, 0.06],
    brazoD: [-0.42, 0, -0.12], antebrazoD: [-0.95, 0, 0], manoD: [0.1, 0, 0.1], dedosD: 0.3,
  }),
  conducir: (asiento = 0.33) => simetrica({
    _pos: [0, asiento + 0.105 - 0.928, -0.07],
    columna: [-0.12, 0, 0], pecho: [0.04, 0, 0], cuello: [0.06, 0, 0],
    musloD: [-1.45, 0, -0.06], piernaD: [0.75, 0, 0], pieD: [-0.42, 0, 0.05],
    brazoD: [-0.95, 0, -0.18], antebrazoD: [-0.55, 0, 0], manoD: [0, 0, 0.1], dedosD: 0.75,
  }),
  agachado: () => simetrica({
    _pos: [0, -0.42, -0.08], columna: [0.35, 0, 0], pecho: [0.25, 0, 0], cuello: [-0.25, 0, 0], cabeza: [-0.1, 0, 0],
    musloD: [-1.95, 0, -0.22], piernaD: [2.25, 0, 0], pieD: [-0.3, 0, 0.12],
    brazoD: [-0.9, 0, -0.1], antebrazoD: [-0.4, 0, 0], dedosD: 0.3,
  }),
  apoyado: () => simetrica({ columna: [0.32, 0, 0], pecho: [0.18, 0, 0], cuello: [-0.2, 0, 0], brazoD: [-0.95, 0, -0.05], antebrazoD: [-0.35, 0, 0], manoD: [-0.6, 0, 0], dedosD: 0.15 }),
};

// Postura para lanzar: pie izquierdo adelante, la piedra en la mano derecha
const PIES_LANCE = { musloI: [-0.24, 0, 0.07], piernaI: [0.12, 0, 0], pieI: [0.1, 0, -0.06], musloD: [0.15, 0, -0.08], piernaD: [0.1, 0, 0], pieD: [-0.17, 0, 0.07] };

export const CLIPS = {
  // Lanzamiento por sobre el hombro. El evento «suelta» marca el instante en que la piedra sale de la mano derecha.
  lanzar: {
    duracion: 2.1, eventos: { suelta: 0.8 },
    claves: [
      { t: 0, pose: { ...POSES.reposo(), ...PIES_LANCE, cadera: [0, -0.1, 0], brazoD: [-0.35, 0, -0.16], antebrazoD: [-1.25, 0, 0], manoD: [0, 0, 0.15], dedosD: 0.85 } },
      { t: 0.52, pose: {
        ...PIES_LANCE, _pos: [0, -0.02, -0.05], cadera: [0, -0.42, 0], columna: [-0.07, -0.14, 0], pecho: [-0.08, -0.2, 0.05], cuello: [0, 0.3, 0], cabeza: [0, 0.32, 0],
        brazoD: [0.25, -1.45, -1.45], antebrazoD: [-1.75, 0, 0], manoD: [0, 0, -0.45], dedosD: 0.85,
        brazoI: [-1.25, 0, 0.25], antebrazoI: [-0.2, 0, 0], dedosI: 0.15,
        musloD: [0.1, 0, -0.1], piernaD: [0.28, 0, 0], musloI: [-0.34, 0, 0.07], piernaI: [0.05, 0, 0] } },
      { t: 0.8, pose: {
        ...PIES_LANCE, _pos: [0, -0.03, 0.06], cadera: [0, 0.16, 0], columna: [0.13, 0.1, 0], pecho: [0.12, 0.2, 0], cuello: [0, -0.16, 0], cabeza: [-0.05, -0.16, 0],
        brazoD: [-2.3, -0.9, -0.38], antebrazoD: [-0.45, 0, 0], manoD: [0, 0, 0.2], dedosD: 0.75,
        brazoI: [0.2, 0, 0.35], antebrazoI: [-0.9, 0, 0], dedosI: 0.3,
        musloI: [-0.36, 0, 0.07], piernaI: [0.28, 0, 0], musloD: [0.26, 0, -0.08], piernaD: [0.25, 0, 0], pieD: [0.45, 0, 0.07] } },
      { t: 1.15, pose: {
        ...PIES_LANCE, _pos: [0, -0.04, 0.08], cadera: [0, 0.34, 0], columna: [0.26, 0.1, 0], pecho: [0.2, 0.15, 0], cuello: [-0.1, -0.2, 0], cabeza: [-0.1, -0.2, 0],
        brazoD: [-0.75, -0.3, 0.42], antebrazoD: [-0.5, 0, 0], manoD: [0, 0, 0.3], dedosD: 0.15,
        brazoI: [0.35, 0, 0.2], antebrazoI: [-0.6, 0, 0], dedosI: 0.3,
        musloD: [0.2, 0, -0.06], piernaD: [0.5, 0, 0], pieD: [0.6, 0, 0.07] } },
      { t: 2.1, pose: { ...POSES.reposo(), ...PIES_LANCE } },
    ],
  },
  // Caminar en el lugar (el desplazamiento lo pone quien lo usa). Un ciclo = dos pasos de 0,7 m.
  caminar: {
    duracion: 1.1, bucle: true,
    fn(t) {
      const w = (TAU * t) / 1.1, s = Math.sin(w), c = Math.cos(w);
      return simetrica({
        cuello: [0.05, 0, 0], cabeza: [-0.04, 0, 0],
        manoD: [0, 0, 0.1], dedosD: 0.25,
      }, {
        _pos: [0, -0.012 + 0.014 * Math.cos(2 * w), 0], cadera: [0, 0.08 * s, 0.03 * c], pecho: [-0.02, -0.12 * s, 0],
        musloD: [-0.42 * s, 0, -0.03], musloI: [0.42 * s, 0, 0.03],
        piernaD: [0.08 + 0.7 * Math.max(0, c) ** 1.4, 0, 0], piernaI: [0.08 + 0.7 * Math.max(0, -c) ** 1.4, 0, 0],
        pieD: [-0.28 * Math.max(0, c) + 0.12 * Math.max(0, -s), 0, 0.03], pieI: [-0.28 * Math.max(0, -c) + 0.12 * Math.max(0, s), 0, -0.03],
        brazoD: [0.32 * s, 0, -0.07], brazoI: [-0.32 * s, 0, 0.07],
        antebrazoD: [-0.35 - 0.2 * Math.max(0, -s), 0, 0], antebrazoI: [-0.35 - 0.2 * Math.max(0, s), 0, 0],
      });
    },
  },
  // Palear: la mano derecha toma el mango cerca de la hoja y la izquierda el puño. Evento «lanza» al soltar la carga.
  palear: {
    duracion: 2.8, bucle: true, eventos: { carga: 0.9, lanza: 1.95 },
    claves: (() => {
      const agachado = (ex) => ({ ...POSES.reposo(), dedosD: 0.92, dedosI: 0.92, ...ex });
      const k0 = agachado({ _pos: [0, -0.1, -0.06], cadera: [0.55, 0, 0], columna: [0.22, 0, 0], pecho: [0.1, 0, 0], cuello: [-0.3, 0, 0], cabeza: [-0.2, 0, 0],
        musloD: [-0.45, 0, -0.1], piernaD: [0.7, 0, 0], pieD: [-0.2, 0, 0.08], musloI: [-0.15, 0, 0.1], piernaI: [0.4, 0, 0], pieI: [-0.2, 0, -0.08],
        ikD: { p: [-0.06, 0.4, 0.6], polo: [-1, -0.4, -0.2] }, ikI: { p: [0.1, 0.8, 0.18], polo: [1, -0.6, -0.4] } });
      return [
        { t: 0, pose: k0 },
        { t: 0.9, pose: agachado({ _pos: [0, -0.12, 0.0], cadera: [0.62, 0, 0], columna: [0.24, 0, 0], pecho: [0.1, 0, 0], cuello: [-0.32, 0, 0], cabeza: [-0.2, 0, 0],
          musloD: [-0.55, 0, -0.1], piernaD: [0.8, 0, 0], pieD: [-0.22, 0, 0.08], musloI: [-0.1, 0, 0.1], piernaI: [0.45, 0, 0], pieI: [-0.22, 0, -0.08],
          ikD: { p: [-0.06, 0.3, 0.75], polo: [-1, -0.4, -0.2] }, ikI: { p: [0.08, 0.7, 0.32], polo: [1, -0.6, -0.4] } }) },
        { t: 1.55, pose: agachado({ _pos: [0, -0.04, -0.02], cadera: [0.25, -0.2, 0], columna: [0.1, -0.1, 0], pecho: [0.04, -0.12, 0], cuello: [-0.1, 0.15, 0],
          musloD: [-0.2, 0, -0.08], piernaD: [0.3, 0, 0], musloI: [-0.08, 0, 0.08], piernaI: [0.2, 0, 0],
          ikD: { p: [-0.14, 0.98, 0.45], polo: [-1, -0.5, -0.2] }, ikI: { p: [0.1, 0.98, 0.02], polo: [1, -0.6, -0.4] } }) },
        { t: 1.95, pose: agachado({ _pos: [0, -0.03, -0.02], cadera: [0.2, -0.55, 0], columna: [0.08, -0.22, 0], pecho: [0.04, -0.3, 0], cuello: [-0.05, 0.35, 0],
          musloD: [-0.12, 0, -0.08], piernaD: [0.25, 0, 0], musloI: [-0.05, 0, 0.08], piernaI: [0.2, 0, 0],
          ikD: { p: [-0.5, 1.12, 0.32], polo: [-0.6, -0.6, -0.4] }, ikI: { p: [-0.12, 1.05, -0.02], polo: [1, -0.6, -0.4] } }) },
        { t: 2.8, pose: k0 },
      ];
    })(),
  },
  // Saludo con la mano derecha
  saludar: {
    duracion: 1.8,
    claves: [
      { t: 0, pose: POSES.reposo() },
      { t: 0.35, pose: { ...POSES.reposo(), brazoD: [-0.3, -1.2, -1.25], antebrazoD: [-1.9, 0, 0], manoD: [0, 0, -0.2], dedosD: 0.05 } },
      { t: 0.6, pose: { ...POSES.reposo(), brazoD: [-0.3, -1.2, -1.25], antebrazoD: [-1.6, 0, 0], manoD: [0, 0, -0.2], dedosD: 0.05 } },
      { t: 0.85, pose: { ...POSES.reposo(), brazoD: [-0.3, -1.2, -1.25], antebrazoD: [-2.0, 0, 0], manoD: [0, 0, -0.2], dedosD: 0.05 } },
      { t: 1.1, pose: { ...POSES.reposo(), brazoD: [-0.3, -1.2, -1.25], antebrazoD: [-1.6, 0, 0], manoD: [0, 0, -0.2], dedosD: 0.05 } },
      { t: 1.8, pose: POSES.reposo() },
    ],
  },
};

// Interpolación de poses
function mezclarPoses(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const out = {};
  const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of claves) {
    const va = a[k], vb = b[k];
    if (k === 'ikD' || k === 'ikI') {
      const wa = va ? va.w ?? 1 : 0, wb = vb ? vb.w ?? 1 : 0;
      const pa = va?.p ?? vb.p, pb = vb?.p ?? va.p, la = va?.polo ?? vb.polo, lb = vb?.polo ?? va.polo;
      out[k] = { p: pa.map((v, i) => lerp(v, pb[i], t)), polo: la.map((v, i) => lerp(v, lb[i], t)), w: lerp(wa, wb, t) };
    } else if (k.startsWith('dedos')) {
      const ca = typeof va === 'object' ? va.c : va ?? 0.22, cb = typeof vb === 'object' ? vb.c : vb ?? 0.22;
      const ia = typeof va === 'object' ? va.indice ?? ca : ca, ib = typeof vb === 'object' ? vb.indice ?? cb : cb;
      out[k] = { c: lerp(ca, cb, t), indice: lerp(ia, ib, t) };
    } else if (Array.isArray(va) || Array.isArray(vb)) {
      const x = va || [0, 0, 0], y = vb || [0, 0, 0];
      out[k] = [lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)];
    }
  }
  return out;
}
function catmullPoses(p0, p1, p2, p3, t) {
  // Catmull-Rom componente a componente, cayendo a lineal en las claves especiales
  const out = mezclarPoses(p1, p2, t);
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (const k of Object.keys(out)) {
    if (!Array.isArray(out[k])) continue;
    const g = (p) => p[k] || p1[k] || p2[k] || [0, 0, 0];
    const A = g(p0), B = g(p1), C = g(p2), D = g(p3);
    out[k] = [0, 1, 2].map((i) => cr(A[i], B[i], C[i], D[i]));
  }
  return out;
}

const ORDEN_MIEMBRO = /^(brazo|antebrazo|muslo)/;

// ------------------------------------------------------------------ construcción de la persona
export function crearHumano(opciones = {}) {
  const sem = opciones.semilla ?? 1;
  const rnd = azar(sem * 97 + 13);
  const preset = PRESETS[opciones.preset] ?? {};
  const o = { ...preset, ...opciones };
  const mujer = !!o.mujer;
  const F = proporciones(mujer);
  const altura = o.altura ?? (mujer ? 1.62 + rnd() * 0.08 : 1.7 + rnd() * 0.1);
  const piel = o.piel ?? PIELES[1 + Math.floor(rnd() * 4)];
  const colorPelo = o.colorPelo ?? [PELOS.negro, PELOS.castanoOscuro, PELOS.castano, PELOS.castanoClaro][Math.floor(rnd() * 4)];
  const estiloPelo = o.pelo ?? (mujer ? 'cola' : ['corto', 'corto', 'rapado', 'entradas'][Math.floor(rnd() * 4)]);
  const barba = mujer ? 'no' : o.barba ?? ['no', 'sombra', 'sombra', 'barba', 'bigote'][Math.floor(rnd() * 5)];
  const colorOjos = o.ojos ?? [OJOS.cafe, OJOS.cafeOscuro, OJOS.cafe, OJOS.avellana][Math.floor(rnd() * 4)];
  const superior = o.superior ?? 'polera';
  const inferior = o.inferior ?? 'jeans';
  const calzado = o.calzado ?? 'zapatillas';
  const manga = o.manga ?? (superior === 'polera' ? 'corta' : 'larga');
  const fajada = o.fajada ?? superior === 'camisa';
  const colorSup = o.colorSuperior ?? '#3e5a74';
  const colorInf = o.colorInferior ?? (inferior === 'jeans' ? '#34465f' : '#3a3d42');

  // ---------------- cabeza y ojos
  const HC = V3(0, F.yCabeza + (mujer ? 0.059 : 0.063), 0.017); // centro de la cabeza
  const cab = formaCabeza(F.cabeza);
  const ojo = {};
  for (const [L, s] of [['D', -1], ['I', 1]]) {
    const th = s * 0.43, ph = 0.075;
    const p = cab.punto(th, ph, false), n = cab.normal(th, ph);
    ojo[L] = p.addScaledVector(n, -0.0099).add(HC);
  }

  // ---------------- esqueleto
  const def = [];
  const add = (n, p, v) => def.push({ n, p, pos: v });
  add('raiz', null, V3());
  add('cadera', 'raiz', V3(0, F.yCadera, 0));
  add('columna', 'cadera', V3(0, F.yColumna, -0.005));
  add('pecho', 'columna', V3(0, F.yPecho, 0));
  add('cuello', 'pecho', V3(0, F.yCuello, -0.012));
  add('cabeza', 'cuello', V3(0, F.yCabeza, -0.004));
  const DEDOS = [
    { n: 'indice', y: -0.094, z: 0.028, l1: 0.042, l2: 0.036, r: 0.0088 },
    { n: 'medio', y: -0.097, z: 0.009, l1: 0.046, l2: 0.04, r: 0.0091 },
    { n: 'anular', y: -0.094, z: -0.009, l1: 0.043, l2: 0.037, r: 0.0086 },
    { n: 'menique', y: -0.088, z: -0.025, l1: 0.034, l2: 0.029, r: 0.0075 },
  ];
  const km = F.gMano;
  const muneca = {}, pulgarDir = {};
  for (const [L, s] of [['D', -1], ['I', 1]]) {
    add('ojo' + L, 'cabeza', ojo[L].clone());
    add('parpado' + L, 'cabeza', ojo[L].clone());
    add('clavicula' + L, 'pecho', V3(s * 0.025, F.yHombro + 0.01, -0.01));
    add('brazo' + L, 'clavicula' + L, V3(s * F.xHombro, F.yHombro, F.zHombro));
    add('antebrazo' + L, 'brazo' + L, V3(s * F.xCodo, F.yCodo, F.zCodo));
    const W = V3(s * F.xMuneca, F.yMuneca, F.zMuneca);
    muneca[L] = W;
    add('mano' + L, 'antebrazo' + L, W.clone());
    for (const d of DEDOS) {
      const b = V3(W.x, W.y + d.y * km, W.z + d.z * km);
      add(d.n + L + '1', 'mano' + L, b.clone());
      add(d.n + L + '2', d.n + L + '1', b.clone().add(V3(0, -d.l1 * km, 0)));
    }
    const pb = V3(W.x - s * 0.011 * km, W.y - 0.028 * km, W.z + 0.026 * km);
    pulgarDir[L] = V3(-s * 0.3, -0.72, 0.62).normalize();
    add('pulgar' + L + '1', 'mano' + L, pb.clone());
    add('pulgar' + L + '2', 'pulgar' + L + '1', pb.clone().addScaledVector(pulgarDir[L], 0.036 * km));
    add('muslo' + L, 'cadera', V3(s * F.xCadera, F.yMuslo, 0));
    add('pierna' + L, 'muslo' + L, V3(s * (F.xCadera + 0.006), F.yRodilla, 0.006));
    add('pie' + L, 'pierna' + L, V3(s * (F.xCadera + 0.008), F.yTobillo, -0.025));
    add('punta' + L, 'pie' + L, V3(s * (F.xCadera + 0.014), 0.025, 0.118));
  }
  const idx = new Map(def.map((d, i) => [d.n, i]));
  const bind = new Map(def.map((d) => [d.n, d.pos]));
  const huesos = {};
  const listaHuesos = def.map((d) => {
    const b = new THREE.Bone(); b.name = d.n; huesos[d.n] = b;
    if (d.p) { b.position.copy(d.pos).sub(bind.get(d.p)); huesos[d.p].add(b); } else b.position.copy(d.pos);
    if (ORDEN_MIEMBRO.test(d.n)) b.rotation.order = 'XZY';
    else if (!/^(indice|medio|anular|menique|pulgar|mano|pie|punta|ojo|parpado)/.test(d.n)) b.rotation.order = 'YXZ';
    return b;
  });

  // ---------------- piezas
  const piezas = {}; // material → geometrías
  const poner = (mat, geo) => { (piezas[mat] ||= []).push(geo); };
  const P = (n) => bind.get(n);

  // Tronco: pantalón (pelvis) y prenda superior
  const tronco = (y) => tablaEn(F.torso, y);
  const pesoTronco = (y) => {
    if (y < 0.98) return [['cadera', 1]];
    if (y < 1.12) return mezclaPesos('cadera', 'columna', sstep(0.98, 1.12, y));
    if (y < 1.25) return mezclaPesos('columna', 'pecho', sstep(1.12, 1.25, y));
    if (y < 1.44) return [['pecho', 1]];
    return [['pecho', 0.7], ['cuello', 0.3]];
  };
  const formaTronco = (y) => {
    const fila = F.torso.find((r) => Math.abs(r[0] - y) < 1e-6);
    const busto = mujer ? Math.max(0, tablaEn(F.torso.map((r) => [r[0], r[4] ?? 0]), y)[0]) : Math.max(0, tablaEn(F.torso.map((r) => [r[0], r[4] ?? 0]), y)[0]);
    void fila;
    return (ang) => {
      let m = 1;
      if (busto > 0) m += busto * (Math.exp(-((ang - 0.48) ** 2) / 0.09) + Math.exp(-((ang + 0.48) ** 2) / 0.09)) * (mujer ? 1 : 0.5);
      m -= 0.04 * Math.exp(-((Math.abs(ang) - Math.PI) ** 2) / 0.5) * sstep(1.1, 1.3, y); // espalda más plana
      return m;
    };
  };
  const anilloTronco = (y, esc = 1, v = null) => {
    const [zc, ax, az] = tronco(y);
    return { c: V3(0, y, zc), a: ax * esc, b: az * esc, w: pesoTronco(y), m: formaTronco(y), v: v ?? VS(y), dy: escote(y) };
  };
  // el borde del tronco sube por la espalda: el cuello nace más alto atrás que adelante
  const escote = (y) => (y < 1.38 ? null : (ang) => -0.018 * Math.cos(ang) * sstep(1.38, 1.46, y));
  const alturas = (y0, y1, paso) => { const r = []; for (let y = y0; y < y1 - 1e-6; y += paso) r.push(y); r.push(y1); return r; };
  // pelvis con pantalón (de la entrepierna a la pretina)
  {
    const ys = [0.815, 0.83, ...alturas(0.845, 1.05, 0.023)];
    const an = ys.map((y) => ({ ...anilloTronco(y, y > 0.995 ? 1.025 : 1), v: VPel(y) }));
    poner('inferior', loft(an, idx, { seg: 32, expo: 2.4, tapaIni: true, tapaFin: false }));
  }
  // prenda superior
  {
    const y0 = fajada ? 1.0 : 0.925;
    const ys = alturas(y0, 1.47, 0.022);
    const holgura = superior === 'parka' ? 1.07 : superior === 'camisa' ? 1.035 : 1.03;
    const an = ys.map((y, i) => anilloTronco(y, holgura * (i === 0 ? 1.03 : 1)));
    poner('superior', loft(an, idx, { seg: 32, expo: 2.4, tapaFin: true }));
    // cuello de la prenda
    const yc = F.yCuello;
    const rc = superior === 'camisa' ? [[yc - 0.012, 1.32], [yc + 0.012, 1.3], [yc + 0.035, 1.38]] : superior === 'parka' ? [[yc - 0.01, 1.45], [yc + 0.03, 1.42], [yc + 0.07, 1.45]] : [[yc - 0.006, 1.28], [yc + 0.008, 1.25], [yc + 0.016, 1.27]];
    const anC = rc.map(([y, k]) => ({ c: V3(0, y, -0.012 + (y - yc) * 0.3), a: 0.058 * F.gCuello * k, b: 0.064 * F.gCuello * k, w: [['pecho', 0.6], ['cuello', 0.4]], v: 0.1, dy: (ang) => -0.02 * Math.cos(ang) }));
    poner('superior', loft(anC, idx, { seg: 28 }));
    // cinturón
    if (fajada || o.cinturon) {
      const an2 = [1.005, 1.012, 1.037, 1.044].map((y, i) => { const r = anilloTronco(y, [1.04, 1.06, 1.06, 1.04][i]); r.w = [['cadera', 1]]; return r; });
      poner('oscuro', loft(an2, idx, { seg: 32, expo: 2.4 }));
      const hebilla = new THREE.BoxGeometry(0.05, 0.034, 0.008); hebilla.translate(0, 1.024, tronco(1.024)[0] + tronco(1.024)[2] * 1.06 + 0.002);
      poner('metal', conAtributos(hebilla, 'cadera', idx));
    }
  }
  // chaleco reflectante
  if (o.chaleco) {
    const ys = alturas(0.975, 1.45, 0.025);
    const an = ys.map((y) => { const r = anilloTronco(y, (superior === 'parka' ? 1.1 : 1.07) * (y > 1.43 ? 0.97 : 1)); r.v = clamp((y - 0.95) / 0.55, 0, 1); return r; });
    poner('chaleco', loft(an, idx, { seg: 32, expo: 2.4 }));
  }

  // Cuello
  {
    const kc = F.gCuello * 1.12;
    const cy = [[F.yCuello - 0.035, 0.057, 0.06, -0.014, [['pecho', 1]]], [F.yCuello + 0.015, 0.052, 0.056, -0.012, [['pecho', 0.45], ['cuello', 0.55]]],
      [F.yCuello + 0.065, 0.05, 0.053, -0.008, [['cuello', 1]]], [F.yCabeza + 0.02, 0.05, 0.055, -0.004, [['cuello', 0.5], ['cabeza', 0.5]]],
      [F.yCabeza + 0.055, 0.046, 0.05, 0.0, [['cabeza', 1]]]];
    const an = cy.map(([y, a, b, z, w], i) => ({ c: V3(0, y, z), a: a * kc, b: b * kc, w, m: !mujer && i === 2 ? (ang) => 1 + 0.12 * Math.exp(-(ang * ang) / 0.05) : null }));
    const geo = loft(an, idx, { seg: 24 });
    poner('piel', conAtributos(geo, null, idx, { uv: ATLAS.piel }));
    // (el uv se reemplaza por la piel lisa del atlas)
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, ATLAS.piel[0], ATLAS.piel[1]);
  }

  // Cabeza
  {
    const geo = rejilla(72, 54, (u, v) => {
      const th = -Math.PI + TAU * u, ph = -Math.PI / 2 + Math.PI * v;
      return { p: cab.punto(th, ph).add(HC), uv: [u, v], w: [['cabeza', 1]] };
    }, idx, { cerrarU: true, afuera: (p) => p.clone().sub(HC) });
    poner('piel', geo);
    // nariz
    const nariz = rejilla(16, 26, (u, v) => {
      const t = u * 2 - 1, s = v * 1.0;
      let ph, pr;
      if (s <= 0.85) { const q = s / 0.85; ph = lerp(0.1, -0.2, q); pr = 0.002 + 0.0175 * q ** 1.45; }
      else { const q = (s - 0.85) / 0.15; ph = -0.2 - 0.065 * Math.sin((q * Math.PI) / 2); pr = 0.0195 * Math.max(0, Math.cos((Math.min(1, q) * Math.PI) / 2)) ** 0.7; }
      const ancho = 0.04 + 0.055 * s + 0.1 * Math.exp(-((s - 0.87) ** 2) / 0.006);
      const th = t * ancho;
      const ala = 0.004 * Math.exp(-((Math.abs(t) - 0.72) ** 2) / 0.02) * Math.exp(-((s - 0.86) ** 2) / 0.004);
      const perfil = pr * Math.pow(Math.max(0, 1 - Math.abs(t) ** 2.2), 0.55) + ala;
      const p = cab.punto(th, ph, false).add(cab.normal(th, ph).multiplyScalar(perfil)).add(HC);
      return { p, uv: [0.5 + th / TAU, 0.5 + ph / Math.PI], w: [['cabeza', 1]] };
    }, idx, { afuera: () => V3(0, 0, 1) });
    poner('piel', nariz);
    // orejas
    for (const [L, s] of [['D', -1], ['I', 1]]) {
      const th = s * 1.52, ph = -0.01;
      const p = cab.punto(th, ph, false).add(HC), n = cab.normal(th, ph);
      const arriba = V3(0, 1, 0).addScaledVector(n, -n.y).normalize(), adelante = new THREE.Vector3().crossVectors(n, arriba).multiplyScalar(s);
      const oreja = new THREE.SphereGeometry(1, 18, 14);
      const pa = oreja.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        let vx = pa.getX(i), vy = pa.getY(i), vz = pa.getZ(i); // vx: hacia afuera, vy: arriba, vz: adelante
        const r = Math.hypot(vy, vz);
        let afuera = vx * 0.0085 * (vy < -0.55 ? 1.3 : 1);
        if (vx > 0) afuera -= 0.0062 * Math.max(0, 1 - (r / 0.74) ** 2) * (0.6 + 0.4 * vx);
        if (vx > 0) afuera += 0.003 * sstep(0.7, 0.95, r);
        const alto = vy * 0.031, ancho = vz * 0.0185 * (vy > 0 ? 1 : 0.85 + 0.15 * (1 + vy));
        // inclinada hacia atrás
        const a = -0.22, yy = alto * Math.cos(a) - ancho * Math.sin(a), zz = alto * Math.sin(a) + ancho * Math.cos(a);
        const q = p.clone().addScaledVector(n, 0.0042 + afuera + 0.007 * (1 - Math.abs(vy)) * 0.3).addScaledVector(arriba, yy).addScaledVector(adelante, zz - 0.006);
        pa.setXYZ(i, q.x, q.y, q.z);
      }
      oreja.computeVertexNormals();
      poner('piel', conAtributos(oreja, 'cabeza', idx, { uv: ATLAS.oreja }));
    }
    // ojos
    for (const L of ['D', 'I']) {
      const e = new THREE.SphereGeometry(0.0118, 24, 16);
      e.translate(ojo[L].x, ojo[L].y, ojo[L].z);
      poner('ojos', conAtributos(e, 'ojo' + L, idx));
    }
    // párpados (superior móvil, inferior fijo), borde y pestañas
    for (const [L, s] of [['D', -1], ['I', 1]]) {
      const C = ojo[L];
      const aMax = 1.75;
      const bordeSup = (a) => (Math.abs(a) <= 1.22 ? 1.3 + 0.32 * (Math.abs(a) / 1.22) ** 2 : 1.62);
      const bordeInf = (a) => (Math.abs(a) <= 1.22 ? 2.02 - 0.4 * (Math.abs(a) / 1.22) ** 2 : 1.62);
      const dirOjo = (a, pol) => V3(Math.sin(pol) * Math.sin(a), Math.cos(pol), Math.sin(pol) * Math.cos(a));
      const [u0, u1, vt, vb] = ATLAS.parpado;
      const sup = rejilla(26, 8, (u, v) => {
        const a = -aMax + 2 * aMax * u, pol = lerp(0.25, bordeSup(a), v);
        return { p: C.clone().addScaledVector(dirOjo(a, pol), 0.0129), uv: [lerp(u0, u1, u), lerp(vt, vb + 0.02, v)], w: [['parpado' + L, 1]] };
      }, idx, { afuera: (p) => p.clone().sub(C) });
      poner('piel', sup);
      const borde = rejilla(26, 2, (u, v) => {
        const a = -aMax + 2 * aMax * u, pol = bordeSup(a) + 0.02 * v;
        return { p: C.clone().addScaledVector(dirOjo(a, pol), lerp(0.0129, 0.0117, v)), uv: [lerp(u0, u1, u), vb], w: [['parpado' + L, 1]] };
      }, idx, { afuera: (p) => V3(0, -1, 0.3) });
      poner('piel', borde);
      const inf = rejilla(26, 7, (u, v) => {
        const a = -aMax + 2 * aMax * u, pol = lerp(bordeInf(a), 2.95, v);
        return { p: C.clone().addScaledVector(dirOjo(a, pol), 0.0127), uv: [ATLAS.piel[0], ATLAS.piel[1]], w: [['cabeza', 1]] };
      }, idx, { afuera: (p) => p.clone().sub(C) });
      poner('piel', inf);
      // pestañas superiores
      const largo = mujer ? 0.0058 : 0.0042;
      const pest = rejilla(22, 1, (u, v) => {
        const a = -1.25 + 2.5 * u, pol = bordeSup(a);
        const d = dirOjo(a, pol), base = C.clone().addScaledVector(d, 0.013);
        const f = Math.sin(Math.PI * u) ** 0.5 * (0.6 + 0.4 * (s * a > 0 ? 1 : 0.7));
        const punta = base.clone().addScaledVector(d, largo * f * 0.9).add(V3(0, largo * f * 0.75, 0));
        return { p: v === 0 ? base : punta, uv: [0, 0], w: [['parpado' + L, 1]] };
      }, idx, { afuera: () => V3(0, 0.3, 1) });
      poner('oscuro2', pest);
    }
  }

  // Pelo
  if (estiloPelo !== 'calvo') {
    const grosor = estiloPelo === 'rapado' ? 0.0028 : estiloPelo === 'cola' ? 0.007 : 0.0065;
    const geo = rejilla(64, 20, (u, v) => {
      const th = -Math.PI + TAU * u, phH = lineaPelo(th, estiloPelo), ph = lerp(phH, Math.PI / 2 - 0.0005, v ** 0.85);
      let t = grosor * sstep(0, 0.16, v);
      if (estiloPelo !== 'rapado') t += 0.007 * sstep(0.1, 1.1, ph) * sstep(0, 0.4, v) * (estiloPelo === 'cola' ? 0.6 : 1);
      if (estiloPelo === 'corto' || estiloPelo === 'entradas') t += 0.0012 * Math.sin(th * 7 + ph * 9) * sstep(0.2, 0.6, v);
      const p = cab.punto(th, ph, false).add(cab.normal(th, ph).multiplyScalar(t)).add(HC);
      return { p, uv: [u * 3, v * 1.2], w: [['cabeza', 1]] };
    }, idx, { cerrarU: true, afuera: (p) => p.clone().sub(HC) });
    poner('pelo', geo);
    if (estiloPelo === 'cola') {
      const atras = (y, z) => V3(0, HC.y + y, HC.z + z);
      const curva = new THREE.CatmullRomCurve3([atras(0.045, -0.095), atras(0.015, -0.128), atras(-0.04, -0.14), atras(-0.11, -0.135), atras(-0.19, -0.12), atras(-0.24, -0.108)]);
      poner('pelo', tuboVariable(curva, (t) => (t < 0.1 ? 0.016 + 0.08 * t : 0.024 * (1 - 0.6 * t)), idx, 'cabeza', { seg: 12, pasos: 18 }));
      const coll = new THREE.TorusGeometry(0.019, 0.004, 6, 16); coll.rotateX(0.3); coll.translate(0, HC.y + 0.02, HC.z - 0.125);
      poner('oscuro', conAtributos(coll, 'cabeza', idx));
    }
  }
  // Casco
  if (o.casco) {
    const yb = HC.y + 0.032, zb = HC.z - 0.006;
    const filas = [[0, 0.094, 0.117], [0.025, 0.093, 0.116], [0.05, 0.088, 0.11], [0.072, 0.077, 0.097], [0.09, 0.06, 0.077], [0.102, 0.038, 0.05], [0.108, 0.01, 0.014]];
    const an = filas.map(([dy, a, b]) => ({ c: V3(0, yb + dy, zb), a, b, w: [['cabeza', 1]] }));
    poner('casco', loft(an, idx, { seg: 40, tapaFin: true, color: '#ffffff' }));
    const ala = (ang) => 1 + 0.42 * Math.exp(-(ang * ang) / 0.35) + 0.06 * Math.exp(-((Math.abs(ang) - Math.PI) ** 2) / 0.6);
    const anA = [
      { c: V3(0, yb, zb), a: 0.094, b: 0.117, w: [['cabeza', 1]] },
      { c: V3(0, yb - 0.004, zb), a: 0.101, b: 0.123, m: ala, w: [['cabeza', 1]] },
      { c: V3(0, yb - 0.011, zb), a: 0.101, b: 0.123, m: ala, w: [['cabeza', 1]] },
      { c: V3(0, yb - 0.009, zb), a: 0.09, b: 0.112, w: [['cabeza', 1]] },
    ];
    const geoA = loft(anA, idx, { seg: 40, color: '#ffffff' });
    const col = geoA.attributes.color; const pa = geoA.attributes.position;
    for (let i = 0; i < col.count; i++) if (pa.getY(i) < yb - 0.007) col.setXYZ(i, 0.55, 0.55, 0.55);
    poner('casco', geoA);
    const cresta = new THREE.CatmullRomCurve3([-1.0, -0.6, -0.2, 0.2, 0.6, 1.0].map((t) => {
      const ang = t * 1.4; return V3(0, yb + 0.106 * Math.cos(ang) ** 0.8 - 0.004, zb + 0.112 * Math.sin(ang));
    }));
    poner('casco', tuboVariable(cresta, () => 0.0055, idx, 'cabeza', { seg: 8, pasos: 24, uv: [0.5, 0.5] }));
    // suspensión interior y barboquejo no se ven: se omiten
  }
  // Audífonos con micrófono
  if (o.audifonos) {
    const arco = new THREE.CatmullRomCurve3([-1, -0.6, -0.25, 0, 0.25, 0.6, 1].map((t) => { const th = t * 1.52; const ph = 1.57 - Math.abs(t) * 1.55; return cab.punto(th, ph, false).add(cab.normal(th, ph).multiplyScalar(0.014 + 0.006 * (1 - Math.abs(t)))).add(HC).add(V3(0, 0, -0.012)); }));
    poner('oscuro', tuboVariable(arco, () => 0.0045, idx, 'cabeza', { seg: 8, pasos: 30 }));
    for (const s of [-1, 1]) {
      const n = cab.normal(s * 1.52, -0.01), p = cab.punto(s * 1.52, -0.01, false).add(HC).addScaledVector(n, 0.02);
      const copa = new THREE.CylinderGeometry(0.036, 0.034, 0.024, 20); copa.rotateZ(Math.PI / 2); copa.translate(p.x, p.y, p.z - 0.006);
      poner('oscuro', conAtributos(copa, 'cabeza', idx));
    }
    const nI = cab.normal(-1.52, -0.01), pI = cab.punto(-1.52, -0.01, false).add(HC).addScaledVector(nI, 0.03);
    const boca = cab.punto(-0.38, -0.47, false).add(HC).add(V3(0, 0, 0.022));
    const brazo = new THREE.CatmullRomCurve3([pI, pI.clone().add(V3(0.01, -0.03, 0.05)), boca.clone().add(V3(-0.03, -0.01, -0.005)), boca]);
    poner('oscuro', tuboVariable(brazo, () => 0.0022, idx, 'cabeza', { seg: 6, pasos: 16 }));
    const mic = new THREE.SphereGeometry(0.0065, 10, 8); mic.translate(boca.x, boca.y, boca.z);
    poner('oscuro', conAtributos(mic, 'cabeza', idx));
  }
  // Lentes
  if (o.lentes) {
    for (const L of ['D', 'I']) {
      const c = ojo[L].clone().add(V3(0, 0.002, 0.0145));
      const aro = new THREE.TorusGeometry(0.0185, 0.0014, 6, 28); aro.scale(1.15, 0.8, 1); aro.translate(c.x, c.y, c.z);
      poner('oscuro', conAtributos(aro, 'cabeza', idx));
      const s = L === 'D' ? -1 : 1;
      const varilla = new THREE.CatmullRomCurve3([c.clone().add(V3(s * 0.021, 0.003, 0)), c.clone().add(V3(s * 0.04, 0.004, -0.03)), cab.punto(s * 1.42, 0.06, false).add(HC).add(V3(s * 0.006, 0, 0))]);
      poner('oscuro', tuboVariable(varilla, () => 0.0012, idx, 'cabeza', { seg: 5, pasos: 10 }));
    }
    const puente = new THREE.CatmullRomCurve3([ojo.D.clone().add(V3(0.021, 0.004, 0.0145)), V3(0, ojo.D.y + 0.007, ojo.D.z + 0.018), ojo.I.clone().add(V3(-0.021, 0.004, 0.0145))]);
    poner('oscuro', tuboVariable(puente, () => 0.0013, idx, 'cabeza', { seg: 5, pasos: 8 }));
  }

  // Brazos (manga y piel) y manos
  const kb = F.gBrazo;
  const BR = [[1.432, 0.026, 0.03], [1.42, 0.045, 0.05], [1.4, 0.055, 0.058], [1.37, 0.056, 0.057], [1.32, 0.05, 0.053], [1.26, 0.045, 0.049], [1.2, 0.043, 0.047],
    [1.15, 0.039, 0.042], [1.118, 0.037, 0.04], [1.085, 0.04, 0.042], [1.03, 0.041, 0.043], [0.97, 0.036, 0.037], [0.91, 0.029, 0.026], [0.878, 0.026, 0.022], [0.862, 0.022, 0.018]];
  const yRel = (y) => (y - 1.405) * ((F.yHombro - F.yMuneca) / (1.405 - 0.868)) + F.yHombro; // reescala la tabla a la figura
  for (const [L, s] of [['D', -1], ['I', 1]]) {
    const S = P('brazo' + L), E = P('antebrazo' + L), W = P('mano' + L);
    const centro = (y) => {
      if (y >= S.y - 0.02) return V3(S.x - s * 0.026 * sstep(S.y - 0.02, S.y + 0.03, y), y, S.z);
      if (y >= E.y) { const t = (S.y - y) / (S.y - E.y); return V3(lerp(S.x, E.x, t), y, lerp(S.z, E.z, t)); }
      const t = (E.y - y) / (E.y - W.y); return V3(lerp(E.x, W.x, t), y, lerp(E.z, W.z, t));
    };
    const peso = (y) => (y > E.y + 0.045 ? [['brazo' + L, 1]] : y < E.y - 0.035 ? [['antebrazo' + L, 1]] : mezclaPesos('brazo' + L, 'antebrazo' + L, sstep(E.y + 0.045, E.y - 0.035, y)));
    const anillo = (y, a, b, esc = 1, v = 0) => ({ c: centro(y), a: a * kb * esc, b: b * kb * esc, w: peso(y), v });
    const filas = BR.map(([y, a, b]) => [yRel(y), a, b]);
    const yManga = manga === 'corta' ? yRel(1.24) : W.y + 0.03;
    const vM = (y) => 0.02 + ((S.y + 0.05 - y) / (S.y + 0.05 - W.y)) * 0.16;
    const tela = filas.filter(([y]) => y >= yManga).map(([y, a, b]) => anillo(y, a, b, superior === 'parka' ? 1.16 : 1.08, vM(y)));
    const [aM, bM] = tablaEn(filas.slice().reverse(), yManga);
    tela.push(anillo(yManga, aM, bM, superior === 'parka' ? 1.2 : 1.12, vM(yManga)));
    tela.push(anillo(yManga - 0.002, aM, bM, 1.0, vM(yManga)));
    poner('superior', loft(tela, idx, { seg: 20, tapaIni: true, uFlip: s > 0 }));
    const pielBr = filas.filter(([y]) => y <= yManga + 0.02);
    if (pielBr.length >= 2 || manga === 'corta') {
      const lista = [[yManga + 0.02, ...tablaEn(filas.slice().reverse(), yManga + 0.02)], ...pielBr.filter(([y]) => y < yManga + 0.02)];
      const g = loft(lista.map(([y, a, b]) => anillo(y, a, b)), idx, { seg: 18, tapaFin: true });
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, ATLAS.piel[0], ATLAS.piel[1]);
      poner(o.guantes && manga === 'larga' ? 'piel' : 'piel', g);
    }
    // mano: palma, dedos y pulgar
    const matMano = o.guantes ? 'guante' : 'piel';
    const PAL = [[0.012, 0.022, 0.027], [-0.01, 0.0205, 0.034], [-0.04, 0.0175, 0.041], [-0.07, 0.0155, 0.043], [-0.088, 0.0135, 0.041], [-0.097, 0.009, 0.03]];
    const palma = loft(PAL.map(([dy, a, b]) => ({ c: V3(W.x - s * 0.002, W.y + dy * km, W.z), a: a * km, b: b * km, w: [['mano' + L, 1]] })), idx, { seg: 16, tapaFin: true });
    const uvP = palma.attributes.uv; for (let i = 0; i < uvP.count; i++) uvP.setXY(i, ATLAS.piel[0], ATLAS.piel[1]);
    poner(matMano, palma);
    for (const d of DEDOS) {
      const b1 = P(d.n + L + '1'), b2 = P(d.n + L + '2');
      for (const [b, l, n, r] of [[b1, d.l1, d.n + L + '1', d.r], [b2, d.l2, d.n + L + '2', d.r * 0.92]]) {
        const cap = new THREE.CapsuleGeometry(r * km, l * km - r * km, 3, 8);
        cap.translate(0, -(l * km) / 2, 0); cap.scale(1, 1, 1.08); cap.translate(b.x, b.y, b.z);
        poner(matMano, conAtributos(cap, n, idx, { uv: ATLAS.piel }));
      }
    }
    const pb1 = P('pulgar' + L + '1'), pb2 = P('pulgar' + L + '2'), q = new THREE.Quaternion().setFromUnitVectors(V3(0, -1, 0), pulgarDir[L]);
    for (const [b, l, n, r] of [[pb1, 0.036, 'pulgar' + L + '1', 0.0108], [pb2, 0.031, 'pulgar' + L + '2', 0.0098]]) {
      const cap = new THREE.CapsuleGeometry(r * km, l * km - r * km * 0.6, 3, 8);
      cap.translate(0, -(l * km) / 2, 0); cap.applyQuaternion(q); cap.translate(b.x, b.y, b.z);
      poner(matMano, conAtributos(cap, n, idx, { uv: ATLAS.piel }));
    }
    if (o.guantes) {
      const puno = loft([0.03, 0.005].map((dy) => ({ c: V3(W.x, W.y + dy, W.z), a: 0.031 * km, b: 0.036 * km, w: mezclaPesos('antebrazo' + L, 'mano' + L, 0.5) })), idx, { seg: 16 });
      poner('guante', puno);
    }
  }

  // Piernas (pantalón) y calzado
  const kp = F.gPierna;
  const PI_ = [[1.0, 0.08, 0.085], [0.93, 0.088, 0.095], [0.85, 0.083, 0.088], [0.75, 0.073, 0.078], [0.65, 0.063, 0.067], [0.56, 0.054, 0.056], [0.503, 0.051, 0.053],
    [0.45, 0.052, 0.057], [0.37, 0.054, 0.06], [0.28, 0.046, 0.051], [0.19, 0.04, 0.044], [0.13, 0.041, 0.045], [0.085, 0.046, 0.05], [0.07, 0.047, 0.051]];
  for (const [L, s] of [['D', -1], ['I', 1]]) {
    const H = P('muslo' + L), K = P('pierna' + L), A = P('pie' + L);
    const centro = (y) => {
      if (y >= K.y) { const t = (H.y - y) / (H.y - K.y); return V3(lerp(H.x, K.x, clamp(t, 0, 1)), y, lerp(H.z, K.z, clamp(t, 0, 1))); }
      const t = (K.y - y) / (K.y - A.y), pant = -0.012 * Math.exp(-((y - 0.37) ** 2) / 0.006);
      return V3(lerp(K.x, A.x, clamp(t, 0, 1)), y, lerp(K.z, A.z, clamp(t, 0, 1)) + pant);
    };
    const peso = (y) => (y > K.y + 0.06 ? [['muslo' + L, 1]] : y < K.y - 0.04 ? [['pierna' + L, 1]] : mezclaPesos('muslo' + L, 'pierna' + L, sstep(K.y + 0.06, K.y - 0.04, y)));
    const holg = inferior === 'trabajo' ? 1.08 : inferior === 'tela' ? 1.07 : 1.05;
    const an = PI_.map(([y, a, b]) => ({ c: centro(y), a: a * kp * holg * (y < 0.2 ? 1.05 : 1), b: b * kp * holg * (y < 0.2 ? 1.05 : 1), w: peso(y), v: VP(y) }));
    poner('inferior', loft(an, idx, { seg: 24, uFlip: s > 0, tapaIni: true }));
    // calzado: caña alrededor del tobillo y pie a lo largo de +z
    const pesoPie = (z) => (z < A.z + 0.07 ? [['pie' + L, 1]] : mezclaPesos('pie' + L, 'punta' + L, sstep(A.z + 0.07, A.z + 0.12, z)));
    const bota = calzado === 'botas';
    const cana = (bota ? [[0.16, 0.043, 0.047], [0.12, 0.045, 0.05], [0.085, 0.048, 0.056]] : [[0.1, 0.038, 0.044], [0.08, 0.042, 0.05]]).map(([y, a, b]) => ({ c: V3(A.x, y, A.z - 0.008), a, b, w: [['pie' + L, 1]] }));
    const ap = 1 + (bota ? 0.06 : 0);
    const PIE = [[-0.085, 0.048, 0.033, 0.042], [-0.065, 0.06, 0.042, 0.058], [-0.02, 0.062, 0.046, 0.06], [0.04, 0.052, 0.05, 0.05], [0.09, 0.043, 0.052, 0.04], [0.14, 0.037, 0.049, 0.034], [0.18, 0.033, 0.04, 0.03], [0.205, 0.03, 0.022, 0.024]];
    const anP = PIE.map(([dz, cy, hx, hy]) => ({ c: V3(A.x + s * 0.004 * (dz / 0.2), cy * ap, A.z + dz), a: hx * ap, b: hy * ap, w: pesoPie(A.z + dz) }));
    const piezasPie = [loft(cana, idx, { seg: 18 }), loft(anP, idx, { seg: 20, ejeA: EJE_X, ejeB: EJE_Y, tapaIni: true, tapaFin: true, expo: 2.3 })];
    const cSup = new THREE.Color(o.colorCalzado ?? (bota ? '#5a3c25' : calzado === 'zapatos' ? '#1f1a17' : '#d8d8d6'));
    const cSuela = new THREE.Color(bota ? '#1d1a18' : calzado === 'zapatos' ? '#151210' : '#f2f1ee');
    for (const gp of piezasPie) {
      const pa = gp.attributes.position, co = gp.attributes.color;
      for (let i = 0; i < pa.count; i++) {
        if (pa.getY(i) < 0.004) pa.setY(i, 0.004);
        const y = pa.getY(i), z = pa.getZ(i) - A.z;
        let c = y < (bota ? 0.026 : 0.022) ? cSuela : cSup;
        if (!bota && calzado === 'zapatillas' && y < 0.03 && y >= 0.022) c = new THREE.Color('#9a9a9a');
        if (y > 0.07 && z > 0.02 && z < 0.12 && Math.abs(pa.getX(i) - A.x) < 0.016) c = cSup.clone().multiplyScalar(0.55); // cordones
        co.setXYZ(i, c.r, c.g, c.b);
      }
      gp.computeVertexNormals();
      poner('calzado', gp);
    }
  }

  // ---------------- materiales
  const mats = {};
  const mat = (k, p) => (mats[k] = new THREE.MeshStandardMaterial({ vertexColors: true, ...p }));
  mat('piel', { map: texturaRostro({ piel, pelo: colorPelo, mujer, barba, semilla: sem % 6, estiloPelo }), roughness: 0.6, metalness: 0 });
  mat('ojos', { map: texturaOjo(colorOjos), roughness: 0.08, metalness: 0, envMapIntensity: 3 });
  mat('pelo', { map: texturaPelo(colorPelo, estiloPelo), roughness: 0.86, metalness: 0 });
  mat('superior', { map: texturaSuperior(superior, colorSup, mujer, sem), roughness: superior === 'parka' ? 0.7 : 0.92 });
  mat('inferior', { map: texturaInferior(inferior, colorInf, sem), roughness: 0.94 });
  mat('calzado', { roughness: 0.62, metalness: 0 });
  mat('oscuro', { color: 0x1c1b1a, roughness: 0.5, metalness: 0.25 });
  mat('oscuro2', { color: 0x120c09, roughness: 0.8, side: THREE.DoubleSide });
  mat('metal', { color: 0xb8b2a6, roughness: 0.35, metalness: 0.85 });
  if (o.chaleco) mat('chaleco', { map: texturaChaleco(CHALECOS[o.chaleco] ?? o.chaleco), alphaTest: 0.5, roughness: 0.75, side: THREE.DoubleSide });
  if (o.casco) mat('casco', { color: new THREE.Color(o.casco), roughness: 0.3, metalness: 0, envMapIntensity: 1.6 });
  if (o.guantes) mat('guante', { color: new THREE.Color(o.guantes), roughness: 0.95, map: null });

  // ---------------- mallas con piel
  const grupo = new THREE.Group();
  grupo.name = 'persona';
  grupo.add(huesos.raiz);
  grupo.updateMatrixWorld(true);
  const esqueleto = new THREE.Skeleton(listaHuesos);
  const mallas = [];
  for (const [k, geos] of Object.entries(piezas)) {
    const geo = mergeGeometries(geos, false);
    if (!geo) throw new Error('No se pudieron unir las piezas de ' + k);
    for (const g of geos) g.dispose();
    const m = new THREE.SkinnedMesh(geo, mats[k]);
    m.name = 'persona-' + k;
    m.castShadow = !['ojos', 'oscuro2'].includes(k); m.receiveShadow = true;
    m.bind(esqueleto, new THREE.Matrix4());
    m.boundingSphere = new THREE.Sphere(V3(0, 0.9, 0), 1.35);
    grupo.add(m); mallas.push(m);
  }
  grupo.scale.setScalar(altura / 1.75);

  // anclas para sostener objetos (centro del puño)
  const manoD = new THREE.Object3D(), manoI = new THREE.Object3D();
  manoD.position.set(0.028 * km, -0.072 * km, 0.014 * km); manoI.position.set(-0.028 * km, -0.072 * km, 0.014 * km);
  huesos.manoD.add(manoD); huesos.manoI.add(manoI);

  const h = {
    grupo, huesos, esqueleto, mallas, materiales: mats, manoD, manoI, altura, mujer, opciones: o,
    bind, F,
  };
  instalarControl(h);
  return h;
}

// ------------------------------------------------------------------ control: poses, animaciones, mirada, IK
function instalarControl(h) {
  const { huesos, bind, F } = h;
  const st = {
    base: POSES.reposo(), previa: null, kTrans: 1, durTrans: 0.5,
    clip: null, tClip: 0, pesoClip: 0, opcClip: {}, terminando: false,
    mirar: null, yaw: 0, pitch: 0, ojoYaw: 0, ojoPitch: 0, sacada: [0, 0], tSacada: 1.5,
    tParpadeo: 2 + Math.random() * 2, parpadeo: -1, t: Math.random() * 10, vida: 1,
    sostener: null,
  };
  const qTmp = new THREE.Quaternion(), qTmp2 = new THREE.Quaternion(), vTmp = V3(), vTmp2 = V3(), vTmp3 = V3();
  const mTmp = new THREE.Matrix4();

  const evaluarClip = (clip, t) => {
    if (clip.fn) return clip.fn(t);
    const K = clip.claves, n = K.length;
    if (t <= K[0].t) return K[0].pose;
    if (t >= K[n - 1].t) return K[n - 1].pose;
    let i = 0;
    while (i < n - 2 && K[i + 1].t <= t) i++;
    const k = (t - K[i].t) / (K[i + 1].t - K[i].t);
    const p0 = K[Math.max(0, i - 1)].pose, p1 = K[i].pose, p2 = K[i + 1].pose, p3 = K[Math.min(n - 1, i + 2)].pose;
    return catmullPoses(p0, p1, p2, p3, k);
  };

  const aplicarDedos = (L, v) => {
    const s = L === 'D' ? 1 : -1;
    const c = typeof v === 'object' && v ? v.c : v ?? 0.22, ci = typeof v === 'object' && v ? v.indice ?? c : c;
    for (const d of ['indice', 'medio', 'anular', 'menique']) {
      const cc = d === 'indice' ? ci : d === 'menique' ? Math.min(1, c * 1.1 + 0.05) : c;
      huesos[d + L + '1'].rotation.set(0, 0, s * (0.08 + 1.4 * cc));
      huesos[d + L + '2'].rotation.set(0, 0, s * (0.12 + 1.5 * cc));
    }
    huesos['pulgar' + L + '1'].rotation.set(-0.15 - 0.35 * c, 0, s * (0.15 + 0.45 * c));
    huesos['pulgar' + L + '2'].rotation.set(0, 0, s * (0.15 + 0.7 * c));
  };

  const aplicar = (pose) => {
    for (const [n, b] of Object.entries(huesos)) {
      if (/^(indice|medio|anular|menique|pulgar|ojo|parpado)/.test(n)) continue;
      const r = pose[n];
      if (r) b.rotation.set(r[0], r[1], r[2]); else b.rotation.set(0, 0, 0);
    }
    const c0 = bind.get('cadera'), dp = pose._pos || [0, 0, 0];
    huesos.cadera.position.set(c0.x + dp[0], c0.y + dp[1], c0.z + dp[2]);
    // los pies no giran con la cadera
    const yc = huesos.cadera.rotation.y, xc = huesos.cadera.rotation.x;
    if (yc) { huesos.musloD.rotation.y -= yc; huesos.musloI.rotation.y -= yc; }
    if (xc) { huesos.musloD.rotation.x -= xc; huesos.musloI.rotation.x -= xc; } // la pelvis se inclina sin mover los muslos
    aplicarDedos('D', pose.dedosD); aplicarDedos('I', pose.dedosI);
  };

  // IK de dos huesos: lleva la muñeca al objetivo (mundo) con el codo hacia el polo (dirección en el mundo)
  const ik = (L, objetivo, polo, peso) => {
    const A = huesos['brazo' + L], B = huesos['antebrazo' + L], C = huesos['mano' + L];
    const qa0 = A.quaternion.clone(), qb0 = B.quaternion.clone();
    A.updateWorldMatrix(true, true);
    const pa = A.getWorldPosition(V3()), pb = B.getWorldPosition(V3()), pc = C.getWorldPosition(V3());
    const l1 = pa.distanceTo(pb), l2 = pb.distanceTo(pc);
    const d = clamp(objetivo.distanceTo(pa), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
    // ángulo del codo
    const cosE = clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1);
    const flex = Math.PI - Math.acos(cosE);
    B.rotation.set(-flex, B.rotation.y, 0);
    B.updateWorldMatrix(false, true);
    C.getWorldPosition(pc);
    // apunta el brazo
    A.getWorldQuaternion(qTmp);
    const desde = pc.clone().sub(pa).normalize(), hacia = objetivo.clone().sub(pa).normalize();
    qTmp2.setFromUnitVectors(desde, hacia);
    qTmp.premultiply(qTmp2);
    // gira alrededor del eje hombro-objetivo para llevar el codo al polo
    A.parent.getWorldQuaternion(qTmp2);
    A.quaternion.copy(qTmp2.clone().invert().multiply(qTmp));
    A.updateWorldMatrix(false, true);
    B.getWorldPosition(pb);
    const eje = hacia;
    const e1 = pb.clone().sub(pa); e1.addScaledVector(eje, -e1.dot(eje));
    const e2 = polo.clone(); e2.addScaledVector(eje, -e2.dot(eje));
    if (e1.lengthSq() > 1e-8 && e2.lengthSq() > 1e-8) {
      e1.normalize(); e2.normalize();
      let ang = Math.acos(clamp(e1.dot(e2), -1, 1));
      if (vTmp.crossVectors(e1, e2).dot(eje) < 0) ang = -ang;
      qTmp2.setFromAxisAngle(eje, ang);
      A.getWorldQuaternion(qTmp); qTmp.premultiply(qTmp2);
      A.parent.getWorldQuaternion(qTmp2);
      A.quaternion.copy(qTmp2.clone().invert().multiply(qTmp));
    }
    if (peso < 1) { A.quaternion.slerpQuaternions(qa0, A.quaternion.clone(), peso); B.quaternion.slerpQuaternions(qb0, B.quaternion.clone(), peso); }
    A.updateWorldMatrix(false, true);
  };

  const ikExterno = { D: null, I: null };

  h.posar = (nombre, ...args) => {
    const p = typeof nombre === 'string' ? POSES[nombre](...args) : nombre;
    st.previa = st.ultima || st.base; st.base = p; st.kTrans = 0;
    return h;
  };
  h.transicion = (seg) => { st.durTrans = seg; return h; };
  h.reproducir = (clip, opc = {}) => {
    const c = typeof clip === 'string' ? CLIPS[clip] : clip;
    st.clip = c; st.tClip = opc.desde ?? 0; st.opcClip = opc; st.terminando = false;
    st.pesoClip = opc.sinMezcla ? 1 : st.pesoClip;
    st.eventosHechos = new Set();
    return h;
  };
  h.detener = () => { st.terminando = true; return h; };
  h.tiempoClip = () => st.tClip;
  h.clipActual = () => st.clip;
  h.mirar = (obj) => { st.mirar = obj; return h; };
  h.alcanzar = (L, objetivo, polo = null, peso = 1) => { ikExterno[L] = objetivo ? { objetivo, polo, peso } : null; return h; };
  h.sostener = (obj, opc = null) => { st.sostener = obj ? { obj, ...opc } : null; return h; };
  h.vida = (v) => { st.vida = v; return h; };
  // Fija el tiempo del clip y deja la pose lista sin avanzar (para capturas y para sincronizar con un reloj)
  h.fijarClip = (clip, t) => { h.reproducir(clip, { sinMezcla: true }); st.tClip = t; st.pesoClip = 1; h.actualizar(0); return h; };

  h.actualizar = (dt) => {
    st.t += dt;
    // pose base con transición
    if (st.kTrans < 1) st.kTrans = Math.min(1, st.kTrans + dt / st.durTrans);
    let pose = st.previa && st.kTrans < 1 ? mezclarPoses(st.previa, st.base, sstep(0, 1, st.kTrans)) : st.base;
    // clip
    if (st.clip) {
      const c = st.clip, vel = st.opcClip.velocidad ?? 1;
      const t0 = st.tClip;
      st.tClip += dt * vel;
      if (c.eventos && st.opcClip.eventos && dt > 0) {
        const bucle = c.bucle || st.opcClip.bucle, d = c.duracion;
        const a = bucle ? ((t0 % d) + d) % d : t0, b = bucle ? ((st.tClip % d) + d) % d : st.tClip;
        for (const [nombre, te] of Object.entries(c.eventos)) {
          const cruzo = b >= a ? te > a && te <= b : te > a || te <= b;
          if (cruzo) st.opcClip.eventos[nombre]?.(h);
        }
      }
      let tc = st.tClip;
      if (c.bucle || st.opcClip.bucle) tc = ((tc % c.duracion) + c.duracion) % c.duracion;
      else if (tc >= c.duracion) { tc = c.duracion; if (!st.terminando) { st.terminando = true; st.opcClip.alTerminar?.(h); } }
      if (st.terminando) st.pesoClip = Math.max(0, st.pesoClip - dt / 0.35);
      else st.pesoClip = Math.min(1, st.pesoClip + (dt || 1) / 0.25);
      const pc = evaluarClip(c, tc);
      pose = mezclarPoses(pose, { ...pose, ...pc }, st.pesoClip);
      if (st.terminando && st.pesoClip <= 0) { st.clip = null; st.terminando = false; }
    }
    st.ultima = pose;
    aplicar(pose);
    // vida: respiración, balanceo y microgestos
    const v = st.vida * (1 - (st.clip ? st.pesoClip * 0.7 : 0));
    if (v > 0) {
      const r = Math.sin(st.t * TAU / 4.2);
      huesos.pecho.rotation.x += -0.012 * r * v;
      huesos.columna.rotation.x += 0.006 * r * v;
      huesos.claviculaD.rotation.z -= 0.012 * r * v; huesos.claviculaI.rotation.z += 0.012 * r * v;
      huesos.cadera.rotation.z += 0.012 * Math.sin(st.t * TAU / 7.3) * v;
      huesos.cadera.position.x += 0.006 * Math.sin(st.t * TAU / 7.3) * v;
      huesos.cabeza.rotation.y += 0.03 * Math.sin(st.t * 0.37) * v;
      huesos.cabeza.rotation.x += 0.015 * Math.sin(st.t * 0.53 + 1) * v;
    }
    h.grupo.updateMatrixWorld(true);
    // mirada: cuello y cabeza giran hacia el objetivo
    let objetivo = null;
    if (st.mirar) objetivo = st.mirar.isObject3D ? st.mirar.getWorldPosition(vTmp3) : vTmp3.copy(st.mirar);
    let yawO = 0, pitchO = 0;
    if (objetivo) {
      huesos.cabeza.getWorldPosition(vTmp);
      huesos.pecho.getWorldQuaternion(qTmp);
      vTmp2.copy(objetivo).sub(vTmp).applyQuaternion(qTmp.invert());
      yawO = clamp(Math.atan2(vTmp2.x, vTmp2.z), -1.2, 1.2);
      pitchO = clamp(Math.atan2(-vTmp2.y, Math.hypot(vTmp2.x, vTmp2.z)), -0.6, 0.75);
    }
    const kS = dt > 0 ? 1 - Math.exp(-dt * 5) : 1;
    st.yaw += (yawO - st.yaw) * kS; st.pitch += (pitchO - st.pitch) * kS;
    if (Math.abs(st.yaw) > 1e-4 || Math.abs(st.pitch) > 1e-4) {
      huesos.cuello.rotation.y += st.yaw * 0.4; huesos.cuello.rotation.x += st.pitch * 0.35;
      huesos.cabeza.rotation.y += st.yaw * 0.6; huesos.cabeza.rotation.x += st.pitch * 0.55;
      huesos.cuello.updateWorldMatrix(false, true);
    }
    // IK de las manos (de la pose o externo)
    for (const L of ['D', 'I']) {
      const ext = ikExterno[L], pk = pose['ik' + L];
      if (ext) {
        const obj = ext.objetivo.isObject3D ? ext.objetivo.getWorldPosition(V3()) : ext.objetivo.clone();
        const polo = ext.polo ? ext.polo.clone() : V3(L === 'D' ? -1 : 1, -0.6, -0.4).transformDirection(h.grupo.matrixWorld);
        ik(L, obj, polo, ext.peso ?? 1);
      } else if (pk && (pk.w ?? 1) > 0.01) {
        const obj = V3(...pk.p).applyMatrix4(h.grupo.matrixWorld);
        const polo = V3(...(pk.polo || [L === 'D' ? -1 : 1, -0.6, -0.4])).transformDirection(h.grupo.matrixWorld);
        ik(L, obj, polo, pk.w ?? 1);
      }
    }
    // ojos: miran al objetivo o hacen pequeñas sacadas
    st.tSacada -= dt;
    if (st.tSacada <= 0) { st.tSacada = 0.8 + Math.random() * 2.5; st.sacada = [(Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.08]; }
    let oy = st.sacada[0], ox = st.sacada[1];
    if (objetivo) {
      h.huesos.ojoI.parent.updateWorldMatrix(true, false);
      huesos.cabeza.getWorldQuaternion(qTmp);
      const pOjo = huesos.ojoI.getWorldPosition(V3());
      vTmp2.copy(objetivo).sub(pOjo).applyQuaternion(qTmp.invert());
      oy = clamp(Math.atan2(vTmp2.x, vTmp2.z), -0.45, 0.45) + st.sacada[0] * 0.3;
      ox = clamp(Math.atan2(-vTmp2.y, Math.hypot(vTmp2.x, vTmp2.z)), -0.35, 0.4) + st.sacada[1] * 0.3;
    }
    st.ojoYaw += (oy - st.ojoYaw) * (dt > 0 ? 1 - Math.exp(-dt * 18) : 1);
    st.ojoPitch += (ox - st.ojoPitch) * (dt > 0 ? 1 - Math.exp(-dt * 18) : 1);
    for (const L of ['D', 'I']) huesos['ojo' + L].rotation.set(st.ojoPitch, st.ojoYaw, 0, 'YXZ');
    // parpadeo
    st.tParpadeo -= dt;
    if (st.tParpadeo <= 0 && st.parpadeo < 0) { st.parpadeo = 0; st.tParpadeo = 2.2 + Math.random() * 3.5; }
    let cierre = 0;
    if (st.parpadeo >= 0) { st.parpadeo += dt; const k = st.parpadeo / 0.17; cierre = Math.sin(Math.PI * Math.min(1, k)); if (k >= 1) st.parpadeo = -1; }
    const lid = 0.86 * cierre + 0.55 * Math.max(0, st.ojoPitch) * (1 - cierre) - 0.15 * Math.max(0, -st.ojoPitch);
    huesos.parpadoD.rotation.set(lid, 0, 0); huesos.parpadoI.rotation.set(lid, 0, 0);
    h.grupo.updateMatrixWorld(true);
    // herramienta en las dos manos
    if (st.sostener) {
      const s = st.sostener, obj = s.obj;
      const aD = h.manoD.getWorldPosition(V3()), aI = h.manoI.getWorldPosition(V3());
      if (s.D && s.I) {
        const gD = V3(...s.D), gI = V3(...s.I);
        const dirL = gI.clone().sub(gD).normalize(), dirW = aI.clone().sub(aD).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(dirL, dirW);
        // giro sobre el eje para que el «arriba» del objeto quede lo más arriba posible
        const up = V3(...(s.arriba || [0, 1, 0])).applyQuaternion(q);
        const upW = V3(...(s.arribaMundo || [0, 1, 0]));
        const a1 = up.clone().addScaledVector(dirW, -up.dot(dirW)), a2 = upW.clone().addScaledVector(dirW, -upW.dot(dirW));
        if (a1.lengthSq() > 1e-6 && a2.lengthSq() > 1e-6) {
          a1.normalize(); a2.normalize();
          let ang = Math.acos(clamp(a1.dot(a2), -1, 1)); if (vTmp.crossVectors(a1, a2).dot(dirW) < 0) ang = -ang;
          q.premultiply(new THREE.Quaternion().setFromAxisAngle(dirW, ang));
        }
        // la escala del objeto en el mundo
        const padre = obj.parent;
        const qMundo = q;
        const posMundo = aD.clone().sub(gD.clone().multiply(obj.getWorldScale(V3())).applyQuaternion(qMundo));
        if (padre) {
          padre.updateWorldMatrix(true, false);
          const qp = padre.getWorldQuaternion(new THREE.Quaternion()).invert();
          obj.quaternion.copy(qp.multiply(qMundo));
          obj.position.copy(padre.worldToLocal(posMundo));
        } else { obj.quaternion.copy(qMundo); obj.position.copy(posMundo); }
        obj.updateMatrixWorld(true);
      }
    }
  };
  h.actualizar(0);
  void mTmp;
}

// ------------------------------------------------------------------ atuendos predefinidos
export const PRESETS = {
  obrero: { superior: 'polera', colorSuperior: '#2f4a63', inferior: 'trabajo', colorInferior: '#3b3e44', calzado: 'botas', chaleco: 'amarillo', casco: '#f3f2ec' },
  obrera: { mujer: true, superior: 'polera', colorSuperior: '#5b4a6e', inferior: 'trabajo', colorInferior: '#3b3e44', calzado: 'botas', chaleco: 'naranjo', casco: '#f3f2ec', pelo: 'cola' },
  capataz: { superior: 'camisa', colorSuperior: '#8fa9c4', inferior: 'trabajo', colorInferior: '#4a4f58', calzado: 'botas', chaleco: 'naranjo', casco: '#2f6fd0' },
  ingeniera: { mujer: true, superior: 'parka', colorSuperior: '#30455e', inferior: 'jeans', calzado: 'botas', chaleco: 'amarillo', casco: '#ffffff', lentes: true, pelo: 'cola' },
  controlador: { superior: 'camisa', colorSuperior: '#dce6f0', inferior: 'tela', colorInferior: '#262b35', calzado: 'zapatos', audifonos: true, cinturon: true },
  controladora: { mujer: true, superior: 'camisa', colorSuperior: '#e9eef3', inferior: 'tela', colorInferior: '#262b35', calzado: 'zapatos', audifonos: true, pelo: 'cola', cinturon: true },
  civil: { superior: 'polera', inferior: 'jeans', calzado: 'zapatillas' },
  civilMujer: { mujer: true, superior: 'polera', inferior: 'jeans', calzado: 'zapatillas', pelo: 'cola' },
  operador: { superior: 'parka', colorSuperior: '#9b3a1e', inferior: 'trabajo', colorInferior: '#2f3236', calzado: 'botas', chaleco: 'amarillo', casco: '#ffd23a', guantes: '#b88a4a' },
};
