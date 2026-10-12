// Ejemplo 4. Caja sin tapa hecha con un cartón cuadrado de 24 pulgadas: se cortan cuadrados de lado x
// en las esquinas y se doblan los bordes. V(x) = (24 − 2x)² x, 0 < x < 12.
import { CAJA as M } from '../../src/math/guia4.js';

const PULG = 0.0254; // metros por pulgada
const TOPE = 0.9; // altura de la cubierta del mesón
const ESP = 0.004; // espesor del cartón corrugado
const MITAD = (M.L / 2) * PULG; // media arista del cartón: 0,3048 m
const CZ = -0.07; // centro del cartón sobre el mesón (z local)
const L3 = 0.016387064; // litros por pulgada cúbica

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

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texturaDe(THREE, c, repetir = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Canto del cartón corrugado: dos caras de papel y la onda del medio
function texturaCanto(THREE) {
  const [c, g] = lienzo(128, 32);
  g.fillStyle = '#4a3219'; g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#b98b59'; g.fillRect(0, 0, 128, 6); g.fillRect(0, 26, 128, 6);
  g.strokeStyle = '#a97b49'; g.lineWidth = 3.5; g.beginPath();
  for (let x = 0; x <= 128; x++) { const y = 16 + 9.5 * Math.sin((x / 128) * Math.PI * 8); if (x) g.lineTo(x, y); else g.moveTo(x, y); }
  g.stroke();
  return texturaDe(THREE, c);
}

// Línea de doblez a lápiz (segmentada)
function texturaSegmentos(THREE) {
  const [c, g] = lienzo(64, 8);
  g.clearRect(0, 0, 64, 8); g.fillStyle = '#ffffff'; g.fillRect(0, 1, 38, 6);
  return texturaDe(THREE, c);
}

// Regla metálica: pulgadas en el borde superior y centímetros en el inferior
function texturaRegla(THREE, largo, ancho, cero) {
  const W = 2048, H = Math.round((W * ancho) / largo);
  const [c, g] = lienzo(W, H);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#dfe3e7'); gr.addColorStop(0.5, '#c4c9ce'); gr.addColorStop(1, '#d6dade');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const pxm = W / largo;
  g.fillStyle = '#16181b'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k <= 24 * 16; k++) {
    const x = (cero + (k * PULG) / 16) * pxm;
    const f = k % 16 === 0 ? 0.36 : k % 8 === 0 ? 0.26 : k % 4 === 0 ? 0.19 : k % 2 === 0 ? 0.13 : 0.08;
    g.fillRect(x - 1, 0, 2, H * f);
    if (k % 16 === 0 && k > 0) { g.font = `700 ${Math.round(H * 0.2)}px system-ui, sans-serif`; g.fillText(String(k / 16), x, H * 0.47); }
  }
  for (let mm = 0; mm <= 640; mm++) {
    const x = (cero + mm / 1000) * pxm;
    if (x > W - 3) break;
    const f = mm % 10 === 0 ? 0.24 : mm % 5 === 0 ? 0.16 : 0.09;
    g.fillRect(x - 0.8, H * (1 - f), 1.6, H * f);
    if (mm % 10 === 0 && mm > 0) { g.font = `500 ${Math.round(H * 0.14)}px system-ui, sans-serif`; g.fillText(String(mm / 10), x, H * 0.66); }
  }
  g.font = `700 ${Math.round(H * 0.13)}px system-ui, sans-serif`; g.textAlign = 'left';
  g.fillText('pulg', 6, H * 0.12 + 8); g.fillText('cm', 6, H * 0.84);
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
  return texturaDe(THREE, c);
}

