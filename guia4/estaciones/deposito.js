// Ejercicio 2.4. Depósito cónico con el vértice hacia abajo (10 m de altura, 15 m de radio): sale 1 m³/s y entra c.
import { DEPOSITO as M } from '../../src/math/guia4.js';

const YV = 2.4;                       // altura del vértice sobre el suelo
const YB = YV + M.H;                  // altura del borde del cono (12,4 m)
const CORTE = (70 * Math.PI) / 180;   // medio ángulo del corte frontal que deja ver el agua
const TAU = Math.PI * 2;
const RC = 15.25;                     // radio del anillo de columnas
const ESP = 0.072;                    // espesor de la chapa medido en horizontal
const Y_VIGA = 11.57;                 // cara inferior de la viga anular
const Y_PASILLO = 12.42;              // piso del pasillo perimetral
const A_ESCALA = (3 * Math.PI) / 8;   // columna con la escalera de gato (67,5°)
const A_ENTRADA = (5 * Math.PI) / 4;  // tubería de entrada (225°, atrás a la izquierda)
const Y_BOCA = 13.0;                  // boca de la tubería de entrada
const R_BOCA = 1.2;                   // distancia de la boca al eje del cono
const hDeV = (V) => Math.cbrt((4 * V) / (3 * Math.PI)); // inversa de V = (3π/4)h³
const radioChorro = (c) => 0.8 * Math.sqrt(Math.max(0, c) / 40); // el chorro llena la boca con 40 m³/s

