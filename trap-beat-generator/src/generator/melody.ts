import { PPQ, TICKS_PER_BAR } from '../types';
import type { NoteEvent } from '../types';
import { chordAtBar } from '../music/progressions';
import { chordPitchClasses, pitchClass, scalePitch } from '../music/theory';
import { uid } from '../utils/id';
import { STEP, STEPS_PER_BAR, clampPitch, velocityFor } from './context';
import type { GenContext } from './context';

interface MotifNote {
  /** Posizione in sedicesimi dall'inizio del motivo. */
  step: number;
  /** Durata in sedicesimi. */
  len: number;
  /** Grado della scala relativo al centro melodico. */
  degree: number;
  accent: number;
}

export interface Motif {
  bars: number;
  notes: MotifNote[];
}

/** Celle ritmiche tipiche della trap (in sedicesimi, su una battuta). */
const RHYTHM_CELLS: number[][] = [
  [0, 3, 6, 10],
  [0, 2, 4, 6, 8, 12],
  [0, 3, 4, 7, 10, 11],
  [0, 4, 6, 10, 12],
  [0, 2, 3, 8, 10],
  [0, 6, 8, 14],
  [0, 1, 2, 6, 8, 9, 10],
  [0, 4, 8, 12],
  [2, 4, 7, 10, 12],
  [0, 3, 7, 8, 11, 14],
  [0, 5, 8, 13],
  [0, 2, 6, 8, 10, 14],
];

function buildRhythm(ctx: GenContext, bars: number): number[] {
  const { rng, profile, variation } = ctx;
  const steps: number[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const cell = rng.pick(RHYTHM_CELLS);
    const keep = profile.melodyDensity * (0.75 + variation * 0.5);
    for (const s of cell) {
      if (s !== cell[0] && rng.chance(profile.rest * 0.55 * (1 - variation * 0.35))) continue;
      if (!rng.chance(Math.min(1, 0.45 + keep))) continue;
      steps.push(bar * STEPS_PER_BAR + s);
    }
    // Nota extra fuori griglia quando la variation e' alta.
    if (rng.chance(variation * 0.5)) steps.push(bar * STEPS_PER_BAR + rng.pick([5, 9, 11, 13, 15]));
  }
  const unique = Array.from(new Set(steps)).sort((a, b) => a - b);
  return unique.length ? unique : [0, 6, 10];
}

/** Costruisce il motivo base: ritmo + contorno melodico. */
export function buildMotif(ctx: GenContext, bars: number): Motif {
  const { rng, profile, variation } = ctx;
  const steps = buildRhythm(ctx, bars);
  const notes: MotifNote[] = [];
  let degree = rng.pick([0, 0, 2, 4, -3]);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const nextStep = steps[i + 1] ?? bars * STEPS_PER_BAR;
    const maxLen = Math.max(1, nextStep - step);
    const sustain = profile.melodySustain * (1 - variation * 0.25);
    const len = Math.max(1, Math.min(maxLen, Math.round(maxLen * (0.45 + sustain * 0.75))));

    notes.push({
      step,
      len,
      degree,
      accent: step % 4 === 0 ? 0.85 : step % 2 === 0 ? 0.65 : 0.5,
    });

    // Passo successivo: gradi congiunti o salti, secondo il mood.
    const leap = rng.chance(profile.leap * (0.6 + variation * 0.6));
    const delta = leap ? rng.pick([-4, -3, 3, 4, 5, -5]) : rng.pick([-2, -1, -1, 1, 1, 2]);
    degree += delta;
    if (degree > 7) degree -= rng.pick([5, 7]);
    if (degree < -6) degree += rng.pick([5, 7]);
  }

  return { bars, notes };
}

type VariationKind = 'exact' | 'transpose' | 'rhythm' | 'ornament' | 'invert' | 'tail';

