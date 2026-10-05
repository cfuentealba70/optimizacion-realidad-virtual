// Valle con un río, una planta eléctrica y una fábrica. El poste naranja define x en la función
// objetivo C(x, y) = 90x + 150y, con y = raíz((500 - x)^2 + 100^2) y 0 <= x <= 500. Modo maqueta (sobre una mesa) y modo escala real.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createApp, loading } from '../src/common/app.js';
import { createSky } from '../src/common/sky.js';
import { surfaceMaterial, makeSurface, fbm, windowsTexture, windowsColorTexture, mulberry32 } from '../src/common/textures.js';
import { createWater } from '../src/common/water.js';
import { createPanel, createLabel, setLabelText, THEME, font, wrapText } from '../src/common/panel.js';
import { createPlot } from '../src/common/plot3d.js';
import { RIO, formatoPesos, formatoNum } from '../src/math/problems.js';

loading('Construyendo el valle…');
await new Promise((r) => setTimeout(r, 30));

// ------------------------------------------------------------------ parámetros
const S_MAQ = 0.0018;                 // escala de la maqueta: 500 m son 0,9 m
const MAP_C = { x: 260, z: -50 };     // punto del mapa que queda en el centro de la mesa
const TABLE = { y: 0.9, z: -0.55 };
const ZS_NEAR = 3.5, ZS_FAR = -103.5; // línea de postes junto a cada orilla
const W_Y = -0.25;                    // nivel del agua
const PAD_H = 0.9;
const state = { x: 150, mode: 'maqueta', reveal: false, dirty: true };

// ------------------------------------------------------------------ aplicación base
const app = createApp({
  camera: { position: [-0.1, 1.5, 2.75], target: [-0.4, 1.05, -0.7] },
  orbit: { minDistance: 0.25, maxDistance: 8, maxPolarAngle: Math.PI * 0.53 },
  xrStart: { position: [0, 0, 0.95], yaw: 0 },
  exposure: 0.78, background: 0x9fb8d0, far: 30000, near: 0.04,
});
const { scene, renderer, input, rig, camera, orbit } = app;
const sky = createSky(scene, renderer, { elevation: 27, azimuth: 205, turbidity: 3.4, rayleigh: 1.25, sunIntensity: 3.6, fogDensity: 0.0006 });
scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x6d6a55, 0.32));
const sunL = sky.light;

const world = new THREE.Group();
scene.add(world);

// ------------------------------------------------------------------ terreno
const noise = new ImprovedNoise();
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const n2 = (x, z, f, o = 0) => noise.noise(x * f + o, 3.7, z * f + o);
const fbm2 = (x, z) => n2(x, z, 1 / 160) * 0.55 + n2(x, z, 1 / 70, 11) * 0.3 + n2(x, z, 1 / 28, 23) * 0.15;
const PLANT = { cx: 12, cz: 44, hx: 54, hz: 36 };
const FACT = { cx: 500, cz: -160, hx: 62, hz: 46 };
function padW(x, z, p, b = 22) {
  const dx = Math.max(Math.abs(x - p.cx) - p.hx, 0), dz = Math.max(Math.abs(z - p.cz) - p.hz, 0);
  return 1 - sstep(0, b, Math.hypot(dx, dz));
}
function terrainH(x, z) {
  let h;
  if (z <= 0 && z >= -100) {
    const s = (z + 50) / 50;
    h = -0.3 - 3.4 * Math.pow(Math.max(0, 1 - s * s), 0.7);
  } else {
    const d = z > 0 ? z : -100 - z;
    const lev = -0.3 + 1.25 * sstep(0, 9, d);
    const hills = fbm2(x, z) * 0.5 + 0.5;
    h = lev + hills * (1.5 + 0.06 * d) * sstep(0, 14, d);
    const far = Math.max(0, Math.abs(z + 50) - 95);
    h += far * far * 0.0026 + far * 0.12;
    const edge = Math.max(0, Math.max(-150 - x, x - 650)); // bordes laterales que suben
    h += edge * 0.25 * (z > 0 || z < -100 ? 1 : 0);
  }
  const w1 = padW(x, z, PLANT), w2 = padW(x, z, FACT);
  h = h * (1 - w1) + PAD_H * w1;
  h = h * (1 - w2) + PAD_H * w2;
  return h;
}

