# Modelo matemático

Este documento recoge la función objetivo, los parámetros y las comprobaciones que usa la escena. El módulo `src/math/problems.js` contiene el mismo modelo sin dependencias y `npm test` lo verifica.

## El problema

Un río rectilíneo de 100 m de ancho separa una planta eléctrica de una fábrica ubicada 500 m río arriba, en la orilla opuesta. El cable cuesta $90 por metro a lo largo de la orilla y $150 por metro sobre el agua. Se pide la longitud del tendido más económico.

## Función objetivo

El cable sigue la orilla de la planta x metros y cruza el río en diagonal hasta la fábrica, a lo largo de y metros. El costo es

C(x, y) = 90x + 150y.

Por el teorema de Pitágoras, el tramo sobre el agua cumple

y = √((500 − x)² + 100²),  con 0 ≤ x ≤ 500.

El intervalo es cerrado e incluye ambos extremos. Al reemplazar y queda una función de una variable,

C(x) = 90x + 150·√((500 − x)² + 100²).

## Solución

La derivada es C′(x) = 90 − 150(500 − x)/√((500 − x)² + 100²). Se anula cuando

(500 − x)/√((500 − x)² + 100²) = 3/5,

es decir, cuando 500 − x = 75, de modo que el punto crítico es x = 425 m y entonces y = 125 m. La derivada es negativa antes de ese punto y positiva después.

Como el intervalo es cerrado, se comparan los candidatos:

| x (m) | y (m) | C (pesos) |
|---|---|---|
| 0 | 509,90 | 76.485 |
| 425 | 125 | 57.000 |
| 500 | 100 | 60.000 |

El mínimo es C(425) = $57.000. La longitud del tendido más económico es x + y = 425 + 125 = 550 m.

La pregunta pide esa longitud, que no es la variable x ni el costo C. La escena muestra x, y, la longitud x + y y el costo a la vez.

## Comprobación

```
npm test
```

Verifica los valores anteriores, compara la derivada con diferencias finitas y confirma por búsqueda numérica sobre el intervalo cerrado que el mínimo está en x = 425.
