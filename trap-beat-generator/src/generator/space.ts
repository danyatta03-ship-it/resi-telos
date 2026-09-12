import { PPQ, TICKS_PER_BAR } from '../types';
import type { GenParams } from '../music/params';
import type { Rng } from '../music/rng';

/**
 * Lo spazio come elemento del groove.
 *
 * Non e' assenza di idee: sono finestre decise in anticipo in cui gli strumenti
 * tacciono tutti insieme, cosi' il rientro pesa. Le stesse finestre valgono per
 * batteria, 808 e (piu' raramente) melodia, altrimenti il buco non si sente.
 */

export interface SilenceWindow {
  from: number;
  to: number;
  /** Se true tace anche la melodia. */
  full: boolean;
}

export function buildSilenceWindows(
  rng: Rng,
  params: GenParams,
  bars: number,
  energy: number,
): SilenceWindow[] {
  const windows: SilenceWindow[] = [];
  // Nelle sezioni piene si toglie meno, ma qualcosa si toglie sempre.
  const base = params.space * (0.45 + energy * 0.45);

  for (let bar = 0; bar < bars; bar++) {
    const phraseEnd = (bar + 1) % 4 === 0;
    const chance = phraseEnd ? base : base * 0.22;
    if (!rng.chance(Math.min(0.85, chance))) continue;

    // Di solito si svuota l'ultimo movimento della frase, a volte mezza battuta.
    const long = rng.chance(0.25 + params.space * 0.25);
    const beat = phraseEnd ? (long ? 2 : 3) : rng.int(1, 3);
    windows.push({
      from: bar * TICKS_PER_BAR + beat * PPQ,
      to: bar * TICKS_PER_BAR + (long ? 4 : beat + 1) * PPQ,
      full: rng.chance(0.3 + params.space * 0.3),
    });
  }

  return windows;
}

export function inSilence(windows: SilenceWindow[], tick: number, melody = false): boolean {
  return windows.some((w) => tick >= w.from && tick < w.to && (!melody || w.full));
}
