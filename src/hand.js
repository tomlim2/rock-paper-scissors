import * as THREE from 'three';
import { toon, withOutline, rbox } from './toon.js';

// curl: 0 펴기 ~ 1 쥐기, spread: 좌우 벌림, thumb: 엄지 자세
const POSES = {
  rock: { curl: [1, 1, 1, 1], spread: [0, 0, 0, 0], thumb: 'fist' },
  scissors: { curl: [0, 0, 1, 1], spread: [0.26, -0.1, 0, 0], thumb: 'across' },
  paper: { curl: [0, 0, 0, 0], spread: [0.24, 0.08, -0.08, -0.24], thumb: 'open' },
};

function basisQuat(dir, front) {
  const y = dir.clone().normalize();
  const z = front.clone().addScaledVector(y, -front.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * 손가락 방향(dir)으로 뻗고 엄지가 위로 오게 세운 손의 회전값.
 * 손바닥(+z)은 자연스럽게 카메라 쪽을 봄.
 */
export function thumbUpQuat(dir, mirror = false) {
  const y = dir.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const thumb = up.addScaledVector(y, -up.dot(y)).normalize();
  const x = mirror ? thumb : thumb.clone().negate();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// 큐브로 만든 만화 장갑 손. 손바닥이 +z, 손가락이 +y
export class Hand {
  constructor({ color = 0xffffff, cuff = 0x3ea8ff, cuffRing = color, sleeve = 0, mirror = false, thumbTop = false } = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const glove = toon(color);
    const sx = mirror ? -1 : 1;
    this.sx = sx;

    const palm = new THREE.Mesh(rbox(0.96, 0.88, 0.5, 0.16), glove);
    this.body.add(withOutline(palm, 0.03));

    const cuffMesh = new THREE.Mesh(rbox(1.04, 0.3, 0.62, 0.1), toon(cuffRing));
    cuffMesh.position.y = -0.56;
    this.body.add(withOutline(cuffMesh, 0.025));

    if (sleeve > 0) {
      const s = new THREE.Mesh(rbox(0.82, sleeve, 0.66, 0.14), toon(cuff));
      s.position.y = -0.7 - sleeve / 2;
      this.body.add(withOutline(s, 0.03));
      const band = new THREE.Mesh(rbox(0.86, 0.1, 0.7, 0.04), toon(0xffffff));
      band.position.y = -0.98;
      this.body.add(band);
    }

    this.wrist = new THREE.Object3D();
    this.wrist.position.y = -0.62;
    this.body.add(this.wrist);

    const xs = [-0.33, -0.11, 0.11, 0.33].map((x) => x * sx);
    const lens = [0.26, 0.29, 0.27, 0.21];
    this.fingers = xs.map((x, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.36, 0.0);
      const L = lens[i];
      const seg1 = new THREE.Mesh(rbox(0.2, L, 0.24, 0.08), glove);
      seg1.position.y = L / 2;
      pivot.add(withOutline(seg1, 0.025));
      const joint = new THREE.Group();
      joint.position.y = L + 0.01;
      pivot.add(joint);
      const L2 = L * 0.78;
      const seg2 = new THREE.Mesh(rbox(0.19, L2, 0.23, 0.08), glove);
      seg2.position.y = L2 / 2 + 0.01;
      joint.add(withOutline(seg2, 0.025));
      this.body.add(pivot);
      return { pivot, joint, curl: 1, spread: 0 };
    });

    // 엄지: 자세별 방향 쿼터니언 사이를 보간
    const tPivot = new THREE.Group();
    tPivot.position.set(-0.42 * sx, -0.1, 0.1);
    const t1 = new THREE.Mesh(rbox(0.23, 0.26, 0.25, 0.09), glove);
    t1.position.y = 0.13;
    tPivot.add(withOutline(t1, 0.025));
    const tJoint = new THREE.Group();
    tJoint.position.y = 0.26;
    tPivot.add(tJoint);
    const t2 = new THREE.Mesh(rbox(0.21, 0.2, 0.23, 0.08), glove);
    t2.position.y = 0.1;
    tJoint.add(withOutline(t2, 0.025));
    this.body.add(tPivot);
    const front = new THREE.Vector3(0, 0, 1);
    const across = basisQuat(new THREE.Vector3(0.8 * sx, 0.4, 0.55), new THREE.Vector3(0, -0.3, 1));
    this.thumb = {
      pivot: tPivot,
      joint: tJoint,
      bend: 0.6,
      q: {
        open: [basisQuat(new THREE.Vector3(-0.85 * sx, 0.5, 0.25), front), 0.15],
        across: [across, 0.6],
        // 옆으로 쥔 주먹: 엄지가 검지 위를 따라 누움 (엄지가 위)
        fist: thumbTop ? [basisQuat(new THREE.Vector3(-0.12 * sx, 0.9, 0.42), front), 0.3] : [across, 0.6],
      },
    };
    tPivot.quaternion.copy(this.thumb.q.fist[0]);

    this.pose = 'rock';
    this.pop = 0;
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
      f.pivot.rotation.set(f.curl * 1.6, 0, f.spread);
      f.joint.rotation.x = f.curl * 1.75;
    });
    const t = this.thumb;
    const [q, bend] = t.q[target.thumb];
    t.pivot.quaternion.slerp(q, k);
    t.bend += (bend - t.bend) * k;
    t.joint.rotation.x = t.bend;

    this.pop = Math.max(0, this.pop - dt * 3.2);
    this.body.scale.setScalar(1 + Math.sin(this.pop * Math.PI) * 0.3);
  }
}
