// Ejercicio 2.5. Un auto va al este a 90 km/h y otro al sur a 60 km/h, ambos hacia el cruce de dos carreteras.
import { AUTOS as M } from '../../src/math/guia4.js';

// La derivada que pide el problema queda oculta en el panel hasta que se activa «Revelar respuesta»
const OCULTO = '? (revela)';

// Convención local: cruce en el origen, camino este-oeste sobre el eje x (el auto A avanza hacia +x)
// y camino norte-sur sobre el eje z (el auto B viene del norte, z negativo, y avanza hacia +z).
const YR = 0.18;          // altura de la calzada
const HW = 5;             // media calzada: pista de 3,5 m y berma de 1,5 m
const RF = 6;             // radio de las esquinas del cruce
const CARRIL = 1.75;      // eje de cada pista
const A0 = -297, B0 = -257, FIN = 36; // extremos de los caminos dentro de los corredores
const T1 = M.x0 / -M.vx;  // el auto A llega al cruce en t = 0,2/90 h
const T0 = -0.001;        // 3,6 s antes del instante del problema: A a 290 m y B a 210 m
const RRUEDA = 0.32;
const LEJOS = 110;        // más lejos que esto el conductor no se distingue tras los vidrios y no se dibuja

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
function ruido(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(i, j), hash(i + 1, j), u), lerp(hash(i, j + 1), hash(i + 1, j + 1), u), w);
}
// Curva suave por puntos [x, y] con tangentes de Catmull-Rom
function curva(T) {
  const n = T.length;
  const m = T.map((_, i) => { const a = T[Math.max(0, i - 1)], b = T[Math.min(n - 1, i + 1)]; return (b[1] - a[1]) / (b[0] - a[0]); });
  return (x) => {
    if (x <= T[0][0]) return T[0][1];
    if (x >= T[n - 1][0]) return T[n - 1][1];
    let i = 0;
    while (x > T[i + 1][0]) i++;
    const h = T[i + 1][0] - T[i][0], t = (x - T[i][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * T[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * T[i + 1][1] + (t3 - t2) * h * m[i + 1];
  };
}

export default {
  id: 'autos',
  tipo: 'razon',
  etiqueta: 'Ejercicio 2.5 · Razón de cambio',
  titulo: 'Dos autos hacia el cruce',
  resumen: 'Un automóvil viaja hacia el este a 90 km/h y otro hacia el sur a 60 km/h; ambos se dirigen al cruce de dos carreteras. ¿A qué razón se acercan los autos en el instante en que el primero está a 0,2 km y el segundo a 0,15 km del cruce?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const reloj = kit.reloj({ t0: T0, t1: T1, instante: M.instante, velocidad: 1 / 3600 });
    const s = { revelar: false, ultimo: -1 };
    // punto donde se cruzan las trayectorias de los dos autos (el "cruce" del problema)
    const O = { x: -CARRIL, z: CARRIL };
    const Y = new THREE.Vector3(0, 1, 0);
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const Col = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));
    const suelo = (x, z) => kit.sueloH(g.position.x + x, g.position.z + z);
    const rnd = kit.mulberry32(2505);
    const azar = (a, b) => a + (b - a) * rnd();
    // Revisión de capturas: rev=t:<h>,g:<s> fija el reloj del problema en t horas y el gesto del banderillero en s segundos.
    const REV = {};
    try {
      for (const par of (new URLSearchParams(location.search).get('rev') || '').split(',')) {
        const [k, v] = par.split(':');
        if (k && v !== undefined && Number.isFinite(Number(v))) REV[k] = Number(v);
      }
    } catch { /* sin dirección de página */ }

    // ------------------------------------------------------------ utilidades de geometría
    function lienzo(w, h, pintar, srgb = true) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      pintar(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    }
    const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
      new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
    const tubo = (a, b, r, seg = 8, abierto = false) => {
      const d = b.clone().sub(a), len = Math.max(1e-4, d.length());
      const geo = new THREE.CylinderGeometry(r, r, len, seg, 1, abierto);
      geo.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), V(1, 1, 1)));
      return geo;
    };
    // Caja con aristas redondeadas de radio r (k subdivisiones por arista)
    function cajaR(w, h, d, r, k = 2) {
      r = Math.min(r, w / 2, h / 2, d / 2);
      const S = 2 * k + 1, geo = new THREE.BoxGeometry(1, 1, 1, S, S, S);
      const P = geo.attributes.position, N = geo.attributes.normal;
      const mapa = (c, hh) => { const i = Math.round((c + 0.5) * S); return i <= k ? -hh + r * (i / k) : hh - r * ((S - i) / k); };
      const v = V(), dentro = V(), off = V();
      for (let i = 0; i < P.count; i++) {
        v.set(mapa(P.getX(i), w / 2), mapa(P.getY(i), h / 2), mapa(P.getZ(i), d / 2));
        dentro.set(clamp(v.x, -w / 2 + r, w / 2 - r), clamp(v.y, -h / 2 + r, h / 2 - r), clamp(v.z, -d / 2 + r, d / 2 - r));
        off.subVectors(v, dentro);
        if (off.lengthSq() > 1e-12) { off.normalize(); P.setXYZ(i, dentro.x + off.x * r, dentro.y + off.y * r, dentro.z + off.z * r); N.setXYZ(i, off.x, off.y, off.z); } else P.setXYZ(i, v.x, v.y, v.z);
      }
      return geo;
    }
    // Invierte las caras (para superficies que se ven desde adentro)
    function invertir(geo) {
      const gg = geo.index ? geo.toNonIndexed() : geo;
      for (const nombre of ['position', 'normal', 'uv']) {
        const a = gg.attributes[nombre]; if (!a) continue;
        const k = a.itemSize, arr = a.array;
        for (let i = 0; i < a.count; i += 3) for (let c = 0; c < k; c++) { const t = arr[(i + 1) * k + c]; arr[(i + 1) * k + c] = arr[(i + 2) * k + c]; arr[(i + 2) * k + c] = t; }
      }
      const n = gg.attributes.normal.array; for (let i = 0; i < n.length; i++) n[i] = -n[i];
      return gg;
    }
    function colorear(geo, fn) {
      const P = geo.attributes.position, a = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) { const c = fn(P.getX(i), P.getY(i), P.getZ(i)); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return geo;
    }
    function remapUV(geo, u0, v0, du, dv) {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
      return geo;
    }

    // Clases de superficie del material de colores por vértice: rugosidad y metalicidad leídas de una textura de 8 × 1.
    const CLASES = { pintura: [0.26, 0.5], plastico: [0.62, 0], cromo: [0.18, 1], goma: [0.92, 0], tela: [0.96, 0], metal: [0.42, 0.75], mate: [0.88, 0], espejo: [0.06, 0.9] };
    const LCL = Object.keys(CLASES);
    const texRM = (() => {
      const d = new Uint8Array(LCL.length * 4);
      LCL.forEach((k, i) => { d[i * 4 + 1] = Math.round(CLASES[k][0] * 255); d[i * 4 + 2] = Math.round(CLASES[k][1] * 255); d[i * 4 + 3] = 255; });
      const t = new THREE.DataTexture(d, LCL.length, 1);
      t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
      return t;
    })();
    const uClase = (k) => (LCL.indexOf(k) + 0.5) / LCL.length;
    const matVC = new THREE.MeshStandardMaterial({ vertexColors: true, roughnessMap: texRM, metalnessMap: texRM, roughness: 1, metalness: 1 });

    // Deja una geometría lista para unirse: sin índice y con posición, normal, uv y color.
    const ATR = ['position', 'normal', 'uv', 'color'];
    function preparar(geo, { m4 = null, color = 0xffffff, clase = null, uvf = null } = {}) {
      const gg = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(gg.attributes)) if (!ATR.includes(k)) gg.deleteAttribute(k);
      if (!gg.attributes.normal) gg.computeVertexNormals();
      if (m4) gg.applyMatrix4(m4);
      const n = gg.attributes.position.count, P = gg.attributes.position;
      if (clase || uvf || !gg.attributes.uv) {
        const a = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) {
          if (clase) { a[i * 2] = uClase(clase); a[i * 2 + 1] = 0.5; } else if (uvf) { const t = uvf(P.getX(i), P.getY(i), P.getZ(i)); a[i * 2] = t[0]; a[i * 2 + 1] = t[1]; }
        }
        gg.setAttribute('uv', new THREE.BufferAttribute(a, 2));
      }
      if (!gg.attributes.color) {
        const c = Col(color), a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
        gg.setAttribute('color', new THREE.BufferAttribute(a, 3));
      }
      gg.clearGroups();
      return gg;
    }
    // Lotes de geometría estática: al final se une cada lote en una sola malla con su material.
    const lotes = {};
    const meter = (lote, geo, opc = {}) => {
      if (lote === 'vc' && !opc.clase) opc = { ...opc, clase: 'mate' };
      (lotes[lote] ||= []).push(preparar(geo, opc));
    };
    // Triángulos sueltos (posición, normal, color, uv) para superficies construidas a mano
    const nuevoL = () => ({ p: [], n: [], c: [], uv: [] });
    function aGeo(L) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(L.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(L.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(L.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(L.c, 3));
      return geo;
    }
    function trianguloL(L, vs, n, c) { // vs: [[x, y, z, u, v], ...] de a tres
      for (const v of vs) { L.p.push(v[0], v[1], v[2]); L.n.push(n[0], n[1], n[2]); L.c.push(c.r, c.g, c.b); L.uv.push(v[3], v[4]); }
    }
    // Cuadrícula plana o inclinada: punto(i, j) -> [x, y, z]; las caras quedan hacia arriba.
    function grilla(nu, nv, punto, { uv, color }) {
      const P = [], U = [], C = [];
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
        const p = punto(i, j); P.push(p[0], p[1], p[2]);
        const t = uv(p); U.push(t[0], t[1]);
        const c = color(p); C.push(c.r, c.g, c.b);
      }
      const idx = [];
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, b + 1, a, b + 1, a + 1); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      if (geo.attributes.normal.getY(0) < 0) {
        for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
        geo.setIndex(idx); geo.computeVertexNormals();
      }
      return geo;
    }
    // Superficie paramétrica pts[i][j] con normales suaves; clasificar(i, j, centro) reparte cada cuadrilátero
    // en un lote de salida con su color, su clase o sus coordenadas de textura (o lo omite con null).
    function superficie(pts, clasificar, salidas) {
      const ni = pts.length, nj = pts[0].length;
      const pos = new Float32Array(ni * nj * 3);
      for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) pts[i][j].toArray(pos, (i * nj + j) * 3);
      const idx = [];
      for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) { const a = i * nj + j, b = a + nj; idx.push(a, b, b + 1, a, b + 1, a + 1); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const nor = geo.attributes.normal.array, cen = V();
      for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) {
        const q = [i * nj + j, (i + 1) * nj + j, (i + 1) * nj + j + 1, i * nj + j + 1];
        cen.set(0, 0, 0);
        for (const v of q) { cen.x += pos[v * 3] / 4; cen.y += pos[v * 3 + 1] / 4; cen.z += pos[v * 3 + 2] / 4; }
        const c = clasificar(i, j, cen);
        if (!c) continue;
        const L = (salidas[c.lote] ||= nuevoL());
        for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) {
          L.p.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); L.n.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
          const col = c.color || BLANCO; L.c.push(col.r, col.g, col.b);
          if (c.uv) { const t = c.uv(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); L.uv.push(t[0], t[1]); } else L.uv.push(uClase(c.clase || 'pintura'), 0.5);
        }
      }
      geo.dispose();
    }
    const BLANCO = Col(0xffffff);

    // ------------------------------------------------------------ materiales de la escena
    const matAsfalto = kit.mat('asphalt', { repeat: [1, 1], color: 0xd4d4d4, normalScale: 0.8 }); matAsfalto.vertexColors = true;
    const matRipio = kit.mat('gravel', { repeat: [1, 1], color: 0xb4aa9a, normalScale: 0.9 }); matRipio.vertexColors = true;
    const matHormigon = kit.mat('concrete', { repeat: [1, 1], color: 0xe2ded6, normalScale: 0.6 }); matHormigon.vertexColors = true;
    const matGalv = kit.mat('metal', { repeat: [1, 1], color: 0xd3d7da, metalness: 0.5, roughness: 0.55, normalScale: 0.25 });
    const matMadera = kit.mat('wood', { repeat: [1, 1], color: 0xb08f6c }); matMadera.vertexColors = true;
    const matCubierta = kit.mat('ribbed', { repeat: [1, 1], color: 0xc4c8cb, metalness: 0.55, roughness: 0.5, normalScale: 0.7 });

    // Demarcación: franja de línea gastada, leyenda PARE, triángulo de ceda el paso y flecha
    const texPintura = lienzo(512, 512, (x) => {
      x.clearRect(0, 0, 512, 512);
      const r = kit.mulberry32(77);
      x.fillStyle = '#f1f0e8'; x.fillRect(2, 0, 60, 512);
      x.save(); x.beginPath(); x.rect(64, 0, 192, 512); x.clip();
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.translate(160, 256); x.scale(0.95, 6.4); x.font = '900 64px Arial'; x.fillText('PARE', 0, 3);
      x.restore();
      x.lineJoin = 'miter'; x.lineWidth = 15; x.strokeStyle = '#f1f0e8';
      x.beginPath(); x.moveTo(268, 10); x.lineTo(372, 10); x.lineTo(320, 246); x.closePath(); x.stroke();
      x.beginPath(); x.moveTo(309, 506); x.lineTo(331, 506); x.lineTo(331, 340); x.lineTo(366, 340); x.lineTo(320, 262); x.lineTo(274, 340); x.lineTo(309, 340); x.closePath(); x.fill();
      // desgaste: huecos, bordes irregulares y polvo
      x.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 2600; i++) { x.globalAlpha = 0.35 + r() * 0.65; x.beginPath(); x.ellipse(r() * 384, r() * 512, 0.8 + r() * 3.5, 0.8 + r() * 7, r() * 3, 0, 7); x.fill(); }
      x.globalAlpha = 1;
      for (let y = 0; y < 512; y += 5) { x.fillRect(0, y, 2 + r() * 4, 5); x.fillRect(58 + r() * 4, y, 8, 5); }
      x.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${60 + r() * 30},${56 + r() * 26},${48 + r() * 20},${0.12 + r() * 0.3})`; x.fillRect(r() * 384, r() * 512, 1 + r() * 3, 1 + r() * 4); }
    });
    const matPintura = new THREE.MeshStandardMaterial({ map: texPintura, alphaTest: 0.42, roughness: 0.62, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const REG = { linea: [2 / 512, 62 / 512, 0, 1], pare: [66 / 512, 254 / 512, 0.005, 0.995], ceda: [262 / 512, 378 / 512, 0.508, 0.995], flecha: [262 / 512, 378 / 512, 0.005, 0.492] };

    // Desgaste del pavimento: grietas selladas, parches de bacheo, manchas de aceite y huellas de frenado
    const texDesgaste = lienzo(512, 512, (x) => {
      x.clearRect(0, 0, 512, 512);
      const r = kit.mulberry32(91);
      x.save(); x.beginPath(); x.rect(0, 0, 256, 256); x.clip(); x.lineCap = 'round'; x.lineJoin = 'round';
      const grieta = (px, py, a, largo, ancho, nivel) => {
        x.lineWidth = ancho; x.beginPath(); x.moveTo(px, py);
        for (let i = 0; i < largo; i += 5) {
          a += (r() - 0.5) * 0.8; px += Math.cos(a) * 5; py += Math.sin(a) * 5; x.lineTo(px, py);
          if (nivel < 2 && r() < 0.07) { x.stroke(); grieta(px, py, a + (r() < 0.5 ? 1 : -1) * (0.5 + r()), largo * 0.35, ancho * 0.65, nivel + 1); x.lineWidth = ancho; x.beginPath(); x.moveTo(px, py); }
        }
        x.stroke();
      };
      x.strokeStyle = 'rgba(30,29,27,0.35)'; grieta(128, 0, Math.PI / 2, 270, 11, 2);
      x.strokeStyle = 'rgba(12,11,10,0.9)'; grieta(128, 0, Math.PI / 2, 270, 2.6, 0); grieta(110, 40, Math.PI / 2 + 0.3, 150, 1.8, 1); grieta(150, 120, Math.PI / 2 - 0.2, 130, 1.6, 1);
      x.restore();
      x.save(); x.translate(256, 0);
      x.beginPath(); for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, rr = 100 + (r() - 0.5) * 14; const c = Math.cos(a), sn = Math.sin(a); const q = Math.pow(Math.abs(c) ** 6 + Math.abs(sn) ** 6, -1 / 6); x.lineTo(128 + c * rr * q, 128 + sn * rr * q); }
      x.closePath(); x.fillStyle = 'rgba(14,14,15,0.62)'; x.fill(); x.lineWidth = 6; x.strokeStyle = 'rgba(8,8,8,0.75)'; x.stroke();
      for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '90,90,88' : '10,10,10'},${0.15 + r() * 0.25})`; x.fillRect(30 + r() * 196, 30 + r() * 196, 1 + r() * 3, 1 + r() * 3); }
      x.restore();
      x.save(); x.translate(0, 256);
      for (let i = 0; i < 9; i++) {
        const cx = 128 + (r() - 0.5) * 90, cy = 128 + (r() - 0.5) * 120, rr = 30 + r() * 60;
        const gr = x.createRadialGradient(cx, cy, 2, cx, cy, rr); gr.addColorStop(0, `rgba(8,7,6,${0.35 + r() * 0.25})`); gr.addColorStop(1, 'rgba(8,7,6,0)');
        x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
      }
      x.restore();
      x.save(); x.translate(256, 256);
      for (const cx of [30, 226]) {
        const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(10,10,10,0)'); gr.addColorStop(0.18, 'rgba(10,10,10,0.75)'); gr.addColorStop(0.85, 'rgba(10,10,10,0.6)'); gr.addColorStop(1, 'rgba(10,10,10,0)');
        x.fillStyle = gr; x.fillRect(cx - 11, 0, 22, 256);
      }
      x.restore();
    });
    const matDesgaste = new THREE.MeshStandardMaterial({ map: texDesgaste, transparent: true, depthWrite: false, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

    // Señales verticales: atlas de 3 × 3 caras
    const CEL = 512 / 3, MG = 6;
    const SEN = { pare: [0, 0], ceda: [1, 0], v90: [2, 0], v60: [0, 1], cruce: [1, 1], obras: [2, 1], siga: [0, 2], franjas: [1, 2], paradero: [2, 2] };
    const FORMAS = {
      octogono: (L) => Array.from({ length: 8 }, (_, k) => { const a = Math.PI / 8 + (k * Math.PI) / 4, rr = L / 2 / Math.cos(Math.PI / 8); return [rr * Math.cos(a), rr * Math.sin(a)]; }),
      circulo: (L) => Array.from({ length: 28 }, (_, k) => { const a = (k * 2 * Math.PI) / 28; return [(L / 2) * Math.cos(a), (L / 2) * Math.sin(a)]; }),
      triangulo: (L) => [[-L / 2, 0.433 * L], [0, -0.433 * L], [L / 2, 0.433 * L]],
      rombo: (L) => [[0, L / 2], [-L / 2, 0], [0, -L / 2], [L / 2, 0]],
      cuadrado: (L) => [[-L / 2, -L / 2], [L / 2, -L / 2], [L / 2, L / 2], [-L / 2, L / 2]],
    };
    const texSenales = lienzo(512, 512, (x) => {
      x.fillStyle = '#80868a'; x.fillRect(0, 0, 512, 512);
      const r = kit.mulberry32(13), S = CEL - 2 * MG;
      const centro = (c) => [SEN[c][0] * CEL + CEL / 2, SEN[c][1] * CEL + CEL / 2];
      const poli = (c, pts, k = 1, dy = 0) => { const [cx, cy] = centro(c); x.beginPath(); pts.forEach(([a, b], i) => x[i ? 'lineTo' : 'moveTo'](cx + a * k * S, cy - (b * k + dy) * S)); x.closePath(); };
      const texto = (c, t, tam, color, dy = 0, peso = 800) => { const [cx, cy] = centro(c); x.fillStyle = color; x.font = `${peso} ${tam * S}px Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, cx, cy + dy * S); };
      // PARE
      poli('pare', FORMAS.octogono(1)); x.fillStyle = '#f3f3ef'; x.fill();
      poli('pare', FORMAS.octogono(1), 0.9); x.fillStyle = '#bd1630'; x.fill();
      texto('pare', 'PARE', 0.29, '#f6f6f2', 0.02);
      // CEDA EL PASO (triángulo con la punta hacia abajo)
      poli('ceda', FORMAS.triangulo(1)); x.fillStyle = '#c3172e'; x.fill();
      poli('ceda', FORMAS.triangulo(1).map(([a, b]) => [a * 0.66, (b - 0.144) * 0.66 + 0.144])); x.fillStyle = '#f5f5f1'; x.fill();
      texto('ceda', 'CEDA EL', 0.085, '#1a1a1a', -0.16); texto('ceda', 'PASO', 0.085, '#1a1a1a', -0.07);
      // velocidad máxima
      for (const [c, n] of [['v90', '90'], ['v60', '60']]) {
        poli(c, FORMAS.circulo(1)); x.fillStyle = '#f4f4f0'; x.fill();
        x.lineWidth = 0.085 * S; x.strokeStyle = '#c3172e'; poli(c, FORMAS.circulo(1), 0.865); x.stroke();
        texto(c, n, 0.42, '#151515', 0.03);
      }
      // cruce de caminos y trabajos en la vía
      poli('cruce', FORMAS.rombo(1)); x.fillStyle = '#151515'; x.fill();
      poli('cruce', FORMAS.rombo(1), 0.9); x.fillStyle = '#f2c200'; x.fill();
      { const [cx, cy] = centro('cruce'); x.fillStyle = '#151515'; x.fillRect(cx - 0.045 * S, cy - 0.28 * S, 0.09 * S, 0.56 * S); x.fillRect(cx - 0.28 * S, cy - 0.045 * S, 0.56 * S, 0.09 * S); }
      poli('obras', FORMAS.rombo(1)); x.fillStyle = '#151515'; x.fill();
      poli('obras', FORMAS.rombo(1), 0.9); x.fillStyle = '#f08a1c'; x.fill();
      {
        const [cx, cy] = centro('obras'); x.fillStyle = '#151515'; x.strokeStyle = '#151515'; x.lineCap = 'round';
        x.beginPath(); x.arc(cx - 0.05 * S, cy - 0.2 * S, 0.045 * S, 0, 7); x.fill();
        x.lineWidth = 0.055 * S; x.beginPath(); x.moveTo(cx - 0.07 * S, cy - 0.13 * S); x.lineTo(cx - 0.1 * S, cy + 0.04 * S); x.lineTo(cx - 0.18 * S, cy + 0.2 * S); x.moveTo(cx - 0.1 * S, cy + 0.04 * S); x.lineTo(cx - 0.0 * S, cy + 0.2 * S); x.stroke();
        x.lineWidth = 0.04 * S; x.beginPath(); x.moveTo(cx - 0.08 * S, cy - 0.08 * S); x.lineTo(cx + 0.12 * S, cy + 0.02 * S); x.moveTo(cx - 0.02 * S, cy - 0.12 * S); x.lineTo(cx + 0.16 * S, cy + 0.13 * S); x.stroke();
        x.beginPath(); x.moveTo(cx + 0.08 * S, cy + 0.22 * S); x.quadraticCurveTo(cx + 0.18 * S, cy + 0.08 * S, cx + 0.28 * S, cy + 0.22 * S); x.closePath(); x.fill();
      }
      // SIGA (reverso de la paleta)
      poli('siga', FORMAS.octogono(1)); x.fillStyle = '#f3f3ef'; x.fill();
      poli('siga', FORMAS.octogono(1), 0.9); x.fillStyle = '#17853c'; x.fill();
      texto('siga', 'SIGA', 0.29, '#f6f6f2', 0.02);
      // franjas de barrera
      { const [cx, cy] = centro('franjas'); x.save(); x.beginPath(); x.rect(cx - CEL / 2, cy - CEL / 2, CEL, CEL); x.clip(); x.fillStyle = '#f4f4f0'; x.fillRect(cx - CEL / 2, cy - CEL / 2, CEL, CEL); x.fillStyle = '#cf2a1e'; for (let i = -12; i < 12; i++) { x.beginPath(); x.moveTo(cx + i * 22, cy + CEL / 2); x.lineTo(cx + i * 22 + 11, cy + CEL / 2); x.lineTo(cx + i * 22 + 11 + CEL, cy - CEL / 2); x.lineTo(cx + i * 22 + CEL, cy - CEL / 2); x.closePath(); x.fill(); } x.restore(); }
      // paradero de buses
      poli('paradero', FORMAS.cuadrado(1)); x.fillStyle = '#f2f2ee'; x.fill();
      poli('paradero', FORMAS.cuadrado(1), 0.9); x.fillStyle = '#1f4f9a'; x.fill();
      {
        const [cx, cy] = centro('paradero'); x.fillStyle = '#f2f2ee';
        x.beginPath(); x.roundRect(cx - 0.26 * S, cy - 0.24 * S, 0.52 * S, 0.4 * S, 0.06 * S); x.fill();
        x.fillStyle = '#1f4f9a'; x.fillRect(cx - 0.21 * S, cy - 0.18 * S, 0.42 * S, 0.14 * S);
        x.fillStyle = '#f2f2ee'; for (const dx of [-0.15, 0.15]) { x.beginPath(); x.arc(cx + dx * S, cy + 0.18 * S, 0.06 * S, 0, 7); x.fill(); }
      }
      // polvo y rayones sobre todas las caras
      for (const c of Object.keys(SEN)) {
        const [cx, cy] = centro(c);
        const gr = x.createLinearGradient(0, cy - CEL / 2, 0, cy + CEL / 2); gr.addColorStop(0, 'rgba(70,62,50,0)'); gr.addColorStop(1, 'rgba(70,62,50,0.2)');
        x.fillStyle = gr; x.fillRect(cx - CEL / 2, cy - CEL / 2, CEL, CEL);
        for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '40,36,30' : '255,255,255'},${0.06 + r() * 0.12})`; x.fillRect(cx + (r() - 0.5) * S, cy + (r() - 0.5) * S, 1 + r() * 2, 1 + r() * 2); }
      }
    });
    const matSenales = new THREE.MeshStandardMaterial({ map: texSenales, roughness: 0.42, metalness: 0.05 });
    function celdaUV(geo, cara, L) {
      const [ci, cj] = SEN[cara], uv = geo.attributes.uv, P = geo.attributes.position;
      const k = (CEL - 2 * MG) / 512, u0 = (ci * CEL + MG) / 512, v0 = 1 - ((cj + 1) * CEL - MG) / 512;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (P.getX(i) / L + 0.5) * k, v0 + (P.getY(i) / L + 0.5) * k);
      return geo;
    }
    const uvFranjas = (geo) => { const [ci, cj] = SEN.franjas; return remapUV(geo, (ci * CEL + 4) / 512, 1 - ((cj + 1) * CEL) / 512 + (0.42 * CEL) / 512, (CEL - 8) / 512, (0.16 * CEL) / 512); };

    // Vegetación: champa de pasto y ramillete de hojas
    const texVeg = lienzo(512, 256, (x) => {
      x.clearRect(0, 0, 512, 256);
      const r = kit.mulberry32(5);
      for (let i = 0; i < 150; i++) {
        const bx = 128 + (r() - 0.5) * 130, h = 90 + r() * 160, lean = (r() - 0.5) * 140, w = 1.6 + r() * 3.2, seco = r() < 0.32;
        const c = seco ? [170 + r() * 40, 150 + r() * 30, 82 + r() * 25] : [62 + r() * 45, 104 + r() * 55, 36 + r() * 26];
        x.fillStyle = `rgb(${c.map(Math.round).join(',')})`;
        x.beginPath(); x.moveTo(bx - w, 256); x.quadraticCurveTo(bx + lean * 0.25, 256 - h * 0.6, bx + lean, 256 - h); x.quadraticCurveTo(bx + lean * 0.25 + w * 0.6, 256 - h * 0.6, bx + w, 256); x.closePath(); x.fill();
      }
      x.strokeStyle = 'rgba(70,52,36,0.9)'; x.lineWidth = 3;
      for (let i = 0; i < 9; i++) { const a = r() * 6.28; x.beginPath(); x.moveTo(384, 128); x.quadraticCurveTo(384 + Math.cos(a) * 50, 128 + Math.sin(a) * 30, 384 + Math.cos(a) * 105, 128 + Math.sin(a) * 100); x.stroke(); }
      for (let i = 0; i < 340; i++) {
        const a = r() * 6.28, d = Math.sqrt(r()) * 112, px = 384 + Math.cos(a) * d, py = 128 + Math.sin(a) * d * 0.95;
        const l = 0.75 + r() * 0.5 - (py - 128) / 500;
        x.fillStyle = `rgb(${Math.round((48 + r() * 30) * l)},${Math.round((86 + r() * 50) * l)},${Math.round((30 + r() * 22) * l)})`;
        x.beginPath(); x.ellipse(px, py, 7 + r() * 6, 3 + r() * 2.5, r() * 6.28, 0, 7); x.fill();
      }
    });
    const matVeg = new THREE.MeshStandardMaterial({ map: texVeg, alphaTest: 0.45, vertexColors: true, roughness: 0.9 });

    // ------------------------------------------------------------ calzadas
    const POLVO = Col(0xc9b79a);
    const CORTE = [-5, -4.25, -3.45, -2.65, -2.2, -1.75, -1.3, -0.85, 0, 0.85, 1.3, 1.75, 2.2, 2.65, 3.45, 4.25, 5];
    const tonoAsf = (x, z, c) => {
      const a = Math.abs(c);
      let v = 0.92 + 0.2 * (ruido(x / 19 + 3.1, z / 19) - 0.5) + 0.08 * (ruido(x / 4.3, z / 4.3) - 0.5);
      v -= 0.16 * Math.exp(-((a - 1.75) ** 2) / 0.05);                                      // goteo de aceite al centro de cada pista
      v += 0.07 * (Math.exp(-((a - 0.95) ** 2) / 0.04) + Math.exp(-((a - 2.55) ** 2) / 0.04)); // huellas pulidas por las ruedas
      return Col(0xffffff).multiplyScalar(v).lerp(POLVO, 0.3 * sstep(3.5, 5, a));            // berma polvorienta
    };
    const uvAsf = (p) => [p[0] / 3.2, p[2] / 3.2];
    {
      const n = Math.round((FIN - A0) / 2.5);
      meter('asfalto', grilla(n, CORTE.length - 1, (i, j) => [A0 + ((FIN - A0) * i) / n, YR, CORTE[j]], { uv: uvAsf, color: (p) => tonoAsf(p[0], p[2], p[2]) }));
      for (const [z0, z1] of [[B0, -HW], [HW, FIN]]) {
        const m = Math.max(1, Math.round((z1 - z0) / 2.5));
        meter('asfalto', grilla(m, CORTE.length - 1, (i, j) => [CORTE[j], YR, z0 + ((z1 - z0) * i) / m], { uv: uvAsf, color: (p) => tonoAsf(p[0], p[2], p[0]) }));
      }
      // esquinas redondeadas del cruce
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const sh = new THREE.Shape(), p = (u, v) => [sx * u, -sz * v];
        sh.moveTo(...p(HW, HW)); sh.lineTo(...p(HW + RF, HW));
        for (let k = 1; k <= 16; k++) { const a = -Math.PI / 2 - (k * Math.PI) / 2 / 16; sh.lineTo(...p(HW + RF + RF * Math.cos(a), HW + RF + RF * Math.sin(a))); }
        sh.lineTo(...p(HW, HW));
        const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2); geo.translate(0, YR, 0);
        meter('asfalto', geo, { uvf: (x, y, z) => [x / 3.2, z / 3.2], color: Col(0xffffff).lerp(POLVO, 0.18) });
      }
    }
    // taludes de ripio a los costados y en los extremos
    const uvR = (p) => [p[0] / 1.3, p[2] / 1.3];
    const tonoR = (p) => Col(0xffffff).multiplyScalar(0.72 + 0.34 * ruido(p[0] / 3, p[2] / 3)).lerp(Col(0x8f8068), 0.25 * ruido(p[0] / 9 + 7, p[2] / 9));
    function talud(a0, a1, borde, sg, eje) {
      const n = Math.max(1, Math.round(Math.abs(a1 - a0) / 6));
      const pt = (i, j) => { const a = a0 + ((a1 - a0) * i) / n, c = borde + (sg * 1.8 * j) / 2, y = YR - (0.6 * j) / 2; return eje === 'x' ? [a, y, c] : [c, y, a]; };
      meter('ripio', grilla(n, 2, pt, { uv: uvR, color: tonoR }));
    }
    talud(A0, -HW - RF, -HW, -1, 'x'); talud(HW + RF, FIN, -HW, -1, 'x');
    talud(A0, -HW - RF, HW, 1, 'x'); talud(HW + RF, FIN, HW, 1, 'x');
    talud(B0, -HW - RF, -HW, -1, 'z'); talud(B0, -HW - RF, HW, 1, 'z');
    talud(HW + RF, FIN, -HW, -1, 'z'); talud(HW + RF, FIN, HW, 1, 'z');
    talud(-HW, HW, A0, -1, 'z'); talud(-HW, HW, FIN, 1, 'z');
    talud(-HW, HW, B0, -1, 'x'); talud(-HW, HW, FIN, 1, 'x');

    // soleras de hormigón en las esquinas y a lo largo de los accesos, con su relleno de tierra detrás
    const PERFIL = [[0, -0.12], [0, 0.1], [0.018, 0.138], [0.05, 0.15], [0.152, 0.15], [0.16, 0.142], [0.16, -0.24]];
    function solera(pts) {
      const n = pts.length;
      let largo = 0;
      const cols = [];
      for (let i = 0; i < n; i++) {
        if (i) largo += Math.hypot(pts[i].p[0] - pts[i - 1].p[0], pts[i].p[1] - pts[i - 1].p[1]);
        cols.push(largo);
      }
      const geo = grillaSolera(pts, cols);
      meter('hormigon', geo);
    }
    function grillaSolera(pts, cols) {
      const P = [], U = [], C = [], nj = PERFIL.length;
      pts.forEach(({ p, b }, i) => PERFIL.forEach(([nn, y], j) => {
        P.push(p[0] + b[0] * nn, YR + y, p[1] + b[1] * nn);
        U.push(cols[i] / 1.2, j * 0.06);
        const sucio = j <= 1 ? 0.62 : j === 2 ? 0.8 : 0.95;
        const c = Col(0xffffff).multiplyScalar(sucio * (0.9 + 0.15 * ruido(cols[i] / 2, j))); C.push(c.r, c.g, c.b);
      }));
      const idx = [];
      for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < nj - 1; j++) { const a = i * nj + j, b = a + nj; idx.push(a, b, b + 1, a, b + 1, a + 1); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      if (geo.attributes.normal.getY(3) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } geo.setIndex(idx); geo.computeVertexNormals(); }
      return geo;
    }
    const LSOL = 16;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * (HW + RF), cz = sz * (HW + RF), pts = [];
      for (let k = 0; k <= 4; k++) pts.push({ p: [sx * (HW + RF + LSOL * (1 - k / 4)), sz * HW], b: [0, sz] });
      const f0 = Math.atan2(-sz, 0), f1 = Math.atan2(0, -sx);
      let d = f1 - f0; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      const arco = [];
      for (let k = 1; k < 16; k++) { const f = f0 + (d * k) / 16, px = cx + RF * Math.cos(f), pz = cz + RF * Math.sin(f); arco.push([px, pz, -Math.cos(f), -Math.sin(f)]); }
      for (const [px, pz, bx, bz] of arco) pts.push({ p: [px, pz], b: [bx, bz] });
      for (let k = 0; k <= 4; k++) pts.push({ p: [sx * HW, sz * (HW + RF + (LSOL * k) / 4)], b: [sx, 0] });
      solera(pts);
      // relleno de tierra detrás de la solera curva, hasta el terreno
      const tierra = grilla(16, 2, (i, j) => {
        const f = f0 + (d * i) / 16, rr = RF - 0.16 - (1.3 * j) / 2;
        return [cx + rr * Math.cos(f), j === 0 ? YR + 0.148 : j === 1 ? YR - 0.02 : -0.05, cz + rr * Math.sin(f)];
      }, { uv: uvR, color: (p) => Col(0x8c7a60).multiplyScalar(0.9 + 0.2 * ruido(p[0], p[2])) });
      meter('ripio', tierra);
    }

    // ------------------------------------------------------------ demarcación vial
    const pinturaL = nuevoL();
    function marca(x0, z0, x1, z1, ancho, reg = 'linea', tono = 1) {
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), fx = dx / L, fz = dz / L, rx = -fz, rz = fx;
      const [u0, u1, v0, v1] = REG[reg];
      const piezas = reg === 'linea' ? Math.ceil(L / 4 - 1e-6) : 1;
      const c = Col(0xffffff).multiplyScalar(tono), y = YR + 0.002, w = ancho / 2;
      for (let k = 0; k < piezas; k++) {
        const a = (k * L) / piezas, b = ((k + 1) * L) / piezas;
        let va = v0, vb = v1, ua = u0, ub = u1;
        if (reg === 'linea') { va = rnd() * 0.5; vb = va + (b - a) / 8; if (rnd() < 0.5) { ua = u1; ub = u0; } }
        const A = [x0 + fx * a - rx * w, y, z0 + fz * a - rz * w, ua, va], B = [x0 + fx * a + rx * w, y, z0 + fz * a + rz * w, ub, va];
        const C = [x0 + fx * b + rx * w, y, z0 + fz * b + rz * w, ub, vb], D = [x0 + fx * b - rx * w, y, z0 + fz * b - rz * w, ua, vb];
        trianguloL(pinturaL, [A, B, C, A, C, D], [0, 1, 0], c);
      }
    }
    // eje segmentado (4 m pintados, 8 m sin pintar) y eje continuo cerca del cruce
    for (let x = A0 + 3; x < -42; x += 12) marca(x, 0, x + 4, 0, 0.12, 'linea', 0.92);
    marca(-40, 0, -HW - RF, 0, 0.12); marca(HW + RF, 0, FIN - 1, 0, 0.12);
    for (let z = B0 + 3; z < -32; z += 12) marca(0, z, 0, z + 4, 0.12, 'linea', 0.92);
    marca(0, -30, 0, -HW - 2.4, 0.12); marca(0, HW + 2.4, 0, FIN - 1, 0.12);
    // bordes de calzada
    for (const sz of [-1, 1]) { marca(A0 + 0.5, sz * 3.45, -HW - RF, sz * 3.45, 0.12, 'linea', 0.85); marca(HW + RF, sz * 3.45, FIN - 0.5, sz * 3.45, 0.12, 'linea', 0.85); }
    for (const sx of [-1, 1]) { marca(sx * 3.45, B0 + 0.5, sx * 3.45, -HW - RF, 0.12, 'linea', 0.85); marca(sx * 3.45, HW + RF, sx * 3.45, FIN - 0.5, 0.12, 'linea', 0.85); }
    // línea de detención del acceso sur (PARE) y línea segmentada de ceda el paso del acceso norte
    marca(0.08, HW + 2.15, 3.42, HW + 2.15, 0.45);
    for (let x = -3.4; x < -0.2; x += 0.9) marca(x, -HW - 2.1, x + 0.55, -HW - 2.1, 0.4);
    // leyendas y flechas (se leen desde el vehículo que se acerca)
    marca(1.75, HW + 10.4, 1.75, HW + 6.0, 2.4, 'pare');
    marca(-1.75, -HW - 7.4, -1.75, -HW - 4.3, 1.2, 'ceda');
    marca(-1.75, -HW - 32, -1.75, -HW - 27, 0.9, 'flecha'); marca(-1.75, -HW - 72, -1.75, -HW - 67, 0.9, 'flecha');
    marca(-HW - 34, 1.75, -HW - 29, 1.75, 0.9, 'flecha'); marca(-HW - 74, 1.75, -HW - 69, 1.75, 0.9, 'flecha');
    lotes.pintura = [aGeo(pinturaL)];

    // desgaste del pavimento
    const desgasteL = nuevoL();
    const DQ = { grieta: [0, 0], parche: [1, 0], aceite: [0, 1], frenada: [1, 1] };
    function decal(tipo, x, z, ancho, largo, ang) {
      const fx = Math.cos(ang), fz = Math.sin(ang), rx = -fz, rz = fx;
      const [qi, qj] = DQ[tipo], e = 2 / 512, u0 = qi / 2 + e, u1 = (qi + 1) / 2 - e, v0 = 1 - (qj + 1) / 2 + e, v1 = 1 - qj / 2 - e;
      const y = YR + 0.003, l = largo / 2, w = ancho / 2;
      const A = [x - fx * l - rx * w, y, z - fz * l - rz * w, u0, v0], B = [x - fx * l + rx * w, y, z - fz * l + rz * w, u1, v0];
      const C = [x + fx * l + rx * w, y, z + fz * l + rz * w, u1, v1], D = [x + fx * l - rx * w, y, z + fz * l - rz * w, u0, v1];
      trianguloL(desgasteL, [A, B, C, A, C, D], [0, 1, 0], BLANCO);
    }
    for (let k = 0; k < 7; k++) decal('aceite', 1.75 + azar(-0.25, 0.25), HW + 2.9 + k * 1.2 + azar(0, 0.8), azar(0.5, 1.1), azar(0.6, 1.4), azar(0, 6.28));
    for (let k = 0; k < 6; k++) decal('aceite', -1.75 + azar(-0.25, 0.25), -HW - 2.9 - k * 1.3 - azar(0, 0.8), azar(0.5, 1.1), azar(0.6, 1.4), azar(0, 6.28));
    for (let k = 0; k < 22; k++) decal('aceite', azar(A0 + 10, -14), (rnd() < 0.5 ? -1 : 1) * 1.75 + azar(-0.2, 0.2), azar(0.3, 0.8), azar(0.6, 1.8), azar(-0.3, 0.3));
    for (let k = 0; k < 16; k++) decal('aceite', (rnd() < 0.5 ? -1 : 1) * 1.75 + azar(-0.2, 0.2), azar(B0 + 10, -14), azar(0.3, 0.8), azar(0.6, 1.8), Math.PI / 2 + azar(-0.3, 0.3));
    for (let k = 0; k < 8; k++) decal('parche', azar(A0 + 20, -18), azar(-3, 3), azar(1.2, 2.6), azar(1.6, 3.8), azar(-0.06, 0.06));
    for (let k = 0; k < 6; k++) decal('parche', azar(-3, 3), azar(B0 + 20, -18), azar(1.2, 2.6), azar(1.6, 3.8), Math.PI / 2 + azar(-0.06, 0.06));
    decal('parche', 2.2, -2.4, 2.4, 3.1, 0.04);
    for (let k = 0; k < 16; k++) decal('grieta', azar(A0 + 10, -14), (rnd() < 0.5 ? 0 : (rnd() < 0.5 ? -1 : 1) * 3.4) + azar(-0.15, 0.15), 0.6, azar(4, 9), azar(-0.04, 0.04));
    for (let k = 0; k < 12; k++) decal('grieta', (rnd() < 0.5 ? 0 : (rnd() < 0.5 ? -1 : 1) * 3.4) + azar(-0.15, 0.15), azar(B0 + 10, -14), 0.6, azar(4, 9), Math.PI / 2 + azar(-0.04, 0.04));
    for (let k = 0; k < 5; k++) decal('grieta', azar(-4, 4), azar(-4, 4), 0.7, azar(2, 4), azar(0, 3.14));
    decal('frenada', -1.75, -HW - 12, 2.0, 8, Math.PI / 2 + 0.02); decal('frenada', -1.7, -HW - 26, 2.0, 6, Math.PI / 2 - 0.03);
    decal('frenada', -22, 1.8, 2.0, 9, 0.015); decal('frenada', 1.75, HW + 13, 2.0, 6, -Math.PI / 2 + 0.03);
    lotes.desgaste = [aGeo(desgasteL)];

    // tachas reflectantes junto al eje cerca del cruce
    for (const d of [14, 26, 38, 50, 62, 74, 86, 98]) {
      for (const [x, z, ry] of [[-HW - d - 2, 0, 0], [0, -HW - d - 2, Math.PI / 2]]) {
        meter('vc', new THREE.BoxGeometry(0.1, 0.02, 0.1), { m4: M4(x, YR + 0.008, z, 0, ry, 0), color: 0xe8e6de, clase: 'plastico' });
        meter('vc', new THREE.BoxGeometry(0.012, 0.014, 0.07), { m4: M4(x + (ry ? 0 : -0.052), YR + 0.012, z + (ry ? -0.052 : 0), 0, ry, 0), color: 0xfff4d6, clase: 'espejo' });
      }
    }

    // ------------------------------------------------------------ señales verticales
    function senal({ cara, forma, lado, x, z, ry, alto = 2.1, base = null }) {
      const y0 = base ?? Math.max(suelo(x, z), YR - 0.25);
      const m = M4(x, y0, z, 0, ry, 0);
      const pts = FORMAS[forma](lado).map(([a, b]) => new THREE.Vector2(a, b));
      const cara3 = celdaUV(new THREE.ShapeGeometry(new THREE.Shape(pts)), cara, lado);
      meter('senales', cara3, { m4: m.clone().multiply(M4(0, alto, 0.004)) });
      meter('galv', new THREE.ShapeGeometry(new THREE.Shape(pts)), { m4: m.clone().multiply(M4(0, alto, -0.004, 0, Math.PI, 0)) });
      meter('galv', tubo(V(0, -0.3, -0.045), V(0, alto + lado * 0.42, -0.045), 0.03, 10), { m4: m });
      meter('galv', new THREE.CylinderGeometry(0.034, 0.034, 0.012, 10), { m4: m.clone().multiply(M4(0, alto + lado * 0.42, -0.045)) });
      for (const dy of [-lado * 0.25, lado * 0.25]) meter('galv', new THREE.BoxGeometry(0.1, 0.04, 0.035), { m4: m.clone().multiply(M4(0, alto + dy, -0.022)) });
      meter('hormigon', new THREE.CylinderGeometry(0.09, 0.11, 0.14, 10), { m4: m.clone().multiply(M4(0, 0.03, -0.045)), color: 0xc9c4ba });
    }
    senal({ cara: 'ceda', forma: 'triangulo', lado: 0.9, x: -6.4, z: -HW - 2.6, ry: Math.PI, alto: 2.0 }); // acceso norte: el auto B cede el paso
    senal({ cara: 'pare', forma: 'octogono', lado: 0.75, x: 6.3, z: HW + 2.9, ry: 0 });                   // acceso sur
    senal({ cara: 'v60', forma: 'circulo', lado: 0.6, x: -6.4, z: -70, ry: Math.PI });
    senal({ cara: 'cruce', forma: 'rombo', lado: 0.75, x: -6.4, z: -125, ry: Math.PI });
    senal({ cara: 'v90', forma: 'circulo', lado: 0.6, x: -70, z: 6.4, ry: -Math.PI / 2 });
    senal({ cara: 'cruce', forma: 'rombo', lado: 0.75, x: -150, z: 6.4, ry: -Math.PI / 2 });
    senal({ cara: 'obras', forma: 'rombo', lado: 0.9, x: 15.5, z: -6.5, ry: -Math.PI / 2 });
    senal({ cara: 'obras', forma: 'rombo', lado: 0.9, x: -6.5, z: 15.5, ry: Math.PI });

    // ------------------------------------------------------------ postes de alumbrado
    const POSTES_LUZ = [[-8.6, -8.6, 1, 1], [8.6, -8.6, -1, 1], [-8.6, 8.6, 1, -1], [-45, -7.4, 0, 1], [-95, -7.4, 0, 1], [7.4, -45, -1, 0], [7.4, -95, -1, 0], [26, -7.4, 0, 1]];
    {
      const brazo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(V(0, 8.55, 0), V(0, 9.35, 0.35), V(0, 9.38, 2.05)), 14, 0.045, 7);
      const cabeza = new THREE.SphereGeometry(1, 16, 8); cabeza.scale(0.17, 0.085, 0.38);
      const lente = new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); lente.scale(0.13, 0.035, 0.29);
      for (const [x, z, dx, dz] of POSTES_LUZ) {
        const y0 = suelo(x, z), m = M4(x, y0, z, 0, Math.atan2(dx, dz), 0);
        meter('hormigon', new THREE.CylinderGeometry(0.2, 0.26, 0.5, 14), { m4: m.clone().multiply(M4(0, 0.15, 0)), color: 0xcfcac0 });
        meter('vc', new THREE.BoxGeometry(0.3, 0.02, 0.3), { m4: m.clone().multiply(M4(0, 0.41, 0)), color: 0x5d6064, clase: 'metal' });
        meter('galv', new THREE.CylinderGeometry(0.065, 0.11, 8.2, 12, 1, true), { m4: m.clone().multiply(M4(0, 4.5, 0)) });
        meter('galv', new THREE.SphereGeometry(0.068, 10, 6), { m4: m.clone().multiply(M4(0, 8.6, 0)) });
        meter('vc', new THREE.BoxGeometry(0.09, 0.22, 0.012), { m4: m.clone().multiply(M4(0, 1.1, 0.105)), color: 0x9ea3a7, clase: 'metal' });
        meter('galv', brazo, { m4: m });
        meter('vc', cabeza, { m4: m.clone().multiply(M4(0, 9.34, 2.28, 0.06, 0, 0)), color: 0x8e9398, clase: 'metal' });
        meter('vc', lente, { m4: m.clone().multiply(M4(0, 9.3, 2.3, 0.06, 0, 0)), color: 0xe9ecee, clase: 'espejo' });
      }
    }

    // ------------------------------------------------------------ tendido eléctrico de madera junto a los caminos
    function tendido(puntos) {
      const aisl = [];
      puntos.forEach(([x, z], i) => {
        const y = suelo(x, z), sig = puntos[Math.min(i + 1, puntos.length - 1)], ant = puntos[Math.max(i - 1, 0)];
        const dir = Math.atan2(sig[1] - ant[1], sig[0] - ant[0]), px = -Math.sin(dir), pz = Math.cos(dir);
        meter('madera', new THREE.CylinderGeometry(0.1, 0.15, 9.6, 9), { m4: M4(x, y + 4.6, z, 0, i * 1.7, 0), color: Col(0x8d7c68).multiplyScalar(0.85 + 0.2 * rnd()) });
        meter('madera', new THREE.BoxGeometry(2.0, 0.1, 0.1), { m4: M4(x, y + 8.85, z, 0, Math.atan2(-pz, px), 0), color: 0x9c8a74 });
        const fila = [];
        for (const k of [-0.85, 0, 0.85]) {
          const ax = x + px * k, az = z + pz * k;
          meter('vc', new THREE.CylinderGeometry(0.035, 0.05, 0.16, 8), { m4: M4(ax, y + 8.98, az), color: 0xd9dcdc, clase: 'espejo' });
          fila.push(V(ax, y + 9.06, az));
        }
        aisl.push(fila);
      });
      for (let i = 0; i < aisl.length - 1; i++) for (let k = 0; k < 3; k++) {
        const a = aisl[i][k], b = aisl[i + 1][k], pts = [];
        for (let t = 0; t <= 8; t++) { const p = a.clone().lerp(b, t / 8); p.y -= 0.5 * 4 * (t / 8) * (1 - t / 8); pts.push(p); }
        for (let t = 0; t < 8; t++) meter('vc', tubo(pts[t], pts[t + 1], 0.009, 3, true), { color: 0x3a3d40, clase: 'metal' });
      }
    }
    {
      const pts = [];
      for (let x = -275; x <= -30; x += 45) pts.push([x, -11.6]);
      pts.push([-14, -14]);
      for (let z = -30; z >= -250; z -= 45) pts.push([-11.6, z]);
      tendido(pts);
    }

    // ------------------------------------------------------------ hitos de vialidad, cercos y paradero
    function hito(x, z, ry) {
      const y = Math.max(suelo(x, z), YR - 0.25);
      meter('vc', new THREE.BoxGeometry(0.1, 1.0, 0.1), { m4: M4(x, y + 0.5, z, 0, ry, 0), color: 0xefefe9, clase: 'plastico' });
      meter('vc', new THREE.BoxGeometry(0.104, 0.18, 0.104), { m4: M4(x, y + 0.84, z, 0, ry, 0), color: 0x161616, clase: 'plastico' });
      meter('vc', new THREE.BoxGeometry(0.06, 0.1, 0.108), { m4: M4(x, y + 0.84, z, 0, ry, 0), color: 0xf2b21c, clase: 'espejo' });
      meter('vc', new THREE.BoxGeometry(0.12, 0.05, 0.12), { m4: M4(x, y + 0.02, z, 0, ry, 0), color: 0x6a6052, clase: 'mate' });
    }
    for (let x = A0 + 10; x < FIN - 4; x += 25) if (x < -HW - RF - LSOL - 2 || x > HW + RF + LSOL + 2) { hito(x, -5.6, 0); hito(x, 5.6, 0); }
    for (let z = B0 + 10; z < FIN - 4; z += 25) if (z < -HW - RF - LSOL - 2 || z > HW + RF + LSOL + 2) { hito(-5.6, z, Math.PI / 2); hito(5.6, z, Math.PI / 2); }

    function cerco(a, b) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 4));
      for (let k = 0; k <= n; k++) {
        const x = lerp(a[0], b[0], k / n), z = lerp(a[1], b[1], k / n);
        meter('madera', new THREE.CylinderGeometry(0.055, 0.065, 1.45, 6), { m4: M4(x, suelo(x, z) + 0.6, z, (rnd() - 0.5) * 0.06, rnd() * 6, (rnd() - 0.5) * 0.06), color: Col(0xa89880).multiplyScalar(0.75 + 0.3 * rnd()) });
      }
      for (const h of [0.42, 0.78, 1.12]) meter('vc', tubo(V(a[0], suelo(...a) + h, a[1]), V(b[0], suelo(...b) + h, b[1]), 0.0045, 3, true), { color: 0x74777a, clase: 'metal' });
    }
    cerco([A0 + 5, -9.5], [-30, -9.5]); cerco([A0 + 5, 9.5], [-18, 9.5]); cerco([18, -9.5], [FIN - 2, -9.5]); cerco([18, 9.5], [FIN - 2, 9.5]);
    cerco([-9.5, B0 + 5], [-9.5, -18]); cerco([9.5, B0 + 5], [9.5, -18]); cerco([-9.5, 18], [-9.5, FIN - 2]); cerco([9.5, 18], [9.5, FIN - 2]);

    // paradero de buses rural en la esquina noroeste, de cara al camino
    {
      const cx = -24.2, cz = -7.95, y0 = suelo(cx, cz);
      meter('hormigon', new THREE.BoxGeometry(3.7, 0.14, 2.1), { m4: M4(cx, y0 + 0.03, cz), uvf: (x, y, z) => [x / 1.4, z / 1.4], color: 0xd8d3ca });
      for (const dx of [-1.6, 1.6]) for (const dz of [-0.78, 0.72]) meter('galv', new THREE.BoxGeometry(0.07, 2.55, 0.07), { m4: M4(cx + dx, y0 + 1.33, cz + dz) });
      meter('cubierta', new THREE.BoxGeometry(3.8, 0.035, 2.2), { m4: M4(cx, y0 + 2.62, cz, -0.07, 0, 0), uvf: (x, y, z) => [x / 0.3, z / 2.5] });
      meter('galv', new THREE.BoxGeometry(3.8, 0.12, 0.05), { m4: M4(cx, y0 + 2.52, cz + 1.06) });
      meter('vc', new THREE.BoxGeometry(3.15, 1.85, 0.02), { m4: M4(cx, y0 + 1.25, cz - 0.78), color: 0x8fa4ae, clase: 'espejo' });
      meter('vc', new THREE.BoxGeometry(0.02, 1.85, 1.4), { m4: M4(cx - 1.6, y0 + 1.25, cz - 0.05), color: 0x8fa4ae, clase: 'espejo' });
      for (const dy of [0, 0.07, 0.14]) meter('madera', new THREE.BoxGeometry(2.6, 0.035, 0.11), { m4: M4(cx, y0 + 0.46, cz - 0.6 + dy * 1.6) });
      meter('madera', new THREE.BoxGeometry(2.6, 0.12, 0.03), { m4: M4(cx, y0 + 0.72, cz - 0.74, -0.15, 0, 0) });
      for (const dx of [-1.15, 1.15]) meter('galv', new THREE.BoxGeometry(0.05, 0.44, 0.36), { m4: M4(cx + dx, y0 + 0.24, cz - 0.5) });
      meter('vc', new THREE.CylinderGeometry(0.2, 0.17, 0.62, 14, 1, true), { m4: M4(cx + 2.25, y0 + 0.33, cz + 0.5), color: 0x2f5d3e, clase: 'plastico' }); // basurero
      senal({ cara: 'paradero', forma: 'cuadrado', lado: 0.45, x: cx + 2.4, z: cz + 1.0, ry: 0, alto: 2.35 });
    }

    // fin del pavimento al este y al sur: barreras de obra y conos
    const conoGeo = (() => {
      const prof = [[0.17, 0.03], [0.16, 0.06], [0.145, 0.12], [0.12, 0.249], [0.12, 0.251], [0.104, 0.319], [0.104, 0.321], [0.082, 0.419], [0.082, 0.421], [0.062, 0.519], [0.062, 0.521], [0.036, 0.69], [0.0, 0.715]];
      const geo = new THREE.LatheGeometry(prof.map(([r2, y]) => new THREE.Vector2(r2, y)), 12);
      colorear(geo, (x, y) => Col(y > 0.25 && y < 0.32 ? 0xf4f4f0 : y > 0.42 && y < 0.52 ? 0xf4f4f0 : 0xff5a10));
      return geo;
    })();
    function cono(x, z) {
      meter('vc', conoGeo, { m4: M4(x, YR, z, 0, rnd() * 6, 0), clase: 'plastico' });
      meter('vc', new THREE.BoxGeometry(0.38, 0.03, 0.38), { m4: M4(x, YR + 0.015, z, 0, rnd(), 0), color: 0x1a1a1a, clase: 'goma' });
    }
    function barrera(x, z, ry) {
      const m = M4(x, YR, z, 0, ry, 0);
      for (const y of [0.78, 1.08]) meter('senales', uvFranjas(new THREE.BoxGeometry(2.5, 0.22, 0.03)), { m4: m.clone().multiply(M4(0, y, 0)) });
      for (const u of [-1.1, 1.1]) for (const w of [-0.32, 0.32]) meter('galv', tubo(V(u, 1.2, 0).applyMatrix4(m), V(u, 0, w).applyMatrix4(m), 0.022, 6));
      for (const u of [-1.1, 1.1]) meter('vc', cajaR(0.5, 0.12, 0.3, 0.05, 1), { m4: m.clone().multiply(M4(u, 0.06, 0.38, 0, 0.2, 0)), color: 0x8b7a55, clase: 'tela' });
    }
    for (const w of [-3.1, 0, 3.1]) { barrera(FIN - 1.2, w, Math.PI / 2); barrera(w, FIN - 1.2, 0); }
    for (const w of [-3.9, -1.3, 1.3, 3.9]) { cono(FIN - 4.5, w); cono(w, FIN - 4.5); }
    for (const [x, z] of [[17, -3.6], [19.5, -3.0], [22, -2.4], [24.5, -1.8]]) cono(x, z);

    // ------------------------------------------------------------ torre de observación de andamio
    const PLAT = { x0: 7.4, x1: 12.54, z0: 7.4, z1: 12.54, y: 8.0 };
    const y0T = suelo(10, 10);
    {
      const xs = [PLAT.x0, (PLAT.x0 + PLAT.x1) / 2, PLAT.x1], zs = [PLAT.z0, (PLAT.z0 + PLAT.z1) / 2, PLAT.z1];
      const niveles = [0.35, 2.0, 4.0, 6.0, 7.87];
      const t = (a, b) => meter('galv', tubo(a, b, 0.0242, 8, true));
      const abraz = (x, y, z) => meter('vc', new THREE.BoxGeometry(0.085, 0.09, 0.085), { m4: M4(x, y, z), color: 0x6f757a, clase: 'metal' });
      for (const x of xs) for (const z of zs) {
        const centro = x === xs[1] && z === zs[1];
        t(V(x, y0T + 0.13, z), V(x, y0T + (centro ? PLAT.y - 0.06 : PLAT.y + 1.05), z));
        meter('vc', new THREE.BoxGeometry(0.16, 0.12, 0.16), { m4: M4(x, y0T + 0.06, z), color: 0x55595d, clase: 'metal' });
        for (const y of [...niveles, PLAT.y + 0.5, PLAT.y + 1.0]) if (!(y > PLAT.y && centro)) abraz(x, y0T + y, z);
      }
      for (const y of niveles) {
        for (const z of zs) for (let i = 0; i < 2; i++) t(V(xs[i], y0T + y, z), V(xs[i + 1], y0T + y, z));
        for (const x of xs) for (let i = 0; i < 2; i++) t(V(x, y0T + y + 0.06, zs[i]), V(x, y0T + y + 0.06, zs[i + 1]));
      }
      for (const y of [PLAT.y + 0.5, PLAT.y + 1.0]) {
        for (const z of [PLAT.z0, PLAT.z1]) for (let i = 0; i < 2; i++) t(V(xs[i], y0T + y, z), V(xs[i + 1], y0T + y, z));
        for (const x of [PLAT.x0, PLAT.x1]) for (let i = 0; i < 2; i++) t(V(x, y0T + y, zs[i]), V(x, y0T + y, zs[i + 1]));
      }
      for (let l = 0; l < niveles.length - 1; l++) for (let i = 0; i < 2; i++) {
        const ya = y0T + niveles[l], yb2 = y0T + niveles[l + 1], inv = (i + l) % 2 === 1;
        for (const [z, o] of [[PLAT.z0, -0.05], [PLAT.z1, 0.05]]) t(V(xs[inv ? i + 1 : i], ya, z + o), V(xs[inv ? i : i + 1], yb2, z + o));
        for (const [x, o] of [[PLAT.x0, -0.05], [PLAT.x1, 0.05]]) t(V(x + o, ya, zs[inv ? i + 1 : i]), V(x + o, yb2, zs[inv ? i : i + 1]));
      }
      for (const z of zs) meter('madera', new THREE.BoxGeometry(PLAT.x1 - PLAT.x0 + 0.7, 0.05, 0.26), { m4: M4((PLAT.x0 + PLAT.x1) / 2, y0T + 0.025, z), color: 0xc9a77f });
      const lx = PLAT.x1 - PLAT.x0, lz = PLAT.z1 - PLAT.z0, cx = (PLAT.x0 + PLAT.x1) / 2, cz = (PLAT.z0 + PLAT.z1) / 2;
      meter('cubierta', new THREE.BoxGeometry(lx + 0.1, 0.05, lz + 0.1), { m4: M4(cx, y0T + PLAT.y - 0.025, cz), uvf: (x, y, z) => [x / 0.3, z / 2.5] });
      const amarillo = { color: 0xe3b21f, clase: 'plastico' };
      meter('vc', new THREE.BoxGeometry(lx, 0.15, 0.025), { m4: M4(cx, y0T + PLAT.y + 0.075, PLAT.z0 + 0.03), ...amarillo });
      meter('vc', new THREE.BoxGeometry(lx, 0.15, 0.025), { m4: M4(cx, y0T + PLAT.y + 0.075, PLAT.z1 - 0.03), ...amarillo });
      meter('vc', new THREE.BoxGeometry(0.025, 0.15, lz), { m4: M4(PLAT.x0 + 0.03, y0T + PLAT.y + 0.075, cz), ...amarillo });
      meter('vc', new THREE.BoxGeometry(0.025, 0.15, lz), { m4: M4(PLAT.x1 - 0.03, y0T + PLAT.y + 0.075, cz), ...amarillo });
      // escalera de acceso por la cara sur
      const zE = PLAT.z1 + 0.36, xe0 = 8.25, xe1 = 8.7;
      meter('galv', tubo(V(xe0, y0T, zE), V(xe0, y0T + PLAT.y + 1.0, zE), 0.022, 8)); meter('galv', tubo(V(xe1, y0T, zE), V(xe1, y0T + PLAT.y + 1.0, zE), 0.022, 8));
      for (let y = 0.3; y < PLAT.y + 0.1; y += 0.3) meter('galv', tubo(V(xe0, y0T + y, zE), V(xe1, y0T + y, zE), 0.016, 6, true));
      for (const y of [1.5, 4.5, 7.5]) for (const x of [xe0, xe1]) meter('galv', tubo(V(x, y0T + y, zE), V(x, y0T + y, PLAT.z1), 0.016, 6, true));
      // caja de herramientas y bidón de agua al pie de la torre
      meter('vc', cajaR(0.55, 0.28, 0.26, 0.03, 1), { m4: M4(12.2, y0T + 0.14, 13.3, 0, 0.3, 0), color: 0xb0261c, clase: 'pintura' });
      meter('vc', new THREE.CylinderGeometry(0.15, 0.15, 0.42, 14), { m4: M4(11.4, y0T + 0.21, 13.4), color: 0x2a6fb0, clase: 'plastico' });
    }

    // ------------------------------------------------------------ vegetación al borde del camino
    const vegL = nuevoL();
    function tarjeta(cx, cy, cz, ancho, alto, ang, region, tinte, normalDe) {
      const ca = Math.cos(ang), sa = Math.sin(ang), w = ancho / 2;
      const [u0, u1] = region === 'pasto' ? [0.004, 0.496] : [0.504, 0.996];
      const inc = (rnd() - 0.5) * 0.25 * alto;
      const A = [cx - ca * w, cy, cz - sa * w, u0, 0.01], B = [cx + ca * w, cy, cz + sa * w, u1, 0.01];
      const C = [cx + ca * w + inc * sa, cy + alto, cz + sa * w - inc * ca, u1, 0.99], D = [cx - ca * w + inc * sa, cy + alto, cz - sa * w - inc * ca, u0, 0.99];
      const nf = normalDe(V(-sa, 0, ca)), nb = normalDe(V(sa, 0, -ca));
      const base = tinte.clone().multiplyScalar(region === 'pasto' ? 0.55 : 0.8);
      const push = (vs, n) => vs.forEach((v, i) => { vegL.p.push(v[0], v[1], v[2]); vegL.n.push(n.x, n.y, n.z); const c = v[1] - cy < 1e-3 ? base : tinte; vegL.c.push(c.r, c.g, c.b); vegL.uv.push(v[3], v[4]); void i; });
      push([A, B, C, A, C, D], nf); push([A, C, B, A, D, C], nb);
    }
    const haciaArriba = (n) => n.multiplyScalar(0.3).add(Y).normalize();
    function champa(x, z, esc = 1) {
      const y = Math.max(suelo(x, z), -0.05) - 0.02, seco = rnd();
      const tinte = Col(0xffffff).lerp(Col(seco < 0.35 ? 0xe8d9a0 : 0xbfe0a0), 0.5).multiplyScalar(0.85 + 0.25 * rnd());
      const a = rnd() * Math.PI, h = (0.32 + rnd() * 0.42) * esc, w = (0.45 + rnd() * 0.4) * esc;
      tarjeta(x, y, z, w, h, a, 'pasto', tinte, haciaArriba); tarjeta(x, y, z, w, h, a + Math.PI / 2, 'pasto', tinte, haciaArriba);
    }
    function mata(x, z, r0 = 0.7, alto = 0.9, n = 10) {
      const y = Math.max(suelo(x, z), -0.05), c = V(x, y + alto * 0.55, z);
      const tinte = Col(0xffffff).multiplyScalar(0.8 + 0.3 * rnd());
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r0 * 0.6;
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = y + rnd() * alto * 0.55;
        tarjeta(px, py, pz, r0 * (0.8 + rnd() * 0.5), alto * (0.6 + rnd() * 0.4), rnd() * Math.PI, 'hoja', tinte, (n2) => n2.multiplyScalar(0.25).add(V(px - c.x, py + 0.3 - c.y, pz - c.z).normalize()).normalize());
      }
    }
    function arbol(x, z, alto = 7, radio = 2.6, alamo = false) {
      const y = suelo(x, z), tronco = alamo ? alto * 0.35 : alto * 0.42;
      meter('vc', new THREE.CylinderGeometry(alamo ? 0.12 : 0.16, alamo ? 0.22 : 0.28, tronco + 0.6, 8), { m4: M4(x, y + (tronco + 0.6) / 2 - 0.1, z, (rnd() - 0.5) * 0.06, 0, (rnd() - 0.5) * 0.06), color: alamo ? 0x8a8378 : 0x5e4b3a, clase: 'mate' });
      if (!alamo) for (let k = 0; k < 3; k++) { const a = rnd() * 6.28; meter('vc', tubo(V(x, y + tronco * 0.8, z), V(x + Math.cos(a) * radio * 0.6, y + tronco + radio * 0.5, z + Math.sin(a) * radio * 0.6), 0.06, 5, true), { color: 0x5e4b3a }); }
      const cy = y + tronco + (alto - tronco) / 2, ry = (alto - tronco) / 2, n = alamo ? 46 : 70, tinte = Col(alamo ? 0xd8f0b8 : 0xffffff).multiplyScalar(0.8 + 0.2 * rnd());
      for (let k = 0; k < n; k++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, rr = Math.sqrt(1 - u * u) * Math.cbrt(rnd());
        const px = x + Math.cos(a) * rr * radio, pz = z + Math.sin(a) * rr * radio, py = cy + u * ry * 0.9;
        const tam = alamo ? 1.3 + rnd() * 0.5 : 1.5 + rnd() * 0.8;
        tarjeta(px, py - tam / 2, pz, tam, tam, rnd() * Math.PI, 'hoja', tinte, (n2) => n2.multiplyScalar(0.2).add(V((px - x) / radio, (py - cy) / ry + 0.35, (pz - z) / radio).normalize()).normalize());
      }
    }
    {
      const libre = (x, z) => !(x > 5.5 && x < 14.5 && z > 5.5 && z < 14.5) && !(x > -27 && x < -21 && z > -9.6 && z < -6.2);
      const borde = (d) => (d < 90 ? 1.5 : 5);
      for (const sg of [-1, 1]) {
        for (let x = A0 + 6; x < FIN - 2; x += borde(Math.abs(x)) * (0.6 + rnd() * 0.8)) if (Math.abs(x) > HW + RF + 1) { const z = sg * azar(6.9, 9.3); if (libre(x, z)) champa(x, z); }
        for (let z = B0 + 6; z < FIN - 2; z += borde(Math.abs(z)) * (0.6 + rnd() * 0.8)) if (Math.abs(z) > HW + RF + 1) { const x = sg * azar(6.9, 9.3); if (libre(x, z)) champa(x, z); }
      }
      // pasto en las esquinas, detrás de las soleras, y alrededor de postes y señales
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let k = 0; k < 26; k++) {
        const f = rnd() * Math.PI / 2, rr = RF - 0.5 - rnd() * 4.5, cx = sx * (HW + RF), cz = sz * (HW + RF);
        const x = cx - sx * rr * Math.cos(f), z = cz - sz * rr * Math.sin(f);
        if (libre(x, z)) champa(x, z, 0.9);
      }
      for (const [x, z] of [[-6.4, -HW - 2.6], [6.3, HW + 2.9], [-6.4, -70], [-6.4, -125], [-70, 6.4], [-150, 6.4], [15.5, -6.5], [-6.5, 15.5], ...POSTES_LUZ]) for (let k = 0; k < 3; k++) champa(x + azar(-0.5, 0.5), z + azar(-0.5, 0.5), 1.1);
      // matorrales junto a los cercos
      for (let k = 0; k < 34; k++) {
        const lado = rnd() < 0.5 ? -1 : 1, enX = rnd() < 0.55, d = -azar(16, 150);
        const x = enX ? d : lado * azar(9.8, 11), z = enX ? lado * azar(9.8, 11) : d;
        mata(x, z, azar(0.6, 1.1), azar(0.6, 1.3), 9);
      }
      for (const [x, z] of [[18.5, -10.5], [24, 10.6], [-18.6, 10.8], [-10.6, 22], [10.8, 24]]) mata(x, z, 0.9, 1.1, 10);
      // árboles en los potreros de las esquinas y una hilera de álamos a lo largo del camino este-oeste
      arbol(-26, -24, 8, 3.0); arbol(-36, -17, 7, 2.6); arbol(22, -26, 7.5, 2.8); arbol(-24, 25, 8.5, 3.2); arbol(28, 26, 7, 2.6);
      for (let x = -48; x > -250; x -= 9 + rnd() * 3) arbol(x, 12.2 + azar(-0.4, 0.4), 13 + rnd() * 3, 1.5, true);
    }
    lotes.vegetacion = [aGeo(vegL)];

    // ------------------------------------------------------------ unión de los lotes estáticos
    const MATS = { asfalto: matAsfalto, ripio: matRipio, hormigon: matHormigon, galv: matGalv, madera: matMadera, vc: matVC, cubierta: matCubierta, pintura: matPintura, desgaste: matDesgaste, senales: matSenales, vegetacion: matVeg };
    const SOMBRA = { galv: true, madera: true, vc: true, cubierta: true, senales: true, vegetacion: true };
    for (const [k, lista] of Object.entries(lotes)) {
      if (!lista.length) continue;
      const geo = lista.length === 1 ? lista[0] : kit.mergeGeometries(lista);
      for (const gg of lista) if (gg !== geo) gg.dispose();
      const m = new THREE.Mesh(geo, MATS[k]);
      m.castShadow = !!SOMBRA[k]; m.receiveShadow = k !== 'desgaste';
      if (k === 'desgaste') m.renderOrder = 1;
      g.add(m);
    }

    // ------------------------------------------------------------ autos
    // Carrocería: secciones transversales a lo largo del largo (x hacia adelante, z hacia la derecha, y = 0 en la calzada).
    const XF = 2.25, XT = -2.25, HWA = 0.895, EJES = [1.33, -1.33], VIA = 0.775, RA = 0.4;
    const topeA = curva([[-2.3, 0.8], [-2.2, 0.9], [-2.0, 0.965], [-1.5, 0.985], [-1.1, 0.985], [-0.4, 0.968], [0.4, 0.948], [0.8, 0.928], [1.4, 0.865], [1.9, 0.8], [2.15, 0.735], [2.3, 0.64]]);
    const fondoBase = curva([[-2.3, 0.42], [-2.15, 0.31], [-1.9, 0.27], [1.9, 0.25], [2.12, 0.27], [2.3, 0.36]]);
    const fondoA = (x) => { let y = fondoBase(x); for (const xe of EJES) { const dx = x - xe; if (Math.abs(dx) < RA) y = Math.max(y, RRUEDA + Math.sqrt(RA * RA - dx * dx)); } return y; };
    const anchoA = (x) => {
      if (x > 1.0) { const t = Math.min(1, (x - 1.0) / (XF - 1.0)); return HWA * Math.pow(1 - Math.pow(t, 3.2), 1 / 3.2); }
      if (x < -1.1) { const t = Math.min(1, (-1.1 - x) / (-1.1 - XT)); return HWA * Math.pow(1 - Math.pow(t, 3.6), 1 / 3.6); }
      return HWA;
    };
    const bulto = (y) => 1 - 0.024 * ((y - 0.6) / 0.33) ** 2;
    const dxNariz = (y) => 0.075 * sstep(0.6, 0.74, y) + 0.045 * (1 - sstep(0.25, 0.36, y));
    const dxCola = (y) => 0.05 * sstep(0.86, 0.99, y) + 0.06 * (1 - sstep(0.3, 0.44, y));
    const xAj = (x, y) => (x > 0 ? x - dxNariz(y) * sstep(1.6, XF, x) : x + dxCola(y) * sstep(-1.6, XT, x));
    const ALT = [0.36, 0.44, 0.58, 0.645, 0.71];
    function ladoInf(x) {
      const hw = anchoA(x), yt = topeA(x), yb = fondoA(x);
      const L = [[0, yb], [0.72 * hw, yb], [0.94 * hw, yb + 0.012], [0.985 * hw, yb + 0.042]];
      let yp = yb + 0.042;
      for (const h0 of ALT) { const y = Math.max(yp, Math.min(Math.max(h0, yb + 0.08), yt - 0.1)); L.push([hw * bulto(y), y]); yp = y; }
      const ys = [yt - 0.075, yt - 0.035, yt - 0.011].map((v) => Math.max(v, yp));
      L.push([0.986 * hw * bulto(ys[0]), ys[0]], [0.955 * hw, ys[1]], [0.9 * hw, ys[2]], [0.8 * hw, yt], [0.45 * hw, yt + 0.012], [0, yt + 0.016]);
      return L;
    }
    const seccionInf = (x) => { const L = ladoInf(x); return [...L.map(([z, y]) => V(xAj(x, y), y, z)), ...L.slice(0, -1).reverse().map(([z, y]) => V(xAj(x, y), y, -z))]; };
    const JUNTAS = [[0.8, 3, 13], [-0.4, 3, 9], [-1.3, 3, 9], [-1.5, 10, 13]];
    const ordenar = (set) => [...set].map((v) => Math.round(v * 1e4) / 1e4).sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 8e-4);
    const xsInf = (() => {
      const st = new Set();
      for (let i = 0; i <= 44; i++) st.add(XF * Math.sin((i / 44 - 0.5) * Math.PI));
      for (const xe of EJES) { for (let k = -9; k <= 9; k++) st.add(xe + (k / 9) * (RA - 0.002)); st.add(xe - RA - 0.004); st.add(xe + RA + 0.004); }
      for (const [xj] of JUNTAS) { st.add(xj - 0.007); st.add(xj + 0.007); }
      for (const v of [1.95, 2.04, -2.0, -1.98]) st.add(v);
      return ordenar(st);
    })();
    // Cabina: ventanas, pilares y techo
    const XWS = 0.8, XRF = -0.12, XRR = -0.98, XRW = -1.44, YTECHO = 1.43, NV = 5;
    const techoA = (x) => {
      const b = topeA(x) - 0.012;
      if (x >= XRF) { const t = clamp((XWS - x) / (XWS - XRF), 0, 1); return lerp(b, YTECHO, 1 - (1 - t) ** 1.35); }
      if (x <= XRR) { const t = clamp((x - XRW) / (XRR - XRW), 0, 1); return lerp(b, YTECHO, 1 - (1 - t) ** 1.6); }
      return YTECHO + 0.012 * Math.sin((Math.PI * (x - XRR)) / (XRF - XRR));
    };
    const THETA = (() => { const a = [0, 0.15, 3, 9, 16, 24, 32, 40, 47, 53, 60, 67, 75, 82, 90]; return [...a, ...a.slice(0, -1).reverse().map((d) => 180 - d)].map((d) => (d * Math.PI) / 180); })();
    const QT = THETA.map((t) => Math.pow(Math.abs(Math.sin(t)), 2 / NV));
    const seccionCab = (x) => {
      const yb = topeA(x) - 0.012, yr = techoA(x), hwB = 0.8 - 0.045 * sstep(0.3, 0.8, x) - 0.02 * sstep(-1.0, -1.44, x), hwT = hwB - 0.15;
      return THETA.map((th, j) => { const q = QT[j], c = Math.cos(th); return V(x, yb + (yr - yb) * q, Math.sign(c) * Math.pow(Math.abs(c), 2 / NV) * lerp(hwB, hwT, Math.pow(q, 1.3))); });
    };
    const xsCab = (() => { const st = new Set(); for (let x = XRW; x <= XWS + 1e-6; x += 0.05) st.add(x); for (const v of [XRW, XWS, XRF, XRR, -1.04, -0.47, -0.37, 0.7]) st.add(v); return ordenar(st); })();

    // Atlas de faros, pilotos, parrilla, patentes y pantalla del radar (con su versión luminosa)
    const PATENTES = ['KX·RT·45', 'LP·BH·82'];
    function pintarLuces(x, em) {
      x.fillStyle = '#000'; x.fillRect(0, 0, 512, 256);
      const r = kit.mulberry32(3);
      if (!em) PATENTES.forEach((txt, k) => {
        const ox = k * 256;
        const gr = x.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#fbfbf7'); gr.addColorStop(1, '#e4e3dc');
        x.fillStyle = gr; x.fillRect(ox + 2, 2, 252, 92);
        x.lineWidth = 5; x.strokeStyle = '#1a1a1a'; x.strokeRect(ox + 6, 6, 244, 84);
        x.fillStyle = '#1a1a1a'; x.textAlign = 'center'; x.font = '700 15px Arial'; x.fillText('CHILE', ox + 128, 24);
        x.font = '800 50px Arial'; x.fillText(txt, ox + 128, 76);
        for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(90,80,62,${0.05 + r() * 0.12})`; x.fillRect(ox + 4 + r() * 248, 4 + r() * 88, 1 + r() * 3, 1 + r() * 2); }
      });
      // faro: reflector cromado, dos proyectores y franja de luz diurna
      if (!em) {
        const gr = x.createLinearGradient(0, 96, 0, 192); gr.addColorStop(0, '#5d646b'); gr.addColorStop(0.5, '#2d3237'); gr.addColorStop(1, '#4a5056');
        x.fillStyle = gr; x.fillRect(0, 96, 128, 96);
        for (const cx of [38, 82]) { x.fillStyle = '#c9cfd4'; x.beginPath(); x.arc(cx, 138, 17, 0, 7); x.fill(); x.fillStyle = '#20252a'; x.beginPath(); x.arc(cx, 138, 12, 0, 7); x.fill(); x.fillStyle = '#e8eef3'; x.beginPath(); x.arc(cx, 138, 6, 0, 7); x.fill(); }
        x.fillStyle = '#eef3f6'; x.fillRect(8, 172, 112, 7);
      } else {
        for (const cx of [38, 82]) { x.fillStyle = '#5a5a5a'; x.beginPath(); x.arc(cx, 138, 7, 0, 7); x.fill(); }
        x.fillStyle = '#ffffff'; x.fillRect(8, 171, 112, 9);
      }
      // piloto trasero
      if (!em) {
        x.fillStyle = '#6a0b0b'; x.fillRect(128, 96, 128, 96);
        for (let y = 100; y < 192; y += 7) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(128, y, 128, 2); }
        x.fillStyle = '#d0281c'; x.fillRect(136, 112, 112, 10); x.fillRect(136, 112, 10, 64);
        x.fillStyle = '#e7e7e7'; x.fillRect(196, 150, 44, 22);
      } else {
        x.fillStyle = '#3a0000'; x.fillRect(128, 96, 128, 96);
        x.fillStyle = '#d01a0c'; x.fillRect(136, 112, 112, 10); x.fillRect(136, 112, 10, 64);
      }
      // parrilla
      if (!em) {
        x.fillStyle = '#0f1011'; x.fillRect(256, 96, 128, 96);
        x.strokeStyle = '#2c2e30'; x.lineWidth = 2;
        for (let yy = 100; yy < 192; yy += 9) for (let xx = 256 + ((yy / 9) % 2) * 5; xx < 384; xx += 10) { x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 5, yy + 4.5); x.lineTo(xx, yy + 9); x.stroke(); }
        x.fillStyle = '#a9afb4'; x.fillRect(256, 100, 128, 6);
        x.fillStyle = '#c9ced2'; x.beginPath(); x.ellipse(320, 140, 15, 10, 0, 0, 7); x.fill(); x.fillStyle = '#0f1011'; x.beginPath(); x.ellipse(320, 140, 10, 6, 0, 0, 7); x.fill();
      }
      // pantalla del radar de velocidad
      x.fillStyle = em ? '#000' : '#0c1612'; x.fillRect(384, 96, 128, 96);
      x.fillStyle = em ? '#5cff7a' : '#7dff9a'; x.textAlign = 'center'; x.font = '700 58px Courier New'; x.fillText('90', 440, 162);
      x.font = '700 16px Arial'; x.fillText('km/h', 484, 182);
    }
    const texLuces = lienzo(512, 256, (x) => pintarLuces(x, false)), texLucesE = lienzo(512, 256, (x) => pintarLuces(x, true));
    const matLuces = new THREE.MeshStandardMaterial({ map: texLuces, emissiveMap: texLucesE, emissive: 0xffffff, emissiveIntensity: 1.3, roughness: 0.22, metalness: 0.1 });
    const matVidrio = new THREE.MeshStandardMaterial({ color: 0x223039, transparent: true, opacity: 0.46, roughness: 0.04, metalness: 0.25, envMapIntensity: 2.5, depthWrite: false });
    const uvReg = (px0, py0, pw, ph, a, b) => [(px0 + 2 + a * (pw - 4)) / 512, 1 - (py0 + 2 + (1 - b) * (ph - 4)) / 256];
    const uvFaro = (x, y, z) => uvReg(0, 96, 128, 96, clamp((Math.abs(z) - 0.3) / 0.6, 0, 1), clamp((y - 0.58) / 0.13, 0, 1));
    const uvPiloto = (x, y, z) => uvReg(128, 96, 128, 96, clamp((Math.abs(z) - 0.42) / 0.48, 0, 1), clamp((y - 0.71) / 0.2, 0, 1));
    const uvParrilla = (x, y, z) => uvReg(256, 96, 128, 96, clamp((z + 0.52) / 1.04, 0, 1), clamp((y - 0.44) / 0.14, 0, 1));
    const NEGRO = Col(0x101011), POLVO_AUTO = Col(0x8a7b66);

    const ASIENTO_Y = 0.455, PISO = 0.26, XCAD = -0.45, ZCOND = -0.37;
    function crearAuto(pintura, tapiz, iPatente) {
      const P = Col(pintura), sal = {};
      const PL = { lote: 'opaco', color: NEGRO, clase: 'plastico' };
      const JN = { lote: 'opaco', color: Col(0x0c0c0c), clase: 'plastico' };
      const polvoRueda = (x, y) => Math.max(...EJES.map((xe) => 0.3 * Math.exp(-((x - xe + 0.6) ** 2) / 0.06))) * (1 - sstep(0.3, 0.8, y));
      superficie(xsInf.map(seccionInf), (i, j, c) => {
        const k = j < 14 ? j : 27 - j, x = c.x, y = c.y, az = Math.abs(c.z);
        if (k <= 1) return PL;
        if (x > 1.95 && (k === 6 || k === 7) && az > 0.3) return { lote: 'luces', uv: uvFaro };
        if (x > 2.04 && k === 5 && az < 0.52) return { lote: 'luces', uv: uvParrilla };
        if (x > 1.98 && (k === 3 || k === 4) && az < 0.66) return PL;
        if (x < -2.0 && k === 8 && az > 0.42) return { lote: 'luces', uv: uvPiloto };
        if ((x < -1.98 && k <= 4) || (x > 1.9 && k <= 3)) return PL;
        const jn = JUNTAS.find(([xj]) => Math.abs(x - xj) < 0.0072);
        if (jn && k >= jn[1] && k <= jn[2]) return JN;
        const d = 0.5 * (1 - sstep(0.3, 0.62, y)) + polvoRueda(x, y);
        return { lote: 'opaco', color: P.clone().lerp(POLVO_AUTO, clamp(d, 0, 0.62)), clase: 'pintura' };
      }, sal);
      const PIN = { lote: 'opaco', color: P, clase: 'pintura' }, MOL = { lote: 'opaco', color: NEGRO, clase: 'plastico' }, VID = { lote: 'vidrio' };
      superficie(xsCab.map(seccionCab), (i, j, c) => {
        const qm = (QT[j] + QT[j + 1]) / 2, x = c.x;
        if (qm < 0.07) return MOL;
        if (qm < 0.885) { if (x > -0.47 && x < -0.37) return MOL; if (x > -1.04 && x < 0.7) return VID; return PIN; }
        if (qm < 0.955) return PIN;
        if (x >= XRR && x <= XRF) return PIN;
        if ((x > XRF && x < XWS - 0.035) || (x < XRR && x > XRW + 0.035)) return VID;
        return MOL;
      }, sal);
      const extra = [], extraL = [];
      const pon = (geo, m4, color, clase = 'plastico') => extra.push(preparar(geo, { m4, color: Col(color), clase }));
      // interior: piso, paneles de puertas, muros, cielo, asientos, consola y tablero
      const plano = (w, h, m4, color) => pon(new THREE.PlaneGeometry(w, h), m4, color, 'tela');
      plano(2.16, 1.6, M4(-0.32, PISO, 0, -Math.PI / 2, 0, 0), 0x252321);
      plano(2.16, 0.72, M4(-0.32, PISO + 0.36, 0.8, 0, Math.PI, 0), 0x3b3936);
      plano(2.16, 0.72, M4(-0.32, PISO + 0.36, -0.8, 0, 0, 0), 0x3b3936);
      plano(1.6, 0.72, M4(0.76, PISO + 0.36, 0, 0, -Math.PI / 2, 0), 0x1c1c1d);
      plano(1.6, 0.72, M4(-1.4, PISO + 0.36, 0, 0, Math.PI / 2, 0), 0x2c2a28);
      plano(0.8, 1.25, M4(-0.55, 1.395, 0, Math.PI / 2, 0, 0), 0x8f8b84);
      for (const sz of [-1, 1]) pon(cajaR(1.5, 0.05, 0.07, 0.02, 1), M4(-0.35, 0.68, sz * 0.765), 0x2b2a28, 'tela');
      for (const zs of [-0.37, 0.37]) {
        pon(cajaR(0.52, 0.13, 0.5, 0.05, 1), M4(-0.42, ASIENTO_Y - 0.065, zs, 0, 0, 0.05), tapiz, 'tela');
        pon(cajaR(0.13, 0.64, 0.5, 0.05, 1), M4(-0.74, ASIENTO_Y + 0.31, zs, 0, 0, 0.24), tapiz, 'tela');
        pon(cajaR(0.09, 0.19, 0.26, 0.04, 1), M4(-0.86, ASIENTO_Y + 0.74, zs, 0, 0, 0.16), tapiz, 'tela');
      }
      pon(cajaR(0.5, 0.13, 1.34, 0.05, 1), M4(-1.08, ASIENTO_Y - 0.08, 0), tapiz, 'tela');
      pon(cajaR(0.13, 0.56, 1.34, 0.05, 1), M4(-1.33, ASIENTO_Y + 0.25, 0, 0, 0, 0.26), tapiz, 'tela');
      pon(cajaR(0.7, 0.22, 0.2, 0.05, 1), M4(0.0, PISO + 0.11, 0), 0x1b1b1c);
      pon(cajaR(0.46, 0.24, 1.58, 0.07, 2), M4(0.56, 0.85, 0), 0x1c1c1d);
      pon(cajaR(0.17, 0.07, 0.36, 0.03, 1), M4(0.4, 0.985, ZCOND, 0, 0, 0.2), 0x161617);
      pon(cajaR(0.03, 0.13, 0.24, 0.012, 1), M4(0.37, 0.95, 0.02, 0, 0, -0.35), 0x0a0d10, 'espejo');
      // volante con su columna; los puntos de agarre quedan a las 9 y a las 3
      const ALFA = 0.42, VC = V(0.1, 0.93, ZCOND);
      const qVol = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -ALFA).multiply(new THREE.Quaternion().setFromAxisAngle(Y, -Math.PI / 2));
      const mVol = new THREE.Matrix4().compose(VC, qVol, V(1, 1, 1));
      pon(new THREE.TorusGeometry(0.185, 0.017, 6, 26), mVol, 0x151515, 'goma');
      for (const [px, py, w, h] of [[0.095, 0, 0.17, 0.035], [-0.095, 0, 0.17, 0.035], [0, -0.095, 0.035, 0.17]]) pon(new THREE.BoxGeometry(w, h, 0.014), mVol.clone().multiply(M4(px, py, 0.004)), 0x202020);
      pon(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 14), mVol.clone().multiply(M4(0, 0, 0.012, Math.PI / 2, 0, 0)), 0x1a1a1a);
      const eje = V(0, 0, 1).applyQuaternion(qVol);
      pon(tubo(VC.clone().addScaledVector(eje, -0.02), VC.clone().addScaledVector(eje, -0.3), 0.03, 8), null, 0x1a1a1a);
      pon(cajaR(0.03, 0.06, 0.22, 0.012, 1), M4(-0.06, 1.33, 0), 0x151515);
      pon(cajaR(0.012, 0.05, 0.2, 0.006, 1), M4(-0.077, 1.33, 0), 0xa9b4be, 'espejo');
      // exterior: espejos, manillas, plumillas, antena, escape, calipers, tapabarros y fondo
      for (const sz of [-1, 1]) {
        pon(cajaR(0.11, 0.115, 0.2, 0.045, 2), M4(0.6, 1.03, sz * 1.0), P, 'pintura');
        pon(cajaR(0.08, 0.035, 0.12, 0.015, 1), M4(0.63, 0.995, sz * 0.88), 0x141414);
        pon(cajaR(0.014, 0.09, 0.165, 0.006, 1), M4(0.547, 1.03, sz * 1.0), 0xaab6c2, 'espejo');
        for (const xh of [0.22, -0.88]) pon(cajaR(0.17, 0.034, 0.03, 0.012, 1), M4(xh, 0.855, sz * (0.975 * HWA + 0.01)), 0xc9cdd0, 'cromo');
      }
      for (const [xa, za, xb, zb] of [[0.77, 0.1, 0.6, -0.5], [0.77, 0.66, 0.6, 0.06]]) pon(tubo(V(xa, techoA(xa) + 0.016, za), V(xb, techoA(xb) + 0.016, zb), 0.008, 4), null, 0x111111);
      pon(cajaR(0.16, 0.06, 0.05, 0.022, 1), M4(-0.88, 1.455, 0, 0, 0, 0.15), 0x111111);
      pon(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 10, 1, true), M4(-2.2, 0.27, 0.5, 0, 0, Math.PI / 2), 0xbfc3c6, 'cromo');
      for (const xe of EJES) for (const sz of [-1, 1]) {
        pon(cajaR(0.1, 0.13, 0.05, 0.02, 1), M4(xe - 0.1, RRUEDA + 0.1, sz * 0.8, 0, 0, 0.5), 0x8e1d17, 'plastico');
        const forro = new THREE.CylinderGeometry(RA - 0.012, RA - 0.012, 0.32, 18, 1, true, Math.PI / 2, Math.PI); forro.rotateX(Math.PI / 2);
        pon(invertir(forro), M4(xe, RRUEDA, sz * 0.74), 0x0d0d0d);
        pon(new THREE.CircleGeometry(RA - 0.012, 18, 0, Math.PI), M4(xe, RRUEDA, sz * 0.58, 0, sz > 0 ? 0 : Math.PI, 0), 0x0d0d0d);
      }
      pon(new THREE.BoxGeometry(3.7, 0.07, 1.12), M4(0, 0.215, 0), 0x121212);
      // patentes con su marco
      const reg = (geo) => remapUV(geo, (iPatente * 256 + 2) / 512, 1 - 94 / 256, 252 / 512, 92 / 256);
      extraL.push(preparar(reg(new THREE.PlaneGeometry(0.4, 0.135)), { m4: M4(2.262, 0.4, 0, 0, Math.PI / 2, 0) }));
      extraL.push(preparar(reg(new THREE.PlaneGeometry(0.4, 0.135)), { m4: M4(-2.262, 0.6, 0, 0, -Math.PI / 2, 0) }));
      pon(cajaR(0.012, 0.155, 0.43, 0.005, 1), M4(2.255, 0.4, 0), 0x151515);
      pon(cajaR(0.012, 0.155, 0.43, 0.005, 1), M4(-2.255, 0.6, 0), 0x151515);
      const auto = new THREE.Group();
      const mO = new THREE.Mesh(kit.mergeGeometries([aGeo(sal.opaco), ...extra]), matVC); mO.castShadow = true; mO.receiveShadow = true;
      const mV = new THREE.Mesh(aGeo(sal.vidrio), matVidrio); mV.renderOrder = 2;
      const mL = new THREE.Mesh(kit.mergeGeometries([aGeo(sal.luces), ...extraL]), matLuces); mL.receiveShadow = true;
      auto.add(mO, mV, mL);
      const sombra = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.3), matSombra); sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.01; sombra.renderOrder = 1; auto.add(sombra);
      const cabina = new THREE.Object3D(); cabina.position.set(-0.4, 1.1, 0); auto.add(cabina);
      auto.userData = { volante: { centro: VC, eje, rD: VC.clone().add(V(0, 0, 0.185)), rI: VC.clone().add(V(0, 0, -0.185)) }, cabina, recorrido: 0 };
      g.add(auto);
      return auto;
    }
    const matSombra = new THREE.MeshBasicMaterial({
      map: lienzo(128, 64, (x, w, h) => {
        const gr = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
        gr.addColorStop(0, 'rgba(0,0,0,0.7)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        x.save(); x.scale(1, h / w); x.fillStyle = gr; x.fillRect(0, 0, w, w); x.restore();
      }),
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6,
    });
    const autoA = crearAuto(0x9c1a1e, 0x3a3b3e, 0);
    const autoB = crearAuto(0x1d4b98, 0x6d6355, 1);
    autoB.rotation.y = -Math.PI / 2; // su frente (+x local) apunta al sur (+z)
    const autos = [autoA, autoB];

    // ruedas de los dos autos en una sola malla repetida: neumático, aro de cinco rayos y disco de freno
    const geoRueda = (() => {
      const partes = [];
      const p = (geo, m4, color, clase) => partes.push(preparar(geo, { m4, color: Col(color), clase }));
      const perfil = [[0.205, -0.098], [0.24, -0.106], [0.285, -0.104], [0.309, -0.094], [0.318, -0.072], [0.32, -0.035], [0.32, 0.035], [0.318, 0.072], [0.309, 0.094], [0.285, 0.104], [0.24, 0.106], [0.205, 0.098]];
      const neumatico = new THREE.LatheGeometry(perfil.map(([r2, y]) => new THREE.Vector2(r2, y)), 22); neumatico.rotateX(Math.PI / 2);
      colorear(neumatico, (x, y, z) => Col(Math.hypot(x, y) > 0.316 ? 0x171717 : Math.abs(z) > 0.09 && Math.hypot(x, y) < 0.3 ? 0x2a2a2a : 0x202020));
      partes.push(preparar(neumatico, { clase: 'goma' }));
      const barril = new THREE.CylinderGeometry(0.203, 0.203, 0.17, 22, 1, true); barril.rotateX(Math.PI / 2);
      p(invertir(barril), null, 0x6f7377, 'metal');
      const ceja = new THREE.TorusGeometry(0.197, 0.011, 4, 22); p(ceja, M4(0, 0, 0.086), 0xd2d6da, 'metal');
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; p(new THREE.BoxGeometry(0.045, 0.14, 0.024), M4(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0.074, 0, 0, a - Math.PI / 2), 0xcfd3d7, 'metal'); }
      p(new THREE.CylinderGeometry(0.066, 0.07, 0.04, 14), M4(0, 0, 0.074, Math.PI / 2, 0, 0), 0xc4c9cd, 'metal');
      p(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 10), M4(0, 0, 0.098, Math.PI / 2, 0, 0), 0x2b2d30, 'plastico');
      p(new THREE.CylinderGeometry(0.155, 0.155, 0.022, 18), M4(0, 0, -0.03, Math.PI / 2, 0, 0), 0x8a8d90, 'metal');
      p(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12), M4(0, 0, 0.0, Math.PI / 2, 0, 0), 0x5f6266, 'metal');
      return kit.mergeGeometries(partes);
    })();
    const ruedas = new THREE.InstancedMesh(geoRueda, matVC, 8);
    ruedas.castShadow = true; ruedas.receiveShadow = true; ruedas.frustumCulled = false; g.add(ruedas);
    const POS_RUEDAS = [[EJES[0], VIA], [EJES[0], -VIA], [EJES[1], VIA], [EJES[1], -VIA]];
    const mR = new THREE.Matrix4(), qR = new THREE.Quaternion(), qVuelta = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI), ejeZ = V(0, 0, 1);
    function ponerRuedas() {
      autos.forEach((a, ia) => {
        a.updateMatrix();
        POS_RUEDAS.forEach(([xe, ze], k) => {
          qR.setFromAxisAngle(ejeZ, -a.userData.recorrido / RRUEDA);
          if (ze < 0) qR.multiply(qVuelta);
          mR.compose(V(xe, RRUEDA, ze), qR, V(1, 1, 1)).premultiply(a.matrix);
          ruedas.setMatrixAt(ia * 4 + k, mR);
        });
      });
      ruedas.instanceMatrix.needsUpdate = true;
    }

    // ------------------------------------------------------------ personas
    g.updateMatrixWorld(true);
    const qG = g.getWorldQuaternion(new THREE.Quaternion());
    const aMundoDir = (v) => v.normalize().applyQuaternion(qG);
    // conductores: sentados al lado izquierdo, con las manos en el volante a las 9 y a las 3
    function conductor(auto, opc) {
      const k = opc.altura / 1.75;
      const h = kit.persona({ ...opc, padre: auto, x: XCAD + 0.07 * k, y: PISO, z: ZCOND, ry: Math.PI / 2 });
      h.transicion(0.01).posar('conducir', (ASIENTO_Y - PISO) / k);
      for (const m of h.mallas) { m.castShadow = false; if (m.name === 'persona-calzado') m.visible = false; }
      const vol = auto.userData.volante, haciaHombro = V(-0.93, 0.36, 0).normalize();
      const ancla = (p) => { const o = new THREE.Object3D(); o.position.copy(p); auto.add(o); return o; };
      const qA = auto.quaternion.clone().premultiply(qG);
      h.alcanzar('D', ancla(vol.rD.clone().addScaledVector(haciaHombro, 0.07)), V(-0.3, -1, 0.55).normalize().applyQuaternion(qA), 1);
      h.alcanzar('I', ancla(vol.rI.clone().addScaledVector(haciaHombro, 0.07)), V(-0.3, -1, -0.55).normalize().applyQuaternion(qA), 1);
      const adelante = ancla(V(40, 1.15, ZCOND));
      h.mirar(adelante);
      h.actualizar(0.02);
      return { h, auto, adelante, t: rnd() * 5, otro: false };
    }
    const condA = conductor(autoA, { preset: 'civil', semilla: 12, altura: 1.74, superior: 'camisa', colorSuperior: '#d9d3c4', manga: 'larga', barba: 'sombra', pelo: 'corto', colorPelo: kit.PELOS.castanoOscuro });
    const condB = conductor(autoB, { preset: 'civilMujer', semilla: 27, altura: 1.64, colorSuperior: '#7b2f3c', colorPelo: kit.PELOS.castanoClaro, piel: kit.PIELES[1], lentes: true });
    condA.otroAuto = autoB; condB.otroAuto = autoA;

    // al pie de la torre: una ingeniera vial mide con un radar la velocidad del auto A
    const PT = { x: 13.4, z: 6.3 }, yPT = suelo(PT.x, PT.z), ryPT = Math.atan2(-1, -0.12), kR = 1.7 / 1.75;
    const radarista = kit.persona({ preset: 'ingeniera', semilla: 9, altura: 1.7, piel: kit.PIELES[2], colorPelo: kit.PELOS.negro, colorSuperior: '#34485a', padre: g, x: PT.x, y: yPT, z: PT.z, ry: ryPT });
    radarista.transicion(0.01).posar({ ...kit.POSES.reposo(), musloI: [-0.14, 0, 0.07], piernaI: [0.08, 0, 0], pieI: [0.04, 0, -0.06], musloD: [0.1, 0, -0.07], pieD: [-0.08, 0, 0.06], columna: [0.04, 0.06, 0], dedosD: 0.85, dedosI: 0.6 });
    const pistola = (() => {
      const gr = new THREE.Group(), cuerpo = [];
      const p = (geo, m4, color, clase = 'plastico') => cuerpo.push(preparar(geo, { m4, color: Col(color), clase }));
      p(cajaR(0.034, 0.11, 0.045, 0.012, 1), M4(0, -0.01, -0.005, 0.28, 0, 0), 0x1b1b1b, 'goma');
      p(cajaR(0.072, 0.085, 0.21, 0.02, 2), M4(0, 0.075, 0.06), 0x30353a);
      p(new THREE.CylinderGeometry(0.05, 0.043, 0.075, 18), M4(0, 0.075, 0.2, Math.PI / 2, 0, 0), 0x25292d);
      p(new THREE.CylinderGeometry(0.044, 0.044, 0.004, 18), M4(0, 0.075, 0.239, Math.PI / 2, 0, 0), 0x6a737a, 'espejo');
      p(cajaR(0.012, 0.035, 0.02, 0.005, 1), M4(0, 0.01, 0.035, 0.3, 0, 0), 0xd4a21c);
      const m1 = new THREE.Mesh(kit.mergeGeometries(cuerpo), matVC); m1.castShadow = true;
      const pant = preparar(remapUV(new THREE.PlaneGeometry(0.056, 0.042), 386 / 512, 1 - 190 / 256, 124 / 512, 92 / 256), { m4: M4(0, 0.085, -0.046, 0, Math.PI, 0) });
      gr.add(m1, new THREE.Mesh(pant, matLuces));
      return gr;
    })();
    g.add(pistola);
    radarista.sostener(pistola, { D: [0, 0, 0], I: [0, 0.035, 0.14], arriba: [0, 1, 0] });
    const objRD = new THREE.Object3D(), objRI = new THREE.Object3D(); g.add(objRD, objRI);
    const derR = V(-Math.cos(ryPT), 0, Math.sin(ryPT));
    radarista.alcanzar('D', objRD, aMundoDir(derR.clone().multiplyScalar(0.8).add(V(0, -1, 0))), 1);
    radarista.alcanzar('I', objRI, aMundoDir(derR.clone().multiplyScalar(-0.5).add(V(0, -1, 0))), 1);
    const blancoA = new THREE.Object3D(); blancoA.position.set(0, 0.9, 0); autoA.add(blancoA);
    radarista.mirar(blancoA);
    function apuntarRadar() {
      const pecho = V(PT.x, yPT + 1.3 * kR, PT.z);
      const a = V(autoA.position.x, YR + 0.85, autoA.position.z).sub(pecho).normalize();
      const up = V(0, 1, 0).addScaledVector(a, -a.y).normalize();
      const fD = pecho.clone().addScaledVector(derR, 0.1).addScaledVector(a, 0.3).addScaledVector(up, -0.04);
      const fI = fD.clone().addScaledVector(a, 0.14 * Math.cos(0.245)).addScaledVector(up, -0.14 * Math.sin(0.245));
      objRD.position.copy(fD).addScaledVector(a, -0.075);
      objRI.position.copy(fI).addScaledVector(a, -0.06).addScaledVector(up, -0.03);
    }

    // banderillero con la paleta PARE en el tramo cerrado por obras, mirando hacia el cruce
    const PB = { x: 21.5, z: -4.25 }, ryB = -Math.PI / 2;
    const banderillero = kit.persona({ preset: 'obrero', semilla: 31, altura: 1.76, chaleco: 'naranjo', superior: 'parka', colorSuperior: '#28384c', guantes: '#c8b04a', barba: 'bigote', pelo: 'corto', piel: kit.PIELES[4], padre: g, x: PB.x, y: YR, z: PB.z, ry: ryB });
    const REPOSO_I = { brazoI: [0.06, 0, 0.07], antebrazoI: [-0.28, 0, 0], manoI: [0, 0, -0.1], dedosI: 0.22 };
    const ALTO_I = { brazoI: [-0.15, 1.5, 1.38], antebrazoI: [-0.2, 0, 0], manoI: [-0.25, 0, 0.55], dedosI: 0.03 };
    const ALTO_I2 = { brazoI: [-0.15, 1.5, 1.18], antebrazoI: [-0.35, 0, 0], manoI: [-0.25, 0, 0.6], dedosI: 0.03 };
    const CLIP_ALTO = { duracion: 7, bucle: true, claves: [
      { t: 0, pose: REPOSO_I }, { t: 2.4, pose: REPOSO_I }, { t: 3.1, pose: ALTO_I }, { t: 3.9, pose: ALTO_I2 }, { t: 4.6, pose: ALTO_I }, { t: 5.3, pose: ALTO_I2 }, { t: 6.1, pose: REPOSO_I }, { t: 7, pose: REPOSO_I },
    ] };
    banderillero.transicion(0.01).posar({ ...kit.POSES.reposo(), musloD: [0, 0, -0.07], pieD: [0, 0, 0.07], musloI: [0, 0, 0.07], pieI: [0, 0, -0.07], dedosD: 0.92, cuello: [0.04, 0, 0] });
    banderillero.reproducir(CLIP_ALTO, { bucle: true, desde: REV.g ?? 0, sinMezcla: REV.g !== undefined });
    const paleta = (() => {
      const gr = new THREE.Group(), vc = [];
      const p = (geo, m4, color, clase = 'plastico') => vc.push(preparar(geo, { m4, color: Col(color), clase }));
      p(new THREE.CylinderGeometry(0.017, 0.017, 1.72, 10), M4(0, 0.86, 0), 0xd6d9db, 'metal');
      p(new THREE.CylinderGeometry(0.021, 0.021, 0.3, 10), M4(0, 1.02, 0), 0x1a1a1a, 'goma');
      const borde = FORMAS.octogono(0.47).map(([a, b]) => new THREE.Vector2(a, b));
      const anillo = new THREE.Shape(borde); anillo.holes.push(new THREE.Path(FORMAS.octogono(0.45).map(([a, b]) => new THREE.Vector2(a, b))));
      p(new THREE.ExtrudeGeometry(anillo, { depth: 0.012, bevelEnabled: false }), M4(0, 1.94, -0.006), 0x1c1c1c);
      const m1 = new THREE.Mesh(kit.mergeGeometries(vc), matVC); m1.castShadow = true;
      const formas = FORMAS.octogono(0.45).map(([a, b]) => new THREE.Vector2(a, b));
      const caras = kit.mergeGeometries([
        preparar(celdaUV(new THREE.ShapeGeometry(new THREE.Shape(formas)), 'pare', 0.45), { m4: M4(0, 1.94, 0.004) }),
        preparar(celdaUV(new THREE.ShapeGeometry(new THREE.Shape(formas)), 'siga', 0.45), { m4: M4(0, 1.94, -0.004, 0, Math.PI, 0) }),
      ]);
      const m2 = new THREE.Mesh(caras, matSenales); m2.castShadow = true;
      gr.add(m1, m2);
      return gr;
    })();
    paleta.rotation.y = ryB; g.add(paleta);
    const kB = 1.76 / 1.75;
    const objBD = new THREE.Object3D(); objBD.position.set(PB.x - 0.21 * kB, YR + 1.0 * kB, PB.z - 0.25 * kB); g.add(objBD);
    banderillero.alcanzar('D', objBD, aMundoDir(V(0.3, -0.8, -1)), 1);
    banderillero.mirar(blancoA);
    const vF = V();
    function seguirPaleta() { banderillero.manoD.getWorldPosition(vF); g.worldToLocal(vF); paleta.position.set(vF.x, YR, vF.z); }

    // ------------------------------------------------------------ cotas y rótulos (solo con la estación activa)
    const capa = new THREE.Group(); g.add(capa);
    const matCota = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    const cotaX = kit.barra([0, 0, 0], [0, 1, 0], 0.15, matCota(0xffb347), 10);
    const cotaY = kit.barra([0, 0, 0], [0, 1, 0], 0.15, matCota(0x5cc8ff), 10);
    const cotaS = kit.barra([0, 0, 0], [0, 1, 0], 0.15, matCota(0x6fe3a2), 10);
    for (const b of [cotaX, cotaY, cotaS]) { b.castShadow = false; capa.add(b); }
    const triGeo = new THREE.BufferGeometry();
    triGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    const tri = new THREE.Mesh(triGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    tri.renderOrder = 3; tri.frustumCulled = false; capa.add(tri);
    kit.malla(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide }), { rx: -Math.PI / 2, x: O.x, y: YR + 0.03, z: O.z, sombra: false, recibe: false, padre: capa });
    const rot = {
      x: kit.etiqueta('x', 0.5, { bg: '#ffb347', color: '#1a1206' }),
      y: kit.etiqueta('y', 0.5, { bg: '#5cc8ff', color: '#08202c' }),
      s: kit.etiqueta('s', 0.5, { bg: '#6fe3a2', color: '#0b1a12' }),
      a: kit.etiqueta('Auto A · 90 km/h al este', 0.5, { bg: '#c4302b', color: '#ffffff' }),
      b: kit.etiqueta('Auto B · 60 km/h al sur', 0.5, { bg: '#2c5fc0', color: '#ffffff' }),
      o: kit.etiqueta('cruce', 0.5),
    };
    const anclas = { x: [0, 0.5, 0], y: [0, 0.5, 0], s: [0, 1.9, 0], a: [0, 1.75, 0], b: [0, 1.75, 0], o: [O.x, YR + 0.4, O.z] };
    for (const l of Object.values(rot)) capa.add(l);

    function construir() {
      const t = reloj.t, xm = M.x(t) * 1000, ym = M.y(t) * 1000;
      const ax = O.x - xm, bz = O.z - ym;
      autoA.position.set(ax, YR, O.z); autoA.userData.recorrido = ax;
      autoB.position.set(O.x, YR, bz); autoB.userData.recorrido = bz;
      ponerRuedas();
      const yc = YR + 0.08, ys = 1.75;
      kit.moverBarra(cotaX, [ax, yc, O.z], [O.x, yc, O.z]);
      kit.moverBarra(cotaY, [O.x, yc, bz], [O.x, yc, O.z]);
      kit.moverBarra(cotaS, [ax, ys, O.z], [O.x, ys, bz]);
      const p = triGeo.attributes.position;
      p.setXYZ(0, O.x, YR + 0.04, O.z); p.setXYZ(1, ax, YR + 0.04, O.z); p.setXYZ(2, O.x, YR + 0.04, bz); p.needsUpdate = true;
      kit.cambiarEtiqueta(rot.x, `x = ${kit.num(xm, 0)} m`);
      kit.cambiarEtiqueta(rot.y, `y = ${kit.num(ym, 0)} m`);
      kit.cambiarEtiqueta(rot.s, `s = ${kit.num(M.s(t) * 1000, 0)} m`);
      anclas.x[0] = (ax + O.x) / 2; anclas.x[2] = O.z + 2.5;
      anclas.y[0] = O.x + 2.5; anclas.y[2] = (bz + O.z) / 2; // del lado del camino que no da al gráfico de VR
      anclas.s[0] = (ax + O.x) / 2; anclas.s[2] = (O.z + bz) / 2;
      anclas.a[0] = ax; anclas.a[2] = O.z;
      anclas.b[0] = O.x; anclas.b[2] = bz;
      // cerca del cruce las cotas son más cortas que sus rótulos y se juntarían con los de los autos y el cruce
      rot.x.visible = xm > 30; rot.y.visible = ym > 30; rot.s.visible = M.s(t) * 1000 > 40;
      rot.o.visible = xm > 40 && ym > 40;
    }
    // los rótulos conservan un tamaño aparente legible a cualquier distancia
    const cam = V();
    function escalarRotulos() {
      for (const [k, l] of Object.entries(rot)) {
        const a = anclas[k];
        const d = Math.hypot(a[0] - cam.x, a[1] - cam.y, a[2] - cam.z);
        const alto = Math.min(7, Math.max(0.32, d * 0.026));
        l.userData.alto = alto;
        l.scale.setScalar(alto / l.userData.size[1]);
        l.position.set(a[0], a[1] + alto * (k === 'a' || k === 'b' ? 1.0 : 0.6), a[2]); // los rótulos de los autos van más altos que las cotas del suelo
      }
    }

    // ------------------------------------------------------------ gráfico s(t)
    const graf = kit.grafico({
      f: (t) => M.s(t), x0: T0, x1: T1, y0: 0, y1: 0.4, width: 1.3, height: 0.8,
      xTicks: [-0.001, 0, 0.001, 0.002], yTicks: [0, 0.1, 0.2, 0.3, 0.4],
      tickFmt: (v) => (v === 0 ? '0' : kit.num(v, 3)), yTickFmt: (v) => kit.num(v, 1),
      xLabel: 'tiempo t (h)', yLabel: 'distancia s (km)', curveColor: 0x6fe3a2,
    });
    g.add(graf.group);
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => reloj.fijar(graf.xFromLocal(p.x)) });
    function revelar() {
      graf.removePoint('inst');
      if (s.revelar) graf.addPoint('inst', 0, M.s(0), { color: 0x6fe3a2, labelX: 't = 0', labelY: 's = 0,25' });
      s.ultimo = -1;
    }

    // ------------------------------------------------------------ panel
    const fmtD = (km) => `${kit.num(km, 3)} km · ${kit.num(km * 1000, 0)} m`;
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'El auto A viaja al este a 90 km/h y el B al sur a 60 km/h, ambos hacia el cruce. Interesa el instante en que A está a 0,2 km y B a 0,15 km del cruce.',
      ecuaciones: ['s² = x² + y²   ⇒   s·ds/dt = x·dx/dt + y·dy/dt', 'dx/dt = −90 km/h,   dy/dt = −60 km/h (x e y disminuyen)'],
      lecturas: [
        { etiqueta: 'x: A al cruce', valor: () => fmtD(M.x(reloj.t)), color: '#ffb347', escala: 0.56 },
        { etiqueta: 'y: B al cruce', valor: () => fmtD(M.y(reloj.t)), color: '#5cc8ff', escala: 0.56 },
        { etiqueta: 's: entre los autos', valor: () => fmtD(M.s(reloj.t)), color: '#6fe3a2', escala: 0.56 },
        { etiqueta: 'dx/dt', valor: () => `${kit.num(M.vx, 0)} km/h`, color: '#ffb347', escala: 0.7 },
        { etiqueta: 'dy/dt', valor: () => `${kit.num(M.vy, 0)} km/h`, color: '#5cc8ff', escala: 0.7 },
        { etiqueta: 'ds/dt', valor: () => (s.revelar ? `${kit.num(M.dsdt(reloj.t), 1)} km/h` : OCULTO), color: '#6fe3a2', escala: 0.7 },
      ],
      deslizadores: [
        { etiqueta: 'Tiempo t', min: T0, max: T1, paso: 0.00001, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 5)} h · ${kit.num(v * 3600, 1)} s` },
        { etiqueta: 'Velocidad de la animación', min: 0.1, max: 2, paso: 0.05, color: '#ffb347', get: () => reloj.velocidad * 3600, set: (v) => { reloj.velocidad = v / 3600; }, formato: (v) => `${kit.num(v, 2)}× el tiempo real` },
      ],
      botones: [
        { etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() },
        { etiqueta: 'Ir al instante (t = 0)', accion: () => reloj.alInstante() },
        { etiqueta: 'Revelar respuesta', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      pie: () => (s.revelar
        ? 'En t = 0: s = √(0,2² + 0,15²) = 0,25 km y 0,25·ds/dt = 0,2·(−90) + 0,15·(−60) = −27, de modo que ds/dt = −108 km/h: los autos se acercan a 108 km/h.'
        : 'Las distancias x e y disminuyen, por eso sus derivadas son negativas. La pendiente de la curva s(t) es ds/dt; compárala en el instante t = 0.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    // Persona en lo alto de la torre, mirando al noroeste (hacia el cruce y los dos caminos).
    // Se ubica junto a la esquina delantera para que la plataforma no tape el cruce. El panel queda a la
    // izquierda y el gráfico a la derecha, por fuera de la baranda y de las visuales hacia los autos.
    const VR = { x: 8.3, z: 8.3, yaw: Math.PI / 4 };
    {
      const f = V(-Math.sin(VR.yaw), 0, -Math.cos(VR.yaw)), r = V(Math.cos(VR.yaw), 0, -Math.sin(VR.yaw));
      const ang = (72 * Math.PI) / 180, dist = 1.7;
      const pp = V(VR.x, 0, VR.z).addScaledVector(f, dist * Math.cos(ang)).addScaledVector(r, -dist * Math.sin(ang));
      panel.mesh.position.set(pp.x, y0T + PLAT.y + 1.38, pp.z);
      panel.mesh.rotation.y = Math.atan2(VR.x - pp.x, VR.z - pp.z);
      const pg = V(VR.x, 0, VR.z).addScaledVector(f, dist * Math.cos(ang)).addScaledVector(r, dist * Math.sin(ang));
      const psi = Math.atan2(VR.x - pg.x, VR.z - pg.z), ex = V(Math.cos(psi), 0, -Math.sin(psi));
      graf.group.position.set(pg.x - (ex.x * graf.width) / 2, y0T + PLAT.y + 1.05, pg.z - (ex.z * graf.width) / 2);
      graf.group.rotation.y = psi;
    }

    // En realidad virtual la persona queda de pie sobre la plataforma mientras esté dentro de ella.
    const tmp = V();
    kit.app.onUpdate(() => {
      const activa = est.activa?.() ?? false;
      if (capa.visible !== activa) capa.visible = activa;
      if (!kit.app.isXR) return;
      const rig = kit.rig;
      const p = g.worldToLocal(tmp.copy(rig.position));
      const dentro = p.x > PLAT.x0 && p.x < PLAT.x1 && p.z > PLAT.z0 && p.z < PLAT.z1;
      const yPlat = g.position.y + y0T + PLAT.y;
      if (dentro && activa && Math.abs(rig.position.y - yPlat) > 0.01) rig.position.y = yPlat;
      else if (!dentro && p.y > 1 && Math.abs(p.x) < 60 && Math.abs(p.z) < 60) rig.position.y = kit.sueloH(rig.position.x, rig.position.z);
    });

    if (REV.t !== undefined) reloj.fijar(REV.t);
    construir();
    apuntarRadar();
    // la piel solo asoma en la cara y el cuello: su sombra no se nota y es la malla más pesada
    for (const h of [radarista, banderillero]) { for (const m of h.mallas) if (m.name === 'persona-piel') m.castShadow = false; h.actualizar(0.02); }
    seguirPaleta();
    const vA = V();
    function animarPersonas(dt) {
      for (const c of [condA, condB]) {
        c.auto.getWorldPosition(vA); g.worldToLocal(vA);
        const ver = vA.distanceTo(cam) < LEJOS;
        if (c.h.grupo.visible !== ver) c.h.grupo.visible = ver;
        if (!ver) continue;
        c.t += dt;
        const otro = c.t % 9 > 7.3; // de vez en cuando mira hacia el otro auto
        if (otro !== c.otro) { c.otro = otro; c.h.mirar(otro ? c.otroAuto.userData.cabina : c.adelante); }
        c.h.actualizar(dt);
      }
      apuntarRadar();
      radarista.actualizar(dt);
      banderillero.actualizar(REV.g !== undefined ? 0 : dt);
      seguirPaleta();
    }

    return {
      paneles: [panel],
      radioSombra: 34,
      // desde la torre los caminos llegan por abajo a ambos lados: en VR el panel y el gráfico van casi a los costados
      laminaVR: { angulo: 70, altura: 1.22 },
      radioVisible: 450,
      alturaCartel: 14,
      vista: {
        escritorio: { camara: [33, 12, 7], objetivo: [-40, 0, -36] },
        vr: { pos: [VR.x, PLAT.y, VR.z], yaw: VR.yaw },
      },
      dom: [
        { tipo: 'boton', etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() },
        { tipo: 'rango', etiqueta: 't', min: T0, max: T1, paso: 0.00001, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v * 3600, 1)} s` },
        { tipo: 'boton', etiqueta: 'Ir al instante (t = 0)', accion: () => reloj.alInstante() },
        { tipo: 'interruptor', etiqueta: 'Revelar respuesta', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      actualizar(dt, activa) {
        if (activa && REV.t === undefined) reloj.tick(dt);
        if (s.ultimo !== reloj.cambio) {
          s.ultimo = reloj.cambio;
          construir();
          graf.setMarker(reloj.t);
          graf.setTangent(reloj.t, M.dsdt(reloj.t), { color: 0xffd08a, len: 0.4 });
          panel.invalidate();
        }
        kit.camera.getWorldPosition(cam); g.worldToLocal(cam);
        if (activa) escalarRotulos();
        animarPersonas(dt);
      },
    };
  },
};
