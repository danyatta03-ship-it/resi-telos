import { useState } from 'react';
import { useBeatStore, sectionOffsets } from '../store/useBeatStore';
import { buildMidiFiles } from '../midi/export';
import { buildFlp } from '../flp/export';
import { beatFileBase, buildInfoText } from '../export/info';
import { buildZip } from '../export/bundle';
import { renderWav, beatDurationSeconds } from '../audio/wav';
import { downloadBlob } from '../utils/download';
import { Panel } from './ui/Panel';

export function ExportPanel() {
  const beat = useBeatStore((s) => s.beat);
  const notify = useBeatStore((s) => s.notify);
  const selectedSectionId = useBeatStore((s) => s.selectedSectionId);
  const [wavProgress, setWavProgress] = useState<number | null>(null);

  if (!beat) return null;
  const offsets = sectionOffsets(beat);
  const selectedRange = selectedSectionId ? offsets[selectedSectionId] : null;
  const selectedSection = beat.sections.find((s) => s.id === selectedSectionId) ?? null;
  const base = beatFileBase(beat);
  const files = buildMidiFiles(beat);

  const exportZip = () => {
    try {
      const zip = buildZip(beat);
      downloadBlob(zip, `${base}.zip`, 'application/zip');
      notify('ZIP esportato', 'success');
    } catch (error) {
      console.error(error);
      notify('Errore durante l’export ZIP', 'error');
    }
  };

  const exportWav = async (range: { startTick: number; endTick: number } | null) => {
    if (wavProgress !== null) return;
    setWavProgress(0);
    notify('Rendering audio in corso...');
    try {
      const blob = await renderWav(beat, { bitDepth: 24, onProgress: setWavProgress, range });
      const suffix = range && selectedSection ? `_${selectedSection.name.replace(/\s+/g, '')}` : '';
      downloadBlob(blob, `${base}${suffix}.wav`, 'audio/wav');
      notify('WAV esportato (24 bit, 44.1 kHz)', 'success');
    } catch (error) {
      console.error(error);
      notify('Export WAV non riuscito su questo browser', 'error');
    } finally {
      setWavProgress(null);
    }
  };

  return (
    <Panel title="Export">
      <div className="space-y-3">
        <button className="btn btn-primary w-full" onClick={exportZip}>
          Scarica ZIP completo
        </button>
        <p className="-mt-2 font-mono text-[11px] text-ink-400">
          {base}.zip → /midi ({files.length} file) + /flstudio/{base}.flp + /text/beat-info.txt
        </p>

        <div>
          <p className="label mb-1.5">File MIDI singoli</p>
          <div className="grid grid-cols-2 gap-1.5">
            {files.map((file) => (
              <button
                key={file.name}
                className="btn btn-xs justify-between font-mono"
                onClick={() => {
                  downloadBlob(file.data, `${base}_${file.name}`, 'audio/midi');
                  notify(`${file.name} scaricato`, 'success');
                }}
              >
                <span className="truncate">{file.name}</span>
                <span className="text-[10px] text-ink-400">{(file.data.length / 1024).toFixed(1)}k</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="label mb-1.5">
            Progetto FL Studio <span className="text-flame-400">sperimentale</span>
          </p>
          <button
            className="btn w-full"
            onClick={() => {
              try {
                downloadBlob(buildFlp(beat), `${base}.flp`, 'application/octet-stream');
                notify('Progetto .flp esportato', 'success');
              } catch (error) {
                console.error(error);
                notify('Generazione del .flp non riuscita', 'error');
              }
            }}
          >
            Scarica {base}.flp
          </button>
          <p className="mt-1.5 text-[11px] leading-snug text-ink-400">
            Apre il beat direttamente in FL Studio con tempo, un pattern per sezione, la playlist
            gia&#39; montata e un canale per strumento. I canali arrivano <span className="text-ink-300">vuoti</span>:
            ci carichi i tuoi campioni e plugin. Il formato .flp non e&#39; documentato da Image-Line, quindi se
            una versione di FL non lo aprisse, usa i MIDI qui sopra.
          </p>
        </div>

        <div>
          <p className="label mb-1.5">Audio</p>
          <button className="btn w-full" onClick={() => void exportWav(null)} disabled={wavProgress !== null}>
            {wavProgress === null
              ? `Esporta WAV 24 bit (~${Math.round(beatDurationSeconds(beat))}s)`
              : `Rendering ${Math.round(wavProgress * 100)}%`}
          </button>
          {selectedRange && selectedSection ? (
            <button
              className="btn btn-xs mt-1.5 w-full"
              onClick={() => void exportWav(selectedRange)}
              disabled={wavProgress !== null}
            >
              Solo {selectedSection.name} (~{Math.round(beatDurationSeconds(beat, selectedRange))}s)
            </button>
          ) : null}
          {wavProgress !== null ? (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-700">
              <div className="h-full bg-acid-500 transition-all" style={{ width: `${wavProgress * 100}%` }} />
            </div>
          ) : null}
        </div>

        <div>
          <p className="label mb-1.5">Info beat</p>
          <button
            className="btn btn-xs w-full"
            onClick={() => {
              downloadBlob(buildInfoText(beat), `${base}_info.txt`, 'text/plain');
            }}
          >
            Scarica beat-info.txt
          </button>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-ink-700/60 bg-ink-950 p-2 font-mono text-[10px] leading-relaxed text-ink-300">
            {buildInfoText(beat).split('\n').slice(3, 16).join('\n')}
          </pre>
        </div>

        <p className="text-[11px] leading-snug text-ink-400">
          In FL Studio: <span className="text-ink-300">File &gt; Import &gt; MIDI file</span>, scegli
          &quot;import to new channels&quot; e imposta il tempo del progetto sul BPM indicato.
        </p>
      </div>
    </Panel>
  );
}
