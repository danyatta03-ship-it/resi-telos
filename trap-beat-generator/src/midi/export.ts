import { zipSync, strToU8 } from 'fflate';
import { PPQ, TRACK_MAP, TRACKS } from '../types';
import type { Beat, TrackId } from '../types';
import { buildSchedule } from '../audio/schedule';
import { MOODS } from '../music/moods';
import { progressionLabel } from '../music/progressions';
import { NOTE_NAMES, SCALES, chordLabel, keyLabel, pitchClass } from '../music/theory';
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

/** File di testo con tutte le informazioni musicali del beat. */
export function buildInfoText(beat: Beat): string {
  const { meta } = beat;
  const scale = SCALES[meta.scaleId];
  const scaleNotes = scale.steps.map((s) => NOTE_NAMES[pitchClass(meta.rootPc + s)]).join(' - ');
  const schedule = buildSchedule(beat);
  const totalBars = beat.sections.reduce((s, sec) => s + sec.bars, 0);
  const seconds = (totalBars * 4 * 60) / meta.bpm;

  const lines: string[] = [
    'TRAP BEAT GENERATOR - BEAT INFO',
    '================================',
    '',
    `Nome:        ${beat.name}`,
    `BPM:         ${meta.bpm}`,
    `Key:         ${keyLabel(meta.rootPc, meta.scaleId)}`,
    `Scale:       ${scale.label} (${scaleNotes})`,
    `Mood:        ${meta.moods.map((m) => MOODS[m]?.label ?? m).join(' + ')}`,
    `Progression: ${progressionLabel(meta.progression)}`,
    `Accordi:     ${meta.progression.map((c) => `${chordLabel(meta.rootPc, meta.scaleId, c)} (${c.bars} bar)`).join(' | ')}`,
    `Variation:   ${meta.variation}%`,
    `Humanize:    ${meta.humanize}%`,
    `Lunghezza:   ${totalBars} battute (~${Math.round(seconds)}s)`,
    `Seed:        ${meta.seed}`,
    '',
    'STRUTTURA',
    '---------',
  ];

  beat.sections.forEach((section, i) => {
    const range = schedule.sections[i];
    const active = (Object.keys(section.clips) as TrackId[])
      .filter((t) => (section.clips[t]?.length ?? 0) > 0)
      .map((t) => TRACK_MAP[t]?.label ?? t);
    lines.push(
      `${String(i + 1).padStart(2, '0')}. ${section.name.padEnd(12)} ${String(section.bars).padStart(2)} bars  ` +
        `(bar ${range.startBar + 1}-${range.startBar + section.bars})  ->  ${active.join(', ') || 'vuota'}`,
    );
  });

  lines.push(
    '',
    'FILE MIDI',
    '---------',
    'drums.mid      kick, snare, clap, hi-hat, open hat, perc (canale 10)',
    '808.mid        linea di 808 con pitch bend per gli slide (range 12 semitoni)',
    'melody.mid     main melody, counter melody, lead',
    'chords.mid     progressione armonica',
    'pad.mid        pad / atmosfera',
    'full_beat.mid  tutte le tracce insieme',
    '',
    'COME IMPORTARE IN FL STUDIO',
    '---------------------------',
    '1. File > Import > MIDI file, oppure trascina il .mid nella playlist.',
    '2. Scegli "Import to new channels" per avere una traccia per strumento.',
    '3. Imposta il tempo del progetto sul BPM indicato sopra.',
    "4. Per l'808 abilita il portamento/glide dello strumento per sentire gli slide.",
    '',
    'Generato con Trap Beat Generator.',
  );

  return lines.join('\n');
}

export function beatFileBase(beat: Beat): string {
  const key = `${NOTE_NAMES[pitchClass(beat.meta.rootPc)].replace('#', 'sharp')}${SCALES[beat.meta.scaleId].minorish ? 'Minor' : 'Major'}`;
  return `TrapBeat_${beat.meta.bpm}BPM_${key}`;
}

/** Pacchetto ZIP con /midi e /text, pronto da aprire in FL Studio. */
export function buildZip(beat: Beat): Uint8Array {
  const files = buildMidiFiles(beat);
  const midi: Record<string, Uint8Array> = {};
  for (const file of files) midi[file.name] = file.data;

  return zipSync(
    {
      midi,
      text: {
        'beat-info.txt': strToU8(buildInfoText(beat)),
      },
    },
    { level: 6 },
  );
}
