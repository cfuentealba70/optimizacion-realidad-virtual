// Mundo de la Guía 4: una obra con sus alrededores y una estación por problema.
// Cada estación vive en guia4/estaciones/<id>.js y se construye con el kit común (guia4/kit.js).
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createApp, loading } from '../src/common/app.js';
import { createSky } from '../src/common/sky.js';
import { surfaceMaterial, makeSurface, fbm, mulberry32 } from '../src/common/textures.js';
import { createPanel, THEME, font } from '../src/common/panel.js';
import { crearKit } from './kit.js';

loading('Preparando la obra…');
await new Promise((r) => setTimeout(r, 30));

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
];
const PLAZA = { pos: [0, 0], yaw: Math.PI };

// ------------------------------------------------------------------ aplicación
const app = createApp({
  camera: { position: [0, 1.7, 8], target: [0, 1.4, -6] },
  orbit: { minDistance: 0.5, maxDistance: 600, maxPolarAngle: Math.PI * 0.49 },
  xrStart: { position: [0, 0, 3], yaw: 0 },
  exposure: 0.82, background: 0x9fb8d0, far: 30000, near: 0.05,
});
const { scene, renderer, camera, orbit, rig, input } = app;
app.locomotion.enabled = true; app.locomotion.speed = 4; app.locomotion.fly = false;
const sky = createSky(scene, renderer, { elevation: 34, azimuth: 205, turbidity: 3.2, rayleigh: 1.2, sunIntensity: 3.5, fogDensity: 0.0016 });
scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x6d6a55, 0.3));
// El cielo físico es muy brillante como luz ambiental: se atenúa para que los materiales conserven su color
scene.environmentIntensity = 0.28;

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
const G = 760, GS = 190;
const gGeo = new THREE.PlaneGeometry(G, G, GS, GS);
gGeo.rotateX(-Math.PI / 2); gGeo.translate(SITE.x + 40, 0, SITE.z);
{
  const pos = gGeo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = sueloH(x, z);
    pos.setY(i, h);
    const n = noise.noise(x / 25, 5.1, z / 25) * 0.5 + 0.5, dry = sstep(0.55, 0.85, noise.noise(x / 60, 9.3, z / 60) * 0.5 + 0.5);
    let r = 0.2 + 0.1 * n + dry * 0.12, g = 0.31 + 0.13 * n + dry * 0.04, b = 0.1 + 0.05 * n;
    const d = Math.hypot(x - SITE.x, z - SITE.z);
    const obra = 1 - sstep(70, 95, d); // la obra tiene tierra apisonada y pasto ralo
    r = r * (1 - obra * 0.55) + 0.42 * obra * 0.55; g = g * (1 - obra * 0.55) + 0.38 * obra * 0.55; b = b * (1 - obra * 0.55) + 0.3 * obra * 0.55;
    col[i * 3] = r * 0.9; col[i * 3 + 1] = g * 0.95; col[i * 3 + 2] = b * 0.85;
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
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
const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: grayDetail(G / 7), normalMap: gravelN, normalScale: new THREE.Vector2(0.45, 0.45), roughness: 1 }));
ground.receiveShadow = true;
scene.add(ground);

// Senderos de grava desde la plaza a cada estación cercana
const pathMat = surfaceMaterial('gravel', { size: 256, seed: 8, repeat: [1, 8], color: 0x9a907f, roughness: 1, normalScale: 0.6 });
pathMat.polygonOffset = true; pathMat.polygonOffsetFactor = -2;
for (const l of LAYOUT) {
  if (l.id === 'autos') continue;
  const len = Math.hypot(l.pos[0], l.pos[1]) - 6;
  if (len < 4) continue;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, len), pathMat.clone());
  p.material.map = pathMat.map.clone(); p.material.map.repeat.set(1, len / 3); p.material.normalMap = pathMat.normalMap.clone(); p.material.normalMap.repeat.set(1, len / 3);
  p.rotation.x = -Math.PI / 2;
  const ang = Math.atan2(l.pos[0], l.pos[1]);
  p.rotation.z = ang;
  p.position.set((l.pos[0] / 2) * ((len + 6) / (len + 6)), 0.02, l.pos[1] / 2);
  p.receiveShadow = true;
  scene.add(p);
}
// Plaza de inicio
const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 40), surfaceMaterial('concrete', { size: 256, seed: 5, repeat: [4, 4], color: 0xd8d4cc, roughness: 1, normalScale: 0.5 }));
plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.03; plaza.receiveShadow = true; scene.add(plaza);

