/**
 * Writer di progetti FL Studio (.flp).
 *
 * ATTENZIONE: il formato .flp e' proprietario e non documentato da Image-Line.
 * Questa implementazione segue la struttura ricostruita dalla community
 * (stessa usata da PyFLP) ed e' da considerarsi sperimentale: il MIDI resta
 * la via di import garantita.
 *
 * Struttura del file:
 *   "FLhd" + size(6) + format(int16) + channel count(uint16) + ppq(uint16)
 *   "FLdt" + size + flusso di eventi
 * Ogni evento e' un id da 1 byte seguito da:
 *   id < 64  -> 1 byte, id < 128 -> 2 byte, id < 192 -> 4 byte,
 *   id >= 192 -> lunghezza in VarInt (LEB128) + dati.
 */

/** PPQ del progetto FL: 960 e' fra i valori ammessi ed e' il doppio del nostro. */
export const FLP_PPQ = 960;

const FL_VERSION = '20.8.3.2304';
const FL_BUILD = 2304;

// --- id degli eventi (offset: WORD 64, DWORD 128, TEXT 192, DATA 208) ---
const EV = {
  chanEnabled: 0,
  showInfo: 10,
  timeSigNum: 17,
  timeSigBeat: 18,
  chanType: 21,
  playTruncatedNotes: 30,
  chanNew: 64,
  tempoCoarse: 66,
  patternNew: 65,
  patternCurrent: 67,
  arrangementNew: 99,
  arrangementCurrent: 100,
  pluginColor: 128,
  patternColor: 150,
  chanGroupNum: 145,
  tempo: 156,
  flBuild: 159,
  chanName: 192,
  patternName: 193,
  pluginName: 203,
  displayGroupName: 231,
  title: 194,
  comments: 195,
  genre: 206,
  flVersion: 199,
  patternNotes: 224,
  playlist: 233,
  trackData: 238,
  trackName: 239,
  arrangementName: 241,
} as const;

export interface FlpChannel {
  name: string;
  /** Colore in formato 0xRRGGBB. */
  color?: number;
}

export interface FlpNote {
  /** Posizione in tick FLP, relativa all'inizio del pattern. */
  position: number;
  length: number;
  /** Nota MIDI 0-131. */
  key: number;
  /** Indice del canale nel Channel Rack. */
  channel: number;
  /** Velocity MIDI 1-127, convertita nella scala 0-128 di FL. */
  velocity: number;
  slide?: boolean;
}

export interface FlpPattern {
  name: string;
  notes: FlpNote[];
  color?: number;
}

export interface FlpPlaylistItem {
  /** Posizione in tick FLP nella playlist. */
  position: number;
  length: number;
  /** Numero del pattern, 1-based. */
  pattern: number;
  /** Traccia della playlist, 1-based. */
  track: number;
}

/** Numero di tracce della playlist in FL Studio 20. */
const PLAYLIST_TRACKS = 500;

export interface FlpProjectInput {
  title: string;
  comments: string;
  bpm: number;
  channels: FlpChannel[];
  patterns: FlpPattern[];
  playlist: FlpPlaylistItem[];
  genre?: string;
}

class ByteWriter {
  private bytes: number[] = [];

  u8(value: number): void {
    this.bytes.push(value & 0xff);
  }

  u16(value: number): void {
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff);
  }

  u32(value: number): void {
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
  }

  f32(value: number): void {
    const buffer = new DataView(new ArrayBuffer(4));
    buffer.setFloat32(0, value, true);
    for (let i = 0; i < 4; i++) this.bytes.push(buffer.getUint8(i));
  }

  raw(values: ArrayLike<number>): void {
    for (let i = 0; i < values.length; i++) this.bytes.push(values[i] & 0xff);
  }

  get length(): number {
    return this.bytes.length;
  }

  toArray(): number[] {
    return this.bytes;
  }
}

