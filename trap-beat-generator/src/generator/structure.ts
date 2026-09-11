import type { SectionKind } from '../types';
import type { Rng } from '../music/rng';
import { SECTION_PROFILES } from './context';

export interface StructureSlot {
  kind: SectionKind;
  bars: number;
}

const TEMPLATES: SectionKind[][] = [
  ['INTRO', 'HOOK', 'VERSE', 'PRE', 'HOOK', 'OUTRO'],
  ['INTRO', 'HOOK', 'VERSE', 'HOOK', 'VERSE', 'HOOK', 'OUTRO'],
  ['INTRO', 'VERSE', 'PRE', 'HOOK', 'VERSE', 'HOOK', 'OUTRO'],
  ['INTRO', 'HOOK', 'VERSE', 'PRE', 'HOOK', 'BRIDGE', 'HOOK', 'OUTRO'],
  ['INTRO', 'HOOK', 'VERSE', 'HOOK', 'BRIDGE', 'HOOK', 'OUTRO'],
];

const KIND_LABEL: Record<SectionKind, string> = {
  INTRO: 'Intro',
  HOOK: 'Hook',
  VERSE: 'Verse',
  PRE: 'Pre-Hook',
  BRIDGE: 'Bridge',
  OUTRO: 'Outro',
};

export function sectionLabel(kind: SectionKind, index: number): string {
  return `${KIND_LABEL[kind]} ${index}`;
}

/** Costruisce la scaletta della traccia: intro, hook, verse, ecc. */
export function buildStructure(rng: Rng, variation: number): StructureSlot[] {
  const template = rng.weighted(
    TEMPLATES.map((t, i) => [t, i === 0 ? 3 : 1 + variation * 2] as const),
  );
  return template.map((kind) => {
    const options = SECTION_PROFILES[kind].barOptions;
    return { kind, bars: rng.pick(options) };
  });
}

export { KIND_LABEL };
