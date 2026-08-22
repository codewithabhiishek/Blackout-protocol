/* Procedural WebAudio sound engine — no assets, everything synthesized. */

class Sfx {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private ambNodes: AudioScheduledSourceNode[] = [];
  muted = false;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ac) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ac.destination);
      const len = Math.floor(this.ac.sampleRate * 1);
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ac.state === "suspended") void this.ac.resume();
    return this.ac;
  }

  unlock() {
    this.ensure();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  private tone(
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    delay = 0
  ) {
    const ac = this.ensure();
    if (!ac || !this.master || this.muted) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise(
    dur: number,
    vol: number,
    freq: number,
    q = 1,
    delay = 0,
    type: BiquadFilterType = "lowpass"
  ) {
    const ac = this.ensure();
    if (!ac || !this.master || !this.noiseBuf || this.muted) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.03);
  }

  shoot() {
    this.noise(0.13, 0.55, 1500, 0.7);
    this.noise(0.05, 0.28, 4200, 1, 0, "highpass");
    this.tone(150, 48, 0.12, "square", 0.32);
  }
  eshoot() {
    this.noise(0.09, 0.16, 1200, 0.8);
    this.tone(115, 44, 0.1, "square", 0.12);
  }
  hit() {
    this.tone(320, 190, 0.06, "square", 0.2);
  }
  kill() {
    this.tone(230, 38, 0.28, "sawtooth", 0.28);
    this.noise(0.22, 0.26, 900, 0.8);
  }
  hurt() {
    this.tone(105, 48, 0.22, "sine", 0.42);
    this.noise(0.15, 0.2, 500, 0.7);
  }
  reload() {
    this.noise(0.05, 0.24, 2500, 1, 0, "highpass");
    this.noise(0.05, 0.24, 2000, 1, 0.14, "highpass");
  }
  reloadDone() {
    this.noise(0.06, 0.3, 3000, 1, 0, "highpass");
    this.tone(680, 940, 0.07, "square", 0.12, 0.02);
  }
  empty() {
    this.tone(1200, 880, 0.05, "square", 0.14);
  }
  pickup() {
    this.tone(620, 930, 0.11, "sine", 0.24);
    this.tone(930, 1240, 0.1, "sine", 0.18, 0.07);
  }
  wave() {
    this.tone(68, 140, 0.55, "sawtooth", 0.26);
    this.tone(71, 143, 0.55, "sawtooth", 0.18);
    this.noise(0.45, 0.1, 380, 0.8);
  }
  step() {
    this.noise(0.045, 0.08, 680, 0.8);
  }
  shootSmg() {
    this.noise(0.065, 0.42, 1900, 0.7);
    this.noise(0.04, 0.2, 4800, 1, 0, "highpass");
    this.tone(220, 75, 0.07, "square", 0.2);
  }
  shootShotgun() {
    this.noise(0.32, 0.6, 620, 0.6);
    this.noise(0.09, 0.3, 2800, 1, 0, "highpass");
    this.tone(105, 26, 0.3, "square", 0.42);
  }
  swap() {
    this.noise(0.04, 0.22, 2600, 1, 0, "highpass");
    this.noise(0.04, 0.22, 2100, 1, 0.09, "highpass");
  }
  jump() {
    this.noise(0.12, 0.09, 900, 1);
    this.tone(170, 320, 0.13, "sine", 0.09);
  }
  land() {
    this.tone(95, 44, 0.14, "sine", 0.3);
    this.noise(0.1, 0.16, 420, 0.7);
  }
  melee() {
    this.noise(0.13, 0.3, 1900, 2.2, 0, "bandpass");
  }
  meleeHit() {
    this.tone(210, 58, 0.16, "square", 0.24);
    this.noise(0.12, 0.2, 700, 0.8);
  }
  headshot() {
    this.tone(1150, 1750, 0.09, "sine", 0.2);
    this.tone(580, 880, 0.07, "square", 0.08, 0.02);
  }
  ui() {
    this.tone(840, 620, 0.07, "square", 0.1);
  }
  over() {
    this.tone(300, 58, 1.1, "sawtooth", 0.3);
    this.tone(200, 40, 1.2, "square", 0.18, 0.12);
  }
  armorHit() {
    this.tone(1450, 680, 0.08, "sine", 0.22);
    this.noise(0.06, 0.25, 3200, 1.5, 0, "highpass");
  }
  armorBreak() {
    this.tone(480, 110, 0.25, "sawtooth", 0.35);
    this.noise(0.2, 0.4, 1800, 1.2, 0, "bandpass");
  }
  armorPickup() {
    this.tone(520, 880, 0.09, "sine", 0.2);
    this.tone(880, 1320, 0.12, "sine", 0.22, 0.05);
  }

  startAmbient() {
    const ac = this.ensure();
    if (!ac || !this.master || !this.noiseBuf) return;
    this.stopAmbient();
    const s = ac.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 150;
    const g = ac.createGain();
    g.gain.value = 0.045;
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start();
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = 44;
    const g2 = ac.createGain();
    g2.gain.value = 0.022;
    o.connect(g2);
    g2.connect(this.master);
    o.start();
    this.ambNodes = [s, o];
  }
  stopAmbient() {
    for (const n of this.ambNodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.ambNodes = [];
  }
}

export const sfx = new Sfx();
