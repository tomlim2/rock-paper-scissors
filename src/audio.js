// 뽕짝 비트 + 효과음. 전부 WebAudio로 합성합니다 (샘플 파일 없음).
// 배경음은 기본 꺼짐. 꺼져 있어도 박자 시계는 계속 돌아서 화면 연출은 박자를 탐.

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 8마디 루프: Am Am Dm E7 | Am Dm E7 Am
const CHORDS = [
  { bass: [45, 52], stab: [57, 60, 64] },
  { bass: [45, 52], stab: [57, 60, 64] },
  { bass: [38, 45], stab: [57, 62, 65] },
  { bass: [40, 47], stab: [56, 59, 62, 64] },
  { bass: [45, 52], stab: [57, 60, 64] },
  { bass: [38, 45], stab: [57, 62, 65] },
  { bass: [40, 47], stab: [56, 59, 62, 64] },
  { bass: [45, 52], stab: [57, 60, 64] },
];

// 트로트 느낌 요나누키 단조 멜로디. [midi | null, 8분음표 길이]
const MELODY_BARS = [
  [[76, 2], [76, 1], [77, 1], [76, 2], [72, 2]],
  [[71, 2], [72, 1], [71, 1], [69, 4]],
  [[69, 2], [72, 2], [77, 3], [76, 1]],
  [[76, 2], [71, 2], [68, 2], [71, 2]],
  [[81, 2], [77, 1], [76, 1], [72, 2], [76, 2]],
  [[77, 3], [76, 1], [72, 2], [69, 2]],
  [[71, 2], [72, 1], [71, 1], [68, 2], [71, 2]],
  [[69, 6], [null, 2]],
];

const STEPS_PER_BAR = 8; // 8분음표 단위
const LOOP_STEPS = STEPS_PER_BAR * CHORDS.length;
const MUSIC_VOL = 0.42;
const SFX_VOL = 0.8;

const MELODY = new Map();
{
  let step = 0;
  for (const bar of MELODY_BARS) {
    for (const [note, len] of bar) {
      if (note !== null) MELODY.set(step, [note, len]);
      step += len;
    }
  }
}

export class Music {
  constructor({ musicOn = false, sfxOn = true } = {}) {
    this.bpm = 132;
    this.beatDur = 60 / this.bpm;
    this.stepDur = this.beatDur / 2;
    this.ctx = null;
    this.started = false;
    this.musicOn = musicOn;
    this.sfxOn = sfxOn;
    this.beatQueue = []; // 화면 동기화용 {time, beat}
    this.beatCount = 0;
  }

  start() {
    if (this.started) return;
    this.started = true;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? MUSIC_VOL : 0;
    this.musicBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? SFX_VOL : 0;
    this.sfxBus.connect(this.master);

    // 노래방 에코 (살짝만)
    const delay = ctx.createDelay();
    delay.delayTime.value = this.beatDur * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.2;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0.22;
    this.echoSend.connect(delay).connect(tone).connect(fb).connect(delay);
    tone.connect(this.musicBus);

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.step = 0;
    this.startTime = ctx.currentTime + 0.1;
    this.nextStepTime = this.startTime;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  /** 0~1: 현재 박자 안에서의 위치 (0 = 정박) */
  beatPhase() {
    if (!this.ctx) return (performance.now() / 1000 / this.beatDur) % 1;
    const t = (this.ctx.currentTime - this.startTime) / this.beatDur;
    return ((t % 1) + 1) % 1;
  }

  nextBeatAfter(t) {
    const n = Math.ceil((t - this.startTime) / this.beatDur);
    return this.startTime + Math.max(0, n) * this.beatDur;
  }

  /**
   * 카운트다운 첫 박 시각. 음악이 나오면 다음 정박을 기다리고,
   * 꺼져 있으면 박자 격자를 지금으로 옮겨서 바로 시작 (기다림 없음).
   */
  countdownStart() {
    const soon = this.now + 0.1;
    if (!this.ctx || this.musicOn) return this.nextBeatAfter(this.now + 0.08);
    this.startTime = soon;
    this.nextStepTime = soon;
    this.step = 0;
    this.beatQueue.length = 0;
    return soon;
  }

  setMusic(on) {
    this.musicOn = on;
    if (!this.ctx) return;
    if (on) this.restart = true; // 다음 정박부터 곡 처음으로
    this.musicBus.gain.setTargetAtTime(on ? MUSIC_VOL : 0, this.ctx.currentTime, 0.08);
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? SFX_VOL : 0, this.ctx.currentTime, 0.03);
  }

