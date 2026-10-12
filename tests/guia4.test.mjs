import assert from 'node:assert/strict';
import { CISTERNA, CAJA, ARENA, POSTES, ONDAS, AVIONES, GRAVA, ESCALERA, DEPOSITO, AUTOS, num } from '../src/math/guia4.js';

const casi = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg}: esperado ${b}, obtenido ${a}`);
const dnum = (f, x, h = 1e-6) => (f(x + h) - f(x - h)) / (2 * h);

// Cisterna
let o = CISTERNA.optimo();
casi(o.x, 20, 1e-9, 'cisterna x'); casi(o.h, 30, 1e-9, 'cisterna h'); casi(o.costo, 360000, 1e-6, 'cisterna costo');
for (const x of [5, 15, 20, 33]) casi(dnum((v) => CISTERNA.costo(v), x), CISTERNA.derivada(x), 1e-3, 'cisterna derivada');

// Caja
o = CAJA.optimo();
casi(o.x, 4, 1e-12, 'caja x'); casi(o.volumen, 1024, 1e-9, 'caja V');
for (const x of [1, 4, 7, 11]) casi(dnum((v) => CAJA.volumen(v), x), CAJA.derivada(x), 1e-4, 'caja derivada');
assert.ok(CAJA.volumen(3.9) < 1024 && CAJA.volumen(4.1) < 1024);

// Recipiente de arena
o = ARENA.optimo();
casi(o.w, Math.cbrt(5), 1e-12, 'arena w'); casi(o.h, Math.cbrt(5), 1e-9, 'arena h'); casi(o.costo, 526323.192878316, 1e-4, 'arena costo');
casi(2 * o.w * o.w * o.h, 10, 1e-9, 'arena volumen');
for (const w of [1, 1.71, 2.5]) casi(dnum((v) => ARENA.costo(v), w), ARENA.derivada(w), 1e-2, 'arena derivada');

// Postes
o = POSTES.optimo();
casi(o.x, 9, 1e-12, 'postes x'); casi(o.largo, 50, 1e-9, 'postes W'); casi(o.y, 15, 1e-9); casi(o.z, 35, 1e-9);
casi(POSTES.extremos().x0, 53.0365690573664, 1e-9); casi(POSTES.extremos().xd, 60.310988842807, 1e-9);
casi(POSTES.derivada(9), 0, 1e-12, 'postes derivada nula');

// Ondas
casi(ONDAS.dAdt(ONDAS.instante), 8 * Math.PI, 1e-12, 'ondas');
casi(dnum((t) => ONDAS.area(t), 4), 8 * Math.PI, 1e-6);

// Aviones
casi(AVIONES.s(0), 375, 1e-12); casi(AVIONES.dsdt(0), -750, 1e-9, 'aviones');
casi(dnum((t) => AVIONES.s(t), 0.1), -750, 1e-5);
casi(AVIONES.llegada(), 0.5, 1e-12);

// Grava
const tg = GRAVA.instante;
casi(GRAVA.h(tg), 10, 1e-9, 'grava h'); casi(GRAVA.dhdt(tg), 6 / (5 * Math.PI), 1e-12, 'grava dh/dt');
casi(dnum((t) => GRAVA.h(t), tg), 6 / (5 * Math.PI), 1e-6);

// Escalera
const te = ESCALERA.instante;
casi(ESCALERA.x(te), 12, 1e-12); casi(ESCALERA.y(te), 5, 1e-12);
casi(ESCALERA.dydt(te), -12, 1e-12, 'escalera dy/dt'); casi(ESCALERA.dAdt(te), -59.5, 1e-12, 'escalera dA/dt'); casi(ESCALERA.dthdt(te), -1, 1e-12, 'escalera dθ/dt');
casi(dnum((t) => ESCALERA.y(t), te), -12, 1e-5);
casi(dnum((t) => ESCALERA.area(t), te), -59.5, 1e-5);

// Depósito
casi(DEPOSITO.respuesta(), 1 + 9 * Math.PI, 1e-12);
casi(DEPOSITO.dhdt(1, DEPOSITO.respuesta()), 4, 1e-12, 'depósito dh/dt');
casi(DEPOSITO.V(10), (Math.PI / 3) * 225 * 10, 1e-9);

// Autos
casi(AUTOS.s(0), 0.25, 1e-12); casi(AUTOS.dsdt(0), -108, 1e-9, 'autos');
casi(dnum((t) => AUTOS.s(t), 0, 1e-8), -108, 1e-4);

assert.equal(num(-0.0001, 2), '0,00');
console.log('Pruebas de la Guía 4: todas correctas');
