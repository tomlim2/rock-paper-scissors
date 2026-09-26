import * as THREE from 'three';
import { toon, withOutline, rimShell, INK } from './toon.js';
import { Noodle } from './noodle.js';

const ORANGE = 0xd97757;
const ORANGE_TOP = 0xeb9a74;
const ORANGE_BOTTOM = 0xc4603f;

// 찹쌀떡 실루엣: 아래는 납작, 위는 동글 (슈퍼타원 회전체)
const A = 1.18;
const B_TOP = 1.05;
const B_BOTTOM = 0.95;
function profilePoint(theta) {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const n = s < 0 ? 2.7 : 2.1;
  const b = s < 0 ? B_BOTTOM : B_TOP;
  const r = A * Math.pow(Math.abs(c), 2 / n);
  const y = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
  return new THREE.Vector2(r, y);
}
const PROFILE = Array.from({ length: 49 }, (_, i) => profilePoint(-Math.PI / 2 + (i / 48) * Math.PI));

function radiusAt(y) {
  for (let i = 1; i < PROFILE.length; i++) {
    const a = PROFILE[i - 1];
    const b = PROFILE[i];
    if (y >= a.y && y <= b.y) return THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / (b.y - a.y || 1));
  }
  return 0;
}

/** 몸 표면 위 (x, y) 지점에 붙이기: 위치 + 표면을 바라보는 방향 */
function onSurface(obj, x, y, lift = 0.02) {
  const r = radiusAt(y);
  const z = Math.sqrt(Math.max(0.0001, r * r - x * x));
  const n = new THREE.Vector3(x, (y / B_TOP) * 0.35, z).normalize();
  obj.position.set(x, y, z).addScaledVector(n, lift);
  obj.lookAt(obj.position.clone().add(n));
  return obj;
}

function bodyGeometry() {
  const geo = new THREE.LatheGeometry(PROFILE, 72, Math.PI, Math.PI * 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(ORANGE_TOP);
  const bottom = new THREE.Color(ORANGE_BOTTOM);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.smoothstep(pos.getY(i), -0.9, 0.9);
    c.lerpColors(bottom, top, t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// 반원 입 (D 모양) + 혀
function openMouth() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.13, 0);
  shape.lineTo(0.13, 0);
  shape.absellipse(0, 0, 0.13, 0.15, 0, -Math.PI, true);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), new THREE.MeshBasicMaterial({ color: 0x6b1030 }));
  g.add(m);
  const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), new THREE.MeshBasicMaterial({ color: 0xff7a9a }));
  tongue.scale.y = 0.6;
  tongue.position.set(0, -0.1, 0.004);
  g.add(tongue);
  return g;
}

