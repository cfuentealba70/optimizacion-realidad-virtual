// Ejemplo 7. Dos aviones a la misma altura, en trayectorias perpendiculares que convergen en O.
// Sala de control de aproximación de un aeródromo, sobre piso técnico y bajo un techo traslúcido: mesa con un mapa en
// relieve a escala (1 mi ≈ 2,5 mm) y las maquetas de A y B, dos puestos de control con pantallas de radar, pantallas
// murales y dos controladores. La controladora señala el avión B y lo sigue con la mirada; el controlador escribe en su
// consola. La geometría fija se agrupa por material (una malla por material) para respetar el presupuesto de las Quest 3.
import { AVIONES as M } from '../../src/math/guia4.js';

const MI = 0.0025;  // metros de maqueta por milla
const PISO = 0.18;  // altura del piso técnico sobre el terreno
const TAU = Math.PI * 2;
const sstep = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const mono = (px, peso = 600) => `${peso} ${px}px Consolas, "Courier New", monospace`;

// Lote de piezas fijas: cada pieza se transforma, se pinta con color por vértice y se guarda en el grupo de su material.
// Al final cada grupo se une en una sola malla. Opciones: x, y, z, rx, ry, rz, orden, s (escala), m (matriz del conjunto),
// color, colorV(x, y, z) (color por posición), base [y0, y1, k] (oscurece hacia el suelo), uv: 'caja' (proyección en
// metros según la normal, con esc), 'rect' (la uv propia llevada a un rectángulo del atlas) o 'propia'.
function crearLote(kit) {
  const { THREE } = kit;
  const grupos = new Map();
  const mL = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), vp = new THREE.Vector3(), ve = new THREE.Vector3(), col = new THREE.Color();
  function poner(clave, geo, o = {}) {
    const gg = geo.index ? geo.toNonIndexed() : geo;
    if (gg !== geo) geo.dispose();
    eu.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, o.orden ?? 'XYZ');
    vp.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
    ve.set(...(o.s ?? [1, 1, 1]));
    mL.compose(vp, q.setFromEuler(eu), ve);
    if (o.m) mL.premultiply(o.m);
    gg.applyMatrix4(mL);
    for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') gg.deleteAttribute(k);
    const p = gg.attributes.position, n = gg.attributes.normal, N = p.count;
    if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(N * 2), 2));
    const uv = gg.attributes.uv, modo = o.uv ?? 'caja';
    if (modo === 'rect') {
      const [u0, v0, u1, v1] = o.rect;
      for (let i = 0; i < N; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    } else if (modo === 'caja') {
      const k = 1 / (o.esc ?? 1);
      for (let i = 0; i < N; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i) * k, p.getZ(i) * k);
        else if (ax >= az) uv.setXY(i, p.getZ(i) * k, p.getY(i) * k);
        else uv.setXY(i, p.getX(i) * k, p.getY(i) * k);
      }
    }
    col.set(o.color ?? 0xffffff);
    const c = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const cc = o.colorV ? o.colorV(p.getX(i), p.getY(i), p.getZ(i)) : col;
      const k = o.base ? o.base[2] + (1 - o.base[2]) * sstep(o.base[0], o.base[1], p.getY(i)) : 1;
      c[i * 3] = cc.r * k; c[i * 3 + 1] = cc.g * k; c[i * 3 + 2] = cc.b * k;
    }
    gg.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(gg);
  }
  function unir(clave) {
    const lista = grupos.get(clave);
    if (!lista || !lista.length) return null;
    const geo = kit.mergeGeometries(lista, false);
    for (const gg of lista) gg.dispose();
    grupos.delete(clave);
    return geo;
  }
  return { poner, unir };
}

