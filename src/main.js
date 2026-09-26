import * as THREE from 'three';
import './style.css';
import { Music } from './audio.js';
import { Hand } from './hand.js';
import { ClaudeBuddy } from './claude.js';
import { Stage } from './stage.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------- 기본 세팅 ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x2a1233, 16, 30);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const camTarget = new THREE.Vector3(0, 1.2, 0);

scene.add(new THREE.HemisphereLight(0xfff0f5, 0x442255, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 6, 8);
scene.add(sun);

const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const stage = new Stage(scene);
stage.disco.material.envMap = envMap;
const music = new Music();

const claude = new ClaudeBuddy();
claude.root.position.set(0.9, 0, 0);
scene.add(claude.root);

const cpuHand = new Hand({ color: 0xffb38a, cuff: 0xd97757 });
cpuHand.root.position.set(-0.75, 0.85, 1.1);
cpuHand.root.rotation.set(0.15, 0.35, 0.35);
cpuHand.root.scale.setScalar(0.85);
scene.add(cpuHand.root);

const youHand = new Hand({ color: 0xffe0c2, cuff: 0x3ea8ff, mirror: true });
youHand.root.position.set(-2.7, 0.55, 2.6);
youHand.root.rotation.set(-0.1, 0.5, -0.3);
youHand.root.scale.setScalar(0.9);
scene.add(youHand.root);

addEventListener('resize', resize);
resize();

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 세로 화면이면 뒤로 물러나서 다 보이게
  const dist = camera.aspect < 1 ? 9 + (1 / camera.aspect - 1) * 7 : 9;
  camera.userData.base = new THREE.Vector3(-0.4, 2.3, dist);
  youHand.root.position.x = camera.aspect < 1 ? -1.9 : -2.7;
  camera.updateProjectionMatrix();
}

// ---------- UI ----------
const $ = (s) => document.querySelector(s);
const bubble = $('#bubble');
const bubbleText = bubble.querySelector('span');
const tagYou = $('#tag-you');
const callEl = $('#call');
const controls = $('#controls');
const buttons = [...controls.querySelectorAll('button')];
const scoreEls = { you: $('#s-you'), cpu: $('#s-cpu'), draw: $('#s-draw') };
const streakEl = $('#streak');

let bubbleTimer = 0;
function say(text, secs = 2.8) {
  bubbleText.textContent = text;
  bubble.classList.remove('show');
  void bubble.offsetWidth;
  bubble.classList.add('show');
  bubbleTimer = secs;
}

function showCall(text, cls = '') {
  callEl.className = '';
  callEl.textContent = text;
  void callEl.offsetWidth;
  callEl.className = `go ${cls}`;
}

