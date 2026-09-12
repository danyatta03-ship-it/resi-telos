import * as Tone from 'tone';
import type { TrackId } from '../types';

/** Come hardness e darkness modellano i timbri. */
export interface ToneShape {
  hardness: number;
  darkness: number;
}

export interface Voice {
  /** Uscita audio della voce, gia' collegata al canale del mixer. */
  output: Tone.ToneAudioNode;
  /**
   * Suona una nota.
   * @param slideToFreq se presente, la voce scivola verso questa frequenza (808).
   */
  trigger(time: number, pitch: number, durationSec: number, velocity: number, slideToFreq?: number): void;
  /** Adatta il timbro agli assi del beat. */
  shape?(tone: ToneShape): void;
  dispose(): void;
}

export interface ChannelStrip {
  channel: Tone.Channel;
  voice: Voice;
}

const mtof = (pitch: number) => 440 * Math.pow(2, (pitch - 69) / 12);

/**
 * Le voci monofoniche di Tone rifiutano due attacchi nello stesso istante:
 * questa guardia sposta in avanti di pochi millisecondi gli eventi sovrapposti.
 */
function monoGuard(minGap = 0.004) {
  let last = -Infinity;
  return (time: number): number => {
    // Un salto indietro significa loop o seek: si riparte da capo senza correzioni.
    const overlapping = time < last + minGap && last - time < 0.05;
    const safe = overlapping ? last + minGap : time;
    last = safe;
    return safe;
  };
}

function noiseVoice(opts: {
  type: Tone.NoiseType;
  decay: number;
  filterType: BiquadFilterType;
  frequency: number;
  q?: number;
  gain?: number;
}): Voice {
  const filter = new Tone.Filter({ type: opts.filterType, frequency: opts.frequency, Q: opts.q ?? 1 });
  const gain = new Tone.Gain(opts.gain ?? 1).connect(filter);
  const noise = new Tone.NoiseSynth({
    noise: { type: opts.type },
    envelope: { attack: 0.001, decay: opts.decay, sustain: 0, release: 0.02 },
  }).connect(gain);

  const guard = monoGuard();
  return {
    output: filter,
    trigger(time, _pitch, durationSec, velocity) {
      noise.triggerAttackRelease(Math.min(durationSec, opts.decay), guard(time), velocity);
    },
    dispose() {
      noise.dispose();
      gain.dispose();
      filter.dispose();
    },
  };
}

function kickVoice(): Voice {
  const drive = new Tone.Distortion(0.12);
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.045,
    octaves: 7,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.38, sustain: 0.008, release: 0.32 },
  }).connect(drive);

  const guard = monoGuard();
  return {
    output: drive,
    trigger(time, _pitch, _dur, velocity) {
      synth.triggerAttackRelease('C1', 0.32, guard(time), velocity);
    },
    shape({ hardness }) {
      // Piu' e' hard, piu' la cassa e' spinta e corta.
      drive.distortion = 0.08 + hardness * 0.3;
      synth.envelope.decay = 0.42 - hardness * 0.12;
      synth.set({ pitchDecay: 0.05 - hardness * 0.018 });
    },
    dispose() {
      synth.dispose();
      drive.dispose();
    },
  };
}

function snareVoice(): Voice {
  const out = new Tone.Gain(1);
  const filter = new Tone.Filter({ type: 'bandpass', frequency: 1900, Q: 0.8 }).connect(out);
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.17, sustain: 0, release: 0.03 },
  }).connect(filter);
  const body = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.02 },
  }).connect(out);
  body.volume.value = -10;

  const guard = monoGuard();
  return {
    output: out,
    trigger(time, _pitch, _dur, velocity) {
      const at = guard(time);
      noise.triggerAttackRelease(0.16, at, velocity);
      body.triggerAttackRelease(190, 0.1, at, velocity * 0.8);
    },
    dispose() {
      noise.dispose();
      body.dispose();
      filter.dispose();
      out.dispose();
    },
  };
}

function clapVoice(): Voice {
  const out = new Tone.Gain(1);
  const filter = new Tone.Filter({ type: 'bandpass', frequency: 1400, Q: 1.4 }).connect(out);
  // Il clap e' fatto di micro ripetizioni: ognuna ha il suo generatore, cosi' due clap
  // ravvicinati non si scavalcano mai sulla stessa linea temporale.
  const offsets = [0, 0.011, 0.022];
  const bursts = offsets.map(() =>
    new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.055, sustain: 0, release: 0.02 },
    }).connect(filter),
  );
  const tail = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.05 },
  }).connect(filter);
  tail.volume.value = -9;

  const guard = monoGuard();
  return {
    output: out,
    trigger(time, _pitch, _dur, velocity) {
      const at = guard(time);
      bursts.forEach((burst, i) => {
        burst.triggerAttackRelease(0.05, at + offsets[i], velocity * (1 - i * 0.15));
      });
      tail.triggerAttackRelease(0.2, at + 0.03, velocity * 0.6);
    },
    dispose() {
      for (const burst of bursts) burst.dispose();
      tail.dispose();
      filter.dispose();
      out.dispose();
    },
  };
}

