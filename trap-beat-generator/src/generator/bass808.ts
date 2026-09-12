import { TICKS_PER_BAR } from '../types';
import type { NoteEvent } from '../types';
import { chordAtBar } from '../music/progressions';
import { chordPitches, chordRootMidi } from '../music/theory';
import { uid } from '../utils/id';
import { STEP, STEPS_PER_BAR, clampPitch, velocityFor } from './context';
import type { GenContext } from './context';
import type { Groove } from './groove';
import { inSilence } from './space';
import type { SilenceWindow } from './space';

const LOW = 24;
const HIGH = 47;

/**
 * 808: poche note, sempre in tonalita', agganciate al groove condiviso.
 *
 * Meglio "BOOM - - BOOM - BOOM" che una sequenza continua: la linea deve
 * lasciare respirare la cassa e la voce.
 */
export function generate808(ctx: GenContext, groove: Groove, windows: SilenceWindow[]): NoteEvent[] {
  const { rng, params, meta, bars, startBar, section } = ctx;
  const notes: NoteEvent[] = [];

  interface Onset {
    tick: number;
    bar: number;
    accent: boolean;
  }

  // Il groove di due battute viene steso su tutta la sezione.
  const onsets: Onset[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const grooveBar = bar % 2;
    for (const onset of groove.bass) {
      if (Math.floor(onset.step / STEPS_PER_BAR) !== grooveBar) continue;
      const local = onset.step % STEPS_PER_BAR;
      // Nelle sezioni scariche l'808 suona meno, ma il primo colpo resta.
      if (!onset.accent && !rng.chance(0.55 + section.energy * 0.45)) continue;
      const tick = bar * TICKS_PER_BAR + local * STEP;
      // Nelle finestre di silenzio anche l'808 si ferma: e' li' che il beat respira.
      if (inSilence(windows, tick)) continue;
      onsets.push({ tick, bar, accent: onset.accent });
    }
  }
  if (!onsets.length) return [];
  onsets.sort((a, b) => a.tick - b.tick);

  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i];
    const chord = chordAtBar(meta.progression, startBar + onset.bar);
    const root = chordRootMidi(meta.rootPc, meta.scaleId, chord, 1);
    const tones = chordPitches(root, chord.quality);

    // La fondamentale domina: e' quello che rende la linea riconoscibile.
    let pitch = root;
    if (!onset.accent) {
      const choice = rng.weighted([
        ['root', 7],
        ['fifth', 1.2 + params.hardness],
        ['third', 0.6],
      ] as const);
      if (choice === 'fifth') pitch = tones[tones.length > 2 ? 2 : 0] ?? root + 7;
      else if (choice === 'third') pitch = tones[1] ?? root + 3;
    }
    if (!onset.accent && rng.chance(params.octaveJump)) pitch += 12;
    while (pitch > HIGH) pitch -= 12;
    while (pitch < LOW) pitch += 12;

    const next = onsets[i + 1];
    const gap = (next ? next.tick : bars * TICKS_PER_BAR) - onset.tick;
    const sustain = params.bassSustain;
    let duration: number;
    if (sustain > 0.62) duration = Math.max(STEP, gap - STEP * 0.15);
    else if (sustain > 0.4) duration = Math.max(STEP, Math.min(gap - STEP * 0.25, STEP * 6));
    else duration = Math.max(STEP * 0.9, Math.min(gap * 0.6, STEP * 3));

    const slide =
      !!next &&
      gap <= STEP * 6 &&
      duration >= gap - STEP * 0.4 &&
      rng.chance(params.slide * 0.8);

    notes.push({
      id: uid('b'),
      t: onset.tick,
      d: Math.round(duration),
      p: clampPitch(pitch, LOW, HIGH),
      v: velocityFor(ctx, onset.accent ? 1 : 0.8),
      slide: slide || undefined,
    });
  }

  return notes.sort((a, b) => a.t - b.t);
}
