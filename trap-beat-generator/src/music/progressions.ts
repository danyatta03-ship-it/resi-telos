import type { ChordDef, MoodId, ScaleId } from '../types';
import { SCALES, diatonicQuality, romanFor } from './theory';
import type { Rng } from './rng';

export interface ProgressionTemplate {
  id: string;
  /** Gradi 0-based della scala, uno per accordo. */
  degrees: number[];
  /** Durata in battute di ogni accordo (default 1). */
  bars?: number[];
  /** Mood con cui funziona particolarmente bene. */
  moods: MoodId[];
  /** true = pensata per scale minori, false = per scale maggiori. */
  minorish: boolean;
  /** Peso base nel sorteggio. */
  weight?: number;
}

/**
 * Database di progressioni. I gradi sono espressi sulla scala scelta:
 * in minore naturale il grado 6 e' gia' il VII maggiore, il 5 il VI, ecc.
 */
export const PROGRESSIONS: ProgressionTemplate[] = [
  { id: 'i-VI-III-VII', degrees: [0, 5, 2, 6], moods: ['dark', 'melodic', 'sad', 'street', 'emotional'], minorish: true, weight: 3 },
  { id: 'i-VII-VI-VII', degrees: [0, 6, 5, 6], moods: ['dark', 'street', 'aggressive', 'energetic'], minorish: true, weight: 3 },
  { id: 'i-iv-VI-v', degrees: [0, 3, 5, 4], moods: ['sad', 'emotional', 'melodic'], minorish: true, weight: 2 },
  { id: 'i-VI-VII', degrees: [0, 5, 6], bars: [2, 1, 1], moods: ['dark', 'ominous', 'street'], minorish: true, weight: 2 },
  { id: 'i-III-VII-VI', degrees: [0, 2, 6, 5], moods: ['melodic', 'luxury', 'emotional'], minorish: true, weight: 2 },
  { id: 'i-iv-v-i', degrees: [0, 3, 4, 0], moods: ['sad', 'ominous', 'dark'], minorish: true, weight: 2 },
  { id: 'i-VI-iv-VII', degrees: [0, 5, 3, 6], moods: ['melodic', 'emotional', 'chill'], minorish: true, weight: 2 },
  { id: 'i-v-VI-iv', degrees: [0, 4, 5, 3], moods: ['sad', 'atmospheric', 'emotional'], minorish: true, weight: 2 },
  { id: 'i-ii-VII-VI', degrees: [0, 1, 6, 5], moods: ['ominous', 'dark', 'futuristic'], minorish: true, weight: 1.5 },
  { id: 'i-VII-III-VI', degrees: [0, 6, 2, 5], moods: ['luxury', 'melodic', 'chill'], minorish: true, weight: 2 },
  { id: 'VI-VII-i-i', degrees: [5, 6, 0, 0], moods: ['energetic', 'aggressive', 'street'], minorish: true, weight: 2 },
  { id: 'iv-i-VI-VII', degrees: [3, 0, 5, 6], moods: ['emotional', 'melodic', 'sad'], minorish: true, weight: 1.5 },
  { id: 'i-vamp', degrees: [0], bars: [4], moods: ['street', 'aggressive', 'ambient', 'dark'], minorish: true, weight: 1.5 },
  { id: 'i-VII', degrees: [0, 6], bars: [2, 2], moods: ['street', 'chill', 'ambient', 'atmospheric'], minorish: true, weight: 2 },
  { id: 'i-iv', degrees: [0, 3], bars: [2, 2], moods: ['ominous', 'ambient', 'atmospheric', 'chill'], minorish: true, weight: 1.5 },
  { id: 'i-VI-ii-v', degrees: [0, 5, 1, 4], moods: ['futuristic', 'luxury', 'melodic'], minorish: true, weight: 1.2 },
  { id: 'i-III-iv-VI', degrees: [0, 2, 3, 5], moods: ['atmospheric', 'emotional', 'melodic'], minorish: true, weight: 1.5 },
  { id: 'i-VII-iv-VI', degrees: [0, 6, 3, 5], moods: ['dark', 'street', 'energetic'], minorish: true, weight: 1.5 },
  { id: 'i-v-iv-VII', degrees: [0, 4, 3, 6], moods: ['aggressive', 'ominous', 'dark'], minorish: true, weight: 1.2 },
  { id: 'i-ii-iv-i', degrees: [0, 1, 3, 0], moods: ['futuristic', 'ominous'], minorish: true, weight: 1 },
  { id: 'i-VI-III-iv', degrees: [0, 5, 2, 3], moods: ['luxury', 'emotional', 'chill'], minorish: true, weight: 1.5 },
  { id: 'i-III-VI-VII', degrees: [0, 2, 5, 6], moods: ['melodic', 'energetic', 'luxury'], minorish: true, weight: 1.5 },

  { id: 'I-V-vi-IV', degrees: [0, 4, 5, 3], moods: ['melodic', 'chill', 'energetic'], minorish: false, weight: 2 },
  { id: 'I-vi-IV-V', degrees: [0, 5, 3, 4], moods: ['chill', 'luxury', 'melodic'], minorish: false, weight: 2 },
  { id: 'vi-IV-I-V', degrees: [5, 3, 0, 4], moods: ['emotional', 'melodic', 'sad'], minorish: false, weight: 1.5 },
  { id: 'I-iii-IV-vi', degrees: [0, 2, 3, 5], moods: ['luxury', 'atmospheric', 'chill'], minorish: false, weight: 1.5 },
  { id: 'I-IV', degrees: [0, 3], bars: [2, 2], moods: ['ambient', 'chill', 'atmospheric'], minorish: false, weight: 1.2 },
  { id: 'I-II-IV-I', degrees: [0, 1, 3, 0], moods: ['futuristic', 'atmospheric'], minorish: false, weight: 1.2 },
  { id: 'I-vamp', degrees: [0], bars: [4], moods: ['ambient', 'atmospheric'], minorish: false, weight: 1 },
];

