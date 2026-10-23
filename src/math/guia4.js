// Modelos de los problemas de la Guía 4 (optimización y razón de cambio) que se representan en VR.
// Sin dependencias: los usan las estaciones y las pruebas.

const PI = Math.PI;

// ---------------------------------------------------------------- Optimización

// Ejemplo 3. Cisterna de base y tapa cuadradas, 12.000 dm³. Base y lados $100/dm², tapa $200/dm².
// C(x, h) = 100x² + 400xh + 200x², con x²h = 12.000  =>  C(x) = 300x² + 4.800.000/x,  x > 0
export const CISTERNA = {
  V: 12000, cBase: 100, cLado: 100, cTapa: 200,
  h(x) { return this.V / (x * x); },
  costoXH(x, h) { return this.cBase * x * x + this.cLado * 4 * x * h + this.cTapa * x * x; },
  costo(x) { return this.costoXH(x, this.h(x)); },
  derivada(x) { return 600 * x - 4800000 / (x * x); },
  optimo() { const x = Math.cbrt(4800000 / 600); return { x, h: this.h(x), costo: this.costo(x) }; }, // x = 20, h = 30, C = 360.000
};

// Ejemplo 4. Caja sin tapa desde un cartón cuadrado de 24 pulgadas, cortando cuadrados de lado x.
// V(x) = (24 − 2x)² x,  0 < x < 12
export const CAJA = {
  L: 24,
  base(x) { return this.L - 2 * x; },
  volumen(x) { return this.base(x) ** 2 * x; },
  derivada(x) { return (this.L - 2 * x) * (this.L - 6 * x); }, // = 12(x − 12)(x − 4)
  optimo() { const x = this.L / 6; return { x, base: this.base(x), volumen: this.volumen(x) }; }, // x = 4, V = 1.024
};

// Ejercicio 1.5. Recipiente sin tapa para 10 m³ de arena, largo = 2·ancho. Base $30.000/m², costados $20.000/m².
// ancho w, largo 2w, alto h = 10/(2w²).  C(w, h) = 30.000·2w² + 20.000·(2·2wh + 2·wh)  =>  C(w) = 60.000w² + 600.000/w
export const ARENA = {
  V: 10, cBase: 30000, cLado: 20000,
  h(w) { return this.V / (2 * w * w); },
  costoWH(w, h) { return this.cBase * 2 * w * w + this.cLado * (2 * (2 * w * h) + 2 * (w * h)); },
  costo(w) { return this.costoWH(w, this.h(w)); },
  derivada(w) { return 120000 * w - 600000 / (w * w); },
  optimo() { const w = Math.cbrt(5); return { w, largo: 2 * w, h: this.h(w), costo: this.costo(w) }; }, // w = ∛5 ≈ 1,71
};

// Ejercicio 1.6. Postes de 12 y 28 pies separados 30 pies; estaca a x pies del poste bajo.
// W(x) = √(x² + 12²) + √((30 − x)² + 28²),  0 ≤ x ≤ 30
export const POSTES = {
  h1: 12, h2: 28, d: 30,
  y(x) { return Math.hypot(x, this.h1); },
  z(x) { return Math.hypot(this.d - x, this.h2); },
  largo(x) { return this.y(x) + this.z(x); },
  derivada(x) { return x / this.y(x) - (this.d - x) / this.z(x); },
  optimo() { const x = (this.d * this.h1) / (this.h1 + this.h2); return { x, y: this.y(x), z: this.z(x), largo: this.largo(x) }; }, // x = 9, W = 50
  extremos() { return { x0: this.largo(0), xd: this.largo(this.d) }; },
};

// ---------------------------------------------------------------- Razón de cambio

// Ejemplo 6. Ondas en un lago: dr/dt = 1 pie/s. dA/dt cuando r = 4 pies.  A = πr², dA/dt = 2πr dr/dt
export const ONDAS = {
  drdt: 1,
  r(t) { return this.drdt * t; },
  area(t) { return PI * this.r(t) ** 2; },
  dAdt(t) { return 2 * PI * this.r(t) * this.drdt; },
  instante: 4, // r = 4 pies
  respuesta() { return 8 * PI; },
};

// Ejemplo 7. Dos aviones en trayectorias perpendiculares hacia O. x(0) = 225 mi a 450 mi/h, y(0) = 300 mi a 600 mi/h.
// s² = x² + y²,  s ds/dt = x dx/dt + y dy/dt.  t en horas; el instante del problema es t = 0.
export const AVIONES = {
  x0: 225, y0: 300, vx: -450, vy: -600,
  x(t) { return this.x0 + this.vx * t; },
  y(t) { return this.y0 + this.vy * t; },
  s(t) { return Math.hypot(this.x(t), this.y(t)); },
  dsdt(t) { const s = this.s(t); return s === 0 ? 0 : (this.x(t) * this.vx + this.y(t) * this.vy) / s; },
  instante: 0,
  respuesta() { return -750; }, // mi/h
  llegada() { return this.x0 / -this.vx; }, // ambos llegan a O en t = 0,5 h
};

