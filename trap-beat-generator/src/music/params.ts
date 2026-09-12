import type { BeatMeta } from '../types';
import type { MoodProfile } from './moods';

/**
 * Grammatica generativa del motore: ITALIAN_TRAP_HARD.
 *
 * L'idea non e' imitare un brano ma applicare le regole comuni della trap
 * italiana moderna: melodia minimale e riconoscibile, 808 protagonista ma con
 * poche note, drum con bounce, e soprattutto spazio. Tutto viene derivato da
 * tre assi (hardness, darkness, space) piu' il mood e il BPM scelti dall'utente.
 */

export type Feel = 'halfTime' | 'trap' | 'fast';

export interface GenParams {
  /** Assi normalizzati 0-1. */
  hardness: number;
  darkness: number;
  space: number;
  variation: number;
  catchiness: number;
  /** Come il BPM va interpretato ritmicamente. */
  feel: Feel;
  bpm: number;

  // --- Melodia ---
  /** Quante note diverse puo' usare il motivo (min, max). */
  palette: [number, number];
  /** Attacchi per battuta nel motivo. */
  onsetsPerBar: [number, number];
  /** Lunghezza del motivo in battute. */
  motifBars: number;
  /** Quanto spesso il motivo torna identico. */
  motifRepetition: number;
  melodyOctave: number;
  /** 0 = note staccate, 1 = note tenute. */
  melodySustain: number;
  /** Quota di respiro dentro al motivo. */
  melodyRest: number;
  /** Propensione ai salti invece dei gradi congiunti. */
  leap: number;
  octaveJumpMelody: number;

  // --- Armonia ---
  chordCount: [number, number];
  /** Probabilita' di settime, sus e add9. */
  chordExtensions: number;
  /** Pesi fra accordi tenuti, stab e arpeggio. */
  chordStyleWeights: [number, number, number];
  chordChance: number;
  padChance: number;

  // --- Groove: 808 e kick nascono insieme ---
  /** Attacchi di 808 in due battute. */
  bassOnsets: [number, number];
  bassSustain: number;
  slide: number;
  octaveJump: number;
  /** Quanti kick extra oltre a quelli agganciati all'808. */
  kickExtra: number;
  /** Quanto spesso il kick anticipa o risponde all'808 invece di coincidere. */
  displacement: number;
  syncopation: number;

  // --- Drums ---
  /** Pesi delle suddivisioni hi-hat: 1/4, 1/8, 1/16, 1/32. */
  hatRateWeights: [number, number, number, number];
  hatSkip: number;
  hatRollChance: number;
  openHatChance: number;
  percChance: number;
  ghostSnare: number;
  clapChance: number;

  // --- Presenza ---
  counterChance: number;
  leadChance: number;

  // --- Dinamica ---
  velocity: number;
  velocitySpread: number;
  swing: number;

