import { TRACKS } from '../types';
import { useBeatStore } from '../store/useBeatStore';
import { Panel } from './ui/Panel';

export function Mixer() {
  const beat = useBeatStore((s) => s.beat);
  const setChannel = useBeatStore((s) => s.setChannel);
  const toggleMute = useBeatStore((s) => s.toggleMute);
  const toggleSolo = useBeatStore((s) => s.toggleSolo);
  const setMasterVolume = useBeatStore((s) => s.setMasterVolume);
  const selectTrack = useBeatStore((s) => s.selectTrack);

  if (!beat) return null;
  const anySolo = TRACKS.some((t) => beat.mixer[t.id].solo);

  return (
    <Panel
      title="Mixer"
      actions={
        <button
          className="btn btn-xs"
          onClick={() => {
            for (const track of TRACKS) {
              setChannel(track.id, { mute: false, solo: false });
            }
          }}
        >
          Reset M/S
        </button>
      }
    >
      <div className="space-y-1.5">
        {TRACKS.map((track) => {
          const channel = beat.mixer[track.id];
          const dimmed = anySolo && !channel.solo;
          return (
            <div
              key={track.id}
              className={`flex items-center gap-2 rounded-lg border border-ink-700/50 bg-ink-900/60 px-2 py-1.5 transition ${
                dimmed || channel.mute ? 'opacity-45' : ''
              }`}
            >
              <button
                className="flex w-20 shrink-0 items-center gap-1.5 text-left"
                onClick={() => track.group !== 'drums' && selectTrack(track.id)}
                title={track.group !== 'drums' ? 'Apri nel piano roll' : track.label}
              >
                <span className="h-3 w-1 rounded-full" style={{ background: track.color }} />
                <span className="truncate text-[11px] font-medium">{track.label}</span>
              </button>

              <button
                className={`btn btn-xs px-1.5 py-0.5 ${channel.mute ? 'border-flame-500 text-flame-400' : 'text-ink-400'}`}
                onClick={() => toggleMute(track.id)}
                aria-pressed={channel.mute}
                title="Mute"
              >
                M
              </button>
              <button
                className={`btn btn-xs px-1.5 py-0.5 ${channel.solo ? 'border-acid-500 text-acid-400' : 'text-ink-400'}`}
                onClick={() => toggleSolo(track.id)}
                aria-pressed={channel.solo}
                title="Solo"
              >
                S
              </button>

              <label className="flex min-w-0 flex-1 items-center gap-1.5">
                <input
                  type="range"
                  min={-40}
                  max={6}
                  step={0.5}
                  value={channel.volume}
                  onChange={(e) => setChannel(track.id, { volume: Number(e.target.value) })}
                  aria-label={`Volume ${track.label}`}
                />
                <span className="w-9 shrink-0 text-right font-mono text-[10px] text-ink-300">
                  {channel.volume.toFixed(1)}
                </span>
              </label>

              <label className="flex w-20 shrink-0 items-center gap-1" title="Pan">
                <span className="text-[9px] text-ink-500">L</span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={channel.pan}
                  onChange={(e) => setChannel(track.id, { pan: Number(e.target.value) })}
                  aria-label={`Pan ${track.label}`}
                />
                <span className="text-[9px] text-ink-500">R</span>
              </label>
            </div>
          );
        })}

        <div className="mt-2 flex items-center gap-2 rounded-lg border border-acid-600/40 bg-ink-900 px-2 py-2">
          <span className="w-20 text-[11px] font-semibold uppercase tracking-wider text-acid-400">Master</span>
          <input
            type="range"
            min={-40}
            max={6}
            step={0.5}
            value={beat.masterVolume}
            onChange={(e) => setMasterVolume(Number(e.target.value))}
            aria-label="Volume master"
          />
          <span className="w-10 text-right font-mono text-[10px] text-ink-300">{beat.masterVolume.toFixed(1)}</span>
        </div>
      </div>
    </Panel>
  );
}
