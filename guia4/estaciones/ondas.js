// Ejemplo 6. Una piedra cae en un lago en calma: el radio de la onda exterior crece a 1 pie/s.
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ONDAS as M } from '../../src/math/guia4.js';

// La derivada que pide el problema queda oculta en el panel hasta que se activa «Revelar respuesta»
const OCULTO = '? (revela)';

const PIE = 0.3048;   // metros por pie
const YA = -0.36;     // nivel del agua: el estanque está excavado bajo el suelo del mundo (y = 0)
const TAU = Math.PI * 2;
const NA = 120;       // divisiones del contorno de la orilla
const CUB = 0.07;     // altura de la cubierta del muelle
const SUELTA = 0.72;  // instante del gesto en que la piedra deja la mano (la mano va hacia adelante)
const TOMA = 1.95;    // instante en que la mano derecha toma otra piedra de la izquierda
const ELEV = 0.5;     // ángulo de salida de la piedra sobre la horizontal (rad)
// Revisión de capturas: rev=lanzar:s detiene el gesto (y luego el vuelo y la onda) en ese instante; rev=t:s fija el reloj
const REV = Object.fromEntries((new URLSearchParams(globalThis.location?.search || '').get('rev') || '').split(',').map((p) => p.split(':')).filter(([k, v]) => k && Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]));

const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// Radio de la orilla según el ángulo a (a = 0 apunta hacia el muelle, +z de la escena)
const orilla = (a) => 14.2 + 1.1 * Math.sin(2 * a + 0.9) + 0.6 * Math.sin(3 * a + 2.3) + 0.35 * Math.sin(5 * a + 0.4) + 0.2 * Math.sin(7 * a + 1.3);
// Relieve suave del fondo
const ondulacion = (x, z) => 0.12 * Math.sin(0.43 * x + 1.3) * Math.sin(0.37 * z + 0.4) + 0.06 * Math.sin(0.9 * x - 0.7 * z + 2.0);
// Altura del terreno a la distancia d de la orilla, medida hacia el centro del estanque
const fondo = (d, x = 0, z = 0) => 0.05 - 0.5 * sstep(0, 1.3, d) - 1.15 * sstep(1, 7.5, d) + ondulacion(x, z) * sstep(0.8, 3, d);
const fondoEn = (x, z) => fondo(orilla(Math.atan2(x, z)) - Math.hypot(x, z), x, z);
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