// Árboles alrededor de la obra
{
  const rng = mulberry32(7);
  const colored = (geo, hex) => {
    const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = 1 + (rng() - 0.5) * 0.1; a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
  };
  const tree = (kind) => {
    const parts = [];
    const add = (g, y, hex) => { g.translate(0, y, 0); parts.push(colored(g.index ? g.toNonIndexed() : g, hex)); };
    if (kind === 0) { add(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 6), 1.2, 0x4d3a2a); add(new THREE.ConeGeometry(2.4, 5, 7), 4.4, 0x1f4a2a); add(new THREE.ConeGeometry(1.8, 4, 7), 7, 0x27552f); add(new THREE.ConeGeometry(1.2, 3, 7), 9.2, 0x2c6035); }
    else { add(new THREE.CylinderGeometry(0.28, 0.45, 3, 6), 1.5, 0x57412e); const a = new THREE.IcosahedronGeometry(3.1, 0); a.scale(1, 0.85, 1); add(a, 5.4, 0x4e7436); const b = new THREE.IcosahedronGeometry(2.2, 0); b.translate(1.4, 0, 0.4); add(b, 4.1, 0x5d8440); }
    return mergeGeometries(parts);
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  for (const kind of [0, 1]) {
    const n = 420, inst = new THREE.InstancedMesh(tree(kind), mat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
    let k = 0, tries = 0;
    while (k < n && tries < n * 30) {
      tries++;
      const x = SITE.x + 40 + (rng() - 0.5) * (G - 40), z = SITE.z + (rng() - 0.5) * (G - 40);
      const d = Math.hypot(x - SITE.x, z - SITE.z);
      if (d < 105 || roadMask(x, z) || roadMask(x + 8, z) || roadMask(x, z + 8)) continue;
      const a = LAYOUT.find((l) => l.id === 'autos').pos;
      if (Math.abs(x - a[0]) < 30 && Math.abs(z - a[1]) < 30) continue;
      if (noise.noise(x / 50, 1.7, z / 50) < -0.15 + kind * 0.2) continue;
      const sc = 0.8 + rng() * 0.8;
      p.set(x, sueloH(x, z) - 0.2, z); s.set(sc, sc * (0.9 + rng() * 0.3), sc); e.set(0, rng() * 6.28, 0); q.setFromEuler(e);
      m4.compose(p, q, s); inst.setMatrixAt(k++, m4);
    }
    inst.count = k; inst.frustumCulled = false; scene.add(inst);
  }
}

// Cerco perimetral de la obra (malla de construcción)
{
  const postes = [], panos = [], R = 88, n = 70;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.7, roughness: 0.4 });
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); g.clearRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,140,40,0.95)'; g.lineWidth = 5;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
  const meshTex = new THREE.CanvasTexture(c); meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping; meshTex.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const x0 = SITE.x + Math.cos(a0) * R, z0 = SITE.z + Math.sin(a0) * R, x1 = SITE.x + Math.cos(a1) * R, z1 = SITE.z + Math.sin(a1) * R;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (Math.hypot(mx - 90, mz - 75) < 22) continue; // acceso hacia el cruce
    const len = Math.hypot(x1 - x0, z1 - z0);
    const pg = new THREE.PlaneGeometry(len, 1.2);
    const uv = pg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * len / 0.8, uv.getY(k) * 1.2 / 0.8);
    pg.rotateY(-Math.atan2(z1 - z0, x1 - x0)); pg.translate(mx, 0.65, mz);
    panos.push(pg);
    postes.push([x0, z0]);
  }
  const cerco = new THREE.Mesh(mergeGeometries(panos), new THREE.MeshStandardMaterial({ map: meshTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.8 }));
  scene.add(cerco);
  const pg = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6);
  const inst = new THREE.InstancedMesh(pg, postMat, postes.length);
  const m4 = new THREE.Matrix4();
  postes.forEach((p, i) => { m4.makeTranslation(p[0], 0.7, p[1]); inst.setMatrixAt(i, m4); });
  scene.add(inst);
}