// Desgaste: tono casi blanco con manchas, rayas finas y motas (se multiplica por el color de cada pieza)
function texturaMugre(kit, semilla) {
  const { THREE } = kit;
  const N = 256, a = kit.fbm(N, 4, 5, semilla), b = kit.fbm(N, 16, 3, semilla + 3), m = kit.fbm(N, 3, 3, semilla + 9);
  const c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data;
  for (let i = 0; i < N * N; i++) {
    const v = 238 - (a[i] - 0.5) * 30 - (b[i] - 0.5) * 16 - sstep(0.58, 0.86, m[i]) * 34;
    d[i * 4] = v; d[i * 4 + 1] = v * 0.993; d[i * 4 + 2] = v * 0.98; d[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const rnd = kit.mulberry32(semilla + 71);
  for (let k = 0; k < 110; k++) {
    const x0 = rnd() * N, y0 = rnd() * N, ang = rnd() * TAU, l = 5 + rnd() * 28;
    x.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.08 + rnd() * 0.14})` : `rgba(40,36,30,${0.06 + rnd() * 0.12})`;
    x.lineWidth = 0.6 + rnd() * 0.8; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + Math.cos(ang) * l, y0 + Math.sin(ang) * l); x.stroke();
  }
  for (let k = 0; k < 1600; k++) { x.fillStyle = `rgba(50,44,36,${rnd() * 0.14})`; x.fillRect(rnd() * N, rnd() * N, 1 + rnd(), 1 + rnd()); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Baldosas del piso técnico (60 cm): atlas de 2 × 2 variantes, tres de laminado con motas y marcas de ruedas y una
// perforada de acero, con su mapa de normales (juntas y perforaciones hundidas).
function texturasPiso(kit) {
  const { THREE } = kit;
  const S = 512, T = 256, P = (T - 28) / 15;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const ruido = kit.fbm(S, 8, 4, 17), nube = kit.fbm(S, 3, 3, 29);
  const img = x.createImageData(S, S), d = img.data, H = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const k = j * S + i, vi = (i >= T ? 1 : 0) + (j >= T ? 2 : 0), li = i % T, lj = j % T;
    const borde = Math.min(li, lj, T - 1 - li, T - 1 - lj);
    let r, gg, b, h = 1;
    if (vi === 3) {
      const v = 0.62 + (ruido[k] - 0.5) * 0.1 - sstep(0.6, 0.85, nube[k]) * 0.06;
      r = 170 * v + 28; gg = 174 * v + 28; b = 175 * v + 30;
      if (li > 14 && li < T - 14 && lj > 14 && lj < T - 14) {
        const fx = ((li - 14) % P) - P / 2, fy = ((lj - 14) % P) - P / 2;
        if (fx * fx + fy * fy < 13) { r = 20; gg = 21; b = 22; h = 0; }
      }
    } else {
      const v = 0.8 + [0, 0.03, -0.025][vi] + (ruido[k] - 0.5) * 0.07 - sstep(0.55, 0.85, nube[k]) * 0.07;
      r = 214 * v; gg = 209 * v; b = 197 * v;
    }
    if (borde < 3) { r = 44; gg = 45; b = 46; h = 0.1; } else if (borde < 6) { r *= 1.05; gg *= 1.05; b *= 1.05; h = 0.8; }
    d[k * 4] = r; d[k * 4 + 1] = gg; d[k * 4 + 2] = b; d[k * 4 + 3] = 255; H[k] = h;
  }
  x.putImageData(img, 0, 0);
  const rnd = kit.mulberry32(5);
  for (let v = 0; v < 3; v++) {
    const ox = (v % 2) * T, oy = Math.floor(v / 2) * T;
    x.save(); x.beginPath(); x.rect(ox + 6, oy + 6, T - 12, T - 12); x.clip();
    for (let k = 0; k < 1100; k++) {
      x.fillStyle = rnd() < 0.6 ? `rgba(70,66,60,${0.15 + rnd() * 0.25})` : `rgba(255,255,255,${0.2 + rnd() * 0.3})`;
      x.fillRect(ox + rnd() * T, oy + rnd() * T, 1.3, 1.3);
    }
    for (let k = 0; k < 8; k++) { // marcas de las ruedas de las sillas
      x.strokeStyle = `rgba(60,56,50,${0.05 + rnd() * 0.08})`; x.lineWidth = 2 + rnd() * 3;
      const cx = ox + rnd() * T, cy = oy + rnd() * T, rr = 20 + rnd() * 80, a0 = rnd() * TAU;
      x.beginPath(); x.arc(cx, cy, rr, a0, a0 + 0.5 + rnd()); x.stroke();
    }
    x.restore();
  }
  const n = document.createElement('canvas'); n.width = n.height = S;
  const nx = n.getContext('2d'), ni = nx.createImageData(S, S), nd = ni.data, f = 2.2;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const k = j * S + i;
    const l = H[j * S + ((i - 1 + S) % S)], r = H[j * S + ((i + 1) % S)], u = H[((j - 1 + S) % S) * S + i], dn = H[((j + 1) % S) * S + i];
    const vx = (l - r) * f, vy = (dn - u) * f, len = Math.hypot(vx, vy, 1);
    nd[k * 4] = (vx / len * 0.5 + 0.5) * 255; nd[k * 4 + 1] = (vy / len * 0.5 + 0.5) * 255; nd[k * 4 + 2] = (1 / len * 0.5 + 0.5) * 255; nd[k * 4 + 3] = 255;
  }
  nx.putImageData(ni, 0, 0);
  const map = new THREE.CanvasTexture(c), normalMap = new THREE.CanvasTexture(n);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; normalMap.anisotropy = 8;
  return { map, normalMap };
}

// Contorno irregular (para parches de grava) en el plano xz, con uv en metros / 2
function parcheIrregular(THREE, rx, rz, fase = 0) {
  const geo = new THREE.CircleGeometry(1, 80);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    let px = p.getX(i), py = p.getY(i);
    if (i > 0) {
      const a = Math.atan2(py, px), r = 1 + 0.06 * Math.sin(3 * a + fase) + 0.04 * Math.sin(5 * a + 2 * fase) + 0.02 * Math.sin(13 * a + 1);
      px = Math.cos(a) * r; py = Math.sin(a) * r;
    }
    px *= rx; py *= rz;
    p.setXY(i, px, py); uv.setXY(i, px / 1.1, py / 1.1);
  }
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Trazos a mano alzada (anotaciones en papeles y fajas)
function garabato(x, rnd, x0, y0, w, h, color, n = 2) {
  x.save(); x.strokeStyle = color; x.lineWidth = 1.1; x.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const y = y0 + ((k + 0.5) * h) / n, fin = x0 + w * (0.55 + rnd() * 0.45);
    let px = x0;
    x.beginPath(); x.moveTo(px, y);
    while (px < fin) {
      const paso = 2 + rnd() * 4;
      x.quadraticCurveTo(px + paso / 2, y - (0.3 + rnd() * 0.7) * (h / n) * 0.8, px + paso, y + (rnd() - 0.5) * 2);
      px += paso;
    }
    x.stroke();
  }
  x.restore();
}

export default {
  id: 'aviones',
  tipo: 'razon',
  etiqueta: 'Ejemplo 7 · Razón de cambio',
  titulo: 'Aviones que convergen',
  resumen: 'Un controlador aéreo detecta que dos aviones que vuelan a la misma altura tienen trayectorias perpendiculares que convergen en un punto O. Uno está a 225 mi de O y vuela a 450 mi/h; el otro está a 300 mi de O y vuela a 600 mi/h. ¿A qué velocidad se reduce la distancia entre ellos?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const reloj = kit.reloj({ t0: -0.1, t1: M.llegada(), instante: M.instante, velocidad: 0.04 });
    const s = { revelar: false, ultimo: -1, tiempo: 0, tPantalla: 1, mirada: 0, tMirada: 4.5 };
    const conflicto = () => reloj.t >= M.llegada() - 1e-9;
    // rev=t:0.3 deja el reloj fijo en t = 0,3 h al cargar (revisión de capturas); sin el parámetro no hace nada
    const rev = /(?:^|[?&])rev=t:(-?[\d.]+)/.exec(location.search);
    // rótulos de la escena: se dibujan antes que el panel y el gráfico para que estos los tapen
    const etq = (texto, alto, opts) => {
      const l = kit.etiqueta(texto, alto, opts);
      l.renderOrder = 3; l.material.depthWrite = true; l.material.alphaTest = 0.5; // escriben profundidad: lo lejano no los tapa
      return l;
    };
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const Yv = V(0, 1, 0);
    // la sala: dentro de s0 las alturas se miden desde el piso técnico
    const s0 = new THREE.Group(); s0.position.y = PISO; g.add(s0);

    // ------------------------------------------------------------ lote de piezas fijas y atajos de geometría
    const L = crearLote(kit);
    const marco = (x, y, z, ry = 0, base = null, rx = 0, rz = 0) => {
      const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V(1, 1, 1));
      return base ? base.clone().multiply(m) : m;
    };
    const S = (geo, o) => L.poner('sat', geo, o), Ma = (geo, o) => L.poner('mate', geo, o), Me = (geo, o) => L.poner('metal', geo, o);
    const Pa = (geo, r, o = {}) => L.poner('papel', geo, { ...o, uv: 'rect', rect: uvP(r) });
    const Pn = (geo, r, o = {}) => L.poner('pant', geo, { ...o, uv: 'rect', rect: uvR(r) });
    const caja = (w, h, d, a = 1, b = 1, c = 1) => new THREE.BoxGeometry(w, h, d, a, b, c);
    const cil = (r0, r1, h, seg = 20, abierto = false) => new THREE.CylinderGeometry(r1, r0, h, seg, 1, abierto);
    const esfera = (r, a = 18, b = 12) => new THREE.SphereGeometry(r, a, b);
    const plano = (w, h) => new THREE.PlaneGeometry(w, h);
    const suelo = (w, h) => new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2);
    const barraGeo = (a, b, r, seg = 8) => {
      const A = V(...a), B = V(...b), d = B.clone().sub(A), len = d.length();
      const geo = new THREE.CylinderGeometry(r, r, len, seg);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Yv, d.normalize()));
      geo.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
      return geo;
    };
    const tubo = (pts, r, seg = 32, rad = 8) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), seg, r, rad, false);

    // ------------------------------------------------------------ materiales compartidos
    const MAT = {
      sat: new THREE.MeshStandardMaterial({ vertexColors: true, map: texturaMugre(kit, 5), roughness: 0.5, metalness: 0.06, normalMap: kit.makeSurface('plaster', { size: 256, seed: 12, roughness: false }).normalMap, normalScale: new THREE.Vector2(0.12, 0.12) }),
      mate: new THREE.MeshStandardMaterial({ vertexColors: true, map: texturaMugre(kit, 9), roughness: 0.93, normalMap: kit.makeSurface('sand', { size: 256, seed: 4, roughness: false }).normalMap, normalScale: new THREE.Vector2(0.45, 0.45) }),
      metal: kit.mat('metal', { repeat: [1, 1], metalness: 0.8, roughness: 1 }),
      madera: kit.mat('wood', { repeat: [1, 1], roughness: 1 }),
      acan: kit.mat('ribbed', { repeat: [1, 1], roughness: 1 }),
    };
    for (const k of ['metal', 'madera', 'acan']) MAT[k].vertexColors = true;
    {
      const pt = texturasPiso(kit);
      MAT.piso = new THREE.MeshStandardMaterial({ vertexColors: true, map: pt.map, normalMap: pt.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.6, metalness: 0.04 });
    }

    // ------------------------------------------------------------ mapa: medidas y relieve (ruido fractal)
    const MESA = 0.9, BASE = 0.905, MW = 1.5, MD = 1.9;
    const OX = -0.42, OZ = 0.52;           // punto de convergencia O sobre el mapa
    const VUELO = BASE + 0.15;             // altura de vuelo de las maquetas
    const posA = (t) => [OX + M.x(t) * MI, VUELO, OZ];
    const posB = (t) => [OX, VUELO, OZ - M.y(t) * MI];
    const NS = 256, ruido1 = kit.fbm(NS, 3, 5, 77), ruido2 = kit.fbm(NS, 10, 3, 91);
    const muestra = (f, u, v) => {
      const x = u * NS - 0.5, y = v * NS - 0.5, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const at = (a, b) => f[(((b % NS) + NS) % NS) * NS + (((a % NS) + NS) % NS)];
      return (at(xi, yi) * (1 - fx) + at(xi + 1, yi) * fx) * (1 - fy) + (at(xi, yi + 1) * (1 - fx) + at(xi + 1, yi + 1) * fx) * fy;
    };
    const AGUA = 0.43, CIMA = 0.7;
    const nivel = (u, v) => muestra(ruido1, u * 0.9 + 0.13, v * 1.14 + 0.27) * 0.82 + muestra(ruido2, u, v * 1.27) * 0.18;
    // u hacia +x, v hacia +z (v = 0 en el borde del fondo)
    const altura = (u, v) => {
      const borde = sstep(0, 0.05, Math.min(u * MW, (1 - u) * MW, v * MD, (1 - v) * MD));
      const e = Math.min(1, Math.max(0, (nivel(u, v) - AGUA) / (CIMA - AGUA)));
      return (0.002 + Math.pow(e, 1.8) * 0.05) * borde;
    };
    const alturaEn = (x, z) => BASE + altura((x + MW / 2) / MW, (z + MD / 2) / MD);

    // ------------------------------------------------------------ atlas de papeles impresos (material iluminado)
    const AP = 512, lienzoP = document.createElement('canvas'); lienzoP.width = lienzoP.height = AP;
    const P = {
      letrero: [0, 0, 512, 64], tiras: [0, 64, 256, 120], hoja: [256, 64, 128, 180], plan: [384, 64, 128, 180], carta: [0, 184, 256, 128],
      libreta: [256, 244, 128, 100], aviso: [384, 244, 128, 128], etiq: [0, 312, 256, 48], regla: [0, 360, 256, 20], blanco: [496, 496, 16, 16],
    };
    const uvP = (r, m = 1) => [(r[0] + m) / AP, 1 - (r[1] + r[3] - m) / AP, (r[0] + r[2] - m) / AP, 1 - (r[1] + m) / AP];
    pintarPapel();
    const texPapel = new THREE.CanvasTexture(lienzoP); texPapel.colorSpace = THREE.SRGBColorSpace; texPapel.anisotropy = 8;
    MAT.papel = new THREE.MeshStandardMaterial({ vertexColors: true, map: texPapel, roughness: 0.82 });

    function pintarPapel() {
      const x = lienzoP.getContext('2d'), rnd = kit.mulberry32(77);
      x.fillStyle = '#f3f1ea'; x.fillRect(0, 0, AP, AP);
      x.textBaseline = 'middle'; x.textAlign = 'left';
      { // letrero de la caseta
        const [px, py, w, h] = P.letrero;
        x.fillStyle = '#1c3d66'; x.fillRect(px, py, w, h); x.fillStyle = '#f2b233'; x.fillRect(px, py + h - 9, w, 9);
        x.fillStyle = '#ffffff'; x.font = kit.font(31, 800); x.textAlign = 'center'; x.fillText('CONTROL DE TRÁNSITO AÉREO', px + w / 2, py + 27); x.textAlign = 'left';
      }
      { // fajas de progreso de vuelo
        const [px, py] = P.tiras, fondos = ['#f1e4c0', '#d5e4f2', '#f1e4c0', '#f2f0e8', '#dfecd2', '#d5e4f2'];
        const vuelos = [['A', '350', '450', 'O'], ['B', '350', '600', 'O'], ['C', '280', '420', 'P'], ['D', '310', '480', 'Q'], ['E', '240', '380', 'R'], ['F', '200', '350', 'S']];
        for (let k = 0; k < 6; k++) {
          const y = py + k * 20, [v, fl, vel, fijo] = vuelos[k];
          x.fillStyle = fondos[k]; x.fillRect(px, y, 256, 20);
          x.strokeStyle = 'rgba(60,50,40,0.55)'; x.lineWidth = 1; x.strokeRect(px + 0.5, y + 0.5, 255, 19);
          for (const cx of [40, 92, 132, 184]) { x.beginPath(); x.moveTo(px + cx, y); x.lineTo(px + cx, y + 20); x.stroke(); }
          x.fillStyle = '#1b1b1b'; x.font = mono(14, 700); x.fillText(v, px + 12, y + 10.5);
          x.font = mono(9, 600); x.fillText('FL' + fl, px + 46, y + 6); x.fillText(vel + ' mi/h', px + 46, y + 15);
          x.fillText(fijo, px + 108, y + 10.5); x.fillText('19:' + (30 + k * 6), px + 140, y + 10.5);
          garabato(x, rnd, px + 190, y + 3, 60, 14, k % 2 ? '#1f3f9a' : '#b3261e', 2);
        }
      }
      { // hoja impresa con avisos
        const [px, py, w, h] = P.hoja;
        x.fillStyle = '#f6f5f0'; x.fillRect(px, py, w, h);
        x.fillStyle = '#222'; x.font = kit.font(11, 800); x.fillText('NOTAM', px + 8, py + 13);
        x.font = kit.font(7, 500); x.fillText('Aeródromo · sector sur', px + 52, py + 13);
        for (let k = 0; k < 20; k++) { x.fillStyle = `rgba(40,40,40,${0.5 + rnd() * 0.3})`; x.fillRect(px + 8, py + 26 + k * 7.4, (w - 16) * (0.45 + rnd() * 0.55), 2.2); }
        x.strokeStyle = 'rgba(180,40,40,0.55)'; x.lineWidth = 2; x.beginPath(); x.arc(px + w - 26, py + h - 24, 14, 0, TAU); x.stroke();
      }
      { // formulario de plan de vuelo (va en la tablilla de la controladora)
        const [px, py, w, h] = P.plan;
        x.fillStyle = '#f7f6f1'; x.fillRect(px, py, w, h);
        x.fillStyle = '#1d2a44'; x.font = kit.font(10, 800); x.fillText('PLAN DE VUELO', px + 8, py + 12);
        x.strokeStyle = 'rgba(30,40,70,0.7)'; x.lineWidth = 1;
        for (let r = 0; r < 9; r++) for (let c = 0; c < 3; c++) x.strokeRect(px + 7.5 + c * 38, py + 22.5 + r * 17, 36, 15);
        for (let r = 0; r < 9; r++) for (let c = 0; c < 3; c++) if ((r + c) % 3 !== 2) garabato(x, rnd, px + 10 + c * 38, py + 25 + r * 17, 30, 10, '#22408f', 1);
        void w; void h;
      }
      { // carta de aproximación
        const [px, py, w, h] = P.carta;
        x.fillStyle = '#eef0e8'; x.fillRect(px, py, w, h);
        x.strokeStyle = 'rgba(30,70,140,0.7)'; x.lineWidth = 1.2;
        for (const r of [20, 40, 60]) { x.beginPath(); x.arc(px + 90, py + 64, r, 0, TAU); x.stroke(); }
        x.beginPath(); x.moveTo(px + 10, py + 110); x.lineTo(px + 240, py + 20); x.moveTo(px + 90, py + 4); x.lineTo(px + 90, py + 124); x.stroke();
        x.fillStyle = '#1e3c78'; x.font = kit.font(10, 700); x.fillText('CARTA DE APROXIMACIÓN', px + 118, py + 112);
        for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(30,60,120,0.6)'; x.fillRect(px + 160, py + 30 + k * 9, 70 * (0.5 + rnd() * 0.5), 2); }
        void w; void h;
      }
      { // libreta con anotaciones
        const [px, py, w, h] = P.libreta;
        x.fillStyle = '#fbfaf3'; x.fillRect(px, py, w, h);
        x.strokeStyle = 'rgba(90,130,200,0.45)'; x.lineWidth = 1;
        for (let k = 1; k < 9; k++) { x.beginPath(); x.moveTo(px, py + k * 11); x.lineTo(px + w, py + k * 11); x.stroke(); }
        x.strokeStyle = 'rgba(200,60,60,0.5)'; x.beginPath(); x.moveTo(px + 16, py); x.lineTo(px + 16, py + h); x.stroke();
        for (let k = 1; k < 8; k++) garabato(x, rnd, px + 20, py + k * 11 - 8, w - 28, 8, '#283e8c', 1);
      }
      { // aviso de piso abierto
        const [px, py, w, h] = P.aviso;
        x.fillStyle = '#f2c230'; x.fillRect(px, py, w, h);
        x.strokeStyle = '#151515'; x.lineWidth = 5; x.strokeRect(px + 5, py + 5, w - 10, h - 10);
        x.fillStyle = '#151515'; x.beginPath(); x.moveTo(px + w / 2, py + 14); x.lineTo(px + w / 2 + 32, py + 68); x.lineTo(px + w / 2 - 32, py + 68); x.closePath(); x.fill();
        x.fillStyle = '#f2c230'; x.beginPath(); x.moveTo(px + w / 2, py + 26); x.lineTo(px + w / 2 + 22, py + 63); x.lineTo(px + w / 2 - 22, py + 63); x.closePath(); x.fill();
        x.fillStyle = '#151515'; x.textAlign = 'center'; x.font = kit.font(26, 900); x.fillText('!', px + w / 2, py + 50);
        x.font = kit.font(18, 900); x.fillText('PISO', px + w / 2, py + 88); x.fillText('ABIERTO', px + w / 2, py + 108); x.textAlign = 'left';
      }
      ['POS 1 · APROXIMACIÓN', 'POS 2 · TORRE'].forEach((t, k) => { // placas de los puestos
        const y = P.etiq[1] + k * 24;
        x.fillStyle = '#2a3138'; x.fillRect(0, y, 256, 24); x.fillStyle = '#e8edf2'; x.font = kit.font(14, 700); x.textAlign = 'center'; x.fillText(t, 128, y + 12.5); x.textAlign = 'left';
      });
      { // regla de acero
        const [px, py, w, h] = P.regla;
        x.fillStyle = '#c9ccce'; x.fillRect(px, py, w, h); x.fillStyle = '#1a1a1a';
        for (let k = 0; k <= 124; k++) x.fillRect(px + 4 + k * 2, py, 0.8, k % 10 === 0 ? 9 : k % 5 === 0 ? 6 : 3);
        x.font = mono(7, 600); for (let k = 0; k <= 12; k++) x.fillText(String(k * 5), px + 3 + k * 20, py + 14);
      }
      x.fillStyle = '#ffffff'; x.fillRect(...P.blanco);
    }

    // ------------------------------------------------------------ atlas emisivo de 512 px: radares, listas, difusores y pilotos
    const AT = 512, lienzoE = document.createElement('canvas'); lienzoE.width = lienzoE.height = AT;
    const cxE = lienzoE.getContext('2d');
    const R = {
      radar: [0, 0, 256, 256], muro: [256, 0, 256, 144], info: [256, 144, 256, 144], lista: [0, 256, 200, 125], datos: [200, 256, 200, 125],
      vcs: [400, 288, 112, 80], tel: [400, 368, 112, 32], reloj: [0, 400, 128, 40],
      blanco: [496, 496, 16, 16], verde: [480, 496, 16, 16], rojo: [464, 496, 16, 16], ambar: [448, 496, 16, 16], azul: [432, 496, 16, 16],
    };
    const uvR = (r, m = 1) => [(r[0] + m) / AT, 1 - (r[1] + r[3] - m) / AT, (r[0] + r[2] - m) / AT, 1 - (r[1] + m) / AT];
    const texPant = new THREE.CanvasTexture(lienzoE); texPant.colorSpace = THREE.SRGBColorSpace; texPant.anisotropy = 8;
    MAT.pant = new THREE.MeshStandardMaterial({ color: 0x07090b, emissive: 0xffffff, emissiveMap: texPant, emissiveIntensity: 1.15, roughness: 0.22, metalness: 0.1 });

    // tierra y agua del mismo relieve del mapa, en celdas de 2 px, con O en (cx, cy) y k píxeles por milla
    function pintarCosta(x, cx, cy, k, w, h, rad = 0) {
      for (let py = 0; py < h; py += 2) for (let px = 0; px < w; px += 2) {
        if (rad && (px + 1 - cx) ** 2 + (py + 1 - cy) ** 2 > rad * rad) continue;
        const mx = (px + 1 - cx) / k, my = (cy - py - 1) / k;
        const u = (OX + mx * MI + MW / 2) / MW, v = (OZ - my * MI + MD / 2) / MD;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        const e = nivel(u, v);
        x.fillStyle = e < AGUA ? '#0a1a26' : e > AGUA + 0.12 ? '#1f2e35' : '#18262d';
        x.fillRect(px, py, 2, 2);
      }
    }
    // fondo fijo del radar de los puestos: centrado en O, alcance de 400 mi
    const RC = 128, RR = 118, RK = RR / 400;
    const fondoRadar = document.createElement('canvas'); fondoRadar.width = fondoRadar.height = 256;
    {
      const x = fondoRadar.getContext('2d');
      x.fillStyle = '#04090d'; x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#08131b'; x.beginPath(); x.arc(RC, RC, RR, 0, TAU); x.fill();
      pintarCosta(x, RC, RC, RK, 256, 256, RR);
      for (let r = 50; r <= 400; r += 50) { x.strokeStyle = r % 100 ? 'rgba(80,160,180,0.16)' : 'rgba(100,190,210,0.42)'; x.lineWidth = 1; x.beginPath(); x.arc(RC, RC, r * RK, 0, TAU); x.stroke(); }
      for (let k = 0; k < 72; k++) {
        const a = (k / 72) * TAU, l = k % 9 === 0 ? 8 : k % 3 === 0 ? 5 : 2.5;
        x.strokeStyle = 'rgba(120,200,220,0.55)'; x.beginPath(); x.moveTo(RC + Math.sin(a) * RR, RC - Math.cos(a) * RR); x.lineTo(RC + Math.sin(a) * (RR - l), RC - Math.cos(a) * (RR - l)); x.stroke();
      }
      x.setLineDash([4, 3]); x.lineWidth = 1.2;
      x.strokeStyle = 'rgba(255,179,71,0.5)'; x.beginPath(); x.moveTo(RC, RC); x.lineTo(RC + RR, RC); x.stroke();
      x.strokeStyle = 'rgba(92,200,255,0.5)'; x.beginPath(); x.moveTo(RC, RC); x.lineTo(RC, RC - RR); x.stroke();
      x.setLineDash([]);
      x.strokeStyle = '#e8f1f8'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(RC, RC - 4); x.lineTo(RC + 4, RC + 3); x.lineTo(RC - 4, RC + 3); x.closePath(); x.stroke();
      x.textBaseline = 'middle'; x.fillStyle = '#c8d8e4'; x.font = mono(9, 700); x.fillText('O', RC - 13, RC + 9);
      x.fillText('N', RC - 3, RC - RR + 14);
      x.fillStyle = '#7fa8c0'; x.font = mono(8, 600); x.fillText('APP 400 MI', 5, 9); x.fillText('QNH 1018', 5, 248);
      x.textAlign = 'right'; x.fillText('FL350', 251, 9); x.fillText('19:42', 251, 248); x.textAlign = 'left';
    }
    // fondo fijo de la pantalla mural: O abajo a la izquierda, A al este y B al norte
    const MU = { cx: 58, cy: 122, k: 0.26 };
    const fondoMuro = document.createElement('canvas'); fondoMuro.width = 256; fondoMuro.height = 144;
    {
      const x = fondoMuro.getContext('2d');
      x.fillStyle = '#050c13'; x.fillRect(0, 0, 256, 144);
      pintarCosta(x, MU.cx, MU.cy, MU.k, 256, 144);
      x.strokeStyle = 'rgba(110,170,200,0.14)'; x.lineWidth = 1;
      for (let m = -200; m <= 800; m += 100) { const px = MU.cx + m * MU.k; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, 144); x.stroke(); }
      for (let m = -100; m <= 600; m += 100) { const py = MU.cy - m * MU.k; x.beginPath(); x.moveTo(0, py); x.lineTo(256, py); x.stroke(); }
      x.strokeStyle = 'rgba(255,179,71,0.4)'; x.beginPath(); x.moveTo(MU.cx, MU.cy); x.lineTo(256, MU.cy); x.stroke();
      x.strokeStyle = 'rgba(92,200,255,0.4)'; x.beginPath(); x.moveTo(MU.cx, MU.cy); x.lineTo(MU.cx, 0); x.stroke();
      x.strokeStyle = '#e8f1f8'; x.lineWidth = 1.4; x.beginPath(); x.arc(MU.cx, MU.cy, 4, 0, TAU); x.stroke();
      x.textBaseline = 'middle'; x.fillStyle = '#e8f1f8'; x.font = mono(9, 700); x.fillText('O', MU.cx - 14, MU.cy + 8);
      x.fillStyle = 'rgba(16,34,52,0.92)'; x.fillRect(0, 0, 256, 15); x.fillStyle = '#d8e6f2'; x.font = mono(9, 700); x.fillText('VIGILANCIA · SECTOR SUR', 5, 8);
    }

    function pintarPantallasFijas() {
      const x = cxE;
      x.fillStyle = '#000'; x.fillRect(0, 0, AT, AT);
      x.textBaseline = 'middle'; x.textAlign = 'left';
      const sw = (r, c) => { x.fillStyle = c; x.fillRect(r[0], r[1], r[2], r[3]); };
      sw(R.blanco, '#ffffff'); sw(R.verde, '#3ee07a'); sw(R.rojo, '#ff3a2e'); sw(R.ambar, '#ffb02e'); sw(R.azul, '#3aa0ff');
      { // lista de llegadas
        const [px, py, w, h] = R.lista;
        x.fillStyle = '#0d1620'; x.fillRect(px, py, w, h);
        x.fillStyle = '#1f3b57'; x.fillRect(px, py, w, 16); x.fillStyle = '#d8e6f2'; x.font = mono(10, 700); x.fillText('LISTA DE LLEGADAS', px + 6, py + 8.5);
        x.font = mono(9, 600); x.fillStyle = '#7f98ad'; x.fillText('VUELO NIVEL  VEL  FIJO', px + 6, py + 25);
        const filas = [['A', 'FL350', '450', 'O', '#ffb347'], ['B', 'FL350', '600', 'O', '#5cc8ff'], ['C', 'FL280', '420', 'P', null], ['D', 'FL310', '480', 'Q', null], ['E', 'FL240', '380', 'R', null], ['F', 'FL200', '350', 'S', null]];
        filas.forEach(([v, n, vel, f, c], k) => {
          const y = py + 39 + k * 14.2;
          if (c) { x.fillStyle = c + '30'; x.fillRect(px + 2, y - 6.5, w - 4, 13); }
          x.fillStyle = c || '#9fb4c8'; x.fillText(`${v}     ${n}  ${vel}   ${f}`, px + 6, y);
        });
        void h;
      }
      { // plano del aeródromo y estado de la pista
        const [px, py, w, h] = R.datos;
        x.fillStyle = '#0b1219'; x.fillRect(px, py, w, h);
        x.save(); x.translate(px + w / 2, py + h / 2 + 6); x.rotate(-0.55);
        x.fillStyle = '#56606a'; x.fillRect(-80, -7, 160, 14);
        x.strokeStyle = '#e8ecef'; x.setLineDash([6, 5]); x.lineWidth = 1; x.beginPath(); x.moveTo(-72, 0); x.lineTo(72, 0); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#3c4650'; x.fillRect(-60, 7, 8, 22); x.fillRect(20, 7, 8, 22); x.fillRect(-64, 26, 100, 7);
        x.fillStyle = '#e8ecef'; x.font = mono(9, 700); x.fillText('21', 62, -15); x.fillText('03', -82, -15);
        x.restore();
        x.fillStyle = '#9fd0ff'; x.font = mono(9, 700); x.fillText('ATIS K · QNH 1018', px + 6, py + 10);
        x.fillStyle = '#7fe3a2'; x.fillText('PISTA 21 EN USO', px + 6, py + h - 9);
      }
      { // meteorología en la pantalla mural derecha
        const [px, py, w, h] = R.info;
        x.fillStyle = '#0a1520'; x.fillRect(px, py, w, h);
        x.fillStyle = '#1f3b57'; x.fillRect(px, py, w, 20); x.fillStyle = '#e6eef6'; x.font = kit.font(11, 700); x.fillText('AERÓDROMO · METEOROLOGÍA', px + 8, py + 11);
        const filas = [['PISTA EN USO', '21'], ['VIENTO', '210° / 8 kt'], ['QNH', '1018 hPa'], ['VISIBILIDAD', '10 km'], ['TEMPERATURA', '17 °C'], ['NUBES', 'FEW 3000 ft']];
        x.font = mono(10, 600);
        filas.forEach(([a, b], k) => { const y = py + 33 + k * 17.5; x.fillStyle = '#7f98ad'; x.fillText(a, px + 8, y); x.fillStyle = '#e8f1f8'; x.fillText(b, px + 96, y); });
        const cx = px + w - 44, cy = py + 82, r = 33;
        x.strokeStyle = '#4f6b85'; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke();
        for (let k = 0; k < 36; k++) { const a = (k * TAU) / 36, l = k % 9 === 0 ? 7 : 3; x.beginPath(); x.moveTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r); x.lineTo(cx + Math.sin(a) * (r - l), cy - Math.cos(a) * (r - l)); x.stroke(); }
        x.fillStyle = '#9fb4c8'; x.font = mono(8, 700); x.textAlign = 'center'; x.fillText('N', cx, cy - r - 7); x.textAlign = 'left';
        const a = (210 * Math.PI) / 180;
        x.strokeStyle = '#7fe3a2'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx + Math.sin(a) * (r - 4), cy - Math.cos(a) * (r - 4)); x.lineTo(cx - Math.sin(a) * 10, cy + Math.cos(a) * 10); x.stroke();
        void h;
      }
      { // panel táctil de comunicaciones
        const [px, py] = R.vcs, et = ['TWR', 'APP', 'GND', 'TEL 1', 'TEL 2', 'EMERG', '118,1', '119,7', '121,5'];
        x.fillStyle = '#0c1117'; x.fillRect(px, py, R.vcs[2], R.vcs[3]);
        et.forEach((t, k) => {
          const bx = px + 4 + (k % 3) * 36, by = py + 4 + Math.floor(k / 3) * 25;
          x.fillStyle = k === 5 ? '#7a1e1e' : k === 1 || k === 7 ? '#1f6b3c' : '#26323f'; kit.roundRect(x, bx, by, 32, 21, 3); x.fill();
          x.fillStyle = '#e6eef6'; x.font = kit.font(8, 700); x.textAlign = 'center'; x.fillText(t, bx + 16, by + 11); x.textAlign = 'left';
        });
      }
      { const [px, py, w, h] = R.tel; x.fillStyle = '#9fb88a'; x.fillRect(px, py, w, h); x.fillStyle = '#1e2a16'; x.font = mono(11, 700); x.fillText('LÍNEA 2  19:42', px + 6, py + h / 2); }
      { const [px, py, w, h] = R.reloj; x.fillStyle = '#050505'; x.fillRect(px, py, w, h); x.fillStyle = '#ff3324'; x.font = mono(31, 700); x.textAlign = 'center'; x.fillText('19:42', px + w / 2, py + h / 2 + 1); x.textAlign = 'left'; }
    }

    // radar de los puestos: barrido sincronizado con la antena de afuera, A y B con su estela de ecos y su rótulo
    function pintarRadar() {
      const x = cxE, [px, py] = R.radar, t = reloj.t;
      x.save(); x.translate(px, py); x.beginPath(); x.rect(0, 0, 256, 256); x.clip();
      x.drawImage(fondoRadar, 0, 0);
      const ang = (antena.rotation.y % TAU) - Math.PI / 2, cola = 1.1;
      const gr = x.createConicGradient(ang - cola, RC, RC);
      gr.addColorStop(0, 'rgba(70,235,160,0)'); gr.addColorStop(cola / TAU - 0.002, 'rgba(70,235,160,0.3)'); gr.addColorStop(cola / TAU, 'rgba(70,235,160,0)'); gr.addColorStop(1, 'rgba(70,235,160,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(RC, RC, RR, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(140,255,200,0.75)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(RC, RC); x.lineTo(RC + Math.cos(ang) * RR, RC + Math.sin(ang) * RR); x.stroke();
      const alerta = M.s(t) < 110 || conflicto(), on = Math.sin(s.tiempo * 8) > -0.2;
      x.textBaseline = 'middle';
      for (const [n, c, v] of [['A', '#ffcf6b', '450'], ['B', '#7fd8ff', '600']]) {
        const pos = (tt) => (n === 'A' ? [RC + M.x(tt) * RK, RC] : [RC, RC - M.y(tt) * RK]);
        for (let k = 6; k >= 1; k--) { const [hx, hy] = pos(t - k * 0.025); x.fillStyle = `rgba(190,225,240,${0.1 + 0.07 * (6 - k)})`; x.fillRect(hx - 1, hy - 1, 2.2, 2.2); }
        const [qx, qy] = pos(t), [vx, vy] = pos(t + 0.06);
        x.strokeStyle = c; x.lineWidth = 1.2; x.beginPath(); x.moveTo(qx, qy); x.lineTo(vx, vy); x.stroke();
        x.strokeStyle = alerta && on ? '#ff5a4a' : '#ffffff'; x.lineWidth = 1.6; x.strokeRect(qx - 3, qy - 3, 6, 6);
        const lx = qx + 9, ly = n === 'A' ? qy - 20 : qy - 8;
        x.strokeStyle = 'rgba(200,220,230,0.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo(qx + 3, qy - 3); x.lineTo(lx - 1, ly + 5); x.stroke();
        x.fillStyle = alerta && on ? '#ff6a5a' : c; x.font = mono(10, 700); x.fillText(`${n} 350`, lx, ly); x.font = mono(9, 600); x.fillText(v, lx, ly + 10);
      }
      if (alerta) { x.fillStyle = on ? '#ff3a2e' : '#6e1a14'; x.fillRect(64, 226, 128, 15); x.fillStyle = '#ffffff'; x.font = mono(9, 700); x.textAlign = 'center'; x.fillText('ALERTA DE CONFLICTO', 128, 234); x.textAlign = 'left'; }
      x.restore();
    }
    // pantalla mural: rutas previstas hasta O, tiempo de llegada y separación
    function pintarMuro() {
      const x = cxE, [px, py, w, h] = R.muro, { cx, cy, k } = MU, t = reloj.t;
      x.save(); x.translate(px, py); x.beginPath(); x.rect(0, 0, w, h); x.clip();
      x.drawImage(fondoMuro, 0, 0);
      const alerta = M.s(t) < 110 || conflicto(), on = Math.sin(s.tiempo * 8) > -0.2;
      x.textBaseline = 'middle';
      for (const [p, c, n] of [[[cx + M.x(t) * k, cy], '#ffb347', 'A'], [[cx, cy - M.y(t) * k], '#5cc8ff', 'B']]) {
        x.strokeStyle = c; x.lineWidth = 1.4; x.setLineDash([2, 3]); x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(cx, cy); x.stroke(); x.setLineDash([]);
        x.fillStyle = alerta && on ? '#ff5a4a' : c; x.beginPath(); x.arc(p[0], p[1], 3.2, 0, TAU); x.fill();
        x.font = mono(10, 700); x.fillText(n, p[0] + 6, p[1] - 7);
      }
      const tO = Math.max(0, (M.llegada() - t) * 60);
      x.font = mono(10, 700);
      x.fillStyle = '#ffb347'; x.fillText(`A → O ${kit.num(tO, 1)} min`, 142, 32);
      x.fillStyle = '#5cc8ff'; x.fillText(`B → O ${kit.num(tO, 1)} min`, 142, 48);
      x.fillStyle = '#ffd34d'; x.fillText(`s = ${kit.num(M.s(t), 1)} mi`, 142, 64);
      if (alerta) { x.fillStyle = on ? '#ff3a2e' : '#6e1a14'; x.fillRect(140, 76, 112, 15); x.fillStyle = '#ffffff'; x.font = mono(8, 700); x.fillText('ALERTA DE CONFLICTO', 144, 84); }
      x.restore();
    }

    // ------------------------------------------------------------ terreno: grava alrededor de la sala
    const grava = kit.malla(parcheIrregular(THREE, 7.4, 6.6, 0.8), kit.mat('gravel', { repeat: [1, 1], color: 0xcfc6b3, normalScale: 0.6 }), { x: 0.6, y: 0.012, z: -3.2, sombra: false, padre: g });
    grava.material.polygonOffset = true; grava.material.polygonOffsetFactor = -1; grava.material.polygonOffsetUnits = -1;

    // ------------------------------------------------------------ piso técnico: baldosas de 60 cm sobre pedestales, una levantada
    const X0 = -2.7, X1 = 2.7, Z0 = -3.6, Z1 = 2.4, BT = 0.6, EB = 0.035; // EB: espesor de la baldosa
    const HUE = { x: 1.2, z: 0.3 };       // centro del hueco de la baldosa levantada
    const perforadas = new Set(['1,0', '4,0', '7,0', '2,2', '6,2', '0,6', '8,4']);
    const varUV = [[0, 0.5, 0.5, 1], [0.5, 0.5, 1, 1], [0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5]];
    const ins = (r) => [r[0] + 0.003, r[1] + 0.003, r[2] - 0.003, r[3] - 0.003];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 10; j++) {
      const cx = X0 + BT / 2 + i * BT, cz = Z0 + BT / 2 + j * BT;
      if (Math.abs(cx - HUE.x) < 0.01 && Math.abs(cz - HUE.z) < 0.01) continue;
      const h = (i * 7 + j * 13 + i * j) % 12, vari = perforadas.has(`${i},${j}`) ? 3 : h % 3;
      L.poner('piso', plano(BT, BT), { x: cx, y: PISO, z: cz, rx: -Math.PI / 2, ry: (h % 4) * (Math.PI / 2), orden: 'YXZ', uv: 'rect', rect: ins(varUV[vari]) });
    }
    // zócalo perimetral con canto de aluminio y peldaño de acceso con huella antideslizante
    for (const [w, d, x, z] of [[X1 - X0, 0.02, 0, Z1 + 0.01], [X1 - X0, 0.02, 0, Z0 - 0.01], [0.02, Z1 - Z0, X0 - 0.01, (Z0 + Z1) / 2], [0.02, Z1 - Z0, X1 + 0.01, (Z0 + Z1) / 2]]) {
      S(caja(w, PISO, d, 1, 2, 1), { x, y: PISO / 2, z, color: 0x585c60, base: [0, PISO, 0.62] });
      const ancho = w > d;
      Me(caja(ancho ? w + 0.04 : 0.008, 0.03, ancho ? 0.008 : d + 0.04), { x: x + (ancho ? 0 : Math.sign(x) * 0.014), y: PISO - 0.015, z: z + (ancho ? Math.sign(z) * 0.014 : 0), color: 0xcfd3d6 });
    }
    S(caja(1.6, PISO / 2, 0.32), { x: 0, y: PISO / 4, z: Z1 + 0.18, color: 0x686c70, base: [0, 0.09, 0.7] });
    for (let k = 0; k < 16; k++) S(caja(0.1, 0.004, 0.05), { x: -0.75 + k * 0.1, y: PISO / 2 + 0.002, z: Z1 + 0.305, color: k % 2 ? 0x1c1c1c : 0xe2b31f });
    // bajo el hueco: losa, pedestales con cabezal, travesaños y el haz de cables que corre bajo el piso
    Ma(suelo(2.0, 2.0), { x: HUE.x, y: 0.02, z: HUE.z, color: 0x4d4a45 });
    for (const px of [0.3, 0.9, 1.5, 2.1]) for (const pz of [-0.6, 0, 0.6, 1.2]) {
      const hp = PISO - EB - 0.06;
      Me(caja(0.1, 0.004, 0.1), { x: px, y: 0.024, z: pz, color: 0xbfc4c2 });
      Me(cil(0.011, 0.011, hp, 12), { x: px, y: 0.026 + hp / 2, z: pz, color: 0xc9cdcb });
      Me(cil(0.018, 0.018, 0.012, 6), { x: px, y: PISO - EB - 0.034, z: pz, color: 0xaeb2b0 });
      Me(caja(0.085, 0.006, 0.085), { x: px, y: PISO - EB - 0.003, z: pz, color: 0xc4c8c6 });
    }
    for (const [a, b] of [[[0.9, 0], [1.5, 0]], [[0.9, 0.6], [1.5, 0.6]], [[0.9, 0], [0.9, 0.6]], [[1.5, 0], [1.5, 0.6]]]) {
      const lx = Math.abs(b[0] - a[0]), lz = Math.abs(b[1] - a[1]);
      Me(caja(lx || 0.022, 0.026, lz || 0.022), { x: (a[0] + b[0]) / 2, y: PISO - EB - 0.019, z: (a[1] + b[1]) / 2, color: 0xb3b8b6 });
      Ma(caja(lx || 0.004, EB, lz || 0.004), { x: (a[0] + b[0]) / 2 + (lz ? (a[0] < 1 ? -0.002 : 0.002) : 0), y: PISO - EB / 2, z: (a[1] + b[1]) / 2 + (lx ? (a[1] < 0.3 ? -0.002 : 0.002) : 0), color: 0x2f3032 });
    }
    [[0x2a64c8, 0], [0x8a8f94, 0.016], [0xd8c23a, 0.031], [0x1d1d1f, -0.018], [0x1d1d1f, 0.048], [0x2a64c8, 0.007]].forEach(([c, dx], k) => {
      const y0 = 0.034 + (k % 3) * 0.011;
      Ma(tubo([[1.06 + dx, y0, -1.6], [1.1 + dx * 1.2, y0 + 0.008, -0.5], [1.15 + dx, y0 - 0.004, 0.3], [1.1 + dx * 0.8, y0 + 0.006, 1.0], [1.04 + dx, y0, 2.0]], k % 2 ? 0.0065 : 0.0055, 48, 8), { color: c });
    });
    // la baldosa levantada descansa sobre el piso, con la ventosa doble con que se sacó
    {
      const m = marco(1.27, PISO, -0.52, 0.14);
      Me(caja(0.596, EB - 0.004, 0.596), { m, y: (EB - 0.004) / 2, color: 0x8d9092 });
      Ma(caja(0.6, 0.004, 0.6), { m, y: EB - 0.002, color: 0x2f3032 });
      L.poner('piso', plano(BT - 0.006, BT - 0.006), { m, y: EB + 0.0005, rx: -Math.PI / 2, uv: 'rect', rect: ins(varUV[1]) });
      for (const l of [-1, 1]) {
        Ma(cil(0.05, 0.042, 0.02, 28), { m, x: l * 0.13, y: EB + 0.011, color: 0x262628 });
        S(caja(0.032, 0.05, 0.034), { m, x: l * 0.13, y: EB + 0.045, color: 0xd8b21f });
      }
      Me(caja(0.32, 0.022, 0.032), { m, y: EB + 0.08, color: 0xc7ccd0 });
    }
    // caballete amarillo de aviso junto al hueco
    {
      const m = marco(1.78, PISO, 0.05, -0.75);
      for (const l of [-1, 1]) {
        S(caja(0.3, 0.6, 0.012), { m, y: 0.29, z: l * 0.062, rx: -l * 0.21, color: 0xf0bf2c });
        if (l > 0) Pa(plano(0.25, 0.25), P.aviso, { m, y: 0.36, z: 0.055, rx: -0.21 });
      }
      S(caja(0.3, 0.018, 0.04), { m, y: 0.6, color: 0xe2b020 });
    }

    // ------------------------------------------------------------ estructura y techo de policarbonato con luminarias colgantes
    const HT = 2.95, XC = 2.62, ZA = -3.52, ZF = 2.32, colC = 0x4f565d;
    for (const sx of [-1, 1]) for (const zc of [ZA, ZF]) {
      S(caja(0.1, HT, 0.1, 1, 4, 1), { x: sx * XC, y: PISO + HT / 2, z: zc, color: colC, base: [PISO, PISO + 0.7, 0.68] });
      Me(caja(0.24, 0.012, 0.24), { x: sx * XC, y: PISO + 0.006, z: zc, color: 0x8d9398 });
      for (const bx of [-1, 1]) for (const bz of [-1, 1]) Me(cil(0.012, 0.012, 0.022, 6), { x: sx * XC + bx * 0.085, y: PISO + 0.02, z: zc + bz * 0.085, color: 0x9da3a8 });
    }
    for (const zc of [ZA, ZF]) S(caja(2 * XC + 0.1, 0.16, 0.08), { y: PISO + HT + 0.08, z: zc, color: colC });
    for (const sx of [-1, 1]) S(caja(0.08, 0.16, ZF - ZA), { x: sx * XC, y: PISO + HT + 0.08, z: (ZA + ZF) / 2, color: colC });
    for (const zc of [-2.1, -0.6, 0.9]) S(caja(2 * XC, 0.12, 0.06), { y: PISO + HT + 0.1, z: zc, color: colC });
    for (const zc of [ZA - 0.27, ZF + 0.27]) Me(caja(2 * XC + 0.56, 0.1, 0.03), { y: PISO + HT + 0.18, z: zc, color: 0xc2c8cd });
    for (const sx of [-1, 1]) Me(caja(0.03, 0.1, ZF - ZA + 0.56), { x: sx * (XC + 0.27), y: PISO + HT + 0.18, z: (ZA + ZF) / 2, color: 0xc2c8cd });
    {
      const nt = kit.makeSurface('ribbed', { size: 256, seed: 6, repeat: [9, 1], roughness: false }).normalMap;
      const techo = kit.malla(suelo(2 * XC + 0.54, ZF - ZA + 0.54), new THREE.MeshStandardMaterial({ color: 0xe3e9ec, emissive: 0xb9c6cc, emissiveIntensity: 0.55, roughness: 0.5, normalMap: nt, side: THREE.DoubleSide }), { y: PISO + HT + 0.17, z: (ZA + ZF) / 2, padre: g, sombra: false });
      techo.renderOrder = -1; // la luz pasa por el policarbonato: no proyecta sombra
    }
    function luminaria(x, z, ry, largo) {
      const m = marco(x, PISO + 2.6, z, ry), alto = HT + 0.04 - 2.6;
      S(caja(0.075, 0.055, largo), { m, color: 0xe6e8ea });
      Pn(plano(0.062, largo - 0.03).rotateX(Math.PI / 2), R.blanco, { m, y: -0.0282 });
      for (const l of [-1, 1]) {
        S(caja(0.08, 0.06, 0.012), { m, z: l * (largo / 2 + 0.006), color: 0x8e9398 });
        Me(barraGeo([0, 0.027, l * (largo / 2 - 0.12)], [0, alto, l * (largo / 2 - 0.12)], 0.0014, 6), { m, color: 0xd0d4d8 });
      }
      Ma(tubo([[0, 0.028, 0.15], [0.03, 0.12, 0.17], [0.01, alto - 0.08, 0.2], [0, alto, 0.22]], 0.0035, 16, 6), { m, color: 0x1c1c1e });
    }
    luminaria(-0.45, -0.05, 0, 1.25); luminaria(0.45, -0.05, 0, 1.25);
    luminaria(-1.35, -2.72, Math.PI / 2, 1.25); luminaria(0.75, -2.72, Math.PI / 2, 1.25);

    // ------------------------------------------------------------ mesa del mapa: tablero de nogal, bastidor de acero y repisa
    {
      const m = marco(0, PISO, 0), o = (x) => ({ m, ...x });
      const TW = 1.84, TD = 2.24;
      L.poner('madera', caja(TW, 0.045, TD), o({ y: MESA - 0.0225, color: 0x6e5240, esc: 1.7 }));
      for (const sz of [-1, 1]) Ma(caja(TW + 0.024, 0.05, 0.012), o({ y: MESA - 0.024, z: sz * (TD / 2 + 0.006), color: 0x262729 }));
      for (const sx of [-1, 1]) Ma(caja(0.012, 0.05, TD), o({ x: sx * (TW / 2 + 0.006), y: MESA - 0.024, color: 0x262729 }));
      // marco del mapa con labio de aluminio
      for (const sz of [-1, 1]) L.poner('madera', caja(MW + 0.1, 0.05, 0.05), o({ y: MESA + 0.025, z: sz * (MD / 2 + 0.025), color: 0x9c7552, esc: 0.9 }));
      for (const sx of [-1, 1]) L.poner('madera', caja(0.05, 0.05, MD), o({ x: sx * (MW / 2 + 0.025), y: MESA + 0.025, color: 0x9c7552, esc: 0.9 }));
      for (const sz of [-1, 1]) Me(caja(MW + 0.004, 0.006, 0.006), o({ y: MESA + 0.047, z: sz * (MD / 2 + 0.003), color: 0xc9ced3 }));
      for (const sx of [-1, 1]) Me(caja(0.006, 0.006, MD + 0.004), o({ x: sx * (MW / 2 + 0.003), y: MESA + 0.047, color: 0xc9ced3 }));
      // patas con niveladores, faldones y repisa inferior
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        S(caja(0.06, MESA - 0.07, 0.06, 1, 3, 1), o({ x: sx * 0.82, y: (MESA - 0.07) / 2 + 0.025, z: sz * 1.02, color: 0x3c4249, base: [PISO, PISO + 0.5, 0.7] }));
        Ma(cil(0.032, 0.028, 0.018, 24), o({ x: sx * 0.82, y: 0.009, z: sz * 1.02, color: 0x1f2022 }));
        Me(cil(0.008, 0.008, 0.03, 10), o({ x: sx * 0.82, y: 0.025, z: sz * 1.02, color: 0xbfc4c8 }));
      }
      for (const sz of [-1, 1]) S(caja(1.58, 0.1, 0.03), o({ y: MESA - 0.1, z: sz * 1.0, color: 0x3c4249 }));
      for (const sx of [-1, 1]) S(caja(0.03, 0.1, 1.98), o({ x: sx * 0.8, y: MESA - 0.1, color: 0x3c4249 }));
      S(caja(1.62, 0.022, 2.0), o({ y: 0.2, color: 0x596067 }));
      for (const sx of [-1, 1]) S(caja(0.03, 0.05, 2.0), o({ x: sx * 0.8, y: 0.2, color: 0x3c4249 }));
      // cartas enrolladas con elástico y archivadores en la repisa
      for (let k = 0; k < 5; k++) {
        const x = -0.6 + k * 0.074, z = (k % 2) * 0.06 - 0.25, r = 0.03 + (k % 3) * 0.004;
        Pa(cil(r, r, 0.92 + (k % 2) * 0.08, 24), P.carta, o({ x, y: 0.211 + r, z, rx: Math.PI / 2, color: [0xf4f2ea, 0xe8eef4, 0xf2ead8][k % 3] }));
        Ma(new THREE.TorusGeometry(r + 0.0015, 0.0022, 6, 28), o({ x, y: 0.211 + r, z: z + 0.2, color: 0xa8322a }));
      }
      [[0x2b4f86, 0], [0x1d1e20, 0.062], [0x8e2b2b, 0.124]].forEach(([c, dy], k) => S(caja(0.31, 0.06, 0.27), o({ x: 0.42, y: 0.241 + dy, z: 0.45 + k * 0.012, ry: k * 0.05, color: c })));
      // en el borde: regla de acero, lápices grasos, compás de puntas y una taza
      Pa(caja(0.6, 0.0025, 0.032), P.regla, o({ x: 0.22, y: MESA + 0.0013, z: 1.06, ry: 0.02 }));
      [[0xc0262a, -0.32], [0x1f4fae, -0.27]].forEach(([c, x], k) => {
        S(cil(0.0045, 0.0045, 0.13, 14), o({ x, y: MESA + 0.0045, z: 1.07, rz: Math.PI / 2, ry: 0.15 + k * 0.2, color: c }));
        S(cil(0.0045, 0.001, 0.016, 14), o({ x: x + 0.072 * Math.cos(0.15 + k * 0.2), y: MESA + 0.0045, z: 1.07 - 0.072 * Math.sin(0.15 + k * 0.2), rz: -Math.PI / 2, ry: 0.15 + k * 0.2, color: 0x2a2a2a }));
      });
      Me(barraGeo([0.86, MESA + 0.004, -0.35], [0.88, MESA + 0.004, -0.2], 0.0022, 8), o({ color: 0xc7a85a }));
      Me(barraGeo([0.86, MESA + 0.004, -0.35], [0.84, MESA + 0.004, -0.2], 0.0022, 8), o({ color: 0xc7a85a }));
      Me(cil(0.008, 0.008, 0.01, 16), o({ x: 0.86, y: MESA + 0.006, z: -0.355, rx: Math.PI / 2, color: 0xb8973f }));
      tazaEn(marco(0.36, PISO + MESA, -1.06, 0.4), 0xf1f0ec);
    }

    // ------------------------------------------------------------ objetos de escritorio
    function tazaEn(m, color) {
      const perfil = [[0, 0], [0.036, 0], [0.04, 0.004], [0.041, 0.09], [0.0386, 0.092], [0.036, 0.09], [0.035, 0.009], [0, 0.009]].map(([r, y]) => new THREE.Vector2(r, y));
      S(new THREE.LatheGeometry(perfil, 32), { m, color });
      S(new THREE.CircleGeometry(0.0352, 28).rotateX(-Math.PI / 2), { m, y: 0.072, color: 0x2a170c });
      S(new THREE.TorusGeometry(0.024, 0.0065, 10, 20, Math.PI), { m, x: 0.041, y: 0.048, rz: -Math.PI / 2, color });
    }
    function monitor(m, w, h, rect, { prof = 0.05, borde = 0.022, color = 0x1b1d20 } = {}) {
      S(caja(w + 2 * borde, h + 2 * borde, prof), { m, color });
      S(caja(w * 0.7, h * 0.6, 0.03), { m, z: -prof / 2 - 0.015, color: 0x232528 });
      Pn(plano(w, h), rect, { m, z: prof / 2 + 0.0008 });
      Pn(caja(0.008, 0.003, 0.002), R.verde, { m, x: w / 2 + borde - 0.03, y: -h / 2 - borde * 0.5, z: prof / 2 + 0.001 });
    }
    function teclado(m) {
      S(caja(0.45, 0.018, 0.155), { m, y: 0.009, color: 0x1c1d20 });
      for (let f = 0; f < 5; f++) for (let c = 0; c < 15; c++) {
        if (f === 0 && c > 4 && c < 11) continue;
        S(caja(0.022, 0.009, 0.021), { m, x: -0.1855 + c * 0.0265, y: 0.022, z: 0.052 - f * 0.026, color: f === 4 ? 0x3d4046 : c === 14 ? 0x34373b : 0x2a2c30 });
      }
      S(caja(0.1545, 0.009, 0.021), { m, x: 0.0133, y: 0.022, z: 0.052, color: 0x2a2c30 });
      for (let k = 0; k < 3; k++) Pn(caja(0.004, 0.002, 0.004), k === 1 ? R.ambar : R.verde, { m, x: 0.19 + k * 0.009, y: 0.0185, z: -0.066 });
    }
    function bola(m) {
      S(cil(0.07, 0.06, 0.032, 32), { m, y: 0.016, color: 0x232528 });
      S(esfera(0.026, 24, 16), { m, y: 0.034, color: 0x2f4f78 });
      for (const l of [-1, 1]) S(caja(0.03, 0.008, 0.022), { m, x: l * 0.035, y: 0.033, z: 0.05, color: 0x3a3d42 });
    }
    function hojas(m, n, r) { for (let k = 0; k < n; k++) Pa(suelo(0.21, 0.297), r, { m, y: 0.0008 + k * 0.0006, x: k * 0.004, ry: (k - n / 2) * 0.05 }); }
    function tiras(m) {
      // tablero inclinado de fajas de progreso de vuelo
      const mt = marco(0, 0.07, 0, 0, m, 0.42);
      Me(caja(0.3, 0.008, 0.27), { m: mt, color: 0xb2b7bb });
      for (const l of [-1, 1]) Me(caja(0.008, 0.02, 0.27), { m: mt, x: l * 0.151, y: 0.008, color: 0x9ca1a6 });
      [0xe0b532, 0x4e86c6, 0xe0b532, 0xd9dbdc, 0x58a55c].forEach((c, k) => {
        const z = -0.1 + k * 0.05;
        S(caja(0.28, 0.008, 0.04), { m: mt, y: 0.008, z, color: c });
        Pa(suelo(0.255, 0.028), [P.tiras[0], P.tiras[1] + k * 20, 256, 20], { m: mt, y: 0.0125, z });
      });
      S(caja(0.3, 0.12, 0.02), { m, y: 0.06, z: -0.12, color: 0x8f959a });
    }
    function microfono(m) {
      S(cil(0.04, 0.045, 0.02, 24), { m, y: 0.01, color: 0x1e1f21 });
      Ma(tubo([[0, 0.02, 0], [0, 0.12, 0.005], [0, 0.22, 0.04], [0, 0.27, 0.11]], 0.0045, 24, 8), { m, color: 0x18191b });
      S(barraGeo([0, 0.27, 0.11], [0, 0.275, 0.165], 0.011, 16), { m, color: 0x1e1f21 });
      Pn(barraGeo([0, 0.2702, 0.117], [0, 0.2708, 0.124], 0.0116, 16), R.rojo, { m });
    }
    function telefono(m) {
      S(caja(0.2, 0.03, 0.22), { m, y: 0.015, color: 0x26282b });
      S(caja(0.2, 0.035, 0.11), { m, y: 0.04, z: -0.055, rx: 0.16, color: 0x26282b });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) S(caja(0.022, 0.006, 0.016), { m, x: 0.02 + c * 0.027, y: 0.032, z: 0.085 - r * 0.021, color: 0xd9dcdf });
      Pn(plano(0.075, 0.028).rotateX(-Math.PI / 2 + 0.3), R.tel, { m, x: 0.045, y: 0.062, z: -0.05 });
      S(caja(0.05, 0.03, 0.2), { m, x: -0.055, y: 0.072, z: -0.01, color: 0x2b2d30 });
      for (const l of [-1, 1]) S(caja(0.056, 0.032, 0.05), { m, x: -0.055, y: 0.07, z: -0.01 + l * 0.085, color: 0x2b2d30 });
      // cordón en espiral del auricular
      const pts = [], A = V(-0.08, 0.058, 0.095), B = V(-0.1, 0.012, 0.03);
      for (let i = 0; i <= 260; i++) {
        const t = i / 260, c = V().lerpVectors(A, B, t), sn = Math.sin(t * Math.PI);
        c.x -= sn * 0.07; c.z += sn * 0.05; c.y = Math.max(0.007, c.y - sn * 0.03);
        const a = t * TAU * 22;
        pts.push([c.x + Math.cos(a) * 0.005, c.y + Math.sin(a) * 0.005, c.z + Math.sin(a) * 0.002]);
      }
      Ma(tubo(pts, 0.0016, 520, 5), { m, color: 0x1c1d1f });
    }
    // silla de operador: base de cinco rayos con ruedas, pistón, respaldo alto con cabecero y apoyabrazos
    function silla(m, tela) {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + 0.3;
        Me(caja(0.045, 0.026, 0.29), { m, x: Math.sin(a) * 0.15, y: 0.07, z: Math.cos(a) * 0.15, ry: a, rx: 0.12, orden: 'YXZ', color: 0xd6dadd });
        S(caja(0.03, 0.034, 0.04), { m, x: Math.sin(a) * 0.29, y: 0.05, z: Math.cos(a) * 0.29, ry: a, color: 0x1d1e20 });
        for (const l of [-1, 1]) Ma(cil(0.024, 0.024, 0.012, 18), { m, x: Math.sin(a) * 0.29 + Math.cos(a) * l * 0.011, y: 0.024, z: Math.cos(a) * 0.29 - Math.sin(a) * l * 0.011, ry: a, rz: Math.PI / 2, orden: 'YXZ', color: 0x18181a });
      }
      Me(cil(0.05, 0.035, 0.07, 24), { m, y: 0.085, color: 0xd6dadd });
      S(cil(0.034, 0.034, 0.13, 20), { m, y: 0.18, color: 0x1d1e20 });
      Me(cil(0.022, 0.022, 0.15, 16), { m, y: 0.3, color: 0xe3e6e8 });
      S(caja(0.2, 0.05, 0.24), { m, y: 0.375, color: 0x1d1e20 });
      S(caja(0.5, 0.025, 0.47), { m, y: 0.405, color: 0x202123 });
      Ma(caja(0.48, 0.05, 0.45), { m, y: 0.443, color: tela });
      Ma(cil(0.026, 0.026, 0.48, 18), { m, y: 0.442, z: 0.218, rz: Math.PI / 2, color: tela });
      S(caja(0.05, 0.36, 0.03), { m, y: 0.56, z: -0.255, rx: -0.12, color: 0x1d1e20 });
      Ma(caja(0.46, 0.58, 0.07), { m, y: 0.86, z: -0.29, rx: -0.14, color: tela });
      S(caja(0.47, 0.6, 0.02), { m, y: 0.86, z: -0.335, rx: -0.14, color: 0x202123 });
      Ma(caja(0.3, 0.13, 0.065), { m, y: 1.25, z: -0.345, rx: -0.22, color: tela });
      S(caja(0.04, 0.16, 0.02), { m, y: 1.15, z: -0.36, rx: -0.15, color: 0x1d1e20 });
      for (const l of [-1, 1]) {
        S(caja(0.03, 0.2, 0.05), { m, x: l * 0.27, y: 0.5, z: -0.04, color: 0x1d1e20 });
        Ma(caja(0.075, 0.03, 0.24), { m, x: l * 0.27, y: 0.615, z: 0, color: 0x262729 });
      }
    }

    // ------------------------------------------------------------ consolas: dos puestos y un módulo central de comunicaciones
    // Los operadores miran hacia −z; las pantallas quedan de frente a la mesa del mapa.
    const ZC = -2.35; // borde del mesón de las consolas (lado del operador)
    function puesto(cx, n) {
      const m = marco(cx, PISO, ZC), o = (x) => ({ m, ...x });
      S(caja(1.5, 0.03, 0.64), o({ y: 0.725, z: -0.32, color: 0xb6b5ae }));
      Ma(cil(0.016, 0.016, 1.5, 16), o({ y: 0.725, rz: Math.PI / 2, color: 0x2a2c2e }));
      for (const sx of [-1, 1]) {
        S(caja(0.42, 0.62, 0.58, 1, 3, 1), o({ x: sx * 0.54, y: 0.4, z: -0.33, color: 0xc8cbc9, base: [PISO, PISO + 0.6, 0.72] }));
        S(caja(0.4, 0.09, 0.54), o({ x: sx * 0.54, y: 0.045, z: -0.35, color: 0x2e3134 }));
        for (let k = 0; k < 8; k++) Ma(caja(0.3, 0.007, 0.004), o({ x: sx * 0.54, y: 0.25 + k * 0.028, z: -0.039, color: 0x1d1f22 }));
        Me(caja(0.014, 0.12, 0.016), o({ x: sx * 0.37, y: 0.58, z: -0.034, color: 0xb9bec2 }));
      }
      S(caja(0.66, 0.6, 0.02), o({ y: 0.41, z: -0.6, color: 0xb0b3b1 }));
      S(caja(1.5, 0.15, 0.24), o({ y: 0.815, z: -0.74, color: 0xc2c5c3 }));
      S(caja(1.5, 0.73, 0.03, 1, 3, 1), o({ y: 0.365, z: -0.845, color: 0xbabdbb, base: [PISO, PISO + 0.5, 0.75] }));
      Pa(plano(0.24, 0.024), [P.etiq[0], P.etiq[1] + n * 24, 256, 24], o({ x: -0.5, y: 0.845, z: -0.619 }));
      // pantalla principal de radar, cuadrada, sobre su brazo; pantallas de datos a los lados, giradas hacia el operador
      S(caja(0.09, 0.16, 0.05), o({ y: 0.96, z: -0.79, color: 0x26282b }));
      monitor(marco(0, 1.21, -0.75, 0, m, -0.1), 0.6, 0.6, R.radar, { prof: 0.055, borde: 0.022 });
      for (const [sx, rect] of [[-1, R.lista], [1, R.datos]]) {
        S(caja(0.2, 0.012, 0.15), o({ x: sx * 0.6, y: 0.896, z: -0.72, color: 0x26282b }));
        S(caja(0.05, 0.12, 0.03), o({ x: sx * 0.6, y: 0.96, z: -0.745, color: 0x26282b }));
        monitor(marco(sx * 0.6, 1.12, -0.7, -sx * 0.42, m, -0.06), 0.5, 0.31, rect, { prof: 0.04, borde: 0.016 });
      }
      teclado(marco(0, 0.74, -0.15, 0, m, 0.05));
      bola(marco(0.33, 0.74, -0.15, 0, m));
      microfono(marco(0.58, 0.74, -0.48, -0.5, m));
      tiras(marco(-0.47, 0.74, -0.4, 0.15, m));
      // caja de conexión de los audífonos bajo el canto
      S(caja(0.13, 0.045, 0.08), o({ x: 0.45, y: 0.685, z: -0.05, color: 0x232528 }));
      for (const l of [-1, 1]) Ma(cil(0.007, 0.007, 0.006, 12), o({ x: 0.45 + l * 0.03, y: 0.685, z: -0.008, rx: Math.PI / 2, color: 0x0e0e0f }));
      // cables de las pantallas que bajan por detrás hasta el piso
      for (const [x0, c] of [[0, 0x18191b], [-0.6, 0x18191b], [0.6, 0x18191b], [0.1, 0x2a64c8]]) {
        Ma(tubo([[x0, 0.95, -0.8], [x0 * 0.9 + 0.05, 0.9, -0.885], [x0 * 0.6 + 0.1, 0.5, -0.89], [0.2, 0.05, -0.9], [0.28, 0.008, -1.0]], 0.005, 24, 6), o({ color: c }));
      }
    }
    puesto(-1.35, 0); puesto(0.75, 1);
    {
      const m = marco(-0.3, PISO, ZC), o = (x) => ({ m, ...x });
      S(caja(0.6, 0.71, 0.6, 1, 3, 1), o({ y: 0.355, z: -0.32, color: 0xc8cbc9, base: [PISO, PISO + 0.6, 0.72] }));
      for (let k = 0; k < 3; k++) {
        Ma(caja(0.56, 0.004, 0.004), o({ y: 0.24 + k * 0.17, z: -0.019, color: 0x2a2c2e }));
        Me(caja(0.14, 0.014, 0.018), o({ y: 0.32 + k * 0.17, z: -0.012, color: 0xb9bec2 }));
      }
      S(caja(0.6, 0.03, 0.64), o({ y: 0.725, z: -0.32, color: 0xb6b5ae }));
      Ma(cil(0.016, 0.016, 0.6, 16), o({ y: 0.725, rz: Math.PI / 2, color: 0x2a2c2e }));
      S(caja(0.6, 0.15, 0.24), o({ y: 0.815, z: -0.74, color: 0xc2c5c3 }));
      S(caja(0.6, 0.73, 0.03), o({ y: 0.365, z: -0.845, color: 0xbabdbb }));
      S(caja(0.16, 0.1, 0.05), o({ y: 0.94, z: -0.71, color: 0x26282b }));
      monitor(marco(0, 1.02, -0.66, 0, m, -0.55), 0.3, 0.2, R.vcs, { prof: 0.035, borde: 0.016 });
      telefono(marco(0.1, 0.74, -0.24, -0.25, m));
      hojas(marco(-0.15, 0.74, -0.3, 0.35, m), 2, P.libreta);
    }
    // objetos de cada puesto: tazas, hojas y la libreta
    tazaEn(marco(-1.35 + 0.5, PISO + 0.74, ZC - 0.3, 0.6), 0xf1f0ec);
    hojas(marco(-1.35 + 0.24, PISO + 0.74, ZC - 0.44, 0.25), 4, P.hoja);
    tazaEn(marco(0.75 - 0.2, PISO + 0.74, ZC - 0.46, 2.2), 0x2f5d8a);
    hojas(marco(0.75 + 0.3, PISO + 0.74, ZC - 0.5, -0.3), 2, P.hoja);
    // sillas: la del controlador, de frente a su consola; la de la controladora, girada y corrida hacia la mesa
    silla(marco(0.75, PISO, -1.98, Math.PI), 0x2c3a4c);
    silla(marco(-0.98, PISO, -1.9, 0.85), 0x3b4048);

    // ------------------------------------------------------------ pantallas murales en un pórtico de aluminio, detrás de las consolas
    {
      const ZM = -3.42;
      for (const px of [-2.05, 1.55]) {
        Me(cil(0.032, 0.032, 2.56, 20), { x: px, y: PISO + 1.28, z: ZM, color: 0xc8cdd2 });
        Me(caja(0.32, 0.012, 0.32), { x: px, y: PISO + 0.006, z: ZM, color: 0xa3a9ae });
        S(caja(0.08, 0.04, 0.08), { x: px, y: PISO + 2.58, z: ZM, color: 0x2a2c2f });
      }
      Me(caja(3.6, 0.06, 0.06), { x: -0.25, y: PISO + 2.5, z: ZM, color: 0xc8cdd2 });
      Me(caja(3.6, 0.04, 0.04), { x: -0.25, y: PISO + 1.62, z: ZM, color: 0xc8cdd2 });
      for (const [px, rect] of [[-0.95, R.muro], [0.45, R.info]]) {
        S(caja(0.24, 0.9, 0.035), { x: px, y: PISO + 2.06, z: ZM + 0.045, color: 0x26282b });
        monitor(marco(px, PISO + 2.08, ZM + 0.1, 0, null, 0.05), 1.08, 0.61, rect, { prof: 0.05, borde: 0.018, color: 0x16171a });
        Ma(tubo([[px + 0.08, PISO + 1.82, ZM + 0.05], [px + 0.2, PISO + 1.7, ZM + 0.02], [px + 0.3, PISO + 1.62, ZM + 0.025]], 0.005, 12, 6), { color: 0x18191b });
      }
      monitor(marco(-0.25, PISO + 2.08, ZM + 0.09, 0, null, 0.05), 0.22, 0.068, R.reloj, { prof: 0.05, borde: 0.012, color: 0x101112 });
      Ma(tubo([[1.55, PISO + 1.62, ZM + 0.03], [1.56, PISO + 0.8, ZM + 0.04], [1.6, PISO + 0.01, ZM + 0.1], [1.4, PISO + 0.008, ZM + 0.35]], 0.006, 24, 6), { color: 0x18191b });
    }

    // ------------------------------------------------------------ caseta de equipos con ventanales
    const CX = -1.2; // centro de la caseta en x
    const baliza = new THREE.MeshStandardMaterial({ color: 0x8a1f1a, roughness: 0.3, emissive: 0xff2a1a, emissiveIntensity: 0 });
    {
      const m = marco(CX, 0, -6.7), o = (x) => ({ m, ...x });
      const LX = 6.0, LZ = 2.4, HC = 2.6, BL = 0.15, F = LZ / 2, mc = 0x55606b, alu = 0xc9cfd5;
      L.poner('acan', caja(LX - 0.02, HC, LZ - 0.02, 1, 3, 1), o({ y: BL + HC / 2, color: 0xe6e9eb, esc: 0.75, base: [BL, BL + 1.2, 0.74] }));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) S(caja(0.14, HC + 0.02, 0.14, 1, 3, 1), o({ x: sx * (LX / 2 - 0.06), y: BL + HC / 2, z: sz * (F - 0.06), color: mc, base: [BL, BL + 1, 0.75] }));
      for (const sz of [-1, 1]) {
        S(caja(LX, 0.14, 0.14), o({ y: BL + HC - 0.06, z: sz * (F - 0.06), color: mc }));
        S(caja(LX, 0.16, 0.14), o({ y: BL + 0.08, z: sz * (F - 0.06), color: mc, base: [BL, BL + 0.16, 0.8] }));
      }
      S(caja(LX + 0.08, 0.05, LZ + 0.08), o({ y: BL + HC + 0.025, color: mc }));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) Ma(caja(0.42, BL, 0.42), o({ x: sx * (LX / 2 - 0.35), y: BL / 2, z: sz * (F - 0.3), color: 0xb5b0a7 }));
      for (const wx of [-2.1, -0.65, 0.8]) {
        Me(caja(1.3, 1.0, 0.02), o({ x: wx, y: 1.72, z: F + 0.005, color: 0x2a3640 }));
        Me(caja(1.4, 0.05, 0.05), o({ x: wx, y: 2.245, z: F + 0.02, color: alu }));
        Me(caja(1.46, 0.05, 0.1), o({ x: wx, y: 1.195, z: F + 0.04, color: alu }));
        for (const l of [-1, 1]) Me(caja(0.05, 1.08, 0.05), o({ x: wx + l * 0.675, y: 1.72, z: F + 0.02, color: alu }));
        Me(caja(0.035, 1.0, 0.04), o({ x: wx + 0.05, y: 1.72, z: F + 0.025, color: alu }));
      }
      // puerta, peldaño, extintor, letrero, luz exterior, canaleta y bajada de aguas
      S(caja(0.92, 2.02, 0.04), o({ x: 2.25, y: BL + 1.06, z: F + 0.012, color: 0x7d8a95, base: [BL, BL + 0.5, 0.78] }));
      Me(caja(0.4, 0.5, 0.02), o({ x: 2.25, y: BL + 1.55, z: F + 0.036, color: 0x2a3640 }));
      Me(cil(0.012, 0.012, 0.14, 12), o({ x: 2.25 - 0.32, y: BL + 0.98, z: F + 0.07, rz: Math.PI / 2, color: alu }));
      Me(caja(1.1, 0.14, 0.42), o({ x: 2.25, y: 0.07, z: F + 0.23, color: 0x9ea6ad }));
      S(cil(0.075, 0.075, 0.42, 20), o({ x: 1.6, y: 0.95, z: F + 0.09, color: 0xc8231d }));
      S(cil(0.03, 0.04, 0.08, 12), o({ x: 1.6, y: 1.2, z: F + 0.09, color: 0x222222 }));
      Pa(plano(2.7, 0.31), P.letrero, o({ x: -0.65, y: 2.43, z: F + 0.012 }));
      S(caja(0.22, 0.06, 0.12), o({ x: 2.25, y: BL + 2.25, z: F + 0.06, color: 0x2a2c2f }));
      Pn(plano(0.18, 0.08).rotateX(Math.PI / 2), R.blanco, o({ x: 2.25, y: BL + 2.219, z: F + 0.06 }));
      Me(caja(LX + 0.1, 0.08, 0.1), o({ y: BL + HC + 0.02, z: F + 0.1, color: 0xb6bcc1 }));
      Me(cil(0.035, 0.035, BL + HC, 12), o({ x: -LX / 2 + 0.12, y: (BL + HC) / 2, z: F + 0.12, color: 0xb6bcc1 }));
      // aire acondicionado, mástil de radio y base de la baliza
      S(caja(0.3, 0.55, 0.8), o({ x: -LX / 2 - 0.15, y: 1.95, z: 0.2, color: 0xdfe2e4 }));
      Ma(caja(0.01, 0.42, 0.62), o({ x: -LX / 2 - 0.305, y: 1.95, z: 0.2, color: 0x55606b }));
      Me(cil(0.022, 0.016, 1.7, 10), o({ x: -2.5, y: BL + HC + 0.9, z: -0.6, color: alu }));
      Me(cil(0.004, 0.004, 0.9, 6), o({ x: -2.5, y: BL + HC + 2.2, z: -0.6, color: alu }));
      S(cil(0.08, 0.08, 0.05, 18), o({ x: 2.4, y: BL + HC + 0.075, z: 0.7, color: mc }));
    }
    kit.malla(new THREE.SphereGeometry(0.07, 18, 10, 0, TAU, 0, Math.PI / 2), baliza, { x: CX + 2.4, y: 2.85, z: -6.0, padre: g });

    // ------------------------------------------------------------ radar móvil junto a la caseta, con antena giratoria
    const antena = new THREE.Group();
    {
      const m = marco(3.4, 0, -6.9, Math.PI + 0.3), o = (x) => ({ m, ...x });
      const blanco = 0xe9ecef, chasis = 0x3d434a, goma = 0x1d1f21, llanta = 0xaeb4ba;
      const b = (a, c, r) => S(barraGeo(a, c, r, 10), o({ color: chasis }));
      for (const sz of [-1, 1]) S(caja(2.7, 0.12, 0.08), o({ y: 0.6, z: sz * 0.62, color: chasis }));
      for (const xx of [-1.1, 0, 1.1]) S(caja(0.08, 0.1, 1.24), o({ x: xx, y: 0.6, color: chasis }));
      Me(caja(2.5, 0.03, 1.36), o({ y: 0.675, color: 0xb5bbc1 }));
      for (const sz of [-1, 1]) {
        Ma(cil(0.32, 0.32, 0.2, 32), o({ x: -0.1, y: 0.32, z: sz * 0.84, rx: Math.PI / 2, color: goma }));
        Me(cil(0.19, 0.19, 0.21, 24), o({ x: -0.1, y: 0.32, z: sz * 0.84, rx: Math.PI / 2, color: llanta }));
        S(caja(0.82, 0.03, 0.3), o({ x: -0.1, y: 0.7, z: sz * 0.84, color: chasis }));
      }
      b([-1.3, 0.6, 0.55], [-2.15, 0.52, 0], 0.03); b([-1.3, 0.6, -0.55], [-2.15, 0.52, 0], 0.03);
      S(caja(0.18, 0.1, 0.12), o({ x: -2.22, y: 0.52, color: chasis }));
      S(cil(0.028, 0.028, 0.46, 12), o({ x: -1.85, y: 0.36, color: chasis }));
      Ma(cil(0.08, 0.08, 0.05, 18), o({ x: -1.85, y: 0.08, rx: Math.PI / 2, color: goma }));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        S(cil(0.03, 0.03, 0.56, 12), o({ x: sx * 1.22, y: 0.32, z: sz * 0.62, color: chasis }));
        S(caja(0.18, 0.02, 0.18), o({ x: sx * 1.22, y: 0.03, z: sz * 0.62, color: chasis }));
      }
      S(caja(0.85, 1.0, 1.0), o({ x: -0.65, y: 1.19, color: blanco }));
      S(caja(0.012, 0.36, 0.62), o({ x: -1.08, y: 1.28, color: chasis }));
      S(cil(0.085, 0.07, 1.95, 20), o({ x: 0.6, y: 1.665, color: blanco }));
      for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.5; b([0.6 + 0.55 * Math.cos(a), 0.69, 0.5 * Math.sin(a)], [0.6, 1.55, 0], 0.016); }
      S(cil(0.17, 0.15, 0.28, 24), o({ x: 0.6, y: 2.78, color: chasis }));
      // antena: reflector de doble cara, brazos y alimentador, en una sola malla que gira
      const LA = crearLote(kit), A = (geo, c, x = {}) => LA.poner('a', geo, { ...x, color: c, uv: 'caja' });
      const Rr = 1.5, zR = (x) => -Rr - 0.18 + Math.sqrt(Rr * Rr - x * x);
      const refl = new THREE.SphereGeometry(Rr, 26, 6, Math.PI / 2 - 0.62, 1.24, Math.PI / 2 - 0.2, 0.4);
      refl.translate(0, 0.32, -Rr - 0.18);
      const dentro = refl.clone(); dentro.scale(0.997, 1, 0.997);
      { const ix = dentro.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } const nn = dentro.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i)); }
      A(refl, 0xd3d8dd); A(dentro, 0xc4c9ce);
      const ba = (a, c, r = 0.014) => A(barraGeo(a, c, r, 8), chasis);
      A(caja(0.16, 0.22, 0.16), chasis, { y: 0.1 });
      ba([0, 0.16, -0.06], [0.62, 0.32, zR(0.62) + 0.01]); ba([0, 0.16, -0.06], [-0.62, 0.32, zR(0.62) + 0.01]);
      ba([0, 0.2, -0.06], [0, 0.55, zR(0) + 0.01]); ba([0, 0.06, -0.06], [0, 0.06, zR(0) + 0.01]);
      A(caja(0.16, 0.12, 0.15), chasis, { y: 0.27, z: -0.93 });
      ba([-0.3, 0.05, zR(0.3) - 0.01], [-0.03, 0.24, -0.88], 0.01); ba([0.3, 0.05, zR(0.3) - 0.01], [0.03, 0.24, -0.88], 0.01);
      A(caja(1.5, 0.11, 0.07), blanco, { y: 0.67, z: -0.21 });
      const ma = new THREE.Mesh(LA.unir('a'), MAT.sat); ma.castShadow = true; ma.receiveShadow = true;
      antena.add(ma);
      antena.position.copy(V(0.6, 2.92, 0).applyMatrix4(m)); antena.rotation.y = Math.PI + 0.3;
      g.add(antena);
      // cable de datos por el suelo hasta la caseta
      const ini = V(-0.65, 0.02, 0.52).applyMatrix4(m), muro = CX + 3.0;
      Ma(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([ini, V(ini.x - 0.2, 0.018, ini.z + 0.7), V(muro + 0.35, 0.018, -5.75), V(muro + 0.06, 0.05, -6.0), V(muro + 0.02, 0.6, -6.05)]), 48, 0.012, 8), { color: 0x1f2326 });
    }
    // conos de seguridad y manga de viento
    for (const [cx, cz] of [[2.3, -4.6], [5.0, -5.4], [5.3, -8.3]]) {
      const m = marco(cx, 0, cz);
      Ma(caja(0.36, 0.03, 0.36), { m, y: 0.015, color: 0x1d1f21 });
      S(cil(0.15, 0.03, 0.68, 28), { m, y: 0.37, color: 0xf4651c });
      S(cil(0.116, 0.099, 0.1, 28), { m, y: 0.3, color: 0xf2f2f0 });
      S(cil(0.079, 0.065, 0.08, 28), { m, y: 0.5, color: 0xf2f2f0 });
    }
    {
      const m = marco(4.7, 0, -4.4, 0.6);
      Ma(caja(0.5, 0.2, 0.5), { m, y: 0.1, color: 0xb5b0a7 });
      Me(cil(0.045, 0.03, 5.2, 18), { m, y: 2.7, color: 0xdfe2e5 });
      Me(new THREE.TorusGeometry(0.2, 0.008, 8, 28), { m, x: 0.12, y: 5.15, ry: Math.PI / 2, color: 0xc8ccd0 });
      for (let k = 0; k < 5; k++) {
        const l = 0.34, r0 = 0.2 - k * 0.024, ang = 0.18 + k * 0.05;
        Ma(cil(r0, r0 - 0.022, l, 24, true), { m, x: 0.12 + (k + 0.5) * l * Math.cos(0.18 + k * 0.03), y: 5.15 - (k + 0.5) * l * Math.sin(0.18 + k * 0.03) - k * 0.01, rz: -Math.PI / 2 - ang, color: k % 2 ? 0xf2f2f0 : 0xe0442a });
      }
    }

    // ------------------------------------------------------------ mapa en relieve con su textura pintada
    {
      const geo = new THREE.PlaneGeometry(MW, MD, 76, 96);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, altura((p.getX(i) + MW / 2) / MW, (p.getZ(i) + MD / 2) / MD));
      geo.computeVertexNormals();
      const tex = new THREE.CanvasTexture(pintarMapa());
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      kit.malla(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2 }), { y: BASE, padre: s0, sombra: false });
    }

    function pintarMapa() {
      const CW = 1024, CH = 1296, c = document.createElement('canvas');
      c.width = CW; c.height = CH;
      const ctx = c.getContext('2d'), img = ctx.createImageData(CW, CH), d = img.data;
      const h = new Float32Array(CW * CH), n = new Float32Array(CW * CH);
      for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
        const u = (i + 0.5) / CW, v = (j + 0.5) / CH, k = j * CW + i;
        n[k] = nivel(u, v); h[k] = altura(u, v);
      }
      const rampa = [[0, [120, 158, 92]], [0.16, [152, 174, 100]], [0.36, [194, 182, 124]], [0.56, [168, 134, 94]], [0.76, [134, 120, 108]], [0.9, [198, 196, 190]], [1, [244, 244, 240]]];
      const colorDe = (e) => {
        for (let r = 1; r < rampa.length; r++) {
          if (e <= rampa[r][0]) {
            const [e0, c0] = rampa[r - 1], [e1, c1] = rampa[r], t = (e - e0) / (e1 - e0);
            return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
          }
        }
        return rampa[rampa.length - 1][1];
      };
      const paso = MW / CW, Lz = [-0.55, 0.7, -0.45], ll = Math.hypot(...Lz);
      for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
        const k = j * CW + i, q = k * 4;
        if (n[k] < AGUA) {
          const prof = Math.min(1, (AGUA - n[k]) / 0.08), orilla = n[k] > AGUA - 0.006 ? 0.82 : 1;
          d[q] = (112 - 46 * prof) * orilla; d[q + 1] = (160 - 44 * prof) * orilla; d[q + 2] = (196 - 30 * prof) * orilla; d[q + 3] = 255;
          continue;
        }
        const i0 = Math.max(0, i - 1), i1 = Math.min(CW - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(CH - 1, j + 1);
        const hx = (h[j * CW + i1] - h[j * CW + i0]) / ((i1 - i0) * paso), hz = (h[j1 * CW + i] - h[j0 * CW + i]) / ((j1 - j0) * paso);
        const nx = -hx * 2.4, nz = -hz * 2.4, nl = Math.hypot(nx, 1, nz);
        const luz = Math.max(0, (nx * Lz[0] + Lz[1] + nz * Lz[2]) / (nl * ll));
        const e = Math.min(1, Math.max(0, (n[k] - AGUA) / (CIMA - AGUA)));
        const col = colorDe(e), f = 0.42 + 0.82 * luz;
        d[q] = col[0] * f; d[q + 1] = col[1] * f; d[q + 2] = col[2] * f; d[q + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);

      // cuadrícula de distancias cada 25 mi, medida desde O
      const px = CW / MW, ppm = px * MI;   // píxeles por metro y por milla
      const Ox = (OX + MW / 2) * px, Oy = (OZ + MD / 2) * px;
      for (let m = -400; m <= 900; m += 25) {
        const w = m % 100 === 0 ? 2 : 1, a = m % 100 === 0 ? 0.5 : m % 50 === 0 ? 0.3 : 0.15;
        ctx.strokeStyle = `rgba(16,30,44,${a})`; ctx.lineWidth = w;
        const xx = Ox + m * ppm, yy = Oy - m * ppm;
        if (xx > 0 && xx < CW) { ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, CH); ctx.stroke(); }
        if (yy > 0 && yy < CH) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(CW, yy); ctx.stroke(); }
      }
      // rutas (ejes) con marcas cada 50 mi
      ctx.strokeStyle = '#173a5e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(Ox, Oy); ctx.lineTo(CW, Oy); ctx.moveTo(Ox, Oy); ctx.lineTo(Ox, 0); ctx.stroke();
      ctx.lineWidth = 3;
      for (let m = 50; m <= 800; m += 50) {
        const t = m % 100 === 0 ? 14 : 8;
        const xx = Ox + m * ppm, yy = Oy - m * ppm;
        if (xx < CW) { ctx.beginPath(); ctx.moveTo(xx, Oy - t); ctx.lineTo(xx, Oy + t); ctx.stroke(); }
        if (yy > 0) { ctx.beginPath(); ctx.moveTo(Ox - t, yy); ctx.lineTo(Ox + t, yy); ctx.stroke(); }
      }
      // flechas de sentido hacia O
      ctx.fillStyle = '#173a5e';
      const flecha = (x, y, ang) => { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, -9); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill(); ctx.restore(); };
      for (const m of [75, 175, 275, 375]) { flecha(Ox + m * ppm, Oy, Math.PI); }
      for (const m of [75, 175, 275, 375, 475]) { flecha(Ox, Oy - m * ppm, Math.PI / 2); }
      const texto = (t, x, y, { tam = 22, peso = 700, al = 'center', color = '#10243a', halo = 'rgba(255,255,255,0.85)' } = {}) => {
        ctx.font = kit.font(tam, peso); ctx.textAlign = al; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.strokeStyle = halo; ctx.lineWidth = tam * 0.28; ctx.strokeText(t, x, y);
        ctx.fillStyle = color; ctx.fillText(t, x, y);
      };
      for (let m = 100; m <= 400; m += 100) texto(`${m} mi`, Ox + m * ppm, Oy + 34);
      for (let m = 100; m <= 500; m += 100) texto(`${m} mi`, Ox - 18, Oy - m * ppm, { al: 'right' });
      texto('RUTA DE A', Ox + 455 * ppm, Oy - 28, { tam: 20, color: '#8a4a00' });
      ctx.save(); ctx.translate(Ox + 30, Oy - 450 * ppm); ctx.rotate(-Math.PI / 2); texto('RUTA DE B', 0, 0, { tam: 20, color: '#0b4a86' }); ctx.restore();
      // punto O y ángulo recto
      ctx.strokeStyle = '#10243a'; ctx.lineWidth = 2.5; ctx.strokeRect(Ox + 6, Oy - 30, 24, 24);
      ctx.beginPath(); ctx.arc(Ox, Oy, 12, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(Ox, Oy, 4, 0, Math.PI * 2); ctx.fillStyle = '#10243a'; ctx.fill();
      texto('O', Ox - 26, Oy + 30, { tam: 34, peso: 800 });
      // rótulo, escala gráfica y norte
      ctx.fillStyle = 'rgba(246,244,236,0.92)'; ctx.fillRect(CW - 400, 22, 378, 92); ctx.strokeStyle = '#10243a'; ctx.lineWidth = 3; ctx.strokeRect(CW - 400, 22, 378, 92);
      texto('SECTOR DE CONTROL', CW - 211, 50, { tam: 26, peso: 800, halo: 'rgba(0,0,0,0)' });
      texto('Escala 1 mi ≈ 2,5 mm · cuadrícula de 25 mi', CW - 211, 88, { tam: 17, peso: 600, halo: 'rgba(0,0,0,0)' });
      const bx = 34, by = CH - 46;
      for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#f4f2ea' : '#10243a'; ctx.fillRect(bx + k * 25 * ppm, by, 25 * ppm, 12); }
      ctx.strokeStyle = '#10243a'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, 100 * ppm, 12);
      texto('0', bx, by - 16, { tam: 18 }); texto('50', bx + 50 * ppm, by - 16, { tam: 18 }); texto('100 mi', bx + 100 * ppm + 10, by - 16, { tam: 18 });
      const nx = CW - 70, ny = CH - 120;
      ctx.fillStyle = '#10243a'; ctx.beginPath(); ctx.moveTo(nx, ny - 46); ctx.lineTo(nx + 16, ny + 10); ctx.lineTo(nx, ny); ctx.lineTo(nx - 16, ny + 10); ctx.closePath(); ctx.fill();
      texto('N', nx, ny + 36, { tam: 28, peso: 800 });
      return c;
    }

    // ------------------------------------------------------------ maquetas de los aviones (una malla con colores por vértice)
    const matAvion = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.18 });
    function avion(colorCola) {
      const La = crearLote(kit), cola = new THREE.Color(colorCola), blanco = new THREE.Color(0xf4f5f7), panza = new THREE.Color(0xc4cad1);
      const A = (geo, o) => La.poner('a', geo, { uv: 'propia', ...o });
      const perfil = [[0, -0.075], [0.0024, -0.073], [0.0048, -0.066], [0.0072, -0.052], [0.0086, -0.035], [0.009, -0.012], [0.009, 0.034],
        [0.0085, 0.049], [0.0072, 0.059], [0.005, 0.067], [0.0024, 0.0725], [0, 0.0748]];
      const fus = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), 28);
      fus.rotateZ(-Math.PI / 2); // eje del fuselaje a lo largo de +x (la nariz en +x)
      A(fus, { colorV: (x, y) => (y < -0.0026 ? panza : Math.abs(y + 0.0008) < 0.0011 && x < 0.055 && x > -0.06 ? cola : blanco) });
      A(caja(0.009, 0.003, 0.011), { x: 0.06, y: 0.0052, color: 0x1b2630 });
      const planta = (pts, prof, o) => {
        const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
        A(new THREE.ExtrudeGeometry(sh, { depth: prof, bevelEnabled: false }), o);
      };
      // alas y estabilizador horizontal en planta (la forma se gira para quedar horizontal)
      planta([[0.024, 0], [-0.014, 0.066], [-0.027, 0.066], [-0.017, 0.009], [-0.02, 0], [-0.017, -0.009], [-0.027, -0.066], [-0.014, -0.066]], 0.0016, { rx: Math.PI / 2, y: -0.0028, color: 0xc3c9cf });
      planta([[-0.05, 0], [-0.066, 0.027], [-0.075, 0.027], [-0.07, 0.004], [-0.071, 0], [-0.07, -0.004], [-0.075, -0.027], [-0.066, -0.027]], 0.0013, { rx: Math.PI / 2, y: 0.0035, color: 0xc3c9cf });
      planta([[-0.044, 0.004], [-0.067, 0.034], [-0.077, 0.034], [-0.075, 0.004]], 0.0014, { z: -0.0007, color: colorCola });
      for (const l of [-1, 1]) {
        A(cil(0.0038, 0.0043, 0.022, 20), { x: 0.011, y: -0.0088, z: l * 0.024, rz: -Math.PI / 2, color: colorCola });
        A(new THREE.CircleGeometry(0.0036, 16).rotateY(Math.PI / 2), { x: 0.0221, y: -0.0088, z: l * 0.024, color: 0x22262a });
        A(caja(0.012, 0.004, 0.0016), { x: 0.006, y: -0.0055, z: l * 0.024, color: 0xc3c9cf });
      }
      return La.unir('a');
    }
    const avA = new THREE.Mesh(avion(0xee8a22), matAvion), avB = new THREE.Mesh(avion(0x2f7fd0), matAvion);
    avA.rotation.y = Math.PI; avB.rotation.y = -Math.PI / 2; // A vuela hacia −x y B hacia +z, ambos hacia O
    avA.castShadow = avB.castShadow = true;
    s0.add(avA, avB);

    // estelas: dos franjas por avión en una sola malla, de largo proporcional a la velocidad (lo recorrido en 0,2 h)
    const estelaTex = (() => {
      const c = document.createElement('canvas'); c.width = 8; c.height = 128;
      const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.06, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 8, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const estelaMat = new THREE.MeshBasicMaterial({ map: estelaTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    for (const [av, v] of [[avA, -M.vx], [avB, -M.vy]]) {
      const largo = v * 0.2 * MI, w = 0.00325, pos = [], uvs = [], idx = [];
      for (const l of [-1, 1]) {
        const z = l * 0.024, b = pos.length / 3;
        pos.push(-0.002, -0.0088, z - w, -0.002, -0.0088, z + w, -0.002 - largo, -0.0088, z - w, -0.002 - largo, -0.0088, z + w);
        uvs.push(0, 1, 1, 1, 0, 0, 1, 0);
        idx.push(b, b + 2, b + 1, b + 2, b + 3, b + 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx);
      const e = new THREE.Mesh(geo, estelaMat); e.renderOrder = 2; av.add(e);
    }

    // soportes de acrílico: vara y base en una sola malla que se estira hasta el relieve
    const LV = 0.12;
    const sopGeo = (() => {
      const La = crearLote(kit);
      La.poner('s', cil(0.0032, 0.0032, LV, 14), { y: 0.006 + LV / 2, uv: 'propia', color: 0xe8f4ff });
      La.poner('s', cil(0.024, 0.02, 0.006, 32), { y: 0.003, uv: 'propia', color: 0x3a4652 });
      return La.unir('s');
    })();
    const acrilico = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.55, roughness: 0.08, metalness: 0, depthWrite: false });
    const sopA = kit.malla(sopGeo, acrilico, { padre: s0, sombra: false }), sopB = kit.malla(sopGeo, acrilico, { padre: s0, sombra: false });
    function ponerSoporte(sp, x, z) {
      const hb = alturaEn(x, z);
      sp.position.set(x, hb, z); sp.scale.y = (VUELO - 0.008 - hb) / (LV + 0.006);
    }

    // ------------------------------------------------------------ x, y, s y el punto O
    const barraMat = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    const rayaTex = (() => {
      const c = document.createElement('canvas'); c.width = 4; c.height = 32;
      const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 4, 18);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    })();
    const bx = kit.barra([0, 0, 0], [0, 1, 0], 0.0022, barraMat(0xffb347), 6), by = kit.barra([0, 0, 0], [0, 1, 0], 0.0022, barraMat(0x5cc8ff), 6);
    const bs = kit.barra([0, 0, 0], [0, 1, 0], 0.0028, new THREE.MeshBasicMaterial({ color: 0xffd34d, map: rayaTex, alphaTest: 0.5, toneMapped: false }), 6);
    for (const b of [bx, by, bs]) { b.castShadow = false; s0.add(b); }
    const Op = [OX, VUELO, OZ];
    {
      const hO = alturaEn(OX, OZ), La = crearLote(kit), q = 0.035;
      Me(cil(0.0025, 0.0025, VUELO - hO, 10), { x: OX, y: PISO + (VUELO + hO) / 2, z: OZ, color: 0xb8bec4 });
      La.poner('o', esfera(0.007, 16, 12), { x: OX, y: VUELO, z: OZ, uv: 'propia' });
      for (const [a, b] of [[[OX + q, VUELO, OZ], [OX + q, VUELO, OZ - q]], [[OX, VUELO, OZ - q], [OX + q, VUELO, OZ - q]]]) La.poner('o', barraGeo(a, b, 0.0012, 5), { uv: 'propia' });
      kit.malla(La.unir('o'), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), { padre: s0, sombra: false });
    }
    const anillo = kit.malla(new THREE.TorusGeometry(0.06, 0.004, 8, 48), new THREE.MeshBasicMaterial({ color: 0xff4d4d, toneMapped: false }), { x: OX, y: VUELO, z: OZ, rx: Math.PI / 2, padre: s0, sombra: false });
    anillo.visible = false;

    const lA = etq('A · 450 mi/h', 0.03, { bg: '#ffb347', color: '#1a1206' }), lB = etq('B · 600 mi/h', 0.03, { bg: '#5cc8ff', color: '#08202c' });
    const lx = etq('x', 0.034, { color: '#ffb347' }), ly = etq('y', 0.034, { color: '#5cc8ff' }), ls = etq('s', 0.036, { bg: '#ffd34d', color: '#1a1206' });
    const lO = etq('O', 0.03, { color: '#ffffff' }), lConf = etq('CONFLICTO DE TRÁNSITO EN O', 0.045, { bg: '#d8342c', color: '#ffffff' });
    lO.position.set(OX - 0.022, VUELO + 0.022, OZ + 0.01); lConf.position.set(OX + 0.05, VUELO + 0.14, OZ);
    s0.add(lA, lB, lx, ly, ls, lO, lConf);

    // ------------------------------------------------------------ personas
    // controladora de pie al otro lado de la mesa: con la tablilla en la mano izquierda, señala con el índice el avión B
    // (la muñeca derecha va hacia un punto sobre B) y lo sigue con la mirada
    const ella = kit.persona({ preset: 'controladora', semilla: 23, padre: s0, x: -0.36, z: -1.42, ry: 0, colorSuperior: '#cfdcea', piel: kit.PIELES[2], colorPelo: kit.PELOS.castanoOscuro, ojos: kit.OJOS.avellana });
    ella.posar({
      ...kit.POSES.reposo(), columna: [0.09, 0, 0], pecho: [0.07, -0.08, 0], cuello: [0.04, 0, 0],
      musloD: [0.03, 0, -0.07], piernaD: [0.07, 0, 0], pieD: [-0.05, 0, 0.07], musloI: [-0.05, 0, 0.04], piernaI: [0.02, 0, 0], pieI: [0.03, 0, -0.04],
      brazoI: [-0.38, -0.32, 0.16], antebrazoI: [-1.45, 0, 0], manoI: [0.15, 0, -0.1], dedosI: 0.62, dedosD: { c: 1, indice: 0 },
    });
    // tablilla con el plan de vuelo, sujeta al pecho y tomada por el borde con la mano izquierda
    const tablilla = (() => {
      const La = crearLote(kit), r = (k) => ({ uv: 'rect', rect: uvP(k) });
      La.poner('t', caja(0.235, 0.0045, 0.32), { ...r(P.blanco), color: 0x8a6748 });
      La.poner('t', suelo(0.21, 0.28), { y: 0.0024, z: -0.012, ...r(P.plan) });
      La.poner('t', caja(0.1, 0.012, 0.035), { y: 0.006, z: 0.14, ...r(P.blanco), color: 0x9aa0a6 });
      const t = new THREE.Mesh(La.unir('t'), MAT.papel); t.castShadow = true;
      return t;
    })();
    ella.huesos.pecho.add(tablilla);
    tablilla.position.set(0.075, -0.17, 0.2); tablilla.rotation.set(-Math.PI / 2 + 0.3, 0.25, 0, 'YXZ');
    const agarre = new THREE.Object3D(); agarre.position.set(0.15, 0.0, -0.02); tablilla.add(agarre);
    const objSenal = V();
    ella.alcanzar('D', objSenal); ella.alcanzar('I', agarre); ella.mirar(avB);

    // controlador sentado en su puesto: las manos sobre el teclado (escribe) y la mirada en el radar o en la lista
    const el = kit.persona({ preset: 'controlador', semilla: 8, padre: s0, x: 0.75, z: -2.08, ry: Math.PI, superior: 'polera', manga: 'corta', colorSuperior: '#2b3d57', barba: 'sombra', pelo: 'entradas', colorPelo: kit.PELOS.negro, piel: kit.PIELES[4], lentes: true });
    el.posar({ ...kit.POSES.sentado(0.47), columna: [0.1, 0, 0], pecho: [0.06, 0, 0], antebrazoD: [-1.2, 1.1, 0], antebrazoI: [-1.2, -1.1, 0], manoD: [-0.25, 0, 0.1], manoI: [-0.25, 0, -0.1], dedosD: 0.38, dedosI: 0.38 });
    const teclaD = V(), teclaI = V();
    const baseD = V(0.75 + 0.095, PISO + 0.795, ZC - 0.08), baseI = V(0.75 - 0.095, PISO + 0.795, ZC - 0.08);
    const miraRadar = g.localToWorld(V(0.75, PISO + 1.2, ZC - 0.73)), miraLista = g.localToWorld(V(0.15, PISO + 1.1, ZC - 0.68));
    el.alcanzar('D', teclaD); el.alcanzar('I', teclaI); el.mirar(miraRadar);
    function teclear(t) {
      teclaD.copy(baseD); teclaD.y += 0.008 * Math.max(0, Math.sin(t * 9.1)) ** 2; teclaD.x += 0.012 * Math.sin(t * 1.3); g.localToWorld(teclaD);
      teclaI.copy(baseI); teclaI.y += 0.008 * Math.max(0, Math.sin(t * 7.3 + 1.7)) ** 2; teclaI.x += 0.009 * Math.sin(t * 1.1 + 2); g.localToWorld(teclaI);
    }
    // la muñeca derecha de la controladora va por la recta del hombro al punto sobre B, hasta donde alcanza el brazo
    const vB = V(), vH = V(), vD = V();
    let alcance = 0.5;
    function apuntar() {
      avB.getWorldPosition(vB); vB.y += 0.1;
      ella.huesos.brazoD.getWorldPosition(vH);
      vD.copy(vB).sub(vH); const dist = vD.length(); vD.normalize();
      objSenal.copy(vH).addScaledVector(vD, Math.max(0.2, Math.min(alcance * 0.93, dist - 0.15)));
    }

    // ------------------------------------------------------------ mallas unidas por material
    const unir = (clave, mat, sombra = true) => {
      const geo = L.unir(clave);
      if (!geo) return null;
      const m = new THREE.Mesh(geo, mat); m.castShadow = sombra; m.receiveShadow = true; g.add(m);
      return m;
    };
    unir('sat', MAT.sat); unir('mate', MAT.mate); unir('metal', MAT.metal); unir('madera', MAT.madera); unir('acan', MAT.acan);
    unir('piso', MAT.piso); unir('papel', MAT.papel, false); unir('pant', MAT.pant, false);

    // ------------------------------------------------------------ escena según el reloj
    const v1 = V(), v2 = V();
    function construir() {
      const t = reloj.t, A = posA(t), B = posB(t), sv = M.s(t), conf = conflicto();
      avA.position.set(...A); avB.position.set(...B);
      ponerSoporte(sopA, A[0], A[2]); ponerSoporte(sopB, B[0], B[2]);
      kit.moverBarra(bx, A, Op); kit.moverBarra(by, B, Op); kit.moverBarra(bs, A, B);
      rayaTex.repeat.set(1, Math.max(1, (sv * MI) / 0.012));
      // cerca del aeropuerto las distancias del mapa son más cortas que los rótulos: las cotas siguen, sus rótulos no
      const visible = sv > 18, rotulosCotas = sv > 150;
      bx.visible = by.visible = bs.visible = visible;
      lx.visible = ly.visible = ls.visible = rotulosCotas;
      kit.cambiarEtiqueta(lx, `x = ${kit.num(M.x(t), 1)} mi`); lx.position.set((A[0] + OX) / 2, VUELO + 0.026, OZ + 0.03);
      kit.cambiarEtiqueta(ly, `y = ${kit.num(M.y(t), 1)} mi`); ly.position.set(OX - 0.07, VUELO + 0.026, (B[2] + OZ) / 2);
      kit.cambiarEtiqueta(ls, `s = ${kit.num(sv, 1)} mi`);
      v1.set((A[0] + B[0]) / 2, VUELO, (A[2] + B[2]) / 2); v2.set(v1.x - OX, 0, v1.z - OZ).normalize();
      ls.position.set(v1.x + v2.x * 0.05, VUELO + 0.03, v1.z + v2.z * 0.05);
      // los rótulos de los aviones van a alturas distintas para no pisarse cuando se juntan
      lA.position.set(A[0], VUELO + 0.045, A[2]); lB.position.set(B[0], VUELO + 0.1, B[2]);
      lA.visible = lB.visible = !conf;
      lO.visible = !conf && rotulosCotas;
      anillo.visible = lConf.visible = conf;
    }

    // ------------------------------------------------------------ gráfico de s(t) con la tangente
    const graf = kit.grafico({
      f: (t) => M.s(t), x0: -0.1, x1: M.llegada(), y0: 0, y1: 500, width: 1.3, height: 0.8,
      xTicks: [-0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5], yTicks: [0, 100, 200, 300, 400, 500], tickFmt: (v) => kit.num(v, 1), yTickFmt: (v) => String(v),
      xLabel: 'tiempo t (h)', yLabel: 'distancia s (mi)', curveColor: 0xffd34d,
    });
    graf.group.position.set(0.9, 1.16 + PISO, -0.12); graf.group.rotation.y = -0.85;
    g.add(graf.group);
    graf.group.children[0].material.depthWrite = true; // el fondo del gráfico tapa los rótulos lejanos
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => reloj.fijar(graf.xFromLocal(p.x)) });
    // triángulo de pendiente: en 0,1 h la distancia baja 75 mi
    const pendMat = new THREE.MeshBasicMaterial({ color: 0xff9f6b, toneMapped: false });
    const tH = new THREE.Mesh(new THREE.BoxGeometry(1, 0.004, 0.004), pendMat), tV = new THREE.Mesh(new THREE.BoxGeometry(0.004, 1, 0.004), pendMat);
    const lDt = kit.createLabel('Δt = 0,1 h', { size: 0.032, color: '#ffcfb0', weight: 700 }), lDs = kit.createLabel('Δs = −75 mi', { size: 0.032, color: '#ffcfb0', weight: 700 });
    const triP = new THREE.Group(); triP.position.z = 0.006; triP.add(tH, tV, lDt, lDs); graf.group.add(triP);
    function ponerPendiente(t) {
      const ta = Math.min(t, M.llegada() - 0.1), tb = ta + 0.1;
      const Pp = graf.toLocal(ta, M.s(ta)), Q = graf.toLocal(tb, M.s(ta)), Rp = graf.toLocal(tb, M.s(tb));
      tH.position.set((Pp.x + Q.x) / 2, Pp.y, 0); tH.scale.x = Q.x - Pp.x;
      tV.position.set(Q.x, (Q.y + Rp.y) / 2, 0); tV.scale.y = Q.y - Rp.y;
      lDt.position.set((Pp.x + Q.x) / 2, Pp.y + 0.03, 0);
      lDs.position.set(tb > 0.45 ? Q.x - 0.1 : Q.x + 0.1, (Q.y + Rp.y) / 2, 0);
      triP.visible = !conflicto();
    }

    function revelar() {
      graf.removePoint('inst');
      if (s.revelar) graf.addPoint('inst', M.instante, M.s(M.instante), { color: 0x6fe3a2, labelX: 't = 0', labelY: '375' });
      s.ultimo = -1;
    }

    // ------------------------------------------------------------ panel
    const pieRev = 'En t = 0: s = √(225² + 300²) = 375 mi y 375·ds/dt = 225·(−450) + 300·(−600) = −281.250, así que ds/dt = −750 mi/h. La distancia entre los aviones se reduce a 750 mi/h.';
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'A está a 225 mi de O y vuela a 450 mi/h; B está a 300 mi de O y vuela a 600 mi/h, a la misma altura y en rutas perpendiculares. ¿A qué razón cambia la distancia s entre ellos?',
      ecuaciones: ['s² = x² + y²   ⇒   s·ds/dt = x·dx/dt + y·dy/dt', 'x = 225 − 450t,   y = 300 − 600t   (t en horas)'],
      lecturas: [
        { etiqueta: 'x (de A a O)', valor: () => `${kit.num(M.x(reloj.t), 1)} mi`, color: '#ffb347' },
        { etiqueta: 'y (de B a O)', valor: () => `${kit.num(M.y(reloj.t), 1)} mi`, color: '#5cc8ff' },
        { etiqueta: 's (entre A y B)', valor: () => `${kit.num(M.s(reloj.t), 1)} mi`, color: '#ffd34d' },
        { etiqueta: 'dx/dt', valor: () => `${kit.num(M.vx, 0)} mi/h`, color: '#ffb347', escala: 0.7 },
        { etiqueta: 'dy/dt', valor: () => `${kit.num(M.vy, 0)} mi/h`, color: '#5cc8ff', escala: 0.7 },
        { etiqueta: 'ds/dt', valor: () => (conflicto() ? '—' : `${kit.num(M.dsdt(reloj.t), 1)} mi/h`), color: '#ffd34d', escala: 0.7 },
      ],
      deslizadores: [
        { etiqueta: 'Tiempo t', min: -0.1, max: M.llegada(), paso: 0.005, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 3)} h  (${kit.num(v * 60, 1)} min)` },
        { etiqueta: 'Velocidad del reloj', min: 0.01, max: 0.12, paso: 0.005, color: '#ffb347', get: () => reloj.velocidad, set: (v) => { reloj.velocidad = v; }, formato: (v) => `${kit.num(v * 60, 1)} min por segundo` },
      ],
      botones: [
        { etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() },
        { etiqueta: 'Ir al instante (t = 0)', accion: () => reloj.alInstante() },
        { etiqueta: 'Revelar respuesta', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      lineasPie: 5,
      pie: () => {
        if (conflicto()) return 'Conflicto de tránsito: A y B llegan juntos a O en t = 0,5 h, a la misma altura. ' + (s.revelar ? pieRev : 'Uno de los dos debe cambiar de altura o de ruta.');
        return s.revelar ? pieRev : 'Reproduce el reloj, mueve el tiempo o arrastra el gráfico. La pendiente de la tangente a s(t) es ds/dt. En el instante del problema (t = 0), A está a 225 mi de O y B a 300 mi.';
      },
      pieColor: () => (conflicto() ? kit.THEME.bad : s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-1.38, 1.4 + PISO, 0.42); panel.mesh.rotation.y = 0.86;
    panel.mesh.renderOrder = 13; // tapa los rótulos que quedan detrás
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    // ------------------------------------------------------------ estado inicial: pantallas, maquetas y personas en pose
    pintarPantallasFijas(); pintarRadar(); pintarMuro();
    if (rev) reloj.fijar(Number(rev[1]));
    construir();
    teclear(0); apuntar();
    ella.actualizar(1); el.actualizar(1);
    alcance = ella.huesos.brazoD.getWorldPosition(V()).distanceTo(ella.huesos.antebrazoD.getWorldPosition(V())) + ella.huesos.antebrazoD.getWorldPosition(V()).distanceTo(ella.huesos.manoD.getWorldPosition(V()));
    apuntar(); ella.actualizar(0.016);

    const vel = () => ({ tipo: 'boton', etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() });
    return {
      paneles: [panel],
      radioSombra: 11,
      alturaCartel: 4.2,
      // la mesa ocupa el frente y los costados bajos: en VR el panel y el gráfico van más abiertos y más altos
      laminaVR: { angulo: 64, altura: 1.3, distancia: 1.45 },
      vista: { escritorio: { camara: [0.25, 1.9 + PISO, 2.75], objetivo: [0, 0.95 + PISO, -0.5] }, vr: { pos: [0, PISO, 1.6], yaw: 0 } },
      dom: [
        vel(),
        { tipo: 'rango', etiqueta: 't', min: -0.1, max: M.llegada(), paso: 0.005, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 3)} h` },
        { tipo: 'rango', etiqueta: 'velocidad', min: 0.01, max: 0.12, paso: 0.005, get: () => reloj.velocidad, set: (v) => { reloj.velocidad = v; }, formato: (v) => `${kit.num(v * 60, 1)} min/s` },
        { tipo: 'boton', etiqueta: 'Ir al instante (t = 0)', accion: () => reloj.alInstante() },
        { tipo: 'interruptor', etiqueta: 'Revelar respuesta', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      actualizar(dt, activa) {
        s.tiempo += dt;
        antena.rotation.y += dt * 1.55;
        if (activa) reloj.tick(dt);
        if (s.ultimo !== reloj.cambio) {
          s.ultimo = reloj.cambio;
          construir();
          graf.setMarker(reloj.t);
          // s(t) es lineal: la tangente coincide con la recta; se centra dentro del intervalo para no salir del gráfico
          const tc = Math.min(M.llegada() - 0.1, Math.max(0, reloj.t));
          graf.setTangent(tc, conflicto() ? null : M.dsdt(reloj.t), { color: 0xff7a5c, len: 0.5 });
          ponerPendiente(reloj.t);
          graf.removePoint('conf');
          if (conflicto()) graf.addPoint('conf', M.llegada(), 0, { color: 0xff6b6b, guides: false });
          panel.invalidate();
        }
        if (conflicto()) {
          const k = 1 + 0.25 * Math.sin(s.tiempo * 7);
          anillo.scale.set(k, k, k);
          baliza.emissiveIntensity = Math.sin(s.tiempo * 9) > 0 ? 2.2 : 0.1;
        } else if (baliza.emissiveIntensity !== 0) baliza.emissiveIntensity = 0;
        // pantallas de radar y mural: se repintan cinco veces por segundo
        s.tPantalla += dt;
        if (s.tPantalla >= 0.2) { s.tPantalla = 0; pintarRadar(); pintarMuro(); texPant.needsUpdate = true; }
        // personas
        apuntar();
        ella.actualizar(dt);
        s.tMirada -= dt;
        if (s.tMirada <= 0) { s.mirada = 1 - s.mirada; s.tMirada = s.mirada ? 2.4 : 4.5; el.mirar(s.mirada ? miraLista : miraRadar); }
        teclear(s.tiempo);
        el.actualizar(dt);
      },
    };
  },
};
