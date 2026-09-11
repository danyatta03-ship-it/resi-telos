import * as Tone from 'tone';
import { PPQ } from '../types';
import type { Beat } from '../types';
import { createRack } from './instruments';
import { buildSchedule } from './schedule';

const SAMPLE_RATE = 44100;

export interface TickRange {
  startTick: number;
  endTick: number;
}

function ticksToSeconds(ticks: number, bpm: number): number {
  return (ticks / PPQ) * (60 / bpm);
}

/** Secondi di audio da renderizzare, con una coda per riverbero e note lunghe. */
export function beatDurationSeconds(beat: Beat, range?: TickRange | null, tail = 2.5): number {
  const totalTicks = range ? range.endTick - range.startTick : buildSchedule(beat).totalTicks;
  return ticksToSeconds(totalTicks, beat.meta.bpm) + tail;
}

/**
 * Lunghezza di ogni blocco di rendering e pre-roll che lo precede.
 * Renderizzare tutto in un colpo solo diventa quadratico (le automazioni si
 * accumulano dentro allo stesso contesto), a blocchi resta lineare.
 */
const CHUNK_SECONDS = 20;
const PREROLL_SECONDS = 8;
const TAIL_SECONDS = 2.5;
/** Sovrapposizione fra blocchi: evita il click nel punto di giunzione. */
const XFADE_SECONDS = 0.025;

/** Renderizza il beat (o una sua porzione) e restituisce un WAV pronto da scaricare. */
export async function renderWav(
  beat: Beat,
  options: { bitDepth?: 16 | 24; onProgress?: (ratio: number) => void; range?: TickRange | null } = {},
): Promise<Blob> {
  const bitDepth = options.bitDepth ?? 24;
  const range = options.range ?? null;
  const schedule = buildSchedule(beat);
  const startTick = range?.startTick ?? 0;
  const endTick = range?.endTick ?? schedule.totalTicks;
  const events = schedule.events.filter((e) => e.tick >= startTick && e.tick < endTick);

  const bpm = beat.meta.bpm;
  const ticksPerSecond = (PPQ * bpm) / 60;
  const bodySeconds = ticksToSeconds(endTick - startTick, bpm);
  const chunkCount = Math.max(1, Math.ceil(bodySeconds / CHUNK_SECONDS));
  const xfadeFrames = Math.round(XFADE_SECONDS * SAMPLE_RATE);
  const totalFrames = Math.round((bodySeconds + TAIL_SECONDS) * SAMPLE_RATE);
  const merged = [new Float32Array(totalFrames), new Float32Array(totalFrames)];

  options.onProgress?.(0.01);

  for (let chunk = 0; chunk < chunkCount; chunk++) {
    const isLast = chunk === chunkCount - 1;
    const isFirst = chunk === 0;
    const chunkStart = chunk * CHUNK_SECONDS;
    const chunkLength = Math.min(CHUNK_SECONDS, bodySeconds - chunkStart);
    // Il pre-roll fa suonare davvero le note iniziate prima del blocco.
    const lead = Math.min(PREROLL_SECONDS, chunkStart);
    const extra = isLast ? TAIL_SECONDS : XFADE_SECONDS;
    const renderSeconds = lead + chunkLength + extra;
    const renderStartTick = startTick + Math.round((chunkStart - lead) * ticksPerSecond);
    const renderEndTick = startTick + Math.round((chunkStart + chunkLength + extra) * ticksPerSecond);
    const chunkEvents = events
      .filter((e) => e.tick >= renderStartTick && e.tick < renderEndTick)
      .map((e) => ({ ...e, tick: e.tick - renderStartTick }));

    const buffer = await Tone.Offline(
      async ({ transport }) => {
        transport.PPQ = PPQ;
        transport.bpm.value = bpm;

        const rack = createRack(Tone.getDestination(), beat.masterVolume);
        for (const [id, state] of Object.entries(beat.mixer)) {
          const strip = rack.strips[id as keyof typeof rack.strips];
          if (!strip) continue;
          strip.channel.volume.value = state.volume;
          strip.channel.pan.value = state.pan;
          strip.channel.mute = state.mute;
          strip.channel.solo = state.solo;
        }
        await rack.ready;

        for (const event of chunkEvents) {
          const strip = rack.strips[event.track];
          if (!strip) continue;
          const durationSec = ticksToSeconds(event.durTicks, bpm);
          const slideFreq = event.slideTo ? 440 * Math.pow(2, (event.slideTo - 69) / 12) : undefined;
          transport.schedule((time) => {
            strip.voice.trigger(time, event.pitch, durationSec, event.velocity, slideFreq);
          }, `${Math.round(event.tick)}i`);
        }

        transport.start(0);
      },
      renderSeconds,
      2,
      SAMPLE_RATE,
    );

    const raw = buffer.toArray();
    const rendered: Float32Array[] = Array.isArray(raw) ? raw : [raw, raw];
    const skip = Math.round(lead * SAMPLE_RATE);
    const destOffset = Math.round(chunkStart * SAMPLE_RATE);
    const available = rendered[0].length - skip;

    for (let ch = 0; ch < 2; ch++) {
      const source = rendered[Math.min(ch, rendered.length - 1)];
      const target = merged[ch];
      for (let i = 0; i < available; i++) {
        const dest = destOffset + i;
        if (dest >= totalFrames) break;
        let gain = 1;
        // Dissolvenza in entrata sulla zona sovrapposta al blocco precedente.
        if (!isFirst && i < xfadeFrames) gain = i / xfadeFrames;
        // Dissolvenza in uscita sulla coda che il blocco successivo ricoprira'.
        const fromEnd = available - 1 - i;
        if (!isLast && fromEnd < xfadeFrames) gain = Math.min(gain, fromEnd / xfadeFrames);
        target[dest] += source[skip + i] * gain;
      }
    }

    options.onProgress?.((chunk + 1) / chunkCount);
  }

  const wav = encodeWav(merged, SAMPLE_RATE, bitDepth);
  options.onProgress?.(1);
  return new Blob([wav], { type: 'audio/wav' });
}

/** Encoder WAV PCM (16 o 24 bit). */
export function encodeWav(channels: Float32Array[], sampleRate: number, bitDepth: 16 | 24): ArrayBuffer {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const max = bitDepth === 24 ? 8388607 : 32767;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][frame] ?? 0));
      const value = Math.round(sample * max);
      if (bitDepth === 24) {
        view.setUint8(offset, value & 0xff);
        view.setUint8(offset + 1, (value >> 8) & 0xff);
        view.setUint8(offset + 2, (value >> 16) & 0xff);
        offset += 3;
      } else {
        view.setInt16(offset, value, true);
        offset += 2;
      }
    }
  }

  return buffer;
}
