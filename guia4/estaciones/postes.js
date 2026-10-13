// Ejercicio 1.6. Dos postes de 12 y 28 pies, a 30 pies de distancia, sostenidos por dos cables
// que bajan desde lo alto de cada poste hasta una sola estaca clavada en el pasto.
// Un obrero lleva el combo hasta la estaca cada vez que cambia de lugar, la asienta con dos golpes y, hincado,
// revisa los cables. Una topógrafa sigue la estaca con una estación total robótica y su controlador.
import { POSTES as M } from '../../src/math/guia4.js';

const PIE = 0.3048; // metros por pie
const YOJO = 0.23; // altura del ojo de la estaca
const Z_OBRERO = -0.95; // el obrero trabaja detrás de la línea de los postes

// Parámetro de revisión: rev=x:9,clavar:0.8,caminar:0.3,mira:1,revelar fija la estaca, congela una animación, la mirada o revela.
const REV = (() => {
  const r = {};
  try {
    for (const p of (new URLSearchParams(location.search).get('rev') || '').split(',')) {
      const [k, v] = p.split(':');
      if (k) r[k] = v === undefined ? true : Number(v);
    }
  } catch { /* sin dirección */ }
  return r;
})();

// ------------------------------------------------------------ poses del obrero con el combo y de la topógrafa
// El combo va en las dos manos: la izquierda en la culata y la derecha 13 cm más arriba. Los objetivos de las manos
// (ikD, ikI) y la altura de la cadera están ajustados para que los pies y la rodilla toquen el suelo y la cabeza del
// combo quede apoyada en el suelo, sobre el hombro o sobre la estaca.
const PUNO = { dedosD: 0.95, dedosI: 0.95 };
const PIERNAS = { musloD: [-0.08, 0, -0.12], piernaD: [0.2, 0, 0], pieD: [-0.12, 0, 0.12], musloI: [-0.08, 0, 0.12], piernaI: [0.2, 0, 0], pieI: [-0.12, 0, -0.12], ...PUNO };
const MANOS_HOMBRO = { ikD: { p: [-0.172, 1.16, 0.261], polo: [-0.6, -1, 0.1] }, ikI: { p: [-0.022, 1.085, 0.333], polo: [0.6, -0.8, 0.2] } };
const POSE = {
  hincado: {
    _pos: [0, -0.443, 0], columna: [0.18, 0, 0], pecho: [0.08, 0, 0],
    musloD: [-0.1, 0, -0.08], piernaD: [1.75, 0, 0], pieD: [0.72, 0, 0.05], musloI: [-1.6, 0, 0.1], piernaI: [1.6, 0, 0], pieI: [0, 0, -0.05], ...PUNO,
    ikD: { p: [-0.188, 0.712, 0.38], polo: [-1, -0.5, 0] }, ikI: { p: [-0.049, 0.809, 0.377], polo: [1, -0.6, -0.2] },
  },
  hombro: {
    columna: [0.02, 0, 0], pecho: [-0.03, 0, 0], musloD: [0, 0, -0.03], piernaD: [0.025, 0, 0], pieD: [-0.02, 0, 0.03],
    musloI: [0, 0, 0.03], piernaI: [0.025, 0, 0], pieI: [-0.02, 0, -0.03], ...PUNO, ...MANOS_HOMBRO,
  },
  listo: { ...PIERNAS, _pos: [0, -0.015, 0], columna: [0.02, 0, 0], pecho: [-0.03, 0, 0], ...MANOS_HOMBRO },
  arriba: {
    ...PIERNAS, _pos: [0, -0.013, 0], cadera: [0.04, -0.15, 0], columna: [-0.05, -0.15, 0], pecho: [-0.06, -0.12, 0.05],
    ikD: { p: [-0.227, 1.25, 0.257], polo: [-1, -0.5, 0] }, ikI: { p: [-0.065, 1.137, 0.352], polo: [0.5, -1, 0.3] },
  },
  medio: {
    ...PIERNAS, _pos: [0, -0.015, 0], cadera: [0.2, -0.05, 0], columna: [0.1, -0.04, 0], pecho: [0.03, 0, 0],
    ikD: { p: [-0.14, 1.07, 0.313], polo: [-1, -0.7, -0.2] }, ikI: { p: [0.004, 0.998, 0.223], polo: [0.7, -1, 0] },
  },
  golpe: {
    ...PIERNAS, _pos: [0, -0.017, 0], cadera: [0.32, 0, 0], columna: [0.2, 0, 0], pecho: [0.08, 0, 0], cuello: [0.1, 0, 0],
    ikD: { p: [-0.043, 0.748, 0.451], polo: [-1, -0.6, -0.3] }, ikI: { p: [0.038, 0.891, 0.322], polo: [1, -0.6, -0.3] },
  },
  controlador: {
    musloD: [0, 0, -0.04], pieD: [0, 0, 0.04], musloI: [0, 0, 0.04], pieI: [0, 0, -0.04], cuello: [0.15, 0, 0], dedosD: 0.55, dedosI: 0.55,
    ikD: { p: [-0.172, 1.099, 0.287], polo: [-0.5, -1, -0.2] }, ikI: { p: [0.172, 1.099, 0.287], polo: [0.5, -1, -0.2] },
  },
};
// Dos golpes de combo sobre la estaca, que queda 0,95 m delante del obrero
const CLAVAR = {
  duracion: 2.35, eventos: { golpe1: 0.8, golpe2: 1.7 },
  claves: [
    { t: 0, pose: POSE.listo }, { t: 0.42, pose: POSE.arriba }, { t: 0.64, pose: POSE.medio }, { t: 0.8, pose: POSE.golpe },
    { t: 0.98, pose: POSE.golpe }, { t: 1.32, pose: POSE.arriba }, { t: 1.54, pose: POSE.medio }, { t: 1.7, pose: POSE.golpe },
    { t: 2.35, pose: POSE.golpe },
  ],
};

// Clases de superficie del material mixto: [rugosidad, metalicidad]. Se leen de una textura por el canal uv1.
const CLASES = {
  galv: [0.42, 0.85], acero: [0.5, 0.75], oxido: [0.85, 0.3], pintura: [0.5, 0.04], plastico: [0.55, 0], goma: [0.92, 0],
  cobre: [0.36, 0.9], vidrio: [0.06, 0.3], porcelana: [0.13, 0], piedra: [0.93, 0], madera: [0.72, 0], reflectante: [0.22, 0.35],
  aluminio: [0.32, 0.82], pantalla: [0.12, 0.2],
};
const NOMBRES = Object.keys(CLASES);

