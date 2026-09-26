import * as THREE from 'three';
import { withOutline, rbox } from './toon.js';

const Y = new THREE.Vector3(0, 1, 0);

// 큐브 두 마디 + 팔꿈치 큐브로 된 팔. 어깨 → 팔꿈치 → 손목을 매 프레임 이어줌
export class Limb {
  constructor(thick, material) {
    this.group = new THREE.Group();
    const seg = rbox(thick, 1, thick, thick * 0.3);
    this.upper = withOutline(new THREE.Mesh(seg, material), 0.025);
    this.lower = withOutline(new THREE.Mesh(seg, material), 0.025);
    const k = thick * 1.18;
    this.elbow = withOutline(new THREE.Mesh(rbox(k, k, k, k * 0.3), material), 0.025);
    this.group.add(this.upper, this.lower, this.elbow);
    this._d = new THREE.Vector3();
  }

  place(mesh, a, b) {
    const d = this._d.subVectors(b, a);
    const len = d.length() || 1e-3;
    mesh.position.lerpVectors(a, b, 0.5);
    mesh.quaternion.setFromUnitVectors(Y, d.divideScalar(len));
    mesh.scale.set(1, len, 1);
  }

  update(shoulder, elbow, wrist) {
    this.place(this.upper, shoulder, elbow);
    this.place(this.lower, elbow, wrist);
    this.elbow.position.copy(elbow);
    this.elbow.quaternion.copy(this.lower.quaternion);
  }
}
