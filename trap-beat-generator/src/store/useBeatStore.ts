import { create } from 'zustand';
import { TICKS_PER_BAR } from '../types';
import type { Beat, ChannelState, MoodId, NoteEvent, ScaleId, Section, SectionKind, TrackId } from '../types';
import { createSection, defaultMixer, generateBeat, regenerateBeat, regenerateSection, resizeSection } from '../generator';
import type { RegenTarget } from '../generator';
import { diatonicQuality, romanFor, snapToScale } from '../music/theory';
import { uid } from '../utils/id';
import * as storage from './persistence';

export type Phase = 'setup' | 'studio';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface BeatState {
  phase: Phase;
  beat: Beat | null;
  selectedSectionId: string | null;
  selectedTrack: TrackId;
  loopSection: boolean;
  savedBeats: Beat[];
  toasts: Toast[];
  busy: string | null;

  // setup
  setPhase: (phase: Phase) => void;
  generate: (opts: { moods: MoodId[]; bpm: number; variation?: number; humanize?: number }) => void;
  adoptBeat: (beat: Beat) => void;

  // meta
  setBpm: (bpm: number) => void;
  setVariation: (value: number) => void;
  setHumanize: (value: number) => void;
  setName: (name: string) => void;
  setKey: (rootPc: number, scaleId: ScaleId) => void;
  regenerate: (target: RegenTarget) => void;
  regenerateOneSection: (sectionId: string, target: 'section' | 'drums' | '808' | 'melody' | 'chords') => void;

  // mixer
  setChannel: (track: TrackId, patch: Partial<ChannelState>) => void;
  toggleMute: (track: TrackId) => void;
  toggleSolo: (track: TrackId) => void;
  setMasterVolume: (db: number) => void;

  // editing
  selectSection: (id: string) => void;
  selectTrack: (track: TrackId) => void;
  setLoopSection: (value: boolean) => void;
  addNote: (sectionId: string, track: TrackId, note: Omit<NoteEvent, 'id'>) => void;
  updateNote: (sectionId: string, track: TrackId, noteId: string, patch: Partial<NoteEvent>) => void;
  deleteNote: (sectionId: string, track: TrackId, noteId: string) => void;
  clearTrack: (sectionId: string, track: TrackId) => void;

  // arrangement
  addSection: (kind: SectionKind, bars: number, index?: number) => void;
  removeSection: (id: string) => void;
  duplicateSection: (id: string) => void;
  moveSection: (id: string, direction: -1 | 1) => void;
  resizeSectionTo: (id: string, bars: number) => void;
  renameSection: (id: string, name: string) => void;

  // progetti
  refreshProjects: () => Promise<void>;
  saveProject: (name?: string) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;

  notify: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  setBusy: (label: string | null) => void;
}

function touch(beat: Beat): Beat {
  return { ...beat, updatedAt: Date.now() };
}

function mapSection(beat: Beat, sectionId: string, fn: (section: Section) => Section): Beat {
  return touch({
    ...beat,
    sections: beat.sections.map((s) => (s.id === sectionId ? fn(s) : s)),
  });
}

function mapClip(section: Section, track: TrackId, fn: (notes: NoteEvent[]) => NoteEvent[]): Section {
  return { ...section, clips: { ...section.clips, [track]: fn(section.clips[track] ?? []) } };
}

