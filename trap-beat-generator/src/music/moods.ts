import type { MoodId, ScaleId } from '../types';

export interface MoodProfile {
  id: MoodId;
  label: string;
  blurb: string;
  accent: string;
  /** Scale candidate con peso relativo. */
  scales: [ScaleId, number][];
  /** BPM tipico suggerito nella schermata iniziale. */
  bpmRange: [number, number];

  // --- Drums ---
  /** 0-1: quanti kick oltre al pattern base. */
  kickDensity: number;
  /** 0-1: probabilita' di ghost snare / rullate extra. */
  snareGhost: number;
  /** Peso delle suddivisioni hi-hat: [1/4, 1/8, 1/16, 1/32]. */
  hatRateWeights: [number, number, number, number];
  /** 0-1: quantita' di roll e terzine sugli hat. */
  hatRolls: number;
  /** 0-1: presenza di open hat. */
  openHat: number;
  /** 0-1: presenza di percussioni. */
  perc: number;
  /** 0-1: quanto e' aggressiva la sincope generale. */
  syncopation: number;

  // --- 808 ---
  /** 0-1: densita' di note dell'808. */
  bassDensity: number;
  /** 0-1: probabilita' di glide tra note. */
  slide: number;
  /** 0-1: probabilita' di salti di ottava. */
  octaveJump: number;
  /** 0-1: 0 = note staccate, 1 = note lunghe tenute. */
  bassSustain: number;

  // --- Melodia ---
  /** Ottava di riferimento della main melody. */
  melodyOctave: number;
  /** 0-1: densita' di note. */
  melodyDensity: number;
  /** 0-1: quantita' di pause/respiro. */
  rest: number;
  /** 0-1: preferenza per salti ampi invece che gradi congiunti. */
  leap: number;
  /** 0-1: quanto il motivo viene ripetuto identico. */
  motifRepeat: number;
  /** 0-1: 0 = note corte staccate, 1 = note lunghe legate. */
  melodySustain: number;

  // --- Armonia / texture ---
  /** 0-1: probabilita' di settime ed estensioni. */
  extensions: number;
  /** Pesi per il ritmo degli accordi: [sustain, stab, arpeggio]. */
  chordStyleWeights: [number, number, number];
  /** 0-1: probabilita' che il pad sia presente. */
  pad: number;
  /** 0-1: probabilita' che il lead sia presente. */
  lead: number;
  /** 0-1: probabilita' che la counter melody sia presente. */
  counter: number;

  // --- Dinamica ---
  /** Velocity media 0-127. */
  velocity: number;
  /** Escursione di velocity. */
  velocitySpread: number;
  /** 0-1: swing applicato in playback/export. */
  swing: number;

  // --- Assi del motore (0-100) ---
  /** Cattiveria: kick, 808, velocity, sincopi. */
  hardness: number;
  /** Cupezza: scale, intervalli, registro, tensione armonica. */
  darkness: number;
  /** Quanto silenzio lascia il beat. */
  space: number;
  /** 0-1: quanto il motivo deve risultare immediato e ripetuto. */
  catchiness: number;
}

