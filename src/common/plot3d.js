// Gráfico de una función dentro del espacio 3D: curva en tubo, ejes con graduación, marcador
// móvil y guías discontinuas hacia los dos ejes (para distinguir el valor de x del valor de y).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createLabel, setLabelText } from './panel.js';

export function dashedLine(a, b, { radius = 0.003, dash = 0.02, gap = 0.014, color = 0xffffff, opacity = 1 } = {}) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const geos = [];
  for (let s = 0; s < len; s += dash + gap) {
    const l = Math.min(dash, len - s);
    if (l <= 0) break;
    const g = new THREE.CylinderGeometry(radius, radius, l, 6, 1, false);
    g.translate(0, l / 2 + s, 0);
    g.applyQuaternion(q);
    g.translate(a.x, a.y, a.z);
    geos.push(g);
  }
  const geo = geos.length ? mergeGeometries(geos) : new THREE.BufferGeometry();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false }));
  return m;
}

export function createPlot(opts) {
  const {
    f: f0, x0 = 0, x1 = 1, y0 = 0, y1 = 1, width = 1, height = 0.6,
    xTicks = [], yTicks = [], xLabel = 'x', yLabel = 'y', samples = 260, radius = 0.0055,
    curveColor = 0xffb347, labelSize = 0.032, tickFmt = (v) => String(v), yTickFmt = null,
  } = opts;

  let f = f0;
  const group = new THREE.Group();
  const sx = width / (x1 - x0), sy = height / (y1 - y0);
  const toLocal = (x, y, z = 0) => new THREE.Vector3((x - x0) * sx, (y - y0) * sy, z);

  // Fondo
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.34, height + 0.3),
    new THREE.MeshBasicMaterial({ color: 0x0c1520, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }),
  );
  back.position.set(width / 2 - 0.03, height / 2 - 0.02, -0.004);
  back.renderOrder = 4;
  group.add(back);

  // Cuadrícula (líneas finas) y graduación
  const gridPts = [];
  for (const t of xTicks) { const p = toLocal(t, y0), q = toLocal(t, y1); gridPts.push(p, q); }
  for (const t of yTicks) { const p = toLocal(x0, t), q = toLocal(x1, t); gridPts.push(p, q); }
  const grid = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(gridPts),
    new THREE.LineBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.22, toneMapped: false }),
  );
  grid.position.z = -0.001;
  group.add(grid);

  const axMat = new THREE.MeshBasicMaterial({ color: 0xdfe9f4, toneMapped: false });
  const axX = new THREE.Mesh(new THREE.BoxGeometry(width, 0.0042, 0.0042), axMat);
  axX.position.set(width / 2, 0, 0);
  const axY = new THREE.Mesh(new THREE.BoxGeometry(0.0042, height, 0.0042), axMat);
  axY.position.set(0, height / 2, 0);
  group.add(axX, axY);

  const fmtY = yTickFmt || tickFmt;
  for (const t of xTicks) {
    const l = createLabel(tickFmt(t), { size: labelSize, color: '#cfe0f0', weight: 500 });
    l.position.copy(toLocal(t, y0)).add(new THREE.Vector3(0, -0.038, 0.002));
    group.add(l);
  }
  for (const t of yTicks) {
    const l = createLabel(fmtY(t), { size: labelSize, color: '#cfe0f0', weight: 500 });
    const w = l.userData.size[0];
    l.position.copy(toLocal(x0, t)).add(new THREE.Vector3(-w / 2 - 0.012, 0, 0.002));
    group.add(l);
  }
  const lx = createLabel(xLabel, { size: labelSize * 1.1, color: '#ffffff', weight: 700 });
  lx.position.set(width / 2, -0.095, 0.002);
  group.add(lx);
  const ly = createLabel(yLabel, { size: labelSize * 1.1, color: '#ffffff', weight: 700 });
  ly.position.set(Math.max(0.05, ly.userData.size[0] / 2 - 0.05), height + 0.05, 0.002);
  group.add(ly);

  // Curva
  let curveMesh = null;
  function buildCurve(fn) {
    if (curveMesh) { group.remove(curveMesh); curveMesh.geometry.dispose(); curveMesh.material.dispose(); }
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const x = x0 + ((x1 - x0) * i) / samples;
      const y = Math.min(y1, Math.max(y0, fn(x)));
      pts.push(toLocal(x, y, 0.001));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const radial = 7;
    const geo = new THREE.TubeGeometry(curve, samples, radius, radial, false);
    const cAttr = new Float32Array((samples + 1) * (radial + 1) * 3);
    const base = new THREE.Color(curveColor), c = new THREE.Color();
    for (let i = 0; i <= samples; i++) {
      const x = x0 + ((x1 - x0) * i) / samples;
      if (opts.colorAt) c.set(opts.colorAt(x)); else c.copy(base);
      for (let j = 0; j <= radial; j++) { const k = (i * (radial + 1) + j) * 3; cAttr[k] = c.r; cAttr[k + 1] = c.g; cAttr[k + 2] = c.b; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cAttr, 3));
    curveMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    curveMesh.renderOrder = 6;
    group.add(curveMesh);
  }
  buildCurve(f);

  // Marcador móvil con guías hacia los ejes
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.0165, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  );
  marker.renderOrder = 8;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
  marker.add(halo);
  group.add(marker);
  const live = new THREE.Group();
  group.add(live);
  let liveOn = true;
  let lastX = null;

  function setMarker(x, { guides = liveOn, color = 0xffffff } = {}) {
    const xv = Math.min(x1, Math.max(x0, x));
    const yv = f(xv);
    marker.position.copy(toLocal(xv, Math.min(y1, Math.max(y0, yv)), 0.004));
    marker.material.color.set(color);
    lastX = xv;
    while (live.children.length) { const o = live.children.pop(); o.geometry?.dispose(); o.material?.dispose(); }
    if (guides) {
      const p = marker.position;
      live.add(dashedLine(new THREE.Vector3(p.x, 0, 0.002), new THREE.Vector3(p.x, p.y, 0.002), { color: 0xffffff, opacity: 0.8 }));
      live.add(dashedLine(new THREE.Vector3(0, p.y, 0.002), new THREE.Vector3(p.x, p.y, 0.002), { color: 0xffffff, opacity: 0.8 }));
    }
    return { x: xv, y: yv };
  }

  // Punto fijo destacado (por ejemplo, el máximo) con guías de color hacia ambos ejes
  const fixed = new Map();
  function addPoint(id, x, y, { color = 0x6fe3a2, labelX = null, labelY = null, radiusP = 0.019, guides = true } = {}) {
    removePoint(id);
    const g = new THREE.Group();
    const p = toLocal(x, y, 0.003);
    const s = new THREE.Mesh(new THREE.SphereGeometry(radiusP, 20, 14), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    s.position.copy(p); s.renderOrder = 7;
    g.add(s);
    if (guides) {
      g.add(dashedLine(new THREE.Vector3(p.x, 0, 0.002), new THREE.Vector3(p.x, p.y, 0.002), { color, radius: 0.0032 }));
      g.add(dashedLine(new THREE.Vector3(0, p.y, 0.002), new THREE.Vector3(p.x, p.y, 0.002), { color, radius: 0.0032 }));
    }
    if (labelX) {
      const l = createLabel(labelX, { size: labelSize * 1.05, color: '#0b1520', bg: '#' + new THREE.Color(color).getHexString(), weight: 700 });
      l.position.set(p.x, -0.1 - 0.0, 0.004); l.position.y = -0.058;
      g.add(l);
    }
    if (labelY) {
      const l = createLabel(labelY, { size: labelSize * 1.05, color: '#0b1520', bg: '#' + new THREE.Color(color).getHexString(), weight: 700 });
      l.position.set(-l.userData.size[0] / 2 - 0.02, p.y, 0.004);
      g.add(l);
    }
    group.add(g);
    fixed.set(id, g);
    return g;
  }
  function removePoint(id) {
    const g = fixed.get(id);
    if (g) { group.remove(g); g.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); fixed.delete(id); }
  }

  // Línea tangente en x con pendiente m (segmento corto)
  let tangent = null;
  function setTangent(x, m, { len = 0.22, color = 0x5cc8ff } = {}) {
    if (tangent) { group.remove(tangent); tangent.geometry.dispose(); tangent.material.dispose(); tangent = null; }
    if (m == null) return;
    const y = f(x), a = toLocal(x, y, 0.005);
    const dir = new THREE.Vector3(1 * sx, m * sy, 0).normalize();
    tangent = dashedLine(a.clone().addScaledVector(dir, -len / 2), a.clone().addScaledVector(dir, len / 2), { radius: 0.0034, dash: 0.2, gap: 0.0001, color });
    tangent.renderOrder = 9;
    group.add(tangent);
  }

  function setFunction(fn, newColorAt) {
    f = fn;
    if (newColorAt) opts.colorAt = newColorAt;
    buildCurve(fn);
    if (lastX != null) setMarker(lastX);
  }

  return {
    group, marker, toLocal, setMarker, addPoint, removePoint, setTangent, buildCurve, setFunction,
    setLive(v) { liveOn = v; if (lastX != null) setMarker(lastX, { guides: v }); },
    xFromLocal(px) { return x0 + px / sx; },
    width, height, x0, x1, y0, y1, labelSize,
    setLabelText,
  };
}
