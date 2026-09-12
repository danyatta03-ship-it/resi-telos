import { unzipSync } from 'fflate';
import { generateBeat } from '../src/generator';
import { buildMidiFiles, buildPerTrackMidiFiles } from '../src/midi/export';
import { buildZip } from '../src/export/bundle';
import { buildInfoText, beatFileBase } from '../src/export/info';
import { buildStructureText } from '../src/export/summary';
import { PPQ } from '../src/types';

let failures = 0;
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++;
    console.log('  FAIL:', msg);
  }
};

/** Parser MIDI minimale per validare quello che scriviamo. */
function parseMidi(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 0;
  const readStr = (n: number) => {
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(data[pos++]);
    return s;
  };
  check(readStr(4) === 'MThd', 'header MThd mancante');
  const headerLen = view.getUint32(pos); pos += 4;
  check(headerLen === 6, 'lunghezza header errata');
  const format = view.getUint16(pos); pos += 2;
  const ntrks = view.getUint16(pos); pos += 2;
  const division = view.getUint16(pos); pos += 2;
  check(format === 1, 'formato MIDI non 1');
  check(division === PPQ, `division ${division} != ${PPQ}`);

  const tracks: { notes: number; maxTick: number; bends: number; name: string }[] = [];
  for (let t = 0; t < ntrks; t++) {
    check(readStr(4) === 'MTrk', `chunk MTrk ${t} mancante`);
    const len = view.getUint32(pos); pos += 4;
    const end = pos + len;
    let tick = 0;
    let running = 0;
    const open = new Map<number, number>();
    let notes = 0;
    let bends = 0;
    let name = '';
    while (pos < end) {
      let delta = 0;
      for (;;) {
        const b = data[pos++];
        delta = (delta << 7) | (b & 0x7f);
        if (!(b & 0x80)) break;
      }
      tick += delta;
      let status = data[pos];
      if (status & 0x80) pos++;
      else status = running;
      running = status < 0xf0 ? status : running;
      const type = status & 0xf0;
      if (status === 0xff) {
        const metaType = data[pos++];
        let mlen = 0;
        for (;;) {
          const b = data[pos++];
          mlen = (mlen << 7) | (b & 0x7f);
          if (!(b & 0x80)) break;
        }
        const bytes = data.slice(pos, pos + mlen);
        if (metaType === 0x03) name = new TextDecoder().decode(bytes);
        pos += mlen;
        if (metaType === 0x2f) break;
      } else if (type === 0x90) {
        const pitch = data[pos++];
        const vel = data[pos++];
        if (vel > 0) { open.set(pitch, (open.get(pitch) ?? 0) + 1); notes++; }
        else open.set(pitch, Math.max(0, (open.get(pitch) ?? 0) - 1));
      } else if (type === 0x80) {
        const pitch = data[pos++];
        pos++;
        open.set(pitch, Math.max(0, (open.get(pitch) ?? 0) - 1));
      } else if (type === 0xe0) { pos += 2; bends++; }
      else if (type === 0xa0 || type === 0xb0) pos += 2;
      else if (type === 0xc0 || type === 0xd0) pos += 1;
      else if (status === 0xf0 || status === 0xf7) {
        let slen = 0;
        for (;;) { const b = data[pos++]; slen = (slen << 7) | (b & 0x7f); if (!(b & 0x80)) break; }
        pos += slen;
      }
    }
    pos = end;
    const stuck = Array.from(open.values()).reduce((a, b) => a + b, 0);
    check(stuck === 0, `note appese nella traccia "${name}": ${stuck}`);
    tracks.push({ notes, maxTick: tick, bends, name });
  }
  return { format, ntrks, division, tracks };
}

for (const mood of ['dark', 'melodic', 'chill', 'futuristic'] as const) {
  const beat = generateBeat({ moods: [mood], bpm: 142, variation: 55, humanize: 40 });
  const files = buildMidiFiles(beat);
  check(files.some((f) => f.name === 'full_beat.mid'), `${mood}: manca full_beat.mid`);
  check(files.length >= 4, `${mood}: pochi file MIDI (${files.length})`);
  for (const file of files) {
    const parsed = parseMidi(file.data);
    const notes = parsed.tracks.reduce((s, t) => s + t.notes, 0);
    check(notes > 0, `${mood}/${file.name}: nessuna nota`);
    if (file.name === '808.mid') {
      const bends = parsed.tracks.reduce((s, t) => s + t.bends, 0);
      console.log(`  ${mood}/808.mid: ${notes} note, ${bends} eventi di pitch bend`);
    }
  }
  // Un file per strumento, ognuno con una sola traccia dentro.
  const perTrack = buildPerTrackMidiFiles(beat);
  check(perTrack.length >= 5, `${mood}: pochi file per strumento (${perTrack.length})`);
  for (const file of perTrack) {
    const parsed = parseMidi(file.data);
    check(parsed.ntrks === 2, `${mood}/${file.name}: attese 2 tracce (tempo + strumento), trovate ${parsed.ntrks}`);
    check(parsed.tracks.reduce((s, t) => s + t.notes, 0) > 0, `${mood}/${file.name}: nessuna nota`);
  }

  // La scheda testuale deve contenere le informazioni chiave.
  const summary = buildStructureText(beat);
  for (const needle of ['STRUTTURA', 'ACCORDI', 'DRUM PATTERN', `${beat.meta.bpm} BPM`]) {
    check(summary.includes(needle), `${mood}: la struttura testuale non contiene "${needle}"`);
  }
  check(summary.split('\n').length > 20, `${mood}: struttura testuale troppo corta`);

  const zip = buildZip(beat);
  const entries = unzipSync(zip);
  const names = Object.keys(entries).sort();
  check(names.includes('text/beat-info.txt'), `${mood}: manca beat-info.txt`);
  check(names.some((n) => n.startsWith('midi/')), `${mood}: manca la cartella midi`);
  check(names.some((n) => n.startsWith('flstudio/') && n.endsWith('.flp')), `${mood}: manca il progetto .flp`);
  check(names.some((n) => n.startsWith('midi/strumenti/')), `${mood}: mancano i MIDI per strumento`);
  check(names.includes('text/struttura.txt'), `${mood}: manca struttura.txt`);
  const flpEntry = Object.entries(entries).find(([n]) => n.endsWith('.flp'))?.[1];
  check(
    !!flpEntry && String.fromCharCode(...flpEntry.subarray(0, 4)) === 'FLhd',
    `${mood}: il .flp nello ZIP non ha un header valido`,
  );
  console.log(`${mood.padEnd(11)} ${beatFileBase(beat)}.zip  ${(zip.length / 1024).toFixed(1)} KB  ${names.length} file: ${names.join(', ')}`);
}

const demo = generateBeat({ moods: ['dark', 'melodic'], bpm: 140, variation: 50, humanize: 30, seed: 4242 });
console.log('\n--- beat-info.txt (estratto) ---');
console.log(buildInfoText(demo).split('\n').slice(0, 18).join('\n'));

if (failures > 0) throw new Error(`${failures} controlli falliti`);
console.log('\nOK: export MIDI/ZIP valido');