const TX0 = -180, TX1 = 700, TZ0 = -250, TZ1 = 150, SEGX = 330, SEGZ = 150;
const tgeo = new THREE.PlaneGeometry(TX1 - TX0, TZ1 - TZ0, SEGX, SEGZ);
tgeo.rotateX(-Math.PI / 2);
tgeo.translate((TX0 + TX1) / 2, 0, (TZ0 + TZ1) / 2);
{
  const pos = tgeo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainH(x, z);
    pos.setY(i, h);
    const inR = z <= 0 && z >= -100;
    const d = z > 0 ? z : z < -100 ? -100 - z : 0;
    const nz = fbm2(x * 1.7 + 40, z * 1.7) * 0.5 + 0.5;
    const dry = sstep(0.55, 0.85, fbm2(x * 0.6 + 200, z * 0.6) * 0.5 + 0.5);
    let r = 0.17 + 0.1 * nz + dry * 0.1, g = 0.28 + 0.14 * nz + dry * 0.03, b = 0.09 + 0.05 * nz;
    const rock = sstep(10, 42, h);
    r = mix(r, 0.40, rock * 0.75); g = mix(g, 0.38, rock * 0.75); b = mix(b, 0.33, rock * 0.75);
    const shore = 1 - sstep(0, 6, d);
    r = mix(r, 0.55, shore * 0.85); g = mix(g, 0.50, shore * 0.85); b = mix(b, 0.40, shore * 0.85);
    if (inR) { const k = 0.55 + 0.45 * sstep(0, 5, Math.min(-z, 100 + z)); r = 0.20 * k; g = 0.20 * k; b = 0.16 * k; }
    const pad = Math.max(padW(x, z, PLANT, 8), padW(x, z, FACT, 8));
    r = mix(r, 0.46, pad); g = mix(g, 0.46, pad); b = mix(b, 0.44, pad);
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  tgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tgeo.computeVertexNormals();
}
function grayDetail(size = 256, base = 6, seed = 3) {
  const f = fbm(size, base, 5, seed);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const img = g.createImageData(size, size);
  for (let i = 0; i < f.length; i++) { const v = 150 + f[i] * 105; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.repeat.set((TX1 - TX0) / 9, (TZ1 - TZ0) / 9);
  return t;
}
const gravelN = makeSurface('gravel', { size: 256, seed: 3, repeat: [(TX1 - TX0) / 5, (TZ1 - TZ0) / 5], roughness: false }).normalMap;
const terrain = new THREE.Mesh(tgeo, new THREE.MeshStandardMaterial({
  vertexColors: true, map: grayDetail(), normalMap: gravelN, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.96, metalness: 0, envMapIntensity: 0.45,
}));
terrain.receiveShadow = true;
world.add(terrain);

// faldón: el terreno se ve como un bloque de maqueta
{
  const pos = tgeo.attributes.position, verts = [], ind = [];
  const e1 = [], e2 = [], e3 = [], e4 = [];
  for (let i = 0; i <= SEGX; i++) { e1.push(i); e2.push(SEGZ * (SEGX + 1) + i); }
  for (let j = 0; j <= SEGZ; j++) { e3.push(j * (SEGX + 1)); e4.push(j * (SEGX + 1) + SEGX); }
  for (const e of [e1, e2, e3, e4]) {
    const base = verts.length / 3;
    for (const vi of e) verts.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi), pos.getX(vi), -7, pos.getZ(vi));
    for (let k = 0; k < e.length - 1; k++) { const a = base + 2 * k; ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); sg.setIndex(ind); sg.computeVertexNormals();
  const skirt = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x4c3f31, roughness: 1, side: THREE.DoubleSide }));
  skirt.name = 'skirt'; world.add(skirt);
}

// agua
const water = createWater({ length: TX1 - TX0, width: 100, segX: 220, segZ: 20, y: W_Y });
water.mesh.position.set((TX0 + TX1) / 2, W_Y, -50);
world.add(water.mesh);

// ------------------------------------------------------------------ vegetación y rocas
const rng = mulberry32(42);
function colored(geo, hex, jitter = 0.08) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = 1 + (rng() - 0.5) * jitter; a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function treeGeo(kind) {
  const parts = [];
  const add = (g, y, hex) => { g.translate(0, y, 0); parts.push(colored(g.index ? g.toNonIndexed() : g, hex)); };
  if (kind === 'pine') {
    add(new THREE.CylinderGeometry(0.25, 0.4, 2.6, 6), 1.3, 0x4d3a2a);
    add(new THREE.ConeGeometry(2.8, 6, 7), 5.0, 0x1f4a2a);
    add(new THREE.ConeGeometry(2.2, 5, 7), 8.0, 0x24552f);
    add(new THREE.ConeGeometry(1.5, 4, 7), 10.6, 0x2b6035);
  } else if (kind === 'broad') {
    add(new THREE.CylinderGeometry(0.3, 0.5, 3.4, 6), 1.7, 0x57412e);
    const c1 = new THREE.IcosahedronGeometry(3.6, 0); c1.scale(1, 0.85, 1); add(c1, 6.2, 0x4e7436);
    const c2 = new THREE.IcosahedronGeometry(2.6, 0); c2.translate(1.7, 0, 0.5); add(c2, 4.6, 0x5d8440);
  } else { // álamo
    add(new THREE.CylinderGeometry(0.22, 0.34, 3, 6), 1.5, 0x5b4a38);
    const c = new THREE.IcosahedronGeometry(1.9, 0); c.scale(1, 3.4, 1); add(c, 9, 0x6b8f3a);
  }
  return mergeGeometries(parts);
}
const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
function scatterTrees(kind, n, pred) {
  const geo = treeGeo(kind);
  const mesh = new THREE.InstancedMesh(geo, treeMat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  let k = 0, tries = 0;
  while (k < n && tries < n * 40) {
    tries++;
    const x = TX0 + 20 + rng() * (TX1 - TX0 - 40), z = TZ0 + 10 + rng() * (TZ1 - TZ0 - 20);
    if (!pred(x, z)) continue;
    const y = terrainH(x, z);
    if (Math.abs(terrainH(x + 4, z) - y) > 2.2 || Math.abs(terrainH(x, z + 4) - y) > 2.2) continue;
    const sc = 0.8 + rng() * 0.9;
    p.set(x, y - 0.3, z); s.set(sc, sc * (0.9 + rng() * 0.3), sc); e.set(0, rng() * 6.28, 0); q.setFromEuler(e);
    m.compose(p, q, s); mesh.setMatrixAt(k, m);
    const t = 0.85 + rng() * 0.3; mesh.setColorAt(k, new THREE.Color(t, t, t)); k++;
  }
  mesh.count = k; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false; mesh.frustumCulled = false;
  world.add(mesh);
  return mesh;
}
const offPads = (x, z) => padW(x, z, PLANT, 30) < 0.02 && padW(x, z, FACT, 30) < 0.02;
const onLand = (x, z) => (z > 14 || z < -114) && offPads(x, z);
scatterTrees('pine', 300, (x, z) => onLand(x, z) && fbm2(x * 0.9, z * 0.9) > -0.05 && Math.abs(z + 50) > 60);
scatterTrees('broad', 240, (x, z) => onLand(x, z) && fbm2(x * 0.8 + 99, z * 0.8) > -0.2);
scatterTrees('poplar', 130, (x, z) => (z > 8 && z < 40 || z < -108 && z > -140) && offPads(x, z) && rng() < 0.8);

{ // juncos junto al agua
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d'); g.clearRect(0, 0, 128, 256);
  const r2 = mulberry32(5);
  for (let i = 0; i < 22; i++) {
    const x0 = 10 + r2() * 108, h = 140 + r2() * 110, lean = (r2() - 0.5) * 36;
    g.strokeStyle = `rgb(${70 + r2() * 40},${110 + r2() * 50},${40 + r2() * 30})`; g.lineWidth = 3 + r2() * 3;
    g.beginPath(); g.moveTo(x0, 256); g.quadraticCurveTo(x0 + lean * 0.3, 256 - h * 0.6, x0 + lean, 256 - h); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const a = new THREE.PlaneGeometry(1.8, 3.2); a.translate(0, 1.6, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const geo = mergeGeometries([a, b]);
  const n = 500, reeds = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const near = rng() < 0.5, x = TX0 + 30 + rng() * (TX1 - TX0 - 60), z = near ? 0.2 + rng() * 2.5 : -100.2 - rng() * 2.5;
    p.set(x, terrainH(x, z) - 0.1, z); const sc = 0.8 + rng() * 1.1; s.set(sc, sc, sc); e.set(0, rng() * 6.28, 0); q.setFromEuler(e);
    m.compose(p, q, s); reeds.setMatrixAt(i, m);
  }
  reeds.frustumCulled = false; world.add(reeds);
}
{ // rocas en las orillas
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const k = 0.8 + 0.35 * noise.noise(pos.getX(i) * 2.1, pos.getY(i) * 2.1, pos.getZ(i) * 2.1); pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k); }
  g.computeVertexNormals();
  const n = 160, rocks = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x8a8780, roughness: 0.95, flatShading: true }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const near = rng() < 0.5, x = TX0 + 30 + rng() * (TX1 - TX0 - 60), z = near ? -1.5 + rng() * 7 : -100 - (-1.5 + rng() * 7);
    const sc = 0.5 + rng() * rng() * 3.2; p.set(x, terrainH(x, z) + sc * 0.15, z); s.set(sc, sc * (0.7 + rng() * 0.4), sc * (0.8 + rng() * 0.5));
    e.set(rng() * 0.4, rng() * 6.28, rng() * 0.4); q.setFromEuler(e); m.compose(p, q, s); rocks.setMatrixAt(i, m);
  }
  rocks.frustumCulled = false; rocks.castShadow = true; world.add(rocks);
}