export class ClaudeBuddy {
  constructor() {
    this.root = new THREE.Group();
    this.bob = new THREE.Group();
    this.root.add(this.bob);
    this.world = new THREE.Group(); // 팔(월드 좌표)을 담는 곳 — 씬에 따로 붙임

    const bodyMat = toon(0xffffff, { vertexColors: true });
    const geo = bodyGeometry();
    const body = new THREE.Mesh(geo, bodyMat);
    this.bob.add(withOutline(body, 0.045));
    this.bob.add(rimShell(geo, 0xffc9a0, 0.55));

    const ink = new THREE.MeshBasicMaterial({ color: INK });
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.face = new THREE.Group();
    this.bob.add(this.face);

    // ---------- 눈 ----------
    this.eyes = [];
    this.eyeBase = [];
    for (const sx of [-1, 1]) {
      const anchor = onSurface(new THREE.Group(), sx * 0.37, 0.12, 0.0);
      const e = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 18), ink);
      ball.scale.set(0.82, 1.18, 0.35);
      e.add(ball);
      const hl = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), white);
      hl.position.set(0.04, 0.075, 0.058);
      e.add(hl);
      const hl2 = new THREE.Mesh(new THREE.CircleGeometry(0.025, 12), white);
      hl2.position.set(-0.035, -0.07, 0.058);
      e.add(hl2);
      anchor.add(e);
      this.face.add(anchor);
      this.eyes.push(e);
      this.eyeBase.push(anchor);
    }

    // ^ ^ 웃는 눈
    this.happyEyes = new THREE.Group();
    const arc = new THREE.TorusGeometry(0.12, 0.035, 8, 20, Math.PI);
    for (const sx of [-1, 1]) {
      const g = onSurface(new THREE.Group(), sx * 0.37, 0.08, 0.01);
      g.add(new THREE.Mesh(arc, ink));
      this.happyEyes.add(g);
    }
    this.face.add(this.happyEyes);

    // > < 질끈 감은 눈 (울 때)
    this.sadEyes = new THREE.Group();
    const bar = new THREE.CapsuleGeometry(0.03, 0.17, 4, 8);
    for (const sx of [-1, 1]) {
      const g = onSurface(new THREE.Group(), sx * 0.37, 0.1, 0.01);
      for (const k of [-1, 1]) {
        const m = new THREE.Mesh(bar, ink);
        m.rotation.z = Math.PI / 2 + k * 0.42 * sx;
        m.position.set(0.05 * sx, k * 0.035, 0);
        g.add(m);
      }
      this.sadEyes.add(g);
    }
    this.tears = [];
    const tearMat = toon(0x7fdcff, { emissive: 0x1a5f7a });
    for (const sx of [-1, 1]) {
      const tear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), tearMat);
      tear.userData.sx = sx;
      this.sadEyes.add(tear);
      this.tears.push(tear);
    }
    this.face.add(this.sadEyes);

    // ---------- 눈썹 ----------
    this.brows = [-1, 1].map((sx) => {
      const g = onSurface(new THREE.Group(), sx * 0.37, 0.4, 0.01);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.14, 4, 8), ink);
      m.rotation.z = Math.PI / 2;
      const pivot = new THREE.Group();
      pivot.add(m);
      g.add(pivot);
      this.face.add(g);
      return { pivot, sx, y: 0, rot: 0 };
    });

    // ---------- 볼터치 ----------
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff6f91, transparent: true, opacity: 0.7 });
    for (const sx of [-1, 1]) {
      const b = onSurface(new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), blushMat), sx * 0.66, -0.1, 0.01);
      b.scale.y = 0.62;
      this.face.add(b);
    }

    // ---------- 입 ----------
    const mouthAnchor = onSurface(new THREE.Group(), 0, -0.14, 0.012);
    this.face.add(mouthAnchor);
    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 20, Math.PI), ink);
    this.smile.rotation.z = Math.PI;
    this.smile.position.y = 0.04;
    this.frown = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.03, 8, 20, Math.PI), ink);
    this.frown.position.y = -0.06;
    this.open = openMouth();
    this.open.position.y = 0.03;
    this.cat = new THREE.Group(); // ω
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.026, 8, 16, Math.PI), ink);
      m.rotation.z = Math.PI;
      m.position.x = sx * 0.05;
      this.cat.add(m);
    }
    this.cat.position.y = 0.03;
    this.oMouth = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), new THREE.MeshBasicMaterial({ color: 0x6b1030 }));
    this.oMouth.scale.set(0.85, 1.15, 1);
    this.oMouth.position.y = -0.01;
    mouthAnchor.add(this.smile, this.frown, this.open, this.cat, this.oMouth);
    this.mouths = { smile: this.smile, frown: this.frown, open: this.open, cat: this.cat, o: this.oMouth };

    // 땀방울 (띠용)
    this.sweat = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), tearMat);
    this.sweat.scale.set(0.75, 1.2, 0.6);
    onSurface(this.sweat, 0.78, 0.5, 0.06);
    this.face.add(this.sweat);

    // ---------- 선글라스 😎 ----------
    this.shades = new THREE.Group();
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x15102a, metalness: 0.6, roughness: 0.2 });
    const lensGeo = new THREE.CylinderGeometry(0.2, 0.19, 0.05, 28);
    for (const sx of [-1, 1]) {
      const a = onSurface(new THREE.Group(), sx * 0.37, 0.13, 0.05);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.scale.set(1.12, 1, 0.88);
      a.add(withOutline(lens, 0.02));
      const glint = new THREE.Mesh(
        new THREE.PlaneGeometry(0.05, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      );
      glint.position.set(0.06, 0.03, 0.035);
      glint.rotation.z = -0.6;
      a.add(glint);
      this.shades.add(a);
    }
    const bridge = onSurface(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.04), lensMat), 0, 0.2, 0.05);
    this.shades.add(bridge);
    this.face.add(this.shades);

    // ---------- 나비넥타이 ----------
    const bowMat = toon(0xff3e7f);
    this.bow = onSurface(new THREE.Group(), 0, -0.7, 0.04);
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), bowMat);
      w.scale.set(1.2, 0.8, 0.45);
      w.position.x = sx * 0.15;
      w.rotation.z = sx * 0.25;
      this.bow.add(withOutline(w, 0.02));
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), new THREE.MeshBasicMaterial({ color: 0xffe0ec }));
      dot.position.set(sx * 0.17, 0.02, 0.07);
      this.bow.add(dot);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), bowMat);
    knot.scale.z = 0.7;
    this.bow.add(withOutline(knot, 0.02));
    this.bob.add(this.bow);

    // ---------- 머리 위 Claude 별 ----------
    this.antenna = new THREE.Group();
    this.antenna.position.set(0, B_TOP - 0.06, 0);
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.03, 0.14, 0),
      new THREE.Vector3(-0.02, 0.28, 0),
      new THREE.Vector3(0, 0.4, 0),
    ]);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 16, 0.035, 8), toon(0x9a4a32));
    this.antenna.add(withOutline(stem, 0.018));
    this.spark = new THREE.Group();
    this.spark.position.y = 0.5;
    const rayMat = toon(0xe8825c, { emissive: 0x3a1206 });
    const lens = [0.2, 0.15, 0.19, 0.14, 0.21, 0.16, 0.18, 0.13, 0.2, 0.15, 0.19, 0.14];
    lens.forEach((len, i) => {
      const a = (i / lens.length) * Math.PI * 2;
      const ray = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, len, 4, 8), rayMat);
      ray.position.set(Math.cos(a) * (len / 2 + 0.04), Math.sin(a) * (len / 2 + 0.04), 0);
      ray.rotation.z = a - Math.PI / 2;
      this.spark.add(withOutline(ray, 0.016));
    });
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), rayMat);
    this.spark.add(hub);
    this.antenna.add(this.spark);
    this.bob.add(this.antenna);
    this.ant = new THREE.Vector2();
    this.antVel = new THREE.Vector2();

    // ---------- 발 ----------
    const feetMat = toon(0xb0553a);
    this.feet = [-1, 1].map((sx) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 14), feetMat);
      f.scale.set(1.15, 0.5, 1.3);
      f.position.set(sx * 0.48, -0.98, 0.3);
      this.root.add(withOutline(f, 0.03));
      return f;
    });

    // ---------- 팔 ----------
    const armMat = toon(ORANGE);
    this.shoulderL = new THREE.Object3D(); // 가위바위보 손 (화면 왼쪽)
    this.shoulderL.position.set(-1.02, -0.22, 0.25);
    this.shoulderR = new THREE.Object3D(); // 마이크 손
    this.shoulderR.position.set(1.02, -0.22, 0.25);
    this.bob.add(this.shoulderL, this.shoulderR);
    this.armL = new Noodle(0.13, armMat);
    this.armR = new Noodle(0.12, armMat);
    this.world.add(this.armL.group, this.armR.group);

    // 마이크 든 손
    this.mitten = new THREE.Group();
    const mit = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 14), armMat);
    mit.scale.set(1, 0.9, 0.9);
    this.mitten.add(withOutline(mit, 0.025));
    const mic = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.035, 0.42, 14),
      toon(0x2a2a3a),
    );
    handle.position.y = 0.12;
    mic.add(withOutline(handle, 0.018));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.05, 14), toon(0xffd23f));
    band.position.y = 0.32;
    mic.add(band);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0xcfd3e0, metalness: 0.7, roughness: 0.35 }),
    );
    head.position.y = 0.42;
    mic.add(withOutline(head, 0.018));
    mic.rotation.set(0.2, 0, -0.35);
    this.mic = mic;
    this.mitten.add(mic);
    this.root.add(this.mitten);
    this.mitIdle = new THREE.Vector3(1.5, -0.35, 0.55);
    this.mitSing = new THREE.Vector3(0.38, -0.42, 1.3);
    this.sing = 0;
    this.singTarget = 0;

    this.hand = null;
    this.expression = 'normal';
    this.shout = 0;
    this.blinkT = 2;
    this.look = new THREE.Vector2();
    this.prevBobY = 0;
    this.prevVel = 0;
    this.setExpression('normal');

    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._c = new THREE.Vector3();
  }

  attachHand(hand) {
    this.hand = hand;
  }

  setExpression(name) {
    this.expression = name;
    const eyesOpen = ['normal', 'shock', 'focus'].includes(name);
    this.eyes.forEach((e) => (e.visible = eyesOpen));
    this.happyEyes.visible = name === 'happy';
    this.sadEyes.visible = name === 'sad';
    this.shades.visible = name === 'cool';
    this.sweat.visible = name === 'shock';
    this.singTarget = name === 'cool' ? 1 : 0;
    const brows = {
      normal: [0.02, 0.06],
      happy: [0.07, -0.12],
      sad: [0.0, -0.42],
      shock: [0.13, -0.08],
      cool: [0.1, 0.18],
      focus: [-0.04, 0.42],
    }[name];
    this.browTarget = brows;
  }

  mouthFor() {
    if (this.shout > 0.05) return 'open';
    return (
      {
        normal: 'smile',
        happy: 'open',
        sad: 'frown',
        shock: 'o',
        cool: this.sing > 0.5 ? 'open' : 'cat',
        focus: 'smile',
      }[this.expression] || 'smile'
    );
  }

  /** phase: 박자 위치(0~1), beat: 박자 번호, energy: 흥 게이지 */
  update(dt, time, phase, beat, energy = 1) {
    const ex = this.expression;
    // 통통 바운스: 정박에 찌그러지고, 박 사이에 떠오름
    const hop = Math.sin(phase * Math.PI);
    const land = Math.pow(1 - phase, 8);
    let amp = 0.2 * energy;
    if (ex === 'sad') amp *= 0.2;
    this.bob.position.y = hop * hop * amp;
    const sq = land * 0.08 * Math.min(energy, 1.4);
    this.bob.scale.set(1 + sq * 0.6, 1 - sq + hop * 0.02, 1 + sq * 0.6);
    const sway = Math.sin(((beat + phase) * Math.PI) / 2);
    this.bob.rotation.z = sway * (ex === 'cool' ? 0.14 : 0.06) * energy;
    if (ex === 'sad') this.bob.rotation.z = Math.sin(time * 2.4) * 0.03;
    this.bob.rotation.x = ex === 'sad' ? 0.12 : 0;

    // 발 콩콩
    this.feet.forEach((f, i) => {
      const mine = (beat + i) % 2 === 0;
      f.position.y = -0.98 + (mine ? hop * 0.1 * energy : 0) * (ex === 'sad' ? 0.2 : 1);
    });

    // 더듬이 스프링 (2차 모션)
    const vel = (this.bob.position.y - this.prevBobY) / Math.max(dt, 1e-3);
    const acc = (vel - this.prevVel) / Math.max(dt, 1e-3);
    this.prevBobY = this.bob.position.y;
    this.prevVel = vel;
    const droop = ex === 'sad' ? 0.9 : 0;
    this.antVel.x += (-140 * (this.ant.x - droop) - 8 * this.antVel.x + THREE.MathUtils.clamp(acc, -60, 60) * 0.25) * dt;
    this.antVel.y += (-140 * this.ant.y - 8 * this.antVel.y - Math.cos(((beat + phase) * Math.PI) / 2) * 3) * dt;
    this.ant.addScaledVector(this.antVel, dt);
    this.antenna.rotation.set(this.ant.x * 0.6, 0, this.ant.y * 0.5);
    this.spark.rotation.z += dt * (0.6 + energy * 1.4);
    const pulse = 1 + Math.pow(1 - phase, 6) * 0.18;
    this.spark.scale.setScalar(pulse);

    // 눈 깜빡 + 시선
    this.blinkT -= dt;
    let blink = 1;
    if (this.blinkT < 0.12) blink = Math.max(0.08, Math.abs(this.blinkT - 0.06) / 0.06);
    if (this.blinkT < 0) this.blinkT = 1.6 + Math.random() * 3;
    const eyeScale = ex === 'shock' ? 1.3 : 1;
    const squint = ex === 'focus' ? 0.72 : 1;
    this.eyes.forEach((e) => {
      e.scale.set(eyeScale, eyeScale * blink * squint, 1);
      e.position.set(this.look.x * 0.05, this.look.y * 0.04, 0);
    });

    // 눈썹
    this.brows.forEach((b) => {
      const [ty, tr] = this.browTarget;
      b.y += (ty - b.y) * Math.min(1, dt * 14);
      // tr > 0: 안쪽 끝이 내려감(결의), tr < 0: 안쪽 끝이 올라감(울상)
      b.rot += (tr * b.sx - b.rot) * Math.min(1, dt * 14);
      b.pivot.position.y = b.y;
      b.pivot.rotation.z = b.rot;
    });

    // 눈물 줄줄
    this.tears.forEach((t, i) => {
      const k = (time * 1.3 + i * 0.5) % 1;
      const base = this.eyeBase[i].position;
      t.position.set(base.x + t.userData.sx * (0.02 + k * 0.08), base.y - 0.08 - k * 0.55, base.z + 0.02 - k * 0.1);
      t.scale.set(0.8 * (1 - k * 0.5), 1.2 * (1 - k * 0.5), 0.8);
    });

    this.sweat.position.y = 0.5 + Math.sin(time * 6) * 0.015;

    // 입
    this.shout = Math.max(0, this.shout - dt * 3);
    this.sing += (this.singTarget - this.sing) * Math.min(1, dt * 6);
    const mouth = this.mouthFor();
    for (const [k, m] of Object.entries(this.mouths)) m.visible = k === mouth;
    const talk = ex === 'cool' && this.sing > 0.5 ? 0.6 + Math.abs(Math.sin(time * 9)) * 0.5 : 1;
    this.open.scale.set(1, (0.7 + this.shout * 0.5) * talk, 1);
    if (mouth === 'frown') this.frown.position.x = Math.sin(time * 14) * 0.008;

    this.updateArms(time, phase, energy);
  }

  updateArms(time, phase, energy) {
    this.root.updateMatrixWorld(true);
    const { _a: a, _b: b, _c: c } = this;

    // 마이크 팔: 평소엔 옆에서 흔들, 이기면 입에 대고 노래
    const idle = this.mitIdle;
    const swing = Math.sin(time * 4.6) * 0.08 * energy;
    this.mitten.position.lerpVectors(idle, this.mitSing, this.sing);
    this.mitten.position.y += swing * (1 - this.sing) + this.bob.position.y * 0.8;
    this.mitten.rotation.z = THREE.MathUtils.lerp(-0.2 + swing, 0.5, this.sing);
    this.mic.rotation.set(THREE.MathUtils.lerp(0.2, -0.5, this.sing), 0, THREE.MathUtils.lerp(-0.35, 0.55, this.sing));
    this.shoulderR.getWorldPosition(a);
    this.mitten.getWorldPosition(c);
    b.lerpVectors(a, c, 0.5).y -= 0.2;
    this.armR.update(a, b, c);

    if (this.hand) {
      this.shoulderL.getWorldPosition(a);
      this.hand.wrist.getWorldPosition(c);
      b.lerpVectors(a, c, 0.5);
      b.y -= 0.35;
      b.z += 0.1;
      this.armL.update(a, b, c);
    }
  }
}
