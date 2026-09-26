import * as THREE from 'three';
import { toon, withOutline } from './toon.js';

const ORANGE = 0xd97757;
const INK = 0x2a1233;

// 동글동글 Claude. 표정: normal | happy | sad | shock | cool
export class ClaudeBuddy {
  constructor() {
    this.root = new THREE.Group();
    this.bob = new THREE.Group();
    this.root.add(this.bob);

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), toon(ORANGE));
    body.scale.set(1, 0.93, 0.95);
    this.bob.add(withOutline(body, 0.06));
    this.body = body;

    // 머리 위 별꽃 (Claude 로고 느낌)
    this.sprout = new THREE.Group();
    this.sprout.position.set(0, 1.05, 0);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 8), toon(0x7a3b2a));
    stem.position.y = 0.2;
    this.sprout.add(stem);
    this.flower = new THREE.Group();
    this.flower.position.y = 0.5;
    const petalGeo = new THREE.CapsuleGeometry(0.055, 0.22, 4, 8);
    const petalMat = toon(0xff9b6a, { emissive: 0x441100 });
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Mesh(petalGeo, petalMat);
      const a = (i / 10) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0);
      p.rotation.z = a - Math.PI / 2;
      this.flower.add(p);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), toon(0xffe45e));
    this.flower.add(core);
    this.sprout.add(this.flower);
    this.bob.add(this.sprout);

    const ink = toon(INK);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // 눈 (normal / shock)
    this.eyes = new THREE.Group();
    this.eyes.position.set(0, 0.18, 0.98);
    this.bob.add(this.eyes);
    this.pupils = [];
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      g.position.x = sx * 0.36;
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), ink);
      e.scale.set(0.85, 1.25, 0.5);
      g.add(e);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), white);
      hl.position.set(0.04, 0.08, 0.07);
      g.add(hl);
      const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), white);
      hl2.position.set(-0.04, -0.07, 0.07);
      g.add(hl2);
      this.eyes.add(g);
      this.pupils.push(g);
    }

    // ^ ^ 웃는 눈
    this.happyEyes = new THREE.Group();
    this.happyEyes.position.copy(this.eyes.position);
    const arc = new THREE.TorusGeometry(0.13, 0.04, 8, 20, Math.PI);
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(arc, ink);
      m.position.set(sx * 0.36, -0.03, 0.02);
      this.happyEyes.add(m);
    }
    this.bob.add(this.happyEyes);

    // ㅠㅠ 우는 눈
    this.sadEyes = new THREE.Group();
    this.sadEyes.position.copy(this.eyes.position);
    const bar = new THREE.CapsuleGeometry(0.035, 0.22, 4, 8);
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(bar, ink);
      m.rotation.z = Math.PI / 2 - sx * 0.35;
      m.position.set(sx * 0.36, 0.02, 0.03);
      this.sadEyes.add(m);
    }
    this.tears = [];
    const tearMat = toon(0x6fd3ff, { emissive: 0x114466 });
    for (const sx of [-1, 1]) {
      const tear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), tearMat);
      tear.scale.set(0.8, 1.2, 0.8);
      tear.userData.sx = sx;
      this.sadEyes.add(tear);
      this.tears.push(tear);
    }
    this.bob.add(this.sadEyes);

    // 선글라스 😎
    this.shades = new THREE.Group();
    this.shades.position.set(0, 0.2, 1.02);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.9, roughness: 0.15 });
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.06, 24), lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.scale.set(1.15, 1, 0.8);
      lens.position.x = sx * 0.36;
      this.shades.add(lens);
      const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
      glint.position.set(sx * 0.36 + 0.06, 0.03, 0.04);
      glint.rotation.z = -0.6;
      this.shades.add(glint);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), lensMat);
    bridge.position.y = 0.06;
    this.shades.add(bridge);
    this.bob.add(this.shades);

    // 볼터치
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff6f91, transparent: true, opacity: 0.75 });
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), blushMat);
      b.position.set(sx * 0.66, -0.08, 0.83);
      b.rotation.y = sx * 0.65;
      b.scale.y = 0.6;
      this.bob.add(b);
    }

    // 입
    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 8, 20, Math.PI), ink);
    this.smile.rotation.z = Math.PI;
    this.smile.position.set(0, -0.08, 1.04);
    this.bob.add(this.smile);
    this.mouthO = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), toon(0x8a1f3d));
    this.mouthO.scale.set(1, 1.1, 0.4);
    this.mouthO.position.set(0, -0.15, 1.0);
    this.bob.add(this.mouthO);

    // 나비넥타이
    const bowMat = toon(0xff3e7f);
    this.bow = new THREE.Group();
    this.bow.position.set(0, -0.72, 0.8);
    this.bow.rotation.x = -0.5;
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), bowMat);
      w.rotation.z = (sx * Math.PI) / 2;
      w.position.x = sx * 0.15;
      this.bow.add(withOutline(w, 0.02));
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), bowMat);
    this.bow.add(knot);
    this.bob.add(this.bow);

    // 발
    const feetMat = toon(0xb85a3e);
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), feetMat);
      f.scale.set(1.1, 0.55, 1.3);
      f.position.set(sx * 0.45, -1.0, 0.25);
      this.root.add(withOutline(f, 0.03));
    }

    this.expression = 'normal';
    this.shout = 0;
    this.blinkT = 2;
    this.look = new THREE.Vector2();
    this.setExpression('normal');
  }

  setExpression(name) {
    this.expression = name;
    this.eyes.visible = name === 'normal' || name === 'shock';
    this.happyEyes.visible = name === 'happy';
    this.sadEyes.visible = name === 'sad';
    this.shades.visible = name === 'cool';
    const s = name === 'shock' ? 1.35 : 1;
    this.pupils.forEach((p) => p.scale.setScalar(s));
  }

  /** phase: 박자 위치(0~1), energy: 흥 게이지 */
  update(dt, time, phase, energy = 1) {
    // 뽕짝 바운스: 정박에 찌그러지고 뜀
    const hop = Math.pow(Math.sin(phase * Math.PI), 2);
    const squash = 1 - Math.pow(1 - phase, 6) * 0.12 * energy;
    this.bob.position.y = hop * 0.25 * energy;
    this.bob.scale.set(2 - squash, squash, 2 - squash);
    this.bob.rotation.z = Math.sin(time * Math.PI * (132 / 60)) * 0.08 * energy;

    if (this.expression === 'sad') {
      this.bob.position.y *= 0.2;
      this.bob.rotation.z = Math.sin(time * 3) * 0.04;
    }
    if (this.expression === 'cool') {
      this.bob.rotation.z = Math.sin(time * Math.PI * (132 / 60)) * 0.18;
    }

    this.flower.rotation.z += dt * (1.5 + energy * 2);
    this.sprout.rotation.z = Math.sin(time * 4.4) * 0.25;

    // 눈 깜빡 + 시선
    this.blinkT -= dt;
    let blink = 1;
    if (this.blinkT < 0.12) blink = Math.max(0.1, Math.abs(this.blinkT - 0.06) / 0.06);
    if (this.blinkT < 0) this.blinkT = 1.5 + Math.random() * 3;
    this.pupils.forEach((p) => {
      p.scale.y = (this.expression === 'shock' ? 1.35 : 1) * blink;
      p.position.y = this.look.y * 0.06;
    });
    this.pupils[0].position.x = -0.36 + this.look.x * 0.07;
    this.pupils[1].position.x = 0.36 + this.look.x * 0.07;

    this.tears.forEach((t, i) => {
      const k = (time * 1.2 + i * 0.5) % 1;
      t.position.set(t.userData.sx * (0.4 + k * 0.1), -0.08 - k * 0.5, 0.05);
      t.scale.setScalar(1 - k * 0.6);
    });

    this.shout = Math.max(0, this.shout - dt * 3);
    const open = this.shout > 0 || this.expression === 'shock';
    this.mouthO.visible = open;
    this.smile.visible = !open;
    this.mouthO.scale.y = 0.8 + this.shout * 0.6;
    this.smile.rotation.z = this.expression === 'sad' ? 0 : Math.PI;
    this.smile.position.y = this.expression === 'sad' ? -0.2 : -0.08;
  }
}
