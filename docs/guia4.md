# Guía 4: optimización y razón de cambio en realidad virtual

El mundo `guia4/` reúne en una obra con sus alrededores los problemas de la Guía 4 de Cálculo en una variable cuyo contexto se puede representar de manera realista. Cada problema es una estación con su escena a escala real, la función objetivo o la relación entre las razones, un panel de control y un gráfico. El módulo `src/math/guia4.js` contiene los modelos y `node tests/guia4.test.mjs` los verifica.

## Qué problemas se modelan y cuáles no

Un problema entra al mundo cuando su contexto se puede ver y manipular a escala real: un objeto que cambia de forma, algo que se mueve o se llena. Quedan fuera los problemas abstractos y aquellos cuyo cambio sería imperceptible a simple vista.

| Problema | Contexto | Decisión |
|---|---|---|
| Ejemplo 1 | Alambre de 2 m doblado en un rectángulo | Fuera: figura plana, la realidad virtual no agrega información |
| Ejemplo 2 | Alambre de 4 m para un cuadrado y un círculo | Fuera: figuras planas |
| Ejemplo 3 | Cisterna de base y tapa cuadradas | **Estación «Cisterna de costo mínimo»** |
| Ejemplo 4 | Caja sin tapa desde un cartón | **Estación «Caja de volumen máximo»** |
| Ejemplo 5 | Distancia del origen a una recta | Fuera: geometría analítica sin contexto físico |
| Ejercicio 1.1 | Dos números de producto 185 | Fuera: sin contexto |
| Ejercicio 1.2 | Hoja con márgenes | Fuera: una hoja de papel no gana nada en tres dimensiones |
| Ejercicio 1.3 | Rectángulo inscrito en un semicírculo | Fuera: sin contexto |
| Ejercicio 1.4 | Puntos de una parábola cercanos a un punto | Fuera: sin contexto |
| Ejercicio 1.5 | Recipiente sin tapa para arena | **Estación «Recipiente para arena»** |
| Ejercicio 1.6 | Dos postes con cables a una estaca | **Estación «Cable mínimo entre dos postes»** |
| Ejercicio 1.7 | Cable de una planta eléctrica a una fábrica a través de un río | **Estación «Río y cable»**, con maqueta y vista a escala real |
| Ejemplo 6 | Ondas en un lago | **Estación «Ondas en un lago»** |
| Ejemplo 7 | Dos aviones que convergen | **Estación «Aviones que convergen»** |
| Ejemplo 8 | Cono de grava desde una correa | **Estación «Cono de grava»** |
| Ejercicio 2.1 | Plato que se dilata en un horno | Fuera: el cambio del radio (0,01 cm/min) es invisible |
| Ejercicio 2.2 | Escalera que resbala | **Estación «Escalera que resbala»** |
| Ejercicio 2.3 | Bola de nieve que se derrite | Fuera: el cambio del radio es imperceptible |
| Ejercicio 2.4 | Depósito cónico que se llena | **Estación «Depósito cónico»** |
| Ejercicio 2.5 | Dos autos hacia un cruce | **Estación «Dos autos hacia el cruce»** |

## Modelos y respuestas

**Cisterna (Ejemplo 3).** C(x, h) = 100x² + 400xh + 200x² con x²h = 12.000 dm³, de modo que C(x) = 300x² + 4.800.000/x para x > 0. C′(x) = 600x − 4.800.000/x² se anula en x = 20 dm, con h = 30 dm y C = $360.000. C″(20) > 0.

**Caja (Ejemplo 4).** V(x) = (24 − 2x)²·x para 0 < x < 12 pulgadas. V′(x) = 12(x − 4)(x − 12) se anula en x = 4 dentro del dominio, y V(4) = 1.024 pulgadas³ es el máximo.

**Recipiente para arena (Ejercicio 1.5).** Con ancho w, largo 2w y alto h, el volumen 2w²h = 10 da h = 5/w². C(w) = 60.000w² + 600.000/w. C′(w) = 0 en w = ∛5 ≈ 1,71 m, con largo ≈ 3,42 m, alto ≈ 1,71 m y costo ≈ $526.323.

**Postes y cables (Ejercicio 1.6).** W(x) = √(x² + 12²) + √((30 − x)² + 28²) para 0 ≤ x ≤ 30 pies. W′(x) = 0 equivale a x/12 = (30 − x)/28, de donde x = 9 pies y W = 50 pies. Los extremos valen W(0) ≈ 53,04 y W(30) ≈ 60,31.

**Río y cable (Ejercicio 1.7).** C(x, y) = 90x + 150y con y = √((500 − x)² + 100²) y 0 ≤ x ≤ 500 m. C′(x) = 90 − 150(500 − x)/√((500 − x)² + 100²) se anula cuando (500 − x)/y = 3/5, es decir en x = 425 m con y = 125 m. El costo mínimo es $57.000 y el tendido mide 550 m. Los extremos valen C(0) ≈ $76.485 y C(500) = $60.000. Las comprobaciones están en [modelo.md](modelo.md).

**Ondas (Ejemplo 6).** A = πr² y dA/dt = 2πr·dr/dt. Con r = 4 pies y dr/dt = 1 pie/s, dA/dt = 8π ≈ 25,13 pies²/s.

**Dos aviones (Ejemplo 7).** s² = x² + y² y s·ds/dt = x·dx/dt + y·dy/dt. Con x = 225, y = 300, s = 375, dx/dt = −450 y dy/dt = −600, ds/dt = −281.250/375 = −750 mi/h.

**Cono de grava (Ejemplo 8).** V = πh³/12 y dV/dt = (π/4)h²·dh/dt. Con dV/dt = 30 pies³/min y h = 10 pies, dh/dt = 6/(5π) ≈ 0,382 pies/min.

**Escalera (Ejercicio 2.2).** x² + y² = 169. Con x = 12 m, y = 5 m y dx/dt = 5 m/s: dy/dt = −12 m/s, el área A = xy/2 cambia a dA/dt = −59,5 m²/s y el ángulo con el suelo a dθ/dt = −1 rad/s.

**Depósito cónico (Ejercicio 2.4).** r = 1,5h y V = (3π/4)h³, así que (9π/4)h²·dh/dt = c − 1. Para dh/dt = 4 m/s en h = 1 m, c = 1 + 9π ≈ 29,27 m³/s.

**Dos autos (Ejercicio 2.5).** s·ds/dt = x·dx/dt + y·dy/dt con x = 0,2 km, y = 0,15 km, s = 0,25 km, dx/dt = −90 km/h y dy/dt = −60 km/h: ds/dt = −108 km/h.

## Observaciones sobre el texto de la guía

- Ejemplo 4: la solución impresa después de la función objetivo repite la de la cisterna (costo, x = 20 dm). La correcta es x = 4 pulgadas y V = 1.024 pulgadas³.
- Ejemplo 5: el dominio se justifica con la frase de otro problema («la longitud del lado de la base… que exista volumen»). El dominio es todo ℝ.
- Ejemplo 6: la lista de variables define A(t) como «radio»; es el área.
- Ejemplo 7: dice −281280 en lugar de −281.250 y la respuesta lleva unidades mi²/h en lugar de mi/h.
- Ejemplo 8: en los hechos numéricos aparece dV/dt = 30π, pero el enunciado y el cálculo usan 30.
- Ejercicio 2.4: el caudal de entrada se escribe en cm³ por segundo mientras la salida y la altura están en metros. Con m³/s el problema es coherente y da c = 1 + 9π.
