/** Risoluzione MIDI: tick per quarto. 480 divide bene 16esimi (120), 32esimi (60) e terzine (160/80). */
export const PPQ = 480;
export const TICKS_PER_BAR = PPQ * 4;

export type TrackId =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hat'
  | 'openhat'
  | 'perc'
  | '808'
  | 'melody'
  | 'counter'
  | 'chords'
  | 'pad'
  | 'lead';

export type TrackGroup = 'drums' | 'bass' | 'melodic';

export interface TrackDef {
  id: TrackId;
  label: string;
  group: TrackGroup;
  /** I canali drum lavorano su una nota fissa (step sequencer), i melodici sul piano roll. */
  drumPitch?: number;
  color: string;
  /** Nome traccia usato nell'export MIDI. */
  midiName: string;
  /** Canale MIDI 0-based; 9 = percussioni GM. */
  midiChannel: number;
}

export interface NoteEvent {
  id: string;
  /** Start in tick, relativo all'inizio della sezione. */
  t: number;
  /** Durata in tick. */
  d: number;
  /** Pitch MIDI 0-127. */
  p: number;
  /** Velocity 1-127. */
  v: number;
  /** Solo 808: glide verso la nota successiva (pitch bend in export). */
  slide?: boolean;
}

export type Clips = Partial<Record<TrackId, NoteEvent[]>>;

export type SectionKind = 'INTRO' | 'HOOK' | 'VERSE' | 'PRE' | 'BRIDGE' | 'OUTRO';

export interface Section {
  id: string;
  kind: SectionKind;
  name: string;
  bars: number;
  clips: Clips;
}

export type MoodId =
  | 'dark'
  | 'aggressive'
  | 'melodic'
  | 'sad'
  | 'emotional'
  | 'chill'
  | 'atmospheric'
  | 'energetic'
  | 'street'
  | 'ominous'
  | 'futuristic'
  | 'luxury'
  | 'ambient';

export type ChordQuality =
  | 'min'
  | 'maj'
  | 'dim'
  | 'aug'
  | 'min7'
  | 'maj7'
  | 'dom7'
  | 'min9'
  | 'maj9'
  | 'sus2'
  | 'sus4'
  | 'min6'
  | 'halfdim7';

export interface ChordDef {
  /** Grado della scala 0-6 (0 = tonica). */
  degree: number;
  quality: ChordQuality;
  /** Etichetta con numeri romani, es. "i", "VI", "III". */
  roman: string;
  /** Durata in battute. */
  bars: number;
}

export interface BeatMeta {
  bpm: number;
  moods: MoodId[];
  /** Pitch class della tonica (0 = C). */
  rootPc: number;
  scaleId: ScaleId;
  progression: ChordDef[];
  /** 0-100, quanto il generatore osa. */
  variation: number;
  /** 0-100, micro imperfezioni umane. */
  humanize: number;
  seed: number;
}

export interface ChannelState {
  /** Volume in dB, -60..+6. */
  volume: number;
  /** Pan -1..1. */
  pan: number;
  mute: boolean;
  solo: boolean;
}

export interface Beat {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  meta: BeatMeta;
  sections: Section[];
  mixer: Record<TrackId, ChannelState>;
  masterVolume: number;
}

export type ScaleId =
  | 'minor'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'dorian'
  | 'phrygian'
  | 'major'
  | 'mixolydian'
  | 'lydian'
  | 'minorPentatonic'
  | 'majorPentatonic'
  | 'hirajoshi'
  | 'wholeTone';

export const TRACKS: TrackDef[] = [
  { id: 'kick', label: 'Kick', group: 'drums', drumPitch: 36, color: '#ff6b35', midiName: 'Kick', midiChannel: 9 },
  { id: 'snare', label: 'Snare', group: 'drums', drumPitch: 38, color: '#ffb347', midiName: 'Snare', midiChannel: 9 },
  { id: 'clap', label: 'Clap', group: 'drums', drumPitch: 39, color: '#ffd166', midiName: 'Clap', midiChannel: 9 },
  { id: 'hat', label: 'Hi-Hat', group: 'drums', drumPitch: 42, color: '#39dfa0', midiName: 'HiHat', midiChannel: 9 },
  { id: 'openhat', label: 'Open Hat', group: 'drums', drumPitch: 46, color: '#7df0c2', midiName: 'OpenHat', midiChannel: 9 },
  { id: 'perc', label: 'Perc', group: 'drums', drumPitch: 75, color: '#4dd0e1', midiName: 'Perc', midiChannel: 9 },
  { id: '808', label: '808', group: 'bass', color: '#ff4d6d', midiName: '808 Bass', midiChannel: 0 },
  { id: 'melody', label: 'Melody', group: 'melodic', color: '#8b5cf6', midiName: 'Main Melody', midiChannel: 1 },
  { id: 'counter', label: 'Counter', group: 'melodic', color: '#b18cff', midiName: 'Counter Melody', midiChannel: 2 },
  { id: 'chords', label: 'Chords', group: 'melodic', color: '#5ab0ff', midiName: 'Chords', midiChannel: 3 },
  { id: 'pad', label: 'Pad', group: 'melodic', color: '#6ee7ff', midiName: 'Pad', midiChannel: 4 },
  { id: 'lead', label: 'Lead', group: 'melodic', color: '#f472b6', midiName: 'Lead', midiChannel: 5 },
];

export const TRACK_MAP: Record<TrackId, TrackDef> = TRACKS.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<TrackId, TrackDef>,
);

export const DRUM_TRACKS = TRACKS.filter((t) => t.group === 'drums').map((t) => t.id);
export const MELODIC_TRACKS = TRACKS.filter((t) => t.group !== 'drums').map((t) => t.id);
export const ALL_TRACK_IDS = TRACKS.map((t) => t.id);
