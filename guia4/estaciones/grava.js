// Ejemplo 8. Una correa transportadora vierte grava a 30 pies³/min y forma un cono con diámetro igual a la altura.
import { GRAVA as M } from '../../src/math/guia4.js';

const PIE = 0.3048; // metros por pie

export default {
  id: 'grava',
  tipo: 'razon',
  etiqueta: 'Ejemplo 8 · Razón de cambio',
  titulo: 'Cono de grava',
  resumen: 'Una correa transportadora descarga grava a razón de 30 pies³/min y forma un montón en forma de cono cuyo diámetro de la base es siempre igual a su altura. ¿Con qué rapidez crece la altura del montón cuando tiene 10 pies de alto?',

  crear(kit, est) {
    const { THREE } = kit;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    // La escena se arma girada media vuelta dentro del grupo de la estación: así la persona mira
    // el montón con el sol a la espalda y la cara visible del cono queda iluminada.
    const g = new THREE.Group();
    g.rotation.y = Math.PI;
    est.grupo.add(g);
    g.updateMatrixWorld(true);
    const giro = (v) => [-v[0], v[1], -v[2]]; // coordenadas de la escena a coordenadas del grupo
    // Revisión: rev=t:4,pala:2.2 deja el reloj en t = 4 min y al palero detenido en ese instante de su animación
    const REV = {};
    for (const par of (new URLSearchParams(location.search).get('rev') || '').split(',')) {
      const [k, v] = par.split(':');
      if (k && v !== undefined && Number.isFinite(Number(v))) REV[k] = Number(v);
    }
    const reloj = kit.reloj({ t0: 0, t1: 12, instante: M.instante, velocidad: 0.5 });
    reloj.t = REV.t ?? 3; // al llegar, el montón ya tiene forma
    const s = { revelar: false, ultimo: -1 };
    const Y = V(0, 1, 0);

    // ------------------------------------------------------------ utilidades de geometría
    const qE = (x, y, z, orden = 'XYZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, orden));
    const mat4 = (p, q = null, e = null) => new THREE.Matrix4().compose(p, q ?? new THREE.Quaternion(), e ?? V(1, 1, 1));
    const mm = (x, y, z, rx = 0, ry = 0, rz = 0) => mat4(V(x, y, z), qE(rx, ry, rz));
    // geometría base a lo largo de y (alto 1) estirada entre a y b
    function tramo(a, b) {
      const d = V().subVectors(b, a), len = Math.max(1e-4, d.length());
      return mat4(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), V(1, len, 1));
    }
    const caja = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cil = (r, h, seg = 16, r2 = r, abierto = false) => new THREE.CylinderGeometry(r2, r, h, seg, 1, abierto);
    // caja de cantos redondeados (radio r), con normales suaves en los cantos
    function cajaR(w, h, d, r = 0.02) {
      const geo = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3);
      const p = geo.attributes.position, n = geo.attributes.normal;
      const H = [w / 2, h / 2, d / 2], I = H.map((v) => Math.max(0, v - r));
      const q = V(), c = V();
      for (let i = 0; i < p.count; i++) {
        const v = [p.getX(i), p.getY(i), p.getZ(i)].map((t, k) => Math.sign(t) * (Math.abs(t) > 0.4 ? H[k] : I[k]));
        q.set(...v.map((t, k) => Math.max(-I[k], Math.min(I[k], t))));
        c.set(...v).sub(q);
        if (c.lengthSq() > 1e-12) { c.normalize(); p.setXYZ(i, q.x + c.x * r, q.y + c.y * r, q.z + c.z * r); n.setXYZ(i, c.x, c.y, c.z); }
      }
      return geo;
    }
    // da vuelta los triángulos cuya cara no coincide con las normales de sus vértices
    function orientar(geo) {
      const p = geo.attributes.position, n = geo.attributes.normal, ix = geo.index.array;
      const a = V(), b = V(), c = V(), m = V();
      for (let t = 0; t < ix.length; t += 3) {
        a.fromBufferAttribute(p, ix[t]); b.fromBufferAttribute(p, ix[t + 1]); c.fromBufferAttribute(p, ix[t + 2]);
        b.sub(a); c.sub(a); b.cross(c);
        m.fromBufferAttribute(n, ix[t]).add(V().fromBufferAttribute(n, ix[t + 1])).add(V().fromBufferAttribute(n, ix[t + 2]));
        if (b.dot(m) < 0) { const k = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = k; }
      }
      return geo;
    }
    function geoDe(pos, nor, idx) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (nor) geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setIndex(idx);
      if (!nor) geo.computeVertexNormals();
      return geo;
    }
    // lámina con espesor que sigue un perfil abierto [[z, y], ...] y se extiende en x (guardabarros, balde)
    function cascara(perfil, espesor, ancho) {
      const n2 = perfil.map((_, i) => {
        const a = perfil[Math.max(0, i - 1)], b = perfil[Math.min(perfil.length - 1, i + 1)];
        const dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy);
        return [-dy / l, dz / l];
      });
      const pos = [], nor = [], idx = [], N = perfil.length;
      const x0 = -ancho / 2, x1 = ancho / 2;
      const pto = (i, off) => [perfil[i][0] + n2[i][0] * off, perfil[i][1] + n2[i][1] * off];
      const vert = (x, zy, nn) => { pos.push(x, zy[1], zy[0]); nor.push(...nn); return pos.length / 3 - 1; };
      for (const [off, sg] of [[0, 1], [-espesor, -1]]) {
        const base = pos.length / 3;
        for (let i = 0; i < N; i++) for (const x of [x0, x1]) vert(x, pto(i, off), [0, n2[i][1] * sg, n2[i][0] * sg]);
        for (let i = 0; i < N - 1; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      for (const [x, sx] of [[x0, -1], [x1, 1]]) {
        const base = pos.length / 3;
        for (let i = 0; i < N; i++) { vert(x, pto(i, 0), [sx, 0, 0]); vert(x, pto(i, -espesor), [sx, 0, 0]); }
        for (let i = 0; i < N - 1; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      for (const [i, j] of [[0, 1], [N - 1, N - 2]]) {
        const tz = perfil[i][0] - perfil[j][0], ty = perfil[i][1] - perfil[j][1], l = Math.hypot(tz, ty), nn = [0, ty / l, tz / l];
        const a = vert(x0, pto(i, 0), nn), b = vert(x1, pto(i, 0), nn), c = vert(x0, pto(i, -espesor), nn), d = vert(x1, pto(i, -espesor), nn);
        idx.push(a, b, c, b, d, c);
      }
      return orientar(geoDe(pos, nor, idx));
    }
    // roca chancada: icosaedro con los vértices desplazados (caras planas, aristas vivas)
    function roca(semilla, k = 0.28) {
      const geo = new THREE.IcosahedronGeometry(1, 0), p = geo.attributes.position, rnd = kit.mulberry32(semilla), mapa = new Map();
      for (let i = 0; i < p.count; i++) {
        const clave = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
        if (!mapa.has(clave)) mapa.set(clave, 1 - k / 2 + rnd() * k);
        const f = mapa.get(clave);
        p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.8, p.getZ(i) * f);
      }
      geo.computeVertexNormals();
      return geo;
    }

    // ------------------------------------------------------------ texturas de lienzo
    const lienzo = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const texDe = (c, srgb = true) => {
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    // pintura industrial gastada: variación de tono, tierra, chorreados de óxido, saltaduras y rayas (repetible sin costuras)
    function pintura(base, semilla, { chips = 70, oxido = 1, tierra = 1, rayas = 40 } = {}) {
      const S = 256, [c, x] = lienzo(S), rnd = kit.mulberry32(semilla);
      x.fillStyle = base; x.fillRect(0, 0, S, S);
      const nueve = (fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { x.save(); x.translate(dx, dy); fn(); x.restore(); } };
      const mancha = (px, py, r, e = 0.6 + rnd() * 0.4, a = rnd() * Math.PI) => nueve(() => { x.beginPath(); x.ellipse(px, py, r, r * e, a, 0, Math.PI * 2); x.fill(); });
      for (let i = 0; i < 260; i++) {
        x.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.015 + rnd() * 0.04})` : `rgba(0,0,0,${0.02 + rnd() * 0.05})`;
        mancha(rnd() * S, rnd() * S, 6 + rnd() * 34);
      }
      for (let i = 0; i < 110 * tierra; i++) {
        const v = 90 + rnd() * 40;
        x.fillStyle = `rgba(${v | 0},${(v * 0.86) | 0},${(v * 0.66) | 0},${0.04 + rnd() * 0.12})`;
        mancha(rnd() * S, rnd() * S, 2 + rnd() * 18);
      }
      for (let i = 0; i < 16 * oxido; i++) {
        const px = rnd() * S, py = rnd() * S, l = 18 + rnd() * 80, w = 1 + rnd() * 3;
        nueve(() => {
          const gr = x.createLinearGradient(0, py, 0, py + l);
          gr.addColorStop(0, 'rgba(118,62,28,0.4)'); gr.addColorStop(1, 'rgba(118,62,28,0)');
          x.fillStyle = gr; x.fillRect(px, py, w, l);
        });
      }
      for (let i = 0; i < chips; i++) {
        const px = rnd() * S, py = rnd() * S, r = 1 + rnd() * rnd() * 7, e = 0.5 + rnd() * 0.5, a = rnd() * 3;
        x.fillStyle = 'rgba(35,30,26,0.55)'; mancha(px, py, r + 0.9, e, a);
        x.fillStyle = rnd() < 0.55 ? '#8c8f8e' : '#7b4a28'; mancha(px, py, r, e, a);
      }
      x.lineCap = 'round';
      for (let i = 0; i < rayas; i++) {
        const px = rnd() * S, py = rnd() * S, a = rnd() * Math.PI, l = 5 + rnd() * 28;
        x.strokeStyle = rnd() < 0.6 ? 'rgba(50,46,42,0.35)' : 'rgba(235,235,230,0.3)'; x.lineWidth = 0.6 + rnd() * 0.9;
        nueve(() => { x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); });
      }
      return texDe(c);
    }

    // ------------------------------------------------------------ materiales
    const relieve = kit.makeSurface('concrete', { seed: 4, roughness: false }).normalMap;
    const pint = (map, { rough = 0.62, metal = 0.2, tam = 1, escala = 0.35 } = {}) => {
      const m = new THREE.MeshStandardMaterial({ map, normalMap: relieve, normalScale: new THREE.Vector2(escala, escala), roughness: rough, metalness: metal });
      m.userData.tam = tam;
      return m;
    };
    const amarillo = pint(pintura('#dca21c', 11));
    const grafito = pint(pintura('#4b4f53', 12, { oxido: 1.6 }), { rough: 0.7 });
    const azul = pint(pintura('#2d5d8c', 13, { chips: 40 }), { rough: 0.5 });
    const plastico = pint(pintura('#ffffff', 14, { chips: 25, oxido: 0.3, rayas: 20 }), { rough: 0.5, metal: 0.02, tam: 0.6, escala: 0.15 });
    plastico.vertexColors = true;
    const acero = kit.mat('metal', { color: 0xc6cacd, metalness: 0.72, roughness: 0.42, normalScale: 0.5 });
    acero.userData.tam = 0.8;
    const chapa = kit.mat('metal', { color: 0xb5b2aa, metalness: 0.45, roughness: 0.6, normalScale: 0.6 });
    chapa.side = THREE.DoubleSide; chapa.userData.tam = 1.2;
    const caucho = kit.mat('concrete', { color: 0x3b3b3b, roughness: 0.93, normalScale: 0.6 });
    caucho.userData.tam = 0.5;
    const madera = kit.mat('wood', { color: 0xc9b9a0, roughness: 0.85 });
    const hormigon = kit.mat('concrete', { color: 0xe4e0d8 });
    hormigon.userData.tam = 1.5; hormigon.userData.sombra = false;
    const gravaFija = kit.mat('gravel', { color: 0xffffff, normalScale: 1.25 });
    gravaFija.vertexColors = true; gravaFija.userData.tam = 0.55; gravaFija.userData.sombra = false;
    const vidrio = new THREE.MeshStandardMaterial({ color: 0x1d2a30, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.42, envMapIntensity: 2.2 });
    vidrio.userData.sombra = false;

    // rejilla de guarda: metal desplegado naranjo con marco (transparente por alphaTest)
    const guarda = (() => {
      const S = 128, [c, x] = lienzo(S);
      x.clearRect(0, 0, S, S);
      x.strokeStyle = '#e86a12'; x.lineWidth = 3.2;
      for (let i = -S; i < S * 2; i += 16) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S * 0.6, S); x.stroke();
        x.beginPath(); x.moveTo(i + S * 0.6, 0); x.lineTo(i, S); x.stroke();
      }
      x.fillStyle = '#e86a12'; x.fillRect(0, 0, S, 9); x.fillRect(0, S - 9, S, 9); x.fillRect(0, 0, 9, S); x.fillRect(S - 9, 0, 9, S);
      x.fillStyle = 'rgba(70,50,30,0.35)';
      for (let i = 0; i < 60; i++) x.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 5, 2 + Math.random() * 5);
      const t = texDe(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.2 });
    })();

    // letreros: un solo lienzo con todos los carteles y placas de la estación
    const ATLAS = {};
    const letreros = (() => {
      const S = 512, [c, x] = lienzo(S), rnd = kit.mulberry32(77);
      x.fillStyle = '#d8d8d4'; x.fillRect(0, 0, S, S);
      const fuente = (px, peso = 700) => `${peso} ${px}px Arial, Helvetica, sans-serif`;
      const texto = (t, cx, cy, px, color = '#111', peso = 700) => { x.fillStyle = color; x.font = fuente(px, peso); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, cx, cy); };
      const cartel = (clave, x0, y0, w, h, cab, colorCab, colorTxtCab, lineas, px = 20) => {
        ATLAS[clave] = [x0, y0, x0 + w, y0 + h];
        x.fillStyle = '#f4f2ec'; x.fillRect(x0, y0, w, h);
        x.fillStyle = colorCab; x.fillRect(x0 + 4, y0 + 4, w - 8, h * 0.34);
        texto(cab, x0 + w / 2, y0 + 4 + h * 0.17, h * 0.2, colorTxtCab);
        lineas.forEach((l, i) => texto(l, x0 + w / 2, y0 + h * 0.5 + (i + 0.5) * ((h * 0.46) / lineas.length), px, '#151515'));
        x.strokeStyle = '#2a2a2a'; x.lineWidth = 3; x.strokeRect(x0 + 1.5, y0 + 1.5, w - 3, h - 3);
      };
      cartel('peligro', 0, 0, 256, 160, 'PELIGRO', '#c4161c', '#ffffff', ['CORREA EN MOVIMIENTO', 'NO INTRODUCIR LAS MANOS'], 19);
      cartel('epp', 256, 0, 256, 160, 'USO OBLIGATORIO', '#1d57a5', '#ffffff', ['CASCO · LENTES · CHALECO', 'CALZADO DE SEGURIDAD', 'PROTECCIÓN AUDITIVA'], 17);
      cartel('atencion', 0, 160, 256, 160, 'ATENCIÓN', '#f2c200', '#111111', ['MAQUINARIA PESADA', 'EN MOVIMIENTO'], 22);
      cartel('grava', 256, 160, 256, 80, 'ACOPIO', '#2f6b3a', '#ffffff', ['GRAVA 3/4"'], 24);
      cartel('arena', 256, 240, 256, 80, 'ACOPIO', '#2f6b3a', '#ffffff', ['ARENA GRUESA'], 24);
      // velocidad máxima
      ATLAS.velocidad = [0, 320, 128, 448];
      x.fillStyle = '#f4f2ec'; x.fillRect(0, 320, 128, 128); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(64, 384, 60, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#c4161c'; x.lineWidth = 13; x.beginPath(); x.arc(64, 384, 54, 0, Math.PI * 2); x.stroke();
      texto('10', 64, 376, 44); texto('km/h', 64, 410, 16);
      // riesgo eléctrico
      ATLAS.electrico = [128, 320, 256, 448];
      x.fillStyle = '#f4f2ec'; x.fillRect(128, 320, 128, 128);
      x.fillStyle = '#f2c200'; x.strokeStyle = '#111'; x.lineWidth = 5;
      x.beginPath(); x.moveTo(192, 330); x.lineTo(248, 418); x.lineTo(136, 418); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#111'; x.beginPath(); x.moveTo(197, 350); x.lineTo(180, 388); x.lineTo(194, 388); x.lineTo(186, 410); x.lineTo(206, 378); x.lineTo(192, 378); x.lineTo(202, 350); x.closePath(); x.fill();
      texto('380 V', 192, 434, 15);
      // placa del motor
      ATLAS.placa = [256, 320, 384, 384];
      x.fillStyle = '#b9bcbd'; x.fillRect(256, 320, 128, 64);
      x.fillStyle = '#2a2a2a'; for (let i = 0; i < 6; i++) x.fillRect(266, 330 + i * 8, 40 + rnd() * 66, 3);
      // placa del grupo electrógeno
      ATLAS.generador = [256, 384, 512, 448];
      x.fillStyle = '#1f1f1f'; x.fillRect(256, 384, 256, 64);
      texto('GRUPO ELECTRÓGENO', 384, 404, 19, '#f0f0f0'); texto('60 kVA · 380 V', 384, 430, 17, '#f2c200');
      // rótulos de la botonera
      ATLAS.botonera = [384, 320, 512, 384];
      x.fillStyle = '#222'; x.fillRect(384, 320, 128, 64);
      texto('PARTIR', 448, 334, 13, '#9fe39a'); texto('PARAR', 448, 352, 13, '#ff8f8f'); texto('EMERGENCIA', 448, 372, 12, '#ffd34d');
      ATLAS.gravilla = [0, 448, 256, 512];
      x.fillStyle = '#f4f2ec'; x.fillRect(0, 448, 256, 64); x.fillStyle = '#2f6b3a'; x.fillRect(4, 452, 248, 20);
      texto('ACOPIO', 128, 462, 15, '#fff'); texto('GRAVILLA 3/8"', 128, 491, 22);
      // polvo y suciedad sobre todos los letreros
      for (let i = 0; i < 900; i++) { const v = 120 + rnd() * 40; x.fillStyle = `rgba(${v | 0},${(v * 0.88) | 0},${(v * 0.7) | 0},${0.03 + rnd() * 0.08})`; x.beginPath(); x.arc(rnd() * S, rnd() * S, 1 + rnd() * 7, 0, 7); x.fill(); }
      const t = texDe(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.05 });
    })();

    // ------------------------------------------------------------ lotes: la geometría estática se une en una malla por material
    const lotes = new Map();
    function uvCaja(geo, tam) {
      const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        let u, v;
        if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
        uv[i * 2] = u / tam; uv[i * 2 + 1] = v / tam;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    // las piezas chicas (pernos, tacos, polines, botones) van en un lote aparte que no proyecta sombra
    const chico = { sombra: false };
    function poner(mat, geo, m = null, { color = null, uv = true, sombra = true } = {}) {
      if (m) geo.applyMatrix4(m);
      if (uv) uvCaja(geo, mat.userData.tam ?? 1);
      if (color != null) {
        const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
        geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
      }
      const clave = mat.uuid + (sombra ? '' : '|ns');
      let l = lotes.get(clave);
      if (!l) lotes.set(clave, (l = { mat, sombra, geos: [] }));
      l.geos.push(geo);
      return geo;
    }
    function cerrarLotes() {
      for (const { mat, sombra, geos } of lotes.values()) {
        for (const geo of geos) {
          const n = geo.attributes.position.count;
          if (!geo.index) geo.setIndex([...Array(n).keys()]);
          for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) geo.deleteAttribute(k);
          if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
          if (mat.vertexColors && !geo.attributes.color) geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
          if (!mat.vertexColors && geo.attributes.color) geo.deleteAttribute('color');
          geo.morphAttributes = {}; geo.clearGroups();
        }
        const geo = kit.mergeGeometries(geos, false);
        for (const x of geos) x.dispose();
        kit.malla(geo, mat, { padre: g, sombra: sombra && mat.userData.sombra !== false }).name = 'lote';
      }
      lotes.clear();
    }

    // neumático con tacos en V y llanta; eje a lo largo de x en el marco 'base'
    function rueda(base, { R, ancho, rLl, tacos, llanta, lado = 1 }) {
      const a = ancho / 2, perfil = [];
      for (let k = 0; k <= 12; k++) {
        const th = -Math.PI / 2 + (k / 12) * Math.PI, sn = Math.sin(th), cs = Math.cos(th);
        perfil.push(new THREE.Vector2(rLl + (R - rLl) * Math.pow(Math.abs(cs), 0.42), a * Math.sign(sn) * Math.pow(Math.abs(sn), 0.42)));
      }
      const goma = new THREE.LatheGeometry(perfil, 32); goma.rotateZ(-Math.PI / 2);
      poner(caucho, goma, base);
      for (let k = 0; k < tacos; k++) {
        const fi = (k / tacos) * Math.PI * 2;
        for (const sg of [-1, 1]) {
          const q = qE(fi, 0, 0).multiply(qE(0, sg * 0.42, 0));
          const p = V(sg * a * 0.4, R * 0.985, 0).applyQuaternion(qE(fi, 0, 0));
          poner(caucho, caja(a * 0.72, 0.06, 0.1), base.clone().multiply(mat4(p, q)), chico);
        }
      }
      poner(llanta, cil(rLl * 1.02, ancho * 0.82, 28), base.clone().multiply(mm(0, 0, 0, 0, 0, Math.PI / 2)));
      poner(grafito, cil(rLl * 0.38, ancho * 0.82 + 0.07, 16), base.clone().multiply(mm(0, 0, 0, 0, 0, Math.PI / 2)), chico);
      for (let k = 0; k < 8; k++) {
        const fi = (k / 8) * Math.PI * 2;
        poner(acero, cil(0.016, 0.04, 6), base.clone().multiply(mm(lado * (ancho * 0.41 + 0.015), Math.cos(fi) * rLl * 0.55, Math.sin(fi) * rLl * 0.55, 0, 0, Math.PI / 2)), chico);
      }
    }

    // ------------------------------------------------------------ cancha de acopio: ripio compactado con borde difuso
    const tierra = kit.mat('gravel', { repeat: [26, 26], color: 0xc4b9a6, normalScale: 0.7 });
    tierra.polygonOffset = true; tierra.polygonOffsetFactor = -3;
    const alfa = (() => {
      const [c, x] = lienzo(128), gr = x.createRadialGradient(64, 64, 20, 64, 64, 64);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.72, '#bbb'); gr.addColorStop(1, '#000');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    tierra.alphaMap = alfa; tierra.transparent = true; tierra.depthWrite = false;
    kit.malla(new THREE.CircleGeometry(15.5, 64), tierra, { rx: -Math.PI / 2, x: 0.5, y: 0.018, z: -3.5, sombra: false, padre: g }).renderOrder = -2;

    // ------------------------------------------------------------ correa transportadora
    // Marco propio: X horizontal hacia la cabeza, Y arriba, Z transversal. La línea de la cinta va de (0, Y0) a (Lh, Y1).
    const GAM = 0.85; // rumbo horizontal de la correa (de la cola a la cabeza)
    const e = V(Math.cos(GAM), 0, Math.sin(GAM));
    const lat = V(-Math.sin(GAM), 0, Math.cos(GAM));
    const Y0 = 1.05, Lh = 10.4, Y1 = 4.45;
    const TH = Math.atan2(Y1 - Y0, Lh), ct = Math.cos(TH), st = Math.sin(TH), L = Math.hypot(Lh, Y1 - Y0);
    const P = (sv, n, w) => V(sv * ct - n * st, Y0 + sv * st + n * ct, w);
    const xDesc = (L + 0.07) * ct - 0.05 * st; // distancia horizontal de la cola al punto de descarga
    const cola = e.clone().multiplyScalar(-(xDesc + 0.45)); // la descarga queda 0,45 m antes del eje del cono
    const MC = mat4(cola, new THREE.Quaternion().setFromAxisAngle(Y, -GAM));
    const aEst = (p) => p.clone().applyMatrix4(MC);
    const ponerC = (mat, geo, m = null, o) => poner(mat, geo, m ? MC.clone().multiply(m) : MC, o);
    const qB = qE(0, 0, TH); // inclinación de la banda en el marco propio
    const qBz = qB.clone().multiply(qE(Math.PI / 2, 0, 0)); // cilindros con eje transversal
    const qBx = qB.clone().multiply(qE(0, 0, -Math.PI / 2)); // cilindros con eje a lo largo de la banda
    const barraC = (mat, a, b, w, d = w, o) => ponerC(mat, caja(w, 1, d), tramo(a, b), o);
    const tuboC = (mat, a, b, r, seg = 10, o) => ponerC(mat, cil(r, 1, seg), tramo(a, b), o);

    // celosía: dos vigas laterales con cordones, montantes, diagonales, cartelas apernadas y arriostramiento inferior
    const W = 0.42, NT = -0.13, NB = -0.85, N = 10;
    const s0 = 0.25, ds = (L - 0.5) / N;
    for (const w of [-W, W]) {
      const sg = Math.sign(w);
      barraC(amarillo, P(s0 - 0.05, NT, w), P(L - 0.2, NT, w), 0.08);
      barraC(amarillo, P(s0, NB, w), P(L - 0.25, NB, w), 0.08);
      for (let k = 0; k <= N; k++) {
        const sk = s0 + k * ds;
        barraC(amarillo, P(sk, NT, w), P(sk, NB, w), 0.055, 0.05);
        if (k < N) tuboC(amarillo, k % 2 ? P(sk, NT, w) : P(sk, NB, w), k % 2 ? P(sk + ds, NB, w) : P(sk + ds, NT, w), 0.022);
        for (const n of [NT, NB]) {
          ponerC(amarillo, caja(0.17, 0.13, 0.012), mat4(P(sk, n, w + sg * 0.046), qB), chico);
          for (const [du, dv] of [[-0.055, -0.042], [0.055, 0.042]]) ponerC(acero, cil(0.011, 0.016, 6), mat4(P(sk + du, n + dv, w + sg * 0.056), qBz), chico);
        }
      }
    }
    for (let k = 0; k <= N; k++) {
      const sk = s0 + k * ds;
      barraC(amarillo, P(sk, NB, -W), P(sk, NB, W), 0.05);
      if (k < N) tuboC(amarillo, P(sk, NB, (k % 2 ? 1 : -1) * W), P(sk + ds, NB, (k % 2 ? -1 : 1) * W), 0.018);
    }
    // placas de cabeza y de cola que sostienen los tambores
    for (const w of [-W - 0.03, W + 0.03]) {
      barraC(amarillo, P(L - 0.45, NB + 0.1, w), P(L + 0.02, -0.26, w), 0.09, 0.02);
      barraC(amarillo, P(L - 0.35, NT, w), P(L + 0.02, -0.2, w), 0.12, 0.02);
      barraC(amarillo, P(s0 + 0.05, NB + 0.05, w), P(-0.02, -0.2, w), 0.1, 0.02);
      // tensores de la cola: varilla roscada con tuercas
      tuboC(acero, P(-0.05, -0.2, w + Math.sign(w) * 0.03), P(0.55, -0.2, w + Math.sign(w) * 0.03), 0.012, 8, chico);
      for (const sv of [0.3, 0.52]) ponerC(acero, cil(0.022, 0.025, 6), mat4(P(sv, -0.2, w + Math.sign(w) * 0.03), qBx), chico);
    }

    // polines: de carga en artesa (tres por estación) y de retorno, con sus soportes
    for (let sv = 0.6; sv < L - 0.35; sv += 1.0) {
      tuboC(acero, P(sv, -0.052, -0.14), P(sv, -0.052, 0.14), 0.05, 12, chico);
      for (const sg of [-1, 1]) tuboC(acero, P(sv, -0.039, sg * 0.165), P(sv, 0.059, sg * 0.34), 0.05, 12, chico);
      barraC(grafito, P(sv, NT, -W - 0.04), P(sv, NT, W + 0.04), 0.06, 0.05);
      for (const sg of [-1, 1]) {
        barraC(grafito, P(sv, NT, sg * 0.15), P(sv, -0.05, sg * 0.15), 0.035, 0.012, chico);
        barraC(grafito, P(sv, NT, sg * 0.37), P(sv, 0.075, sg * 0.37), 0.035, 0.012, chico);
        ponerC(acero, cil(0.012, 0.03, 6), mat4(P(sv, NT + 0.02, sg * (W + 0.02)), qB), chico);
      }
    }
    for (let sv = 1.4; sv < L - 0.6; sv += 2.4) {
      tuboC(acero, P(sv, -0.425, -0.34), P(sv, -0.425, 0.34), 0.05, 12, chico);
      for (const sg of [-1, 1]) barraC(grafito, P(sv, -0.425, sg * 0.385), P(sv, NT, sg * 0.385), 0.03, 0.012, chico);
    }

    // tambores de cabeza y de cola: revestimiento de goma, discos, eje y descansos apernados
    const tambor = (sv, n, r) => {
      tuboC(caucho, P(sv, n, -0.33), P(sv, n, 0.33), r, 26);
      tuboC(acero, P(sv, n, -0.36), P(sv, n, 0.36), r * 0.86, 26);
      tuboC(acero, P(sv, n, -0.62), P(sv, n, 0.62), 0.035, 10, chico);
      for (const w of [-0.52, 0.52]) {
        ponerC(grafito, caja(0.24, 0.035, 0.1), mat4(P(sv, n - 0.075, w), qB), chico);
        ponerC(grafito, cil(0.06, 0.09, 16), mat4(P(sv, n, w), qBz), chico);
        for (const du of [-0.09, 0.09]) ponerC(acero, cil(0.012, 0.03, 6), mat4(P(sv + du, n - 0.05, w), qB), chico);
      }
    };
    tambor(L, -0.2, 0.2);
    tambor(0, -0.185, 0.185);
    // raspador de la banda bajo el tambor de cabeza (hoja de poliuretano)
    tuboC(grafito, P(L - 0.12, -0.42, -0.42), P(L - 0.12, -0.42, 0.42), 0.025, 10);
    ponerC(plastico, cajaR(0.03, 0.09, 0.64, 0.008), mat4(P(L - 0.08, -0.37, 0), qB.clone().multiply(qE(0, 0, 0.6))), { color: '#e0742a' });

    // banda de goma con tacos en V; su textura avanza con la cinta
    const gomaTex = (() => {
      const [c, x] = lienzo(128);
      x.fillStyle = '#2b2b2b'; x.fillRect(0, 0, 128, 128);
      const rnd = kit.mulberry32(5);
      for (let i = 0; i < 1600; i++) { const v = 30 + rnd() * 24; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 2); }
      x.strokeStyle = '#424242'; x.lineWidth = 7; x.lineCap = 'round';
      for (const y0 of [18, 82]) { x.beginPath(); x.moveTo(14, y0 + 24); x.lineTo(64, y0); x.lineTo(114, y0 + 24); x.stroke(); }
      for (let i = 0; i < 140; i++) { const v = 120 + rnd() * 50; x.fillStyle = `rgba(${v | 0},${(v * 0.9) | 0},${(v * 0.75) | 0},${0.1 + rnd() * 0.25})`; x.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 3, 1 + rnd() * 3); }
      x.fillStyle = 'rgba(70,70,70,0.9)'; x.fillRect(0, 0, 5, 128); x.fillRect(123, 0, 5, 128);
      const t = texDe(c);
      t.repeat.set(1, 1 / 0.64);
      return t;
    })();
    const goma = new THREE.MeshStandardMaterial({ map: gomaTex, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    const geoBanda = (() => {
      const pos = [], uv = [], idx = [];
      const anillos = [0, 0.7, L - 0.7, L];
      const ws = [-0.32, -0.14, 0.14, 0.32];
      anillos.forEach((sv, i) => {
        const k = i === 0 || i === 3 ? 0 : 1;
        for (const w of ws) { const p = P(sv, Math.abs(w) > 0.2 ? 0.104 * k : 0, w); pos.push(p.x, p.y, p.z); uv.push((w + 0.32) / 0.64, sv); }
      });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const a = i * 4 + j; idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5); }
      const camino = [];
      for (let k = 0; k <= 12; k++) { const a = Math.PI / 2 - (k * Math.PI) / 12; camino.push([L + 0.2 * Math.cos(a), -0.2 + 0.2 * Math.sin(a)]); }
      for (let k = 0; k <= 12; k++) { const a = -Math.PI / 2 - (k * Math.PI) / 12; camino.push([0.185 * Math.cos(a), -0.185 + 0.185 * Math.sin(a)]); }
      const base = pos.length / 3;
      let v = L;
      camino.forEach(([sv, n], i) => {
        if (i > 0) v += Math.hypot(sv - camino[i - 1][0], n - camino[i - 1][1]);
        for (const w of [-0.32, 0.32]) { const p = P(sv, n, w); pos.push(p.x, p.y, p.z); uv.push((w + 0.32) / 0.64, v); }
      });
      for (let i = 0; i < camino.length - 1; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      return geo.applyMatrix4(MC);
    })();
    kit.malla(geoBanda, goma, { padre: g });

    // grava sobre la banda: un cordón que avanza con la cinta
    const gravaCarga = kit.mat('gravel', { repeat: [2, 2], color: 0xf2e8d6, normalScale: 1.2 });
    const geoCarga = (() => {
      const pos = [], uv = [], idx = [];
      const anillos = [[1.25, 0.7], [L - 0.45, 1], [L + 0.03, 0.35]];
      const nw = 9;
      for (const [sv, k] of anillos) {
        for (let j = 0; j < nw; j++) {
          const w = -0.22 + (0.44 * j) / (nw - 1);
          const n = 0.03 + k * 0.075 * Math.cos((Math.PI * w) / 0.48);
          const p = P(sv, n, w); pos.push(p.x, p.y, p.z); uv.push(w + 0.5, sv);
        }
      }
      for (let i = 0; i < anillos.length - 1; i++) for (let j = 0; j < nw - 1; j++) { const a = i * nw + j; idx.push(a, a + 1, a + nw, a + 1, a + nw + 1, a + nw); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      return geo.applyMatrix4(MC);
    })();
    kit.malla(geoCarga, gravaCarga, { padre: g, sombra: false });
    const texCarga = [gravaCarga.map, gravaCarga.normalMap, gravaCarga.roughnessMap].filter(Boolean);

    // tolva de alimentación en la cola: chapa plegada, marco de ángulo, faldones y grava en su interior
    const tolvaC = P(0.85, 0, 0);
    {
      const geo = new THREE.CylinderGeometry(0.86, 0.33, 0.7, 4, 1, true).toNonIndexed();
      geo.rotateY(Math.PI / 4); geo.computeVertexNormals();
      ponerC(chapa, geo, mm(tolvaC.x, tolvaC.y + 0.5, 0));
      const c = [[-0.61, -0.61], [0.61, -0.61], [0.61, 0.61], [-0.61, 0.61]];
      for (let i = 0; i < 4; i++) barraC(amarillo, V(tolvaC.x + c[i][0], tolvaC.y + 0.86, c[i][1]), V(tolvaC.x + c[(i + 1) % 4][0], tolvaC.y + 0.86, c[(i + 1) % 4][1]), 0.05);
      for (const [dx, dz] of [[-0.25, -0.3], [0.25, -0.3], [-0.25, 0.3], [0.25, 0.3]]) tuboC(amarillo, V(tolvaC.x + dx, tolvaC.y + 0.18, dz), V(tolvaC.x + dx * 1.6, P(0.85 + dx, NT, 0).y, dz * 1.4), 0.025, 8);
      for (const w of [-0.24, 0.24]) {
        ponerC(chapa, caja(1.5, 0.22, 0.01), mat4(P(1.05, 0.15, w), qB));
        ponerC(caucho, caja(1.5, 0.06, 0.012), mat4(P(1.05, 0.02, w), qB));
      }
      const geoT = new THREE.SphereGeometry(0.5, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      ponerC(gravaFija, geoT, mat4(V(tolvaC.x, tolvaC.y + 0.68, 0), null, V(1.1, 0.42, 1.1)), { color: '#efe6d6' });
    }

    // campana de descarga sobre el tambor de cabeza: cubre arriba y atrás, abierta adelante y abajo
    {
      const geo = new THREE.CylinderGeometry(0.36, 0.36, 0.86, 22, 1, true, Math.PI * 0.72, Math.PI * 0.8);
      ponerC(chapa, geo, mat4(P(L - 0.02, -0.2, 0), qBz));
      for (const w of [-0.43, 0.43]) {
        const lado = new THREE.CircleGeometry(0.36, 22, Math.PI * 0.72 - Math.PI / 2, Math.PI * 0.8);
        ponerC(chapa, lado, mat4(P(L - 0.02, -0.2, w), qB));
      }
    }

    // guardas de rejilla en los puntos de atrapamiento (tambores) y en el acoplamiento del motor
    const panelGuarda = (centro, ancho, alto, q) => ponerC(guarda, new THREE.PlaneGeometry(ancho, alto), mat4(centro, q), { uv: false });
    for (const w of [-0.47, 0.47]) {
      panelGuarda(P(L - 0.15, -0.36, w), 0.5, 0.36, qB);
      panelGuarda(P(0.15, -0.34, w), 0.5, 0.34, qB);
    }

    // motorreductor en el costado visible (+Z): motor con aletas, tapa del ventilador, caja de conexiones y placa
    {
      const ejeM = (sv) => P(sv, -0.3, 0.7);
      const red = P(L, -0.2, 0.7);
      ponerC(azul, cajaR(0.38, 0.36, 0.24, 0.04), mat4(red, qB));
      for (const k of [-1, 0, 1]) ponerC(azul, caja(0.012, 0.3, 0.26), mat4(P(L + k * 0.1, -0.2, 0.7), qB), chico);
      ponerC(acero, cil(0.03, 0.05, 10), mat4(P(L + 0.06, -0.01, 0.7), qB), chico); // respiradero
      ponerC(azul, cil(0.15, 0.06, 24), mat4(ejeM(L - 0.21), qBx));
      ponerC(azul, cil(0.14, 0.44, 24), mat4(ejeM(L - 0.46), qBx));
      for (let k = 0; k < 7; k++) {
        const t = new THREE.TorusGeometry(0.145, 0.008, 4, 20);
        ponerC(azul, t, mat4(ejeM(L - 0.29 - k * 0.05), qB.clone().multiply(qE(0, Math.PI / 2, 0))), chico);
      }
      ponerC(grafito, cil(0.135, 0.13, 24), mat4(ejeM(L - 0.74), qBx));
      ponerC(grafito, cil(0.11, 0.012, 24), mat4(ejeM(L - 0.806), qBx), chico);
      ponerC(azul, cajaR(0.15, 0.09, 0.13, 0.015), mat4(P(L - 0.44, -0.12, 0.7), qB));
      ponerC(acero, new THREE.TorusGeometry(0.025, 0.007, 6, 14), mat4(P(L - 0.36, -0.14, 0.7), qB), chico);
      const placa = new THREE.PlaneGeometry(0.1, 0.05), A = ATLAS.placa, uvp = placa.attributes.uv;
      for (let i = 0; i < uvp.count; i++) uvp.setXY(i, (A[0] + uvp.getX(i) * (A[2] - A[0])) / 512, 1 - (A[3] - uvp.getY(i) * (A[3] - A[1])) / 512);
      ponerC(letreros, placa, mat4(P(L - 0.5, -0.3, 0.843), qB), { uv: false });
      // brazo de reacción hasta el bastidor
      barraC(grafito, P(L - 0.05, -0.38, 0.7), P(L - 0.35, NB + 0.15, W + 0.05), 0.04, 0.02);
      // tapa del eje al otro lado del tambor
      ponerC(amarillo, cil(0.07, 0.08, 20), mat4(P(L, -0.2, -0.66), qBz));
    }

    // tren de rodado: eje, dos ruedas y patas en A hasta el cordón inferior
    const XE = 6.3, RR = 0.42;
    tuboC(grafito, V(XE, RR, -1.0), V(XE, RR, 1.0), 0.06, 14);
    const sA = XE / ct + 0.95, sB = XE / ct - 1.1;
    for (const w of [-1, 1]) {
      const pie = V(XE, RR, w * 0.95);
      barraC(amarillo, pie, P(sA, NB, w * W), 0.09);
      barraC(amarillo, pie, P(sB, NB, w * W), 0.09);
      ponerC(amarillo, caja(0.22, 0.22, 0.1), mat4(V(XE, RR + 0.04, w * 0.95)));
      rueda(MC.clone().multiply(mat4(V(XE, RR, w * 1.13), qE(0, w > 0 ? -Math.PI / 2 : Math.PI / 2, 0))), { R: RR, ancho: 0.3, rLl: 0.24, tacos: 18, llanta: amarillo, lado: 1 });
    }
    barraC(amarillo, V(XE, RR + 0.55, -0.85), V(XE, RR + 0.55, 0.85), 0.06);

    // apoyo de la cola: patines de perfil, lanza de tiro con argolla
    for (const w of [-0.55, 0.55]) {
      ponerC(grafito, cajaR(1.7, 0.1, 0.22, 0.015), mm(0.35, 0.05, w));
      const a = P(0.3, NB, Math.sign(w) * W), b = P(0.95, NB, Math.sign(w) * W);
      tuboC(amarillo, a, V(a.x, 0.1, w), 0.035, 10);
      tuboC(amarillo, b, V(b.x, 0.1, w), 0.035, 10);
    }
    barraC(grafito, V(-0.45, 0.32, 0), V(0.35, 0.32, -0.5), 0.07);
    barraC(grafito, V(-0.45, 0.32, 0), V(0.35, 0.32, 0.5), 0.07);
    ponerC(acero, new THREE.TorusGeometry(0.07, 0.018, 8, 20), mm(-0.52, 0.32, 0, Math.PI / 2, 0, 0));
    ponerC(grafito, cil(0.03, 0.32, 10), mm(-0.3, 0.16, 0));

    // cable de parada de emergencia a lo largo de la correa, con interruptores de tirón
    {
      const wC = W + 0.13;
      const pts = [];
      for (let sv = 0.8; sv <= L - 0.6; sv += 1.6) {
        tuboC(grafito, P(sv, NT, wC - 0.08), P(sv, 0.32, wC), 0.012, 6, chico);
        pts.push(P(sv, 0.32, wC));
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= 0.03;
        ponerC(plastico, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 8, 0.006, 5), null, { color: '#d02a20', sombra: false });
      }
      for (const sv of [0.8, L - 0.6 - ((L - 1.4) % 1.6)]) ponerC(plastico, cajaR(0.12, 0.16, 0.1, 0.015), mat4(P(sv, 0.2, wC + 0.04), qB), { color: '#e8c21a', sombra: false });
    }

    // letrero de peligro colgado de la celosía
    function cartel(clave, centro, q, ancho, alto, conMarco = true, marco = acero) {
      const A = ATLAS[clave], geo = new THREE.PlaneGeometry(ancho, alto), uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (A[0] + uv.getX(i) * (A[2] - A[0])) / 512, 1 - (A[3] - uv.getY(i) * (A[3] - A[1])) / 512);
      const m = mat4(centro, q);
      poner(letreros, geo, m, { uv: false });
      if (conMarco) poner(marco, caja(ancho + 0.02, alto + 0.02, 0.012), m.clone().multiply(mm(0, 0, -0.008)));
      return m;
    }
    {
      const c = aEst(P(4.6, NB + 0.3, W + 0.07)), q = new THREE.Quaternion().setFromAxisAngle(Y, -GAM);
      cartel('peligro', c, q, 0.62, 0.39);
    }

    // cables: del tablero al grupo electrógeno y del tablero al motor por el suelo y la celosía
    function cable(puntos, r = 0.014, seg = 80) {
      const curva = new THREE.CatmullRomCurve3(puntos, false, 'centripetal');
      poner(caucho, new THREE.TubeGeometry(curva, seg, r, 6, false));
    }

    // ------------------------------------------------------------ montón de grava (cono unitario: radio 0,5 y altura 1)
    const gravaCono = kit.mat('gravel', { repeat: [1, 1], color: 0xf2e8d6, normalScale: 1.35 });
    const conoGeo = (() => {
      const geo = new THREE.ConeGeometry(0.5, 1, 80, 22, true);
      geo.translate(0, 0.5, 0);
      const nr = kit.fbm(64, 5, 4, 17);
      const muestra = (u, v) => {
        const x = u * 64, y = v * 63, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        const at = (i, j) => nr[(((j % 64) + 64) % 64) * 64 + (((i % 64) + 64) % 64)];
        return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
      };
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const u = ((Math.atan2(z, x) / (2 * Math.PI)) + 1) % 1;
        const n = muestra(u, y) - 0.5;
        let k = 1 + n * 0.2 * (1 - y * 0.8);
        if (y < 0.1) k *= 1 + (0.1 - y) * 1.1; // pie del talud algo más tendido
        p.setXYZ(i, x * k, Math.max(0, y + n * 0.025 * (1 - y)), z * k);
      }
      geo.computeVertexNormals();
      return geo;
    })();
    const cono = kit.malla(conoGeo, gravaCono, { y: -0.01, padre: g });
    const texCono = [gravaCono.map, gravaCono.normalMap, gravaCono.roughnessMap].filter(Boolean);

    // derrame de grava alrededor del pie (disco con borde difuso)
    const gravaPie = kit.mat('gravel', { repeat: [3, 3], color: 0xb9af9d, normalScale: 1.1 });
    gravaPie.alphaMap = alfa; gravaPie.transparent = true; gravaPie.depthWrite = false;
    gravaPie.polygonOffset = true; gravaPie.polygonOffsetFactor = -5;
    const pie = kit.malla(new THREE.CircleGeometry(1, 48), gravaPie, { rx: -Math.PI / 2, y: 0.024, padre: g, sombra: false });
    pie.renderOrder = -1;
    const texPie = [gravaPie.map, gravaPie.normalMap, gravaPie.roughnessMap].filter(Boolean);

    // piedras sueltas: anillo al pie del cono (se mueve con r) y piedras dispersas fijas
    const piedraGeo = roca(41);
    const piedraMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });
    const rnd = kit.mulberry32(41);
    const col = new THREE.Color();
    const tonoPiedra = (c) => { const v = 0.42 + rnd() * 0.3; return c.setRGB(v, v * 0.95, v * 0.86, THREE.SRGBColorSpace); };
    const NA = 120;
    const anillo = new THREE.InstancedMesh(piedraGeo, piedraMat, NA);
    const datosAnillo = [];
    for (let i = 0; i < NA; i++) {
      datosAnillo.push({ a: rnd() * Math.PI * 2, d: -0.04 + rnd() * rnd() * 0.5, t: 0.022 + rnd() * 0.035, q: qE(rnd() * 6, rnd() * 6, rnd() * 6) });
      anillo.setColorAt(i, tonoPiedra(col));
    }
    anillo.castShadow = true; anillo.receiveShadow = true; anillo.frustumCulled = false;
    g.add(anillo);
    {
      const sueltas = [];
      for (let i = 0; i < 150; i++) {
        const zona = i < 40 ? aEst(P(0.9, 0, 0)) : i < 70 ? V(2.25, 0, -0.75) : V(0, 0, -2);
        const r = i < 40 ? 0.4 + rnd() * 1.4 : i < 70 ? rnd() * 0.9 : 2.4 + rnd() * 9;
        const a = rnd() * Math.PI * 2, t = 0.02 + rnd() * 0.04;
        const p = V(zona.x + Math.cos(a) * r, t * 0.45, zona.z + Math.sin(a) * r);
        if (Math.hypot(p.x, p.z) < 2.3) continue;
        sueltas.push([p, t]);
      }
      const im = new THREE.InstancedMesh(piedraGeo, piedraMat, sueltas.length);
      sueltas.forEach(([p, t], i) => { im.setMatrixAt(i, mat4(p, qE(rnd() * 6, rnd() * 6, rnd() * 6), V(t, t * 0.8, t))); im.setColorAt(i, tonoPiedra(col)); });
      im.castShadow = false; im.receiveShadow = true;
      g.add(im);
    }

    // chorro de grava que cae desde la cabeza (partículas)
    const NP = 240;
    const chorro = new THREE.InstancedMesh(piedraGeo, piedraMat, NP);
    chorro.frustumCulled = false; chorro.castShadow = false;
    const parts = [];
    for (let i = 0; i < NP; i++) {
      parts.push({ w: (rnd() - 0.5) * 0.24, k: 0.9 + rnd() * 0.2, t: 0.014 + rnd() * 0.022, fase: rnd(), vida: 1.5 + rnd() * 0.9, rueda: rnd() < 0.45, az: rnd() * Math.PI * 2, ac: 1.4 + rnd() * 1.8, giro: rnd() * 12, q: qE(rnd() * 6, rnd() * 6, rnd() * 6) });
      chorro.setColorAt(i, tonoPiedra(col));
    }
    g.add(chorro);
    const D = aEst(P(L + 0.07, 0.05, 0));
    const VC = 0.85; // rapidez de la cinta en m/s
    const vh = VC * ct, vv = VC * st;

    const m4 = new THREE.Matrix4(), vp = V(), vs = V(), qr = new THREE.Quaternion(), ejeGiro = V(1, 0.3, 0.2).normalize();
    const cero = new THREE.Matrix4().makeScale(0, 0, 0);
    let tReal = 0;
    function superficie(x, z, h) { return Math.max(0, h - 2 * Math.hypot(x, z)); }
    function actualizarChorro(hm, visible) {
      const rm = hm / 2;
      for (let i = 0; i < NP; i++) {
        const q = parts[i];
        if (!visible) { chorro.setMatrixAt(i, cero); continue; }
        const a = (tReal + q.fase * q.vida) % q.vida;
        const vx = vh * q.k, vy = vv * q.k;
        const px = (u) => D.x + e.x * vx * u + lat.x * q.w, pz = (u) => D.z + e.z * vx * u + lat.z * q.w, py = (u) => D.y + vy * u - 4.905 * u * u;
        let lo = 0, hi = 1.6;
        for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (py(mid) > superficie(px(mid), pz(mid), hm)) lo = mid; else hi = mid; }
        const tl = hi;
        if (a < tl) {
          vp.set(px(a), py(a), pz(a));
        } else if (q.rueda && hm > 0.08) {
          // rueda talud abajo; la dirección mezcla el punto de caída con un rumbo propio de cada piedra
          const lx = px(tl), lz = pz(tl), d0 = Math.hypot(lx, lz);
          let ux = lx + Math.cos(q.az) * 0.25, uz = lz + Math.sin(q.az) * 0.25;
          const nu = Math.hypot(ux, uz); ux /= nu; uz /= nu;
          const tau = a - tl, d = d0 + 0.5 * q.ac * tau * tau;
          if (d > rm + 0.12) { chorro.setMatrixAt(i, cero); continue; }
          vp.set(ux * d, superficie(ux * d, uz * d, hm) + q.t * 0.7, uz * d);
        } else { chorro.setMatrixAt(i, cero); continue; }
        qr.setFromAxisAngle(ejeGiro, a * q.giro).multiply(q.q);
        vs.setScalar(q.t);
        m4.compose(vp, qr, vs);
        chorro.setMatrixAt(i, m4);
      }
      chorro.instanceMatrix.needsUpdate = true;
      actualizarVena(hm, visible);
    }

    // vena continua del chorro: un tubo delgado que sigue la trayectoria central hasta el montón
    const gravaVena = kit.mat('gravel', { repeat: [8, 1], color: 0xe6dccb, normalScale: 1.2 });
    const texVena = [gravaVena.map, gravaVena.normalMap, gravaVena.roughnessMap].filter(Boolean);
    let vena = null, hVena = -1;
    function actualizarVena(hm, visible) {
      if (!visible) { if (vena) vena.visible = false; return; }
      if (vena && Math.abs(hm - hVena) < 0.015) { vena.visible = true; return; }
      hVena = hm;
      const px = (u) => D.x + e.x * vh * u, pz = (u) => D.z + e.z * vh * u, py = (u) => D.y + vv * u - 4.905 * u * u;
      let lo = 0, hi = 1.6;
      for (let it = 0; it < 16; it++) { const mid = (lo + hi) / 2; if (py(mid) > superficie(px(mid), pz(mid), hm)) lo = mid; else hi = mid; }
      const pts = [];
      for (let k = 0; k <= 14; k++) { const u = (hi * k) / 14; pts.push(V(px(u), py(u) - (k === 14 ? 0.04 : 0), pz(u))); }
      const curva = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curva, 28, 0.038, 7, false);
      if (vena) { vena.geometry.dispose(); vena.geometry = geo; } else vena = kit.malla(geo, gravaVena, { padre: g, recibe: false });
      vena.visible = true;
      const largo = curva.getLength();
      for (const tx of texVena) tx.repeat.set(largo / 0.22, 1);
      impacto.set(pts[14].x, pts[14].y, pts[14].z);
    }

    // polvo: nubecillas tenues donde la grava golpea el montón y en la descarga
    const impacto = V(0, 1, 0);
    const NPolvo = 36;
    const polvoGeo = new THREE.BufferGeometry();
    const polvoPos = new Float32Array(NPolvo * 3), polvoCol = new Float32Array(NPolvo * 4);
    polvoGeo.setAttribute('position', new THREE.BufferAttribute(polvoPos, 3));
    polvoGeo.setAttribute('color', new THREE.BufferAttribute(polvoCol, 4));
    const polvoMat = new THREE.PointsMaterial({
      size: 0.75, sizeAttenuation: true, transparent: true, depthWrite: false, vertexColors: true,
      map: (() => { const [c, x] = lienzo(64), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(),
    });
    const polvo = new THREE.Points(polvoGeo, polvoMat);
    polvo.frustumCulled = false; polvo.renderOrder = 3;
    g.add(polvo);
    const datosPolvo = Array.from({ length: NPolvo }, () => ({ fase: rnd(), vida: 1.4 + rnd() * 1.2, ax: rnd() * Math.PI * 2, vel: 0.2 + rnd() * 0.5, sube: 0.15 + rnd() * 0.35, arriba: rnd() < 0.25 }));
    function actualizarPolvo(visible) {
      polvo.visible = visible;
      if (!visible) return;
      for (let i = 0; i < NPolvo; i++) {
        const q = datosPolvo[i], a = ((tReal / q.vida + q.fase) % 1), o = q.arriba ? D : impacto;
        const r = q.vel * a * q.vida;
        polvoPos[i * 3] = o.x + Math.cos(q.ax) * r; polvoPos[i * 3 + 1] = o.y + q.sube * a * q.vida + (q.arriba ? -0.1 : 0.05); polvoPos[i * 3 + 2] = o.z + Math.sin(q.ax) * r;
        const al = Math.sin(Math.PI * a) * (q.arriba ? 0.12 : 0.22);
        polvoCol.set([0.86, 0.8, 0.7, al], i * 4);
      }
      polvoGeo.attributes.position.needsUpdate = true; polvoGeo.attributes.color.needsUpdate = true;
    }

    // ------------------------------------------------------------ acopios de áridos, derrames y bloques de hormigón
    function monton(cx, cz, R, H, { alargar = 1, rumbo = 0, semilla = 1, color = '#ffffff', anillos = 12, lados = 56 } = {}) {
      const rr = kit.mulberry32(semilla), f = [rr() * 6, rr() * 6, rr() * 6];
      const pos = [], idx = [], tan = Math.tan(0.6), cr = Math.cos(rumbo), sr = Math.sin(rumbo);
      for (let i = 0; i <= anillos; i++) {
        const t = i / anillos;
        for (let j = 0; j < lados; j++) {
          const a = (j / lados) * Math.PI * 2;
          const Ra = R * (1 + 0.1 * Math.sin(3 * a + f[0]) + 0.06 * Math.sin(5 * a + f[1]) + 0.035 * Math.sin(11 * a + f[2]));
          const r = i === anillos ? Ra * 1.03 : t * Ra;
          let y = i === anillos ? -0.02 : i === 0 ? H * Math.tanh((R * tan) / H) : H * Math.tanh(((Ra - r) * tan) / H);
          if (i > 0 && i < anillos) y += (rr() - 0.5) * 0.05 * H;
          const lx = Math.cos(a) * r * alargar, lz = Math.sin(a) * r;
          pos.push(cx + lx * cr - lz * sr, y, cz + lx * sr + lz * cr);
        }
      }
      for (let i = 0; i < anillos; i++) for (let j = 0; j < lados; j++) {
        const a = i * lados + j, b = (i + 1) * lados + j, c = (i + 1) * lados + ((j + 1) % lados), d = i * lados + ((j + 1) % lados);
        idx.push(a, c, b, a, d, c);
      }
      poner(gravaFija, geoDe(pos, null, idx), null, { color });
    }
    monton(10.5, -14.5, 4.0, 2.7, { alargar: 1.3, rumbo: 0.3, semilla: 3, color: '#ece2cf' });
    monton(-10.8, -1.6, 3.3, 2.0, { alargar: 1.2, rumbo: 1.2, semilla: 5, color: '#d8bf93' });
    monton(-6.8, 6.2, 2.3, 1.4, { semilla: 9, color: '#a8a196', anillos: 9, lados: 40 });
    monton(2.25, -0.75, 0.55, 0.11, { semilla: 12, color: '#d6ccbb', anillos: 5, lados: 24 }); // derrame que limpia el palero
    monton(-1.7, -2.3, 0.6, 0.12, { semilla: 14, color: '#d6ccbb', anillos: 5, lados: 24 }); // derrame bajo la cabeza de la correa
    // bloques de hormigón tras el acopio grande
    for (let k = 0; k < 4; k++) {
      const x = 11.9 + (k - 1.5) * 1.62 * Math.cos(0.3), z = -19.1 + (k - 1.5) * 1.62 * Math.sin(0.3);
      poner(hormigon, cajaR(1.6, 0.8, 0.8, 0.04), mm(x, 0.4, z, 0, -0.3, 0));
      if (k < 3) poner(hormigon, cajaR(1.6, 0.8, 0.8, 0.04), mm(x + 0.81 * Math.cos(0.3), 1.2, z + 0.81 * Math.sin(0.3), 0, -0.3, 0));
    }

    // conos de tránsito naranjos con franja blanca
    function conoTransito(x, z) {
      const perfil = [[0, 0], [0.19, 0], [0.19, 0.03], [0.13, 0.035], [0.035, 0.7], [0, 0.71]].map(([r, y]) => new THREE.Vector2(r, y));
      const geo = new THREE.LatheGeometry(perfil, 24);
      const p = geo.attributes.position, c = new Float32Array(p.count * 3);
      const naranjo = new THREE.Color('#ff5a14'), blanco = new THREE.Color('#f2f2ee'), negro = new THREE.Color('#2a2a2a');
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = y < 0.031 ? negro : y > 0.32 && y < 0.48 ? blanco : naranjo; c.set([k.r, k.g, k.b], i * 3); }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      poner(plastico, geo, mm(x, 0, z));
      poner(plastico, caja(0.38, 0.03, 0.38), mm(x, 0.015, z), { color: '#2a2a2a' });
    }
    for (const [x, z] of [[-4.4, 2.2], [4.6, 2.8], [-4.2, -3.4], [5.2, -4.4], [0.9, -5.6]]) conoTransito(x, z);

    // letreros de faena sobre postes
    function letreroPoste(clave, x, z, ancho, alto, altura = 1.55) {
      const ry = Math.atan2(0.3 - x, 8.6 - z); // mira hacia la persona en VR
      const q = qE(0, ry, 0);
      cartel(clave, V(x, altura, z), q, ancho, alto, true, chapa);
      for (const dx of [-ancho * 0.32, ancho * 0.32]) {
        const off = V(dx, 0, -0.02).applyQuaternion(q);
        poner(acero, cil(0.025, altura + alto / 2, 10), mm(x + off.x, (altura + alto / 2) / 2, z + off.z));
      }
    }
    letreroPoste('atencion', 5.3, -3.6, 0.8, 0.5);
    letreroPoste('epp', -5.2, -0.6, 0.8, 0.5);
    letreroPoste('grava', 8.6, -9.8, 0.8, 0.25, 1.2);
    letreroPoste('arena', -6.3, 1.4, 0.8, 0.25, 1.2);
    letreroPoste('gravilla', -4.5, 4.5, 0.8, 0.2, 1.1);
    letreroPoste('velocidad', 7.2, -6.6, 0.5, 0.5, 1.8);

    // ------------------------------------------------------------ tablero de control con botonera y grupo electrógeno
    const OP = V(2.9, 0, 0.78); // operador
    const fOp = V(-OP.x, 0, -OP.z).normalize();
    const ryOp = Math.atan2(fOp.x, fOp.z);
    const derOp = V(-fOp.z, 0, fOp.x);
    const TB = OP.clone().addScaledVector(derOp, 0.62).addScaledVector(fOp, 0.02);
    const MT = mat4(TB, qE(0, ryOp, 0));
    const ponerT = (mat, geo, m, o) => poner(mat, geo, MT.clone().multiply(m), o);
    const enT = (x, y, z) => V(x, y, z).applyMatrix4(MT);
    {
      ponerT(hormigon, cajaR(0.75, 0.12, 0.45, 0.02), mm(0, 0.06, -0.03));
      for (const x of [-0.22, 0.22]) {
        ponerT(acero, cil(0.03, 1.5, 14), mm(x, 0.87, -0.05));
        ponerT(grafito, caja(0.12, 0.01, 0.12), mm(x, 0.125, -0.05));
        for (const [a, b] of [[-0.04, -0.04], [0.04, 0.04], [-0.04, 0.04], [0.04, -0.04]]) ponerT(acero, cil(0.008, 0.02, 6), mm(x + a, 0.135, -0.05 + b));
      }
      ponerT(acero, caja(0.5, 0.04, 0.04), mm(0, 0.45, -0.05));
      ponerT(plastico, cajaR(0.6, 0.72, 0.25, 0.012), mm(0, 1.18, 0.1), { color: '#c3c7c4' });
      ponerT(plastico, cajaR(0.56, 0.68, 0.02, 0.006), mm(0, 1.18, 0.232), { color: '#cdd0cd' });
      ponerT(plastico, cajaR(0.72, 0.025, 0.38, 0.006), mm(0, 1.565, 0.11, -0.08, 0, 0), { color: '#b9bdba' });
      for (const y of [0.95, 1.41]) ponerT(acero, cil(0.009, 0.06, 8), mm(-0.285, y, 0.24), chico);
      ponerT(grafito, caja(0.025, 0.13, 0.03), mm(-0.23, 1.2, 0.255), chico);
      ponerT(grafito, cil(0.012, 0.02, 10), mm(-0.23, 1.29, 0.25, Math.PI / 2, 0, 0), chico);
      // botonera: placa negra, partir (verde), parar (rojo), parada de emergencia (hongo rojo sobre anillo amarillo) y selector
      const bt = (geo, m, color) => ponerT(plastico, geo, m, { color, sombra: false });
      bt(cajaR(0.17, 0.27, 0.025, 0.006), mm(0.14, 1.12, 0.253), '#26282a');
      bt(cil(0.017, 0.022, 20), mm(0.14, 1.205, 0.272, Math.PI / 2, 0, 0), '#2e9a3a');
      bt(cil(0.017, 0.022, 20), mm(0.14, 1.145, 0.272, Math.PI / 2, 0, 0), '#b8221c');
      bt(cil(0.038, 0.006, 24), mm(0.14, 1.06, 0.268, Math.PI / 2, 0, 0), '#e8c21a');
      bt(new THREE.SphereGeometry(0.026, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mm(0.14, 1.06, 0.276, Math.PI / 2, 0, 0), '#c8201a');
      bt(cil(0.02, 0.012, 16), mm(0.075, 1.205, 0.268, Math.PI / 2, 0, 0), '#1a1a1a');
      bt(caja(0.008, 0.03, 0.012), mm(0.075, 1.205, 0.278, 0, 0, 0.6), '#1a1a1a');
      const rot = new THREE.PlaneGeometry(0.1, 0.05), A = ATLAS.botonera, u = rot.attributes.uv;
      for (let i = 0; i < u.count; i++) u.setXY(i, (A[0] + u.getX(i) * (A[2] - A[0])) / 512, 1 - (A[3] - u.getY(i) * (A[3] - A[1])) / 512);
      ponerT(letreros, rot, mm(0.14, 0.955, 0.2445), { uv: false });
      const adh = new THREE.PlaneGeometry(0.13, 0.13), B = ATLAS.electrico, ub = adh.attributes.uv;
      for (let i = 0; i < ub.count; i++) ub.setXY(i, (B[0] + ub.getX(i) * (B[2] - B[0])) / 512, 1 - (B[3] - ub.getY(i) * (B[3] - B[1])) / 512);
      ponerT(letreros, adh, mm(-0.09, 1.3, 0.2435), { uv: false });
      for (const x of [-0.18, -0.06, 0.06]) ponerT(grafito, cil(0.018, 0.04, 10), mm(x, 0.8, 0.1));
    }
    // luces piloto: verde con la correa en marcha, roja detenida
    const lamparas = (() => {
      const geos = [-0.05, 0.03].map((x) => { const s = new THREE.SphereGeometry(0.016, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); s.applyMatrix4(MT.clone().multiply(mm(x, 1.46, 0.243, Math.PI / 2, 0, 0))); return s; });
      const geo = kit.mergeGeometries(geos, false);
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
      const m = kit.malla(geo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), { padre: g, sombra: false });
      m.userData.n = geos[0].attributes.position.count;
      return m;
    })();
    let encendido = null;
    function luces(marcha) {
      if (encendido === marcha) return;
      encendido = marcha;
      const c = lamparas.geometry.attributes.color, n = lamparas.userData.n;
      const verde = marcha ? [0.25, 1.4, 0.35] : [0.05, 0.16, 0.06], rojo = marcha ? [0.2, 0.03, 0.03] : [1.4, 0.18, 0.12];
      for (let i = 0; i < c.count; i++) c.setXYZ(i, ...(i < n ? verde : rojo));
      c.needsUpdate = true;
    }

    // grupo electrógeno sobre patín, tambor de aceite y polines de repuesto sobre durmientes
    {
      const GS = mat4(V(4.75, 0, -1.05), qE(0, 0.35, 0));
      const pg = (mat, geo, m, o) => poner(mat, geo, GS.clone().multiply(m), o);
      pg(grafito, cajaR(2.05, 0.12, 1.05, 0.02), mm(0, 0.06, 0));
      pg(azul, cajaR(1.9, 1.05, 0.95, 0.05), mm(0, 0.65, 0));
      for (const sz of [-1, 1]) {
        for (let k = 0; k < 8; k++) pg(grafito, caja(0.46, 0.022, 0.02), mm(-0.55, 0.38 + k * 0.06, sz * 0.48, sz * 0.5, 0, 0), chico);
        for (let k = 0; k < 8; k++) pg(grafito, caja(0.46, 0.022, 0.02), mm(0.5, 0.38 + k * 0.06, sz * 0.48, sz * 0.5, 0, 0), chico);
        for (const x of [-0.05, 0.92]) pg(acero, caja(0.03, 0.1, 0.025), mm(x, 0.7, sz * 0.485), chico);
      }
      pg(acero, cil(0.05, 0.42, 14), mm(0.65, 1.38, 0.2));
      pg(grafito, cil(0.06, 0.03, 14), mm(0.65, 1.6, 0.2, 0.3, 0, 0), chico);
      pg(acero, new THREE.TorusGeometry(0.05, 0.012, 6, 16), mm(0, 1.22, 0), chico);
      pg(grafito, cil(0.04, 0.04, 14), mm(-0.6, 1.19, -0.25), chico);
      const placa = new THREE.PlaneGeometry(0.5, 0.125), A = ATLAS.generador, u = placa.attributes.uv;
      for (let i = 0; i < u.count; i++) u.setXY(i, (A[0] + u.getX(i) * (A[2] - A[0])) / 512, 1 - (A[3] - u.getY(i) * (A[3] - A[1])) / 512);
      pg(letreros, placa, mm(-0.2, 0.95, 0.477), { uv: false });
      // tambor de aceite
      pg(azul, cil(0.29, 0.88, 28), mm(1.45, 0.44, 0.75));
      for (const y of [0.29, 0.59]) pg(azul, new THREE.TorusGeometry(0.29, 0.012, 6, 28), mm(1.45, y, 0.75, Math.PI / 2, 0, 0));
      pg(grafito, cil(0.03, 0.02, 10), mm(1.55, 0.89, 0.7));
      // polines de repuesto
      for (const z of [-1.1, -1.75]) pg(madera, caja(1.0, 0.1, 0.13), mm(-0.4, 0.05, z));
      for (let k = 0; k < 3; k++) {
        pg(acero, cil(0.05, 0.62, 18), mm(-0.75 + k * 0.13, 0.15, -1.42, Math.PI / 2, 0, 0));
        for (const sz of [-1, 1]) pg(acero, cil(0.012, 0.06, 8), mm(-0.75 + k * 0.13, 0.15, -1.42 + sz * 0.34, Math.PI / 2, 0, 0), chico);
      }
      // cable del grupo al tablero
      const a = V(-0.95, 0.35, 0.1).applyMatrix4(GS), b = enT(-0.06, 0.78, 0.1);
      cable([a, V(a.x, 0.02, a.z), V((a.x + b.x) / 2, 0.025, (a.z + b.z) / 2 - 0.3), V(b.x, 0.02, b.z - 0.05), b]);
    }
    // cable del tablero al motor: baja al suelo, rodea el montón por detrás, sube por la pata y sigue la celosía
    {
      const b = enT(-0.18, 0.78, 0.1);
      const pieA = V(XE, RR, 0.95), topeA = P(sA, NB, W);
      const subida = [0.25, 0.55, 0.85].map((k) => aEst(pieA.clone().lerp(topeA, k).add(V(0.07, 0, -0.06))));
      const pts = [b, V(b.x, 0.02, b.z), V(3.5, 0.02, -2.6), V(1.2, 0.02, -4.4), V(-1.6, 0.02, -4.6), aEst(V(XE + 0.15, 0.03, 0.78)), ...subida, aEst(P(sA, NB - 0.06, W + 0.06))];
      for (let sv = sA + 0.8; sv < L - 0.5; sv += 1.0) pts.push(aEst(P(sv, NB - 0.05, W + 0.06)));
      pts.push(aEst(P(L - 0.42, -0.42, 0.68)));
      cable(pts, 0.013, 160);
    }

    // ------------------------------------------------------------ cargador frontal estacionado con el balde en el suelo
    {
      const MLc = mat4(V(4.6, 0, -9.8), qE(0, -0.55, 0));
      const pl = (mat, geo, m, o) => poner(mat, geo, MLc.clone().multiply(m), o);
      const RN = 0.74;
      for (const z of [-1.35, 1.38]) for (const sx of [-1, 1]) rueda(MLc.clone().multiply(mm(sx * 1.0, RN, z)), { R: RN, ancho: 0.52, rLl: 0.42, tacos: 22, llanta: amarillo, lado: sx });
      // chasis trasero, capó, contrapeso y parrilla
      pl(amarillo, cajaR(1.3, 0.6, 2.7, 0.06), mm(0, 0.98, -1.15));
      pl(amarillo, cajaR(1.4, 0.78, 1.8, 0.14), mm(0, 1.66, -1.55));
      pl(amarillo, cajaR(1.78, 0.78, 0.4, 0.1), mm(0, 1.08, -2.62));
      for (let k = 0; k < 5; k++) pl(grafito, caja(1.1, 0.035, 0.03), mm(0, 1.45 + k * 0.08, -2.46));
      for (const sx of [-1, 1]) {
        pl(plastico, cil(0.05, 0.03, 16), mm(sx * 0.7, 1.25, -2.83, Math.PI / 2, 0, 0), { color: '#c0261c' });
        pl(amarillo, cascara([[-2.0, 1.32], [-1.75, 1.52], [-1.35, 1.6], [-0.95, 1.52], [-0.72, 1.32]], 0.03, 0.6), mm(sx * 1.0, 0, 0));
        pl(amarillo, cascara([[0.85, 1.25], [1.05, 1.48], [1.38, 1.56], [1.7, 1.48], [1.92, 1.25]], 0.03, 0.6), mm(sx * 1.0, 0, 0));
      }
      // escape y prefiltro de aire
      pl(grafito, cil(0.065, 0.72, 16), mm(0.42, 2.38, -1.95));
      pl(grafito, cil(0.08, 0.02, 16), mm(0.42, 2.76, -1.92, 0.35, 0, 0));
      pl(plastico, cil(0.11, 0.36, 18), mm(-0.42, 2.22, -1.25), { color: '#1e1f20' });
      // cabina: base, pilares, techo, vidrios, asiento, volante, baliza y espejos
      pl(amarillo, cajaR(1.32, 0.55, 1.3, 0.05), mm(0, 1.52, -0.35));
      for (const [x, z] of [[-0.63, -0.97], [0.63, -0.97], [-0.63, 0.27], [0.63, 0.27]]) pl(amarillo, cajaR(0.08, 1.35, 0.08, 0.02), mm(x, 2.45, z));
      pl(amarillo, cajaR(1.5, 0.1, 1.5, 0.04), mm(0, 3.16, -0.35));
      pl(vidrio, caja(1.18, 1.2, 0.012), mm(0, 2.42, 0.27));
      pl(vidrio, caja(1.18, 1.2, 0.012), mm(0, 2.42, -0.97));
      for (const sx of [-1, 1]) pl(vidrio, caja(0.012, 1.2, 1.16), mm(sx * 0.63, 2.42, -0.35));
      pl(plastico, cajaR(0.5, 0.12, 0.5, 0.04), mm(0, 1.9, -0.55), { color: '#2b2b2b' });
      pl(plastico, cajaR(0.5, 0.55, 0.1, 0.04), mm(0, 2.2, -0.82, -0.12, 0, 0), { color: '#2b2b2b' });
      pl(plastico, cajaR(0.9, 0.3, 0.22, 0.03), mm(0, 1.92, 0.12), { color: '#3a3b3c' });
      pl(grafito, new THREE.TorusGeometry(0.17, 0.016, 8, 28), mm(0, 2.18, 0.0, -0.9, 0, 0));
      pl(grafito, cil(0.025, 0.35, 8), mm(0, 2.05, 0.08, -0.5, 0, 0));
      pl(plastico, cil(0.07, 0.12, 16), mm(0.45, 3.27, -0.75), { color: '#ff8a1c' });
      for (const sx of [-1, 1]) {
        pl(plastico, cil(0.06, 0.07, 16), mm(sx * 0.5, 3.1, 0.38, Math.PI / 2, 0, 0), { color: '#dfe3e6' });
        pl(grafito, cil(0.012, 0.36, 6), mm(sx * 0.8, 2.75, 0.3, 0, 0, sx * 1.1));
        pl(plastico, cajaR(0.03, 0.22, 0.14, 0.01), mm(sx * 0.98, 2.84, 0.3), { color: '#1e1f20' });
      }
      // escalera de acceso y pasamanos
      for (let k = 0; k < 3; k++) pl(grafito, caja(0.08, 0.025, 0.42), mm(-0.72, 0.55 + k * 0.32, -0.35));
      pl(amarillo, cil(0.018, 1.0, 8), mm(-0.68, 2.3, 0.33));
      // chasis delantero, articulación, torre y brazos
      pl(amarillo, cajaR(1.0, 0.55, 1.75, 0.05), mm(0, 0.98, 1.35));
      pl(grafito, cil(0.13, 0.5, 18), mm(0, 1.0, 0.2));
      pl(amarillo, cajaR(0.95, 0.95, 0.38, 0.05), mm(0, 1.45, 0.58));
      const piv = V(0.62, 1.78, 0.6), bis = V(0.62, 0.55, 2.74);
      for (const sx of [-1, 1]) {
        const a = V(sx * piv.x, piv.y, piv.z), b = V(sx * bis.x, bis.y, bis.z);
        pl(amarillo, cajaR(0.13, 1, 0.38, 0.03), tramo(a, b));
        pl(grafito, cil(0.07, 0.2, 16), mm(a.x, a.y, a.z, 0, 0, Math.PI / 2));
        pl(grafito, cil(0.06, 0.2, 16), mm(b.x, b.y, b.z, 0, 0, Math.PI / 2));
        const c0 = V(sx * 0.48, 0.9, 0.95), c1 = a.clone().lerp(b, 0.42).add(V(-sx * 0.12, -0.12, 0)), cm = c0.clone().lerp(c1, 0.6);
        pl(grafito, cil(0.075, 1, 16), tramo(c0, cm));
        pl(acero, cil(0.04, 1, 12), tramo(cm, c1));
      }
      pl(amarillo, cil(0.08, 1.24, 18), mm(0, 1.25, 1.85, 0, 0, Math.PI / 2));
      // cilindro de volteo y biela del balde
      const t0 = V(0, 1.9, 0.75), t1 = V(0, 2.05, 1.75), tm = t0.clone().lerp(t1, 0.55);
      pl(grafito, cil(0.085, 1, 16), tramo(t0, tm));
      pl(acero, cil(0.045, 1, 12), tramo(tm, t1));
      pl(amarillo, cajaR(0.22, 1, 0.16, 0.03), tramo(t1, V(0, 1.25, 1.85)));
      pl(amarillo, cajaR(0.16, 1, 0.12, 0.03), tramo(t1, V(0, 0.95, 2.9)));
      // balde con cuchilla y dientes
      const curva = new THREE.SplineCurve([[4.05, 0.05], [3.4, 0.03], [3.0, 0.1], [2.82, 0.42], [2.86, 0.8], [3.05, 1.0], [3.45, 1.06]].map(([z, y]) => new THREE.Vector2(z, y)));
      const perfil = curva.getPoints(18).map((p) => [p.x, p.y]);
      pl(amarillo, cascara(perfil, 0.03, 2.3), mm(0, 0, 0));
      const forma = new THREE.Shape(perfil.map(([z, y]) => new THREE.Vector2(z, y)));
      for (const sx of [-1, 1]) for (const k of [-1, 1]) {
        const lado = new THREE.ShapeGeometry(forma, 4);
        lado.rotateY(-Math.PI / 2); // normal hacia -x
        if (k > 0) lado.scale(-1, 1, 1); // copia con la normal hacia +x
        orientar(lado);
        lado.translate(sx * 1.15 + k * 0.006, 0, 0);
        pl(amarillo, lado, new THREE.Matrix4());
      }
      pl(acero, caja(2.3, 0.03, 0.18), mm(0, 0.03, 3.98));
      for (let k = 0; k < 7; k++) pl(grafito, cajaR(0.08, 0.05, 0.24, 0.015), mm(-0.99 + k * 0.33, 0.04, 4.12));
      pl(gravaFija, new THREE.SphereGeometry(0.5, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat4(V(0, 0.06, 3.4), null, V(1.6, 0.42, 0.9)), { color: '#dfd5c2' });
    }

    // ------------------------------------------------------------ mira topográfica graduada en pies, cotas y rótulos
    const RODMAN = V(-2.45, 0, 1.3), fRod = V(Math.sin(1.22), 0, Math.cos(1.22));
    const MIRA = { x: RODMAN.x + fRod.x * 0.34, z: RODMAN.z + fRod.z * 0.34, alto: 4.3 };
    const miraTex = (() => {
      const [c, x] = lienzo(64, 1024);
      x.fillStyle = '#f4f2ea'; x.fillRect(0, 0, 64, 1024);
      x.fillStyle = '#c9ccce'; x.fillRect(56, 0, 8, 1024);
      const py = (m) => (1 - m / MIRA.alto) * 1024;
      for (let k = 0; k * PIE < MIRA.alto; k++) {
        x.fillStyle = k % 2 ? '#b0262a' : '#1c1c1c';
        for (let d = 0; d < 10; d += 2) x.fillRect(2, py((k + (d + 1) / 10) * PIE), d === 4 ? 26 : 16, py((k + d / 10) * PIE) - py((k + (d + 1) / 10) * PIE));
        x.fillRect(2, py((k + 0.5) * PIE), 6, py(k * PIE) - py((k + 0.5) * PIE));
        if (k > 0) {
          x.fillStyle = '#b0262a'; x.fillRect(26, py(k * PIE) - 2.5, 30, 5);
          x.save(); x.font = '700 28px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(k), 41, py(k * PIE) - 22); x.restore();
        }
      }
      for (let i = 0; i < 260; i++) { const v = 110 + Math.random() * 50; x.fillStyle = `rgba(${v | 0},${(v * 0.88) | 0},${(v * 0.7) | 0},${0.05 + Math.random() * 0.12})`; x.fillRect(Math.random() * 56, 1024 - Math.random() * Math.random() * 1024, 1 + Math.random() * 3, 1 + Math.random() * 4); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      return t;
    })();
    const mira = new THREE.Group(); mira.position.set(MIRA.x, 0, MIRA.z); mira.rotation.y = Math.atan2(0.3 - MIRA.x, 8.6 - MIRA.z); g.add(mira);
    {
      const geo = new THREE.BoxGeometry(0.07, MIRA.alto, 0.032), uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, i >= 16 && i < 20 ? uv.getX(i) * 0.86 : 0.94); // solo la cara de adelante lleva la graduación
      geo.translate(0, MIRA.alto / 2 + 0.03, 0);
      kit.malla(geo, new THREE.MeshStandardMaterial({ map: miraTex, roughness: 0.55, metalness: 0.15 }), { padre: mira });
    }
    poner(grafito, cajaR(0.1, 0.03, 0.06, 0.006), mat4(V(MIRA.x, 0.015, MIRA.z), mira.quaternion.clone()));
    poner(plastico, cajaR(0.05, 0.05, 0.05, 0.008), mat4(V(0, 1.55, -0.03).applyQuaternion(mira.quaternion).add(V(MIRA.x, 0, MIRA.z)), mira.quaternion.clone()), { color: '#2d6fd0' });
    const cursor = kit.caja(0.12, 0.035, 0.07, new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff6a00, emissiveIntensity: 0.7 }), { padre: mira, sombra: false });

    // cotas: la altura (de la cúspide a la mira) y el diámetro con sus marcas, en una sola malla
    const cotaMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    const cotas = new THREE.InstancedMesh(cil(1, 1, 8), cotaMat, 6);
    cotas.frustumCulled = false; cotas.castShadow = false;
    g.add(cotas);
    const ponerCota = (i, a, b, r) => { const t = tramo(V(...a), V(...b)); t.scale(V(r, 1, r)); cotas.setMatrixAt(i, t); };
    const lh = kit.etiqueta('h', 0.2, { bg: '#5cc8ff', color: '#08202c' });
    const ld = kit.etiqueta('2r', 0.2, { bg: '#ffb347', color: '#1a1206' });
    const lq = kit.etiqueta('dV/dt = 30 pies³/min', 0.17);
    g.add(lh, ld, lq);
    lq.position.set(D.x - 0.2, D.y + 0.75, D.z + 0.25);

    cerrarLotes();

    // ------------------------------------------------------------ personas
    // Repara vértices sin posición (NaN) que pudiera traer la malla de una persona: van al promedio de sus vecinos
    // la sombra de cada persona la proyectan la ropa, el calzado, el chaleco y el casco (ahorra triángulos en el paso de sombras)
    const conSombra = /-(superior|inferior|calzado|chaleco|casco)$/;
    function repararPersona(h) {
      for (const m of h.mallas) m.castShadow = conSombra.test(m.name);
      for (const m of h.mallas) {
        const geo = m.geometry, p = geo.attributes.position, nr = geo.attributes.normal, ix = geo.index?.array;
        if (!ix) continue;
        const malos = new Set();
        for (let i = 0; i < p.count; i++) if (!Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))) malos.add(i);
        if (!malos.size) continue;
        const suma = new Map();
        for (let t = 0; t < ix.length; t += 3) for (let k = 0; k < 3; k++) {
          const a = ix[t + k];
          if (!malos.has(a)) continue;
          for (let j = 0; j < 3; j++) {
            const b = ix[t + j];
            if (malos.has(b)) continue;
            const s = suma.get(a) ?? [0, 0, 0, 0];
            s[0] += p.getX(b); s[1] += p.getY(b); s[2] += p.getZ(b); s[3]++;
            suma.set(a, s);
          }
        }
        for (const a of malos) { const s = suma.get(a); if (s) p.setXYZ(a, s[0] / s[3], s[1] / s[3], s[2] / s[3]); }
        // normales que quedaron indefinidas: se rehacen con las caras vecinas
        const A = V(), B = V(), C = V(), acum = new Map();
        for (let t = 0; t < ix.length; t += 3) {
          const tri = [ix[t], ix[t + 1], ix[t + 2]];
          if (!tri.some((v) => !Number.isFinite(nr.getX(v)))) continue;
          A.fromBufferAttribute(p, tri[0]); B.fromBufferAttribute(p, tri[1]).sub(A); C.fromBufferAttribute(p, tri[2]).sub(A);
          const n = B.cross(C);
          for (const v of tri) if (!Number.isFinite(nr.getX(v))) acum.set(v, (acum.get(v) ?? V()).add(n));
        }
        for (const [v, n] of acum) { n.normalize(); nr.setXYZ(v, n.x, n.y, n.z); }
        p.needsUpdate = true; nr.needsUpdate = true;
      }
    }
    const cima = new THREE.Object3D(); g.add(cima); // la cúspide del montón: la miran el operador y la topógrafa
    g.updateMatrixWorld(true);
    const aMundo = (p) => g.localToWorld(p.clone());
    // agarre: corrige cada cuadro el objetivo de la muñeca para que el punto 'ancla' de la mano llegue a 'meta' (mundo)
    function agarre(h, lado, meta, ancla) {
      const objetivo = meta.clone(), v = V();
      h.alcanzar(lado, objetivo);
      return () => {
        ancla.getWorldPosition(v);
        objetivo.addScaledVector(v.sub(meta), -0.8);
        v.subVectors(objetivo, meta);
        if (v.length() > 0.22) objetivo.copy(meta).addScaledVector(v.normalize(), 0.22);
      };
    }

    // operador: junto al tablero, con el índice en el botón de partida, mira cómo crece el montón
    const operador = kit.persona({ preset: 'operador', semilla: 23, barba: 'sombra', audifonos: true, lentes: true, padre: g, x: OP.x, z: OP.z, ry: ryOp });
    repararPersona(operador);
    operador.posar({ ...kit.POSES.reposo(), dedosD: { c: 0.75, indice: 0.08 }, cuello: [0.1, 0, 0], brazoI: [0.08, 0, 0.1], antebrazoI: [-0.35, 0, 0] });
    operador.mirar(cima);
    const yemaOp = new THREE.Object3D(); yemaOp.position.set(0, -0.042 * operador.F.gMano, 0); operador.huesos.indiceD2.add(yemaOp);
    const botonMundo = g.localToWorld(enT(0.14, 1.205, 0.29));
    const metaOp = botonMundo.clone();
    const corregirOp = agarre(operador, 'D', metaOp, yemaOp);
    const normalBoton = g.localToWorld(enT(0.14, 1.205, 1.29)).sub(botonMundo).normalize();

    // topógrafa: sostiene la mira aplomada con las dos manos y lee la altura de la cúspide
    const topografa = kit.persona({ preset: 'ingeniera', semilla: 8, colorSuperior: '#2c4f6e', padre: g, x: RODMAN.x, z: RODMAN.z, ry: Math.atan2(fRod.x, fRod.z) });
    repararPersona(topografa);
    topografa.posar({ ...kit.POSES.reposo(), dedosD: 0.9, dedosI: 0.9, cuello: [0.02, 0, 0], musloD: [0.04, 0, -0.06], pieD: [0, 0, 0.06] });
    topografa.mirar(cima);
    const corregirTD = agarre(topografa, 'D', aMundo(V(MIRA.x, 1.07, MIRA.z)), topografa.manoD);
    const corregirTI = agarre(topografa, 'I', aMundo(V(MIRA.x, 1.3, MIRA.z)), topografa.manoI);

    // palero: limpia el derrame al pie del montón y lanza la grava de vuelta al cono
    const PAL = V(2.17, 0, -1.52);
    const palero = kit.persona({ preset: 'obrero', semilla: 31, barba: 'barba', guantes: '#9c7a4c', piel: kit.PIELES[4], colorSuperior: '#5d3a2c', padre: g, x: PAL.x, z: PAL.z, ry: 0.12 });
    repararPersona(palero);
    const pala = (() => {
      const grupo = new THREE.Group();
      const piezas = [];
      const pz = (geo, m, color) => { geo.applyMatrix4(m); const n = geo.attributes.position.count, c = new Float32Array(n * 3), k = new THREE.Color(color); for (let i = 0; i < n; i++) c.set([k.r, k.g, k.b], i * 3); geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); for (const a of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(a)) geo.deleteAttribute(a); if (!geo.index) geo.setIndex([...Array(n).keys()]); piezas.push(geo); };
      pz(cil(0.017, 1.0, 12, 0.016), mm(0, 0.62, 0), '#9a7448');
      pz(cil(0.021, 0.16, 14, 0.017), mm(0, 0.1, 0.004), '#4d5156');
      pz(new THREE.TorusGeometry(0.05, 0.011, 8, 16, Math.PI), mm(0, 1.13, 0), '#2a2a2a');
      pz(cil(0.013, 0.1, 10), mm(0, 1.13, 0, 0, 0, Math.PI / 2), '#9a7448');
      // hoja: lámina cóncava con punta
      const pos = [], idx = [], nu = 9, nv = 7;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const u = i / nu - 0.5, v = j / nv;
        const ancho = 0.125 * (1 - 0.35 * Math.pow(v, 3) * (1 - Math.abs(u) * 0.2));
        pos.push(u * 2 * ancho, -v * 0.3 + 0.02 - Math.abs(u) * 0.06 * v * v, 0.03 * (1 - Math.cos(u * Math.PI)) - 0.02 * v + 0.012);
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i; idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1); }
      const hoja = geoDe(pos, null, idx); hoja.rotateX(-0.22);
      pz(hoja, new THREE.Matrix4(), '#55595e');
      const geo = kit.mergeGeometries(piezas, false);
      const m = kit.malla(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.35, side: THREE.DoubleSide }), { padre: grupo });
      m.castShadow = true;
      const carga = kit.malla(new THREE.SphereGeometry(0.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), gravaFija, { padre: grupo, x: 0, y: -0.13, z: 0.03, rx: Math.PI / 2 - 0.22, sombra: false });
      carga.scale.set(1.05, 0.5, 1.3);
      const geoC = carga.geometry;
      geoC.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geoC.attributes.position.count * 3).fill(0.85), 3));
      carga.visible = false;
      const punta = new THREE.Object3D(); punta.position.set(0, -0.14, 0.05); grupo.add(punta);
      grupo.userData = { carga, punta };
      g.add(grupo);
      return grupo;
    })();
    palero.sostener(pala, { D: [0, 0.5, 0], I: [0, 1.12, 0], arriba: [0, 0, 1] });
    palero.mirar(pala.userData.punta);

    // piedras que lanza el palero: vuelan hasta el montón y ruedan talud abajo
    const NL = 28;
    const lanzadas = new THREE.InstancedMesh(piedraGeo, piedraMat, NL);
    lanzadas.frustumCulled = false; lanzadas.castShadow = false;
    for (let i = 0; i < NL; i++) { lanzadas.setColorAt(i, tonoPiedra(col)); lanzadas.setMatrixAt(i, cero); }
    g.add(lanzadas);
    const vuelo = Array.from({ length: NL }, () => ({ activa: false, p: V(), v: V(), t: 0, rodando: false, d: 0, ux: 0, uz: 0, q: qE(rnd() * 6, rnd() * 6, rnd() * 6), s: 0.016 + rnd() * 0.02, giro: 4 + rnd() * 10 }));
    let hActual = M.h(reloj.t) * PIE;
    function lanzar() {
      pala.userData.carga.visible = false;
      const o = g.worldToLocal(pala.userData.punta.getWorldPosition(V()));
      const ux = PAL.x, uz = PAL.z, nu = Math.hypot(ux, uz);
      for (const q of vuelo) {
        const rt = Math.max(0.05, hActual / 2) * (0.35 + rnd() * 0.45), a = Math.atan2(uz, ux) + (rnd() - 0.5) * 0.5;
        const meta = V(Math.cos(a) * rt, 0, Math.sin(a) * rt); meta.y = superficie(meta.x, meta.z, hActual);
        const T = 0.5 + rnd() * 0.18;
        q.p.copy(o).add(V((rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.06));
        q.v.set((meta.x - q.p.x) / T, (meta.y - q.p.y) / T + 4.905 * T, (meta.z - q.p.z) / T);
        q.t = 0; q.activa = true; q.rodando = false; q.ux = ux / nu; q.uz = uz / nu;
      }
    }
    function moverLanzadas(dt) {
      let alguna = false;
      for (let i = 0; i < NL; i++) {
        const q = vuelo[i];
        if (!q.activa) continue;
        alguna = true;
        q.t += dt;
        if (!q.rodando) {
          q.v.y -= 9.81 * dt; q.p.addScaledVector(q.v, dt);
          if (q.v.y < 0 && q.p.y <= superficie(q.p.x, q.p.z, hActual) + q.s * 0.5) { q.rodando = true; q.d = Math.hypot(q.p.x, q.p.z); q.vr = 0.3; }
        } else {
          q.vr += 2.2 * dt; q.d += q.vr * dt;
          const dx = q.p.x, dz = q.p.z, n = Math.hypot(dx, dz) || 1;
          q.p.set((dx / n) * q.d, 0, (dz / n) * q.d); q.p.y = superficie(q.p.x, q.p.z, hActual) + q.s * 0.6;
          if (q.d > hActual / 2 + 0.15 || q.t > 4) { q.activa = false; lanzadas.setMatrixAt(i, cero); continue; }
        }
        lanzadas.setMatrixAt(i, m4.compose(q.p, qr.setFromAxisAngle(ejeGiro, q.t * q.giro).multiply(q.q), vs.setScalar(q.s)));
      }
      if (alguna) lanzadas.instanceMatrix.needsUpdate = true;
    }
    palero.reproducir('palear', { bucle: true, eventos: { carga: () => { pala.userData.carga.visible = true; }, lanza: lanzar } });
    if (REV.pala != null) {
      palero.fijarClip('palear', REV.pala);
      pala.userData.carga.visible = REV.pala > 0.9 && REV.pala < 1.95;
      if (REV.pala > 1.95) { lanzar(); for (let k = 0; k < (REV.pala - 1.95) / 0.02; k++) moverLanzadas(0.02); }
    }

    // primeras poses: varias pasadas para que los agarres converjan
    for (let k = 0; k < 8; k++) {
      operador.actualizar(0); corregirOp();
      topografa.actualizar(0); corregirTD(); corregirTI();
    }
    if (REV.pala == null) palero.actualizar(0);

    // ------------------------------------------------------------ escena según el reloj
    function construir() {
      const t = reloj.t, h = M.h(t), hm = h * PIE, rm = hm / 2;
      hActual = hm;
      cima.position.set(0, Math.max(0.2, hm), 0);
      cono.visible = hm > 0.01;
      cono.scale.setScalar(Math.max(0.001, hm));
      for (const tx of texCono) tx.repeat.set((Math.PI * hm) / 0.42, (1.118 * hm) / 0.42);
      const rp = rm + 0.5;
      pie.visible = hm > 0.05; pie.scale.setScalar(rp);
      for (const tx of texPie) tx.repeat.set((2 * rp) / 0.45, (2 * rp) / 0.45);
      for (let i = 0; i < NA; i++) {
        const q = datosAnillo[i];
        if (hm < 0.05) { anillo.setMatrixAt(i, cero); continue; }
        const d = rm * 1.06 + q.d * Math.min(1, rm * 1.5);
        m4.compose(vp.set(Math.cos(q.a) * d, q.t * 0.45, Math.sin(q.a) * d), q.q, vs.set(q.t, q.t * 0.8, q.t));
        anillo.setMatrixAt(i, m4);
      }
      anillo.instanceMatrix.needsUpdate = true;
      // cotas
      cursor.position.set(0, Math.max(0.06, hm), 0);
      const ver = hm > 0.05;
      const pm = V(0, hm, 0.02).applyQuaternion(mira.quaternion).add(V(MIRA.x, 0, MIRA.z));
      const zc = rm + 0.35;
      if (ver) {
        ponerCota(0, [0, hm, 0], [pm.x + 0.05, hm, pm.z], 0.013);
        ponerCota(1, [-rm, 0.06, zc], [rm, 0.06, zc], 0.012);
        ponerCota(2, [-rm, 0.0, zc], [-rm, 0.2, zc], 0.01);
        ponerCota(3, [rm, 0.0, zc], [rm, 0.2, zc], 0.01);
        ponerCota(4, [-rm, 0.03, 0.05], [-rm, 0.03, zc + 0.05], 0.01);
        ponerCota(5, [rm, 0.03, 0.05], [rm, 0.03, zc + 0.05], 0.01);
      } else for (let i = 0; i < 6; i++) cotas.setMatrixAt(i, cero);
      cotas.instanceMatrix.needsUpdate = true;
      kit.cambiarEtiqueta(lh, `h = ${kit.num(h, 2)} pies · ${kit.num(hm, 2)} m`);
      lh.position.set(MIRA.x - 0.25, hm + 0.22, MIRA.z + 0.1);
      ld.visible = ver;
      kit.cambiarEtiqueta(ld, `diámetro 2r = ${kit.num(2 * (h / 2), 2)} pies`);
      ld.position.set(0, 0.3, zc + 0.05);
      // chorro
      const activo = t > 0 && t < reloj.t1;
      actualizarChorro(hm, activo);
    }

    // ------------------------------------------------------------ gráfico h(t)
    const graf = kit.grafico({
      f: (t) => M.h(t), x0: 0, x1: 12, y0: 0, y1: 12, width: 1.3, height: 0.8,
      xTicks: [0, 2, 4, 6, 8, 10, 12], yTicks: [0, 2, 4, 6, 8, 10, 12], tickFmt: (v) => String(v),
      xLabel: 'tiempo t (min)', yLabel: 'altura h (pies)', curveColor: 0x5cc8ff,
    });
    graf.group.position.set(1.1, 1.05, 7.0); graf.group.rotation.y = -0.42;
    g.add(graf.group);
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => reloj.fijar(graf.xFromLocal(p.x)) });

    function revelar() {
      graf.removePoint('inst');
      if (s.revelar) graf.addPoint('inst', M.instante, 10, { color: 0x6fe3a2, labelX: `t ≈ ${kit.num(M.instante, 2)}`, labelY: 'h = 10' });
      s.ultimo = -1;
    }

    // ------------------------------------------------------------ panel
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'La correa vierte grava a 30 pies³/min y el montón forma un cono cuyo diámetro es igual a su altura. Interesa el instante en que el montón mide 10 pies de alto.',
      ecuaciones: ['V = (π/3)r²h,   r = h/2   ⇒   V = πh³/12', 'dV/dt = (π/4)h²·dh/dt,   dV/dt = 30 pies³/min'],
      lecturas: [
        { etiqueta: 'tiempo t', valor: () => `${kit.num(reloj.t, 2)} min`, color: '#9fb4c8' },
        { etiqueta: 'volumen V', valor: () => `${kit.num(M.V(reloj.t), 1)} pies³`, color: '#c9a7ff', escala: 0.72 },
        { etiqueta: 'altura h', valor: () => `${kit.num(M.h(reloj.t), 2)} pies`, color: '#5cc8ff' },
        { etiqueta: 'radio r = h/2', valor: () => `${kit.num(M.r(reloj.t), 2)} pies`, color: '#ffb347' },
        { etiqueta: 'dV/dt', valor: () => `${kit.num(M.dVdt, 0)} pies³/min`, color: '#c9a7ff', escala: 0.66 },
        { etiqueta: 'dh/dt', valor: () => `${kit.num(M.dhdt(reloj.t), 3)} pies/min`, color: '#5cc8ff', escala: 0.66 },
      ],
      deslizadores: [
        { etiqueta: 'Tiempo t', min: 0, max: 12, paso: 0.02, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 2)} min` },
        { etiqueta: 'Velocidad de la animación', min: 0.1, max: 2, paso: 0.05, color: '#ffb347', get: () => reloj.velocidad, set: (v) => { reloj.velocidad = v; }, formato: (v) => `${kit.num(v, 2)} min/s` },
      ],
      botones: [
        { etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() },
        { etiqueta: 'Ir a h = 10 pies', accion: () => reloj.alInstante() },
        { etiqueta: 'Revelar respuesta', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      pie: () => (s.revelar
        ? 'Con h = 10 pies: 30 = (π/4)·100·dh/dt, de modo que dh/dt = 120/(100π) = 6/(5π) ≈ 0,382 pies/min. El radio crece a la mitad de esa rapidez, unos 0,191 pies/min.'
        : 'El caudal es constante, pero la altura sube cada vez más lento: cada pie³ se reparte en un cono más ancho. La pendiente de la curva h(t) es dh/dt.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-1.1, 1.38, 7.2); panel.mesh.rotation.y = 0.5;
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    // el operador pulsa el botón cada vez que la correa parte o se detiene
    let marchaPrevia = reloj.corriendo, pulso = 1;
    construir();
    luces(false);

    return {
      paneles: [panel],
      radioSombra: 13,
      alturaCartel: 6.6,
      vista: { escritorio: { camara: giro([2.4, 4.3, 12.8]), objetivo: giro([-1.4, 1.6, -2.4]) }, vr: { pos: giro([0.3, 0, 8.6]), yaw: Math.PI } },
      dom: [
        { tipo: 'boton', etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() },
        { tipo: 'rango', etiqueta: 't', min: 0, max: 12, paso: 0.02, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 2)} min` },
        { tipo: 'boton', etiqueta: 'Ir a h = 10 pies', accion: () => reloj.alInstante() },
        { tipo: 'interruptor', etiqueta: 'Revelar respuesta', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      actualizar(dt, activa) {
        if (activa) reloj.tick(dt);
        const corre = activa && reloj.corriendo && reloj.t > 0 && reloj.t < reloj.t1;
        if (corre) {
          tReal += dt;
          gomaTex.offset.y -= VC * gomaTex.repeat.y * dt;
          for (const tx of texCarga) tx.offset.y -= VC * tx.repeat.y * dt;
          for (const tx of texVena) tx.offset.x -= (2.6 / 0.22) * dt;
        }
        luces(corre);
        if (s.ultimo !== reloj.cambio) {
          s.ultimo = reloj.cambio;
          construir();
          graf.setMarker(reloj.t);
          const d = M.dhdt(reloj.t);
          graf.setTangent(reloj.t, Number.isFinite(d) && d < 25 ? d : null, { color: 0xffd08a, len: 0.4 });
          panel.invalidate();
        } else if (corre) actualizarChorro(hActual, true);
        actualizarPolvo(corre);
        // personas
        if (reloj.corriendo !== marchaPrevia) { marchaPrevia = reloj.corriendo; pulso = 0; }
        pulso = Math.min(1, pulso + dt / 0.6);
        metaOp.copy(botonMundo).addScaledVector(normalBoton, 0.004 - 0.012 * Math.sin(Math.PI * pulso));
        operador.actualizar(dt); corregirOp();
        topografa.actualizar(dt); corregirTD(); corregirTI();
        if (REV.pala != null) palero.fijarClip('palear', REV.pala); else palero.actualizar(dt);
        moverLanzadas(REV.pala != null ? 0 : dt);
      },
    };
  },
};
