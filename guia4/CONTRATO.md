# Contrato de las estaciones de la Guía 4

Cada estación es un módulo `guia4/estaciones/<id>.js` con una exportación por defecto. El mundo (`guia4/world.js`) crea un `THREE.Group` por estación, lo ubica según `LAYOUT` y llama a `crear(kit, est)`. Las estaciones de referencia son `cisterna.js` (optimización) y `escalera.js` (razón de cambio): sigue su estructura.

## Forma del módulo

```js
import { CAJA as M } from '../../src/math/guia4.js';

export default {
  id: 'caja',                         // igual al nombre del archivo y al id de LAYOUT
  tipo: 'optimizacion',               // o 'razon'
  etiqueta: 'Ejemplo 4 · Optimización',
  titulo: 'Caja de volumen máximo',   // corto, va en el cartel naranja y en el menú
  resumen: 'Enunciado completo...',   // se muestra en el recuadro de la página
  crear(kit, est) {
    // est.grupo: THREE.Group ya ubicado en el mundo. Todo lo de la estación va dentro de él.
    // est.habilitado(): true si la estación está visible (pásalo a panel.register y a kit.arrastre).
    return {
      paneles: [panel],               // paneles creados con kit.panelEstandar (el mundo los redibuja)
      vista: {
        escritorio: { camara: [x, y, z], objetivo: [x, y, z] },   // coordenadas locales
        vr: { pos: [x, 0, z], yaw: 0 },                            // donde queda la persona en VR (mira hacia -z local si yaw = 0)
      },
      dom: [ /* controles de escritorio, ver abajo */ ],
      actualizar(dt, activa) { /* cada cuadro, solo si está cerca o activa */ },
      radioSombra: 15,                // radio de la zona de sombras en metros
      alturaCartel: 6,                // altura del cartel con el título
    };
  },
};
```

## Convenciones

- Unidades del mundo: metros, y hacia arriba. El suelo del mundo ya existe en y = 0 (plano dentro de la obra). No crees suelo propio salvo un parche (tierra, grava, losa) con `polygonOffset` para que no parpadee.
- La persona en VR mira la estación desde `vista.vr.pos`, normalmente en +z local, hacia -z. Coloca el panel de control a unos 1,3 m de ese punto, adelante a la izquierda, a 1,38 m de altura y girado hacia la persona (`rotation.y ≈ 0.5`). Coloca el gráfico adelante a la derecha, a 1,05 m de altura, girado `≈ -0.42`. Mira cómo lo hace `cisterna.js`.
- Agrega una persona de referencia de 1,75 m cuando ayude a leer la escala.
- Todo el texto va en español de Chile, sobrio, con coma decimal (`kit.num(v, d)`) y pesos con punto de miles (`kit.pesos(v)`).
- No modifiques archivos compartidos (`kit.js`, `world.js`, `src/common/*`, `src/math/*`, `css/*`). Si te falta algo, resuélvelo dentro de tu archivo de estación.
- Rendimiento para Meta Quest 3: menos de 60.000 triángulos por estación, `InstancedMesh` para objetos repetidos, nada de reconstruir geometría en cada cuadro (usa un contador de cambios como `s.cambio` o `reloj.cambio`), y libera (`dispose`) la geometría que reemplaces.

## Kit (`kit`)

