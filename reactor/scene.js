// Escena 1: laboratorio con un reactor. El color del líquido sigue C(t) = 4t e^(-0,3t).
import * as THREE from 'three';
import { createApp, loading } from '../src/common/app.js';
import { createSky } from '../src/common/sky.js';
import { surfaceMaterial, windowsTexture } from '../src/common/textures.js';
import { createPanel, createLabel, setLabelText, THEME, font, wrapText } from '../src/common/panel.js';
import { createPlot } from '../src/common/plot3d.js';
import { REACCION, formatoNum } from '../src/math/problems.js';

loading('Preparando el laboratorio…');
await new Promise((r) => setTimeout(r, 30));

const T_MAX_VIS = 12;      // horas visibles en el gráfico
const C_MAX_VIS = 6;       // mol/L visibles en el gráfico
const state = { t: 0, playing: true, speed: 0.8, showDeriv: false, reveal: false, atMax: false };

// ---------------------------------------------------------------- aplicación base
const app = createApp({
  camera: { position: [0.3, 1.55, 1.35], target: [-0.05, 1.42, -1.6] },
  orbit: { minDistance: 0.6, maxDistance: 7, maxPolarAngle: Math.PI * 0.52 },
  xrStart: { position: [0, 0, 1.15], yaw: 0 },
  exposure: 0.85,
  background: 0x9fb8d0,
});
const { scene, renderer, input } = app;

const sky = createSky(scene, renderer, { elevation: 27, azimuth: 262, turbidity: 3.6, rayleigh: 1.3, sunIntensity: 3.4, fogDensity: 0.0009 });
scene.add(new THREE.HemisphereLight(0xdfe9f6, 0x7a6f62, 0.65));
sky.setShadow(new THREE.Vector3(-1, 0.5, -1.5), 6, { size: 2048, bias: -0.0005, normalBias: 0.03 });
const sunL = sky.light;
sunL.shadow.camera.near = 20; sunL.shadow.camera.far = 900;

// ---------------------------------------------------------------- sala
const room = new THREE.Group();
scene.add(room);
const W = 8, D = 7.2, H = 3.4, Z0 = -4.6; // ancho, fondo, alto; pared del fondo en Z0

function addShadow(m, cast = true, receive = true) { m.castShadow = cast; m.receiveShadow = receive; return m; }
function box(w, h, d, mat, x, y, z, parent = room, cast = true, receive = true) {
  const m = addShadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), cast, receive);
  m.position.set(x, y, z); parent.add(m); return m;
}

const matFloor = surfaceMaterial('tiles', { size: 256, seed: 4, repeat: [W / 1.3, D / 1.3], roughness: 0.9, normalScale: 0.8 });
const floor = addShadow(new THREE.Mesh(new THREE.PlaneGeometry(W, D), matFloor), false, true);
floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, Z0 + D / 2);
room.add(floor);

const matWall = surfaceMaterial('concrete', { size: 256, seed: 9, repeat: [3, 1.2], color: 0xeae3d6, roughness: 1, normalScale: 0.6 });
const matBrick = surfaceMaterial('brick', { size: 256, seed: 2, repeat: [3.2, 1.2], color: 0xf0ede8, roughness: 1, normalScale: 1.0 });
const matCeil = surfaceMaterial('concrete', { size: 256, seed: 12, repeat: [3, 3], color: 0xffffff, roughness: 1, normalScale: 0.15 });

