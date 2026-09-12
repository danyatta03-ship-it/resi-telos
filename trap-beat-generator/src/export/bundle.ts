import { zipSync, strToU8 } from 'fflate';
import type { Beat } from '../types';
import { buildMidiFiles, buildPerTrackMidiFiles } from '../midi/export';
import { buildFlp } from '../flp/export';
import { beatFileBase, buildInfoText } from './info';
import { buildStructureText } from './summary';

/**
 * Pacchetto ZIP pronto per FL Studio: i MIDI (import garantito),
 * il progetto .flp sperimentale e il file con tutte le informazioni del beat.
 */
export function buildZip(beat: Beat): Uint8Array {
  const midi: Record<string, Uint8Array> = {};
  for (const file of buildMidiFiles(beat)) midi[file.name] = file.data;

  // Un file per strumento: si trascinano uno a uno sui canali del Channel Rack.
  const perTrack: Record<string, Uint8Array> = {};
  for (const file of buildPerTrackMidiFiles(beat)) perTrack[file.name] = file.data;

  return zipSync(
    {
      midi: { ...midi, strumenti: perTrack },
      flstudio: {
        [`${beatFileBase(beat)}.flp`]: buildFlp(beat),
      },
      text: {
        'beat-info.txt': strToU8(buildInfoText(beat)),
        'struttura.txt': strToU8(buildStructureText(beat)),
      },
    },
    { level: 6 },
  );
}
