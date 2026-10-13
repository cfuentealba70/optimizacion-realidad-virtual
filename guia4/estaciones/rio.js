// Problema del río y el cable. Una maqueta del valle sobre una mesa, dentro de la obra, y el mismo valle a escala real
// lejos de ella (el botón «Ir a escala real» lleva a la persona hasta allá). La función objetivo es C(x, y) = 90x + 150y,
// con y = √((500 − x)² + 100²) y 0 ≤ x ≤ 500. El poste naranja define x.
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { RIO, formatoPesos, formatoNum } from '../../src/math/problems.js';
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
  etiqueta: 'Evaluación · Optimización',
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
    const tgeo = new THREE.PlaneGeometry(TX1 - TX0, TZ1 - TZ0, SEGX, SEGZ);
    tgeo.rotateX(-Math.PI / 2);
    tgeo.translate((TX0 + TX1) / 2, 0, (TZ0 + TZ1) / 2);
    {
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
    }
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
    // faldón: en la maqueta el terreno se ve como un bloque
    {
      const pos = tgeo.attributes.position, verts = [], ind = [];
      const e1 = [], e2 = [], e3 = [], e4 = [];
      for (let i = 0; i <= SEGX; i++) { e1.push(i); e2.push(SEGZ * (SEGX + 1) + i); }
      for (let j = 0; j <= SEGZ; j++) { e3.push(j * (SEGX + 1)); e4.push(j * (SEGX + 1) + SEGX); }
      for (const e of [e1, e2, e3, e4]) {
        const base = verts.length / 3;
        for (const vi of e) verts.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi), pos.getX(vi), -7, pos.getZ(vi));
        for (let k = 0; k < e.length - 1; k++) { const a = base + 2 * k; ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); sg.setIndex(ind); sg.computeVertexNormals();
      valle.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x4c3f31, roughness: 1, side: THREE.DoubleSide })));
    }
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
      const n = 500, juncos = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), n);
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
      const n = 160, rocas = new THREE.InstancedMesh(geo, kit.mat('concrete', { repeat: [0.6, 0.6], color: 0x8f8a80, roughness: 1, normalScale: 1.2 }), n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
      for (let i = 0; i < n; i++) {
        const near = rng() < 0.5, x = TX0 + 30 + rng() * (TX1 - TX0 - 60), z = near ? -1.5 + rng() * 7 : -100 - (-1.5 + rng() * 7);
        const sc = 0.5 + rng() * rng() * 3.2; p.set(x, terrainH(x, z) + sc * 0.15, z); s.set(sc, sc * (0.7 + rng() * 0.4), sc * (0.8 + rng() * 0.5));
        e.set(rng() * 0.4, rng() * 6.28, rng() * 0.4); q.setFromEuler(e); m.compose(p, q, s); rocas.setMatrixAt(i, m);
      }
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
    const chimney = (x, z, h, r) => {
      const seg = 6, sh = h / seg;
      for (let i = 0; i < seg; i++) { const r0 = r * (1 - (i / seg) * 0.35), r1 = r * (1 - ((i + 1) / seg) * 0.35); cyl(r0, r1, sh, i % 2 ? matWhite : matRed, x, PAD_H + sh * (i + 0.5), z, 20); }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
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
    const VIZ = { maqueta: { cable: 1.15, buoy: 2.0, pole: 2.6, mark: 2.2, label: 6.5 }, real: { cable: 0.32, buoy: 0.9, pole: 1, mark: 1.3, label: 5 } };
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
      lblShore.position.set(x / 2, state.mode === 'real' ? 14 : 20, ZS_NEAR); lblShore.visible = x > 5;
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

    // ---------------------------------------------------------------- mesa de la maqueta, techo de lona y bancas
    const mesa = new THREE.Group(); g.add(mesa);
    {
      const tablero = kit.caja(1.95, 0.06, 1.15, kit.mat('wood', { repeat: [0.55, 0.6], color: 0x8a6e52, roughness: 0.5, normalScale: 0.25 }), { y: TABLE.y - 0.09, z: TABLE.z, padre: mesa });
      void tablero;
      const patas = kit.mat('metal', { color: 0x3a3f45, roughness: 0.45, metalness: 0.8 });
      for (const sx of [-0.9, 0.9]) for (const sz of [-0.5, 0.5]) kit.caja(0.07, TABLE.y - 0.12, 0.07, patas, { x: sx, y: (TABLE.y - 0.12) / 2, z: TABLE.z + sz, padre: mesa });
      kit.caja(2.4, 0.04, 2.6, kit.mat('concrete', { repeat: [2, 2], color: 0xa8a39a }), { y: 0.02, z: TABLE.z + 0.4, padre: mesa, sombra: false });
      // toldo sobre la mesa
      const lona = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9, side: THREE.DoubleSide });
      for (const [x, z] of [[-1.6, -1.8], [1.6, -1.8], [-1.6, 1.4], [1.6, 1.4]]) kit.cilindro(0.04, 0.04, 2.7, patas, { x, y: 1.35, z, padre: mesa });
      const techo = kit.malla(new THREE.PlaneGeometry(3.6, 3.6, 8, 8), lona, { rx: -Math.PI / 2, y: 2.72, z: -0.2, padre: mesa });
      { const p = techo.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.12 * (1 - (p.getX(i) / 1.8) ** 2) * (1 - (p.getY(i) / 1.8) ** 2)); techo.geometry.computeVertexNormals(); }
    }
    // dos personas observando la maqueta
    const ing = kit.persona({ preset: 'ingeniera', semilla: 31, padre: g, x: 1.15, z: TABLE.z - 0.85, ry: -2.3 });
    const cap = kit.persona({ preset: 'capataz', semilla: 32, padre: g, x: -1.25, z: TABLE.z - 0.95, ry: 2.4 });
    ing.posar('tableta'); cap.posar('brazosCruzados');
    ing.mirar(marker); cap.mirar(marker);
    for (const h of [ing, cap]) h.actualizar(0.01);

    // ---------------------------------------------------------------- modos: maqueta y escala real
    const aMundo = (v) => new THREE.Vector3(...v).applyMatrix4(g.matrixWorld);
    const vistaReal = () => {
      const sx = 2, sz = 8, yaw = Math.atan2(-(RIO.D - sx), -(-128 - sz));
      return { pos: [LEJOS[0] + sx, terrainH(sx, sz), LEJOS[2] + sz], yaw };
    };
    let sombra = { centro: new THREE.Vector3(), half: 1.5 };
    // mover = false cambia la escena sin llevar la cámara ni a la persona (al crear la estación o al salir de ella)
    function applyMode(m, { mover = true } = {}) {
      state.mode = m;
      const maq = m === 'maqueta';
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
        if (state.mode === 'maqueta') { sombra.centro.copy(aMundo([0, TABLE.y, TABLE.z])); sombra.half = 1.6; }
        else { camera.getWorldPosition(sombra.centro); sombra.half = 170; }
        return sombra;
      },
      alSalir() { if (state.mode !== 'maqueta') applyMode('maqueta', { mover: false }); },
      actualizar(dt, activa) {
        // ?estacion=rio&modo=real abre directamente el valle a escala real
        if (activa && pedirReal) { pedirReal = false; applyMode('real'); }
        agua.update(dt);
        camera.getWorldPosition(camPos);
        bosque.actualizar(dt, camPos, app.isXR);
        if (state.dirty || lastX !== state.x) {
          lastX = state.x; state.dirty = false;
          buildRoute(); moveMarker(); labelsDirty = true;
          plot.setMarker(state.x, { color: 0xffffff });
          ctrl.invalidate();
        }
        if (labelsDirty && performance.now() - lastLabelT > 110) { labelsDirty = false; lastLabelT = performance.now(); placeMarker(); updateSegmentLabels(); }
        if (activa || state.mode === 'maqueta') { ing.actualizar(dt); cap.actualizar(dt); }
      },
    };
    applyMode('maqueta', { mover: false });
    return api;
  },
};
