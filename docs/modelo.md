# Modelos matemáticos

Este documento recoge las funciones, los parámetros y las comprobaciones que usan las dos escenas. El módulo `src/math/problems.js` contiene el mismo modelo sin dependencias y `npm test` lo verifica.

## 1. Reacción química

La concentración C (mol/L) de un producto formado durante la reacción varía con el tiempo t (horas) según

C(t) = 4t e^(−0,3t),  t ≥ 0.

Se pide el instante en que la concentración alcanza su valor máximo y ese valor.

La función objetivo es C. Su derivada es C′(t) = 4e^(−0,3t)(1 − 0,3t), que solo se anula en t = 10/3 h (3 horas y 20 minutos). La derivada es positiva antes de ese instante y negativa después. Como C(0) = 0 y C(t) tiende a 0 cuando t crece, el máximo es absoluto:

C(10/3) = 40/(3e) ≈ 4,905 mol/L.

Valores de control: C(2) ≈ 4,390 y C(4) ≈ 4,819. La segunda derivada en el punto crítico vale ≈ −0,441.

En la escena, el instante (eje t, en horas) y el valor máximo (eje C, en mol/L) se marcan con guías hacia cada eje. Las burbujas del reactor aparecen mientras C′(t) > 0.

## 2. Río y cable

Un río rectilíneo de ancho W = 100 m separa una planta eléctrica de una fábrica ubicada D = 500 m río arriba, en la orilla opuesta. El cable cuesta a = 90 por metro a lo largo de la orilla y b = 150 por metro sobre el agua. Se pide la longitud del tendido más económico.

Hay dos formas equivalentes de definir la variable.

**Orilla primero.** El cable sigue la orilla de la planta x metros y cruza en diagonal hasta la fábrica.

C(x) = 90x + 150·√((500 − x)² + 100²),  0 ≤ x ≤ 500.

**Agua primero.** El cable cruza hasta un punto de la orilla opuesta, a x metros de la perpendicular a la planta, y sigue por esa orilla.

C(x) = 150·√(x² + 100²) + 90·(500 − x),  0 ≤ x ≤ 500.

La condición C′(x) = 0 equivale a que el avance sin recorrer por la orilla sea W·a/√(b² − a²) = 75 m. Por eso el óptimo es x = 425 m en la primera variante y x = 75 m en la segunda. En ambas el costo mínimo es $57.000 y la longitud del tendido es 550 m.

Los extremos del dominio cuestan más: $76.485 en el cruce directo y $60.000 cuando todo el tendido va por la orilla.

El enunciado pregunta por la longitud del tendido. Esa magnitud no es la variable x ni el costo C(x), y la escena muestra las tres a la vez.

## Comprobación

```
npm test
```

Verifica los valores anteriores, compara las derivadas con diferencias finitas y confirma por búsqueda numérica que los óptimos son los indicados.