// ------------------------------------------------------------------ edificios
const matBrick = surfaceMaterial('brick', { size: 256, seed: 2, repeat: [10, 2], color: 0xe8e2da, roughness: 1, normalScale: 0.9 });
const matConc = surfaceMaterial('concrete', { size: 256, seed: 9, repeat: [6, 3], color: 0xd9d6cf, roughness: 1, normalScale: 0.5 });
const matRoof = surfaceMaterial('ribbed', { size: 256, seed: 4, repeat: [14, 3], color: 0x9aa3ab, roughness: 1, metalness: 0.55, normalScale: 0.9 });
const matMetalR = surfaceMaterial('ribbed', { size: 256, seed: 6, repeat: [10, 2], color: 0xc9d1d8, roughness: 1, metalness: 0.45, normalScale: 0.8 });
const matSteel = new THREE.MeshStandardMaterial({ color: 0x8b949c, metalness: 0.8, roughness: 0.42 });
const matDark = new THREE.MeshStandardMaterial({ color: 0x2b2f34, metalness: 0.6, roughness: 0.5 });
const matRed = new THREE.MeshStandardMaterial({ color: 0xc4372b, roughness: 0.7 });
const matWhite = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7 });
const matCeramic = new THREE.MeshStandardMaterial({ color: 0xb98a5c, roughness: 0.35, metalness: 0.1 });
const bld = new THREE.Group(); world.add(bld);
function box(w, h, d, mat, x, y, z, cast = true, parent = bld) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
function cyl(r0, r1, h, mat, x, y, z, seg = 18, cast = true) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, seg), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; bld.add(m); return m;
}
function prism(pts, depth, mat, x, y, z, axis = 'x') { // extruye un perfil (x,y) a lo largo de z y lo orienta
  const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  if (axis === 'x') g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; bld.add(m); return m;
}
function chimney(x, z, h, r) {
  const seg = 6, sh = h / seg;
  for (let i = 0; i < seg; i++) {
    const r0 = r * (1 - (i / seg) * 0.35), r1 = r * (1 - ((i + 1) / seg) * 0.35);
    cyl(r0, r1, sh, i % 2 ? matWhite : matRed, x, PAD_H + sh * (i + 0.5), z, 20);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  lamp.position.set(x, PAD_H + h + r * 0.3, z); bld.add(lamp);
}
function winFacade(w, h, x, y, z, rotY, cols, rows, seed) {
  const emissive = windowsTexture({ cols, rows, lit: 0.22, seed });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
    map: windowsColorTexture({ cols, rows, seed, base: '#b9b4aa' }), emissiveMap: emissive, emissive: 0xffd9a0, emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.1,
  }));
  m.position.set(x, y, z); m.rotation.y = rotY; m.receiveShadow = true; bld.add(m);
}
function pylon(x, z, h = 26) {
  const g = new THREE.Group();
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 0.35), matSteel);
    leg.position.set(dx * 1.6 * 0.5, h / 2, dz * 1.6 * 0.5); g.add(leg);
  }
  for (let i = 1; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.4 - i * 0.2, 0.18, 0.18), matSteel); b.position.set(0, i * h / 6.5, 0.8); g.add(b); const c = b.clone(); c.position.z = -0.8; g.add(c); }
  for (const yy of [h - 3, h - 7]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 0.4), matSteel); arm.position.set(0, yy, 0); g.add(arm); for (const sx of [-4.5, 0, 4.5]) { const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 8), matCeramic); ins.position.set(sx, yy - 1.0, 0); g.add(ins); } }
  g.position.set(x, PAD_H, z); g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } }); bld.add(g);
}
function substation(cx, cz) {
  box(24, 0.3, 18, matConc, cx, PAD_H + 0.15, cz, false);
  for (const dx of [-7, 0, 7]) {
    box(4.2, 4.6, 3.6, matDark, cx + dx, PAD_H + 2.6, cz - 2);
    for (const sx of [-1.2, 0, 1.2]) cyl(0.35, 0.28, 1.8, matCeramic, cx + dx + sx, PAD_H + 5.4, cz - 2, 8);
  }
  box(0.2, 3, 18, matSteel, cx - 12, PAD_H + 1.5, cz, false); box(0.2, 3, 18, matSteel, cx + 12, PAD_H + 1.5, cz, false);
  box(24, 3, 0.2, matSteel, cx, PAD_H + 1.5, cz + 9, false);
}
// Planta eléctrica (orilla cercana, z > 0)
{
  const pc = { x: PLANT.cx, z: PLANT.cz };
  box(48, 13, 24, matBrick, pc.x, PAD_H + 6.5, pc.z);
  prism([[-12, 0], [12, 0], [0, 4.2]], 49, matRoof, pc.x, PAD_H + 13, pc.z, 'x');
  winFacade(44, 8.5, pc.x, PAD_H + 7.4, pc.z - 12.06, Math.PI, 11, 3, 3);
  box(14, 9, 12, matConc, pc.x - 33, PAD_H + 4.5, pc.z + 4);
  box(16, 7, 10, matMetalR, pc.x + 38, PAD_H + 3.5, pc.z - 4);
  chimney(pc.x + 22, pc.z + 16, 54, 2.4); chimney(pc.x + 30, pc.z + 16, 48, 2.0);
  for (const dx of [-6, 0, 6]) cyl(5, 5, 11, matSteel, pc.x - 30 + dx * 0, PAD_H + 5.5, pc.z + 24 - (dx + 6) * 0.6, 24);
  box(2.2, 2.2, 20, matSteel, pc.x - 20, PAD_H + 9, pc.z + 16, true);
  substation(-8, 17);
  pylon(-32, 24); pylon(-32, 56, 24);
  box(12, 0.1, 28, matDark, 0, PAD_H + 0.06, 22, false); // acceso
}
// Fábrica (orilla lejana, z < -100)
{
  const fx = FACT.cx, fz = FACT.cz;
  for (let i = 0; i < 8; i++) {
    prism([[0, 0], [9, 0], [9, 4.2], [0, 8.4]], 36, i % 2 ? matMetalR : matRoof, fx - 36 + i * 9, PAD_H, fz, 'z');
  }
  winFacade(70, 4.2, fx, PAD_H + 2.2, fz + 18.06, 0, 14, 2, 8);
  box(74, 0.6, 40, matConc, fx, PAD_H + 0.3, fz, false);
  for (let i = 0; i < 3; i++) { cyl(5.2, 5.2, 24, matMetalR, fx - 26 + i * 12, PAD_H + 12, fz + 36, 24); const cone = new THREE.Mesh(new THREE.ConeGeometry(5.6, 3.6, 24), matSteel); cone.position.set(fx - 26 + i * 12, PAD_H + 25.8, fz + 36); cone.castShadow = true; bld.add(cone); }
  box(30, 1.4, 1.4, matSteel, fx - 8, PAD_H + 14, fz + 26); // pasarela
  chimney(fx + 44, fz - 8, 40, 2.1);
  cyl(4.5, 4.5, 14, matSteel, fx + 52, PAD_H + 7, fz + 22, 20); cyl(4.5, 4.5, 14, matSteel, fx + 62, PAD_H + 7, fz + 22, 20);
  substation(fx + 6, -112);
  pylon(fx - 30, -110); pylon(fx + 40, -112, 24);
  box(14, 0.1, 30, matDark, fx + 24, PAD_H + 0.06, -135, false);
}

