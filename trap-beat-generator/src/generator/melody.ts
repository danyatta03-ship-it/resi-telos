import { TICKS_PER_BAR } from '../types';
import type { NoteEvent, ScaleId } from '../types';
import { SCALES, chordPitchClasses, pitchClass, scalePitch } from '../music/theory';
import { chordAtBar } from '../music/progressions';
import type { GenParams } from '../music/params';
import type { Rng } from '../music/rng';
import { uid } from '../utils/id';
import { STEP, STEPS_PER_BAR, clampPitch } from './context';
import type { GenContext } from './context';
import { inSilence } from './space';
import type { SilenceWindow } from './space';

/**
 * Motore melodico: una sola idea forte.
 *
 * Il motivo nasce da una tavolozza di 3-5 note, un ritmo scritto a mano e una
 * forma a domanda e risposta. Ogni candidato viene valutato (catchiness,
 * complessita', groove) e rigenerato se sembra una scala suonata a caso.
 */

export interface MotifNote {
  /** Posizione in sedicesimi dall'inizio del motivo. */
  step: number;
  /** Durata in sedicesimi. */
  len: number;
  /** Indice nella tavolozza. */
  tone: number;
  /** Salto di ottava rispetto alla tavolozza. */
  octave: number;
  accent: number;
}

export interface Motif {
  bars: number;
  /** Gradi della scala usati, dal piu' importante. */
  palette: number[];
  notes: MotifNote[];
  scores: MotifScores;
}

export interface MotifScores {
  catchiness: number;
  complexity: number;
  groove: number;
  attempts: number;
}

/** Ritmi di due battute tipici di un hook trap: pochi attacchi, molto respiro. */
const RHYTHM_CELLS: number[][] = [
  [0, 6, 10, 16, 22],
  [0, 4, 6, 16, 20, 22],
  [0, 3, 8, 16, 19, 24],
  [0, 10, 16, 26],
  [0, 2, 6, 16, 18, 22],
  [0, 8, 12, 16, 24],
  [0, 6, 8, 16, 22, 24],
  [2, 6, 10, 18, 22, 26],
  [0, 12, 16, 28],
  [0, 4, 10, 16, 20, 26],
  [0, 16],
  [0, 6, 16, 20, 24],
  [0, 3, 6, 16, 19, 22],
  [0, 8, 16, 20],
];

/** Posizioni su cui un attacco suona naturale in un beat trap. */
const GROOVE_POSITIONS = new Set([0, 2, 3, 4, 6, 8, 10, 11, 12, 14]);

/** Pesi dei gradi della scala: la tonica e la quinta reggono, il resto colora. */
function degreeWeights(scaleId: ScaleId): number[] {
  const length = SCALES[scaleId].steps.length;
  if (length >= 7) return [5, 1, 3, 1.6, 3.6, 1.2, 2.2];
  if (length === 6) return [5, 1.4, 2.2, 1.6, 2.4, 1.4];
  return [5, 2.4, 2, 3, 1.6];
}

function buildPalette(rng: Rng, params: GenParams, scaleId: ScaleId): number[] {
  const weights = degreeWeights(scaleId);
  const size = rng.int(params.palette[0], params.palette[1]);
  const chosen: number[] = [0]; // la tonica c'e' sempre
  const pool = weights.map((w, degree) => [degree, w] as const).filter(([d]) => d !== 0);

  while (chosen.length < size && pool.length) {
    const degree = rng.weighted(pool);
    if (!chosen.includes(degree)) chosen.push(degree);
    const index = pool.findIndex(([d]) => d === degree);
    if (index >= 0) pool.splice(index, 1);
  }
  return chosen;
}

function buildRhythm(rng: Rng, params: GenParams): number[] {
  const [minOnsets, maxOnsets] = params.onsetsPerBar;
  const targetTotal = rng.int(minOnsets * 2, maxOnsets * 2);
  const cell = rng.weighted(
    RHYTHM_CELLS.map((c) => [c, 1 / (1 + Math.abs(c.length - targetTotal))] as const),
  );

  let steps = cell.slice();
  // Il respiro si ottiene togliendo, non aggiungendo, ma serve un minimo di frase.
  steps = steps.filter((_, i) => i === 0 || !rng.chance(params.melodyRest * 0.4));
  if (steps.length < 4) steps = cell.slice(0, Math.max(4, Math.min(cell.length, 5)));
  return steps;
}

