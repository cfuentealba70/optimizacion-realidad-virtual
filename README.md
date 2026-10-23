# Optimización y razón de cambio en realidad virtual

Problemas de Cálculo en una variable modelados como escenas WebXR. Funcionan en el navegador de escritorio y en las gafas Meta Quest 3.

**La obra (Guía 4).** Un mundo con once estaciones a escala real, una por problema de la guía cuyo contexto se puede representar de manera realista: cisterna de costo mínimo, caja de volumen máximo, recipiente para arena, cable mínimo entre dos postes y río y cable (optimización), y ondas en un lago, aviones que convergen, cono de grava, escalera que resbala, depósito cónico y dos autos hacia un cruce (razón de cambio). Cada estación tiene su panel con la función objetivo o la relación entre las razones, un gráfico y la respuesta, que aparece solo cuando se pide: en los problemas de razón de cambio, la derivada que pide el enunciado queda oculta en el panel hasta activar «Revelar respuesta». Al llegar a cada estación, una voz en español explica de qué trata el problema y qué opciones ofrece la escena, con subtítulos en el computador; se puede repetir o desactivar con los botones **Repetir** y **Narración** (también en el menú de las gafas). La selección de problemas, los modelos y las observaciones sobre la guía están en [docs/guia4.md](docs/guia4.md).

**Río y cable (Ejercicio 1.7).** Un valle con una planta eléctrica y una fábrica separadas por un río de 100 m. La función objetivo es C(x, y) = 90x + 150y, con y = √((500 − x)² + 100²) y 0 ≤ x ≤ 500. Se arrastra el poste a lo largo de la orilla y se comparan x, y, la longitud del tendido y el costo. Hay una maqueta sobre una mesa y una vista a escala real.

Las fórmulas y las comprobaciones del río están en [docs/modelo.md](docs/modelo.md).

Sitio publicado: https://cfuentealba70.github.io/optimizacion-realidad-virtual/

## Uso

En las Quest 3, abre https://cfuentealba70.github.io/optimizacion-realidad-virtual/ en el navegador de las gafas, entra en una escena y pulsa **Entrar en VR**. Con el mando se apunta y se aprieta el gatillo. El joystick izquierdo camina y el derecho gira. En la obra, el menú de estaciones va a la izquierda; `guia4/index.html?estacion=<id>` abre directamente una estación y `rio/index.html?modo=real` abre el río a escala real.

En el computador, el ratón gira la vista y se puede arrastrar sobre el gráfico, el poste naranja y los deslizadores. Los navegadores no reproducen audio antes del primer clic: la narración de la primera escena empieza con el primer gesto. `?narracion=0` la desactiva y `?foto=0` vuelve a las texturas procedurales, más livianas.

### Idiomas

El sitio está en español, inglés y portugués. El idioma se elige en la barra de la obra o en la portada, se recuerda en el navegador y también se puede fijar con `?lang=es`, `?lang=en` o `?lang=pt`. Cambian los textos, el formato de los números (coma o punto decimal) y la narración. Los textos de las estaciones siguen escritos en español y se traducen al dibujarse con la tabla de `src/common/i18n-textos.js` (español, inglés y portugués). Con `?i18n=revisar`, `window.__i18n.faltan` y `window.__i18n.faltanLienzo` muestran los textos que no encontraron traducción.

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
assets/               ícono, vistas previas, texturas fotográficas (texturas/), iluminación HDR (hdri/) y narraciones (audio/)
tools/                generar_narracion.py: genera los MP3 y los subtítulos de assets/audio/narraciones*.json
docs/                 modelo matemático y solución
tests/                pruebas de la matemática y páginas de prueba con un casco emulado
.nojekyll             necesario para publicar en GitHub Pages
```

No hay paso de compilación. Los materiales de suelo, hormigón, madera, metal, ladrillo y estuco usan texturas fotográficas escaneadas (color, relieve y un mapa de oclusión, rugosidad y metal, de 1024 px); el suelo se proyecta en metros reales sobre cualquier objeto, y el terreno mezcla pasto y tierra a dos escalas para que no se note la repetición. La luz ambiental y los reflejos vienen de una fotografía HDR de un campo abierto. Las narraciones se regeneran con `python tools/generar_narracion.py` (requiere `pip install edge-tts`) después de editar los textos en `assets/audio/narraciones.json`. Las de inglés y portugués están en `narraciones.en.json` y `narraciones.pt.json`, se generan con `--idioma en` o `--idioma pt` y quedan en `assets/audio/en/` y `assets/audio/pt/`.

## Pruebas

```
npm install
npm test
```

`npm test` comprueba los modelos matemáticos. Las páginas `tests/xr-rio.html` y `tests/xr-guia4.html` emulan unas Meta Quest 3 con [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime) para probar la sesión de realidad virtual sin casco. Se abren desde un servidor local después de `npm install`.

## Cómo citar

Si usas o adaptas este recurso, cítalo con los datos de `CITATION.cff` (en GitHub, botón «Cite this repository»). Cada versión publicada se archiva en Zenodo con su propio DOI, de modo que la cita apunte siempre a la versión que se usó.

## Licencia

Código bajo licencia MIT. three.js se distribuye con su propia licencia MIT en `vendor/three/LICENSE`. Las texturas son de [ambientCG](https://ambientcg.com) y la fotografía HDR es de [Poly Haven](https://polyhaven.com/a/farm_field), ambas con licencia CC0 (detalles en `assets/texturas/LICENCIA.txt` y `assets/hdri/LICENCIA.txt`).
