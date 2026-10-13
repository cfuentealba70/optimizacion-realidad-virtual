// Ejercicio 1.5. Recipiente sin tapa para 10 m³ de arena, con largo igual al doble del ancho.
// Base $30.000 por m² y costados $20.000 por m².  C(w) = 60.000w² + 600.000/w,  w > 0
import { ARENA as M } from '../../src/math/guia4.js';

const TB = 0.02; // espesor de la plancha de la base
const TS = 0.008; // espesor de las planchas de los costados
const HP = 0.12; // alto de los patines
const Y0 = HP + TB; // piso interior del recipiente
const W0 = 0.8, W1 = 3.0; // rango del ancho en el deslizador
const BORDE_MAX = 2.35; // con el borde más alto que esto, la arena se acopia al pie del recipiente
const DUR = 2.8, T_CARGA = 0.9, T_LANZA = 1.95; // ciclo de la palada (kit.CLIPS.palear)
// Revisión: ?rev=ancho:1.71,palada:2.1,capataz:5 fija el ancho (m), el instante de la palada (s) y el reloj de la capataz (s)
const REV = Object.fromEntries((new URLSearchParams(globalThis.location?.search || '').get('rev') || '').split(',')
  .map((p) => p.split(':')).filter((p) => p.length === 2 && Number.isFinite(Number(p[1]))).map(([k, v]) => [k, Number(v)]));

const suave = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezcla = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------ utilidades de geometría
function lienzo(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function textura(THREE, c, { srgb = true, repetir = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4;
  return t;
}
// Mapa de normales a partir de un lienzo gris (alto = claro)
function normalDeAltura(THREE, c, fuerza) {
  const n = c.width, src = c.getContext('2d').getImageData(0, 0, n, n).data;
  const [o, go] = lienzo(n), img = go.createImageData(n, n), d = img.data;
  const H = (x, y) => src[((((y + n) % n) * n) + ((x + n) % n)) * 4] / 255;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * fuerza, dy = (H(x, y + 1) - H(x, y - 1)) * fuerza, l = Math.hypot(dx, dy, 1), i = (y * n + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (0.5 / l + 0.5) * 255; d[i + 3] = 255;
  }
  go.putImageData(img, 0, 0);
  return textura(THREE, o, { srgb: false });
}
// Dibuja una figura en las nueve copias vecinas para que la textura se repita sin costuras
function envolver(n, fn) { for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) fn(dx, dy); }

// Caja con coordenadas UV a escala real (s metros por repetición) y subdivisiones
function cajaUV(THREE, w, h, d, { s = 1, seg = [1, 1, 1] } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d, seg[0], seg[1], seg[2]);
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x / s, z / s);
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, z / s, y / s);
    else uv.setXY(i, x / s, y / s);
  }
  return geo;
}
// Separa una cara de una caja (orden de BoxGeometry: +x, −x, +y, −y, +z, −z): devuelve [resto, cara]
function partirCaja(geo, cara) {
  const idx = geo.index.array, a = [], b = [];
  for (const gr of geo.groups) for (let i = gr.start; i < gr.start + gr.count; i++) (gr.materialIndex === cara ? b : a).push(idx[i]);
  const hacer = (lista) => { const n = geo.clone(); n.setIndex(lista); n.clearGroups(); const m = n.toNonIndexed(); n.dispose(); return m; };
  const r = [hacer(a), hacer(b)];
  geo.dispose();
  return r;
}
// Escala las UV de una geometría (para llevarlas a metros)
function uvEscala(geo, su, sv) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; }
// Cilindro entre dos puntos
function geoBarra(THREE, a, b, r, seg = 8, r2 = r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const geo = new THREE.CylinderGeometry(r2, r, len, seg, 1);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  geo.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return geo;
}
// Une geometrías con los mismos atributos (posición, normal, uv y color si el material lo usa)
function unir(kit, lista, conColor = false) {
  const { THREE } = kit;
  const partes = lista.map((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (g !== g0) g0.dispose();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (conColor && !g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    if (!conColor && g.attributes.color) g.deleteAttribute('color');
    g.morphAttributes = {};
    return g;
  });
  const m = kit.mergeGeometries(partes, false);
  for (const p of partes) p.dispose();
  return m;
}
// Lote de geometría estática agrupada por material: una malla (una llamada de dibujo) por material
function crearLote(kit, colores = {}) {
  const { THREE } = kit;
  const partes = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let base = new THREE.Matrix4();
  return {
    agregar(clave, geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, orden = 'XYZ', s = 1, color: c0 = null } = {}) {
      e.set(rx, ry, rz, orden); q.setFromEuler(e); p.set(x, y, z);
      if (Array.isArray(s)) sc.set(s[0], s[1], s[2]); else sc.set(s, s, s);
      m4.compose(p, q, sc).premultiply(base);
      geo.applyMatrix4(m4);
      const color = c0 ?? (geo.attributes.color ? null : colores[clave] ?? null);
      if (color) {
        const n = geo.attributes.position.count, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) a.set(color, i * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
      }
      if (!partes.has(clave)) partes.set(clave, []);
      partes.get(clave).push(geo);
      return geo;
    },
    // agrega lo que haga fn() dentro del sistema de coordenadas (x, y, z), girado ry y luego inclinado rx
    en(x, y, z, ry, fn, rx = 0) {
      const prev = base;
      base = prev.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)));
      fn(); base = prev;
    },
    mallas(mats, padre, { sombra = true } = {}) {
      const out = {};
      for (const [clave, lista] of partes) out[clave] = kit.malla(unir(kit, lista, !!mats[clave].vertexColors), mats[clave], { padre, sombra, recibe: true });
      partes.clear();
      return out;
    },
  };
}

// ------------------------------------------------------------------ texturas de lienzo
// Pintura industrial gastada: manchas de tono, vetas de suciedad, descascarados con anticorrosivo y óxido que chorrea,
// rayones con el acero a la vista. Devuelve color, relieve y un mapa con aspereza (G) y metalicidad (B).
function texturasPintura(kit, { base = '#3d6c96', semilla = 3, size = 512, desgaste = 1 } = {}) {
  const { THREE } = kit, rnd = kit.mulberry32(semilla), S = size / 512;
  const [c, g] = lienzo(size), [a, ga] = lienzo(size), [r, gr] = lienzo(size);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  ga.fillStyle = 'rgb(140,140,140)'; ga.fillRect(0, 0, size, size);
  gr.fillStyle = 'rgb(0,150,60)'; gr.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const x = rnd() * size, y = rnd() * size, rr = (30 + rnd() * 110) * S, col = rnd() < 0.5 ? '255,255,255' : '25,20,15', al = 0.035 + rnd() * 0.05;
    envolver(size, (dx, dy) => {
      const gg = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rr);
      gg.addColorStop(0, `rgba(${col},${al})`); gg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gg; g.fillRect(x + dx - rr, y + dy - rr, rr * 2, rr * 2);
    });
  }
  for (let i = 0; i < 46; i++) {
    const x = rnd() * size, y = rnd() * size, l = (60 + rnd() * 260) * S, an = (2 + rnd() * 10) * S, al = 0.05 + rnd() * 0.08;
    envolver(size, (dx, dy) => {
      const gg = g.createLinearGradient(0, y + dy, 0, y + dy + l);
      gg.addColorStop(0, `rgba(40,32,24,${al})`); gg.addColorStop(1, 'rgba(40,32,24,0)');
      g.fillStyle = gg; g.fillRect(x + dx, y + dy, an, l);
    });
  }
  const nChips = Math.round(42 * desgaste);
  for (let i = 0; i < nChips; i++) {
    const x = rnd() * size, y = rnd() * size, rr = (1.5 + rnd() * rnd() * 11) * S;
    // contorno orgánico: pocas ondas suaves y un leve serrucho
    const n = 22, f1 = rnd() * 6, f2 = rnd() * 6, el = 0.6 + rnd() * 0.8, pts = [];
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2, d = rr * (1 + 0.28 * Math.sin(2 * t + f1) + 0.16 * Math.sin(3 * t + f2) + (rnd() - 0.5) * 0.16);
      pts.push([Math.cos(t) * d * el, Math.sin(t) * d / el]);
    }
    const poli = (ctx, dx, dy, esc) => { ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(x + dx + px * esc, y + dy + py * esc) : ctx.moveTo(x + dx + px * esc, y + dy + py * esc))); ctx.closePath(); ctx.fill(); };
    const chorrea = rnd() < 0.3, largo = (15 + rnd() * 90) * S, ox = rnd() < 0.5 ? '#5c3b27' : '#4b3626', ancho = Math.max(1, rr * 0.3);
    envolver(size, (dx, dy) => {
      if (chorrea) {
        const gg = g.createLinearGradient(0, y + dy, 0, y + dy + largo);
        gg.addColorStop(0, 'rgba(110,58,30,0.32)'); gg.addColorStop(1, 'rgba(110,58,30,0)');
        g.fillStyle = gg; g.fillRect(x + dx - ancho / 2, y + dy, ancho, largo);
        gr.fillStyle = 'rgba(0,200,40,0.35)'; gr.fillRect(x + dx - ancho / 2, y + dy, ancho, largo * 0.6);
      }
      g.fillStyle = 'rgba(120,104,92,0.85)'; poli(g, dx, dy, 1.18);
      g.fillStyle = ox; poli(g, dx, dy, 0.8);
      ga.fillStyle = 'rgb(104,104,104)'; poli(ga, dx, dy, 1.15);
      gr.fillStyle = 'rgb(0,225,25)'; poli(gr, dx, dy, 1.15);
    });
  }
  for (let i = 0; i < 34 * desgaste; i++) {
    const x = rnd() * size, y = rnd() * size, l = (4 + rnd() * 22) * S, ang = (rnd() - 0.5) * 0.9 + (rnd() < 0.25 ? Math.PI / 2 : 0);
    const x2 = x + Math.cos(ang) * l, y2 = y + Math.sin(ang) * l;
    envolver(size, (dx, dy) => {
      for (const [ctx, col, an] of [[g, 'rgba(160,166,170,0.28)', 0.8], [ga, 'rgb(122,122,122)', 1.2], [gr, 'rgb(0,110,150)', 1]]) {
        ctx.strokeStyle = col; ctx.lineWidth = an * S; ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x2 + dx, y2 + dy); ctx.stroke();
      }
    });
  }
  // grano fino de la pintura y piel de naranja
  for (const [ctx, amp] of [[g, 9], [ga, 14]]) {
    const img = ctx.getImageData(0, 0, size, size), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = (rnd() - 0.5) * amp; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
    ctx.putImageData(img, 0, 0);
  }
  return { map: textura(THREE, c), normalMap: normalDeAltura(THREE, a, 3.2), rugosidad: textura(THREE, r, { srgb: false }) };
}
function materialPintura(kit, tex, { normal = 0.7, color = 0xffffff, vertexColors = false } = {}) {
  const { THREE } = kit;
  return new THREE.MeshStandardMaterial({
    color, map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(normal, normal),
    roughnessMap: tex.rugosidad, metalnessMap: tex.rugosidad, roughness: 1, metalness: 1, vertexColors,
  });
}

