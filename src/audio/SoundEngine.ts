import type { SpeciesId } from "../engine/types";

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  volume = 0.55;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.suspend();
  }

  async unlock() {
    await this.ensure();
  }

  private async ensure(): Promise<AudioContext | null> {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private async suspend() {
    if (this.ctx && this.ctx.state === "running") await this.ctx.suspend();
  }

  async play(id: SpeciesId) {
    const ctx = await this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    switch (id) {
      case "ghost":
        this.ghost(ctx, t);
        break;
      case "bird":
        this.chirp(ctx, t, 2760, 0);
        this.chirp(ctx, t, 2440, 0.12);
        this.chirp(ctx, t, 2900, 0.24);
        break;
      case "eagle":
        this.screech(ctx, t);
        break;
      case "cat":
        this.meow(ctx, t);
        break;
      case "dog":
        this.bark(ctx, t, 0);
        this.bark(ctx, t, 0.16);
        break;
      case "turtle":
        this.wood(ctx, t, 0);
        this.wood(ctx, t, 0.14);
        break;
      case "elephant":
        this.trumpet(ctx, t);
        break;
      case "rabbit":
        this.squeak(ctx, t, 0);
        this.squeak(ctx, t, 0.11);
        break;
    }
  }

  async land(heavy: boolean) {
    const ctx = await this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(heavy ? 90 : 160, t);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 40 : 80, t + 0.18);
    g.gain.setValueAtTime(heavy ? 0.45 : 0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  async flap() {
    const ctx = await this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  private ghost(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sawtooth";
    osc2.type = "sine";
    osc.frequency.setValueAtTime(92, t);
    osc.frequency.linearRampToValueAtTime(70, t + 0.55);
    osc2.frequency.setValueAtTime(184, t);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, t);
    filter.frequency.linearRampToValueAtTime(180, t + 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(g).connect(this.master!);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.72);
    osc2.stop(t + 0.72);
  }

  private chirp(ctx: AudioContext, t: number, freq: number, delay: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const start = t + delay;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, start + 0.05);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.85, start + 0.08);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.22, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + 0.1);
  }

  private screech(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1480, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 4;
    osc.connect(filter).connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.52);
  }

  private meow(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(820, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(560, t + 0.32);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private bark(ctx: AudioContext, t: number, delay: number) {
    const start = t + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, start);
    osc.frequency.exponentialRampToValueAtTime(90, start + 0.09);
    g.gain.setValueAtTime(0.2, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + 0.11);
  }

  private wood(ctx: AudioContext, t: number, delay: number) {
    const start = t + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(240, start);
    osc.frequency.exponentialRampToValueAtTime(90, start + 0.08);
    g.gain.setValueAtTime(0.22, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + 0.1);
  }

  private trumpet(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc2.type = "triangle";
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.linearRampToValueAtTime(280, t + 0.55);
    osc2.frequency.setValueAtTime(720, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(g).connect(this.master!);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.72);
    osc2.stop(t + 0.72);
  }

  private squeak(ctx: AudioContext, t: number, delay: number) {
    const start = t + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1320, start);
    osc.frequency.exponentialRampToValueAtTime(1680, start + 0.05);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + 0.09);
  }
}
