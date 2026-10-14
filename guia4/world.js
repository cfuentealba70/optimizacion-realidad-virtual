// Mundo de la Guía 4: una obra con sus alrededores y una estación por problema.
// Cada estación vive en guia4/estaciones/<id>.js y se construye con el kit común (guia4/kit.js).
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createApp, loading } from '../src/common/app.js';
import { createSky } from '../src/common/sky.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { surfaceMaterial, makeSurface, fbm, mulberry32, fotoTex, fotosActivas } from '../src/common/textures.js';
import { createPanel, THEME, font } from '../src/common/panel.js';
import { crearKit } from './kit.js';
import { crearNarrador } from './narrador.js';

loading('Preparando la obra…');
// cede el turno al navegador para que muestre el aviso de carga (con un mensaje: los temporizadores se retrasan en pestañas ocultas)
const ceder = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
await ceder();

// Posición (x, z) y orientación de cada estación. El usuario mira cada estación desde su lado +z local.
const LAYOUT = [
  { id: 'cisterna', pos: [-34, -22], yaw: 0.35 },
  { id: 'arena', pos: [-14, -38], yaw: 0.1 },
  { id: 'caja', pos: [8, -20], yaw: 0 },
  { id: 'grava', pos: [30, -42], yaw: -0.25 },
  { id: 'escalera', pos: [54, -16], yaw: -0.6 },
  { id: 'postes', pos: [40, 16], yaw: -1.2 },
  { id: 'ondas', pos: [-22, 42], yaw: Math.PI - 0.2 },
  { id: 'aviones', pos: [10, 30], yaw: Math.PI },
  { id: 'deposito', pos: [-68, 22], yaw: 1.35 },
  { id: 'autos', pos: [150, 110], yaw: 0 },
  { id: 'rio', pos: [-58, -44], yaw: 0.92 },
];
const PLAZA = { pos: [0, 0], yaw: Math.PI };
const PARAMS0 = new URLSearchParams(location.search);
const AMBIENTE_HDR = Number(PARAMS0.get('amb') || 0.3);

// ------------------------------------------------------------------ aplicación
const app = createApp({
  camera: { position: [0, 1.7, 8], target: [0, 1.4, -6] },
  orbit: { minDistance: 0.5, maxDistance: 600, maxPolarAngle: Math.PI * 0.49 },
  xrStart: { position: [0, 0, 3], yaw: 0 },
  exposure: 0.82, background: 0x9fb8d0, far: 30000, near: 0.05,
});
const { scene, renderer, camera, orbit, rig, input } = app;
// Con la iluminación fotográfica, el mapeo neutro de Khronos conserva el tono y la saturación de las texturas mejor que ACES o AgX
if (fotosActivas) { renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = Number(PARAMS0.get('exp') || 0.8); }
app.locomotion.enabled = true; app.locomotion.speed = 4; app.locomotion.fly = false;
const sky = createSky(scene, renderer, { elevation: 34, azimuth: 205, turbidity: 3.2, rayleigh: 1.2, sunIntensity: 3.5, fogDensity: 0.0016 });
scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x6d6a55, 0.3));
// El cielo físico es muy brillante como luz ambiental: se atenúa para que los materiales conserven su color
scene.environmentIntensity = 0.28;
// Con texturas fotográficas, la luz ambiental y los reflejos vienen de una fotografía HDR de un campo abierto (Poly Haven, CC0),
// que aporta el cielo y también la luz que rebota en el suelo. El sol de la foto se recorta para no duplicar el sol direccional.
if (fotosActivas) {
  new HDRLoader().setDataType(THREE.FloatType).load(new URL('../assets/hdri/farm_field_1k.hdr', import.meta.url).href, (hdr) => {
    const d = hdr.image.data;
    for (let i = 0; i < d.length; i += 4) { const m = Math.max(d[i], d[i + 1], d[i + 2]); if (m > 4) { const k = 4 / m; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; } }
    hdr.mapping = THREE.EquirectangularReflectionMapping; hdr.needsUpdate = true;
    const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromEquirectangular(hdr);
    hdr.dispose(); pm.dispose();
    scene.environment = rt.texture; scene.environmentIntensity = AMBIENTE_HDR;
  });
}