/**
 * Costruisce le note del motivo: la prima battuta e' la frase, la seconda la
 * ripete o la varia di poco. E' il meccanismo che rende il motivo memorizzabile.
 */
function buildNotes(rng: Rng, params: GenParams, palette: number[], rhythm: number[]): MotifNote[] {
  const firstBar = rhythm.filter((s) => s < STEPS_PER_BAR);
  const secondBar = rhythm.filter((s) => s >= STEPS_PER_BAR);
  const notes: MotifNote[] = [];

  // Frase iniziale: parte da un punto d'appoggio e si muove poco.
  let toneIndex = rng.chance(0.65) ? 0 : rng.int(0, Math.min(2, palette.length - 1));
  const phrase: MotifNote[] = [];
  for (let i = 0; i < firstBar.length; i++) {
    const step = firstBar[i];
    const next = firstBar[i + 1] ?? STEPS_PER_BAR;
    const maxLen = Math.max(1, next - step);
    const len = Math.max(1, Math.round(maxLen * (0.5 + params.melodySustain * 0.7)));
    phrase.push({
      step,
      len,
      tone: toneIndex,
      octave: rng.chance(params.octaveJumpMelody) ? 1 : 0,
      accent: step % 4 === 0 ? 0.9 : step % 2 === 0 ? 0.7 : 0.55,
    });

    // Movimento: spesso si resta fermi o ci si sposta di un posto nella tavolozza.
    const move = rng.weighted([
      [0, 2.2 + params.catchiness * 2],
      [1, 3],
      [-1, 2.6],
      [2, params.leap * 2.4],
      [-2, params.leap * 1.8],
    ] as const);
    toneIndex = Math.max(0, Math.min(palette.length - 1, toneIndex + move));
  }
  notes.push(...phrase);

  // Seconda battuta: ripetizione o piccola variazione della stessa frase.
  const repeat = rng.chance(params.motifRepetition);
  for (let i = 0; i < secondBar.length; i++) {
    const step = secondBar[i];
    const next = secondBar[i + 1] ?? STEPS_PER_BAR * 2;
    const maxLen = Math.max(1, next - step);
    const source = phrase[i % Math.max(1, phrase.length)];
    let tone = source ? source.tone : 0;
    if (!repeat) {
      if (i === secondBar.length - 1) tone = 0; // chiusura sulla tonica
      else if (rng.chance(0.45)) tone = Math.max(0, Math.min(palette.length - 1, tone + rng.pick([-1, 1])));
    }
    notes.push({
      step,
      len: Math.max(1, Math.round(maxLen * (0.5 + params.melodySustain * 0.8))),
      tone,
      octave: source?.octave ?? 0,
      accent: step % 4 === 0 ? 0.88 : 0.6,
    });
  }

  // Una nota lunga di chiusura aiuta a ricordare la frase.
  if (notes.length && rng.chance(0.6 + params.catchiness * 0.25)) {
    const last = notes[notes.length - 1];
    last.len = Math.max(last.len, rng.int(3, 8));
  }
  return notes.sort((a, b) => a.step - b.step);
}

