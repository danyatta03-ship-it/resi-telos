import { ALL_TRACK_IDS, TICKS_PER_BAR } from '../types';
import type { Beat, BeatMeta, ChannelState, Clips, MoodId, NoteEvent, Section, TrackId } from '../types';
import { blendMoods } from '../music/moods';
import type { MoodProfile } from '../music/moods';
import { buildParams, defaultAxes } from '../music/params';
import type { GenParams } from '../music/params';
import { chordAtBar, pickProgression } from '../music/progressions';
import { Rng, randomSeed } from '../music/rng';
import { chordPitchClasses, chordRootMidi, keyLabel, pitchClass } from '../music/theory';
import { hashString, uid } from '../utils/id';
import { SECTION_PROFILES, STEP, trackActive } from './context';
import type { GenContext } from './context';
import { generateDrums } from './drums';
import { buildSilenceWindows } from './space';
import { buildGroove, varyGroove } from './groove';
import type { Groove } from './groove';
import { generate808 } from './bass808';
import { buildMotif, generateCounter, generateLead, renderMotif } from './melody';
import type { Motif } from './melody';
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
  hardness?: number;
  darkness?: number;
  space?: number;
  seed?: number;
  name?: string;
}

const DEFAULT_MIX: Partial<Record<TrackId, Partial<ChannelState>>> = {
  kick: { volume: 0 },
  snare: { volume: -3 },
  clap: { volume: -1 },
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

/**
 * Identita' musicale del beat: un solo motivo e un solo groove per tutto il
 * pezzo. Le sezioni ne cambiano la densita', non il materiale.
 */
export interface BeatIdentity {
  motif: Motif;
  groove: Groove;
  chordStyle: ChordStyle;
}

export function buildIdentity(meta: BeatMeta, params: GenParams): BeatIdentity {
  const motif = buildMotif(new Rng(hashString(`${meta.motifSeed}|motif`)), params, meta.scaleId);
  const groove = buildGroove(new Rng(hashString(`${meta.grooveSeed}|groove`)), params);
  const chordStyle = pickChordStyle(new Rng(hashString(`${meta.seed}|chordstyle`)), params.chordStyleWeights);
  return { motif, groove, chordStyle };
}

function sectionSeed(seed: number, seedKey: string, part: string): number {
  return hashString(`${seed}|${seedKey}|${part}`);
}

function makeContext(
  meta: BeatMeta,
  params: GenParams,
  slot: { kind: Section['kind']; bars: number },
  startBar: number,
  seed: number,
): GenContext {
  return {
    rng: new Rng(seed),
    meta,
    params,
    section: SECTION_PROFILES[slot.kind],
    bars: slot.bars,
    startBar,
  };
}

/** Peso di ogni traccia nel calcolo del minimalismo. */
const DENSITY_WEIGHT: Record<TrackId, number> = {
  kick: 1,
  snare: 1,
  clap: 0.6,
  hat: 0.28,
  openhat: 0.5,
  perc: 0.9,
  '808': 1,
  melody: 1,
  counter: 1.1,
  chords: 0.5,
  pad: 0.3,
  lead: 0.9,
};

/**
 * Ordine in cui si toglie quando il beat e' troppo pieno.
 *
 * Dipende dal carattere: in un beat cupo l'atmosfera e' il punto, quindi si
 * diradano prima gli hi-hat; in un beat hard si sacrifica prima il tappeto.
 */
function trimOrder(params: GenParams): (TrackId | 'hatThin')[] {
  const base: (TrackId | 'hatThin')[] = ['perc', 'counter', 'lead', 'openhat'];
  // Un beat hard vive di 808 e drum: il tappeto e' la prima cosa che salta.
  if (params.hardness >= 0.65) return [...base, 'pad', 'chords', 'hatThin'];
  // Altrimenti l'atmosfera e' il punto del pezzo: si diradano prima gli hi-hat.
  return [...base, 'hatThin', 'chords', 'pad'];
}

export function weightedDensity(clips: Clips, bars: number): number {
  let total = 0;
  for (const [track, notes] of Object.entries(clips) as [TrackId, NoteEvent[] | undefined][]) {
    total += (notes?.length ?? 0) * (DENSITY_WEIGHT[track] ?? 1);
  }
  return total / Math.max(1, bars);
}

/**
 * Passaggio di minimalismo: se la sezione e' troppo piena si tolgono elementi,
 * non se ne aggiungono. E' la decisione che prenderebbe un producer.
 */
function applyMinimalism(clips: Clips, bars: number, params: GenParams, energy: number): Clips {
  const limit = params.maxWeightedNotesPerBar * (0.75 + energy * 0.35);
  const out: Clips = { ...clips };

  for (const step of trimOrder(params)) {
    if (weightedDensity(out, bars) <= limit) break;
    if (step === 'hatThin') {
      if ((out.hat?.length ?? 0) > bars * 6) out.hat = (out.hat ?? []).filter((_, i) => i % 2 === 0);
      continue;
    }
    if ((out[step]?.length ?? 0) > 0) out[step] = [];
  }
  return out;
}

interface PartOptions {
  parts: Set<'drums' | '808' | 'melody' | 'chords'>;
}

function buildSectionClips(
  meta: BeatMeta,
  params: GenParams,
  identity: BeatIdentity,
  slot: { kind: Section['kind']; bars: number },
  startBar: number,
  seedKey: string,
  seed: number,
  options: PartOptions,
  existing: Clips = {},
): Clips {
  const clips: Clips = { ...existing };
  const { parts } = options;
  const profile = SECTION_PROFILES[slot.kind];

  // Il groove resta lo stesso, cambia solo di quanto respira nella sezione.
  const grooveRng = new Rng(sectionSeed(seed, seedKey, 'groove'));
  const groove = varyGroove(grooveRng, identity.groove, params, profile.energy);
  // Le finestre di silenzio sono comuni a tutti gli strumenti della sezione.
  const windows = buildSilenceWindows(
    new Rng(sectionSeed(seed, seedKey, 'space')),
    params,
    slot.bars,
    profile.energy,
  );

  if (parts.has('drums')) {
    const ctx = makeContext(meta, params, slot, startBar, sectionSeed(seed, seedKey, 'drums'));
    Object.assign(clips, generateDrums(ctx, groove, windows));
  }

  if (parts.has('808')) {
    const ctx = makeContext(meta, params, slot, startBar, sectionSeed(seed, seedKey, '808'));
    clips['808'] = trackActive(ctx, '808', 1.2) ? generate808(ctx, groove, windows) : [];
  }

  if (parts.has('chords')) {
    const ctx = makeContext(meta, params, slot, startBar, sectionSeed(seed, seedKey, 'chords'));
    const harmony = generateHarmony(ctx, identity.chordStyle);
    clips.chords = trackActive(ctx, 'chords', params.chordChance + 0.4) ? harmony.chords : [];
    clips.pad = trackActive(ctx, 'pad', params.padChance + 0.4) ? harmony.pad : [];
  }

  if (parts.has('melody')) {
    const ctx = makeContext(meta, params, slot, startBar, sectionSeed(seed, seedKey, 'melody'));
    const wantMelody = trackActive(ctx, 'melody', 1.3);
    if (wantMelody) {
      const melody = renderMotif(ctx, identity.motif, {
        density: profile.melodyDensity,
        velocityScale: 0.9 + profile.energy * 0.15,
        chordLock: 0.55 + params.catchiness * 0.2,
        windows,
      });
      clips.melody = melody;
      // Counter e lead esistono solo se aggiungono qualcosa.
      clips.counter =
        melody.length && trackActive(ctx, 'counter', params.counterChance + 0.25)
          ? generateCounter(ctx, melody)
          : [];
      clips.lead =
        melody.length && profile.energy > 0.7 && trackActive(ctx, 'lead', params.leadChance + 0.3)
          ? generateLead(ctx, melody)
          : [];
    } else {
      clips.melody = [];
      clips.counter = [];
      clips.lead = [];
    }
  }

  return applyMinimalism(clips, slot.bars, params, profile.energy);
}

const ALL_PARTS: PartOptions['parts'] = new Set(['drums', '808', 'melody', 'chords']);

/**
 * Transizione verso l'hook: l'ultima battuta si svuota, cosi' il ritornello
 * entra con piu' peso. Vale la regola del silenzio come parte del groove.
 */
function applyTransition(section: Section, params: GenParams, rng: Rng): Section {
  if (!rng.chance(0.55 + params.space * 0.35)) return section;
  const lastBeatStart = (section.bars - 1) * TICKS_PER_BAR + 3 * (TICKS_PER_BAR / 4);
  const clips: Clips = { ...section.clips };

  for (const track of ['kick', '808', 'perc', 'openhat'] as TrackId[]) {
    const notes = clips[track];
    if (!notes?.length) continue;
    clips[track] = notes.filter((n) => n.t < lastBeatStart);
  }
  return { ...section, clips };
}

function buildMeta(opts: GenerateOptions, seed: number): { meta: BeatMeta; profile: MoodProfile } {
  const rng = new Rng(seed);
  const profile = blendMoods(opts.moods);
  const axes = defaultAxes(profile);
  const hardness = Math.max(0, Math.min(100, opts.hardness ?? axes.hardness));
  const darkness = Math.max(0, Math.min(100, opts.darkness ?? axes.darkness));
  const space = Math.max(0, Math.min(100, opts.space ?? axes.space));

  // La cupezza sposta la scelta della scala verso i modi piu' scuri.
  const darkBias = darkness / 100;
  const scaleId = rng.weighted(
    profile.scales.map(([id, weight]) => {
      const dark = id === 'phrygian' || id === 'harmonicMinor' ? 1 + darkBias * 2 : 1;
      const simple = id === 'minorPentatonic' ? 1 + (hardness / 100) * 1.2 : 1;
      return [id, weight * dark * simple] as const;
    }),
  );

  const rootPc = rng.weighted(
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(
      (pc) => [pc, [3, 3, 2, 3, 2, 3, 2, 2, 3, 2, 2, 2][pc]] as const,
    ),
  );

  const base: BeatMeta = {
    bpm: Math.round(opts.bpm),
    moods: opts.moods,
    rootPc,
    scaleId,
    progression: [],
    variation: Math.max(0, Math.min(100, opts.variation ?? 45)),
    humanize: Math.max(0, Math.min(100, opts.humanize ?? 28)),
    hardness,
    darkness,
    space,
    seed,
    motifSeed: hashString(`${seed}|m`),
    grooveSeed: hashString(`${seed}|g`),
  };

  const params = buildParams(base, profile);
  base.progression = pickProgression(rng, scaleId, opts.moods, params);
  return { meta: base, profile };
}

function buildSections(
  meta: BeatMeta,
  params: GenParams,
  identity: BeatIdentity,
  slots: StructureSlot[],
): Section[] {
  const counters: Partial<Record<Section['kind'], number>> = {};
  let startBar = 0;

  return slots.map((slot, slotIndex) => {
    const index = (counters[slot.kind] = (counters[slot.kind] ?? 0) + 1);
    const id = uid('s');
    let section: Section = {
      id,
      kind: slot.kind,
      name: sectionLabel(slot.kind, index),
      bars: slot.bars,
      clips: buildSectionClips(
        meta,
        params,
        identity,
        slot,
        startBar,
        `${slotIndex}:${slot.kind}`,
        meta.seed,
        { parts: ALL_PARTS },
      ),
    };

    // Se dopo arriva l'hook, l'ultima battuta lascia spazio.
    const next = slots[slotIndex + 1];
    if (next?.kind === 'HOOK' && slot.kind !== 'HOOK') {
      section = applyTransition(section, params, new Rng(hashString(`${meta.seed}|trans|${slotIndex}`)));
    }

    startBar += slot.bars;
    return section;
  });
}

/** Genera un beat completo a partire da mood + BPM. */
export function generateBeat(opts: GenerateOptions): Beat {
  const seed = opts.seed ?? randomSeed();
  const { meta, profile } = buildMeta(opts, seed);
  const params = buildParams(meta, profile);
  const identity = buildIdentity(meta, params);
  const slots = buildStructure(new Rng(hashString(`${seed}|structure`)), params);
  const sections = buildSections(meta, params, identity, slots);

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

/**
 * Riporta l'808 esistente sulla nuova progressione mantenendo il suo ritmo:
 * cambiare gli accordi non deve lasciare il basso su note fuori armonia.
 */
function realign808(notes: NoteEvent[], meta: BeatMeta, previous: BeatMeta, startBar: number): NoteEvent[] {
  return notes.map((note) => {
    const bar = startBar + Math.floor(note.t / TICKS_PER_BAR);
    const oldChord = chordAtBar(previous.progression, bar);
    const newChord = chordAtBar(meta.progression, bar);
    const oldRoot = chordRootMidi(previous.rootPc, previous.scaleId, oldChord, 1);
    const newRoot = chordRootMidi(meta.rootPc, meta.scaleId, newChord, 1);
    let pitch = newRoot + (note.p - oldRoot);
    const tones = chordPitchClasses(meta.rootPc, meta.scaleId, newChord);
    if (!tones.includes(pitchClass(pitch))) {
      for (let delta = 1; delta <= 3; delta++) {
        if (tones.includes(pitchClass(pitch - delta))) {
          pitch -= delta;
          break;
        }
        if (tones.includes(pitchClass(pitch + delta))) {
          pitch += delta;
          break;
        }
      }
    }
    while (pitch > 47) pitch -= 12;
    while (pitch < 24) pitch += 12;
    return { ...note, p: pitch };
  });
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
      hardness: beat.meta.hardness,
      darkness: beat.meta.darkness,
      space: beat.meta.space,
      name: beat.name,
    });
    return { ...next, id: beat.id, createdAt: beat.createdAt, mixer: beat.mixer, masterVolume: beat.masterVolume };
  }

  let meta: BeatMeta = { ...beat.meta };
  const seed = randomSeed();

  if (target === 'melody') meta.motifSeed = seed;
  if (target === 'drums' || target === '808') meta.grooveSeed = seed;
  if (target === 'chords') {
    const params = buildParams(meta, profile);
    meta.progression = pickProgression(new Rng(seed), meta.scaleId, meta.moods, params);
  }

  const params = buildParams(meta, profile);
  const identity = buildIdentity(meta, params);

  if (target === 'structure') {
    meta = { ...meta, seed };
    const slots = buildStructure(new Rng(hashString(`${seed}|structure`)), params);
    return { ...beat, meta, sections: buildSections(meta, params, identity, slots), updatedAt: Date.now() };
  }

  const parts = new Set<'drums' | '808' | 'melody' | 'chords'>([target]);
  let startBar = 0;

  const sections = beat.sections.map((section, index) => {
    const source =
      target === 'chords' && section.clips['808']?.length
        ? { ...section.clips, '808': realign808(section.clips['808']!, meta, beat.meta, startBar) }
        : section.clips;

    const clips = buildSectionClips(
      meta,
      params,
      identity,
      { kind: section.kind, bars: section.bars },
      startBar,
      `${index}:${section.kind}`,
      seed,
      { parts },
      source,
    );
    startBar += section.bars;
    return { ...section, clips };
  });

  return { ...beat, meta, sections, updatedAt: Date.now() };
}