/** Estrae una progressione coerente con scala e mood, applicando le estensioni. */
export function pickProgression(
  rng: Rng,
  scaleId: ScaleId,
  moods: MoodId[],
  extensionChance: number,
): ChordDef[] {
  const scale = SCALES[scaleId];
  const degreesAvailable = scale.steps.length;
  const candidates = PROGRESSIONS.filter((p) => {
    if (p.minorish !== scale.minorish) return false;
    return p.degrees.every((d) => d < degreesAvailable);
  });

  const pool = candidates.length ? candidates : PROGRESSIONS.filter((p) => p.degrees.every((d) => d < degreesAvailable));
  const weighted = pool.map((p) => {
    const affinity = p.moods.filter((m) => moods.includes(m)).length;
    return [p, (p.weight ?? 1) * (1 + affinity * 2)] as const;
  });

  const template = rng.weighted(weighted);
  return template.degrees.map((degree, i) => {
    const useSeventh = rng.chance(extensionChance);
    let quality = diatonicQuality(scaleId, degree, useSeventh);
    // Le triadi diminuite in posizione forte suonano male: le addolciamo.
    if (quality === 'dim' && rng.chance(0.6)) quality = 'min';
    if (useSeventh && rng.chance(extensionChance * 0.45)) {
      if (quality === 'min7') quality = 'min9';
      else if (quality === 'maj7') quality = 'maj9';
    }
    if (rng.chance(0.06)) quality = rng.pick(['sus2', 'sus4'] as const);
    return {
      degree,
      quality,
      roman: romanFor(scaleId, degree, quality),
      bars: template.bars?.[i] ?? 1,
    };
  });
}

/** Mappa battuta -> accordo, ciclando la progressione. */
export function chordAtBar(progression: ChordDef[], bar: number): ChordDef {
  const total = progression.reduce((s, c) => s + c.bars, 0) || 1;
  let pos = ((bar % total) + total) % total;
  for (const chord of progression) {
    if (pos < chord.bars) return chord;
    pos -= chord.bars;
  }
  return progression[0];
}

/** Indice dell'accordo (nel ciclo) per una data battuta. */
export function chordIndexAtBar(progression: ChordDef[], bar: number): number {
  const total = progression.reduce((s, c) => s + c.bars, 0) || 1;
  let pos = ((bar % total) + total) % total;
  for (let i = 0; i < progression.length; i++) {
    if (pos < progression[i].bars) return i;
    pos -= progression[i].bars;
  }
  return 0;
}

export function progressionLabel(progression: ChordDef[]): string {
  return progression.map((c) => c.roman).join(' - ');
}
