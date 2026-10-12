// Ejercicio 1.5. Recipiente sin tapa para 10 m³ de arena, con largo igual al doble del ancho.
// Base $30.000 por m² y costados $20.000 por m².  C(w) = 60.000w² + 600.000/w,  w > 0
import { ARENA as M } from '../../src/math/guia4.js';

const TB = 0.02; // espesor de la plancha de la base
const TS = 0.008; // espesor de las planchas de los costados
const HP = 0.12; // alto de los patines
const Y0 = HP + TB; // piso interior del recipiente
const W0 = 0.8, W1 = 3.0; // rango del ancho en el deslizador

// Caja con coordenadas UV a escala real (s metros por repetición)
function cajaUV(THREE, w, h, d, { s = 1 } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x / s, z / s);
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, z / s, y / s);
    else uv.setXY(i, x / s, y / s);
  }
  uv.needsUpdate = true;
  return geo;
}

// Persona de referencia de 1,75 m con casco y chaleco reflectante
function crearPersona(kit, padre, { x = 0, z = 0, ry = 0 } = {}) {
  const { THREE } = kit;
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; padre.add(p);
  const m = (color, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const piel = m(0xc08a64, 0.7), jean = m(0x33465e, 0.9), polera = m(0x56606b, 0.9), bota = m(0x3a2a1d, 0.8);
  const chaleco = m(0xf08a24, 0.7, { emissive: 0x2a1204 }), cinta = m(0xd0d4d8, 0.35, { metalness: 0.5 }), casco = m(0xf2c21b, 0.35);
  for (const sx of [-1, 1]) {
    kit.caja(0.11, 0.09, 0.27, bota, { x: sx * 0.1, y: 0.045, z: 0.035, padre: p });
    kit.cilindro(0.062, 0.075, 0.82, jean, { x: sx * 0.1, y: 0.5, padre: p, seg: 12 });
    kit.malla(new THREE.CapsuleGeometry(0.047, 0.46, 4, 10), polera, { x: sx * 0.215, y: 1.2, rz: sx * 0.07, padre: p });
    kit.malla(new THREE.SphereGeometry(0.045, 12, 10), piel, { x: sx * 0.235, y: 0.9, padre: p });
  }
  kit.caja(0.34, 0.16, 0.21, jean, { y: 0.95, padre: p });
  kit.malla(new THREE.CapsuleGeometry(0.165, 0.3, 4, 14), polera, { y: 1.22, padre: p }).scale.z = 0.62;
  kit.malla(new THREE.CapsuleGeometry(0.172, 0.2, 4, 14), chaleco, { y: 1.24, padre: p }).scale.z = 0.66;
  for (const yy of [1.12, 1.3]) kit.malla(new THREE.CylinderGeometry(0.176, 0.176, 0.03, 16, 1, true), cinta, { y: yy, padre: p }).scale.z = 0.67;
  kit.cilindro(0.05, 0.05, 0.1, piel, { y: 1.55, padre: p, seg: 10 });
  kit.malla(new THREE.SphereGeometry(0.1, 16, 12), piel, { y: 1.65, padre: p });
  kit.malla(new THREE.SphereGeometry(0.118, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), casco, { y: 1.675, padre: p });
  kit.cilindro(0.135, 0.135, 0.012, casco, { y: 1.675, z: 0.015, padre: p, seg: 18 });
  return p;
}

// Carretilla de obra con arena: la rueda queda hacia +z local
function crearCarretilla(kit, padre, arenaMat) {
  const { THREE } = kit;
  const c = new THREE.Group(); padre.add(c);
  const pintura = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, metalness: 0.45, roughness: 0.5, side: THREE.DoubleSide });
  const tubo = new THREE.MeshStandardMaterial({ color: 0x2b2e31, metalness: 0.6, roughness: 0.45 });
  const goma = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.9 });
  const bandejaGeo = new THREE.CylinderGeometry(0.5, 0.32, 0.28, 4, 1, true).toNonIndexed();
  bandejaGeo.rotateY(Math.PI / 4); bandejaGeo.scale(0.86, 1, 1.22); bandejaGeo.computeVertexNormals();
  kit.malla(bandejaGeo, pintura, { y: 0.46, padre: c });
  kit.caja(0.38, 0.006, 0.54, pintura, { y: 0.323, padre: c });
  const colmo = kit.malla(new THREE.SphereGeometry(0.35, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2), arenaMat, { y: 0.55, padre: c });
  colmo.scale.set(0.78, 0.28, 1.13);
  kit.malla(new THREE.TorusGeometry(0.17, 0.045, 10, 26), goma, { y: 0.215, z: 0.66, ry: Math.PI / 2, padre: c });
  kit.cilindro(0.07, 0.07, 0.07, tubo, { y: 0.215, z: 0.66, rz: Math.PI / 2, padre: c, seg: 14 });
  for (const sx of [-1, 1]) {
    c.add(kit.barra([sx * 0.05, 0.215, 0.66], [sx * 0.26, 0.37, 0.05], 0.016, tubo));
    c.add(kit.barra([sx * 0.26, 0.37, 0.05], [sx * 0.3, 0.6, -0.78], 0.016, tubo));
    c.add(kit.barra([sx * 0.22, 0.36, -0.22], [sx * 0.24, 0.0, -0.32], 0.014, tubo));
    kit.caja(0.05, 0.012, 0.09, tubo, { x: sx * 0.24, y: 0.006, z: -0.32, padre: c });
    kit.cilindro(0.021, 0.021, 0.13, goma, { x: sx * 0.305, y: 0.62, z: -0.76, rx: Math.PI / 2 - 0.25, padre: c, seg: 10 });
  }
  return c;
}

