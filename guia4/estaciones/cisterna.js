// Ejemplo 3. Cisterna con base y tapa cuadradas para 12.000 dm³ de costo mínimo.
// Alrededor está la faena: un obrero revisa la cisterna con una tableta, el capataz le explica con los planos en la mano
// y una obrera carga la betonera con pala. Hay moldaje usado, fierro, sacos de cemento, escalera, manguera, letrero y conos.
import { CISTERNA as M } from '../../src/math/guia4.js';

// Revisión: rev=x:20,tapa:0,t:4.5,asa:1 fija el lado, abre la tapa, detiene la escena en t segundos o hace mirar el asa.
const REV = (() => {
  const o = {}, q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('rev');
  for (const par of (q || '').split(',')) {
    const [k, v] = par.split(':');
    if (k && v !== undefined && Number.isFinite(Number(v))) o[k] = Number(v);
  }
  return o;
})();

export default {
  id: 'cisterna',
  tipo: 'optimizacion',
  etiqueta: 'Ejemplo 3 · Optimización',
  titulo: 'Cisterna de costo mínimo',
  resumen: 'Se va a construir una cisterna con base y tapa cuadradas para almacenar 12.000 dm³ de agua. El concreto de la base y los lados cuesta $100 por dm² y el material de la tapa $200 por dm². ¿Qué dimensiones minimizan el costo?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const s = { x: 15, tapa: true, revelar: false, cambio: true, angulo: 0, tAsa: 0 };
    const dm = 0.1; // metros por decímetro
    const esp = 0.12; // espesor de los muros en metros
    const ABIERTA = 1.72; // giro de la tapa abierta (rad)
    if (REV.x) s.x = Math.min(40, Math.max(10, REV.x));
    if (REV.tapa === 0) { s.tapa = false; s.angulo = ABIERTA; }
    if (REV.asa) s.tAsa = 1e9;

    // ------------------------------------------------------------------ utilidades
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const azar = kit.mulberry32(3107);
    const al = (a, b) => a + (b - a) * azar();
    const suave = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), UNO = V(1, 1, 1);
    const ubicar = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => { E.set(rx, ry, rz); Q.setFromEuler(E); M4.compose(V(x, y, z), Q, UNO); return geo.applyMatrix4(M4); };
    // color por vértice (con una leve variación por pieza)
    const pintar = (geo, hex, vari = 0.05) => {
      const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3), k = 1 + (azar() - 0.5) * vari * 2;
      for (let i = 0; i < n; i++) { a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return geo;
    };
    const sinUV = (geo) => { if (geo.attributes.uv) geo.deleteAttribute('uv'); return geo; };
    // caja entre dos puntos: largo de a a b, sección sx (hacia ref) por sz
    const viga = (a, b, sx, sz, ref = V(0, 1, 0)) => {
      const d = b.clone().sub(a), largo = d.length(); d.normalize();
      const ex = ref.clone().addScaledVector(d, -ref.dot(d));
      if (ex.lengthSq() < 1e-6) { const r2 = Math.abs(d.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0); ex.copy(r2).addScaledVector(d, -r2.dot(d)); }
      ex.normalize();
      const ez = V().crossVectors(ex, d);
      const geo = new THREE.BoxGeometry(sx, largo, sz);
      return geo.applyMatrix4(new THREE.Matrix4().makeBasis(ex, d, ez).setPosition(a.clone().add(b).multiplyScalar(0.5)));
    };
    // cilindro entre dos puntos
    const tubo = (a, b, r, seg = 8, abierto = false) => {
      const d = b.clone().sub(a), largo = d.length(); d.normalize();
      const geo = new THREE.CylinderGeometry(r, r, largo, seg, 1, abierto);
      Q.setFromUnitVectors(V(0, 1, 0), d); M4.compose(a.clone().add(b).multiplyScalar(0.5), Q, UNO);
      return geo.applyMatrix4(M4);
    };
    const enEstacion = (obj, v) => g.worldToLocal(obj.localToWorld(v.clone()));

    // ------------------------------------------------------------------ lienzos
    const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const texDe = (c, { srgb = true, repetir = true } = {}) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    };
    // mapa normal desde una altura periódica en [0, 1]
    const normalDe = (alt, w, h, fuerza) => {
      const [c, ctx] = lienzo(w, h), img = ctx.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = alt[y * w + ((x + 1) % w)] - alt[y * w + ((x - 1 + w) % w)];
        const dy = alt[((y + 1) % h) * w + x] - alt[((y - 1 + h) % h) * w + x];
        const nx = -dx * fuerza, ny = dy * fuerza, l = Math.hypot(nx, ny, 1), i = (y * w + x) * 4;
        d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return texDe(c, { srgb: false });
    };
    const alturaDe = (ctx, w, h) => { const d = ctx.getImageData(0, 0, w, h).data, a = new Float32Array(w * h); for (let i = 0; i < a.length; i++) a[i] = d[i * 4] / 255; return a; };
    // mancha de borde irregular y salpicadura con gotas
    const mancha = (ctx, x, y, r, color, irreg = 0.35) => {
      ctx.fillStyle = color; ctx.beginPath();
      const f = [azar() * 6.28, azar() * 6.28, azar() * 6.28], giro = azar() * 6.28;
      for (let i = 0; i <= 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const k = 1 + irreg * (0.5 * Math.sin(3 * a + f[0]) + 0.3 * Math.sin(5 * a + f[1]) + 0.2 * Math.sin(9 * a + f[2]));
        const px = x + Math.cos(a + giro) * r * k, py = y + Math.sin(a + giro) * r * k;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    };
    const salpicadura = (ctx, x, y, r, color, gotas = 12) => {
      mancha(ctx, x, y, r, color, 0.5);
      for (let i = 0; i < gotas; i++) {
        const a = azar() * 6.28, d = r * (1.15 + azar() * 1.9), rr = r * (0.05 + azar() * 0.16);
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, 6.28); ctx.fill();
      }
    };

    // Hormigón visto de los muros: atlas de 2 × 2 placas de moldaje fenólico de 1,22 × 2,44 m (2,44 × 4,88 m en total, 4,8 mm
    // por píxel), cada placa con su tono. Juntas con rebaba y tramos con pérdida de lechada, pasadas de tensores tapadas con
    // mortero, poros finos concentrados arriba de cada placa, nidos al pie, manchas de desmoldante y algún chorreo de óxido.
    function texturaMuro() {
      const W = 512, H = 1024, PW = 256, PH = 512;
      const fa = kit.fbm(256, 4, 5, 41), fb = kit.fbm(256, 18, 3, 42), fc = kit.fbm(256, 2, 3, 43), fd = kit.fbm(256, 48, 2, 44);
      const [c, ctx] = lienzo(W, H), [, hx] = lienzo(W, H);
      const tono = [7, -6, -1, 10].map((t) => t + al(-2, 2));
      const img = ctx.createImageData(W, H), d = img.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, pl = (y >= PH ? 2 : 0) + (x >= PW ? 1 : 0), yy = (y % PH) / PH;
        const j = (y % 256) * 256 + (x % 256), jj = ((y >> 1) % 256) * 256 + (x >> 1), jg = (y >> 2) * 256 + (x >> 1);
        const v = 160 + tono[pl] + (fa[jj] - 0.5) * 32 + (fb[j] - 0.5) * 13 + (fd[j] - 0.5) * 9 - suave(0.6, 0.86, fc[jg]) * 18 + (0.5 - yy) * 7;
        d[i * 4] = v; d[i * 4 + 1] = v * 0.984; d[i * 4 + 2] = v * 0.952; d[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      hx.fillStyle = '#7a7a7a'; hx.fillRect(0, 0, W, H);
      // manchas suaves de desmoldante y de curado
      for (let k = 0; k < 14; k++) { const r = 30 + azar() * 60; mancha(ctx, r + azar() * (W - 2 * r), r + azar() * (H - 2 * r), r, azar() < 0.5 ? 'rgba(112,108,98,0.07)' : 'rgba(214,210,198,0.07)', 0.55); }
      // pérdida de lechada en tramos de las juntas: borde áspero y más oscuro
      for (let k = 0; k < 12; k++) {
        const vert = azar() < 0.6, pos = (azar() < 0.5 ? 0 : 1) * (vert ? PW : PH), a0 = azar() * (vert ? H : W), l = 30 + azar() * 150;
        ctx.fillStyle = 'rgba(92,88,80,0.2)';
        for (let s2 = 0; s2 < l; s2 += 2) {
          const w = 2 + azar() * 5;
          if (vert) { ctx.fillRect(pos - w / 2, (a0 + s2) % H, w, 2); ctx.fillRect(pos + W - w / 2, (a0 + s2) % H, w, 2); }
          else { ctx.fillRect((a0 + s2) % W, pos - w / 2, 2, w); ctx.fillRect((a0 + s2) % W, pos + H - w / 2, 2, w); }
        }
      }
      // juntas entre placas: una rebaba fina con su sombra
      for (const x of [0, PW]) {
        ctx.fillStyle = 'rgba(66,64,58,0.4)'; ctx.fillRect(x, 0, 1.5, H);
        ctx.fillStyle = 'rgba(226,223,214,0.3)'; ctx.fillRect(x + 2, 0, 1, H);
        hx.fillStyle = '#b6b6b6'; hx.fillRect(x, 0, 2, H);
      }
      for (const y of [0, PH]) {
        ctx.fillStyle = 'rgba(66,64,58,0.4)'; ctx.fillRect(0, y, W, 1.5);
        ctx.fillStyle = 'rgba(226,223,214,0.3)'; ctx.fillRect(0, y + 2, W, 1);
        hx.fillStyle = '#b6b6b6'; hx.fillRect(0, y, W, 2);
      }
      // pasadas de los tensores (8 por placa), tapadas con un tarugo de mortero algo hundido
      const pasadas = [];
      for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) for (const u of [0.25, 0.75]) for (const v of [0.125, 0.375, 0.625, 0.875]) pasadas.push([(px + u) * PW + al(-1.5, 1.5), (py + v) * PH + al(-1.5, 1.5)]);
      for (const [x, y] of pasadas) {
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 6.5);
        gr.addColorStop(0, 'rgba(178,174,164,0.95)'); gr.addColorStop(0.5, 'rgba(152,148,140,0.95)'); gr.addColorStop(0.72, 'rgba(98,94,86,0.85)'); gr.addColorStop(1, 'rgba(98,94,86,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, 6.28); ctx.fill();
        hx.fillStyle = '#464646'; hx.beginPath(); hx.arc(x, y, 4.4, 0, 6.28); hx.fill();
        hx.fillStyle = '#5e5e5e'; hx.beginPath(); hx.arc(x, y, 2.8, 0, 6.28); hx.fill();
      }
      // lechada clara que escurrió de algunas pasadas y óxido de las que quedaron con el fierro a la vista
      const chorro = (x, y, l, w, rgb, a) => {
        for (const o of [0, -H]) {
          const gx = ctx.createLinearGradient(0, y + o, 0, y + o + l);
          gx.addColorStop(0, `rgba(${rgb},${a})`); gx.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gx;
          ctx.beginPath(); ctx.moveTo(x - w, y + o + 3); ctx.lineTo(x + w, y + o + 3); ctx.lineTo(x + w * 0.4 + al(-1, 1), y + o + l); ctx.lineTo(x - w * 0.4, y + o + l); ctx.fill();
        }
      };
      for (const [x, y] of pasadas) if (azar() < 0.3) chorro(x, y, 30 + azar() * 90, 1.6 + azar(), '226,223,212', 0.32);
      for (let k = 0; k < 4; k++) { const [x, y] = pasadas[Math.floor(azar() * pasadas.length)]; chorro(x, y, 50 + azar() * 140, 2.2, '140,78,36', 0.4); }
      // poros finos (2 a 8 mm), más abundantes arriba de cada placa
      for (let k = 0; k < 380; k++) {
        const x = azar() * W, y = Math.floor(azar() * 2) * PH + azar() ** 1.7 * PH, r = 0.45 + azar() ** 3 * 1.6;
        ctx.fillStyle = `rgba(72,69,64,${0.26 + azar() * 0.3})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
        hx.fillStyle = '#424242'; hx.beginPath(); hx.arc(x, y, r, 0, 6.28); hx.fill();
      }
      // nidos de piedra al pie de dos placas
      for (let k = 0; k < 2; k++) {
        const cx = 30 + azar() * (W - 60), cy = (k + 1) * PH - 10 - azar() * 16;
        for (let m = 0; m < 46; m++) {
          const a = azar() * 6.28, rr = azar() ** 0.6 * 12, x = cx + Math.cos(a) * rr * 1.7, y = cy + Math.sin(a) * rr * 0.6, r = 0.6 + azar() * 1.5;
          ctx.fillStyle = `rgba(84,80,72,${0.35 + azar() * 0.3})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
          hx.fillStyle = '#3c3c3c'; hx.beginPath(); hx.arc(x, y, r, 0, 6.28); hx.fill();
        }
      }
      // humedad que baja desde el borde superior de las placas
      for (let k = 0; k < 8; k++) {
        const x = azar() * W, w = 4 + azar() * 16, y0 = Math.floor(azar() * 2) * PH, l = 60 + azar() * 260, gy = ctx.createLinearGradient(0, y0, 0, y0 + l);
        gy.addColorStop(0, 'rgba(80,78,70,0.15)'); gy.addColorStop(1, 'rgba(80,78,70,0)');
        ctx.fillStyle = gy; ctx.fillRect(x, y0, w, l);
      }
      const alt = alturaDe(hx, W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) alt[y * W + x] += fb[(y % 256) * 256 + (x % 256)] * 0.12 + fd[(y % 256) * 256 + (x % 256)] * 0.05;
      return { map: texDe(c), normal: normalDe(alt, W, H, 2.2) };
    }

    // Calcomanía de suciedad (4,7 mm por píxel). Mitad de arriba: barro salpicado, chorreos del curado y eflorescencia al pie
    // de los muros (0,6 m de alto). Mitad de abajo: suelo húmedo y lechada pegada alrededor del radier (0,75 m hacia afuera).
    function texturaSucio() {
      const W = 512, H = 256, [c, ctx] = lienzo(W, H), f = kit.fbm(256, 8, 4, 91), f2 = kit.fbm(256, 3, 3, 92);
      const img = ctx.createImageData(W, H), d = img.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, n = f[(y % 256) * 256 + (x >> 1)], m = f2[(y % 256) * 256 + (x >> 1)];
        let a;
        if (y < 128) {
          const h = (127 - y) / 127, borde = 0.17 + 0.16 * m + 0.1 * (n - 0.5); // 0 al pie del muro, 1 a 0,6 m
          a = 0.72 * (1 - suave(borde * 0.35, borde, h)) * (0.8 + 0.5 * (n - 0.5));
          d[i] = 84; d[i + 1] = 72; d[i + 2] = 57;
        } else {
          const h = (y - 128) / 127, borde = 0.32 + 0.4 * m + 0.16 * (n - 0.5); // 0 junto al radier, 1 a 0,75 m
          a = 0.62 * (1 - suave(borde * 0.25, borde, h)) * (0.8 + 0.45 * (n - 0.5));
          d[i] = 50; d[i + 1] = 43; d[i + 2] = 34;
        }
        d[i + 3] = Math.max(0, Math.min(255, a * 255));
      }
      ctx.putImageData(img, 0, 0);
      const rep = (fn) => { fn(0); fn(-W); fn(W); };
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 127); ctx.clip();
      for (let k = 0; k < 280; k++) {
        const x = azar() * W, y = 126 - azar() ** 2.2 * 84, r = 0.5 + azar() * 1.5, e = 1 + azar(), a = 0.28 + azar() * 0.4;
        rep((o) => { ctx.fillStyle = `rgba(84,72,56,${a})`; ctx.beginPath(); ctx.ellipse(x + o, y, r, r * e, 0, 0, 6.28); ctx.fill(); });
      }
      for (let k = 0; k < 7; k++) {
        const x = azar() * W, y = 66 + azar() * 44, r = 12 + azar() * 26;
        rep((o) => { const gr = ctx.createRadialGradient(x + o, y, 0, x + o, y, r); gr.addColorStop(0, 'rgba(236,233,224,0.26)'); gr.addColorStop(1, 'rgba(236,233,224,0)'); ctx.fillStyle = gr; ctx.fillRect(x + o - r, y - r, 2 * r, 2 * r); });
      }
      for (let k = 0; k < 12; k++) {
        const x = azar() * W, l = 30 + azar() * 70, y = 120 - l, w = 1.5 + azar() * 2;
        rep((o) => { const gx = ctx.createLinearGradient(0, y, 0, y + l); gx.addColorStop(0, 'rgba(60,56,50,0)'); gx.addColorStop(1, 'rgba(60,56,50,0.24)'); ctx.fillStyle = gx; ctx.fillRect(x + o, y, w, l); });
      }
      ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, 129, W, H - 129); ctx.clip();
      for (let k = 0; k < 14; k++) { const r = 6 + azar() * 16; mancha(ctx, r + azar() * (W - 2 * r), 131 + azar() * 20, r, 'rgba(152,146,134,0.48)', 0.5); }
      for (let k = 0; k < 170; k++) {
        const x = azar() * W, y = 131 + azar() ** 1.5 * 112, r = 0.6 + azar() * 1.5, cl = azar() < 0.5 ? 'rgba(162,156,144,0.55)' : 'rgba(62,54,44,0.45)';
        rep((o) => { ctx.fillStyle = cl; ctx.beginPath(); ctx.arc(x + o, y, r, 0, 6.28); ctx.fill(); });
      }
      ctx.restore();
      const t = texDe(c); t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    }

    // Plancha diamantada de acero galvanizado para la tapa (una baldosa = 0,3 m)
    function texturaPlancha() {
      const S = 256, [c, ctx] = lienzo(S, S), [ch, hx] = lienzo(S, S), [, bx] = lienzo(S, S);
      const fa = kit.fbm(S, 4, 4, 51), fb = kit.fbm(S, 24, 2, 52);
      const img = ctx.createImageData(S, S), d = img.data;
      for (let i = 0; i < S * S; i++) { const v = 146 + (fa[i] - 0.5) * 44 + (fb[i] - 0.5) * 16; d[i * 4] = v * 0.97; d[i * 4 + 1] = v; d[i * 4 + 2] = v * 1.03; d[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0);
      hx.fillStyle = '#000'; hx.fillRect(0, 0, S, S);
      const n = 8, paso = S / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * paso, y = (j + 0.5) * paso, ang = (i + j) % 2 ? Math.PI / 4 : -Math.PI / 4;
        hx.save(); hx.translate(x, y); hx.rotate(ang); hx.fillStyle = '#fff'; hx.beginPath(); hx.ellipse(0, 0, paso * 0.36, paso * 0.1, 0, 0, 6.28); hx.fill(); hx.restore();
        ctx.save(); ctx.translate(x + 0.6, y + 0.8); ctx.rotate(ang); ctx.fillStyle = 'rgba(52,50,44,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, paso * 0.4, paso * 0.15, 0, 0, 6.28); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = 'rgba(214,218,220,0.6)'; ctx.beginPath(); ctx.ellipse(0, 0, paso * 0.3, paso * 0.06, 0, 0, 6.28); ctx.fill(); ctx.restore();
      }
      bx.filter = 'blur(1.2px)'; bx.drawImage(ch, 0, 0); bx.filter = 'none';
      // óxido y suciedad
      for (let k = 0; k < 5; k++) {
        const x = azar() * S, y = azar() * S, r = 8 + azar() * 22, gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(132,70,32,0.42)'); gr.addColorStop(1, 'rgba(132,70,32,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      for (let k = 0; k < 8; k++) mancha(ctx, azar() * S, azar() * S, 6 + azar() * 16, 'rgba(70,64,54,0.12)', 0.6);
      return { map: texDe(c), normal: normalDe(alturaDe(bx, S, S), S, S, 2.4) };
    }

    // Pintura naranja del tambor de la betonera con costras de hormigón; franja neutra abajo para el engranaje y el interior.
    function texturaTambor() {
      const S = 256, [c, ctx] = lienzo(S, S), fa = kit.fbm(S, 6, 4, 61), fb = kit.fbm(S, 20, 2, 62);
      const img = ctx.createImageData(S, S), d = img.data;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = y * S + x, k = 0.84 + fa[i] * 0.22 + (fb[i] - 0.5) * 0.08;
        const neutro = y > S * 0.94;
        d[i * 4] = neutro ? 172 * k : 214 * k; d[i * 4 + 1] = neutro ? 170 * k : 90 * k; d[i * 4 + 2] = neutro ? 164 * k : 36 * k; d[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const rep = (fn) => { fn(0); fn(-S); fn(S); };
      // chorreaduras desde la boca (arriba del lienzo)
      for (let k = 0; k < 30; k++) {
        const x = azar() * S, l = 18 + azar() * 110, w = 2 + azar() * 4;
        rep((o) => { ctx.fillStyle = 'rgba(165,160,150,0.85)'; ctx.fillRect(x + o, 0, w, l); ctx.beginPath(); ctx.arc(x + o + w / 2, l, w * 0.8, 0, 6.28); ctx.fill(); });
      }
      for (let k = 0; k < 70; k++) {
        const x = azar() * S, y = azar() ** 1.7 * S * 0.88, r = 1.5 + azar() * 6;
        rep((o) => salpicadura(ctx, x + o, y, r, 'rgba(170,165,154,0.9)', 6));
      }
      for (let k = 0; k < 40; k++) { const x = azar() * S, y = azar() * S * 0.92; ctx.strokeStyle = 'rgba(90,72,60,0.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + al(-12, 12), y + al(-4, 4)); ctx.stroke(); }
      const gr = ctx.createLinearGradient(0, S * 0.6, 0, S * 0.94); gr.addColorStop(0, 'rgba(50,36,26,0)'); gr.addColorStop(1, 'rgba(50,36,26,0.35)');
      ctx.fillStyle = gr; ctx.fillRect(0, S * 0.6, S, S * 0.34);
      return texDe(c);
    }

    // Saco de cemento de papel con impresión genérica y polvo
    function texturaSaco() {
      const S = 256, [c, ctx] = lienzo(S, S), fa = kit.fbm(S, 8, 4, 71), fb = kit.fbm(S, 48, 2, 72);
      const img = ctx.createImageData(S, S), d = img.data;
      for (let i = 0; i < S * S; i++) { const k = 0.9 + (fa[i] - 0.5) * 0.12 + (fb[i] - 0.5) * 0.1; d[i * 4] = 222 * k; d[i * 4 + 1] = 212 * k; d[i * 4 + 2] = 190 * k; d[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0);
      ctx.fillStyle = '#b3312a'; ctx.fillRect(0, 96, S, 62);
      ctx.fillStyle = '#f6f1e6'; ctx.font = kit.font(40, 800); ctx.textAlign = 'center'; ctx.fillText('CEMENTO', S / 2, 142);
      ctx.fillStyle = '#2a2622'; ctx.font = kit.font(19, 700); ctx.fillText('Portland puzolánico', S / 2, 80);
      ctx.font = kit.font(34, 800); ctx.fillText('25 kg', S / 2, 202);
      ctx.font = kit.font(11, 500); ctx.fillStyle = 'rgba(40,36,32,0.8)'; ctx.fillText('Uso general · Mantener en lugar seco', S / 2, 228);
      for (let k = 0; k < 16; k++) { const x = azar() * S, y = azar() * S, r = 14 + azar() * 40, gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(206,203,196,0.55)'); gr.addColorStop(1, 'rgba(206,203,196,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
      ctx.strokeStyle = 'rgba(90,80,64,0.35)'; ctx.lineWidth = 1;
      for (let k = 0; k < 18; k++) { const x = azar() * S, y = azar() * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + al(-30, 30), y + al(-8, 8)); ctx.stroke(); }
      return texDe(c, { repetir: false });
    }

    // Atlas de madera: mitad izquierda pino (vetas a lo largo de v), mitad derecha terciado fenólico de moldaje con costras.
    function texturaMadera() {
      const S = 512, [c, ctx] = lienzo(S, S), fa = kit.fbm(256, 3, 4, 81), fb = kit.fbm(256, 32, 2, 82), fc = kit.fbm(256, 6, 4, 83);
      const img = ctx.createImageData(S, S), d = img.data;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4, j = ((y >> 1) % 256) * 256 + (x % 256), jf = (y % 256) * 256 + (x % 256);
        if (x < 256) {
          const veta = 0.5 + 0.5 * Math.sin(x * 0.5 + fa[j] * 10 + Math.sin(y * 0.01) * 1.5);
          const k = 0.74 + veta * 0.2 + (fb[jf] - 0.5) * 0.14;
          d[i] = 204 * k; d[i + 1] = 162 * k; d[i + 2] = 106 * k;
        } else {
          const k = 0.86 + (fc[jf] - 0.5) * 0.26 + (fb[jf] - 0.5) * 0.06;
          d[i] = 112 * k; d[i + 1] = 52 * k; d[i + 2] = 36 * k;
        }
        d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      // nudos del pino
      for (let k = 0; k < 9; k++) {
        const x = azar() * 240 + 8, y = azar() * S, r = 3 + azar() * 5, gr = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
        gr.addColorStop(0, 'rgba(92,56,26,0.95)'); gr.addColorStop(0.6, 'rgba(130,86,44,0.6)'); gr.addColorStop(1, 'rgba(130,86,44,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.6, 0, 0, 6.28); ctx.fill();
      }
      // pino sucio y con salpicaduras de hormigón
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 256, S); ctx.clip();
      for (let k = 0; k < 16; k++) salpicadura(ctx, azar() * 256, azar() * S, 3 + azar() * 9, 'rgba(160,156,148,0.8)', 6);
      for (let k = 0; k < 10; k++) mancha(ctx, azar() * 256, azar() * S, 10 + azar() * 30, 'rgba(70,56,40,0.14)', 0.6);
      ctx.restore();
      // fenólico: rayas claras, desgaste y costras de hormigón
      ctx.save(); ctx.beginPath(); ctx.rect(256, 0, 256, S); ctx.clip();
      ctx.strokeStyle = 'rgba(190,150,120,0.22)'; ctx.lineWidth = 1;
      for (let k = 0; k < 60; k++) { const x = 256 + azar() * 256, y = azar() * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + al(-40, 40), y + al(-12, 12)); ctx.stroke(); }
      for (let k = 0; k < 12; k++) mancha(ctx, 256 + azar() * 256, azar() * S, 6 + azar() * 20, 'rgba(128,120,110,0.55)', 0.55);
      for (let k = 0; k < 120; k++) { ctx.fillStyle = 'rgba(140,134,124,0.5)'; ctx.beginPath(); ctx.arc(256 + azar() * 256, azar() * S, 0.8 + azar() * 2.2, 0, 6.28); ctx.fill(); }
      ctx.fillStyle = 'rgba(200,90,40,0.85)'; ctx.fillRect(256, 0, 256, 5); ctx.fillRect(256, S - 5, 256, 5); ctx.fillRect(256, 0, 5, S); ctx.fillRect(S - 5, 0, 5, S);
      ctx.restore();
      const t = texDe(c, { repetir: false });
      return t;
    }

    // Letrero de la obra
    function texturaLetrero() {
      const W = 512, H = 256, [c, ctx] = lienzo(W, H);
      ctx.fillStyle = '#f3f1ea'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1f3d63'; ctx.fillRect(0, 0, W, 62);
      ctx.fillStyle = '#ff8a1f'; ctx.fillRect(0, 62, W, 7);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = kit.font(37, 800); ctx.fillText('OBRA EN CONSTRUCCIÓN', W / 2, 45);
      ctx.fillStyle = '#1d2733'; ctx.font = kit.font(27, 800); ctx.fillText('Cisterna de hormigón armado', W / 2, 104);
      ctx.fillStyle = '#3a4552'; ctx.font = kit.font(18, 600);
      ctx.fillText('Capacidad 12.000 dm³ (12 m³) · base y tapa cuadradas', W / 2, 134);
      ctx.fillText('Base y lados de hormigón · tapa de plancha de acero', W / 2, 158);
      // pictogramas de elementos de protección
      const ic = [(x, y) => { ctx.beginPath(); ctx.arc(x, y + 4, 11, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 15, y + 3, 30, 4); },
        (x, y) => { ctx.beginPath(); ctx.moveTo(x - 11, y - 10); ctx.lineTo(x - 4, y - 10); ctx.lineTo(x, y - 2); ctx.lineTo(x + 4, y - 10); ctx.lineTo(x + 11, y - 10); ctx.lineTo(x + 11, y + 12); ctx.lineTo(x - 11, y + 12); ctx.closePath(); ctx.fill(); },
        (x, y) => { ctx.fillRect(x - 9, y - 12, 9, 20); ctx.fillRect(x - 9, y + 4, 20, 8); },
        (x, y) => { ctx.fillRect(x - 8, y - 4, 16, 16); for (let k = 0; k < 4; k++) ctx.fillRect(x - 8 + k * 4.2, y - 13, 3.2, 10); ctx.fillRect(x + 8, y - 2, 4, 9); }];
      ic.forEach((f, k) => { const x = 46 + k * 52, y = 206; ctx.fillStyle = '#1e5aa8'; ctx.beginPath(); ctx.arc(x, y, 22, 0, 6.28); ctx.fill(); ctx.fillStyle = '#fff'; f(x, y); });
      ctx.textAlign = 'left'; ctx.fillStyle = '#1d2733'; ctx.font = kit.font(16, 800);
      ctx.fillText('USO OBLIGATORIO DE ELEMENTOS', 256, 200); ctx.fillText('DE PROTECCIÓN PERSONAL', 256, 220);
      // intemperie: tierra abajo, óxido de los tornillos y decoloración
      const gr = ctx.createLinearGradient(0, H * 0.7, 0, H); gr.addColorStop(0, 'rgba(110,90,60,0)'); gr.addColorStop(1, 'rgba(110,90,60,0.28)'); ctx.fillStyle = gr; ctx.fillRect(0, H * 0.7, W, H * 0.3);
      for (const [x, y] of [[10, 10], [W - 10, 10], [10, H - 10], [W - 10, H - 10]]) {
        ctx.fillStyle = '#6b6b66'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.28); ctx.fill();
        const gx = ctx.createLinearGradient(0, y, 0, y + 40); gx.addColorStop(0, 'rgba(140,72,30,0.45)'); gx.addColorStop(1, 'rgba(140,72,30,0)'); ctx.fillStyle = gx; ctx.fillRect(x - 1.5, y + 3, 3, 40);
      }
      for (let k = 0; k < 10; k++) mancha(ctx, azar() * W, azar() * H, 10 + azar() * 30, 'rgba(120,110,90,0.06)', 0.6);
      return texDe(c, { repetir: false });
    }

    // Cinta de peligro
    function texturaCinta() {
      const [c, ctx] = lienzo(256, 32);
      ctx.fillStyle = '#f2c21b'; ctx.fillRect(0, 0, 256, 32);
      ctx.fillStyle = '#161512';
      for (let x = -32; x < 96; x += 14) { ctx.beginPath(); ctx.moveTo(x, 32); ctx.lineTo(x + 7, 32); ctx.lineTo(x + 19, 0); ctx.lineTo(x + 12, 0); ctx.closePath(); ctx.fill(); }
      for (let x = 196; x < 300; x += 14) { ctx.beginPath(); ctx.moveTo(x, 32); ctx.lineTo(x + 7, 32); ctx.lineTo(x + 19, 0); ctx.lineTo(x + 12, 0); ctx.closePath(); ctx.fill(); }
      ctx.font = kit.font(19, 800); ctx.textAlign = 'center'; ctx.fillText('PELIGRO', 146, 23);
      return texDe(c);
    }

    // ------------------------------------------------------------------ distribución de la faena (coordenadas de la estación)
    const LUG = {
      inspector: [-2.45, 0.9, 0.95],
      capataz: [-3.2, -0.5, 1.33],
      palera: [-3.0, -3.6, -0.52],
      pallet: [-5.55, -1.5, 0.35],
      tambor: [-3.85, -4.85],
      pilon: [-1.3, -6.05],
      carretilla: [-1.6, -4.3, 2.75],
      moldaje: [2.85, -4.35, 0.22],
      letrero: [2.45, -5.75, -0.18],
      caballete: [5.05, -3.0, 1.15],
      conos: [[-5.4, 2.15], [-6.3, -0.45], [5.25, 2.3], [5.95, -0.75]],
    };

    // ------------------------------------------------------------------ materiales comunes
    const matVC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.15 });
    const vc = []; // piezas estáticas sin textura (se unen al final)
    const vcSS = []; // piezas tendidas en el suelo: su sombra no se nota y se ahorra el paso de sombras
    const mad = []; // piezas de madera con el atlas
    const ponerVC = (geo, hex, vari) => { vc.push(sinUV(pintar(geo, hex, vari))); return geo; };
    const ponerSS = (geo, hex, vari) => { vcSS.push(sinUV(pintar(geo, hex, vari))); return geo; };

    // ------------------------------------------------------------------ suelo: base estabilizada con borde irregular
    function disco(R, anillos, segs, altura, escUV, irreg = 0.06) {
      const pos = [0, altura(0, 0), 0], uv = [0, 0], idx = [];
      const f = [azar() * 6.28, azar() * 6.28, azar() * 6.28];
      for (let k = 1; k <= anillos; k++) for (let j = 0; j < segs; j++) {
        const a = (j / segs) * Math.PI * 2, borde = 1 + irreg * (0.55 * Math.sin(3 * a + f[0]) + 0.3 * Math.sin(7 * a + f[1]) + 0.15 * Math.sin(13 * a + f[2]));
        const r = (k / anillos) * R * borde, x = Math.cos(a) * r, z = Math.sin(a) * r;
        pos.push(x, altura(k / anillos, a), z); uv.push(x / escUV, -z / escUV);
      }
      const id = (k, j) => (k === 0 ? 0 : 1 + (k - 1) * segs + (j % segs));
      for (let j = 0; j < segs; j++) idx.push(0, id(1, j + 1), id(1, j));
      for (let k = 1; k < anillos; k++) for (let j = 0; j < segs; j++) {
        const a = id(k, j), b = id(k, j + 1), c2 = id(k + 1, j), d2 = id(k + 1, j + 1);
        idx.push(a, b, c2, b, d2, c2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      return geo;
    }
    const matBase = kit.mat('gravel', { repeat: [1, 1], color: 0xbab09c, roughness: 1, normalScale: 0.42 });
    matBase.polygonOffset = true; matBase.polygonOffsetFactor = -2; matBase.polygonOffsetUnits = -2;
    kit.malla(disco(7.1, 4, 72, () => 0.012, 0.42), matBase, { sombra: false, padre: g });

    // Manchas del suelo: lechada, salpicaduras, polvo de cemento, humedad y huellas de carretilla.
    function texturaSuelo() {
      const S = 512, L = 14.4, k = S / L, [c, ctx] = lienzo(S, S);
      const P = (x, z) => [(x + L / 2) * k, (z + L / 2) * k];
      // tierra pisada en los caminos de la faena
      ctx.strokeStyle = 'rgba(70,56,40,0.16)'; ctx.lineCap = 'round';
      const sendero = (pts, w) => { ctx.lineWidth = w * k; ctx.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); ctx.stroke(); };
      sendero([[-0.6, 5.6], [-1.8, 2.6], [-2.7, 0.3], [-3.0, -2.6], [-2.6, -4.6], [-1.5, -5.6]], 0.9);
      sendero([[-1.6, -4.3], [-0.5, -3.2], [1.6, -2.6], [2.9, -3.4]], 0.6);
      // lechada bajo la boca de la betonera y salpicaduras alrededor (tonos cálidos y bordes difuminados, como el cemento sobre la grava)
      const [bx, bz] = P(-4.3, -3.4);
      ctx.filter = 'blur(1.2px)';
      mancha(ctx, bx, bz, 0.75 * k, 'rgba(140,134,122,0.62)', 0.45);
      mancha(ctx, bx + 0.3 * k, bz + 0.2 * k, 0.45 * k, 'rgba(112,106,96,0.5)', 0.4);
      ctx.filter = 'blur(0.7px)';
      for (let i = 0; i < 38; i++) { const a = azar() * 6.28, d = (0.4 + azar() ** 1.2 * 1.6) * k, t = 150 + azar() * 16; salpicadura(ctx, bx + Math.cos(a) * d, bz + Math.sin(a) * d, (0.025 + azar() * 0.06) * k, `rgba(${t},${t - 6},${t - 16},${0.32 + azar() * 0.22})`, 4); }
      ctx.filter = 'none';
      // huellas de carretilla hacia la cisterna
      ctx.strokeStyle = 'rgba(122,116,106,0.4)'; ctx.lineWidth = 0.05 * k;
      for (const off of [0, 0.06]) { ctx.beginPath(); const pts = [[-4.0 + off, -3.0], [-3.2, -2.2], [-2.6 + off, -1.0], [-2.5, 0.0]]; pts.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); ctx.stroke(); }
      // polvo de cemento junto al pallet y al saco roto
      for (const [x, z, r] of [[LUG.pallet[0], LUG.pallet[1], 1.0], [-4.75, -2.35, 0.55]]) {
        const [a, b] = P(x, z), gr = ctx.createRadialGradient(a, b, 0, a, b, r * k);
        gr.addColorStop(0, 'rgba(214,211,204,0.75)'); gr.addColorStop(1, 'rgba(214,211,204,0)'); ctx.fillStyle = gr; ctx.fillRect(a - r * k, b - r * k, 2 * r * k, 2 * r * k);
      }
      // humedad bajo el pilón de agua y junto al tambor
      for (const [x, z, r] of [[LUG.pilon[0], LUG.pilon[1], 0.7], [LUG.tambor[0], LUG.tambor[1], 0.65]]) {
        const [a, b] = P(x, z); const gr = ctx.createRadialGradient(a, b, 0, a, b, r * k);
        gr.addColorStop(0, 'rgba(52,44,34,0.45)'); gr.addColorStop(1, 'rgba(52,44,34,0)'); ctx.fillStyle = gr; mancha(ctx, a, b, r * k, gr, 0.4);
      }
      // derrames de hormigón al pie de la cisterna (del hormigonado)
      ctx.filter = 'blur(1px)';
      for (let i = 0; i < 6; i++) { const a = azar() * 6.28, d = 2.4 + azar() * 0.9; const [x, z] = P(Math.cos(a) * d, Math.sin(a) * d); mancha(ctx, x, z, (0.1 + azar() * 0.2) * k, 'rgba(146,140,128,0.34)', 0.5); }
      ctx.filter = 'none';
      // trozos de hormigón seco y piedras sueltas
      for (let i = 0; i < 220; i++) { const [x, z] = P(al(-7, 7), al(-7, 7)); ctx.fillStyle = azar() < 0.4 ? 'rgba(166,158,144,0.42)' : 'rgba(76,68,58,0.34)'; ctx.beginPath(); ctx.arc(x, z, 0.4 + azar() * 0.7, 0, 6.28); ctx.fill(); }
      const t = texDe(c, { repetir: false });
      return t;
    }
    const matSuelo = new THREE.MeshStandardMaterial({ map: texturaSuelo(), transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    kit.malla(new THREE.PlaneGeometry(14.4, 14.4), matSuelo, { rx: -Math.PI / 2, y: 0.02, sombra: false, padre: g });

    // ------------------------------------------------------------------ cisterna
    const muro = texturaMuro();
    const concreto = new THREE.MeshStandardMaterial({ map: muro.map, normalMap: muro.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.93, vertexColors: true });
    const cuerpo = kit.malla(new THREE.BufferGeometry(), concreto, { padre: g });

    // Prismas de hormigón con las aristas achaflanadas, como salen de un moldaje con junquillo de 45°.
    // Contorno cuadrado de semilado e con las esquinas cortadas en c: cara +x, chaflán, +z, chaflán, −x, chaflán, −z, chaflán.
    const contorno = (e, c) => [[e, -(e - c)], [e, e - c], [e - c, e], [-(e - c), e], [-e, e - c], [-e, -(e - c)], [-(e - c), -e], [e - c, -e]];
    const normalLado = (a, b) => {
      let nx = b[1] - a[1], nz = a[0] - b[0];
      const l = Math.hypot(nx, nz); nx /= l; nz /= l;
      if (nx * (a[0] + b[0]) + nz * (a[1] + b[1]) < 0) { nx = -nx; nz = -nz; }
      return [nx, nz];
    };
    // contorno paralelo hacia afuera (d > 0) o hacia adentro (d < 0)
    const desplazar = (pts, d) => {
      const N = pts.length, ns = pts.map((p, k) => normalLado(p, pts[(k + 1) % N]));
      return pts.map((p, k) => { const n1 = ns[(k + N - 1) % N], n2 = ns[k], f = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]); return [p[0] + f * (n1[0] + n2[0]), p[1] + f * (n1[1] + n2[1])]; });
    };
    // geometría por partes con normales planas, uv y color por vértice
    function acumulador() {
      const A = { p: [], n: [], uv: [], c: [], i: [] }, pa = V(), pb = V(), pc = V();
      const de = (k, v) => v.set(A.p[k * 3], A.p[k * 3 + 1], A.p[k * 3 + 2]);
      A.v = (x, y, z, n, u, v, col) => { A.p.push(x, y, z); A.n.push(n[0], n[1], n[2]); A.uv.push(u, v); A.c.push(col[0], col[1], col[2]); return A.p.length / 3 - 1; };
      const hacia = (a, b, c2, n) => { de(a, pa); de(b, pb).sub(pa); de(c2, pc).sub(pa); pb.cross(pc); return pb.x * n[0] + pb.y * n[1] + pb.z * n[2] >= 0; };
      A.tri = (a, b, c2, n) => { if (hacia(a, b, c2, n)) A.i.push(a, b, c2); else A.i.push(a, c2, b); };
      A.cuad = (a0, b0, a1, b1, n) => { if (hacia(a0, b0, a1, n)) A.i.push(a0, b0, b1, a0, b1, a1); else A.i.push(a0, b1, b0, a0, a1, b1); };
      A.geo = () => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(A.p, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(A.n, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(A.c, 3));
        geo.setIndex(A.i);
        return geo;
      };
      return A;
    }
    // Prisma entre ya e yb con chaflán c en las aristas verticales y en las superiores; hueco > 0 lo deja abierto por dentro
    // (los muros). Cada cara empieza en una junta de placa y toma otra placa del atlas de 2,44 × 4,88 m.
    function prisma(A, { e, c, ya, yb, hueco = 0, filas, color }) {
      const ext = contorno(e, c), N = ext.length, ns = ext.map((p, k) => normalLado(p, ext[(k + 1) % N])), ins = desplazar(ext, -c);
      const ys = [...new Set(filas.map((f) => Math.min(ya + f, yb - c)))].sort((a, b) => a - b);
      const vDe = (y, vo) => (y - ya) / 4.88 + vo, s2 = Math.SQRT1_2;
      const lados = (pts, nDe, u0, vo, ysL, tope, nTope) => {
        let u = u0;
        for (let k = 0; k < pts.length; k++) {
          const a = pts[k], b = pts[(k + 1) % pts.length], n = nDe(k);
          if (pts.length === N && k % 2 === 0) { u = 0.5 * ((k >> 1) % 2); vo = 0.5 * (k >> 2); }
          else if (pts.length === 4) { u = 0.5 * (k % 2); vo = 0.5 * (k >> 1); }
          const u1 = u + Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.44;
          let prev = null;
          for (const y of ysL) {
            const col = color(y), fila = [A.v(a[0], y, a[1], n, u, vDe(y, vo), col), A.v(b[0], y, b[1], n, u1, vDe(y, vo), col)];
            if (prev) A.cuad(prev[0], prev[1], fila[0], fila[1], n);
            prev = fila;
          }
          // chaflán superior: de la arista a yb − c hasta el contorno corrido c a la altura yb
          const ta = tope[k], tb = tope[(k + 1) % pts.length], nc = nTope(n), y1 = yb - c, c1 = color(y1), c2 = color(yb);
          A.cuad(A.v(a[0], y1, a[1], nc, u, vDe(y1, vo), c1), A.v(b[0], y1, b[1], nc, u1, vDe(y1, vo), c1),
            A.v(ta[0], yb, ta[1], nc, u, vDe(yb, vo), c2), A.v(tb[0], yb, tb[1], nc, u1, vDe(yb, vo), c2), nc);
          u = u1;
        }
      };
      lados(ext, (k) => [ns[k][0], 0, ns[k][1]], 0, 0, ys, ins, (n) => [n[0] * s2, s2, n[2] * s2]);
      const arriba = [0, 1, 0], cTop = color(yb);
      if (hueco > 0) {
        const inn = [[hueco, -hueco], [hueco, hueco], [-hueco, hueco], [-hueco, -hueco]], hoyo = desplazar(inn, c);
        const tris = THREE.ShapeUtils.triangulateShape(ins.map(([x, z]) => new THREE.Vector2(x, z)), [hoyo.map(([x, z]) => new THREE.Vector2(x, z))]);
        const base = [...ins, ...hoyo].map(([x, z]) => A.v(x, yb, z, arriba, x / 2.44, z / 2.44, cTop));
        for (const [i0, i1, i2] of tris) A.tri(base[i0], base[i1], base[i2], arriba);
        // caras interiores, mirando al centro
        const nsI = inn.map((p, k) => normalLado(p, inn[(k + 1) % 4]));
        const ysI = [...new Set([ya, ...ys.filter((y) => y > ya)])];
        lados(inn, (k) => [-nsI[k][0], 0, -nsI[k][1]], 0, 0, ysI, hoyo, (n) => [n[0] * s2, s2, n[2] * s2]);
      } else {
        const centro = A.v(0, yb, 0, arriba, 0, 0, cTop), anillo = ins.map(([x, z]) => A.v(x, yb, z, arriba, x / 2.44, z / 2.44, cTop));
        for (let k = 0; k < N; k++) A.tri(centro, anillo[k], anillo[(k + 1) % N], arriba);
      }
    }
    // color por altura: barro suave al pie (la calcomanía pone las salpicaduras) y algo de suciedad en el coronamiento
    const colorMuro = (yc) => (y) => {
      const barro = 1 - suave(0.1, 0.5, y), tope = 1 - 0.1 * suave(yc - 0.5, yc, y);
      return [(1 - 0.16 * barro) * tope, (1 - 0.19 * barro) * tope, (1 - 0.24 * barro) * tope];
    };
    const colorRadier = (y) => { const b = 1 - suave(0, 0.12, y); return [0.86 - 0.2 * b, 0.84 - 0.22 * b, 0.8 - 0.25 * b]; };

    // franja de barro al pie de los muros y suelo húmedo alrededor del radier (una sola malla transparente)
    const matSucio = new THREE.MeshStandardMaterial({ map: texturaSucio(), transparent: true, depthWrite: false, roughness: 0.96, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const sucio = kit.malla(new THREE.BufferGeometry(), matSucio, { sombra: false, padre: g });
    sucio.renderOrder = 2;
    function geoSucio(e2, eR, y0, yc) {
      const A = acumulador(), bl = [1, 1, 1], arriba = [0, 1, 0];
      const m = desplazar(contorno(e2, 0.025), 0.003), r0 = contorno(eR, 0.02), r1 = desplazar(r0, 0.75), alto = Math.min(0.6, yc - y0 - 0.06);
      const vM = 1 - 127.5 / 256, vT = vM + (1 - 0.5 / 256 - vM) * (alto / 0.6), vR = 1 - 128.5 / 256, vF = 0.5 / 256, yS = 0.026;
      let u = 0, uR = 0;
      for (let k = 0; k < m.length; k++) {
        const a = m[k], b = m[(k + 1) % m.length], on = normalLado(a, b), n = [on[0], 0, on[1]], u1 = u + Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.4;
        A.cuad(A.v(a[0], y0, a[1], n, u, vM, bl), A.v(b[0], y0, b[1], n, u1, vM, bl), A.v(a[0], y0 + alto, a[1], n, u, vT, bl), A.v(b[0], y0 + alto, b[1], n, u1, vT, bl), n);
        u = u1;
        const p = r0[k], q = r0[(k + 1) % m.length], P1 = r1[k], Q1 = r1[(k + 1) % m.length], uR1 = uR + Math.hypot(q[0] - p[0], q[1] - p[1]) / 2.4;
        A.cuad(A.v(p[0], yS, p[1], arriba, uR, vR, bl), A.v(q[0], yS, q[1], arriba, uR1, vR, bl), A.v(P1[0], yS, P1[1], arriba, uR, vF, bl), A.v(Q1[0], yS, Q1[1], arriba, uR1, vF, bl), arriba);
        uR = uR1;
      }
      return A.geo();
    }

    // agua (se ve con la tapa abierta)
    const nrm = kit.makeSurface('noiseNormal', { size: 256, seed: 21, repeat: [2, 2], roughness: false }).normalMap;
    const superficie = kit.malla(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x2c6f93, roughness: 0.04, metalness: 0, normalMap: nrm, transparent: true, opacity: 0.9, envMapIntensity: 1.6 }), { rx: -Math.PI / 2, padre: g, sombra: false });

    // tapa de plancha diamantada con faldón, registro, manillas y bisagras (gira sobre el borde de atrás)
    const plancha = texturaPlancha();
    const acero = new THREE.MeshStandardMaterial({ map: plancha.map, normalMap: plancha.normal, metalness: 0.72, roughness: 0.44 });
    const pivoteTapa = new THREE.Group(); g.add(pivoteTapa);
    const tapa = kit.malla(new THREE.BufferGeometry(), acero, { padre: pivoteTapa });
    function geoTapa(e) {
      const p = [];
      p.push(ubicar(new THREE.BoxGeometry(e + 0.016, 0.012, e + 0.016), 0, 0.006, e / 2));
      for (const z of [-0.005, e + 0.005]) p.push(ubicar(new THREE.BoxGeometry(e + 0.016, 0.06, 0.006), 0, -0.024, z));
      for (const x of [-e / 2 - 0.005, e / 2 + 0.005]) p.push(ubicar(new THREE.BoxGeometry(0.006, 0.06, e + 0.016), x, -0.024, e / 2));
      // registro de inspección
      const r = Math.min(0.6, e * 0.42), rx = e * 0.18, rz = e * 0.56;
      p.push(ubicar(new THREE.BoxGeometry(r, 0.01, r), rx, 0.017, rz));
      for (const dx of [-0.08, 0.08]) p.push(ubicar(new THREE.BoxGeometry(0.014, 0.034, 0.014), rx + dx, 0.035, rz + r / 2 - 0.06));
      p.push(viga(V(rx - 0.09, 0.054, rz + r / 2 - 0.06), V(rx + 0.09, 0.054, rz + r / 2 - 0.06), 0.016, 0.016));
      for (const dx of [-r / 3, r / 3]) p.push(ubicar(new THREE.CylinderGeometry(0.011, 0.011, 0.07, 8), rx + dx, 0.024, rz - r / 2 - 0.008, 0, 0, Math.PI / 2));
      // bisagras principales
      for (const f of [-0.36, 0, 0.36]) p.push(ubicar(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 10), f * e, 0.004, -0.014, 0, 0, Math.PI / 2));
      // manillas del borde delantero
      for (const f of [-0.3, 0.3]) {
        p.push(ubicar(new THREE.BoxGeometry(0.014, 0.05, 0.014), f * e - 0.07, 0.035, e - 0.07));
        p.push(ubicar(new THREE.BoxGeometry(0.014, 0.05, 0.014), f * e + 0.07, 0.035, e - 0.07));
        p.push(viga(V(f * e - 0.077, 0.064, e - 0.07), V(f * e + 0.077, 0.064, e - 0.07), 0.016, 0.016));
      }
      // ventilación de acero galvanizado con cuello de ganso (la boca mira hacia abajo para que no entre lluvia)
      const vx = -e * 0.3, vz = e * 0.28;
      p.push(ubicar(new THREE.CylinderGeometry(0.058, 0.058, 0.01, 14), vx, 0.017, vz));
      p.push(ubicar(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 12, 1, true), vx, 0.15, vz));
      p.push(ubicar(new THREE.TorusGeometry(0.065, 0.03, 8, 10, Math.PI), vx + 0.065, 0.29, vz));
      p.push(ubicar(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 12), vx + 0.13, 0.255, vz));
      p.push(ubicar(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 12), vx + 0.13, 0.222, vz));
      for (const gp of p) {
        const pos = gp.attributes.position, nn = gp.attributes.normal, uv = gp.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          if (Math.abs(nn.getY(i)) > 0.5) uv.setXY(i, x / 0.3, z / 0.3);
          else if (Math.abs(nn.getX(i)) > 0.5) uv.setXY(i, z / 0.3, y / 0.3);
          else uv.setXY(i, x / 0.3, y / 0.3);
        }
      }
      return kit.mergeGeometries(p);
    }

    // escalera telescópica de aluminio apoyada en el muro de adelante, a la izquierda (o en el suelo junto al muro derecho si la cisterna es baja)
    const matEscalera = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.42 });
    const escalera = kit.malla(new THREE.BufferGeometry(), matEscalera, { padre: g });
    function geoEscalera(ext, L, Hrim) {
      const SEC = 2.4, EXTMAX = 2.1, ANG = 1.309, c = Math.cos(ANG), sn = Math.sin(ANG);
      const tope = Hrim - 0.1, apoyada = tope >= SEC * sn;
      const largo = apoyada ? Math.min(SEC + EXTMAX, tope / sn) : SEC;
      const tf = apoyada ? -0.075 : 0.075;
      let B, d, w, t;
      if (apoyada) { d = V(0, sn, -c); w = V(1, 0, 0); t = V(0, c, sn); B = V(-L / 2 + 0.29, 0, ext / 2 + 0.04 + largo * c + 0.075 * sn); }
      else { d = V(0, 0, 1); w = V(1, 0, 0); t = V(0, 1, 0); B = V(ext / 2 + 0.78, 0.036, -SEC / 2 - 0.2); }
      const P = (sv, ww, tt) => B.clone().addScaledVector(d, sv).addScaledVector(w, ww).addScaledVector(t, tt);
      const p = [];
      const pon = (geo, hex, v = 0.03) => p.push(sinUV(pintar(geo, hex, v)));
      const seccion = (s0, s1, mitad, tt) => {
        for (const sg of [-1, 1]) pon(viga(P(s0, sg * mitad, tt), P(s1, sg * mitad, tt), 0.026, 0.07, w), 0xc9cdd1);
        for (let sv = s0 + 0.24; sv < s1 - 0.08; sv += 0.28) pon(tubo(P(sv, -mitad, tt), P(sv, mitad, tt), 0.015, 8), 0xb9bdc1);
      };
      const f0 = Math.max(largo - SEC, apoyada ? 0.1 : 0);
      seccion(0, SEC, 0.215, 0);
      seccion(f0, largo, 0.183, tf);
      for (const sg of [-1, 1]) {
        pon(viga(P(0, sg * 0.215, 0), P(0.075, sg * 0.215, 0), 0.05, 0.095, w), 0x1c1c1c); // zapatas de goma
        pon(viga(P(SEC - 0.11, sg * 0.2, tf / 2), P(SEC - 0.02, sg * 0.2, tf / 2), 0.05, 0.12, w), 0x5d6166); // guías
        pon(viga(P(largo - 0.05, sg * 0.183, tf), P(largo, sg * 0.183, tf), 0.03, 0.075, w), 0x26282a); // tapas
      }
      pon(viga(P(1.05, -0.231, 0), P(1.4, -0.231, 0), 0.004, 0.05, w), 0xe5b318); // etiqueta de seguridad
      pon(tubo(P(f0 + 0.3, 0, tf * 0.5), P(SEC - 0.06, 0, tf * 0.5), 0.005, 5), 0x2c3e66);
      pon(tubo(P(SEC - 0.06, 0, tf * 0.5), P(1.0, 0.05, tf * 0.3), 0.005, 5), 0x2c3e66);
      return kit.mergeGeometries(p);
    }

    // cotas
    const cotaMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    const cotaX = kit.barra([0, 0, 0], [0, 1, 0], 0.015, cotaMat), cotaH = kit.barra([0, 0, 0], [0, 1, 0], 0.015, cotaMat);
    cotaX.castShadow = cotaH.castShadow = false;
    g.add(cotaX, cotaH);
    const cotaRef = kit.malla(new THREE.BufferGeometry(), cotaMat, { sombra: false, padre: g });

    // llave de bola de bronce en la pasada de desagüe y pasada de rebalse de PVC, en el muro izquierdo (el que ve el escritorio)
    const accesorios = kit.malla(new THREE.BufferGeometry(), matVC, { sombra: false, padre: g });
    function geoAccesorios(L, e2, y0, yc) {
      const p = [], pon = (geo, hex, v = 0.03) => p.push(sinUV(pintar(geo, hex, v)));
      const PVC = 0xd6d7d2, BRONCE = 0xa8803a, SELLO = 0x9c988f, x0 = -e2;
      const yd = y0 + 0.17, zd = L / 2 - 0.3;
      pon(tubo(V(x0 + 0.004, yd, zd), V(x0 - 0.006, yd, zd), 0.05, 14), SELLO); // mortero de sello alrededor de la pasada
      pon(tubo(V(x0 + 0.02, yd, zd), V(x0 - 0.075, yd, zd), 0.034, 12), PVC);
      pon(tubo(V(x0 - 0.075, yd, zd), V(x0 - 0.1, yd, zd), 0.03, 6), BRONCE); // hexágono del terminal
      pon(ubicar(new THREE.SphereGeometry(0.036, 12, 8), x0 - 0.125, yd, zd), BRONCE);
      pon(tubo(V(x0 - 0.15, yd, zd), V(x0 - 0.175, yd, zd), 0.03, 6), BRONCE);
      pon(tubo(V(x0 - 0.175, yd, zd), V(x0 - 0.23, yd, zd), 0.021, 10), BRONCE);
      pon(tubo(V(x0 - 0.125, yd + 0.03, zd), V(x0 - 0.125, yd + 0.056, zd), 0.007, 6), 0x555555);
      pon(ubicar(new THREE.BoxGeometry(0.022, 0.012, 0.13), x0 - 0.125, yd + 0.062, zd + 0.05), 0xb3302a); // manilla atravesada: cerrada
      const yr = Math.max(y0 + 0.45, yc - 0.24), zr = -L / 4;
      pon(tubo(V(x0 + 0.004, yr, zr), V(x0 - 0.006, yr, zr), 0.056, 14), SELLO);
      pon(tubo(V(x0 + 0.02, yr, zr), V(x0 - 0.12, yr, zr), 0.04, 12), PVC);
      pon(tubo(V(x0 - 0.118, yr, zr), V(x0 - 0.123, yr, zr), 0.033, 12), 0x2a2a28); // boca del rebalse
      return kit.mergeGeometries(p);
    }
    // rótulos de cota siempre legibles, aunque la escalera o el asa queden delante (como las anotaciones de un modelo 3D)
    const lx = kit.etiqueta('x', 0.32, { bg: '#ffb347', color: '#1a1206', depthTest: false }), lh = kit.etiqueta('h', 0.32, { bg: '#ffb347', color: '#1a1206', depthTest: false });
    g.add(lx, lh);

    // asa para arrastrar la esquina y cambiar x
    const asaX = kit.malla(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff6a00, emissiveIntensity: 0.8 }), { padre: g });
    kit.arrastre(asaX, g, {
      normal: [0, 1, 0], punto: [0, 0.2, 0], cursor: 'grab', habilitado: est.habilitado,
      alMover: (p) => { s.tAsa = Math.max(s.tAsa, 1.4); fijarX(Math.max(Math.abs(p.x), Math.abs(p.z)) * 2 / dm); },
    });

    function fijarX(x) {
      const nuevo = Math.min(40, Math.max(10, Math.round(x * 2) / 2));
      if (nuevo !== s.x) s.tAsa = Math.max(s.tAsa, 1.4);
      s.x = nuevo; s.cambio = true;
    }

    // puntos que miran las personas (se mueven con la cisterna)
    const ojoMuro = new THREE.Object3D(), ojoAlto = new THREE.Object3D(), ojoSenal = new THREE.Object3D();
    g.add(ojoMuro, ojoAlto, ojoSenal);

    function construir() {
      const L = s.x * dm, H = M.h(s.x) * dm, ext = L + 2 * esp, y0 = esp, yc = y0 + H, e2 = ext / 2, eR = e2 + 0.06;
      cuerpo.geometry.dispose();
      const A = acumulador();
      prisma(A, { e: eR, c: 0.02, ya: 0, yb: esp, filas: [0, 0.04, esp], color: colorRadier });
      prisma(A, { e: e2, c: 0.025, ya: y0, yb: yc, hueco: L / 2, color: colorMuro(yc), filas: [0, 0.05, 0.18, 0.4, H * 0.5, Math.max(H * 0.7, H - 0.35), Math.max(H * 0.92, H - 0.08), H] });
      cuerpo.geometry = A.geo();
      sucio.geometry.dispose(); sucio.geometry = geoSucio(e2, eR, y0, yc);
      // accesorios: llave de desagüe y pasada de rebalse en el muro izquierdo
      accesorios.geometry.dispose(); accesorios.geometry = geoAccesorios(L, e2, y0, yc);
      const libre = Math.min(0.25, H * 0.15);
      superficie.scale.set(L - 0.004, L - 0.004, 1); superficie.position.set(0, yc - libre, 0);
      tapa.geometry.dispose(); tapa.geometry = geoTapa(ext);
      pivoteTapa.position.set(0, yc, -e2);
      escalera.geometry.dispose(); escalera.geometry = geoEscalera(ext, L, yc);
      // cotas a lo largo del borde frontal inferior y de la arista frontal derecha
      kit.moverBarra(cotaX, [-L / 2, 0.08, e2 + 0.35], [L / 2, 0.08, e2 + 0.35]);
      kit.moverBarra(cotaH, [e2 + 0.35, y0, e2 + 0.35], [e2 + 0.35, yc, e2 + 0.35]);
      // líneas de referencia desde la obra y trazos oblicuos en los extremos, como en un plano
      {
        const za = e2 + 0.35, xa = e2 + 0.35, p = [];
        for (const sx of [-1, 1]) {
          p.push(tubo(V(sx * L / 2, 0.08, eR + 0.03), V(sx * L / 2, 0.08, za + 0.1), 0.006, 6));
          p.push(tubo(V(sx * L / 2 - 0.055, 0.025, za), V(sx * L / 2 + 0.055, 0.135, za), 0.011, 6));
        }
        for (const y of [y0, yc]) {
          const d0 = y === y0 ? eR + 0.03 : e2 + 0.03;
          p.push(tubo(V(d0, y, d0), V(xa + 0.08, y, za + 0.08), 0.006, 6));
          p.push(tubo(V(xa - 0.055, y - 0.055, za), V(xa + 0.055, y + 0.055, za), 0.011, 6));
        }
        cotaRef.geometry.dispose(); cotaRef.geometry = kit.mergeGeometries(p.map(sinUV));
      }
      // el rótulo de x va algo más alto que el asa para que, desde el escritorio, la esfera no le tape la letra
      kit.cambiarEtiqueta(lx, `x = ${kit.num(s.x, 1)} dm`); lx.position.set(Math.min(L / 2, L / 4 + 0.12), 0.8, e2 + 0.45);
      // con h baja el rótulo sube sobre la arista: así no se junta con el de x ni queda tras el gráfico de VR
      kit.cambiarEtiqueta(lh, `h = ${kit.num(M.h(s.x), 1)} dm`); lh.position.set(e2 + 0.55, H >= 2.2 ? y0 + H / 2 : y0 + H + 0.4, e2 + 0.55);
      asaX.position.set(L / 2 + esp, 0.2, L / 2 + esp);
      ojoMuro.position.set(-e2 + 0.15, y0 + Math.min(H * 0.45, 1.45), Math.min(e2 * 0.7, 0.9));
      ojoAlto.position.set(-e2 + 0.1, yc, Math.min(e2 * 0.4, 0.5));
      ojoSenal.position.set(-e2, y0 + Math.min(H * 0.75, 2.5), -0.1 * L);
      dibujarPantalla();
    }

    // ------------------------------------------------------------------ personas
    const POSES = kit.POSES;
    // obrero que revisa la cisterna con una tableta
    const inspector = kit.persona({
      preset: 'obrero', semilla: 12, padre: g, x: LUG.inspector[0], z: LUG.inspector[1], ry: LUG.inspector[2],
      superior: 'parka', colorSuperior: '#4a5641', inferior: 'jeans', colorInferior: '#33435a', barba: 'sombra', pelo: 'corto',
      colorPelo: kit.PELOS.castanoOscuro, piel: kit.PIELES[2], altura: 1.75,
    });
    inspector.transicion(0.01).posar({ ...POSES.tableta(), cuello: [0.06, 0, 0], cabeza: [0, 0, 0] });
    inspector.actualizar(0.05); inspector.transicion(0.5);
    // tableta del ancho que dejan las manos, con la pantalla hacia arriba
    const vA = V(), vB = V();
    inspector.manoD.getWorldPosition(vA); inspector.manoI.getWorldPosition(vB);
    const anchoTab = Math.min(0.34, Math.max(0.24, vA.distanceTo(vB)));
    const [cPant, ctxPant] = lienzo(256, 192);
    const texPant = texDe(cPant, { repetir: false });
    texPant.center.set(0.5, 0.5); texPant.rotation = Math.PI;
    const tabGeo = new THREE.BoxGeometry(anchoTab, 0.013, 0.2);
    { const uv = tabGeo.attributes.uv; for (let i = 0; i < uv.count; i++) if (i < 8 || i >= 12) uv.setXY(i, 0.02, 0.02); }
    const tableta = kit.malla(tabGeo, new THREE.MeshStandardMaterial({ map: texPant, emissive: 0xffffff, emissiveMap: texPant, emissiveIntensity: 0.55, roughness: 0.35 }), { padre: g, sombra: false });
    const arribaTab = V(0, 0.8, -0.6).applyQuaternion(inspector.grupo.getWorldQuaternion(new THREE.Quaternion())).normalize();
    inspector.sostener(tableta, { D: [-anchoTab / 2, 0, 0], I: [anchoTab / 2, 0, 0], arriba: [0, 1, 0], arribaMundo: [arribaTab.x, arribaTab.y, arribaTab.z] });
    function dibujarPantalla() {
      const W = 256, H = 192, c = ctxPant, xL = s.x, hL = M.h(s.x);
      c.fillStyle = '#121519'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#e9edf2'; c.fillRect(10, 10, W - 20, H - 20);
      c.fillStyle = '#1f3d63'; c.fillRect(10, 10, W - 20, 26);
      c.fillStyle = '#fff'; c.font = kit.font(13, 700); c.textAlign = 'left'; c.fillText('Inspección · Cisterna C-1', 18, 28);
      // corte de la cisterna a escala
      const esc = 110 / Math.max(xL, hL), bw = xL * esc, bh = hL * esc, ox = 22, oy = 160;
      c.fillStyle = '#b9c3cc'; c.fillRect(ox, oy - bh, bw, bh);
      c.strokeStyle = '#33404d'; c.lineWidth = 2; c.strokeRect(ox, oy - bh, bw, bh);
      c.fillStyle = '#2f7fb0'; c.fillRect(ox + 2, oy - bh * 0.85, bw - 4, bh * 0.85 - 2);
      c.fillStyle = '#ff8a1f'; c.fillRect(ox, oy + 6, bw, 3);
      c.fillStyle = '#26323e'; c.font = kit.font(12, 700);
      c.fillText(`x = ${kit.num(xL, 1)} dm`, 140, 70);
      c.fillText(`h = ${kit.num(hL, 1)} dm`, 140, 92);
      c.font = kit.font(11, 500); c.fillStyle = '#4b5966';
      c.fillText(`V = ${kit.num(xL * xL * hL, 0)} dm³`, 140, 114);
      c.fillText('Moldaje retirado  ✓', 140, 140);
      c.fillText('Curado en curso', 140, 158);
      texPant.needsUpdate = true;
    }

    // capataz que explica con los planos enrollados en la mano izquierda
    const BASE_CAP = {
      ...POSES.reposo(),
      columna: [0.02, -0.04, 0], pecho: [-0.03, -0.02, 0],
      musloI: [-0.05, 0, 0.07], piernaI: [0.09, 0, 0], pieI: [-0.04, 0, -0.04],
      brazoI: [-0.06, 0, 0.13], antebrazoI: [-0.62, 0, 0], manoI: [0.12, 0, -0.12], dedosI: 0.92,
    };
    const DUR_EXPLICAR = 7.2;
    const senala = (t) => suave(3.05, 3.45, t) * (1 - suave(4.75, 5.15, t));
    const CLIP_EXPLICAR = {
      duracion: DUR_EXPLICAR, bucle: true,
      fn(t) {
        const a = suave(0.3, 0.9, t) * (1 - suave(2.6, 3.1, t)), sn = senala(t);
        const golpe = Math.sin(t * Math.PI * 2 * 1.35) * 0.12 * a;
        return {
          ...BASE_CAP,
          brazoD: [0.06 - 0.4 * a, 0.18 * a, -0.07 - 0.1 * a],
          antebrazoD: [-0.28 - 1.1 * a + golpe, 0, 0],
          manoD: [0.08 * a, -0.85 * a, 0.1],
          dedosD: sn > 0.001 ? { c: 0.22 + 0.68 * sn, indice: 0.22 - 0.18 * sn } : 0.22 - 0.1 * a,
          cabeza: [-0.05 + 0.04 * Math.sin(t * 5.2) * a, 0, 0],
        };
      },
    };
    const capataz = kit.persona({
      preset: 'capataz', semilla: 31, padre: g, x: LUG.capataz[0], z: LUG.capataz[1], ry: LUG.capataz[2],
      pelo: 'entradas', colorPelo: kit.PELOS.canoso, barba: 'bigote', piel: kit.PIELES[3], altura: 1.76,
    });
    capataz.transicion(0.01).posar(BASE_CAP); capataz.actualizar(0.05); capataz.transicion(0.5);
    capataz.reproducir(CLIP_EXPLICAR, { bucle: true });
    {
      const p = [];
      p.push(pintar(ubicar(new THREE.CylinderGeometry(0.034, 0.034, 0.6, 14), 0, 0, 0, Math.PI / 2), 0xeceef1, 0));
      p.push(pintar(ubicar(new THREE.TorusGeometry(0.035, 0.004, 5, 16), 0, 0, 0.19), 0xb3332b, 0));
      p.push(pintar(ubicar(new THREE.TorusGeometry(0.035, 0.004, 5, 16), 0, 0, -0.17), 0xb3332b, 0));
      const planos = kit.malla(kit.mergeGeometries(p.map(sinUV)), matVC, {});
      capataz.manoI.add(planos);
    }

    // obrera que carga la betonera con pala
    const palera = kit.persona({
      preset: 'obrera', semilla: 7, padre: g, x: LUG.palera[0], z: LUG.palera[1], ry: LUG.palera[2],
      colorSuperior: '#7d3a2c', manga: 'larga', guantes: '#b8894c', casco: '#ffd23a', piel: kit.PIELES[4],
    });
    palera.actualizar(0.05);
    // pala de punta huevo: mango en +y, hoja hacia -y con la cara cóncava hacia +z
    function geoPala() {
      const p = [];
      const nu = 6, nv = 8;
      for (const lado of [1, -1]) {
        const pos = [], col = [], idx = [];
        for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
          const u = (i / nu) * 2 - 1, v = j / nv;
          const w = 0.125 * (v < 0.55 ? 1 : Math.sqrt(Math.max(0, 1 - ((v - 0.55) / 0.46) ** 2)) * 0.97 + 0.03);
          pos.push(u * w, -v * 0.3, 0.028 * u * u + 0.012 * v - (lado < 0 ? 0.003 : 0));
          const gasto = v > 0.82 || Math.abs(u) > 0.88 ? 1 : 0;
          if (gasto) col.push(0.5, 0.5, 0.5); else col.push(0.13, 0.13, 0.14);
        }
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
          const a = j * (nu + 1) + i, b = a + 1, c2 = a + nu + 1, d2 = c2 + 1;
          if (lado > 0) idx.push(a, c2, b, b, c2, d2); else idx.push(a, b, c2, b, d2, c2);
        }
        const hoja = new THREE.BufferGeometry();
        hoja.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        hoja.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        hoja.setIndex(idx); hoja.computeVertexNormals(); hoja.rotateX(-0.22);
        p.push(hoja);
      }
      p.push(sinUV(pintar(tubo(V(0, -0.03, 0.005), V(0, 0.15, 0), 0.021, 10), 0x26282a, 0)));
      p.push(sinUV(pintar(tubo(V(0, 0.12, 0), V(0, 1.2, 0), 0.0175, 10), 0xb38d5f, 0.05)));
      p.push(sinUV(pintar(tubo(V(0, 1.2, 0), V(0, 1.215, 0), 0.0155, 10), 0x8a6a46, 0)));
      return kit.mergeGeometries(p);
    }
    const pala = kit.malla(geoPala(), matVC, { padre: g });
    palera.sostener(pala, { D: [0, 0.5, 0], I: [0, 1.12, 0], arriba: [0, 0, 1] });
    palera.actualizar(0.01);

    // ------------------------------------------------------------------ montón de árido delante de la obrera
    const matArido = kit.mat('gravel', { repeat: [1, 1], color: 0xc8b89c, roughness: 1, normalScale: 0.85 });
    const pilaC = enEstacion(palera.grupo, V(0.05, 0, 1.68));
    {
      const aPal = Math.atan2(LUG.palera[1] - pilaC.z, LUG.palera[0] - pilaC.x); // hacia la obrera, en el plano xz
      const geo = disco(0.72, 9, 40, (r, a) => {
        const dif = Math.atan2(Math.sin(a - aPal), Math.cos(a - aPal));
        const hueco = 1 - 0.5 * Math.exp(-(dif * dif) / 0.3) * suave(0.25, 0.75, r);
        return Math.max(0, 0.5 * (1 - r * r) ** 1.3 * hueco * (1 + 0.06 * Math.sin(5 * a)) - 0.01);
      }, 0.3, 0.1);
      // el disco tiene a en sentido x → z; aPal se calculó igual
      kit.malla(geo, matArido, { x: pilaC.x, y: 0.005, z: pilaC.z, padre: g });
    }
    // arena sobre la hoja y terrón que vuela al tambor
    const terronGeo = new THREE.SphereGeometry(0.085, 10, 6); terronGeo.scale(1, 0.38, 0.85);
    const arenaPala = kit.malla(terronGeo, matArido, { y: -0.11, z: 0.035, rx: -0.22, sombra: false, padre: pala });
    arenaPala.visible = false;
    const terron = kit.malla(terronGeo, matArido, { sombra: false, padre: g });
    terron.visible = false;
    const puntaPala = new THREE.Object3D(); puntaPala.position.set(0, -0.12, 0.03); pala.add(puntaPala);

    // ------------------------------------------------------------------ betonera: la boca queda donde la obrera suelta la carga
    const matTambor = new THREE.MeshStandardMaterial({ map: texturaTambor(), vertexColors: true, roughness: 0.55, metalness: 0.25 });
    const bocaObj = enEstacion(palera.grupo, V(-0.95, 1.13, 0.72));
    const uBet = V(LUG.palera[0] - bocaObj.x, 0, LUG.palera[1] - bocaObj.z).normalize();
    const yawBet = Math.atan2(-uBet.z, uBet.x);
    const Pm = bocaObj.clone().addScaledVector(uBet, -0.39); Pm.y = 0;
    const MB = new THREE.Matrix4().compose(Pm, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yawBet), UNO);
    const beta = 0.49, ejeT = V(Math.cos(beta), Math.sin(beta), 0), Pv = V(0, 0.92, 0);
    {
      const pz = [];
      const add = (geo, hex, v = 0.05) => pz.push(sinUV(pintar(geo, hex, v)));
      const nar = 0xc9531c, osc = 0x34363a, neg = 0x1b1b1b;
      for (const z of [-0.45, 0.45]) add(viga(V(-0.75, 0.2, z), V(0.55, 0.2, z), 0.05, 0.05), nar);
      for (const x of [-0.75, -0.2, 0.55]) add(viga(V(x, 0.2, -0.47), V(x, 0.2, 0.47), 0.05, 0.05), nar);
      for (const z of [-0.42, 0.42]) { add(tubo(V(0.5, 0.2, z), V(0.5, 0.02, z), 0.022, 8), nar); add(ubicar(new THREE.BoxGeometry(0.12, 0.012, 0.12), 0.5, 0.006, z), osc); }
      for (const z of [-0.6, 0.6]) {
        add(ubicar(new THREE.TorusGeometry(0.162, 0.05, 8, 22), -0.2, 0.212, z), neg, 0.02);
        add(ubicar(new THREE.CylinderGeometry(0.125, 0.125, 0.07, 16), -0.2, 0.212, z, Math.PI / 2), 0x9a9c98);
        add(ubicar(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 10), -0.2, 0.212, z, Math.PI / 2), osc);
      }
      add(tubo(V(-0.2, 0.212, -0.62), V(-0.2, 0.212, 0.62), 0.016, 8), osc);
      for (const z of [-0.3, 0.3]) add(tubo(V(-0.75, 0.2, z), V(-1.08, 0.52, z * 0.35), 0.02, 8), nar);
      add(tubo(V(-1.1, 0.53, -0.17), V(-1.1, 0.53, 0.17), 0.024, 8), neg);
      for (const z of [-0.47, 0.47]) {
        add(tubo(V(-0.38, 0.2, z), V(0, 0.9, z), 0.024, 8), nar);
        add(tubo(V(0.36, 0.2, z), V(0, 0.9, z), 0.024, 8), nar);
        add(ubicar(new THREE.BoxGeometry(0.09, 0.08, 0.07), 0, 0.92, z), osc);
      }
      const caja = Pv.clone().addScaledVector(ejeT, -0.36);
      for (const z of [-0.43, 0.43]) {
        const K = V(-0.22, 0.66, z * 0.98), Bq = caja.clone().add(V(0, 0, z * 0.45));
        add(tubo(V(0, 0.92, z), K, 0.022, 8), nar); add(tubo(K, Bq, 0.022, 8), nar);
      }
      add(ubicar(new THREE.BoxGeometry(0.14, 0.26, 0.26), caja.x, caja.y, caja.z, 0, 0, beta), osc);
      add(tubo(caja, Pv.clone().addScaledVector(ejeT, -0.25), 0.03, 10), osc);
      add(ubicar(new THREE.CylinderGeometry(0.095, 0.095, 0.26, 16), -0.42, 0.36, -0.08, Math.PI / 2), 0x5f6a72);
      add(ubicar(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), -0.42, 0.36, -0.235, Math.PI / 2), neg);
      add(ubicar(new THREE.BoxGeometry(0.08, 0.06, 0.08), -0.42, 0.47, -0.05), osc);
      add(ubicar(new THREE.BoxGeometry(0.3, 0.03, 0.36), -0.42, 0.24, -0.02), osc);
      add(ubicar(new THREE.BoxGeometry(0.2, 0.36, 0.05), -0.36, 0.5, 0.13, 0, 0, 0.35), nar);
      add(ubicar(new THREE.TorusGeometry(0.19, 0.012, 6, 24), 0, 0.92, 0.62), neg);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; add(tubo(V(0, 0.92, 0.62), V(Math.cos(a) * 0.19, 0.92 + Math.sin(a) * 0.19, 0.62), 0.008, 5), osc); }
      add(tubo(V(0, 0.92, 0.5), V(0, 0.92, 0.64), 0.02, 8), osc);
      const mez = new THREE.CircleGeometry(0.23, 18); mez.rotateX(-Math.PI / 2);
      const mc = Pv.clone().addScaledVector(ejeT, 0.04); ubicar(mez, mc.x, mc.y - 0.03, mc.z);
      add(mez, 0x77736c, 0);
      // cable eléctrico del motor que se va por el suelo
      const pts = [V(-0.42, 0.47, -0.05), V(-0.55, 0.3, -0.25), V(-0.7, 0.02, -0.45), V(-1.3, 0.016, -0.9), V(-1.9, 0.016, -0.6), V(-2.6, 0.016, -1.4), V(-3.6, 0.016, -1.2)];
      ponerSS(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.009, 5), 0xd2601c, 0.02).applyMatrix4(MB);
      for (const geo of pz) { geo.applyMatrix4(MB); vc.push(geo); }
    }
    // tambor que gira, con engranaje y aro de refuerzo
    const ejeTambor = new THREE.Group();
    ejeTambor.position.copy(Pv).applyMatrix4(MB);
    ejeTambor.quaternion.setFromAxisAngle(V(0, 1, 0), yawBet).multiply(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), ejeT));
    g.add(ejeTambor);
    function geoTambor() {
      const ext = [[0.02, 0], [0.2, 0], [0.27, 0.025], [0.315, 0.08], [0.33, 0.15], [0.33, 0.31], [0.315, 0.36], [0.25, 0.48], [0.19, 0.585], [0.175, 0.645], [0.185, 0.665], [0.19, 0.685]];
      const int = [[0.172, 0.69], [0.16, 0.672], [0.162, 0.64], [0.18, 0.585], [0.24, 0.48], [0.305, 0.36], [0.315, 0.31], [0.315, 0.15], [0.3, 0.085], [0.25, 0.035], [0.02, 0.02]];
      const pts = [...ext, ...int].map(([r, y]) => new THREE.Vector2(r, y));
      const seg = 28, n = pts.length, lat = new THREE.LatheGeometry(pts, seg);
      const uv = lat.attributes.uv, cnt = lat.attributes.position.count, col = new Float32Array(cnt * 3);
      for (let i = 0; i < cnt; i++) {
        const j = i % n, fuera = j < ext.length;
        uv.setXY(i, Math.floor(i / n) / seg, fuera ? 0.08 + 0.92 * (j / (ext.length - 1)) : 0.025);
        const k = fuera ? 1 : 0.42; col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k * 0.97;
      }
      lat.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const eng = new THREE.CylinderGeometry(0.35, 0.35, 0.036, 72, 1, false);
      { const p = eng.attributes.position, u2 = eng.attributes.uv; for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)); if (r > 0.3) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = Math.round((((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 72) % 2 ? 1 : 0.955; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } u2.setXY(i, 0.5, 0.02); } }
      eng.computeVertexNormals(); eng.translate(0, 0.11, 0); pintar(eng, 0x4a4a48, 0);
      const aro = new THREE.TorusGeometry(0.327, 0.012, 6, 32); aro.rotateX(Math.PI / 2); aro.translate(0, 0.335, 0);
      { const u2 = aro.attributes.uv; for (let i = 0; i < u2.count; i++) u2.setXY(i, i / u2.count, 0.5); } pintar(aro, 0xd9d0c8, 0);
      return kit.mergeGeometries([lat, eng, aro]);
    }
    const tambor = kit.malla(geoTambor(), matTambor, { y: -0.25, padre: ejeTambor });
    const boca = new THREE.Object3D(); boca.position.set(0, 0.42, 0); ejeTambor.add(boca);

    // ------------------------------------------------------------------ carretilla con hormigón
    {
      const pz = [];
      const add = (geo, hex, v = 0.05) => pz.push(sinUV(pintar(geo, hex, v)));
      const bat = new THREE.BoxGeometry(1, 1, 1);
      const p = bat.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const arriba = p.getY(i) > 0, delante = p.getX(i) > 0, sz = Math.sign(p.getZ(i));
        p.setXYZ(i, arriba ? (delante ? 0.5 : -0.44) : (delante ? 0.2 : -0.3), arriba ? 0.6 : 0.36, sz * (arriba ? 0.34 : 0.2));
      }
      bat.computeVertexNormals();
      pintar(bat, 0x3d6a48, 0.03);
      { const c = bat.attributes.color; for (let i = 8; i < 12; i++) c.setXYZ(i, 0.5, 0.49, 0.46); }
      pz.push(sinUV(bat));
      const T = [[0.5, 0.34], [-0.44, 0.34], [-0.44, -0.34], [0.5, -0.34]];
      for (let k = 0; k < 4; k++) add(tubo(V(T[k][0], 0.603, T[k][1]), V(T[(k + 1) % 4][0], 0.603, T[(k + 1) % 4][1]), 0.012, 6), 0x2f5238);
      add(ubicar(new THREE.TorusGeometry(0.15, 0.045, 8, 18), 0.64, 0.195, 0), 0x1a1a1a, 0.02);
      add(ubicar(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 12), 0.64, 0.195, 0, Math.PI / 2), 0x8d8f8c);
      for (const z of [-1, 1]) {
        add(tubo(V(0.64, 0.195, z * 0.05), V(0.24, 0.37, z * 0.2), 0.012, 6), 0x2b2d2f);
        add(tubo(V(0.32, 0.36, z * 0.21), V(-1.0, 0.56, z * 0.29), 0.016, 8), 0x2b2d2f);
        add(tubo(V(-0.84, 0.536, z * 0.276), V(-1.03, 0.565, z * 0.293), 0.021, 8), 0x161616);
        add(tubo(V(-0.26, 0.36, z * 0.23), V(-0.32, 0.0, z * 0.27), 0.013, 6), 0x2b2d2f);
      }
      add(tubo(V(-0.32, 0.02, -0.27), V(-0.32, 0.02, 0.27), 0.012, 6), 0x2b2d2f);
      const MC = new THREE.Matrix4().compose(V(LUG.carretilla[0], 0, LUG.carretilla[1]), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), LUG.carretilla[2]), UNO);
      for (const geo of pz) { geo.applyMatrix4(MC); vc.push(geo); }
    }

    // ------------------------------------------------------------------ tambor de agua, capachos, pilón y manguera
    {
      const perfil = [[0.001, 0.0], [0.27, 0.0], [0.29, 0.02], [0.29, 0.26], [0.3, 0.28], [0.29, 0.3], [0.29, 0.56], [0.3, 0.58], [0.29, 0.6], [0.29, 0.86], [0.28, 0.88], [0.27, 0.88], [0.27, 0.78], [0.001, 0.78]];
      const lat = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), 24);
      const n = perfil.length, cnt = lat.attributes.position.count, col = new Float32Array(cnt * 3);
      for (let i = 0; i < cnt; i++) { const j = i % n, agua = j >= n - 2; col.set(agua ? [0.16, 0.21, 0.22] : [0.13, 0.31, 0.6], i * 3); }
      lat.setAttribute('color', new THREE.BufferAttribute(col, 3));
      vc.push(sinUV(ubicar(lat, LUG.tambor[0], 0, LUG.tambor[1])));
      // capachos de goma con costra de hormigón (uno volcado)
      const capacho = () => {
        const pf = [[0.001, 0.0], [0.13, 0.0], [0.142, 0.015], [0.162, 0.27], [0.17, 0.285], [0.158, 0.29], [0.15, 0.275], [0.132, 0.05], [0.001, 0.05]];
        const l2 = new THREE.LatheGeometry(pf.map(([r, y]) => new THREE.Vector2(r, y)), 20), nn = pf.length, cn = l2.attributes.position.count, cc = new Float32Array(cn * 3);
        for (let i = 0; i < cn; i++) { const j = i % nn, costra = j >= 4; const k = costra ? [0.46, 0.45, 0.42] : [0.09, 0.09, 0.09]; if (j === 4 || j === 5) k.fill(0.38); cc.set(k, i * 3); }
        l2.setAttribute('color', new THREE.BufferAttribute(cc, 3));
        return sinUV(l2);
      };
      vc.push(ubicar(capacho(), -3.35, 0, -4.55, 0, 0.4, 0));
      vc.push(ubicar(capacho(), -2.35, 0.16, -4.75, 0, 1.1, Math.PI / 2 + 0.06));
      // pilón de agua con llave y dado de hormigón
      const [px, pzz] = LUG.pilon;
      ponerVC(ubicar(new THREE.BoxGeometry(0.24, 0.12, 0.24), px, 0.06, pzz), 0x9c988f);
      ponerVC(tubo(V(px, 0.1, pzz), V(px, 0.78, pzz), 0.022, 10), 0x9da3a6);
      ponerVC(ubicar(new THREE.SphereGeometry(0.028, 10, 8), px, 0.78, pzz), 0x9da3a6);
      ponerVC(tubo(V(px, 0.78, pzz), V(px + 0.1, 0.78, pzz), 0.02, 10), 0x9da3a6);
      ponerVC(ubicar(new THREE.BoxGeometry(0.06, 0.05, 0.05), px + 0.13, 0.775, pzz), 0xb08a3c);
      ponerVC(tubo(V(px + 0.15, 0.76, pzz), V(px + 0.15, 0.7, pzz), 0.012, 8), 0xb08a3c);
      ponerVC(tubo(V(px + 0.13, 0.8, pzz), V(px + 0.13, 0.84, pzz), 0.006, 6), 0x7a7a74);
      ponerVC(ubicar(new THREE.BoxGeometry(0.08, 0.01, 0.018), px + 0.13, 0.845, pzz, 0, 0.5, 0), 0xb3302a);
      // manguera desde la llave hasta el tambor, con una vuelta en el suelo
      const yS = 0.024;
      const pts = [V(px + 0.15, 0.7, pzz), V(px + 0.17, 0.4, pzz + 0.05), V(px + 0.25, yS, pzz + 0.25), V(px + 0.9, yS, pzz + 0.55), V(px + 1.35, yS, pzz + 0.15),
        V(px + 0.9, yS, pzz - 0.25), V(px + 0.35, yS, pzz + 0.05), V(px - 0.4, yS, pzz + 0.5), V(px - 1.3, yS, pzz + 0.45), V(px - 2.0, yS, pzz + 0.85),
        V(LUG.tambor[0] + 0.55, yS, LUG.tambor[1] - 0.15), V(LUG.tambor[0] + 0.33, 0.35, LUG.tambor[1] - 0.12), V(LUG.tambor[0] + 0.29, 0.9, LUG.tambor[1] - 0.08), V(LUG.tambor[0] + 0.18, 0.86, LUG.tambor[1] - 0.04), V(LUG.tambor[0] + 0.05, 0.74, LUG.tambor[1])];
      const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 150, 0.011, 5);
      const nm = tg.attributes.position.count, colM = new Float32Array(nm * 3);
      for (let i = 0; i < nm; i++) { const k = 0.85 + 0.15 * Math.sin(i * 0.013) + (tg.attributes.position.getY(i) < 0.04 ? -0.12 : 0); colM.set([0.17 * k, 0.43 * k, 0.2 * k], i * 3); }
      tg.setAttribute('color', new THREE.BufferAttribute(colM, 3));
      vcSS.push(sinUV(tg));
    }

    // ------------------------------------------------------------------ conos con cinta de peligro
    {
      const perfil = [];
      const rr = (y) => 0.145 - (0.115 * (y - 0.035)) / 0.665;
      for (const y of [0.035, 0.12, 0.3, 0.369, 0.371, 0.459, 0.461, 0.529, 0.531, 0.589, 0.591, 0.66, 0.7]) perfil.push(new THREE.Vector2(rr(y), y));
      perfil.push(new THREE.Vector2(0.001, 0.705));
      const blanco = (y) => (y > 0.37 && y < 0.46) || (y > 0.53 && y < 0.59);
      for (const [x, z] of LUG.conos) {
        const lat = new THREE.LatheGeometry(perfil, 16), n = perfil.length, cnt = lat.attributes.position.count, col = new Float32Array(cnt * 3);
        for (let i = 0; i < cnt; i++) { const y = perfil[i % n].y; col.set(blanco(y) ? [0.9, 0.9, 0.88] : [0.93, 0.36, 0.08], i * 3); }
        lat.setAttribute('color', new THREE.BufferAttribute(col, 3));
        vc.push(sinUV(ubicar(lat, x, 0, z, 0, azar(), 0)));
        ponerVC(ubicar(new THREE.BoxGeometry(0.38, 0.035, 0.38), x, 0.0175, z, 0, azar(), 0), 0x1d1d1d, 0.02);
      }
      // cinta entre cada par de conos, colgando un poco
      const matCinta = new THREE.MeshStandardMaterial({ map: texturaCinta(), side: THREE.DoubleSide, roughness: 0.55 });
      const tiras = [];
      for (const [a, b] of [[0, 1], [2, 3]]) {
        const A = V(LUG.conos[a][0], 0.64, LUG.conos[a][1]), B = V(LUG.conos[b][0], 0.64, LUG.conos[b][1]), largo = A.distanceTo(B);
        const pos = [], uv = [], idx = [], N = 18;
        for (let i = 0; i <= N; i++) {
          const t = i / N, p = A.clone().lerp(B, t); p.y -= 0.2 * 4 * t * (1 - t);
          pos.push(p.x, p.y + 0.037, p.z, p.x, p.y - 0.037, p.z); uv.push((t * largo) / 0.6, 1, (t * largo) / 0.6, 0);
          if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx); geo.computeVertexNormals(); tiras.push(geo);
      }
      kit.malla(kit.mergeGeometries(tiras), matCinta, { sombra: false, padre: g });
    }

    // ------------------------------------------------------------------ fierro de construcción: atados sobre durmientes, estribos y alambre
    function tabla(w, h, d, pos, rot, { fenolico = false, tono = 0xffffff } = {}) {
      const geo = new THREE.BoxGeometry(w, h, d), p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv, dims = [w, h, d];
      for (let f = 0; f < 6; f++) {
        const ax = Math.abs(n.getX(f * 4)) > 0.5 ? 0 : Math.abs(n.getY(f * 4)) > 0.5 ? 1 : 2;
        const [i1, i2] = ax === 0 ? [2, 1] : ax === 1 ? [0, 2] : [0, 1];
        const a = dims[i1], b = dims[i2], fen = fenolico && a > 0.1 && b > 0.1;
        const R = fen ? { u0: 0.5, u1: 1, RU: 1.22, RV: 2.44 } : { u0: 0, u1: 0.5, RU: 0.4, RV: 3.2 };
        const primero = a >= b, corto = primero ? b : a, largo = primero ? a : b;
        const fu = Math.min(corto / R.RU, 1), fv = Math.min(largo / R.RV, 1);
        const ou = (1 - fu) * azar(), ov = (1 - fv) * azar();
        for (let k = 0; k < 4; k++) {
          const i = f * 4 + k, cc = [p.getX(i), p.getY(i), p.getZ(i)];
          const s1 = cc[i1] / a + 0.5, s2 = cc[i2] / b + 0.5, sl = primero ? s1 : s2, sc2 = primero ? s2 : s1;
          uv.setXY(i, R.u0 + (ou + sc2 * fu) * (R.u1 - R.u0), ov + sl * fv);
        }
      }
      pintar(geo, tono, 0.08);
      return ubicar(geo, pos[0], pos[1], pos[2], rot[0], rot[1], rot[2]);
    }
    {
      const xs = [4.12, 4.5], z0 = -3.25, z1 = 1.25, largo = z1 - z0;
      for (const zz of [-2.75, -1.0, 0.75]) mad.push(tabla(0.62, 0.09, 0.09, [4.31, 0.045, zz], [0, al(-0.05, 0.05), 0], { tono: 0x9a8d7a }));
      const oxidos = [0x6e4430, 0x7a4b31, 0x5e3a2a, 0x845238, 0x6a4a3a];
      for (const xc of xs) {
        const filas = [6, 5, 3];
        filas.forEach((nf, fi) => {
          for (let i = 0; i < nf; i++) {
            const x = xc + (i - (nf - 1) / 2) * 0.0175, y = 0.09 + 0.008 + fi * 0.0152, dz = al(-0.06, 0.06);
            ponerVC(tubo(V(x, y, z0 + dz), V(x, y, z1 + dz), 0.008, 5, true), oxidos[Math.floor(azar() * oxidos.length)], 0.12);
          }
        });
        for (const zz of [-2.2, -0.2, 0.9]) { const amarra = new THREE.TorusGeometry(0.06, 0.0022, 4, 14); amarra.scale(1, 0.42, 1); ponerSS(ubicar(amarra, xc, 0.112, zz), 0x2a2826, 0); }
      }
      void largo;
      // estribos apilados
      const camino = (a, b, r = 0.012) => new THREE.CatmullRomCurve3([V(-a, 0, -b + r), V(-a + r, 0, -b), V(a - r, 0, -b), V(a, 0, -b + r), V(a, 0, b - r), V(a - r, 0, b), V(-a + r, 0, b), V(-a, 0, b - r)], true, 'centripetal');
      for (let k = 0; k < 9; k++) {
        const geo = new THREE.TubeGeometry(camino(0.11, 0.16), 28, 0.004, 3, true);
        ponerSS(ubicar(geo, 3.55 + al(-0.03, 0.03), 0.006 + k * 0.0085, 1.75 + al(-0.03, 0.03), 0, al(-0.25, 0.25), 0), oxidos[k % oxidos.length], 0.1);
      }
      // rollo de alambre negro
      ponerSS(ubicar(new THREE.TorusGeometry(0.13, 0.035, 6, 18), 3.35, 0.035, 1.15, Math.PI / 2, 0, 0), 0x232220, 0.03);
    }

    // ------------------------------------------------------------------ madera: pallet, moldaje usado, cuartones, caballete y letrero
    {
      // pallet con sacos de cemento
      const [qx, qz, qa] = LUG.pallet;
      const MP = new THREE.Matrix4().compose(V(qx, 0, qz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), qa), UNO);
      const pal = [];
      for (let i = 0; i < 9; i++) pal.push(tabla(0.1, 0.022, 1.0, [-0.55 + i * 0.1375, 0.129, 0], [0, 0, 0], { tono: 0xb7a07c }));
      for (const z of [-0.43, 0, 0.43]) pal.push(tabla(1.2, 0.1, 0.08, [0, 0.068, z], [0, 0, 0], { tono: 0xa48f6e }));
      for (const x of [-0.55, 0, 0.55]) pal.push(tabla(0.1, 0.018, 1.0, [x, 0.009, 0], [0, 0, 0], { tono: 0xa48f6e }));
      for (const geo of pal) { geo.applyMatrix4(MP); mad.push(geo); }
      // moldaje: placas de terciado fenólico apiladas sobre cuartones
      const [mx, mz, ma] = LUG.moldaje;
      const MM = new THREE.Matrix4().compose(V(mx, 0, mz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ma), UNO);
      const mol = [];
      for (const x of [-0.8, 0.0, 0.8]) mol.push(tabla(0.07, 0.045, 1.3, [x, 0.0225, 0], [0, al(-0.06, 0.06), 0], { tono: 0xb19a74 }));
      for (let k = 0; k < 6; k++) mol.push(tabla(2.44, 0.018, 1.22, [al(-0.05, 0.05), 0.054 + k * 0.0185, al(-0.04, 0.04)], [0, al(-0.035, 0.035), 0], { fenolico: true, tono: 0xffffff }));
      // una placa con el canto en el suelo, recostada a 20° sobre el borde de la pila, y cuartones sueltos encima de la pila
      // (la placa de arriba termina a 0,156 m)
      { const th = 0.349, zg = 0.61 + 0.156 / Math.tan(th); mol.push(tabla(2.44, 0.018, 1.22, [0.05, 0.61 * Math.sin(th) + 0.009 * Math.cos(th), zg - 0.61 * Math.cos(th) + 0.009 * Math.sin(th)], [th, 0.04, 0], { fenolico: true })); }
      for (let k = 0; k < 5; k++) mol.push(tabla(0.045, 0.07, 3.2, [-0.6 + k * 0.11 + al(-0.02, 0.02), 0.156 + 0.035, al(-0.15, 0.15) - 0.25], [0, Math.PI / 2 + al(-0.08, 0.08), 0], { tono: 0xc2ad86 }));
      mol.push(tabla(0.045, 0.07, 1.1, [1.6, 0.035, 0.6], [0, 0.6, 0], { tono: 0xb8a27c }));
      mol.push(tabla(0.045, 0.07, 0.7, [-1.55, 0.035, 0.75], [0, -0.4, 0.0], { tono: 0xbca784 }));
      mol.push(tabla(0.3, 0.018, 0.55, [-1.45, 0.009, -0.5], [0, 0.7, 0], { fenolico: true }));
      for (const geo of mol) { geo.applyMatrix4(MM); mad.push(geo); }
      // caballete de carpintero con un tablón
      const [cx, cz, ca] = LUG.caballete;
      const MCb = new THREE.Matrix4().compose(V(cx, 0, cz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ca), UNO);
      const cab = [];
      for (const x of [-0.55, 0.55]) {
        cab.push(tabla(0.09, 0.07, 0.07, [x, 0.73, 0], [0, 0, 0], { tono: 0xb59f7a }));
        // patas abiertas abajo y juntas bajo el cabezal
        for (const sz of [-1, 1]) cab.push(tabla(0.045, 0.78, 0.045, [x, 0.37, sz * 0.15], [-sz * 0.36, 0, 0], { tono: 0xb59f7a }));
      }
      cab.push(tabla(1.4, 0.07, 0.07, [0, 0.8, 0], [0, 0, 0], { tono: 0xb8a37e }));
      cab.push(tabla(2.2, 0.04, 0.25, [0.1, 0.855, 0.02], [0, 0.05, 0], { tono: 0xc9b48c }));
      for (const geo of cab) { geo.applyMatrix4(MCb); mad.push(geo); }
      // letrero: dos polines y el tablero
      const [lx0, lz0, la] = LUG.letrero;
      const ML = new THREE.Matrix4().compose(V(lx0, 0, lz0), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), la), UNO);
      const let0 = [];
      for (const x of [-0.95, 0.95]) let0.push(tabla(0.09, 2.6, 0.09, [x, 1.3, 0], [0, 0, 0], { tono: 0x9d8c70 }));
      let0.push(tabla(2.1, 1.1, 0.018, [0, 1.85, 0.054], [0, 0, 0], { tono: 0xb9a888 }));
      let0.push(tabla(1.9, 0.07, 0.045, [0, 0.55, -0.0], [0, 0, 0.0], { tono: 0x9d8c70 }));
      for (const geo of let0) { geo.applyMatrix4(ML); mad.push(geo); }
      const cara = new THREE.PlaneGeometry(2.04, 1.04); cara.translate(0, 1.85, 0.0645); cara.applyMatrix4(ML);
      kit.malla(cara, new THREE.MeshStandardMaterial({ map: texturaLetrero(), roughness: 0.75 }), { sombra: false, padre: g });
    }
    const matMadera = new THREE.MeshStandardMaterial({ map: texturaMadera(), vertexColors: true, roughness: 0.84 });
    kit.malla(kit.mergeGeometries(mad), matMadera, { padre: g });

    // sacos de cemento sobre el pallet (instancias), uno roto en el suelo y uno vacío
    {
      const geo = new THREE.BoxGeometry(0.62, 0.14, 0.42, 8, 2, 6), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = x / 0.31, ny = y / 0.07, nz = z / 0.21;
        const k = (1 - 0.62 * nx ** 6) * (1 - 0.62 * nz ** 6);
        p.setXYZ(i, x * (1 - 0.06 * ny * ny), y * k, z * (1 - 0.08 * ny * ny));
      }
      geo.computeVertexNormals();
      const [qx, qz, qa] = LUG.pallet;
      const lista = [];
      for (let capa = 0; capa < 3; capa++) for (const [x, z] of [[-0.3, -0.22], [0.3, -0.22], [-0.3, 0.22], [0.3, 0.22]]) lista.push([x + al(-0.02, 0.02), 0.205 + capa * 0.112, z + al(-0.015, 0.015), 0, al(-0.05, 0.05) + (capa % 2 ? Math.PI : 0), 0, 1, 1]);
      lista.push([-0.15, 0.54, -0.05, 0, Math.PI / 2 + 0.1, 0, 1, 1]);
      lista.push([0.28, 0.56, 0.1, 0.12, Math.PI / 2 - 0.15, 0.05, 1, 1]);
      const sacos = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: texturaSaco(), roughness: 0.95 }), lista.length + 2);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = V(), mp = new THREE.Matrix4().compose(V(qx, 0, qz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), qa), UNO);
      const col = new THREE.Color();
      lista.forEach(([x, y, z, rx, ry, rz, sx, sy], i) => {
        e.set(rx, ry, rz); q.setFromEuler(e); m4.compose(V(x, y, z), q, sc.set(sx, sy, 1)).premultiply(mp); sacos.setMatrixAt(i, m4);
        col.setScalar(0.9 + azar() * 0.12); sacos.setColorAt(i, col);
      });
      // saco roto junto al montón y saco vacío aplastado junto al pallet
      e.set(0.04, 1.2, 0.02); q.setFromEuler(e); m4.compose(V(-4.75, 0.04, -2.35), q, sc.set(1.08, 0.55, 1.05)); sacos.setMatrixAt(lista.length, m4); sacos.setColorAt(lista.length, col.setScalar(0.95));
      e.set(0, 2.6, 0); q.setFromEuler(e); m4.compose(V(-4.75, 0.012, -0.95), q, sc.set(1.1, 0.1, 1.15)); sacos.setMatrixAt(lista.length + 1, m4); sacos.setColorAt(lista.length + 1, col.setScalar(0.85));
      sacos.castShadow = true; sacos.receiveShadow = true;
      g.add(sacos);
    }

    // pala de repuesto clavada en el montón
    {
      const geo = geoPala();
      E.set(0.42, 0.9, 0.18); Q.setFromEuler(E);
      geo.applyMatrix4(new THREE.Matrix4().compose(V(pilaC.x - 0.42, 0.24, pilaC.z - 0.38), Q, UNO));
      vc.push(geo);
    }

    kit.malla(kit.mergeGeometries(vc), matVC, { padre: g });
    kit.malla(kit.mergeGeometries(vcSS), matVC, { sombra: false, padre: g });

    // ------------------------------------------------------------------ gráfico del costo
    const graf = kit.grafico({
      f: (x) => M.costo(x) / 1000, x0: 10, x1: 40, y0: 300, y1: 650, width: 1.3, height: 0.78,
      xTicks: [10, 15, 20, 25, 30, 35, 40], yTicks: [300, 400, 500, 600],
      xLabel: 'x (dm)', yLabel: 'costo C (miles de $)', curveColor: 0xffb347,
    });
    graf.group.position.set(0.55, 1.05, 4.75); graf.group.rotation.y = -0.42;
    g.add(graf.group);
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => fijarX(graf.xFromLocal(p.x)) });

    function revelar() {
      graf.removePoint('min');
      if (s.revelar) { const o = M.optimo(); graf.addPoint('min', o.x, o.costo / 1000, { color: 0x6fe3a2, labelX: 'x = 20', labelY: '360' }); }
      s.cambio = true;
    }

    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'Base y tapa cuadradas, 12.000 dm³ de agua. Base y lados: $100 por dm². Tapa: $200 por dm².',
      ecuaciones: ['C(x, h) = 100x² + 400xh + 200x²', 'x²h = 12.000   ⇒   C(x) = 300x² + 4.800.000/x,   x > 0'],
      lecturas: [
        { etiqueta: 'lado x', valor: () => `${kit.num(s.x, 1)} dm`, color: '#ffb347' },
        { etiqueta: 'altura h', valor: () => `${kit.num(M.h(s.x), 1)} dm`, color: '#5cc8ff' },
        { etiqueta: 'volumen x²h', valor: () => `${kit.num(s.x * s.x * M.h(s.x), 0)} dm³`, color: '#c9a7ff', escala: 0.7 },
        { etiqueta: 'costo C', valor: () => kit.pesos(M.costo(s.x)), color: '#6fe3a2', escala: 0.72 },
      ],
      deslizadores: [{ etiqueta: 'Lado de la base x', min: 10, max: 40, paso: 0.5, get: () => s.x, set: (v) => fijarX(v), formato: (v) => `${kit.num(v, 1)} dm` }],
      botones: [
        { etiqueta: 'Ir al óptimo', accion: () => fijarX(M.optimo().x) },
        { etiqueta: 'Revelar solución', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
        { etiqueta: () => (s.tapa ? 'Levantar la tapa' : 'Bajar la tapa'), accion: () => { s.tapa = !s.tapa; s.cambio = true; } },
      ],
      pie: () => (s.revelar
        ? 'C′(x) = 600x − 4.800.000/x² = 0 en x = 20 dm. Entonces h = 30 dm y C = $360.000. Como C″(20) > 0, es el mínimo absoluto para x > 0.'
        : 'El volumen queda fijo en 12.000 dm³: al cambiar x la altura se ajusta sola. Arrastra la esfera naranja, el gráfico o el deslizador.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-1.35, 1.38, 5.0); panel.mesh.rotation.y = 0.5;
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    // ------------------------------------------------------------------ animación
    const DUR_PALEAR = kit.CLIPS.palear.duracion;
    let tEsc = 0, vuelo = null;
    const vH = V(), vO = V(), vD = V();
    const lanzar = () => {
      arenaPala.visible = false;
      vuelo = { t: 0, a: g.worldToLocal(puntaPala.getWorldPosition(V())), b: g.worldToLocal(boca.getWorldPosition(V())) };
    };
    palera.reproducir('palear', { bucle: true, eventos: { carga: () => { arenaPala.visible = true; }, lanza: lanzar } });
    const ojoPila = new THREE.Object3D(); ojoPila.position.set(pilaC.x, 0.25, pilaC.z); g.add(ojoPila);

    function animarPersonas(dt, fijo) {
      // obrero: mira el asa mientras cambia x; en reposo alterna entre la tableta y la cisterna
      const ci = tEsc % 10;
      inspector.mirar(s.tAsa > 0 ? asaX : ci < 3.6 ? tableta : ci < 7.4 ? ojoMuro : ojoAlto);
      inspector.actualizar(fijo ? 0 : dt);
      // capataz: conversa mirando al obrero y a ratos señala la cisterna
      const tc = fijo ? tEsc % DUR_EXPLICAR : capataz.tiempoClip() % DUR_EXPLICAR, sn = senala(tc);
      capataz.mirar(sn > 0.3 ? ojoSenal : inspector.huesos.cabeza);
      if (sn > 0.01) {
        capataz.huesos.brazoD.getWorldPosition(vH); ojoSenal.getWorldPosition(vO);
        vD.subVectors(vO, vH).normalize(); capataz.alcanzar('D', vH.clone().addScaledVector(vD, 0.5), null, sn);
      } else capataz.alcanzar('D', null);
      if (fijo) capataz.fijarClip(CLIP_EXPLICAR, tc); else capataz.actualizar(dt);
      // obrera: mira el montón al cargar y la boca del tambor al soltar
      const tp = fijo ? tEsc % DUR_PALEAR : palera.tiempoClip() % DUR_PALEAR;
      palera.mirar(tp > 1.35 && tp < 2.45 ? boca : ojoPila);
      if (fijo) {
        palera.fijarClip('palear', tp);
        arenaPala.visible = tp >= 0.9 && tp < 1.95;
        vuelo = tp >= 1.95 && tp < 2.27 ? { t: tp - 1.95, a: g.worldToLocal(puntaPala.getWorldPosition(V())), b: g.worldToLocal(boca.getWorldPosition(V())) } : null;
      } else palera.actualizar(dt);
      if (vuelo) {
        if (!fijo) vuelo.t += dt;
        const k = Math.min(1, vuelo.t / 0.32);
        terron.position.lerpVectors(vuelo.a, vuelo.b, k); terron.position.y += 0.16 * Math.sin(Math.PI * k);
        terron.scale.setScalar(1 - 0.35 * k); terron.rotation.set(k * 2, k * 3, 0);
        terron.visible = k < 1;
        if (k >= 1 && !fijo) vuelo = null;
      } else terron.visible = false;
    }

    construir(); graf.setMarker(s.x); s.cambio = false;

    return {
      paneles: [panel],
      radioSombra: 12,
      // con x grande la cisterna se ensancha hacia quien mira: en VR el panel y el gráfico se abren más
      laminaVR: { angulo: 58 },
      alturaCartel: 9.5,
      vista: { escritorio: { camara: [-5.5, 4.2, 8.5], objetivo: [-0.8, 1.6, -1.0] }, vr: { pos: [0, 0, 7.4], yaw: 0 } },
      dom: [
        { tipo: 'rango', etiqueta: 'x', min: 10, max: 40, paso: 0.5, get: () => s.x, set: (v) => fijarX(v), formato: (v) => `${kit.num(v, 1)} dm` },
        { tipo: 'boton', etiqueta: 'Ir al óptimo', accion: () => fijarX(M.optimo().x) },
        { tipo: 'interruptor', etiqueta: 'Revelar solución', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
        { tipo: 'boton', etiqueta: () => (s.tapa ? 'Levantar la tapa' : 'Bajar la tapa'), accion: () => { s.tapa = !s.tapa; s.cambio = true; } },
      ],
      actualizar(dt) {
        const fijo = REV.t !== undefined;
        tEsc = fijo ? REV.t : tEsc + dt;
        if (s.cambio) { s.cambio = false; construir(); graf.setMarker(s.x); panel.invalidate(); }
        // tapa con bisagra atrás
        const objetivo = s.tapa ? 0 : ABIERTA;
        s.angulo = fijo ? objetivo : s.angulo + (objetivo - s.angulo) * Math.min(1, dt * 3.5);
        pivoteTapa.rotation.x = -s.angulo;
        superficie.visible = s.angulo > 0.03;
        nrm.offset.set(tEsc * 0.02, tEsc * 0.013);
        tambor.rotation.y = tEsc * 2.6;
        s.tAsa = Math.max(0, s.tAsa - dt);
        animarPersonas(dt, fijo);
      },
    };
  },
};
