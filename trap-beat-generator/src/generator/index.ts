import { ALL_TRACK_IDS, TICKS_PER_BAR } from '../types';
import type { Beat, BeatMeta, ChannelState, Clips, MoodId, Section, TrackId } from '../types';
import { blendMoods } from '../music/moods';
import type { MoodProfile } from '../music/moods';
import { pickProgression } from '../music/progressions';
import { Rng, randomSeed } from '../music/rng';
import { keyLabel } from '../music/theory';
import { hashString, uid } from '../utils/id';
import { SECTION_PROFILES, trackActive } from './context';
import type { GenContext } from './context';
import { generateDrums, kickOnsets } from './drums';
import { generate808 } from './bass808';
import { buildMotif, generateCounter, generateLead, generateMelody } from './melody';
import { generateHarmony, pickChordStyle } from './chords';
import type { ChordStyle } from './chords';
import { buildStructure, sectionLabel } from './structure';
import type { StructureSlot } from './structure';

export type RegenTarget = 'all' | 'drums' | '808' | 'melody' | 'chords' | 'structure';

export interface GenerateOptions {
  moods: MoodId[];
  bpm: number;
  variation?: number;
  humanize?: number;
  seed?: number;
  name?: string;
}

const DEFAULT_MIX: Partial<Record<TrackId, Partial<ChannelState>>> = {
  kick: { volume: 0 },
  snare: { volume: -3 },
  clap: { volume: -1, pan: 0.08 },
  hat: { volume: -5, pan: 0.12 },
  openhat: { volume: -8, pan: -0.1 },
  perc: { volume: -10, pan: -0.25 },
  '808': { volume: -1.5 },
  melody: { volume: -6 },
  counter: { volume: -11, pan: -0.3 },
  chords: { volume: -10, pan: 0.18 },
  pad: { volume: -13 },
  lead: { volume: -9, pan: 0.28 },
};

export function defaultMixer(): Record<TrackId, ChannelState> {
  const mixer = {} as Record<TrackId, ChannelState>;
  for (const id of ALL_TRACK_IDS) {
    mixer[id] = { volume: 0, pan: 0, mute: false, solo: false, ...DEFAULT_MIX[id] };
  }
  return mixer;
}

function sectionSeed(seed: number, seedKey: string, part: string): number {
  return hashString(`${seed}|${seedKey}|${part}`);
}

function makeContext(
  meta: BeatMeta,
  profile: MoodProfile,
  slot: { kind: Section['kind']; bars: number },
  startBar: number,
  seed: number,
): GenContext {
  return {
    rng: new Rng(seed),
    meta,
    profile,
    variation: meta.variation / 100,
    section: SECTION_PROFILES[slot.kind],
    bars: slot.bars,
    startBar,
  };
}

interface PartOptions {
  parts: Set<'drums' | '808' | 'melody' | 'chords'>;
  chordStyle: ChordStyle;
}

/** Genera (o rigenera) i clip di una sezione, preservando le parti non richieste. */
function buildSectionClips(
  meta: BeatMeta,
  profile: MoodProfile,
  slot: { kind: Section['kind']; bars: number },
  startBar: number,
  seedKey: string,
  seed: number,
  options: PartOptions,
  existing: Clips = {},
): Clips {
  const clips: Clips = { ...existing };
  const { parts } = options;

  if (parts.has('drums')) {
    const ctx = makeContext(meta, profile, slot, startBar, sectionSeed(seed, seedKey, 'drums'));
    Object.assign(clips, generateDrums(ctx));
  }

  if (parts.has('808')) {
    const ctx = makeContext(meta, profile, slot, startBar, sectionSeed(seed, seedKey, '808'));
    const active = trackActive(ctx, '808', 0.8 + profile.bassDensity);
    clips['808'] = active ? generate808(ctx, kickOnsets(clips)) : [];
  }

  if (parts.has('chords')) {
    const ctx = makeContext(meta, profile, slot, startBar, sectionSeed(seed, seedKey, 'chords'));
    const wantChords = trackActive(ctx, 'chords', 1.1);
    const wantPad = trackActive(ctx, 'pad', 0.6 + profile.pad);
    const harmony = generateHarmony(ctx, options.chordStyle);
    clips.chords = wantChords ? harmony.chords : [];
    clips.pad = wantPad ? harmony.pad : [];
  }

  if (parts.has('melody')) {
    const ctx = makeContext(meta, profile, slot, startBar, sectionSeed(seed, seedKey, 'melody'));
    const wantMelody = trackActive(ctx, 'melody', 1.3);
    if (wantMelody) {
      const motifBars = ctx.rng.chance(0.6) ? 2 : 1;
      const motif = buildMotif(ctx, Math.min(motifBars, slot.bars));
      const melody = generateMelody(ctx, motif, {
        chordLock: 0.65 + profile.motifRepeat * 0.2,
      });
      clips.melody = melody;
      clips.counter = trackActive(ctx, 'counter', 0.6 + profile.counter)
        ? generateCounter(ctx, melody)
        : [];
      clips.lead = trackActive(ctx, 'lead', 0.5 + profile.lead) ? generateLead(ctx, melody) : [];
    } else {
      clips.melody = [];
      clips.counter = [];
      clips.lead = [];
    }
  }

  return clips;
}