// Atlas de calcomanías de 512 × 512: rótulo pintado, óxido, polvo de arena, huellas, rueda, derrame y mancha
const REG = {
  rotulo: [0, 0, 512, 128], oxido: [0, 128, 128, 128], polvo: [128, 128, 128, 128], huellas: [256, 128, 128, 128], rueda: [384, 128, 128, 128],
  derrame: [0, 256, 256, 256], mancha: [256, 256, 256, 256],
};
function atlasCalcomanias(kit) {
  const { THREE } = kit, rnd = kit.mulberry32(41), N = 512;
  const [c, g] = lienzo(N);
  g.clearRect(0, 0, N, N);
  const region = ([x, y, w, h], fn) => { g.save(); g.beginPath(); g.rect(x + 3, y + 3, w - 6, h - 6); g.clip(); g.translate(x, y); fn(w, h); g.restore(); };
  const salpicar = (n, fn) => { for (let i = 0; i < n; i++) fn(); };
  region(REG.rotulo, (w, h) => {
    g.fillStyle = 'rgba(238,236,228,0.94)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 74px "Arial Black", Arial, sans-serif'; g.fillText('10 m³', w / 2, 50);
    g.font = '700 30px Arial, sans-serif'; g.fillText('S O L O   A R E N A', w / 2, 106);
    g.globalCompositeOperation = 'destination-out';
    salpicar(1100, () => { g.globalAlpha = 0.25 + rnd() * 0.75; g.beginPath(); g.arc(rnd() * w, rnd() * h, 0.6 + rnd() * rnd() * 4.5, 0, 7); g.fill(); });
    g.globalAlpha = 0.5; for (let i = 0; i < 9; i++) { const y = rnd() * h; g.fillRect(0, y, w, 1 + rnd() * 2); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  });
  region(REG.oxido, (w, h) => {
    for (let i = 0; i < 8; i++) {
      const x = 10 + rnd() * (w - 20), an = 3 + rnd() * 10, l = h * (0.3 + rnd() * 0.68), sx = (rnd() - 0.5) * 8;
      const gg = g.createLinearGradient(0, 0, 0, l);
      gg.addColorStop(0, 'rgba(100,46,18,0.8)'); gg.addColorStop(0.35, 'rgba(126,62,26,0.5)'); gg.addColorStop(1, 'rgba(126,62,26,0)');
      g.fillStyle = gg; g.beginPath(); g.moveTo(x - an / 2, 0);
      g.quadraticCurveTo(x - an / 3 + sx, l * 0.55, x + sx * 0.5, l); g.quadraticCurveTo(x + an / 3 + sx, l * 0.55, x + an / 2, 0); g.fill();
    }
    const gg = g.createLinearGradient(0, 0, 0, 24); gg.addColorStop(0, 'rgba(92,44,18,0.75)'); gg.addColorStop(1, 'rgba(92,44,18,0)');
    g.fillStyle = gg; g.fillRect(6, 0, w - 12, 24);
  });
  region(REG.polvo, (w, h) => {
    const gg = g.createLinearGradient(0, 0, 0, h * 0.55); gg.addColorStop(0, 'rgba(214,192,148,0.6)'); gg.addColorStop(1, 'rgba(214,192,148,0)');
    g.fillStyle = gg; g.fillRect(w * 0.14, 0, w * 0.72, h * 0.55);
    salpicar(1600, () => {
      const t = Math.pow(rnd(), 1.7), y = t * h, x = w / 2 + (rnd() - 0.5) * w * (0.45 + 0.5 * (1 - t));
      g.fillStyle = `rgba(${(200 + rnd() * 34) | 0},${(178 + rnd() * 26) | 0},${(130 + rnd() * 22) | 0},${(0.8 - t * 0.75).toFixed(2)})`;
      g.fillRect(x, y, 1 + rnd() * 2.5, 1 + rnd() * 2.5);
    });
  });
  region(REG.huellas, (w, h) => {
    const bota = (cx, cy, esp) => {
      g.save(); g.translate(cx, cy); if (esp) g.scale(-1, 1);
      g.fillStyle = 'rgba(84,64,40,0.26)';
      g.beginPath(); g.ellipse(0, -16, 14, 29, 0.06, 0, 7); g.fill();
      g.beginPath(); g.ellipse(1.5, 31, 11.5, 13, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(52,38,22,0.22)';
      for (let k = -40; k < 10; k += 7) g.fillRect(-11, k, 22, 3);
      for (let k = 22; k < 42; k += 6) g.fillRect(-9, k, 19, 2.5);
      g.strokeStyle = 'rgba(214,192,150,0.28)'; g.lineWidth = 2.2;
      g.beginPath(); g.ellipse(0, -16, 16.5, 31.5, 0.06, 0, 7); g.stroke();
      g.restore();
    };
    bota(42, 72, false); bota(88, 52, true);
  });
  region(REG.rueda, (w, h) => {
    g.fillStyle = 'rgba(82,62,40,0.32)'; g.fillRect(w / 2 - 13, 0, 26, h);
    g.fillStyle = 'rgba(48,36,22,0.36)';
    for (let y = -8; y < h + 8; y += 9) {
      g.beginPath(); g.moveTo(w / 2 - 12, y); g.lineTo(w / 2, y + 5); g.lineTo(w / 2 + 12, y); g.lineTo(w / 2 + 12, y + 3); g.lineTo(w / 2, y + 8); g.lineTo(w / 2 - 12, y + 3); g.fill();
    }
  });
  region(REG.derrame, (w, h) => {
    for (let i = 0; i < 80; i++) {
      const an = rnd() * 6.28, d = Math.pow(rnd(), 0.7) * 78, x = w / 2 + Math.cos(an) * d, y = h / 2 + Math.sin(an) * d, r = 12 + rnd() * 30;
      const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, 'rgba(184,156,110,0.5)'); gg.addColorStop(1, 'rgba(184,156,110,0)');
      g.fillStyle = gg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    salpicar(2600, () => {
      const an = rnd() * 6.28, d = Math.pow(rnd(), 0.55) * 122, x = w / 2 + Math.cos(an) * d, y = h / 2 + Math.sin(an) * d;
      g.fillStyle = `rgba(${(176 + rnd() * 40) | 0},${(150 + rnd() * 32) | 0},${(104 + rnd() * 26) | 0},${Math.max(0, 0.85 - d / 135).toFixed(2)})`;
      g.fillRect(x, y, 1.6, 1.6);
    });
  });
  region(REG.mancha, (w, h) => {
    for (let i = 0; i < 46; i++) {
      const an = rnd() * 6.28, d = Math.pow(rnd(), 0.8) * 72, x = w / 2 + Math.cos(an) * d, y = h / 2 + Math.sin(an) * d, r = 14 + rnd() * 42;
      const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, 'rgba(46,38,28,0.2)'); gg.addColorStop(1, 'rgba(46,38,28,0)');
      g.fillStyle = gg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  });
  const tex = textura(THREE, c, { repetir: false });
  // coordenadas UV de una región, con un margen para que no se mezclen las vecinas
  const uv = (nombre) => { const [x, y, w, h] = REG[nombre]; return [(x + 4) / N, 1 - (y + h - 4) / N, (x + w - 4) / N, 1 - (y + 4) / N]; };
  return { tex, uv };
}

// Letrero con el precio de las planchas
function texturaLetrero(kit) {
  const { THREE } = kit, rnd = kit.mulberry32(77);
  const [c, g] = lienzo(512, 320);
  g.fillStyle = '#ebe7db'; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#e2742a'; g.fillRect(0, 0, 512, 64);
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = '#1c1a17'; g.font = '800 33px Arial, sans-serif'; g.fillText('PRECIO DE LAS PLANCHAS', 22, 34);
  g.fillStyle = '#56606a'; g.font = '600 25px Arial, sans-serif';
  g.fillText('Base del recipiente', 22, 98); g.fillText('Costados', 22, 206);
  g.fillStyle = '#1f2a35'; g.font = '800 46px Arial, sans-serif';
  g.fillText(`${kit.pesos(M.cBase)} por m²`, 22, 145); g.fillText(`${kit.pesos(M.cLado)} por m²`, 22, 253);
  g.fillStyle = '#c9c3b4'; g.fillRect(22, 178, 468, 2);
  // desgaste: suciedad desde abajo, salpicaduras, rayones y óxido en los tornillos
  const gg = g.createLinearGradient(0, 210, 0, 320); gg.addColorStop(0, 'rgba(110,92,64,0)'); gg.addColorStop(1, 'rgba(110,92,64,0.35)');
  g.fillStyle = gg; g.fillRect(0, 210, 512, 110);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(90,74,52,${(rnd() * 0.25).toFixed(2)})`; g.fillRect(rnd() * 512, 200 + rnd() * 120, 1 + rnd() * 3, 1 + rnd() * 3); }
  for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; const x = rnd() * 512, y = rnd() * 320; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 12); g.stroke(); }
  for (const [x, y] of [[12, 76], [500, 76], [12, 308], [500, 308]]) {
    const gr = g.createLinearGradient(0, y, 0, y + 40); gr.addColorStop(0, 'rgba(120,60,25,0.55)'); gr.addColorStop(1, 'rgba(120,60,25,0)');
    g.fillStyle = gr; g.fillRect(x - 2, y, 4, 40);
    g.fillStyle = '#6f7378'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
  }
  const t = textura(THREE, c, { repetir: false });
  return t;
}

// Pantalla de la tableta de la capataz: el costo según el ancho
function texturaTableta(kit) {
  const { THREE } = kit;
  const [c, g] = lienzo(256, 176);
  g.fillStyle = '#0f1822'; g.fillRect(0, 0, 256, 176);
  g.fillStyle = '#ffb347'; g.font = '700 15px Arial, sans-serif'; g.fillText('Recipiente 10 m³', 12, 22);
  g.fillStyle = '#8ea3b8'; g.font = '500 11px Arial, sans-serif'; g.fillText('costo según el ancho w', 12, 40);
  g.strokeStyle = '#33465a'; g.lineWidth = 1;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(16, 60 + i * 28); g.lineTo(244, 60 + i * 28); g.stroke(); }
  g.strokeStyle = '#ffb347'; g.lineWidth = 2.5; g.beginPath();
  for (let i = 0; i <= 60; i++) { const w = W0 + (i / 60) * (W1 - W0), x = 16 + (i / 60) * 228, y = 150 - ((M.costo(w) - 500000) / 320000) * 90; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  const o = M.optimo(), xo = 16 + ((o.w - W0) / (W1 - W0)) * 228, yo = 150 - ((o.costo - 500000) / 320000) * 90;
  g.fillStyle = '#6fe3a2'; g.beginPath(); g.arc(xo, yo, 4.5, 0, 7); g.fill();
  return textura(THREE, c, { repetir: false });
}

// Grano de arena para los puntos del chorro: disco con borde suave
function texturaGrano(kit) {
  const [c, g] = lienzo(32);
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 15);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(235,235,235,1)'); gr.addColorStop(1, 'rgba(200,200,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return textura(kit.THREE, c, { repetir: false });
}

// Rejilla de alambre del harnero
function texturaMalla(kit) {
  const { THREE } = kit;
  const [c, g] = lienzo(64);
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(150,150,145,1)'; g.lineWidth = 2;
  for (let i = 0; i < 64; i += 8) { g.beginPath(); g.moveTo(i + 1, 0); g.lineTo(i + 1, 64); g.stroke(); g.beginPath(); g.moveTo(0, i + 1); g.lineTo(64, i + 1); g.stroke(); }
  return textura(THREE, c, { srgb: true });
}

// Cordón de soldadura: escamas con tinte de calor
function texturasSoldadura(kit) {
  const { THREE } = kit;
  const [c, g] = lienzo(64), [a, ga] = lienzo(64);
  const gc = g.createLinearGradient(0, 0, 64, 0);
  gc.addColorStop(0, '#3e3731'); gc.addColorStop(0.3, '#5a554e'); gc.addColorStop(0.5, '#66625b'); gc.addColorStop(0.7, '#5a554e'); gc.addColorStop(1, '#4a3f30');
  g.fillStyle = gc; g.fillRect(0, 0, 64, 64);
  ga.fillStyle = '#000'; ga.fillRect(0, 0, 64, 64);
  for (let k = 0; k < 4; k++) {
    const y = k * 16;
    for (const [ctx, col] of [[g, 'rgba(60,52,44,0.5)'], [ga, '#fff']]) {
      const gr = ctx.createRadialGradient(32, y + 16, 2, 32, y + 16, 34);
      gr.addColorStop(0, col === '#fff' ? '#bbb' : 'rgba(0,0,0,0)'); gr.addColorStop(0.8, col); gr.addColorStop(1, col === '#fff' ? '#333' : 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(32, y + 16, 34, 14, 0, Math.PI, 0); ctx.fill();
    }
  }
  return { map: textura(THREE, c), normalMap: normalDeAltura(THREE, a, 2.5) };
}

// ------------------------------------------------------------------ objetos
// Montón de arena: rejilla polar con lomas, pie irregular y el corte de la pala hacia el ángulo 'corte'.
// La arena recién cortada se ve más oscura (húmeda).
function geoMonton(THREE, rnd, { r = 1.0, h = 0.66, corte = 0, tCorte = 0.72, nr = 22, ns = 72 } = {}) {
  const pos = [], col = [], uv = [], idx = [];
  const f = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
  const radio = (a) => r * (1 + 0.07 * Math.sin(3 * a + f[0]) + 0.045 * Math.sin(5 * a + f[1]) + 0.025 * Math.sin(9 * a + f[2]));
  for (let i = 0; i <= nr; i++) {
    const t = i / nr;
    for (let j = 0; j < ns; j++) {
      const a = (j / ns) * Math.PI * 2, R = radio(a) * t;
      let y = h * Math.pow(Math.cos((t * Math.PI) / 2), 1.3) * (1 + 0.07 * Math.sin(2 * a + f[3]));
      y += (0.028 * Math.sin(a * 4 + t * 7 + f[0]) + 0.014 * Math.sin(a * 11 + t * 19 + f[4])) * Math.sin(t * Math.PI);
      const da = Math.atan2(Math.sin(a - corte), Math.cos(a - corte));
      const k = Math.exp(-(da * da) / 0.1) * Math.exp(-((t - tCorte) ** 2) / 0.035);
      y -= 0.14 * k;
      y -= 0.012 * k * (0.5 + 0.5 * Math.sin(da * 26)); // marcas de la pala en el corte
      if (i === nr) y = -0.012;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      pos.push(x, Math.max(-0.012, y), z); uv.push(x / 0.8, z / 0.8);
      const hum = Math.min(1, k * 1.25 + 0.3 * suave(0.78, 1, t)), v = 1 - 0.3 * hum + (rnd() - 0.5) * 0.06;
      col.push(v, v * 0.975 - 0.02 * hum, v * 0.93 - 0.05 * hum);
    }
  }
  for (let i = 0; i < nr; i++) for (let j = 0; j < ns; j++) {
    const a = i * ns + j, b = i * ns + ((j + 1) % ns), c = (i + 1) * ns + j, d = (i + 1) * ns + ((j + 1) % ns);
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// Colmo de arena (casquete con grumos), con su eje hacia +y
function geoColmo(THREE, rnd, rx, alto, rz, { seg = 18 } = {}) {
  const geo = new THREE.SphereGeometry(1, seg, Math.max(5, Math.round(seg / 3)), 0, Math.PI * 2, 0, Math.PI / 2);
  const p = geo.attributes.position, f = rnd() * 6;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.08 * Math.sin(a * 3 + f) * y + 0.05 * Math.sin(a * 7 + y * 5);
    p.setXYZ(i, x * rx * k, y * alto * (0.94 + 0.1 * Math.sin(a * 5 + f) * (1 - y)), z * rz * k);
  }
  geo.computeVertexNormals();
  uvEscala(geo, rx * 6, alto * 4);
  return geo;
}

// Pala punta huevo: el mango va por +y; la hoja queda bajo y = 0, con la cara cóncava hacia +z
// y la punta levantada hacia ese lado. Devuelve geometrías por material y el centro de la hoja.
function geosPala(THREE) {
  const madera = [], acero = [];
  const LIFT = 0.3, LH = 0.3, AH = 0.122, DISH = 0.03;
  const n = new THREE.Vector3(0, Math.sin(LIFT), Math.cos(LIFT)), d = new THREE.Vector3(0, -Math.cos(LIFT), Math.sin(LIFT));
  // mango de madera con el extremo redondeado
  madera.push(uvEscala(new THREE.CylinderGeometry(0.0165, 0.019, 1.08, 12, 1).translate(0, 0.68, 0), 0.08, 0.7));
  madera.push(uvEscala(new THREE.SphereGeometry(0.0168, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.22, 0), 0.08, 0.05));
  // hoja: rejilla curvada con el borde gastado (acero a la vista en la punta y los cantos)
  const nu = 12, nv = 14, pos = [], col = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const tv = j / nv, mitad = AH * (tv < 0.5 ? 1 - 0.06 * tv : Math.sqrt(Math.max(0, 1 - ((tv - 0.5) / 0.5) ** 2.2)) * 0.97);
    for (let i = 0; i <= nu; i++) {
      const tu = -1 + (2 * i) / nu, x = tu * Math.max(mitad, 0.004), cz = DISH * tu * tu - DISH * 0.35;
      const P = d.clone().multiplyScalar(tv * LH).addScaledVector(n, cz);
      pos.push(x, P.y, P.z); uv.push(tu * 0.5 + 0.5, tv);
      const gasto = Math.max(suave(0.62, 0.96, tv), 0.6 * suave(0.82, 1, Math.abs(tu)));
      col.push(mezcla(0.13, 0.66, gasto), mezcla(0.13, 0.66, gasto), mezcla(0.14, 0.68, gasto));
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, e = c + 1; idx.push(a, c, b, b, c, e); }
  const hoja = new THREE.BufferGeometry();
  hoja.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hoja.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  hoja.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  hoja.setIndex(idx); hoja.computeVertexNormals();
  acero.push(hoja);
  const pintado = (geo) => { const k = geo.attributes.position.count; geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(k * 3).fill(0.13), 3)); return geo; };
  // pisaderas: borde superior doblado
  const pis = new THREE.CylinderGeometry(0.0065, 0.0065, AH * 2, 8, 1); pis.rotateZ(Math.PI / 2); pis.translate(0, n.y * DISH * 0.65, n.z * DISH * 0.65);
  acero.push(pintado(pis));
  // cuello cónico y lengüeta remachada por detrás de la hoja
  acero.push(pintado(new THREE.CylinderGeometry(0.02, 0.026, 0.2, 12, 1).translate(0, 0.1, -0.008)));
  const leng = new THREE.BoxGeometry(0.05, 0.12, 0.007); leng.translate(0, -0.05, 0); leng.rotateX(-LIFT); leng.translate(0, 0, -n.z * DISH * 0.55 - 0.004);
  acero.push(pintado(leng));
  for (const y of [0.05, 0.13]) acero.push(pintado(new THREE.SphereGeometry(0.006, 8, 5).translate(0, y, 0.016)));
  const centro = d.clone().multiplyScalar(LH * 0.45).addScaledVector(n, -DISH * 0.2);
  return { madera, acero, centro, n, LIFT };
}

// Carretilla con su carga, con la rueda hacia +z. Agrega al lote con las claves verde, acero, goma y arena.
function carretilla(THREE, lote, rnd) {
  // bandeja: tronco de pirámide con esquinas redondeadas, más inclinada hacia la rueda
  const anillo = (w, l, r, y, dz) => {
    const pts = [];
    for (const [cx, cz, a0] of [[w / 2 - r, l / 2 - r, 0], [-(w / 2 - r), l / 2 - r, Math.PI / 2], [-(w / 2 - r), -(l / 2 - r), Math.PI], [w / 2 - r, -(l / 2 - r), 1.5 * Math.PI]]) {
      for (let k = 0; k <= 5; k++) { const a = a0 + (k / 5) * (Math.PI / 2); pts.push(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r + dz)); }
    }
    return pts;
  };
  const A = [anillo(0.4, 0.46, 0.07, 0.37, -0.06), anillo(0.47, 0.6, 0.09, 0.42, -0.02), anillo(0.64, 0.92, 0.11, 0.64, 0.08)];
  const n = A[0].length, pos = [], uv = [], idx = [];
  pos.push(0, 0.37, -0.06); uv.push(0, 0);
  for (const v of A[0]) { pos.push(v.x, v.y, v.z); uv.push(v.x, v.z); }
  for (let k = 0; k < n; k++) idx.push(0, 1 + ((k + 1) % n), 1 + k);
  for (let f = 0; f < 2; f++) {
    const o = pos.length / 3;
    A[f].forEach((v, k) => { pos.push(v.x, v.y, v.z); uv.push((k / n) * 2.4, v.y); });
    const o2 = pos.length / 3;
    A[f + 1].forEach((v, k) => { pos.push(v.x, v.y, v.z); uv.push((k / n) * 2.4, v.y); });
    for (let k = 0; k < n; k++) { const a = o + k, b = o + ((k + 1) % n), c = o2 + k, d = o2 + ((k + 1) % n); idx.push(a, b, c, b, d, c); }
  }
  const bandeja = new THREE.BufferGeometry();
  bandeja.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bandeja.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  bandeja.setIndex(idx); bandeja.computeVertexNormals();
  lote.agregar('verde', bandeja);
  lote.agregar('verde', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(A[2], true), 64, 0.012, 6, true));
  // arena en la bandeja
  lote.agregar('arena', geoColmo(THREE, rnd, 0.27, 0.13, 0.38), { y: 0.58, z: 0.06 });
  // rueda: neumático con dibujo, llanta y eje
  const neu = new THREE.TorusGeometry(0.165, 0.055, 10, 44), p = neu.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(y, x), rr = Math.hypot(x, y);
    if (rr > 0.19) { const s = 1 + 0.04 * (Math.sin(a * 22 + Math.sign(z) * 0.8) > 0 ? 1 : 0); p.setXYZ(i, x * s, y * s, z); }
  }
  neu.computeVertexNormals();
  lote.agregar('goma', neu, { y: 0.22, z: 0.66, ry: Math.PI / 2 });
  lote.agregar('acero', new THREE.CylinderGeometry(0.115, 0.115, 0.07, 18, 1), { y: 0.22, z: 0.66, rz: Math.PI / 2 });
  lote.agregar('acero', new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8, 1), { y: 0.22, z: 0.66, rz: Math.PI / 2 });
  for (const sx of [-1, 1]) {
    const B = (a, b, r = 0.0145) => lote.agregar('acero', geoBarra(THREE, a, b, r, 8));
    B([sx * 0.045, 0.22, 0.66], [sx * 0.2, 0.34, 0.3]);
    B([sx * 0.2, 0.34, 0.3], [sx * 0.25, 0.36, -0.3]);
    B([sx * 0.25, 0.36, -0.3], [sx * 0.29, 0.56, -1.0]);
    B([sx * 0.23, 0.355, -0.18], [sx * 0.25, 0.0, -0.3], 0.013);
    B([sx * 0.25, 0.1, -0.3], [sx * 0.22, 0.35, -0.02], 0.009);
    lote.agregar('acero', new THREE.BoxGeometry(0.05, 0.012, 0.1), { x: sx * 0.25, y: 0.006, z: -0.31 });
    lote.agregar('goma', new THREE.CylinderGeometry(0.021, 0.021, 0.14, 10, 1), { x: sx * 0.287, y: 0.545, z: -0.95, rx: Math.PI / 2 - 0.28 });
  }
  lote.agregar('acero', geoBarra(THREE, [-0.25, 0.36, -0.28], [0.25, 0.36, -0.28], 0.012));
  lote.agregar('acero', geoBarra(THREE, [-0.2, 0.34, 0.26], [0.2, 0.34, 0.26], 0.012));
}

// Capacho de goma con arena (balde de obra)
function capacho(THREE, lote, rnd) {
  const perfil = [[0.0, 0.0], [0.135, 0.0], [0.142, 0.01], [0.158, 0.26], [0.168, 0.27], [0.166, 0.285], [0.15, 0.282], [0.137, 0.03], [0.0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y));
  lote.agregar('goma', new THREE.LatheGeometry(perfil, 22));
  for (const s of [-1, 1]) lote.agregar('goma', new THREE.TorusGeometry(0.035, 0.009, 6, 10, Math.PI), { x: s * 0.162, y: 0.235, ry: Math.PI / 2 });
  lote.agregar('arena', geoColmo(THREE, rnd, 0.145, 0.05, 0.145, { seg: 14 }), { y: 0.22 });
}

// Harnero de madera con malla de alambre (0,62 × 0,92 m), apoyado sobre su borde inferior
function harnero(THREE, lote) {
  const W = 0.62, H = 0.92, e = 0.045, t = 0.06;
  for (const [x, y, w, h] of [[0, H - e / 2, W, e], [0, e / 2, W, e], [-W / 2 + e / 2, H / 2, e, H - 2 * e], [W / 2 - e / 2, H / 2, e, H - 2 * e]]) {
    lote.agregar('madera', new THREE.BoxGeometry(w, h, t), { x, y });
  }
  lote.agregar('malla', uvEscala(new THREE.PlaneGeometry(W - 2 * e + 0.01, H - 2 * e + 0.01), (W - 2 * e) / 0.06, (H - 2 * e) / 0.06), { y: H / 2, z: 0.006 });
}

export default {
  id: 'arena',
  tipo: 'optimizacion',
  etiqueta: 'Ejercicio 1.5 · Optimización',
  titulo: 'Recipiente para arena',
  resumen: 'Un recipiente con base rectangular destinado a almacenar arena debe contener 10 metros cúbicos del material. El largo de su base es el doble de su ancho. El material para la base cuesta 30.000 pesos el metro cuadrado y el material para los costados 20.000 pesos el metro cuadrado. Encuentre las dimensiones del recipiente sin tapa más económico que se puede construir.',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const acotar = (v) => Math.min(W1, Math.max(W0, Math.round(v * 100) / 100));
    const s = { w: REV.ancho !== undefined ? acotar(REV.ancho) : 2.2, arena: true, revelar: false, cambio: true };
    const rnd = kit.mulberry32(17);
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

    // ---------------------------------------------------------------- materiales
    const pintura = materialPintura(kit, texturasPintura(kit, { base: '#3b6992', semilla: 5 }), { vertexColors: true });
    const verde = materialPintura(kit, texturasPintura(kit, { base: '#3f7537', semilla: 12, size: 256, desgaste: 1.4 }), { normal: 0.5 });
    verde.side = THREE.DoubleSide;
    const raspado = kit.mat('metal', { color: 0x8a7d6d, metalness: 0.45, roughness: 0.8, normalScale: 0.3, seed: 4 });
    raspado.polygonOffset = true; raspado.polygonOffsetFactor = -1;
    const oscuro = kit.mat('metal', { color: 0x3b3e42, metalness: 0.45, roughness: 0.78, normalScale: 0.5, seed: 11 });
    const ts = texturasSoldadura(kit);
    const soldadura = new THREE.MeshStandardMaterial({ map: ts.map, normalMap: ts.normalMap, metalness: 0.3, roughness: 0.7 });
    const arenaMat = kit.mat('sand', { color: 0xf1e3c8, normalScale: 0.9 });
    arenaMat.vertexColors = true;
    const acero = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide });
    const goma = new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 0.9 });
    const madera = kit.mat('wood', { color: 0xc9a47c, roughness: 0.85, seed: 6 });
    const malla = new THREE.MeshStandardMaterial({ map: texturaMalla(kit), alphaTest: 0.45, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.6 });
    const plancha = kit.mat('metal', { color: 0x6a6f74, metalness: 0.5, roughness: 0.62, normalScale: 0.6, seed: 7 });
    const atlas = atlasCalcomanias(kit);
    const calco = new THREE.MeshStandardMaterial({ map: atlas.tex, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const MATS = { arena: arenaMat, verde, acero, goma, madera, malla, plancha };
    const COLORES = { acero: [0.16, 0.17, 0.18] };

    // ---------------------------------------------------------------- terreno: grava, piedras y pasto
    const pad = kit.malla(new THREE.CircleGeometry(8.2, 56), kit.mat('gravel', { repeat: [24, 24], color: 0xc2b8a4, normalScale: 0.4 }), { rx: -Math.PI / 2, y: 0.025, z: 0.8, sombra: false, padre: g });
    pad.material.polygonOffset = true; pad.material.polygonOffsetFactor = -3;
    {
      const pg = new THREE.IcosahedronGeometry(1, 1), pp = pg.attributes.position;
      for (let i = 0; i < pp.count; i++) { const k = 0.82 + 0.3 * Math.abs(Math.sin(pp.getX(i) * 5.1 + pp.getY(i) * 3.3 + pp.getZ(i) * 4.7)); pp.setXYZ(i, pp.getX(i) * k, pp.getY(i) * k, pp.getZ(i) * k); }
      pg.computeVertexNormals();
      const n = 90, piedras = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = 4.6 + rnd() * 3.4, sc = 0.03 + rnd() * rnd() * 0.12;
        e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
        m4.compose(V(Math.cos(a) * r, sc * 0.3, 0.8 + Math.sin(a) * r), q, V(sc * (1 + rnd() * 0.5), sc * 0.7, sc)); piedras.setMatrixAt(i, m4);
        const t = 0.45 + rnd() * 0.25; piedras.setColorAt(i, c.setRGB(t * 1.05, t, t * 0.9));
      }
      piedras.castShadow = true; piedras.receiveShadow = true; g.add(piedras);
      const hojas = [];
      for (let i = 0; i < 8; i++) {
        const h = 0.18 + rnd() * 0.2, cg = new THREE.ConeGeometry(0.011, h, 3, 1, true);
        cg.translate(0, h / 2, 0); cg.rotateZ(0.2 + rnd() * 0.4); cg.rotateY((i / 8) * Math.PI * 2 + rnd() * 0.5);
        hojas.push(cg);
      }
      const nm = 120, matas = new THREE.InstancedMesh(kit.mergeGeometries(hojas), new THREE.MeshStandardMaterial({ color: 0x74883e, roughness: 0.95, side: THREE.DoubleSide }), nm);
      for (let i = 0; i < nm; i++) {
        const grupo = Math.floor(i / 4), a = (grupo * 2.399) % (Math.PI * 2), r = 8.0 + ((grupo * 0.37) % 1) * 0.9;
        const x = Math.cos(a) * r + (rnd() - 0.5) * 0.4, z = 0.8 + Math.sin(a) * r + (rnd() - 0.5) * 0.4, sc = 0.6 + rnd() * 0.9;
        e.set((rnd() - 0.5) * 0.25, rnd() * 6, (rnd() - 0.5) * 0.25); q.setFromEuler(e);
        m4.compose(V(x, 0, z), q, V(sc, sc, sc)); matas.setMatrixAt(i, m4);
      }
      matas.castShadow = true; g.add(matas);
    }

    // ---------------------------------------------------------------- recipiente (geometría que se rehace al cambiar w)
    const mPint = kit.malla(new THREE.BufferGeometry(), pintura, { padre: g });
    const mInt = kit.malla(new THREE.BufferGeometry(), raspado, { padre: g });
    const mOsc = kit.malla(new THREE.BufferGeometry(), oscuro, { padre: g });
    const mSold = kit.malla(new THREE.BufferGeometry(), soldadura, { padre: g, sombra: false });
    const mCalco = kit.malla(new THREE.BufferGeometry(), calco, { padre: g, sombra: false });
    const mArena = kit.malla(new THREE.BufferGeometry(), arenaMat, { padre: g });
    mCalco.renderOrder = 2;
    // perfiles: canal U de refuerzo (abre hacia la plancha), ángulo de las esquinas y oreja de izaje
    const perfilU = new THREE.Shape([[-0.0275, 0], [-0.0275, 0.045], [0.0275, 0.045], [0.0275, 0], [0.0225, 0], [0.0225, 0.04], [-0.0225, 0.04], [-0.0225, 0]].map(([x, y]) => new THREE.Vector2(x, y)));
    const perfilL = new THREE.Shape([[-0.08, 0], [0, 0], [0, -0.08], [0.008, -0.08], [0.008, 0.008], [-0.08, 0.008]].map(([x, y]) => new THREE.Vector2(x, -y)));
    const perfilOreja = (() => {
      const sh = new THREE.Shape();
      sh.moveTo(0, -0.12); sh.lineTo(0.15, -0.12); sh.lineTo(0.15, 0.03); sh.absarc(0.09, 0.03, 0.06, 0, Math.PI, false); sh.lineTo(0, -0.03); sh.lineTo(0, -0.12);
      const hueco = new THREE.Path(); hueco.absarc(0.09, 0.03, 0.026, 0, Math.PI * 2, true); sh.holes.push(hueco);
      return sh;
    })();
    const perfilPatin = (Ls) => new THREE.Shape([[-Ls / 2, HP], [-Ls / 2 + 0.11, 0], [Ls / 2 - 0.11, 0], [Ls / 2, HP]].map(([x, y]) => new THREE.Vector2(x, y)));
    const perfilBolsillo = (() => {
      const sh = new THREE.Shape([[-0.11, 0], [0.11, 0], [0.11, 0.09], [-0.11, 0.09]].map(([x, y]) => new THREE.Vector2(x, y)));
      sh.holes.push(new THREE.Path([[-0.098, 0.008], [-0.098, 0.082], [0.098, 0.082], [0.098, 0.008]].map(([x, y]) => new THREE.Vector2(x, y))));
      return sh;
    })();
    const extruir = (forma, largo, pasos = 1) => uvEscala(new THREE.ExtrudeGeometry(forma, { depth: largo, steps: pasos, bevelEnabled: false, curveSegments: 10 }), 0.5, 0.5);
    const base3 = (ex, ey, ez, x, y, z) => new THREE.Matrix4().makeBasis(V(...ex), V(...ey), V(...ez)).setPosition(x, y, z);

    // ---------------------------------------------------------------- persona que palea, su pala y la zona de trabajo
    const zona = new THREE.Group(); g.add(zona);
    const obrero = kit.persona({
      preset: 'obrero', semilla: 23, padre: zona, guantes: '#c49a5a', manga: 'larga', colorSuperior: '#6f86a0', colorInferior: '#59606b',
      chaleco: 'naranjo', casco: '#f1c31c', barba: 'bigote', pelo: 'corto', lentes: true,
    });
    const pala = new THREE.Group(); zona.add(pala);
    const gp = geosPala(THREE);
    kit.malla(unir(kit, gp.madera), madera, { padre: pala });
    kit.malla(unir(kit, gp.acero, true), acero, { padre: pala });
    const centroHoja = new THREE.Object3D(); centroHoja.position.copy(gp.centro); pala.add(centroHoja);
    const geoCarga = geoColmo(THREE, rnd, 0.08, 0.055, 0.095, { seg: 12 });
    geoCarga.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geoCarga.attributes.position.count * 3).fill(0.86), 3));
    const cargaPala = kit.malla(geoCarga, arenaMat, { padre: pala, sombra: false });
    cargaPala.quaternion.setFromUnitVectors(V(0, 1, 0), gp.n); cargaPala.position.copy(gp.centro).addScaledVector(gp.n, 0.004);
    obrero.sostener(pala, { D: [0, 0.5, 0], I: [0, 1.12, 0], arriba: [0, 0, 1] });
    const CLIP = kit.CLIPS.palear;
    // dónde queda la hoja al cargar y al lanzar, en coordenadas de la zona (la persona en el origen)
    zona.updateMatrixWorld(true);
    const medir = (t) => { obrero.fijarClip(CLIP, t); return zona.worldToLocal(centroHoja.getWorldPosition(V())); };
    const lanzaL = medir(T_LANZA), cargaL = medir(T_CARGA);
    const yawO = -Math.PI / 2 - Math.atan2(lanzaL.x, lanzaL.z); // la palada sale hacia −x, hacia el recipiente
    const rotY = (v) => V(v.x * Math.cos(yawO) + v.z * Math.sin(yawO), v.y, -v.x * Math.sin(yawO) + v.z * Math.cos(yawO));
    const lanzaZ = rotY(lanzaL), cargaZ = rotY(cargaL);
    obrero.grupo.rotation.y = yawO;
    const GAP = 1.15; // del punto donde se suelta la arena a la cara del recipiente
    // montón: el corte de la pala queda donde entra la hoja
    const RM = 0.95, uC = V(cargaZ.x, 0, cargaZ.z).normalize();
    const C = V(cargaZ.x, 0, cargaZ.z).addScaledVector(uC, 0.72 * RM);
    const perp = V(-uC.z, 0, uC.x);
    const lz = crearLote(kit, COLORES);
    lz.agregar('arena', geoMonton(THREE, rnd, { r: RM, h: 0.66, corte: Math.atan2(-uC.z, -uC.x) }), { x: C.x, z: C.z });
    // pala de repuesto clavada en el montón
    {
      const ge = geosPala(THREE), pos = C.clone().addScaledVector(uC, 0.28).addScaledVector(perp, -0.18);
      lz.en(pos.x, 0.32, pos.z, Math.atan2(uC.x, uC.z) + 0.6, () => {
        for (const m of ge.madera) lz.agregar('madera', m, { rx: 0.42 });
        for (const m of ge.acero) lz.agregar('acero', m, { rx: 0.42 });
      });
    }
    // acopio al pie del recipiente, bajo la trayectoria de la palada
    lz.agregar('arena', geoColmo(THREE, rnd, 0.42, 0.13, 0.5), { x: lanzaZ.x - GAP + 0.2, z: lanzaZ.z, s: [1, 1, 1] });
    // carretilla cargada detrás de la persona, con la rueda hacia el recipiente
    const posCarr = V(lanzaZ.x * 0.3 + 0.1, 0, -1.35);
    lz.en(posCarr.x, 0, posCarr.z, -Math.PI / 2 + 0.22, () => carretilla(THREE, lz, rnd));
    // capacho con arena detrás de la persona y harnero apuntalado frente al montón, con la arena cernida detrás
    lz.en(0.78, 0, -0.5, 0.3, () => capacho(THREE, lz, rnd));
    {
      const ph = C.clone().addScaledVector(perp, -(RM + 0.45)).addScaledVector(uC, 0.1), giro = Math.atan2(perp.x, perp.z);
      lz.en(ph.x, 0, ph.z, giro, () => {
        lz.en(0, 0, 0, 0, () => harnero(THREE, lz), -0.42);
        lz.agregar('madera', geoBarra(THREE, [0.17, 0, -0.86], [0.17, 0.8, -0.4], 0.017, 6));
        lz.agregar('arena', geoColmo(THREE, rnd, 0.28, 0.1, 0.2), { x: -0.08, z: -0.36 });
      });
    }
    lz.mallas(MATS, zona);

    // ---------------------------------------------------------------- capataz con la tableta
    const capataz = kit.persona({ preset: 'ingeniera', semilla: 9, padre: g, colorSuperior: '#2e5a4c', piel: kit.PIELES[3] });
    capataz.posar('tableta').transicion(0.01);
    const tableta = new THREE.Group(); g.add(tableta);
    kit.caja(0.25, 0.175, 0.012, new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.55 }), { padre: tableta, sombra: false });
    const pantallaTex = texturaTableta(kit);
    kit.malla(new THREE.PlaneGeometry(0.226, 0.155), new THREE.MeshStandardMaterial({ map: pantallaTex, emissive: 0xffffff, emissiveMap: pantallaTex, emissiveIntensity: 0.55, roughness: 0.25 }), { z: 0.0065, padre: tableta, sombra: false });
    capataz.sostener(tableta, { D: [0.118, -0.035, 0], I: [-0.118, -0.035, 0], arriba: [0, 0.7, 0.7] });
    const focoRecipiente = new THREE.Object3D(); g.add(focoRecipiente);

    // ---------------------------------------------------------------- bodega de planchas con el letrero de precios
    const bodega = new THREE.Group(); g.add(bodega);
    {
      const lb = crearLote(kit, COLORES);
      for (const [z0, n, e] of [[-0.85, 3, 0.02], [0.75, 6, 0.008]]) {
        for (const x of [-0.38, 0.38]) lb.agregar('madera', cajaUV(THREE, 0.1, 0.09, 1.6, { s: 1.3 }), { x, y: 0.045, z: z0 });
        let y = 0.09;
        for (let k = 0; k < n; k++) {
          lb.agregar('plancha', cajaUV(THREE, 1.0, e, 1.5, { s: 1.2 }), { x: (rnd() - 0.5) * 0.05, y: y + e / 2, z: z0 + (rnd() - 0.5) * 0.05, ry: (rnd() - 0.5) * 0.04 });
          y += e + 0.0015;
        }
      }
      // letrero sobre dos postes
      lb.en(0.15, 0, 1.95, 0.35, () => {
        for (const x of [-0.4, 0.4]) lb.agregar('madera', cajaUV(THREE, 0.07, 1.42, 0.07, { s: 1.3 }), { x, y: 0.71 });
        lb.agregar('madera', cajaUV(THREE, 0.92, 0.6, 0.025, { s: 1.3 }), { y: 1.12, z: 0.047 });
      });
      lb.mallas(MATS, bodega);
      const letrero = kit.malla(new THREE.PlaneGeometry(0.88, 0.55), new THREE.MeshStandardMaterial({ map: texturaLetrero(kit), roughness: 0.75 }), { padre: bodega, sombra: false });
      letrero.position.set(0.15 + Math.sin(0.35) * 0.061, 1.12, 1.95 + Math.cos(0.35) * 0.061); letrero.rotation.y = 0.35;
    }

    // ---------------------------------------------------------------- chorro de arena
    const NT = 60, NG = 240, NP = NT + NG, GR = 9.8;
    const geoTerron = new THREE.IcosahedronGeometry(1, 1), pt = geoTerron.attributes.position;
    for (let i = 0; i < pt.count; i++) { const k = 0.8 + 0.35 * Math.abs(Math.sin(pt.getX(i) * 4.1 + pt.getY(i) * 2.7 + pt.getZ(i) * 3.3)); pt.setXYZ(i, pt.getX(i) * k, pt.getY(i) * k, pt.getZ(i) * k); }
    geoTerron.computeVertexNormals();
    const terrones = new THREE.InstancedMesh(geoTerron, new THREE.MeshStandardMaterial({ color: 0xbfa274, emissive: 0x2c2216, roughness: 1 }), NT);
    terrones.frustumCulled = false; terrones.castShadow = false; g.add(terrones);
    const granosGeo = new THREE.BufferGeometry(); granosGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NG * 3), 3));
    const granos = new THREE.Points(granosGeo, new THREE.PointsMaterial({ color: 0xcdb084, size: 0.017, sizeAttenuation: true, map: texturaGrano(kit), alphaTest: 0.5 }));
    granos.frustumCulled = false; g.add(granos);
    const P0 = new Float32Array(NP * 3), VEL = new Float32Array(NP * 3), RET = new Float32Array(NP), YF = new Float32Array(NP), ESC = new Float32Array(NP);
    const QT = [];
    for (let i = 0; i < NT; i++) { QT.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6))); }
    const chorro = { t: 99, dur: 0, objetivo: V(), apice: 0, alto: false };
    const m4 = new THREE.Matrix4(), pTmp = V(), sTmp = V(), cero = new THREE.Matrix4().makeScale(0, 0, 0);
    const rndC = kit.mulberry32(5);
    function lanzarArena(p0) {
      const o = chorro.objetivo;
      let dur = 0;
      for (let i = 0; i < NP; i++) {
        const terron = i < NT, ret = Math.pow(rndC(), 1.3) * 0.15;
        const sx = p0.x + (rndC() - 0.5) * 0.07, sy = p0.y + (rndC() - 0.5) * 0.04, sz = p0.z + (rndC() - 0.5) * 0.07;
        const tx = o.x + (rndC() - 0.5) * 0.3 + ret * 0.9, tz = o.z + (rndC() - 0.5) * 0.26, ty = o.y + (rndC() - 0.5) * 0.04;
        const ap = Math.max(chorro.apice + (rndC() - 0.5) * 0.14 - ret * 0.6, sy + 0.04, ty + 0.04);
        const vy = Math.sqrt(2 * GR * (ap - sy)), T = vy / GR + Math.sqrt((2 * (ap - ty)) / GR);
        P0.set([sx, sy, sz], i * 3); VEL.set([(tx - sx) / T, vy, (tz - sz) / T], i * 3);
        RET[i] = ret; YF[i] = ty; ESC[i] = terron ? 0.008 + Math.pow(rndC(), 2) * 0.02 : 0;
        dur = Math.max(dur, ret + T);
      }
      chorro.t = 0; chorro.dur = dur + 0.05;
    }
    function moverArena() {
      const pos = granosGeo.attributes.position;
      for (let i = 0; i < NP; i++) {
        const tau = chorro.t - RET[i];
        let vivo = tau >= 0 && chorro.t <= chorro.dur;
        let x = 0, y = -50, z = 0;
        if (vivo) {
          x = P0[i * 3] + VEL[i * 3] * tau; y = P0[i * 3 + 1] + VEL[i * 3 + 1] * tau - 0.5 * GR * tau * tau; z = P0[i * 3 + 2] + VEL[i * 3 + 2] * tau;
          if (y < YF[i] && VEL[i * 3 + 1] - GR * tau < 0) { vivo = false; y = -50; }
        }
        if (i < NT) {
          if (vivo) { pTmp.set(x, y, z); const e = ESC[i]; sTmp.set(e * 1.2, e * 0.8, e); terrones.setMatrixAt(i, m4.compose(pTmp, QT[i], sTmp)); }
          else terrones.setMatrixAt(i, cero);
        } else pos.setXYZ(i - NT, x, y, z);
      }
      terrones.instanceMatrix.needsUpdate = true; pos.needsUpdate = true;
    }
    let pendienteLanzar = false;
    obrero.reproducir(CLIP, { bucle: true, eventos: { lanza: () => { pendienteLanzar = true; } } });
    const foco = new THREE.Object3D(); g.add(foco);
    obrero.mirar(foco);
    const focoCarga = V(), focoLanza = V();

    // ---------------------------------------------------------------- cotas y rótulos
    const cotaMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    function cota(radio = 0.017) {
      const c = { l: kit.barra([0, 0, 0], [0, 1, 0], radio, cotaMat), a: kit.barra([0, 0, 0], [0, 1, 0], radio, cotaMat), b: kit.barra([0, 0, 0], [0, 1, 0], radio, cotaMat) };
      for (const k of ['l', 'a', 'b']) { c[k].castShadow = false; g.add(c[k]); }
      return c;
    }
    function ponerCota(c, A, B, d, o1, o2) {
      kit.moverBarra(c.l, A, B);
      kit.moverBarra(c.a, A.map((v, i) => v + d[i] * o1), A.map((v, i) => v + d[i] * o2));
      kit.moverBarra(c.b, B.map((v, i) => v + d[i] * o1), B.map((v, i) => v + d[i] * o2));
    }
    const cL = cota(), cW = cota(), cH = cota();
    const lL = kit.etiqueta('largo', 0.24, { bg: '#ffb347', color: '#1a1206' }), lW = kit.etiqueta('ancho', 0.24, { bg: '#ffb347', color: '#1a1206' }), lH = kit.etiqueta('alto', 0.24, { bg: '#5cc8ff', color: '#08202c' });
    g.add(lL, lW, lH);

    // asa para arrastrar la esquina y cambiar w
    const asa = kit.malla(new THREE.SphereGeometry(0.15, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff6a00, emissiveIntensity: 0.8 }), { padre: g });
    kit.arrastre(asa, g, {
      normal: [0, 1, 0], punto: [0, 0.2, 0], cursor: 'grab', habilitado: est.habilitado,
      alMover: (p) => fijarW(Math.max(Math.abs(p.x) - TS - 0.2, 2 * (Math.abs(p.z) - TS - 0.2))),
    });
    function fijarW(w) { const v = acotar(w); if (v !== s.w) { s.w = v; s.cambio = true; } }

    // ---------------------------------------------------------------- construcción según w
    let geos = [];
    const nueva = (geo) => { geos.push(geo); return geo; };
    const rndD = kit.mulberry32(99);
    function construir() {
      const viejas = geos; geos = [];
      const w = s.w, L = 2 * w, H = M.h(w), X = L / 2 + TS, Z = w / 2 + TS, rim = Y0 + H;
      const zt = -Math.min(0.9, Math.max(0, w / 2 - 0.25)); // línea de la palada
      const pint = [], inte = [], osc = [], sold = [];
      const segY = Math.max(2, Math.ceil(H / 0.16));
      // planchas de los costados: la cara interior va raspada por la arena
      const muro = (lx, lz, x, z, cara) => {
        const geo = cajaUV(THREE, lx, H, lz, { s: 2, seg: [Math.max(1, Math.ceil(lx / 0.5)), segY, Math.max(1, Math.ceil(lz / 0.5))] });
        geo.translate(x, Y0 + H / 2, z);
        const [resto, interior] = partirCaja(geo, cara);
        pint.push(resto); inte.push(interior);
      };
      muro(L + 2 * TS, TS, 0, w / 2 + TS / 2, 5);
      muro(L + 2 * TS, TS, 0, -w / 2 - TS / 2, 4);
      muro(TS, w, -L / 2 - TS / 2, 0, 0);
      muro(TS, w, L / 2 + TS / 2, 0, 1);
      pint.push(cajaUV(THREE, L + 2 * TS + 0.06, TB, w + 2 * TS + 0.06, { s: 2, seg: [Math.ceil(L / 0.5), 1, Math.ceil(w / 0.5)] }).translate(0, HP + TB / 2, 0));
      const piso = uvEscala(new THREE.PlaneGeometry(L, w), L / 1.4, w / 1.4); piso.rotateX(-Math.PI / 2); piso.translate(0, Y0 + 0.002, 0);
      inte.push(piso);
      // caras exteriores: [ángulo de giro, distancia de la cara al centro, largo de la cara, eje a lo largo]
      const caras = [
        { giro: 0, d: Z, largo: L + 2 * TS, n: Math.max(1, Math.round(L / 0.85) - 1) },
        { giro: Math.PI, d: Z, largo: L + 2 * TS, n: Math.max(1, Math.round(L / 0.85) - 1) },
        { giro: Math.PI / 2, d: X, largo: w + 2 * TS, n: Math.max(0, Math.round(w / 0.85) - 1) },
        { giro: -Math.PI / 2, d: X, largo: w + 2 * TS, n: Math.max(0, Math.round(w / 0.85) - 1) },
      ];
      const yR0 = Y0 + 0.06, yR1 = rim - 0.06, hv = yR1 - yR0;
      const nC = H > 1.9 ? Math.floor(H / 1.4) : 0;
      const panos = []; // paños entre refuerzos, para rótulos y óxido
      for (const cf of caras) {
        const R = new THREE.Matrix4().makeRotationY(cf.giro);
        // en el sistema de la cara: x a lo largo, y hacia arriba, z hacia afuera (la cara exterior en z = d)
        const enCara = (geo) => { geo.applyMatrix4(R); return geo; };
        const xs = [];
        for (let i = 1; i <= cf.n; i++) xs.push(-cf.largo / 2 + (cf.largo * i) / (cf.n + 1));
        for (const x of xs) {
          pint.push(enCara(extruir(perfilU, hv, Math.max(1, Math.ceil(hv / 0.3))).applyMatrix4(base3([-1, 0, 0], [0, 0, 1], [0, 1, 0], x, yR0, cf.d))));
          for (const sx of [-0.0275, 0.0275]) sold.push(enCara(cordonGeo([x + sx, yR0, cf.d + 0.003], [x + sx, yR1, cf.d + 0.003])));
        }
        for (let j = 1; j <= nC; j++) {
          const y = Y0 + (H * j) / (nC + 1);
          pint.push(enCara(extruir(perfilU, cf.largo - 0.17, 1).applyMatrix4(base3([0, 1, 0], [0, 0, 1], [1, 0, 0], -cf.largo / 2 + 0.085, y, cf.d))));
        }
        // vigas de borde: superior (tubo de 60 × 50 mm) e inferior sobre el reborde de la base
        pint.push(enCara(cajaUV(THREE, cf.largo + 0.1, 0.06, 0.05, { s: 2, seg: [Math.ceil(cf.largo / 0.5), 1, 1] }).translate(0, rim - 0.03, cf.d + 0.025)));
        pint.push(enCara(cajaUV(THREE, cf.largo, 0.06, 0.04, { s: 2, seg: [Math.ceil(cf.largo / 0.5), 1, 1] }).translate(0, Y0 + 0.03, cf.d + 0.02)));
        sold.push(enCara(cordonGeo([-cf.largo / 2, yR0 + 0.004, cf.d + 0.004], [cf.largo / 2, yR0 + 0.004, cf.d + 0.004])));
        sold.push(enCara(cordonGeo([-cf.largo / 2, yR1 - 0.004, cf.d + 0.004], [cf.largo / 2, yR1 - 0.004, cf.d + 0.004])));
        const bordes = [-cf.largo / 2 + 0.085, ...xs.flatMap((x) => [x - 0.03, x + 0.03]), cf.largo / 2 - 0.085];
        for (let k = 0; k + 1 < bordes.length; k += 2) panos.push({ cf, R, x0: bordes[k], x1: bordes[k + 1] });
      }
      // cantoneras en las aristas verticales
      [[X, Z, 0], [X, -Z, Math.PI / 2], [-X, -Z, Math.PI], [-X, Z, -Math.PI / 2]].forEach(([x, z, r]) => {
        const geo = new THREE.ExtrudeGeometry(perfilL, { depth: H + TB, steps: Math.max(1, Math.ceil(H / 0.3)), bevelEnabled: false });
        uvEscala(geo, 0.5, 0.5); geo.rotateX(-Math.PI / 2); geo.rotateY(r); geo.translate(x, HP, z);
        pint.push(geo);
      });
      // orejas de izaje en los extremos, sobre el borde
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const z = sz * Math.max(0.12, w / 2 - 0.15);
        pint.push(extruir(perfilOreja, 0.016).applyMatrix4(base3([sx, 0, 0], [0, 1, 0], [0, 0, sx], sx * X, rim, z - sx * 0.008)));
        sold.push(cordonGeo([sx * (X + 0.051), rim - 0.12, z - 0.012], [sx * (X + 0.051), rim - 0.12, z + 0.012]));
      }
      // patines con los extremos achaflanados, travesaños y bolsillos para la horquilla
      const zp = Math.max(0.16, w / 2 - 0.14);
      for (const sz of [-1, 1]) osc.push(uvEscala(new THREE.ExtrudeGeometry(perfilPatin(L + 0.3), { depth: 0.1, bevelEnabled: false }), 0.5, 0.5).translate(0, 0, sz * zp - 0.05));
      for (const x of [-L / 2 + 0.1, 0, L / 2 - 0.1]) osc.push(cajaUV(THREE, 0.08, 0.08, w, { s: 1.4 }).translate(x, HP - 0.04, 0));
      const xb = Math.min(0.6, L / 2 - 0.35);
      for (const sx of [-1, 1]) osc.push(uvEscala(new THREE.ExtrudeGeometry(perfilBolsillo, { depth: w + 0.08, bevelEnabled: false }), 0.5, 0.5).translate(sx * xb, 0.02, -w / 2 - 0.04));
      // suciedad: barro salpicado abajo y óxido bajo el borde superior (colores por vértice)
      const gP = unir(kit, pint, true), pp = gP.attributes.position, cc = gP.attributes.color;
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
        const ruido = 0.5 + 0.5 * Math.sin(x * 3.7 + z * 2.9) * Math.sin(x * 1.3 - z * 4.1 + 1.7);
        const kb = (1 - suave(0.04, 0.4 + 0.25 * ruido, y)) * 0.6, ko = suave(rim - 0.25, rim, y) * 0.22 * (0.6 + 0.4 * ruido);
        cc.setXYZ(i, mezcla(mezcla(1, 0.6, kb), 0.8, ko), mezcla(mezcla(1, 0.52, kb), 0.55, ko), mezcla(mezcla(1, 0.4, kb), 0.4, ko));
      }
      mPint.geometry = nueva(gP);
      mInt.geometry = nueva(unir(kit, inte));
      mOsc.geometry = nueva(unir(kit, osc));
      mSold.geometry = nueva(unir(kit, sold));

      // arena al ras con un colmo donde cae la palada
      {
        const sxs = Math.max(8, Math.ceil(L / 0.12)), szs = Math.max(4, Math.ceil(w / 0.12));
        const top = new THREE.PlaneGeometry(L - 0.004, w - 0.004, sxs, szs); top.rotateX(-Math.PI / 2);
        const p = top.attributes.position, uv = top.attributes.uv, col = new Float32Array(p.count * 3);
        const mx = L / 2 - 0.55, mz = zt;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i), borde = Math.min(L / 2 - Math.abs(x), w / 2 - Math.abs(z)), kb = suave(0, 0.3, borde);
          const colmo = Math.exp(-((x - mx) ** 2 + (z - mz) ** 2) / 0.2);
          p.setY(i, rim - 0.035 + kb * (0.03 + 0.012 * Math.sin(x * 5.3 + z * 3.1) + 0.007 * Math.sin(x * 13 + z * 9)) + 0.2 * colmo * kb);
          uv.setXY(i, x / 0.9, z / 0.9);
          const v = 1 - 0.18 * colmo + (rndD() - 0.5) * 0.04; col[i * 3] = v; col[i * 3 + 1] = v * 0.98; col[i * 3 + 2] = v * 0.95 - 0.04 * colmo;
        }
        top.setAttribute('color', new THREE.BufferAttribute(col, 3));
        top.computeVertexNormals();
        mArena.geometry = nueva(top);
        mArena.visible = s.arena;
      }

      // zona de trabajo, capataz, bodega y focos de las miradas
      zona.position.set(X + 0.06 + GAP - lanzaZ.x, 0, zt - lanzaZ.z);
      capataz.grupo.position.set(Math.max(-X + 0.2, -2.55), 0, Z + 1.35); capataz.grupo.rotation.y = 0.85;
      bodega.position.set(-X - 2.05, 0, -0.15);
      focoRecipiente.position.set(L * 0.2, rim + 0.1, 0);
      focoCarga.set(zona.position.x + cargaZ.x, 0.05, zona.position.z + cargaZ.z);
      chorro.alto = rim > BORDE_MAX;
      if (chorro.alto) { chorro.objetivo.set(X + 0.3, 0.12, zt); chorro.apice = 0; }
      else { chorro.objetivo.set(L / 2 - 0.55, s.arena ? rim + 0.12 : Y0 + 0.02, zt); chorro.apice = rim + 0.32; }
      focoLanza.copy(chorro.objetivo);
      chorro.t = 99;

      // calcomanías: rótulo, óxido, polvo de arena, derrames, huellas, rueda y manchas
      {
        const cp = [], cu = [];
        const quad = (c, u, v, nombre, espejo = false) => {
          const [u0, v0, u1, v1] = atlas.uv(nombre), a = espejo ? u1 : u0, b = espejo ? u0 : u1;
          const P = [c.clone().sub(u).sub(v), c.clone().add(u).sub(v), c.clone().add(u).add(v), c.clone().sub(u).add(v)], T = [[a, v0], [b, v0], [b, v1], [a, v1]];
          for (const k of [0, 1, 2, 0, 2, 3]) { cp.push(P[k].x, P[k].y, P[k].z); cu.push(T[k][0], T[k][1]); }
        };
        const enPared = (R, x, y, d, ancho, alto, nombre) => quad(V(x, y, d).applyMatrix4(R), V(ancho / 2, 0, 0).applyMatrix4(R), V(0, alto / 2, 0), nombre);
        const enSuelo = (x, z, ancho, largo, ang, nombre, y = 0.032) => quad(V(x, y, z), V(Math.cos(ang) * ancho / 2, 0, -Math.sin(ang) * ancho / 2), V(-Math.sin(ang) * largo / 2, 0, -Math.cos(ang) * largo / 2), nombre);
        // rótulo en el paño del frente más cercano al centro
        const frente = panos.filter((p) => p.cf.giro === 0);
        const pr = frente.reduce((a, b) => (Math.abs((a.x0 + a.x1) / 2) <= Math.abs((b.x0 + b.x1) / 2) ? a : b));
        const anchoR = Math.min(1.15, (pr.x1 - pr.x0) * 0.86, H * 1.5), altoR = anchoR / 4;
        const yR = Math.min(Y0 + Math.max(H * 0.6, H - 0.14 - altoR / 2), rim - 0.1 - altoR / 2);
        enPared(pr.R, (pr.x0 + pr.x1) / 2, yR, Z + 0.003, anchoR, altoR, 'rotulo');
        // chorreaduras de óxido bajo la viga superior
        for (const p of panos) {
          if (p === pr || rndD() < 0.35) continue;
          const an = 0.1 + rndD() * 0.14, lar = Math.min(hv - 0.05, 0.25 + rndD() * 0.7), xc = mezcla(p.x0 + an / 2 + 0.02, p.x1 - an / 2 - 0.02, rndD());
          if (p.x1 - p.x0 < an + 0.05) continue;
          enPared(p.R, xc, yR1 - lar / 2, p.cf.d + 0.003, an, lar, 'oxido');
        }
        // polvo de arena en la cara del extremo donde se palea
        const caraD = new THREE.Matrix4().makeRotationY(Math.PI / 2);
        const altoP = Math.min(H - 0.1, 0.75);
        enPared(caraD, -zt, chorro.alto ? 0.35 + altoP / 2 : yR1 - altoP / 2, X + 0.004, Math.min(0.9, w - 0.2), altoP, 'polvo');
        // derrames en el suelo: bajo el montón, bajo la palada, junto a la carretilla y al harnero
        const zx = zona.position.x, zz = zona.position.z;
        enSuelo(zx + C.x, zz + C.z, RM * 3.1, RM * 3.1, 0.7, 'derrame');
        enSuelo(X + 0.45, zt, 1.2, 1.4, 2.1, 'derrame');
        enSuelo(zx + posCarr.x - 0.2, zz + posCarr.z, 1.3, 1.1, 0.4, 'derrame');
        enSuelo(zx - 0.25, zz + 0.1, 1.3, 1.3, 2.6, 'derrame');
        // manchas de humedad y barro junto a la base
        enSuelo(-L / 4, Z + 0.35, 1.6, 0.9, 0.2, 'mancha'); enSuelo(L / 3, -Z - 0.4, 1.8, 1.0, 1.1, 'mancha'); enSuelo(-X - 0.4, 0.3, 1.0, 1.4, 2.0, 'mancha');
        // huellas de bota alrededor de la persona que palea
        for (const [dx, dz, a] of [[0.15, 0.25, 0.4], [-0.35, -0.45, 2.2], [0.55, -0.6, 1.4], [-0.75, 0.5, 0.9], [0.4, -1.1, 3.0], [-0.2, 0.95, 5.5]]) enSuelo(zx + dx, zz + dz, 0.36, 0.36, yawO + a, 'huellas', 0.034);
        // huella de la rueda desde el montón hasta la carretilla
        const r0 = V(zx + C.x + perp.x * 0.2, 0, zz + C.z - RM * 0.9), r1 = V(zx + posCarr.x + 0.66, 0, zz + posCarr.z - 0.15);
        for (let k = 0; k < 5; k++) {
          const t0 = k / 5, t1 = (k + 1) / 5, curva = (t) => V(mezcla(r0.x, r1.x, t) + Math.sin(t * Math.PI) * 0.35, 0, mezcla(r0.z, r1.z, t));
          const a = curva(t0), b = curva(t1), m = a.clone().add(b).multiplyScalar(0.5), ang = Math.atan2(b.x - a.x, b.z - a.z);
          enSuelo(m.x, m.z, 0.5, a.distanceTo(b) + 0.03, ang, 'rueda', 0.033);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(cu, 2));
        geo.computeVertexNormals();
        mCalco.geometry = nueva(geo);
      }

      // cotas: largo al frente, ancho en el extremo izquierdo y alto en la esquina derecha
      const zc = Z + 0.5, xc = -X - 0.5;
      ponerCota(cL, [-L / 2, 0.06, zc], [L / 2, 0.06, zc], [0, 1, 0], -0.05, 0.2);
      kit.cambiarEtiqueta(lL, `largo 2w = ${kit.num(L, 2)} m`); lL.position.set(0, 0.42, zc + 0.08);
      ponerCota(cW, [xc, 0.06, -w / 2], [xc, 0.06, w / 2], [0, 1, 0], -0.05, 0.2);
      kit.cambiarEtiqueta(lW, `ancho w = ${kit.num(w, 2)} m`); lW.position.set(xc - 0.35, 0.45, -w / 4);
      ponerCota(cH, [X + 0.45, Y0, Z + 0.45], [X + 0.45, Y0 + H, Z + 0.45], [1, 0, 0], -0.12, 0.12);
      kit.cambiarEtiqueta(lH, `alto h = ${kit.num(H, 2)} m`); lH.position.set(X + 0.3, Y0 + H + 0.34, Z + 0.45);
      asa.position.set(X + 0.2, 0.2, Z + 0.2);
      g.updateMatrixWorld(true);
      for (const v of viejas) v.dispose();
    }
    function cordonGeo(a, b, r = 0.0045) {
      const A = V(...a), B = V(...b), len = A.distanceTo(B);
      const geo = uvEscala(new THREE.CylinderGeometry(r, r, len, 5, 1, true), 1, len / 0.018);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize()));
      geo.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
      return geo;
    }

    // ---------------------------------------------------------------- gráfico del costo
    const graf = kit.grafico({
      f: (w) => M.costo(w) / 1000, x0: W0, x1: W1, y0: 500, y1: 820, width: 1.3, height: 0.78,
      xTicks: [1, 1.5, 2, 2.5, 3], yTicks: [500, 600, 700, 800], tickFmt: (v) => kit.num(v, 1), yTickFmt: (v) => String(v),
      xLabel: 'ancho w (m)', yLabel: 'costo C (miles de $)', curveColor: 0xffb347,
    });
    graf.group.position.set(0.85, 1.05, 6.8); graf.group.rotation.y = -0.42;
    g.add(graf.group);
    // el dominio es w > 0: la curva crece sin cota hacia ambos extremos
    const nota = kit.createLabel('dominio w > 0:  C → ∞ si w → 0⁺ o w → ∞', { size: 0.032, color: '#cfe0f0', weight: 500 });
    nota.position.set(graf.width - nota.userData.size[0] / 2, graf.height + 0.05, 0.003); graf.group.add(nota);
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => fijarW(graf.xFromLocal(p.x)) });

    function revelar() {
      graf.removePoint('min');
      if (s.revelar) { const o = M.optimo(); graf.addPoint('min', o.w, o.costo / 1000, { color: 0x6fe3a2, labelX: 'w = ∛5 ≈ 1,71', labelY: '526,3' }); }
      s.cambio = true;
    }
    const verArena = (v) => { s.arena = v; s.cambio = true; panel?.invalidate(); };

    // ---------------------------------------------------------------- panel
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'Sin tapa, para 10 m³ de arena. El largo de la base es el doble del ancho. Base: $30.000 por m². Costados: $20.000 por m².',
      ecuaciones: ['C(w, h) = 30.000·2w² + 20.000·6wh = 60.000w² + 120.000wh', '2w²·h = 10   ⇒   h = 5/w²', 'C(w) = 60.000w² + 600.000/w,   w > 0'],
      lecturas: [
        { etiqueta: 'ancho w', valor: () => `${kit.num(s.w, 2)} m`, color: '#ffb347' },
        { etiqueta: 'largo 2w', valor: () => `${kit.num(2 * s.w, 2)} m`, color: '#ffb347' },
        { etiqueta: 'alto h = 5/w²', valor: () => `${kit.num(M.h(s.w), 2)} m`, color: '#5cc8ff' },
        { etiqueta: 'base: 60.000w²', valor: () => kit.pesos(60000 * s.w * s.w), color: '#c9a7ff', escala: 0.72 },
        { etiqueta: 'costados: 600.000/w', valor: () => kit.pesos(600000 / s.w), color: '#c9a7ff', escala: 0.72 },
        { etiqueta: 'costo total C', valor: () => kit.pesos(M.costo(s.w)), color: '#6fe3a2', escala: 0.72 },
      ],
      deslizadores: [{ etiqueta: 'Ancho de la base w', min: W0, max: W1, paso: 0.01, get: () => s.w, set: (v) => fijarW(v), formato: (v) => `${kit.num(v, 2)} m` }],
      botones: [
        { etiqueta: 'Ir al óptimo', accion: () => fijarW(Math.round(M.optimo().w * 100) / 100) },
        { etiqueta: 'Revelar solución', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
        { etiqueta: 'Mostrar arena', tipo: 'interruptor', get: () => s.arena, set: (v) => verArena(v) },
      ],
      pie: () => (s.revelar
        ? 'C′(w) = 120.000w − 600.000/w² = 0 ⇒ w³ = 5 ⇒ w = ∛5 ≈ 1,71 m. C″(w) = 120.000 + 1.200.000/w³ > 0, así que es el mínimo absoluto para w > 0. Ancho 1,71 m, largo 3,42 m, alto 1,71 m; costo mínimo ≈ $526.323.'
        : 'El volumen queda fijo en 10 m³: al cambiar el ancho, el alto se ajusta solo. Una base chica exige costados altos y una base grande encarece el fondo. Arrastra la esfera naranja, el gráfico o el deslizador.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-1.35, 1.38, 6.8); panel.mesh.rotation.y = 0.5;
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    // ---------------------------------------------------------------- animación
    let tCap = REV.capataz ?? 0;
    const tHoja = V();
    function cambios() {
      s.cambio = false; construir();
      graf.setMarker(s.w);
      graf.setTangent(s.w, M.derivada(s.w) / 1000, { color: 0xffd08a, len: 0.32 });
      panel.invalidate();
      if (REV.palada !== undefined) {
        // instante fijo: la arena va en el aire si la palada ya se soltó
        if (REV.palada >= T_LANZA) {
          obrero.fijarClip(CLIP, T_LANZA); lanzarArena(g.worldToLocal(centroHoja.getWorldPosition(tHoja)));
          chorro.t = REV.palada - T_LANZA;
        }
        obrero.fijarClip(CLIP, REV.palada);
      }
      moverArena();
    }
    function mirarCapataz(t) {
      const c = t % 11;
      capataz.mirar(c < 5 ? null : c < 7.5 ? focoRecipiente : c < 9.5 ? obrero.huesos.cabeza : null);
    }
    cambios();
    mirarCapataz(tCap); capataz.actualizar(0);

    return {
      paneles: [panel],
      radioSombra: 13,
      alturaCartel: 9.4,
      vista: { escritorio: { camara: [0, 3.8, 10.0], objetivo: [0, 1.3, 0.6] }, vr: { pos: [0, 0, 8.2], yaw: 0 } },
      dom: [
        { tipo: 'rango', etiqueta: 'w', min: W0, max: W1, paso: 0.01, get: () => s.w, set: (v) => fijarW(v), formato: (v) => `${kit.num(v, 2)} m` },
        { tipo: 'boton', etiqueta: 'Ir al óptimo', accion: () => fijarW(Math.round(M.optimo().w * 100) / 100) },
        { tipo: 'interruptor', etiqueta: 'Revelar solución', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
        { tipo: 'interruptor', etiqueta: 'Mostrar arena', get: () => s.arena, set: (v) => verArena(v) },
      ],
      actualizar(dt) {
        if (s.cambio) cambios();
        const fijo = REV.palada !== undefined;
        // obrero: palada en bucle; la arena sale de la hoja en el evento «lanza»
        if (fijo) obrero.fijarClip(CLIP, REV.palada); else obrero.actualizar(dt);
        const tc = fijo ? REV.palada : ((obrero.tiempoClip() % DUR) + DUR) % DUR;
        cargaPala.visible = tc >= T_CARGA + 0.05 && tc < T_LANZA + 0.03;
        const meta = tc > 1.2 && tc < 2.45 ? focoLanza : focoCarga;
        if (fijo) foco.position.copy(meta); else foco.position.lerp(meta, 1 - Math.exp(-dt * 6));
        if (pendienteLanzar) { pendienteLanzar = false; lanzarArena(g.worldToLocal(centroHoja.getWorldPosition(tHoja))); }
        if (!fijo && chorro.t <= chorro.dur + 0.1) { chorro.t += dt; moverArena(); }
        // capataz: mira la tableta, el recipiente y al obrero
        if (REV.capataz === undefined) tCap += dt;
        mirarCapataz(tCap);
        capataz.actualizar(REV.capataz === undefined ? dt : 0);
      },
    };
  },
};
