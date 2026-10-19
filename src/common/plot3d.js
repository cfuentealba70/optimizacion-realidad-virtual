// Gráfico de una función dentro del espacio 3D, para el escritorio y para la realidad virtual.
//
// La tarjeta (fondo, cuadrícula mayor y menor, ejes con flechas, graduación y títulos de los ejes) se dibuja una sola vez en un
// lienzo de alta resolución. La curva es una cinta de geometría con halo: queda nítida a cualquier distancia y se recorta en el
// borde del área del gráfico en vez de aplastarse contra él. El marcador, los puntos destacados, las guías discontinuas y la
// tangente son cuadriláteros con sombreadores propios que se mueven cambiando su transformación, sin crear geometría en cada
// cuadro, lo que importa en las Meta Quest 3. Dos fichas sobre los ejes muestran en vivo los valores de x y de f(x) del marcador.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createLabel, setLabelText, font, roundRect } from './panel.js';
import { num } from '../math/guia4.js';

// Línea discontinua de cilindros en el espacio (se mantiene para las cotas en 3D de las estaciones).
export function dashedLine(a, b, { radius = 0.003, dash = 0.02, gap = 0.014, color = 0xffffff, opacity = 1 } = {}) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const geos = [];
  for (let s = 0; s < len; s += dash + gap) {
    const l = Math.min(dash, len - s);
    if (l <= 0) break;
    const g = new THREE.CylinderGeometry(radius, radius, l, 6, 1, false);
    g.translate(0, l / 2 + s, 0);
    g.applyQuaternion(q);
    g.translate(a.x, a.y, a.z);
    geos.push(g);
  }
  const geo = geos.length ? mergeGeometries(geos) : new THREE.BufferGeometry();
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false }));
}

// ------------------------------------------------------------------ piezas compartidas
// Cuadrilátero de 1 × 1 que va de x = 0 a x = 1 (líneas) y otro centrado (puntos y fichas). No se liberan nunca.
const PLANO_LINEA = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);
const PLANO_CENTRO = new THREE.PlaneGeometry(1, 1);
PLANO_LINEA.userData.compartida = true; PLANO_CENTRO.userData.compartida = true;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Línea con trazos (uGap > 0) o continua, de bordes suaves y con desvanecido opcional en los extremos.
const FRAG_LINEA = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uLen; uniform float uDash; uniform float uGap; uniform float uFade;
varying vec2 vUv;
void main() {
  float d = vUv.x * uLen;
  float on = 1.0;
  if (uGap > 0.0) {
    float m = mod(d, uDash + uGap); float aa = max(fwidth(d), 1e-5);
    on = smoothstep(0.0, aa, m) * (1.0 - smoothstep(uDash - aa, uDash + aa, m));
  }
  float e = abs(vUv.y * 2.0 - 1.0); float aw = max(fwidth(e), 1e-4);
  float lado = 1.0 - smoothstep(1.0 - 2.0 * aw, 1.0, e);
  float fin = uFade > 0.0 ? smoothstep(0.0, uFade, vUv.x) * smoothstep(0.0, uFade, 1.0 - vUv.x) : 1.0;
  gl_FragColor = vec4(uColor, uOpacity * on * lado * fin);
  if (gl_FragColor.a < 0.004) discard;
  #include <colorspace_fragment>
}`;

// Disco con relleno, anillo y halo (marcador y puntos destacados). Los radios van de 0 a 1 respecto del medio lado del cuadrado.
const FRAG_PUNTO = /* glsl */ `
uniform vec3 uFill; uniform vec3 uRing; uniform float uR0; uniform float uR1; uniform float uHalo; uniform float uHollow; uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); float aa = max(fwidth(r), 1e-4) * 1.2;
  float dentro = 1.0 - smoothstep(uR0 - aa, uR0 + aa, r);
  float anillo = smoothstep(uR0 - aa, uR0 + aa, r) * (1.0 - smoothstep(uR1 - aa, uR1 + aa, r));
  float halo = uHalo * (1.0 - smoothstep(uR1, 1.0, r)) * smoothstep(uR1 - aa, uR1 + aa, r);
  vec4 c = vec4(uRing, halo);
  c = mix(c, vec4(uRing, 1.0), anillo);
  if (uHollow < 0.5) c = mix(c, vec4(uFill, 1.0), dentro);
  gl_FragColor = vec4(c.rgb, c.a * uOpacity);
  if (gl_FragColor.a < 0.004) discard;
  #include <colorspace_fragment>
}`;

// Cinta de la curva: el atributo aLado va de −1 a 1 a lo ancho. El núcleo suaviza sus bordes y el halo se desvanece hacia afuera.
const VERT_CINTA = /* glsl */ `
attribute float aLado;
varying float vLado; varying vec3 vColor;
void main() { vLado = aLado; vColor = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG_CINTA = /* glsl */ `
uniform float uHalo; uniform float uOpacity;
varying float vLado; varying vec3 vColor;
void main() {
  float e = abs(vLado);
  float a;
  if (uHalo > 0.0) a = uHalo * pow(1.0 - e, 2.2);
  else { float aa = max(fwidth(e), 1e-4) * 1.5; a = 1.0 - smoothstep(1.0 - aa, 1.0, e); }
  gl_FragColor = vec4(vColor, a * uOpacity);
  if (gl_FragColor.a < 0.004) discard;
  #include <colorspace_fragment>
}`;
function materialCinta(halo) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT_CINTA, fragmentShader: FRAG_CINTA, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uHalo: { value: halo }, uOpacity: { value: 1 } },
  });
}