/** VarInt in stile LEB128: gruppi da 7 bit, meno significativo per primo. */
function varInt(value: number): number[] {
  const out: number[] = [];
  let v = Math.max(0, Math.round(value));
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return out;
}

function utf16(text: string): number[] {
  const out: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code > 0xffff) {
      const adjusted = code - 0x10000;
      const high = 0xd800 + (adjusted >> 10);
      const low = 0xdc00 + (adjusted & 0x3ff);
      out.push(high & 0xff, high >> 8, low & 0xff, low >> 8);
    } else {
      out.push(code & 0xff, code >> 8);
    }
  }
  out.push(0, 0); // terminatore
  return out;
}

class EventStream {
  private writer = new ByteWriter();

  byte(id: number, value: number): void {
    this.writer.u8(id);
    this.writer.u8(value);
  }

  word(id: number, value: number): void {
    this.writer.u8(id);
    this.writer.u16(value);
  }

  dword(id: number, value: number): void {
    this.writer.u8(id);
    this.writer.u32(value);
  }

  /** Colore 0xRRGGBB salvato come RGBA. */
  color(id: number, rgb: number): void {
    this.writer.u8(id);
    this.writer.u8((rgb >> 16) & 0xff);
    this.writer.u8((rgb >> 8) & 0xff);
    this.writer.u8(rgb & 0xff);
    this.writer.u8(0);
  }

  ascii(id: number, text: string): void {
    const bytes = Array.from(text, (c) => c.charCodeAt(0) & 0xff);
    bytes.push(0);
    this.data(id, bytes);
  }

  text(id: number, value: string): void {
    this.data(id, utf16(value));
  }

  data(id: number, bytes: ArrayLike<number>): void {
    this.writer.u8(id);
    this.writer.raw(varInt(bytes.length));
    this.writer.raw(bytes);
  }

  get length(): number {
    return this.writer.length;
  }

  toArray(): number[] {
    return this.writer.toArray();
  }
}

/** Una nota occupa 24 byte. */
function encodeNotes(notes: FlpNote[]): number[] {
  const writer = new ByteWriter();
  for (const note of notes) {
    writer.u32(Math.max(0, Math.round(note.position)));
    writer.u16(note.slide ? 1 << 3 : 0);
    writer.u16(note.channel);
    writer.u32(Math.max(1, Math.round(note.length)));
    writer.u16(Math.max(0, Math.min(131, Math.round(note.key))));
    writer.u16(0); // group
    writer.u8(120); // fine pitch: centrato
    writer.u8(0);
    writer.u8(64); // release
    writer.u8(0); // canale MIDI / colore
    writer.u8(64); // pan centrale
    writer.u8(Math.max(1, Math.min(128, Math.round((note.velocity * 128) / 127))));
    writer.u8(128); // mod x
    writer.u8(128); // mod y
  }
  return writer.toArray();
}

/** Un elemento di playlist occupa 32 byte. */
function encodePlaylist(items: FlpPlaylistItem[]): number[] {
  const writer = new ByteWriter();
  const PATTERN_BASE = 20480;
  const MAX_TRACKS = 500;
  for (const item of items) {
    writer.u32(Math.max(0, Math.round(item.position)));
    writer.u16(PATTERN_BASE);
    writer.u16(PATTERN_BASE + item.pattern);
    writer.u32(Math.max(1, Math.round(item.length)));
    writer.u16(MAX_TRACKS - item.track); // l'indice di traccia e' memorizzato al contrario
    writer.u16(0); // gruppo
    writer.raw([120, 0]);
    writer.u16(64); // flag dell'elemento
    writer.raw([64, 100, 128, 128]);
    writer.f32(0); // start offset
    writer.f32(-1); // end offset
  }
  return writer.toArray();
}

