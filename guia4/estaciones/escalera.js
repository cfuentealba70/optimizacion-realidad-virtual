// Ejercicio 2.2. Escalera de 13 m que resbala por la pared: la base se aleja a 5 m/s.
// Escena: patio de un edificio de cuatro pisos con la fachada en reparación. La pared de apoyo es la cara x = 0 del
// edificio (mira a −x, hacia el sol) y el pie de la escalera se aleja hacia −x. Un obrero mira la escalera desde el
// suelo y una vecina se asoma por una ventana del tercer piso.
import { ESCALERA as M } from '../../src/math/guia4.js';

export default {
  id: 'escalera',
  tipo: 'razon',
  etiqueta: 'Ejercicio 2.2 · Razón de cambio',
  titulo: 'Escalera que resbala',
  resumen: 'Una escalera de 13 m está apoyada contra una pared y empieza a resbalar. Cuando la base está a 12 m de la pared, se aleja a 5 m/s. ¿Qué tan rápido baja la parte superior? ¿A qué tasa cambia el área del triángulo y el ángulo con el suelo?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const PI = Math.PI;
    const reloj = kit.reloj({ t0: 0, t1: M.fin, instante: M.instante, velocidad: 0.25 });
    const s = { revelar: false, ultimo: -1, tRotulos: 1, estado: '' };
    // Revisión de capturas: ?rev=0.9 deja el reloj detenido en t = 0,9 s y ?rev=0.9,alarma además hace reaccionar a las personas.
    const rev = (() => {
      const r = new URLSearchParams(globalThis.location?.search ?? '').get('rev');
      if (!r) return null;
      const [t, modo] = r.split(',');
      return { t: Math.min(M.fin, Math.max(0, Number(t) || 0)), alarma: modo === 'alarma' };
    })();
    const azar = kit.mulberry32(2207);
    const V2 = (x, y) => new THREE.Vector2(x, y), V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const sstep = (a, b, v) => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };

    // ---------------------------------------------------------------- utilidades de geometría
    const mt = new THREE.Matrix4(), qt = new THREE.Quaternion(), eu = new THREE.Euler(), UNO = V3(1, 1, 1);
    const ubicar = (geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, orden = 'XYZ' } = {}) => geo.applyMatrix4(mt.compose(V3(x, y, z), qt.setFromEuler(eu.set(rx, ry, rz, orden)), UNO));
    const pintar = (geo, hex, vari = 0.06, brillo = 1) => {
      const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3), k = brillo * (1 + (azar() - 0.5) * vari);
      for (let i = 0; i < n; i++) { a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return geo;
    };
    // caja con coordenadas de textura en metros (uvGiro: la textura corre a lo largo del alto)
    const caja = (w, h, d, o = {}) => {
      const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv, du = [d, d, w, w, w, w], dv = [h, h, d, d, h, h];
      for (let i = 0; i < uv.count; i++) {
        const f = Math.floor(i / 4), u = uv.getX(i) * du[f], v = uv.getY(i) * dv[f];
        if (o.uvGiro) uv.setXY(i, v, u); else uv.setXY(i, u, v);
      }
      if (o.color != null) pintar(geo, o.color, o.vari ?? 0.06, o.brillo ?? 1);
      return ubicar(geo, o);
    };
    // cilindro entre dos puntos, con coordenadas de textura en metros
    const tubo = (a, b, r, o = {}) => {
      const A = V3(...a), B = V3(...b), d = B.clone().sub(A), L = d.length();
      const geo = new THREE.CylinderGeometry(o.r2 ?? r, r, L, o.seg ?? 10, 1, !!o.abierto), uv = geo.attributes.uv;
      if (!o.uvCrudo) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * PI * r, uv.getY(i) * L);
      geo.applyMatrix4(mt.compose(A.clone().addScaledVector(d, 0.5), qt.setFromUnitVectors(V3(0, 1, 0), d.normalize()), UNO));
      if (o.color != null) pintar(geo, o.color, o.vari ?? 0.05, o.brillo ?? 1);
      return geo;
    };
    const torno = (perfil, seg, o = {}) => ubicar(new THREE.LatheGeometry(perfil.map(([r, y]) => V2(r, y)), seg), o);
    // une geometrías del mismo material en una sola (con color por vértice si se pide)
    const unir = (lista, color = false) => {
      const prep = lista.map((g0) => {
        const q = g0.index ? g0.toNonIndexed() : g0;
        if (!q.attributes.uv) q.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
        if (color && !q.attributes.color) pintar(q, 0xffffff, 0);
        for (const k of Object.keys(q.attributes)) if (!(k === 'position' || k === 'normal' || k === 'uv' || (color && k === 'color'))) q.deleteAttribute(k);
        return q;
      });
      const geo = kit.mergeGeometries(prep, false);
      for (const q of new Set([...prep, ...lista])) q.dispose();
      if (!geo) throw new Error('No se pudieron unir las piezas de la escena');
      return geo;
    };
    // suelda los vértices repetidos para obtener normales suaves
    const soldar = (geo) => {
      const p = geo.attributes.position, mapa = new Map(), idx = [], pos = [];
      for (let i = 0; i < p.count; i++) {
        const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
        let j = mapa.get(k);
        if (j === undefined) { j = pos.length / 3; mapa.set(k, j); pos.push(p.getX(i), p.getY(i), p.getZ(i)); }
        idx.push(j);
      }
      geo.dispose();
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(idx);
      return out;
    };
    // forma orgánica o trozo de piedra: esfera deformada con normales suaves
    const bulto = (rug, semilla, detalle = 1) => {
      const geo = soldar(new THREE.IcosahedronGeometry(1, detalle)), p = geo.attributes.position, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = 1 + rug * (Math.sin(x * 3.1 + semilla) * Math.cos(y * 2.7 - semilla * 1.3) + 0.6 * Math.sin(z * 4.3 + x * 1.7 + semilla * 2.1) + 0.35 * Math.sin((x + y + z) * 7.1 + semilla));
        p.setXYZ(i, x * k, y * k, z * k);
        uv[i * 2] = x + z; uv[i * 2 + 1] = y;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeVertexNormals();
      return geo;
    };

    // ---------------------------------------------------------------- texturas de lienzo
    const lienzo = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const texDe = (c, repetir = true) => {
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    const trazo = (cx, pts) => { cx.beginPath(); pts.forEach(([a, b], i) => (i ? cx.lineTo(a, b) : cx.moveTo(a, b))); cx.stroke(); };
    // grieta quebrada con ramas (en pixeles del lienzo)
    const grieta = (cx, x0, y0, ang, largo, ancho = 1, prof = 0) => {
      const pts = [[x0, y0]], pasos = Math.max(3, Math.round(largo / 3));
      let px = x0, py = y0, a = ang;
      for (let i = 0; i < pasos; i++) {
        a += (azar() - 0.5) * 0.9;
        const l = (largo / pasos) * (0.6 + azar() * 0.8);
        px += Math.cos(a) * l; py += Math.sin(a) * l; pts.push([px, py]);
        if (prof < 2 && azar() < 0.16) grieta(cx, px, py, a + (azar() < 0.5 ? 1 : -1) * (0.5 + azar() * 0.6), largo * 0.4, ancho * 0.7, prof + 1);
      }
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      cx.strokeStyle = 'rgba(255,248,236,0.22)'; cx.lineWidth = ancho + 0.8;
      trazo(cx, pts.map(([u, v]) => [u + 0.7, v + 0.7]));
      cx.strokeStyle = `rgba(42,32,24,${0.78 - prof * 0.15})`; cx.lineWidth = ancho;
      trazo(cx, pts);
    };
    // contorno irregular para manchas, parches y desconchados
    const forma = (x0, y0, rx, ry, quiebre = 0.45, n = 14) => {
      const p = new Path2D();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * PI, k = 1 - quiebre / 2 + azar() * quiebre, x = x0 + Math.cos(a) * rx * k, y = y0 + Math.sin(a) * ry * k;
        if (i) p.lineTo(x, y); else p.moveTo(x, y);
      }
      p.closePath();
      return p;
    };
    const mancha = (cx, x, y, rx, ry, color) => {
      cx.save(); cx.translate(x, y); cx.scale(1, ry / rx);
      const gr = cx.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, color); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
      cx.fillStyle = gr; cx.beginPath(); cx.arc(0, 0, rx, 0, 2 * PI); cx.fill(); cx.restore();
    };
    // ladrillos a la vista dentro del recorte actual
    const ladrillos = (cx, x0, y0, x1, y1, alto, largo) => {
      cx.fillStyle = '#b9ab98'; cx.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let f = 0, y = y0; y < y1; f++, y += alto) {
        for (let x = x0 - (f % 2) * largo * 0.5; x < x1; x += largo) {
          const t = azar();
          cx.fillStyle = `rgb(${150 + t * 45},${70 + t * 22},${50 + t * 14})`;
          cx.fillRect(x + 0.6, y + 0.6, largo - 1.2, alto - 1.2);
        }
      }
    };
    // suciedad: blanco con manchas suaves (multiplica el color de la utilería y de los metales)
    const texSucio = (() => {
      const S = 256, [c, cx] = lienzo(S), n = kit.fbm(S, 6, 5, 41), m = kit.fbm(S, 24, 3, 43), img = cx.createImageData(S, S);
      for (let i = 0; i < S * S; i++) {
        const v = 255 * (0.8 + 0.2 * sstep(0.28, 0.72, n[i]) - 0.07 * m[i]);
        img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.98; img.data[i * 4 + 2] = v * 0.95; img.data[i * 4 + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
      return texDe(c);
    })();

    // ---------------------------------------------------------------- edificio de cuatro pisos (x de 0 a 9, z de −6 a 6)
    const PISO = 3.3, ALTO = 14;
    const CREMA = '#ece4d5', GRIS = '#a9a59c', ZOCALO = '#8e877b', OCRE = [206, 170, 126];
    // vanos: c es la posición a lo largo de la cara (z en la cara A, x en la cara B)
    const huecosA = [], huecosB = [];
    for (let k = 0; k < 4; k++) {
      const y0 = PISO * k;
      for (const c of [-4.6, -2.5, 2.5, 4.6]) {
        if (k === 2 && c === -2.5) huecosA.push({ c, a: 1.2, v0: y0 + 0.95, v1: y0 + 2.45, tipo: 'abierta', k });
        else if (k % 2 === 1 && c === 4.6) huecosA.push({ c, a: 0.95, v0: y0 + 0.02, v1: y0 + 2.4, tipo: 'balcon', k });
        else huecosA.push({ c, a: 1.1, v0: y0 + (k ? 0.95 : 1.05), v1: y0 + 2.45, tipo: k ? 'ventana' : 'reja', k });
      }
      for (const c of [1.7, 4.5, 7.3]) {
        if (k === 0 && c === 4.5) huecosB.push({ c, a: 1.0, v0: 0.14, v1: 2.35, tipo: 'puerta', k });
        else huecosB.push({ c, a: 1.1, v0: y0 + (k ? 0.95 : 1.05), v1: y0 + 2.45, tipo: k ? 'ventana' : 'reja', k });
      }
    }

    // Estuco envejecido de una cara: humedad en el zócalo, polvo bajo las cornisas, chorreaduras bajo los alféizares,
    // grietas en las esquinas de los vanos, desconchados y la franja en reparación donde se apoya la escalera.
    function texturaFachada({ ancho, huecos, semilla, franja = null, bajadas = [] }) {
      const S = 512, [c, cx] = lienzo(S);
      const pu = S / ancho, pv = S / ALTO, X = (u) => u * pu, Y = (v) => S - v * pv;
      const n1 = kit.fbm(S, 5, 5, semilla), n2 = kit.fbm(S, 22, 3, semilla + 7), img = cx.createImageData(S, S), d = img.data;
      for (let j = 0; j < S; j++) {
        const v = (S - j) / pv, techo = sstep(ALTO - 1.6, ALTO - 0.2, v) * 0.1;
        for (let i = 0; i < S; i++) {
          const k = j * S + i, a = n1[k] - 0.5, b = n2[k] - 0.5;
          const hum = sstep(0.18, 0, v - (0.8 + a * 1.1));
          const t = (0.94 + a * 0.2 + b * 0.08) * (1 - hum * 0.24 - techo);
          d[k * 4] = OCRE[0] * t; d[k * 4 + 1] = OCRE[1] * t * (1 - hum * 0.03); d[k * 4 + 2] = OCRE[2] * t * (1 - hum * 0.05); d[k * 4 + 3] = 255;
        }
      }
      cx.putImageData(img, 0, 0);
      // polvo bajo las cornisas de cada piso
      for (let k = 1; k <= 4; k++) {
        const v = k === 4 ? 13.05 : PISO * k - 0.2, gr = cx.createLinearGradient(0, Y(v), 0, Y(v - 0.8));
        gr.addColorStop(0, 'rgba(70,55,40,0.18)'); gr.addColorStop(1, 'rgba(70,55,40,0)');
        cx.fillStyle = gr; cx.fillRect(0, Y(v), S, Y(v - 0.8) - Y(v));
      }
      for (const h of huecos) {
        const u0 = h.u - h.a / 2, u1 = h.u + h.a / 2;
        // chorreaduras bajo el alféizar
        if (h.tipo !== 'puerta' && h.tipo !== 'balcon') {
          for (let n = 0; n < 10; n++) {
            const u = u0 - 0.08 + azar() * (h.a + 0.16), largo = 0.4 + azar() * 1.7, w = 1 + azar() * 3, v = h.v0 - 0.06;
            const gr = cx.createLinearGradient(0, Y(v), 0, Y(v - largo));
            gr.addColorStop(0, `rgba(58,44,32,${0.1 + azar() * 0.22})`); gr.addColorStop(1, 'rgba(58,44,32,0)');
            cx.fillStyle = gr; cx.fillRect(X(u), Y(v), w, Y(v - largo) - Y(v));
          }
        }
        // grietas que nacen en las esquinas de los vanos
        if (azar() < 0.55) grieta(cx, X(u1 + 0.11), Y(h.v1 + 0.14), -PI / 4 - azar() * 0.4, 14 + azar() * 24, 1);
        if (azar() < 0.4) grieta(cx, X(u0 - 0.11), Y(h.v1 + 0.14), (-3 * PI) / 4 + azar() * 0.4, 12 + azar() * 20, 1);
        if (h.tipo !== 'puerta' && azar() < 0.45) grieta(cx, X(u0 - 0.11), Y(h.v0 - 0.08), (3 * PI) / 4 - azar() * 0.4, 10 + azar() * 22, 1);
      }
      // grietas sueltas
      for (let i = 0; i < 5; i++) grieta(cx, azar() * S, S * (0.1 + azar() * 0.8), azar() * 2 * PI, 12 + azar() * 26, 1);
      // manchas de humedad y óxido bajo las bajadas de agua
      for (const u of bajadas) {
        const gr = cx.createLinearGradient(0, Y(1.6), 0, Y(0));
        gr.addColorStop(0, 'rgba(50,40,30,0)'); gr.addColorStop(1, 'rgba(50,40,30,0.35)');
        cx.fillStyle = gr; cx.fillRect(X(u - 0.3), Y(1.6), X(0.6), Y(0) - Y(1.6));
        for (let v = 1.6; v < 12.8; v += 2.1) mancha(cx, X(u), Y(v - 0.25), X(0.07), pv * 0.35, 'rgba(110,70,40,0.22)');
      }
      // estuco caído que deja ver el ladrillo
      const desconchado = (u, v, ru, rv) => {
        const f = forma(X(u), Y(v), ru * pu, rv * pv, 0.6);
        cx.save(); cx.clip(f); ladrillos(cx, X(u - ru * 1.3), Y(v + rv * 1.3), X(u + ru * 1.3), Y(v - rv * 1.3), Math.max(3, 0.075 * pv), 0.29 * pu); cx.restore();
        cx.strokeStyle = 'rgba(50,40,32,0.65)'; cx.lineWidth = 1.2; cx.stroke(f);
      };
      desconchado(ancho * 0.2 + azar(), 0.45, 0.3, 0.22);
      desconchado(ancho * 0.75, 3.05 + azar() * 0.2, 0.22, 0.16);
      // franja en reparación: revoque nuevo gris, ladrillo a la vista donde se picó el estuco y grietas selladas
      if (franja) {
        const [ua, ub, vt] = franja, p = new Path2D();
        p.moveTo(X(ua), Y(0.62));
        for (let v = 0.62; v < vt; v += 0.35) p.lineTo(X(ua + (azar() - 0.5) * 0.2), Y(v));
        p.lineTo(X(ua + 0.25), Y(vt + 0.05)); p.lineTo(X(ub - 0.2), Y(vt + 0.12));
        for (let v = vt; v > 0.62; v -= 0.35) p.lineTo(X(ub + (azar() - 0.5) * 0.2), Y(v));
        p.closePath();
        cx.save(); cx.clip(p);
        cx.fillStyle = '#958f84'; cx.fillRect(X(ua) - 12, Y(vt) - 12, X(ub) - X(ua) + 24, Y(0.62) - Y(vt) + 24);
        for (let i = 0; i < 1100; i++) {
          cx.fillStyle = azar() < 0.5 ? `rgba(60,58,54,${0.08 + azar() * 0.14})` : `rgba(205,200,190,${0.06 + azar() * 0.12})`;
          cx.fillRect(X(ua) - 8 + azar() * (X(ub) - X(ua) + 16), Y(vt) + azar() * (Y(0.62) - Y(vt)), 1 + azar() * 2, 1 + azar() * 2);
        }
        for (const v of [2.3, 5.5, 8.7, 11.3]) {
          const um = (ua + ub) / 2 + (azar() - 0.5) * 0.5, f = forma(X(um), Y(v), 0.48 * pu, 0.6 * pv, 0.55);
          cx.save(); cx.clip(f); ladrillos(cx, X(um - 0.7), Y(v + 0.8), X(um + 0.7), Y(v - 0.8), Math.max(3, 0.075 * pv), 0.29 * pu); cx.restore();
          cx.strokeStyle = 'rgba(48,40,32,0.7)'; cx.lineWidth = 1.2; cx.stroke(f);
        }
        for (let i = 0; i < 7; i++) {
          const x0 = X(ua + 0.2 + azar() * (ub - ua - 0.4)), y0 = Y(1 + azar() * (vt - 1.5));
          cx.strokeStyle = 'rgba(214,208,196,0.7)'; cx.lineWidth = 2;
          let px = x0, py = y0; cx.beginPath(); cx.moveTo(px, py);
          for (let k = 0; k < 6; k++) { px += (azar() - 0.5) * 6; py += 3 + azar() * 4; cx.lineTo(px, py); }
          cx.stroke();
        }
        cx.restore();
        cx.strokeStyle = 'rgba(70,60,50,0.6)'; cx.lineWidth = 1.4; cx.stroke(p);
      }
      return texDe(c, false);
    }

    // muro con vanos: contorno en el plano (X, Y), extruido 25 cm
    const muroGeo = (u0, u1, vanos) => {
      const sh = new THREE.Shape([V2(u0, 0), V2(u1, 0), V2(u1, ALTO), V2(u0, ALTO)]);
      for (const [a, b, v0, v1] of vanos) sh.holes.push(new THREE.Path([V2(a, v0), V2(b, v0), V2(b, v1), V2(a, v1)]));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false, curveSegments: 1, steps: 1 });
      const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) if (Math.abs(n.getZ(i)) < 0.5) uv.setXY(i, p.getX(i), p.getY(i)); // los vanos toman el color del muro que los rodea
      return geo;
    };
    const supEstuco = kit.makeSurface('plaster', { seed: 5, repeat: [0.45, 0.45] });
    const matFachada = (map) => new THREE.MeshStandardMaterial({ map, normalMap: supEstuco.normalMap, normalScale: V2(0.9, 0.9), roughness: 0.93 });
    // cara A (x = 0): contorno en X = −z, extruido hacia +x
    const geoA = muroGeo(-6, 6, huecosA.map((h) => [-h.c - h.a / 2, -h.c + h.a / 2, h.v0, h.v1]));
    geoA.rotateY(PI / 2);
    const texA = texturaFachada({ ancho: 12, huecos: huecosA.map((h) => ({ ...h, u: 6 - h.c })), semilla: 31, franja: [5.05, 6.95, 12.7], bajadas: [0.25, 11.75] });
    texA.repeat.set(1 / 12, 1 / ALTO); texA.offset.set(0.5, 0);
    kit.malla(geoA, matFachada(texA), { padre: g });
    // cara B (z = 6, hacia la persona)
    const geoB = muroGeo(0.25, 9, huecosB.map((h) => [h.c - h.a / 2, h.c + h.a / 2, h.v0, h.v1]));
    geoB.translate(0, 0, 5.75);
    const texB = texturaFachada({ ancho: 9, huecos: huecosB.map((h) => ({ ...h, u: h.c })), semilla: 37, bajadas: [8.75] });
    texB.repeat.set(1 / 9, 1 / ALTO);
    kit.malla(geoB, matFachada(texB), { padre: g });
    // resto del volumen (sin las dos caras que ya tienen muro con vanos)
    const cuerpo = caja(8.75, ALTO, 11.75, { x: 4.625, y: ALTO / 2, z: -0.125 });
    { const ix = cuerpo.index.array, quedan = []; for (const f of [0, 2, 5]) for (let i = 0; i < 6; i++) quedan.push(ix[6 * f + i]); cuerpo.setIndex(quedan); cuerpo.clearGroups(); }
    kit.malla(cuerpo, kit.mat('plaster', { repeat: [0.4, 0.4], seed: 7, color: 0xe9c8a0, normalScale: 0.6 }), { padre: g });

    // listas de piezas por material
    const piedra = [], marcos = [], vidrios = [], hierros = [], galv = [], util = [], madera = [];
    // remates de hormigón: albardillas, cornisas y zócalo (la franja de la escalera queda libre para que la cima resbale)
    piedra.push(caja(0.36, 0.09, 12.1, { x: 0.11, y: ALTO + 0.045, z: 0.03, color: CREMA }));
    piedra.push(caja(9.07, 0.09, 0.36, { x: 4.465, y: ALTO + 0.045, z: 5.89, color: CREMA }));
    piedra.push(caja(0.15, 0.24, 12.15, { x: -0.075, y: 13.22, z: 0.04, color: CREMA }));
    piedra.push(caja(9.15, 0.24, 0.15, { x: 4.43, y: 13.22, z: 6.075, color: CREMA }));
    for (let k = 1; k <= 3; k++) {
      const y = PISO * k - 0.12;
      for (const [z0, z1] of [[-6, -0.8], [0.8, 6.07]]) piedra.push(caja(0.07, 0.16, z1 - z0, { x: -0.035, y, z: (z0 + z1) / 2, color: CREMA }));
      piedra.push(caja(9.07, 0.16, 0.07, { x: 4.465, y, z: 6.035, color: CREMA }));
    }
    for (const [z0, z1] of [[-6, -0.8], [0.8, 6.035]]) piedra.push(caja(0.035, 0.62, z1 - z0, { x: -0.0175, y: 0.31, z: (z0 + z1) / 2, color: ZOCALO }));
    for (const [x0, x1] of [[-0.035, 3.9], [5.1, 9]]) piedra.push(caja(x1 - x0, 0.62, 0.035, { x: (x0 + x1) / 2, y: 0.31, z: 6.0175, color: ZOCALO }));

    // ubicación en una cara: u a lo largo, v altura, w hacia afuera
    const enCara = (cara, u, v, w) => (cara === 'A' ? [-w, v, u] : [u, v, 6 + w]);
    const cajaC = (cara, du, dv, dw, u, v, w, o = {}) => {
      const [x, y, z] = enCara(cara, u, v, w);
      return cara === 'A' ? caja(dw, dv, du, { ...o, x, y, z }) : caja(du, dv, dw, { ...o, x, y, z });
    };
    const tuboC = (cara, a, b, r, o) => tubo(enCara(cara, ...a), enCara(cara, ...b), r, o);
    // vidrio con una de las cuatro vistas del interior (oscuro, cortinas, persiana, muebles)
    const vidrio = (cara, du, dv, u, v, w, q) => {
      const geo = new THREE.PlaneGeometry(du, dv), uv = geo.attributes.uv;
      const ua = (q % 2) * 0.5 + 0.01, va = (1 - Math.floor(q / 2)) * 0.5 + 0.01;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, ua + uv.getX(i) * 0.48, va + uv.getY(i) * 0.48);
      if (cara === 'A') geo.rotateY(-PI / 2);
      return geo.translate(...enCara(cara, u, v, w));
    };
    const FR = 0.05, WF = -0.11; // ancho del perfil del marco y su plano (dentro del vano)
    function vano(cara, h) {
      const { c, a, v0, v1, tipo } = h, alto = v1 - v0, vm = (v0 + v1) / 2;
      if (tipo === 'puerta') return puerta(cara, h);
      // moldura y alféizar
      piedra.push(cajaC(cara, a + 0.28, 0.13, 0.035, c, v1 + 0.065, 0.0175, { color: CREMA }));
      for (const sg of [-1, 1]) piedra.push(cajaC(cara, 0.1, alto + 0.13, 0.035, c + sg * (a / 2 + 0.05), vm + 0.065, 0.0175, { color: CREMA }));
      if (tipo !== 'balcon') piedra.push(cajaC(cara, a + 0.3, 0.06, tipo === 'abierta' ? 0.42 : 0.22, c, v0 - 0.03, tipo === 'abierta' ? -0.1 : 0, { color: CREMA }));
      // marco fijo
      marcos.push(cajaC(cara, a, FR, 0.07, c, v1 - FR / 2, WF), cajaC(cara, a, FR, 0.07, c, v0 + FR / 2, WF));
      marcos.push(cajaC(cara, FR, alto - 2 * FR, 0.07, c - a / 2 + FR / 2, vm, WF), cajaC(cara, FR, alto - 2 * FR, 0.07, c + a / 2 - FR / 2, vm, WF));
      if (tipo === 'abierta') return hojasAbiertas(h);
      // dos hojas correderas, una delante de la otra
      const q = [0, 0, 1, 1, 2, 3][Math.floor(azar() * 6)], hw = (a - 2 * FR) / 2 + 0.02, hh = alto - 2 * FR;
      for (const [sg, dw] of [[-1, 0.018], [1, -0.018]]) {
        const uc = c + sg * ((a - 2 * FR) / 4 - 0.005);
        marcos.push(cajaC(cara, hw, 0.04, 0.03, uc, v1 - FR - 0.02, WF + dw), cajaC(cara, hw, 0.04, 0.03, uc, v0 + FR + 0.02, WF + dw));
        marcos.push(cajaC(cara, 0.04, hh - 0.08, 0.03, uc - hw / 2 + 0.02, vm, WF + dw), cajaC(cara, 0.04, hh - 0.08, 0.03, uc + hw / 2 - 0.02, vm, WF + dw));
        vidrios.push(vidrio(cara, hw - 0.07, hh - 0.08, uc, vm, WF + dw - 0.004, q));
      }
      if (tipo === 'reja') {
        const n = Math.round((a - 0.1) / 0.12);
        for (let i = 0; i <= n; i++) { const u = c - a / 2 + 0.05 + (i * (a - 0.1)) / n; hierros.push(tuboC(cara, [u, v0 - 0.1, 0.075], [u, v1 + 0.1, 0.075], 0.009, { seg: 6 })); }
        for (const vv of [v0 + 0.18, v1 - 0.18]) {
          hierros.push(cajaC(cara, a + 0.16, 0.035, 0.012, c, vv, 0.085));
          for (const sg of [-1, 1]) hierros.push(cajaC(cara, 0.014, 0.035, 0.085, c + sg * (a / 2 + 0.07), vv, 0.04)); // anclajes
        }
      }
      return null;
    }
    // ventana de dos hojas abiertas hacia adentro (la de la vecina)
    function hojasAbiertas(h) {
      const { c, a, v0, v1 } = h, alto = v1 - v0, vm = (v0 + v1) / 2, lw = a / 2 - FR, ang = 1.32;
      for (const sg of [-1, 1]) {
        const dir = V3(Math.sin(ang), 0, -sg * Math.cos(ang)), arriba = V3(0, 1, 0), nor = V3().crossVectors(dir, arriba);
        const base = new THREE.Matrix4().makeBasis(dir, arriba, nor).setPosition(-WF, 0, c + sg * (a / 2 - FR));
        const piezas = [caja(lw, 0.045, 0.04, { x: lw / 2, y: v1 - FR - 0.0225 }), caja(lw, 0.045, 0.04, { x: lw / 2, y: v0 + FR + 0.0225 }),
          caja(0.045, alto - 2 * FR, 0.04, { x: 0.0225, y: vm }), caja(0.045, alto - 2 * FR, 0.04, { x: lw - 0.0225, y: vm })];
        for (const p of piezas) marcos.push(p.applyMatrix4(base));
        const vg = new THREE.PlaneGeometry(lw - 0.08, alto - 2 * FR - 0.08), uv = vg.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.01 + uv.getX(i) * 0.48, 0.51 + uv.getY(i) * 0.48);
        vidrios.push(vg.translate(lw / 2, vm, 0).applyMatrix4(base));
      }
      return null;
    }
    // puerta metálica de la entrada con peldaño
    function puerta(cara, h) {
      const { c, a, v0, v1 } = h, alto = v1 - v0, vm = (v0 + v1) / 2;
      hierros.push(cajaC(cara, a, 0.06, 0.08, c, v1 - 0.03, -0.06), cajaC(cara, 0.06, alto, 0.08, c - a / 2 + 0.03, vm, -0.06), cajaC(cara, 0.06, alto, 0.08, c + a / 2 - 0.03, vm, -0.06));
      util.push(cajaC(cara, a - 0.12, alto - 0.07, 0.045, c, vm - 0.015, -0.08, { color: '#3e5446' }));
      for (const vv of [v0 + 0.55, v0 + 1.55]) util.push(cajaC(cara, a - 0.34, 0.75, 0.02, c, vv, -0.05, { color: '#4a6455' }));
      util.push(tuboC(cara, [c + a / 2 - 0.16, v0 + 1.02, -0.05], [c + a / 2 - 0.16, v0 + 1.02, 0.02], 0.012, { color: '#b9b2a2' }));
      util.push(cajaC(cara, 0.13, 0.022, 0.022, c + a / 2 - 0.21, v0 + 1.02, 0.03, { color: '#b9b2a2' }));
      util.push(cajaC(cara, 0.05, 0.12, 0.012, c + a / 2 - 0.16, v0 + 0.96, -0.052, { color: '#9c968a' }));
      piedra.push(cajaC(cara, a + 0.5, 0.14, 0.45, c, 0.07, 0.2, { color: GRIS }));
      piedra.push(cajaC(cara, a + 0.28, 0.13, 0.035, c, v1 + 0.065, 0.0175, { color: CREMA }));
      return null;
    }
    for (const h of huecosA) vano('A', h);
    for (const h of huecosB) vano('B', h);

    // balcones de la cara A (pisos 2 y 4): losa con goterón y baranda de fierro
    for (const k of [1, 3]) {
      const y0 = PISO * k, z0 = 3.78, z1 = 5.42, xf = -0.92;
      piedra.push(caja(0.97, 0.15, 1.72, { x: -0.485, y: y0 - 0.075, z: 4.6, color: '#ddd5c6' }));
      piedra.push(caja(0.99, 0.04, 1.74, { x: -0.495, y: y0 - 0.17, z: 4.6, color: '#cfc6b6' }));
      hierros.push(tubo([xf, y0 + 1.0, z0], [xf, y0 + 1.0, z1], 0.022, { seg: 8 }));
      for (const z of [z0, z1]) hierros.push(tubo([-0.02, y0 + 1.0, z], [xf, y0 + 1.0, z], 0.022, { seg: 8 }));
      hierros.push(caja(0.03, 0.03, z1 - z0, { x: xf, y: y0 + 0.12, z: 4.6 }));
      for (const z of [z0, z1]) hierros.push(caja(0.9, 0.03, 0.03, { x: xf / 2, y: y0 + 0.12, z }));
      for (const z of [z0, z1]) hierros.push(caja(0.045, 1.0, 0.045, { x: xf, y: y0 + 0.5, z }));
      for (let z = z0 + 0.11; z < z1 - 0.05; z += 0.11) hierros.push(tubo([xf, y0, z], [xf, y0 + 1.0, z], 0.009, { seg: 6 }));
      for (const z of [z0, z1]) for (let x = xf + 0.11; x < -0.05; x += 0.11) hierros.push(tubo([x, y0, z], [x, y0 + 1.0, z], 0.009, { seg: 6 }));
    }
    // macetero con una planta en el balcón del segundo piso y una toalla colgada en el del cuarto
    util.push(torno([[0, 0], [0.13, 0], [0.15, 0.02], [0.18, 0.3], [0.2, 0.32], [0.19, 0.34], [0.165, 0.33], [0.16, 0.3], [0, 0.3]], 16, { x: -0.62, y: PISO, z: 5.12 }));
    pintar(util[util.length - 1], '#a5553a', 0.05);
    for (let i = 0; i < 5; i++) {
      const hoja = bulto(0.22, i * 1.7, 1), r = 0.14 + azar() * 0.08;
      hoja.scale(r, r * 1.2, r); hoja.translate(-0.62 + (azar() - 0.5) * 0.18, PISO + 0.42 + azar() * 0.25, 5.12 + (azar() - 0.5) * 0.18);
      util.push(pintar(hoja, i % 2 ? '#4c7a37' : '#3b6a2a', 0.15));
    }
    {
      const y0 = PISO * 3 + 1.0, tela = new THREE.PlaneGeometry(0.62, 0.55, 6, 1), p = tela.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, 0.012 * Math.sin(p.getX(i) * 22));
      tela.computeVertexNormals();
      for (const dx of [-0.025, 0.025]) util.push(pintar(ubicar(tela.clone(), { x: -0.92 + dx, y: y0 - 0.27, z: 4.25, ry: PI / 2 }), '#3d6f9e', 0.04));
      tela.dispose();
    }

    // condensadoras de aire acondicionado en ménsulas
    function aire(cara, u, v) {
      util.push(cajaC(cara, 0.84, 0.58, 0.3, u, v, 0.2, { color: '#dcdad3' }));
      const [x, y, z] = enCara(cara, u - 0.12, v, 0.352), disco = new THREE.CylinderGeometry(0.205, 0.205, 0.008, 24);
      if (cara === 'A') disco.rotateZ(PI / 2); else disco.rotateX(PI / 2);
      util.push(pintar(disco.translate(x, y, z), '#2b2c2d', 0));
      for (let i = -3; i <= 3; i++) util.push(cajaC(cara, 0.43 * Math.sqrt(1 - (i / 3.6) ** 2), 0.007, 0.01, u - 0.12, v + i * 0.055, 0.36, { color: '#9c9a94', vari: 0 }));
      for (let i = 0; i < 9; i++) util.push(cajaC(cara, 0.18, 0.012, 0.012, u + 0.27, v - 0.2 + i * 0.05, 0.355, { color: '#b9b7b0', vari: 0 }));
      for (const sg of [-1, 1]) {
        hierros.push(cajaC(cara, 0.035, 0.035, 0.42, u + sg * 0.32, v - 0.31, 0.21));
        hierros.push(cajaC(cara, 0.035, 0.45, 0.03, u + sg * 0.32, v - 0.1, 0.015));
      }
      util.push(tuboC(cara, [u + 0.42, v - 0.15, 0.2], [u + 0.52, v - 0.15, 0.2], 0.02, { color: '#e8e6e0' }));
      util.push(tuboC(cara, [u + 0.52, v - 0.15, 0.2], [u + 0.52, v + 0.62, 0.04], 0.02, { color: '#e8e6e0' }));
    }
    aire('A', 2.5, PISO * 2 + 0.5);
    aire('B', 7.3, PISO + 0.5);

    // bajadas de agua de fierro galvanizado: embudo, abrazaderas, codo y salida a una canaleta
    function bajada(cara, u) {
      const w = 0.13, r = 0.05;
      galv.push(tuboC(cara, [u, 0.42, w], [u, 13.02, w], r, { seg: 12 }));
      galv.push(tuboC(cara, [u, 0.47, w], [u, 0.24, w + 0.22], r, { seg: 12 }));
      galv.push(tuboC(cara, [u, 0.26, w + 0.2], [u, 0.21, w + 0.4], r, { seg: 12 }));
      galv.push(cajaC(cara, 0.26, 0.32, 0.2, u, 13.18, 0.14));
      galv.push(tuboC(cara, [u, 13.5, -0.02], [u, 13.5, 0.2], 0.04, { seg: 10 }));
      for (let v = 1.6; v < 12.8; v += 2.1) {
        galv.push(tuboC(cara, [u, v - 0.02, w], [u, v + 0.02, w], r + 0.008, { seg: 12 }));
        galv.push(cajaC(cara, 0.035, 0.04, w, u, v, w / 2));
      }
      piedra.push(cajaC(cara, 0.3, 0.05, 0.55, u, 0.04, w + 0.6, { color: GRIS }));
    }
    bajada('A', -5.75); bajada('A', 5.75); bajada('B', 8.75);

    // ---------------------------------------------------------------- habitación tras la ventana abierta del tercer piso
    {
      const pared = '#e8e1d4', piso = '#7a5236', cielo = '#f1eee8', y0 = PISO * 2;
      const pl = (w, h, o, color) => pintar(ubicar(new THREE.PlaneGeometry(w, h), o), color, 0.03);
      const hab = [
        pl(2.95, 2.9, { x: 1.725, y: y0, z: -2.5, rx: -PI / 2 }, piso),
        pl(2.95, 2.9, { x: 1.725, y: y0 + 2.95, z: -2.5, rx: PI / 2 }, cielo),
        pl(2.9, 2.95, { x: 3.2, y: y0 + 1.475, z: -2.5, ry: -PI / 2 }, pared),
        pl(2.95, 2.95, { x: 1.725, y: y0 + 1.475, z: -3.95 }, pared),
        pl(2.95, 2.95, { x: 1.725, y: y0 + 1.475, z: -1.05, ry: PI }, pared),
        caja(0.04, 0.5, 0.7, { x: 3.17, y: y0 + 1.7, z: -2.3, color: '#5a4030' }),     // cuadro: marco
        caja(0.045, 0.42, 0.62, { x: 3.16, y: y0 + 1.7, z: -2.3, color: '#6f8a9e' }),  // cuadro: tela
        tubo([1.7, y0 + 2.95, -2.5], [1.7, y0 + 2.6, -2.5], 0.005, { color: '#222222' }),
        torno([[0, 0], [0.2, 0], [0.16, 0.14], [0.05, 0.16], [0, 0.16]], 18, { x: 1.7, y: y0 + 2.46, z: -2.5 }),  // lámpara
        caja(0.38, 1.9, 0.9, { x: 2.95, y: y0 + 0.95, z: -3.45, color: '#8b6a4b' }),    // estante
      ];
      pintar(hab[8], '#efe6d2', 0);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) {
        if (azar() < 0.25) continue;
        const h = 0.2 + azar() * 0.08;
        hab.push(caja(0.04 + azar() * 0.02, h, 0.22, { x: 2.74, y: y0 + 0.25 + i * 0.45 + h / 2, z: -3.8 + j * 0.1, color: ['#8c3b2f', '#2f4f6f', '#c9a64a', '#4e6b3c', '#d8d0c0'][Math.floor(azar() * 5)] }));
      }
      // cortinas recogidas a los lados de la ventana, con pliegues, y su barra
      for (const [z0, z1] of [[-3.5, -3.18], [-1.82, -1.5]]) {
        const geo = new THREE.PlaneGeometry(z1 - z0, 2.55, 14, 1), p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, 0.035 * Math.sin((p.getX(i) / (z1 - z0)) * 14 * PI));
        geo.computeVertexNormals();
        hab.push(pintar(ubicar(geo, { x: 0.37, y: y0 + 1.53, z: (z0 + z1) / 2, ry: -PI / 2 }), '#c9b48f', 0.03));
      }
      hab.push(tubo([0.36, y0 + 2.83, -3.6], [0.36, y0 + 2.83, -1.4], 0.012, { color: '#3a3330' }));
      kit.malla(unir(hab, true), new THREE.MeshStandardMaterial({ vertexColors: true, map: texSucio, roughness: 0.88, side: THREE.DoubleSide }), { padre: g, sombra: false });
    }

    // ---------------------------------------------------------------- patio de hormigón con juntas, vereda y soleras
    function texturaPatio() {
      const S = 512, [c, cx] = lienzo(S), x0 = -15.5, x1 = 9.6, z0 = -5.5, z1 = 8;
      const pu = S / (x1 - x0), pv = S / (z1 - z0), X = (x) => (x - x0) * pu, Z = (z) => (z - z0) * pv;
      const n1 = kit.fbm(S, 6, 5, 61), n2 = kit.fbm(S, 32, 3, 67), img = cx.createImageData(S, S), d = img.data;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const k = j * S + i, vereda = x0 + i / pu > 0, t = 0.9 + (n1[k] - 0.5) * 0.3 + (n2[k] - 0.5) * 0.13;
        const b = vereda ? [176, 171, 162] : [164, 160, 152];
        d[k * 4] = b[0] * t; d[k * 4 + 1] = b[1] * t; d[k * 4 + 2] = b[2] * t; d[k * 4 + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
      // suciedad junto al muro y a las soleras
      const banda = (xa, za, xb, zb, color) => { const gr = cx.createLinearGradient(xa, za, xb, zb); gr.addColorStop(0, color); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)')); cx.fillStyle = gr; cx.fillRect(Math.min(xa, xb), Math.min(za, zb), Math.abs(xb - xa) || S, Math.abs(zb - za) || S); };
      banda(X(0), 0, X(-0.8), 0, 'rgba(62,52,42,0.3)');
      banda(0, Z(8), 0, Z(7.4), 'rgba(62,52,42,0.28)');
      banda(X(-15.5), 0, X(-14.9), 0, 'rgba(62,52,42,0.25)');
      banda(0, Z(-5.5), 0, Z(-4.9), 'rgba(62,52,42,0.25)');
      // juntas del radier (cada 3 m) y palmetas de la vereda (50 cm)
      const junta = (xa, za, xb, zb) => {
        cx.lineCap = 'butt';
        cx.strokeStyle = 'rgba(46,44,40,0.8)'; cx.lineWidth = 1.5; trazo(cx, [[X(xa), Z(za)], [X(xb), Z(zb)]]);
        cx.strokeStyle = 'rgba(232,228,220,0.28)'; cx.lineWidth = 0.8; trazo(cx, [[X(xa) + 1.2, Z(za) + 1.2], [X(xb) + 1.2, Z(zb) + 1.2]]);
      };
      for (let x = -3; x > -15.4; x -= 3) junta(x, z0, x, z1);
      for (const z of [-3, 1.75, 4.75]) junta(x0, z, 0, z);
      for (let x = 0.5; x < 9.6; x += 0.5) junta(x, 6, x, z1);
      for (let z = 6.5; z < 8; z += 0.5) junta(0, z, x1, z);
      junta(0, z0, 0, 6.02);
      // manchas de aceite, óxido bajo el andamio, agua junto a la bajada y salpicaduras de mezcla
      for (const [x, z, r] of [[-7.6, 3.4, 0.6], [-11.8, 5.6, 0.45], [-4.4, -4.2, 0.35], [-13.6, 0.9, 0.5]]) mancha(cx, X(x), Z(z), r * pu, r * pv * 0.8, 'rgba(28,26,24,0.32)');
      mancha(cx, X(-9.1), Z(-3.9), 1.2 * pu, 0.7 * pv, 'rgba(118,70,34,0.22)');
      mancha(cx, X(-0.55), Z(-5.2), 0.5 * pu, 0.35 * pv, 'rgba(36,34,30,0.45)');
      mancha(cx, X(-0.55), Z(5.25), 0.45 * pu, 0.35 * pv, 'rgba(36,34,30,0.4)');
      for (const [x, z] of [[-1.15, -3.25], [-3.3, 5.4], [-2.6, -4.3]]) for (let i = 0; i < 14; i++) mancha(cx, X(x + (azar() - 0.5) * 1.2), Z(z + (azar() - 0.5) * 1.0), 1 + azar() * 3, 1 + azar() * 3, 'rgba(214,210,202,0.7)');
      // polvo de estuco caído al pie del muro
      for (let i = 0; i < 40; i++) mancha(cx, X(-0.1 - azar() * 0.6), Z(-1.2 + azar() * 2.4), 1 + azar() * 2.5, 1 + azar() * 2.5, 'rgba(196,160,120,0.6)');
      for (let i = 0; i < 7; i++) grieta(cx, X(-1 - azar() * 13.5), Z(-5 + azar() * 12.5), azar() * 2 * PI, 18 + azar() * 40, 1);
      return texDe(c, false);
    }
    {
      const sh = new THREE.Shape([V2(0, 5.5), V2(-15.5, 5.5), V2(-15.5, -8), V2(9.6, -8), V2(9.6, -6), V2(0, -6)]);
      const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-PI / 2);
      const tex = texturaPatio(); tex.repeat.set(1 / 25.1, 1 / 13.5); tex.offset.set(15.5 / 25.1, 8 / 13.5);
      const sup = kit.makeSurface('concrete', { seed: 3, repeat: [0.45, 0.45] });
      const patio = kit.malla(geo, new THREE.MeshStandardMaterial({ map: tex, normalMap: sup.normalMap, normalScale: V2(0.7, 0.7), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3 }), { y: 0.015, sombra: false, padre: g });
      void patio;
      // soleras de hormigón en el borde del patio y de la vereda
      piedra.push(caja(25.3, 0.3, 0.16, { x: -2.95, y: 0, z: 8.08, color: GRIS }));
      piedra.push(caja(0.16, 0.3, 13.75, { x: -15.58, y: 0, z: 1.25, color: GRIS }));
      piedra.push(caja(15.65, 0.3, 0.16, { x: -7.75, y: 0, z: -5.58, color: GRIS }));
      piedra.push(caja(0.16, 0.3, 2.0, { x: 9.68, y: 0, z: 7.0, color: GRIS }));
      // cámara de alcantarillado con tapa de fierro fundido
      piedra.push(caja(0.82, 0.03, 0.82, { x: -6.4, y: 0.02, z: 3.3, color: '#9a968d' }));
      hierros.push(ubicar(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 28), { x: -6.4, y: 0.03, z: 3.3 }));
      for (let i = -3; i <= 3; i++) hierros.push(caja(0.54 * Math.sqrt(1 - (i / 3.8) ** 2), 0.008, 0.02, { x: -6.4, y: 0.043, z: 3.3 + i * 0.07 }));
      // rejilla del sumidero junto a la bajada de agua
      piedra.push(caja(0.5, 0.03, 0.7, { x: -0.55, y: 0.02, z: -5.05, color: '#8e8a82' }));
      for (let i = 0; i < 9; i++) hierros.push(caja(0.4, 0.015, 0.018, { x: -0.55, y: 0.04, z: -5.33 + i * 0.07 }));
    }

    // ---------------------------------------------------------------- utilería de la obra
    // marco de andamio: dos pies derechos, travesaños, refuerzos y pasador; m ubica el marco (u horizontal, v hacia arriba)
    const marco = (m) => {
      const piezas = [
        tubo([-0.53, 0, 0], [-0.53, 1.95, 0], 0.024), tubo([0.53, 0, 0], [0.53, 1.95, 0], 0.024),
        tubo([-0.53, 1.88, 0], [0.53, 1.88, 0], 0.021), tubo([-0.53, 0.14, 0], [0.53, 0.14, 0], 0.021), tubo([-0.53, 1.0, 0], [0.53, 1.0, 0], 0.018),
        tubo([-0.53, 1.6, 0], [-0.24, 1.88, 0], 0.014), tubo([0.53, 1.6, 0], [0.24, 1.88, 0], 0.014),
        tubo([-0.53, 1.95, 0], [-0.53, 2.08, 0], 0.019), tubo([0.53, 1.95, 0], [0.53, 2.08, 0], 0.019),
        tubo([-0.53, 0.42, 0], [-0.53, 0.47, 0], 0.033), tubo([0.53, 0.42, 0], [0.53, 0.47, 0], 0.033),
      ];
      for (const p of piezas) galv.push(p.applyMatrix4(m));
    };
    const matriz = (x, y, z, rx, ry, rz, orden) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, orden)), UNO);
    // andamio desarmado: marcos apilados, dos apoyados en el muro, crucetas, husillos y tablones
    for (let k = 0; k < 4; k++) marco(matriz(-8.05 + (azar() - 0.5) * 0.12, 0.024 + 0.048 * k, -3.9 + (azar() - 0.5) * 0.1, -PI / 2, PI / 2 + (azar() - 0.5) * 0.08, 0, 'YXZ'));
    marco(matriz(3.1, 0, 6.47, -0.22, 0, 0, 'XYZ'));
    marco(matriz(3.22, 0, 6.57, -0.26, 0.04, 0, 'XYZ'));
    for (let i = 0; i < 6; i++) {
      const z = -2.95 + i * 0.04, y = 0.017 + (i > 3 ? 0.03 : 0), xa = -10.35 + azar() * 0.1, xb = -8.0 - azar() * 0.1;
      galv.push(tubo([xa, y, z], [xb, y, z + (azar() - 0.5) * 0.06], 0.016));
      for (const xx of [xa - 0.04, xb + 0.04]) galv.push(caja(0.08, 0.008, 0.04, { x: xx, y: y - 0.008, z }));
    }
    for (let i = 0; i < 4; i++) {
      const x = -10.9 + i * 0.22, z = -2.7 + (azar() - 0.5) * 0.2, a = (azar() - 0.5) * 0.6;
      galv.push(caja(0.15, 0.008, 0.15, { x, y: 0.02, z, ry: a }));
      galv.push(tubo([x, 0.035, z], [x + Math.sin(a) * 0.5, 0.035, z + Math.cos(a) * 0.5], 0.017));
      galv.push(caja(0.07, 0.04, 0.04, { x: x + Math.sin(a) * 0.3, y: 0.035, z: z + Math.cos(a) * 0.3, ry: a }));
    }
    for (const z of [-4.4, -2.75]) madera.push(caja(1.0, 0.07, 0.08, { x: -11.25, y: 0.035, z }));
    for (let i = 0; i < 3; i++) madera.push(caja(0.25, 0.045, 2.6, { x: -11.6 + i * 0.27, y: 0.0925, z: -3.6 + (azar() - 0.5) * 0.06, ry: (azar() - 0.5) * 0.02 }));
    for (let i = 0; i < 2; i++) madera.push(caja(0.25, 0.045, 2.6, { x: -11.45 + i * 0.29, y: 0.1375, z: -3.55 + (azar() - 0.5) * 0.1, ry: (azar() - 0.5) * 0.05 }));
    // palé con ladrillos fiscales (algunos ya se usaron)
    for (const dx of [-0.45, 0, 0.45]) madera.push(caja(0.1, 0.1, 1.2, { x: -13.0 + dx, y: 0.05, z: -3.6 }));
    for (let i = 0; i < 7; i++) madera.push(caja(1.02, 0.022, 0.12, { x: -13.0, y: 0.111, z: -4.11 + i * 0.17 }));
    const ladrillosPale = [];
    for (let capa = 0; capa < 4; capa++) for (let i = 0; i < 3; i++) for (let j = 0; j < 8; j++) {
      if (capa === 3 && azar() < 0.35) continue;
      ladrillosPale.push([-13.29 + i * 0.29 + (azar() - 0.5) * 0.01, 0.158 + capa * 0.072, -4.09 + j * 0.14 + (azar() - 0.5) * 0.01, (azar() - 0.5) * 0.02]);
    }
    // conos con franjas reflectantes y cinta de peligro
    const cono = (x, z) => {
      const perfil = [], colores = [];
      const r = (y) => 0.14 - ((y - 0.04) * 0.105) / 0.64;
      for (const [y, col] of [[0.04, 0], [0.3, 0], [0.3001, 1], [0.4, 1], [0.4001, 0], [0.48, 0], [0.4801, 1], [0.55, 1], [0.5501, 0], [0.68, 0]]) { perfil.push([r(y), y]); colores.push(col); }
      perfil.push([0.028, 0.7], [0, 0.7]); colores.push(0, 0);
      const geo = torno(perfil, 20, { x, z }), n = perfil.length, c = geo.attributes.position.count, a = new Float32Array(c * 3);
      const naranjo = new THREE.Color('#e5531b'), blanco = new THREE.Color('#eeeeea');
      for (let i = 0; i < c; i++) { const col = colores[i % n] ? blanco : naranjo; a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
      util.push(geo, caja(0.38, 0.04, 0.38, { x, y: 0.035, z, color: '#1c1c1c' }));
    };
    cono(-14.6, -2.0); cono(-14.6, 2.0); cono(-6.0, -4.9);
    // capacho de goma con mezcla y una plana
    util.push(pintar(torno([[0, 0.016], [0.125, 0.016], [0.13, 0.004], [0.16, 0.24], [0.172, 0.25], [0.174, 0.262], [0.162, 0.262], [0.15, 0.245], [0.12, 0.034], [0, 0.034]], 22, { x: -1.15, z: -3.25 }), '#1d1c1b', 0));
    util.push(pintar(ubicar(new THREE.CylinderGeometry(0.143, 0.143, 0.01, 20), { x: -1.15, y: 0.17, z: -3.25 }), '#8f8b83', 0.05));
    util.push(caja(0.11, 0.003, 0.22, { x: -1.12, y: 0.25, z: -3.22, rx: 1.0, ry: 0.4, color: '#7b7d80' }));
    util.push(tubo([-1.1, 0.33, -3.17], [-1.08, 0.45, -3.1], 0.014, { color: '#6d4b2e' }));
    // caja de herramientas, nivel y martillo
    util.push(caja(0.48, 0.2, 0.23, { x: -0.55, y: 0.115, z: -2.85, ry: 0.25, color: '#b3311e' }));
    util.push(caja(0.5, 0.05, 0.245, { x: -0.55, y: 0.24, z: -2.85, ry: 0.25, color: '#9e2a19' }));
    util.push(tubo([-0.66, 0.31, -2.88], [-0.44, 0.31, -2.82], 0.012, { color: '#1a1a1a' }));
    for (const dx of [-0.11, 0.11]) util.push(tubo([-0.55 + dx, 0.265, -2.85 + dx * 0.26], [-0.55 + dx, 0.31, -2.85 + dx * 0.26], 0.009, { color: '#1a1a1a' }));
    util.push(caja(0.6, 0.026, 0.055, { x: -1.0, y: 0.028, z: -2.45, ry: -0.5, color: '#e3b51c' }));
    util.push(caja(0.05, 0.014, 0.02, { x: -1.0, y: 0.045, z: -2.45, ry: -0.5, color: '#7fd36a' }));
    util.push(caja(0.032, 0.025, 0.3, { x: -1.45, y: 0.028, z: -2.7, ry: 0.9, color: '#7b5a3a' }));
    util.push(caja(0.11, 0.03, 0.032, { x: -1.45 + Math.sin(0.9) * 0.15, y: 0.03, z: -2.7 + Math.cos(0.9) * 0.15, ry: 0.9, color: '#3a3c3e' }));
    // pala apoyada en el muro
    util.push(tubo([-0.44, 0.33, -3.4], [-0.07, 1.33, -3.4], 0.017, { color: '#8a6a45' }));
    util.push(caja(0.13, 0.03, 0.035, { x: -0.06, y: 1.36, z: -3.4, rz: -0.36, color: '#1e1e1e' }));
    util.push(caja(0.006, 0.3, 0.24, { x: -0.5, y: 0.175, z: -3.4, rz: -0.363, color: '#4f5357' }));
    util.push(tubo([-0.46, 0.29, -3.4], [-0.43, 0.37, -3.4], 0.022, { color: '#3d4043' }));
    // sacos de cemento
    const saco = (o, color) => {
      const geo = new THREE.BoxGeometry(0.44, 0.13, 0.64, 4, 1, 4), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 1 - 0.45 * Math.max(Math.abs(p.getX(i) / 0.22), Math.abs(p.getZ(i) / 0.32)) ** 3; p.setY(i, p.getY(i) * k); }
      geo.computeVertexNormals(); geo.translate(0, 0.065, 0);
      return ubicar(pintar(geo, color, 0.06), o);
    };
    util.push(saco({ x: -3.3, y: 0.015, z: -4.7, ry: 0.2 }, '#cbb68e'), saco({ x: -2.82, y: 0.015, z: -4.62, ry: -0.1 }, '#c7b089'), saco({ x: -3.05, y: 0.11, z: -4.66, ry: 0.5 }, '#cdb994'));
    // letrero de advertencia en su atril
    const texLetrero = (() => {
      const [c, cx] = lienzo(256, 192);
      cx.fillStyle = '#f2c419'; cx.fillRect(0, 0, 256, 192);
      cx.strokeStyle = '#151515'; cx.lineWidth = 10; cx.strokeRect(8, 8, 240, 176);
      cx.fillStyle = '#151515'; cx.beginPath(); cx.moveTo(128, 26); cx.lineTo(168, 92); cx.lineTo(88, 92); cx.closePath(); cx.fill();
      cx.fillStyle = '#f2c419'; cx.fillRect(124, 46, 8, 28); cx.fillRect(124, 79, 8, 7);
      cx.fillStyle = '#151515'; cx.textAlign = 'center'; cx.font = 'bold 34px sans-serif'; cx.fillText('PELIGRO', 128, 132);
      cx.font = 'bold 19px sans-serif'; cx.fillText('TRABAJOS EN ALTURA', 128, 162);
      return texDe(c, false);
    })();
    {
      const ry = 0.55, nx = Math.sin(ry), nz = Math.cos(ry), px = -14.1, pz = 3.2;
      kit.malla(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshStandardMaterial({ map: texLetrero, roughness: 0.6 }), { x: px + nx * 0.008, y: 0.93, z: pz + nz * 0.008, ry, sombra: false, padre: g });
      util.push(caja(0.62, 0.47, 0.012, { x: px, y: 0.93, z: pz, ry, color: '#2a2b2c' }));
      for (const sg of [-1, 1]) galv.push(tubo([px + sg * 0.27 * nz - nx * 0.14, 0, pz - sg * 0.27 * nx - nz * 0.14], [px + sg * 0.27 * nz - nx * 0.016, 0.72, pz - sg * 0.27 * nx - nz * 0.016], 0.014));
    }
    // carretilla con escombros
    {
      const b = [[-0.24, 0.36, -0.3], [0.24, 0.36, -0.3], [0.24, 0.36, 0.32], [-0.24, 0.36, 0.32]], t = [[-0.34, 0.62, -0.42], [0.34, 0.62, -0.42], [0.34, 0.62, 0.56], [-0.34, 0.62, 0.56]];
      const quads = [[b[0], b[1], b[2], b[3]], [b[0], t[0], t[1], b[1]], [b[1], t[1], t[2], b[2]], [b[2], t[2], t[3], b[3]], [b[3], t[3], t[0], b[0]]];
      const pos = [], uv = [];
      for (const [p0, p1, p2, p3] of quads) { pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3); uv.push(0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0); }
      const batea = new THREE.BufferGeometry();
      batea.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); batea.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); batea.computeVertexNormals();
      const piezas = [pintar(batea, '#3f6e3a', 0.04)];
      for (let i = 0; i < 4; i++) piezas.push(tubo(t[i], t[(i + 1) % 4], 0.013, { color: '#35603a' }));
      const rueda = new THREE.TorusGeometry(0.15, 0.05, 10, 22); rueda.rotateY(PI / 2); rueda.translate(0, 0.2, 0.68);
      piezas.push(pintar(rueda, '#1b1b1b', 0), tubo([-0.07, 0.2, 0.68], [0.07, 0.2, 0.68], 0.06, { color: '#8d9093', seg: 14 }));
      for (const sg of [-1, 1]) {
        piezas.push(tubo([sg * 0.07, 0.2, 0.68], [sg * 0.2, 0.34, 0.1], 0.018, { color: '#2f3134' }), tubo([sg * 0.2, 0.34, 0.1], [sg * 0.3, 0.55, -0.95], 0.018, { color: '#2f3134' }));
        piezas.push(tubo([sg * 0.3, 0.55, -0.95], [sg * 0.31, 0.57, -1.12], 0.022, { color: '#151515' }));
        piezas.push(tubo([sg * 0.21, 0.37, -0.22], [sg * 0.23, 0.0, -0.3], 0.016, { color: '#2f3134' }));
      }
      const mc = matriz(-3.3, 0.015, 5.35, 0, -0.55, 0, 'XYZ');
      for (const p of piezas) util.push(p.applyMatrix4(mc));
    }

    // ---------------------------------------------------------------- escombros y ladrillos (instancias)
    const matEscombro = kit.mat('concrete', { repeat: [1.4, 1.4], seed: 17, color: 0xffffff, roughness: 1, normalScale: 1.2 });
    const trozos = [];
    const ponerTrozo = (x, y, z, sx, sy, sz, tipo) => trozos.push({ x, y, z, sx, sy, sz, tipo, rot: [azar() * 6, azar() * 6, azar() * 6] });
    for (let i = 0; i < 34; i++) { // montón junto a la esquina
      const a = azar() * 2 * PI, r = 0.85 * Math.sqrt(azar()), h = 0.5 * (1 - (r / 0.85) ** 2), sz = 0.07 + azar() * 0.12;
      ponerTrozo(-1.45 + Math.cos(a) * r, Math.max(sz * 0.5, h * azar() + sz * 0.3), 4.95 + Math.sin(a) * r * 0.8, sz * 1.2, sz * 0.75, sz, azar() < 0.45 ? 0 : azar() < 0.5 ? 1 : 2);
    }
    for (let i = 0; i < 8; i++) { const a = azar() * 2 * PI, r = azar() * 0.2; ponerTrozo(-3.3 + Math.cos(a) * r, 0.5 + azar() * 0.08, 5.35 + Math.sin(a) * r, 0.1, 0.07, 0.09, azar() < 0.5 ? 0 : 1); }
    for (let i = 0; i < 9; i++) { const sz = 0.02 + azar() * 0.04; ponerTrozo(-0.12 - azar() * 0.5, sz * 0.4 + 0.015, (azar() < 0.5 ? -1 : 1) * (0.55 + azar() * 0.4), sz * 1.4, sz * 0.5, sz, 1); }
    for (let i = 0; i < 6; i++) { const sz = 0.05 + azar() * 0.05; ponerTrozo(-2.2 - azar() * 1.2, sz * 0.4 + 0.015, 6.3 + azar() * 1.2, sz * 1.3, sz * 0.6, sz, azar() < 0.5 ? 0 : 2); }
    const colorTrozo = [new THREE.Color().setRGB(1.0, 0.98, 0.94), new THREE.Color().setRGB(1.9, 1.3, 0.72), new THREE.Color().setRGB(1.25, 0.36, 0.2)];
    {
      const geo = bulto(0.26, 2.3, 1), inst = new THREE.InstancedMesh(geo, matEscombro, trozos.length), m4 = new THREE.Matrix4();
      trozos.forEach((t, i) => {
        m4.compose(V3(t.x, t.y, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rot)), V3(t.sx, t.sy, t.sz));
        inst.setMatrixAt(i, m4); inst.setColorAt(i, colorTrozo[t.tipo]);
      });
      inst.castShadow = true; inst.receiveShadow = true; g.add(inst);
    }
    {
      const sueltos = [];
      for (let i = 0; i < 7; i++) { const a = azar() * 2 * PI, r = 0.3 + azar() * 0.6; sueltos.push([-1.45 + Math.cos(a) * r, 0.05 + azar() * 0.15, 4.95 + Math.sin(a) * r * 0.8, azar() * 3]); }
      const lista = [...ladrillosPale.map(([x, y, z, a]) => [x, y, z, a, 0]), ...sueltos.map(([x, y, z, a]) => [x, y, z, a, 0.5])];
      const geo = caja(0.29, 0.071, 0.14), inst = new THREE.InstancedMesh(geo, matEscombro, lista.length), m4 = new THREE.Matrix4();
      lista.forEach(([x, y, z, a, inc], i) => {
        m4.compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(inc * (azar() - 0.5), a, inc * (azar() - 0.5))), UNO);
        inst.setMatrixAt(i, m4); inst.setColorAt(i, new THREE.Color().setRGB(1.3 + azar() * 0.25, 0.42 + azar() * 0.08, 0.24));
      });
      inst.castShadow = true; inst.receiveShadow = true; g.add(inst);
    }

    // ---------------------------------------------------------------- materiales de lo estático y mallas unidas
    const texVidrios = (() => {
      const S = 256, [c, cx] = lienzo(S), h = S / 2;
      for (let q = 0; q < 4; q++) {
        const ox = (q % 2) * h, oy = Math.floor(q / 2) * h;
        cx.save(); cx.beginPath(); cx.rect(ox, oy, h, h); cx.clip();
        const gr = cx.createLinearGradient(0, oy, 0, oy + h); gr.addColorStop(0, '#3a4954'); gr.addColorStop(0.55, '#1c252c'); gr.addColorStop(1, '#12181d');
        cx.fillStyle = gr; cx.fillRect(ox, oy, h, h);
        if (q === 1) { // cortinas corridas a los lados
          for (const lado of [0, 1]) for (let i = 0; i < 12; i++) { const w = (h * 0.38) / 12; cx.fillStyle = `hsl(36, 28%, ${50 + 12 * Math.sin(i * 1.4)}%)`; cx.fillRect(ox + (lado ? h - h * 0.38 : 0) + i * w, oy, w + 0.6, h); }
        } else if (q === 2) { // persiana a medio bajar
          for (let i = 0; i < 14; i++) { const y = oy + (i * h * 0.62) / 14; cx.fillStyle = '#c9c4b8'; cx.fillRect(ox, y, h, (h * 0.62) / 14 * 0.78); cx.fillStyle = 'rgba(0,0,0,0.28)'; cx.fillRect(ox, y + (h * 0.62) / 14 * 0.62, h, (h * 0.62) / 14 * 0.16); }
        } else if (q === 3) { // muebles en penumbra
          cx.fillStyle = '#2a2420'; cx.fillRect(ox + h * 0.1, oy + h * 0.55, h * 0.45, h * 0.45);
          cx.fillStyle = '#3b3229'; cx.fillRect(ox + h * 0.62, oy + h * 0.3, h * 0.3, h * 0.7);
          cx.fillStyle = '#2f4a2a'; cx.beginPath(); cx.arc(ox + h * 0.3, oy + h * 0.48, h * 0.12, 0, 2 * PI); cx.fill();
        }
        // reflejo del cielo
        const rf = cx.createLinearGradient(ox, oy, ox + h, oy + h);
        rf.addColorStop(0, 'rgba(205,222,240,0.42)'); rf.addColorStop(0.32, 'rgba(205,222,240,0.08)'); rf.addColorStop(0.46, 'rgba(255,255,255,0.22)');
        rf.addColorStop(0.56, 'rgba(205,222,240,0.05)'); rf.addColorStop(1, 'rgba(205,222,240,0.14)');
        cx.fillStyle = rf; cx.fillRect(ox, oy, h, h);
        cx.restore();
      }
      return texDe(c, false);
    })();
    const supMetal = kit.makeSurface('metal', { seed: 9, repeat: [1, 1] });
    const matPiedra = kit.mat('plaster', { repeat: [0.7, 0.7], seed: 12, normalScale: 0.9, roughness: 1 }); matPiedra.vertexColors = true;
    const matMarco = new THREE.MeshStandardMaterial({ color: 0xc8cbcd, metalness: 0.5, roughness: 0.42, map: texSucio, normalMap: supMetal.normalMap });
    const matVidrio = new THREE.MeshStandardMaterial({ map: texVidrios, roughness: 0.05, metalness: 0.15, envMapIntensity: 1.6, side: THREE.DoubleSide });
    const matHierro = new THREE.MeshStandardMaterial({ color: 0x2c2e30, metalness: 0.45, roughness: 0.55, map: texSucio });
    const matGalv = new THREE.MeshStandardMaterial({ color: 0xc4c9cc, metalness: 0.62, roughness: 0.5, map: texSucio, normalMap: supMetal.normalMap, roughnessMap: supMetal.roughnessMap });
    const matMadera = kit.mat('wood', { repeat: [0.7, 0.45], seed: 4, color: 0xc4ab8c, roughness: 0.95 });
    const matUtil = new THREE.MeshStandardMaterial({ vertexColors: true, map: texSucio, roughness: 0.72, metalness: 0.05, side: THREE.DoubleSide });
    kit.malla(unir(piedra, true), matPiedra, { padre: g });
    kit.malla(unir(marcos), matMarco, { padre: g });
    kit.malla(unir(vidrios), matVidrio, { padre: g, sombra: false });
    kit.malla(unir(hierros), matHierro, { padre: g });
    kit.malla(unir(galv), matGalv, { padre: g });
    kit.malla(unir(madera), matMadera, { padre: g });
    kit.malla(unir(util, true), matUtil, { padre: g });
    // cinta de peligro entre los conos del fondo
    {
      const [c, cx] = lienzo(128, 16);
      for (let i = -2; i < 12; i++) { cx.fillStyle = i % 2 ? '#151515' : '#f2c419'; cx.beginPath(); cx.moveTo(i * 12, 16); cx.lineTo(i * 12 + 12, 16); cx.lineTo(i * 12 + 24, 0); cx.lineTo(i * 12 + 12, 0); cx.fill(); }
      const tex = texDe(c); tex.repeat.set(4 / 0.9, 1);
      const geo = new THREE.PlaneGeometry(4.0, 0.075, 16, 1), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = p.getX(i) / 2; p.setY(i, p.getY(i) - 0.11 * (1 - k * k)); p.setZ(i, 0.02 * Math.sin(k * 6)); }
      geo.computeVertexNormals();
      kit.malla(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side: THREE.DoubleSide }), { x: -14.6, y: 0.68, z: 0, ry: PI / 2, sombra: false, padre: g });
    }

    // ---------------------------------------------------------------- escalera telescópica de aluminio
    // Coordenadas propias: origen en el apoyo del pie, +y a lo largo de la escalera, +x hacia afuera de la pared (cara de subida).
    const escalera = new THREE.Group(); g.add(escalera);
    const largueros = [], peldanos = [], acc = [];
    const TRAMOS = [{ y0: 0.06, y1: 7.4, xc: 0.045, zr: 0.24, p0: 0.3 }, { y0: 5.9, y1: 12.97, xc: 0.122, zr: 0.205, p0: 6.18 }];
    for (const t of TRAMOS) {
      const L = t.y1 - t.y0, ym = (t.y0 + t.y1) / 2;
      for (const sg of [-1, 1]) {
        const zw = sg * t.zr;
        largueros.push(caja(0.072, L, 0.004, { x: t.xc, y: ym, z: zw, uvGiro: true }));                                       // alma
        for (const dx of [-0.034, 0.034]) largueros.push(caja(0.004, L, 0.026, { x: t.xc + dx, y: ym, z: zw - sg * 0.013, uvGiro: true })); // alas
      }
      for (let y = t.p0; y < t.y1 - 0.15; y += 0.28) {
        peldanos.push(tubo([t.xc, y, -t.zr], [t.xc, y, t.zr], 0.016, { seg: 12, uvCrudo: true }));
        for (const sg of [-1, 1]) largueros.push(tubo([t.xc, y, sg * (t.zr + 0.001)], [t.xc, y, sg * (t.zr + 0.006)], 0.022, { seg: 10 })); // remaches
      }
    }
    for (const sg of [-1, 1]) {
      acc.push(caja(0.17, 0.13, 0.036, { x: 0.08, y: 12.92, z: sg * 0.205, color: '#1e1e1e' }));    // apoyo de goma contra la pared
      acc.push(caja(0.085, 0.05, 0.034, { x: 0.045, y: 0.05, z: sg * 0.24, color: '#222222' }));     // tapa inferior
      acc.push(caja(0.17, 0.1, 0.052, { x: 0.085, y: 7.32, z: sg * 0.232, color: '#26292c' }));     // guía del tramo superior
      acc.push(caja(0.165, 0.09, 0.05, { x: 0.085, y: 6.05, z: sg * 0.21, color: '#26292c' }));     // guía inferior del tramo superior
      acc.push(caja(0.06, 0.13, 0.05, { x: 0.18, y: 6.3, z: sg * 0.17, color: '#c43b22' }));        // traba de peldaño
    }
    acc.push(tubo([0.1, 7.27, -0.03], [0.1, 7.27, 0.03], 0.042, { color: '#3a3d40', seg: 18 }));  // polea
    acc.push(tubo([0.072, 0.58, 0], [0.072, 7.25, 0], 0.006, { color: '#e0a526', seg: 6 }));      // cuerda
    acc.push(tubo([0.135, 7.27, 0], [0.135, 6.2, 0], 0.006, { color: '#e0a526', seg: 6 }));
    for (let i = 0; i < 5; i++) acc.push(tubo([0.07 + Math.sin(i) * 0.01, 0.62 - i * 0.04, -0.02], [0.07 + Math.cos(i) * 0.01, 0.6 - i * 0.04, 0.02], 0.008, { color: '#d39b22', seg: 6 }));
    // adhesivos de advertencia en las almas del tramo base
    const texAdhesivo = (() => {
      const [c, cx] = lienzo(64, 256);
      cx.fillStyle = '#f2c51b'; cx.fillRect(0, 0, 64, 256); cx.fillStyle = '#151515'; cx.fillRect(0, 0, 64, 40); cx.fillRect(0, 248, 64, 8);
      cx.fillStyle = '#f2c51b'; cx.font = 'bold 26px sans-serif'; cx.textAlign = 'center'; cx.fillText('!', 32, 30);
      cx.save(); cx.translate(32, 148); cx.rotate(-PI / 2); cx.fillStyle = '#151515'; cx.font = 'bold 19px sans-serif'; cx.textAlign = 'center';
      cx.fillText('ADVERTENCIA', 0, -8); cx.font = '12px sans-serif'; cx.fillText('Apoyo a 75° · Pie trabado', 0, 12); cx.restore();
      return texDe(c, false);
    })();
    const adhesivos = [];
    for (const sg of [-1, 1]) { const p = new THREE.PlaneGeometry(0.058, 0.42); if (sg < 0) p.rotateY(PI); adhesivos.push(p.translate(0.045, 1.25, sg * (0.24 + 0.0025))); }
    const supRibs = kit.makeSurface('ribbed', { seed: 2, repeat: [3, 1] });
    const alu = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, metalness: 0.55, roughness: 0.36, normalMap: supMetal.normalMap, normalScale: V2(0.4, 0.4), roughnessMap: supMetal.roughnessMap, envMapIntensity: 0.9 });
    const aluPeldano = new THREE.MeshStandardMaterial({ color: 0xd9dde1, metalness: 0.5, roughness: 0.45, normalMap: supRibs.normalMap, normalScale: V2(1.2, 1.2), envMapIntensity: 0.9 });
    kit.malla(unir(largueros), alu, { padre: escalera });
    kit.malla(unir(peldanos), aluPeldano, { padre: escalera });
    kit.malla(unir(acc, true), matUtil, { padre: escalera });
    kit.malla(unir(adhesivos), new THREE.MeshStandardMaterial({ map: texAdhesivo, roughness: 0.5 }), { padre: escalera, sombra: false });
    const focoObrero = new THREE.Object3D(); focoObrero.position.set(0.1, 3.4, 0); escalera.add(focoObrero);
    const focoCima = new THREE.Object3D(); focoCima.position.set(0.1, 12.4, 0); escalera.add(focoCima);
    // zapatas de goma articuladas: quedan planas en el suelo mientras la escalera gira sobre el perno
    const pies = new THREE.Group(); g.add(pies);
    {
      const z = [];
      for (const zc of [-0.24, 0.24]) {
        z.push(caja(0.17, 0.026, 0.082, { y: 0.028, z: zc, color: '#1b1b1b' }));
        for (let i = 0; i < 6; i++) z.push(caja(0.012, 0.006, 0.084, { x: -0.07 + i * 0.028, y: 0.018, z: zc, color: '#121212' })); // dibujo de la suela
        z.push(caja(0.15, 0.012, 0.074, { y: 0.047, z: zc, color: '#2a2a2a' }));
        for (const dz of [-0.026, 0.026]) z.push(caja(0.05, 0.06, 0.006, { y: 0.075, z: zc + dz, color: '#9aa0a5' }));
        z.push(tubo([0, 0.072, zc - 0.034], [0, 0.072, zc + 0.034], 0.008, { color: '#7d8186' }));
      }
      kit.malla(unir(z, true), matUtil, { padre: pies });
    }
    // marcas de arrastre que deja el pie en el hormigón
    const texRastro = (() => {
      const [c, cx] = lienzo(256, 64);
      for (const fila of [64 * (0.35 - 0.24) / 0.7, 64 * (0.35 + 0.24) / 0.7]) for (let i = 0; i < 26; i++) {
        const y = fila + (azar() - 0.5) * 5, x0 = azar() * 256;
        cx.strokeStyle = azar() < 0.6 ? `rgba(40,38,36,${0.15 + azar() * 0.3})` : `rgba(235,232,226,${0.15 + azar() * 0.25})`;
        cx.lineWidth = 0.6 + azar() * 1.2; cx.beginPath(); cx.moveTo(x0, y); cx.lineTo(x0 + 60 + azar() * 160, y + (azar() - 0.5) * 1.5); cx.stroke();
      }
      return texDe(c);
    })();
    const rastro = kit.malla(new THREE.PlaneGeometry(1, 0.7), new THREE.MeshStandardMaterial({ map: texRastro, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -5 }), { rx: -PI / 2, y: 0.018, sombra: false, padre: g });

    // ---------------------------------------------------------------- personas
    // Obrero junto al muro: tranquilo con los brazos cruzados; mientras la escalera resbala se lleva las manos al casco.
    const obrero = kit.persona({ preset: 'obrero', semilla: 11, barba: 'bigote', chaleco: 'naranjo', colorSuperior: '#45563f', guantes: '#7a5f3c', padre: g, x: -2.05, z: -2.35, ry: -0.32 });
    obrero.posar('brazosCruzados').transicion(0.01);
    obrero.mirar(focoObrero);
    // Vecina asomada a la ventana del tercer piso, con los antebrazos en el alféizar; al resbalar la escalera se tapa la boca.
    const vecina = kit.persona({ preset: 'civilMujer', semilla: 23, manga: 'larga', colorSuperior: '#7d3046', colorPelo: kit.PELOS.castano, padre: g, x: 0.46, y: PISO * 2, z: -2.5, ry: -PI / 2 });
    const ASOMADA = {
      ...kit.POSES.reposo(), cadera: [0.3, 0, 0], columna: [0.3, 0.05, 0], pecho: [0.28, 0.1, 0], cuello: [-0.28, 0, 0], cabeza: [-0.2, 0, 0],
      musloD: [0.02, 0, -0.04], musloI: [0.02, 0, 0.04], piernaD: [0.02, 0, 0], piernaI: [0.02, 0, 0], pieD: [0, 0, 0.04], pieI: [0, 0, -0.04], dedosD: 0.4, dedosI: 0.4,
    };
    const ASUSTADA = { ...ASOMADA, pecho: [0.18, 0.16, 0], dedosD: 0.2 };
    vecina.posar(ASOMADA).transicion(0.01);
    vecina.mirar(focoCima);
    const enMundo = (x, y, z) => g.localToWorld(V3(x, y, z)), dirMundo = (x, y, z) => V3(x, y, z).transformDirection(g.matrixWorld);
    const apoyoD = enMundo(-0.12, PISO * 2 + 0.99, -2.67), apoyoI = enMundo(-0.12, PISO * 2 + 0.99, -2.33);
    const poloApoyoD = dirMundo(0.4, -1, -0.5), poloApoyoI = dirMundo(0.4, -1, 0.5), poloBoca = dirMundo(0.3, -1, -0.45);
    const boca = new THREE.Object3D(); boca.position.set(0.0, -0.06, 0.15); vecina.huesos.cabeza.add(boca);
    const manoD = apoyoD.clone(), poloD = poloApoyoD.clone(), vTmp = V3();
    vecina.alcanzar('D', manoD, poloD, 1); vecina.alcanzar('I', apoyoI, poloApoyoI, 1);
    obrero.actualizar(0); vecina.actualizar(0);

    // ---------------------------------------------------------------- triángulo, ángulo, cotas y rótulos
    const triGeo = new THREE.BufferGeometry();
    triGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    const tri = new THREE.Mesh(triGeo, new THREE.MeshBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    tri.position.z = 0.6; tri.renderOrder = 3; g.add(tri);
    // arco del ángulo θ (se actualiza en su lugar, sin crear geometría nueva)
    const NA = 32, arcoPos = new Float32Array((NA + 1) * 6), arcoGeo = new THREE.BufferGeometry();
    arcoGeo.setAttribute('position', new THREE.BufferAttribute(arcoPos, 3));
    { const ia = []; for (let i = 0; i < NA; i++) { const a = 2 * i; ia.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } arcoGeo.setIndex(ia); }
    const arco = new THREE.Mesh(arcoGeo, new THREE.MeshBasicMaterial({ color: 0xffd34d, side: THREE.DoubleSide, toneMapped: false }));
    arco.frustumCulled = false; g.add(arco);
    const cotaMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    const cx = kit.barra([0, 0, 0], [0, 1, 0], 0.03, cotaMat), cy = kit.barra([0, 0, 0], [0, 1, 0], 0.03, cotaMat);
    cx.castShadow = cy.castShadow = false;
    g.add(cx, cy);
    const lx = kit.etiqueta('x', 0.42, { bg: '#ffb347', color: '#1a1206' }), ly = kit.etiqueta('y', 0.42, { bg: '#5cc8ff', color: '#08202c' }), lt = kit.etiqueta('θ', 0.38, { bg: '#ffd34d', color: '#1a1206' });
    const lL = kit.etiqueta('13 m', 0.38);
    g.add(lx, ly, lt, lL);
    const X0 = 5 - (0.06 * 5) / M.L + (0.045 * 12) / M.L; // posición inicial del perno de las zapatas (distancia a la pared)

    function construir(rotulos = true) {
      const t = reloj.t, x = M.x(t), y = M.y(t), th = M.angulo(t);
      const ex = x / M.L, ey = y / M.L;
      escalera.position.set(-x, 0, 0);
      escalera.rotation.set(0, PI, Math.atan2(x, y)); // del pie (−x, 0) a la cima (0, y)
      const xp = x - 0.06 * ex + 0.045 * ey;           // perno de las zapatas, a xp de la pared
      pies.position.set(-xp, 0, 0);
      const largo = xp - X0;
      rastro.visible = largo > 0.03;
      rastro.scale.x = Math.max(0.001, largo); rastro.position.x = -(X0 + xp) / 2; texRastro.repeat.x = Math.max(0.1, largo / 1.6);
      const p = triGeo.attributes.position;
      p.setXYZ(0, 0, 0, 0); p.setXYZ(1, -x, 0, 0); p.setXYZ(2, 0, y, 0); p.needsUpdate = true; triGeo.computeBoundingSphere();
      for (let i = 0; i <= NA; i++) {
        const a = PI - (th * i) / NA, c = -Math.cos(a), sn = Math.sin(a);
        arcoPos.set([1.1 * c, 1.1 * sn, 0, 1.2 * c, 1.2 * sn, 0], i * 6);
      }
      arcoGeo.attributes.position.needsUpdate = true;
      arco.position.set(-x, 0.02, 0.62);
      kit.moverBarra(cx, [0, 0.06, 1.1], [-x, 0.06, 1.1]);
      kit.moverBarra(cy, [-0.15, 0, 1.1], [-0.15, Math.max(0.01, y), 1.1]);
      if (rotulos) {
        kit.cambiarEtiqueta(lx, `x = ${kit.num(x, 2)} m`);
        kit.cambiarEtiqueta(ly, `y = ${kit.num(y, 2)} m`);
        kit.cambiarEtiqueta(lt, `θ = ${kit.num((th * 180) / PI, 1)}°`);
      }
      // x va junto a su cota en el suelo y θ sobre la bisectriz del ángulo, más arriba: no se pisan para ningún x
      lx.position.set(-x / 2, 0.3, 1.25);
      ly.position.set(-0.9, Math.max(0.6, y / 2), 1.2);
      lt.position.set(-x + 2.0 * Math.cos(th / 2), 2.0 * Math.sin(th / 2) + 0.25, 0.9);
      lL.position.set(-x / 2 - 0.6, y / 2 + 1.15, 0.3); // sobre la escalera, lejos del rótulo de x aunque esta quede tendida
    }

    // ---------------------------------------------------------------- gráfico y panel (cerca del punto de vista en VR)
    const graf = kit.grafico({
      f: (t) => M.y(t), x0: 0, x1: M.fin, y0: 0, y1: 13, width: 1.3, height: 0.8,
      xTicks: [0, 0.4, 0.8, 1.2, 1.6], yTicks: [0, 4, 8, 12], tickFmt: (v) => kit.num(v, 1), yTickFmt: (v) => String(v),
      xLabel: 'tiempo t (s)', yLabel: 'altura y (m)', curveColor: 0x5cc8ff,
    });
    graf.group.position.set(-5.4, 1.05, 13.25); graf.group.rotation.y = -0.42;
    g.add(graf.group);
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => reloj.fijar(graf.xFromLocal(p.x)) });

    function revelar() {
      graf.removePoint('inst');
      if (s.revelar) graf.addPoint('inst', M.instante, 5, { color: 0x6fe3a2, labelX: 'x = 12 m', labelY: 'y = 5' });
      s.ultimo = -1;
    }
    const fmtRate = (v, u) => `${kit.num(v, 2)} ${u}`;
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'Escalera de 13 m apoyada en la pared. La base se aleja a 5 m/s. Interesa el instante en que la base está a 12 m de la pared.',
      ecuaciones: ['x² + y² = 13²   ⇒   2x·dx/dt + 2y·dy/dt = 0', 'A = xy/2,   cos θ = x/13'],
      lecturas: [
        { etiqueta: 'base x', valor: () => `${kit.num(M.x(reloj.t), 2)} m`, color: '#ffb347' },
        { etiqueta: 'altura y', valor: () => `${kit.num(M.y(reloj.t), 2)} m`, color: '#5cc8ff' },
        { etiqueta: 'dx/dt', valor: () => fmtRate(M.dxdt, 'm/s'), color: '#ffb347', escala: 0.72 },
        { etiqueta: 'dy/dt', valor: () => fmtRate(M.dydt(reloj.t), 'm/s'), color: '#5cc8ff', escala: 0.72 },
        { etiqueta: 'dA/dt', valor: () => fmtRate(M.dAdt(reloj.t), 'm²/s'), color: '#c9a7ff', escala: 0.66 },
        { etiqueta: 'dθ/dt', valor: () => fmtRate(M.dthdt(reloj.t), 'rad/s'), color: '#ffd34d', escala: 0.66 },
      ],
      deslizadores: [
        { etiqueta: 'Tiempo t', min: 0, max: M.fin, paso: 0.01, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 2)} s` },
        { etiqueta: 'Velocidad de la animación', min: 0.05, max: 1, paso: 0.05, color: '#ffb347', get: () => reloj.velocidad, set: (v) => { reloj.velocidad = v; }, formato: (v) => `${kit.num(v, 2)}×` },
      ],
      botones: [
        { etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() },
        { etiqueta: 'Ir a x = 12 m', accion: () => reloj.alInstante() },
        { etiqueta: 'Revelar respuesta', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      pie: () => (s.revelar
        ? 'Con x = 12 m: y = 5 m, dy/dt = −12·5/5 = −12 m/s (la cima baja a 12 m/s), dA/dt = (5·5 + 12·(−12))/2 = −59,5 m²/s y dθ/dt = −5/(13·sen θ) = −1 rad/s.'
        : 'Reproduce el deslizamiento o mueve el tiempo. La pendiente de la curva y(t) es dy/dt: mira cómo se acelera la caída al acercarse x a 13 m.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-7.35, 1.38, 13.5); panel.mesh.rotation.y = 0.5;
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    // los vidrios y el aluminio reflejan el cielo con su propia intensidad
    const conReflejo = [matVidrio, alu, aluPeldano];
    const reflejar = () => { for (const m of conReflejo) { m.envMap = kit.scene.environment; m.needsUpdate = true; } };
    reflejar();
    if (rev) reloj.fijar(rev.t);

    const vel = () => ({ tipo: 'boton', etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() });
    return {
      paneles: [panel],
      radioSombra: 16,
      alturaCartel: 15,
      vista: { escritorio: { camara: [-10.5, 4.6, 18.5], objetivo: [-4.2, 5.0, -0.5] }, vr: { pos: [-6, 0, 15], yaw: 0 } },
      dom: [
        vel(),
        { tipo: 'rango', etiqueta: 't', min: 0, max: M.fin, paso: 0.01, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 2)} s` },
        { tipo: 'boton', etiqueta: 'Ir a x = 12 m', accion: () => reloj.alInstante() },
        { tipo: 'interruptor', etiqueta: 'Revelar respuesta', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      actualizar(dt, activa) {
        if (activa && !rev) reloj.tick(dt);
        if (matVidrio.envMap !== kit.scene.environment) reflejar();
        s.tRotulos += dt;
        if (s.ultimo !== reloj.cambio) {
          s.ultimo = reloj.cambio;
          const rotulos = !reloj.corriendo || s.tRotulos > 0.08;
          if (rotulos) s.tRotulos = 0;
          construir(rotulos);
          graf.setMarker(reloj.t);
          const d = M.dydt(reloj.t);
          graf.setTangent(reloj.t, Number.isFinite(d) && Math.abs(d) < 60 ? d : null, { color: 0xffd08a, len: 0.4 });
          panel.invalidate();
        }
        // personas: calma, alarma mientras corre el reloj y manos en la cintura cuando la escalera ya cayó
        const alarma = reloj.corriendo || !!rev?.alarma, fin = !alarma && reloj.t >= M.fin - 1e-3;
        const estado = alarma ? 'alarma' : fin ? 'fin' : 'calma';
        if (estado !== s.estado) {
          s.estado = estado;
          if (estado === 'alarma') obrero.posar('alarma').transicion(0.3);
          else if (estado === 'fin') obrero.posar('jarras').transicion(0.9);
          else obrero.posar('brazosCruzados').transicion(0.8);
          vecina.posar(alarma ? ASUSTADA : ASOMADA).transicion(0.4);
        }
        const k = 1 - Math.exp(-dt * 5);
        if (alarma) { boca.getWorldPosition(vTmp); manoD.lerp(vTmp, k); poloD.lerp(poloBoca, k); } else { manoD.lerp(apoyoD, k); poloD.lerp(poloApoyoD, k); }
        obrero.actualizar(dt);
        vecina.actualizar(dt);
      },
    };
  },
};