function materialLinea({ color = 0xffffff, opacity = 1, dash = 0, gap = 0, fade = 0 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG_LINEA, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uLen: { value: 1 }, uDash: { value: dash }, uGap: { value: gap }, uFade: { value: fade } },
  });
}
function materialPunto({ fill = 0xffffff, ring = 0x0b1520, r0 = 0.7, r1 = 0.95, halo = 0, hollow = false } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG_PUNTO, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uFill: { value: new THREE.Color(fill) }, uRing: { value: new THREE.Color(ring) }, uR0: { value: r0 }, uR1: { value: r1 }, uHalo: { value: halo }, uHollow: { value: hollow ? 1 : 0 }, uOpacity: { value: 1 } },
  });
}
// Coloca un cuadrilátero de línea entre a y b (coordenadas locales del gráfico) con el grosor dado.
function tenderLinea(m, ax, ay, bx, by, z, grosor) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
  m.visible = len > 1e-5;
  if (!m.visible) return;
  m.position.set(ax, ay, z); m.rotation.set(0, 0, Math.atan2(dy, dx)); m.scale.set(len, grosor, 1);
  m.material.uniforms.uLen.value = len;
}
function liberar(o) {
  o.traverse((n) => {
    if (n.geometry && !n.geometry.userData.compartida) n.geometry.dispose();
    if (n.material) { n.material.map?.dispose?.(); n.material.dispose(); }
  });
}

