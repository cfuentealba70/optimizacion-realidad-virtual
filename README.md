# Optimización y razón de cambio en realidad virtual

Problemas de Cálculo en una variable modelados como escenas WebXR. Funcionan en el navegador de escritorio y en las gafas Meta Quest 3.

**La obra (Guía 4).** Un mundo con diez estaciones a escala real, una por problema de la guía cuyo contexto se puede representar de manera realista: cisterna de costo mínimo, caja de volumen máximo, recipiente para arena y cable mínimo entre dos postes (optimización), y ondas en un lago, aviones que convergen, cono de grava, escalera que resbala, depósito cónico y dos autos hacia un cruce (razón de cambio). Cada estación tiene su panel con la función objetivo o la relación entre las razones, un gráfico y la respuesta, que aparece solo cuando se pide. La selección de problemas, los modelos y las observaciones sobre la guía están en [docs/guia4.md](docs/guia4.md).

**Río y cable.** Un valle con una planta eléctrica y una fábrica separadas por un río de 100 m. La función objetivo es C(x, y) = 90x + 150y, con y = √((500 − x)² + 100²) y 0 ≤ x ≤ 500. Se arrastra el poste a lo largo de la orilla y se comparan x, y, la longitud del tendido y el costo. Hay una maqueta sobre una mesa y una vista a escala real.

Las fórmulas y las comprobaciones del río están en [docs/modelo.md](docs/modelo.md).

Sitio publicado: https://cfuentealba70.github.io/optimizacion-realidad-virtual/

## Uso

En las Quest 3, abre https://cfuentealba70.github.io/optimizacion-realidad-virtual/ en el navegador de las gafas, entra en una escena y pulsa **Entrar en VR**. Con el mando se apunta y se aprieta el gatillo. El joystick izquierdo camina y el derecho gira. En la obra, el menú de estaciones va a la izquierda; `guia4/index.html?estacion=<id>` abre directamente una estación y `rio/index.html?modo=real` abre el río a escala real.

En el computador, el ratón gira la vista y se puede arrastrar sobre el gráfico, el poste naranja y los deslizadores.

Para probar en local hace falta Python 3:

```
npm start
```

y abre `http://localhost:8123`. El servidor solo escucha en el propio equipo.

## Estructura

```
index.html            portada
guia4/                mundo de la obra: world.js, kit.js, CONTRATO.md y una estación por archivo en estaciones/
rio/                  escena del río y el cable
src/math/             modelos matemáticos (problems.js para el río y guia4.js para la obra)
src/common/           aplicación base, entrada por rayos, paneles, gráficos 3D, cielo, agua y texturas
vendor/three/         three.js (r186) y los complementos usados
css/                  estilos
assets/               ícono y vistas previas de la portada
docs/                 modelo matemático y solución
tests/                pruebas de la matemática y páginas de prueba con un casco emulado
.nojekyll             necesario para publicar en GitHub Pages
```

No hay paso de compilación. Las texturas y el terreno se generan en el navegador al cargar, de modo que no hay archivos de imagen salvo las vistas previas de la portada.

## Pruebas

```
npm install
npm test
```

`npm test` comprueba los modelos matemáticos. Las páginas `tests/xr-rio.html` y `tests/xr-guia4.html` emulan unas Meta Quest 3 con [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime) para probar la sesión de realidad virtual sin casco. Se abren desde un servidor local después de `npm install`.

## Licencia

Código bajo licencia MIT. three.js se distribuye con su propia licencia MIT en `vendor/three/LICENSE`.
