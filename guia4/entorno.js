// Entorno de la obra de la Guía 4: árboles de cuatro especies con copas de racimos de hojas (lejos, impostores pintados
// desde el mismo modelo), matorrales y pasto, cerco de paneles de malla sobre bases de hormigón con portón, contenedores
// de faena con ventanas y escalera sobre una carpeta de grava, tablero eléctrico, baños químicos, acopios de materiales
// sobre tierra compactada, letrero de obra con zona de seguridad, charcos, huellas de neumáticos, bordes de tierra pisada
// en senderos y plaza, y personas que caminan por los senderos. Los objetos comparten un material de atlas: cada vértice
// lleva la región de la textura que se repite, así cada grupo de objetos se dibuja en una sola llamada.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { makeSurface, mulberry32 } from '../src/common/textures.js';
import { tr } from '../src/common/i18n.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const EJE_Y = V(0, 1, 0);
const hash = (i, s = 0) => {
  let t = Math.imul((i + 1) ^ Math.imul(s + 7, 0x9e3779b1), 0x85ebca6b);
  t ^= t >>> 13; t = Math.imul(t, 0xc2b2ae35); t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
};
const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ------------------------------------------------------------------ ruido periódico (texturas sin costuras)
function ruidoP(px, py, semilla) {
  const rnd = mulberry32(semilla), g = new Float32Array(px * py).map(() => rnd());
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x * px, fy = y * py, xi = Math.floor(fx), yi = Math.floor(fy), xf = sm(fx - xi), yf = sm(fy - yi);
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
    const a = g[y0 * px + x0], b = g[y0 * px + x1], c = g[y1 * px + x0], d = g[y1 * px + x1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
function fbmP(px, py, oct, semilla) {
  const capas = [];
  for (let o = 0; o < oct; o++) capas.push(ruidoP(px << o, py << o, semilla + o * 71));
  return (x, y) => { let s = 0, a = 1, t = 0; for (const n of capas) { s += a * n(x, y); t += a; a *= 0.5; } return s / t; };
}

// ------------------------------------------------------------------ mallas con atributos de atlas
const aColor = (c) => { if (Array.isArray(c)) return c; const k = new THREE.Color(c); return [k.r, k.g, k.b, 1]; };

// Acumula vértices con posición, normal, uv, color, región del atlas (u0, v0, du, dv) y flexibilidad (viento)
class Malla {
  constructor(alfa = false) { this.alfa = alfa; this.P = []; this.N = []; this.U = []; this.C = []; this.R = []; this.F = []; this.I = []; }
  get n() { return this.P.length / 3; }
  v(p, n, u, v, c, r, f = 0) {
    this.P.push(p.x, p.y, p.z); this.N.push(n.x, n.y, n.z); this.U.push(u, v);
    if (this.alfa) this.C.push(c[0], c[1], c[2], c[3] ?? 1); else this.C.push(c[0], c[1], c[2]);
    this.R.push(r[0], r[1], r[2], r[3]); this.F.push(f);
    return this.n - 1;
  }
  // agrega una geometría de three con un color y una región; m: Matrix4 opcional; sucio: [y0, y1, k] oscurece abajo
  geo(g, r, color, { m = null, f = 0, sucio = null } = {}) {
    const p = g.attributes.position, nn = g.attributes.normal, uv = g.attributes.uv;
    const base = this.n, c = aColor(color), nm = m ? new THREE.Matrix3().getNormalMatrix(m) : null;
    const vp = V(), vn = V();
    for (let i = 0; i < p.count; i++) {
      vp.fromBufferAttribute(p, i); vn.fromBufferAttribute(nn, i);
      const k = sucio ? lerp(1 - sucio[2], 1, sstep(sucio[0], sucio[1], vp.y)) : 1;
      if (m) { vp.applyMatrix4(m); vn.applyMatrix3(nm).normalize(); }
      this.v(vp, vn, uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0, [c[0] * k, c[1] * k, c[2] * k, c[3]], r, typeof f === 'function' ? f(vp) : f);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.I.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.I.push(base + i);
    g.dispose();
    return this;
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, this.alfa ? 4 : 3));
    g.setAttribute('region', new THREE.Float32BufferAttribute(this.R, 4));
    g.setAttribute('flex', new THREE.Float32BufferAttribute(this.F, 1));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// Caja con coordenadas de textura en metros / tam (giro cambia u por v para vetas verticales)
function gCaja(w, h, d, { tam = 1, giro = false, segY = 1 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d, 1, segY, 1);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + w / 2, y = p.getY(i) + h / 2, z = p.getZ(i) + d / 2;
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    let a, b;
    if (ax > 0.5) { a = z; b = y; } else if (ay > 0.5) { a = x; b = z; } else { a = x; b = y; }
    if (giro) [a, b] = [b, a];
    uv.setXY(i, a / tam, b / tam);
  }
  return g;
}
function gCilindro(r0, r1, h, seg, { tam = 1, tamV = tam, abierto = false, giro = false } = {}) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, abierto);
  const uv = g.attributes.uv, n = g.attributes.normal, R = Math.max(r0, r1);
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(n.getY(i)) < 0.75) {
      let a = (uv.getX(i) * TAU * R) / tam, b = (uv.getY(i) * h) / tamV;
      if (giro) [a, b] = [b, a];
      uv.setXY(i, a, b);
    } else uv.setXY(i, (uv.getX(i) * 2 * R) / tam, (uv.getY(i) * 2 * R) / tam);
  }
  return g;
}
function gTubo(a, b, r0, r1, seg, { tam = 1, tamV = tam } = {}) {
  const d = V().subVectors(b, a), len = Math.max(1e-4, d.length());
  const g = gCilindro(r0, r1, len, seg, { tam, tamV, abierto: true });
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(EJE_Y, d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
function gPlano(w, h) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.003 + uv.getX(i) * 0.994, 0.003 + uv.getY(i) * 0.994);
  return g;
}
// invierte caras y normales (interior de tubos y baldes)
function invertir(g) {
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  const ix = g.index;
  for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, a); }
  return g;
}
const M4 = (x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V(s, s, s));

// Constructor de piezas con una matriz base (marco local del objeto)
function piezas(malla, base = new THREE.Matrix4()) {
  const k = {
    malla, base,
    m: (x, y, z, o = {}) => base.clone().multiply(M4(x, y, z, o.ry || 0, o.rx || 0, o.rz || 0)),
    caja(w, h, d, r, color, x, y, z, o = {}) { malla.geo(gCaja(w, h, d, o), r, color, { m: k.m(x, y, z, o), sucio: o.sucio, f: o.f }); return k; },
    cil(r0, r1, h, seg, r, color, x, y, z, o = {}) { malla.geo(gCilindro(r0, r1, h, seg, o), r, color, { m: k.m(x, y, z, o), sucio: o.sucio }); return k; },
    tubo(a, b, r0, r1, seg, r, color, o = {}) { malla.geo(gTubo(a, b, r0, r1, seg, o), r, color, { m: base }); return k; },
    plano(w, h, r, color, x, y, z, o = {}) { malla.geo(gPlano(w, h), r, color, { m: k.m(x, y, z, o) }); return k; },
    geo(g, r, color, x = 0, y = 0, z = 0, o = {}) { malla.geo(g, r, color, { m: k.m(x, y, z, o), sucio: o.sucio, f: o.f }); return k; },
    hijo(x, y, z, ry = 0, rx = 0, rz = 0) { return piezas(malla, base.clone().multiply(M4(x, y, z, ry, rx, rz))); },
  };
  return k;
}

// ------------------------------------------------------------------ material de atlas
// Cada vértice trae su región y la textura se repite dentro de ella con fract; textureGrad mantiene el nivel
// de detalle en los bordes de cada repetición. viento: mece hojas y pasto; sinVolteo: las dos caras usan la misma normal;
// mate: sin reflejos del cielo.
function parcheAtlas(mat, { viento = false, sinVolteo = false, mate = false, clave }) {
  const uTiempo = { value: 0 };
  mat.userData.tiempo = uTiempo;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTiempo = uTiempo;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 region;\nattribute float flex;\nvarying vec4 vRegion;\nvarying vec2 vUvA;\nuniform float uTiempo;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRegion = region; vUvA = uv;');
    if (viento) {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
  vec2 base = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
  #else
  vec2 base = (modelMatrix * vec4(position, 1.0)).xz;
  #endif
  float fase = dot(base, vec2(0.11, 0.17));
  float onda = sin(uTiempo * 1.3 + fase) * 0.65 + sin(uTiempo * 2.3 + fase * 1.7) * 0.35;
  float temblor = sin(uTiempo * 6.0 + dot(position, vec3(3.1, 2.3, 2.9)));
  transformed.x += flex * (onda * 0.07 + temblor * 0.014);
  transformed.z += flex * (onda * 0.05 + temblor * 0.011);
  transformed.y += flex * temblor * 0.008;
}`);
    }
    let fs = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec4 vRegion;
varying vec2 vUvA;
vec4 atlas(sampler2D t) {
  vec2 uv = vRegion.xy + fract(vUvA) * vRegion.zw;
  return textureGrad(t, uv, dFdx(vUvA) * vRegion.zw, dFdy(vUvA) * vRegion.zw);
}`);
    fs = fs.replace('#include <map_fragment>', '#ifdef USE_MAP\n  diffuseColor *= atlas(map);\n#endif')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness;\n#ifdef USE_ROUGHNESSMAP\n  roughnessFactor *= atlas(roughnessMap).g;\n#endif')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness;\n#ifdef USE_METALNESSMAP\n  metalnessFactor *= atlas(metalnessMap).b;\n#endif')
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.split('texture2D( normalMap, vNormalMapUv )').join('atlas( normalMap )'));
    if (sinVolteo) fs = fs.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    // mate: los calcos del suelo no reflejan el cielo en ángulo rasante (se verían como franjas claras)
    if (mate) fs = fs.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n  reflectedLight.indirectSpecular *= 0.25;');
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'atlas-' + clave;
  return mat;
}

// ------------------------------------------------------------------ atlas de objetos (16 celdas de 256 px)
function pintoresObjetos() {
  const n = fbmP;
  const c1 = n(4, 4, 4, 11), c2 = n(24, 24, 2, 12), cS = n(18, 2, 3, 13), cO = n(8, 8, 3, 14);
  const mA = n(5, 5, 4, 21), mB = n(40, 40, 2, 22), mR = n(60, 3, 2, 23);
  const gA = n(10, 10, 2, 31), gB = n(3, 3, 3, 32), gC = n(50, 50, 2, 33);
  const xA = n(4, 4, 5, 41), xB = n(20, 20, 3, 42), xC = n(64, 64, 2, 43);
  const wW = n(2, 6, 3, 51), wF = n(6, 40, 2, 52), wK = n(4, 8, 2, 53), wG = n(3, 3, 3, 54);
  const lA = n(30, 30, 2, 61), lB = n(4, 4, 3, 62);
  const hA = n(5, 5, 5, 71), hB = n(32, 32, 3, 72), hC = n(2, 2, 3, 73), hP = n(90, 90, 1, 74);
  const pA = n(4, 4, 3, 81), pB = n(30, 30, 2, 82);
  const kA = n(6, 6, 3, 91), kB = n(80, 80, 1, 92), kC = n(3, 12, 2, 93);
  const vA = n(3, 3, 4, 101), vB = n(12, 12, 2, 102);
  const gm = n(20, 20, 3, 111);
  const tA = n(6, 6, 4, 121), tB = n(28, 28, 2, 122), tP = n(40, 40, 1, 123);
  const lnA = n(4, 4, 3, 131);
  const f = (fn, normal) => Object.assign(fn, { normal });
  return {
    // chapa acanalada de contenedor: 4 nervaduras trapezoidales por metro, chorreaduras y puntos de óxido
    chapa: f((u, v, o) => {
      const ph = (u * 4) % 1;
      const pr = ph < 0.35 ? 1 : ph < 0.45 ? 1 - (ph - 0.35) / 0.1 : ph < 0.9 ? 0 : (ph - 0.9) / 0.1;
      const a = c1(u, v), b = c2(u, v), s = sstep(0.55, 0.85, cS(u, v)), ox = sstep(0.74, 0.84, cO(u, v)) * (1 - pr * 0.6);
      const base = 0.8 + (a - 0.5) * 0.12 + (b - 0.5) * 0.05 - s * 0.1 + pr * 0.03;
      o[0] = base + ox * 0.1; o[1] = base - ox * 0.12; o[2] = base - ox * 0.28 - s * 0.02;
      o[3] = pr * 0.8 + b * 0.05; o[4] = 0.5 + s * 0.15 + ox * 0.3; o[5] = 0.25 - ox * 0.2;
    }, 3),
    // metal pintado liso con rayas
    metal: f((u, v, o) => {
      const a = mA(u, v), b = mB(u, v), r = 1 - Math.abs(mR(u, v) * 2 - 1), ray = sstep(0.93, 0.99, r) * sstep(0.5, 0.7, a);
      const base = 0.8 + (a - 0.5) * 0.1 + (b - 0.5) * 0.04;
      o[0] = base + ray * 0.1; o[1] = base + ray * 0.1; o[2] = base + ray * 0.12;
      o[3] = b * 0.15 - ray * 0.2; o[4] = 0.42 + (1 - a) * 0.12 - ray * 0.1; o[5] = 0.15 + ray * 0.6;
    }, 1.2),
    // acero galvanizado con flor de zinc
    acero: f((u, v, o) => {
      const q = Math.floor(gA(u, v) * 7) / 7, b = gB(u, v), c = gC(u, v);
      const base = 0.66 + (q - 0.5) * 0.14 + (b - 0.5) * 0.08 + (c - 0.5) * 0.03, bl = sstep(0.7, 0.85, b) * 0.12;
      o[0] = base + bl; o[1] = base + bl; o[2] = base * 1.03 + bl;
      o[3] = c * 0.1; o[4] = 0.32 + q * 0.15 + bl; o[5] = 0.9 - bl * 2;
    }, 0.6),
    // acero con óxido (vigas y fierro)
    oxido: f((u, v, o) => {
      const a = xA(u, v), b = xB(u, v), c = xC(u, v), rr = sstep(0.38, 0.62, a * 0.7 + b * 0.3);
      const sr = 0.34 + (c - 0.5) * 0.06;
      o[0] = lerp(sr, 0.46 + (b - 0.5) * 0.12, rr); o[1] = lerp(sr, 0.25 + (b - 0.5) * 0.06, rr); o[2] = lerp(sr * 1.04, 0.13, rr);
      o[3] = rr * 0.5 + c * 0.2; o[4] = lerp(0.5, 0.88, rr); o[5] = lerp(0.65, 0.08, rr);
    }, 2),
    // pino aserrado con vetas, nudos y madera agrisada
    madera: f((u, v, o) => {
      const vet = 0.5 + 0.5 * Math.sin((v * 22 + wW(u, v) * 4) * TAU), fib = wF(u, v);
      const nudo = sstep(0.8, 0.86, wK(u, v)), gris = sstep(0.55, 0.8, wG(u, v)) * 0.45;
      let r = 0.78 - vet * 0.1 - fib * 0.06, g = 0.62 - vet * 0.09 - fib * 0.05, b = 0.43 - vet * 0.07 - fib * 0.04;
      r = lerp(lerp(r, 0.42, nudo), 0.6, gris); g = lerp(lerp(g, 0.28, nudo), 0.58, gris); b = lerp(lerp(b, 0.17, nudo), 0.54, gris);
      o[0] = r; o[1] = g; o[2] = b; o[3] = vet * 0.3 + fib * 0.3 - nudo * 0.3; o[4] = 0.78 + gris * 0.15; o[5] = 0;
    }, 1.5),
    // ladrillos apilados (0,6 m): 8 hileras y 2 ladrillos por hilera, con ranuras
    ladrillo: f((u, v, o) => {
      const fy = v * 8, fila = Math.floor(fy), ry = fy - fila, fx = u * 2 + (fila % 2) * 0.5, colm = Math.floor(fx), rx = fx - colm;
      if (ry < 0.12 || rx < 0.03) { o[0] = 0.13; o[1] = 0.11; o[2] = 0.1; o[3] = 0; o[4] = 0.95; o[5] = 0; return; }
      const t = hash(fila * 2 + (colm % 2), 9), a = lA(u, v), b = lB(u, v), sur = 0.5 + 0.5 * Math.sin(ry * 4 * TAU);
      const k = 0.82 + t * 0.28 + (a - 0.5) * 0.12;
      o[0] = 0.64 * k; o[1] = 0.31 * k * (0.94 + b * 0.12); o[2] = 0.2 * k; o[3] = 0.7 + sur * 0.07 + a * 0.05; o[4] = 0.9; o[5] = 0;
    }, 2.6),
    hormigon: f((u, v, o) => {
      const a = hA(u, v), b = hB(u, v), c = hC(u, v), p = sstep(0.82, 0.9, hP(u, v));
      const base = 0.62 + (a - 0.5) * 0.16 + (b - 0.5) * 0.06 - sstep(0.6, 0.85, c) * 0.08 - p * 0.15;
      o[0] = base; o[1] = base * 0.99; o[2] = base * 0.96; o[3] = a * 0.5 + b * 0.3 - p * 0.4; o[4] = 0.88 + b * 0.1; o[5] = 0;
    }, 1.6),
    plastico: f((u, v, o) => {
      const a = pA(u, v), b = pB(u, v), base = 0.88 + (a - 0.5) * 0.05 - sstep(0.7, 0.9, a) * 0.06;
      o[0] = base; o[1] = base; o[2] = base; o[3] = b * 0.05; o[4] = 0.38 + (1 - a) * 0.12; o[5] = 0;
    }, 0.6),
    // papel de saco con fibras y pliegues
    papel: f((u, v, o) => {
      const a = kA(u, v), fi = kB(u, v), pl = sstep(0.75, 0.95, kC(u, v)), base = 0.76 + (a - 0.5) * 0.08 + (fi - 0.5) * 0.05 - pl * 0.06;
      o[0] = base; o[1] = base * 0.96; o[2] = base * 0.87; o[3] = fi * 0.15 + pl * 0.4; o[4] = 0.86; o[5] = 0;
    }, 1.4),
    vidrio: f((u, v, o) => {
      const a = vA(u, v), b = vB(u, v), s = sstep(0.55, 0.8, a);
      o[0] = 0.1 + s * 0.05; o[1] = 0.12 + s * 0.05; o[2] = 0.14 + s * 0.05; o[3] = 0; o[4] = 0.04 + s * 0.18 + b * 0.04; o[5] = 0;
    }, 0),
    goma: f((u, v, o) => {
      const a = gm(u, v), base = 0.075 + (a - 0.5) * 0.03;
      o[0] = base; o[1] = base; o[2] = base * 1.05; o[3] = a * 0.3; o[4] = 0.85; o[5] = 0;
    }, 1),
    tierra: f((u, v, o) => {
      const a = tA(u, v), b = tB(u, v), pe = sstep(0.78, 0.86, tP(u, v)), k = 0.85 + (a - 0.5) * 0.35;
      o[0] = lerp(0.38 * k, 0.62, pe); o[1] = lerp(0.3 * k, 0.58, pe); o[2] = lerp(0.22 * k, 0.52, pe);
      o[3] = a * 0.5 + pe * 0.5 + b * 0.2; o[4] = 0.95; o[5] = 0;
    }, 2.5),
    // lona de polietileno (tejido fino)
    lona: f((u, v, o) => {
      const w = Math.sin(u * 80 * TAU) * Math.sin(v * 80 * TAU), a = lnA(u, v), base = 0.82 + w * 0.04 + (a - 0.5) * 0.08;
      o[0] = base; o[1] = base; o[2] = base; o[3] = 0.5 + w * 0.2 + a * 0.3; o[4] = 0.55 + (1 - a) * 0.15; o[5] = 0;
    }, 1),
    // celosía de láminas (aire acondicionado, peldaños)
    rejilla: f((u, v, o) => {
      const ph = (v * 10) % 1, lam = ph < 0.7 ? ph / 0.7 : 1 - (ph - 0.7) / 0.3, base = 0.5 + lam * 0.32;
      o[0] = base; o[1] = base; o[2] = base * 1.02; o[3] = lam; o[4] = 0.45; o[5] = 0.55;
    }, 2),
  };
}

function textoAjustado(g, texto, x, y, ancho, tam, peso = 800) {
  let t = tam;
  do { g.font = `${peso} ${t}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`; t -= 1; } while (g.measureText(texto).width > ancho && t > 6);
  g.fillText(texto, x, y);
}

