import assert from 'node:assert/strict';
import { REACCION, RIO } from '../src/math/problems.js';

const casi = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} esperado ${b}, obtenido ${a}`);

// Problema 1
casi(REACCION.tMax, 10 / 3, 1e-12, 'tMax');
casi(REACCION.dC(REACCION.tMax), 0, 1e-12, "C'(10/3)");
casi(REACCION.CMax, 40 / (3 * Math.E), 1e-12, 'CMax');
casi(REACCION.CMax, 4.905059215619, 1e-9, 'CMax numérico');
assert.ok(REACCION.d2C(REACCION.tMax) < 0, "C''(10/3) < 0");
casi(REACCION.C(2), 4.3904930887, 1e-9, 'C(2)');
casi(REACCION.C(4), 4.8191073904, 1e-9, 'C(4)');
assert.ok(REACCION.dC(3) > 0 && REACCION.dC(4) < 0);
assert.equal(REACCION.C(0), 0);
assert.ok(REACCION.C(200) < 1e-15);
// derivada numérica coincide
for (const t of [0.5, 1, 2, 3.3, 5, 9]) {
  const h = 1e-6;
  casi((REACCION.C(t + h) - REACCION.C(t - h)) / (2 * h), REACCION.dC(t), 1e-6, `dC(${t})`);
  casi((REACCION.dC(t + h) - REACCION.dC(t - h)) / (2 * h), REACCION.d2C(t), 1e-6, `d2C(${t})`);
}

// Problema 2
for (const v of ['orilla', 'agua']) {
  const o = RIO.optimo(v);
  casi(o.costo, 57000, 1e-6, `costo óptimo ${v}`);
  casi(o.longitud, 550, 1e-9, `longitud óptima ${v}`);
  casi(RIO.derivada(o.x, v), 0, 1e-9, `derivada en el óptimo ${v}`);
  // el interior mejora a ambos extremos
  const e = RIO.extremos(v);
  assert.ok(o.costo < e.x0 && o.costo < e.xD);
  // búsqueda numérica
  let mejor = Infinity, xm = 0;
  for (let x = 0; x <= 500; x += 0.01) { const c = RIO.costo(x, v); if (c < mejor) { mejor = c; xm = x; } }
  casi(xm, o.x, 0.01, `minimo numérico ${v}`);
  // derivada numérica
  for (const x of [10, 100, 300, 425, 490]) {
    const h = 1e-6;
    casi((RIO.costo(x + h, v) - RIO.costo(x - h, v)) / (2 * h), RIO.derivada(x, v), 1e-5, `d costo ${v} ${x}`);
  }
}
casi(RIO.optimo('orilla').x, 425, 1e-9);
casi(RIO.optimo('agua').x, 75, 1e-9);
casi(RIO.extremos('orilla').x0, 76485.29270389177, 1e-6);
casi(RIO.extremos('orilla').xD, 60000, 1e-9);
// ambas variantes describen la misma curva espejada
for (const x of [0, 50, 200, 425, 500]) casi(RIO.costo(x, 'orilla'), RIO.costo(500 - x, 'agua'), 1e-9, 'espejo');

console.log('Pruebas de matemática: todas correctas');