function varyMotif(ctx: GenContext, motif: Motif, kind: VariationKind): Motif {
  const { rng } = ctx;
  const bars = motif.bars;
  const total = bars * STEPS_PER_BAR;
  let notes = motif.notes.map((n) => ({ ...n }));

  switch (kind) {
    case 'transpose': {
      const shift = rng.pick([-3, -2, -1, 1, 2, 3]);
      notes = notes.map((n) => ({ ...n, degree: n.degree + shift }));
      break;
    }
    case 'rhythm': {
      const shift = rng.pick([-2, -1, 1, 2]);
      notes = notes
        .map((n) => ({ ...n, step: n.step + shift }))
        .filter((n) => n.step >= 0 && n.step < total);
      break;
    }
    case 'ornament': {
      const extra: MotifNote[] = [];
      for (const n of notes) {
        if (n.len > 2 && rng.chance(0.4)) {
          extra.push({ step: n.step + Math.max(1, Math.floor(n.len / 2)), len: 1, degree: n.degree + rng.pick([-1, 1, 2]), accent: 0.45 });
        }
      }
      notes = notes.concat(extra).sort((a, b) => a.step - b.step);
      break;
    }
    case 'invert': {
      const pivot = notes[0]?.degree ?? 0;
      notes = notes.map((n) => ({ ...n, degree: pivot - (n.degree - pivot) }));
      break;
    }
    case 'tail': {
      const cut = Math.max(1, notes.length - rng.int(1, 2));
      notes = notes.slice(0, cut);
      if (notes.length) {
        const last = notes[notes.length - 1];
        last.len = Math.min(total - last.step, last.len + rng.int(2, 6));
      }
      break;
    }
    default:
      break;
  }
  return { bars, notes };
}

/** Sequenza di varianti su tutta la sezione, in stile A - A' - B - A''. */
function motifPlan(ctx: GenContext, blocks: number): VariationKind[] {
  const { rng, profile, variation } = ctx;
  const repeat = profile.motifRepeat * (1 - variation * 0.4);
  const plan: VariationKind[] = ['exact'];
  for (let i = 1; i < blocks; i++) {
    if (i % 2 === 1) {
      plan.push(rng.chance(repeat) ? 'exact' : rng.pick(['ornament', 'tail', 'rhythm']));
    } else {
      plan.push(rng.weighted([
        ['transpose', 3],
        ['invert', 1 + variation * 2],
        ['exact', repeat * 3],
        ['rhythm', 1 + variation],
      ] as const));
    }
  }
  return plan;
}

function snapToChordTone(pitch: number, pcs: number[]): number {
  let best = pitch;
  let bestDist = Infinity;
  for (let delta = -3; delta <= 3; delta++) {
    const cand = pitch + delta;
    if (!pcs.includes(pitchClass(cand))) continue;
    if (Math.abs(delta) < bestDist) {
      bestDist = Math.abs(delta);
      best = cand;
    }
  }
  return best;
}

export interface MelodyOptions {
  octaveOffset?: number;
  /** Moltiplicatore di densita' (per la counter melody). */
  densityScale?: number;
  /** Probabilita' di agganciare le note forti alle note dell'accordo. */
  chordLock?: number;
  velocityScale?: number;
}

