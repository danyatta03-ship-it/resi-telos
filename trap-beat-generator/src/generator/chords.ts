import { PPQ, TICKS_PER_BAR } from '../types';
import type { NoteEvent } from '../types';
import { chordAtBar, chordIndexAtBar } from '../music/progressions';
import { chordPitches, chordRootMidi, voiceLead } from '../music/theory';
import { uid } from '../utils/id';
import { STEP, velocityFor } from './context';
import type { GenContext } from './context';

export type ChordStyle = 'sustain' | 'stab' | 'arp';

/** Celle ritmiche per gli stab di accordi. */
const STAB_CELLS: number[][] = [
  [0, 6, 10],
  [0, 4, 10, 14],
  [0, 3, 8, 11],
  [0, 8],
  [2, 6, 10, 14],
  [0, 6, 8, 14],
];

export function pickChordStyle(ctx: GenContext): ChordStyle {
  const [sustain, stab, arp] = ctx.profile.chordStyleWeights;
  return ctx.rng.weighted([
    ['sustain', sustain],
    ['stab', stab],
    ['arp', arp],
  ] as const);
}

export interface HarmonyResult {
  chords: NoteEvent[];
  pad: NoteEvent[];
  style: ChordStyle;
}

export function generateHarmony(ctx: GenContext, style: ChordStyle): HarmonyResult {
  const { rng, meta, bars, startBar, profile, variation } = ctx;
  const chords: NoteEvent[] = [];
  const pad: NoteEvent[] = [];
  let previousVoicing: number[] | null = null;

  let bar = 0;
  while (bar < bars) {
    const chord = chordAtBar(meta.progression, startBar + bar);
    const chordIdx = chordIndexAtBar(meta.progression, startBar + bar);

    // Quante battute dura questo accordo all'interno della sezione.
    let span = 1;
    while (
      bar + span < bars &&
      chordIndexAtBar(meta.progression, startBar + bar + span) === chordIdx
    ) {
      span++;
    }

    const root = chordRootMidi(meta.rootPc, meta.scaleId, chord, 3);
    const tones = chordPitches(root, chord.quality);
    const voicing = voiceLead(tones, previousVoicing, 52, 79);
    previousVoicing = voicing;

    const barTick = bar * TICKS_PER_BAR;
    const spanTicks = span * TICKS_PER_BAR;

    if (style === 'sustain') {
      for (const p of voicing) {
        chords.push({
          id: uid('h'),
          t: barTick,
          d: Math.round(spanTicks - STEP * 0.25),
          p,
          v: velocityFor(ctx, 0.6),
        });
      }
    } else if (style === 'stab') {
      const cell = rng.pick(STAB_CELLS);
      for (let b = 0; b < span; b++) {
        for (const s of cell) {
          if (s !== cell[0] && rng.chance(0.18 + variation * 0.2)) continue;
          const t = barTick + b * TICKS_PER_BAR + s * STEP;
          const dur = STEP * rng.float(1.1, 2.4);
          const accent = s === 0 ? 0.78 : 0.58;
          for (const p of voicing) {
            chords.push({ id: uid('h'), t, d: Math.round(dur), p, v: velocityFor(ctx, accent) });
          }
        }
      }
    } else {
      const pattern = rng.pick([
        [0, 1, 2, 1],
        [0, 2, 1, 2],
        [0, 1, 2, 3],
        [2, 1, 0, 1],
      ]);
      const rate = rng.chance(0.5 + variation * 0.3) ? STEP : STEP * 2;
      const stepsCount = Math.round(spanTicks / rate);
      for (let i = 0; i < stepsCount; i++) {
        if (rng.chance(0.08 + variation * 0.12)) continue;
        const idx = pattern[i % pattern.length] % voicing.length;
        const p = voicing[idx] + (i % 8 === 7 && rng.chance(0.3) ? 12 : 0);
        chords.push({
          id: uid('h'),
          t: barTick + i * rate,
          d: Math.round(rate * rng.float(0.7, 1.3)),
          p,
          v: velocityFor(ctx, i % 4 === 0 ? 0.72 : 0.52),
        });
      }
    }

    // Pad: voicing largo e tenuto, sotto gli accordi.
    const padVoicing = Array.from(
      new Set([voicing[0] - 12, ...voicing, (voicing[voicing.length - 1] ?? root) + 12]),
    ).filter((p) => p >= 36 && p <= 92);
    for (const p of padVoicing) {
      pad.push({
        id: uid('p'),
        t: barTick,
        d: Math.round(spanTicks - STEP * 0.2),
        p,
        v: Math.max(20, Math.round(velocityFor(ctx, 0.42) * (0.7 + profile.pad * 0.3))),
      });
    }

    bar += span;
  }

  // Piccolo respiro: l'ultimo accordo della sezione puo' chiudere prima.
  if (chords.length && rng.chance(0.25)) {
    const lastTick = Math.max(...chords.map((n) => n.t));
    for (const n of chords) {
      if (n.t === lastTick) n.d = Math.max(PPQ, Math.round(n.d * 0.7));
    }
  }

  return { chords, pad, style };
}
