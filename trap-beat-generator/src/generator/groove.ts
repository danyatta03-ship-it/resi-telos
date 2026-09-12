import type { GenParams } from '../music/params';
import type { Rng } from '../music/rng';

/**
 * Groove condiviso fra 808 e cassa.
 *
 * Nella trap italiana moderna questi due elementi sono una cosa sola: il basso
 * decide dove si appoggia il beat, la cassa gli gira intorno (insieme, un filo
 * prima, oppure in risposta). Per questo vengono generati qui insieme e non
 * a caso ognuno per conto suo.
 */

export const GROOVE_BARS = 2;
export const GROOVE_STEPS = GROOVE_BARS * 16;

export interface BassOnset {
  /** Posizione in sedicesimi dentro alle due battute. */
  step: number;
  /** Attacco forte: primo colpo della battuta o colpo accentato. */
  accent: boolean;
}

export interface Groove {
  bass: BassOnset[];
  kick: number[];
  /** Step lasciati deliberatamente vuoti: nessuno strumento ritmico li occupa. */
  holes: number[];
}

/**
 * Celle di 808 scritte a mano: poche note, prima battuta che ancora il groove,
 * seconda che lo sposta. Sono lo scheletro da cui parte tutto.
 */
const BASS_CELLS: number[][] = [
  [0, 10, 16, 26],
  [0, 6, 16, 22],
  [0, 12, 16, 24],
  [0, 16],
  [0, 11, 16, 27],
  [0, 14, 16, 30],
  [0, 6, 10, 16, 22],
  [0, 8, 16, 22, 28],
  [0, 3, 16, 19],
  [0, 10, 16, 20, 26],
  [0, 16, 24],
  [0, 4, 16, 18, 26],
  [0, 7, 16, 23],
  [0, 10, 14, 16, 26],
];

/** Posizioni aggiuntive quando serve un colpo in piu': sempre sincopate. */
const FILLER_STEPS = [3, 6, 10, 14, 19, 22, 26, 30];

/** Posizioni tipiche dei kick di rimbalzo, lontane dai tempi forti banali. */
const BOUNCE_STEPS = [3, 6, 7, 11, 14, 19, 22, 23, 27, 30];

function unique(steps: number[]): number[] {
  return Array.from(new Set(steps)).sort((a, b) => a - b);
}

/** Distanza minima fra due colpi, per non impastare il basso. */
function tooClose(steps: number[], candidate: number, min = 2): boolean {
  return steps.some((s) => Math.abs(s - candidate) < min);
}

export function buildGroove(rng: Rng, params: GenParams): Groove {
  const [minOnsets, maxOnsets] = params.bassOnsets;

  // 1. Cella di partenza, scelta vicino al numero di colpi desiderato.
  const target = rng.int(minOnsets, maxOnsets);
  const cell = rng.weighted(
    BASS_CELLS.map((c) => [c, 1 / (1 + Math.abs(c.length - target))] as const),
  );
  let bassSteps = cell.slice();

  // 2. Si aggiunge o si toglie finche' il numero di colpi non e' quello voluto.
  while (bassSteps.length < target) {
    const candidate = rng.pick(FILLER_STEPS);
    if (tooClose(bassSteps, candidate, 3)) break;
    bassSteps.push(candidate);
  }
  while (bassSteps.length > maxOnsets) {
    // Si toglie sempre da dove fa meno danno: mai il primo colpo.
    bassSteps.splice(rng.int(1, bassSteps.length - 1), 1);
  }

  // 3. Lo spazio e' parte del groove: ogni tanto la seconda battuta resta vuota.
  const holes: number[] = [];
  if (rng.chance(params.space * 0.55) && bassSteps.length > 2) {
    const removable = bassSteps.filter((s) => s >= 16 && s !== 16);
    if (removable.length) {
      const removed = rng.pick(removable);
      bassSteps = bassSteps.filter((s) => s !== removed);
      holes.push(removed);
    }
  }

  bassSteps = unique(bassSteps);
  const bass: BassOnset[] = bassSteps.map((step) => ({
    step,
    accent: step === 0 || step === 16,
  }));

  // 4. La cassa nasce in relazione al basso, non per conto suo.
  const kick: number[] = [];
  for (const onset of bass) {
    const relation = rng.weighted([
      ['together', 3 + (1 - params.displacement) * 4],
      ['anticipate', params.displacement * 2.5],
      ['answer', params.displacement * 1.8],
      ['silent', params.space * 1.4],
    ] as const);

    if (relation === 'together') kick.push(onset.step);
    else if (relation === 'anticipate') kick.push(Math.max(0, onset.step - rng.pick([1, 2])));
    else if (relation === 'answer') kick.push(Math.min(GROOVE_STEPS - 1, onset.step + rng.pick([2, 3])));
    // 'silent': il basso resta da solo, e spesso e' la scelta piu' forte
  }

  // Il primo movimento va comunque marcato, altrimenti il beat non parte.
  if (!kick.some((s) => s <= 1)) kick.push(0);

  // 5. Kick di rimbalzo, quelli che danno il bounce.
  const extras = Math.round(params.kickExtra * 3);
  for (let i = 0; i < extras; i++) {
    const candidate = rng.pick(BOUNCE_STEPS);
    if (holes.includes(candidate)) continue;
    if (tooClose(kick, candidate, 2)) continue;
    if (rng.chance(0.35 - params.hardness * 0.2)) continue;
    kick.push(candidate);
  }

  return { bass, kick: unique(kick), holes };
}

/** Piccola variante del groove per una sezione, senza perderne l'identita'. */
export function varyGroove(rng: Rng, groove: Groove, params: GenParams, energy: number): Groove {
  const amount = params.variation * (0.4 + energy * 0.6);
  const bass = groove.bass.map((o) => ({ ...o }));
  let kick = groove.kick.slice();

  // Sezioni scariche: si toglie, non si aggiunge.
  if (energy < 0.5) {
    const dropped = bass.filter((o) => o.accent || rng.chance(0.55 + energy * 0.3));
    if (dropped.length >= 2) bass.length = 0, bass.push(...dropped);
    kick = kick.filter((s) => s === 0 || rng.chance(0.6 + energy * 0.35));
  }

  if (rng.chance(amount * 0.5)) {
    const candidate = rng.pick(FILLER_STEPS);
    if (!tooClose(bass.map((o) => o.step), candidate, 3)) bass.push({ step: candidate, accent: false });
  }
  if (rng.chance(amount * 0.6)) {
    const candidate = rng.pick(BOUNCE_STEPS);
    if (!tooClose(kick, candidate, 2)) kick.push(candidate);
  }
  if (rng.chance(amount * 0.35) && kick.length > 2) {
    kick.splice(rng.int(1, kick.length - 1), 1);
  }

  bass.sort((a, b) => a.step - b.step);
  return { bass, kick: unique(kick), holes: groove.holes };
}