export default {
  id: 'postes',
  tipo: 'optimizacion',
  etiqueta: 'Ejercicio 1.6 · Optimización',
  titulo: 'Cable mínimo entre dos postes',
  resumen: 'Dos postes, uno de 12 pies de altura y otro de 28 pies, están a 30 pies de distancia. Se sostienen con dos cables conectados a una sola estaca, desde el nivel del suelo hasta la parte superior de cada poste. ¿Dónde debe colocarse la estaca para usar la menor cantidad de cable posible?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const s = { x: Number.isFinite(REV.x) ? Math.min(M.d, Math.max(0, REV.x)) : 4, revelar: !!REV.revelar, cambio: true, movida: 0 };
    const X1 = (-M.d / 2) * PIE, X2 = (M.d / 2) * PIE, H1 = M.h1 * PIE, H2 = M.h2 * PIE;
    const xm = (x) => X1 + x * PIE; // posición de la estaca en metros
    const enM = (pies, d = 2) => `${kit.num(pies * PIE, d)} m`;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const Y = V(0, 1, 0);
    const rnd = kit.mulberry32(1206);
    const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const texDe = (c, color = true) => { const t = new THREE.CanvasTexture(c); if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    // rótulos de la escena: se dibujan antes que el panel y el gráfico para que estos los tapen
    const etq = (texto, alto, opts) => {
      const l = kit.etiqueta(texto, alto, opts);
      l.renderOrder = 3; l.material.depthWrite = true; l.material.alphaTest = 0.5; // escriben profundidad: lo lejano no los tapa
      return l;
    };

    // ------------------------------------------------------------ utilidades de geometría
    const qT = new THREE.Quaternion(), eT = new THREE.Euler();
    const mat4 = ({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s: e = 1, sx = e, sy = e, sz = e, orden = 'XYZ' } = {}) =>
      new THREE.Matrix4().compose(V(x, y, z), qT.setFromEuler(eT.set(rx, ry, rz, orden)), V(sx, sy, sz));
    // lleva el eje y de una pieza centrada al tramo de a hasta b; con estirar, una pieza de alto 1 toma el largo del tramo
    const entre = (a, b, estirar = true) => {
      const A = V(...a), d = V(...b).sub(A), L = d.length();
      return new THREE.Matrix4().compose(A.addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), V(1, estirar ? L : 1, 1));
    };
    const cT = new THREE.Color();
    // color por vértice y clase de superficie (uv1) para los materiales con colores de vértice
    function pintar(geo, color = 0xffffff, clase = 'pintura') {
      const p = geo.attributes.position, n = p.count;
      if (!geo.index) geo.setIndex([...Array(n).keys()]);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const c = new Float32Array(n * 3), u1 = new Float32Array(n * 2);
      const fija = typeof color === 'function' ? null : new THREE.Color(color);
      const kFija = typeof clase === 'function' ? null : (NOMBRES.indexOf(clase) + 0.5) / 16;
      for (let i = 0; i < n; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const cc = fija || color(x, y, z, cT.set(0xffffff));
        c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b;
        u1[i * 2] = kFija ?? (NOMBRES.indexOf(clase(x, y, z)) + 0.5) / 16; u1[i * 2 + 1] = 0.5;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      geo.setAttribute('uv1', new THREE.BufferAttribute(u1, 2));
      return geo;
    }
    // reúne piezas estáticas que comparten material en una sola malla
    function lote() {
      const piezas = [];
      return {
        piezas,
        add(geo, { m = null, color = 0xffffff, clase = 'pintura', ...o } = {}) {
          pintar(geo, color, clase);
          geo.applyMatrix4(m || mat4(o));
          piezas.push(geo);
          return geo;
        },
        unir(material, opts = {}) {
          const geo = kit.mergeGeometries(piezas, false);
          for (const p of piezas) p.dispose();
          return kit.malla(geo, material, { padre: g, ...opts });
        },
      };
    }
    // malla única cuyas piezas se reubican solo cuando cambia la escena (cables, cotas)
    function dinamica(piezas, material, padre = g) {
      const geo = kit.mergeGeometries(piezas, false);
      const pos = geo.attributes.position, nor = geo.attributes.normal;
      pos.setUsage(THREE.DynamicDrawUsage); nor.setUsage(THREE.DynamicDrawUsage);
      const rangos = [];
      let off = 0;
      for (const p of piezas) {
        const n = p.attributes.position.count;
        rangos.push({ off, n, P: p.attributes.position.array.slice(), N: p.attributes.normal.array.slice() });
        off += n; p.dispose();
      }
      const malla = kit.malla(geo, material, { padre });
      const v = V(), nm = new THREE.Matrix3();
      return {
        malla,
        poner(i, m) {
          const r = rangos[i];
          nm.getNormalMatrix(m);
          for (let k = 0; k < r.n; k++) {
            v.fromArray(r.P, k * 3).applyMatrix4(m).toArray(pos.array, (r.off + k) * 3);
            v.fromArray(r.N, k * 3).applyMatrix3(nm).normalize().toArray(nor.array, (r.off + k) * 3);
          }
        },
        ocultar(i, en = [0, 0, 0]) { const r = rangos[i]; for (let k = 0; k < r.n; k++) pos.array.set(en, (r.off + k) * 3); },
        listo() { pos.needsUpdate = true; nor.needsUpdate = true; geo.computeBoundingSphere(); },
      };
    }
    // caja con aristas redondeadas a lo largo de z (crucetas, cajas, tableros)
    function cajaRedondeada(w, h, d, r = 0.006, curva = 2) {
      const sh = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2;
      sh.moveTo(x0 + r, y0); sh.lineTo(x0 + w - r, y0); sh.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
      sh.lineTo(x0 + w, y0 + h - r); sh.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
      sh.lineTo(x0 + r, y0 + h); sh.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
      sh.lineTo(x0, y0 + r); sh.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: curva });
      geo.translate(0, 0, -d / 2);
      return geo;
    }
    const tuerca = (r = 0.016, h = 0.014) => new THREE.CylinderGeometry(r, r, h, 6);

    // ------------------------------------------------------------ texturas
    const S = 256;
    const muestra = (a, x, y) => a[((((y | 0) % S) + S) % S) * S + ((((x | 0) % S) + S) % S)];
    function normalDesde(alt, N, fuerza) {
      const [c, x] = lienzo(N, N), img = x.createImageData(N, N), d = img.data;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const h = (a, b) => alt[((b + N) % N) * N + ((a + N) % N)];
        let nx = (h(i - 1, j) - h(i + 1, j)) * fuerza, ny = (h(i, j + 1) - h(i, j - 1)) * fuerza;
        const l = Math.hypot(nx, ny, 1); nx /= l; ny /= l;
        const k = (j * N + i) * 4;
        d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      return c;
    }
    // madera: mitad izquierda = fibra de poste curtida y agrietada (repite en v), mitad derecha = tablas de pino
    function texturasMadera() {
      const N = 512, ruido = kit.fbm(S, 6, 4, 77), fino = kit.fbm(S, 40, 2, 79), manchas = kit.fbm(S, 3, 3, 83);
      const alt = new Float32Array(N * N), col = new Float32Array(N * N * 3);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        let r, gg, b, h;
        if (x < 256) {
          const fib = 0.5 + 0.5 * Math.sin(x * 0.37 + muestra(ruido, x, y * 0.08) * 9);
          const v = 0.74 + 0.16 * fib + 0.2 * (muestra(fino, x, y * 0.12) - 0.5) + 0.3 * (muestra(manchas, x, y * 0.5) - 0.5);
          r = 124 * v; gg = 104 * v; b = 84 * v; h = 0.5 + 0.22 * fib + 0.18 * muestra(fino, x, y * 0.12);
        } else {
          const xx = x - 256, t = Math.floor(xx / 64), junta = xx % 64 < 2 || xx % 64 > 61;
          const fib = 0.5 + 0.5 * Math.sin(xx * 0.28 + muestra(ruido, xx + t * 50, y * 0.1) * 12);
          const v = (0.8 + 0.15 * fib + 0.14 * (muestra(fino, xx, y * 0.2) - 0.5) + 0.12 * (muestra(manchas, xx, y) - 0.5)) * [1, 0.9, 1.07, 0.95][t];
          r = 176 * v; gg = 134 * v; b = 88 * v; h = junta ? 0 : 0.55 + 0.2 * fib;
          if (junta) { r *= 0.35; gg *= 0.32; b *= 0.3; }
        }
        alt[i] = h; col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
      }
      const r2 = kit.mulberry32(907);
      // grietas largas del poste (secado al sol)
      for (let n = 0; n < 30; n++) {
        const x0 = r2() * 256, y0 = r2() * N, L = 50 + r2() * 400, a = 0.6 + r2() * 1.5, f = r2() * 9;
        for (let k = 0; k < L; k++) {
          const yy = Math.floor(y0 + k) % N, w = a * Math.sin((Math.PI * k) / L);
          const xc = x0 + Math.sin((k + f * 40) * 0.02) * 2.5;
          for (let dx = -2; dx <= 2; dx++) {
            const xx = ((Math.round(xc) + dx) % 256 + 256) % 256, i = yy * N + xx, e = Math.max(0, 1 - Math.abs(xc - Math.round(xc) - dx) / (w + 0.3));
            if (e <= 0) continue;
            alt[i] -= 0.5 * e; for (let c = 0; c < 3; c++) col[i * 3 + c] *= 1 - 0.6 * e;
          }
        }
      }
      // nudos
      for (let n = 0; n < 5; n++) {
        const cx = r2() * 256, cy = r2() * N, rx = 3 + r2() * 4, ry = rx * (2 + r2() * 2);
        for (let y = -ry * 2; y <= ry * 2; y++) for (let x = -rx * 2; x <= rx * 2; x++) {
          const d = Math.hypot(x / rx, y / ry); if (d > 2) continue;
          const xx = ((Math.round(cx + x) % 256) + 256) % 256, yy = ((Math.round(cy + y) % N) + N) % N, i = yy * N + xx;
          const e = d < 1 ? 0.5 : 0.18 * (2 - d);
          for (let c = 0; c < 3; c++) col[i * 3 + c] *= 1 - e;
          alt[i] += d < 1 ? 0.15 : 0;
        }
      }
      const [c, x] = lienzo(N, N), img = x.createImageData(N, N);
      for (let i = 0; i < N * N; i++) { img.data[i * 4] = col[i * 3]; img.data[i * 4 + 1] = col[i * 3 + 1]; img.data[i * 4 + 2] = col[i * 3 + 2]; img.data[i * 4 + 3] = 255; }
      x.putImageData(img, 0, 0);
      const map = texDe(c), normalMap = texDe(normalDesde(alt, N, 2.2), false);
      for (const t of [map, normalMap]) { t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; }
      return { map, normalMap };
    }
    // mugre gris suave para el material mixto
    function texturaMugre() {
      const a = kit.fbm(S, 6, 4, 301), b = kit.fbm(S, 24, 2, 303);
      const [c, x] = lienzo(S, S), img = x.createImageData(S, S);
      for (let i = 0; i < S * S; i++) {
        const v = 255 * Math.min(1, 0.8 + 0.22 * a[i] + 0.1 * (b[i] - 0.5) - 0.18 * Math.max(0, a[i] - 0.7) * 3);
        img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.985; img.data[i * 4 + 2] = v * 0.96; img.data[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      const t = texDe(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    }
    function texturaClases() {
      const [c, x] = lienzo(16, 1);
      NOMBRES.forEach((k, i) => { const [r, m] = CLASES[k]; x.fillStyle = `rgb(0,${Math.round(r * 255)},${Math.round(m * 255)})`; x.fillRect(i, 0, 1, 1); });
      const t = new THREE.CanvasTexture(c);
      t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.channel = 1;
      return t;
    }
    // Atlas de 512 px con letreros, placas, cinta de peligro, pantalla del controlador y etiqueta del carrete
    const ATLAS = {
      atencion: [0, 0, 256, 256], peligro: [256, 0, 256, 256], placa1: [0, 256, 96, 132], placa2: [96, 256, 96, 132],
      oscuro: [196, 260, 56, 56], chapa: [196, 324, 56, 56], cinta: [256, 256, 256, 48], pantalla: [256, 320, 160, 112],
      rotulo: [420, 320, 88, 64], tierra: [0, 392, 192, 120],
    };
    function texturaAtlas() {
      const [c, x] = lienzo(512, 512), F = kit.font;
      const caja = ([a, b, w, h], color) => { x.fillStyle = color; x.fillRect(a, b, w, h); };
      const texto = (t, px, py, size, color = '#111', peso = 800, alin = 'center') => { x.fillStyle = color; x.font = F(size, peso); x.textAlign = alin; x.textBaseline = 'middle'; x.fillText(t, px, py); };
      // letrero de atención: casco obligatorio
      caja(ATLAS.atencion, '#f4c51c');
      x.lineWidth = 8; x.strokeStyle = '#151515'; x.strokeRect(6, 6, 244, 244);
      texto('ATENCIÓN', 128, 38, 34);
      caja([14, 62, 228, 4], '#151515');
      x.fillStyle = '#1f5fae'; x.beginPath(); x.arc(128, 128, 52, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(128, 136, 30, Math.PI, 0); x.fill(); x.fillRect(90, 134, 76, 9); x.fillRect(124, 100, 8, 10);
      x.beginPath(); x.ellipse(128, 160, 22, 9, 0, 0, Math.PI); x.fill();
      texto('ZONA DE TRABAJO', 128, 198, 22);
      texto('USO OBLIGATORIO DE', 128, 222, 16, '#151515', 700);
      texto('CASCO Y CHALECO', 128, 240, 16, '#151515', 700);
      // letrero de peligro: cables tensados
      caja(ATLAS.peligro, '#f6f6f2');
      caja([256, 0, 256, 64], '#c8201e');
      texto('PELIGRO', 384, 34, 40, '#ffffff');
      x.lineWidth = 6; x.strokeStyle = '#c8201e'; x.strokeRect(259, 3, 250, 250);
      x.fillStyle = '#f4c51c'; x.strokeStyle = '#151515'; x.lineWidth = 6; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(384, 78); x.lineTo(434, 162); x.lineTo(334, 162); x.closePath(); x.fill(); x.stroke();
      texto('!', 384, 136, 54, '#151515', 900);
      texto('CABLES TENSADOS', 384, 190, 24);
      texto('NO PASAR BAJO', 384, 216, 18, '#151515', 700);
      texto('LOS TIRANTES', 384, 236, 18, '#151515', 700);
      // placas de numeración de los postes
      for (const [k, n] of [['placa1', '1043'], ['placa2', '1044']]) {
        const [a, b, w, h] = ATLAS[k];
        caja(ATLAS[k], '#c6cacd');
        x.lineWidth = 5; x.strokeStyle = '#4a5058'; x.strokeRect(a + 5, b + 5, w - 10, h - 10);
        texto('POSTE', a + w / 2, b + 30, 18, '#1b1f24', 700);
        texto(n, a + w / 2, b + 70, 30, '#1b1f24', 800);
        caja([a + 16, b + 98, w - 32, 10], '#c0392b');
      }
      caja(ATLAS.oscuro, '#2b2e31');
      caja(ATLAS.chapa, '#9da3a8');
      for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(60,60,60,${0.05 + 0.08 * Math.random()})`; x.fillRect(196 + Math.random() * 56, 324, 1 + Math.random() * 2, 56); }
      // cinta de peligro amarilla y negra
      const [ca, cb, cw, ch] = ATLAS.cinta;
      caja(ATLAS.cinta, '#f2c614');
      x.save(); x.beginPath(); x.rect(ca, cb, cw, ch); x.clip(); x.fillStyle = '#161616';
      for (let k = -2; k < 12; k++) { x.beginPath(); x.moveTo(ca + k * 28, cb + ch); x.lineTo(ca + k * 28 + 14, cb + ch); x.lineTo(ca + k * 28 + 14 + ch, cb); x.lineTo(ca + k * 28 + ch, cb); x.closePath(); x.fill(); }
      x.restore();
      x.fillStyle = '#f2c614'; x.fillRect(ca + 88, cb + 10, 80, 28);
      texto('PELIGRO', ca + 128, cb + 25, 20, '#161616', 900);
      // pantalla del controlador: replanteo de la estaca
      const [pa, pb, pw, ph] = ATLAS.pantalla;
      caja(ATLAS.pantalla, '#0f2538');
      caja([pa, pb, pw, 16], '#1d4f7a');
      texto('Replanteo · E-1', pa + 6, pb + 9, 11, '#e8f1f8', 700, 'left');
      x.strokeStyle = '#6fe3a2'; x.lineWidth = 2;
      x.beginPath(); x.arc(pa + 48, pb + 62, 26, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.moveTo(pa + 16, pb + 62); x.lineTo(pa + 80, pb + 62); x.moveTo(pa + 48, pb + 30); x.lineTo(pa + 48, pb + 94); x.stroke();
      x.fillStyle = '#ffb347'; x.beginPath(); x.arc(pa + 55, pb + 56, 5, 0, Math.PI * 2); x.fill();
      texto('Δx  0,02', pa + 92, pb + 40, 13, '#e8f1f8', 700, 'left');
      texto('Δy  0,01', pa + 92, pb + 60, 13, '#e8f1f8', 700, 'left');
      texto('Dist. 2,7', pa + 92, pb + 80, 13, '#6fe3a2', 700, 'left');
      caja([pa + 6, pb + 98, 46, 10], '#2f7a4f'); caja([pa + 58, pb + 98, 46, 10], '#3c5a78'); caja([pa + 110, pb + 98, 44, 10], '#7a3c3c');
      // etiqueta del carrete
      const [ra, rb, rw, rh] = ATLAS.rotulo;
      caja(ATLAS.rotulo, '#efeadb');
      x.lineWidth = 2; x.strokeStyle = '#555'; x.strokeRect(ra + 2, rb + 2, rw - 4, rh - 4);
      texto('ACERO GALV.', ra + rw / 2, rb + 14, 11, '#222', 800);
      texto('3/8" · 7 HILOS', ra + rw / 2, rb + 30, 11, '#222', 700);
      texto('LOTE 26-114', ra + rw / 2, rb + 47, 10, '#444', 600);
      // tierra para la parte baja de los letreros
      caja(ATLAS.tierra, '#6a5a48');
      const t = texDe(c);
      return t;
    }
    // uv de una región del atlas sobre una cara (u, v en 0..1)
    const enAtlas = (reg, u, v) => [(reg[0] + u * reg[2]) / 512, 1 - (reg[1] + (1 - v) * reg[3]) / 512];
    function uvRegion(geo, reg, filtro = null) {
      const uv = geo.attributes.uv, n = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        if (filtro && !filtro(n.getX(i), n.getY(i), n.getZ(i))) continue;
        const [u, v] = enAtlas(reg, uv.getX(i), uv.getY(i));
        uv.setXY(i, u, v);
      }
      return geo;
    }

    const tmad = texturasMadera();
    const madera = new THREE.MeshStandardMaterial({ map: tmad.map, normalMap: tmad.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.88, vertexColors: true });
    const claseTex = texturaClases();
    const mixto = new THREE.MeshStandardMaterial({ vertexColors: true, map: texturaMugre(), metalnessMap: claseTex, roughnessMap: claseTex, metalness: 1, roughness: 1 });
    const atlasTex = texturaAtlas();
    const atlas = new THREE.MeshStandardMaterial({ map: atlasTex, roughness: 0.5, metalness: 0.1 });
    const tierraMat = kit.mat('soil', { repeat: [1, 1], color: 0xd8c3a8, normalScale: 0.9 });
    tierraMat.vertexColors = true;

    // ------------------------------------------------------------ pasto con borde irregular
    const CZ = 3.2, RX = 9.6, RZ = 7.6;
    const parcheGeo = new THREE.CircleGeometry(1, 96);
    {
      const p = parcheGeo.attributes.position, uv = parcheGeo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        let px = p.getX(i), py = p.getY(i);
        if (i > 0) {
          const a = Math.atan2(py, px), r = 1 + 0.06 * Math.sin(3 * a + 0.7) + 0.04 * Math.sin(7 * a + 2.1) + 0.02 * Math.sin(17 * a + 0.4);
          px = Math.cos(a) * r; py = Math.sin(a) * r;
        }
        px *= RX; py *= RZ;
        p.setXY(i, px, py); uv.setXY(i, px / 2.2, py / 2.2);
      }
      parcheGeo.rotateX(-Math.PI / 2);
    }
    const pasto = kit.malla(parcheGeo, kit.mat('grass', { repeat: [1, 1], color: 0xe2ead2, normalScale: 0.9 }), { y: 0.012, z: CZ, sombra: false, padre: g });
    pasto.material.polygonOffset = true; pasto.material.polygonOffsetFactor = -1; pasto.material.polygonOffsetUnits = -1;
    const dentroPasto = (x, z, k = 0.95) => (x / RX) ** 2 + ((z - CZ) / RZ) ** 2 < k * k;

    // ------------------------------------------------------------ tierra: bases de los postes, huella de trabajo, trípode y carrete
    const T = { x: 0.55, z: -2.75 }; // trípode de la estación total
    const RC = { x: X2 + 2.15, z: -2.05, ry: 0.35 }; // carrete
    const manchas = [
      { x: X1, z: 0, rx: 1.0, rz: 0.9, k: 1 }, { x: X2, z: 0, rx: 1.25, rz: 1.1, k: 1 },
      { x: 0, z: Z_OBRERO, rx: 5.7, rz: 0.42, k: 0.82 }, { x: T.x + 0.15, z: T.z - 0.2, rx: 0.95, rz: 0.8, k: 0.9 },
      { x: RC.x, z: RC.z, rx: 1.15, rz: 0.95, k: 0.95 },
    ];
    const enTierra = (x, z) => { let m = 9; for (const t of manchas) m = Math.min(m, Math.hypot((x - t.x) / t.rx, (z - t.z) / t.rz)); return m; };
    {
      const L = lote();
      manchas.forEach((t, n) => {
        const seg = 44, anillos = [0, 0.45, 0.78, 1], pos = [], col = [], idx = [];
        const borde = (a) => 1 + 0.12 * Math.sin(3 * a + n * 1.7) + 0.07 * Math.sin(7 * a + n) + 0.04 * Math.sin(13 * a + 2 * n);
        const tono = [new THREE.Color(1, 1, 1), new THREE.Color(1, 0.98, 0.95), new THREE.Color(0.86, 0.84, 0.74), new THREE.Color(0.5, 0.58, 0.36)];
        pos.push(t.x, 0, t.z); col.push(t.k, t.k * 0.98, t.k * 0.95);
        for (let r = 1; r < anillos.length; r++) for (let i = 0; i < seg; i++) {
          const a = (i / seg) * Math.PI * 2, f = anillos[r] * (r === 3 ? borde(a) : 1 + 0.4 * (borde(a) - 1));
          pos.push(t.x + Math.cos(a) * t.rx * f, 0, t.z + Math.sin(a) * t.rz * f);
          const c = tono[r]; col.push(c.r * (r < 3 ? t.k : 1), c.g * (r < 3 ? t.k : 1), c.b * (r < 3 ? t.k : 1));
        }
        for (let i = 0; i < seg; i++) idx.push(0, 1 + ((i + 1) % seg), 1 + i);
        for (let r = 1; r < anillos.length - 1; r++) for (let i = 0; i < seg; i++) {
          const a = 1 + (r - 1) * seg + i, b = 1 + (r - 1) * seg + ((i + 1) % seg), c = a + seg, d = b + seg;
          idx.push(a, b, c, b, d, c);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(pos.flatMap((v, i) => (i % 3 === 0 ? [v / 1.6, -pos[i + 2] / 1.6] : [])), 2));
        geo.setIndex(idx);
        L.add(geo, { y: 0.016 + n * 0.001 });
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      });
      // montículos apisonados al pie de cada poste
      for (const [xp, rb] of [[X1, 0.125], [X2, 0.16]]) {
        const geo = new THREE.CylinderGeometry(rb + 0.04, rb + 0.55, 0.08, 28, 2, true);
        const p = geo.attributes.position, uv = geo.attributes.uv;
        for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) + (p.getY(i) < 0 ? 0 : 0.012 * Math.sin(5 * a))); uv.setXY(i, p.getX(i) / 1.6, p.getZ(i) / 1.6); }
        L.add(geo, { x: xp, y: 0.04, color: 0xb9a68e });
      }
      const suelo = L.unir(tierraMat, { sombra: false });
      suelo.material.polygonOffset = true; suelo.material.polygonOffsetFactor = -2; suelo.material.polygonOffsetUnits = -2;
    }

    // ------------------------------------------------------------ pasto en matas y espigas secas (instanciados)
    function mataGeo(hojas, r, conEspiga = false) {
      const pos = [], idx = [];
      for (let i = 0; i < hojas; i++) {
        const a = r() * Math.PI * 2, h = 0.07 + r() * 0.12, w = 0.006 + r() * 0.005, lean = 0.03 + r() * 0.07;
        const ox = (r() - 0.5) * 0.08, oz = (r() - 0.5) * 0.08, c = Math.cos(a), sn = Math.sin(a), b = pos.length / 3;
        const tx = ox + c * lean * 1.3, tz = oz + sn * lean * 1.3;
        pos.push(ox - sn * w, 0, oz + c * w, ox + sn * w, 0, oz - c * w);
        pos.push(tx - sn * w * 0.2, h, tz + c * w * 0.2, tx + sn * w * 0.2, h, tz - c * w * 0.2);
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        if (conEspiga) {
          const e = pos.length / 3, hx = tx, hz = tz;
          pos.push(hx - sn * 0.008, h, hz + c * 0.008, hx + sn * 0.008, h, hz - c * 0.008, hx + c * 0.01, h + 0.05, hz + sn * 0.01);
          idx.push(e, e + 1, e + 2);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      geo.setIndex(idx);
      return geo;
    }
    function sembrar(geo, N, color, elegir, escala) {
      const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }), N);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V(), sc = V(), c = new THREE.Color();
      let k = 0, intentos = 0;
      while (k < N && intentos < N * 40) {
        intentos++;
        const px = (rnd() * 2 - 1) * RX, pz = CZ + (rnd() * 2 - 1) * RZ;
        const peso = elegir(px, pz);
        if (peso <= 0 || rnd() > peso) continue;
        q.setFromAxisAngle(Y, rnd() * 6.28);
        const e = escala(px, pz) * (0.75 + rnd() * 0.5);
        sc.set(e, e * (0.8 + rnd() * 0.6), e);
        m.compose(p.set(px, 0.012, pz), q, sc); inst.setMatrixAt(k, m);
        color(c, px, pz); inst.setColorAt(k, c);
        k++;
      }
      inst.count = k; inst.receiveShadow = true; g.add(inst);
      return inst;
    }
    const cercaPoste = (x, z) => Math.min(Math.hypot(x - X1, z), Math.hypot(x - X2, z));
    sembrar(mataGeo(8, kit.mulberry32(11)), 1300, (c, x, z) => {
      const seco = rnd() < 0.18 ? 1 : 0;
      c.setRGB(0.05 + rnd() * 0.05 + seco * 0.12, 0.1 + rnd() * 0.07 + seco * 0.05, 0.015 + rnd() * 0.02);
    }, (x, z) => {
      if (!dentroPasto(x, z, 0.98)) return 0;
      const t = enTierra(x, z);
      if (t < 0.85) return 0;
      const d = cercaPoste(x, z), borde = (x / RX) ** 2 + ((z - CZ) / RZ) ** 2;
      return 0.35 + (d < 1.8 ? 0.65 : 0) + (borde > 0.7 ? 0.4 : 0) + (t < 1.25 ? 0.5 : 0);
    }, (x, z) => (cercaPoste(x, z) < 1.8 ? 1.5 : 1) * ((x / RX) ** 2 + ((z - CZ) / RZ) ** 2 > 0.75 ? 1.3 : 1));
    sembrar(mataGeo(4, kit.mulberry32(12), true), 260, (c) => { const v = 0.75 + rnd() * 0.3; c.setRGB(0.36 * v, 0.3 * v, 0.14 * v); }, (x, z) => {
      if (!dentroPasto(x, z, 0.98) || enTierra(x, z) < 0.95) return 0;
      const d = cercaPoste(x, z), borde = (x / RX) ** 2 + ((z - CZ) / RZ) ** 2;
      return (d < 1.6 ? 0.9 : 0) + (borde > 0.72 ? 0.7 : 0) + (Math.hypot(x - RC.x, z - RC.z) < 1.8 ? 0.6 : 0);
    }, () => 2.1);

    // ------------------------------------------------------------ piezas estáticas: madera y material mixto
    const MAD = lote(), MIX = lote(), ATL = lote();
    // piedras redondeadas, con más grava al pie de los postes
    {
      const base = new THREE.SphereGeometry(1, 7, 5), r2 = kit.mulberry32(51);
      let k = 0;
      while (k < 64) {
        let px, pz;
        if (k < 20) { const cerca = k % 2 ? X1 : X2, a = rnd() * 6.28, r = 0.25 + rnd() * 0.55; px = cerca + Math.cos(a) * r; pz = Math.sin(a) * r * 0.9; }
        else { px = (rnd() * 2 - 1) * RX; pz = CZ + (rnd() * 2 - 1) * RZ; if (!dentroPasto(px, pz, 1.04)) continue; }
        const t = (k < 20 ? 0.025 : 0.03) + rnd() ** 2 * (k < 20 ? 0.05 : 0.1);
        const geo = base.clone(), p = geo.attributes.position, n = geo.attributes.normal, f = [r2() * 6, r2() * 6, r2() * 6];
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = 1 + 0.16 * Math.sin(x * 3 + f[0]) * Math.sin(y * 2.6 + f[1]) + 0.1 * Math.sin(z * 4.1 + f[2]);
          p.setXYZ(i, x * d, y * d, z * d); n.setXYZ(i, x, y, z);
        }
        const gr = 0.36 + rnd() * 0.22, tinte = rnd();
        MIX.add(geo, { x: px, y: t * 0.18, z: pz, rx: rnd() * 0.5, ry: rnd() * 6.28, sx: t * (1 + rnd() * 0.5), sy: t * (0.45 + rnd() * 0.25), sz: t * (1 + rnd() * 0.4), color: new THREE.Color().setRGB(gr * (1.04 + tinte * 0.06), gr, gr * (0.9 - tinte * 0.05)), clase: 'piedra' });
        k++;
      }
    }

    // ------------------------------------------------------------ postes de madera con cruceta, aisladores, pernos y peldaños
    const aisladorPerfil = [
      [0.012, 0], [0.03, 0.004], [0.054, 0.016], [0.052, 0.026], [0.028, 0.032], [0.042, 0.05], [0.06, 0.064],
      [0.057, 0.074], [0.032, 0.08], [0.035, 0.1], [0.031, 0.115], [0.017, 0.122], [0.0005, 0.124],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    function poste(xp, H, rB, rT, lado, placa) {
      // lado: hacia dónde va la cruceta (afuera de la línea); el cable sale hacia el lado contrario
      const r = (y) => rB + (rT - rB) * (y / H);
      const curva = (y) => 0.012 * Math.sin(y * 0.55 + xp); // el poste no es perfectamente recto
      {
        const geo = new THREE.CylinderGeometry(rT, rB, H, 26, Math.ceil(H / 0.3), true);
        const p = geo.attributes.position, uv = geo.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i), y = p.getY(i) + H / 2, a = Math.atan2(z, x);
          const d = 1 + 0.025 * Math.sin(3 * a + xp) + 0.012 * Math.sin(7 * a + y * 1.3);
          p.setXYZ(i, x * d + curva(y), p.getY(i), z * d);
          uv.setXY(i, uv.getX(i) * 0.5, y / 1.7 + (xp > 0 ? 0.37 : 0));
        }
        MAD.add(geo, {
          x: xp, y: H / 2,
          color: (x, y, z, c) => {
            const h = y + H / 2, base = Math.min(1, h / 1.3), sol = Math.max(0, (h - (H - 1.2)) / 1.2);
            const k = 0.55 + 0.45 * base * base;
            return c.setRGB(k * (1 + 0.08 * sol), k * (0.97 + 0.07 * sol), k * (0.92 + 0.1 * sol) * (h < 0.25 ? 0.85 : 1));
          },
        });
      }
      // capuchón galvanizado
      {
        const tapa = new THREE.SphereGeometry(rT * 1.08, 18, 5, 0, Math.PI * 2, 0, Math.PI / 2);
        MIX.add(tapa, { x: xp + curva(H), y: H - 0.005, sy: 0.4, color: 0xa7adb2, clase: 'galv' });
        MIX.add(new THREE.CylinderGeometry(rT * 1.09, rT * 1.09, 0.05, 18, 1, true), { x: xp + curva(H), y: H - 0.02, color: 0x9fa5aa, clase: 'galv' });
      }
      // cruceta perpendicular a la línea, con perno pasante, golillas, tuercas y pies de amigo planos
      const yC = H - 0.3, Lc = H > 5 ? 2.1 : 1.6, xr = xp + curva(yC), xc = xr + lado * (r(yC) + 0.045);
      {
        const geo = cajaRedondeada(0.09, 0.11, Lc, 0.008);
        const p = geo.attributes.position, uv = geo.attributes.uv;
        for (let i = 0; i < p.count; i++) uv.setXY(i, 0.04 + (p.getX(i) + p.getY(i) + 0.1) * 2, p.getZ(i) / 1.7);
        MAD.add(geo, { x: xc, y: yC, color: (x, y, z, c) => c.setScalar(0.92 - 0.12 * Math.max(0, -y / 0.055)) });
      }
      const galv = { clase: 'galv', color: 0xb0b6ba }, galvO = { clase: 'galv', color: 0x8c8f8c };
      MIX.add(new THREE.CylinderGeometry(0.009, 0.009, 2 * r(yC) + 0.22, 8), { x: xr + lado * 0.03, y: yC, rz: Math.PI / 2, ...galv });
      for (const xx of [xr - lado * (r(yC) + 0.004), xc + lado * 0.048]) {
        MIX.add(new THREE.BoxGeometry(0.006, 0.055, 0.055), { x: xx, y: yC, ...galvO });
        MIX.add(tuerca(), { x: xx + Math.sign(xx - xr) * 0.01, y: yC, rz: Math.PI / 2, ...galvO });
      }
      for (const zz of [-1, 1]) {
        const a = [xc + lado * 0.05, yC - 0.035, zz * Lc * 0.3], b = [xr + lado * (r(yC - 0.62) + 0.003), yC - 0.62, 0];
        MIX.add(new THREE.BoxGeometry(0.006, 1, 0.034), { m: entre(a, b), ...galv });
        MIX.add(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 8), { x: a[0] + lado * 0.006, y: a[1], z: a[2], rz: Math.PI / 2, ...galvO });
      }
      MIX.add(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), { x: xr + lado * (r(yC - 0.62) + 0.01), y: yC - 0.62, rz: Math.PI / 2, ...galvO });
      // aisladores de espiga sobre la cruceta (porcelana) con su espiga y tuerca bajo la cruceta
      const zs = H > 5 ? [-0.88, -0.42, 0.88] : [-0.66, 0.66];
      for (const zz of zs) {
        MIX.add(new THREE.CylinderGeometry(0.009, 0.011, 0.1, 8), { x: xc, y: yC + 0.055 + 0.04, z: zz, ...galv });
        MIX.add(tuerca(0.014, 0.012), { x: xc, y: yC - 0.062, z: zz, ...galvO });
        MIX.add(new THREE.BoxGeometry(0.05, 0.005, 0.05), { x: xc, y: yC - 0.057, z: zz, ...galvO });
        MIX.add(new THREE.LatheGeometry(aisladorPerfil, 14), { x: xc, y: yC + 0.055 + 0.055, z: zz, color: 0xd9dcd6, clase: 'porcelana' });
      }
      // ojal del tirante arriba, hacia el cable: perno pasante, golilla y tuerca de ojo
      const yT = H - 0.12, xT = xp + curva(yT);
      MIX.add(new THREE.CylinderGeometry(0.009, 0.009, 2 * r(yT) + 0.12, 8), { x: xT, y: yT, rz: Math.PI / 2, ...galv });
      MIX.add(new THREE.BoxGeometry(0.006, 0.06, 0.06), { x: xT - lado * (r(yT) + 0.004), y: yT, ...galvO });
      MIX.add(new THREE.BoxGeometry(0.006, 0.06, 0.06), { x: xT + lado * (r(yT) + 0.004), y: yT, ...galvO });
      MIX.add(tuerca(), { x: xT + lado * (r(yT) + 0.014), y: yT, rz: Math.PI / 2, ...galvO });
      MIX.add(new THREE.TorusGeometry(0.024, 0.007, 8, 18), { x: xT - lado * (r(yT) + 0.034), y: yT, ...galv });
      // placa de numeración
      ATL.add(uvRegion(new THREE.PlaneGeometry(0.1, 0.138), placa), { x: xp + curva(2.2), y: 2.2, z: r(2.2) + 0.004 });
      MIX.add(new THREE.BoxGeometry(0.104, 0.142, 0.003), { x: xp + curva(2.2), y: 2.2, z: r(2.2) + 0.001, color: 0x8d9296, clase: 'aluminio' });
      // bajada a tierra de cobre con grapas y protección de PVC en los 2,4 m inferiores
      const aB = -0.55, pB = (y, e = 0.006) => [xp + curva(y) + Math.sin(aB) * (r(y) + e), y, Math.cos(aB) * (r(y) + e)];
      for (let y = 2.4; y < H - 0.45; y += 0.55) {
        const y1 = Math.min(H - 0.4, y + 0.55);
        MIX.add(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6, 1, true), { m: entre(pB(y), pB(y1)), color: 0xb87333, clase: 'cobre' });
        MIX.add(new THREE.BoxGeometry(0.016, 0.006, 0.01), { x: pB(y + 0.2)[0], y: y + 0.2, z: pB(y + 0.2)[2], ry: aB, ...galvO });
      }
      {
        const geo = new THREE.CylinderGeometry(0.022, 0.022, 2.4, 10, 1, true, -Math.PI / 2, Math.PI);
        MIX.add(geo, { x: pB(1.2, 0)[0], y: 1.2, z: pB(1.2, 0)[2], ry: aB, color: 0x8b9096, clase: 'plastico' });
        for (const y of [0.3, 1.2, 2.1]) MIX.add(new THREE.BoxGeometry(0.05, 0.012, 0.03), { x: pB(y, 0.012)[0], y, z: pB(y, 0.012)[2], ry: aB, ...galvO });
      }
      const pt = [xp + Math.sin(aB) * (rB + 0.18), 0, Math.cos(aB) * (rB + 0.18)];
      MIX.add(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8), { x: pt[0], y: 0.035, z: pt[2], color: 0xb06a3a, clase: 'cobre' });
      MIX.add(new THREE.BoxGeometry(0.03, 0.02, 0.025), { x: pt[0], y: 0.06, z: pt[2], ry: aB, color: 0x9b7a42, clase: 'cobre' });
      MIX.add(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6, 1, true), { m: entre([pt[0], 0.06, pt[2]], pB(0.03, 0.02)), color: 0xb87333, clase: 'cobre' });
      return { tope: [xT - lado * (r(yT) + 0.034), yT, 0], r, curva };
    }
    const P1 = poste(X1, H1, 0.125, 0.095, -1, ATLAS.placa1);
    const P2 = poste(X2, H2, 0.16, 0.108, 1, ATLAS.placa2);
    // peldaños de acero del poste alto, alternados, con su tuerca contra la madera
    for (let i = 0; i < 13; i++) {
      const y = 2.5 + i * 0.4, th = i % 2 ? 1.15 : -1.15, d = V(Math.sin(th), 0, Math.cos(th)), r0 = P2.r(y);
      const a = V(X2 + P2.curva(y), y, 0).addScaledVector(d, r0), b = a.clone().addScaledVector(d, 0.19);
      MIX.add(new THREE.CylinderGeometry(0.009, 0.009, 1, 6), { m: entre(a.toArray(), b.toArray()), color: 0x9aa0a4, clase: 'galv' });
      MIX.add(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 6), { x: b.x, y: y + 0.02, z: b.z, color: 0x9aa0a4, clase: 'galv' });
      MIX.add(tuerca(0.015, 0.012), { m: entre(a.clone().addScaledVector(d, 0.006).toArray(), a.clone().addScaledVector(d, 0.018).toArray(), false), color: 0x7f8386, clase: 'galv' });
    }
    // barreta apoyada en el poste bajo
    MIX.add(new THREE.CylinderGeometry(0.013, 0.013, 1, 8), { m: entre([X1 - 0.42, 0.01, -0.5], [X1 - 0.09, 1.42, -0.09]), color: 0x3e4144, clase: 'acero' });

    // ------------------------------------------------------------ carrete del cable de acero sobre caballetes
    {
      const rc = new THREE.Matrix4().compose(V(RC.x, 0, RC.z), new THREE.Quaternion().setFromAxisAngle(Y, RC.ry), V(1, 1, 1));
      const en = (geo, o, L = MIX) => L.add(geo, { ...o, m: rc.clone().multiply(mat4(o)) });
      const yE = 0.66;
      for (const l of [-1, 1]) {
        const brida = new THREE.CylinderGeometry(0.6, 0.6, 0.045, 36);
        const p = brida.attributes.position, uv = brida.attributes.uv;
        for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + 0.5 * (p.getX(i) / 1.2 + 0.5), p.getZ(i) / 1.2 + 0.5);
        en(brida, { x: l * 0.33, y: yE, rz: Math.PI / 2, color: (x, y, z, c) => c.setScalar(0.95 - 0.25 * Math.max(0, -x / 0.6 - 0.5)) }, MAD);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          en(tuerca(0.012, 0.01), { x: l * 0.358, y: yE + Math.sin(a) * 0.48, z: Math.cos(a) * 0.48, rz: Math.PI / 2, color: 0x8b8e8c, clase: 'oxido' });
        }
        en(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 16), { x: l * 0.358, y: yE, rz: Math.PI / 2, color: 0x8f969b, clase: 'galv' });
        // caballete: dos patas, base y cuna, pintado amarillo
        const xs = l * 0.5;
        for (const zz of [-1, 1]) en(new THREE.BoxGeometry(0.045, 1, 0.045), { m: entre([xs, 0.02, zz * 0.32], [xs, yE - 0.02, zz * 0.04]), color: 0xd8a51c });
        en(new THREE.BoxGeometry(0.06, 0.04, 0.78), { x: xs, y: 0.02, color: 0xc89618 });
        en(new THREE.BoxGeometry(0.07, 0.03, 0.12), { x: xs, y: yE - 0.04, color: 0xc89618 });
        en(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 10), { x: xs, y: yE - 0.12, color: 0x55595c, clase: 'acero' });
      }
      en(new THREE.CylinderGeometry(0.032, 0.032, 1.22, 14), { y: yE, rz: Math.PI / 2, color: 0x6c7175, clase: 'acero' });
      // cable enrollado: tambor y vueltas exteriores
      en(new THREE.CylinderGeometry(0.42, 0.42, 0.61, 36, 1, true), { y: yE, rz: Math.PI / 2, color: 0x8e959a, clase: 'galv' });
      for (let k = 0; k < 6; k++) en(new THREE.TorusGeometry(0.426, 0.01, 5, 32), { x: -0.25 + k * 0.1, y: yE, ry: Math.PI / 2, color: 0x9ba2a7, clase: 'galv' });
      // punta del cable suelta sobre el pasto hacia el poste alto
      const pts = [V(-0.05, yE - 0.42, 0.06), V(-0.08, 0.12, 0.35), V(-0.15, 0.02, 0.75), V(-0.5, 0.02, 1.1), V(-1.05, 0.02, 1.2), V(-1.45, 0.02, 1.0)];
      en(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.007, 6), { color: 0x9aa1a6, clase: 'galv' });
      ATL.add(uvRegion(new THREE.PlaneGeometry(0.16, 0.115), ATLAS.rotulo), { m: rc.clone().multiply(mat4({ x: 0.356, y: yE + 0.3, z: 0.05, ry: Math.PI / 2 })) });
    }

    // ------------------------------------------------------------ conos, cinta de peligro y letreros
    const conoPerfil = [[0.165, 0], [0.16, 0.03], [0.15, 0.06], [0.104, 0.3], [0.096, 0.349], [0.094, 0.351], [0.08, 0.43], [0.078, 0.449], [0.076, 0.451],
      [0.06, 0.53], [0.058, 0.549], [0.056, 0.551], [0.04, 0.64], [0.03, 0.69], [0.02, 0.705], [0, 0.71]].map(([r, y]) => new THREE.Vector2(r, y));
    const conos = [[X1 - 1.35, 2.25], [X2 + 1.5, 1.35], [X2 + 4.0, 0.75], [X2 + 4.25, -3.4]];
    for (const [cx, cz] of conos) {
      const ry = rnd() * 6.28;
      MIX.add(cajaRedondeada(0.38, 0.38, 0.035, 0.03), { x: cx, y: 0.0175, z: cz, rx: Math.PI / 2, ry, color: 0x1d1d1d, clase: 'goma' });
      const banda = (y) => (y > 0.35 && y < 0.45) || (y > 0.55 && y < 0.64);
      MIX.add(new THREE.LatheGeometry(conoPerfil, 22), {
        x: cx, y: 0.034, z: cz, ry,
        color: (x, y, z, c) => (banda(y) ? c.setRGB(0.92, 0.92, 0.9) : c.set(0xf05a14)).multiplyScalar(y < 0.12 ? 0.62 + y * 3 : 1),
        clase: (x, y) => (banda(y) ? 'reflectante' : 'plastico'),
      });
    }
    // cinta entre los conos del lado del carrete, con comba
    {
      const tramos = [[conos[1], conos[2]], [conos[2], conos[3]]];
      for (const [[ax, az], [bx, bz]] of tramos) {
        const n = 9, h0 = 0.66;
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n, cmb = (t) => 0.09 * 4 * t * (1 - t);
          const p0 = [ax + (bx - ax) * t0, h0 - cmb(t0), az + (bz - az) * t0], p1 = [ax + (bx - ax) * t1, h0 - cmb(t1), az + (bz - az) * t1];
          const d = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]), ang = Math.atan2(-(p1[2] - p0[2]), p1[0] - p0[0]);
          const geo = uvRegion(new THREE.PlaneGeometry(1, 0.075), ATLAS.cinta);
          geo.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, p1[1] - p0[1], 0, 0, 0));
          ATL.add(geo, { m: new THREE.Matrix4().compose(V((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2), new THREE.Quaternion().setFromAxisAngle(Y, ang), V(d, 1, 1)) });
        }
      }
      atlas.side = THREE.DoubleSide;
    }
    function letrero(x, z, ry, reg) {
      const m = new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion().setFromAxisAngle(Y, ry), V(1, 1, 1));
      const o = (geo, op, L = MIX) => L.add(geo, { ...op, m: m.clone().multiply(mat4(op)) });
      o(uvRegion(new THREE.PlaneGeometry(0.6, 0.6), reg), { y: 0.88, z: 0.012 }, ATL);
      o(cajaRedondeada(0.62, 0.62, 0.018, 0.012), { y: 0.88, color: 0xa5abb0, clase: 'galv' });
      for (const l of [-1, 1]) {
        o(new THREE.BoxGeometry(0.035, 1.22, 0.035), { x: l * 0.2, y: 0.6, z: -0.03, color: 0x8d9398, clase: 'galv' });
        for (const yy of [0.68, 1.08]) o(new THREE.CylinderGeometry(0.01, 0.01, 0.012, 8), { x: l * 0.2, y: yy, z: 0.016, rx: Math.PI / 2, color: 0x7a7f83, clase: 'galv' });
      }
      o(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 20), { y: 0.03, z: -0.03, color: 0x6c6258, clase: 'piedra' });
    }
    letrero(X1 - 2.75, 1.85, 0.55, ATLAS.atencion);
    letrero(X2 + 3.0, 1.75, -0.5, ATLAS.peligro);

    // ------------------------------------------------------------ caja de herramientas, pala y estuche del instrumento
    {
      const m = new THREE.Matrix4().compose(V(X1 - 1.75, 0, -1.35), new THREE.Quaternion().setFromAxisAngle(Y, 0.35), V(1, 1, 1));
      const o = (geo, op, L = MIX) => L.add(geo, { ...op, m: m.clone().multiply(mat4(op)) });
      o(cajaRedondeada(0.5, 0.2, 0.24, 0.012), { y: 0.1, color: 0xb3261e });
      o(cajaRedondeada(0.51, 0.045, 0.25, 0.012), { y: 0.215, color: 0xa12019 });
      o(new THREE.BoxGeometry(0.505, 0.006, 0.245), { y: 0.193, color: 0x3a1210 });
      o(new THREE.TorusGeometry(0.06, 0.008, 6, 14, Math.PI), { y: 0.24, color: 0x2b2b2b, clase: 'goma' });
      for (const l of [-1, 1]) o(new THREE.BoxGeometry(0.03, 0.04, 0.012), { x: l * 0.2, y: 0.2, z: 0.124, color: 0xb0b4b6, clase: 'galv' });
      // pala tendida en el pasto
      o(new THREE.CylinderGeometry(0.016, 0.016, 1.05, 10), { x: 0.2, y: 0.03, z: -0.55, rz: Math.PI / 2 - 0.04, ry: 0.4, color: 0xd6b48a }, MAD);
      o(cajaRedondeada(0.22, 0.006, 0.28, 0.002), { x: 0.2 + Math.cos(0.4) * 0.66, y: 0.022, z: -0.55 - Math.sin(0.4) * 0.66, rx: 0.06, ry: 0.4 + Math.PI / 2, color: 0x4b4f52, clase: 'acero' });
      // estuche amarillo de la estación total junto al trípode
      const me = new THREE.Matrix4().compose(V(T.x - 0.82, 0, T.z - 0.3), new THREE.Quaternion().setFromAxisAngle(Y, 0.45), V(1, 1, 1));
      const oe = (geo, op) => MIX.add(geo, { ...op, m: me.clone().multiply(mat4(op)) });
      oe(cajaRedondeada(0.42, 0.24, 0.3, 0.03, 3), { y: 0.12, color: 0xe2b522, clase: 'plastico' });
      oe(new THREE.BoxGeometry(0.425, 0.008, 0.305), { y: 0.17, color: 0x3a3320, clase: 'plastico' });
      for (const l of [-1, 1]) oe(new THREE.BoxGeometry(0.04, 0.05, 0.012), { x: l * 0.13, y: 0.17, z: 0.155, color: 0x2a2a2a, clase: 'goma' });
      oe(new THREE.TorusGeometry(0.055, 0.01, 6, 14, Math.PI), { y: 0.245, color: 0x2a2a2a, clase: 'goma' });
    }

    // ------------------------------------------------------------ trípode y estación total robótica
    const YI = 1.3; // altura de la base del instrumento
    {
      MIX.add(new THREE.CylinderGeometry(0.08, 0.08, 0.026, 24), { x: T.x, y: YI - 0.03, z: T.z, color: 0x3c3f42, clase: 'aluminio' });
      MIX.add(new THREE.CylinderGeometry(0.068, 0.072, 0.03, 20), { x: T.x, y: YI - 0.002, z: T.z, color: 0x1f2022, clase: 'plastico' });
      for (let k = 0; k < 3; k++) {
        const a = 0.37 + k * 2.094, c = Math.cos(a), sn = Math.sin(a);
        MIX.add(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8), { x: T.x + c * 0.05, y: YI + 0.025, z: T.z + sn * 0.05, color: 0x2a2b2d, clase: 'goma' });
        const arriba = [T.x + c * 0.075, YI - 0.05, T.z + sn * 0.075], pie = [T.x + c * 0.5, 0.02, T.z + sn * 0.5];
        const at = (t) => arriba.map((v, i) => v + (pie[i] - v) * t);
        MIX.add(new THREE.BoxGeometry(0.036, 1, 0.026), { m: entre(at(0), at(0.56)), color: 0xd9a33a, clase: 'madera' });
        MIX.add(new THREE.BoxGeometry(0.024, 1, 0.018), { m: entre(at(0.5), at(0.95)), color: 0x9ea5aa, clase: 'aluminio' });
        MIX.add(new THREE.BoxGeometry(0.048, 0.06, 0.036), { m: entre(at(0.53), at(0.58), false), color: 0x202124, clase: 'plastico' });
        MIX.add(new THREE.ConeGeometry(0.012, 0.07, 8), { m: entre(at(1.02), at(0.95), false), color: 0x5b5f62, clase: 'acero' });
        MIX.add(new THREE.BoxGeometry(0.03, 0.006, 0.05), { x: at(0.93)[0], y: at(0.93)[1], z: at(0.93)[2], ry: -a, color: 0x5b5f62, clase: 'acero' });
      }
    }
    const inst = new THREE.Group(); inst.position.set(T.x, YI + 0.015, T.z); g.add(inst);
    const alidada = new THREE.Group(); inst.add(alidada);
    const anteojo = new THREE.Group(); anteojo.position.y = 0.155; alidada.add(anteojo);
    {
      const A = lote(), B = lote(), claro = 0xd4d6d0, oscuro = 0x2e3134;
      A.add(new THREE.CylinderGeometry(0.078, 0.08, 0.03, 24), { y: 0.015, color: oscuro, clase: 'plastico' });
      for (const l of [-1, 1]) {
        A.add(cajaRedondeada(0.04, 0.17, 0.09, 0.01), { x: l * 0.085, y: 0.115, color: claro, clase: 'plastico' });
        A.add(new THREE.BoxGeometry(0.042, 0.02, 0.092), { x: l * 0.085, y: 0.06, color: 0xe2b324, clase: 'plastico' });
        A.add(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 14), { x: l * 0.112, y: 0.155, rz: Math.PI / 2, color: oscuro, clase: 'goma' });
      }
      A.add(cajaRedondeada(0.15, 0.06, 0.11, 0.012), { y: 0.06, color: claro, clase: 'plastico' });
      A.add(new THREE.BoxGeometry(0.1, 0.045, 0.004), { y: 0.065, z: -0.056, color: 0x101820, clase: 'pantalla' });
      A.add(new THREE.TorusGeometry(0.075, 0.011, 8, 20, Math.PI), { y: 0.205, color: oscuro, clase: 'plastico' });
      B.add(new THREE.CylinderGeometry(0.042, 0.042, 0.13, 20), { rx: Math.PI / 2, color: 0x44484c, clase: 'plastico' });
      B.add(new THREE.CylinderGeometry(0.046, 0.044, 0.04, 20), { z: 0.08, rx: Math.PI / 2, color: claro, clase: 'plastico' });
      B.add(new THREE.CircleGeometry(0.036, 20), { z: 0.101, color: 0x203a4a, clase: 'vidrio' });
      B.add(new THREE.CylinderGeometry(0.018, 0.022, 0.05, 14), { z: -0.085, rx: Math.PI / 2, color: 0x1e1f21, clase: 'goma' });
      B.add(new THREE.CylinderGeometry(0.047, 0.047, 0.02, 20), { z: -0.02, rx: Math.PI / 2, color: 0x24272a, clase: 'goma' });
      const ma = A.unir(mixto); inst.remove(ma); g.remove(ma); alidada.add(ma);
      const mb = B.unir(mixto); g.remove(mb); anteojo.add(mb); mb.castShadow = false;
    }

    // ------------------------------------------------------------ uniones estáticas
    MAD.unir(madera);
    MIX.unir(mixto);
    const atlasMalla = ATL.unir(atlas);
    atlasMalla.material.side = THREE.DoubleSide;

    // ------------------------------------------------------------ estaca: barra de anclaje con ojo forjado, franja naranja y cinta de marcar
    const estaca = new THREE.Group(); g.add(estaca);
    {
      const E = lote();
      E.add(new THREE.CylinderGeometry(0.011, 0.011, 0.34, 10), { y: 0.15, color: 0x6b7075, clase: 'acero' });
      E.add(new THREE.CylinderGeometry(0.0125, 0.0125, 0.14, 12), { y: 0.12, color: 0xff6a12, clase: 'pintura' });
      E.add(new THREE.CylinderGeometry(0.021, 0.019, 0.026, 12), { y: 0.312, color: 0x55595c, clase: 'oxido' });
      E.add(new THREE.TorusGeometry(0.03, 0.0075, 8, 20), { y: YOJO, color: 0x7c8186, clase: 'acero' });
      // cinta de marcar atada a la barra
      for (const [a, l] of [[0.6, 0.16], [1.3, 0.12]]) E.add(new THREE.PlaneGeometry(0.02, l), { x: Math.sin(a) * 0.02, y: 0.17 - l / 2, z: Math.cos(a) * 0.02 + 0.012, ry: a, rz: 0.15, color: 0xff3d6e, clase: 'plastico' });
      // estuche de la huincha al final de la cinta
      E.add(new THREE.CylinderGeometry(0.042, 0.042, 0.036, 20), { x: 0.06, y: 0.018, z: 0.42, color: 0xf0c020, clase: 'plastico' });
      E.add(new THREE.CylinderGeometry(0.02, 0.02, 0.038, 14), { x: 0.06, y: 0.018, z: 0.42, color: 0x1d1d1d, clase: 'goma' });
      const m = E.unir(mixto); g.remove(m); estaca.add(m);
      const Tt = lote();
      const mont = new THREE.CylinderGeometry(0.05, 0.2, 0.045, 18, 2);
      const p = mont.attributes.position, uv = mont.attributes.uv;
      for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); if (p.getY(i) < 0.02) { const k = 1 + 0.2 * Math.sin(3 * a) + 0.1 * Math.sin(7 * a); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } uv.setXY(i, p.getX(i) / 1.6, p.getZ(i) / 1.6); }
      Tt.add(mont, { y: 0.02, color: 0x9e8a72 });
      for (const [x, z, e] of [[0.17, 0.08, 0.035], [-0.12, -0.16, 0.028], [0.05, -0.2, 0.022], [-0.2, 0.1, 0.03]]) Tt.add(new THREE.SphereGeometry(e, 7, 5), { x, y: e * 0.3, z, sy: 0.6, color: 0x8e7a62 });
      const mt = Tt.unir(tierraMat, { sombra: false }); g.remove(mt); estaca.add(mt);
    }
    // indicación de arrastre: anillo y flechas sobre el pasto
    {
      const guiaMat = new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false });
      const partes = [new THREE.RingGeometry(0.3, 0.37, 40).rotateX(-Math.PI / 2).translate(0, 0.04, 0)];
      for (const l of [-1, 1]) partes.push(new THREE.ConeGeometry(0.07, 0.16, 12).applyMatrix4(mat4({ x: l * 0.5, y: 0.05, rz: -l * Math.PI / 2 })));
      for (const p of partes) p.deleteAttribute('uv');
      kit.malla(kit.mergeGeometries(partes, false), guiaMat, { padre: estaca, sombra: false, recibe: false });
    }
    const asa = kit.malla(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 16), new THREE.MeshBasicMaterial(), { y: 0.65, padre: estaca, sombra: false, recibe: false });
    asa.visible = false; // solo recibe el rayo
    kit.arrastre(asa, g, { normal: [0, 1, 0], punto: [0, 0, 0], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => fijarX((p.x - X1) / PIE) });

    // ------------------------------------------------------------ tirantes: tensor, guardacabos, cable, retenciones preformadas y protector
    const tirantes = (() => {
      const piezas = [];
      for (let i = 0; i < 2; i++) {
        const tensor = [
          pintar(new THREE.TorusGeometry(0.016, 0.005, 6, 14), 0xa0a6aa, 'galv'),
          pintar(new THREE.CylinderGeometry(0.007, 0.007, 0.09, 8).translate(0, 0.06, 0), 0xa0a6aa, 'galv'),
          pintar(tuerca(0.015, 0.024).translate(0, 0.105, 0), 0x8d9295, 'galv'),
          pintar(new THREE.BoxGeometry(0.006, 0.15, 0.013).translate(-0.013, 0.19, 0), 0x9aa0a4, 'galv'),
          pintar(new THREE.BoxGeometry(0.006, 0.15, 0.013).translate(0.013, 0.19, 0), 0x9aa0a4, 'galv'),
          pintar(tuerca(0.015, 0.024).translate(0, 0.275, 0), 0x8d9295, 'galv'),
          pintar(new THREE.CylinderGeometry(0.007, 0.007, 0.07, 8).translate(0, 0.32, 0), 0xa0a6aa, 'galv'),
        ];
        piezas.push(kit.mergeGeometries(tensor, false));
        piezas.push(pintar(new THREE.TorusGeometry(0.02, 0.005, 6, 14), 0xa7adb1, 'galv'));
        piezas.push(pintar(new THREE.CylinderGeometry(0.0065, 0.0065, 1, 6, 1, true), 0x7d8489, 'galv'));
        piezas.push(pintar(new THREE.CylinderGeometry(0.0105, 0.0105, 1, 8, 1, true), 0xb4babd, 'galv'));
        piezas.push(pintar(new THREE.CylinderGeometry(0.026, 0.026, 1, 14, 1), 0xf2c40f, 'plastico'));
        piezas.push(pintar(new THREE.CylinderGeometry(0.0105, 0.0105, 1, 8, 1, true), 0xb4babd, 'galv'));
        piezas.push(pintar(new THREE.TorusGeometry(0.02, 0.005, 6, 14), 0xa7adb1, 'galv'));
      }
      const d = dinamica(piezas, mixto);
      return d;
    })();
    const vA = V(), vB = V(), vD = V();
    function ponerTirante(i, tope, ojo) {
      const k = i * 7, q = new THREE.Quaternion(), uno = V(1, 1, 1);
      vA.set(...ojo); vB.set(...tope); vD.subVectors(vB, vA); const L = vD.length(); vD.normalize();
      q.setFromUnitVectors(Y, vD);
      const en = (t) => vA.clone().addScaledVector(vD, t);
      const tramo = (t0, t1) => new THREE.Matrix4().compose(en((t0 + t1) / 2), q, V(1, t1 - t0, 1));
      tirantes.poner(k, new THREE.Matrix4().compose(en(0.012), q, uno));
      tirantes.poner(k + 1, new THREE.Matrix4().compose(en(0.36), q, uno));
      tirantes.poner(k + 2, tramo(0.36, L - 0.02));
      tirantes.poner(k + 3, tramo(0.37, 0.85));
      tirantes.poner(k + 4, tramo(0.9, Math.min(2.9, L - 0.6)));
      tirantes.poner(k + 5, tramo(L - 0.5, L - 0.03));
      tirantes.poner(k + 6, new THREE.Matrix4().compose(en(L - 0.01), q, uno));
    }

    // ------------------------------------------------------------ huincha en el suelo desde el poste bajo hasta la estaca
    const huincha = (() => {
      const [c, x] = lienzo(1024, 32);
      x.fillStyle = '#f2c62e'; x.fillRect(0, 0, 1024, 32);
      x.fillStyle = '#1a1a1a';
      for (let i = 0; i <= 32 * 4; i++) { const px = i * 8, larga = i % 4 === 0; x.fillRect(px, 0, 1.5, larga ? 14 : 7); }
      x.font = kit.font(14, 800); x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let n = 1; n < 32; n++) { x.fillStyle = n % 5 === 0 ? '#c0392b' : '#1a1a1a'; x.fillText(String(n), n * 32 - 9, 23); }
      const t = texDe(c); t.wrapS = THREE.ClampToEdgeWrapping;
      const geo = new THREE.PlaneGeometry(1, 0.026).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
      const mesh = kit.malla(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), { y: 0.024, z: 0.42, padre: g, sombra: false });
      return mesh;
    })();
    const X0H = X1 + 0.13; // gancho de la huincha en la cara del poste
    function ponerHuincha(xs) {
      const L = xs + 0.02 - X0H;
      huincha.visible = L > 0.05;
      if (!huincha.visible) return;
      huincha.position.x = X0H; huincha.scale.x = L;
      const uv = huincha.geometry.attributes.uv, u0 = (0.13 / PIE) / 32, u1 = u0 + L / PIE / 32;
      for (let i = 0; i < uv.count; i++) uv.setX(i, i % 2 === 0 ? u0 : u1);
      uv.needsUpdate = true;
    }

    // ------------------------------------------------------------ triángulos rectángulos y ángulos
    const tris = (() => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(18), 3));
      const c1 = new THREE.Color(0xffb347), c2 = new THREE.Color(0x5cc8ff);
      geo.setAttribute('color', new THREE.Float32BufferAttribute([...c1.toArray(), ...c1.toArray(), ...c1.toArray(), ...c2.toArray(), ...c2.toArray(), ...c2.toArray()], 3));
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
      m.renderOrder = 3; m.position.z = -0.03; g.add(m);
      return m;
    })();
    function ponerTris(xs) {
      const p = tris.geometry.attributes.position;
      [[X1, 0, 0], [X1, H1, 0], [xs, 0, 0], [X2, 0, 0], [X2, H2, 0], [xs, 0, 0]].forEach((v, i) => p.setXYZ(i, ...v));
      p.needsUpdate = true; tris.geometry.computeBoundingSphere();
    }
    const arcos = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x6fe3a2, side: THREE.DoubleSide, toneMapped: false }));
    g.add(arcos);
    const lA1 = etq('α', 0.3, { bg: '#6fe3a2', color: '#08251a' }), lA2 = etq('β', 0.3, { bg: '#6fe3a2', color: '#08251a' });
    g.add(lA1, lA2);

    // ------------------------------------------------------------ cotas (una sola malla de colores)
    const ZC = 0.95, YC = 0.06;
    const COTAS = [0xffb347, 0x5cc8ff, 0xe8eef4, 0xffd34d, 0xffd34d]; // x, 30 − x, 30, 12, 28
    const cotas = (() => {
      const piezas = [];
      for (const c of COTAS) for (let k = 0; k < 3; k++) piezas.push(pintar(new THREE.CylinderGeometry(0.014, 0.014, 1, 6, 1, true), c));
      for (let k = 0; k < 5; k++) piezas.push(pintar(new THREE.CylinderGeometry(0.006, 0.006, 1, 5, 1, true), 0x9aa3ab));
      return dinamica(piezas, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    })();
    cotas.malla.castShadow = false;
    const mas = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
    function ponerCota(i, a, b, tick, ver = [true, true, true]) {
      const parte = (k, p, q) => (ver[k] && Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) > 1e-3 ? cotas.poner(i * 3 + k, entre(p, q)) : cotas.ocultar(i * 3 + k, p));
      parte(0, a, b); parte(1, mas(a, tick, -1), mas(a, tick)); parte(2, mas(b, tick, -1), mas(b, tick));
    }
    const linea = (k, a, b) => cotas.poner(15 + k, entre(a, b));
    ponerCota(2, [X1, YC, ZC + 0.75], [X2, YC, ZC + 0.75], [0, 0.13, 0]);
    ponerCota(3, [X1 - 0.62, 0, 0], [X1 - 0.62, H1, 0], [0.13, 0, 0]);
    ponerCota(4, [X2 + 0.66, 0, 0], [X2 + 0.66, H2, 0], [0.13, 0, 0]);
    [[[X1, 0.03, 0.2], [X1, 0.03, ZC + 0.9]], [[X2, 0.03, 0.25], [X2, 0.03, ZC + 0.9]], [[X1 - 0.12, H1, 0], [X1 - 0.75, H1, 0]], [[X2 + 0.14, H2, 0], [X2 + 0.79, H2, 0]]].forEach(([a, b], k) => linea(k, a, b));

    const naranjaEt = { bg: '#ffb347', color: '#1a1206' }, celesteEt = { bg: '#5cc8ff', color: '#08202c' };
    const lx = etq('x', 0.48, naranjaEt), lr = etq('30 − x', 0.48, celesteEt);
    const ly = etq('y', 0.5, { bg: '#ffd34d', color: '#1a1206' }), lz = etq('z', 0.5, { bg: '#c9a7ff', color: '#1b0f2c' });
    const l12 = etq(`12 pies\n${enM(12)}`, 0.48, { bg: 'rgba(12,20,32,0.86)', color: '#ffd34d' });
    const l28 = etq(`28 pies\n${enM(28)}`, 0.48, { bg: 'rgba(12,20,32,0.86)', color: '#ffd34d' });
    const l30 = etq(`30 pies (${enM(30)})`, 0.3);
    const lW = etq('W', 0.4, { bg: '#6fe3a2', color: '#08251a' });
    l12.position.set(X1 - 0.62 - 0.5, H1 / 2, 0); l28.position.set(X2 + 0.66 + 0.5, H2 / 2, 0);
    l30.position.set(0, 0.3, ZC + 0.75); lW.position.set(-2.3, 6.1, 0);
    g.add(lx, lr, ly, lz, l12, l28, l30, lW);

    // la etiqueta de cada cable va al lado del cable que no da al triángulo
    function sobreCable(l, a, b, pie) {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      let nx = -dy, ny = dx;
      if (nx * (pie[0] - mx) + ny * (pie[1] - my) > 0) { nx = -nx; ny = -ny; }
      l.position.set(mx + nx * 0.55, my + ny * 0.55, 0.12);
    }

    // ------------------------------------------------------------ personas: obrero con combo y topógrafa
    const combo = (() => {
      const C = lote();
      const perfil = [[0, -0.004], [0.017, 0], [0.021, 0.018], [0.0185, 0.045], [0.0165, 0.3], [0.0148, 0.6], [0.0138, 0.8], [0.0158, 0.83], [0.0158, 0.9], [0, 0.9]].map(([r, y]) => new THREE.Vector2(r, y));
      C.add(new THREE.LatheGeometry(perfil, 12), { sx: 0.85, color: (x, y, z, c) => (y < 0.24 && y > 0.02 ? c.set(0x1c1c1c) : c.set(0xb98b52)), clase: (x, y) => (y < 0.24 && y > 0.02 ? 'goma' : 'madera') });
      C.add(new THREE.CylinderGeometry(0.034, 0.034, 0.17, 8), { y: 0.86, rx: Math.PI / 2, ry: Math.PI / 8, color: 0x3d4043, clase: 'acero' });
      for (const l of [-1, 1]) C.add(new THREE.CylinderGeometry(0.03, 0.034, 0.012, 8), { y: 0.86, z: l * 0.091, rx: l * Math.PI / 2, ry: Math.PI / 8, color: 0x8c9094, clase: 'galv' });
      const m = C.unir(mixto);
      return m;
    })();
    const AGARRE = { D: [0, 0.18, 0], I: [0, 0.05, 0], arriba: [0, 0, 1] };
    const controlador = (() => {
      const geo = cajaRedondeada(0.25, 0.17, 0.032, 0.02, 3);
      const n = geo.attributes.normal, p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        if (n.getZ(i) > 0.9) uv.setXY(i, ...enAtlas(ATLAS.pantalla, (p.getX(i) + 0.125) / 0.25, (p.getY(i) + 0.085) / 0.17));
        else uv.setXY(i, ...enAtlas(ATLAS.oscuro, 0.5, 0.5));
      }
      const m = kit.malla(geo, atlas, { padre: g });
      return m;
    })();
    const AGARRE_CTRL = { D: [-0.115, 0, 0], I: [0.115, 0, 0], arriba: [0, 0, 1] };

    const obrero = kit.persona({ preset: 'obrero', semilla: 21, altura: 1.75, chaleco: 'naranjo', casco: '#f2c230', guantes: '#9c7a45', barba: 'bigote', colorSuperior: '#3d5168', padre: g });
    const topografa = kit.persona({ preset: 'ingeniera', semilla: 9, padre: g, x: T.x + 0.55, z: T.z - 0.45 });
    // la piel, el pelo y los guantes no proyectan sombra (el casco y la ropa sí): ahorra triángulos en el paso de sombras
    for (const h of [obrero, topografa]) for (const m of h.mallas) if (/piel|pelo|guante/.test(m.name)) m.castShadow = false;
    const ob = { x: 0, ry: 0, estado: 'hincado', t: 0, mira: 0, tMira: 0, destino: 0, clavar: false };
    const tp = { ry: -0.3, mira: 0, tMira: 0 };
    const CAMINAR = {
      duracion: 1.1, bucle: true,
      fn(t) {
        const p = kit.CLIPS.caminar.fn(t), dy = p._pos[1];
        return { ...p, ...PUNO, ikD: { ...MANOS_HOMBRO.ikD, p: [MANOS_HOMBRO.ikD.p[0], MANOS_HOMBRO.ikD.p[1] + dy, MANOS_HOMBRO.ikD.p[2]] }, ikI: { ...MANOS_HOMBRO.ikI, p: [MANOS_HOMBRO.ikI.p[0], MANOS_HOMBRO.ikI.p[1] + dy, MANOS_HOMBRO.ikI.p[2]] } };
      },
    };
    const VEL = 1.27; // m/s, dos pasos de 0,7 m por ciclo
    // punto donde trabaja el obrero: detrás de la estaca, salvo junto a los postes
    const puestoObrero = () => { const xs = xm(s.x), x = Math.min(X2 - 0.62, Math.max(X1 + 0.6, xs)); return { x, clava: Math.abs(x - xs) < 0.05 }; };
    const polvo = (() => {
      const [c, x] = lienzo(64, 64), gr = x.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, 'rgba(150,126,98,0.75)'); gr.addColorStop(1, 'rgba(150,126,98,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texDe(c), transparent: true, depthWrite: false }));
      sp.visible = false; g.add(sp);
      return { sp, t: 9 };
    })();
    const golpe = () => { polvo.t = 0; polvo.sp.visible = true; polvo.sp.position.set(xm(s.x), 0.3, 0.02); };
    function iniciarObrero() {
      const p = puestoObrero();
      ob.x = p.x; ob.destino = p.x; ob.ry = 0;
      obrero.grupo.position.set(ob.x, 0, Z_OBRERO);
      const inicial = Number.isFinite(REV.caminar) ? POSE.hombro : Number.isFinite(REV.clavar) ? POSE.listo : POSE.hincado;
      obrero.posar(inicial).transicion(0.001); obrero.actualizar(0.01); obrero.transicion(0.6);
      topografa.posar(POSE.controlador).transicion(0.001); topografa.actualizar(0.01); topografa.transicion(0.6);
    }

    const vMundo = V(), arribaO = V(), arribaT = V();
    const aMundo = (x, y, z) => vMundo.set(x, y, z).applyMatrix4(g.matrixWorld);
    const objetivoO = V(), objetivoT = V();
    const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    function girarHacia(actual, meta, vel, dt) { const d = angulo(meta - actual); return actual + Math.sign(d) * Math.min(Math.abs(d), vel * dt); }

    function animarObrero(dt) {
      const p = puestoObrero(), xs = xm(s.x);
      ob.t += dt;
      const lejos = Math.abs(p.x - ob.x) > 0.3;
      if (lejos && ob.estado !== 'caminar' && ob.estado !== 'levantarse') {
        if (ob.estado === 'hincado' || ob.estado === 'agacharse') { ob.estado = 'levantarse'; ob.t = 0; obrero.posar(POSE.hombro).transicion(0.6); }
        else { ob.estado = 'caminar'; ob.t = 0; obrero.reproducir(CAMINAR, { bucle: true }); }
      }
      if (ob.estado === 'levantarse' && ob.t > 0.6) { ob.estado = 'caminar'; ob.t = 0; obrero.reproducir(CAMINAR, { bucle: true }); }
      if (ob.estado === 'caminar') {
        const d = p.x - ob.x, dir = Math.sign(d) || 1;
        ob.ry = girarHacia(ob.ry, (dir * Math.PI) / 2, 5, dt);
        if (Math.abs(angulo(ob.ry - (dir * Math.PI) / 2)) < 0.6) ob.x += dir * Math.min(Math.abs(d), VEL * dt);
        if (Math.abs(p.x - ob.x) < 0.01) { ob.estado = 'girar'; ob.t = 0; obrero.detener(); obrero.posar(POSE.listo).transicion(0.4); }
      } else if (ob.estado === 'girar') {
        ob.ry = girarHacia(ob.ry, 0, 4, dt);
        ob.x += Math.sign(p.x - ob.x) * Math.min(Math.abs(p.x - ob.x), VEL * dt);
        if (Math.abs(ob.ry) < 0.02 && ob.t > 0.35) {
          ob.t = 0;
          if (p.clava) {
            ob.estado = 'clavando';
            obrero.reproducir(CLAVAR, { eventos: { golpe1: golpe, golpe2: golpe }, alTerminar: () => { ob.estado = 'agacharse'; ob.t = 0; obrero.posar(POSE.hincado).transicion(0.9); } });
          } else { ob.estado = 'agacharse'; obrero.posar(POSE.hincado).transicion(0.9); }
        }
      } else if (ob.estado === 'agacharse' && ob.t > 0.9) { ob.estado = 'hincado'; ob.t = 0; }
      else if (ob.estado === 'hincado' || ob.estado === 'agacharse') ob.x += (p.x - ob.x) * Math.min(1, dt * 3);
      // mirada: los cables y la estaca cuando está hincado; la estaca en lo demás
      ob.tMira += dt;
      if (ob.tMira > 2.6) { ob.tMira = 0; ob.mira = (ob.mira + 1) % 3; }
      const fase = Number.isFinite(REV.mira) ? REV.mira % 3 : ob.mira;
      if (ob.estado === 'hincado' && fase < 2) {
        const tope = fase === 0 ? P1.tope : P2.tope, k = 0.28;
        aMundo(xs + (tope[0] - xs) * k, YOJO + (tope[1] - YOJO) * k, 0);
      } else if (ob.estado === 'caminar') aMundo(p.x, 0.3, 0);
      else aMundo(xs, 0.3, 0);
      objetivoO.copy(vMundo); obrero.mirar(objetivoO);
      // el combo: su cabeza mira hacia adelante y arriba del obrero
      arribaO.set(Math.sin(ob.ry) * 0.7, 0.7, Math.cos(ob.ry) * 0.7).transformDirection(g.matrixWorld);
      obrero.sostener(combo, { ...AGARRE, arribaMundo: arribaO.toArray() });
      obrero.grupo.position.set(ob.x, 0, Z_OBRERO); obrero.grupo.rotation.y = ob.ry;
    }
    function animarTopografa(dt) {
      const xs = xm(s.x), S0 = topografa.grupo.position;
      tp.ry = girarHacia(tp.ry, Math.max(-0.7, Math.min(0.7, Math.atan2(xs - S0.x, -S0.z) * 0.7)), 0.8, dt);
      topografa.grupo.rotation.y = tp.ry;
      tp.tMira += dt;
      const dur = [3.2, 2.2, 1.4][tp.mira];
      if (tp.tMira > dur) { tp.tMira = 0; tp.mira = (tp.mira + 1) % 3; }
      let fase = Number.isFinite(REV.mira) ? REV.mira % 3 : tp.mira;
      if (performance.now() - s.movida < 1500) fase = 1;
      if (fase === 0) objetivoT.copy(controlador.getWorldPosition(vMundo));
      else if (fase === 1) objetivoT.copy(aMundo(xs, 0.25, 0));
      else objetivoT.copy(aMundo(T.x, YI + 0.15, T.z));
      topografa.mirar(objetivoT);
      arribaT.set(-Math.sin(tp.ry) * 0.62, 0.78, -Math.cos(tp.ry) * 0.62).transformDirection(g.matrixWorld);
      topografa.sostener(controlador, { ...AGARRE_CTRL, arribaMundo: arribaT.toArray() });
      // la estación total sigue a la estaca
      const dx = xs - T.x, dz = -T.z, yaw = Math.atan2(dx, dz), pitch = Math.atan2(YI + 0.17 - 0.3, Math.hypot(dx, dz));
      alidada.rotation.y = girarHacia(alidada.rotation.y, yaw, 1.4, dt);
      anteojo.rotation.x += (pitch - anteojo.rotation.x) * Math.min(1, dt * 4);
    }

    // ------------------------------------------------------------ actualización de la escena
    function fijarX(x) { s.x = Math.min(M.d, Math.max(0, Math.round(x * 10) / 10)); s.cambio = true; s.movida = performance.now(); }

    function construir() {
      const x = s.x, xs = xm(x), ojo = [xs, YOJO, 0];
      estaca.position.x = xs;
      ponerTirante(0, P1.tope, ojo);
      ponerTirante(1, P2.tope, ojo);
      tirantes.listo();
      ponerTris(xs);
      ponerHuincha(xs);
      ponerCota(0, [X1, YC, ZC], [xs, YC, ZC], [0, 0.13, 0], [x > 0.05, true, x > 0.05]);
      ponerCota(1, [xs, YC, ZC], [X2, YC, ZC], [0, 0.13, 0], [x < M.d - 0.05, x < M.d - 0.05, true]);
      linea(4, [xs, 0.03, 0.42], [xs, 0.03, ZC + 0.14]);
      cotas.listo();
      kit.cambiarEtiqueta(lx, `x = ${kit.num(x, 1)} pies\n${enM(x)}`);
      lx.position.set(Math.max(X1 - 0.3, (X1 + xs) / 2), 0.45, ZC);
      kit.cambiarEtiqueta(lr, `30 − x = ${kit.num(M.d - x, 1)} pies\n${enM(M.d - x)}`);
      lr.position.set(Math.min(X2 + 0.3, (xs + X2) / 2), 0.45, ZC);
      const yv = M.y(x), zv = M.z(x), W = M.largo(x);
      kit.cambiarEtiqueta(ly, `y = ${kit.num(yv, 2)} pies\n${enM(yv)}`);
      kit.cambiarEtiqueta(lz, `z = ${kit.num(zv, 2)} pies\n${enM(zv)}`);
      sobreCable(ly, [xs, 0], [X1, H1], [X1, 0]);
      sobreCable(lz, [xs, 0], [X2, H2], [X2, 0]);
      kit.cambiarEtiqueta(lW, `W = y + z = ${kit.num(W, 2)} pies (${enM(W)})`);
      // ángulos de cada cable con el suelo (solo al revelar)
      arcos.visible = lA1.visible = lA2.visible = s.revelar;
      if (s.revelar) {
        const a1 = Math.atan2(M.h1, x), a2 = Math.atan2(M.h2, M.d - x);
        const geo = kit.mergeGeometries([new THREE.RingGeometry(0.9, 0.96, 32, 1, Math.PI - a1, a1), new THREE.RingGeometry(0.9, 0.96, 32, 1, 0, a2)], false);
        arcos.geometry.dispose(); arcos.geometry = geo;
        arcos.position.set(xs, 0.04, 0.05);
        kit.cambiarEtiqueta(lA1, `α = ${kit.num((a1 * 180) / Math.PI, 1)}°`);
        kit.cambiarEtiqueta(lA2, `β = ${kit.num((a2 * 180) / Math.PI, 1)}°`);
        lA1.position.set(xs - 1.25 * Math.cos(a1 / 2), 0.2 + 1.25 * Math.sin(a1 / 2), 0.1);
        lA2.position.set(xs + 1.25 * Math.cos(a2 / 2), 0.2 + 1.25 * Math.sin(a2 / 2), 0.1);
      }
    }

    // ------------------------------------------------------------ gráfico de W(x) en [0, 30]
    const ext = M.extremos();
    const graf = kit.grafico({
      f: (x) => M.largo(x), x0: 0, x1: 30, y0: 48, y1: 62, width: 1.3, height: 0.78,
      xTicks: [0, 5, 10, 15, 20, 25, 30], yTicks: [48, 52, 56, 60],
      xLabel: 'x (pies)', yLabel: 'largo de cable W (pies)', curveColor: 0x6fe3a2,
    });
    graf.group.position.set(0.55, 1.05, 6.65); graf.group.rotation.y = -0.42;
    g.add(graf.group);
    graf.group.children[0].material.depthWrite = true; // el fondo del gráfico tapa los rótulos lejanos
    graf.addPoint('x0', 0, ext.x0, { color: 0xe8eef4, guides: false });
    graf.addPoint('x30', 30, ext.xd, { color: 0xe8eef4, guides: false });
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial(), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    proxy.visible = false; // solo recibe el rayo
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => fijarX(graf.xFromLocal(p.x)) });
    const etqExt = [];
    function revelar() {
      graf.removePoint('min');
      for (const l of etqExt.splice(0)) { graf.group.remove(l); l.geometry.dispose(); l.material.map?.dispose(); l.material.dispose(); }
      if (s.revelar) {
        const o = M.optimo();
        graf.addPoint('min', o.x, o.largo, { color: 0x6fe3a2, labelX: 'x = 9', labelY: '50' });
        for (const [x, y, texto, dx] of [[0, ext.x0, `W(0) ≈ ${kit.num(ext.x0, 2)}`, 0.13], [30, ext.xd, `W(30) ≈ ${kit.num(ext.xd, 2)}`, -0.15]]) {
          const l = kit.createLabel(texto, { size: 0.036, color: '#0b1520', bg: '#e8eef4', weight: 700 });
          l.position.copy(graf.toLocal(x, y, 0.006)).add(new THREE.Vector3(dx, 0.045, 0));
          graf.group.add(l); etqExt.push(l);
        }
      }
      s.cambio = true;
    }

    // ------------------------------------------------------------ panel
    const irExtremo = () => fijarX(s.x === 0 ? M.d : 0);
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'Postes de 12 y 28 pies separados 30 pies. Dos cables van de lo alto de cada poste a una misma estaca en el suelo, entre los postes. ¿Dónde clavarla para usar el menor largo total de cable?',
      ecuaciones: [
        'W = y + z,    y² = x² + 12²,    z² = (30 − x)² + 28²',
        'W(x) = √(x² + 144) + √((30 − x)² + 784),  0 ≤ x ≤ 30',
      ],
      lecturas: [
        { etiqueta: 'estaca x', valor: () => `${kit.num(s.x, 1)} pies`, color: '#ffb347' },
        { etiqueta: 'cable y', valor: () => `${kit.num(M.y(s.x), 2)} pies`, color: '#ffd34d' },
        { etiqueta: 'cable z', valor: () => `${kit.num(M.z(s.x), 2)} pies`, color: '#c9a7ff' },
        { etiqueta: 'largo W = y + z', valor: () => `${kit.num(M.largo(s.x), 2)} pies`, color: '#6fe3a2' },
        { etiqueta: 'W en metros', valor: () => enM(M.largo(s.x)), color: '#6fe3a2' },
        { etiqueta: 'pendiente W′(x)', valor: () => kit.num(M.derivada(s.x), 3), color: '#e8eef4' },
      ],
      deslizadores: [{ etiqueta: 'Distancia x de la estaca al poste de 12 pies', min: 0, max: 30, paso: 0.1, get: () => s.x, set: (v) => fijarX(v), formato: (v) => `${kit.num(v, 1)} pies` }],
      botones: [
        { etiqueta: 'Ir al óptimo', accion: () => fijarX(M.optimo().x) },
        { etiqueta: 'Revelar solución', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
        { etiqueta: () => (s.x === 0 ? 'Extremo x = 30' : 'Extremo x = 0'), accion: irExtremo },
      ],
      lineasPie: 6,
      pie: () => (s.revelar
        ? 'W′(x) = x/√(x² + 144) − (30 − x)/√((30 − x)² + 784) = 0  ⇒  784x² = 144(30 − x)²  ⇒  x/12 = (30 − x)/28: los triángulos son semejantes y ambos cables forman el mismo ángulo con el suelo. x = 9 pies y W(9) = 15 + 35 = 50 pies, menor que W(0) ≈ 53,04 y W(30) ≈ 60,31. La estaca va a 9 pies del poste de 12 pies.'
        : 'Arrastra la estaca naranja, el gráfico o el deslizador. La estaca puede quedar al pie de cualquiera de los postes, así que x = 0 y x = 30 también cuentan: compara W en todo el intervalo cerrado.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-1.35, 1.38, 6.9); panel.mesh.rotation.y = 0.5;
    panel.mesh.renderOrder = 13; // tapa los rótulos que quedan detrás
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    iniciarObrero();
    if (s.revelar) revelar();
    construir(); s.cambio = false; graf.setMarker(s.x);
    animarObrero(0); animarTopografa(0);
    obrero.actualizar(0.01); topografa.actualizar(0.01);

    return {
      paneles: [panel],
      radioSombra: 13,
      alturaCartel: 10.4,
      vista: { escritorio: { camara: [0.3, 3.5, 13.4], objetivo: [0, 3.3, 0] }, vr: { pos: [0, 0, 8.3], yaw: 0 } },
      dom: [
        { tipo: 'rango', etiqueta: 'x', min: 0, max: 30, paso: 0.1, get: () => s.x, set: (v) => fijarX(v), formato: (v) => `${kit.num(v, 1)} pies` },
        { tipo: 'boton', etiqueta: 'Ir al óptimo', accion: () => fijarX(M.optimo().x) },
        { tipo: 'boton', etiqueta: () => (s.x === 0 ? 'Extremo x = 30' : 'Extremo x = 0'), accion: irExtremo },
        { tipo: 'interruptor', etiqueta: 'Revelar solución', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      actualizar(dt0) {
        const dt = Math.min(0.1, dt0 || 0);
        if (s.cambio) { s.cambio = false; construir(); graf.setMarker(s.x); panel.invalidate(); }
        animarTopografa(dt);
        topografa.actualizar(dt);
        if (Number.isFinite(REV.clavar) || Number.isFinite(REV.caminar)) {
          // revisión: animación del obrero detenida en un instante
          const p = puestoObrero(), camina = Number.isFinite(REV.caminar);
          ob.x = camina ? p.x - 1.2 : p.x; ob.ry = camina ? Math.PI / 2 : 0; ob.estado = camina ? 'caminar' : 'clavando';
          obrero.grupo.position.set(ob.x, 0, Z_OBRERO); obrero.grupo.rotation.y = ob.ry;
          obrero.mirar(objetivoO.copy(aMundo(xm(s.x), 0.3, 0)));
          arribaO.set(Math.sin(ob.ry) * 0.7, 0.7, Math.cos(ob.ry) * 0.7).transformDirection(g.matrixWorld);
          obrero.sostener(combo, { ...AGARRE, arribaMundo: arribaO.toArray() });
          obrero.fijarClip(camina ? CAMINAR : CLAVAR, camina ? REV.caminar : REV.clavar);
        } else {
          animarObrero(dt);
          obrero.actualizar(dt);
        }
        if (polvo.t < 0.8) {
          polvo.t += dt;
          const k = polvo.t / 0.8;
          polvo.sp.scale.setScalar(0.12 + 0.55 * k); polvo.sp.material.opacity = 0.85 * (1 - k); polvo.sp.position.y = 0.3 + 0.12 * k;
          if (k >= 1) polvo.sp.visible = false;
        }
      },
    };
  },
};