export const MOODS: Record<MoodId, MoodProfile> = {
  hard: {
    id: 'hard', label: 'Hard', blurb: 'Impatto subito: 808 pesante, kick bouncy, poche note', accent: '#ff4d4d',
    scales: [['minorPentatonic', 4], ['minor', 3], ['phrygian', 2], ['harmonicMinor', 1]],
    bpmRange: [135, 150],
    kickDensity: 0.62, snareGhost: 0.22, hatRateWeights: [0, 2, 4, 1], hatRolls: 0.45, openHat: 0.4, perc: 0.25,
    syncopation: 0.8, bassDensity: 0.45, slide: 0.3, octaveJump: 0.45, bassSustain: 0.45,
    melodyOctave: 5, melodyDensity: 0.35, rest: 0.5, leap: 0.35, motifRepeat: 0.85, melodySustain: 0.45,
    extensions: 0.2, chordStyleWeights: [3, 2, 1], pad: 0.35, lead: 0.4, counter: 0.2,
    velocity: 108, velocitySpread: 16, swing: 0.01,
    hardness: 90, darkness: 65, space: 55, catchiness: 0.9,
  },
  dark: {
    id: 'dark', label: 'Dark', blurb: 'Minore cupo, 808 pesante, hat serrati', accent: '#8b5cf6',
    scales: [['minor', 4], ['phrygian', 3], ['harmonicMinor', 2], ['minorPentatonic', 1]],
    bpmRange: [130, 150],
    kickDensity: 0.55, snareGhost: 0.25, hatRateWeights: [0, 1, 4, 2], hatRolls: 0.5, openHat: 0.4, perc: 0.35,
    syncopation: 0.55, bassDensity: 0.55, slide: 0.4, octaveJump: 0.3, bassSustain: 0.75,
    melodyOctave: 5, melodyDensity: 0.45, rest: 0.4, leap: 0.35, motifRepeat: 0.6, melodySustain: 0.55,
    extensions: 0.35, chordStyleWeights: [3, 2, 2], pad: 0.6, lead: 0.25, counter: 0.4,
    velocity: 96, velocitySpread: 22, swing: 0.04,
    hardness: 70, darkness: 90, space: 55, catchiness: 0.8,
  },
  aggressive: {
    id: 'aggressive', label: 'Aggressive', blurb: 'Kick fitti, 808 in movimento, hat intensi', accent: '#ff6b35',
    scales: [['phrygian', 4], ['minor', 3], ['harmonicMinor', 2], ['minorPentatonic', 2]],
    bpmRange: [140, 165],
    kickDensity: 0.8, snareGhost: 0.4, hatRateWeights: [0, 1, 4, 4], hatRolls: 0.75, openHat: 0.5, perc: 0.45,
    syncopation: 0.8, bassDensity: 0.8, slide: 0.35, octaveJump: 0.45, bassSustain: 0.4,
    melodyOctave: 5, melodyDensity: 0.6, rest: 0.25, leap: 0.5, motifRepeat: 0.7, melodySustain: 0.3,
    extensions: 0.2, chordStyleWeights: [1, 4, 2], pad: 0.3, lead: 0.45, counter: 0.35,
    velocity: 108, velocitySpread: 18, swing: 0,
    hardness: 95, darkness: 60, space: 35, catchiness: 0.75,
  },
  melodic: {
    id: 'melodic', label: 'Melodic', blurb: 'Melodie cantabili e armonie ricche', accent: '#5ab0ff',
    scales: [['minor', 3], ['dorian', 3], ['major', 2], ['melodicMinor', 1], ['majorPentatonic', 1]],
    bpmRange: [130, 145],
    kickDensity: 0.45, snareGhost: 0.2, hatRateWeights: [0, 2, 4, 1], hatRolls: 0.35, openHat: 0.45, perc: 0.4,
    syncopation: 0.45, bassDensity: 0.5, slide: 0.5, octaveJump: 0.3, bassSustain: 0.7,
    melodyOctave: 5, melodyDensity: 0.6, rest: 0.3, leap: 0.3, motifRepeat: 0.55, melodySustain: 0.6,
    extensions: 0.55, chordStyleWeights: [3, 1, 3], pad: 0.65, lead: 0.4, counter: 0.6,
    velocity: 94, velocitySpread: 20, swing: 0.05,
    hardness: 55, darkness: 55, space: 45, catchiness: 0.95,
  },
  sad: {
    id: 'sad', label: 'Sad', blurb: 'Minore malinconico, tanto spazio, velocity morbide', accent: '#6ee7ff',
    scales: [['minor', 4], ['harmonicMinor', 2], ['dorian', 1], ['minorPentatonic', 2]],
    bpmRange: [120, 140],
    kickDensity: 0.35, snareGhost: 0.15, hatRateWeights: [1, 3, 3, 0], hatRolls: 0.2, openHat: 0.3, perc: 0.2,
    syncopation: 0.3, bassDensity: 0.35, slide: 0.55, octaveJump: 0.15, bassSustain: 0.85,
    melodyOctave: 5, melodyDensity: 0.4, rest: 0.55, leap: 0.2, motifRepeat: 0.65, melodySustain: 0.8,
    extensions: 0.5, chordStyleWeights: [4, 0, 2], pad: 0.8, lead: 0.15, counter: 0.35,
    velocity: 78, velocitySpread: 16, swing: 0.06,
    hardness: 35, darkness: 85, space: 65, catchiness: 0.8,
  },
  emotional: {
    id: 'emotional', label: 'Emotional', blurb: 'Accordi espressivi, dinamiche ampie', accent: '#f472b6',
    scales: [['minor', 3], ['harmonicMinor', 3], ['melodicMinor', 2], ['major', 1]],
    bpmRange: [125, 145],
    kickDensity: 0.42, snareGhost: 0.2, hatRateWeights: [0, 2, 4, 1], hatRolls: 0.3, openHat: 0.4, perc: 0.3,
    syncopation: 0.4, bassDensity: 0.45, slide: 0.6, octaveJump: 0.2, bassSustain: 0.8,
    melodyOctave: 5, melodyDensity: 0.5, rest: 0.45, leap: 0.3, motifRepeat: 0.5, melodySustain: 0.75,
    extensions: 0.65, chordStyleWeights: [4, 1, 3], pad: 0.8, lead: 0.3, counter: 0.55,
    velocity: 86, velocitySpread: 26, swing: 0.05,
    hardness: 45, darkness: 75, space: 55, catchiness: 0.85,
  },
  chill: {
    id: 'chill', label: 'Chill', blurb: 'Pattern semplici, meno kick, tanto respiro', accent: '#39dfa0',
    scales: [['dorian', 3], ['minor', 3], ['majorPentatonic', 2], ['major', 2], ['minorPentatonic', 2]],
    bpmRange: [110, 135],
    kickDensity: 0.28, snareGhost: 0.12, hatRateWeights: [1, 4, 2, 0], hatRolls: 0.15, openHat: 0.35, perc: 0.35,
    syncopation: 0.25, bassDensity: 0.32, slide: 0.45, octaveJump: 0.12, bassSustain: 0.85,
    melodyOctave: 5, melodyDensity: 0.38, rest: 0.55, leap: 0.2, motifRepeat: 0.6, melodySustain: 0.75,
    extensions: 0.6, chordStyleWeights: [4, 1, 2], pad: 0.7, lead: 0.2, counter: 0.4,
    velocity: 74, velocitySpread: 14, swing: 0.1,
    hardness: 25, darkness: 45, space: 80, catchiness: 0.8,
  },
  atmospheric: {
    id: 'atmospheric', label: 'Atmospheric', blurb: 'Pad in primo piano, note lunghe, poche percussioni', accent: '#7df0c2',
    scales: [['minor', 3], ['dorian', 2], ['lydian', 2], ['hirajoshi', 1], ['minorPentatonic', 1]],
    bpmRange: [120, 145],
    kickDensity: 0.3, snareGhost: 0.1, hatRateWeights: [1, 3, 3, 0], hatRolls: 0.2, openHat: 0.45, perc: 0.3,
    syncopation: 0.3, bassDensity: 0.3, slide: 0.5, octaveJump: 0.12, bassSustain: 0.9,
    melodyOctave: 6, melodyDensity: 0.32, rest: 0.6, leap: 0.25, motifRepeat: 0.5, melodySustain: 0.9,
    extensions: 0.6, chordStyleWeights: [5, 0, 2], pad: 0.95, lead: 0.2, counter: 0.3,
    velocity: 72, velocitySpread: 18, swing: 0.03,
    hardness: 35, darkness: 75, space: 80, catchiness: 0.7,
  },
  energetic: {
    id: 'energetic', label: 'Energetic', blurb: 'Groove spinto, fill frequenti, hat brillanti', accent: '#ffd166',
    scales: [['minor', 3], ['dorian', 2], ['mixolydian', 2], ['minorPentatonic', 2], ['major', 1]],
    bpmRange: [140, 160],
    kickDensity: 0.7, snareGhost: 0.35, hatRateWeights: [0, 1, 4, 3], hatRolls: 0.6, openHat: 0.55, perc: 0.5,
    syncopation: 0.65, bassDensity: 0.7, slide: 0.4, octaveJump: 0.4, bassSustain: 0.5,
    melodyOctave: 5, melodyDensity: 0.6, rest: 0.28, leap: 0.4, motifRepeat: 0.6, melodySustain: 0.4,
    extensions: 0.35, chordStyleWeights: [2, 3, 3], pad: 0.45, lead: 0.5, counter: 0.5,
    velocity: 104, velocitySpread: 18, swing: 0.02,
    hardness: 80, darkness: 45, space: 35, catchiness: 0.8,
  },
  street: {
    id: 'street', label: 'Street', blurb: 'Trap classico, 808 secco, groove diretto', accent: '#ff9d6b',
    scales: [['minorPentatonic', 4], ['minor', 3], ['phrygian', 2]],
    bpmRange: [135, 150],
    kickDensity: 0.6, snareGhost: 0.3, hatRateWeights: [0, 2, 4, 2], hatRolls: 0.55, openHat: 0.45, perc: 0.4,
    syncopation: 0.6, bassDensity: 0.65, slide: 0.3, octaveJump: 0.35, bassSustain: 0.55,
    melodyOctave: 5, melodyDensity: 0.45, rest: 0.4, leap: 0.35, motifRepeat: 0.75, melodySustain: 0.4,
    extensions: 0.2, chordStyleWeights: [2, 3, 2], pad: 0.35, lead: 0.35, counter: 0.3,
    velocity: 100, velocitySpread: 20, swing: 0.03,
    hardness: 80, darkness: 70, space: 50, catchiness: 0.9,
  },
  ominous: {
    id: 'ominous', label: 'Ominous', blurb: 'Tensione, dissonanze controllate, spazi vuoti', accent: '#b18cff',
    scales: [['phrygian', 4], ['harmonicMinor', 3], ['minor', 2], ['hirajoshi', 2]],
    bpmRange: [125, 145],
    kickDensity: 0.45, snareGhost: 0.2, hatRateWeights: [1, 2, 3, 2], hatRolls: 0.4, openHat: 0.35, perc: 0.45,
    syncopation: 0.5, bassDensity: 0.45, slide: 0.35, octaveJump: 0.25, bassSustain: 0.8,
    melodyOctave: 5, melodyDensity: 0.35, rest: 0.55, leap: 0.4, motifRepeat: 0.55, melodySustain: 0.7,
    extensions: 0.45, chordStyleWeights: [4, 1, 2], pad: 0.75, lead: 0.2, counter: 0.35,
    velocity: 88, velocitySpread: 24, swing: 0.02,
    hardness: 60, darkness: 95, space: 65, catchiness: 0.7,
  },
  futuristic: {
    id: 'futuristic', label: 'Futuristic', blurb: 'Intervalli inusuali, ritmi non convenzionali', accent: '#4dd0e1',
    scales: [['lydian', 3], ['wholeTone', 2], ['melodicMinor', 3], ['hirajoshi', 2], ['dorian', 1]],
    bpmRange: [130, 155],
    kickDensity: 0.55, snareGhost: 0.35, hatRateWeights: [0, 2, 3, 3], hatRolls: 0.65, openHat: 0.5, perc: 0.6,
    syncopation: 0.75, bassDensity: 0.6, slide: 0.55, octaveJump: 0.45, bassSustain: 0.55,
    melodyOctave: 6, melodyDensity: 0.5, rest: 0.4, leap: 0.55, motifRepeat: 0.4, melodySustain: 0.45,
    extensions: 0.7, chordStyleWeights: [2, 2, 4], pad: 0.7, lead: 0.55, counter: 0.5,
    velocity: 92, velocitySpread: 22, swing: 0,
    hardness: 70, darkness: 60, space: 50, catchiness: 0.75,
  },
  luxury: {
    id: 'luxury', label: 'Luxury', blurb: 'Armonie eleganti, groove pulito, arpeggi', accent: '#ffb347',
    scales: [['minor', 3], ['dorian', 3], ['melodicMinor', 2], ['major', 2], ['majorPentatonic', 1]],
    bpmRange: [125, 145],
    kickDensity: 0.45, snareGhost: 0.22, hatRateWeights: [0, 2, 4, 2], hatRolls: 0.45, openHat: 0.5, perc: 0.5,
    syncopation: 0.45, bassDensity: 0.5, slide: 0.5, octaveJump: 0.25, bassSustain: 0.7,
    melodyOctave: 6, melodyDensity: 0.55, rest: 0.35, leap: 0.3, motifRepeat: 0.5, melodySustain: 0.55,
    extensions: 0.75, chordStyleWeights: [2, 1, 4], pad: 0.6, lead: 0.45, counter: 0.6,
    velocity: 90, velocitySpread: 18, swing: 0.06,
    hardness: 50, darkness: 50, space: 50, catchiness: 0.85,
  },
  ambient: {
    id: 'ambient', label: 'Ambient', blurb: 'Quasi solo texture, drum minimali', accent: '#8c98b6',
    scales: [['minor', 3], ['lydian', 2], ['dorian', 2], ['majorPentatonic', 2], ['hirajoshi', 1]],
    bpmRange: [70, 120],
    kickDensity: 0.22, snareGhost: 0.08, hatRateWeights: [2, 3, 1, 0], hatRolls: 0.1, openHat: 0.3, perc: 0.25,
    syncopation: 0.2, bassDensity: 0.25, slide: 0.6, octaveJump: 0.1, bassSustain: 0.95,
    melodyOctave: 6, melodyDensity: 0.28, rest: 0.7, leap: 0.2, motifRepeat: 0.45, melodySustain: 0.95,
    extensions: 0.65, chordStyleWeights: [5, 0, 2], pad: 1, lead: 0.15, counter: 0.25,
    velocity: 66, velocitySpread: 14, swing: 0.05,
    hardness: 15, darkness: 60, space: 95, catchiness: 0.6,
  },
};

