import { generateBeat, regenerateBeat } from '../src/generator';
import { chordPitchClasses, keyLabel } from '../src/music/theory';
import { chordAtBar, progressionLabel } from '../src/music/progressions';
import { MOOD_LIST } from '../src/music/moods';
import type { TrackId } from '../src/types';
import { TICKS_PER_BAR } from '../src/types';

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.log('  FAIL:', msg);
  }
}

for (const mood of MOOD_LIST) {
  const beat = generateBeat({ moods: [mood.id], bpm: Math.round((mood.bpmRange[0] + mood.bpmRange[1]) / 2), variation: 50, humanize: 35 });
  const totals: Record<string, number> = {};
  let bars = 0;
  for (const s of beat.sections) {
    bars += s.bars;
    for (const [track, notes] of Object.entries(s.clips)) {
      totals[track] = (totals[track] ?? 0) + (notes?.length ?? 0);
      for (const n of notes ?? []) {
        check(n.t >= 0 && n.t < s.bars * TICKS_PER_BAR, `${mood.id}/${s.name}/${track}: nota fuori sezione t=${n.t}`);
        check(n.d > 0, `${mood.id}/${track}: durata non positiva`);
        check(n.v >= 1 && n.v <= 127, `${mood.id}/${track}: velocity fuori range ${n.v}`);
        check(n.p >= 0 && n.p <= 127, `${mood.id}/${track}: pitch fuori range ${n.p}`);
      }
    }
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  check(bars >= 24, `${mood.id}: struttura troppo corta (${bars} battute)`);
  check(sum > 200, `${mood.id}: troppe poche note (${sum})`);
  check((totals.kick ?? 0) > 0 && (totals['808'] ?? 0) > 0, `${mood.id}: manca kick o 808`);
  console.log(
    `${mood.label.padEnd(13)} ${keyLabel(beat.meta.rootPc, beat.meta.scaleId).padEnd(22)} ${String(bars).padStart(3)} bars  notes=${String(sum).padStart(5)}  prog=${progressionLabel(beat.meta.progression)}`,
  );
}

// Rigenerazione parziale: le altre parti restano identiche.
const base = generateBeat({ moods: ['dark'], bpm: 142, variation: 50, humanize: 30 });
const drumsOnly = regenerateBeat(base, 'drums');
const sameMelody = JSON.stringify(base.sections.map((s) => s.clips.melody)) === JSON.stringify(drumsOnly.sections.map((s) => s.clips.melody));
check(sameMelody, 'regenerate drums ha modificato la melodia');
const changedDrums = JSON.stringify(base.sections.map((s) => s.clips.kick)) !== JSON.stringify(drumsOnly.sections.map((s) => s.clips.kick));
check(changedDrums, 'regenerate drums non ha cambiato la cassa');

const melodyOnly = regenerateBeat(base, 'melody');
check(
  JSON.stringify(base.sections.map((s) => s.clips.kick)) === JSON.stringify(melodyOnly.sections.map((s) => s.clips.kick)),
  'regenerate melody ha toccato la batteria',
);

// Determinismo: stesso seed = stesso beat.
const a = generateBeat({ moods: ['melodic'], bpm: 140, seed: 12345, variation: 50, humanize: 30 });
const b = generateBeat({ moods: ['melodic'], bpm: 140, seed: 12345, variation: 50, humanize: 30 });
const stripIds = (x: unknown) => JSON.stringify(x, (k, v) => (k === 'id' ? undefined : v));
check(stripIds(a.sections) === stripIds(b.sections), 'lo stesso seed produce beat diversi');

// L'808 resta dentro il range di basso e dentro la scala/accordi.
let outOfRange = 0;
for (const s of a.sections) for (const n of s.clips['808'] ?? []) if (n.p < 24 || n.p > 47) outOfRange++;
check(outOfRange === 0, `808 fuori range: ${outOfRange} note`);

// Variation non deve gonfiare il beat: nel nuovo motore significa varieta'
// (fill, una nota in piu', cambi di ottava), non "piu' note dappertutto".
function hookDensity(variation: number): number {
  let notes = 0;
  let bars = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const bt = generateBeat({ moods: ['hard', 'dark'], bpm: 142, seed: seed * 7919, variation, humanize: 0 });
    const hook = bt.sections.find((s) => s.kind === 'HOOK');
    if (!hook) continue;
    bars += hook.bars;
    for (const n of Object.values(hook.clips)) notes += (n as unknown[])?.length ?? 0;
  }
  return notes / Math.max(1, bars);
}
const dLow = hookDensity(0);
const dHigh = hookDensity(100);
console.log(`\nvariation 0 -> ${dLow.toFixed(1)} note/bar, variation 100 -> ${dHigh.toFixed(1)} note/bar`);
check(dHigh >= dLow * 0.9, 'variation azzera il beat invece di variarlo');
check(dHigh < dLow * 1.6, `variation gonfia troppo il beat: ${dLow.toFixed(1)} -> ${dHigh.toFixed(1)} note/bar`);
check(dHigh < 26 && dLow < 26, `beat troppo pieno a prescindere: ${dLow.toFixed(1)} / ${dHigh.toFixed(1)} note/bar`);

// Con variation diversa il materiale deve comunque cambiare.
const simple = generateBeat({ moods: ['hard'], bpm: 142, seed: 5150, variation: 0, humanize: 0 });
const wild = generateBeat({ moods: ['hard'], bpm: 142, seed: 5150, variation: 100, humanize: 0 });
const stripIdsFor = (x: unknown) => JSON.stringify(x, (k, v) => (k === 'id' ? undefined : v));
check(
  stripIdsFor(simple.sections.map((s) => s.clips.kick)) !== stripIdsFor(wild.sections.map((s) => s.clips.kick)),
  'variation non cambia nulla nelle drum',
);

const trackList: TrackId[] = ['kick', 'snare', 'hat', '808', 'melody', 'chords', 'pad'];
console.log('tracce presenti nel primo hook:', trackList.filter((t) => (base.sections.find((s) => s.kind === 'HOOK')?.clips[t]?.length ?? 0) > 0).join(', '));


// Rigenerando gli accordi l'808 deve restare dentro la nuova armonia.
{
  const start = generateBeat({ moods: ['dark'], bpm: 140, variation: 50, humanize: 20, seed: 5150 });
  const rechorded = regenerateBeat(start, 'chords');
  let outside = 0;
  let total = 0;
  let startBar = 0;
  for (const section of rechorded.sections) {
    for (const note of section.clips['808'] ?? []) {
      const bar = startBar + Math.floor(note.t / 1920);
      const chord = chordAtBar(rechorded.meta.progression, bar);
      const tones = chordPitchClasses(rechorded.meta.rootPc, rechorded.meta.scaleId, chord);
      total++;
      if (!tones.includes(((note.p % 12) + 12) % 12)) outside++;
    }
  }
  startBar = 0;
  const rhythmKept =
    JSON.stringify(start.sections.map((s) => (s.clips['808'] ?? []).map((n) => n.t))) ===
    JSON.stringify(rechorded.sections.map((s) => (s.clips['808'] ?? []).map((n) => n.t)));
  console.log(`\nregenerate chords: 808 con ${total} note, ${outside} fuori accordo, ritmo invariato: ${rhythmKept}`);
  check(outside === 0, `regenerate chords lascia ${outside} note di 808 fuori armonia`);
  check(rhythmKept, 'regenerate chords ha cambiato il ritmo dell’808');
}

if (failures > 0) throw new Error(`${failures} controlli falliti`);
console.log('\nOK: tutti i controlli passati');
