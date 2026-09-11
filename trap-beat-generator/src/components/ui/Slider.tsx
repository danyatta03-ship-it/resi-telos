interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}

export function Slider({ label, value, min, max, step = 1, unit = '', hint, onChange, format }: SliderProps) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="label">{label}</span>
        <span className="font-mono text-xs text-acid-400">
          {format ? format(value) : `${Math.round(value)}${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      {hint ? <p className="mt-1 text-[11px] leading-snug text-ink-400">{hint}</p> : null}
    </label>
  );
}
