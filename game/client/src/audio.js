// Fully procedural WebAudio SFX — no external assets.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._unlock = () => this._resume();
    window.addEventListener("click", this._unlock, { once: true });
    window.addEventListener("keydown", this._unlock, { once: true });
  }
  _resume() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }
  _env(dur, peak = 1, attack = 0.005) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }
  _noise(dur) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }
  // Position-aware volume for 3D-ish spatial fake
  _spatial(dist = 0) {
    const g = this.ctx.createGain();
    g.gain.value = Math.max(0.05, 1 - dist / 60);
    g.connect(this.master);
    return g;
  }

  shot(dist = 0, weapon = "pistol") {
    if (!this.ctx) return;
    const out = this._spatial(dist);
    // Body: filtered noise burst
    const noise = this._noise(0.18);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = weapon === "rifle" ? 2800 : 1600;
    bp.Q.value = 0.9;
    const env = this._env(weapon === "rifle" ? 0.12 : 0.16, 1.2);
    noise.connect(bp).connect(env).connect(out);
    noise.start(); noise.stop(this.ctx.currentTime + 0.2);
    // Punch: low sine sweep
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    const oenv = this._env(0.09, 0.9);
    osc.connect(oenv).connect(out);
    osc.start(); osc.stop(t + 0.12);
  }
  hit(dist = 0) {
    if (!this.ctx) return;
    const out = this._spatial(dist);
    const n = this._noise(0.05);
    const hp = this.ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200;
    const env = this._env(0.05, 0.7);
    n.connect(hp).connect(env).connect(out);
    n.start(); n.stop(this.ctx.currentTime + 0.06);
  }
  hitmarker() {
    if (!this.ctx) return;
    const out = this._spatial(0);
    const o = this.ctx.createOscillator(); o.type = "square"; o.frequency.value = 1400;
    const env = this._env(0.06, 0.4, 0.001);
    o.connect(env).connect(out); o.start(); o.stop(this.ctx.currentTime + 0.07);
  }
  reload() {
    if (!this.ctx) return;
    const out = this._spatial(0);
    for (let i = 0; i < 2; i++) {
      const n = this._noise(0.05);
      const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 800; bp.Q.value = 2;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      n.connect(bp).connect(g).connect(out); n.start(t); n.stop(t + 0.08);
    }
  }
  jump() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = "sine";
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.09);
    const env = this._env(0.09, 0.3);
    o.connect(env).connect(this.master); o.start(); o.stop(t + 0.11);
  }
  footstep() {
    if (!this.ctx) return;
    const n = this._noise(0.04);
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
    const env = this._env(0.05, 0.25);
    n.connect(lp).connect(env).connect(this.master);
    n.start(); n.stop(this.ctx.currentTime + 0.05);
  }
  death() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = "sawtooth";
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.7);
    const env = this._env(0.7, 0.5);
    o.connect(env).connect(this.master); o.start(); o.stop(t + 0.75);
  }
  explosion(dist = 0) {
    if (!this.ctx) return;
    const out = this._spatial(dist);
    const n = this._noise(0.6);
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    const env = this._env(0.6, 1.4);
    n.connect(lp).connect(env).connect(out); n.start(); n.stop(this.ctx.currentTime + 0.65);
    const o = this.ctx.createOscillator(); o.type = "sine";
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    const oenv = this._env(0.4, 1.0);
    o.connect(oenv).connect(out); o.start(); o.stop(t + 0.45);
  }
  pickup() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = "triangle";
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(600, t);
    o.frequency.linearRampToValueAtTime(1200, t + 0.12);
    const env = this._env(0.12, 0.4);
    o.connect(env).connect(this.master); o.start(); o.stop(t + 0.14);
  }
  streak(kills) {
    if (!this.ctx) return;
    const freqs = [523, 659, 784, 988];
    for (let i = 0; i < Math.min(kills, 4); i++) {
      const o = this.ctx.createOscillator(); o.type = "triangle";
      o.frequency.value = freqs[i] || 1000;
      const t = this.ctx.currentTime + i * 0.08;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.17);
    }
  }
}