/** Dati di una traccia della playlist (66 byte, come li scrive FL 20). */
function encodeTrack(index: number): number[] {
  const writer = new ByteWriter();
  writer.u32(index + 1); // iid, 1-based
  writer.u32(0); // colore
  writer.u32(0); // icona
  writer.u8(1); // abilitata
  writer.f32(1); // altezza, 100%
  writer.u32(0xffffffff); // altezza bloccata: -1
  writer.u8(0); // contenuto non bloccato
  writer.u32(0); // motion: Stay
  writer.u32(0); // press: Retrigger
  writer.u32(2); // trigger sync: mezza battuta
  writer.u32(0); // queued
  writer.u32(0); // tolerant
  writer.u32(0); // position sync
  writer.u8(0); // non raggruppata
  writer.u8(0); // non bloccata
  while (writer.length < 66) writer.u8(0);
  return writer.toArray();
}

/** Genera il progetto .flp completo. */
export function writeFlpFile(project: FlpProjectInput): Uint8Array {
  const events = new EventStream();

  // La versione va per prima: determina la codifica delle stringhe successive.
  events.ascii(EV.flVersion, FL_VERSION);
  events.dword(EV.flBuild, FL_BUILD);
  events.byte(EV.showInfo, 0);
  events.byte(EV.playTruncatedNotes, 1);
  events.word(EV.tempoCoarse, Math.round(project.bpm));
  events.dword(EV.tempo, Math.round(project.bpm * 1000));
  events.byte(EV.timeSigNum, 4);
  events.byte(EV.timeSigBeat, 4);
  events.text(EV.title, project.title);
  events.text(EV.comments, project.comments);
  events.text(EV.genre, project.genre ?? 'Trap');

  // Gruppo di visualizzazione predefinito del Channel Rack.
  events.text(EV.displayGroupName, 'Unsorted');

  // Channel Rack: un canale sampler vuoto per strumento.
  project.channels.forEach((channel, index) => {
    events.word(EV.chanNew, index);
    events.byte(EV.chanType, 0); // 0 = Sampler
    events.byte(EV.chanEnabled, 1);
    events.dword(EV.chanGroupNum, 0);
    events.text(EV.chanName, channel.name);
    events.text(EV.pluginName, channel.name);
    if (channel.color !== undefined) events.color(EV.pluginColor, channel.color);
  });

  // Pattern: uno per sezione del beat.
  project.patterns.forEach((pattern, index) => {
    const number = index + 1;
    events.word(EV.patternNew, number);
    events.text(EV.patternName, pattern.name);
    if (pattern.color !== undefined) events.color(EV.patternColor, pattern.color);
    if (pattern.notes.length) {
      events.word(EV.patternNew, number);
      events.data(EV.patternNotes, encodeNotes(pattern.notes));
    }
  });
  events.word(EV.patternCurrent, 1);

  // Playlist: le sezioni in fila sulla timeline.
  events.word(EV.arrangementNew, 0);
  events.text(EV.arrangementName, 'Arrangement');
  if (project.playlist.length) {
    events.data(EV.playlist, encodePlaylist(project.playlist));
  }
  for (let track = 0; track < PLAYLIST_TRACKS; track++) {
    events.data(EV.trackData, encodeTrack(track));
    if (track === 0) events.text(EV.trackName, project.title);
  }
  events.word(EV.arrangementCurrent, 0);

  const body = events.toArray();
  const header: number[] = [];
  const push = (text: string) => {
    for (const char of text) header.push(char.charCodeAt(0));
  };
  push('FLhd');
  header.push(6, 0, 0, 0); // dimensione header
  header.push(0, 0); // formato 0 = progetto
  header.push(project.channels.length & 0xff, (project.channels.length >> 8) & 0xff);
  header.push(FLP_PPQ & 0xff, (FLP_PPQ >> 8) & 0xff);
  push('FLdt');
  header.push(body.length & 0xff, (body.length >> 8) & 0xff, (body.length >> 16) & 0xff, (body.length >> 24) & 0xff);

  return Uint8Array.from([...header, ...body]);
}
