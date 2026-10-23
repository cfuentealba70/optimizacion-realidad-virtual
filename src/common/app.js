// Aplicación base: renderizador, cámara, órbita en escritorio, sesión de realidad virtual,
// entrada por rayos, locomoción con joystick y bucle de animación.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createInput } from './input.js';
import { tr } from './i18n.js';

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

  // Fundido a negro breve al teletransportarse en realidad virtual: evita el salto brusco de la imagen, que marea.
  const velo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false }));
  velo.renderOrder = 10000; velo.visible = false; velo.frustumCulled = false;
  camera.add(velo);
  let veloT = 0;

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
      if (renderer.xr.isPresenting) { veloT = 1; velo.material.opacity = 1; velo.visible = true; }
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
    if (veloT > 0) { veloT = Math.max(0, veloT - dt / 0.35); velo.material.opacity = veloT * veloT; velo.visible = veloT > 0; }
    if (!renderer.xr.isPresenting) orbit.update();
    for (const fn of updaters) fn(dt, time);
    if (billboards.size) {
      camera.getWorldPosition(camPos);
      for (const b of billboards) b.lookAt(camPos);
    }
    // una página puede repartir el lienzo en varias vistas cuando no hay sesión de realidad virtual
    if (app.renderizar && !renderer.xr.isPresenting) app.renderizar(renderer, scene, camera);
    else renderer.render(scene, camera);
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
  // el botón de three.js viene en inglés: se pasa al español y de ahí al idioma de la interfaz
  const trans = () => { const t = tr(TR[vrButton.textContent.trim()]); if (t && vrButton.textContent !== t) vrButton.textContent = t; };
  new MutationObserver(trans).observe(vrButton, { childList: true, characterData: true, subtree: true });
  trans();
  document.body.appendChild(vrButton);
  app.vrButton = vrButton;

  return app;
}

// Pantalla de carga con el nombre de la página, el paso en curso y una barra de avance (fracción de 0 a 1, o indefinida).
// Con text = null se desvanece y se retira.
export function loading(text, fraccion = null) {
  let el = document.getElementById('loading');
  if (text == null) {
    if (el) { el.id = 'loading-fuera'; el.classList.add('fuera'); setTimeout(() => el.remove(), 450); }
    return;
  }
  if (!el) {
    el = document.createElement('div'); el.id = 'loading'; el.className = 'pantalla-carga';
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    const titulo = (document.title || '').split('·')[0].trim() || tr('Cargando');
    el.innerHTML = '<div class="carga"><div class="carga-titulo"></div><div class="carga-texto"></div><div class="carga-barra"><span></span></div>'
      + '<div class="carga-nota"></div></div>';
    el.querySelector('.carga-titulo').textContent = titulo;
    el.querySelector('.carga-nota').textContent = tr('La primera carga puede tardar hasta un minuto, sobre todo en las gafas.');
    document.body.appendChild(el);
  }
  el.querySelector('.carga-texto').textContent = tr(text);
  const barra = el.querySelector('.carga-barra'), relleno = barra.querySelector('span');
  if (fraccion == null) barra.classList.add('indet');
  else { barra.classList.remove('indet'); relleno.style.width = Math.round(Math.max(0, Math.min(1, fraccion)) * 100) + '%'; }
}