// pared del fondo (ladrillo) y derecha; la izquierda lleva la ventana
box(W, H, 0.2, matBrick, 0, H / 2, Z0 - 0.1);
box(0.2, H, D, matWall, W / 2 + 0.1, H / 2, Z0 + D / 2);
box(W, 0.2, D, matCeil, 0, H + 0.1, Z0 + D / 2, room, false, true);
// pared izquierda con vano de ventana: z entre -3.6 y -0.6, y entre 0.9 y 2.6
const wx = -W / 2 - 0.1;
const wz0 = -3.7, wz1 = -0.7, wy0 = 0.95, wy1 = 2.65;
box(0.2, wy0, D, matWall, wx, wy0 / 2, Z0 + D / 2);
box(0.2, H - wy1, D, matWall, wx, wy1 + (H - wy1) / 2, Z0 + D / 2);
box(0.2, wy1 - wy0, wz0 - Z0, matWall, wx, (wy0 + wy1) / 2, (Z0 + wz0) / 2);
box(0.2, wy1 - wy0, (Z0 + D) - wz1, matWall, wx, (wy0 + wy1) / 2, (wz1 + Z0 + D) / 2);
// marco y cristal
const matFrame = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.5, metalness: 0.4 });
const gz = (wz0 + wz1) / 2, gh = wy1 - wy0, gw = wz1 - wz0;
box(0.07, 0.06, gw, matFrame, wx + 0.06, wy0, gz, room, true, false);
box(0.07, 0.06, gw, matFrame, wx + 0.06, wy1, gz, room, true, false);
for (let i = 0; i <= 3; i++) box(0.07, gh, 0.05, matFrame, wx + 0.06, (wy0 + wy1) / 2, wz0 + (gw * i) / 3, room, true, false);
box(0.07, 0.04, gw, matFrame, wx + 0.06, (wy0 + wy1) / 2, gz, room, true, false);
const glass = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), new THREE.MeshStandardMaterial({ color: 0xcfe3f2, transparent: true, opacity: 0.07, roughness: 0.02, metalness: 0, depthWrite: false }));
glass.rotation.y = Math.PI / 2; glass.position.set(wx + 0.09, (wy0 + wy1) / 2, gz);
room.add(glass);

// luminarias de techo
const matLamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2 });
for (const x of [-2, 0, 2]) for (const z of [-3.0, -0.8]) box(1.4, 0.06, 0.32, matLamp, x, H - 0.03, z, room, false, false);

// exterior visible por la ventana: suelo, árboles lejanos
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), surfaceMaterial('grass', { size: 256, seed: 6, repeat: [220, 220], color: 0xc8d4b0, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; ground.receiveShadow = true;
scene.add(ground);
{
  const trunk = new THREE.CylinderGeometry(0.22, 0.34, 3, 6); trunk.translate(0, 1.5, 0);
  const crown = new THREE.IcosahedronGeometry(2.2, 1); crown.translate(0, 4.6, 0);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x4d3b2b, roughness: 1 });
  const crownM = new THREE.MeshStandardMaterial({ color: 0x4b6b34, roughness: 1, flatShading: true });
  const n = 46, t1 = new THREE.InstancedMesh(trunk, trunkM, n), t2 = new THREE.InstancedMesh(crown, crownM, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    p.set(-14 - rnd() * 90, 0, -60 + rnd() * 90); const k = 0.8 + rnd() * 1.2; s.setScalar(k);
    m.compose(p, q, s); t1.setMatrixAt(i, m); t2.setMatrixAt(i, m);
  }
  t1.castShadow = t2.castShadow = false;
  scene.add(t1, t2);
}

// ---------------------------------------------------------------- mesa de trabajo
const matEpoxy = new THREE.MeshStandardMaterial({ color: 0x1d2228, roughness: 0.22, metalness: 0.05 });
const matCab = surfaceMaterial('metal', { size: 256, seed: 3, repeat: [2, 1], color: 0xe9edf0, roughness: 1, metalness: 0.2, normalScale: 0.3 });
const BENCH_Y = 0.92, BZ = -1.75;
const bench = new THREE.Group(); room.add(bench);
box(4.2, 0.05, 0.9, matEpoxy, 0, BENCH_Y - 0.025, BZ, bench);
box(4.0, BENCH_Y - 0.06, 0.78, matCab, 0, (BENCH_Y - 0.06) / 2, BZ, bench);
for (let i = -3; i <= 3; i++) box(0.005, BENCH_Y - 0.1, 0.01, new THREE.MeshStandardMaterial({ color: 0x555b62 }), i * 0.57, (BENCH_Y - 0.06) / 2, BZ + 0.395, bench, false, false);
for (let i = -3; i <= 3; i++) { if (i % 2 === 0) box(0.14, 0.02, 0.012, new THREE.MeshStandardMaterial({ color: 0x8e949b, metalness: 0.8, roughness: 0.3 }), i * 0.57 + 0.28, BENCH_Y * 0.7, BZ + 0.4, bench, false, false); }

