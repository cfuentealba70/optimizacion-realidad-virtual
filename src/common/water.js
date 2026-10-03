// Agua de río: material PBR con dos capas de relieve en movimiento, color y transparencia
// que cambian con la profundidad (más clara y transparente junto a las orillas).
import * as THREE from 'three';
import { makeSurface } from './textures.js';

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createWater({ length = 1400, width = 100, segX = 280, segZ = 24, tile = 7, flow = 0.9, shore = 7, y = 0 } = {}) {
  const geo = new THREE.PlaneGeometry(length, width, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 4);
  const shallow = new THREE.Color(0.20, 0.42, 0.38), deep = new THREE.Color(0.02, 0.15, 0.21);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const d = width / 2 - Math.abs(pos.getZ(i)); // distancia a la orilla más cercana
    const t = smooth(0, shore, d);
    c.copy(shallow).lerp(deep, t);
    col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b;
    col[i * 4 + 3] = 0.30 + 0.66 * t;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));

  const n1 = makeSurface('noiseNormal', { size: 256, seed: 5, repeat: [length / tile, width / tile], roughness: false }).normalMap;
  const n2 = makeSurface('noiseNormal', { size: 256, seed: 17, repeat: [length / tile, width / tile], roughness: false }).normalMap;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, transparent: true, roughness: 0.05, metalness: 0.0,
    normalMap: n1, normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 1.25,
  });
  const uniforms = { uNormal2: { value: n2 }, uOff2: { value: new THREE.Vector2() } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNormal2 = uniforms.uNormal2;
    shader.uniforms.uOff2 = uniforms.uOff2;
    const chunk = THREE.ShaderChunk.normal_fragment_maps;
    if (chunk.includes('mapN.xy *= normalScale;')) {
      const patched = chunk.replace(
        'mapN.xy *= normalScale;',
        'vec3 mapN2 = texture2D( uNormal2, vNormalMapUv * 0.43 + uOff2 ).xyz * 2.0 - 1.0;\n\tmapN.xy = ( mapN.xy + mapN2.xy * 0.85 ) * normalScale;',
      );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <normal_fragment_maps>', patched)
        .replace('void main() {', 'uniform sampler2D uNormal2;\nuniform vec2 uOff2;\nvoid main() {');
    }
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.renderOrder = 2;
  mesh.receiveShadow = false;

  let time = 0;
  return {
    mesh,
    update(dt) {
      time += dt;
      // el río corre en el sentido -x (aguas abajo); un grupo de ondas va más lento que el otro
      n1.offset.x += (dt * flow) / tile;
      n1.offset.y += (dt * 0.05) / tile;
      uniforms.uOff2.value.x -= (dt * flow * 0.35) / tile;
      uniforms.uOff2.value.y += (dt * 0.12) / tile;
    },
  };
}
