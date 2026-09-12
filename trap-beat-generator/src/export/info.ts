import { TRACK_MAP } from '../types';
import type { Beat, TrackId } from '../types';
import { buildSchedule } from '../audio/schedule';
import { MOODS } from '../music/moods';
import { progressionLabel } from '../music/progressions';
import { NOTE_NAMES, SCALES, chordLabel, keyLabel, pitchClass } from '../music/theory';

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
    'PROGETTO FL STUDIO (SPERIMENTALE)',
    '---------------------------------',
    'La cartella /flstudio contiene un file .flp con tempo, un pattern per sezione,',
    'la playlist gia\u2019 montata e un canale per strumento.',
    'I canali arrivano vuoti: caricaci i tuoi campioni e plugin.',
    'Il formato .flp non e\u2019 documentato da Image-Line: se la tua versione di FL',
    'non lo aprisse, usa i file MIDI, che restano la via di import garantita.',
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