// estantería en la pared del fondo con frascos
const matWood = surfaceMaterial('wood', { size: 256, seed: 5, repeat: [1.5, 1], color: 0xc8a37a, roughness: 1, normalScale: 0.7 });
for (const y of [1.55, 2.05, 2.55]) box(2.4, 0.04, 0.3, matWood, 2.3, y, Z0 + 0.15, room);
{
  const g = new THREE.CylinderGeometry(0.045, 0.05, 0.18, 14); g.translate(0, 0.09, 0);
  const cap = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 10); cap.translate(0, 0.2, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.55, envMapIntensity: 1.4 });
  const inst = new THREE.InstancedMesh(g, mat, 36), instCap = new THREE.InstancedMesh(cap, new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.5 }), 36);
  const cols = [0x6ec5ff, 0xffd26e, 0xff8a7a, 0x9be27a, 0xe0b7ff, 0xffffff];
  const m = new THREE.Matrix4(); let k = 0;
  for (const y of [1.57, 2.07, 2.57]) for (let i = 0; i < 12; i++) {
    m.makeTranslation(1.2 + i * 0.205, y + 0.02, Z0 + 0.15);
    inst.setMatrixAt(k, m); instCap.setMatrixAt(k, m);
    inst.setColorAt(k, new THREE.Color(cols[(i + (y * 10 | 0)) % cols.length])); k++;
  }
  inst.instanceColor.needsUpdate = true; room.add(inst, instCap);
}

// ---------------------------------------------------------------- reactor (vaso, líquido, agitador)
const VX = -1.4, VZ = -1.72;
const reactor = new THREE.Group();
reactor.position.set(VX, BENCH_Y, VZ);
room.add(reactor);

const stirrerMat = surfaceMaterial('metal', { size: 256, seed: 8, repeat: [1, 1], color: 0xe4e7ea, roughness: 1, metalness: 0.5, normalScale: 0.4 });
box(0.46, 0.08, 0.46, stirrerMat, 0, 0.04, 0, reactor);
{
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.4, metalness: 0.5 }));
  knob.position.set(0.16, 0.095, 0.17); reactor.add(knob);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0x59ff86 }));
  led.position.set(-0.18, 0.082, 0.2); reactor.add(led);
}
const VR_R = 0.15, VR_H = 0.46, V0 = 0.08;
const beakerProfile = [[0.0, 0.0], [VR_R - 0.012, 0.0], [VR_R, 0.012], [VR_R, VR_H], [VR_R + 0.012, VR_H + 0.006], [VR_R - 0.004, VR_H], [VR_R - 0.006, 0.02], [0.0, 0.016]]
  .map(([x, y]) => new THREE.Vector2(x, y));
const beaker = new THREE.Mesh(
  new THREE.LatheGeometry(beakerProfile, 56),
  new THREE.MeshStandardMaterial({ color: 0xf6fbff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.2, envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false }),
);
beaker.position.y = V0; beaker.renderOrder = 5;
reactor.add(beaker);

