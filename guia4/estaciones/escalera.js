// Ejercicio 2.2. Escalera de 13 m que resbala por la pared: la base se aleja a 5 m/s.
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
    const reloj = kit.reloj({ t0: 0, t1: M.fin, instante: M.instante, velocidad: 0.25 });
    const s = { revelar: false, ultimo: -1 };

    // Edificio de cuatro pisos: la pared de apoyo es la cara x = 0 (mira hacia +x)
    const estuco = kit.mat('plaster', { repeat: [3, 4], color: 0xf1ebe1, normalScale: 0.6 });
    const edif = kit.caja(9, 13.2, 12, estuco, { x: -4.5, y: 6.6, z: 0, padre: g });
    void edif;
    kit.caja(9.3, 0.5, 12.3, kit.mat('concrete', { repeat: [3, 1], color: 0xb9b4ab }), { x: -4.5, y: 13.45, z: 0, padre: g });
    for (let piso = 0; piso < 4; piso++) kit.caja(0.12, 0.18, 12.05, kit.mat('concrete', { repeat: [4, 1], color: 0xd7d1c6 }), { x: 0.02, y: 3.3 * (piso + 1) - 0.1, z: 0, padre: g });
    const ventanas = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 12.4), new THREE.MeshStandardMaterial({
      map: kit.windowsColorTexture({ cols: 5, rows: 4, seed: 4, base: '#efe7da' }), emissiveMap: kit.windowsTexture({ cols: 5, rows: 4, lit: 0.15, seed: 4 }),
      emissive: 0xffe2b0, emissiveIntensity: 0.4, roughness: 0.6, transparent: true, alphaTest: 0.01,
    }));
    ventanas.rotation.y = Math.PI / 2; ventanas.position.set(0.015, 6.6, -0.6); ventanas.material.opacity = 1;
    // la franja de la pared donde se apoya la escalera queda lisa
    ventanas.scale.set(0.82, 1, 1); ventanas.position.z = -1.4;
    g.add(ventanas);
    // Patio de hormigón donde resbala la base
    const patio = kit.malla(new THREE.PlaneGeometry(16, 7), kit.mat('concrete', { repeat: [6, 3], color: 0xb7b3ab, normalScale: 0.6 }), { rx: -Math.PI / 2, x: 8, y: 0.02, z: 0, sombra: false, padre: g });
    patio.material.polygonOffset = true; patio.material.polygonOffsetFactor = -3;

    // Escalera de aluminio: dos largueros y peldaños cada 30 cm
    const alu = new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 0.85, roughness: 0.3 });
    const escalera = new THREE.Group(); g.add(escalera);
    const largueroGeo = new THREE.BoxGeometry(0.07, M.L, 0.04);
    const l1 = kit.malla(largueroGeo, alu, { z: 0.24, padre: escalera }), l2 = kit.malla(largueroGeo, alu, { z: -0.24, padre: escalera });
    l1.position.y = l2.position.y = M.L / 2;
    const n = Math.floor(M.L / 0.3);
    const peld = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.48, 8), alu, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    for (let i = 0; i < n; i++) { m4.compose(new THREE.Vector3(0, 0.3 * (i + 0.6), 0), q, new THREE.Vector3(1, 1, 1)); peld.setMatrixAt(i, m4); }
    peld.castShadow = true; escalera.add(peld);
    const goma = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    kit.caja(0.12, 0.05, 0.6, goma, { y: 0.02, padre: escalera });

    // Triángulo pared-suelo-escalera y arco del ángulo
    const triGeo = new THREE.BufferGeometry();
    triGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    const tri = new THREE.Mesh(triGeo, new THREE.MeshBasicMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    tri.position.z = 0.6; tri.renderOrder = 3; g.add(tri);
    const arco = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.2, 40, 1, 0, 1), new THREE.MeshBasicMaterial({ color: 0xffd34d, side: THREE.DoubleSide, toneMapped: false }));
    arco.position.z = 0.62; g.add(arco);

    // Cotas y rótulos
    const cotaMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false });
    const cx = kit.barra([0, 0, 0], [0, 1, 0], 0.03, cotaMat), cy = kit.barra([0, 0, 0], [0, 1, 0], 0.03, cotaMat);
    g.add(cx, cy);
    const lx = kit.etiqueta('x', 0.42, { bg: '#ffb347', color: '#1a1206' }), ly = kit.etiqueta('y', 0.42, { bg: '#5cc8ff', color: '#08202c' }), lt = kit.etiqueta('θ', 0.38, { bg: '#ffd34d', color: '#1a1206' });
    const lL = kit.etiqueta('13 m', 0.38);
    g.add(lx, ly, lt, lL);

    function construir() {
      const t = reloj.t, x = M.x(t), y = M.y(t), th = M.angulo(t);
      escalera.position.set(x, 0, 0);
      escalera.rotation.set(0, 0, th - Math.PI / 2 + (Math.PI / 2 - th) * 2); // apunta del pie (x, 0) a la cima (0, y)
      escalera.rotation.z = Math.atan2(y, -x) - Math.PI / 2;
      const p = triGeo.attributes.position;
      p.setXYZ(0, 0, 0, 0); p.setXYZ(1, x, 0, 0); p.setXYZ(2, 0, y, 0); p.needsUpdate = true; triGeo.computeBoundingSphere();
      arco.geometry.dispose(); arco.geometry = new THREE.RingGeometry(1.1, 1.2, 40, 1, Math.PI - th, th);
      arco.position.set(x, 0.02, 0.62);
      kit.moverBarra(cx, [0, 0.06, 1.1], [x, 0.06, 1.1]);
      kit.moverBarra(cy, [0.15, 0, 1.1], [0.15, Math.max(0.01, y), 1.1]);
      kit.cambiarEtiqueta(lx, `x = ${kit.num(x, 2)} m`); lx.position.set(x / 2, 0.55, 1.2);
      kit.cambiarEtiqueta(ly, `y = ${kit.num(y, 2)} m`); ly.position.set(0.9, Math.max(0.6, y / 2), 1.2);
      kit.cambiarEtiqueta(lt, `θ = ${kit.num((th * 180) / Math.PI, 1)}°`); lt.position.set(x - 1.8, 0.8, 0.9);
      lL.position.set(x / 2 + 0.6, y / 2 + 0.6, 0.3);
    }

    const graf = kit.grafico({
      f: (t) => M.y(t), x0: 0, x1: M.fin, y0: 0, y1: 13, width: 1.3, height: 0.8,
      xTicks: [0, 0.4, 0.8, 1.2, 1.6], yTicks: [0, 4, 8, 12], tickFmt: (v) => kit.num(v, 1), yTickFmt: (v) => String(v),
      xLabel: 'tiempo t (s)', yLabel: 'altura y (m)', curveColor: 0x5cc8ff,
    });
    graf.group.position.set(6.6, 1.05, 13.25); graf.group.rotation.y = -0.42;
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
    panel.mesh.position.set(4.65, 1.38, 13.5); panel.mesh.rotation.y = 0.5;
    g.add(panel.mesh);
    panel.register(kit.input, est.habilitado);

    const vel = () => ({ tipo: 'boton', etiqueta: () => (reloj.corriendo ? '❚❚ Pausar' : '▶ Reproducir'), accion: () => reloj.alternar() });
    return {
      paneles: [panel],
      radioSombra: 16,
      alturaCartel: 15,
      vista: { escritorio: { camara: [6.2, 4.2, 19.5], objetivo: [5.2, 4.2, 0] }, vr: { pos: [6, 0, 15], yaw: 0 } },
      dom: [
        vel(),
        { tipo: 'rango', etiqueta: 't', min: 0, max: M.fin, paso: 0.01, get: () => reloj.t, set: (v) => reloj.fijar(v), formato: (v) => `${kit.num(v, 2)} s` },
        { tipo: 'boton', etiqueta: 'Ir a x = 12 m', accion: () => reloj.alInstante() },
        { tipo: 'interruptor', etiqueta: 'Revelar respuesta', get: () => s.revelar, set: (v) => { s.revelar = v; revelar(); } },
      ],
      actualizar(dt, activa) {
        if (activa) reloj.tick(dt);
        if (s.ultimo !== reloj.cambio) {
          s.ultimo = reloj.cambio;
          construir();
          graf.setMarker(reloj.t);
          const d = M.dydt(reloj.t);
          graf.setTangent(reloj.t, Number.isFinite(d) && Math.abs(d) < 60 ? d : null, { color: 0xffd08a, len: 0.4 });
          panel.invalidate();
        }
      },
    };
  },
};