function atlasObjetos() {
  const N = 1024, C = 256, T = 240, G = 8;
  const cv = lienzo(N, N), cn = lienzo(N, N), co = lienzo(N, N), g = cv.getContext('2d');
  const img = g.createImageData(N, N), nor = cn.getContext('2d').createImageData(N, N), orm = co.getContext('2d').createImageData(N, N);
  const R = {}, reg = (x, y, w, h) => [x / N, 1 - (y + h) / N, w / N, h / N];
  const nombres = ['chapa', 'metal', 'acero', 'oxido', 'madera', 'ladrillo', 'hormigon', 'plastico', 'papel', 'vidrio', 'goma', 'tierra', 'lona', 'rotulos', 'rotulos2', 'rejilla'];
  const P = pintoresObjetos();
  const o = new Float32Array(6), hg = new Float32Array(T * T), cb = new Float32Array(T * T * 3), rb = new Float32Array(T * T), mb = new Float32Array(T * T);
  nombres.forEach((nombre, k) => {
    const cx = (k % 4) * C, cy = Math.floor(k / 4) * C, f = P[nombre];
    R[nombre] = reg(cx + G, cy + G, T, T);
    if (!f) {
      for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
        const d = ((cy + j) * N + cx + i) * 4;
        nor.data[d] = 128; nor.data[d + 1] = 128; nor.data[d + 2] = 255; nor.data[d + 3] = 255;
        orm.data[d] = 255; orm.data[d + 1] = 125; orm.data[d + 2] = 0; orm.data[d + 3] = 255; img.data[d + 3] = 255;
      }
      return;
    }
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      f(i / T, j / T, o);
      const s = j * T + i;
      cb[s * 3] = o[0]; cb[s * 3 + 1] = o[1]; cb[s * 3 + 2] = o[2]; hg[s] = o[3]; rb[s] = o[4]; mb[s] = o[5];
    }
    const fz = f.normal;
    for (let j = -G; j < T + G; j++) for (let i = -G; i < T + G; i++) {
      const si = (i + T) % T, sj = (j + T) % T, s = sj * T + si, d = ((cy + G + j) * N + cx + G + i) * 4;
      img.data[d] = clamp(cb[s * 3], 0, 1) * 255; img.data[d + 1] = clamp(cb[s * 3 + 1], 0, 1) * 255; img.data[d + 2] = clamp(cb[s * 3 + 2], 0, 1) * 255; img.data[d + 3] = 255;
      const xm = (si - 1 + T) % T, xp = (si + 1) % T, ym = (sj - 1 + T) % T, yp = (sj + 1) % T;
      const nx = -(hg[sj * T + xp] - hg[sj * T + xm]) * fz, ny = (hg[yp * T + si] - hg[ym * T + si]) * fz, l = Math.hypot(nx, ny, 1);
      nor.data[d] = (nx / l * 0.5 + 0.5) * 255; nor.data[d + 1] = (ny / l * 0.5 + 0.5) * 255; nor.data[d + 2] = (1 / l * 0.5 + 0.5) * 255; nor.data[d + 3] = 255;
      orm.data[d] = 255; orm.data[d + 1] = clamp(rb[s], 0, 1) * 255; orm.data[d + 2] = clamp(mb[s], 0, 1) * 255; orm.data[d + 3] = 255;
    }
  });
  g.putImageData(img, 0, 0);
  cn.getContext('2d').putImageData(nor, 0, 0);
  co.getContext('2d').putImageData(orm, 0, 0);

  // rótulos (celdas 13 y 14): placas con texto y pictogramas
  const r13 = [256, 768], r14 = [512, 768];
  const placa = (cel, x, y, w, h, fondo, nombre) => {
    g.fillStyle = fondo; g.fillRect(cel[0] + x, cel[1] + y, w, h);
    R[nombre] = reg(cel[0] + x + 2, cel[1] + y + 2, w - 4, h - 4);
    return [cel[0] + x, cel[1] + y];
  };
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [y, texto, nombre] of [[0, 'OFICINA TÉCNICA', 'rotOficina'], [64, 'BODEGA', 'rotBodega'], [128, 'COMEDOR', 'rotComedor']]) {
    const [x0, y0] = placa(r13, 0, y, 256, 64, '#1f4f8c', nombre);
    g.strokeStyle = '#e8eef5'; g.lineWidth = 3; g.strokeRect(x0 + 5, y0 + 5, 246, 54);
    g.fillStyle = '#ffffff'; textoAjustado(g, texto, x0 + 128, y0 + 33, 228, 34);
  }
  {
    const [x0, y0] = placa(r13, 0, 192, 128, 64, '#1f4f8c', 'rotBano');
    g.fillStyle = '#ffffff';
    const persona = (cx, mujer) => {
      g.beginPath(); g.arc(cx, y0 + 15, 6, 0, TAU); g.fill();
      if (mujer) { g.beginPath(); g.moveTo(cx, y0 + 22); g.lineTo(cx - 12, y0 + 46); g.lineTo(cx + 12, y0 + 46); g.fill(); g.fillRect(cx - 6, y0 + 46, 4, 12); g.fillRect(cx + 2, y0 + 46, 4, 12); }
      else { g.fillRect(cx - 8, y0 + 23, 16, 22); g.fillRect(cx - 7, y0 + 45, 5, 14); g.fillRect(cx + 2, y0 + 45, 5, 14); }
    };
    persona(x0 + 38, false); persona(x0 + 90, true);
    g.fillRect(x0 + 63, y0 + 8, 2, 50);
  }
  {
    const [x0, y0] = placa(r13, 128, 192, 128, 64, '#2f8a3d', 'rotLibre');
    g.fillStyle = '#ffffff'; textoAjustado(g, 'LIBRE', x0 + 64, y0 + 33, 110, 34);
  }
  {
    const [x0, y0] = placa(r14, 0, 0, 64, 64, '#14874a', 'rotAuxilio');
    g.fillStyle = '#ffffff'; g.fillRect(x0 + 25, y0 + 11, 14, 42); g.fillRect(x0 + 11, y0 + 25, 42, 14);
  }
  {
    // riesgo eléctrico: triángulo amarillo con borde negro y rayo
    const [x0, y0] = placa(r14, 64, 0, 64, 64, '#ffffff', 'rotRiesgo');
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(x0 + 32, y0 + 4); g.lineTo(x0 + 61, y0 + 58); g.lineTo(x0 + 3, y0 + 58); g.closePath(); g.fill();
    g.fillStyle = '#f2c21b'; g.beginPath(); g.moveTo(x0 + 32, y0 + 13); g.lineTo(x0 + 54, y0 + 54); g.lineTo(x0 + 10, y0 + 54); g.closePath(); g.fill();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(x0 + 35, y0 + 22); g.lineTo(x0 + 26, y0 + 39); g.lineTo(x0 + 33, y0 + 39); g.lineTo(x0 + 28, y0 + 52); g.lineTo(x0 + 40, y0 + 34); g.lineTo(x0 + 33, y0 + 34); g.closePath(); g.fill();
  }
  {
    // zona de seguridad (punto de reunión de la obra): verde con texto blanco y flechas hacia el centro
    const [x0, y0] = placa(r14, 0, 64, 128, 64, '#1b8a3e', 'rotZona');
    g.strokeStyle = '#ffffff'; g.lineWidth = 2.5; g.strokeRect(x0 + 4, y0 + 4, 120, 56);
    // las dos líneas se traducen juntas: «SEGURIDAD» sola ya se traduce como el final de «LENTES DE SEGURIDAD»
    const [l1, l2] = tr('ZONA DE\nSEGURIDAD').split('\n');
    g.fillStyle = '#ffffff'; textoAjustado(g, l1, x0 + 82, y0 + 22, 72, 17); textoAjustado(g, l2, x0 + 82, y0 + 42, 74, 17);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, cx = x0 + 25, cy = y0 + 32; g.save(); g.translate(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13); g.rotate(a + Math.PI); g.beginPath(); g.moveTo(6, 0); g.lineTo(-3, -5); g.lineTo(-3, 5); g.closePath(); g.fill(); g.restore(); }
    g.beginPath(); g.arc(x0 + 25, y0 + 32, 4, 0, TAU); g.fill();
  }
  {
    const [x0, y0] = placa(r14, 128, 0, 128, 128, '#c8261e', 'rotExtintor');
    g.fillStyle = '#ffffff';
    g.beginPath(); g.roundRect(x0 + 50, y0 + 30, 28, 62, 9); g.fill();
    g.fillRect(x0 + 58, y0 + 18, 12, 14); g.fillRect(x0 + 62, y0 + 12, 22, 6);
    g.beginPath(); g.moveTo(x0 + 82, y0 + 15); g.lineTo(x0 + 96, y0 + 36); g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.stroke();
    textoAjustado(g, 'EXTINTOR', x0 + 64, y0 + 110, 112, 20);
  }
  {
    const [x0, y0] = placa(r14, 0, 128, 256, 64, '#ffffff', 'rotProhibido');
    g.strokeStyle = '#c8261e'; g.lineWidth = 5; g.strokeRect(x0 + 4, y0 + 4, 248, 56);
    g.fillStyle = '#c8261e'; textoAjustado(g, 'PROHIBIDO EL PASO', x0 + 128, y0 + 22, 230, 22); textoAjustado(g, 'A PERSONAS AJENAS A LA OBRA', x0 + 128, y0 + 44, 230, 16, 700);
  }
  {
    const [x0, y0] = placa(r14, 0, 192, 256, 64, '#f2c21b', 'rotPrecaucion');
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 4; g.strokeRect(x0 + 4, y0 + 4, 248, 56);
    g.fillStyle = '#1a1a1a'; textoAjustado(g, 'PRECAUCIÓN', x0 + 128, y0 + 22, 230, 22); textoAjustado(g, 'SALIDA DE CAMIONES', x0 + 128, y0 + 45, 230, 17, 700);
  }
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  return { R, color: tex(cv, true), normal: tex(cn, false), orm: tex(co, false) };
}

// ------------------------------------------------------------------ atlas de vegetación (con mipmaps que conservan la cobertura)
function hoja(g, x, y, L, W, ang, fill, deltoide = false) {
  g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = fill;
  g.beginPath();
  if (deltoide) { g.moveTo(-L / 2, 0); g.quadraticCurveTo(-L * 0.25, -W * 1.1, L / 2, 0); g.quadraticCurveTo(-L * 0.25, W * 1.1, -L / 2, 0); }
  else { g.moveTo(-L / 2, 0); g.quadraticCurveTo(-L * 0.05, -W, L / 2, 0); g.quadraticCurveTo(-L * 0.05, W, -L / 2, 0); }
  g.fill();
  g.strokeStyle = 'rgba(20,32,12,0.4)'; g.lineWidth = 0.7; g.stroke();
  g.strokeStyle = 'rgba(235,245,205,0.22)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L * 0.4, 0); g.stroke();
  g.restore();
}
// racimo de hojas con contorno irregular y ramitas; luz desde arriba
function racimo(g, x0, y0, S, rnd, { n, largo, ancho, tono, sat, luz, alargado = [1, 1], deltoide = false, ramitas = 7, bayas = 0, flores = 0 }) {
  const cx = x0 + S / 2, cy = y0 + S / 2, R = S * 0.45;
  const fases = [rnd() * TAU, rnd() * TAU, rnd() * TAU];
  const forma = (a) => 0.82 + 0.1 * Math.sin(3 * a + fases[0]) + 0.07 * Math.sin(5 * a + fases[1]) + 0.05 * Math.sin(8 * a + fases[2]);
  g.lineCap = 'round';
  for (let k = 0; k < ramitas; k++) {
    const a = rnd() * TAU, l = R * forma(a) * (0.55 + 0.35 * rnd());
    g.strokeStyle = `rgb(${70 + rnd() * 20},${54 + rnd() * 14},${38 + rnd() * 10})`; g.lineWidth = 3.2 - k * 0.25;
    g.beginPath(); g.moveTo(cx + (rnd() - 0.5) * S * 0.08, y0 + S * 0.97);
    g.quadraticCurveTo(cx + Math.cos(a) * l * 0.3, cy + S * 0.15, cx + Math.cos(a) * l * alargado[0], cy + Math.sin(a) * l * alargado[1]); g.stroke();
  }
  const hojas = [];
  let intentos = 0;
  while (hojas.length < n && intentos++ < n * 30) {
    const a = rnd() * TAU, rr = Math.sqrt(rnd()), f = forma(a);
    const x = cx + Math.cos(a) * rr * R * alargado[0] * f, y = cy + Math.sin(a) * rr * R * alargado[1] * f;
    const L = largo * (0.7 + 0.6 * rnd());
    if (x < x0 + L * 0.6 || x > x0 + S - L * 0.6 || y < y0 + L * 0.6 || y > y0 + S - L * 0.6) continue;
    const alto = 1 - (y - y0) / S, borde = rr;
    hojas.push({ x, y, L, W: ancho * (0.75 + 0.5 * rnd()), ang: a + (rnd() - 0.5) * 1.6, luz: clamp(0.35 + 0.4 * alto + 0.35 * borde + (rnd() - 0.5) * 0.35, 0, 1.2) });
  }
  hojas.sort((p, q) => p.luz - q.luz);
  for (const h of hojas) {
    const l = luz * (0.62 + 0.55 * h.luz);
    hoja(g, h.x, h.y, h.L, h.W, h.ang, `hsl(${tono + (rnd() - 0.5) * 16},${sat + (rnd() - 0.5) * 14}%,${l}%)`, deltoide);
  }
  for (let k = 0; k < bayas; k++) {
    const a = rnd() * TAU, rr = Math.sqrt(rnd()) * R * 0.8 * forma(a);
    g.fillStyle = rnd() < 0.6 ? '#1d1222' : '#5a1c2a'; g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2.6 + rnd() * 1.5, 0, TAU); g.fill();
  }
  for (let k = 0; k < flores; k++) {
    const a = rnd() * TAU, rr = Math.sqrt(rnd()) * R * 0.85 * forma(a), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    g.fillStyle = '#f4efe6'; for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(x + Math.cos(p * 1.257) * 2.6, y + Math.sin(p * 1.257) * 2.6, 2, 0, TAU); g.fill(); }
    g.fillStyle = '#e0c040'; g.beginPath(); g.arc(x, y, 1.2, 0, TAU); g.fill();
  }
}
function agujas(g, x0, y0, S, rnd) {
  const cx = x0 + S * 0.5;
  g.lineCap = 'round';
  const tallo = [];
  for (let k = 0; k <= 8; k++) { const t = k / 8; tallo.push([cx + Math.sin(t * 2.4) * S * 0.06, y0 + S * (0.95 - t * 0.8)]); }
  g.strokeStyle = '#5c4232'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(...tallo[0]); for (const p of tallo) g.lineTo(...p); g.stroke();
  const centros = [];
  for (let k = 2; k <= 8; k++) centros.push({ p: tallo[k], dir: -Math.PI / 2 + (rnd() - 0.5) * 0.4, n: 70 });
  for (let k = 0; k < 6; k++) {
    const b = tallo[2 + Math.floor(rnd() * 5)], lado = k % 2 ? 1 : -1, a = -Math.PI / 2 + lado * (0.7 + rnd() * 0.5), l = S * (0.18 + rnd() * 0.1);
    const e = [b[0] + Math.cos(a) * l, b[1] + Math.sin(a) * l];
    g.strokeStyle = '#5c4232'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(...b); g.lineTo(...e); g.stroke();
    centros.push({ p: e, dir: a, n: 55 });
  }
  for (const c of centros) {
    for (let k = 0; k < c.n; k++) {
      const a = c.dir + (rnd() - 0.5) * 2.6, l = S * (0.07 + rnd() * 0.09);
      const x1 = clamp(c.p[0] + Math.cos(a) * l, x0 + 3, x0 + S - 3), y1 = clamp(c.p[1] + Math.sin(a) * l, y0 + 3, y0 + S - 3);
      g.strokeStyle = `hsl(${138 + rnd() * 22},${28 + rnd() * 14}%,${15 + rnd() * 17}%)`; g.lineWidth = 1.2 + rnd() * 0.7;
      g.beginPath(); g.moveTo(c.p[0], c.p[1]); g.quadraticCurveTo((c.p[0] + x1) / 2 + (rnd() - 0.5) * 6, (c.p[1] + y1) / 2 + (rnd() - 0.5) * 6, x1, y1); g.stroke();
    }
  }
}
function pasto(g, x0, y0, S, rnd, { n, alto, tono, sat, luz, seco = 0, espigas = 0, flores = 0, hojasAnchas = 0 }) {
  const hojasP = [];
  for (let k = 0; k < n; k++) hojasP.push({ bx: x0 + S * (0.12 + 0.76 * rnd()), h: S * alto * (0.45 + 0.55 * rnd()), lean: (rnd() - 0.5) * S * 0.4, w: 2.5 + rnd() * 4, l: rnd() });
  hojasP.sort((a, b) => a.l - b.l);
  for (const b of hojasP) {
    const s = rnd() < seco;
    g.fillStyle = s ? `hsl(${38 + rnd() * 14},${35 + rnd() * 15}%,${40 + rnd() * 16}%)` : `hsl(${tono + (rnd() - 0.5) * 18},${sat + (rnd() - 0.5) * 14}%,${luz * (0.6 + 0.6 * b.l)}%)`;
    const yb = y0 + S - 1, xt = b.bx + b.lean, yt = yb - b.h;
    g.beginPath(); g.moveTo(b.bx - b.w / 2, yb);
    g.quadraticCurveTo(b.bx + b.lean * 0.25, yb - b.h * 0.6, xt, yt);
    g.quadraticCurveTo(b.bx + b.lean * 0.25 + b.w * 0.35, yb - b.h * 0.6, b.bx + b.w / 2, yb); g.fill();
    if (espigas && rnd() < espigas) {
      g.fillStyle = `hsl(${40 + rnd() * 10},40%,${52 + rnd() * 14}%)`;
      for (let e = 0; e < 6; e++) { g.beginPath(); g.ellipse(xt - b.lean * 0.04 * e, yt + e * 4, 2.2, 3.6, b.lean * 0.004, 0, TAU); g.fill(); }
    }
  }
  for (let k = 0; k < hojasAnchas; k++) {
    const x = x0 + S * (0.2 + 0.6 * rnd()), y = y0 + S * (0.75 + 0.2 * rnd());
    hoja(g, x, y, S * 0.2, S * 0.05, -Math.PI / 2 + (rnd() - 0.5) * 2.2, `hsl(${100 + rnd() * 20},40%,${24 + rnd() * 12}%)`);
  }
  for (let k = 0; k < flores; k++) {
    const x = x0 + S * (0.18 + 0.64 * rnd()), y = y0 + S * (0.25 + 0.4 * rnd());
    g.strokeStyle = 'hsl(100,35%,30%)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 8, y0 + S - 2); g.stroke();
    g.fillStyle = rnd() < 0.75 ? '#efc531' : '#f3f0e6'; g.beginPath(); g.arc(x, y, 4 + rnd() * 2.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(160,110,20,0.7)'; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
  }
}
// corteza: fisuras verticales con líquenes (generica) o placas rojizas (pino)
function cortezaPixeles(data, N, x0, y0, w, h, pino, semilla) {
  const n1 = fbmP(pino ? 3 : 6, 2, 4, semilla), n2 = fbmP(4, 10, 3, semilla + 5), n3 = fbmP(3, 6, 3, semilla + 9);
  const cel = [], cu = 4, cvv = 9, rnd = mulberry32(semilla + 3);
  for (let j = 0; j < cvv; j++) for (let i = 0; i < cu; i++) cel.push([(i + rnd()) / cu, (j + rnd()) / cvv, rnd()]);
  const alt = new Float32Array(w * h), col = new Float32Array(w * h * 3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = i / w, v = j / h, s = j * w + i;
    let r, g, b, a;
    if (!pino) {
      const val = n1(u, v), ridge = Math.abs(val - 0.5) * 2, fis = 1 - sstep(0.04, 0.16, ridge), m = n2(u, v), li = sstep(0.68, 0.78, n3(u, v));
      const k = 0.82 + (m - 0.5) * 0.5;
      r = 0.4 * k; g = 0.35 * k; b = 0.3 * k;
      r = lerp(r, 0.52, li * 0.7); g = lerp(g, 0.56, li * 0.7); b = lerp(b, 0.46, li * 0.7);
      r = lerp(r, 0.1, fis); g = lerp(g, 0.085, fis); b = lerp(b, 0.07, fis);
      a = (1 - fis) * 0.7 + m * 0.3;
    } else {
      let d1 = 9, d2 = 9, id = 0;
      for (const c of cel) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const dx = (c[0] + ox - u) * cu, dy = (c[1] + oy - v) * cvv * 0.55, d = Math.hypot(dx, dy);
        if (d < d1) { d2 = d1; d1 = d; id = c[2]; } else if (d < d2) d2 = d;
      }
      const borde = 1 - sstep(0.04, 0.16, d2 - d1), m = n2(u, v), k = 0.8 + id * 0.35 + (m - 0.5) * 0.25, esc = sstep(0.62, 0.75, n3(u, v));
      r = 0.5 * k; g = 0.31 * k; b = 0.22 * k;
      r = lerp(r, 0.55, esc * 0.6); g = lerp(g, 0.5, esc * 0.6); b = lerp(b, 0.45, esc * 0.6);
      r = lerp(r, 0.09, borde); g = lerp(g, 0.07, borde); b = lerp(b, 0.06, borde);
      a = (1 - borde) * 0.8 + m * 0.2;
    }
    alt[s] = a; col[s * 3] = r; col[s * 3 + 1] = g; col[s * 3 + 2] = b;
  }
  return { alt, col, escribir(G) {
    for (let j = -G; j < h + G; j++) for (let i = -G; i < w + G; i++) {
      const si = (i + w) % w, sj = (j + h) % h, s = sj * w + si, d = ((y0 + j) * N + x0 + i) * 4;
      data[d] = col[s * 3] * 255; data[d + 1] = col[s * 3 + 1] * 255; data[d + 2] = col[s * 3 + 2] * 255; data[d + 3] = 255;
    }
  } };
}

function atlasVegetacion() {
  const N = 1024, cv = lienzo(N, N), g = cv.getContext('2d');
  g.clearRect(0, 0, N, N);
  const R = {}, reg = (x, y, w, h) => [x / N, 1 - (y + h) / N, w / N, h / N];
  const rnd = mulberry32(41);
  // hojas y pasto (lienzo)
  racimo(g, 256, 0, 384, rnd, { n: 520, largo: 17, ancho: 6.5, tono: 98, sat: 42, luz: 30, ramitas: 8 });                    // roble
  racimo(g, 640, 0, 384, rnd, { n: 470, largo: 19, ancho: 9, tono: 84, sat: 48, luz: 36, alargado: [0.78, 1.08], deltoide: true }); // álamo
  agujas(g, 256, 384, 384, rnd);                                                                                                  // pino
  racimo(g, 640, 384, 384, rnd, { n: 560, largo: 14, ancho: 6, tono: 112, sat: 36, luz: 24, ramitas: 10, bayas: 26, flores: 14 }); // zarzamora
  pasto(g, 0, 512, 256, rnd, { n: 70, alto: 0.95, tono: 92, sat: 45, luz: 34, seco: 0.12 });
  pasto(g, 0, 768, 256, rnd, { n: 62, alto: 0.9, tono: 70, sat: 40, luz: 40, seco: 0.55, espigas: 0.45 });
  pasto(g, 256, 768, 256, rnd, { n: 34, alto: 0.7, tono: 100, sat: 40, luz: 30, hojasAnchas: 9, flores: 6 });
  pasto(g, 512, 768, 256, rnd, { n: 90, alto: 0.55, tono: 96, sat: 48, luz: 33, seco: 0.06 });
  pasto(g, 768, 768, 256, rnd, { n: 40, alto: 0.75, tono: 88, sat: 44, luz: 36, flores: 14, seco: 0.15 });
  Object.assign(R, {
    roble: reg(258, 2, 380, 380), alamo: reg(642, 2, 380, 380), pino: reg(258, 386, 380, 380), arbusto: reg(642, 386, 380, 380),
    pasto: reg(2, 514, 252, 252), pastoSeco: reg(2, 770, 252, 252), maleza: reg(258, 770, 252, 252), pastoCorto: reg(514, 770, 252, 252), flores: reg(770, 770, 252, 252),
  });
  const img = g.getImageData(0, 0, N, N), d = img.data;
  // corteza en las dos columnas de la izquierda (se repite: márgenes de 8 px)
  const altura = new Float32Array(N * N).fill(0.5);
  for (const [x0, pino, nombre] of [[8, false, 'corteza'], [136, true, 'cortezaPino']]) {
    const c = cortezaPixeles(d, N, x0, 8, 112, 496, pino, pino ? 61 : 51);
    c.escribir(8);
    for (let j = -8; j < 504; j++) for (let i = -8; i < 120; i++) altura[(8 + j) * N + x0 + i] = c.alt[((j + 496) % 496) * 112 + ((i + 112) % 112)];
    R[nombre] = reg(x0, 8, 112, 496);
  }
  // los píxeles transparentes toman el color medio de su región (sin bordes oscuros al filtrar)
  const zonas = [[256, 0, 384, 384], [640, 0, 384, 384], [256, 384, 384, 384], [640, 384, 384, 384], [0, 512, 256, 256], [0, 768, 256, 256], [256, 768, 256, 256], [512, 768, 256, 256], [768, 768, 256, 256]];
  rellenarTransparentes(d, N, zonas);
  // textura con filas invertidas (v crece hacia arriba) y mipmaps propios que conservan la cobertura de las hojas
  const datos = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) datos.set(d.subarray((N - 1 - j) * N * 4, (N - j) * N * 4), j * N * 4);
  const niveles = mipmapsCobertura(datos, N, N, zonas.map(([x, y, w, h]) => [x, N - y - h, w, h]));
  const tex = new THREE.DataTexture(niveles[0].data, N, N, THREE.RGBAFormat);
  tex.mipmaps = niveles; tex.generateMipmaps = false; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true;
  // relieve: solo la corteza
  const nd = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const s = j * N + i, xm = Math.max(0, i - 1), xp = Math.min(N - 1, i + 1), ym = Math.max(0, j - 1), yp = Math.min(N - 1, j + 1);
    const nx = -(altura[j * N + xp] - altura[j * N + xm]) * 3, ny = (altura[yp * N + i] - altura[ym * N + i]) * 3, l = Math.hypot(nx, ny, 1);
    const k = ((N - 1 - j) * N + i) * 4;
    nd[k] = (nx / l * 0.5 + 0.5) * 255; nd[k + 1] = (ny / l * 0.5 + 0.5) * 255; nd[k + 2] = (1 / l * 0.5 + 0.5) * 255; nd[k + 3] = 255;
    void s;
  }
  const texN = new THREE.DataTexture(nd, N, N, THREE.RGBAFormat);
  texN.generateMipmaps = true; texN.minFilter = THREE.LinearMipmapLinearFilter; texN.wrapS = texN.wrapT = THREE.RepeatWrapping; texN.needsUpdate = true;
  return { R, tex, texN, lienzo: cv };
}