// Lanzamiento: las claves de kit.CLIPS.lanzar con la cabeza libre (la mirada la pone h.mirar sobre el punto de caída) y la mano
// izquierda cerrada sobre las piedras de reserva; al final las manos se juntan y la derecha toma otra piedra.
function clipLanzar(kit) {
  const libre = (p) => {
    const q = { ...p };
    for (const k of ['cuello', 'cabeza']) if (q[k]) q[k] = [q[k][0], 0, q[k][2]];
    q.dedosI = Math.max(0.8, typeof q.dedosI === 'number' ? q.dedosI : 0);
    return q;
  };
  const claves = kit.CLIPS.lanzar.claves.filter((k) => k.t <= 1.15).map((k) => ({ t: k.t, pose: libre(k.pose) }));
  const lista = claves[0].pose;
  const juntas = { ...lista, columna: [0.08, 0, 0], cuello: [0.2, 0, 0], ikD: { p: [-0.05, 0.99, 0.29], polo: [-1, -0.6, -0.3] }, ikI: { p: [0.07, 0.97, 0.27], polo: [1, -0.6, -0.3] }, dedosD: 0.25 };
  claves.push({ t: 1.75, pose: juntas }, { t: 2.05, pose: { ...juntas, dedosD: 0.85 } }, { t: 2.6, pose: lista });
  return { duracion: 2.6, eventos: { suelta: SUELTA, toma: TOMA }, claves, lista };
}

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
    const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const texDe = (c, repetir = true) => {
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    // color de vértice uniforme (con una leve variación) para unir piezas de distinto color en una sola malla
    const pintar = (geo, hex, vari = 0) => {
      const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const k = 1 + (rnd() - 0.5) * vari; a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return geo;
    };
    const mover = (geo, x, y, z) => { geo.translate(x, y, z); return geo; };

    // La escena se gira para que el muelle quede en la prolongación del sendero que llega desde la plaza
    const plaza = g.worldToLocal(new THREE.Vector3(0, 0, 0));
    const giro = Math.atan2(plaza.x, plaza.z);
    const esc = new THREE.Group(); esc.rotation.y = giro; g.add(esc);
    const aGrupo = (v) => { const p = new THREE.Vector3(...v).applyEuler(esc.rotation).add(esc.position); return [p.x, p.y, p.z]; };

    const reloj = kit.reloj({ t0: 0, t1: 12, instante: M.instante, velocidad: 1 });
    const s = { revelar: false, ultimo: -1, refresco: 0, fase: null, tau: 0, primera: true, soltar: false, mirando: 0, revT: null };

    const R0 = orilla(0);              // orilla frente al muelle
    const Z_FIN = 9.0;                 // borde del cabezal del muelle sobre el agua
    const Z_T = 11.0;                  // desde aquí el cabezal ancho sigue como pasarela
    const XP = 2.5;                    // medio ancho del cabezal
    const Z_INI = R0 + 1.15;           // arranque del muelle en tierra
    const VR0 = [0, 0, Z_FIN + 0.8];   // borde del cabezal: de aquí se miden la lanzadora y el punto de caída
    const VR = [0, 0, Z_FIN + 4.2];    // donde queda la persona en VR: un poco atrás, para ver de frente a la lanzadora y al pescador
    const P = new THREE.Vector3(0, YA, VR0[2] - 6); // punto donde cae la piedra
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

    // Oscurece lo que está bajo el agua o junto a ella (madera y piedra mojadas, con lama verdosa en la línea de flotación)
    const mojar = (m, clave) => {
      const f = (v) => v.toFixed(3);
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vYm;\nvoid main() {').replace('#include <project_vertex>', `#include <project_vertex>
  vec4 pMoj = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  pMoj = instanceMatrix * pMoj;
#endif
  vYm = (modelMatrix * pMoj).y;`);
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vYm;\nvoid main() {').replace('#include <color_fragment>', `#include <color_fragment>
  float moj = 1.0 - smoothstep(${f(YA)}, ${f(YA + 0.17)}, vYm);
  float lama = (1.0 - smoothstep(${f(YA - 0.02)}, ${f(YA + 0.1)}, vYm)) * smoothstep(${f(YA - 0.75)}, ${f(YA - 0.08)}, vYm);
  diffuseColor.rgb *= 1.0 - 0.4 * moj;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.16, 0.07), lama * 0.6);`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.42, moj * 0.7);`);
      };
      m.customProgramCacheKey = () => 'ondas-mojado-' + clave;
      return m;
    };

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

    // ------------------------------------------------------------ muelle: cabezal ancho sobre el agua y pasarela hasta la orilla
    const VIGAS = [-2.42, -1.21, -0.35, 0.35, 1.21, 2.42];   // vigas del cabezal (a lo largo de z); las juntas de las tablas caen en ±0,35
    const LARGUEROS = [-0.75, 0.75];                           // largueros de la pasarela
    const filas = [];
    for (let z = Z_FIN + 0.08; z < Z_INI - 0.07; z += 0.157) filas.push(z);
    const tablasDat = [];
    filas.forEach((z, i) => {
      if (z < Z_T) { const xj = i % 2 ? 0.35 : -0.35; tablasDat.push({ x0: -XP, x1: xj, z, sop: VIGAS }, { x0: xj, x1: XP, z, sop: VIGAS }); }
      else tablasDat.push({ x0: -0.95, x1: 0.95, z, sop: LARGUEROS });
    });
    const zAtras = filas.filter((z) => z < Z_T).pop() + 0.0725;   // borde trasero del cabezal

    // tablas: cada una toma un listón distinto de la textura (atributo aVeta) y la veta corre a lo largo
    const madera = kit.mat('wood', { repeat: [1, 1], color: 0xc4ae8e, roughness: 0.9, normalScale: 1.0 });
    madera.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute vec2 aVeta;\nvoid main() {').replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_MAP
  vMapUv += aVeta;
#endif
#ifdef USE_NORMALMAP
  vNormalMapUv += aVeta;
#endif
#ifdef USE_ROUGHNESSMAP
  vRoughnessMapUv += aVeta;
#endif`);
    };
    madera.customProgramCacheKey = () => 'ondas-tablas';
    const tablaGeo = new THREE.BoxGeometry(1, 0.035, 0.145);
    {
      const uv = tablaGeo.attributes.uv;
      for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, (v / 6) * 0.9 + 0.008, u * 0.42); }
    }
    const veta = new Float32Array(tablasDat.length * 2);
    const tablas = new THREE.InstancedMesh(tablaGeo, madera, tablasDat.length);
    const clavos = [];
    {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      tablasDat.forEach((t, i) => {
        const L = t.x1 - t.x0 - 0.006;
        e.set((rnd() - 0.5) * 0.008, (rnd() - 0.5) * 0.01, (rnd() - 0.5) * 0.004); q.setFromEuler(e);
        m4.compose(V3((t.x0 + t.x1) / 2, CUB - 0.0175 + (rnd() - 0.5) * 0.004, t.z + (rnd() - 0.5) * 0.008), q, V3(L, 1, 1));
        tablas.setMatrixAt(i, m4);
        // tono: tablas grises por la intemperie, algunas más oscuras por la humedad y unas pocas repuestas más claras
        const r = rnd(), k = r < 0.08 ? 1.12 : r < 0.2 ? 0.7 : 0.8 + rnd() * 0.18, gris = r < 0.08 ? 0 : 0.06 + rnd() * 0.08;
        tablas.setColorAt(i, c.setRGB(k * (1 - gris * 0.4), k * (0.97 - gris * 0.25), k * (0.93 + gris * 0.05)));
        veta[i * 2] = Math.floor(rnd() * 6) / 6; veta[i * 2 + 1] = rnd();
        for (const xs of t.sop) {
          if (xs < t.x0 - 0.001 || xs > t.x1 + 0.001) continue;
          const xc = Math.min(t.x1 - 0.035, Math.max(t.x0 + 0.035, xs));
          clavos.push([xc + (rnd() - 0.5) * 0.01, t.z - 0.042], [xc + (rnd() - 0.5) * 0.01, t.z + 0.042]);
        }
      });
    }
    tablaGeo.setAttribute('aVeta', new THREE.InstancedBufferAttribute(veta, 2));
    tablas.castShadow = true; tablas.receiveShadow = true; esc.add(tablas);
    // cabezas de los clavos, con óxido
    {
      const cg = new THREE.CircleGeometry(0.0068, 7); cg.rotateX(-Math.PI / 2);
      const cm = new THREE.MeshStandardMaterial({ color: 0x4a3c33, roughness: 0.75, metalness: 0.45, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const inst = new THREE.InstancedMesh(cg, cm, clavos.length), m4 = new THREE.Matrix4(), c = new THREE.Color();
      clavos.forEach(([x, z], i) => { m4.makeTranslation(x, CUB + 0.0006, z); inst.setMatrixAt(i, m4); const k = 0.7 + rnd() * 0.6; inst.setColorAt(i, c.setRGB(k, k * (0.85 + rnd() * 0.2), k * 0.8)); });
      inst.castShadow = false; esc.add(inst);
    }

    // estructura: vigas, cabezales, tapacanes, pilotes y bitas en una sola malla
    const maderaOsc = mojar(kit.mat('wood', { repeat: [1, 1], color: 0x806a55, roughness: 0.95, normalScale: 1.1 }), 'estructura');
    const piezas = [], metal = [];
    const caja = (w, h, d, x, y, z, lista = piezas) => lista.push(mover(new THREE.BoxGeometry(w, h, d), x, y, z));
    for (const x of VIGAS) caja(0.075, 0.2, zAtras - Z_FIN - 0.02, x, -0.065, (Z_FIN + zAtras) / 2);
    for (const x of LARGUEROS) caja(0.08, 0.2, Z_INI - zAtras + 0.1, x, -0.065, (zAtras + Z_INI) / 2 - 0.05);
    caja(2 * XP + 0.07, 0.24, 0.035, 0, -0.05, Z_FIN - 0.0105);                       // tapacán del frente
    for (const sx of [-1, 1]) {
      caja(0.035, 0.24, zAtras - Z_FIN + 0.05, sx * (XP + 0.0175), -0.05, (Z_FIN + zAtras) / 2);     // costados
      caja(XP - 0.95, 0.24, 0.035, sx * (XP + 0.95) / 2, -0.05, zAtras + 0.0175);                     // atrás, a cada lado de la pasarela
    }
    const filasPil = [Z_FIN + 0.15, (Z_FIN + zAtras) / 2, zAtras - 0.15, 12.75, 14.35];
    for (const z of filasPil) caja(z < Z_T + 0.2 ? 2 * XP + 0.1 : 2.0, 0.16, 0.1, 0, -0.25, z);
    const pilotes = [];
    for (const z of [Z_FIN + 0.15, zAtras - 0.15]) for (const x of [-(XP - 0.1), -0.86, 0.86, XP - 0.1]) pilotes.push([x, z, 0.0]);
    for (const x of [-(XP - 0.1), XP - 0.1]) pilotes.push([x, (Z_FIN + zAtras) / 2, 0.0]);
    for (const z of [12.75, 14.35]) for (const x of [-0.86, 0.86]) pilotes.push([x, z, 0.0]);
    // bitas: postes que asoman sobre la cubierta por fuera del borde (amarras, salvavidas)
    const BITAS = {
      frenteI: [-1.05, Z_FIN - 0.12, 0.6], frenteD: [1.05, Z_FIN - 0.12, 0.6],
      esqI: [-(XP + 0.12), Z_FIN + 0.22, 0.62],
      salvavidas: [-(XP + 0.12), zAtras - 0.32, 1.3], popa: [XP - 0.16, zAtras + 0.13, 0.6], proa: [1.07, 14.2, 0.55],
    };
    for (const b of Object.values(BITAS)) pilotes.push(b);
    for (const [x, z, top] of pilotes) {
      const yb = fondoEn(x, z) - 0.3, r = top > 0.1 ? 0.1 : 0.095;
      piezas.push(mover(new THREE.CylinderGeometry(r * 0.96, r, top - yb, 12, 1), x, (top + yb) / 2, z));
      if (top > 0.1) piezas.push(mover(new THREE.CylinderGeometry(r * 0.7, r, 0.05, 12), x, top + 0.025, z));
      if (top <= 0.1) metal.push(mover(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8).rotateX(Math.PI / 2), x, -0.25, z + 0.065)); // pernos
    }
    const estructura = kit.malla(kit.mergeGeometries(piezas), maderaOsc, { padre: esc });
    for (const p of piezas) p.dispose();
    void estructura;
    // escalerilla de baño en el extremo del muelle
    for (const x of [0.38, 0.72]) {
      const cur = new THREE.CatmullRomCurve3([
        V3(x, 0.07, Z_FIN + 0.35), V3(x, 0.62, Z_FIN + 0.33), V3(x, 0.82, Z_FIN + 0.12),
        V3(x, 0.62, Z_FIN - 0.12), V3(x, 0.1, Z_FIN - 0.14), V3(x, -1.1, Z_FIN - 0.14),
      ], false, 'catmullrom', 0.2);
      metal.push(new THREE.TubeGeometry(cur, 40, 0.021, 8, false));
    }
    for (const y of [-0.25, -0.55, -0.85]) caja(0.36, 0.025, 0.07, 0.55, y, Z_FIN - 0.14, metal);
    const acero = mojar(new THREE.MeshStandardMaterial({ color: 0x8e959b, metalness: 0.8, roughness: 0.38 }), 'acero');
    kit.malla(kit.mergeGeometries(metal), acero, { padre: esc });
    for (const m of metal) m.dispose();
    // estribo de hormigón en la orilla
    kit.caja(2.4, 0.73, 1.7, mojar(kit.mat('concrete', { repeat: [1, 0.5], color: 0xa8a39a }), 'estribo'), { y: -0.535, z: R0 - 0.25, padre: esc });

    // ------------------------------------------------------------ piedras de la orilla (redondeadas, mojadas junto al agua)
    const rocaGeo = (det, semilla = 0) => {
      let geo = new THREE.IcosahedronGeometry(1, det);
      geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
      geo = mergeVertices(geo);
      const p = geo.attributes.position, v = new THREE.Vector3(), uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = 1 + 0.16 * Math.sin(v.x * 3.1 + v.y * 1.7 + semilla) + 0.1 * Math.sin(v.z * 4.3 - v.x * 2.2) + 0.05 * Math.sin(v.y * 7.1 + v.z * 3.3 + semilla * 2);
        v.multiplyScalar(n); v.y *= v.y < 0 ? 0.5 : 0.66; p.setXYZ(i, v.x, v.y, v.z);
        uv[i * 2] = v.x * 0.5 + v.z * 0.35; uv[i * 2 + 1] = v.y * 0.6 + v.z * 0.25 + v.x * 0.1;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeVertexNormals();
      return geo;
    };
    const rocaMat = mojar(kit.mat('concrete', { repeat: [0.7, 0.7], color: 0x958f82, roughness: 1, normalScale: 1.3 }), 'roca');
    const rocas = [];
    while (rocas.length < 84) {
      const a = rnd() * TAU;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.16) continue; // el muelle
      const grande = rocas.length < 9;
      const d = grande ? -1.2 - rnd() * 1.6 : -0.7 + rnd() * 1.5, sz = grande ? 0.55 + rnd() * 0.45 : 0.12 + rnd() * rnd() * 0.42;
      const [x, z] = enOrilla(a, d), y = (d > 0 ? fondo(d, x, z) : 0.04) - sz * 0.22;
      rocas.push({ x, y, z, sz, grande });
    }
    for (const grande of [true, false]) {
      const lista = rocas.filter((r) => r.grande === grande);
      const inst = new THREE.InstancedMesh(rocaGeo(grande ? 2 : 1, grande ? 0 : 1.3), rocaMat, lista.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      lista.forEach((r, i) => {
        e.set((rnd() - 0.5) * 0.4, rnd() * TAU, (rnd() - 0.5) * 0.4); q.setFromEuler(e);
        m4.compose(V3(r.x, r.y, r.z), q, V3(r.sz * (0.9 + rnd() * 0.4), r.sz * (0.7 + rnd() * 0.5), r.sz * (0.8 + rnd() * 0.4)));
        inst.setMatrixAt(i, m4);
        const k = 0.75 + rnd() * 0.35; inst.setColorAt(i, c.setRGB(k, k * (0.95 + rnd() * 0.05), k * (0.88 + rnd() * 0.1)));
      });
      inst.castShadow = grande; inst.receiveShadow = true; esc.add(inst);
    }

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
    function plantar(geo, n, elegir, sombra = true) {
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
      inst.count = k; inst.castShadow = sombra; inst.receiveShadow = true; esc.add(inst);
      return inst;
    }
    // juncales en algunos tramos de la orilla, en el agua poco profunda
    const tramos = [[1.3, 2.3], [2.7, 3.3], [3.75, 4.6], [4.95, 5.45], [5.7, 5.95]];
    const enJuncal = () => {
      const tr = tramos[Math.floor(rnd() * tramos.length)], a = tr[0] + rnd() * (tr[1] - tr[0]), d = 0.55 + rnd() * 1.7;
      const [x, z] = enOrilla(a, d); return { x, y: fondo(d, x, z), z };
    };
    plantar(juncoGeo, 115, enJuncal, false); // sus sombras caen en el agua, que no las recibe
    plantar(totoraGeo, 42, enJuncal, false);
    plantar(champaGeo, 175, () => {
      const a = rnd() * TAU, d = -0.06 - rnd() * rnd() * 3.8;
      const [x, z] = enOrilla(a, d);
      if (Math.abs(x) < 1.7 && z > R0 - 1) return null; // sendero y muelle
      return { x, y: 0.03, z, sc: 0.7 + rnd() * 0.7 };
    }, false);

    // ------------------------------------------------------------ nenúfares con algunas flores, lejos de las ondas
    {
      const [c, x] = lienzo(256, 256);
      x.translate(128, 128);
      const muesca = 0.17, hoja = (r) => { x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, r, -Math.PI / 2 + muesca, -Math.PI / 2 - muesca + TAU); x.closePath(); };
      const gr = x.createRadialGradient(0, 0, 8, 0, 0, 124);
      gr.addColorStop(0, '#6c8c38'); gr.addColorStop(0.65, '#557629'); gr.addColorStop(1, '#3e5a20');
      hoja(124); x.fillStyle = gr; x.fill();
      x.save(); hoja(122); x.clip();
      for (let i = 0; i < 70; i++) { // manchas amarillentas, cafés y rojizas
        const a = rnd() * TAU, r = 20 + rnd() * 100, col = ['rgba(170,150,60,0.22)', 'rgba(110,70,40,0.2)', 'rgba(140,60,50,0.14)', 'rgba(120,150,70,0.2)'][Math.floor(rnd() * 4)];
        x.fillStyle = col; x.beginPath(); x.ellipse(Math.cos(a) * r, Math.sin(a) * r, 3 + rnd() * 12, 2 + rnd() * 7, rnd() * 3, 0, TAU); x.fill();
      }
      x.strokeStyle = 'rgba(200,215,130,0.32)'; x.lineWidth = 1.5;
      for (let i = 0; i < 27; i++) { // nervaduras desde el centro
        const a = -Math.PI / 2 + muesca + 0.08 + (i / 26) * (TAU - 2 * muesca - 0.16);
        x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(Math.cos(a + 0.07) * 55, Math.sin(a + 0.07) * 55, Math.cos(a) * 120, Math.sin(a) * 120); x.stroke();
      }
      x.restore();
      x.lineWidth = 5; x.strokeStyle = 'rgba(48,66,24,0.75)'; hoja(121.5); x.stroke();
      x.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 4; i++) { const a = rnd() * TAU, r = 40 + rnd() * 70; x.beginPath(); x.arc(Math.cos(a) * r, Math.sin(a) * r, 2 + rnd() * 5, 0, TAU); x.fill(); }
      x.beginPath(); x.arc(Math.cos(0.4) * 124, Math.sin(0.4) * 124, 14, 0, TAU); x.fill(); // una mordida en el borde
      const matN = new THREE.MeshStandardMaterial({ map: texDe(c, false), alphaTest: 0.5, roughness: 0.42, metalness: 0, envMapIntensity: 1.3 });
      const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2);
      const pads = [], cumulos = [[0.62, 1.02], [-1.08, -0.66], [2.05, 2.45], [-2.62, -2.2], [1.5, 1.85], [3.6, 3.95]];
      for (const [a0, a1] of cumulos) {
        const ac = a0 + rnd() * (a1 - a0), dc = 1.2 + rnd() * 1.4;
        for (let k = 0; k < 12 && pads.length < 76; k++) {
          const a = ac + (rnd() - 0.5) * 0.14, d = Math.max(0.75, dc + (rnd() - 0.5) * 1.6), [px, pz] = enOrilla(a, d);
          if (Math.hypot(px - P.x, pz - P.z) < 4.5 || (Math.abs(px) < 3.2 && pz > 8)) continue;
          if (pads.some((q) => Math.hypot(q.x - px, q.z - pz) < 0.3)) continue;
          pads.push({ x: px, z: pz, s: 0.2 + rnd() * 0.18 });
        }
      }
      const inst = new THREE.InstancedMesh(pg, matN, pads.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
      pads.forEach((p, i) => {
        e.set((rnd() - 0.5) * 0.04, rnd() * TAU, (rnd() - 0.5) * 0.04); q.setFromEuler(e);
        m4.compose(V3(p.x, YA + 0.004 + rnd() * 0.003, p.z), q, V3(p.s, 1, p.s)); inst.setMatrixAt(i, m4);
        const k = 0.8 + rnd() * 0.35; inst.setColorAt(i, col.setRGB(k * (0.95 + rnd() * 0.15), k, k * (0.85 + rnd() * 0.2)));
      });
      inst.castShadow = false; esc.add(inst);
      // flores: pétalos blancos con la punta rosada y centro amarillo
      const petalos = [];
      for (const [n, largo, alza, r0] of [[9, 0.055, 0.5, 0.004], [7, 0.042, 0.95, 0.002]]) {
        for (let i = 0; i < n; i++) {
          const pp = new THREE.PlaneGeometry(0.022, largo, 1, 2); pp.translate(0, largo / 2, 0);
          const pa = pp.attributes.position, colr = new Float32Array(pa.count * 3), blanco = new THREE.Color('#f4f1ea'), rosa = new THREE.Color('#e7a7bb');
          for (let j = 0; j < pa.count; j++) {
            const t = pa.getY(j) / largo, cc2 = blanco.clone().lerp(rosa, t * t * 0.8);
            pa.setX(j, pa.getX(j) * (1 - 0.6 * (t - 0.5) ** 2 * 2)); pa.setZ(j, 0.012 * Math.sin(t * Math.PI));
            colr.set([cc2.r, cc2.g, cc2.b], j * 3);
          }
          pp.setAttribute('color', new THREE.BufferAttribute(colr, 3));
          pp.rotateX(-(Math.PI / 2 - alza)); pp.translate(0, 0, r0); pp.rotateY((i / n) * TAU + (largo < 0.05 ? 0.3 : 0));
          petalos.push(pp);
        }
      }
      petalos.push(pintar(new THREE.CylinderGeometry(0.012, 0.014, 0.018, 10).translate(0, 0.01, 0), '#e8c24a'));
      for (const pp of petalos) { pp.computeVertexNormals(); if (!pp.attributes.color) pintar(pp, '#ffffff'); }
      const flor = kit.mergeGeometries(petalos.map((pp) => (pp.index ? pp.toNonIndexed() : pp)));
      const conFlor = pads.filter(() => rnd() < 0.14).slice(0, 9);
      const flores = new THREE.InstancedMesh(flor, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55 }), Math.max(1, conFlor.length));
      conFlor.forEach((p, i) => { m4.compose(V3(p.x + p.s * 0.12, YA + 0.006, p.z - p.s * 0.1), q.setFromEuler(e.set(0, rnd() * TAU, 0)), V3(1, 1, 1).multiplyScalar(0.85 + rnd() * 0.4)); flores.setMatrixAt(i, m4); });
      flores.count = conFlor.length; flores.castShadow = false; esc.add(flores);
    }

    // ------------------------------------------------------------ sauces: tronco y ramas con corteza; follaje colgante con hojas en textura
    {
      // corteza: surcos verticales ondulados, liquen y su relieve
      const S = 256, n1 = kit.fbm(S, 4, 4, 77), n2 = kit.fbm(S, 24, 2, 79), n3 = kit.fbm(S, 6, 3, 83);
      const alto = new Float32Array(S * S);
      const [cc1, x1] = lienzo(S, S), img = x1.createImageData(S, S);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const k = j * S + i;
        const f = Math.abs(Math.sin(((i / S) * 7 + n1[k] * 1.4 + 0.06 * Math.sin((j / S) * TAU * 3 + (i / S) * TAU * 2)) * Math.PI));
        const h = Math.pow(f, 0.4) * 0.75 + n2[k] * 0.3;
        alto[k] = h;
        const liquen = Math.max(0, n3[k] - 0.58) * 3.2 * h, v = 34 + h * 78;
        img.data[k * 4] = v * 1.02 + liquen * 60; img.data[k * 4 + 1] = v * 0.9 + liquen * 72; img.data[k * 4 + 2] = v * 0.76 + liquen * 45; img.data[k * 4 + 3] = 255;
      }
      x1.putImageData(img, 0, 0);
      const [cn, xn] = lienzo(S, S), imn = xn.createImageData(S, S);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const dx = alto[j * S + ((i + 1) % S)] - alto[j * S + ((i - 1 + S) % S)], dy = alto[((j + 1) % S) * S + i] - alto[((j - 1 + S) % S) * S + i];
        const nx = -dx * 2.5, ny = dy * 2.5, l = Math.hypot(nx, ny, 1), k = (j * S + i) * 4;
        imn.data[k] = (nx / l * 0.5 + 0.5) * 255; imn.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; imn.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; imn.data[k + 3] = 255;
      }
      xn.putImageData(imn, 0, 0);
      const nrm = new THREE.CanvasTexture(cn); nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping;
      const corteza = new THREE.MeshStandardMaterial({ map: texDe(cc1), normalMap: nrm, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.96, metalness: 0 });

      // hojas: ramillas colgantes con hojas angostas sobre fondo transparente
      const [ch, xh] = lienzo(256, 512);
      const verdes = ['#4c6a28', '#5a7a2f', '#678a37', '#748f3e', '#86a24b', '#5f7e34', '#93a957'];
      for (let k = 0; k < 10; k++) {
        let px = 10 + k * 25 + (rnd() - 0.5) * 10;
        const largo = 512 * (0.72 + rnd() * 0.28), fase = rnd() * 6;
        const puntos = [];
        for (let py = 0; py <= largo; py += 6) { px += Math.sin(py * 0.018 + fase) * 0.5; puntos.push([px, py]); }
        xh.strokeStyle = 'rgba(96,86,52,0.95)'; xh.lineWidth = 1.3; xh.beginPath(); puntos.forEach(([a, b], i) => (i ? xh.lineTo(a, b) : xh.moveTo(a, b))); xh.stroke();
        puntos.forEach(([a, b], i) => {
          if (i < 2) return;
          const t = b / largo, lh = (13 + rnd() * 9) * (1 - 0.45 * t), wh = 2.4 + rnd() * 1.4;
          for (const lado of [-1, 1]) {
            if (rnd() < 0.18) continue;
            xh.save(); xh.translate(a, b); xh.rotate(Math.PI / 2 + lado * (0.35 + rnd() * 0.35));
            xh.fillStyle = verdes[Math.floor(rnd() * verdes.length)];
            xh.beginPath(); xh.ellipse(lh / 2, 0, lh / 2, wh / 2, 0, 0, TAU); xh.fill();
            xh.fillStyle = 'rgba(255,255,230,0.12)'; xh.beginPath(); xh.ellipse(lh / 2, -wh * 0.15, lh / 2.4, wh / 5, 0, 0, TAU); xh.fill();
            xh.restore();
          }
        });
      }
      const hojasMat = new THREE.MeshStandardMaterial({ map: texDe(ch, false), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 });
      hojasMat.onBeforeCompile = (sh) => {
        sh.uniforms.uT = uT;
        sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uT;\nvoid main() {').replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float faseS = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.53;
#else
  float faseS = 0.0;
#endif
  float kS = (1.0 - uv.y) * (1.0 - uv.y);
  transformed.x += sin(uT * 1.1 + faseS + position.y * 0.8 + position.z * 0.5) * 0.11 * kS;
  transformed.z += cos(uT * 0.83 + faseS * 1.3 + position.x * 0.6) * 0.08 * kS;`);
      };
      hojasMat.customProgramCacheKey = () => 'ondas-sauce';

      // tubo de sección variable a lo largo de una curva
      const tubo = (curva, radio, pasos, seg, partes) => {
        const fr = curva.computeFrenetFrames(pasos, false), largo = curva.getLength();
        const pos = [], nor = [], uv = [], idx = [];
        for (let i = 0; i <= pasos; i++) {
          const t = i / pasos, c = curva.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], r = radio(t);
          for (let j = 0; j <= seg; j++) {
            const a = (j / seg) * TAU, cs = Math.cos(a), sn = Math.sin(a);
            const nx = cs * N.x + sn * B.x, ny = cs * N.y + sn * B.y, nz = cs * N.z + sn * B.z;
            pos.push(c.x + r * nx, c.y + r * ny, c.z + r * nz); nor.push(nx, ny, nz);
            uv.push((j / seg) * Math.max(1, Math.round(r * 9)), t * largo * 0.9);
          }
        }
        for (let i = 0; i < pasos; i++) for (let j = 0; j < seg; j++) {
          const a = i * (seg + 1) + j, b = a + seg + 1;
          idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        partes.push(geo);
      };
      const madero = [], cuelgan = [];
      const tronco = new THREE.CatmullRomCurve3([V3(0, -0.45, 0), V3(0.06, 0.8, 0.04), V3(0.26, 1.9, 0.0), V3(0.5, 2.75, -0.06)]);
      tubo(tronco, (t) => 0.33 * (1 - 0.42 * t) * (1 + 0.55 * Math.max(0, 1 - t / 0.14) ** 2), 14, 11, madero);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + rnd() * 0.7, base = tronco.getPointAt(0.8 + rnd() * 0.2);
        const sale = V3(Math.cos(a), 0, Math.sin(a)), largo = 2.3 + rnd() * 1.3;
        const c = new THREE.CatmullRomCurve3([base, base.clone().addScaledVector(sale, largo * 0.3).add(V3(0, largo * 0.42, 0)),
          base.clone().addScaledVector(sale, largo * 0.7).add(V3(0, largo * 0.56, 0)), base.clone().addScaledVector(sale, largo).add(V3(0, largo * 0.4, 0))]);
        tubo(c, (t) => 0.13 * (1 - 0.75 * t), 10, 6, madero);
        for (let t = 0.32; t <= 1.001; t += 0.11) cuelgan.push({ p: c.getPointAt(Math.min(1, t)), sale, k: t });
        for (let m = 0; m < 2; m++) {
          const t0 = 0.4 + rnd() * 0.4, b0 = c.getPointAt(t0), ang = a + (m ? 0.7 : -0.7) * (0.6 + rnd() * 0.5), s2 = V3(Math.cos(ang), 0, Math.sin(ang)), l2 = 1.1 + rnd() * 0.6;
          const c2 = new THREE.CatmullRomCurve3([b0, b0.clone().addScaledVector(s2, l2 * 0.5).add(V3(0, l2 * 0.35, 0)), b0.clone().addScaledVector(s2, l2).add(V3(0, l2 * 0.2, 0))]);
          tubo(c2, (t) => 0.05 * (1 - 0.7 * t), 6, 4, madero);
          for (let t = 0.3; t <= 1.001; t += 0.23) cuelgan.push({ p: c2.getPointAt(Math.min(1, t)), sale: s2, k: t });
        }
      }
      // follaje: cortinas colgantes desde las ramas y racimos que llenan la copa
      const fp = [], fn = [], fu = [], fi = [];
      const cortina = (top, ancho, largo, yaw, salida, u0) => {
        const ex = Math.cos(yaw), ez = -Math.sin(yaw), ox = Math.sin(yaw), oz = Math.cos(yaw), b = fp.length / 3;
        for (let r = 0; r <= 3; r++) {
          const t = r / 3, y = top.y - largo * t, o = salida * t * t;
          for (let c = 0; c <= 1; c++) {
            const sx = (c - 0.5) * ancho * (1 - 0.3 * t);
            fp.push(top.x + ex * sx + ox * o, y, top.z + ez * sx + oz * o); fn.push(ox, 0.35, oz); fu.push(u0 + c * 0.5, 1 - t);
          }
        }
        for (let r = 0; r < 3; r++) { const a = b + r * 2; fi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      };
      const racimo = (c, tam) => {
        const n = V3(rnd() - 0.5, rnd() * 0.8 + 0.2, rnd() - 0.5).normalize(), e1 = V3(0, 1, 0).cross(n).normalize(), e2 = n.clone().cross(e1), b = fp.length / 3;
        for (const [a, bb] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const p = c.clone().addScaledVector(e1, a * tam / 2).addScaledVector(e2, bb * tam / 2);
          fp.push(p.x, p.y, p.z); fn.push(n.x, n.y + 0.5, n.z); fu.push((a + 1) / 2, (bb + 1) / 2);
        }
        fi.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      };
      for (const c of cuelgan) {
        const n = 1 + (rnd() < 0.55 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const largo = Math.min(c.p.y - 0.35, 1.0 + rnd() * 1.7 * (0.5 + c.k * 0.6));
          if (largo > 0.4) cortina(c.p.clone().add(V3((rnd() - 0.5) * 0.3, 0.05, (rnd() - 0.5) * 0.3)), 0.5 + rnd() * 0.45, largo, rnd() * TAU, 0.08 + rnd() * 0.2, rnd() < 0.5 ? 0 : 0.5);
        }
        if (rnd() < 0.7) racimo(c.p.clone().add(V3((rnd() - 0.5) * 0.4, 0.1 + rnd() * 0.25, (rnd() - 0.5) * 0.4)), 0.7 + rnd() * 0.5);
      }
      const follaje = new THREE.BufferGeometry();
      follaje.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
      const nn = new Float32Array(fn); for (let i = 0; i < nn.length; i += 3) { const l = Math.hypot(nn[i], nn[i + 1], nn[i + 2]); nn[i] /= l; nn[i + 1] /= l; nn[i + 2] /= l; }
      follaje.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
      follaje.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2));
      follaje.setIndex(fi);
      const troncoGeo = kit.mergeGeometries(madero);
      for (const p of madero) p.dispose();
      const sitios = [[2.55, -3.6, 1.05], [3.55, -3.2, 0.92], [-2.0, -3.4, 1.0], [0.72, -3.1, 0.85]];
      const troncos = new THREE.InstancedMesh(troncoGeo, corteza, sitios.length), copas = new THREE.InstancedMesh(follaje, hojasMat, sitios.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
      sitios.forEach(([a, d, sc], i) => {
        const [x, z] = enOrilla(a, d);
        q.setFromEuler(new THREE.Euler(0, Math.atan2(z, -x), 0)); // el tronco se inclina hacia el agua
        m4.compose(V3(x, 0, z), q, V3(sc, sc * (0.95 + rnd() * 0.1), sc));
        troncos.setMatrixAt(i, m4); copas.setMatrixAt(i, m4);
        const k = 0.88 + rnd() * 0.2; copas.setColorAt(i, col.setRGB(k * (0.95 + rnd() * 0.1), k, k * 0.92));
      });
      for (const o of [troncos, copas]) { o.castShadow = true; o.receiveShadow = true; esc.add(o); }
    }

    // ------------------------------------------------------------ bote de remos amarrado junto a la pasarela
    const bote = new THREE.Group();
    const BOTE = { x: 1.74, z: 12.85, L: 3.2 };
    const manga = (u) => (u < 0.45 ? 0.62 - 0.12 * ((0.45 - u) / 0.45) ** 2 : 0.62 * Math.pow(Math.max(0, 1 - ((u - 0.45) / 0.55) ** 2), 0.62));
    const borda = (u) => 0.46 + (u > 0.5 ? 0.15 * ((u - 0.5) / 0.5) ** 2 : 0.05 * ((0.5 - u) / 0.5) ** 2);
    const quilla = (u) => (u > 0.62 ? 0.3 * ((u - 0.62) / 0.38) ** 2 : u < 0.2 ? 0.05 * ((0.2 - u) / 0.2) ** 2 : 0);
    const casco = (u, sl) => { // sl de -1 (borda izquierda) a 1 (borda derecha) pasando por la quilla
      const f = Math.abs(sl) * Math.PI / 2, B = manga(u), Kq = quilla(u), H = borda(u) - Kq;
      return V3(Math.sign(sl) * B * Math.pow(Math.sin(f), 0.75), Kq + H * (1 - Math.cos(f)), (u - 0.5) * BOTE.L);
    };
    const CALADO = 0.13;
    {
      const nu = 30, ns = 26, pos = [], uv = [], colr = [], idx = [];
      const blanco = new THREE.Color('#e3dfd3'), franja = new THREE.Color('#2c5873'), fondoR = new THREE.Color('#5b2a22'), alga = new THREE.Color('#4b5530'), cc3 = new THREE.Color();
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= ns; j++) {
        const u = i / nu, sl = -1 + (2 * j) / ns, p = casco(u, sl);
        pos.push(p.x, p.y, p.z); uv.push(u, Math.abs(sl));
        if (p.y < CALADO + 0.015) cc3.copy(fondoR); else if (p.y < CALADO + 0.05) cc3.copy(alga).lerp(blanco, sstep(CALADO + 0.02, CALADO + 0.06, p.y)); else cc3.copy(blanco);
        if (p.y > borda(u) - 0.07) cc3.copy(franja);
        const k = 0.92 + rnd() * 0.1; colr.push(cc3.r * k, cc3.g * k, cc3.b * k);
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < ns; j++) { const a = i * (ns + 1) + j, b = a + ns + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      // pintura gastada sobre tingladillo: líneas de traslapo, desconchados y rayas
      const [c, x] = lienzo(512, 256);
      x.fillStyle = '#ececec'; x.fillRect(0, 0, 512, 256);
      for (const v of [0.2, 0.37, 0.53, 0.68, 0.82, 0.93]) {
        const y = (1 - v) * 256;
        const gr = x.createLinearGradient(0, y, 0, y + 7); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gr; x.fillRect(0, y, 512, 7);
        x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, y - 2, 512, 1.5);
        for (let i = 0; i < 26; i++) { x.fillStyle = 'rgba(150,118,82,0.85)'; x.beginPath(); x.ellipse(rnd() * 512, y - 2 + rnd() * 5, 2 + rnd() * 9, 1 + rnd() * 2.2, 0, 0, TAU); x.fill(); }
      }
      for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '70,60,50'},0.25)`; x.lineWidth = 0.8; const x0 = rnd() * 512, y0 = rnd() * 256; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + (rnd() - 0.5) * 50, y0 + (rnd() - 0.5) * 8); x.stroke(); }
      for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${rnd() < 0.6 ? '60,50,40' : '255,255,255'},${0.03 + rnd() * 0.05})`; x.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 6, 1 + rnd() * 3); }
      for (let i = 0; i < 14; i++) { const x0 = rnd() * 512, gr = x.createLinearGradient(0, 0, 0, 120); gr.addColorStop(0, 'rgba(70,50,30,0.18)'); gr.addColorStop(1, 'rgba(70,50,30,0)'); x.fillStyle = gr; x.fillRect(x0, 0, 3 + rnd() * 6, 60 + rnd() * 60); } // chorreaduras bajo la borda
      const pintado = new THREE.MeshStandardMaterial({ map: texDe(c), vertexColors: true, roughness: 0.62, metalness: 0 });
      const interior = kit.mat('wood', { repeat: [1, 1], color: 0xa48863, roughness: 0.88, normalScale: 0.9 });
      for (const k of ['map', 'normalMap', 'roughnessMap']) if (interior[k]) { interior[k].center.set(0.5, 0.5); interior[k].rotation = Math.PI / 2; }
      interior.side = THREE.BackSide;
      kit.malla(geo, pintado, { padre: bote });
      kit.malla(geo, interior, { padre: bote, sombra: false });
      // regala, espejo de popa, bancadas, plan y remos
      const piezasB = [];
      for (const lado of [-1, 1]) {
        const cur = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => { const u = i / 12; return casco(u, lado).add(V3(0, 0.012, 0)); }));
        piezasB.push(new THREE.TubeGeometry(cur, 40, 0.024, 6, false));
      }
      const forma = new THREE.Shape();
      for (let j = 0; j <= 16; j++) { const p = casco(0, -1 + j / 8); if (j) forma.lineTo(p.x, p.y); else forma.moveTo(p.x, p.y); }
      const popa = new THREE.ShapeGeometry(forma); popa.rotateY(Math.PI); popa.translate(0, 0, -BOTE.L / 2 + 0.01); piezasB.push(popa);
      const anchoA = (u, y) => { const Kq = quilla(u), H = borda(u) - Kq, f = Math.acos(Math.min(1, Math.max(-1, 1 - (y - Kq) / H))); return manga(u) * Math.pow(Math.sin(f), 0.75); };
      for (const u of [0.12, 0.42, 0.72]) {
        const y = borda(u) - 0.15, w = 2 * anchoA(u, y) - 0.015;
        piezasB.push(mover(new THREE.BoxGeometry(w, 0.032, 0.21), 0, y, (u - 0.5) * BOTE.L));
        piezasB.push(mover(new THREE.BoxGeometry(0.05, y - 0.04, 0.05), 0, y / 2 + 0.02, (u - 0.5) * BOTE.L)); // puntal
      }
      for (const xp of [-0.17, 0, 0.17]) piezasB.push(mover(new THREE.BoxGeometry(0.12, 0.018, BOTE.L * 0.58), xp, 0.035 + Math.abs(xp) * 0.25, -0.12));
      const remo = (x0, y0, z0, ry, rz) => {
        const p = [new THREE.CylinderGeometry(0.021, 0.021, 1.75, 8).translate(0, 0.875, 0), new THREE.CylinderGeometry(0.017, 0.021, 0.2, 8).translate(0, 1.85, 0),
          new THREE.BoxGeometry(0.13, 0.5, 0.014).translate(0, -0.2, 0), new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8).translate(0, 1.4, 0)];
        const m = kit.mergeGeometries(p); for (const q of p) q.dispose();
        m.rotateX(Math.PI / 2); m.rotateZ(rz); m.rotateY(ry); m.translate(x0, y0, z0); piezasB.push(m);
      };
      remo(-0.2, borda(0.42) - 0.1, -0.85, 0.06, 0.08);
      remo(0.21, borda(0.42) - 0.095, -0.8, -0.05, -0.1);
      const maderaB = kit.mat('wood', { repeat: [1, 1], color: 0x8f6e4e, roughness: 0.85, normalScale: 0.9 });
      maderaB.side = THREE.DoubleSide; // el espejo de popa se ve por dentro y por fuera
      kit.malla(kit.mergeGeometries(piezasB), maderaB, { padre: bote });
      for (const p of piezasB) p.dispose();
      bote.position.set(BOTE.x, YA - CALADO, BOTE.z); bote.rotation.y = 0.035;
      esc.add(bote);
    }

    // ------------------------------------------------------------ cuerdas de amarre, vueltas en las bitas y un rollo sobre la cubierta
    {
      const [c, x] = lienzo(64, 32);
      x.fillStyle = '#b39a6c'; x.fillRect(0, 0, 64, 32);
      for (let i = -32; i < 96; i += 8) { x.strokeStyle = 'rgba(70,52,30,0.55)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 16, 32); x.stroke(); x.strokeStyle = 'rgba(240,225,190,0.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(i + 3, 0); x.lineTo(i + 19, 32); x.stroke(); }
      for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(60,45,25,${0.05 + rnd() * 0.12})`; x.fillRect(rnd() * 64, rnd() * 32, 1 + rnd() * 3, 1); }
      const cuerdaMat = new THREE.MeshStandardMaterial({ map: texDe(c), roughness: 0.95, metalness: 0 });
      const partes = [];
      const cuerda = (pts, r = 0.011) => {
        const cur = new THREE.CatmullRomCurve3(pts), largo = cur.getLength(), geo = new THREE.TubeGeometry(cur, Math.max(8, Math.round(largo * 18)), r, 6, false);
        const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * largo / 0.05);
        partes.push(geo);
      };
      const colgar = (a, b, caida) => { const m = a.clone().lerp(b, 0.5); m.y -= caida; return [a, a.clone().lerp(m, 0.55).setY(a.y - caida * 0.75), m, b.clone().lerp(m, 0.55).setY(b.y - caida * 0.75), b]; };
      bote.updateMatrix();
      const enBote = (v) => v.applyMatrix4(bote.matrix);
      const bP = BITAS.proa, bQ = BITAS.popa;
      cuerda(colgar(V3(bP[0] + 0.09, bP[2] - 0.12, bP[1]), enBote(casco(0.99, 1).add(V3(0, 0.01, 0))), 0.16));          // proa
      cuerda(colgar(V3(bQ[0] - 0.05, bQ[2] - 0.12, bQ[1] + 0.08), enBote(V3(0.25, borda(0) - 0.03, -BOTE.L / 2 + 0.02)), 0.14)); // popa
      for (const b of Object.values(BITAS)) for (let k = 0; k < 2; k++) { // vueltas de cuerda bajo el remate de cada bita
        const t = new THREE.TorusGeometry(0.111, 0.0115, 5, 14); t.rotateX(Math.PI / 2); t.translate(b[0], b[2] - 0.1 - k * 0.022, b[1]);
        const uv = t.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 14);
        partes.push(t);
      }
      const rollo = [], cx = 1.52, cz = 10.62;
      for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * TAU * 3.6, r = 0.07 + 0.12 * t; rollo.push(V3(cx + Math.cos(a) * r, CUB + 0.012 + 0.006 * Math.sin(a * 3) * t, cz + Math.sin(a) * r)); }
      rollo.push(V3(cx + 0.3, CUB + 0.012, cz + 0.12), V3(cx + 0.55, CUB + 0.012, cz + 0.3));
      cuerda(rollo, 0.011);
      const geo = kit.mergeGeometries(partes);
      for (const p of partes) p.dispose();
      kit.malla(geo, cuerdaMat, { padre: esc });
    }

    // ------------------------------------------------------------ salvavidas, balde, termo y caja de aparejos (una malla con colores de vértice)
    {
      const partes = [];
      const sv = new THREE.TorusGeometry(0.27, 0.056, 10, 40), pa = sv.attributes.position, colr = new Float32Array(pa.count * 3);
      const nar = new THREE.Color('#d9531f'), bla = new THREE.Color('#e9e6dc');
      for (let i = 0; i < pa.count; i++) { const a = Math.atan2(pa.getY(i), pa.getX(i)) + Math.PI / 8, c = Math.floor(((a + TAU) % TAU) / (Math.PI / 4)) % 2 ? bla : nar, k = 0.82 + rnd() * 0.16; colr.set([c.r * k, c.g * k * 0.98, c.b * k * 0.95], i * 3); }
      sv.setAttribute('color', new THREE.BufferAttribute(colr, 3));
      partes.push(sv, pintar(new THREE.TorusGeometry(0.331, 0.006, 4, 48), '#cdbb92', 0.1));
      const bs = BITAS.salvavidas, salva = (geo) => { geo.rotateY(Math.PI / 2); geo.translate(bs[0] + 0.1 + 0.06, 0.86, bs[1]); return geo; };
      partes.forEach(salva);
      partes.push(pintar(new THREE.BoxGeometry(0.06, 0.02, 0.02).translate(bs[0] + 0.12, 1.15, bs[1]), '#3c3a38'));
      // balde galvanizado con agua, algo oxidado
      const bx = 1.42, bz = 9.62;
      const balde = new THREE.CylinderGeometry(0.15, 0.12, 0.27, 20, 3, true); balde.translate(bx, CUB + 0.135, bz);
      { const p = balde.attributes.position, cl = new Float32Array(p.count * 3), gal = new THREE.Color('#9da3a5'), oxi = new THREE.Color('#7a5236');
        for (let i = 0; i < p.count; i++) { const t = rnd() < 0.18 ? 0.5 + rnd() * 0.5 : rnd() * 0.15, c2 = gal.clone().lerp(oxi, t * (p.getY(i) < CUB + 0.05 ? 1 : 0.5)); cl.set([c2.r, c2.g, c2.b], i * 3); }
        balde.setAttribute('color', new THREE.BufferAttribute(cl, 3)); }
      partes.push(balde, pintar(new THREE.CircleGeometry(0.12, 20).rotateX(-Math.PI / 2).translate(bx, CUB + 0.004, bz), '#8a8f90'));
      partes.push(pintar(new THREE.CircleGeometry(0.142, 20).rotateX(-Math.PI / 2).translate(bx, CUB + 0.2, bz), '#25332c'));
      const asa = new THREE.TorusGeometry(0.15, 0.0035, 4, 18, Math.PI); asa.rotateX(-1.15); asa.rotateY(0.4); asa.translate(bx, CUB + 0.27, bz); partes.push(pintar(asa, '#5d6062'));
      // termo y su tapa-taza
      const tx = 1.68, tz = 9.75;
      partes.push(pintar(new THREE.CylinderGeometry(0.042, 0.045, 0.3, 14).translate(tx, CUB + 0.15, tz), '#8c2b25', 0.08));
      partes.push(pintar(new THREE.CylinderGeometry(0.046, 0.044, 0.07, 14).translate(tx, CUB + 0.335, tz), '#2b2b2b'));
      partes.push(pintar(new THREE.CylinderGeometry(0.04, 0.033, 0.06, 14).translate(tx + 0.12, CUB + 0.03, tz - 0.05), '#2b2b2b'));
      // caja de aparejos
      const ax = 1.98, az = 9.78;
      partes.push(pintar(new THREE.BoxGeometry(0.36, 0.14, 0.2).translate(ax, CUB + 0.07, az), '#3d6648', 0.06));
      partes.push(pintar(new THREE.BoxGeometry(0.37, 0.035, 0.21).translate(ax, CUB + 0.155, az), '#4b7a56', 0.06));
      const asa2 = new THREE.TorusGeometry(0.06, 0.008, 5, 12, Math.PI); asa2.translate(ax, CUB + 0.172, az); partes.push(pintar(asa2, '#2d2d2d'));
      for (const sx of [-0.12, 0.12]) partes.push(pintar(new THREE.BoxGeometry(0.03, 0.03, 0.006).translate(ax + sx, CUB + 0.135, az + 0.103), '#b9bcbd'));
      kit.malla(kit.mergeGeometries(partes), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide }), { padre: esc });
      for (const p of partes) p.dispose();
    }

    // ------------------------------------------------------------ personas: la que lanza la piedra y un pescador sentado en el borde
    const LANZAR = clipLanzar(kit);
    const miraP = new THREE.Object3D(); miraP.position.set(P.x, YA + 0.04, P.z); esc.add(miraP);
    const LZ = { x: VR0[0] - 1.6, z: VR0[2] - 0.4 };
    const lanzadora = kit.persona({
      preset: 'civilMujer', semilla: 23, altura: 1.68, manga: 'larga', colorSuperior: '#a3412c', colorInferior: '#2f3e58', colorPelo: kit.PELOS.castanoOscuro,
      piel: kit.PIELES[2], padre: esc, x: LZ.x, y: CUB, z: LZ.z, ry: Math.atan2(P.x - LZ.x, P.z - LZ.z) - 0.25,
    });
    lanzadora.posar(LANZAR.lista).mirar(miraP);
    // pescador: sentado en el costado del cabezal, cerca del frente, con las piernas colgando sobre el agua
    const PZ = { x: XP - 1.5, z: Z_FIN + 0.33, ry: Math.atan2(0.85, -0.5) }; // a la derecha del centro: no queda tras el gráfico de VR
    const pescador = kit.persona({
      preset: 'civil', semilla: 41, altura: 1.74, superior: 'parka', colorSuperior: '#55603f', inferior: 'trabajo', colorInferior: '#4b4639', calzado: 'botas',
      barba: 'barba', pelo: 'corto', colorPelo: kit.PELOS.canoso, piel: kit.PIELES[3], padre: esc, x: PZ.x, y: CUB, z: PZ.z, ry: PZ.ry,
    });
    const manosCana = { D: [-0.03, 0.42, 0.5], I: [0.05, 0.29, 0.31] };
    const poseBorde = {
      ...kit.POSES.sentado(0), columna: [0.12, 0.05, 0], pecho: [0.06, 0, 0], cuello: [0.03, 0, 0],
      musloD: [-1.5, 0, -0.1], musloI: [-1.54, 0, 0.12], piernaD: [0.8, 0, 0], piernaI: [0.7, 0, 0], pieD: [0.34, 0, 0.06], pieI: [0.42, 0, -0.06],
      ikD: { p: manosCana.D, polo: [-1, -0.5, -0.5] }, ikI: { p: manosCana.I, polo: [1, -0.5, -0.4] }, dedosD: 0.86, dedosI: 0.82,
    };
    // pies que se balancean despacio y, de vez en cuando, un pequeño tirón de la caña
    const PESCAR = {
      duracion: 9, bucle: true,
      fn(t) {
        const w = (TAU * t) / 4.5, tiron = 0.045 * Math.exp(-((t - 6.2) ** 2) / 0.015);
        return {
          piernaD: [0.8 + 0.12 * Math.sin(w), 0, 0], piernaI: [0.7 + 0.12 * Math.sin(w + 2.3), 0, 0],
          ikD: { p: [manosCana.D[0], manosCana.D[1] + tiron, manosCana.D[2] - tiron * 0.5], polo: [-1, -0.5, -0.5] },
        };
      },
    };
    pescador.posar(poseBorde).reproducir(PESCAR, { bucle: true, sinMezcla: true });
    // gorro de lana del pescador (sigue a la cabeza)
    {
      const bc = pescador.bind.get('cabeza'), HC = V3(0, pescador.F.yCabeza + 0.063, 0.017).sub(bc);
      const A = 0.098, B = 0.135, C = 0.121, nTh = 40, nPh = 10, pos = [], uv = [], idx = [];
      const base = (th) => 0.1 + 0.22 * Math.cos(th);
      const fila = (th, ph, k) => V3(A * k * Math.cos(ph) * Math.sin(th), B * k * Math.sin(ph), C * k * Math.cos(ph) * Math.cos(th)).add(HC);
      const anillos = [ // vuelta doblada abajo y luego la copa hasta la coronilla
        (th) => fila(th, base(th) - 0.03, 1.0), (th) => fila(th, base(th) - 0.02, 1.075),
        (th) => fila(th, base(th) + 0.22, 1.075), (th) => fila(th, base(th) + 0.24, 1.0),
      ];
      for (let r = 1; r <= nPh; r++) anillos.push((th) => { const p0 = base(th) + 0.24; return fila(th, p0 + (Math.PI / 2 - 0.015 - p0) * (r / nPh), 1); });
      anillos.forEach((f, r) => { for (let i = 0; i <= nTh; i++) { const th = (i / nTh) * TAU, p = f(th); pos.push(p.x, p.y, p.z); uv.push((i / nTh) * 14, r / anillos.length); } });
      for (let r = 0; r < anillos.length - 1; r++) for (let i = 0; i < nTh; i++) { const a = r * (nTh + 1) + i, b = a + nTh + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const [c, x] = lienzo(64, 64);
      x.fillStyle = '#5e2422'; x.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 64; i += 8) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(i, 0, 2, 64); x.fillStyle = 'rgba(255,220,200,0.12)'; x.fillRect(i + 4, 0, 2, 64); }
      for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,230,210'},0.08)`; x.fillRect(rnd() * 64, rnd() * 64, 1, 2); }
      const gorro = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texDe(c), roughness: 1, metalness: 0, side: THREE.DoubleSide }));
      gorro.castShadow = true; gorro.receiveShadow = true;
      pescador.huesos.cabeza.add(gorro);
    }
    // caña de pescar: puño de corcho, porta carrete, carrete, anillas y puntera fina (a lo largo de +y)
    const LC = 2.45;
    const cana = new THREE.Group();
    {
      const partes = [
        pintar(new THREE.CylinderGeometry(0.0022, 0.0105, LC - 0.5, 8).translate(0, 0.5 + (LC - 0.5) / 2, 0), '#22262b'),
        pintar(new THREE.CylinderGeometry(0.0155, 0.017, 0.3, 12).translate(0, 0.15, 0), '#b48a5c', 0.12),
        pintar(new THREE.CylinderGeometry(0.0125, 0.0125, 0.16, 10).translate(0, 0.38, 0), '#2a2a2a'),
        pintar(new THREE.CylinderGeometry(0.014, 0.0115, 0.1, 12).translate(0, 0.5, 0), '#b48a5c', 0.12),
        pintar(new THREE.CylinderGeometry(0.019, 0.019, 0.012, 10).translate(0, 0.002, 0), '#1c1c1c'),
        pintar(new THREE.BoxGeometry(0.06, 0.012, 0.01).translate(-0.03, 0.38, 0), '#3a3a3a'),
        pintar(new THREE.CylinderGeometry(0.027, 0.027, 0.04, 16).rotateZ(Math.PI / 2).rotateZ(-Math.PI / 2).translate(-0.072, 0.4, 0), '#9aa0a6'),
        pintar(new THREE.CylinderGeometry(0.03, 0.025, 0.035, 16).translate(-0.072, 0.365, 0), '#2b2d30'),
        pintar(new THREE.BoxGeometry(0.008, 0.008, 0.06).translate(-0.075, 0.37, 0.04), '#2b2d30'),
        pintar(new THREE.SphereGeometry(0.009, 8, 6).translate(-0.075, 0.37, 0.072), '#151515'),
      ];
      for (const [y, r] of [[0.75, 0.014], [1.15, 0.01], [1.55, 0.008], [1.9, 0.006], [2.2, 0.005], [LC - 0.01, 0.004]]) {
        const a = new THREE.TorusGeometry(r, 0.0012, 4, 10); a.rotateX(Math.PI / 2); a.translate(-r - 0.006, y, 0); partes.push(pintar(a, '#b8bcc0'));
      }
      kit.malla(kit.mergeGeometries(partes), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 }), { padre: cana });
      for (const p of partes) p.dispose();
      esc.add(cana);
    }
    pescador.sostener(cana, { D: [0, 0.4, 0], I: [0, 0.13, 0], arriba: [1, 0, 0] });
    // boya y sedal
    const boya = new THREE.Group();
    {
      const pb = [pintar(new THREE.SphereGeometry(0.022, 12, 8, 0, TAU, 0, Math.PI / 2), '#d23b25'), pintar(new THREE.SphereGeometry(0.022, 12, 8, 0, TAU, Math.PI / 2, Math.PI / 2), '#f0eee6'),
        pintar(new THREE.CylinderGeometry(0.003, 0.003, 0.07, 6).translate(0, 0.045, 0), '#d23b25')];
      kit.malla(kit.mergeGeometries(pb), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }), { padre: boya, sombra: false });
      for (const p of pb) p.dispose();
      esc.add(boya);
    }
    const sedalGeo = new THREE.BufferGeometry(); sedalGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    const sedal = new THREE.Line(sedalGeo, new THREE.LineBasicMaterial({ color: 0xe4e6e0, transparent: true, opacity: 0.6 }));
    sedal.frustumCulled = false; esc.add(sedal);
    const vPunta = V3(), vAux = V3();
    function moverSedal() {
      cana.localToWorld(vPunta.set(-0.01, LC, 0)); esc.worldToLocal(vPunta);
      const pa = sedalGeo.attributes.position, b = boya.position;
      for (let i = 0; i < 8; i++) {
        const t = i / 7; vAux.copy(vPunta).lerp(b, t); vAux.y -= Math.sin(Math.PI * t) * 0.1 * (1 - t * 0.4);
        if (i === 7) vAux.set(b.x, b.y + 0.035, b.z);
        pa.setXYZ(i, vAux.x, vAux.y, vAux.z);
      }
      pa.needsUpdate = true;
    }

    // ------------------------------------------------------------ piedra, salpicadura y espuma
    const piedraGeo = rocaGeo(2, 2.1);
    const piedraMat = kit.mat('concrete', { repeat: [0.4, 0.4], color: 0x6f6a62, roughness: 0.75, normalScale: 1.2 });
    const piedraMano = kit.malla(piedraGeo, piedraMat, { sombra: false });
    piedraMano.scale.set(0.036, 0.027, 0.03); piedraMano.position.set(0, -0.004, 0.006);
    lanzadora.manoD.add(piedraMano);
    { // dos piedras de reserva en la mano izquierda
      const r1 = piedraGeo.clone().scale(0.03, 0.022, 0.026).translate(0.004, -0.004, 0.018), r2 = piedraGeo.clone().scale(0.026, 0.02, 0.024).rotateY(1.2).translate(-0.008, 0.008, -0.004);
      lanzadora.manoI.add(kit.malla(kit.mergeGeometries([r1, r2]), piedraMat, { sombra: false }));
      r1.dispose(); r2.dispose();
    }
    const piedraVuelo = kit.malla(piedraGeo, piedraMat, { padre: esc });
    piedraVuelo.scale.copy(piedraMano.scale); piedraVuelo.visible = false;
    const blanco = new THREE.MeshStandardMaterial({ color: 0xe9f1f4, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.85, depthWrite: false });
    const nGotas = 26, gotas = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), blanco, nGotas);
    gotas.frustumCulled = false; esc.add(gotas);
    const gotaDat = Array.from({ length: nGotas }, () => ({ a: rnd() * TAU, vh: 0.35 + rnd() * 0.85, vy: 1.2 + rnd() * 1.5, r: 0.009 + rnd() * 0.016 }));
    const coronaMat = blanco.clone();
    const corona = kit.malla(new THREE.CylinderGeometry(1, 0.75, 1, 28, 1, true), coronaMat, { padre: esc, sombra: false });
    coronaMat.side = THREE.DoubleSide;
    const chorro = kit.malla(new THREE.CylinderGeometry(0.014, 0.03, 1, 10), blanco, { padre: esc, sombra: false });
    const espumaTex = (() => {
      const [c, x] = lienzo(128, 128), gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      x.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 160; i++) { x.beginPath(); x.arc(rnd() * 128, rnd() * 128, 1 + rnd() * 5, 0, TAU); x.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.6})`; x.fill(); }
      return texDe(c, false);
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
    kit.malla(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16), naranja, { x: P.x, y: YA + 0.008, z: P.z, padre: esc, sombra: false });
    const lr = kit.etiqueta('r', 0.24, { bg: '#ffb347', color: '#1a1206' });
    const lA = kit.etiqueta('A', 0.24, { bg: '#5cc8ff', color: '#08202c' });
    esc.add(lr, lA);

    function escena3D() {
      const t = reloj.t, rm = M.r(t) * PIE;
      uAgua.uR.value = rm;
      uAgua.uA.value = rm > 0 ? 0.02 * (0.35 + 0.65 / Math.sqrt(1 + 2.5 * rm)) : 0;
      uAgua.uL.value = 0.32 + 0.1 * rm;
      cotaR.visible = rm > 0.03;
      // el radio se mide hacia el fondo del lago: su rótulo queda al centro de la vista, lejos del panel y del gráfico de VR
      if (cotaR.visible) kit.moverBarra(cotaR, [P.x, YA + 0.016, P.z], [P.x, YA + 0.016, P.z - rm]);
      salpicar(s.fase ? -1 : t);
    }
    function rotulos() {
      const t = reloj.t, r = M.r(t), rm = r * PIE;
      lr.visible = rm > 0.2; lA.visible = rm > 0.32;
      kit.cambiarEtiqueta(lr, `r = ${kit.num(r, 1)} pies`); lr.position.set(P.x + 0.12, YA + 0.24, P.z - rm / 2);
      kit.cambiarEtiqueta(lA, `A = ${kit.num(M.area(t), 1)} pies²`); lA.position.set(P.x, YA + 1.3, P.z + 0.15); // sobre el centro, bastante más alto que r: no se pisan con ningún radio
    }

    // ------------------------------------------------------------ lanzamiento: la piedra sale de la mano de la lanzadora y cae en P
    const vuelo = { S: V3(), V: V3(), T: 1 };
    function colocarPiedra(tau) {
      piedraVuelo.visible = true;
      piedraVuelo.position.set(vuelo.S.x + vuelo.V.x * tau, vuelo.S.y + vuelo.V.y * tau - 4.905 * tau * tau, vuelo.S.z + vuelo.V.z * tau);
      piedraVuelo.rotation.set(0.3 + tau * 11, tau * 6, 0);
    }
    // trayectoria balística desde la mano (ángulo de salida ELEV) que termina en P
    function trayectoria() {
      piedraMano.getWorldPosition(vuelo.S); esc.worldToLocal(vuelo.S);
      const dx = P.x - vuelo.S.x, dz = P.z - vuelo.S.z, D = Math.hypot(dx, dz), sube = D * Math.tan(ELEV);
      vuelo.T = Math.sqrt(Math.max(0.05, (sube - (YA - vuelo.S.y)) / 4.905));
      vuelo.V.set(dx / vuelo.T, sube / vuelo.T, dz / vuelo.T);
    }
    function salir() { trayectoria(); piedraMano.visible = false; s.fase = 'vuelo'; s.tau = 0; colocarPiedra(0); }
    const eventos = { suelta: () => { if (s.fase === 'gesto') s.soltar = true; }, toma: () => { piedraMano.visible = true; } };
    function lanzar() {
      if (REV.lanzar !== undefined) return;
      s.fase = 'gesto'; s.soltar = false; piedraVuelo.visible = false; piedraMano.visible = true;
      reloj.fijar(0);
      lanzadora.reproducir(LANZAR, { eventos });
    }
    function cancelar() {
      if (s.fase === 'vuelo') piedraVuelo.visible = false;
      if (s.fase === 'gesto') { lanzadora.detener(); piedraMano.visible = true; }
      s.fase = null; s.soltar = false;
    }
    function fijarT(v) { cancelar(); reloj.fijar(v); }
    function alternar() { if (s.fase) return; reloj.alternar(); }
    function irInstante() { cancelar(); reloj.alInstante(); }
    // estado fijo para revisar capturas: el gesto, el vuelo y luego la onda siguen el instante pedido
    function revisarLanzamiento(x) {
      if (!s.revSalida) { lanzadora.fijarClip(LANZAR, SUELTA); trayectoria(); s.revSalida = true; }
      lanzadora.fijarClip(LANZAR, Math.min(x, LANZAR.duracion));
      const tau = x - SUELTA;
      piedraMano.visible = x < SUELTA || x >= TOMA;
      let tRel = 0;
      if (tau < 0) { s.fase = 'gesto'; piedraVuelo.visible = false; } else if (tau < vuelo.T) { s.fase = 'vuelo'; colocarPiedra(tau); } else { s.fase = null; piedraVuelo.visible = false; tRel = tau - vuelo.T; }
      if (s.revT !== tRel) { s.revT = tRel; reloj.fijar(tRel); }
    }

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
        { etiqueta: 'dA/dt = 2πr · dr/dt', valor: () => (s.revelar ? `${kit.num(M.dAdt(reloj.t), 2)} pies²/s` : OCULTO), color: '#5cc8ff', escala: 0.6 },
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
    // un poco más adelante que en las otras estaciones: deja espacio al brazo de la lanzadora
    panel.mesh.position.set(-1.3, 1.38, VR[2] - 1.7); panel.mesh.rotation.y = 0.5;
    esc.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    // todo lo que está sobre el hueco se dibuja después del fondo
    esc.traverse((o) => { if ((o.isMesh || o.isLine) && o.renderOrder === 0) o.renderOrder = 3; });

    // poses iniciales
    g.updateMatrixWorld(true);
    if (REV.t !== undefined) { s.primera = false; reloj.fijar(REV.t); }
    if (REV.lanzar !== undefined) { s.primera = false; revisarLanzamiento(REV.lanzar); }
    lanzadora.actualizar(1); pescador.actualizar(1);
    { // la boya queda adelante de la punta de la caña, sobre el agua
      const punta = cana.localToWorld(V3(0, LC, 0)), mango = cana.localToWorld(V3(0, 0, 0));
      esc.worldToLocal(punta); esc.worldToLocal(mango);
      const dir = punta.clone().sub(mango).setY(0).normalize();
      boya.position.set(punta.x + dir.x * 2.3, YA, punta.z + dir.z * 2.3);
    }
    pescador.mirar(boya); pescador.actualizar(0.5); moverSedal();

    let tiempo = 0;
    return {
      paneles: [panel],
      radioSombra: 21,
      alturaCartel: 5.2,
      vista: {
        escritorio: { camara: aGrupo([4.2, 4.3, 15.6]), objetivo: aGrupo([-0.5, -0.2, 5.4]) },
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
        // la lanzadora y la piedra
        if (REV.lanzar !== undefined) revisarLanzamiento(REV.lanzar);
        else {
          lanzadora.actualizar(dt);
          if (s.soltar) { s.soltar = false; salir(); }
          else if (s.fase === 'vuelo') {
            s.tau += dt;
            if (s.tau >= vuelo.T) { s.fase = null; piedraVuelo.visible = false; reloj.reiniciar(); } else colocarPiedra(s.tau);
          }
        }
        // el pescador mira la boya; cuando la piedra cae se vuelve a mirar la salpicadura
        const salpica = !s.fase && reloj.t > 0 && reloj.t < 3.2 && (reloj.corriendo || REV.lanzar !== undefined);
        pescador.mirar(salpica ? miraP : boya);
        pescador.actualizar(dt);
        boya.position.y = YA + 0.004 * Math.sin(tiempo * 1.7) + 0.002 * Math.sin(tiempo * 3.1 + 1);
        boya.rotation.set(0.05 * Math.sin(tiempo * 1.3), 0, 0.05 * Math.cos(tiempo * 1.1));
        moverSedal();
        // el bote se mece apenas en su amarra
        bote.position.y = YA - CALADO + 0.006 * Math.sin(tiempo * 1.1);
        bote.rotation.set(0.006 * Math.sin(tiempo * 0.9 + 1), 0.035, 0.012 * Math.sin(tiempo * 0.75));
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
