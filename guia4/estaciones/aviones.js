// Ejemplo 7. Dos aviones a la misma altura, en trayectorias perpendiculares que convergen en O.
// Mesa de control de tránsito aéreo bajo un toldo, con un mapa en relieve a escala (1 mi ≈ 2,5 mm).
import { AVIONES as M } from '../../src/math/guia4.js';

const MI = 0.0025; // metros de maqueta por milla

// Persona de referencia de 1,75 m con casco y chaleco reflectante. Mira hacia +z.
function persona(kit, padre, { x = 0, z = 0, ry = 0, chaleco = 0xff7a1a } = {}) {
  const { THREE } = kit;
  const p = new THREE.Group();
  p.position.set(x, 0, z); p.rotation.y = ry; padre.add(p);
  const mat = (color, roughness = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const piel = mat(0xc69476, 0.7), pantalon = mat(0x2f3b4d, 0.9), camisa = mat(0x56616c), bota = mat(0x3b2c20, 0.75);
  const vest = mat(chaleco, 0.6, { emissive: chaleco, emissiveIntensity: 0.06 }), banda = mat(0xe4e7ea, 0.25, { metalness: 0.5 });
  const casco = mat(0xf4f3ee, 0.35);
  for (const l of [-1, 1]) {
    kit.malla(new THREE.CapsuleGeometry(0.066, 0.7, 4, 10), pantalon, { x: l * 0.095, y: 0.47, padre: p });
    kit.caja(0.11, 0.08, 0.27, bota, { x: l * 0.095, y: 0.04, z: 0.035, padre: p });
    kit.malla(new THREE.CapsuleGeometry(0.048, 0.5, 4, 8), camisa, { x: l * 0.24, y: 1.19, rz: l * 0.07, padre: p });
    kit.malla(new THREE.SphereGeometry(0.045, 10, 8), piel, { x: l * 0.262, y: 0.88, padre: p });
  }
  const torso = kit.malla(new THREE.CapsuleGeometry(0.17, 0.34, 4, 14), vest, { y: 1.2, padre: p });
  torso.scale.set(1.08, 1, 0.72);
  for (const yb of [1.08, 1.27]) {
    const b = kit.malla(new THREE.CylinderGeometry(0.176, 0.176, 0.035, 18, 1, true), banda, { y: yb, padre: p, sombra: false });
    b.scale.set(1.08, 1, 0.72);
  }
  kit.malla(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), piel, { y: 1.5, padre: p });
  const cabeza = kit.malla(new THREE.SphereGeometry(0.098, 16, 12), piel, { y: 1.6, padre: p });
  cabeza.scale.set(0.92, 1.08, 1);
  kit.malla(new THREE.SphereGeometry(0.115, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), casco, { y: 1.635, padre: p });
  kit.malla(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 20), casco, { y: 1.637, z: 0.012, padre: p });
  return p;
}