// ------------------------------------------------------------------ calcos sobre el suelo (huellas, camino, manchas, grava y tierra)
function atlasCalcos() {
  const W = 1024, N = 512, d = new Uint8Array(W * N * 4), alt = new Float32Array(W * N);
  const nh = fbmP(3, 12, 3, 201), nc = fbmP(4, 16, 4, 202), np = fbmP(30, 120, 1, 203), nm = fbmP(6, 6, 4, 204), nm2 = fbmP(9, 9, 3, 205);
  const pon = (i, j, r, g, b, a) => { const k = (j * W + i) * 4; d[k] = clamp(r, 0, 1) * 255; d[k + 1] = clamp(g, 0, 1) * 255; d[k + 2] = clamp(b, 0, 1) * 255; d[k + 3] = clamp(a, 0, 1) * 255; };
  for (let j = 0; j < N; j++) for (let i = 0; i < 128; i++) {
    // huella de neumático: tacos en V, bordes suaves (u a lo ancho, v a lo largo, 0,6 m por repetición)
    const u = i / 128, v = j / N, ph = (v * 8 + Math.abs(u - 0.5) * 1.2) % 1, taco = ph < 0.55 && u > 0.1 && u < 0.9 ? 1 : 0;
    const borde = sstep(0, 0.12, u) * sstep(1, 0.88, u), m = nh(u, v);
    pon(i, j, 0.25 - taco * 0.06, 0.205 - taco * 0.05, 0.16 - taco * 0.04, borde * (0.42 + taco * 0.28) * (0.75 + 0.35 * m));
    alt[j * W + i] = borde * (0.5 - taco * 0.5);
    // camino de tierra
    const m2 = nc(u, v), pe = sstep(0.8, 0.9, np(u, v));
    pon(128 + i, j, lerp(0.44 * (0.8 + 0.4 * m2), 0.66, pe), lerp(0.37 * (0.8 + 0.4 * m2), 0.62, pe), lerp(0.28 * (0.8 + 0.4 * m2), 0.55, pe), sstep(0, 0.2, u) * sstep(1, 0.8, u) * (0.75 + 0.25 * m2));
    alt[j * W + 128 + i] = m2 * 0.6 + pe * 0.5;
  }
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
    const u = i / 256 - 0.5, v = j / 256 - 0.5, r = Math.hypot(u, v) * 2, a = Math.atan2(v, u);
    const rr = r / (0.72 + 0.25 * nm((a / TAU + 0.5), 0.3)), m = nm(u + 0.5, v + 0.5);
    pon(256 + i, j, 0.92 + m * 0.08, 0.92 + m * 0.08, 0.92 + m * 0.08, Math.pow(clamp(1 - rr * rr, 0, 1), 1.3) * (0.7 + 0.3 * m));
    const m3 = nm2(u + 0.5, v + 0.5), sal = sstep(0.55, 0.7, m3) * clamp(1 - r * r, 0, 1);
    pon(256 + i, 256 + j, 0.95, 0.95, 0.95, sal * 0.9);
  }
  // carpeta de grava compactada (512..768) y tierra apisonada (768..1024): repetibles, con piedras en relieve
  const piedras = (x0, celda, prob, rMin, rMax, tono, semilla) => {
    const rnd = mulberry32(semilla), n = 256 / celda;
    for (let cj = 0; cj < n; cj++) for (let ci = 0; ci < n; ci++) for (let s = 0; s < 2; s++) {
      if (rnd() > prob) continue;
      const cx = (ci + rnd()) * celda, cy = (cj + rnd()) * celda, ra = rMin + rnd() * (rMax - rMin), rb = ra * (0.6 + rnd() * 0.4), an = rnd() * Math.PI;
      const gris = tono[0] + rnd() * tono[1], ti = (rnd() - 0.5) * 0.1, ca = Math.cos(an), sa = Math.sin(an), R = Math.ceil(ra) + 1;
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
        const lx = x * ca + y * sa, ly = -x * sa + y * ca, q = (lx * lx) / (ra * ra) + (ly * ly) / (rb * rb);
        if (q >= 1) continue;
        const i = (((Math.floor(cx) + x) % 256) + 256) % 256, j = (((Math.floor(cy) + y) % 256) + 256) % 256, k = j * W + x0 + i;
        const h = 0.55 + Math.sqrt(1 - q) * 0.45 * (ra / rMax);
        if (h <= alt[k]) continue;
        alt[k] = h;
        const luz = 0.86 + 0.24 * (1 - q) - 0.12 * (lx / ra);
        pon(x0 + i, j, gris * luz * (1 + ti), gris * luz, gris * luz * (1 - ti * 0.8), 1);
      }
    }
  };
  {
    const a = fbmP(4, 4, 4, 211), b = fbmP(32, 32, 2, 212), e = fbmP(3, 3, 3, 213);
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
      const u = i / 256, v = j / 256, m = a(u, v), f = b(u, v), hum = sstep(0.62, 0.8, e(u, v)) * 0.16, k = (0.84 + (m - 0.5) * 0.3 + (f - 0.5) * 0.12) * (1 - hum);
      pon(512 + i, j, 0.57 * k, 0.54 * k, 0.49 * k, 1); alt[j * W + 512 + i] = 0.25 * f;
      const m2 = a(v, u), f2 = b(v, u), hum2 = sstep(0.58, 0.78, e(v, u)) * 0.22, k2 = (0.82 + (m2 - 0.5) * 0.34 + (f2 - 0.5) * 0.14) * (1 - hum2);
      pon(768 + i, j, 0.47 * k2, 0.385 * k2, 0.29 * k2, 1); alt[j * W + 768 + i] = 0.3 * f2 + 0.15 * m2;
    }
    piedras(512, 9, 0.95, 1.6, 4.4, [0.38, 0.36], 221);
    piedras(512, 6, 0.6, 0.9, 2.0, [0.3, 0.4], 222);
    piedras(768, 22, 0.55, 1.2, 3.2, [0.3, 0.26], 223);
  }
  // relieve: normales desde las alturas (cada región se repite sobre sí misma)
  const nd = new Uint8Array(W * N * 4), regiones = [[0, 128, 0, 512], [128, 128, 0, 512], [512, 256, 0, 256], [768, 256, 0, 256]];
  for (let k = 0; k < W * N; k++) { nd[k * 4] = 128; nd[k * 4 + 1] = 128; nd[k * 4 + 2] = 255; nd[k * 4 + 3] = 255; }
  for (const [x0, w, y0, h] of regiones) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const A = (ii, jj) => alt[(y0 + ((jj + h) % h)) * W + x0 + ((ii + w) % w)];
    const nx = -(A(i + 1, j) - A(i - 1, j)) * 2.2, ny = -(A(i, j + 1) - A(i, j - 1)) * 2.2, l = Math.hypot(nx, ny, 1), k = ((y0 + j) * W + x0 + i) * 4;
    nd[k] = (nx / l * 0.5 + 0.5) * 255; nd[k + 1] = (ny / l * 0.5 + 0.5) * 255; nd[k + 2] = (1 / l * 0.5 + 0.5) * 255;
  }
  const tex = new THREE.DataTexture(d, W, N, THREE.RGBAFormat);
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true;
  const normal = new THREE.DataTexture(nd, W, N, THREE.RGBAFormat);
  normal.generateMipmaps = true; normal.minFilter = THREE.LinearMipmapLinearFilter; normal.anisotropy = 4; normal.wrapS = normal.wrapT = THREE.RepeatWrapping; normal.needsUpdate = true;
  const reg = (x, y, w, h) => [x / W, y / N, w / W, h / N];
  return { tex, normal, R: { huella: reg(0, 0, 128, 512), camino: reg(128, 0, 128, 512), mancha: reg(258, 2, 252, 252), salpicado: reg(258, 258, 252, 252), grava: reg(512, 0, 256, 256), tierra: reg(768, 0, 256, 256) } };
}

// malla del cerco: alambre electrosoldado (izquierda) y malla raschel (derecha); 0,3 m por repetición
function texturaCerco() {
  const W = 256, H = 128, d = new Uint8Array(W * H * 4), n = fbmP(8, 8, 3, 301);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = (j * W + i) * 4;
    if (i < 128) {
      const dx = Math.min(i % 32, 32 - (i % 32)), dy = Math.min(j % 64, 64 - (j % 64));
      const a = Math.max(1 - sstep(0.6, 1.6, dx), 1 - sstep(0.7, 1.8, dy));
      d[k] = 168; d[k + 1] = 172; d[k + 2] = 176; d[k + 3] = a * 255;
    } else {
      const u = i - 128, x = (u + j) % 8, y = (u - j + 128) % 8, hueco = x < 2 && y < 2 ? 1 : 0, m = n(u / 128, j / 128);
      d[k] = 30 + m * 16; d[k + 1] = 70 + m * 22; d[k + 2] = 44 + m * 14; d[k + 3] = (0.9 - hueco * 0.7) * 255;
    }
  }
  const tex = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true;
  return { tex, R: { alambre: [0, 0, 0.5, 1], raschel: [0.5, 0, 0.5, 1] } };
}

// ------------------------------------------------------------------ árboles (modelo cercano por especie)
// Tarjeta de hojas: normal mezclada con la dirección desde el centro de la copa (luz volumétrica) y oscurecida
// hacia adentro (oclusión). Las dos caras usan la misma normal.
function tarjeta(m, c, tam, reg, rnd, cc, radio, { vertical = 0, flex = 0.6, alto = 1, tinte = [1, 1, 1], giro = true }) {
  const out = V().subVectors(c, cc); if (out.lengthSq() < 1e-6) out.set(0, 1, 0); out.normalize();
  const nrm = out.clone().add(V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.6)).normalize();
  if (vertical) { nrm.y *= 1 - vertical; nrm.normalize(); }
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), nrm);
  const rol = rnd() * TAU;
  if (giro) q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), rol));
  const ej = [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [-0.5, 0.5, 0, 1], [0.5, 0.5, 1, 1]];
  const base = m.n;
  for (const [x, y, u, v] of ej) {
    const p = V(x * tam, y * tam * alto, 0).applyQuaternion(q).add(c);
    const dir = V().subVectors(p, cc).normalize();
    const nn = dir.multiplyScalar(0.72).add(nrm.clone().multiplyScalar(0.28)).normalize();
    const prof = clamp(p.distanceTo(cc) / radio, 0, 1.2), ao = (0.5 + 0.5 * prof) * (0.85 + 0.15 * clamp(dir.y + 0.5, 0, 1));
    m.v(p, nn, 0.004 + u * 0.992, 0.004 + v * 0.992, [ao * tinte[0], ao * tinte[1], ao * tinte[2]], reg, flex);
  }
  m.I.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  // registro para pintar las vistas lejanas del mismo árbol
  if (m.racimos) {
    const prof = clamp(c.distanceTo(cc) / radio, 0, 1.2);
    m.racimos.push({ c: c.clone(), tam, alto, nrm, reg, rol: giro ? rol : 0, luz: (0.5 + 0.5 * prof) * (0.85 + 0.15 * clamp(out.y + 0.5, 0, 1)) * (tinte[0] + tinte[1] + tinte[2]) / 3 });
  }
}
function tronco(m, a, b, r0, r1, seg, reg, color, tamV = 3.5) {
  m.geo(gTubo(a, b, r0, r1, seg, { tam: 0.8, tamV }), reg, color);
  if (m.ramas) m.ramas.push({ a: a.clone(), b: b.clone(), r0, r1, reg, color });
}

function geometriaArbol(especie, R) {
  const m = new Malla(), rnd = mulberry32({ roble: 5, alamo: 7, pino: 11, arbusto: 13 }[especie]);
  m.racimos = []; m.ramas = [];
  const cort = R.corteza, cortP = R.cortezaPino;
  const fin = (sombra) => ({ geo: m.geometria(), sombra, racimos: m.racimos, ramas: m.ramas });
  if (especie === 'roble') {
    const H = 15, ht = 4.2, r0 = 0.4, lean = V(0.25, 0, -0.15);
    const mid = V(lean.x * 0.4 + 0.06, ht * 0.5, lean.z * 0.4 - 0.05), top = V(lean.x, ht, lean.z);
    tronco(m, V(0, -0.3, 0), mid, r0, r0 * 0.84, 9, cort, 0x9a8c7c);
    tronco(m, mid, top, r0 * 0.84, r0 * 0.68, 9, cort, 0x9a8c7c);
    for (let k = 0; k < 5; k++) { const a = k * 1.3 + 0.4; tronco(m, V(Math.cos(a) * 0.12, 0.7, Math.sin(a) * 0.12), V(Math.cos(a) * 0.85, -0.12, Math.sin(a) * 0.85), 0.2, 0.05, 5, cort, 0x8a7c6c, 1.5); }
    const copas = [];
    const nr = 5;
    for (let i = 0; i < nr; i++) {
      const az = (i / nr) * TAU + rnd() * 0.7, el = 0.62 + rnd() * 0.4, len = 3.8 + rnd() * 1.8;
      const base = top.clone().add(V(0, -rnd() * 0.7, 0));
      const dir = V(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
      const f1 = base.clone().addScaledVector(dir, len);
      tronco(m, base, f1, r0 * 0.48, 0.07, 7, cort, 0x9a8c7c);
      copas.push({ c: f1.clone().add(V(0, 0.7, 0)), r: 2.5 + rnd() * 0.8 });
      const p = base.clone().lerp(f1, 0.5 + rnd() * 0.15);
      const d2 = dir.clone().applyAxisAngle(EJE_Y, (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.4)); d2.y += 0.45; d2.normalize();
      const f2 = p.clone().addScaledVector(d2, 2 + rnd() * 1.2);
      tronco(m, p, f2, 0.09, 0.03, 5, cort, 0x9a8c7c);
      copas.push({ c: f2.clone().add(V(0, 0.5, 0)), r: 1.8 + rnd() * 0.6 });
    }
    copas.push({ c: V(lean.x, H - 2.7, lean.z), r: 3.0 + rnd() * 0.5 });
    const cc = copas.reduce((s, k) => s.add(k.c), V()).multiplyScalar(1 / copas.length), radio = 5.5;
    // racimos repartidos en cada masa de la copa, más densos hacia afuera, donde llega la luz
    for (const k of copas) {
      const nh = Math.round(k.r * 8.5);
      for (let j = 0; j < nh; j++) { const dir = V(rnd() - 0.5, rnd() - 0.35, rnd() - 0.5).normalize(); tarjeta(m, k.c.clone().addScaledVector(dir, k.r * (0.35 + 0.65 * Math.sqrt(rnd()))), 1.9 + rnd() * 0.8, R.roble, rnd, cc, radio, { flex: 0.5 + 0.5 * k.c.y / H }); }
    }
    return fin(7.5);
  }
  if (especie === 'alamo') {
    // álamo de Lombardía: copa columnar y densa desde los 2 m, con ramas que suben pegadas al tronco
    const H = 21, y0 = 1.8, Rmax = 2.0;
    const rc = (t) => Rmax * Math.pow(Math.sin(Math.PI * (0.08 + 0.92 * t)), 0.7) * (1 - 0.35 * t) + 0.3;
    const eje = (y) => V(0.1 * y / H, y, -0.05 * y / H);
    tronco(m, V(0, -0.3, 0), eje(H * 0.9), 0.36, 0.05, 8, cort, 0xc4bcb0, 4);
    for (let k = 0; k < 22; k++) {
      const t = 0.03 + (k / 22) * 0.85, y = y0 + t * (H - y0) * 0.92, az = k * 2.4 + rnd() * 0.8, l = rc(t) * (0.9 + rnd() * 0.3);
      const a = eje(y), b = a.clone().add(V(Math.cos(az) * l * 0.5, l * 1.25, Math.sin(az) * l * 0.5));
      tronco(m, a, b, 0.07 * (1 - t) + 0.025, 0.012, 4, cort, 0xc4bcb0, 2);
    }
    for (let k = 0; k < 170; k++) {
      const t = Math.pow(rnd(), 0.85), y = y0 + 0.5 + t * (H - y0 - 0.4), az = rnd() * TAU, rr = rc(t) * (0.3 + 0.7 * Math.sqrt(rnd())), e = eje(y);
      tarjeta(m, V(e.x + Math.cos(az) * rr, y, e.z + Math.sin(az) * rr), 1.45 + rnd() * 0.6, R.alamo, rnd, e, Rmax, { vertical: 0.45, flex: 0.3 + 0.9 * y / H, alto: 1.25 });
    }
    return fin(3.6);
  }
  if (especie === 'pino') {
    // pino radiata de plantación: fuste limpio con muñones de poda y copa densa de verticilos
    const H = 25, yc = H * 0.44;
    const eje = (y) => V(-0.15 * y / H, y, 0.1 * y / H);
    tronco(m, V(0, -0.3, 0), V(-0.15, H, 0.1), 0.38, 0.05, 8, cortP, 0x8f9a9c, 3);
    const cc = V(-0.08, (yc + H) / 2, 0.05), radio = 3.5;
    const Lr = (t) => 0.6 + 3.1 * Math.pow(1 - t, 0.8);
    for (let k = 0; k < 6; k++) { const y = 2.2 + k * 1.5, az = rnd() * TAU; tronco(m, eje(y), eje(y).add(V(Math.cos(az) * 0.35, -0.08, Math.sin(az) * 0.35)), 0.035, 0.012, 3, cortP, 0x6f6a66, 1); }
    for (let y = yc; y < H - 0.6; y += 1.4) {
      const t = (y - yc) / (H - yc), nb = 4 + (rnd() < 0.4 ? 1 : 0), fase = rnd() * TAU;
      for (let b = 0; b < nb; b++) {
        const az = fase + (b / nb) * TAU + (rnd() - 0.5) * 0.5, L = Lr(t) * (0.8 + 0.4 * rnd()), el = -0.15 + 0.45 * t + rnd() * 0.12;
        const a = eje(y), dir = V(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)), e = a.clone().addScaledVector(dir, L);
        tronco(m, a, e, 0.07 * (1 - t) + 0.025, 0.012, 4, cortP, 0x7a7470, 1.5);
        for (const fr of [0.45, 0.75, 1.02]) tarjeta(m, a.clone().addScaledVector(dir, L * fr).add(V(0, 0.15, 0)), 1.3 + 0.8 * (1 - t) + rnd() * 0.3, R.pino, rnd, cc, radio, { flex: 0.25 + 0.6 * y / H, vertical: 0.25 });
      }
    }
    // núcleo de la copa y guía terminal
    for (let y = yc + 0.7; y < H; y += 1.1) tarjeta(m, eje(y).add(V((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5)), 1.3 + 0.6 * (1 - (y - yc) / (H - yc)), R.pino, rnd, cc, radio, { flex: 0.5, vertical: 0.6 });
    for (let k = 0; k < 4; k++) tarjeta(m, V(-0.15 + (rnd() - 0.5) * 0.6, H - 0.6 + rnd() * 0.6, 0.1 + (rnd() - 0.5) * 0.6), 1.3, R.pino, rnd, cc, radio, { flex: 0.9 });
    return fin(4.2);
  }
  // arbusto (zarzamora y matorral): montículo de tarjetas
  const w = 1.6, h = 1.3, cc = V(0, h * 0.25, 0);
  for (let k = 0; k < 22; k++) {
    const a = rnd() * TAU, rr = Math.sqrt(rnd());
    tarjeta(m, V(Math.cos(a) * rr * w, h * (0.2 + 0.65 * rnd()) * (1 - rr * 0.4), Math.sin(a) * rr * w), 1.0 + rnd() * 0.5, R.arbusto, rnd, cc, w, { flex: 0.25 });
  }
  return fin(1.9);
}

// ------------------------------------------------------------------ mipmaps que conservan la cobertura de las hojas
// Promedia el color ponderado por la opacidad y, en cada zona, sube el alfa para que la fracción de píxeles visibles
// sea la del nivel base: así el follaje no se ralea con la distancia. datos: filas de abajo hacia arriba.
function mipmapsCobertura(datos, W, H, zonas) {
  const niveles = [{ data: datos, width: W, height: H }];
  const cobertura0 = zonas.map(([x, y, w, h]) => { let c = 0; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (datos[(j * W + i) * 4 + 3] > 107) c++; return c / (w * h); });
  let w0 = W, h0 = H, prev = datos;
  while (w0 > 1 || h0 > 1) {
    const w1 = Math.max(1, w0 >> 1), h1 = Math.max(1, h0 >> 1), nuevo = new Uint8Array(w1 * h1 * 4);
    for (let j = 0; j < h1; j++) for (let i = 0; i < w1; i++) {
      let r = 0, g = 0, b = 0, al = 0, ws = 0;
      for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) {
        const k = (Math.min(h0 - 1, j * 2 + oy) * w0 + Math.min(w0 - 1, i * 2 + ox)) * 4, w = prev[k + 3] + 1;
        r += prev[k] * w; g += prev[k + 1] * w; b += prev[k + 2] * w; al += prev[k + 3]; ws += w;
      }
      const k = (j * w1 + i) * 4;
      nuevo[k] = r / ws; nuevo[k + 1] = g / ws; nuevo[k + 2] = b / ws; nuevo[k + 3] = al / 4;
    }
    const ex = W / w1, ey = H / h1;
    zonas.forEach(([x, y, w, h], z) => {
      const x1 = Math.floor(x / ex), y1 = Math.floor(y / ey), wz = Math.max(1, Math.floor(w / ex)), hz = Math.max(1, Math.floor(h / ey));
      const al = [];
      for (let j = y1; j < y1 + hz; j++) for (let i = x1; i < x1 + wz; i++) al.push(nuevo[(j * w1 + i) * 4 + 3]);
      al.sort((p, q) => q - p);
      const objetivo = al[Math.min(al.length - 1, Math.floor(cobertura0[z] * al.length))];
      const f = objetivo > 0 ? clamp(108 / objetivo, 1, 4) : 1;
      if (f > 1.01) for (let j = y1; j < y1 + hz; j++) for (let i = x1; i < x1 + wz; i++) { const k = (j * w1 + i) * 4 + 3; nuevo[k] = Math.min(255, nuevo[k] * f); }
    });
    niveles.push({ data: nuevo, width: w1, height: h1 });
    prev = nuevo; w0 = w1; h0 = h1;
  }
  return niveles;
}
// los píxeles transparentes toman el color medio de su zona (sin bordes oscuros al filtrar); d: datos RGBA de un lienzo
function rellenarTransparentes(d, W, zonas) {
  for (const [x0, y0, w, h] of zonas) {
    let sr = 0, sg = 0, sb = 0, sn = 0;
    for (let j = y0; j < y0 + h; j++) for (let i = x0; i < x0 + w; i++) { const k = (j * W + i) * 4; if (d[k + 3] > 200) { sr += d[k]; sg += d[k + 1]; sb += d[k + 2]; sn++; } }
    sn = Math.max(1, sn);
    for (let j = y0; j < y0 + h; j++) for (let i = x0; i < x0 + w; i++) { const k = (j * W + i) * 4; if (d[k + 3] < 10) { d[k] = sr / sn; d[k + 1] = sg / sn; d[k + 2] = sb / sn; d[k + 3] = 0; } }
  }
}

