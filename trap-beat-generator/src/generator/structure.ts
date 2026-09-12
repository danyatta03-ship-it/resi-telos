import type { SectionKind } from '../types';
import type { GenParams } from '../music/params';
import type { Rng } from '../music/rng';
import { SECTION_PROFILES } from './context';

export interface StructureSlot {
  kind: SectionKind;
  bars: number;
}

/**
 * Forma da singolo, non da demo.
 *
 * Nella trap italiana da classifica il ritornello arriva quasi subito: intro
 * corta con la sola melodia, hook entro i primi dieci secondi, poi strofa lunga
 * per il rapper e ritorno dell'hook. L'ultimo ritornello alza di un'ottava.
 */
const TEMPLATES: { kinds: SectionKind[]; weight: number }[] = [
  { kinds: ['INTRO', 'HOOK', 'VERSE', 'HOOK', 'VERSE', 'HOOK', 'OUTRO'], weight: 5 },
  { kinds: ['INTRO', 'HOOK', 'VERSE', 'HOOK', 'OUTRO'], weight: 4 },
  { kinds: ['HOOK', 'VERSE', 'HOOK', 'VERSE', 'HOOK', 'OUTRO'], weight: 2 },
  { kinds: ['INTRO', 'HOOK', 'VERSE', 'PRE', 'HOOK', 'VERSE', 'HOOK', 'OUTRO'], weight: 2 },
  { kinds: ['INTRO', 'VERSE', 'HOOK', 'VERSE', 'HOOK', 'OUTRO'], weight: 1 },
];

const KIND_LABEL: Record<SectionKind, string> = {
  INTRO: 'Intro',
  HOOK: 'Hook',
  VERSE: 'Verse',
  PRE: 'Pre-Hook',
  BRIDGE: 'Bridge',
  OUTRO: 'Outro',
};

/** Colori delle sezioni, condivisi fra timeline ed export FL Studio. */
export const KIND_COLOR: Record<SectionKind, string> = {
  INTRO: '#5ab0ff',
  HOOK: '#39dfa0',
  VERSE: '#8b5cf6',
  PRE: '#ffb347',
  BRIDGE: '#f472b6',
  OUTRO: '#6ee7ff',
};

export function sectionLabel(kind: SectionKind, index: number): string {
  return `${KIND_LABEL[kind]} ${index}`;
}

export function buildStructure(rng: Rng, params: GenParams): StructureSlot[] {
  const template = rng.weighted(
    TEMPLATES.map((t, i) => [t.kinds, i === 0 ? t.weight : t.weight * (0.5 + params.variation)] as const),
  );

  return template.map((kind) => {
    const options = SECTION_PROFILES[kind].barOptions;
    // Intro corta, strofe lunghe: e' li' che rappa chi ci canta sopra.
    const bars =
      kind === 'VERSE' ? rng.pick([16, 16, 8]) : kind === 'INTRO' ? rng.pick([4, 4, 8]) : rng.pick(options);
    return { kind, bars };
  });
}

export { KIND_LABEL };
