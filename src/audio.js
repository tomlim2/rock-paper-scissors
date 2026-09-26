// 뽕짝 비트 + 효과음. 전부 WebAudio로 합성합니다 (샘플 파일 없음).

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
  constructor() {
    this.bpm = 132;
    this.beatDur = 60 / this.bpm;
    this.stepDur = this.beatDur / 2;
    this.ctx = null;
    this.started = false;
    this.musicOn = true;
    this.beatQueue = []; // 화면 동기화용 {time, beat}
  }

  start() {
    if (this.started) return;
    this.started = true;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());

    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.musicBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    // 싸구려 노래방 에코
    const delay = ctx.createDelay();
    delay.delayTime.value = this.beatDur * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0.35;
    this.echoSend.connect(delay).connect(fb).connect(delay);
    delay.connect(this.musicBus);

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

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.ctx) {
      this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.55 : 0, this.ctx.currentTime, 0.05);
    }
    return this.musicOn;
  }

  schedule() {
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextStepTime);
      this.step = (this.step + 1) % LOOP_STEPS;
      this.nextStepTime += this.stepDur;
    }
  }

  playStep(step, t) {
    const inBar = step % STEPS_PER_BAR;
    const chord = CHORDS[Math.floor(step / STEPS_PER_BAR)];
    const beatInBar = inBar / 2;

    if (inBar % 2 === 0) {
      this.beatQueue.push({ time: t, beat: beatInBar, bar: Math.floor(step / STEPS_PER_BAR) });
      if (beatInBar % 2 === 0) {
        // 뽕!
        this.kick(t, this.musicBus);
        this.bass(midiToHz(chord.bass[0]), t);
      } else {
        // 짝!
        this.snare(t, this.musicBus, 0.5);
        this.bass(midiToHz(chord.bass[1]), t);
        this.stab(chord.stab, t);
      }
    } else {
      this.hat(t);
    }

    const mel = MELODY.get(step);
    if (mel) this.lead(midiToHz(mel[0]), t, mel[1] * this.stepDur * 0.95);
  }

  // ---------- 악기 ----------
  env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  kick(t, out, vol = 1) {
    const { ctx } = this;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    this.env(g, t, vol, 0.003, 0.3);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.4);
  }

  snare(t, out, vol = 0.5) {
    const { ctx } = this;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const g = ctx.createGain();
    this.env(g, t, vol, 0.002, 0.16);
    n.connect(hp).connect(g).connect(out);
    n.start(t);
    n.stop(t + 0.25);

    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const g2 = ctx.createGain();
    this.env(g2, t, vol * 0.6, 0.002, 0.08);
    o.connect(g2).connect(out);
    o.start(t);
    o.stop(t + 0.15);
  }

  hat(t) {
    const { ctx } = this;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    this.env(g, t, 0.14, 0.001, 0.04);
    n.connect(hp).connect(g).connect(this.musicBus);
    n.start(t);
    n.stop(t + 0.08);
  }

  bass(freq, t) {
    const { ctx } = this;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const g = ctx.createGain();
    this.env(g, t, 0.32, 0.005, this.beatDur * 0.7);
    o.connect(lp).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + this.beatDur);
  }

  stab(notes, t) {
    const { ctx } = this;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    const g = ctx.createGain();
    this.env(g, t, 0.09, 0.004, 0.14);
    lp.connect(g).connect(this.musicBus);
    for (const m of notes) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = midiToHz(m);
      o.connect(lp);
      o.start(t);
      o.stop(t + 0.2);
    }
  }

  // 꺾기 + 바이브레이션 들어간 전자 올갠 리드
  lead(freq, t, dur) {
    const { ctx } = this;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.02);
    g.gain.setValueAtTime(0.11, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.Q.value = 3;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(0, t + Math.min(0.12, dur * 0.4));
    depth.gain.linearRampToValueAtTime(dur > 0.3 ? 45 : 15, t + dur);
    lfo.connect(depth);

    for (const det of [-9, 9]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      // 살짝 아래에서 올라오는 꺾기
      o.detune.setValueAtTime(det - 70, t);
      o.detune.linearRampToValueAtTime(det, t + 0.06);
      depth.connect(o.detune);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    lp.connect(g);
    g.connect(this.musicBus);
    g.connect(this.echoSend);
  }

  // ---------- 효과음 ----------
  blip(t, pitch = 1) {
    if (!this.ctx) return;
    const { ctx } = this;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(600 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(1300 * pitch, t + 0.08);
    const g = ctx.createGain();
    this.env(g, t, 0.18, 0.003, 0.14);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.2);
  }

  reveal(t) {
    if (!this.ctx) return;
    this.kick(t, this.sfxBus, 1);
    this.snare(t, this.sfxBus, 0.8);
  }

  hover() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.05);
    const g = this.ctx.createGain();
    this.env(g, t, 0.06, 0.002, 0.06);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.1);
  }

  fanfare(t) {
    if (!this.ctx) return;
    [72, 76, 79, 84, 88].forEach((m, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = midiToHz(m);
      const g = this.ctx.createGain();
      const st = t + i * 0.07;
      this.env(g, st, 0.1, 0.005, i === 4 ? 0.6 : 0.12);
      o.connect(g).connect(this.sfxBus);
      o.start(st);
      o.stop(st + 0.8);
    });
  }

  sad(t) {
    if (!this.ctx) return;
    // 뿌잉~ 하고 떨어지는 소리
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.8);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 9;
    const lg = this.ctx.createGain();
    lg.gain.value = 30;
    lfo.connect(lg).connect(o.frequency);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    const g = this.ctx.createGain();
    this.env(g, t, 0.14, 0.01, 0.85);
    o.connect(lp).connect(g).connect(this.sfxBus);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.9);
    lfo.stop(t + 0.9);
  }

  boing(t) {
    if (!this.ctx) return;
    // 띠용~
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.5);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 14;
    const lg = this.ctx.createGain();
    lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    const g = this.ctx.createGain();
    this.env(g, t, 0.25, 0.01, 0.55);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.6);
    lfo.stop(t + 0.6);
  }
}
