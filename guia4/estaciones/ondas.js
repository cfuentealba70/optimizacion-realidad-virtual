// Ejemplo 6. Una piedra cae en un lago en calma: el radio de la onda exterior crece a 1 pie/s.
import { ONDAS as M } from '../../src/math/guia4.js';

const PIE = 0.3048;   // metros por pie
const YA = -0.36;     // nivel del agua: el estanque está excavado bajo el suelo del mundo (y = 0)
const TAU = Math.PI * 2;
const NA = 120;       // divisiones del contorno de la orilla
const T_VUELO = 1.0;  // segundos que la piedra vuela antes de tocar el agua

const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// Radio de la orilla según el ángulo a (a = 0 apunta hacia el muelle, +z de la escena)
const orilla = (a) => 14.2 + 1.1 * Math.sin(2 * a + 0.9) + 0.6 * Math.sin(3 * a + 2.3) + 0.35 * Math.sin(5 * a + 0.4) + 0.2 * Math.sin(7 * a + 1.3);
// Relieve suave del fondo
const ondulacion = (x, z) => 0.12 * Math.sin(0.43 * x + 1.3) * Math.sin(0.37 * z + 0.4) + 0.06 * Math.sin(0.9 * x - 0.7 * z + 2.0);
// Altura del terreno a la distancia d de la orilla, medida hacia el centro del estanque
const fondo = (d, x = 0, z = 0) => 0.05 - 0.5 * sstep(0, 1.3, d) - 1.15 * sstep(1, 7.5, d) + ondulacion(x, z) * sstep(0.8, 3, d);