export const MOOD_LIST = Object.values(MOODS);

type NumericKeys = {
  [K in keyof MoodProfile]: MoodProfile[K] extends number ? K : never;
}[keyof MoodProfile];

const NUMERIC_FIELDS: NumericKeys[] = [
  'kickDensity', 'snareGhost', 'hatRolls', 'openHat', 'perc', 'syncopation',
  'bassDensity', 'slide', 'octaveJump', 'bassSustain',
  'melodyOctave', 'melodyDensity', 'rest', 'leap', 'motifRepeat', 'melodySustain',
  'extensions', 'pad', 'lead', 'counter', 'velocity', 'velocitySpread', 'swing',
  'hardness', 'darkness', 'space', 'catchiness',
];

/** Fonde uno o due mood in un unico profilo usato dal generatore. */
export function blendMoods(ids: MoodId[]): MoodProfile {
  const picked = ids.map((id) => MOODS[id]).filter(Boolean);
  if (picked.length === 0) return MOODS.dark;
  if (picked.length === 1) return picked[0];

  const out: MoodProfile = { ...picked[0] };
  for (const field of NUMERIC_FIELDS) {
    const avg = picked.reduce((s, m) => s + (m[field] as number), 0) / picked.length;
    (out as unknown as Record<string, number>)[field] = field === 'melodyOctave' ? Math.round(avg) : avg;
  }
  out.hatRateWeights = [0, 1, 2, 3].map(
    (i) => picked.reduce((s, m) => s + m.hatRateWeights[i], 0) / picked.length,
  ) as [number, number, number, number];
  out.chordStyleWeights = [0, 1, 2].map(
    (i) => picked.reduce((s, m) => s + m.chordStyleWeights[i], 0) / picked.length,
  ) as [number, number, number];

  const scaleMap = new Map<ScaleId, number>();
  for (const m of picked) {
    for (const [s, w] of m.scales) scaleMap.set(s, (scaleMap.get(s) ?? 0) + w);
  }
  out.scales = Array.from(scaleMap.entries());
  out.bpmRange = [
    Math.round(picked.reduce((s, m) => s + m.bpmRange[0], 0) / picked.length),
    Math.round(picked.reduce((s, m) => s + m.bpmRange[1], 0) / picked.length),
  ];
  out.label = picked.map((m) => m.label).join(' + ');
  out.accent = picked[0].accent;
  return out;
}
