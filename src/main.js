import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './style.css';
import { Music } from './audio.js';
import { Hand, thumbUpQuat } from './hand.js';
import { ClaudeBuddy } from './claude.js';
import { Stage } from './stage.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 설정 저장 (브라우저별 편의용) ----------
const prefs = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`rps.${key}`);
      return v === null ? fallback : v === '1';
    } catch {
      return fallback;
    }
  },
  set(key, on) {
    try {
      localStorage.setItem(`rps.${key}`, on ? '1' : '0');
    } catch {
      /* 저장 못 해도 게임은 그대로 */
    }
  },
};

// ---------- 기본 세팅 ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x2a1233, 18, 34);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
const camBase = new THREE.Vector3();
const camTarget = new THREE.Vector3();
let baseFov = 42;

scene.add(new THREE.HemisphereLight(0xfff0f5, 0x442255, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(3, 6, 8);
const rim = new THREE.DirectionalLight(0xff7ab8, 1.4);
rim.position.set(-3, 5, -6);
scene.add(key, rim);

const stage = new Stage(scene);
const music = new Music({ musicOn: prefs.get('bgm', false), sfxOn: prefs.get('sfx', true) });

const claude = new ClaudeBuddy();
claude.root.position.set(-0.85, 0, -0.2);
scene.add(claude.root, claude.world);

// Claude 손: 님 손 쪽으로 옆으로 뻗고 엄지가 위 (🤜), 큐브 팔로 몸에 연결
const cpuHand = new Hand({ color: 0xe8825c, cuffRing: 0xf6a27c, thumbTop: true });
cpuHand.root.scale.setScalar(0.8);
scene.add(cpuHand.root);
claude.attachHand(cpuHand);
const cpuBase = { pos: new THREE.Vector3(), quat: thumbUpQuat(new THREE.Vector3(1, -0.1, 0.35)) };

// 님 손: 오른쪽 아래 객석에서 쑥 올라온 흰 장갑 (오른손)
const youHand = new Hand({ color: 0xfffaf2, cuff: 0x3ea8ff, sleeve: 3.4, mirror: true });
youHand.root.scale.setScalar(0.88);
scene.add(youHand.root);
const youBase = { pos: new THREE.Vector3(), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, -0.55, 0.28)) };

const zAxis = new THREE.Vector3(0, 0, 1);
const qTilt = new THREE.Quaternion();
/** 기본 자세에서 위로 들었다(lift) 손목을 까딱(tilt) */
function placeHand(hand, base, lift, tilt) {
  hand.root.position.copy(base.pos);
  hand.root.position.y += lift;
  hand.root.quaternion.copy(base.quat).premultiply(qTilt.setFromAxisAngle(zAxis, tilt));
}

function layout() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  const a = (camera.aspect = w / h);
  const portrait = a < 1;
  baseFov = portrait ? 50 : 42;
  // 두 손 + Claude가 가로로 다 들어오는 거리. 좁을수록 물러나되 높이 올라가서
  // 객석이 무대를 가리지 않게 내려다봄
  const tanH = Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) * a;
  const halfW = portrait ? 2.6 : 3.3;
  const dist = Math.max(9.4, halfW / tanH);
  const extra = dist - 9.4;
  const cx = portrait ? -0.05 : 0.35;
  camBase.set(cx + (portrait ? 0 : 0.05), 2.4 + extra * 0.72, dist);
  camTarget.set(cx, 0.95 - extra * 0.36, 0);
  scene.fog.near = dist + 9;
  scene.fog.far = dist + 26;
  // Claude는 왼쪽, 두 손은 오른쪽에서 맞붙음. 세로 화면은 좁으니 가운데로 모음
  const claudeX = portrait ? -0.55 : -0.85;
  claude.root.position.x = claudeX;
  stage.setShadow(claudeX, -0.05);
  cpuBase.pos.set(claudeX + (portrait ? 1.72 : 2.15), portrait ? 0.62 : 0.55, 1.0);
  youBase.pos.set(portrait ? 1.36 : 2.75, portrait ? 0.0 : 0.45, portrait ? 2.9 : 2.7);
  stage.setLayout(portrait, claudeX, camBase.x);
  stage.clearCrowd(youBase.pos.x + (portrait ? 0.4 : 0.5), portrait ? 1.0 : 1.3);
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
}
addEventListener('resize', layout);
layout();

