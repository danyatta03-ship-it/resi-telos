import { PPQ } from '../types';
import type { NoteEvent, TrackId } from '../types';
import { Rng } from '../music/rng';
import { hashString } from '../utils/id';

const STEP = PPQ / 4;

/**
 * Applica micro variazioni di timing, durata e velocity senza rompere il groove.
 * Deterministico: stesso seed + traccia = stesse imperfezioni.
 */
export function humanizeNotes(
  notes: NoteEvent[],
  amount: number,
  track: TrackId,
  seed: number,
  swing = 0,
): NoteEvent[] {
  if (amount <= 0 && swing <= 0) return notes;
  const rng = new Rng(hashString(`${seed}:${track}`) >>> 0);
  const a = Math.max(0, Math.min(1, amount));
  // Le tracce ritmiche vanno toccate meno di quelle melodiche.
  const timingRange = (track === 'kick' ? 0.05 : track === '808' ? 0.05 : 0.09) * STEP * a * 2;
  const velRange = 22 * a;

  return notes.map((n) => {
    let t = n.t;
    // Swing: ritarda i sedicesimi dispari.
    const sixteenth = Math.round(n.t / STEP);
    if (swing > 0 && sixteenth % 2 === 1) t += STEP * 0.32 * swing;
    t += rng.gauss(timingRange * 0.5);
    const v = Math.max(12, Math.min(127, Math.round(n.v + rng.gauss(velRange * 0.4))));
    const d = Math.max(STEP * 0.25, n.d * (1 + rng.gauss(0.08 * a)));
    return { ...n, t: Math.max(0, Math.round(t)), d: Math.round(d), v };
  });
}
