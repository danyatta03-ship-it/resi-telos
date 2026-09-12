import { PPQ, TRACK_MAP, TRACKS } from '../types';
import type { Beat, TrackId } from '../types';
import { buildSchedule } from '../audio/schedule';
import { writeMidiFile } from './writer';
import type { MidiNote, MidiTrackSpec } from './writer';

/** Programmi General MIDI usati nell'export, cosi' i file suonano anche fuori da FL Studio. */
const PROGRAMS: Partial<Record<TrackId, number>> = {
  '808': 38,
  melody: 81,
  counter: 82,
  chords: 51,
  pad: 89,
  lead: 87,
};

export interface MidiBundleFile {
  name: string;
  data: Uint8Array;
}

function notesByTrack(beat: Beat): Map<TrackId, MidiNote[]> {
  const map = new Map<TrackId, MidiNote[]>();
  for (const event of buildSchedule(beat).events) {
    const list = map.get(event.track) ?? [];
    list.push({
      tick: event.tick,
      duration: event.durTicks,
      pitch: event.pitch,
      velocity: Math.max(1, Math.round(event.velocity * 127)),
      slideTo: event.slideTo,
    });
    map.set(event.track, list);
  }
  return map;
}

function trackSpec(id: TrackId, notes: MidiNote[]): MidiTrackSpec {
  const def = TRACK_MAP[id];
  return {
    name: def.midiName,
    channel: def.midiChannel,
    program: PROGRAMS[id],
    notes: notes.sort((a, b) => a.tick - b.tick),
    pitchBendRange: id === '808' ? 12 : 0,
  };
}

const GROUPS: { file: string; tracks: TrackId[] }[] = [
  { file: 'drums.mid', tracks: ['kick', 'snare', 'clap', 'hat', 'openhat', 'perc'] },
  { file: '808.mid', tracks: ['808'] },
  { file: 'melody.mid', tracks: ['melody', 'counter', 'lead'] },
  { file: 'chords.mid', tracks: ['chords'] },
  { file: 'pad.mid', tracks: ['pad'] },
];

/** Costruisce tutti i file MIDI del beat (per gruppo + full_beat). */
/**
 * Un file MIDI per ogni strumento: si trascina direttamente sul canale
 * corrispondente del Channel Rack di FL Studio.
 */
export function buildPerTrackMidiFiles(beat: Beat): MidiBundleFile[] {
  const byTrack = notesByTrack(beat);
  const options = { bpm: beat.meta.bpm, ppq: PPQ, name: beat.name };
  const files: MidiBundleFile[] = [];

  TRACKS.forEach((track, index) => {
    const notes = byTrack.get(track.id);
    if (!notes?.length) return;
    const slug = track.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    files.push({
      name: `${String(index + 1).padStart(2, '0')}_${slug}.mid`,
      data: writeMidiFile([trackSpec(track.id, notes)], options),
    });
  });

  return files;
}

export function buildMidiFiles(beat: Beat): MidiBundleFile[] {
  const byTrack = notesByTrack(beat);
  const files: MidiBundleFile[] = [];
  const options = { bpm: beat.meta.bpm, ppq: PPQ, name: beat.name };

  for (const group of GROUPS) {
    const specs = group.tracks
      .filter((t) => (byTrack.get(t)?.length ?? 0) > 0)
      .map((t) => trackSpec(t, byTrack.get(t)!));
    if (!specs.length) continue;
    files.push({ name: group.file, data: writeMidiFile(specs, options) });
  }

  const allSpecs = TRACKS.map((t) => t.id)
    .filter((t) => (byTrack.get(t)?.length ?? 0) > 0)
    .map((t) => trackSpec(t, byTrack.get(t)!));
  if (allSpecs.length) {
    files.push({ name: 'full_beat.mid', data: writeMidiFile(allSpecs, options) });
  }

  return files;
}
