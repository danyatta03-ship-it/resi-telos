import type { ScaleId } from '../types';
import { NOTE_NAMES, SCALES, keyLabel } from '../music/theory';
import { progressionLabel } from '../music/progressions';
import { MOODS } from '../music/moods';
import { useBeatStore } from '../store/useBeatStore';
import { Panel } from './ui/Panel';
import { Slider } from './ui/Slider';

const REGEN_BUTTONS = [
  { target: 'all', label: 'Regenerate All', primary: true },
  { target: 'melody', label: 'Melody' },
  { target: 'drums', label: 'Drums' },
  { target: '808', label: '808' },
  { target: 'chords', label: 'Chords' },
  { target: 'structure', label: 'Struttura' },
] as const;

export function GeneratorPanel() {
  const beat = useBeatStore((s) => s.beat);
  const regenerate = useBeatStore((s) => s.regenerate);
  const setVariation = useBeatStore((s) => s.setVariation);
  const setHumanize = useBeatStore((s) => s.setHumanize);
  const setKey = useBeatStore((s) => s.setKey);

  if (!beat) return null;
  const { meta } = beat;

  return (
    <Panel title="Generatore">
      <div className="space-y-4">
        <div>
          <p className="label mb-1.5">Rigenera</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {REGEN_BUTTONS.map((button) => (
              <button
                key={button.target}
                className={`btn btn-xs ${'primary' in button && button.primary ? 'btn-primary col-span-2 sm:col-span-3' : ''}`}
                onClick={() => regenerate(button.target)}
              >
                {button.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-400">
            Le parti che non rigeneri restano identiche: puoi tenere la melodia e cambiare solo le drums.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Slider
            label="Variation"
            value={meta.variation}
            min={0}
            max={100}
            unit="%"
            hint="densita', fill, complessita' ritmica"
            onChange={setVariation}
          />
          <Slider
            label="Humanize"
            value={meta.humanize}
            min={0}
            max={100}
            unit="%"
            hint="timing, velocity e durate meno rigide"
            onChange={setHumanize}
          />
        </div>
        <p className="-mt-2 text-[11px] text-ink-400">
          Variation cambia le prossime generazioni, Humanize agisce subito su playback ed export.
        </p>

        <div>
          <p className="label mb-1.5">Tonalita&#39;</p>
          <div className="flex gap-1.5">
            <select
              className="field"
              value={meta.rootPc}
              onChange={(e) => setKey(Number(e.target.value), meta.scaleId)}
              aria-label="Nota fondamentale"
            >
              {NOTE_NAMES.map((name, pc) => (
                <option key={name} value={pc}>
                  {name}
                </option>
              ))}
            </select>
            <select
              className="field"
              value={meta.scaleId}
              onChange={(e) => setKey(meta.rootPc, e.target.value as ScaleId)}
              aria-label="Scala"
            >
              {Object.values(SCALES).map((scale) => (
                <option key={scale.id} value={scale.id}>
                  {scale.label}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-400">
            Cambiando tonalita&#39; le note vengono trasposte e riadattate alla nuova scala.
          </p>
        </div>

        <dl className="space-y-1 border-t border-ink-700/60 pt-3 font-mono text-[11px] text-ink-300">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-500">Key</dt>
            <dd>{keyLabel(meta.rootPc, meta.scaleId)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-500">Progression</dt>
            <dd className="truncate">{progressionLabel(meta.progression)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-500">Mood</dt>
            <dd>{meta.moods.map((m) => MOODS[m]?.label ?? m).join(' + ')}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-500">Seed</dt>
            <dd>{meta.seed}</dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
}
