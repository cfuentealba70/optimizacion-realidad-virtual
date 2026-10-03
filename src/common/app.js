// Aplicación base: renderizador, cámara, órbita en escritorio, sesión de realidad virtual,
// entrada por rayos, locomoción con joystick y bucle de animación.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createInput } from './input.js';

export function createApp(opts = {}) {
  const {
    container = document.getElementById('app') || document.body,
    fov = 60, near = 0.05, far = 20000,
    exposure = 0.9, shadows = true,
    camera: camOpts = { position: [0, 1.6, 3], target: [0, 1.2, 0] },
    orbit: orbitOpts = {},
    xrStart = { position: [0, 0, 0], yaw: 0 },
    background = 0x0b1220,
  } = opts;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  if (renderer.xr.setFoveation) renderer.xr.setFoveation(0.65);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const rig = new THREE.Group();
  rig.name = 'rig';
  scene.add(rig);
  const camera = new THREE.PerspectiveCamera(fov, renderer.domElement.clientWidth / Math.max(1, renderer.domElement.clientHeight), near, far);
  camera.position.set(...camOpts.position);
  rig.add(camera);

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(...camOpts.target);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  Object.assign(orbit, orbitOpts);
  orbit.update();

  const input = createInput({ renderer, camera, rig, domElement: renderer.domElement, orbit });

  const updaters = [];
  const xrListeners = [];
  const billboards = new Set();
  let lastFrame = performance.now();
  let lastT = performance.now();
  let frameCount = 0;

  const app = {
    THREE, renderer, scene, camera, rig, orbit, input, container,
    locomotion: { enabled: false, speed: 3, turn: true, fly: false, deadzone: 0.18 },
    xrStart,
    get isXR() { return renderer.xr.isPresenting; },
    onUpdate(fn) { updaters.push(fn); return () => { const i = updaters.indexOf(fn); if (i >= 0) updaters.splice(i, 1); }; },
    onXR(fn) { xrListeners.push(fn); },
    billboard(obj) { billboards.add(obj); return obj; },
    frameCount: () => frameCount,
    // Mueve al usuario en realidad virtual
    teleportRig(position, yaw = null) {
      rig.position.set(position[0] ?? position.x, position[1] ?? position.y, position[2] ?? position.z);
      if (yaw !== null) rig.rotation.y = yaw;
    },
    resize() {
      const w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    // Fuerza un cuadro (útil en pruebas con la pestaña oculta)
    step(dt = 1 / 60) { frame(performance.now(), null, dt); },
  };

  const tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const headPos = new THREE.Vector3();
  let snapCool = 0;

  function locomote(dt) {
    const L = app.locomotion;
    if (!L.enabled || !renderer.xr.isPresenting) return;
    const dz = L.deadzone;
    const [lx, ly] = input.axes('left');
    const [rx, ry] = input.axes('right');
    if (Math.hypot(lx, ly) > dz) {
      camera.getWorldQuaternion(tmpQ);
      tmpV.set(lx, 0, ly).applyQuaternion(tmpQ);
      tmpV.y = 0;
      if (tmpV.lengthSq() > 1e-6) { tmpV.normalize(); rig.position.addScaledVector(tmpV, Math.min(1, Math.hypot(lx, ly)) * L.speed * dt); }
    }
    if (L.fly && Math.abs(ry) > dz) rig.position.y -= ry * L.speed * 0.6 * dt;
    snapCool -= dt;
    if (L.turn && Math.abs(rx) > 0.7 && snapCool <= 0) {
      camera.getWorldPosition(headPos);
      const a = -Math.sign(rx) * THREE.MathUtils.degToRad(30);
      rig.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), a);
      // mantiene la cabeza en el mismo punto del mundo
      const moved = new THREE.Vector3();
      camera.getWorldPosition(moved);
      rig.position.add(headPos.sub(moved));
      snapCool = 0.28;
    }
  }

  const camPos = new THREE.Vector3();
  function frame(time, xrFrame, dtOverride) {
    lastFrame = performance.now();
    frameCount++;
    const nowT = performance.now();
    const dt = dtOverride ?? Math.min((nowT - lastT) / 1000, 0.1);
    lastT = nowT;
    input.update();
    locomote(dt);
    if (!renderer.xr.isPresenting) orbit.update();
    for (const fn of updaters) fn(dt, time);
    if (billboards.size) {
      camera.getWorldPosition(camPos);
      for (const b of billboards) b.lookAt(camPos);
    }
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop((t, f) => frame(t, f));
  // Algunos entornos (pestañas ocultas) detienen requestAnimationFrame: respaldo con temporizador
  setInterval(() => {
    if (!renderer.xr.isPresenting && performance.now() - lastFrame > 700) frame(performance.now(), null, 1 / 30);
  }, 120);

  window.addEventListener('resize', () => app.resize());

  // Sesión de realidad virtual
  renderer.xr.addEventListener('sessionstart', () => {
    orbit.enabled = false;
    app.teleportRig(app.xrStart.position, app.xrStart.yaw || 0);
    for (const fn of xrListeners) fn(true);
  });
  renderer.xr.addEventListener('sessionend', () => {
    orbit.enabled = true;
    rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
    for (const fn of xrListeners) fn(false);
  });

  const vrButton = VRButton.createButton(renderer, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
  vrButton.id = 'vr-button';
  const TR = { 'ENTER VR': 'ENTRAR EN VR', 'EXIT VR': 'SALIR DE VR', 'VR NOT SUPPORTED': 'VR NO DISPONIBLE AQUÍ', 'VR NOT ALLOWED': 'VR NO PERMITIDO', 'WEBXR NEEDS HTTPS': 'WEBXR REQUIERE HTTPS', 'WEBXR NOT AVAILABLE': 'WEBXR NO DISPONIBLE' };
  const trans = () => { const t = TR[vrButton.textContent.trim()]; if (t && vrButton.textContent !== t) vrButton.textContent = t; };
  new MutationObserver(trans).observe(vrButton, { childList: true, characterData: true, subtree: true });
  trans();
  document.body.appendChild(vrButton);
  app.vrButton = vrButton;

  return app;
}

// Un pequeño rótulo de carga que se retira solo
export function loading(text) {
  let el = document.getElementById('loading');
  if (!el) { el = document.createElement('div'); el.id = 'loading'; document.body.appendChild(el); }
  if (text == null) { el.remove(); return; }
  el.textContent = text;
}