// ------------------------------------------------------------------ árboles lejanos (impostores de cuatro vistas)
// Cada especie se pinta desde cuatro direcciones a partir de su propio modelo cercano: ramas y tronco como trazos y cada
// racimo de hojas como un sprite del atlas, de atrás hacia adelante y con la oclusión del modelo. Lejos, cada árbol es un
// solo cuadrilátero que gira hacia la cámara y muestra la vista pintada más cercana a la dirección desde la que se mira.
const VISTAS = 4;
const CELDAS_LEJOS = { pino: [0, 0, 192, 512], alamo: [768, 0, 160, 512], roble: [0, 512, 384, 384] };   // x, y (desde arriba), ancho y alto de una vista
function atlasLejanos(VEG, modelos) {
  const W = 2048, H = 1024, cv = lienzo(W, H), g = cv.getContext('2d');
  g.clearRect(0, 0, W, H); g.imageSmoothingQuality = 'high';
  const fuentes = { roble: [256, 0], alamo: [640, 0], pino: [256, 384], arbusto: [640, 384] };
  // sprites de racimos en varios niveles de luz (el factor se aplica en lineal, como el color de vértice del modelo cercano)
  const NIV = 9, sprites = {};
  for (const [k, [sx, sy]] of Object.entries(fuentes)) {
    sprites[k] = [];
    for (let l = 0; l < NIV; l++) {
      const c = lienzo(128, 128), gc = c.getContext('2d'), f = Math.pow(0.42 + (l / (NIV - 1)) * 0.78, 1 / 2.2);
      gc.imageSmoothingQuality = 'high';
      gc.drawImage(VEG.lienzo, sx, sy, 384, 384, 0, 0, 128, 128);
      gc.globalCompositeOperation = 'source-atop';
      gc.fillStyle = f < 1 ? `rgba(0,0,0,${1 - f})` : `rgba(255,255,255,${(f - 1) * 0.45})`;
      gc.fillRect(0, 0, 128, 128);
      sprites[k].push(c);
    }
  }
  const especieDe = (reg) => Object.keys(fuentes).find((k) => VEG.R[k] === reg) || 'roble';
  // color medio de la corteza (textura por tinte, en lineal) para los trazos de ramas
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const colorRama = (r, sombra) => {
    const base = r.reg === VEG.R.cortezaPino ? [0.5, 0.31, 0.22] : [0.33, 0.29, 0.25], t = new THREE.Color(r.color);
    return new THREE.Color(lin(base[0]) * t.r * sombra, lin(base[1]) * t.g * sombra, lin(base[2]) * t.b * sombra).getStyle();
  };
  const datosEsp = {}, zonas = [];
  for (const [esp, [x0, y0, cw, ch]] of Object.entries(CELDAS_LEJOS)) {
    const mod = modelos[esp];
    let rMax = 0, yMax = 0;
    for (const s of mod.racimos) { rMax = Math.max(rMax, Math.hypot(s.c.x, s.c.z) + s.tam * 0.45); yMax = Math.max(yMax, s.c.y + s.tam * s.alto * 0.45); }
    for (const r of mod.ramas) for (const p of [r.a, r.b]) { rMax = Math.max(rMax, Math.hypot(p.x, p.z) + r.r0); yMax = Math.max(yMax, p.y); }
    const yMin = -0.3, pad = 6, esc = Math.min((cw - 2 * pad) / (2 * rMax), (ch - 2 * pad) / (yMax - yMin));
    for (let k = 0; k < VISTAS; k++) {
      const a = (k / VISTAS) * TAU, cx = Math.sin(a), cz = Math.cos(a), rx = Math.cos(a), rz = -Math.sin(a);
      const ox = x0 + k * cw + cw / 2, oy = y0 + ch - pad;
      const P = (p) => [ox + (p.x * rx + p.z * rz) * esc, oy - (p.y - yMin) * esc];
      const prof = (p) => p.x * cx + p.z * cz;
      const items = [];
      for (const r of mod.ramas) items.push({ d: (prof(r.a) + prof(r.b)) / 2 - 0.05, r });
      for (const s of mod.racimos) items.push({ d: prof(s.c), s });
      items.sort((p, q) => p.d - q.d);
      g.save(); g.beginPath(); g.rect(x0 + k * cw, y0, cw, ch); g.clip();
      for (const it of items) {
        if (it.r) {
          const [ax, ay] = P(it.r.a), [bx, by] = P(it.r.b), L = Math.hypot(bx - ax, by - ay);
          if (L < 0.3) continue;
          const nx = -(by - ay) / L, ny = (bx - ax) / L, w0 = Math.max(0.55, it.r.r0 * esc), w1 = Math.max(0.4, it.r.r1 * esc);
          const gr = g.createLinearGradient(ax - nx * w0, ay - ny * w0, ax + nx * w0, ay + ny * w0);
          gr.addColorStop(0, colorRama(it.r, 0.7)); gr.addColorStop(0.45, colorRama(it.r, 1.05)); gr.addColorStop(1, colorRama(it.r, 0.6));
          g.fillStyle = gr;
          g.beginPath(); g.moveTo(ax + nx * w0, ay + ny * w0); g.lineTo(bx + nx * w1, by + ny * w1); g.lineTo(bx - nx * w1, by - ny * w1); g.lineTo(ax - nx * w0, ay - ny * w0); g.closePath(); g.fill();
        } else {
          const s = it.s, [px, py] = P(s.c), f = 0.58 + 0.42 * Math.abs(s.nrm.x * cx + s.nrm.z * cz);
          const w = s.tam * esc * f, h = s.tam * s.alto * esc * (0.7 + 0.3 * f);
          const luz = s.luz * (0.92 + 0.12 * clamp(prof(s.c) / Math.max(1, rMax) + 0.5, 0, 1));
          const sp = sprites[especieDe(s.reg)][clamp(Math.round(((luz - 0.42) / 0.78) * (NIV - 1)), 0, NIV - 1)];
          g.save(); g.translate(px, py); g.rotate(s.rol); g.drawImage(sp, -w / 2, -h / 2, w, h); g.restore();
        }
      }
      g.restore();
      zonas.push([x0 + k * cw, y0, cw, ch]);
    }
    // cuadrilátero del impostor en metros (árbol a escala 1), con la base bajo el suelo como el modelo cercano
    const anchoM = cw / esc, altoM = ch / esc;
    datosEsp[esp] = { region: [x0 / W, 1 - (y0 + ch) / H, cw / W, ch / H], cuadro: [anchoM, altoM, yMin - pad / esc, esp === 'roble' ? 0 : 1] };
  }
  const img = g.getImageData(0, 0, W, H), d = img.data;
  cv.width = cv.height = 1;
  rellenarTransparentes(d, W, zonas);
  const datos = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) datos.set(d.subarray((H - 1 - j) * W * 4, (H - j) * W * 4), j * W * 4);
  const niveles = mipmapsCobertura(datos, W, H, zonas.map(([x, y, w, h]) => [x, H - y - h, w, h]));
  const tex = new THREE.DataTexture(datos, W, H, THREE.RGBAFormat);
  tex.mipmaps = niveles; tex.generateMipmaps = false; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
  return { tex, especies: datosEsp };
}

// Material de los impostores: el cuadrilátero se arma en el sombreador, de frente a la cámara y vertical, y su normal
// se curva hacia los bordes y hacia arriba para que el sol ilumine la copa como un volumen.
function materialLejos(tex) {
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.42, alphaToCoverage: true });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 region;\nattribute vec4 cuadro;')
      .replace('#include <uv_vertex>', `
#ifdef USE_INSTANCING
  mat4 mI = modelMatrix * instanceMatrix;
#else
  mat4 mI = modelMatrix;
#endif
  vec3 centroB = mI[3].xyz;
  float sxB = 0.5 * (length(mI[0].xyz) + length(mI[2].xyz)), syB = length(mI[1].xyz);
  vec2 dcB = cameraPosition.xz - centroB.xz;
  vec2 tcB = dcB / max(1e-4, length(dcB));
  vec3 haciaB = vec3(tcB.x, 0.0, tcB.y), derB = vec3(tcB.y, 0.0, -tcB.x);
  float angB = atan(dot(haciaB, normalize(mI[0].xyz)), dot(haciaB, normalize(mI[2].xyz)));
  float kB = mod(floor(angB * ${VISTAS}.0 / 6.2831853 + 0.5), ${VISTAS}.0);
  float azarB = fract(sin(dot(centroB.xz, vec2(12.9898, 78.233))) * 43758.5453);
  float uxB = (cuadro.w > 0.5 && azarB > 0.5) ? 1.0 - uv.x : uv.x;
  vec2 uvB = vec2(region.x + (kB + uxB) * region.z, region.y + uv.y * region.w);
  vec3 mundoB = centroB + derB * position.x * cuadro.x * sxB + vec3(0.0, (cuadro.z + position.y * cuadro.y) * syB, 0.0);
  vec3 normalB = normalize(haciaB * 0.8 + derB * (uv.x - 0.5) * 1.4 + vec3(0.0, uv.y * 0.9 - 0.25, 0.0));
#include <uv_vertex>
#ifdef USE_MAP
  vMapUv = uvB;
#endif`)
      .replace('#include <normal_vertex>', '#include <normal_vertex>\n  vNormal = normalize((viewMatrix * vec4(normalB, 0.0)).xyz);')
      .replace('#include <project_vertex>', 'vec4 mvPosition = viewMatrix * vec4(mundoB, 1.0);\n  gl_Position = projectionMatrix * mvPosition;')
      .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(mundoB, 1.0);');
  };
  mat.customProgramCacheKey = () => 'arbol-lejano';
  return mat;
}

// Todos los árboles lejanos en una sola malla instanciada: cada instancia lleva la región de su especie en el atlas y
// el tamaño de su cuadrilátero (ancho, alto, base y si admite espejo), así el bosque lejano completo es una llamada.
function mallaLejana(capacidad, mat) {
  capacidad = Math.max(1, capacidad);
  const L = arbolesCompartidos().lejos, geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  const region = new THREE.InstancedBufferAttribute(new Float32Array(capacidad * 4), 4), cuadro = new THREE.InstancedBufferAttribute(new Float32Array(capacidad * 4), 4);
  region.setUsage(THREE.DynamicDrawUsage); cuadro.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('region', region); geo.setAttribute('cuadro', cuadro);
  const malla = new THREE.InstancedMesh(geo, mat, capacidad);
  malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  malla.frustumCulled = false; malla.castShadow = false; malla.receiveShadow = false; malla.name = 'arboles lejanos';
  return {
    malla,
    poner(i, esp, m4, color) {
      const d = L.especies[esp];
      malla.setMatrixAt(i, m4); malla.setColorAt(i, color);
      region.setXYZW(i, d.region[0], d.region[1], d.region[2], d.region[3]); cuadro.setXYZW(i, d.cuadro[0], d.cuadro[1], d.cuadro[2], d.cuadro[3]);
    },
    cerrar(n) {
      malla.count = n; malla.visible = n > 0; malla.instanceMatrix.needsUpdate = true; region.needsUpdate = true; cuadro.needsUpdate = true;
      if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
    },
  };
}

// Atlas de vegetación, modelos cercanos y vistas lejanas: se preparan una sola vez y los comparten la obra y las
// estaciones que plantan sus propios árboles.
let arbolesListos = null;
function arbolesCompartidos() {
  if (arbolesListos) return arbolesListos;
  const VEG = atlasVegetacionCompartido(), modelos = {};
  for (const esp of ['roble', 'alamo', 'pino', 'arbusto']) modelos[esp] = geometriaArbol(esp, VEG.R);
  arbolesListos = { VEG, modelos, lejos: atlasLejanos(VEG, modelos) };
  // el lienzo de los racimos ya no se necesita: se libera su memoria
  VEG.lienzo.width = VEG.lienzo.height = 1; VEG.lienzo = null;
  return arbolesListos;
}

