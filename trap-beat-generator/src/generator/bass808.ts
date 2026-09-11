import { TICKS_PER_BAR } from '../types';
import type { NoteEvent } from '../types';
import { chordAtBar } from '../music/progressions';
import { chordPitches, chordRootMidi, snapToScale } from '../music/theory';
import { uid } from '../utils/id';
import { STEP, STEPS_PER_BAR, clampPitch, velocityFor } from './context';
import type { GenContext } from './context';

const LOW = 24;
const HIGH = 47;

/** Step sincopati dove l'808 puo' anticipare o rispondere alla cassa. */
const EXTRA_STEPS = [3, 6, 7, 10, 11, 14];

interface Onset {
  t: number;
  bar: number;
  /** true quando cade insieme alla cassa. */
  onKick: boolean;
  /** true se apre una nuova battuta/accordo. */
  downbeat: boolean;
}

function collectOnsets(ctx: GenContext, kicks: number[]): Onset[] {
  const { rng, profile, variation, bars } = ctx;
  const onsets: Onset[] = [];
  const kickSet = new Set(kicks.map((t) => Math.round(t / STEP)));

  for (let bar = 0; bar < bars; bar++) {
    const barStepBase = bar * STEPS_PER_BAR;
    const used = new Set<number>();

    // L'808 parte sul primo movimento, tranne qualche battuta lasciata vuota.
    const skipDownbeat = rng.chance(Math.max(0, 0.12 - profile.bassDensity * 0.1) + variation * 0.08);
    if (!skipDownbeat) {
      used.add(0);
      onsets.push({ t: bar * TICKS_PER_BAR, bar, onKick: kickSet.has(barStepBase), downbeat: true });
    }

    for (let s = 1; s < STEPS_PER_BAR; s++) {
      const isKick = kickSet.has(barStepBase + s);
      const follow = isKick ? 0.35 + profile.bassDensity * 0.75 : 0.05 + profile.bassDensity * 0.18 * variation;
      const weight = EXTRA_STEPS.includes(s) ? 1 : 0.45;
      if (!rng.chance(Math.min(0.9, follow * weight))) continue;
      const prev = Math.max(...Array.from(used));
      if (s - prev < 2 && !rng.chance(variation * 0.3)) continue;
      used.add(s);
      onsets.push({ t: bar * TICKS_PER_BAR + s * STEP, bar, onKick: isKick, downbeat: false });
    }
  }
  return onsets.sort((a, b) => a.t - b.t);
}

/** Genera la linea di 808: segue tonalita', progressione e cassa. */
export function generate808(ctx: GenContext, kicks: number[]): NoteEvent[] {
  const { rng, profile, meta, variation, bars, startBar } = ctx;
  const onsets = collectOnsets(ctx, kicks);
  if (!onsets.length) return [];

  const notes: NoteEvent[] = [];
  let previousPitch: number | null = null;

  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i];
    const chord = chordAtBar(meta.progression, startBar + onset.bar);
    const root = chordRootMidi(meta.rootPc, meta.scaleId, chord, 1);
    const tones = chordPitches(root, chord.quality).filter((p) => p <= HIGH + 12);

    let pitch: number;
    if (onset.downbeat || previousPitch === null) {
      pitch = root;
    } else {
      const choice = rng.weighted([
        ['root', 6],
        ['fifth', 1.4 + profile.slide],
        ['third', 1 + variation],
        ['seventh', tones.length > 3 ? 0.8 + variation : 0],
        ['neighbour', variation * 1.2],
      ] as const);
      if (choice === 'root') pitch = root;
      else if (choice === 'fifth') pitch = tones[2] ?? root + 7;
      else if (choice === 'third') pitch = tones[1] ?? root + 3;
      else if (choice === 'seventh') pitch = tones[3] ?? root + 10;
      else pitch = snapToScale(root + rng.pick([-2, -1, 1, 2]), meta.rootPc, meta.scaleId);
    }

    if (rng.chance(profile.octaveJump * (0.4 + variation * 0.8)) && !onset.downbeat) pitch += 12;
    while (pitch > HIGH) pitch -= 12;
    while (pitch < LOW) pitch += 12;

    const next = onsets[i + 1];
    const gap = (next ? next.t : bars * TICKS_PER_BAR) - onset.t;
    const sustain = profile.bassSustain * (0.7 + variation * 0.3);
    let duration: number;
    if (sustain > 0.62) duration = Math.max(STEP, gap - STEP * 0.12);
    else if (sustain > 0.42) duration = Math.max(STEP, Math.min(gap - STEP * 0.2, STEP * 4));
    else duration = Math.max(STEP * 0.8, Math.min(gap * 0.55, STEP * 2));

    // Lo slide (glide) collega due note vicine e diverse fra loro.
    const slide =
      !!next &&
      gap <= STEP * 4 &&
      rng.chance(profile.slide * (0.5 + variation * 0.5)) &&
      duration >= gap - STEP * 0.3;

    notes.push({
      id: uid('b'),
      t: onset.t,
      d: Math.round(duration),
      p: clampPitch(pitch, LOW, HIGH),
      v: velocityFor(ctx, onset.downbeat ? 0.9 : onset.onKick ? 0.78 : 0.62),
      slide: slide || undefined,
    });
    previousPitch = pitch;
  }

  return notes;
}
