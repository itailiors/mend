/**
 * MEND audio engine — client-side Tone.js, using Reharm's default sounds:
 *  - Rhodes keys (recorded FluidR3 samples once decoded, Reharm's FM Rhodes until then or if they fail),
 *    Reharm's FM "Bell" lead, soft triangle bass, lo-fi kick / rim / hat, same lo-fi filter + reverb + tremolo.
 *  - Every node is allocated once in init(); live edits only swap plain step arrays, so nudging never
 *    allocates mid-loop (the Rhodes sampler is built once, in the background, when its samples decode).
 *  - One '16n' transport callback reads the current step arrays: edits land on the next 16th,
 *    Before/After A/B swaps latch on the next beat.
 *  - Visual hooks: onBeat/onBarStart via Tone.Draw, playhead via one requestAnimationFrame loop.
 *  - Visual-only mode runs the same hooks from a performance.now() clock without an AudioContext.
 */
import {
  FMSynth, Filter, MembraneSynth, NoiseSynth, PolySynth, Reverb, Sampler, Synth, ToneAudioBuffer, Tremolo, Volume,
  getContext, getDraw, getTransport, immediate, start as toneStart,
} from 'tone';
import type { Groove, LayerId, TrackValues } from '../types';
import { LOOP_BEATS, LOOP_STEPS, type StepEvent, buildSteps, makeSilentWavDataUri } from './arrangement';
import { rhodesSampleUrls } from './samples';

/** Reharm's "Rhodes" keys preset (FM fallback + sampler levels). */
const RHODES = {
  volume: -7,
  sampled: { volume: 7, release: 0.8 },
  synth: {
    harmonicity: 3, modulationIndex: 2.2,
    oscillator: { type: 'sine' as const }, modulation: { type: 'sine' as const },
    envelope: { attack: 0.004, decay: 1.6, sustain: 0.32, release: 0.9 },
    modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.08, release: 0.5 },
  },
};

/** Reharm's "Bell" melody preset. */
const BELL = {
  volume: -9,
  synth: {
    harmonicity: 4, modulationIndex: 1.3,
    oscillator: { type: 'sine' as const }, modulation: { type: 'triangle' as const },
    envelope: { attack: 0.012, decay: 0.25, sustain: 0.62, release: 0.35 },
    modulationEnvelope: { attack: 0.004, decay: 0.18, sustain: 0.05, release: 0.25 },
  },
};

export interface EngineHooks {
  onBeat(beatIdx: number): void;
  onBarStart(barIdx: number): void;
  /** Loop progress 0..1 every animation frame while playing. */
  onFrame(progress: number): void;
  /** The AudioContext was suspended/interrupted and needs a tap to resume (true) or is fine again (false). */
  onNeedsResume(needs: boolean): void;
}

export type MixMode = 'mix' | 'solo';
type Channel = 'melody' | 'chords' | 'bass' | 'drums';

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Channel trims in dB for each focus mode (solo keeps a quiet reference layer so clashes stay audible). */
const FOCUS: Record<LayerId | 'mix', Record<Channel, number>> = {
  mix: { melody: 0, chords: 0, bass: 0, drums: 0 },
  melody: { melody: 2, chords: -13, bass: -60, drums: -60 },
  chords: { melody: -9, chords: 2, bass: -60, drums: -60 },
  bass: { melody: -60, chords: -11, bass: 4, drums: -60 },
  cadence: { melody: -10, chords: 2, bass: 1, drums: -60 },
};

/** Channel levels before focus trims: 0 dB so each voice sits at Reharm's own level. */
const BASE: Record<Channel, number> = { melody: 0, chords: 0, bass: 0, drums: 0 };

interface Voices {
  master: Volume;
  channels: Record<Channel, Volume>;
  /** Reharm sends the rim through the reverb; this wet drum send follows the drums channel's focus. */
  drumsWet: Volume;
  keys: PolySynth<FMSynth>;
  lead: PolySynth<FMSynth>;
  bass: Synth;
  kick: MembraneSynth;
  snare: NoiseSynth;
  hat: NoiseSynth;
}

/** The calls the scheduler makes on the keys voice, FM pool or sampler alike. */
interface Playable {
  triggerAttackRelease(note: number | number[], duration: number, time?: number, velocity?: number): unknown;
  releaseAll(time?: number): unknown;
}

export type EngineStatus = 'locked' | 'ready';

