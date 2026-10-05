// Modelo matemático del problema del río y el cable. Sin dependencias: lo usan la escena y las pruebas.
//
// Un río rectilíneo de ancho W separa una planta eléctrica de una fábrica ubicada D metros río arriba,
// en la orilla opuesta. El cable cuesta a por metro a lo largo de la orilla y b por metro sobre el agua.
//
// El cable sigue la orilla de la planta x metros y cruza el río en diagonal hasta la fábrica.
//   Función objetivo:  C(x, y) = a x + b y
//   Restricción:       y = sqrt((D - x)^2 + W^2)   (teorema de Pitágoras)
//   Dominio:           0 <= x <= D   (intervalo cerrado: incluye ambos extremos)
// Al reemplazar y queda C(x) = a x + b sqrt((D - x)^2 + W^2).
export const RIO = {
  W: 100,
  D: 500,
  a: 90,
  b: 150,

  y(x) { return Math.hypot(this.D - x, this.W); },
  costoXY(x, y) { return this.a * x + this.b * y; },
  costo(x) { return this.costoXY(x, this.y(x)); },
  derivada(x) { return this.a - (this.b * (this.D - x)) / this.y(x); },
  // Longitud total del cable: tramo por la orilla más tramo sobre el agua
  longitud(x) { return x + this.y(x); },

  // C'(x) = 0  <=>  (D - x) / sqrt((D - x)^2 + W^2) = a / b  <=>  D - x = W a / sqrt(b^2 - a^2)
  get avance() { return (this.W * this.a) / Math.sqrt(this.b * this.b - this.a * this.a); }, // 75 m
  datos(x) { return { x, y: this.y(x), costo: this.costo(x), longitud: this.longitud(x) }; },
  optimo() { return this.datos(this.D - this.avance); },
  // Método del intervalo cerrado: el punto crítico y los dos extremos
  candidatos() { return [this.datos(0), this.optimo(), this.datos(this.D)]; },
  extremos() { return { x0: this.costo(0), xD: this.costo(this.D) }; },
};

export function formatoPesos(n) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}
export function formatoNum(n, d = 2) {
  return n.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
}