// ------------------------------------------------------------------ terreno
const noise = new ImprovedNoise();
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const SITE = { x: 10, z: 10, r: 150 };
function sueloH(x, z) {
  const d = Math.hypot(x - SITE.x, z - SITE.z);
  const k = sstep(SITE.r, SITE.r + 120, d) * (1 - sstep(0, 1, roadMask(x, z)));
  const n = noise.noise(x / 90, 0.3, z / 90) * 0.6 + noise.noise(x / 35, 2.1, z / 35) * 0.25;
  return k * (6 + n * 14) + (1 - k) * n * 0.25 * sstep(SITE.r - 40, SITE.r, d);
}
// Corredores de los caminos de la estación de autos (para no poner árboles ni cerros encima)
function roadMask(x, z) {
  const a = LAYOUT.find((l) => l.id === 'autos').pos;
  const enX = Math.abs(z - a[1]) < 14 && x < a[0] + 40 && x > a[0] - 300;
  const enZ = Math.abs(x - a[0]) < 14 && z > a[1] - 260 && z < a[1] + 40;
  return enX || enZ ? 1 : 0;
}
// Perímetro del cerco de la obra (x, z). El portón queda en el tramo noreste, hacia el cruce de los caminos.
const CERCO = [[-96, -24], [-84, -58], [-58, -76], [-10, -80], [40, -80], [76, -68], [96, -36], [100, 20], [94, 56], [76, 80], [36, 92], [-20, 92], [-62, 80], [-90, 52], [-100, 14]];
// Distancia con signo al cerco: negativa dentro de la obra
function distCerco(x, z) {
  let dmin = Infinity, dentro = false;
  for (let i = 0, j = CERCO.length - 1; i < CERCO.length; j = i++) {
    const [xi, zi] = CERCO[i], [xj, zj] = CERCO[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) dentro = !dentro;
    const dx = xj - xi, dz = zj - zi, t = Math.min(1, Math.max(0, ((x - xi) * dx + (z - zi) * dz) / (dx * dx + dz * dz)));
    dmin = Math.min(dmin, Math.hypot(x - xi - t * dx, z - zi - t * dz));
  }
  return dentro ? -dmin : dmin;
}
const G = 760, GS = 160;
const gGeo = new THREE.PlaneGeometry(G, G, GS, GS);
gGeo.rotateX(-Math.PI / 2); gGeo.translate(SITE.x + 40, 0, SITE.z);
{
  const pos = gGeo.attributes.position, col = new Float32Array(pos.count * 3), mezcla = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = sueloH(x, z);
    pos.setY(i, h);
    const n = noise.noise(x / 25, 5.1, z / 25) * 0.5 + 0.5, dry = sstep(0.55, 0.85, noise.noise(x / 60, 9.3, z / 60) * 0.5 + 0.5);
    const obra = (1 - sstep(-16, -3, distCerco(x, z))) * (0.86 + 0.14 * n); // la obra tiene tierra apisonada y pasto ralo junto al cerco
    mezcla[i] = obra;
    if (fotosActivas) {
      // con texturas fotográficas el color de vértice solo matiza: pasto más seco en algunas zonas
      col[i * 3] = 0.95 + 0.1 * n + dry * 0.04; col[i * 3 + 1] = 0.96 + 0.08 * n; col[i * 3 + 2] = 0.94 + 0.06 * n - dry * 0.04;
    } else {
      let r = 0.2 + 0.1 * n + dry * 0.12, g = 0.31 + 0.13 * n + dry * 0.04, b = 0.1 + 0.05 * n;
      r = r * (1 - obra * 0.55) + 0.42 * obra * 0.55; g = g * (1 - obra * 0.55) + 0.38 * obra * 0.55; b = b * (1 - obra * 0.55) + 0.3 * obra * 0.55;
      col[i * 3] = r * 0.9; col[i * 3 + 1] = g * 0.95; col[i * 3 + 2] = b * 0.85;
    }
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  gGeo.setAttribute('aObra', new THREE.BufferAttribute(mezcla, 1));
  gGeo.computeVertexNormals();
}
const gravelN = makeSurface('gravel', { size: 256, seed: 3, repeat: [G / 4, G / 4], roughness: false }).normalMap;
function grayDetail(rep) {
  const size = 256, f = fbm(size, 6, 5, 4);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let i = 0; i < f.length; i++) { const v = 150 + f[i] * 105; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(rep, rep); t.anisotropy = 4;
  return t;
}
// Terreno con texturas fotográficas: pasto fuera de la obra y tierra apisonada dentro, muestreadas en coordenadas del mundo a
// dos escalas que se mezclan con la distancia, con variación de tono a gran escala para que no se note la repetición.
function materialTerreno() {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, map: fotoTex('grass', 'color', true), normalMap: fotoTex('grass', 'normal', false),
    roughnessMap: fotoTex('grass', 'orm', false), aoMap: fotoTex('grass', 'orm', false), aoMapIntensity: 0.7, normalScale: new THREE.Vector2(0.9, 0.9),
  });
  const macro = (() => {
    const S = 256, a = fbm(S, 4, 5, 71), b = fbm(S, 9, 4, 72);
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S);
    for (let i = 0; i < a.length; i++) { img.data[i * 4] = a[i] * 255; img.data[i * 4 + 1] = b[i] * 255; img.data[i * 4 + 2] = 0; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
    return t;
  })();
  const U = {
    tPastoC: { value: mat.map }, tPastoN: { value: mat.normalMap }, tPastoO: { value: mat.roughnessMap },
    tTierraC: { value: fotoTex('obra', 'color', true) }, tTierraN: { value: fotoTex('obra', 'normal', false) }, tTierraO: { value: fotoTex('obra', 'orm', false) },
    tMacro: { value: macro },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aObra;\nvarying float vObra;\nvarying vec2 vMundo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObra = aObra;\nvMundo = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tPastoC, tPastoN, tPastoO, tTierraC, tTierraN, tTierraO, tMacro;
varying float vObra;
varying vec2 vMundo;
vec4 dosEscalas(sampler2D t, vec2 a, vec2 b, float k) { return mix(texture2D(t, a), texture2D(t, b), k); }`)
      .replace('#include <map_fragment>', `
vec2 pm = vec2(vMundo.x, -vMundo.y);
float dist = length(vMundo - cameraPosition.xz);
vec4 mac = texture2D(tMacro, pm / 160.0), mac2 = texture2D(tMacro, pm / 41.0 + 0.37);
float lejos = clamp(smoothstep(10.0, 48.0, dist) + (mac2.g - 0.5) * 0.5, 0.0, 1.0);
vec2 uA = pm / 2.4, uB = mat2(0.8, -0.6, 0.6, 0.8) * pm / 8.5 + 0.21;
float ob = smoothstep(0.32, 0.68, vObra + (mac2.r - 0.5) * 0.55);
// dentro de la obra hay pasto pisado y manchones de tierra apisonada; afuera, pasto con zonas algo más secas
float mz = ob * smoothstep(0.5, 0.72, mac2.r * 0.55 + mac.g * 0.45);
vec3 cP = dosEscalas(tPastoC, uA, uB, lejos).rgb, cT = dosEscalas(tTierraC, uA * 1.1, uB * 1.1, lejos).rgb;
vec4 oP = dosEscalas(tPastoO, uA, uB, lejos), oT = dosEscalas(tTierraO, uA * 1.1, uB * 1.1, lejos);
vec3 pasto = cP * mix(vec3(0.97, 1.0, 0.92), vec3(0.82, 0.84, 0.8), ob);
vec3 alb = mix(pasto, cT * vec3(0.62, 0.58, 0.6), mz);
alb *= 0.8 + 0.4 * mac.r;
alb = mix(alb, alb * vec3(1.1, 1.03, 0.8), smoothstep(0.6, 0.9, mac.g) * (1.0 - mz) * 0.3);
diffuseColor.rgb *= alb;
vec4 ormMezcla = mix(oP, oT, mz);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(roughness * mix(ormMezcla.g * 2.8, ormMezcla.g * 1.7, mz), 0.55, 1.0);')
      .replace('#include <normal_fragment_maps>', `
vec3 nP = dosEscalas(tPastoN, uA, uB, lejos).xyz * 2.0 - 1.0, nT = dosEscalas(tTierraN, uA * 1.1, uB * 1.1, lejos).xyz * 2.0 - 1.0;
vec3 mapN = normalize(mix(nP, nT, mz));
mapN.xy *= normalScale * (1.0 - 0.6 * lejos);
normal = normalize(tbn * mapN);`)
      .replace('texture2D( aoMap, vAoMapUv ).r', 'ormMezcla.r');
  };
  mat.customProgramCacheKey = () => 'terreno-v1';
  return mat;
}
const ground = new THREE.Mesh(gGeo, fotosActivas ? materialTerreno()
  : new THREE.MeshStandardMaterial({ vertexColors: true, map: grayDetail(G / 7), normalMap: gravelN, normalScale: new THREE.Vector2(0.45, 0.45), roughness: 1 }));
