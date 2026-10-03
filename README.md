# Optimización en realidad virtual

Dos problemas de optimización de Cálculo en una variable modelados como escenas WebXR. Funcionan en el navegador de escritorio y en las gafas Meta Quest 3.

- **Reacción química.** Un laboratorio con un reactor. La concentración sigue C(t) = 4t e^(−0,3t) y el líquido cambia de color. Se mueve el instante sobre el gráfico, se ve la derivada y se distinguen el instante y el valor máximo.
- **Río y cable.** Un valle con una planta eléctrica y una fábrica separadas por un río de 100 m. Se arrastra el poste a lo largo de la orilla y se comparan la variable x, la longitud del tendido y el costo. Hay una maqueta sobre una mesa y una vista a escala real.

Las fórmulas y las comprobaciones están en [docs/modelo.md](docs/modelo.md).

Sitio publicado: https://cfuentealba70.github.io/optimizacion-realidad-virtual/

## Uso

En las Quest 3, abre https://cfuentealba70.github.io/optimizacion-realidad-virtual/ en el navegador de las gafas, entra en una escena y pulsa **Entrar en VR**. Con el mando se apunta y se aprieta el gatillo. En la escala real del río, el joystick izquierdo camina y el derecho gira.

En el computador, el ratón gira la vista y se puede arrastrar sobre el gráfico, el poste naranja y los deslizadores.

Para probar en local:

```
npm start
```

y abre `http://localhost:8123`.

## Estructura

```
index.html            portada
reactor/              escena de la reacción química
rio/                  escena del río y el cable
src/math/             modelo matemático de ambos problemas
src/common/           aplicación base, entrada por rayos, paneles, gráficos 3D, cielo, agua y texturas
vendor/three/         three.js (r186) y los complementos usados
tests/                pruebas de la matemática y páginas de prueba con un casco emulado
```

No hay paso de compilación. Las texturas y el terreno se generan en el navegador al cargar, de modo que no hay archivos de imagen salvo las vistas previas de la portada.

## Pruebas

```
npm install
npm test
```

`npm test` comprueba el modelo matemático. Las páginas `tests/xr-reactor.html` y `tests/xr-rio.html` emulan unas Meta Quest 3 con [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime) para probar la sesión de realidad virtual sin casco. Se abren desde un servidor local después de `npm install`.

## Licencia

Código bajo licencia MIT. three.js se distribuye con su propia licencia MIT en `vendor/three/LICENSE`.
