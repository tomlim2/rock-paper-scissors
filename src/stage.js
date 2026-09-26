import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, raw, glowTexture, rbox } from './toon.js';

export const NEON = [0xff3e7f, 0xffe45e, 0x3ef2ff, 0xb45cff, 0x5cff8a, 0xff9b3e];

export const MOODS = {
  party: [0xff6aa8, 0xc42a7c],
  win: [0x5fd0ff, 0x2a6fd6],
  lose: [0xffb347, 0xdb5a36],
  draw: [0xc9a4ff, 0x8a4fe0],
};

const STAGE_W = 26;
const STAGE_D = 10;
const FRONT_Z = 2.4;
const FLOOR_Y = -1.29;
const HALL_Y = -2.4;

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// 트로트 가요무대 스타일 무대
export class Stage {
  constructor(scene) {
    this.scene = scene;
    this.flash = 0;
    this.beat = 0;
    this.moodA = raw(MOODS.party[0]);
    this.moodB = raw(MOODS.party[1]);
    this.moodTargetA = this.moodA.clone();
    this.moodTargetB = this.moodB.clone();

    this.buildBackdrop();
    this.buildMarquee();
    this.buildStage();
    this.buildCurtains();
    this.buildDisco();
    this.buildBeams();
    this.buildCrowd();
    this.confetti = new Confetti(scene);
    this.floaters = new Floaters(scene);
    this.pows = new Pows(scene);
  }