// ---------- UI ----------
const $ = (s) => document.querySelector(s);
const bubble = $('#bubble');
const bubbleText = bubble.querySelector('span');
const callEl = $('#call');
const callMain = callEl.querySelector('b');
const callSub = callEl.querySelector('small');
const controls = $('#controls');
const buttons = [...controls.querySelectorAll('button')];
const scoreEls = { you: $('#s-you'), cpu: $('#s-cpu'), draw: $('#s-draw') };
const streakEl = $('#streak');
const historyEl = $('#history');

let bubbleTimer = 0;
function say(text, secs = 2.8) {
  bubbleText.textContent = text;
  bubble.classList.remove('show');
  void bubble.offsetWidth;
  bubble.classList.add('show');
  bubbleTimer = secs;
}

function showCall(text, cls = '', sub = '') {
  callEl.className = '';
  callMain.textContent = text;
  callSub.textContent = sub;
  void callEl.offsetWidth;
  callEl.className = `go ${cls}`;
}

function bumpScore(el, value) {
  el.textContent = value;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

const EMOJI = { rock: '✊', scissors: '✌️', paper: '🖐️' };
const NAME = { rock: '바위', scissors: '가위', paper: '보' };
const history = [];
function pushHistory(result, you, cpu) {
  history.push(result);
  const li = document.createElement('li');
  li.className = result;
  li.textContent = { win: '승', lose: '패', draw: '무' }[result];
  li.title = `님 ${NAME[you]} vs ${NAME[cpu]} Claude`;
  historyEl.append(li);
  while (historyEl.children.length > 8) historyEl.firstElementChild.remove();
}

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const LINES = {
  idle: [
    '한 판 하실래요? 🎶',
    '얼쑤~ 손 풀고 오세요!',
    '제 손이 근질근질해요 ✊',
    '쿵짝쿵짝~ 박자 타는 중',
    '님 다음에 뭐 낼지 궁금하당 👀',
    '가위? 바위? 보? 두근두근',
  ],
  win: ['아싸 가오리~! 😎', '이 몸이 이겼당 ✨', '얼씨구 좋다~ 🎺', '제가 좀 하죠? 후훗', '승리의 노래 한 곡~ 🎤'],
  lose: ['흑흑 내 손이 미끄러졌어요 😭', '한 판만 더!! 제발!', '님 혹시 고수…?', '으앙 분하다아~', '다음엔 안 봐줘요! 😤'],
  streak: ['님 뭐예요… 무서워요 😱', '연승 행진이다~ 🎉', '제 패턴 들켰나요?!'],
  draw: ['어머 우리 통했나봐 💕', '천생연분인가요~?', '띠용! 똑같네?', '마음이 통했다 짠!'],
  read: ['님 패턴 읽었다구요 🧐', '이번엔 이걸 낼 줄 알았지롱~', '다 보여요 다 보여 👀'],
};

// ---------- Claude의 두뇌 ----------
// 님의 직전 수 → 다음 수 전이를 세서, 가끔은 예측한 수를 이기는 걸 냄
const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
const COUNTER = { scissors: 'rock', paper: 'scissors', rock: 'paper' };
const MOVES = ['rock', 'paper', 'scissors'];
const transitions = {};
let lastYou = null;
let lastWasRead = false;

function claudeChooses() {
  lastWasRead = false;
  const row = lastYou && transitions[lastYou];
  if (row && Math.random() < 0.4) {
    const total = MOVES.reduce((s, m) => s + (row[m] || 0), 0);
    if (total >= 2) {
      const predicted = MOVES.reduce((a, b) => ((row[a] || 0) >= (row[b] || 0) ? a : b));
      lastWasRead = true;
      return COUNTER[predicted];
    }
  }
  return pick(MOVES);
}

function remember(move) {
  if (lastYou) {
    transitions[lastYou] ??= {};
    transitions[lastYou][move] = (transitions[lastYou][move] || 0) + 1;
  }
  lastYou = move;
}

// ---------- 게임 진행 (박자에 맞춤) ----------
const score = { you: 0, cpu: 0, draw: 0 };
let streak = 0;
let state = 'intro'; // intro | idle | countdown | result
let shaking = false;
let energy = 0.6;
let punch = 0;
let shake = 0;
let previewing = false;
const events = []; // {time, fn} — 오디오 시계 기준

function schedule(time, fn) {
  events.push({ time, fn });
  events.sort((a, b) => a.time - b.time);
}

function play(move) {
  if (state !== 'idle') return;
  state = 'countdown';
  previewing = false;
  controls.classList.add('locked');
  buttons.forEach((b) => b.classList.toggle('picked', b.dataset.move === move));

  const cpuMove = claudeChooses();
  const b = music.beatDur;
  const t0 = music.countdownStart();

  youHand.setPose('rock');
  cpuHand.setPose('rock');
  claude.setExpression('focus');
  stage.setMood('party');
  bubble.classList.remove('show');
  shaking = true;

  ['가위!', '바위!', '보!'].forEach((w, i) => {
    const t = t0 + i * b;
    if (i < 2) music.blip(t, i === 0 ? 1 : 1.26);
    else music.reveal(t);
    schedule(t, () => {
      showCall(w);
      claude.shout = 1;
      if (i === 2) reveal(move, cpuMove);
    });
  });
}

const tmpV = new THREE.Vector3();
function reveal(you, cpu) {
  shaking = false;
  state = 'result';
  youHand.setPose(you, true);
  cpuHand.setPose(cpu, true);
  stage.pows.pop(youHand.root.getWorldPosition(tmpV).add(new THREE.Vector3(0, 0.3, -0.4)), 2.2);
  stage.pows.pop(cpuHand.root.getWorldPosition(tmpV).add(new THREE.Vector3(0.25, 0.1, -0.35)), 1.7);
  if (!reduceMotion) {
    punch = 1;
    shake = 1;
  }
  remember(you);

  const result = you === cpu ? 'draw' : BEATS[you] === cpu ? 'win' : 'lose';
  const sub = `님 ${EMOJI[you]} vs ${EMOJI[cpu]} Claude`;
  const t = music.now + music.beatDur * 0.55;

  schedule(t, () => {
    pushHistory(result, you, cpu);
    if (result === 'win') {
      score.you++;
      streak = streak > 0 ? streak + 1 : 1;
      bumpScore(scoreEls.you, score.you);
      showCall(streak >= 3 ? `${streak}연승!!` : '이겼다!!', 'win', sub);
      claude.setExpression('sad');
      stage.setMood('win');
      stage.confetti.burst(youHand.root.getWorldPosition(tmpV).add(new THREE.Vector3(-0.3, 0.8, 0)), 200, 1);
      music.fanfare(music.now);
      say(streak >= 3 ? pick(LINES.streak) : pick(LINES.lose));
      energy = 1.4;
    } else if (result === 'lose') {
      score.cpu++;
      streak = streak < 0 ? streak - 1 : -1;
      bumpScore(scoreEls.cpu, score.cpu);
      showCall('졌다…', 'lose', sub);
      claude.setExpression('cool');
      stage.setMood('lose');
      stage.confetti.burst(new THREE.Vector3(claude.root.position.x, 1.6, 0), 90, 0.7);
      music.sad(music.now);
      say(lastWasRead && Math.random() < 0.6 ? pick(LINES.read) : pick(LINES.win));
      energy = 1.6;
    } else {
      score.draw++;
      streak = 0;
      bumpScore(scoreEls.draw, score.draw);
      showCall('비겼당~', 'draw', sub);
      claude.setExpression(Math.random() < 0.5 ? 'shock' : 'happy');
      stage.setMood('draw');
      const mid = cpuHand.root.getWorldPosition(tmpV).lerp(youHand.root.getWorldPosition(new THREE.Vector3()), 0.5);
      stage.floaters.emit('heart', mid.add(new THREE.Vector3(0, 0.6, 0)), 6, 1.6);
      music.boing(music.now);
      say(pick(LINES.draw));
      energy = 1.1;
    }
    streakEl.textContent = streak >= 2 ? `🔥 ${streak}연승 중!` : streak <= -2 ? `💧 ${-streak}연패…` : '';
  });

  schedule(t + music.beatDur * 1.2, () => {
    callEl.classList.add('fade');
    state = 'idle';
    controls.classList.remove('locked');
    buttons.forEach((b) => b.classList.remove('picked'));
  });

  schedule(t + music.beatDur * 8, () => {
    if (state === 'idle') {
      claude.setExpression('normal');
      stage.setMood('party');
      energy = 0.9;
    }
  });
}

buttons.forEach((btn) => {
  btn.addEventListener('click', () => play(btn.dataset.move));
  // pointerenter는 버튼 잠금이 풀릴 때도 발생해서 결과 손 모양을 덮어버림 → 실제 움직임에만 반응
  btn.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || state !== 'idle' || youHand.pose === btn.dataset.move) return;
    youHand.setPose(btn.dataset.move);
    previewing = true;
    music.hover();
  });
  btn.addEventListener('pointerleave', () => {
    if (state === 'idle' && previewing) youHand.setPose('rock');
    previewing = false;
  });
});

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const move = { 1: 'scissors', 2: 'rock', 3: 'paper' }[e.key];
  if (move) play(move);
  if ((e.key === 'Enter' || e.key === ' ') && state === 'intro') {
    e.preventDefault();
    begin();
  }
});

