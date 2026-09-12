import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateBeat } from '../src/generator';
import { buildFlp } from '../src/flp/export';
import { FLP_PPQ } from '../src/flp/writer';
import { processedNotes } from '../src/audio/schedule';
import { TRACKS } from '../src/types';
import type { TrackId } from '../src/types';

let failures = 0;
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++;
    console.log('  FAIL:', msg);
  }
};

/** Lettore minimale del formato .flp, per verificare quello che scriviamo. */
function parseFlp(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = String.fromCharCode(...data.subarray(0, 4));
  const headerSize = view.getUint32(4, true);
  const format = view.getInt16(8, true);
  const channelCount = view.getUint16(10, true);
  const ppq = view.getUint16(12, true);
  const dataMagic = String.fromCharCode(...data.subarray(14, 18));
  const bodySize = view.getUint32(18, true);

  let pos = 22;
  const events: { id: number; value: number; bytes: Uint8Array }[] = [];
  while (pos < data.length) {
    const id = data[pos++];
    if (id < 64) {
      events.push({ id, value: data[pos], bytes: data.subarray(pos, pos + 1) });
      pos += 1;
    } else if (id < 128) {
      events.push({ id, value: view.getUint16(pos, true), bytes: data.subarray(pos, pos + 2) });
      pos += 2;
    } else if (id < 192) {
      events.push({ id, value: view.getUint32(pos, true), bytes: data.subarray(pos, pos + 4) });
      pos += 4;
    } else {
      let size = 0;
      let shift = 0;
      for (;;) {
        const byte = data[pos++];
        size |= (byte & 0x7f) << shift;
        shift += 7;
        if (!(byte & 0x80)) break;
      }
      events.push({ id, value: size, bytes: data.subarray(pos, pos + size) });
      pos += size;
    }
  }
  return { magic, headerSize, format, channelCount, ppq, dataMagic, bodySize, events, totalSize: data.length };
}

const beat = generateBeat({ moods: ['dark', 'melodic'], bpm: 142, variation: 55, humanize: 40, seed: 20250912 });
const flp = buildFlp(beat);
const parsed = parseFlp(flp);

check(parsed.magic === 'FLhd', 'header FLhd mancante');
check(parsed.headerSize === 6, `dimensione header ${parsed.headerSize} != 6`);
check(parsed.format === 0, 'formato progetto non 0');
check(parsed.dataMagic === 'FLdt', 'chunk FLdt mancante');
check(parsed.bodySize === parsed.totalSize - 22, 'dimensione del chunk dati incoerente');
check(parsed.ppq === FLP_PPQ, `ppq ${parsed.ppq} != ${FLP_PPQ}`);
check([24, 48, 72, 96, 120, 144, 168, 192, 384, 768, 960].includes(parsed.ppq), 'ppq non fra quelli accettati da FL');

const usedTracks = TRACKS.filter((t) => beat.sections.some((s) => (s.clips[t.id]?.length ?? 0) > 0));
check(parsed.channelCount === usedTracks.length, `canali nell'header ${parsed.channelCount} != ${usedTracks.length}`);

const newChannels = parsed.events.filter((e) => e.id === 64);
check(newChannels.length === usedTracks.length, `eventi canale ${newChannels.length} != ${usedTracks.length}`);
check(
  newChannels.every((e, i) => e.value === i),
  'gli indici dei canali non sono progressivi',
);

const patternNotes = parsed.events.filter((e) => e.id === 224);
check(patternNotes.every((e) => e.bytes.length % 24 === 0), 'blocco note non multiplo di 24 byte');
const notesWritten = patternNotes.reduce((sum, e) => sum + e.bytes.length / 24, 0);

// Quante note ci aspettiamo: tutte quelle delle tracce usate, in tutte le sezioni.
let expectedNotes = 0;
for (let i = 0; i < beat.sections.length; i++) {
  for (const track of usedTracks) expectedNotes += processedNotes(beat, i, track.id as TrackId).length;
}
check(notesWritten === expectedNotes, `note scritte ${notesWritten} != ${expectedNotes}`);

