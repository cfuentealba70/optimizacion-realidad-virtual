// Ejemplo 3. Cisterna con base y tapa cuadradas para 12.000 dm³ de costo mínimo.
import { CISTERNA as M } from '../../src/math/guia4.js';

export default {
  id: 'cisterna',
  tipo: 'optimizacion',
  etiqueta: 'Ejemplo 3 · Optimización',
  titulo: 'Cisterna de costo mínimo',
  resumen: 'Se va a construir una cisterna con base y tapa cuadradas para almacenar 12.000 dm³ de agua. El concreto de la base y los lados cuesta $100 por dm² y el material de la tapa $200 por dm². ¿Qué dimensiones minimizan el costo?',

  crear(kit, est) {
    const { THREE } = kit;
    const g = est.grupo;
    const s = { x: 15, tapa: true, revelar: false, cambio: true };
    const dm = 0.1; // metros por decímetro
    const esp = 0.12; // espesor de los muros en metros

    // losa de grava y piso de obra
    const pad = kit.malla(new THREE.CircleGeometry(6.5, 48), kit.mat('gravel', { repeat: [5, 5], color: 0xa39a88, normalScale: 0.7 }), { rx: -Math.PI / 2, y: 0.025, sombra: false, padre: g });
    pad.material.polygonOffset = true; pad.material.polygonOffsetFactor = -3;

    // cisterna: piso, cuatro muros, agua y tapa (cajas unitarias que se escalan)
    const concreto = kit.mat('concrete', { repeat: [1.5, 1.5], color: 0xc9c5bd, roughness: 1, normalScale: 0.7 });
    const caja = () => kit.caja(1, 1, 1, concreto, { padre: g });
    const piso = caja(), muros = [caja(), caja(), caja(), caja()];
    const aguaMat = new THREE.MeshStandardMaterial({ color: 0x2f7fb0, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0, envMapIntensity: 1.3 });
    const agua = kit.caja(1, 1, 1, aguaMat, { padre: g, sombra: false });
    agua.renderOrder = 2;
    const nrm = kit.makeSurface('noiseNormal', { size: 256, seed: 21, repeat: [2, 2], roughness: false }).normalMap;
    const superficie = kit.malla(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x3d8fbf, roughness: 0.03, metalness: 0, normalMap: nrm, transparent: true, opacity: 0.85, envMapIntensity: 1.6 }), { rx: -Math.PI / 2, padre: g, sombra: false });
    const acero = new THREE.MeshStandardMaterial({ color: 0x5d666f, metalness: 0.85, roughness: 0.38 });
    const tapa = kit.caja(1, 1, 1, acero, { padre: g });
    const asa = kit.caja(0.4, 0.05, 0.05, acero, { padre: g });

    // persona de referencia (1,75 m)
    const gris = new THREE.MeshStandardMaterial({ color: 0x7d8790, roughness: 0.8 });
    const persona = new THREE.Group(); g.add(persona);
    kit.malla(new THREE.CapsuleGeometry(0.2, 1.0, 6, 12), gris, { y: 0.82, padre: persona });
    kit.malla(new THREE.SphereGeometry(0.12, 16, 12), gris, { y: 1.62, padre: persona });

    // cotas
    const cotaMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    const cotaX = kit.barra([0, 0, 0], [0, 1, 0], 0.015, cotaMat), cotaH = kit.barra([0, 0, 0], [0, 1, 0], 0.015, cotaMat);
    g.add(cotaX, cotaH);
    const lx = kit.etiqueta('x', 0.32, { bg: '#ffb347', color: '#1a1206' }), lh = kit.etiqueta('h', 0.32, { bg: '#ffb347', color: '#1a1206' });
    g.add(lx, lh);

    // asa para arrastrar la esquina y cambiar x
    const asaX = kit.malla(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff6a00, emissiveIntensity: 0.8 }), { padre: g });
    kit.arrastre(asaX, g, {
      normal: [0, 1, 0], punto: [0, 0.2, 0], cursor: 'grab', habilitado: est.habilitado,
      alMover: (p) => fijarX(Math.max(Math.abs(p.x), Math.abs(p.z)) * 2 / dm),
    });

    function fijarX(x) { s.x = Math.min(40, Math.max(10, Math.round(x * 2) / 2)); s.cambio = true; }

    function construir() {
      const L = s.x * dm, H = M.h(s.x) * dm, ext = L + 2 * esp;
      piso.scale.set(ext, esp, ext); piso.position.set(0, esp / 2, 0);
      const y0 = esp, yc = y0 + H / 2;
      muros[0].scale.set(ext, H, esp); muros[0].position.set(0, yc, L / 2 + esp / 2);
      muros[1].scale.set(ext, H, esp); muros[1].position.set(0, yc, -L / 2 - esp / 2);
      muros[2].scale.set(esp, H, L); muros[2].position.set(L / 2 + esp / 2, yc, 0);
      muros[3].scale.set(esp, H, L); muros[3].position.set(-L / 2 - esp / 2, yc, 0);
      agua.scale.set(L - 0.01, H * 0.985, L - 0.01); agua.position.set(0, y0 + (H * 0.985) / 2, 0);
      superficie.scale.set(L - 0.01, L - 0.01, 1); superficie.position.set(0, y0 + H * 0.985 + 0.003, 0);
      const ty = s.tapa ? y0 + H + 0.04 : y0 + H + 0.9;
      tapa.scale.set(ext, 0.06, ext); tapa.position.set(s.tapa ? 0 : -0.25 * ext, ty, s.tapa ? 0 : 0.15); tapa.rotation.z = s.tapa ? 0 : 0.12;
      asa.position.set(tapa.position.x, ty + 0.06, tapa.position.z); asa.rotation.z = tapa.rotation.z;
      persona.position.set(-ext / 2 - 0.9, 0, ext / 2 + 0.6);
      // cotas a lo largo del borde frontal inferior y de la arista frontal derecha
      kit.moverBarra(cotaX, [-L / 2, 0.08, ext / 2 + 0.35], [L / 2, 0.08, ext / 2 + 0.35]);
      kit.moverBarra(cotaH, [ext / 2 + 0.35, y0, ext / 2 + 0.35], [ext / 2 + 0.35, y0 + H, ext / 2 + 0.35]);
      kit.cambiarEtiqueta(lx, `x = ${kit.num(s.x, 1)} dm`); lx.position.set(0, 0.42, ext / 2 + 0.45);
      kit.cambiarEtiqueta(lh, `h = ${kit.num(M.h(s.x), 1)} dm`); lh.position.set(ext / 2 + 0.55, y0 + H / 2, ext / 2 + 0.55);
      asaX.position.set(L / 2 + esp, 0.2, L / 2 + esp);
    }

    // gráfico del costo
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

    let tAgua = 0;
    return {
      paneles: [panel],
      radioSombra: 12,
      alturaCartel: 9.5,
      vista: { escritorio: { camara: [0, 2.9, 9.4], objetivo: [0, 1.9, 0] }, vr: { pos: [0, 0, 6.4], yaw: 0 } },
      dom: [
        { tipo: 'rango', etiqueta: 'x', min: 10, max: 40, paso: 0.5, get: () => s.x, set: (v) => fijarX(v), formato: (v) => `${kit.num(v, 1)} dm` },
        { tipo: 'boton', etiqueta: 'Ir al óptimo', accion: () => fijarX(M.optimo().x) },
        { tipo: 'interruptor', etiqueta: 'Revelar solución', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
        { tipo: 'boton', etiqueta: () => (s.tapa ? 'Levantar la tapa' : 'Bajar la tapa'), accion: () => { s.tapa = !s.tapa; s.cambio = true; } },
      ],
      actualizar(dt) {
        tAgua += dt;
        nrm.offset.set(tAgua * 0.02, tAgua * 0.013);
        if (s.cambio) { s.cambio = false; construir(); graf.setMarker(s.x); panel.invalidate(); }
      },
    };
  },
};
