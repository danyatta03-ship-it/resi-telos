import { PPQ, TICKS_PER_BAR, TRACK_MAP } from '../types';
import type { Clips, NoteEvent, TrackId } from '../types';
import { uid } from '../utils/id';
import { STEP, STEPS_PER_BAR, trackActive, velocityFor } from './context';
import type { GenContext } from './context';

/** Pesi tipici di un kick trap sui 16 step della battuta. */
const KICK_WEIGHTS = [
  1.0, 0.02, 0.07, 0.2, 0.05, 0.09, 0.36, 0.13, 0.24, 0.05, 0.44, 0.17, 0.07, 0.11, 0.26, 0.1,
];

/** Posizioni tipiche delle percussioni (off-beat). */
const PERC_STEPS = [2, 3, 6, 7, 10, 11, 13, 14, 15];

function note(track: TrackId, tick: number, velocity: number, dur = STEP / 2, pitchOffset = 0): NoteEvent {
  const base = TRACK_MAP[track].drumPitch ?? 36;
  return { id: uid('d'), t: Math.round(tick), d: Math.round(dur), p: base + pitchOffset, v: velocity };
}

/** Un ciclo di kick su una battuta: array di step attivi. */
function buildKickBar(ctx: GenContext, energy: number): number[] {
  const { rng, profile, variation } = ctx;
  const density = profile.kickDensity * (0.65 + energy * 0.5) * (0.7 + variation * 0.7);
  const steps: number[] = [];
  for (let s = 0; s < STEPS_PER_BAR; s++) {
    const weight = KICK_WEIGHTS[s] * (s % 2 === 1 ? 0.6 + profile.syncopation * 0.9 : 1);
    if (s === 0) {
      if (rng.chance(0.93)) steps.push(s);
      continue;
    }
    const p = Math.min(0.92, weight * (0.5 + density * 1.25));
    if (!rng.chance(p)) continue;
    // Evita grappoli illeggibili: niente due kick a distanza di uno step se non voluto.
    if (steps.length && s - steps[steps.length - 1] < 2 && !rng.chance(variation * 0.35)) continue;
    steps.push(s);
  }
  if (steps.length < 2) steps.push(rng.pick([6, 10, 14]));
  return Array.from(new Set(steps)).sort((a, b) => a - b);
}

function mutateSteps(ctx: GenContext, steps: number[], amount: number): number[] {
  const { rng } = ctx;
  const out = steps.slice();
  if (rng.chance(amount)) {
    const extra = rng.pick([3, 6, 7, 10, 11, 14, 15]);
    if (!out.includes(extra)) out.push(extra);
  }
  if (out.length > 2 && rng.chance(amount * 0.7)) {
    const idx = rng.int(1, out.length - 1);
    out.splice(idx, 1);
  }
  return out.sort((a, b) => a - b);
}

/** Hi-hat di una battuta: ritmo base + accenti + roll occasionali. */
function buildHatBar(
  ctx: GenContext,
  barIndex: number,
  isPhraseEnd: boolean,
  rateSteps: number,
): NoteEvent[] {
  const { rng, profile, variation } = ctx;
  const out: NoteEvent[] = [];
  const barTick = barIndex * TICKS_PER_BAR;
  const skipChance = 0.05 + variation * 0.05;

  for (let pos = 0; pos < STEPS_PER_BAR; pos += rateSteps) {
    if (pos > 0 && rng.chance(skipChance)) continue;
    const onBeat = pos % 4 === 0;
    const accent = onBeat ? 0.82 : pos % 2 === 0 ? 0.55 : 0.4;
    out.push(note('hat', barTick + pos * STEP, velocityFor(ctx, accent), STEP * 0.45));
  }

  // Roll: raddoppio o terzine su un movimento, piu' probabile a fine frase.
  const rollChance = profile.hatRolls * (0.35 + variation * 0.8) * (isPhraseEnd ? 1.6 : 0.7);
  if (rng.chance(Math.min(0.9, rollChance))) {
    const beat = isPhraseEnd ? rng.weighted([[3, 5], [2, 2], [1, 1]] as const) : rng.int(0, 3);
    const beatTick = barTick + beat * PPQ;
    const style = rng.weighted([
      ['32', 3 + variation * 3],
      ['triplet', 2 + profile.hatRolls * 3],
      ['sixtuplet', 1 + variation * 2],
      ['16', 2],
    ] as const);
    const divisions = style === '32' ? 8 : style === 'triplet' ? 3 : style === 'sixtuplet' ? 6 : 4;
    const span = PPQ / (style === 'triplet' ? 1 : 1);
    // Rimuove gli hat che cadono nel movimento occupato dal roll.
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i].t >= beatTick && out[i].t < beatTick + span) out.splice(i, 1);
    }
    for (let i = 0; i < divisions; i++) {
      const t = beatTick + (i * span) / divisions;
      const ramp = 0.42 + (i / Math.max(1, divisions - 1)) * 0.45;
      out.push(note('hat', t, velocityFor(ctx, ramp), span / divisions / 1.6));
    }
  }

  return out;
}