/** Valuta un motivo: quanto e' orecchiabile, quanto e' complicato, quanto groova. */
export function scoreMotif(notes: MotifNote[]): MotifScores {
  if (notes.length < 2) {
    return { catchiness: 0, complexity: 1, groove: 0, attempts: 0 };
  }

  const total = notes.length;
  const distinct = new Set(notes.map((n) => `${n.tone}:${n.octave}`)).size;
  const occupied = notes.reduce((sum, n) => sum + n.len, 0);
  const restRatio = Math.max(0, 1 - occupied / (STEPS_PER_BAR * 2));

  // Ripetizione: quante note tornano su un suono gia' sentito.
  const repetition = 1 - distinct / total;

  // Auto-somiglianza fra le due battute: il cuore della riconoscibilita'.
  const firstSteps = notes.filter((n) => n.step < STEPS_PER_BAR).map((n) => n.step);
  const secondSteps = notes.filter((n) => n.step >= STEPS_PER_BAR).map((n) => n.step - STEPS_PER_BAR);
  const shared = firstSteps.filter((s) => secondSteps.includes(s)).length;
  const selfSimilarity = firstSteps.length ? shared / Math.max(firstSteps.length, secondSteps.length || 1) : 0;

  // Scale suonate di fila: il difetto piu' tipico dei generatori casuali.
  let run = 1;
  let maxRun = 1;
  for (let i = 1; i < notes.length; i++) {
    const delta = notes[i].tone - notes[i - 1].tone;
    const previous = i > 1 ? notes[i - 1].tone - notes[i - 2].tone : 0;
    if (Math.abs(delta) === 1 && delta === previous) {
      run++;
      maxRun = Math.max(maxRun, run);
    } else run = 1;
  }

  const leaps = notes.filter((n, i) => i > 0 && Math.abs(n.tone - notes[i - 1].tone) >= 3).length;
  const onGrid = notes.filter((n) => GROOVE_POSITIONS.has(n.step % STEPS_PER_BAR)).length / total;
  const syncopated = notes.filter((n) => n.step % 4 !== 0).length / total;
  const durations = new Set(notes.map((n) => n.len)).size;

  const restFit = restRatio >= 0.2 && restRatio <= 0.7 ? 1 : Math.max(0, 1 - Math.abs(restRatio - 0.45) * 2.2);
  const sizeFit = distinct <= 5 ? 1 : Math.max(0, 1 - (distinct - 5) * 0.3);

  const catchiness = Math.max(
    0,
    Math.min(
      1,
      repetition * 0.3 + selfSimilarity * 0.3 + restFit * 0.18 + sizeFit * 0.17 + (leaps <= 2 ? 0.05 : 0),
    ),
  );

  const complexity = Math.max(
    0,
    Math.min(
      1,
      Math.max(0, distinct - 4) * 0.12 +
        Math.max(0, total - 10) * 0.07 +
        Math.max(0, maxRun - 2) * 0.25 +
        Math.max(0, leaps - 2) * 0.12 +
        Math.max(0, durations - 3) * 0.08,
    ),
  );

  const groove = Math.max(0, Math.min(1, onGrid * 0.6 + Math.min(syncopated, 0.6) * 0.6));

  return { catchiness, complexity, groove, attempts: 0 };
}

/**
 * Genera il motivo del beat: prova, valuta, e rigenera finche' non e'
 * abbastanza orecchiabile e abbastanza semplice.
 */
export function buildMotif(rng: Rng, params: GenParams, scaleId: ScaleId): Motif {
  const minCatchiness = 0.42 + params.catchiness * 0.18;
  const maxComplexity = 0.5 - params.hardness * 0.12;
  const maxAttempts = 16;

  let best: Motif | null = null;
  let bestValue = -Infinity;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const palette = buildPalette(rng, params, scaleId);
    const rhythm = buildRhythm(rng, params);
    const notes = buildNotes(rng, params, palette, rhythm);
    const scores = scoreMotif(notes);
    const value = scores.catchiness * 1.2 - scores.complexity + scores.groove * 0.35;

    if (value > bestValue) {
      bestValue = value;
      best = { bars: params.motifBars, palette, notes, scores: { ...scores, attempts: attempt } };
    }
    if (scores.catchiness >= minCatchiness && scores.complexity <= maxComplexity && scores.groove > 0.3) {
      return { bars: params.motifBars, palette, notes, scores: { ...scores, attempts: attempt } };
    }
  }

  return best!;
}

export interface RenderOptions {
  /** 0-1: quante note del motivo sopravvivono in questa sezione. */
  density: number;
  octaveOffset?: number;
  velocityScale?: number;
  /** Probabilita' di agganciare all'accordo la nota che apre la battuta. */
  chordLock?: number;
  /** Finestre in cui tace anche la melodia. */
  windows?: SilenceWindow[];
}

function snapToChordTone(pitch: number, pcs: number[]): number {
  for (let delta = 0; delta <= 2; delta++) {
    if (pcs.includes(pitchClass(pitch - delta))) return pitch - delta;
    if (pcs.includes(pitchClass(pitch + delta))) return pitch + delta;
  }
  return pitch;
}

/**
 * Stende il motivo sulla sezione con lo schema A - A - A' - A: la stessa idea
 * che torna, con una variazione sola. Non quattro frasi diverse.
 */