const LIQ_H = 0.34;
const liquidMat = new THREE.MeshStandardMaterial({ color: 0xf3e7a4, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.93, envMapIntensity: 1.2, emissive: 0x000000 });
const liquid = new THREE.Mesh(new THREE.CylinderGeometry(VR_R - 0.007, VR_R - 0.007, LIQ_H, 48, 1, false), liquidMat);
liquid.position.y = V0 + 0.02 + LIQ_H / 2; liquid.renderOrder = 3;
reactor.add(liquid);
const surfaceMat = new THREE.MeshStandardMaterial({ color: 0xf3e7a4, roughness: 0.04, transparent: true, opacity: 0.85, envMapIntensity: 1.8 });
const liqTop = new THREE.Mesh(new THREE.CircleGeometry(VR_R - 0.007, 48), surfaceMat);
liqTop.rotation.x = -Math.PI / 2; liqTop.position.y = V0 + 0.02 + LIQ_H + 0.001; liqTop.renderOrder = 4;
reactor.add(liqTop);

// barra magnética
const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 10), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.2 }));
bar.rotation.z = Math.PI / 2; bar.position.y = V0 + 0.03; reactor.add(bar);

// termómetro y soporte
const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x9a9fa6, metalness: 0.9, roughness: 0.3 }));
rod.position.set(0.24, 0.45, -0.08); reactor.add(rod);
const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.012), rod.material);
clamp.position.set(0.14, 0.62, -0.08); reactor.add(clamp);
const thermo = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.8 }));
thermo.position.set(0.05, 0.42, -0.06); reactor.add(thermo);

// burbujas: aparecen mientras C'(t) > 0 (el producto se está formando)
const NB = 70;
const bubbleGeo = new THREE.SphereGeometry(0.0065, 8, 6);
const bubbles = new THREE.InstancedMesh(bubbleGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.6, envMapIntensity: 1.5 }), NB);
bubbles.renderOrder = 6; bubbles.frustumCulled = false;
reactor.add(bubbles);
const bub = Array.from({ length: NB }, () => ({ x: 0, y: 0, z: 0, s: 1, v: 0, ph: 0 }));
function respawn(b, spreadY = false) {
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (VR_R - 0.025);
  b.x = Math.cos(a) * r; b.z = Math.sin(a) * r; b.y = V0 + 0.04 + (spreadY ? Math.random() * LIQ_H : 0);
  b.v = 0.05 + Math.random() * 0.07; b.s = 0.6 + Math.random() * 1.1; b.ph = Math.random() * 6.28;
}
bub.forEach((b) => respawn(b, true));
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();

// ---------------------------------------------------------------- gráfico flotante de C(t)
const plot = createPlot({
  f: (t) => REACCION.C(t), x0: 0, x1: T_MAX_VIS, y0: 0, y1: C_MAX_VIS, width: 1.85, height: 1.08,
  xTicks: [0, 2, 4, 6, 8, 10, 12], yTicks: [0, 1, 2, 3, 4, 5, 6],
  xLabel: 'instante t (horas)', yLabel: 'concentración C (mol/L)', labelSize: 0.047,
  tickFmt: (v) => String(v),
  colorAt: (t) => (REACCION.dC(t) >= 0 ? 0xffb347 : 0x5cc8ff),
});
plot.group.position.set(-0.7, 1.25, -1.55);
room.add(plot.group);

