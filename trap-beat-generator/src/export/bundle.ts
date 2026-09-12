import { zipSync, strToU8 } from 'fflate';
import type { Beat } from '../types';
import { buildMidiFiles } from '../midi/export';
import { buildFlp } from '../flp/export';
import { beatFileBase, buildInfoText } from './info';

/**
 * Pacchetto ZIP pronto per FL Studio: i MIDI (import garantito),
 * il progetto .flp sperimentale e il file con tutte le informazioni del beat.
 */
export function buildZip(beat: Beat): Uint8Array {
  const midi: Record<string, Uint8Array> = {};
  for (const file of buildMidiFiles(beat)) midi[file.name] = file.data;

  return zipSync(
    {
      midi,
      flstudio: {
        [`${beatFileBase(beat)}.flp`]: buildFlp(beat),
      },
      text: {
        'beat-info.txt': strToU8(buildInfoText(beat)),
      },
    },
    { level: 6 },
  );
}
