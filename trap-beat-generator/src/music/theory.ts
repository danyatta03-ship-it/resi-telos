import type { ChordDef, ChordQuality, ScaleId } from '../types';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface ScaleDef {
  id: ScaleId;
  label: string;
  /** Intervalli in semitoni dalla tonica. */
  steps: number[];
  /** True se la triade di tonica e' minore (serve alla notazione con numeri romani). */
  minorish: boolean;
}

export const SCALES: Record<ScaleId, ScaleDef> = {
  minor: { id: 'minor', label: 'Natural Minor', steps: [0, 2, 3, 5, 7, 8, 10], minorish: true },
  harmonicMinor: { id: 'harmonicMinor', label: 'Harmonic Minor', steps: [0, 2, 3, 5, 7, 8, 11], minorish: true },
  melodicMinor: { id: 'melodicMinor', label: 'Melodic Minor', steps: [0, 2, 3, 5, 7, 9, 11], minorish: true },
  dorian: { id: 'dorian', label: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], minorish: true },
  phrygian: { id: 'phrygian', label: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10], minorish: true },
  major: { id: 'major', label: 'Major', steps: [0, 2, 4, 5, 7, 9, 11], minorish: false },
  mixolydian: { id: 'mixolydian', label: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10], minorish: false },
  lydian: { id: 'lydian', label: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11], minorish: false },
  minorPentatonic: { id: 'minorPentatonic', label: 'Minor Pentatonic', steps: [0, 3, 5, 7, 10], minorish: true },
  majorPentatonic: { id: 'majorPentatonic', label: 'Major Pentatonic', steps: [0, 2, 4, 7, 9], minorish: false },
  hirajoshi: { id: 'hirajoshi', label: 'Hirajoshi', steps: [0, 2, 3, 7, 8], minorish: true },
  wholeTone: { id: 'wholeTone', label: 'Whole Tone', steps: [0, 2, 4, 6, 8, 10], minorish: false },
};