// Contorno irregular (para parches de grava) en el plano xz, con uv en metros / 2
function parcheIrregular(THREE, rx, rz, fase = 0) {
  const geo = new THREE.CircleGeometry(1, 80);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    let px = p.getX(i), py = p.getY(i);
    if (i > 0) {
      const a = Math.atan2(py, px), r = 1 + 0.06 * Math.sin(3 * a + fase) + 0.04 * Math.sin(5 * a + 2 * fase) + 0.02 * Math.sin(13 * a + 1);
      px = Math.cos(a) * r; py = Math.sin(a) * r;
    }
    px *= rx; py *= rz;
    p.setXY(i, px, py); uv.setXY(i, px / 1.1, py / 1.1);
  }
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export default {
  id: 'aviones',
  tipo: 'razon',
  etiqueta: 'Ejemplo 7 · Razón de cambio',
  titulo: 'Aviones que convergen',
  resumen: 'Un controlador aéreo detecta que dos aviones que vuelan a la misma altura tienen trayectorias perpendiculares que convergen en un punto O. Uno está a 225 mi de O y vuela a 450 mi/h; el otro está a 300 mi de O y vuela a 600 mi/h. ¿A qué velocidad se reduce la distancia entre ellos?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const reloj = kit.reloj({ t0: -0.1, t1: M.llegada(), instante: M.instante, velocidad: 0.04 });
    const s = { revelar: false, ultimo: -1, tiempo: 0 };
    const conflicto = () => reloj.t >= M.llegada() - 1e-9;
    // rótulos de la escena: se dibujan antes que el panel y el gráfico para que estos los tapen
    const etq = (texto, alto, opts) => {
      const l = kit.etiqueta(texto, alto, opts);
      l.renderOrder = 3; l.material.depthWrite = true; l.material.alphaTest = 0.5; // escriben profundidad: lo lejano no los tapa
      return l;
    };

    // Mesa y mapa. x hacia la derecha, z hacia la persona: el norte del mapa queda al fondo.
    const MESA = 0.9, BASE = 0.905, MW = 1.5, MD = 1.9;
    const OX = -0.42, OZ = 0.52;           // punto de convergencia O sobre el mapa
    const VUELO = BASE + 0.15;             // altura de vuelo de las maquetas
    const posA = (t) => [OX + M.x(t) * MI, VUELO, OZ];
    const posB = (t) => [OX, VUELO, OZ - M.y(t) * MI];

    // ------------------------------------------------------------ suelo: grava y radier bajo el toldo
    const grava = kit.malla(parcheIrregular(THREE, 7.4, 6.6, 0.8), kit.mat('gravel', { repeat: [1, 1], color: 0xcfc6b3, normalScale: 0.6 }), { x: 0.6, y: 0.012, z: -3.2, sombra: false, padre: g });
    grava.material.polygonOffset = true; grava.material.polygonOffsetFactor = -1; grava.material.polygonOffsetUnits = -1;
    kit.caja(4.3, 0.025, 4.2, kit.mat('concrete', { repeat: [2, 2], color: 0xcfcac1, normalScale: 0.5 }), { y: 0.0125, z: 0.4, sombra: false, padre: g });

    // ------------------------------------------------------------ mesa
    const laminado = new THREE.MeshStandardMaterial({ color: 0x353b42, roughness: 0.55, metalness: 0.1 });
    const aceroP = new THREE.MeshStandardMaterial({ color: 0x59616a, roughness: 0.45, metalness: 0.7 });
    kit.caja(1.72, 0.05, 2.12, laminado, { y: MESA - 0.025, padre: g });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.caja(0.06, MESA - 0.05, 0.06, aceroP, { x: sx * 0.8, y: (MESA - 0.05) / 2, z: sz * 1.0, padre: g });
    for (const sx of [-1, 1]) {
      kit.caja(0.04, 0.04, 1.94, aceroP, { x: sx * 0.8, y: 0.16, padre: g });
      kit.caja(0.03, 0.1, 1.94, aceroP, { x: sx * 0.83, y: MESA - 0.1, padre: g });
    }
    kit.caja(1.54, 0.04, 0.04, aceroP, { y: 0.16, padre: g });
    for (const sz of [-1, 1]) kit.caja(1.6, 0.1, 0.03, aceroP, { y: MESA - 0.1, z: sz * 1.03, padre: g });
    const marco = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.55, metalness: 0.05 });
    for (const sz of [-1, 1]) kit.caja(MW + 0.1, 0.05, 0.05, marco, { y: MESA + 0.025, z: sz * (MD / 2 + 0.025), padre: g });
    for (const sx of [-1, 1]) kit.caja(0.05, 0.05, MD, marco, { x: sx * (MW / 2 + 0.025), y: MESA + 0.025, padre: g });

    // ------------------------------------------------------------ relieve del mapa (ruido fractal) y su textura pintada
    const NS = 256, ruido1 = kit.fbm(NS, 3, 5, 77), ruido2 = kit.fbm(NS, 10, 3, 91);
    const muestra = (f, u, v) => {
      const x = u * NS - 0.5, y = v * NS - 0.5, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const at = (a, b) => f[(((b % NS) + NS) % NS) * NS + (((a % NS) + NS) % NS)];
      return (at(xi, yi) * (1 - fx) + at(xi + 1, yi) * fx) * (1 - fy) + (at(xi, yi + 1) * (1 - fx) + at(xi + 1, yi + 1) * fx) * fy;
    };
    const sstep = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
    const AGUA = 0.43, CIMA = 0.7;
    const nivel = (u, v) => muestra(ruido1, u * 0.9 + 0.13, v * 1.14 + 0.27) * 0.82 + muestra(ruido2, u, v * 1.27) * 0.18;
    // u hacia +x, v hacia +z (v = 0 en el borde del fondo)
    const altura = (u, v) => {
      const borde = sstep(0, 0.05, Math.min(u * MW, (1 - u) * MW, v * MD, (1 - v) * MD));
      const e = Math.min(1, Math.max(0, (nivel(u, v) - AGUA) / (CIMA - AGUA)));
      return (0.002 + Math.pow(e, 1.8) * 0.05) * borde;
    };
    const alturaEn = (x, z) => BASE + altura((x + MW / 2) / MW, (z + MD / 2) / MD);
    {
      const geo = new THREE.PlaneGeometry(MW, MD, 76, 96);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, altura((p.getX(i) + MW / 2) / MW, (p.getZ(i) + MD / 2) / MD));
      geo.computeVertexNormals();
      const tex = new THREE.CanvasTexture(pintarMapa());
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const mapa = kit.malla(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2 }), { y: BASE, padre: g, sombra: false });
      void mapa;
    }

    function pintarMapa() {
      const CW = 1024, CH = 1296, c = document.createElement('canvas');
      c.width = CW; c.height = CH;
      const ctx = c.getContext('2d'), img = ctx.createImageData(CW, CH), d = img.data;
      const h = new Float32Array(CW * CH), n = new Float32Array(CW * CH);
      for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
        const u = (i + 0.5) / CW, v = (j + 0.5) / CH, k = j * CW + i;
        n[k] = nivel(u, v); h[k] = altura(u, v);
      }
      const rampa = [[0, [120, 158, 92]], [0.16, [152, 174, 100]], [0.36, [194, 182, 124]], [0.56, [168, 134, 94]], [0.76, [134, 120, 108]], [0.9, [198, 196, 190]], [1, [244, 244, 240]]];
      const colorDe = (e) => {
        for (let r = 1; r < rampa.length; r++) {
          if (e <= rampa[r][0]) {
            const [e0, c0] = rampa[r - 1], [e1, c1] = rampa[r], t = (e - e0) / (e1 - e0);
            return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
          }
        }
        return rampa[rampa.length - 1][1];
      };
      const paso = MW / CW, L = [-0.55, 0.7, -0.45], ll = Math.hypot(...L);
      for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
        const k = j * CW + i, q = k * 4;
        if (n[k] < AGUA) {
          const prof = Math.min(1, (AGUA - n[k]) / 0.08), orilla = n[k] > AGUA - 0.006 ? 0.82 : 1;
          d[q] = (112 - 46 * prof) * orilla; d[q + 1] = (160 - 44 * prof) * orilla; d[q + 2] = (196 - 30 * prof) * orilla; d[q + 3] = 255;
          continue;
        }
        const i0 = Math.max(0, i - 1), i1 = Math.min(CW - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(CH - 1, j + 1);
        const hx = (h[j * CW + i1] - h[j * CW + i0]) / ((i1 - i0) * paso), hz = (h[j1 * CW + i] - h[j0 * CW + i]) / ((j1 - j0) * paso);
        const nx = -hx * 2.4, nz = -hz * 2.4, nl = Math.hypot(nx, 1, nz);
        const luz = Math.max(0, (nx * L[0] + L[1] + nz * L[2]) / (nl * ll));
        const e = Math.min(1, Math.max(0, (n[k] - AGUA) / (CIMA - AGUA)));
        const col = colorDe(e), f = 0.42 + 0.82 * luz;
        d[q] = col[0] * f; d[q + 1] = col[1] * f; d[q + 2] = col[2] * f; d[q + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);

      // cuadrícula de distancias cada 25 mi, medida desde O
      const px = CW / MW, ppm = px * MI;   // píxeles por metro y por milla
      const Ox = (OX + MW / 2) * px, Oy = (OZ + MD / 2) * px;
      for (let m = -400; m <= 900; m += 25) {
        const w = m % 100 === 0 ? 2 : 1, a = m % 100 === 0 ? 0.5 : m % 50 === 0 ? 0.3 : 0.15;
        ctx.strokeStyle = `rgba(16,30,44,${a})`; ctx.lineWidth = w;
        const xx = Ox + m * ppm, yy = Oy - m * ppm;
        if (xx > 0 && xx < CW) { ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, CH); ctx.stroke(); }
        if (yy > 0 && yy < CH) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(CW, yy); ctx.stroke(); }
      }
      // rutas (ejes) con marcas cada 50 mi
      ctx.strokeStyle = '#173a5e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(Ox, Oy); ctx.lineTo(CW, Oy); ctx.moveTo(Ox, Oy); ctx.lineTo(Ox, 0); ctx.stroke();
      ctx.lineWidth = 3;
      for (let m = 50; m <= 800; m += 50) {
        const t = m % 100 === 0 ? 14 : 8;
        const xx = Ox + m * ppm, yy = Oy - m * ppm;
        if (xx < CW) { ctx.beginPath(); ctx.moveTo(xx, Oy - t); ctx.lineTo(xx, Oy + t); ctx.stroke(); }
        if (yy > 0) { ctx.beginPath(); ctx.moveTo(Ox - t, yy); ctx.lineTo(Ox + t, yy); ctx.stroke(); }
      }
      // flechas de sentido hacia O
      ctx.fillStyle = '#173a5e';
      const flecha = (x, y, ang) => { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, -9); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill(); ctx.restore(); };
      for (const m of [75, 175, 275, 375]) { flecha(Ox + m * ppm, Oy, Math.PI); }
      for (const m of [75, 175, 275, 375, 475]) { flecha(Ox, Oy - m * ppm, Math.PI / 2); }
      const texto = (t, x, y, { tam = 22, peso = 700, al = 'center', color = '#10243a', halo = 'rgba(255,255,255,0.85)' } = {}) => {
        ctx.font = kit.font(tam, peso); ctx.textAlign = al; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.strokeStyle = halo; ctx.lineWidth = tam * 0.28; ctx.strokeText(t, x, y);
        ctx.fillStyle = color; ctx.fillText(t, x, y);
      };
      for (let m = 100; m <= 400; m += 100) texto(`${m} mi`, Ox + m * ppm, Oy + 34);
      for (let m = 100; m <= 500; m += 100) texto(`${m} mi`, Ox - 18, Oy - m * ppm, { al: 'right' });
      texto('RUTA DE A', Ox + 455 * ppm, Oy - 28, { tam: 20, color: '#8a4a00' });
      ctx.save(); ctx.translate(Ox + 30, Oy - 450 * ppm); ctx.rotate(-Math.PI / 2); texto('RUTA DE B', 0, 0, { tam: 20, color: '#0b4a86' }); ctx.restore();
      // punto O y ángulo recto
      ctx.strokeStyle = '#10243a'; ctx.lineWidth = 2.5; ctx.strokeRect(Ox + 6, Oy - 30, 24, 24);
      ctx.beginPath(); ctx.arc(Ox, Oy, 12, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(Ox, Oy, 4, 0, Math.PI * 2); ctx.fillStyle = '#10243a'; ctx.fill();
      texto('O', Ox - 26, Oy + 30, { tam: 34, peso: 800 });
      // rótulo, escala gráfica y norte
      ctx.fillStyle = 'rgba(246,244,236,0.92)'; ctx.fillRect(CW - 400, 22, 378, 92); ctx.strokeStyle = '#10243a'; ctx.lineWidth = 3; ctx.strokeRect(CW - 400, 22, 378, 92);
      texto('SECTOR DE CONTROL', CW - 211, 50, { tam: 26, peso: 800, halo: 'rgba(0,0,0,0)' });
      texto('Escala 1 mi ≈ 2,5 mm · cuadrícula de 25 mi', CW - 211, 88, { tam: 17, peso: 600, halo: 'rgba(0,0,0,0)' });
      const bx = 34, by = CH - 46;
      for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#f4f2ea' : '#10243a'; ctx.fillRect(bx + k * 25 * ppm, by, 25 * ppm, 12); }
      ctx.strokeStyle = '#10243a'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, 100 * ppm, 12);
      texto('0', bx, by - 16, { tam: 18 }); texto('50', bx + 50 * ppm, by - 16, { tam: 18 }); texto('100 mi', bx + 100 * ppm + 10, by - 16, { tam: 18 });
      const nx = CW - 70, ny = CH - 120;
      ctx.fillStyle = '#10243a'; ctx.beginPath(); ctx.moveTo(nx, ny - 46); ctx.lineTo(nx + 16, ny + 10); ctx.lineTo(nx, ny); ctx.lineTo(nx - 16, ny + 10); ctx.closePath(); ctx.fill();
      texto('N', nx, ny + 36, { tam: 28, peso: 800 });
      return c;
    }

    // ------------------------------------------------------------ maquetas de los aviones sobre soportes de acrílico
    function avion(colorCola) {
      const a = new THREE.Group();
      const pintura = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.32, metalness: 0.15 });
      const gris = new THREE.MeshStandardMaterial({ color: 0xbfc6cd, roughness: 0.4, metalness: 0.35 });
      const cola = new THREE.MeshStandardMaterial({ color: colorCola, roughness: 0.4, metalness: 0.1 });
      const perfil = [[0, -0.075], [0.0024, -0.073], [0.0048, -0.066], [0.0072, -0.052], [0.0086, -0.035], [0.009, -0.012], [0.009, 0.034],
        [0.0085, 0.049], [0.0072, 0.059], [0.005, 0.067], [0.0024, 0.0725], [0, 0.0748]];
      const fus = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), 16);
      fus.rotateZ(-Math.PI / 2); // eje del fuselaje a lo largo de +x (la nariz en +x)
      kit.malla(fus, pintura, { padre: a });
      kit.caja(0.009, 0.003, 0.011, new THREE.MeshStandardMaterial({ color: 0x1b2630, roughness: 0.15, metalness: 0.5 }), { x: 0.06, y: 0.0052, padre: a });
      const plano = (pts, prof, mat, o) => {
        const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
        const geo = new THREE.ExtrudeGeometry(sh, { depth: prof, bevelEnabled: false });
        return kit.malla(geo, mat, { padre: a, ...o });
      };
      // alas y estabilizador horizontal en planta (la forma se gira para quedar horizontal)
      const ala = [[0.024, 0], [-0.014, 0.066], [-0.027, 0.066], [-0.017, 0.009], [-0.02, 0], [-0.017, -0.009], [-0.027, -0.066], [-0.014, -0.066]];
      const estab = [[-0.05, 0], [-0.066, 0.027], [-0.075, 0.027], [-0.07, 0.004], [-0.071, 0], [-0.07, -0.004], [-0.075, -0.027], [-0.066, -0.027]];
      plano(ala, 0.0016, gris, { rx: Math.PI / 2, y: -0.0028 });
      plano(estab, 0.0013, gris, { rx: Math.PI / 2, y: 0.0035 });
      // deriva con el color de la aerolínea
      plano([[-0.044, 0.004], [-0.067, 0.034], [-0.077, 0.034], [-0.075, 0.004]], 0.0014, cola, { z: -0.0007 });
      // motores bajo las alas
      for (const l of [-1, 1]) {
        kit.malla(new THREE.CylinderGeometry(0.0043, 0.0038, 0.022, 14), cola, { x: 0.011, y: -0.0088, z: l * 0.024, rz: -Math.PI / 2, padre: a });
        kit.caja(0.012, 0.004, 0.0016, gris, { x: 0.006, y: -0.0055, z: l * 0.024, padre: a });
      }
      return a;
    }
    const avA = avion(0xee8a22), avB = avion(0x2f7fd0);
    avA.rotation.y = Math.PI; avB.rotation.y = -Math.PI / 2; // A vuela hacia −x y B hacia +z, ambos hacia O
    g.add(avA, avB);

    // estelas: dos franjas por avión, de largo proporcional a la velocidad (lo recorrido en 0,2 h)
    const estelaTex = (() => {
      const c = document.createElement('canvas'); c.width = 8; c.height = 128;
      const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.06, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 8, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const estelaGeo = new THREE.BufferGeometry();
    estelaGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.5, 0, 0, 0.5, -1, 0, -0.5, -1, 0, 0.5], 3));
    estelaGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
    estelaGeo.setIndex([0, 2, 1, 2, 3, 1]);
    const estelaMat = new THREE.MeshBasicMaterial({ map: estelaTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    for (const [av, v] of [[avA, -M.vx], [avB, -M.vy]]) {
      for (const l of [-1, 1]) {
        const e = new THREE.Mesh(estelaGeo, estelaMat);
        e.position.set(-0.002, -0.0088, l * 0.024); e.scale.set(v * 0.2 * MI, 1, 0.0065); e.renderOrder = 2;
        av.add(e);
      }
    }

    const acrilico = new THREE.MeshStandardMaterial({ color: 0xdcefff, transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0, depthWrite: false });
    const pieMat = new THREE.MeshStandardMaterial({ color: 0x24292e, roughness: 0.5, metalness: 0.2 });
    function soporte() {
      const vara = kit.malla(new THREE.CylinderGeometry(0.0032, 0.0032, 1, 8), acrilico, { padre: g, sombra: false });
      const pie = kit.malla(new THREE.CylinderGeometry(0.02, 0.024, 0.006, 24), pieMat, { padre: g });
      return { vara, pie };
    }
    const sopA = soporte(), sopB = soporte();
    function ponerSoporte(sp, x, z) {
      const hb = alturaEn(x, z), y0 = hb + 0.006, y1 = VUELO - 0.008;
      sp.pie.position.set(x, hb + 0.003, z);
      sp.vara.position.set(x, (y0 + y1) / 2, z); sp.vara.scale.y = y1 - y0;
    }

    // ------------------------------------------------------------ x, y, s y el punto O
    const barraMat = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    const rayaTex = (() => {
      const c = document.createElement('canvas'); c.width = 4; c.height = 32;
      const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 4, 18);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    })();
    const bx = kit.barra([0, 0, 0], [0, 1, 0], 0.0022, barraMat(0xffb347), 6), by = kit.barra([0, 0, 0], [0, 1, 0], 0.0022, barraMat(0x5cc8ff), 6);
    const bs = kit.barra([0, 0, 0], [0, 1, 0], 0.0028, new THREE.MeshBasicMaterial({ color: 0xffd34d, map: rayaTex, alphaTest: 0.5, toneMapped: false }), 6);
    for (const b of [bx, by, bs]) { b.castShadow = false; g.add(b); }
    const Op = [OX, VUELO, OZ];
    {
      const gal = new THREE.MeshStandardMaterial({ color: 0xb8bec4, metalness: 0.8, roughness: 0.3 });
      const hO = alturaEn(OX, OZ);
      kit.cilindro(0.0025, 0.0025, VUELO - hO, gal, { x: OX, y: (VUELO + hO) / 2, z: OZ, padre: g, seg: 8 });
      kit.malla(new THREE.SphereGeometry(0.007, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), { x: OX, y: VUELO, z: OZ, padre: g, sombra: false });
      const blanco = barraMat(0xffffff), q = 0.035;
      for (const [a, b] of [[[OX + q, VUELO, OZ], [OX + q, VUELO, OZ - q]], [[OX, VUELO, OZ - q], [OX + q, VUELO, OZ - q]]]) {
        const m = kit.barra(a, b, 0.0012, blanco, 5); m.castShadow = false; g.add(m);
      }
    }
    const anillo = kit.malla(new THREE.TorusGeometry(0.06, 0.004, 8, 48), new THREE.MeshBasicMaterial({ color: 0xff4d4d, toneMapped: false }), { x: OX, y: VUELO, z: OZ, rx: Math.PI / 2, padre: g, sombra: false });
    anillo.visible = false;

    const lA = etq('A · 450 mi/h', 0.03, { bg: '#ffb347', color: '#1a1206' }), lB = etq('B · 600 mi/h', 0.03, { bg: '#5cc8ff', color: '#08202c' });
    const lx = etq('x', 0.034, { color: '#ffb347' }), ly = etq('y', 0.034, { color: '#5cc8ff' }), ls = etq('s', 0.036, { bg: '#ffd34d', color: '#1a1206' });
    const lO = etq('O', 0.03, { color: '#ffffff' }), lConf = etq('CONFLICTO DE TRÁNSITO EN O', 0.045, { bg: '#d8342c', color: '#ffffff' });
    lO.position.set(OX - 0.022, VUELO + 0.022, OZ + 0.01); lConf.position.set(OX + 0.05, VUELO + 0.14, OZ);
    g.add(lA, lB, lx, ly, ls, lO, lConf);

    // ------------------------------------------------------------ toldo plegable sobre la mesa
    {
      const toldo = new THREE.Group(); toldo.position.set(0, 0, 0.4); g.add(toldo);
      const AX = 1.9, AZ = 1.85, HE = 2.55, HP = 0.62;
      const aluT = new THREE.MeshStandardMaterial({ color: 0xc0c6cc, metalness: 0.75, roughness: 0.35 });
      const sacoMat = new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.95 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        kit.caja(0.045, HE, 0.045, aluT, { x: sx * AX, y: HE / 2, z: sz * AZ, padre: toldo });
        kit.caja(0.15, 0.008, 0.15, aluT, { x: sx * AX, y: 0.03, z: sz * AZ, padre: toldo });
        kit.malla(new THREE.CapsuleGeometry(0.07, 0.24, 4, 10), sacoMat, { x: sx * AX, y: 0.095, z: sz * (AZ + 0.15), rz: Math.PI / 2, padre: toldo });
      }
      for (const sz of [-1, 1]) kit.caja(2 * AX, 0.03, 0.03, aluT, { y: HE - 0.015, z: sz * AZ, padre: toldo });
      for (const sx of [-1, 1]) kit.caja(0.03, 0.03, 2 * AZ, aluT, { x: sx * AX, y: HE - 0.015, padre: toldo });
      // tijeras del armazón
      const tij = (a, b) => { const m = kit.barra(a, b, 0.009, aluT, 6); toldo.add(m); };
      for (const sz of [-1, 1]) for (const [x0, x1] of [[-AX, 0], [0, AX]]) { tij([x0, HE - 0.36, sz * AZ], [x1, HE - 0.03, sz * AZ]); tij([x0, HE - 0.03, sz * AZ], [x1, HE - 0.36, sz * AZ]); }
      for (const sx of [-1, 1]) for (const [z0, z1] of [[-AZ, 0], [0, AZ]]) { tij([sx * AX, HE - 0.36, z0], [sx * AX, HE - 0.03, z1]); tij([sx * AX, HE - 0.03, z0], [sx * AX, HE - 0.36, z1]); }
      const techo = new THREE.ConeGeometry(1, HP, 4, 1, true);
      techo.rotateY(Math.PI / 4); techo.scale((2 * AX + 0.12) / Math.SQRT2, 1, (2 * AZ + 0.12) / Math.SQRT2);
      kit.malla(techo, new THREE.MeshStandardMaterial({ color: 0xe6e3da, roughness: 0.92, side: THREE.DoubleSide, flatShading: true }), { y: HE + HP / 2, padre: toldo });
      const faldon = new THREE.MeshStandardMaterial({ color: 0x24569e, roughness: 0.9 });
      for (const sz of [-1, 1]) kit.caja(2 * AX + 0.12, 0.22, 0.006, faldon, { y: HE - 0.11, z: sz * (AZ + 0.06), padre: toldo });
      for (const sx of [-1, 1]) kit.caja(0.006, 0.22, 2 * AZ + 0.12, faldon, { x: sx * (AX + 0.06), y: HE - 0.11, padre: toldo });
      // tubo de luz colgado del armazón
      kit.caja(1.2, 0.035, 0.07, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f7ff, emissiveIntensity: 1.4 }), { y: HE + 0.06, z: -0.4, padre: toldo, sombra: false });
      for (const l of [-1, 1]) { const m = kit.barra([l * 0.5, HE + 0.08, -0.4], [l * 0.3, HE + 0.42, -0.4 * 0.6], 0.003, aceroP, 4); toldo.add(m); }
    }

    // ------------------------------------------------------------ caseta de control con ventanales
    const CX = -1.2; // centro de la caseta en x
    const baliza = new THREE.MeshStandardMaterial({ color: 0x8a1f1a, roughness: 0.3, emissive: 0xff2a1a, emissiveIntensity: 0 });
    {
      const caseta = new THREE.Group(); caseta.position.set(CX, 0, -6.7); g.add(caseta);
      const LX = 6.0, LZ = 2.4, HC = 2.6, BL = 0.15, F = LZ / 2;
      kit.caja(LX - 0.02, HC, LZ - 0.02, kit.mat('ribbed', { repeat: [9, 1], color: 0xe6e9eb, roughness: 1 }), { y: BL + HC / 2, padre: caseta });
      const marcoC = new THREE.MeshStandardMaterial({ color: 0x55606b, roughness: 0.6, metalness: 0.5 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.caja(0.14, HC + 0.02, 0.14, marcoC, { x: sx * (LX / 2 - 0.06), y: BL + HC / 2, z: sz * (F - 0.06), padre: caseta });
      for (const sz of [-1, 1]) {
        kit.caja(LX, 0.14, 0.14, marcoC, { y: BL + HC - 0.06, z: sz * (F - 0.06), padre: caseta });
        kit.caja(LX, 0.16, 0.14, marcoC, { y: BL + 0.08, z: sz * (F - 0.06), padre: caseta });
      }
      kit.caja(LX + 0.08, 0.05, LZ + 0.08, marcoC, { y: BL + HC + 0.025, padre: caseta });
      const hormigon = kit.mat('concrete', { repeat: [0.4, 0.2], color: 0xbab5ac });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.caja(0.42, BL, 0.42, hormigon, { x: sx * (LX / 2 - 0.35), y: BL / 2, z: sz * (F - 0.3), padre: caseta });
      const vidrio = new THREE.MeshStandardMaterial({ color: 0x23323d, roughness: 0.05, metalness: 0.45, envMapIntensity: 1.8 });
      const alu = new THREE.MeshStandardMaterial({ color: 0xc9cfd5, roughness: 0.35, metalness: 0.8 });
      for (const wx of [-2.1, -0.65, 0.8]) {
        kit.caja(1.3, 1.0, 0.02, vidrio, { x: wx, y: 1.72, z: F + 0.005, padre: caseta });
        kit.caja(1.4, 0.05, 0.05, alu, { x: wx, y: 2.245, z: F + 0.02, padre: caseta });
        kit.caja(1.46, 0.05, 0.1, alu, { x: wx, y: 1.195, z: F + 0.04, padre: caseta });
        for (const l of [-1, 1]) kit.caja(0.05, 1.08, 0.05, alu, { x: wx + l * 0.675, y: 1.72, z: F + 0.02, padre: caseta });
        kit.caja(0.035, 1.0, 0.04, alu, { x: wx + 0.05, y: 1.72, z: F + 0.025, padre: caseta });
      }
      // puerta, peldaño y extintor
      kit.caja(0.92, 2.02, 0.04, new THREE.MeshStandardMaterial({ color: 0x7d8a95, roughness: 0.5, metalness: 0.4 }), { x: 2.25, y: BL + 1.06, z: F + 0.012, padre: caseta });
      kit.caja(0.4, 0.5, 0.02, vidrio, { x: 2.25, y: BL + 1.55, z: F + 0.036, padre: caseta });
      kit.cilindro(0.012, 0.012, 0.14, alu, { x: 2.25 - 0.32, y: BL + 0.98, z: F + 0.07, rz: Math.PI / 2, padre: caseta, seg: 8 });
      kit.caja(1.1, 0.14, 0.42, kit.mat('metal', { repeat: [2, 1], color: 0x9ea6ad, metalness: 0.7 }), { x: 2.25, y: 0.07, z: F + 0.23, padre: caseta });
      const rojo = new THREE.MeshStandardMaterial({ color: 0xc8231d, roughness: 0.35, metalness: 0.2 });
      kit.cilindro(0.075, 0.075, 0.42, rojo, { x: 1.6, y: 0.95, z: F + 0.09, padre: caseta, seg: 16 });
      kit.cilindro(0.03, 0.04, 0.08, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }), { x: 1.6, y: 1.2, z: F + 0.09, padre: caseta, seg: 10 });
      // letrero sobre los ventanales
      const c = document.createElement('canvas'); c.width = 1024; c.height = 118;
      const x = c.getContext('2d');
      x.fillStyle = '#1c3d66'; x.fillRect(0, 0, 1024, 118); x.fillStyle = '#f2b233'; x.fillRect(0, 100, 1024, 18);
      x.fillStyle = '#ffffff'; x.font = kit.font(58, 800); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CONTROL DE TRÁNSITO AÉREO', 512, 52);
      const tl = new THREE.CanvasTexture(c); tl.colorSpace = THREE.SRGBColorSpace; tl.anisotropy = 4;
      kit.malla(new THREE.PlaneGeometry(2.7, 0.31), new THREE.MeshStandardMaterial({ map: tl, roughness: 0.6 }), { x: -0.65, y: 2.43, z: F + 0.012, padre: caseta, sombra: false });
      // equipo de aire acondicionado, mástil de radio y baliza
      kit.caja(0.3, 0.55, 0.8, new THREE.MeshStandardMaterial({ color: 0xdfe2e4, roughness: 0.5 }), { x: -LX / 2 - 0.15, y: 1.95, z: 0.2, padre: caseta });
      kit.caja(0.01, 0.42, 0.62, marcoC, { x: -LX / 2 - 0.305, y: 1.95, z: 0.2, padre: caseta });
      kit.cilindro(0.022, 0.016, 1.7, alu, { x: -2.5, y: BL + HC + 0.9, z: -0.6, padre: caseta, seg: 8 });
      kit.cilindro(0.004, 0.004, 0.9, alu, { x: -2.5, y: BL + HC + 2.2, z: -0.6, padre: caseta, seg: 6 });
      kit.cilindro(0.08, 0.08, 0.05, marcoC, { x: 2.4, y: BL + HC + 0.075, z: 0.7, padre: caseta, seg: 16 });
      kit.malla(new THREE.SphereGeometry(0.07, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), baliza, { x: 2.4, y: BL + HC + 0.1, z: 0.7, padre: caseta });
    }

    // ------------------------------------------------------------ radar móvil junto a la caseta, con antena giratoria
    const antena = new THREE.Group();
    {
      const rad = new THREE.Group(); rad.position.set(3.4, 0, -6.9); rad.rotation.y = Math.PI + 0.3; g.add(rad);
      const blanco = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.5, metalness: 0.1 });
      const chasis = new THREE.MeshStandardMaterial({ color: 0x3d434a, roughness: 0.6, metalness: 0.6 });
      const goma = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.9 });
      const llanta = new THREE.MeshStandardMaterial({ color: 0xaeb4ba, roughness: 0.4, metalness: 0.8 });
      const b = (a, c, r) => { const m = kit.barra(a, c, r, chasis, 8); rad.add(m); return m; };
      for (const sz of [-1, 1]) kit.caja(2.7, 0.12, 0.08, chasis, { y: 0.6, z: sz * 0.62, padre: rad });
      for (const xx of [-1.1, 0, 1.1]) kit.caja(0.08, 0.1, 1.24, chasis, { x: xx, y: 0.6, padre: rad });
      kit.caja(2.5, 0.03, 1.36, kit.mat('metal', { repeat: [3, 2], color: 0xb5bbc1, metalness: 0.7 }), { y: 0.675, padre: rad });
      for (const sz of [-1, 1]) {
        kit.cilindro(0.32, 0.32, 0.2, goma, { x: -0.1, y: 0.32, z: sz * 0.84, rx: Math.PI / 2, padre: rad, seg: 26 });
        kit.cilindro(0.19, 0.19, 0.21, llanta, { x: -0.1, y: 0.32, z: sz * 0.84, rx: Math.PI / 2, padre: rad, seg: 18 });
        kit.caja(0.82, 0.03, 0.3, chasis, { x: -0.1, y: 0.7, z: sz * 0.84, padre: rad });
      }
      b([-1.3, 0.6, 0.55], [-2.15, 0.52, 0], 0.03); b([-1.3, 0.6, -0.55], [-2.15, 0.52, 0], 0.03);
      kit.caja(0.18, 0.1, 0.12, chasis, { x: -2.22, y: 0.52, padre: rad });
      kit.cilindro(0.028, 0.028, 0.46, chasis, { x: -1.85, y: 0.36, padre: rad, seg: 10 });
      kit.cilindro(0.08, 0.08, 0.05, goma, { x: -1.85, y: 0.08, rx: Math.PI / 2, padre: rad, seg: 16 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        kit.cilindro(0.03, 0.03, 0.56, chasis, { x: sx * 1.22, y: 0.32, z: sz * 0.62, padre: rad, seg: 10 });
        kit.caja(0.18, 0.02, 0.18, chasis, { x: sx * 1.22, y: 0.03, z: sz * 0.62, padre: rad });
      }
      kit.caja(0.85, 1.0, 1.0, blanco, { x: -0.65, y: 1.19, padre: rad });
      kit.caja(0.012, 0.36, 0.62, chasis, { x: -1.08, y: 1.28, padre: rad });
      kit.cilindro(0.085, 0.07, 1.95, blanco, { x: 0.6, y: 1.665, padre: rad, seg: 16 });
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.5; b([0.6 + 0.55 * Math.cos(a), 0.69, 0.5 * Math.sin(a)], [0.6, 1.55, 0], 0.016); }
      kit.cilindro(0.17, 0.15, 0.28, chasis, { x: 0.6, y: 2.78, padre: rad, seg: 20 });
      antena.position.set(0.6, 2.92, 0); rad.add(antena);
      const R = 1.5, refl = new THREE.SphereGeometry(R, 22, 6, Math.PI / 2 - 0.62, 1.24, Math.PI / 2 - 0.2, 0.4);
      refl.translate(0, 0.32, -R - 0.18);
      kit.malla(refl, new THREE.MeshStandardMaterial({ color: 0xd3d8dd, metalness: 0.55, roughness: 0.42, side: THREE.DoubleSide }), { padre: antena });
      const ba = (a, c, r = 0.014) => { const m = kit.barra(a, c, r, chasis, 6); antena.add(m); };
      kit.caja(0.16, 0.22, 0.16, chasis, { y: 0.1, padre: antena });
      const zR = (x) => -R - 0.18 + Math.sqrt(R * R - x * x);
      ba([0, 0.16, -0.06], [0.62, 0.32, zR(0.62) + 0.01]); ba([0, 0.16, -0.06], [-0.62, 0.32, zR(0.62) + 0.01]);
      ba([0, 0.2, -0.06], [0, 0.55, zR(0) + 0.01]); ba([0, 0.06, -0.06], [0, 0.06, zR(0) + 0.01]);
      kit.caja(0.16, 0.12, 0.15, chasis, { y: 0.27, z: -0.93, padre: antena });
      ba([-0.3, 0.05, zR(0.3) - 0.01], [-0.03, 0.24, -0.88], 0.01); ba([0.3, 0.05, zR(0.3) - 0.01], [0.03, 0.24, -0.88], 0.01);
      kit.caja(1.5, 0.11, 0.07, blanco, { y: 0.67, z: -0.21, padre: antena });
      // cable de datos por el suelo hasta la caseta
      rad.updateMatrix();
      const ini = new THREE.Vector3(-0.65, 0.02, 0.52).applyMatrix4(rad.matrix);
      const muro = CX + 3.0;
      const pts = [ini, new THREE.Vector3(ini.x - 0.2, 0.018, ini.z + 0.7), new THREE.Vector3(muro + 0.35, 0.018, -5.75), new THREE.Vector3(muro + 0.06, 0.05, -6.0), new THREE.Vector3(muro + 0.02, 0.6, -6.05)];
      kit.malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 6), new THREE.MeshStandardMaterial({ color: 0x1f2326, roughness: 0.7 }), { padre: g });
      // conos de seguridad
      const naranjaC = new THREE.MeshStandardMaterial({ color: 0xf4651c, roughness: 0.55 }), blancoC = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.5 });
      for (const [cx, cz] of [[2.3, -4.6], [5.0, -5.4], [5.3, -8.3]]) {
        const cono = new THREE.Group(); cono.position.set(cx, 0, cz); g.add(cono);
        kit.caja(0.36, 0.03, 0.36, goma, { y: 0.015, padre: cono });
        kit.cilindro(0.15, 0.03, 0.68, naranjaC, { y: 0.37, padre: cono, seg: 18 });
        kit.cilindro(0.115, 0.098, 0.1, blancoC, { y: 0.3, padre: cono, seg: 18 });
        kit.cilindro(0.078, 0.064, 0.08, blancoC, { y: 0.5, padre: cono, seg: 18 });
      }
    }

    persona(kit, g, { x: -1.15, z: -1.4, ry: 0.65, chaleco: 0xd6e02a });

    // ------------------------------------------------------------ escena según el reloj
    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
    function construir() {
      const t = reloj.t, A = posA(t), B = posB(t), sv = M.s(t), conf = conflicto();
      avA.position.set(...A); avB.position.set(...B);
      ponerSoporte(sopA, A[0], A[2]); ponerSoporte(sopB, B[0], B[2]);
      kit.moverBarra(bx, A, Op); kit.moverBarra(by, B, Op); kit.moverBarra(bs, A, B);
      rayaTex.repeat.set(1, Math.max(1, sv * MI / 0.012));
      const visible = sv > 18;
      bx.visible = by.visible = bs.visible = lx.visible = ly.visible = ls.visible = visible;
      kit.cambiarEtiqueta(lx, `x = ${kit.num(M.x(t), 1)} mi`); lx.position.set((A[0] + OX) / 2, VUELO + 0.026, OZ + 0.03);
      kit.cambiarEtiqueta(ly, `y = ${kit.num(M.y(t), 1)} mi`); ly.position.set(OX - 0.07, VUELO + 0.026, (B[2] + OZ) / 2);
      kit.cambiarEtiqueta(ls, `s = ${kit.num(sv, 1)} mi`);
      v1.set((A[0] + B[0]) / 2, VUELO, (A[2] + B[2]) / 2); v2.set(v1.x - OX, 0, v1.z - OZ).normalize();
      ls.position.set(v1.x + v2.x * 0.05, VUELO + 0.03, v1.z + v2.z * 0.05);
      lA.position.set(A[0], VUELO + 0.045, A[2]); lB.position.set(B[0], VUELO + 0.045, B[2]);
      lA.visible = lB.visible = lO.visible = !conf;
      anillo.visible = lConf.visible = conf;
    }

    // ------------------------------------------------------------ gráfico de s(t) con la tangente
    const graf = kit.grafico({
      f: (t) => M.s(t), x0: -0.1, x1: M.llegada(), y0: 0, y1: 500, width: 1.3, height: 0.8,
      xTicks: [-0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5], yTicks: [0, 100, 200, 300, 400, 500], tickFmt: (v) => kit.num(v, 1), yTickFmt: (v) => String(v),
      xLabel: 'tiempo t (h)', yLabel: 'distancia s (mi)', curveColor: 0xffd34d,
    });
    graf.group.position.set(0.9, 1.16, -0.12); graf.group.rotation.y = -0.85;
    g.add(graf.group);
    graf.group.children[0].material.depthWrite = true; // el fondo del gráfico tapa los rótulos lejanos
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => reloj.fijar(graf.xFromLocal(p.x)) });
    // triángulo de pendiente: en 0,1 h la distancia baja 75 mi
    const pendMat = new THREE.MeshBasicMaterial({ color: 0xff9f6b, toneMapped: false });
    const tH = new THREE.Mesh(new THREE.BoxGeometry(1, 0.004, 0.004), pendMat), tV = new THREE.Mesh(new THREE.BoxGeometry(0.004, 1, 0.004), pendMat);
    const lDt = kit.createLabel('Δt = 0,1 h', { size: 0.032, color: '#ffcfb0', weight: 700 }), lDs = kit.createLabel('Δs = −75 mi', { size: 0.032, color: '#ffcfb0', weight: 700 });
    const triP = new THREE.Group(); triP.position.z = 0.006; triP.add(tH, tV, lDt, lDs); graf.group.add(triP);
    function ponerPendiente(t) {
      const ta = Math.min(t, M.llegada() - 0.1), tb = ta + 0.1;
      const P = graf.toLocal(ta, M.s(ta)), Q = graf.toLocal(tb, M.s(ta)), R = graf.toLocal(tb, M.s(tb));
      tH.position.set((P.x + Q.x) / 2, P.y, 0); tH.scale.x = Q.x - P.x;
      tV.position.set(Q.x, (Q.y + R.y) / 2, 0); tV.scale.y = Q.y - R.y;
      lDt.position.set((P.x + Q.x) / 2, P.y + 0.03, 0);
      lDs.position.set(tb > 0.45 ? Q.x - 0.1 : Q.x + 0.1, (Q.y + R.y) / 2, 0);
      triP.visible = !conflicto();
    }

    function revelar() {
      graf.removePoint('inst');
      if (s.revelar) graf.addPoint('inst', M.instante, M.s(M.instante), { color: 0x6fe3a2, labelX: 't = 0', labelY: '375' });
      s.ultimo = -1;
    }

    // ------------------------------------------------------------ panel
    const pieRev = 'En t = 0: s = √(225² + 300²) = 375 mi y 375·ds/dt = 225·(−450) + 300·(−600) = −281.250, así que ds/dt = −750 mi/h. La distancia entre los aviones se reduce a 750 mi/h.';
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'A está a 225 mi de O y vuela a 450 mi/h; B está a 300 mi de O y vuela a 600 mi/h, a la misma altura y en rutas perpendiculares. ¿A qué razón cambia la distancia s entre ellos?',
      ecuaciones: ['s² = x² + y²   ⇒   s·ds/dt = x·dx/dt + y·dy/dt', 'x = 225 − 450t,   y = 300 − 600t   (t en horas)'],
      lecturas: [
        { etiqueta: 'x (de A a O)', valor: () => `${kit.num(M.x(reloj.t), 1)} mi`, color: '#ffb347' },
        { etiqueta: 'y (de B a O)', valor: () => `${kit.num(M.y(reloj.t), 1)} mi`, color: '#5cc8ff' },
        { etiqueta: 's (entre A y B)', valor: () => `${kit.num(M.s(reloj.t), 1)} mi`, color: '#ffd34d' },
        { etiqueta: 'dx/dt', valor: () => `${kit.num(M.vx, 0)} mi/h`, color: '#ffb347', escala: 0.7 },
        { etiqueta: 'dy/dt', valor: () => `${kit.num(M.vy, 0)} mi/h`, color: '#5cc8ff', escala: 0.7 },
        { etiqueta: 'ds/dt', valor: () => (conflicto() ? '—' : `${kit.num(M.dsdt(reloj.t), 1)} mi/h`), color: '#ffd34d', escala: 0.7 },
      ],
      deslizadores: [
        { etiqueta: 'Tiempo t', min: -0.1, max: M.llegada(), paso: 0.005, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 3)} h  (${kit.num(v * 60, 1)} min)` },
        { etiqueta: 'Velocidad del reloj', min: 0.01, max: 0.12, paso: 0.005, color: '#ffb347', get: () => reloj.velocidad, set: (v) => { reloj.velocidad = v; }, formato: (v) => `${kit.num(v * 60, 1)} min por segundo` },
      ],
      botones: [
        { etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() },
        { etiqueta: 'Ir al instante (t = 0)', accion: () => reloj.alInstante() },
        { etiqueta: 'Revelar respuesta', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      lineasPie: 5,
      pie: () => {
        if (conflicto()) return 'Conflicto de tránsito: A y B llegan juntos a O en t = 0,5 h, a la misma altura. ' + (s.revelar ? pieRev : 'Uno de los dos debe cambiar de altura o de ruta.');
        return s.revelar ? pieRev : 'Reproduce el reloj, mueve el tiempo o arrastra el gráfico. La pendiente de la tangente a s(t) es ds/dt. En el instante del problema (t = 0), A está a 225 mi de O y B a 300 mi.';
      },
      pieColor: () => (conflicto() ? kit.THEME.bad : s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-1.38, 1.4, 0.42); panel.mesh.rotation.y = 0.86;
    panel.mesh.renderOrder = 13; // tapa los rótulos que quedan detrás
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    const vel = () => ({ tipo: 'boton', etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() });
    return {
      paneles: [panel],
      radioSombra: 11,
      alturaCartel: 4.0,
      vista: { escritorio: { camara: [0.25, 1.9, 2.75], objetivo: [0, 0.95, -0.5] }, vr: { pos: [0, 0, 1.6], yaw: 0 } },
      dom: [
        vel(),
        { tipo: 'rango', etiqueta: 't', min: -0.1, max: M.llegada(), paso: 0.005, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 3)} h` },
        { tipo: 'rango', etiqueta: 'velocidad', min: 0.01, max: 0.12, paso: 0.005, get: () => reloj.velocidad, set: (v) => { reloj.velocidad = v; }, formato: (v) => `${kit.num(v * 60, 1)} min/s` },
        { tipo: 'boton', etiqueta: 'Ir al instante (t = 0)', accion: () => reloj.alInstante() },
        { tipo: 'interruptor', etiqueta: 'Revelar respuesta', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      actualizar(dt, activa) {
        s.tiempo += dt;
        antena.rotation.y += dt * 1.55;
        if (activa) reloj.tick(dt);
        if (s.ultimo !== reloj.cambio) {
          s.ultimo = reloj.cambio;
          construir();
          graf.setMarker(reloj.t);
          // s(t) es lineal: la tangente coincide con la recta; se centra dentro del intervalo para no salir del gráfico
          const tc = Math.min(M.llegada() - 0.1, Math.max(0, reloj.t));
          graf.setTangent(tc, conflicto() ? null : M.dsdt(reloj.t), { color: 0xff7a5c, len: 0.5 });
          ponerPendiente(reloj.t);
          graf.removePoint('conf');
          if (conflicto()) graf.addPoint('conf', M.llegada(), 0, { color: 0xff6b6b, guides: false });
          panel.invalidate();
        }
        if (conflicto()) {
          const k = 1 + 0.25 * Math.sin(s.tiempo * 7);
          anillo.scale.set(k, k, k);
          baliza.emissiveIntensity = Math.sin(s.tiempo * 9) > 0 ? 2.2 : 0.1;
        } else if (baliza.emissiveIntensity !== 0) baliza.emissiveIntensity = 0;
      },
    };
  },
};
