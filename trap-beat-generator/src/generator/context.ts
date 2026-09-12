import { PPQ } from '../types';
import type { BeatMeta, SectionKind, TrackId } from '../types';
import type { GenParams } from '../music/params';
import type { Rng } from '../music/rng';

/** Un sedicesimo in tick. */
export const STEP = PPQ / 4;
export const STEPS_PER_BAR = 16;

export interface SectionProfile {
  kind: SectionKind;
  /** Quanta energia porta la sezione, 0-1. */
  energy: number;
  /** Battute suggerite. */
  barOptions: number[];
  /** Probabilita' di presenza per traccia. */
  presence: Partial<Record<TrackId, number>>;
  /** Quante note del motivo sopravvivono qui. */
  melodyDensity: number;
  /** Quanto e' fitta la batteria rispetto al groove principale. */
  drumDensity: number;
  /** Moltiplicatore della suddivisione degli hi-hat: 2 = meta' colpi. */
  hatRateScale: number;
  /** Fill di batteria nell'ultima battuta. */
  fill: boolean;
}

/**
 * Profili delle sezioni.
 *
 * L'hook e' la stessa idea del resto del pezzo con piu' impatto, non un altro
 * brano: cambia la densita', non il materiale. Le strofe lasciano spazio alla voce.
 */
export const SECTION_PROFILES: Record<SectionKind, SectionProfile> = {
  INTRO: {
    kind: 'INTRO',
    energy: 0.3,
    barOptions: [4, 4, 8],
    presence: { kick: 0.35, snare: 0.12, clap: 0.08, hat: 0.45, openhat: 0.2, perc: 0.12, '808': 0.4, melody: 1, counter: 0.08, chords: 0.55, pad: 0.75, lead: 0.05 },
    melodyDensity: 0.85,
    drumDensity: 0.4,
    hatRateScale: 2,
    fill: true,
  },
  HOOK: {
    kind: 'HOOK',
    energy: 1,
    barOptions: [8, 8, 16],
    presence: { kick: 1, snare: 1, clap: 0.92, hat: 1, openhat: 0.65, perc: 0.45, '808': 1, melody: 1, counter: 0.3, chords: 0.72, pad: 0.45, lead: 0.5 },
    melodyDensity: 1,
    drumDensity: 1,
    hatRateScale: 1,
    fill: true,
  },
  VERSE: {
    kind: 'VERSE',
    energy: 0.72,
    barOptions: [8, 16, 16],
    presence: { kick: 1, snare: 0.98, clap: 0.45, hat: 1, openhat: 0.4, perc: 0.22, '808': 1, melody: 0.8, counter: 0.12, chords: 0.45, pad: 0.4, lead: 0.08 },
    melodyDensity: 0.7,
    drumDensity: 0.85,
    hatRateScale: 2,
    fill: true,
  },
  PRE: {
    kind: 'PRE',
    energy: 0.5,
    barOptions: [4, 4, 8],
    presence: { kick: 0.5, snare: 0.35, clap: 0.25, hat: 0.8, openhat: 0.3, perc: 0.25, '808': 0.5, melody: 0.9, counter: 0.15, chords: 0.65, pad: 0.75, lead: 0.2 },
    melodyDensity: 0.85,
    drumDensity: 0.55,
    hatRateScale: 2,
    fill: true,
  },
  BRIDGE: {
    kind: 'BRIDGE',
    energy: 0.45,
    barOptions: [4, 8],
    presence: { kick: 0.45, snare: 0.35, clap: 0.25, hat: 0.6, openhat: 0.35, perc: 0.3, '808': 0.5, melody: 0.85, counter: 0.25, chords: 0.7, pad: 0.8, lead: 0.2 },
    melodyDensity: 0.75,
    drumDensity: 0.5,
    hatRateScale: 2,
    fill: true,
  },
  OUTRO: {
    kind: 'OUTRO',
    energy: 0.25,
    barOptions: [4, 4, 8],
    presence: { kick: 0.35, snare: 0.15, clap: 0.1, hat: 0.4, openhat: 0.2, perc: 0.1, '808': 0.35, melody: 0.8, counter: 0.08, chords: 0.6, pad: 0.85, lead: 0.05 },
    melodyDensity: 0.6,
    drumDensity: 0.3,
    hatRateScale: 2,
    fill: false,
  },
};

export interface GenContext {
  rng: Rng;
  meta: BeatMeta;
  params: GenParams;
  section: SectionProfile;
  bars: number;
  /** Battuta assoluta di inizio sezione: serve per allineare la progressione. */
  startBar: number;
}

/** true se la traccia deve suonare nella sezione. */
export function trackActive(ctx: GenContext, track: TrackId, weight = 1): boolean {
  const base = ctx.section.presence[track] ?? 0.5;
  return ctx.rng.chance(Math.min(1, base * weight));
}

/** Velocity legata a hardness, accento e energia della sezione. */
export function velocityFor(ctx: GenContext, accent: number): number {
  const { params, section } = ctx;
  const base = params.velocity * (0.78 + section.energy * 0.26);
  const spread = params.velocitySpread;
  const value = base + (accent - 0.6) * spread * 1.8 + ctx.rng.gauss(spread * 0.18);
  return Math.max(24, Math.min(127, Math.round(value)));
}

export function clampPitch(p: number, low = 0, high = 127): number {
  return Math.max(low, Math.min(high, Math.round(p)));
}
