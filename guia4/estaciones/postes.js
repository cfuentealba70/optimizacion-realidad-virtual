// Ejercicio 1.6. Dos postes de 12 y 28 pies, a 30 pies de distancia, sostenidos por dos cables
// que bajan desde lo alto de cada poste hasta una sola estaca clavada en el pasto.
import { POSTES as M } from '../../src/math/guia4.js';

const PIE = 0.3048; // metros por pie

// Persona de referencia de 1,75 m con casco y chaleco reflectante. Mira hacia +z.
function persona(kit, padre, { x = 0, z = 0, ry = 0, chaleco = 0xff7a1a } = {}) {
  const { THREE } = kit;
  const p = new THREE.Group();
  p.position.set(x, 0, z); p.rotation.y = ry; padre.add(p);
  const mat = (color, roughness = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const piel = mat(0xc69476, 0.7), pantalon = mat(0x2f3b4d, 0.9), camisa = mat(0x56616c), bota = mat(0x3b2c20, 0.75);
  const vest = mat(chaleco, 0.6, { emissive: chaleco, emissiveIntensity: 0.06 }), banda = mat(0xe4e7ea, 0.25, { metalness: 0.5 });
  const casco = mat(0xf4f3ee, 0.35);
  for (const l of [-1, 1]) {
    kit.malla(new THREE.CapsuleGeometry(0.066, 0.7, 4, 10), pantalon, { x: l * 0.095, y: 0.47, padre: p });
    kit.caja(0.11, 0.08, 0.27, bota, { x: l * 0.095, y: 0.04, z: 0.035, padre: p });
    kit.malla(new THREE.CapsuleGeometry(0.048, 0.5, 4, 8), camisa, { x: l * 0.24, y: 1.19, rz: l * 0.07, padre: p });
    kit.malla(new THREE.SphereGeometry(0.045, 10, 8), piel, { x: l * 0.262, y: 0.88, padre: p });
  }
  const torso = kit.malla(new THREE.CapsuleGeometry(0.17, 0.34, 4, 14), vest, { y: 1.2, padre: p });
  torso.scale.set(1.08, 1, 0.72);
  for (const yb of [1.08, 1.27]) {
    const b = kit.malla(new THREE.CylinderGeometry(0.176, 0.176, 0.035, 18, 1, true), banda, { y: yb, padre: p, sombra: false });
    b.scale.set(1.08, 1, 0.72);
  }
  kit.malla(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), piel, { y: 1.5, padre: p });
  const cabeza = kit.malla(new THREE.SphereGeometry(0.098, 16, 12), piel, { y: 1.6, padre: p });
  cabeza.scale.set(0.92, 1.08, 1);
  kit.malla(new THREE.SphereGeometry(0.115, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), casco, { y: 1.635, padre: p });
  kit.malla(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 20), casco, { y: 1.637, z: 0.012, padre: p });
  return p;
}

