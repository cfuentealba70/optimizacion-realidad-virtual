// Entrada unificada: ratón o dedo en el escritorio y mandos/manos en realidad virtual.
// Todo funciona con rayos. Los objetos interactivos se registran con manejadores.
import * as THREE from 'three';

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _ndc = new THREE.Vector2();

export function createInput({ renderer, camera, rig, domElement, orbit }) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 20000;
  const items = [];
  const pointers = [];
  let onCursor = null;

  function itemOf(obj) {
    let o = obj;
    while (o) {
      const it = items.find((i) => i.object === o);
      if (it) return it;
      o = o.parent;
    }
    return null;
  }

  function pick(p) {
    const targets = [];
    for (const it of items) if (it.enabled === undefined || (typeof it.enabled === 'function' ? it.enabled() : it.enabled)) targets.push(it.object);
    if (!targets.length) return null;
    raycaster.set(p.origin, p.dir);
    const hits = raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      const it = itemOf(h.object);
      if (it) return { item: it, hit: h };
    }
    return null;
  }

  function makePointer(kind, extra = {}) {
    const p = {
      kind, origin: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), ray: new THREE.Ray(),
      hover: null, hit: null, captured: null, down: false, active: kind === 'mouse', ...extra,
    };
    pointers.push(p);
    return p;
  }

  function pressStart(p) {
    p.down = true;
    const r = pick(p);
    if (r) {
      p.captured = r.item;
      p.hit = r.hit;
      if (orbit && p.kind === 'mouse' && r.item.h.blockOrbit !== false) orbit.enabled = false;
      r.item.h.onDown?.(r.hit, p);
    }
  }
  function pressEnd(p) {
    p.down = false;
    if (p.captured) {
      const it = p.captured;
      p.captured = null;
      const r = pick(p);
      it.h.onUp?.(r && r.item === it ? r.hit : null, p);
    }
    if (orbit && p.kind === 'mouse') orbit.enabled = true;
  }

  // ---- Ratón y táctil ----
  const mouse = makePointer('mouse');
  mouse.ndcValid = false;
  function setNdc(e) {
    const r = domElement.getBoundingClientRect();
    _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    mouse.ndcValid = true;
  }
  domElement.addEventListener('pointermove', (e) => { setNdc(e); });
  domElement.addEventListener('pointerdown', (e) => {
    if (renderer.xr.isPresenting) return;
    setNdc(e); updateMouseRay(); pressStart(mouse);
    if (mouse.captured) { try { domElement.setPointerCapture(e.pointerId); } catch { /* sin captura */ } }
  });
  const up = () => { if (mouse.down) pressEnd(mouse); };
  domElement.addEventListener('pointerup', up);
  domElement.addEventListener('pointercancel', up);
  domElement.addEventListener('pointerleave', () => { mouse.ndcValid = false; });

  function updateMouseRay() {
    if (!mouse.ndcValid) return;
    raycaster.setFromCamera(_ndc, camera);
    mouse.origin.copy(raycaster.ray.origin);
    mouse.dir.copy(raycaster.ray.direction);
    mouse.ray.set(mouse.origin, mouse.dir);
  }

  // ---- Mandos de realidad virtual ----
  const controllers = [];
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    rig.add(c);
    const p = makePointer('xr', { index: i, controller: c, active: false, source: null, ndcValid: true });
    // Rayo visible
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false }));
    line.renderOrder = 999;
    line.scale.z = 1.2;
    c.add(line);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd34d, depthTest: false }));
    dot.renderOrder = 1000; dot.visible = false;
    rig.add(dot);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x20262e, roughness: 0.5, metalness: 0.3 }));
    body.rotation.x = Math.PI / 2; body.position.z = 0.03;
    c.add(body);
    p.line = line; p.dot = dot;
    c.addEventListener('connected', (e) => { p.source = e.data; p.active = true; p.handedness = e.data.handedness; });
    c.addEventListener('disconnected', () => { p.source = null; p.active = false; });
    c.addEventListener('selectstart', () => pressStart(p));
    c.addEventListener('selectend', () => pressEnd(p));
    controllers.push(p);
  }

  function updateXrRay(p) {
    const c = p.controller;
    c.getWorldPosition(_o);
    c.getWorldQuaternion(_q);
    _d.set(0, 0, -1).applyQuaternion(_q).normalize();
    p.origin.copy(_o); p.dir.copy(_d); p.ray.set(p.origin, p.dir);
  }

  function update() {
    updateMouseRay();
    const present = renderer.xr.isPresenting;
    let cursor = '';
    for (const p of pointers) {
      if (p.kind === 'mouse' && present) continue;
      if (p.kind === 'xr') {
        if (!present || !p.active) { p.dot.visible = false; continue; }
        updateXrRay(p);
      } else if (!mouse.ndcValid && !p.captured) {
        if (p.hover) { p.hover.h.onLeave?.(p); p.hover = null; }
        continue;
      }
      p.ray.set(p.origin, p.dir);
      if (p.captured) {
        const r = pick(p);
        p.hit = r && r.item === p.captured ? r.hit : null;
        p.captured.h.onMove?.(p.hit, p);
        if (p.kind === 'xr') { p.dot.visible = !!p.hit; if (p.hit) p.dot.position.copy(p.hit.point); p.line.scale.z = p.hit ? p.hit.distance : 1.2; }
        continue;
      }
      const r = pick(p);
      const it = r ? r.item : null;
      if (it !== p.hover) {
        p.hover?.h.onLeave?.(p);
        p.hover = it;
        it?.h.onEnter?.(r.hit, p);
      }
      if (it) { it.h.onHover?.(r.hit, p); if (p.kind === 'mouse') cursor = it.h.cursor || 'pointer'; }
      p.hit = r ? r.hit : null;
      if (p.kind === 'xr') {
        p.dot.visible = !!r;
        if (r) p.dot.position.copy(r.hit.point);
        p.line.scale.z = r ? r.hit.distance : 1.2;
      }
    }
    if (cursor !== onCursor) { domElement.style.cursor = cursor; onCursor = cursor; }
  }

  return {
    pointers, controllers, raycaster,
    // h: { onEnter(hit,p), onHover(hit,p), onLeave(p), onDown(hit,p), onMove(hit|null,p), onUp(hit|null,p), cursor, blockOrbit }
    add(object, h, enabled) {
      const it = { object, h, enabled };
      items.push(it);
      return it;
    },
    remove(it) { const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); },
    update,
    // Punto donde un rayo corta un plano dado en coordenadas del mundo
    rayPlane(p, plane, target = new THREE.Vector3()) { return p.ray.intersectPlane(plane, target); },
    // Ejes del joystick del mando (izquierdo o derecho)
    axes(handedness) {
      for (const p of controllers) {
        if (p.active && p.source && p.source.handedness === handedness && p.source.gamepad) {
          const a = p.source.gamepad.axes;
          return a.length >= 4 ? [a[2], a[3]] : [a[0] || 0, a[1] || 0];
        }
      }
      return [0, 0];
    },
    buttons(handedness) {
      for (const p of controllers) {
        if (p.active && p.source && p.source.handedness === handedness && p.source.gamepad) return p.source.gamepad.buttons;
      }
      return [];
    },
  };
}
