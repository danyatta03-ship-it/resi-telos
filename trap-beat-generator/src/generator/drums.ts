import { PPQ, TICKS_PER_BAR, TRACK_MAP } from '../types';
import type { Clips, NoteEvent, TrackId } from '../types';
import { uid } from '../utils/id';
import { STEP, STEPS_PER_BAR, trackActive, velocityFor } from './context';
import type { GenContext } from './context';
import { GROOVE_STEPS } from './groove';
import type { Groove } from './groove';
import { inSilence } from './space';
import type { SilenceWindow } from './space';

/**
 * Batteria costruita intorno al groove di 808 e cassa.
 *
 * La cassa arriva gia' decisa dal groove condiviso: qui si aggiungono solo
 * rullante, hi-hat, open hat e percussioni, con la regola che il silenzio
 * conta quanto i colpi.
 */

/** Posizioni possibili per le percussioni: sempre fuori dai tempi forti. */
const PERC_STEPS = [3, 6, 7, 11, 14, 15];

function note(track: TrackId, tick: number, velocity: number, dur = STEP / 2, pitchOffset = 0): NoteEvent {
  const base = TRACK_MAP[track].drumPitch ?? 36;
  return { id: uid('d'), t: Math.round(tick), d: Math.round(dur), p: base + pitchOffset, v: velocity };
}

/** Hi-hat: presenti ma non un tappeto continuo, con i roll usati come accento. */
function buildHats(
  ctx: GenContext,
  bar: number,
  rateSteps: number,
  isPhraseEnd: boolean,
  windows: SilenceWindow[],
): NoteEvent[] {
  const { rng, params } = ctx;
  const out: NoteEvent[] = [];
  const barTick = bar * TICKS_PER_BAR;

  for (let pos = 0; pos < STEPS_PER_BAR; pos += rateSteps) {
    const tick = barTick + pos * STEP;
    if (inSilence(windows, tick)) continue;
    if (pos > 0 && rng.chance(params.hatSkip)) continue;
    const onBeat = pos % 4 === 0;
    const accent = onBeat ? 0.85 : pos % 2 === 0 ? 0.58 : 0.44;
    out.push(note('hat', tick, velocityFor(ctx, accent), STEP * 0.45));
  }

  // Roll: un accento, non un riempitivo. Quasi sempre a fine frase.
  const rollChance = params.hatRollChance * (isPhraseEnd ? 1.5 : 0.35);
  if (rng.chance(Math.min(0.75, rollChance))) {
    const beat = isPhraseEnd ? rng.weighted([[3, 5], [2, 1.5]] as const) : rng.int(1, 3);
    const beatTick = barTick + beat * PPQ;
    if (!inSilence(windows, beatTick)) {
      const divisions = rng.weighted([
        [3, 2 + params.hardness],
        [4, 2],
        [6, 1 + params.hardness * 2],
        [8, params.hardness * 2],
      ] as const);
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i].t >= beatTick && out[i].t < beatTick + PPQ) out.splice(i, 1);
      }
      for (let i = 0; i < divisions; i++) {
        const ramp = 0.45 + (i / Math.max(1, divisions - 1)) * 0.45;
        out.push(note('hat', beatTick + (i * PPQ) / divisions, velocityFor(ctx, ramp), PPQ / divisions / 1.7));
      }
    }
  }

  return out;
}