function percVoice(): Voice {
  const out = new Tone.Gain(1);
  const filter = new Tone.Filter({ type: 'bandpass', frequency: 3000, Q: 1.4 }).connect(out);
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.085, sustain: 0, release: 0.02 },
  }).connect(filter);
  // Un piccolo blip intonato da' carattere alla percussione senza costare CPU.
  const blip = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 },
  }).connect(out);
  blip.volume.value = -12;

  const guard = monoGuard();
  return {
    output: out,
    trigger(time, pitch, _dur, velocity) {
      const at = guard(time);
      const freq = Math.max(1200, Math.min(6000, mtof(pitch) * 2.2));
      filter.frequency.setValueAtTime(freq, at);
      noise.triggerAttackRelease(0.08, at, velocity);
      blip.triggerAttackRelease(mtof(pitch + 12), 0.06, at, velocity * 0.55);
    },
    dispose() {
      noise.dispose();
      blip.dispose();
      filter.dispose();
      out.dispose();
    },
  };
}

function bass808Voice(): Voice {
  const out = new Tone.Gain(1);
  const shaper = new Tone.Distortion(0.18).connect(out);
  const tone = new Tone.Filter({ type: 'lowpass', frequency: 2600, Q: 0.6 }).connect(shaper);
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.006, decay: 0.9, sustain: 0.72, release: 0.28 },
    filter: { type: 'lowpass', Q: 1 },
    filterEnvelope: { attack: 0.004, decay: 0.28, sustain: 0.35, release: 0.2, baseFrequency: 70, octaves: 3.2 },
    portamento: 0,
  }).connect(tone);
  synth.volume.value = -3;

  const guard = monoGuard();
  return {
    output: out,
    trigger(time, pitch, durationSec, velocity, slideToFreq) {
      const freq = mtof(pitch);
      const at = guard(time);
      synth.triggerAttackRelease(freq, Math.max(0.08, durationSec), at, velocity);
      if (slideToFreq && slideToFreq !== freq) {
        // Glide verso la nota successiva nella coda della nota corrente.
        const start = at + durationSec * 0.62;
        synth.frequency.cancelScheduledValues(start);
        synth.frequency.setValueAtTime(freq, start);
        synth.frequency.exponentialRampToValueAtTime(slideToFreq, at + durationSec * 0.99);
      }
    },
    shape({ hardness, darkness }) {
      // 808 hard: piu' saturo e con piu' armoniche; dark: piu' rotondo e lungo.
      shaper.distortion = 0.1 + hardness * 0.32;
      tone.frequency.value = 1800 + hardness * 2600 - darkness * 400;
      synth.envelope.release = 0.22 + darkness * 0.3;
    },
    dispose() {
      synth.dispose();
      tone.dispose();
      shaper.dispose();
      out.dispose();
    },
  };
}

function polyVoice(
  create: () => Tone.PolySynth,
  postGain = 1,
  maxPolyphony = 8,
  shape?: (set: (options: Record<string, unknown>) => void, tone: ToneShape) => void,
): Voice {
  const out = new Tone.Gain(postGain);
  const synth = create().connect(out);
  // Poche voci tengono basso il numero di oscillatori sempre attivi:
  // conta molto nel rendering offline del WAV.
  synth.maxPolyphony = maxPolyphony;
  // Due attacchi ravvicinati sulla stessa nota userebbero la stessa voce: li distanziamo.
  const lastByPitch = new Map<number, number>();
  return {
    output: out,
    trigger(time, pitch, durationSec, velocity) {
      const previous = lastByPitch.get(pitch);
      let at = time;
      if (previous !== undefined && at <= previous && previous - at < 0.05) at = previous + 0.006;
      lastByPitch.set(pitch, at);
      synth.triggerAttackRelease(mtof(pitch), Math.max(0.05, durationSec), at, velocity);
    },
    shape: shape
      ? (tone) => shape((options) => (synth as unknown as { set: (o: unknown) => void }).set(options), tone)
      : undefined,
    dispose() {
      synth.dispose();
      out.dispose();
    },
  };
}

