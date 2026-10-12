// Kit común de las estaciones de la Guía 4: paneles con diseño automático, arrastre sobre planos,
// reloj para las razones de cambio, etiquetas a escala del mundo y atajos de geometría.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPanel, createLabel, setLabelText, THEME, font, wrapText, roundRect } from '../src/common/panel.js';
import { createPlot, dashedLine } from '../src/common/plot3d.js';
import * as tex from '../src/common/textures.js';
import { createWater } from '../src/common/water.js';
import { num, pesos } from '../src/math/guia4.js';

const PPM = 760;

function contarLineas(ctx, text, maxW) {
  const words = String(text).split(' ');
  let line = '', n = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { n++; line = w; } else line = test;
  }
  return line ? n + 1 : n;
}

export function crearKit(app) {
  const kit = {
    THREE, app, scene: app.scene, input: app.input, camera: app.camera, rig: app.rig,
    createPanel, createLabel, setLabelText, THEME, font, wrapText, roundRect, createPlot, dashedLine, createWater, mergeGeometries,
    surfaceMaterial: tex.surfaceMaterial, makeSurface: tex.makeSurface, fbm: tex.fbm, mulberry32: tex.mulberry32,
    windowsTexture: tex.windowsTexture, windowsColorTexture: tex.windowsColorTexture,
    num, pesos,
  };

  // Material PBR procedural: kit.mat('concrete', { repeat: [2, 1], color: 0xdddddd })
  kit.mat = (kind, opts = {}) => tex.surfaceMaterial(kind, { size: 256, ...opts });

  // Malla con sombras y transformación en una sola llamada
  kit.malla = (geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sombra = true, recibe = true, padre = null } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = sombra; m.receiveShadow = recibe;
    if (padre) padre.add(m);
    return m;
  };
  kit.caja = (w, h, d, mat, o = {}) => kit.malla(new THREE.BoxGeometry(w, h, d), mat, o);
  kit.cilindro = (r0, r1, h, mat, o = {}) => kit.malla(new THREE.CylinderGeometry(r1, r0, h, o.seg ?? 20), mat, o);

  // Tubo recto entre dos puntos (cables, barras, tirantes)
  kit.barra = (a, b, radio, mat, seg = 8) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = new THREE.Vector3().subVectors(B, A), len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, len, seg), mat);
    m.position.copy(A).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true;
    return m;
  };
  kit.moverBarra = (m, a, b) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = new THREE.Vector3().subVectors(B, A), len = Math.max(1e-4, dir.length());
    m.position.copy(A).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.scale.set(1, len / m.geometry.parameters.height, 1);
  };

  // Etiqueta que mira al usuario, con su altura en metros
  kit.etiqueta = (texto, alto = 0.25, opts = {}) => {
    const o = { size: 0.06, color: '#ffffff', bg: 'rgba(12,20,32,0.86)', weight: 700, ...opts };
    const l = createLabel(texto, o);
    l.userData.alto = alto; l.userData.opts = o; l.userData.texto = texto;
    l.scale.setScalar(alto / l.userData.size[1]);
    app.billboard(l);
    return l;
  };
  kit.cambiarEtiqueta = (l, texto) => {
    if (l.userData.texto === texto) return;
    l.userData.texto = texto;
    setLabelText(l, texto, l.userData.opts);
    l.scale.setScalar(l.userData.alto / l.userData.size[1]);
  };

  // Arrastre: llama alMover(puntoLocal) con el punto donde el rayo corta un plano fijo de 'referencia'
  kit.arrastre = (objeto, referencia, { normal = [0, 1, 0], punto = [0, 0, 0], alMover, alSoltar, cursor = 'grab', habilitado } = {}) => {
    const plano = new THREE.Plane(), n = new THREE.Vector3(), q = new THREE.Vector3(), pt = new THREE.Vector3();
    const local = (p) => {
      referencia.updateWorldMatrix(true, false);
      n.set(...normal).transformDirection(referencia.matrixWorld);
      q.set(...punto).applyMatrix4(referencia.matrixWorld);
      plano.setFromNormalAndCoplanarPoint(n, q);
      if (!p.ray.intersectPlane(plano, pt)) return null;
      return referencia.worldToLocal(pt.clone());
    };
    return app.input.add(objeto, {
      cursor,
      onDown(hit, p) { const l = local(p); if (l) alMover(l); },
      onMove(hit, p) { const l = local(p); if (l) alMover(l); },
      onUp() { alSoltar?.(); },
    }, habilitado);
  };

  // Reloj de simulación para las razones de cambio. velocidad = unidades de tiempo del problema por segundo real
  kit.reloj = ({ t0 = 0, t1 = 1, instante = null, velocidad = 1, bucle = false } = {}) => {
    const r = {
      t: t0, t0, t1, instante, velocidad, corriendo: false, cambio: 0,
      tick(dt) {
        if (!r.corriendo) return;
        r.t += dt * r.velocidad;
        if (r.t >= r.t1) { if (bucle) r.t = r.t0; else { r.t = r.t1; r.corriendo = false; } }
        r.cambio++;
      },
      fijar(t) { r.t = Math.min(r.t1, Math.max(r.t0, t)); r.corriendo = false; r.cambio++; },
      reiniciar() { r.t = r.t0; r.corriendo = true; r.cambio++; },
      alternar() { if (r.t >= r.t1) r.t = r.t0; r.corriendo = !r.corriendo; r.cambio++; },
      alInstante() { if (r.instante != null) r.fijar(r.instante); },
    };
    return r;
  };

  // Panel estándar con diseño automático.
  // def: { etiqueta, titulo, enunciado, ecuaciones: [string | () => string], lecturas: [{ etiqueta, valor: () => string, color }],
  //        deslizadores: [{ etiqueta, min, max, paso, get, set, formato: (v) => string, color }],
  //        botones: [{ etiqueta: string | () => string, accion, tipo: 'boton' | 'interruptor', get, set }],
  //        pie: () => string, pieColor: () => string, ancho, columnas, lineasPie, intervalo }
  kit.panelEstandar = (def) => {
    const ancho = def.ancho ?? 1.2;
    const W = Math.round(ancho * PPM);
    const u = W * 0.04, pad = u, innerW = W - 2 * pad;
    const m = document.createElement('canvas').getContext('2d');
    let y = pad * 0.7;
    const L = { titulo: y };
    y += u * 2.05;
    m.font = font(u * 0.6, 400);
    const nEnun = def.enunciado ? contarLineas(m, def.enunciado, innerW) : 0;
    L.enunciado = y + u * 0.5;
    y += nEnun * u * 0.76 + (nEnun ? u * 0.3 : 0);
    L.ecuaciones = [];
    for (let i = 0; i < (def.ecuaciones || []).length; i++) { y += u * 0.98; L.ecuaciones.push(y); }
    if ((def.ecuaciones || []).length) y += u * 0.4;
    const lect = def.lecturas || [];
    const cols = lect.length ? Math.min(lect.length, def.columnas ?? (lect.length === 4 ? 4 : 3)) : 0;
    const filasL = cols ? Math.ceil(lect.length / cols) : 0;
    const gap = u * 0.32, ch = u * 2.0;
    L.tarjetas = { y, cols, gap, ch, cw: cols ? (innerW - (cols - 1) * gap) / cols : 0 };
    y += filasL * (ch + gap) + (filasL ? u * 0.1 : 0);
    const widgets = [];
    L.deslizadores = [];
    for (const d of def.deslizadores || []) {
      L.deslizadores.push({ ly: y + u * 0.62, d });
      y += u * 0.82;
      widgets.push({ type: 'slider', id: 's' + widgets.length, x: pad, y, w: innerW, h: u * 0.95, min: d.min, max: d.max, step: d.paso, color: d.color, get: d.get, set: d.set });
      y += u * 1.2;
    }
    const bts = def.botones || [], porFila = def.botonesPorFila ?? 3, bgap = u * 0.32;
    const bw = (innerW - (porFila - 1) * bgap) / porFila;
    bts.forEach((b, i) => {
      const c = i % porFila, f = Math.floor(i / porFila);
      widgets.push({
        type: b.tipo === 'interruptor' ? 'toggle' : 'button', id: 'b' + i,
        x: pad + c * (bw + bgap), y: y + f * u * 1.62, w: bw, h: u * 1.32,
        label: b.etiqueta, fontScale: b.escala ?? 0.37, onClick: b.accion, get: b.get, set: b.set,
      });
    });
    y += Math.ceil(bts.length / porFila) * u * 1.62 + (bts.length ? u * 0.15 : 0);
    const lineasPie = def.lineasPie ?? 4;
    L.pie = y + u * 0.6;
    y += lineasPie * u * 0.74 + u * 0.45;
    const alto = Math.ceil(y) / PPM;

    const panel = createPanel({
      width: ancho, height: alto, ppm: PPM, widgets, minInterval: 80,
      draw(ctx) {
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        ctx.fillStyle = THEME.dim; ctx.font = font(u * 0.55, 700);
        ctx.fillText((def.etiqueta || '').toUpperCase(), pad, L.titulo + u * 0.62);
        ctx.fillStyle = THEME.text; ctx.font = font(u * 0.95, 700);
        ctx.fillText(def.titulo || '', pad, L.titulo + u * 1.62);
        if (def.enunciado) {
          ctx.fillStyle = THEME.dim; ctx.font = font(u * 0.6, 400);
          wrapText(ctx, def.enunciado, pad, L.enunciado, innerW, u * 0.76);
        }
        (def.ecuaciones || []).forEach((e, i) => {
          ctx.fillStyle = THEME.text; ctx.font = font(u * 0.8, 700);
          ctx.fillText(typeof e === 'function' ? e() : e, pad, L.ecuaciones[i]);
        });
        const T = L.tarjetas;
        lect.forEach((c, i) => {
          const col = i % T.cols, f = Math.floor(i / T.cols);
          const cx = pad + col * (T.cw + T.gap), cy = T.y + f * (T.ch + T.gap);
          ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(cx, cy, T.cw, T.ch);
          ctx.fillStyle = c.color || THEME.accent; ctx.fillRect(cx, cy, 6, T.ch);
          ctx.fillStyle = THEME.dim; ctx.font = font(u * 0.5, 600);
          ctx.fillText(c.etiqueta, cx + u * 0.4, cy + u * 0.68);
          ctx.fillStyle = THEME.text; ctx.font = font(u * (c.escala ?? 0.82), 700);
          ctx.fillText(c.valor(), cx + u * 0.4, cy + u * 1.62);
        });
        for (const s of L.deslizadores) {
          ctx.fillStyle = THEME.dim; ctx.font = font(u * 0.58, 600); ctx.textAlign = 'left';
          ctx.fillText(s.d.etiqueta, pad, s.ly);
          ctx.fillStyle = THEME.text; ctx.textAlign = 'right';
          ctx.fillText(s.d.formato ? s.d.formato(s.d.get()) : String(s.d.get()), W - pad, s.ly);
          ctx.textAlign = 'left';
        }
        if (def.pie) {
          const col = def.pieColor ? def.pieColor() : THEME.dim;
          ctx.fillStyle = col; ctx.font = font(u * 0.56, col === THEME.dim ? 400 : 700);
          wrapText(ctx, def.pie(), pad, L.pie, innerW, u * 0.74);
        }
      },
    });
    panel.alto = alto; panel.ancho = ancho;
    return panel;
  };

  // Gráfico de una función con estilo común
  kit.grafico = (opts) => createPlot({ labelSize: 0.04, width: 1.2, height: 0.72, ...opts });

  return kit;
}