// ---------- 소리 스위치 ----------
function bindToggle(el, keyName, get, set) {
  const render = () => {
    const on = get();
    el.setAttribute('aria-pressed', String(on));
    el.querySelector('b').textContent = on ? 'ON' : 'OFF';
  };
  el.addEventListener('click', () => {
    set(!get());
    prefs.set(keyName, get());
    render();
  });
  render();
}
bindToggle(
  $('#bgm'),
  'bgm',
  () => music.musicOn,
  (on) => {
    if (on) music.start();
    music.setMusic(on);
  },
);
bindToggle(
  $('#sfx'),
  'sfx',
  () => music.sfxOn,
  (on) => music.setSfx(on),
);

function begin() {
  if (state !== 'intro') return;
  music.start();
  $('#start').classList.add('hide');
  state = 'idle';
  energy = 1;
  say('Claude예요~ 🎤\n가위바위보 한 판 콜?', 3.5);
}
$('#go').addEventListener('click', begin);

const pointer = new THREE.Vector2();
addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});

// ---------- 루프 ----------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
const headAnchor = new THREE.Vector3(-0.55, 1.35, 0);
const micHead = new THREE.Vector3();
let idleChat = 6;
let beat = 0;
let lastPhase = 0;

function toScreen(obj, offset) {
  tmp.copy(offset).applyMatrix4(obj.matrixWorld).project(camera);
  return [((tmp.x + 1) / 2) * innerWidth, ((1 - tmp.y) / 2) * innerHeight];
}

