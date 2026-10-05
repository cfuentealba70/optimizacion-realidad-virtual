import assert from 'node:assert/strict';
import { RIO } from '../src/math/problems.js';

const casi = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} esperado ${b}, obtenido ${a}`);

// Función objetivo C(x, y) = 90x + 150y con y = sqrt((500 - x)^2 + 100^2)
casi(RIO.y(0), Math.hypot(500, 100), 1e-12, 'y(0)');
casi(RIO.y(500), 100, 1e-12, 'y(500)');
casi(RIO.y(425), 125, 1e-12, 'y(425)');
casi(RIO.costoXY(425, 125), 57000, 1e-9, 'C(425, 125)');
for (const x of [0, 10, 200, 425, 500]) casi(RIO.costo(x), RIO.costoXY(x, RIO.y(x)), 1e-9, 'C(x) = C(x, y(x))');

// Óptimo
const o = RIO.optimo();
casi(o.x, 425, 1e-9, 'x*');
casi(o.y, 125, 1e-9, 'y*');
casi(o.costo, 57000, 1e-6, 'costo mínimo');
casi(o.longitud, 550, 1e-9, 'longitud');
casi(RIO.derivada(o.x), 0, 1e-9, "C'(x*)");
assert.ok(RIO.derivada(400) < 0 && RIO.derivada(450) > 0, 'C decrece antes y crece después de x*');

// Intervalo cerrado: extremos y candidatos
casi(RIO.extremos().x0, 76485.29270389177, 1e-6, 'C(0)');
casi(RIO.extremos().xD, 60000, 1e-9, 'C(500)');
const c = RIO.candidatos();
assert.equal(c.length, 3);
assert.deepEqual(c.map((p) => p.x), [0, 425, 500]);
assert.ok(c[1].costo < c[0].costo && c[1].costo < c[2].costo, 'el mínimo interior mejora a ambos extremos');

// Búsqueda numérica sobre el intervalo cerrado y derivada numérica
let mejor = Infinity, xm = 0;
for (let x = 0; x <= 500; x += 0.01) { const v = RIO.costo(x); if (v < mejor) { mejor = v; xm = x; } }
casi(xm, 425, 0.01, 'mínimo numérico');
for (const x of [0, 10, 100, 300, 425, 490, 500]) {
  const h = 1e-6;
  const num = x === 0 ? (RIO.costo(h) - RIO.costo(0)) / h : x === 500 ? (RIO.costo(500) - RIO.costo(500 - h)) / h : (RIO.costo(x + h) - RIO.costo(x - h)) / (2 * h);
  casi(num, RIO.derivada(x), 1e-4, `derivada numérica en ${x}`);
}

console.log('Pruebas de matemática: todas correctas');