function bumpScore(el, value) {
  el.textContent = value;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const LINES = {
  idle: [
    '한 판 하실래요? 🎶',
    '얼쑤~ 손 풀고 오세요!',
    '제 손이 근질근질해요 ✊',
    '쿵짝쿵짝~ 박자 타는 중',
    '님 다음에 뭐 낼지 궁금하당 👀',
  ],
  win: ['아싸 가오리~! 😎', '이 몸이 이겼당 ✨', '얼씨구 좋다~ 🎺', '제가 좀 하죠? 후훗', '노래 한 곡 뽑겠습니다~ 🎤'],
  lose: ['흑흑 내 손이 미끄러졌어요 😭', '한 판만 더!! 제발!', '님 혹시 고수…?', '으앙 분하다아~', '다음엔 안 봐줘요! 😤'],
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
  const t0 = music.nextBeatAfter(music.now + 0.08);

  youHand.setPose('rock');
  cpuHand.setPose('rock');
  claude.setExpression('normal');
  stage.setMood(0xff3e7f);
  bubble.classList.remove('show');

  const words = ['가위!', '바위!', '보!'];
  words.forEach((w, i) => {
    const t = t0 + i * b;
    music.blip(t, 1 + i * 0.25);
    if (i === 2) music.reveal(t);
    schedule(t, () => {
      showCall(w);
      claude.shout = 1;
      if (i === 0) shaking = true;
      if (i === 2) reveal(move, cpuMove);
    });
  });
}

function reveal(you, cpu) {
  shaking = false;
  youHand.setPose(you, true);
  cpuHand.setPose(cpu, true);
  remember(you);

  const result = you === cpu ? 'draw' : BEATS[you] === cpu ? 'win' : 'lose';
  const t = music.now + music.beatDur;

  schedule(t, () => {
    if (result === 'win') {
      score.you++;
      streak = streak > 0 ? streak + 1 : 1;
      bumpScore(scoreEls.you, score.you);
      showCall(streak >= 3 ? `${streak}연승!!` : '이겼다!!', 'win');
      claude.setExpression('sad');
      stage.setMood(0x3ea8ff);
      stage.confetti.burst(new THREE.Vector3(-2.2, 1.5, 2.2), 220, 1.1);
      music.fanfare(music.now);
      say(pick(LINES.lose));
      energy = 1.4;
    } else if (result === 'lose') {
      score.cpu++;
      streak = streak < 0 ? streak - 1 : -1;
      bumpScore(scoreEls.cpu, score.cpu);
      showCall('졌다…', 'lose');
      claude.setExpression('cool');
      stage.setMood(0xff7a2e);
      stage.confetti.burst(new THREE.Vector3(0.9, 1.5, 0.5), 120, 0.8);
      music.sad(music.now);
      say(lastWasRead && Math.random() < 0.6 ? pick(LINES.read) : pick(LINES.win));
      energy = 1.6;
    } else {
      score.draw++;
      streak = 0;
      bumpScore(scoreEls.draw, score.draw);
      showCall('비겼당~', 'draw');
      claude.setExpression(Math.random() < 0.5 ? 'shock' : 'happy');
      stage.setMood(0xb45cff);
      music.boing(music.now);
      say(pick(LINES.draw));
      energy = 1;
    }
    streakEl.textContent = streak >= 2 ? `🔥 ${streak}연승 중!` : streak <= -2 ? `💧 ${-streak}연패…` : '';
  });

  schedule(t + music.beatDur * 1.5, () => {
    callEl.classList.add('fade');
    state = 'idle';
    controls.classList.remove('locked');
    buttons.forEach((b) => b.classList.remove('picked'));
  });

  schedule(t + music.beatDur * 8, () => {
    if (state === 'idle') {
      claude.setExpression('normal');
      stage.setMood(0xff3e7f);
      energy = 0.8;
    }
  });
}

let previewing = false;
buttons.forEach((btn) => {
  btn.addEventListener('click', () => play(btn.dataset.move));
  // pointerenter는 버튼 잠금이 풀릴 때도 발생해서 결과 손 모양을 덮어버림 → 실제 움직임에만 반응
  btn.addEventListener('pointermove', () => {
    if (state !== 'idle' || youHand.pose === btn.dataset.move) return;
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
  const move = { 1: 'scissors', 2: 'rock', 3: 'paper' }[e.key];
  if (move) play(move);
  if (e.key === 'Enter' && state === 'intro') begin();
});

const musicBtn = $('#music');
musicBtn.addEventListener('click', () => {
  musicBtn.classList.toggle('off', !music.toggleMusic());
});

function begin() {
  if (state !== 'intro') return;
  music.start();
  $('#start').classList.add('hide');
  state = 'idle';
  energy = 1;
  say('안녕하세요~ Claude예요! 🎤\n가위바위보 한 판 콜?', 3.5);
}
$('#go').addEventListener('click', begin);

const pointer = new THREE.Vector2();
addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});

// ---------- 루프 ----------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
let idleChat = 6;
let lastPhase = 0;

function toScreen(obj, offset) {
  tmp.copy(offset).applyMatrix4(obj.matrixWorld).project(camera);
  return [((tmp.x + 1) / 2) * innerWidth, ((1 - tmp.y) / 2) * innerHeight];
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  const phase = music.beatPhase();

  // 오디오 시계로 예약된 이벤트 실행
  while (events.length && events[0].time <= music.now) events.shift().fn();

  // 음악 비트에 맞춘 무대 연출
  if (music.started) {
    while (music.beatQueue.length && music.beatQueue[0].time <= music.now) {
      const { beat, bar } = music.beatQueue.shift();
      stage.onBeat(bar * 4 + beat);
    }
  } else if (phase < lastPhase) {
    stage.onBeat((time * 2) | 0);
  }
  lastPhase = phase;

  energy += ((state === 'intro' ? 0.6 : 1) - energy) * dt * 0.5;
  stage.update(dt, time);
  claude.look.lerp(pointer, 0.1);
  claude.update(dt, time, phase, energy);

  // 손 흔들기: 박자마다 위로 올렸다가 정박에 쾅
  const lift = shaking ? Math.sin(phase * Math.PI) * 0.45 : Math.sin(phase * Math.PI) * 0.06;
  cpuHand.body.position.y = lift;
  youHand.body.position.y = lift;
  cpuHand.root.rotation.z = 0.35 + (shaking ? Math.sin(phase * Math.PI) * 0.2 : Math.sin(time * 2.2) * 0.05);
  youHand.root.rotation.z = -0.3 - (shaking ? Math.sin(phase * Math.PI) * 0.2 : Math.sin(time * 2.2 + 1) * 0.05);
  cpuHand.update(dt);
  youHand.update(dt);

  // 카메라 살랑살랑
  const base = camera.userData.base;
  camera.position.set(
    base.x + Math.sin(time * 0.4) * 0.35 + pointer.x * 0.3,
    base.y + Math.sin(time * 0.6) * 0.12 + pointer.y * 0.15,
    base.z,
  );
  camera.lookAt(camTarget);
  camera.rotation.z += Math.sin(time * Math.PI * (132 / 60) * 0.5) * 0.006 * energy;

  // HUD를 3D 위치에 붙이기
  claude.root.updateMatrixWorld();
  const [bx, by] = toScreen(claude.root, new THREE.Vector3(0.6, 1.9, 0));
  bubble.style.left = `${Math.max(16, Math.min(bx - 30, innerWidth - bubble.offsetWidth - 16))}px`;
  bubble.style.top = `${by}px`;
  const [yx, yy] = toScreen(youHand.root, new THREE.Vector3(0, 1.3, 0));
  tagYou.style.left = `${yx}px`;
  tagYou.style.top = `${yy}px`;
  tagYou.style.opacity = state === 'idle' ? 1 : 0;

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

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
