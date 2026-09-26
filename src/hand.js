import * as THREE from 'three';
import { toon, withOutline } from './toon.js';

// curl: 0 펴기 ~ 1 쥐기, spread: 좌우 벌림, thumb: 0 펴기 ~ 1 접기
const POSES = {
  rock: { curl: [1, 1, 1, 1], spread: [0, 0, 0, 0], thumb: 1 },
  scissors: { curl: [0, 0, 1, 1], spread: [0.24, -0.1, 0, 0], thumb: 1 },
  paper: { curl: [0, 0, 0, 0], spread: [0.24, 0.08, -0.08, -0.24], thumb: 0 },
};

const Y = new THREE.Vector3(0, 1, 0);

function basisQuat(dir, front) {
  const y = dir.clone().normalize();
  const z = front.clone().addScaledVector(y, -front.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// 만화 장갑 손. 손바닥이 +z(카메라 쪽)를 봄
export class Hand {
  constructor({ color = 0xffffff, cuff = 0x3ea8ff, cuffRing = color, sleeve = 0, mirror = false } = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const glove = toon(color);
    const sx = mirror ? -1 : 1;
    this.sx = sx;

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), glove);
    palm.scale.set(1, 0.92, 0.62);
    this.body.add(withOutline(palm, 0.03));

    // 둘둘 말린 장갑 소매
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 14, 32), toon(cuffRing));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.44;
    this.body.add(withOutline(ring, 0.025));
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.24, 28), toon(cuffRing));
    flare.position.y = -0.58;
    this.body.add(withOutline(flare, 0.025));

    if (sleeve > 0) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, sleeve, 28), toon(cuff));
      s.position.y = -0.68 - sleeve / 2;
      this.body.add(withOutline(s, 0.03));
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.05, 10, 28), toon(0xffffff));
      band.rotation.x = Math.PI / 2;
      band.position.y = -0.95;
      this.body.add(band);
    }

    this.wrist = new THREE.Object3D();
    this.wrist.position.y = -0.62;
    this.body.add(this.wrist);

    const xs = [-0.32, -0.11, 0.11, 0.32].map((x) => x * sx);
    const lens = [0.25, 0.28, 0.26, 0.2];
    const radii = [0.115, 0.12, 0.115, 0.1];
    this.fingers = xs.map((x, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.32, 0.02);
      const L = lens[i];
      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(radii[i], L, 6, 14), glove);
      seg1.position.y = L / 2 + 0.02;
      pivot.add(withOutline(seg1, 0.025));
      const joint = new THREE.Group();
      joint.position.y = L + 0.02;
      pivot.add(joint);
      const L2 = L * 0.75;
      const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(radii[i] * 0.96, L2, 6, 14), glove);
      seg2.position.y = L2 / 2 + 0.04;
      joint.add(withOutline(seg2, 0.025));
      this.body.add(pivot);
      return { pivot, joint, curl: 1, spread: 0 };
    });

    // 엄지: 방향 쿼터니언 두 개(펴기/접기) 사이를 보간
    const tPivot = new THREE.Group();
    tPivot.position.set(-0.4 * sx, -0.08, 0.12);
    const t1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.18, 6, 14), glove);
    t1.position.y = 0.12;
    tPivot.add(withOutline(t1, 0.025));
    const tJoint = new THREE.Group();
    tJoint.position.y = 0.24;
    tPivot.add(tJoint);
    const t2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.12, 6, 14), glove);
    t2.position.y = 0.09;
    tJoint.add(withOutline(t2, 0.025));
    this.body.add(tPivot);
    this.thumb = {
      pivot: tPivot,
      joint: tJoint,
      fold: 1,
      open: basisQuat(new THREE.Vector3(-0.85 * sx, 0.5, 0.25), new THREE.Vector3(0, 0, 1)),
      fist: basisQuat(new THREE.Vector3(0.8 * sx, 0.4, 0.55), new THREE.Vector3(0, -0.3, 1)),
    };

    this.pose = 'rock';
    this.pop = 0;
    this.lift = 0;
  }

  setPose(name, pop = false) {
    this.pose = name;
    if (pop) this.pop = 1;
  }

  update(dt) {
    const target = POSES[this.pose];
    const k = 1 - Math.exp(-dt * 24);
    this.fingers.forEach((f, i) => {
      f.curl += (target.curl[i] - f.curl) * k;
      f.spread += (target.spread[i] * this.sx - f.spread) * k;
      f.pivot.rotation.set(f.curl * 1.65, 0, f.spread);
      f.joint.rotation.x = f.curl * 1.85;
    });
    const t = this.thumb;
    t.fold += (target.thumb - t.fold) * k;
    t.pivot.quaternion.slerpQuaternions(t.open, t.fist, t.fold);
    t.joint.rotation.x = 0.15 + t.fold * 0.55;

    this.pop = Math.max(0, this.pop - dt * 3.2);
    const s = 1 + Math.sin(this.pop * Math.PI) * 0.3;
    this.body.scale.setScalar(s);
    this.body.position.y = this.lift;
  }
}
