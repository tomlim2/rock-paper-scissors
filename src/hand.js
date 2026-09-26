import * as THREE from 'three';
import { toon, withOutline } from './toon.js';

// 손가락별 목표 값: curl(0 펴기 ~ 1 쥐기), spread(좌우 벌림)
const POSES = {
  rock: { fingers: [1, 1, 1, 1], spread: [0, 0, 0, 0], thumb: 1 },
  scissors: { fingers: [0, 0, 1, 1], spread: [0.22, -0.12, 0, 0], thumb: 1 },
  paper: { fingers: [0, 0, 0, 0], spread: [0.2, 0.05, -0.08, -0.22], thumb: 0 },
};

export class Hand {
  constructor({ color = 0xffd6a5, cuff = 0xff5fa2, mirror = false } = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const skin = toon(color);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), skin);
    palm.scale.set(0.95, 1, 0.6);
    this.body.add(withOutline(palm, 0.05));

    // 소매 프릴
    const cuffMesh = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 12, 24), toon(cuff));
    cuffMesh.rotation.x = Math.PI / 2;
    cuffMesh.position.y = -0.48;
    this.body.add(withOutline(cuffMesh, 0.04));
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.6, 20), toon(cuff));
    arm.position.y = -1.25;
    this.body.add(withOutline(arm, 0.04));

    // 동글동글 뾰로롱 별 스티커
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), toon(0xffe45e, { emissive: 0x664400 }));
    star.position.set(0.18, -0.15, 0.29);
    this.body.add(star);

    const sx = mirror ? -1 : 1;
    const xs = [-0.3, -0.1, 0.1, 0.3].map((x) => x * sx);
    const lens = [0.3, 0.34, 0.32, 0.26];
    this.fingers = xs.map((x, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.38, 0.02);
      const L = lens[i];
      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, L, 6, 12), skin);
      seg1.position.y = L / 2 + 0.02;
      pivot.add(withOutline(seg1, 0.035));
      const joint = new THREE.Group();
      joint.position.y = L;
      pivot.add(joint);
      const L2 = L * 0.8;
      const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, L2, 6, 12), skin);
      seg2.position.y = L2 / 2 + 0.05;
      joint.add(withOutline(seg2, 0.035));
      this.body.add(pivot);
      return { pivot, joint, curl: 1, spread: 0 };
    });

    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-0.4 * sx, -0.05, 0.12);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 6, 12), skin);
    thumb.position.y = 0.2;
    thumbPivot.add(withOutline(thumb, 0.035));
    this.body.add(thumbPivot);
    this.thumb = { pivot: thumbPivot, fold: 1, sx };

    this.pose = 'rock';
    this.pop = 0;
  }

  setPose(name, pop = false) {
    this.pose = name;
    if (pop) this.pop = 1;
  }

  update(dt) {
    const target = POSES[this.pose];
    const k = 1 - Math.exp(-dt * 22);
    this.fingers.forEach((f, i) => {
      f.curl += (target.fingers[i] - f.curl) * k;
      f.spread += (target.spread[i] * this.thumb.sx - f.spread) * k;
      f.pivot.rotation.set(f.curl * 1.7, 0, f.spread);
      f.joint.rotation.x = f.curl * 1.9;
    });
    const t = this.thumb;
    t.fold += (target.thumb - t.fold) * k;
    t.pivot.rotation.set(t.fold * 0.9, 0, t.sx * (0.9 - t.fold * 1.5));

    this.pop = Math.max(0, this.pop - dt * 3);
    const s = 1 + Math.sin(this.pop * Math.PI) * 0.35;
    this.body.scale.setScalar(s);
  }
}