- `kit.THREE`, `kit.app`, `kit.input`, `kit.THEME`, `kit.num(v, d)`, `kit.pesos(v)`.
- Materiales PBR procedurales: `kit.mat(tipo, { repeat: [u, v], color, roughness, metalness, normalScale })`. Tipos: `concrete`, `grass`, `gravel`, `sand`, `soil`, `metal`, `ribbed`, `tiles`, `brick`, `wood`, `cardboard`, `asphalt`, `plaster`, `roof`. Para agua: `kit.makeSurface('noiseNormal', { repeat, roughness: false }).normalMap` y desplaza su `offset` en `actualizar`.
- Geometría: `kit.malla(geo, mat, { x, y, z, rx, ry, rz, sombra, recibe, padre })`, `kit.caja(w, h, d, mat, opciones)`, `kit.cilindro(r0, r1, h, mat, opciones)`, `kit.barra([x,y,z], [x,y,z], radio, mat)` y `kit.moverBarra(barra, a, b)` para cables y cotas.
- Rótulos que miran a la persona: `kit.etiqueta(texto, altoEnMetros, { bg, color })` y `kit.cambiarEtiqueta(rotulo, texto)`.
- Arrastre: `kit.arrastre(objeto, referencia, { normal: [0,1,0], punto: [0,0,0], alMover(puntoLocal), habilitado: est.habilitado, cursor })`. Corta el rayo con un plano fijo de `referencia` y entrega el punto en sus coordenadas locales.
- Reloj de las razones de cambio: `kit.reloj({ t0, t1, instante, velocidad })` con `t`, `corriendo`, `cambio`, `tick(dt)`, `fijar(t)`, `alternar()`, `reiniciar()`, `alInstante()`.
- Panel estándar: `kit.panelEstandar({ etiqueta, titulo, enunciado, ecuaciones: [texto | () => texto], lecturas: [{ etiqueta, valor: () => texto, color, escala }], deslizadores: [{ etiqueta, min, max, paso, get, set, formato, color }], botones: [{ etiqueta, accion } | { etiqueta, tipo: 'interruptor', get, set }], pie: () => texto, pieColor: () => color })`. Después: `panel.mesh` (ubícalo y agrégalo al grupo) y `panel.register(kit.input, est.habilitado)`. Llama `panel.invalidate()` cuando cambien los valores.
- Gráfico: `kit.grafico({ f, x0, x1, y0, y1, width, height, xTicks, yTicks, xLabel, yLabel, curveColor, tickFmt, yTickFmt })` devuelve `{ group, setMarker(x), addPoint(id, x, y, { color, labelX, labelY, guides, hollow, radiusP }), removePoint(id), setTangent(x, pendiente, { color, len }), xFromLocal(xLocal), width, height }`. Usa `hollow: true` para extremos excluidos del dominio y puntos llenos para extremos incluidos.

## Controles de escritorio (`dom`)

```js
dom: [
  { tipo: 'rango', etiqueta: 'x', min, max, paso, get, set, formato: (v) => texto },
  { tipo: 'boton', etiqueta: 'Ir al óptimo' | () => texto, accion },
  { tipo: 'interruptor', etiqueta: 'Revelar solución', get, set },
]
```

## Pedagogía común

- Optimización: muestra la función objetivo con dos variables, la ecuación que liga las variables y la función de una variable con su dominio. Ofrece «Ir al óptimo» y «Revelar solución». La solución (valor crítico, criterio y respuesta con unidades) aparece solo al revelar. Señala los extremos del dominio en el gráfico.
- Razón de cambio: anima el fenómeno con el reloj. Muestra la ecuación que relaciona las variables y su derivada respecto del tiempo, las lecturas de las variables y sus razones, y el instante del problema con un botón «Ir al instante». La tangente del gráfico en el instante actual muestra la razón. La respuesta aparece solo al revelar.

## Cómo probar

1. `npm test` y `node --check guia4/estaciones/<id>.js` desde la carpeta del repositorio.
2. `npm start` y abre `http://localhost:8123/guia4/index.html?estacion=<id>`. La estación debe cargar sin errores en la consola; si falla, el mundo muestra un cartel «en construcción» en su lugar. `window.__g4.estaciones` indica qué estación tuvo error.
3. Revisa la vista de escritorio y la vista desde `vista.vr.pos`, a 1,6 m de altura y mirando hacia -z local. Comprueba que la escena se vea realista, que los paneles se lean y que no haya objetos atravesados ni flotando.
4. Para la sesión de realidad virtual sin casco, abre `tests/xr-guia4.html` después de `npm install`: emula unas Meta Quest 3.