export default {
  id: 'ondas',
  tipo: 'razon',
  etiqueta: 'Ejemplo 6 · Razón de cambio',
  titulo: 'Ondas en un lago',
  resumen: 'Se deja caer una piedra en un lago en calma y se forman ondas circulares concéntricas. El radio r del círculo exterior crece a razón constante de 1 pie/s. ¿Con qué rapidez crece el área A encerrada por esa onda cuando r = 4 pies?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const rnd = kit.mulberry32(606);

    // La escena se gira para que el muelle quede en la prolongación del sendero que llega desde la plaza
    const plaza = g.worldToLocal(new THREE.Vector3(0, 0, 0));
    const giro = Math.atan2(plaza.x, plaza.z);
    const esc = new THREE.Group(); esc.rotation.y = giro; g.add(esc);
    const aGrupo = (v) => { const p = new THREE.Vector3(...v).applyEuler(esc.rotation).add(esc.position); return [p.x, p.y, p.z]; };

    const reloj = kit.reloj({ t0: 0, t1: 12, instante: M.instante, velocidad: 1 });
    const s = { revelar: false, ultimo: -1, refresco: 0, lanzando: false, tau: 0, primera: true };

    const R0 = orilla(0);              // orilla frente al muelle
    const Z_FIN = 9.0;                 // extremo del muelle sobre el agua
    const Z_INI = R0 + 1.15;           // arranque del muelle en tierra
    const VR = [0, 0, Z_FIN + 0.8];    // donde queda la persona en VR
    const P = new THREE.Vector3(0, YA, VR[2] - 6); // punto donde cae la piedra
    const enOrilla = (a, d) => { const r = orilla(a) - d; return [Math.sin(a) * r, Math.cos(a) * r]; };

    // ------------------------------------------------------------ malla radial que sigue la orilla
    function radial(radiosDe, punto) {
      const pos = [], uv = [], col = [], idx = [];
      let nU = 0;
      for (let i = 0; i < NA; i++) {
        const a = (i / NA) * TAU, R = orilla(a), radios = radiosDe(a, R);
        nU = radios.length;
        radios.forEach((rho, j) => {
          const x = Math.sin(a) * rho, z = Math.cos(a) * rho, p = punto(x, z, R - rho, a, j);
          pos.push(x, p.y, z); uv.push(x / 3, z / 3);
          if (p.c) col.push(...p.c);
        });
      }
      for (let i = 0; i < NA; i++) {
        const i2 = (i + 1) % NA;
        for (let j = 0; j < nU - 1; j++) {
          const A = i * nU + j, B = i2 * nU + j, C = i2 * nU + j + 1, D = i * nU + j + 1;
          idx.push(A, B, D, B, C, D);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      if (col.length) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, col.length / (pos.length / 3)));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    }

    // ------------------------------------------------------------ hueco del estanque
    // El suelo del mundo es un plano en y = 0. Un disco con la forma de la orilla borra la profundidad del suelo
    // (se dibuja después del suelo y antes del fondo); así el fondo y el agua, bajo y = 0, quedan a la vista.
    // Lejos de la estación se apaga y lo reemplaza una lámina de agua a ras de suelo.
    const lejos = { value: 0 };
    const borrar = new THREE.Mesh(radial((a, R) => [R, 0], () => ({ y: 0.05 })), new THREE.ShaderMaterial({
      uniforms: { uLejos: lejos },
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uLejos;\nvoid main() { if (uLejos > 0.5) discard; gl_FragColor = vec4(0.0); gl_FragDepth = 1.0; }',
      depthFunc: THREE.AlwaysDepth, depthWrite: true, colorWrite: false,
    }));
    borrar.renderOrder = 1; borrar.frustumCulled = false;
    const camPos = new THREE.Vector3(), centro = new THREE.Vector3();
    borrar.onBeforeRender = (renderer, scene, camera) => {
      camPos.setFromMatrixPosition(camera.matrixWorld);
      g.getWorldPosition(centro);
      lejos.value = Math.hypot(camPos.x - centro.x, camPos.z - centro.z) > 80 ? 1 : 0;
    };
    esc.add(borrar);
    // los mandos de VR se dibujan después del hueco para que no se borren al pasar sobre el agua
    for (const p of kit.input.controllers || []) p.controller.traverse((o) => { if (o.isMesh && !o.material.transparent && o.renderOrder < 3) o.renderOrder = 3; });

    // fondo de barro: orilla expuesta más clara, fondo sumergido más oscuro
    const usFondo = [1, 0.985, 0.97, 0.955, 0.94, 0.92, 0.89, 0.85, 0.79, 0.71, 0.6, 0.47, 0.32, 0.16, 0];
    const geoFondo = radial((a, R) => usFondo.map((u) => u * R), (x, z, d) => {
      const y = fondo(d, x, z), seco = sstep(YA - 0.02, YA + 0.3, y), mancha = 0.85 + 0.15 * Math.sin(x * 1.3 + 0.4) * Math.sin(z * 1.1 - 0.8);
      const k = (0.42 + 0.33 * seco) * mancha, verde = 1 - seco;
      return { y, c: [0.6 * k, (0.56 + 0.08 * verde) * k, 0.4 * k] };
    });
    const lodo = kit.mat('soil', { repeat: [1, 1], color: 0xb19c80, roughness: 1, normalScale: 0.9 });
    lodo.vertexColors = true;
    const cuenco = kit.malla(geoFondo, lodo, { padre: esc });
    cuenco.renderOrder = 2;

    // ------------------------------------------------------------ agua
    const nrmAgua = kit.makeSurface('noiseNormal', { size: 256, seed: 41, repeat: [1, 1], roughness: false }).normalMap;
    const usAgua = [1, 0.97, 0.94, 0.9, 0.85, 0.78, 0.7, 0.6, 0.48, 0.34, 0.18, 0];
    const somero = new THREE.Color(0.16, 0.21, 0.14), hondo = new THREE.Color(0.03, 0.08, 0.085), cc = new THREE.Color();
    const geoAgua = radial((a, R) => usAgua.map((u) => u * (R - 0.45)), (x, z, d) => {
      const prof = YA - fondo(d, x, z), t = sstep(0, 1.0, prof);
      cc.copy(somero).lerp(hondo, t);
      return { y: YA, c: [cc.r, cc.g, cc.b, 0.24 + 0.7 * t] };
    });
    const uAgua = {
      uCentro: { value: new THREE.Vector2(P.x, P.z) }, uR: { value: 0 }, uA: { value: 0 }, uK: { value: TAU / 0.24 }, uL: { value: 0.5 },
      uAncho: { value: 0.055 }, uColAro: { value: new THREE.Color(0xffa02e) }, uColArea: { value: new THREE.Color(0x5cc8ff) },
    };
    const aguaMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.05, metalness: 0, normalMap: nrmAgua, normalScale: new THREE.Vector2(0.16, 0.16), envMapIntensity: 2.6 });
    aguaMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uAgua);
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'varying vec2 vPosL;\nvarying vec3 vAxX;\nvarying vec3 vAxZ;\nvoid main() {')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
  vPosL = position.xz;
  vAxX = normalize((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vAxZ = normalize((modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', `uniform vec2 uCentro;
uniform float uR, uA, uK, uL, uAncho;
uniform vec3 uColAro, uColArea;
varying vec2 vPosL;
varying vec3 vAxX;
varying vec3 vAxZ;
void main() {`)
        .replace('#include <color_fragment>', `#include <color_fragment>
  vec2 dOnda = vPosL - uCentro;
  float rho = length(dOnda);
  float sO = uR - rho;
  float fwO = max(fwidth(rho), 1e-4);
  float hay = step(0.002, uR);
  float dentro = hay * smoothstep(-fwO, fwO, sO);
  float aro = hay * (1.0 - smoothstep(uAncho * 0.5, uAncho * 0.5 + 1.5 * fwO, abs(sO)));
  diffuseColor.rgb = mix(diffuseColor.rgb, uColArea * 0.4, dentro * 0.22);
  diffuseColor.rgb = mix(diffuseColor.rgb, uColAro, aro);
  diffuseColor.a = max(diffuseColor.a, max(dentro * 0.6, aro));
  float cresta = 0.0;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.85, aro);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (uA > 0.0) {
    float dfds, fs;
    if (sO >= 0.0) { float e = exp(-sO / uL); fs = uA * e * cos(uK * sO); dfds = uA * e * (-uK * sin(uK * sO) - cos(uK * sO) / uL); }
    else { float q = sO / 0.035; fs = uA * exp(-q * q); dfds = fs * (-2.0 * sO / (0.035 * 0.035)); }
    vec2 grad = -dfds * dOnda / max(rho, 1e-4);
    normal = normalize(normal - (grad.x * vAxX + grad.y * vAxZ));
    cresta = max(fs, 0.0) / 0.02;
  }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += uColArea * dentro * 0.06 + vec3(0.55, 0.65, 0.7) * cresta * 0.1 + uColAro * aro * 0.55;`);
    };
    const agua = kit.malla(geoAgua, aguaMat, { padre: esc, sombra: false, recibe: false });
    agua.renderOrder = 2;

    // lámina de agua a ras de suelo para cuando se mira desde lejos
    const aguaLejosMat = new THREE.MeshStandardMaterial({ color: 0x1b302f, roughness: 0.12, metalness: 0, envMapIntensity: 1.8, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    aguaLejosMat.onBeforeCompile = (sh) => {
      sh.uniforms.uLejos = lejos;
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uLejos;\nvoid main() {\n  if (uLejos < 0.5) discard;');
    };
    kit.malla(radial((a, R) => [R - 0.15, 0], () => ({ y: 0.012 })), aguaLejosMat, { padre: esc, sombra: false, recibe: false });

    // ------------------------------------------------------------ orilla con pasto que se funde con el suelo
    const anchoOrilla = (a) => 4.4 + 0.9 * Math.sin(3 * a + 1.1) + 0.5 * Math.sin(7 * a + 0.3);
    const geoOrilla = radial((a, R) => {
      const w = anchoOrilla(a);
      return [1, 0.78, 0.56, 0.38, 0.22, 0.1, 0.035, 0].map((f) => R + w * f);
    }, (x, z, d, a) => {
      const e = -d, w = anchoOrilla(a);
      const barro = (1 - sstep(0.02, 0.45 + 0.35 * Math.sin(a * 9 + 1.7) ** 2, e)) * 0.8, tono = 0.9 + 0.1 * Math.sin(x * 0.7) * Math.sin(z * 0.5);
      const bajoMuelle = Math.abs(x) < 1.6 && z > R0 - 1 && e > 0.05; // el pasto queda bajo las tablas del muelle
      return { y: bajoMuelle ? 0.008 : 0.012 + 0.038 * (1 - sstep(0, 3.2, e)), c: [tono * (1 - barro * 0.4), tono * (1 - barro * 0.45), tono * (1 - barro * 0.55), 1 - sstep(w * 0.72, w, e)] };
    });
    const pasto = kit.mat('grass', { repeat: [1, 1], color: 0xc6cfa6, normalScale: 0.8 });
    pasto.vertexColors = true; pasto.alphaHash = true;
    pasto.polygonOffset = true; pasto.polygonOffsetFactor = -4; pasto.polygonOffsetUnits = -4;
    kit.malla(geoOrilla, pasto, { padre: esc, sombra: false });

    // sendero de grava desde el borde del pasto hasta el muelle
    const grava = kit.mat('gravel', { repeat: [1, 2.6], color: 0x9a907f, roughness: 1, normalScale: 0.6 });
    grava.polygonOffset = true; grava.polygonOffsetFactor = -8; grava.polygonOffsetUnits = -8;
    kit.malla(new THREE.PlaneGeometry(2.4, 6.8), grava, { rx: -Math.PI / 2, y: 0.03, z: Z_INI + 3.42, sombra: false, padre: esc });

    // ------------------------------------------------------------ muelle de madera
    const madera = kit.mat('wood', { repeat: [1, 1], color: 0xc2ab8a, roughness: 0.92, normalScale: 0.9 });
    const maderaOsc = kit.mat('wood', { repeat: [1, 1], color: 0x7d6650, roughness: 0.95, normalScale: 1 });
    const tablaGeo = new THREE.BoxGeometry(1.9, 0.035, 0.145);
    { // la veta corre a lo largo de cada tabla y cada tabla muestra un solo listón de la textura
      const uv = tablaGeo.attributes.uv;
      for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v / 6 + 0.02, u * 0.7); }
    }
    const nTablas = Math.floor((Z_INI - Z_FIN) / 0.157);
    const tablas = new THREE.InstancedMesh(tablaGeo, madera, nTablas);
    {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      for (let i = 0; i < nTablas; i++) {
        e.set(0, (rnd() - 0.5) * 0.012, 0); q.setFromEuler(e);
        m4.compose(new THREE.Vector3((rnd() - 0.5) * 0.02, 0.0525 + (rnd() - 0.5) * 0.004, Z_FIN + 0.08 + i * 0.157), q, new THREE.Vector3(1, 1, 1));
        tablas.setMatrixAt(i, m4);
        const k = 0.8 + rnd() * 0.25; tablas.setColorAt(i, c.setRGB(k, k * 0.98, k * 0.95));
      }
    }
    tablas.castShadow = true; tablas.receiveShadow = true; esc.add(tablas);
    const largoMuelle = Z_INI - Z_FIN;
    for (const x of [-0.75, 0.75]) kit.caja(0.08, 0.2, largoMuelle, maderaOsc, { x, y: -0.065, z: (Z_INI + Z_FIN) / 2, padre: esc });
    const filas = [Z_FIN + 0.15, Z_FIN + 2.6, Z_FIN + 5.05];
    const pernos = [];
    for (const z of filas) {
      kit.caja(2.0, 0.16, 0.1, maderaOsc, { y: -0.25, z, padre: esc });
      for (const x of [-0.86, 0.86]) {
        const dz = R0 - z, yb = fondo(dz, x, z) - 0.25, alto = z === filas[0] ? 0.75 : 0.0;
        const pil = kit.cilindro(0.095, 0.095, alto - yb, maderaOsc, { x, y: (alto + yb) / 2, z, seg: 14, padre: esc });
        void pil;
        if (alto > 0) kit.cilindro(0.1, 0.07, 0.05, maderaOsc, { x, y: alto + 0.02, z, seg: 14, padre: esc });
        pernos.push([x + Math.sign(x) * -0.095, -0.065, z + 0.04], [x + Math.sign(x) * -0.095, -0.25, z - 0.03]);
      }
    }
    {
      const acero = new THREE.MeshStandardMaterial({ color: 0x8e959b, metalness: 0.8, roughness: 0.4 });
      const pg = new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8); pg.rotateZ(Math.PI / 2);
      const inst = new THREE.InstancedMesh(pg, acero, pernos.length);
      const m4 = new THREE.Matrix4();
      pernos.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); inst.setMatrixAt(i, m4); });
      esc.add(inst);
      // escalerilla de baño en el extremo del muelle
      for (const x of [0.38, 0.72]) {
        const cur = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, 0.07, Z_FIN + 0.35), new THREE.Vector3(x, 0.62, Z_FIN + 0.33), new THREE.Vector3(x, 0.82, Z_FIN + 0.12),
          new THREE.Vector3(x, 0.62, Z_FIN - 0.12), new THREE.Vector3(x, 0.1, Z_FIN - 0.14), new THREE.Vector3(x, -1.1, Z_FIN - 0.14),
        ], false, 'catmullrom', 0.2);
        kit.malla(new THREE.TubeGeometry(cur, 40, 0.021, 8, false), acero, { padre: esc });
      }
      for (const y of [-0.25, -0.55, -0.85]) kit.caja(0.36, 0.025, 0.07, acero, { x: 0.55, y, z: Z_FIN - 0.14, padre: esc });
    }
    // estribo de hormigón en la orilla
    kit.caja(2.4, 0.73, 1.7, kit.mat('concrete', { repeat: [1, 0.5], color: 0xa8a39a }), { y: -0.535, z: R0 - 0.25, padre: esc });

    // ------------------------------------------------------------ piedras de la orilla
    const rocaGeo = new THREE.IcosahedronGeometry(1, 1);
    {
      const p = rocaGeo.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = 1 + 0.16 * Math.sin(v.x * 3.1 + v.y * 1.7) + 0.1 * Math.sin(v.z * 4.3 - v.x * 2.2) + 0.06 * Math.sin(v.y * 7.1 + v.z * 3.3);
        v.multiplyScalar(n); v.y *= 0.62; p.setXYZ(i, v.x, v.y, v.z);
      }
      rocaGeo.computeVertexNormals();
    }
    const rocaMat = kit.mat('concrete', { repeat: [0.7, 0.7], color: 0x958f82, roughness: 1, normalScale: 1.3 });
    const rocas = [];
    while (rocas.length < 84) {
      const a = rnd() * TAU;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.16) continue; // el muelle
      const grande = rocas.length < 9;
      const d = grande ? -1.2 - rnd() * 1.6 : -0.7 + rnd() * 1.5, sz = grande ? 0.55 + rnd() * 0.45 : 0.12 + rnd() * rnd() * 0.42;
      const [x, z] = enOrilla(a, d), y = (d > 0 ? fondo(d, x, z) : 0.04) - sz * 0.22;
      rocas.push({ x, y, z, sz });
    }
    const rocasInst = new THREE.InstancedMesh(rocaGeo, rocaMat, rocas.length);
    {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      rocas.forEach((r, i) => {
        e.set((rnd() - 0.5) * 0.4, rnd() * TAU, (rnd() - 0.5) * 0.4); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(r.x, r.y, r.z), q, new THREE.Vector3(r.sz * (0.9 + rnd() * 0.4), r.sz * (0.7 + rnd() * 0.5), r.sz * (0.8 + rnd() * 0.4)));
        rocasInst.setMatrixAt(i, m4);
        const k = 0.75 + rnd() * 0.35; rocasInst.setColorAt(i, c.setRGB(k, k * (0.95 + rnd() * 0.05), k * (0.88 + rnd() * 0.1)));
      });
    }
    rocasInst.castShadow = true; rocasInst.receiveShadow = true; esc.add(rocasInst);

    // ------------------------------------------------------------ juncos, totoras y matas de pasto (se mecen con el viento)
    const uT = { value: 0 };
    const mecer = () => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uT = uT;
        sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uT;\nvoid main() {').replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float fase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.9;
#else
  float fase = 0.0;
#endif
  float kv = position.y * position.y * 0.03;
  transformed.x += sin(uT * 1.3 + fase) * kv;
  transformed.z += cos(uT * 1.05 + fase * 1.3) * kv * 0.6;`);
      };
      return m;
    };
    function mata(nHojas, alto, ancho, base, punta, cabezas = 0, segs = 3) {
      const pos = [], col = [];
      const pushV = (p, c) => { pos.push(p[0], p[1], p[2]); col.push(c[0], c[1], c[2]); };
      const lin = (v) => Math.pow(v, 2.2); // los colores de vértice van en espacio lineal
      const tono = (t) => [0, 1, 2].map((i) => lin(base[i] + (punta[i] - base[i]) * t));
      for (let i = 0; i < nHojas; i++) {
        const ang = rnd() * TAU, off = rnd() * 0.16, bx = Math.cos(ang) * off, bz = Math.sin(ang) * off;
        const h = alto * (0.55 + rnd() * 0.5), lean = 0.08 + rnd() * 0.3, dA = rnd() * TAU, w = ancho * (0.7 + rnd() * 0.6);
        const px = -Math.sin(dA), pz = Math.cos(dA);
        let prev = null;
        for (let k = 0; k <= segs; k++) {
          const t = k / segs, y = h * t, b = lean * t * t * h, cx = bx + Math.cos(dA) * b, cz = bz + Math.sin(dA) * b, ww = w * (1 - t);
          const L = [cx - px * ww, y, cz - pz * ww], Rr = [cx + px * ww, y, cz + pz * ww];
          if (prev) {
            const c0 = tono((k - 1) / segs), c1 = tono(t);
            if (k === segs) { pushV(prev.L, c0); pushV(prev.R, c0); pushV([cx, y, cz], c1); } // punta
            else { pushV(prev.L, c0); pushV(prev.R, c0); pushV(Rr, c1); pushV(prev.L, c0); pushV(Rr, c1); pushV(L, c1); }
          }
          prev = { L, R: Rr };
        }
      }
      const geos = [];
      for (let i = 0; i < cabezas; i++) { // tallos de totora con su espiga café
        const h = alto * (0.85 + rnd() * 0.3), bx = (rnd() - 0.5) * 0.2, bz = (rnd() - 0.5) * 0.2;
        const tallo = new THREE.CylinderGeometry(0.006, 0.009, h, 4, 1, true).translate(bx, h / 2, bz).toNonIndexed();
        const esp = new THREE.CylinderGeometry(0.024, 0.024, 0.2, 6).translate(bx, h - 0.16, bz).toNonIndexed();
        for (const [gg, c] of [[tallo, tono(0.5)], [esp, [0.12, 0.05, 0.02]]]) {
          const pa = gg.attributes.position;
          for (let j = 0; j < pa.count; j++) pushV([pa.getX(j), pa.getY(j), pa.getZ(j)], c);
          geos.push(gg);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      for (const gg of geos) gg.dispose();
      return geo;
    }
    const juncoGeo = mata(14, 1.7, 0.017, [0.22, 0.27, 0.12], [0.56, 0.58, 0.32]);
    const totoraGeo = mata(10, 1.9, 0.021, [0.2, 0.27, 0.11], [0.5, 0.55, 0.28], 3);
    const champaGeo = mata(9, 0.42, 0.013, [0.22, 0.3, 0.1], [0.48, 0.56, 0.24], 0, 2);
    const matMecer = mecer();
    function plantar(geo, n, elegir) {
      const inst = new THREE.InstancedMesh(geo, matMecer, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      let k = 0, intentos = 0;
      while (k < n && intentos < n * 40) {
        intentos++;
        const p = elegir();
        if (!p) continue;
        const sc = p.sc ?? 0.8 + rnd() * 0.45;
        e.set(0, rnd() * TAU, 0); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(sc, sc * (0.85 + rnd() * 0.3), sc));
        inst.setMatrixAt(k++, m4);
      }
      inst.count = k; inst.castShadow = true; inst.receiveShadow = true; esc.add(inst);
      return inst;
    }
    // juncales en algunos tramos de la orilla, en el agua poco profunda
    const tramos = [[1.3, 2.3], [2.7, 3.3], [3.75, 4.6], [4.95, 5.45], [5.7, 5.95]];
    const enJuncal = () => {
      const tr = tramos[Math.floor(rnd() * tramos.length)], a = tr[0] + rnd() * (tr[1] - tr[0]), d = 0.55 + rnd() * 1.7;
      const [x, z] = enOrilla(a, d); return { x, y: fondo(d, x, z), z };
    };
    plantar(juncoGeo, 115, enJuncal);
    plantar(totoraGeo, 42, enJuncal);
    plantar(champaGeo, 175, () => {
      const a = rnd() * TAU, d = -0.06 - rnd() * rnd() * 3.8;
      const [x, z] = enOrilla(a, d);
      if (Math.abs(x) < 1.7 && z > R0 - 1) return null; // sendero y muelle
      return { x, y: 0.03, z, sc: 0.7 + rnd() * 0.7 };
    });

    // ------------------------------------------------------------ árboles (sauces) en la orilla del fondo
    {
      const parts = [];
      const add = (geo, hex, x, y, z) => {
        geo = geo.index ? geo.toNonIndexed() : geo; geo.translate(x, y, z);
        const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { const k = 0.9 + rnd() * 0.18; a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
        geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); geo.deleteAttribute('uv'); parts.push(geo);
      };
      add(new THREE.CylinderGeometry(0.26, 0.42, 3.4, 8), 0x5a4634, 0, 1.7, 0);
      add(new THREE.CylinderGeometry(0.12, 0.2, 2.2, 6).rotateZ(0.6), 0x5a4634, -0.6, 3.6, 0);
      add(new THREE.CylinderGeometry(0.12, 0.2, 2.2, 6).rotateZ(-0.55), 0x5a4634, 0.6, 3.7, 0.1);
      const copa = (r, x, y, z, sy, hex) => { const geo = new THREE.IcosahedronGeometry(r, 1); geo.scale(1, sy, 1); add(geo, hex, x, y, z); };
      copa(2.6, 0, 5.2, 0, 0.8, 0x5f7f3a);
      copa(1.9, -1.6, 4.4, 0.6, 1.25, 0x6c8a43);
      copa(1.9, 1.6, 4.3, -0.5, 1.3, 0x587a37);
      copa(1.7, 0.4, 4.0, 1.6, 1.35, 0x648440);
      copa(1.7, -0.4, 4.1, -1.7, 1.3, 0x5b7c38);
      const arbol = kit.mergeGeometries(parts);
      const arboles = new THREE.InstancedMesh(arbol, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), 3);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      [[2.55, -3.6, 1.05], [3.55, -3.2, 0.9], [-2.0, -3.4, 1.0]].forEach(([a, d, sc], i) => {
        const [x, z] = enOrilla(a, d); q.setFromEuler(new THREE.Euler(0, a * 3, 0));
        m4.compose(new THREE.Vector3(x, -0.05, z), q, new THREE.Vector3(sc, sc, sc)); arboles.setMatrixAt(i, m4);
      });
      arboles.castShadow = true; arboles.receiveShadow = true; esc.add(arboles);
    }

    // ------------------------------------------------------------ persona de referencia (1,75 m) en la orilla
    {
      const persona = new THREE.Group();
      const m = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
      const camisa = m(0x7a4a3a), pantalon = m(0x2f3a4a), piel = m(0xc9a07a, 0.7), zap = m(0x2a2522, 0.6), pelo = m(0x2b211b, 0.9);
      for (const sx of [-0.1, 0.1]) {
        kit.malla(new THREE.CapsuleGeometry(0.07, 0.72, 4, 10), pantalon, { x: sx, y: 0.47, padre: persona });
        kit.caja(0.11, 0.07, 0.27, zap, { x: sx, y: 0.035, z: 0.04, padre: persona });
      }
      const torso = kit.malla(new THREE.CapsuleGeometry(0.17, 0.42, 4, 14), camisa, { y: 1.18, padre: persona });
      torso.scale.set(1, 1, 0.68);
      for (const sx of [-1, 1]) {
        kit.malla(new THREE.CapsuleGeometry(0.05, 0.56, 4, 8), camisa, { x: sx * 0.235, y: 1.13, rz: sx * 0.1, padre: persona });
        kit.malla(new THREE.SphereGeometry(0.048, 10, 8), piel, { x: sx * 0.27, y: 0.79, padre: persona });
      }
      kit.malla(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), piel, { y: 1.52, padre: persona });
      const cabeza = kit.malla(new THREE.SphereGeometry(0.105, 18, 14), piel, { y: 1.635, padre: persona });
      cabeza.scale.set(1, 1.12, 1);
      const pel = kit.malla(new THREE.SphereGeometry(0.11, 18, 10, 0, TAU, 0, 1.5), pelo, { y: 1.66, z: -0.008, padre: persona });
      pel.scale.set(1, 1.08, 1.04);
      const a = -0.98, [x, z] = enOrilla(a, -1.1);
      persona.position.set(x, 0.03, z); persona.rotation.y = Math.atan2(-x, -z) + 0.35;
      esc.add(persona);
    }

    // ------------------------------------------------------------ piedra, salpicadura y espuma
    const piedra = kit.malla(rocaGeo, rocaMat, { padre: esc });
    piedra.scale.set(0.075, 0.065, 0.06); piedra.visible = false;
    const Q = new THREE.Vector3(VR[0] + 0.32, 1.25, VR[2] - 0.45); // la piedra sale de la mano de quien mira
    const V0 = new THREE.Vector3().subVectors(P, Q).divideScalar(T_VUELO); V0.y += 0.5 * 9.81 * T_VUELO;
    const blanco = new THREE.MeshStandardMaterial({ color: 0xe9f1f4, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.85, depthWrite: false });
    const nGotas = 26, gotas = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), blanco, nGotas);
    gotas.frustumCulled = false; esc.add(gotas);
    const gotaDat = Array.from({ length: nGotas }, () => ({ a: rnd() * TAU, vh: 0.35 + rnd() * 0.85, vy: 1.2 + rnd() * 1.5, r: 0.009 + rnd() * 0.016 }));
    const coronaMat = blanco.clone();
    const corona = kit.malla(new THREE.CylinderGeometry(1, 0.75, 1, 28, 1, true), coronaMat, { padre: esc, sombra: false });
    coronaMat.side = THREE.DoubleSide;
    const chorro = kit.malla(new THREE.CylinderGeometry(0.014, 0.03, 1, 10), blanco, { padre: esc, sombra: false });
    const espumaTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      x.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 160; i++) { x.beginPath(); x.arc(rnd() * 128, rnd() * 128, 1 + rnd() * 5, 0, TAU); x.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.6})`; x.fill(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const espumaMat = new THREE.MeshStandardMaterial({ map: espumaTex, transparent: true, roughness: 0.6, depthWrite: false });
    const espuma = kit.malla(new THREE.CircleGeometry(1, 32), espumaMat, { rx: -Math.PI / 2, x: P.x, y: YA + 0.004, z: P.z, padre: esc, sombra: false });
    espuma.renderOrder = 4; corona.renderOrder = 4; chorro.renderOrder = 4; gotas.renderOrder = 4;
    const m4 = new THREE.Matrix4(), qI = new THREE.Quaternion(), vS = new THREE.Vector3(), vP = new THREE.Vector3();

    function salpicar(tau) {
      // gotas en vuelo libre
      let alguna = false;
      gotaDat.forEach((d, i) => {
        const y = YA + d.vy * tau - 4.905 * tau * tau, ok = tau > 0 && y > YA - 0.01;
        vP.set(P.x + Math.cos(d.a) * d.vh * tau, y, P.z + Math.sin(d.a) * d.vh * tau);
        vS.setScalar(ok ? d.r : 0);
        m4.compose(vP, qI, vS); gotas.setMatrixAt(i, m4);
        alguna = alguna || ok;
      });
      gotas.instanceMatrix.needsUpdate = true; gotas.visible = alguna;
      // corona de agua y chorro central
      const tc = tau / 0.42;
      corona.visible = tau > 0 && tc < 1;
      if (corona.visible) { const hc = 0.16 * Math.sin(Math.PI * Math.min(1, tc * 1.4)) + 0.01, rc = 0.05 + 0.32 * tau; corona.scale.set(rc, hc, rc); corona.position.set(P.x, YA + hc / 2, P.z); coronaMat.opacity = 0.75 * (1 - tc); }
      const tj = (tau - 0.16) / 0.62;
      chorro.visible = tj > 0 && tj < 1;
      if (chorro.visible) { const hj = 0.3 * Math.sin(Math.PI * tj) + 0.01; chorro.scale.set(1, hj, 1); chorro.position.set(P.x, YA + hj / 2, P.z); }
      espuma.visible = tau > 0 && tau < 3;
      if (espuma.visible) { const re = 0.1 + 0.22 * Math.sqrt(tau); espuma.scale.set(re, re, 1); espumaMat.opacity = 0.9 * (1 - tau / 3); }
    }

    // ------------------------------------------------------------ cotas y rótulos sobre el agua
    const naranja = new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false });
    const cotaR = kit.barra([0, 0, 0], [0, 1, 0], 0.012, naranja); esc.add(cotaR);
    const centroMarca = kit.malla(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16), naranja, { x: P.x, y: YA + 0.008, z: P.z, padre: esc, sombra: false });
    void centroMarca;
    const lr = kit.etiqueta('r', 0.24, { bg: '#ffb347', color: '#1a1206' });
    const lA = kit.etiqueta('A', 0.24, { bg: '#5cc8ff', color: '#08202c' });
    esc.add(lr, lA);

    function escena3D() {
      const t = reloj.t, rm = M.r(t) * PIE;
      uAgua.uR.value = rm;
      uAgua.uA.value = rm > 0 ? 0.02 * (0.35 + 0.65 / Math.sqrt(1 + 2.5 * rm)) : 0;
      uAgua.uL.value = 0.32 + 0.1 * rm;
      cotaR.visible = rm > 0.03;
      if (cotaR.visible) kit.moverBarra(cotaR, [P.x, YA + 0.016, P.z], [P.x + rm, YA + 0.016, P.z]);
      salpicar(s.lanzando ? -1 : t);
    }
    function rotulos() {
      const t = reloj.t, r = M.r(t), rm = r * PIE;
      lr.visible = rm > 0.2; lA.visible = rm > 0.32;
      kit.cambiarEtiqueta(lr, `r = ${kit.num(r, 1)} pies`); lr.position.set(P.x + rm / 2 + 0.05, YA + 0.24, P.z + 0.05);
      kit.cambiarEtiqueta(lA, `A = ${kit.num(M.area(t), 1)} pies²`); lA.position.set(P.x - Math.min(rm * 0.45, 0.9), YA + 0.42, P.z - Math.min(rm * 0.4, 0.8));
    }

    // ------------------------------------------------------------ lanzamiento
    function colocarPiedra(tau) {
      piedra.visible = true;
      piedra.position.set(Q.x + V0.x * tau, Q.y + V0.y * tau - 4.905 * tau * tau, Q.z + V0.z * tau);
      piedra.rotation.set(tau * 9, tau * 5, 0);
    }
    function lanzar() { s.lanzando = true; s.tau = 0; reloj.fijar(0); colocarPiedra(0); }
    function cancelar() { if (s.lanzando) { s.lanzando = false; piedra.visible = false; } }
    function fijarT(v) { cancelar(); reloj.fijar(v); }
    function alternar() { if (s.lanzando) return; reloj.alternar(); }
    function irInstante() { cancelar(); reloj.alInstante(); }

    // ------------------------------------------------------------ gráfico A(t)
    const graf = kit.grafico({
      f: (t) => M.area(t), x0: 0, x1: 12, y0: 0, y1: 460, width: 1.3, height: 0.8,
      xTicks: [0, 2, 4, 6, 8, 10, 12], yTicks: [0, 100, 200, 300, 400],
      xLabel: 'tiempo t (s)', yLabel: 'área A (pies²)', curveColor: 0x5cc8ff,
    });
    graf.group.position.set(0.6, 1.05, VR[2] - 1.65); graf.group.rotation.y = -0.42;
    esc.add(graf.group);
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => fijarT(graf.xFromLocal(p.x)) });
    function grafico() {
      graf.setMarker(reloj.t);
      graf.setTangent(reloj.t, M.dAdt(reloj.t), { color: 0xffd08a, len: 0.42 });
    }
    function revelar() {
      graf.removePoint('inst');
      if (s.revelar) graf.addPoint('inst', M.instante, M.area(M.instante), { color: 0x6fe3a2, labelX: 't = 4 s', labelY: '16π' });
      s.ultimo = -1;
    }

    // ------------------------------------------------------------ panel
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'Una piedra cae en un lago en calma y forma ondas circulares. El radio r del círculo exterior crece a 1 pie/s. Interesa el instante en que r = 4 pies.',
      ecuaciones: ['A = πr²   ⇒   dA/dt = 2πr · dr/dt', 'dr/dt = 1 pie/s,   r(t) = t pies'],
      lecturas: [
        { etiqueta: 'tiempo t', valor: () => `${kit.num(reloj.t, 2)} s`, color: '#dfe9f4' },
        { etiqueta: 'radio r', valor: () => `${kit.num(M.r(reloj.t), 2)} pies`, color: '#ffb347', escala: 0.72 },
        { etiqueta: 'área A = πr²', valor: () => `${kit.num(M.area(reloj.t), 2)} pies²`, color: '#5cc8ff', escala: 0.64 },
        { etiqueta: 'dr/dt', valor: () => `${kit.num(M.drdt, 2)} pie/s`, color: '#ffb347', escala: 0.68 },
        { etiqueta: 'dA/dt = 2πr · dr/dt', valor: () => `${kit.num(M.dAdt(reloj.t), 2)} pies²/s`, color: '#5cc8ff', escala: 0.6 },
        { etiqueta: 'r en metros', valor: () => `${kit.num(M.r(reloj.t) * PIE, 2)} m`, color: '#9fb4c8', escala: 0.72 },
      ],
      deslizadores: [{ etiqueta: 'Tiempo t', min: 0, max: 12, paso: 0.01, get: () => reloj.t, set: (v) => fijarT(v), formato: (v) => `${kit.num(v, 2)} s` }],
      botones: [
        { etiqueta: 'Lanzar la piedra', accion: lanzar },
        { etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: alternar },
        { etiqueta: 'Ir a r = 4 pies', accion: irInstante },
        { etiqueta: 'Revelar respuesta', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      botonesPorFila: 2,
      pie: () => (s.revelar
        ? 'Con r = 4 pies y dr/dt = 1 pie/s: dA/dt = 2π·4·1 = 8π ≈ 25,13 pies²/s. Es la pendiente de la tangente a A(t) en t = 4 s: el área crece cada vez más rápido aunque el radio crezca a ritmo constante.'
        : 'El círculo naranjo es el frente de la onda, de radio r(t), y la capa celeste es el área A que encierra. Lanza la piedra o mueve el tiempo: la pendiente de la tangente a A(t) es dA/dt.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-1.35, 1.38, VR[2] - 1.4); panel.mesh.rotation.y = 0.5;
    esc.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    // todo lo que está sobre el hueco se dibuja después del fondo
    esc.traverse((o) => { if ((o.isMesh || o.isLine) && o.renderOrder === 0) o.renderOrder = 3; });

    let tiempo = 0;
    return {
      paneles: [panel],
      radioSombra: 21,
      alturaCartel: 5.2,
      vista: {
        escritorio: { camara: aGrupo([0.6, 7.6, 13.4]), objetivo: aGrupo([0, -0.4, P.z - 0.6]) },
        vr: { pos: aGrupo(VR), yaw: giro },
      },
      dom: [
        { tipo: 'boton', etiqueta: 'Lanzar la piedra', accion: lanzar },
        { tipo: 'boton', etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: alternar },
        { tipo: 'rango', etiqueta: 't', min: 0, max: 12, paso: 0.01, get: () => reloj.t, set: (v) => fijarT(v), formato: (v) => `${kit.num(v, 2)} s` },
        { tipo: 'boton', etiqueta: 'Ir a r = 4 pies', accion: irInstante },
        { tipo: 'interruptor', etiqueta: 'Revelar respuesta', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      actualizar(dt, activa) {
        tiempo += dt; uT.value = tiempo;
        nrmAgua.offset.set(tiempo * 0.011, tiempo * 0.007);
        if (activa && s.primera) { s.primera = false; lanzar(); }
        if (s.lanzando) {
          s.tau += dt;
          if (s.tau >= T_VUELO) { s.lanzando = false; piedra.visible = false; reloj.reiniciar(); } else colocarPiedra(s.tau);
        }
        if (activa) reloj.tick(dt);
        s.refresco -= dt;
        if (s.ultimo !== reloj.cambio) {
          s.ultimo = reloj.cambio;
          escena3D();
          if (!reloj.corriendo || s.refresco <= 0) { s.refresco = 0.1; rotulos(); grafico(); }
          panel.invalidate();
        }
      },
    };
  },
};