export const CHORD_FORMULAS: Record<ChordQuality, number[]> = {
  min: [0, 3, 7],
  maj: [0, 4, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  min7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  min9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  min6: [0, 3, 7, 9],
  halfdim7: [0, 3, 6, 10],
};

export const CHORD_LABEL: Record<ChordQuality, string> = {
  min: 'm',
  maj: '',
  dim: 'dim',
  aug: 'aug',
  min7: 'm7',
  maj7: 'maj7',
  dom7: '7',
  min9: 'm9',
  maj9: 'maj9',
  sus2: 'sus2',
  sus4: 'sus4',
  min6: 'm6',
  halfdim7: 'm7b5',
};

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function noteName(midi: number): string {
  return `${NOTE_NAMES[pitchClass(midi)]}${Math.floor(midi / 12) - 1}`;
}

export function keyLabel(rootPc: number, scaleId: ScaleId): string {
  return `${NOTE_NAMES[pitchClass(rootPc)]} ${SCALES[scaleId].label}`;
}

/** Pitch MIDI del grado `degree` (puo' essere negativo o oltre l'ottava) nella scala. */
export function scalePitch(rootMidi: number, scaleId: ScaleId, degree: number): number {
  const steps = SCALES[scaleId].steps;
  const len = steps.length;
  const octave = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return rootMidi + octave * 12 + steps[idx];
}

/** Tutti i pitch della scala in un intervallo MIDI. */
export function scalePitchesInRange(rootPc: number, scaleId: ScaleId, low: number, high: number): number[] {
  const set = new Set(SCALES[scaleId].steps.map((s) => pitchClass(rootPc + s)));
  const out: number[] = [];
  for (let p = low; p <= high; p++) if (set.has(pitchClass(p))) out.push(p);
  return out;
}

export function isInScale(midi: number, rootPc: number, scaleId: ScaleId): boolean {
  const set = new Set(SCALES[scaleId].steps.map((s) => pitchClass(rootPc + s)));
  return set.has(pitchClass(midi));
}

/** Avvicina un pitch alla nota di scala piu' vicina. */
export function snapToScale(midi: number, rootPc: number, scaleId: ScaleId): number {
  for (let delta = 0; delta <= 6; delta++) {
    if (isInScale(midi - delta, rootPc, scaleId)) return midi - delta;
    if (isInScale(midi + delta, rootPc, scaleId)) return midi + delta;
  }
  return midi;
}

/** Qualita' diatonica della triade costruita sul grado indicato. */
export function diatonicQuality(scaleId: ScaleId, degree: number, seventh = false): ChordQuality {
  const root = scalePitch(0, scaleId, degree);
  const third = scalePitch(0, scaleId, degree + 2) - root;
  const fifth = scalePitch(0, scaleId, degree + 4) - root;
  const sev = scalePitch(0, scaleId, degree + 6) - root;
  const triad: ChordQuality =
    third === 3 && fifth === 7
      ? 'min'
      : third === 4 && fifth === 7
        ? 'maj'
        : third === 3 && fifth === 6
          ? 'dim'
          : third === 4 && fifth === 8
            ? 'aug'
            : third <= 3
              ? 'min'
              : 'maj';
  if (!seventh) return triad;
  if (triad === 'min') return sev === 10 ? 'min7' : 'min6';
  if (triad === 'maj') return sev === 11 ? 'maj7' : 'dom7';
  if (triad === 'dim') return 'halfdim7';
  return triad;
}

const ROMAN_UPPER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export function romanFor(scaleId: ScaleId, degree: number, quality: ChordQuality): string {
  const len = SCALES[scaleId].steps.length;
  const idx = ((degree % len) + len) % len;
  const base = ROMAN_UPPER[Math.min(idx, 6)];
  const minorish = quality === 'min' || quality === 'min7' || quality === 'min9' || quality === 'min6';
  const dim = quality === 'dim' || quality === 'halfdim7';
  let roman = minorish || dim ? base.toLowerCase() : base;
  if (dim) roman += '°';
  if (quality === 'dom7') roman += '7';
  if (quality === 'maj7' || quality === 'maj9') roman += 'maj7';
  if (quality === 'min7' || quality === 'min9') roman += '7';
  if (quality === 'sus2') roman += 'sus2';
  if (quality === 'sus4') roman += 'sus4';
  return roman;
}

/** Root MIDI dell'accordo, nell'ottava indicata. */
export function chordRootMidi(rootPc: number, scaleId: ScaleId, chord: ChordDef, octave: number): number {
  const base = 12 * (octave + 1) + pitchClass(rootPc);
  return scalePitch(base, scaleId, chord.degree);
}

/** Note assolute dell'accordo a partire dalla fondamentale. */
export function chordPitches(rootMidi: number, quality: ChordQuality): number[] {
  return CHORD_FORMULAS[quality].map((i) => rootMidi + i);
}

export function chordLabel(rootPc: number, scaleId: ScaleId, chord: ChordDef): string {
  const root = chordRootMidi(rootPc, scaleId, chord, 3);
  return `${NOTE_NAMES[pitchClass(root)]}${CHORD_LABEL[chord.quality]}`;
}

/**
 * Voice leading: sceglie l'inversione/ottava piu' vicina al voicing precedente,
 * mantenendo tutte le voci dentro un registro utile.
 */
export function voiceLead(
  target: number[],
  previous: number[] | null,
  low = 48,
  high = 76,
): number[] {
  const pcs = Array.from(new Set(target.map(pitchClass)));
  const center = previous && previous.length ? previous.reduce((a, b) => a + b, 0) / previous.length : (low + high) / 2;

  const voiced = pcs.map((pc) => {
    let best = pc;
    let bestDist = Infinity;
    for (let oct = 1; oct <= 8; oct++) {
      const cand = pc + oct * 12;
      if (cand < low || cand > high) continue;
      const ref = previous?.length
        ? Math.min(...previous.map((p) => Math.abs(p - cand)))
        : Math.abs(center - cand);
      if (ref < bestDist) {
        bestDist = ref;
        best = cand;
      }
    }
    if (bestDist === Infinity) {
      best = pc;
      while (best < low) best += 12;
      while (best > high) best -= 12;
    }
    return best;
  });

  return Array.from(new Set(voiced)).sort((a, b) => a - b);
}

/** Intervallo (in semitoni) tra due note, utile per valutare i salti melodici. */
export function interval(a: number, b: number): number {
  return Math.abs(a - b);
}

/** Note dell'accordo come pitch class, per validare melodia e 808. */
export function chordPitchClasses(rootPc: number, scaleId: ScaleId, chord: ChordDef): number[] {
  const root = chordRootMidi(rootPc, scaleId, chord, 3);
  return chordPitches(root, chord.quality).map(pitchClass);
}