// ------------------------------------------------------------------ rótulos y cotas
const fitLabel = (l, hWorld) => l.scale.setScalar(hWorld / l.userData.size[1]);
function billboardLabel(text, h, opts = {}) {
  const l = createLabel(text, { size: 0.06, color: '#fff', bg: 'rgba(12,20,32,0.82)', weight: 700, billboard: true, ...opts });
  l.userData.worldH = h;
  app.billboard(l);
  return l;
}
const lblPlant = billboardLabel('Planta eléctrica', 12); lblPlant.position.set(PLANT.cx, 70, PLANT.cz); world.add(lblPlant);
const lblFact = billboardLabel('Fábrica', 12); lblFact.position.set(FACT.cx, 52, FACT.cz); world.add(lblFact);
const lblW = billboardLabel('100 m', 9); lblW.position.set(-6, 9, -50); world.add(lblW);
const lblD = billboardLabel('500 m', 9); lblD.position.set(250, 9, 12); world.add(lblD);
const dimGroup = new THREE.Group(); world.add(dimGroup);
function dim(a, b, r) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, toneMapped: false }));
  m.position.copy(a).addScaledVector(dir, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); dimGroup.add(m);
}
dim(new THREE.Vector3(-4, 1.2, 0), new THREE.Vector3(-4, 1.2, -100), 0.3);
dim(new THREE.Vector3(0, 1.2, 9), new THREE.Vector3(500, 1.2, 9), 0.3);

// ------------------------------------------------------------------ cable, postes, boyas
const cableMatShore = new THREE.MeshStandardMaterial({ color: 0xffa21f, emissive: 0xff7a00, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.3 });
const cableMatWater = new THREE.MeshStandardMaterial({ color: 0x35d3ff, emissive: 0x0aa6e0, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.2 });
const cableGroup = new THREE.Group(); world.add(cableGroup);
const poleGeo = mergeGeometries([
  new THREE.CylinderGeometry(0.2, 0.26, 9.4, 8).translate(0, 4.7, 0),
  new THREE.BoxGeometry(3.2, 0.22, 0.22).translate(0, 8.9, 0),
]);
const polesInst = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x6b5238, roughness: 0.9 }), 40);
polesInst.frustumCulled = false; polesInst.castShadow = true; polesInst.count = 0;
world.add(polesInst);
const buoyInst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff5a36, roughness: 0.4 }), 60);
buoyInst.frustumCulled = false; buoyInst.count = 0; world.add(buoyInst);
const lblShore = billboardLabel('', 8, { size: 0.05 }); const lblWater = billboardLabel('', 8, { size: 0.05 });
world.add(lblShore, lblWater);

