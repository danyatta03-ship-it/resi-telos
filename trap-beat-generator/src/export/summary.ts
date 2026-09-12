import { DRUM_TRACKS, TICKS_PER_BAR, TRACKS, TRACK_MAP } from '../types';
import type { Beat, NoteEvent, Section, TrackId } from '../types';
import { MOODS } from '../music/moods';
import { chordAtBar, progressionLabel } from '../music/progressions';
import { chordLabel, keyLabel, noteName } from '../music/theory';

const STEP = TICKS_PER_BAR / 16;
const MAX_MELODY_LINES = 48;

/** Griglia ASCII di una traccia di batteria, 16 step per battuta. */
function drumGrid(notes: NoteEvent[], bars: number): string {
  const cells: string[] = [];
  for (let bar = 0; bar < bars; bar++) {
    let row = '';
    for (let step = 0; step < 16; step++) {
      const from = bar * TICKS_PER_BAR + step * STEP;
      const hits = notes.filter((n) => n.t >= from && n.t < from + STEP);
      if (!hits.length) row += '.';
      else if (hits.length > 1) row += String(Math.min(9, hits.length));
      else row += hits[0].v >= 100 ? 'X' : 'x';
    }
    cells.push(row);
  }
  return cells.join('|');
}

/** Posizione leggibile: battuta.movimento.sedicesimo, tutto 1-based. */
function positionLabel(tick: number): string {
  const bar = Math.floor(tick / TICKS_PER_BAR) + 1;
  const inBar = tick % TICKS_PER_BAR;
  const beat = Math.floor(inBar / (TICKS_PER_BAR / 4)) + 1;
  const step = Math.floor((inBar % (TICKS_PER_BAR / 4)) / STEP) + 1;
  return `${String(bar).padStart(2)}.${beat}.${step}`;
}

function durationLabel(ticks: number): string {
  const sixteenths = ticks / STEP;
  if (sixteenths >= 16) return `${(sixteenths / 16).toFixed(1)} bar`;
  if (sixteenths >= 1) return `${Math.round(sixteenths)}/16`;
  return '1/32';
}

/**
 * Scheda testuale del beat da tenere accanto a FL Studio mentre si ricostruisce
 * o si controlla quello che si e' importato.
 */
export function buildStructureText(beat: Beat, sectionId?: string): string {
  const { meta } = beat;
  const section: Section =
    beat.sections.find((s) => s.id === sectionId) ??
    beat.sections.find((s) => s.kind === 'HOOK') ??
    beat.sections[0];

  const totalBars = beat.sections.reduce((sum, s) => sum + s.bars, 0);
  const lines: string[] = [];

  lines.push(`TRAP BEAT - ${beat.name}`);
  lines.push(
    `${keyLabel(meta.rootPc, meta.scaleId)} | ${meta.bpm} BPM | ${meta.moods
      .map((m) => MOODS[m]?.label ?? m)
      .join(' + ')} | ${totalBars} battute`,
  );
  lines.push(
    `Progressione: ${progressionLabel(meta.progression)}  ->  ${meta.progression
      .map((c) => chordLabel(meta.rootPc, meta.scaleId, c))
      .join(' - ')}`,
  );
  lines.push('');

  lines.push('STRUTTURA');
  let startBar = 0;
  beat.sections.forEach((s, i) => {
    const active = TRACKS.filter((t) => (s.clips[t.id]?.length ?? 0) > 0).map((t) => t.label);
    lines.push(
      `${String(i + 1).padStart(2, '0')}. ${s.name.padEnd(12)} ${String(s.bars).padStart(2)} bar  ` +
        `(bar ${startBar + 1}-${startBar + s.bars})  ${active.join(', ')}`,
    );
    startBar += s.bars;
  });
  lines.push('');

  // Accordi battuta per battuta, sul ciclo della progressione.
  const cycle = meta.progression.reduce((sum, c) => sum + c.bars, 0) || 1;
  const chordRow: string[] = [];
  for (let bar = 0; bar < cycle; bar++) {
    chordRow.push(`bar ${bar + 1}: ${chordLabel(meta.rootPc, meta.scaleId, chordAtBar(meta.progression, bar))}`);
  }
  lines.push(`ACCORDI (ciclo di ${cycle} battute, si ripete)`);
  lines.push(chordRow.join('  |  '));
  lines.push('');

  lines.push(`DRUM PATTERN - ${section.name} (1/16, X = accento, numero = roll)`);
  for (const trackId of DRUM_TRACKS as TrackId[]) {
    const notes = section.clips[trackId] ?? [];
    if (!notes.length) continue;
    lines.push(`${TRACK_MAP[trackId].label.padEnd(9)} ${drumGrid(notes, Math.min(section.bars, 4))}`);
  }
  lines.push('');

  for (const trackId of ['808', 'melody', 'chords'] as TrackId[]) {
    const notes = section.clips[trackId] ?? [];
    if (!notes.length) continue;
    lines.push(`${TRACK_MAP[trackId].label.toUpperCase()} - ${section.name} (bar.movimento.step)`);
    const shown = notes.slice(0, MAX_MELODY_LINES);
    for (const note of shown) {
      lines.push(
        `  ${positionLabel(note.t)}  ${noteName(note.p).padEnd(4)} ${durationLabel(note.d).padEnd(7)} vel ${note.v}` +
          (note.slide ? '  slide' : ''),
      );
    }
    if (notes.length > shown.length) lines.push(`  ... e altre ${notes.length - shown.length} note`);
    lines.push('');
  }

  lines.push('COME PORTARLO IN FL STUDIO');
  lines.push('- Il modo rapido: trascina full_beat.mid nella playlist e scegli "Import to new channels".');
  lines.push('- Uno strumento alla volta: i file in /midi/strumenti si trascinano sul singolo canale.');
  lines.push(`- Imposta il tempo del progetto a ${meta.bpm} BPM.`);
  lines.push('- Questa scheda serve come riferimento: FL non accetta testo incollato nel piano roll.');

  return lines.join('\n');
}
