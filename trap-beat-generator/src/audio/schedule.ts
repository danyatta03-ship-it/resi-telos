import { TICKS_PER_BAR } from '../types';
import type { Beat, NoteEvent, TrackId } from '../types';
import { blendMoods } from '../music/moods';
import { humanizeNotes } from '../generator/humanize';

export interface ScheduledEvent {
  /** Tick assoluto nell'arrangiamento. */
  tick: number;
  track: TrackId;
  pitch: number;
  durTicks: number;
  velocity: number;
  /** Pitch di destinazione dello slide (solo 808). */
  slideTo?: number;
}

export interface SectionRange {
  id: string;
  name: string;
  startTick: number;
  endTick: number;
  startBar: number;
  bars: number;
}

export interface Schedule {
  events: ScheduledEvent[];
  totalTicks: number;
  sections: SectionRange[];
}

/** Note di una sezione dopo humanize e swing, pronte per playback ed export. */
export function processedNotes(beat: Beat, sectionIndex: number, track: TrackId): NoteEvent[] {
  const section = beat.sections[sectionIndex];
  const notes = section?.clips[track] ?? [];
  if (!notes.length) return [];
  const profile = blendMoods(beat.meta.moods);
  const swing = track === 'hat' || track === 'perc' ? profile.swing : profile.swing * 0.5;
  const limit = section.bars * TICKS_PER_BAR;
  return humanizeNotes(notes, beat.meta.humanize / 100, track, beat.meta.seed + sectionIndex, swing)
    .map((n) => ({ ...n, t: Math.min(Math.max(0, n.t), Math.max(0, limit - 1)) }))
    .sort((a, b) => a.t - b.t);
}

/** Tracce monofoniche: due colpi nello stesso istante non sono riproducibili. */
const MONO_TRACKS: TrackId[] = ['kick', 'snare', 'clap', 'hat', 'openhat', 'perc', '808'];
const MIN_GAP_TICKS = 2;
/**
 * Distanza minima fra due note identiche della stessa traccia: sotto questa soglia
 * i sintetizzatori polifonici riuserebbero la stessa voce e l'attacco fallirebbe.
 */
const MIN_SAME_PITCH_GAP = 10;

/**
 * Ripulisce la lista di eventi: niente doppioni sulla stessa nota, distanza minima
 * fra colpi consecutivi delle voci monofoniche e fra ripetizioni dello stesso pitch.
 */
function dedupeEvents(events: ScheduledEvent[]): ScheduledEvent[] {
  const lastByTrack = new Map<TrackId, number>();
  const lastByPitch = new Map<string, number>();
  const out: ScheduledEvent[] = [];

  for (const event of events) {
    if (MONO_TRACKS.includes(event.track)) {
      const last = lastByTrack.get(event.track);
      if (last !== undefined && event.tick - last < MIN_GAP_TICKS) continue;
      lastByTrack.set(event.track, event.tick);
    }
    const pitchKey = `${event.track}:${event.pitch}`;
    const lastSame = lastByPitch.get(pitchKey);
    if (lastSame !== undefined && event.tick - lastSame < MIN_SAME_PITCH_GAP) continue;
    lastByPitch.set(pitchKey, event.tick);
    out.push(event);
  }
  return out;
}

/** Costruisce la lista di eventi assoluti dell'intero arrangiamento. */
export function buildSchedule(beat: Beat): Schedule {
  const events: ScheduledEvent[] = [];
  const sections: SectionRange[] = [];
  let offsetTicks = 0;
  let startBar = 0;

  beat.sections.forEach((section, index) => {
    const lengthTicks = section.bars * TICKS_PER_BAR;
    sections.push({
      id: section.id,
      name: section.name,
      startTick: offsetTicks,
      endTick: offsetTicks + lengthTicks,
      startBar,
      bars: section.bars,
    });

    for (const track of Object.keys(section.clips) as TrackId[]) {
      const notes = processedNotes(beat, index, track);
      notes.forEach((note, i) => {
        let slideTo: number | undefined;
        if (note.slide) {
          const next = notes[i + 1];
          if (next && next.p !== note.p) slideTo = next.p;
        }
        events.push({
          tick: offsetTicks + note.t,
          track,
          pitch: note.p,
          durTicks: Math.max(20, note.d),
          velocity: Math.max(1, Math.min(127, note.v)) / 127,
          slideTo,
        });
      });
    }

    offsetTicks += lengthTicks;
    startBar += section.bars;
  });

  events.sort((a, b) => a.tick - b.tick);
  return { events: dedupeEvents(events), totalTicks: offsetTicks, sections };
}