const VIZ = { maqueta: { cable: 1.15, buoy: 2.0, pole: 2.6, mark: 2.6, label: 8 }, real: { cable: 0.32, buoy: 0.9, pole: 1, mark: 1.3, label: 6 } };
const vz = () => VIZ[state.mode === 'maqueta' ? 'maqueta' : 'real'];

function tubeFrom(points, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const segs = Math.max(8, points.length * 3);
  const g = new THREE.TubeGeometry(curve, segs, radius, 8, false);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}
function shoreLine(xa, xb, z) { // postes entre xa y xb a lo largo de la orilla, con catenarias
  const len = Math.abs(xb - xa);
  const spans = Math.max(1, Math.ceil(len / 25));
  const tops = [], bases = [];
  for (let i = 0; i <= spans; i++) {
    const x = xa + ((xb - xa) * i) / spans;
    const y = terrainH(x, z);
    bases.push(new THREE.Vector3(x, y, z)); tops.push(new THREE.Vector3(x, y + 8.9, z));
  }
  const pts = [];
  for (let i = 0; i < spans; i++) {
    const A = tops[i], B = tops[i + 1];
    for (let k = 0; k < 6; k++) { const s = k / 6; pts.push(new THREE.Vector3(mix(A.x, B.x, s), mix(A.y, B.y, s) - 0.9 * 4 * s * (1 - s), z)); }
  }
  pts.push(tops[spans].clone());
  return { pts, bases, tops };
}
let route = null;
function buildRoute() {
  const xv = state.x, V = vz();
  for (const c of cableGroup.children) c.geometry.dispose();
  cableGroup.clear();
  const poles = [];
  const waterPts = [];
  let shore = null;
  const yGround = (x, z) => terrainH(x, z);
  // tramo de x metros por la orilla de la planta
  if (xv > 0.5) { shore = shoreLine(0, xv, ZS_NEAR); poles.push(...shore.bases); }
  const start = shore ? shore.tops[shore.tops.length - 1] : new THREE.Vector3(0, yGround(0, ZS_NEAR) + 8.9, ZS_NEAR);
  if (!shore) poles.push(new THREE.Vector3(0, yGround(0, ZS_NEAR), ZS_NEAR));
  // tramo de y metros sobre el agua, en diagonal hasta la fábrica
  waterPts.push(start.clone(), new THREE.Vector3(xv, yGround(xv, 1.0) + 0.5, 1.0), new THREE.Vector3(xv, W_Y + 0.12, -1.5));
  const farEnd = new THREE.Vector3(RIO.D, W_Y + 0.12, -98.5);
  const L = new THREE.Vector3().subVectors(farEnd, waterPts[waterPts.length - 1]);
  const n = Math.max(2, Math.ceil(L.length() / 22));
  for (let i = 1; i <= n; i++) waterPts.push(waterPts[2].clone().addScaledVector(L, i / n));
  waterPts.push(new THREE.Vector3(RIO.D, yGround(RIO.D, -101.5) + 0.5, -101.5), new THREE.Vector3(RIO.D, yGround(RIO.D, ZS_FAR) + 8.9, ZS_FAR));
  poles.push(new THREE.Vector3(RIO.D, yGround(RIO.D, ZS_FAR), ZS_FAR));

  if (shore) cableGroup.add(tubeFrom(shore.pts, V.cable, cableMatShore));
  cableGroup.add(tubeFrom(waterPts, V.cable * 1.1, cableMatWater));

  // postes
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(V.pole, 1, V.pole);
  const unique = [];
  for (const p of poles) if (!unique.some((u) => u.distanceToSquared(p) < 1)) unique.push(p);
  polesInst.count = Math.min(40, unique.length);
  for (let i = 0; i < polesInst.count; i++) { m.compose(unique[i], q, s); polesInst.setMatrixAt(i, m); }
  polesInst.instanceMatrix.needsUpdate = true;

  // boyas a lo largo del tramo sobre el agua
  const a = new THREE.Vector3(xv, W_Y + 0.2, -1.5), b = new THREE.Vector3(RIO.D, W_Y + 0.2, -98.5);
  const nb = Math.min(60, Math.max(2, Math.floor(a.distanceTo(b) / 20)));
  buoyInst.count = nb;
  for (let i = 0; i < nb; i++) { const t = (i + 0.5) / nb; const p = a.clone().lerp(b, t); m.compose(p, q, new THREE.Vector3(V.buoy, V.buoy, V.buoy)); buoyInst.setMatrixAt(i, m); }
  buoyInst.instanceMatrix.needsUpdate = true;

  route = { a, b, shore };
}

// Rótulos de cada tramo (se rehacen solo cuando cambian los números)
let lastLbl = '';
function updateSegmentLabels() {
  const x = state.x, y = RIO.y(x);
  const key = `${x}|${Math.round(y)}|${state.mode}`;
  if (key === lastLbl) return;
  lastLbl = key;
  setLabelText(lblShore, `x = ${formatoNum(x, 0)} m   90x = ${formatoPesos(RIO.a * x)}`, { size: 0.05, color: '#ffd9a0', bg: 'rgba(12,20,32,0.85)', weight: 700 });
  setLabelText(lblWater, `y = ${formatoNum(y, 0)} m   150y = ${formatoPesos(RIO.b * y)}`, { size: 0.05, color: '#9fe8ff', bg: 'rgba(12,20,32,0.85)', weight: 700 });
  const k = vz().label;
  for (const l of [lblShore, lblWater]) fitLabel(l, k);
  lblShore.position.set(x / 2, 30, ZS_NEAR);
  lblShore.visible = x > 5;
  lblWater.position.set((x + RIO.D) / 2, 34, -50);
}

