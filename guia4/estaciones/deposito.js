// Ejercicio 2.4. Depósito cónico con el vértice hacia abajo (10 m de altura, 15 m de radio): sale 1 m³/s y entra c.
// Un operador gira el volante de la válvula de entrada y una ingeniera sigue el nivel en el indicador magnético.
import { DEPOSITO as M } from '../../src/math/guia4.js';

const YV = 2.4;                        // altura del vértice sobre el suelo
const YB = YV + M.H;                   // altura del borde del cono (12,4 m)
const CORTE = (70 * Math.PI) / 180;    // medio ángulo del corte frontal que deja ver el agua
const TAU = Math.PI * 2;
const RC = 15.25;                      // radio del anillo de columnas
const ESP = 0.072;                     // espesor de la chapa medido en horizontal
const Y_VIGA = 11.57;                  // cara inferior de la viga anular
const Y_PASILLO = 12.42;               // piso del pasillo perimetral
const A_ESCALA = (3 * Math.PI) / 8;    // columna con la escalera de gato (67,5°)
const A_ENTRADA = (-3 * Math.PI) / 8;  // tubería de entrada junto a la columna de adelante a la izquierda (−67,5°)
const A_NIVEL = (76 * Math.PI) / 180;  // indicador magnético de nivel, adelante a la derecha
const R_NIVEL = 16.9;                  // radio del tubo del indicador de nivel
const ZR = 17.3;                       // radio de la tubería de entrada
const RT = 0.8;                        // radio de la tubería de entrada
const YL = 1.2;                        // eje de la línea de impulsión junto al suelo
const Y_LOSA = 0.12;                   // piso de la losa de la sala de bombas
const Y_BOCA = 13.0;                   // boca de la tubería de entrada
const R_BOCA = 1.2;                    // distancia de la boca al eje del cono
const RF = 26;                         // radio del cerco
const A_ACCESO = (35 * Math.PI) / 180; // medio ángulo del acceso abierto hacia el visitante
const VX = 2.84, VY = 1.1, VZ = ZR - 1.62, VR = 0.3; // volante de la válvula de entrada (coordenadas de la tubería)
const ING = { x: 21.0, z: 6.5 };       // ingeniera, a un costado del indicador de nivel
const hDeV = (V) => Math.cbrt((4 * V) / (3 * Math.PI)); // inversa de V = (3π/4)h³
const radioChorro = (c) => 0.8 * Math.sqrt(Math.max(0, c) / 40); // el chorro llena la boca con 40 m³/s