// ------------------------------------------------------------------ módulo principal
export function crearEntorno(ctx) {
  const { app, kit, sueloH, roadMask, LAYOUT, SITE, CERCO, distCerco, SENDEROS, estaciones, enVR } = ctx;
  const { scene, camera } = app;
  const rev = {};
  for (const par of (ctx.rev || '').split(',')) { const [k, v] = par.split(':'); if (k) rev[k] = v === undefined ? true : Number(v); }
  const raiz = new THREE.Group(); raiz.name = 'entorno'; scene.add(raiz);
  const ruido = new ImprovedNoise();
  const OBJ = atlasObjetos(), VEG = atlasVegetacionCompartido(), CAL = atlasCalcos();
  const RO = OBJ.R, RV = VEG.R, RC = CAL.R;

  const matObj = parcheAtlas(new THREE.MeshStandardMaterial({
    map: OBJ.color, normalMap: OBJ.normal, roughnessMap: OBJ.orm, metalnessMap: OBJ.orm, roughness: 1, metalness: 1, vertexColors: true, normalScale: new THREE.Vector2(0.9, 0.9),
  }), { clave: 'obj' });
  const matVeg = parcheAtlas(new THREE.MeshStandardMaterial({
    map: VEG.tex, normalMap: VEG.texN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.84, metalness: 0, vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.42, alphaToCoverage: true,
  }), { viento: true, sinVolteo: true, clave: 'veg' });
  const matLejos = materialLejos(arbolesCompartidos().lejos.tex);
  const matCalco = parcheAtlas(new THREE.MeshStandardMaterial({
    map: CAL.tex, normalMap: CAL.normal, normalScale: new THREE.Vector2(1, 1), transparent: true, depthWrite: false, vertexColors: true, roughness: 0.95, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  }), { mate: true, clave: 'calco' });
  const ondas = makeSurface('noiseNormal', { size: 256, seed: 33, repeat: [1, 1], roughness: false }).normalMap;
  const matAgua = new THREE.MeshStandardMaterial({ color: 0x2b2722, roughness: 0.04, metalness: 0, envMapIntensity: 3.2, normalMap: ondas, normalScale: new THREE.Vector2(0.08, 0.08), polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });

  // ---------------------------------------------------------------- zonas reservadas a las estaciones
  const zonas = [];
  for (const l of LAYOUT) zonas.push({ c: l.pos, r: l.id === 'autos' ? 45 : 22, id: l.id });
  zonas.push({ a: [-47.5, 13.5], b: [5.5, 68] }, { a: [-79, 2], b: [-41, 40] }, { c: [-32.1, 18.6], r: 6 }, { c: [-25.6, 13.1], r: 5 }, { c: [48.1, 3.6], r: 5 });
  const caja3 = new THREE.Box3(), tmp = V();
  for (const est of estaciones || []) {
    if (!est.api || est.error || est.id === 'autos') continue;
    est.grupo.updateMatrixWorld(true);
    const vr = est.api.vista?.vr?.pos, ce = est.api.vista?.escritorio?.camara;
    if (vr) { tmp.set(...vr).applyMatrix4(est.grupo.matrixWorld); zonas.push({ c: [tmp.x, tmp.z], r: 6 }); }
    if (ce) { tmp.set(...ce).applyMatrix4(est.grupo.matrixWorld); zonas.push({ c: [tmp.x, tmp.z], r: 4.5 }); }
    est.grupo.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      caja3.setFromObject(o);
      if (caja3.max.y < 0.9 && Math.max(caja3.max.x - caja3.min.x, caja3.max.z - caja3.min.z) > 3) zonas.push({ a: [caja3.min.x - 1, caja3.min.z - 1], b: [caja3.max.x + 1, caja3.max.z + 1] });
    });
  }
  const dentroZona = (q, x, z, m) => (q.c ? Math.hypot(x - q.c[0], z - q.c[1]) < q.r + m : x > q.a[0] - m && x < q.b[0] + m && z > q.a[1] - m && z < q.b[1] + m);
  const enZona = (x, z, m = 0) => zonas.some((q) => dentroZona(q, x, z, m));
  // para quien camina por un sendero solo cuentan su estación de destino, los suelos y los miradores
  const enZonaRuta = (x, z, id, m = 0) => zonas.some((q) => (!q.id || q.id === id) && dentroZona(q, x, z, m));
  const distSendero = (x, z) => {
    let d = Math.hypot(x, z) - 7.2;
    for (const s of SENDEROS) {
      const t = clamp(x * s.ux + z * s.uz, s.s0, s.s1);
      d = Math.min(d, Math.hypot(x - s.ux * t, z - s.uz * t) - 1.2);
    }
    return d;
  };
  const libre = (x, z, m = 0) => !enZona(x, z, m) && distSendero(x, z) > m + 0.3;

  // ---------------------------------------------------------------- cerco: paneles de malla sobre bases de hormigón
  const actualizables = [];
  {
    const L = 3.5, panel = new Malla(), k = piezas(panel);
    k.caja(0.2, 0.13, 0.66, RO.hormigon, 0xb9b4aa, 0, 0.055, 0, { sucio: [-0.07, 0.06, 0.35] });
    k.caja(0.12, 0.025, 0.12, RO.hormigon, 0x9d988f, 0, 0.13, 0);
    for (const x of [0.045, L - 0.045]) k.tubo(V(x, 0.04, 0), V(x, 2.05, 0), 0.021, 0.021, 6, RO.acero, 0xd2d6da);
    for (const y of [0.19, 2.03]) k.tubo(V(0.045, y, 0), V(L - 0.045, y, 0), 0.019, 0.019, 6, RO.acero, 0xd2d6da);
    k.tubo(V(L / 2, 0.19, 0), V(L / 2, 2.03, 0), 0.012, 0.012, 5, RO.acero, 0xc8ccd0);
    for (const y of [0.95, 1.85]) k.caja(0.13, 0.05, 0.055, RO.acero, 0xb0b4b8, 0, y, 0);
    const geoPanel = panel.geometria();
    const mallaG = new THREE.PlaneGeometry(L - 0.09, 1.84);
    mallaG.translate(L / 2, 0.19 + 0.92, 0);
    { const p = mallaG.attributes.position, uv = mallaG.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.3, p.getY(i) / 0.3); }
    mallaG.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(mallaG.attributes.position.count * 3).fill(1), 3));
    mallaG.setAttribute('flex', new THREE.Float32BufferAttribute(new Float32Array(mallaG.attributes.position.count), 1));
    const P = [], puerta = { x: (CERCO[8][0] + CERCO[9][0]) / 2, z: (CERCO[8][1] + CERCO[9][1]) / 2 };
    const rnd = mulberry32(77), lt = new Malla(), kl = piezas(lt);
    // puntal de estabilización por el lado de adentro: diagonal y tirante desde el poste a un bloque de hormigón
    const puntal = (px, pz, inx, inz) => {
      const y0 = sueloH(px, pz), bx = px + inx * 1.35, bz = pz + inz * 1.35, yb = sueloH(bx, bz);
      kl.tubo(V(px + inx * 0.04, y0 + 1.68, pz + inz * 0.04), V(bx, yb + 0.15, bz), 0.019, 0.019, 6, RO.acero, 0xc9cdd1);
      kl.tubo(V(px + inx * 0.06, y0 + 0.2, pz + inz * 0.06), V(bx - inx * 0.12, yb + 0.12, bz - inz * 0.12), 0.016, 0.016, 5, RO.acero, 0xc0c4c8);
      kl.caja(0.42, 0.13, 0.26, RO.hormigon, 0xaaa59b, bx + inx * 0.05, yb + 0.05, bz + inz * 0.05, { ry: -Math.atan2(inz, inx), sucio: [-0.065, 0.04, 0.35] });
      kl.caja(0.08, 0.07, 0.08, RO.acero, 0xb0b4b8, px + inx * 0.035, y0 + 1.68, pz + inz * 0.035);
    };
    for (let i = 0; i < CERCO.length; i++) {
      const [x0, z0] = CERCO[i], [x1, z1] = CERCO[(i + 1) % CERCO.length];
      const largo = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(largo / L)), ang = Math.atan2(z1 - z0, x1 - x0);
      let inx = -(z1 - z0) / largo, inz = (x1 - x0) / largo;
      if (distCerco((x0 + x1) / 2 + inx * 2, (z0 + z1) / 2 + inz * 2) > 0) { inx = -inx; inz = -inz; }
      for (let j = 0; j < n; j++) {
        const xa = lerp(x0, x1, j / n), za = lerp(z0, z1, j / n), xm = lerp(x0, x1, (j + 0.5) / n), zm = lerp(z0, z1, (j + 0.5) / n);
        if (Math.hypot(xm - puerta.x, zm - puerta.z) < 5) continue;
        const raschel = Math.hypot(xm - 70, zm - 62) < 42 || hash(i * 31 + j, 3) < 0.08;
        P.push({ x: xa, z: za, y: sueloH(xm, zm), ry: -ang + (rnd() - 0.5) * 0.02, sx: largo / n / L, raschel, inclina: (rnd() - 0.5) * 0.03 });
        if (j % 4 === 2 && !enZona(xa + inx * 1.4, za + inz * 1.4, 0)) puntal(xa + Math.cos(ang) * 0.045, za + Math.sin(ang) * 0.045, inx, inz);
      }
    }
    // portón: dos paneles corridos hacia adentro
    const a8 = CERCO[8], a9 = CERCO[9], ang = Math.atan2(a9[1] - a8[1], a9[0] - a8[0]), ux = Math.cos(ang), uz = Math.sin(ang);
    const nx = -uz, nz = ux, adentro = distCerco(puerta.x + nx * 2, puerta.z + nz * 2) < 0 ? 1 : -1;
    const bordeA = { x: puerta.x - ux * 4.4, z: puerta.z - uz * 4.4 }, bordeB = { x: puerta.x + ux * 4.4, z: puerta.z + uz * 4.4 };
    P.push({ x: bordeA.x - ux * 3.2 + nx * adentro * 1.1, z: bordeA.z - uz * 3.2 + nz * adentro * 1.1, y: 0, ry: -ang - 0.05, sx: 1, raschel: false, inclina: 0 });
    P.push({ x: bordeB.x + nx * adentro * 1.0, z: bordeB.z + nz * adentro * 1.0, y: 0, ry: -ang + 0.04, sx: 1, raschel: false, inclina: 0 });
    const solidos = new THREE.InstancedMesh(geoPanel, matObj, P.length), mallas = new THREE.InstancedMesh(mallaG, null, P.length);
    const regInst = new Float32Array(P.length * 4), TC = texturaCerco();
    const m4 = new THREE.Matrix4();
    P.forEach((p, i) => {
      m4.compose(V(p.x, p.y - 0.02, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(p.inclina, p.ry, 0, 'YXZ')), V(p.sx, 1, 1));
      solidos.setMatrixAt(i, m4); mallas.setMatrixAt(i, m4);
      regInst.set(p.raschel ? TC.R.raschel : TC.R.alambre, i * 4);
    });
    mallaG.setAttribute('region', new THREE.InstancedBufferAttribute(regInst, 4));
    mallas.material = parcheAtlas(new THREE.MeshStandardMaterial({ map: TC.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.3 }), { clave: 'cerco' });
    mallas.renderOrder = -1;
    solidos.receiveShadow = true;
    for (const o of [solidos, mallas]) { o.computeBoundingSphere(); raiz.add(o); }
    // letreros del portón (van en la misma malla que los puntales)
    const pc = bordeA, ry = -ang;
    kl.hijo(pc.x + nx * -adentro * 0.03, 0, pc.z + nz * -adentro * 0.03, ry).plano(1.2, 0.3, RO.rotProhibido, 0xffffff, -1.2, 1.35, adentro > 0 ? -0.02 : 0.02, { ry: adentro > 0 ? Math.PI : 0 });
    kl.hijo(bordeB.x, 0, bordeB.z, ry).plano(1.1, 0.28, RO.rotPrecaucion, 0xffffff, 1.6, 1.4, adentro > 0 ? -0.02 : 0.02, { ry: adentro > 0 ? Math.PI : 0 });
    const letreros = new THREE.Mesh(lt.geometria(), matObj); raiz.add(letreros);
  }

  // ---------------------------------------------------------------- árboles, matorrales y sombras de copa
  const especies = {};
  const listas = { roble: [], alamo: [], pino: [], arbusto: [] };
  {
    const rnd = mulberry32(19), celda = new Map();
    const clave = (x, z) => `${Math.floor(x / 6)},${Math.floor(z / 6)}`;
    const lejosDe = (x, z, r) => {
      const cx = Math.floor(x / 6), cz = Math.floor(z / 6);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of celda.get(`${cx + i},${cz + j}`) || []) if (Math.hypot(p[0] - x, p[1] - z) < r) return false;
      return true;
    };
    const marcar = (x, z) => { const k = clave(x, z); if (!celda.has(k)) celda.set(k, []); celda.get(k).push([x, z]); };
    const autos = LAYOUT.find((l) => l.id === 'autos').pos;
    const accesoA = [(CERCO[8][0] + CERCO[9][0]) / 2, (CERCO[8][1] + CERCO[9][1]) / 2], accesoB = [116, 103];
    const enAcceso = (x, z) => { const dx = accesoB[0] - accesoA[0], dz = accesoB[1] - accesoA[1], t = clamp(((x - accesoA[0]) * dx + (z - accesoA[1]) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(x - accesoA[0] - t * dx, z - accesoA[1] - t * dz) < 9; };
    const valido = (x, z, margen = 8) => Math.abs(x - SITE.x - 40) < 372 && Math.abs(z - SITE.z) < 372 && distCerco(x, z) > margen
      && !roadMask(x, z) && !roadMask(x + 7, z) && !roadMask(x - 7, z) && !roadMask(x, z + 7) && !roadMask(x, z - 7) && !enAcceso(x, z)
      && !(Math.abs(x - autos[0]) < 40 && Math.abs(z - autos[1]) < 40);
    const poner = (esp, x, z, s, extra = {}) => {
      marcar(x, z);
      listas[esp].push({ x, z, s, ry: rnd() * TAU, sx: 0.9 + rnd() * 0.2, sz: 0.9 + rnd() * 0.2, sy: 0.88 + rnd() * 0.24, t: 0.86 + rnd() * 0.22, h: rnd(), ...extra });
    };
    // hileras de álamos (cortinas cortavientos)
    for (const [xa, za, xb, zb] of [[-150, 130, 128, 130], [-142, -190, -142, 98], [-120, -138, 112, -138]]) {
      const L = Math.hypot(xb - xa, zb - za), n = Math.floor(L / 5.5);
      for (let i = 0; i <= n; i++) {
        const x = lerp(xa, xb, i / n) + (rnd() - 0.5) * 0.8, z = lerp(za, zb, i / n) + (rnd() - 0.5) * 0.8;
        if (valido(x, z) && rnd() > 0.06) poner('alamo', x, z, 0.85 + rnd() * 0.3);
      }
    }
    // robles nativos en bosquetes cerca de la obra
    let intentos = 0;
    while (listas.roble.length < 260 && intentos++ < 30000) {
      const ang = rnd() * TAU, r = 95 + Math.pow(rnd(), 1.4) * 260, x = SITE.x + 40 + Math.cos(ang) * r, z = SITE.z + Math.sin(ang) * r;
      if (ruido.noise(x / 45, 3.3, z / 45) < 0.02 || !valido(x, z) || !lejosDe(x, z, 7.5)) continue;
      poner('roble', x, z, 0.75 + rnd() * 0.45);
    }
    // plantaciones de pino en los cerros
    for (let x = -330; x < 430; x += 6.5) for (let z = -370; z < 390; z += 6.5) {
      if (listas.pino.length >= 1000) break;
      const px = x + (rnd() - 0.5) * 2, pz = z + (rnd() - 0.5) * 2, d = Math.hypot(px - SITE.x, pz - SITE.z);
      if (d < 205 || ruido.noise(px / 140, 7.7, pz / 140) < 0.12 || !valido(px, pz, 30) || !lejosDe(px, pz, 4.5)) continue;
      poner('pino', px, pz, 0.85 + rnd() * 0.3);
    }
    // matorrales junto al cerco y en los bordes de los bosquetes
    intentos = 0;
    while (listas.arbusto.length < 300 && intentos++ < 30000) {
      const ang = rnd() * TAU, r = 88 + Math.pow(rnd(), 1.6) * 190, x = SITE.x + 40 + Math.cos(ang) * r, z = SITE.z + Math.sin(ang) * r;
      const dc = distCerco(x, z), cerca = dc > 2.5 && dc < 9;
      if (!valido(x, z, 2.5) || (!cerca && ruido.noise(x / 45, 3.3, z / 45) < -0.05) || !lejosDe(x, z, 2.6)) continue;
      poner('arbusto', x, z, 0.7 + rnd() * 0.6);
    }
    // robles que quedaron dentro de la obra
    for (const [x, z, s] of [[60, 74, 1.12], [-78, -46, 1.05], [-72, 62, 1.0], [84, -52, 0.9]]) if (!enZona(x, z, 8)) poner('roble', x, z, s);
  }
  // los árboles lejanos de todas las especies van en una sola malla (el arbusto siempre usa su modelo)
  const lejanos = mallaLejana(listas.roble.length + listas.alamo.length + listas.pino.length, matLejos);
  raiz.add(lejanos.malla);
  {
    const crear = (esp) => {
      const cerca = arbolesCompartidos().modelos[esp], n = listas[esp].length;
      const mi = new THREE.InstancedMesh(cerca.geo, matVeg, n);
      const mats = listas[esp].map((p) => new THREE.Matrix4().compose(V(p.x, sueloH(p.x, p.z) - 0.12, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler((p.h - 0.5) * 0.04, p.ry, (p.t - 1) * 0.1)), V(p.s * p.sx, p.s * p.sy, p.s * p.sz)));
      const cols = listas[esp].map((p) => new THREE.Color(p.t * (0.96 + p.h * 0.08), p.t, p.t * (0.94 + (1 - p.h) * 0.1)));
      mi.frustumCulled = false; mi.castShadow = false; mi.receiveShadow = false; raiz.add(mi);
      especies[esp] = { cerca: mi, lejos: esp === 'arbusto' ? null : lejanos.malla, mats, cols, sombra: cerca.sombra, pos: listas[esp].map((p) => [p.x, p.z]) };
    };
    for (const e of ['roble', 'alamo', 'pino', 'arbusto']) crear(e);
    // sombra suave bajo cada copa, apoyada en la pendiente
    const total = Object.values(listas).reduce((s, l) => s + l.length, 0);
    const cv = lienzo(128, 128), g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const tSombra = new THREE.CanvasTexture(cv);
    const sombras = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tSombra, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), total);
    let i = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (const [esp, l] of Object.entries(listas)) for (const p of l) {
      const h = sueloH(p.x, p.z), nx = sueloH(p.x + 1, p.z) - sueloH(p.x - 1, p.z), nz = sueloH(p.x, p.z + 1) - sueloH(p.x, p.z - 1);
      q.setFromUnitVectors(EJE_Y, V(-nx / 2, 1, -nz / 2).normalize());
      const r = especies[esp].sombra * p.s;
      m4.compose(V(p.x + 0.6, h + 0.04, p.z + 0.4), q, V(r, 1, r)); sombras.setMatrixAt(i++, m4);
    }
    sombras.frustumCulled = false; sombras.renderOrder = -2; raiz.add(sombras);
  }
  let lodPos = V(1e9, 0, 0), lodVR = null;
  function actualizarLOD(cam, vr) {
    const radio = vr ? 75 : 140;
    let b = 0;
    for (const [esp, e] of Object.entries(especies)) {
      let a = 0;
      for (let i = 0; i < e.mats.length; i++) {
        if (e.lejos && Math.hypot(e.pos[i][0] - cam.x, e.pos[i][1] - cam.z) > radio) lejanos.poner(b++, esp, e.mats[i], e.cols[i]);
        else { e.cerca.setMatrixAt(a, e.mats[i]); e.cerca.setColorAt(a++, e.cols[i]); }
      }
      e.cerca.count = a; e.cerca.visible = a > 0; e.cerca.instanceMatrix.needsUpdate = true; if (e.cerca.instanceColor) e.cerca.instanceColor.needsUpdate = true;
    }
    lejanos.cerrar(b);
    lodPos = cam.clone(); lodVR = vr;
  }

  // ---------------------------------------------------------------- objetos de la obra (un grupo = una llamada)
  const grupos = [];
  function grupoObjetos(nombre, x, z, ry, construir) {
    const m = new Malla(), k = piezas(m);
    construir(k);
    const malla = new THREE.Mesh(m.geometria(), matObj);
    malla.name = nombre; malla.position.set(x, sueloH(x, z), z); malla.rotation.y = ry;
    malla.castShadow = true; malla.receiveShadow = true;
    raiz.add(malla); grupos.push(malla);
    return malla;
  }

  // piezas reutilizables -------------------------------------------------
  function contenedor(k, { largo = 6.06, ancho = 2.44, alto = 2.59, color, ventanas = [], puertas = [], rotulo = null, rotuloX = 0 }) {
    const osc = new THREE.Color(color).multiplyScalar(0.72);
    k.caja(largo - 0.16, alto - 0.18, 0.04, RO.chapa, color, 0, alto / 2, ancho / 2 - 0.03, { segY: 3, sucio: [-alto / 2, -alto / 2 + 0.9, 0.38] });
    k.caja(largo - 0.16, alto - 0.18, 0.04, RO.chapa, color, 0, alto / 2, -ancho / 2 + 0.03, { segY: 3, sucio: [-alto / 2, -alto / 2 + 0.9, 0.38] });
    for (const s of [-1, 1]) k.caja(0.04, alto - 0.18, ancho - 0.16, RO.chapa, color, s * (largo / 2 - 0.03), alto / 2, 0, { segY: 3, sucio: [-alto / 2, -alto / 2 + 0.9, 0.38] });
    k.caja(largo, 0.06, ancho, RO.metal, osc, 0, alto - 0.03, 0);
    for (const s of [-1, 1]) {
      k.caja(largo, 0.16, 0.12, RO.metal, 0x3a3a3a, 0, 0.08, s * (ancho / 2 - 0.06));
      k.caja(largo, 0.1, 0.1, RO.metal, osc, 0, alto - 0.08, s * (ancho / 2 - 0.05));
      k.caja(0.12, 0.16, ancho, RO.metal, 0x3a3a3a, s * (largo / 2 - 0.06), 0.08, 0);
      for (const t of [-1, 1]) {
        k.caja(0.16, alto, 0.16, RO.metal, osc, s * (largo / 2 - 0.08), alto / 2, t * (ancho / 2 - 0.08), { sucio: [-alto / 2, -alto / 2 + 0.7, 0.3] });
        for (const y of [0.07, alto - 0.07]) k.caja(0.19, 0.13, 0.19, RO.oxido, 0x8a8580, s * (largo / 2 - 0.09), y, t * (ancho / 2 - 0.09));
      }
    }
    for (const v of ventanas) {
      const zf = v.atras ? -(ancho / 2 + 0.01) : ancho / 2 + 0.01, sz = v.atras ? -1 : 1, w = v.w ?? 1.0, h = v.h ?? 0.9, y = v.y ?? 1.5;
      k.plano(w - 0.06, h - 0.06, RO.vidrio, 0xb8c6d2, v.x, y, zf + sz * 0.005, { ry: v.atras ? Math.PI : 0 });
      for (const [dx, dy, ww, hh] of [[0, h / 2, w + 0.08, 0.06], [0, -h / 2, w + 0.12, 0.07], [-w / 2, 0, 0.06, h], [w / 2, 0, 0.06, h], [0, 0, 0.035, h]]) k.caja(ww, hh, 0.06, RO.acero, 0xe6e8ea, v.x + dx, y + dy, zf + sz * 0.025);
      for (let b = 0; b < Math.round(w / 0.13); b++) { const bx = v.x - w / 2 + 0.08 + (b * (w - 0.16)) / (Math.round(w / 0.13) - 1); k.tubo(V(bx, y - h / 2, zf + sz * 0.07), V(bx, y + h / 2, zf + sz * 0.07), 0.008, 0.008, 4, RO.metal, 0x2a2c2e); }
      for (const dy of [-h / 2 + 0.05, h / 2 - 0.05]) k.caja(w, 0.025, 0.012, RO.metal, 0x2a2c2e, v.x, y + dy, zf + sz * 0.07);
    }
    for (const p of puertas) {
      const zf = ancho / 2 + 0.01, w = 0.92, h = 2.02;
      k.caja(w, h, 0.05, RO.metal, p.color ?? new THREE.Color(color).multiplyScalar(0.92), p.x, 0.16 + h / 2, zf + 0.02, { sucio: [-h / 2, -h / 2 + 0.6, 0.3] });
      for (const [dx, dy, ww, hh] of [[0, h + 0.04, w + 0.14, 0.07], [-w / 2 - 0.04, h / 2, 0.07, h + 0.05], [w / 2 + 0.04, h / 2, 0.07, h + 0.05]]) k.caja(ww, hh, 0.07, RO.metal, 0x5c6066, p.x + dx, 0.16 + dy, zf + 0.025);
      k.cil(0.012, 0.012, 0.13, 6, RO.acero, 0xcfd2d5, p.x + w / 2 - 0.12, 1.15, zf + 0.09, { rz: Math.PI / 2 });
      k.caja(0.05, 0.16, 0.03, RO.acero, 0xbfc2c5, p.x + w / 2 - 0.1, 1.12, zf + 0.055);
      if (p.peldano) k.caja(1.0, 0.18, 0.55, RO.hormigon, 0xa9a49b, p.x, 0.09 - (p.bajo ?? 0), zf + 0.3, { sucio: [-0.09, 0.05, 0.3] });
    }
    if (rotulo) k.plano(1.7, 0.42, rotulo, 0xffffff, rotuloX, alto - 0.42, ancho / 2 + 0.04);
  }
  function pallet(k, x, z, ry = 0, color = 0xb89b74) {
    const p = k.hijo(x, 0, z, ry);
    for (const zz of [-0.45, 0, 0.45]) p.caja(1.2, 0.1, 0.1, RO.madera, color, 0, 0.05, zz, { sucio: [-0.05, 0.03, 0.3] });
    for (let i = 0; i < 7; i++) p.caja(1.2, 0.022, 0.13, RO.madera, new THREE.Color(color).multiplyScalar(0.92 + hash(i, x * 7) * 0.16), 0, 0.111, -0.43 + i * 0.143);
    for (const xx of [-0.55, 0.55]) p.caja(0.1, 0.022, 1.0, RO.madera, color, xx, 0.089 + 0.011, 0);
    return p;
  }
  function ladrillos(k, x, z, ry = 0, alto = 0.9, escalon = false) {
    const p = pallet(k, x, z, ry);
    if (escalon) { p.caja(0.55, alto, 0.98, RO.ladrillo, 0xffffff, -0.3, 0.122 + alto / 2, 0, { tam: 0.6 }); p.caja(0.55, alto * 0.55, 0.98, RO.ladrillo, 0xffffff, 0.3, 0.122 + alto * 0.275, 0, { tam: 0.6 }); }
    else p.caja(1.12, alto, 0.98, RO.ladrillo, 0xffffff, 0, 0.122 + alto / 2, 0, { tam: 0.6 });
    for (const xx of [-0.35, 0.35]) p.caja(0.018, alto + 0.01, 1.0, RO.plastico, 0x1d4f9a, escalon ? xx * 0.9 - 0.25 + (xx > 0 ? -0.1 : 0) : xx, 0.122 + alto / 2, 0);
    return p;
  }
  function sacos(k, x, z, ry = 0, capas = 8, color = 0xb5ad9e) {
    const p = pallet(k, x, z, ry, 0xa88c66);
    for (let c = 0; c < capas; c++) for (let i = 0; i < 5; i++) {
      const rot = c % 2 === 0, xx = rot ? -0.32 + (i % 2) * 0.64 : -0.42 + (i % 3) * 0.42, zz = rot ? -0.32 + Math.floor(i / 2) * 0.32 : (i < 3 ? -0.24 : 0.24);
      if (!rot && i === 4) continue;
      p.caja(rot ? 0.6 : 0.4, 0.12, rot ? 0.3 : 0.46, RO.papel, new THREE.Color(color).multiplyScalar(0.9 + hash(c * 5 + i, 4) * 0.18), xx + (hash(c * 7 + i, 1) - 0.5) * 0.04, 0.17 + c * 0.122, zz + (hash(c * 3 + i, 2) - 0.5) * 0.04, { ry: (hash(c + i * 9, 5) - 0.5) * 0.06, tam: 0.5 });
    }
    return p;
  }
  function cono(k, x, z, s = 1) {
    const p = k.hijo(x, 0, z);
    p.caja(0.38 * s, 0.035, 0.38 * s, RO.goma, 0x2a2a2a, 0, 0.0175, 0);
    p.cil(0.16 * s, 0.025 * s, 0.68 * s, 12, RO.plastico, 0xe8541c, 0, 0.035 + 0.34 * s, 0);
    for (const [y0, y1] of [[0.28, 0.38], [0.48, 0.55]]) p.cil(0.16 * s * (1 - y0 / 0.7) + 0.025 * s * (y0 / 0.7) + 0.003, 0.16 * s * (1 - y1 / 0.7) + 0.025 * s * (y1 / 0.7) + 0.003, (y1 - y0) * s, 12, RO.plastico, 0xf2f2f2, 0, 0.035 + ((y0 + y1) / 2) * s, 0, { abierto: true });
  }
  function carretilla(k, x, z, ry = 0, color = 0x3f7a4a) {
    const p = k.hijo(x, 0, z, ry);
    p.cil(0.2, 0.2, 0.07, 14, RO.goma, 0x1e1e1e, 0.75, 0.2, 0, { rz: Math.PI / 2 });
    p.cil(0.09, 0.09, 0.08, 10, RO.metal, 0xb03a2a, 0.75, 0.2, 0, { rz: Math.PI / 2 });
    const t = p.hijo(0.2, 0.52, 0, 0, 0, -0.06);
    t.caja(0.8, 0.04, 0.5, RO.metal, color, 0, -0.17, 0, { sucio: [-0.02, 0.02, 0.2] });
    t.caja(0.95, 0.3, 0.035, RO.metal, color, 0.02, 0, 0.3, { rx: -0.35 }); t.caja(0.95, 0.3, 0.035, RO.metal, color, 0.02, 0, -0.3, { rx: 0.35 });
    t.caja(0.035, 0.3, 0.62, RO.metal, color, 0.52, 0, 0, { rz: 0.5 }); t.caja(0.035, 0.3, 0.62, RO.metal, color, -0.44, 0, 0, { rz: -0.35 });
    t.caja(0.7, 0.025, 0.42, RO.hormigon, 0x8e8a84, 0, -0.08, 0);
    for (const s of [-1, 1]) {
      p.tubo(V(0.75, 0.2, s * 0.05), V(-0.85, 0.62, s * 0.27), 0.017, 0.017, 6, RO.metal, 0x2c2c2c);
      p.tubo(V(-0.2, 0.42, s * 0.22), V(-0.3, 0.0, s * 0.25), 0.014, 0.014, 5, RO.metal, 0x2c2c2c);
      p.cil(0.022, 0.022, 0.16, 6, RO.goma, 0x202020, -0.92, 0.64, s * 0.28, { rz: Math.PI / 2 + 0.25 });
    }
  }
  function pala(k, x, y, z, ry, rx) {
    const p = k.hijo(x, y, z, ry, rx);
    p.cil(0.017, 0.017, 1.1, 6, RO.madera, 0xd8b68a, 0, 0.6, 0, { giro: true });
    p.caja(0.22, 0.28, 0.012, RO.oxido, 0x8a8a8a, 0, -0.05, 0.02, { rx: 0.2 });
    p.caja(0.13, 0.03, 0.03, RO.madera, 0xd8b68a, 0, 1.17, 0);
  }

  // faena: contenedores apilados, comedor, escalera, baños químicos, estanque, mesa y basureros ----------
  {
    const fx = 64, fz = 56, fry = Math.atan2(-0.5, -0.866);
    grupoObjetos('faena', fx, fz, fry, (k) => {
      for (const [x, z] of [[-2.8, -1], [2.8, -1], [-2.8, 1], [2.8, 1], [0, -1], [0, 1]]) k.caja(0.42, 0.26, 0.42, RO.hormigon, 0xaaa59c, x, 0.13, z, { sucio: [-0.13, 0.05, 0.3] });
      for (const z of [-0.6, 0.6]) k.caja(6.1, 0.1, 0.15, RO.madera, 0x7d6a55, 0, 0.21, z);
      const A = k.hijo(0, 0.26, 0);
      contenedor(A, { color: 0x3f6f9f, ventanas: [{ x: 1.2 }], puertas: [{ x: -1.3, peldano: true, bajo: 0.26 }], rotulo: RO.rotBodega, rotuloX: 1.2 });
      const B = k.hijo(0, 0.26 + 2.59, 0);
      contenedor(B, { color: 0xe4e2dc, ventanas: [{ x: -2.1 }, { x: -0.5 }, { x: -1.3, atras: true }], puertas: [{ x: 1.6 }], rotulo: RO.rotOficina, rotuloX: -1.3 });
      // equipo de aire acondicionado en el extremo
      const ac = B.hijo(-3.2, 1.6, 0.3, -Math.PI / 2);
      ac.caja(0.82, 0.56, 0.3, RO.plastico, 0xe9e9e6, 0, 0, 0);
      ac.plano(0.5, 0.42, RO.rejilla, 0x9a9a9a, -0.12, 0, 0.152);
      ac.cil(0.16, 0.16, 0.01, 16, RO.goma, 0x3a3a3a, -0.12, 0, 0.155, { rx: Math.PI / 2 });
      ac.tubo(V(0.3, -0.2, 0), V(0.3, -1.6, 0), 0.012, 0.012, 5, RO.plastico, 0xf0f0f0);
      // rótulos de seguridad
      B.plano(0.32, 0.32, RO.rotAuxilio, 0xffffff, 0.75, 1.75, 1.25);
      A.plano(0.3, 0.3, RO.rotExtintor, 0xffffff, -0.45, 1.65, 1.25);
      A.cil(0.075, 0.075, 0.45, 12, RO.metal, 0xc0281e, -0.45, 1.05, 1.32);
      A.cil(0.02, 0.03, 0.08, 6, RO.goma, 0x1a1a1a, -0.45, 1.31, 1.32);
      // descanso y escalera de la oficina de arriba
      const yP = 0.26 + 2.59, D = k.hijo(1.9, 0, 1.22 + 0.62);
      D.caja(1.75, 0.06, 1.25, RO.rejilla, 0x8a8e92, 0, yP - 0.03, 0, { tam: 0.4 });
      for (const [x, z] of [[-0.82, 0.57], [0.82, 0.57], [-0.82, -0.57], [0.82, -0.57]]) D.caja(0.08, yP - 0.06, 0.08, RO.metal, 0x4b5258, x, (yP - 0.06) / 2, z, { sucio: [-(yP) / 2, -(yP) / 2 + 0.4, 0.3] });
      for (const [x, z] of [[-0.82, 0.57], [0.82, 0.57]]) D.caja(0.25, 0.04, 0.25, RO.hormigon, 0x9d988f, x, 0.02, z);
      D.tubo(V(-0.85, yP + 1.0, 0.6), V(0.85, yP + 1.0, 0.6), 0.022, 0.022, 6, RO.metal, 0xd8a21a);
      D.tubo(V(-0.85, yP + 0.5, 0.6), V(0.85, yP + 0.5, 0.6), 0.016, 0.016, 6, RO.metal, 0xd8a21a);
      D.tubo(V(-0.85, yP + 1.0, -0.6), V(-0.85, yP + 1.0, 0.6), 0.022, 0.022, 6, RO.metal, 0xd8a21a);
      D.tubo(V(-0.85, yP + 0.5, -0.6), V(-0.85, yP + 0.5, 0.6), 0.016, 0.016, 6, RO.metal, 0xd8a21a);
      for (const [x, z] of [[-0.85, 0.6], [0, 0.6], [0.85, 0.6], [-0.85, -0.6]]) D.tubo(V(x, yP, z), V(x, yP + 1.0, z), 0.018, 0.018, 6, RO.metal, 0xd8a21a);
      const n = 16, sube = yP / n, huella = 0.26, x0 = 0.875;
      const largoE = Math.hypot(n * huella, yP), angE = Math.atan2(yP, n * huella);
      for (const z of [-0.55, 0.55]) D.caja(largoE, 0.2, 0.035, RO.metal, 0x4b5258, x0 + (n * huella) / 2, yP / 2 - 0.08, z, { rz: -angE });
      for (let i = 0; i < n; i++) D.caja(huella + 0.02, 0.035, 1.06, RO.rejilla, 0x8a8e92, x0 + huella * (i + 0.5), yP - sube * (i + 1) + 0.02, 0, { tam: 0.4 });
      for (const z of [-0.6, 0.6]) {
        D.tubo(V(x0, yP + 0.95, z), V(x0 + n * huella, 0.95, z), 0.02, 0.02, 6, RO.metal, 0xd8a21a);
        for (const t of [0, 0.5, 1]) { const xx = x0 + t * n * huella, yy = yP * (1 - t); D.tubo(V(xx, Math.max(0, yy - 0.02), z), V(xx, yy + 0.95, z), 0.017, 0.017, 6, RO.metal, 0xd8a21a); }
      }
      D.caja(1.2, 0.08, 1.2, RO.hormigon, 0xa7a299, x0 + n * huella + 0.4, 0.04, 0);
      // comedor al costado
      const Cm = k.hijo(-7.6, 0.22, 0.6);
      for (const [x, z] of [[-2.8, -1], [2.8, -1], [-2.8, 1], [2.8, 1]]) k.caja(0.4, 0.22, 0.4, RO.hormigon, 0xaaa59c, -7.6 + x, 0.11, 0.6 + z, { sucio: [-0.11, 0.05, 0.3] });
      contenedor(Cm, { color: 0xd9d4c4, ventanas: [{ x: -1.6 }, { x: 0.2 }], puertas: [{ x: 1.8, peldano: true, bajo: 0.22 }], rotulo: RO.rotComedor, rotuloX: -0.7 });
      // mesa con bancas frente al comedor
      const M = k.hijo(-7.4, 0, 4.4, 0.08);
      M.caja(2.0, 0.05, 0.8, RO.madera, 0xb08a60, 0, 0.75, 0);
      for (const z of [-0.62, 0.62]) M.caja(2.0, 0.04, 0.26, RO.madera, 0xa07c55, 0, 0.45, z);
      for (const x of [-0.75, 0.75]) for (const s of [-1, 1]) {
        M.caja(0.07, 0.85, 0.07, RO.madera, 0x8f6e4c, x, 0.4, s * 0.32, { rx: s * 0.55 });
        M.caja(0.06, 0.06, 1.5, RO.madera, 0x8f6e4c, x, 0.42, 0);
      }
      // basureros de reciclaje
      [[0x2c6fb0, -10.6], [0x3f8a45, -10.0], [0xe0b21a, -9.4]].forEach(([c, x]) => { k.cil(0.27, 0.3, 0.9, 14, RO.plastico, c, x, 0.45, 2.2, { sucio: [-0.45, -0.2, 0.25] }); k.cil(0.31, 0.31, 0.06, 14, RO.plastico, new THREE.Color(c).multiplyScalar(0.8), x, 0.93, 2.2); });
      // tablero eléctrico de faena en un poste de madera, con tierra de protección y cable aéreo a la oficina
      const Te = k.hijo(-3.8, 0, 2.5, 0);
      Te.cil(0.085, 0.1, 4.8, 10, RO.madera, 0x7a6248, 0, 2.3, 0, { giro: true, sucio: [-2.4, -1.8, 0.35] });
      Te.caja(0.5, 0.65, 0.2, RO.metal, 0xb9bcbd, 0, 1.45, 0.2, { sucio: [-0.33, 0, 0.2] });
      Te.caja(0.56, 0.035, 0.26, RO.metal, 0x8f9293, 0, 1.8, 0.21, { rx: 0.12 });
      Te.plano(0.17, 0.17, RO.rotRiesgo, 0xffffff, 0, 1.55, 0.302);
      Te.caja(0.03, 0.1, 0.04, RO.metal, 0x303030, 0.2, 1.4, 0.31);
      for (const y of [1.0, 1.8]) Te.caja(0.06, 0.05, 0.2, RO.acero, 0xa8acb0, 0, y, 0.1);
      Te.tubo(V(0.14, 1.12, 0.2), V(0.14, 0.02, 0.12), 0.012, 0.012, 5, RO.goma, 0x1d1d1d);
      Te.tubo(V(0.14, 0.02, 0.12), V(0.35, 0.02, 0.3), 0.012, 0.012, 5, RO.goma, 0x1d1d1d);
      Te.cil(0.01, 0.01, 0.25, 5, RO.acero, 0xb07a40, 0.35, 0.1, 0.3);
      {
        const a = V(0.05, 4.4, 0.08), b = V(0.77, 4.55, -1.5);
        let p0 = a;
        for (let i = 1; i <= 6; i++) { const t = i / 6, p1 = a.clone().lerp(b, t); p1.y -= 0.22 * 4 * t * (1 - t); Te.tubo(p0, p1, 0.009, 0.009, 4, RO.goma, 0x1a1a1a); p0 = p1; }
        Te.tubo(V(0.05, 4.4, 0.08), V(0.06, 1.8, 0.2), 0.012, 0.012, 4, RO.goma, 0x1a1a1a);
        Te.caja(0.22, 0.04, 0.06, RO.acero, 0xb0b4b8, 0, 4.42, 0.1);
      }
      // baños químicos
      for (let i = 0; i < 3; i++) {
        const b = k.hijo(9.4 + i * 1.32, 0, -0.2), azul = i === 2 ? 0x2b6bb3 : 0x2a5ea3;
        b.caja(1.18, 0.1, 1.24, RO.plastico, 0x2d3a4a, 0, 0.05, 0);
        b.caja(1.12, 2.12, 1.18, RO.chapa, azul, 0, 0.1 + 1.06, 0, { tam: 0.55, segY: 3, sucio: [-1.06, -0.5, 0.3] });
        b.caja(1.2, 0.08, 1.26, RO.plastico, 0xf1f1ec, 0, 2.26, 0);
        b.cil(0.5, 0.15, 0.1, 12, RO.plastico, 0xf1f1ec, 0, 2.34, 0);
        b.caja(0.82, 1.86, 0.03, RO.plastico, new THREE.Color(azul).multiplyScalar(1.08), 0, 0.16 + 0.95, 0.6);
        b.plano(0.34, 0.17, RO.rotBano, 0xffffff, 0, 1.75, 0.618);
        b.plano(0.12, 0.06, RO.rotLibre, 0xffffff, 0.3, 1.2, 0.618);
        b.cil(0.012, 0.012, 0.12, 6, RO.acero, 0xdddddd, 0.3, 1.08, 0.64, { rz: Math.PI / 2 });
        b.cil(0.045, 0.045, 1.5, 8, RO.plastico, 0x2b2b2b, -0.42, 1.6, -0.62);
        b.cil(0.06, 0.06, 0.08, 8, RO.plastico, 0x2b2b2b, -0.42, 2.38, -0.62);
      }
      // estanque de agua sobre torre
      const E = k.hijo(14.2, 0, -1.2);
      for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) { E.caja(0.07, 1.6, 0.07, RO.oxido, 0x6a6a66, x, 0.8, z); E.caja(0.22, 0.1, 0.22, RO.hormigon, 0x9d988f, x, 0.05, z); }
      for (const s of [-1, 1]) { E.tubo(V(-0.55, 0.15, s * 0.55), V(0.55, 1.45, s * 0.55), 0.015, 0.015, 4, RO.oxido, 0x6a6a66); E.tubo(V(s * 0.55, 0.15, -0.55), V(s * 0.55, 1.45, 0.55), 0.015, 0.015, 4, RO.oxido, 0x6a6a66); }
      E.caja(1.3, 0.05, 1.3, RO.oxido, 0x6a6a66, 0, 1.62, 0);
      E.cil(0.58, 0.6, 1.4, 18, RO.plastico, 0x1f1f1f, 0, 1.64 + 0.7, 0);
      E.cil(0.2, 0.2, 0.08, 12, RO.plastico, 0x1f1f1f, 0, 3.08, 0);
      E.tubo(V(-0.3, 1.64, 0.3), V(-0.3, 0.05, 0.3), 0.02, 0.02, 6, RO.plastico, 0xe8e8e8);
      E.tubo(V(-0.3, 0.05, 0.3), V(-3.0, 0.05, 0.6), 0.02, 0.02, 6, RO.plastico, 0xe8e8e8);
    });
  }

  // acopio sur: ladrillos, cemento, tubos de PVC y de hormigón, vigas, fierro, moldajes, batea y lona con neumáticos
  grupoObjetos('acopio sur', -12, -68, 0, (k) => {
    for (const [x, z, alto, esc] of [[-10.6, -1.6, 0.9, false], [-9.2, -1.6, 0.9, false], [-7.8, -1.6, 0.6, true], [-10.6, 0, 0.9, false], [-9.2, 0, 0.45, false]]) ladrillos(k, x, z, (hash(x * 10, z) - 0.5) * 0.08, alto, esc);
    sacos(k, -5.8, -1.5, 0.05, 8); sacos(k, -5.8, 0.1, -0.03, 5, 0x9e9a90);
    // tubos de PVC sobre durmientes
    for (const x of [-2.6, 0.2, 3.0]) k.caja(0.12, 0.1, 1.2, RO.madera, 0x7d6a55, x, 0.05, -1.0);
    const filas = [5, 4, 3];
    filas.forEach((nf, f) => {
      for (let i = 0; i < nf; i++) {
        const z = -1.0 + (i - (nf - 1) / 2) * 0.115, y = 0.1 + 0.056 + f * 0.1;
        k.geo(gCilindro(0.056, 0.056, 6, 10, { abierto: true, giro: true }), RO.plastico, 0xd8612a, 0.2, y, z, { rz: Math.PI / 2 });
        k.geo(invertir(gCilindro(0.051, 0.051, 6, 10, { abierto: true, giro: true })), RO.plastico, 0x9a4520, 0.2, y, z, { rz: Math.PI / 2 });
        for (const s of [-1, 1]) k.geo(new THREE.RingGeometry(0.051, 0.056, 10), RO.plastico, 0xd8612a, 0.2 + s * 3, y, z, { ry: s * Math.PI / 2 });
      }
    });
    // tubos de hormigón
    const tuboH = (x, y, z, ry, de) => {
      const p = k.hijo(x, y, z, ry, de ? 0 : Math.PI / 2);
      p.geo(gCilindro(0.6, 0.6, 1.2, 18, { abierto: true }), RO.hormigon, 0xb3aea4, 0, 0, 0, { sucio: [-0.6, 0.6, 0.15] });
      p.geo(invertir(gCilindro(0.5, 0.5, 1.2, 18, { abierto: true })), RO.hormigon, 0x8f8a80, 0, 0, 0);
      for (const s of [-1, 1]) p.geo(new THREE.RingGeometry(0.5, 0.6, 18), RO.hormigon, 0xa39e94, 0, s * 0.6, 0, { rx: -s * Math.PI / 2 });
    };
    for (let i = 0; i < 4; i++) tuboH(5.6 + i * 1.25, 0.6, -1.4, 0, false);
    tuboH(6.22, 0.6 + 1.05, -1.4, 0, false); tuboH(8.72, 0.6 + 1.05, -1.4, 0, false);
    tuboH(11.2, 0.6, 1.6, 0, true); tuboH(12.5, 0.6, 1.1, 0, true);
    // vigas doble T y fierro sobre durmientes
    for (const x of [-3.0, 0.2, 3.2]) k.caja(0.15, 0.12, 2.0, RO.madera, 0x6e5c48, x, 0.06, 2.5);
    for (let i = 0; i < 5; i++) {
      const z = 1.9 + i * 0.22, y = 0.12;
      k.caja(7, 0.012, 0.15, RO.oxido, 0x9a948c, 0.1, y + 0.006, z); k.caja(7, 0.012, 0.15, RO.oxido, 0x9a948c, 0.1, y + 0.294, z); k.caja(7, 0.276, 0.008, RO.oxido, 0x9a948c, 0.1, y + 0.15, z);
    }
    for (let i = 0; i < 18; i++) { const z = 3.25 + (i % 6) * 0.03, y = 0.14 + Math.floor(i / 6) * 0.026; k.geo(gCilindro(0.011, 0.011, 6, 5, { abierto: true, giro: true }), RO.oxido, 0x8a6a55, 0.1 + (hash(i, 8) - 0.5) * 0.3, y, z, { rz: Math.PI / 2 }); }
    // moldajes metálicos apilados
    for (let i = 0; i < 8; i++) {
      const y = 0.12 + i * 0.085, dx = (hash(i, 11) - 0.5) * 0.06;
      k.caja(2.4, 0.08, 1.2, RO.metal, 0xe0a020, -5.2 + dx, y, 2.6, { sucio: [-0.04, 0.0, 0.2] });
      k.plano(2.3, 1.1, RO.madera, 0xd9c7a8, -5.2 + dx, y + 0.041, 2.6, { rx: -Math.PI / 2 });
    }
    for (const x of [-6.2, -4.2]) k.caja(0.1, 0.1, 1.3, RO.madera, 0x6e5c48, x, 0.05, 2.6);
    // batea de escombros
    const T = k.hijo(14.6, 0, -1.0, 0.12);
    T.caja(3.6, 0.08, 1.7, RO.oxido, 0x8a7a5a, 0, 0.1, 0);
    for (const s of [-1, 1]) T.caja(4.4, 1.5, 0.06, RO.metal, 0xd9a520, 0, 0.85, s * 0.9, { sucio: [-0.75, 0.3, 0.45] });
    for (const s of [-1, 1]) T.caja(0.06, 1.58, 1.8, RO.metal, 0xd9a520, s * 2.0, 0.86, 0, { rz: s * 0.35, sucio: [-0.8, 0.2, 0.45] });
    T.caja(4.5, 0.08, 0.1, RO.oxido, 0x6d5a40, 0, 1.6, 0.92); T.caja(4.5, 0.08, 0.1, RO.oxido, 0x6d5a40, 0, 1.6, -0.92);
    for (let i = 0; i < 14; i++) T.caja(0.3 + hash(i, 1) * 0.5, 0.18 + hash(i, 2) * 0.3, 0.25 + hash(i, 3) * 0.4, i % 3 === 0 ? RO.madera : RO.hormigon, i % 3 === 0 ? 0x9a8060 : 0x9c978e, (hash(i, 4) - 0.5) * 3, 1.0 + hash(i, 5) * 0.35, (hash(i, 6) - 0.5) * 1.2, { ry: hash(i, 7) * 3, rz: (hash(i, 8) - 0.5) * 0.6 });
    T.geo(new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2).scale(1.7, 0.55, 0.78), RO.tierra, 0xffffff, 0, 0.85, 0);
    // ruma tapada con lona azul: la lona cae sobre la carga con pliegues en los costados y queda tendida en el suelo,
    // amarrada con cuerdas a estacas y con neumáticos encima para que no la levante el viento
    {
      const Lo = k.hijo(-1.3, 0, 5.1, 0.2), Lx = 1.6, Lz = 0.85, Hh = 0.9, caida = 0.75, ext = caida + 0.3;
      const altura = (x, z) => {
        const dx = Math.max(0, Math.abs(x) - Lx), dz = Math.max(0, Math.abs(z) - Lz), d = Math.hypot(dx, dz);
        if (d === 0) return Hh - 0.05 * (1 - Math.cos(x * 3.1)) * (1 - Math.cos(z * 2.4)) * 0.5 + ruido.noise(x * 1.7, 2.2, z * 1.7) * 0.025;
        const t = clamp(d / caida, 0, 1);
        return Hh * Math.pow(1 - t, 0.55) + Math.sin(Math.atan2(z, x) * 13 + x * 2) * 0.035 * sstep(0.05, 0.4, t) * (1 - sstep(0.75, 1, t));
      };
      const geo = new THREE.PlaneGeometry(2 * (Lx + ext), 2 * (Lz + ext), 40, 26); geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.max(0.03, altura(x, z))); uv.setXY(i, x, z); }
      geo.computeVertexNormals();
      Lo.geo(geo, RO.lona, 0x2f62b8, 0, 0, 0);
      for (const [x, z, a] of [[-0.85, -0.2, 0.5], [0.75, 0.25, -0.3], [-0.05, 0.05, 1.1]]) Lo.geo(new THREE.TorusGeometry(0.28, 0.1, 6, 14), RO.goma, 0x1d1d1d, x, altura(x, z) + 0.08, z, { rx: Math.PI / 2, ry: a });
      for (const x of [-1.05, 1.05]) for (const s of [-1, 1]) {
        const pts = [V(x, Hh + 0.02, 0)];
        for (const t of [0, 0.3, 0.6, 0.85, 1]) { const zz = s * (Lz + t * caida); pts.push(V(x, altura(x, zz) + 0.045, zz)); }
        pts.push(V(x * 1.05, 0.06, s * (Lz + caida + 0.32)));
        for (let i = 1; i < pts.length; i++) Lo.tubo(pts[i - 1], pts[i], 0.008, 0.008, 4, RO.plastico, 0xd8b020);
        Lo.caja(0.035, 0.3, 0.035, RO.madera, 0x8a7050, x * 1.05, 0.1, s * (Lz + caida + 0.36), { rx: s * 0.35 });
      }
    }
    carretilla(k, -7.4, 1.6, 0.6);
    for (const [x, z] of [[-11.5, 3.2], [-5.0, 4.4], [1.5, 4.6], [9.0, 3.6]]) cono(k, x, z);
  });

  // acopio junto a la plaza: ladrillos a medio usar, cemento, madera, carretilla con pala, conos y barrera
  {
    const ax = -17.4, az = -2.2, ary = Math.atan2(0.991, 0.13);
    grupoObjetos('acopio plaza', ax, az, ary, (k) => {
      ladrillos(k, -1.7, -1.3, 0.06, 0.9, true);
      sacos(k, 0.4, -1.4, -0.08, 6);
      k.caja(0.62, 0.13, 0.42, RO.papel, 0xb5ad9e, 1.25, 0.065, -0.4, { ry: 0.5, tam: 0.5 });
      k.caja(0.62, 0.11, 0.42, RO.papel, 0xaaa294, 0.95, 0.055, 0.15, { ry: -0.3, rz: 0.04, tam: 0.5 });
      for (const x of [-1.9, 0.6]) k.caja(0.39, 0.19, 0.19, RO.hormigon, 0xa39e95, x, 0.095, 1.0, { ry: Math.PI / 2 });
      for (let i = 0; i < 8; i++) k.caja(3.2, 0.045, 0.095, RO.madera, new THREE.Color(0xc8a77a).multiplyScalar(0.9 + hash(i, 21) * 0.18), -0.65 + (hash(i, 22) - 0.5) * 0.08, 0.21 + Math.floor(i / 4) * 0.046, 0.86 + (i % 4) * 0.1, { ry: (hash(i, 23) - 0.5) * 0.03 });
      carretilla(k, 2.2, 0.3, 2.3, 0x9a3b2a);
      pala(k, 2.62, 0.62, 0.95, 0.4, 0.95);
      for (const [x, z] of [[-2.9, 2.2], [3.1, 2.0], [0.4, 2.4]]) cono(k, x, z);
      const bar = k.hijo(2.9, 0, -1.6, 0.9);
      bar.caja(1.2, 0.55, 0.38, RO.plastico, 0xd8261e, 0, 0.3, 0, { sucio: [-0.27, -0.1, 0.25] });
      bar.caja(1.0, 0.22, 0.3, RO.plastico, 0xd8261e, 0, 0.66, 0);
      bar.caja(0.5, 0.12, 0.392, RO.plastico, 0xf2f2f2, -0.25, 0.42, 0);
      bar.caja(0.5, 0.12, 0.392, RO.plastico, 0xf2f2f2, 0.35, 0.18, 0);
    });
  }
  // bolsón al este de la plaza: bloques de hormigón y un cono
  grupoObjetos('acopio este', 20.4, 0.9, 0.35, (k) => {
    const p = pallet(k, 0, 0, 0, 0xa8916e);
    for (let c = 0; c < 4; c++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) if (!(c === 3 && i === 2)) p.caja(0.39, 0.19, 0.19 * 2.4, RO.hormigon, new THREE.Color(0xa7a297).multiplyScalar(0.94 + hash(c * 9 + i * 3 + j, 31) * 0.1), -0.4 + i * 0.4, 0.122 + 0.095 + c * 0.19, -0.24 + j * 0.48, { ry: c % 2 ? 0 : 0 });
    cono(k, 1.2, 0.8);
  });

  // letrero de obra en la plaza
  {
    const lx = -9.6, lz = -1.4, lry = Math.atan2(9.6, 5.4);
    const cv = lienzo(1024, 1024), g = cv.getContext('2d');
    g.fillStyle = '#f5f4ef'; g.fillRect(0, 0, 1024, 1024);
    // panel principal (1024 × 640 ⇒ 3,2 × 2,0 m)
    g.fillStyle = '#163d6b'; g.fillRect(0, 0, 1024, 118);
    g.fillStyle = '#ffb347'; g.fillRect(0, 118, 1024, 12);
    g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'middle';
    textoAjustado(g, 'OBRA EN CONSTRUCCIÓN', 40, 62, 640, 64, 800);
    g.textAlign = 'right'; g.fillStyle = '#ffd08a'; textoAjustado(g, 'GUÍA 4', 984, 62, 260, 54, 800);
    g.textAlign = 'left'; g.fillStyle = '#163d6b';
    textoAjustado(g, 'La obra: once problemas de Cálculo', 40, 178, 940, 46, 800);
    g.fillStyle = '#3d4a5a'; textoAjustado(g, 'Optimización y razón de cambio en una variable', 40, 228, 940, 34, 600);
    const filas = [['Estaciones', '11'], ['Superficie del terreno', '2,8 ha'], ['Plazo de ejecución', '18 semanas'], ['Inicio de faenas', 'marzo de 2026'], ['Horario', 'lunes a viernes, 8:00 a 18:00']];
    filas.forEach(([a, b], i) => {
      const y = 300 + i * 58;
      g.fillStyle = '#6a7380'; textoAjustado(g, a, 40, y, 330, 28, 600);
      g.fillStyle = '#16202c'; textoAjustado(g, b, 40, y + 26, 440, 30, 800);
      g.fillStyle = '#d9dde2'; g.fillRect(40, y + 46, 440, 2);
    });
    // plano de ubicación con el cerco, los senderos y las estaciones
    const px0 = 530, py0 = 270, pw = 450, ph = 330;
    g.fillStyle = '#e8e4d8'; g.fillRect(px0, py0, pw, ph); g.strokeStyle = '#9aa1a8'; g.lineWidth = 2; g.strokeRect(px0, py0, pw, ph);
    g.fillStyle = '#6a7380'; g.textAlign = 'left'; textoAjustado(g, 'PLANO DE UBICACIÓN', px0 + 10, py0 - 20, 300, 24, 800);
    const xs = CERCO.map((p) => p[0]), zs = CERCO.map((p) => p[1]), mnx = Math.min(...xs) - 8, mxx = Math.max(...xs) + 8, mnz = Math.min(...zs) - 8, mxz = Math.max(...zs) + 8;
    const esc = Math.min(pw / (mxx - mnx), ph / (mxz - mnz)), ox = px0 + (pw - (mxx - mnx) * esc) / 2, oz = py0 + (ph - (mxz - mnz) * esc) / 2;
    const P = (x, z) => [ox + (x - mnx) * esc, oz + (z - mnz) * esc];
    g.fillStyle = '#d9cdb4'; g.beginPath(); CERCO.forEach((p, i) => (i ? g.lineTo(...P(...p)) : g.moveTo(...P(...p)))); g.closePath(); g.fill();
    g.strokeStyle = '#d0661c'; g.lineWidth = 3; g.setLineDash([7, 4]); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#a89c86'; g.lineWidth = 4;
    for (const s of SENDEROS) { g.beginPath(); g.moveTo(...P(s.ux * s.s0, s.uz * s.s0)); g.lineTo(...P(s.ux * s.s1, s.uz * s.s1)); g.stroke(); }
    g.font = `800 15px "Segoe UI", Arial, sans-serif`; g.textAlign = 'center';
    LAYOUT.filter((l) => l.id !== 'autos').forEach((l, i) => {
      const [x, y] = P(l.pos[0], l.pos[1]);
      g.fillStyle = '#ff8a1f'; g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.fillText(String(i + 1), x, y + 1);
    });
    const [ux, uy] = P(0, 0);
    g.fillStyle = '#c8261e'; g.beginPath(); g.arc(ux, uy, 9, 0, TAU); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#c8261e'; g.textAlign = 'left'; textoAjustado(g, 'Usted está aquí', ux + 14, uy - 2, 160, 18, 800);
    // panel de elementos de protección personal (1024 × 384 ⇒ 2,0 × 0,75 m)
    g.fillStyle = '#ffffff'; g.fillRect(0, 640, 1024, 384);
    g.fillStyle = '#1d5fae'; g.fillRect(0, 640, 1024, 80);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; textoAjustado(g, 'USO OBLIGATORIO DE ELEMENTOS DE PROTECCIÓN PERSONAL', 512, 682, 980, 40, 800);
    const iconos = ['Casco', 'Chaleco', 'Calzado', 'Guantes', 'Lentes'];
    iconos.forEach((t, i) => {
      const cx = 112 + i * 200, cy = 830;
      g.fillStyle = '#1d5fae'; g.beginPath(); g.arc(cx, cy, 72, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineWidth = 7;
      if (i === 0) { g.beginPath(); g.arc(cx, cy + 14, 40, Math.PI, 0); g.fill(); g.fillRect(cx - 52, cy + 10, 104, 12); }
      if (i === 1) { g.beginPath(); g.moveTo(cx - 34, cy - 40); g.lineTo(cx - 14, cy - 40); g.lineTo(cx, cy - 18); g.lineTo(cx + 14, cy - 40); g.lineTo(cx + 34, cy - 40); g.lineTo(cx + 40, cy + 42); g.lineTo(cx - 40, cy + 42); g.closePath(); g.fill(); g.fillStyle = '#1d5fae'; g.fillRect(cx - 40, cy + 8, 80, 9); }
      if (i === 2) { g.beginPath(); g.moveTo(cx - 30, cy - 38); g.lineTo(cx - 2, cy - 38); g.lineTo(cx, cy + 6); g.lineTo(cx + 44, cy + 14); g.lineTo(cx + 44, cy + 36); g.lineTo(cx - 34, cy + 36); g.closePath(); g.fill(); }
      if (i === 3) { g.beginPath(); g.roundRect(cx - 26, cy - 10, 52, 52, 8); g.fill(); for (let f = 0; f < 4; f++) { g.beginPath(); g.roundRect(cx - 26 + f * 13.5, cy - 44, 11, 40, 5); g.fill(); } g.beginPath(); g.roundRect(cx + 22, cy - 14, 26, 11, 5); g.fill(); }
      if (i === 4) { g.beginPath(); g.ellipse(cx - 24, cy, 20, 16, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(cx + 24, cy, 20, 16, 0, 0, TAU); g.fill(); g.fillRect(cx - 8, cy - 6, 16, 6); g.fillRect(cx - 54, cy - 8, 12, 5); g.fillRect(cx + 42, cy - 8, 12, 5); }
      g.fillStyle = '#16202c'; textoAjustado(g, t, cx, cy + 112, 190, 30, 700);
    });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const caras = new Malla(), kc = piezas(caras);
    const cara = (w, h, v0, v1, x, y) => {
      const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), lerp(v0, v1, uv.getY(i)));
      kc.geo(geo, [0, 0, 1, 1], 0xffffff, x, y, 0.035);
    };
    cara(3.2, 2.0, 1 - 640 / 1024, 1, 0, 2.15);
    cara(2.0, 0.75, 0, 384 / 1024, 0, 0.78);
    const geoC = caras.geometria();
    geoC.deleteAttribute('region'); geoC.deleteAttribute('flex');
    const mc = new THREE.Mesh(geoC, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0, vertexColors: true }));
    mc.position.set(lx, 0, lz); mc.rotation.y = lry; mc.receiveShadow = true; raiz.add(mc);
    grupoObjetos('letrero', lx, lz, lry, (k) => {
      k.caja(3.3, 2.1, 0.03, RO.metal, 0xdedede, 0, 2.15, 0.01);
      k.caja(2.1, 0.85, 0.03, RO.metal, 0xdedede, 0, 0.78, 0.01);
      for (const y of [1.55, 2.75]) k.caja(3.4, 0.07, 0.045, RO.madera, 0x8d7253, 0, y, -0.03);
      for (const x of [-1.25, 1.25]) {
        k.caja(0.1, 3.4, 0.1, RO.madera, 0x8d7253, x, 1.65, -0.09, { giro: true, sucio: [-1.7, -1.3, 0.35] });
        k.caja(0.34, 0.06, 0.34, RO.hormigon, 0x9e998f, x, 0.03, -0.09);
      }
      k.caja(3.4, 0.05, 0.25, RO.metal, 0x163d6b, 0, 3.22, 0.05);
      // poste con la señal de zona de seguridad, sobre un dado de hormigón
      k.cil(0.03, 0.03, 2.5, 8, RO.acero, 0xc9cdd1, 2.35, 1.25, -0.05, { sucio: [-1.25, -0.9, 0.3] });
      k.caja(0.3, 0.12, 0.3, RO.hormigon, 0xa39e95, 2.35, 0.04, -0.05, { sucio: [-0.06, 0.04, 0.3] });
      k.caja(0.62, 0.32, 0.015, RO.metal, 0xdedede, 2.35, 2.25, -0.015);
      k.plano(0.6, 0.3, RO.rotZona, 0xffffff, 2.35, 2.25, -0.006);
      k.plano(0.6, 0.3, RO.rotZona, 0xffffff, 2.35, 2.25, -0.024, { ry: Math.PI });
      for (const y of [2.15, 2.35]) k.caja(0.09, 0.025, 0.07, RO.acero, 0xb0b4b8, 2.35, y, -0.05);
    });
  }

  // ---------------------------------------------------------------- calcos: huellas, camino de acceso, manchas y charcos
  {
    const c = new Malla(true), agua = new Malla();
    const rnd = mulberry32(91);
    const franja = (pts, ancho, reg, color, { tam = 0.6, y = 0.016, sigue = false, cerrada = false, paso = 0.5 } = {}) => {
      const curva = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, 0, z)), cerrada, 'centripetal');
      const n = Math.max(4, Math.ceil(curva.getLength() / paso)), q = curva.getSpacedPoints(n);
      // en una franja cerrada la textura da un número entero de vueltas para que no quede costura
      if (cerrada) tam = curva.getLength() / Math.max(1, Math.round(curva.getLength() / tam));
      let s = 0;
      const base = c.n;
      for (let i = 0; i <= n; i++) {
        const p = q[i], t = q[Math.min(n, i + 1)].clone().sub(q[Math.max(0, i - 1)]).normalize(), nn = V(-t.z, 0, t.x);
        if (i) s += q[i].distanceTo(q[i - 1]);
        const fade = cerrada ? 1 : Math.min(1, s / 4, (curva.getLength() - s) / 4);
        for (const lado of [-0.5, 0.5]) {
          const x = p.x + nn.x * ancho * lado, z = p.z + nn.z * ancho * lado, yy = (sigue ? sueloH(x, z) : 0) + y;
          c.v(V(x, yy, z), EJE_Y, lado + 0.5, s / tam, [color[0], color[1], color[2], color[3] * clamp(fade, 0, 1)], reg);
        }
        if (i) { const a = base + (i - 1) * 2; c.I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      return curva;
    };
    const huellas = (pts, sep = 1.85, sigue = false) => {
      const curva = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
      const q = curva.getSpacedPoints(Math.ceil(curva.getLength() / 2));
      for (const lado of [-0.5, 0.5]) {
        const p2 = q.map((p, i) => { const t = q[Math.min(q.length - 1, i + 1)].clone().sub(q[Math.max(0, i - 1)]).normalize(); return [p.x - t.z * sep * lado, p.z + t.x * sep * lado]; });
        franja(p2, 0.34, RC.huella, [1, 1, 1, 1], { y: sigue ? 0.07 : 0.018, sigue });
      }
    };
    const mancha = (x, z, r, color, reg = RC.mancha, ang = rnd() * TAU, alarg = 1) => {
      const base = c.n, ca = Math.cos(ang), sa = Math.sin(ang);
      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const lx = (u - 0.5) * 2 * r * alarg, lz = (v - 0.5) * 2 * r;
        c.v(V(x + lx * ca - lz * sa, 0.014, z + lx * sa + lz * ca), EJE_Y, 0.004 + u * 0.992, 0.004 + v * 0.992, color, reg);
      }
      c.I.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    };
    const charco = (x, z, r, ang = 0, alarg = 1) => {
      mancha(x, z, r * 1.55, [0.32, 0.25, 0.18, 0.85], RC.mancha, ang, alarg);
      const base = agua.n, n = 22, fase = rnd() * TAU, ca = Math.cos(ang), sa = Math.sin(ang);
      agua.v(V(x, 0.026, z), EJE_Y, x / 2, z / 2, [1, 1, 1], [0, 0, 1, 1]);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, rr = r * (0.78 + 0.16 * Math.sin(3 * a + fase) + 0.08 * Math.sin(7 * a + fase * 2));
        const lx = Math.cos(a) * rr * alarg, lz = Math.sin(a) * rr, px = x + lx * ca - lz * sa, pz = z + lx * sa + lz * ca;
        agua.v(V(px, 0.026, pz), EJE_Y, px / 2, pz / 2, [1, 1, 1], [0, 0, 1, 1]);
        agua.I.push(base, base + 1 + ((i + 1) % n), base + 1 + i);
      }
    };
    // carpeta de grava o tierra compactada bajo una instalación (marco local del grupo: x, z, giro), con un borde
    // irregular que se mezcla con el pasto; se dibuja antes que las huellas y manchas, que quedan encima
    const plataforma = (gx, gz, giro, ox, oz, hx, hz, reg, color, { tam = 2.5, borde = 1.4, paso = 0.7 } = {}) => {
      const base = c.n, nx = Math.ceil((2 * (hx + borde)) / paso), nz = Math.ceil((2 * (hz + borde)) / paso);
      const ca = Math.cos(giro), sa = Math.sin(giro), sem = rnd() * 50;
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const lx = -hx - borde + (i / nx) * 2 * (hx + borde), lz = -hz - borde + (j / nz) * 2 * (hz + borde);
        const dentro = Math.min(hx - Math.abs(lx), hz - Math.abs(lz));
        const ns = ruido.noise(lx * 0.32 + sem, 1.7, lz * 0.32) * 1.2 + ruido.noise(lx * 1.1, 4.2 + sem, lz * 1.1) * 0.4;
        const a = color[3] * sstep(-borde * 0.8, borde * 0.5, dentro + ns * borde * 0.8);
        const px = ox + lx, pz = oz + lz, x = gx + px * ca + pz * sa, z = gz - px * sa + pz * ca;
        c.v(V(x, sueloH(x, z) + 0.022, z), EJE_Y, px / tam, pz / tam, [color[0], color[1], color[2], a], reg);
      }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = base + j * (nx + 1) + i; c.I.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
    };
    plataforma(64, 56, Math.atan2(-0.5, -0.866), 2.0, 1.3, 13.6, 3.9, RC.grava, [0.95, 0.93, 0.9, 0.97], { tam: 2.2 });   // faena
    plataforma(-12, -68, 0, 2.5, 2.3, 14.5, 4.6, RC.tierra, [0.97, 0.94, 0.9, 0.93], { tam: 2.6 });                      // acopio sur
    plataforma(-17.4, -2.2, Math.atan2(0.991, 0.13), 0.1, 0.35, 3.4, 2.4, RC.tierra, [0.97, 0.94, 0.9, 0.9], { tam: 2.6, borde: 1.0, paso: 0.5 });
    plataforma(20.4, 0.9, 0.35, 0.3, 0.2, 1.3, 1.1, RC.tierra, [0.97, 0.94, 0.9, 0.85], { tam: 2.6, borde: 0.8, paso: 0.4 });
    plataforma(-9.6, -1.4, Math.atan2(9.6, 5.4), 0, -0.1, 1.8, 0.6, RC.tierra, [0.97, 0.94, 0.9, 0.75], { tam: 2.6, borde: 0.7, paso: 0.35 });
    // bordes de los senderos y de la plaza: tierra pisada que funde la grava y el hormigón con el pasto
    for (const s of SENDEROS) for (const lado of [-1, 1]) {
      const pts = [];
      for (let dd = 6.4; dd <= s.s1 - 0.4; dd += 1.6) { const off = 1.22 + ruido.noise(dd * 0.3, lado * 2.3, s.L * 0.1) * 0.2; pts.push([s.ux * dd - s.uz * off * lado, s.uz * dd + s.ux * off * lado]); }
      if (pts.length > 3) franja(pts, 0.95, RC.camino, [0.82, 0.77, 0.7, 0.6], { tam: 3, y: 0.034, paso: 1.1 });
    }
    {
      const pts = [];
      for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU, r = 7.3 + ruido.noise(Math.cos(a) * 1.5, 0.5, Math.sin(a) * 1.5) * 0.25; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      franja(pts, 1.2, RC.camino, [0.8, 0.75, 0.68, 0.55], { tam: 3, y: 0.036, cerrada: true });
    }
    // camino de tierra desde el portón a la carretera, con huellas
    const pA = [(CERCO[8][0] + CERCO[9][0]) / 2, (CERCO[8][1] + CERCO[9][1]) / 2];
    const acceso = [[pA[0] - 3, pA[1] - 4], pA, [pA[0] + 10, pA[1] + 13], [pA[0] + 21, pA[1] + 24], [116, 103]];
    franja(acceso, 5.2, RC.camino, [1, 1, 1, 1], { tam: 4, y: 0.06, sigue: true });
    huellas(acceso, 1.85, true);
    // huellas dentro de la obra: del portón a la faena y al acopio sur
    const aFaena = [[pA[0] + 2, pA[1] + 2], pA, [86, 54], [78, 43], [66, 43], [58, 47]];
    huellas(aFaena);
    const aSur = [pA, [84, 40], [86, 0], [82, -38], [62, -64], [24, -71], [-2, -64]];
    huellas(aSur); huellas(aSur.map(([x, z]) => [x + 0.9, z + 0.7]), 2.0);
    // charcos en las huellas y junto a la faena
    charco(85, 30, 1.3, 1.5, 1.8); charco(83.5, -22, 1.0, 1.3, 2.2); charco(40, -70.5, 1.6, 0.1, 1.6); charco(70, 44, 1.1, 0.3, 1.4);
    charco(57.4, 54.6, 0.8, 0.2, 1.2); charco(-12.5, -61.5, 1.2, 0.4, 1.5); charco(-13.6, 2.2, 0.7, 0.8, 1.3); charco(23.5, -2.4, 0.6, 0.3, 1.6);
    // manchas: aceite bajo el estacionamiento, lechada de cemento en los acopios y tierra húmeda
    mancha(60, 46.5, 0.9, [0.08, 0.07, 0.06, 0.55]); mancha(61.5, 45.2, 0.6, [0.08, 0.07, 0.06, 0.45]);
    for (const [x, z, r] of [[-16.4, -0.4, 1.4], [-19.0, -3.8, 1.0], [-18.0, -66.5, 2.2], [-4.5, -67, 1.6]]) mancha(x, z, r, [0.82, 0.81, 0.78, 0.55], RC.salpicado);
    for (const [x, z, r] of [[-6, -60, 3.5], [10, -64, 2.6], [70, 30, 3], [58, 66, 2.5], [-60, -50, 3], [-40, 70, 2.8], [30, 70, 3.2], [75, -40, 3]]) if (libre(x, z, 0)) mancha(x, z, r, [0.3, 0.25, 0.19, 0.5], RC.mancha, rnd() * TAU, 1.4);
    const mCal = new THREE.Mesh(c.geometria(), matCalco); mCal.renderOrder = 1; mCal.receiveShadow = true; raiz.add(mCal);
    const gA = agua.geometria(); gA.deleteAttribute('region'); gA.deleteAttribute('flex'); gA.deleteAttribute('color');
    const mAgua = new THREE.Mesh(gA, matAgua); mAgua.receiveShadow = true; raiz.add(mAgua);
  }

  // ---------------------------------------------------------------- matas de pasto
  {
    const m = new Malla(), rnd = mulberry32(57);
    const regs = [RV.pasto, RV.pasto, RV.pastoSeco, RV.maleza, RV.pastoCorto, RV.flores];
    const mata = (x, z, alto, ancho, reg) => {
      const y = sueloH(x, z) - 0.03, a0 = rnd() * Math.PI, tin = 0.8 + rnd() * 0.35, lean = V((rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25).multiplyScalar(alto);
      for (let k = 0; k < 3; k++) {
        const a = a0 + (k * Math.PI) / 3, dx = Math.cos(a) * ancho / 2, dz = Math.sin(a) * ancho / 2, base = m.n;
        for (const [s, v] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
          const p = V(x + dx * s + lean.x * v, y + alto * v, z + dz * s + lean.z * v);
          const nn = V(dx * s * 0.6, 1, dz * s * 0.6).normalize();
          m.v(p, nn, s < 0 ? 0.004 : 0.996, 0.004 + v * 0.992, [tin * (0.75 + 0.25 * v), tin * (0.78 + 0.22 * v), tin * (0.72 + 0.28 * v)], reg, v * v * 0.45);
        }
        m.I.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      }
    };
    // bordes de los senderos
    for (const s of SENDEROS) {
      for (let d = s.s0 + 4; d < s.s1; d += 0.35 + rnd() * 0.6) for (const lado of [-1, 1]) {
        if (rnd() < 0.35) continue;
        const off = 1.3 + rnd() * 0.75, x = s.ux * d - s.uz * off * lado, z = s.uz * d + s.ux * off * lado;
        if (enZona(x, z, 0.5) || distSendero(x, z) < 0.05 || Math.hypot(x, z) < 8) continue;
        const reg = regs[Math.floor(rnd() * regs.length)];
        mata(x, z, 0.28 + rnd() * 0.32, 0.35 + rnd() * 0.3, reg);
      }
    }
    // a lo largo del cerco (por dentro y por fuera)
    for (let i = 0; i < CERCO.length; i++) {
      const [x0, z0] = CERCO[i], [x1, z1] = CERCO[(i + 1) % CERCO.length], L = Math.hypot(x1 - x0, z1 - z0), nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
      for (let d = 0; d < L; d += 0.45 + rnd() * 0.7) {
        const off = (rnd() - 0.5) * 2.6, x = lerp(x0, x1, d / L) + nx * off, z = lerp(z0, z1, d / L) + nz * off;
        if (Math.abs(off) < 0.42 || enZona(x, z, 1) || Math.hypot(x - 85, z - 68) < 7) continue;
        mata(x, z, 0.35 + rnd() * 0.45, 0.4 + rnd() * 0.35, regs[Math.floor(rnd() * regs.length)]);
      }
    }
    // al pie de los grupos de objetos y dispersas en la obra
    for (const g of grupos) {
      g.geometry.computeBoundingBox();
      const b = g.geometry.boundingBox, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, rx = (b.max.x - b.min.x) / 2 + 0.6, rz = (b.max.z - b.min.z) / 2 + 0.6;
      for (let i = 0; i < 40; i++) {
        const a = rnd() * TAU, lx = cx + Math.cos(a) * rx * (0.95 + rnd() * 0.25), lz = cz + Math.sin(a) * rz * (0.95 + rnd() * 0.25);
        const p = V(lx, 0, lz).applyAxisAngle(EJE_Y, g.rotation.y).add(g.position);
        if (enZona(p.x, p.z, 0.5) || distSendero(p.x, p.z) < 0.3) continue;
        mata(p.x, p.z, 0.3 + rnd() * 0.35, 0.35 + rnd() * 0.3, regs[Math.floor(rnd() * regs.length)]);
      }
    }
    let n = 0;
    for (let i = 0; i < 6000 && n < 700; i++) {
      const x = -100 + rnd() * 200, z = -82 + rnd() * 176;
      if (distCerco(x, z) > -2 || !libre(x, z, 1) || ruido.noise(x / 14, 5.5, z / 14) < 0.15) continue;
      mata(x, z, 0.25 + rnd() * 0.35, 0.35 + rnd() * 0.3, regs[Math.floor(rnd() * regs.length)]); n++;
    }
    const mp = new THREE.Mesh(m.geometria(), matVeg); mp.receiveShadow = true; raiz.add(mp);
  }

  // ---------------------------------------------------------------- personas que caminan por los senderos
  const caminantes = [];
  {
    const P = kit.POSES, CL = kit.CLIPS, tab = P.tableta();
    const clipTableta = { duracion: 1.1, bucle: true, fn: (t) => ({ ...CL.caminar.fn(t), brazoD: tab.brazoD, brazoI: tab.brazoI, antebrazoD: tab.antebrazoD, antebrazoI: tab.antebrazoI, manoD: tab.manoD, manoI: tab.manoI, dedosD: tab.dedosD, dedosI: tab.dedosI, cuello: [0.22, 0, 0], cabeza: [0.16, 0, 0] }) };
    const clipBalde = { duracion: 1.1, bucle: true, fn: (t) => { const s = Math.sin((TAU * t) / 1.1); return { ...CL.caminar.fn(t), brazoD: [0.06 * s, 0, -0.2], antebrazoD: [-0.1, 0, 0], manoD: [0, 0, 0.05], dedosD: 0.95 }; } };
    const clipTabla = { duracion: 1.1, bucle: true, fn: (t) => ({ ...CL.caminar.fn(t), brazoD: [-0.7, 0, -0.45], antebrazoD: [-1.9, 0, 0], dedosD: 0.85 }) };
    // poses de pie (en las paradas) con lo que cada persona lleva
    const poseTableta = { ...tab, cuello: [0.22, 0, 0], cabeza: [0.16, 0, 0] };
    const poseBalde = { ...P.reposo(), brazoD: [0, 0, -0.2], antebrazoD: [-0.1, 0, 0], manoD: [0, 0, 0.05], dedosD: 0.95 };
    const poseTabla = { ...P.reposo(), brazoD: [-0.7, 0, -0.45], antebrazoD: [-1.9, 0, 0], dedosD: 0.85 };
    const defs = [
      { preset: 'capataz', semilla: 31, barba: 'bigote', rutas: ['escalera', 'postes', 'grava', 'cisterna'], vel: 1.0, clip: clipTableta, pose: poseTableta, lleva: 'tableta', fase: 0.05 },
      { preset: 'obrera', semilla: 32, rutas: ['deposito', 'arena', 'escalera'], vel: 1.2, clip: clipBalde, pose: poseBalde, lleva: 'balde', fase: 0.4 },
      { preset: 'obrero', semilla: 33, barba: 'sombra', rutas: ['ondas', 'cisterna', 'postes', 'deposito'], vel: 1.12, clip: clipTabla, pose: poseTabla, lleva: 'tabla', fase: 0.72 },
    ];
    const Rp = 5.6, lado = 0.6;
    const ruta = (ids) => {
      const pts = [], paradas = [], tramos = [];
      for (const id of ids) {
        const s = SENDEROS.find((q) => q.id === id);
        if (!s) continue;
        let fin = Math.min(s.L - 24, s.s1 - 1);
        for (let d = Rp + 2; d < s.L; d += 0.25) {
          const x = s.ux * d, z = s.uz * d;
          if (enZonaRuta(x, z, id, 1.2)) { fin = Math.min(fin, d - 1.5); break; }
        }
        if (fin > Rp + 5) tramos.push({ s, fin });
      }
      tramos.forEach(({ s, fin }, i) => {
        const ux = s.ux, uz = s.uz, rx = -uz, rz = ux;
        for (let d = Rp; d <= fin; d += 0.5) pts.push([ux * d + rx * lado, uz * d + rz * lado]);
        paradas.push({ x: ux * fin + rx * lado, z: uz * fin + rz * lado, mira: V(ux * s.L, 1.3, uz * s.L), dur: 2.5 + hash(i, 61) * 2 });
        for (let k = 1; k < 12; k++) { const a = (k / 12) * Math.PI; pts.push([ux * fin + (rx * Math.cos(a) + ux * Math.sin(a)) * lado, uz * fin + (rz * Math.cos(a) + uz * Math.sin(a)) * lado]); }
        for (let d = fin; d >= Rp; d -= 0.5) pts.push([ux * d - rx * lado, uz * d - rz * lado]);
        const sig = tramos[(i + 1) % tramos.length].s;
        const a0 = Math.atan2(uz * Rp - rz * lado, ux * Rp - rx * lado), a1 = Math.atan2(sig.uz * Rp + sig.ux * lado, sig.ux * Rp - sig.uz * lado);
        let da = a1 - a0; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        const Rr = Math.hypot(Rp, lado), pasos = Math.max(2, Math.ceil((Math.abs(da) * Rr) / 0.5));
        for (let k = 1; k < pasos; k++) { const a = a0 + (da * k) / pasos; pts.push([Math.cos(a) * Rr, Math.sin(a) * Rr]); }
      });
      // suavizado (Chaikin, cerrado) y muestreo cada 0,15 m
      let q = pts;
      for (let it = 0; it < 3; it++) {
        const r = [];
        for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; r.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
        q = r;
      }
      const acum = [0];
      for (let i = 1; i <= q.length; i++) acum.push(acum[i - 1] + Math.hypot(q[i % q.length][0] - q[i - 1][0], q[i % q.length][1] - q[i - 1][1]));
      const L = acum[q.length], ds = 0.15, n = Math.floor(L / ds), xs = new Float32Array(n), zs = new Float32Array(n);
      let j = 0;
      for (let i = 0; i < n; i++) {
        const s = i * ds;
        while (acum[j + 1] < s) j++;
        const t = (s - acum[j]) / Math.max(1e-6, acum[j + 1] - acum[j]), a = q[j], b = q[(j + 1) % q.length];
        xs[i] = lerp(a[0], b[0], t); zs[i] = lerp(a[1], b[1], t);
      }
      const largo = n * ds;
      for (const p of paradas) { let best = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = Math.hypot(xs[i] - p.x, zs[i] - p.z); if (d < bd) { bd = d; best = i; } } p.s = best * ds; }
      paradas.sort((a, b) => a.s - b.s);
      const en = (s) => { s = ((s % largo) + largo) % largo; const f = s / ds, i = Math.floor(f) % n, t = f - Math.floor(f), i2 = (i + 1) % n; return [lerp(xs[i], xs[i2], t), lerp(zs[i], zs[i2], t)]; };
      return { largo, en, paradas };
    };
    const balde = () => {
      const m = new Malla(), k = piezas(m), alto = 0.3, top = -0.17;
      k.geo(gCilindro(0.13, 0.155, alto, 16, { abierto: true }), RO.goma, 0x3a3a3a, 0, top - alto / 2, 0);
      k.geo(invertir(gCilindro(0.125, 0.15, alto, 16, { abierto: true })), RO.goma, 0x2a2a2a, 0, top - alto / 2, 0);
      k.geo(new THREE.CircleGeometry(0.13, 16), RO.goma, 0x2a2a2a, 0, top - alto, 0, { rx: Math.PI / 2 });
      k.geo(new THREE.CircleGeometry(0.142, 16), RO.hormigon, 0x8d8983, 0, top - 0.06, 0, { rx: -Math.PI / 2 });
      k.geo(new THREE.TorusGeometry(0.16, 0.005, 4, 14, Math.PI), RO.acero, 0xb0b0b0, 0, top, 0);
      return new THREE.Mesh(m.geometria(), matObj);
    };
    const tableta = () => {
      const m = new Malla(), k = piezas(m);
      k.caja(0.26, 0.012, 0.18, RO.goma, 0x2a2d31, 0, 0, 0);
      k.plano(0.24, 0.16, RO.vidrio, 0x9fb6d0, 0, 0.0065, 0, { rx: -Math.PI / 2 });
      return new THREE.Mesh(m.geometria(), matObj);
    };
    const tabla = () => {
      const m = new Malla(), k = piezas(m);
      k.caja(0.095, 0.045, 3.2, RO.madera, 0xd2b07e, 0, 0, 0, { tam: 1 });
      return new THREE.Mesh(m.geometria(), matObj);
    };
    defs.forEach((d, i) => {
      const r = ruta(d.rutas);
      if (!r.largo) return;
      const h = kit.persona({ preset: d.preset, semilla: d.semilla, barba: d.barba, padre: raiz });
      for (const mm of h.mallas) mm.castShadow = ['persona-superior', 'persona-inferior', 'persona-calzado', 'persona-casco'].includes(mm.name);
      const opc = { bucle: true, velocidad: d.vel / 1.273 };
      h.posar(d.pose).transicion(0.35);
      h.reproducir(d.clip, opc);
      const c = { h, d, r, opc, s: r.largo * d.fase, v: d.vel, rumbo: 0, parada: null, tParada: 0, proxima: 0, objeto: null, agarre: null, polo: V(), mira: V(), ultima: -1 };
      c.proxima = r.paradas.findIndex((p) => p.s > c.s); if (c.proxima < 0) c.proxima = 0;
      if (d.lleva === 'balde') { c.objeto = balde(); h.grupo.add(c.objeto); }
      if (d.lleva === 'tableta') { c.objeto = tableta(); h.grupo.add(c.objeto); h.sostener(c.objeto, { D: [-0.115, 0, 0.02], I: [0.115, 0, 0.02], arriba: [0, 1, 0] }); h.mirar(c.objeto); }
      if (d.lleva === 'tabla') {
        c.objeto = tabla(); h.grupo.add(c.objeto);
        c.agarre = new THREE.Object3D(); c.agarre.position.set(-0.06, -0.05, 0.38); c.objeto.add(c.agarre);
        h.alcanzar('D', c.agarre, c.polo, 1);
      }
      for (const o of [c.objeto]) if (o) { o.castShadow = true; o.receiveShadow = true; }
      const [x, z] = r.en(c.s), [x2, z2] = r.en(c.s + 0.5);
      c.rumbo = Math.atan2(x2 - x, z2 - z);
      h.grupo.position.set(x, 0.022, z); h.grupo.rotation.y = c.rumbo;
      caminantes.push(c);
      void i;
    });
  }
  const camPos = V(), vTmp = V(), vTmp2 = V();
  function moverCaminantes(dt, vr) {
    const congelar = rev.caminar !== undefined;
    for (let i = 0; i < caminantes.length; i++) {
      const c = caminantes[i], h = c.h, r = c.r;
      if (congelar) {
        if (c.ultima !== rev.caminar) {
          c.ultima = rev.caminar; c.s = r.largo * c.d.fase + rev.caminar * c.d.vel;
          h.fijarClip(c.d.clip, (rev.caminar * c.d.vel / 1.273) % 1.1);
        }
      } else {
        // velocidad deseada: se detiene en las paradas y cede el paso
        let objetivo = c.d.vel;
        const pr = r.paradas[c.proxima];
        if (c.parada) {
          objetivo = 0; c.tParada -= dt;
          if (c.tParada <= 0) { c.parada = null; c.proxima = (c.proxima + 1) % r.paradas.length; h.reproducir(c.d.clip, c.opc); if (c.d.lleva === 'tableta') h.mirar(c.objeto); }
        } else if (pr) {
          let dS = pr.s - c.s; if (dS < -r.largo / 2) dS += r.largo;
          if (dS >= 0 && dS < 0.3 && c.v < 0.2) { c.parada = pr; c.tParada = pr.dur; objetivo = 0; h.detener(); h.mirar(pr.mira); }
          else if (dS >= 0 && dS < (c.v * c.v) / 4.8 + 0.03) objetivo = 0;
          if (dS < 0 && dS > -1) c.proxima = (c.proxima + 1) % r.paradas.length;
        }
        const pos = h.grupo.position, fx = Math.sin(c.rumbo), fz = Math.cos(c.rumbo);
        for (let j = 0; j < i; j++) {
          const o = caminantes[j].h.grupo.position, dx = o.x - pos.x, dz = o.z - pos.z, dd = Math.hypot(dx, dz);
          if (dd < 1.7 && dx * fx + dz * fz > 0.45 * dd) objetivo = 0;
        }
        { const dx = camPos.x - pos.x, dz = camPos.z - pos.z, dd = Math.hypot(dx, dz); if (camPos.y < 2.4 && dd < 1.4 && dx * fx + dz * fz > 0.5 * dd) objetivo = 0; }
        c.v += clamp(objetivo - c.v, -2.4 * dt, 1.2 * dt);
        if (c.v < 0.01 && objetivo === 0) c.v = 0;
        c.s = (c.s + c.v * dt) % r.largo;
        c.opc.velocidad = c.v / 1.273;
      }
      const [x, z] = r.en(c.s), [xa, za] = r.en(c.s + 0.6), [xb, zb] = r.en(c.s - 0.6);
      const rumbo = Math.atan2(xa - xb, za - zb);
      let dr = rumbo - c.rumbo; while (dr > Math.PI) dr -= TAU; while (dr < -Math.PI) dr += TAU;
      c.rumbo += congelar ? dr : dr * (1 - Math.exp(-dt * 6));
      h.grupo.position.set(x, 0.022, z); h.grupo.rotation.y = c.rumbo;
      // visible a menos de 30 m en VR
      const dist = Math.hypot(camPos.x - x, camPos.z - z);
      h.grupo.visible = dist < (vr ? 30 : 170);
      if (!h.grupo.visible) continue;
      h.grupo.updateMatrixWorld(true);
      if (!c.parada && c.d.lleva !== 'tableta') {
        const dx = camPos.x - x, dz = camPos.z - z, frente = dx * Math.sin(c.rumbo) + dz * Math.cos(c.rumbo);
        if (c.d.lleva !== 'tabla' && dist < 7 && frente > 0.4 * dist && camPos.y < 2.5) h.mirar(vTmp.set(camPos.x, camPos.y - 0.05, camPos.z));
        else { const [xm, zm] = r.en(c.s + 5); h.mirar(c.mira.set(xm, 1.45, zm)); }
      }
      if (c.d.lleva === 'tabla') {
        // la tabla descansa sobre el hombro derecho y la mano derecha la sujeta por delante
        h.huesos.brazoD.getWorldPosition(vTmp2);
        const loc = h.grupo.worldToLocal(vTmp2.clone());
        c.objeto.position.set(loc.x + 0.05, loc.y + 0.085, loc.z - 0.05); c.objeto.rotation.set(-0.1, 0, 0.12);
        c.polo.set(-0.5, -1, -0.1).applyAxisAngle(EJE_Y, c.rumbo).normalize();
      }
      h.actualizar(congelar ? 0 : dt);
      if (c.d.lleva === 'balde') {
        h.manoD.getWorldPosition(vTmp2);
        const loc = h.grupo.worldToLocal(vTmp2.clone());
        c.objeto.position.set(loc.x, loc.y + 0.01, loc.z);
      }
    }
  }

  // ---------------------------------------------------------------- actualización por cuadro
  let tLOD = 0, tiempo = 0;
  camera.getWorldPosition(camPos);
  actualizarLOD(camPos, enVR());
  moverCaminantes(0, enVR());
  function actualizar(dt) {
    tiempo += dt;
    matVeg.userData.tiempo.value = tiempo;
    camera.getWorldPosition(camPos);
    const vr = enVR();
    tLOD += dt;
    if (tLOD > 0.5 && (camPos.distanceTo(lodPos) > 6 || vr !== lodVR)) { tLOD = 0; actualizarLOD(camPos, vr); }
    moverCaminantes(Math.min(dt, 0.1), vr);
  }
  return { actualizar, raiz, caminantes, especies, grupos, zonas };
}

