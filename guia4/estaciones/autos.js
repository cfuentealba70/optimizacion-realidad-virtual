// Ejercicio 2.5. Un auto va al este a 90 km/h y otro al sur a 60 km/h, ambos hacia el cruce de dos carreteras.
import { AUTOS as M } from '../../src/math/guia4.js';

// Convención local: cruce en el origen, camino este-oeste sobre el eje x (el auto A avanza hacia +x)
// y camino norte-sur sobre el eje z (el auto B viene del norte, z negativo, y avanza hacia +z).
const YR = 0.18;          // altura de la calzada
const HW = 5;             // media calzada: pista de 3,5 m y berma de 1,5 m
const RF = 6;             // radio de las esquinas del cruce
const CARRIL = 1.75;      // eje de cada pista
const A0 = -297, B0 = -257, FIN = 36; // extremos de los caminos dentro de los corredores
const T1 = M.x0 / -M.vx;  // el auto A llega al cruce en t = 0,2/90 h
const T0 = -0.001;        // 3,6 s antes del instante del problema: A a 290 m y B a 210 m
const RRUEDA = 0.33;

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
    const suelo = (x, z) => kit.sueloH(g.position.x + x, g.position.z + z);

    // ------------------------------------------------------------ utilidades
    const tmpD = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
    function matTramo(a, b, ancho, alto = ancho) {
      tmpD.subVectors(b, a);
      const len = Math.max(1e-4, tmpD.length());
      tmpQ.setFromUnitVectors(Y, tmpD.normalize());
      return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), tmpQ.clone(), new THREE.Vector3(ancho, len, alto));
    }
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    function instancias(geo, mat, mats, padre = g, { sombra = true, recibe = true } = {}) {
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = sombra; im.receiveShadow = recibe;
      padre.add(im);
      return im;
    }
    // cuadrilátero a-b-c-d con coordenadas de textura en metros y normal hacia arriba
    function quad(a, b, c, d, mat, padre = g) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
      const lu = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), lv = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, lu, 0, lu, lv, 0, lv], 2));
      const n = new THREE.Vector3().crossVectors(V(d[0] - a[0], d[1] - a[1], d[2] - a[2]), V(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
      geo.setIndex(n.y >= 0 ? [0, 3, 1, 1, 3, 2] : [0, 1, 3, 1, 2, 3]);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; padre.add(m);
      return m;
    }
    function lienzo(w, h, pintar) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      pintar(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return t;
    }

    // ------------------------------------------------------------ calzadas
    const asfalto = (rx, rz) => kit.mat('asphalt', { repeat: [rx, rz], color: 0xd6d6d6, normalScale: 0.8 });
    const losa = (x0, x1, z0, z1) => {
      const w = x1 - x0, d = z1 - z0;
      return kit.caja(w, 0.5, d, asfalto(w / 3.2, d / 3.2), { x: (x0 + x1) / 2, y: YR - 0.25, z: (z0 + z1) / 2, sombra: false, padre: g });
    };
    losa(A0, FIN, -HW, HW);           // camino este-oeste completo, incluida la intersección
    losa(-HW, HW, B0, -HW);           // camino norte-sur, tramo norte
    losa(-HW, HW, HW, FIN);           // tramo sur
    // esquinas redondeadas con solera de hormigón
    const solera = kit.mat('concrete', { repeat: [1, 1], color: 0xd9d5cc, normalScale: 0.6 });
    const asfEsq = asfalto(1 / 3.2, 1 / 3.2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const sh = new THREE.Shape();
      const p = (u, v) => [sx * u, -sz * v]; // (x, z) del plano → (x, −z) del contorno
      sh.moveTo(...p(HW, HW)); sh.lineTo(...p(HW + RF, HW));
      for (let k = 1; k <= 14; k++) { const a = -Math.PI / 2 - (k * Math.PI / 2) / 14; sh.lineTo(...p(HW + RF + RF * Math.cos(a), HW + RF + RF * Math.sin(a))); }
      sh.lineTo(...p(HW, HW));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false, curveSegments: 1 });
      geo.rotateX(-Math.PI / 2); geo.translate(0, YR - 0.5, 0);
      kit.malla(geo, [asfEsq, solera], { sombra: false, padre: g });
    }
    // taludes de ripio a los costados y en los extremos
    const ripio = kit.mat('gravel', { repeat: [1 / 1.3, 1 / 1.3], color: 0xa79e90, normalScale: 0.9 });
    const yb = YR - 0.6, ab = 1.8;
    const talud = (x0, x1, z, sg) => quad([x0, YR, z], [x1, YR, z], [x1, yb, z + sg * ab], [x0, yb, z + sg * ab], ripio);
    const taludZ = (z0, z1, x, sg) => quad([x, YR, z0], [x, YR, z1], [x + sg * ab, yb, z1], [x + sg * ab, yb, z0], ripio);
    talud(A0, -HW - RF, -HW, -1); talud(HW + RF, FIN, -HW, -1);
    talud(A0, -HW - RF, HW, 1); talud(HW + RF, FIN, HW, 1);
    taludZ(B0, -HW - RF, -HW, -1); taludZ(B0, -HW - RF, HW, 1);
    taludZ(HW + RF, FIN, -HW, -1); taludZ(HW + RF, FIN, HW, 1);
    taludZ(-HW, HW, A0, -1); taludZ(-HW, HW, FIN, 1);
    talud(-HW, HW, B0, -1); talud(-HW, HW, FIN, 1);

    // ------------------------------------------------------------ demarcación
    const pinturaVial = new THREE.MeshStandardMaterial({ color: 0xf3f3ee, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const planoGeo = new THREE.PlaneGeometry(1, 1); planoGeo.rotateX(-Math.PI / 2);
    const marcas = [];
    const yM = YR + 0.004;
    const tramoX = (x0, x1, z, ancho) => marcas.push(new THREE.Matrix4().compose(V((x0 + x1) / 2, yM, z), new THREE.Quaternion(), V(x1 - x0, 1, ancho)));
    const tramoZ = (z0, z1, x, ancho) => marcas.push(new THREE.Matrix4().compose(V(x, yM, (z0 + z1) / 2), new THREE.Quaternion(), V(ancho, 1, z1 - z0)));
    // eje segmentado (4 m pintados, 8 m sin pintar) y eje continuo cerca del cruce
    for (let x = A0 + 3; x < -42; x += 12) tramoX(x, x + 4, 0, 0.12);
    tramoX(-40, -HW - RF, 0, 0.12); tramoX(HW + RF, FIN - 1, 0, 0.12);
    for (let z = B0 + 3; z < -32; z += 12) tramoZ(z, z + 4, 0, 0.12);
    tramoZ(-30, -HW - 2.4, 0, 0.12); tramoZ(HW + 2.4, FIN - 1, 0, 0.12);
    // bordes de calzada
    for (const sz of [-1, 1]) { tramoX(A0 + 0.5, -HW - RF, sz * 3.45, 0.12); tramoX(HW + RF, FIN - 0.5, sz * 3.45, 0.12); }
    for (const sx of [-1, 1]) { tramoZ(B0 + 0.5, -HW - RF, sx * 3.45, 0.12); tramoZ(HW + RF, FIN - 0.5, sx * 3.45, 0.12); }
    // líneas de detención del camino secundario
    tramoZ(-HW - 2.4, -HW - 1.95, -1.75, 3.3);
    tramoZ(HW + 1.95, HW + 2.4, 1.75, 3.3);
    instancias(planoGeo, pinturaVial, marcas, g, { sombra: false });
    // leyenda PARE en el pavimento
    const texPare = lienzo(256, 512, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.fillStyle = '#f3f3ee';
      x.save(); x.scale(1, 2.6); x.font = '900 80px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('PARE', w / 2, h / 2 / 2.6); x.restore();
    });
    const leyendaMat = new THREE.MeshStandardMaterial({ map: texPare, transparent: true, alphaTest: 0.3, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    kit.malla(planoGeo, leyendaMat, { x: -1.75, y: yM, z: -HW - 6.5, ry: Math.PI, sombra: false, padre: g }).scale.set(2.4, 1, 4.6);
    kit.malla(planoGeo, leyendaMat, { x: 1.75, y: yM, z: HW + 6.5, sombra: false, padre: g }).scale.set(2.4, 1, 4.6);

    // ------------------------------------------------------------ señales
    const galv = new THREE.MeshStandardMaterial({ color: 0xbfc4c8, metalness: 0.75, roughness: 0.4 });
    const dorso = new THREE.MeshStandardMaterial({ color: 0x8c9196, metalness: 0.5, roughness: 0.55, alphaTest: 0.5 });
    const octo = (x, r, w) => { x.beginPath(); for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k * Math.PI) / 4; x.lineTo(w / 2 + r * Math.cos(a), w / 2 + r * Math.sin(a)); } x.closePath(); };
    const rombo = (x, r, w) => { x.beginPath(); x.moveTo(w / 2, w / 2 - r); x.lineTo(w / 2 + r, w / 2); x.lineTo(w / 2, w / 2 + r); x.lineTo(w / 2 - r, w / 2); x.closePath(); };
    const caras = {
      pare: lienzo(256, 256, (x, w) => { octo(x, 126, w); x.fillStyle = '#fff'; x.fill(); octo(x, 114, w); x.fillStyle = '#c4122f'; x.fill(); x.fillStyle = '#fff'; x.font = '800 74px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('PARE', w / 2, w / 2 + 3); }),
      v90: lienzo(256, 256, (x, w) => { x.beginPath(); x.arc(w / 2, w / 2, 126, 0, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 24; x.strokeStyle = '#c4122f'; x.beginPath(); x.arc(w / 2, w / 2, 110, 0, 7); x.stroke(); x.fillStyle = '#111'; x.font = '800 112px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('90', w / 2, w / 2 + 6); }),
      v60: lienzo(256, 256, (x, w) => { x.beginPath(); x.arc(w / 2, w / 2, 126, 0, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 24; x.strokeStyle = '#c4122f'; x.beginPath(); x.arc(w / 2, w / 2, 110, 0, 7); x.stroke(); x.fillStyle = '#111'; x.font = '800 112px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('60', w / 2, w / 2 + 6); }),
      cruce: lienzo(256, 256, (x, w) => { rombo(x, 126, w); x.fillStyle = '#111'; x.fill(); rombo(x, 114, w); x.fillStyle = '#f5c400'; x.fill(); x.fillStyle = '#111'; x.fillRect(w / 2 - 13, 52, 26, 152); x.fillRect(52, w / 2 - 13, 152, 26); }),
      pareAdelante: lienzo(256, 256, (x, w) => { rombo(x, 126, w); x.fillStyle = '#111'; x.fill(); rombo(x, 114, w); x.fillStyle = '#f5c400'; x.fill(); octo(x, 52, w); x.fillStyle = '#c4122f'; x.fill(); x.fillStyle = '#fff'; x.font = '800 30px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('PARE', w / 2, w / 2 + 1); }),
    };
    const siluetas = {
      octo: lienzo(64, 64, (x, w) => { octo(x, 31, w); x.fillStyle = '#fff'; x.fill(); }),
      circulo: lienzo(64, 64, (x, w) => { x.beginPath(); x.arc(w / 2, w / 2, 31, 0, 7); x.fillStyle = '#fff'; x.fill(); }),
      rombo: lienzo(64, 64, (x, w) => { rombo(x, 31, w); x.fillStyle = '#fff'; x.fill(); }),
    };
    function senal(cara, silueta, lado, x, z, ry, alto = 2.2) {
      const grupo = new THREE.Group(); grupo.position.set(x, suelo(x, z), z); grupo.rotation.y = ry; g.add(grupo);
      grupo.add(kit.barra([0, 0, -0.04], [0, alto + lado / 2, -0.04], 0.032, galv, 10));
      const geo = new THREE.PlaneGeometry(lado, lado);
      kit.malla(geo, new THREE.MeshStandardMaterial({ map: caras[cara], alphaTest: 0.5, roughness: 0.45 }), { y: alto, z: 0, padre: grupo });
      const m = dorso.clone(); m.alphaMap = siluetas[silueta];
      kit.malla(geo, m, { y: alto, z: -0.012, ry: Math.PI, padre: grupo });
      return grupo;
    }
    senal('pare', 'octo', 0.75, -6.4, -HW - 2.6, Math.PI);        // al norte del cruce, para quien baja hacia el sur
    senal('pare', 'octo', 0.75, 6.3, HW + 2.9, 0);                // al sur, para quien sube hacia el norte
    senal('v60', 'circulo', 0.6, -6.4, -70, Math.PI);
    senal('pareAdelante', 'rombo', 0.75, -6.4, -125, Math.PI);
    senal('v90', 'circulo', 0.6, -70, 6.4, -Math.PI / 2);
    senal('cruce', 'rombo', 0.75, -150, 6.4, -Math.PI / 2);

    // ------------------------------------------------------------ postes de alumbrado
    const postes = [];
    for (let x = -280; x <= -40; x += 40) postes.push([x, -7.2, 0, 1]);
    for (let z = -240; z <= -40; z += 40) postes.push([7.2, z, -1, 0]);
    postes.push([-8.5, -8.5, 0.7071, 0.7071], [-8.5, 8.5, 0.7071, -0.7071], [8.5, -8.5, -0.7071, 0.7071], [24, -7.2, 0, 1]);
    const fuste = [], brazo = [], luminaria = [], base = [];
    for (const [x, z, dx, dz] of postes) {
      const y0 = suelo(x, z);
      base.push(new THREE.Matrix4().compose(V(x, y0 + 0.2, z), new THREE.Quaternion(), V(1, 1, 1)));
      fuste.push(new THREE.Matrix4().compose(V(x, y0 + 4.9, z), new THREE.Quaternion(), V(1, 1, 1)));
      const a = V(x, y0 + 9.1, z), b = V(x + dx * 2.2, y0 + 9.5, z + dz * 2.2);
      brazo.push(matTramo(a, b, 1, 1));
      luminaria.push(new THREE.Matrix4().compose(V(x + dx * 2.45, y0 + 9.5, z + dz * 2.45), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(dx, dz), 0)), V(1, 1, 1)));
    }
    instancias(new THREE.CylinderGeometry(0.22, 0.26, 0.4, 12), kit.mat('concrete', { color: 0xc9c5bd }), base);
    instancias(new THREE.CylinderGeometry(0.06, 0.1, 9.4, 10), galv, fuste);
    instancias(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), galv, brazo);
    instancias(new THREE.BoxGeometry(0.3, 0.13, 0.72), new THREE.MeshStandardMaterial({ color: 0x9aa0a5, metalness: 0.6, roughness: 0.4 }), luminaria);

    // hitos de vialidad a los costados
    const hitos = [], fajas = [];
    const hito = (x, z) => {
      const y0 = Math.max(suelo(x, z), YR - 0.3);
      hitos.push(new THREE.Matrix4().compose(V(x, y0 + 0.5, z), new THREE.Quaternion(), V(1, 1, 1)));
      fajas.push(new THREE.Matrix4().compose(V(x, y0 + 0.86, z), new THREE.Quaternion(), V(1, 1, 1)));
    };
    for (let x = A0 + 10; x < FIN; x += 25) if (Math.abs(x) > 14) { hito(x, -5.6); hito(x, 5.6); }
    for (let z = B0 + 10; z < FIN; z += 25) if (Math.abs(z) > 14) { hito(-5.6, z); hito(5.6, z); }
    instancias(new THREE.BoxGeometry(0.11, 1.0, 0.11), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 }), hitos);
    instancias(new THREE.BoxGeometry(0.118, 0.16, 0.118), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.5, emissive: 0x4a3200, emissiveIntensity: 0.15 }), fajas);

    // cerco rural de postes de madera y alambres
    const madera = new THREE.MeshStandardMaterial({ color: 0x7e6248, roughness: 0.9 });
    const alambre = new THREE.MeshStandardMaterial({ color: 0x5b5f63, metalness: 0.6, roughness: 0.5 });
    const postesCerco = [];
    const cerco = (a, b) => { // a, b: [x, z]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 4));
      for (let k = 0; k <= n; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / n, z = a[1] + ((b[1] - a[1]) * k) / n;
        postesCerco.push(new THREE.Matrix4().compose(V(x, suelo(x, z) + 0.6, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, k * 1.3, (k % 3 - 1) * 0.03)), V(1, 1, 1)));
      }
      for (const h of [0.45, 0.8, 1.12]) g.add(kit.barra([a[0], suelo(...a) + h, a[1]], [b[0], suelo(...b) + h, b[1]], 0.006, alambre, 5));
    };
    cerco([A0 + 5, -9.5], [-18, -9.5]); cerco([A0 + 5, 9.5], [-18, 9.5]); cerco([18, -9.5], [FIN - 2, -9.5]); cerco([18, 9.5], [FIN - 2, 9.5]);
    cerco([-9.5, B0 + 5], [-9.5, -18]); cerco([9.5, B0 + 5], [9.5, -18]); cerco([-9.5, 18], [-9.5, FIN - 2]); cerco([9.5, 18], [9.5, FIN - 2]);
    instancias(new THREE.CylinderGeometry(0.055, 0.065, 1.4, 7), madera, postesCerco);

    // fin del pavimento al este y al sur: barreras de obra y conos
    const texFranjas = lienzo(256, 32, (x, w, h) => { x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, w, h); x.fillStyle = '#d42a1e'; for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 32, h); x.lineTo(i * 32 + 16, h); x.lineTo(i * 32 + 32, 0); x.lineTo(i * 32 + 16, 0); x.closePath(); x.fill(); } });
    const tablaMat = new THREE.MeshStandardMaterial({ map: texFranjas, roughness: 0.55 });
    const patasB = [], tablas = [], conos = [], bandas = [];
    const barrera = (x, z, ry) => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
      const loc = (u, y, w) => V(u, y, w).applyQuaternion(q).add(V(x, YR, z));
      for (const y of [0.78, 1.08]) tablas.push(new THREE.Matrix4().compose(loc(0, y, 0), q, V(2.5, 0.22, 0.03)));
      for (const u of [-1.1, 1.1]) for (const w of [-0.32, 0.32]) patasB.push(matTramo(loc(u, 1.2, 0), loc(u, 0, w), 0.045));
    };
    const cono = (x, z) => { conos.push(new THREE.Matrix4().compose(V(x, YR + 0.36, z), new THREE.Quaternion(), V(1, 1, 1))); bandas.push(new THREE.Matrix4().compose(V(x, YR + 0.42, z), new THREE.Quaternion(), V(1, 1, 1))); };
    for (const w of [-3.1, 0, 3.1]) { barrera(FIN - 1.2, w, Math.PI / 2); barrera(w, FIN - 1.2, 0); }
    for (const w of [-3.9, -1.3, 1.3, 3.9]) { cono(FIN - 4.5, w); cono(w, FIN - 4.5); }
    instancias(new THREE.BoxGeometry(1, 1, 1), tablaMat, tablas);
    instancias(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.4, roughness: 0.6 }), patasB);
    instancias(new THREE.ConeGeometry(0.17, 0.72, 16), new THREE.MeshStandardMaterial({ color: 0xff6a12, roughness: 0.55 }), conos);
    instancias(new THREE.CylinderGeometry(0.058, 0.089, 0.13, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 }), bandas);

    // ------------------------------------------------------------ torre de observación de andamio
    const PLAT = { x0: 7.4, x1: 12.54, z0: 7.4, z1: 12.54, y: 8.0 };
    const xs = [PLAT.x0, (PLAT.x0 + PLAT.x1) / 2, PLAT.x1], zs = [PLAT.z0, (PLAT.z0 + PLAT.z1) / 2, PLAT.z1];
    const y0T = suelo(10, 10);
    const tubos = [], abraz = [], placas = [];
    const niveles = [0.35, 2.0, 4.0, 6.0, 7.87];
    for (const x of xs) for (const z of zs) {
      const centro = x === xs[1] && z === zs[1];
      tubos.push(matTramo(V(x, y0T + 0.13, z), V(x, y0T + (centro ? PLAT.y - 0.06 : PLAT.y + 1.05), z), 1, 1));
      placas.push(new THREE.Matrix4().compose(V(x, y0T + 0.06, z), new THREE.Quaternion(), V(1, 1, 1)));
      for (const y of [...niveles, PLAT.y + 0.5, PLAT.y + 1.0]) {
        const borde = x !== xs[1] || z !== zs[1];
        if (y > PLAT.y && !borde) continue;
        abraz.push(new THREE.Matrix4().compose(V(x, y0T + y, z), new THREE.Quaternion(), V(1, 1, 1)));
      }
    }
    for (const y of niveles) {
      for (const z of zs) for (let i = 0; i < 2; i++) tubos.push(matTramo(V(xs[i], y0T + y, z), V(xs[i + 1], y0T + y, z), 1, 1));
      for (const x of xs) for (let i = 0; i < 2; i++) tubos.push(matTramo(V(x, y0T + y + 0.06, zs[i]), V(x, y0T + y + 0.06, zs[i + 1]), 1, 1));
    }
    for (const y of [PLAT.y + 0.5, PLAT.y + 1.0]) {
      for (const z of [PLAT.z0, PLAT.z1]) for (let i = 0; i < 2; i++) tubos.push(matTramo(V(xs[i], y0T + y, z), V(xs[i + 1], y0T + y, z), 1, 1));
      for (const x of [PLAT.x0, PLAT.x1]) for (let i = 0; i < 2; i++) tubos.push(matTramo(V(x, y0T + y, zs[i]), V(x, y0T + y, zs[i + 1]), 1, 1));
    }
    for (let l = 0; l < niveles.length - 1; l++) for (let i = 0; i < 2; i++) {
      const ya = y0T + niveles[l], yb2 = y0T + niveles[l + 1], inv = (i + l) % 2 === 1;
      for (const [z, o] of [[PLAT.z0, -0.05], [PLAT.z1, 0.05]]) tubos.push(matTramo(V(xs[inv ? i + 1 : i], ya, z + o), V(xs[inv ? i : i + 1], yb2, z + o), 1, 1));
      for (const [x, o] of [[PLAT.x0, -0.05], [PLAT.x1, 0.05]]) tubos.push(matTramo(V(x + o, ya, zs[inv ? i + 1 : i]), V(x + o, yb2, zs[inv ? i : i + 1]), 1, 1));
    }
    const galvT = kit.mat('metal', { repeat: [1, 2], color: 0xd6d9db, metalness: 0.45, roughness: 0.5, normalScale: 0.3 });
    instancias(new THREE.CylinderGeometry(0.0242, 0.0242, 1, 8), galvT, tubos);
    instancias(new THREE.BoxGeometry(0.085, 0.09, 0.085), new THREE.MeshStandardMaterial({ color: 0x6f757a, metalness: 0.6, roughness: 0.5 }), abraz);
    instancias(new THREE.BoxGeometry(0.16, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0x55595d, metalness: 0.5, roughness: 0.6 }), placas);
    // tablones de apoyo, plataforma de tablas y rodapiés
    const tablon = kit.mat('wood', { repeat: [3, 0.25], color: 0xb08a5e });
    for (const z of zs) kit.caja(PLAT.x1 - PLAT.x0 + 0.7, 0.05, 0.26, tablon, { x: (PLAT.x0 + PLAT.x1) / 2, y: y0T + 0.025, z, padre: g });
    const cubierta = kit.mat('ribbed', { repeat: [17, 2], color: 0xc4c8cb, metalness: 0.55, roughness: 0.5, normalScale: 0.7 });
    kit.caja(PLAT.x1 - PLAT.x0 + 0.1, 0.05, PLAT.z1 - PLAT.z0 + 0.1, cubierta, { x: (PLAT.x0 + PLAT.x1) / 2, y: y0T + PLAT.y - 0.025, z: (PLAT.z0 + PLAT.z1) / 2, padre: g });
    const rodapie = new THREE.MeshStandardMaterial({ color: 0xe3b21f, roughness: 0.6, metalness: 0.2 });
    const lx = PLAT.x1 - PLAT.x0, lz = PLAT.z1 - PLAT.z0, cx = (PLAT.x0 + PLAT.x1) / 2, cz = (PLAT.z0 + PLAT.z1) / 2;
    kit.caja(lx, 0.15, 0.025, rodapie, { x: cx, y: y0T + PLAT.y + 0.075, z: PLAT.z0 + 0.03, padre: g });
    kit.caja(lx, 0.15, 0.025, rodapie, { x: cx, y: y0T + PLAT.y + 0.075, z: PLAT.z1 - 0.03, padre: g });
    kit.caja(0.025, 0.15, lz, rodapie, { x: PLAT.x0 + 0.03, y: y0T + PLAT.y + 0.075, z: cz, padre: g });
    kit.caja(0.025, 0.15, lz, rodapie, { x: PLAT.x1 - 0.03, y: y0T + PLAT.y + 0.075, z: cz, padre: g });
    // escalera de acceso por la cara sur
    const zEsc = PLAT.z1 + 0.36, xe0 = 8.25, xe1 = 8.7;
    const peldanos = [];
    g.add(kit.barra([xe0, y0T, zEsc], [xe0, y0T + PLAT.y + 1.0, zEsc], 0.022, galv, 8), kit.barra([xe1, y0T, zEsc], [xe1, y0T + PLAT.y + 1.0, zEsc], 0.022, galv, 8));
    for (let y = 0.3; y < PLAT.y + 0.1; y += 0.3) peldanos.push(matTramo(V(xe0, y0T + y, zEsc), V(xe1, y0T + y, zEsc), 1, 1));
    for (const y of [1.5, 4.5, 7.5]) for (const x of [xe0, xe1]) peldanos.push(matTramo(V(x, y0T + y, zEsc), V(x, y0T + y, PLAT.z1), 1, 1));
    instancias(new THREE.CylinderGeometry(0.016, 0.016, 1, 6), galv, peldanos);

    // ------------------------------------------------------------ autos
    const autoGeo = (() => {
      const sh = new THREE.Shape();
      sh.moveTo(-2.17, 0.30); sh.lineTo(-2.19, 0.56); sh.lineTo(-2.14, 0.84); sh.lineTo(-1.5, 0.89); sh.lineTo(1.0, 0.87);
      sh.lineTo(1.95, 0.75); sh.lineTo(2.17, 0.64); sh.lineTo(2.19, 0.40); sh.lineTo(2.12, 0.26);
      const arco = (cxA) => { for (let k = 0; k <= 16; k++) { const a = -0.16 + ((Math.PI + 0.32) * k) / 16; sh.lineTo(cxA + 0.44 * Math.cos(a), 0.33 + 0.44 * Math.sin(a)); } };
      arco(1.38); sh.lineTo(-0.95, 0.26); arco(-1.38); sh.lineTo(-2.12, 0.26); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.66, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 4 });
      geo.translate(0, 0, -0.83);
      return geo;
    })();
    const cabinaGeo = (() => {
      const sh = new THREE.Shape();
      sh.moveTo(-1.46, 0.86); sh.lineTo(-0.82, 1.35); sh.lineTo(0.2, 1.37); sh.lineTo(0.99, 0.88); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.38, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 });
      geo.translate(0, 0, -0.69);
      return geo;
    })();
    const techoGeo = (() => {
      const sh = new THREE.Shape();
      sh.moveTo(-0.86, 1.345); sh.lineTo(0.24, 1.365); sh.lineTo(0.2, 1.42); sh.lineTo(-0.82, 1.405); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.42, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2 });
      geo.translate(0, 0, -0.71);
      return geo;
    })();
    const vidrio = new THREE.MeshStandardMaterial({ color: 0x18222c, metalness: 0.4, roughness: 0.06, envMapIntensity: 2.2 });
    const gomaN = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
    const plastico = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.65 });
    const llanta = new THREE.MeshStandardMaterial({ color: 0xc9cdd1, metalness: 0.85, roughness: 0.28 });
    const faro = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1cf, emissiveIntensity: 2.2, roughness: 0.2 });
    const piloto = new THREE.MeshStandardMaterial({ color: 0x7a0a0a, emissive: 0xff2414, emissiveIntensity: 1.4, roughness: 0.3 });
    const sombraTex = lienzo(128, 64, (x, w, h) => {
      const gr = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.save(); x.scale(1, h / w); x.fillStyle = gr; x.fillRect(0, 0, w, w); x.restore();
    });
    const sombraMat = new THREE.MeshBasicMaterial({ map: sombraTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 });

    function crearAuto(color, patente) {
      const auto = new THREE.Group();
      const pintura = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.3 });
      kit.malla(autoGeo, pintura, { padre: auto });
      kit.malla(cabinaGeo, vidrio, { padre: auto });
      kit.malla(techoGeo, pintura, { padre: auto });
      for (const sz of [-1, 1]) {
        auto.add(kit.barra([0.96, 0.9, sz * 0.7], [0.2, 1.37, sz * 0.69], 0.035, pintura, 8));
        auto.add(kit.barra([-0.3, 0.9, sz * 0.735], [-0.32, 1.37, sz * 0.715], 0.045, pintura, 8));
        auto.add(kit.barra([-1.42, 0.88, sz * 0.7], [-0.82, 1.36, sz * 0.69], 0.06, pintura, 8));
        kit.caja(0.05, 0.11, 0.36, faro, { x: 2.222, y: 0.585, z: sz * 0.6, padre: auto });
        kit.caja(0.05, 0.12, 0.32, piloto, { x: -2.225, y: 0.78, z: sz * 0.62, padre: auto });
        kit.caja(0.14, 0.09, 0.16, pintura, { x: 0.9, y: 0.99, z: sz * 0.98, padre: auto });
        kit.caja(0.9, 0.012, 0.012, plastico, { x: 0.45, y: 0.62, z: sz * 0.905, padre: auto }); // juntas de puertas
        kit.caja(0.012, 0.5, 0.012, plastico, { x: -0.3, y: 0.62, z: sz * 0.905, padre: auto });
        kit.caja(0.012, 0.5, 0.012, plastico, { x: 0.95, y: 0.62, z: sz * 0.9, padre: auto });
      }
      kit.caja(0.03, 0.14, 0.8, plastico, { x: 2.252, y: 0.5, z: 0, padre: auto });
      kit.caja(0.08, 0.13, 1.72, plastico, { x: 2.2, y: 0.28, z: 0, padre: auto });
      kit.caja(0.08, 0.13, 1.72, plastico, { x: -2.225, y: 0.3, z: 0, padre: auto });
      const placa = lienzo(256, 96, (x, w, h) => { x.fillStyle = '#f7f7f2'; x.fillRect(0, 0, w, h); x.lineWidth = 6; x.strokeStyle = '#222'; x.strokeRect(3, 3, w - 6, h - 6); x.fillStyle = '#111'; x.font = '700 15px Arial'; x.textAlign = 'center'; x.fillText('CHILE', w / 2, 20); x.font = '800 54px Arial'; x.fillText(patente, w / 2, 74); });
      const placaMat = new THREE.MeshStandardMaterial({ map: placa, roughness: 0.5 });
      kit.malla(new THREE.PlaneGeometry(0.36, 0.13), placaMat, { x: 2.265, y: 0.43, ry: Math.PI / 2, padre: auto, sombra: false });
      kit.malla(new THREE.PlaneGeometry(0.36, 0.13), placaMat, { x: -2.265, y: 0.56, ry: -Math.PI / 2, padre: auto, sombra: false });
      kit.malla(new THREE.PlaneGeometry(5.1, 2.4), sombraMat, { rx: -Math.PI / 2, y: 0.012, padre: auto, sombra: false, recibe: false });
      const ruedas = [];
      for (const wx of [-1.38, 1.38]) for (const sz of [-1, 1]) {
        const r = new THREE.Group(); r.position.set(wx, RRUEDA, sz * 0.76); auto.add(r);
        kit.malla(new THREE.CylinderGeometry(RRUEDA, RRUEDA, 0.22, 22), gomaN, { rx: Math.PI / 2, padre: r });
        kit.malla(new THREE.CylinderGeometry(0.2, 0.2, 0.226, 18), llanta, { rx: Math.PI / 2, padre: r, sombra: false });
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          kit.caja(0.045, 0.17, 0.02, plastico, { x: Math.cos(a) * 0.1, y: Math.sin(a) * 0.1, z: sz * 0.116, rz: a - Math.PI / 2, padre: r, sombra: false });
        }
        kit.malla(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 10), llanta, { rx: Math.PI / 2, padre: r, sombra: false });
        ruedas.push(r);
      }
      auto.userData.ruedas = ruedas;
      g.add(auto);
      return auto;
    }
    const autoA = crearAuto(0xb3191c, 'KX·RT·45');
    const autoB = crearAuto(0x1f4fa6, 'LP·BH·82');
    autoB.rotation.y = -Math.PI / 2; // su frente (+x local) apunta al sur (+z)

    // ------------------------------------------------------------ persona de referencia (1,75 m) al pie de la torre
    const persona = (() => {
      const p = new THREE.Group();
      const ropa = new THREE.MeshStandardMaterial({ color: 0x33475c, roughness: 0.85 });
      const chaleco = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 });
      const piel = new THREE.MeshStandardMaterial({ color: 0xc49a78, roughness: 0.7 });
      const casco = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35 });
      for (const x of [-0.1, 0.1]) kit.cilindro(0.07, 0.065, 0.84, ropa, { x, y: 0.42, padre: p, seg: 10 });
      kit.malla(new THREE.CapsuleGeometry(0.18, 0.36, 4, 14), chaleco, { y: 1.17, padre: p });
      for (const x of [-0.25, 0.25]) kit.malla(new THREE.CapsuleGeometry(0.052, 0.5, 4, 8), ropa, { x, y: 1.13, rz: x > 0 ? -0.08 : 0.08, padre: p });
      kit.cilindro(0.05, 0.05, 0.08, piel, { y: 1.53, padre: p, seg: 10 });
      kit.malla(new THREE.SphereGeometry(0.1, 18, 14), piel, { y: 1.63, padre: p });
      kit.malla(new THREE.SphereGeometry(0.118, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), casco, { y: 1.64, padre: p });
      kit.cilindro(0.14, 0.14, 0.012, casco, { y: 1.645, z: 0.02, padre: p, seg: 20 });
      return p;
    })();
    persona.position.set(13.6, suelo(13.6, 8.6), 8.6); persona.rotation.y = -2.2;
    g.add(persona);

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
    const marcaO = kit.malla(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide }), { rx: -Math.PI / 2, x: O.x, y: YR + 0.03, z: O.z, sombra: false, recibe: false, padre: capa });
    void marcaO;
    const rot = {
      x: kit.etiqueta('x', 0.5, { bg: '#ffb347', color: '#1a1206' }),
      y: kit.etiqueta('y', 0.5, { bg: '#5cc8ff', color: '#08202c' }),
      s: kit.etiqueta('s', 0.5, { bg: '#6fe3a2', color: '#0b1a12' }),
      a: kit.etiqueta('Auto A · 90 km/h al este', 0.5, { bg: '#c4302b', color: '#ffffff' }),
      b: kit.etiqueta('Auto B · 60 km/h al sur', 0.5, { bg: '#2c5fc0', color: '#ffffff' }),
      o: kit.etiqueta('cruce', 0.5),
    };
    const anclas = { x: [0, 0.5, 0], y: [0, 0.5, 0], s: [0, 1.9, 0], a: [0, 1.7, 0], b: [0, 1.7, 0], o: [O.x, YR + 0.4, O.z] };
    for (const l of Object.values(rot)) capa.add(l);

    function construir() {
      const t = reloj.t, xm = M.x(t) * 1000, ym = M.y(t) * 1000;
      const ax = O.x - xm, bz = O.z - ym;
      autoA.position.set(ax, YR, O.z);
      autoB.position.set(O.x, YR, bz);
      for (const r of autoA.userData.ruedas) r.rotation.z = -ax / RRUEDA;
      for (const r of autoB.userData.ruedas) r.rotation.z = -bz / RRUEDA;
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
      anclas.y[0] = O.x - 2.5; anclas.y[2] = (bz + O.z) / 2;
      anclas.s[0] = (ax + O.x) / 2; anclas.s[2] = (O.z + bz) / 2;
      anclas.a[0] = ax; anclas.a[2] = O.z;
      anclas.b[0] = O.x; anclas.b[2] = bz;
      rot.x.visible = xm > 4; rot.y.visible = ym > 4; rot.s.visible = M.s(t) * 1000 > 6;
    }
    // los rótulos conservan un tamaño aparente legible a cualquier distancia
    const cam = new THREE.Vector3();
    function escalarRotulos() {
      kit.camera.getWorldPosition(cam); g.worldToLocal(cam);
      for (const [k, l] of Object.entries(rot)) {
        const a = anclas[k];
        const d = Math.hypot(a[0] - cam.x, a[1] - cam.y, a[2] - cam.z);
        const alto = Math.min(7, Math.max(0.32, d * 0.026));
        l.userData.alto = alto;
        l.scale.setScalar(alto / l.userData.size[1]);
        l.position.set(a[0], a[1] + alto * 0.6, a[2]);
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
        { etiqueta: 'ds/dt', valor: () => `${kit.num(M.dsdt(reloj.t), 1)} km/h`, color: '#6fe3a2', escala: 0.7 },
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
      graf.group.position.set(pg.x - ex.x * graf.width / 2, y0T + PLAT.y + 1.05, pg.z - ex.z * graf.width / 2);
      graf.group.rotation.y = psi;
    }

    // En realidad virtual la persona queda de pie sobre la plataforma mientras esté dentro de ella.
    const tmp = new THREE.Vector3();
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

    return {
      paneles: [panel],
      radioSombra: 34,
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
        if (activa) reloj.tick(dt);
        if (s.ultimo !== reloj.cambio) {
          s.ultimo = reloj.cambio;
          construir();
          graf.setMarker(reloj.t);
          graf.setTangent(reloj.t, M.dsdt(reloj.t), { color: 0xffd08a, len: 0.4 });
          panel.invalidate();
        }
        if (activa) escalarRotulos();
      },
    };
  },
};