export class MendAudioEngine {
  private voices: Voices | null = null;
  /** Rhodes sampler, set once its samples decode; the FM keys play until then. */
  private keysSampler: Sampler | null = null;
  private initPromise: Promise<void> | null = null;
  private silentEl: HTMLAudioElement | null = null;
  private groove: Groove | null = null;
  private steps: StepEvent[][] = Array.from({ length: LOOP_STEPS }, () => []);
  private pendingSteps: StepEvent[][] | null = null;
  private playing = false;
  private muted = false;
  private focus: LayerId | 'mix' = 'mix';
  private rafId = 0;
  private visualStart = 0;
  private lastVisualBeat = -1;
  /** Last start time per mono voice (Tone mono sources need strictly increasing starts). */
  private lastStart: Record<'bass' | 'kick' | 'snare' | 'hat', number> = { bass: 0, kick: 0, snare: 0, hat: 0 };

  constructor(private readonly hooks: EngineHooks) {
    if (typeof document === 'undefined') return;
    const el = document.createElement('audio');
    el.src = makeSilentWavDataUri();
    el.loop = true;
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.setAttribute('aria-hidden', 'true');
    this.silentEl = el;
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get status(): EngineStatus {
    return this.voices ? 'ready' : 'locked';
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Call synchronously inside the "▶ Listen to Broken Track" tap (iOS Safari unlock):
   * audioSession = 'playback', silent <audio> loop, Tone.start(), then pre-allocate all voices.
   */
  unlock(): Promise<boolean> {
    try {
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* not supported */
    }
    try {
      void this.silentEl?.play().catch(() => undefined);
    } catch {
      /* autoplay refused; Tone.start still unlocks Web Audio */
    }
    let started: Promise<void>;
    try {
      started = toneStart();
    } catch {
      return Promise.resolve(false);
    }
    return started.then(() => this.init()).then(() => true, () => false);
  }

  private init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      // Reharm's bus: master -4 dB <- lo-fi lowpass <- plate-ish reverb; keys through a tremolo.
      const master = new Volume(-4).toDestination();
      const lofi = new Filter({ frequency: 7800, type: 'lowpass', rolloff: -12 }).connect(master);
      const reverb = new Reverb({ decay: 2.4, wet: 0.2, preDelay: 0.01 }).connect(lofi);
      await reverb.ready;

      const ch = (wetSend: boolean): Volume => new Volume(0).connect(wetSend ? reverb : lofi);
      const channels: Record<Channel, Volume> = {
        melody: ch(true),
        chords: ch(true),
        bass: ch(false),
        drums: ch(false),
      };
      const drumsWet = ch(true);

      const tremolo = new Tremolo({ frequency: 3.6, depth: 0.22, spread: 60 }).connect(channels.chords).start();
      const keys = new PolySynth(FMSynth, RHODES.synth).connect(tremolo);
      keys.maxPolyphony = 24;
      keys.volume.value = RHODES.volume;

      const lead = new PolySynth(FMSynth, BELL.synth).connect(channels.melody);
      lead.maxPolyphony = 6;
      lead.volume.value = BELL.volume;

      const bass = new Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.55, release: 0.4 },
      }).connect(channels.bass);
      bass.volume.value = -13;

      const kick = new MembraneSynth({ pitchDecay: 0.03, octaves: 5, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 } }).connect(channels.drums);
      kick.volume.value = -15;
      // MEND's backbeat 'snare' plays Reharm's rim.
      const rimFilter = new Filter({ frequency: 1900, type: 'bandpass', Q: 1.2 }).connect(drumsWet);
      const snare = new NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 } }).connect(rimFilter);
      snare.volume.value = -22;
      const hatFilter = new Filter({ frequency: 7000, type: 'highpass' }).connect(channels.drums);
      const hat = new NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.02 } }).connect(hatFilter);
      hat.volume.value = -34;

      // Warm a few voices per pool with a near-zero release (Reharm: long silent tails stutter the first downbeat).
      const t = immediate() + 0.05;
      const quick = { envelope: { release: 0.01 }, modulationEnvelope: { release: 0.01 } };
      keys.set(quick);
      keys.triggerAttackRelease([48, 52, 55, 59, 62, 65, 69].map(hz), 0.01, t, 0);
      keys.set(RHODES.synth);
      lead.set(quick);
      lead.triggerAttackRelease([67, 71, 74].map(hz), 0.01, t, 0);
      lead.set(BELL.synth);

      this.voices = { master, channels, drumsWet, keys, lead, bass, kick, snare, hat };
      master.mute = this.muted;
      this.applyFocus(0);
      this.installTransport();
      if (this.groove) getTransport().bpm.value = this.groove.bpm;
      void this.loadRhodesSamples(tremolo);
    })();
    return this.initPromise;
  }

  /** Decode the Rhodes samples in the background; the FM keys keep playing if this fails (offline). */
  private async loadRhodesSamples(dest: Tremolo): Promise<void> {
    try {
      const entries = await Promise.all(
        [...rhodesSampleUrls()].map(async ([midi, url]) => [midi, (await ToneAudioBuffer.fromUrl(url)).get()!] as const),
      );
      const s = new Sampler({ urls: Object.fromEntries(entries), release: RHODES.sampled.release }).connect(dest);
      s.volume.value = RHODES.sampled.volume;
      this.keysSampler = s;
    } catch {
      /* keep the FM Rhodes */
    }
  }

  private get keysOut(): Playable {
    return this.keysSampler ?? this.voices!.keys;
  }

  private installTransport(): void {
    const tr = getTransport();
    tr.cancel(0);
    tr.loop = true;
    tr.setLoopPoints(0, '4m');
    const draw = getDraw();
    const ticksPerStep = tr.PPQ / 4;
    tr.scheduleRepeat((time) => {
      const step = Math.round(tr.getTicksAtTime(time) / ticksPerStep) % LOOP_STEPS;
      if (step % 4 === 0 && this.pendingSteps) {
        this.steps = this.pendingSteps; // A/B swap latches on the beat
        this.pendingSteps = null;
      }
      this.trigger(this.steps[step]!, time);
      if (step % 4 === 0) {
        const beat = step / 4;
        draw.schedule(() => {
          if (beat % 4 === 0) this.hooks.onBarStart(beat / 4);
          this.hooks.onBeat(beat);
        }, time);
      }
    }, '16n', 0);
  }

  private trigger(events: readonly StepEvent[], time: number): void {
    const v = this.voices;
    if (!v || !this.groove) return;
    const stepSec = 60 / this.groove.bpm / 4;
    for (const ev of events) {
      const dur = Math.max(0.05, ev.dur * stepSec);
      switch (ev.voice) {
        case 'chords':
          this.keysOut.triggerAttackRelease(ev.midis.map(hz), dur, time, ev.vel);
          break;
        case 'melody':
          v.lead.triggerAttackRelease(hz(ev.midis[0]!), dur, time, ev.vel);
          break;
        case 'bass':
          v.bass.triggerAttackRelease(hz(ev.midis[0]!), dur, this.mono('bass', time), ev.vel);
          break;
        case 'kick':
          v.kick.triggerAttackRelease('C1', '8n', this.mono('kick', time), ev.vel);
          break;
        case 'snare':
          v.snare.triggerAttackRelease('16n', this.mono('snare', time), ev.vel);
          break;
        case 'hat':
          v.hat.triggerAttackRelease('32n', this.mono('hat', time), ev.vel);
          break;
      }
    }
  }

  private mono(key: keyof MendAudioEngine['lastStart'], time: number): number {
    const t = Math.max(time, this.lastStart[key] + 0.002);
    this.lastStart[key] = t;
    return t;
  }

  /** Load the day's groove (tempo + pattern templates). */
  load(groove: Groove, values: TrackValues): void {
    this.groove = groove;
    this.steps = buildSteps(groove, values);
    if (this.voices) getTransport().bpm.value = groove.bpm;
  }

  /** Live edit: heard from the next 16th step. */
  setValues(values: TrackValues): void {
    if (!this.groove) return;
    this.steps = buildSteps(this.groove, values);
    this.pendingSteps = null;
  }

  /** Before/After A/B: swaps on the next beat while playing, immediately when paused. */
  swapValues(values: TrackValues): void {
    if (!this.groove) return;
    const next = buildSteps(this.groove, values);
    if (this.playing && this.voices) this.pendingSteps = next;
    else this.steps = next;
  }

  setFocus(mode: MixMode, layer: LayerId | null): void {
    this.focus = mode === 'solo' && layer ? layer : 'mix';
    this.applyFocus(0.06);
  }

  private applyFocus(ramp: number): void {
    const v = this.voices;
    if (!v) return;
    const trims = FOCUS[this.focus];
    const set = (vol: Volume, target: number) => {
      if (ramp > 0) vol.volume.rampTo(target, ramp);
      else vol.volume.value = target;
    };
    (Object.keys(v.channels) as Channel[]).forEach((c) => set(v.channels[c], BASE[c] + trims[c]));
    set(v.drumsWet, BASE.drums + trims.drums);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.voices) this.voices.master.mute = m;
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.lastVisualBeat = -1;
    if (this.voices) {
      const tr = getTransport();
      tr.position = 0;
      tr.start('+0.08');
    } else {
      this.visualStart = performance.now();
    }
    this.startFrames();
  }

  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.pendingSteps) {
      this.steps = this.pendingSteps;
      this.pendingSteps = null;
    }
    const v = this.voices;
    if (v) {
      getTransport().stop();
      v.keys.releaseAll();
      this.keysSampler?.releaseAll();
      v.lead.releaseAll();
      v.bass.triggerRelease();
    }
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  /** Short one-shot preview of an edit while the loop is paused. */
  audition(kind: 'melody' | 'bass' | 'chord', midis: number[], context?: number[]): void {
    const v = this.voices;
    if (!v || this.playing || this.muted) return;
    const t = immediate() + 0.02;
    if (kind === 'melody') v.lead.triggerAttackRelease(hz(midis[0]!), 0.45, t, 0.8);
    if (kind === 'bass') v.bass.triggerAttackRelease(hz(midis[0]!), 0.6, this.mono('bass', t), 0.9);
    if (kind === 'chord') this.keysOut.triggerAttackRelease(midis.map(hz), 0.9, t, 0.6);
    if (context?.length) this.keysOut.triggerAttackRelease(context.map(hz), 0.9, t, 0.35);
  }

  auditionChord(chordMidis: number[], bassNote: number): void {
    this.audition('chord', chordMidis);
    const v = this.voices;
    if (!v || this.playing || this.muted) return;
    v.bass.triggerAttackRelease(hz(bassNote), 0.8, this.mono('bass', immediate() + 0.02), 0.85);
  }

  /** Try to resume a suspended/interrupted context (must run inside a tap on iOS). */
  resume(): Promise<boolean> {
    if (!this.voices) return Promise.resolve(true);
    try {
      void this.silentEl?.play().catch(() => undefined);
    } catch {
      /* ignore */
    }
    const ctx = getContext();
    return ctx.resume().then(
      () => {
        const ok = ctx.state === 'running';
        this.hooks.onNeedsResume(!ok);
        return ok;
      },
      () => false,
    );
  }

  // --- Frames & clocks --------------------------------------------------------

  private startFrames(): void {
    cancelAnimationFrame(this.rafId);
    const frame = () => {
      if (!this.playing) return;
      const beats = this.currentBeatPos();
      if (beats >= 0) {
        this.hooks.onFrame(beats / LOOP_BEATS);
        if (!this.voices) this.visualBeats(beats);
      }
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  private currentBeatPos(): number {
    if (this.voices) {
      const tr = getTransport();
      if (tr.state !== 'started') return -1;
      // Transport.progress reads the look-ahead clock; sample at the audible time instead.
      const ticks = tr.getTicksAtTime(immediate());
      return (((ticks / tr.PPQ) % LOOP_BEATS) + LOOP_BEATS) % LOOP_BEATS;
    }
    const bpm = this.groove?.bpm ?? 96;
    return (((performance.now() - this.visualStart) / 1000) * (bpm / 60)) % LOOP_BEATS;
  }

  private visualBeats(beatPos: number): void {
    const beat = Math.floor(beatPos);
    if (beat === this.lastVisualBeat) return;
    this.lastVisualBeat = beat;
    if (beat % 4 === 0) {
      if (this.pendingSteps) {
        this.steps = this.pendingSteps;
        this.pendingSteps = null;
      }
      this.hooks.onBarStart(beat / 4);
    }
    this.hooks.onBeat(beat);
  }

  private onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
      return;
    }
    if (this.voices) {
      const ctx = getContext();
      if (ctx.state !== 'running') {
        void ctx.resume().then(
          () => this.hooks.onNeedsResume(ctx.state !== 'running'),
          () => this.hooks.onNeedsResume(true),
        );
      }
    }
    if (this.playing) this.startFrames();
  };
}
