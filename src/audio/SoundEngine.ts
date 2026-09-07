import type { SpeciesId } from "../engine/types";
import type { Mood } from "../pets/mood";

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
    await this.emote(id, "neutral");
  }

  async emote(id: SpeciesId, mood: Mood) {
    const ctx = await this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    if (mood === "sad") this.hum(ctx, t);
    switch (id) {
      case "ghost":
        this.ghost(ctx, t, mood);
        break;
      case "bird":
        this.bird(ctx, t, mood);
        break;
      case "eagle":
        this.screech(ctx, t, mood);
        break;
      case "cat":
        this.meow(ctx, t, mood);
        break;
      case "dog":
        this.dog(ctx, t, mood);
        break;
      case "turtle":
        this.turtle(ctx, t, mood);
        break;
      case "elephant":
        this.trumpet(ctx, t, mood);
        break;
      case "rabbit":
        this.rabbit(ctx, t, mood);
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

  private hum(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(140, t + 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.58);
  }

  private ghost(ctx: AudioContext, t: number, mood: Mood = "neutral") {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const low = mood === "sad" || mood === "scared";
    osc.type = "sawtooth";
    osc2.type = "sine";
    osc.frequency.setValueAtTime(low ? 70 : mood === "happy" ? 110 : 92, t);
    osc.frequency.linearRampToValueAtTime(low ? 52 : 70, t + 0.55);
    osc2.frequency.setValueAtTime(low ? 140 : 184, t);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(mood === "scared" ? 720 : 420, t);
    filter.frequency.linearRampToValueAtTime(180, t + 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(mood === "scared" ? 0.38 : 0.28, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + (mood === "sad" ? 0.9 : 0.7));
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(g).connect(this.master!);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.92);
    osc2.stop(t + 0.92);
  }

  private bird(ctx: AudioContext, t: number, mood: Mood) {
    if (mood === "sad") {
      this.chirp(ctx, t, 1680, 0, 0.18);
      this.chirp(ctx, t, 1420, 0.22, 0.16);
    } else if (mood === "happy") {
      this.chirp(ctx, t, 2760, 0);
      this.chirp(ctx, t, 3100, 0.07);
      this.chirp(ctx, t, 2440, 0.14);
      this.chirp(ctx, t, 2900, 0.21);
    } else if (mood === "scared") {
      this.chirp(ctx, t, 3200, 0, 0.14);
    } else {
      this.chirp(ctx, t, 2760, 0);
      this.chirp(ctx, t, 2440, 0.12);
      this.chirp(ctx, t, 2900, 0.24);
    }
  }

  private dog(ctx: AudioContext, t: number, mood: Mood) {
    if (mood === "sad") {
      this.bark(ctx, t, 0, 140);
      this.bark(ctx, t, 0.28, 110);
    } else if (mood === "happy") {
      this.bark(ctx, t, 0);
      this.bark(ctx, t, 0.1);
      this.bark(ctx, t, 0.2);
    } else {
      this.bark(ctx, t, 0);
      this.bark(ctx, t, 0.16);
    }
  }

  private turtle(ctx: AudioContext, t: number, mood: Mood) {
    const n = mood === "happy" ? 3 : mood === "sad" ? 1 : 2;
    for (let i = 0; i < n; i++) this.wood(ctx, t, i * (mood === "sad" ? 0.28 : 0.12));
  }

  private rabbit(ctx: AudioContext, t: number, mood: Mood) {
    if (mood === "sad") this.squeak(ctx, t, 0, 980);
    else if (mood === "happy") {
      this.squeak(ctx, t, 0);
      this.squeak(ctx, t, 0.08);
      this.squeak(ctx, t, 0.16);
    } else {
      this.squeak(ctx, t, 0);
      this.squeak(ctx, t, 0.11);
    }
  }

  private chirp(ctx: AudioContext, t: number, freq: number, delay: number, dur = 0.09) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const start = t + delay;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, start + dur * 0.55);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.85, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.22, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private screech(ctx: AudioContext, t: number, mood: Mood = "neutral") {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    const startF = mood === "sad" ? 980 : mood === "happy" ? 1680 : 1480;
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(mood === "sad" ? 280 : 420, t + 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + (mood === "sad" ? 0.7 : 0.5));
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 4;
    osc.connect(filter).connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.72);
  }

  private meow(ctx: AudioContext, t: number, mood: Mood = "neutral") {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    const a = mood === "sad" ? 480 : mood === "happy" ? 920 : 820;
    osc.frequency.setValueAtTime(a, t);
    osc.frequency.exponentialRampToValueAtTime(mood === "sad" ? 220 : 380, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(mood === "happy" ? 640 : 560, t + 0.32);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + (mood === "sad" ? 0.55 : 0.38));
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.6);
    if (mood === "happy") this.meowShort(ctx, t + 0.22);
  }

  private meowShort(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.12);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  private bark(ctx: AudioContext, t: number, delay: number, freq = 220) {
    const start = t + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.4), start + 0.09);
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

  private trumpet(ctx: AudioContext, t: number, mood: Mood = "neutral") {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc2.type = "triangle";
    osc.frequency.setValueAtTime(mood === "sad" ? 240 : 360, t);
    osc.frequency.linearRampToValueAtTime(mood === "sad" ? 180 : 280, t + 0.55);
    osc2.frequency.setValueAtTime(mood === "sad" ? 480 : 720, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + (mood === "happy" ? 0.5 : 0.7));
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
    if (mood === "happy") this.trumpet(ctx, t + 0.28, "neutral");
  }

  private squeak(ctx: AudioContext, t: number, delay: number, freq = 1320) {
    const start = t + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.27, start + 0.05);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + 0.09);
  }
}
