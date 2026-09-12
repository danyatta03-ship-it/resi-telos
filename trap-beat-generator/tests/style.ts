import { generateBeat } from '../src/generator';
import { TICKS_PER_BAR } from '../src/types';
import type { Beat, Section, TrackId } from '../src/types';
import { chordAtBar } from '../src/music/progressions';
import { chordPitchClasses, isInScale, keyLabel } from '../src/music/theory';

let failures = 0;
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++;
    console.log('  FAIL:', msg);
  }
};

const STEP = TICKS_PER_BAR / 16;

interface Metrics {
  label: string;
  bars: number;
  melodyNotesPerBar: number;
  melodyDistinct: number;
  bassPerBar: number;
  bassInChord: number;
  bassInScale: number;
  kickPerBar: number;
  kickWithBass: number;
  hatPerBar: number;
  notesPerBar: number;
  silentBeats: number;
  hookVsVerse: number;
  tracksInHook: number;
  velocity: number;
  atmosphere: number;
}

function sectionOf(beat: Beat, kind: Section['kind']): { section: Section; startBar: number } | null {
  let bar = 0;
  for (const section of beat.sections) {
    if (section.kind === kind) return { section, startBar: bar };
    bar += section.bars;
  }
  return null;
}

function density(section: Section): number {
  let notes = 0;
  for (const list of Object.values(section.clips)) notes += list?.length ?? 0;
  return notes / section.bars;
}

function analyse(beat: Beat, label: string): Metrics {
  const hook = sectionOf(beat, 'HOOK');
  const verse = sectionOf(beat, 'VERSE');
  const target = hook ?? { section: beat.sections[0], startBar: 0 };
  const { section, startBar } = target;

  const melody = section.clips.melody ?? [];
  const bass = section.clips['808'] ?? [];
  const kick = section.clips.kick ?? [];
  const hat = section.clips.hat ?? [];

  // 808 dentro all'accordo della battuta in cui suona.
  let inChord = 0;
  let inScale = 0;
  for (const note of bass) {
    const bar = startBar + Math.floor(note.t / TICKS_PER_BAR);
    const chord = chordAtBar(beat.meta.progression, bar);
    const tones = chordPitchClasses(beat.meta.rootPc, beat.meta.scaleId, chord);
    if (tones.includes(((note.p % 12) + 12) % 12)) inChord++;
    if (isInScale(note.p, beat.meta.rootPc, beat.meta.scaleId)) inScale++;
  }

  // Relazione cassa/808: quanti colpi di basso hanno una cassa vicina.
  const kickSteps = kick.map((n) => Math.round(n.t / STEP));
  let linked = 0;
  for (const note of bass) {
    const step = Math.round(note.t / STEP);
    if (kickSteps.some((k) => Math.abs(k - step) <= 3)) linked++;
  }

  // Movimenti completamente vuoti: lo spazio nel groove.
  const beats = section.bars * 4;
  let silent = 0;
  for (let b = 0; b < beats; b++) {
    const from = b * (TICKS_PER_BAR / 4);
    const to = from + TICKS_PER_BAR / 4;
    const hits = (['kick', 'snare', 'hat', 'openhat', 'perc', '808'] as TrackId[]).some((t) =>
      (section.clips[t] ?? []).some((n) => n.t >= from && n.t < to),
    );
    if (!hits) silent++;
  }

  let notes = 0;
  for (const list of Object.values(section.clips)) notes += list?.length ?? 0;

  const drumNotes = (['kick', 'snare', 'clap'] as TrackId[]).flatMap((t) => section.clips[t] ?? []);
  const velocity = drumNotes.length
    ? drumNotes.reduce((sum, n) => sum + n.v, 0) / drumNotes.length
    : 0;
  const atmosphere =
    ((section.clips.pad?.length ?? 0) + (section.clips.chords?.length ?? 0)) / section.bars;

  return {
    label,
    bars: beat.sections.reduce((s, x) => s + x.bars, 0),
    velocity,
    atmosphere,
    melodyNotesPerBar: melody.length / section.bars,
    melodyDistinct: new Set(melody.map((n) => n.p)).size,
    bassPerBar: bass.length / section.bars,
    bassInChord: bass.length ? inChord / bass.length : 1,
    bassInScale: bass.length ? inScale / bass.length : 1,
    kickPerBar: kick.length / section.bars,
    kickWithBass: bass.length ? linked / bass.length : 0,
    hatPerBar: hat.length / section.bars,
    notesPerBar: notes / section.bars,
    silentBeats: silent / beats,
    hookVsVerse: hook && verse ? density(hook.section) / Math.max(0.1, density(verse.section)) : 1,
    tracksInHook: Object.values(section.clips).filter((l) => (l?.length ?? 0) > 0).length,
  };
}

