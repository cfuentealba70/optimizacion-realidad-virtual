// Modelos matemáticos de los dos problemas. Sin dependencias: se usa en las escenas y en las pruebas.

// ---------------------------------------------------------------------------
// Problema 1. Reacción química: C(t) = 4 t e^(-0,3 t), t >= 0 (t en horas, C en mol/L)
// ---------------------------------------------------------------------------
export const REACCION = {
  k: 0.3,
  a: 4,
  C(t) { return this.a * t * Math.exp(-this.k * t); },
  dC(t) { return this.a * Math.exp(-this.k * t) * (1 - this.k * t); },
  d2C(t) { return this.a * Math.exp(-this.k * t) * (-2 * this.k + this.k * this.k * t); },
  // C'(t) = 0  <=>  1 - k t = 0
  get tMax() { return 1 / this.k; },
  get CMax() { return this.C(this.tMax); }, // 40 / (3 e)
};

// ---------------------------------------------------------------------------
// Problema 2. Río y cable
// Río rectilíneo de ancho W, fábrica a una distancia D río arriba en la orilla opuesta.
// Cable por la orilla: a $/m. Cable sobre el agua: b $/m (b > a).
// Variante 'orilla': el cable sigue la orilla de la planta u metros y cruza en diagonal hasta la fábrica.
//   C(u) = a u + b sqrt((D - u)^2 + W^2),  0 <= u <= D
// Variante 'agua': el cable cruza primero hasta un punto de la orilla opuesta a v metros de la
//   perpendicular a la planta y sigue por esa orilla.
//   C(v) = b sqrt(v^2 + W^2) + a (D - v),  0 <= v <= D
// ---------------------------------------------------------------------------
export const RIO = {
  W: 100,
  D: 500,
  a: 90,
  b: 150,

  costo(x, variante = 'orilla') {
    const { W, D, a, b } = this;
    return variante === 'orilla'
      ? a * x + b * Math.hypot(D - x, W)
      : b * Math.hypot(x, W) + a * (D - x);
  },
  derivada(x, variante = 'orilla') {
    const { W, D, a, b } = this;
    return variante === 'orilla'
      ? a - b * (D - x) / Math.hypot(D - x, W)
      : b * x / Math.hypot(x, W) - a;
  },
  // Longitud total del cable (suma de ambos tramos)
  longitud(x, variante = 'orilla') {
    const { W, D } = this;
    return variante === 'orilla'
      ? x + Math.hypot(D - x, W)
      : Math.hypot(x, W) + (D - x);
  },
  tramoOrilla(x, variante = 'orilla') { return variante === 'orilla' ? x : this.D - x; },
  tramoAgua(x, variante = 'orilla') {
    const { W, D } = this;
    return variante === 'orilla' ? Math.hypot(D - x, W) : Math.hypot(x, W);
  },
  // Ley de Snell de costos: (D - u)/sqrt((D-u)^2+W^2) = a/b  =>  D - u = W a / sqrt(b^2 - a^2)
  get avance() { return this.W * this.a / Math.sqrt(this.b * this.b - this.a * this.a); }, // 75 m
  optimo(variante = 'orilla') {
    const x = variante === 'orilla' ? this.D - this.avance : this.avance;
    return { x, costo: this.costo(x, variante), longitud: this.longitud(x, variante) };
  },
  extremos(variante = 'orilla') {
    return { x0: this.costo(0, variante), xD: this.costo(this.D, variante) };
  },
};

export function formatoPesos(n) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}
export function formatoNum(n, d = 2) {
  return n.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
}
