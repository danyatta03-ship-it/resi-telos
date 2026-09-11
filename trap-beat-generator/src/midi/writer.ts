/**
 * Writer MIDI (Standard MIDI File, formato 1) scritto su misura:
 * permette tracce separate, canale percussioni e pitch bend per gli slide dell'808.
 */

export interface MidiNote {
  tick: number;
  duration: number;
  pitch: number;
  velocity: number;
  /** Pitch di arrivo dello slide: genera una rampa di pitch bend. */
  slideTo?: number;
}

export interface MidiTrackSpec {
  name: string;
  /** Canale 0-based (9 = percussioni). */
  channel: number;
  program?: number;
  notes: MidiNote[];
  /** Range del pitch bend in semitoni, impostato via RPN. */
  pitchBendRange?: number;
}

export interface MidiFileOptions {
  bpm: number;
  ppq: number;
  name?: string;
  timeSignature?: [number, number];
}

interface RawEvent {
  tick: number;
  /** Ordine a parita' di tick: 0 = note off, 1 = controlli, 2 = note on. */
  order: number;
  bytes: number[];
}

function varLen(value: number): number[] {
  let v = Math.max(0, Math.round(value));
  const bytes = [v & 0x7f];
  v >>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function textEvent(type: number, text: string): number[] {
  const data = Array.from(new TextEncoder().encode(text));
  return [0xff, type, ...varLen(data.length), ...data];
}

function chunk(id: string, data: number[]): number[] {
  const len = data.length;
  return [
    ...Array.from(id).map((c) => c.charCodeAt(0)),
    (len >>> 24) & 0xff,
    (len >>> 16) & 0xff,
    (len >>> 8) & 0xff,
    len & 0xff,
    ...data,
  ];
}

function encodeTrack(events: RawEvent[]): number[] {
  const sorted = events.slice().sort((a, b) => a.tick - b.tick || a.order - b.order);
  const out: number[] = [];
  let last = 0;
  for (const ev of sorted) {
    out.push(...varLen(ev.tick - last), ...ev.bytes);
    last = ev.tick;
  }
  out.push(0x00, 0xff, 0x2f, 0x00); // end of track
  return out;
}

function pitchBendEvents(channel: number, note: MidiNote, range: number): RawEvent[] {
  if (note.slideTo === undefined || note.slideTo === note.pitch) return [];
  const semitones = Math.max(-range, Math.min(range, note.slideTo - note.pitch));
  const steps = 12;
  const start = note.tick + Math.round(note.duration * 0.6);
  const end = note.tick + Math.max(1, Math.round(note.duration * 0.97));
  const events: RawEvent[] = [];
  for (let i = 0; i <= steps; i++) {
    const tick = Math.round(start + ((end - start) * i) / steps);
    const ratio = (semitones / range) * (i / steps);
    const value = Math.max(0, Math.min(16383, Math.round(8192 + ratio * 8191)));
    events.push({
      tick,
      order: 1,
      bytes: [0xe0 | (channel & 0x0f), value & 0x7f, (value >> 7) & 0x7f],
    });
  }
  // Riporta il bend a zero subito dopo la fine della nota.
  events.push({
    tick: note.tick + Math.round(note.duration) + 1,
    order: 1,
    bytes: [0xe0 | (channel & 0x0f), 0x00, 0x40],
  });
  return events;
}

/** Genera il file MIDI completo come Uint8Array. */
export function writeMidiFile(tracks: MidiTrackSpec[], options: MidiFileOptions): Uint8Array {
  const { bpm, ppq } = options;
  const [numerator, denominator] = options.timeSignature ?? [4, 4];
  const microsPerQuarter = Math.round(60_000_000 / bpm);

  // Traccia 0: tempo, metrica e nome del brano.
  const meta: RawEvent[] = [
    { tick: 0, order: 0, bytes: textEvent(0x03, options.name ?? 'Trap Beat') },
    {
      tick: 0,
      order: 0,
      bytes: [
        0xff, 0x51, 0x03,
        (microsPerQuarter >> 16) & 0xff,
        (microsPerQuarter >> 8) & 0xff,
        microsPerQuarter & 0xff,
      ],
    },
    {
      tick: 0,
      order: 0,
      bytes: [0xff, 0x58, 0x04, numerator, Math.round(Math.log2(denominator)), 24, 8],
    },
  ];

  const chunks: number[][] = [chunk('MTrk', encodeTrack(meta))];

  for (const track of tracks) {
    const events: RawEvent[] = [{ tick: 0, order: 0, bytes: textEvent(0x03, track.name) }];
    const channel = track.channel & 0x0f;

    if (track.program !== undefined) {
      events.push({ tick: 0, order: 1, bytes: [0xc0 | channel, track.program & 0x7f] });
    }

    const bendRange = track.pitchBendRange ?? 0;
    const hasSlides = bendRange > 0 && track.notes.some((n) => n.slideTo !== undefined);
    if (hasSlides) {
      // RPN 0,0 = pitch bend range in semitoni.
      events.push(
        { tick: 0, order: 1, bytes: [0xb0 | channel, 101, 0] },
        { tick: 0, order: 1, bytes: [0xb0 | channel, 100, 0] },
        { tick: 0, order: 1, bytes: [0xb0 | channel, 6, Math.min(24, bendRange)] },
        { tick: 0, order: 1, bytes: [0xb0 | channel, 38, 0] },
      );
    }

    for (const note of track.notes) {
      const pitch = Math.max(0, Math.min(127, Math.round(note.pitch)));
      const velocity = Math.max(1, Math.min(127, Math.round(note.velocity)));
      const start = Math.max(0, Math.round(note.tick));
      const end = start + Math.max(1, Math.round(note.duration));
      events.push({ tick: start, order: 2, bytes: [0x90 | channel, pitch, velocity] });
      events.push({ tick: end, order: 0, bytes: [0x80 | channel, pitch, 0x40] });
      if (hasSlides) events.push(...pitchBendEvents(channel, note, bendRange));
    }

    chunks.push(chunk('MTrk', encodeTrack(events)));
  }

  const header = chunk('MThd', [
    0x00, 0x01, // formato 1
    (chunks.length >> 8) & 0xff,
    chunks.length & 0xff,
    (ppq >> 8) & 0xff,
    ppq & 0xff,
  ]);

  const all = [...header, ...chunks.flat()];
  return Uint8Array.from(all);
}