export function renderMotif(ctx: GenContext, motif: Motif, options: RenderOptions): NoteEvent[] {
  const { rng, meta, params, bars, startBar } = ctx;
  const octaveOffset = options.octaveOffset ?? 0;
  const chordLock = options.chordLock ?? 0.7;
  const notes: NoteEvent[] = [];
  const root = 12 * (params.melodyOctave + 1 + octaveOffset) + pitchClass(meta.rootPc);
  const blocks = Math.max(1, Math.ceil(bars / motif.bars));

  for (let block = 0; block < blocks; block++) {
    // Terzo blocco variato, gli altri identici: e' cosi' che si fissa in testa.
    const varied = block % 4 === 2 ? rng.chance(0.75) : rng.chance(params.variation * 0.25);
    const blockBar = block * motif.bars;

    for (const note of motif.notes) {
      const bar = blockBar + Math.floor(note.step / STEPS_PER_BAR);
      if (bar >= bars) continue;
      if (options.density < 1 && !note.accent && !rng.chance(options.density)) continue;
      if (options.density < 1 && rng.chance((1 - options.density) * 0.35)) continue;

      let tone = note.tone;
      let octave = note.octave;
      if (varied) {
        if (rng.chance(0.35)) tone = Math.max(0, Math.min(motif.palette.length - 1, tone + rng.pick([-1, 1])));
        if (rng.chance(params.octaveJumpMelody * 1.5)) octave = octave === 0 ? 1 : 0;
      }

      const degree = motif.palette[Math.max(0, Math.min(motif.palette.length - 1, tone))];
      let pitch = scalePitch(root, meta.scaleId, degree) + octave * 12;

      // Solo la nota che apre la battuta si aggancia all'accordo: cosi' il
      // motivo resta lo stesso invece di cambiare a ogni cambio armonico.
      if (note.step % STEPS_PER_BAR === 0 && rng.chance(chordLock)) {
        const chord = chordAtBar(meta.progression, startBar + bar);
        pitch = snapToChordTone(pitch, chordPitchClasses(meta.rootPc, meta.scaleId, chord));
      }

      const tick = blockBar * TICKS_PER_BAR + note.step * STEP;
      if (options.windows && inSilence(options.windows, tick, true)) continue;
      const velocity = Math.round(
        (params.velocity * (0.8 + note.accent * 0.3) + rng.gauss(params.velocitySpread * 0.25)) *
          (options.velocityScale ?? 1),
      );

      notes.push({
        id: uid('m'),
        t: tick,
        d: Math.max(STEP * 0.5, note.len * STEP - STEP * 0.1),
        p: clampPitch(pitch, 45, 100),
        v: Math.max(25, Math.min(127, velocity)),
      });
    }
  }

  return notes.sort((a, b) => a.t - b.t);
}

/**
 * Counter melody: esiste solo se serve davvero, poche note, in un registro
 * diverso, e risponde alla melodia principale nei suoi spazi vuoti.
 */
export function generateCounter(ctx: GenContext, melody: NoteEvent[]): NoteEvent[] {
  const { rng, meta, params, bars, startBar } = ctx;
  if (!melody.length) return [];

  const notes: NoteEvent[] = [];
  const root = 12 * (params.melodyOctave + (rng.chance(0.7) ? 0 : 1)) + pitchClass(meta.rootPc);
  const busy = melody.map((n) => [n.t, n.t + n.d] as const);
  const answersPerBar = 1;

  for (let bar = 0; bar < bars; bar++) {
    if (!rng.chance(0.55)) continue;
    const chord = chordAtBar(meta.progression, startBar + bar);
    const pcs = chordPitchClasses(meta.rootPc, meta.scaleId, chord);

    let placed = 0;
    for (const step of [10, 14, 6, 12]) {
      if (placed >= answersPerBar) break;
      const tick = bar * TICKS_PER_BAR + step * STEP;
      if (busy.some(([a, b]) => tick >= a - STEP && tick < b)) continue;
      const pitch = snapToChordTone(scalePitch(root, meta.scaleId, rng.pick([0, 2, 4])), pcs);
      notes.push({
        id: uid('c'),
        t: tick,
        d: STEP * rng.int(2, 4),
        p: clampPitch(pitch, 45, 96),
        v: Math.max(25, Math.round(params.velocity * 0.62)),
      });
      placed++;
    }
  }
  return notes.sort((a, b) => a.t - b.t);
}

/** Lead: raddoppia solo gli accenti della melodia, un'ottava sopra. */
export function generateLead(ctx: GenContext, melody: NoteEvent[]): NoteEvent[] {
  const { rng, params } = ctx;
  return melody
    .filter((n) => n.v >= params.velocity * 0.95 && rng.chance(0.45))
    .map((n) => ({
      id: uid('l'),
      t: n.t,
      d: Math.min(n.d, STEP * 2),
      p: clampPitch(n.p + 12, 55, 108),
      v: Math.max(25, Math.round(n.v * 0.8)),
    }));
}