const playlist = parsed.events.filter((e) => e.id === 233);
check(playlist.length === 1, 'evento playlist mancante');
const items = playlist[0] ? playlist[0].bytes.length / 32 : 0;
check(items === beat.sections.length, `elementi playlist ${items} != ${beat.sections.length}`);

// Tempo: milli-BPM.
const tempo = parsed.events.find((e) => e.id === 156);
check(tempo?.value === beat.meta.bpm * 1000, `tempo ${tempo?.value} != ${beat.meta.bpm * 1000}`);

// La versione deve essere il primo evento: determina la codifica del testo.
check(parsed.events[0]?.id === 199, 'la versione FL non e’ il primo evento');

// Le note delle percussioni devono stare sul DO centrale, le melodiche no.
const drumChannels = new Set(
  usedTracks.filter((t) => t.group === 'drums').map((t) => usedTracks.findIndex((x) => x.id === t.id)),
);
let drumOffKey = 0;
let melodicNotes = 0;
for (const event of patternNotes) {
  const view = new DataView(event.bytes.buffer, event.bytes.byteOffset, event.bytes.byteLength);
  for (let i = 0; i < event.bytes.length / 24; i++) {
    const channel = view.getUint16(i * 24 + 6, true);
    const key = view.getUint16(i * 24 + 12, true);
    const velocity = view.getUint8(i * 24 + 21);
    const position = view.getUint32(i * 24, true);
    const length = view.getUint32(i * 24 + 8, true);
    if (drumChannels.has(channel)) {
      if (key !== 60) drumOffKey++;
    } else {
      melodicNotes++;
      check(key >= 12 && key <= 120, `nota melodica fuori range: ${key}`);
    }
    check(velocity >= 1 && velocity <= 128, `velocity FL fuori range: ${velocity}`);
    check(length >= 1, 'nota di lunghezza nulla');
    check(position >= 0 && position < 64 * 4 * FLP_PPQ, `posizione nota anomala: ${position}`);
  }
}
check(drumOffKey === 0, `${drumOffKey} note di batteria non sul DO centrale`);
check(melodicNotes > 0, 'nessuna nota melodica esportata');

const dir = mkdtempSync(join(tmpdir(), 'tbg-flp-'));
const file = join(dir, 'test.flp');
writeFileSync(file, flp);
console.log(`generato ${file} (${(flp.length / 1024).toFixed(1)} KB, ${notesWritten} note, ${items} pattern in playlist)`);

// Controllo incrociato con PyFLP, se disponibile.
const expectedJson = {
  bpm: beat.meta.bpm,
  ppq: FLP_PPQ,
  channels: usedTracks.length,
  patterns: beat.sections.length,
  notes: expectedNotes,
  playlistItems: beat.sections.length,
  title: beat.name,
  channelNames: usedTracks.map((t) => t.label),
  patternNames: beat.sections.map((s) => s.name),
};
const expectFile = join(dir, 'expected.json');
writeFileSync(expectFile, JSON.stringify(expectedJson));

try {
  const output = execFileSync('python3', ['scripts/validate-flp.py', file, '--expect-json', expectFile], {
    encoding: 'utf-8',
  });
  console.log(output.trim().split('\n').map((l) => `  ${l}`).join('\n'));
} catch (error) {
  const err = error as { status?: number; stdout?: string; stderr?: string };
  if (err.status === 2) {
    console.log('  (PyFLP non installato: salto il controllo incrociato)');
  } else {
    failures++;
    console.log('  FAIL: PyFLP non ha validato il progetto');
    console.log((err.stdout ?? '') + (err.stderr ?? ''));
  }
}

if (failures > 0) throw new Error(`${failures} controlli falliti`);
console.log('\nOK: progetto FL Studio generato e riletto correttamente');