const ALL_PARTS: PartOptions['parts'] = new Set(['drums', '808', 'melody', 'chords']);

function buildMeta(opts: GenerateOptions, seed: number): { meta: BeatMeta; profile: MoodProfile } {
  const rng = new Rng(seed);
  const profile = blendMoods(opts.moods);
  const scaleId = rng.weighted(profile.scales.map(([s, w]) => [s, w] as const));
  // Le tonalita' basse sono le piu' usate nella trap: pesate leggermente di piu'.
  const rootPc = rng.weighted(
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((pc) => [pc, [3, 3, 2, 3, 2, 3, 2, 2, 3, 2, 2, 2][pc]] as const),
  );
  const variation = Math.max(0, Math.min(100, opts.variation ?? 50));
  const meta: BeatMeta = {
    bpm: Math.round(opts.bpm),
    moods: opts.moods,
    rootPc,
    scaleId,
    progression: pickProgression(rng, scaleId, opts.moods, profile.extensions * (0.5 + variation / 150)),
    variation,
    humanize: Math.max(0, Math.min(100, opts.humanize ?? 35)),
    seed,
  };
  return { meta, profile };
}

function buildSections(
  meta: BeatMeta,
  profile: MoodProfile,
  slots: StructureSlot[],
  chordStyle: ChordStyle,
): Section[] {
  const counters: Partial<Record<Section['kind'], number>> = {};
  let startBar = 0;
  return slots.map((slot, slotIndex) => {
    const index = (counters[slot.kind] = (counters[slot.kind] ?? 0) + 1);
    const id = uid('s');
    const section: Section = {
      id,
      kind: slot.kind,
      name: sectionLabel(slot.kind, index),
      bars: slot.bars,
      clips: buildSectionClips(meta, profile, slot, startBar, `${slotIndex}:${slot.kind}`, meta.seed, {
        parts: ALL_PARTS,
        chordStyle,
      }),
    };
    startBar += slot.bars;
    return section;
  });
}

/** Genera un beat completo a partire da mood + BPM. */
export function generateBeat(opts: GenerateOptions): Beat {
  const seed = opts.seed ?? randomSeed();
  const { meta, profile } = buildMeta(opts, seed);
  const rng = new Rng(hashString(`${seed}|structure`));
  const slots = buildStructure(rng, meta.variation / 100);
  const chordStyle = pickChordStyle(makeContext(meta, profile, slots[0], 0, hashString(`${seed}|style`)));
  const sections = buildSections(meta, profile, slots, chordStyle);

  return {
    id: uid('beat'),
    name: opts.name ?? `${keyLabel(meta.rootPc, meta.scaleId)} ${meta.bpm}BPM`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    meta,
    sections,
    mixer: defaultMixer(),
    masterVolume: -4,
  };
}

