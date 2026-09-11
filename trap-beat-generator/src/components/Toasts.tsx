import { useBeatStore } from '../store/useBeatStore';

export function Toasts() {
  const toasts = useBeatStore((s) => s.toasts);
  const dismiss = useBeatStore((s) => s.dismissToast);

  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-50 flex flex-col items-end gap-1.5">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={`pointer-events-auto animate-fade-up rounded-lg border px-3 py-2 text-xs shadow-panel backdrop-blur ${
            toast.tone === 'success'
              ? 'border-acid-600/60 bg-ink-850/95 text-acid-400'
              : toast.tone === 'error'
                ? 'border-flame-500/60 bg-ink-850/95 text-flame-400'
                : 'border-ink-600 bg-ink-850/95 text-slate-200'
          }`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