export default {
  id: 'deposito',
  tipo: 'razon',
  etiqueta: 'Ejercicio 2.4 · Razón de cambio',
  titulo: 'Depósito cónico',
  resumen: 'Un depósito tiene forma de cono circular recto con el vértice hacia abajo, 10 m de altura y 15 m de radio. Sale agua por el vértice a 1 m³/s y entra agua a razón constante de c m³/s. ¿Cuál es el valor de c para que el nivel del agua suba a 4 m/s en el instante en que el agua tiene 1 m de profundidad?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const rnd = kit.mulberry32(2404);
    // El depósito se corre hacia la plaza para quedar dentro del cerco de la obra y se gira para que la persona
    // lo mire de frente sin quedar junto al estanque vecino.
    const esc = new THREE.Group(); esc.position.set(2.9, 0, 7.5); esc.rotation.y = 0.3; g.add(esc);
    esc.updateMatrixWorld(true);
    const aGrupo = (v) => { const p = new THREE.Vector3(...v).applyEuler(esc.rotation).add(esc.position); return [p.x, p.y, p.z]; };
    const pol = (a, r, y = 0) => [Math.sin(a) * r, y, Math.cos(a) * r];

    const s = { c: 12, h: 3, vel: 4, simular: false, revelar: false, cambio: 1, ultimo: 0, cambioC: 1, ultimoC: 0, refresco: 0, refrescoC: 0 };

    // ------------------------------------------------------------ materiales
    // planchas soldadas del manto: 18 planchas por sector y 6 virolas a lo largo de la generatriz
    const planchas = (() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 512;
      const x = c.getContext('2d'); x.fillStyle = 'rgb(226,229,227)'; x.fillRect(0, 0, 128, 512);
      for (let i = 0; i < 260; i++) { const v = 200 + rnd() * 50; x.fillStyle = `rgba(${v},${v},${v - 4},0.25)`; x.fillRect(rnd() * 128, rnd() * 512, 2 + rnd() * 14, 2 + rnd() * 30); }
      x.fillStyle = 'rgba(120,124,124,0.85)'; x.fillRect(0, 0, 2, 512);
      for (let k = 0; k < 6; k++) x.fillRect(0, Math.round((512 * k) / 6), 128, 2);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.repeat.set(18, 1);
      return t;
    })();
    const pintado = (m, rough) => { m.roughnessMap = null; m.roughness = rough; return m; };
    const chapa = pintado(kit.mat('metal', { repeat: [18, 1], color: 0xe6ebe7, metalness: 0.05, normalScale: 0.15 }), 0.62);   // pintura exterior
    chapa.map = planchas;
    const chapaInt = pintado(kit.mat('metal', { repeat: [18, 1], color: 0xc8d2d2, metalness: 0.02, normalScale: 0.12 }), 0.7); // revestimiento interior
    chapaInt.map = planchas;
    const corteMat = new THREE.MeshStandardMaterial({ color: 0xc0573e, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide });   // canto cortado
    const acero = pintado(kit.mat('metal', { repeat: [1, 6], color: 0x8d989e, metalness: 0.15, normalScale: 0.3 }), 0.55);
    const amarillo = new THREE.MeshStandardMaterial({ color: 0xe0ad2e, roughness: 0.5, metalness: 0.2 });
    const concreto = kit.mat('concrete', { repeat: [1, 1], color: 0xcac6bd, normalScale: 0.7 });
    const tuboMat = pintado(kit.mat('metal', { repeat: [3, 1], color: 0x4f7fa3, metalness: 0.1, normalScale: 0.25 }), 0.48);
    const azul = new THREE.MeshStandardMaterial({ color: 0x2f5d8c, roughness: 0.42, metalness: 0.3 });
    const rojo = new THREE.MeshStandardMaterial({ color: 0xb4382c, roughness: 0.5, metalness: 0.2 });

    const torno = (r0, y0, r1, y1, mat, { seg = 120, a0 = 0, da = TAU, padre = esc, sombra = true } = {}) =>
      kit.malla(new THREE.LatheGeometry([new THREE.Vector2(r0, y0), new THREE.Vector2(r1, y1)], seg, a0, da), mat, { padre, sombra });
    const SECTOR = { a0: CORTE, da: TAU - 2 * CORTE };
    class Arco extends THREE.Curve {
      constructor(c, u, v, R) { super(); this.c = c; this.u = u; this.v = v; this.R = R; }
      getPoint(t, out = new THREE.Vector3()) { const a = (t * Math.PI) / 2; return out.copy(this.c).addScaledVector(this.u, Math.cos(a) * this.R).addScaledVector(this.v, Math.sin(a) * this.R); }
    }
    const codo = (c, u, v, R, r, mat, padre) => kit.malla(new THREE.TubeGeometry(new Arco(new THREE.Vector3(...c), new THREE.Vector3(...u), new THREE.Vector3(...v), R), 14, r, 24, false), mat, { padre });
    const instancias = (geo, mat, mats) => {
      const inst = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.castShadow = true; inst.receiveShadow = true; esc.add(inst);
      return inst;
    };
    const entre = (a, b, grosor = 1) => { // matriz para una pieza de largo 1 en y que va de a a b
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = new THREE.Vector3().subVectors(B, A);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      return new THREE.Matrix4().compose(A.addScaledVector(d, 0.5), q, new THREE.Vector3(grosor, d.length(), grosor));
    };

    // ------------------------------------------------------------ explanada de grava
    const pad = kit.malla(new THREE.CircleGeometry(16.5, 72), kit.mat('gravel', { repeat: [9, 9], color: 0xc4baa6, normalScale: 0.6 }), { rx: -Math.PI / 2, y: 0.025, sombra: false, padre: esc });
    pad.material.polygonOffset = true; pad.material.polygonOffsetFactor = -4; pad.material.polygonOffsetUnits = -4;

    // ------------------------------------------------------------ estructura: columnas, vigas y diagonales
    const angCol = Array.from({ length: 8 }, (_, k) => Math.PI / 8 + (k * Math.PI) / 4);
    instancias(new THREE.BoxGeometry(1.0, 0.62, 1.0), concreto, angCol.map((a) => new THREE.Matrix4().compose(new THREE.Vector3(...pol(a, RC, 0.31)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(1, 1, 1))));
    instancias(new THREE.BoxGeometry(0.72, 0.04, 0.72), acero, angCol.map((a) => new THREE.Matrix4().compose(new THREE.Vector3(...pol(a, RC, 0.64)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(1, 1, 1))));
    {
      const perno = kit.mergeGeometries([new THREE.CylinderGeometry(0.022, 0.022, 0.14, 6).translate(0, 0.07, 0), new THREE.CylinderGeometry(0.045, 0.045, 0.035, 6).translate(0, 0.03, 0)]);
      const ms = [];
      for (const a of angCol) for (const [dx, dz] of [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]]) {
        const ca = Math.cos(a), sa = Math.sin(a), p = pol(a, RC, 0.66);
        ms.push(new THREE.Matrix4().makeTranslation(p[0] + dx * ca + dz * sa, 0.66, p[2] - dx * sa + dz * ca));
      }
      instancias(perno, acero, ms);
    }
    const perfilI = (() => {
      const b = 0.4, d = 0.4, tf = 0.028, tw = 0.018;
      return kit.mergeGeometries([
        new THREE.BoxGeometry(b, 1, tf).translate(0, 0.5, d / 2 - tf / 2),
        new THREE.BoxGeometry(b, 1, tf).translate(0, 0.5, -d / 2 + tf / 2),
        new THREE.BoxGeometry(tw, 1, d - 2 * tf).translate(0, 0.5, 0),
      ]);
    })();
    instancias(perfilI, acero, angCol.map((a) => new THREE.Matrix4().compose(new THREE.Vector3(...pol(a, RC, 0.66)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(1, Y_VIGA - 0.66, 1))));
    // vigas horizontales entre columnas
    const vigas = [];
    // los tres vanos de adelante quedan como pórticos libres para que las vigas no tapen el corte
    for (const y of [4.6, 8.4]) angCol.forEach((a, k) => { if (k === 0 || k >= 6) return; const b = angCol[(k + 1) % 8]; vigas.push(entre(pol(a, RC, y), pol(b, RC, y))); });
    instancias(new THREE.BoxGeometry(0.3, 1, 0.2), acero, vigas);
    // diagonales en cruz solo en los vanos de los costados y de atrás (los de adelante dejan ver el corte)
    const diag = [], niveles = [0.66, 4.6, 8.4, Y_VIGA];
    angCol.forEach((a, k) => {
      const b = angCol[(k + 1) % 8], centro = (a + b) / 2 + (k === 7 ? Math.PI : 0);
      if (Math.cos(centro) > 0.05) return;
      for (let n = 0; n < 3; n++) {
        diag.push(entre(pol(a, RC + 0.24, niveles[n]), pol(b, RC + 0.24, niveles[n + 1])));
        diag.push(entre(pol(b, RC + 0.24, niveles[n]), pol(a, RC + 0.24, niveles[n + 1])));
      }
    });
    instancias(new THREE.CylinderGeometry(0.032, 0.032, 1, 6), acero, diag);
    // viga anular bajo el borde del cono
    torno(15.5, Y_VIGA, 15.5, YB - 0.03, acero);
    torno(15.0, YB - 0.03, 15.0, Y_VIGA, acero);
    torno(15.0, Y_VIGA, 15.5, Y_VIGA, acero);

    // ------------------------------------------------------------ manto cónico de acero con el corte frontal
    torno(15.0, YB, 0.3, YV + 0.2, chapaInt, SECTOR);                 // cara interior
    torno(0.3 + ESP, YV + 0.2, 15.0 + ESP, YB, chapa, SECTOR);        // cara exterior
    torno(15.0 + ESP, YB, 15.0, YB, chapa, SECTOR);                   // canto superior
    for (const y of [YV + 3.6, YV + 7.0]) {                            // anillos rigidizadores
      const r = 1.5 * (y - YV) + ESP;
      torno(r + 0.17, y + 0.012, r, y + 0.012, chapa, SECTOR);
      torno(r, y - 0.012, r + 0.17, y - 0.012, chapa, SECTOR);
      torno(r + 0.17, y - 0.012, r + 0.17, y + 0.012, chapa, SECTOR);
    }
    {
      const pc = [];
      for (const a of [CORTE, TAU - CORTE]) {
        const sa = Math.sin(a), ca = Math.cos(a);
        const ib = [sa * 0.3, YV + 0.2, ca * 0.3], it = [sa * 15, YB, ca * 15], ot = [sa * (15 + ESP), YB, ca * (15 + ESP)], ob = [sa * (0.3 + ESP), YV + 0.2, ca * (0.3 + ESP)];
        pc.push(...ib, ...it, ...ot, ...ib, ...ot, ...ob);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pc, 3)); geo.computeVertexNormals();
      kit.malla(geo, corteMat, { padre: esc });
    }

    // ------------------------------------------------------------ pasillo perimetral con baranda
    const rejillaTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); x.fillStyle = '#3b4146'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#9aa2a8'; for (let i = 0; i < 64; i += 8) x.fillRect(i, 0, 3, 64);
      x.fillStyle = '#7d858b'; for (let j = 0; j < 64; j += 21) x.fillRect(0, j, 64, 3);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.repeat.set(170, 2);
      return t;
    })();
    const rejilla = new THREE.MeshStandardMaterial({ map: rejillaTex, roughness: 0.6, metalness: 0.5 });
    torno(16.25, Y_PASILLO, 15.0, Y_PASILLO, rejilla);
    torno(15.5, Y_PASILLO - 0.04, 16.25, Y_PASILLO - 0.04, acero);
    torno(16.25, Y_PASILLO - 0.04, 16.25, Y_PASILLO, acero);
    const hueco = 0.95 / 16.2; // paso de la escalera
    {
      const ms = [], n = 64;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, da = Math.atan2(Math.sin(a - A_ESCALA), Math.cos(a - A_ESCALA));
        if (Math.abs(da) < hueco * 0.75) continue;
        ms.push(new THREE.Matrix4().makeTranslation(...pol(a, 16.2, Y_PASILLO + 0.55)));
      }
      ms.push(new THREE.Matrix4().makeTranslation(...pol(A_ESCALA + hueco / 2, 16.2, Y_PASILLO + 0.55)));
      ms.push(new THREE.Matrix4().makeTranslation(...pol(A_ESCALA - hueco / 2, 16.2, Y_PASILLO + 0.55)));
      instancias(new THREE.BoxGeometry(0.05, 1.1, 0.05), amarillo, ms);
      const th0 = Math.PI / 2 - A_ESCALA + hueco / 2; // ángulo del toro equivalente al borde del paso
      for (const y of [Y_PASILLO + 1.08, Y_PASILLO + 0.55]) {
        const rail = kit.malla(new THREE.TorusGeometry(16.2, 0.024, 6, 220, TAU - hueco), amarillo, { y, padre: esc });
        rail.rotation.set(Math.PI / 2, 0, th0);
      }
      const zocalo = kit.malla(new THREE.CylinderGeometry(16.22, 16.22, 0.1, 180, 1, true, A_ESCALA + hueco / 2, TAU - hueco), amarillo, { y: Y_PASILLO + 0.05, padre: esc });
      zocalo.material = amarillo.clone(); zocalo.material.side = THREE.DoubleSide;
    }

    // ------------------------------------------------------------ escalera de gato con jaula
    {
      const esca = new THREE.Group(); esca.rotation.y = A_ESCALA; esc.add(esca);
      const ZL = 16.6, top = Y_PASILLO + 1.15;
      for (const x of [-0.22, 0.22]) kit.caja(0.065, top, 0.014, amarillo, { x, y: top / 2, z: ZL, padre: esca });
      const pel = new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8); pel.rotateZ(Math.PI / 2);
      const n = Math.floor((Y_PASILLO - 0.1) / 0.3), ip = new THREE.InstancedMesh(pel, amarillo, n), m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { m4.makeTranslation(0, 0.3 * (i + 1), ZL); ip.setMatrixAt(i, m4); }
      ip.castShadow = true; esca.add(ip);
      const lado = Math.hypot(0.16, 0.34), giroLado = Math.atan2(0.16, 0.34);
      const aro = kit.mergeGeometries([
        new THREE.TorusGeometry(0.38, 0.016, 5, 18, Math.PI).rotateX(Math.PI / 2).translate(0, 0, 0.34),
        new THREE.BoxGeometry(0.012, 0.035, lado).rotateY(-giroLado).translate(-0.3, 0, 0.17),
        new THREE.BoxGeometry(0.012, 0.035, lado).rotateY(giroLado).translate(0.3, 0, 0.17),
      ].map((gg) => (gg.index ? gg.toNonIndexed() : gg)).map((gg) => { gg.deleteAttribute('uv'); return gg; }));
      const yA = [];
      for (let y = 2.4; y < top - 0.05; y += 0.85) yA.push(y);
      const aros = new THREE.InstancedMesh(aro, amarillo, yA.length);
      yA.forEach((y, i) => { m4.makeTranslation(0, y, ZL); aros.setMatrixAt(i, m4); });
      aros.castShadow = true; esca.add(aros);
      for (const th of [0.15, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI - 0.15]) {
        const fl = kit.caja(0.045, top - 2.4, 0.01, amarillo, { x: 0.38 * Math.cos(th), y: (top + 2.4) / 2, z: ZL + 0.34 + 0.38 * Math.sin(th), padre: esca });
        fl.rotation.y = -th + Math.PI / 2;
      }
      for (const y of [1.6, 4.6, 7.6, 10.6]) for (const x of [-0.22, 0.22]) kit.caja(0.05, 0.08, ZL - RC - 0.2, amarillo, { x, y, z: (ZL + RC + 0.2) / 2, padre: esca });
    }

    // ------------------------------------------------------------ agua dentro del cono (se escala con h: los conos son semejantes)
    const aguaG = new THREE.Group(); aguaG.position.y = YV; esc.add(aguaG);
    const espumaTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 220; i++) {
        const px = rnd() * 128, py = rnd() * 128, r = 2 + rnd() * 9, a = 0.15 + rnd() * 0.5;
        for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) { x.beginPath(); x.arc(px + ox, py + oy, r, 0, TAU); x.fillStyle = `rgba(255,255,255,${a})`; x.fill(); }
      }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    })();
    const nrmSup = kit.makeSurface('noiseNormal', { size: 256, seed: 33, repeat: [3, 3], roughness: false }).normalMap;
    const uSup = { uImpacto: { value: new THREE.Vector2() }, uRadio: { value: 0.5 }, uHay: { value: 1 }, uTiempo: { value: 0 }, uTexEsp: { value: espumaTex } };
    const supMat = new THREE.MeshStandardMaterial({ color: 0x2c6f7f, roughness: 0.06, metalness: 0, normalMap: nrmSup, normalScale: new THREE.Vector2(0.55, 0.55), transparent: true, opacity: 0.88, envMapIntensity: 2.2, side: THREE.DoubleSide });
    supMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uSup);
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec2 vXZw;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vXZw = (modelMatrix * vec4(position, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec2 uImpacto;\nuniform float uRadio, uHay, uTiempo;\nuniform sampler2D uTexEsp;\nvarying vec2 vXZw;\nvoid main() {')
        .replace('#include <color_fragment>', `#include <color_fragment>
  float dEsp = length(vXZw - uImpacto);
  float mEsp = 1.0 - smoothstep(uRadio * 0.6, uRadio * 2.6 + 0.5, dEsp);
  float nEsp = texture2D(uTexEsp, vXZw * 0.35 + vec2(uTiempo * 0.11, -uTiempo * 0.07)).r + texture2D(uTexEsp, vXZw * 0.17 - vec2(uTiempo * 0.06, uTiempo * 0.1)).r;
  float espuma = clamp(mEsp * (0.3 + nEsp * 0.9), 0.0, 1.0) * uHay;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 0.95), espuma);
  diffuseColor.a = max(diffuseColor.a, espuma);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.75, espuma);');
    };
    {
      const n = 72, pos = [0, M.H, 0], uv = [0.5, 0.5], idx = [];
      for (let i = 0; i <= n; i++) { const a = CORTE + ((TAU - 2 * CORTE) * i) / n; pos.push(Math.sin(a) * M.R, M.H, Math.cos(a) * M.R); uv.push(0.5 + Math.sin(a) * 0.5, 0.5 + Math.cos(a) * 0.5); }
      for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      const sup = kit.malla(geo, supMat, { padre: aguaG, sombra: false });
      sup.renderOrder = 3;
    }
    {
      // las dos caras del corte muestran la sección del agua: más clara arriba y más oscura en el fondo
      const pos = [], col = [], hondo = [0.008, 0.05, 0.07], claro = [0.06, 0.24, 0.3];
      for (const a of [CORTE, TAU - CORTE]) { pos.push(0, 0, 0, 0, M.H, 0, Math.sin(a) * M.R, M.H, Math.cos(a) * M.R); col.push(...hondo, ...claro, ...claro); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const caras = kit.malla(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.93, side: THREE.DoubleSide, emissive: 0x0d3a46, emissiveIntensity: 0.55, envMapIntensity: 1.4 }), { padre: aguaG, sombra: false });
      caras.renderOrder = 2;
    }
    const celeste = new THREE.MeshBasicMaterial({ color: 0xbff0ff, toneMapped: false });
    const lineas = [kit.barra([0, 0, 0], [0, 1, 0], 0.03, celeste), kit.barra([0, 0, 0], [0, 1, 0], 0.03, celeste)];
    esc.add(...lineas);

    // ------------------------------------------------------------ tubería de entrada con su chorro
    const ent = new THREE.Group(); ent.rotation.y = A_ENTRADA; esc.add(ent);
    const ZR = 17.3;
    kit.cilindro(0.8, 0.8, 13.8, tuboMat, { y: 6.5, z: ZR, seg: 28, padre: ent });
    codo([0, 13.4, ZR - 1.2], [0, 0, 1], [0, 1, 0], 1.2, 0.8, tuboMat, ent);
    kit.cilindro(0.8, 0.8, ZR - 1.2 - 2.4, tuboMat, { y: 14.6, z: (ZR - 1.2 + 2.4) / 2, rx: Math.PI / 2, seg: 28, padre: ent });
    codo([0, 13.4, 2.4], [0, 1, 0], [0, 0, -1], 1.2, 0.8, tuboMat, ent);
    kit.cilindro(0.8, 0.8, 0.4, tuboMat, { y: Y_BOCA + 0.2, z: R_BOCA, seg: 28, padre: ent });
    const brida = (o) => kit.cilindro(0.93, 0.93, 0.07, tuboMat, { seg: 28, padre: ent, ...o });
    brida({ y: Y_BOCA + 0.035, z: R_BOCA }); brida({ y: 4.2, z: ZR }); brida({ y: 9.2, z: ZR });
    brida({ y: 14.6, z: 11.6, rx: Math.PI / 2 }); brida({ y: 14.6, z: 6.4, rx: Math.PI / 2 });
    kit.caja(2.4, 0.9, 2.4, concreto, { y: 0.45, z: ZR, padre: ent });
    for (const y of [4.6, 8.4]) {
      kit.caja(0.18, 0.2, 2.3, acero, { y, z: 15.35, padre: ent });
      kit.malla(new THREE.TorusGeometry(0.83, 0.04, 6, 32), acero, { y, z: ZR, rx: Math.PI / 2, padre: ent });
    }
    kit.caja(1.0, 13.8 - Y_PASILLO, 0.3, acero, { y: (13.8 + Y_PASILLO) / 2, z: 15.3, padre: ent });
    { // cercha bajo el tramo horizontal
      const cordon = [[0, 13.8, 15.2], [0, 12.95, 11.2], [0, 12.95, 6.4], [0, 13.8, 2.6]];
      for (let i = 0; i < 3; i++) ent.add(kit.barra(cordon[i], cordon[i + 1], 0.05, acero));
      for (const z of [11.2, 6.4]) ent.add(kit.barra([0, 12.95, z], [0, 13.82, z], 0.04, acero));
      ent.add(kit.barra([0, 12.95, 11.2], [0, 13.82, 8.8], 0.035, acero), kit.barra([0, 12.95, 6.4], [0, 13.82, 8.8], 0.035, acero));
    }
    const vetaTex = (horizontal) => {
      const c = document.createElement('canvas'); c.width = horizontal ? 256 : 64; c.height = horizontal ? 64 : 256;
      const x = c.getContext('2d'); x.fillStyle = 'rgb(196,222,232)'; x.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < 110; i++) {
        const p = rnd() * 64, w = 1 + rnd() * 3, q0 = rnd() * 256, len = 30 + rnd() * 140, br = rnd() < 0.7;
        x.fillStyle = br ? `rgba(255,255,255,${0.3 + rnd() * 0.55})` : `rgba(90,130,150,${0.15 + rnd() * 0.3})`;
        for (const o of [-256, 0]) { if (horizontal) x.fillRect(q0 + o, p, len, w); else x.fillRect(p, q0 + o, w, len); }
      }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    const vetaV = vetaTex(false); vetaV.repeat.set(3, 1.6);
    const chorroMat = new THREE.MeshStandardMaterial({ map: vetaV, transparent: true, opacity: 0.86, roughness: 0.2, metalness: 0, emissive: 0x6f8f9a, emissiveIntensity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const chorroGeo = new THREE.CylinderGeometry(1, 0.8, 1, 28, 6, true); chorroGeo.translate(0, -0.5, 0);
    const chorro = kit.malla(chorroGeo, chorroMat, { y: Y_BOCA, z: R_BOCA, padre: ent, sombra: false });
    chorro.renderOrder = 4;
    esc.updateMatrixWorld(true);
    { const w = ent.localToWorld(new THREE.Vector3(0, 0, R_BOCA)); uSup.uImpacto.value.set(w.x, w.z); }

    // ------------------------------------------------------------ salida por el vértice: válvula, tubería y canal
    kit.cilindro(0.32, 0.32, 0.72, chapa, { y: YV - 0.11, seg: 24, padre: esc });
    kit.cilindro(0.48, 0.48, 0.06, azul, { y: 1.9, seg: 28, padre: esc });
    const cuerpo = kit.malla(new THREE.SphereGeometry(0.42, 24, 14), azul, { y: 1.625, padre: esc }); cuerpo.scale.set(1, 0.68, 0.9);
    kit.cilindro(0.48, 0.48, 0.06, azul, { y: 1.35, seg: 28, padre: esc });
    kit.cilindro(0.2, 0.16, 0.62, azul, { y: 1.625, z: 0.62, rx: Math.PI / 2, seg: 20, padre: esc });
    kit.cilindro(0.26, 0.26, 0.05, azul, { y: 1.625, z: 0.36, rx: Math.PI / 2, seg: 20, padre: esc });
    kit.cilindro(0.03, 0.03, 0.32, acero, { y: 1.625, z: 1.06, rx: Math.PI / 2, padre: esc });
    kit.malla(new THREE.TorusGeometry(0.3, 0.028, 8, 36), rojo, { y: 1.625, z: 1.17, padre: esc });
    for (let k = 0; k < 3; k++) kit.caja(0.6, 0.03, 0.025, rojo, { y: 1.625, z: 1.17, rz: (k * Math.PI) / 3, padre: esc });
    kit.cilindro(0.06, 0.06, 0.08, rojo, { y: 1.625, z: 1.17, rx: Math.PI / 2, padre: esc });
    codo([0.6, 1.35, 0], [-1, 0, 0], [0, -1, 0], 0.6, 0.3, tuboMat, esc);
    kit.cilindro(0.3, 0.3, 5.4, tuboMat, { x: 3.3, y: 0.75, rz: Math.PI / 2, seg: 24, padre: esc });
    for (const x of [3.3, 6.0]) kit.cilindro(0.4, 0.4, 0.06, tuboMat, { x, y: 0.75, rz: Math.PI / 2, seg: 24, padre: esc });
    for (const x of [2.2, 4.6]) kit.caja(0.4, 0.45, 0.8, concreto, { x, y: 0.225, padre: esc });
    // canal de hormigón que recibe la descarga
    const X0C = 5.62, X1C = 16.4, XM = (X0C + X1C) / 2, LC = X1C - X0C;
    kit.caja(LC, 0.1, 1.5, concreto, { x: XM, y: 0.05, padre: esc });
    for (const z of [-0.67, 0.67]) kit.caja(LC, 0.4, 0.16, concreto, { x: XM, y: 0.2, z, padre: esc });
    kit.caja(0.16, 0.4, 1.5, concreto, { x: X0C, y: 0.2, padre: esc });
    const nrmCanal = kit.makeSurface('noiseNormal', { size: 256, seed: 7, repeat: [LC / 1.5, 1], roughness: false }).normalMap;
    kit.malla(new THREE.PlaneGeometry(LC - 0.16, 1.18), new THREE.MeshStandardMaterial({ color: 0x2f5c63, roughness: 0.08, metalness: 0, normalMap: nrmCanal, normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 2 }), { rx: -Math.PI / 2, x: XM + 0.08, y: 0.22, padre: esc, sombra: false });
    const vetaH = vetaTex(true); vetaH.repeat.set(1, 3);
    {
      const pts = [];
      for (let i = 0; i <= 10; i++) { const t = (0.335 * i) / 10; pts.push(new THREE.Vector3(6.03 + 3.54 * t, 0.75 - 4.905 * t * t, 0)); }
      const caida = kit.malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.26, 18, false), new THREE.MeshStandardMaterial({ map: vetaH, transparent: true, opacity: 0.85, roughness: 0.2, emissive: 0x6f8f9a, emissiveIntensity: 0.3, depthWrite: false }), { padre: esc, sombra: false });
      caida.renderOrder = 4;
    }

    // ------------------------------------------------------------ persona de referencia (1,75 m) junto a la válvula
    {
      const persona = new THREE.Group();
      const m = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
      const ropa = m(0x34495e), chaleco = m(0xff7a1a, 0.7), piel = m(0xc9a07a, 0.7), zap = m(0x2a2522, 0.6), casco = m(0xf2f2ee, 0.4);
      for (const sx of [-0.1, 0.1]) {
        kit.malla(new THREE.CapsuleGeometry(0.07, 0.72, 4, 10), ropa, { x: sx, y: 0.47, padre: persona });
        kit.caja(0.11, 0.07, 0.27, zap, { x: sx, y: 0.035, z: 0.04, padre: persona });
      }
      const torso = kit.malla(new THREE.CapsuleGeometry(0.17, 0.42, 4, 14), chaleco, { y: 1.18, padre: persona });
      torso.scale.set(1, 1, 0.68);
      for (const sx of [-1, 1]) {
        kit.malla(new THREE.CapsuleGeometry(0.05, 0.5, 4, 8), ropa, { x: sx * 0.235, y: 1.17, z: 0.1, rx: -0.5, rz: sx * 0.1, padre: persona });
        kit.malla(new THREE.SphereGeometry(0.048, 10, 8), piel, { x: sx * 0.25, y: 0.93, z: 0.25, padre: persona });
      }
      kit.malla(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), piel, { y: 1.52, padre: persona });
      const cabeza = kit.malla(new THREE.SphereGeometry(0.105, 18, 14), piel, { y: 1.63, padre: persona }); cabeza.scale.set(1, 1.1, 1);
      kit.malla(new THREE.SphereGeometry(0.125, 18, 10, 0, TAU, 0, 1.45), casco, { y: 1.67, padre: persona });
      kit.cilindro(0.15, 0.15, 0.012, casco, { y: 1.665, z: 0.02, padre: persona });
      persona.position.set(1.35, 0.03, 1.95); persona.rotation.y = Math.atan2(-1.35, -0.78);
      esc.add(persona);
    }

    // ------------------------------------------------------------ cotas y rótulos
    const matCota = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    const cotaH = kit.barra([0, 0, 0], [0, 1, 0], 0.045, matCota(0x5cc8ff));
    const cotaR = kit.barra([0, 0, 0], [0, 1, 0], 0.045, matCota(0xffb347));
    esc.add(cotaH, cotaR);
    const gris = matCota(0xdfe6ec);
    esc.add(kit.barra([-0.55, YV, 0.45], [-0.55, YB, 0.45], 0.025, gris));
    esc.add(kit.barra([0, YB + 0.38, 0.12], [Math.sin(CORTE) * M.R, YB + 0.38, Math.cos(CORTE) * M.R + 0.12], 0.025, gris));
    const lH = kit.etiqueta('H = 10 m', 0.6, { bg: 'rgba(223,230,236,0.92)', color: '#16202a' }); lH.position.set(-2.1, YB - 1.4, 1.6);
    const lRR = kit.etiqueta('R = 15 m', 0.6, { bg: 'rgba(223,230,236,0.92)', color: '#16202a' }); lRR.position.set(Math.sin(CORTE) * 9, YB + 1.1, Math.cos(CORTE) * 9 + 1.2);
    const lh = kit.etiqueta('h', 0.75, { bg: '#5cc8ff', color: '#08202c' });
    const lr = kit.etiqueta('r', 0.75, { bg: '#ffb347', color: '#1a1206' });
    const lc = kit.etiqueta('c', 0.7, { bg: '#7fd4c1', color: '#0b201b' });
    const lsal = kit.etiqueta('sale 1 m³/s', 0.5, { bg: 'rgba(12,20,32,0.86)' });
    const wBoca = esc.worldToLocal(ent.localToWorld(new THREE.Vector3(0, Y_BOCA, R_BOCA)));
    lc.position.set(wBoca.x + 3.4, Y_BOCA - 0.9, wBoca.z + 2.2); lsal.position.set(7.4, 1.6, 1.4);
    esc.add(lH, lRR, lh, lr, lc, lsal);
    // asa para subir o bajar el nivel arrastrando
    const asa = kit.malla(new THREE.SphereGeometry(0.28, 20, 14), new THREE.MeshStandardMaterial({ color: 0x5cc8ff, emissive: 0x2a8fd0, emissiveIntensity: 0.9 }), { padre: esc, sombra: false });
    kit.arrastre(asa, esc, { normal: [0, 0, 1], punto: [0, 0, 0.45], cursor: 'ns-resize', habilitado: est.habilitado, alMover: (p) => fijarH(p.y - YV) });

    // ------------------------------------------------------------ estado
    function fijarH(v) { s.simular = false; s.h = Math.min(M.H, Math.max(0.2, v)); s.cambio++; }
    function fijarC(v) { s.c = Math.min(40, Math.max(0, v)); s.cambio++; s.cambioC++; }
    function simular(v) {
      if (v && s.c > M.salida && s.h >= M.H - 1e-3) s.h = 0.5;
      if (v && s.c < M.salida && s.h <= 0.2 + 1e-3) s.h = M.H;
      s.simular = v; s.cambio++;
    }
    const dhdt = () => M.dhdt(s.h, s.c);

    function construir() {
      const h = s.h, k = h / M.H, r = M.radio(h), y = YV + h;
      aguaG.scale.setScalar(k);
      nrmSup.repeat.set(k * 9, k * 9);
      [CORTE, TAU - CORTE].forEach((a, i) => kit.moverBarra(lineas[i], [0, y + 0.015, 0], [Math.sin(a) * r, y + 0.015, Math.cos(a) * r]));
      kit.moverBarra(cotaH, [0, YV, 0.45], [0, y, 0.45]);
      kit.moverBarra(cotaR, [0, y + 0.2, 0.12], [Math.sin(CORTE) * r, y + 0.2, Math.cos(CORTE) * r + 0.12]);
      asa.position.set(0, y, 0.45);
      const rj = radioChorro(s.c), yb = YV + Math.max(h, R_BOCA / 1.5);
      chorro.visible = rj > 0.02;
      chorro.scale.set(Math.max(rj, 0.01), Y_BOCA - yb, Math.max(rj, 0.01));
      uSup.uRadio.value = rj; uSup.uHay.value = rj > 0.02 ? 1 : 0;
    }
    function rotulos() {
      const h = s.h, r = M.radio(h);
      kit.cambiarEtiqueta(lh, `h = ${kit.num(h, 2)} m`); lh.position.set(1.7, YV + Math.max(h / 2, 0.4), 2.6);
      kit.cambiarEtiqueta(lr, `r = ${kit.num(r, 2)} m`); lr.position.set(Math.max(Math.sin(CORTE) * r * 0.5, 1.6) + 0.5, YV + h + 0.95, Math.cos(CORTE) * r * 0.5 + 2.2);
      kit.cambiarEtiqueta(lc, `c = ${kit.num(s.c, 2)} m³/s`);
    }

    // ------------------------------------------------------------ gráfico dh/dt en función de h
    const fDh = (x) => M.dhdt(Math.max(x, 0.05), s.c);
    const graf = kit.grafico({
      f: fDh, x0: 0, x1: 10, y0: -2, y1: 10, width: 1.3, height: 0.8,
      xTicks: [0, 2, 4, 6, 8, 10], yTicks: [-2, 0, 2, 4, 6, 8, 10], tickFmt: (v) => String(v), yTickFmt: (v) => kit.num(v, 0),
      xLabel: 'nivel h (m)', yLabel: 'dh/dt (m/s)', curveColor: 0x5cc8ff,
    });
    graf.group.position.set(0.6, 1.05, 28 - 1.65); graf.group.rotation.y = -0.42;
    esc.add(graf.group);
    {
      const guia = kit.dashedLine(graf.toLocal(0, 4, 0.002), graf.toLocal(10, 4, 0.002), { color: 0xffb347, radius: 0.0032, dash: 0.03, gap: 0.016 });
      guia.renderOrder = 6; graf.group.add(guia);
      const l = kit.createLabel('4 m/s', { size: 0.036, color: '#1a1206', bg: '#ffb347', weight: 700 });
      l.position.copy(graf.toLocal(10, 4, 0.004)).add(new THREE.Vector3(-0.07, 0.035, 0)); graf.group.add(l);
    }
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => fijarH(graf.xFromLocal(p.x)) });
    function revelar() {
      graf.removePoint('sol');
      if (s.revelar) { fijarC(M.respuesta()); graf.addPoint('sol', 1, 4, { color: 0x6fe3a2, labelX: 'h = 1 m' }); }
      s.cambio++;
    }

    // ------------------------------------------------------------ panel
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'Cono con el vértice hacia abajo, 10 m de altura y 15 m de radio. Sale agua a 1 m³/s y entra a razón c. ¿Qué valor de c hace subir el nivel a 4 m/s cuando h = 1 m?',
      ecuaciones: ['r/h = 15/10  ⇒  r = 1,5h,   V = (1/3)πr²h = (3π/4)h³', 'dV/dt = (9π/4)h² · dh/dt = c − 1'],
      lecturas: [
        { etiqueta: 'nivel h', valor: () => `${kit.num(s.h, 2)} m`, color: '#5cc8ff' },
        { etiqueta: 'radio r = 1,5h', valor: () => `${kit.num(M.radio(s.h), 2)} m`, color: '#ffb347' },
        { etiqueta: 'volumen V', valor: () => `${kit.num(M.V(s.h), 1)} m³`, color: '#c9a7ff', escala: 0.66 },
        { etiqueta: 'entrada c', valor: () => `${kit.num(s.c, 2)} m³/s`, color: '#7fd4c1', escala: 0.66 },
        { etiqueta: 'dV/dt = c − 1', valor: () => `${kit.num(s.c - M.salida, 2)} m³/s`, color: '#c9a7ff', escala: 0.66 },
        { etiqueta: 'dh/dt', valor: () => `${kit.num(dhdt(), 3)} m/s`, color: '#5cc8ff', escala: 0.66 },
      ],
      deslizadores: [
        { etiqueta: 'Caudal de entrada c', min: 0, max: 40, paso: 0.05, color: '#7fd4c1', get: () => s.c, set: (v) => fijarC(v), formato: (v) => `${kit.num(v, 2)} m³/s` },
        { etiqueta: 'Nivel del agua h', min: 0.2, max: 10, paso: 0.01, get: () => s.h, set: (v) => fijarH(v), formato: (v) => `${kit.num(v, 2)} m` },
        { etiqueta: 'Velocidad de la simulación', min: 1, max: 20, paso: 1, color: '#ffb347', get: () => s.vel, set: (v) => { s.vel = v; panel.invalidate(); }, formato: (v) => `${kit.num(v, 0)}×` },
      ],
      botones: [
        { etiqueta: () => (s.simular ? '❚❚ Detener' : '▶ Simular'), tipo: 'interruptor', get: () => s.simular, set: (v) => simular(v) },
        { etiqueta: 'Ir a h = 1 m', accion: () => fijarH(1) },
        { etiqueta: 'Revelar', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      pie: () => (s.revelar
        ? 'Con h = 1 m y dh/dt = 4 m/s: c − 1 = (9π/4)·1²·4 = 9π, así que c = 1 + 9π ≈ 29,27 m³/s. La guía escribe cm³/s, pero con un depósito de 10 m esa unidad no es coherente: aquí se usa m³/s.'
        : 'Mueve c y h, arrastra la esfera celeste o activa Simular. Busca el caudal c con el que la curva dh/dt pasa por la guía de 4 m/s justo en h = 1 m.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-1.35, 1.38, 28 - 1.4); panel.mesh.rotation.y = 0.5;
    esc.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    let tiempo = 0;
    return {
      paneles: [panel],
      radioSombra: 28,
      alturaCartel: 18.5,
      vista: {
        escritorio: { camara: aGrupo([5, 10, 35]), objetivo: aGrupo([0, 5.6, 0]) },
        vr: { pos: aGrupo([0, 0, 28]), yaw: esc.rotation.y },
      },
      dom: [
        { tipo: 'rango', etiqueta: 'c', min: 0, max: 40, paso: 0.01, get: () => s.c, set: (v) => fijarC(v), formato: (v) => `${kit.num(v, 2)} m³/s` },
        { tipo: 'rango', etiqueta: 'h', min: 0.2, max: 10, paso: 0.01, get: () => s.h, set: (v) => fijarH(v), formato: (v) => `${kit.num(v, 2)} m` },
        { tipo: 'interruptor', etiqueta: () => (s.simular ? '❚❚ Detener' : '▶ Simular'), get: () => s.simular, set: (v) => simular(v) },
        { tipo: 'boton', etiqueta: 'Ir a h = 1 m', accion: () => fijarH(1) },
        { tipo: 'interruptor', etiqueta: 'Revelar', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      actualizar(dt) {
        tiempo += dt;
        uSup.uTiempo.value = tiempo;
        nrmSup.offset.set(tiempo * 0.03, tiempo * 0.021);
        nrmCanal.offset.x -= dt * 0.35;
        vetaV.offset.y += dt * 1.6;
        vetaH.offset.x -= dt * 1.2;
        if (s.simular) {
          let h = hDeV(Math.max(0, M.V(s.h) + (s.c - M.salida) * dt * s.vel));
          if (h >= M.H) { h = M.H; s.simular = false; }
          if (h <= 0.2) { h = 0.2; s.simular = false; }
          s.h = h; s.cambio++;
        }
        s.refresco -= dt; s.refrescoC -= dt;
        if (s.ultimoC !== s.cambioC && s.refrescoC <= 0) { s.ultimoC = s.cambioC; s.refrescoC = 0.12; graf.setFunction(fDh); s.ultimo = -1; }
        if (s.ultimo !== s.cambio) {
          s.ultimo = s.cambio;
          construir();
          if (!s.simular || s.refresco <= 0) { s.refresco = 0.1; rotulos(); graf.setMarker(s.h); }
          panel.invalidate();
        }
      },
    };
  },
};
