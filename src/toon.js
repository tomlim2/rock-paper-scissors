import * as THREE from 'three';

const gradient = (() => {
  const data = new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

export const toon = (color, extra = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra });

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x2a1233, side: THREE.BackSide });

/** 뒷면을 살짝 키운 복제본으로 만화 외곽선 */
export function withOutline(mesh, thickness = 0.04) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  mesh.geometry.computeBoundingSphere();
  const r = mesh.geometry.boundingSphere.radius || 1;
  o.scale.setScalar(1 + thickness / r);
  o.raycast = () => {};
  mesh.add(o);
  return mesh;
}