ground.receiveShadow = true;
scene.add(ground);

// Senderos de grava desde la plaza a cada estación cercana: una sola malla con bordes irregulares
const SENDEROS = [];
{
  const partes = [];
  for (const l of LAYOUT) {
    if (l.id === 'autos') continue;
    const L = Math.hypot(l.pos[0], l.pos[1]);
    if (L - 6 < 4) continue;
    const ux = l.pos[0] / L, uz = l.pos[1] / L, n = Math.ceil(L - 6);
    SENDEROS.push({ id: l.id, ux, uz, s0: 3, s1: L - 3, L });
    const pos = [], uv = [], idx = [];
    for (let k = 0; k <= n; k++) {
      const s = 3 + ((L - 6) * k) / n;
      for (const lado of [-1, 1]) {
        const w = 1.2 + noise.noise(s / 2.3, lado * 3.7, L) * 0.3 + noise.noise(s / 0.7, lado * 5.1, L) * 0.08;
        pos.push(ux * s - uz * w * lado, 0.02, uz * s + ux * w * lado);
        uv.push((lado * w) / 2.4 + 0.5, s / 3);
      }
      if (k) { const a = (k - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { const ix = g.index; for (let i = 0; i < ix.count; i += 3) { const t = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, t); } g.computeVertexNormals(); }
    partes.push(g);
  }
  const pathMat = surfaceMaterial('gravel', { size: 256, seed: 8, repeat: [1, 1], color: 0x9a907f, roughness: 1, normalScale: 0.6 });
  pathMat.polygonOffset = true; pathMat.polygonOffsetFactor = -2;
  const senderos = new THREE.Mesh(mergeGeometries(partes), pathMat);
  senderos.receiveShadow = true;
  scene.add(senderos);
}
// Plaza de inicio: losa de hormigón con juntas de dilatación y manchas
{
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), f = fbm(S, 6, 5, 12), img = g.createImageData(S, S);
  for (let i = 0; i < f.length; i++) { const v = 196 + (f[i] - 0.5) * 44; img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.985; img.data[i * 4 + 2] = v * 0.95; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const rng = mulberry32(14);
  for (let i = 0; i < 9; i++) {
    const x = S * (0.15 + 0.7 * rng()), y = S * (0.15 + 0.7 * rng()), r = 18 + rng() * 50, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(70,62,52,${0.08 + rng() * 0.1})`); gr.addColorStop(1, 'rgba(70,62,52,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.strokeStyle = 'rgba(55,52,48,0.75)'; g.lineWidth = 2.2;
  for (const r of [0.18, 0.36]) { g.beginPath(); g.arc(S / 2, S / 2, S * r, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.13; g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * S * 0.18, S / 2 + Math.sin(a) * S * 0.18); g.lineTo(S / 2 + Math.cos(a) * S * 0.5, S / 2 + Math.sin(a) * S * 0.5); g.stroke(); }
  g.strokeStyle = 'rgba(60,56,50,0.5)'; g.lineWidth = 7; g.beginPath(); g.arc(S / 2, S / 2, S * 0.493, 0, Math.PI * 2); g.stroke();
  const mapa = new THREE.CanvasTexture(c); mapa.colorSpace = THREE.SRGBColorSpace; mapa.anisotropy = 4;
  const mat = surfaceMaterial('concrete', { size: 256, seed: 5, repeat: [4, 4], color: 0xffffff, roughness: 1, normalScale: 0.5 });
  mat.map = mapa; mat.color.setRGB(0.92, 0.92, 0.92);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 48), mat);
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.03; plaza.receiveShadow = true; scene.add(plaza);
}

// ------------------------------------------------------------------ estaciones
const kit = crearKit(app);
kit.sueloH = sueloH;
const estaciones = [];
const grupoDe = new Map();

function aMundo(est, v) { return new THREE.Vector3(...v).applyMatrix4(est.grupo.matrixWorld); }

// Parámetros de la dirección para revisar una estación: solo=1 carga únicamente la estación pedida (sin estación, ninguna),
// ui=0 oculta la interfaz, cam=x,y,z y mira=x,y,z ubican la cámara en coordenadas de la estación (sin estación, del mundo),
// vr=1 pone la cámara donde queda la persona en VR y aplica las distancias de visibilidad de VR, info=1 muestra las llamadas
// de dibujo y los triángulos del último cuadro y rev=caminar:t deja a las personas que caminan detenidas en el instante t.
const PARAMS = new URLSearchParams(location.search);
const VR_REVISION = PARAMS.get('vr') === '1';
const enVR = () => renderer.xr.isPresenting || VR_REVISION;

async function cargarEstaciones() {
  const solo = PARAMS.get('solo') === '1', soloUna = solo ? PARAMS.get('estacion') : null;
  for (const l of LAYOUT) {
    if (solo && l.id !== soloUna) continue;
    const grupo = new THREE.Group();
    grupo.position.set(l.pos[0], 0, l.pos[1]);
    grupo.rotation.y = l.yaw;
    scene.add(grupo);
    grupo.updateMatrixWorld(true);
    const est = { id: l.id, layout: l, grupo, def: null, api: null, error: null };
    est.habilitado = () => grupo.visible;
    est.activa = () => activa === est;
    try {
      loading(`Construyendo: ${l.id}…`);
      await ceder();
      const mod = await import(`./estaciones/${l.id}.js`);
      est.def = mod.default;
      est.api = est.def.crear(kit, est) || {};
      for (const p of est.api.paneles || []) p.update(performance.now());
    } catch (err) {
      console.error('Estación', l.id, err);
      est.error = err;
      const cartel = kit.etiqueta(`Estación «${l.id}» en construcción`, 0.5);
      cartel.position.set(0, 2, 0); grupo.add(cartel);
      est.def = { id: l.id, titulo: l.id, etiqueta: '', resumen: '' };
      est.api = { vista: { escritorio: { camara: [0, 4, 10], objetivo: [0, 1, 0] }, vr: { pos: [0, 0, 6], yaw: 0 } } };
    }
    // cartel con el nombre, visible desde lejos (se oculta mientras hay una estación abierta)
    const nombre = kit.etiqueta(est.def.titulo || l.id, 0.55, { bg: 'rgba(255,179,71,0.92)', color: '#1a1206' });
    nombre.position.set(0, est.api.alturaCartel ?? 4.2, 0).applyMatrix4(grupo.matrixWorld);
    nombre.userData.cartel = true;
    scene.add(nombre);
    est.cartel = nombre;
    // gráficos de la estación: en el escritorio se dibujan en su propio recuadro, junto al panel
    est.graficos = [];
    grupo.traverse((o) => { if (o.userData.tipo === 'grafico') est.graficos.push(o); });
    if (!est.error) { acomodarVR(est); est.acomodarVR = (v) => acomodarVR(est, v); }
    // 3) los objetos pequeños no proyectan sombra (ahorra llamadas de dibujo en el paso de sombras)
    const esfera = new THREE.Sphere(), escala = new THREE.Vector3();
    grupo.updateMatrixWorld(true);
    grupo.traverse((o) => {
      if (!o.isMesh || !o.castShadow || o.isInstancedMesh || !o.geometry) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.getWorldScale(escala);
      if (o.geometry.boundingSphere.radius * Math.max(escala.x, escala.y, escala.z) < 0.12) o.castShadow = false;
    });
    estaciones.push(est);
    grupoDe.set(l.id, est);
  }
}

// En realidad virtual, el panel queda abajo a la izquierda y el gráfico abajo a la derecha de quien mira, inclinados hacia
// sus ojos, a unos 42° del centro. Así el centro de la vista queda libre para la escena y sus rótulos en todas las estaciones.
function acomodarVR(est, vista = null) {
  const v = vista || est.api.vista.vr;
  const yaw = v.yaw || 0, base = new THREE.Vector3(v.pos[0], (v.pos[1] || 0), v.pos[2]);
  const adelante = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), izquierda = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
  // una estación puede abrir más el ángulo o subir la altura si su escena ocupa los costados bajos (api.laminaVR)
  const L = { angulo: 47, distancia: 1.3, escala: 0.78, altura: 1.02, ...(est.api.laminaVR || {}) };
  const poner = (obj, lado, ancho, alto, centro) => {
    est.grupo.attach(obj);
    const a = THREE.MathUtils.degToRad(L.angulo), d = L.distancia, k = L.escala;
    const p = base.clone().addScaledVector(adelante, d * Math.cos(a)).addScaledVector(izquierda, lado * d * Math.sin(a));
    const giro = yaw + lado * a;           // de frente a la persona
    obj.rotation.set(0, 0, 0); obj.quaternion.setFromEuler(new THREE.Euler(-0.38, giro, 0, 'YXZ'));
    obj.scale.setScalar(k);
    // la posición indicada es la del centro del objeto, que queda bajo la línea de los ojos
    const c = centro.clone().multiplyScalar(k).applyQuaternion(obj.quaternion);
    obj.position.copy(p).add(new THREE.Vector3(0, L.altura, 0)).sub(c);
    void ancho; void alto;
  };
  const paneles = est.api.paneles || [];
  paneles.forEach((pn, i) => poner(pn.mesh, 1, pn.width, pn.height, new THREE.Vector3(0, i * -(pn.height + 0.05), 0)));
  est.graficos.forEach((g, i) => {
    const f = g.userData.fondo;
    poner(g, -1, f.geometry.parameters.width, f.geometry.parameters.height, f.position.clone().add(new THREE.Vector3(0, i * (f.geometry.parameters.height + 0.05), 0)));
  });
}

// ------------------------------------------------------------------ navegación
let activa = null;
let vuelo = null; // animación de cámara en escritorio
function irA(est) {
  if (activa && activa !== est) { try { activa.api?.alSalir?.(); } catch (err) { console.error(activa.id, err); } }
  activa = est;
  const v = est ? est.api.vista : null;
  if (renderer.xr.isPresenting) {
    if (est) {
      const p = aMundo(est, v.vr.pos);
      app.teleportRig([p.x, sueloH(p.x, p.z) + (v.vr.pos[1] || 0), p.z], est.layout.yaw + (v.vr.yaw || 0));
    } else app.teleportRig([PLAZA.pos[0], 0, PLAZA.pos[1] + 3], 0);
  } else {
    const cam = est ? aMundo(est, v.escritorio.camara) : new THREE.Vector3(0, 1.7, 8);
    const obj = est ? aMundo(est, v.escritorio.objetivo) : new THREE.Vector3(0, 1.4, -6);
    vuelo = { t: 0, dur: 1.1, c0: camera.position.clone(), o0: orbit.target.clone(), c1: cam, o1: obj };
  }
  construirControles();
  actualizarHud();
  marcarMenu();
  montarLamina();
  for (const e of estaciones) if (e.cartel) e.cartel.visible = !est;
  menuVR.invalidate();
  narrar(est);
  const url = new URL(location.href);
  if (est) url.searchParams.set('estacion', est.id); else url.searchParams.delete('estacion');
  history.replaceState(null, '', url);
}

// ------------------------------------------------------------------ narración en audio de cada escena
const SIN_NARRACION = PARAMS0.get('ui') === '0' || PARAMS0.get('narracion') === '0';
const narrador = crearNarrador({
  base: new URL('../assets/audio/', import.meta.url).href,
  alTexto: (t) => { const el = $('subtitulo'); if (el) { el.textContent = t; el.hidden = !t || !subtitulosVisibles(); } },
  alEstado: () => { actualizarBotonesNarracion(); menuVR?.invalidate?.(); },
});
const subtitulosVisibles = () => !renderer.xr.isPresenting;
function narrar(est) { if (!SIN_NARRACION) narrador.reproducir(est ? est.api?.narracion?.() || est.id : 'obra'); }
function actualizarBotonesNarracion() {
  const b = $('btn-narracion');
  if (b) { b.textContent = narrador.activo() ? 'Narración: sí' : 'Narración: no'; b.setAttribute('aria-pressed', String(narrador.activo())); }
}
kit.narrar = (id) => { if (!SIN_NARRACION) narrador.reproducir(id); };

// ------------------------------------------------------------------ menú en VR (sujeto al usuario)
const BOT = [{ id: null, t: 'Plaza' }, ...LAYOUT.map((l) => ({ id: l.id }))];
const MW = Math.round(0.62 * 760), MH = Math.round(0.95 * 760);
const menuVR = createPanel({
  width: 0.62, height: 0.95, ppm: 760, title: 'ESTACIONES',
  draw(ctx, W, H) {
    ctx.fillStyle = THEME.dim; ctx.font = font(H * 0.026, 400); ctx.textAlign = 'left';
    ctx.fillText('Apunta y aprieta el gatillo para ir', W * 0.06, H * 0.104);
  },
  widgets: [...BOT.map((b, i) => ({
    type: 'toggle', id: 'm' + i, x: MW * 0.06, y: MH * (0.13 + i * 0.061), w: MW * 0.88, h: MH * 0.051, fontScale: 0.42,
    label: () => (b.id ? (grupoDe.get(b.id)?.def?.titulo || b.id) : 'Plaza de inicio'),
    get: () => (b.id ? activa?.id === b.id : activa === null), set: () => irA(b.id ? grupoDe.get(b.id) : null),
  })),
  { type: 'toggle', id: 'narr', x: MW * 0.06, y: MH * (0.13 + BOT.length * 0.061 + 0.008), w: MW * 0.42, h: MH * 0.051, fontScale: 0.4,
    label: () => (narrador.activo() ? 'Narración: sí' : 'Narración: no'), get: () => narrador.activo(), set: () => narrador.setActivo(!narrador.activo()) },
  { type: 'button', id: 'rep', x: MW * 0.52, y: MH * (0.13 + BOT.length * 0.061 + 0.008), w: MW * 0.42, h: MH * 0.051, fontScale: 0.4,
    label: 'Repetir', onClick: () => narrador.repetir() }],
});
menuVR.mesh.position.set(-0.55, 1.05, -0.45);
menuVR.mesh.rotation.set(-0.5, 0.75, 0.0, 'YXZ');
rig.add(menuVR.mesh);
menuVR.register(input, () => renderer.xr.isPresenting);
menuVR.mesh.visible = false;

// ------------------------------------------------------------------ DOM
const $ = (id) => document.getElementById(id);

function construirMenuDom() {
  const ul = $('menu-lista');
  ul.innerHTML = '';
  const li0 = document.createElement('li');
  li0.innerHTML = '<button class="btn" data-id="">Plaza de inicio</button>';
  ul.appendChild(li0);
  const grupos = [['optimizacion', 'Optimización'], ['razon', 'Razón de cambio']];
  for (const [tipo, nombre] of grupos) {
    const h = document.createElement('li'); h.className = 'grupo'; h.textContent = nombre; ul.appendChild(h);
    for (const est of estaciones.filter((e) => (e.def.tipo || 'optimizacion') === tipo)) {
      const li = document.createElement('li');
      li.innerHTML = `<button class="btn" data-id="${est.id}"><span>${est.def.titulo}</span><small>${est.def.etiqueta || ''}</small></button>`;
      ul.appendChild(li);
    }
  }
  ul.querySelectorAll('button').forEach((b) => { b.onclick = () => irA(b.dataset.id ? grupoDe.get(b.dataset.id) : null); });
}
function marcarMenu() {
  document.querySelectorAll('#menu-lista button').forEach((b) => b.classList.toggle('on', (b.dataset.id || null) === (activa ? activa.id : null)));
}
function actualizarHud() {
  $('hud-etiqueta').textContent = activa ? activa.def.etiqueta || '' : 'Guía 4 · Optimización y razón de cambio';
  $('hud-titulo').textContent = activa ? activa.def.titulo : 'La obra';
  $('hud-texto').textContent = activa ? activa.def.resumen || '' : 'Elige una estación en el menú. Cada una modela un problema de la guía con su función objetivo o con las razones de cambio relacionadas.';
}
let controlesDom = [];
function construirControles() {
  const bar = $('controls');
  bar.innerHTML = '';
  controlesDom = [];
  const defs = activa?.api?.dom || [];
  bar.style.display = defs.length && !renderer.xr.isPresenting ? '' : 'none';
  for (const d of defs) {
    if (d.tipo === 'rango') {
      const lab = document.createElement('label');
      lab.innerHTML = `${d.etiqueta} <input type="range" min="${d.min}" max="${d.max}" step="${d.paso}"><output></output>`;
      const inp = lab.querySelector('input'), out = lab.querySelector('output');
      inp.oninput = () => d.set(parseFloat(inp.value));
      controlesDom.push(() => { if (document.activeElement !== inp) inp.value = String(d.get()); out.textContent = d.formato ? d.formato(d.get()) : String(d.get()); });
      bar.appendChild(lab);
    } else {
      const b = document.createElement('button');
      b.className = 'btn';
      b.onclick = () => (d.tipo === 'interruptor' ? d.set(!d.get()) : d.accion());
      controlesDom.push(() => {
        b.textContent = typeof d.etiqueta === 'function' ? d.etiqueta() : d.etiqueta;
        if (d.tipo === 'interruptor') b.classList.toggle('on', !!d.get());
      });
      bar.appendChild(b);
    }
  }
}
$('menu-toggle').onclick = () => { const c = document.body.classList.toggle('menu-cerrado'); $('menu-toggle').setAttribute('aria-expanded', String(!c)); };
$('btn-enunciado').onclick = () => { const s = $('enunciado'); s.hidden = !s.hidden; $('btn-enunciado').setAttribute('aria-expanded', String(!s.hidden)); };
$('vr-slot').appendChild(app.vrButton);

// ------------------------------------------------------------------ vistas de escritorio
// El lienzo cubre la ventana y se dibuja en rectángulos que no se superponen: la escena en #escena y cada gráfico de la
// estación abierta en su recuadro de la lámina. El panel de la estación se muestra en la lámina con su propio lienzo.
// En realidad virtual el panel y los gráficos vuelven a estar en el espacio, frente a la persona.
const CAPA_GRAF = 6, CAPA_PANEL = 7;
const $esc = $('escena'), $pan = $('paneles'), $lam = $('lamina');
const rectDe = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
let insets = []; // [{ grafico, div, cam }]
function sincronizarCapas() {
  for (const est of estaciones) {
    for (const g of est.graficos || []) g.traverse((o) => o.layers.set(CAPA_GRAF));
    for (const p of est.api?.paneles || []) p.mesh.layers.set(CAPA_PANEL);
  }
}
function encuadrarGrafico(ins, r) {
  const f = ins.grafico.userData.fondo;
  f.updateWorldMatrix(true, false);
  const c = new THREE.Vector3().setFromMatrixPosition(f.matrixWorld);
  const q = f.getWorldQuaternion(new THREE.Quaternion()), s = f.getWorldScale(new THREE.Vector3());
  const pw = f.geometry.parameters.width * s.x, ph = f.geometry.parameters.height * s.y;
  const cam = ins.cam;
  cam.position.copy(c).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(q), 1);
  cam.up.copy(new THREE.Vector3(0, 1, 0).applyQuaternion(q)); cam.lookAt(c);
  const A = r.width / Math.max(1, r.height);
  let hw = (pw / 2) * 1.02, hh = (ph / 2) * 1.02;
  if (hw / hh > A) hh = hw / A; else hw = hh * A;
  cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.near = 0.5; cam.far = 1.6;
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
}
const colorLamina = new THREE.Color(0x0e1724);
app.renderizar = (r, sc, cam) => {
  const H = window.innerHeight, re = rectDe($esc);
  const aj = (q) => { const y = H - q.top - q.height; r.setViewport(q.left, y, q.width, q.height); r.setScissor(q.left, y, q.width, q.height); };
  r.setScissorTest(true);
  if (re.width > 2 && re.height > 2) {
    aj(re);
    const asp = re.width / re.height;
    if (Math.abs(cam.aspect - asp) > 1e-3) { cam.aspect = asp; cam.updateProjectionMatrix(); }
    r.render(sc, cam);
  }
  for (const ins of insets) {
    const rg = rectDe(ins.div);
    if (rg.width < 2 || rg.height < 2 || rg.top > H || rg.top + rg.height < 0) continue;
    encuadrarGrafico(ins, rg); aj(rg);
    const fondo = sc.background, auto = r.shadowMap.autoUpdate;
    sc.background = colorLamina; r.shadowMap.autoUpdate = false;
    r.render(sc, ins.cam);
    sc.background = fondo; r.shadowMap.autoUpdate = auto;
  }
  r.setScissorTest(false);
  r.setViewport(0, 0, window.innerWidth, H);
};
input.setVistas(() => [{ rect: rectDe($esc), camera, mascara: 1 }, ...insets.map((i) => ({ rect: rectDe(i.div), camera: i.cam, mascara: 1 << CAPA_GRAF }))]);
input.setMascaraXR(1 | (1 << CAPA_GRAF) | (1 << CAPA_PANEL));
// arrastrar sobre un gráfico no gira la escena
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (insets.some((i) => { const r = rectDe(i.div); return e.clientX >= r.left && e.clientX <= r.left + r.width && e.clientY >= r.top && e.clientY <= r.top + r.height; })) orbit.enabled = false;
}, true);
window.addEventListener('pointerup', () => { if (!renderer.xr.isPresenting) orbit.enabled = true; });

function montarLamina() {
  $pan.replaceChildren();
  for (const i of insets) i.div.remove();
  insets = [];
  if (!activa) {
    const p = document.createElement('p');
    p.textContent = 'Elige una estación en el menú. Cada una modela un problema de optimización o de razón de cambio con su función objetivo o con la relación entre las razones, un panel y un gráfico.';
    $pan.appendChild(p);
    return;
  }
  if (renderer.xr.isPresenting) return;
  for (const p of activa.api?.paneles || []) {
    const c = p.canvas;
    c.setAttribute('role', 'application'); c.setAttribute('aria-label', 'Panel de la estación');
    const hit = (e) => { const r = c.getBoundingClientRect(); return { uv: { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height } }; };
    c.onpointerdown = (e) => { p.handlers.onDown(hit(e), null); try { c.setPointerCapture(e.pointerId); } catch { /* sin captura */ } };
    c.onpointermove = (e) => { if (p.activeId) p.handlers.onMove(hit(e), null); else p.handlers.onHover(hit(e)); };
    c.onpointerup = () => p.handlers.onUp();
    c.onpointerleave = () => { if (!p.activeId) p.handlers.onLeave(); };
    $pan.appendChild(c);
  }
  for (const g of activa.graficos || []) {
    const div = document.createElement('div');
    div.className = 'grafico';
    div.setAttribute('aria-label', 'Gráfico de la estación');
    const prm = g.userData.fondo.geometry.parameters;
    div.style.aspectRatio = String((prm.width / prm.height).toFixed(3));
    $lam.appendChild(div);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 1.6);
    cam.layers.set(CAPA_GRAF);
    insets.push({ grafico: g, div, cam });
  }
}

app.onXR((on) => {
  menuVR.mesh.visible = on;
  for (const id of ['barra', 'enunciado', 'menu', 'lamina', 'controls']) $(id).style.visibility = on ? 'hidden' : '';
  if (on) { camera.layers.enable(CAPA_GRAF); camera.layers.enable(CAPA_PANEL); } else { camera.layers.disable(CAPA_GRAF); camera.layers.disable(CAPA_PANEL); }
  if (on) { narrador.liberar(); irA(activa); } else { construirControles(); montarLamina(); }
  const sub = $('subtitulo'); if (sub && on) sub.hidden = true;
});

// ------------------------------------------------------------------ bucle
const tmp = new THREE.Vector3();
let ultimaVisibilidad = 0, ultimaSombra = 0, ultimoDom = 0;
app.onUpdate((dt) => {
  const now = performance.now();
  // vuelo de cámara
  if (vuelo && !renderer.xr.isPresenting) {
    vuelo.t += dt / vuelo.dur;
    const k = vuelo.t >= 1 ? 1 : 1 - Math.pow(1 - vuelo.t, 3);
    camera.position.lerpVectors(vuelo.c0, vuelo.c1, k);
    orbit.target.lerpVectors(vuelo.o0, vuelo.o1, k);
    if (vuelo.t >= 1) vuelo = null;
  }
  camera.getWorldPosition(tmp);
  // visibilidad por distancia y estación activa por cercanía (en VR al caminar)
  if (now - ultimaVisibilidad > 400) {
    ultimaVisibilidad = now;
    let cercana = null, dmin = Infinity;
    for (const est of estaciones) {
      const d = Math.hypot(tmp.x - est.grupo.position.x, tmp.z - est.grupo.position.z);
      est.distancia = d;
      const radio = enVR() ? 16 : (est.api?.radioVisible ?? 190); // en VR, solo la estación donde está la persona y las muy cercanas
      est.grupo.visible = d < radio + (est.api?.radioSombra ?? 10) || est === activa;
      if (d < dmin) { dmin = d; cercana = est; }
    }
    if (renderer.xr.isPresenting && cercana && dmin < 16 && cercana !== activa) { activa = cercana; menuVR.invalidate(); narrar(activa); }
  }
  for (const est of estaciones) {
    if (!est.api || est.error) continue;
    if (est === activa || (est.distancia ?? 999) < 70) {
      try { est.api.actualizar?.(dt, est === activa); } catch (err) { console.error(est.id, err); est.error = err; }
      for (const p of est.api.paneles || []) p.update(now);
    }
  }
  // sombras alrededor de la estación activa o de la cámara
  if (now - ultimaSombra > 700) {
    ultimaSombra = now;
    const so = activa?.api?.sombra?.();
    const c = so ? so.centro : activa ? activa.grupo.position : tmp;
    const half = so ? so.half : activa?.api?.radioSombra ?? 30;
    sky.setShadow(new THREE.Vector3(c.x, 0, c.z), half, { size: 2048, bias: -0.0004, normalBias: 0.05 });
    const sc = sky.light.shadow.camera; sc.near = 600 - half * 2 - 60; sc.far = 600 + half * 2 + 60; sc.updateProjectionMatrix();
  }
  if (now - ultimoDom > 120) { ultimoDom = now; for (const f of controlesDom) f(); }
  sincronizarCapas();
  menuVR.update(now);
  if (entorno) { try { entorno.actualizar(dt); } catch (err) { console.error('Entorno', err); errorEntorno = err; entorno = null; } }
});

// ------------------------------------------------------------------ entorno: vegetación, cerco, faena, acopios y personas
let entorno = null, errorEntorno = null;
async function cargarEntorno() {
  try {
    loading('Preparando el entorno…');
    await ceder();
    const { crearEntorno } = await import('./entorno.js');
    entorno = crearEntorno({ app, kit, sueloH, roadMask, LAYOUT, SITE, CERCO, distCerco, SENDEROS, estaciones, enVR, rev: PARAMS.get('rev') });
  } catch (err) {
    console.error('Entorno', err);
    errorEntorno = err; entorno = null;
  }
}

// ------------------------------------------------------------------ arranque
await cargarEstaciones();
await cargarEntorno();
construirMenuDom();
const pedida = new URLSearchParams(location.search).get('estacion');
const inicial = pedida ? grupoDe.get(pedida) : null;
if (inicial) {
  activa = inicial;
  const v = inicial.api.vista;
  camera.position.copy(aMundo(inicial, v.escritorio.camara));
  orbit.target.copy(aMundo(inicial, v.escritorio.objetivo)); orbit.update();
}
construirControles(); actualizarHud(); marcarMenu(); sincronizarCapas(); montarLamina();
for (const e of estaciones) if (e.cartel) e.cartel.visible = !activa;
loading(null);
$('btn-narracion').onclick = () => narrador.setActivo(!narrador.activo());
$('btn-repetir').onclick = () => narrador.repetir();
actualizarBotonesNarracion();
narrar(inicial);
if (inicial && PARAMS.has('cam')) {
  const n = (k, d) => (PARAMS.has(k) ? PARAMS.get(k).split(',').map(Number) : d);
  camera.position.copy(aMundo(inicial, n('cam', [0, 3, 8])));
  orbit.target.copy(aMundo(inicial, n('mira', [0, 1, 0]))); orbit.update();
} else if (inicial && PARAMS.get('vr') === '1') {
  const v = inicial.api.vista.vr, p = aMundo(inicial, v.pos), yaw = inicial.layout.yaw + (v.yaw || 0);
  camera.position.set(p.x, sueloH(p.x, p.z) + (v.pos[1] || 0) + 1.6, p.z);
  orbit.target.set(p.x - Math.sin(yaw) * 3, camera.position.y - 0.7, p.z - Math.cos(yaw) * 3); orbit.update();
  camera.fov = 90; camera.updateProjectionMatrix();
  // en la revisión de VR el panel y el gráfico se ven en el espacio, como en las gafas
  camera.layers.enable(CAPA_GRAF); camera.layers.enable(CAPA_PANEL);
} else if (!inicial && PARAMS.has('cam')) {
  const n = (k, d) => (PARAMS.has(k) ? PARAMS.get(k).split(',').map(Number) : d);
  camera.position.set(...n('cam', [0, 1.7, 8]));
  orbit.target.set(...n('mira', [0, 1.4, -6])); orbit.update();
  if (VR_REVISION) { camera.fov = 90; camera.updateProjectionMatrix(); }
} else if (!inicial && VR_REVISION) {
  // desde la plaza, donde empieza la sesión de VR
  camera.position.set(app.xrStart.position[0], 1.6, app.xrStart.position[2]);
  orbit.target.set(app.xrStart.position[0], 0.9, app.xrStart.position[2] - 3); orbit.update();
  camera.fov = 90; camera.updateProjectionMatrix();
}
if (PARAMS.get('ui') === '0') document.body.classList.add('sin-ui');
if (PARAMS.get('info') === '1') {
  const div = $('info');
  renderer.info.autoReset = false;
  app.onUpdate(() => {
    const errores = estaciones.filter((e) => e.error).map((e) => `${e.id}: ${e.error?.message || e.error}`).concat(errorEntorno ? [`entorno: ${errorEntorno.message || errorEntorno}`] : []).join(' | ');
    div.textContent = `llamadas ${renderer.info.render.calls} · triángulos ${renderer.info.render.triangles} · geometrías ${renderer.info.memory.geometries} · texturas ${renderer.info.memory.textures}` + (errores ? ` · ERROR ${errores}` : ' · sin errores');
    renderer.info.reset();
  });
}
// ------------------------------------------------------------------ revisión de solapamientos (desarrollo)
// Proyecta en la pantalla los rótulos, paneles y gráficos visibles de una estación y lista los pares que se superponen,
// desde la cámara de escritorio o desde el lugar donde queda la persona en realidad virtual.
function visibleEnArbol(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
function dentroDeGrafico(o) { for (let p = o.parent; p; p = p.parent) if (p.userData.tipo === 'grafico') return true; return false; }
function camaraVR(est, pitch = -0.28) {
  const v = est.api.vistaVR?.() || est.api.vista.vr, p = aMundo(est, v.pos), yaw = est.layout.yaw + (v.yaw || 0);
  const cam = new THREE.PerspectiveCamera(98, 1.0, 0.05, 5000);
  cam.position.set(p.x, sueloH(p.x, p.z) + (v.pos[1] || 0) + 1.6, p.z);
  cam.rotation.set(pitch, yaw, 0, 'YXZ'); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  return cam;
}
function rectPantalla(obj, cam) {
  obj.updateWorldMatrix(true, true);
  const caja = new THREE.Box3().setFromObject(obj);
  if (caja.isEmpty()) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, delante = 0;
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? caja.max.x : caja.min.x, i & 2 ? caja.max.y : caja.min.y, i & 4 ? caja.max.z : caja.min.z).project(cam);
    if (v.z < 1 && v.z > -1) delante++;
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  if (delante < 8 || x1 < -1 || x0 > 1 || y1 < -1 || y0 > 1) return null;
  return [Math.max(-1, x0), Math.max(-1, y0), Math.min(1, x1), Math.min(1, y1)];
}
function solapes(id, { vr = false, umbral = 0.04 } = {}) {
  const est = grupoDe.get(id);
  const cam = vr ? camaraVR(est) : camera;
  const items = [];
  const raiz = [est.grupo, ...scene.children.filter((o) => o.userData.cartel)];
  for (const r of raiz) r.traverse((o) => {
    if (!visibleEnArbol(o)) return;
    if (o.userData.tipo === 'etiqueta' && !dentroDeGrafico(o)) items.push({ o, tipo: 'rótulo', nombre: o.userData.texto || '' });
    else if (vr && o.userData.tipo === 'panel') items.push({ o, tipo: 'panel', nombre: 'panel' });
    else if (vr && o.userData.tipo === 'grafico') items.push({ o: o.userData.fondo, tipo: 'gráfico', nombre: 'gráfico' });
  });
  for (const it of items) it.r = rectPantalla(it.o, cam);
  const vis = items.filter((i) => i.r);
  const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);
  const pares = [];
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i].r, b = vis[j].r;
    const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
    if (w <= 0 || h <= 0) continue;
    const f = (w * h) / Math.min(area(a), area(b));
    if (f > umbral) pares.push(`${vis[i].tipo} «${vis[i].nombre}» / ${vis[j].tipo} «${vis[j].nombre}» (${Math.round(f * 100)} %)`);
  }
  return { vistos: vis.map((i) => `${i.tipo} «${i.nombre}»`), pares };
}

window.__g4 = { app, kit, estaciones, irA, grupoDe, sueloH, entorno, distCerco, solapes };