// Montón de arena con borde irregular
function crearMonton(kit, padre, mat, rnd, r = 1.05, h = 0.62) {
  const { THREE } = kit;
  const geo = new THREE.ConeGeometry(r, h, 30, 6, true);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (y + h / 2) / h; // 0 en la base, 1 en la cima
    const ang = Math.atan2(z, x), k = 1 + 0.08 * Math.sin(ang * 3 + 1.3) + 0.05 * Math.sin(ang * 7) + (rnd() - 0.5) * 0.03 * (1 - t);
    const curva = Math.pow(1 - t, 0.75); // ladera algo cóncava, como la arena suelta
    const rr = Math.hypot(x, z) > 1e-6 ? (r * curva * k) / Math.hypot(x, z) : 0;
    p.setXYZ(i, x * rr, t * h, z * rr);
  }
  geo.computeVertexNormals();
  return kit.malla(geo, mat, { padre });
}

export default {
  id: 'arena',
  tipo: 'optimizacion',
  etiqueta: 'Ejercicio 1.5 · Optimización',
  titulo: 'Recipiente para arena',
  resumen: 'Un recipiente con base rectangular destinado a almacenar arena debe contener 10 metros cúbicos del material. El largo de su base es el doble de su ancho. El material para la base cuesta 30.000 pesos el metro cuadrado y el material para los costados 20.000 pesos el metro cuadrado. Encuentre las dimensiones del recipiente sin tapa más económico que se puede construir.',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const s = { w: 2.2, arena: true, revelar: false, cambio: true };
    const rnd = kit.mulberry32(17);

    // ---------------------------------------------------------------- terreno: grava, piedras y pasto
    const pad = kit.malla(new THREE.CircleGeometry(8.2, 56), kit.mat('gravel', { repeat: [15, 15], color: 0xc2b8a4, normalScale: 0.55 }), { rx: -Math.PI / 2, y: 0.025, z: 0.8, sombra: false, padre: g });
    pad.material.polygonOffset = true; pad.material.polygonOffsetFactor = -3;
    {
      const n = 90, piedras = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8e877b, roughness: 0.95, flatShading: true }), n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = 4.6 + rnd() * 3.4, sc = 0.03 + rnd() * rnd() * 0.12;
        e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(Math.cos(a) * r, sc * 0.35, 0.8 + Math.sin(a) * r), q, new THREE.Vector3(sc * (1 + rnd() * 0.5), sc * 0.7, sc)); piedras.setMatrixAt(i, m4);
      }
      piedras.castShadow = true; piedras.receiveShadow = true; g.add(piedras);
      const hojas = [];
      for (let i = 0; i < 8; i++) {
        const h = 0.18 + rnd() * 0.2, c = new THREE.ConeGeometry(0.011, h, 3, 1, true);
        c.translate(0, h / 2, 0); c.rotateZ(0.2 + rnd() * 0.4); c.rotateY((i / 8) * Math.PI * 2 + rnd() * 0.5);
        hojas.push(c);
      }
      const nm = 120, matas = new THREE.InstancedMesh(kit.mergeGeometries(hojas), new THREE.MeshStandardMaterial({ color: 0x74883e, roughness: 0.95, side: THREE.DoubleSide }), nm);
      for (let i = 0; i < nm; i++) {
        const grupo = Math.floor(i / 4), a = (grupo * 2.399) % (Math.PI * 2), r = 8.0 + ((grupo * 0.37) % 1) * 0.9;
        const x = Math.cos(a) * r + (rnd() - 0.5) * 0.4, z = 0.8 + Math.sin(a) * r + (rnd() - 0.5) * 0.4, sc = 0.6 + rnd() * 0.9;
        e.set((rnd() - 0.5) * 0.25, rnd() * 6, (rnd() - 0.5) * 0.25); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(sc, sc, sc)); matas.setMatrixAt(i, m4);
      }
      matas.castShadow = true; g.add(matas);
    }

    // ---------------------------------------------------------------- recipiente de acero
    // acero pintado: textura fina de pintura gastada sobre la plancha
    const pintura = kit.mat('plaster', { repeat: [1, 1], color: 0x4a7fb3, metalness: 0.3, roughness: 0.62, normalScale: 0.35, seed: 9 });
    const pinturaLisa = new THREE.MeshStandardMaterial({ color: 0x3f71a2, metalness: 0.35, roughness: 0.55 });
    const oscuro = new THREE.MeshStandardMaterial({ color: 0x2c3136, metalness: 0.55, roughness: 0.6 });
    const arenaMat = kit.mat('sand', { repeat: [1, 1], color: 0xf1e3c8, normalScale: 0.9 });
    // cara interior: acero raspado por la arena, sin pintura
    const raspado = kit.mat('metal', { repeat: [1, 1], color: 0x8a7d6d, metalness: 0.45, roughness: 0.8, normalScale: 0.3, seed: 4 });
    const malla = (mat) => kit.malla(new THREE.BufferGeometry(), mat, { padre: g });
    // orden de las caras de BoxGeometry: +x, −x, +y, −y, +z, −z
    const caras = (interior) => [0, 1, 2, 3, 4, 5].map((i) => (i === interior ? raspado : pintura));
    const plBase = malla(caras(2)), plFrente = malla(caras(5)), plFondo = malla(caras(4)), plIzq = malla(caras(0)), plDer = malla(caras(1));
    const arena = malla(arenaMat);
    // refuerzos, vigas superiores y patines: cajas unitarias escaladas por instancia
    const MAXR = 96;
    const refuerzos = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), pinturaLisa, MAXR);
    refuerzos.castShadow = true; refuerzos.receiveShadow = true; refuerzos.frustumCulled = false; g.add(refuerzos);
    const patines = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), oscuro, 8);
    patines.castShadow = true; patines.receiveShadow = true; patines.frustumCulled = false; g.add(patines);
    // cantoneras: perfil L de 80 × 80 × 8 mm, de alto unitario
    const perfil = new THREE.Shape();
    const a = 0.08, e8 = 0.008;
    [[-a, 0], [0, 0], [0, -a], [e8, -a], [e8, e8], [-a, e8]].forEach(([px, pz], i) => (i ? perfil.lineTo(px, -pz) : perfil.moveTo(px, -pz)));
    const perfilGeo = new THREE.ExtrudeGeometry(perfil, { depth: 1, bevelEnabled: false });
    perfilGeo.rotateX(-Math.PI / 2);
    const cantoneras = [0, 1, 2, 3].map(() => kit.malla(perfilGeo, pinturaLisa, { padre: g }));
    // orejas de izaje
    const orejas = [0, 1, 2, 3].map(() => kit.malla(new THREE.TorusGeometry(0.045, 0.013, 8, 18), oscuro, { padre: g }));
    // rótulo pintado en el costado
    const rot = (() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 160;
      const x = c.getContext('2d');
      x.clearRect(0, 0, 512, 160); x.fillStyle = 'rgba(245,245,240,0.92)'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '800 92px system-ui, sans-serif'; x.fillText('10 m³', 256, 64);
      x.font = '700 38px system-ui, sans-serif'; x.fillText('SOLO ARENA', 256, 132);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return kit.malla(new THREE.PlaneGeometry(1, 0.3125), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }), { sombra: false, padre: g });
    })();

    // ---------------------------------------------------------------- entorno: carretilla, montón con pala y persona
    const carretilla = crearCarretilla(kit, g, arenaMat);
    const monton = crearMonton(kit, g, arenaMat, rnd);
    const pala = new THREE.Group(); g.add(pala);
    kit.cilindro(0.017, 0.017, 1.05, new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7 }), { y: 0.62, padre: pala, seg: 10 });
    kit.caja(0.12, 0.025, 0.03, new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.7 }), { y: 1.15, padre: pala });
    const hoja = kit.malla(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12, 1, true, -0.75, 1.5), new THREE.MeshStandardMaterial({ color: 0x55606a, metalness: 0.75, roughness: 0.45, side: THREE.DoubleSide }), { y: 0.0, z: -0.12, padre: pala });
    void hoja;
    const persona = crearPersona(kit, g);

    // ---------------------------------------------------------------- cotas y rótulos
    const cotaMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    function cota(radio = 0.017) {
      const c = { l: kit.barra([0, 0, 0], [0, 1, 0], radio, cotaMat), a: kit.barra([0, 0, 0], [0, 1, 0], radio, cotaMat), b: kit.barra([0, 0, 0], [0, 1, 0], radio, cotaMat) };
      for (const k of ['l', 'a', 'b']) { c[k].castShadow = false; g.add(c[k]); }
      return c;
    }
    function ponerCota(c, A, B, d, o1, o2) {
      kit.moverBarra(c.l, A, B);
      kit.moverBarra(c.a, A.map((v, i) => v + d[i] * o1), A.map((v, i) => v + d[i] * o2));
      kit.moverBarra(c.b, B.map((v, i) => v + d[i] * o1), B.map((v, i) => v + d[i] * o2));
    }
    const cL = cota(), cW = cota(), cH = cota();
    const lL = kit.etiqueta('largo', 0.24, { bg: '#ffb347', color: '#1a1206' }), lW = kit.etiqueta('ancho', 0.24, { bg: '#ffb347', color: '#1a1206' }), lH = kit.etiqueta('alto', 0.24, { bg: '#5cc8ff', color: '#08202c' });
    g.add(lL, lW, lH);

    // asa para arrastrar la esquina y cambiar w
    const asa = kit.malla(new THREE.SphereGeometry(0.15, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff6a00, emissiveIntensity: 0.8 }), { padre: g });
    kit.arrastre(asa, g, {
      normal: [0, 1, 0], punto: [0, 0.2, 0], cursor: 'grab', habilitado: est.habilitado,
      alMover: (p) => fijarW(Math.max(Math.abs(p.x) - TS - 0.2, 2 * (Math.abs(p.z) - TS - 0.2))),
    });
    function fijarW(w) { const v = Math.min(W1, Math.max(W0, Math.round(w * 100) / 100)); if (v !== s.w) { s.w = v; s.cambio = true; } }

    let geos = [];
    const nueva = (geo) => { geos.push(geo); return geo; };
    const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
    function construir() {
      const viejas = geos; geos = [];
      const w = s.w, L = 2 * w, H = M.h(w), X = L / 2 + TS, Z = w / 2 + TS;
      // planchas: base más gruesa que los costados y con un reborde de 3 cm
      plBase.geometry = nueva(cajaUV(THREE, L + 2 * TS + 0.06, TB, w + 2 * TS + 0.06, { s: 1.4 })); plBase.position.set(0, HP + TB / 2, 0);
      plFrente.geometry = plFondo.geometry = nueva(cajaUV(THREE, L + 2 * TS, H, TS, { s: 1.4 }));
      plFrente.position.set(0, Y0 + H / 2, w / 2 + TS / 2); plFondo.position.set(0, Y0 + H / 2, -w / 2 - TS / 2);
      plIzq.geometry = plDer.geometry = nueva(cajaUV(THREE, TS, H, w, { s: 1.4 }));
      plIzq.position.set(-L / 2 - TS / 2, Y0 + H / 2, 0); plDer.position.set(L / 2 + TS / 2, Y0 + H / 2, 0);
      // arena al ras del borde
      arena.geometry = nueva(cajaUV(THREE, L - 0.003, H, w - 0.003, { s: 0.9 })); arena.position.set(0, Y0 + H / 2, 0);
      arena.visible = s.arena;
      // refuerzos
      let k = 0;
      const pon = (x, y, z, sx, sy, sz) => { if (k >= MAXR) return; P.set(x, y, z); S.set(sx, sy, sz); m4.compose(P, q0, S); refuerzos.setMatrixAt(k++, m4); };
      const yv = Y0 + (H - 0.07) / 2, hv = H - 0.07;
      const nL = Math.max(1, Math.round(L / 0.85) - 1), nW = Math.max(0, Math.round(w / 0.85) - 1);
      for (let i = 1; i <= nL; i++) { const x = -L / 2 + (L * i) / (nL + 1); pon(x, yv, Z + 0.025, 0.05, hv, 0.05); pon(x, yv, -Z - 0.025, 0.05, hv, 0.05); }
      for (let j = 1; j <= nW; j++) { const z = -w / 2 + (w * j) / (nW + 1); pon(X + 0.025, yv, z, 0.05, hv, 0.05); pon(-X - 0.025, yv, z, 0.05, hv, 0.05); }
      const nC = H > 1.9 ? Math.floor(H / 1.4) : 0;
      for (let j = 1; j <= nC; j++) {
        const y = Y0 + (H * j) / (nC + 1);
        pon(0, y, Z + 0.025, L + 2 * TS, 0.05, 0.05); pon(0, y, -Z - 0.025, L + 2 * TS, 0.05, 0.05);
        pon(X + 0.025, y, 0, 0.05, 0.05, w + 2 * TS); pon(-X - 0.025, y, 0, 0.05, 0.05, w + 2 * TS);
      }
      // viga superior de borde (tubo de 60 × 50 mm) y viga inferior sobre el reborde de la base
      const yt = Y0 + H - 0.03;
      pon(0, yt, Z + 0.025, L + 2 * TS + 0.1, 0.06, 0.05); pon(0, yt, -Z - 0.025, L + 2 * TS + 0.1, 0.06, 0.05);
      pon(X + 0.025, yt, 0, 0.05, 0.06, w + 2 * TS); pon(-X - 0.025, yt, 0, 0.05, 0.06, w + 2 * TS);
      pon(0, Y0 + 0.03, Z + 0.02, L + 2 * TS, 0.06, 0.04); pon(0, Y0 + 0.03, -Z - 0.02, L + 2 * TS, 0.06, 0.04);
      refuerzos.count = k; refuerzos.instanceMatrix.needsUpdate = true;
      // patines y travesaños bajo la base
      let kp = 0;
      const pp = (x, y, z, sx, sy, sz) => { P.set(x, y, z); S.set(sx, sy, sz); m4.compose(P, q0, S); patines.setMatrixAt(kp++, m4); };
      const zp = Math.max(0.16, w / 2 - 0.14);
      pp(0, HP / 2, zp, L + 0.3, HP, 0.1); pp(0, HP / 2, -zp, L + 0.3, HP, 0.1);
      for (const x of [-L / 2 + 0.1, 0, L / 2 - 0.1]) pp(x, HP - 0.04, 0, 0.08, 0.08, w);
      patines.count = kp; patines.instanceMatrix.needsUpdate = true;
      // cantoneras en las cuatro aristas verticales
      [[X, Z, 0], [X, -Z, Math.PI / 2], [-X, -Z, Math.PI], [-X, Z, -Math.PI / 2]].forEach(([x, z, r], i) => {
        cantoneras[i].position.set(x, HP, z); cantoneras[i].rotation.y = r; cantoneras[i].scale.set(1, H + TB, 1);
      });
      [[X + 0.03, w / 2 - 0.1], [X + 0.03, -w / 2 + 0.1], [-X - 0.03, w / 2 - 0.1], [-X - 0.03, -w / 2 + 0.1]].forEach(([x, z], i) => {
        orejas[i].position.set(x, Y0 + H + 0.035, z); orejas[i].rotation.y = Math.PI / 2;
      });
      // rótulo pintado en el paño más cercano al centro del frente
      const pano = L / (nL + 1), ancho = Math.min(1.15, pano * 0.86, H * 1.5);
      rot.scale.set(ancho, ancho, 1); rot.position.set(-L / 2 + pano * (Math.floor((nL + 1) / 2) + 0.5), Y0 + Math.max(H * 0.62, H - 0.08 - ancho * 0.25), Z + 0.002);
      // cotas
      const zc = Z + 0.5, xc = X + 0.5;
      ponerCota(cL, [-L / 2, 0.06, zc], [L / 2, 0.06, zc], [0, 1, 0], -0.05, 0.2);
      kit.cambiarEtiqueta(lL, `largo 2w = ${kit.num(L, 2)} m`); lL.position.set(0, 0.42, zc + 0.08);
      ponerCota(cW, [xc, 0.06, -w / 2], [xc, 0.06, w / 2], [0, 1, 0], -0.05, 0.2);
      kit.cambiarEtiqueta(lW, `ancho w = ${kit.num(w, 2)} m`); lW.position.set(xc + 0.6, 0.5, -w / 4);
      ponerCota(cH, [X + 0.45, Y0, Z + 0.45], [X + 0.45, Y0 + H, Z + 0.45], [1, 0, 0], -0.12, 0.12);
      kit.cambiarEtiqueta(lH, `alto h = ${kit.num(H, 2)} m`); lH.position.set(X + 0.55, Y0 + H + 0.34, Z + 0.45);
      asa.position.set(X + 0.2, 0.2, Z + 0.2);
      // entorno según el tamaño
      persona.position.set(-X - 0.6, 0, Z + 0.6); persona.rotation.y = 0.35;
      carretilla.position.set(-X - 1.55, 0, -0.55); carretilla.rotation.y = Math.PI / 2 + 0.3;
      monton.position.set(-X - 1.7, 0.02, -2.3);
      pala.position.set(monton.position.x + 0.35, 0.25, monton.position.z + 0.25); pala.rotation.set(-0.35, 0.6, -0.25);
      for (const v of viejas) v.dispose();
    }

    // ---------------------------------------------------------------- gráfico del costo
    const graf = kit.grafico({
      f: (w) => M.costo(w) / 1000, x0: W0, x1: W1, y0: 500, y1: 820, width: 1.3, height: 0.78,
      xTicks: [1, 1.5, 2, 2.5, 3], yTicks: [500, 600, 700, 800], tickFmt: (v) => kit.num(v, 1), yTickFmt: (v) => String(v),
      xLabel: 'ancho w (m)', yLabel: 'costo C (miles de $)', curveColor: 0xffb347,
    });
    graf.group.position.set(0.85, 1.05, 6.8); graf.group.rotation.y = -0.42;
    g.add(graf.group);
    // el dominio es w > 0: la curva crece sin cota hacia ambos extremos
    const nota = kit.createLabel('dominio w > 0:  C → ∞ si w → 0⁺ o w → ∞', { size: 0.032, color: '#cfe0f0', weight: 500 });
    nota.position.set(graf.width - nota.userData.size[0] / 2, graf.height + 0.05, 0.003); graf.group.add(nota);
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => fijarW(graf.xFromLocal(p.x)) });

    function revelar() {
      graf.removePoint('min');
      if (s.revelar) { const o = M.optimo(); graf.addPoint('min', o.w, o.costo / 1000, { color: 0x6fe3a2, labelX: 'w = ∛5 ≈ 1,71', labelY: '526,3' }); }
      s.cambio = true;
    }
    const verArena = (v) => { s.arena = v; arena.visible = v; panel?.invalidate(); };

    // ---------------------------------------------------------------- panel
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'Sin tapa, para 10 m³ de arena. El largo de la base es el doble del ancho. Base: $30.000 por m². Costados: $20.000 por m².',
      ecuaciones: ['C(w, h) = 30.000·2w² + 20.000·6wh = 60.000w² + 120.000wh', '2w²·h = 10   ⇒   h = 5/w²', 'C(w) = 60.000w² + 600.000/w,   w > 0'],
      lecturas: [
        { etiqueta: 'ancho w', valor: () => `${kit.num(s.w, 2)} m`, color: '#ffb347' },
        { etiqueta: 'largo 2w', valor: () => `${kit.num(2 * s.w, 2)} m`, color: '#ffb347' },
        { etiqueta: 'alto h = 5/w²', valor: () => `${kit.num(M.h(s.w), 2)} m`, color: '#5cc8ff' },
        { etiqueta: 'base: 60.000w²', valor: () => kit.pesos(60000 * s.w * s.w), color: '#c9a7ff', escala: 0.72 },
        { etiqueta: 'costados: 600.000/w', valor: () => kit.pesos(600000 / s.w), color: '#c9a7ff', escala: 0.72 },
        { etiqueta: 'costo total C', valor: () => kit.pesos(M.costo(s.w)), color: '#6fe3a2', escala: 0.72 },
      ],
      deslizadores: [{ etiqueta: 'Ancho de la base w', min: W0, max: W1, paso: 0.01, get: () => s.w, set: (v) => fijarW(v), formato: (v) => `${kit.num(v, 2)} m` }],
      botones: [
        { etiqueta: 'Ir al óptimo', accion: () => fijarW(Math.round(M.optimo().w * 100) / 100) },
        { etiqueta: 'Revelar solución', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
        { etiqueta: 'Mostrar arena', tipo: 'interruptor', get: () => s.arena, set: (v) => verArena(v) },
      ],
      pie: () => (s.revelar
        ? 'C′(w) = 120.000w − 600.000/w² = 0 ⇒ w³ = 5 ⇒ w = ∛5 ≈ 1,71 m. C″(w) = 120.000 + 1.200.000/w³ > 0, así que es el mínimo absoluto para w > 0. Ancho 1,71 m, largo 3,42 m, alto 1,71 m; costo mínimo ≈ $526.323.'
        : 'El volumen queda fijo en 10 m³: al cambiar el ancho, el alto se ajusta solo. Una base chica exige costados altos y una base grande encarece el fondo. Arrastra la esfera naranja, el gráfico o el deslizador.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-1.35, 1.38, 6.8); panel.mesh.rotation.y = 0.5;
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    return {
      paneles: [panel],
      radioSombra: 13,
      alturaCartel: 9.4,
      vista: { escritorio: { camara: [0, 3.8, 10.0], objetivo: [0, 1.3, 0.6] }, vr: { pos: [0, 0, 8.2], yaw: 0 } },
      dom: [
        { tipo: 'rango', etiqueta: 'w', min: W0, max: W1, paso: 0.01, get: () => s.w, set: (v) => fijarW(v), formato: (v) => `${kit.num(v, 2)} m` },
        { tipo: 'boton', etiqueta: 'Ir al óptimo', accion: () => fijarW(Math.round(M.optimo().w * 100) / 100) },
        { tipo: 'interruptor', etiqueta: 'Revelar solución', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
        { tipo: 'interruptor', etiqueta: 'Mostrar arena', get: () => s.arena, set: (v) => verArena(v) },
      ],
      actualizar() {
        if (s.cambio) {
          s.cambio = false; construir();
          graf.setMarker(s.w);
          graf.setTangent(s.w, M.derivada(s.w) / 1000, { color: 0xffd08a, len: 0.32 });
          panel.invalidate();
        }
      },
    };
  },
};