const combos: { moods: Parameters<typeof generateBeat>[0]['moods']; bpm: number; label: string }[] = [
  { moods: ['hard'], bpm: 140, label: 'Hard 140' },
  { moods: ['hard'], bpm: 150, label: 'Hard 150' },
  { moods: ['dark'], bpm: 140, label: 'Dark 140' },
  { moods: ['dark'], bpm: 130, label: 'Dark 130' },
  { moods: ['hard', 'dark'], bpm: 145, label: 'Hard+Dark 145' },
  { moods: ['melodic'], bpm: 130, label: 'Melodic 130' },
  { moods: ['aggressive'], bpm: 150, label: 'Aggressive 150' },
  { moods: ['chill'], bpm: 120, label: 'Chill 120' },
];

const rows: Metrics[] = [];
for (const combo of combos) {
  for (let i = 0; i < 4; i++) {
    const beat = generateBeat({ moods: combo.moods, bpm: combo.bpm, seed: 1000 + i * 613 });
    rows.push(analyse(beat, `${combo.label} #${i + 1}`));
  }
}

console.log(
  'combo'.padEnd(18) +
    'mel/bar dist  808/bar  inChord  kick/bar  k~808  hat/bar  note/bar  vuoti  hook/verse   vel  atmo',
);
for (const m of rows) {
  console.log(
    m.label.padEnd(18) +
      `${m.melodyNotesPerBar.toFixed(1).padStart(6)} ${String(m.melodyDistinct).padStart(4)} ` +
      `${m.bassPerBar.toFixed(1).padStart(7)} ${(m.bassInChord * 100).toFixed(0).padStart(7)}% ` +
      `${m.kickPerBar.toFixed(1).padStart(8)} ${(m.kickWithBass * 100).toFixed(0).padStart(5)}% ` +
      `${m.hatPerBar.toFixed(1).padStart(7)} ${m.notesPerBar.toFixed(1).padStart(8)} ` +
      `${(m.silentBeats * 100).toFixed(0).padStart(5)}% ${m.hookVsVerse.toFixed(2).padStart(10)} ` +
      `${m.velocity.toFixed(0).padStart(5)} ${m.atmosphere.toFixed(1).padStart(5)}`,
  );
}

const avg = (fn: (m: Metrics) => number, filter: (m: Metrics) => boolean = () => true) => {
  const list = rows.filter(filter);
  return list.reduce((s, m) => s + fn(m), 0) / Math.max(1, list.length);
};

const hardRows = (m: Metrics) => m.label.startsWith('Hard') || m.label.startsWith('Aggressive');
const chillRows = (m: Metrics) => m.label.startsWith('Chill');

console.log('\n--- verifiche ---');
check(avg((m) => m.melodyDistinct) <= 8, `melodia con troppe note diverse: ${avg((m) => m.melodyDistinct).toFixed(1)}`);
check(avg((m) => m.melodyNotesPerBar) <= 6, `melodia troppo fitta: ${avg((m) => m.melodyNotesPerBar).toFixed(1)} note/bar`);
check(avg((m) => m.bassInChord) > 0.9, `808 fuori armonia: ${(avg((m) => m.bassInChord) * 100).toFixed(0)}%`);
check(avg((m) => m.bassPerBar) <= 4, `808 troppo fitto: ${avg((m) => m.bassPerBar).toFixed(1)} note/bar`);
check(avg((m) => m.kickWithBass) > 0.55, `cassa e 808 scollegati: ${(avg((m) => m.kickWithBass) * 100).toFixed(0)}%`);
check(avg((m) => m.hatPerBar) <= 13, `hi-hat troppo pieni: ${avg((m) => m.hatPerBar).toFixed(1)} colpi/bar`);
check(avg((m) => m.hookVsVerse) > 1.05, `hook non piu' forte della strofa: ${avg((m) => m.hookVsVerse).toFixed(2)}`);
check(avg((m) => m.silentBeats) > 0.02, `nessuno spazio nel groove: ${(avg((m) => m.silentBeats) * 100).toFixed(0)}%`);
check(
  avg((m) => m.kickPerBar, hardRows) > avg((m) => m.kickPerBar, chillRows),
  'i beat hard non sono piu' + "' carichi dei chill",
);
check(avg((m) => m.notesPerBar) < 30, `beat troppo pieno: ${avg((m) => m.notesPerBar).toFixed(1)} note/bar`);

// Hard e Dark devono essere due cose diverse, non due nomi della stessa cosa.
const darkRows = (m: Metrics) => m.label.startsWith('Dark');
const onlyHard = (m: Metrics) => m.label.startsWith('Hard 1');
console.log(
  `\nHard: velocity ${avg((m) => m.velocity, onlyHard).toFixed(0)}, atmosfera ${avg((m) => m.atmosphere, onlyHard).toFixed(1)} note/bar | ` +
    `Dark: velocity ${avg((m) => m.velocity, darkRows).toFixed(0)}, atmosfera ${avg((m) => m.atmosphere, darkRows).toFixed(1)} note/bar | ` +
    `Chill: velocity ${avg((m) => m.velocity, chillRows).toFixed(0)}`,
);
check(
  avg((m) => m.velocity, onlyHard) > avg((m) => m.velocity, chillRows) + 8,
  'hard e chill hanno la stessa dinamica',
);
check(
  avg((m) => m.atmosphere, darkRows) > avg((m) => m.atmosphere, onlyHard) * 0.95,
  'dark non porta piu' + "' atmosfera di hard",
);

