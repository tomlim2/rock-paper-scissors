import * as THREE from 'three';
import { INK, raw } from './toon.js';

const outlineMat = new THREE.MeshBasicMaterial({ color: raw(INK), side: THREE.BackSide });

// 고무호스 팔: 두 점 사이를 베지어 곡선 튜브로 매 프레임 이어줌
export class Noodle {
  constructor(radius, material, { segments = 14, radial = 10, outline = 0.03 } = {}) {
    this.radius = radius;
    this.segments = segments;
    this.radial = radial;
    this.outlineWidth = outline;
    this.curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());

    this.group = new THREE.Group();
    this.mesh = new THREE.Mesh(this.makeGeometry(), material);
    this.outline = new THREE.Mesh(this.makeGeometry(), outlineMat);
    for (const m of [this.mesh, this.outline]) {
      m.frustumCulled = false;
      this.group.add(m);
    }

    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._d = new THREE.Vector3();
  }

  makeGeometry() {
    const rings = this.segments + 1;
    const ring = this.radial + 1;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rings * ring * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rings * ring * 3), 3));
    const idx = [];
    for (let i = 0; i < this.segments; i++) {
      for (let j = 0; j < this.radial; j++) {
        const a = i * ring + j;
        const b = (i + 1) * ring + j;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    g.setIndex(idx);
    return g;
  }

  update(from, control, to) {
    this.curve.v0.copy(from);
    this.curve.v1.copy(control);
    this.curve.v2.copy(to);
    this.write(this.mesh.geometry, this.radius);
    this.write(this.outline.geometry, this.radius + this.outlineWidth);
  }

  write(geo, r) {
    const pos = geo.attributes.position.array;
    const nor = geo.attributes.normal.array;
    const { _p: p, _t: t, _n: n, _b: b, _d: d } = this;
    // 평행 이동 프레임: 튜브가 꼬이지 않게
    this.curve.getTangent(0, t);
    n.set(0, 0, 1);
    if (Math.abs(t.z) > 0.9) n.set(1, 0, 0);
    n.addScaledVector(t, -n.dot(t)).normalize();
    let k = 0;
    for (let i = 0; i <= this.segments; i++) {
      const u = i / this.segments;
      this.curve.getPoint(u, p);
      this.curve.getTangent(u, t);
      n.addScaledVector(t, -n.dot(t)).normalize();
      b.crossVectors(t, n);
      for (let j = 0; j <= this.radial; j++) {
        const a = (j / this.radial) * Math.PI * 2;
        d.copy(n).multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a));
        pos[k] = p.x + d.x * r;
        pos[k + 1] = p.y + d.y * r;
        pos[k + 2] = p.z + d.z * r;
        nor[k] = d.x;
        nor[k + 1] = d.y;
        nor[k + 2] = d.z;
        k += 3;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
  }
}