export default {
  id: 'deposito',
  tipo: 'razon',
  etiqueta: 'Ejercicio 2.4 · Razón de cambio',
  titulo: 'Depósito cónico',
  resumen: 'Un depósito tiene forma de cono circular recto con el vértice hacia abajo, 10 m de altura y 15 m de radio. Sale agua por el vértice a 1 m³/s y entra agua a razón constante de c m³/s. ¿Cuál es el valor de c para que el nivel del agua suba a 4 m/s en el instante en que el agua tiene 1 m de profundidad?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const rnd = kit.mulberry32(2404);
    // El depósito se corre hacia la plaza para quedar dentro del cerco de la obra y se gira para que la persona
    // lo mire de frente sin quedar junto al estanque vecino.
    const esc = new THREE.Group(); esc.position.set(2.9, 0, 7.5); esc.rotation.y = 0.3; g.add(esc);
    esc.updateMatrixWorld(true);
    const aGrupo = (v) => { const p = new THREE.Vector3(...v).applyEuler(esc.rotation).add(esc.position); return [p.x, p.y, p.z]; };
    const pol = (a, r, y = 0) => [Math.sin(a) * r, y, Math.cos(a) * r];
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

    // Revisión: rev=t:4 detiene el reloj del volante y de las miradas, rev=gira:1 hace girar el volante y rev=h:2 fija el nivel
    const REV = new URLSearchParams((new URLSearchParams(location.search).get('rev') || '').replace(/:/g, '=').replace(/,/g, '&'));
    const s = { c: 12, h: 3, vel: 4, simular: false, revelar: false, cambio: 1, ultimo: 0, cambioC: 1, ultimoC: 0, refresco: 0, refrescoC: 0 };
    if (REV.has('h')) s.h = Math.min(M.H, Math.max(0.2, Number(REV.get('h')) || s.h));
    const anim = { t: 0, phi: s.c * 0.35, phiObj: s.c * 0.35, giro: 0 };

    // ------------------------------------------------------------ piezas fijas: se unen al final en una malla por material
    const lotes = new Map(), relativas = new Map();
    const movil = (o) => { o.userData.movil = true; return o; };
    const aEsc = (grupo) => { // matriz de un grupo interno respecto del depósito
      if (grupo === esc) return new THREE.Matrix4();
      let m = relativas.get(grupo);
      if (!m) { esc.updateMatrixWorld(true); m = esc.matrixWorld.clone().invert().multiply(grupo.matrixWorld); relativas.set(grupo, m); }
      return m;
    };
    const preparar = (geo) => {
      const gg = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') gg.deleteAttribute(k);
      if (!gg.attributes.normal) gg.computeVertexNormals();
      if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
      gg.clearGroups();
      return gg;
    };
    // cada material queda en una sola malla: proyecta sombra salvo que el material lo impida (userData.sinSombra)
    const pieza = (geo, mat, m4 = null, { en = esc } = {}) => {
      const gg = preparar(geo);
      gg.applyMatrix4(m4 ? aEsc(en).clone().multiply(m4) : aEsc(en));
      let l = lotes.get(mat.uuid);
      if (!l) lotes.set(mat.uuid, (l = { mat, sombra: !mat.userData.sinSombra, geos: [] }));
      l.geos.push(gg);
    };
    const sinSombra = (mat) => { mat.userData.sinSombra = true; return mat; };
    const consolidar = () => {
      esc.updateMatrixWorld(true);
      const inv = esc.matrixWorld.clone().invert(), m4 = new THREE.Matrix4(), mi = new THREE.Matrix4(), quitar = [];
      const visitar = (o) => {
        if (o.userData.movil) return;
        if (o.isMesh && o.material && !Array.isArray(o.material)) {
          m4.multiplyMatrices(inv, o.matrixWorld);
          if (o.isInstancedMesh) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, mi); pieza(o.geometry, o.material, mi.clone().premultiply(m4)); }
          else pieza(o.geometry, o.material, m4.clone());
          quitar.push(o);
        }
        for (const c of o.children) visitar(c);
      };
      visitar(esc);
      for (const o of quitar) { o.removeFromParent(); o.geometry.dispose(); }
      for (const l of lotes.values()) {
        const m = new THREE.Mesh(kit.mergeGeometries(l.geos), l.mat);
        m.castShadow = l.sombra; m.receiveShadow = true; esc.add(m);
        for (const gg of l.geos) gg.dispose();
      }
      lotes.clear();
    };
    const mtx = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1));
    const entre = (a, b) => {
      const A = V(...a), d = V(...b).sub(A), L = d.length();
      return { L, m: new THREE.Matrix4().compose(A.addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)) };
    };
    // coordenadas de textura a escala del mundo (k metros por repetición)
    const uvEsc = (geo, su, sv) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; };
    const cajaG = (w, h, d, k = 1) => {
      const gg = new THREE.BoxGeometry(w, h, d), uv = gg.attributes.uv, tam = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let j = 0; j < 4; j++) { const i = f * 4 + j; uv.setXY(i, (uv.getX(i) * tam[f][0]) / k, (uv.getY(i) * tam[f][1]) / k); }
      return gg;
    };
    const cilG = (r0, r1, h, seg = 16, k = 1, abierto = false) => uvEsc(new THREE.CylinderGeometry(r1, r0, h, seg, 1, abierto), Math.max(1, Math.round((Math.PI * (r0 + r1)) / k)), h / k);
    const barra = (a, b, r, mat, { en = esc, seg = 8, k = 1.5 } = {}) => { const t = entre(a, b); pieza(cilG(r, r, t.L, seg, k), mat, t.m, { en }); };
    const viga = (a, b, w, d, mat, { en = esc } = {}) => { const t = entre(a, b); pieza(cajaG(w, t.L, d, 1.5), mat, t.m, { en }); };
    class Arco extends THREE.Curve {
      constructor(c, u, v, R) { super(); this.c = c; this.u = u; this.v = v; this.R = R; }
      getPoint(t, out = new THREE.Vector3()) { const a = (t * Math.PI) / 2; return out.copy(this.c).addScaledVector(this.u, Math.cos(a) * this.R).addScaledVector(this.v, Math.sin(a) * this.R); }
    }
    const codo = (c, u, v, R, r, mat, en = esc) => {
      const gg = new THREE.TubeGeometry(new Arco(V(...c), V(...u), V(...v), R), 12, r, 22, false);
      pieza(uvEsc(gg, (Math.PI * R) / 2 / 1.5, (TAU * r) / 1.5), mat, null, { en });
    };
    const torno = (r0, y0, r1, y1, mat, { seg = 120, a0 = 0, da = TAU, padre = esc, sombra = true } = {}) =>
      kit.malla(new THREE.LatheGeometry([new THREE.Vector2(r0, y0), new THREE.Vector2(r1, y1)], seg, a0, da), mat, { padre, sombra });
    const SECTOR = { a0: CORTE, da: TAU - 2 * CORTE };

    // ------------------------------------------------------------ texturas de lienzo
    const lienzo = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const texDe = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    // Pintura industrial gastada: variación de tono, polvo, chorreaduras de óxido, saltaduras y rayas. Se repite sin costuras.
    const pintura = (base, { oxido = 0.5, polvo = 0.5, saltos = 0.5 } = {}) => {
      const n = 256, [c, x] = lienzo(n);
      x.fillStyle = base; x.fillRect(0, 0, n, n);
      const rep = (fn) => { for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) fn(ox, oy); };
      for (let i = 0; i < 26; i++) {
        const px = rnd() * n, py = rnd() * n, r = 18 + rnd() * 60, cl = rnd() < 0.5 ? '255,255,255' : '0,0,0', a = 0.03 + rnd() * 0.05;
        rep((ox, oy) => { const gr = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); gr.addColorStop(0, `rgba(${cl},${a})`); gr.addColorStop(1, `rgba(${cl},0)`); x.fillStyle = gr; x.fillRect(px + ox - r, py + oy - r, 2 * r, 2 * r); });
      }
      for (let i = 0; i < 900 * polvo; i++) { const v = 40 + rnd() * 60; x.fillStyle = `rgba(${v + 22},${v + 14},${v},${0.05 + rnd() * 0.12})`; x.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 2, 1 + rnd() * 2); }
      for (let i = 0; i < 40 * oxido; i++) {
        const px = rnd() * n, py = rnd() * n, L = 20 + rnd() * 90, w = 1 + rnd() * 2.5, a = 0.22 + rnd() * 0.28;
        rep((ox, oy) => { const gr = x.createLinearGradient(0, py + oy, 0, py + oy + L); gr.addColorStop(0, `rgba(122,62,28,${a})`); gr.addColorStop(1, 'rgba(122,62,28,0)'); x.fillStyle = gr; x.fillRect(px + ox, py + oy, w, L); });
      }
      for (let i = 0; i < 70 * saltos; i++) {
        const px = rnd() * n, py = rnd() * n, r = 0.8 + rnd() * 2.8, e = 0.6 + rnd(), giro = rnd() * 3, metal = rnd() < 0.35;
        rep((ox, oy) => { x.beginPath(); x.ellipse(px + ox, py + oy, r * e, r, giro, 0, TAU); x.fillStyle = metal ? 'rgba(150,150,146,0.9)' : 'rgba(128,58,36,0.85)'; x.fill(); });
      }
      x.lineCap = 'round';
      for (let i = 0; i < 45; i++) {
        const px = rnd() * n, py = rnd() * n, a = rnd() * TAU, L = 4 + rnd() * 22, al = 0.15 + rnd() * 0.25, w = 0.6 + rnd() * 0.6;
        rep((ox, oy) => { x.strokeStyle = `rgba(235,235,230,${al})`; x.lineWidth = w; x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(px + ox + Math.cos(a) * L, py + oy + Math.sin(a) * L); x.stroke(); });
      }
      return texDe(c);
    };
    const nrmMetal = kit.makeSurface('metal', { size: 256, seed: 12, repeat: [1, 1], roughness: false }).normalMap;
    const pint = (base, opc, rough = 0.55, metal = 0.2, nrm = 0.3) => new THREE.MeshStandardMaterial({ map: pintura(base, opc), normalMap: nrmMetal, normalScale: new THREE.Vector2(nrm, nrm), roughness: rough, metalness: metal });

    // planchas soldadas del manto: 18 planchas por sector y 6 virolas, con polvo y manchas de agua bajo cada costura
    const planchas = (() => {
      const [c, x] = lienzo(128, 512);
      x.fillStyle = 'rgb(226,229,227)'; x.fillRect(0, 0, 128, 512);
      for (let i = 0; i < 260; i++) { const v = 200 + rnd() * 50; x.fillStyle = `rgba(${v},${v},${v - 4},0.25)`; x.fillRect(rnd() * 128, rnd() * 512, 2 + rnd() * 14, 2 + rnd() * 30); }
      for (let k = 0; k < 6; k++) {
        const y0 = Math.round((512 * k) / 6);
        for (let i = 0; i < 10; i++) {
          const px = rnd() * 126, L = 10 + rnd() * 62, w = 1 + rnd() * 3, a = 0.06 + rnd() * 0.16, oxido = rnd() < 0.3;
          const gr = x.createLinearGradient(0, y0, 0, y0 + L);
          gr.addColorStop(0, oxido ? `rgba(140,74,36,${a + 0.08})` : `rgba(118,100,80,${a})`); gr.addColorStop(1, 'rgba(118,100,80,0)');
          x.fillStyle = gr; x.fillRect(px, y0 + 2, w, L);
        }
      }
      const gr = x.createLinearGradient(0, 360, 0, 512); gr.addColorStop(0, 'rgba(92,86,74,0)'); gr.addColorStop(1, 'rgba(92,86,74,0.26)');
      x.fillStyle = gr; x.fillRect(0, 360, 128, 152);
      for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(80,74,64,${0.04 + rnd() * 0.1})`; x.fillRect(rnd() * 128, rnd() * 512, 1, 1 + rnd() * 2); }
      x.fillStyle = 'rgba(120,124,124,0.85)'; x.fillRect(0, 0, 2, 512);
      for (let k = 0; k < 6; k++) x.fillRect(0, Math.round((512 * k) / 6), 128, 2);
      const t = texDe(c); t.repeat.set(18, 1);
      return t;
    })();

    // ------------------------------------------------------------ materiales
    const chapa = kit.mat('metal', { repeat: [18, 1], color: 0xe6ebe7, metalness: 0.05, normalScale: 0.15 });   // pintura exterior
    chapa.roughnessMap = null; chapa.roughness = 0.62; chapa.map = planchas;
    const chapaInt = kit.mat('metal', { repeat: [18, 1], color: 0xc8d2d2, metalness: 0.02, normalScale: 0.12 }); // revestimiento interior
    chapaInt.roughnessMap = null; chapaInt.roughness = 0.7; chapaInt.map = planchas.clone(); chapaInt.map.repeat.set(18, -1);
    const corteMat = sinSombra(new THREE.MeshStandardMaterial({ color: 0xc0573e, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }));   // canto cortado
    const acero = pint('#8b979d', { oxido: 0.7, polvo: 0.6 }, 0.6, 0.25);
    const amarillo = pint('#d9a52a', { oxido: 0.35, saltos: 1 }, 0.5, 0.15);
    amarillo.side = THREE.DoubleSide; // el zócalo del pasillo es una lámina abierta
    const tuboMat = pint('#3f6f96', { oxido: 0.55, saltos: 0.6 }, 0.45, 0.15);
    const valvulaMat = pint('#294a69', { oxido: 0.3, polvo: 0.7 }, 0.42, 0.25);
    const bombaMat = pint('#3c6a50', { oxido: 0.3, polvo: 0.8 }, 0.42, 0.2);
    const galv = sinSombra(pint('#aeb3b5', { oxido: 0.12, saltos: 0.1, polvo: 0.6 }, 0.42, 0.55)); // pernos, postes y piezas menudas
    const rojo = pint('#b4382c', { oxido: 0.2, saltos: 0.9 }, 0.45, 0.15);
    const motorMat = kit.mat('ribbed', { repeat: [6, 1], color: 0x8597a6, metalness: 0.3, normalScale: 0.9 });  // aletas de enfriamiento
    const negro = sinSombra(new THREE.MeshStandardMaterial({ color: 0x1f2123, roughness: 0.82 }));
    const concreto = kit.mat('concrete', { repeat: [1, 1], color: 0xcac6bd, normalScale: 0.7 });

    // ------------------------------------------------------------ rótulos en un solo lienzo de 512 × 512
    const R = {
      placa: [0, 0, 384, 150], peligro: [0, 150, 128, 310], acceso: [128, 150, 288, 278],
      v101: [288, 150, 384, 182], b101: [288, 182, 384, 214], li101: [288, 214, 384, 246], v102: [288, 246, 384, 278],
      posicion: [0, 310, 100, 410], manometro: [100, 310, 200, 410], agua: [200, 310, 264, 512], tablero: [264, 310, 384, 360],
      pantalla: [264, 362, 384, 442], reglaA: [384, 0, 448, 512], reglaB: [448, 0, 512, 512], blancas: [0, 412, 16, 512],
    };
    const atlas = (() => {
      const [c, x] = lienzo(512);
      x.fillStyle = '#c9cdcc'; x.fillRect(0, 0, 512, 512);
      const txt = (t, px, py, size, color = '#16202a', weight = 700, align = 'center') => { x.fillStyle = color; x.font = kit.font(size, weight); x.textAlign = align; x.textBaseline = 'middle'; x.fillText(t, px, py); };
      const caja = ([x0, y0, x1, y1], fondo, borde = null, gb = 3) => { x.fillStyle = fondo; x.fillRect(x0, y0, x1 - x0, y1 - y0); if (borde) { x.strokeStyle = borde; x.lineWidth = gb; x.strokeRect(x0 + gb / 2, y0 + gb / 2, x1 - x0 - gb, y1 - y0 - gb); } };
      const sucio = ([x0, y0, x1, y1], n = 60) => { for (let i = 0; i < n; i++) { x.fillStyle = `rgba(96,80,60,${0.04 + rnd() * 0.1})`; x.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 1 + rnd() * 3, 1 + rnd() * 3); } };
      const remache = (px, py) => { x.fillStyle = '#9aa0a2'; x.beginPath(); x.arc(px, py, 3.2, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.arc(px - 1, py - 1, 1.2, 0, TAU); x.fill(); };
      // placa del estanque
      caja(R.placa, '#f1f0e9', '#1d4f7c', 4);
      x.fillStyle = '#1d4f7c'; x.fillRect(0, 0, 384, 42);
      txt('ESTANQUE ELEVADO TK-01', 192, 22, 23, '#ffffff', 800);
      txt('Agua · cono invertido de acero', 192, 62, 17, '#16202a', 600);
      txt('Altura 10 m · Radio 15 m', 192, 88, 18, '#16202a', 700);
      txt('Capacidad 2.356 m³ · Salida 1 m³/s', 192, 116, 16, '#16202a', 600);
      for (const [px, py] of [[10, 52], [374, 52], [10, 140], [374, 140]]) remache(px, py);
      { const gr = x.createLinearGradient(0, 140, 0, 150); gr.addColorStop(0, 'rgba(130,70,34,0)'); gr.addColorStop(1, 'rgba(130,70,34,0.35)'); x.fillStyle = gr; x.fillRect(4, 138, 376, 10); }
      sucio(R.placa, 120);
      // peligro en la escalera
      caja(R.peligro, '#f6f5f0', '#111111', 3);
      x.fillStyle = '#c8202a'; x.fillRect(3, 153, 122, 40);
      txt('PELIGRO', 64, 174, 22, '#ffffff', 800);
      ['Escalera de gato', 'Subir solo con', 'arnés y línea', 'de vida'].forEach((t, i) => txt(t, 64, 214 + i * 22, 14, '#111111', 700));
      sucio(R.peligro, 50);
      // acceso restringido en el cerco
      caja(R.acceso, '#f6f5f0', '#1b5aa8', 3);
      x.fillStyle = '#1b5aa8'; x.fillRect(128, 150, 160, 48);
      txt('ACCESO', 208, 164, 17, '#ffffff', 800); txt('RESTRINGIDO', 208, 184, 17, '#ffffff', 800);
      ['Solo personal autorizado', 'Uso obligatorio de', 'casco y chaleco'].forEach((t, i) => txt(t, 208, 218 + i * 19, 12.5, '#111111', 700));
      sucio(R.acceso, 50);
      // placas de identificación
      for (const [r, a, b] of [[R.v101, 'V-101', 'ENTRADA'], [R.b101, 'B-101', 'BOMBA'], [R.li101, 'LI-101', 'NIVEL'], [R.v102, 'V-102', 'SALIDA']]) {
        caja(r, '#e6c13a', '#1a1a1a', 2);
        txt(a, (r[0] + r[2]) / 2, r[1] + 11, 14, '#111111', 800); txt(b, (r[0] + r[2]) / 2, r[1] + 24, 10.5, '#111111', 700);
      }
      // indicador de posición del reductor (C cerrada, A abierta)
      caja(R.posicion, '#2a2d30');
      x.fillStyle = '#e9ebe6'; x.beginPath(); x.arc(50, 360, 46, 0, TAU); x.fill();
      x.lineWidth = 9; x.strokeStyle = '#c8202a'; x.beginPath(); x.arc(50, 362, 34, Math.PI, Math.PI * 1.35); x.stroke();
      x.strokeStyle = '#2f9a4c'; x.beginPath(); x.arc(50, 362, 34, Math.PI * 1.65, TAU); x.stroke();
      x.strokeStyle = '#222'; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; x.beginPath(); x.moveTo(50 + Math.cos(a) * 26, 362 + Math.sin(a) * 26); x.lineTo(50 + Math.cos(a) * 31, 362 + Math.sin(a) * 31); x.stroke(); }
      txt('C', 14, 374, 13, '#c8202a', 800); txt('A', 86, 374, 13, '#2f9a4c', 800); txt('V-101', 50, 390, 10, '#333', 700);
      // manómetro de 0 a 10 bar
      caja(R.manometro, '#1d1f21');
      x.fillStyle = '#f7f7f2'; x.beginPath(); x.arc(150, 360, 46, 0, TAU); x.fill();
      x.lineWidth = 7; x.strokeStyle = '#c8202a'; x.beginPath(); x.arc(150, 360, 38, -Math.PI / 2 + (0.8 * 1.5 - 0.75) * Math.PI, -Math.PI / 2 + 0.75 * Math.PI); x.stroke();
      x.strokeStyle = '#111'; x.lineCap = 'butt';
      for (let i = 0; i <= 50; i++) {
        const fi = (-135 + i * 5.4) * (Math.PI / 180), r1 = i % 5 === 0 ? 30 : 35;
        x.lineWidth = i % 5 === 0 ? 2 : 1; x.beginPath(); x.moveTo(150 + Math.sin(fi) * r1, 360 - Math.cos(fi) * r1); x.lineTo(150 + Math.sin(fi) * 41, 360 - Math.cos(fi) * 41); x.stroke();
        if (i % 10 === 0) txt(String(i / 5), 150 + Math.sin(fi) * 22, 360 - Math.cos(fi) * 22, 9.5, '#111', 700);
      }
      txt('bar', 150, 378, 9, '#333', 600);
      // marca de tubería: agua cruda con flecha en el sentido del flujo
      caja(R.agua, '#2f7d4a');
      x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(232, 316); x.lineTo(252, 346); x.lineTo(212, 346); x.closePath(); x.fill();
      x.fillRect(226, 346, 12, 24);
      x.save(); x.translate(232, 440); x.rotate(-Math.PI / 2); txt('AGUA CRUDA', 0, 0, 19, '#ffffff', 800); x.restore();
      // tablero eléctrico
      caja(R.tablero, '#f3f3ee', '#111', 2);
      x.fillStyle = '#f2c230'; x.beginPath(); x.moveTo(286, 316); x.lineTo(304, 352); x.lineTo(268, 352); x.closePath(); x.fill();
      x.strokeStyle = '#111'; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#111'; x.beginPath(); x.moveTo(289, 326); x.lineTo(281, 340); x.lineTo(287, 340); x.lineTo(283, 350); x.lineTo(292, 336); x.lineTo(286, 336); x.closePath(); x.fill();
      txt('TABLERO B-101', 344, 326, 11, '#111', 800); txt('380 V · bomba', 344, 344, 10.5, '#111', 600);
      // pantalla de la tableta: tendencia del nivel
      caja(R.pantalla, '#0f1b26');
      txt('LI-101 · nivel h', 270, 372, 10, '#9fd8ff', 700, 'left');
      x.strokeStyle = 'rgba(159,216,255,0.25)'; x.lineWidth = 1; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(270, 388 + i * 14); x.lineTo(378, 388 + i * 14); x.stroke(); }
      x.strokeStyle = '#5cc8ff'; x.lineWidth = 2.5; x.beginPath(); for (let i = 0; i <= 20; i++) { const px = 270 + i * 5.4, py = 432 - 40 * Math.cbrt(i / 20); if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke();
      x.fillStyle = '#ffb347'; x.fillRect(270, 404, 108, 1.5);
      // banderas blancas del indicador: 20 aletas de 2,5 cm en 0,5 m
      caja(R.blancas, '#f1f1ec'); x.fillStyle = 'rgba(60,60,60,0.55)'; for (let i = 0; i < 20; i++) x.fillRect(0, 412 + i * 5 + 4, 16, 1);
      // regla del indicador de nivel: dos columnas de 5 m (marcas cada 10 cm, números cada metro)
      for (let k = 0; k < 2; k++) {
        const x0 = 384 + k * 64;
        x.fillStyle = '#f2f2ec'; x.fillRect(x0, 0, 64, 512);
        x.fillStyle = '#111';
        for (let i = 0; i <= 50; i++) {
          const y = 512 - i * 10.24, metro = i % 10 === 0, medio = i % 5 === 0;
          x.fillRect(x0, Math.round(y) - (metro ? 2 : 1), metro ? 30 : medio ? 21 : 12, metro ? 4 : 2);
          if (metro && !(k === 1 && i === 0)) {
            const yy = Math.min(504, Math.max(8, y));
            x.save(); x.translate(x0 + 47, yy); x.scale(1, 0.42); txt(String(k * 5 + i / 10), 0, 0, 25, '#111', 800); x.restore();
          }
        }
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(x0 + 62, 0, 2, 512);
        sucio([x0, 0, x0 + 64, 512], 90);
      }
      return texDe(c);
    })();
    atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
    const rotMat = sinSombra(new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.55, metalness: 0.05 }));
    const enRegion = (geo, [x0, y0, x1, y1]) => {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / 512, 1 - (y1 - uv.getY(i) * (y1 - y0)) / 512);
      return geo;
    };
    const cartel = (reg, w, h) => enRegion(new THREE.PlaneGeometry(w, h), reg);

    // ------------------------------------------------------------ explanada de grava hasta el cerco (sin salir del cerco de la obra)
    // El cerco perimetral de la obra es un círculo de 88 m de radio centrado en (10, 10) del mundo.
    const sitio = esc.worldToLocal(V(10, 0, 10));
    const alCerco = (a) => { const dx = Math.sin(a), dz = Math.cos(a), b = dx * sitio.x + dz * sitio.z; return b + Math.sqrt(Math.max(0, b * b - sitio.x * sitio.x - sitio.z * sitio.z + 88 * 88)); };
    const gravaMat = sinSombra(kit.mat('gravel', { repeat: [1, 1], color: 0xc4baa6, normalScale: 0.6 }));
    gravaMat.polygonOffset = true; gravaMat.polygonOffsetFactor = -4; gravaMat.polygonOffsetUnits = -4;
    {
      const n = 120, pos = [0, 0, 0], uv = [0, 0], idx = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU, r = Math.min(RF - 0.4, alCerco(a) - 0.7);
        pos.push(Math.sin(a) * r, 0, Math.cos(a) * r); uv.push((Math.sin(a) * r) / 3.6, (Math.cos(a) * r) / 3.6);
      }
      for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      geo.computeVertexNormals();
      pieza(geo, gravaMat, mtx(0, 0.025, 0));
    }

    // ------------------------------------------------------------ estructura: fundaciones, columnas, vigas y diagonales
    const angCol = Array.from({ length: 8 }, (_, k) => Math.PI / 8 + (k * Math.PI) / 4);
    const perfilI = (L) => kit.mergeGeometries([
      cajaG(0.4, L, 0.028).translate(0, L / 2, 0.186), cajaG(0.4, L, 0.028).translate(0, L / 2, -0.186), cajaG(0.018, L, 0.344).translate(0, L / 2, 0),
    ].map(preparar));
    {
      const perno = preparar(kit.mergeGeometries([new THREE.CylinderGeometry(0.022, 0.022, 0.14, 6).translate(0, 0.07, 0), new THREE.CylinderGeometry(0.045, 0.045, 0.035, 6).translate(0, 0.03, 0)].map(preparar)));
      const columna = perfilI(Y_VIGA - 0.66);
      for (const a of angCol) {
        const [px, , pz] = pol(a, RC);
        pieza(cajaG(1.0, 0.62, 1.0, 1.5), concreto, mtx(px, 0.31, pz, 0, a, 0));
        pieza(cajaG(0.72, 0.04, 0.72), acero, mtx(px, 0.64, pz, 0, a, 0));
        pieza(columna, acero, mtx(px, 0.66, pz, 0, a, 0));
        for (const [dx, dz] of [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]]) {
          const ca = Math.cos(a), sa = Math.sin(a);
          pieza(perno, galv, mtx(px + dx * ca + dz * sa, 0.66, pz - dx * sa + dz * ca));
        }
        for (const lado of [-1, 1]) pieza(cajaG(0.012, 0.3, 0.2), acero, mtx(px + Math.cos(a) * lado * 0.1, 0.81, pz - Math.sin(a) * lado * 0.1, 0, a, 0)); // cartelas
      }
    }
    // vigas horizontales entre columnas: los tres vanos de adelante quedan como pórticos libres para que no tapen el corte
    for (const y of [4.6, 8.4]) angCol.forEach((a, k) => { if (k === 0 || k >= 6) return; viga(pol(a, RC, y), pol(angCol[(k + 1) % 8], RC, y), 0.3, 0.2, acero); });
    // diagonales en cruz solo en los vanos de los costados y de atrás
    {
      const niveles = [0.66, 4.6, 8.4, Y_VIGA];
      angCol.forEach((a, k) => {
        const b = angCol[(k + 1) % 8], centro = (a + b) / 2 + (k === 7 ? Math.PI : 0);
        if (Math.cos(centro) > 0.05) return;
        for (let n = 0; n < 3; n++) {
          barra(pol(a, RC + 0.24, niveles[n]), pol(b, RC + 0.24, niveles[n + 1]), 0.032, acero, { seg: 6 });
          barra(pol(b, RC + 0.24, niveles[n]), pol(a, RC + 0.24, niveles[n + 1]), 0.032, acero, { seg: 6 });
        }
      });
    }
    // viga anular bajo el borde del cono
    torno(15.5, Y_VIGA, 15.5, YB - 0.03, acero);
    torno(15.0, YB - 0.03, 15.0, Y_VIGA, acero);
    torno(15.0, Y_VIGA, 15.5, Y_VIGA, acero);

    // ------------------------------------------------------------ manto cónico de acero con el corte frontal
    torno(15.0, YB, 0.3, YV + 0.2, chapaInt, SECTOR);                 // cara interior
    torno(0.3 + ESP, YV + 0.2, 15.0 + ESP, YB, chapa, SECTOR);        // cara exterior
    torno(15.0 + ESP, YB, 15.0, YB, chapa, SECTOR);                   // canto superior
    for (const y of [YV + 3.6, YV + 7.0]) {                            // anillos rigidizadores
      const r = 1.5 * (y - YV) + ESP;
      torno(r + 0.17, y + 0.012, r, y + 0.012, chapa, SECTOR);
      torno(r, y - 0.012, r + 0.17, y - 0.012, chapa, SECTOR);
      torno(r + 0.17, y - 0.012, r + 0.17, y + 0.012, chapa, SECTOR);
    }
    {
      const pc = [];
      for (const a of [CORTE, TAU - CORTE]) {
        const sa = Math.sin(a), ca = Math.cos(a);
        const ib = [sa * 0.3, YV + 0.2, ca * 0.3], it = [sa * 15, YB, ca * 15], ot = [sa * (15 + ESP), YB, ca * (15 + ESP)], ob = [sa * (0.3 + ESP), YV + 0.2, ca * (0.3 + ESP)];
        pc.push(...ib, ...it, ...ot, ...ib, ...ot, ...ob);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pc, 3)); geo.computeVertexNormals();
      kit.malla(geo, corteMat, { padre: esc });
    }

    // ------------------------------------------------------------ pasillo perimetral con baranda
    const rejillaTex = (() => {
      const [c, x] = lienzo(64);
      x.fillStyle = '#3b4146'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#9aa2a8'; for (let i = 0; i < 64; i += 8) x.fillRect(i, 0, 3, 64);
      x.fillStyle = '#7d858b'; for (let j = 0; j < 64; j += 21) x.fillRect(0, j, 64, 3);
      const t = texDe(c); t.repeat.set(170, 2);
      return t;
    })();
    const rejilla = new THREE.MeshStandardMaterial({ map: rejillaTex, roughness: 0.6, metalness: 0.5 });
    torno(16.25, Y_PASILLO, 15.0, Y_PASILLO, rejilla);
    torno(15.5, Y_PASILLO - 0.04, 16.25, Y_PASILLO - 0.04, acero);
    torno(16.25, Y_PASILLO - 0.04, 16.25, Y_PASILLO, acero);
    const hueco = 0.95 / 16.2; // paso de la escalera
    {
      const poste = new THREE.BoxGeometry(0.05, 1.1, 0.05), n = 64;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, da = Math.atan2(Math.sin(a - A_ESCALA), Math.cos(a - A_ESCALA));
        if (Math.abs(da) < hueco * 0.75) continue;
        pieza(poste, amarillo, mtx(...pol(a, 16.2, Y_PASILLO + 0.55)));
      }
      for (const d of [hueco / 2, -hueco / 2]) pieza(poste, amarillo, mtx(...pol(A_ESCALA + d, 16.2, Y_PASILLO + 0.55)));
      const th0 = Math.PI / 2 - A_ESCALA + hueco / 2; // ángulo del toro equivalente al borde del paso
      for (const y of [Y_PASILLO + 1.08, Y_PASILLO + 0.55]) {
        const rail = kit.malla(new THREE.TorusGeometry(16.2, 0.024, 6, 220, TAU - hueco), amarillo, { y, padre: esc });
        rail.rotation.set(Math.PI / 2, 0, th0);
      }
      kit.malla(new THREE.CylinderGeometry(16.22, 16.22, 0.1, 180, 1, true, A_ESCALA + hueco / 2, TAU - hueco), amarillo, { y: Y_PASILLO + 0.05, padre: esc });
    }

    // ------------------------------------------------------------ escalera de gato con jaula y letrero de peligro
    {
      const esca = new THREE.Group(); esca.rotation.y = A_ESCALA; esc.add(esca);
      const ZL = 16.6, top = Y_PASILLO + 1.15;
      for (const x of [-0.22, 0.22]) kit.caja(0.065, top, 0.014, amarillo, { x, y: top / 2, z: ZL, padre: esca });
      const pel = new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8); pel.rotateZ(Math.PI / 2);
      const n = Math.floor((Y_PASILLO - 0.1) / 0.3);
      for (let i = 0; i < n; i++) pieza(pel, amarillo, mtx(0, 0.3 * (i + 1), ZL), { en: esca });
      const lado = Math.hypot(0.16, 0.34), giroLado = Math.atan2(0.16, 0.34);
      const aro = kit.mergeGeometries([
        new THREE.TorusGeometry(0.38, 0.016, 5, 18, Math.PI).rotateX(Math.PI / 2).translate(0, 0, 0.34),
        new THREE.BoxGeometry(0.012, 0.035, lado).rotateY(-giroLado).translate(-0.3, 0, 0.17),
        new THREE.BoxGeometry(0.012, 0.035, lado).rotateY(giroLado).translate(0.3, 0, 0.17),
      ].map(preparar));
      for (let y = 2.4; y < top - 0.05; y += 0.85) pieza(aro, amarillo, mtx(0, y, ZL), { en: esca });
      for (const th of [0.15, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI - 0.15]) {
        const fl = kit.caja(0.045, top - 2.4, 0.01, amarillo, { x: 0.38 * Math.cos(th), y: (top + 2.4) / 2, z: ZL + 0.34 + 0.38 * Math.sin(th), padre: esca });
        fl.rotation.y = -th + Math.PI / 2;
      }
      for (const y of [1.6, 4.6, 7.6, 10.6]) for (const x of [-0.22, 0.22]) kit.caja(0.05, 0.08, ZL - RC - 0.2, amarillo, { x, y, z: (ZL + RC + 0.2) / 2, padre: esca });
      // letrero colgado del primer aro de la jaula
      pieza(cajaG(0.4, 0.5, 0.012), galv, mtx(0, 2.1, ZL + 0.735), { en: esca });
      pieza(cartel(R.peligro, 0.38, 0.475), rotMat, mtx(0, 2.1, ZL + 0.742), { en: esca });
      for (const x of [-0.12, 0.12]) barra([x, 2.35, ZL + 0.73], [x, 2.42, ZL + 0.72], 0.006, galv, { en: esca, seg: 5 });
    }

    // ------------------------------------------------------------ placa del estanque en la columna de adelante a la izquierda
    {
      const a = angCol[7], [px, , pz] = pol(a, RC + 0.24);
      pieza(cajaG(1.56, 0.64, 0.02), galv, mtx(px, 2.05, pz, 0, a, 0));
      const [qx, , qz] = pol(a, RC + 0.252);
      pieza(cartel(R.placa, 1.5, 0.586), rotMat, mtx(qx, 2.05, qz, 0, a, 0));
    }

    // ------------------------------------------------------------ juntas bridadas con empaquetadura y pernos
    const juntas = new Map();
    const protoJunta = (r) => {
      let p = juntas.get(r);
      if (p) return p;
      const rb = r + Math.max(0.1, r * 0.17), nB = r > 0.5 ? 16 : 10, rp = (r + rb) / 2 + 0.008;
      const perno = preparar(new THREE.CylinderGeometry(0.026, 0.026, 0.2, 6, 1, true)); // espárrago con tuercas hexagonales
      p = {
        brida: kit.mergeGeometries([cilG(rb, rb, 0.05, 28).translate(0, 0.031, 0), cilG(rb, rb, 0.05, 28).translate(0, -0.031, 0)].map(preparar)),
        empaque: preparar(cilG(rb - 0.02, rb - 0.02, 0.012, 28, 1, true)),
        pernos: kit.mergeGeometries(Array.from({ length: nB }, (_, i) => { const a = ((i + 0.5) / nB) * TAU; return perno.clone().translate(Math.cos(a) * rp, 0, Math.sin(a) * rp); })),
      };
      juntas.set(r, p);
      return p;
    };
    const ROT_EJE = { x: [0, 0, Math.PI / 2], y: [0, 0, 0], z: [Math.PI / 2, 0, 0] };
    const junta = (en, p, eje, r = RT, mat = tuboMat) => {
      const j = protoJunta(r), m = mtx(...p, ...ROT_EJE[eje]);
      pieza(j.brida, mat, m, { en }); pieza(j.empaque, negro, m, { en }); pieza(j.pernos, galv, m, { en });
    };
    // marca de tubería pintada: dos medias bandas con el texto y la flecha en el sentido del flujo (+y de la banda)
    const banda = (en, p, rot, r = RT) => {
      for (const t0 of [0, Math.PI]) pieza(enRegion(new THREE.CylinderGeometry(r + 0.006, r + 0.006, 0.5, 18, 1, true, t0, Math.PI), R.agua), rotMat, mtx(...p, ...rot), { en });
    };

    // ------------------------------------------------------------ agua dentro del cono (se escala con h: los conos son semejantes)
    const aguaG = movil(new THREE.Group()); aguaG.position.y = YV; esc.add(aguaG);
    const espumaTex = (() => {
      const [c, x] = lienzo(128);
      x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 220; i++) {
        const px = rnd() * 128, py = rnd() * 128, r = 2 + rnd() * 9, a = 0.15 + rnd() * 0.5;
        for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) { x.beginPath(); x.arc(px + ox, py + oy, r, 0, TAU); x.fillStyle = `rgba(255,255,255,${a})`; x.fill(); }
      }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    })();
    const nrmSup = kit.makeSurface('noiseNormal', { size: 256, seed: 33, repeat: [3, 3], roughness: false }).normalMap;
    const uSup = { uImpacto: { value: new THREE.Vector2() }, uRadio: { value: 0.5 }, uHay: { value: 1 }, uTiempo: { value: 0 }, uTexEsp: { value: espumaTex } };
    const supMat = new THREE.MeshStandardMaterial({ color: 0x2c6f7f, roughness: 0.06, metalness: 0, normalMap: nrmSup, normalScale: new THREE.Vector2(0.55, 0.55), transparent: true, opacity: 0.88, envMapIntensity: 2.2, side: THREE.DoubleSide });
    supMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uSup);
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec2 vXZw;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vXZw = (modelMatrix * vec4(position, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec2 uImpacto;\nuniform float uRadio, uHay, uTiempo;\nuniform sampler2D uTexEsp;\nvarying vec2 vXZw;\nvoid main() {')
        .replace('#include <color_fragment>', `#include <color_fragment>
  float dEsp = length(vXZw - uImpacto);
  float mEsp = 1.0 - smoothstep(uRadio * 0.6, uRadio * 2.6 + 0.5, dEsp);
  float nEsp = texture2D(uTexEsp, vXZw * 0.35 + vec2(uTiempo * 0.11, -uTiempo * 0.07)).r + texture2D(uTexEsp, vXZw * 0.17 - vec2(uTiempo * 0.06, uTiempo * 0.1)).r;
  float espuma = clamp(mEsp * (0.3 + nEsp * 0.9), 0.0, 1.0) * uHay;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 0.95), espuma);
  diffuseColor.a = max(diffuseColor.a, espuma);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.75, espuma);');
    };
    {
      const n = 72, pos = [0, M.H, 0], uv = [0.5, 0.5], idx = [];
      for (let i = 0; i <= n; i++) { const a = CORTE + ((TAU - 2 * CORTE) * i) / n; pos.push(Math.sin(a) * M.R, M.H, Math.cos(a) * M.R); uv.push(0.5 + Math.sin(a) * 0.5, 0.5 + Math.cos(a) * 0.5); }
      for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      const sup = kit.malla(geo, supMat, { padre: aguaG, sombra: false });
      sup.renderOrder = 3;
    }
    {
      // las dos caras del corte muestran la sección del agua: más clara arriba y más oscura en el fondo
      const pos = [], col = [], hondo = [0.008, 0.05, 0.07], claro = [0.06, 0.24, 0.3];
      for (const a of [CORTE, TAU - CORTE]) { pos.push(0, 0, 0, 0, M.H, 0, Math.sin(a) * M.R, M.H, Math.cos(a) * M.R); col.push(...hondo, ...claro, ...claro); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const caras = kit.malla(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.93, side: THREE.DoubleSide, emissive: 0x0d3a46, emissiveIntensity: 0.55, envMapIntensity: 1.4 }), { padre: aguaG, sombra: false });
      caras.renderOrder = 2;
    }
    const celeste = new THREE.MeshBasicMaterial({ color: 0xbff0ff, toneMapped: false });
    const lineas = [kit.barra([0, 0, 0], [0, 1, 0], 0.03, celeste), kit.barra([0, 0, 0], [0, 1, 0], 0.03, celeste)];
    lineas.forEach(movil);
    esc.add(...lineas);

    // ------------------------------------------------------------ tubería de entrada: bomba, válvula, montante y boca con su chorro
    const ent = new THREE.Group(); ent.rotation.y = A_ENTRADA; esc.add(ent);
    esc.updateMatrixWorld(true);
    // montante, tramo superior sobre el borde y bajada a la boca
    barra([0, YL + 1.2, 0 + ZR], [0, 13.4, ZR], RT, tuboMat, { en: ent, seg: 28 });
    codo([0, 13.4, ZR - 1.2], [0, 0, 1], [0, 1, 0], 1.2, RT, tuboMat, ent);
    barra([0, 14.6, ZR - 1.2], [0, 14.6, 2.4], RT, tuboMat, { en: ent, seg: 28 });
    codo([0, 13.4, 2.4], [0, 1, 0], [0, 0, -1], 1.2, RT, tuboMat, ent);
    barra([0, 13.4, R_BOCA], [0, Y_BOCA, R_BOCA], RT, tuboMat, { en: ent, seg: 28 });
    for (const y of [4.2, 9.2]) junta(ent, [0, y, ZR], 'y');
    for (const z of [11.6, 6.4]) junta(ent, [0, 14.6, z], 'z');
    junta(ent, [0, Y_BOCA + 0.04, R_BOCA], 'y');
    banda(ent, [0, 3.4, ZR], [0, 0, 0]);
    banda(ent, [0, 14.6, 9.0], [-Math.PI / 2, 0, 0]);
    // ménsulas a la columna, apoyo sobre el pasillo y cercha bajo el tramo horizontal
    for (const y of [4.6, 8.4]) {
      pieza(cajaG(0.18, 0.2, 1.1), acero, mtx(0, y, 16.0), { en: ent });
      kit.malla(new THREE.TorusGeometry(RT + 0.03, 0.04, 6, 32), acero, { y, z: ZR, rx: Math.PI / 2, padre: ent });
    }
    pieza(cajaG(1.0, 13.8 - Y_PASILLO, 0.3), acero, mtx(0, (13.8 + Y_PASILLO) / 2, 15.3), { en: ent });
    {
      const cordon = [[0, 13.8, 15.2], [0, 12.95, 11.2], [0, 12.95, 6.4], [0, 13.8, 2.6]];
      for (let i = 0; i < 3; i++) barra(cordon[i], cordon[i + 1], 0.05, acero, { en: ent });
      for (const z of [11.2, 6.4]) barra([0, 12.95, z], [0, 13.82, z], 0.04, acero, { en: ent });
      barra([0, 12.95, 11.2], [0, 13.82, 8.8], 0.035, acero, { en: ent }); barra([0, 12.95, 6.4], [0, 13.82, 8.8], 0.035, acero, { en: ent });
    }
    // línea de impulsión junto al suelo: pozo de succión, bomba, retención, manómetro, válvula de mariposa y codo al montante
    {
      const en = ent;
      pieza(cajaG(14.5, Y_LOSA, 6.6, 2), concreto, mtx(5.65, Y_LOSA / 2, ZR + 0.6), { en });          // losa de la sala de bombas
      pieza(cajaG(2.6, 0.9, 1.9, 1.5), concreto, mtx(0.3, 0.45, ZR), { en });                          // dado de anclaje del codo
      codo([1.2, YL + 1.2, ZR], [-1, 0, 0], [0, -1, 0], 1.2, RT, tuboMat, en);
      barra([1.2, YL, ZR], [3.2, YL, ZR], RT, tuboMat, { en, seg: 32 });
      barra([3.7, YL, ZR], [5.3, YL, ZR], RT, tuboMat, { en, seg: 32 });
      barra([8.8, YL, ZR], [10.2, YL, ZR], RT, tuboMat, { en, seg: 32 });
      codo([10.2, YL - 1.2, ZR], [0, 1, 0], [1, 0, 0], 1.2, RT, tuboMat, en);                           // baja al pozo de succión
      for (const x of [1.2, 3.2, 3.7, 5.3, 6.0, 8.8, 10.2]) junta(en, [x, YL, ZR], 'x');
      banda(en, [2.75, YL, ZR], [0, 0, Math.PI / 2]);
      banda(en, [9.2, YL, ZR], [0, 0, Math.PI / 2]);
      // apoyos de hormigón con abrazadera
      for (const x of [2.25, 9.85]) {
        pieza(cajaG(0.5, 0.46, 1.4, 1), concreto, mtx(x, 0.23, ZR), { en });
        pieza(new THREE.CylinderGeometry(RT + 0.012, RT + 0.012, 0.07, 28, 1, true, 0, Math.PI), galv, mtx(x, YL, ZR, 0, 0, Math.PI / 2), { en });
        for (const lado of [-1, 1]) pieza(cajaG(0.1, 0.03, 0.12), galv, mtx(x, YL - 0.02, ZR + lado * (RT + 0.06)), { en });
      }
      // válvula de mariposa con reductor y volante
      pieza(cilG(RT + 0.17, RT + 0.17, 0.42, 40), valvulaMat, mtx(3.45, YL, ZR, 0, 0, Math.PI / 2), { en });
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; pieza(cajaG(0.4, 0.16, 0.16), valvulaMat, mtx(3.45, YL + Math.sin(a) * (RT + 0.2), ZR + Math.cos(a) * (RT + 0.2)), { en }); } // orejas
      pieza(cilG(0.14, 0.14, 0.22, 18), valvulaMat, mtx(3.45, YL, 16.22, Math.PI / 2, 0, 0), { en });   // cubo del eje hacia el reductor
      pieza(cilG(0.13, 0.13, 0.16, 18), valvulaMat, mtx(3.45, YL, 18.33, Math.PI / 2, 0, 0), { en });   // tapa del cojinete opuesto
      pieza(cajaG(0.46, 0.52, 0.6, 0.6), valvulaMat, mtx(3.35, 1.12, 15.82), { en });                  // reductor
      pieza(cajaG(0.5, 0.035, 0.64, 0.6), valvulaMat, mtx(3.35, 1.395, 15.82), { en });
      for (const dz of [-0.2, 0.2]) pieza(cajaG(0.012, 0.42, 0.06), valvulaMat, mtx(3.115, 1.1, 15.82 + dz), { en }); // nervios
      pieza(cilG(0.065, 0.065, 0.08, 18), galv, mtx(3.08, VY, VZ, 0, 0, Math.PI / 2), { en });          // collar del eje de entrada
      pieza(cilG(0.026, 0.026, 0.28, 10), galv, mtx(2.98, VY, VZ, 0, 0, Math.PI / 2), { en });
      pieza(cilG(0.12, 0.12, 0.03, 28), galv, mtx(3.35, 1.427, 15.82), { en });                         // caja del indicador de posición
      pieza(enRegion(new THREE.PlaneGeometry(0.2, 0.2).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2), R.posicion), rotMat, mtx(3.35, 1.4435, 15.82), { en });
      pieza(cartel(R.v101, 0.24, 0.08).rotateY(Math.PI), rotMat, mtx(3.35, 0.98, 15.515), { en });
      // manómetro en la descarga: toma lateral, llave de bola y caja con esfera
      barra([4.5, YL, ZR - RT + 0.02], [4.5, YL, 16.3], 0.018, galv, { en, seg: 8 });
      pieza(cajaG(0.05, 0.05, 0.07), galv, mtx(4.5, YL, 16.4), { en });
      pieza(cajaG(0.11, 0.012, 0.02), rojo, mtx(4.53, YL + 0.032, 16.4), { en });
      pieza(cilG(0.088, 0.088, 0.06, 28), negro, mtx(4.5, YL, 16.26, Math.PI / 2, 0, 0), { en });
      pieza(cartel(R.manometro, 0.17, 0.17).rotateY(Math.PI), rotMat, mtx(4.5, YL, 16.228), { en });
      // válvula de retención
      pieza(cilG(RT + 0.1, RT + 0.1, 0.6, 36), valvulaMat, mtx(5.65, YL, ZR, 0, 0, Math.PI / 2), { en });
      pieza(cilG(0.42, 0.42, 0.24, 24), valvulaMat, mtx(5.65, YL + RT + 0.1, ZR), { en });
      pieza(cilG(0.48, 0.48, 0.05, 24), valvulaMat, mtx(5.65, YL + RT + 0.24, ZR), { en });
      pieza(protoJunta(0.36).pernos, galv, mtx(5.65, YL + RT + 0.22, ZR), { en });
      pieza(cilG(0.08, 0.08, 2 * RT + 0.5, 12), galv, mtx(5.5, YL + 0.5, ZR, Math.PI / 2, 0, 0), { en }); // pasador de la clapeta
      // bomba de carcasa partida con motor
      const XP = 7.4;
      pieza(cilG(RT, 0.94, 0.65, 36), bombaMat, mtx(6.325, YL, ZR, 0, 0, -Math.PI / 2), { en });        // tobera de descarga
      pieza(cilG(RT, 0.94, 0.65, 36), bombaMat, mtx(8.475, YL, ZR, 0, 0, Math.PI / 2), { en });          // tobera de succión
      pieza(cilG(1.02, 1.02, 1.3, 44), bombaMat, mtx(XP, YL, ZR, Math.PI / 2, 0, 0), { en });            // voluta
      pieza(cilG(0.7, 0.7, 1.2, 32), bombaMat, mtx(XP, YL + 0.45, ZR, Math.PI / 2, 0, 0), { en });       // lomo de la voluta
      pieza(cajaG(2.3, 0.07, 1.46, 1), bombaMat, mtx(XP, YL, ZR), { en });                               // brida de la carcasa partida
      {
        const perno = new THREE.CylinderGeometry(0.024, 0.024, 0.16, 6);
        for (let x = 6.42; x < 8.45; x += 0.29) for (const dz of [-0.68, 0.68]) pieza(perno, galv, mtx(x, YL + 0.04, ZR + dz), { en });
      }
      for (const dz of [-0.82, 0.82]) pieza(cilG(0.26, 0.26, 0.34, 22), bombaMat, mtx(XP, YL, ZR + dz, Math.PI / 2, 0, 0), { en }); // cajas de rodamientos
      for (const x of [6.55, 8.25]) pieza(cajaG(0.3, 0.75, 1.0), bombaMat, mtx(x, 0.835, ZR), { en });  // patas de la carcasa
      pieza(cilG(0.075, 0.075, 0.4, 12), galv, mtx(XP, YL, 18.45, Math.PI / 2, 0, 0), { en });          // eje
      pieza(cilG(0.36, 0.36, 0.62, 24), amarillo, mtx(XP, YL, 18.92, Math.PI / 2, 0, 0), { en });        // protección del acoplamiento
      pieza(new THREE.CylinderGeometry(0.68, 0.68, 1.8, 48).rotateX(Math.PI / 2), motorMat, mtx(XP, YL, 20.13), { en }); // motor
      for (const z of [19.21, 21.05]) pieza(cilG(0.71, 0.71, 0.05, 40), valvulaMat, mtx(XP, YL, z, Math.PI / 2, 0, 0), { en });
      pieza(cilG(0.6, 0.6, 0.32, 40), negro, mtx(XP, YL, 21.2, Math.PI / 2, 0, 0), { en });             // tapa del ventilador
      pieza(cajaG(0.42, 0.28, 0.48), valvulaMat, mtx(XP, YL + 0.8, 19.75), { en });                      // caja de conexiones
      for (const z of [19.5, 20.75]) pieza(new THREE.TorusGeometry(0.06, 0.016, 6, 14).rotateY(Math.PI / 2), galv, mtx(XP, YL + 0.74, z), { en });
      for (const dx of [-0.5, 0.5]) pieza(cajaG(0.16, 0.14, 1.5), acero, mtx(XP + dx, 0.53, 20.13), { en });
      pieza(cajaG(2.6, 0.3, 5.4, 1.5), concreto, mtx(XP, 0.15, 18.55), { en });                          // pedestal
      for (const x of [6.55, 8.25]) pieza(cajaG(0.18, 0.16, 5.2), acero, mtx(x, 0.38, 18.55), { en });  // bancada
      for (const z of [16.2, 19.5, 20.8]) pieza(cajaG(1.7, 0.16, 0.18), acero, mtx(XP, 0.38, z), { en });
      pieza(cartel(R.b101, 0.3, 0.1).rotateY(Math.PI), rotMat, mtx(XP, 0.17, 15.845), { en });
      // pozo de succión con tapa de inspección
      pieza(cajaG(2.4, 0.38, 3.3, 1.5), concreto, mtx(11.5, 0.19, ZR - 0.25), { en });
      pieza(cilG(0.37, 0.37, 0.03, 32), acero, mtx(11.9, 0.395, 15.85), { en });
      pieza(cilG(0.3, 0.3, 0.008, 32), negro, mtx(11.9, 0.413, 15.85), { en });
      // tablero eléctrico sobre patas, con su canalización hasta la caja de conexiones del motor
      pieza(cajaG(0.8, 1.1, 0.32, 1), galv, mtx(9.6, 1.17, 15.12), { en });
      pieza(cajaG(0.86, 0.04, 0.4, 1), galv, mtx(9.6, 1.74, 15.12), { en });
      for (const x of [9.3, 9.9]) pieza(cajaG(0.06, 0.5, 0.06), acero, mtx(x, 0.37, 15.12), { en });
      pieza(cajaG(0.006, 1.02, 0.004), negro, mtx(9.6, 1.17, 14.958), { en });
      pieza(cajaG(0.03, 0.12, 0.03), negro, mtx(9.9, 1.2, 14.95), { en });
      pieza(cartel(R.tablero, 0.36, 0.15).rotateY(Math.PI), rotMat, mtx(9.6, 1.5, 14.955), { en });
      {
        const ruta = [[9.6, 0.62, 15.15], [9.6, 0.24, 15.25], [9.55, 0.17, 15.7], [8.85, 0.17, 16.3], [8.85, 0.17, 19.3], [8.8, 0.4, 19.6], [8.2, 1.85, 19.75], [7.62, 2.0, 19.75]];
        const curva = new THREE.CatmullRomCurve3(ruta.map((p) => V(...p)), false, 'catmullrom', 0.2);
        pieza(new THREE.TubeGeometry(curva, 48, 0.024, 6, false), negro, null, { en });
      }
    }
    // chorro que cae por la boca
    const vetaTex = (horizontal) => {
      const [c, x] = lienzo(horizontal ? 256 : 64, horizontal ? 64 : 256);
      x.fillStyle = 'rgb(196,222,232)'; x.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < 110; i++) {
        const p = rnd() * 64, w = 1 + rnd() * 3, q0 = rnd() * 256, len = 30 + rnd() * 140, br = rnd() < 0.7;
        x.fillStyle = br ? `rgba(255,255,255,${0.3 + rnd() * 0.55})` : `rgba(90,130,150,${0.15 + rnd() * 0.3})`;
        for (const o of [-256, 0]) { if (horizontal) x.fillRect(q0 + o, p, len, w); else x.fillRect(p, q0 + o, w, len); }
      }
      return texDe(c);
    };
    const vetaV = vetaTex(false); vetaV.repeat.set(3, 1.6);
    const chorroMat = new THREE.MeshStandardMaterial({ map: vetaV, transparent: true, opacity: 0.86, roughness: 0.2, metalness: 0, emissive: 0x6f8f9a, emissiveIntensity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const chorroGeo = new THREE.CylinderGeometry(1, 0.8, 1, 28, 6, true); chorroGeo.translate(0, -0.5, 0);
    const chorro = movil(kit.malla(chorroGeo, chorroMat, { y: Y_BOCA, z: R_BOCA, padre: ent, sombra: false }));
    chorro.renderOrder = 4;
    esc.updateMatrixWorld(true);
    { const w = ent.localToWorld(V(0, 0, R_BOCA)); uSup.uImpacto.value.set(w.x, w.z); }

    // volante de la válvula de entrada (gira con las manos del operador)
    const volante = movil(new THREE.Group()); volante.position.set(VX, VY, VZ); ent.add(volante);
    {
      const partes = [preparar(new THREE.TorusGeometry(VR, 0.021, 10, 48).rotateY(Math.PI / 2))];
      for (let k = 0; k < 5; k++) partes.push(preparar(new THREE.CylinderGeometry(0.011, 0.014, VR - 0.03, 8).translate(0, (VR - 0.03) / 2 + 0.03, 0).rotateX((k / 5) * TAU)));
      partes.push(preparar(new THREE.CylinderGeometry(0.048, 0.055, 0.09, 18).rotateZ(Math.PI / 2)));
      kit.malla(kit.mergeGeometries(partes), rojo, { padre: volante });
    }
    // aguja del indicador de posición y del manómetro
    const puntero = movil(new THREE.Group()); puntero.position.set(3.35, 1.448, 15.82); ent.add(puntero);
    kit.malla(new THREE.BoxGeometry(0.008, 0.004, 0.08).translate(0, 0, -0.035), negro, { padre: puntero, sombra: false });
    const aguja = movil(new THREE.Group()); aguja.position.set(4.5, YL, 16.222); ent.add(aguja);
    kit.malla(new THREE.BoxGeometry(0.005, 0.068, 0.002).translate(0, 0.026, 0), new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.5 }), { padre: aguja, sombra: false });
    // puntos que miran las personas
    const miraPosicion = movil(new THREE.Object3D()); miraPosicion.position.set(3.35, 1.45, 15.82); ent.add(miraPosicion);
    const miraManometro = movil(new THREE.Object3D()); miraManometro.position.set(4.5, YL, 16.22); ent.add(miraManometro);
    const miraVisitante = movil(new THREE.Object3D()); miraVisitante.position.set(0, 1.6, 28); esc.add(miraVisitante);

    // ------------------------------------------------------------ salida por el vértice: válvula, tubería, canal y charcos
    kit.cilindro(0.32, 0.32, 0.72, chapa, { y: YV - 0.11, seg: 24, padre: esc });
    junta(esc, [0, 1.9, 0], 'y', 0.34, valvulaMat);
    const cuerpo = kit.malla(new THREE.SphereGeometry(0.42, 24, 14), valvulaMat, { y: 1.625, padre: esc }); cuerpo.scale.set(1, 0.68, 0.9);
    junta(esc, [0, 1.35, 0], 'y', 0.34, valvulaMat);
    kit.cilindro(0.2, 0.16, 0.62, valvulaMat, { y: 1.625, z: 0.62, rx: Math.PI / 2, seg: 20, padre: esc });
    kit.cilindro(0.26, 0.26, 0.05, valvulaMat, { y: 1.625, z: 0.36, rx: Math.PI / 2, seg: 20, padre: esc });
    kit.cilindro(0.03, 0.03, 0.32, galv, { y: 1.625, z: 1.06, rx: Math.PI / 2, padre: esc });
    kit.malla(new THREE.TorusGeometry(0.3, 0.028, 8, 36), rojo, { y: 1.625, z: 1.17, padre: esc });
    for (let k = 0; k < 3; k++) kit.caja(0.6, 0.03, 0.025, rojo, { y: 1.625, z: 1.17, rz: (k * Math.PI) / 3, padre: esc });
    kit.cilindro(0.06, 0.06, 0.08, rojo, { y: 1.625, z: 1.17, rx: Math.PI / 2, padre: esc });
    codo([0.6, 1.35, 0], [-1, 0, 0], [0, -1, 0], 0.6, 0.3, tuboMat, esc);
    barra([0.6, 0.75, 0], [6.0, 0.75, 0], 0.3, tuboMat, { seg: 24 });
    junta(esc, [3.3, 0.75, 0], 'x', 0.3); junta(esc, [6.0, 0.75, 0], 'x', 0.3);
    for (const x of [2.2, 4.6]) pieza(cajaG(0.4, 0.45, 0.8, 1), concreto, mtx(x, 0.225, 0));
    pieza(cartel(R.v102, 0.24, 0.08), rotMat, mtx(2.2, 0.3, 0.402));
    // canal de hormigón que recibe la descarga y sumidero con rejilla al final
    const X0C = 5.62, X1C = 16.4, XM = (X0C + X1C) / 2, LC = X1C - X0C;
    pieza(cajaG(LC, 0.1, 1.5, 1.5), concreto, mtx(XM, 0.05, 0));
    for (const z of [-0.67, 0.67]) pieza(cajaG(LC, 0.4, 0.16, 1.5), concreto, mtx(XM, 0.2, z));
    pieza(cajaG(0.16, 0.4, 1.5, 1.5), concreto, mtx(X0C, 0.2, 0));
    pieza(cajaG(1.0, 0.3, 1.9, 1.5), concreto, mtx(X1C + 0.5, 0.15, 0));
    pieza(cajaG(0.84, 0.01, 1.66), negro, mtx(X1C + 0.5, 0.302, 0));
    for (let i = 0; i < 9; i++) pieza(cajaG(0.022, 0.035, 1.64), galv, mtx(X1C + 0.13 + i * 0.093, 0.32, 0));
    for (const z of [-0.83, 0.83]) pieza(cajaG(0.84, 0.035, 0.03), galv, mtx(X1C + 0.5, 0.32, z));
    const nrmCanal = kit.makeSurface('noiseNormal', { size: 256, seed: 7, repeat: [LC / 1.5, 1], roughness: false }).normalMap;
    movil(kit.malla(new THREE.PlaneGeometry(LC - 0.16, 1.18), new THREE.MeshStandardMaterial({ color: 0x2f5c63, roughness: 0.08, metalness: 0, normalMap: nrmCanal, normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 2 }), { rx: -Math.PI / 2, x: XM + 0.08, y: 0.22, padre: esc, sombra: false }));
    const vetaH = vetaTex(true); vetaH.repeat.set(1, 3);
    {
      const pts = [];
      for (let i = 0; i <= 10; i++) { const t = (0.335 * i) / 10; pts.push(V(6.03 + 3.54 * t, 0.75 - 4.905 * t * t, 0)); }
      const caida = movil(kit.malla(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.26, 18, false), new THREE.MeshStandardMaterial({ map: vetaH, transparent: true, opacity: 0.85, roughness: 0.2, emissive: 0x6f8f9a, emissiveIntensity: 0.3, depthWrite: false }), { padre: esc, sombra: false }));
      caida.renderOrder = 4;
    }
    // espuma donde cae el chorro de salida
    const espumaSal = (() => {
      const [c, x] = lienzo(128);
      x.clearRect(0, 0, 128, 128);
      for (let i = 0; i < 160; i++) {
        const a = rnd() * TAU, d = Math.pow(rnd(), 0.7) * 54, r = 2 + rnd() * 7;
        x.fillStyle = `rgba(255,255,255,${(0.25 + rnd() * 0.5) * (1 - d / 64)})`; x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, TAU); x.fill();
      }
      return texDe(c, false);
    })();
    const espuma = movil(kit.malla(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshStandardMaterial({ color: 0xf2f6f7, alphaMap: espumaSal, transparent: true, depthWrite: false, roughness: 0.6 }), { rx: -Math.PI / 2, x: 7.3, y: 0.226, padre: esc, sombra: false }));
    espuma.renderOrder = 5;
    // charcos: el agua salpica fuera del canal y moja la grava
    const charcoMat = (() => {
      const [c, x] = lienzo(256);
      x.clearRect(0, 0, 256, 256);
      const mancha = (cx, cy, rx, ry, color, n) => { for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()); x.fillStyle = color; x.beginPath(); x.ellipse(cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, rx * (0.18 + rnd() * 0.25), ry * (0.18 + rnd() * 0.25), rnd() * 3, 0, TAU); x.fill(); } };
      mancha(128, 128, 100, 90, 'rgba(58,52,44,0.16)', 90);
      mancha(128, 128, 70, 56, 'rgba(40,46,48,0.5)', 40);
      mancha(124, 132, 46, 34, 'rgba(30,40,44,0.9)', 26);
      return sinSombra(new THREE.MeshStandardMaterial({ map: texDe(c), transparent: true, depthWrite: false, roughness: 0.1, metalness: 0, envMapIntensity: 1.8, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    })();
    const charco = (en, x, y, z, w, d, giro) => pieza(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).rotateY(giro), charcoMat, mtx(x, y, z), { en });
    charco(esc, 7.6, 0.034, 1.75, 3.2, 2.2, 0.3);
    charco(esc, 8.7, 0.034, -1.6, 2.6, 1.7, -0.4);
    charco(esc, 17.7, 0.034, 0.9, 2.2, 1.8, 0.9);
    charco(esc, 0.6, 0.034, 0.7, 1.6, 1.3, 0.2);
    charco(ent, 8.95, Y_LOSA + 0.004, 16.7, 0.6, 1.0, 0.1);

    // ------------------------------------------------------------ indicador magnético de nivel (banderas rojas bajo el nivel)
    const niv = new THREE.Group(); niv.rotation.y = A_NIVEL; esc.add(niv);
    const ind = new THREE.Group(); ind.position.set(0, 0, R_NIVEL); ind.rotation.y = 0.2526 - A_NIVEL; niv.add(ind);
    esc.updateMatrixWorld(true);
    const banderas = (fondo, linea) => { const [c, x] = lienzo(16); x.fillStyle = fondo; x.fillRect(0, 0, 16, 16); x.fillStyle = linea; x.fillRect(0, 14, 16, 2); return texDe(c); };
    const rojasTex = banderas('#d22a22', 'rgba(60,8,6,0.85)');
    const rojas = movil(kit.malla(new THREE.BoxGeometry(0.06, 1, 0.006).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ map: rojasTex, roughness: 0.45, metalness: 0.1 }), { y: YV, z: 0.1135, padre: ind, sombra: false }));
    {
      for (let i = 0; i < 20; i++) pieza(cartel(R.blancas, 0.058, 0.5), rotMat, mtx(0, YV + 0.25 + i * 0.5, 0.1105), { en: ind });
      pieza(cilG(0.06, 0.06, 10.8, 18), galv, mtx(0, 1.95 + 5.4, 0), { en: ind });                          // cámara del flotador
      for (const y of [1.95, 12.75]) pieza(cilG(0.085, 0.085, 0.06, 18), galv, mtx(0, y, 0), { en: ind });
      pieza(cilG(0.02, 0.02, 0.18, 8), galv, mtx(0, 12.87, 0), { en: ind });                    // venteo
      pieza(cajaG(0.06, 0.08, 0.06), rojo, mtx(0, 1.82, 0), { en: ind });                      // llave de purga
      pieza(cajaG(0.085, M.H + 0.3, 0.045, 0.5), galv, mtx(0, (YV + YB) / 2, 0.083), { en: ind });          // perfil de las banderas
      pieza(cajaG(0.27, M.H + 0.3, 0.012, 0.5), galv, mtx(0.2, (YV + YB) / 2, 0.07), { en: ind });           // respaldo de la regla
      pieza(cartel(R.reglaA, 0.24, 5), rotMat, mtx(0.2, YV + 2.5, 0.0765), { en: ind });
      pieza(cartel(R.reglaB, 0.24, 5), rotMat, mtx(0.2, YV + 7.5, 0.0765), { en: ind });
      pieza(cajaG(0.09, 12.9, 0.09, 1), acero, mtx(0, 6.45, -0.16), { en: ind });                             // poste de soporte
      pieza(cajaG(0.5, 0.3, 0.5, 1), concreto, mtx(0, 0.15, -0.12), { en: ind });
      for (let y = 2.2; y < 12.6; y += 2.1) pieza(cajaG(0.05, 0.05, 0.2), galv, mtx(0, y, -0.08), { en: ind });
      pieza(cartel(R.li101, 0.24, 0.08), rotMat, mtx(0, 1.6, -0.11), { en: ind });
      pieza(cajaG(0.26, 0.1, 0.01), galv, mtx(0, 1.6, -0.118), { en: ind });
      // toma superior bajo la viga anular y línea de equilibrio que llega desde el vértice
      barra([0, 11.35, 13.45], [0, 11.35, R_NIVEL - 0.05], 0.035, galv, { en: niv, seg: 8 });
      barra([0, 2.3, 0.33], [0, 2.3, R_NIVEL - 0.05], 0.03, galv, { en: niv, seg: 8 });
      for (const y of [11.35, 2.3]) pieza(cajaG(0.09, 0.09, 0.12), rojo, mtx(0, y, R_NIVEL - 0.45), { en: niv });
      for (const r of [5.5, 11]) {
        barra([0, 0, r], [0, 2.26, r], 0.035, acero, { en: niv, seg: 8 });
        pieza(cajaG(0.2, 0.012, 0.2), acero, mtx(0, 0.03, r), { en: niv });
        pieza(cajaG(0.1, 0.03, 0.1), galv, mtx(0, 2.27, r), { en: niv });
      }
    }
    const marcaNivel = movil(new THREE.Object3D()); marcaNivel.position.set(0, YV + s.h, 0.12); ind.add(marcaNivel);

    // ------------------------------------------------------------ cerco de malla con acceso abierto hacia el visitante
    {
      const mallaTex = (() => {
        const [c, x] = lienzo(64);
        x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(205,210,212,1)'; x.lineWidth = 3;
        for (let i = -64; i <= 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); }
        return texDe(c);
      })();
      const mallaMat = sinSombra(new THREE.MeshStandardMaterial({ map: mallaTex, alphaTest: 0.45, side: THREE.DoubleSide, metalness: 0.45, roughness: 0.5 }));
      // tramos continuos dentro del cerco de la obra
      const tramos = [];
      let tramo = null;
      for (let d = 0; d <= 360 - 2 * 35; d += 0.5) {
        const a = A_ACCESO + (d * Math.PI) / 180, ok = alCerco(a) > RF + 1.2;
        if (ok && !tramo) tramos.push((tramo = [a, a]));
        else if (ok) tramo[1] = a;
        else tramo = null;
      }
      const poste = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 8);
      const posteFin = new THREE.CylinderGeometry(0.045, 0.045, 2.45, 10);
      for (const [a0, a1] of tramos) {
        if ((a1 - a0) * RF < 2) continue;
        const n =Math.max(1, Math.round(((a1 - a0) * RF) / 3));
        const pts = Array.from({ length: n + 1 }, (_, i) => a0 + ((a1 - a0) * i) / n);
        pts.forEach((a, i) => {
          const fin = i === 0 || i === n, [px, , pz] = pol(a, RF);
          pieza(fin ? posteFin : poste, galv, mtx(px, fin ? 1.225 : 1.15, pz));
          pieza(cilG(0.12, 0.12, 0.3, 10), concreto, mtx(px, 0.1, pz));
          if (fin) { const b = pts[i === 0 ? 1 : n - 1], [qx, , qz] = pol(b, RF); barra([px, 2.0, pz], [px + (qx - px) * 0.33, 0.25, pz + (qz - pz) * 0.33], 0.025, galv, { seg: 6 }); }
        });
        for (let i = 0; i < n; i++) {
          const [x0, , z0] = pol(pts[i], RF), [x1, , z1] = pol(pts[i + 1], RF), L = Math.hypot(x1 - x0, z1 - z0);
          const ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
          pieza(uvEsc(new THREE.PlaneGeometry(L, 2.0), L / 0.32, 2.0 / 0.32), mallaMat, mtx((x0 + x1) / 2, 1.08, (z0 + z1) / 2, 0, ry, 0));
          barra([x0, 2.12, z0], [x1, 2.12, z1], 0.02, galv, { seg: 6 });
        }
        // letrero de acceso restringido junto al acceso, por ambas caras
        const aL = Math.abs(a0 - A_ACCESO) < 0.01 ? a0 + 2 / RF : Math.abs(a1 - (TAU - A_ACCESO)) < 0.01 ? a1 - 2 / RF : null;
        if (aL !== null) for (const cara of [0, Math.PI]) {
          const [px, , pz] = pol(aL, RF + (cara ? -0.02 : 0.02));
          pieza(cartel(R.acceso, 0.6, 0.48), rotMat, mtx(px, 1.45, pz, 0, aL + cara, 0));
        }
      }
    }

    // ------------------------------------------------------------ cotas y rótulos
    const matCota = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    const cotaH = movil(kit.barra([0, 0, 0], [0, 1, 0], 0.045, matCota(0x5cc8ff)));
    const cotaR = movil(kit.barra([0, 0, 0], [0, 1, 0], 0.045, matCota(0xffb347)));
    esc.add(cotaH, cotaR);
    const gris = sinSombra(matCota(0xdfe6ec));
    barra([-0.55, YV, 0.45], [-0.55, YB, 0.45], 0.025, gris);
    barra([0, YB + 0.38, 0.12], [Math.sin(CORTE) * M.R, YB + 0.38, Math.cos(CORTE) * M.R + 0.12], 0.025, gris);
    const lH = kit.etiqueta('H = 10 m', 0.6, { bg: 'rgba(223,230,236,0.92)', color: '#16202a' }); lH.position.set(-2.1, YB - 1.4, 1.6);
    const lRR = kit.etiqueta('R = 15 m', 0.6, { bg: 'rgba(223,230,236,0.92)', color: '#16202a' }); lRR.position.set(Math.sin(CORTE) * 9, YB + 1.1, Math.cos(CORTE) * 9 + 1.2);
    const lh = kit.etiqueta('h', 0.75, { bg: '#5cc8ff', color: '#08202c' });
    const lr = kit.etiqueta('r', 0.75, { bg: '#ffb347', color: '#1a1206' });
    const lc = kit.etiqueta('c', 0.7, { bg: '#7fd4c1', color: '#0b201b' });
    const lsal = kit.etiqueta('sale 1 m³/s', 0.5, { bg: 'rgba(12,20,32,0.86)' });
    const wBoca = esc.worldToLocal(ent.localToWorld(V(0, Y_BOCA, R_BOCA)));
    lc.position.set(wBoca.x - 2.4, Y_BOCA - 0.5, wBoca.z + 2.6); lsal.position.set(7.4, 1.6, 1.4);
    for (const l of [lH, lRR, lh, lr, lc, lsal]) { movil(l); esc.add(l); }
    // asa para subir o bajar el nivel arrastrando
    const asa = movil(kit.malla(new THREE.SphereGeometry(0.28, 20, 14), new THREE.MeshStandardMaterial({ color: 0x5cc8ff, emissive: 0x2a8fd0, emissiveIntensity: 0.9 }), { padre: esc, sombra: false }));
    kit.arrastre(asa, esc, { normal: [0, 0, 1], punto: [0, 0, 0.45], cursor: 'ns-resize', habilitado: est.habilitado, alMover: (p) => fijarH(p.y - YV) });

    // ------------------------------------------------------------ estado
    function fijarH(v) { s.simular = false; s.h = Math.min(M.H, Math.max(0.2, v)); s.cambio++; }
    function fijarC(v) {
      const c = Math.min(40, Math.max(0, v));
      anim.phiObj += (c - s.c) * 0.35; // abrir o cerrar la válvula hace girar el volante
      s.c = c; s.cambio++; s.cambioC++;
    }
    function simular(v) {
      if (v && s.c > M.salida && s.h >= M.H - 1e-3) s.h = 0.5;
      if (v && s.c < M.salida && s.h <= 0.2 + 1e-3) s.h = M.H;
      s.simular = v; s.cambio++;
    }
    const dhdt = () => M.dhdt(s.h, s.c);

    function construir() {
      const h = s.h, k = h / M.H, r = M.radio(h), y = YV + h;
      aguaG.scale.setScalar(k);
      nrmSup.repeat.set(k * 9, k * 9);
      [CORTE, TAU - CORTE].forEach((a, i) => kit.moverBarra(lineas[i], [0, y + 0.015, 0], [Math.sin(a) * r, y + 0.015, Math.cos(a) * r]));
      kit.moverBarra(cotaH, [0, YV, 0.45], [0, y, 0.45]);
      kit.moverBarra(cotaR, [0, y + 0.2, 0.12], [Math.sin(CORTE) * r, y + 0.2, Math.cos(CORTE) * r + 0.12]);
      asa.position.set(0, y, 0.45);
      const rj = radioChorro(s.c), yb = YV + Math.max(h, R_BOCA / 1.5);
      chorro.visible = rj > 0.02;
      chorro.scale.set(Math.max(rj, 0.01), Y_BOCA - yb, Math.max(rj, 0.01));
      uSup.uRadio.value = rj; uSup.uHay.value = rj > 0.02 ? 1 : 0;
      // indicador de nivel, posición de la válvula y presión de descarga
      rojas.scale.y = h; rojasTex.repeat.set(1, h / 0.025);
      marcaNivel.position.y = y;
      puntero.rotation.y = -Math.PI * (s.c / 40);
      aguja.rotation.z = (-135 + 27 * Math.min(10, 1.2 + 0.16 * h + 0.11 * s.c)) * (Math.PI / 180);
    }
    function rotulos() {
      const h = s.h, r = M.radio(h);
      kit.cambiarEtiqueta(lh, `h = ${kit.num(h, 2)} m`); lh.position.set(1.7, YV + Math.max(h / 2, 0.4), 2.6);
      kit.cambiarEtiqueta(lr, `r = ${kit.num(r, 2)} m`); lr.position.set(Math.max(Math.sin(CORTE) * r * 0.5, 1.6) + 0.5, YV + h + 0.95, Math.cos(CORTE) * r * 0.5 + 2.2);
      kit.cambiarEtiqueta(lc, `c = ${kit.num(s.c, 2)} m³/s`);
    }

    // ------------------------------------------------------------ gráfico dh/dt en función de h
    const fDh = (x) => M.dhdt(Math.max(x, 0.05), s.c);
    const graf = kit.grafico({
      f: fDh, x0: 0, x1: 10, y0: -2, y1: 10, width: 1.3, height: 0.8,
      xTicks: [0, 2, 4, 6, 8, 10], yTicks: [-2, 0, 2, 4, 6, 8, 10], tickFmt: (v) => String(v), yTickFmt: (v) => kit.num(v, 0),
      xLabel: 'nivel h (m)', yLabel: 'dh/dt (m/s)', curveColor: 0x5cc8ff,
    });
    graf.group.position.set(0.6, 1.05, 28 - 1.65); graf.group.rotation.y = -0.42;
    esc.add(movil(graf.group));
    {
      const guia = kit.dashedLine(graf.toLocal(0, 4, 0.002), graf.toLocal(10, 4, 0.002), { color: 0xffb347, radius: 0.0032, dash: 0.03, gap: 0.016 });
      guia.renderOrder = 6; graf.group.add(guia);
      const l = kit.createLabel('4 m/s', { size: 0.036, color: '#1a1206', bg: '#ffb347', weight: 700 });
      l.position.copy(graf.toLocal(10, 4, 0.004)).add(V(-0.07, 0.035, 0)); graf.group.add(l);
    }
    const proxy = kit.malla(new THREE.PlaneGeometry(graf.width + 0.1, graf.height + 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), { x: graf.width / 2, y: graf.height / 2, z: 0.01, sombra: false, padre: graf.group });
    kit.arrastre(proxy, graf.group, { normal: [0, 0, 1], cursor: 'ew-resize', habilitado: est.habilitado, alMover: (p) => fijarH(graf.xFromLocal(p.x)) });
    function revelar() {
      graf.removePoint('sol');
      if (s.revelar) { fijarC(M.respuesta()); graf.addPoint('sol', 1, 4, { color: 0x6fe3a2, labelX: 'h = 1 m' }); }
      s.cambio++;
    }

    // ------------------------------------------------------------ panel
    const panel = kit.panelEstandar({
      etiqueta: this.etiqueta, titulo: this.titulo,
      enunciado: 'Cono con el vértice hacia abajo, 10 m de altura y 15 m de radio. Sale agua a 1 m³/s y entra a razón c. ¿Qué valor de c hace subir el nivel a 4 m/s cuando h = 1 m?',
      ecuaciones: ['r/h = 15/10  ⇒  r = 1,5h,   V = (1/3)πr²h = (3π/4)h³', 'dV/dt = (9π/4)h² · dh/dt = c − 1'],
      lecturas: [
        { etiqueta: 'nivel h', valor: () => `${kit.num(s.h, 2)} m`, color: '#5cc8ff' },
        { etiqueta: 'radio r = 1,5h', valor: () => `${kit.num(M.radio(s.h), 2)} m`, color: '#ffb347' },
        { etiqueta: 'volumen V', valor: () => `${kit.num(M.V(s.h), 1)} m³`, color: '#c9a7ff', escala: 0.66 },
        { etiqueta: 'entrada c', valor: () => `${kit.num(s.c, 2)} m³/s`, color: '#7fd4c1', escala: 0.66 },
        { etiqueta: 'dV/dt = c − 1', valor: () => `${kit.num(s.c - M.salida, 2)} m³/s`, color: '#c9a7ff', escala: 0.66 },
        { etiqueta: 'dh/dt', valor: () => `${kit.num(dhdt(), 3)} m/s`, color: '#5cc8ff', escala: 0.66 },
      ],
      deslizadores: [
        { etiqueta: 'Caudal de entrada c', min: 0, max: 40, paso: 0.05, color: '#7fd4c1', get: () => s.c, set: (v) => fijarC(v), formato: (v) => `${kit.num(v, 2)} m³/s` },
        { etiqueta: 'Nivel del agua h', min: 0.2, max: 10, paso: 0.01, get: () => s.h, set: (v) => fijarH(v), formato: (v) => `${kit.num(v, 2)} m` },
        { etiqueta: 'Velocidad de la simulación', min: 1, max: 20, paso: 1, color: '#ffb347', get: () => s.vel, set: (v) => { s.vel = v; panel.invalidate(); }, formato: (v) => `${kit.num(v, 0)}×` },
      ],
      botones: [
        { etiqueta: () => (s.simular ? '❚❚ Detener' : '▶ Simular'), tipo: 'interruptor', get: () => s.simular, set: (v) => simular(v) },
        { etiqueta: 'Ir a h = 1 m', accion: () => fijarH(1) },
        { etiqueta: 'Revelar', tipo: 'interruptor', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      pie: () => (s.revelar
        ? 'Con h = 1 m y dh/dt = 4 m/s: c − 1 = (9π/4)·1²·4 = 9π, así que c = 1 + 9π ≈ 29,27 m³/s. La guía escribe cm³/s, pero con un depósito de 10 m esa unidad no es coherente: aquí se usa m³/s.'
        : 'Mueve c y h, arrastra la esfera celeste o activa Simular. Busca el caudal c con el que la curva dh/dt pasa por la guía de 4 m/s justo en h = 1 m.'),
      pieColor: () => (s.revelar ? kit.THEME.good : kit.THEME.dim),
    });
    panel.mesh.position.set(-1.35, 1.38, 28 - 1.4); panel.mesh.rotation.y = 0.5;
    esc.add(movil(panel.mesh));
    panel.register(kit.input, est.habilitado);

    // ------------------------------------------------------------ personas
    const vH = V(), vT = V(), vE = V();
    // La IK lleva la muñeca: se apunta a un puño del agarre, hacia el hombro, y se corrige con lo que faltó en el cuadro anterior
    const correccion = new Map();
    const aMuneca = (h, L, agarre, out) => {
      h.huesos['brazo' + L].getWorldPosition(vH);
      let c = correccion.get(h.huesos['mano' + L]);
      if (!c) correccion.set(h.huesos['mano' + L], (c = V()));
      return out.copy(agarre).addScaledVector(vH.sub(agarre).normalize(), (0.075 * h.altura) / 1.75).add(c);
    };
    const corregir = (h, L, agarre) => { // deja el centro del puño sobre el agarre
      const c = correccion.get(h.huesos['mano' + L]);
      (L === 'D' ? h.manoD : h.manoI).getWorldPosition(vE);
      c.addScaledVector(vE.subVectors(agarre, vE), 0.6);
      if (c.length() > 0.12) c.setLength(0.12);
    };
    // operador: de pie frente al volante, con el cuerpo levemente inclinado y un pie atrás
    const op = kit.persona({ preset: 'operador', semilla: 11, barba: 'bigote', padre: ent, x: VX - 0.47, y: Y_LOSA, z: VZ, ry: Math.PI / 2 });
    movil(op.grupo);
    const poseOp = {
      ...kit.POSES.reposo(), columna: [0.08, 0, 0], pecho: [0.03, 0, 0], cuello: [0.02, 0, 0], cabeza: [0, 0, 0],
      musloD: [0.14, 0, -0.07], piernaD: [0.1, 0, 0], pieD: [-0.17, 0, 0.07], musloI: [-0.2, 0, 0.06], piernaI: [0.1, 0, 0], pieI: [0.08, 0, -0.06],
      _pos: [0, -0.018, -0.02], dedosD: 0.82, dedosI: 0.82,
    };
    op.posar(poseOp).transicion(0.01);
    const agD = V(), agI = V(), muD = V(), muI = V();
    op.alcanzar('D', muD); op.alcanzar('I', muI);
    // mano sobre el aro: ángulo desde arriba hacia la derecha del operador; cada mano acompaña el giro un arco y vuelve suelta
    const ARCO = 1.4, AGARRE = 0.75, PASO = ARCO / AGARRE;
    const angMano = (phi, desfase, base) => {
      const p = (((phi / PASO + desfase) % 1) + 1) % 1;
      if (p < AGARRE) return [base + p * PASO, 0];
      const k = (p - AGARRE) / (1 - AGARRE);
      return [base + ARCO * (1 - k), Math.sin(Math.PI * k)];
    };
    const puntoAro = (th, suelta, out) => out.set(VX - 0.07 * suelta, VY + Math.cos(th) * (VR + 0.03 * suelta), VZ + Math.sin(th) * (VR + 0.03 * suelta)).applyMatrix4(ent.matrixWorld);
    // ingeniera: sostiene la tableta con las dos manos y sigue con la vista la marca del indicador de nivel
    const ing = kit.persona({ preset: 'ingeniera', semilla: 6, padre: esc, x: ING.x, y: 0.026, z: ING.z, ry: Math.atan2(16.4 - ING.x, 4.09 - ING.z) });
    movil(ing.grupo);
    ing.posar({ ...kit.POSES.tableta(), cuello: [0.03, 0, 0], cabeza: [0, 0, 0], dedosD: 0.5, dedosI: 0.5 }).transicion(0.01);
    const tableta = new THREE.Group(); tableta.position.set(0, 1.1, 0.28); tableta.rotation.x = 1.0; ing.grupo.add(tableta);
    kit.malla(new THREE.BoxGeometry(0.255, 0.178, 0.011), new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5, metalness: 0.3 }), { padre: tableta });
    const pantalla = kit.malla(enRegion(new THREE.PlaneGeometry(0.225, 0.15), R.pantalla).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: atlas, toneMapped: false }), { z: -0.0062, padre: tableta, sombra: false });
    const agarreD = new THREE.Object3D(), agarreI = new THREE.Object3D();
    agarreD.position.set(-0.128, -0.02, 0); agarreI.position.set(0.128, -0.02, 0); tableta.add(agarreD, agarreI);
    const tD = V(), tI = V(), mD2 = V(), mI2 = V();
    ing.grupo.updateMatrixWorld(true);
    const poloD = V(-1, -1, -0.2).transformDirection(ing.grupo.matrixWorld), poloI = V(1, -1, -0.2).transformDirection(ing.grupo.matrixWorld);
    ing.alcanzar('D', mD2, poloD); ing.alcanzar('I', mI2, poloI);

    const tFijo = REV.has('t') ? Number(REV.get('t')) : null, forzarGiro = REV.get('gira') === '1';
    function personas(dt) {
      const ta = tFijo ?? anim.t;
      // volante: gira mientras se llena (o al cambiar c) y las manos lo acompañan
      if (forzarGiro || (s.simular && s.c > M.salida)) anim.phiObj += dt * 1.5;
      const antes = anim.phi, d = anim.phiObj - anim.phi;
      anim.phi += Math.sign(d) * Math.min(Math.abs(d), dt * 2.4);
      if (tFijo !== null && forzarGiro) anim.phi = tFijo * 1.5;
      const girando = forzarGiro || Math.abs(anim.phi - antes) > 1e-5;
      anim.giro += ((girando ? 1 : 0) - anim.giro) * (dt > 0 ? 1 - Math.exp(-dt * 7) : 1);
      volante.rotation.x = anim.phi;
      const [thD, sD] = angMano(anim.phi, 0, 0.35), [thI, sI] = angMano(anim.phi, 0.5, Math.PI + 0.35);
      puntoAro(thD, sD, agD); puntoAro(Math.PI / 3, 0, vT); agD.lerpVectors(vT, agD, anim.giro);
      puntoAro(thI, sI, agI); puntoAro(-Math.PI / 3, 0, vT); agI.lerpVectors(vT, agI, anim.giro);
      poseOp.dedosD = 0.82 - 0.6 * sD * anim.giro; poseOp.dedosI = 0.82 - 0.6 * sI * anim.giro;
      aMuneca(op, 'D', agD, muD); aMuneca(op, 'I', agI, muI);
      const cOp = ta % 10;
      op.mirar(anim.giro > 0.5 ? miraPosicion : cOp < 4.5 ? miraPosicion : cOp < 7.5 ? miraManometro : miraVisitante);
      op.actualizar(dt);
      corregir(op, 'D', agD); corregir(op, 'I', agI);
      // ingeniera: mira la marca del nivel y de vez en cuando la tableta
      agarreD.getWorldPosition(tD); agarreI.getWorldPosition(tI);
      aMuneca(ing, 'D', tD, mD2); aMuneca(ing, 'I', tI, mI2);
      ing.mirar(((ta + 3) % 9) < 6.6 ? marcaNivel : pantalla);
      ing.actualizar(dt);
      corregir(ing, 'D', tD); corregir(ing, 'I', tI);
    }

    consolidar();
    construir();
    for (let i = 0; i < 8; i++) personas(i < 2 ? 0.05 : 0); // quedan en pose y con las manos ajustadas

    let tiempo = 0;
    return {
      paneles: [panel],
      radioSombra: 28,
      alturaCartel: 18.5,
      vista: {
        escritorio: { camara: aGrupo([5, 10, 35]), objetivo: aGrupo([0, 5.6, 0]) },
        vr: { pos: aGrupo([0, 0, 28]), yaw: esc.rotation.y },
      },
      dom: [
        { tipo: 'rango', etiqueta: 'c', min: 0, max: 40, paso: 0.01, get: () => s.c, set: (v) => fijarC(v), formato: (v) => `${kit.num(v, 2)} m³/s` },
        { tipo: 'rango', etiqueta: 'h', min: 0.2, max: 10, paso: 0.01, get: () => s.h, set: (v) => fijarH(v), formato: (v) => `${kit.num(v, 2)} m` },
        { tipo: 'interruptor', etiqueta: () => (s.simular ? '❚❚ Detener' : '▶ Simular'), get: () => s.simular, set: (v) => simular(v) },
        { tipo: 'boton', etiqueta: 'Ir a h = 1 m', accion: () => fijarH(1) },
        { tipo: 'interruptor', etiqueta: 'Revelar', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      actualizar(dt) {
        tiempo += dt; anim.t += dt;
        uSup.uTiempo.value = tiempo;
        nrmSup.offset.set(tiempo * 0.03, tiempo * 0.021);
        nrmCanal.offset.x -= dt * 0.35;
        vetaV.offset.y += dt * 1.6;
        vetaH.offset.x -= dt * 1.2;
        espuma.rotation.z += dt * 0.4;
        if (s.simular) {
          let h = hDeV(Math.max(0, M.V(s.h) + (s.c - M.salida) * dt * s.vel));
          if (h >= M.H) { h = M.H; s.simular = false; }
          if (h <= 0.2) { h = 0.2; s.simular = false; }
          s.h = h; s.cambio++;
        }
        s.refresco -= dt; s.refrescoC -= dt;
        if (s.ultimoC !== s.cambioC && s.refrescoC <= 0) { s.ultimoC = s.cambioC; s.refrescoC = 0.12; graf.setFunction(fDh); s.ultimo = -1; }
        if (s.ultimo !== s.cambio) {
          s.ultimo = s.cambio;
          construir();
          if (!s.simular || s.refresco <= 0) { s.refresco = 0.1; rotulos(); graf.setMarker(s.h); }
          panel.invalidate();
        }
        personas(dt);
      },
    };
  },
};
