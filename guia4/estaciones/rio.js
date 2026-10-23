// Problema del río y el cable. Una maqueta del valle sobre una mesa, dentro de la obra, y el mismo valle a escala real
// lejos de ella (el botón «Ir a escala real» lleva a la persona hasta allá). La función objetivo es C(x, y) = 90x + 150y,
// con y = √((500 − x)² + 100²) y 0 ≤ x ≤ 500. El poste naranja define x.
// La maqueta es un bloque topográfico fresado en capas de terciado, con árboles de espuma, sobre un zócalo con placa, escala
// gráfica y norte. Está en una mesa de obra (tablero de terciado sobre caballetes) bajo un toldo plegable, sobre una explanada
// de gravilla, con la bobina del cable y conos a un costado. El capataz señala la orilla de la planta y la ingeniera revisa
// el presupuesto en su tableta.
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RIO, formatoPesos, formatoNum } from '../../src/math/problems.js';
import { fotosActivas } from '../../src/common/textures.js';
import { crearBosque } from '../entorno.js';

const S_MAQ = 0.0018;                 // escala de la maqueta: 500 m son 0,9 m
const MAP_C = { x: 260, z: -50 };     // punto del valle que queda en el centro de la mesa
const TABLE = { y: 0.9, z: -0.55 };
const ZS_NEAR = 3.5, ZS_FAR = -103.5; // línea de postes junto a cada orilla
const W_Y = -0.25;                    // nivel del agua
const PAD_H = 0.9;
const LEJOS = [0, 0, -2400];          // dónde queda el valle a escala real, en coordenadas de la estación