// --- Forma da singolo: l'hook deve arrivare presto e chiudere piu' in alto ---
console.log('\n--- forma del pezzo ---');
let hookLateCount = 0;
let introWithDrums = 0;
let liftedHooks = 0;
let entryAccents = 0;
const formRuns = 24;

for (let seed = 0; seed < formRuns; seed++) {
  const beat = generateBeat({ moods: ['hard', 'dark'], bpm: 142, seed: seed * 1531 });
  const secondsPerBar = (4 * 60) / beat.meta.bpm;

  let bar = 0;
  let hookStart = -1;
  const hooks: { avgPitch: number; hasEntry: boolean }[] = [];
  for (const section of beat.sections) {
    if (section.kind === 'HOOK') {
      if (hookStart < 0) hookStart = bar;
      const melody = section.clips.melody ?? [];
      hooks.push({
        avgPitch: melody.length ? melody.reduce((sum, n) => sum + n.p, 0) / melody.length : 0,
        hasEntry: (section.clips.openhat ?? []).some((n) => n.t === 0),
      });
    }
    if (section.kind === 'INTRO') {
      const drums = (section.clips.kick?.length ?? 0) + (section.clips.snare?.length ?? 0);
      if (drums > section.bars) introWithDrums++;
    }
    bar += section.bars;
  }

  if (hookStart * secondsPerBar > 14) hookLateCount++;
  if (hooks.length > 1 && hooks[hooks.length - 1].avgPitch > hooks[0].avgPitch + 1) liftedHooks++;
  if (hooks.some((h) => h.hasEntry)) entryAccents++;

  if (seed === 0) {
    let position = 0;
    console.log(
      '  scaletta di prova: ' +
        beat.sections
          .map((sec) => {
            const label = `${sec.name} ${sec.bars}b @${Math.round(position * secondsPerBar)}s`;
            position += sec.bars;
            return label;
          })
          .join(' | '),
    );
  }
}

console.log(
  `  hook oltre i 14 secondi: ${hookLateCount}/${formRuns} | intro con drum piena: ${introWithDrums}/${formRuns} | ` +
    `ultimo hook piu' alto: ${liftedHooks}/${formRuns} | ingresso marcato: ${entryAccents}/${formRuns}`,
);
check(hookLateCount <= formRuns * 0.15, `l'hook arriva tardi in ${hookLateCount} beat su ${formRuns}`);
check(introWithDrums <= formRuns * 0.25, `intro troppo piena in ${introWithDrums} beat su ${formRuns}`);
check(liftedHooks >= formRuns * 0.6, `l'ultimo hook non sale quasi mai: ${liftedHooks}/${formRuns}`);
check(entryAccents >= formRuns * 0.8, `ingresso dell'hook non marcato: ${entryAccents}/${formRuns}`);

// Identita': lo stesso motivo deve tornare in tutte le sezioni.
const identityBeat = generateBeat({ moods: ['hard', 'dark'], bpm: 142, seed: 99 });
const pitchSets = identityBeat.sections
  .map((s) => new Set((s.clips.melody ?? []).map((n) => ((n.p % 12) + 12) % 12)))
  .filter((set) => set.size > 0);
let overlap = 0;
for (let i = 1; i < pitchSets.length; i++) {
  const shared = [...pitchSets[i]].filter((p) => pitchSets[0].has(p)).length;
  overlap += shared / Math.max(1, pitchSets[i].size);
}
overlap /= Math.max(1, pitchSets.length - 1);
console.log(`identita' del motivo fra le sezioni: ${(overlap * 100).toFixed(0)}% di note in comune`);
check(overlap > 0.7, `il motivo cambia troppo fra le sezioni: ${(overlap * 100).toFixed(0)}%`);

// Riproducibilita'.
const a = generateBeat({ moods: ['hard'], bpm: 144, seed: 4242 });
const b = generateBeat({ moods: ['hard'], bpm: 144, seed: 4242 });
const strip = (x: unknown) => JSON.stringify(x, (k, v) => (k === 'id' ? undefined : v));
check(strip(a.sections) === strip(b.sections), 'lo stesso seed non produce lo stesso beat');
console.log(`tonalita' di prova: ${keyLabel(a.meta.rootPc, a.meta.scaleId)}, progressione ${a.meta.progression.map((c) => c.roman).join(' - ')}`);

if (failures > 0) throw new Error(`${failures} controlli falliti`);
console.log('\nOK: la grammatica del nuovo motore regge');