// ------------------------------------------------------------------ poste de control (marcador)
const marker = new THREE.Group(); world.add(marker);
const mkMat = new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff6a00, emissiveIntensity: 0.9, roughness: 0.35 });
const mkPole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 22, 10), mkMat); mkPole.position.y = 11; marker.add(mkPole);
const mkBall = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), mkMat); mkBall.position.y = 24.5; marker.add(mkBall);
const mkRing = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.45, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false })); mkRing.rotation.x = Math.PI / 2; mkRing.position.y = 0.6; marker.add(mkRing);
const lblMark = billboardLabel('x', 10, { size: 0.06, color: '#1a1206', bg: '#ffb347' }); lblMark.position.y = 34; marker.add(lblMark);
let lastMarkTxt = '';
function moveMarker() {
  const x = state.x;
  marker.position.set(x, terrainH(x, ZS_NEAR), ZS_NEAR);
  marker.scale.setScalar(vz().mark);
}
function placeMarker() {
  moveMarker();
  const txt = `x = ${Math.round(state.x)} m`;
  if (txt !== lastMarkTxt) { lastMarkTxt = txt; setLabelText(lblMark, txt, { size: 0.06, color: '#1a1206', bg: '#ffb347', weight: 700 }); }
  fitLabel(lblMark, 5);
}
// bandera del óptimo
const flag = new THREE.Group(); world.add(flag);
{
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 26, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd })); p.position.y = 13; flag.add(p);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshStandardMaterial({ color: 0x3ddc84, emissive: 0x1a8a50, emissiveIntensity: 0.6, side: THREE.DoubleSide })); f.position.set(4.5, 23, 0); flag.add(f);
  flag.visible = false;
}