// Ejemplo 8. Cono de grava con diámetro = altura: V = πh³/12. dV/dt = 30 pies³/min. dh/dt cuando h = 10 pies.
export const GRAVA = {
  dVdt: 30,
  V(t) { return this.dVdt * t; },
  h(t) { return Math.cbrt((12 * this.V(t)) / PI); },
  r(t) { return this.h(t) / 2; },
  dhdt(t) { const h = this.h(t); return h === 0 ? Infinity : (4 * this.dVdt) / (PI * h * h); },
  tParaAltura(h) { return (PI * h ** 3) / 12 / this.dVdt; },
  instante: null, // se fija con tParaAltura(10)
  respuesta() { return 6 / (5 * PI); }, // ≈ 0,382 pies/min
};
GRAVA.instante = GRAVA.tParaAltura(10);

// Ejercicio 2.2. Escalera de 13 m; la base se aleja a 5 m/s. Instante: base a 12 m de la casa.
// x² + y² = 169; dy/dt = −x dx/dt / y;  área = xy/2;  cos θ = x/13, dθ/dt = −(dx/dt)/(13 sen θ)
export const ESCALERA = {
  L: 13, dxdt: 5, x0: 5,
  x(t) { return Math.min(this.L, this.x0 + this.dxdt * t); },
  y(t) { const x = this.x(t); return Math.sqrt(Math.max(0, this.L * this.L - x * x)); },
  dydt(t) { const y = this.y(t); return y === 0 ? -Infinity : (-this.x(t) * this.dxdt) / y; },
  area(t) { return (this.x(t) * this.y(t)) / 2; },
  dAdt(t) { return 0.5 * (this.dxdt * this.y(t) + this.x(t) * this.dydt(t)); },
  angulo(t) { return Math.acos(this.x(t) / this.L); },
  dthdt(t) { const s = Math.sin(this.angulo(t)); return s === 0 ? -Infinity : -this.dxdt / (this.L * s); },
  instante: (12 - 5) / 5, // t = 1,4 s
  fin: (13 - 5) / 5,
  respuesta() { return { dydt: -12, dAdt: -59.5, dthdt: -1 }; },
};

// Ejercicio 2.4. Depósito cónico con vértice abajo, altura 10 m y radio 15 m. Sale 1 m³/s y entra c.
// r = 1,5h, V = (3π/4)h³, dV/dt = (9π/4)h² dh/dt = c − 1.  dh/dt = 4 m/s cuando h = 1  =>  c = 1 + 9π
export const DEPOSITO = {
  H: 10, R: 15, salida: 1,
  radio(h) { return (this.R / this.H) * h; },
  V(h) { return (PI / 3) * this.radio(h) ** 2 * h; },
  dhdt(h, c) { return h <= 0 ? Infinity : (c - this.salida) / ((9 * PI) / 4 * h * h); },
  cPara(h, dh) { return this.salida + (9 * PI) / 4 * h * h * dh; },
  respuesta() { return 1 + 9 * PI; }, // ≈ 29,27 m³/s
};

// Ejercicio 2.5. Auto A hacia el este a 90 km/h, auto B hacia el sur a 60 km/h, ambos hacia el cruce.
// Instante: A a 0,2 km y B a 0,15 km del cruce. s ds/dt = x dx/dt + y dy/dt.  t en horas.
export const AUTOS = {
  x0: 0.2, y0: 0.15, vx: -90, vy: -60,
  x(t) { return this.x0 + this.vx * t; },
  y(t) { return this.y0 + this.vy * t; },
  s(t) { return Math.hypot(this.x(t), this.y(t)); },
  dsdt(t) { const s = this.s(t); return s === 0 ? 0 : (this.x(t) * this.vx + this.y(t) * this.vy) / s; },
  instante: 0,
  respuesta() { return -108; }, // km/h
};

// Cifras con el formato del idioma de la interfaz (es-CL: 1.024,5 · en-US: 1,024.5 · pt-BR: 1.024,5).
// src/common/i18n.js deja el código regional en globalThis.__g4Locale; sin él (pruebas), se usa es-CL.
const locale = () => globalThis.__g4Locale || 'es-CL';
export function num(n, d = 2) {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '−∞';
  const s = Math.abs(n).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
  return (n < 0 && Number(Math.abs(n).toFixed(d)) !== 0 ? '−' : '') + s;
}
export function pesos(n) { return '$' + Math.round(n).toLocaleString(locale()); }