// ------------------------------------------------------------------ bosque reutilizable
// El atlas de vegetación se pinta una sola vez y lo comparten la obra y las estaciones que plantan sus propios árboles.
let vegCompartida = null;
function atlasVegetacionCompartido() { vegCompartida ||= atlasVegetacion(); return vegCompartida; }

// Árboles de la obra (roble, álamo, pino, arbusto) en puntos dados, en coordenadas del padre: [{ x, y, z, esp, s }].
// Cerca de la cámara se usa el modelo con ramas y racimos de hojas y lejos su impostor pintado. Llamar actualizar(dt, cámara, vr).
export function crearBosque(padre, puntos, { radio = 140, radioVR = 75, semilla = 5 } = {}) {
  const A = arbolesCompartidos(), VEG = A.VEG, matLejos = materialLejos(A.lejos.tex);
  const mat = parcheAtlas(new THREE.MeshStandardMaterial({
    map: VEG.tex, normalMap: VEG.texN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.84, metalness: 0, vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.42, alphaToCoverage: true,
  }), { viento: true, sinVolteo: true, clave: 'veg' });
  const rnd = mulberry32(semilla), grupo = new THREE.Group(), especies = [];
  grupo.name = 'bosque'; padre.add(grupo);
  const lejanos = mallaLejana(puntos.filter((p) => p.esp !== 'arbusto').length, matLejos);
  grupo.add(lejanos.malla);
  for (const esp of ['roble', 'alamo', 'pino', 'arbusto']) {
    const lista = puntos.filter((p) => p.esp === esp);
    if (!lista.length) continue;
    const mi = new THREE.InstancedMesh(A.modelos[esp].geo, mat, lista.length);
    const mats = lista.map((p) => new THREE.Matrix4().compose(V(p.x, p.y - 0.12, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.04, rnd() * TAU, (rnd() - 0.5) * 0.04)), V(p.s, p.s * (0.88 + rnd() * 0.24), p.s)));
    const cols = lista.map(() => { const t = 0.86 + rnd() * 0.22; return new THREE.Color(t * (0.96 + rnd() * 0.08), t, t * (0.94 + rnd() * 0.1)); });
    mi.frustumCulled = false; mi.castShadow = false; mi.receiveShadow = false; grupo.add(mi);
    especies.push({ esp, cerca: mi, lejos: esp !== 'arbusto', mats, cols, pos: lista.map((p) => [p.x, p.z]) });
  }
  let tiempo = 0, ultima = null, ultimaVR = null;
  const local = V();
  // la distancia se mide en unidades del bosque: en una maqueta a escala los árboles se ven como árboles lejanos
  function lod(c, vr) {
    const r = vr ? radioVR : radio;
    let b = 0;
    for (const e of especies) {
      let a = 0;
      for (let i = 0; i < e.mats.length; i++) {
        if (e.lejos && Math.hypot(e.pos[i][0] - c.x, e.pos[i][1] - c.z) > r) lejanos.poner(b++, e.esp, e.mats[i], e.cols[i]);
        else { e.cerca.setMatrixAt(a, e.mats[i]); e.cerca.setColorAt(a++, e.cols[i]); }
      }
      e.cerca.count = a; e.cerca.visible = a > 0; e.cerca.instanceMatrix.needsUpdate = true; if (e.cerca.instanceColor) e.cerca.instanceColor.needsUpdate = true;
    }
    lejanos.cerrar(b);
  }
  return {
    grupo,
    actualizar(dt, camara, vr) {
      tiempo += dt; mat.userData.tiempo.value = tiempo;
      grupo.updateWorldMatrix(true, false);
      local.copy(camara); grupo.worldToLocal(local);
      if (!ultima || local.distanceTo(ultima) > 6 || vr !== ultimaVR) { lod(local, vr); ultima = local.clone(); ultimaVR = vr; }
    },
  };
}