export const useBeatStore = create<BeatState>((set, get) => ({
  phase: 'setup',
  beat: null,
  selectedSectionId: null,
  selectedTrack: 'melody',
  loopSection: false,
  savedBeats: [],
  toasts: [],
  busy: null,

  setPhase: (phase) => set({ phase }),

  generate: ({ moods, bpm, variation = 50, humanize = 35 }) => {
    const beat = generateBeat({ moods, bpm, variation, humanize });
    const hook = beat.sections.find((s) => s.kind === 'HOOK') ?? beat.sections[0];
    set({ beat, phase: 'studio', selectedSectionId: hook?.id ?? null, selectedTrack: 'melody' });
    storage.autosave(beat);
  },

  adoptBeat: (beat) => {
    const hook = beat.sections.find((s) => s.kind === 'HOOK') ?? beat.sections[0];
    set({ beat, phase: 'studio', selectedSectionId: hook?.id ?? null });
    storage.autosave(beat);
  },

  setBpm: (bpm) => {
    const beat = get().beat;
    if (!beat) return;
    const next = touch({ ...beat, meta: { ...beat.meta, bpm: Math.round(bpm) } });
    set({ beat: next });
  },

  setVariation: (value) => {
    const beat = get().beat;
    if (!beat) return;
    set({ beat: touch({ ...beat, meta: { ...beat.meta, variation: Math.round(value) } }) });
  },

  setHumanize: (value) => {
    const beat = get().beat;
    if (!beat) return;
    set({ beat: touch({ ...beat, meta: { ...beat.meta, humanize: Math.round(value) } }) });
  },

  setName: (name) => {
    const beat = get().beat;
    if (!beat) return;
    set({ beat: touch({ ...beat, name }) });
  },

  setKey: (rootPc, scaleId) => {
    const beat = get().beat;
    if (!beat) return;
    let delta = rootPc - beat.meta.rootPc;
    if (delta > 6) delta -= 12;
    if (delta < -6) delta += 12;
    const scaleChanged = scaleId !== beat.meta.scaleId;

    const sections = beat.sections.map((section) => {
      const clips = { ...section.clips };
      for (const track of Object.keys(clips) as TrackId[]) {
        // Le percussioni non vanno trasposte: la loro altezza e' il suono stesso.
        if (['kick', 'snare', 'clap', 'hat', 'openhat', 'perc'].includes(track)) continue;
        clips[track] = (clips[track] ?? []).map((n) => {
          const moved = n.p + delta;
          return { ...n, p: scaleChanged ? snapToScale(moved, rootPc, scaleId) : moved };
        });
      }
      return { ...section, clips };
    });

    // Con una scala nuova cambiano anche le qualita' degli accordi della progressione.
    const progression = scaleChanged
      ? beat.meta.progression.map((chord) => {
          const seventh = chord.quality.includes('7') || chord.quality.includes('9');
          const quality = diatonicQuality(scaleId, chord.degree, seventh);
          return { ...chord, quality, roman: romanFor(scaleId, chord.degree, quality) };
        })
      : beat.meta.progression;

    set({ beat: touch({ ...beat, meta: { ...beat.meta, rootPc, scaleId, progression }, sections }) });
  },

  regenerate: (target) => {
    const beat = get().beat;
    if (!beat) return;
    const next = regenerateBeat(beat, target);
    const stillThere = next.sections.some((s) => s.id === get().selectedSectionId);
    set({
      beat: next,
      selectedSectionId: stillThere ? get().selectedSectionId : (next.sections[0]?.id ?? null),
    });
    storage.autosave(next);
    get().notify(
      target === 'all' ? 'Beat rigenerato' : `Rigenerato: ${target === '808' ? '808' : target}`,
      'success',
    );
  },

  regenerateOneSection: (sectionId, target) => {
    const beat = get().beat;
    if (!beat) return;
    const next = regenerateSection(beat, sectionId, target);
    set({ beat: next });
    get().notify('Sezione rigenerata', 'success');
  },

  setChannel: (track, patch) => {
    const beat = get().beat;
    if (!beat) return;
    set({
      beat: touch({ ...beat, mixer: { ...beat.mixer, [track]: { ...beat.mixer[track], ...patch } } }),
    });
  },

  toggleMute: (track) => get().setChannel(track, { mute: !get().beat?.mixer[track].mute }),
  toggleSolo: (track) => get().setChannel(track, { solo: !get().beat?.mixer[track].solo }),

  setMasterVolume: (db) => {
    const beat = get().beat;
    if (!beat) return;
    set({ beat: touch({ ...beat, masterVolume: db }) });
  },

  selectSection: (id) => set({ selectedSectionId: id }),
  selectTrack: (track) => set({ selectedTrack: track }),
  setLoopSection: (value) => set({ loopSection: value }),

  addNote: (sectionId, track, note) => {
    const beat = get().beat;
    if (!beat) return;
    set({
      beat: mapSection(beat, sectionId, (section) =>
        mapClip(section, track, (notes) =>
          [...notes, { ...note, id: uid('u') }].sort((a, b) => a.t - b.t),
        ),
      ),
    });
  },

  updateNote: (sectionId, track, noteId, patch) => {
    const beat = get().beat;
    if (!beat) return;
    set({
      beat: mapSection(beat, sectionId, (section) =>
        mapClip(section, track, (notes) =>
          notes.map((n) => (n.id === noteId ? { ...n, ...patch } : n)).sort((a, b) => a.t - b.t),
        ),
      ),
    });
  },

  deleteNote: (sectionId, track, noteId) => {
    const beat = get().beat;
    if (!beat) return;
    set({
      beat: mapSection(beat, sectionId, (section) =>
        mapClip(section, track, (notes) => notes.filter((n) => n.id !== noteId)),
      ),
    });
  },

  clearTrack: (sectionId, track) => {
    const beat = get().beat;
    if (!beat) return;
    set({ beat: mapSection(beat, sectionId, (section) => mapClip(section, track, () => [])) });
  },

  addSection: (kind, bars, index) => {
    const beat = get().beat;
    if (!beat) return;
    const at = index ?? beat.sections.length;
    const startBar = beat.sections.slice(0, at).reduce((s, sec) => s + sec.bars, 0);
    const section = createSection(beat, kind, bars, startBar);
    const sections = [...beat.sections];
    sections.splice(at, 0, section);
    set({ beat: touch({ ...beat, sections }), selectedSectionId: section.id });
    get().notify(`Sezione ${section.name} aggiunta`, 'success');
  },

  removeSection: (id) => {
    const beat = get().beat;
    if (!beat || beat.sections.length <= 1) return;
    const sections = beat.sections.filter((s) => s.id !== id);
    set({
      beat: touch({ ...beat, sections }),
      selectedSectionId: get().selectedSectionId === id ? sections[0].id : get().selectedSectionId,
    });
  },

  duplicateSection: (id) => {
    const beat = get().beat;
    if (!beat) return;
    const index = beat.sections.findIndex((s) => s.id === id);
    if (index < 0) return;
    const source = beat.sections[index];
    const copy: Section = {
      ...structuredClone(source),
      id: uid('s'),
      name: `${source.name} copy`,
    };
    for (const track of Object.keys(copy.clips) as TrackId[]) {
      copy.clips[track] = (copy.clips[track] ?? []).map((n) => ({ ...n, id: uid('u') }));
    }
    const sections = [...beat.sections];
    sections.splice(index + 1, 0, copy);
    set({ beat: touch({ ...beat, sections }), selectedSectionId: copy.id });
  },

  moveSection: (id, direction) => {
    const beat = get().beat;
    if (!beat) return;
    const index = beat.sections.findIndex((s) => s.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= beat.sections.length) return;
    const sections = [...beat.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    set({ beat: touch({ ...beat, sections }) });
  },

  resizeSectionTo: (id, bars) => {
    const beat = get().beat;
    if (!beat) return;
    const clamped = Math.max(1, Math.min(32, Math.round(bars)));
    set({ beat: mapSection(beat, id, (section) => resizeSection(section, clamped)) });
  },

  renameSection: (id, name) => {
    const beat = get().beat;
    if (!beat) return;
    set({ beat: mapSection(beat, id, (section) => ({ ...section, name })) });
  },

  refreshProjects: async () => {
    const beats = await storage.listBeats();
    set({ savedBeats: beats });
  },

  saveProject: async (name) => {
    const beat = get().beat;
    if (!beat) return;
    const toSave = name ? { ...beat, name } : beat;
    await storage.saveBeat(toSave);
    set({ beat: { ...toSave, updatedAt: Date.now() } });
    await get().refreshProjects();
    get().notify(`"${toSave.name}" salvato`, 'success');
  },

  loadProject: async (id) => {
    const beat = await storage.loadBeat(id);
    if (!beat) {
      get().notify('Progetto non trovato', 'error');
      return;
    }
    // I progetti salvati prima di un aggiornamento potrebbero non avere tutti i canali.
    const mixer = { ...defaultMixer(), ...beat.mixer };
    get().adoptBeat({ ...beat, mixer });
    get().notify(`"${beat.name}" caricato`, 'success');
  },

  deleteProject: async (id) => {
    await storage.deleteBeat(id);
    await get().refreshProjects();
    get().notify('Progetto eliminato');
  },

  duplicateProject: async (id) => {
    const copy = await storage.duplicateBeat(id);
    await get().refreshProjects();
    if (copy) get().notify(`Creata copia "${copy.name}"`, 'success');
  },

  notify: (message, tone = 'info') => {
    const toast: Toast = { id: uid('t'), message, tone };
    set({ toasts: [...get().toasts.slice(-2), toast] });
    setTimeout(() => get().dismissToast(toast.id), 3200);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setBusy: (label) => set({ busy: label }),
}));

/** Tick assoluto di inizio di ogni sezione. */
export function sectionOffsets(beat: Beat | null): Record<string, { startTick: number; endTick: number; startBar: number }> {
  const out: Record<string, { startTick: number; endTick: number; startBar: number }> = {};
  let tick = 0;
  let bar = 0;
  for (const section of beat?.sections ?? []) {
    const length = section.bars * TICKS_PER_BAR;
    out[section.id] = { startTick: tick, endTick: tick + length, startBar: bar };
    tick += length;
    bar += section.bars;
  }
  return out;
}
