import { PPQ } from '../types';
import type { BeatMeta, SectionKind, TrackId } from '../types';
import type { MoodProfile } from '../music/moods';
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
  /** Probabilita' di presenza per traccia (moltiplicata per il mood). */
  presence: Partial<Record<TrackId, number>>;
  /** Fill di batteria nell'ultima battuta. */
  fill: boolean;
}

export const SECTION_PROFILES: Record<SectionKind, SectionProfile> = {
  INTRO: {
    kind: 'INTRO',
    energy: 0.32,
    barOptions: [4, 8],
    presence: { kick: 0.5, snare: 0.2, clap: 0.15, hat: 0.6, openhat: 0.3, perc: 0.3, '808': 0.45, melody: 0.95, counter: 0.2, chords: 0.7, pad: 0.9, lead: 0.1 },
    fill: true,
  },
  HOOK: {
    kind: 'HOOK',
    energy: 1,
    barOptions: [8, 8, 16],
    presence: { kick: 1, snare: 1, clap: 0.9, hat: 1, openhat: 0.8, perc: 0.7, '808': 1, melody: 1, counter: 0.7, chords: 0.85, pad: 0.7, lead: 0.6 },
    fill: true,
  },
  VERSE: {
    kind: 'VERSE',
    energy: 0.68,
    barOptions: [8, 16, 16],
    presence: { kick: 0.95, snare: 0.95, clap: 0.6, hat: 1, openhat: 0.6, perc: 0.5, '808': 0.95, melody: 0.75, counter: 0.4, chords: 0.6, pad: 0.6, lead: 0.2 },
    fill: true,
  },
  PRE: {
    kind: 'PRE',
    energy: 0.55,
    barOptions: [4, 4, 8],
    presence: { kick: 0.6, snare: 0.5, clap: 0.4, hat: 0.9, openhat: 0.4, perc: 0.5, '808': 0.6, melody: 0.85, counter: 0.5, chords: 0.8, pad: 0.85, lead: 0.35 },
    fill: true,
  },
  BRIDGE: {
    kind: 'BRIDGE',
    energy: 0.5,
    barOptions: [4, 8],
    presence: { kick: 0.55, snare: 0.45, clap: 0.35, hat: 0.7, openhat: 0.45, perc: 0.55, '808': 0.6, melody: 0.8, counter: 0.6, chords: 0.8, pad: 0.9, lead: 0.4 },
    fill: true,
  },
  OUTRO: {
    kind: 'OUTRO',
    energy: 0.28,
    barOptions: [4, 8],
    presence: { kick: 0.45, snare: 0.25, clap: 0.15, hat: 0.5, openhat: 0.3, perc: 0.25, '808': 0.4, melody: 0.7, counter: 0.2, chords: 0.7, pad: 0.95, lead: 0.1 },
    fill: false,
  },
};

export interface GenContext {
  rng: Rng;
  meta: BeatMeta;
  profile: MoodProfile;
  /** Variation 0-1. */
  variation: number;
  section: SectionProfile;
  bars: number;
  /** Battuta assoluta di inizio sezione: serve per allineare la progressione. */
  startBar: number;
}

/** true se la traccia deve suonare nella sezione. */
export function trackActive(ctx: GenContext, track: TrackId, moodWeight = 1): boolean {
  const base = ctx.section.presence[track] ?? 0.5;
  const p = Math.min(1, base * moodWeight);
  return ctx.rng.chance(p);
}

/** Velocity con escursione dipendente da mood, energia della sezione e variation. */
export function velocityFor(ctx: GenContext, accent: number): number {
  const { profile, section } = ctx;
  const base = profile.velocity * (0.72 + section.energy * 0.33);
  const spread = profile.velocitySpread * (0.5 + ctx.variation);
  const v = base + (accent - 0.5) * spread * 2 + ctx.rng.gauss(spread * 0.12);
  return Math.max(20, Math.min(127, Math.round(v)));
}

export function clampPitch(p: number, low = 0, high = 127): number {
  return Math.max(low, Math.min(high, Math.round(p)));
}