  schedule() {
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      if (this.restart && this.step % 2 === 0) {
        this.step = 0;
        this.restart = false;
      }
      this.playStep(this.step, this.nextStepTime);
      this.step = (this.step + 1) % LOOP_STEPS;
      this.nextStepTime += this.stepDur;
    }
  }

  playStep(step, t) {
    const inBar = step % STEPS_PER_BAR;
    const chord = CHORDS[Math.floor(step / STEPS_PER_BAR)];
    const beatInBar = inBar / 2;

    if (inBar % 2 === 0) this.beatQueue.push({ time: t, beat: this.beatCount++ });
    if (!this.musicOn) return; // 꺼져 있으면 소리 노드를 만들지 않음

    if (inBar % 2 === 0) {
      if (beatInBar % 2 === 0) {
        // 쿵!
        this.kick(t, this.musicBus, 0.8);
        this.bass(midiToHz(chord.bass[0]), t);
      } else {
        // 짝!
        this.snare(t, this.musicBus, 0.32);
        this.bass(midiToHz(chord.bass[1]), t);
        this.stab(chord.stab, t);
      }
    } else {
      this.hat(t);
    }

    const mel = MELODY.get(step);
    if (mel) this.lead(midiToHz(mel[0]), t, mel[1] * this.stepDur * 0.92);
  }

  // ---------- 악기 ----------
  env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  osc(type, freq, t, dur, out) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(out);
    o.start(t);
    o.stop(t + dur);
    return o;
  }

  kick(t, out, vol = 1) {
    const g = this.ctx.createGain();
    this.env(g, t, vol, 0.003, 0.22);
    g.connect(out);
    const o = this.osc('sine', 140, t, 0.3, g);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
  }

  noiseHit(t, out, vol, type, freq, decay) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    this.env(g, t, vol, 0.002, decay);
    n.connect(f).connect(g).connect(out);
    n.start(t, Math.random() * 0.5);
    n.stop(t + decay + 0.05);
  }

  snare(t, out, vol = 0.4) {
    this.noiseHit(t, out, vol, 'highpass', 1600, 0.14);
    const g = this.ctx.createGain();
    this.env(g, t, vol * 0.5, 0.002, 0.07);
    g.connect(out);
    const o = this.osc('triangle', 230, t, 0.12, g);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.07);
  }

  hat(t) {
    this.noiseHit(t, this.musicBus, 0.07, 'highpass', 8000, 0.035);
  }

  bass(freq, t) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 480;
    const g = this.ctx.createGain();
    this.env(g, t, 0.26, 0.006, this.beatDur * 0.6);
    lp.connect(g).connect(this.musicBus);
    this.osc('square', freq, t, this.beatDur, lp);
  }

  stab(notes, t) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const g = this.ctx.createGain();
    this.env(g, t, 0.055, 0.004, 0.12);
    lp.connect(g).connect(this.musicBus);
    for (const m of notes) this.osc('square', midiToHz(m), t, 0.18, lp);
  }

  // 전자 올겐 리드: 살짝 아래서 올라오는 꺾기 + 뒤늦게 들어오는 바이브레이션
  lead(freq, t, dur) {
    const { ctx } = this;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.setValueAtTime(0.09, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1900;
    lp.Q.value = 1.2;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.6;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(0, t + Math.min(0.14, dur * 0.4));
    depth.gain.linearRampToValueAtTime(dur > 0.3 ? 26 : 8, t + dur);
    lfo.connect(depth);

    for (const [type, det, vol] of [
      ['sawtooth', 0, 0.7],
      ['square', -8, 0.35],
    ]) {
      const v = ctx.createGain();
      v.gain.value = vol;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.setValueAtTime(det - 50, t);
      o.detune.linearRampToValueAtTime(det, t + 0.05);
      depth.connect(o.detune);
      o.connect(v).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    lp.connect(g);
    g.connect(this.musicBus);
    g.connect(this.echoSend);
  }

  // ---------- 효과음 (동글동글하게) ----------
  /** 가위! 바위! 할 때 뿅 */
  blip(t, pitch = 1) {
    if (!this.ctx) return;
    const g = this.ctx.createGain();
    this.env(g, t, 0.22, 0.004, 0.12);
    g.connect(this.sfxBus);
    const o = this.osc('sine', 480 * pitch, t, 0.16, g);
    o.frequency.exponentialRampToValueAtTime(980 * pitch, t + 0.07);
    const g2 = this.ctx.createGain();
    this.env(g2, t, 0.05, 0.004, 0.08);
    g2.connect(this.sfxBus);
    const o2 = this.osc('triangle', 960 * pitch, t, 0.12, g2);
    o2.frequency.exponentialRampToValueAtTime(1960 * pitch, t + 0.07);
  }

  /** 보! 에서 짠! */
  reveal(t) {
    if (!this.ctx) return;
    this.kick(t, this.sfxBus, 0.5);
    this.noiseHit(t, this.sfxBus, 0.12, 'highpass', 5000, 0.25);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const g = this.ctx.createGain();
    this.env(g, t, 0.1, 0.004, 0.3);
    lp.connect(g).connect(this.sfxBus);
    for (const m of [72, 76, 79]) {
      this.osc('triangle', midiToHz(m), t, 0.4, lp);
      this.osc('square', midiToHz(m + 12), t, 0.4, lp).detune.value = 6;
    }
  }

  hover() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    this.env(g, t, 0.035, 0.002, 0.04);
    g.connect(this.sfxBus);
    this.osc('triangle', 1400, t, 0.06, g);
  }

  /** 님이 이겼을 때: 빰빠밤~ 빰! */
  fanfare(t) {
    if (!this.ctx) return;
    const notes = [
      [72, 0, 0.1],
      [76, 0.1, 0.1],
      [79, 0.2, 0.1],
      [84, 0.32, 0.55],
    ];
    for (const [m, at, dur] of notes) {
      const st = t + at;
      const g = this.ctx.createGain();
      this.env(g, st, 0.09, 0.008, dur);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2800;
      lp.connect(g).connect(this.sfxBus);
      this.osc('triangle', midiToHz(m), st, dur + 0.1, lp);
      const sq = this.osc('square', midiToHz(m), st, dur + 0.1, lp);
      if (dur > 0.3) {
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 6;
        const d = this.ctx.createGain();
        d.gain.value = 18;
        lfo.connect(d).connect(sq.detune);
        lfo.start(st);
        lfo.stop(st + dur + 0.1);
      }
    }
  }

  /** 님이 졌을 때: 뿌-뿌-뿌-뿌와~앙 (트롬본) */
  sad(t) {
    if (!this.ctx) return;
    const notes = [
      [55, 0, 0.26],
      [54, 0.3, 0.26],
      [53, 0.6, 0.26],
      [52, 0.9, 0.85],
    ];
    for (const [m, at, dur] of notes) {
      const st = t + at;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.13, st + 0.04);
      g.gain.setValueAtTime(0.13, st + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(500, st);
      lp.frequency.linearRampToValueAtTime(1100, st + 0.08);
      lp.Q.value = 2;
      lp.connect(g).connect(this.sfxBus);
      const o = this.osc('sawtooth', midiToHz(m), st, dur + 0.05, lp);
      if (dur > 0.5) {
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 7;
        const d = this.ctx.createGain();
        d.gain.setValueAtTime(0, st);
        d.gain.linearRampToValueAtTime(45, st + 0.4);
        lfo.connect(d).connect(o.detune);
        lfo.start(st);
        lfo.stop(st + dur);
      }
    }
  }

  /** 비겼을 때: 띠용~ */
  boing(t) {
    if (!this.ctx) return;
    const g = this.ctx.createGain();
    this.env(g, t, 0.2, 0.01, 0.5);
    g.connect(this.sfxBus);
    const o = this.osc('sine', 200, t, 0.6, g);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.1);
    o.frequency.exponentialRampToValueAtTime(280, t + 0.5);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 13;
    const lg = this.ctx.createGain();
    lg.gain.value = 30;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + 0.6);
  }
}
