# Optimización en realidad virtual

Un problema de optimización de Cálculo en una variable modelado como escena WebXR. Funciona en el navegador de escritorio y en las gafas Meta Quest 3.

**Río y cable.** Un valle con una planta eléctrica y una fábrica separadas por un río de 100 m. La función objetivo es C(x, y) = 90x + 150y, con y = √((500 − x)² + 100²) y 0 ≤ x ≤ 500. Se arrastra el poste a lo largo de la orilla y se comparan x, y, la longitud del tendido y el costo. Hay una maqueta sobre una mesa y una vista a escala real.

Las fórmulas y las comprobaciones están en [docs/modelo.md](docs/modelo.md).

Sitio publicado: https://cfuentealba70.github.io/optimizacion-realidad-virtual/

## Uso

En las Quest 3, abre https://cfuentealba70.github.io/optimizacion-realidad-virtual/ en el navegador de las gafas, entra en la escena y pulsa **Entrar en VR**. Con el mando se apunta y se aprieta el gatillo. En la escala real, el joystick izquierdo camina y el derecho gira. La dirección `rio/index.html?modo=real` abre directamente a escala real.

En el computador, el ratón gira la vista y se puede arrastrar sobre el gráfico, el poste naranja y los deslizadores.

Para probar en local hace falta Python 3:

```
npm start
```

y abre `http://localhost:8123`. El servidor solo escucha en el propio equipo.

## Estructura

```
index.html            portada
rio/                  escena del río y el cable
src/math/             modelo matemático
src/common/           aplicación base, entrada por rayos, paneles, gráficos 3D, cielo, agua y texturas
vendor/three/         three.js (r186) y los complementos usados
css/                  estilos
assets/               ícono y vistas previas de la portada
docs/                 modelo matemático y solución
tests/                pruebas de la matemática y una página de prueba con un casco emulado
.nojekyll             necesario para publicar en GitHub Pages
```

No hay paso de compilación. Las texturas y el terreno se generan en el navegador al cargar, de modo que no hay archivos de imagen salvo las vistas previas de la portada.

## Pruebas

```
npm install
npm test
```

`npm test` comprueba el modelo matemático. La página `tests/xr-rio.html` emula unas Meta Quest 3 con [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime) para probar la sesión de realidad virtual sin casco. Se abre desde un servidor local después de `npm install`.

## Licencia

Código bajo licencia MIT. three.js se distribuye con su propia licencia MIT en `vendor/three/LICENSE`.
