import { useMemo, useRef, useState } from 'react';
import { TICKS_PER_BAR, TRACKS } from '../types';
import type { SectionKind, TrackId } from '../types';
import { audioEngine } from '../audio/engine';
import { KIND_COLOR } from '../generator/structure';
import { useBeatStore, sectionOffsets } from '../store/useBeatStore';
import { usePlayhead, useTransportState } from '../hooks/useAudio';
import { Panel } from './ui/Panel';

const PX_PER_BAR = 28;
const SECTION_KINDS: SectionKind[] = ['INTRO', 'HOOK', 'VERSE', 'PRE', 'BRIDGE', 'OUTRO'];

export function Timeline() {
  const beat = useBeatStore((s) => s.beat);
  const selectedSectionId = useBeatStore((s) => s.selectedSectionId);
  const selectSection = useBeatStore((s) => s.selectSection);
  const addSection = useBeatStore((s) => s.addSection);
  const removeSection = useBeatStore((s) => s.removeSection);
  const duplicateSection = useBeatStore((s) => s.duplicateSection);
  const moveSection = useBeatStore((s) => s.moveSection);
  const resizeSectionTo = useBeatStore((s) => s.resizeSectionTo);
  const renameSection = useBeatStore((s) => s.renameSection);
  const regenerateOneSection = useBeatStore((s) => s.regenerateOneSection);

  const playing = useTransportState() === 'playing';
  const ticks = usePlayhead(playing);
  const trackRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);

  const offsets = useMemo(() => sectionOffsets(beat), [beat]);
  const totalBars = beat?.sections.reduce((s, sec) => s + sec.bars, 0) ?? 0;
  const selected = beat?.sections.find((s) => s.id === selectedSectionId) ?? null;

  if (!beat) return null;

  const playheadX = (ticks / TICKS_PER_BAR) * PX_PER_BAR;

  const seekFromEvent = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left + (trackRef.current?.scrollLeft ?? 0);
    audioEngine.seek(Math.max(0, (x / PX_PER_BAR) * TICKS_PER_BAR));
  };

  return (
    <Panel
      title="Arrangement"
      actions={
        <>
          <span className="font-mono text-[11px] text-ink-400">{totalBars} bars</span>
          <button className="btn btn-xs" onClick={() => setAdding((v) => !v)}>
            + Sezione
          </button>
        </>
      }
      bodyClassName="p-0"
    >
      {adding ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-700/60 bg-ink-900/60 p-2">
          <span className="label mr-1">Aggiungi</span>
          {SECTION_KINDS.map((kind) => (
            <button
              key={kind}
              className="btn btn-xs"
              style={{ borderColor: `${KIND_COLOR[kind]}66`, color: KIND_COLOR[kind] }}
              onClick={() => {
                addSection(kind, kind === 'VERSE' ? 16 : 8);
                setAdding(false);
              }}
            >
              {kind}
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto p-3">
        <div
          ref={trackRef}
          className="relative flex min-w-full select-none items-stretch gap-1 pb-1"
          onClick={seekFromEvent}
        >
          {beat.sections.map((section) => {
            const active = section.id === selectedSectionId;
            const color = KIND_COLOR[section.kind];
            const activeTracks = TRACKS.filter((t) => (section.clips[t.id]?.length ?? 0) > 0);
            return (
              <button
                key={section.id}
                onClick={(e) => {
                  e.stopPropagation();
                  selectSection(section.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  audioEngine.seek(offsets[section.id]?.startTick ?? 0);
                }}
                className={`relative flex flex-col justify-between overflow-hidden rounded-lg border p-2 text-left transition ${
                  active ? 'border-transparent bg-ink-750' : 'border-ink-700/70 bg-ink-900/70 hover:bg-ink-800'
                }`}
                style={{
                  width: Math.max(88, section.bars * PX_PER_BAR),
                  boxShadow: active ? `inset 0 0 0 1.5px ${color}` : undefined,
                }}
                title={`${section.name} — ${section.bars} battute (doppio click: vai qui)`}
              >
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: color, opacity: active ? 1 : 0.5 }} />
                <span className="mt-1 truncate text-xs font-semibold" style={{ color: active ? color : undefined }}>
                  {section.name}
                </span>
                <span className="font-mono text-[10px] text-ink-400">{section.bars} bars</span>
                <span className="mt-1 flex flex-wrap gap-0.5">
                  {activeTracks.map((t) => (
                    <span
                      key={t.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: t.color }}
                      title={t.label}
                    />
                  ))}
                </span>
              </button>
            );
          })}

          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-acid-400"
            style={{ left: playheadX, boxShadow: '0 0 8px #39dfa0' }}
          />
        </div>
      </div>

      {selected ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-ink-700/60 bg-ink-900/50 p-2">
          <input
            value={selected.name}
            onChange={(e) => renameSection(selected.id, e.target.value)}
            className="field w-32"
            aria-label="Nome sezione"
          />
          <div className="flex items-center gap-1">
            <button className="btn btn-xs" onClick={() => resizeSectionTo(selected.id, selected.bars - 1)}>
              −
            </button>
            <span className="w-14 text-center font-mono text-xs">{selected.bars} bar</span>
            <button className="btn btn-xs" onClick={() => resizeSectionTo(selected.id, selected.bars + 1)}>
              +
            </button>
          </div>
          <button className="btn btn-xs" onClick={() => moveSection(selected.id, -1)} title="Sposta a sinistra">
            ◀
          </button>
          <button className="btn btn-xs" onClick={() => moveSection(selected.id, 1)} title="Sposta a destra">
            ▶
          </button>
          <button className="btn btn-xs" onClick={() => duplicateSection(selected.id)}>
            Duplica
          </button>
          <button className="btn btn-xs" onClick={() => regenerateOneSection(selected.id, 'section')}>
            Rigenera
          </button>
          <button
            className="btn btn-xs text-flame-400"
            onClick={() => removeSection(selected.id)}
            disabled={beat.sections.length <= 1}
          >
            Elimina
          </button>
        </div>
      ) : null}
    </Panel>
  );
}

export type { TrackId };