  // ---------- 빙글빙글 햇살 배경 ----------
  buildBackdrop() {
    this.backMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFlash: { value: 0 },
        uA: { value: this.moodA },
        uB: { value: this.moodB },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uFlash;
        uniform vec3 uA;
        uniform vec3 uB;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec2 p = (vUv - vec2(0.5, 0.46)) * vec2(1.69, 1.0);
          float a = atan(p.y, p.x);
          float r = length(p);
          float s = sin(a * 16.0 + uTime * 0.3);
          float rays = smoothstep(-0.04, 0.04, s);
          vec3 col = mix(uB, uA, rays);
          col = mix(col, vec3(1.0, 0.88, 0.66), smoothstep(0.18, 0.0, r) * 0.38);
          col = mix(col, vec3(0.17, 0.05, 0.23), smoothstep(0.2, 0.62, r) * 0.85);
          // 미러볼 반사광 점점이
          vec2 g = vUv * vec2(46.0, 27.0) + vec2(uTime * 0.5, sin(uTime * 0.23) * 1.5);
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5;
          float h = hash(id);
          vec2 off = (vec2(hash(id + 1.7), hash(id + 3.1)) - 0.5) * 0.5;
          float dotm = smoothstep(0.13, 0.03, length(f - off)) * step(0.84, h);
          col += dotm * (0.28 + 0.28 * sin(uTime * 4.0 + h * 40.0));
          col += uFlash * 0.06;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(44, 26), this.backMat);
    back.position.set(0, 3, -7);
    this.scene.add(back);
  }

  // ---------- 금테 전구 액자 (네모) ----------
  buildMarquee() {
    this.marquee = new THREE.Group();
    this.marquee.position.set(0, 2.05, -6.6);
    const W = 6.2;
    const H = 4.9;
    const T = 0.14;
    const gold = toon(0xffc53d, { emissive: 0x4a2a00 });
    for (const [w, h, x, y] of [
      [W + T, T, 0, H / 2],
      [W + T, T, 0, -H / 2],
      [T, H + T, -W / 2, 0],
      [T, H + T, W / 2, 0],
    ]) {
      const bar = new THREE.Mesh(rbox(w, h, T, 0.05), gold);
      bar.position.set(x, y, 0);
      this.marquee.add(bar);
    }

    // 테두리를 따라 한 바퀴 도는 네모 전구
    const pts = [];
    const nx = Math.round(W / 0.42);
    const ny = Math.round(H / 0.42);
    for (let i = 0; i < nx; i++) pts.push([-W / 2 + (i / nx) * W, H / 2]);
    for (let i = 0; i < ny; i++) pts.push([W / 2, H / 2 - (i / ny) * H]);
    for (let i = 0; i < nx; i++) pts.push([W / 2 - (i / nx) * W, -H / 2]);
    for (let i = 0; i < ny; i++) pts.push([-W / 2, -H / 2 + (i / ny) * H]);
    this.bulbCount = pts.length;
    this.bulbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.17, 0.17, 0.1), new THREE.MeshBasicMaterial(), pts.length);
    const glowPos = new Float32Array(pts.length * 3);
    const m = new THREE.Matrix4();
    pts.forEach(([x, y], i) => {
      m.makeTranslation(x, y, 0.09);
      this.bulbs.setMatrixAt(i, m);
      glowPos.set([x, y, 0.15], i * 3);
    });
    this.marquee.add(this.bulbs);
    this.bulbGlow = glowPoints(glowPos, 0.75);
    this.marquee.add(this.bulbGlow);
    this.scene.add(this.marquee);
  }

  // ---------- 디스코 타일 무대 (네모 단상) ----------
  buildStage() {
    this.floorMat = new THREE.ShaderMaterial({
      uniforms: {
        uBeat: { value: 0 },
        uFlash: { value: 0 },
        uShadow: { value: new THREE.Vector2(0.8, -0.2) },
        uSpot: { value: new THREE.Vector2(0.4, 0.2) },
        uBeamPos: { value: [new THREE.Vector2(), new THREE.Vector2()] },
        uBeamCol: { value: [raw(NEON[0]), raw(NEON[2])] },
        uPal: { value: NEON.map(raw) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld;
        uniform float uBeat;
        uniform float uFlash;
        uniform vec2 uShadow;
        uniform vec2 uSpot;
        uniform vec2 uBeamPos[2];
        uniform vec3 uBeamCol[2];
        uniform vec3 uPal[6];
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec2 w = vWorld.xz;
          vec2 q = w / 1.1;
          vec2 cell = floor(q);
          vec2 f = fract(q);
          float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
          float grout = smoothstep(0.015, 0.05, edge);
          float checker = mod(cell.x + cell.y, 2.0);
          vec3 col = mix(vec3(0.11, 0.05, 0.18), vec3(0.17, 0.08, 0.26), checker);
          float b = floor(uBeat);
          float lit = step(0.62, hash(cell + b * vec2(1.7, 9.2)));
          int idx = int(floor(hash(cell * 1.31 + b * 0.77) * 5.999));
          col += uPal[idx] * lit * (0.22 + 0.5 * uFlash);
          col += 0.05 * (1.0 - smoothstep(0.0, 0.3, f.y));
          col *= mix(0.3, 1.0, grout);
          float d = length((w - uSpot) * vec2(1.0, 1.35));
          col += vec3(1.0, 0.82, 0.66) * smoothstep(2.8, 0.2, d) * 0.2;
          for (int i = 0; i < 2; i++) {
            col += uBeamCol[i] * smoothstep(1.5, 0.0, length(w - uBeamPos[i])) * 0.3;
          }
          // 네모난 몸이라 그림자도 둥근 네모
          vec2 sd = abs(w - uShadow) - vec2(0.95, 0.55);
          float box = length(max(sd, 0.0)) + min(max(sd.x, sd.y), 0.0);
          col *= 1.0 - 0.6 * smoothstep(0.45, -0.1, box);
          col *= mix(0.4, 1.0, smoothstep(-7.0, -1.5, vWorld.z));
          col *= mix(0.5, 1.0, smoothstep(10.5, 5.0, abs(vWorld.x)));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const apron = toon(0x9e1742);
    const stage = new THREE.Mesh(new THREE.BoxGeometry(STAGE_W, 1.1, STAGE_D), [apron, apron, this.floorMat, apron, apron, apron]);
    stage.position.set(0, FLOOR_Y - 0.55, FRONT_Z - STAGE_D / 2);
    this.scene.add(stage);

    const gold = toon(0xffc53d, { emissive: 0x4a2a00 });
    const trim = new THREE.Mesh(rbox(STAGE_W, 0.16, 0.14, 0.05), gold);
    trim.position.set(0, FLOOR_Y - 0.08, FRONT_Z + 0.02);
    this.scene.add(trim);
    const base = new THREE.Mesh(rbox(STAGE_W, 0.12, 0.14, 0.04), gold);
    base.position.set(0, FLOOR_Y - 1.02, FRONT_Z + 0.02);
    this.scene.add(base);

    // 앞 무대 조명 (네모 전구 한 줄)
    const xs = [];
    for (let x = -11; x <= 11.01; x += 0.9) xs.push(x);
    this.footCount = xs.length;
    const glowPos = new Float32Array(xs.length * 3);
    this.foots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.08), new THREE.MeshBasicMaterial(), xs.length);
    const m = new THREE.Matrix4();
    xs.forEach((x, i) => {
      m.makeTranslation(x, FLOOR_Y - 0.4, FRONT_Z + 0.05);
      this.foots.setMatrixAt(i, m);
      glowPos.set([x, FLOOR_Y - 0.4, FRONT_Z + 0.12], i * 3);
    });
    this.scene.add(this.foots);
    this.footGlow = glowPoints(glowPos, 0.6);
    this.scene.add(this.footGlow);

    const hall = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshBasicMaterial({ color: 0x12061a }));
    hall.rotation.x = -Math.PI / 2;
    hall.position.set(0, HALL_Y, 16);
    this.scene.add(hall);
  }

  // ---------- 빨간 벨벳 커튼 ----------
  buildCurtains() {
    const mat = toon(0xc81d4e, { side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(5, 14, 60, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      // 아래쪽은 묶어서 바깥으로 모음
      const t = THREE.MathUtils.smoothstep(-y, 1, 7);
      pos.setX(i, x * (1 - t * 0.45) + t * 1.1);
      pos.setZ(i, Math.sin(x * 5.2) * 0.22 * (1 - t * 0.5));
    }
    geo.computeVertexNormals();
    for (const sx of [-1, 1]) {
      const c = new THREE.Mesh(geo, mat);
      c.scale.x = sx;
      c.position.set(sx * 9.4, 4.2, -4.2);
      c.rotation.y = -sx * 0.35;
      this.scene.add(c);
    }

    const vGeo = new THREE.PlaneGeometry(28, 2.2, 160, 1);
    const vp = vGeo.attributes.position;
    const fringe = [];
    for (let i = 0; i < vp.count; i++) {
      const x = vp.getX(i);
      const y = vp.getY(i);
      vp.setZ(i, Math.sin(x * 4) * 0.18);
      if (y < 0) {
        const ny = y - Math.abs(Math.sin(x * 1.15)) * 0.55;
        vp.setY(i, ny);
        fringe.push(new THREE.Vector3(x, ny, Math.sin(x * 4) * 0.18 + 0.05));
      }
    }
    vGeo.computeVertexNormals();
    const valance = new THREE.Mesh(vGeo, mat);
    valance.position.set(0, 6.9, -3.6);
    this.scene.add(valance);
    fringe.sort((a, b) => a.x - b.x);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fringe), 300, 0.07, 6),
      toon(0xffc53d, { emissive: 0x4a2a00 }),
    );
    tube.position.copy(valance.position);
    this.scene.add(tube);
  }

  // ---------- 미러 큐브 (네모난 미러볼) ----------
  buildDisco() {
    const n = 4;
    const size = 1.0;
    const t = size / n;
    const Z = new THREE.Vector3(0, 0, 1);
    const geos = [];
    let seed = 7;
    for (const [x, y, z] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ]) {
      const N = new THREE.Vector3(x, y, z);
      const q = new THREE.Quaternion().setFromUnitVectors(Z, N);
      const U = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      const V = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const g = new THREE.BoxGeometry(t * 0.9, t * 0.9, 0.04);
          // 타일마다 살짝 다른 각도 → 반사가 반짝반짝 흩어짐
          const jitter = new THREE.Quaternion().setFromEuler(
            new THREE.Euler((hash(seed++) - 0.5) * 0.3, (hash(seed++) - 0.5) * 0.3, 0),
          );
          const p = N.clone()
            .multiplyScalar(size / 2)
            .addScaledVector(U, (i + 0.5) * t - size / 2)
            .addScaledVector(V, (j + 0.5) * t - size / 2);
          g.applyMatrix4(new THREE.Matrix4().compose(p, q.clone().multiply(jitter), new THREE.Vector3(1, 1, 1)));
          geos.push(g);
        }
      }
    }
    this.disco = new THREE.Mesh(
      mergeGeometries(geos),
      new THREE.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 1, roughness: 0.12 }),
    );
    this.disco.add(new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.97, 0.97), new THREE.MeshBasicMaterial({ color: 0x2a2436 })));
    this.disco.rotation.x = 0.45;
    this.scene.add(this.disco);
    this.string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 6),
      new THREE.MeshBasicMaterial({ color: 0xbbbbcc }),
    );
    this.scene.add(this.string);
    const glints = new Float32Array(6 * 3);
    this.glints = glowPoints(glints, 0.5);
    this.scene.add(this.glints);
    this.setLayout(false);
  }

  // ---------- 무대 조명 빛줄기 ----------
  buildBeams() {
    const H = 13;
    const geo = new THREE.ConeGeometry(1.8, H, 32, 1, true);
    geo.translate(0, -H / 2, 0);
    this.beams = [-1, 1].map((sx, i) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: raw(NEON[i * 2]) }, uH: { value: H }, uOpacity: { value: 0.38 } },
        vertexShader: /* glsl */ `
          uniform float uH;
          varying vec3 vN;
          varying vec3 vV;
          varying float vT;
          void main() {
            vT = -position.y / uH;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying vec3 vN;
          varying vec3 vV;
          varying float vT;
          void main() {
            float along = smoothstep(0.0, 0.2, vT) * (1.0 - smoothstep(0.5, 1.0, vT));
            float soft = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
            gl_FragColor = vec4(uColor * along * soft * uOpacity, 1.0);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(geo, mat);
      beam.position.set(sx * 7, 9.5, 1.5);
      beam.userData = { sx, target: new THREE.Vector3() };
      this.scene.add(beam);
      return beam;
    });
  }

  // ---------- 관객석 + 응원봉 ----------
  buildCrowd() {
    // 네모네모 관객
    const head = rbox(0.56, 0.54, 0.5, 0.15);
    head.translate(0, 1.55, 0);
    const torso = rbox(0.86, 1.0, 0.52, 0.18);
    torso.translate(0, 0.72, 0);
    const person = mergeGeometries([head, torso]);
    const people = [];
    let seed = 1;
    for (let z = 3.1; z < 14; z += 0.95) {
      const row = Math.round((z - 3.1) / 0.95);
      for (let x = -11; x <= 11; x += 0.95) {
        const jx = (hash(seed++) - 0.5) * 0.35;
        const px = x + jx + (row % 2) * 0.47;
        people.push({
          x: px,
          z: z + (hash(seed++) - 0.5) * 0.3,
          s: 0.9 + hash(seed++) * 0.2,
          jump: hash(seed++) < 0.55,
          stick: hash(seed++) < 0.45,
          off: hash(seed++) * Math.PI * 2,
          color: NEON[Math.floor(hash(seed++) * NEON.length)],
        });
      }
    }
    this.people = people;
    this.crowd = new THREE.InstancedMesh(person, new THREE.MeshBasicMaterial({ color: 0xffffff }), people.length);
    const c = new THREE.Color();
    // 무대 가까운 줄은 조명을 받아 조금 밝게, 뒤로 갈수록 어둡게
    const front = new THREE.Color(0x3b1a52);
    const back = new THREE.Color(0x13061c);
    people.forEach((p, i) => {
      c.lerpColors(front, back, THREE.MathUtils.clamp((p.z - 3) / 7, 0, 1)).multiplyScalar(0.85 + hash(i * 3.3) * 0.3);
      this.crowd.setColorAt(i, c);
    });
    this.scene.add(this.crowd);

    const sticks = people.filter((p) => p.stick);
    this.sticks = sticks;
    this.stickMesh = new THREE.InstancedMesh(
      rbox(0.1, 0.6, 0.1, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      sticks.length,
    );
    sticks.forEach((p, i) => this.stickMesh.setColorAt(i, c.setHex(p.color)));
    this.scene.add(this.stickMesh);
    const colors = new Float32Array(sticks.length * 3);
    sticks.forEach((p, i) => {
      c.setHex(p.color);
      colors.set([c.r, c.g, c.b], i * 3);
    });
    this.stickGlow = glowPoints(new Float32Array(sticks.length * 3), 1.3, colors);
    this.scene.add(this.stickGlow);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  setLayout(portrait, claudeX = 0, camX = 0) {
    this.centerX = claudeX;
    // 카메라에서 봤을 때 액자가 Claude 뒤에 오도록 시차 보정
    this.marquee.position.x = camX + (claudeX - camX) * 1.45;
    this.disco.position.set(portrait ? 1.9 : -3.3, portrait ? 4.1 : 4.4, -3);
    this.string.position.set(this.disco.position.x, this.disco.position.y + 3.3, -3);
  }

  /** 님 손(=내 눈과 내 손 사이)을 가리는 관객은 비켜주기 */
  clearCrowd(x, half) {
    for (const p of this.people) p.hidden = Math.abs(p.x - x) < half && p.z < 9;
  }

  setMood(name) {
    const [a, b] = MOODS[name] || MOODS.party;
    this.moodTargetA.setHex(a, THREE.LinearSRGBColorSpace);
    this.moodTargetB.setHex(b, THREE.LinearSRGBColorSpace);
  }

  onBeat(beat) {
    this.beat = beat;
    this.flash = 1;
    this.floorMat.uniforms.uBeat.value = beat;
    this.beams.forEach((bm, i) => bm.material.uniforms.uColor.value.setHex(NEON[(beat + i * 3) % NEON.length], THREE.LinearSRGBColorSpace));
    this.floorMat.uniforms.uBeamCol.value.forEach((col, i) => col.setHex(NEON[(beat + i * 3) % NEON.length], THREE.LinearSRGBColorSpace));
  }

  setShadow(x, z) {
    this.floorMat.uniforms.uShadow.value.set(x, z);
    this.floorMat.uniforms.uSpot.value.set(x - 0.3, z + 0.4);
  }

  update(dt, time, phase, beat, calm = false) {
    this.flash = Math.max(0, this.flash - dt * 3.5);
    const k = Math.min(1, dt * 3);
    this.moodA.lerp(this.moodTargetA, k);
    this.moodB.lerp(this.moodTargetB, k);
    this.backMat.uniforms.uTime.value = calm ? time * 0.3 : time;
    this.backMat.uniforms.uFlash.value = this.flash;
    this.floorMat.uniforms.uFlash.value = this.flash * (calm ? 0.4 : 1);

    // 전구 쫓아가기
    const chase = Math.floor(time * 9);
    const c = new THREE.Color();
    const glow = this.bulbGlow.geometry.attributes.color;
    for (let i = 0; i < this.bulbCount; i++) {
      const on = (i + chase) % 4 < 2;
      c.setHex(on ? 0xfff2a8 : 0x8a5a2a);
      this.bulbs.setColorAt(i, c);
      const g = on ? 0.9 : 0.12 + this.flash * 0.3;
      glow.setXYZ(i, g, g * 0.85, g * 0.55);
    }
    this.bulbs.instanceColor.needsUpdate = true;
    glow.needsUpdate = true;

    const fglow = this.footGlow.geometry.attributes.color;
    for (let i = 0; i < this.footCount; i++) {
      const on = (i + (beat % 2)) % 2 === 0;
      c.setHex(on ? 0xfff6d0 : 0xffb070);
      this.foots.setColorAt(i, c);
      const g = on ? 0.7 : 0.25;
      fglow.setXYZ(i, g, g * 0.9, g * 0.7);
    }
    this.foots.instanceColor.needsUpdate = true;
    fglow.needsUpdate = true;

    // 미러볼 + 반짝
    this.disco.rotation.y += dt * 0.6;
    const gp = this.glints.geometry.attributes.position;
    const gc = this.glints.geometry.attributes.color;
    for (let i = 0; i < 6; i++) {
      const a = time * 0.7 + i * 1.9;
      const y = Math.sin(i * 2.3) * 0.5;
      gp.setXYZ(i, this.disco.position.x + Math.cos(a) * 0.55, this.disco.position.y + y, this.disco.position.z + Math.abs(Math.sin(a)) * 0.6);
      const tw = Math.max(0, Math.sin(time * 6 + i * 2.1)) * 0.9;
      gc.setXYZ(i, tw, tw, tw);
    }
    gp.needsUpdate = true;
    gc.needsUpdate = true;

    // 빛줄기 흔들기
    this.beams.forEach((bm, i) => {
      const { sx, target } = bm.userData;
      target.set((this.centerX || 0) + 0.8 - sx * 0.2 + Math.sin(time * 0.9 + i * 2) * 2.4, FLOOR_Y, Math.cos(time * 0.7 + i) * 1.6);
      const dir = this._v.copy(target).sub(bm.position).normalize();
      bm.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      this.floorMat.uniforms.uBeamPos.value[i].set(target.x, target.z);
    });

    // 관객 들썩들썩
    const hop = Math.sin(phase * Math.PI);
    const m = this._m;
    const s = this._s;
    const q = this._q;
    this.people.forEach((p, i) => {
      const y = HALL_Y + (p.jump ? hop * hop * 0.14 : 0);
      s.setScalar(p.hidden ? 0 : p.s);
      q.identity();
      m.compose(this._v.set(p.x, y, p.z), q, s);
      this.crowd.setMatrixAt(i, m);
      p.y = y;
    });
    this.crowd.instanceMatrix.needsUpdate = true;

    const sp = this.stickGlow.geometry.attributes.position;
    this.sticks.forEach((p, i) => {
      const ang = Math.sin(((beat + phase) * Math.PI) / 2 + (p.off > 3 ? 0 : Math.PI)) * 0.55;
      const bx = p.x + 0.3 * p.s;
      const by = p.y + 1.85 * p.s;
      this._e.set(0, 0, ang);
      q.setFromEuler(this._e);
      // 캡슐 중심 = 손 위치 + 막대 방향 * 0.3
      const cx = bx - Math.sin(ang) * 0.3;
      const cy = by + Math.cos(ang) * 0.3;
      m.compose(this._v.set(cx, cy, p.z), q, s.setScalar(p.hidden ? 0 : 1));
      this.stickMesh.setMatrixAt(i, m);
      sp.setXYZ(i, bx - Math.sin(ang) * 0.42, p.hidden ? -100 : by + Math.cos(ang) * 0.42, p.z + 0.05);
    });
    this.stickMesh.instanceMatrix.needsUpdate = true;
    sp.needsUpdate = true;

    this.confetti.update(dt);
    this.floaters.update(dt, time);
    this.pows.update(dt);
  }
}

function glowPoints(positions, size, colors) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors || new Float32Array(positions.length), 3));
  const p = new THREE.Points(
    g,
    new THREE.PointsMaterial({
      size,
      map: glowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  p.frustumCulled = false;
  return p;
}

// ---------- 꽃가루 ----------
class Confetti {
  constructor(scene) {
    this.count = 360;
    const geo = new THREE.PlaneGeometry(0.13, 0.22);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), this.count);
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
    for (let i = 0; i < this.count; i++) this.mesh.setColorAt(i, col.setHex(NEON[i % NEON.length]));
    this.cursor = 0;
    this.dummy = new THREE.Object3D();
    scene.add(this.mesh);
  }

  burst(origin, n = 160, power = 1) {
    for (let i = 0; i < n; i++) {
      const p = this.p[this.cursor];
      this.cursor = (this.cursor + 1) % this.count;
      p.pos.copy(origin);
      const a = Math.random() * Math.PI * 2;
      const s = (1.5 + Math.random() * 4) * power;
      p.vel.set(Math.cos(a) * s * 0.7, 4 + Math.random() * 5 * power, Math.sin(a) * s * 0.4 + 0.8);
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
        p.vel.y = Math.max(p.vel.y, -1.5);
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

// ---------- 둥실둥실 음표/하트 ----------
function glyphTexture(ch, fill) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 96px "Jua", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.strokeStyle = '#2a1233';
  g.strokeText(ch, 64, 70);
  g.fillStyle = fill;
  g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Floaters {
  constructor(scene) {
    this.kinds = {
      note: [glyphTexture('♪', '#ffe45e'), glyphTexture('♫', '#3ef2ff'), glyphTexture('♪', '#ff9bd0')],
      heart: [glyphTexture('♥', '#ff3e7f'), glyphTexture('♥', '#ff8fc0')],
      spark: [glyphTexture('✦', '#fff6a0')],
    };
    this.pool = Array.from({ length: 36 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      s.visible = false;
      s.userData = { life: 0, max: 1, vel: new THREE.Vector3(), phase: 0 };
      scene.add(s);
      return s;
    });
    this.cursor = 0;
  }

  emit(kind, origin, n = 4, spread = 0.8) {
    const tex = this.kinds[kind];
    for (let i = 0; i < n; i++) {
      const s = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
      s.material.map = tex[i % tex.length];
      s.material.needsUpdate = true;
      s.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.3, (Math.random() - 0.5) * 0.3));
      const u = s.userData;
      u.life = u.max = 1.4 + Math.random() * 0.8;
      u.vel.set((Math.random() - 0.5) * 0.6, 1.1 + Math.random() * 0.8, 0.2);
      u.phase = Math.random() * 6;
      u.delay = i * 0.12;
      s.visible = false;
    }
  }

  update(dt, time) {
    for (const s of this.pool) {
      const u = s.userData;
      if (u.life <= 0) continue;
      if (u.delay > 0) {
        u.delay -= dt;
        continue;
      }
      s.visible = true;
      u.life -= dt;
      s.position.addScaledVector(u.vel, dt);
      s.position.x += Math.sin(time * 4 + u.phase) * dt * 0.4;
      const t = 1 - u.life / u.max;
      const pop = Math.min(1, t * 6);
      s.scale.setScalar(0.45 * pop * (1 + Math.sin(time * 8 + u.phase) * 0.05));
      s.material.opacity = Math.min(1, u.life * 2);
      if (u.life <= 0) s.visible = false;
    }
  }
}

// ---------- 쾅! 만화 효과 ----------
function burstTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const star = (r1, r2, n, fill) => {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? r1 * (0.85 + ((i * 37) % 7) / 40) : r2;
      g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 8;
    g.lineJoin = 'round';
    g.strokeStyle = '#2a1233';
    g.stroke();
  };
  star(120, 70, 14, '#ffe45e');
  star(78, 48, 12, '#ff9b3e');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Pows {
  constructor(scene) {
    const tex = burstTexture();
    this.pool = Array.from({ length: 3 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.visible = false;
      s.userData.life = 0;
      scene.add(s);
      return s;
    });
    this.cursor = 0;
  }

  pop(pos, size = 1.8) {
    const s = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    s.position.copy(pos);
    s.userData.life = 1;
    s.userData.size = size;
    s.material.rotation = Math.random() * Math.PI;
    s.visible = true;
  }

  update(dt) {
    for (const s of this.pool) {
      const u = s.userData;
      if (u.life <= 0) continue;
      u.life -= dt * 2.2;
      const t = 1 - u.life;
      const k = t < 0.25 ? t / 0.25 : 1;
      s.scale.setScalar(u.size * (0.4 + 0.6 * k) * (1 + t * 0.15));
      s.material.opacity = Math.min(1, u.life * 2.5);
      if (u.life <= 0) s.visible = false;
    }
  }
}
