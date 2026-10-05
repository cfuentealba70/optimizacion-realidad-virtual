// Paneles flotantes dibujados en canvas, con botones, interruptores y deslizadores.
// Sirven igual con ratón que con el rayo de un mando.
import * as THREE from 'three';

const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

export const THEME = {
  panel: 'rgba(14, 22, 34, 0.86)',
  edge: 'rgba(160, 200, 255, 0.35)',
  text: '#eaf2fb',
  dim: '#9fb4c8',
  accent: '#ffb347',
  accent2: '#5cc8ff',
  good: '#6fe3a2',
  bad: '#ff7a7a',
  btn: 'rgba(60, 86, 120, 0.9)',
  btnHover: 'rgba(92, 128, 176, 0.98)',
  btnOn: 'rgba(255, 179, 71, 0.95)',
};

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function font(px, weight = 400) { return `${weight} ${px}px ${FONT}`; }

// Texto que se ajusta a un ancho y devuelve la altura usada
export function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = String(text).split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lineH; } else line = test;
  }
  if (line) { ctx.fillText(line, x, yy); yy += lineH; }
  return yy - y;
}

/**
 * opts: {
 *   width, height  (metros), ppm (píxeles por metro),
 *   draw(ctx, W, H, panel)    dibujo propio, antes de los controles
 *   widgets: [{ type:'button'|'toggle'|'slider', id, x,y,w,h (px), label, onClick(), get(), set(v), min,max,step, format(v) }]
 *   minInterval  (ms entre redibujos)
 *   background   (false para transparente)
 * }
 */