// Recorta el segmento p-q al rectángulo [ax, bx] × [ay, by] (Liang-Barsky). Devuelve [t0, t1] o null.
function recortar(px, py, qx, qy, ax, ay, bx, by) {
  let t0 = 0, t1 = 1;
  const dx = qx - px, dy = qy - py;
  for (const [p, q] of [[-dx, px - ax], [dx, bx - px], [-dy, py - ay], [dy, by - py]]) {
    if (Math.abs(p) < 1e-14) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [t0, t1];
}

// Decimales para mostrar valores de un intervalo con unas tres cifras significativas.
function decimalesPara(a, b, minimo = 0) {
  const m = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.max(minimo, Math.min(3, 2 - Math.floor(Math.log10(m))));
}
function decimalesDe(valores) {
  let d = 0;
  for (const v of valores) { const s = String(+v.toFixed(6)); const i = s.indexOf('.'); if (i >= 0) d = Math.max(d, s.length - i - 1); }
  return Math.min(d, 4);
}

// Ficha de texto que cambia a menudo: lienzo fijo, se redibuja solo si cambia el texto y se recorta con la textura.
function crearFicha(size, { color = '#0b1520', weight = 700 } = {}) {
  const ppm = 1500, px = Math.round(size * ppm), H = Math.ceil(px * 1.5), W = H * 9;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const mesh = new THREE.Mesh(PLANO_CENTRO, new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = 13; mesh.userData.tipo = 'etiqueta'; mesh.userData.size = [0, 0]; mesh.visible = false;
  let ultimo = '';
  function fijar(texto, fondo) {
    const clave = texto + '|' + fondo;
    if (clave === ultimo) return;
    ultimo = clave;
    ctx.font = font(px, weight);
    const w = Math.min(W, Math.ceil(ctx.measureText(texto).width + px * 0.7));
    ctx.clearRect(0, 0, W, H);
    roundRect(ctx, 1, 1, w - 2, H - 2, H * 0.3); ctx.fillStyle = fondo; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(11,21,32,0.55)'; ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font(px, weight);
    ctx.fillText(texto, w / 2, H / 2 + px * 0.04);
    tex.repeat.set(w / W, 1); tex.offset.set(0, 0); tex.needsUpdate = true;
    mesh.scale.set(w / ppm, H / ppm, 1); mesh.userData.size = [w / ppm, H / ppm];
  }
  return { mesh, fijar };
}

// Números de la graduación: un atlas con todos los textos y una malla instanciada (una sola llamada de dibujo). Cada número se
// oculta o se muestra cambiando la escala de su instancia, sin redibujar ningún lienzo.
const VERT_ATLAS = /* glsl */ `
attribute vec4 aRect;
varying vec2 vUv;
void main() { vUv = mix(aRect.xy, aRect.zw, uv); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
const FRAG_ATLAS = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(map, vUv);
  if (gl_FragColor.a < 0.02) discard;
  #include <colorspace_fragment>
}`;
function crearGraduacion(items, size, { color = '#c6d7e8', weight = 500 } = {}) {
  const ppm = 1400, px = Math.round(size * ppm), H = Math.ceil(px * 1.3), pad = Math.ceil(px * 0.12);
  const medir = document.createElement('canvas').getContext('2d');
  medir.font = font(px, weight);
  const anchos = items.map((it) => Math.ceil(medir.measureText(it.txt).width) + pad * 2);
  const MAXW = 2048;
  let x = 0, y = 0;
  const pos = anchos.map((w) => { if (x + w > MAXW) { x = 0; y += H; } const p = [x, y]; x += w; return p; });
  const W = Math.min(MAXW, Math.max(4, ...pos.map((p, i) => p[0] + anchos[i]))), AH = y + H;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = AH;
  const ctx = canvas.getContext('2d');
  ctx.font = font(px, weight); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  items.forEach((it, i) => ctx.fillText(it.txt, pos[i][0] + anchos[i] / 2, pos[i][1] + H / 2 + px * 0.04));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const n = Math.max(1, items.length);
  const geo = new THREE.InstancedBufferGeometry().copy(PLANO_CENTRO);
  geo.userData = {};
  const rects = new Float32Array(n * 4);
  items.forEach((it, i) => {
    const [px0, py0] = pos[i];
    rects.set([px0 / W, 1 - (py0 + H) / AH, (px0 + anchos[i]) / W, 1 - py0 / AH], i * 4);
  });
  geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(rects, 4));
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT_ATLAS, fragmentShader: FRAG_ATLAS, uniforms: { map: { value: tex } }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.count = items.length; mesh.renderOrder = 11; mesh.frustumCulled = false;
  const tam = items.map((it, i) => [anchos[i] / ppm, H / ppm]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), e = new THREE.Vector3();
  let ocultos = null;
  function ocultar(set) {
    const clave = [...set].sort((a, b) => a - b).join(',');
    if (clave === ocultos) return;
    ocultos = clave;
    items.forEach((it, i) => {
      const [w, h] = tam[i], fuera = set.has(i);
      v.set(it.cx(w), it.cy, it.z ?? 0.004); e.set(fuera ? 0 : w, fuera ? 0 : h, 1);
      mesh.setMatrixAt(i, m4.compose(v, q, e));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  ocultar(new Set());
  const rectDe = (i) => { const [w, h] = tam[i], c = items[i].cx(w); return [c - w / 2, items[i].cy - h / 2, c + w / 2, items[i].cy + h / 2]; };
  return { mesh, ocultar, rectDe, n: items.length };
}

const css = (hex) => '#' + new THREE.Color(hex).getHexString();
const PAD = 0.03, TICK = 0.012, HUECO = 0.012, FLECHA = 0.04;

export function createPlot(opts) {
  const {
    f: f0, x0 = 0, x1 = 1, y0 = 0, y1 = 1, width = 1, height = 0.6,
    xTicks = [], yTicks = [], xLabel = 'x', yLabel = 'y', samples = 420, radius = 0.0055,
    curveColor = 0xffb347, labelSize = 0.032, tickFmt = null, yTickFmt = null,
    formatoX = null, formatoY = null,
  } = opts;

  let f = f0;
  const group = new THREE.Group();
  group.userData.tipo = 'grafico';
  const sx = width / (x1 - x0), sy = height / (y1 - y0);
  const toLocal = (x, y, z = 0) => new THREE.Vector3((x - x0) * sx, (y - y0) * sy, z);
  const s = labelSize;

  // formatos de la graduación y de las fichas en vivo
  const decX = decimalesDe(xTicks), decY = decimalesDe(yTicks);
  const fmtTX = tickFmt || ((v) => num(v, decX));
  const fmtTY = yTickFmt || tickFmt || ((v) => num(v, decY));
  const dX = decimalesPara(x0, x1, decX), dY = decimalesPara(y0, y1, decY);
  const fmtX = formatoX || ((v) => num(v, dX));
  const fmtY = formatoY || ((v) => num(v, dY));

  // ---------------------------------------------------------------- medidas de la tarjeta (en metros)
  const medir = document.createElement('canvas').getContext('2d');
  const PPM_MED = 1000;
  const anchoTexto = (t, tam, peso) => { medir.font = font(Math.round(tam * PPM_MED), peso); return medir.measureText(String(t)).width / PPM_MED; };
  const etX = xTicks.map((t) => ({ t, txt: fmtTX(t) })), etY = yTicks.map((t) => ({ t, txt: fmtTY(t) }));
  for (const e of etX) e.w = anchoTexto(e.txt, s, 500);
  for (const e of etY) e.w = anchoTexto(e.txt, s, 500);
  const anchoY = Math.max(0.05, ...etY.map((e) => e.w));
  const filaX = -(TICK + HUECO + s * 0.62); // centro de la fila de la graduación de x (y de los rótulos de los puntos)
  const sTit = s * 1.08;
  const mIzq = PAD + anchoY + HUECO + TICK + 0.01;
  const mDer = PAD + FLECHA + Math.max(0, (etX.length ? etX[etX.length - 1].w / 2 : 0) - FLECHA);
  const mAbajo = TICK + HUECO + s * 1.25 + 0.016 + sTit * 1.25 + PAD;
  const mArriba = PAD + sTit * 1.3 + 0.02 + FLECHA * 0.6;
  const cardW = width + mIzq + mDer, cardH = height + mAbajo + mArriba;
  const cx = (width + mDer - mIzq) / 2, cy = (height + mArriba - mAbajo) / 2;

  // ---------------------------------------------------------------- tarjeta en un lienzo de alta resolución
  const ppm = Math.min(1700, 2048 / cardW, 2048 / cardH);
  const CW = Math.round(cardW * ppm), CH = Math.round(cardH * ppm);
  const lienzo = document.createElement('canvas'); lienzo.width = CW; lienzo.height = CH;
  const ctx = lienzo.getContext('2d');
  const texTarjeta = new THREE.CanvasTexture(lienzo);
  texTarjeta.colorSpace = THREE.SRGBColorSpace; texTarjeta.anisotropy = 8;
  texTarjeta.generateMipmaps = true; texTarjeta.minFilter = THREE.LinearMipmapLinearFilter;
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(cardW, cardH),
    new THREE.MeshBasicMaterial({ map: texTarjeta, transparent: true, depthWrite: true, toneMapped: false, alphaTest: 0.02, side: THREE.DoubleSide }),
  );
  back.position.set(cx, cy, -0.004);
  back.renderOrder = 4;
  group.add(back);
  group.userData.fondo = back;

  const PX = (lx) => (lx + mIzq) * ppm, PY = (ly) => (height + mArriba - ly) * ppm;

  function dibujarTarjeta() {
    const c = ctx;
    c.clearRect(0, 0, CW, CH);
    // fondo con degradado, borde y una línea de acento arriba
    const r = 0.022 * ppm;
    roundRect(c, 2, 2, CW - 4, CH - 4, r);
    const gr = c.createLinearGradient(0, 0, 0, CH);
    gr.addColorStop(0, 'rgba(19, 30, 46, 0.95)'); gr.addColorStop(1, 'rgba(10, 17, 27, 0.95)');
    c.fillStyle = gr; c.fill();
    c.lineWidth = Math.max(2, 0.0018 * ppm); c.strokeStyle = 'rgba(150, 190, 240, 0.30)'; c.stroke();
    c.save(); roundRect(c, 2, 2, CW - 4, CH - 4, r); c.clip();
    c.fillStyle = css(curveColor); c.globalAlpha = 0.85; c.fillRect(0, 0, CW, Math.max(3, 0.004 * ppm)); c.globalAlpha = 1;
    c.restore();
    // área del gráfico
    const ax = PX(0), ay = PY(height), aw = width * ppm, ah = height * ppm;
    c.fillStyle = 'rgba(255, 255, 255, 0.028)'; c.fillRect(ax, ay, aw, ah);
    // cuadrícula menor
    const menor = (ticks, a, b) => {
      if (ticks.length < 2) return [];
      const paso = ticks[1] - ticks[0];
      const lider = paso / 10 ** Math.floor(Math.log10(Math.abs(paso)));
      const div = Math.abs(lider - 2) < 1e-6 || Math.abs(lider - 2.5) < 1e-6 ? 4 : 5;
      const out = [];
      for (let v = ticks[0] - paso; v <= b + 1e-9; v += paso / div) if (v >= a - 1e-9 && !ticks.some((t) => Math.abs(t - v) < paso * 1e-6)) out.push(v);
      return out;
    };
    c.lineWidth = Math.max(1, 0.0009 * ppm); c.strokeStyle = 'rgba(160, 185, 210, 0.07)';
    c.beginPath();
    for (const v of menor(xTicks, x0, x1)) { const X = PX((v - x0) * sx); c.moveTo(X, ay); c.lineTo(X, ay + ah); }
    for (const v of menor(yTicks, y0, y1)) { const Y = PY((v - y0) * sy); c.moveTo(ax, Y); c.lineTo(ax + aw, Y); }
    c.stroke();
    // cuadrícula mayor
    c.lineWidth = Math.max(1.5, 0.0013 * ppm); c.strokeStyle = 'rgba(165, 190, 215, 0.17)';
    c.beginPath();
    for (const t of xTicks) { const X = PX((t - x0) * sx); c.moveTo(X, ay); c.lineTo(X, ay + ah); }
    for (const t of yTicks) { const Y = PY((t - y0) * sy); c.moveTo(ax, Y); c.lineTo(ax + aw, Y); }
    c.stroke();
    // ejes con flecha y marcas de graduación
    const ejeC = '#dfe9f4', grosorEje = Math.max(2.5, 0.0034 * ppm), fl = 0.017 * ppm;
    c.strokeStyle = ejeC; c.fillStyle = ejeC; c.lineWidth = grosorEje; c.lineCap = 'round';
    c.beginPath(); c.moveTo(PX(0), PY(0)); c.lineTo(PX(width + FLECHA) - fl * 0.8, PY(0)); c.moveTo(PX(0), PY(0)); c.lineTo(PX(0), PY(height + FLECHA * 0.6) + fl * 0.8); c.stroke();
    c.beginPath(); c.moveTo(PX(width + FLECHA), PY(0)); c.lineTo(PX(width + FLECHA) - fl, PY(0) - fl * 0.5); c.lineTo(PX(width + FLECHA) - fl, PY(0) + fl * 0.5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(PX(0), PY(height + FLECHA * 0.6)); c.lineTo(PX(0) - fl * 0.5, PY(height + FLECHA * 0.6) + fl); c.lineTo(PX(0) + fl * 0.5, PY(height + FLECHA * 0.6) + fl); c.closePath(); c.fill();
    c.lineWidth = Math.max(2, 0.0024 * ppm); c.beginPath();
    for (const t of xTicks) { const X = PX((t - x0) * sx); c.moveTo(X, PY(0)); c.lineTo(X, PY(-TICK)); }
    for (const t of yTicks) { const Y = PY((t - y0) * sy); c.moveTo(PX(0), Y); c.lineTo(PX(-TICK), Y); }
    c.stroke();
    // títulos de los ejes
    c.fillStyle = '#ffffff'; c.font = font(Math.round(sTit * ppm), 700);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillText(xLabel, PX(width / 2), PY(-mAbajo + PAD));
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(yLabel, PX(-mIzq + PAD), PY(height + mArriba - PAD - sTit * 0.62));
    texTarjeta.needsUpdate = true;
  }
  dibujarTarjeta();

  // números de la graduación (atlas instanciado): se ocultan los que pisa un rótulo destacado o una ficha en vivo
  const grad = crearGraduacion([
    ...etX.map((e) => ({ txt: e.txt, cx: () => (e.t - x0) * sx, cy: filaX })),
    ...etY.map((e) => ({ txt: e.txt, cx: (w) => -TICK - HUECO + w * 0.06 - w / 2, cy: (e.t - y0) * sy })),
  ], s);
  group.add(grad.mesh);

  // ---------------------------------------------------------------- curva: cinta con halo, recortada al área del gráfico
  const colorBase = new THREE.Color(curveColor);
  let curva = null;
  function polilineas(fn) {
    const N = Math.max(60, samples), out = [];
    let actual = null, prev = null;
    const ancho = y1 - y0;
    for (let i = 0; i <= N; i++) {
      const x = x0 + ((x1 - x0) * i) / N, y = fn(x);
      const p = Number.isFinite(y) ? { x, y } : null;
      if (p && prev && Math.abs(p.y - prev.y) < ancho * 6) {
        const t = recortar(prev.x, prev.y, p.x, p.y, x0, y0, x1, y1);
        if (t) {
          const a = { x: prev.x + (p.x - prev.x) * t[0], y: prev.y + (p.y - prev.y) * t[0] };
          const b = { x: prev.x + (p.x - prev.x) * t[1], y: prev.y + (p.y - prev.y) * t[1] };
          if (!actual || t[0] > 1e-9) { actual = [a]; out.push(actual); }
          actual.push(b);
          if (t[1] < 1 - 1e-9) actual = null;
        } else actual = null;
      } else actual = null;
      prev = p;
    }
    return out.filter((pl) => pl.length > 1);
  }
  function cinta(lineas, grosor, z, colorDe) {
    const pos = [], col = [], lado = [], idx = [];
    const c = new THREE.Color();
    for (const pl of lineas) {
      const P = pl.map((p) => [(p.x - x0) * sx, (p.y - y0) * sy, p.x]);
      const base = pos.length / 3;
      for (let i = 0; i < P.length; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], p = P[i];
        let tx = b[0] - a[0], ty = b[1] - a[1]; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
        let k = 1;
        if (i > 0 && i < P.length - 1) {
          const ux = p[0] - a[0], uy = p[1] - a[1], lu = Math.hypot(ux, uy) || 1;
          k = 1 / Math.max(0.4, (-ty) * (-uy / lu) + tx * (ux / lu));
        }
        const h = (grosor / 2) * k;
        pos.push(p[0] - ty * h, p[1] + tx * h, z, p[0] + ty * h, p[1] - tx * h, z);
        lado.push(1, -1);
        colorDe(p[2], c);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if (i > 0) { const j = base + (i - 1) * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aLado', new THREE.Float32BufferAttribute(lado, 1));
    g.setIndex(idx);
    return g;
  }
  function buildCurve(fn) {
    if (curva) { group.remove(curva); liberar(curva); }
    const lineas = polilineas(fn);
    const colorDe = (x, c) => (opts.colorAt ? c.set(opts.colorAt(x)) : c.copy(colorBase));
    curva = new THREE.Group();
    const halo = new THREE.Mesh(cinta(lineas, radius * 7, 0.0012, colorDe), materialCinta(0.34));
    const nucleo = new THREE.Mesh(cinta(lineas, radius * 2.1, 0.0018, colorDe), materialCinta(0));
    halo.renderOrder = 5; nucleo.renderOrder = 6;
    curva.add(halo, nucleo);
    group.add(curva);
  }
  buildCurve(f);

  // ---------------------------------------------------------------- marcador móvil, guías y fichas de los ejes
  const R_MARCA = 0.042;
  const marker = new THREE.Mesh(PLANO_CENTRO, materialPunto({ fill: 0xffffff, ring: curveColor, r0: 0.4, r1: 0.56, halo: 0.42 }));
  marker.scale.set(R_MARCA * 2, R_MARCA * 2, 1); marker.renderOrder = 10;
  group.add(marker);
  const guiaV = new THREE.Mesh(PLANO_LINEA, materialLinea({ color: 0xffffff, opacity: 0.92, dash: 0.02, gap: 0.011 }));
  const guiaH = new THREE.Mesh(PLANO_LINEA, materialLinea({ color: 0xffffff, opacity: 0.92, dash: 0.02, gap: 0.011 }));
  guiaV.renderOrder = guiaH.renderOrder = 7;
  group.add(guiaV, guiaH);
  const fichaX = crearFicha(s * 0.98), fichaY = crearFicha(s * 0.98);
  group.add(fichaX.mesh, fichaY.mesh);
  let liveOn = true, lastX = null, colorMarca = '#ffffff';

  const rect = (l) => { const [w, h] = l.userData.size; return [l.position.x - w / 2, l.position.y - h / 2, l.position.x + w / 2, l.position.y + h / 2]; };
  const chocan = (a, b) => a[0] < b[2] - 0.002 && b[0] < a[2] - 0.002 && a[1] < b[3] - 0.002 && b[1] < a[3] - 0.002;
  const fixed = new Map();
  const rotulosFijos = () => { const r = []; for (const g of fixed.values()) g.traverse((o) => { if (o.userData.rotuloPunto) r.push(rect(o)); }); return r; };

  function setMarker(x, { guides = liveOn, color = 0xffffff } = {}) {
    const xv = Math.min(x1, Math.max(x0, x));
    const yv = f(xv);
    const yc = Number.isFinite(yv) ? Math.min(y1, Math.max(y0, yv)) : y0;
    const px = (xv - x0) * sx, py = (yc - y0) * sy;
    marker.position.set(px, py, 0.0075);
    colorMarca = css(color);
    marker.material.uniforms.uFill.value.set(color);
    lastX = xv;
    guiaV.visible = guiaH.visible = guides;
    if (guides) { tenderLinea(guiaV, px, 0, px, py, 0.003, 0.0058); tenderLinea(guiaH, 0, py, px, py, 0.003, 0.0058); }
    // fichas con los valores actuales (se ocultan si pisan el rótulo de un punto destacado)
    const fijos = rotulosFijos();
    fichaX.mesh.visible = fichaY.mesh.visible = guides;
    if (guides) {
      fichaX.fijar(fmtX(xv), colorMarca === '#ffffff' ? '#f2f6fb' : colorMarca);
      fichaX.mesh.position.set(px, filaX, 0.009);
      fichaX.mesh.visible = !fijos.some((r) => chocan(rect(fichaX.mesh), r));
      const enRango = Number.isFinite(yv) && yv >= y0 && yv <= y1;
      fichaY.fijar(Number.isFinite(yv) ? fmtY(yv) : '—', colorMarca === '#ffffff' ? '#f2f6fb' : colorMarca);
      fichaY.mesh.position.set(-TICK - HUECO + 0.004 - fichaY.mesh.userData.size[0] / 2, py, 0.009);
      fichaY.mesh.visible = enRango && !fijos.some((r) => chocan(rect(fichaY.mesh), r));
    }
    revisarGraduacion();
    return { x: xv, y: yv };
  }

  // ---------------------------------------------------------------- puntos destacados con guías y rótulos
  function revisarGraduacion() {
    const tapan = rotulosFijos();
    for (const fch of [fichaX.mesh, fichaY.mesh]) if (fch.visible) tapan.push(rect(fch));
    const ocultos = new Set();
    for (let i = 0; i < grad.n; i++) if (tapan.some((r) => chocan(grad.rectDe(i), r))) ocultos.add(i);
    grad.ocultar(ocultos);
  }

  // hollow: círculo vacío (extremo excluido del dominio)
  function addPoint(id, x, y, { color = 0x6fe3a2, labelX = null, labelY = null, radiusP = 0.019, guides = true, hollow = false } = {}) {
    removePoint(id, false);
    const g = new THREE.Group();
    const p = toLocal(x, y, 0.006);
    const R = radiusP * 1.05;
    const punto = new THREE.Mesh(PLANO_CENTRO, materialPunto({ fill: color, ring: hollow ? color : 0x0b1520, r0: hollow ? 0.62 : 0.78, r1: 0.98 }));
    punto.material.uniforms.uHollow.value = hollow ? 1 : 0;
    punto.scale.set(R * 2, R * 2, 1); punto.position.copy(p); punto.renderOrder = 9;
    g.add(punto);
    if (guides) {
      const v = new THREE.Mesh(PLANO_LINEA, materialLinea({ color, opacity: 0.95, dash: 0.022, gap: 0.012 }));
      const h = new THREE.Mesh(PLANO_LINEA, materialLinea({ color, opacity: 0.95, dash: 0.022, gap: 0.012 }));
      tenderLinea(v, p.x, 0, p.x, p.y, 0.0035, 0.0055); tenderLinea(h, 0, p.y, p.x, p.y, 0.0035, 0.0055);
      v.renderOrder = h.renderOrder = 8;
      g.add(v, h);
    }
    const otros = rotulosFijos();
    const libre = (l) => !otros.some((o) => chocan(rect(l), o));
    const fondo = css(color);
    if (labelX) {
      const l = createLabel(labelX, { size: s * 1.0, color: '#0b1520', bg: fondo, weight: 700 });
      l.position.set(p.x, filaX, 0.008);
      for (let k = 0; k < 3 && !libre(l); k++) l.position.y -= l.userData.size[1] + 0.006;
      l.userData.rotuloPunto = true; l.renderOrder = 12;
      g.add(l);
    }
    if (labelY) {
      const l = createLabel(labelY, { size: s * 1.0, color: '#0b1520', bg: fondo, weight: 700 });
      l.position.set(-TICK - HUECO + 0.004 - l.userData.size[0] / 2, p.y, 0.008);
      for (let k = 0; k < 3 && !libre(l); k++) l.position.x -= l.userData.size[0] + 0.01;
      l.userData.rotuloPunto = true; l.renderOrder = 12;
      g.add(l);
    }
    group.add(g);
    fixed.set(id, g);
    revisarGraduacion();
    if (lastX != null) setMarker(lastX, { color: colorMarca });
    return g;
  }
  function removePoint(id, revisar = true) {
    const g = fixed.get(id);
    if (g) { group.remove(g); liberar(g); fixed.delete(id); }
    if (revisar) { revisarGraduacion(); if (lastX != null) setMarker(lastX, { color: colorMarca }); }
  }

  // ---------------------------------------------------------------- tangente en x con pendiente m, recortada al área del gráfico
  const tangente = new THREE.Mesh(PLANO_LINEA, materialLinea({ color: 0x5cc8ff, opacity: 1, fade: 0.12 }));
  tangente.renderOrder = 9; tangente.visible = false;
  group.add(tangente);
  function setTangent(x, m, { len = 0.22, color = 0x5cc8ff } = {}) {
    if (m == null || !Number.isFinite(m)) { tangente.visible = false; return; }
    const y = f(x);
    if (!Number.isFinite(y)) { tangente.visible = false; return; }
    const a = toLocal(x, y);
    const d = new THREE.Vector2(sx, m * sy).normalize();
    const ax = a.x - (d.x * len) / 2, ay = a.y - (d.y * len) / 2, bx = a.x + (d.x * len) / 2, by = a.y + (d.y * len) / 2;
    const t = recortar(ax, ay, bx, by, 0, 0, width, height);
    if (!t) { tangente.visible = false; return; }
    tangente.material.uniforms.uColor.value.set(color);
    tenderLinea(tangente, ax + (bx - ax) * t[0], ay + (by - ay) * t[0], ax + (bx - ax) * t[1], ay + (by - ay) * t[1], 0.0065, 0.0072);
  }

  function setFunction(fn, newColorAt) {
    f = fn;
    if (newColorAt) opts.colorAt = newColorAt;
    buildCurve(fn);
    if (lastX != null) setMarker(lastX, { color: colorMarca });
  }

  return {
    group, marker, toLocal, setMarker, addPoint, removePoint, setTangent, buildCurve, setFunction,
    setLive(v) { liveOn = v; if (lastX != null) setMarker(lastX, { guides: v, color: colorMarca }); },
    xFromLocal(px) { return x0 + px / sx; },
    width, height, x0, x1, y0, y1, labelSize,
    setLabelText,
  };
}
