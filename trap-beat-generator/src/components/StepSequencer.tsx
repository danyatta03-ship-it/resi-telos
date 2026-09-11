import { useMemo, useState } from 'react';
import { DRUM_TRACKS, TICKS_PER_BAR, TRACK_MAP } from '../types';
import type { NoteEvent, TrackId } from '../types';
import { audioEngine } from '../audio/engine';
import { useBeatStore, sectionOffsets } from '../store/useBeatStore';
import { usePlayhead, useTransportState } from '../hooks/useAudio';
import { Panel } from './ui/Panel';

const RESOLUTIONS = [16, 32] as const;
type Resolution = (typeof RESOLUTIONS)[number];

const VELOCITY_CYCLE = [70, 100, 127];

export function StepSequencer() {
  const beat = useBeatStore((s) => s.beat);
  const selectedSectionId = useBeatStore((s) => s.selectedSectionId);
  const addNote = useBeatStore((s) => s.addNote);
  const updateNote = useBeatStore((s) => s.updateNote);
  const deleteNote = useBeatStore((s) => s.deleteNote);
  const clearTrack = useBeatStore((s) => s.clearTrack);
  const toggleMute = useBeatStore((s) => s.toggleMute);
  const toggleSolo = useBeatStore((s) => s.toggleSolo);
  const regenerateOneSection = useBeatStore((s) => s.regenerateOneSection);

  const [resolution, setResolution] = useState<Resolution>(16);
  const playing = useTransportState() === 'playing';
  const ticks = usePlayhead(playing);

  const section = beat?.sections.find((s) => s.id === selectedSectionId) ?? null;
  const offsets = useMemo(() => sectionOffsets(beat), [beat]);

  if (!beat || !section) return null;

  const stepTicks = TICKS_PER_BAR / resolution;
  const totalSteps = section.bars * resolution;
  const range = offsets[section.id];
  const localTicks = range ? ticks - range.startTick : -1;
  const currentStep = localTicks >= 0 && localTicks < section.bars * TICKS_PER_BAR ? Math.floor(localTicks / stepTicks) : -1;

  const notesInCell = (track: TrackId, step: number): NoteEvent[] => {
    const from = step * stepTicks;
    const to = from + stepTicks;
    return (section.clips[track] ?? []).filter((n) => n.t >= from && n.t < to);
  };

  const toggleCell = (track: TrackId, step: number) => {
    const existing = notesInCell(track, step);
    if (existing.length) {
      for (const note of existing) deleteNote(section.id, track, note.id);
      return;
    }
    const pitch = TRACK_MAP[track].drumPitch ?? 36;
    addNote(section.id, track, { t: step * stepTicks, d: Math.round(stepTicks * 0.5), p: pitch, v: 100 });
    void audioEngine.preview(track, pitch, 0.3, 0.85);
  };

  const cycleVelocity = (track: TrackId, step: number) => {
    const existing = notesInCell(track, step);
    if (!existing.length) return;
    const current = existing[0].v;
    const next = VELOCITY_CYCLE[(VELOCITY_CYCLE.findIndex((v) => current <= v) + 1) % VELOCITY_CYCLE.length];
    for (const note of existing) updateNote(section.id, track, note.id, { v: next });
    void audioEngine.preview(track, TRACK_MAP[track].drumPitch ?? 36, 0.3, next / 127);
  };

  return (
    <Panel
      title={`Step Sequencer — ${section.name}`}
      actions={
        <>
          <select
            className="field w-auto px-1.5 py-0.5 text-xs"
            value={resolution}
            onChange={(e) => setResolution(Number(e.target.value) as Resolution)}
            aria-label="Risoluzione griglia"
          >
            {RESOLUTIONS.map((r) => (
              <option key={r} value={r}>
                1/{r}
              </option>
            ))}
          </select>
          <button className="btn btn-xs" onClick={() => regenerateOneSection(section.id, 'drums')}>
            Rigenera drums
          </button>
        </>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <div className="min-w-max p-2">
          {DRUM_TRACKS.map((trackId) => {
            const def = TRACK_MAP[trackId];
            const channel = beat.mixer[trackId];
            return (
              <div key={trackId} className="mb-1 flex items-center gap-1">
                <div className="sticky left-0 z-10 flex w-[146px] shrink-0 items-center gap-1 bg-ink-850 pr-1">
                  <span className="h-3 w-1 rounded-full" style={{ background: def.color }} />
                  <span className="w-[68px] truncate text-[11px] font-medium">{def.label}</span>
                  <button
                    className={`btn btn-xs px-1.5 py-0.5 ${channel.mute ? 'text-flame-400' : 'text-ink-400'}`}
                    onClick={() => toggleMute(trackId)}
                    title="Mute"
                  >
                    M
                  </button>
                  <button
                    className={`btn btn-xs px-1.5 py-0.5 ${channel.solo ? 'text-acid-400' : 'text-ink-400'}`}
                    onClick={() => toggleSolo(trackId)}
                    title="Solo"
                  >
                    S
                  </button>
                  <button
                    className="btn btn-xs px-1.5 py-0.5 text-ink-400"
                    onClick={() => clearTrack(section.id, trackId)}
                    title="Svuota traccia in questa sezione"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex gap-[2px]">
                  {Array.from({ length: totalSteps }, (_, step) => {
                    const cell = notesInCell(trackId, step);
                    const active = cell.length > 0;
                    const velocity = active ? Math.max(...cell.map((n) => n.v)) : 0;
                    const isBarStart = step % resolution === 0;
                    const isBeat = step % (resolution / 4) === 0;
                    return (
                      <button
                        key={step}
                        onClick={() => toggleCell(trackId, step)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          cycleVelocity(trackId, step);
                        }}
                        className={`h-6 rounded-[3px] border transition ${
                          resolution === 16 ? 'w-5' : 'w-3'
                        } ${isBarStart ? 'ml-1' : ''} ${
                          active ? 'border-transparent' : isBeat ? 'border-ink-600 bg-ink-800' : 'border-ink-700/60 bg-ink-900'
                        } ${currentStep === step ? 'ring-1 ring-acid-400/70' : ''}`}
                        style={
                          active
                            ? {
                                background: def.color,
                                opacity: 0.42 + (velocity / 127) * 0.58,
                              }
                            : undefined
                        }
                        title={`${def.label} — step ${step + 1}${cell.length > 1 ? ` (${cell.length} note)` : ''}`}
                      >
                        {cell.length > 1 ? <span className="text-[8px] font-bold text-ink-950">{cell.length}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="border-t border-ink-700/60 px-3 py-1.5 text-[11px] text-ink-400">
        Click per attivare o disattivare uno step, click destro per cambiare accento. Il numero indica un roll
        con piu&#39; colpi dentro allo stesso step.
      </p>
    </Panel>
  );
}