  /** Densita' massima tollerata prima che il passaggio di minimalismo tagli. */
  maxWeightedNotesPerBar: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

function feelFor(bpm: number): Feel {
  if (bpm <= 105) return 'halfTime';
  if (bpm >= 155) return 'fast';
  return 'trap';
}

/**
 * Traduce mood + assi + BPM nei parametri concreti usati dai generatori.
 * I campi storici del mood restano come modulatori secondari, cosi' Chill
 * continua a suonare Chill anche dentro alla nuova grammatica.
 */
export function buildParams(meta: BeatMeta, mood: MoodProfile): GenParams {
  const hardness = clamp01(meta.hardness / 100);
  const darkness = clamp01(meta.darkness / 100);
  const space = clamp01(meta.space / 100);
  const variation = clamp01(meta.variation / 100);
  const catchiness = clamp01(mood.catchiness);
  const feel = feelFor(meta.bpm);

  // Il mood storico pesa per un terzo: tiene le differenze fra i mood esistenti.
  const moodMix = (value: number, base: number) => base * 0.72 + value * 0.28;

  const density = mix(0.55, 1, hardness) * mix(1, 0.55, space);

  return {
    hardness,
    darkness,
    space,
    variation,
    catchiness,
    feel,
    bpm: meta.bpm,

    // --- Melodia: poche note, molto ripetute ---
    palette: [3, hardness > 0.6 ? 5 : 6],
    onsetsPerBar: [2, Math.round(mix(3, 5, 1 - space) + variation)],
    motifBars: 2,
    motifRepetition: clamp01(mix(0.55, 0.9, catchiness) - variation * 0.15),
    melodyOctave: darkness > 0.75 ? 5 : mix(5, 6, 1 - darkness) > 5.5 ? 6 : 5,
    melodySustain: clamp01(moodMix(mood.melodySustain, mix(0.35, 0.7, darkness))),
    melodyRest: clamp01(mix(0.3, 0.62, space)),
    leap: clamp01(moodMix(mood.leap, mix(0.2, 0.42, hardness))),
    octaveJumpMelody: clamp01(0.06 + hardness * 0.16),

    // --- Armonia: due o tre accordi, niente jazz ---
    chordCount: [2, darkness > 0.7 ? 4 : 3],
    chordExtensions: clamp01(0.12 + darkness * 0.4 - hardness * 0.15),
    chordStyleWeights: [3 + darkness * 3, 1 + hardness * 2.5, 0.6 + (1 - hardness) * 1.2],
    chordChance: clamp01(0.55 + darkness * 0.35 - hardness * 0.15),
    padChance: clamp01(0.15 + darkness * 0.6 - hardness * 0.25 + space * 0.2),

    // --- Groove ---
    bassOnsets: [3, Math.max(4, Math.round(mix(4, 8, density)))],
    bassSustain: clamp01(mix(0.8, 0.42, hardness) + darkness * 0.12),
    slide: clamp01(0.18 + (1 - hardness) * 0.28 + darkness * 0.18),
    octaveJump: clamp01(0.12 + hardness * 0.38),
    kickExtra: clamp01(0.2 + hardness * 0.5 - space * 0.25),
    displacement: clamp01(0.2 + hardness * 0.35),
    syncopation: clamp01(moodMix(mood.syncopation, mix(0.4, 0.85, hardness))),

    // --- Drums: hat presenti ma non un tappeto ---
    // Base sugli ottavi, i sedicesimi come scelta di carattere, mai un tappeto.
    hatRateWeights: [
      space * 1.4,
      3.4 + space * 2.6,
      1.5 + hardness * 1.8,
      hardness * 0.5,
    ],
    hatSkip: clamp01(0.08 + space * 0.18),
    hatRollChance: clamp01(0.12 + hardness * 0.3 - space * 0.1),
    openHatChance: clamp01(moodMix(mood.openHat, 0.35 + hardness * 0.2)),
    percChance: clamp01(moodMix(mood.perc, 0.22 + hardness * 0.12 - space * 0.12)),
    ghostSnare: clamp01(0.08 + hardness * 0.25),
    clapChance: clamp01(0.55 + hardness * 0.3),

    // --- Presenza: il producer aggiunge solo se serve ---
    counterChance: clamp01(0.1 + (1 - hardness) * 0.22 - space * 0.1),
    leadChance: clamp01(0.12 + hardness * 0.28),

    // --- Dinamica: trap quantizzata, poco swing ---
    velocity: Math.round(mix(78, 114, hardness)),
    velocitySpread: Math.round(mix(20, 13, hardness)),
    swing: clamp01(mood.swing * 0.6 * (1 - hardness)),

    maxWeightedNotesPerBar: mix(11, 17, hardness) * mix(1, 0.72, space),
  };
}

/** Valori di default degli assi a partire dai mood scelti. */
export function defaultAxes(mood: MoodProfile): { hardness: number; darkness: number; space: number } {
  return {
    hardness: Math.round(mood.hardness),
    darkness: Math.round(mood.darkness),
    space: Math.round(mood.space),
  };
}
