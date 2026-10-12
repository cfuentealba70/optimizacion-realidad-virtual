// Ejemplo 8. Una correa transportadora vierte grava a 30 pies³/min y forma un cono con diámetro igual a la altura.
import { GRAVA as M } from '../../src/math/guia4.js';

const PIE = 0.3048; // metros por pie

export default {
  id: 'grava',
  tipo: 'razon',
  etiqueta: 'Ejemplo 8 · Razón de cambio',
  titulo: 'Cono de grava',
  resumen: 'Una correa transportadora descarga grava a razón de 30 pies³/min y forma un montón en forma de cono cuyo diámetro de la base es siempre igual a su altura. ¿Con qué rapidez crece la altura del montón cuando tiene 10 pies de alto?',

  crear(kit, est) {
    const { THREE } = kit;
    // La escena se arma girada media vuelta dentro del grupo de la estación: así la persona mira
    // el montón con el sol a la espalda y la cara visible del cono queda iluminada.
    const g = new THREE.Group();
    g.rotation.y = Math.PI;
    est.grupo.add(g);
    const giro = (v) => [-v[0], v[1], -v[2]]; // coordenadas de la escena a coordenadas del grupo
    const reloj = kit.reloj({ t0: 0, t1: 12, instante: M.instante, velocidad: 0.5 });
    const s = { revelar: false, ultimo: -1 };
    const Y = new THREE.Vector3(0, 1, 0);

    // ------------------------------------------------------------ utilidades
    const tmpD = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
    function matTramo(a, b, ancho, alto = ancho) {
      tmpD.subVectors(b, a);
      const len = Math.max(1e-4, tmpD.length());
      tmpQ.setFromUnitVectors(Y, tmpD.normalize());
      return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), tmpQ.clone(), new THREE.Vector3(ancho, len, alto));
    }
    function instancias(geo, mat, mats, padre, { sombra = true, recibe = true } = {}) {
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = sombra; im.receiveShadow = recibe;
      padre.add(im);
      return im;
    }

    // ------------------------------------------------------------ materiales
    const tierra = kit.mat('gravel', { repeat: [16, 16], color: 0xc9bfae, normalScale: 0.7 });
    tierra.polygonOffset = true; tierra.polygonOffsetFactor = -3;
    const gravaCono = kit.mat('gravel', { repeat: [1, 1], color: 0xf2e8d6, normalScale: 1.35 });
    const gravaCarga = kit.mat('gravel', { repeat: [2, 2], color: 0xf2e8d6, normalScale: 1.2 });
    const pintura = kit.mat('metal', { repeat: [1, 3], color: 0xffcf4a, metalness: 0.3, roughness: 0.55, normalScale: 0.4 });
    const acero = new THREE.MeshStandardMaterial({ color: 0x8f969c, metalness: 0.75, roughness: 0.38 });
    const chapa = kit.mat('metal', { repeat: [2, 2], color: 0xd6cfc4, metalness: 0.2, roughness: 0.65, normalScale: 0.5 });
    chapa.side = THREE.DoubleSide;
    const chapaPlana = chapa.clone(); chapaPlana.flatShading = true;
    const caucho = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.92 });
    const motorMat = new THREE.MeshStandardMaterial({ color: 0x2d5c86, metalness: 0.35, roughness: 0.45 });
    const grisOscuro = new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.4, roughness: 0.6 });

    // banda de goma con tacos en V; su textura avanza con la cinta
    const gomaTex = (() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#2b2b2b'; x.fillRect(0, 0, 128, 128);
      const rnd = kit.mulberry32(5);
      for (let i = 0; i < 1600; i++) { const v = 30 + rnd() * 24; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 2); }
      x.strokeStyle = '#424242'; x.lineWidth = 7; x.lineCap = 'round';
      for (const y0 of [18, 82]) { x.beginPath(); x.moveTo(14, y0 + 24); x.lineTo(64, y0); x.lineTo(114, y0 + 24); x.stroke(); }
      x.fillStyle = 'rgba(70,70,70,0.9)'; x.fillRect(0, 0, 5, 128); x.fillRect(123, 0, 5, 128);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      t.repeat.set(1, 1 / 0.64);
      return t;
    })();
    const goma = new THREE.MeshStandardMaterial({ map: gomaTex, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });

    // ------------------------------------------------------------ cancha de acopio: ripio compactado con borde difuso
    const alfa = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 20, 64, 64, 64);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.72, '#bbb'); gr.addColorStop(1, '#000');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    tierra.alphaMap = alfa; tierra.transparent = true; tierra.depthWrite = false;
    const cancha = kit.malla(new THREE.CircleGeometry(9.5, 56), tierra, { rx: -Math.PI / 2, x: -3.0, y: 0.018, z: -3.2, sombra: false, padre: g });
    cancha.renderOrder = -2;

    // ------------------------------------------------------------ correa transportadora
    // Marco propio: X horizontal hacia la cabeza, Y arriba, Z transversal. La línea de la cinta va de (0, Y0) a (Lh, Y1).
    const GAM = 0.85; // rumbo horizontal de la correa (de la cola a la cabeza)
    const e = new THREE.Vector3(Math.cos(GAM), 0, Math.sin(GAM));
    const lat = new THREE.Vector3(-Math.sin(GAM), 0, Math.cos(GAM));
    const Y0 = 1.05, Lh = 10.4, Y1 = 4.45;
    const TH = Math.atan2(Y1 - Y0, Lh), ct = Math.cos(TH), st = Math.sin(TH), L = Math.hypot(Lh, Y1 - Y0);
    const P = (sv, n, w) => new THREE.Vector3(sv * ct - n * st, Y0 + sv * st + n * ct, w);
    const xDesc = (L + 0.07) * ct - 0.05 * st; // distancia horizontal de la cola al punto de descarga
    const cola = e.clone().multiplyScalar(-(xDesc + 0.45)); // la descarga queda 0,45 m antes del eje del cono
    const cinta = new THREE.Group();
    cinta.position.copy(cola); cinta.rotation.y = -GAM;
    g.add(cinta);
    const aEst = (p) => p.clone().applyAxisAngle(Y, -GAM).add(cola);

    // celosía: dos vigas laterales con cordones, montantes y diagonales; arriostramiento inferior
    const W = 0.42, NT = -0.13, NB = -0.85, N = 10;
    const s0 = 0.25, ds = (L - 0.5) / N;
    const cordones = [], almas = [];
    for (const w of [-W, W]) {
      cordones.push(matTramo(P(s0 - 0.05, NT, w), P(L - 0.2, NT, w), 0.07));
      cordones.push(matTramo(P(s0, NB, w), P(L - 0.25, NB, w), 0.07));
      for (let k = 0; k <= N; k++) {
        const sk = s0 + k * ds;
        almas.push(matTramo(P(sk, NT, w), P(sk, NB, w), 0.045));
        if (k < N) {
          const sk1 = sk + ds;
          almas.push(k % 2 === 0 ? matTramo(P(sk, NB, w), P(sk1, NT, w), 0.042) : matTramo(P(sk, NT, w), P(sk1, NB, w), 0.042));
        }
      }
    }
    for (let k = 0; k <= N; k++) {
      const sk = s0 + k * ds;
      almas.push(matTramo(P(sk, NB, -W), P(sk, NB, W), 0.045));
      if (k < N) almas.push(matTramo(P(sk, NB, (k % 2 ? 1 : -1) * W), P(sk + ds, NB, (k % 2 ? -1 : 1) * W), 0.035));
    }
    // soportes de la cabeza y de la cola (placas que sostienen los tambores)
    for (const w of [-W - 0.03, W + 0.03]) {
      cordones.push(matTramo(P(L - 0.45, NB + 0.1, w), P(L + 0.02, -0.26, w), 0.09, 0.02));
      cordones.push(matTramo(P(L - 0.35, NT, w), P(L + 0.02, -0.2, w), 0.12, 0.02));
      cordones.push(matTramo(P(s0 + 0.05, NB + 0.05, w), P(-0.02, -0.2, w), 0.1, 0.02));
    }
    const cajaGeo = new THREE.BoxGeometry(1, 1, 1);
    instancias(cajaGeo, pintura, cordones, cinta);
    instancias(cajaGeo, pintura, almas, cinta);

    // rodillos: polines de carga en artesa (tres por estación) y polines de retorno
    const rod = [], soportes = [];
    for (let sv = 0.6; sv < L - 0.35; sv += 1.0) {
      rod.push(matTramo(P(sv, -0.052, -0.14), P(sv, -0.052, 0.14), 1, 1));
      for (const sg of [-1, 1]) rod.push(matTramo(P(sv, -0.039, sg * 0.165), P(sv, 0.059, sg * 0.34), 1, 1));
      soportes.push(matTramo(P(sv, NT, -W - 0.04), P(sv, NT, W + 0.04), 0.06, 0.05));
      for (const sg of [-1, 1]) {
        soportes.push(matTramo(P(sv, NT, sg * 0.15), P(sv, -0.05, sg * 0.15), 0.035, 0.012));
        soportes.push(matTramo(P(sv, NT, sg * 0.37), P(sv, 0.075, sg * 0.37), 0.035, 0.012));
      }
    }
    for (let sv = 1.4; sv < L - 0.6; sv += 2.4) {
      rod.push(matTramo(P(sv, -0.425, -0.34), P(sv, -0.425, 0.34), 1, 1));
      for (const sg of [-1, 1]) soportes.push(matTramo(P(sv, -0.425, sg * 0.385), P(sv, NT, sg * 0.385), 0.03, 0.012));
    }
    instancias(new THREE.CylinderGeometry(0.05, 0.05, 1, 14), acero, rod, cinta);
    instancias(cajaGeo, grisOscuro, soportes, cinta);

    // tambores de cabeza y de cola con sus ejes y descansos
    const tambor = (sv, n, r) => {
      cinta.add(kit.barra(P(sv, n, -0.34), P(sv, n, 0.34), r, acero, 22));
      cinta.add(kit.barra(P(sv, n, -0.55), P(sv, n, 0.55), 0.035, acero, 10));
      for (const w of [-0.5, 0.5]) kit.caja(0.16, 0.12, 0.08, grisOscuro, { padre: cinta, ...xyz(P(sv, n, w)), rz: TH });
    };
    function xyz(v) { return { x: v.x, y: v.y, z: v.z }; }
    tambor(L, -0.2, 0.2);
    tambor(0, -0.185, 0.185);

    // banda: tramo de carga en artesa y retorno que envuelve los tambores
    const geoBanda = (() => {
      const pos = [], uv = [], idx = [];
      const anillos = [0, 0.7, L - 0.7, L];
      const ws = [-0.32, -0.14, 0.14, 0.32];
      anillos.forEach((sv, i) => {
        const k = i === 0 || i === 3 ? 0 : 1;
        for (const w of ws) { const p = P(sv, Math.abs(w) > 0.2 ? 0.104 * k : 0, w); pos.push(p.x, p.y, p.z); uv.push((w + 0.32) / 0.64, sv); }
      });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const a = i * 4 + j; idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5); }
      const camino = [];
      for (let k = 0; k <= 12; k++) { const a = Math.PI / 2 - (k * Math.PI) / 12; camino.push([L + 0.2 * Math.cos(a), -0.2 + 0.2 * Math.sin(a)]); }
      for (let k = 0; k <= 12; k++) { const a = -Math.PI / 2 - (k * Math.PI) / 12; camino.push([0.185 * Math.cos(a), -0.185 + 0.185 * Math.sin(a)]); }
      const base = pos.length / 3;
      let v = L;
      camino.forEach(([sv, n], i) => {
        if (i > 0) v += Math.hypot(sv - camino[i - 1][0], n - camino[i - 1][1]);
        for (const w of [-0.32, 0.32]) { const p = P(sv, n, w); pos.push(p.x, p.y, p.z); uv.push((w + 0.32) / 0.64, v); }
      });
      for (let i = 0; i < camino.length - 1; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      return geo;
    })();
    kit.malla(geoBanda, goma, { padre: cinta });

    // grava sobre la banda: un cordón que avanza con la cinta
    const geoCarga = (() => {
      const pos = [], uv = [], idx = [];
      const anillos = [[1.25, 0.7], [L - 0.45, 1], [L + 0.03, 0.35]];
      const nw = 9;
      for (const [sv, k] of anillos) {
        for (let j = 0; j < nw; j++) {
          const w = -0.22 + (0.44 * j) / (nw - 1);
          const n = 0.03 + k * 0.075 * Math.cos((Math.PI * w) / 0.48);
          const p = P(sv, n, w); pos.push(p.x, p.y, p.z); uv.push(w + 0.5, sv);
        }
      }
      for (let i = 0; i < anillos.length - 1; i++) for (let j = 0; j < nw - 1; j++) { const a = i * nw + j; idx.push(a, a + 1, a + nw, a + 1, a + nw + 1, a + nw); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      return geo;
    })();
    const carga = kit.malla(geoCarga, gravaCarga, { padre: cinta, sombra: false });
    const texCarga = [gravaCarga.map, gravaCarga.normalMap, gravaCarga.roughnessMap].filter(Boolean);
    void carga;

    // tolva de alimentación en la cola
    const tolvaC = P(0.85, 0, 0);
    const tolva = kit.malla(new THREE.CylinderGeometry(0.86, 0.33, 0.7, 4, 1, true), chapaPlana, { x: tolvaC.x, y: tolvaC.y + 0.5, z: 0, ry: Math.PI / 4, padre: cinta });
    void tolva;
    for (const [a, b] of [[[-0.61, -0.61], [0.61, -0.61]], [[0.61, -0.61], [0.61, 0.61]], [[0.61, 0.61], [-0.61, 0.61]], [[-0.61, 0.61], [-0.61, -0.61]]]) {
      cinta.add(kit.barra([tolvaC.x + a[0], tolvaC.y + 0.86, a[1]], [tolvaC.x + b[0], tolvaC.y + 0.86, b[1]], 0.025, pintura, 6));
    }
    kit.malla(new THREE.PlaneGeometry(0.94, 0.94), gravaCarga, { rx: -Math.PI / 2, x: tolvaC.x, y: tolvaC.y + 0.62, padre: cinta, sombra: false });
    for (const [dx, dz] of [[-0.25, -0.3], [0.25, -0.3], [-0.25, 0.3], [0.25, 0.3]]) {
      cinta.add(kit.barra([tolvaC.x + dx, tolvaC.y + 0.18, dz], [tolvaC.x + dx * 1.6, P(0.85 + dx, NT, 0).y, dz * 1.4], 0.025, pintura, 6));
    }

    // campana de descarga sobre el tambor de cabeza
    // cubre arriba y atrás; queda abierta adelante y abajo para que salga el chorro
    const capo = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.86, 18, 1, true, Math.PI * 0.72, Math.PI * 0.8), chapa);
    capo.rotation.order = 'ZXY'; capo.rotation.x = Math.PI / 2;
    capo.rotation.z = TH;
    const pc = P(L - 0.02, -0.2, 0); capo.position.copy(pc); capo.castShadow = true; cinta.add(capo);

    // motorreductor en el costado visible (+Z)
    const red = P(L, -0.2, 0.68);
    kit.caja(0.36, 0.34, 0.22, grisOscuro, { x: red.x, y: red.y, z: red.z, rz: TH, padre: cinta });
    const m0 = P(L - 0.12, -0.3, 0.68), m1 = P(L - 0.62, -0.3, 0.68);
    cinta.add(kit.barra([m0.x, m0.y, m0.z], [m1.x, m1.y, m1.z], 0.14, motorMat, 20));
    const m2 = P(L - 0.75, -0.3, 0.68);
    cinta.add(kit.barra([m1.x, m1.y, m1.z], [m2.x, m2.y, m2.z], 0.125, grisOscuro, 20));
    const caja = P(L - 0.35, -0.13, 0.68);
    kit.caja(0.14, 0.08, 0.12, motorMat, { x: caja.x, y: caja.y, z: caja.z, rz: TH, padre: cinta });
    const qAleta = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(ct, st, 0));
    const aletas = [];
    for (let k = 0; k < 8; k++) { // aletas de enfriamiento
      const a = P(L - 0.18 - k * 0.055, -0.3, 0.68);
      aletas.push(new THREE.Matrix4().compose(a, qAleta, new THREE.Vector3(1, 1, 1)));
    }
    instancias(new THREE.TorusGeometry(0.145, 0.009, 4, 22), motorMat, aletas, cinta);

    // tren de rodado: eje, dos ruedas y patas en A hasta el cordón inferior
    const XE = 6.3, RR = 0.42;
    const ejeA = new THREE.Vector3(XE, RR, -0.95), ejeB = new THREE.Vector3(XE, RR, 0.95);
    cinta.add(kit.barra([XE, RR, -1.0], [XE, RR, 1.0], 0.06, grisOscuro, 12));
    const sA = XE / ct + 0.95, sB = XE / ct - 1.1;
    const patas = [];
    for (const w of [-1, 1]) {
      const pie = w < 0 ? ejeA : ejeB;
      patas.push(matTramo(pie, P(sA, NB, w * W), 0.09));
      patas.push(matTramo(pie, P(sB, NB, w * W), 0.09));
    }
    patas.push(matTramo(new THREE.Vector3(XE, RR + 0.55, -0.85), new THREE.Vector3(XE, RR + 0.55, 0.85), 0.06));
    instancias(cajaGeo, pintura, patas, cinta);
    const pernos = [];
    for (const w of [-1, 1]) {
      const z = w * 1.12;
      kit.malla(new THREE.CylinderGeometry(RR, RR, 0.28, 28), caucho, { x: XE, y: RR, z, rx: Math.PI / 2, padre: cinta });
      kit.malla(new THREE.TorusGeometry(RR - 0.05, 0.06, 8, 28), caucho, { x: XE, y: RR, z: z + w * 0.12, padre: cinta });
      kit.malla(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 24), acero, { x: XE, y: RR, z, rx: Math.PI / 2, padre: cinta });
      kit.malla(new THREE.CylinderGeometry(0.08, 0.1, 0.06, 12), grisOscuro, { x: XE, y: RR, z: z + w * 0.17, rx: Math.PI / 2, padre: cinta });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        pernos.push(new THREE.Matrix4().compose(new THREE.Vector3(XE + Math.cos(a) * 0.15, RR + Math.sin(a) * 0.15, z + w * 0.16), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)));
      }
    }
    instancias(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 6), acero, pernos, cinta);

    // apoyo de la cola: patines de perfil de acero
    for (const w of [-0.55, 0.55]) {
      kit.caja(1.7, 0.1, 0.22, grisOscuro, { x: 0.35, y: 0.05, z: w, padre: cinta });
      const a = P(0.3, NB, Math.sign(w) * W), b = P(0.95, NB, Math.sign(w) * W);
      cinta.add(kit.barra([a.x, a.y, a.z], [a.x, 0.1, w], 0.035, pintura, 8));
      cinta.add(kit.barra([b.x, b.y, b.z], [b.x, 0.1, w], 0.035, pintura, 8));
    }

    // tablero eléctrico junto a la cola y su cable hasta el motor
    kit.caja(0.5, 0.7, 0.24, new THREE.MeshStandardMaterial({ color: 0xd7d9db, metalness: 0.3, roughness: 0.5 }), { x: 1.4, y: 1.25, z: 1.35, padre: cinta });
    cinta.add(kit.barra([1.25, 0, 1.35], [1.25, 1.6, 1.35], 0.035, acero, 8));
    cinta.add(kit.barra([1.55, 0, 1.35], [1.55, 1.6, 1.35], 0.035, acero, 8));
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
    const pc1 = P(1.4 / ct, NB, W + 0.05), pc2 = P(L - 0.75, NB, W + 0.05), pm = P(L - 0.45, -0.38, 0.62);
    for (const [a, b] of [[[1.4, 0.9, 1.25], [1.4, 0.03, 1.25]], [[1.4, 0.03, 1.25], [1.4, 0.03, 0.5]], [[1.4, 0.03, 0.5], [pc1.x, pc1.y, pc1.z]], [[pc1.x, pc1.y, pc1.z], [pc2.x, pc2.y, pc2.z]], [[pc2.x, pc2.y, pc2.z], [pm.x, pm.y, pm.z]]]) {
      cinta.add(kit.barra(a, b, 0.012, cableMat, 6));
    }

    // ------------------------------------------------------------ montón de grava (cono unitario: radio 0,5 y altura 1)
    const conoGeo = (() => {
      const geo = new THREE.ConeGeometry(0.5, 1, 80, 22, true);
      geo.translate(0, 0.5, 0);
      const nr = kit.fbm(64, 5, 4, 17);
      const muestra = (u, v) => {
        const x = u * 64, y = v * 63, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        const at = (i, j) => nr[(((j % 64) + 64) % 64) * 64 + (((i % 64) + 64) % 64)];
        return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
      };
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const u = ((Math.atan2(z, x) / (2 * Math.PI)) + 1) % 1;
        const n = muestra(u, y) - 0.5;
        let k = 1 + n * 0.2 * (1 - y * 0.8);
        if (y < 0.1) k *= 1 + (0.1 - y) * 1.1; // pie del talud algo más tendido
        p.setXYZ(i, x * k, Math.max(0, y + n * 0.025 * (1 - y)), z * k);
      }
      geo.computeVertexNormals();
      return geo;
    })();
    const cono = kit.malla(conoGeo, gravaCono, { y: -0.01, padre: g });
    const texCono = [gravaCono.map, gravaCono.normalMap, gravaCono.roughnessMap].filter(Boolean);

    // derrame de grava alrededor del pie (disco con borde difuso)
    const gravaPie = kit.mat('gravel', { repeat: [3, 3], color: 0xb9af9d, normalScale: 1.1 });
    gravaPie.alphaMap = alfa; gravaPie.transparent = true; gravaPie.depthWrite = false;
    gravaPie.polygonOffset = true; gravaPie.polygonOffsetFactor = -5;
    const pie = kit.malla(new THREE.CircleGeometry(1, 48), gravaPie, { rx: -Math.PI / 2, y: 0.024, padre: g, sombra: false });
    pie.renderOrder = -1;
    const texPie = [gravaPie.map, gravaPie.normalMap, gravaPie.roughnessMap].filter(Boolean);

    // piedras sueltas: anillo al pie del cono (se mueve con r) y piedras dispersas fijas
    const piedraGeo = new THREE.IcosahedronGeometry(1, 0);
    const piedraMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const rnd = kit.mulberry32(41);
    const NA = 110;
    const anillo = new THREE.InstancedMesh(piedraGeo, piedraMat, NA);
    const datosAnillo = [];
    const col = new THREE.Color();
    for (let i = 0; i < NA; i++) {
      datosAnillo.push({ a: rnd() * Math.PI * 2, d: -0.04 + rnd() * rnd() * 0.5, t: 0.025 + rnd() * 0.035, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)) });
      const v = 0.42 + rnd() * 0.3; col.setRGB(v, v * 0.95, v * 0.86, THREE.SRGBColorSpace); anillo.setColorAt(i, col);
    }
    anillo.castShadow = true; anillo.receiveShadow = true; anillo.frustumCulled = false;
    g.add(anillo);
    const sueltas = [];
    const colS = [];
    for (let i = 0; i < 90; i++) {
      const cerca = i < 40;
      const base = cerca ? aEst(P(0.9, 0, 0)) : new THREE.Vector3(-3, 0, -3);
      const r = cerca ? 0.4 + rnd() * 1.4 : 1.5 + rnd() * 7;
      const a = rnd() * Math.PI * 2, t = 0.02 + rnd() * 0.04;
      const p = new THREE.Vector3(base.x + Math.cos(a) * r, t * 0.45, base.z + Math.sin(a) * r);
      if (Math.hypot(p.x, p.z) < 2.2) continue;
      sueltas.push(new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)), new THREE.Vector3(t, t * 0.8, t)));
      const v = 0.42 + rnd() * 0.3; colS.push(new THREE.Color().setRGB(v, v * 0.95, v * 0.87, THREE.SRGBColorSpace));
    }
    const sueltasIM = instancias(piedraGeo, piedraMat, sueltas, g);
    colS.forEach((c, i) => sueltasIM.setColorAt(i, c));

    // chorro de grava que cae desde la cabeza (partículas)
    const NP = 320;
    const chorro = new THREE.InstancedMesh(piedraGeo, piedraMat, NP);
    chorro.frustumCulled = false; chorro.castShadow = false;
    const parts = [];
    for (let i = 0; i < NP; i++) {
      parts.push({ w: (rnd() - 0.5) * 0.24, k: 0.9 + rnd() * 0.2, t: 0.014 + rnd() * 0.022, fase: rnd(), vida: 1.5 + rnd() * 0.9, rueda: rnd() < 0.45, az: rnd() * Math.PI * 2, ac: 1.4 + rnd() * 1.8, giro: rnd() * 12, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)) });
      const v = 0.42 + rnd() * 0.3; col.setRGB(v, v * 0.95, v * 0.86, THREE.SRGBColorSpace); chorro.setColorAt(i, col);
    }
    g.add(chorro);
    const D = aEst(P(L + 0.07, 0.05, 0));
    const VC = 0.85; // rapidez de la cinta en m/s
    const vh = VC * ct, vv = VC * st;

    const m4 = new THREE.Matrix4(), vp = new THREE.Vector3(), vs = new THREE.Vector3(), qr = new THREE.Quaternion(), ejeGiro = new THREE.Vector3(1, 0.3, 0.2).normalize();
    const cero = new THREE.Matrix4().makeScale(0, 0, 0);
    let tReal = 0;
    function superficie(x, z, h) { return Math.max(0, h - 2 * Math.hypot(x, z)); }
    function actualizarChorro(hm, visible) {
      const rm = hm / 2;
      for (let i = 0; i < NP; i++) {
        const q = parts[i];
        if (!visible) { chorro.setMatrixAt(i, cero); continue; }
        const a = (tReal + q.fase * q.vida) % q.vida;
        const vx = vh * q.k, vy = vv * q.k;
        const px = (u) => D.x + e.x * vx * u + lat.x * q.w, pz = (u) => D.z + e.z * vx * u + lat.z * q.w, py = (u) => D.y + vy * u - 4.905 * u * u;
        let lo = 0, hi = 1.6;
        for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (py(mid) > superficie(px(mid), pz(mid), hm)) lo = mid; else hi = mid; }
        const tl = hi;
        if (a < tl) {
          vp.set(px(a), py(a), pz(a));
        } else if (q.rueda && hm > 0.08) {
          // rueda talud abajo; la dirección mezcla el punto de caída con un rumbo propio de cada piedra
          const lx = px(tl), lz = pz(tl), d0 = Math.hypot(lx, lz);
          let ux = lx + Math.cos(q.az) * 0.25, uz = lz + Math.sin(q.az) * 0.25;
          const nu = Math.hypot(ux, uz); ux /= nu; uz /= nu;
          const tau = a - tl, d = d0 + 0.5 * q.ac * tau * tau;
          if (d > rm + 0.12) { chorro.setMatrixAt(i, cero); continue; }
          vp.set(ux * d, superficie(ux * d, uz * d, hm) + q.t * 0.7, uz * d);
        } else { chorro.setMatrixAt(i, cero); continue; }
        qr.setFromAxisAngle(ejeGiro, a * q.giro).multiply(q.q);
        vs.setScalar(q.t);
        m4.compose(vp, qr, vs);
        chorro.setMatrixAt(i, m4);
      }
      chorro.instanceMatrix.needsUpdate = true;
      actualizarVena(hm, visible);
    }

    // vena continua del chorro: un tubo delgado que sigue la trayectoria central hasta el montón
    const gravaVena = kit.mat('gravel', { repeat: [8, 1], color: 0xe6dccb, normalScale: 1.2 });
    const texVena = [gravaVena.map, gravaVena.normalMap, gravaVena.roughnessMap].filter(Boolean);
    let vena = null, hVena = -1;
    function actualizarVena(hm, visible) {
      if (!visible) { if (vena) vena.visible = false; return; }
      if (vena && Math.abs(hm - hVena) < 0.015) { vena.visible = true; return; }
      hVena = hm;
      const px = (u) => D.x + e.x * vh * u, pz = (u) => D.z + e.z * vh * u, py = (u) => D.y + vv * u - 4.905 * u * u;
      let lo = 0, hi = 1.6;
      for (let it = 0; it < 16; it++) { const mid = (lo + hi) / 2; if (py(mid) > superficie(px(mid), pz(mid), hm)) lo = mid; else hi = mid; }
      const pts = [];
      for (let k = 0; k <= 14; k++) { const u = (hi * k) / 14; pts.push(new THREE.Vector3(px(u), py(u) - (k === 14 ? 0.04 : 0), pz(u))); }
      const curva = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curva, 28, 0.038, 7, false);
      if (vena) { vena.geometry.dispose(); vena.geometry = geo; } else vena = kit.malla(geo, gravaVena, { padre: g, recibe: false });
      vena.visible = true;
      const largo = curva.getLength();
      for (const tx of texVena) tx.repeat.set(largo / 0.22, 1);
    }

    // ------------------------------------------------------------ mira topográfica graduada en pies, cotas y rótulos
    const MIRA = { x: -2.25, z: 0.55, alto: 4.3 };
    const miraTex = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 1024;
      const x = c.getContext('2d');
      x.fillStyle = '#f4f2ea'; x.fillRect(0, 0, 64, 1024);
      const py = (m) => (1 - m / MIRA.alto) * 1024;
      for (let k = 0; k * PIE < MIRA.alto; k++) {
        x.fillStyle = k % 2 ? '#b0262a' : '#1c1c1c';
        x.fillRect(2, py((k + 0.5) * PIE), 22, py(k * PIE) - py((k + 0.5) * PIE));
        for (let d = 1; d < 10; d++) { const y = py((k + d / 10) * PIE); x.fillStyle = '#222'; x.fillRect(d === 5 ? 34 : 46, y - 1.5, d === 5 ? 30 : 18, 3); }
        if (k > 0) {
          x.fillStyle = '#b0262a'; x.fillRect(26, py(k * PIE) - 2.5, 38, 5);
          x.save(); x.font = '700 30px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(k), 44, py(k * PIE) - 22); x.restore();
        }
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return t;
    })();
    const mira = new THREE.Group(); mira.position.set(MIRA.x, 0, MIRA.z); mira.rotation.y = 0.3; g.add(mira);
    const alu = new THREE.MeshStandardMaterial({ color: 0xd8dcdf, metalness: 0.6, roughness: 0.35 });
    kit.caja(0.075, MIRA.alto, 0.035, alu, { y: MIRA.alto / 2 + 0.04, padre: mira });
    kit.malla(new THREE.PlaneGeometry(0.068, MIRA.alto), new THREE.MeshStandardMaterial({ map: miraTex, roughness: 0.6 }), { y: MIRA.alto / 2 + 0.04, z: 0.0185, padre: mira, sombra: false });
    kit.caja(0.4, 0.04, 0.4, grisOscuro, { y: 0.02, padre: mira });
    for (const a of [0.6, 2.7, 4.8]) mira.add(kit.barra([0, 1.3, 0], [Math.cos(a) * 0.55, 0.02, Math.sin(a) * 0.55], 0.012, alu, 6));
    const cursor = kit.caja(0.12, 0.035, 0.07, new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff6a00, emissiveIntensity: 0.7 }), { padre: mira });

    const cotaMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    const lineaH = kit.barra([0, 0, 0], [0, 1, 0], 0.013, cotaMat); g.add(lineaH);
    const cotaD = kit.barra([0, 0, 0], [0, 1, 0], 0.012, cotaMat); g.add(cotaD);
    const ticks = [0, 1, 2, 3].map(() => { const b = kit.barra([0, 0, 0], [0, 1, 0], 0.01, cotaMat); g.add(b); return b; });
    const lh = kit.etiqueta('h', 0.2, { bg: '#5cc8ff', color: '#08202c' });
    const ld = kit.etiqueta('2r', 0.2, { bg: '#ffb347', color: '#1a1206' });
    const lq = kit.etiqueta('dV/dt = 30 pies³/min', 0.17);
    g.add(lh, ld, lq);
    lq.position.set(D.x - 0.2, D.y + 0.75, D.z + 0.25);

    // persona de referencia (1,75 m) con casco y chaleco
    const persona = (() => {
      const p = new THREE.Group();
      const ropa = new THREE.MeshStandardMaterial({ color: 0x33475c, roughness: 0.85 });
      const chaleco = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 });
      const piel = new THREE.MeshStandardMaterial({ color: 0xc49a78, roughness: 0.7 });
      const casco = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35 });
      for (const x of [-0.1, 0.1]) {
        kit.cilindro(0.07, 0.065, 0.84, ropa, { x, y: 0.42, padre: p, seg: 10 });
        kit.caja(0.12, 0.08, 0.26, new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.8 }), { x, y: 0.04, z: 0.04, padre: p });
      }
      kit.malla(new THREE.CapsuleGeometry(0.18, 0.36, 4, 14), chaleco, { y: 1.17, padre: p });
      for (const x of [-0.25, 0.25]) kit.malla(new THREE.CapsuleGeometry(0.052, 0.5, 4, 8), ropa, { x, y: 1.13, rz: x > 0 ? -0.08 : 0.08, padre: p });
      kit.cilindro(0.05, 0.05, 0.08, piel, { y: 1.53, padre: p, seg: 10 });
      kit.malla(new THREE.SphereGeometry(0.1, 18, 14), piel, { y: 1.63, padre: p });
      kit.malla(new THREE.SphereGeometry(0.118, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), casco, { y: 1.64, padre: p });
      kit.cilindro(0.14, 0.14, 0.012, casco, { y: 1.645, z: 0.02, padre: p, seg: 20 });
      return p;
    })();
    persona.position.set(-3.35, 0, -0.55); persona.rotation.y = 1.15;
    g.add(persona);

    // ------------------------------------------------------------ escena según el reloj
    function construir() {
      const t = reloj.t, h = M.h(t), hm = h * PIE, rm = hm / 2;
      cono.visible = hm > 0.01;
      cono.scale.setScalar(Math.max(0.001, hm));
      for (const tx of texCono) tx.repeat.set((Math.PI * hm) / 0.42, (1.118 * hm) / 0.42);
      const rp = rm + 0.5;
      pie.visible = hm > 0.05; pie.scale.setScalar(rp);
      for (const tx of texPie) tx.repeat.set((2 * rp) / 0.45, (2 * rp) / 0.45);
      for (let i = 0; i < NA; i++) {
        const q = datosAnillo[i];
        if (hm < 0.05) { anillo.setMatrixAt(i, cero); continue; }
        const d = rm * 1.06 + q.d * Math.min(1, rm * 1.5);
        m4.compose(vp.set(Math.cos(q.a) * d, q.t * 0.45, Math.sin(q.a) * d), q.q, vs.set(q.t, q.t * 0.8, q.t));
        anillo.setMatrixAt(i, m4);
      }
      anillo.instanceMatrix.needsUpdate = true;
      // cotas
      cursor.position.set(0, Math.max(0.06, hm), 0);
      const pm = new THREE.Vector3(0, hm, 0.02).applyAxisAngle(Y, 0.3).add(new THREE.Vector3(MIRA.x, 0, MIRA.z));
      lineaH.visible = hm > 0.05;
      kit.moverBarra(lineaH, [0, hm, 0], [pm.x + 0.05, hm, pm.z]);
      kit.cambiarEtiqueta(lh, `h = ${kit.num(h, 2)} pies · ${kit.num(hm, 2)} m`);
      lh.position.set(MIRA.x - 0.15, hm + 0.2, MIRA.z + 0.15);
      const zc = rm + 0.35;
      cotaD.visible = ld.visible = hm > 0.05;
      ticks.forEach((b) => { b.visible = hm > 0.05; });
      kit.moverBarra(cotaD, [-rm, 0.06, zc], [rm, 0.06, zc]);
      kit.moverBarra(ticks[0], [-rm, 0.0, zc], [-rm, 0.2, zc]);
      kit.moverBarra(ticks[1], [rm, 0.0, zc], [rm, 0.2, zc]);
      kit.moverBarra(ticks[2], [-rm, 0.03, 0.05], [-rm, 0.03, zc + 0.05]);
      kit.moverBarra(ticks[3], [rm, 0.03, 0.05], [rm, 0.03, zc + 0.05]);
      kit.cambiarEtiqueta(ld, `diámetro 2r = ${kit.num(2 * (h / 2), 2)} pies`);
      ld.position.set(0, 0.3, zc + 0.05);
      // chorro
      const activo = t > 0 && t < reloj.t1;
      actualizarChorro(hm, activo);
    }

    // ------------------------------------------------------------ gráfico h(t)
    const graf = kit.grafico({
      f: (t) => M.h(t), x0: 0, x1: 12, y0: 0, y1: 12, width: 1.3, height: 0.8,
      xTicks: [0, 2, 4, 6, 8, 10, 12], yTicks: [0, 2, 4, 6, 8, 10, 12], tickFmt: (v) => String(v),
      xLabel: 'tiempo t (min)', yLabel: 'altura h (pies)', curveColor: 0x5cc8ff,
    });
    graf.group.position.set(0.85, 1.05, 6.95); graf.group.rotation.y = -0.42;
    g.add(graf.group);
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => reloj.fijar(graf.xFromLocal(p.x)) });

    function revelar() {
      graf.removePoint('inst');
      if (s.revelar) graf.addPoint('inst', M.instante, 10, { color: 0x6fe3a2, labelX: `t ≈ ${kit.num(M.instante, 2)}`, labelY: 'h = 10' });
      s.ultimo = -1;
    }

    // ------------------------------------------------------------ panel
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'La correa vierte grava a 30 pies³/min y el montón forma un cono cuyo diámetro es igual a su altura. Interesa el instante en que el montón mide 10 pies de alto.',
      ecuaciones: ['V = (π/3)r²h,   r = h/2   ⇒   V = πh³/12', 'dV/dt = (π/4)h²·dh/dt,   dV/dt = 30 pies³/min'],
      lecturas: [
        { etiqueta: 'tiempo t', valor: () => `${kit.num(reloj.t, 2)} min`, color: '#9fb4c8' },
        { etiqueta: 'volumen V', valor: () => `${kit.num(M.V(reloj.t), 1)} pies³`, color: '#c9a7ff', escala: 0.72 },
        { etiqueta: 'altura h', valor: () => `${kit.num(M.h(reloj.t), 2)} pies`, color: '#5cc8ff' },
        { etiqueta: 'radio r = h/2', valor: () => `${kit.num(M.r(reloj.t), 2)} pies`, color: '#ffb347' },
        { etiqueta: 'dV/dt', valor: () => `${kit.num(M.dVdt, 0)} pies³/min`, color: '#c9a7ff', escala: 0.66 },
        { etiqueta: 'dh/dt', valor: () => `${kit.num(M.dhdt(reloj.t), 3)} pies/min`, color: '#5cc8ff', escala: 0.66 },
      ],
      deslizadores: [
        { etiqueta: 'Tiempo t', min: 0, max: 12, paso: 0.02, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 2)} min` },
        { etiqueta: 'Velocidad de la animación', min: 0.1, max: 2, paso: 0.05, color: '#ffb347', get: () => reloj.velocidad, set: (v) => { reloj.velocidad = v; }, formato: (v) => `${kit.num(v, 2)} min/s` },
      ],
      botones: [
        { etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() },
        { etiqueta: 'Ir a h = 10 pies', accion: () => reloj.alInstante() },
        { etiqueta: 'Revelar respuesta', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      pie: () => (s.revelar
        ? 'Con h = 10 pies: 30 = (π/4)·100·dh/dt, de modo que dh/dt = 120/(100π) = 6/(5π) ≈ 0,382 pies/min. El radio crece a la mitad de esa rapidez, unos 0,191 pies/min.'
        : 'El caudal es constante, pero la altura sube cada vez más lento: cada pie³ se reparte en un cono más ancho. La pendiente de la curva h(t) es dh/dt.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-1.05, 1.38, 7.2); panel.mesh.rotation.y = 0.5;
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    return {
      paneles: [panel],
      radioSombra: 13,
      alturaCartel: 6.6,
      vista: { escritorio: { camara: giro([1.9, 4.2, 12.6]), objetivo: giro([-2.2, 1.7, -2.6]) }, vr: { pos: giro([0.3, 0, 8.6]), yaw: Math.PI } },
      dom: [
        { tipo: 'boton', etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() },
        { tipo: 'rango', etiqueta: 't', min: 0, max: 12, paso: 0.02, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 2)} min` },
        { tipo: 'boton', etiqueta: 'Ir a h = 10 pies', accion: () => reloj.alInstante() },
        { tipo: 'interruptor', etiqueta: 'Revelar respuesta', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      actualizar(dt, activa) {
        if (activa) reloj.tick(dt);
        const corre = activa && reloj.corriendo && reloj.t > 0 && reloj.t < reloj.t1;
        if (corre) {
          tReal += dt;
          gomaTex.offset.y -= VC * gomaTex.repeat.y * dt;
          for (const tx of texCarga) tx.offset.y -= VC * tx.repeat.y * dt;
          for (const tx of texVena) tx.offset.x -= (2.6 / 0.22) * dt;
        }
        if (s.ultimo !== reloj.cambio) {
          s.ultimo = reloj.cambio;
          construir();
          graf.setMarker(reloj.t);
          const d = M.dhdt(reloj.t);
          graf.setTangent(reloj.t, Number.isFinite(d) && d < 25 ? d : null, { color: 0xffd08a, len: 0.4 });
          panel.invalidate();
        } else if (corre) actualizarChorro(M.h(reloj.t) * PIE, true);
      },
    };
  },
};
