import { useEffect, useMemo, useState } from 'react';
import type { MoodId } from '../types';
import { MOOD_LIST, MOODS, blendMoods } from '../music/moods';
import { useBeatStore } from '../store/useBeatStore';
import { readAutosave } from '../store/persistence';
import { normalizeBeat } from '../generator';
import type { Beat } from '../types';
import { Slider } from './ui/Slider';

const BPM_PRESETS = [70, 80, 90, 100, 110, 120, 130, 140, 150, 160];
const MAX_MOODS = 2;

export function SetupScreen() {
  const generate = useBeatStore((s) => s.generate);
  const savedBeats = useBeatStore((s) => s.savedBeats);
  const refreshProjects = useBeatStore((s) => s.refreshProjects);
  const loadProject = useBeatStore((s) => s.loadProject);
  const adoptBeat = useBeatStore((s) => s.adoptBeat);
  const [lastSession, setLastSession] = useState<Beat | null>(null);

  const [moods, setMoods] = useState<MoodId[]>([]);
  const [bpm, setBpm] = useState(140);
  const [bpmTouched, setBpmTouched] = useState(false);
  const [variation, setVariation] = useState(45);
  const [humanize, setHumanize] = useState(28);
  const [axes, setAxes] = useState({ hardness: 80, darkness: 70, space: 55 });
  const [axesTouched, setAxesTouched] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    void refreshProjects();
    setLastSession(readAutosave());
  }, [refreshProjects]);

  // Il BPM segue il mood scelto finche' l'utente non lo tocca a mano.
  useEffect(() => {
    if (bpmTouched || moods.length === 0) return;
    const ranges = moods.map((m) => MOODS[m].bpmRange);
    const low = ranges.reduce((s, r) => s + r[0], 0) / ranges.length;
    const high = ranges.reduce((s, r) => s + r[1], 0) / ranges.length;
    setBpm(Math.round((low + high) / 2));
  }, [moods, bpmTouched]);

  // Gli assi seguono il mood scelto finche' non li tocca l'utente.
  useEffect(() => {
    if (axesTouched || moods.length === 0) return;
    const blended = blendMoods(moods);
    setAxes({
      hardness: Math.round(blended.hardness),
      darkness: Math.round(blended.darkness),
      space: Math.round(blended.space),
    });
  }, [moods, axesTouched]);

  const toggleMood = (id: MoodId) => {
    setMoods((current) => {
      if (current.includes(id)) return current.filter((m) => m !== id);
      if (current.length >= MAX_MOODS) return [current[current.length - 1], id];
      return [...current, id];
    });
  };

  const summary = useMemo(() => moods.map((m) => MOODS[m].label).join(' + '), [moods]);
  const ready = moods.length > 0;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      {lastSession ? (
        <div className="panel animate-fade-up flex flex-wrap items-center justify-between gap-2 p-3">
          <span className="text-sm text-ink-300">
            Sessione precedente: <span className="text-slate-100">{lastSession.name}</span>
            <span className="ml-2 font-mono text-[11px] text-ink-400">{lastSession.meta.bpm} BPM</span>
          </span>
          <button className="btn btn-xs" onClick={() => adoptBeat(normalizeBeat(lastSession))}>
            Riprendi
          </button>
        </div>
      ) : null}

      <header className="animate-fade-up">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-acid-500">Trap Beat Generator</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
          Che beat vuoi creare?
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-300">
          Scegli il mood e la velocita&#39;. Il generatore costruisce tonalita&#39;, progressione, struttura,
          drum, 808 e melodie, poi puoi modificare tutto ed esportare i MIDI per FL Studio.
        </p>
      </header>

      <section className="animate-fade-up">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">1. Mood {moods.length > 0 ? `(${moods.length}/${MAX_MOODS})` : ''}</h2>
          <span className="text-[11px] text-ink-400">puoi combinarne due</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {MOOD_LIST.map((mood) => {
            const active = moods.includes(mood.id);
            return (
              <button
                key={mood.id}
                onClick={() => toggleMood(mood.id)}
                aria-pressed={active}
                className={`group relative overflow-hidden rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-transparent bg-ink-750 shadow-panel'
                    : 'border-ink-700/70 bg-ink-850/60 hover:border-ink-500 hover:bg-ink-800'
                }`}
                style={active ? { boxShadow: `inset 0 0 0 1px ${mood.accent}, 0 10px 30px -20px ${mood.accent}` } : undefined}
              >
                <span
                  className="absolute inset-x-0 top-0 h-0.5 transition-opacity"
                  style={{ background: mood.accent, opacity: active ? 1 : 0.25 }}
                />
                <span className="block text-sm font-semibold" style={{ color: active ? mood.accent : undefined }}>
                  {mood.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-400">{mood.blurb}</span>
                <span className="mt-1.5 block font-mono text-[10px] text-ink-500">
                  {mood.bpmRange[0]}-{mood.bpmRange[1]} BPM
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`transition-opacity duration-300 ${ready ? 'animate-fade-up opacity-100' : 'pointer-events-none opacity-30'}`}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">2. Quanto veloce deve essere il beat?</h2>
          <span className="text-[11px] text-ink-400">60-180 BPM</span>
        </div>

        <div className="panel p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={60}
                max={180}
                value={bpm}
                onChange={(e) => {
                  setBpmTouched(true);
                  const value = Number(e.target.value);
                  if (!Number.isNaN(value)) setBpm(Math.max(60, Math.min(180, value)));
                }}
                className="field w-24 text-center font-mono text-2xl"
                aria-label="BPM"
              />
              <span className="font-mono text-xs text-ink-400">BPM</span>
            </div>
            <div className="min-w-[200px] flex-1">
              <input
                type="range"
                min={60}
                max={180}
                value={bpm}
                onChange={(e) => {
                  setBpmTouched(true);
                  setBpm(Number(e.target.value));
                }}
                aria-label="BPM slider"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {BPM_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setBpmTouched(true);
                  setBpm(preset);
                }}
                className={`btn btn-xs font-mono ${bpm === preset ? 'btn-primary' : ''}`}
              >
                {preset}
              </button>
            ))}
          </div>

          <button
            className="mt-3 text-[11px] uppercase tracking-widest text-ink-400 hover:text-acid-400"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? '− opzioni avanzate' : '+ opzioni avanzate'}
          </button>

          {showAdvanced ? (
            <>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Slider
                label="Hardness"
                value={axes.hardness}
                min={0}
                max={100}
                unit="%"
                hint="cattiveria di kick e 808"
                onChange={(v) => {
                  setAxesTouched(true);
                  setAxes((a) => ({ ...a, hardness: v }));
                }}
              />
              <Slider
                label="Darkness"
                value={axes.darkness}
                min={0}
                max={100}
                unit="%"
                hint="scale e atmosfera piu' cupe"
                onChange={(v) => {
                  setAxesTouched(true);
                  setAxes((a) => ({ ...a, darkness: v }));
                }}
              />
              <Slider
                label="Space"
                value={axes.space}
                min={0}
                max={100}
                unit="%"
                hint="quanto silenzio lasciare"
                onChange={(v) => {
                  setAxesTouched(true);
                  setAxes((a) => ({ ...a, space: v }));
                }}
              />
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Slider
                label="Variation"
                value={variation}
                min={0}
                max={100}
                unit="%"
                hint="0% ripetitivo e semplice, 100% sperimentale"
                onChange={setVariation}
              />
              <Slider
                label="Humanize"
                value={humanize}
                min={0}
                max={100}
                unit="%"
                hint="micro variazioni di timing e velocity"
                onChange={setHumanize}
              />
            </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="sticky bottom-3 z-10 animate-fade-up">
        <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-mono text-sm">
            <div>
              <span className="text-ink-400">Mood: </span>
              <span className="text-slate-100">{summary || '—'}</span>
            </div>
            <div>
              <span className="text-ink-400">BPM: </span>
              <span className="text-slate-100">{bpm}</span>
            </div>
          </div>
          <button
            className="btn btn-primary w-full px-8 py-3 text-base font-semibold tracking-wide sm:w-auto"
            disabled={!ready}
            onClick={() => generate({ moods, bpm, variation, humanize, ...axes })}
          >
            GENERATE BEAT
          </button>
        </div>
      </section>

      {savedBeats.length > 0 ? (
        <section className="animate-fade-up">
          <h2 className="label mb-2">Progetti salvati</h2>
          <div className="flex flex-wrap gap-2">
            {savedBeats.slice(0, 8).map((beat) => (
              <button key={beat.id} className="btn btn-xs" onClick={() => void loadProject(beat.id)}>
                <span className="truncate max-w-[160px]">{beat.name}</span>
                <span className="font-mono text-[10px] text-ink-400">{beat.meta.bpm}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