/** Rigenera una singola sezione (tutte le parti o una sola). */
export function regenerateSection(
  beat: Beat,
  sectionId: string,
  target: Exclude<RegenTarget, 'structure' | 'all'> | 'section',
): Beat {
  const profile = blendMoods(beat.meta.moods);
  const params = buildParams(beat.meta, profile);
  const identity = buildIdentity(beat.meta, params);
  const seed = randomSeed();
  const parts: PartOptions['parts'] =
    target === 'section' ? new Set(['drums', '808', 'melody', 'chords']) : new Set([target]);

  let startBar = 0;
  const sections = beat.sections.map((section, index) => {
    if (section.id !== sectionId) {
      startBar += section.bars;
      return section;
    }
    const clips = buildSectionClips(
      beat.meta,
      params,
      identity,
      { kind: section.kind, bars: section.bars },
      startBar,
      `${index}:${section.kind}`,
      seed,
      { parts },
      section.clips,
    );
    startBar += section.bars;
    return { ...section, clips };
  });

  return { ...beat, sections, updatedAt: Date.now() };
}

/** Crea una sezione nuova coerente con l'identita' del beat. */
export function createSection(beat: Beat, kind: Section['kind'], bars: number, atBar: number): Section {
  const profile = blendMoods(beat.meta.moods);
  const params = buildParams(beat.meta, profile);
  const identity = buildIdentity(beat.meta, params);
  const seed = randomSeed();
  const id = uid('s');
  const index = beat.sections.filter((s) => s.kind === kind).length + 1;

  return {
    id,
    kind,
    name: sectionLabel(kind, index),
    bars,
    clips: buildSectionClips(beat.meta, params, identity, { kind, bars }, atBar, id, seed, { parts: ALL_PARTS }),
  };
}

/** Adatta i clip quando l'utente cambia la lunghezza di una sezione. */
export function resizeSection(section: Section, bars: number): Section {
  const limit = bars * TICKS_PER_BAR;
  if (bars >= section.bars) {
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

/** Completa i beat salvati prima dell'introduzione dei nuovi parametri. */
export function normalizeBeat(beat: Beat): Beat {
  const profile = blendMoods(beat.meta.moods ?? ['dark']);
  const axes = defaultAxes(profile);
  const meta: BeatMeta = {
    ...beat.meta,
    hardness: beat.meta.hardness ?? axes.hardness,
    darkness: beat.meta.darkness ?? axes.darkness,
    space: beat.meta.space ?? axes.space,
    motifSeed: beat.meta.motifSeed ?? hashString(`${beat.meta.seed}|m`),
    grooveSeed: beat.meta.grooveSeed ?? hashString(`${beat.meta.seed}|g`),
  };
  return { ...beat, meta, mixer: { ...defaultMixer(), ...beat.mixer } };
}

export { STEP };
