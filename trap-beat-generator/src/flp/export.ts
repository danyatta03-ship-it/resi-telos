import { PPQ, TICKS_PER_BAR, TRACKS } from '../types';
import type { Beat, TrackId } from '../types';
import { processedNotes } from '../audio/schedule';
import { KIND_COLOR } from '../generator/structure';
import { buildInfoText } from '../export/info';
import { FLP_PPQ, writeFlpFile } from './writer';
import type { FlpChannel, FlpNote, FlpPattern, FlpPlaylistItem } from './writer';

/** I canali percussivi in FL suonano il campione alla sua nota base, il DO centrale. */
const DRUM_KEY = 60;
const DRUM_TRACKS: TrackId[] = ['kick', 'snare', 'clap', 'hat', 'openhat', 'perc'];

/** Fattore di conversione dai nostri tick a quelli del progetto FL. */
const TICK_SCALE = FLP_PPQ / PPQ;

function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16) || 0x808080;
}

/**
 * Costruisce un progetto FL Studio: un canale per strumento, un pattern per
 * sezione e la playlist che rimette le sezioni in fila.
 */
export function buildFlp(beat: Beat): Uint8Array {
  // Solo le tracce che suonano davvero diventano canali.
  const used = TRACKS.filter((track) =>
    beat.sections.some((section) => (section.clips[track.id]?.length ?? 0) > 0),
  );
  const channelIndex = new Map<TrackId, number>();
  const channels: FlpChannel[] = used.map((track, index) => {
    channelIndex.set(track.id, index);
    return { name: track.label, color: hexToInt(track.color) };
  });

  const patterns: FlpPattern[] = [];
  const playlist: FlpPlaylistItem[] = [];
  let positionTicks = 0;

  beat.sections.forEach((section, sectionIndex) => {
    const notes: FlpNote[] = [];
    for (const track of used) {
      const index = channelIndex.get(track.id);
      if (index === undefined) continue;
      const isDrum = DRUM_TRACKS.includes(track.id);
      for (const note of processedNotes(beat, sectionIndex, track.id)) {
        notes.push({
          position: Math.round(note.t * TICK_SCALE),
          length: Math.max(1, Math.round(note.d * TICK_SCALE)),
          key: isDrum ? DRUM_KEY : note.p,
          channel: index,
          velocity: note.v,
          slide: note.slide,
        });
      }
    }
    notes.sort((a, b) => a.position - b.position);

    patterns.push({
      name: section.name,
      notes,
      color: hexToInt(KIND_COLOR[section.kind]),
    });

    const lengthTicks = Math.round(section.bars * TICKS_PER_BAR * TICK_SCALE);
    playlist.push({
      position: positionTicks,
      length: lengthTicks,
      pattern: sectionIndex + 1,
      track: 1,
    });
    positionTicks += lengthTicks;
  });

  return writeFlpFile({
    title: beat.name,
    comments: buildInfoText(beat),
    bpm: beat.meta.bpm,
    channels,
    patterns,
    playlist,
  });
}
