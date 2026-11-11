// Tiny synthesized sound set. No audio files: an oscillator engine and a few blips.
// The context is only created after a user gesture, and every call is safe without one.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('mithila.muted') === '1'; } catch { /* private mode */ }
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const c = this.ctx = new AC();
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(c.destination);
      // engine: two detuned saws through a low-pass, the putter of a two-stroke
      this.engGain = c.createGain(); this.engGain.gain.value = 0;
      this.engFilter = c.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 300;
      this.osc1 = c.createOscillator(); this.osc1.type = 'sawtooth';
      this.osc2 = c.createOscillator(); this.osc2.type = 'square';
      this.osc1.connect(this.engFilter); this.osc2.connect(this.engFilter);
      this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
      this.osc1.start(); this.osc2.start();
    } catch { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('mithila.muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  engine(speed, active) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = 34 + speed * 1.5;
    this.osc1.frequency.setTargetAtTime(f, t, 0.08);
    this.osc2.frequency.setTargetAtTime(f * 0.502, t, 0.08);
    this.engFilter.frequency.setTargetAtTime(220 + speed * 14, t, 0.1);
    this.engGain.gain.setTargetAtTime(active ? 0.09 : 0, t, 0.15);
  }

  tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  chai() { this.tone(880, 0.12, 'triangle', 0.25); this.tone(1320, 0.18, 'triangle', 0.22, 0, 0.07); }
  hit() { this.tone(110, 0.3, 'sawtooth', 0.4, -70); this.tone(60, 0.35, 'square', 0.3, -30); }
  bump() { this.tone(90, 0.16, 'square', 0.3, -40); }
  moo() { this.tone(150, 0.6, 'sawtooth', 0.22, -45); }
  horn() { this.tone(392, 0.28, 'square', 0.16); this.tone(494, 0.28, 'square', 0.16); }
  truckHorn() { this.tone(196, 0.5, 'sawtooth', 0.14); this.tone(247, 0.5, 'sawtooth', 0.14); }
  region() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.2, 0, i * 0.11)); }
  win() { [523, 587, 659, 784, 880, 1047].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.24, 0, i * 0.14)); }
  over() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.24, 0, i * 0.16)); }
  boom() { this.tone(70, 0.5, 'sine', 0.25, -30); }
}
