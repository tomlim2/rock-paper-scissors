import * as THREE from 'three';
import { toon, withOutline, rimShell, rbox, INK } from './toon.js';
import { Limb } from './limb.js';

const ORANGE = 0xd97757;
const ORANGE_TOP = 0xeb9a74;
const ORANGE_BOTTOM = 0xc4603f;

// 둥근 모서리 큐브 몸통 (Claude Code 마스코트처럼 네모네모)
export const BODY = { w: 2.2, h: 1.9, d: 1.6, r: 0.36 };
const FZ = BODY.d / 2; // 얼굴이 붙는 앞면
const PIX = 0.07; // 도트 입 한 칸

function bodyGeometry() {
  const geo = rbox(BODY.w, BODY.h, BODY.d, BODY.r, 5);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(ORANGE_TOP);
  const bottom = new THREE.Color(ORANGE_BOTTOM);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.lerpColors(bottom, top, THREE.MathUtils.smoothstep(pos.getY(i), -0.9, 0.9));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** 도트(픽셀) 모양을 작은 큐브로 찍기 */
function pixels(coords, mat) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(PIX, PIX, 0.04);
  for (const [x, y] of coords) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * PIX, y * PIX, 0);
    g.add(m);
  }
  return g;
}

export class ClaudeBuddy {
  constructor() {
    this.root = new THREE.Group();
    this.bob = new THREE.Group();
    this.root.add(this.bob);
    this.world = new THREE.Group(); // 팔(월드 좌표)을 담는 곳 — 씬에 따로 붙임

    const geo = bodyGeometry();
    const body = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true }));
    this.bob.add(withOutline(body, 0.045));
    this.bob.add(rimShell(geo, 0xffc9a0, 0.5));

    const ink = new THREE.MeshBasicMaterial({ color: INK });
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mouthRed = new THREE.MeshBasicMaterial({ color: 0x6b1030 });
    this.face = new THREE.Group();
    this.face.position.z = FZ;
    this.bob.add(this.face);

    // ---------- 눈: 세로 네모 + 도트 하이라이트 ----------
    this.eyes = [-1, 1].map((sx) => {
      const e = new THREE.Group();
      e.position.set(sx * 0.42, 0.14, 0.02);
      e.add(new THREE.Mesh(rbox(0.22, 0.34, 0.06, 0.06), ink));
      const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.08), white);
      hl.position.set(0.035, 0.08, 0.035);
      const hl2 = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), white);
      hl2.position.set(-0.045, -0.09, 0.035);
      e.add(hl, hl2);
      this.face.add(e);
      return e;
    });

    const stroke = rbox(0.06, 0.2, 0.04, 0.025);
    // ^ ^ 웃는 눈
    this.happyEyes = new THREE.Group();
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(sx * 0.42, 0.12, 0.02);
      for (const k of [-1, 1]) {
        const m = new THREE.Mesh(stroke, ink);
        m.rotation.z = k * 0.8;
        m.position.set(-k * 0.06, -0.02, 0);
        g.add(m);
      }
      this.happyEyes.add(g);
    }
    this.face.add(this.happyEyes);

    // > < 질끈 감은 눈 + 도트 눈물
    this.sadEyes = new THREE.Group();
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(sx * 0.42, 0.14, 0.02);
      const up = new THREE.Mesh(stroke, ink);
      up.rotation.z = -sx * 0.785;
      up.position.set(sx * 0.04, 0.05, 0);
      const down = new THREE.Mesh(stroke, ink);
      down.rotation.z = sx * 0.785;
      down.position.set(sx * 0.04, -0.05, 0);
      g.add(up, down);
      this.sadEyes.add(g);
    }
    const tearMat = toon(0x7fdcff, { emissive: 0x1a5f7a });
    this.tears = [-1, 1].map((sx) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), tearMat);
      t.userData.sx = sx;
      this.sadEyes.add(t);
      return t;
    });
    this.face.add(this.sadEyes);

    // ---------- 눈썹 ----------
    this.brows = [-1, 1].map((sx) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.42, 0.45, 0.02);
      pivot.add(new THREE.Mesh(rbox(0.28, 0.07, 0.05, 0.03), ink));
      this.face.add(pivot);
      return { pivot, sx, y: 0, rot: 0 };
    });

    // ---------- 볼터치 ----------
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff6f91, transparent: true, opacity: 0.75 });
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(rbox(0.24, 0.12, 0.02, 0.05), blushMat);
      b.position.set(sx * 0.63, -0.13, 0.012);
      this.face.add(b);
    }

    // ---------- 도트 입 ----------
    const mouth = new THREE.Group();
    mouth.position.set(0, -0.24, 0.02);
    this.face.add(mouth);
    const open = new THREE.Group();
    open.add(new THREE.Mesh(rbox(0.34, 0.22, 0.04, 0.07), mouthRed));
    const tongue = new THREE.Mesh(rbox(0.18, 0.08, 0.02, 0.03), new THREE.MeshBasicMaterial({ color: 0xff7a9a }));
    tongue.position.set(0, -0.055, 0.022);
    open.add(tongue);
    this.mouths = {
      smile: pixels([[-2, 1], [2, 1], [-1, 0], [0, 0], [1, 0]], ink),
      frown: pixels([[-2, 0], [2, 0], [-1, 1], [0, 1], [1, 1]], ink),
      cat: pixels([[-2, 1], [-1, 0], [0, 1], [1, 0], [2, 1]], ink),
      open,
      o: new THREE.Mesh(rbox(0.14, 0.17, 0.04, 0.05), mouthRed),
    };
    this.mouths.smile.position.y = -0.03;
    this.mouths.frown.position.y = -0.05;
    this.mouths.cat.position.y = -0.03;
    Object.values(this.mouths).forEach((m) => mouth.add(m));
    this.open = open;

    // 땀방울 (띠용)
    this.sweat = new THREE.Mesh(rbox(0.12, 0.16, 0.05, 0.04), tearMat);
    this.sweat.rotation.z = Math.PI / 4;
    this.sweat.position.set(0.66, 0.5, 0.03);
    this.face.add(this.sweat);

    // ---------- 도트 선글라스 😎 ----------
    this.shades = new THREE.Group();
    this.shades.position.set(0, 0.15, 0.05);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x15102a, metalness: 0.6, roughness: 0.2 });
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(rbox(0.46, 0.3, 0.07, 0.05), lensMat);
      lens.position.x = sx * 0.42;
      this.shades.add(withOutline(lens, 0.02));
      for (const [gx, gy, s] of [
        [0.1, 0.06, 0.07],
        [0.17, -0.01, 0.045],
      ]) {
        const glint = new THREE.Mesh(new THREE.PlaneGeometry(s, s), white);
        glint.position.set(sx * 0.42 + gx, gy, 0.04);
        this.shades.add(glint);
      }
    }
    const bar = new THREE.Mesh(rbox(1.36, 0.07, 0.06, 0.03), lensMat);
    bar.position.y = 0.14;
    const bridge = new THREE.Mesh(rbox(0.22, 0.07, 0.05, 0.03), lensMat);
    bridge.position.y = 0.05;
    this.shades.add(bar, bridge);
    this.face.add(this.shades);

    // ---------- 나비넥타이 ----------
    const bowMat = toon(0xff3e7f);
    this.bow = new THREE.Group();
    this.bow.position.set(0, -0.56, FZ + 0.06);
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(rbox(0.3, 0.22, 0.1, 0.06), bowMat);
      w.position.x = sx * 0.16;
      w.rotation.z = sx * 0.2;
      this.bow.add(withOutline(w, 0.02));
      const dot = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xffe0ec }));
      dot.position.set(sx * 0.18, 0.02, 0.055);
      this.bow.add(dot);
    }
    const knot = new THREE.Mesh(rbox(0.12, 0.15, 0.13, 0.04), bowMat);
    this.bow.add(withOutline(knot, 0.02));
    this.bob.add(this.bow);

    // ---------- 머리 위 Claude 별 더듬이 ----------
    this.antenna = new THREE.Group();
    this.antenna.position.set(0, BODY.h / 2 - 0.03, 0);
    const stem = new THREE.Mesh(rbox(0.08, 0.42, 0.08, 0.03), toon(0x9a4a32));
    stem.position.y = 0.21;
    this.antenna.add(withOutline(stem, 0.018));
    this.spark = new THREE.Group();
    this.spark.position.y = 0.52;
    const rayMat = toon(0xe8825c, { emissive: 0x3a1206 });
    const lens = [0.2, 0.15, 0.19, 0.14, 0.21, 0.16, 0.18, 0.13, 0.2, 0.15, 0.19, 0.14];
    lens.forEach((len, i) => {
      const a = (i / lens.length) * Math.PI * 2;
      const ray = new THREE.Mesh(rbox(0.075, len, 0.075, 0.03), rayMat);
      ray.position.set(Math.cos(a) * (len / 2 + 0.05), Math.sin(a) * (len / 2 + 0.05), 0);
      ray.rotation.z = a - Math.PI / 2;
      this.spark.add(withOutline(ray, 0.016));
    });
    this.spark.add(new THREE.Mesh(rbox(0.15, 0.15, 0.1, 0.04), rayMat));
    this.antenna.add(this.spark);
    this.bob.add(this.antenna);
    this.ant = new THREE.Vector2();
    this.antVel = new THREE.Vector2();

    // ---------- 다리 네 개 (콩콩) ----------
    const legMat = toon(0xb0553a);
    const legGeo = rbox(0.3, 0.32, 0.44, 0.09);
    this.legs = [-0.74, -0.26, 0.26, 0.74].map((x) => {
      const l = new THREE.Mesh(legGeo, legMat);
      l.position.set(x, -BODY.h / 2 - 0.12, 0.12);
      this.root.add(withOutline(l, 0.025));
      return l;
    });

    // ---------- 팔 ----------
    const armMat = toon(ORANGE);
    // 님과 마주 보고 오른손으로 냄 → 화면에서는 Claude 몸 왼쪽. 마이크는 왼손(화면 오른쪽)
    this.shoulderHand = new THREE.Object3D();
    this.shoulderHand.position.set(-0.98, -0.2, 0.2);
    this.shoulderMic = new THREE.Object3D();
    this.shoulderMic.position.set(0.98, -0.2, 0.2);
    this.bob.add(this.shoulderHand, this.shoulderMic);
    this.armHand = new Limb(0.3, armMat);
    this.armMic = new Limb(0.26, armMat);
    this.world.add(this.armHand.group, this.armMic.group);

    // 마이크 든 손
    this.mitten = new THREE.Group();
    this.mitten.add(withOutline(new THREE.Mesh(rbox(0.36, 0.34, 0.34, 0.11), armMat), 0.025));
    const mic = new THREE.Group();
    const handle = new THREE.Mesh(rbox(0.1, 0.46, 0.1, 0.03), toon(0x2a2a3a));
    handle.position.y = 0.12;
    mic.add(withOutline(handle, 0.018));
    const band = new THREE.Mesh(rbox(0.14, 0.06, 0.14, 0.02), toon(0xffd23f));
    band.position.y = 0.34;
    mic.add(band);
    const head = new THREE.Mesh(
      rbox(0.26, 0.3, 0.26, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xcfd3e0, metalness: 0.7, roughness: 0.35 }),
    );
    head.position.y = 0.5;
    mic.add(withOutline(head, 0.018));
    this.mic = mic;
    this.mitten.add(mic);
    this.root.add(this.mitten);
    this.mitIdle = new THREE.Vector3(1.5, 0.0, 0.6);
    this.mitSing = new THREE.Vector3(0.42, -0.4, 1.25);
    this.sing = 0;
    this.singTarget = 0;

    this.hand = null;
    this.expression = 'normal';
    this.shout = 0;
    this.blinkT = 2;
    this.look = new THREE.Vector2();
    this.prevBobY = 0;
    this.prevVel = 0;
    this.browTarget = [0, 0];
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
    // [높이, 기울기] 기울기 > 0: 안쪽 끝이 내려감(결의), < 0: 올라감(울상)
    this.browTarget = {
      normal: [0, 0.06],
      happy: [0.06, -0.12],
      sad: [0, -0.42],
      shock: [0.12, -0.08],
      cool: [0.1, 0.18],
      focus: [-0.04, 0.42],
    }[name];
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
    this.bob.rotation.z = sway * (ex === 'cool' ? 0.12 : 0.05) * energy;
    if (ex === 'sad') this.bob.rotation.z = Math.sin(time * 2.4) * 0.03;
    this.bob.rotation.x = ex === 'sad' ? 0.1 : 0;

    // 다리: 왼쪽 두 개 / 오른쪽 두 개가 번갈아 콩콩
    this.legs.forEach((l, i) => {
      const mine = (beat + (i < 2 ? 0 : 1)) % 2 === 0;
      l.position.y = -BODY.h / 2 - 0.12 + (mine ? hop * 0.1 * energy : 0) * (ex === 'sad' ? 0.2 : 1);
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
    this.spark.scale.setScalar(1 + Math.pow(1 - phase, 6) * 0.18);

    // 눈 깜빡 + 시선
    this.blinkT -= dt;
    let blink = 1;
    if (this.blinkT < 0.12) blink = Math.max(0.08, Math.abs(this.blinkT - 0.06) / 0.06);
    if (this.blinkT < 0) this.blinkT = 1.6 + Math.random() * 3;
    const eyeScale = ex === 'shock' ? 1.3 : 1;
    const squint = ex === 'focus' ? 0.7 : 1;
    this.eyes.forEach((e, i) => {
      e.scale.set(eyeScale, eyeScale * blink * squint, 1);
      e.position.x = (i === 0 ? -0.42 : 0.42) + this.look.x * 0.06;
      e.position.y = 0.14 + this.look.y * 0.05;
    });

    this.brows.forEach((b) => {
      const [ty, tr] = this.browTarget;
      b.y += (ty - b.y) * Math.min(1, dt * 14);
      b.rot += (tr * b.sx - b.rot) * Math.min(1, dt * 14);
      b.pivot.position.y = 0.45 + b.y;
      b.pivot.rotation.z = b.rot;
    });

    // 도트 눈물 뚝뚝
    this.tears.forEach((t, i) => {
      const k = (time * 1.3 + i * 0.5) % 1;
      t.position.set(t.userData.sx * (0.42 + 0.02 + k * 0.08), 0.02 - k * 0.6, 0.04 + k * 0.05);
      t.scale.setScalar(1 - k * 0.5);
    });

    this.sweat.position.y = 0.5 + Math.sin(time * 6) * 0.015;

    // 입
    this.shout = Math.max(0, this.shout - dt * 3);
    this.sing += (this.singTarget - this.sing) * Math.min(1, dt * 6);
    const mouth = this.mouthFor();
    for (const [k, m] of Object.entries(this.mouths)) m.visible = k === mouth;
    const talk = ex === 'cool' && this.sing > 0.5 ? 0.6 + Math.abs(Math.sin(time * 9)) * 0.5 : 1;
    this.open.scale.set(1, (0.75 + this.shout * 0.45) * talk, 1);
    if (mouth === 'frown') this.mouths.frown.position.x = Math.sin(time * 14) * 0.008;

    this.updateArms(time, energy);
  }

  updateArms(time, energy) {
    const { _a: a, _b: b, _c: c } = this;

    // 마이크 팔: 평소엔 옆에서 흔들, 이기면 입에 대고 노래
    const swing = Math.sin(time * 4.6) * 0.08 * energy;
    this.mitten.position.lerpVectors(this.mitIdle, this.mitSing, this.sing);
    this.mitten.position.y += swing * (1 - this.sing) + this.bob.position.y * 0.8;
    this.mitten.rotation.z = THREE.MathUtils.lerp(-0.2 + swing, 0.4, this.sing);
    this.mic.rotation.set(THREE.MathUtils.lerp(0.2, -0.5, this.sing), 0, THREE.MathUtils.lerp(-0.35, 0.55, this.sing));
    this.shoulderMic.getWorldPosition(a);
    this.mitten.getWorldPosition(c);
    b.lerpVectors(a, c, 0.5);
    b.x += 0.12;
    b.y -= 0.25;
    this.armMic.update(a, b, c);

    if (this.hand) {
      this.shoulderHand.getWorldPosition(a);
      this.hand.wrist.getWorldPosition(c);
      b.lerpVectors(a, c, 0.5);
      b.x -= 0.1;
      b.y -= 0.3;
      b.z += 0.1;
      this.armHand.update(a, b, c);
    }
  }
}