// ------------------------------------------------------------------ estaciones
const kit = crearKit(app);
kit.sueloH = sueloH;
const estaciones = [];
const grupoDe = new Map();

function aMundo(est, v) { return new THREE.Vector3(...v).applyMatrix4(est.grupo.matrixWorld); }

async function cargarEstaciones() {
  for (const l of LAYOUT) {
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
      await new Promise((r) => setTimeout(r, 10));
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
    // cartel con el nombre, visible desde lejos
    const nombre = kit.etiqueta(est.def.titulo || l.id, 0.55, { bg: 'rgba(255,179,71,0.92)', color: '#1a1206' });
    nombre.position.set(0, est.api.alturaCartel ?? 4.2, 0).applyMatrix4(grupo.matrixWorld);
    scene.add(nombre);
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

// ------------------------------------------------------------------ navegación
let activa = null;
let vuelo = null; // animación de cámara en escritorio
function irA(est) {
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
  menuVR.invalidate();
  const url = new URL(location.href);
  if (est) url.searchParams.set('estacion', est.id); else url.searchParams.delete('estacion');
  history.replaceState(null, '', url);
}

// ------------------------------------------------------------------ menú en VR (sujeto al usuario)
const BOT = [{ id: null, t: 'Plaza' }, ...LAYOUT.map((l) => ({ id: l.id }))];
const MW = Math.round(0.62 * 760), MH = Math.round(0.95 * 760);
const menuVR = createPanel({
  width: 0.62, height: 0.95, ppm: 760, title: 'ESTACIONES',
  draw(ctx, W, H) {
    ctx.fillStyle = THEME.dim; ctx.font = font(H * 0.026, 400); ctx.textAlign = 'left';
    ctx.fillText('Apunta y aprieta el gatillo para ir', W * 0.06, H * 0.105);
  },
  widgets: BOT.map((b, i) => ({
    type: 'toggle', id: 'm' + i, x: MW * 0.06, y: MH * (0.13 + i * 0.077), w: MW * 0.88, h: MH * 0.066, fontScale: 0.42,
    label: () => (b.id ? (grupoDe.get(b.id)?.def?.titulo || b.id) : 'Plaza de inicio'),
    get: () => (b.id ? activa?.id === b.id : activa === null), set: () => irA(b.id ? grupoDe.get(b.id) : null),
  })),
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
$('menu-toggle').onclick = () => document.body.classList.toggle('menu-cerrado');

app.onXR((on) => {
  menuVR.mesh.visible = on;
  for (const id of ['hud', 'controls', 'menu']) $(id).style.display = on ? 'none' : '';
  if (on) irA(activa); else construirControles();
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
      const radio = renderer.xr.isPresenting ? 16 : (est.api?.radioVisible ?? 190); // en VR, solo la estación donde está la persona y las muy cercanas
      est.grupo.visible = d < radio + (est.api?.radioSombra ?? 10) || est === activa;
      if (d < dmin) { dmin = d; cercana = est; }
    }
    if (renderer.xr.isPresenting && cercana && dmin < 16 && cercana !== activa) { activa = cercana; menuVR.invalidate(); }
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
    const c = activa ? activa.grupo.position : tmp;
    const half = activa?.api?.radioSombra ?? 30;
    sky.setShadow(new THREE.Vector3(c.x, 0, c.z), half, { size: 2048, bias: -0.0004, normalBias: 0.05 });
    const sc = sky.light.shadow.camera; sc.near = 600 - half * 2 - 60; sc.far = 600 + half * 2 + 60; sc.updateProjectionMatrix();
  }
  if (now - ultimoDom > 120) { ultimoDom = now; for (const f of controlesDom) f(); }
  menuVR.update(now);
});

// ------------------------------------------------------------------ arranque
await cargarEstaciones();
construirMenuDom();
const pedida = new URLSearchParams(location.search).get('estacion');
const inicial = pedida ? grupoDe.get(pedida) : null;
if (inicial) {
  activa = inicial;
  const v = inicial.api.vista;
  camera.position.copy(aMundo(inicial, v.escritorio.camara));
  orbit.target.copy(aMundo(inicial, v.escritorio.objetivo)); orbit.update();
}
construirControles(); actualizarHud(); marcarMenu();
loading(null);
window.__g4 = { app, kit, estaciones, irA, grupoDe, sueloH };