/** Rigenera solo una parte del beat, lasciando intatto il resto. */
export function regenerateBeat(beat: Beat, target: RegenTarget): Beat {
  const profile = blendMoods(beat.meta.moods);

  if (target === 'all') {
    const next = generateBeat({
      moods: beat.meta.moods,
      bpm: beat.meta.bpm,
      variation: beat.meta.variation,
      humanize: beat.meta.humanize,
      name: beat.name,
    });
    return { ...next, id: beat.id, createdAt: beat.createdAt, mixer: beat.mixer, masterVolume: beat.masterVolume };
  }

  if (target === 'structure') {
    const seed = randomSeed();
    const rng = new Rng(hashString(`${seed}|structure`));
    const slots = buildStructure(rng, beat.meta.variation / 100);
    const meta = { ...beat.meta, seed };
    const chordStyle = pickChordStyle(makeContext(meta, profile, slots[0], 0, hashString(`${seed}|style`)));
    return {
      ...beat,
      meta,
      sections: buildSections(meta, profile, slots, chordStyle),
      updatedAt: Date.now(),
    };
  }

  const seed = randomSeed();
  const parts = new Set<'drums' | '808' | 'melody' | 'chords'>([target]);
  // Se cambiano gli accordi, la progressione va ricostruita e 808/melodia vanno riallineati.
  let meta = beat.meta;
  if (target === 'chords') {
    const rng = new Rng(seed);
    meta = {
      ...beat.meta,
      progression: pickProgression(rng, beat.meta.scaleId, beat.meta.moods, profile.extensions),
    };
  }

  const chordStyle = pickChordStyle(
    makeContext(meta, profile, { kind: beat.sections[0]?.kind ?? 'HOOK', bars: 4 }, 0, hashString(`${seed}|style`)),
  );

  let startBar = 0;
  const sections = beat.sections.map((section, index) => {
    const clips = buildSectionClips(
      meta,
      profile,
      { kind: section.kind, bars: section.bars },
      startBar,
      `${index}:${section.kind}`,
      seed,
      { parts, chordStyle },
      section.clips,
    );
    startBar += section.bars;
    return { ...section, clips };
  });

  return { ...beat, meta, sections, updatedAt: Date.now() };
}

/** Rigenera una singola sezione (tutte le parti o una sola). */
export function regenerateSection(beat: Beat, sectionId: string, target: Exclude<RegenTarget, 'structure' | 'all'> | 'section'): Beat {
  const profile = blendMoods(beat.meta.moods);
  const seed = randomSeed();
  const parts: PartOptions['parts'] =
    target === 'section' ? new Set(['drums', '808', 'melody', 'chords']) : new Set([target]);
  const chordStyle = pickChordStyle(
    makeContext(beat.meta, profile, { kind: 'HOOK', bars: 4 }, 0, hashString(`${seed}|style`)),
  );

  let startBar = 0;
  const sections = beat.sections.map((section) => {
    if (section.id !== sectionId) {
      startBar += section.bars;
      return section;
    }
    const clips = buildSectionClips(
      beat.meta,
      profile,
      { kind: section.kind, bars: section.bars },
      startBar,
      section.id,
      seed,
      { parts, chordStyle },
      section.clips,
    );
    startBar += section.bars;
    return { ...section, clips };
  });

  return { ...beat, sections, updatedAt: Date.now() };
}

/** Crea una sezione vuota generata da zero (usata dal pulsante "aggiungi sezione"). */
export function createSection(beat: Beat, kind: Section['kind'], bars: number, atBar: number): Section {
  const profile = blendMoods(beat.meta.moods);
  const seed = randomSeed();
  const id = uid('s');
  const index = beat.sections.filter((s) => s.kind === kind).length + 1;
  const chordStyle = pickChordStyle(
    makeContext(beat.meta, profile, { kind, bars }, atBar, hashString(`${seed}|style`)),
  );
  return {
    id,
    kind,
    name: sectionLabel(kind, index),
    bars,
    clips: buildSectionClips(beat.meta, profile, { kind, bars }, atBar, id, seed, {
      parts: ALL_PARTS,
      chordStyle,
    }),
  };
}

/** Adatta i clip quando l'utente cambia la lunghezza di una sezione. */
export function resizeSection(section: Section, bars: number): Section {
  const limit = bars * TICKS_PER_BAR;
  if (bars >= section.bars) {
    // Allunga ripetendo il materiale esistente.
    const clips: Clips = {};
    for (const [track, notes] of Object.entries(section.clips)) {
      if (!notes) continue;
      const out = notes.slice();
      const sourceLen = section.bars * TICKS_PER_BAR;
      for (let offset = sourceLen; offset < limit; offset += sourceLen) {
        for (const n of notes) {
          const t = n.t + offset;
          if (t >= limit) continue;
          out.push({ ...n, id: uid('r'), t, d: Math.min(n.d, limit - t) });
        }
      }
      clips[track as TrackId] = out.sort((a, b) => a.t - b.t);
    }
    return { ...section, bars, clips };
  }

  const clips: Clips = {};
  for (const [track, notes] of Object.entries(section.clips)) {
    if (!notes) continue;
    clips[track as TrackId] = notes
      .filter((n) => n.t < limit)
      .map((n) => ({ ...n, d: Math.min(n.d, limit - n.t) }));
  }
  return { ...section, bars, clips };
}
