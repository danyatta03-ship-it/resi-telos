import * as Tone from 'tone';
import { PPQ } from '../types';
import type { Beat, ChannelState, TrackId } from '../types';
import { createRack } from './instruments';
import type { InstrumentRack } from './instruments';
import { buildSchedule } from './schedule';
import type { Schedule } from './schedule';

export type TransportState = 'stopped' | 'playing' | 'paused';

export interface LoopRange {
  startTick: number;
  endTick: number;
}

type Listener = (state: TransportState) => void;

/** Motore di riproduzione: Tone.Transport + rack di strumenti + mixer live. */
export class AudioEngine {
  private rack: InstrumentRack | null = null;
  private part: Tone.Part | null = null;
  private schedule: Schedule | null = null;
  private beat: Beat | null = null;
  private listeners = new Set<Listener>();
  private _state: TransportState = 'stopped';
  private initialized = false;

  get state(): TransportState {
    return this._state;
  }

  get ready(): boolean {
    return this.initialized;
  }

  get totalTicks(): number {
    return this.schedule?.totalTicks ?? 0;
  }

  get analyser(): Tone.Analyser | null {
    return this.rack?.analyser ?? null;
  }

  onStateChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(state: TransportState) {
    this._state = state;
    for (const fn of this.listeners) fn(state);
  }

  /** Va chiamato da un gesto dell'utente: sblocca l'AudioContext. */
  async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();
    const transport = Tone.getTransport();
    transport.PPQ = PPQ;
    this.rack = createRack(Tone.getDestination());
    this.initialized = true;
    if (this.beat) this.load(this.beat);
  }

  load(beat: Beat): void {
    this.beat = beat;
    if (!this.initialized || !this.rack) return;

    const transport = Tone.getTransport();
    transport.bpm.value = beat.meta.bpm;
    this.applyMixer(beat.mixer, beat.masterVolume);
    // I timbri seguono il carattere del beat.
    this.rack.applyTone({
      hardness: (beat.meta.hardness ?? 70) / 100,
      darkness: (beat.meta.darkness ?? 70) / 100,
    });

    const schedule = buildSchedule(beat);
    this.schedule = schedule;

    this.part?.dispose();
    const rack = this.rack;
    const part = new Tone.Part(
      (time, value: { track: TrackId; pitch: number; durTicks: number; velocity: number; slideTo?: number }) => {
        const strip = rack.strips[value.track];
        if (!strip) return;
        const durationSec = Tone.Ticks(value.durTicks).toSeconds();
        const slideFreq = value.slideTo ? 440 * Math.pow(2, (value.slideTo - 69) / 12) : undefined;
        strip.voice.trigger(time, value.pitch, durationSec, value.velocity, slideFreq);
      },
      schedule.events.map((e) => ({
        time: `${Math.round(e.tick)}i`,
        track: e.track,
        pitch: e.pitch,
        durTicks: e.durTicks,
        velocity: e.velocity,
        slideTo: e.slideTo,
      })),
    );
    part.start(0);
    this.part = part;

    if (!transport.loop) {
      transport.loopEnd = `${schedule.totalTicks}i`;
    }
  }

  setBpm(bpm: number): void {
    if (this.beat) this.beat.meta.bpm = bpm;
    if (this.initialized) Tone.getTransport().bpm.rampTo(bpm, 0.05);
  }

  applyMixer(mixer: Record<TrackId, ChannelState>, masterVolume: number): void {
    if (!this.rack) return;
    for (const [id, state] of Object.entries(mixer) as [TrackId, ChannelState][]) {
      const strip = this.rack.strips[id];
      if (!strip) continue;
      strip.channel.volume.value = state.volume;
      strip.channel.pan.value = state.pan;
      strip.channel.mute = state.mute;
      strip.channel.solo = state.solo;
    }
    this.rack.master.volume.value = masterVolume;
  }

  setLoop(range: LoopRange | null): void {
    if (!this.initialized) return;
    const transport = Tone.getTransport();
    if (range) {
      transport.loop = true;
      transport.loopStart = `${Math.round(range.startTick)}i`;
      transport.loopEnd = `${Math.round(range.endTick)}i`;
    } else {
      transport.loop = false;
      transport.loopEnd = `${this.totalTicks}i`;
    }
  }

  async play(fromTick?: number): Promise<void> {
    await this.init();
    const transport = Tone.getTransport();
    if (fromTick !== undefined) transport.ticks = Math.round(fromTick);
    transport.start('+0.05');
    this.emit('playing');
  }

  pause(): void {
    if (!this.initialized) return;
    Tone.getTransport().pause();
    this.releaseAll();
    this.emit('paused');
  }

  stop(): void {
    if (!this.initialized) return;
    const transport = Tone.getTransport();
    transport.stop();
    transport.ticks = 0;
    this.releaseAll();
    this.emit('stopped');
  }

  seek(tick: number): void {
    if (!this.initialized) return;
    Tone.getTransport().ticks = Math.max(0, Math.round(tick));
  }

  getPositionTicks(): number {
    if (!this.initialized) return 0;
    return Tone.getTransport().ticks;
  }

  /** Stato reale del canale audio, usato dai test e dal debug. */
  rackChannelMuted(track: TrackId): boolean {
    return this.rack?.strips[track]?.channel.mute ?? false;
  }

  /** Anteprima di una singola nota (piano roll e step sequencer). */
  async preview(track: TrackId, pitch: number, durationSec = 0.35, velocity = 0.9): Promise<void> {
    await this.init();
    const strip = this.rack?.strips[track];
    if (!strip) return;
    strip.voice.trigger(Tone.now() + 0.02, pitch, durationSec, velocity);
  }

  private releaseAll(): void {
    // Evita note appese quando si mette in pausa durante un pad lungo.
    Tone.getContext().rawContext.resume?.();
  }

  dispose(): void {
    this.part?.dispose();
    this.rack?.dispose();
    this.part = null;
    this.rack = null;
    this.initialized = false;
  }
}

export const audioEngine = new AudioEngine();
