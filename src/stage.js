import * as THREE from 'three';
import { toon } from './toon.js';

const NEON = [0xff3e7f, 0xffe45e, 0x3ef2ff, 0xb45cff, 0x5cff8a, 0xff9b3e];

// 트로트 가요무대 스타일 무대
export class Stage {
  constructor(scene) {
    this.scene = scene;
    this.beatFlash = 0;

    // 빙글빙글 햇살 배경
    this.sunburst = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFlash: { value: 0 },
        uMood: { value: new THREE.Color(0xff3e7f) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uFlash;
        uniform vec3 uMood;
        void main() {
          vec2 p = (vUv - vec2(0.5, 0.52)) * vec2(1.7, 1.0);
          float a = atan(p.y, p.x) / 6.28318 + 0.5;
          float r = length(p);
          float rays = step(0.5, fract(a * 18.0 + uTime * 0.04));
          vec3 c1 = uMood;
          vec3 c2 = mix(vec3(1.0, 0.85, 0.35), uMood, 0.25);
          vec3 col = mix(c1, c2, rays);
          col = mix(col, vec3(1.0, 0.95, 0.8), smoothstep(0.22, 0.0, r) * 0.9);
          col = mix(col, vec3(0.2, 0.05, 0.3), smoothstep(0.25, 0.75, r));
          col += uFlash * 0.18;
          // 반짝이 도트
          vec2 g = fract(vUv * vec2(60.0, 36.0)) - 0.5;
          float dotm = smoothstep(0.18, 0.1, length(g));
          col += dotm * 0.06 * rays;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(44, 26), this.sunburst);
    back.position.set(0, 3, -7);
    scene.add(back);

    // 전구 링
    this.bulbs = [];
    const bulbGeo = new THREE.SphereGeometry(0.12, 12, 10);
    const N = 36;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const m = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      m.position.set(Math.cos(a) * 3.3, 2.1 + Math.sin(a) * 2.6, -6.5);
      scene.add(m);
      this.bulbs.push(m);
    }

    // 디스코 바닥
    this.tiles = [];
    const tileGeo = new THREE.BoxGeometry(0.96, 0.12, 0.96);
    for (let x = -6; x < 6; x++) {
      for (let z = -6; z < 4; z++) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x2b1640, emissive: 0x000000, roughness: 0.35, metalness: 0.2 });
        const t = new THREE.Mesh(tileGeo, mat);
        t.position.set(x + 0.5, -1.35, z + 0.5);
        scene.add(t);
        this.tiles.push({ mesh: t, heat: 0, color: new THREE.Color(NEON[0]) });
      }
    }

    // 빨간 벨벳 커튼
    const curtainGeo = new THREE.PlaneGeometry(5, 14, 60, 1);
    const pos = curtainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(x * 5.5) * 0.22);
    }
    curtainGeo.computeVertexNormals();
    const curtainMat = toon(0xc81d4e, { side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const c = new THREE.Mesh(curtainGeo, curtainMat);
      c.position.set(sx * 9.2, 4, -4);
      c.rotation.y = -sx * 0.35;
      scene.add(c);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 8, 20), toon(0xffd23f));
      tie.position.set(sx * 8.2, 0.6, -3.4);
      tie.rotation.y = Math.PI / 2;
      scene.add(tie);
    }
    const valanceGeo = new THREE.PlaneGeometry(26, 2.2, 120, 1);
    const vp = valanceGeo.attributes.position;
    for (let i = 0; i < vp.count; i++) {
      const x = vp.getX(i);
      const y = vp.getY(i);
      vp.setZ(i, Math.sin(x * 4) * 0.2);
      if (y < 0) vp.setY(i, y - Math.abs(Math.sin(x * 1.2)) * 0.5);
    }
    valanceGeo.computeVertexNormals();
    const valance = new THREE.Mesh(valanceGeo, curtainMat);
    valance.position.set(0, 8.2, -3.5);
    scene.add(valance);

    // 미러볼
    this.disco = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.7, 2),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.1, flatShading: true, emissive: 0x333344 }),
    );
    this.disco.position.set(0, 6.4, -1.5);
    scene.add(this.disco);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3), new THREE.MeshBasicMaterial({ color: 0x999999 }));
    string.position.set(0, 8.2, -1.5);
    scene.add(string);

    // 무대 조명
    this.spots = NEON.slice(0, 3).map((c, i) => {
      const s = new THREE.SpotLight(c, 40, 20, 0.35, 0.6, 1.2);
      s.position.set((i - 1) * 5, 8, 3);
      s.target.position.set(0, 0, 0);
      scene.add(s, s.target);
      return s;
    });

    // 반짝이 별
    const starCount = 160;
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 22;
      sp[i * 3 + 1] = Math.random() * 10 - 0.5;
      sp[i * 3 + 2] = -6 + Math.random() * 3;
    }
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.8, map: sparkleTexture(), depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    scene.add(this.stars);

    this.confetti = new Confetti(scene);
  }

  setMood(color) {
    this.sunburst.uniforms.uMood.value.set(color);
  }

  onBeat(beat) {
    this.beatFlash = 1;
    for (const t of this.tiles) {
      if (Math.random() < 0.45) {
        t.heat = 1;
        t.color.setHex(NEON[(Math.random() * NEON.length) | 0]);
      }
    }
    this.spots.forEach((s, i) => s.color.setHex(NEON[(beat + i * 2) % NEON.length]));
  }

  update(dt, time) {
    this.beatFlash = Math.max(0, this.beatFlash - dt * 4);
    this.sunburst.uniforms.uTime.value = time;
    this.sunburst.uniforms.uFlash.value = this.beatFlash;

    for (const t of this.tiles) {
      t.heat = Math.max(0, t.heat - dt * 2.2);
      t.mesh.material.emissive.copy(t.color).multiplyScalar(t.heat * 0.9);
    }
    const chase = Math.floor(time * 8);
    this.bulbs.forEach((b, i) => {
      const on = (i + chase) % 3 === 0;
      b.material.color.setHex(on ? 0xfff6a0 : 0x7a4a2a);
    });

    this.disco.rotation.y += dt * 0.8;
    this.spots.forEach((s, i) => {
      s.target.position.set(Math.sin(time * 1.3 + i * 2) * 3, 0, Math.cos(time * 0.9 + i) * 1.5);
    });
    this.stars.material.opacity = 0.5 + Math.sin(time * 6) * 0.3;
    this.confetti.update(dt);
  }
}

function sparkleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,240,200,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'white';
  g.fillRect(30, 4, 4, 56);
  g.fillRect(4, 30, 56, 4);
  return new THREE.CanvasTexture(c);
}

class Confetti {
  constructor(scene) {
    this.count = 400;
    const geo = new THREE.PlaneGeometry(0.14, 0.24);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.p = Array.from({ length: this.count }, () => ({
      pos: new THREE.Vector3(0, -100, 0),
      vel: new THREE.Vector3(),
      rot: new THREE.Euler(),
      spin: new THREE.Vector3(),
      life: 0,
    }));
    const col = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      this.mesh.setColorAt(i, col.setHex(NEON[i % NEON.length]));
    }
    this.cursor = 0;
    this.dummy = new THREE.Object3D();
    scene.add(this.mesh);
  }

  burst(origin, n = 180, power = 1) {
    for (let i = 0; i < n; i++) {
      const p = this.p[this.cursor];
      this.cursor = (this.cursor + 1) % this.count;
      p.pos.copy(origin);
      const a = Math.random() * Math.PI * 2;
      const s = (2 + Math.random() * 5) * power;
      p.vel.set(Math.cos(a) * s * 0.6, 4 + Math.random() * 6 * power, Math.sin(a) * s * 0.4 + 1);
      p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      p.spin.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
      p.life = 3 + Math.random() * 2;
    }
  }

  update(dt) {
    const d = this.dummy;
    for (let i = 0; i < this.count; i++) {
      const p = this.p[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vel.y -= 9 * dt;
        p.vel.multiplyScalar(1 - dt * 1.6);
        p.vel.y = Math.max(p.vel.y, -1.6);
        p.pos.addScaledVector(p.vel, dt);
        p.pos.x += Math.sin(p.life * 5 + i) * dt * 0.6;
        p.rot.x += p.spin.x * dt;
        p.rot.y += p.spin.y * dt;
        p.rot.z += p.spin.z * dt;
        if (p.life <= 0) p.pos.y = -100;
      }
      d.position.copy(p.pos);
      d.rotation.copy(p.rot);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
