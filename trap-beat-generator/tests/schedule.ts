import { generateBeat } from '../src/generator';
import { useBeatStore } from '../src/store/useBeatStore';
import { buildSchedule } from '../src/audio/schedule';
import { TICKS_PER_BAR } from '../src/types';
import type { TrackId } from '../src/types';

let failures = 0;
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++;
    console.log('  FAIL:', msg);
  }
};

const MONO: TrackId[] = ['kick', 'snare', 'clap', 'hat', 'openhat', 'perc', '808'];

for (const mood of ['dark', 'aggressive', 'ambient'] as const) {
  for (const humanize of [0, 50, 100]) {
    const beat = generateBeat({ moods: [mood], bpm: 145, variation: 70, humanize, seed: 777 });
    const schedule = buildSchedule(beat);
    const totalBars = beat.sections.reduce((s, x) => s + x.bars, 0);
    check(
      schedule.totalTicks === totalBars * TICKS_PER_BAR,
      `${mood}/h${humanize}: lunghezza schedule incoerente`,
    );

    // Le voci monofoniche non devono ricevere due note nello stesso istante.
    const last = new Map<TrackId, number>();
    let collisions = 0;
    for (const event of schedule.events) {
      if (!MONO.includes(event.track)) continue;
      const previous = last.get(event.track);
      if (previous !== undefined && event.tick - previous < 2) collisions++;
      last.set(event.track, event.tick);
    }
    check(collisions === 0, `${mood}/h${humanize}: ${collisions} collisioni su voci monofoniche`);

    // Ordine temporale e valori nei limiti.
    let ordered = true;
    for (let i = 1; i < schedule.events.length; i++) {
      if (schedule.events[i].tick < schedule.events[i - 1].tick) ordered = false;
    }
    check(ordered, `${mood}/h${humanize}: eventi non ordinati`);
    check(
      schedule.events.every((e) => e.velocity > 0 && e.velocity <= 1 && e.durTicks > 0 && e.tick >= 0),
      `${mood}/h${humanize}: valori fuori range`,
    );
    // Due note identiche non devono mai sovrapporsi sulla stessa traccia.
    const held = new Map<string, { tick: number; dur: number }>();
    let overlaps = 0;
    for (const event of schedule.events) {
      const key = `${event.track}:${event.pitch}`;
      const previous = held.get(key);
      if (previous && event.tick < previous.tick + previous.dur) overlaps++;
      held.set(key, { tick: event.tick, dur: event.durTicks });
    }
    check(overlaps === 0, `${mood}/h${humanize}: ${overlaps} sovrapposizioni sulla stessa nota`);

    // Gli slide puntano sempre a una nota diversa.
    check(
      schedule.events.every((e) => e.slideTo === undefined || e.slideTo !== e.pitch),
      `${mood}/h${humanize}: slide verso la stessa nota`,
    );
  }
}

// Humanize deve spostare le note, non stravolgerle.
const base = generateBeat({ moods: ['dark'], bpm: 140, variation: 50, humanize: 0, seed: 31337 });
const wild = { ...base, meta: { ...base.meta, humanize: 100 } };
const ticksOf = (b: typeof base) => buildSchedule(b).events.filter((e) => e.track === 'melody').map((e) => e.tick);
const a = ticksOf(base);
const c = ticksOf(wild);
check(a.length === c.length, 'humanize cambia il numero di note');
const drift = a.map((t, i) => Math.abs(t - c[i]));
const maxDrift = Math.max(...drift, 0);
const avgDrift = drift.reduce((s, d) => s + d, 0) / Math.max(1, drift.length);
console.log(`humanize 100%: spostamento medio ${avgDrift.toFixed(1)} tick, massimo ${maxDrift} tick (1/16 = 120)`);
check(avgDrift > 0 && maxDrift < 120, 'humanize fuori scala: il groove verrebbe distrutto');

// Dopo un cambio di tonalita' due note possono collassare sullo stesso pitch:
// non devono finire a pochi tick di distanza, altrimenti le voci vanno in errore.
const store = useBeatStore.getState();
store.generate({ moods: ['dark', 'melodic'], bpm: 142, variation: 60, humanize: 45 });
useBeatStore.getState().setKey((useBeatStore.getState().beat!.meta.rootPc + 3) % 12, 'harmonicMinor');
const transposed = useBeatStore.getState().beat!;
const events = buildSchedule(transposed).events;
const seen = new Map<string, number>();
let tooClose = 0;
for (const event of events) {
  const key = `${event.track}:${event.pitch}`;
  const previous = seen.get(key);
  if (previous !== undefined && event.tick - previous < 10) tooClose++;
  seen.set(key, event.tick);
}
check(tooClose === 0, `dopo la trasposizione ${tooClose} note identiche troppo vicine`);
console.log(`dopo cambio tonalita': ${events.length} eventi, 0 collisioni sullo stesso pitch`);

if (failures > 0) throw new Error(`${failures} controlli falliti`);
console.log('\nOK: schedule coerente per playback ed export');