export function generateDrums(ctx: GenContext, groove: Groove, windows: SilenceWindow[]): Clips {
  const { rng, params, bars, section, meta } = ctx;
  const clips: Clips = { kick: [], snare: [], clap: [], hat: [], openhat: [], perc: [] };

  const useKick = trackActive(ctx, 'kick', 1.15);
  const useSnare = trackActive(ctx, 'snare', 1.15);
  const useClap = trackActive(ctx, 'clap', params.clapChance + 0.35);
  const useHat = trackActive(ctx, 'hat', 1.2);
  const useOpen = trackActive(ctx, 'openhat', params.openHatChance + 0.35);
  const usePerc = trackActive(ctx, 'perc', params.percChance + 0.2);

  // Sopra i 126 BPM il rullante sta sul terzo movimento: e' il feel half-time della trap.
  const backbeats = meta.bpm >= 126 ? [8] : [4, 12];
  const hatRate = rng.weighted([
    [4, params.hatRateWeights[0]],
    [2, params.hatRateWeights[1]],
    [1, params.hatRateWeights[2]],
    [1, params.hatRateWeights[3] * 0.6],
  ] as const);

  for (let bar = 0; bar < bars; bar++) {
    const barTick = bar * TICKS_PER_BAR;
    const isPhraseEnd = (bar + 1) % 4 === 0;
    const isLastBar = bar === bars - 1;
    const grooveBar = bar % 2;

    // --- KICK: arriva dal groove condiviso con l'808 ---
    if (useKick) {
      for (const step of groove.kick) {
        if (Math.floor(step / STEPS_PER_BAR) !== grooveBar) continue;
        const local = step % STEPS_PER_BAR;
        const tick = barTick + local * STEP;
        if (inSilence(windows, tick)) continue;
        if (!rng.chance(section.drumDensity)) continue;
        const accent = local === 0 ? 1 : local % 4 === 0 ? 0.82 : 0.68;
        clips.kick!.push(note('kick', tick, velocityFor(ctx, accent), STEP));
      }
      // Piccola variazione a fine frase, una nota sola.
      if (isPhraseEnd && rng.chance(params.variation * 0.5 + 0.15)) {
        const extra = rng.pick([11, 14, 15]);
        clips.kick!.push(note('kick', barTick + extra * STEP, velocityFor(ctx, 0.7), STEP));
      }
    }

    // --- SNARE / CLAP: semplici e solidi ---
    for (const step of backbeats) {
      const tick = barTick + step * STEP;
      if (inSilence(windows, tick) && rng.chance(0.5)) continue;
      if (useSnare) clips.snare!.push(note('snare', tick, velocityFor(ctx, 0.95), STEP));
      // Clap e rullante insieme sul backbeat: e' il colpo che regge tutto il pezzo.
      if (useClap && (params.hardness > 0.6 || rng.chance(params.clapChance))) {
        clips.clap!.push(note('clap', tick, velocityFor(ctx, 0.85), STEP));
      }
    }
    if (useSnare && rng.chance(params.ghostSnare * section.drumDensity)) {
      const ghost = rng.pick([7, 11, 14, 15]);
      clips.snare!.push(note('snare', barTick + ghost * STEP, velocityFor(ctx, 0.3), STEP / 2));
    }

    // --- FILL: solo dove serve una transizione ---
    if (useSnare && section.fill && isLastBar && rng.chance(0.55 + params.variation * 0.35)) {
      const div = rng.pick([3, 4, 6]);
      const start = barTick + 3 * PPQ;
      for (let i = 0; i < div; i++) {
        clips.snare!.push(
          note('snare', start + (i * PPQ) / div, velocityFor(ctx, 0.42 + (i / div) * 0.5), PPQ / div / 1.6),
        );
      }
    }

    // --- HI-HAT ---
    if (useHat) {
      // Nelle strofe gli hat sono piu' semplici: il ritornello deve sembrare piu' pieno.
      const sectionRate = Math.min(4, hatRate * section.hatRateScale);
      const rate = isPhraseEnd && rng.chance(params.variation * 0.3) ? Math.max(1, sectionRate / 2) : sectionRate;
      clips.hat!.push(...buildHats(ctx, bar, rate, isPhraseEnd || isLastBar, windows));
    }

    // --- OPEN HAT: uno ogni due battute basta ---
    if (useOpen && grooveBar === 1 && rng.chance(0.65)) {
      const step = rng.pick([6, 10, 14, 15]);
      const tick = barTick + step * STEP;
      if (!inSilence(windows, tick)) {
        clips.hat = clips.hat!.filter((n) => Math.abs(n.t - tick) > STEP * 0.4);
        clips.openhat!.push(note('openhat', tick, velocityFor(ctx, 0.6), STEP * 1.6));
      }
    }

    // --- PERCUSSION: con il contagocce ---
    if (usePerc && rng.chance(params.percChance * section.drumDensity)) {
      const step = rng.pick(PERC_STEPS);
      const tick = barTick + step * STEP;
      if (!inSilence(windows, tick)) {
        clips.perc!.push(note('perc', tick, velocityFor(ctx, 0.45), STEP / 2, rng.chance(0.3) ? 1 : 0));
      }
    }
  }

  for (const key of Object.keys(clips) as TrackId[]) {
    clips[key] = (clips[key] ?? []).sort((a, b) => a.t - b.t);
  }
  return clips;
}

export { GROOVE_STEPS };
