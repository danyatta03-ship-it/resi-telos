import { useMemo } from 'react';
import { TICKS_PER_BAR } from '../types';
import { audioEngine } from '../audio/engine';
import { MOODS } from '../music/moods';
import { keyLabel } from '../music/theory';
import { progressionLabel } from '../music/progressions';
import { useBeatStore, sectionOffsets } from '../store/useBeatStore';
import { formatPosition, usePlayhead, useTransportState } from '../hooks/useAudio';
import { Visualizer } from './Visualizer';

interface TopBarProps {
  onOpenProjects: () => void;
}

export function TopBar({ onOpenProjects }: TopBarProps) {
  const beat = useBeatStore((s) => s.beat);
  const setName = useBeatStore((s) => s.setName);
  const setBpm = useBeatStore((s) => s.setBpm);
  const setMasterVolume = useBeatStore((s) => s.setMasterVolume);
  const saveProject = useBeatStore((s) => s.saveProject);
  const setPhase = useBeatStore((s) => s.setPhase);
  const loopSection = useBeatStore((s) => s.loopSection);
  const setLoopSection = useBeatStore((s) => s.setLoopSection);
  const selectedSectionId = useBeatStore((s) => s.selectedSectionId);
  const selectSection = useBeatStore((s) => s.selectSection);

  const state = useTransportState();
  const playing = state === 'playing';
  const ticks = usePlayhead(playing);

  const totalBars = beat?.sections.reduce((s, sec) => s + sec.bars, 0) ?? 0;
  const offsets = useMemo(() => sectionOffsets(beat), [beat]);

  // Sezione attualmente sotto la testina di riproduzione.
  const currentSection = useMemo(() => {
    if (!beat) return null;
    return beat.sections.find((s) => {
      const range = offsets[s.id];
      return range && ticks >= range.startTick && ticks < range.endTick;
    });
  }, [beat, offsets, ticks]);

  if (!beat) return null;

  const play = async () => {
    if (playing) {
      audioEngine.pause();
      return;
    }
    const start =
      loopSection && selectedSectionId && audioEngine.getPositionTicks() === 0
        ? offsets[selectedSectionId]?.startTick
        : undefined;
    await audioEngine.play(start);
  };

  return (
    <header className="z-20 flex flex-col gap-2 border-b border-ink-700/60 bg-ink-900/90 px-3 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="flex items-center gap-2 text-left"
          onClick={() => setPhase('setup')}
          title="Nuovo beat"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-acid-500 to-violethz-500 font-bold text-ink-950">
            T
          </span>
        </button>

        <input
          value={beat.name}
          onChange={(e) => setName(e.target.value)}
          className="field w-40 min-w-0 flex-1 sm:w-56 sm:flex-none"
          aria-label="Nome del beat"
        />

        <div className="hidden items-center gap-1.5 md:flex">
          <span className="chip" title="Tonalita'">
            {keyLabel(beat.meta.rootPc, beat.meta.scaleId)}
          </span>
          <span className="chip" title="Progressione">
            {progressionLabel(beat.meta.progression)}
          </span>
          <span className="chip">{totalBars} bars</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-center gap-1 lg:flex">
            {beat.meta.moods.map((m) => (
              <span
                key={m}
                className="chip"
                style={{ color: MOODS[m]?.accent, background: 'rgba(255,255,255,0.04)' }}
              >
                {MOODS[m]?.label ?? m}
              </span>
            ))}
          </div>
          <button className="btn btn-xs" onClick={() => void saveProject()}>
            Salva
          </button>
          <button className="btn btn-xs" onClick={onOpenProjects}>
            Progetti
          </button>
          <button className="btn btn-xs" onClick={() => setPhase('setup')}>
            Nuovo
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button className="btn btn-primary px-4" onClick={() => void play()} aria-label={playing ? 'Pausa' : 'Play'}>
            {playing ? '❚❚' : '▶'}
          </button>
          <button
            className="btn btn-xs px-3"
            onClick={() => {
              audioEngine.stop();
              if (loopSection && selectedSectionId) audioEngine.seek(offsets[selectedSectionId]?.startTick ?? 0);
            }}
            aria-label="Stop"
          >
            ■
          </button>
          <button
            className={`btn btn-xs px-3 ${loopSection ? 'btn-primary' : ''}`}
            onClick={() => setLoopSection(!loopSection)}
            title="Loop sulla sezione selezionata"
          >
            ⟳
          </button>
        </div>

        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="rounded-md bg-ink-950 px-2 py-1 text-acid-400">{formatPosition(ticks)}</span>
          <button
            className="truncate text-xs text-ink-300 hover:text-acid-400"
            onClick={() => currentSection && selectSection(currentSection.id)}
            title="Seleziona la sezione in riproduzione"
          >
            {currentSection?.name ?? '—'}
          </button>
        </div>

        <label className="flex items-center gap-2">
          <span className="label hidden sm:inline">BPM</span>
          <input
            type="number"
            min={60}
            max={180}
            value={beat.meta.bpm}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (!Number.isNaN(value)) setBpm(Math.max(60, Math.min(180, value)));
            }}
            className="field w-16 text-center font-mono"
            aria-label="BPM"
          />
        </label>

        <div className="hidden h-8 min-w-[120px] flex-1 overflow-hidden rounded-md border border-ink-700/70 bg-ink-950 sm:block">
          <Visualizer active={playing} />
        </div>

        <label className="flex min-w-[120px] items-center gap-2">
          <span className="label">Master</span>
          <input
            type="range"
            min={-40}
            max={6}
            step={0.5}
            value={beat.masterVolume}
            onChange={(e) => setMasterVolume(Number(e.target.value))}
            aria-label="Volume master"
          />
          <span className="w-10 font-mono text-[11px] text-ink-300">{beat.masterVolume.toFixed(1)}</span>
        </label>

        <span className="hidden font-mono text-[11px] text-ink-500 sm:inline">
          {Math.round((totalBars * 4 * 60) / beat.meta.bpm)}s / {TICKS_PER_BAR * totalBars} ticks
        </span>
      </div>
    </header>
  );
}