// zona para arrastrar el poste a lo largo de la orilla de la planta
const strip = new THREE.Mesh(new THREE.BoxGeometry(RIO.D + 40, 2, 20), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
strip.position.set(RIO.D / 2, 1, ZS_NEAR);
world.add(strip);
const invWorld = new THREE.Matrix4(), ray = new THREE.Ray(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1), pt = new THREE.Vector3();
function xFromPointer(p, hit) {
  world.updateWorldMatrix(true, false);
  if (hit) return world.worldToLocal(hit.point.clone()).x;
  invWorld.copy(world.matrixWorld).invert();
  ray.copy(p.ray).applyMatrix4(invWorld);
  return ray.intersectPlane(plane, pt) ? pt.x : null;
}
input.add(strip, {
  cursor: 'ew-resize',
  onDown(hit, p) { const x = xFromPointer(p, hit); if (x != null) setX(x); },
  onMove(hit, p) { const x = xFromPointer(p, hit); if (x != null) setX(x); },
});
function setX(x) { state.x = Math.min(RIO.D, Math.max(0, Math.round(x))); state.dirty = true; }

// ------------------------------------------------------------------ paneles en el espacio del usuario
const unitsM = (n) => `${formatoNum(n, 0)} m`;
const CW = 950, CH = 950;
const ctrl = createPanel({
  width: 1.25, height: 1.25, ppm: 760, title: 'FUNCIÓN OBJETIVO',
  draw(ctx, W, H) {
    const x = state.x, y = RIO.y(x);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = THEME.text; ctx.font = font(H * 0.056, 700);
    ctx.fillText('C(x, y) = 90x + 150y', W * 0.04, H * 0.172);
    ctx.font = font(H * 0.04, 600);
    ctx.fillText('y = √((500 − x)² + 100²),   0 ≤ x ≤ 500', W * 0.04, H * 0.227);
    ctx.fillStyle = THEME.dim; ctx.font = font(H * 0.03, 400);
    wrapText(ctx, 'x son los metros de cable por la orilla e y los metros sobre el agua, por el teorema de Pitágoras. El intervalo es cerrado e incluye los extremos x = 0 y x = 500.', W * 0.04, H * 0.272, W * 0.9, H * 0.035);
    const cards = [
      ['x (orilla)', unitsM(x), THEME.accent],
      ['y (agua)', unitsM(y), THEME.accent2],
      ['longitud x + y', unitsM(RIO.longitud(x)), '#c9a7ff'],
      ['costo C(x, y)', formatoPesos(RIO.costo(x)), THEME.good],
    ];
    cards.forEach(([lab, val, col], i) => {
      const cx = W * (0.04 + i * 0.235), cw = W * 0.215, cy = H * 0.375, chh = H * 0.13;
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(cx, cy, cw, chh);
      ctx.fillStyle = col; ctx.fillRect(cx, cy, 6, chh);
      ctx.fillStyle = THEME.dim; ctx.font = font(H * 0.026, 600); ctx.textAlign = 'left';
      ctx.fillText(lab, cx + 14, cy + chh * 0.32);
      ctx.fillStyle = THEME.text; ctx.font = font(H * 0.043, 700);
      ctx.fillText(val, cx + 14, cy + chh * 0.8);
    });
    ctx.fillStyle = THEME.dim; ctx.font = font(H * 0.03, 500);
    ctx.fillText(`90x = ${formatoPesos(RIO.a * x)}`, W * 0.04, H * 0.548);
    ctx.fillText(`150y = ${formatoPesos(RIO.b * y)}`, W * 0.52, H * 0.548);
    ctx.fillStyle = state.reveal ? THEME.good : THEME.dim; ctx.font = font(H * 0.028, state.reveal ? 700 : 400);
    const cand = RIO.candidatos(), o = cand[1];
    wrapText(ctx, state.reveal
      ? `Candidatos: C(0) = ${formatoPesos(cand[0].costo)}, C(${formatoNum(o.x, 0)}) = ${formatoPesos(o.costo)}, C(500) = ${formatoPesos(cand[2].costo)}. El mínimo está en x = ${formatoNum(o.x, 0)} m, y = ${formatoNum(o.y, 0)} m. Se pide la longitud: x + y = ${formatoNum(o.longitud, 0)} m.`
      : 'Mueve el poste y observa qué cambia. El problema pide una sola magnitud: la longitud del tendido.', W * 0.04, H * 0.9, W * 0.9, H * 0.033);
  },
  widgets: [
    { type: 'slider', id: 'x', x: 0.04 * CW, y: 0.575 * CH, w: 0.92 * CW, h: 0.05 * CH, min: 0, max: RIO.D, step: 1, get: () => state.x, set: (v) => setX(v) },
    { type: 'button', id: 'x0', x: 0.04 * CW, y: 0.66 * CH, w: 0.29 * CW, h: 0.08 * CH, fontScale: 0.36, label: 'Extremo x = 0', onClick: () => setX(0) },
    { type: 'button', id: 'x1', x: 0.355 * CW, y: 0.66 * CH, w: 0.29 * CW, h: 0.08 * CH, fontScale: 0.36, label: 'Extremo x = 500', onClick: () => setX(500) },
    { type: 'button', id: 'opt', x: 0.67 * CW, y: 0.66 * CH, w: 0.29 * CW, h: 0.08 * CH, fontScale: 0.36, label: 'Ir al óptimo', onClick: () => goOptimum() },
    { type: 'toggle', id: 'rev', x: 0.04 * CW, y: 0.765 * CH, w: 0.46 * CW, h: 0.08 * CH, fontScale: 0.38, label: 'Revelar solución', get: () => state.reveal, set: (v) => { state.reveal = v; applyReveal(); } },
    { type: 'button', id: 'mode', x: 0.52 * CW, y: 0.765 * CH, w: 0.44 * CW, h: 0.08 * CH, fontScale: 0.38, label: () => (state.mode === 'maqueta' ? 'Ir a escala real' : 'Volver a la maqueta'), onClick: () => applyMode(state.mode === 'maqueta' ? 'real' : 'maqueta') },
  ],
});
console.assert(ctrl.W === CW && ctrl.H === CH, 'rejilla de la consola', ctrl.W, ctrl.H);
const panelsOn = () => app.isXR || state.mode === 'maqueta';
rig.add(ctrl.mesh); ctrl.register(input, panelsOn);

const plot = createPlot({
  f: (x) => RIO.costo(x) / 1000, x0: 0, x1: RIO.D, y0: 55, y1: 80, width: 1.35, height: 0.8,
  xTicks: [0, 100, 200, 300, 400, 500], yTicks: [55, 60, 65, 70, 75, 80], xLabel: 'x (m)', yLabel: 'costo C (miles de $)', labelSize: 0.042,
  tickFmt: (v) => String(v), curveColor: 0xffb347,
});
rig.add(plot.group);
// extremos del intervalo cerrado: círculos llenos, siempre visibles
{
  const e = RIO.extremos();
  plot.addPoint('e0', 0, e.x0 / 1000, { color: 0xffffff, radiusP: 0.016, guides: false });
  plot.addPoint('e1', RIO.D, e.xD / 1000, { color: 0xffffff, radiusP: 0.016, guides: false });
}
function applyReveal() {
  const o = RIO.optimo();
  plot.removePoint('min');
  if (state.reveal) plot.addPoint('min', o.x, o.costo / 1000, { color: 0x6fe3a2, labelX: `x* = ${formatoNum(o.x, 0)} m`, labelY: `${formatoNum(o.costo / 1000, 0)}` });
  flag.visible = state.reveal;
  flag.position.set(o.x, terrainH(o.x, ZS_NEAR + 6), ZS_NEAR + 6);
  flag.scale.setScalar(vz().mark);
  ctrl.invalidate();
  state.dirty = true;
}

// zona de gráfico sensible: arrastrar mueve x
const plotProxy = new THREE.Mesh(new THREE.PlaneGeometry(plot.width + 0.1, plot.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
plotProxy.position.set(plot.width / 2, plot.height / 2, 0.01); plot.group.add(plotProxy);
const _pl = new THREE.Plane(), _n = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3();
function xFromPlot(p, hit) {
  plot.group.updateWorldMatrix(true, false);
  let w;
  if (hit) w = hit.point.clone();
  else { _n.set(0, 0, 1).transformDirection(plot.group.matrixWorld); plot.group.getWorldPosition(_c); _pl.setFromNormalAndCoplanarPoint(_n, _c); if (!p.ray.intersectPlane(_pl, _p)) return null; w = _p.clone(); }
  return plot.xFromLocal(plot.group.worldToLocal(w).x);
}
input.add(plotProxy, { cursor: 'ew-resize', onDown(hit, p) { const x = xFromPlot(p, hit); if (x != null) setX(x); }, onMove(hit, p) { const x = xFromPlot(p, hit); if (x != null) setX(x); } }, panelsOn);

// ------------------------------------------------------------------ maqueta: mesa y suelo
const plinth = new THREE.Group(); scene.add(plinth);
{
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.06, 1.15), new THREE.MeshStandardMaterial({ color: 0x2a3037, roughness: 0.55, metalness: 0.15 }));
  top.position.set(0, TABLE.y - 0.09, TABLE.z); top.receiveShadow = true; top.castShadow = true; plinth.add(top);
  for (const sx of [-0.9, 0.9]) for (const sz of [-0.5, 0.5]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, TABLE.y - 0.12, 0.07), top.material); l.position.set(sx, (TABLE.y - 0.12) / 2, TABLE.z + sz); plinth.add(l); }
}
const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), surfaceMaterial('concrete', { size: 256, seed: 11, repeat: [30, 30], color: 0x6c747c, roughness: 1, normalScale: 0.5 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// ------------------------------------------------------------------ modos
function setShadowRegion() {
  const maq = state.mode === 'maqueta';
  const c = maq ? new THREE.Vector3(0, TABLE.y, TABLE.z) : (app.isXR ? rig.position.clone() : camera.getWorldPosition(new THREE.Vector3()));
  const half = maq ? 1.5 : 170;
  sky.setShadow(c, half, { size: 2048, bias: -0.0004, normalBias: maq ? 0.004 : 0.5 });
  const cam = sunL.shadow.camera; cam.near = maq ? 560 : 330; cam.far = maq ? 640 : 900; cam.updateProjectionMatrix();
}
function applyVisual() { const V = vz(); lastLbl = ''; lastMarkTxt = ''; buildRoute(); for (const l of [lblPlant, lblFact]) fitLabel(l, V.label * 1.1); for (const l of [lblW, lblD]) fitLabel(l, V.label * 0.9); }
function applyMode(m) {
  state.mode = m;
  const maq = m === 'maqueta';
  if (maq) {
    world.scale.setScalar(S_MAQ);
    world.position.set(-MAP_C.x * S_MAQ, TABLE.y, TABLE.z - MAP_C.z * S_MAQ);
    app.locomotion.enabled = false;
    app.xrStart = { position: [0, 0, 0.95], yaw: 0 };
    if (app.isXR) app.teleportRig([0, 0, 0.95], 0);
    scene.fog.density = 0;
    camera.near = 0.04; camera.updateProjectionMatrix();
    if (!app.isXR) { camera.position.set(-0.1, 1.5, 2.75); orbit.target.set(-0.4, 1.05, -0.7); orbit.minDistance = 0.25; orbit.maxDistance = 8; orbit.update(); }
    ctrl.mesh.position.set(-1.45, 1.3, -0.6); ctrl.mesh.rotation.set(0, 0.77, 0);
    plot.group.position.set(-0.55, 1.22, -1.45); plot.group.rotation.set(0, 0, 0);
  } else {
    world.scale.setScalar(1); world.position.set(0, 0, 0);
    app.locomotion.enabled = true; app.locomotion.speed = 22; app.locomotion.fly = true;
    const sx = 2, sz = 8, yaw = Math.atan2(-(RIO.D - sx), -(-128 - sz));
    app.xrStart = { position: [sx, terrainH(sx, sz), sz], yaw };
    if (app.isXR) app.teleportRig([sx, terrainH(sx, sz), sz], yaw);
    scene.fog.density = 0.0007;
    camera.near = 0.3; camera.updateProjectionMatrix();
    if (!app.isXR) { camera.position.set(-40, 26, 86); orbit.target.set(240, 4, -70); orbit.minDistance = 5; orbit.maxDistance = 2500; orbit.update(); }
    ctrl.mesh.position.set(-0.95, 1.25, -0.95); ctrl.mesh.rotation.set(0, 0.5, 0);
    plot.group.position.set(0.3, 1.05, -1.25); plot.group.rotation.set(0, -0.3, 0);
  }
  plinth.visible = maq; floor.visible = maq;
  ctrl.mesh.rotation.x = -0.12;
  applyVisual(); applyReveal(); setShadowRegion(); state.dirty = true;
  bMode.textContent = maq ? 'Escala real' : 'Maqueta';
}
// En escala real lleva al usuario junto al poste, mirando hacia el río
function teleportTo(x) {
  const z = ZS_NEAR + 14;
  if (app.isXR) app.teleportRig([x, terrainH(x, z), z], 0);
  else { camera.position.set(x - 30, 22, z + 60); orbit.target.set(x, 2, -50); }
}
function goOptimum() {
  const o = RIO.optimo();
  setX(o.x);
  if (state.mode === 'real') teleportTo(o.x);
}

// ------------------------------------------------------------------ DOM de escritorio
const $ = (id) => document.getElementById(id);
const rX = $('r-x'), oX = $('o-x'), bMode = $('b-mode'), bOpt = $('b-opt'), bRev = $('b-rev');
rX.oninput = () => setX(parseFloat(rX.value));
bMode.onclick = () => applyMode(state.mode === 'maqueta' ? 'real' : 'maqueta');
bOpt.onclick = () => goOptimum();
bRev.onclick = () => { state.reveal = !state.reveal; applyReveal(); };
app.onXR((on) => { $('controls').style.display = on ? 'none' : ''; $('hud').style.display = on ? 'none' : ''; if (on) applyMode(state.mode); else setShadowRegion(); });

// ------------------------------------------------------------------ bucle
let lastX = null, lastShadowStep = 0, labelsDirty = true, lastLabelT = 0;
app.onUpdate((dt) => {
  water.update(dt);
  if (state.dirty || lastX !== state.x) {
    lastX = state.x; state.dirty = false;
    buildRoute(); moveMarker(); labelsDirty = true;
    plot.setMarker(state.x, { color: 0xffffff });
    ctrl.invalidate();
    if (document.activeElement !== rX) rX.value = String(state.x);
    oX.textContent = `${Math.round(state.x)} m`;
    bRev.classList.toggle('on', state.reveal);
  }
  if (labelsDirty && performance.now() - lastLabelT > 110) { labelsDirty = false; lastLabelT = performance.now(); placeMarker(); updateSegmentLabels(); }
  // los paneles solo se muestran donde son útiles
  ctrl.mesh.visible = plot.group.visible = panelsOn();
  ctrl.update(performance.now());
  // sombras alrededor del usuario en escala real
  if (state.mode === 'real' && performance.now() - lastShadowStep > 800) { lastShadowStep = performance.now(); setShadowRegion(); }
});

// arranque: ?modo=real abre directamente a escala real
const modoInicial = new URLSearchParams(location.search).get('modo') === 'real' ? 'real' : 'maqueta';
applyMode(modoInicial);
state.x = 150; state.dirty = true;
loading(null);
window.__rio = { app, state, world, RIO, plot, applyMode, setX };