export default {
  id: 'rio',
  tipo: 'optimizacion',
  etiqueta: 'Ejercicio 1.7 · Optimización',
  titulo: 'Río y cable',
  resumen: 'Un río rectilíneo de 100 m de ancho separa una planta eléctrica de una fábrica ubicada 500 m río arriba, en la orilla opuesta. Tender el cable por la orilla cuesta $90 por metro y sobre el agua $150 por metro. ¿Cuál es la longitud del tendido más económico? La función objetivo es C(x, y) = 90x + 150y, con y = √((500 − x)² + 100²) y 0 ≤ x ≤ 500.',

  crear(kit, est) {
    const { THREE, app } = kit;
    const { camera, orbit, rig, input } = app;
    const g = est.grupo;
    const state = { x: 150, mode: 'maqueta', reveal: false, dirty: true };
    const nieblaObra = app.scene.fog ? app.scene.fog.density : 0;
    const locoObra = { ...app.locomotion };

    const valle = new THREE.Group(); valle.name = 'valle'; g.add(valle);

    // ---------------------------------------------------------------- terreno
    const noise = new ImprovedNoise();
    const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const n2 = (x, z, f, o = 0) => noise.noise(x * f + o, 3.7, z * f + o);
    const fbm2 = (x, z) => n2(x, z, 1 / 160) * 0.55 + n2(x, z, 1 / 70, 11) * 0.3 + n2(x, z, 1 / 28, 23) * 0.15;
    const PLANT = { cx: 12, cz: 44, hx: 54, hz: 36 };
    const FACT = { cx: 500, cz: -160, hx: 62, hz: 46 };
    const padW = (x, z, p, b = 22) => { const dx = Math.max(Math.abs(x - p.cx) - p.hx, 0), dz = Math.max(Math.abs(z - p.cz) - p.hz, 0); return 1 - sstep(0, b, Math.hypot(dx, dz)); };
    function terrainH(x, z) {
      let h;
      if (z <= 0 && z >= -100) {
        const s = (z + 50) / 50;
        h = -0.3 - 3.4 * Math.pow(Math.max(0, 1 - s * s), 0.7);
      } else {
        const d = z > 0 ? z : -100 - z;
        const lev = -0.3 + 1.25 * sstep(0, 9, d);
        const hills = fbm2(x, z) * 0.5 + 0.5;
        h = lev + hills * (1.5 + 0.06 * d) * sstep(0, 14, d);
        const far = Math.max(0, Math.abs(z + 50) - 95);
        h += far * far * 0.0026 + far * 0.12;
        const edge = Math.max(0, Math.max(-150 - x, x - 650));
        h += edge * 0.25 * (z > 0 || z < -100 ? 1 : 0);
      }
      const w1 = padW(x, z, PLANT), w2 = padW(x, z, FACT);
      h = h * (1 - w1) + PAD_H * w1;
      h = h * (1 - w2) + PAD_H * w2;
      return h;
    }
    const TX0 = -180, TX1 = 700, TZ0 = -250, TZ1 = 150, SEGX = 300, SEGZ = 136;
    // el valle a escala real necesita todo el detalle; en la maqueta (1,6 m de largo) basta la mitad de la resolución
    function crearTerreno(sx, sz) {
      const tgeo = new THREE.PlaneGeometry(TX1 - TX0, TZ1 - TZ0, sx, sz);
      tgeo.rotateX(-Math.PI / 2);
      tgeo.translate((TX0 + TX1) / 2, 0, (TZ0 + TZ1) / 2);
      const pos = tgeo.attributes.position, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), h = terrainH(x, z);
        pos.setY(i, h);
        const inR = z <= 0 && z >= -100, d = z > 0 ? z : z < -100 ? -100 - z : 0;
        const nz = fbm2(x * 1.7 + 40, z * 1.7) * 0.5 + 0.5, dry = sstep(0.55, 0.85, fbm2(x * 0.6 + 200, z * 0.6) * 0.5 + 0.5);
        let r = 0.17 + 0.1 * nz + dry * 0.1, gg = 0.28 + 0.14 * nz + dry * 0.03, b = 0.09 + 0.05 * nz;
        const rock = sstep(10, 42, h);
        r = mix(r, 0.4, rock * 0.75); gg = mix(gg, 0.38, rock * 0.75); b = mix(b, 0.33, rock * 0.75);
        const shore = 1 - sstep(0, 6, d);
        r = mix(r, 0.55, shore * 0.85); gg = mix(gg, 0.5, shore * 0.85); b = mix(b, 0.4, shore * 0.85);
        if (inR) { const k = 0.55 + 0.45 * sstep(0, 5, Math.min(-z, 100 + z)); r = 0.2 * k; gg = 0.2 * k; b = 0.16 * k; }
        const pad = Math.max(padW(x, z, PLANT, 8), padW(x, z, FACT, 8));
        r = mix(r, 0.46, pad); gg = mix(gg, 0.46, pad); b = mix(b, 0.44, pad);
        col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
      }
      tgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      tgeo.computeVertexNormals();
      return tgeo;
    }
    const tgeo = crearTerreno(SEGX, SEGZ), tgeoMaq = crearTerreno(SEGX / 2, SEGZ / 2);
    const grayDetail = () => {
      const size = 256, f = kit.fbm(size, 6, 5, 3);
      const c = document.createElement('canvas'); c.width = c.height = size;
      const gc = c.getContext('2d'), img = gc.createImageData(size, size);
      for (let i = 0; i < f.length; i++) { const v = 150 + f[i] * 105; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
      gc.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      t.repeat.set((TX1 - TX0) / 9, (TZ1 - TZ0) / 9);
      return t;
    };
    const gravelN = kit.makeSurface('gravel', { size: 256, seed: 3, repeat: [(TX1 - TX0) / 5, (TZ1 - TZ0) / 5], roughness: false }).normalMap;
    const terreno = new THREE.Mesh(tgeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: grayDetail(), normalMap: gravelN, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.96, metalness: 0, envMapIntensity: 0.45 }));
    terreno.receiveShadow = true; valle.add(terreno);
    // faldón: en la maqueta el terreno es un bloque fresado en capas de terciado de 4 m (7 mm en la mesa), como una maqueta
    // topográfica; a escala real queda en los bordes lejanos del valle y vuelve a ser tierra
    const CAPA = 32;                      // metros de altura que abarca una repetición de la textura (8 capas)
    const texCapas = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 256;
      const gc = c.getContext('2d'), r = kit.mulberry32(23);
      for (let k = 0; k < 8; k++) {
        const y0 = k * 32;
        gc.fillStyle = `hsl(${31 + r() * 4}, ${30 + r() * 6}%, ${58 + (k % 2 ? 6 : 0) + r() * 4}%)`; gc.fillRect(0, y0, 64, 32);
        for (let s = 0; s < 16; s++) { gc.fillStyle = `rgba(105,75,42,${0.05 + r() * 0.1})`; gc.fillRect(0, y0 + 3 + r() * 27, 64, 1); }
        gc.fillStyle = 'rgba(62,44,26,0.8)'; gc.fillRect(0, y0, 64, 2);   // línea de cola entre capas
      }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return t;
    })();
    const matFaldonMaq = new THREE.MeshStandardMaterial({ map: texCapas, roughness: 0.85, side: THREE.DoubleSide });
    const matFaldonReal = new THREE.MeshStandardMaterial({ color: 0x4c3f31, roughness: 1, side: THREE.DoubleSide });
    const faldon = (() => {
      const sx = SEGX / 2, sz = SEGZ / 2, pos = tgeoMaq.attributes.position, verts = [], uvs = [], ind = [];
      const e1 = [], e2 = [], e3 = [], e4 = [];
      for (let i = 0; i <= sx; i++) { e1.push(i); e2.push(sz * (sx + 1) + i); }
      for (let j = 0; j <= sz; j++) { e3.push(j * (sx + 1)); e4.push(j * (sx + 1) + sx); }
      for (const e of [e1, e2, e3, e4]) {
        const base = verts.length / 3;
        let s = 0;
        e.forEach((vi, k) => {
          if (k) s += Math.hypot(pos.getX(vi) - pos.getX(e[k - 1]), pos.getZ(vi) - pos.getZ(e[k - 1]));
          const y = pos.getY(vi);
          verts.push(pos.getX(vi), y, pos.getZ(vi), pos.getX(vi), -7, pos.getZ(vi));
          uvs.push(s / 40, (y + 7) / CAPA, s / 40, 0);
        });
        for (let k = 0; k < e.length - 1; k++) { const a = base + 2 * k; ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      sg.setIndex(ind); sg.computeVertexNormals();
      const m = new THREE.Mesh(sg, matFaldonMaq); m.receiveShadow = true; valle.add(m);
      return m;
    })();
    const agua = kit.createWater({ length: TX1 - TX0, width: 100, segX: 220, segZ: 20, y: W_Y });
    agua.mesh.position.set((TX0 + TX1) / 2, W_Y, -50); valle.add(agua.mesh);

    // ---------------------------------------------------------------- vegetación: los árboles de la obra, juncos y rocas
    const rng = kit.mulberry32(42);
    const offPads = (x, z) => padW(x, z, PLANT, 30) < 0.02 && padW(x, z, FACT, 30) < 0.02;
    const onLand = (x, z) => (z > 14 || z < -114) && offPads(x, z);
    const puntos = [];
    const sembrar = (esp, n, pred, s0, s1) => {
      let k = 0, intentos = 0;
      while (k < n && intentos < n * 40) {
        intentos++;
        const x = TX0 + 20 + rng() * (TX1 - TX0 - 40), z = TZ0 + 10 + rng() * (TZ1 - TZ0 - 20);
        if (!pred(x, z)) continue;
        const y = terrainH(x, z);
        if (Math.abs(terrainH(x + 4, z) - y) > 2.2 || Math.abs(terrainH(x, z + 4) - y) > 2.2) continue;
        puntos.push({ x, y, z, esp, s: s0 + rng() * (s1 - s0) }); k++;
      }
    };
    sembrar('pino', 260, (x, z) => onLand(x, z) && fbm2(x * 0.9, z * 0.9) > -0.05 && Math.abs(z + 50) > 60, 0.8, 1.15);
    sembrar('roble', 200, (x, z) => onLand(x, z) && fbm2(x * 0.8 + 99, z * 0.8) > -0.2, 0.75, 1.2);
    sembrar('alamo', 120, (x, z) => ((z > 8 && z < 40) || (z < -108 && z > -140)) && offPads(x, z) && rng() < 0.8, 0.8, 1.1);
    sembrar('arbusto', 180, (x, z) => ((z > 4 && z < 30) || (z < -104 && z > -130)) && offPads(x, z), 0.8, 1.4);
    const bosque = crearBosque(valle, puntos, { radio: 120, radioVR: 70, semilla: 42 });
    // árboles de maqueta: en la mesa, las tarjetas del bosque reducidas a centímetros se ven como pasto disperso. Ahí los
    // árboles son copas de espuma sobre un tronco, como en una maqueta de presentación (dos llamadas de dibujo en total)
    const arbolesMaq = new THREE.Group(); arbolesMaq.name = 'arboles de maqueta'; valle.add(arbolesMaq);
    {
      const sinUV = (geo) => { geo.deleteAttribute('uv'); return geo; };
      const colorear = (geo, hex) => {
        const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) c.toArray(a, i * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
      };
      // copa de espuma: icosaedro con relieve suave y normales continuas (sin facetas)
      let copa = new THREE.IcosahedronGeometry(1, 1);
      copa.deleteAttribute('uv'); copa.deleteAttribute('normal'); copa = mergeVertices(copa);
      { const p = copa.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.15 * noise.noise(x * 1.9 + 3.1, y * 1.9 + 7.3, z * 1.9); p.setXYZ(i, x * k, y * k, z * k); } }
      copa.scale(0.36, 0.38, 0.36).translate(0, 0.64, 0); copa.computeVertexNormals(); colorear(copa, 0xffffff);
      const tronco = (r0, r1, h) => colorear(sinUV(new THREE.CylinderGeometry(r1, r0, h, 5, 1, true).translate(0, h / 2, 0)), 0x6b5440);
      const geoCopa = kit.mergeGeometries([copa, tronco(0.045, 0.03, 0.42)]);
      const geoPino = kit.mergeGeometries([
        colorear(sinUV(new THREE.ConeGeometry(0.26, 0.55, 8, 1, true).translate(0, 0.455, 0)), 0xffffff),
        colorear(sinUV(new THREE.ConeGeometry(0.19, 0.5, 8, 1, true).translate(0, 0.75, 0)), 0xffffff),
        tronco(0.04, 0.025, 0.3),
      ]);
      const matArbol = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
      const rr = kit.mulberry32(77), mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler(), c = new THREE.Color();
      const llenar = (lista, geo, escala, base) => {
        const im = new THREE.InstancedMesh(geo, matArbol, lista.length);
        lista.forEach((p, i) => {
          const [sh, sv] = escala(p);
          ee.set((rr() - 0.5) * 0.06, rr() * 6.28, (rr() - 0.5) * 0.06); qq.setFromEuler(ee);
          mm.compose(new THREE.Vector3(p.x, p.y - 0.4, p.z), qq, new THREE.Vector3(sh, sv, sh)); im.setMatrixAt(i, mm);
          im.setColorAt(i, c.set(base[p.esp] ?? base.otro).multiplyScalar(0.8 + rr() * 0.4));
        });
        im.frustumCulled = false; im.castShadow = true; arbolesMaq.add(im);
        return im;
      };
      llenar(puntos.filter((p) => p.esp === 'roble' || p.esp === 'alamo'), geoCopa,
        (p) => (p.esp === 'roble' ? [14.5 * p.s, 13.5 * p.s] : [6.5 * p.s, 20 * p.s]), { roble: 0x3f5f2a, alamo: 0x627f31, otro: 0x4a6a2e });
      llenar(puntos.filter((p) => p.esp === 'pino'), geoPino, (p) => [16 * p.s, 17 * p.s], { pino: 0x2b4b2e, otro: 0x2b4b2e });
    }
    let juncos = null, rocas = null, nRocas = 0;
    { // juncos junto al agua
      const c = document.createElement('canvas'); c.width = 128; c.height = 256;
      const gc = c.getContext('2d'); gc.clearRect(0, 0, 128, 256);
      const r2 = kit.mulberry32(5);
      for (let i = 0; i < 22; i++) {
        const x0 = 10 + r2() * 108, h = 140 + r2() * 110, lean = (r2() - 0.5) * 36;
        gc.strokeStyle = `rgb(${70 + r2() * 40},${110 + r2() * 50},${40 + r2() * 30})`; gc.lineWidth = 3 + r2() * 3;
        gc.beginPath(); gc.moveTo(x0, 256); gc.quadraticCurveTo(x0 + lean * 0.3, 256 - h * 0.6, x0 + lean, 256 - h); gc.stroke();
      }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const a = new THREE.PlaneGeometry(1.8, 3.2); a.translate(0, 1.6, 0);
      const b = a.clone(); b.rotateY(Math.PI / 2);
      const geo = kit.mergeGeometries([a, b]);
      const n = 500;
      juncos = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
      for (let i = 0; i < n; i++) {
        const near = rng() < 0.5, x = TX0 + 30 + rng() * (TX1 - TX0 - 60), z = near ? 0.2 + rng() * 2.5 : -100.2 - rng() * 2.5;
        p.set(x, terrainH(x, z) - 0.1, z); const sc = 0.8 + rng() * 1.1; s.set(sc, sc, sc); e.set(0, rng() * 6.28, 0); q.setFromEuler(e);
        m.compose(p, q, s); juncos.setMatrixAt(i, m);
      }
      juncos.frustumCulled = false; valle.add(juncos);
    }
    { // rocas en las orillas
      const geo = new THREE.IcosahedronGeometry(1, 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const k = 0.8 + 0.35 * noise.noise(pos.getX(i) * 2.1, pos.getY(i) * 2.1, pos.getZ(i) * 2.1); pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k); }
      geo.computeVertexNormals();
      const n = 160;
      rocas = new THREE.InstancedMesh(geo, kit.mat('concrete', { repeat: [0.6, 0.6], color: 0x8f8a80, roughness: 1, normalScale: 1.2 }), n);
      const q = new THREE.Quaternion(), e = new THREE.Euler(), lista = [];
      for (let i = 0; i < n; i++) {
        const near = rng() < 0.5, x = TX0 + 30 + rng() * (TX1 - TX0 - 60), z = near ? -1.5 + rng() * 7 : -100 - (-1.5 + rng() * 7);
        const sc = 0.5 + rng() * rng() * 3.2, p = new THREE.Vector3(x, terrainH(x, z) + sc * 0.15, z), s = new THREE.Vector3(sc, sc * (0.7 + rng() * 0.4), sc * (0.8 + rng() * 0.5));
        e.set(rng() * 0.4, rng() * 6.28, rng() * 0.4); q.setFromEuler(e);
        lista.push({ sc, m: new THREE.Matrix4().compose(p, q, s) });
      }
      // las más grandes primero: en la maqueta solo se dibujan esas (las chicas miden milímetros)
      lista.sort((a, b) => b.sc - a.sc).forEach((r, i) => rocas.setMatrixAt(i, r.m));
      nRocas = n;
      rocas.frustumCulled = false; rocas.castShadow = true; valle.add(rocas);
    }

    // ---------------------------------------------------------------- edificios
    const matBrick = kit.mat('brick', { repeat: [10, 2], color: 0xe8e2da, roughness: 1, normalScale: 0.9 });
    const matConc = kit.mat('concrete', { repeat: [6, 3], color: 0xd9d6cf, roughness: 1, normalScale: 0.5 });
    const matRoof = kit.mat('ribbed', { repeat: [14, 3], color: 0x9aa3ab, roughness: 1, metalness: 0.55, normalScale: 0.9 });
    const matMetalR = kit.mat('ribbed', { repeat: [10, 2], color: 0xc9d1d8, roughness: 1, metalness: 0.45, normalScale: 0.8 });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x8b949c, metalness: 0.8, roughness: 0.42 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x2b2f34, metalness: 0.6, roughness: 0.5 });
    const matRed = new THREE.MeshStandardMaterial({ color: 0xc4372b, roughness: 0.7 });
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7 });
    const matCeramic = new THREE.MeshStandardMaterial({ color: 0xb98a5c, roughness: 0.35, metalness: 0.1 });
    const bld = new THREE.Group(); valle.add(bld);
    const box = (w, h, d, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; bld.add(m); return m; };
    const cyl = (r0, r1, h, mat, x, y, z, seg = 18) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; bld.add(m); return m; };
    const prism = (pts, depth, mat, x, y, z, axis = 'x') => {
      const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
      const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
      geo.translate(0, 0, -depth / 2); if (axis === 'x') geo.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; bld.add(m); return m;
    };
    const matLamp = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    const chimney = (x, z, h, r) => {
      const seg = 6, sh = h / seg;
      for (let i = 0; i < seg; i++) { const r0 = r * (1 - (i / seg) * 0.35), r1 = r * (1 - ((i + 1) / seg) * 0.35); cyl(r0, r1, sh, i % 2 ? matWhite : matRed, x, PAD_H + sh * (i + 0.5), z, 20); }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 10, 8), matLamp);
      lamp.position.set(x, PAD_H + h + r * 0.3, z); bld.add(lamp);
    };
    const winFacade = (w, h, x, y, z, rotY, cols, rows, seed) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
        map: kit.windowsColorTexture({ cols, rows, seed, base: '#b9b4aa' }), emissiveMap: kit.windowsTexture({ cols, rows, lit: 0.22, seed }), emissive: 0xffd9a0, emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.1,
      }));
      m.position.set(x, y, z); m.rotation.y = rotY; m.receiveShadow = true; bld.add(m);
    };
    const pylon = (x, z, h = 26) => {
      const p = new THREE.Group();
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 0.35), matSteel); leg.position.set(dx * 0.8, h / 2, dz * 0.8); p.add(leg); }
      for (let i = 1; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.4 - i * 0.2, 0.18, 0.18), matSteel); b.position.set(0, (i * h) / 6.5, 0.8); p.add(b); const c = b.clone(); c.position.z = -0.8; p.add(c); }
      for (const yy of [h - 3, h - 7]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 0.4), matSteel); arm.position.set(0, yy, 0); p.add(arm); for (const sx of [-4.5, 0, 4.5]) { const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 8), matCeramic); ins.position.set(sx, yy - 1, 0); p.add(ins); } }
      p.position.set(x, PAD_H, z); p.traverse((o) => { if (o.isMesh) o.castShadow = true; }); bld.add(p);
    };
    const substation = (cx, cz) => {
      box(24, 0.3, 18, matConc, cx, PAD_H + 0.15, cz, false);
      for (const dx of [-7, 0, 7]) { box(4.2, 4.6, 3.6, matDark, cx + dx, PAD_H + 2.6, cz - 2); for (const sx of [-1.2, 0, 1.2]) cyl(0.35, 0.28, 1.8, matCeramic, cx + dx + sx, PAD_H + 5.4, cz - 2, 8); }
      box(0.2, 3, 18, matSteel, cx - 12, PAD_H + 1.5, cz, false); box(0.2, 3, 18, matSteel, cx + 12, PAD_H + 1.5, cz, false); box(24, 3, 0.2, matSteel, cx, PAD_H + 1.5, cz + 9, false);
    };
    { // planta eléctrica (orilla cercana)
      const pc = { x: PLANT.cx, z: PLANT.cz };
      box(48, 13, 24, matBrick, pc.x, PAD_H + 6.5, pc.z);
      prism([[-12, 0], [12, 0], [0, 4.2]], 49, matRoof, pc.x, PAD_H + 13, pc.z, 'x');
      winFacade(44, 8.5, pc.x, PAD_H + 7.4, pc.z - 12.06, Math.PI, 11, 3, 3);
      box(14, 9, 12, matConc, pc.x - 33, PAD_H + 4.5, pc.z + 4);
      box(16, 7, 10, matMetalR, pc.x + 38, PAD_H + 3.5, pc.z - 4);
      chimney(pc.x + 22, pc.z + 16, 54, 2.4); chimney(pc.x + 30, pc.z + 16, 48, 2.0);
      for (const dx of [-6, 0, 6]) cyl(5, 5, 11, matSteel, pc.x - 30, PAD_H + 5.5, pc.z + 24 - (dx + 6) * 0.6, 24);
      box(2.2, 2.2, 20, matSteel, pc.x - 20, PAD_H + 9, pc.z + 16, true);
      substation(-8, 17); pylon(-32, 24); pylon(-32, 56, 24);
      box(12, 0.1, 28, matDark, 0, PAD_H + 0.06, 22, false);
    }
    { // fábrica (orilla lejana)
      const fx = FACT.cx, fz = FACT.cz;
      for (let i = 0; i < 8; i++) prism([[0, 0], [9, 0], [9, 4.2], [0, 8.4]], 36, i % 2 ? matMetalR : matRoof, fx - 36 + i * 9, PAD_H, fz, 'z');
      winFacade(70, 4.2, fx, PAD_H + 2.2, fz + 18.06, 0, 14, 2, 8);
      box(74, 0.6, 40, matConc, fx, PAD_H + 0.3, fz, false);
      for (let i = 0; i < 3; i++) { cyl(5.2, 5.2, 24, matMetalR, fx - 26 + i * 12, PAD_H + 12, fz + 36, 24); const cone = new THREE.Mesh(new THREE.ConeGeometry(5.6, 3.6, 24), matSteel); cone.position.set(fx - 26 + i * 12, PAD_H + 25.8, fz + 36); cone.castShadow = true; bld.add(cone); }
      box(30, 1.4, 1.4, matSteel, fx - 8, PAD_H + 14, fz + 26);
      chimney(fx + 44, fz - 8, 40, 2.1);
      cyl(4.5, 4.5, 14, matSteel, fx + 52, PAD_H + 7, fz + 22, 20); cyl(4.5, 4.5, 14, matSteel, fx + 62, PAD_H + 7, fz + 22, 20);
      substation(fx + 6, -112); pylon(fx - 30, -110); pylon(fx + 40, -112, 24);
      box(14, 0.1, 30, matDark, fx + 24, PAD_H + 0.06, -135, false);
    }
    // los edificios son estáticos: se unen todas las piezas que comparten material (las torres, la subestación y las
    // chimeneas eran más de 170 llamadas de dibujo; quedan unas 12)
    {
      bld.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(bld.matrixWorld).invert(), porMat = new Map();
      bld.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) { if (!porMat.has(o.material)) porMat.set(o.material, []); porMat.get(o.material).push(o); } });
      for (const [mat, lista] of porMat) {
        if (lista.length < 2) continue;
        const geos = lista.map((o) => {
          const gg = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k);
          return gg.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        });
        const unida = kit.mergeGeometries(geos);
        for (const gg of geos) gg.dispose();
        if (!unida) continue;
        const sombra = lista.some((o) => o.castShadow);
        for (const o of lista) { o.removeFromParent(); o.geometry.dispose(); }
        const m = new THREE.Mesh(unida, mat); m.castShadow = sombra; m.receiveShadow = true; bld.add(m);
      }
    }

    // ---------------------------------------------------------------- rótulos y cotas del valle
    const fitLabel = (l, hWorld) => l.scale.setScalar(hWorld / l.userData.size[1]);
    const billboardLabel = (text, h, opts = {}) => {
      const l = kit.createLabel(text, { size: 0.06, color: '#fff', bg: 'rgba(12,20,32,0.82)', weight: 700, billboard: true, ...opts });
      l.userData.worldH = h; l.userData.texto = text; app.billboard(l);
      return l;
    };
    const lblPlant = billboardLabel('Planta eléctrica', 12); lblPlant.position.set(PLANT.cx, 70, PLANT.cz); valle.add(lblPlant);
    const lblFact = billboardLabel('Fábrica', 12); lblFact.position.set(FACT.cx, 122, FACT.cz); valle.add(lblFact);
    const lblW = billboardLabel('100 m', 9); lblW.position.set(-75, 6, -50); valle.add(lblW);
    const lblD = billboardLabel('500 m', 9); lblD.position.set(250, 9, 12); valle.add(lblD);
    const dimGroup = new THREE.Group(); valle.add(dimGroup);
    const dim = (a, b, r) => {
      const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, toneMapped: false }));
      m.position.copy(a).addScaledVector(dir, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); dimGroup.add(m);
    };
    dim(new THREE.Vector3(-4, 1.2, 0), new THREE.Vector3(-4, 1.2, -100), 0.3);
    dim(new THREE.Vector3(0, 1.2, 9), new THREE.Vector3(500, 1.2, 9), 0.3);

    // ---------------------------------------------------------------- cable, postes y boyas
    const cableMatShore = new THREE.MeshStandardMaterial({ color: 0xffa21f, emissive: 0xff7a00, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.3 });
    const cableMatWater = new THREE.MeshStandardMaterial({ color: 0x35d3ff, emissive: 0x0aa6e0, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.2 });
    const cableGroup = new THREE.Group(); valle.add(cableGroup);
    const poleGeo = kit.mergeGeometries([new THREE.CylinderGeometry(0.2, 0.26, 9.4, 8).translate(0, 4.7, 0), new THREE.BoxGeometry(3.2, 0.22, 0.22).translate(0, 8.9, 0)]);
    const polesInst = new THREE.InstancedMesh(poleGeo, kit.mat('wood', { repeat: [1, 3], color: 0x8a6a48, roughness: 0.9 }), 40);
    polesInst.frustumCulled = false; polesInst.castShadow = true; polesInst.count = 0; valle.add(polesInst);
    const buoyInst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshStandardMaterial({ color: 0xff5a36, roughness: 0.4 }), 60);
    buoyInst.frustumCulled = false; buoyInst.count = 0; valle.add(buoyInst);
    const lblShore = billboardLabel('', 8, { size: 0.05 }), lblWater = billboardLabel('', 8, { size: 0.05 });
    valle.add(lblShore, lblWater);
    // en la maqueta los rótulos miden unos 2 cm (con 6,5 m quedaban de 1 cm y no se leían desde la posición de VR)
    const VIZ = { maqueta: { cable: 1.15, buoy: 2.0, pole: 2.6, mark: 2.2, label: 12 }, real: { cable: 0.32, buoy: 0.9, pole: 1, mark: 1.3, label: 5 } };
    const vz = () => VIZ[state.mode === 'maqueta' ? 'maqueta' : 'real'];
    const tubeFrom = (points, radius, mat) => {
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 3), radius, 8, false), mat); m.castShadow = true; return m;
    };
    const shoreLine = (xa, xb, z) => {
      const len = Math.abs(xb - xa), spans = Math.max(1, Math.ceil(len / 25)), tops = [], bases = [];
      for (let i = 0; i <= spans; i++) { const x = xa + ((xb - xa) * i) / spans, y = terrainH(x, z); bases.push(new THREE.Vector3(x, y, z)); tops.push(new THREE.Vector3(x, y + 8.9, z)); }
      const pts = [];
      for (let i = 0; i < spans; i++) { const A = tops[i], B = tops[i + 1]; for (let k = 0; k < 6; k++) { const s = k / 6; pts.push(new THREE.Vector3(mix(A.x, B.x, s), mix(A.y, B.y, s) - 0.9 * 4 * s * (1 - s), z)); } }
      pts.push(tops[spans].clone());
      return { pts, bases, tops };
    };
    function buildRoute() {
      const xv = state.x, V = vz();
      for (const c of cableGroup.children) c.geometry.dispose();
      cableGroup.clear();
      const poles = [], waterPts = [];
      let shore = null;
      if (xv > 0.5) { shore = shoreLine(0, xv, ZS_NEAR); poles.push(...shore.bases); }
      const start = shore ? shore.tops[shore.tops.length - 1] : new THREE.Vector3(0, terrainH(0, ZS_NEAR) + 8.9, ZS_NEAR);
      if (!shore) poles.push(new THREE.Vector3(0, terrainH(0, ZS_NEAR), ZS_NEAR));
      waterPts.push(start.clone(), new THREE.Vector3(xv, terrainH(xv, 1.0) + 0.5, 1.0), new THREE.Vector3(xv, W_Y + 0.12, -1.5));
      const farEnd = new THREE.Vector3(RIO.D, W_Y + 0.12, -98.5);
      const L = new THREE.Vector3().subVectors(farEnd, waterPts[waterPts.length - 1]);
      const n = Math.max(2, Math.ceil(L.length() / 22));
      for (let i = 1; i <= n; i++) waterPts.push(waterPts[2].clone().addScaledVector(L, i / n));
      waterPts.push(new THREE.Vector3(RIO.D, terrainH(RIO.D, -101.5) + 0.5, -101.5), new THREE.Vector3(RIO.D, terrainH(RIO.D, ZS_FAR) + 8.9, ZS_FAR));
      poles.push(new THREE.Vector3(RIO.D, terrainH(RIO.D, ZS_FAR), ZS_FAR));
      if (shore) cableGroup.add(tubeFrom(shore.pts, V.cable, cableMatShore));
      cableGroup.add(tubeFrom(waterPts, V.cable * 1.1, cableMatWater));
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(V.pole, 1, V.pole);
      const unique = [];
      for (const p of poles) if (!unique.some((u) => u.distanceToSquared(p) < 1)) unique.push(p);
      polesInst.count = Math.min(40, unique.length);
      for (let i = 0; i < polesInst.count; i++) { m.compose(unique[i], q, s); polesInst.setMatrixAt(i, m); }
      polesInst.instanceMatrix.needsUpdate = true;
      const a = new THREE.Vector3(xv, W_Y + 0.2, -1.5), b = new THREE.Vector3(RIO.D, W_Y + 0.2, -98.5);
      const nb = Math.min(60, Math.max(2, Math.floor(a.distanceTo(b) / 20)));
      buoyInst.count = nb;
      for (let i = 0; i < nb; i++) { const p = a.clone().lerp(b, (i + 0.5) / nb); m.compose(p, q, new THREE.Vector3(V.buoy, V.buoy, V.buoy)); buoyInst.setMatrixAt(i, m); }
      buoyInst.instanceMatrix.needsUpdate = true;
    }
    let lastLbl = '';
    function updateSegmentLabels() {
      const x = state.x, y = RIO.y(x), key = `${x}|${Math.round(y)}|${state.mode}`;
      if (key === lastLbl) return;
      lastLbl = key;
      kit.setLabelText(lblShore, `x = ${formatoNum(x, 0)} m   90x = ${formatoPesos(RIO.a * x)}`, { size: 0.05, color: '#ffd9a0', bg: 'rgba(12,20,32,0.85)', weight: 700 });
      kit.setLabelText(lblWater, `y = ${formatoNum(y, 0)} m   150y = ${formatoPesos(RIO.b * y)}`, { size: 0.05, color: '#9fe8ff', bg: 'rgba(12,20,32,0.85)', weight: 700 });
      for (const l of [lblShore, lblWater]) fitLabel(l, vz().label);
      lblShore.userData.texto = `x = ${formatoNum(x, 0)} m`; lblWater.userData.texto = `y = ${formatoNum(y, 0)} m`;
      // en la maqueta el rótulo sube con x: bajo el de la planta cuando x es chico y sobre el de 500 m cuando x es grande.
      // A escala real va bajo, bajo el de 500 m: más arriba tapaba la fábrica y el rótulo de y a quien parte desde la planta
      lblShore.position.set(x / 2, state.mode === 'real' ? 4 : 14 + 42 * Math.min(1, x / RIO.D), ZS_NEAR); lblShore.visible = x > 5;
      lblWater.position.set((x + RIO.D) / 2, state.mode === 'real' ? 58 : 46, -50); // más alto que el rótulo de x para que no se junten
    }

    // ---------------------------------------------------------------- poste de control y bandera del óptimo
    const marker = new THREE.Group(); valle.add(marker);
    const mkMat = new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff6a00, emissiveIntensity: 0.9, roughness: 0.35 });
    const mkPole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 22, 10), mkMat); mkPole.position.y = 11; marker.add(mkPole);
    const mkBall = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), mkMat); mkBall.position.y = 24.5; marker.add(mkBall);
    const mkRing = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.45, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false })); mkRing.rotation.x = Math.PI / 2; mkRing.position.y = 0.6; marker.add(mkRing);
    // el valor de x ya va en el rótulo del tramo por la orilla: el poste no lleva un rótulo propio que se le superponga
    const lblMark = billboardLabel('x', 10, { size: 0.06, color: '#1a1206', bg: '#ffb347' }); lblMark.position.y = 34; lblMark.visible = false; marker.add(lblMark);
    let lastMarkTxt = '';
    const moveMarker = () => { marker.position.set(state.x, terrainH(state.x, ZS_NEAR), ZS_NEAR); marker.scale.setScalar(vz().mark); };
    const placeMarker = () => {
      moveMarker();
      const txt = `x = ${Math.round(state.x)} m`;
      if (txt !== lastMarkTxt) { lastMarkTxt = txt; kit.setLabelText(lblMark, txt, { size: 0.06, color: '#1a1206', bg: '#ffb347', weight: 700 }); lblMark.userData.texto = txt; }
      fitLabel(lblMark, 5);
    };
    const flag = new THREE.Group(); valle.add(flag);
    {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 26, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd })); p.position.y = 13; flag.add(p);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshStandardMaterial({ color: 0x3ddc84, emissive: 0x1a8a50, emissiveIntensity: 0.6, side: THREE.DoubleSide })); f.position.set(4.5, 23, 0); flag.add(f);
      flag.visible = false;
    }
    // zona para arrastrar el poste a lo largo de la orilla de la planta
    const setX = (x) => { state.x = Math.min(RIO.D, Math.max(0, Math.round(x))); state.dirty = true; };
    const strip = new THREE.Mesh(new THREE.BoxGeometry(RIO.D + 40, 2, 20), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    strip.position.set(RIO.D / 2, 1, ZS_NEAR); valle.add(strip);
    const invV = new THREE.Matrix4(), ray = new THREE.Ray(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1), pt = new THREE.Vector3();
    const xFromPointer = (p, hit) => {
      valle.updateWorldMatrix(true, false);
      if (hit) return valle.worldToLocal(hit.point.clone()).x;
      invV.copy(valle.matrixWorld).invert(); ray.copy(p.ray).applyMatrix4(invV);
      return ray.intersectPlane(plane, pt) ? pt.x : null;
    };
    input.add(strip, { cursor: 'ew-resize', onDown(hit, p) { const x = xFromPointer(p, hit); if (x != null) setX(x); }, onMove(hit, p) { const x = xFromPointer(p, hit); if (x != null) setX(x); } }, est.habilitado);

    // ---------------------------------------------------------------- panel y gráfico
    const unitsM = (n) => `${formatoNum(n, 0)} m`;
    const CW = 950, CH = 950;
    const ctrl = kit.createPanel({
      width: 1.25, height: 1.25, ppm: 760, title: 'FUNCIÓN OBJETIVO',
      draw(ctx, W, H) {
        const x = state.x, y = RIO.y(x), T = kit.THEME, font = kit.font;
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        ctx.fillStyle = T.text; ctx.font = font(H * 0.056, 700); ctx.fillText('C(x, y) = 90x + 150y', W * 0.04, H * 0.172);
        ctx.font = font(H * 0.04, 600); ctx.fillText('y = √((500 − x)² + 100²),   0 ≤ x ≤ 500', W * 0.04, H * 0.227);
        ctx.fillStyle = T.dim; ctx.font = font(H * 0.03, 400);
        kit.wrapText(ctx, 'x son los metros de cable por la orilla e y los metros sobre el agua, por el teorema de Pitágoras. El intervalo es cerrado e incluye los extremos x = 0 y x = 500.', W * 0.04, H * 0.272, W * 0.9, H * 0.035);
        const cards = [['x (orilla)', unitsM(x), T.accent], ['y (agua)', unitsM(y), T.accent2], ['longitud x + y', unitsM(RIO.longitud(x)), '#c9a7ff'], ['costo C(x, y)', formatoPesos(RIO.costo(x)), T.good]];
        cards.forEach(([lab, val, col], i) => {
          const cx = W * (0.04 + i * 0.235), cw = W * 0.215, cy = H * 0.375, chh = H * 0.13;
          ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(cx, cy, cw, chh);
          ctx.fillStyle = col; ctx.fillRect(cx, cy, 6, chh);
          ctx.fillStyle = T.dim; ctx.font = font(H * 0.026, 600); ctx.fillText(lab, cx + 14, cy + chh * 0.32);
          ctx.fillStyle = T.text; ctx.font = font(H * 0.043, 700); ctx.fillText(val, cx + 14, cy + chh * 0.8);
        });
        ctx.fillStyle = T.dim; ctx.font = font(H * 0.03, 500);
        ctx.fillText(`90x = ${formatoPesos(RIO.a * x)}`, W * 0.04, H * 0.548);
        ctx.fillText(`150y = ${formatoPesos(RIO.b * y)}`, W * 0.52, H * 0.548);
        ctx.fillStyle = state.reveal ? T.good : T.dim; ctx.font = font(H * 0.028, state.reveal ? 700 : 400);
        const cand = RIO.candidatos(), o = cand[1];
        kit.wrapText(ctx, state.reveal
          ? `Candidatos: C(0) = ${formatoPesos(cand[0].costo)}, C(${formatoNum(o.x, 0)}) = ${formatoPesos(o.costo)}, C(500) = ${formatoPesos(cand[2].costo)}. El mínimo está en x = ${formatoNum(o.x, 0)} m, y = ${formatoNum(o.y, 0)} m. Se pide la longitud: x + y = ${formatoNum(o.longitud, 0)} m.`
          : 'Mueve el poste y observa qué cambia. El problema pide una sola magnitud: la longitud del tendido.', W * 0.04, H * 0.9, W * 0.9, H * 0.033);
      },
      widgets: [
        { type: 'slider', id: 'x', x: 0.04 * CW, y: 0.575 * CH, w: 0.92 * CW, h: 0.05 * CH, min: 0, max: RIO.D, step: 1, get: () => state.x, set: (v) => setX(v) },
        { type: 'button', id: 'x0', x: 0.04 * CW, y: 0.66 * CH, w: 0.29 * CW, h: 0.08 * CH, fontScale: 0.36, label: 'Extremo x = 0', onClick: () => setX(0) },
        { type: 'button', id: 'x1', x: 0.355 * CW, y: 0.66 * CH, w: 0.29 * CW, h: 0.08 * CH, fontScale: 0.36, label: 'Extremo x = 500', onClick: () => setX(500) },
        { type: 'button', id: 'opt', x: 0.67 * CW, y: 0.66 * CH, w: 0.29 * CW, h: 0.08 * CH, fontScale: 0.36, label: 'Ir al óptimo', onClick: () => goOptimum() },
        { type: 'toggle', id: 'rev', x: 0.04 * CW, y: 0.765 * CH, w: 0.46 * CW, h: 0.08 * CH, fontScale: 0.38, label: 'Revelar solución', get: () => state.reveal, set: (v) => { state.reveal = v; applyReveal(); } },
        { type: 'button', id: 'mode', x: 0.52 * CW, y: 0.765 * CH, w: 0.44 * CW, h: 0.08 * CH, fontScale: 0.38, label: () => (state.mode === 'maqueta' ? 'Ir a escala real' : 'Volver a la maqueta'), onClick: () => applyMode(state.mode === 'maqueta' ? 'real' : 'maqueta') },
      ],
    });
    ctrl.mesh.position.set(-1.45, 1.3, -0.6); ctrl.mesh.rotation.set(-0.12, 0.77, 0);
    g.add(ctrl.mesh); ctrl.register(input, est.habilitado);
    const plot = kit.createPlot({
      f: (x) => RIO.costo(x) / 1000, x0: 0, x1: RIO.D, y0: 55, y1: 80, width: 1.35, height: 0.8,
      xTicks: [0, 100, 200, 300, 400, 500], yTicks: [55, 60, 65, 70, 75, 80], xLabel: 'x (m)', yLabel: 'costo C (miles de $)', labelSize: 0.042,
      tickFmt: (v) => String(v), curveColor: 0xffb347,
    });
    plot.group.position.set(-0.55, 1.22, -1.45); g.add(plot.group);
    { const e = RIO.extremos(); plot.addPoint('e0', 0, e.x0 / 1000, { color: 0xffffff, radiusP: 0.016, guides: false }); plot.addPoint('e1', RIO.D, e.xD / 1000, { color: 0xffffff, radiusP: 0.016, guides: false }); }
    function applyReveal() {
      const o = RIO.optimo();
      plot.removePoint('min');
      if (state.reveal) plot.addPoint('min', o.x, o.costo / 1000, { color: 0x6fe3a2, labelX: `x* = ${formatoNum(o.x, 0)} m`, labelY: `${formatoNum(o.costo / 1000, 0)}` });
      flag.visible = state.reveal; flag.position.set(o.x, terrainH(o.x, ZS_NEAR + 6), ZS_NEAR + 6); flag.scale.setScalar(vz().mark);
      ctrl.invalidate(); state.dirty = true;
    }
    const plotProxy = new THREE.Mesh(new THREE.PlaneGeometry(plot.width + 0.1, plot.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    plotProxy.position.set(plot.width / 2, plot.height / 2, 0.01); plot.group.add(plotProxy);
    kit.arrastre(plotProxy, plot.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => setX(plot.xFromLocal(p.x)) });

    // ---------------------------------------------------------------- puesto de la maqueta: explanada, mesa, zócalo, toldo y utilería
    // Todo lo estático se une por material (madera, piezas pintadas, metal y calcomanías): unas 10 llamadas de dibujo.
    const mesa = new THREE.Group(); g.add(mesa);
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z), EJE_Y = V3(0, 1, 0);
    const matriz = (x, y, z, { rx = 0, ry = 0, rz = 0 } = {}) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V3(1, 1, 1));
    // caja con UV en metros: la veta no se estira en piezas largas y delgadas
    const cajaUV = (w, h, d) => {
      const geo = new THREE.BoxGeometry(w, h, d), p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, p.getZ(i), p.getY(i));
        else if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getX(i), p.getZ(i));
        else uv.setXY(i, p.getX(i), p.getY(i));
      }
      return geo;
    };
    // listón o tubo entre dos puntos
    const entre = (geo, a, b) => {
      const A = V3(...a), B = V3(...b);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(EJE_Y, B.clone().sub(A).normalize()));
      const c = A.add(B).multiplyScalar(0.5);
      return geo.translate(c.x, c.y, c.z);
    };
    const liston = (a, b, w, d = w) => entre(cajaUV(w, V3(...a).distanceTo(V3(...b)), d), a, b);
    const tubo = (a, b, r, seg = 8) => entre(new THREE.CylinderGeometry(r, r, V3(...a).distanceTo(V3(...b)), seg, 1), a, b);
    // placa de cantos redondeados y biselados, apoyada en y = 0
    const losa = (w, d, h, r, b) => {
      const s = new THREE.Shape(), x0 = -w / 2 + b, y0 = -d / 2 + b, x1 = w / 2 - b, y1 = d / 2 - b;
      s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
      s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
      const geo = new THREE.ExtrudeGeometry(s, { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
      geo.rotateX(-Math.PI / 2);
      return geo.translate(0, b, 0);
    };
    // color por triángulo (número o función del centro del triángulo, en coordenadas de la pieza), sin UV y sin índice
    const pintar = (geo, color) => {
      const gg = geo.index ? geo.toNonIndexed() : geo;
      gg.deleteAttribute('uv');
      const p = gg.attributes.position, n = p.count, a = new Float32Array(n * 3), c = new THREE.Color();
      for (let t = 0; t + 2 < n; t += 3) {
        c.set(typeof color === 'function' ? color((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3) : color);
        for (let k = t; k < t + 3; k++) c.toArray(a, k * 3);
      }
      gg.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return gg;
    };
    const piezas = { madera: [], vc: [], alu: [], atlas: [] };
    const pieza = (lista, geo, m = null, color = null) => {
      const gg = color != null ? pintar(geo, color) : geo.index ? geo.toNonIndexed() : geo;
      if (m) gg.applyMatrix4(m);
      piezas[lista].push(gg);
      return gg;
    };
    const matMadera = kit.mat('wood', { repeat: [0.7, 0.7], roughness: 0.8, normalScale: 0.35 });
    // terciado de pino claro: la textura fotográfica es gris y el tinte de kit.mat no llega a un tono tan claro
    if (fotosActivas) matMadera.color.setRGB(2.0, 1.36, 0.72); else matMadera.color.set(0xf0d9b8);
    const matVC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 });
    const matAlu = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.65 });

    // explanada de gravilla con borde irregular (reemplaza la losa de hormigón)
    {
      const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
      const gc = c.getContext('2d'), img = gc.createImageData(N, N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const u = (i / (N - 1)) * 2 - 1, v = (j / (N - 1)) * 2 - 1;
        const d = Math.pow(Math.abs(u) ** 5 + Math.abs(v) ** 5, 0.2) + noise.noise(u * 3.3, v * 3.3, 7.7) * 0.13 + noise.noise(u * 11, v * 11, 1.3) * 0.05;
        const k = (j * N + i) * 4, a = d < 0.9 ? 255 : 0;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = a; img.data[k + 3] = 255;
      }
      gc.putImageData(img, 0, 0);
      const matGrava = kit.mat('gravel', { repeat: [3, 3], color: 0xb9b0a2, roughness: 1 });
      Object.assign(matGrava, { alphaMap: new THREE.CanvasTexture(c), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      kit.malla(new THREE.PlaneGeometry(6.0, 5.4).rotateX(-Math.PI / 2), matGrava, { x: 0.35, y: 0.004, z: -0.75, sombra: false, padre: mesa });
    }

    // mesa de obra: tablero de terciado de 25 mm sobre dos caballetes de pino con bisagras de acero
    const TOP = 0.84;                                           // cara superior del tablero
    pieza('madera', losa(1.95, 1.15, 0.025, 0.03, 0.004), matriz(0, TOP - 0.025, TABLE.z));
    for (const xc of [-0.66, 0.66]) {
      pieza('madera', cajaUV(0.05, 0.07, 1.02), matriz(xc, TOP - 0.06, TABLE.z));
      for (const sz of [-1, 1]) {
        const ze = TABLE.z + sz * 0.42;
        for (const sx of [-1, 1]) pieza('madera', liston([xc + sx * 0.022, TOP - 0.06, ze], [xc + sx * 0.21, 0, ze + sz * 0.06], 0.044, 0.032));
        pieza('madera', cajaUV(0.3, 0.085, 0.018), matriz(xc, 0.3, ze + sz * 0.062));
        pieza('alu', cajaUV(0.075, 0.055, 0.1), matriz(xc, TOP - 0.06, ze), 0x2a2c2f);
      }
    }

    // zócalo de MDF pintado bajo la maqueta: tapa el pie del faldón y lleva la placa, la escala gráfica y el norte
    const MW = ((TX1 - TX0) / 2) * S_MAQ, MD = ((TZ1 - TZ0) / 2) * S_MAQ, BORDE = 0.05;
    const ALTO_Z = TABLE.y - 7 * S_MAQ + 0.0011 - TOP;
    const ZF = TABLE.z + MD + BORDE;                            // cara delantera del zócalo
    kit.malla(losa(2 * (MW + BORDE), 2 * (MD + BORDE), ALTO_Z, 0.012, 0.003), new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.5, metalness: 0.05 }), { y: TOP, z: TABLE.z, padre: mesa });
    // calcomanías en un solo lienzo: placa, escala gráfica, norte y el rótulo de riesgo eléctrico de la bobina
    const AW = 1024, AH = 512, R_PLACA = [0, 0, 1024, 80], R_ESCALA = [0, 96, 640, 96], R_NORTE = [656, 96, 96, 96], R_PELIGRO = [768, 96, 256, 224];
    const lienzoAtlas = document.createElement('canvas'); lienzoAtlas.width = AW; lienzoAtlas.height = AH;
    {
      const c = lienzoAtlas.getContext('2d'), F = kit.font;
      let [x0, y0, w, h] = R_PLACA;                              // placa de aluminio cepillado
      const gr = c.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#d7dade'); gr.addColorStop(0.5, '#bcc0c5'); gr.addColorStop(1, '#a4a9af');
      c.fillStyle = gr; c.fillRect(x0, y0, w, h);
      const rp = kit.mulberry32(9);
      for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,255,${rp() * 0.14})`; c.fillRect(x0, y0 + rp() * h, w, 1); }
      c.strokeStyle = '#6f757c'; c.lineWidth = 3; c.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
      for (const px of [x0 + 18, x0 + w - 18]) { c.fillStyle = '#767c83'; c.beginPath(); c.arc(px, y0 + h / 2, 6, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#1f2328'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = F(30, 700); c.fillText('MAQUETA TOPOGRÁFICA · CRUCE DEL RÍO', x0 + w / 2, y0 + h * 0.36);
      c.font = F(19, 500); c.fillText(`Planta eléctrica – Fábrica · escala 1:${Math.round(1 / S_MAQ)}`, x0 + w / 2, y0 + h * 0.75);
      [x0, y0, w, h] = R_ESCALA;                                 // escala gráfica: 100 m son 18 cm
      c.fillStyle = '#2c2f34'; c.fillRect(x0, y0, w, h);
      const px100 = ((100 * S_MAQ) / 0.2) * w, bx = x0 + 32, by = y0 + 52, bh = 14;
      for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? '#2c2f34' : '#f2f2ee'; c.fillRect(bx + (k * px100) / 5, by, px100 / 5, bh); }
      c.strokeStyle = '#f2f2ee'; c.lineWidth = 2; c.strokeRect(bx, by, px100, bh);
      c.fillStyle = '#f2f2ee'; c.font = F(20, 600); c.textBaseline = 'alphabetic';
      c.fillText('0', bx, by - 8); c.fillText('50', bx + px100 / 2, by - 8); c.fillText('100 m', bx + px100 - 6, by - 8);
      c.font = F(15, 500); c.textAlign = 'left'; c.fillText('ESCALA GRÁFICA', bx, by + bh + 20);
      [x0, y0, w, h] = R_NORTE;                                  // norte hacia el fondo de la maqueta
      c.fillStyle = '#2c2f34'; c.fillRect(x0, y0, w, h);
      const ncx = x0 + w / 2, ncy = y0 + h / 2 + 8;
      c.strokeStyle = '#f2f2ee'; c.lineWidth = 2; c.beginPath(); c.arc(ncx, ncy, 30, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#f2f2ee'; c.beginPath(); c.moveTo(ncx, ncy - 28); c.lineTo(ncx + 11, ncy + 18); c.lineTo(ncx, ncy + 9); c.lineTo(ncx - 11, ncy + 18); c.closePath(); c.fill();
      c.font = F(18, 700); c.textAlign = 'center'; c.fillText('N', ncx, y0 + 18);
      [x0, y0, w, h] = R_PELIGRO;                                // señal de riesgo eléctrico (triángulo amarillo)
      c.fillStyle = '#f4f2ec'; c.fillRect(x0, y0, w, h);
      const tx = x0 + w / 2, ty = y0 + 14, ts = 130;
      c.fillStyle = '#121212'; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + ts * 0.62, ty + ts); c.lineTo(tx - ts * 0.62, ty + ts); c.closePath(); c.fill();
      c.fillStyle = '#f7c600'; c.beginPath(); c.moveTo(tx, ty + 17); c.lineTo(tx + ts * 0.62 - 15, ty + ts - 8); c.lineTo(tx - ts * 0.62 + 15, ty + ts - 8); c.closePath(); c.fill();
      c.fillStyle = '#121212'; c.beginPath(); c.moveTo(tx + 7, ty + 40); c.lineTo(tx - 14, ty + 84); c.lineTo(tx - 1, ty + 82); c.lineTo(tx - 9, ty + 114); c.lineTo(tx + 15, ty + 68); c.lineTo(tx + 2, ty + 70); c.closePath(); c.fill();
      c.font = F(27, 800); c.textAlign = 'center'; c.fillText('RIESGO', tx, y0 + 180); c.fillText('ELÉCTRICO', tx, y0 + 210);
    }
    const texAtlas = new THREE.CanvasTexture(lienzoAtlas); texAtlas.colorSpace = THREE.SRGBColorSpace; texAtlas.anisotropy = 8;
    const matAtlas = new THREE.MeshStandardMaterial({ map: texAtlas, roughness: 0.5, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const enRegion = (geo, [x0, y0, w, h]) => {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * w) / AW, 1 - (y0 + (1 - uv.getY(i)) * h) / AH);
      return geo;
    };
    pieza('atlas', enRegion(new THREE.PlaneGeometry(0.44, 0.034), R_PLACA), matriz(0, TOP + ALTO_Z * 0.5, ZF + 0.0008));
    pieza('atlas', enRegion(new THREE.PlaneGeometry(0.2, 0.03), R_ESCALA), matriz(0.56, TOP + ALTO_Z + 0.0006, ZF - BORDE / 2, { rx: -Math.PI / 2 }));
    pieza('atlas', enRegion(new THREE.PlaneGeometry(0.036, 0.036), R_NORTE), matriz(-0.74, TOP + ALTO_Z + 0.0006, ZF - BORDE / 2, { rx: -Math.PI / 2 }));

    // sobre la mesa: planos enrollados, escalímetro y termo
    for (const [x, r, z, L, col] of [[-0.52, 0.034, ZF + 0.085, 0.58, 0xe8ecef], [-0.5, 0.024, ZF + 0.028, 0.5, 0xdcd4c0]]) {
      pieza('vc', new THREE.CylinderGeometry(r, r, L, 16).rotateZ(Math.PI / 2), matriz(x, TOP + r, z), col);
      for (const dx of [-0.36, 0.36]) pieza('vc', new THREE.TorusGeometry(r + 0.0015, 0.0025, 4, 16).rotateY(Math.PI / 2), matriz(x + dx * L, TOP + r, z), 0xb3332b);
    }
    {
      const tri = new THREE.Shape([new THREE.Vector2(-0.017, 0), new THREE.Vector2(0.017, 0), new THREE.Vector2(0, 0.028)]);
      pieza('vc', new THREE.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: false }).translate(0, 0, -0.15).rotateY(Math.PI / 2), matriz(0.45, TOP, ZF + 0.08, { ry: 0.07 }), 0xe3e0d4);
      const perfil = [[0.001, 0], [0.04, 0], [0.044, 0.006], [0.045, 0.2], [0.042, 0.212], [0.034, 0.23], [0.037, 0.234], [0.037, 0.29], [0.03, 0.298], [0.001, 0.3]];
      pieza('vc', new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), 18), matriz(MW + BORDE + 0.065, TOP, TABLE.z + 0.25),
        (x, y) => (y > 0.231 ? 0x1d1f21 : y > 0.203 ? 0xb9bdc1 : 0x2f6a46));
    }

    // toldo plegable de 3,2 m: patas telescópicas de aluminio, tijeras en los cuatro lados, varillas al centro, lona
    // blanca con faldón azul y sacos de arena en las patas
    const T = { cx: 0, cz: -0.2, a: 1.6, alero: 2.25, cumbre: 2.85 };
    const esquinas = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [T.cx + sx * T.a, T.cz + sz * T.a]);
    for (const [x, z] of esquinas) {
      pieza('alu', cajaUV(0.045, 1.25, 0.045), matriz(x, 0.631, z), 0xb7bcc2);
      pieza('alu', cajaUV(0.036, 1.01, 0.036), matriz(x, 1.705, z), 0xc8ccd1);
      pieza('alu', cajaUV(0.06, 0.05, 0.06), matriz(x, 1.24, z), 0x2b2d30);
      pieza('alu', cajaUV(0.058, 0.07, 0.058), matriz(x, 1.98, z), 0x2b2d30);
      pieza('alu', cajaUV(0.07, 0.07, 0.07), matriz(x, T.alero - 0.035, z), 0x2b2d30);
      pieza('alu', cajaUV(0.13, 0.006, 0.13), matriz(x, 0.003, z), 0x8d9297);
    }
    for (let k = 0; k < 4; k++) {
      const [xa, za] = esquinas[k], [xb, zb] = esquinas[(k + 1) % 4], yA = T.alero - 0.03, yB = 1.99, n = 3;
      for (let i = 0; i < n; i++) {
        const x0 = xa + ((xb - xa) * i) / n, z0 = za + ((zb - za) * i) / n, x1 = xa + ((xb - xa) * (i + 1)) / n, z1 = za + ((zb - za) * (i + 1)) / n;
        pieza('alu', liston([x0, yA, z0], [x1, yB, z1], 0.02, 0.012), null, 0xc3c7cc);
        pieza('alu', liston([x0, yB, z0], [x1, yA, z1], 0.02, 0.012), null, 0xc3c7cc);
      }
      pieza('alu', tubo([xa, T.alero - 0.02, za], [T.cx, T.cumbre - 0.07, T.cz], 0.012, 6), null, 0xc3c7cc);
    }
    pieza('alu', new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), matriz(T.cx, T.cumbre - 0.09, T.cz), 0x2b2d30);
    {
      // lona: cuatro faldones de pirámide, cada uno con una comba suave entre las varillas
      const NS = 12, NM = 10, A = T.a + 0.03, pos = [], uv = [], ind = [];
      for (const [dx, dz, ex, ez] of [[0, 1, 1, 0], [1, 0, 0, -1], [0, -1, -1, 0], [-1, 0, 0, 1]]) {
        const base = pos.length / 3;
        for (let j = 0; j <= NM; j++) for (let i = 0; i <= NS; i++) {
          const s = (i / NS) * 2 - 1, m = j / NM, comba = 0.07 * (1 - s * s) * 4 * m * (1 - m);
          pos.push(T.cx + m * A * (dx + ex * s), T.alero + 0.01 + (T.cumbre - T.alero) * (1 - m) - comba, T.cz + m * A * (dz + ez * s));
          uv.push((s + 1) / 2, m);
        }
        for (let j = 0; j < NM; j++) for (let i = 0; i < NS; i++) { const a = base + j * (NS + 1) + i, b = a + NS + 1; ind.push(a, b, a + 1, b, b + 1, a + 1); }
      }
      const lona = new THREE.BufferGeometry();
      lona.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lona.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      lona.setIndex(ind); lona.computeVertexNormals();
      kit.malla(lona, new THREE.MeshStandardMaterial({ color: 0xecebe6, roughness: 0.88 }), { sombra: false, padre: mesa });
      // por debajo la lona deja pasar la luz del sol: se ve clara, no negra
      kit.malla(lona, new THREE.MeshStandardMaterial({ color: 0xe4e1da, emissive: 0x6d6a64, roughness: 0.95, side: THREE.BackSide }), { sombra: false, recibe: false, padre: mesa });
      const c = document.createElement('canvas'); c.width = 256; c.height = 32;
      const gc = c.getContext('2d'), r = kit.mulberry32(4);
      gc.fillStyle = '#1f3a5f'; gc.fillRect(0, 0, 256, 32);
      for (let i = 0; i < 400; i++) { gc.fillStyle = `rgba(255,255,255,${r() * 0.05})`; gc.fillRect(r() * 256, r() * 32, 2, 1); }
      gc.fillStyle = '#14273f'; gc.fillRect(0, 0, 256, 2);
      gc.fillStyle = '#f1efe8'; gc.fillRect(0, 26, 256, 3);         // ribete blanco
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
      const faldones = [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([dx, dz]) => new THREE.PlaneGeometry(2 * A, 0.23).rotateY(Math.atan2(dx, dz)).translate(T.cx + dx * A, T.alero + 0.01 - 0.115, T.cz + dz * A));
      kit.malla(kit.mergeGeometries(faldones), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }), { sombra: false, padre: mesa });
      // sacos de arena de polipropileno junto a cada pata
      const saco = new THREE.SphereGeometry(1, 12, 8), p = saco.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.55) p.setY(i, -0.55 + (p.getY(i) + 0.55) * 0.15);
      saco.scale(0.24, 0.08, 0.15); saco.computeVertexNormals();
      esquinas.forEach(([x, z], k) => {
        const ang = Math.atan2(x - T.cx, z - T.cz);
        pieza('vc', saco.clone(), matriz(x + Math.sin(ang) * 0.17, 0.049, z + Math.cos(ang) * 0.17, { ry: ang + Math.PI / 2 + (k - 1.5) * 0.2 }), 0xd6d0bf);
      });
    }

    // conos de 70 cm con dos franjas reflectantes, en el borde de la explanada
    {
      const rC = (y) => 0.128 - (0.102 * (y - 0.052)) / (0.69 - 0.052);
      const pts = [[0.142, 0.03], [0.142, 0.052], ...[0.052, 0.2, 0.3, 0.38, 0.46, 0.6, 0.69].map((y) => [rC(y), y]), [0.018, 0.703], [0.001, 0.706]];
      const cono = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 20);
      const franja = (x, y) => ((y > 0.3 && y < 0.38) || (y > 0.46 && y < 0.6) ? 0xeef0f0 : 0xf05a1c);
      for (const [x, z, ry] of [[-2.4, -2.2, 0.3], [-2.45, -2.95, 1.1], [-2.35, -3.7, 0.6]]) {
        pieza('vc', cono.clone(), matriz(x, 0, z, { ry }), franja);
        pieza('vc', cajaUV(0.36, 0.03, 0.36), matriz(x, 0.015, z, { ry }), 0x1c1d1f);
      }
    }

    // bobina del cable: discos de madera, cable negro enrollado, eje, cuñas y la punta del cable en el suelo
    {
      const mB = matriz(2.25, 0, -2.6, { ry: 0.3 }), en = (x, y, z, o) => mB.clone().multiply(matriz(x, y, z, o));
      for (const sx of [-1, 1]) {
        pieza('madera', new THREE.CylinderGeometry(0.5, 0.5, 0.045, 36).rotateZ(Math.PI / 2), en(sx * 0.335, 0.5, 0));
        pieza('alu', new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16).rotateZ(Math.PI / 2), en(sx * 0.364, 0.5, 0), 0x3a3e44);
      }
      const vueltas = 14, perfil = [];
      for (let i = 0; i <= vueltas * 3; i++) perfil.push(new THREE.Vector2(0.36 + 0.016 * Math.sin((Math.PI * (i % 3)) / 3), -0.312 + (0.624 * i) / (vueltas * 3)));
      pieza('vc', new THREE.LatheGeometry(perfil, 28).rotateZ(Math.PI / 2), en(0, 0.5, 0), 0x1c1e21);
      pieza('alu', tubo([-0.43, 0, 0], [0.43, 0, 0], 0.03, 10), en(0, 0.5, 0), 0x5b6067);
      const cuna = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.13, 0), new THREE.Vector2(0, 0.06)]), { depth: 0.09, bevelEnabled: false }).translate(0, 0, -0.045);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) pieza('madera', cuna.clone(), en(sx * 0.335, 0, sz * 0.22, { ry: -sz * Math.PI / 2 }));
      const punta = new THREE.CatmullRomCurve3([[0.12, 0.19, 0.2], [0.1, 0.06, 0.42], [0.02, 0.016, 0.64], [-0.22, 0.016, 0.84], [-0.5, 0.016, 0.76], [-0.6, 0.016, 0.54], [-0.45, 0.016, 0.43], [-0.2, 0.016, 0.55]].map((q) => V3(...q)));
      pieza('vc', new THREE.TubeGeometry(punta, 64, 0.016, 6, false), en(0, 0, 0), 0x1c1e21);
      pieza('atlas', enRegion(new THREE.PlaneGeometry(0.2, 0.175), R_PELIGRO), en(-0.359, 0.71, 0, { ry: -Math.PI / 2 }));
    }
    for (const [lista, mat, sombra] of [['madera', matMadera, true], ['vc', matVC, true], ['alu', matAlu, true], ['atlas', matAtlas, false]]) {
      const geo = kit.mergeGeometries(piezas[lista]);
      for (const gg of piezas[lista]) gg.dispose();
      if (geo) kit.malla(geo, mat, { sombra, padre: mesa });
    }

    // ---------------------------------------------------------------- personas
    // Al otro lado de la mesa, de frente a quien llega: la ingeniera revisa el presupuesto en su tableta y mira el poste
    // de vez en cuando; el capataz, con los planos en la mano izquierda, señala la orilla de la planta (donde parte el cable).
    const ing = kit.persona({ preset: 'ingeniera', semilla: 31, padre: g, x: 0.8, z: TABLE.z - 1.03, ry: -0.36 });
    const cap = kit.persona({ preset: 'capataz', semilla: 32, padre: g, x: -0.74, z: TABLE.z - 1.07, ry: 0.3 });
    ing.posar('tableta').transicion(0.01);
    const texTab = (() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 176;
      const x = c.getContext('2d'), F = kit.font;
      x.fillStyle = '#121519'; x.fillRect(0, 0, 256, 176);
      x.fillStyle = '#eef1f4'; x.fillRect(8, 8, 240, 160);
      x.fillStyle = '#1f3d63'; x.fillRect(8, 8, 240, 24);
      x.fillStyle = '#fff'; x.font = F(13, 700); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('Tendido · Planta → Fábrica', 16, 20);
      x.fillStyle = '#9cc7a0'; x.fillRect(16, 40, 120, 116);
      x.fillStyle = '#3d86b8'; x.fillRect(16, 82, 120, 30);
      x.fillStyle = '#6b6f75'; x.fillRect(22, 116, 16, 12); x.fillRect(114, 66, 16, 12);
      x.fillStyle = '#26323e'; x.font = F(12, 700); x.fillText('Costos', 146, 50);
      x.font = F(11, 500); x.fillStyle = '#4b5966';
      x.fillText('Orilla: $90 / m', 146, 72); x.fillText('Agua: $150 / m', 146, 92); x.fillText('Ancho: 100 m', 146, 112); x.fillText('Río arriba: 500 m', 146, 132);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const tableta = new THREE.Group(); g.add(tableta);
    kit.caja(0.25, 0.175, 0.012, new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.55 }), { padre: tableta, sombra: false });
    kit.malla(new THREE.PlaneGeometry(0.226, 0.155), new THREE.MeshStandardMaterial({ map: texTab, emissive: 0xffffff, emissiveMap: texTab, emissiveIntensity: 0.55, roughness: 0.25 }), { z: 0.0065, padre: tableta, sombra: false });
    ing.sostener(tableta, { D: [0.118, -0.035, 0], I: [-0.118, -0.035, 0], arriba: [0, 0.7, 0.7] });
    const BASE_CAP = {
      ...kit.POSES.reposo(), columna: [0.05, 0, 0], pecho: [0.02, 0, 0], cuello: [0.12, 0, 0],
      brazoI: [-0.06, 0, 0.13], antebrazoI: [-0.62, 0, 0], manoI: [0.12, 0, -0.12], dedosI: 0.92,
    };
    // señala con el índice y vuelve a la pose de reposo, en un ciclo de 10 s
    const CLIP_SENALAR = {
      duracion: 10, bucle: true,
      fn(t) {
        const a = sstep(0.5, 1.3, t) * (1 - sstep(5.8, 6.6, t));
        return {
          ...BASE_CAP, columna: [0.05 + 0.07 * a, 0, 0],
          ikD: { p: [-0.14, 1.18, 0.56], polo: [-1, -0.5, -0.4], w: a },
          dedosD: a > 0.001 ? { c: 0.22 + 0.78 * a, indice: 0.22 - 0.22 * a } : 0.22,
        };
      },
    };
    cap.transicion(0.01).posar(BASE_CAP); cap.actualizar(0.05); cap.transicion(0.5);
    cap.reproducir(CLIP_SENALAR, { bucle: true, desde: 2.5 });
    {
      const rollo = kit.mergeGeometries([
        pintar(new THREE.CylinderGeometry(0.034, 0.034, 0.6, 14).rotateX(Math.PI / 2), 0xeceef1),
        pintar(new THREE.TorusGeometry(0.0355, 0.004, 5, 16).translate(0, 0, 0.19), 0xb3332b),
        pintar(new THREE.TorusGeometry(0.0355, 0.004, 5, 16).translate(0, 0, -0.17), 0xb3332b),
      ]);
      cap.manoI.add(kit.malla(rollo, matVC, { sombra: false }));
    }
    ing.mirar(marker); cap.mirar(marker);
    for (const h of [ing, cap]) h.actualizar(0.01);
    let tMirar = 0;

    // ---------------------------------------------------------------- modos: maqueta y escala real
    const aMundo = (v) => new THREE.Vector3(...v).applyMatrix4(g.matrixWorld);
    const vistaReal = () => {
      const sx = 2, sz = 8, yaw = Math.atan2(-(RIO.D - sx), -(-128 - sz));
      return { pos: [LEJOS[0] + sx, terrainH(sx, sz), LEJOS[2] + sz], yaw };
    };
    let sombra = { centro: new THREE.Vector3(), half: 1.5 };
    // mover = false cambia la escena sin llevar la cámara ni a la persona (al crear la estación o al salir de ella)
    function applyMode(m, { mover = true } = {}) {
      // al ir al valle, la narración explica la escala real (al volver a la maqueta no se repite)
      if (m === 'real' && state.mode !== 'real' && mover) kit.narrar?.('rio_real');
      state.mode = m;
      const maq = m === 'maqueta';
      // la maqueta usa su terreno liviano, el faldón de capas, árboles de espuma y solo las rocas grandes
      terreno.geometry = maq ? tgeoMaq : tgeo;
      faldon.material = maq ? matFaldonMaq : matFaldonReal;
      arbolesMaq.visible = maq; bosque.grupo.visible = !maq; juncos.visible = !maq;
      rocas.count = maq ? 48 : nRocas;
      g.updateWorldMatrix(true, false);
      if (maq) {
        valle.scale.setScalar(S_MAQ);
        valle.position.set(-MAP_C.x * S_MAQ, TABLE.y, TABLE.z - MAP_C.z * S_MAQ);
        Object.assign(app.locomotion, locoObra);
        if (app.scene.fog) app.scene.fog.density = nieblaObra;
        mesa.visible = true;
        est.acomodarVR?.(api.vista.vr);
        if (mover && app.isXR) { const p = aMundo(api.vista.vr.pos); app.teleportRig([p.x, p.y, p.z], est.layout.yaw + api.vista.vr.yaw); }
        else if (mover) { camera.position.copy(aMundo(api.vista.escritorio.camara)); orbit.target.copy(aMundo(api.vista.escritorio.objetivo)); }
        orbit.minDistance = 0.5; orbit.maxDistance = 600; orbit.update();
      } else {
        valle.scale.setScalar(1); valle.position.set(...LEJOS);
        app.locomotion.enabled = true; app.locomotion.speed = 22; app.locomotion.fly = true;
        if (app.scene.fog) app.scene.fog.density = 0.0007;
        mesa.visible = false;
        const v = vistaReal();
        est.acomodarVR?.(v);
        const p = aMundo(v.pos);
        if (mover && app.isXR) app.teleportRig([p.x, p.y, p.z], est.layout.yaw + v.yaw);
        else if (mover) {
          camera.position.copy(aMundo([LEJOS[0] - 40, 26, LEJOS[2] + 86])); orbit.target.copy(aMundo([LEJOS[0] + 240, 4, LEJOS[2] - 70]));
          orbit.minDistance = 5; orbit.maxDistance = 2500; orbit.update();
        }
      }
      lastLbl = ''; lastMarkTxt = ''; buildRoute();
      for (const l of [lblPlant, lblFact]) fitLabel(l, vz().label * 1.1);
      lblPlant.position.y = state.mode === 'real' ? 70 : 100; // en la maqueta, por encima del rótulo de x
      lblD.position.y = state.mode === 'real' ? 15 : 9; // a escala real, sobre el rótulo de x
      for (const l of [lblW, lblD]) fitLabel(l, vz().label * 0.9);
      applyReveal(); state.dirty = true;
    }
    function goOptimum() {
      const o = RIO.optimo();
      setX(o.x);
      if (state.mode === 'real') {
        const z = ZS_NEAR + 14;
        if (app.isXR) { const p = aMundo([LEJOS[0] + o.x, terrainH(o.x, z), LEJOS[2] + z]); app.teleportRig([p.x, p.y, p.z], est.layout.yaw); }
        else { camera.position.copy(aMundo([LEJOS[0] + o.x - 30, 22, LEJOS[2] + z + 60])); orbit.target.copy(aMundo([LEJOS[0] + o.x, 2, LEJOS[2] - 50])); orbit.update(); }
      }
    }

    const camPos = new THREE.Vector3();
    let lastX = null, labelsDirty = true, lastLabelT = 0;
    let pedirReal = new URLSearchParams(location.search).get('modo') === 'real';
    const api = {
      paneles: [ctrl],
      radioSombra: 4,
      alturaCartel: 3.4,
      // la maqueta está muy cerca de quien mira: en VR el panel y el gráfico van más abiertos
      laminaVR: { angulo: 62 },
      vistaVR: () => (state.mode === 'real' ? vistaReal() : api.vista.vr),
      narracion: () => (state.mode === 'real' ? 'rio_real' : 'rio'),
      vista: {
        escritorio: { camara: [0.05, 1.95, 1.45], objetivo: [-0.05, 0.92, -0.62] },
        vr: { pos: [0, 0, 0.95], yaw: 0 },
      },
      dom: [
        { tipo: 'rango', etiqueta: 'x', min: 0, max: RIO.D, paso: 1, get: () => state.x, set: (v) => setX(v), formato: (v) => `${Math.round(v)} m` },
        { tipo: 'boton', etiqueta: 'Ir al óptimo', accion: () => goOptimum() },
        { tipo: 'interruptor', etiqueta: 'Revelar solución', get: () => state.reveal, set: (v) => { state.reveal = v; applyReveal(); } },
        { tipo: 'boton', etiqueta: () => (state.mode === 'maqueta' ? 'Ir a escala real' : 'Volver a la maqueta'), accion: () => applyMode(state.mode === 'maqueta' ? 'real' : 'maqueta') },
      ],
      // sombras alrededor de la maqueta o de quien recorre el valle
      sombra() {
        if (state.mode === 'maqueta') { sombra.centro.copy(aMundo([0, TABLE.y, -0.4])); sombra.half = 2.4; } // la mesa, el toldo y la bobina
        else { camera.getWorldPosition(sombra.centro); sombra.half = 170; }
        return sombra;
      },
      alSalir() { if (state.mode !== 'maqueta') applyMode('maqueta', { mover: false }); },
      actualizar(dt, activa) {
        // ?estacion=rio&modo=real abre directamente el valle a escala real
        if (activa && pedirReal) { pedirReal = false; applyMode('real'); }
        agua.update(dt);
        camera.getWorldPosition(camPos);
        if (state.mode === 'real') bosque.actualizar(dt, camPos, app.isXR);   // en la maqueta el bosque está oculto
        if (state.dirty || lastX !== state.x) {
          lastX = state.x; state.dirty = false;
          buildRoute(); moveMarker(); labelsDirty = true;
          plot.setMarker(state.x, { color: 0xffffff });
          ctrl.invalidate();
        }
        if (labelsDirty && performance.now() - lastLabelT > 110) { labelsDirty = false; lastLabelT = performance.now(); placeMarker(); updateSegmentLabels(); }
        if (activa || state.mode === 'maqueta') {
          tMirar += dt;
          ing.mirar(tMirar % 9 < 3.6 ? tableta : marker);
          ing.actualizar(dt); cap.actualizar(dt);
        }
      },
    };
    applyMode('maqueta', { mover: false });
    return api;
  },
};
