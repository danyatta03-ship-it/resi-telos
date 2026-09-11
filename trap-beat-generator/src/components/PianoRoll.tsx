import { useEffect, useMemo, useRef, useState } from 'react';
import { MELODIC_TRACKS, TICKS_PER_BAR, TRACK_MAP } from '../types';
import type { NoteEvent, TrackId } from '../types';
import { audioEngine } from '../audio/engine';
import { isInScale, noteName, pitchClass } from '../music/theory';
import { useBeatStore, sectionOffsets } from '../store/useBeatStore';
import { usePlayhead, useTransportState } from '../hooks/useAudio';
import { Panel } from './ui/Panel';

const GRID_OPTIONS = [
  { label: '1/4', ticks: TICKS_PER_BAR / 4 },
  { label: '1/8', ticks: TICKS_PER_BAR / 8 },
  { label: '1/16', ticks: TICKS_PER_BAR / 16 },
  { label: '1/32', ticks: TICKS_PER_BAR / 32 },
];

const ROW_H = 15;
const VELOCITY_LANE = 54;
const RESIZE_ZONE = 9;

type DragMode = 'move' | 'resize' | 'velocity';

interface DragState {
  mode: DragMode;
  noteId: string;
  startX: number;
  startY: number;
  origin: NoteEvent;
}

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export function PianoRoll() {
  const beat = useBeatStore((s) => s.beat);
  const selectedSectionId = useBeatStore((s) => s.selectedSectionId);
  const selectedTrack = useBeatStore((s) => s.selectedTrack);
  const selectTrack = useBeatStore((s) => s.selectTrack);
  const addNote = useBeatStore((s) => s.addNote);
  const updateNote = useBeatStore((s) => s.updateNote);
  const deleteNote = useBeatStore((s) => s.deleteNote);
  const clearTrack = useBeatStore((s) => s.clearTrack);
  const regenerateOneSection = useBeatStore((s) => s.regenerateOneSection);

  const [gridTicks, setGridTicks] = useState(TICKS_PER_BAR / 16);
  const [pxPerBar, setPxPerBar] = useState(180);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const playing = useTransportState() === 'playing';
  const ticks = usePlayhead(playing);

  const section = beat?.sections.find((s) => s.id === selectedSectionId) ?? null;
  const notes = useMemo(() => section?.clips[selectedTrack] ?? [], [section, selectedTrack]);
  const offsets = useMemo(() => sectionOffsets(beat), [beat]);

  // Registro visibile, adattato alle note presenti.
  const [low, high] = useMemo(() => {
    if (!notes.length) return [48, 84];
    const min = Math.min(...notes.map((n) => n.p));
    const max = Math.max(...notes.map((n) => n.p));
    const lo = Math.max(12, Math.min(min - 3, max - 23));
    const hi = Math.min(120, Math.max(max + 3, lo + 23));
    return [lo, hi];
  }, [notes]);

  const rows = high - low + 1;
  const gridHeight = rows * ROW_H;
  const width = (section?.bars ?? 1) * pxPerBar;

  const tickToX = (t: number) => (t / TICKS_PER_BAR) * pxPerBar;
  const xToTick = (x: number) => (x / pxPerBar) * TICKS_PER_BAR;
  const pitchToY = (p: number) => (high - p) * ROW_H;
  const yToPitch = (y: number) => high - Math.floor(y / ROW_H);
  const snap = (t: number) => Math.max(0, Math.round(t / gridTicks) * gridTicks);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !section) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const limit = section.bars * TICKS_PER_BAR;

      if (drag.mode === 'move') {
        const t = Math.max(0, Math.min(limit - gridTicks, snap(drag.origin.t + xToTick(dx))));
        const p = Math.max(low, Math.min(high, drag.origin.p - Math.round(dy / ROW_H)));
        updateNote(section.id, selectedTrack, drag.noteId, { t, p });
      } else if (drag.mode === 'resize') {
        const d = Math.max(gridTicks / 2, snap(drag.origin.d + xToTick(dx)) || gridTicks / 2);
        updateNote(section.id, selectedTrack, drag.noteId, { d: Math.min(d, limit - drag.origin.t) });
      } else {
        const v = Math.max(1, Math.min(127, Math.round(drag.origin.v - dy)));
        updateNote(section.id, selectedTrack, drag.noteId, { v });
      }
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [section, selectedTrack, gridTicks, low, high, pxPerBar, updateNote]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!section || !selectedNoteId) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteNote(section.id, selectedTrack, selectedNoteId);
        setSelectedNoteId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [section, selectedNoteId, selectedTrack, deleteNote]);

  if (!beat || !section) return null;

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;
  const range = offsets[section.id];
  const localTicks = range ? ticks - range.startTick : -1;
  const playheadX = localTicks >= 0 && localTicks <= section.bars * TICKS_PER_BAR ? tickToX(localTicks) : -1;

  const onGridPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const t = snap(xToTick(x));
    const p = yToPitch(y);
    const note = { t, d: gridTicks, p, v: 96 };
    addNote(section.id, selectedTrack, note);
    void audioEngine.preview(selectedTrack, p, 0.3);
  };

  const onNotePointerDown = (event: React.PointerEvent<HTMLDivElement>, note: NoteEvent) => {
    event.stopPropagation();
    setSelectedNoteId(note.id);
    if (event.button === 2 || event.altKey) {
      deleteNote(section.id, selectedTrack, note.id);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const nearEdge = rect.right - event.clientX < RESIZE_ZONE;
    dragRef.current = {
      mode: nearEdge ? 'resize' : 'move',
      noteId: note.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...note },
    };
    if (!nearEdge) void audioEngine.preview(selectedTrack, note.p, 0.25, note.v / 127);
  };

  const barLines = Array.from({ length: section.bars * 4 + 1 }, (_, i) => i);

  return (
    <Panel
      title={`Piano Roll — ${section.name}`}
      actions={
        <>
          <select
            className="field w-auto px-1.5 py-0.5 text-xs"
            value={selectedTrack}
            onChange={(e) => selectTrack(e.target.value as TrackId)}
            aria-label="Traccia"
          >
            {MELODIC_TRACKS.map((id) => (
              <option key={id} value={id}>
                {TRACK_MAP[id].label}
              </option>
            ))}
          </select>
          <select
            className="field w-auto px-1.5 py-0.5 text-xs"
            value={gridTicks}
            onChange={(e) => setGridTicks(Number(e.target.value))}
            aria-label="Griglia"
          >
            {GRID_OPTIONS.map((g) => (
              <option key={g.label} value={g.ticks}>
                {g.label}
              </option>
            ))}
          </select>
          <button className="btn btn-xs" onClick={() => setPxPerBar((v) => Math.max(90, v - 40))} title="Zoom out">
            −
          </button>
          <button className="btn btn-xs" onClick={() => setPxPerBar((v) => Math.min(480, v + 40))} title="Zoom in">
            +
          </button>
        </>
      }
      bodyClassName="p-0"
    >
      <div className="flex items-center gap-2 border-b border-ink-700/60 px-2 py-1.5">
        {selectedNote ? (
          <>
            <span className="chip">{noteName(selectedNote.p)}</span>
            <label className="flex flex-1 items-center gap-2">
              <span className="label">Vel</span>
              <input
                type="range"
                min={1}
                max={127}
                value={selectedNote.v}
                onChange={(e) => updateNote(section.id, selectedTrack, selectedNote.id, { v: Number(e.target.value) })}
              />
              <span className="w-8 font-mono text-[11px]">{selectedNote.v}</span>
            </label>
            <button
              className="btn btn-xs text-flame-400"
              onClick={() => {
                deleteNote(section.id, selectedTrack, selectedNote.id);
                setSelectedNoteId(null);
              }}
            >
              Elimina
            </button>
          </>
        ) : (
          <span className="text-[11px] text-ink-400">
            Click sulla griglia per aggiungere, trascina per spostare, bordo destro per la durata, click destro per
            eliminare.
          </span>
        )}
        <button className="btn btn-xs" onClick={() => clearTrack(section.id, selectedTrack)}>
          Svuota
        </button>
        <button
          className="btn btn-xs"
          onClick={() =>
            regenerateOneSection(
              section.id,
              selectedTrack === 'chords' || selectedTrack === 'pad' ? 'chords' : 'melody',
            )
          }
        >
          Rigenera
        </button>
      </div>

      <div ref={scrollRef} className="flex overflow-auto" style={{ maxHeight: 420 }}>
        {/* Tastiera */}
        <div className="sticky left-0 z-20 w-11 shrink-0 bg-ink-900">
          {Array.from({ length: rows }, (_, i) => {
            const pitch = high - i;
            const black = BLACK_KEYS.has(pitchClass(pitch));
            const inScale = isInScale(pitch, beat.meta.rootPc, beat.meta.scaleId);
            return (
              <button
                key={pitch}
                onClick={() => void audioEngine.preview(selectedTrack, pitch, 0.4)}
                className={`flex w-full items-center justify-end border-b pr-1 text-[9px] ${
                  black ? 'bg-ink-950 text-ink-500' : 'bg-ink-800 text-ink-300'
                } ${inScale ? 'border-acid-600/30' : 'border-ink-900'}`}
                style={{ height: ROW_H }}
                title={noteName(pitch)}
              >
                {pitchClass(pitch) === 0 ? noteName(pitch) : ''}
              </button>
            );
          })}
          <div className="border-t border-ink-700/60 bg-ink-900 text-center text-[9px] text-ink-500" style={{ height: VELOCITY_LANE }}>
            VEL
          </div>
        </div>

        <div className="relative" style={{ width }}>
          {/* Griglia note */}
          <div
            className="relative cursor-crosshair"
            style={{ width, height: gridHeight }}
            onPointerDown={onGridPointerDown}
            onContextMenu={(e) => e.preventDefault()}
          >
            {Array.from({ length: rows }, (_, i) => {
              const pitch = high - i;
              const inScale = isInScale(pitch, beat.meta.rootPc, beat.meta.scaleId);
              return (
                <div
                  key={pitch}
                  className={`absolute left-0 right-0 border-b border-ink-900/80 ${
                    inScale ? 'bg-ink-850/70' : 'bg-ink-900/80'
                  }`}
                  style={{ top: i * ROW_H, height: ROW_H }}
                />
              );
            })}

            {barLines.map((i) => (
              <div
                key={i}
                className={`absolute top-0 bottom-0 ${i % 4 === 0 ? 'bg-ink-600/70' : 'bg-ink-700/40'}`}
                style={{ left: (i * pxPerBar) / 4, width: 1 }}
              />
            ))}

            {notes.map((note) => (
              <div
                key={note.id}
                onPointerDown={(e) => onNotePointerDown(e, note)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  deleteNote(section.id, selectedTrack, note.id);
                }}
                className={`absolute flex items-center rounded-[3px] border text-[9px] ${
                  selectedNoteId === note.id ? 'border-white/80 z-10' : 'border-black/40'
                }`}
                style={{
                  left: tickToX(note.t),
                  top: pitchToY(note.p) + 1,
                  width: Math.max(4, tickToX(note.d) - 1),
                  height: ROW_H - 2,
                  background: TRACK_MAP[selectedTrack].color,
                  opacity: 0.45 + (note.v / 127) * 0.55,
                  cursor: 'grab',
                }}
                title={`${noteName(note.p)} · vel ${note.v}`}
              >
                <span className="pointer-events-none ml-0.5 truncate text-ink-950">
                  {tickToX(note.d) > 26 ? noteName(note.p) : ''}
                </span>
                <span className="absolute right-0 top-0 h-full w-2 cursor-ew-resize" />
              </div>
            ))}

            {playheadX >= 0 ? (
              <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-acid-400" style={{ left: playheadX }} />
            ) : null}
          </div>

          {/* Corsia velocity */}
          <div
            className="relative border-t border-ink-700/60 bg-ink-950"
            style={{ width, height: VELOCITY_LANE }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {notes.map((note) => (
              <div
                key={note.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedNoteId(note.id);
                  dragRef.current = {
                    mode: 'velocity',
                    noteId: note.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    origin: { ...note },
                  };
                }}
                className="absolute bottom-0 w-1.5 cursor-ns-resize rounded-t-sm"
                style={{
                  left: tickToX(note.t),
                  height: (note.v / 127) * VELOCITY_LANE,
                  background: selectedNoteId === note.id ? '#ffffff' : TRACK_MAP[selectedTrack].color,
                  opacity: selectedNoteId === note.id ? 1 : 0.75,
                }}
                title={`vel ${note.v}`}
              />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
