import { PPQ, TICKS_PER_BAR } from '../types';
import type { NoteEvent } from '../types';
import { chordAtBar, chordIndexAtBar } from '../music/progressions';
import { chordPitches, chordRootMidi, voiceLead } from '../music/theory';
import { uid } from '../utils/id';
import { STEP, velocityFor } from './context';
import type { GenContext } from './context';

export type ChordStyle = 'sustain' | 'stab' | 'arp';

/**
 * Armonia di servizio: crea l'atmosfera senza rubare la scena alla melodia.
 * Pochi accordi, voicing stretti, e in hard trap spesso solo due voci.
 */

/** Celle per gli stab: corte e sincopate. */
const STAB_CELLS: number[][] = [
  [0, 10],
  [0, 6, 10],
  [0, 8],
  [2, 10],
  [0, 6, 14],
];

export function pickChordStyle(rng: GenContext['rng'], weights: [number, number, number]): ChordStyle {
  return rng.weighted([
    ['sustain', weights[0]],
    ['stab', weights[1]],
    ['arp', weights[2]],
  ] as const);
}

export interface HarmonyResult {
  chords: NoteEvent[];
  pad: NoteEvent[];
}

export function generateHarmony(ctx: GenContext, style: ChordStyle): HarmonyResult {
  const { rng, meta, params, bars, startBar } = ctx;
  const chords: NoteEvent[] = [];
  const pad: NoteEvent[] = [];
  let previousVoicing: number[] | null = null;

  // Con hardness alta il voicing si stringe: fondamentale e quinta, come un power chord.
  const narrow = params.hardness > 0.65;

  let bar = 0;
  while (bar < bars) {
    const chord = chordAtBar(meta.progression, startBar + bar);
    const chordIdx = chordIndexAtBar(meta.progression, startBar + bar);

    let span = 1;
    while (bar + span < bars && chordIndexAtBar(meta.progression, startBar + bar + span) === chordIdx) span++;

    const root = chordRootMidi(meta.rootPc, meta.scaleId, chord, 3);
    const tones = chordPitches(root, chord.quality);
    const voicing = voiceLead(narrow ? [tones[0], tones[tones.length - 1]] : tones, previousVoicing, 52, 79);
    previousVoicing = voicing;

    const barTick = bar * TICKS_PER_BAR;
    const spanTicks = span * TICKS_PER_BAR;

    if (style === 'sustain') {
      for (const p of voicing) {
        chords.push({ id: uid('h'), t: barTick, d: Math.round(spanTicks - STEP * 0.25), p, v: velocityFor(ctx, 0.5) });
      }
    } else if (style === 'stab') {
      const cell = rng.pick(STAB_CELLS);
      for (let b = 0; b < span; b++) {
        for (const s of cell) {
          if (s !== cell[0] && rng.chance(0.25)) continue;
          const t = barTick + b * TICKS_PER_BAR + s * STEP;
          for (const p of voicing) {
            chords.push({ id: uid('h'), t, d: Math.round(STEP * rng.float(1.2, 2.2)), p, v: velocityFor(ctx, s === 0 ? 0.7 : 0.52) });
          }
        }
      }
    } else {
      const pattern = rng.pick([
        [0, 1, 0, 1],
        [0, 1, 2, 1],
        [0, 2, 1, 2],
      ]);
      const rate = STEP * 2;
      const count = Math.round(spanTicks / rate);
      for (let i = 0; i < count; i++) {
        if (rng.chance(0.18 + params.space * 0.2)) continue;
        const idx = pattern[i % pattern.length] % voicing.length;
        chords.push({
          id: uid('h'),
          t: barTick + i * rate,
          d: Math.round(rate * 0.9),
          p: voicing[idx],
          v: velocityFor(ctx, i % 4 === 0 ? 0.65 : 0.48),
        });
      }
    }

    // Pad: tappeto largo e discreto, al massimo quattro voci.
    const padVoicing = Array.from(new Set([voicing[0] - 12, ...voicing]))
      .filter((p) => p >= 36 && p <= 88)
      .slice(0, 4);
    for (const p of padVoicing) {
      pad.push({
        id: uid('p'),
        t: barTick,
        d: Math.round(spanTicks - STEP * 0.2),
        p,
        v: Math.max(22, Math.round(velocityFor(ctx, 0.34) * 0.85)),
      });
    }

    bar += span;
  }

  if (chords.length && rng.chance(0.3)) {
    const lastTick = Math.max(...chords.map((n) => n.t));
    for (const n of chords) if (n.t === lastTick) n.d = Math.max(PPQ, Math.round(n.d * 0.65));
  }

  return { chords, pad };
}