// Persona de referencia de 1,75 m con casco y chaleco reflectante
function crearPersona(kit, padre, { x = 0, z = 0, ry = 0 } = {}) {
  const { THREE } = kit;
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; padre.add(p);
  const m = (color, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const piel = m(0xc08a64, 0.7), jean = m(0x33465e, 0.9), polera = m(0x56606b, 0.9), bota = m(0x3a2a1d, 0.8);
  const chaleco = m(0xd6ea3a, 0.7, { emissive: 0x262b06 }), cinta = m(0xd0d4d8, 0.35, { metalness: 0.5 }), casco = m(0xf2f0e8, 0.35);
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

export default {
  id: 'caja',
  tipo: 'optimizacion',
  etiqueta: 'Ejemplo 4 · Optimización',
  titulo: 'Caja de volumen máximo',
  resumen: 'Se desea construir una caja sin tapa a partir de un cartón cuadrado de 24 pulgadas de lado, cortando cuadrados iguales en las esquinas y doblando los bordes. Si se quiere que la caja tenga el máximo volumen posible, ¿cuáles deben ser sus dimensiones?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const s = { x: 2.5, plegado: true, lleno: false, revelar: false, prog: 1, nivel: 0, cambio: true, pose: true };
    const rnd = kit.mulberry32(41);

    // ---------------------------------------------------------------- losa y toldo de obra
    const losa = kit.malla(new THREE.PlaneGeometry(4.3, 4.1), kit.mat('concrete', { repeat: [3, 3], color: 0xcfcac1, normalScale: 0.6 }), { rx: -Math.PI / 2, y: 0.012, z: 0.25, sombra: false, padre: g });
    losa.material.polygonOffset = true; losa.material.polygonOffsetFactor = -3;

    const aluminio = new THREE.MeshStandardMaterial({ color: 0xb9bfc5, metalness: 0.8, roughness: 0.35 });
    const lona = new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.92, side: THREE.DoubleSide, flatShading: true });
    const XT = 1.72, Z0 = -1.47, Z1 = 1.97, YT = 2.12, ZC = (Z0 + Z1) / 2;
    for (const [px, pz] of [[-XT, Z0], [XT, Z0], [-XT, Z1], [XT, Z1]]) {
      kit.caja(0.04, YT, 0.04, aluminio, { x: px, y: YT / 2, z: pz, padre: g });
      kit.caja(0.12, 0.008, 0.12, aluminio, { x: px, y: 0.016, z: pz, padre: g });
      // saco de arena que afirma la pata
      const saco = kit.malla(new THREE.CapsuleGeometry(0.085, 0.26, 4, 10), kit.mat('plaster', { repeat: [1, 1], color: 0xd6cdb7 }), { x: px + (px > 0 ? -0.03 : 0.03), y: 0.06, z: pz + (pz > 0 ? -0.16 : 0.16), rz: Math.PI / 2, ry: 0.3 * Math.sign(px), padre: g });
      saco.scale.set(0.62, 1, 1.05);
    }
    // vigas del alero y tijeras
    const alero = [[[-XT, YT, Z0], [XT, YT, Z0]], [[-XT, YT, Z1], [XT, YT, Z1]], [[-XT, YT, Z0], [-XT, YT, Z1]], [[XT, YT, Z0], [XT, YT, Z1]]];
    for (const [a, b] of alero) {
      g.add(kit.barra(a, b, 0.014, aluminio));
      for (let i = 0; i < 3; i++) {
        const t0 = i / 3, t1 = (i + 1) / 3;
        const p0 = a.map((v, k) => v + (b[k] - v) * t0), p1 = a.map((v, k) => v + (b[k] - v) * t1);
        g.add(kit.barra([p0[0], YT - 0.24, p0[2]], [p1[0], YT - 0.01, p1[2]], 0.007, aluminio, 6));
        g.add(kit.barra([p0[0], YT - 0.01, p0[2]], [p1[0], YT - 0.24, p1[2]], 0.007, aluminio, 6));
      }
    }
    // techo de lona en pirámide, varillas y faldones
    const techoGeo = new THREE.ConeGeometry((XT + 0.03) * Math.SQRT2, 0.7, 4, 1, true).toNonIndexed();
    techoGeo.rotateY(Math.PI / 4); techoGeo.scale(1, 1, (Z1 - Z0 + 0.06) / (2 * XT + 0.06)); techoGeo.computeVertexNormals();
    kit.malla(techoGeo, lona, { y: YT + 0.35, z: ZC, padre: g });
    for (const [px, pz] of [[-XT, Z0], [XT, Z0], [-XT, Z1], [XT, Z1]]) g.add(kit.barra([px, YT, pz], [0, YT + 0.66, ZC], 0.009, aluminio, 6));
    for (const [w, x, z, ry] of [[2 * XT + 0.06, 0, Z0 - 0.03, 0], [2 * XT + 0.06, 0, Z1 + 0.03, 0], [Z1 - Z0 + 0.06, -XT - 0.03, ZC, Math.PI / 2], [Z1 - Z0 + 0.06, XT + 0.03, ZC, Math.PI / 2]]) {
      kit.malla(new THREE.PlaneGeometry(w, 0.2), lona, { x, y: YT - 0.09, z, ry, padre: g });
    }

    // ---------------------------------------------------------------- mesón de trabajo
    const madera = kit.mat('wood', { repeat: [1, 1], color: 0xffffff, normalScale: 0.3, seed: 12 });
    const maderaB = kit.mat('wood', { repeat: [1, 1], color: 0xc9b08c, normalScale: 0.3, seed: 12 });
    madera.map.dispose(); maderaB.map.dispose();
    madera.map = texturaPino(kit, 12); maderaB.map = madera.map;
    for (const m of [madera, maderaB]) { m.roughnessMap = null; m.roughness = 0.88; }
    const MZ = -0.025; // centro del mesón en z (borde delantero en z = 0,45)
    kit.malla(cajaUV(THREE, 2.2, 0.05, 0.95, { s: 0.9, su: 0.9, sv: 0.9, girar: true }), madera, { y: TOPE - 0.025, z: MZ, padre: g });
    const PX = 1.0, PZ = 0.39;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.malla(cajaUV(THREE, 0.085, TOPE - 0.05, 0.085, { s: 0.9 }), maderaB, { x: sx * PX, y: (TOPE - 0.05) / 2, z: MZ + sz * PZ, padre: g });
    for (const sz of [-1, 1]) {
      kit.malla(cajaUV(THREE, 2.09, 0.11, 0.025, { s: 0.9 }), maderaB, { y: TOPE - 0.105, z: MZ + sz * (PZ + 0.03), padre: g });
      kit.malla(cajaUV(THREE, 2.0, 0.06, 0.04, { s: 0.9 }), maderaB, { y: 0.11, z: MZ + sz * (PZ - 0.06), padre: g });
    }
    for (const sx of [-1, 1]) {
      kit.malla(cajaUV(THREE, 0.025, 0.11, 0.87, { s: 0.9 }), maderaB, { x: sx * (PX + 0.03), y: TOPE - 0.105, z: MZ, padre: g });
      kit.malla(cajaUV(THREE, 0.04, 0.06, 0.7, { s: 0.9 }), maderaB, { x: sx * (PX - 0.06), y: 0.11, z: MZ, padre: g });
    }
    kit.malla(cajaUV(THREE, 1.9, 0.022, 0.72, { s: 0.9, girar: true }), madera, { y: 0.151, z: MZ, padre: g });
    // pernos de las uniones
    const pernos = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 12), new THREE.MeshStandardMaterial({ color: 0x55595d, metalness: 0.85, roughness: 0.45 }), 16);
    {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), uno = new THREE.Vector3(1, 1, 1);
      let k = 0;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const yy of [TOPE - 0.08, TOPE - 0.13]) {
        m4.compose(new THREE.Vector3(sx * PX, yy, MZ + sz * (PZ + 0.043)), q, uno); pernos.setMatrixAt(k++, m4);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const yy of [TOPE - 0.08, TOPE - 0.13]) {
        m4.compose(new THREE.Vector3(sx * (PX + 0.043), yy, MZ + sz * PZ), q2, uno); pernos.setMatrixAt(k++, m4);
      }
    }
    pernos.castShadow = true; g.add(pernos);
    // prensa de banco en el extremo izquierdo
    const acero = new THREE.MeshStandardMaterial({ color: 0x8d949b, metalness: 0.85, roughness: 0.35 });
    kit.malla(cajaUV(THREE, 0.2, 0.11, 0.03, { s: 0.9 }), madera, { x: -0.72, y: TOPE - 0.07, z: 0.5, padre: g });
    g.add(kit.barra([-0.77, TOPE - 0.075, 0.45], [-0.77, TOPE - 0.075, 0.58], 0.008, acero), kit.barra([-0.67, TOPE - 0.075, 0.45], [-0.67, TOPE - 0.075, 0.58], 0.008, acero));
    g.add(kit.barra([-0.72, TOPE - 0.07, 0.45], [-0.72, TOPE - 0.07, 0.6], 0.011, acero), kit.barra([-0.8, TOPE - 0.07, 0.6], [-0.64, TOPE - 0.07, 0.6], 0.007, acero));

    // ---------------------------------------------------------------- materiales del cartón
    const carton = kit.mat('cardboard', { repeat: [1, 1], color: 0xffdcb0, normalScale: 0.45 });
    const cartonB = kit.mat('cardboard', { repeat: [1, 1], color: 0xf0d2ad, normalScale: 0.35 });
    const canto = new THREE.MeshStandardMaterial({ map: texturaCanto(THREE), roughness: 0.95 });
    const matsCarton = [canto, canto, carton, cartonB, canto, canto];
    const geoCarton = (w, d) => cajaUV(THREE, w, ESP, d, { s: 0.2, su: 0.032, sv: ESP });

    // pila de cartones nuevos en la repisa inferior
    for (let i = 0; i < 5; i++) kit.malla(geoCarton(0.6096, 0.6096), matsCarton, { x: 0.25 + (rnd() - 0.5) * 0.03, y: 0.162 + ESP * (i + 0.5), z: MZ + (rnd() - 0.5) * 0.03, ry: (rnd() - 0.5) * 0.08, padre: g });

    // ---------------------------------------------------------------- el cartón que se pliega
    const hoja = new THREE.Group(); hoja.position.z = CZ; g.add(hoja);
    const base = kit.malla(new THREE.BufferGeometry(), matsCarton, { y: TOPE + ESP / 2, padre: hoja });
    const lineaMat = new THREE.MeshBasicMaterial({ map: texturaSegmentos(THREE), color: 0x3b3631, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const solapas = [0, 1, 2, 3].map((k) => {
      const giro = new THREE.Group(); giro.rotation.y = (k * Math.PI) / 2; hoja.add(giro);
      const bisagra = new THREE.Group(); giro.add(bisagra);
      const m = kit.malla(new THREE.BufferGeometry(), matsCarton, { padre: bisagra });
      const linea = kit.malla(new THREE.BufferGeometry(), lineaMat, { rx: -Math.PI / 2, sombra: false, recibe: false, padre: giro });
      return { giro, bisagra, m, linea };
    });
    const arenaMat = kit.mat('sand', { repeat: [1, 1], color: 0xffd9a2, normalScale: 0.9 });
    const arena = kit.malla(new THREE.BufferGeometry(), arenaMat, { padre: hoja });
    arena.visible = false;

    // los cuatro cuadrados recortados, apartados sobre el mesón
    const recortes = [0, 1, 2, 3].map(() => kit.malla(new THREE.BufferGeometry(), matsCarton, { padre: g }));

    // regla metálica de 24 pulgadas alineada con el borde del cartón
    const RL = 0.66, RA = 0.032, R0 = 0.014;
    const regla = new THREE.Group(); regla.position.set(-MITAD - R0 + RL / 2, TOPE, CZ + MITAD + 0.072); regla.rotation.y = 0.004; g.add(regla);
    kit.caja(RL, 0.0012, RA, new THREE.MeshStandardMaterial({ color: 0xc3c8cd, metalness: 0.7, roughness: 0.3 }), { y: 0.0006, padre: regla });
    kit.malla(new THREE.PlaneGeometry(RL, RA), new THREE.MeshStandardMaterial({ map: texturaRegla(THREE, RL, RA, R0), metalness: 0.35, roughness: 0.38, polygonOffset: true, polygonOffsetFactor: -2 }), { rx: -Math.PI / 2, y: 0.00125, sombra: false, padre: regla });

    // cúter
    const cuter = new THREE.Group(); cuter.position.set(0.17, TOPE, 0.385); cuter.rotation.y = 0.25; g.add(cuter);
    const amarillo = new THREE.MeshStandardMaterial({ color: 0xf0bd12, roughness: 0.45 }), negro = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.7 });
    kit.caja(0.135, 0.011, 0.022, amarillo, { y: 0.0055, padre: cuter });
    kit.caja(0.075, 0.0116, 0.016, negro, { x: -0.025, y: 0.0058, padre: cuter });
    kit.caja(0.018, 0.005, 0.006, negro, { x: 0.02, y: 0.0055, z: 0.013, padre: cuter });
    kit.caja(0.022, 0.0008, 0.011, new THREE.MeshStandardMaterial({ color: 0xcfd3d6, metalness: 0.55, roughness: 0.3 }), { x: 0.078, y: 0.0055, z: -0.002, padre: cuter });
    // lápiz de carpintero
    const lapiz = new THREE.Group(); lapiz.position.set(-0.42, TOPE + 0.0032, 0.16); lapiz.rotation.y = -0.35; g.add(lapiz);
    kit.malla(new THREE.CylinderGeometry(0.0037, 0.0037, 0.15, 6), new THREE.MeshStandardMaterial({ color: 0xd94a2b, roughness: 0.5 }), { rz: Math.PI / 2, padre: lapiz });
    kit.malla(new THREE.ConeGeometry(0.0037, 0.02, 6), new THREE.MeshStandardMaterial({ color: 0xdab68c, roughness: 0.8 }), { x: 0.085, rz: -Math.PI / 2, padre: lapiz });
    kit.malla(new THREE.ConeGeometry(0.0013, 0.006, 6), negro, { x: 0.0955, rz: -Math.PI / 2, padre: lapiz });

    // balde con arena en el piso y una pala de mano
    const balde = new THREE.Group(); balde.position.set(1.32, 0, 0.15); g.add(balde);
    const goma = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.75, side: THREE.DoubleSide });
    kit.malla(new THREE.CylinderGeometry(0.15, 0.125, 0.3, 24, 1, true), goma, { y: 0.15, padre: balde });
    kit.malla(new THREE.CircleGeometry(0.125, 24), goma, { rx: -Math.PI / 2, y: 0.005, padre: balde });
    kit.malla(new THREE.TorusGeometry(0.15, 0.008, 6, 28), goma, { rx: Math.PI / 2, y: 0.3, padre: balde });
    const colmo = kit.malla(new THREE.SphereGeometry(0.145, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2), kit.mat('sand', { repeat: [0.6, 0.6], color: 0xffd9a2 }), { y: 0.25, padre: balde });
    colmo.scale.y = 0.3;
    const pala = new THREE.Group(); pala.position.set(0.02, 0.29, 0.03); pala.rotation.set(0.5, 0.4, 0); balde.add(pala);
    kit.malla(new THREE.CylinderGeometry(0.08, 0.08, 0.13, 10, 1, true, -0.9, 1.8), new THREE.MeshStandardMaterial({ color: 0x9aa1a7, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide }), { rx: Math.PI / 2, z: 0.0, y: -0.02, padre: pala });
    kit.cilindro(0.014, 0.014, 0.12, new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.7 }), { y: 0.03, z: -0.12, rx: Math.PI / 2, padre: pala, seg: 10 });

    // maleza en los bordes de la losa: matas de hojas delgadas
    {
      const hojas = [];
      for (let i = 0; i < 7; i++) {
        const h = 0.14 + rnd() * 0.16, c = new THREE.ConeGeometry(0.009, h, 3, 1, true);
        c.translate(0, h / 2, 0); c.rotateZ(0.25 + rnd() * 0.35); c.rotateY((i / 7) * Math.PI * 2 + rnd() * 0.5);
        hojas.push(c);
      }
      const n = 46, mata = new THREE.InstancedMesh(kit.mergeGeometries(hojas), new THREE.MeshStandardMaterial({ color: 0x75873f, roughness: 0.95, side: THREE.DoubleSide }), n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < n; i++) {
        const lado = Math.floor(rnd() * 4), t = rnd() - 0.5;
        const x = lado < 2 ? t * 4.3 : (lado === 2 ? -2.2 : 2.2) + (rnd() - 0.5) * 0.15;
        const z = lado < 2 ? (lado === 0 ? -1.82 : 2.32) + (rnd() - 0.5) * 0.15 : 0.25 + t * 4.1;
        const sc = 0.5 + rnd() * 0.8;
        e.set((rnd() - 0.5) * 0.25, rnd() * 6, (rnd() - 0.5) * 0.25); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(sc, sc, sc)); mata.setMatrixAt(i, m4);
      }
      mata.castShadow = true; g.add(mata);
    }

    // persona de referencia al otro lado del mesón
    crearPersona(kit, g, { x: -0.5, z: -0.98, ry: 0.12 });

    // ---------------------------------------------------------------- cotas y rótulos
    const cotaMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    function cota(radio = 0.0016) {
      const c = { l: kit.barra([0, 0, 0], [0, 1, 0], radio, cotaMat, 6), a: kit.barra([0, 0, 0], [0, 1, 0], radio, cotaMat, 6), b: kit.barra([0, 0, 0], [0, 1, 0], radio, cotaMat, 6) };
      for (const k of ['l', 'a', 'b']) { c[k].castShadow = false; g.add(c[k]); }
      return c;
    }
    function ponerCota(c, A, B, d, o1, o2) {
      kit.moverBarra(c.l, A, B);
      kit.moverBarra(c.a, A.map((v, i) => v + d[i] * o1), A.map((v, i) => v + d[i] * o2));
      kit.moverBarra(c.b, B.map((v, i) => v + d[i] * o1), B.map((v, i) => v + d[i] * o2));
    }
    const cotaB = cota(), cotaX = cota();
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
      base.geometry = nueva(geoCarton(b, b));
      const gSolapa = nueva(geoCarton(b, xm)), gLinea = nueva(new THREE.PlaneGeometry(Math.max(0.001, b - 0.006), 0.0022));
      lineaMat.map.repeat.set(Math.max(1, (b - 0.006) / 0.012), 1);
      for (const f of solapas) {
        f.bisagra.position.set(0, TOPE + ESP, b / 2);
        f.m.geometry = gSolapa; f.m.position.set(0, -ESP / 2, xm / 2);
        f.linea.geometry = gLinea; f.linea.position.set(0, TOPE + ESP + 0.0003, b / 2 - 0.0028);
      }
      arena.geometry = nueva(cajaUV(THREE, Math.max(0.0005, b - 0.0012), 1, Math.max(0.0005, b - 0.0012), { s: 0.16 }));
      const gRec = nueva(geoCarton(xm, xm));
      const cx = 0.36 + xm * 0.62, cz = -0.27;
      recortes.forEach((r, i) => {
        r.geometry = gRec;
        r.position.set(cx + i * 0.014, TOPE + ESP * (i + 0.5), cz + i * 0.022 - 0.02);
        r.rotation.y = -0.22 + i * 0.15;
      });
      kit.cambiarEtiqueta(lB, `24 − 2x = ${kit.num(M.base(s.x), 1)} pulg`);
      kit.cambiarEtiqueta(lV, `V = ${fmtV(M.volumen(s.x))} pulg³`);
      for (const v of viejas) v.dispose();
    }

    const suave = (p) => p * p * (3 - 2 * p);
    function posar() {
      const th = (Math.PI / 2) * suave(s.prog), xm = s.x * PULG, b = M.base(s.x) * PULG;
      const c = Math.cos(th), sn = Math.sin(th);
      for (const f of solapas) f.bisagra.rotation.x = -th;
      const lv = xm * s.nivel;
      arena.visible = s.nivel > 0.002;
      arena.scale.y = Math.max(1e-4, lv); arena.position.y = TOPE + ESP + lv / 2;
      // cota de la base, delante del cartón
      const zF = CZ + b / 2 + xm * c + ESP * sn + 0.022;
      ponerCota(cotaB, [-b / 2, TOPE + 0.0025, zF], [b / 2, TOPE + 0.0025, zF], [0, 1, 0], 0, 0.016);
      lB.position.set(0, TOPE + 0.03, zF + 0.05);
      // cota de x: borde de la solapa delantera (en el plano es el lado del cuadrado cortado; plegada es la altura)
      const xc = b / 2 + 0.014, A = [xc, TOPE + ESP + 0.0018, CZ + b / 2], B = [xc, TOPE + ESP + 0.0018 + xm * sn, CZ + b / 2 + xm * c];
      ponerCota(cotaX, A, B, [1, 0, 0], -0.008, 0.008);
      kit.cambiarEtiqueta(lX, sn > 0.7 ? `h = x = ${kit.num(s.x, 2)} pulg` : `x = ${kit.num(s.x, 2)} pulg`);
      lX.position.set(xc + 0.125, TOPE + 0.026 + (xm * sn) / 2, CZ + b / 2 + (xm * c) / 2 + 0.03);
      lV.visible = s.nivel > 0.98;
      lV.position.set(0, TOPE + ESP + xm + 0.045, CZ);
      asa.position.set(b / 2 + 0.004, TOPE + ESP + xm * sn + 0.012, CZ + b / 2 + xm * c + 0.004);
    }
    const fmtV = (v) => kit.num(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 2);

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

    return {
      paneles: [panel],
      radioSombra: 4,
      alturaCartel: 3.25,
      vista: { escritorio: { camara: [0, 1.86, 2.95], objetivo: [0, 1.02, -0.1] }, vr: { pos: [0, 0, 1.55], yaw: 0 } },
      dom: [
        { tipo: 'rango', etiqueta: 'x', min: 0.25, max: 11.75, paso: 0.25, get: x, set: (v) => fijarX(v), formato: (v) => `${kit.num(v, 2)} pulg (${kit.num(v * 2.54, 1)} cm)` },
        { tipo: 'boton', etiqueta: 'Ir al óptimo', accion: () => fijarX(M.optimo().x) },
        { tipo: 'interruptor', etiqueta: 'Revelar solución', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
        { tipo: 'boton', etiqueta: () => (s.plegado ? 'Desplegar' : 'Plegar'), accion: () => plegar(!s.plegado) },
        { tipo: 'interruptor', etiqueta: 'Llenar con arena', get: () => s.lleno, set: (v) => llenar(v) },
      ],
      actualizar(dt) {
        if (s.cambio) { s.cambio = false; construir(); graf.setMarker(s.x); panel.invalidate(); s.pose = true; }
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
      },
    };
  },
};