const VOICE_FACTORIES: Record<TrackId, () => Voice> = {
  kick: kickVoice,
  snare: snareVoice,
  clap: clapVoice,
  hat: () => noiseVoice({ type: 'white', decay: 0.035, filterType: 'highpass', frequency: 8200, q: 0.8, gain: 0.7 }),
  openhat: () => noiseVoice({ type: 'white', decay: 0.26, filterType: 'highpass', frequency: 7200, q: 0.7, gain: 0.55 }),
  perc: percVoice,
  '808': bass808Voice,
  melody: () =>
    polyVoice(
      () =>
        new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 2.02,
          modulationIndex: 5.5,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.004, decay: 0.85, sustain: 0.06, release: 0.9 },
          modulation: { type: 'triangle' },
          modulationEnvelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.2 },
        }),
      0.9,
      10,
      (set, { hardness, darkness }) => {
        // Hard: pluck metallico e corto. Dark: campana piu' lunga e sorda.
        set({
          harmonicity: 2 + hardness * 1.6,
          modulationIndex: 3 + hardness * 7,
          envelope: {
            attack: 0.004,
            decay: 0.95 - hardness * 0.45 + darkness * 0.25,
            sustain: 0.05,
            release: 0.7 + darkness * 0.6,
          },
        });
      },
    ),
  counter: () =>
    polyVoice(
      () =>
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.006, decay: 0.4, sustain: 0.08, release: 0.5 },
        }),
      0.8,
      8,
    ),
  chords: () =>
    polyVoice(
      () =>
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'fatsawtooth', count: 2, spread: 24 },
          envelope: { attack: 0.02, decay: 0.5, sustain: 0.35, release: 0.7 },
        }),
      0.55,
      12,
    ),
  pad: () =>
    polyVoice(
      () =>
        new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 2,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.7, decay: 1.2, sustain: 0.7, release: 2.1 },
          modulation: { type: 'sine' },
          modulationEnvelope: { attack: 1.2, decay: 0.6, sustain: 0.6, release: 1.8 },
        }),
      0.5,
      14,
      (set, { darkness }) => {
        set({
          envelope: { attack: 0.5 + darkness * 0.7, decay: 1.2, sustain: 0.7, release: 1.6 + darkness * 1.4 },
        });
      },
    ),
  lead: () =>
    polyVoice(
      () =>
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'square' },
          envelope: { attack: 0.004, decay: 0.3, sustain: 0.05, release: 0.35 },
        }),
      0.35,
      8,
    ),
};

export interface InstrumentRack {
  strips: Record<TrackId, ChannelStrip>;
  master: Tone.Volume;
  analyser: Tone.Analyser;
  /** Adatta tutti i timbri agli assi del beat. */
  applyTone(tone: ToneShape): void;
  /** Risolve quando il riverbero ha generato la sua risposta all'impulso. */
  ready: Promise<void>;
  dispose(): void;
}

/** Tracce che ricevono un po' di riverbero. */
const REVERB_SENDS: Partial<Record<TrackId, number>> = {
  snare: -14,
  clap: -12,
  melody: -13,
  counter: -12,
  chords: -14,
  pad: -6,
  lead: -14,
  perc: -16,
};

/**
 * Costruisce la catena audio completa: voci -> canali -> (mandata riverbero) -> master.
 * Il routing del riverbero e' esplicito e non usa i bus globali di Tone, che sono
 * condivisi fra i contesti e romperebbero il rendering offline del WAV.
 */
export function createRack(destination: Tone.InputNode, masterDb = -4): InstrumentRack {
  const limiter = new Tone.Limiter(-0.8).connect(destination);
  const master = new Tone.Volume(masterDb).connect(limiter);
  const analyser = new Tone.Analyser('waveform', 512);
  master.connect(analyser);

  const reverb = new Tone.Reverb({ decay: 2.4, preDelay: 0.02, wet: 1 }).connect(master);
  const sends: Tone.Gain[] = [];

  const strips = {} as Record<TrackId, ChannelStrip>;
  for (const id of Object.keys(VOICE_FACTORIES) as TrackId[]) {
    const channel = new Tone.Channel({ volume: 0, pan: 0 }).connect(master);
    const voice = VOICE_FACTORIES[id]();
    voice.output.connect(channel);
    const sendDb = REVERB_SENDS[id];
    if (sendDb !== undefined) {
      // Mandata post-fader: segue volume, pan e mute del canale.
      const send = new Tone.Gain(Tone.dbToGain(sendDb));
      channel.connect(send);
      send.connect(reverb);
      sends.push(send);
    }
    strips[id] = { channel, voice };
  }

  return {
    strips,
    master,
    analyser,
    applyTone(tone: ToneShape) {
      for (const strip of Object.values(strips)) strip.voice.shape?.(tone);
      // Il riverbero segue la cupezza: piu' scuro, piu' coda.
      reverb.decay = 1.6 + tone.darkness * 2.2;
    },
    ready: reverb.ready,
    dispose() {
      for (const strip of Object.values(strips)) {
        strip.voice.dispose();
        strip.channel.dispose();
      }
      for (const send of sends) send.dispose();
      reverb.dispose();
      analyser.dispose();
      master.dispose();
      limiter.dispose();
    },
  };
}
