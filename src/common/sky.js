// Cielo físico (modelo de Preetham), iluminación por imagen a partir del propio cielo y luz solar.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export function createSky(scene, renderer, opts = {}) {
  const {
    elevation = 24, azimuth = 215, turbidity = 4.2, rayleigh = 1.6, mieCoefficient = 0.005, mieDirectionalG = 0.82,
    sunIntensity = 3.2, hemiIntensity = 0.0, fogColor = null, fogDensity = 0.00042, environment = true,
  } = opts;

  const sky = new Sky();
  sky.scale.setScalar(10000);
  const u = sky.material.uniforms;
  u.turbidity.value = turbidity;
  u.rayleigh.value = rayleigh;
  u.mieCoefficient.value = mieCoefficient;
  u.mieDirectionalG.value = mieDirectionalG;

  const sun = new THREE.Vector3();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  let envRT = null;

  const light = new THREE.DirectionalLight(0xfff0d8, sunIntensity);
  light.castShadow = false;
  scene.add(light);
  scene.add(light.target);
  scene.add(sky);

  let hemi = null;
  if (hemiIntensity > 0) { hemi = new THREE.HemisphereLight(0xbcd6ff, 0x4a4a3a, hemiIntensity); scene.add(hemi); }

  function update(el = elevation, az = azimuth) {
    const phi = THREE.MathUtils.degToRad(90 - el);
    const theta = THREE.MathUtils.degToRad(az);
    sun.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(sun);
    // color del sol según la altura: más cálido cerca del horizonte
    const warm = THREE.MathUtils.clamp(1 - el / 45, 0, 1);
    light.color.setRGB(1, 0.96 - warm * 0.2, 0.9 - warm * 0.4);
    light.intensity = sunIntensity * (0.55 + 0.45 * Math.min(1, el / 30));
    light.position.copy(sun).multiplyScalar(600);
    if (environment) {
      envScene.add(sky);
      if (envRT) envRT.dispose();
      envRT = pmrem.fromScene(envScene);
      scene.add(sky);
      scene.environment = envRT.texture;
    }
    if (scene.fog) {
      // el color de la niebla sigue al horizonte iluminado
      const k = THREE.MathUtils.clamp(el / 60, 0, 1);
      scene.fog.color.setRGB(0.62 + 0.12 * k, 0.72 + 0.1 * k, 0.82 + 0.06 * k).multiplyScalar(0.55 + 0.4 * k);
    }
  }

  if (fogDensity > 0) {
    scene.fog = new THREE.FogExp2(fogColor ?? 0xa9c0d4, fogDensity);
  }
  update(elevation, azimuth);

  return {
    sky, sun, light, hemi, update,
    // Ajusta el volumen de sombras alrededor de un centro
    setShadow(center, half, { size = 2048, bias = -0.0004, normalBias = 0.4 } = {}) {
      light.castShadow = true;
      light.shadow.mapSize.set(size, size);
      const c = light.shadow.camera;
      c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 10; c.far = 1600;
      c.updateProjectionMatrix();
      light.shadow.bias = bias; light.shadow.normalBias = normalBias;
      light.target.position.copy(center);
      light.position.copy(center).addScaledVector(sun, 600);
    },
  };
}
