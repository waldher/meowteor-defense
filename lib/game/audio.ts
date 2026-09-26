import { DEFAULT_ASSETS, type AssetManifest } from "./assets";
type Voice = "levelComplete" | "upgrade";
export class AudioFX {
  ctx: AudioContext | null = null;
  private audible = true;
  private manifest = DEFAULT_ASSETS;
  private buffers = new Map<Voice, AudioBuffer>();
  private raw = new Map<Voice, ArrayBuffer>();
  private voices = new Set<AudioScheduledSourceNode>();
  private disposed = false;
  private loading = new AbortController();
  get enabled() {
    return this.audible;
  }
  set enabled(value: boolean) {
    this.audible = value;
    if (!value) this.stop();
  }
  configure(manifest: AssetManifest) {
    this.manifest = manifest;
    for (const type of ["levelComplete", "upgrade"] as const) {
      void fetch(manifest.audio[type].url, { signal: this.loading.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then(async (bytes) => {
          if (this.disposed) return;
          this.raw.set(type, bytes);
          if (this.ctx) await this.decode(type, bytes);
        })
        .catch((e) => {
          if (!this.disposed)
            console.warn(`Using synthesized ${type} sound.`, e);
        });
    }
  }
  private async decode(type: Voice, bytes: ArrayBuffer) {
    try {
      const buffer = await this.ctx!.decodeAudioData(bytes.slice(0));
      if (!this.disposed) this.buffers.set(type, buffer);
    } catch {}
  }
  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        for (const [type, bytes] of this.raw) void this.decode(type, bytes);
      }
      if (this.ctx.state === "suspended")
        void this.ctx.resume().catch(() => {});
    } catch {}
  }
  private track(source: AudioScheduledSourceNode) {
    this.voices.add(source);
    source.onended = () => this.voices.delete(source);
  }
  stop() {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {}
    }
    this.voices.clear();
  }
  play(type: string) {
    if (!this.enabled || !this.ctx || this.disposed) return;
    if (type === "levelComplete" || type === "upgrade") {
      const buffer = this.buffers.get(type);
      if (buffer) {
        const source = this.ctx.createBufferSource(),
          gain = this.ctx.createGain();
        source.buffer = buffer;
        gain.gain.value = this.manifest.audio[type].volume;
        source.connect(gain);
        gain.connect(this.ctx.destination);
        this.track(source);
        source.start();
        return;
      }
      this.vocal(type);
      return;
    }
    if (!["swat", "impact", "purr", "break"].includes(type)) return;
    const c = this.ctx,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    o.type =
      type === "impact" ? "sawtooth" : type === "purr" ? "sine" : "triangle";
    const f =
      type === "swat"
        ? 500
        : type === "impact"
          ? 90
          : type === "purr"
            ? 150
            : 880;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(
      type === "break" ? 1400 : type === "purr" ? 600 : 40,
      t + 0.18,
    );
    g.gain.setValueAtTime(type === "swat" ? 0.025 : 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    this.track(o);
    o.start(t);
    o.stop(t + 0.26);
  }
  /** Built-in vocal fallback if an artist's audio file is missing or cannot decode. */
  private vocal(type: Voice) {
    const c = this.ctx!,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain(),
      filter = c.createBiquadFilter();
    const purring = type === "levelComplete";
    const duration = purring ? 1.8 : 0.7;
    o.type = purring ? "sawtooth" : "sawtooth";
    o.frequency.setValueAtTime(purring ? 75 : 370, t);
    if (!purring) {
      o.frequency.exponentialRampToValueAtTime(720, t + 0.17);
      o.frequency.exponentialRampToValueAtTime(210, t + duration);
    }
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(purring ? 420 : 1300, t);
    filter.Q.value = purring ? 1 : 3;
    o.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.06);
    g.gain.setValueAtTime(0.12, t + duration - 0.18);
    g.gain.linearRampToValueAtTime(0, t + duration);
    if (purring) {
      const lfo = c.createOscillator(),
        depth = c.createGain();
      lfo.frequency.value = 26;
      depth.gain.value = 0.075;
      lfo.connect(depth);
      depth.connect(g.gain);
      this.track(lfo);
      lfo.start(t);
      lfo.stop(t + duration);
    }
    this.track(o);
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  dispose() {
    this.disposed = true;
    this.loading.abort();
    this.stop();
    void this.ctx?.close();
  }
}