function onBeat(n) {
  beat = n;
  stage.onBeat(n);
  if (claude.expression === 'cool' && claude.sing > 0.5) {
    claude.mic.localToWorld(micHead.set(0, 0.5, 0));
    stage.floaters.emit('note', micHead, 1, 0.3);
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  const phase = music.beatPhase();

  // 오디오 시계로 예약된 이벤트 실행
  while (events.length && events[0].time <= music.now) events.shift().fn();

  // 박자에 맞춘 무대 연출 (음악이 꺼져 있어도 박자 시계는 돎)
  if (music.started) {
    while (music.beatQueue.length && music.beatQueue[0].time <= music.now) onBeat(music.beatQueue.shift().beat);
  } else if (phase < lastPhase) {
    onBeat(beat + 1);
  }
  lastPhase = phase;

  energy += ((state === 'intro' ? 0.7 : 1) - energy) * dt * 0.5;
  stage.update(dt, time, phase, beat, reduceMotion);

  // 손 흔들기: 박 사이에 올렸다가 정박에 쾅 (손목도 까딱)
  const up = Math.sin(phase * Math.PI);
  const lift = shaking ? up * 0.42 : up * 0.05;
  placeHand(cpuHand, cpuBase, lift, shaking ? up * 0.35 : Math.sin(time * 2.2) * 0.05);
  placeHand(youHand, youBase, lift, shaking ? up * 0.22 : Math.sin(time * 2.2 + 1) * 0.05);
  cpuHand.update(dt);
  youHand.update(dt);

  claude.look.lerp(state === 'countdown' ? tmp.set(0.8, -0.1, 0) : pointer, 0.1);
  claude.update(dt, time, phase, beat, energy);

  // 카메라: 살랑살랑 + 공개 순간 살짝 줌인/흔들
  punch = Math.max(0, punch - dt * 2.5);
  shake = Math.max(0, shake - dt * 4);
  const sway = reduceMotion ? 0 : 1;
  camera.position.set(
    camBase.x + (Math.sin(time * 0.4) * 0.3 + pointer.x * 0.25) * sway + (Math.random() - 0.5) * 0.08 * shake,
    camBase.y + (Math.sin(time * 0.6) * 0.1 + pointer.y * 0.12) * sway + (Math.random() - 0.5) * 0.08 * shake,
    camBase.z,
  );
  camera.lookAt(camTarget);
  camera.rotation.z += Math.sin(((beat + phase) * Math.PI) / 2) * 0.005 * energy * sway;
  const f = baseFov * (1 - 0.06 * Math.sin(Math.min(1, punch) * Math.PI));
  if (Math.abs(camera.fov - f) > 1e-3) {
    camera.fov = f;
    camera.updateProjectionMatrix();
  }

  // 말풍선은 Claude 머리 왼쪽 위 (가운데 큰 글씨·오른쪽 손들과 안 겹치게), 꼬리는 머리를 가리킴
  const [hx, hy] = toScreen(claude.root, headAnchor);
  const bw = bubble.offsetWidth;
  const bh = bubble.offsetHeight;
  const left = Math.max(12, Math.min(hx + 28 - bw, innerWidth - bw - 12));
  bubble.style.left = `${left}px`;
  bubble.style.top = `${Math.max(8, hy - bh - 14)}px`;
  bubble.style.setProperty('--tail', `${Math.max(14, Math.min(hx - left - 10, bw - 30))}px`);

  if (bubbleTimer > 0) {
    bubbleTimer -= dt;
    if (bubbleTimer <= 0) bubble.classList.remove('show');
  }
  if (state === 'idle') {
    idleChat -= dt;
    if (idleChat < 0) {
      say(pick(LINES.idle));
      idleChat = 9 + Math.random() * 6;
    }
  } else {
    idleChat = 7;
  }

  // 개발용: window.__rps.cam = { pos: [x,y,z], target: [x,y,z] } 로 카메라 고정
  const dbg = import.meta.env.DEV && window.__rps?.cam;
  if (dbg) {
    camera.position.fromArray(dbg.pos);
    camera.lookAt(...dbg.target);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

if (import.meta.env.DEV) window.__rps = { THREE, scene, camera, claude, cpuHand, youHand, stage, music };