export default {
  id: 'postes',
  tipo: 'optimizacion',
  etiqueta: 'Ejercicio 1.6 · Optimización',
  titulo: 'Cable mínimo entre dos postes',
  resumen: 'Dos postes, uno de 12 pies de altura y otro de 28 pies, están a 30 pies de distancia. Se sostienen con dos cables conectados a una sola estaca, desde el nivel del suelo hasta la parte superior de cada poste. ¿Dónde debe colocarse la estaca para usar la menor cantidad de cable posible?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const s = { x: 4, revelar: false, cambio: true };
    const X1 = (-M.d / 2) * PIE, X2 = (M.d / 2) * PIE, H1 = M.h1 * PIE, H2 = M.h2 * PIE;
    const xm = (x) => X1 + x * PIE; // posición de la estaca en metros
    const enM = (pies, d = 2) => `${kit.num(pies * PIE, d)} m`;
    const Y = new THREE.Vector3(0, 1, 0);
    const rnd = kit.mulberry32(1206);
    // rótulos de la escena: se dibujan antes que el panel y el gráfico para que estos los tapen
    const etq = (texto, alto, opts) => {
      const l = kit.etiqueta(texto, alto, opts);
      l.renderOrder = 3; l.material.depthWrite = true; l.material.alphaTest = 0.5; // escriben profundidad: lo lejano no los tapa
      return l;
    };

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

    // matas de pasto (hojas finas, instanciadas)
    {
      const pos = [], nor = [], r = kit.mulberry32(11);
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2, h = 0.06 + r() * 0.1, w = 0.008 + r() * 0.006, lean = 0.02 + r() * 0.05;
        const ox = (r() - 0.5) * 0.07, oz = (r() - 0.5) * 0.07, c = Math.cos(a), sn = Math.sin(a);
        pos.push(ox - sn * w, 0, oz + c * w, ox + sn * w, 0, oz - c * w, ox + c * lean, h, oz + sn * lean);
        for (let k = 0; k < 3; k++) nor.push(0, 1, 0);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      const N = 900, matas = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }), N);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
      let k = 0, intentos = 0;
      while (k < N && intentos < N * 20) {
        intentos++;
        const px = (rnd() * 2 - 1) * RX, pz = CZ + (rnd() * 2 - 1) * RZ;
        if (!dentroPasto(px, pz)) continue;
        if (Math.abs(pz) < 0.6 && (Math.abs(px - X1) < 0.6 || Math.abs(px - X2) < 0.7)) continue;
        q.setFromAxisAngle(Y, rnd() * 6.28);
        const s0 = 0.6 + rnd() * 0.6;
        sc.set(s0, s0 * (0.8 + rnd() * 0.6), s0);
        m4.compose(v.set(px, 0.012, pz), q, sc); matas.setMatrixAt(k, m4);
        col.setRGB(0.05 + rnd() * 0.05, 0.1 + rnd() * 0.07, 0.015 + rnd() * 0.02); matas.setColorAt(k, col);
        k++;
      }
      matas.count = k; matas.receiveShadow = true; g.add(matas);
    }
    // piedras sueltas
    {
      const N = 46, piedras = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true }), N);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), e = new THREE.Euler();
      let k = 0;
      while (k < N) {
        let px, pz;
        if (k < 14) { const cerca = k % 2 ? X1 : X2, a = rnd() * 6.28, r = 0.45 + rnd() * 0.5; px = cerca + Math.cos(a) * r; pz = Math.sin(a) * r; }
        else { px = (rnd() * 2 - 1) * RX; pz = CZ + (rnd() * 2 - 1) * RZ; if (!dentroPasto(px, pz, 1.05)) continue; }
        const t = 0.03 + rnd() ** 2 * 0.12;
        sc.set(t * (1 + rnd() * 0.5), t * (0.5 + rnd() * 0.3), t * (1 + rnd() * 0.4));
        e.set(rnd() * 0.4, rnd() * 6.28, rnd() * 0.4); q.setFromEuler(e);
        m4.compose(v.set(px, sc.y * 0.35, pz), q, sc); piedras.setMatrixAt(k, m4);
        const gr = 0.32 + rnd() * 0.2; col.setRGB(gr * 1.05, gr, gr * 0.9); piedras.setColorAt(k, col);
        k++;
      }
      piedras.castShadow = true; piedras.receiveShadow = true; g.add(piedras);
    }

    // ------------------------------------------------------------ postes de madera con cruceta y aisladores
    const madera = kit.mat('wood', { repeat: [0.5, 2.5], color: 0x9c8e7a, roughness: 1, normalScale: 0.9 });
    const maderaC = kit.mat('wood', { repeat: [1, 0.3], color: 0x8a7860, roughness: 1, normalScale: 0.7 });
    const galv = new THREE.MeshStandardMaterial({ color: 0xa9b0b6, metalness: 0.85, roughness: 0.38 });
    const porcelana = new THREE.MeshStandardMaterial({ color: 0xece9e0, roughness: 0.18, metalness: 0 });
    const tierra = kit.mat('soil', { repeat: [1, 1], color: 0xc2ae94, normalScale: 0.8 });
    const aisladorGeo = new THREE.LatheGeometry([
      [0.012, 0], [0.03, 0.004], [0.052, 0.016], [0.05, 0.026], [0.026, 0.032], [0.04, 0.05], [0.058, 0.064],
      [0.055, 0.074], [0.03, 0.08], [0.034, 0.1], [0.03, 0.115], [0.016, 0.122], [0.0005, 0.124],
    ].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    const aisladores = [];

    function placaTex(texto) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 176;
      const x = c.getContext('2d');
      x.fillStyle = '#c8ccd0'; x.fillRect(0, 0, 128, 176);
      x.strokeStyle = '#4a5058'; x.lineWidth = 6; x.strokeRect(7, 7, 114, 162);
      x.fillStyle = '#1b1f24'; x.textAlign = 'center';
      x.font = kit.font(26, 700); x.fillText('POSTE', 64, 58);
      x.font = kit.font(46, 800); x.fillText(texto, 64, 116);
      x.fillStyle = '#c0392b'; x.fillRect(22, 136, 84, 12);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    function poste(xp, H, rB, rT, lado, numero) {
      // lado: hacia dónde va la cruceta (afuera de la línea); los cables salen hacia el lado contrario
      const r = (y) => rB + (rT - rB) * (y / H);
      kit.malla(new THREE.CylinderGeometry(rT, rB, H, 22), madera, { x: xp, y: H / 2, padre: g });
      kit.malla(new THREE.CylinderGeometry(rT * 1.12, rT * 1.06, 0.03, 22), galv, { x: xp, y: H + 0.015, padre: g });
      // tierra apisonada al pie
      kit.malla(new THREE.CylinderGeometry(rB + 0.05, rB + 0.45, 0.07, 24), tierra, { x: xp, y: 0.03, padre: g, sombra: false });
      // cruceta perpendicular a la línea, con perno pasante y pies de amigo
      const yC = H - 0.3, Lc = H > 5 ? 2.1 : 1.6, xc = xp + lado * (r(yC) + 0.045);
      kit.caja(0.09, 0.11, Lc, maderaC, { x: xc, y: yC, padre: g });
      kit.cilindro(0.011, 0.011, 2 * r(yC) + 0.16, galv, { x: xp + lado * 0.04, y: yC, rz: Math.PI / 2, padre: g, seg: 8 });
      for (const zz of [-1, 1]) {
        const b = kit.barra([xc, yC - 0.055, zz * Lc * 0.3], [xp + lado * r(yC - 0.62), yC - 0.62, 0], 0.011, galv, 6);
        g.add(b);
      }
      // aisladores de espiga sobre la cruceta
      const zs = H > 5 ? [-0.88, -0.42, 0.88] : [-0.66, 0.66];
      for (const zz of zs) {
        kit.cilindro(0.009, 0.009, 0.08, galv, { x: xc, y: yC + 0.055 + 0.03, z: zz, padre: g, seg: 8 });
        aisladores.push([xc, yC + 0.055 + 0.05, zz]);
      }
      // placa de numeración y abrazadera del cable
      const yP = 2.2, rP = r(yP);
      kit.malla(new THREE.PlaneGeometry(0.1, 0.138), new THREE.MeshStandardMaterial({ map: placaTex(numero), metalness: 0.5, roughness: 0.4 }), { x: xp, y: yP, z: rP + 0.004, padre: g, sombra: false });
      kit.malla(new THREE.CylinderGeometry(rT + 0.012, rT + 0.012, 0.05, 22, 1, true), galv, { x: xp, y: H - 0.06, padre: g });
      kit.caja(0.05, 0.05, 0.04, galv, { x: xp - lado * (rT + 0.02), y: H - 0.06, padre: g });
      return { tope: [xp - lado * (rT + 0.035), H - 0.06, 0], r };
    }
    const P1 = poste(X1, H1, 0.125, 0.095, -1, '1043');
    const P2 = poste(X2, H2, 0.16, 0.108, 1, '1044');
    {
      const inst = new THREE.InstancedMesh(aisladorGeo, porcelana, aisladores.length);
      const m4 = new THREE.Matrix4();
      aisladores.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); inst.setMatrixAt(i, m4); });
      inst.castShadow = true; inst.receiveShadow = true; g.add(inst);
    }
    // peldaños de acero del poste alto, alternados
    {
      const n = 14, inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, 0.2, 6), galv, n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), d = new THREE.Vector3(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < n; i++) {
        const y = 2.45 + i * 0.4, th = i % 2 ? 1.1 : -1.1;
        d.set(Math.sin(th), 0, Math.cos(th));
        q.setFromUnitVectors(Y, d);
        p.set(X2, y, 0).addScaledVector(d, P2.r(y) + 0.08);
        m4.compose(p, q, one); inst.setMatrixAt(i, m4);
      }
      inst.castShadow = true; g.add(inst);
    }

    // ------------------------------------------------------------ estaca, cables, tensores y protectores
    const acero = new THREE.MeshStandardMaterial({ color: 0x8e979e, metalness: 0.9, roughness: 0.3 });
    const oscuro = new THREE.MeshStandardMaterial({ color: 0x4b5157, metalness: 0.7, roughness: 0.5 });
    const amarillo = new THREE.MeshStandardMaterial({ color: 0xf0c419, roughness: 0.45 });
    const naranja = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.45, emissive: 0xff5a00, emissiveIntensity: 0.35 });
    const YOJO = 0.23;
    const estaca = new THREE.Group(); g.add(estaca);
    kit.cilindro(0.016, 0.019, 0.22, oscuro, { y: 0.09, padre: estaca, seg: 10 });
    kit.cilindro(0.025, 0.025, 0.05, naranja, { y: 0.17, padre: estaca, seg: 14 });
    kit.malla(new THREE.TorusGeometry(0.032, 0.008, 8, 20), acero, { y: YOJO, padre: estaca });
    kit.malla(new THREE.CylinderGeometry(0.06, 0.13, 0.03, 16), tierra, { y: 0.015, padre: estaca, sombra: false });
    // indicación de arrastre: anillo y flechas sobre el pasto
    const guiaMat = new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false });
    kit.malla(new THREE.RingGeometry(0.3, 0.37, 40), guiaMat, { rx: -Math.PI / 2, y: 0.04, padre: estaca, sombra: false, recibe: false });
    for (const l of [-1, 1]) kit.malla(new THREE.ConeGeometry(0.07, 0.16, 12), guiaMat, { x: l * 0.5, y: 0.05, rz: -l * Math.PI / 2, padre: estaca, sombra: false, recibe: false });
    const asa = kit.malla(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 16), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { y: 0.65, padre: estaca, sombra: false, recibe: false });
    kit.arrastre(asa, g, { normal: [0, 1, 0], punto: [0, 0, 0], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => fijarX((p.x - X1) / PIE) });

    function tirante() {
      const cable = kit.barra([0, 0, 0], [0, 1, 0], 0.008, acero, 6);
      const guarda = kit.barra([0, 0, 0], [0, 1, 0], 0.025, amarillo, 14);
      const tensor = new THREE.Group();
      kit.malla(new THREE.TorusGeometry(0.016, 0.005, 6, 14), acero, { y: 0.0, padre: tensor });
      kit.cilindro(0.007, 0.007, 0.09, acero, { y: 0.06, padre: tensor, seg: 8 });
      kit.cilindro(0.016, 0.016, 0.026, galv, { y: 0.105, padre: tensor, seg: 6 });
      for (const l of [-1, 1]) kit.caja(0.006, 0.15, 0.014, galv, { x: l * 0.014, y: 0.19, padre: tensor });
      kit.cilindro(0.016, 0.016, 0.026, galv, { y: 0.275, padre: tensor, seg: 6 });
      kit.cilindro(0.007, 0.007, 0.09, acero, { y: 0.32, padre: tensor, seg: 8 });
      for (const o of [cable, guarda]) o.castShadow = true;
      g.add(cable, guarda, tensor);
      return { cable, guarda, tensor };
    }
    const T1 = tirante(), T2 = tirante();
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vD = new THREE.Vector3();
    function ponerTirante(t, tope, ojo) {
      kit.moverBarra(t.cable, ojo, tope);
      vA.set(...ojo); vB.set(...tope); vD.subVectors(vB, vA).normalize();
      const a = vA.clone().addScaledVector(vD, 0.42), b = vA.clone().addScaledVector(vD, 0.42 + 1.9);
      kit.moverBarra(t.guarda, a.toArray(), b.toArray());
      t.tensor.position.copy(vA).addScaledVector(vD, 0.035);
      t.tensor.quaternion.setFromUnitVectors(Y, vD);
    }

    // ------------------------------------------------------------ triángulos rectángulos y ángulos
    function triangulo(color) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
      m.renderOrder = 3; m.position.z = -0.03; g.add(m);
      return m;
    }
    const tri1 = triangulo(0xffb347), tri2 = triangulo(0x5cc8ff);
    function ponerTri(m, a, b, c) {
      const p = m.geometry.attributes.position;
      p.setXYZ(0, ...a); p.setXYZ(1, ...b); p.setXYZ(2, ...c); p.needsUpdate = true;
      m.geometry.computeBoundingSphere();
    }
    const arcoMat = new THREE.MeshBasicMaterial({ color: 0x6fe3a2, side: THREE.DoubleSide, toneMapped: false });
    const arco1 = new THREE.Mesh(new THREE.RingGeometry(0.9, 0.96, 6), arcoMat), arco2 = new THREE.Mesh(new THREE.RingGeometry(0.9, 0.96, 6), arcoMat);
    g.add(arco1, arco2);
    const lA1 = etq('α', 0.3, { bg: '#6fe3a2', color: '#08251a' }), lA2 = etq('β', 0.3, { bg: '#6fe3a2', color: '#08251a' });
    g.add(lA1, lA2);

    // ------------------------------------------------------------ cotas
    const cotaMat = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    function cota(color, r = 0.014) {
      const m = cotaMat(color);
      const c = { b: kit.barra([0, 0, 0], [0, 1, 0], r, m, 6), t1: kit.barra([0, 0, 0], [0, 1, 0], r, m, 6), t2: kit.barra([0, 0, 0], [0, 1, 0], r, m, 6) };
      for (const o of Object.values(c)) { o.castShadow = false; g.add(o); }
      return c;
    }
    const mas = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
    function ponerCota(c, a, b, tick) {
      kit.moverBarra(c.b, a, b);
      kit.moverBarra(c.t1, mas(a, tick, -1), mas(a, tick));
      kit.moverBarra(c.t2, mas(b, tick, -1), mas(b, tick));
    }
    const ZC = 0.95, YC = 0.06;
    const cX = cota(0xffb347), cR = cota(0x5cc8ff), c30 = cota(0xe8eef4), c12 = cota(0xffd34d), c28 = cota(0xffd34d);
    ponerCota(c30, [X1, YC, ZC + 0.75], [X2, YC, ZC + 0.75], [0, 0.13, 0]);
    ponerCota(c12, [X1 - 0.62, 0, 0], [X1 - 0.62, H1, 0], [0.13, 0, 0]);
    ponerCota(c28, [X2 + 0.66, 0, 0], [X2 + 0.66, H2, 0], [0.13, 0, 0]);
    const lineaMat = new THREE.MeshBasicMaterial({ color: 0xe8eef4, transparent: true, opacity: 0.55, toneMapped: false });
    for (const [a, b] of [[[X1, 0.03, 0.2], [X1, 0.03, ZC + 0.9]], [[X2, 0.03, 0.25], [X2, 0.03, ZC + 0.9]], [[X1 - 0.12, H1, 0], [X1 - 0.75, H1, 0]], [[X2 + 0.14, H2, 0], [X2 + 0.79, H2, 0]]]) {
      const l = kit.barra(a, b, 0.006, lineaMat, 5); l.castShadow = false; g.add(l);
    }
    const extE = kit.barra([0, 0, 0], [0, 1, 0], 0.006, lineaMat, 5); extE.castShadow = false; g.add(extE);

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

    // ------------------------------------------------------------ ambiente: obrero, carrete de cable y conos
    persona(kit, g, { x: X1 - 1.7, z: 1.1, ry: 0.35 });
    {
      const carrete = new THREE.Group(); carrete.position.set(X2 + 1.9, 0, -1.6); carrete.rotation.y = 0.5; g.add(carrete);
      const mC = kit.mat('wood', { repeat: [1, 1], color: 0xb0905f, roughness: 1 });
      for (const l of [-1, 1]) kit.malla(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 28), mC, { x: l * 0.27, y: 0.55, rz: Math.PI / 2, padre: carrete });
      kit.malla(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 28), new THREE.MeshStandardMaterial({ color: 0x7e868c, metalness: 0.8, roughness: 0.45 }), { y: 0.55, rz: Math.PI / 2, padre: carrete });
      kit.malla(new THREE.CylinderGeometry(0.06, 0.06, 0.64, 10), oscuro, { y: 0.55, rz: Math.PI / 2, padre: carrete });
    }
    {
      const blanco = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.5 }), naranjaC = new THREE.MeshStandardMaterial({ color: 0xf4651c, roughness: 0.55 });
      for (const [cx, cz] of [[X1 - 1.0, 2.4], [X2 + 1.3, 1.5], [X2 + 2.3, 0.3]]) {
        const c = new THREE.Group(); c.position.set(cx, 0, cz); g.add(c);
        kit.caja(0.36, 0.03, 0.36, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }), { y: 0.015, padre: c });
        kit.cilindro(0.15, 0.03, 0.68, naranjaC, { y: 0.37, padre: c, seg: 18 });
        kit.cilindro(0.115, 0.098, 0.1, blanco, { y: 0.3, padre: c, seg: 18 });
        kit.cilindro(0.078, 0.064, 0.08, blanco, { y: 0.5, padre: c, seg: 18 });
      }
    }

    // ------------------------------------------------------------ actualización de la escena
    function fijarX(x) { s.x = Math.min(M.d, Math.max(0, Math.round(x * 10) / 10)); s.cambio = true; }

    function construir() {
      const x = s.x, xs = xm(x), ojo = [xs, YOJO, 0];
      estaca.position.x = xs;
      ponerTirante(T1, P1.tope, ojo);
      ponerTirante(T2, P2.tope, ojo);
      ponerTri(tri1, [X1, 0, 0], [X1, H1, 0], [xs, 0, 0]);
      ponerTri(tri2, [X2, 0, 0], [X2, H2, 0], [xs, 0, 0]);
      ponerCota(cX, [X1, YC, ZC], [xs, YC, ZC], [0, 0.13, 0]);
      ponerCota(cR, [xs, YC, ZC], [X2, YC, ZC], [0, 0.13, 0]);
      cX.b.visible = cX.t2.visible = x > 0.05; cR.b.visible = cR.t1.visible = x < M.d - 0.05;
      kit.moverBarra(extE, [xs, 0.03, 0.42], [xs, 0.03, ZC + 0.14]);
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
      const a1 = Math.atan2(M.h1, x), a2 = Math.atan2(M.h2, M.d - x);
      arco1.geometry.dispose(); arco1.geometry = new THREE.RingGeometry(0.9, 0.96, 32, 1, Math.PI - a1, a1);
      arco2.geometry.dispose(); arco2.geometry = new THREE.RingGeometry(0.9, 0.96, 32, 1, 0, a2);
      arco1.position.set(xs, 0.04, 0.05); arco2.position.set(xs, 0.04, 0.05);
      kit.cambiarEtiqueta(lA1, `α = ${kit.num((a1 * 180) / Math.PI, 1)}°`);
      kit.cambiarEtiqueta(lA2, `β = ${kit.num((a2 * 180) / Math.PI, 1)}°`);
      lA1.position.set(xs - 1.25 * Math.cos(a1 / 2), 0.2 + 1.25 * Math.sin(a1 / 2), 0.1);
      lA2.position.set(xs + 1.25 * Math.cos(a2 / 2), 0.2 + 1.25 * Math.sin(a2 / 2), 0.1);
      arco1.visible = arco2.visible = lA1.visible = lA2.visible = s.revelar;
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
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
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
      actualizar() {
        if (s.cambio) { s.cambio = false; construir(); graf.setMarker(s.x); panel.invalidate(); }
      },
    };
  },
};