/** Rende un motivo in note MIDI vere lungo tutta la sezione. */
export function generateMelody(ctx: GenContext, motif: Motif, opts: MelodyOptions = {}): NoteEvent[] {
  const { rng, meta, profile, bars, startBar, variation } = ctx;
  const octaveOffset = opts.octaveOffset ?? 0;
  const chordLock = opts.chordLock ?? 0.75;
  const densityScale = opts.densityScale ?? 1;
  const velocityScale = opts.velocityScale ?? 1;

  const centerRoot = 12 * (profile.melodyOctave + 1 + octaveOffset) + pitchClass(meta.rootPc);
  const blocks = Math.max(1, Math.ceil(bars / motif.bars));
  const plan = motifPlan(ctx, blocks);
  const notes: NoteEvent[] = [];

  for (let block = 0; block < blocks; block++) {
    const variant = varyMotif(ctx, motif, plan[block]);
    const blockStartBar = block * motif.bars;

    for (const mn of variant.notes) {
      const bar = blockStartBar + Math.floor(mn.step / STEPS_PER_BAR);
      if (bar >= bars) continue;
      if (densityScale < 1 && !rng.chance(densityScale)) continue;

      const tick = blockStartBar * TICKS_PER_BAR + mn.step * STEP;
      const chord = chordAtBar(meta.progression, startBar + bar);
      const pcs = chordPitchClasses(meta.rootPc, meta.scaleId, chord);

      let pitch = scalePitch(centerRoot, meta.scaleId, mn.degree);
      const strong = mn.step % 4 === 0;
      if ((strong && rng.chance(chordLock)) || rng.chance(chordLock * 0.3)) {
        pitch = snapToChordTone(pitch, pcs);
      }

      const duration = Math.max(STEP * 0.5, mn.len * STEP - STEP * 0.08);
      notes.push({
        id: uid('m'),
        t: tick,
        d: Math.round(duration),
        p: clampPitch(pitch, 48, 100),
        v: Math.max(20, Math.min(127, Math.round(velocityFor(ctx, mn.accent) * velocityScale))),
      });
    }
  }

  // Chiusura: l'ultima nota lunga cade spesso su una nota dell'accordo.
  if (notes.length && rng.chance(0.6 + variation * 0.2)) {
    const last = notes[notes.length - 1];
    const chord = chordAtBar(meta.progression, startBar + Math.floor(last.t / TICKS_PER_BAR));
    last.p = snapToChordTone(last.p, chordPitchClasses(meta.rootPc, meta.scaleId, chord));
    last.d = Math.max(last.d, PPQ);
  }

  return notes.sort((a, b) => a.t - b.t);
}

/** Counter melody: riempie i vuoti lasciati dalla melodia principale. */
export function generateCounter(ctx: GenContext, melody: NoteEvent[]): NoteEvent[] {
  const { rng, meta, profile, bars, startBar, variation } = ctx;
  const notes: NoteEvent[] = [];
  const centerRoot = 12 * (profile.melodyOctave + (rng.chance(0.6) ? 0 : 1)) + pitchClass(meta.rootPc);
  const occupied = melody.map((n) => [n.t, n.t + n.d] as const);

  const gridStep = STEP * 2;
  for (let bar = 0; bar < bars; bar++) {
    const chord = chordAtBar(meta.progression, startBar + bar);
    const pcs = chordPitchClasses(meta.rootPc, meta.scaleId, chord);
    for (let s = 0; s < STEPS_PER_BAR; s += 2) {
      const t = bar * TICKS_PER_BAR + s * STEP;
      const busy = occupied.some(([a, b]) => t >= a - STEP && t < b);
      if (busy) continue;
      if (!rng.chance(0.22 + profile.counter * 0.3 + variation * 0.15)) continue;
      const degree = rng.pick([-3, -2, 0, 2, 3, 4]);
      const pitch = snapToChordTone(scalePitch(centerRoot, meta.scaleId, degree), pcs);
      notes.push({
        id: uid('c'),
        t,
        d: Math.round(gridStep * rng.float(0.7, 1.8)),
        p: clampPitch(pitch, 45, 95),
        v: velocityFor(ctx, 0.5),
      });
    }
  }
  return notes.sort((a, b) => a.t - b.t);
}

/** Lead: raddoppia gli accenti della melodia un'ottava sopra, note corte. */
export function generateLead(ctx: GenContext, melody: NoteEvent[]): NoteEvent[] {
  const { rng } = ctx;
  return melody
    .filter((n) => n.v > 70 && rng.chance(0.55))
    .map((n) => ({
      id: uid('l'),
      t: n.t,
      d: Math.max(STEP * 0.6, Math.min(n.d, STEP * 2)),
      p: clampPitch(n.p + 12, 55, 108),
      v: Math.max(20, Math.round(n.v * 0.82)),
    }));
}