export function createPanel(opts) {
  const { width = 0.9, height = 0.55, ppm = 900, draw, widgets = [], minInterval = 70, background = true, title = null } = opts;
  const W = Math.round(width * ppm), H = Math.round(height * ppm);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.renderOrder = 10;

  const panel = { mesh, width, height, W, H, ppm, canvas, ctx, widgets, hoverId: null, activeId: null, dirty: true, last: 0, title };

  function pxFromHit(hit) { return [hit.uv.x * W, (1 - hit.uv.y) * H]; }
  function widgetAt(px, py) {
    for (let i = widgets.length - 1; i >= 0; i--) {
      const w = widgets[i];
      if (w.visible && !w.visible()) continue;
      if (px >= w.x && px <= w.x + w.w && py >= w.y && py <= w.y + w.h) return w;
    }
    return null;
  }

  function paint() {
    ctx.clearRect(0, 0, W, H);
    if (background) {
      roundRect(ctx, 2, 2, W - 4, H - 4, Math.min(W, H) * 0.035);
      ctx.fillStyle = THEME.panel; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = THEME.edge; ctx.stroke();
    }
    if (title) {
      ctx.fillStyle = THEME.dim; ctx.font = font(Math.round(H * 0.058), 600); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillText(title, W * 0.04, H * 0.04);
    }
    draw?.(ctx, W, H, panel);
    for (const w of widgets) {
      if (w.visible && !w.visible()) continue;
      const hover = panel.hoverId === w.id, active = panel.activeId === w.id;
      if (w.type === 'slider') drawSlider(w, hover || active);
      else drawButton(w, hover, active);
    }
    texture.needsUpdate = true;
    panel.dirty = false;
  }

  function drawButton(w, hover, active) {
    const on = w.type === 'toggle' && w.get?.();
    roundRect(ctx, w.x, w.y, w.w, w.h, Math.min(w.h * 0.28, 18));
    ctx.fillStyle = on ? THEME.btnOn : hover ? THEME.btnHover : THEME.btn;
    ctx.fill();
    if (active) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    ctx.fillStyle = on ? '#1a1206' : '#fff';
    ctx.font = font(Math.round(w.h * (w.fontScale || 0.42)), 600);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = typeof w.label === 'function' ? w.label() : w.label;
    ctx.fillText(label, w.x + w.w / 2, w.y + w.h / 2 + 1);
  }

  function drawSlider(w, hot) {
    const v = w.get(), t = (v - w.min) / (w.max - w.min);
    const ty = w.y + w.h / 2, bh = Math.max(8, w.h * 0.22);
    roundRect(ctx, w.x, ty - bh / 2, w.w, bh, bh / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    roundRect(ctx, w.x, ty - bh / 2, Math.max(bh, w.w * t), bh, bh / 2);
    ctx.fillStyle = w.color || THEME.accent2; ctx.fill();
    ctx.beginPath(); ctx.arc(w.x + w.w * t, ty, w.h * (hot ? 0.42 : 0.36), 0, Math.PI * 2);
    ctx.fillStyle = hot ? '#fff' : '#e8f1fb'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
  }

  function sliderValue(w, px) {
    let t = (px - w.x) / w.w;
    t = Math.max(0, Math.min(1, t));
    let v = w.min + t * (w.max - w.min);
    if (w.step) v = Math.round(v / w.step) * w.step;
    return Math.max(w.min, Math.min(w.max, v));
  }

  const plane = new THREE.Plane();
  const nrm = new THREE.Vector3();
  const pt = new THREE.Vector3();
  const pos = new THREE.Vector3();
  function pxFromRay(p) {
    mesh.updateWorldMatrix(true, false);
    nrm.set(0, 0, 1).transformDirection(mesh.matrixWorld);
    mesh.getWorldPosition(pos);
    plane.setFromNormalAndCoplanarPoint(nrm, pos);
    if (!p.ray.intersectPlane(plane, pt)) return null;
    const local = mesh.worldToLocal(pt.clone());
    return [(local.x / width + 0.5) * W, (0.5 - local.y / height) * H];
  }

  panel.handlers = {
    cursor: 'pointer',
    onHover(hit) {
      const [x, y] = pxFromHit(hit);
      const w = widgetAt(x, y);
      const id = w ? w.id : null;
      if (id !== panel.hoverId) { panel.hoverId = id; panel.dirty = true; }
    },
    onLeave() { if (panel.hoverId !== null) { panel.hoverId = null; panel.dirty = true; } },
    onDown(hit) {
      const [x, y] = pxFromHit(hit);
      const w = widgetAt(x, y);
      if (!w) return;
      panel.activeId = w.id; panel.dirty = true;
      if (w.type === 'slider') w.set(sliderValue(w, x));
      else if (w.type === 'toggle') { w.set ? w.set(!w.get()) : w.onClick?.(); }
      else w.onClick?.();
    },
    onMove(hit, p) {
      const w = widgets.find((q) => q.id === panel.activeId);
      if (!w || w.type !== 'slider') return;
      const px = hit ? pxFromHit(hit)[0] : (pxFromRay(p) || [null])[0];
      if (px == null) return;
      w.set(sliderValue(w, px)); panel.dirty = true;
    },
    onUp() { panel.activeId = null; panel.dirty = true; },
  };

  panel.invalidate = () => { panel.dirty = true; };
  panel.update = (nowMs) => {
    if (!panel.dirty) return;
    if (nowMs - panel.last < minInterval) return;
    panel.last = nowMs;
    paint();
  };
  panel.register = (input, enabled) => { panel.item = input.add(mesh, panel.handlers, enabled); return panel.item; };
  panel.dispose = () => { texture.dispose(); mat.dispose(); mesh.geometry.dispose(); };
  paint();
  return panel;
}

// Etiqueta de texto suelta en el espacio 3D
export function createLabel(text, { size = 0.06, color = '#fff', bg = null, weight = 600, align = 'center', ppm = 1400, pad = 0.18, billboard = false, depthTest = true } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const px = Math.round(size * ppm);
  g.font = font(px, weight);
  const lines = String(text).split('\n');
  const wText = Math.max(...lines.map((l) => g.measureText(l).width));
  const padPx = px * pad;
  c.width = Math.ceil(wText + padPx * 2); c.height = Math.ceil(lines.length * px * 1.2 + padPx * 2);
  const g2 = c.getContext('2d');
  if (bg) { roundRect(g2, 0, 0, c.width, c.height, px * 0.3); g2.fillStyle = bg; g2.fill(); }
  g2.font = font(px, weight); g2.fillStyle = color; g2.textBaseline = 'middle';
  g2.textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
  const tx = align === 'left' ? padPx : align === 'right' ? c.width - padPx : c.width / 2;
  lines.forEach((l, i) => g2.fillText(l, tx, padPx + px * 0.6 + i * px * 1.2));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const w = c.width / ppm, h = c.height / ppm;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, depthTest, side: THREE.DoubleSide }));
  mesh.renderOrder = 12;
  mesh.userData.billboard = billboard;
  mesh.userData.size = [w, h];
  return mesh;
}

export function setLabelText(mesh, text, opts) {
  const n = createLabel(text, opts);
  mesh.material.map.dispose();
  mesh.geometry.dispose();
  mesh.material.map = n.material.map;
  mesh.geometry = n.geometry;
  mesh.userData.size = n.userData.size;
}