// zona sensible: arrastrar sobre el gráfico mueve el instante
const scrubProxy = new THREE.Mesh(new THREE.PlaneGeometry(plot.width + 0.12, plot.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
scrubProxy.position.set(plot.width / 2, plot.height / 2, 0.01);
plot.group.add(scrubProxy);
const _plane = new THREE.Plane(), _n = new THREE.Vector3(), _pt = new THREE.Vector3(), _c = new THREE.Vector3();
function tFromPointer(p, hit) {
  plot.group.updateWorldMatrix(true, false);
  let world;
  if (hit) world = hit.point.clone();
  else {
    _n.set(0, 0, 1).transformDirection(plot.group.matrixWorld);
    plot.group.getWorldPosition(_c);
    _plane.setFromNormalAndCoplanarPoint(_n, _c);
    if (!p.ray.intersectPlane(_plane, _pt)) return null;
    world = _pt.clone();
  }
  const local = plot.group.worldToLocal(world);
  return Math.min(T_MAX_VIS, Math.max(0, plot.xFromLocal(local.x)));
}
input.add(scrubProxy, {
  cursor: 'ew-resize',
  onDown(hit, p) { state.playing = false; const t = tFromPointer(p, hit); if (t != null) state.t = t; },
  onMove(hit, p) { const t = tFromPointer(p, hit); if (t != null) state.t = t; },
});

// ---------------------------------------------------------------- lectura sobre el reactor
const readout = createPanel({
  width: 0.86, height: 0.5, ppm: 900, background: true,
  draw(ctx, W, H) {
    const t = state.t, c = REACCION.C(t), d = REACCION.dC(t);
    const rows = [
      ['instante t', `${formatoNum(t, 2)} h`, THEME.text],
      ['concentración C', `${formatoNum(c, 3)} mol/L`, THEME.accent],
      ['variación C′', `${d > 0.0005 ? '+' : d < -0.0005 ? '−' : ''}${formatoNum(Math.abs(d), 3)} (mol/L)/h`, Math.abs(d) < 0.01 ? THEME.good : d > 0 ? THEME.accent : THEME.accent2],
    ];
    ctx.textBaseline = 'middle';
    rows.forEach(([lab, val, col], i) => {
      const y = H * (0.2 + i * 0.25);
      ctx.textAlign = 'left'; ctx.fillStyle = THEME.dim; ctx.font = font(H * 0.07, 600);
      ctx.fillText(lab, W * 0.05, y);
      ctx.textAlign = 'right'; ctx.fillStyle = col; ctx.font = font(H * 0.115, 700);
      ctx.fillText(val, W * 0.96, y);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = THEME.dim; ctx.font = font(H * 0.062, 500);
    const msg = Math.abs(d) < 0.01 ? 'C′ = 0: la concentración alcanza su máximo' : d > 0 ? 'C′ > 0: la concentración sube' : 'C′ < 0: la concentración baja';
    ctx.fillText(msg, W * 0.05, H * 0.95);
  },
});
readout.mesh.position.set(VX + 0.12, 1.98, VZ + 0.15);
readout.mesh.rotation.y = 0.28;
room.add(readout.mesh);

// ---------------------------------------------------------------- consola de control
const consoleGroup = new THREE.Group();
consoleGroup.position.set(1.55, 0, -0.55);
consoleGroup.rotation.y = Math.atan2(-1.55, 1.6);
room.add(consoleGroup);
box(0.5, 0.8, 0.34, new THREE.MeshStandardMaterial({ color: 0x2c333c, roughness: 0.55, metalness: 0.35 }), 0, 0.4, 0, consoleGroup);

const CW = Math.round(1.12 * 880), CH = Math.round(0.9 * 880); // rejilla de la consola (1,12 x 0,9 m a 880 ppm)
const ctrl = createPanel({
  width: 1.12, height: 0.9, ppm: 880, title: 'FUNCIÓN OBJETIVO',
  draw(ctx, W, H) {
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = THEME.text; ctx.font = font(H * 0.07, 700);
    ctx.fillText('C(t) = 4t e^(−0,3t),   t ≥ 0', W * 0.04, H * 0.168);
    ctx.fillStyle = THEME.dim; ctx.font = font(H * 0.044, 400);
    wrapText(ctx, 'Determina el instante en el que la concentración alcanza su valor máximo y calcula dicho valor máximo.', W * 0.04, H * 0.222, W * 0.92, H * 0.052);
    ctx.fillStyle = THEME.dim; ctx.font = font(H * 0.046, 600);
    ctx.textAlign = 'left';
    ctx.fillText('Instante', W * 0.04, H * 0.505);
    ctx.fillText('Velocidad', W * 0.04, H * 0.665);
    ctx.fillStyle = THEME.text; ctx.textAlign = 'right';
    ctx.fillText(`${formatoNum(state.t, 2)} h`, W * 0.96, H * 0.505);
    ctx.fillText(`${formatoNum(state.speed, 1)} h/s`, W * 0.96, H * 0.665);
    ctx.textAlign = 'left'; ctx.fillStyle = state.reveal ? THEME.good : THEME.dim; ctx.font = font(H * 0.042, 400);
    wrapText(ctx, state.reveal
      ? 'C′(t) = 4e^(−0,3t)(1 − 0,3t) = 0 en t = 10/3 h. Valor: C(10/3) = 40/(3e) ≈ 4,905 mol/L.'
      : 'Observa cuándo dejan de salir burbujas y qué le pasa al color del líquido.', W * 0.04, H * 0.905, W * 0.92, H * 0.048);
  },
  widgets: [
    { type: 'button', id: 'play', x: 0.04 * CW, y: 0.355 * CH, w: 0.44 * CW, h: 0.085 * CH, label: () => (state.playing ? '❚❚  Pausar' : '▶  Reproducir'), onClick: () => { state.playing = !state.playing; } },
    { type: 'button', id: 'reset', x: 0.52 * CW, y: 0.355 * CH, w: 0.44 * CW, h: 0.085 * CH, label: '↺  Reiniciar', onClick: () => { state.t = 0; state.playing = true; } },
    { type: 'slider', id: 'tslider', x: 0.04 * CW, y: 0.52 * CH, w: 0.92 * CW, h: 0.05 * CH, min: 0, max: T_MAX_VIS, step: 0.01, get: () => state.t, set: (v) => { state.t = v; state.playing = false; } },
    { type: 'slider', id: 'speed', x: 0.04 * CW, y: 0.68 * CH, w: 0.92 * CW, h: 0.05 * CH, min: 0.2, max: 3, step: 0.1, color: '#ffb347', get: () => state.speed, set: (v) => { state.speed = v; } },
    { type: 'toggle', id: 'deriv', x: 0.04 * CW, y: 0.765 * CH, w: 0.29 * CW, h: 0.085 * CH, label: 'Derivada', get: () => state.showDeriv, set: (v) => { state.showDeriv = v; } },
    { type: 'toggle', id: 'max', x: 0.355 * CW, y: 0.765 * CH, w: 0.30 * CW, h: 0.085 * CH, label: 'Revelar máximo', get: () => state.reveal, set: (v) => { state.reveal = v; applyReveal(); } },
    { type: 'button', id: 'gomax', x: 0.68 * CW, y: 0.765 * CH, w: 0.28 * CW, h: 0.085 * CH, label: 'Ir al máximo', onClick: () => { state.t = REACCION.tMax; state.playing = false; } },
  ],
});
ctrl.mesh.position.set(0, 1.18, 0.16);
ctrl.mesh.rotation.x = -0.2;
consoleGroup.add(ctrl.mesh);
ctrl.register(input);
console.assert(ctrl.W === CW && ctrl.H === CH, 'rejilla de la consola', ctrl.W, ctrl.H);

function applyReveal() {
  if (state.reveal) {
    plot.addPoint('max', REACCION.tMax, REACCION.CMax, {
      color: 0x6fe3a2,
      labelX: 't* = 10/3 h ≈ 3,33 h',
      labelY: 'C(t*) ≈ 4,905',
    });
    plot.addPoint('maxline', 0, REACCION.CMax, { color: 0x6fe3a2, radiusP: 0.0001, guides: false });
  } else { plot.removePoint('max'); plot.removePoint('maxline'); }
  ctrl.invalidate();
}

// ---------------------------------------------------------------- DOM de escritorio
const $ = (id) => document.getElementById(id);
const bPlay = $('b-play'), bReset = $('b-reset'), rT = $('r-t'), oT = $('o-t'), bDeriv = $('b-deriv'), bMax = $('b-max');
bPlay.onclick = () => { state.playing = !state.playing; };
bReset.onclick = () => { state.t = 0; state.playing = true; };
rT.oninput = () => { state.t = parseFloat(rT.value); state.playing = false; };
bDeriv.onclick = () => { state.showDeriv = !state.showDeriv; };
bMax.onclick = () => { state.reveal = !state.reveal; applyReveal(); };
app.onXR((on) => {
  $('controls').style.display = on ? 'none' : '';
  $('hud').style.display = on ? 'none' : '';
});

// ---------------------------------------------------------------- color del líquido según C
const stops = [[0, new THREE.Color(0xf6efb8)], [0.35, new THREE.Color(0xf3b43d)], [0.7, new THREE.Color(0xd9492f)], [1, new THREE.Color(0x7d1650)]];
const tmpC = new THREE.Color();
function liquidColor(c) {
  const k = Math.min(1, Math.max(0, c / 5));
  for (let i = 1; i < stops.length; i++) {
    if (k <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; return tmpC.copy(ca).lerp(cb, (k - a) / (b - a)); }
  }
  return tmpC.copy(stops[stops.length - 1][1]);
}

// ---------------------------------------------------------------- bucle
let barSpin = 0, bubbleAcc = 0;
const labelMax = 6;
app.onUpdate((dt, time) => {
  if (state.playing) {
    state.t += state.speed * dt;
    if (state.t >= T_MAX_VIS) { state.t = T_MAX_VIS; state.playing = false; }
  }
  const t = state.t, c = REACCION.C(t), d = REACCION.dC(t);

  // líquido
  const col = liquidColor(c);
  liquidMat.color.copy(col); surfaceMat.color.copy(col);
  liquidMat.emissive.copy(col).multiplyScalar(0.12 + 0.1 * Math.min(1, c / 5));
  liquidMat.opacity = 0.9 + 0.08 * Math.min(1, c / 5);

  // barra y burbujas
  barSpin += dt * (8 + 6 * Math.min(1, c / 5));
  bar.rotation.set(0, barSpin, Math.PI / 2);
  bar.rotation.order = 'ZYX';
  bar.rotation.set(Math.PI / 2, 0, barSpin);
  const rate = Math.max(0, d) / 4;               // 0..1 (C' vale 4 en t = 0)
  const active = Math.round(NB * Math.min(1, rate));
  bubbles.count = active;
  for (let i = 0; i < active; i++) {
    const b = bub[i];
    b.y += b.v * dt * (0.6 + rate);
    b.x += Math.sin(time * 0.002 + b.ph) * 0.0002;
    if (b.y > V0 + 0.02 + LIQ_H - 0.004) respawn(b);
    _p.set(b.x, b.y, b.z); _s.setScalar(b.s);
    _m.compose(_p, _q, _s); bubbles.setMatrixAt(i, _m);
  }
  bubbles.instanceMatrix.needsUpdate = true;

  // marcador y tangente del gráfico
  const atMax = Math.abs(d) < 0.02 && t > 0.5;
  plot.setMarker(t, { color: atMax ? 0x6fe3a2 : 0xffffff });
  plot.setTangent(t, state.showDeriv ? d : null, { color: d >= 0 ? 0xffd08a : 0x9be0ff, len: 0.42 });

  // interfaz
  readout.invalidate(); ctrl.invalidate();
  readout.update(performance.now()); ctrl.update(performance.now());
  bPlay.textContent = state.playing ? '❚❚ Pausar' : '▶ Reproducir';
  bDeriv.classList.toggle('on', state.showDeriv);
  bMax.classList.toggle('on', state.reveal);
  if (document.activeElement !== rT) rT.value = String(t);
  oT.textContent = `${formatoNum(t, 2)} h`;
  void labelMax; void setLabelText;
});

readout.register(input);
loading(null);
window.__reactor = { app, state, plot, REACCION };