export function generateDrums(ctx: GenContext): Clips {
  const { rng, profile, variation, bars, section, meta } = ctx;
  const clips: Clips = { kick: [], snare: [], clap: [], hat: [], openhat: [], perc: [] };
  const energy = section.energy;

  const useKick = trackActive(ctx, 'kick', 1.2);
  const useSnare = trackActive(ctx, 'snare', 1.2);
  const useClap = trackActive(ctx, 'clap', 1.1);
  const useHat = trackActive(ctx, 'hat', 1.3);
  const useOpen = trackActive(ctx, 'openhat', 0.6 + profile.openHat);
  const usePerc = trackActive(ctx, 'perc', 0.6 + profile.perc);

  // Loop di due battute, come farebbe un producer.
  const coreKick = [buildKickBar(ctx, energy), buildKickBar(ctx, energy)];
  const halfTime = meta.bpm >= 126;
  const backbeats = halfTime ? [8] : [4, 12];
  const hatRate = rng.weighted([
    [4, profile.hatRateWeights[0]],
    [2, profile.hatRateWeights[1]],
    [1, profile.hatRateWeights[2]],
    [1, profile.hatRateWeights[3] * 0.5],
  ] as const);

  for (let bar = 0; bar < bars; bar++) {
    const barTick = bar * TICKS_PER_BAR;
    const isPhraseEnd = (bar + 1) % 4 === 0;
    const isLastBar = bar === bars - 1;

    // --- KICK ---
    if (useKick) {
      let steps = coreKick[bar % 2];
      if (isPhraseEnd) steps = mutateSteps(ctx, steps, 0.45 + variation * 0.45);
      else if (rng.chance(variation * 0.25)) steps = mutateSteps(ctx, steps, 0.3);
      for (const s of steps) {
        const accent = s === 0 ? 0.95 : s % 4 === 0 ? 0.8 : 0.62;
        clips.kick!.push(note('kick', barTick + s * STEP, velocityFor(ctx, accent), STEP));
      }
    }

    // --- SNARE / CLAP ---
    for (const s of backbeats) {
      if (useSnare) clips.snare!.push(note('snare', barTick + s * STEP, velocityFor(ctx, 0.9), STEP));
      if (useClap && rng.chance(0.85)) clips.clap!.push(note('clap', barTick + s * STEP, velocityFor(ctx, 0.82), STEP));
    }
    if (useSnare && rng.chance(profile.snareGhost * (0.5 + variation))) {
      const ghost = rng.pick([7, 11, 14, 15]);
      clips.snare!.push(note('snare', barTick + ghost * STEP, velocityFor(ctx, 0.32), STEP / 2));
    }
    // Fill di fine frase: rullata di snare sull'ultimo movimento.
    if (useSnare && section.fill && (isLastBar || (isPhraseEnd && rng.chance(0.35 + variation * 0.4)))) {
      const div = rng.pick([3, 4, 6, 8]);
      const start = barTick + 3 * PPQ;
      for (let i = 0; i < div; i++) {
        clips.snare!.push(
          note('snare', start + (i * PPQ) / div, velocityFor(ctx, 0.4 + (i / div) * 0.5), PPQ / div / 1.5),
        );
      }
    }

    // --- HAT ---
    if (useHat) {
      const rate = rng.chance(variation * 0.4) ? Math.max(1, hatRate / 2) : hatRate;
      clips.hat!.push(...buildHatBar(ctx, bar, isPhraseEnd || isLastBar, rate));
    }

    // --- OPEN HAT ---
    if (useOpen) {
      const count = rng.chance(0.55 + profile.openHat * 0.4) ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const s = rng.pick([2, 6, 7, 10, 14, 15]);
        const t = barTick + s * STEP;
        // L'open hat sostituisce il closed hat sullo stesso step.
        clips.hat = clips.hat!.filter((n) => Math.abs(n.t - t) > STEP * 0.4);
        clips.openhat!.push(note('openhat', t, velocityFor(ctx, 0.62), STEP * 1.6));
      }
    }

    // --- PERC ---
    if (usePerc) {
      const hits = rng.int(1, 2 + Math.round(variation * 2));
      for (let i = 0; i < hits; i++) {
        const s = rng.pick(PERC_STEPS);
        clips.perc!.push(
          note('perc', barTick + s * STEP, velocityFor(ctx, 0.45), STEP / 2, rng.chance(0.35) ? 1 : 0),
        );
      }
    }
  }

  for (const key of Object.keys(clips) as TrackId[]) {
    clips[key] = (clips[key] ?? []).sort((a, b) => a.t - b.t);
  }
  return clips;
}

/** Onset di kick (in tick) usati dall'808 per restare agganciato alla cassa. */
export function kickOnsets(clips: Clips): number[] {
  return (clips.kick ?? []).map((n) => n.t);
}
